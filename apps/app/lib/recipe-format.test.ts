// Spec 006 FR-001 and FR-002: the meta line, the author line and the one total-time format.
import { describe, expect, it } from 'vitest';
import { formatTotalTime, recipeAuthor, recipeMeta } from './recipe-format';
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

describe('recipeAuthor', () => {
  const members = [gabriel, alex, mia];

  it('names the member, and the assistant when an AI made it', () => {
    expect(recipeAuthor(mia.user_id, 'app', members)).toBe('Mia');
    expect(recipeAuthor(alex.user_id, 'chatgpt', members)).toBe('Alex · via ChatGPT');
    expect(recipeAuthor(gabriel.user_id, 'claude', members)).toBe('Gabriel · via Claude');
  });

  it('copes with an unknown assistant or a member who left', () => {
    expect(recipeAuthor(alex.user_id, 'mcp', members)).toBe('Alex · via an AI assistant');
    expect(recipeAuthor('u-gone', 'app', members)).toBe('Former member');
    expect(recipeAuthor(null, 'gemini', members)).toBe('Former member · via Gemini');
  });
});
