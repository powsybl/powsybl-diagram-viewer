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

export enum LineLoadingZone {
    UNKNOWN = 0,
    SAFE = 1,
    WARNING = 2,
    OVERLOAD = 3,
}

export function getLineLoadingZone(
    line: Line,
    lineFlowAlertThreshold: number
): number;

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
