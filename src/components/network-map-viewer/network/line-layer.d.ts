/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Line } from './map-equipments';
import { Color, CompositeLayer, CompositeLayerProps } from 'deck.gl';
import { GeoData } from './geo-data';

export enum LineFlowMode {
    STATIC_ARROWS = 'staticArrows',
    ANIMATED_ARROWS = 'animatedArrows',
    FEEDERS = 'feeders',
}

export enum LineFlowColorMode {
    NOMINAL_VOLTAGE = 'nominalVoltage',
    OVERLOADS = 'overloads',
}

type _LineLayerProps = {
    network?: unknown | null;
    geoData?: GeoData | null;
    getNominalVoltageColor?: Color;
    disconnectedLineColor?: Color;
    filteredNominalVoltages?: unknown | null;
    lineFlowMode?: LineFlowMode;
    lineFlowColorMode?: LineFlowColorMode;
    lineFlowAlertThreshold?: number;
    showLineFlow?: boolean;
    lineFullPath?: boolean;
    lineParallelPath?: boolean;
    labelSize?: number;
    iconSize?: number;
    distanceBetweenLines?: number;
    maxParallelOffset?: number;
    minParallelOffset?: number;
    substationRadius?: number;
    substationMaxPixel?: number;
    minSubstationRadiusPixel?: number;
    updatedLines: Line[];
};
export type LineLayerProps = _LineLayerProps & CompositeLayerProps;

export class LineLayer extends CompositeLayer<Required<_LineLayerProps>> {}
