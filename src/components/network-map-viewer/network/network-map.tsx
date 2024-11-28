/**
 * Copyright (c) 2020, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {
    forwardRef,
    memo,
    type ReactNode,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Box, Button, type ButtonProps, decomposeColor, useTheme } from '@mui/material';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { Replay } from '@mui/icons-material';
import { FormattedMessage } from 'react-intl';
import {
    Map,
    type MapLib,
    type MapRef,
    NavigationControl,
    useControl,
    type ViewState,
    type ViewStateChangeEvent,
} from 'react-map-gl';
import { getNominalVoltageColor } from '../../../utils/colors';
import { useNameOrId } from '../utils/equipmentInfosHandler';
import { GeoData } from './geo-data';
import DrawControl, { type DrawControlProps, getMapDrawer } from './draw-control';
import { LineFlowColorMode, LineFlowMode, LineLayer, type LineLayerProps } from './line-layer';
import { MapEquipments } from './map-equipments';
import { SubstationLayer } from './substation-layer';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import LoaderWithOverlay from '../utils/loader-with-overlay';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { type Feature, type Polygon } from 'geojson';
import {
    type EquimentLine,
    type Equipment,
    EQUIPMENT_TYPES,
    type HvdcLineEquimentLine,
    isLine,
    isSubstation,
    isVoltageLevel,
    type Line,
    type LineEquimentLine,
    type Substation,
    type TieLineEquimentLine,
    type VoltageLevel,
} from '../utils/equipment-types';
import { PickingInfo } from 'deck.gl';

// MouseEvent.button https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
const MOUSE_EVENT_BUTTON_LEFT = 0;
const MOUSE_EVENT_BUTTON_RIGHT = 2;

/**
 * Represents the draw event types for the network map.
 * when a draw event is triggered, the event type is passed to the onDrawEvent callback
 * On create, when the user create a new polygon (shape finished)
 */
export enum DRAW_EVENT {
    CREATE = 1,
    UPDATE = 2,
    DELETE = 0,
}

export type MenuClickFunction<T extends Equipment> = (equipment: T, eventX: number, eventY: number) => void;

// Small boilerplate recommended by deckgl, to bridge to a react-map-gl control declaratively
// see https://deck.gl/docs/api-reference/mapbox/mapbox-overlay#using-with-react-map-gl
const DeckGLOverlay = forwardRef((props, ref) => {
    const overlay = useControl(() => new MapboxOverlay(props));
    overlay.setProps(props);
    useImperativeHandle(ref, () => overlay, [overlay]);
    return null;
});

type TooltipType = {
    equipmentId: string;
    equipmentType: string;
    pointerX: number;
    pointerY: number;
    visible: boolean;
};

const PICKING_RADIUS = 5;

const CARTO = 'carto';
const CARTO_NOLABEL = 'cartonolabel';
const MAPBOX = 'mapbox';
type MapLibrary = typeof CARTO | typeof CARTO_NOLABEL | typeof MAPBOX;

const LIGHT = 'light';
const DARK = 'dark';
type MapTheme = typeof LIGHT | typeof DARK;

const styles = {
    mapManualRefreshBackdrop: {
        width: '100%',
        height: '100%',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'grey',
        opacity: '0.8',
        zIndex: 99,
        fontSize: 30,
    },
};

const FALLBACK_MAPBOX_TOKEN =
    'pk.eyJ1IjoiZ2VvZmphbWciLCJhIjoiY2pwbnRwcm8wMDYzMDQ4b2pieXd0bDMxNSJ9.Q4aL20nBo5CzGkrWtxroug';

const SUBSTATION_LAYER_PREFIX = 'substationLayer';
const LINE_LAYER_PREFIX = 'lineLayer';
const LABEL_SIZE = 12;

type Centered = {
    lastCenteredSubstation: string | null;
    centeredSubstationId?: string | null;
    centered: boolean;
};

const INITIAL_CENTERED = {
    lastCenteredSubstation: null,
    centeredSubstationId: null,
    centered: false,
} satisfies Centered;

const DEFAULT_LOCATE_SUBSTATION_ZOOM_LEVEL = 12;

// get polygon coordinates (features) or an empty object
function getPolygonFeatures(): Feature | Record<string, never> {
    return getMapDrawer()?.getAll()?.features[0] ?? {};
}

type NetworkMapProps = {
    disabled?: boolean;
    geoData?: GeoData | null;
    mapBoxToken?: string | null;
    mapEquipments?: MapEquipments | null;
    mapLibrary?: 'carto' | 'cartonolabel' | 'mapbox';
    mapTheme?: 'light' | 'dark';
    areFlowsValid?: boolean;
    arrowsZoomThreshold?: number;
    centerOnSubstation?: { to: string } | null;
    displayOverlayLoader?: boolean;
    filteredNominalVoltages?: number[] | null;
    initialPosition?: [number, number];
    initialZoom?: number;
    isManualRefreshBackdropDisplayed?: boolean;
    labelsZoomThreshold?: number;
    lineFlowAlertThreshold?: number;
    lineFlowColorMode?: LineFlowColorMode;
    lineFlowMode?: LineFlowMode;
    lineFullPath?: boolean;
    lineParallelPath?: boolean;
    renderPopover?: (equipmentId: string, divRef: HTMLDivElement | null) => ReactNode;
    tooltipZoomThreshold?: number;
    // With mapboxgl v2 (not a problem with maplibre), we need to call
    // map.resize() when the parent size has changed, otherwise the map is not
    // redrawn. It seems like this is autodetected when the browser window is
    // resized, but not for programmatic resizes of the parent. For now in our
    // app, only study display mode resizes programmatically
    // use this prop to make the map resize when needed, each time this prop changes, map.resize() is trigged
    triggerMapResizeOnChange?: unknown;
    updatedLines?: LineLayerProps['updatedLines'];
    useName?: boolean;
    visible?: boolean;
    shouldDisableToolTip?: boolean;
    locateSubStationZoomLevel?: number;
    onHvdcLineMenuClick?: MenuClickFunction<Line>;
    onLineMenuClick?: MenuClickFunction<Line>;
    onTieLineMenuClick?: MenuClickFunction<Line>;
    onManualRefreshClick?: ButtonProps['onClick'];
    onSubstationClick?: (idVoltageLevel: string) => void;
    onSubstationClickChooseVoltageLevel?: (idSubstation: string, eventX: number, eventY: number) => void;
    onSubstationMenuClick?: MenuClickFunction<Substation>;
    onVoltageLevelMenuClick?: MenuClickFunction<VoltageLevel>;
    onDrawPolygonModeActive?: DrawControlProps['onDrawPolygonModeActive'];
    onPolygonChanged?: (polygoneFeature: Feature | Record<string, never>) => void;
    onDrawEvent?: (drawEvent: DRAW_EVENT) => void;
};

export type NetworkMapRef = {
    getSelectedSubstations: () => Substation[];
    getSelectedLines: () => Line[];
    cleanDraw: () => void;
    getMapDrawer: () => MapboxDraw | undefined;
};

const NetworkMap = forwardRef<NetworkMapRef, NetworkMapProps>(
    (
        {
            areFlowsValid = true,
            arrowsZoomThreshold = 7,
            centerOnSubstation = null,
            disabled = false,
            displayOverlayLoader = false,
            filteredNominalVoltages = null,
            geoData = null,
            initialPosition = [0, 0],
            initialZoom = 5,
            isManualRefreshBackdropDisplayed = false,
            labelsZoomThreshold = 9,
            lineFlowAlertThreshold = 100,
            lineFlowColorMode = LineFlowColorMode.NOMINAL_VOLTAGE,
            lineFlowMode = LineFlowMode.FEEDERS,
            lineFullPath = true,
            lineParallelPath = true,
            mapBoxToken = null,
            mapEquipments = null,
            mapLibrary = CARTO,
            tooltipZoomThreshold = 7,
            mapTheme = DARK,
            triggerMapResizeOnChange = false,
            updatedLines = [],
            useName = true,
            visible = true,
            shouldDisableToolTip = false,
            locateSubStationZoomLevel = DEFAULT_LOCATE_SUBSTATION_ZOOM_LEVEL,
            onSubstationClick = () => {},
            onSubstationClickChooseVoltageLevel = () => {},
            onSubstationMenuClick = () => {},
            onVoltageLevelMenuClick = () => {},
            onLineMenuClick = () => {},
            onTieLineMenuClick = () => {},
            onHvdcLineMenuClick = () => {},
            onManualRefreshClick = () => {},
            renderPopover = (eId) => eId,
            onDrawPolygonModeActive = (active) =>
                console.log('polygon drawing mode active: ', active ? 'active' : 'inactive'),
            onPolygonChanged = () => {},
            onDrawEvent = () => {},
        },
        ref
    ) => {
        const [labelsVisible, setLabelsVisible] = useState(false);
        const [showLineFlow, setShowLineFlow] = useState(true);
        const [showTooltip, setShowTooltip] = useState(true);
        const mapRef = useRef<MapRef>(null);
        const deckRef = useRef<MapboxOverlay | null>();
        const [centered, setCentered] = useState<Centered>(INITIAL_CENTERED);
        const lastViewStateRef = useRef<ViewState>();
        const [tooltip, setTooltip] = useState<TooltipType | Record<string, never> | null>({});
        const theme = useTheme();
        const foregroundNeutralColor = useMemo(() => {
            const labelColor = decomposeColor(theme.palette.text.primary).values as [number, number, number, number];
            labelColor[3] *= 255;
            return labelColor;
        }, [theme]);
        const [cursorType, setCursorType] = useState('grab');
        const [isDragging, setDragging] = useState(false);

        const { getNameOrId } = useNameOrId(useName);

        const readyToDisplay = mapEquipments !== null && geoData !== null && !disabled;

        const readyToDisplaySubstations =
            readyToDisplay && mapEquipments.substations && geoData.substationPositionsById.size > 0;

        const readyToDisplayLines =
            readyToDisplay &&
            (mapEquipments?.lines || mapEquipments?.hvdcLines || mapEquipments?.tieLines) &&
            mapEquipments.voltageLevels &&
            geoData.substationPositionsById.size > 0;

        const mapEquipmentsLines: EquimentLine[] = useMemo(
            () => [
                ...(mapEquipments?.lines.map(
                    (line) =>
                        ({
                            ...line,
                            equipmentType: EQUIPMENT_TYPES.LINE,
                        } as LineEquimentLine)
                ) ?? []),
                ...(mapEquipments?.tieLines.map(
                    (tieLine) =>
                        ({
                            ...tieLine,
                            equipmentType: EQUIPMENT_TYPES.TIE_LINE,
                        } as TieLineEquimentLine)
                ) ?? []),
                ...(mapEquipments?.hvdcLines.map(
                    (hvdcLine) =>
                        ({
                            ...hvdcLine,
                            equipmentType: EQUIPMENT_TYPES.HVDC_LINE,
                        } as HvdcLineEquimentLine)
                ) ?? []),
            ],
            [mapEquipments?.hvdcLines, mapEquipments?.tieLines, mapEquipments?.lines]
        );

        const divRef = useRef<HTMLDivElement>(null);

        const mToken = !mapBoxToken ? FALLBACK_MAPBOX_TOKEN : mapBoxToken;

        useEffect(() => {
            if (centerOnSubstation === null) {
                return;
            }
            setCentered({
                lastCenteredSubstation: null,
                centeredSubstationId: centerOnSubstation?.to,
                centered: true,
            });
        }, [centerOnSubstation]);

        // TODO simplify this, now we use Map as the camera controlling component
        // so  we don't need the deckgl ref anymore. The following comments are
        // probably outdated, cleanup everything:
        // Do this in onAfterRender because when doing it in useEffect (triggered by calling setDeck()),
        // it doesn't work in the case of using the browser backward/forward buttons (because in this particular case,
        // we get the ref to the deck and it has not yet initialized..)
        function onAfterRender() {
            // TODO outdated comment
            //use centered and deck to execute this block only once when the data is ready and deckgl is initialized
            //TODO, replace the next lines with setProps( { initialViewState } ) when we upgrade to 8.1.0
            //see https://github.com/uber/deck.gl/pull/4038
            //This is a hack because it accesses the properties of deck directly but for now it works
            if (
                (!centered.centered ||
                    (centered.centeredSubstationId &&
                        centered.centeredSubstationId !== centered.lastCenteredSubstation)) &&
                geoData !== null
            ) {
                if (geoData.substationPositionsById.size > 0) {
                    if (centered.centeredSubstationId) {
                        const geodata = geoData.substationPositionsById.get(centered.centeredSubstationId);
                        if (!geodata) {
                            return;
                        } // can't center on substation if no coordinate.
                        mapRef.current?.flyTo({
                            center: [geodata.lon, geodata.lat],
                            duration: 2000,
                            // only zoom if the current zoom is smaller than the new one
                            zoom: Math.max(mapRef.current?.getZoom(), locateSubStationZoomLevel),
                            essential: true,
                        });
                        setCentered({
                            lastCenteredSubstation: centered.centeredSubstationId,
                            centeredSubstationId: centered.centeredSubstationId,
                            centered: true,
                        });
                    } else {
                        const coords = Array.from(geoData.substationPositionsById.entries()).map((x) => x[1]);
                        const maxlon = Math.max.apply(
                            null,
                            coords.map((x) => x.lon)
                        );
                        const minlon = Math.min.apply(
                            null,
                            coords.map((x) => x.lon)
                        );
                        const maxlat = Math.max.apply(
                            null,
                            coords.map((x) => x.lat)
                        );
                        const minlat = Math.min.apply(
                            null,
                            coords.map((x) => x.lat)
                        );
                        const marginlon = (maxlon - minlon) / 10;
                        const marginlat = (maxlat - minlat) / 10;
                        mapRef.current?.fitBounds(
                            [
                                [minlon - marginlon / 2, minlat - marginlat / 2],
                                [maxlon + marginlon / 2, maxlat + marginlat / 2],
                            ],
                            { animate: false }
                        );
                        setCentered({
                            lastCenteredSubstation: null,
                            centered: true,
                        });
                    }
                }
            }
        }

        function onViewStateChange(info: ViewStateChangeEvent) {
            lastViewStateRef.current = info.viewState;
            if (
                // @ts-expect-error: TODO fix interactionState
                !info.interactionState || // first event of before an animation (e.g. clicking the +/- buttons of the navigation controls, gives the target
                // @ts-expect-error: TODO fix interactionState
                (info.interactionState && !info.interactionState.inTransition) // Any event not part of an animation (mouse panning or zooming)
            ) {
                if (info.viewState.zoom >= labelsZoomThreshold && !labelsVisible) {
                    setLabelsVisible(true);
                } else if (info.viewState.zoom < labelsZoomThreshold && labelsVisible) {
                    setLabelsVisible(false);
                }
                setShowTooltip(info.viewState.zoom >= tooltipZoomThreshold);
                setShowLineFlow(info.viewState.zoom >= arrowsZoomThreshold);
            }
        }

        function renderTooltip() {
            return (
                tooltip &&
                tooltip.visible &&
                !shouldDisableToolTip &&
                //As of now only LINE tooltip is implemented, the following condition is to be removed or tweaked once other types of line tooltip are implemented
                tooltip.equipmentType === EQUIPMENT_TYPES.LINE && (
                    <div
                        ref={divRef}
                        style={{
                            position: 'absolute',
                            color: theme.palette.text.primary,
                            zIndex: 1,
                            pointerEvents: 'none',
                            left: tooltip.pointerX,
                            top: tooltip.pointerY,
                        }}
                    >
                        {tooltip.equipmentId && divRef.current && renderPopover(tooltip.equipmentId, divRef.current)}
                    </div>
                )
            );
        }

        function onClickHandler(
            info: PickingInfo,
            event: mapboxgl.MapLayerMouseEvent | maplibregl.MapLayerMouseEvent,
            network: MapEquipments
        ) {
            const leftButton = event.originalEvent.button === MOUSE_EVENT_BUTTON_LEFT;
            const rightButton = event.originalEvent.button === MOUSE_EVENT_BUTTON_RIGHT;
            if (
                info.layer &&
                info.layer.id.startsWith(SUBSTATION_LAYER_PREFIX) &&
                info.object &&
                (isSubstation(info.object) || isVoltageLevel(info.object)) // is a voltage level marker, or a substation text
            ) {
                let idVl;
                let idSubstation;
                if (isVoltageLevel(info.object)) {
                    idVl = info.object.id;
                } else if (isSubstation(info.object)) {
                    if (info.object.voltageLevels.length === 1) {
                        const idS = info.object.voltageLevels[0].substationId;
                        const substation = network.getSubstation(idS);
                        if (substation && substation.voltageLevels.length > 1) {
                            idSubstation = idS;
                        } else {
                            idVl = info.object.voltageLevels[0].id;
                        }
                    } else {
                        idSubstation = info.object.voltageLevels[0].substationId;
                    }
                }
                if (idVl !== undefined) {
                    if (onSubstationClick && leftButton) {
                        onSubstationClick(idVl);
                    } else if (onVoltageLevelMenuClick && rightButton) {
                        onVoltageLevelMenuClick(
                            network.getVoltageLevel(idVl)!,
                            event.originalEvent.x,
                            event.originalEvent.y
                        );
                    }
                }
                if (idSubstation !== undefined) {
                    if (onSubstationClickChooseVoltageLevel && leftButton) {
                        onSubstationClickChooseVoltageLevel(idSubstation, event.originalEvent.x, event.originalEvent.y);
                    } else if (onSubstationMenuClick && rightButton) {
                        onSubstationMenuClick(
                            network.getSubstation(idSubstation)!,
                            event.originalEvent.x,
                            event.originalEvent.y
                        );
                    }
                }
            }
            if (
                rightButton &&
                info.layer &&
                info.layer.id.startsWith(LINE_LAYER_PREFIX) &&
                info.object &&
                isLine(info.object)
            ) {
                // picked line properties are retrieved from network data and not from pickable object infos,
                // because pickable object infos might not be up to date
                const line = network.getLine(info.object.id);
                const tieLine = network.getTieLine(info.object.id);
                const hvdcLine = network.getHvdcLine(info.object.id);

                const equipment = line || tieLine || hvdcLine;
                if (equipment) {
                    const menuClickFunction =
                        equipment === line
                            ? onLineMenuClick
                            : equipment === tieLine
                            ? onTieLineMenuClick
                            : onHvdcLineMenuClick;

                    menuClickFunction(equipment, event.originalEvent.x, event.originalEvent.y);
                }
            }
        }

        function onMapContextMenu(event: mapboxgl.MapLayerMouseEvent | maplibregl.MapLayerMouseEvent) {
            const info = deckRef.current?.pickObject({
                x: event.point.x,
                y: event.point.y,
                radius: PICKING_RADIUS,
            });
            info && mapEquipments && onClickHandler(info, event, mapEquipments);
        }

        function cursorHandler() {
            return isDragging ? 'grabbing' : cursorType;
        }

        const layers = [];

        if (readyToDisplaySubstations) {
            layers.push(
                new SubstationLayer({
                    id: SUBSTATION_LAYER_PREFIX,
                    data: mapEquipments?.substations,
                    network: mapEquipments,
                    geoData: geoData,
                    getNominalVoltageColor: getNominalVoltageColor,
                    filteredNominalVoltages: filteredNominalVoltages,
                    labelsVisible: labelsVisible,
                    labelColor: foregroundNeutralColor,
                    labelSize: LABEL_SIZE,
                    pickable: true,
                    onHover: ({ object }) => setCursorType(object ? 'pointer' : 'grab'),
                    getNameOrId: getNameOrId,
                })
            );
        }

        if (readyToDisplayLines) {
            layers.push(
                new LineLayer({
                    areFlowsValid: areFlowsValid,
                    id: LINE_LAYER_PREFIX,
                    data: mapEquipmentsLines,
                    network: mapEquipments,
                    updatedLines: updatedLines,
                    geoData: geoData,
                    getNominalVoltageColor: getNominalVoltageColor,
                    disconnectedLineColor: foregroundNeutralColor,
                    filteredNominalVoltages: filteredNominalVoltages,
                    lineFlowMode: lineFlowMode,
                    showLineFlow: visible && showLineFlow,
                    lineFlowColorMode: lineFlowColorMode,
                    lineFlowAlertThreshold: lineFlowAlertThreshold,
                    lineFullPath: geoData.linePositionsById.size > 0 && lineFullPath,
                    lineParallelPath: lineParallelPath,
                    labelsVisible: labelsVisible,
                    labelColor: foregroundNeutralColor,
                    labelSize: LABEL_SIZE,
                    pickable: true,
                    onHover: ({ object: lineObject, x, y }: PickingInfo) => {
                        if (lineObject) {
                            setCursorType('pointer');
                            setTooltip({
                                equipmentId: lineObject?.id,
                                equipmentType: (lineObject as EquimentLine)?.equipmentType,
                                pointerX: x,
                                pointerY: y,
                                visible: showTooltip,
                            });
                        } else {
                            setCursorType('grab');
                            setTooltip(null);
                        }
                    },
                })
            );
        }

        const initialViewState = {
            longitude: initialPosition[0],
            latitude: initialPosition[1],
            zoom: initialZoom,
            maxZoom: 14,
            pitch: 0,
            bearing: 0,
        };

        const renderOverlay = () => (
            <LoaderWithOverlay color="inherit" loaderSize={70} isFixed={false} loadingMessageText={'loadingGeoData'} />
        );

        useEffect(() => {
            mapRef.current?.resize();
        }, [mapRef, triggerMapResizeOnChange]);

        const getMapStyle = (mapLibrary: MapLibrary, mapTheme: MapTheme) => {
            switch (mapLibrary) {
                case MAPBOX:
                    if (mapTheme === LIGHT) {
                        return 'mapbox://styles/mapbox/light-v9';
                    } else {
                        return 'mapbox://styles/mapbox/dark-v9';
                    }
                case CARTO:
                    if (mapTheme === LIGHT) {
                        return 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
                    } else {
                        return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
                    }
                case CARTO_NOLABEL:
                    if (mapTheme === LIGHT) {
                        return 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';
                    } else {
                        return 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';
                    }
                default:
                    return 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
            }
        };

        const mapStyle = useMemo(() => getMapStyle(mapLibrary, mapTheme), [mapLibrary, mapTheme]);

        const key = mapLibrary === MAPBOX && mToken ? 'mapboxgl' : 'maplibregl';

        const mapLib =
            mapLibrary === MAPBOX
                ? mToken && {
                      mapLib: mapboxgl,
                      mapboxAccessToken: mToken,
                  }
                : { mapLib: maplibregl };

        // because the mapLib prop of react-map-gl is not reactive, we need to
        // unmount/mount the Map with 'key', so we need also to reset all state
        // associated with uncontrolled state of the map
        useEffect(() => setCentered(INITIAL_CENTERED), [key]);

        const onUpdate = useCallback(() => {
            onPolygonChanged(getPolygonFeatures());
            onDrawEvent(DRAW_EVENT.UPDATE);
        }, [onDrawEvent, onPolygonChanged]);

        const onCreate = useCallback(() => {
            onPolygonChanged(getPolygonFeatures());
            onDrawEvent(DRAW_EVENT.CREATE);
        }, [onDrawEvent, onPolygonChanged]);
        const getSelectedLines = useCallback(() => {
            const polygonFeatures = getPolygonFeatures();
            const polygonCoordinates = polygonFeatures?.geometry;
            if (
                !polygonCoordinates ||
                polygonCoordinates.type !== 'Polygon' ||
                polygonCoordinates.coordinates[0].length < 3
            ) {
                return [];
            }
            //for each line, check if it is in the polygon
            const selectedLines = getSelectedLinesInPolygon(
                mapEquipments,
                mapEquipmentsLines,
                geoData,
                polygonCoordinates
            );
            return selectedLines.filter((line: Line) =>
                filteredNominalVoltages!.some(
                    (nv) =>
                        nv === mapEquipments!.getVoltageLevel(line.voltageLevelId1)!.nominalV ||
                        nv === mapEquipments!.getVoltageLevel(line.voltageLevelId2)!.nominalV
                )
            );
        }, [mapEquipments, mapEquipmentsLines, geoData, filteredNominalVoltages]);

        const getSelectedSubstations = useCallback(() => {
            const substations = getSubstationsInPolygon(getPolygonFeatures(), mapEquipments, geoData);
            if (filteredNominalVoltages === null) {
                return substations;
            }
            return (
                substations.filter((substation) =>
                    substation.voltageLevels.some((vl) => filteredNominalVoltages.includes(vl.nominalV))
                ) ?? []
            );
        }, [mapEquipments, geoData, filteredNominalVoltages]);

        useImperativeHandle(
            ref,
            () => ({
                getSelectedSubstations,
                getSelectedLines,
                cleanDraw() {
                    //because deleteAll does not trigger an update of the polygonFeature callback
                    getMapDrawer()?.deleteAll();
                    onPolygonChanged(getPolygonFeatures());
                    onDrawEvent(DRAW_EVENT.DELETE);
                },
                getMapDrawer,
            }),
            [onPolygonChanged, getSelectedSubstations, getSelectedLines, onDrawEvent]
        );

        const onDelete = useCallback(() => {
            onPolygonChanged(getPolygonFeatures());
            onDrawEvent(DRAW_EVENT.DELETE);
        }, [onPolygonChanged, onDrawEvent]);

        return (
            mapLib && (
                <Map
                    ref={mapRef}
                    style={{ zIndex: 0 }}
                    onMove={onViewStateChange}
                    doubleClickZoom={false}
                    mapStyle={mapStyle}
                    styleDiffing={true}
                    initialViewState={initialViewState}
                    cursor={cursorHandler()} //TODO needed for pointer on our polygonFeatures, but forces us to reimplement grabbing/grab for panning. Can we avoid reimplementing?
                    onDrag={() => setDragging(true)}
                    onDragEnd={() => setDragging(false)}
                    onContextMenu={onMapContextMenu}
                    mapLib={mapLib.mapLib as MapLib<mapboxgl.Map>}
                >
                    {displayOverlayLoader && renderOverlay()}
                    {isManualRefreshBackdropDisplayed && (
                        <Box sx={styles.mapManualRefreshBackdrop}>
                            <Button onClick={onManualRefreshClick} aria-label="reload" color="inherit" size="large">
                                <Replay />
                                <FormattedMessage id="ManuallyRefreshGeoData" />
                            </Button>
                        </Box>
                    )}
                    <DeckGLOverlay
                        ref={deckRef}
                        //@ts-expect-error: TODO fix event
                        onClick={(info: PickingInfo, event) =>
                            onClickHandler(
                                info,
                                event.srcEvent as mapboxgl.MapLayerMouseEvent | maplibregl.MapLayerMouseEvent,
                                mapEquipments!
                            )
                        }
                        onAfterRender={onAfterRender} // TODO simplify this
                        layers={layers}
                        pickingRadius={PICKING_RADIUS}
                    />
                    {showTooltip && renderTooltip()}
                    {/* visualizePitch true makes the compass reset the pitch when clicked in addition to visualizing it */}
                    <NavigationControl visualizePitch={true} />
                    <DrawControl
                        position="bottom-left"
                        displayControlsDefault={false}
                        controls={{
                            polygon: true,
                            trash: true,
                        }}
                        // defaultMode="simple_select | draw_polygon | ...
                        defaultMode="simple_select"
                        readyToDisplay={readyToDisplay}
                        onDrawPolygonModeActive={onDrawPolygonModeActive}
                        onCreate={onCreate}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                    />
                </Map>
            )
        );
    }
);

export default memo(NetworkMap);

function getSubstationsInPolygon(
    features: Partial<Feature>, // Feature from geojson
    mapEquipments: MapEquipments | null,
    geoData: GeoData | null
) {
    const polygonCoordinates = features?.geometry;
    if (
        !geoData ||
        !polygonCoordinates ||
        polygonCoordinates.type !== 'Polygon' ||
        polygonCoordinates.coordinates[0].length < 3
    ) {
        return [];
    }
    //get the list of substation
    const substationsList = mapEquipments?.substations ?? [];
    //for each substation, check if it is in the polygon
    return substationsList // keep only the substation in the polygon
        .filter((substation) => {
            const pos = geoData.getSubstationPosition(substation.id);
            return booleanPointInPolygon(pos, polygonCoordinates);
        });
}

function getSelectedLinesInPolygon(
    network: MapEquipments | null,
    lines: Line[],
    geoData: GeoData | null,
    polygonCoordinates: Polygon
) {
    return lines.filter((line) => {
        try {
            const linePos = network ? geoData?.getLinePositions(network, line) : null;
            if (!linePos) {
                return false;
            }
            if (linePos.length < 2) {
                return false;
            }
            const extremities = [linePos[0], linePos[linePos.length - 1]];
            return extremities.some((pos) => booleanPointInPolygon(pos, polygonCoordinates));
        } catch (error) {
            console.error(error);
            return false;
        }
    });
}
