/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { SVG, ViewBoxLike, Svg } from '@svgdotjs/svg.js';
import '@svgdotjs/svg.panzoom.js';

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

    cullingRules = [
        {
            css: ".nad-edge-infos", // data on edges (arrows and values)
            threshold: 0.07,
            visible: false,
        },
        {
            css: ".nad-label-box", // tooltips linked to nodes
            threshold: 0.06,
            visible: false,
        },
        {
            css: ".nad-text-edges", // visual link between nodes and their tooltip
            threshold: 0.06,
            visible: false,
        },
        {
            css: '[class^="nad-vl0to30"], [class*=" nad-vl0to30"]',
            threshold: 0.03,
            visible: false,
        },
        {
            css: '[class^="nad-vl30to50"], [class*=" nad-vl30to50"]',
            threshold: 0.03,
            visible: false,
        },
        {
            css: '[class^="nad-vl50to70"], [class*=" nad-vl50to70"]',
            threshold: 0.02,
            visible: false,
        },
        {
            css: '[class^="nad-vl70to120"], [class*=" nad-vl70to120"]',
            threshold: 0.02,
            visible: false,
        },
        {
            css: '[class^="nad-vl120to180"], [class*=" nad-vl120to180"]',
            threshold: 0.015,
            visible: false,
        },
        {
            css: '[class^="nad-vl180to300"], [class*=" nad-vl180to300"]',
            threshold: 0.01,
            visible: false,
        },
    ];

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

    public getCullingRules() {
        return this.cullingRules;
    }

    public updateSvgCssDisplayValue(svg: any, cssRule: String, displayValue) {
        const svgStyles = svg.querySelectorAll('svg style');
        let ruleFound = false;
        for (const svgStyle: SVGStyleElement of svgStyles) {
            if(!svgStyle?.sheet?.cssRules) {
                continue;
            }
            for (const rule: any of svgStyle.sheet.cssRules) {
                if (rule.selectorText === cssRule) {
                    rule.style.display = displayValue;
                    ruleFound = true;
                    break;
                }
            }
            if (ruleFound) {
                break;
            }
        }
        if (!ruleFound) {
            console.info(cssRule+" do not exist yet")
            let svgStyle = svgStyles[svgStyles.length - 1];
            svgStyle.sheet.insertRule(`${cssRule} { display: ${displayValue}; }`);
        }
    }

    public injectCullingRules(htmlElementSvg: HTMLElement) {
        let rules = this.getCullingRules().map(rule => {
            return `${rule.css} {display: ${rule.visible ? 'block' : 'none'};}`;
        }).join('\n');

        let styleTag = htmlElementSvg.querySelector('style');
        if (!styleTag) {
            htmlElementSvg.appendChild(document.createElement('style'));
            console.debug("Style tag missing from SVG file. It has been created.");
            styleTag = htmlElementSvg.querySelector('style');
        }
        styleTag.textContent = rules + styleTag.textContent;
    }

    public checkLevelOfDetail(event: CustomEvent) {
        console.debug("zoom level "+event.detail.level);
        this.getCullingRules().forEach((rule) => {
            if (rule.visible && event.detail.level < rule.threshold) {
                console.debug("Should hide", rule.css);
                this.updateSvgCssDisplayValue(event.target, rule.css, 'none');
                rule.visible = false;
            } else if (!rule.visible && event.detail.level >= rule.threshold) {
                console.debug("Should show", rule.css);
                this.updateSvgCssDisplayValue(event.target, rule.css, 'block');
                rule.visible = true;
            }
        });
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

        // we check if there is an "initial zoom" by checking ratio of width and height of the nad compared with viewBox sizes
        const widthRatio = dimensions.viewbox.width / this.getWidth();
        const heightRatio = dimensions.viewbox.height / this.getHeight();
        const ratio = Math.max(widthRatio, heightRatio);

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
                zoomMin: 0.5 / ratio,
                zoomMax: 30 * ratio,
                zoomFactor: 0.2,
                margins: { top: 0, left: 0, right: 0, bottom: 0 },
            })
            .on('zoom', (event: CustomEvent) => this.checkLevelOfDetail(event));

        const drawnSvg: HTMLElement = <HTMLElement>(
            draw.svg(this.svgContent).node.firstElementChild
        );
        drawnSvg.style.overflow = 'visible';
        // PowSyBl NAD introduced server side calculated SVG viewbox. This viewBox attribute can be removed as it is copied in the panzoom svg tag.
        const firstChild: HTMLElement = <HTMLElement>draw.node.firstChild;
        firstChild.removeAttribute('viewBox');
        firstChild.removeAttribute('width');
        firstChild.removeAttribute('height');

        // We insert custom CSS to hide details before first load, in order to improve performances
        this.injectCullingRules(firstChild);

        this.svgDraw = draw;
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
}
