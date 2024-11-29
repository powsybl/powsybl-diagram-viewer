/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 */

import * as DiagramUtils from './diagram-utils';
//import * as TestUtils from './test-utils.test';
import { EdgeMetadata, BusNodeMetadata, NodeMetadata, TextNodeMetadata } from './diagram-metadata';
import { SVG, Point } from '@svgdotjs/svg.js';

test('getFormattedValue', () => {
    expect(DiagramUtils.getFormattedValue(12)).toBe('12.00');
    expect(DiagramUtils.getFormattedValue(7.417)).toBe('7.42');
    expect(DiagramUtils.getFormattedValue(145.9532834)).toBe('145.95');
});

test('getFormattedPoint', () => {
    expect(DiagramUtils.getFormattedPoint(new Point(144, 34.836))).toBe('144.00,34.84');
});

test('getFormattedPolyline', () => {
    expect(DiagramUtils.getFormattedPolyline(new Point(144, 34.836), null, new Point(213.892, 74))).toBe(
        '144.00,34.84 213.89,74.00'
    );
    expect(
        DiagramUtils.getFormattedPolyline(new Point(144, 34.836), new Point(192.83, 55.1475), new Point(213.892, 74))
    ).toBe('144.00,34.84 192.83,55.15 213.89,74.00');
});

test('degToRad', () => {
    expect(DiagramUtils.degToRad(60)).toBe(1.0471975511965976);
});

test('radToDeg', () => {
    expect(DiagramUtils.radToDeg(1.0471975511965976)).toBeCloseTo(60, 3);
});

test('round', () => {
    expect(DiagramUtils.round(147.672)).toBe(147.67);
    expect(DiagramUtils.round(8.7)).toBe(8.7);
    expect(DiagramUtils.round(19.2894)).toBe(19.29);
    expect(DiagramUtils.round(643)).toBe(643);
});

test('getMidPosition', () => {
    const midPoint = DiagramUtils.getMidPosition(new Point(10.46, 5.818), new Point(45.24, 90.122));
    expect(midPoint.x).toBe(27.85);
    expect(midPoint.y).toBe(47.97);
});

test('getPointAtDistance', () => {
    const pointAtDistance = DiagramUtils.getPointAtDistance(new Point(10, 10), new Point(36, 48), 30);
    expect(pointAtDistance.x).toBeCloseTo(26.94, 2);
    expect(pointAtDistance.y).toBeCloseTo(34.76, 2);
});

test('getAngle', () => {
    expect(DiagramUtils.getAngle(new Point(10, 10), new Point(50, 50))).toBe(0.7853981633974483);
    expect(DiagramUtils.getAngle(new Point(10, 10), new Point(10, 50))).toBe(1.5707963267948966);
    expect(DiagramUtils.getAngle(new Point(10, 10), new Point(50, 10))).toBe(0);
    expect(DiagramUtils.getAngle(new Point(50, 50), new Point(10, 10))).toBe(-2.356194490192345);
});

test('getArrowAngle', () => {
    expect(DiagramUtils.getArrowAngle(new Point(10, 10), new Point(50, 50))).toBe(135);
    expect(DiagramUtils.getArrowAngle(new Point(10, 10), new Point(10, 50))).toBe(180);
    expect(DiagramUtils.getArrowAngle(new Point(10, 10), new Point(50, 10))).toBe(90);
    expect(DiagramUtils.getArrowAngle(new Point(50, 50), new Point(10, 10))).toBe(-45);
});

test('getLabelData', () => {
    const labelData = DiagramUtils.getLabelData(new Point(10, 10), new Point(50, 50), 19);
    expect(labelData[0]).toBe(45);
    expect(labelData[1]).toBe(19);
    expect(labelData[2]).toBeNull();
    const flippedLabelData = DiagramUtils.getLabelData(new Point(10, 10), new Point(-30, 50), 19);
    expect(flippedLabelData[0]).toBe(-45);
    expect(flippedLabelData[1]).toBe(-19);
    expect(flippedLabelData[2]).toBe('text-anchor:end');
});

test('getEdgeFork', () => {
    const edgeFork = DiagramUtils.getEdgeFork(new Point(10, 10), 80, 0.2618);
    expect(edgeFork.x).toBeCloseTo(87.274, 3);
    expect(edgeFork.y).toBeCloseTo(30.7055, 3);
});

test('getEdgeType', () => {
    const edge: EdgeMetadata = {
        svgId: '8',
        equipmentId: 'NGEN_NHV1',
        node1: '0',
        node2: '2',
        busNode1: '1',
        busNode2: '3',
        type: 'TwoWtEdge',
    };
    expect(DiagramUtils.getEdgeType(edge)).toBe(DiagramUtils.EdgeType.TWO_WINDINGS_TRANSFORMER);
    expect(DiagramUtils.getStringEdgeType(edge)).toBe('TWO_WINDINGS_TRANSFORMER');
});

test('getTransformerArrowMatrixString', () => {
    expect(
        DiagramUtils.getTransformerArrowMatrixString(new Point(10, 10), new Point(110, 110), new Point(60, 60), 20)
    ).toBe('0.71,0.71,-0.71,0.71,60.00,17.57');
});

test('getConverterStationPolyline', () => {
    expect(
        DiagramUtils.getConverterStationPolyline(
            new Point(10, 10),
            new Point(110, 110),
            new Point(210, 210),
            new Point(60, 60),
            70
        )
    ).toBe('85.25,85.25 84.75,84.75');
});

test('getDraggableFrom', () => {
    let draggagleElement = DiagramUtils.getDraggableFrom(getSvgNode());
    expect(draggagleElement).not.toBeUndefined();
    draggagleElement = DiagramUtils.getDraggableFrom(getSvgTextNode());
    expect(draggagleElement).not.toBeUndefined();
    draggagleElement = DiagramUtils.getDraggableFrom(getSvgLoopEdge());
    expect(draggagleElement).toBeUndefined();
});

test('getSelectableFrom', () => {
    let selectableElement = DiagramUtils.getSelectableFrom(getSvgNode());
    expect(selectableElement).not.toBeUndefined();
    selectableElement = DiagramUtils.getSelectableFrom(getSvgTextNode());
    expect(selectableElement).toBeUndefined();
    selectableElement = DiagramUtils.getSelectableFrom(getSvgLoopEdge());
    expect(selectableElement).toBeUndefined();
});

test('getVoltageLevelCircleRadius', () => {
    expect(DiagramUtils.getVoltageLevelCircleRadius(0, 30)).toBe(30);
    expect(DiagramUtils.getVoltageLevelCircleRadius(1, 30)).toBe(60);
    expect(DiagramUtils.getVoltageLevelCircleRadius(2, 30)).toBe(60);
});

test('getNodeRadius', () => {
    let nodeRadius = DiagramUtils.getNodeRadius(0, 30, 0, 5);
    expect(nodeRadius[0]).toBe(0);
    expect(nodeRadius[1]).toBe(27.5);
    expect(nodeRadius[2]).toBe(30);
    nodeRadius = DiagramUtils.getNodeRadius(1, 30, 0, 5);
    expect(nodeRadius[0]).toBe(0);
    expect(nodeRadius[1]).toBe(27.5);
    expect(nodeRadius[2]).toBe(60);
    nodeRadius = DiagramUtils.getNodeRadius(1, 30, 1, 5);
    expect(nodeRadius[0]).toBe(32.5);
    expect(nodeRadius[1]).toBe(57.5);
    expect(nodeRadius[2]).toBe(60);
    nodeRadius = DiagramUtils.getNodeRadius(2, 30, 0, 5);
    expect(nodeRadius[0]).toBe(0);
    expect(nodeRadius[1]).toBe(17.5);
    expect(nodeRadius[2]).toBe(60);
    nodeRadius = DiagramUtils.getNodeRadius(2, 30, 1, 5);
    expect(nodeRadius[0]).toBe(22.5);
    expect(nodeRadius[1]).toBe(37.5);
    expect(nodeRadius[2]).toBe(60);
    nodeRadius = DiagramUtils.getNodeRadius(2, 30, 2, 5);
    expect(nodeRadius[0]).toBe(42.5);
    expect(nodeRadius[1]).toBe(57.5);
    expect(nodeRadius[2]).toBe(60);
});

test('getFragmentedAnnulusPath', () => {
    expect(DiagramUtils.getFragmentedAnnulusPath([-2.38, 0.75, 1.4], [42.5, 57.5, 60], 15)).toBe(
        'M-36.101,-44.755 A57.500,57.500 164.389 0 1 46.813,33.389 L35.700,23.061 A42.500,42.500 -159.114 0 0 -25.132,-34.273 Z M36.617,44.333 A57.500,57.500 22.296 0 1 17.060,54.911 L14.464,39.963 A42.500,42.500 -17.020 0 0 25.528,33.979 Z '
    );
});

test('getPolylinePoints', () => {
    const points = DiagramUtils.getPolylinePoints(getSvgPolyline());
    expect(points?.length).toBe(2);
    expect(points?.at(0)?.x).toBe(173.73);
    expect(points?.at(0)?.y).toBe(100.97);
    expect(points?.at(1)?.x).toBe(-8.21);
    expect(points?.at(1)?.y).toBe(-210.51);
});

test('getPolylineAngle', () => {
    const angle = DiagramUtils.radToDeg(DiagramUtils.getPolylineAngle(getSvgPolyline()) ?? 0);
    expect(angle).toBeCloseTo(-120, 0);
});

test('getPathAngle', () => {
    const angle = DiagramUtils.radToDeg(DiagramUtils.getPathAngle(getSvgPath()) ?? 0);
    expect(angle).toBeCloseTo(-51, 0);
});

test('getSortedBusNodes', () => {
    const bus1: BusNodeMetadata = {
        svgId: '4',
        equipmentId: 'VL2_0',
        nbNeighbours: 2,
        index: 0,
        vlNode: '3',
    };
    const bus2: BusNodeMetadata = {
        svgId: '5',
        equipmentId: 'VL2_1',
        nbNeighbours: 2,
        index: 1,
        vlNode: '3',
    };
    const bus3: BusNodeMetadata = {
        svgId: '6',
        equipmentId: 'VL2_2',
        nbNeighbours: 2,
        index: 2,
        vlNode: '3',
    };
    let sorteBus: BusNodeMetadata[] = DiagramUtils.getSortedBusNodes([bus1, bus3, bus2]);
    expect(sorteBus[0].index).toBe(0);
    expect(sorteBus[1].index).toBe(1);
    expect(sorteBus[2].index).toBe(2);
    sorteBus = DiagramUtils.getSortedBusNodes([bus2, bus3, bus1]);
    expect(sorteBus[0].index).toBe(0);
    expect(sorteBus[1].index).toBe(1);
    expect(sorteBus[2].index).toBe(2);
});

test('getBoundarySemicircle', () => {
    expect(DiagramUtils.getBoundarySemicircle(1.0471975511965976, 60)).toBe(
        'M51.962,-30.000 A60.000,60.000 180.000 0 1 -51.962,30.000'
    );
});

test('getEdgeNameAngle', () => {
    expect(DiagramUtils.getEdgeNameAngle(new Point(60, 60), new Point(110, 110))).toBe(45);
    expect(DiagramUtils.getEdgeNameAngle(new Point(60, 60), new Point(10, 110))).toBe(-45);
});

test('isTextNode', () => {
    const isTextNode = DiagramUtils.isTextNode(getSvgTextNode());
    expect(isTextNode).toBe(true);
});

test('getTextNodeId', () => {
    expect(DiagramUtils.getTextNodeId('1')).toBe('1-textnode');
});

test('getTextEdgeId', () => {
    expect(DiagramUtils.getTextEdgeId('1')).toBe('1-textedge');
});

test('getVoltageLevelNodeId', () => {
    expect(DiagramUtils.getVoltageLevelNodeId('1-textnode')).toBe('1');
});

test('getTextEdgeEnd', () => {
    let textEdgeEnd = DiagramUtils.getTextEdgeEnd(new Point(110, 110), new Point(60, 60), 25, 50, 80);
    expect(textEdgeEnd.x).toBe(110);
    expect(textEdgeEnd.y).toBe(135);
    textEdgeEnd = DiagramUtils.getTextEdgeEnd(new Point(110, 10), new Point(60, 60), 25, 50, 80);
    expect(textEdgeEnd.x).toBe(110);
    expect(textEdgeEnd.y).toBe(35);
    textEdgeEnd = DiagramUtils.getTextEdgeEnd(new Point(10, 10), new Point(60, 60), 25, 50, 80);
    expect(textEdgeEnd.x).toBe(35);
    expect(textEdgeEnd.y).toBe(60);
    textEdgeEnd = DiagramUtils.getTextEdgeEnd(new Point(10, 110), new Point(60, 60), 25, 50, 80);
    expect(textEdgeEnd.x).toBe(35);
    expect(textEdgeEnd.y).toBe(110);
});

test('getTextNodeAngleFromCentre', () => {
    // not so useful test: in the test scrollWidth and scrollHeight of the div element
    // inside the foreignObject are not correctly detected, they are always 0,
    // so the input position is not moved to the text box angle
    const textNodeAngle = DiagramUtils.getTextNodeAngleFromCentre(getSvgTextNode(), new Point(240, -310));
    expect(textNodeAngle.x).toBe(240);
    expect(textNodeAngle.y).toBe(-310);
});

test('getTextNodeTranslatedPosition', () => {
    const textNodePosition = DiagramUtils.getTextNodeTranslatedPosition(getSvgTextNode(), new Point(10, 10));
    expect(textNodePosition.x).toBe(-342.59);
    expect(textNodePosition.y).toBe(-304.01);
});

test('getTextNodePosition', () => {
    const textNodePosition = DiagramUtils.getTextNodePosition(getSvgTextNode());
    expect(textNodePosition.x).toBe(-352.59);
    expect(textNodePosition.y).toBe(-314.01);
});

test('getNodeMove', () => {
    const node: NodeMetadata = {
        svgId: '0',
        equipmentId: 'VLGEN',
        x: -452.59,
        y: -274.01,
    };
    const nodePosition = new Point(-395.1338734, -352.76892014);
    const nodeMove = DiagramUtils.getNodeMove(node, nodePosition);
    expect(nodeMove.xOrig).toBe(-452.59);
    expect(nodeMove.yOrig).toBe(-274.01);
    expect(nodeMove.xNew).toBe(-395.13);
    expect(nodeMove.yNew).toBe(-352.77);
});

test('getHoverableFrom', () => {
    let hoverableElement = DiagramUtils.getHoverableFrom(getSvgNode());
    expect(hoverableElement).toBeUndefined();
    hoverableElement = DiagramUtils.getHoverableFrom(getSvgTextNode());
    expect(hoverableElement).toBeUndefined();
    hoverableElement = DiagramUtils.getHoverableFrom(getSvgLoopEdge());
    expect(hoverableElement).not.toBeUndefined();
});

test('getTextNodeMoves', () => {
    const textNode: TextNodeMetadata = {
        svgId: '0-textnode',
        equipmentId: 'VLGEN',
        vlNode: '0',
        shiftX: 100.0,
        shiftY: -40.0,
        connectionShiftX: 100.0,
        connectionShiftY: -15.0,
    };
    const node: NodeMetadata = {
        svgId: '0',
        equipmentId: 'VLGEN',
        x: -452.59,
        y: -274.01,
    };
    const textPosition = new Point(-295.1338734, -352.76892014);
    const connectionPosition = new Point(-295.1338734, -327.76892014);
    const textNodeMove = DiagramUtils.getTextNodeMoves(textNode, node, textPosition, connectionPosition);
    expect(textNodeMove[0].xOrig).toBe(100);
    expect(textNodeMove[0].yOrig).toBe(-40);
    expect(textNodeMove[0].xNew).toBe(157.46);
    expect(textNodeMove[0].yNew).toBe(-78.76);
    expect(textNodeMove[1].xOrig).toBe(100);
    expect(textNodeMove[1].yOrig).toBe(-15);
    expect(textNodeMove[1].xNew).toBe(157.46);
    expect(textNodeMove[1].yNew).toBe(-53.76);
});

function getSvgNode(): SVGGraphicsElement {
    const nodeSvg =
        '<g class="nad-vl-nodes"><g transform="translate(-452.59,-274.01)" id="0">' +
        '<circle r="27.50" id="1" class="nad-vl0to30-0 nad-busnode"/></g></g>';
    return <SVGGraphicsElement>SVG().svg(nodeSvg).node.firstElementChild?.firstElementChild;
}

function getSvgTextNode(): SVGGraphicsElement {
    const textNodeSvg =
        '<g class="nad-text-nodes">' +
        '<foreignObject id="0-textnode" y="-314.01" x="-352.59" height="1" width="1">' +
        '<div xmlns="http://www.w3.org/1999/xhtml" class="nad-label-box"><div>VLGEN</div>' +
        '<table><tr><td><div class="nad-vl0to30-0 nad-legend-square"/></td>' +
        '<td>24.5 kV / 2.3°</td></tr></table></div></foreignObject></g>';
    return <SVGGraphicsElement>SVG().svg(textNodeSvg).node.firstElementChild?.firstElementChild;
}

function getSvgLoopEdge(): SVGGraphicsElement {
    const edgeSvg =
        '<g class="nad-branch-edges">' +
        '<g id="16" transform="translate(-11.33,-34.94)">' +
        '<g id="16.1" class="nad-vl70to120-line">' +
        '<path class="nad-edge-path" d="M350.33,-167.48 L364.63,-184.85 C390.06,-215.73 412.13,-202.64 415.64,-193.28"/>' +
        '<g class="nad-edge-infos" transform="translate(364.63,-184.85)">' +
        '<g class="nad-active"><g transform="rotate(39.46)"><path class="nad-arrow-in" transform="scale(10.00)" d="M-1 -1 H1 L0 1z"/>' +
        '<path class="nad-arrow-out" transform="scale(10.00)" d="M-1 1 H1 L0 -1z"/></g><text transform="rotate(-50.54)" x="19.00"></text></g></g></g>' +
        '<g id="16.2" class="nad-vl70to120-line">' +
        '<path class="nad-edge-path" d="M340.91,-118.57 L392.70,-109.93 C432.16,-103.36 440.19,-127.73 436.69,-137.09"/>' +
        '<g class="nad-edge-infos" transform="translate(392.70,-109.93)">' +
        '<g class="nad-active"><g transform="rotate(99.46)"><path class="nad-arrow-in" transform="scale(10.00)" d="M-1 -1 H1 L0 1z"/>' +
        '<path class="nad-arrow-out" transform="scale(10.00)" d="M-1 1 H1 L0 -1z"/></g><text transform="rotate(9.46)" x="19.00"></text></g></g></g>' +
        '<g class="nad-glued-center"><circle class="nad-vl70to120-line nad-winding" cx="422.65" cy="-174.55" r="20.00"/>' +
        '<circle class="nad-vl70to120-line nad-winding" cx="429.67" cy="-155.82" r="20.00"/></g></g></g>';
    return <SVGGraphicsElement>SVG().svg(edgeSvg).node.firstElementChild?.firstElementChild;
}

function getSvgPolyline(): HTMLElement {
    const edgeSvg =
        '<g id="8" class="nad-vl300to500-line">' +
        '<polyline class="nad-edge-path nad-stretchable" points="173.73,100.97 -8.21,-210.51"/>' +
        '<g class="nad-glued-1 nad-edge-infos" transform="translate(157.34,72.90)">' +
        '<g class="nad-active"><g transform="rotate(-30.29)">' +
        '<path class="nad-arrow-in" transform="scale(10.00)" d="M-1 -1 H1 L0 1z"/>' +
        '<path class="nad-arrow-out" transform="scale(10.00)" d="M-1 1 H1 L0 -1z"/></g>' +
        '<text transform="rotate(-300.29)" x="-19.00" style="text-anchor:end"></text></g></g></g>';
    return <HTMLElement>SVG().svg(edgeSvg).node.firstElementChild?.firstElementChild;
}

function getSvgPath(): HTMLElement {
    const edgeSvg =
        '<g id="16.1" class="nad-vl70to120-line">' +
        '<path class="nad-edge-path" d="M350.33,-167.48 L364.63,-184.85 C390.06,-215.73 412.13,-202.64 415.64,-193.28"/>' +
        '<g class="nad-edge-infos" transform="translate(364.63,-184.85)"><g class="nad-active">' +
        '<g transform="rotate(39.46)"><path class="nad-arrow-in" transform="scale(10.00)" d="M-1 -1 H1 L0 1z"/>' +
        '<path class="nad-arrow-out" transform="scale(10.00)" d="M-1 1 H1 L0 -1z"/></g>' +
        '<text transform="rotate(-50.54)" x="19.00"></text></g></g></g>';
    return <HTMLElement>SVG().svg(edgeSvg).node.firstElementChild?.firstElementChild;
}
