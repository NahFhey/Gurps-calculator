import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

const appGlobals = {
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  localStorage: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  Array: 'readonly',
  Map: 'readonly',
  Set: 'readonly',
  Promise: 'readonly',
  import: 'readonly',
  crypto: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  btoa: 'readonly',
  atob: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  Blob: 'readonly',
  URL: 'readonly',
};

const reactSharedConfig = {
  plugins: {
    react,
    'react-hooks': reactHooks,
  },
  settings: {
    react: {
      version: '18.2',
    },
  },
};

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    ...reactSharedConfig,
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: appGlobals,
    },
    rules: {
      // React rules
      'react/react-in-jsx-scope': 'off', // React 18 doesn't need this
      'react/prop-types': 'warn', // Warn on missing PropTypes
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // General rules
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ...reactSharedConfig,
    plugins: {
      ...reactSharedConfig.plugins,
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: appGlobals,
    },
    rules: {
      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript-aware rules
      'no-unused-vars': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // General rules
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  prettier,
];
