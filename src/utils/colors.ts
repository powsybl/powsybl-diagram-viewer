/**
 * Copyright (c) 2020, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { Color } from 'deck.gl';

export function getNominalVoltageColor(nominalVoltage: number): Color {
    if (nominalVoltage >= 300) {
        return [255, 0, 0];
    } else if (nominalVoltage >= 170) {
        return [34, 139, 34];
    } else if (nominalVoltage >= 120) {
        return [1, 175, 175];
    } else if (nominalVoltage >= 70) {
        return [204, 85, 0];
    } else if (nominalVoltage >= 50) {
        return [160, 32, 240];
    } else if (nominalVoltage >= 30) {
        return [255, 130, 144];
    } else {
        return [171, 175, 40];
    }
}

export const INVALID_FLOW_OPACITY = 0.2;
