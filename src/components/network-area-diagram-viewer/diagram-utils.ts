/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { Point } from '@svgdotjs/svg.js';

export enum EdgeType {
    LINE,
    TWO_WINDINGS_TRANSFORMER,
    PHASE_SHIFT_TRANSFORMER,
    HVDC_LINE,
}

// transform angle degrees to radians
export function degToRad(deg: number): number {
    return deg * (Math.PI / 180.0);
}

// transform angle radians to degrees
export function radToDeg(rad: number): number {
    return (rad * 180.0) / Math.PI;
}

// get the transform element of an SVG graphic element
export function getTransform(
    element: SVGGraphicsElement | null
): SVGTransform | undefined {
    let transforms = element?.transform.baseVal;
    if (
        transforms?.length === 0 ||
        transforms?.getItem(0).type !== SVGTransform.SVG_TRANSFORM_TRANSLATE
    ) {
        element?.setAttribute('transform', 'translate(0,0)');
        transforms = element?.transform.baseVal;
    }
    return transforms?.getItem(0);
}

// get the position of an SVG graphic element
export function getPosition(element: SVGGraphicsElement | null): Point {
    const transform = getTransform(element);
    return new Point(transform?.matrix.e ?? 0, transform?.matrix.f ?? 0);
}

// get the middle position between two points
export function getMidPosition(point1: Point, point2: Point): Point {
    return new Point(0.5 * (point1.x + point2.x), 0.5 * (point1.y + point2.y));
}

// get a point at a distance between two points
export function getDistance(
    point1: Point,
    point2: Point,
    radius: number
): Point {
    const deltax = point1.x - point2.x;
    const deltay = point1.y - point2.y;
    const distance = Math.sqrt(deltax * deltax + deltay * deltay);
    const r = radius / distance;
    return new Point(
        point1.x + r * (point2.x - point1.x),
        point1.y + r * (point2.y - point1.y)
    );
}

// get the angle between two points
export function getAngle(point1: Point, point2: Point): number {
    return Math.atan2(point2.y - point1.y, point2.x - point1.x);
}

// get the angle of an arrow between two points of an edge polyline
export function getArrowAngle(point1: Point, point2: Point): number {
    const angle = getAngle(point1, point2);
    return radToDeg(
        angle + (angle > Math.PI / 2 ? (-3 * Math.PI) / 2 : Math.PI / 2)
    );
}

// get the data [angle, shift, text anchor] of a label
// between two points of an edge polyline
export function getLabelData(
    point1: Point,
    point2: Point,
    arrowLabelShift: number
): [number, number, string | null] {
    const angle = getAngle(point1, point2);
    const textFlipped = Math.cos(angle) < 0;
    return [
        radToDeg(textFlipped ? angle - Math.PI : angle),
        textFlipped ? -arrowLabelShift : arrowLabelShift,
        textFlipped ? 'text-anchor:end' : null,
    ];
}

// get fork position of a multibranch edge
export function getEdgeFork(
    point: Point,
    edgeForkLength: number,
    angleFork: number
) {
    return new Point(
        point.x + edgeForkLength * Math.cos(angleFork),
        point.y + edgeForkLength * Math.sin(angleFork)
    );
}

// get the type of edge, it uses the edge children number
// it would be better to have the information in the metadata
export function getEdgeType(edgeNode: SVGGraphicsElement): EdgeType {
    if (edgeNode.childElementCount == 2) {
        return EdgeType.LINE;
    }
    const transformerElement: SVGGraphicsElement =
        edgeNode.lastElementChild as SVGGraphicsElement;
    if (transformerElement.childElementCount == 1) {
        return EdgeType.HVDC_LINE;
    } else if (transformerElement.childElementCount == 2) {
        return EdgeType.TWO_WINDINGS_TRANSFORMER;
    } else {
        return EdgeType.PHASE_SHIFT_TRANSFORMER;
    }
}

// get the matrix used for the position of the arrow drawn in a PS transformer
export function getTransformerArrowMatrix(
    startPolyline: Point,
    endPolyline: Point,
    middle: Point,
    transfomerCircleRadius: number
): number[] {
    const arrowSize = 3 * transfomerCircleRadius;
    const rotationAngle = getAngle(startPolyline, endPolyline);
    const cosRo = Math.cos(rotationAngle);
    const sinRo = Math.sin(rotationAngle);
    const cdx = arrowSize / 2;
    const cdy = arrowSize / 2;
    const e1 = middle.x - cdx * cosRo + cdy * sinRo;
    const f1 = middle.y - cdx * sinRo - cdy * cosRo;
    return [+cosRo, sinRo, -sinRo, cosRo, e1, f1];
}

// get the points of a converter station of an HVDC line edge
export function getConverterStationPoints(
    startPolyline1: Point,
    endPolyline1: Point,
    startPolyline2: Point,
    endPolyline2: Point,
    converterStationWidth: number
): [Point, Point] {
    const halfWidth = converterStationWidth / 2;
    const point1: Point = getDistance(endPolyline1, startPolyline1, halfWidth);
    const point2: Point = getDistance(endPolyline2, startPolyline2, halfWidth);
    return [point1, point2];
}

// get the drabbable element, if present,
// from the element selected using the mouse
export function getDraggableFrom(element: SVGElement): SVGElement | undefined {
    if (isDraggable(element)) {
        return element;
    } else if (element.parentElement) {
        return getDraggableFrom(element.parentNode as SVGElement);
    }
}

function isDraggable(element: SVGElement): boolean {
    return (
        hasId(element) &&
        element.parentNode != null &&
        classIsContainerOfDraggables(element.parentNode as SVGElement)
    );
}

function hasId(element: SVGElement): boolean {
    return typeof element.id != 'undefined' && element.id != '';
}

function classIsContainerOfDraggables(element: SVGElement): boolean {
    return (
        element.classList.contains('nad-vl-nodes') ||
        element.classList.contains('nad-boundary-nodes') ||
        element.classList.contains('nad-3wt-nodes')
    );
}
