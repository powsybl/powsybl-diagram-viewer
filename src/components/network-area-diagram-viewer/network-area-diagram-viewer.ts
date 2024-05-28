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
    edgeAngles: Map<string, number> = new Map<string, number>();

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
        this.edgeAngles = new Map<string, number>();
    }

    private drag(event: Event) {
        if (this.selectedElement) {
            event.preventDefault();
            this.ctm = this.svgDraw?.node.getScreenCTM();
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
        this.moveEdges(mousePosition);
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

    private moveEdges(mousePosition: Point) {
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
        const loopEdges: Map<string, SVGGraphicsElement[]> = new Map<
            string,
            SVGGraphicsElement[]
        >();
        const busNodeEdges: Map<string, SVGGraphicsElement[]> = new Map<
            string,
            SVGGraphicsElement[]
        >();
        edges.forEach((edge) => {
            const node1 = edge.getAttribute('node1') ?? '-1';
            const node2 = edge.getAttribute('node2') ?? '-1';
            let edgeGroup: SVGGraphicsElement[] = [];
            if (node1 == node2) {
                // loop edge
                if (loopEdges.has(node1)) {
                    edgeGroup = loopEdges.get(node1) ?? [];
                }
                edgeGroup.push(edge);
                loopEdges.set(node1, edgeGroup);
                const busNodeId1 = edge.getAttribute('busnode1');
                this.addBusNodeEdge(busNodeId1, edge, busNodeEdges);
                const busNodeId2 = edge.getAttribute('busnode2');
                this.addBusNodeEdge(busNodeId2, edge, busNodeEdges);
            } else {
                const edgeGroupId = node1.concat('_', node2);
                if (groupedEdges.has(edgeGroupId)) {
                    edgeGroup = groupedEdges.get(edgeGroupId) ?? [];
                }
                edgeGroup.push(edge);
                groupedEdges.set(edgeGroupId, edgeGroup);
                const busNodeId =
                    edge.getAttribute('node1') == this.selectedElement?.id
                        ? edge.getAttribute('busnode1')
                        : edge.getAttribute('busnode2');
                this.addBusNodeEdge(busNodeId, edge, busNodeEdges);
            }
        });
        // move grouped edges
        for (const edgeGroup of groupedEdges.values()) {
            this.moveEdgeGroup(edgeGroup);
        }
        // move loop edges
        for (const edgeGroup of loopEdges.values()) {
            this.moveLoopEdgeGroup(edgeGroup, mousePosition);
        }
        // redraw node
        this.redrawVoltageLevelNode(this.selectedElement, busNodeEdges, null);
    }

    private addBusNodeEdge(
        busNodeId: string | null,
        edge: SVGGraphicsElement,
        busNodeEdges: Map<string, SVGGraphicsElement[]>
    ) {
        let busEdgeGroup: SVGGraphicsElement[] = [];
        if (busNodeId != null) {
            if (busNodeEdges.has(busNodeId)) {
                busEdgeGroup = busNodeEdges.get(busNodeId) ?? [];
            }
            busEdgeGroup.push(edge);
            busNodeEdges.set(busNodeId, busEdgeGroup);
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

    private getOtherNode(
        edgeNodes: [SVGGraphicsElement | null, SVGGraphicsElement | null]
    ): SVGGraphicsElement | null {
        return edgeNodes[0]?.id == this.selectedElement?.id
            ? edgeNodes[1]
            : edgeNodes[0];
    }

    private getNodeRadius(busNodeId: number): [number, number, number] {
        const busNode: SVGGraphicsElement | null = this.container.querySelector(
            'nad\\:busnode[svgid="' + busNodeId + '"]'
        );
        const nbNeighbours = busNode?.getAttribute('nbneighbours');
        const busIndex = busNode?.getAttribute('index');
        return DiagramUtils.getNodeRadius(
            nbNeighbours == null ? 0 : +nbNeighbours,
            this.svgParameters.getVoltageLevelCircleRadius(),
            busIndex == null ? 0 : +busIndex,
            this.svgParameters.getInterAnnulusSpace()
        );
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
                    const busNodeId1 = edge.getAttribute('busnode1');
                    const nodeRadius1 = this.getNodeRadius(
                        busNodeId1 != null ? +busNodeId1 : -1
                    );
                    const edgeStart1 = DiagramUtils.getPointAtDistance(
                        DiagramUtils.getPosition(edgeNodes[0]),
                        edgeFork1,
                        nodeRadius1[1]
                    );
                    const busNodeId2 = edge.getAttribute('busnode2');
                    const nodeRadius2 = this.getNodeRadius(
                        busNodeId2 != null ? +busNodeId2 : -1
                    );
                    const edgeStart2 = DiagramUtils.getPointAtDistance(
                        DiagramUtils.getPosition(edgeNodes[1]),
                        edgeFork2,
                        nodeRadius2[1]
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
                        edgeMiddle,
                        nodeRadius1,
                        nodeRadius2
                    );
                }
                i++;
            });
            // redraw other voltage level node
            const otherNode: SVGGraphicsElement | null =
                this.getOtherNode(edgeNodes);
            this.redrawOtherVoltageLevelNode(otherNode, edges);
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
        const busNodeId1 = edge.getAttribute('busnode1');
        const nodeRadius1 = this.getNodeRadius(
            busNodeId1 != null ? +busNodeId1 : -1
        );
        const edgeStart1 = DiagramUtils.getPointAtDistance(
            DiagramUtils.getPosition(edgeNodes[0]),
            DiagramUtils.getPosition(edgeNodes[1]),
            nodeRadius1[1]
        );
        const busNodeId2 = edge.getAttribute('busnode2');
        const nodeRadius2 = this.getNodeRadius(
            busNodeId2 != null ? +busNodeId2 : -1
        );
        const edgeStart2 = DiagramUtils.getPointAtDistance(
            DiagramUtils.getPosition(edgeNodes[1]),
            DiagramUtils.getPosition(edgeNodes[0]),
            nodeRadius2[1]
        );
        const edgeMiddle = DiagramUtils.getMidPosition(edgeStart1, edgeStart2);
        // move edge
        this.moveEdge(
            edgeNode,
            edgeStart1,
            null,
            edgeStart2,
            null,
            edgeMiddle,
            nodeRadius1,
            nodeRadius2
        );
        // redraw other voltage level node
        const otherNode: SVGGraphicsElement | null =
            this.getOtherNode(edgeNodes);
        this.redrawOtherVoltageLevelNode(otherNode, [edge]);
    }

    private moveEdge(
        edgeNode: SVGGraphicsElement,
        edgeStart1: Point,
        edgeFork1: Point | null, // if null -> straight line
        edgeStart2: Point,
        edgeFork2: Point | null, // if null -> straight line
        edgeMiddle: Point,
        nodeRadius1: [number, number, number],
        nodeRadius2: [number, number, number]
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
            isTransformerEdge,
            nodeRadius1
        );
        this.moveHalfEdge(
            edgeNode,
            '2',
            edgeStart2,
            edgeFork2,
            edgeMiddle,
            isTransformerEdge,
            nodeRadius2
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
        // store edge angles, to use them for bus node redrawing
        this.edgeAngles.set(
            edgeNode.id + '.1',
            DiagramUtils.getAngle(
                edgeStart1,
                edgeFork1 == null ? edgeMiddle : edgeFork1
            )
        );
        this.edgeAngles.set(
            edgeNode.id + '.2',
            DiagramUtils.getAngle(
                edgeStart2,
                edgeFork2 == null ? edgeMiddle : edgeFork2
            )
        );
    }

    private moveHalfEdge(
        edgeNode: SVGGraphicsElement,
        side: string,
        startPolyline: Point,
        middlePolyline: Point | null, // if null -> straight line
        endPolyline: Point,
        transformerEdge: boolean,
        nodeRadius: [number, number, number]
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
                ? this.svgParameters.getArrowShift() +
                      (nodeRadius[2] - nodeRadius[1])
                : this.svgParameters.getArrowShift()
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

    private moveLoopEdgeGroup(
        edges: SVGGraphicsElement[],
        mousePosition: Point
    ) {
        edges.forEach((edge) => {
            // get edge element
            const edgeId = edge.getAttribute('svgid');
            if (!edgeId) {
                return;
            }
            const translation = new Point(
                mousePosition.x - this.initialPosition.x,
                mousePosition.y - this.initialPosition.y
            );
            this.moveSvgElement(edgeId, translation);
        });
    }

    private redrawVoltageLevelNode(
        node: SVGGraphicsElement | null,
        busNodeEdges: Map<string, SVGGraphicsElement[]>,
        movedEdges: SVGGraphicsElement[] | null // list of moved edges, null = all edges
    ) {
        if (node != null) {
            // get buses belonging to voltage level
            const busNodes: NodeListOf<SVGGraphicsElement> =
                this.container.querySelectorAll(
                    'nad\\:busnode[vlnode="' + node.id + '"]'
                );
            // if single bus voltage level -> do not redraw anything
            if (busNodes.length <= 1) {
                return;
            }
            // sort buses by index
            const sortedBusNodes: SVGGraphicsElement[] =
                DiagramUtils.getSortedBusNodes(busNodes);
            const traversingBusEdgesAngles: number[] = [];
            let redraw = false;
            for (let index = 0; index < sortedBusNodes.length; index++) {
                const busNode = sortedBusNodes[index];
                // skip redrawing of first bus
                if (index > 0 && redraw) {
                    this.redrawBusNode(
                        node,
                        busNode,
                        index,
                        traversingBusEdgesAngles
                    );
                }
                // add angles of edges starting from bus to traversing edges angles
                const busEdges =
                    busNodeEdges.get(busNode.getAttribute('svgid') ?? '-1') ??
                    [];
                busEdges.forEach((edge) => {
                    const edgeId = edge.getAttribute('svgid') ?? '-1';
                    const node1 = edge.getAttribute('node1') ?? '-1';
                    const node2 = edge.getAttribute('node2') ?? '-1';
                    const edgeAngle = this.getEdgeAngle(
                        busNode,
                        edge,
                        edgeId,
                        node1 == node2
                    );
                    if (typeof edgeAngle !== 'undefined') {
                        traversingBusEdgesAngles.push(edgeAngle);
                    }
                    // redraw only if there is an edge going to another voltage level
                    if (node1 != node2) {
                        // redraw only if the edge has been moved
                        if (movedEdges != null) {
                            movedEdges.forEach((movedEdge) => {
                                const movedEdgeId =
                                    movedEdge.getAttribute('svgid');
                                if (edgeId == movedEdgeId) {
                                    redraw = true;
                                }
                            });
                        } else {
                            // movedEdges == null -> all edges have been moved
                            redraw = true;
                        }
                    }
                });
            }
        }
    }

    getEdgeAngle(
        busNode: SVGGraphicsElement,
        edge: SVGGraphicsElement,
        edgeId: string,
        isLoopEdge: boolean
    ) {
        const busId = busNode.getAttribute('svgid') ?? '-2';
        const busNode1 = edge.getAttribute('busnode1') ?? '-1';
        const angleId = busId == busNode1 ? edgeId + '.1' : edgeId + '.2';
        if (!this.edgeAngles.has(angleId)) {
            // if not yet stored in angle map -> compute and store it
            const edgeNode: SVGGraphicsElement | null =
                this.container.querySelector("[id='" + edgeId + "']");
            if (edgeNode) {
                const side = busId == busNode1 ? 0 : 1;
                const halfEdge: HTMLElement = <HTMLElement>(
                    edgeNode.children.item(side)?.firstElementChild
                );
                if (halfEdge != null) {
                    const angle = isLoopEdge
                        ? DiagramUtils.getPathAngle(halfEdge)
                        : DiagramUtils.getPolylineAngle(halfEdge);
                    if (angle != null) {
                        this.edgeAngles.set(angleId, angle);
                    }
                }
            }
        }
        return this.edgeAngles.get(angleId);
    }

    private redrawBusNode(
        node: SVGGraphicsElement,
        busNode: SVGGraphicsElement,
        busIndex: number,
        traversingBusEdgesAngles: number[]
    ) {
        const nbNeighbours = busNode.getAttribute('nbneighbours');
        const busNodeRadius = DiagramUtils.getNodeRadius(
            nbNeighbours == null ? 0 : +nbNeighbours,
            this.svgParameters.getVoltageLevelCircleRadius(),
            busIndex,
            this.svgParameters.getInterAnnulusSpace()
        );
        traversingBusEdgesAngles.sort(function (a, b) {
            return a - b;
        });
        traversingBusEdgesAngles.push(
            traversingBusEdgesAngles[0] + 2 * Math.PI
        );
        const path: string = DiagramUtils.getFragmentedAnnulusPath(
            traversingBusEdgesAngles,
            busNodeRadius,
            this.svgParameters.getNodeHollowWidth()
        );
        const busElement: HTMLElement | null = <HTMLElement>(
            node.children.item(busIndex)
        );
        if (busElement != null) {
            busElement.setAttribute('d', path);
        }
    }

    private redrawOtherVoltageLevelNode(
        otherNode: SVGGraphicsElement | null,
        movedEdges: SVGGraphicsElement[]
    ) {
        if (otherNode != null) {
            // get other voltage level node edges
            const edges: NodeListOf<SVGGraphicsElement> =
                this.container.querySelectorAll(
                    'nad\\:edge[node1="' +
                        (otherNode?.id ?? -1) +
                        '"], nad\\:edge[node2="' +
                        (otherNode?.id ?? -1) +
                        '"]'
                );
            // group other voltage level node edges by bus node
            const busNodeEdges: Map<string, SVGGraphicsElement[]> = new Map<
                string,
                SVGGraphicsElement[]
            >();
            edges.forEach((edge) => {
                const node1 = edge.getAttribute('node1') ?? '-1';
                const node2 = edge.getAttribute('node2') ?? '-1';
                if (node1 == node2) {
                    // loop edge
                    const busNodeId1 = edge.getAttribute('busnode1');
                    this.addBusNodeEdge(busNodeId1, edge, busNodeEdges);
                    const busNodeId2 = edge.getAttribute('busnode2');
                    this.addBusNodeEdge(busNodeId2, edge, busNodeEdges);
                } else {
                    const busNodeId =
                        edge.getAttribute('node1') == otherNode?.id
                            ? edge.getAttribute('busnode1')
                            : edge.getAttribute('busnode2');
                    this.addBusNodeEdge(busNodeId, edge, busNodeEdges);
                }
            });
            // redraw other voltage level node
            this.redrawVoltageLevelNode(otherNode, busNodeEdges, movedEdges);
        }
    }
}
