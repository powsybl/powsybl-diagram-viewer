/**
 * Copyright (c) 2020, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { computeDestinationPoint, getGreatCircleBearing, getRhumbLineBearing } from 'geolib';
import CheapRuler from 'cheap-ruler';
// @ts-expect-error TODO tmp migration TS
import { ArrowDirection } from './layers/arrow-layer';
import { type Coordinate, Country } from '../../../powsybl';
import { type LonLat, type MapAnyLine } from '../../../equipment-types';
import { type MapEquipments } from './map-equipments';

export type GeoDataEquipment = { id: string };

// https://github.com/gridsuite/geo-data-server/blob/main/src/main/java/org/gridsuite/geodata/server/dto/SubstationGeoData.java
export type GeoDataSubstation = GeoDataEquipment & {
    country?: Country;
    coordinate: Coordinate;
};

// https://github.com/gridsuite/geo-data-server/blob/main/src/main/java/org/gridsuite/geodata/server/dto/LineGeoData.java
export type GeoDataLine = GeoDataEquipment & {
    country1?: Country;
    country2?: Country;
    substationStart?: string; // substationId
    substationEnd?: string; // substationId
    coordinates: Coordinate[];
};

const substationPositionByIdIndexer = (map: Map<string, Coordinate>, substation: GeoDataSubstation) => {
    map.set(substation.id, substation.coordinate);
    return map;
};

const linePositionByIdIndexer = (map: Map<string, Coordinate[]>, line: GeoDataLine) => {
    map.set(line.id, line.coordinates);
    return map;
};

export class GeoData {
    substationPositionsById = new Map<string, Coordinate>();
    linePositionsById = new Map<string, Coordinate[]>();

    constructor(
        substationPositionsById: GeoData['substationPositionsById'],
        linePositionsById: GeoData['linePositionsById']
    ) {
        this.substationPositionsById = substationPositionsById;
        this.linePositionsById = linePositionsById;
    }

    setSubstationPositions(positions: GeoDataSubstation[]) {
        // index positions by substation id
        this.substationPositionsById = positions.reduce(substationPositionByIdIndexer, new Map());
    }

    updateSubstationPositions(substationIdsToUpdate: string[], fetchedPositions: GeoDataSubstation[]) {
        fetchedPositions.forEach((pos) => this.substationPositionsById.set(pos.id, pos.coordinate));
        // If a substation position is requested but not present in the fetched results, we delete its position.
        // It allows to cancel the position of a substation when the server can't situate it anymore after a network modification (for example a line deletion).
        substationIdsToUpdate
            .filter((id) => !fetchedPositions.map((pos) => pos.id).includes(id))
            .forEach((id) => this.substationPositionsById.delete(id));
    }

    getSubstationPosition(substationId: string) {
        const position = this.substationPositionsById.get(substationId);
        if (!position) {
            console.warn(`Position not found for ${substationId}`);
            return [0, 0];
        }
        return [position.lon, position.lat];
    }

    setLinePositions(positions: GeoDataLine[]) {
        // index positions by line id
        this.linePositionsById = positions.reduce(linePositionByIdIndexer, new Map());
    }

    updateLinePositions(lineIdsToUpdate: string[], fetchedPositions: GeoDataLine[]) {
        fetchedPositions.forEach((pos) => {
            this.linePositionsById.set(pos.id, pos.coordinates);
        });
        // If a line position is requested but not present in the fetched results, we delete its position.
        // For lines, this code is not really necessary as we draw lines in [(0, 0), (0, 0)] when it is connected to a (0, 0) point (see getLinePositions())
        // But it's cleaner to avoid keeping old ignored data in geo data.
        lineIdsToUpdate
            .filter((id) => !fetchedPositions.map((pos) => pos.id).includes(id))
            .forEach((id) => this.linePositionsById.delete(id));
    }

    /**
     * Get line positions always ordered from side 1 to side 2.
     */
    getLinePositions(network: MapEquipments, line: MapAnyLine, detailed = true) {
        const voltageLevel1 = network.getVoltageLevel(line.voltageLevelId1);
        if (!voltageLevel1) {
            throw new Error(`Voltage level side 1 '${line.voltageLevelId1}' not found`);
        }
        const voltageLevel2 = network.getVoltageLevel(line.voltageLevelId2);
        if (!voltageLevel2) {
            throw new Error(`Voltage level side 2 '${line.voltageLevelId1}' not found`);
        }
        // @ts-expect-error TODO tmp migration TS
        const substationPosition1 = this.getSubstationPosition(voltageLevel1.substationId);
        // @ts-expect-error TODO tmp migration TS
        const substationPosition2 = this.getSubstationPosition(voltageLevel2.substationId);

        // We never want to draw lines when its start or end is in (0, 0) (it is ugly, it would cross the whole screen all the time).
        // For example, when a substation position is not yet fetched and it is connected to a positioned substation, it avoids the line crossing the whole screen.
        // This would only happen for a short time because when the position is fetched, the substation and line are drawn at the correct place.
        if (
            (substationPosition1[0] === 0 && substationPosition1[1] === 0) ||
            (substationPosition2[0] === 0 && substationPosition2[1] === 0)
        ) {
            return [
                [0, 0],
                [0, 0],
            ];
        }

        if (detailed) {
            const linePositions = this.linePositionsById.get(line.id);
            // Is there any position for this line ?
            if (linePositions) {
                const positions = new Array(linePositions.length);

                for (const [index, position] of linePositions.entries()) {
                    positions[index] = [position.lon, position.lat];
                }

                return positions;
            }
        }

        return [substationPosition1, substationPosition2];
    }

    getLineDistances(positions: LonLat[]) {
        if (positions !== null && positions.length > 1) {
            const cumulativeDistanceArray = [0];
            let cumulativeDistance = 0;
            let segmentDistance;
            let ruler;
            for (let i = 0; i < positions.length - 1; i++) {
                ruler = new CheapRuler(positions[i][1], 'meters');
                segmentDistance = ruler.lineDistance(positions.slice(i, i + 2));
                cumulativeDistance = cumulativeDistance + segmentDistance;
                cumulativeDistanceArray[i + 1] = cumulativeDistance;
            }
            return cumulativeDistanceArray;
        }
        return null;
    }

    /**
     * Find the segment in which we reach the wanted distance and return the segment
     * along with the remaining distance to travel on this segment to be at the exact wanted distance
     * (implemented using a binary search)
     */
    findSegment(positions: LonLat[], cumulativeDistances: number[], wantedDistance: number) {
        let lowerBound = 0;
        let upperBound = cumulativeDistances.length - 1;
        let middlePoint;
        while (lowerBound + 1 !== upperBound) {
            middlePoint = Math.floor((lowerBound + upperBound) / 2);
            const middlePointDistance = cumulativeDistances[middlePoint];
            if (middlePointDistance <= wantedDistance) {
                lowerBound = middlePoint;
            } else {
                upperBound = middlePoint;
            }
        }
        return {
            idx: lowerBound,
            segment: positions.slice(lowerBound, lowerBound + 2),
            remainingDistance: wantedDistance - cumulativeDistances[lowerBound],
        };
    }

    labelDisplayPosition(
        positions: LonLat[],
        cumulativeDistances: number[],
        arrowPosition: number,
        arrowDirection: ArrowDirection,
        lineParallelIndex: number,
        lineAngle: number,
        proximityAngle: number,
        distanceBetweenLines: number,
        proximityFactor: number
    ) {
        if (arrowPosition > 1 || arrowPosition < 0) {
            throw new Error('Proportional position value incorrect: ' + arrowPosition);
        }
        if (
            cumulativeDistances === null ||
            cumulativeDistances.length < 2 ||
            cumulativeDistances[cumulativeDistances.length - 1] === 0
        ) {
            return null;
        }
        const lineDistance = cumulativeDistances[cumulativeDistances.length - 1];
        let wantedDistance = lineDistance * arrowPosition;

        if (cumulativeDistances.length === 2) {
            // For parallel lines, the initial fork line distance does not count
            // when there are no intermediate points between the substations.
            // I'm not sure this is entirely correct but it displays well enough.
            wantedDistance = wantedDistance - 2 * distanceBetweenLines * arrowPosition * proximityFactor;
        }

        const goodSegment = this.findSegment(positions, cumulativeDistances, wantedDistance);

        // We don't have the exact same distance calculation as in the arrow shader, so take some margin:
        // we move the label a little bit on the flat side of the arrow so that at least it stays
        // on the right side when zooming
        let multiplier;
        switch (arrowDirection) {
            case ArrowDirection.FROM_SIDE_2_TO_SIDE_1:
                multiplier = 1.005;
                break;
            case ArrowDirection.FROM_SIDE_1_TO_SIDE_2:
                multiplier = 0.995;
                break;
            case ArrowDirection.NONE:
                multiplier = 1;
                break;
            default:
                throw new Error('impossible');
        }
        const remainingDistance = goodSegment.remainingDistance * multiplier;

        const angle = this.getMapAngle(goodSegment.segment[0], goodSegment.segment[1]);
        const neededOffset = this.getLabelOffset(angle, 20, arrowDirection);

        const position = {
            position: computeDestinationPoint(goodSegment.segment[0], remainingDistance, angle),
            angle: angle,
            offset: neededOffset,
        };
        // apply parallel spread between lines
        position.position = computeDestinationPoint(
            position.position,
            distanceBetweenLines * lineParallelIndex,
            lineAngle + 90
        );
        if (cumulativeDistances.length === 2) {
            // For line with only one segment, we can just apply a translation by lineAngle because both segment ends
            // connect to fork lines. This accounts for the fact that the forkline part of the line doesn't count
            position.position = computeDestinationPoint(
                position.position,
                -distanceBetweenLines * proximityFactor,
                lineAngle
            );
        } else if (goodSegment.idx === 0 || goodSegment.idx === cumulativeDistances.length - 2) {
            // When the label is on the first or last segment and there is an intermediate point,
            // when must shift by the percentange of position of the label on this segment
            const segmentDistance = cumulativeDistances[goodSegment.idx + 1] - cumulativeDistances[goodSegment.idx];
            const alreadyDoneDistance = segmentDistance - remainingDistance;
            let labelDistanceInSegment;
            if (goodSegment.idx === 0) {
                labelDistanceInSegment = -alreadyDoneDistance;
            } else {
                labelDistanceInSegment = remainingDistance;
            }
            const labelPercentage = labelDistanceInSegment / segmentDistance;
            position.position = computeDestinationPoint(
                position.position,
                distanceBetweenLines * labelPercentage,
                proximityAngle
            );
        }

        return position;
    }

    getLabelOffset(angle: number, offsetDistance: number, arrowDirection: ArrowDirection): [number, number] {
        const radiantAngle = (-angle + 90) / (180 / Math.PI);
        let direction = 0;
        switch (arrowDirection) {
            case ArrowDirection.FROM_SIDE_2_TO_SIDE_1:
                direction = 1;
                break;
            case ArrowDirection.FROM_SIDE_1_TO_SIDE_2:
                direction = -1;
                break;
            case ArrowDirection.NONE:
                direction = 0;
                break;
            default:
                throw new Error('impossible');
        }
        //Y offset is negative because deckGL pixel uses a top-left coordinate system and our computation use orthogonal coordinates
        return [
            Math.cos(radiantAngle) * offsetDistance * direction,
            -Math.sin(radiantAngle) * offsetDistance * direction,
        ];
    }

    //returns the angle between point1 and point2 in degrees [0-360)
    getMapAngle(point1: LonLat, point2: LonLat) {
        // We don't have the exact same angle calculation as in the arrow shader, and this
        // seems to give more approaching results
        let angle = getRhumbLineBearing(point1, point2);
        const angle2 = getGreatCircleBearing(point1, point2);
        const coeff = 0.1;
        angle = coeff * angle + (1 - coeff) * angle2;
        return angle;
    }
}
