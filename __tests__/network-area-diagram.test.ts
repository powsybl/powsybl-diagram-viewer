import { NetworkAreaDiagramViewer } from '../src/network-area-diagram-viewer';

describe('Test network-area-diagram-viewer.ts', () => {
    // SVG not loaded properly in DOM with Jest. Has to be enrich...
    test('nad creation', () => {
        const container: HTMLDivElement = document.createElement('div');

        const nad: NetworkAreaDiagramViewer = new NetworkAreaDiagramViewer(
            container,
            '',
            0,
            0,
            0,
            0,
            0
        );

        expect(container.getElementsByTagName('svg').length).toBe(0);
        expect(nad.getContainer().outerHTML).toBe('<div></div>');
        expect(nad.getSvgContent()).toBe('');
    });
});
