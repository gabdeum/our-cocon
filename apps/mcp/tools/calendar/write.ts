import { z } from 'zod';
import { calendarWordsEn, conflictWho, findConflict, viewFor } from '@cocon/calendar';
import {
  changedFields,
  deleteOccurrences,
  eventOccurrence,
  firstRepeatDay,
  inputFromEvent,
  loadEvent,
  saveEvent,
  saveEventChange,
  type StoredEvent,
} from '@cocon/data';
import type { EventInput } from '@cocon/schemas/calendar';
import { defineTool, ToolError, type ToolContext } from '../../src/tools.js';
import { newEventInput, fields, patchedInput, patchFields } from './input.js';
import { cantChange, Day, dayName, EventId, eventFailure, eventLink, loadCalendar, notInCalendar, occurrences, type Calendar } from './shared.js';

const scopeWords = 'This event repeats. Ask the member whether to change only that date (scope "this") or every date from then on (scope "future"), then send date and scope.';

/** The event as the member may change it: in full, not deleted. Busy and gone say so. */
async function changeable(ctx: ToolContext, cal: Calendar, id: string): Promise<StoredEvent> {
  const event = await loadEvent(ctx.db, id);
  if (!event || event.deleted_at) throw new ToolError(notInCalendar);
  if (viewFor(event, cal.me).view !== 'full') throw new ToolError(cantChange);
  return event;
}

/** The occurrence on `date`: its series date, or the day a "this date only" change moved it to. */
async function occurrenceAt(ctx: ToolContext, event: StoredEvent, date: string): Promise<StoredEvent & { occurrence_date: string }> {
  const found = (eventOccurrence(event, date) as (StoredEvent & { occurrence_date: string }) | null) ?? (await occurrences(ctx, date, date)).find((o) => o.id === event.id) ?? null;
  if (!found) throw new ToolError(`The event isn’t on ${dayName(date)}. Use list_events to find its dates.`);
  return found;
}

/** "Moved: Movie night is on this evening too." The app's soft warning (spec 041 FR-006), never a refusal. */
async function clash(ctx: ToolContext, cal: Calendar, input: EventInput, id?: string): Promise<string | null> {
  if (input.time_type === 'all_day') return null;
  const day = (await occurrences(ctx, input.starts_on, input.ends_on)).map((o) => viewFor(o, cal.me));
  const draft = { id: id ?? null, starts_on: input.starts_on, ends_on: input.ends_on, time_type: input.time_type, slots: input.slots ?? [], start_time: input.start_time, end_time: input.end_time, members: input.members };
  const other = findConflict(draft, day, cal.slotTimes);
  if (!other) return null;
  const { who, slot } = conflictWho(draft, other, cal.me, cal.slotTimes);
  const name = who === 'me' ? 'The member' : who === 'everyone' ? 'Everyone' : (cal.members.find((m) => m.id === who)?.name ?? 'Someone');
  return `${name} already has ${other.title} that ${calendarWordsEn.slots[slot].toLowerCase()}. It was saved anyway; mention it.`;
}

export const createEvent = defineTool({
  name: 'create_event',
  title: 'Add an event',
  access: 'write',
  needs: 'events',
  description: [
    'Add an event to the family calendar, as the member would in the app: "Football every Saturday morning for James".',
    'Use slots (morning, afternoon…) unless the member gave a time. Call list_members first for names, ids and today’s date.',
    'When a member without the app (has_app false) is on it, ask who takes them unless the member said, and send responsible.',
    'It shows straight away in the app as added via you, and the family can undo it.',
  ].join('\n'),
  input: z.strictObject({ ...fields, title: fields.title, date: fields.date, members: fields.members }),
  async run(args, ctx) {
    const cal = await loadCalendar(ctx);
    const input = newEventInput(cal, args);
    // A weekly repeat starts on its first picked day (as the app's sheet saves it).
    const starts = firstRepeatDay(input.starts_on, input.recurrence);
    const saved = { ...input, starts_on: starts, ends_on: starts === input.starts_on ? input.ends_on : starts };
    const id = await saveEvent(ctx.db, saved).catch(eventFailure);
    ctx.tracker.track('event_created', {
      source: 'assistant',
      time_type: saved.time_type,
      slot: saved.slots?.[0] ?? null,
      member_count: saved.members.length,
      has_repeat: saved.recurrence != null,
      used_more_options: false,
      seconds_to_save: 0,
    });
    const event = await loadEvent(ctx.db, id);
    const heads = await clash(ctx, cal, saved, id);
    return {
      id,
      title: saved.title,
      date: saved.starts_on,
      day: dayName(saved.starts_on),
      ...(event?.recurrence ? { repeats: true } : {}),
      ...(heads ? { heads_up: heads } : {}),
      link: eventLink(ctx, id, saved.starts_on),
    };
  },
});

export const updateEvent = defineTool({
  name: 'update_event',
  title: 'Change an event',
  access: 'write',
  needs: 'events',
  description: [
    'Change an event: send only what changes in patch (null clears location, notes, type, repeat or responsible).',
    'For a repeating event, send the date being changed and scope: "this" for that date only, "future" for that date and every one after. Ask the member which if they didn’t say. How it repeats and who sees it only change with "future".',
    'Only the person who added a private or surprise event can change it.',
  ].join('\n'),
  input: z.strictObject({
    id: EventId,
    date: Day.optional().describe('The date being changed, from list_events (needed for a repeating event).'),
    scope: z.enum(['this', 'future']).optional(),
    patch: z.strictObject(patchFields).partial(),
  }),
  async run(args, ctx) {
    const cal = await loadCalendar(ctx);
    const event = await changeable(ctx, cal, args.id);
    const p = args.patch;
    if (Object.keys(p).length === 0) throw new ToolError('patch is empty. Send what changes.');
    const repeats = event.recurrence != null;
    if (repeats && (!args.scope || !args.date)) throw new ToolError(scopeWords);
    const scope = repeats ? (args.scope as 'this' | 'future') : 'all';
    if (scope === 'this' && (p.repeat !== undefined || p.visibility !== undefined || p.surprise !== undefined)) {
      throw new ToolError('How it repeats and who sees it can’t change for one date. Use scope "future".');
    }
    if ((p.visibility !== undefined || p.surprise !== undefined) && event.creator_member_id !== cal.me) {
      throw new ToolError('Only the person who added this event can change who sees it.');
    }
    // Only the creator splits a private or surprise series (split_event): others change one date.
    if (scope === 'future' && event.visibility !== 'family' && event.creator_member_id !== cal.me) {
      throw new ToolError('Only the person who added this event can change its future dates. Change one date with scope "this".');
    }
    const occurrence = repeats ? await occurrenceAt(ctx, event, args.date as string) : null;
    const date = occurrence?.occurrence_date ?? event.starts_on;
    const shown = occurrence ?? event;
    const before = inputFromEvent(shown, shown.starts_on);
    const after = patchedInput(cal, before, p);
    const done = await saveEventChange(ctx.db, { event, date, scope, familyId: ctx.familyId, before, input: after }).catch(eventFailure);
    const heads = await clash(ctx, cal, after, event.id);
    return {
      id: event.id,
      title: after.title,
      changed: changedFields(before, after),
      scope: done,
      ...(heads ? { heads_up: heads } : {}),
      link: eventLink(ctx, event.id, done === 'all' ? after.starts_on : date),
    };
  },
});

export const deleteEventTool = defineTool({
  name: 'delete_event',
  title: 'Delete an event',
  access: 'delete',
  needs: 'events',
  description: [
    'Delete an event for the whole family. For a repeating event, send the date and scope: "this" (that date only), "future" (that date and after) or "all" (the whole event). Ask the member which if they didn’t say.',
    'A whole event, or the dates from one on, stays in Recently deleted in the app for 30 days; one date is cancelled. The family can undo it either way.',
  ].join('\n'),
  input: z.strictObject({
    id: EventId,
    date: Day.optional().describe('The date being deleted, from list_events (needed for "this" and "future").'),
    scope: z.enum(['this', 'future', 'all']).optional(),
  }),
  async run(args, ctx) {
    const cal = await loadCalendar(ctx);
    const event = await changeable(ctx, cal, args.id);
    const repeats = event.recurrence != null;
    if (repeats && !args.scope) throw new ToolError(scopeWords.replace('change only that date (scope "this") or every date from then on (scope "future")', 'delete only that date (scope "this"), that date and after (scope "future"), or the whole event (scope "all")'));
    const scope = repeats ? (args.scope as 'this' | 'future' | 'all') : 'all';
    if (scope !== 'all' && !args.date) throw new ToolError('Send the date to delete, from list_events.');
    const occurrence = scope === 'all' ? null : await occurrenceAt(ctx, event, args.date as string);
    const date = occurrence?.occurrence_date ?? event.starts_on;
    const done = await deleteOccurrences(ctx.db, { event, date, scope, familyId: ctx.familyId }).catch(eventFailure);
    return {
      deleted: event.title,
      dates: done.scope === 'this' ? dayName(date) : done.scope === 'future' ? `${dayName(date)} and every date after` : 'the whole event',
      in_recently_deleted: done.scope !== 'this',
    };
  },
});
