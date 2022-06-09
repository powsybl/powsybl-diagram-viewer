/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { SVG } from '@svgdotjs/svg.js';
import '@svgdotjs/svg.panzoom.js';

type DIMENSIONS = { width: number; height: number; viewbox: VIEWBOX };
type VIEWBOX = { x: number; y: number; width: number; height: number };

export class NetworkAreaDiagramViewer {
    container: HTMLElement;
    svgContent: string;
    width: number;
    height: number;

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
        this.init(minWidth, minHeight, maxWidth, maxHeight);
    }

    public setWidth(width: number): void {
        this.width = width;
    }

    public setHeight(height: number): void {
        this.height = height;
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

    public getHeight(): number {
        return this.height;
    }

    public getContainer(): HTMLElement {
        return this.container;
    }

    public getSvgContent(): string {
        return this.svgContent;
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

        const dimensions: DIMENSIONS = this.getDimensionsFromSvg();

        if (!dimensions) {
            return;
        }

        // clear the previous svg in div element before replacing
        this.container.innerHTML = '';

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
        const draw = SVG()
            .addTo(this.container)
            .size(this.width, this.height)
            .viewbox(
                dimensions.viewbox.x,
                dimensions.viewbox.y,
                dimensions.viewbox.width,
                dimensions.viewbox.height
            )
            .panZoom({
                panning: true,
                zoomMin: 0.5,
                zoomMax: 200,
                zoomFactor: 0.3,
                margins: { top: 0, left: 0, right: 0, bottom: 0 },
            });

        const drawnSvg: HTMLElement = <HTMLElement>(
            draw.svg(this.svgContent).node.firstElementChild
        );
        drawnSvg.style.overflow = 'visible';
        // PowSyBl NAD introduced server side calculated SVG viewbox. This viewBox attribute can be removed as it is copied in the panzoom svg tag.
        const firstChild: HTMLElement = <HTMLElement>draw.node.firstChild;
        firstChild.removeAttribute('viewBox');
        firstChild.removeAttribute('width');
        firstChild.removeAttribute('height');
    }

    public getDimensionsFromSvg(): DIMENSIONS {
        // Dimensions are set in the main svg tag attributes. We want to parse those data without loading the whole svg in the DOM.
        const result = this.svgContent.match('<svg(.*)>');
        if (result === null || result.length === 0) {
            return null;
        }
        const emptiedSvgContent = result[0]  + '</svg>';
        const svg: SVGSVGElement = new DOMParser()
            .parseFromString(emptiedSvgContent, 'image/svg+xml')
            .getElementsByTagName('svg')[0];
        const width: number = +svg.getAttribute('width');
        const height: number = +svg.getAttribute('height');
        const viewbox: VIEWBOX = svg.viewBox.baseVal;
        return { width: width, height: height, viewbox: viewbox };
    }
}
