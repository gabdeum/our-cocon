// Spec 041: the add sheet. US1 three taps, US2 details, US3 the soft conflict, Save with no title,
// a failed save, and the edit of one occurrence. Spec 043: who can see it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { storedEvent } from '@cocon/data';
import { draftFromEvent, newDraft, toastText } from '../../lib/event-form';
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
  view: 'full',
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

  // The longest walk through the sheet: slow under a full test run's load.
  it('US2: Gabriel + James, weekly on Saturday, a place, Gabriel takes James', { timeout: 15_000 }, async () => {
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

  it('Starts and Ends always show: empty all day, a slot’s hours, then whatever is typed', async () => {
    const props = await setup({ initial: { ...newDraft({}, TODAY, gabriel.id), title: 'Swim' } });
    const starts = () => screen.getByLabelText('Starts') as HTMLInputElement;
    const ends = () => screen.getByLabelText('Ends') as HTMLInputElement;
    expect(screen.queryByRole('button', { name: /^Custom/ })).toBeNull();
    expect([starts().value, ends().value]).toEqual(['', '']);
    fireEvent.click(button('Afternoon, 14–18'));
    expect([starts().value, ends().value]).toEqual(['14:00', '18:00']);
    fireEvent.change(ends(), { target: { value: '13:00' } });
    expect(button('Afternoon, 14–18').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button('Save'));
    await flush();
    expect(screen.getByText('Pick an end time after the start.')).toBeTruthy();
    expect(props.onSave).not.toHaveBeenCalled();
    fireEvent.change(ends(), { target: { value: '16:30' } });
    fireEvent.click(button('Save'));
    await flush();
    expect(saved(props)).toMatchObject({ time_type: 'custom', start_time: '14:00', end_time: '16:30', slots: [] });
  });

  it('Who can be emptied, and Save then asks for someone', async () => {
    const props = await setup({ initial: { ...newDraft({}, TODAY, gabriel.id), title: 'Swim' } });
    fireEvent.click(button('Gabriel'));
    expect(button('Gabriel').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button('Save'));
    await flush();
    expect(screen.getByRole('alert').textContent).toBe('Pick at least one person.');
    expect(props.onSave).not.toHaveBeenCalled();
    fireEvent.click(button('Others'));
    fireEvent.click(button('Save'));
    await flush();
    expect(saved(props)).toMatchObject({ members: ['others'] });
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

describe('Who can see it? (spec 043)', () => {
  const open = async (over: Partial<EventSheetProps> = {}) => {
    const props = await setup(over);
    fireEvent.change(title(), { target: { value: 'Eva’s surprise dinner' } });
    fireEvent.click(button('More options'));
    return props;
  };

  it('offers Family, Private and Surprise, Family first, with a hint for each', async () => {
    await open();
    expect(screen.getByRole('heading', { name: 'Who can see it?' })).toBeTruthy();
    expect(button('Family').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Everyone in the family sees all the details.')).toBeTruthy();
    fireEvent.click(button('Private'));
    expect(screen.getByText('Others see “Busy” at this time, and nothing else.')).toBeTruthy();
    fireEvent.click(button('Surprise'));
    expect(screen.getByText('Hide it from someone: they see only what you choose below.')).toBeTruthy();
  });

  it('US1: saves a private event and says so to analytics', async () => {
    const props = await open();
    fireEvent.click(button('Private'));
    fireEvent.click(button('Save'));
    await flush();
    expect(saved(props)).toMatchObject({ visibility: 'private', surprise: null });
    expect(props.tracker.track).toHaveBeenCalledWith('event_visibility_set', { visibility: 'private' });
  });

  it('US2: keeps it secret from Eva, with what she sees and a note', async () => {
    const props = await open();
    fireEvent.click(button('Surprise'));
    expect(screen.getByText('Keep it secret from')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Keep it secret from' }).textContent).toBe('EEva');
    expect(screen.getByLabelText('What they see')).toBeTruthy();
    const secretFrom = screen.getByRole('group', { name: 'Keep it secret from' }).querySelector('button') as HTMLElement;
    fireEvent.click(secretFrom);
    fireEvent.change(screen.getByLabelText('What Eva sees'), { target: { value: 'Dinner out' } });
    fireEvent.change(screen.getByLabelText('Note for Eva'), { target: { value: 'Meet at Café Lalo at 19:30. Dress nice!' } });
    expect(screen.getByText('Eva sees only this title, the time, the place and this note. Everyone else sees everything.')).toBeTruthy();
    fireEvent.click(button('Save'));
    await flush();
    expect(saved(props)).toMatchObject({
      visibility: 'surprise',
      surprise: { hidden_from: [eva.id], cover_title: 'Dinner out', cover_note: 'Meet at Café Lalo at 19:30. Dress nice!' },
    });
    expect(props.tracker.track).toHaveBeenCalledWith('event_visibility_set', { visibility: 'surprise' });
  });

  it('a surprise needs someone to keep it from and what they see', async () => {
    const props = await open();
    fireEvent.click(button('Surprise'));
    fireEvent.click(button('Save'));
    await flush();
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual(['Pick who to keep it secret from.', 'Add what they will see.']);
    fireEvent.click(screen.getByRole('group', { name: 'Keep it secret from' }).querySelector('button') as HTMLElement);
    expect(screen.getByRole('alert').textContent).toBe('Add what Eva will see.');
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('only the creator sees it when editing (FR-005)', async () => {
    const initial = draftFromEvent(storedEvent(movieNight));
    await setup({ mode: 'edit', initial, editingId: movieNight.id, canChangeVisibility: false });
    fireEvent.click(button('More options'));
    expect(screen.getByRole('heading', { name: 'Reminder' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Who can see it?' })).toBeNull();
  });

  it('an edit that keeps who can see it sends nothing', async () => {
    const initial = { ...draftFromEvent(storedEvent(movieNight)), visibility: 'private' as const };
    const props = await setup({ mode: 'edit', initial, editingId: movieNight.id });
    fireEvent.click(button('Save'));
    await flush();
    expect(props.tracker.track).not.toHaveBeenCalledWith('event_visibility_set', expect.anything());
  });
});
