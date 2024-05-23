/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useCallback } from 'react';
import { useControl } from 'react-map-gl';

import type { ControlPosition } from 'react-map-gl';
import { EventedListener } from 'mapbox-gl';

let mapDrawerController: MapboxDraw | undefined = undefined;

export function getMapDrawer() {
    return mapDrawerController;
}

//source: https://github.com/visgl/react-map-gl/blob/master/examples/draw-polygon/src/
type DrawControlProps = ConstructorParameters<typeof MapboxDraw>[0] & {
    position?: ControlPosition;
    readyToDisplay: boolean;
    onDrawPolygonModeActive: (polygoneDrawing: boolean) => void;
    onCreate: EventedListener;
    onUpdate: EventedListener;
    onDelete: EventedListener;
};

function resetFirstPolygonDrawing() {
    if (
        mapDrawerController !== undefined &&
        mapDrawerController.getAll().features.length > 1
    ) {
        //reset the first polygon, because we only want to draw one polygon
        const idFirstPolygon = mapDrawerController.getAll().features[0].id;
        mapDrawerController?.delete(String(idFirstPolygon));
    }
}

export default function DrawControl(props: DrawControlProps) {
    const { onDrawPolygonModeActive } = props;
    const onModeChange = useCallback(
        (e: { mode: string }) => {
            if (e.mode === 'draw_polygon') {
                onDrawPolygonModeActive(true);
                resetFirstPolygonDrawing();
            } else {
                onDrawPolygonModeActive(false);
            }
        },
        [onDrawPolygonModeActive]
    );

    useControl<MapboxDraw>(
        //onCreate
        () => {
            mapDrawerController = new MapboxDraw({ ...props });
            return mapDrawerController;
        },
        //on add
        ({ map }) => {
            map.on('draw.create', props.onCreate);
            map.on('draw.update', props.onUpdate);
            map.on('draw.delete', props.onDelete);
            map.on('draw.modechange', onModeChange);
        },
        //onRemove
        ({ map }) => {
            map.off('draw.create', props.onCreate);
            map.off('draw.update', props.onUpdate);
            map.off('draw.delete', props.onDelete);
            map.off('draw.modechange', onModeChange);
        },
        {
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
