import { defineConfig } from 'vite';
import { resolve } from 'path';
import eslint from 'vite-plugin-eslint';
import dts from 'vite-plugin-dts';
import react from '@vitejs/plugin-react';
import { externalizeDeps } from 'vite-plugin-externalize-deps';

export default defineConfig({
    plugins: [
        react(),
        eslint(),
        dts(),
        externalizeDeps({
            deps: false,
        }),
    ],
    build: {
        lib: {
            // Could also be a dictionary or array of multiple entry points
            entry: resolve(__dirname, 'src/index.js'),
            name: 'Powsybl diagram viewer',
            // the proper extensions will be added
            fileName: 'powsybl-diagram-viewer',
            formats: ['es'],
        },
    },
});
