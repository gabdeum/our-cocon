// Spec 018 US2 and FR-003: Settings › Recently deleted lists deleted recipes newest first, with who
// deleted them, when and how long they stay; Restore brings one back, "Delete now" asks first.
// Spec 042: deleted events are listed with them.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../lib/toast';
import { fakeTracker, flush, gabriel, mia } from '../../test/fakes';
import type { DeletedItem } from '../../lib/recently-deleted';

vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'unused' }));

const { RecentlyDeleted } = await import('./RecentlyDeleted');
type Props = Parameters<typeof RecentlyDeleted>[0];

afterEach(cleanup);

const now = new Date('2026-10-21T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - (d * 24 + 2) * 60 * 60 * 1000).toISOString();
const quiche: DeletedItem = { kind: 'recipe', id: 'r1', name: 'Leek & bacon quiche', deleted_at: daysAgo(3), deleted_by: gabriel.user_id };
const music: DeletedItem = { kind: 'event', id: 'e1', name: 'Baby music class', deleted_at: daysAgo(5), deleted_by: mia.user_id };
const soup: DeletedItem = { kind: 'recipe', id: 'r2', name: 'Pumpkin soup', deleted_at: daysAgo(10), deleted_by: 'someone-who-left' };

function setup(over: Partial<Props> = {}) {
  const tracker = fakeTracker();
  const onRestore = vi.fn(async () => undefined);
  const onDeleteNow = vi.fn(async () => undefined);
  render(
    <RecentlyDeleted
      items={[quiche, music, soup]}
      members={[gabriel, mia]}
      tracker={tracker}
      onRetry={vi.fn()}
      onBack={vi.fn()}
      onRestore={onRestore}
      onDeleteNow={onDeleteNow}
      now={now}
      {...over}
    />,
    { wrapper: ToastProvider },
  );
  return { tracker, onRestore, onDeleteNow };
}

describe('Recently deleted', () => {
  it('lists each recipe with who deleted it, when, and the days left, newest first', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Recently deleted' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeTruthy();
    const first = screen.getByText('Deleted by Gabriel · 3 days ago · 27 days left');
    const second = screen.getByText('Deleted by Former member · 10 days ago · 20 days left');
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Restore brings it back and says so', async () => {
    const { tracker, onRestore } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Restore Leek & bacon quiche' }));
    await flush();
    expect(onRestore).toHaveBeenCalledWith(quiche);
    expect(tracker.track).toHaveBeenCalledWith('recipe_restored', { days_since_delete: expect.any(Number) });
    expect(screen.getByText('“Leek & bacon quiche” is back in your recipes.')).toBeTruthy();
  });

  it('says what to do when Restore fails', async () => {
    const { tracker } = setup({ onRestore: vi.fn(async () => Promise.reject(new Error('offline'))) });
    fireEvent.click(screen.getByRole('button', { name: 'Restore Leek & bacon quiche' }));
    await flush();
    expect(screen.getByText("Couldn't restore. Try again.")).toBeTruthy();
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it('"Delete now" asks in a Dialog before removing it for good', async () => {
    const { onDeleteNow } = setup();
    fireEvent.click(screen.getByText('Pumpkin soup'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete now' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete “Pumpkin soup” for good?' }).textContent).toContain(
      "Its photos and variants go with it. This can't be undone.",
    );
    expect(onDeleteNow).not.toHaveBeenCalled();
    const buttons = screen.getAllByRole('button', { name: 'Delete now' });
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await flush();
    expect(onDeleteNow).toHaveBeenCalledWith(soup);
  });

  it('lists deleted events too, and brings one back to the calendar (spec 042)', async () => {
    const { tracker, onRestore, onDeleteNow } = setup();
    expect(screen.getByText('Deleted by Mia · 5 days ago · 25 days left')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore Baby music class' }));
    await flush();
    expect(onRestore).toHaveBeenCalledWith(music);
    expect(tracker.track).not.toHaveBeenCalled();
    expect(screen.getByText('“Baby music class” is back in your calendar.')).toBeTruthy();
    fireEvent.click(screen.getByText('Baby music class'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete now' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete “Baby music class” for good?' }).textContent).toContain("This can't be undone.");
    const buttons = screen.getAllByRole('button', { name: 'Delete now' });
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await flush();
    expect(onDeleteNow).toHaveBeenCalledWith(music);
  });

  it('says when there is nothing to bring back', () => {
    setup({ items: [] });
    expect(screen.getByText('Nothing here.')).toBeTruthy();
    expect(screen.getByText('Recipes and events you delete stay here for 30 days.')).toBeTruthy();
  });

  it('offers Try again when the list could not load', () => {
    const onRetry = vi.fn();
    setup({ items: undefined, failed: true, onRetry });
    expect(screen.getByText("Couldn't load. Try again.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('offline, nothing can be restored or deleted', () => {
    const { onRestore } = setup({ readOnly: true });
    fireEvent.click(screen.getByRole('button', { name: 'Restore Leek & bacon quiche' }));
    expect(onRestore).not.toHaveBeenCalled();
  });
});
