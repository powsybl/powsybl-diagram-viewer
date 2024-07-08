/**
 * Copyright (c) 2023, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { LineStatus } from '../network/line-layer';

export const EQUIPMENT_INFOS_TYPES = {
    LIST: { type: 'LIST' },
    MAP: { type: 'MAP' },
    FORM: { type: 'FORM' },
    TAB: { type: 'TAB' },
    TOOLTIP: { type: 'TOOLTIP' },
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

export type VoltageLevel = {
    id: string;
    nominalV: number;
    substationId: string;
    substationName: string;
};

export type Substation = {
    id: string;
    name: string;
    voltageLevels: VoltageLevel[];
};

export type Line = {
    id: string;
    voltageLevelId1: string;
    voltageLevelId2: string;
    name: string;
    terminal1Connected: boolean;
    terminal2Connected: boolean;
    p1: number;
    p2: number;
    i1: number | undefined;
    i2: number | undefined;
    operatingStatus: LineStatus;
    currentLimits1: {
        permanentLimit: number;
    } | null;
    currentLimits2: {
        permanentLimit: number;
    } | null;
    // additionnal from line-layer
    origin: LonLat | undefined;
    end: LonLat | undefined;
    substationIndexStart: number | undefined;
    substationIndexEnd: number | undefined;
    angle: number | undefined;
    angleStart: number | undefined;
    angleEnd: number | undefined;
    proximityFactorStart: number | undefined;
    proximityFactorEnd: number | undefined;
    parallelIndex: number;
    cumulativeDistances: number[];
    positions: LonLat[];
};

export type TieLine = {
    id: string;
};

export enum ConvertersMode {
    SIDE_1_RECTIFIER_SIDE_2_INVERTER,
    SIDE_1_INVERTER_SIDE_2_RECTIFIER,
}

export type HvdcLine = {
    id: string;
    convertersMode: ConvertersMode;
    r: number;
    nominalV: number;
    activePowerSetpoint: number;
    maxP: number;
};

export type Equiment = Line | Substation | TieLine | HvdcLine;

// type EquimentLineTypes = EQUIPMENT_TYPES.LINE | EQUIPMENT_TYPES.TIE_LINE | EQUIPMENT_TYPES.HVDC_LINE;
export type LineEquimentLine = Line & { equipmentType: EQUIPMENT_TYPES.LINE };
export type TieLineEquimentLine = TieLine & {
    equipmentType: EQUIPMENT_TYPES.TIE_LINE;
};
export type HvdcLineEquimentLine = HvdcLine & {
    equipmentType: EQUIPMENT_TYPES.HVDC_LINE;
};
export type EquimentLine =
    | LineEquimentLine
    | TieLineEquimentLine
    | HvdcLineEquimentLine;
