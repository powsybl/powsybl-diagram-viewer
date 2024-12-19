/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import NadSvgExample from './data/nad-eurostag-tutorial-example1.svg';
import NadSvgExampleMeta from './data/nad-eurostag-tutorial-example1_metadata.json';
import NadSvgPstHvdcExample from './data/nad-four-substations.svg';
import NadSvgPstHvdcExampleMeta from './data/nad-four-substations_metadata.json';
import NadSvgMultibusVLNodesExample from './data/nad-ieee9-zeroimpedance-cdf.svg';
import NadSvgMultibusVLNodesExampleMeta from './data/nad-ieee9-zeroimpedance-cdf_metadata.json';
import NadSvgMultibusVLNodes14Example from './data/nad-ieee14cdf-solved.svg';
import NadSvgMultibusVLNodes14ExampleMeta from './data/nad-ieee14cdf-solved_metadata.json';
import NadSvgThreeWTDanglingLineUnknownBusExample from './data/nad-scada.svg';
import NadSvgThreeWTDanglingLineUnknownBusExampleMeta from './data/nad-scada_metadata.json';
import NadSvgPartialNetworkExample from './data/nad-ieee300cdf-VL9006.svg';
import NadSvgPartialNetworkExampleMeta from './data/nad-ieee300cdf-VL9006_metadata.json';
import SldSvgExample from './data/sld-example.svg';
import SldSvgExampleMeta from './data/sld-example-meta.json';
import SldSvgSubExample from './data/sld-sub-example.svg';
import SldSvgSubExampleMeta from './data/sld-sub-example-meta.json';

import {
    NetworkAreaDiagramViewer,
    SingleLineDiagramViewer,
    OnToggleSldHoverCallbackType,
    OnBreakerCallbackType,
    OnBusCallbackType,
    OnFeederCallbackType,
    OnNextVoltageCallbackType,
    OnMoveNodeCallbackType,
    OnMoveTextNodeCallbackType,
    OnSelectNodeCallbackType,
    OnToggleNadHoverCallbackType,
    OnSaveCallbackType,
    MouseMode,
} from '../../../src';

export const addNadToDemo = () => {
    fetch(NadSvgExample)
        .then((response) => response.text())
        .then((svgContent) => {
            new NetworkAreaDiagramViewer(
                document.getElementById('svg-container-nad')!,
                svgContent,
                NadSvgExampleMeta,
                500,
                600,
                1000,
                1200,
                handleNodeMove,
                handleTextNodeMove,
                handleNodeSelect,
                true,
                false,
                null,
                handleToggleNadHover,
                handleSave,
                true,
                MouseMode.MOVE
            );

            document.getElementById('svg-container-nad')?.setAttribute('style', 'border:2px; border-style:solid;');
        });

    fetch(NadSvgExample)
        .then((response) => response.text())
        .then((svgContent) => {
            new NetworkAreaDiagramViewer(
                document.getElementById('svg-container-nad-no-moving')!,
                svgContent,
                NadSvgExampleMeta,
                500,
                600,
                1000,
                1200,
                null,
                null,
                handleNodeSelect,
                false,
                false,
                null,
                handleToggleNadHover,
                handleSave,
                true,
                null
            );

            document
                .getElementById('svg-container-nad-no-moving')
                ?.setAttribute('style', 'border:2px; border-style:solid;');
        });

    fetch(NadSvgMultibusVLNodesExample)
        .then((response) => response.text())
        .then((svgContent) => {
            new NetworkAreaDiagramViewer(
                document.getElementById('svg-container-nad-multibus-vlnodes')!,
                svgContent,
                NadSvgMultibusVLNodesExampleMeta,
                500,
                600,
                1000,
                1200,
                handleNodeMove,
                handleTextNodeMove,
                handleNodeSelect,
                true,
                false,
                null,
                handleToggleNadHover,
                handleSave,
                true,
                MouseMode.MOVE
            );

            document
                .getElementById('svg-container-nad-multibus-vlnodes')
                ?.setAttribute('style', 'border:2px; border-style:solid;');
        });

    fetch(NadSvgMultibusVLNodes14Example)
        .then((response) => response.text())
        .then((svgContent) => {
            new NetworkAreaDiagramViewer(
                document.getElementById('svg-container-nad-multibus-vlnodes14')!,
                svgContent,
                NadSvgMultibusVLNodes14ExampleMeta,
                500,
                600,
                1000,
                1200,
                handleNodeMove,
                handleTextNodeMove,
                handleNodeSelect,
                true,
                false,
                null,
                handleToggleNadHover,
                handleSave,
                true,
                MouseMode.MOVE
            );

            document
                .getElementById('svg-container-nad-multibus-vlnodes14')
                ?.setAttribute('style', 'border:2px; border-style:solid;');
        });

    fetch(NadSvgPstHvdcExample)
        .then((response) => response.text())
        .then((svgContent) => {
            new NetworkAreaDiagramViewer(
                document.getElementById('svg-container-nad-pst-hvdc')!,
                svgContent,
                NadSvgPstHvdcExampleMeta,
                500,
                600,
                1000,
                1200,
                handleNodeMove,
                handleTextNodeMove,
                handleNodeSelect,
                true,
                false,
                null,
                handleToggleNadHover,
                handleSave,
                true,
                MouseMode.MOVE
            );

            document
                .getElementById('svg-container-nad-pst-hvdc')
                ?.setAttribute('style', 'border:2px; border-style:solid;');
        });

    fetch(NadSvgThreeWTDanglingLineUnknownBusExample)
        .then((response) => response.text())
        .then((svgContent) => {
            new NetworkAreaDiagramViewer(
                document.getElementById('svg-container-nad-threewt-dl-ub')!,
                svgContent,
                NadSvgThreeWTDanglingLineUnknownBusExampleMeta,
                500,
                600,
                1000,
                1200,
                handleNodeMove,
                handleTextNodeMove,
                handleNodeSelect,
                true,
                false,
                null,
                handleToggleNadHover,
                handleSave,
                true,
                MouseMode.SELECT
            );

            document
                .getElementById('svg-container-nad-threewt-dl-ub')
                ?.setAttribute('style', 'border:2px; border-style:solid;');
        });

    fetch(NadSvgPartialNetworkExample)
        .then((response) => response.text())
        .then((svgContent) => {
            new NetworkAreaDiagramViewer(
                document.getElementById('svg-container-nad-partial-network')!,
                svgContent,
                NadSvgPartialNetworkExampleMeta,
                500,
                600,
                1000,
                1200,
                handleNodeMove,
                handleTextNodeMove,
                handleNodeSelect,
                true,
                true,
                null,
                handleToggleNadHover,
                handleSave,
                false,
                MouseMode.MOVE
            );

            document
                .getElementById('svg-container-nad-partial-network')
                ?.setAttribute('style', 'border:2px; border-style:solid;');
        });
};

export const addSldToDemo = () => {
    fetch(SldSvgExample)
        .then((response) => response.text())
        .then((svgContent) => {
            new SingleLineDiagramViewer(
                document.getElementById('svg-container-sld')!,
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
                // @ts-expect-error: TODO look if null is really possible in code
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
                document.getElementById('svg-container-sld-with-callbacks')!,
                svgContent, //svg content
                // @ts-expect-error: incomplete data in example json
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
                handleToggleSldHover //hovers on equipments callback
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
                document.getElementById('svg-container-sldsub-with-callbacks')!,
                svgContent, //svg content
                // @ts-expect-error: incomplete data in example json
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
                handleToggleSldHover //hovers on equipments callback
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
        element?.id;
    console.log(msg);
};

const handleFeeder: OnFeederCallbackType = (id, feederType, svgId, x, y) => {
    const msg =
        'Clicked on feeder: ' + id + ', feeder type: ' + feederType + ', svgId: ' + svgId + 'x: ' + x + ', y: ' + y;
    console.log(msg);
};

const handleBus: OnBusCallbackType = (id, svgId, x, y) => {
    const msg = 'Clicked on bus: ' + id + ', svgId: ' + svgId + 'x: ' + x + ', y: ' + y;
    console.log(msg);
};

const handleToggleSldHover: OnToggleSldHoverCallbackType = (hovered, anchorEl, equipmentId, equipmentType) => {
    if (hovered) {
        const msg = 'Hovers on equipment: ' + equipmentId + ', equipmentType: ' + equipmentType;
        console.log(msg);
    }
};

const handleNodeMove: OnMoveNodeCallbackType = (equipmentId, nodeId, x, y, xOrig, yOrig) => {
    const msg =
        'Node ' +
        nodeId +
        ' equipment ' +
        equipmentId +
        ' moved from [' +
        xOrig +
        ', ' +
        yOrig +
        '] to [' +
        x +
        ', ' +
        y +
        ']';
    console.log(msg);
};

const handleTextNodeMove: OnMoveTextNodeCallbackType = (
    equipmentId,
    nodeId,
    textNodeId,
    shiftX,
    shiftY,
    shiftXOrig,
    shiftYOrig,
    connectionShiftX,
    connectionShiftY,
    connectionShiftXOrig,
    connectionShiftYOrig
) => {
    const msg =
        'TextNode ' +
        textNodeId +
        ' Node ' +
        nodeId +
        ' equipment ' +
        equipmentId +
        ' position shift changed from [' +
        shiftXOrig +
        ', ' +
        shiftYOrig +
        '] to [' +
        shiftX +
        ', ' +
        shiftY +
        '] connection shift changed from [' +
        connectionShiftXOrig +
        ', ' +
        connectionShiftYOrig +
        '] to [' +
        connectionShiftX +
        ', ' +
        connectionShiftY +
        ']';
    console.log(msg);
};

const handleNodeSelect: OnSelectNodeCallbackType = (equipmentId, nodeId) => {
    const msg = 'Node ' + nodeId + ' equipment ' + equipmentId + ' selected';
    console.log(msg);
};

const handleToggleNadHover: OnToggleNadHoverCallbackType = (hovered, mousePosition, equipmentId, equipmentType) => {
    if (hovered) {
        const msg =
            'Hovers on equipment: ' +
            equipmentId +
            ', equipmentType: ' +
            equipmentType +
            ', mousePosition : x =' +
            mousePosition?.x +
            ', y=' +
            mousePosition?.y;
        console.log(msg);
    }
};

const handleSave: OnSaveCallbackType = (svg, metadata) => {
    console.log(svg);
    console.log(metadata);
};
