import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintPluginAstro from 'eslint-plugin-astro';

export default tseslint.config(
  // Global Ignores
  {
    ignores: ['**/dist/**', '**/.astro/**', '**/worker-configuration.d.ts', '**/.wrangler/**', '.claude/worktrees/**'],
  },

  // Base TypeScript & JS Configuration
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Astro Files Configuration
  ...eslintPluginAstro.configs.recommended,

  // React / Frontend App Rules (Astro / UI)
  {
    files: ['apps/web/**/*.{ts,tsx}'], // Scope React rules specifically to your UI app
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Cloudflare Worker Rules
  {
    files: ['apps/worker/**/*.ts'], // Scope worker-specific settings
    languageOptions: {
      globals: {
        ...globals.serviceworker, // Worker execution context globals
      },
    },
  },

  // Overrides for Astro environment type declarations
  {
    files: ['**/src/env.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
);
