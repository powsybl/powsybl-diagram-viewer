/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { Point } from '@svgdotjs/svg.js';

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
    return {
        x: 0.5 * (point1.x + point2.x),
        y: 0.5 * (point1.y + point2.y),
    };
}

// get the distance between two points
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
    return {
        x: point.x + edgeForkLength * Math.cos(angleFork),
        y: point.y + edgeForkLength * Math.sin(angleFork),
    };
}

// check if it is a transformer edge, it uses the edge children
// it would be better to have the information in the metadata
export function isTransformerEdge(edgeNode: SVGGraphicsElement): boolean {
    return edgeNode.childElementCount == 3;
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
