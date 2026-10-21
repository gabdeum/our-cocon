import { describe, expect, it } from 'vitest';
import {
  addedStepEvents,
  draftsFromSteps,
  editBody,
  emptyStep,
  insertToken,
  markTemperature,
  matchMentions,
  mentionAt,
  missingIn,
  readSteps,
  removeTokens,
  segmentsOf,
  shownText,
  snapSelection,
  stepBadges,
  stepsChanged,
  temperaturesIn,
  unusedIngredients,
  type StepDraft,
} from './recipe-steps';

const LEEKS = '00000000-0000-4000-8000-0000000000a1';
const BUTTER = '00000000-0000-4000-8000-0000000000a2';
const EGGS = '00000000-0000-4000-8000-0000000000a3';
const names = new Map([
  [LEEKS, 'Leeks'],
  [BUTTER, 'Butter'],
  [EGGS, 'Eggs'],
]);
const leeks = `{ing:${LEEKS}}`;
const butter = `{ing:${BUTTER}}`;

const step = (patch: Partial<StepDraft> = {}): StepDraft => ({ ...emptyStep('00000000-0000-4000-8000-0000000000b1'), ...patch });

describe('the editor text (FR-001)', () => {
  it('shows ingredients by name, temperatures in both scales, and missing ones as such', () => {
    const segments = segmentsOf(`Melt ${butter}, add ${leeks} at {temp:180} with {ing:00000000-0000-4000-8000-0000000000ff}.`, names);
    expect(shownText(segments)).toBe('Melt Butter, add Leeks at 180 °C (350 °F) with Missing ingredient.');
    expect(segments.filter((g) => g.type === 'chip').map((g) => g.type === 'chip' && g.kind)).toEqual(['ingredient', 'ingredient', 'temperature', 'missing']);
  });

  it('typing in plain text keeps the chips', () => {
    const segments = segmentsOf(`Add ${leeks}.`, names);
    expect(editBody(segments, names, 'Add Leeks finely sliced.', { start: 9, end: 9 })).toEqual({ body: `Add ${leeks} finely sliced.`, caret: 23 });
  });

  it('backspace into a chip removes the whole chip', () => {
    const segments = segmentsOf(`Add ${leeks}.`, names);
    expect(editBody(segments, names, 'Add Leek.', { start: 9, end: 9 })).toEqual({ body: 'Add .', caret: 4 });
  });

  it('forward delete into a chip removes it too', () => {
    const segments = segmentsOf(`Add ${leeks}.`, names);
    expect(editBody(segments, names, 'Add eeks.', { start: 4, end: 4 }).body).toBe('Add .');
  });

  it('a repeated letter is settled by the caret: the chip goes, not the text after it', () => {
    const segments = segmentsOf(`${leeks}s`, names);
    expect(editBody(segments, names, 'Leeks', { start: 5, end: 5 }).body).toBe('s');
    expect(editBody(segments, names, 'Leeks', { start: 6, end: 6 }).body).toBe(leeks);
  });

  it('typing inside a chip lands after it', () => {
    const segments = segmentsOf(`Add ${leeks}.`, names);
    expect(editBody(segments, names, 'Add Leexks.', { start: 7, end: 7 })).toEqual({ body: `Add ${leeks}x.`, caret: 10 });
  });

  it('replacing a selection over part of a chip replaces the chip', () => {
    const segments = segmentsOf(`Add ${leeks} now`, names);
    expect(editBody(segments, names, 'Add onions now').body).toBe('Add onions now');
  });

  it('typed braces never make a token', () => {
    expect(editBody(segmentsOf('', names), names, `{ing:${EGGS}}`).body).toBe(`ing:${EGGS}`);
  });

  it('a caret inside a chip moves to its end; a selection covers the chips it touches', () => {
    const segments = segmentsOf(`Add ${leeks} now`, names);
    expect(snapSelection(segments, { start: 6, end: 6 })).toEqual({ start: 9, end: 9 });
    expect(snapSelection(segments, { start: 2, end: 6 })).toEqual({ start: 2, end: 9 });
    expect(snapSelection(segments, { start: 4, end: 4 })).toEqual({ start: 4, end: 4 });
  });
});

describe('inserting ingredients (FR-002, US1)', () => {
  it('"+ Eggs" goes at the caret with spaces around it', () => {
    const segments = segmentsOf('Whisk then pour', names);
    expect(insertToken(segments, names, { start: 5, end: 5 }, `{ing:${EGGS}}`)).toEqual({ body: `Whisk {ing:${EGGS}} then pour`, caret: 10 });
  });

  it('no extra space before punctuation', () => {
    expect(insertToken(segmentsOf('Add.', names), names, { start: 3, end: 3 }, leeks).body).toBe(`Add ${leeks}.`);
  });

  it('a picked @ suggestion replaces "@le"', () => {
    const segments = segmentsOf('Add @le', names);
    const mention = mentionAt(shownText(segments), 7);
    expect(mention).toEqual({ start: 4, query: 'le' });
    expect(insertToken(segments, names, { start: 4, end: 7 }, leeks)).toEqual({ body: `Add ${leeks} `, caret: 10 });
  });

  it('an "@" in a word is not a mention', () => {
    expect(mentionAt('mail me@home', 12)).toBeNull();
    expect(mentionAt('@', 1)).toEqual({ start: 0, query: '' });
    expect(mentionAt('Add @bacon l', 12)).toEqual({ start: 4, query: 'bacon l' });
  });

  it('suggests names that start with the query first, accents and case aside', () => {
    const list = [
      { id: '1', name: 'Gruyère' },
      { id: '2', name: 'Bacon lardons' },
      { id: '3', name: 'Leeks' },
      { id: '4', name: 'Lemon' },
      { id: '5', name: '' },
    ];
    expect(matchMentions('le', list).map((i) => i.name)).toEqual(['Leeks', 'Lemon']);
    expect(matchMentions('gruy', list).map((i) => i.name)).toEqual(['Gruyère']);
    expect(matchMentions('lard', list).map((i) => i.name)).toEqual(['Bacon lardons']);
    expect(matchMentions('', list)).toHaveLength(4);
  });

  it('offers the ingredients no step mentions yet', () => {
    const list = [...names].map(([id, name]) => ({ id, name }));
    expect(unusedIngredients(list, [{ body: `Melt ${butter}` }, { body: `Add ${leeks}` }]).map((i) => i.name)).toEqual(['Eggs']);
  });
});

describe('missing and removed ingredients', () => {
  it('lists tokens whose ingredient is not in the list', () => {
    expect(missingIn(`Add ${leeks} and ${butter}`, new Set([LEEKS]))).toEqual([BUTTER]);
  });

  it('takes a removed ingredient out of the text, tidied like the database does', () => {
    expect(removeTokens(`Cook ${leeks} and ${butter} together.`, [BUTTER])).toBe(`Cook ${leeks} and together.`);
    expect(removeTokens(`Add ${butter}.`, [BUTTER])).toBe('Add.');
    expect(removeTokens(butter, [BUTTER])).toBe(butter);
  });
});

describe('temperatures in the text (FR-006)', () => {
  it('finds them and marks one as a thermometer reading', () => {
    const body = 'Bake at {temp:180}, sugar to {temp:115}.';
    expect(temperaturesIn(body)).toEqual([
      { token: '{temp:180}', celsius: 180, food: false },
      { token: '{temp:115}', celsius: 115, food: false },
    ]);
    const marked = markTemperature(body, '{temp:115}', true);
    expect(marked).toBe('Bake at {temp:180}, sugar to {temp:115:food}.');
    expect(markTemperature(marked, '{temp:115:food}', false)).toBe(body);
    expect(shownText(segmentsOf(marked, names))).toBe('Bake at 180 °C (350 °F), sugar to 115 °C (240 °F).');
  });
});

describe('Save (OC-EditSteps › Validation copy)', () => {
  it('reads a full step', () => {
    const read = readSteps([
      step({
        name: ' Cook the filling ',
        body: `Melt ${butter}, then bake at 180C.`,
        timerOn: true,
        minutes: '8',
        timerLabel: 'Soften the leeks',
        tempOn: true,
        tempValue: '160',
        tempScale: 'F',
        tempText: 'center reaches',
        tipOn: true,
        tip: 'Low heat.',
      }),
    ]);
    expect(read).toEqual({
      rows: [
        {
          id: '00000000-0000-4000-8000-0000000000b1',
          name: 'Cook the filling',
          body: `Melt ${butter}, then bake at {temp:180}.`,
          timer_seconds: 480,
          timer_label: 'Soften the leeks',
          temp_check_c: 71.1,
          temp_check_text: 'center reaches',
          tip: 'Low heat.',
          photo_path: null,
        },
      ],
    });
  });

  it('drops blank steps and add-ons that are switched off', () => {
    const read = readSteps([step(), step({ body: 'Rest.', tipOn: false, tip: 'kept while off', timerOn: false, minutes: '8', timerLabel: 'x' })]);
    expect(read).toEqual({
      rows: [expect.objectContaining({ name: null, body: 'Rest.', tip: null, timer_seconds: null, timer_label: null, temp_check_c: null })],
    });
  });

  it('warns about a step with no instructions, a bad timer and a bad temperature', () => {
    const a = step({ key: 'a', name: 'Bake' });
    const b = step({ key: 'b', body: 'Bake.', timerOn: true, minutes: 'soon' });
    const c = step({ key: 'c', body: 'Bake.', tempOn: true, tempValue: 'hot' });
    const d = step({ key: 'd', body: 'Bake.', timerOn: true, minutes: '' });
    expect(readSteps([a, b, c, d])).toEqual({
      warnings: { a: { body: 'bodyMissing' }, b: { timer: 'timerInvalid' }, c: { temp: 'tempInvalid' }, d: { timer: 'timerInvalid' } },
    });
  });

  it('keeps a saved timer exactly while its minutes are not edited', () => {
    const [saved] = draftsFromSteps([
      { id: 's1', position: 0, name: 'Rest', body: 'Rest.', timer_seconds: 90, timer_label: null, temp_check_c: null, temp_check_text: null, tip: null, photo_path: null },
    ]);
    expect(saved?.minutes).toBe('2 min');
    const read = readSteps(saved ? [saved] : []);
    expect('rows' in read && read.rows[0]?.timer_seconds).toBe(90);
  });

  it('knows when nothing changed', () => {
    const rows = [
      { id: 's1', position: 0, name: 'Bake', body: 'Bake.', timer_seconds: 2100, timer_label: null, temp_check_c: 71, temp_check_text: 'center reaches', tip: 'Wait.', photo_path: null },
    ];
    const start = draftsFromSteps(rows);
    expect(stepsChanged(start, draftsFromSteps(rows))).toBe(false);
    expect(stepsChanged(start, [...draftsFromSteps(rows), step()])).toBe(false);
    expect(stepsChanged(start, draftsFromSteps(rows).map((d) => ({ ...d, tipOn: false })))).toBe(true);
  });

  it('counts the steps new to the recipe, without their text', () => {
    const read = readSteps([step({ id: 'old', body: 'A.' }), step({ id: 'new', body: 'B.', timerOn: true, minutes: '12' })]);
    expect('rows' in read && addedStepEvents(read.rows, new Set(['old']))).toEqual([{ has_timer: true, has_temperature: false, has_tip: false }]);
  });

  it('badges the collapsed card', () => {
    expect(stepBadges(step({ tipOn: true, tip: 'x', timerOn: true, minutes: '12' }))).toEqual(['12 min', 'Tip']);
    expect(
      stepBadges(step({ timerOn: true, minutes: '35', tempOn: true, tempValue: '71', tipOn: true, tip: 'x', photoOn: true, photoPath: 'a/b/c.jpg' })),
    ).toEqual(['35 min', 'Temp check', 'Tip', 'Photo']);
    // Switched on but empty, or switched off: no pill.
    expect(stepBadges(step({ tempOn: true, photoOn: true, tipOn: false, tip: 'kept' }))).toEqual([]);
    expect(stepBadges(step({ timerOn: true, minutes: '90' }))).toEqual(['1 h 30']);
  });
});
