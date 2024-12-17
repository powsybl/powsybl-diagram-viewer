/**
 * Copyright (c) 2020, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type { LiteralUnion } from 'type-fest';
import {
    type Color,
    CompositeLayer,
    type CompositeLayerProps,
    IconLayer,
    type IconLayerProps,
    type Layer,
    type PickingInfo,
    type Position,
    TextLayer,
    type TextLayerProps,
    type UpdateParameters,
} from 'deck.gl';
import type { DefaultProps } from '@deck.gl/core';
import PadlockIcon from '../images/lock_black_24dp.svg?url';
import BoltIcon from '../images/bolt_black_24dp.svg?url';
import { PathStyleExtension } from '@deck.gl/extensions';
import { type GeoData } from './geo-data';
import { MapEquipments } from './map-equipments';
import { type LonLat, type MapAnyLine, type MapAnyLineWithType } from '../../../equipment-types';
import { type Arrow, ArrowDirection, ArrowLayer, type ArrowLayerProps } from './layers/arrow-layer';
import ParallelPathLayer, { type ParallelPathLayerProps } from './layers/parallel-path-layer';
import ForkLineLayer, { type ForkLineLayerProps } from './layers/fork-line-layer';
import { getDistance } from 'geolib';
import { SUBSTATION_RADIUS, SUBSTATION_RADIUS_MAX_PIXEL, SUBSTATION_RADIUS_MIN_PIXEL } from './constants';
import { INVALID_FLOW_OPACITY } from '../../../utils/colors';

// isn't exported in @deck.gl/layers lib
type UnpackedIcon = Exclude<ReturnType<NonNullable<IconLayerProps['getIcon']>>, string>;

//Constants for Feeders mode
const DISTANCE_BETWEEN_ARROWS = 10000.0;
const START_ARROW_POSITION = 0.1;
const END_ARROW_POSITION = 0.9;

export enum LineFlowMode {
    STATIC_ARROWS = 'staticArrows',
    ANIMATED_ARROWS = 'animatedArrows',
    FEEDERS = 'feeders',
}

export enum LineFlowColorMode {
    NOMINAL_VOLTAGE = 'nominalVoltage',
    OVERLOADS = 'overloads',
}

const noDashArray = [0, 0] as const;
const dashArray = [15, 10] as const;

function doDash(lineConnection: LineConnection) {
    return !lineConnection.terminal1Connected || !lineConnection.terminal2Connected;
}

function getArrowDirection(p: number = 0) {
    if (p < 0) {
        return ArrowDirection.FROM_SIDE_2_TO_SIDE_1;
    } else if (p > 0) {
        return ArrowDirection.FROM_SIDE_1_TO_SIDE_2;
    } else {
        return ArrowDirection.NONE;
    }
}

export enum LineLoadingZone {
    UNKNOWN = 0,
    SAFE = 1,
    WARNING = 2,
    OVERLOAD = 3,
}

export function getLineLoadingZoneOfSide(
    limit: number | undefined,
    intensity: number | undefined,
    lineFlowAlertThreshold: number
) {
    if (limit === undefined || intensity === undefined || intensity === 0) {
        return LineLoadingZone.UNKNOWN;
    } else {
        const threshold = (lineFlowAlertThreshold * limit) / 100;
        const absoluteIntensity = Math.abs(intensity);
        if (absoluteIntensity < threshold) {
            return LineLoadingZone.SAFE;
        } else if (absoluteIntensity >= threshold && absoluteIntensity < limit) {
            return LineLoadingZone.WARNING;
        } else {
            return LineLoadingZone.OVERLOAD;
        }
    }
}

export function getLineLoadingZone(line: MapAnyLine, lineFlowAlertThreshold: number) {
    const zone1 = getLineLoadingZoneOfSide(line.currentLimits1?.permanentLimit, line.i1, lineFlowAlertThreshold);
    const zone2 = getLineLoadingZoneOfSide(line.currentLimits2?.permanentLimit, line.i2, lineFlowAlertThreshold);
    return Math.max(zone1, zone2);
}

function getLineLoadingZoneColor(zone: LineLoadingZone): Color {
    if (zone === LineLoadingZone.UNKNOWN) {
        return [128, 128, 128]; // grey
    } else if (zone === LineLoadingZone.SAFE) {
        return [107, 178, 40]; // green
    } else if (zone === LineLoadingZone.WARNING) {
        return [210, 179, 63]; // yellow
    } else if (zone === LineLoadingZone.OVERLOAD) {
        return [255, 0, 0]; // red
    } else {
        throw new Error('Unsupported line loading zone: ' + zone);
    }
}

function getLineColor(
    line: MapAnyLine,
    nominalVoltageColor: Color,
    props: LineLayerProps,
    lineConnection: LineConnection
) {
    if (props.lineFlowColorMode === LineFlowColorMode.NOMINAL_VOLTAGE) {
        if (!lineConnection.terminal1Connected && !lineConnection.terminal2Connected) {
            return props.disconnectedLineColor;
        } else {
            return nominalVoltageColor;
        }
    } else if (props.lineFlowColorMode === LineFlowColorMode.OVERLOADS) {
        // @ts-expect-error TODO: manage undefined case
        const zone = getLineLoadingZone(line, props.lineFlowAlertThreshold);
        return getLineLoadingZoneColor(zone);
    } else {
        return nominalVoltageColor;
    }
}

function getLineIcon(lineStatus: LineStatus): UnpackedIcon {
    return {
        url: lineStatus === 'PLANNED_OUTAGE' ? PadlockIcon : lineStatus === 'FORCED_OUTAGE' ? BoltIcon : '',
        height: 24,
        width: 24,
        mask: true,
    };
}

export enum ArrowSpeed {
    STOPPED = 0,
    SLOW = 1,
    MEDIUM = 2,
    FAST = 3,
    CRAZY = 4,
}

function getArrowSpeedOfSide(limit: number | undefined, intensity: number | undefined) {
    if (limit === undefined || intensity === undefined || intensity === 0) {
        return ArrowSpeed.STOPPED;
    } else {
        if (intensity > 0 && intensity < limit / 3) {
            return ArrowSpeed.SLOW;
        } else if (intensity >= limit / 3 && intensity < (limit * 2) / 3) {
            return ArrowSpeed.MEDIUM;
        } else if (intensity >= (limit * 2) / 3 && intensity < limit) {
            return ArrowSpeed.FAST;
        } else {
            // > limit
            return ArrowSpeed.CRAZY;
        }
    }
}

function getArrowSpeed(line: MapAnyLine) {
    const speed1 = getArrowSpeedOfSide(line.currentLimits1?.permanentLimit, line.i1);
    const speed2 = getArrowSpeedOfSide(line.currentLimits2?.permanentLimit, line.i2);
    return Math.max(speed1, speed2);
}

function getArrowSpeedFactor(speed: LiteralUnion<ArrowSpeed, number>) {
    switch (speed) {
        case ArrowSpeed.STOPPED:
            return 0;
        case ArrowSpeed.SLOW:
            return 0.5;
        case ArrowSpeed.MEDIUM:
            return 2;
        case ArrowSpeed.FAST:
            return 4;
        case ArrowSpeed.CRAZY:
            return 10;
        default:
            throw new Error('Unknown arrow speed: ' + speed);
    }
}

type LineConnection = {
    terminal1Connected: boolean;
    terminal2Connected: boolean;
};

export enum LineStatus {
    PLANNED_OUTAGE = 'PLANNED_OUTAGE',
    FORCED_OUTAGE = 'FORCED_OUTAGE',
    IN_OPERATION = 'IN_OPERATION',
}

type LinesStatus = {
    operatingStatus: LineStatus;
};

type CompositeDataLine = {
    nominalV: number;
    lines: MapAnyLine[];
    arrows: Arrow[];
    positions: LonLat[];
    cumulativeDistances: number[];
};

type ActivePower = {
    p: number | undefined;
    printPosition: Position;
    offset: [number, number];
    line: MapAnyLine;
};

type OperatingStatus = {
    status: LineStatus;
    printPosition: Position;
    offset: [number, number];
};

export type CompositeData = {
    nominalV: number;
    mapOriginDestination?: Map<string, Set<MapAnyLineWithType>>;
    lines: MapAnyLineWithType[];
    lineMap?: Map<string, CompositeDataLine>;
    activePower: ActivePower[];
    operatingStatus: OperatingStatus[];
    arrows: Arrow[];
};

type MinProximityFactor = {
    lines: MapAnyLineWithType[];
    start: number;
    end: number;
};

export type LinePickingInfo = Omit<PickingInfo, 'object'> & { object?: MapAnyLineWithType };

type _LineLayerProps = {
    data: MapAnyLineWithType[];
    network?: MapEquipments;
    geoData?: GeoData;
    getNominalVoltageColor?: (voltage: number) => Color;
    disconnectedLineColor?: Color;
    filteredNominalVoltages?: number[];
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
    areFlowsValid: boolean;
    updatedLines: MapAnyLineWithType[]; //TODO MapAnyLine or MapAnyLineWithType ??
    labelsVisible: boolean;
    labelColor: Color;
};
export type LineLayerProps = _LineLayerProps & CompositeLayerProps;
//    Omit<CompositeLayerProps, 'onHover'> & {
//         onHover?: ((pickingInfo: LinePickingInfo, event: MjolnirEvent) => boolean | void) | null;
//     };

export class LineLayer extends CompositeLayer<Required<_LineLayerProps>> {
    // noinspection JSUnusedGlobalSymbols -- it's dynamically get by deck.gl
    static readonly layerName = 'LineLayer';
    // noinspection JSUnusedGlobalSymbols -- it's dynamically get by deck.gl
    static readonly defaultProps: DefaultProps<LineLayerProps> = {
        network: undefined,
        geoData: undefined,
        getNominalVoltageColor: { type: 'accessor', value: () => [255, 255, 255] /*getNominalVoltageColor*/ },
        disconnectedLineColor: { type: 'color', value: [255, 255, 255] },
        filteredNominalVoltages: undefined,
        lineFlowMode: LineFlowMode.FEEDERS,
        lineFlowColorMode: LineFlowColorMode.NOMINAL_VOLTAGE,
        lineFlowAlertThreshold: 100,
        showLineFlow: true,
        lineFullPath: true,
        lineParallelPath: true,
        labelSize: 12,
        iconSize: 48,
        distanceBetweenLines: 1000,
        maxParallelOffset: 100,
        minParallelOffset: 3,
        substationRadius: { type: 'number', value: SUBSTATION_RADIUS },
        substationMaxPixel: { type: 'number', value: SUBSTATION_RADIUS_MAX_PIXEL },
        minSubstationRadiusPixel: {
            type: 'number',
            value: SUBSTATION_RADIUS_MIN_PIXEL,
        },
        labelColor: [255, 255, 255],
    };

    declare state: {
        compositeData: CompositeData[];
        linesConnection: Map<string, LineConnection>;
        linesStatus: Map<string, LinesStatus>;
    };

    initializeState(...args: Parameters<CompositeLayer<Required<_LineLayerProps>>['initializeState']>) {
        super.initializeState(...args);

        this.state = {
            compositeData: [],
            linesConnection: new Map(),
            linesStatus: new Map(),
        };
    }

    getVoltageLevelIndex(voltageLevelId: string) {
        const { network } = this.props;
        const vl = network.getVoltageLevel(voltageLevelId);
        // @ts-expect-error TODO: manage undefined case
        const substation = network.getSubstation(vl?.substationId);
        return (
            [
                ...new Set(
                    substation?.voltageLevels.map((vl) => vl.nominalV) // only one voltage level
                ),
            ]
                .sort((a, b) => {
                    return a - b; // force numerical sort
                })
                // @ts-expect-error TODO: manage undefined case
                .indexOf(vl?.nominalV) + 1
        );
    }

    //TODO this is a huge function, refactor
    updateState({ props, oldProps, changeFlags }: UpdateParameters<this>) {
        let compositeData: Partial<CompositeData>[];
        let linesConnection: Map<string, LineConnection>;
        let linesStatus: Map<string, LinesStatus>;

        if (changeFlags.dataChanged) {
            compositeData = [];

            linesConnection = new Map<string, LineConnection>();
            linesStatus = new Map<string, LinesStatus>();

            if (
                props.network != null &&
                props.network.substations &&
                props.data.length !== 0 &&
                props.geoData != null
            ) {
                // group lines by nominal voltage
                const lineNominalVoltageIndexer = (
                    map: Map<number, MapAnyLineWithType[]>,
                    line: MapAnyLineWithType
                ) => {
                    const network = props.network;
                    const vl1 = network.getVoltageLevel(line.voltageLevelId1);
                    const vl2 = network.getVoltageLevel(line.voltageLevelId2);
                    const vl = vl1 || vl2;
                    // @ts-expect-error TODO: manage undefined case
                    let list = map.get(vl?.nominalV);
                    if (!list) {
                        list = [];
                        // @ts-expect-error TODO: manage undefined case
                        map.set(vl?.nominalV, list);
                    }
                    if (vl1?.substationId !== vl2?.substationId) {
                        list.push(line);
                    }
                    return map;
                };
                const linesByNominalVoltage = props.data.reduce(
                    lineNominalVoltageIndexer,
                    new Map<number, MapAnyLineWithType[]>()
                );

                compositeData = Array.from(linesByNominalVoltage.entries())
                    .map((e) => {
                        return { nominalV: e[0], lines: e[1] };
                    })
                    .sort((a, b) => b.nominalV - a.nominalV);

                compositeData.forEach((compositeData) => {
                    //find lines with same substations set
                    const mapOriginDestination = new Map<string, Set<MapAnyLineWithType>>();
                    compositeData.mapOriginDestination = mapOriginDestination;
                    compositeData.lines?.forEach((line) => {
                        linesConnection.set(line.id, {
                            terminal1Connected: line.terminal1Connected,
                            terminal2Connected: line.terminal2Connected,
                        });

                        linesStatus.set(line.id, {
                            operatingStatus: line.operatingStatus,
                        });

                        const key = this.genLineKey(line);
                        const val = mapOriginDestination.get(key);
                        if (val == null) {
                            mapOriginDestination.set(key, new Set([line]));
                        } else {
                            mapOriginDestination.set(key, val.add(line));
                        }
                    });
                });
            }
        } else {
            compositeData = this.state.compositeData;
            linesConnection = this.state.linesConnection;
            linesStatus = this.state.linesStatus;

            if (props.updatedLines !== oldProps.updatedLines) {
                props.updatedLines.forEach((line1) => {
                    linesConnection.set(line1.id, {
                        terminal1Connected: line1.terminal1Connected,
                        terminal2Connected: line1.terminal2Connected,
                    });
                    linesStatus.set(line1.id, {
                        operatingStatus: line1.operatingStatus,
                    });
                });
            }
        }

        if (
            changeFlags.dataChanged ||
            (changeFlags.propsChanged &&
                (oldProps.lineFullPath !== props.lineFullPath ||
                    props.lineParallelPath !== oldProps.lineParallelPath ||
                    props.geoData !== oldProps.geoData))
        ) {
            this.recomputeParallelLinesIndex(compositeData as CompositeData[], props);
        }

        if (
            changeFlags.dataChanged ||
            (changeFlags.propsChanged &&
                (oldProps.lineFullPath !== props.lineFullPath || oldProps.geoData !== props.geoData))
        ) {
            compositeData.forEach((compositeData) => {
                const lineMap = new Map<string, CompositeDataLine>();
                compositeData.lines?.forEach((line) => {
                    const positions = props.geoData.getLinePositions(props.network, line, props.lineFullPath);
                    const cumulativeDistances = props.geoData.getLineDistances(positions);
                    lineMap.set(line.id, {
                        positions: positions,
                        // @ts-expect-error TODO: manage null case
                        cumulativeDistances: cumulativeDistances,
                        line: line,
                    });
                });
                compositeData.lineMap = lineMap;
            });
        }

        if (
            changeFlags.dataChanged ||
            (changeFlags.propsChanged &&
                (props.lineFullPath !== oldProps.lineFullPath ||
                    props.lineParallelPath !== oldProps.lineParallelPath ||
                    props.geoData !== oldProps.geoData))
        ) {
            this.recomputeForkLines(compositeData as CompositeData[], props);
        }

        if (
            changeFlags.dataChanged ||
            (changeFlags.propsChanged &&
                (oldProps.lineFullPath !== props.lineFullPath ||
                    props.lineParallelPath !== oldProps.lineParallelPath ||
                    props.geoData !== oldProps.geoData))
        ) {
            //add labels
            compositeData.forEach((compositeData) => {
                compositeData.activePower = [];
                compositeData.lines?.forEach((line) => {
                    const lineData = compositeData.lineMap?.get(line.id);
                    const arrowDirection = getArrowDirection(line.p1);
                    const coordinates1 = props.geoData.labelDisplayPosition(
                        // @ts-expect-error TODO: manage undefined case
                        lineData?.positions,
                        lineData?.cumulativeDistances,
                        START_ARROW_POSITION,
                        arrowDirection,
                        line.parallelIndex,
                        // @ts-expect-error TODO: manage undefined case
                        (line.angle * 180) / Math.PI,
                        // @ts-expect-error TODO: manage undefined case
                        (line.angleStart * 180) / Math.PI,
                        props.distanceBetweenLines,
                        line.proximityFactorStart
                    );
                    const coordinates2 = props.geoData.labelDisplayPosition(
                        // @ts-expect-error TODO: manage undefined case
                        lineData?.positions,
                        lineData?.cumulativeDistances,
                        END_ARROW_POSITION,
                        arrowDirection,
                        line.parallelIndex,
                        // @ts-expect-error TODO: manage undefined case
                        (line.angle * 180) / Math.PI,
                        // @ts-expect-error TODO: manage undefined case
                        (line.angleEnd * 180) / Math.PI,
                        props.distanceBetweenLines,
                        line.proximityFactorEnd
                    );
                    if (coordinates1 !== null && coordinates2 !== null) {
                        compositeData.activePower?.push({
                            line: line,
                            p: line.p1,
                            printPosition: [coordinates1.position.longitude, coordinates1.position.latitude],
                            offset: coordinates1.offset,
                        });
                        compositeData.activePower?.push({
                            line: line,
                            p: line.p2,
                            printPosition: [coordinates2.position.longitude, coordinates2.position.latitude],
                            offset: coordinates2.offset,
                        });
                    }
                });
            });
        }

        if (
            changeFlags.dataChanged ||
            (changeFlags.propsChanged &&
                (props.updatedLines !== oldProps.updatedLines ||
                    oldProps.lineFullPath !== props.lineFullPath ||
                    props.lineParallelPath !== oldProps.lineParallelPath ||
                    props.geoData !== oldProps.geoData))
        ) {
            //add icons
            compositeData.forEach((compositeData) => {
                compositeData.operatingStatus = [];
                compositeData.lines?.forEach((line) => {
                    const lineStatus = linesStatus.get(line.id);
                    if (
                        lineStatus !== undefined &&
                        lineStatus.operatingStatus !== undefined &&
                        lineStatus.operatingStatus !== 'IN_OPERATION'
                    ) {
                        const lineData = compositeData.lineMap?.get(line.id);
                        const coordinatesIcon = props.geoData.labelDisplayPosition(
                            // @ts-expect-error TODO: manage undefined case
                            lineData?.positions,
                            lineData?.cumulativeDistances,
                            0.5,
                            ArrowDirection.NONE,
                            line.parallelIndex,
                            // @ts-expect-error TODO: manage undefined case
                            (line.angle * 180) / Math.PI,
                            // @ts-expect-error TODO: manage undefined case
                            (line.angleEnd * 180) / Math.PI,
                            props.distanceBetweenLines,
                            line.proximityFactorEnd
                        );
                        if (coordinatesIcon !== null) {
                            compositeData.operatingStatus?.push({
                                status: lineStatus.operatingStatus,
                                printPosition: [coordinatesIcon.position.longitude, coordinatesIcon.position.latitude],
                                offset: coordinatesIcon.offset,
                            });
                        }
                    }
                });
            });
        }

        if (
            changeFlags.dataChanged ||
            (changeFlags.propsChanged &&
                (oldProps.lineFullPath !== props.lineFullPath ||
                    props.geoData !== oldProps.geoData ||
                    //For lineFlowMode, recompute only if mode goes to or from LineFlowMode.FEEDERS
                    //because for LineFlowMode.STATIC_ARROWS and LineFlowMode.ANIMATED_ARROWS it's the same
                    (props.lineFlowMode !== oldProps.lineFlowMode &&
                        (props.lineFlowMode === LineFlowMode.FEEDERS ||
                            oldProps.lineFlowMode === LineFlowMode.FEEDERS))))
        ) {
            // add arrows
            compositeData.forEach((compositeData) => {
                const lineMap = compositeData.lineMap;

                // create one arrow each DISTANCE_BETWEEN_ARROWS
                compositeData.arrows = compositeData.lines?.flatMap((line) => {
                    const lineData = lineMap?.get(line.id);
                    line.cumulativeDistances = lineData?.cumulativeDistances;
                    line.positions = lineData?.positions;

                    if (props.lineFlowMode === LineFlowMode.FEEDERS) {
                        //If we use Feeders Mode, we build only two arrows
                        return [
                            {
                                distance: START_ARROW_POSITION,
                                line: line,
                            },
                            {
                                distance: END_ARROW_POSITION,
                                line: line,
                            },
                        ];
                    }

                    // calculate distance between 2 substations as a raw estimate of line size
                    const directLinePositions = props.geoData.getLinePositions(props.network, line, false);
                    //TODO this doesn't need to be an approximation anymore, we have the value anyway
                    const directLineDistance = getDistance(
                        {
                            latitude: directLinePositions[0][1],
                            longitude: directLinePositions[0][0],
                        },
                        {
                            latitude: directLinePositions[1][1],
                            longitude: directLinePositions[1][0],
                        }
                    );
                    const arrowCount = Math.ceil(directLineDistance / DISTANCE_BETWEEN_ARROWS);

                    return [...new Array(arrowCount).keys()].map((index) => {
                        return {
                            distance: index / arrowCount,
                            line: line,
                        };
                    });
                });
            });
        }
        this.setState({
            compositeData: compositeData,
            linesConnection: linesConnection,
            linesStatus: linesStatus,
        });
    }

    genLineKey(line: MapAnyLine) {
        return line.voltageLevelId1 > line.voltageLevelId2
            ? line.voltageLevelId1 + '##' + line.voltageLevelId2
            : line.voltageLevelId2 + '##' + line.voltageLevelId1;
    }

    recomputeParallelLinesIndex(compositeData: CompositeData[], props: UpdateParameters<this>['props']) {
        compositeData.forEach((compositeData) => {
            const mapOriginDestination = compositeData.mapOriginDestination;
            // calculate index for line with same substation set
            // The index is a real number in a normalized unit.
            // +1 => distanceBetweenLines on side
            // -1 => distanceBetweenLines on the other side
            // 0.5 => half of distanceBetweenLines
            mapOriginDestination?.forEach((samePathLine, key) => {
                // restrict parallelIndex to -15.5, -15, .., 15, 15.5 (32 lines, half precision)
                // for 31 lines, -15, -14, .., 15
                // for 32 lines, -15.5, -14.5, ..., 14.5, 15.5
                // (needed by the parallel path shader)
                let truncatedSize = samePathLine.size;
                if (truncatedSize > 32) {
                    console.warn(
                        'Warning, more than 32 parallel lines between vls ' +
                            key +
                            '. The map will only show 32 parallel lines.'
                    );
                    truncatedSize = 32;
                }
                let index = -(truncatedSize - 1) / 2;
                samePathLine.forEach((line) => {
                    line.parallelIndex = props.lineParallelPath ? index : 0;
                    if (index < 15) {
                        index += 1;
                    }
                });
            });
        });
    }

    recomputeForkLines(compositeData: CompositeData[], props: UpdateParameters<this>['props']) {
        const mapMinProximityFactor = new Map<string, MinProximityFactor>();
        compositeData.forEach((compositeData) => {
            compositeData.lines.forEach((line) => {
                // @ts-expect-error TODO: manage undefined case
                const positions: LonLat[] = compositeData.lineMap?.get(line.id)?.positions;
                //the first and last in positions doesn't depend on lineFullPath
                line.origin = positions[0];
                line.end = positions[positions.length - 1];

                line.substationIndexStart = this.getVoltageLevelIndex(line.voltageLevelId1);
                line.substationIndexEnd = this.getVoltageLevelIndex(line.voltageLevelId2);

                line.angle = this.computeAngle(props, positions[0], positions[positions.length - 1]);
                line.angleStart = this.computeAngle(props, positions[0], positions[1]);
                line.angleEnd = this.computeAngle(
                    props,
                    positions[positions.length - 2],
                    positions[positions.length - 1]
                );
                line.proximityFactorStart = this.getProximityFactor(positions[0], positions[1]);
                line.proximityFactorEnd = this.getProximityFactor(
                    positions[positions.length - 2],
                    positions[positions.length - 1]
                );

                const key = this.genLineKey(line);
                const val = mapMinProximityFactor.get(key);
                if (val == null) {
                    mapMinProximityFactor.set(key, {
                        lines: [line],
                        start: line.proximityFactorStart,
                        end: line.proximityFactorEnd,
                    });
                } else {
                    val.lines.push(line);
                    val.start = Math.min(val.start, line.proximityFactorStart);
                    val.end = Math.min(val.end, line.proximityFactorEnd);
                    mapMinProximityFactor.set(key, val);
                }
            });
        });
        mapMinProximityFactor.forEach((samePathLine) =>
            samePathLine.lines.forEach((line) => {
                line.proximityFactorStart = samePathLine.start;
                line.proximityFactorEnd = samePathLine.end;
            })
        );
    }

    getProximityFactor(firstPosition: LonLat, secondPosition: LonLat) {
        let factor = getDistance(firstPosition, secondPosition) / (3 * this.props.distanceBetweenLines);
        if (factor > 1) {
            factor = 1;
        }
        return factor;
    }

    computeAngle(props: UpdateParameters<this>['props'], position1: LonLat, position2: LonLat) {
        let angle = props.geoData.getMapAngle(position1, position2);
        angle = (angle * Math.PI) / 180 + Math.PI;
        if (angle < 0) {
            angle += 2 * Math.PI;
        }
        return angle;
    }

    renderLayers() {
        const layers: Layer[] = [];

        const linePathUpdateTriggers = [
            this.props.lineFullPath,
            this.props.geoData.linePositionsById,
            this.props.network.lines,
        ];

        // lines : create one layer per nominal voltage, starting from higher to lower nominal voltage
        this.state.compositeData.forEach((compositeData) => {
            const nominalVoltageColor = this.props.getNominalVoltageColor(compositeData.nominalV);
            const lineLayer = new ParallelPathLayer<MapAnyLineWithType>(
                this.getSubLayerProps({
                    id: 'LineNominalVoltage' + compositeData.nominalV,
                    data: compositeData.lines,
                    widthScale: 20,
                    widthMinPixels: 1,
                    widthMaxPixels: 2,
                    getPath: (line) =>
                        this.props.geoData.getLinePositions(this.props.network, line, this.props.lineFullPath),
                    // @ts-expect-error TODO: manage undefined case
                    getColor: (line) =>
                        // @ts-expect-error TODO: manage undefined case
                        getLineColor(line, nominalVoltageColor, this.props, this.state.linesConnection.get(line.id)),
                    getWidth: 2,
                    // @ts-expect-error TODO: manage undefined case
                    getLineParallelIndex: (line) => line.parallelIndex,
                    getExtraAttributes: (line: MapAnyLineWithType) => [
                        line.angleStart,
                        line.angle,
                        line.angleEnd,
                        // @ts-expect-error TODO: manage undefined case
                        line.parallelIndex * 2 +
                            31 +
                            // @ts-expect-error TODO: manage undefined case
                            64 * (Math.ceil(line.proximityFactorStart * 512) - 1) +
                            // @ts-expect-error TODO: manage undefined case
                            64 * 512 * (Math.ceil(line.proximityFactorEnd * 512) - 1),
                    ],
                    distanceBetweenLines: this.props.distanceBetweenLines,
                    maxParallelOffset: this.props.maxParallelOffset,
                    minParallelOffset: this.props.minParallelOffset,
                    visible:
                        !this.props.filteredNominalVoltages ||
                        this.props.filteredNominalVoltages.includes(compositeData.nominalV),
                    updateTriggers: {
                        getPath: linePathUpdateTriggers,
                        getExtraAttributes: [this.props.lineParallelPath, linePathUpdateTriggers],
                        getColor: [
                            this.props.disconnectedLineColor,
                            this.props.lineFlowColorMode,
                            this.props.lineFlowAlertThreshold,
                            this.props.updatedLines,
                        ],
                        getDashArray: [this.props.updatedLines],
                    },
                    getDashArray: (line: MapAnyLineWithType) =>
                        // @ts-expect-error TODO: manage undefined case
                        doDash(this.state.linesConnection.get(line.id)) ? dashArray : noDashArray,
                    extensions: [new PathStyleExtension({ dash: true })],
                } satisfies ParallelPathLayerProps<MapAnyLineWithType>)
            );
            layers.push(lineLayer);

            const arrowLayer = new ArrowLayer(
                this.getSubLayerProps(
                    {
                        id: 'ArrowNominalVoltage' + compositeData.nominalV,
                        data: compositeData.arrows,
                        sizeMinPixels: 3,
                        sizeMaxPixels: 7,
                        getDistance: (arrow) => arrow.distance,
                        getLine: (arrow) => arrow.line,
                        getLinePositions: (line) =>
                            this.props.geoData.getLinePositions(this.props.network, line, this.props.lineFullPath),
                        // @ts-expect-error TODO: manage undefined case
                        getColor: (arrow) =>
                            getLineColor(
                                arrow.line,
                                nominalVoltageColor,
                                this.props,
                                // @ts-expect-error TODO: manage undefined case
                                this.state.linesConnection.get(arrow.line.id)
                            ),
                        getSize: 700,
                        getSpeedFactor: (arrow) => getArrowSpeedFactor(getArrowSpeed(arrow.line)),
                        // @ts-expect-error TODO: manage undefined case
                        getLineParallelIndex: (arrow: Arrow) => arrow.line.parallelIndex,
                        // @ts-expect-error TODO: manage undefined case
                        getLineAngles: (arrow) => [arrow.line.angleStart, arrow.line.angle, arrow.line.angleEnd],
                        getProximityFactors: (arrow: Arrow) => [
                            arrow.line.proximityFactorStart,
                            arrow.line.proximityFactorEnd,
                        ],
                        getDistanceBetweenLines: this.props.distanceBetweenLines,
                        maxParallelOffset: this.props.maxParallelOffset,
                        minParallelOffset: this.props.minParallelOffset,
                        getDirection: (arrow) => {
                            return getArrowDirection(arrow.line.p1);
                        },
                        animated: this.props.showLineFlow && this.props.lineFlowMode === LineFlowMode.ANIMATED_ARROWS,
                        visible:
                            this.props.showLineFlow &&
                            (!this.props.filteredNominalVoltages ||
                                this.props.filteredNominalVoltages.includes(compositeData.nominalV)),
                        opacity: this.props.areFlowsValid ? 1 : INVALID_FLOW_OPACITY,
                        updateTriggers: {
                            getLinePositions: linePathUpdateTriggers,
                            getLineParallelIndex: [this.props.lineParallelPath],
                            getLineAngles: linePathUpdateTriggers,
                            getColor: [
                                this.props.disconnectedLineColor,
                                this.props.lineFlowColorMode,
                                this.props.lineFlowAlertThreshold,
                                this.props.updatedLines,
                            ],
                            opacity: [this.props.areFlowsValid],
                        },
                    } satisfies ArrowLayerProps /*<Arrow>*/
                )
            );
            layers.push(arrowLayer);

            const startFork = new ForkLineLayer<MapAnyLineWithType>(
                this.getSubLayerProps({
                    id: 'LineForkStart' + compositeData.nominalV,
                    getSourcePosition: (line) => line.origin,
                    getTargetPosition: (line) => line.end,
                    getSubstationOffset: (line: MapAnyLineWithType) => line.substationIndexStart,
                    data: compositeData.lines,
                    widthScale: 20,
                    widthMinPixels: 1,
                    widthMaxPixels: 2,
                    // @ts-expect-error TODO: manage undefined case
                    getColor: (line) =>
                        // @ts-expect-error TODO: manage undefined case
                        getLineColor(line, nominalVoltageColor, this.props, this.state.linesConnection.get(line.id)),
                    getWidth: 2,
                    getProximityFactor: (line: MapAnyLineWithType) => line.proximityFactorStart,
                    // @ts-expect-error TODO: manage undefined case
                    getLineParallelIndex: (line) => line.parallelIndex,
                    // @ts-expect-error TODO: manage undefined case
                    getLineAngle: (line) => line.angleStart,
                    getDistanceBetweenLines: this.props.distanceBetweenLines,
                    getMaxParallelOffset: this.props.maxParallelOffset,
                    getMinParallelOffset: this.props.minParallelOffset,
                    getSubstationRadius: this.props.substationRadius,
                    getSubstationMaxPixel: this.props.substationMaxPixel,
                    getMinSubstationRadiusPixel: this.props.minSubstationRadiusPixel,
                    visible:
                        !this.props.filteredNominalVoltages ||
                        this.props.filteredNominalVoltages.includes(compositeData.nominalV),
                    updateTriggers: {
                        getLineParallelIndex: linePathUpdateTriggers,
                        getSourcePosition: linePathUpdateTriggers,
                        getTargetPosition: linePathUpdateTriggers,
                        getLineAngle: linePathUpdateTriggers,
                        getProximityFactor: linePathUpdateTriggers,
                        getColor: [
                            this.props.disconnectedLineColor,
                            this.props.lineFlowColorMode,
                            this.props.lineFlowAlertThreshold,
                            this.props.updatedLines,
                        ],
                    },
                } satisfies ForkLineLayerProps<MapAnyLineWithType>)
            );
            layers.push(startFork);

            const endFork = new ForkLineLayer<MapAnyLineWithType>(
                this.getSubLayerProps({
                    id: 'LineForkEnd' + compositeData.nominalV,
                    getSourcePosition: (line) => line.end,
                    getTargetPosition: (line) => line.origin,
                    getSubstationOffset: (line: MapAnyLineWithType) => line.substationIndexEnd,
                    data: compositeData.lines,
                    widthScale: 20,
                    widthMinPixels: 1,
                    widthMaxPixels: 2,
                    // @ts-expect-error TODO: manage undefined case
                    getColor: (line) =>
                        // @ts-expect-error TODO: manage undefined case
                        getLineColor(line, nominalVoltageColor, this.props, this.state.linesConnection.get(line.id)),
                    getWidth: 2,
                    getProximityFactor: (line: MapAnyLineWithType) => line.proximityFactorEnd,
                    // @ts-expect-error TODO: manage undefined case
                    getLineParallelIndex: (line) => -line.parallelIndex,
                    // @ts-expect-error TODO: manage undefined case
                    getLineAngle: (line) => line.angleEnd + Math.PI,
                    getDistanceBetweenLines: this.props.distanceBetweenLines,
                    getMaxParallelOffset: this.props.maxParallelOffset,
                    getMinParallelOffset: this.props.minParallelOffset,
                    getSubstationRadius: this.props.substationRadius,
                    getSubstationMaxPixel: this.props.substationMaxPixel,
                    getMinSubstationRadiusPixel: this.props.minSubstationRadiusPixel,
                    visible:
                        !this.props.filteredNominalVoltages ||
                        this.props.filteredNominalVoltages.includes(compositeData.nominalV),
                    updateTriggers: {
                        getLineParallelIndex: [this.props.lineParallelPath],
                        getSourcePosition: linePathUpdateTriggers,
                        getTargetPosition: linePathUpdateTriggers,
                        getLineAngle: linePathUpdateTriggers,
                        getProximityFactor: linePathUpdateTriggers,
                        getColor: [
                            this.props.disconnectedLineColor,
                            this.props.lineFlowColorMode,
                            this.props.lineFlowAlertThreshold,
                            this.props.updatedLines,
                        ],
                    },
                } satisfies ForkLineLayerProps<MapAnyLineWithType>)
            );
            layers.push(endFork);

            // lines active power
            const lineActivePowerLabelsLayer = new TextLayer<MapAnyLineWithType>(
                this.getSubLayerProps({
                    id: 'ActivePower' + compositeData.nominalV,
                    data: compositeData.activePower,
                    getText: (activePower) => (activePower.p !== undefined ? Math.round(activePower.p).toString() : ''),
                    // The position passed to this layer causes a bug when zooming and maxParallelOffset is reached:
                    // the label is not correctly positioned on the lines, they are slightly off.
                    // In the custom layers, we clamp the distanceBetweenLines. This is not done in the deck.gl TextLayer
                    // and IconLayer or in the position calculated here.
                    getPosition: (activePower) => activePower.printPosition,
                    getColor: this.props.labelColor,
                    fontFamily: 'Roboto',
                    getSize: this.props.labelSize,
                    getAngle: 0,
                    getPixelOffset: (activePower) => [...activePower.offset],
                    getTextAnchor: 'middle',
                    visible:
                        (!this.props.filteredNominalVoltages ||
                            this.props.filteredNominalVoltages.includes(compositeData.nominalV)) &&
                        this.props.labelsVisible,
                    opacity: this.props.areFlowsValid ? 1 : INVALID_FLOW_OPACITY,
                    updateTriggers: {
                        getPosition: [this.props.lineParallelPath, linePathUpdateTriggers],
                        getPixelOffset: linePathUpdateTriggers,
                        opacity: [this.props.areFlowsValid],
                    },
                } satisfies TextLayerProps<ActivePower>)
            );
            layers.push(lineActivePowerLabelsLayer);

            // line status
            const lineStatusIconLayer = new IconLayer(
                this.getSubLayerProps({
                    id: 'OperatingStatus' + compositeData.nominalV,
                    data: compositeData.operatingStatus,
                    // The position passed to this layer causes a bug when zooming and maxParallelOffset is reached:
                    // the icon is not correctly positioned on the lines, they are slightly off.
                    // In the custom layers, we clamp the distanceBetweenLines. This is not done in the deck.gl TextLayer
                    // and IconLayer or in the position calculated here.
                    getPosition: (operatingStatus) => operatingStatus.printPosition,
                    getIcon: (operatingStatus) => getLineIcon(operatingStatus.status),
                    getSize: this.props.iconSize,
                    getColor: () => this.props.labelColor,
                    getPixelOffset: (operatingStatus) => operatingStatus.offset,
                    visible:
                        (!this.props.filteredNominalVoltages ||
                            this.props.filteredNominalVoltages.includes(compositeData.nominalV)) &&
                        this.props.labelsVisible,
                    updateTriggers: {
                        getPosition: [this.props.lineParallelPath, linePathUpdateTriggers],
                        getPixelOffset: linePathUpdateTriggers,
                        getIcon: [this.state.linesStatus],
                        getColor: [this.props.labelColor],
                    },
                } satisfies IconLayerProps<OperatingStatus>)
            );
            layers.push(lineStatusIconLayer);
        });

        return layers;
    }
}
