/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { type Coordinate, Country } from '../../../powsybl';

export type Equipment = { id: string };

// https://github.com/gridsuite/geo-data-server/blob/main/src/main/java/org/gridsuite/geodata/server/dto/LineGeoData.java
export type Line = Equipment & {
    country1?: Country;
    country2?: Country;
    substationStart?: string; // substationId
    substationEnd?: string; // substationId
    coordinates: Coordinate[];
};

// https://github.com/gridsuite/geo-data-server/blob/main/src/main/java/org/gridsuite/geodata/server/dto/SubstationGeoData.java
export type Substation = Equipment & {
    country?: Country;
    coordinate: Coordinate;
};

export class GeoData {
    substationPositionsById: Map<Substation['id'], Substation['coordinate']>;
    linePositionsById: Map<Line['id'], Line['coordinates']>;

    constructor(
        substationPositionsById: Map<Substation['id'], Substation['coordinate']>,
        linePositionsById: Map<Line['id'], Line['coordinates']>
    );

    setSubstationPositions(positions: Substation[]);

    getSubstationPosition(substationId: string): [Coordinate['lon'], Coordinate['lat']];

    updateSubstationPositions(substationIdsToUpdate: string[], fetchedPositions: Substation[]);

    setLinePositions(positions: Line[]);

    updateLinePositions(lineIdsToUpdate: string[], fetchedPositions: Line[]);
}
