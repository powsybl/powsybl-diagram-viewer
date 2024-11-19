/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 */

import { SVG } from '@svgdotjs/svg.js';

export function getSvgNode(): SVGGraphicsElement {
    const nodeSvg =
        '<g class="nad-vl-nodes"><g transform="translate(-452.59,-274.01)" id="0">' +
        '<circle r="27.50" id="1" class="nad-vl0to30-0 nad-busnode"/></g></g>';
    return (<SVGGraphicsElement>SVG().svg(nodeSvg).node.firstElementChild?.firstElementChild) as SVGGraphicsElement;
}

export function getSvgTextNode(): SVGGraphicsElement {
    const textNodeSvg =
        '<g class="nad-text-nodes">' +
        '<foreignObject id="0-textnode" y="-314.01" x="-352.59" height="1" width="1">' +
        '<div xmlns="http://www.w3.org/1999/xhtml" class="nad-label-box"><div>VLGEN</div>' +
        '<table><tr><td><div class="nad-vl0to30-0 nad-legend-square"/></td>' +
        '<td>24.5 kV / 2.3°</td></tr></table></div></foreignObject></g>';
    return (<SVGGraphicsElement>SVG().svg(textNodeSvg).node.firstElementChild?.firstElementChild) as SVGGraphicsElement;
}

export function getSvgLoopEdge(): SVGGraphicsElement {
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
    return (<SVGGraphicsElement>SVG().svg(edgeSvg).node.firstElementChild?.firstElementChild) as SVGGraphicsElement;
}

export function getSvgPolyline(): HTMLElement {
    const edgeSvg =
        '<g id="8" class="nad-vl300to500-line">' +
        '<polyline class="nad-edge-path nad-stretchable" points="173.73,100.97 -8.21,-210.51"/>' +
        '<g class="nad-glued-1 nad-edge-infos" transform="translate(157.34,72.90)">' +
        '<g class="nad-active"><g transform="rotate(-30.29)">' +
        '<path class="nad-arrow-in" transform="scale(10.00)" d="M-1 -1 H1 L0 1z"/>' +
        '<path class="nad-arrow-out" transform="scale(10.00)" d="M-1 1 H1 L0 -1z"/></g>' +
        '<text transform="rotate(-300.29)" x="-19.00" style="text-anchor:end"></text></g></g></g>';
    return (<HTMLElement>SVG().svg(edgeSvg).node.firstElementChild?.firstElementChild) as HTMLElement;
}

export function getSvgPath(): HTMLElement {
    const edgeSvg =
        '<g id="16.1" class="nad-vl70to120-line">' +
        '<path class="nad-edge-path" d="M350.33,-167.48 L364.63,-184.85 C390.06,-215.73 412.13,-202.64 415.64,-193.28"/>' +
        '<g class="nad-edge-infos" transform="translate(364.63,-184.85)"><g class="nad-active">' +
        '<g transform="rotate(39.46)"><path class="nad-arrow-in" transform="scale(10.00)" d="M-1 -1 H1 L0 1z"/>' +
        '<path class="nad-arrow-out" transform="scale(10.00)" d="M-1 1 H1 L0 -1z"/></g>' +
        '<text transform="rotate(-50.54)" x="19.00"></text></g></g></g>';
    return (<HTMLElement>SVG().svg(edgeSvg).node.firstElementChild?.firstElementChild) as HTMLElement;
}
