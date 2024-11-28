/**
 * Copyright (c) 2020, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { Accessor, ScatterplotLayer, ScatterplotLayerProps } from 'deck.gl';
import { type DefaultProps } from '@deck.gl/core';
import GL from '@luma.gl/constants';

type _ScatterplotLayerExtProps<DataT = unknown> = {
    getRadiusMaxPixels: Accessor<DataT, number>;
};
export type ScatterplotLayerExtProps<DataT = unknown> = _ScatterplotLayerExtProps<DataT> & ScatterplotLayerProps<DataT>;

const defaultProps: DefaultProps<ScatterplotLayerExtProps> = {
    getRadiusMaxPixels: { type: 'accessor', value: 1 },
};

/**
 * An extended scatter plot layer that allows a radius max pixels to be different for each object.
 */
export default class ScatterplotLayerExt<DataT = unknown> extends ScatterplotLayer<
    Required<_ScatterplotLayerExtProps<DataT>>
> {
    // noinspection JSUnusedGlobalSymbols -- it's dynamically get by deck.gl
    static readonly layerName = 'ScatterplotLayerExt';
    // noinspection JSUnusedGlobalSymbols -- it's dynamically get by deck.gl
    static readonly defaultProps = defaultProps;

    getShaders() {
        const shaders = super.getShaders();
        return {
            ...shaders,
            vs: shaders.vs.replace(', radiusMaxPixels', ', instanceRadiusMaxPixels'), // hack to replace the uniform variable to corresponding attribute
            inject: {
                'vs:#decl': `\
attribute float instanceRadiusMaxPixels;
`,
            },
        };
    }

    initializeState() {
        super.initializeState();

        const attributeManager = this.getAttributeManager();
        attributeManager?.addInstanced({
            instanceRadiusMaxPixels: {
                size: 1,
                transition: true,
                accessor: 'getRadiusMaxPixels',
                type: GL.FLOAT,
                defaultValue: 0,
            },
        });
    }
}
