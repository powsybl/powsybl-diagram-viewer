/**
 * Copyright (c) 2020, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useImperativeHandle,
} from 'react';
import PropTypes from 'prop-types';

import { decomposeColor } from '@mui/system';
import LoaderWithOverlay from '../utils/loader-with-overlay';

import { GeoData } from './geo-data';
import { LineLayer, LineFlowColorMode, LineFlowMode } from './line-layer';
import { SubstationLayer } from './substation-layer';
import { getNominalVoltageColor } from '../../../utils/colors';
import { RunningStatus } from '../utils/running-status';
import { useTheme } from '@mui/material';
import { MapEquipmentsBase } from './map-equipments-base';
import { useNameOrId } from '../utils/equipmentInfosHandler';
import { Map, NavigationControl, useControl } from 'react-map-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';

import 'mapbox-gl/dist/mapbox-gl.css';

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

// FIXME: to uncomment when system is fixed
// const styles = {
//     mapManualRefreshBackdrop: {
//         width: '100%',
//         height: '100%',
//         textAlign: 'center',
//         display: 'flex',
//         alignItems: 'center',
//         justifyContent: 'center',
//         background: 'grey',
//         opacity: '0.8',
//         zIndex: 99,
//         fontSize: 30,
//     },
// };

const FALLBACK_MAPBOX_TOKEN =
    'pk.eyJ1IjoiZ2VvZmphbWciLCJhIjoiY2pwbnRwcm8wMDYzMDQ4b2pieXd0bDMxNSJ9.Q4aL20nBo5CzGkrWtxroug';

const SUBSTATION_LAYER_PREFIX = 'substationLayer';
const LINE_LAYER_PREFIX = 'lineLayer';
const LABEL_SIZE = 12;

const NetworkMap = (props) => {
    const [labelsVisible, setLabelsVisible] = useState(false);
    const [showLineFlow, setShowLineFlow] = useState(true);
    const [showTooltip, setShowTooltip] = useState(true);
    const mapRef = useRef();
    const deckRef = useRef();
    const [centered, setCentered] = useState({
        lastCenteredSubstation: null,
        centeredSubstationId: null,
        centered: false,
    });
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
    //NOTE these constants are moved to the component's parameters list
    //const centerOnSubstation = useSelector((state) => state.centerOnSubstation);
    //const mapManualRefresh = useSelector(
    //    (state) => state[PARAM_MAP_MANUAL_REFRESH]
    //);
    //const reloadMapNeeded = useSelector((state) => state.reloadMap);
    //const currentNode = useSelector((state) => state.currentTreeNode);
    const centerOnSubstation = props.centerOnSubstation;

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
        (props.mapEquipments?.lines || props.mapEquipments?.hvdcLines) &&
        props.mapEquipments.voltageLevels &&
        props.geoData.substationPositionsById.size > 0;

    const mapEquipmentsLines = useMemo(() => {
        return [
            ...(props.mapEquipments?.lines ?? []),
            ...(props.mapEquipments?.hvdcLines ?? []),
        ];
    }, [props.mapEquipments?.hvdcLines, props.mapEquipments?.lines]);

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
            tooltip.visible && (
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
            let line = network.getLine(info.object.id);
            if (line) {
                props.onLineMenuClick(
                    line,
                    event.originalEvent.x,
                    event.originalEvent.y
                );
            } else {
                let hvdcLine = network.getHvdcLine(info.object.id);
                if (hvdcLine) {
                    props.onHvdcLineMenuClick(
                        hvdcLine,
                        event.originalEvent.x,
                        event.originalEvent.y
                    );
                }
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
                loadFlowStatus: props?.loadFlowStatus,
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
        maxZoom: 12,
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

    // With mapboxgl v2 (not a problem with maplibre), we need to call
    // map.resize() when the parent size has changed, otherwise the map is not
    // redrawn. It seems like this is autodetected when the browser window is
    // resized, but not for programmatic resizes of the parent. For now in our
    // app, only study display mode resizes programmatically
    // FIXME: to reproduce with props
    // const studyDisplayMode = useSelector((state) => state.studyDisplayMode);
    // useEffect(() => {
    //     mapRef.current?.resize();
    // }, [studyDisplayMode]);

    return (
        mToken && (
            <Map
                ref={mapRef}
                style={{ zIndex: 0 }}
                onMove={onViewStateChange}
                doubleClickZoom={false}
                mapStyle={theme.mapboxStyle}
                preventStyleDiffing={true}
                mapboxAccessToken={mToken}
                initialViewState={initialViewState}
                cursor={cursorHandler()} //TODO needed for pointer on our features, but forces us to reeimplement grabbing/grab for panning. Can we avoid reimplementing?
                onDrag={() => setDragging(true)}
                onDragEnd={() => setDragging(false)}
                onContextMenu={onMapContextMenu}
            >
                {props.displayOverlayLoader && renderOverlay()}
                {/* FIXME: to reproduce with props */}
                {/* {mapManualRefresh &&
                    reloadMapNeeded &&
                    isNodeBuilt(currentNode) && ( 
                <Box sx={styles.mapManualRefreshBackdrop}>
                    <Button
                        onClick={props.onReloadMapClick}
                        aria-label="reload"
                        color="inherit"
                        size="large"
                    >
                        <ReplayIcon />
                        <FormattedMessage id="ManuallyRefreshGeoData" />
                    </Button>
                </Box>
                 )} */}
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
            </Map>
        )
    );
};

NetworkMap.defaultProps = {
    mapEquipments: null,
    updatedLines: [],
    geoData: null,
    filteredNominalVoltages: null,
    labelsZoomThreshold: 9,
    arrowsZoomThreshold: 7,
    tooltipZoomThreshold: 7,
    initialZoom: 5,
    initialPosition: [0, 0],
    lineFullPath: true,
    lineParallelPath: true,
    lineFlowMode: LineFlowMode.FEEDERS,
    lineFlowHidden: true,
    lineFlowColorMode: LineFlowColorMode.NOMINAL_VOLTAGE,
    lineFlowAlertThreshold: 100,
    loadFlowStatus: RunningStatus.IDLE,
    visible: true,
    displayOverlayLoader: false,
    disabled: false,

    centerOnSubstation: null,
    mapManualRefresh: false,
    reloadMapNeeded: true,
    currentNodeBuilt: false,
    useName: true,

    mapBoxToken: null,

    onSubstationClick: () => {},
    onSubstationClickChooseVoltageLevel: () => {},
    onSubstationMenuClick: () => {},
    onVoltageLevelMenuClick: () => {},
    onLineMenuClick: () => {},
    onHvdcLineMenuClick: () => {},
    onReloadMapClick: () => {},
    renderPopover: (eId) => {
        return eId;
    },
};

NetworkMap.propTypes = {
    mapEquipments: PropTypes.instanceOf(MapEquipmentsBase),
    geoData: PropTypes.instanceOf(GeoData),
    filteredNominalVoltages: PropTypes.array,
    labelsZoomThreshold: PropTypes.number.isRequired,
    arrowsZoomThreshold: PropTypes.number.isRequired,
    tooltipZoomThreshold: PropTypes.number.isRequired,
    initialZoom: PropTypes.number.isRequired,
    initialPosition: PropTypes.arrayOf(PropTypes.number).isRequired,
    onSubstationClick: PropTypes.func,
    onLineMenuClick: PropTypes.func,
    onHvdcLineMenuClick: PropTypes.func,
    onSubstationClickChooseVoltageLevel: PropTypes.func,
    onSubstationMenuClick: PropTypes.func,
    onVoltageLevelMenuClick: PropTypes.func,
    lineFullPath: PropTypes.bool,
    lineParallelPath: PropTypes.bool,
    lineFlowMode: PropTypes.oneOf(Object.values(LineFlowMode)),
    lineFlowHidden: PropTypes.bool,
    lineFlowColorMode: PropTypes.oneOf(Object.values(LineFlowColorMode)),
    lineFlowAlertThreshold: PropTypes.number.isRequired,
    loadFlowStatus: PropTypes.oneOf(Object.values(RunningStatus)),
    visible: PropTypes.bool,
    updatedLines: PropTypes.array,
    displayOverlayLoader: PropTypes.bool,
    disabled: PropTypes.bool,

    centerOnSubstation: PropTypes.any,
    mapManualRefresh: PropTypes.bool,
    reloadMapNeeded: PropTypes.bool,
    useName: PropTypes.bool,
    mapBoxToken: PropTypes.string,
    onReloadMapClick: PropTypes.func,
    renderPopover: PropTypes.func,
};

export default React.memo(NetworkMap);