/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import NadSvgExample from './data/nad-example.svg';
import SldSvgExample from './data/sld-example.svg';
import SldSvgExampleMeta from './data/sld-example-meta.json';
import SldSvgSubExample from './data/sld-sub-example.svg';
import SldSvgSubExampleMeta from './data/sld-sub-example-meta.json';

import {
    NetworkAreaDiagramViewer,
    SingleLineDiagramViewer,
    HandleTogglePopoverType,
    OnBreakerCallbackType,
    OnBusCallbackType,
    OnFeederCallbackType,
    OnNextVoltageCallbackType,
} from '../../../src';

export const addNadToDemo = () => {
    fetch(NadSvgExample)
        .then((response) => response.text())
        .then((svgContent) => {
            new NetworkAreaDiagramViewer(
                // @ts-expect-error: we know it's not null in the demo
                document.getElementById('svg-container'),
                svgContent,
                500,
                600,
                1000,
                1200
            );

            document
                .getElementById('svg-container')
                ?.getElementsByTagName('svg')[0]
                .setAttribute('style', 'border:2px; border-style:solid;');
        });
};

export const addSldToDemo = () => {
    fetch(SldSvgExample)
        .then((response) => response.text())
        .then((svgContent) => {
            new SingleLineDiagramViewer(
                // @ts-expect-error: we know it's not null in the demo
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
                null, //callback on the buses
                null, //arrows color
                null //hovers on equipments callback
            );

            document
                .getElementById('svg-container-sld')
                ?.getElementsByTagName('svg')[0]
                .setAttribute('style', 'border:2px; border-style:solid;');
        });

    fetch(SldSvgExample)
        .then((response) => response.text())
        .then((svgContent) => {
            new SingleLineDiagramViewer(
                // @ts-expect-error: we know it's not null in the demo
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
                handleBus, //callback on the buses
                'lightblue', //arrows color
                handleTogglePopover //hovers on equipments callback
            );

            document
                .getElementById('svg-container-sld-with-callbacks')
                ?.getElementsByTagName('svg')[0]
                .setAttribute('style', 'border:2px; border-style:solid;');
        });

    fetch(SldSvgSubExample)
        .then((response) => response.text())
        .then((svgContent) => {
            new SingleLineDiagramViewer(
                // @ts-expect-error: we know it's not null in the demo
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
                handleBus, //callback on the buses
                'lightblue', //arrows color
                handleTogglePopover //hovers on equipments callback
            );

            document
                .getElementById('svg-container-sldsub-with-callbacks')
                ?.getElementsByTagName('svg')[0]
                .setAttribute('style', 'border:2px; border-style:solid;');
        });
};

const handleNextVL: OnNextVoltageCallbackType = (id: string) => {
    const msg = 'Clicked on navigation arrow, dest VL is ' + id;
    console.log(msg);
};

const handleSwitch: OnBreakerCallbackType = (id, switch_status, element) => {
    const msg =
        'Clicked on switch: ' +
        id +
        ', switch_status: ' +
        (switch_status ? 'close' : 'open') +
        '. elementId: ' +
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO no "id" prop existing
        (element as any).id;
    console.log(msg);
};

const handleFeeder: OnFeederCallbackType = (id, feederType, svgId, x, y) => {
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

const handleBus: OnBusCallbackType = (id, svgId, x, y) => {
    const msg =
        'Clicked on bus: ' + id + ', svgId: ' + svgId + 'x: ' + x + ', y: ' + y;
    console.log(msg);
};

const handleTogglePopover: HandleTogglePopoverType = (
    shouldDisplay,
    anchorEl,
    equipmentId,
    equipmentType
) => {
    if (shouldDisplay) {
        const msg =
            'Hovers on equipment: ' +
            equipmentId +
            ', equipmentType: ' +
            equipmentType;
        console.log(msg);
    }
};
