/**
 * Copyright (c) 2020, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {
    CompositeLayer,
    TextLayer,
    IconLayer,
    Position,
    Color,
    CompositeLayerProps,
    LayerContext,
    UpdateParameters,
    Layer,
} from 'deck.gl';
import PadlockIcon from '../images/lock_black_24dp.svg?react';
import BoltIcon from '../images/bolt_black_24dp.svg?react';
import { PathStyleExtension } from '@deck.gl/extensions';
import { ArrowLayer, ArrowDirection, Arrow } from './layers/arrow-layer';
import ParallelPathLayer from './layers/parallel-path-layer';
import ForkLineLayer from './layers/fork-line-layer';
import { getDistance } from 'geolib';
import { SUBSTATION_RADIUS, SUBSTATION_RADIUS_MAX_PIXEL, SUBSTATION_RADIUS_MIN_PIXEL } from './constants';
import { getNominalVoltageColor, INVALID_FLOW_OPACITY } from '../../../utils/colors';
import { Line, LonLat, VoltageLevel } from '../utils/equipment-types';
import { MapEquipments } from './map-equipments';
import { GeoData } from './geo-data';

const DISTANCE_BETWEEN_ARROWS = 10000.0;
//Constants for Feeders mode
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

const noDashArray = [0, 0];
const dashArray = [15, 10];

function doDash(lineConnection: LineConnection) {
    return !lineConnection.terminal1Connected || !lineConnection.terminal2Connected;
}

function getArrowDirection(p: number) {
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

export function getLineLoadingZone(line: Line, lineFlowAlertThreshold: number) {
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

function getLineColor(line: Line, nominalVoltageColor: Color, props: LineLayerProps, lineConnection: LineConnection) {
    if (props.lineFlowColorMode === LineFlowColorMode.NOMINAL_VOLTAGE) {
        if (!lineConnection.terminal1Connected && !lineConnection.terminal2Connected) {
            return props.disconnectedLineColor;
        } else {
            return nominalVoltageColor;
        }
    } else if (props.lineFlowColorMode === LineFlowColorMode.OVERLOADS) {
        const zone = getLineLoadingZone(line, props.lineFlowAlertThreshold);
        return getLineLoadingZoneColor(zone);
    } else {
        return nominalVoltageColor;
    }
}

function getLineIcon(lineStatus: LineStatus) {
    return {
        url: lineStatus === 'PLANNED_OUTAGE' ? PadlockIcon : lineStatus === 'FORCED_OUTAGE' ? BoltIcon : undefined,
        height: 24,
        width: 24,
        mask: true,
    };
}

export const ArrowSpeed = {
    STOPPED: 0,
    SLOW: 1,
    MEDIUM: 2,
    FAST: 3,
    CRAZY: 4,
};

function getArrowSpeedOfSide(limit: number | undefined, intensity: number | undefined) {
    if (limit === undefined || intensity === undefined || intensity === 0) {
        return ArrowSpeed.STOPPED;
    } else if (intensity > 0 && intensity < limit / 3) {
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

function getArrowSpeed(line: Line) {
    const speed1 = getArrowSpeedOfSide(line.currentLimits1?.permanentLimit, line.i1);
    const speed2 = getArrowSpeedOfSide(line.currentLimits2?.permanentLimit, line.i2);
    return Math.max(speed1, speed2);
}

function getArrowSpeedFactor(speed: number) {
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

type MinProximityFactor = {
    lines: Line[];
    start: number;
    end: number;
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

const defaultProps = {
    network: null,
    geoData: null,
    getNominalVoltageColor: { type: 'accessor', value: getNominalVoltageColor },
    disconnectedLineColor: { type: 'color', value: [255, 255, 255] },
    filteredNominalVoltages: null,
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

export class LineLayer extends CompositeLayer<Required<_LineLayerProps>> {
    // noinspection JSUnusedGlobalSymbols -- it's dynamically get by deck.gl
    static readonly layerName = 'LineLayer';
    // noinspection JSUnusedGlobalSymbols -- it's dynamically get by deck.gl
    static readonly defaultProps = defaultProps;

    declare state: {
        compositeData: CompositeData[];
        linesConnection: Map<string, LineConnection>;
        linesStatus: Map<string, LinesStatus>;
    };

    initializeState(context: LayerContext) {
        super.initializeState(context);

        this.state = {
            compositeData: [],
            linesConnection: new Map(),
            linesStatus: new Map(),
        };
    }

    getVoltageLevelIndex(voltageLevelId: string) {
        const { network } = this.props;
        const vl = network.getVoltageLevel(voltageLevelId);
        if (vl === undefined) {
            return undefined;
        }
        const substation = network.getSubstation(vl.substationId);
        if (substation === undefined) {
            return undefined;
        }
        return (
            [
                ...new Set(
                    substation.voltageLevels.map((vl: VoltageLevel) => vl.nominalV) // only one voltage level
                ),
            ]
                .sort((a, b) => a - b) // force numerical sort
                .indexOf(vl.nominalV) + 1
        );
    }

    //TODO this is a huge function, refactor
    updateState({ props, oldProps, changeFlags }: UpdateParameters<this>) {
        let compositeData: Partial<CompositeData>[];
        let linesConnection: Map<string, LineConnection> | undefined;
        let linesStatus: Map<string, LinesStatus> | undefined;

        if (changeFlags.dataChanged) {
            compositeData = [];

            linesConnection = new Map<string, LineConnection>();
            linesStatus = new Map<string, LinesStatus>();

            if (props.network?.substations && props.data.length !== 0 && props.geoData != null) {
                // group lines by nominal voltage
                const lineNominalVoltageIndexer = (map: Map<number, Line[]>, line: Line) => {
                    const network = props.network;
                    const vl1 = network.getVoltageLevel(line.voltageLevelId1)!;
                    const vl2 = network.getVoltageLevel(line.voltageLevelId2)!;
                    const vl = vl1 || vl2;
                    let list = map.get(vl.nominalV);
                    if (!list) {
                        list = [];
                        map.set(vl.nominalV, list);
                    }
                    if (vl1.substationId !== vl2.substationId) {
                        list.push(line);
                    }
                    return map;
                };
                const linesByNominalVoltage = props.data.reduce(lineNominalVoltageIndexer, new Map<number, Line[]>());

                compositeData = Array.from(linesByNominalVoltage.entries())
                    .map(([nominalV, lines]) => ({ nominalV, lines }))
                    .sort((a, b) => b.nominalV - a.nominalV);

                compositeData.forEach((c) => {
                    //find lines with same substations set
                    const mapOriginDestination = new Map();
                    c.mapOriginDestination = mapOriginDestination;
                    c.lines?.forEach((line) => {
                        linesConnection?.set(line.id, {
                            terminal1Connected: line.terminal1Connected,
                            terminal2Connected: line.terminal2Connected,
                        });

                        linesStatus?.set(line.id, { operatingStatus: line.operatingStatus! });

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
                    linesConnection?.set(line1.id, {
                        terminal1Connected: line1.terminal1Connected,
                        terminal2Connected: line1.terminal2Connected,
                    });
                    linesStatus?.set(line1.id, { operatingStatus: line1.operatingStatus! });
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
            compositeData.forEach((c) => {
                const lineMap = new Map();
                c.lines?.forEach((line) => {
                    const positions = props.geoData.getLinePositions(props.network, line, props.lineFullPath);
                    const cumulativeDistances = props.geoData.getLineDistances(positions);
                    lineMap.set(line.id, {
                        positions: positions,
                        cumulativeDistances: cumulativeDistances,
                        line: line,
                    });
                });
                c.lineMap = lineMap;
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
            compositeData.forEach((cData) => {
                cData.activePower = [];
                cData.lines?.forEach((line) => {
                    const lineData = cData.lineMap?.get(line.id);
                    const arrowDirection = getArrowDirection(line.p1);
                    const coordinates1 = lineData
                        ? props.geoData.labelDisplayPosition(
                              lineData.positions,
                              lineData.cumulativeDistances,
                              START_ARROW_POSITION,
                              arrowDirection,
                              line.parallelIndex!,
                              (line.angle! * 180) / Math.PI,
                              (line.angleStart! * 180) / Math.PI,
                              props.distanceBetweenLines,
                              line.proximityFactorStart!
                          )
                        : null;
                    const coordinates2 = lineData
                        ? props.geoData.labelDisplayPosition(
                              lineData.positions,
                              lineData.cumulativeDistances,
                              END_ARROW_POSITION,
                              arrowDirection,
                              line.parallelIndex!,
                              (line.angle! * 180) / Math.PI,
                              (line.angleEnd! * 180) / Math.PI,
                              props.distanceBetweenLines,
                              line.proximityFactorEnd!
                          )
                        : null;
                    if (coordinates1 !== null && coordinates2 !== null) {
                        cData.activePower?.push({
                            line: line,
                            p: line.p1,
                            printPosition: [coordinates1.position.longitude, coordinates1.position.latitude],
                            offset: coordinates1.offset,
                        });
                        cData.activePower?.push({
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
            compositeData.forEach((cData) => {
                cData.operatingStatus = [];
                cData.lines?.forEach((line) => {
                    const lineStatus = linesStatus?.get(line.id);
                    if (lineStatus?.operatingStatus !== undefined && lineStatus?.operatingStatus !== 'IN_OPERATION') {
                        if (cData.lineMap) {
                            const lineData = cData.lineMap.get(line.id);
                            if (lineData) {
                                const coordinatesIcon = props.geoData.labelDisplayPosition(
                                    lineData.positions,
                                    lineData.cumulativeDistances,
                                    0.5,
                                    ArrowDirection.NONE,
                                    line.parallelIndex!,
                                    (line.angle! * 180) / Math.PI,
                                    (line.angleEnd! * 180) / Math.PI,
                                    props.distanceBetweenLines,
                                    line.proximityFactorEnd!
                                );
                                if (coordinatesIcon !== null) {
                                    cData.operatingStatus?.push({
                                        status: lineStatus.operatingStatus,
                                        printPosition: [
                                            coordinatesIcon.position.longitude,
                                            coordinatesIcon.position.latitude,
                                        ],
                                        offset: coordinatesIcon.offset,
                                    });
                                }
                            }
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
            compositeData.forEach((cData) => {
                const lineMap = cData.lineMap!;

                // create one arrow each DISTANCE_BETWEEN_ARROWS
                cData.arrows = cData.lines?.flatMap((line) => {
                    const lineData = lineMap.get(line.id)!;
                    line.cumulativeDistances = lineData.cumulativeDistances;
                    line.positions = lineData.positions;

                    if (props.lineFlowMode === LineFlowMode.FEEDERS) {
                        //If we use Feeders Mode, we build only two arrows
                        return [
                            { distance: START_ARROW_POSITION, line: line },
                            { distance: END_ARROW_POSITION, line: line },
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

                    return [...new Array(arrowCount).keys()].map((index) => ({
                        distance: index / arrowCount,
                        line: line,
                    }));
                });
            });
        }
        this.setState({ compositeData, linesConnection, linesStatus });
    }

    genLineKey(line: Line) {
        return line.voltageLevelId1 > line.voltageLevelId2
            ? line.voltageLevelId1 + '##' + line.voltageLevelId2
            : line.voltageLevelId2 + '##' + line.voltageLevelId1;
    }

    recomputeParallelLinesIndex(compositeData: CompositeData[], props: this['props']) {
        compositeData.forEach((cData) => {
            const mapOriginDestination = cData.mapOriginDestination!;
            // calculate index for line with same substation set
            // The index is a real number in a normalized unit.
            // +1 => distanceBetweenLines on side
            // -1 => distanceBetweenLines on the other side
            // 0.5 => half of distanceBetweenLines
            mapOriginDestination.forEach((samePathLine, key) => {
                // restrict parallelIndex to -15.5, -15, .., 15, 15.5 (32 lines, half precision)
                // for 31 lines, -15, -14, .., 15
                // for 32 lines, -15.5, -14.5, ..., 14.5, 15.5
                // (needed by the parallel path shader)
                let truncatedSize = samePathLine.size;
                if (truncatedSize > 32) {
                    console.warn(
                        `Warning, more than 32 parallel lines between vls ${key}. The map will only show 32 parallel lines.`
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

    recomputeForkLines(compositeData: CompositeData[], props: this['props']) {
        const mapMinProximityFactor = new Map<string, MinProximityFactor>();
        compositeData.forEach((cData) => {
            cData.lines.forEach((line) => {
                const positions = cData?.lineMap?.get(line.id)?.positions;
                if (!positions) {
                    return;
                }
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

    computeAngle(props: this['props'], position1: LonLat, position2: LonLat) {
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
        this.state.compositeData.forEach((cData) => {
            const nominalVoltageColor = this.props.getNominalVoltageColor(cData.nominalV);
            const lineLayer = new ParallelPathLayer(
                this.getSubLayerProps({
                    id: 'LineNominalVoltage' + cData.nominalV,
                    data: cData.lines,
                    widthScale: 20,
                    widthMinPixels: 1,
                    widthMaxPixels: 2,
                    getPath: (line: Line) =>
                        this.props.geoData.getLinePositions(this.props.network, line, this.props.lineFullPath),
                    getColor: (line: Line) =>
                        getLineColor(line, nominalVoltageColor, this.props, this.state.linesConnection.get(line.id)!),
                    getWidth: 2,
                    getLineParallelIndex: (line: Line) => line.parallelIndex,
                    getExtraAttributes: (line: Line) => [
                        line.angleStart,
                        line.angle,
                        line.angleEnd,
                        line.parallelIndex! * 2 +
                            31 +
                            64 * (Math.ceil(line.proximityFactorStart! * 512) - 1) +
                            64 * 512 * (Math.ceil(line.proximityFactorEnd! * 512) - 1),
                    ],
                    distanceBetweenLines: this.props.distanceBetweenLines,
                    maxParallelOffset: this.props.maxParallelOffset,
                    minParallelOffset: this.props.minParallelOffset,
                    visible:
                        !this.props.filteredNominalVoltages ||
                        this.props.filteredNominalVoltages.includes(cData.nominalV),
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
                    getDashArray: (line: Line) =>
                        doDash(this.state.linesConnection.get(line.id)!) ? dashArray : noDashArray,
                    extensions: [new PathStyleExtension({ dash: true })],
                })
            );
            layers.push(lineLayer);

            const arrowLayer = new ArrowLayer(
                this.getSubLayerProps({
                    id: 'ArrowNominalVoltage' + cData.nominalV,
                    data: cData.arrows,
                    sizeMinPixels: 3,
                    sizeMaxPixels: 7,
                    getDistance: (arrow: Arrow) => arrow.distance,
                    getLine: (arrow: Arrow) => arrow.line,
                    getLinePositions: (line: Line) =>
                        this.props.geoData.getLinePositions(this.props.network, line, this.props.lineFullPath),
                    getColor: (arrow: Arrow) =>
                        getLineColor(
                            arrow.line,
                            nominalVoltageColor,
                            this.props,
                            this.state.linesConnection.get(arrow.line.id)!
                        ),
                    getSize: 700,
                    getSpeedFactor: (arrow: Arrow) => getArrowSpeedFactor(getArrowSpeed(arrow.line)),
                    getLineParallelIndex: (arrow: Arrow) => arrow.line.parallelIndex,
                    getLineAngles: (arrow: Arrow) => [arrow.line.angleStart, arrow.line.angle, arrow.line.angleEnd],
                    getProximityFactors: (arrow: Arrow) => [
                        arrow.line.proximityFactorStart,
                        arrow.line.proximityFactorEnd,
                    ],
                    getDistanceBetweenLines: this.props.distanceBetweenLines,
                    maxParallelOffset: this.props.maxParallelOffset,
                    minParallelOffset: this.props.minParallelOffset,
                    getDirection: (arrow: Arrow) => getArrowDirection(arrow.line.p1),
                    animated: this.props.showLineFlow && this.props.lineFlowMode === LineFlowMode.ANIMATED_ARROWS,
                    visible:
                        this.props.showLineFlow &&
                        (!this.props.filteredNominalVoltages ||
                            this.props.filteredNominalVoltages.includes(cData.nominalV)),
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
                })
            );
            layers.push(arrowLayer);

            const startFork = new ForkLineLayer(
                this.getSubLayerProps({
                    id: 'LineForkStart' + cData.nominalV,
                    getSourcePosition: (line: Line) => line.origin,
                    getTargetPosition: (line: Line) => line.end,
                    getSubstationOffset: (line: Line) => line.substationIndexStart,
                    data: cData.lines,
                    widthScale: 20,
                    widthMinPixels: 1,
                    widthMaxPixels: 2,
                    getColor: (line: Line) =>
                        getLineColor(line, nominalVoltageColor, this.props, this.state.linesConnection.get(line.id)!),
                    getWidth: 2,
                    getProximityFactor: (line: Line) => line.proximityFactorStart,
                    getLineParallelIndex: (line: Line) => line.parallelIndex,
                    getLineAngle: (line: Line) => line.angleStart,
                    getDistanceBetweenLines: this.props.distanceBetweenLines,
                    getMaxParallelOffset: this.props.maxParallelOffset,
                    getMinParallelOffset: this.props.minParallelOffset,
                    getSubstationRadius: this.props.substationRadius,
                    getSubstationMaxPixel: this.props.substationMaxPixel,
                    getMinSubstationRadiusPixel: this.props.minSubstationRadiusPixel,
                    visible:
                        !this.props.filteredNominalVoltages ||
                        this.props.filteredNominalVoltages.includes(cData.nominalV),
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
                })
            );
            layers.push(startFork);

            const endFork = new ForkLineLayer(
                this.getSubLayerProps({
                    id: 'LineForkEnd' + cData.nominalV,
                    getSourcePosition: (line: Line) => line.end,
                    getTargetPosition: (line: Line) => line.origin,
                    getSubstationOffset: (line: Line) => line.substationIndexEnd,
                    data: cData.lines,
                    widthScale: 20,
                    widthMinPixels: 1,
                    widthMaxPixels: 2,
                    getColor: (line: Line) =>
                        getLineColor(line, nominalVoltageColor, this.props, this.state.linesConnection.get(line.id)!),
                    getWidth: 2,
                    getProximityFactor: (line: Line) => line.proximityFactorEnd,
                    getLineParallelIndex: (line: Line) => -line.parallelIndex!,
                    getLineAngle: (line: Line) => line.angleEnd! + Math.PI,
                    getDistanceBetweenLines: this.props.distanceBetweenLines,
                    getMaxParallelOffset: this.props.maxParallelOffset,
                    getMinParallelOffset: this.props.minParallelOffset,
                    getSubstationRadius: this.props.substationRadius,
                    getSubstationMaxPixel: this.props.substationMaxPixel,
                    getMinSubstationRadiusPixel: this.props.minSubstationRadiusPixel,
                    visible:
                        !this.props.filteredNominalVoltages ||
                        this.props.filteredNominalVoltages.includes(cData.nominalV),
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
                })
            );
            layers.push(endFork);

            // lines active power
            const lineActivePowerLabelsLayer = new TextLayer(
                this.getSubLayerProps({
                    id: 'ActivePower' + cData.nominalV,
                    data: cData.activePower,
                    getText: (activePower: ActivePower) =>
                        activePower.p !== undefined ? Math.round(activePower.p).toString() : '',
                    // The position passed to this layer causes a bug when zooming and maxParallelOffset is reached:
                    // the label is not correctly positioned on the lines, they are slightly off.
                    // In the custom layers, we clamp the distanceBetweenLines. This is not done in the deck.gl TextLayer
                    // and IconLayer or in the position calculated here.
                    getPosition: (activePower: ActivePower) => activePower.printPosition,
                    getColor: this.props.labelColor,
                    fontFamily: 'Roboto',
                    getSize: this.props.labelSize,
                    getAngle: 0,
                    getPixelOffset: (activePower: ActivePower) => activePower.offset.map((x) => x),
                    getTextAnchor: 'middle',
                    visible:
                        (!this.props.filteredNominalVoltages ||
                            this.props.filteredNominalVoltages.includes(cData.nominalV)) &&
                        this.props.labelsVisible,
                    opacity: this.props.areFlowsValid ? 1 : INVALID_FLOW_OPACITY,
                    updateTriggers: {
                        getPosition: [this.props.lineParallelPath, linePathUpdateTriggers],
                        getPixelOffset: linePathUpdateTriggers,
                        opacity: [this.props.areFlowsValid],
                    },
                })
            );
            layers.push(lineActivePowerLabelsLayer);

            // line status
            const lineStatusIconLayer = new IconLayer(
                this.getSubLayerProps({
                    id: 'OperatingStatus' + cData.nominalV,
                    data: cData.operatingStatus,
                    // The position passed to this layer causes a bug when zooming and maxParallelOffset is reached:
                    // the icon is not correctly positioned on the lines, they are slightly off.
                    // In the custom layers, we clamp the distanceBetweenLines. This is not done in the deck.gl TextLayer
                    // and IconLayer or in the position calculated here.
                    getPosition: (operatingStatus: OperatingStatus) => operatingStatus.printPosition,
                    getIcon: (operatingStatus: OperatingStatus) => getLineIcon(operatingStatus.status),
                    getSize: this.props.iconSize,
                    getColor: () => this.props.labelColor,
                    getPixelOffset: (operatingStatus: OperatingStatus) => operatingStatus.offset,
                    visible:
                        (!this.props.filteredNominalVoltages ||
                            this.props.filteredNominalVoltages.includes(cData.nominalV)) &&
                        this.props.labelsVisible,
                    updateTriggers: {
                        getPosition: [this.props.lineParallelPath, linePathUpdateTriggers],
                        getPixelOffset: linePathUpdateTriggers,
                        getIcon: [this.state.linesStatus],
                        getColor: [this.props.labelColor],
                    },
                })
            );
            layers.push(lineStatusIconLayer);
        });

        return layers;
    }
}
