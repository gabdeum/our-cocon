import { defineConfig } from 'vitest/config';

// Each package with tests has its own vitest.config.ts; this file lists them.
export default defineConfig({
  test: {
    projects: ['{apps,packages}/*/vitest.config.{ts,mts}', '{scripts,infra}/vitest.config.{ts,mts}'],
    passWithNoTests: true,
    // Each screen-test worker holds its own jsdom (several hundred MB). On the 8 GB laptop even 3
    // workers run out of memory and tests time out; 1 passes everything. CI has room for 3.
    maxWorkers: process.env.CI ? 3 : 1,
  },
});
