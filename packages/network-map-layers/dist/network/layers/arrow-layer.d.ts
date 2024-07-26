import { Accessor, DefaultProps, Layer } from '@deck.gl/core';
import { Texture, Device, RenderPass, TextureFormat, TextureProps, UniformValue } from '@luma.gl/core';
import { Model } from '@luma.gl/engine';
import { Line } from '../../utils/equipment-types';
import { Color, LayerContext, LayerProps, Position, UpdateParameters } from 'deck.gl';

export declare enum ArrowDirection {
    NONE = "none",
    FROM_SIDE_1_TO_SIDE_2 = "fromSide1ToSide2",
    FROM_SIDE_2_TO_SIDE_1 = "fromSide2ToSide1"
}
export type Arrow = {
    line: Line;
    distance: number;
};
export type LayerDataSource<DataType> = DataType[];
type _ArrowLayerProps = {
    data: Arrow[];
    sizeMinPixels?: number;
    sizeMaxPixels?: number;
    getDistance: Accessor<Arrow, number>;
    getLine: (arrow: Arrow) => Line;
    getLinePositions: (line: Line) => Position[];
    getSize?: Accessor<Arrow, number>;
    getColor?: Accessor<Arrow, Color>;
    getSpeedFactor?: Accessor<Arrow, number>;
    getDirection?: Accessor<Arrow, ArrowDirection>;
    animated?: boolean;
    getLineParallelIndex?: Accessor<Arrow, number>;
    getLineAngles?: Accessor<Arrow, number[]>;
    getDistanceBetweenLines?: Accessor<Arrow, number>;
    maxParallelOffset?: number;
    minParallelOffset?: number;
    opacity?: number;
} & LayerProps;
type ArrowLayerProps = _ArrowLayerProps & LayerProps;
type LineAttributes = {
    distance: number;
    positionsTextureOffset: number;
    distancesTextureOffset: number;
    pointCount: number;
};
/**
 * A layer that draws arrows over the lines between voltage levels. The arrows are drawn on a direct line
 * or with a parallel offset. The initial point is also shifted to coincide with the fork line ends.
 * Needs to be kept in sync with ForkLineLayer and ParallelPathLayer because they draw the lines.
 * props : getLineParallelIndex: accessor for real number representing the parallel translation, normalized to distanceBetweenLines
 *         getLineAngles: accessor for line angle in radian (3 angle substation1 / first pylon ; substation1/substation2 ; last pylon / substation2
 *         distanceBetweenLines: distance in meters between line when no pixel clamping is applied
 *         maxParallelOffset: max pixel distance
 *         minParallelOffset: min pixel distance
 */
export declare class ArrowLayer extends Layer<Required<_ArrowLayerProps>> {
    static layerName: string;
    static defaultProps: DefaultProps<ArrowLayerProps>;
    state: {
        linePositionsTexture: Texture;
        lineDistancesTexture: Texture;
        lineAttributes: Map<Line, LineAttributes>;
        model?: Model;
        timestamp: number;
        stop: boolean;
        maxTextureSize: number;
    };
    getShaders(): any;
    getArrowLineAttributes(arrow: Arrow): LineAttributes;
    initializeState(): void;
    finalizeState(context: LayerContext): void;
    createTexture2D(device: Device, data: Array<number>, elementSize: number, format: TextureFormat): Texture<TextureProps>;
    createTexturesStructure(props: this['props']): {
        linePositionsTextureData: number[];
        lineDistancesTextureData: number[];
        lineAttributes: Map<any, any>;
    };
    updateGeometry({ props, changeFlags }: UpdateParameters<this>): void;
    updateModel({ changeFlags }: UpdateParameters<this>): void;
    updateState(updateParams: UpdateParameters<this>): void;
    animate(timestamp: number): void;
    startAnimation(): void;
    draw({ uniforms, renderPass, }: {
        uniforms: Record<string, UniformValue>;
        renderPass: RenderPass;
    }): void;
    _getModel(device: Device): Model;
}
export {};
