import { describe, expect, it, vi } from 'vitest';
import { shareInvite } from './invite';

vi.mock('expo-linking', () => ({ createURL: (p: string) => `ourcocon://${p}` }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));

const token = 'a'.repeat(43);

describe('shareInvite', () => {
  it('shares a message with the join link', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareInvite(token, 'The Demanges', { share, copy: vi.fn() })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ message: `Join The Demanges on Our Cocon: ${window.location.origin}/join/${token}` });
  });

  it('copies the link where the browser cannot share', async () => {
    const copy = vi.fn();
    const share = vi.fn().mockRejectedValue(new Error('Share is not supported in this browser'));
    expect(await shareInvite(token, 'The Demanges', { share, copy })).toBe('copied');
    expect(copy).toHaveBeenCalledWith(expect.stringContaining(`/join/${token}`));
  });

  it('treats a closed share sheet as dismissed', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    expect(await shareInvite(token, 'F', { share: vi.fn().mockRejectedValue(abort), copy: vi.fn() })).toBe('dismissed');
    expect(await shareInvite(token, 'F', { share: vi.fn().mockResolvedValue({ action: 'dismissedAction' }), copy: vi.fn() })).toBe('dismissed');
  });
});
