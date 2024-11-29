/**
 * Copyright (c) 2023, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { LineStatus } from '../network/line-layer';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type MergeObject<T1, T2> = {
    [K in keyof T1 & keyof T2]: T1[K] | T2[K]; // Keys that are in both objects
} & {
    [K in Exclude<keyof T1, keyof T2>]?: T1[K]; // Keys that are only in T1
} & {
    [K in Exclude<keyof T2, keyof T1>]?: T2[K]; // Keys that are only in T2
};

export enum EQUIPMENT_TYPES {
    SUBSTATION = 'SUBSTATION',
    VOLTAGE_LEVEL = 'VOLTAGE_LEVEL',
    LINE = 'LINE',
    TWO_WINDINGS_TRANSFORMER = 'TWO_WINDINGS_TRANSFORMER',
    THREE_WINDINGS_TRANSFORMER = 'THREE_WINDINGS_TRANSFORMER',
    HVDC_LINE = 'HVDC_LINE',
    GENERATOR = 'GENERATOR',
    BATTERY = 'BATTERY',
    LOAD = 'LOAD',
    SHUNT_COMPENSATOR = 'SHUNT_COMPENSATOR',
    TIE_LINE = 'TIE_LINE',
    DANGLING_LINE = 'DANGLING_LINE',
    STATIC_VAR_COMPENSATOR = 'STATIC_VAR_COMPENSATOR',
    HVDC_CONVERTER_STATION = 'HVDC_CONVERTER_STATION',
    VSC_CONVERTER_STATION = 'VSC_CONVERTER_STATION',
    LCC_CONVERTER_STATION = 'LCC_CONVERTER_STATION',
    SWITCH = 'SWITCH',
}

export type LonLat = [number, number];

// deduce from data of .../gridstudy/api/gateway/study/v1/studies/{uuid}/nodes/{uuid}}/network/elements?inUpstreamBuiltParentNode=false&infoType=MAP&elementType=SUBSTATION
export type MapVoltageLevel = {
    id: string;
    nominalV: number;
    substationId: string;
    substationName?: string; // injected internally?
};

export const isMapVoltageLevel = (object: Record<string, unknown>): object is MapVoltageLevel =>
    'substationId' in object;

// deduce from data of .../gridstudy/api/gateway/study/v1/studies/{uuid}/nodes/{uuid}}/network/elements?inUpstreamBuiltParentNode=false&infoType=MAP&elementType=SUBSTATION
export type MapSubstation = {
    id: string;
    name?: string;
    voltageLevels: MapVoltageLevel[];
};

export const isMapSubstation = (object: Record<string, unknown>): object is MapSubstation => 'voltageLevels' in object;

export type TemporaryLimits = {
    name: string;
    value: number;
};
export type CurrentLimits = {
    permanentLimit: number;
    temporaryLimits?: TemporaryLimits[];
};

// deduce from data of .../gridstudy/api/gateway/study/v1/studies/{uuid}/nodes/{uuid}}/network/elements?inUpstreamBuiltParentNode=false&infoType=MAP&elementType=LINE
export type MapLine = {
    id: string;
    voltageLevelId1: string;
    voltageLevelId2: string;
    name?: string;
    terminal1Connected: boolean;
    terminal2Connected: boolean;
    p1: number;
    p2: number;
    i1?: number;
    i2?: number;
    operatingStatus?: LineStatus;
    currentLimits1?: CurrentLimits;
    currentLimits2?: CurrentLimits;
};

export const isMapLine = (object: Record<string, unknown>): object is MapLine =>
    'id' in object && 'voltageLevelId1' in object && 'voltageLevelId2' in object;

// deduce from data of .../gridstudy/api/gateway/study/v1/studies/{uuid}/nodes/{uuid}}/network/elements?inUpstreamBuiltParentNode=false&infoType=MAP&elementType=TIE_LINE
export type MapTieLine = {
    id: string;
    voltageLevelId1: string;
    voltageLevelId2: string;
    terminal1Connected: boolean;
    terminal2Connected: boolean;
    currentLimits1: CurrentLimits;
    currentLimits2: CurrentLimits;
    // not used but is provided by gridstudy
    p1?: number;
    p2?: number;
    i1?: number;
    i2?: number;
    operatingStatus?: LineStatus;
};

// deduce from data of .../gridstudy/api/gateway/study/v1/studies/{uuid}/nodes/{uuid}}/network/elements?inUpstreamBuiltParentNode=false&infoType=MAP&elementType=HVDC_LINE
export type MapHvdcLine = {
    id: string;
    voltageLevelId1: string;
    voltageLevelId2: string;
    terminal1Connected: boolean;
    terminal2Connected: boolean;
    p1: number;
    p2: number;
    hvdcType: string;

    // add those entries for facilitate union usage
    currentLimits1?: CurrentLimits;
    currentLimits2?: CurrentLimits;
    i1?: number;
    i2?: number;
    operatingStatus?: LineStatus;
};

export type MapAnyLine = MapLine | MapTieLine | MapHvdcLine;
//export type MapAnyLine = MergeObject<MergeObject<MapLine, MapTieLine>, MapHvdcLine>;
export type MapEquipment = MapVoltageLevel | MapSubstation | MapAnyLine;

export type MapLineWithType = MapLine & { equipmentType: EQUIPMENT_TYPES.LINE };
export type MapTieLineWithType = MapTieLine & { equipmentType: EQUIPMENT_TYPES.TIE_LINE };
export type MapHvdcLineWithType = MapHvdcLine & { equipmentType: EQUIPMENT_TYPES.HVDC_LINE };
//export type MapAnyLineWithType = MergeObject<MergeObject<MapLineWithType, MapTieLineWithType>, MapHvdcLineWithType> & {
export type MapAnyLineWithType = (MapLineWithType | MapTieLineWithType | MapHvdcLineWithType) & {
    // additional properties from line-layer
    origin?: LonLat;
    end?: LonLat;
    substationIndexStart?: number;
    substationIndexEnd?: number;
    angle?: number;
    angleStart?: number;
    angleEnd?: number;
    proximityFactorStart?: number;
    proximityFactorEnd?: number;
    parallelIndex?: number;
    cumulativeDistances?: number[];
    positions?: LonLat[];
};
