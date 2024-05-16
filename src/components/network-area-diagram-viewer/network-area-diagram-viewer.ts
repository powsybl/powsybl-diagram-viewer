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
    ratio = 1;
    selectedElement: SVGGraphicsElement | null = null;
    transform: SVGTransform | undefined;
    ctm: DOMMatrix | null | undefined = null;
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
        // get the SVG parameters
        // so far, they are hardcoded in the class
        // the idea is to read them from the metadata included in the SVG
        this.svgParameters = new SvgParameters();
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
        this.svgDraw = SVG()
            .addTo(this.container)
            .size(this.width, this.height)
            .viewbox(
                dimensions.viewbox.x,
                dimensions.viewbox.y,
                dimensions.viewbox.width,
                dimensions.viewbox.height
            );
        const drawnSvg: HTMLElement = <HTMLElement>(
            this.svgDraw.svg(this.svgContent).node.firstElementChild
        );
        drawnSvg.style.overflow = 'visible';

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
            if (drawnSvg.parentElement != undefined) {
                drawnSvg.parentElement.style.cursor = 'move';
            }
        });
        this.svgDraw.on('panEnd', function () {
            if (drawnSvg.parentElement != undefined) {
                drawnSvg.parentElement.style.removeProperty('cursor');
            }
        });

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
        this.svgDraw?.panZoom({
            panning: true,
            zoomMin: 0.5 / this.ratio,
            zoomMax: 30 * this.ratio,
            zoomFactor: 0.15,
            margins: { top: 0, left: 0, right: 0, bottom: 0 },
        });
    }

    private disablePanzoom() {
        this.svgDraw?.panZoom({
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
        this.ctm = this.svgDraw?.node.getScreenCTM(); // used to compute mouse movement
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
            this.selectedElement.removeAttribute('style');
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
        const mousePosition = this.getMousePosition(event as MouseEvent);
        this.moveNode(mousePosition);
        this.moveText(mousePosition);
        this.moveEdges();
    }

    private moveNode(mousePosition: Point) {
        this.selectedElement?.setAttribute(
            'transform',
            'translate(' +
                mousePosition.x.toFixed(2) +
                ',' +
                mousePosition.y.toFixed(2) +
                ')'
        );
    }

    private moveText(mousePosition: Point) {
        const translation = new Point(
            mousePosition.x - this.initialPosition.x,
            mousePosition.y - this.initialPosition.y
        );
        // move node text
        this.moveSvgElement(
            this.selectedElement?.id + '-textnode',
            translation
        );
        // move edge connecting node and node text
        this.moveSvgElement(
            this.selectedElement?.id + '-textedge',
            translation
        );
    }

    private moveSvgElement(svgElementId: string, translation: Point) {
        const svgElement: SVGGraphicsElement | null =
            this.container.querySelector("[id='" + svgElementId + "']");
        if (svgElement) {
            const transform = DiagramUtils.getTransform(svgElement);
            const totalTranslation = new Point(
                (transform?.matrix.e ?? 0) + translation.x,
                (transform?.matrix.f ?? 0) + translation.y
            );
            svgElement?.setAttribute(
                'transform',
                'translate(' +
                    totalTranslation.x.toFixed(2) +
                    ',' +
                    totalTranslation.y.toFixed(2) +
                    ')'
            );
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
            const edgeGroupId = node1.concat('_', node2);
            let edgeGroup: SVGGraphicsElement[] = [];
            if (groupedEdges.has(edgeGroupId)) {
                edgeGroup = groupedEdges.get(edgeGroupId) ?? [];
            }
            edgeGroup.push(edge);
            groupedEdges.set(edgeGroupId, edgeGroup);
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
            this.moveStraightEdge(edges[0]); // 1 edge in the group -> straight line
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
                    this.moveStraightEdge(edge); // central edge, if present -> straight line
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
                    const edgeStart1 = DiagramUtils.getPointAtDistance(
                        DiagramUtils.getPosition(edgeNodes[0]),
                        edgeFork1,
                        this.svgParameters.getBusAnnulusOuterRadius()
                    );
                    const edgeStart2 = DiagramUtils.getPointAtDistance(
                        DiagramUtils.getPosition(edgeNodes[1]),
                        edgeFork2,
                        this.svgParameters.getBusAnnulusOuterRadius()
                    );
                    const edgeMiddle = DiagramUtils.getMidPosition(
                        edgeFork1,
                        edgeFork2
                    );
                    // move edge
                    this.moveEdge(
                        edgeNode,
                        edgeStart1,
                        edgeFork1,
                        edgeStart2,
                        edgeFork2,
                        edgeMiddle
                    );
                }
                i++;
            });
        }
    }

    private moveStraightEdge(edge: SVGGraphicsElement) {
        // get edge element
        const edgeNode: SVGGraphicsElement | null =
            this.container.querySelector(
                "[id='" + edge.getAttribute('svgid') + "']"
            );
        if (!edgeNode) {
            return;
        }
        // compute moved edge data: polyline points
        const edgeNodes = this.getEdgeNodes(edge);
        const edgeStart1 = DiagramUtils.getPointAtDistance(
            DiagramUtils.getPosition(edgeNodes[0]),
            DiagramUtils.getPosition(edgeNodes[1]),
            this.svgParameters.getBusAnnulusOuterRadius()
        );
        const edgeStart2 = DiagramUtils.getPointAtDistance(
            DiagramUtils.getPosition(edgeNodes[1]),
            DiagramUtils.getPosition(edgeNodes[0]),
            this.svgParameters.getBusAnnulusOuterRadius()
        );
        const edgeMiddle = DiagramUtils.getMidPosition(edgeStart1, edgeStart2);
        // move edge
        this.moveEdge(edgeNode, edgeStart1, null, edgeStart2, null, edgeMiddle);
    }

    private moveEdge(
        edgeNode: SVGGraphicsElement,
        edgeStart1: Point,
        edgeFork1: Point | null, // if null -> straight line
        edgeStart2: Point,
        edgeFork2: Point | null, // if null -> straight line
        edgeMiddle: Point
    ) {
        const edgeType: DiagramUtils.EdgeType =
            DiagramUtils.getEdgeType(edgeNode);
        const isTransformerEdge =
            edgeType == DiagramUtils.EdgeType.TWO_WINDINGS_TRANSFORMER ||
            edgeType == DiagramUtils.EdgeType.PHASE_SHIFT_TRANSFORMER;
        const isHVDCLineEdge = edgeType == DiagramUtils.EdgeType.HVDC_LINE;
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
                edgeFork1 == null ? edgeStart1 : edgeFork1,
                edgeMiddle,
                edgeFork2 == null ? edgeStart2 : edgeFork2,
                edgeMiddle,
                edgeType
            );
        } else if (isHVDCLineEdge) {
            this.moveConverterStation(
                edgeNode,
                edgeFork1 == null ? edgeStart1 : edgeFork1,
                edgeMiddle,
                edgeFork2 == null ? edgeStart2 : edgeFork2,
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
            ? DiagramUtils.getPointAtDistance(
                  endPolyline,
                  middlePolyline == null ? startPolyline : middlePolyline,
                  1.5 * this.svgParameters.getTransfomerCircleRadius()
              )
            : endPolyline;
        let polylinePoints: string =
            startPolyline.x.toFixed(2) + ',' + startPolyline.y.toFixed(2);
        if (middlePolyline != null) {
            polylinePoints +=
                ' ' +
                middlePolyline.x.toFixed(2) +
                ',' +
                middlePolyline.y.toFixed(2);
        }
        polylinePoints +=
            ' ' + endPolyline.x.toFixed(2) + ',' + endPolyline.y.toFixed(2);
        polyline?.setAttribute('points', polylinePoints);
        // move edge arrow
        const arrowCenter = DiagramUtils.getPointAtDistance(
            middlePolyline == null ? startPolyline : middlePolyline,
            endPolyline,
            middlePolyline == null
                ? this.svgParameters.getArrowShift()
                : this.svgParameters.getArrowShift() - 2.5
        );
        const arrowElement = halfEdge?.lastElementChild as SVGGraphicsElement;
        arrowElement?.setAttribute(
            'transform',
            'translate(' +
                arrowCenter.x.toFixed(2) +
                ',' +
                arrowCenter.y.toFixed(2) +
                ')'
        );
        const arrowAngle = DiagramUtils.getArrowAngle(
            middlePolyline == null ? startPolyline : middlePolyline,
            endPolyline
        );
        const arrowRotationElement = arrowElement.firstElementChild
            ?.firstElementChild as SVGGraphicsElement;
        arrowRotationElement.setAttribute(
            'transform',
            'rotate(' + arrowAngle.toFixed(2) + ')'
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
            'rotate(' + labelData[0].toFixed(2) + ')'
        );
        labelRotationElement.setAttribute('x', '' + labelData[1].toFixed(2));
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
        endPolyline2: Point,
        edgeType: DiagramUtils.EdgeType
    ) {
        const transformerElement: SVGGraphicsElement =
            edgeNode.lastElementChild as SVGGraphicsElement;
        // move transformer circles
        const transformerCircles: NodeListOf<SVGGraphicsElement> =
            transformerElement?.querySelectorAll('circle');
        this.moveTransformerCircle(
            transformerCircles.item(0),
            startPolyline1,
            DiagramUtils.getPointAtDistance(
                endPolyline1,
                startPolyline1,
                1.5 * this.svgParameters.getTransfomerCircleRadius()
            )
        );
        this.moveTransformerCircle(
            transformerCircles.item(1),
            startPolyline2,
            DiagramUtils.getPointAtDistance(
                endPolyline2,
                startPolyline2,
                1.5 * this.svgParameters.getTransfomerCircleRadius()
            )
        );
        // if phase shifting transformer move transformer arrow
        const isPSTransformerEdge =
            edgeType == DiagramUtils.EdgeType.PHASE_SHIFT_TRANSFORMER;
        if (isPSTransformerEdge) {
            this.moveTransformerArrow(
                transformerElement,
                startPolyline1,
                endPolyline1,
                DiagramUtils.getMidPosition(endPolyline1, endPolyline2)
            );
        }
    }

    private moveTransformerCircle(
        transformerCircle: SVGGraphicsElement,
        startPolyline: Point,
        endPolyline: Point
    ) {
        const circleCenter: Point = DiagramUtils.getPointAtDistance(
            endPolyline,
            startPolyline,
            -this.svgParameters.getTransfomerCircleRadius()
        );
        transformerCircle.setAttribute('cx', '' + circleCenter.x.toFixed(2));
        transformerCircle.setAttribute('cy', '' + circleCenter.y.toFixed(2));
    }

    private moveTransformerArrow(
        transformerElement: SVGGraphicsElement,
        startPolyline: Point,
        endPolyline: Point,
        transformerCenter: Point
    ) {
        const arrowPath: SVGGraphicsElement | null =
            transformerElement.querySelector('path');
        const matrix: string = DiagramUtils.getTransformerArrowMatrixString(
            startPolyline,
            endPolyline,
            transformerCenter,
            this.svgParameters.getTransfomerCircleRadius()
        );
        arrowPath?.setAttribute('transform', 'matrix(' + matrix + ')');
    }

    private moveConverterStation(
        edgeNode: SVGGraphicsElement,
        startPolyline1: Point,
        endPolyline1: Point,
        startPolyline2: Point,
        endPolyline2: Point
    ) {
        const converterStationElement: SVGGraphicsElement =
            edgeNode.lastElementChild as SVGGraphicsElement;
        const polylinePoints: string = DiagramUtils.getConverterStationPolyline(
            startPolyline1,
            endPolyline1,
            startPolyline2,
            endPolyline2,
            this.svgParameters.getConverterStationWidth()
        );
        const polyline: SVGGraphicsElement | null =
            converterStationElement.querySelector('polyline');
        polyline?.setAttribute('points', polylinePoints);
    }
}
