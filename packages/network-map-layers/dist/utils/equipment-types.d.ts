import { LineStatus } from '../network/line-layer';

export declare const EQUIPMENT_INFOS_TYPES: {
    LIST: {
        type: string;
    };
    MAP: {
        type: string;
    };
    FORM: {
        type: string;
    };
    TAB: {
        type: string;
    };
    TOOLTIP: {
        type: string;
    };
};
export declare enum EQUIPMENT_TYPES {
    SUBSTATION = "SUBSTATION",
    VOLTAGE_LEVEL = "VOLTAGE_LEVEL",
    LINE = "LINE",
    TWO_WINDINGS_TRANSFORMER = "TWO_WINDINGS_TRANSFORMER",
    THREE_WINDINGS_TRANSFORMER = "THREE_WINDINGS_TRANSFORMER",
    HVDC_LINE = "HVDC_LINE",
    GENERATOR = "GENERATOR",
    BATTERY = "BATTERY",
    LOAD = "LOAD",
    SHUNT_COMPENSATOR = "SHUNT_COMPENSATOR",
    TIE_LINE = "TIE_LINE",
    DANGLING_LINE = "DANGLING_LINE",
    STATIC_VAR_COMPENSATOR = "STATIC_VAR_COMPENSATOR",
    HVDC_CONVERTER_STATION = "HVDC_CONVERTER_STATION",
    VSC_CONVERTER_STATION = "VSC_CONVERTER_STATION",
    LCC_CONVERTER_STATION = "LCC_CONVERTER_STATION",
    SWITCH = "SWITCH"
}
export type LonLat = [number, number];
export type VoltageLevel = {
    id: string;
    nominalV: number;
    substationId: string;
    substationName?: string;
};
export type Substation = {
    id: string;
    name: string;
    voltageLevels: VoltageLevel[];
};
export declare const isVoltageLevel: (object: Record<string, unknown>) => object is VoltageLevel;
export declare const isSubstation: (object: Record<string, unknown>) => object is Substation;
export type Line = {
    id: string;
    voltageLevelId1: string;
    voltageLevelId2: string;
    name: string;
    terminal1Connected: boolean;
    terminal2Connected: boolean;
    p1: number;
    p2: number;
    i1?: number;
    i2?: number;
    operatingStatus?: LineStatus;
    currentLimits1?: {
        permanentLimit: number;
    } | null;
    currentLimits2?: {
        permanentLimit: number;
    } | null;
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
export declare const isLine: (object: Record<string, unknown>) => object is Line;
export type TieLine = {
    id: string;
};
export declare enum ConvertersMode {
    SIDE_1_RECTIFIER_SIDE_2_INVERTER = 0,
    SIDE_1_INVERTER_SIDE_2_RECTIFIER = 1
}
export type HvdcLine = {
    id: string;
    convertersMode: ConvertersMode;
    r: number;
    nominalV: number;
    activePowerSetpoint: number;
    maxP: number;
};
export type Equipment = Line | Substation | TieLine | HvdcLine;
export type LineEquimentLine = Line & {
    equipmentType: EQUIPMENT_TYPES.LINE;
};
export type TieLineEquimentLine = Line & {
    equipmentType: EQUIPMENT_TYPES.TIE_LINE;
};
export type HvdcLineEquimentLine = Line & {
    equipmentType: EQUIPMENT_TYPES.HVDC_LINE;
};
export type EquimentLine = LineEquimentLine | TieLineEquimentLine | HvdcLineEquimentLine;
