// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'YMM/*', 'test/*'],
  },
  {
    // react-three-fiber 的 JSX(mesh/position/args 等)不是 DOM 属性
    files: ['components/three/**/*.tsx'],
    rules: {
      'react/no-unknown-property': 'off',
    },
  },
]);
