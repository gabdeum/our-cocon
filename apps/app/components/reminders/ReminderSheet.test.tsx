// Spec 057 FR-006: the new and edit reminder sheet.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { render } from '../../test/render';
import { expectAccessible } from '../../test/axe';
import { alex, fakeTracker, flush, gabriel } from '../../test/fakes';
import { newReminderForm } from '../../lib/reminders';
import { ReminderSheet, type ReminderSheetProps } from './ReminderSheet';

// Spec 065: the window's width, for the sheet's presentation (390 unless a test widens it).
const dims = vi.hoisted(() => ({ width: 390, height: 844 }));
vi.mock('react-native', async (actual) => ({ ...(await actual<typeof import('react-native')>()), useWindowDimensions: () => ({ ...dims, scale: 2, fontScale: 1 }) }));
afterEach(() => {
  cleanup();
  dims.width = 390;
});

const today = '2026-11-11';

function setup(over: Partial<ReminderSheetProps> = {}) {
  const props: ReminderSheetProps = {
    mode: 'new',
    initial: newReminderForm(gabriel.id, today),
    members: [gabriel, alex],
    today,
    use24h: true,
    weekStartsOn: 1,
    onSave: vi.fn(async () => undefined),
    onClose: vi.fn(),
    ...over,
  };
  render(<ReminderSheet {...props} />);
  return props;
}

const pressed = (name: string | RegExp) => screen.getByRole('button', { name }).getAttribute('aria-pressed');
const save = () => act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));

describe('ReminderSheet', () => {
  it('starts today, any time, Next day, never repeating, for me', async () => {
    setup();
    const sheet = screen.getByRole('dialog', { name: 'New reminder' });
    expect(within(sheet).getByRole('textbox', { name: 'Remind us to…' }).getAttribute('placeholder')).toBe('e.g. Pay the daycare');
    expect(pressed('Today, Wed 11')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Set a time' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Every hour' })).toBeNull();
    expect(pressed('Next day')).toBe('true');
    expect(screen.getByText('Moves to the next day and shows how late it is. The due date doesn’t change.')).toBeTruthy();
    expect(pressed('Never')).toBe('true');
    expect(pressed(/^Gabriel/)).toBe('true');
    expect(screen.getByText('Notifies Gabriel at 09:00 on the day, then each morning while it’s late.')).toBeTruthy();
    await expectAccessible(sheet);
  });

  it('asks for a name before saving', async () => {
    const p = setup();
    await save();
    expect(screen.getByText('Give your reminder a name.')).toBeTruthy();
    expect(p.onSave).not.toHaveBeenCalled();
  });

  it('with a time: Every hour by default, the hourly summary, and back to Next day without it', () => {
    setup();
    fireEvent.click(screen.getByRole('switch', { name: 'Set a time' }));
    expect(pressed('Every hour')).toBe('true');
    expect(screen.getByText('Stays on Home and nudges every hour until someone ticks it.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Time' }), { target: { value: '15:00' } });
    expect(screen.getByText('Notifies Gabriel at 14:00 and 15:00, then every hour until done. Quiet from 22:00 to 07:00.')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Set a time' }));
    expect(screen.queryByRole('button', { name: 'Every hour' })).toBeNull();
    expect(pressed('Next day')).toBe('true');
  });

  it('saves what was chosen', async () => {
    const p = setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Remind us to…' }), { target: { value: 'Pay the daycare' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tomorrow, Thu 12' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave it' }));
    expect(screen.getByText('Stays on its due day in the calendar. No more nudges.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Every month' }));
    fireEvent.click(screen.getByRole('button', { name: /^Everyone/ }));
    expect(screen.getByText('Notifies everyone at 09:00 on the day.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: /Notes/ }), { target: { value: 'Cash only' } });
    await save();
    expect(p.onSave).toHaveBeenCalledWith({
      title: 'Pay the daycare',
      notes: 'Cash only',
      due_date: '2026-11-12',
      time: null,
      repeat: { freq: 'monthly', ends: { type: 'never' } },
      rollover: 'none',
      assignee: 'everyone',
    });
  });

  it('Custom shows the event repeats with their days and end', async () => {
    const p = setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Remind us to…' }), { target: { value: 'Swim bag' } });
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.click(screen.getByRole('button', { name: 'Every 2 weeks' }));
    fireEvent.click(screen.getByRole('button', { name: 'After a number of times' }));
    await save();
    expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({ repeat: { freq: 'biweekly', ends: { type: 'after', count: 10 } } }));
  });

  it('stays open as typed when it couldn’t save', async () => {
    const p = setup({ onSave: vi.fn(async () => Promise.reject(new Error('offline'))) });
    fireEvent.change(screen.getByRole('textbox', { name: 'Remind us to…' }), { target: { value: 'Call the vet' } });
    await save();
    expect(await screen.findByText("Couldn't save. Try again.")).toBeTruthy();
    expect(p.onClose).not.toHaveBeenCalled();
    expect((screen.getByRole('textbox', { name: 'Remind us to…' }) as HTMLInputElement).value).toBe('Call the vet');
  });

  it('edits with Delete reminder at the bottom', () => {
    const p = setup({ mode: 'edit', initial: { ...newReminderForm(gabriel.id, today), title: 'Bins' }, onDelete: vi.fn() });
    expect(screen.getByRole('dialog', { name: 'Edit reminder' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete reminder' }));
    expect(p.onDelete).toHaveBeenCalledOnce();
  });

  it('Cancel on the phone sheet; none beside the ✕ on the centred card from 600 (Gabriel)', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    cleanup();
    dims.width = 820;
    setup();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('suggests past titles while typing a new one; a pick fills it like the latest one, keeping the day and what was changed', async () => {
    vi.useFakeTimers();
    const stored = {
      id: '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a02',
      title: 'Pay rent',
      notes: 'Landlord',
      assignee_id: null,
      due_at: '2026-11-01T17:30:00+00:00',
      has_time: true,
      repeat_rule: { freq: 'monthly', ends: { type: 'never' } },
      repeat_from: '2026-11-01',
      next_due_at: null,
      rollover: 'day',
      snoozed_until: null,
      source: 'app',
      created_by: null,
      created_at: '2026-10-01T10:00:00+00:00',
      updated_at: '2026-10-01T10:00:00+00:00',
      completed_at: null,
    };
    const query: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'is']) query[op] = () => query;
    query.maybeSingle = async () => ({ data: stored, error: null });
    query.single = query.maybeSingle;
    const client = {
      from: () => query,
      rpc: vi.fn(async () => ({ data: [{ title: 'Pay rent', score: 1, last_reminder_id: stored.id, has_time: true, due_at: stored.due_at }], error: null })),
    };
    const tracker = fakeTracker();
    setup({ suggest: { client: client as never, tz: 'UTC', tracker } });
    const title = screen.getByRole('textbox', { name: 'Remind us to…' });
    fireEvent.focus(title);
    fireEvent.change(title, { target: { value: 'pa' } });
    await act(async () => vi.advanceTimersByTime(200));
    vi.useRealTimers();
    const list = screen.getByRole('list', { name: 'Suggestions' });
    expect(list.textContent).toBe('Pay rent · 17:30');
    fireEvent.click(within(list).getByRole('button', { name: 'Pay rent, 17:30' }));
    await flush();
    expect((title as HTMLInputElement).value).toBe('Pay rent');
    expect(screen.getByRole('switch', { name: 'Set a time' }).getAttribute('aria-checked')).toBe('true');
    expect(pressed('Every month')).toBe('true');
    expect(pressed('Today, Wed 11')).toBe('true');
    // Notes are about that day: not copied.
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('');
    expect(tracker.track).toHaveBeenCalledWith('reminder_title_suggestion_picked', { position: 1, query_length: 2 });
  });

  it('no suggestions when editing', async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    setup({ mode: 'edit', suggest: { client: { from: vi.fn(), rpc } as never, tz: 'UTC', tracker: fakeTracker() } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Remind us to…' }), { target: { value: 'pa' } });
    await act(async () => new Promise((r) => setTimeout(r, 200)));
    expect(rpc).not.toHaveBeenCalled();
  });
});
