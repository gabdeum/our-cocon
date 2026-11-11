import axe from 'axe-core';
import { expect, vi } from 'vitest';

/**
 * Spec 030 SC-001: axe finds no critical or serious issue on what's on screen (the page and any
 * open sheet). jsdom draws nothing, so colour contrast is checked on the tokens instead
 * (scripts/theme.test.ts).
 */
export async function expectAccessible(root: Element = document.body) {
  const run = axe.run(root, { rules: { 'color-contrast': { enabled: false } } });
  // axe waits on timers: under fake ones, move the clock along until it's done.
  let done = false;
  void run.finally(() => (done = true));
  while (vi.isFakeTimers() && !done) await vi.advanceTimersByTimeAsync(1);
  const { violations } = await run;
  const serious = violations
    .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !rnwModalRoot(v.id, n.html)) }))
    .filter((v) => (v.impact === 'critical' || v.impact === 'serious') && v.nodes.length > 0);
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 160)).join(' | ')}`)).toEqual([]);
}

/** react-native-web's Modal keeps `aria-modal` on its root and drops the role while it opens or closes; our sheets carry their own dialog role. */
const rnwModalRoot = (rule: string, html: string) => rule === 'aria-allowed-attr' && /^<div aria-modal="true" class="css-view[^"]*">/.test(html);
