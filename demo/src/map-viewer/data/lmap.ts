/*
 * Copyright © 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export default [
    {
        id: 'L1',
        voltageLevelId1: 'VL2_3',
        voltageLevelId2: 'VL1_1',
        name: 'Line1',
        terminal1Connected: true,
        terminal2Connected: true,
        p1: -115.0,
        p2: 115.0,
        i1: 290.0,
        i2: 310.0,
    },
    {
        id: 'L2',
        voltageLevelId1: 'VL2_3',
        voltageLevelId2: 'VL1_1',
        name: 'Line2',
        terminal1Connected: true,
        terminal2Connected: true,
        p1: -55.0,
        p2: 55.0,
        i1: 140.0,
        i2: 155.0,
    },
] as const;
