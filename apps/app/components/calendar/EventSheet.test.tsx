// Spec 041: the add sheet. US1 three taps, US2 details, US3 the soft conflict, Save with no title,
// a failed save, and the edit of one occurrence.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { newDraft, toastText } from '../../lib/event-form';
import { EventSheet, type EventSheetProps } from './EventSheet';
import { alex as alexFake, fakeTracker, flush, gabriel as gabrielFake, james as jamesFake } from '../../test/fakes';

afterEach(cleanup);

const gabriel = { ...gabrielFake, id: '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a01' };
const eva = { ...alexFake, id: '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a02', display_name: 'Eva' };
const james = { ...jamesFake, id: '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a03' };
const TODAY = '2026-10-28';

/** Movie night this evening, for Everyone, as events_visible gives it. */
const movieNight = {
  id: '3f0c1d6e-2b1a-4c8e-9a52-0d7e1f4b6a12',
  title: 'Movie night',
  category: null,
  location: null,
  notes: null,
  starts_on: TODAY,
  ends_on: TODAY,
  time_type: 'slot',
  slots: ['evening'],
  start_time: null,
  end_time: null,
  recurrence: null,
  reminder: 'none',
  responsible_member_id: null,
  visibility: 'family',
  creator_member_id: eva.id,
  members: ['everyone'],
  removed_members: [],
  exceptions: [],
  checklist: [],
  surprise: null,
  created_by: null,
  updated_by: null,
  source: 'app',
  created_at: '2026-10-27T10:00:00Z',
  updated_at: '2026-10-27T10:00:00Z',
  deleted_at: null,
};

/** A client whose events_visible holds `rows`, whatever the query. */
function fakeClient(rows: unknown[]) {
  const query: Record<string, unknown> = new Proxy(
    {},
    { get: (_t, name) => (name === 'then' ? (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }) : () => query) },
  );
  return { from: () => query } as unknown as EventSheetProps['client'];
}

async function setup(over: Partial<EventSheetProps> = {}, rows: unknown[] = []) {
  const props: EventSheetProps = {
    mode: 'new',
    initial: newDraft({}, TODAY, gabriel.id),
    client: fakeClient(rows),
    familyId: 'f',
    members: [gabriel, eva, james],
    myMemberId: gabriel.id,
    today: TODAY,
    slotTimes: DEFAULT_SLOT_TIMES,
    weekStartsOn: 0,
    tracker: fakeTracker(),
    onSave: vi.fn(async () => undefined),
    onClose: vi.fn(),
    ...over,
  };
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <EventSheet {...props} />
    </QueryClientProvider>,
  );
  await flush();
  return props;
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const title = () => screen.getByLabelText("What's happening?");
const saved = (props: EventSheetProps) => (props.onSave as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];

describe('EventSheet (spec 041)', () => {
  it('shows the quick sheet in the designed order', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'New event' })).toBeTruthy();
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['New event', 'When', 'Time of day', 'Who']);
    expect(screen.getByText('Pick a time of day — no need for exact hours.')).toBeTruthy();
    expect(button('Today, Wed 28').getAttribute('aria-pressed')).toBe('true');
    expect(button('Other day, Pick a date')).toBeTruthy();
    expect(button('All day, Whole day').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('group', { name: 'Who' }).textContent).toBe('GGabrielEEvaJJamesAllEveryoneOthers');
    expect(button('Gabriel').getAttribute('aria-pressed')).toBe('true');
    expect(button('More options').getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('Place, repeat, reminder…')).toBeTruthy();
    expect(button('Save').getAttribute('aria-disabled')).toBeNull();
  });

  it('US1: "Poker night", Today, Evening, Save', async () => {
    const props = await setup();
    fireEvent.change(title(), { target: { value: 'Poker night' } });
    fireEvent.click(button('Today, Wed 28'));
    fireEvent.click(button('Evening, 18–22'));
    fireEvent.click(button('Save'));
    await flush();
    const input = saved(props);
    expect(input).toMatchObject({ title: 'Poker night', starts_on: TODAY, time_type: 'slot', slots: ['evening'], members: [gabriel.id], recurrence: null });
    expect(toastText(input, TODAY, DEFAULT_SLOT_TIMES)).toBe('Poker night added for tonight, 18:00–22:00.');
    expect((props.onSave as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toMatchObject({ usedMoreOptions: false, secondsToSave: expect.any(Number) });
    expect(props.tracker.track).not.toHaveBeenCalled();
  });

  it('US2: Gabriel + James, weekly on Saturday, a place, Gabriel takes James', async () => {
    const props = await setup();
    fireEvent.change(title(), { target: { value: 'Baby music class' } });
    fireEvent.click(button('Morning, 09–12'));
    fireEvent.click(button('James'));
    fireEvent.click(button('More options'));
    expect(screen.getByText('Hide')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Who takes James?' })).toBeTruthy();
    expect(screen.getByText('James was added by the family, so someone with the app handles this.')).toBeTruthy();
    expect(button('Not decided yet').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'James' }) && screen.getAllByRole('button', { name: /^(Gabriel|Eva)$/ })).toHaveLength(4);
    fireEvent.click(screen.getAllByRole('button', { name: 'Gabriel' })[1] as HTMLElement);
    fireEvent.click(button('Weekly'));
    expect(button('Wednesday').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button('Wednesday'));
    fireEvent.click(button('Saturday'));
    fireEvent.change(screen.getByLabelText('Where'), { target: { value: 'Little Notes studio' } });
    expect(screen.getByText('Shows on Home for now. Phone alerts come later.')).toBeTruthy();
    fireEvent.click(button('Save'));
    await flush();
    expect(saved(props)).toMatchObject({
      starts_on: '2026-10-31',
      members: [gabriel.id, james.id],
      recurrence: { freq: 'weekly', weekdays: [6], ends: { type: 'never' } },
      location: 'Little Notes studio',
      responsible_member_id: gabriel.id,
    });
    expect((props.onSave as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toMatchObject({ usedMoreOptions: true });
  });

  it('US3: warns about Movie night this evening, and still saves', async () => {
    const props = await setup({}, [movieNight]);
    fireEvent.change(title(), { target: { value: 'Poker night' } });
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(button('Evening, 18–22'));
    await flush();
    expect(screen.getByRole('status').textContent).toBe('You already have Movie night this evening. Add anyway?');
    fireEvent.click(button('Save'));
    await flush();
    expect(props.onSave).toHaveBeenCalled();
    expect(props.tracker.track).toHaveBeenCalledWith('event_conflict_shown', { proceeded: true });
  });

  it('tells Cancel the conflict was seen and not taken', async () => {
    const props = await setup({ initial: newDraft({ slot: 'evening' }, TODAY, gabriel.id) }, [movieNight]);
    await flush();
    fireEvent.click(button('Cancel'));
    expect(props.tracker.track).toHaveBeenCalledWith('event_conflict_shown', { proceeded: false });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('Save with no title: warns and keeps everything else', async () => {
    const props = await setup();
    fireEvent.click(button('Lunch, 12–14'));
    fireEvent.click(button('Save'));
    await flush();
    expect(screen.getByRole('alert').textContent).toBe('Give your event a name.');
    expect(title().getAttribute('aria-invalid')).toBe('true');
    expect(props.onSave).not.toHaveBeenCalled();
    expect(button('Lunch, 12–14').getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(title(), { target: { value: 'Brunch' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the sheet open when saving fails', async () => {
    const props = await setup({ onSave: vi.fn(async () => Promise.reject(new Error('offline'))) });
    fireEvent.change(title(), { target: { value: 'Poker night' } });
    fireEvent.click(button('Save'));
    await flush();
    expect(screen.getByText("Couldn't save. Check your connection and try again.")).toBeTruthy();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('Custom: starts on the slot’s times and checks them', async () => {
    const props = await setup({ initial: { ...newDraft({ slot: 'afternoon' }, TODAY, gabriel.id), title: 'Swim' } });
    fireEvent.click(button('Custom, Pick times'));
    expect((screen.getByLabelText('Starts') as HTMLInputElement).value).toBe('14:00');
    expect((screen.getByLabelText('Ends') as HTMLInputElement).value).toBe('18:00');
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '13:00' } });
    fireEvent.click(button('Save'));
    await flush();
    expect(screen.getByText('Pick an end time after the start.')).toBeTruthy();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('picks another day from the date sheet', async () => {
    const props = await setup({ initial: { ...newDraft({}, TODAY, gabriel.id), title: 'Trip' } });
    fireEvent.click(button('Other day, Pick a date'));
    fireEvent.click(button('Next month'));
    fireEvent.click(button('Saturday, Nov 7'));
    expect(button('Other day, Sat, Nov 7').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button('Tomorrow, Thu 29'));
    expect(button('Tomorrow, Thu 29').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button('Save'));
    await flush();
    expect(saved(props)).toMatchObject({ starts_on: '2026-10-29', time_type: 'all_day' });
  });

  it('Birthday makes it all day, every year; repeats end after a number of times', async () => {
    const props = await setup({ initial: { ...newDraft({ slot: 'lunch' }, TODAY, gabriel.id), title: 'Eva' } });
    fireEvent.click(button('More options'));
    fireEvent.click(button('Birthday'));
    expect(button('Yearly').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button('After a number of times'));
    fireEvent.change(screen.getByLabelText('Times'), { target: { value: '0' } });
    fireEvent.click(button('Save'));
    await flush();
    expect(screen.getByText('Use a number from 1 to 1000.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Times'), { target: { value: '80' } });
    fireEvent.click(button('Save'));
    await flush();
    expect(saved(props)).toMatchObject({ category: 'birthday', time_type: 'all_day', recurrence: { freq: 'yearly', ends: { type: 'after', count: 80 } } });
  });

  it('adds and removes checklist items', async () => {
    const props = await setup({ initial: { ...newDraft({}, TODAY, gabriel.id), title: 'Picnic' } });
    fireEvent.click(button('More options'));
    fireEvent.click(button('+ Add to checklist'));
    const field = screen.getByLabelText('Checklist item');
    fireEvent.change(field, { target: { value: 'Chips and dip' } });
    act(() => {
      fireEvent.blur(field);
    });
    fireEvent.click(button('+ Add to checklist'));
    fireEvent.change(screen.getByLabelText('Checklist item'), { target: { value: 'Rug' } });
    act(() => {
      fireEvent.blur(screen.getByLabelText('Checklist item'));
    });
    fireEvent.click(button('Remove Chips and dip'));
    fireEvent.click(button('Save'));
    await flush();
    expect(saved(props)).toMatchObject({ checklist: [{ label: 'Rug' }] });
  });

  it('an edit opens More options when anything in it is set', async () => {
    await setup({ mode: 'edit', initial: { ...newDraft({}, TODAY, gabriel.id), title: 'Dentist', location: 'Elm St' } });
    expect(button('More options').getAttribute('aria-expanded')).toBe('true');
    expect((screen.getByLabelText('Where') as HTMLInputElement).value).toBe('Elm St');
  });

  it('editing one occurrence: no repeat, reminder or checklist to change', async () => {
    await setup({ mode: 'edit', occurrenceOnly: true, initial: { ...newDraft({ slot: 'morning' }, TODAY, gabriel.id), title: 'Swim', repeat: 'weekly' } });
    expect(screen.getByRole('heading', { name: 'Edit event' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Repeat' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Reminder' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Add to checklist' })).toBeNull();
    expect(screen.getByLabelText('Notes')).toBeTruthy();
  });
});
