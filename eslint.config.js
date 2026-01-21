import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
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
      },
    },
    settings: {
      react: {
        version: '18.2',
      },
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
  prettier,
];
