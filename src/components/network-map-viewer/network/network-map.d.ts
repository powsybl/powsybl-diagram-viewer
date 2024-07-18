/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {
    ForwardRefExoticComponent,
    PropsWithoutRef,
    ReactNode,
    RefAttributes,
    RefObject,
} from 'react';
import { GeoData } from './geo-data';
import {
    Equipment,
    Line,
    MapEquipments,
    Substation,
    VoltageLevel,
} from './map-equipments';
import { LineFlowColorMode, LineFlowMode, LineLayerProps } from './line-layer';
import { DrawControlProps } from './draw-control';
import { Feature } from 'geojson';
import { ButtonProps } from '@mui/material';
import MapboxDraw from '@mapbox/mapbox-gl-draw';

export enum DRAW_EVENT {
    CREATE = 1,
    UPDATE = 2,
    DELETE = 0,
}

export type MenuClickFunction<T extends Equipment> = (
    equipment: T,
    eventX: number,
    eventY: number
) => void;

type NetworkMapProps = {
    disabled?: boolean;
    geoData?: GeoData | null;
    mapBoxToken?: string | null;
    mapEquipments?: MapEquipments | null;
    mapLibrary?: 'carto' | 'cartonolabel' | 'mapbox';
    mapTheme?: 'light' | 'dark';
    areFlowsValid?: boolean;
    arrowsZoomThreshold?: number;
    centerOnSubstation?: unknown | null;
    displayOverlayLoader?: boolean;
    filteredNominalVoltages?: unknown[] | null;
    initialPosition?: [number, number];
    initialZoom?: number;
    isManualRefreshBackdropDisplayed?: boolean;
    labelsZoomThreshold?: number;
    lineFlowAlertThreshold?: number;
    lineFlowColorMode?: LineFlowColorMode;
    lineFlowHidden?: boolean;
    lineFlowMode?: LineFlowMode;
    lineFullPath?: boolean;
    lineParallelPath?: boolean;
    renderPopover?: (
        equipmentId: string,
        divRef: RefObject<HTMLDivElement>
    ) => ReactNode;
    tooltipZoomThreshold?: number;
    // With mapboxgl v2 (not a problem with maplibre), we need to call
    // map.resize() when the parent size has changed, otherwise the map is not
    // redrawn. It seems like this is autodetected when the browser window is
    // resized, but not for programmatic resizes of the parent. For now in our
    // app, only study display mode resizes programmatically
    // use this prop to make the map resize when needed, each time this prop changes, map.resize() is trigged
    triggerMapResizeOnChange?: unknown;
    updatedLines?: LineLayerProps['updatedLines'];
    useName?: boolean;
    visible?: boolean;
    shouldDisableToolTip?: boolean;
    onHvdcLineMenuClick?: MenuClickFunction<Line>;
    onLineMenuClick?: MenuClickFunction<Line>;
    onTieLineMenuClick?: MenuClickFunction<Line>;
    onManualRefreshClick?: ButtonProps['onClick'];
    onSubstationClick?: (idVoltageLevel: string) => void;
    onSubstationClickChooseVoltageLevel?: (
        idSubstation: string,
        eventX: number,
        eventY: number
    ) => void;
    onSubstationMenuClick?: MenuClickFunction<Substation>;
    onVoltageLevelMenuClick?: MenuClickFunction<VoltageLevel>;
    onDrawPolygonModeActive?: DrawControlProps['onDrawPolygonModeActive'];
    onPolygonChanged?: (polygoneFeature: Feature) => void;
    onDrawEvent?: (drawEvent: DRAW_EVENT) => void;
};

export type NetworkMapRef = {
    getSelectedSubstations: () => Substation[];
    getSelectedLines: () => Line[];
    cleanDraw: () => void;
    getMapDrawer: () => MapboxDraw | undefined;
};

const NetworkMap: ForwardRefExoticComponent<
    PropsWithoutRef<NetworkMapProps> & RefAttributes<NetworkMapRef>
>;
export default NetworkMap;
