/**
 * Copyright (c) 2023, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { MapEquipmentsBase } from '@powsybl/network-map-viewer';
export default class MapEquipments extends MapEquipmentsBase {
    initEquipments(smapdata, lmapdata) {
        this.updateSubstations(smapdata, true);
        this.updateLines(lmapdata, true);
    }

    constructor(smapdata, lmapdata) {
        super();
        this.initEquipments(smapdata, lmapdata);
    }

}
