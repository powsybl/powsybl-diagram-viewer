/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { EQUIPMENT_TYPES } from '../utils/equipment-types';

const elementIdIndexer = (map, element) => {
    map.set(element.id, element);
    return map;
};

export class MapEquipments {
    substations = [];

    substationsById = new Map();

    lines = [];

    linesById = new Map();

    tieLines = [];

    tieLinesById = new Map();

    hvdcLines = [];

    hvdcLinesById = new Map();

    voltageLevels = [];

    voltageLevelsById = new Map();

    nominalVoltages = [];

    intlRef = undefined;

    constructor() {
        // dummy constructor, to make children classes constructors happy
    }

    newMapEquipmentForUpdate() {
        /* shallow clone of the map-equipment https://stackoverflow.com/a/44782052 */
        return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    }

    checkAndGetValues(equipments) {
        return equipments ? equipments : [];
    }

    completeSubstationsInfos(equipementsToIndex) {
        const nominalVoltagesSet = new Set(this.nominalVoltages);
        if (equipementsToIndex?.length === 0) {
            this.substationsById = new Map();
            this.voltageLevelsById = new Map();
        }
        const substations = equipementsToIndex?.length > 0 ? equipementsToIndex : this.substations;

        substations.forEach((substation) => {
            // sort voltage levels inside substations by nominal voltage
            substation.voltageLevels = substation.voltageLevels.sort(
                (voltageLevel1, voltageLevel2) => voltageLevel1.nominalV - voltageLevel2.nominalV
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
        this.nominalVoltages = Array.from(nominalVoltagesSet).sort((a, b) => b - a);
    }

    updateEquipments(currentEquipments, newEquipements) {
        // replace current modified equipments
        currentEquipments.forEach((equipment1, index) => {
            const found = newEquipements.filter((equipment2) => equipment2.id === equipment1.id);
            currentEquipments[index] = found.length > 0 ? found[0] : equipment1;
        });

        // add newly created equipments
        const eqptsToAdd = newEquipements.filter(
            (eqpt) => !currentEquipments.some((otherEqpt) => otherEqpt.id === eqpt.id)
        );
        if (eqptsToAdd.length === 0) {
            return currentEquipments;
        }
        return [...currentEquipments, ...eqptsToAdd];
    }

    updateSubstations(substations, fullReload) {
        if (fullReload) {
            this.substations = [];
        }

        // replace current modified substations
        let voltageLevelAdded = false;
        this.substations.forEach((substation1, index) => {
            const found = substations.filter((substation2) => substation2.id === substation1.id);
            if (found.length > 0) {
                if (found[0].voltageLevels.length > substation1.voltageLevels.length) {
                    voltageLevelAdded = true;
                }
                this.substations[index] = found[0];
            }
        });

        // add newly created substations
        let substationAdded = false;
        substations.forEach((substation1) => {
            const found = this.substations.find((substation2) => substation2.id === substation1.id);
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

    completeTieLinesInfos(equipementsToIndex) {
        if (equipementsToIndex?.length > 0) {
            equipementsToIndex.forEach((tieLine) => {
                this.tieLinesById?.set(tieLine.id, tieLine);
            });
        } else {
            this.tieLinesById = this.tieLines.reduce(elementIdIndexer, new Map());
        }
    }

    updateLines(lines, fullReload) {
        if (fullReload) {
            this.lines = [];
        }
        this.lines = this.updateEquipments(this.lines, lines, EQUIPMENT_TYPES.LINE);
        this.completeLinesInfos(fullReload ? [] : lines);
    }

    updateTieLines(tieLines, fullReload) {
        if (fullReload) {
            this.tieLines = [];
        }
        this.tieLines = this.updateEquipments(this.tieLines, tieLines, EQUIPMENT_TYPES.TIE_LINE);
        this.completeTieLinesInfos(fullReload ? [] : tieLines);
    }

    updateHvdcLines(hvdcLines, fullReload) {
        if (fullReload) {
            this.hvdcLines = [];
        }
        this.hvdcLines = this.updateEquipments(this.hvdcLines, hvdcLines, EQUIPMENT_TYPES.HVDC_LINE);
        this.completeHvdcLinesInfos(fullReload ? [] : hvdcLines);
    }

    completeHvdcLinesInfos(equipementsToIndex) {
        if (equipementsToIndex?.length > 0) {
            equipementsToIndex.forEach((hvdcLine) => {
                this.hvdcLinesById?.set(hvdcLine.id, hvdcLine);
            });
        } else {
            this.hvdcLinesById = this.hvdcLines.reduce(elementIdIndexer, new Map());
        }
    }

    removeBranchesOfVoltageLevel(branchesList, voltageLevelId) {
        const remainingLines = branchesList.filter(
            (l) => l.voltageLevelId1 !== voltageLevelId && l.voltageLevelId2 !== voltageLevelId
        );
        branchesList.filter((l) => !remainingLines.includes(l)).map((l) => this.linesById.delete(l.id));

        return remainingLines;
    }

    removeEquipment(equipmentType, equipmentId) {
        switch (equipmentType) {
            case EQUIPMENT_TYPES.LINE: {
                this.lines = this.lines.filter((l) => l.id !== equipmentId);
                this.linesById.delete(equipmentId);
                break;
            }
            case EQUIPMENT_TYPES.VOLTAGE_LEVEL: {
                const substationId = this.voltageLevelsById.get(equipmentId).substationId;
                let voltageLevelsOfSubstation = this.substationsById.get(substationId).voltageLevels;
                voltageLevelsOfSubstation = voltageLevelsOfSubstation.filter((l) => l.id !== equipmentId);
                this.substationsById.get(substationId).voltageLevels = voltageLevelsOfSubstation;

                this.removeBranchesOfVoltageLevel(this.lines, equipmentId);
                //New reference on substations to trigger reload of NetworkExplorer and NetworkMap
                this.substations = [...this.substations];
                break;
            }
            case EQUIPMENT_TYPES.SUBSTATION: {
                this.substations = this.substations.filter((l) => l.id !== equipmentId);

                const substation = this.substationsById.get(equipmentId);
                substation.voltageLevels.map((vl) => this.removeEquipment(EQUIPMENT_TYPES.VOLTAGE_LEVEL, vl.id));
                this.completeSubstationsInfos([substation]);
                break;
            }
            default:
        }
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

    getTieLines() {
        return this.tieLines;
    }

    getTieLine(id) {
        return this.tieLinesById.get(id);
    }
}
