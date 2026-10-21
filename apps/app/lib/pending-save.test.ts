import { describe, expect, it, vi } from 'vitest';
import { clearPendingSave, PENDING_SAVE_MS, pendingSave, rememberPendingSave } from './pending-save';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));

// Spec 019 FR-004: a save waiting through sign-in, and never for the next person on the device.
function memory() {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn(async (k: string) => data.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void data.set(k, v)),
    removeItem: vi.fn(async (k: string) => void data.delete(k)),
  };
}
const token = 'a'.repeat(43);

describe('pending save', () => {
  it('waits for the link through sign-in', async () => {
    const s = memory();
    await rememberPendingSave(token, s, 1000);
    expect(await pendingSave(s, 1000 + 60_000)).toBe(token);
  });

  it('forgets it after an hour, or once cleared (sign-out)', async () => {
    const s = memory();
    await rememberPendingSave(token, s, 0);
    expect(await pendingSave(s, PENDING_SAVE_MS + 1)).toBeNull();
    await rememberPendingSave(token, s, 0);
    await clearPendingSave(s);
    expect(await pendingSave(s, 1)).toBeNull();
  });

  it('ignores anything that is not a share link', async () => {
    const s = memory();
    await s.setItem('cocon.pendingSave', JSON.stringify({ token: '../x', at: 0 }));
    expect(await pendingSave(s, 1)).toBeNull();
    await s.setItem('cocon.pendingSave', 'not json');
    expect(await pendingSave(s, 1)).toBeNull();
  });
});
