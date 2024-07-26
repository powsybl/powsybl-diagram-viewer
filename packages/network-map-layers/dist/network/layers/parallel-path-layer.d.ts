import { Accessor, DefaultProps } from '@deck.gl/core';
import { PathLayer, PathLayerProps } from '@deck.gl/layers';
import { RenderPass, UniformValue } from '@luma.gl/core';

type _ParallelPathLayerProps<DataT = unknown> = {
    getLineParallelIndex?: Accessor<DataT, number>;
    getLineAngle?: Accessor<DataT, number>;
    distanceBetweenLines?: number;
    maxParallelOffset?: number;
    minParallelOffset?: number;
};
export type ParallelPathLayerProps<DataT = unknown> = _ParallelPathLayerProps<DataT> & PathLayerProps<DataT>;
/**
 * A layer based on PathLayer allowing to shift path by an offset + angle
 * In addition to the shift for all points, the first point is also shifted
 * to coincide to the end of "fork lines" starting from the substations.
 * Needs to be kept in sync with ForkLineLayer and ArrowLayer because
 * ForkLineLayer must connect to this and the arrows must overlap on this.
 * props : getLineParallelIndex: real number representing the parallel translation, normalized to distanceBetweenLines
 *         getLineAngle: line angle in radian
 *         distanceBetweenLines: distance in meters between line when no pixel clamping is applied
 *         maxParallelOffset: max pixel distance
 *         minParallelOffset: min pixel distance
 */
export default class ParallelPathLayer<DataT = unknown> extends PathLayer<DataT, Required<_ParallelPathLayerProps<DataT>>> {
    static layerName: string;
    static defaultProps: DefaultProps<ParallelPathLayerProps<unknown>>;
    getShaders(): any;
    initializeState(): void;
    draw({ uniforms, }: {
        uniforms: Record<string, UniformValue>;
        renderPass: RenderPass;
    }): void;
}
export {};
