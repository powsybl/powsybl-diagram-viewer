/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint-disable */

/* Override for v8 following
 * https://deck.gl/docs/get-started/using-with-typescript
 */
declare module 'deck.gl' {
    //export namespace DeckTypings {}
    export * from 'deck.gl/typed';
}
