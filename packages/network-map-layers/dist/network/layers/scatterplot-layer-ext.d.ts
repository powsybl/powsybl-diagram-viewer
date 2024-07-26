import { Accessor, DefaultProps } from '@deck.gl/core';
import { ScatterplotLayer, ScatterplotLayerProps } from '@deck.gl/layers';

type _ScatterplotLayerExtProps<DataT = unknown> = {
    getRadiusMaxPixels: Accessor<DataT, number>;
};
export type ScatterplotLayerExtProps<DataT = unknown> = _ScatterplotLayerExtProps<DataT> & ScatterplotLayerProps<DataT>;
/**
 * An extended scatter plot layer that allows a radius max pixels to be different for each object.
 */
export default class ScatterplotLayerExt<DataT = unknown> extends ScatterplotLayer<Required<_ScatterplotLayerExtProps<DataT>>> {
    static layerName: string;
    static defaultProps: DefaultProps<ScatterplotLayerExtProps<unknown>>;
    getShaders(): any;
    initializeState(): void;
}
export {};
