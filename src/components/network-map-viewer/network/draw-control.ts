/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useCallback } from 'react';
import { useControl } from 'react-map-gl';

import { EventedListener } from 'mapbox-gl';
import type { ControlPosition } from 'react-map-gl';

let mapDrawerController: MapboxDraw | undefined = undefined;

export function getMapDrawer() {
    return mapDrawerController;
}

export enum DRAW_MODES {
    DRAW_POLYGON = 'draw_polygon',
    DRAW_POINT = 'draw_point',
    SIMPLE_SELECT = 'simple_select',
    DIRECT_SELECT = 'direct_select',
}

export type DrawControlProps = ConstructorParameters<typeof MapboxDraw>[0] & {
    position?: ControlPosition;
    readyToDisplay: boolean;
    onDrawPolygonModeActive: (polygoneDrawing: DRAW_MODES) => void;
    onCreate?: EventedListener;
    onUpdate?: EventedListener;
    onDelete?: EventedListener;
};

const DefaultProps = {
    onCreate: () => {},
    onUpdate: () => {},
    onDelete: () => {},
};

export default function DrawControl(props: DrawControlProps) {
    const {
        onDrawPolygonModeActive,
        position,
        onCreate,
        onUpdate,
        onDelete,
        ...mapboxProps
    } = {
        ...DefaultProps,
        ...props,
    };
    const onModeChange = useCallback(
        (e: { mode: DRAW_MODES }) => {
            onDrawPolygonModeActive(e.mode);
        },
        [onDrawPolygonModeActive]
    );

    useControl<MapboxDraw>(
        //onCreate
        () => {
            mapDrawerController = new MapboxDraw({ ...mapboxProps });
            return mapDrawerController;
        },
        //on add
        ({ map }) => {
            map.on('draw.create', onCreate);
            map.on('draw.update', onUpdate);
            map.on('draw.delete', onDelete);
            map.on('draw.modechange', onModeChange);
        },
        //onRemove
        ({ map }) => {
            map.off('draw.create', onCreate);
            map.off('draw.update', onUpdate);
            map.off('draw.delete', onDelete);
            map.off('draw.modechange', onModeChange);
        },
        {
            position,
        }
    );

    return null;
}
