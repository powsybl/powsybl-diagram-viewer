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

    dynamicCssRules = [
        {
            cssSelector: ".nad-edge-infos", // data on edges (arrows and values)
            activeCssDeclaration: {"display": "block"},
            inactiveCssDeclaration: {"display": "none"},
            threshold: 0.07,
            active: false,
        },
        {
            cssSelector: ".nad-label-box", // tooltips linked to nodes
            activeCssDeclaration: {"display": "block"},
            inactiveCssDeclaration: {"display": "none"},
            threshold: 0.05,
            active: false,
        },
        {
            cssSelector: ".nad-text-edges", // visual link between nodes and their tooltip
            activeCssDeclaration: {"display": "block"},
            inactiveCssDeclaration: {"display": "none"},
            threshold: 0.05,
            active: false,
        },
        {
            cssSelector: '[class^="nad-vl0to30"], [class*=" nad-vl0to30"]',
            activeCssDeclaration: {"display": "block"},
            inactiveCssDeclaration: {"display": "none"},
            threshold: 0.03,
            active: false,
        },
        {
            cssSelector: '[class^="nad-vl30to50"], [class*=" nad-vl30to50"]',
            activeCssDeclaration: {"display": "block"},
            inactiveCssDeclaration: {"display": "none"},
            threshold: 0.03,
            active: false,
        },
        {
            cssSelector: '[class^="nad-vl50to70"], [class*=" nad-vl50to70"]',
            activeCssDeclaration: {"display": "block"},
            inactiveCssDeclaration: {"display": "none"},
            threshold: 0.02,
            active: false,
        },
        {
            cssSelector: '[class^="nad-vl70to120"], [class*=" nad-vl70to120"]',
            activeCssDeclaration: {"display": "block"},
            inactiveCssDeclaration: {"display": "none"},
            threshold: 0.02,
            active: false,
        },
        {
            cssSelector: '[class^="nad-vl120to180"], [class*=" nad-vl120to180"]',
            activeCssDeclaration: {"display": "block"},
            inactiveCssDeclaration: {"display": "none"},
            threshold: 0.015,
            active: false,
        },
        {
            cssSelector: '[class^="nad-vl180to300"], [class*=" nad-vl180to300"]',
            activeCssDeclaration: {"display": "block"},
            inactiveCssDeclaration: {"display": "none"},
            threshold: 0.01,
            active: false,
        },
        {
            cssSelector: '[class^="nad-vl180to300"] .nad-edge-path.nad-edge-path, [class*=" nad-vl180to300"] .nad-edge-path.nad-edge-path',
            activeCssDeclaration: {"stroke-width": "5px"},
            inactiveCssDeclaration: {"stroke-width": "10px"},
            threshold: 0.015,
            active: false,
        },
        {
            cssSelector: '[class^="nad-vl300to500"] .nad-edge-path.nad-edge-path, [class*=" nad-vl300to500"] .nad-edge-path.nad-edge-path',
            activeCssDeclaration: {"stroke-width": "5px"},
            inactiveCssDeclaration: {"stroke-width": "15px"},
            threshold: 0.015,
            active: false,
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

    public getDynamicCssRules() {
        return this.dynamicCssRules;
    }

    public updateSvgCssDisplayValue(svg: any, cssSelector: String, cssDeclaration) {
        const svgStyles = svg.querySelectorAll('svg style');
        let ruleFound = false;
        for (const svgStyle: SVGStyleElement of svgStyles) {
            if(!svgStyle?.sheet?.cssRules) {
                continue;
            }
            for (const rule: any of svgStyle.sheet.cssRules) {
                if (rule.selectorText === cssSelector) {
                    const key = Object.keys(cssDeclaration)[0];
                    const value = cssDeclaration[key];
                    rule.style.setProperty(key, value);
                    ruleFound = true;
                    break;
                }
            }
            if (ruleFound) {
                break;
            }
        }
        if (!ruleFound) {
            console.info(cssSelector+" do not exist yet")
            let svgStyle = svgStyles[svgStyles.length - 1]; // Adds the new rule to the last <style> tag in the SVG
            const key = Object.keys(cssDeclaration)[0];
            const value = cssDeclaration[key];
            svgStyle.sheet.insertRule(`${cssSelector} {${key}: ${value};}`);
        }
    }

    public injectDynamicCssRules(htmlElementSvg: HTMLElement) {
        let rules = this.getDynamicCssRules().map(rule => {
            const ruleToInject = rule.active ? rule.activeCssDeclaration : rule.inactiveCssDeclaration;
            const key = Object.keys(ruleToInject)[0];
            const value = ruleToInject[key];
            return `${rule.cssSelector} {${key}: ${value};}`;
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
        this.getDynamicCssRules().forEach((rule) => {
            if (rule.active && event.detail.level < rule.threshold) {
                console.debug("CSS Rule "+rule.cssSelector+" below threshold");
                rule.active = false;
                this.updateSvgCssDisplayValue(event.target, rule.cssSelector, rule.inactiveCssDeclaration);
            } else if (!rule.active && event.detail.level >= rule.threshold) {
                console.debug("CSS Rule "+rule.cssSelector+" above threshold");
                rule.active = true;
                this.updateSvgCssDisplayValue(event.target, rule.cssSelector, rule.activeCssDeclaration);
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
        this.injectDynamicCssRules(firstChild);

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
