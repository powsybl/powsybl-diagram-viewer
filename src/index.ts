/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export {
    NetworkAreaDiagramViewer,
    type OnMoveNodeCallbackType,
    type OnMoveTextNodeCallbackType,
    type OnSelectNodeCallbackType,
    type OnToggleNadHoverCallbackType,
} from './components/network-area-diagram-viewer/network-area-diagram-viewer';
export type {
    BusNodeMetadata,
    DiagramMetadata,
    EdgeMetadata,
    LayoutParametersMetadata,
    NodeMetadata,
    SvgParametersMetadata,
    TextNodeMetadata,
} from './components/network-area-diagram-viewer/diagram-metadata';
export {
    type CSS_DECLARATION,
    type CSS_RULE,
    THRESHOLD_STATUS,
} from './components/network-area-diagram-viewer/dynamic-css-utils';

export {
    SingleLineDiagramViewer,
    type OnBreakerCallbackType,
    type OnBusCallbackType,
    type OnFeederCallbackType,
    type OnNextVoltageCallbackType,
    type OnToggleSldHoverCallbackType,
    type SLDMetadata,
    type SLDMetadataComponent,
    type SLDMetadataComponentSize,
    type SLDMetadataNode,
} from './components/single-line-diagram-viewer/single-line-diagram-viewer';

export { GeoData } from './components/network-map-viewer/network/geo-data';
export { LineFlowMode, LineFlowColorMode } from './components/network-map-viewer/network/line-layer';
export { MapEquipments } from './components/network-map-viewer/network/map-equipments';
export {
    default as NetworkMap,
    DRAW_EVENT,
    type NetworkMapRef,
} from './components/network-map-viewer/network/network-map';
export { DRAW_MODES } from './components/network-map-viewer/network/draw-control';

export {
    EQUIPMENT_TYPES,
    type LonLat,
    type MapAnyLine,
    type MapAnyLineWithType,
    type MapEquipment,
    type MapHvdcLine,
    type MapHvdcLineWithType,
    type MapLine,
    type MapLineWithType,
    type MapSubstation,
    type MapTieLine,
    type MapTieLineWithType,
    type MapVoltageLevel,
} from './equipment-types';
export { type Coordinate, Country } from './powsybl';
