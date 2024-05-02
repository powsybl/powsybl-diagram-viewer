/**
 * Copyright (c) 2020, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import PropTypes from 'prop-types';
import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';

import { Box, decomposeColor } from '@mui/system';
import LoaderWithOverlay from '../utils/loader-with-overlay';

import { MapboxOverlay } from '@deck.gl/mapbox';
import { Replay } from '@mui/icons-material';
import { Button, useTheme } from '@mui/material';
import { FormattedMessage } from 'react-intl';
import { Map, NavigationControl, useControl } from 'react-map-gl';
import { getNominalVoltageColor } from '../../../utils/colors';
import { useNameOrId } from '../utils/equipmentInfosHandler';
import { GeoData } from './geo-data';
import DrawControl, { getMapDrawer } from './draw-control.ts';
import { LineFlowColorMode, LineFlowMode, LineLayer } from './line-layer';
import { MapEquipments } from './map-equipments';
import { SubstationLayer } from './substation-layer';

import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { EQUIPMENT_TYPES } from '../utils/equipment-types.js';

// MouseEvent.button https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
const MOUSE_EVENT_BUTTON_LEFT = 0;
const MOUSE_EVENT_BUTTON_RIGHT = 2;

// Small boilerplate recommended by deckgl, to bridge to a react-map-gl control declaratively
// see https://deck.gl/docs/api-reference/mapbox/mapbox-overlay#using-with-react-map-gl
const DeckGLOverlay = React.forwardRef((props, ref) => {
    const overlay = useControl(() => new MapboxOverlay(props));
    overlay.setProps(props);
    useImperativeHandle(ref, () => overlay, [overlay]);
    return null;
});

const PICKING_RADIUS = 5;

const CARTO = 'carto';
const CARTO_NOLABEL = 'cartonolabel';
const MAPBOX = 'mapbox';

const LIGHT = 'light';
const DARK = 'dark';

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
const INITIAL_CENTERED = {
    lastCenteredSubstation: null,
    centeredSubstationId: null,
    centered: false,
};

const NetworkMap = forwardRef((props, ref) => {
    const [labelsVisible, setLabelsVisible] = useState(false);
    const [showLineFlow, setShowLineFlow] = useState(true);
    const [showTooltip, setShowTooltip] = useState(true);
    const mapRef = useRef();
    const deckRef = useRef();
    const [centered, setCentered] = useState(INITIAL_CENTERED);
    const lastViewStateRef = useRef(null);
    const [tooltip, setTooltip] = useState({});
    const theme = useTheme();
    const foregroundNeutralColor = useMemo(() => {
        const labelColor = decomposeColor(theme.palette.text.primary).values;
        labelColor[3] *= 255;
        return labelColor;
    }, [theme]);
    const [cursorType, setCursorType] = useState('grab');
    const [isDragging, setDragging] = useState(false);
    const [isPolygonDrawingStarted, setPolygonDrawingStarted] = useState(false);
    //NOTE these constants are moved to the component's parameters list
    //const currentNode = useSelector((state) => state.currentTreeNode);
    const { onPolygonChanged, centerOnSubstation, lineFullPath } = props;

    const { getNameOrId } = useNameOrId(props.useName);

    const readyToDisplay =
        props.mapEquipments !== null &&
        props.geoData !== null &&
        !props.disabled;

    const readyToDisplaySubstations =
        readyToDisplay &&
        props.mapEquipments.substations &&
        props.geoData.substationPositionsById.size > 0;

    const readyToDisplayLines =
        readyToDisplay &&
        (props.mapEquipments?.lines ||
            props.mapEquipments?.hvdcLines ||
            props.mapEquipments?.tieLines) &&
        props.mapEquipments.voltageLevels &&
        props.geoData.substationPositionsById.size > 0;

    const mapEquipmentsLines = useMemo(() => {
        return [
            ...(props.mapEquipments?.lines.map((line) => ({
                ...line,
                equipmentType: EQUIPMENT_TYPES.LINE,
            })) ?? []),
            ...(props.mapEquipments?.tieLines.map((tieLine) => ({
                ...tieLine,
                equipmentType: EQUIPMENT_TYPES.TIE_LINE,
            })) ?? []),
            ...(props.mapEquipments?.hvdcLines.map((hvdcLine) => ({
                ...hvdcLine,
                equipmentType: EQUIPMENT_TYPES.HVDC_LINE,
            })) ?? []),
        ];
    }, [
        props.mapEquipments?.hvdcLines,
        props.mapEquipments?.tieLines,
        props.mapEquipments?.lines,
    ]);

    const divRef = useRef();

    const mToken = !props.mapBoxToken
        ? FALLBACK_MAPBOX_TOKEN
        : props.mapBoxToken;

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
                    centered.centeredSubstationId !==
                        centered.lastCenteredSubstation)) &&
            props.geoData !== null
        ) {
            if (props.geoData.substationPositionsById.size > 0) {
                if (centered.centeredSubstationId) {
                    const geodata = props.geoData.substationPositionsById.get(
                        centered.centeredSubstationId
                    );
                    if (!geodata) {
                        return;
                    } // can't center on substation if no coordinate.
                    mapRef.current?.flyTo({
                        center: [geodata.lon, geodata.lat],
                        duration: 2000,
                    });
                    setCentered({
                        lastCenteredSubstation: centered.centeredSubstationId,
                        centeredSubstationId: centered.centeredSubstationId,
                        centered: true,
                    });
                } else {
                    const coords = Array.from(
                        props.geoData.substationPositionsById.entries()
                    ).map((x) => x[1]);
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

    function onViewStateChange(info) {
        lastViewStateRef.current = info.viewState;
        if (
            !info.interactionState || // first event of before an animation (e.g. clicking the +/- buttons of the navigation controls, gives the target
            (info.interactionState && !info.interactionState.inTransition) // Any event not part of a animation (mouse panning or zooming)
        ) {
            if (
                info.viewState.zoom >= props.labelsZoomThreshold &&
                !labelsVisible
            ) {
                setLabelsVisible(true);
            } else if (
                info.viewState.zoom < props.labelsZoomThreshold &&
                labelsVisible
            ) {
                setLabelsVisible(false);
            }
            setShowTooltip(info.viewState.zoom >= props.tooltipZoomThreshold);
            setShowLineFlow(info.viewState.zoom >= props.arrowsZoomThreshold);
        }
    }

    function renderTooltip() {
        return (
            tooltip &&
            tooltip.visible &&
            !isPolygonDrawingStarted &&
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
                    {props.renderPopover(tooltip.equipmentId, divRef.current)}
                </div>
            )
        );
    }

    function onClickHandler(info, event, network) {
        const leftButton =
            event.originalEvent.button === MOUSE_EVENT_BUTTON_LEFT;
        const rightButton =
            event.originalEvent.button === MOUSE_EVENT_BUTTON_RIGHT;
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
                    let idS = info.object.voltageLevels[0].substationId;
                    let substation = network.getSubstation(idS);
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
                if (props.onSubstationClick && leftButton) {
                    props.onSubstationClick(idVl);
                } else if (props.onVoltageLevelMenuClick && rightButton) {
                    props.onVoltageLevelMenuClick(
                        network.getVoltageLevel(idVl),
                        event.originalEvent.x,
                        event.originalEvent.y
                    );
                }
            }
            if (idSubstation !== undefined) {
                if (props.onSubstationClickChooseVoltageLevel && leftButton) {
                    props.onSubstationClickChooseVoltageLevel(
                        idSubstation,
                        event.originalEvent.x,
                        event.originalEvent.y
                    );
                } else if (props.onSubstationMenuClick && rightButton) {
                    props.onSubstationMenuClick(
                        network.getSubstation(idSubstation),
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
            const line = network.getLine(info.object.id);
            const tieLine = network.getTieLine(info.object.id);
            const hvdcLine = network.getHvdcLine(info.object.id);

            const equipment = line || tieLine || hvdcLine;
            if (equipment) {
                const menuClickFunction =
                    equipment === line
                        ? props.onLineMenuClick
                        : equipment === tieLine
                        ? props.onTieLineMenuClick
                        : props.onHvdcLineMenuClick;

                menuClickFunction(
                    equipment,
                    event.originalEvent.x,
                    event.originalEvent.y
                );
            }
        }
    }

    function onMapContextMenu(event) {
        const info =
            deckRef.current &&
            deckRef.current.pickObject({
                x: event.point.x,
                y: event.point.y,
                radius: PICKING_RADIUS,
            });
        info && onClickHandler(info, event, props.mapEquipments);
    }

    function cursorHandler() {
        return isDragging ? 'grabbing' : cursorType;
    }

    const layers = [];

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
                getNameOrId: getNameOrId,
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
                lineFullPath:
                    props.geoData.linePositionsById.size > 0 &&
                    props.lineFullPath,
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
        <LoaderWithOverlay
            color="inherit"
            loaderSize={70}
            isFixed={false}
            loadingMessageText={'loadingGeoData'}
        />
    );

    useEffect(() => {
        mapRef.current?.resize();
    }, [props.triggerMapResizeOnChange]);

    const getMapStyle = (mapLibrary, mapTheme) => {
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

    const mapStyle = useMemo(
        () => getMapStyle(props.mapLibrary, props.mapTheme),
        [props.mapLibrary, props.mapTheme]
    );

    const mapLib =
        props.mapLibrary === MAPBOX
            ? mToken && {
                  key: 'mapboxgl',
                  mapLib: mapboxgl,
                  mapboxAccessToken: mToken,
              }
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

    const [polygonFeatures, setPolygonFeatures] = useState({});

    useEffect(() => {
        onPolygonChanged(polygonFeatures);
    }, [polygonFeatures, onPolygonChanged]);

    const onUpdate = useCallback((e) => {
        setPolygonFeatures((currFeatures) => {
            const newFeatures = { ...currFeatures };
            for (const f of e.features) {
                newFeatures[f.id] = f;
            }
            return newFeatures;
        });
    }, []);

    const onCreate = useCallback(
        (e) => {
            onUpdate(e);
        },
        [onUpdate]
    );
    const getSelectedLines = useCallback(() => {
        //check if polygon is defined correctly
        const firstPolygonFeatures = Object.values(polygonFeatures)[0];
        const polygonCoordinates = firstPolygonFeatures?.geometry;
        if (!polygonCoordinates || polygonCoordinates.coordinates < 3) {
            return [];
        }
        //for each line, check if it is in the polygon
        const selectedLines = getSelectedLinesInPolygon(
            props.mapEquipments,
            mapEquipmentsLines,
            props.geoData,
            polygonCoordinates,
            lineFullPath
        );
        return selectedLines.filter((line) => {
            const extremities = [
                props.filteredNominalVoltages[0],
                props.filteredNominalVoltages[
                    props.filteredNominalVoltages.length - 1
                ],
            ];
            return extremities.some((nv) => {
                return (
                    nv ===
                        props.mapEquipments.getVoltageLevel(
                            line.voltageLevelId1
                        ).nominalV ||
                    nv ===
                        props.mapEquipments.getVoltageLevel(
                            line.voltageLevelId2
                        ).nominalV
                );
            });
        });
    }, [
        polygonFeatures,
        props.mapEquipments,
        mapEquipmentsLines,
        props.geoData,
        props.filteredNominalVoltages,
        lineFullPath,
    ]);

    const getSelectedSubstations = useCallback(() => {
        const substations = getSubstationsInPolygon(
            polygonFeatures,
            props.mapEquipments,
            props.geoData
        );
        return (
            substations.filter((substation) => {
                return substation.voltageLevels.some((vl) =>
                    props.filteredNominalVoltages.includes(vl.nominalV)
                );
            }) ?? []
        );
    }, [
        polygonFeatures,
        props.mapEquipments,
        props.geoData,
        props.filteredNominalVoltages,
    ]);

    useImperativeHandle(
        ref,
        () => ({
            getSelectedSubstations,
            getSelectedLines,
            cleanDraw() {
                getMapDrawer()?.deleteAll();
                //because deleteAll does not trigger a update of the polygonFeature callback
                setPolygonFeatures({});
            },
        }),
        [getSelectedSubstations, getSelectedLines]
    );

    const onDelete = useCallback((e) => {
        setPolygonFeatures((currFeatures) => {
            const newFeatures = { ...currFeatures };
            for (const f of e.features) {
                delete newFeatures[f.id];
            }
            return newFeatures;
        });
    }, []);

    return (
        mapLib && (
            <Map
                ref={mapRef}
                style={{ zIndex: 0 }}
                onMove={onViewStateChange}
                doubleClickZoom={false}
                mapStyle={mapStyle}
                preventStyleDiffing={true}
                {...mapLib}
                initialViewState={initialViewState}
                cursor={cursorHandler()} //TODO needed for pointer on our polygonFeatures, but forces us to reeimplement grabbing/grab for panning. Can we avoid reimplementing?
                onDrag={() => setDragging(true)}
                onDragEnd={() => setDragging(false)}
                onContextMenu={onMapContextMenu}
            >
                {props.displayOverlayLoader && renderOverlay()}
                {props.isManualRefreshBackdropDisplayed && (
                    <Box sx={styles.mapManualRefreshBackdrop}>
                        <Button
                            onClick={props.onManualRefreshClick}
                            aria-label="reload"
                            color="inherit"
                            size="large"
                        >
                            <Replay />
                            <FormattedMessage id="ManuallyRefreshGeoData" />
                        </Button>
                    </Box>
                )}
                <DeckGLOverlay
                    ref={deckRef}
                    onClick={(info, event) => {
                        onClickHandler(
                            info,
                            event.srcEvent,
                            props.mapEquipments
                        );
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
                        setPolygonDrawingStarted(polygon_draw);
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

NetworkMap.defaultProps = {
    areFlowsValid: true,
    arrowsZoomThreshold: 7,
    centerOnSubstation: null,
    disabled: false,
    displayOverlayLoader: false,
    filteredNominalVoltages: null,
    geoData: null,
    initialPosition: [0, 0],
    initialZoom: 5,
    isManualRefreshBackdropDisplayed: false,
    labelsZoomThreshold: 9,
    lineFlowAlertThreshold: 100,
    lineFlowColorMode: LineFlowColorMode.NOMINAL_VOLTAGE,
    lineFlowHidden: true,
    lineFlowMode: LineFlowMode.FEEDERS,
    lineFullPath: true,
    lineParallelPath: true,
    mapBoxToken: null,
    mapEquipments: null,
    mapLibrary: CARTO,
    tooltipZoomThreshold: 7,
    mapTheme: DARK,
    updatedLines: [],
    useName: true,
    visible: true,

    onSubstationClick: () => {},
    onSubstationClickChooseVoltageLevel: () => {},
    onSubstationMenuClick: () => {},
    onVoltageLevelMenuClick: () => {},
    onLineMenuClick: () => {},
    onTieLineMenuClick: () => {},
    onHvdcLineMenuClick: () => {},
    onManualRefreshClick: () => {},
    renderPopover: (eId) => {
        return eId;
    },
    onDrawPolygonModeActive: () => {},
    onPolygonChanged: () => {},
};

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
    initialPosition: PropTypes.arrayOf(PropTypes.number),
    initialZoom: PropTypes.number,
    isManualRefreshBackdropDisplayed: PropTypes.bool,
    labelsZoomThreshold: PropTypes.number,
    lineFlowAlertThreshold: PropTypes.number,
    lineFlowColorMode: PropTypes.oneOf(Object.values(LineFlowColorMode)),
    lineFlowHidden: PropTypes.bool,
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
};

export default React.memo(NetworkMap);

function getSubstationsInPolygon(features, mapEquipments, geoData) {
    const firstPolygonFeatures = Object.values(features)[0];
    const polygonCoordinates = firstPolygonFeatures?.geometry;
    if (!polygonCoordinates || polygonCoordinates.coordinates < 3) {
        return [];
    }
    //get the list of substation
    const substationsList = mapEquipments?.substations ?? [];
    //for each substation, check if it is in the polygon
    return substationsList // keep only the sybstation in the polygon
        .filter((substation) => {
            const pos = geoData.getSubstationPosition(substation.id);
            return booleanPointInPolygon(pos, polygonCoordinates);
        });
}

function getSelectedLinesInPolygon(
    network,
    lines,
    geoData,
    polygonCoordinates,
    lineFullPath
) {
    return lines.filter((line) => {
        try {
            const linePos = geoData.getLinePositions(network, line);
            if (!linePos) {
                return false;
            }
            if (linePos.length < 2) {
                return false;
            }
            const displayedPath = lineFullPath
                ? linePos
                : [linePos[0], linePos[linePos.length - 1]];
            return displayedPath.some((pos) =>
                booleanPointInPolygon(pos, polygonCoordinates)
            );
        } catch (error) {
            console.error(error);
            return false;
        }
    });
}
