/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export class MapEquipments {
    substations = [];

    substationsById = new Map();

    lines = [];

    linesById = new Map();

    hvdcLines = [];

    hvdcLinesById = new Map();

    voltageLevels = [];

    voltageLevelsById = new Map();

    nominalVoltages = [];

    intlRef = undefined;

    constructor() {
        // dummy constructor, to make children classes constructors happy
    }

    getVoltageLevels() {
        return this.voltageLevels;
    }

    getVoltageLevel(id) {
        return this.voltageLevelsById.get(id);
    }

    getSubstations() {
        return this.substations;
    }

    getSubstation(id) {
        return this.substationsById.get(id);
    }

    getNominalVoltages() {
        return this.nominalVoltages;
    }

    getLines() {
        return this.lines;
    }

    getLine(id) {
        return this.linesById.get(id);
    }

    getHvdcLines() {
        return this.hvdcLines;
    }

    getHvdcLine(id) {
        return this.hvdcLinesById.get(id);
    }
}
