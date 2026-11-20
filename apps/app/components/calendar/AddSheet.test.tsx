// The calendar's add sheet switches between a new event and a new reminder, keeping what's typed.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { newDraft } from '../../lib/event-form';
import { newReminderForm } from '../../lib/reminders';
import { AddSheet, type AddSheetProps } from './AddSheet';
import type { EventSheetProps } from './EventSheet';
import { alex, fakeTracker, flush, gabriel } from '../../test/fakes';
import { render } from '../../test/render';
import { expectAccessible } from '../../test/axe';

afterEach(cleanup);

const eva = { ...alex, display_name: 'Eva' };
const TODAY = '2026-10-28';

/** No events and no suggested titles, whatever the query. */
function emptyClient() {
  const query: Record<string, unknown> = new Proxy({}, { get: (_t, name) => (name === 'then' ? (resolve: (v: unknown) => void) => resolve({ data: [], error: null }) : () => query) });
  return { from: () => query, rpc: async () => ({ data: [], error: null }) } as unknown as EventSheetProps['client'];
}

async function setup() {
  const tracker = fakeTracker();
  const props: AddSheetProps = {
    slotTimes: DEFAULT_SLOT_TIMES,
    tracker,
    event: {
      mode: 'new',
      initial: newDraft({ date: '2026-10-30' }, TODAY),
      client: emptyClient(),
      familyId: 'f',
      members: [gabriel, eva],
      myMemberId: gabriel.id,
      today: TODAY,
      slotTimes: DEFAULT_SLOT_TIMES,
      weekStartsOn: 0,
      tracker,
      onSave: vi.fn(async () => undefined),
      onClose: vi.fn(),
    },
    reminder: {
      mode: 'new',
      initial: newReminderForm(gabriel.id, TODAY),
      members: [gabriel, eva],
      today: TODAY,
      use24h: true,
      weekStartsOn: 0,
      onSave: vi.fn(async () => undefined),
      onClose: vi.fn(),
    },
  };
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AddSheet {...props} />
    </QueryClientProvider>,
  );
  await flush();
  return props;
}

const kind = () => screen.getByRole('group', { name: 'What to add' });
const switchTo = (name: string) => fireEvent.click(within(kind()).getByRole('button', { name }));
const pressed = (name: string | RegExp) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('AddSheet', () => {
  it('"New event · New reminder" in place of the title, the event first', async () => {
    await setup();
    expect(screen.getByRole('dialog', { name: 'New event' })).toBeTruthy();
    expect(within(kind()).getByRole('button', { name: 'New event' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(kind()).getByRole('button', { name: 'New reminder' }).getAttribute('aria-pressed')).toBe('false');
    await expectAccessible();
  });

  it('switching keeps the title, day, time and who, and back again keeps what only the event has', async () => {
    const props = await setup();
    fireEvent.change(screen.getByLabelText("What's happening?"), { target: { value: 'Pay the daycare' } });
    fireEvent.click(screen.getByRole('button', { name: 'Evening, 18–22' }));
    fireEvent.click(screen.getByRole('button', { name: /^Eva/ }));

    switchTo('New reminder');
    expect(screen.getByRole('dialog', { name: 'New reminder' })).toBeTruthy();
    expect((screen.getByLabelText('Remind us to…') as HTMLInputElement).value).toBe('Pay the daycare');
    expect(pressed('Other day, Fri, Oct 30')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Set a time' }).getAttribute('aria-checked')).toBe('true');
    expect(pressed(/^Eva/)).toBe('true');
    expect(props.tracker.track).toHaveBeenLastCalledWith('add_sheet_switched', { to: 'reminder' });

    fireEvent.change(screen.getByLabelText('Remind us to…'), { target: { value: 'Pay the nanny' } });
    switchTo('New event');
    expect((screen.getByLabelText("What's happening?") as HTMLInputElement).value).toBe('Pay the nanny');
    // The time wasn't changed in the reminder: still the Evening slot, not 18:00–19:00.
    expect(pressed('Evening, 18–22')).toBe('true');
    expect(pressed(/^Eva/)).toBe('true');
  });

  it('saves a reminder from the calendar', async () => {
    const props = await setup();
    switchTo('New reminder');
    fireEvent.change(screen.getByLabelText('Remind us to…'), { target: { value: 'Pay the daycare' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(props.reminder.onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pay the daycare', due_date: '2026-10-30', time: null, assignee: 'everyone' }));
    expect(props.event.onSave).not.toHaveBeenCalled();
  });
});
