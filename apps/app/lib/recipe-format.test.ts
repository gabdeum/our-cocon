// Spec 006 FR-001 and FR-002: the meta line, the author line and the one total-time format.
import { describe, expect, it } from 'vitest';
import { formatTotalTime, memberName, recipeMeta, recipeSource } from './recipe-format';
import { alex, gabriel, mia } from '../test/fakes';

describe('formatTotalTime', () => {
  it.each([
    [40, '40 min'],
    [59, '59 min'],
    [60, '1 h'],
    [65, '1 h 05'],
    [70, '1 h 10'],
    [120, '2 h'],
    [150, '2 h 30'],
  ])('%i minutes → %s', (minutes, text) => {
    expect(formatTotalTime(minutes)).toBe(text);
  });
});

describe('recipeMeta', () => {
  const base = { total_minutes: 40, serves: 4, cuisine: 'italian', variantCount: 0 };

  it('reads time · servings · cuisine · variants', () => {
    expect(recipeMeta(base)).toBe('40 min · Serves 4 · Italian');
    expect(recipeMeta({ total_minutes: 70, serves: 6, cuisine: 'french', variantCount: 2 })).toBe('1 h 10 · Serves 6 · French · 2 variants');
    expect(recipeMeta({ ...base, variantCount: 1 })).toBe('40 min · Serves 4 · Italian · 1 variant');
  });

  it('leaves out each fact that has no value, with its separator', () => {
    expect(recipeMeta({ ...base, total_minutes: null })).toBe('Serves 4 · Italian');
    expect(recipeMeta({ ...base, cuisine: null })).toBe('40 min · Serves 4');
    expect(recipeMeta({ total_minutes: null, serves: 8, cuisine: null, variantCount: 0 })).toBe('Serves 8');
  });

  it('treats an unknown cuisine as Other, never shown', () => {
    expect(recipeMeta({ ...base, cuisine: 'vegetarian' })).toBe('40 min · Serves 4');
    expect(recipeMeta({ ...base, cuisine: 'latin_american' })).toBe('40 min · Serves 4 · Latin American');
  });
});

describe('recipeSource (spec 051 FR-015)', () => {
  const members = [gabriel, alex, mia];
  const of = (source_text: string | null, source: string, by: string | null) => recipeSource({ source_text, source }, memberName(by, members));

  it('US6: the source when there is one, never "via"', () => {
    expect(of('La Cuisine de Mamie · p. 48', 'claude', gabriel.user_id)).toBe('La Cuisine de Mamie · p. 48');
    expect(of('  ', 'app', mia.user_id)).toBe('Mia');
  });

  it('else the assistant that made it, or who added it', () => {
    expect(of(null, 'chatgpt', alex.user_id)).toBe('ChatGPT');
    expect(of(null, 'mcp', alex.user_id)).toBe('An AI assistant');
    expect(of(null, 'app', mia.user_id)).toBe('Mia');
    expect(of(null, 'app', 'u-gone')).toBe('Former member');
  });
});
