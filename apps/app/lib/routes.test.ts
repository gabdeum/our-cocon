/// <reference types="node" />
// Spec 002, User Story 2 › scenario 2: the tab bar is hidden on pushed screens, sheets, forms and
// cooking mode. It is drawn only by app/(tabs)/_layout.tsx, so only the four tab screens may live
// in app/(tabs); every other route is a root-stack sibling and never shows it. (Expo Router's own
// test renderer needs React Native Testing Library, which can't run under Vitest.)
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { TABS } from './navigation';

const tabsDir = join(import.meta.dirname, '../app/(tabs)');

it('keeps only the four tab screens inside (tabs)', () => {
  const screens = readdirSync(tabsDir)
    .filter((f) => /\.tsx?$/.test(f) && !f.startsWith('_') && !f.includes('.test.'))
    .map((f) => f.replace(/\.tsx?$/, ''))
    .sort();
  expect(screens).toEqual(TABS.map((t) => t.route).sort());
});

it('has no folders (nested routes) inside (tabs)', () => {
  expect(readdirSync(tabsDir, { withFileTypes: true }).filter((d) => d.isDirectory())).toEqual([]);
});
