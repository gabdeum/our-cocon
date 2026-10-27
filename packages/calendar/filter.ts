import type { EventMember } from '@cocon/schemas/calendar';

/**
 * Spec 036 FR-004, the header's member filter: an event shows while any of its members (a member
 * id, "everyone" or "others") is shown. Hiding Eva hides her events alone; one she shares with
 * James stays while James is shown.
 */
export function shownByFilter(members: readonly EventMember[], hidden: ReadonlySet<string>): boolean {
  return members.some((m) => !hidden.has(m));
}
