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
        //https://stackoverflow.com/questions/59134241/using-deck-gl-as-webpack-external
        //https://github.com/visgl/deck.gl/blob/94bad4bb209a5da0686fb03f107e86b18199c108/website/webpack.config.js#L128-L141
        externalizeDeps({
            include: [/@deck.gl*/, /@loaders.gl*/, /@luma.gl*/],
        }),
    ],
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
                    'cheap-ruler': 'CheapRuler',
                    'deck.gl': 'DeckGl',
                    'geolib/es/computeDestinationPoint':
                        'GeolibComputeDestinationpoint',
                    'geolib/es/getDistance': 'GeolibGetDistance',
                    'geolib/es/getGreatCircleBearing':
                        'GeolibGetGreatCircleBearing',
                    'geolib/es/getRhumbLineBearing':
                        'GeolibGetRhumbLineBearing',
                    react: 'React',
                    'react/jsx-runtime': 'ReactJsxRuntime',
                    'react-intl': 'ReactIntl',
                    'react-map-gl': 'ReactMapGl',
                    '@deck.gl/core': 'DeckGlCore',
                    '@deck.gl/extensions': 'DeckGlExtensions',
                    '@deck.gl/mapbox': 'DeckGlMapbox',
                    '@emotion/react': 'EmotionReact',
                    '@mui/icons-material/Replay': 'MuiIconsMaterialReplay',
                    '@mui/material': 'MuiMaterial',
                    '@mui/system': 'MuiSystem',
                    '@luma.gl/constants': 'LumaGlConstants',
                    '@luma.gl/core': 'LumaGlCore',
                    '@svgdotjs/svg.js': 'SvgJs',
                },
            },
        },
    },
});
