/**
 * Copyright (c) 2023, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { MapEquipments } from '../../../src';

type SMap = typeof import('./data/smap.json');
type LMap = typeof import('./data/lmap.json');

export default class DemoMapEquipments extends MapEquipments {
    initEquipments(smapdata: SMap, lmapdata: LMap) {
        this.updateSubstations(smapdata, true);
        this.updateLines(lmapdata, true);
    }

    constructor(smapdata: SMap, lmapdata: LMap) {
        super();
        this.initEquipments(smapdata, lmapdata);
    }
}
