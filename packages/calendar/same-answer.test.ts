import { readFileSync } from 'node:fs';
import { Recurrence } from '@cocon/schemas/calendar';
import { describe, expect, it } from 'vitest';
import { EVA, GABRIEL, JAMES, event } from './event.fixture';
import { calendarWordsEn, expand, rangeLabel, timeLabel, viewFor } from './index';

describe('US1: the same answer everywhere', () => {
  // "Football every Saturday morning", as an AI assistant would store it through MCP (spec 044).
  const recurrence = Recurrence.parse(JSON.parse('{"freq":"weekly","weekdays":[6],"ends":{"type":"never"}}'));
  const football = event({ starts_on: '2026-10-03', ends_on: '2026-10-03', recurrence, members: [JAMES], creator_member_id: EVA });

  // The app's calendar, the Home card and `list_events` all call the same functions.
  const show = (viewer: string) =>
    expand(football, '2026-10-01', '2026-11-30')
      .map((o) => viewFor(o, viewer))
      .map((o) => `${o.starts_on} ${timeLabel(o, { use24h: true })} ${rangeLabel(o, { use24h: true })} ${o.title}`);

  it('lists every Saturday morning in October and November', () => {
    expect(show(GABRIEL)).toEqual(
      ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28'].map(
        (day) => `${day} Morning 09:00–12:00 Football`,
      ),
    );
  });

  it('gives every caller the same result', () => {
    expect(show(GABRIEL)).toEqual(show(GABRIEL));
    expect(show(JAMES)).toEqual(show(GABRIEL));
  });

  it('has no React, so the MCP server can use it', () => {
    const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as Record<string, Record<string, string> | undefined>;
    const deps = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies });
    expect(deps.filter((d) => d.includes('react'))).toEqual([]);
    expect(calendarWordsEn.slots.evening).toBe('Evening');
  });
});
