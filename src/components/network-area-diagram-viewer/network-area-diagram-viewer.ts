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
enum THRESHOLD_STATUS { BELOW, ABOVE};

export class NetworkAreaDiagramViewer {
    container: HTMLElement;
    svgContent: string;
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
    svgDraw: Svg | undefined;
    //currentZoomLevel: number;
    //histo: any;
    //previousLvl: number;

    dynamicCssRules = [
        {
            cssSelector: ".nad-edge-infos", // data on edges (arrows and values)
            belowThresholdCssDeclaration: {"display": "block"},
            aboveThresholdCssDeclaration: {"display": "none"},
            threshold: 2200,// 0.07,
            thresholdStatus: THRESHOLD_STATUS.ABOVE,
        },
        {
            cssSelector: ".nad-label-box", // tooltips linked to nodes
            belowThresholdCssDeclaration: {"display": "block"},
            aboveThresholdCssDeclaration: {"display": "none"},
            threshold: 3000,// 0.05,
            thresholdStatus: THRESHOLD_STATUS.ABOVE,
        },
        {
            cssSelector: ".nad-text-edges", // visual link between nodes and their tooltip
            belowThresholdCssDeclaration: {"display": "block"},
            aboveThresholdCssDeclaration: {"display": "none"},
            threshold: 3000,// 0.05,
            thresholdStatus: THRESHOLD_STATUS.ABOVE,
        },
        {
            cssSelector: '[class^="nad-vl0to30"], [class*=" nad-vl0to30"]',
            belowThresholdCssDeclaration: {"display": "block"},
            aboveThresholdCssDeclaration: {"display": "none"},
            threshold: 4000,// 0.03,
            thresholdStatus: THRESHOLD_STATUS.BELOW,
        },
        {
            cssSelector: '[class^="nad-vl30to50"], [class*=" nad-vl30to50"]',
            belowThresholdCssDeclaration: {"display": "block"},
            aboveThresholdCssDeclaration: {"display": "none"},
            threshold: 4000,// 0.03,
            thresholdStatus: THRESHOLD_STATUS.BELOW,
        },
        {
            cssSelector: '[class^="nad-vl50to70"], [class*=" nad-vl50to70"]',
            belowThresholdCssDeclaration: {"display": "block"},
            aboveThresholdCssDeclaration: {"display": "none"},
            threshold: 9000,// 0.02,
            thresholdStatus: THRESHOLD_STATUS.BELOW,
        },
        {
            cssSelector: '[class^="nad-vl70to120"], [class*=" nad-vl70to120"]',
            belowThresholdCssDeclaration: {"display": "block"},
            aboveThresholdCssDeclaration: {"display": "none"},
            threshold: 9000,// 0.02,
            thresholdStatus: THRESHOLD_STATUS.BELOW,
        },
        {
            cssSelector: '[class^="nad-vl120to180"], [class*=" nad-vl120to180"]',
            belowThresholdCssDeclaration: {"display": "block"},
            aboveThresholdCssDeclaration: {"display": "none"},
            threshold: 12000,// 0.015,
            thresholdStatus: THRESHOLD_STATUS.BELOW,
        },
        {
            cssSelector: '[class^="nad-vl180to300"], [class*=" nad-vl180to300"]',
            belowThresholdCssDeclaration: {"display": "block"},
            aboveThresholdCssDeclaration: {"display": "none"},
            threshold: 20000,// 0.01,
            thresholdStatus: THRESHOLD_STATUS.BELOW,
        },
        /*{
            cssSelector: '[class^="nad-vl180to300"] .nad-edge-path.nad-edge-path, [class*=" nad-vl180to300"] .nad-edge-path.nad-edge-path',
            belowThresholdCssDeclaration: {"stroke-width": "5px"},
            aboveThresholdCssDeclaration: {"stroke-width": "10px"},
            threshold: 0.015,
            thresholdStatus: THRESHOLD_STATUS.ABOVE,
        },
        {
            cssSelector: '[class^="nad-vl300to500"] .nad-edge-path.nad-edge-path, [class*=" nad-vl300to500"] .nad-edge-path.nad-edge-path',
            belowThresholdCssDeclaration: {"stroke-width": "5px"},
            aboveThresholdCssDeclaration: {"stroke-width": "15px"},
            threshold: 0.015,
            thresholdStatus: THRESHOLD_STATUS.ABOVE,
        },*/
    ];

    constructor(
        container: HTMLElement,
        svgContent: string,
        minWidth: number,
        minHeight: number,
        maxWidth: number,
        maxHeight: number
    ) {
        console.debug("NAD DIAGRAM VIEWER CONSTRUCTOR");
        this.container = container;
        this.svgContent = svgContent;
        this.width = 0;
        this.height = 0;
        this.originalWidth = 0;
        this.originalHeight = 0;
        //this.currentZoomLevel = 0;
        //this.histo = [];
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

    /*public getCurrentZoomLevel(): number {
        return this.currentZoomLevel;
    }

    public setCurrentZoomLevel(newZoomLevel: number): void {
        this.currentZoomLevel = newZoomLevel;
    }*/

    public getDynamicCssRules() {
        return this.dynamicCssRules;
    }

    /*public logHisto(level: number, maxSize: number): void {
        if(this.histo == undefined) {
            this.histo=[];
        }
        this.histo.push({level: level, maxSize: maxSize});
        if(this.histo.length % 10 === 0) {
            console.warn("CHARLY HISTO", this.histo);
        }
    }*/

    public updateSvgCssDisplayValue(svg: any, cssSelector: String, cssDeclaration) {
        const innerSvg = svg.querySelector('svg');
        let svgStyles = innerSvg.querySelectorAll('style');
        let ruleFound = false;
        for (const svgStyle of svgStyles) {
            if(!svgStyle?.sheet?.cssRules) {
                continue;
            }
            for (const rule of svgStyle.sheet.cssRules) {
                if (rule.selectorText === cssSelector) {
                    const key = Object.keys(cssDeclaration)[0];
                    const value = cssDeclaration[key];
                    rule.style.setProperty(key, value);
                    ruleFound = true;
                    console.warn("CHARLY => "+cssSelector+" updated to "+value);
                    break;
                }
            }
            if (ruleFound) {
                break;
            }
        }
        if (!ruleFound) {
            const key = Object.keys(cssDeclaration)[0];
            const value = cssDeclaration[key];
            console.info(cssSelector+" do not exist yet")
            let styleTag = svgStyles[svgStyles.length - 1]; // Adds the new rule to the last <style> tag in the SVG
            if (!styleTag) {
                innerSvg.appendChild(document.createElement('style'));
                console.debug("[updateSvgCssDisplayValue] Style tag missing from SVG file. It has been created.");
                styleTag = innerSvg.querySelector('style');
            }
            styleTag.textContent = `${cssSelector} {${key}: ${value};}\n` + styleTag.textContent;
        }
    }

    public initializeDynamicCssRules(maxDisplayedSize: number) {
        this.getDynamicCssRules().forEach((rule) => {
            rule.thresholdStatus = maxDisplayedSize < rule.threshold ? THRESHOLD_STATUS.BELOW : THRESHOLD_STATUS.ABOVE;
        });
    }

    public injectDynamicCssRules(htmlElementSvg: HTMLElement) {
        let rules = this.getDynamicCssRules().map(rule => {
            const ruleToInject = rule.thresholdStatus === THRESHOLD_STATUS.BELOW ? rule.belowThresholdCssDeclaration : rule.aboveThresholdCssDeclaration;
            const key = Object.keys(ruleToInject)[0];
            const value = ruleToInject[key];
            return `${rule.cssSelector} {${key}: ${value};}`;
        }).join('\n');

        let styleTag = htmlElementSvg.querySelector('style');
        if (!styleTag) {
            htmlElementSvg.appendChild(document.createElement('style'));
            console.debug("[injectDynamicCssRules] Style tag missing from SVG file. It has been created.");
            styleTag = htmlElementSvg.querySelector('style');
        }
        styleTag.textContent = rules + styleTag.textContent;
    }

    public getCurrentlyMaxDisplayedSize(): number {
        const viewbox = this.getViewBox();
        const maxValue = Math.max(viewbox.height, viewbox.width);
        return maxValue;
    }

    public checkLevelOfDetail(svg: any) {
        const maxDisplayedSize = this.getCurrentlyMaxDisplayedSize();
        this.getDynamicCssRules().forEach((rule) => {
            if (/*rule.thresholdStatus === THRESHOLD_STATUS.ABOVE && */maxDisplayedSize < rule.threshold) {
                console.debug("CSS Rule "+rule.cssSelector+" below threshold "+maxDisplayedSize+" < "+rule.threshold);
                rule.thresholdStatus = THRESHOLD_STATUS.BELOW;
                this.updateSvgCssDisplayValue(svg, rule.cssSelector, rule.belowThresholdCssDeclaration);
            } else if (/*rule.thresholdStatus === THRESHOLD_STATUS.BELOW && */maxDisplayedSize >= rule.threshold) {
                console.debug("CSS Rule "+rule.cssSelector+" above threshold "+maxDisplayedSize+" >= "+rule.threshold);
                rule.thresholdStatus = THRESHOLD_STATUS.ABOVE;
                this.updateSvgCssDisplayValue(svg, rule.cssSelector, rule.aboveThresholdCssDeclaration);
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
        console.debug("NAD DIAGRAM VIEWER INIT");

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
                zoomMin: 0.5 / ratio, // maximum zoom OUT ratio (0.5 = at best, the displayed area is twice the SVG's size)
                zoomMax: 20 * ratio, // maximum zoom IN ratio (20 = at best, the displayed area is only 1/20th of the SVG's size)
                zoomFactor: 0.2,
                margins: { top: 0, left: 0, right: 0, bottom: 0 },
            })
            .on('zoom', (event: CustomEvent) => {
                /*const newLvl = event.detail?.level;
                if (newLvl) {
                    let zoomAction;
                    if (newLvl < this.previousLvl) {
                        zoomAction = 'in';
                    } else {
                        zoomAction = 'out';
                    }
                    this.previousLvl = newLvl
                    const oldMaxDisplayedSize = this.getCurrentlyMaxDisplayedSize();
                    let newMaxDisplayedSize;
                    if(zoomAction === 'in') {
                        newMaxDisplayedSize = oldMaxDisplayedSize * 0.8;
                    } else {
                        newMaxDisplayedSize = oldMaxDisplayedSize * 1.2;
                    }
                    console.warn("CHARLY => newMaxDisplayedSize "+newMaxDisplayedSize);

                    //console.warn("CHARLY level="+event.detail?.level+" viewBox="+this.getCurrentlyMaxDisplayedSize());
                    //this.logHisto(event.detail?.level || 0,  newMaxDisplayedSize);

                    this.checkLevelOfDetail(event.target, newMaxDisplayedSize);
                }*/

                console.warn("CHARLY ZOOM FROM PANZOOM "+event.detail?.level);
                /*setTimeout(
                    () => this.checkLevelOfDetail(event.target),
                    200 // The new viewbox is only correctly calculated after this event ends, so we use a timeout here. Maybe there's a better solution ?
                );*/
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

        /*// TODO CHARLY remove this debug thing
        let currentLineNumber = 1;
        function charlyShowOutline() {
            let outline = '<rect x="'+dimensions.viewbox.x+'" y="'+dimensions.viewbox.y+'" width="'+dimensions.viewbox.width+'" height="'+dimensions.viewbox.height+'" fill="none" style="stroke-width: 30px; stroke: gold;"/>';
            firstChild.insertAdjacentHTML('beforeend', outline);
        }
        function enhanceOutsideBox() {
            let mask = '<mask id="outsideMask">';
            mask+= '<rect x="'+(dimensions.viewbox.x - dimensions.viewbox.width)+'" y="'+(dimensions.viewbox.y - dimensions.viewbox.height)+'" width="'+(3* dimensions.viewbox.width )+'" height="'+(3* dimensions.viewbox.height )+'" fill="white"/>';
            mask+= '<rect x="'+dimensions.viewbox.x+'" y="'+dimensions.viewbox.y+'" width="'+dimensions.viewbox.width+'" height="'+dimensions.viewbox.height+'" fill="black"/>';
            mask+= '</mask>';
            mask+= '<rect x="'+(dimensions.viewbox.x - dimensions.viewbox.width)+'" y="'+(dimensions.viewbox.y - dimensions.viewbox.height)+'" width="'+(3* dimensions.viewbox.width )+'" height="'+(3* dimensions.viewbox.height )+'" fill="rgba(0,0,0,0.5)" mask="url(#outsideMask)"/>';
            firstChild.insertAdjacentHTML('beforeend', mask);
        }
        function charlyDebug(toDisplay: String) {
            let newLine = '<text x="'+(dimensions.viewbox.x + 40)+'" y="'+(dimensions.viewbox.y + (currentLineNumber++ * (80+20)))+'" font-size="80" style="fill: gold;">';
            newLine+=toDisplay;
            newLine+='</text>';
            firstChild.insertAdjacentHTML('beforeend', newLine);
        }
        charlyShowOutline();
        //enhanceOutsideBox();
        charlyDebug("VIEWBOX");
        charlyDebug('x='+Math.round(dimensions.viewbox.x));
        charlyDebug('y='+Math.round(dimensions.viewbox.y));
        charlyDebug('w='+Math.round(dimensions.viewbox.width));
        charlyDebug('h='+Math.round(dimensions.viewbox.height));

        charlyDebug('dimensions.width='+Math.round(dimensions.width));
        charlyDebug('dimensions.height='+Math.round(dimensions.height));

        charlyDebug('this.getWidth()='+Math.round(this.getWidth()));
        charlyDebug('this.getHeight()='+Math.round(this.getHeight()));
        charlyDebug('ratio='+Math.round(ratio));*/

        // We insert custom CSS to hide details before first load, in order to improve performances
        this.initializeDynamicCssRules(Math.max(dimensions.viewbox.width, dimensions.viewbox.height));
        this.injectDynamicCssRules(firstChild);
        draw.fire('zoom'); // Forces a new dynamic zoom check to correctly update the dynamic CSS




        // Select the node that will be observed for mutations
        const targetNode = draw.node;
        // Options for the observer (which mutations to observe)
        const config = { attributes: true, childList: false, subtree: false };
        // Callback function to execute when mutations are observed
        const callback = (mutationList, observer) => {
            for (const mutation of mutationList) {
                if (mutation.type === "attributes" && mutation.attributeName === 'viewBox') {
                    //console.log(`CHARLY => The ${mutation.attributeName} attribute was modified.`);
                    //if (mutation.attributeName === 'viewBox') {
                    //    console.log('CHARLY => LETS GO CHECK LEVEL OF DETAIL');
                        this.checkLevelOfDetail(targetNode);
                    //}
                }
            }
        };
        // Create an observer instance linked to the callback function
        const observer = new MutationObserver(callback);
        // Start observing the target node for configured mutations
        observer.observe(targetNode, config);


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
