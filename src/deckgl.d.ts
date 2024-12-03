/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint-disable */

/* Override for v8 following
 * https://deck.gl/docs/get-started/using-with-typescript#deckgl-v8
 * TODO: remove this file when migrating to deck.gl v9
 */
declare module 'deck.gl' {
    //export namespace DeckTypings {}
    export * from 'deck.gl/typed';
}
declare module '@deck.gl/aggregation-layers' {
    export * from '@deck.gl/aggregation-layers/typed';
}
declare module '@deck.gl/carto' {
    export * from '@deck.gl/carto/typed';
}
declare module '@deck.gl/core' {
    export * from '@deck.gl/core/typed';
}
declare module '@deck.gl/extensions' {
    export * from '@deck.gl/extensions/typed';
}
declare module '@deck.gl/geo-layers' {
    export * from '@deck.gl/geo-layers/typed';
}
declare module '@deck.gl/google-maps' {
    export * from '@deck.gl/google-maps/typed';
}
declare module '@deck.gl/json' {
    export * from '@deck.gl/json/typed';
}
declare module '@deck.gl/layers' {
    export * from '@deck.gl/layers/typed';
}
declare module '@deck.gl/mapbox' {
    export * from '@deck.gl/mapbox/typed';
}
declare module '@deck.gl/mesh-layers' {
    export * from '@deck.gl/mesh-layers/typed';
}
declare module '@deck.gl/react' {
    export * from '@deck.gl/react/typed';
}

/* For @luma.gl v8, the best would be to use @danmarshall/deckgl-typings work, but it conflicts with "@deck.gl/<module>/typed"...
 * Has we will migrate to deck.gl v9 very soon, it's acceptable to just let typescript not check types temporally.
 * TODO: remove this file when migrating to deck.gl v9
 */
declare module '@luma.gl/core' {
    // just shut down tsc with 'any'
    export { Model, Geometry } from '@luma.gl/engine';
    export function isWebGL2(gl: any): boolean;
    export function hasFeatures(gl: any, features: any): any;
    export class Texture2D extends Resource {
        static isSupported(gl: any, opts: any): boolean;
        constructor(gl: any, props?: {});
        toString(): string;
        initialize(props?: {}): this | void;
        get handle(): any;
        delete({ deleteChildren }?: { deleteChildren?: boolean }): this | void;
        getParameter(pname: any, opts?: {}): any;
        getParameters(opts?: {}): {};
        setParameter(pname: any, value: any): this;
        setParameters(parameters: any): this;
        stubRemovedMethods(className: any, version: any, methodNames: any): void;
        resize({ height, width, mipmaps }: { height: any; width: any; mipmaps?: boolean }): this;
        generateMipmap(params?: {}): this;
        setImageData(options: any): this;
        setSubImageData(args: {
            target?: any;
            pixels?: any;
            data?: any;
            x?: number;
            y?: number;
            width?: any;
            height?: any;
            level?: number;
            format?: any;
            type?: any;
            dataFormat?: any;
            compressed?: boolean;
            offset?: number;
            border?: any;
            parameters?: {};
        }): void;
        copyFramebuffer(opts?: {}): any;
        getActiveUnit(): number;
        bind(textureUnit?: any): any;
        unbind(textureUnit?: any): any;
    }
    export const FEATURES: {
        WEBGL2: string;
        VERTEX_ARRAY_OBJECT: string;
        TIMER_QUERY: string;
        INSTANCED_RENDERING: string;
        MULTIPLE_RENDER_TARGETS: string;
        ELEMENT_INDEX_UINT32: string;
        BLEND_EQUATION_MINMAX: string;
        FLOAT_BLEND: string;
        COLOR_ENCODING_SRGB: string;
        TEXTURE_DEPTH: string;
        TEXTURE_FLOAT: string;
        TEXTURE_HALF_FLOAT: string;
        TEXTURE_FILTER_LINEAR_FLOAT: string;
        TEXTURE_FILTER_LINEAR_HALF_FLOAT: string;
        TEXTURE_FILTER_ANISOTROPIC: string;
        COLOR_ATTACHMENT_RGBA32F: string;
        COLOR_ATTACHMENT_FLOAT: string;
        COLOR_ATTACHMENT_HALF_FLOAT: string;
        GLSL_FRAG_DATA: string;
        GLSL_FRAG_DEPTH: string;
        GLSL_DERIVATIVES: string;
        GLSL_TEXTURE_LOD: string;
    };
    //export type TextureFormat = any;
    //export type UniformValue = any;
}
