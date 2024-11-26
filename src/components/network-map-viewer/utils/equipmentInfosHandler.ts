/*
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { useCallback } from 'react';

type EquipmentInfos = {
    id: string;
    name: string | null;
};

export function useNameOrId(useName: boolean) {
    const getNameOrId = useCallback(
        (infos: EquipmentInfos | null) => {
            if (infos != null) {
                const name = infos.name;
                return useName && name != null && name.trim() !== '' ? name : infos?.id ?? null;
            }
            return null;
        },
        [useName]
    );

    return { getNameOrId };
}
