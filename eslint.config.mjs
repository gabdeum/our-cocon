// One config for CI, `pnpm check` and the Claude Code edit hook (.claude/hooks/check-file.sh).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import cocon from './scripts/eslint/no-design-literals.mjs';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/web-build/**',
      '**/expo-env.d.ts',
      'packages/schemas/database.types.ts',
      'supabase/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/app/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // SC-001: colours and sizes come from packages/ui and the theme tokens, never from screens.
    files: ['apps/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    plugins: { cocon },
    rules: { 'cocon/no-design-literals': 'error' },
  },
  {
    // Expo, Metro, Babel and Tailwind read CommonJS config files.
    files: ['**/*.config.js', '**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
