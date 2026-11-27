import type { Module } from '../../src/tools.js';
import { NOTES_RULE } from '../calendar/input.js';
import { listReminders } from './read.js';
import { completeReminderTool, createReminderTool, deleteReminderTool, snoozeReminderTool, updateReminderTool } from './write.js';

/** Spec 060: the family's reminders, with the same rules as the app (@cocon/reminders). */
export const reminders: Module = {
  name: 'reminders',
  instructions:
    'Reminders: things to do and tick off ("water the plants", "pay the nanny on Fridays"), shared by the family. They aren’t event alerts: an event’s reminder is part of the event. Call list_members first for names, ids and today’s date. list_reminders shows what’s overdue, today, tomorrow and later. create_reminder and update_reminder add and change one; complete_reminder ticks it off (a repeating one moves to its next date); snooze_reminder hides it until later without moving it; delete_reminder deletes it. Leave out what the member didn’t say. Everything you change shows in the app as done by the member via you, and they can undo it. ' + NOTES_RULE,
  tools: [listReminders, createReminderTool, updateReminderTool, completeReminderTool, snoozeReminderTool, deleteReminderTool],
};
