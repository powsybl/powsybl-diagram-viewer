/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/en/configuration.html
 */

export default {
    // A preset that is used as a base for Jest's configuration
    preset: 'ts-jest/presets/js-with-ts',

    // The test environment that will be used for testing
    testEnvironment: 'jsdom',

    setupFiles: ['<rootDir>/setupTests.ts'],
};
