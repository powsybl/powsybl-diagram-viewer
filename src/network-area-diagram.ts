import { SVG } from '@svgdotjs/svg.js';
import '@svgdotjs/svg.panzoom.js';

export class NetworkAreaDiagram {
    container: HTMLElement;
    svgContent: string;
    width: number;
    height: number;

    constructor(container: HTMLElement, svgContent: string) {
        console.info('container', container)
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
        let tmp: HTMLElement = document.createElement('div');
        tmp.innerHTML = this.svgContent;
        const svgEl = tmp.getElementsByTagName('svg')[0];
        const {x, y, width, height} = svgEl.viewBox.baseVal;
        const svgWidth = svgEl.getAttribute('width');
        const svgHeight = svgEl.getAttribute('height');

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

        tmp = <HTMLElement> draw.svg(this.svgContent).node.firstElementChild;
        tmp.style.overflow = 'visible';

        // PowSyBl NAD introduced server side calculated SVG viewbox
        // waiting for deeper adaptation, remove it and still rely on client side computed viewbox
        tmp = <HTMLElement> draw.node.firstChild;
        tmp.removeAttribute('viewBox');

        // draw.on('panStart', function (evt) {
        //     this.nadContainer.style.cursor = 'move';
        // });
        // draw.on('panEnd', function (evt) {
        //     this.nadContainer.style.cursor = 'default';
        // });

        // this.container.appendChild(this.container);
        // this.container.style.svgWidth = svgWidth + 'px';
        // this.container.style.svgHeight = svgHeight + 'px';
        // this.container.appendChild(this.nadContainer);
        // this.container.insertAdjacentElement('afterend', this.nadContainer);

        // if (draw && svgUrlRef.current === svg.svgUrl) {
        //     draw.viewbox(draw.viewbox());
        // }
        // svgUrlRef.current = svg.svgUrl;
    }
}

