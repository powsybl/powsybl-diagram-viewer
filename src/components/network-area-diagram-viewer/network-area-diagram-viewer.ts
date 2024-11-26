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
import {
    CSS_DECLARATION,
    CSS_RULE,
    DEFAULT_DYNAMIC_CSS_RULES,
    isFunctionDrivenRule,
    isThresholdDrivenRule,
    THRESHOLD_STATUS,
} from './dynamic-css-utils';
import { LayoutParameters } from './layout-parameters';
import { DiagramMetadata, EdgeMetadata, BusNodeMetadata, NodeMetadata, TextNodeMetadata } from './diagram-metadata';

type DIMENSIONS = { width: number; height: number; viewbox: VIEWBOX };
type VIEWBOX = { x: number; y: number; width: number; height: number };

export type OnMoveNodeCallbackType = (
    equipmentId: string,
    nodeId: string,
    x: number,
    y: number,
    XOrig: number,
    yOrig: number
) => void;

export type OnMoveTextNodeCallbackType = (
    equipmentId: string,
    vlNodeId: string,
    textNodeId: string,
    shiftX: number,
    shiftY: number,
    shiftXOrig: number,
    shiftYOrig: number,
    connectionShiftX: number,
    connectionShiftY: number,
    connectionShiftXOrig: number,
    connectionShiftYOrig: number
) => void;

export type OnSelectNodeCallbackType = (equipmentId: string, nodeId: string) => void;
export type OnToggleNadHoverCallbackType = (
    hovered: boolean,
    mousePosition: Point | null,
    equipmentId: string,
    equipmentType: string
) => void;

export class NetworkAreaDiagramViewer {
    container: HTMLElement;
    svgContent: string;
    diagramMetadata: DiagramMetadata | null;
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
    svgDraw: Svg | undefined;
    ratio = 1;
    selectedElement: SVGGraphicsElement | null = null;
    draggedElement: SVGGraphicsElement | null = null;
    transform: SVGTransform | undefined;
    ctm: DOMMatrix | null | undefined = null;
    initialPosition: Point = new Point(0, 0);
    svgParameters: SvgParameters;
    layoutParameters: LayoutParameters;
    edgeAngles: Map<string, number> = new Map<string, number>();
    textNodeSelected: boolean = false;
    endTextEdge: Point = new Point(0, 0);
    onMoveNodeCallback: OnMoveNodeCallbackType | null;
    onMoveTextNodeCallback: OnMoveTextNodeCallbackType | null;
    onSelectNodeCallback: OnSelectNodeCallbackType | null;
    dynamicCssRules: CSS_RULE[];
    onToggleHoverCallback: OnToggleNadHoverCallbackType | null;

    constructor(
        container: HTMLElement,
        svgContent: string,
        diagramMetadata: DiagramMetadata | null,
        minWidth: number,
        minHeight: number,
        maxWidth: number,
        maxHeight: number,
        onMoveNodeCallback: OnMoveNodeCallbackType | null,
        onMoveTextNodeCallback: OnMoveTextNodeCallbackType | null,
        onSelectNodeCallback: OnSelectNodeCallbackType | null,
        enableNodeInteraction: boolean,
        enableLevelOfDetail: boolean,
        customDynamicCssRules: CSS_RULE[] | null,
        onToggleHoverCallback: OnToggleNadHoverCallbackType | null
    ) {
        this.container = container;
        this.svgContent = svgContent;
        this.diagramMetadata = diagramMetadata;
        this.width = 0;
        this.height = 0;
        this.originalWidth = 0;
        this.originalHeight = 0;
        this.dynamicCssRules = customDynamicCssRules ?? DEFAULT_DYNAMIC_CSS_RULES;
        this.init(
            minWidth,
            minHeight,
            maxWidth,
            maxHeight,
            enableNodeInteraction,
            enableLevelOfDetail,
            diagramMetadata !== null
        );
        this.svgParameters = new SvgParameters(diagramMetadata?.svgParameters);
        this.layoutParameters = new LayoutParameters(diagramMetadata?.layoutParameters);
        this.onMoveNodeCallback = onMoveNodeCallback;
        this.onMoveTextNodeCallback = onMoveTextNodeCallback;
        this.onSelectNodeCallback = onSelectNodeCallback;
        this.onToggleHoverCallback = onToggleHoverCallback;
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
        this.svgDraw?.viewbox(viewBox);
    }

    public getDynamicCssRules() {
        return this.dynamicCssRules;
    }

    private getNodeIdFromEquipmentId(equipmentId: string) {
        const node: NodeMetadata | undefined = this.diagramMetadata?.nodes.find(
            (node) => node.equipmentId == equipmentId
        );
        return node?.svgId || null;
    }

    public moveNodeToCoordinates(equipmentId: string, x: number, y: number) {
        const nodeId = this.getNodeIdFromEquipmentId(equipmentId);
        if (nodeId != null) {
            const elemToMove: SVGElement | null = this.container.querySelector('[id="' + nodeId + '"]');
            if (elemToMove) {
                const newPosition = new Point(x, y);
                this.onDragStart(elemToMove);
                this.onDragEnd(newPosition, false);
            }
        }
    }

    public init(
        minWidth: number,
        minHeight: number,
        maxWidth: number,
        maxHeight: number,
        enableNodeInteraction: boolean,
        enableLevelOfDetail: boolean,
        hasMetadata: boolean
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
        this.setWidth(dimensions.width < minWidth ? minWidth : Math.min(dimensions.width, maxWidth));
        this.setHeight(dimensions.height < minHeight ? minHeight : Math.min(dimensions.height, maxHeight));

        // set the SVG
        this.svgDraw = SVG()
            .addTo(this.container)
            .size(this.width, this.height)
            .viewbox(dimensions.viewbox.x, dimensions.viewbox.y, dimensions.viewbox.width, dimensions.viewbox.height);
        const drawnSvg: HTMLElement = <HTMLElement>this.svgDraw.svg(this.svgContent).node.firstElementChild;
        drawnSvg.style.overflow = 'visible';

        // add events
        if (enableNodeInteraction && hasMetadata) {
            this.svgDraw.on('mousedown', (e: Event) => {
                if ((e as MouseEvent).button == 0) {
                    this.onMouseLeftDown(e as MouseEvent);
                }
            });
            this.svgDraw.on('mousemove', (e: Event) => {
                this.onMouseMove(e as MouseEvent);
            });
            this.svgDraw.on('mouseup mouseleave', (e: Event) => {
                if ((e as MouseEvent).button == 0) {
                    this.onMouseLeftUpOrLeave(e as MouseEvent);
                }
            });
        }
        if (hasMetadata) {
            this.svgDraw.on('mouseover', (e: Event) => {
                this.onHover(e as MouseEvent);
            });
        }
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
        const firstChild: HTMLElement = <HTMLElement>this.svgDraw.node.firstChild;
        firstChild.removeAttribute('viewBox');
        firstChild.removeAttribute('width');
        firstChild.removeAttribute('height');

        if (enableLevelOfDetail) {
            // We insert custom CSS to hide details before first load, in order to improve performances
            this.initializeDynamicCssRules(Math.max(dimensions.viewbox.width, dimensions.viewbox.height));
            this.injectDynamicCssRules(firstChild);
            this.svgDraw.fire('zoom'); // Forces a new dynamic zoom check to correctly update the dynamic CSS

            // We add an observer to track when the SVG's viewBox is updated by panzoom
            // (we have to do this instead of using panzoom's 'zoom' event to have accurate viewBox updates)
            const targetNode: SVGSVGElement = this.svgDraw.node;
            // Callback function to execute when mutations are observed
            const observerCallback = (mutationList: MutationRecord[]) => {
                for (const mutation of mutationList) {
                    if (mutation.attributeName === 'viewBox') {
                        this.checkAndUpdateLevelOfDetail(targetNode);
                    }
                }
            };
            const observer = new MutationObserver(observerCallback);
            observer.observe(targetNode, { attributeFilter: ['viewBox'] });
        }

        if (enableNodeInteraction && hasMetadata) {
            // fill empty elements: unknown buses and three windings transformers
            const emptyElements: NodeListOf<SVGGraphicsElement> = this.container.querySelectorAll(
                '.nad-unknown-busnode, .nad-3wt-nodes .nad-winding'
            );
            emptyElements.forEach((emptyElement) => {
                emptyElement.style.fill = '#0000';
            });
        }
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
            zoomMin: 0.5 / this.ratio, // maximum zoom OUT ratio (0.5 = at best, the displayed area is twice the SVG's size)
            zoomMax: 20 * this.ratio, // maximum zoom IN ratio (20 = at best, the displayed area is only 1/20th of the SVG's size)
            zoomFactor: 0.2,
            margins: { top: 0, left: 0, right: 0, bottom: 0 },
        });
    }

    private disablePanzoom() {
        this.svgDraw?.panZoom({
            panning: false,
        });
    }

    private onMouseLeftDown(event: MouseEvent) {
        // check dragging vs. selection
        if (event.shiftKey) {
            // selecting node
            this.onSelectStart(DiagramUtils.getSelectableFrom(event.target as SVGElement));
        } else {
            // moving node
            this.onDragStart(DiagramUtils.getDraggableFrom(event.target as SVGElement));
        }
    }

    private onSelectStart(selectableElem: SVGElement | undefined) {
        if (!selectableElem) {
            return;
        }
        this.disablePanzoom(); // to avoid panning the whole SVG when moving or selecting a node
        this.selectedElement = selectableElem as SVGGraphicsElement; // element to be selected
    }

    private onDragStart(draggableElem: SVGElement | undefined) {
        if (!draggableElem) {
            return;
        }

        // change cursor style
        const svg: HTMLElement = <HTMLElement>this.svgDraw?.node.firstElementChild?.parentElement;
        svg.style.cursor = 'grabbing';

        this.disablePanzoom(); // to avoid panning the whole SVG when moving or selecting a node
        this.draggedElement = draggableElem as SVGGraphicsElement; // element to be moved
        this.ctm = this.svgDraw?.node.getScreenCTM(); // used to compute mouse movement
        this.initialPosition = DiagramUtils.getPosition(this.draggedElement); // used for the offset
        this.edgeAngles = new Map<string, number>(); // used for node redrawing

        // check if I'm moving a text node
        this.textNodeSelected = DiagramUtils.isTextNode(this.draggedElement);
        if (this.textNodeSelected) {
            this.endTextEdge = new Point(0, 0);
        }
    }

    private onMouseMove(event: MouseEvent) {
        if (this.draggedElement) {
            event.preventDefault();
            this.ctm = this.svgDraw?.node.getScreenCTM(); // used to compute SVG transformations
            const newPosition = this.getMousePosition(event);
            this.drag(newPosition);
        }
    }

    private drag(newPosition: Point) {
        if (this.textNodeSelected) {
            this.dragVoltageLevelText(newPosition);
        } else {
            this.dragVoltageLevelNode(newPosition);
        }
        this.initialPosition = DiagramUtils.getPosition(this.draggedElement);
    }

    private onHover(mouseEvent: MouseEvent) {
        if (this.onToggleHoverCallback == null) {
            return;
        }

        const hoverableElem = DiagramUtils.getHoverableFrom(mouseEvent.target as SVGElement);
        if (!hoverableElem) {
            this.onToggleHoverCallback(false, null, '', '');
            return;
        }

        //get edge by svgId
        const edge: EdgeMetadata | undefined = this.diagramMetadata?.edges.find(
            (edge) => edge.svgId == hoverableElem?.id
        );

        if (edge) {
            const mousePosition = this.getMousePosition(mouseEvent);
            const equipmentId = edge?.equipmentId ?? '';
            const edgeType = DiagramUtils.getStringEdgeType(edge) ?? '';
            this.onToggleHoverCallback(true, mousePosition, equipmentId, edgeType);
        } else {
            this.onToggleHoverCallback(false, null, '', '');
        }
    }

    private onMouseLeftUpOrLeave(event: MouseEvent) {
        // check if I moved or selected an element
        if (this.draggedElement) {
            // moving node
            this.onDragEnd(this.getMousePosition(event), true);
        } else if (this.selectedElement) {
            // selecting node
            this.onSelectEnd();
        }
    }

    private onDragEnd(newPosition: Point, callMoveNodeCallback: boolean) {
        if (this.textNodeSelected) {
            this.dragVoltageLevelText(newPosition);
            this.updateTextNodeMetadataCallCallback(newPosition);
        } else {
            this.dragVoltageLevelNode(newPosition);
            this.updateNodeMetadataCallCallback(newPosition, callMoveNodeCallback);
        }
        // reset data
        this.draggedElement = null;
        this.enablePanzoom();

        // change cursor style back to normal
        const svg: HTMLElement = <HTMLElement>this.svgDraw?.node.firstElementChild?.parentElement;
        svg.style.removeProperty('cursor');
    }

    private onSelectEnd() {
        this.callSelectNodeCallback();
        this.selectedElement = null;
        this.enablePanzoom();
    }

    // position w.r.t the SVG box
    private getMousePosition(event: MouseEvent): Point {
        return new Point(
            (event.clientX - (this.ctm?.e ?? 0)) / (this.ctm?.a ?? 1),
            (event.clientY - (this.ctm?.f ?? 0)) / (this.ctm?.d ?? 1)
        );
    }

    // translation w.r.t. the initial position
    private getTranslation(mousePosition: Point): Point {
        return new Point(mousePosition.x - this.initialPosition.x, mousePosition.y - this.initialPosition.y);
    }

    private dragVoltageLevelText(mousePosition: Point) {
        window.getSelection()?.empty(); // to avoid text highlighting in firefox
        const vlNode: SVGGraphicsElement | null = this.container.querySelector(
            "[id='" + DiagramUtils.getVoltageLevelNodeId(this.draggedElement?.id) + "']"
        );
        this.moveText(this.draggedElement, vlNode, mousePosition, DiagramUtils.getTextNodeAngleFromCentre);
    }

    private dragVoltageLevelNode(mousePosition: Point) {
        this.moveNode(mousePosition);
        const textNode: SVGGraphicsElement | null = this.container.querySelector(
            "[id='" + DiagramUtils.getTextNodeId(this.draggedElement?.id) + "']"
        );
        this.moveText(
            textNode,
            this.draggedElement,
            this.getTranslation(mousePosition),
            DiagramUtils.getTextNodeTranslatedPosition
        );
        this.moveEdges(mousePosition);
    }

    private moveNode(mousePosition: Point) {
        this.draggedElement?.setAttribute(
            'transform',
            'translate(' + DiagramUtils.getFormattedPoint(mousePosition) + ')'
        );
    }

    private moveText(
        textNode: SVGGraphicsElement | null,
        vlNode: SVGGraphicsElement | null,
        position: Point,
        getPosition: (node: SVGGraphicsElement | null, position: Point) => Point
    ) {
        // compute text node new position
        const textNodeNewPosition = getPosition(textNode, position);
        // move text node
        this.moveTextNode(textNode, textNodeNewPosition);
        if (vlNode != null) {
            // move text edge
            this.moveTextEdge(
                DiagramUtils.getTextEdgeId(vlNode?.id),
                textNodeNewPosition,
                vlNode,
                textNode?.firstElementChild?.scrollHeight ?? 0,
                textNode?.firstElementChild?.scrollWidth ?? 0
            );
        }
    }

    private moveTextNode(textElement: SVGGraphicsElement | null, point: Point) {
        if (textElement != null) {
            textElement.setAttribute('x', DiagramUtils.getFormattedValue(point.x));
            textElement.setAttribute('y', DiagramUtils.getFormattedValue(point.y));
        }
    }

    private moveTextEdge(
        textEdgeId: string,
        textNodePosition: Point,
        vlNode: SVGGraphicsElement,
        textHeight: number,
        textWidth: number
    ) {
        const textEdge: SVGGraphicsElement | null = this.container.querySelector("[id='" + textEdgeId + "']");
        if (textEdge != null) {
            // compute voltage level circle radius
            const busNodes: BusNodeMetadata[] | undefined = this.diagramMetadata?.busNodes.filter(
                (busNode) => busNode.vlNode == vlNode.id
            );
            const nbNeighbours = busNodes !== undefined && busNodes.length > 1 ? busNodes.length - 1 : 0;
            const voltageLevelCircleRadius = DiagramUtils.getVoltageLevelCircleRadius(
                nbNeighbours,
                this.svgParameters.getVoltageLevelCircleRadius()
            );
            // compute text edge start and end
            const vlNodePosition = DiagramUtils.getPosition(vlNode);
            this.endTextEdge = DiagramUtils.getTextEdgeEnd(
                textNodePosition,
                vlNodePosition,
                this.layoutParameters.getTextNodeEdgeConnectionYShift(),
                textHeight,
                textWidth
            );
            const startTextEdge = DiagramUtils.getPointAtDistance(
                vlNodePosition,
                this.endTextEdge,
                voltageLevelCircleRadius
            );
            // update text edge polyline
            const polyline = DiagramUtils.getFormattedPolyline(startTextEdge, null, this.endTextEdge);
            textEdge.setAttribute('points', polyline);
        }
    }

    private moveSvgElement(svgElementId: string, translation: Point) {
        const svgElement: SVGGraphicsElement | null = this.container.querySelector("[id='" + svgElementId + "']");
        if (svgElement) {
            const transform = DiagramUtils.getTransform(svgElement);
            const totalTranslation = new Point(
                (transform?.matrix.e ?? 0) + translation.x,
                (transform?.matrix.f ?? 0) + translation.y
            );
            svgElement?.setAttribute(
                'transform',
                'translate(' + DiagramUtils.getFormattedPoint(totalTranslation) + ')'
            );
        }
    }

    private moveEdges(mousePosition: Point) {
        // get edges connected to the the node we are moving
        const edges: EdgeMetadata[] | undefined = this.diagramMetadata?.edges.filter(
            (edge) => edge.node1 == this.draggedElement?.id || edge.node2 == this.draggedElement?.id
        );
        // group edges, to have multibranches - branches connecting the same nodes - together
        const groupedEdges: Map<string, EdgeMetadata[]> = new Map<string, EdgeMetadata[]>();
        const loopEdges: Map<string, EdgeMetadata[]> = new Map<string, EdgeMetadata[]>();
        const busNodeEdges: Map<string, EdgeMetadata[]> = new Map<string, EdgeMetadata[]>();
        edges?.forEach((edge) => {
            let edgeGroup: EdgeMetadata[] = [];
            if (edge.node1 == edge.node2) {
                // loop edge
                if (loopEdges.has(edge.node1)) {
                    edgeGroup = loopEdges.get(edge.node1) ?? [];
                }
                edgeGroup.push(edge);
                loopEdges.set(edge.node1, edgeGroup);
                this.addBusNodeEdge(edge.busNode1, edge, busNodeEdges);
                this.addBusNodeEdge(edge.busNode2, edge, busNodeEdges);
            } else {
                const edgeGroupId = edge.node1.concat('_', edge.node2);
                if (groupedEdges.has(edgeGroupId)) {
                    edgeGroup = groupedEdges.get(edgeGroupId) ?? [];
                }
                edgeGroup.push(edge);
                groupedEdges.set(edgeGroupId, edgeGroup);
                const busNodeId = edge.node1 == this.draggedElement?.id ? edge.busNode1 : edge.busNode2;
                this.addBusNodeEdge(busNodeId, edge, busNodeEdges);
            }
        });
        // move grouped edges
        for (const edgeGroup of groupedEdges.values()) {
            this.moveEdgeGroup(edgeGroup, mousePosition);
        }
        // move loop edges
        for (const edgeGroup of loopEdges.values()) {
            this.moveLoopEdgeGroup(edgeGroup, mousePosition);
        }
        // redraw node
        this.redrawVoltageLevelNode(this.draggedElement, busNodeEdges, null);
    }

    private addBusNodeEdge(busNodeId: string | null, edge: EdgeMetadata, busNodeEdges: Map<string, EdgeMetadata[]>) {
        let busEdgeGroup: EdgeMetadata[] = [];
        if (busNodeId != null) {
            if (busNodeEdges.has(busNodeId)) {
                busEdgeGroup = busNodeEdges.get(busNodeId) ?? [];
            }
            busEdgeGroup.push(edge);
            busNodeEdges.set(busNodeId, busEdgeGroup);
        }
    }

    // get the nodes at the sides of an edge
    private getEdgeNodes(edge: EdgeMetadata): [SVGGraphicsElement | null, SVGGraphicsElement | null] {
        const otherNodeId = this.draggedElement?.id === edge.node1 ? edge.node2 : edge.node1;
        const otherNode: SVGGraphicsElement | null = this.container.querySelector("[id='" + otherNodeId + "']");
        const node1 = this.draggedElement?.id === edge.node1 ? this.draggedElement : otherNode;
        const node2 = otherNode?.id === edge.node1 ? this.draggedElement : otherNode;
        return [node1, node2];
    }

    private getOtherNode(edgeNodes: [SVGGraphicsElement | null, SVGGraphicsElement | null]): SVGGraphicsElement | null {
        return edgeNodes[0]?.id == this.draggedElement?.id ? edgeNodes[1] : edgeNodes[0];
    }

    private getNodeRadius(busNodeId: string): [number, number, number] {
        const busNode: BusNodeMetadata | undefined = this.diagramMetadata?.busNodes.find(
            (busNode) => busNode.svgId == busNodeId
        );
        return DiagramUtils.getNodeRadius(
            busNode?.nbNeighbours ?? 0,
            this.svgParameters.getVoltageLevelCircleRadius(),
            busNode?.index ?? 0,
            this.svgParameters.getInterAnnulusSpace()
        );
    }

    private moveEdgeGroup(edges: EdgeMetadata[], mousePosition: Point) {
        if (edges.length == 1) {
            this.moveStraightEdge(edges[0], mousePosition); // 1 edge in the group -> straight line
        } else {
            const edgeNodes = this.getEdgeNodes(edges[0]);
            const point1 = DiagramUtils.getPosition(edgeNodes[0]);
            const point2 = DiagramUtils.getPosition(edgeNodes[1]);
            const angle = DiagramUtils.getAngle(point1, point2);
            const nbForks = edges.length;
            const angleStep = this.svgParameters.getEdgesForkAperture() / (nbForks - 1);
            let i = 0;
            edges.forEach((edge) => {
                if (2 * i + 1 == nbForks) {
                    this.moveStraightEdge(edge, mousePosition); // central edge, if present -> straight line
                } else {
                    // get edge type
                    const edgeType = DiagramUtils.getEdgeType(edge);
                    if (edgeType == DiagramUtils.EdgeType.UNKNOWN) {
                        return;
                    }
                    if (edgeNodes[0] == null || edgeNodes[1] == null) {
                        // only 1 side of the edge is in the SVG
                        this.moveSvgElement(edge.svgId, this.getTranslation(mousePosition));
                        return;
                    }
                    // get edge element
                    const edgeNode: SVGGraphicsElement | null = this.container.querySelector(
                        "[id='" + edge.svgId + "']"
                    );
                    if (!edgeNode) {
                        return;
                    }
                    // compute moved edge data: polyline points
                    const alpha = -this.svgParameters.getEdgesForkAperture() / 2 + i * angleStep;
                    const angleFork1 = angle - alpha;
                    const angleFork2 = angle + Math.PI + alpha;
                    const edgeFork1 = DiagramUtils.getEdgeFork(
                        point1,
                        this.svgParameters.getEdgesForkLength(),
                        angleFork1
                    );
                    const edgeFork2 = DiagramUtils.getEdgeFork(
                        point2,
                        this.svgParameters.getEdgesForkLength(),
                        angleFork2
                    );
                    const unknownBusNode1 = edge.busNode1 != null && edge.busNode1.length == 0;
                    const nodeRadius1 = this.getNodeRadius(edge.busNode1 != null ? edge.busNode1 : '-1');
                    const edgeStart1 = DiagramUtils.getPointAtDistance(
                        DiagramUtils.getPosition(edgeNodes[0]),
                        edgeFork1,
                        unknownBusNode1
                            ? nodeRadius1[1] + this.svgParameters.getUnknownBusNodeExtraRadius()
                            : nodeRadius1[1]
                    );
                    const unknownBusNode2 = edge.busNode2 != null && edge.busNode2.length == 0;
                    const nodeRadius2 = this.getNodeRadius(edge.busNode2 != null ? edge.busNode2 : '-1');
                    const edgeStart2 = DiagramUtils.getPointAtDistance(
                        DiagramUtils.getPosition(edgeNodes[1]),
                        edgeFork2,
                        unknownBusNode2
                            ? nodeRadius2[1] + this.svgParameters.getUnknownBusNodeExtraRadius()
                            : nodeRadius2[1]
                    );
                    const edgeMiddle = DiagramUtils.getMidPosition(edgeFork1, edgeFork2);
                    // move edge
                    this.moveEdge(
                        edgeNode,
                        edgeStart1,
                        edgeFork1,
                        edgeStart2,
                        edgeFork2,
                        edgeMiddle,
                        nodeRadius1,
                        nodeRadius2,
                        edgeType
                    );
                }
                i++;
            });
            // redraw other voltage level node
            const otherNode: SVGGraphicsElement | null = this.getOtherNode(edgeNodes);
            this.redrawOtherVoltageLevelNode(otherNode, edges);
        }
    }

    private moveStraightEdge(edge: EdgeMetadata, mousePosition: Point) {
        // get edge type
        const edgeType = DiagramUtils.getEdgeType(edge);
        if (edgeType == DiagramUtils.EdgeType.UNKNOWN) {
            return;
        }
        const edgeNodes = this.getEdgeNodes(edge);
        if (edgeNodes[0] == null || edgeNodes[1] == null) {
            // only 1 side of the edge is in the SVG
            this.moveSvgElement(edge.svgId, this.getTranslation(mousePosition));
            return;
        }
        // get edge element
        const edgeNode: SVGGraphicsElement | null = this.container.querySelector("[id='" + edge.svgId + "']");
        if (!edgeNode) {
            return;
        }
        if (edgeType == DiagramUtils.EdgeType.THREE_WINDINGS_TRANSFORMER) {
            this.moveThreeWtEdge(edge, edgeNode, mousePosition);
            return;
        }
        // compute moved edge data: polyline points
        const nodeRadius1 = this.getNodeRadius(edge.busNode1 != null ? edge.busNode1 : '-1');
        const edgeStart1 = this.getEdgeStart(edge.busNode1, nodeRadius1[1], edgeNodes[0], edgeNodes[1]);
        const nodeRadius2 = this.getNodeRadius(edge.busNode2 != null ? edge.busNode2 : '-1');
        const edgeStart2 = this.getEdgeStart(edge.busNode2, nodeRadius2[1], edgeNodes[1], edgeNodes[0]);
        const edgeMiddle = DiagramUtils.getMidPosition(edgeStart1, edgeStart2);
        // move edge
        this.moveEdge(edgeNode, edgeStart1, null, edgeStart2, null, edgeMiddle, nodeRadius1, nodeRadius2, edgeType);
        // if dangling line edge -> redraw boundary node
        if (edgeType == DiagramUtils.EdgeType.DANGLING_LINE) {
            this.redrawBoundaryNode(edgeNodes[1], DiagramUtils.getAngle(edgeStart2, edgeMiddle), nodeRadius2[1]);
            if (this.draggedElement?.id == edgeNodes[1]?.id) {
                // if boundary node moved -> redraw other voltage level node
                this.redrawOtherVoltageLevelNode(edgeNodes[0], [edge]);
            }
        } else {
            // redraw other voltage level node
            const otherNode: SVGGraphicsElement | null = this.getOtherNode(edgeNodes);
            this.redrawOtherVoltageLevelNode(otherNode, [edge]);
        }
    }

    private getEdgeStart(
        busNodeId: string | null,
        outerRadius: number,
        point1: SVGGraphicsElement | null,
        point2: SVGGraphicsElement | null
    ): Point {
        const unknownBusNode = busNodeId != null && busNodeId.length == 0;
        return DiagramUtils.getPointAtDistance(
            DiagramUtils.getPosition(point1),
            DiagramUtils.getPosition(point2),
            unknownBusNode ? outerRadius + this.svgParameters.getUnknownBusNodeExtraRadius() : outerRadius
        );
    }

    private moveEdge(
        edgeNode: SVGGraphicsElement,
        edgeStart1: Point,
        edgeFork1: Point | null, // if null -> straight line
        edgeStart2: Point,
        edgeFork2: Point | null, // if null -> straight line
        edgeMiddle: Point,
        nodeRadius1: [number, number, number],
        nodeRadius2: [number, number, number],
        edgeType: DiagramUtils.EdgeType
    ) {
        const isTransformerEdge =
            edgeType == DiagramUtils.EdgeType.TWO_WINDINGS_TRANSFORMER ||
            edgeType == DiagramUtils.EdgeType.PHASE_SHIFT_TRANSFORMER;
        const isHVDCLineEdge = edgeType == DiagramUtils.EdgeType.HVDC_LINE;
        this.moveHalfEdge(edgeNode, '1', edgeStart1, edgeFork1, edgeMiddle, isTransformerEdge, nodeRadius1);
        this.moveHalfEdge(edgeNode, '2', edgeStart2, edgeFork2, edgeMiddle, isTransformerEdge, nodeRadius2);
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
        // if present, move edge name
        if (this.svgParameters.getEdgeNameDisplayed()) {
            this.moveEdgeName(edgeNode, edgeMiddle, edgeFork1 == null ? edgeStart1 : edgeFork1);
        }
        // store edge angles, to use them for bus node redrawing
        this.edgeAngles.set(
            edgeNode.id + '.1',
            DiagramUtils.getAngle(edgeStart1, edgeFork1 == null ? edgeMiddle : edgeFork1)
        );
        this.edgeAngles.set(
            edgeNode.id + '.2',
            DiagramUtils.getAngle(edgeStart2, edgeFork2 == null ? edgeMiddle : edgeFork2)
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
        const halfEdge: SVGGraphicsElement | null = edgeNode.querySelector("[id='" + edgeNode.id + '.' + side + "']");
        // move edge polyline
        const polyline: SVGGraphicsElement | null | undefined = halfEdge?.querySelector('polyline');
        // if transformer edge reduce edge polyline, leaving space for the transformer
        endPolyline = transformerEdge
            ? DiagramUtils.getPointAtDistance(
                  endPolyline,
                  middlePolyline == null ? startPolyline : middlePolyline,
                  1.5 * this.svgParameters.getTransformerCircleRadius()
              )
            : endPolyline;
        const polylinePoints: string = DiagramUtils.getFormattedPolyline(startPolyline, middlePolyline, endPolyline);
        polyline?.setAttribute('points', polylinePoints);
        // move edge arrow and label
        if (halfEdge != null && halfEdge.children.length > 1) {
            this.moveEdgeArrowAndLabel(halfEdge, startPolyline, middlePolyline, endPolyline, nodeRadius);
        }
    }

    private moveEdgeArrowAndLabel(
        edgeNode: SVGGraphicsElement,
        startPolyline: Point,
        middlePolyline: Point | null, // if null -> straight line
        endPolyline: Point,
        nodeRadius: [number, number, number]
    ) {
        // move edge arrow
        const arrowCenter = DiagramUtils.getPointAtDistance(
            middlePolyline == null ? startPolyline : middlePolyline,
            endPolyline,
            middlePolyline == null
                ? this.svgParameters.getArrowShift() + (nodeRadius[2] - nodeRadius[1])
                : this.svgParameters.getArrowShift()
        );
        const arrowElement = edgeNode.lastElementChild as SVGGraphicsElement;
        arrowElement?.setAttribute('transform', 'translate(' + DiagramUtils.getFormattedPoint(arrowCenter) + ')');
        const arrowAngle = DiagramUtils.getArrowAngle(
            middlePolyline == null ? startPolyline : middlePolyline,
            endPolyline
        );
        const arrowRotationElement = arrowElement.firstElementChild?.firstElementChild as SVGGraphicsElement;
        arrowRotationElement.setAttribute('transform', 'rotate(' + DiagramUtils.getFormattedValue(arrowAngle) + ')');
        // move edge label
        const labelData = DiagramUtils.getLabelData(
            middlePolyline == null ? startPolyline : middlePolyline,
            endPolyline,
            this.svgParameters.getArrowLabelShift()
        );
        const labelRotationElement = arrowElement.firstElementChild?.lastElementChild as SVGGraphicsElement;
        labelRotationElement.setAttribute('transform', 'rotate(' + DiagramUtils.getFormattedValue(labelData[0]) + ')');
        labelRotationElement.setAttribute('x', DiagramUtils.getFormattedValue(labelData[1]));
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
        const transformerElement: SVGGraphicsElement = edgeNode.lastElementChild as SVGGraphicsElement;
        // move transformer circles
        const transformerCircles: NodeListOf<SVGGraphicsElement> = transformerElement?.querySelectorAll('circle');
        this.moveTransformerCircle(
            transformerCircles.item(0),
            startPolyline1,
            DiagramUtils.getPointAtDistance(
                endPolyline1,
                startPolyline1,
                1.5 * this.svgParameters.getTransformerCircleRadius()
            )
        );
        this.moveTransformerCircle(
            transformerCircles.item(1),
            startPolyline2,
            DiagramUtils.getPointAtDistance(
                endPolyline2,
                startPolyline2,
                1.5 * this.svgParameters.getTransformerCircleRadius()
            )
        );
        // if phase shifting transformer move transformer arrow
        const isPSTransformerEdge = edgeType == DiagramUtils.EdgeType.PHASE_SHIFT_TRANSFORMER;
        if (isPSTransformerEdge) {
            this.moveTransformerArrow(
                transformerElement,
                startPolyline1,
                endPolyline1,
                DiagramUtils.getMidPosition(endPolyline1, endPolyline2)
            );
        }
    }

    private moveTransformerCircle(transformerCircle: SVGGraphicsElement, startPolyline: Point, endPolyline: Point) {
        const circleCenter: Point = DiagramUtils.getPointAtDistance(
            endPolyline,
            startPolyline,
            -this.svgParameters.getTransformerCircleRadius()
        );
        transformerCircle.setAttribute('cx', DiagramUtils.getFormattedValue(circleCenter.x));
        transformerCircle.setAttribute('cy', DiagramUtils.getFormattedValue(circleCenter.y));
    }

    private moveTransformerArrow(
        transformerElement: SVGGraphicsElement,
        startPolyline: Point,
        endPolyline: Point,
        transformerCenter: Point
    ) {
        const arrowPath: SVGGraphicsElement | null = transformerElement.querySelector('path');
        const matrix: string = DiagramUtils.getTransformerArrowMatrixString(
            startPolyline,
            endPolyline,
            transformerCenter,
            this.svgParameters.getTransformerCircleRadius()
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
        const converterStationElement: SVGGraphicsElement = edgeNode.lastElementChild as SVGGraphicsElement;
        const polylinePoints: string = DiagramUtils.getConverterStationPolyline(
            startPolyline1,
            endPolyline1,
            startPolyline2,
            endPolyline2,
            this.svgParameters.getConverterStationWidth()
        );
        const polyline: SVGGraphicsElement | null = converterStationElement.querySelector('polyline');
        polyline?.setAttribute('points', polylinePoints);
    }

    private moveLoopEdgeGroup(edges: EdgeMetadata[], mousePosition: Point) {
        edges.forEach((edge) => {
            // get edge element
            if (!edge.svgId) {
                return;
            }
            this.moveSvgElement(edge.svgId, this.getTranslation(mousePosition));
        });
    }

    private moveEdgeName(edgeNode: SVGGraphicsElement, anchorPoint: Point, edgeStart: Point) {
        const positionElement: SVGGraphicsElement | null = edgeNode.querySelector(
            '.nad-edge-label'
        ) as SVGGraphicsElement;
        if (positionElement != null) {
            // move edge name position
            positionElement.setAttribute('transform', 'translate(' + DiagramUtils.getFormattedPoint(anchorPoint) + ')');
            const angleElement: SVGGraphicsElement | null = positionElement.querySelector('text') as SVGGraphicsElement;
            if (angleElement != null) {
                // change edge name angle
                const edgeNameAngle = DiagramUtils.getEdgeNameAngle(edgeStart, anchorPoint);
                angleElement.setAttribute('transform', 'rotate(' + DiagramUtils.getFormattedValue(edgeNameAngle) + ')');
            }
        }
    }

    private redrawVoltageLevelNode(
        node: SVGGraphicsElement | null,
        busNodeEdges: Map<string, EdgeMetadata[]>,
        movedEdges: EdgeMetadata[] | null // list of moved edges, null = all edges
    ) {
        if (node != null) {
            // get buses belonging to voltage level
            const busNodes: BusNodeMetadata[] | undefined = this.diagramMetadata?.busNodes.filter(
                (busNode) => busNode.vlNode == node.id
            );
            // if single bus voltage level -> do not redraw anything
            if (busNodes !== undefined && busNodes.length <= 1) {
                return;
            }
            // sort buses by index
            const sortedBusNodes: BusNodeMetadata[] = DiagramUtils.getSortedBusNodes(busNodes);
            const traversingBusEdgesAngles: number[] = [];
            let redraw = false;
            for (let index = 0; index < sortedBusNodes.length; index++) {
                const busNode = sortedBusNodes[index];
                // skip redrawing of first bus
                if (index > 0 && redraw) {
                    this.redrawBusNode(node, busNode, index, traversingBusEdgesAngles);
                }
                // add angles of edges starting from bus to traversing edges angles
                const busEdges = busNodeEdges.get(busNode.svgId) ?? [];
                busEdges.forEach((edge) => {
                    const edgeAngle = this.getEdgeAngle(busNode, edge, edge.svgId, edge.node1 == edge.node2);
                    if (typeof edgeAngle !== 'undefined') {
                        traversingBusEdgesAngles.push(edgeAngle);
                    }
                    // redraw only if there is an edge going to another voltage level
                    if (edge.node1 != edge.node2) {
                        // redraw only if the edge has been moved
                        if (movedEdges != null) {
                            movedEdges.forEach((movedEdge) => {
                                if (edge.svgId == movedEdge.svgId) {
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

    private getEdgeAngle(busNode: BusNodeMetadata, edge: EdgeMetadata, edgeId: string, isLoopEdge: boolean) {
        const angleId = busNode.svgId == edge.busNode1 ? edgeId + '.1' : edgeId + '.2';
        if (!this.edgeAngles.has(angleId)) {
            // if not yet stored in angle map -> compute and store it
            const edgeNode: SVGGraphicsElement | null = this.container.querySelector("[id='" + edgeId + "']");
            if (edgeNode) {
                const side = busNode.svgId == edge.busNode1 ? 0 : 1;
                const halfEdge: HTMLElement = <HTMLElement>edgeNode.children.item(side)?.firstElementChild;
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
        busNode: BusNodeMetadata,
        busIndex: number,
        traversingBusEdgesAngles: number[]
    ) {
        const busNodeRadius = DiagramUtils.getNodeRadius(
            busNode.nbNeighbours == null ? 0 : busNode.nbNeighbours,
            this.svgParameters.getVoltageLevelCircleRadius(),
            busIndex,
            this.svgParameters.getInterAnnulusSpace()
        );
        const edgeAngles = Object.assign(
            [],
            traversingBusEdgesAngles.sort(function (a, b) {
                return a - b;
            })
        );
        edgeAngles.push(edgeAngles[0] + 2 * Math.PI);
        const path: string = DiagramUtils.getFragmentedAnnulusPath(
            edgeAngles,
            busNodeRadius,
            this.svgParameters.getNodeHollowWidth()
        );
        const busElement: HTMLElement | null = <HTMLElement>node.children.item(busIndex);
        if (busElement != null) {
            busElement.setAttribute('d', path);
        }
    }

    private redrawOtherVoltageLevelNode(otherNode: SVGGraphicsElement | null, movedEdges: EdgeMetadata[]) {
        if (otherNode != null) {
            // get other voltage level node edges
            const edges: EdgeMetadata[] | undefined = this.diagramMetadata?.edges.filter(
                (edge) => edge.node1 == (otherNode?.id ?? -1) || edge.node2 == (otherNode?.id ?? -1)
            );
            // group other voltage level node edges by bus node
            const busNodeEdges: Map<string, EdgeMetadata[]> = new Map<string, EdgeMetadata[]>();
            edges?.forEach((edge) => {
                if (edge.node1 == edge.node2) {
                    // loop edge
                    this.addBusNodeEdge(edge.busNode1, edge, busNodeEdges);
                    this.addBusNodeEdge(edge.busNode2, edge, busNodeEdges);
                } else {
                    const busNodeId = edge.node1 == otherNode?.id ? edge.busNode1 : edge.busNode2;
                    this.addBusNodeEdge(busNodeId, edge, busNodeEdges);
                }
            });
            // redraw other voltage level node
            this.redrawVoltageLevelNode(otherNode, busNodeEdges, movedEdges);
        }
    }

    private moveThreeWtEdge(edge: EdgeMetadata, edgeNode: SVGGraphicsElement, mousePosition: Point) {
        const twtEdge: HTMLElement = <HTMLElement>edgeNode.firstElementChild;
        if (twtEdge != null) {
            const points = DiagramUtils.getPolylinePoints(twtEdge);
            if (points != null) {
                // compute polyline points
                const edgeNodes = this.getEdgeNodes(edge);
                const threeWtMoved = edgeNodes[1]?.id == this.draggedElement?.id;
                const nodeRadius1 = this.getNodeRadius(edge.busNode1 != null ? edge.busNode1 : '-1');
                const edgeStart = this.getEdgeStart(edge.busNode1, nodeRadius1[1], edgeNodes[0], edgeNodes[1]);
                const translation = this.getTranslation(mousePosition);
                const edgeEnd = threeWtMoved
                    ? new Point(
                          points[points.length - 1].x + translation.x,
                          points[points.length - 1].y + translation.y
                      )
                    : points[points.length - 1];
                // move polyline
                const polylinePoints: string = DiagramUtils.getFormattedPolyline(edgeStart, null, edgeEnd);
                twtEdge.setAttribute('points', polylinePoints);
                // move edge arrow and label
                if (edgeNode.children.length > 1) {
                    this.moveEdgeArrowAndLabel(edgeNode, edgeStart, null, edgeEnd, nodeRadius1);
                }
                // store edge angles, to use them for bus node redrawing
                this.edgeAngles.set(edgeNode.id + '.1', DiagramUtils.getAngle(edgeStart, edgeEnd));
                // redraw voltage level node connected to three windings transformer
                if (threeWtMoved) {
                    this.redrawOtherVoltageLevelNode(edgeNodes[0], [edge]);
                }
            }
        }
    }

    private redrawBoundaryNode(node: SVGGraphicsElement | null, edgeStartAngle: number, busOuterRadius: number) {
        if (node != null) {
            const path: string = DiagramUtils.getBoundarySemicircle(edgeStartAngle, busOuterRadius);
            const pathElement: HTMLElement | null = <HTMLElement>node.firstElementChild;
            if (pathElement != null && pathElement.tagName == 'path') {
                pathElement.setAttribute('d', path);
            }
        }
    }

    private updateNodeMetadataCallCallback(mousePosition: Point, callMoveNodeCallback: boolean) {
        // get moved node from metadata
        const node: NodeMetadata | undefined = this.diagramMetadata?.nodes.find(
            (node) => node.svgId == this.draggedElement?.id
        );
        if (node != null) {
            const nodeMove = DiagramUtils.getNodeMove(node, mousePosition);
            // update node position in metadata
            node.x = nodeMove.xNew;
            node.y = nodeMove.yNew;
            // call the node move callback, if defined
            if (this.onMoveNodeCallback != null && callMoveNodeCallback) {
                this.onMoveNodeCallback(
                    node.equipmentId,
                    node.svgId,
                    nodeMove.xNew,
                    nodeMove.yNew,
                    nodeMove.xOrig,
                    nodeMove.yOrig
                );
            }
        }
    }

    private updateTextNodeMetadataCallCallback(mousePosition: Point) {
        if (this.onMoveTextNodeCallback != null) {
            // get from metadata node connected to moved text node
            const node: NodeMetadata | undefined = this.diagramMetadata?.nodes.find(
                (node) => node.svgId == DiagramUtils.getVoltageLevelNodeId(this.draggedElement?.id)
            );
            const textNode: TextNodeMetadata | undefined = this.diagramMetadata?.textNodes.find(
                (textNode) => textNode.svgId == this.draggedElement?.id
            );
            if (node != null && textNode != null) {
                // get new text node position
                const textPosition = DiagramUtils.getTextNodeAngleFromCentre(this.draggedElement, mousePosition);
                const textNodeMoves = DiagramUtils.getTextNodeMoves(textNode, node, textPosition, this.endTextEdge);
                // update text node position in metadata
                textNode.shiftX = textNodeMoves[0].xNew;
                textNode.shiftY = textNodeMoves[0].yNew;
                textNode.connectionShiftX = textNodeMoves[1].xNew;
                textNode.connectionShiftY = textNodeMoves[1].yNew;
                // call the node move callback, if defined
                this.onMoveTextNodeCallback(
                    node.equipmentId,
                    node.svgId,
                    textNode.svgId,
                    textNodeMoves[0].xNew,
                    textNodeMoves[0].yNew,
                    textNodeMoves[0].xOrig,
                    textNodeMoves[0].yOrig,
                    textNodeMoves[1].xNew,
                    textNodeMoves[1].yNew,
                    textNodeMoves[1].xOrig,
                    textNodeMoves[1].yOrig
                );
            }
        }
    }

    private callSelectNodeCallback() {
        // call the select node callback, if defined
        if (this.onSelectNodeCallback != null) {
            // get selected node from metadata
            const node: NodeMetadata | undefined = this.diagramMetadata?.nodes.find(
                (node) => node.svgId == this.selectedElement?.id
            );
            if (node != null) {
                this.onSelectNodeCallback(node.equipmentId, node.svgId);
            }
        }
    }

    // Will explore the SVG's <style> tags to find the css rule associated with "cssSelector" and update the
    // rule using "cssDeclaration".
    // Will create a style tag or/and new css rule if not found in the SVG.
    public updateSvgCssDisplayValue(svg: SVGSVGElement, cssSelector: string, cssDeclaration: CSS_DECLARATION) {
        const innerSvg = svg.querySelector('svg');
        if (!innerSvg) {
            console.error('Cannot find the SVG to update!');
            return;
        }

        let ruleFound = false;

        let svgStyles = innerSvg.querySelectorAll('style');

        if (svgStyles) {
            for (const svgStyle of svgStyles) {
                if (!svgStyle?.sheet?.cssRules) {
                    continue;
                }
                for (const rule of svgStyle.sheet.cssRules) {
                    const styleRule = rule as CSSStyleRule;
                    if (styleRule.selectorText === cssSelector) {
                        const key = Object.keys(cssDeclaration)[0];
                        const value = cssDeclaration[key];
                        styleRule.style.setProperty(key, value);
                        ruleFound = true;
                        break;
                    }
                }
                if (ruleFound) {
                    break;
                }
            }
        } else {
            innerSvg.appendChild(document.createElement('style'));
            console.debug('[updateSvgCssDisplayValue] Style tag missing from SVG file. It has been created.');
            svgStyles = innerSvg.querySelectorAll('style');
            if (!svgStyles) {
                console.error('Failed to create a style tag in the SVG!');
                return;
            }
        }

        if (!ruleFound) {
            const key = Object.keys(cssDeclaration)[0];
            const value = cssDeclaration[key];
            const styleTag = svgStyles[svgStyles.length - 1]; // Adds the new rule to the last <style> tag in the SVG
            styleTag.textContent = `${cssSelector} {${key}: ${value};}\n` + styleTag.textContent;
        }
    }

    public initializeDynamicCssRules(maxDisplayedSize: number) {
        this.getDynamicCssRules().forEach((rule) => {
            if (isThresholdDrivenRule(rule)) {
                rule.thresholdStatus =
                    maxDisplayedSize < rule.threshold ? THRESHOLD_STATUS.BELOW : THRESHOLD_STATUS.ABOVE;
            }
            if (isFunctionDrivenRule(rule)) {
                for (const [property, callbackFunction] of Object.entries(rule.cssDeclaration)) {
                    rule.currentValue[property] = callbackFunction(maxDisplayedSize);
                }
            }
        });
    }

    private getRuleToInject(rule: CSS_RULE) {
        if (isFunctionDrivenRule(rule)) {
            return rule.currentValue;
        }
        return rule.thresholdStatus === THRESHOLD_STATUS.BELOW
            ? rule.belowThresholdCssDeclaration
            : rule.aboveThresholdCssDeclaration;
    }

    public injectDynamicCssRules(htmlElementSvg: HTMLElement) {
        const rules = this.getDynamicCssRules()
            .map((rule) => {
                const ruleToInject = this.getRuleToInject(rule);
                const [key, value] = Object.entries(ruleToInject)[0];
                return `${rule.cssSelector} {${key}: ${value};}`;
            })
            .join('\n');

        let styleTag = htmlElementSvg.querySelector('style');
        if (!styleTag) {
            htmlElementSvg.appendChild(document.createElement('style'));
            console.debug('[injectDynamicCssRules] Style tag missing from SVG file. It has been created.');
            styleTag = htmlElementSvg.querySelector('style');
        }
        if (styleTag && 'textContent' in styleTag) {
            styleTag.textContent = rules + styleTag.textContent;
        } else {
            console.error('Failed to create Style tag in SVG file!');
        }
    }

    public getCurrentlyMaxDisplayedSize(): number {
        const viewbox = this.getViewBox();
        return Math.max(viewbox?.height || 0, viewbox?.width || 0);
    }

    public checkAndUpdateLevelOfDetail(svg: SVGSVGElement) {
        const maxDisplayedSize = this.getCurrentlyMaxDisplayedSize();
        // We will check each dynamic css rule to see if we crossed a zoom threshold. If this is the case, we
        // update the rule's threshold status and trigger the CSS change in the SVG.
        this.getDynamicCssRules().forEach((rule) => {
            if (isThresholdDrivenRule(rule)) {
                if (rule.thresholdStatus === THRESHOLD_STATUS.ABOVE && maxDisplayedSize < rule.threshold) {
                    rule.thresholdStatus = THRESHOLD_STATUS.BELOW;
                    this.updateSvgCssDisplayValue(svg, rule.cssSelector, rule.belowThresholdCssDeclaration);
                } else if (rule.thresholdStatus === THRESHOLD_STATUS.BELOW && maxDisplayedSize >= rule.threshold) {
                    rule.thresholdStatus = THRESHOLD_STATUS.ABOVE;
                    this.updateSvgCssDisplayValue(svg, rule.cssSelector, rule.aboveThresholdCssDeclaration);
                }
            }
            if (isFunctionDrivenRule(rule)) {
                for (const [property, callbackFunction] of Object.entries(rule.cssDeclaration)) {
                    const valueToUpdate = callbackFunction(maxDisplayedSize);
                    if (valueToUpdate !== rule.currentValue[property]) {
                        rule.currentValue[property] = valueToUpdate;
                        this.updateSvgCssDisplayValue(svg, rule.cssSelector, rule.currentValue);
                    }
                }
            }
        });
    }
}
