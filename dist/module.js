import {SVG as $hgUW1$SVG} from "@svgdotjs/svg.js";
import "@svgdotjs/svg.panzoom.js";



class $f48a6f081360e080$export$84fe2cc8245349ee {
    constructor(container, svgContent){
        console.info('container', container);
        this.container = container;
        this.svgContent = svgContent;
        this.init();
    }
    setWidth(width) {
        this.width = width;
    }
    setHeight(height) {
        this.height = height;
    }
    getWidth() {
        return this.width;
    }
    getHeight() {
        return this.height;
    }
    init() {
        console.info('this.svgContent', this.svgContent);
        this.container.innerHTML = ''; // clear the previous svg in div element before replacing
        let tmp = document.createElement('div');
        tmp.innerHTML = this.svgContent;
        const svgEl = tmp.getElementsByTagName('svg')[0];
        const { x: x , y: y , width: width , height: height  } = svgEl.viewBox.baseVal;
        const svgWidth = svgEl.getAttribute('width');
        const svgHeight = svgEl.getAttribute('height');
        this.setWidth(+svgWidth);
        this.setHeight(+svgHeight);
        const draw = $hgUW1$SVG().addTo(this.container).size(svgWidth, svgHeight).viewbox(x, y, width, height).panZoom({
            panning: true,
            zoomMin: 0.5,
            zoomMax: 200,
            zoomFactor: 0.3,
            margins: {
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
            }
        });
        tmp = draw.svg(this.svgContent).node.firstElementChild;
        tmp.style.overflow = 'visible';
        // PowSyBl NAD introduced server side calculated SVG viewbox
        // waiting for deeper adaptation, remove it and still rely on client side computed viewbox
        tmp = draw.node.firstChild;
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




export {$f48a6f081360e080$export$84fe2cc8245349ee as NetworkAreaDiagram};
//# sourceMappingURL=module.js.map
