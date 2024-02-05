import { defineConfig } from 'vite';
import { resolve } from 'path';
import eslint from 'vite-plugin-eslint';
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [eslint(), dts()],
    build: {
        lib: {
            // Could also be a dictionary or array of multiple entry points
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'Powsybl diagram viewer',
            // the proper extensions will be added
            fileName: 'powsybl-diagram-viewer',
            formats: ['es'],
        },
        rollupOptions: {
            external: ['@svgdotjs/svg.js', '@svgdotjs/svg.panzoom.js'],
        },
    },
});
