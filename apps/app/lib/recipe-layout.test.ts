import { describe, expect, it } from 'vitest';
import { layoutTier } from '@cocon/ui';
import { recipeLayout } from './recipe-layout';

const at = (width: number, web = false) => recipeLayout(layoutTier(width), width, web);

describe('recipeLayout (spec 067)', () => {
  it('keeps the phone layout below 600', () => {
    expect(at(390)).toEqual({ split: false, twoColumn: false, photoHeight: 240 });
    expect(at(590)).toEqual({ split: false, twoColumn: false, photoHeight: 240 });
  });

  it('puts ingredients and steps side by side from 600, with the taller photo', () => {
    expect(at(744)).toEqual({ split: false, twoColumn: true, photoHeight: 280 });
  });

  it('adds the list from 960, with tabs until the recipe itself has 600', () => {
    expect(at(960)).toEqual({ split: true, twoColumn: false, photoHeight: 240 });
    expect(at(1023)).toMatchObject({ split: true, twoColumn: false });
    expect(at(1024)).toMatchObject({ split: true, twoColumn: true });
    expect(at(1180)).toEqual({ split: true, twoColumn: true, photoHeight: 280 });
  });

  it('measures the recipe inside the web frame, not the whole window', () => {
    expect(at(1600, true)).toMatchObject({ split: true, twoColumn: true });
  });
});
