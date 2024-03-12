/* eslint-disable @typescript-eslint/no-explicit-any */
// import { useSnackMessage } from '@gridsuite/commons-ui';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
// import { EQUIPMENT_TYPES } from 'components/utils/equipment-types';
import { UUID } from 'crypto';
import { useCallback, useEffect, useState } from 'react';
import { useControl } from 'react-map-gl';

import type { ControlPosition } from 'react-map-gl';
import { GeoData } from './geo-data';

// FIXME: to speed up the development, i skiped the type definitions
// eslint-disable-next-line no-var
var draw: MapboxDraw | undefined = undefined;

//source: https://github.com/visgl/react-map-gl/blob/master/examples/draw-polygon/src/
type DrawControlProps = ConstructorParameters<typeof MapboxDraw>[0] & {
    position?: ControlPosition;
    readyToDisplay: boolean;
    studyUuid: UUID;
    mapEquipments: any;
    geoData: any;
    onDrawModeChanged: (polygoneDrawing: boolean) => void;
};

function getVoltageLevelInPolygone(
    features: any,
    mapEquipments: any,
    geoData: GeoData,
    readyToDisplay: boolean
) {
    // in case we want to handle multiple polygons drawing, we need to handle the features as an array
    const firstPolygonFeatures: any = Object.values(features)[0];
    const polygoneCoordinates = firstPolygonFeatures?.geometry;
    if (!polygoneCoordinates || polygoneCoordinates.coordinates < 3) {
        return null;
    }
    //get the list of substation
    const substationsList = readyToDisplay ? mapEquipments?.substations : [];

    const positions = substationsList // we need a list of substation and their positions
        .map((substation: any) => {
            return {
                substation: substation,
                pos: geoData.getSubstationPosition(substation.id),
            };
        });
    if (!positions) {
        return null;
    }

    const substationsInsidePolygone = positions.filter((substation: any) => {
        return booleanPointInPolygon(substation.pos, polygoneCoordinates);
    });

    const voltageLevels = substationsInsidePolygone
        .map((substation: any) => {
            return substation.substation.voltageLevels;
        })
        .flat();

    return voltageLevels;
}

export default function DrawControl(props: DrawControlProps | any) {
    const [features, setFeatures] = useState<any>({});

    const onUpdate = useCallback((e: any) => {
        setFeatures((currFeatures: any) => {
            // draw?.deleteAll(); // to delete the polygone
            const newFeatures: any = { ...currFeatures };
            for (const f of e.features) {
                newFeatures[f.id] = f;
            }

            return newFeatures;
        });
    }, []);

    const onDelete = useCallback((e: any) => {
        setFeatures((currFeatures: any) => {
            const newFeatures = { ...currFeatures };
            for (const f of e.features) {
                delete newFeatures[f.id];
            }
            return newFeatures;
        });
    }, []);

    const onModeChange = useCallback((e: any) => {
        if (e.mode === 'draw_polygon') {
            props.onDrawModeChanged(true);
            // draw?.getAll().features.length > 0
        } else {
            // mode === 'simple_select'
            props.onDrawModeChanged(false);
        }
    }, []);

    useEffect(() => {
        const voltageLevels = getVoltageLevelInPolygone(
            features,
            props.mapEquipments,
            props.geoData,
            props.readyToDisplay
        );
        if (!voltageLevels) {
            return;
        }
    }, [features]);

    useControl<MapboxDraw>(
        //onCreate
        () => {
            draw = new MapboxDraw({ ...props });
            return draw;
        },
        //on add
        ({ map }) => {
            map.on('draw.create', onUpdate);
            map.on('draw.update', onUpdate);
            map.on('draw.delete', onDelete);
            map.on('draw.modechange', onModeChange);

            // add keybinding to save the filter ??
            // map.getContainer().addEventListener()
        },
        //onRemove
        ({ map }) => {
            map.off('draw.create', onUpdate);
            map.off('draw.update', onUpdate);
            map.off('draw.delete', onDelete);
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
    // onCreate: () => {},
    // onUpdate: () => {},
    // onDelete: () => {},
};
