import { Color, CompositeLayer, DefaultProps, LayerContext, UpdateParameters } from '@deck.gl/core';
import { TextLayer } from '@deck.gl/layers';
import { Substation, VoltageLevel } from '../utils/equipment-types';
import { GeoData } from './geo-data';
import { CompositeData } from './line-layer';
import { MapEquipments } from './map-equipments';

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
export declare class SubstationLayer extends CompositeLayer<SubstationLayerProps> {
    static layerName: string;
    static defaultProps: DefaultProps<SubstationLayerProps>;
    state: {
        compositeData: CompositeData[];
        metaVoltageLevelsByNominalVoltage?: MetaVoltageLevelsByNominalVoltage[];
        substationsLabels: Substation[];
    };
    initializeState(context: LayerContext): void;
    updateState({ props: { data, filteredNominalVoltages, geoData, getNameOrId, network }, oldProps, changeFlags, }: UpdateParameters<this>): void;
    renderLayers(): TextLayer<any, {}>[];
}
export {};
