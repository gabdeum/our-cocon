import { z } from 'zod';
import { loadReminderSection, type PlacedReminder } from '@cocon/data';
import { ReminderSection } from '@cocon/schemas';
import { defineTool, ToolError } from '../../src/tools.js';
import { loadCalendar } from '../calendar/shared.js';
import { assigneeRef, shownReminder } from './shared.js';

/** Without a section: every open reminder, in the Reminders screen's order. */
const ALL = ['overdue', 'today', 'tomorrow', 'later'] as const satisfies readonly ReminderSection[];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Where the next page starts: its section, then the section's own cursor ("today|…", or "later|" for its start). */
function readCursor(cursor: string, sections: readonly ReminderSection[]): { section: ReminderSection; after: string | null } {
  const bar = cursor.indexOf('|');
  const section = ReminderSection.safeParse(cursor.slice(0, bar));
  if (bar < 0 || !section.success || !sections.includes(section.data)) throw new ToolError('cursor isn’t one list_reminders gave for these filters. Start again without it.');
  return { section: section.data, after: cursor.slice(bar + 1) || null };
}

export const listReminders = defineTool({
  name: 'list_reminders',
  title: 'List reminders',
  access: 'read',
  description: [
    'The family’s open reminders (things to do and tick off), in order: overdue (oldest first), today, tomorrow, later. A snoozed one is listed on the day it’s back, with snoozed_until.',
    'Give section to keep one ("snoozed" lists every snoozed one), and assignee to keep one person’s ("everyone" keeps the ones for the whole family).',
    'Pages hold up to limit reminders; when next_cursor isn’t null, send it back as cursor (with the same filters) for the next page.',
  ].join('\n'),
  input: z.strictObject({
    section: ReminderSection.optional(),
    assignee: z.string().trim().min(1).max(80).optional().describe('A member’s name or id from list_members, or "everyone".'),
    cursor: z.string().max(200).optional().describe('next_cursor from the previous page.'),
    limit: z.int().min(1).max(MAX_LIMIT).optional().describe(`Reminders a page, at most ${MAX_LIMIT}. Default ${DEFAULT_LIMIT}.`),
  }),
  async run(args, ctx) {
    const cal = await loadCalendar(ctx);
    const assignee = args.assignee ? assigneeRef(cal, args.assignee) : null;
    const sections: readonly ReminderSection[] = args.section ? [args.section] : ALL;
    const limit = args.limit ?? DEFAULT_LIMIT;
    let { section, after } = args.cursor ? readCursor(args.cursor, sections) : { section: sections[0] as ReminderSection, after: null as string | null };
    const rows: PlacedReminder[] = [];
    let next: string | null = null;
    // Reads never write: the notifier closes what was missed, so no catch-up here.
    const page = (s: ReminderSection, cursor: string | null, n: number) =>
      loadReminderSection(ctx.db, { section: s, mine: false, tz: cal.timeZone, cursor, caughtUp: true, assignee, limit: n });
    for (let i = sections.indexOf(section); i < sections.length; i++) {
      section = sections[i] as ReminderSection;
      if (rows.length === limit) {
        // Full: the next page starts at the next section that has anything.
        if ((await page(section, null, 1)).rows.length > 0) {
          next = `${section}|`;
          break;
        }
        continue;
      }
      const got = await page(section, after, limit - rows.length);
      after = null;
      rows.push(...got.rows);
      if (got.nextCursor) {
        next = `${section}|${got.nextCursor}`;
        break;
      }
    }
    return { reminders: rows.map((r) => shownReminder(r, cal, ctx)), next_cursor: next };
  },
});
