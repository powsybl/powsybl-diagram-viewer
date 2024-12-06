/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 */

import { NetworkAreaDiagramViewer } from './network-area-diagram-viewer';

describe('Test network-area-diagram-viewer', () => {
    // SVG aren't loaded properly in DOM with Jest. Has to be enriched...
    test('nad creation', () => {
        const container: HTMLDivElement = document.createElement('div');

        const nad: NetworkAreaDiagramViewer = new NetworkAreaDiagramViewer(
            container,
            '',
            null,
            0,
            0,
            0,
            0,
            null,
            null,
            null,
            false,
            false,
            null,
            null
        );

        nad.moveNodeToCoordinates('', 0, 0);
        expect(container.getElementsByTagName('svg').length).toBe(0);
        expect(nad.getContainer().outerHTML).toBe('<div></div>');
        expect(nad.getSvgContent()).toBe('');
    });
});
