import { describe, expect, it } from 'vitest';
import { readHidden, writeHidden } from './calendar-filter';
import type { ChoiceStorage } from './recipe-choices';

function memoryStorage(initial: Record<string, string> = {}): ChoiceStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return { data, getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) };
}

describe('calendar filter storage (spec 036 FR-004)', () => {
  it('keeps who is hidden, per person', async () => {
    const storage = memoryStorage();
    await writeHidden(storage, 'u-gabriel', new Set(['u-eva', 'others']));
    expect(await readHidden(storage, 'u-gabriel')).toEqual(new Set(['u-eva', 'others']));
    expect(await readHidden(storage, 'u-eva')).toEqual(new Set());
  });

  it('shows everyone when what was stored is unreadable', async () => {
    expect(await readHidden(memoryStorage({ 'cocon.calendar.filter.u': '{oops' }), 'u')).toEqual(new Set());
    expect(await readHidden(memoryStorage({ 'cocon.calendar.filter.u': '{"hidden":"u-eva"}' }), 'u')).toEqual(new Set());
    const failing: ChoiceStorage = { getItem: () => Promise.reject(new Error('no')), setItem: () => Promise.reject(new Error('no')) };
    expect(await readHidden(failing, 'u')).toEqual(new Set());
    await expect(writeHidden(failing, 'u', new Set(['x']))).resolves.toBeUndefined();
  });
});
