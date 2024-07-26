import { Line, LonLat } from '../utils/equipment-types';
import { Color, CompositeLayer, CompositeLayerProps, Layer, LayerContext, Position, UpdateParameters } from '@deck.gl/core';
import { GeoData } from './geo-data';
import { Arrow } from './layers/arrow-layer';
import { MapEquipments } from './map-equipments';

export declare enum LineFlowMode {
    STATIC_ARROWS = "staticArrows",
    ANIMATED_ARROWS = "animatedArrows",
    FEEDERS = "feeders"
}
export declare enum LineFlowColorMode {
    NOMINAL_VOLTAGE = "nominalVoltage",
    OVERLOADS = "overloads"
}
export declare enum LineLoadingZone {
    UNKNOWN = 0,
    SAFE = 1,
    WARNING = 2,
    OVERLOAD = 3
}
export declare function getLineLoadingZoneOfSide(limit: number | undefined, intensity: number | undefined, lineFlowAlertThreshold: number): LineLoadingZone;
export declare function getLineLoadingZone(line: Line, lineFlowAlertThreshold: number): number;
export declare const ArrowSpeed: {
    STOPPED: number;
    SLOW: number;
    MEDIUM: number;
    FAST: number;
    CRAZY: number;
};
type LineConnection = {
    terminal1Connected: boolean;
    terminal2Connected: boolean;
};
export declare enum LineStatus {
    PLANNED_OUTAGE = "PLANNED_OUTAGE",
    FORCED_OUTAGE = "FORCED_OUTAGE",
    IN_OPERATION = "IN_OPERATION"
}
type LinesStatus = {
    operatingStatus: LineStatus;
};
type CompositeDataLine = {
    nominalV: number;
    lines: Line[];
    arrows: Arrow[];
    positions: LonLat[];
    cumulativeDistances: number[];
};
type ActivePower = {
    p: number | undefined;
    printPosition: Position;
    offset: [number, number];
    line: Line;
};
type OperatingStatus = {
    status: LineStatus;
    printPosition: Position;
    offset: [number, number];
};
export type CompositeData = {
    nominalV: number;
    mapOriginDestination?: Map<string, Set<Line>>;
    lines: Line[];
    lineMap?: Map<string, CompositeDataLine>;
    activePower: ActivePower[];
    operatingStatus: OperatingStatus[];
    arrows: Arrow[];
};
type _LineLayerProps = {
    data: Line[];
    network: MapEquipments;
    geoData: GeoData;
    getNominalVoltageColor: (voltage: number) => Color;
    disconnectedLineColor: Color;
    filteredNominalVoltages: number[] | null;
    lineFlowMode: LineFlowMode;
    lineFlowColorMode: LineFlowColorMode;
    lineFlowAlertThreshold: number;
    showLineFlow: boolean;
    lineFullPath: boolean;
    lineParallelPath: boolean;
    labelSize: number;
    iconSize: number;
    distanceBetweenLines: number;
    maxParallelOffset: number;
    minParallelOffset: number;
    substationRadius: number;
    substationMaxPixel: number;
    minSubstationRadiusPixel: number;
    areFlowsValid: boolean;
    updatedLines: Line[];
    labelsVisible: boolean;
    labelColor: Color;
};
export type LineLayerProps = _LineLayerProps & CompositeLayerProps;
export declare class LineLayer extends CompositeLayer<Required<_LineLayerProps>> {
    static layerName: string;
    static defaultProps: {
        network: null;
        geoData: null;
        getNominalVoltageColor: {
            type: string;
            value: number[];
        };
        disconnectedLineColor: {
            type: string;
            value: number[];
        };
        filteredNominalVoltages: null;
        lineFlowMode: LineFlowMode;
        lineFlowColorMode: LineFlowColorMode;
        lineFlowAlertThreshold: number;
        showLineFlow: boolean;
        lineFullPath: boolean;
        lineParallelPath: boolean;
        labelSize: number;
        iconSize: number;
        distanceBetweenLines: number;
        maxParallelOffset: number;
        minParallelOffset: number;
        substationRadius: {
            type: string;
            value: number;
        };
        substationMaxPixel: {
            type: string;
            value: number;
        };
        minSubstationRadiusPixel: {
            type: string;
            value: number;
        };
    };
    state: {
        compositeData: CompositeData[];
        linesConnection: Map<string, LineConnection>;
        linesStatus: Map<string, LinesStatus>;
    };
    initializeState(context: LayerContext): void;
    getVoltageLevelIndex(voltageLevelId: string): number | undefined;
    updateState({ props, oldProps, changeFlags }: UpdateParameters<this>): void;
    genLineKey(line: Line): string;
    recomputeParallelLinesIndex(compositeData: CompositeData[], props: this['props']): void;
    recomputeForkLines(compositeData: CompositeData[], props: this['props']): void;
    getProximityFactor(firstPosition: LonLat, secondPosition: LonLat): number;
    computeAngle(props: this['props'], position1: LonLat, position2: LonLat): number;
    renderLayers(): Layer<{}>[];
}
export {};
