/*
 * Copyright © 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export default [
    {
        id: 'SUB1',
        name: 'Substation1',
        voltageLevels: [
            {
                id: 'VL1_1',
                substationId: 'SUB1',
                nominalV: 225.0,
            },
            {
                id: 'VL1_2',
                substationId: 'SUB1',
                nominalV: 110.0,
            },
        ],
    },
    {
        id: 'SUB2',
        name: 'Substation2',
        voltageLevels: [
            {
                id: 'VL2_1',
                substationId: 'SUB2',
                nominalV: 110.0,
            },
            {
                id: 'VL2_2',
                substationId: 'SUB2',
                nominalV: 380.0,
            },
            {
                id: 'VL2_3',
                substationId: 'SUB2',
                nominalV: 225.0,
            },
        ],
    },
] as const;
