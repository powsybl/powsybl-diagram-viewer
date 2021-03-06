/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import NadSvgExample from '../data/nad-example.svg';
import { NetworkAreaDiagramViewer } from '../../src/network-area-diagram-viewer';

fetch(NadSvgExample)
    .then((response) => response.text())
    .then((svgContent) => {
        new NetworkAreaDiagramViewer(
            document.getElementById('svg-container'),
            svgContent,
            500,
            600,
            1000,
            1200
        );

        document
            .getElementsByTagName('svg')[0]
            .setAttribute('style', 'border:2px; border-style:solid;');
    });
