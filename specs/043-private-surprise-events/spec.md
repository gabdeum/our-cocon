# Feature Specification: Private and surprise events

**Feature Branch**: `043-private-surprise-events` · **Status**: Ready · **Depends on**: 035, 041, 042
**Input**: Let members keep an event's details private, or plan a surprise that is hidden from one person.
**Design**: canvas `OC-CalAddMore` (Who can see it), `OC-CalBusy`, `OC-CalSurprise`; components SegmentedControl, MemberChip, TextField, BottomSheet.

## User Scenarios & Testing

### User Story 1 — Private (P1)
**Given** Eva sets "Who can see it" to Private, **Then** others see a "Busy" chip in Eva's color; tapping it opens a sheet "Eva is busy · Thursday, Oct 22 · Afternoon" with "Eva keeps the details of this one private." and "OK".

### User Story 2 — Surprise (P1)
**Given** Gabriel plans Eva's surprise dinner with "Keep it secret from: Eva", "What Eva sees: Dinner out", "Note for Eva: Meet at Café Lalo at 19:30. Dress nice!", **Then** Eva sees an event "Dinner out" with the time, place and a sage "Note from Gabriel" card, and everyone else sees the real event tagged "Surprise".

## Requirements

- **FR-001**: "Who can see it" segmented control: Family (default, hint "Everyone in the family sees all the details."), Private ("Others see “Busy” at this time, and nothing else."), Surprise ("Hide it from someone: they see only what you choose below.").
- **FR-002 Surprise fields**: "Keep it secret from" (account members), "What {name} sees" (cover title, required), "Note for {name}" (optional), summary "{Name} sees only this title, the time, the place and this note. Everyone else sees everything."
- **FR-003**: Enforcement is in the database view and `viewFor` (spec 035 FR-002, spec 034 FR-009), including Home, notifications later, share links (not offered) and MCP: an assistant acting for Eva only gets the cover.
- **FR-004**: Private and surprise events still count for conflicts and busy chips, under the creator's (private) or the cover's (surprise) title.
- **FR-005**: Only the creator can change visibility; members hidden from a surprise can't edit or delete it (they don't know it exists).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `event_visibility_set` | visibility (family/private/surprise) |

## Warnings and errors
Cover title empty: "Add what {name} will see."

## Needs your attention
Your brief listed private events as an open question; you chose "private and surprise". A kids role is not part of V1 (decision 9: everyone can edit).

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
