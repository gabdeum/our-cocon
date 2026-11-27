// Spec 075 FR-002, FR-003: a tick saved on the notes as seen; on a conflict, onto the latest notes
// when that line is still the same item, otherwise the latest notes show; errors undo the tick.
import { describe, expect, it, vi } from 'vitest';
import { toggleAndSave } from './note-checklist';

const notes = 'Bring:\n- [ ] Towel\n- [x] Goggles';

describe('toggleAndSave', () => {
  it('saves the note with only that line flipped', async () => {
    const save = vi.fn(async () => 'saved' as const);
    await expect(toggleAndSave(notes, 1, { save, reload: vi.fn() })).resolves.toEqual({ kind: 'saved', notes: 'Bring:\n- [x] Towel\n- [x] Goggles', checked: true });
    expect(save).toHaveBeenCalledWith(notes, 'Bring:\n- [x] Towel\n- [x] Goggles');
    await expect(toggleAndSave(notes, 2, { save, reload: vi.fn() })).resolves.toMatchObject({ kind: 'saved', checked: false });
  });

  it('puts the tick on the latest note when someone changed another line', async () => {
    const latest = 'Bring (Saturday):\n- [ ] Towel\n- [x] Goggles\n- [ ] Snack';
    const save = vi.fn(async (from: string) => (from === latest ? ('saved' as const) : ('changed' as const)));
    await expect(toggleAndSave(notes, 1, { save, reload: async () => latest })).resolves.toEqual({
      kind: 'saved',
      notes: 'Bring (Saturday):\n- [x] Towel\n- [x] Goggles\n- [ ] Snack',
      checked: true,
    });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('counts as saved when someone already ticked the same item', async () => {
    const latest = 'Bring:\n- [x] Towel\n- [x] Goggles';
    const save = vi.fn(async () => 'changed' as const);
    await expect(toggleAndSave(notes, 1, { save, reload: async () => latest })).resolves.toEqual({ kind: 'saved', notes: latest, checked: true });
    expect(save).toHaveBeenCalledOnce();
  });

  it('shows the latest note when that line is no longer the same item, or the note is gone', async () => {
    const save = vi.fn(async () => 'changed' as const);
    await expect(toggleAndSave(notes, 1, { save, reload: async () => 'Bring:\n- [ ] Sun cream' })).resolves.toEqual({ kind: 'changed', notes: 'Bring:\n- [ ] Sun cream' });
    await expect(toggleAndSave(notes, 1, { save, reload: async () => 'All packed' })).resolves.toEqual({ kind: 'changed', notes: 'All packed' });
    await expect(toggleAndSave(notes, 1, { save, reload: async () => null })).resolves.toEqual({ kind: 'changed', notes: null });
  });

  it('fails when the save or the reload does (offline, server error)', async () => {
    await expect(toggleAndSave(notes, 1, { save: async () => Promise.reject(new Error('offline')), reload: vi.fn() })).resolves.toEqual({ kind: 'failed' });
    await expect(toggleAndSave(notes, 1, { save: async () => 'changed', reload: async () => Promise.reject(new Error('offline')) })).resolves.toEqual({ kind: 'failed' });
  });

  it('does nothing for a line that is not a checklist item', async () => {
    const save = vi.fn();
    await expect(toggleAndSave(notes, 0, { save, reload: vi.fn() })).resolves.toEqual({ kind: 'changed', notes });
    expect(save).not.toHaveBeenCalled();
  });
});
