/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { UUID } from 'crypto';
import { useCallback } from 'react';
import { useControl } from 'react-map-gl';

import type { ControlPosition } from 'react-map-gl';

// eslint-disable-next-line no-var
var MapDrawerController: MapboxDraw | undefined = undefined;

export function getMapDrawer() {
    // Add your custom logic here
    return MapDrawerController;
}

//source: https://github.com/visgl/react-map-gl/blob/master/examples/draw-polygon/src/
type DrawControlProps = ConstructorParameters<typeof MapboxDraw>[0] & {
    position?: ControlPosition;
    readyToDisplay: boolean;
    studyUuid: UUID;
    mapEquipments: any;
    geoData: any;
    onDrawModeChanged: (polygoneDrawing: boolean) => void;
    onUpdate: (e: any) => void;
    onDelete: (e: any) => void;
};

export default function DrawControl(props: DrawControlProps | any) {
    const onModeChange = useCallback((e: any) => {
        if (e.mode === 'draw_polygon') {
            props.onDrawModeChanged(true);
            // draw?.getAll().features.length > 0
        } else {
            // mode === 'simple_select'
            props.onDrawModeChanged(false);
        }
    }, []);

    useControl<MapboxDraw>(
        //onCreate
        () => {
            MapDrawerController = new MapboxDraw({ ...props });
            return MapDrawerController;
        },
        //on add
        ({ map }) => {
            map.on('draw.create', props.onUpdate);
            map.on('draw.update', props.onUpdate);
            map.on('draw.delete', props.onDelete);
            map.on('draw.modechange', onModeChange);

            // add keybinding to save the filter ??
            // map.getContainer().addEventListener()
        },
        //onRemove
        ({ map }) => {
            map.off('draw.create', props.onUpdate);
            map.off('draw.update', props.onUpdate);
            map.off('draw.delete', props.onDelete);
            map.off('draw.modechange', onModeChange);
        },
        {
            // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
            position: props.position,
        }
    );

    return null;
}

DrawControl.defaultProps = {
    onCreate: () => {},
    onUpdate: () => {},
    onDelete: () => {},
};
