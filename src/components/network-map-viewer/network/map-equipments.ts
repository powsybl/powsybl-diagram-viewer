/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {
    Equipment as EquipmentEq,
    EQUIPMENT_TYPES,
    Line as LineEq,
    Substation as SubstationEq,
    VoltageLevel as VoltageLevelEq,
} from '../utils/equipment-types';

export type Equipment = unknown;
export type Line = Equipment & unknown;
export type Substation = Equipment & unknown;
export type VoltageLevel = unknown;

const elementIdIndexer = <T extends EquipmentEq>(map: Map<string, T>, element: T) => {
    map.set(element.id, element);
    return map;
};

export class MapEquipments {
    substations: SubstationEq[] = [];
    substationsById = new Map<string, SubstationEq>();
    lines: LineEq[] = [];
    linesById = new Map<string, LineEq>();
    tieLines: LineEq[] = [];
    tieLinesById = new Map<string, LineEq>();
    hvdcLines: LineEq[] = [];
    hvdcLinesById = new Map<string, LineEq>();
    voltageLevels: VoltageLevelEq[] = [];
    voltageLevelsById = new Map<string, VoltageLevelEq>();
    nominalVoltages: number[] = [];

    intlRef = undefined;

    constructor() {
        // dummy constructor, to make children classes constructors happy
    }

    newMapEquipmentForUpdate(): MapEquipments {
        /* shallow clone of the map-equipment https://stackoverflow.com/a/44782052 */
        return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    }

    checkAndGetValues(equipments: EquipmentEq[]) {
        return equipments ? equipments : [];
    }

    completeSubstationsInfos(equipementsToIndex: SubstationEq[]) {
        const nominalVoltagesSet = new Set(this.nominalVoltages);
        if (equipementsToIndex?.length === 0) {
            this.substationsById = new Map();
            this.voltageLevelsById = new Map();
        }
        const substations: SubstationEq[] = equipementsToIndex?.length > 0 ? equipementsToIndex : this.substations;

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

    updateEquipments<T extends EquipmentEq>(currentEquipments: T[], newEquipements: T[]) {
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

    updateSubstations(substations: SubstationEq[], fullReload: boolean) {
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

    completeLinesInfos(equipementsToIndex: LineEq[]) {
        if (equipementsToIndex?.length > 0) {
            equipementsToIndex.forEach((line) => {
                this.linesById?.set(line.id, line);
            });
        } else {
            this.linesById = this.lines.reduce(elementIdIndexer, new Map());
        }
    }

    completeTieLinesInfos(equipementsToIndex: LineEq[]) {
        if (equipementsToIndex?.length > 0) {
            equipementsToIndex.forEach((tieLine) => {
                this.tieLinesById?.set(tieLine.id, tieLine);
            });
        } else {
            this.tieLinesById = this.tieLines.reduce(elementIdIndexer, new Map());
        }
    }

    updateLines(lines: LineEq[], fullReload: boolean) {
        if (fullReload) {
            this.lines = [];
        }
        this.lines = this.updateEquipments(this.lines, lines);
        this.completeLinesInfos(fullReload ? [] : lines);
    }

    updateTieLines(tieLines: LineEq[], fullReload: boolean) {
        if (fullReload) {
            this.tieLines = [];
        }
        this.tieLines = this.updateEquipments(this.tieLines, tieLines);
        this.completeTieLinesInfos(fullReload ? [] : tieLines);
    }

    updateHvdcLines(hvdcLines: LineEq[], fullReload: boolean) {
        if (fullReload) {
            this.hvdcLines = [];
        }
        this.hvdcLines = this.updateEquipments(this.hvdcLines, hvdcLines);
        this.completeHvdcLinesInfos(fullReload ? [] : hvdcLines);
    }

    completeHvdcLinesInfos(equipementsToIndex: LineEq[]) {
        if (equipementsToIndex?.length > 0) {
            equipementsToIndex.forEach((hvdcLine) => {
                this.hvdcLinesById?.set(hvdcLine.id, hvdcLine);
            });
        } else {
            this.hvdcLinesById = this.hvdcLines.reduce(elementIdIndexer, new Map());
        }
    }

    removeBranchesOfVoltageLevel(branchesList: LineEq[], voltageLevelId: string) {
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
