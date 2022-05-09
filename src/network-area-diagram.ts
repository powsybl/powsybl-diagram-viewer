import { SVG } from '@svgdotjs/svg.js';
import '@svgdotjs/svg.panzoom.js';

export class NetworkAreaDiagram {
    container: HTMLElement;
    svgContent: string;
    width: number;
    height: number;

    constructor(container: HTMLElement, svgContent: string) {
        this.container = container;
        this.svgContent = svgContent;
        this.init();
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

    public init(): void {
        this.container.innerHTML = ''; // clear the previous svg in div element before replacing
        let svgAsHtmlElement: HTMLElement = document.createElement('div');
        svgAsHtmlElement.innerHTML = this.svgContent;
        const svgEl = svgAsHtmlElement.getElementsByTagName('svg')[0];
        const svgWidth = svgEl.getAttribute('width');
        const svgHeight = svgEl.getAttribute('height');
        const {x, y, width, height} = svgEl.viewBox.baseVal;

        this.setWidth(+svgWidth);
        this.setHeight(+svgHeight);
        const draw = SVG()
            .addTo(this.container)
            .size(svgWidth, svgHeight)
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
        // PowSyBl NAD introduced server side calculated SVG viewbox
        // waiting for deeper adaptation, remove it and still rely on client side computed viewbox
        (<HTMLElement> draw.node.firstChild).removeAttribute('viewBox');
    }
}

