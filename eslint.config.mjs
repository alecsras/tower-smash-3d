// The game is split into ordered files that share one scope (see build.mjs), so names defined
// in one part are used in others: undefined/unused checks are left to the bundler and the tests.
import js from '@eslint/js';
import globals from 'globals';
export default [
  js.configs.recommended,
  { files: ['src/**/*.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser, __BUILD__: 'readonly' } },
    rules: { 'no-undef': 'off', 'no-unused-vars': 'off', 'no-empty': ['error', { allowEmptyCatch: true }], 'no-cond-assign': 'off', 'no-sparse-arrays': 'off' } }
];
