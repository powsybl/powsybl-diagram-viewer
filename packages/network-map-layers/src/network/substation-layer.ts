/**
 * Copyright (c) 2020, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {
    Color,
    CompositeLayer,
    DefaultProps,
    LayerContext,
    UpdateParameters,
} from '@deck.gl/core';
import { TextLayer } from '@deck.gl/layers';
import ScatterplotLayerExt from './layers/scatterplot-layer-ext';

import {
    SUBSTATION_RADIUS,
    SUBSTATION_RADIUS_MAX_PIXEL,
    SUBSTATION_RADIUS_MIN_PIXEL,
} from '@/constants';
import { getNominalVoltageColor } from '@/utils/colors';
import { Substation, VoltageLevel } from '@/utils/equipment-types';
import { GeoData } from './geo-data';
import { CompositeData } from './line-layer';
import { MapEquipments } from './map-equipments';

const voltageLevelNominalVoltageIndexer = (
    map: Map<number, VoltageLevel[]>,
    voltageLevel: VoltageLevel
) => {
    let list = map.get(voltageLevel.nominalV);
    if (!list) {
        list = [];
        map.set(voltageLevel.nominalV, list);
    }
    list.push(voltageLevel);
    return map;
};

type MetaVoltageLevel = {
    nominalVoltageIndex: number;
    voltageLevels: VoltageLevel[];
};

type MetaVoltageLevelsByNominalVoltage = {
    nominalV: number;
    metaVoltageLevels: MetaVoltageLevel[];
};

export type SubstationLayerProps = {
    data: Substation[];
    network: MapEquipments;
    geoData: GeoData;
    getNominalVoltageColor: (nominalV: number) => Color;
    filteredNominalVoltages: number[] | null;
    labelsVisible: boolean;
    labelColor: Color;
    labelSize: number;
    getNameOrId: (infos: Substation) => string | null;
};

const defaultProps: DefaultProps<SubstationLayerProps> = {
    getNominalVoltageColor: { type: 'function', value: getNominalVoltageColor },
    filteredNominalVoltages: null,
    labelsVisible: false,
    labelColor: { type: 'color', value: [255, 255, 255] },
    labelSize: 12,
};

export class SubstationLayer extends CompositeLayer<SubstationLayerProps> {
    static layerName = 'SubstationLayer';
    static defaultProps = defaultProps;

    declare state: {
        compositeData: CompositeData[];
        metaVoltageLevelsByNominalVoltage?: MetaVoltageLevelsByNominalVoltage[];
        substationsLabels: Substation[];
    };

    initializeState(context: LayerContext) {
        super.initializeState(context);

        this.state = {
            compositeData: [],
            substationsLabels: [],
        };
    }

    updateState({
        props: { data, filteredNominalVoltages, geoData, getNameOrId, network },
        oldProps,
        changeFlags,
    }: UpdateParameters<this>) {
        if (changeFlags.dataChanged) {
            const metaVoltageLevelsByNominalVoltage = new Map<
                number,
                MetaVoltageLevel[]
            >();

            if (network != null && geoData != null) {
                // create meta voltage levels
                // a meta voltage level is made of:
                //   - a list of voltage level that belong to same substation and with same nominal voltage
                //   - index of the voltage levels nominal voltage in the substation nominal voltage list
                data.forEach((substation) => {
                    // index voltage levels of this substation by its nominal voltage (this is because we might
                    // have several voltage levels with the same nominal voltage in the same substation)
                    const voltageLevelsByNominalVoltage =
                        substation.voltageLevels.reduce(
                            voltageLevelNominalVoltageIndexer,
                            new Map()
                        );

                    // sorted distinct nominal voltages for this substation
                    const nominalVoltages = [
                        ...new Set(
                            substation.voltageLevels
                                .map((voltageLevel) => voltageLevel.nominalV)
                                .sort(
                                    (nominalVoltage1, nominalVoltage2) =>
                                        nominalVoltage1 - nominalVoltage2
                                )
                        ),
                    ];

                    // add to global map of meta voltage levels indexed by nominal voltage
                    Array.from(voltageLevelsByNominalVoltage.entries()).forEach(
                        ([nominalV, voltageLevels]) => {
                            let metaVoltageLevels =
                                metaVoltageLevelsByNominalVoltage.get(nominalV);
                            if (!metaVoltageLevels) {
                                metaVoltageLevels = [];
                                metaVoltageLevelsByNominalVoltage.set(
                                    nominalV,
                                    metaVoltageLevels
                                );
                            }
                            metaVoltageLevels.push({
                                voltageLevels,
                                nominalVoltageIndex:
                                    nominalVoltages.indexOf(nominalV),
                            });
                        }
                    );
                });
            }

            // sort the map by descending nominal voltages
            const metaVoltageLevelsByNominalVoltageArray = Array.from(
                metaVoltageLevelsByNominalVoltage
            )
                .map((e) => {
                    return { nominalV: e[0], metaVoltageLevels: e[1] };
                })
                .sort((a, b) => b.nominalV - a.nominalV);

            this.setState({
                metaVoltageLevelsByNominalVoltage:
                    metaVoltageLevelsByNominalVoltageArray,
            });
        }

        if (
            changeFlags.dataChanged ||
            getNameOrId !== oldProps.getNameOrId ||
            filteredNominalVoltages !== oldProps.filteredNominalVoltages
        ) {
            let substationsLabels = data;

            if (
                network != null &&
                geoData != null &&
                filteredNominalVoltages != null
            ) {
                // we construct the substations where there is at least one voltage level with a nominal voltage
                // present in the filteredVoltageLevels property, in order to handle correctly the substations labels visibility
                substationsLabels = substationsLabels.filter(
                    (substation) =>
                        substation.voltageLevels.find((v) =>
                            filteredNominalVoltages.includes(v.nominalV)
                        ) !== undefined
                );
            }

            this.setState({ substationsLabels });
        }
    }

    renderLayers() {
        const layers = [];

        // substations : create one layer per nominal voltage, starting from higher to lower nominal voltage
        this.state.metaVoltageLevelsByNominalVoltage?.forEach((e) => {
            const substationsLayer = new ScatterplotLayerExt(
                this.getSubLayerProps({
                    id: 'NominalVoltage' + e.nominalV,
                    data: e.metaVoltageLevels,
                    radiusMinPixels: SUBSTATION_RADIUS_MIN_PIXEL,
                    getRadiusMaxPixels: (metaVoltageLevel: MetaVoltageLevel) =>
                        SUBSTATION_RADIUS_MAX_PIXEL *
                        (metaVoltageLevel.nominalVoltageIndex + 1),
                    getPosition: (metaVoltageLevel: MetaVoltageLevel) =>
                        this.props.geoData.getSubstationPosition(
                            metaVoltageLevel.voltageLevels[0].substationId
                        ),
                    getFillColor: this.props.getNominalVoltageColor(e.nominalV),
                    getRadius: (voltageLevel: MetaVoltageLevel) =>
                        SUBSTATION_RADIUS *
                        (voltageLevel.nominalVoltageIndex + 1),
                    visible:
                        !this.props.filteredNominalVoltages ||
                        this.props.filteredNominalVoltages.includes(e.nominalV),
                    updateTriggers: {
                        getPosition: [
                            this.props?.geoData?.substationPositionsById,
                            this.props?.network?.substations,
                        ],
                    },
                })
            );
            layers.push(substationsLayer);
        });

        // substations labels : create one layer
        const substationLabelsLayer = new TextLayer(
            this.getSubLayerProps({
                id: 'Label',
                data: this.state.substationsLabels,
                getPosition: (substation: Substation) =>
                    this.props.geoData.getSubstationPosition(substation.id),
                getText: (substation: Substation) =>
                    this.props.getNameOrId(substation),
                getColor: this.props.labelColor,
                fontFamily: 'Roboto',
                getSize: this.props.labelSize,
                getAngle: 0,
                getTextAnchor: 'start',
                getAlignmentBaseline: 'center',
                getPixelOffset: [20 / 1.5, 0],
                visible: this.props.labelsVisible,
                updateTriggers: {
                    getText: [this.props.getNameOrId],
                    getPosition: [
                        this.props.geoData.substationPositionsById,
                        this.props.network.substations,
                    ],
                },
            })
        );
        layers.push(substationLabelsLayer);

        return layers;
    }
}
