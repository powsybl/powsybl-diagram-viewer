import { defineConfig } from 'vite';
import { resolve } from 'path';
import eslint from 'vite-plugin-eslint';
import dts from 'vite-plugin-dts';
import react from '@vitejs/plugin-react';
import { externalizeDeps } from 'vite-plugin-externalize-deps';

export default defineConfig({
    plugins: [react(), eslint(), dts(), externalizeDeps()],
    build: {
        lib: {
            // Could also be a dictionary or array of multiple entry points
            entry: resolve(__dirname, 'src/index.js'),
            name: 'Powsybl diagram viewer',
            // the proper extensions will be added
            fileName: 'powsybl-diagram-viewer',
        },
        rollupOptions: {
            output: {
                // DO NOT define any external deps. External deps are dealt with externalizeDeps from vite-plugin-externalize-deps
                // defining externals manually will prevent this plugin from working
                // external:
                // Provide global variables to use in the UMD build
                // for externalized deps
                globals: {
                    react: 'React',
                    'react/jsx-runtime': 'ReactJsxRuntime',
                    'react-intl': 'ReactIntl',
                    '@emotion/react': 'EmotionReact',
                    '@svgdotjs/svg.js': 'SvgJs',
                    'geolib/es/computeDestinationPoint':
                        'GeolibComputeDestinationpoint',
                    'cheap-ruler': 'CheapRuler',
                    'geolib/es/getGreatCircleBearing':
                        'GeolibGetGreatCircleBearing',
                    'geolib/es/getRhumbLineBearing':
                        'GeolibGetRhumbLineBearing',
                    'deck.gl': 'DeckGl',
                    'geolib/es/getDistance': 'GeolibGetDistance',
                    'react-map-gl': 'ReactMapGl',
                    '@mui/system': 'MuiSystem',
                    '@mui/material': 'MuiMaterial',
                    '@mui/icons-material/Replay': 'MuiIconsMaterialReplay',
                },
            },
        },
    },
});
