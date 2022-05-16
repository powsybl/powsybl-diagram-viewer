module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        "plugin:prettier/recommended",
        'prettier'
    ],
    env : {
        "browser": true
    },
    rules: {
        "prettier/prettier": "warn"
    },
};