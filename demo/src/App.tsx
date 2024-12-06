/**
 * Copyright (c) 2023, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { WritableDeep } from 'type-fest';
import { useEffect, useRef } from 'react';
import { createTheme, StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import { GeoData, type MapEquipment, MapEquipments, NetworkMap, type NetworkMapRef } from '../../src';

import { addNadToDemo, addSldToDemo } from './diagram-viewers/add-diagrams';
import sposdata from './map-viewer/data/spos';
import lposdata from './map-viewer/data/lpos';
import smapdata from './map-viewer/data/smap';
import lmapdata from './map-viewer/data/lmap';

export default function App() {
    const INITIAL_ZOOM = 9;
    const LABELS_ZOOM_THRESHOLD = 9;
    const ARROWS_ZOOM_THRESHOLD = 7;
    const useName = true;

    useEffect(() => {
        addNadToDemo();
        addSldToDemo();
    }, []);

    //called after a click (right mouse click) on an equipment (line or substation)
    function showEquipmentMenu(equipment: MapEquipment, x: number, y: number, type: string) {
        console.log('# Show equipment menu: ' + JSON.stringify(equipment) + ', type: ' + type);
    }

    const darkTheme = createTheme({
        palette: {
            mode: 'dark',
        },
        // @ts-expect-error: TODO not present in ThemeOptions
        link: {
            color: 'green',
        },
        node: {
            background: '#1976d2',
            hover: '#90caf9',
            border: '#cce3f9',
        },
        selectedRow: {
            background: '#545C5B',
        },
        mapboxStyle: 'mapbox://styles/mapbox/dark-v9',
        aggrid: 'ag-theme-alpine-dark',
    });

    //declare data to be displayed: coordinates and network data
    const geoData = new GeoData(new Map(), new Map());
    geoData.setSubstationPositions(sposdata as WritableDeep<typeof sposdata>);
    geoData.setLinePositions(lposdata as WritableDeep<typeof lposdata>);

    const mapEquipments = new MapEquipments();
    mapEquipments.updateSubstations(smapdata as WritableDeep<typeof smapdata>, true);
    mapEquipments.updateLines(lmapdata as WritableDeep<typeof lmapdata>, true);

    useEffect(() => {
        const handleContextmenu = (e: MouseEvent) => {
            e.preventDefault();
        };
        document.addEventListener('contextmenu', handleContextmenu);
        return () => {
            document.removeEventListener('contextmenu', handleContextmenu);
        };
    }, []);

    const networkMapRef = useRef<NetworkMapRef>(null);
    const filteredNominalVoltages = [380.0, 225.0, 110.0];

    return (
        <div className="App">
            <header className="App-header"></header>
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={darkTheme}>
                    <div
                        style={{
                            position: 'relative',
                            width: 1000,
                            height: 1000,
                        }}
                    >
                        <NetworkMap
                            ref={networkMapRef}
                            mapEquipments={mapEquipments}
                            geoData={geoData}
                            labelsZoomThreshold={LABELS_ZOOM_THRESHOLD}
                            arrowsZoomThreshold={ARROWS_ZOOM_THRESHOLD}
                            initialZoom={INITIAL_ZOOM}
                            useName={useName}
                            onSubstationClick={(vlId) => {
                                console.log('# OpenVoltageLevel: ' + vlId);
                            }}
                            onSubstationClickChooseVoltageLevel={(idSubstation, x, y) =>
                                console.log(
                                    `# Choose Voltage Level for substation: ${idSubstation}  at coordinates (${x}, ${y})`
                                )
                            }
                            onSubstationMenuClick={(equipment, x, y) =>
                                showEquipmentMenu(equipment, x, y, 'substation')
                            }
                            onLineMenuClick={(equipment, x, y) => showEquipmentMenu(equipment, x, y, 'line')}
                            onVoltageLevelMenuClick={(equipment, x, y) => {
                                console.log(
                                    `# VoltageLevel menu click: ${JSON.stringify(
                                        equipment
                                    )} at coordinates (${x}, ${y})`
                                );
                            }}
                            mapLibrary={'cartonolabel'}
                            mapTheme={'dark'}
                            filteredNominalVoltages={filteredNominalVoltages}
                            onDrawPolygonModeActive={(active) => {
                                console.log('polygon drawing mode active: ', active ? 'active' : 'inactive');
                            }}
                            onPolygonChanged={() => {
                                console.log(
                                    'Selected Substations: ',
                                    networkMapRef.current?.getSelectedSubstations().length
                                );
                                console.log('Selected Lines: ', networkMapRef.current?.getSelectedLines().length);
                            }}
                        />
                    </div>
                </ThemeProvider>
            </StyledEngineProvider>
        </div>
    );
}
