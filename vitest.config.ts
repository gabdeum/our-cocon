import { defineConfig } from 'vitest/config';

// Each package with tests has its own vitest.config.ts; this file lists them.
export default defineConfig({
  test: {
    projects: ['{apps,packages}/*/vitest.config.{ts,mts}', '{scripts,infra}/vitest.config.{ts,mts}'],
    passWithNoTests: true,
    // Each screen-test worker holds its own jsdom (several hundred MB). Vitest's default (one per core)
    // runs an 8 GB laptop out of memory and tests time out; 3 passes everything and runs faster.
    maxWorkers: 3,
  },
});
