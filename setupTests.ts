//FIXME workaround svg.panzoom.js import crash even though it's not used
/* eslint-disable */
declare var SVG: any;
global.SVG = () => {};
global.SVG.extend = () => {};
/* eslint-enable */
