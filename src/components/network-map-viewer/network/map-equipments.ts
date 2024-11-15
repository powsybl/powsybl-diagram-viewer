/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { Equipment, EQUIPMENT_TYPES, Line, Substation, VoltageLevel } from '../utils/equipment-types';

const elementIdIndexer = <T extends Equipment>(map: Map<string, T>, element: T) => {
    map.set(element.id, element);
    return map;
};

export class MapEquipments {
    substations: Substation[] = [];
    substationsById = new Map<string, Substation>();
    lines: Line[] = [];
    linesById = new Map<string, Line>();
    tieLines: Line[] = [];
    tieLinesById = new Map<string, Line>();
    hvdcLines: Line[] = [];
    hvdcLinesById = new Map<string, Line>();
    voltageLevels: VoltageLevel[] = [];
    voltageLevelsById = new Map<string, VoltageLevel>();
    nominalVoltages: number[] = [];

    intlRef = undefined;

    constructor() {
        // dummy constructor, to make children classes constructors happy
    }

    newMapEquipmentForUpdate(): MapEquipments {
        /* shallow clone of the map-equipment https://stackoverflow.com/a/44782052 */
        return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    }

    checkAndGetValues(equipments: Equipment[]) {
        return equipments ? equipments : [];
    }

    completeSubstationsInfos(equipementsToIndex: Substation[]) {
        const nominalVoltagesSet = new Set(this.nominalVoltages);
        if (equipementsToIndex?.length === 0) {
            this.substationsById = new Map();
            this.voltageLevelsById = new Map();
        }
        const substations: Substation[] = equipementsToIndex?.length > 0 ? equipementsToIndex : this.substations;

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

    updateEquipments<T extends Equipment>(currentEquipments: T[], newEquipements: T[]) {
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

    updateSubstations(substations: Substation[], fullReload: boolean) {
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

        if (substationAdded || voltageLevelAdded) {
            this.substations = [...this.substations];
        }

        // add more infos
        this.completeSubstationsInfos(fullReload ? [] : substations);
    }

    completeLinesInfos(equipementsToIndex: Line[]) {
        if (equipementsToIndex?.length > 0) {
            equipementsToIndex.forEach((line) => {
                this.linesById?.set(line.id, line);
            });
        } else {
            this.linesById = this.lines.reduce(elementIdIndexer, new Map());
        }
    }

    completeTieLinesInfos(equipementsToIndex: Line[]) {
        if (equipementsToIndex?.length > 0) {
            equipementsToIndex.forEach((tieLine) => {
                this.tieLinesById?.set(tieLine.id, tieLine);
            });
        } else {
            this.tieLinesById = this.tieLines.reduce(elementIdIndexer, new Map());
        }
    }

    updateLines(lines: Line[], fullReload: boolean) {
        if (fullReload) {
            this.lines = [];
        }
        this.lines = this.updateEquipments(this.lines, lines);
        this.completeLinesInfos(fullReload ? [] : lines);
    }

    updateTieLines(tieLines: Line[], fullReload: boolean) {
        if (fullReload) {
            this.tieLines = [];
        }
        this.tieLines = this.updateEquipments(this.tieLines, tieLines);
        this.completeTieLinesInfos(fullReload ? [] : tieLines);
    }

    updateHvdcLines(hvdcLines: Line[], fullReload: boolean) {
        if (fullReload) {
            this.hvdcLines = [];
        }
        this.hvdcLines = this.updateEquipments(this.hvdcLines, hvdcLines);
        this.completeHvdcLinesInfos(fullReload ? [] : hvdcLines);
    }

    completeHvdcLinesInfos(equipementsToIndex: Line[]) {
        if (equipementsToIndex?.length > 0) {
            equipementsToIndex.forEach((hvdcLine) => {
                this.hvdcLinesById?.set(hvdcLine.id, hvdcLine);
            });
        } else {
            this.hvdcLinesById = this.hvdcLines.reduce(elementIdIndexer, new Map());
        }
    }

    removeBranchesOfVoltageLevel(branchesList: Line[], voltageLevelId: string) {
        const remainingLines = branchesList.filter(
            (l) => l.voltageLevelId1 !== voltageLevelId && l.voltageLevelId2 !== voltageLevelId
        );
        branchesList.filter((l) => !remainingLines.includes(l)).forEach((l) => this.linesById.delete(l.id));

        return remainingLines;
    }

    removeEquipment(equipmentType: EQUIPMENT_TYPES, equipmentId: string) {
        switch (equipmentType) {
            case EQUIPMENT_TYPES.LINE: {
                this.lines = this.lines.filter((l) => l.id !== equipmentId);
                this.linesById.delete(equipmentId);
                break;
            }
            case EQUIPMENT_TYPES.VOLTAGE_LEVEL: {
                const substationId = this.voltageLevelsById.get(equipmentId)?.substationId;
                if (substationId === undefined) {
                    return;
                }
                const substation = this.substationsById.get(substationId);
                if (substation == null) {
                    return;
                }
                substation.voltageLevels = substation.voltageLevels.filter((l) => l.id !== equipmentId);
                this.removeBranchesOfVoltageLevel(this.lines, equipmentId);
                //New reference on substations to trigger reload of NetworkExplorer and NetworkMap
                this.substations = [...this.substations];
                break;
            }
            case EQUIPMENT_TYPES.SUBSTATION: {
                this.substations = this.substations.filter((l) => l.id !== equipmentId);

                const substation = this.substationsById.get(equipmentId);
                if (substation === undefined) {
                    return;
                }
                substation.voltageLevels.forEach((vl) => this.removeEquipment(EQUIPMENT_TYPES.VOLTAGE_LEVEL, vl.id));
                this.completeSubstationsInfos([substation]);
                break;
            }
            default:
        }
    }

    getVoltageLevels() {
        return this.voltageLevels;
    }

    getVoltageLevel(id: string) {
        return this.voltageLevelsById.get(id);
    }

    getSubstations() {
        return this.substations;
    }

    getSubstation(id: string) {
        return this.substationsById.get(id);
    }

    getNominalVoltages() {
        return this.nominalVoltages;
    }

    getLines() {
        return this.lines;
    }

    getLine(id: string) {
        return this.linesById.get(id);
    }

    getHvdcLines() {
        return this.hvdcLines;
    }

    getHvdcLine(id: string) {
        return this.hvdcLinesById.get(id);
    }

    getTieLines() {
        return this.tieLines;
    }

    getTieLine(id: string) {
        return this.tieLinesById.get(id);
    }
}
