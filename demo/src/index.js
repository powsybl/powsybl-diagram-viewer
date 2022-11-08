/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import NadSvgExample from '../data/nad-example.svg';
import SldSvgExample from '../data/sld-example.svg';
import SldSvgExampleMeta from '../data/sld-example-meta.json';
import SldSvgSubExample from '../data/sld-sub-example.svg';
import SldSvgSubExampleMeta from '../data/sld-sub-example-meta.json';

import { NetworkAreaDiagramViewer } from '../../src/network-area-diagram-viewer';
import { SingleLineDiagramViewer } from '../../src/single-line-diagram-viewer';

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
            .getElementById('svg-container')
            .getElementsByTagName('svg')[0]
            .setAttribute('style', 'border:2px; border-style:solid;');
    });

fetch(SldSvgExample)
    .then((response) => response.text())
    .then((svgContent) => {
        new SingleLineDiagramViewer(
            document.getElementById('svg-container-sld'),
            svgContent, //svg content
            null, //svg metadata
            'voltage-level',
            500,
            600,
            1000,
            1200,
            null, //callback on the next voltage arrows
            null, //callback on the breakers
            null, //callback on the feeders
            null //arrows color
        );

        document
            .getElementById('svg-container-sld')
            .getElementsByTagName('svg')[0]
            .setAttribute('style', 'border:2px; border-style:solid;');
    });

const handleNextVL = (id) => {
    const msg = 'Clicked on navigation arrow, dest VL is ' + id;
    console.log(msg);
};

const handleSwitch = (id, switch_status, element) => {
    const msg =
        'Clicked on switch: ' +
        id +
        ', switch_status: ' +
        (switch_status ? 'close' : 'open') +
        '. elementId: ' +
        element.id;
    console.log(msg);
};

const handleFeeder = (id, feederType, svgId, x, y) => {
    const msg =
        'Clicked on feeder: ' +
        id +
        ', feeder type: ' +
        feederType +
        ', svgId: ' +
        svgId +
        'x: ' +
        x +
        ', y: ' +
        y;
    console.log(msg);
};

fetch(SldSvgExample)
    .then((response) => response.text())
    .then((svgContent) => {
        new SingleLineDiagramViewer(
            document.getElementById('svg-container-sld-with-callbacks'),
            svgContent, //svg content
            SldSvgExampleMeta, //svg metadata
            'voltage-level',
            500,
            600,
            1000,
            1200,
            handleNextVL, //callback on the next voltage arrows
            handleSwitch, //callback on the breakers
            handleFeeder, //callback on the feeders
            'lightblue' //arrows color
        );

        document
            .getElementById('svg-container-sld-with-callbacks')
            .getElementsByTagName('svg')[0]
            .setAttribute('style', 'border:2px; border-style:solid;');
    });

fetch(SldSvgSubExample)
    .then((response) => response.text())
    .then((svgContent) => {
        new SingleLineDiagramViewer(
            document.getElementById('svg-container-sldsub-with-callbacks'),
            svgContent, //svg content
            SldSvgSubExampleMeta, //svg metadata
            'substation',
            500,
            600,
            1200,
            1200,
            handleNextVL, //callback on the next voltage arrows
            handleSwitch, //callback on the breakers
            handleFeeder, //callback on the feeders
            'lightblue' //arrows color
        );

        document
            .getElementById('svg-container-sldsub-with-callbacks')
            .getElementsByTagName('svg')[0]
            .setAttribute('style', 'border:2px; border-style:solid;');
    });
