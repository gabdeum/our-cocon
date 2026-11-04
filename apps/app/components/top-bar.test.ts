// Spec 050 SC-001: every pushed screen has the TopBar's round back button, so no text back link
// ("‹ Menu", "‹ Calendar") is left, and every back label names where it goes. Each screen's own test
// checks its "Back to …" button.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';
import { strings } from '../strings/en';

const app = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

it('leaves no text back link in the app', () => {
  const offenders = [...sources(join(app, 'app')), ...sources(join(app, 'components'))].filter((f) => /\bBack(Link|Header)\b/.test(readFileSync(f, 'utf8')));
  expect(offenders.map((f) => relative(app, f))).toEqual([]);
});

it('names every back button "Back to …" (Timers opens from anywhere: "Back")', () => {
  const labels: string[] = [];
  const walk = (node: unknown, key: string) => {
    if (typeof node === 'string' && key === 'back') labels.push(node);
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, k);
  };
  walk(strings, '');
  expect(labels.length).toBeGreaterThan(5);
  for (const label of labels) expect(label, label).toMatch(/^Back( to .+)?$/);
});
