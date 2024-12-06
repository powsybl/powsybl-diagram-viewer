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

/* For @luma.gl v8, we use @danmarshall/deckgl-typings definitions, but because conflicts with "@deck.gl/<module>/typed",
 * we don't use it like it's mean to be used with indefinitely-typed. After NPM install deckgl-typings, it will execute
 *  its postinstall (ie. indefinitely-typed), and during our postinstall, we delete the copied files to revert it.
 *  With that deckgl-typings won't override global @types.
 * Has we will migrate to deck.gl v9 very soon, it's acceptable to just let typescript not check types temporally.
 * TODO: remove this file when migrating to deck.gl v9
 */
declare module '@luma.gl/core' {
    export * from '@danmarshall/deckgl-typings/luma.gl__core';
}
declare module '@luma.gl/constants' {
    export * from '@danmarshall/deckgl-typings/luma.gl__constants';
}
declare module '@luma.gl/gltools' {
    export * from '@danmarshall/deckgl-typings/luma.gl__gltools';
}
declare module '@luma.gl/webgl' {
    export * from '@danmarshall/deckgl-typings/luma.gl__webgl';
}
