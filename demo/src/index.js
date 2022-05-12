/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { NetworkAreaDiagramViewer } from '../../dist/module.js';
import NadSvgExample from '../data/nad-example.svg'

fetch(NadSvgExample)
    .then(response => response.text())
    .then((svgContent) => {
        const nad = new NetworkAreaDiagramViewer(
            document.getElementById('svg-container'),
            svgContent,
            500,
            600
        );

        document.getElementsByTagName('svg')[0].setAttribute("style","border:2px; border-style:solid;");
    });

