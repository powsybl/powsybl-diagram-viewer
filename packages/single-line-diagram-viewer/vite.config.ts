/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as path from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import svgr from 'vite-plugin-svgr';
import pkg from './package.json' assert { type: 'json' };

export default defineConfig((_config) => ({
    plugins: [svgr(), dts()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        minify: false,
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            formats: ['es'],
            name: 'PowSyBl single line diagram viewer',
            fileName: 'single-line-diagram-viewer',
        },
        rollupOptions: {
            external: [...Object.keys(pkg.dependencies), /^node:.*/],
        },
        target: 'esnext',
    },
}));
