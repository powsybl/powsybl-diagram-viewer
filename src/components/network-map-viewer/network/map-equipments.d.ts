/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export type Equipment = unknown;
export type Line = Equipment & unknown;
export type Substation = Equipment & unknown;
export type VoltageLevel = unknown;

export class MapEquipments {
    substations: Substation[];
    substationsById: Map<string, Substation>;
    lines: Line[];
    linesById: Map<string, Line>;
    tieLines: Line[];
    tieLinesById: Map<string, Line>;
    hvdcLines: Line[];
    hvdcLinesById: Map<string, Line>;
    voltageLevels: VoltageLevel[];
    voltageLevelsById: Map<string, VoltageLevel>;
    nominalVoltages: unknown[];

    constructor();

    newMapEquipmentForUpdate(): MapEquipments;

    checkAndGetValues(equipments: Equipment[] | null): Equipment[];

    completeSubstationsInfos(equipementsToIndex: Substation[]): void;

    updateEquipments(
        currentEquipments: Equipment[],
        newEquipements: Equipment[]
    ): Equipment[];

    updateSubstations(substations: Substation[], fullReload: boolean): void;

    completeLinesInfos(equipementsToIndex: Line[]): void;

    completeTieLinesInfos(equipementsToIndex: Line[]): void;

    updateLines(lines: Line[], fullReload: boolean): void;

    updateTieLines(tieLines: Line[], fullReload: boolean): void;

    updateHvdcLines(hvdcLines: Line[], fullReload: boolean): void;

    completeHvdcLinesInfos(equipementsToIndex: Line[]): void;

    removeBranchesOfVoltageLevel(
        branchesList: Line[],
        voltageLevelId: string
    ): Line[];

    removeEquipment(equipmentType, equipmentId: string): void;

    getVoltageLevels(): VoltageLevel[];

    getVoltageLevel(id: string): VoltageLevel | undefined;

    getSubstations(): Substation[];

    getSubstation(id: string): Substation | undefined;

    getNominalVoltages(): unknown[];

    getLines(): Line[];

    getLine(id: string): Line | undefined;

    getHvdcLines(): Line[];

    getHvdcLine(id: string): Line | undefined;

    getTieLines(): Line[];

    getTieLine(id: string): Line | undefined;
}
