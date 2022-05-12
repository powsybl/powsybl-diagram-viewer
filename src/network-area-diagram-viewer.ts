/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { SVG } from '@svgdotjs/svg.js';
import '@svgdotjs/svg.panzoom.js';

export class NetworkAreaDiagramViewer {
    container: HTMLElement;
    svgContent: string;
    width: number;
    height: number;

    constructor(container: HTMLElement, svgContent: string, maxWidth: number, maxHeight: number) {
        this.container = container;
        this.svgContent = svgContent;
        this.init(maxWidth, maxHeight);
    }

    public setWidth(width: number): void {



        this.width = width;
    }

    public setHeight(height: number): void {
        this.height = height;
    }

    public getWidth(): number {
        return this.width
    }

    public getHeight(): number {
        return this.height
    }

    public init(maxWidth: number, maxHeight:                 number): void {
        this.container.innerHTML = ''; // clear the previous svg in div element before replacing
        let svgAsHtmlElement: HTMLElement = document.createElement('div');
        svgAsHtmlElement.innerHTML = this.svgContent;




        const svgEl = svgAsHtmlElement.getElementsByTagName('svg')[0];
        const svgWidth = svgEl.getAttribute('width');
        const svgHeight = svgEl.getAttribute('height');
        const {x, y, width, height} = svgEl.viewBox.baseVal;

        this.setWidth(Math.min(+svgWidth, maxWidth));
        this.setHeight(Math.min(+svgHeight, maxHeight));
        const draw = SVG()
            .addTo(this.container)
            .size(this.width, this.height)
            .viewbox(x, y, width, height)
            .panZoom({
                panning: true,
                zoomMin: 0.5,
                zoomMax: 200,
                zoomFactor: 0.3,
                margins: { top: 0, left: 0, right: 0, bottom: 0 },
            });

        let drawnSvg: HTMLElement = <HTMLElement> draw.svg(this.svgContent).node.firstElementChild;
        drawnSvg.style.overflow = 'visible';
        // PowSyBl NAD introduced server side calculated SVG viewbox. This viewBox attribute can be removed as it is copied in the panzoom svg tag.
        (<HTMLElement> draw.node.firstChild).removeAttribute('viewBox');
    }
}
