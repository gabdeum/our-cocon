import type { Module } from '../../src/tools.js';
import { findFreeSlots, getDay, listEvents, listMembers } from './read.js';
import { createEvent, deleteEventTool, updateEvent } from './write.js';

/** Spec 044: the family calendar, with the same rules as the app (@cocon/calendar). */
export const calendar: Module = {
  name: 'calendar',
  instructions:
    'Calendar: the family shares one calendar. Call list_members first: it gives everyone’s name and id, who has the app, and today’s date in the family’s time zone. Days are split into slots (early morning, morning, lunch, afternoon, evening): use slots unless the member gave a time. Save events without asking for details you can estimate (the time of day, an end time, the type): say what you estimated and give the link, so the member corrects it in the app. get_day answers "what’s on Tuesday?", list_events covers a range, find_free_slots finds when people are free. create_event, update_event and delete_event change it; for a repeating event, ask whether the change is for that date only or from then on. Members without the app are taken by someone with it: the member you’re talking to, unless they named someone else. "Busy" is someone’s private event: never guess what it is. When an event is kept secret from someone (kept_secret_from), never mention it to them. Everything you change shows in the app as done by the member via you, and they can undo it.',
  tools: [listMembers, listEvents, getDay, findFreeSlots, createEvent, updateEvent, deleteEventTool],
};
