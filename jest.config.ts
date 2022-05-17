/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/en/configuration.html
 */

export default {
    // A preset that is used as a base for Jest's configuration
    preset: 'ts-jest/presets/js-with-ts',

    // The test environment that will be used for testing
    testEnvironment: 'jsdom',

    setupFiles: ['<rootDir>/src/setupTests.ts'],
};
