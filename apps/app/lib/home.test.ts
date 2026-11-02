// Spec 028: what Home's calendar card shows (US1, US2, FR-002–FR-004), the greeting (FR-007)
// and the hero's "N to buy" (US3).
import { describe, expect, it } from 'vitest';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { gabriel, groceryItem, james, mia, storedEvent } from '../test/fakes';
import { memberLook } from './calendar-month';
import { cardWindow, firstName, greeting, homeDate, layoutCalendarCard, recipeToBuy, type CardContext } from './home';

const eva = { ...mia, id: 'm-eva', display_name: 'Eva', color: 'rose' as const };
const members = [gabriel, eva, james];
/** A Sunday. */
const TODAY = '2026-10-25';
const ctx: CardContext = { today: TODAY, now: '12:30', look: memberLook(members), slotTimes: DEFAULT_SLOT_TIMES, members, me: gabriel };

const ev = (fields: Partial<StoredEvent>) => storedEvent({ starts_on: TODAY, ends_on: TODAY, ...fields });

const birthday = (title: string, date: string, member = eva.id) =>
  ev({ title, category: 'birthday', starts_on: date, ends_on: date, time_type: 'all_day', slots: [], recurrence: { freq: 'yearly', ends: { type: 'never' } }, members: [member] });

describe('greeting (FR-007)', () => {
  it.each([
    ['04:59', 'Good evening Gabriel'],
    ['05:00', 'Good morning Gabriel'],
    ['11:59', 'Good morning Gabriel'],
    ['12:00', 'Hi Gabriel'],
    ['17:59', 'Hi Gabriel'],
    ['18:00', 'Good evening Gabriel'],
  ])('at %s says "%s"', (now, text) => expect(greeting(now, 'Gabriel')).toBe(text));

  it('uses the first name and the long date', () => {
    expect(firstName('Gabriel Demange')).toBe('Gabriel');
    expect(homeDate(TODAY)).toBe('Sunday, Oct 25');
  });
});

describe('layoutCalendarCard', () => {
  it('US1: today’s events in time order, "Now" on the current one, a birthday within 3 days in the banner', () => {
    const events = [
      ev({ title: 'Movie night', slots: ['evening'], members: ['everyone'] }),
      ev({ title: 'Brunch at Grandma’s', slots: ['lunch'], location: 'Grandma’s house', members: ['everyone'] }),
      ev({ title: 'Baby swim class', slots: ['afternoon'], members: [james.id], responsible_member_id: gabriel.id }),
      birthday('Eva’s birthday', '2026-10-27'),
    ];
    const card = layoutCalendarCard(events, ctx);
    expect(card.state).toBe('today');
    expect(card.birthdays.map((b) => b.text)).toEqual(['Eva’s birthday is on Tuesday']);
    expect(card.today.map((e) => [e.title, e.sub, e.tag?.label ?? null])).toEqual([
      ['Brunch at Grandma’s', 'Lunch · Grandma’s house', 'Now'],
      ['Baby swim class', 'Afternoon · Gabriel takes James', null],
      ['Movie night', 'Evening', null],
    ]);
    expect(card.addDate.today).toBe(TODAY);
  });

  it('FR-004: birthdays from 3 days ahead only, and say today or tomorrow', () => {
    const card = layoutCalendarCard([ev({ title: 'Run' }), birthday('Eva’s birthday', TODAY), birthday('James’s birthday', '2026-10-26', james.id), birthday('Mum’s birthday', '2026-10-29')], ctx);
    expect(card.birthdays.map((b) => b.text)).toEqual(['Eva’s birthday is today', 'James’s birthday is tomorrow']);
    // In the banner, not the rows.
    expect(card.today.map((e) => e.title)).toEqual(['Run']);
  });

  it('FR-003: reminders due today come first with a bell, only for whom they show', () => {
    const events = [
      ev({ title: 'Run', slots: ['early_morning'] }),
      ev({ title: 'Dentist', slots: ['afternoon'], reminder: 'hour_before' }),
      ev({ title: 'Pediatrician', starts_on: '2026-10-26', ends_on: '2026-10-26', time_type: 'custom', slots: [], start_time: '10:00', end_time: '11:00', reminder: 'day_before' }),
      // Eva's alone: her reminder, not Gabriel's.
      ev({ title: 'Yoga', slots: ['evening'], members: [eva.id], reminder: 'morning_of' }),
    ];
    const card = layoutCalendarCard(events, ctx);
    expect(card.today.map((e) => [e.title, e.sub, e.bell ?? false])).toEqual([
      ['Dentist', 'Afternoon', true],
      ['Pediatrician', 'Tomorrow · 10:00', true],
      ['Run', 'Early morning', false],
      ['Yoga', 'Evening', false],
    ]);
    expect(card.today[0]?.label).toBe('Reminder, Dentist, Afternoon');
  });

  it('US2.1: nothing today gives This week: a 7-day strip, five rows and how many more', () => {
    const on = (date: string, title: string, fields: Partial<StoredEvent> = {}) => ev({ title, starts_on: date, ends_on: date, ...fields });
    const events = [
      on('2026-10-26', 'Morning run', { time_type: 'custom', slots: [], start_time: '06:30', end_time: '07:00' }),
      birthday('Eva’s birthday', '2026-10-27'),
      on('2026-10-27', 'Yoga', { slots: ['evening'], members: [eva.id] }),
      ev({ title: 'Lyon trip', starts_on: '2026-10-28', ends_on: '2026-10-30', time_type: 'all_day', slots: [], members: [eva.id] }),
      on('2026-10-28', 'Pediatrician', { time_type: 'custom', slots: [], start_time: '10:00', end_time: '11:00', members: [james.id] }),
      on('2026-10-31', 'Market', { members: ['everyone'] }),
      on('2026-10-31', 'Football', { slots: ['afternoon'] }),
    ];
    const card = layoutCalendarCard(events, ctx);
    expect(card.state).toBe('week');
    // Grouped by day, the day once; "title · when · person"; Lyon trip once, on its first day.
    expect(card.week.map((g) => [g.day, g.events.map((e) => `${e.title} · ${e.detail}`)])).toEqual([
      ['Mon', ['Morning run · 06:30 · Gabriel']],
      ['Tue', ['Eva’s birthday · All day · Eva', 'Yoga · Evening · Eva']],
      ['Wed', ['Lyon trip · Wed–Fri · Eva', 'Pediatrician · 10:00 · James']],
    ]);
    expect(card.week[1]?.events[1]?.label).toBe('Tue, Yoga, Evening · Eva');
    expect(card.more).toBe(2);
    expect(card.strip.map((d) => d.letter).join('')).toBe('SMTWTFS');
    expect(card.strip[0]).toMatchObject({ today: true, dots: [], label: 'Today, October 25, nothing planned' });
    expect(card.strip[3]).toMatchObject({ dots: ['rose', 'mint'], label: 'October 28, 2 people busy' });
    // FR-002: "+" opens the next free day: today has nothing.
    expect(card.addDate.week).toBe(TODAY);
  });

  it('FR-008: each strip day in the Today layout, with its header, empty text and "+" label', () => {
    const events = [
      ev({ title: 'Lyon trip', starts_on: '2026-10-28', ends_on: '2026-10-30', time_type: 'all_day', slots: [], members: [eva.id] }),
      ev({ title: 'Pediatrician', starts_on: '2026-10-28', ends_on: '2026-10-28', time_type: 'custom', slots: [], start_time: '10:00', end_time: '11:00', members: [james.id] }),
    ];
    const card = layoutCalendarCard(events, ctx);
    expect(card.days.map((d) => d.date)).toEqual(card.strip.map((d) => d.date));
    expect(card.days[0]).toMatchObject({ title: 'Today, Sunday, Oct. 25', items: [], empty: 'Nothing planned on Sunday.' });
    const wed = card.days[3];
    expect(wed).toMatchObject({ title: 'Wednesday, Oct. 28', addLabel: 'Add event on Wednesday' });
    expect(wed?.items.map((e) => e.title)).toEqual(['Lyon trip', 'Pediatrician']);
    // A multi-day event is on each of its days.
    expect(card.days[4]?.items.map((e) => [e.title, e.tag?.label])).toEqual([['Lyon trip', 'Day 2 of 3']]);
  });

  it('FR-002: the next free day when today is taken', () => {
    const card = layoutCalendarCard([ev({}), ev({ starts_on: '2026-10-26', ends_on: '2026-10-26' })], ctx);
    expect(card.addDate.week).toBe('2026-10-27');
  });

  it('US2.2: nothing in the next 7 days is the empty state', () => {
    expect(layoutCalendarCard([ev({ starts_on: '2026-11-01', ends_on: '2026-11-01' })], ctx).state).toBe('empty');
    expect(cardWindow(TODAY)).toEqual({ from: TODAY, to: '2026-10-31' });
  });

  it('someone else’s private event is "Busy" in their color, with no reminder', () => {
    const card = layoutCalendarCard([ev({ title: 'Therapy', visibility: 'private', creator_member_id: eva.id, members: [eva.id, gabriel.id], reminder: 'morning_of' })], ctx);
    expect(card.today.map((e) => [e.title, e.colors[0], e.bell ?? false])).toEqual([['Busy', 'rose', false]]);
  });
});

describe('layoutCalendarCard › surprises', () => {
  it('the person a surprise is hidden from sees only its cover: no banner, bell or tag, and never the real title', () => {
    const surprise = ev({
      title: 'Gabriel’s surprise party',
      category: 'birthday',
      time_type: 'all_day',
      slots: [],
      recurrence: { freq: 'yearly', ends: { type: 'never' } },
      reminder: 'morning_of',
      members: [eva.id, gabriel.id],
      visibility: 'surprise',
      creator_member_id: eva.id,
      surprise: { hidden_from: [gabriel.id], cover_title: 'Dinner with Eva', cover_note: null },
    });
    const card = layoutCalendarCard([surprise], ctx);
    expect(card.birthdays).toEqual([]);
    expect(card.today.map((e) => [e.title, e.bell ?? false, e.tag])).toEqual([['Dinner with Eva', false, null]]);
    expect(card.week.flatMap((g) => g.events.map((e) => e.title))).toEqual(['Dinner with Eva']);
    expect(JSON.stringify(card)).not.toContain('surprise party');
  });
});

describe('recipeToBuy (US3)', () => {
  it('counts the ingredients not on the list, matched by catalog key or name', () => {
    const ingredients = [
      { name: 'Leeks', catalog_key: 'leek' },
      { name: 'Onion', catalog_key: 'onion' },
      { name: 'Gruyère', catalog_key: null },
      { name: 'Smoked salt', catalog_key: null },
    ];
    const list = [groceryItem({ name: 'Leek', catalog_key: 'leek' }), groceryItem({ id: 'i2', name: 'gruyère', catalog_key: null, checked: true })];
    expect(recipeToBuy(ingredients, list)).toBe(2);
  });
});
