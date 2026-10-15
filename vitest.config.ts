import { defineConfig } from 'vitest/config';

// Each package with tests has its own vitest.config.ts; this file lists them.
export default defineConfig({
  test: {
    projects: ['{apps,packages}/*/vitest.config.{ts,mts}', '{scripts,infra}/vitest.config.{ts,mts}'],
    passWithNoTests: true,
  },
});
