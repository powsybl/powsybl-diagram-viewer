/**
 * Copyright (c) 2020, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type { LiteralUnion } from 'type-fest';
import PropTypes from 'prop-types';
import {
    forwardRef,
    memo,
    type ReactNode,
    RefObject,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Box, decomposeColor } from '@mui/system';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { Replay } from '@mui/icons-material';
import { Button, type ButtonProps, useTheme } from '@mui/material';
import { FormattedMessage } from 'react-intl';
import { Map, type MapProps, type MapRef, NavigationControl, useControl, type ViewState } from 'react-map-gl';
import type { Feature, Polygon } from 'geojson';
import { type Layer, type PickingInfo } from 'deck.gl';
import type MapboxDraw from '@mapbox/mapbox-gl-draw';
//import type { MjolnirGestureEvent } from 'mjolnir.js';
import { getNominalVoltageColor } from '../../../utils/colors';
import { useNameOrId } from '../utils/equipmentInfosHandler';
import { GeoData } from './geo-data';
import DrawControl, { type DrawControlProps, getMapDrawer } from './draw-control';
import { LineFlowColorMode, LineFlowMode, LineLayer, type LineLayerProps } from './line-layer';
import { MapEquipments } from './map-equipments';
import { SubstationLayer } from './substation-layer';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import LoaderWithOverlay from '../utils/loader-with-overlay';
import mapboxgl, { type MapLayerMouseEvent as MapBoxLayerMouseEvent } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import maplibregl, { type MapLayerMouseEvent as MapLibreLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import {
    EQUIPMENT_TYPES,
    type MapAnyLine,
    type MapAnyLineWithType,
    type MapEquipment,
    type MapHvdcLine,
    type MapLine,
    type MapSubstation,
    type MapTieLine,
    type MapVoltageLevel,
} from '../../../equipment-types';

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

// Small boilerplate recommended by deckgl, to bridge to a react-map-gl control declaratively
// see https://deck.gl/docs/api-reference/mapbox/mapbox-overlay#using-with-react-map-gl
const DeckGLOverlay = forwardRef<MapboxOverlay, MapboxOverlayProps>((props, ref) => {
    const overlay = useControl(() => new MapboxOverlay(props));
    overlay.setProps(props);
    useImperativeHandle(ref, () => overlay, [overlay]);
    return null;
});

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

const INITIAL_CENTERED: Centered = {
    lastCenteredSubstation: null,
    centeredSubstationId: null,
    centered: false,
};

const DEFAULT_LOCATE_SUBSTATION_ZOOM_LEVEL = 12;

// get polygon coordinates (features) or an empty object
function getPolygonFeatures() {
    return getMapDrawer()?.getAll()?.features[0] ?? ({} as Record<string, never>);
}

type TooltipType = {
    equipmentId: string;
    equipmentType: EQUIPMENT_TYPES;
    pointerX: number;
    pointerY: number;
    visible: boolean;
};

export type MenuClickFunction<T extends MapEquipment> = (equipment: T, eventX: number, eventY: number) => void;

export type NetworkMapProps = {
    disabled?: boolean;
    geoData?: GeoData;
    mapBoxToken?: string;
    mapEquipments?: MapEquipments;
    mapLibrary?: LiteralUnion<MapLibrary, string>;
    mapTheme?: LiteralUnion<MapTheme, string>;
    areFlowsValid?: boolean;
    arrowsZoomThreshold?: number;
    centerOnSubstation?: { to: string };
    displayOverlayLoader?: boolean;
    filteredNominalVoltages?: number[];
    initialPosition?: [number, number];
    initialZoom?: number;
    isManualRefreshBackdropDisplayed?: boolean;
    labelsZoomThreshold?: number;
    lineFlowAlertThreshold?: number;
    lineFlowColorMode?: LineFlowColorMode;
    lineFlowMode?: LineFlowMode;
    lineFullPath?: boolean;
    lineParallelPath?: boolean;
    renderPopover?: (equipmentId: string, divRef: RefObject<HTMLDivElement>) => ReactNode;
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
    onHvdcLineMenuClick?: MenuClickFunction<MapHvdcLine>;
    onLineMenuClick?: MenuClickFunction<MapLine>;
    onTieLineMenuClick?: MenuClickFunction<MapTieLine>;
    onManualRefreshClick?: ButtonProps['onClick'];
    onSubstationClick?: (idVoltageLevel: string) => void;
    onSubstationClickChooseVoltageLevel?: (idSubstation: string, eventX: number, eventY: number) => void;
    onSubstationMenuClick?: MenuClickFunction<MapSubstation>;
    onVoltageLevelMenuClick?: MenuClickFunction<MapVoltageLevel>;
    onDrawPolygonModeActive?: DrawControlProps['onDrawPolygonModeActive'];
    onPolygonChanged?: (polygoneFeature: Feature | Record<string, never>) => void;
    onDrawEvent?: (drawEvent: DRAW_EVENT) => void;
};

export type NetworkMapRef = {
    getSelectedSubstations: () => MapSubstation[];
    getSelectedLines: () => MapAnyLine[];
    cleanDraw: () => void;
    getMapDrawer: () => MapboxDraw | undefined;
};

const NetworkMap = forwardRef<NetworkMapRef, NetworkMapProps>((rawProps, ref) => {
    const props = {
        // TODO: move defaults in function args (done like that for now to reduce indent changes in git)
        ...rawProps,

        // default props
        areFlowsValid: rawProps.areFlowsValid ?? true,
        arrowsZoomThreshold: rawProps.arrowsZoomThreshold ?? 7,
        disabled: rawProps.disabled ?? false,
        displayOverlayLoader: rawProps.displayOverlayLoader ?? false,
        initialPosition: rawProps.initialPosition ?? [0, 0],
        initialZoom: rawProps.initialZoom ?? 5,
        isManualRefreshBackdropDisplayed: rawProps.isManualRefreshBackdropDisplayed ?? false,
        labelsZoomThreshold: rawProps.labelsZoomThreshold ?? 9,
        lineFlowAlertThreshold: rawProps.lineFlowAlertThreshold ?? 100,
        lineFlowColorMode: rawProps.lineFlowColorMode ?? LineFlowColorMode.NOMINAL_VOLTAGE,
        lineFlowMode: rawProps.lineFlowMode ?? LineFlowMode.FEEDERS,
        lineFullPath: rawProps.lineFullPath ?? true,
        lineParallelPath: rawProps.lineParallelPath ?? true,
        mapLibrary: rawProps.mapLibrary ?? CARTO,
        tooltipZoomThreshold: rawProps.tooltipZoomThreshold ?? 7,
        mapTheme: rawProps.mapTheme ?? DARK,
        //triggerMapResizeOnChange = false,
        updatedLines: rawProps.updatedLines ?? [],
        useName: rawProps.useName ?? true,
        visible: rawProps.visible ?? true,
        shouldDisableToolTip: rawProps.shouldDisableToolTip ?? false,
        locateSubStationZoomLevel: rawProps.locateSubStationZoomLevel ?? DEFAULT_LOCATE_SUBSTATION_ZOOM_LEVEL,

        onSubstationClick: rawProps.onSubstationClick ?? (() => {}),
        onSubstationClickChooseVoltageLevel: rawProps.onSubstationClickChooseVoltageLevel ?? (() => {}),
        onSubstationMenuClick: rawProps.onSubstationMenuClick ?? (() => {}),
        onVoltageLevelMenuClick: rawProps.onVoltageLevelMenuClick ?? (() => {}),
        onLineMenuClick: rawProps.onLineMenuClick ?? (() => {}),
        onTieLineMenuClick: rawProps.onTieLineMenuClick ?? (() => {}),
        onHvdcLineMenuClick: rawProps.onHvdcLineMenuClick ?? (() => {}),
        onManualRefreshClick: rawProps.onManualRefreshClick ?? (() => {}),
        renderPopover: rawProps.renderPopover ?? ((eId) => eId),
        onDrawPolygonModeActive: rawProps.onDrawPolygonModeActive ?? (() => {}),
        //onDrawPolygonModeActive = (active) => console.log('polygon drawing mode active: ', active ? 'active' : 'inactive'),
        onPolygonChanged: rawProps.onPolygonChanged ?? (() => {}),
        onDrawEvent: rawProps.onDrawEvent ?? (() => {}),
    };

    const [labelsVisible, setLabelsVisible] = useState(false);
    const [showLineFlow, setShowLineFlow] = useState(true);
    const [showTooltip, setShowTooltip] = useState(true);
    const mapRef = useRef<MapRef>(null);
    const deckRef = useRef<MapboxOverlay>(null);
    const [centered, setCentered] = useState(INITIAL_CENTERED);
    const lastViewStateRef = useRef<ViewState>();
    const [tooltip, setTooltip] = useState<TooltipType | null>(null);
    const theme = useTheme();
    const foregroundNeutralColor = useMemo(() => {
        const labelColor = decomposeColor(theme.palette.text.primary).values;
        // @ts-expect-error TODO: manage undefined case; are we in argb or rgb here?
        labelColor[3] *= 255;
        return labelColor;
    }, [theme]);
    const [cursorType, setCursorType] = useState('grab');
    const [isDragging, setDragging] = useState(false);

    //NOTE these constants are moved to the component's parameters list
    //const currentNode = useSelector((state) => state.currentTreeNode);
    const { onPolygonChanged, centerOnSubstation, onDrawEvent, shouldDisableToolTip } = props;

    const { getNameOrId } = useNameOrId(props.useName);

    const readyToDisplay = props.mapEquipments !== null && props.geoData !== null && !props.disabled;

    const readyToDisplaySubstations =
        readyToDisplay && props.mapEquipments?.substations && (props.geoData?.substationPositionsById.size ?? 0) > 0;

    const readyToDisplayLines =
        readyToDisplay &&
        (props.mapEquipments?.lines || props.mapEquipments?.hvdcLines || props.mapEquipments?.tieLines) &&
        props.mapEquipments.voltageLevels &&
        (props.geoData?.substationPositionsById.size ?? 0) > 0;

    const mapEquipmentsLines = useMemo<MapAnyLineWithType[]>(() => {
        return [
            ...(props.mapEquipments?.lines.map((line) => ({
                ...line,
                equipmentType: EQUIPMENT_TYPES.LINE as const,
            })) ?? []),
            ...(props.mapEquipments?.tieLines.map((tieLine) => ({
                ...tieLine,
                equipmentType: EQUIPMENT_TYPES.TIE_LINE as const,
            })) ?? []),
            ...(props.mapEquipments?.hvdcLines.map((hvdcLine) => ({
                ...hvdcLine,
                equipmentType: EQUIPMENT_TYPES.HVDC_LINE as const,
            })) ?? []),
        ];
    }, [props.mapEquipments?.hvdcLines, props.mapEquipments?.tieLines, props.mapEquipments?.lines]);

    const divRef = useRef<HTMLDivElement>(null);

    const mToken = !props.mapBoxToken ? FALLBACK_MAPBOX_TOKEN : props.mapBoxToken;

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
                (centered.centeredSubstationId && centered.centeredSubstationId !== centered.lastCenteredSubstation)) &&
            props.geoData !== null
        ) {
            if ((props.geoData?.substationPositionsById.size ?? 0) > 0) {
                if (centered.centeredSubstationId) {
                    const geodata = props.geoData?.substationPositionsById.get(centered.centeredSubstationId);
                    if (!geodata) {
                        return;
                    } // can't center on substation if no coordinate.
                    mapRef.current?.flyTo({
                        center: [geodata.lon, geodata.lat],
                        duration: 2000,
                        // only zoom if the current zoom is smaller than the new one
                        zoom: Math.max(mapRef.current?.getZoom(), props.locateSubStationZoomLevel),
                        essential: true,
                    });
                    setCentered({
                        lastCenteredSubstation: centered.centeredSubstationId,
                        centeredSubstationId: centered.centeredSubstationId,
                        centered: true,
                    });
                } else {
                    // @ts-expect-error TODO: manage undefined case
                    const coords = Array.from(props.geoData?.substationPositionsById.entries()).map((x) => x[1]);
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

    const onViewStateChange = useCallback<NonNullable<MapProps['onMove']>>(
        (info) => {
            lastViewStateRef.current = info.viewState;
            if (
                // @ts-expect-error TODO TS2339: Property interactionState does not exist on type ViewStateChangeEvent
                !info.interactionState || // first event of before an animation (e.g. clicking the +/- buttons of the navigation controls, gives the target
                // @ts-expect-error TODO TS2339: Property interactionState does not exist on type ViewStateChangeEvent
                (info.interactionState && !info.interactionState.inTransition) // Any event not part of a animation (mouse panning or zooming)
            ) {
                if (info.viewState.zoom >= props.labelsZoomThreshold && !labelsVisible) {
                    setLabelsVisible(true);
                } else if (info.viewState.zoom < props.labelsZoomThreshold && labelsVisible) {
                    setLabelsVisible(false);
                }
                setShowTooltip(info.viewState.zoom >= props.tooltipZoomThreshold);
                setShowLineFlow(info.viewState.zoom >= props.arrowsZoomThreshold);
            }
        },
        [labelsVisible, props.arrowsZoomThreshold, props.labelsZoomThreshold, props.tooltipZoomThreshold]
    );

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
                    {props.renderPopover(tooltip.equipmentId, divRef)}
                </div>
            )
        );
    }

    // eslint rule don't understand what "prop" we use in props, so we need to have variable outside the useCallback
    const {
        onLineMenuClick,
        onTieLineMenuClick,
        onHvdcLineMenuClick,
        onSubstationClickChooseVoltageLevel,
        onSubstationMenuClick,
        onSubstationClick,
        onVoltageLevelMenuClick,
    } = props;
    const onClickHandler = useCallback(
        (
            info: PickingInfo,
            event: MapBoxLayerMouseEvent | MapLibreLayerMouseEvent, //| MjolnirGestureEvent['srcEvent'],
            network: MapEquipments | undefined
        ) => {
            const leftButton = event.originalEvent.button === MOUSE_EVENT_BUTTON_LEFT;
            const rightButton = event.originalEvent.button === MOUSE_EVENT_BUTTON_RIGHT;
            if (
                info.layer &&
                info.layer.id.startsWith(SUBSTATION_LAYER_PREFIX) &&
                info.object &&
                (info.object.substationId || info.object.voltageLevels) // is a voltage level marker, or a substation text
            ) {
                let idVl;
                let idSubstation;
                if (info.object.substationId) {
                    idVl = info.object.id;
                } else if (info.object.voltageLevels) {
                    if (info.object.voltageLevels.length === 1) {
                        const idS = info.object.voltageLevels[0].substationId;
                        const substation = network?.getSubstation(idS);
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
                            // @ts-expect-error TODO: manage undefined case
                            network?.getVoltageLevel(idVl),
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
                            // @ts-expect-error TODO: manage undefined case
                            network?.getSubstation(idSubstation),
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
                info.object.id &&
                info.object.voltageLevelId1 &&
                info.object.voltageLevelId2
            ) {
                // picked line properties are retrieved from network data and not from pickable object infos,
                // because pickable object infos might not be up to date
                const line = network?.getLine(info.object.id);
                if (line) {
                    onLineMenuClick(line, event.originalEvent.x, event.originalEvent.y);
                } else {
                    const tieLine = network?.getTieLine(info.object.id);
                    if (tieLine) {
                        onTieLineMenuClick(tieLine, event.originalEvent.x, event.originalEvent.y);
                    } else {
                        const hvdcLine = network?.getHvdcLine(info.object.id);
                        if (hvdcLine) {
                            onHvdcLineMenuClick(hvdcLine, event.originalEvent.x, event.originalEvent.y);
                        }
                    }
                }
            }
        },
        [
            onSubstationClick,
            onVoltageLevelMenuClick,
            onSubstationClickChooseVoltageLevel,
            onSubstationMenuClick,
            onLineMenuClick,
            onTieLineMenuClick,
            onHvdcLineMenuClick,
        ]
    );

    const onMapContextMenu = useCallback<NonNullable<MapProps['onContextMenu']>>(
        (event) => {
            const info =
                deckRef.current &&
                deckRef.current.pickObject({
                    x: event.point.x,
                    y: event.point.y,
                    radius: PICKING_RADIUS,
                });
            info && onClickHandler(info, event, props.mapEquipments);
        },
        [onClickHandler, props.mapEquipments]
    );

    function cursorHandler() {
        return isDragging ? 'grabbing' : cursorType;
    }

    const layers: Layer[] = [];

    const _getNameOrId = useMemo(
        //TODO modify getNameOrId to accept undefined for the name
        () => (infos: MapSubstation) => getNameOrId({ ...infos, name: infos.name ?? null }),
        [getNameOrId]
    );
    if (readyToDisplaySubstations) {
        layers.push(
            new SubstationLayer({
                id: SUBSTATION_LAYER_PREFIX,
                data: props.mapEquipments?.substations,
                network: props.mapEquipments,
                geoData: props.geoData,
                getNominalVoltageColor: getNominalVoltageColor,
                filteredNominalVoltages: props.filteredNominalVoltages,
                labelsVisible: labelsVisible,
                labelColor: foregroundNeutralColor,
                labelSize: LABEL_SIZE,
                pickable: true,
                onHover: ({ object }) => {
                    setCursorType(object ? 'pointer' : 'grab');
                },
                getNameOrId: _getNameOrId,
            })
        );
    }

    if (readyToDisplayLines) {
        layers.push(
            new LineLayer({
                areFlowsValid: props.areFlowsValid,
                id: LINE_LAYER_PREFIX,
                data: mapEquipmentsLines,
                network: props.mapEquipments,
                updatedLines: props.updatedLines,
                geoData: props.geoData,
                getNominalVoltageColor: getNominalVoltageColor,
                disconnectedLineColor: foregroundNeutralColor,
                filteredNominalVoltages: props.filteredNominalVoltages,
                lineFlowMode: props.lineFlowMode,
                showLineFlow: props.visible && showLineFlow,
                lineFlowColorMode: props.lineFlowColorMode,
                lineFlowAlertThreshold: props.lineFlowAlertThreshold,
                lineFullPath: (props.geoData?.linePositionsById.size ?? 0) > 0 && props.lineFullPath,
                lineParallelPath: props.lineParallelPath,
                labelsVisible: labelsVisible,
                labelColor: foregroundNeutralColor,
                labelSize: LABEL_SIZE,
                pickable: true,
                onHover: ({ object, x, y }) => {
                    if (object) {
                        setCursorType('pointer');
                        const lineObject = object?.line ?? object;
                        setTooltip({
                            equipmentId: lineObject?.id,
                            equipmentType: lineObject?.equipmentType,
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
        longitude: props.initialPosition[0],
        latitude: props.initialPosition[1],
        zoom: props.initialZoom,
        maxZoom: 14,
        pitch: 0,
        bearing: 0,
    };

    const renderOverlay = () => (
        <LoaderWithOverlay color="inherit" loaderSize={70} isFixed={false} loadingMessageText={'loadingGeoData'} />
    );

    useEffect(() => {
        mapRef.current?.resize();
    }, [props.triggerMapResizeOnChange]);

    const getMapStyle = (mapLibrary: LiteralUnion<MapLibrary, string>, mapTheme: LiteralUnion<MapTheme, string>) => {
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

    const mapStyle = useMemo(() => getMapStyle(props.mapLibrary, props.mapTheme), [props.mapLibrary, props.mapTheme]);

    const mapLib =
        props.mapLibrary === MAPBOX
            ? (mToken && {
                  key: 'mapboxgl',
                  mapLib: mapboxgl,
                  mapboxAccessToken: mToken,
              }) ||
              undefined
            : {
                  key: 'maplibregl',
                  mapLib: maplibregl,
              };

    // because the mapLib prop of react-map-gl is not reactive, we need to
    // unmount/mount the Map with 'key', so we need also to reset all state
    // associated with uncontrolled state of the map
    useEffect(() => {
        setCentered(INITIAL_CENTERED);
    }, [mapLib?.key]);

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
        const polygonCoordinates = polygonFeatures?.geometry as Polygon | undefined;
        // @ts-expect-error TODO TS2365: Operator < cannot be applied to types Position[][] and number
        if (!polygonCoordinates || polygonCoordinates.coordinates < 3) {
            return [];
        }
        //for each line, check if it is in the polygon
        const selectedLines = getSelectedLinesInPolygon(
            props.mapEquipments,
            mapEquipmentsLines,
            props.geoData,
            polygonCoordinates
        );
        return selectedLines.filter((line) => {
            return props.filteredNominalVoltages?.some((nv) => {
                return (
                    nv === props.mapEquipments?.getVoltageLevel(line.voltageLevelId1)?.nominalV ||
                    nv === props.mapEquipments?.getVoltageLevel(line.voltageLevelId2)?.nominalV
                );
            });
        });
    }, [props.mapEquipments, mapEquipmentsLines, props.geoData, props.filteredNominalVoltages]);

    const getSelectedSubstations = useCallback(() => {
        const substations = getSubstationsInPolygon(getPolygonFeatures(), props.mapEquipments, props.geoData);
        return (
            substations.filter((substation) => {
                return substation.voltageLevels.some((vl) => props.filteredNominalVoltages?.includes(vl.nominalV));
            }) ?? []
        );
    }, [props.mapEquipments, props.geoData, props.filteredNominalVoltages]);

    useImperativeHandle(
        ref,
        () => ({
            getSelectedSubstations,
            getSelectedLines,
            cleanDraw() {
                //because deleteAll does not trigger a update of the polygonFeature callback
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
                styleDiffing={false}
                // @ts-expect-error TODO TS2322: Type typeof mapboxgl is not assignable to type MapLib<Map>|Promise<MapLib<Map>>|undefined
                mapLib={mapLib.mapLib}
                mapboxAccessToken={mapLib.mapboxAccessToken}
                initialViewState={initialViewState}
                cursor={cursorHandler()} //TODO needed for pointer on our polygonFeatures, but forces us to reeimplement grabbing/grab for panning. Can we avoid reimplementing?
                onDrag={() => setDragging(true)}
                onDragEnd={() => setDragging(false)}
                onContextMenu={onMapContextMenu}
            >
                {props.displayOverlayLoader && renderOverlay()}
                {props.isManualRefreshBackdropDisplayed && (
                    <Box sx={styles.mapManualRefreshBackdrop}>
                        <Button onClick={props.onManualRefreshClick} aria-label="reload" color="inherit" size="large">
                            <Replay />
                            <FormattedMessage id="ManuallyRefreshGeoData" />
                        </Button>
                    </Box>
                )}
                <DeckGLOverlay
                    ref={deckRef}
                    onClick={(info, event) => {
                        // @ts-expect-error TODO: we have MouseEvent|TouchEvent|PointerEvent here...
                        onClickHandler(info, event.srcEvent, props.mapEquipments);
                    }}
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
                    //
                    // defaultMode="simple_select | draw_polygon | ...
                    defaultMode="simple_select"
                    readyToDisplay={readyToDisplay}
                    onDrawPolygonModeActive={(polygon_draw) => {
                        props.onDrawPolygonModeActive(polygon_draw);
                    }}
                    onCreate={onCreate}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                />
            </Map>
        )
    );
});

NetworkMap.propTypes = {
    disabled: PropTypes.bool,
    geoData: PropTypes.instanceOf(GeoData),
    mapBoxToken: PropTypes.string,
    mapEquipments: PropTypes.instanceOf(MapEquipments),
    mapLibrary: PropTypes.oneOf([CARTO, CARTO_NOLABEL, MAPBOX]),
    mapTheme: PropTypes.oneOf([LIGHT, DARK]),

    areFlowsValid: PropTypes.bool,
    arrowsZoomThreshold: PropTypes.number,
    centerOnSubstation: PropTypes.any,
    displayOverlayLoader: PropTypes.bool,
    filteredNominalVoltages: PropTypes.array,
    initialPosition: PropTypes.any,
    initialZoom: PropTypes.number,
    isManualRefreshBackdropDisplayed: PropTypes.bool,
    labelsZoomThreshold: PropTypes.number,
    lineFlowAlertThreshold: PropTypes.number,
    lineFlowColorMode: PropTypes.oneOf(Object.values(LineFlowColorMode)),
    lineFlowMode: PropTypes.oneOf(Object.values(LineFlowMode)),
    lineFullPath: PropTypes.bool,
    lineParallelPath: PropTypes.bool,
    renderPopover: PropTypes.func,
    tooltipZoomThreshold: PropTypes.number,
    // With mapboxgl v2 (not a problem with maplibre), we need to call
    // map.resize() when the parent size has changed, otherwise the map is not
    // redrawn. It seems like this is autodetected when the browser window is
    // resized, but not for programmatic resizes of the parent. For now in our
    // app, only study display mode resizes programmatically
    // use this prop to make the map resize when needed, each time this prop changes, map.resize() is trigged
    triggerMapResizeOnChange: PropTypes.any,
    updatedLines: PropTypes.array,
    useName: PropTypes.bool,
    visible: PropTypes.bool,
    shouldDisableToolTip: PropTypes.bool,
    locateSubStationZoomLevel: PropTypes.number,
    onHvdcLineMenuClick: PropTypes.func,
    onLineMenuClick: PropTypes.func,
    onTieLineMenuClick: PropTypes.func,
    onManualRefreshClick: PropTypes.func,
    onSubstationClick: PropTypes.func,
    onSubstationClickChooseVoltageLevel: PropTypes.func,
    onSubstationMenuClick: PropTypes.func,
    onVoltageLevelMenuClick: PropTypes.func,
    onDrawPolygonModeActive: PropTypes.func,
    onPolygonChanged: PropTypes.func,
    onDrawEvent: PropTypes.func,
};

//TODO why is the FunctionComponent memoized?! It never change and useMemo!=useCallback
export default memo(NetworkMap);

function getSubstationsInPolygon(
    features: Partial<Feature>, // Feature from geojson
    mapEquipments: MapEquipments | undefined,
    geoData: GeoData | undefined
) {
    const polygonCoordinates = features?.geometry as Polygon | undefined;
    // @ts-expect-error TODO TS2365: Operator < cannot be applied to types Position[][] and number
    if (!polygonCoordinates || polygonCoordinates.coordinates < 3) {
        return [];
    }
    //get the list of substation
    const substationsList = mapEquipments?.substations ?? [];
    //for each substation, check if it is in the polygon
    return substationsList // keep only the substation in the polygon
        .filter((substation) => {
            const pos = geoData?.getSubstationPosition(substation.id);
            // @ts-expect-error TODO: manage undefined case
            return booleanPointInPolygon(pos, polygonCoordinates);
        });
}

function getSelectedLinesInPolygon(
    network: MapEquipments | undefined,
    lines: MapAnyLine[],
    geoData: GeoData | undefined,
    polygonCoordinates: Polygon
) {
    return lines.filter((line) => {
        try {
            // @ts-expect-error TODO: manage undefined case
            const linePos = geoData?.getLinePositions(network, line);
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
