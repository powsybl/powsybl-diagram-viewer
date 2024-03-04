/**
 * Copyright (c) 2023, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { MapEquipments } from '../../../src';

const elementIdIndexer = (map, element) => {
    map.set(element.id, element);
    return map;
};

export default class DemoMapEquipments extends MapEquipments {
    initEquipments(smapdata, lmapdata) {
        this.updateSubstations(smapdata, true);
        this.updateLines(lmapdata, true);
    }

    constructor(smapdata, lmapdata) {
        super();
        this.initEquipments(smapdata, lmapdata);
    }

    updateEquipments(currentEquipments, newEquipements) {
        // replace current modified equipments
        currentEquipments.forEach((equipment1, index) => {
            const found = newEquipements.filter(
                (equipment2) => equipment2.id === equipment1.id
            );
            currentEquipments[index] = found.length > 0 ? found[0] : equipment1;
        });

        // add newly created equipments
        const eqptsToAdd = newEquipements.filter(
            (eqpt) =>
                !currentEquipments.some((otherEqpt) => otherEqpt.id === eqpt.id)
        );
        if (eqptsToAdd.length === 0) {
            return currentEquipments;
        }
        return [...currentEquipments, ...eqptsToAdd];
    }

    completeSubstationsInfos(equipementsToIndex) {
        const nominalVoltagesSet = new Set(this.nominalVoltages);
        if (equipementsToIndex?.length === 0) {
            this.substationsById = new Map();
            this.voltageLevelsById = new Map();
        }
        const substations =
            equipementsToIndex?.length > 0
                ? equipementsToIndex
                : this.substations;

        substations.forEach((substation) => {
            // sort voltage levels inside substations by nominal voltage
            substation.voltageLevels = substation.voltageLevels.sort(
                (voltageLevel1, voltageLevel2) =>
                    voltageLevel1.nominalV - voltageLevel2.nominalV
            );

            this.substationsById.set(substation.id, substation);
            substation.voltageLevels.forEach((voltageLevel) => {
                voltageLevel.substationId = substation.id;
                voltageLevel.substationName = substation.name;

                this.voltageLevelsById.set(voltageLevel.id, voltageLevel);
                nominalVoltagesSet.add(voltageLevel.nominalV);
            });
        });

        this.voltageLevels = Array.from(this.voltageLevelsById.values());
        this.nominalVoltages = Array.from(nominalVoltagesSet).sort(
            (a, b) => b - a
        );
    }

    updateSubstations(substations, fullReload) {
        if (fullReload) {
            this.substations = [];
        }

        // replace current modified substations
        let voltageLevelAdded = false;
        this.substations.forEach((substation1, index) => {
            const found = substations.filter(
                (substation2) => substation2.id === substation1.id
            );
            if (found.length > 0) {
                if (
                    found[0].voltageLevels.length >
                    substation1.voltageLevels.length
                ) {
                    voltageLevelAdded = true;
                }
                this.substations[index] = found[0];
            }
        });

        // add newly created substations
        let substationAdded = false;
        substations.forEach((substation1) => {
            const found = this.substations.find(
                (substation2) => substation2.id === substation1.id
            );
            if (found === undefined) {
                this.substations.push(substation1);
                substationAdded = true;
            }
        });

        if (substationAdded === true || voltageLevelAdded === true) {
            this.substations = [...this.substations];
        }

        // add more infos
        this.completeSubstationsInfos(fullReload ? [] : substations);
    }

    completeLinesInfos(equipementsToIndex) {
        if (equipementsToIndex?.length > 0) {
            equipementsToIndex.forEach((line) => {
                this.linesById?.set(line.id, line);
            });
        } else {
            this.linesById = this.lines.reduce(elementIdIndexer, new Map());
        }
    }

    updateLines(lines, fullReload) {
        if (fullReload) {
            this.lines = [];
        }
        this.lines = this.updateEquipments(this.lines, lines);
        this.completeLinesInfos(fullReload ? [] : lines);
    }
}
