import { Accessor, DefaultProps } from '@deck.gl/core';
import { LineLayer, LineLayerProps } from '@deck.gl/layers';

export type ForkLineLayerProps<DataT = unknown> = _ForkLineLayerProps<DataT> & LineLayerProps;
type _ForkLineLayerProps<DataT> = {
    getLineParallelIndex: Accessor<DataT, number>;
    getLineAngle: Accessor<DataT, number>;
    distanceBetweenLines: Accessor<DataT, number>;
    maxParallelOffset: Accessor<DataT, number>;
    minParallelOffset: Accessor<DataT, number>;
    substationRadius: Accessor<DataT, number>;
    substationMaxPixel: Accessor<DataT, number>;
    minSubstationRadiusPixel: Accessor<DataT, number>;
    getDistanceBetweenLines: Accessor<DataT, number>;
    getMaxParallelOffset: Accessor<DataT, number>;
    getMinParallelOffset: Accessor<DataT, number>;
    getSubstationRadius: Accessor<DataT, number>;
    getSubstationMaxPixel: Accessor<DataT, number>;
    getMinSubstationRadiusPixel: Accessor<DataT, number>;
};
/**
 * A layer based on LineLayer that draws a fork line at a substation when there are multiple parallel lines
 * Needs to be kept in sync with ArrowLayer and ParallelPathLayer because connect to the end of the fork lines.
 * props : getLineParallelIndex: real number representing the parallel translation, normalized to distanceBetweenLines
 *         getLineAngle: line angle in radian
 *         distanceBetweenLines: distance in meters between line when no pixel clamping is applied
 *         maxParallelOffset: max pixel distance
 *         minParallelOffset: min pixel distance
 *         instanceOffsetStart: distance from the origin point
 *         substationRadius: radius for a voltage level in substation
 *         substationMaxPixel: max pixel for a voltage level in substation
 *         minSubstationRadiusPixel : min pixel for a substation
 */
export default class ForkLineLayer<DataT = unknown> extends LineLayer<DataT, Required<_ForkLineLayerProps<DataT>>> {
    static layerName: string;
    static defaultProps: DefaultProps<ForkLineLayerProps<unknown>>;
    getShaders(): any;
    initializeState(): void;
    draw({ uniforms, }: {
        uniforms: Record<string, unknown>;
    }): void;
}
export {};
