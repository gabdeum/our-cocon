/**
 * Spec 040 FR-003: the agenda keeps its place while you switch views, for this session only
 * (kept in memory, so it starts at the top again when the app restarts). One person at a time:
 * another user, or another start day, starts fresh.
 */
export interface AgendaPlace {
  /** How many 4-week pages are loaded. */
  pages: number;
  /** The list's scroll offset. */
  offset: number;
}

let current: { key: string; place: AgendaPlace } | null = null;

const keyOf = (userId: string, anchor: string) => `${userId}|${anchor}`;

export function getAgendaPlace(userId: string, anchor: string): AgendaPlace {
  return current?.key === keyOf(userId, anchor) ? current.place : { pages: 1, offset: 0 };
}

export function setAgendaPlace(userId: string, anchor: string, place: AgendaPlace) {
  current = { key: keyOf(userId, anchor), place };
}
