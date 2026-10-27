import { describe, expect, it } from 'vitest';
import { shownByFilter } from './filter';

const eva = '00000000-0000-4000-8000-00000000000e';
const james = '00000000-0000-4000-8000-00000000000a';

describe('shownByFilter (spec 036 FR-004)', () => {
  it('shows everything when nobody is hidden', () => {
    expect(shownByFilter([eva], new Set())).toBe(true);
  });

  it("hides an event when its only member is hidden", () => {
    expect(shownByFilter([eva], new Set([eva]))).toBe(false);
  });

  it('keeps a shared event while any of its members is shown', () => {
    expect(shownByFilter([eva, james], new Set([eva]))).toBe(true);
    expect(shownByFilter([eva, james], new Set([eva, james]))).toBe(false);
  });

  it('treats Everyone and Others as chips of their own', () => {
    expect(shownByFilter(['everyone'], new Set([eva, james]))).toBe(true);
    expect(shownByFilter(['everyone'], new Set(['everyone']))).toBe(false);
    expect(shownByFilter([eva, 'others'], new Set([eva]))).toBe(true);
    expect(shownByFilter(['others'], new Set(['others']))).toBe(false);
  });
});
