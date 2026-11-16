// Spec 057 FR-006: the new and edit reminder sheet.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { render } from '../../test/render';
import { expectAccessible } from '../../test/axe';
import { alex, gabriel } from '../../test/fakes';
import { newReminderForm } from '../../lib/reminders';
import { ReminderSheet, type ReminderSheetProps } from './ReminderSheet';

afterEach(cleanup);

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
});
