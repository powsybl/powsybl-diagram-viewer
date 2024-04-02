/**
 * Copyright (c) 2022-2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { Point, SVG, ViewBoxLike, Svg } from '@svgdotjs/svg.js';
import '@svgdotjs/svg.panzoom.js';
import * as DiagramUtils from './diagram-utils';
import { SvgParameters } from './svg-parameters';

type DIMENSIONS = { width: number; height: number; viewbox: VIEWBOX };
type VIEWBOX = { x: number; y: number; width: number; height: number };

export class NetworkAreaDiagramViewer {
    container: HTMLElement;
    svgContent: string;
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
    svgDraw: Svg | undefined;
    ratio: number;
    selectedElement: SVGGraphicsElement | null = null;
    transform: SVGTransform | undefined;
    ctm: DOMMatrix | null = null;
    initialPosition: Point = new Point(0, 0);
    svgParameters: SvgParameters;

    constructor(
        container: HTMLElement,
        svgContent: string,
        minWidth: number,
        minHeight: number,
        maxWidth: number,
        maxHeight: number
    ) {
        this.container = container;
        this.svgContent = svgContent;
        this.width = 0;
        this.height = 0;
        this.originalWidth = 0;
        this.originalHeight = 0;
        this.init(minWidth, minHeight, maxWidth, maxHeight);
    }

    public setWidth(width: number): void {
        this.width = width;
    }

    public setOriginalWidth(originalWidth: number): void {
        this.originalWidth = originalWidth;
    }

    public setHeight(height: number): void {
        this.height = height;
    }

    public setOriginalHeight(originalHeight: number): void {
        this.originalHeight = originalHeight;
    }

    public setContainer(container: HTMLElement): void {
        this.container = container;
    }

    public setSvgContent(svgContent: string): void {
        this.svgContent = svgContent;
    }

    public getWidth(): number {
        return this.width;
    }

    public getOriginalWidth(): number {
        return this.originalWidth;
    }

    public getHeight(): number {
        return this.height;
    }

    public getOriginalHeight(): number {
        return this.originalHeight;
    }

    public getContainer(): HTMLElement {
        return this.container;
    }

    public getSvgContent(): string {
        return this.svgContent;
    }

    public getViewBox(): ViewBoxLike | undefined {
        return this.svgDraw?.viewbox();
    }

    public setViewBox(viewBox: ViewBoxLike): void {
        if (viewBox !== undefined && viewBox !== null) {
            this.svgDraw?.viewbox(viewBox);
        }
    }

    public init(
        minWidth: number,
        minHeight: number,
        maxWidth: number,
        maxHeight: number
    ): void {
        if (!this.container || !this.svgContent) {
            return;
        }

        const dimensions: DIMENSIONS | null = this.getDimensionsFromSvg();
        if (!dimensions) {
            return;
        }

        // clear the previous svg in div element before replacing
        this.container.innerHTML = '';

        // set dimensions
        this.setOriginalWidth(dimensions.width);
        this.setOriginalHeight(dimensions.height);
        this.setWidth(
            dimensions.width < minWidth
                ? minWidth
                : Math.min(dimensions.width, maxWidth)
        );
        this.setHeight(
            dimensions.height < minHeight
                ? minHeight
                : Math.min(dimensions.height, maxHeight)
        );

        // set the SVG
        const draw = SVG()
            .addTo(this.container)
            .size(this.width, this.height)
            .viewbox(
                dimensions.viewbox.x,
                dimensions.viewbox.y,
                dimensions.viewbox.width,
                dimensions.viewbox.height
            );
        const drawnSvg: HTMLElement = <HTMLElement>(
            draw.svg(this.svgContent).node.firstElementChild
        );
        drawnSvg.style.overflow = 'visible';
        this.svgDraw = draw;

        // add pan and zoom to the SVG
        // we check if there is an "initial zoom" by checking ratio of width and height of the nad compared with viewBox sizes
        const widthRatio = dimensions.viewbox.width / this.getWidth();
        const heightRatio = dimensions.viewbox.height / this.getHeight();
        this.ratio = Math.max(widthRatio, heightRatio);
        this.enablePanzoom();
        // PowSyBl NAD introduced server side calculated SVG viewbox. This viewBox attribute can be removed as it is copied in the panzoom svg tag.
        const firstChild: HTMLElement = <HTMLElement>(
            this.svgDraw.node.firstChild
        );
        firstChild.removeAttribute('viewBox');
        firstChild.removeAttribute('width');
        firstChild.removeAttribute('height');

        // add events
        this.svgDraw.on('mousedown', (e: Event) => {
            this.startDrag(e);
        });
        this.svgDraw.on('mousemove', (e: Event) => {
            this.drag(e);
        });
        this.svgDraw.on('mouseup', (e: Event) => {
            this.endDrag(e);
        });
        this.svgDraw.on('mouseleave', (e: Event) => {
            this.endDrag(e);
        });
        this.svgDraw.on('panStart', function () {
            this.node.style.cursor = 'move';
        });
        this.svgDraw.on('panEnd', function () {
            this.node.style.cursor = 'default';
        });

        // get the SVG parameters
        // so far, they are hardcoded in the class
        // the idea is to read them from the metadata included in the SVG
        this.svgParameters = new SvgParameters();
    }

    public getDimensionsFromSvg(): DIMENSIONS | null {
        // Dimensions are set in the main svg tag attributes. We want to parse those data without loading the whole svg in the DOM.
        const result = this.svgContent.match('<svg[^>]*>');
        if (result === null || result.length === 0) {
            return null;
        }
        const emptiedSvgContent = result[0] + '</svg>';
        const svg: SVGSVGElement = new DOMParser()
            .parseFromString(emptiedSvgContent, 'image/svg+xml')
            .getElementsByTagName('svg')[0];
        const width = Number(svg.getAttribute('width'));
        const height = Number(svg.getAttribute('height'));
        const viewbox: VIEWBOX = svg.viewBox.baseVal;
        return { width: width, height: height, viewbox: viewbox };
    }

    private enablePanzoom() {
        this.svgDraw.panZoom({
            panning: true,
            zoomMin: 0.5 / this.ratio,
            zoomMax: 30 * this.ratio,
            zoomFactor: 0.15,
            margins: { top: 0, left: 0, right: 0, bottom: 0 },
        });
    }

    private disablePanzoom() {
        this.svgDraw.panZoom({
            panning: false,
        });
    }

    private startDrag(event: Event) {
        const draggableElem = DiagramUtils.getDraggableFrom(
            event.target as SVGElement
        );
        if (!draggableElem) {
            return;
        }
        this.disablePanzoom(); // to avoid panning the whole SVG when moving a node
        this.ctm = this.svgDraw.node.getScreenCTM(); // used to compute mouse movement
        this.selectedElement = draggableElem as SVGGraphicsElement; // element to be moved
        this.selectedElement.style.cursor = 'grabbing';
        this.initialPosition = DiagramUtils.getPosition(this.selectedElement); // used for the offset
    }

    private drag(event: Event) {
        if (this.selectedElement) {
            event.preventDefault();
            this.updateGraph(event);
            this.initialPosition = DiagramUtils.getPosition(
                this.selectedElement
            );
        }
    }

    private endDrag(event: Event) {
        if (this.selectedElement) {
            this.updateGraph(event);
            this.selectedElement.style.cursor = 'grab';
            this.selectedElement = null;
            this.initialPosition = new Point(0, 0);
            this.enablePanzoom();
        }
    }

    // position w.r.t the SVG box
    private getMousePosition(event: MouseEvent): Point {
        return new Point(
            (event.clientX - (this.ctm?.e ?? 0)) / (this.ctm?.a ?? 1),
            (event.clientY - (this.ctm?.f ?? 0)) / (this.ctm?.d ?? 1)
        );
    }

    private updateGraph(event: Event) {
        const offset = this.getMousePosition(event as MouseEvent);
        this.moveNode(offset);
        this.moveNodeText(offset);
        this.moveEdges();
    }

    private moveNode(offset: Point) {
        this.transform = DiagramUtils.getTransform(this.selectedElement);
        this.transform?.setTranslate(offset.x, offset.y);
    }

    private moveNodeText(offset: Point) {
        const translation = new Point(
            offset.x - this.initialPosition.x,
            offset.y - this.initialPosition.y
        );
        // move node text
        this.moveTextNode(this.selectedElement?.id + '-textnode', translation);
        // move edge connecting node and node text
        this.moveTextNode(this.selectedElement?.id + '-textedge', translation);
    }

    private moveTextNode(textNodeId: string, translation: Point) {
        const textNode: SVGGraphicsElement | null =
            this.container.querySelector("[id='" + textNodeId + "']");
        if (textNode) {
            const transform = DiagramUtils.getTransform(textNode);
            const totalTranslation = new Point(
                (transform?.matrix.e ?? 0) + translation.x,
                (transform?.matrix.f ?? 0) + translation.y
            );
            transform?.setTranslate(totalTranslation.x, totalTranslation.y);
        }
    }

    private moveEdges() {
        // get edges connected to the the node we are moving
        const edges: NodeListOf<SVGGraphicsElement> =
            this.container.querySelectorAll(
                'nad\\:edge[node1="' +
                    (this.selectedElement?.id ?? -1) +
                    '"], nad\\:edge[node2="' +
                    (this.selectedElement?.id ?? -1) +
                    '"]'
            );
        // group edges, to have multibranches - branches connecting the same nodes - together
        const groupedEdges: Map<string, SVGGraphicsElement[]> = new Map<
            string,
            SVGGraphicsElement[]
        >();
        edges.forEach((edge) => {
            const node1 = edge.getAttribute('node1') ?? '-1';
            const node2 = edge.getAttribute('node2') ?? '-1';
            let edgeGroup: SVGGraphicsElement[] = [];
            if (groupedEdges.has(node1.concat(node2))) {
                edgeGroup = groupedEdges.get(node1.concat(node2)) ?? [];
            }
            edgeGroup.push(edge);
            groupedEdges.set(node1.concat(node2), edgeGroup);
        });
        // move grouped edges
        for (const edgeGroup of groupedEdges.values()) {
            this.moveEdgeGroup(edgeGroup);
        }
    }

    // get the nodes at the sides of an edge
    private getEdgeNodes(
        edge: SVGGraphicsElement
    ): [SVGGraphicsElement | null, SVGGraphicsElement | null] {
        const otherNodeId =
            this.selectedElement?.id === edge.getAttribute('node1')
                ? edge.getAttribute('node2')
                : edge.getAttribute('node1');
        const otherNode: SVGGraphicsElement | null =
            this.container.querySelector("[id='" + otherNodeId + "']");
        const node1 =
            this.selectedElement?.id === edge.getAttribute('node1')
                ? this.selectedElement
                : otherNode;
        const node2 =
            otherNode?.id === edge.getAttribute('node1')
                ? this.selectedElement
                : otherNode;
        return [node1, node2];
    }

    private moveEdgeGroup(edges: SVGGraphicsElement[]) {
        if (edges.length == 1) {
            this.moveEdge(edges[0]); // 1 edge in the group -> straight line
        } else {
            const edgeNodes = this.getEdgeNodes(edges[0]);
            const point1 = DiagramUtils.getPosition(edgeNodes[0]);
            const point2 = DiagramUtils.getPosition(edgeNodes[1]);
            const angle = DiagramUtils.getAngle(point1, point2);
            const nbForks = edges.length;
            const angleStep =
                DiagramUtils.degToRad(
                    this.svgParameters.getEdgeForkAperture()
                ) /
                (nbForks - 1);
            let i = 0;
            edges.forEach((edge) => {
                if (2 * i + 1 == nbForks) {
                    this.moveEdge(edge); // central edge, if present -> straight line
                } else {
                    // get edge element
                    const edgeNode: SVGGraphicsElement | null =
                        this.container.querySelector(
                            "[id='" + edge.getAttribute('svgid') + "']"
                        );
                    if (!edgeNode) {
                        return;
                    }
                    // compute moved edge data: polyline points
                    const isTransformerEdge =
                        DiagramUtils.isTransformerEdge(edgeNode);
                    const alpha =
                        -DiagramUtils.degToRad(
                            this.svgParameters.getEdgeForkAperture()
                        ) /
                            2 +
                        i * angleStep;
                    const angleFork1 = angle - alpha;
                    const angleFork2 = angle + Math.PI + alpha;
                    const edgeFork1 = DiagramUtils.getEdgeFork(
                        point1,
                        this.svgParameters.getEdgeForkLength(),
                        angleFork1
                    );
                    const edgeFork2 = DiagramUtils.getEdgeFork(
                        point2,
                        this.svgParameters.getEdgeForkLength(),
                        angleFork2
                    );
                    const edgeStart1 = DiagramUtils.getDistance(
                        DiagramUtils.getPosition(edgeNodes[0]),
                        edgeFork1,
                        this.svgParameters.getBusAnnulusOuterRadius()
                    );
                    const edgeStart2 = DiagramUtils.getDistance(
                        DiagramUtils.getPosition(edgeNodes[1]),
                        edgeFork2,
                        this.svgParameters.getBusAnnulusOuterRadius()
                    );
                    const edgeMiddle = DiagramUtils.getMidPosition(
                        edgeFork1,
                        edgeFork2
                    );
                    this.moveHalfEdge(
                        edgeNode,
                        '1',
                        edgeStart1,
                        edgeFork1,
                        edgeMiddle,
                        isTransformerEdge
                    );
                    this.moveHalfEdge(
                        edgeNode,
                        '2',
                        edgeStart2,
                        edgeFork2,
                        edgeMiddle,
                        isTransformerEdge
                    );
                    if (isTransformerEdge) {
                        this.moveTransformer(
                            edgeNode,
                            edgeFork1,
                            edgeMiddle,
                            edgeFork2,
                            edgeMiddle
                        );
                    }
                }
                i++;
            });
        }
    }

    private moveEdge(edge: SVGGraphicsElement) {
        // get edge element
        const edgeNode: SVGGraphicsElement | null =
            this.container.querySelector(
                "[id='" + edge.getAttribute('svgid') + "']"
            );
        if (!edgeNode) {
            return;
        }
        // compute moved edge data: polyline points
        const isTransformerEdge = DiagramUtils.isTransformerEdge(edgeNode);
        const edgeNodes = this.getEdgeNodes(edge);
        const edgeStart1 = DiagramUtils.getDistance(
            DiagramUtils.getPosition(edgeNodes[0]),
            DiagramUtils.getPosition(edgeNodes[1]),
            this.svgParameters.getBusAnnulusOuterRadius()
        );
        const edgeStart2 = DiagramUtils.getDistance(
            DiagramUtils.getPosition(edgeNodes[1]),
            DiagramUtils.getPosition(edgeNodes[0]),
            this.svgParameters.getBusAnnulusOuterRadius()
        );
        const edgeMiddle = DiagramUtils.getMidPosition(edgeStart1, edgeStart2);
        this.moveHalfEdge(
            edgeNode,
            '1',
            edgeStart1,
            null,
            edgeMiddle,
            isTransformerEdge
        );
        this.moveHalfEdge(
            edgeNode,
            '2',
            edgeStart2,
            null,
            edgeMiddle,
            isTransformerEdge
        );
        if (isTransformerEdge) {
            this.moveTransformer(
                edgeNode,
                edgeStart1,
                edgeMiddle,
                edgeStart2,
                edgeMiddle
            );
        }
    }

    private moveHalfEdge(
        edgeNode: SVGGraphicsElement,
        side: string,
        startPolyline: Point,
        middlePolyline: Point | null, // if null -> straight line
        endPolyline: Point,
        transformerEdge: boolean
    ) {
        // get half edge element
        const halfEdge: SVGGraphicsElement | null = edgeNode.querySelector(
            "[id='" + edgeNode.id + '.' + side + "']"
        );

        // move edge polyline
        const polyline: SVGGraphicsElement | null | undefined =
            halfEdge?.querySelector('polyline');
        // if transformer edge reduce edge polyline, leaving space for the transformer
        endPolyline = transformerEdge
            ? DiagramUtils.getDistance(
                  endPolyline,
                  middlePolyline == null ? startPolyline : middlePolyline,
                  1.5 * this.svgParameters.getTransfomerCircleRadius()
              )
            : endPolyline;
        const polylinePoints: string =
            middlePolyline == null
                ? startPolyline.x +
                  ',' +
                  startPolyline.y +
                  ' ' +
                  endPolyline.x +
                  ',' +
                  endPolyline.y
                : startPolyline.x +
                  ',' +
                  startPolyline.y +
                  ' ' +
                  middlePolyline.x +
                  ',' +
                  middlePolyline.y +
                  ' ' +
                  endPolyline.x +
                  ',' +
                  endPolyline.y;
        polyline?.setAttribute('points', polylinePoints);

        // move edge arrow
        const arrowCenter = DiagramUtils.getDistance(
            middlePolyline == null ? startPolyline : middlePolyline,
            endPolyline,
            middlePolyline == null
                ? this.svgParameters.getArrowShift()
                : this.svgParameters.getArrowShift() - 2.5
        );
        const arrowElement = halfEdge?.lastElementChild as SVGGraphicsElement;
        const arrowTransform = DiagramUtils.getTransform(arrowElement);
        arrowTransform?.setTranslate(arrowCenter.x, arrowCenter.y);
        const arrowAngle = DiagramUtils.getArrowAngle(
            middlePolyline == null ? startPolyline : middlePolyline,
            endPolyline
        );
        const arrowRotationElement = arrowElement.firstElementChild
            ?.firstElementChild as SVGGraphicsElement;
        arrowRotationElement.setAttribute(
            'transform',
            'rotate(' + arrowAngle + ')'
        );

        // move edge label
        const labelData = DiagramUtils.getLabelData(
            middlePolyline == null ? startPolyline : middlePolyline,
            endPolyline,
            this.svgParameters.getArrowLabelShift()
        );
        const labelRotationElement = arrowElement.firstElementChild
            ?.lastElementChild as SVGGraphicsElement;
        labelRotationElement.setAttribute(
            'transform',
            'rotate(' + labelData[0] + ')'
        );
        labelRotationElement.setAttribute('x', '' + labelData[1]);
        if (labelData[2]) {
            labelRotationElement.setAttribute('style', labelData[2]);
        } else if (labelRotationElement.hasAttribute('style')) {
            labelRotationElement.removeAttribute('style');
        }
    }

    private moveTransformer(
        edgeNode: SVGGraphicsElement,
        startPolyline1: Point,
        endPolyline1: Point,
        startPolyline2: Point,
        endPolyline2: Point
    ) {
        const transformerElement: SVGGraphicsElement =
            edgeNode.lastElementChild as SVGGraphicsElement;
        const transformerCircles: NodeListOf<SVGGraphicsElement> =
            transformerElement?.querySelectorAll('circle');
        this.moveTransformerCircle(
            transformerCircles.item(0),
            startPolyline1,
            DiagramUtils.getDistance(
                endPolyline1,
                startPolyline1,
                1.5 * this.svgParameters.getTransfomerCircleRadius()
            )
        );
        this.moveTransformerCircle(
            transformerCircles.item(1),
            startPolyline2,
            DiagramUtils.getDistance(
                endPolyline2,
                startPolyline2,
                1.5 * this.svgParameters.getTransfomerCircleRadius()
            )
        );
    }

    private moveTransformerCircle(
        transformerCircle: SVGGraphicsElement,
        startPolyline: Point,
        endPolyline: Point
    ) {
        const circleCenter: Point = DiagramUtils.getDistance(
            endPolyline,
            startPolyline,
            -this.svgParameters.getTransfomerCircleRadius()
        );
        transformerCircle.setAttribute('cx', '' + circleCenter.x);
        transformerCircle.setAttribute('cy', '' + circleCenter.y);
    }
}
