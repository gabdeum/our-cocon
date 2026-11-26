# Feature Specification: Share the grocery list by link

**Feature Branch**: `072-share-grocery-list` · **Status**: Ready · **Depends on**: 019, 020, 021, 022
**Input**: Hand the live grocery list to someone outside the family (a babysitter, a friend doing the shopping) for a while. They open a link, with no app and no account, see the list as it changes, and can add, tick and remove items. Or just copy the list as text.
**Design**: not drawn; `design/ui/OC-ShareGroceries.md` (sheet) and `design/ui/OC-SharedGroceries.md` (public page) are the reference. Components: BottomSheet, Callout, Pill, LinkField, ShareTile, SettingRow, Button, Link, Dialog, PublicScreen, ListGroup, ListRow, TextField, IconButton, Toast.

## User Scenarios & Testing

### User Story 1 — Send the list for today (P1)
**Given** Groceries › share icon, **When** I keep "Today" and "Let people edit it" on and tap "Create link", **Then** a link `/g/<token>` is made, copied with "Copy link" or sent with Message, Email or More, and the sheet says "Ends today at 23:59".

### User Story 2 — The friend shops with it (P1)
**Given** the link, signed out and without the app, **Then** the friend sees the list by aisle with the family's amounts, as it changes. They can add "2 onions", tick and untick rows, and remove a row with "Undo" in the toast. The family's tab shows their changes at once, and the row reads "Added via the shared link".

### User Story 3 — View only (P2)
**Given** "Let people edit it" off, **Then** the page shows the live list with no add field, no ticking and no row menu, and the tag reads "View only". Turning it back on lets them edit again without a new link.

### User Story 4 — It ends (P1)
**Given** the time has passed, or "Stop sharing this link", **Then** the page reads "This list is no longer shared." at its next read or write, including when it's already open.

### User Story 5 — Copy as text (P2)
**Given** the sheet, **When** I tap "Copy as text", with or without a link, **Then** the items still to buy are copied as plain text by aisle with their amounts, and a toast says "List copied". This copy doesn't change when the list does.

### Edge cases
- Sharing again after stopping, or after the time ended, makes a new link. The old one never works again.
- Changing "How long" on a live link moves its end, counted from now. "Until I stop" removes the end.
- Two members creating a link at once get the same link (one active link per family).
- A guest's undo brings back only what they removed through this link, within a day.
- A guest can't touch recipe cards, servings, Edit, Move to…, store sizes, Clear done or Clear all.
- The list is empty: the page shows "The list is empty." and, with editing on, the add field.

## Requirements

- **FR-001**: One active link per family, as a 256-bit token made by the database (`/g/<token>`), with an optional end (`expires_at`) and "Let people edit it" (`can_edit`, on by default). Stopping is one-way and records who and through what (spec 019). Members can't delete links.
- **FR-002**: "How long": 1 hour · Today (until 23:59 on the device's clock) · This week (until 23:59 on Sunday) · Until I stop. Today is selected by default. The database refuses an end in the past or more than 8 days away.
- **FR-003**: The public page reads and writes only through the `shared-groceries` endpoint (service role), which resolves the token every time: unknown, stopped or ended reads "no longer shared"; a write without `can_edit` is refused. It returns the list's items (name, amount, aisle, ticked, recipe detail), the family's store and unit settings and the packs of the listed catalog entries, the family name and the link's end. It never returns who added or ticked anything, recipe names, members or ids other than the items'.
- **FR-004**: Guests add with the app's quick-add reading (`parseGroceryLine`) and the catalog matcher. Their items are new rows (`source = 'link'`), shown combined with the same thing already listed, like any other (spec 022). At most 60 adds per link per hour and 300 items on the list.
- **FR-005**: Guests tick, untick and remove (cleared, kept a day) only the family's current items. Restore only brings back what this link cleared, within a day.
- **FR-006**: The page updates live: each change to the list or the link sends a content-free message on the public topic `grocery-share:<token>`, and the page refetches. It also refetches every 15 s while visible.
- **FR-007**: "Copy as text" copies the items still to buy, by aisle in the list's order, each row "{name}: {amount}" as the list shows it (`groceryListText`, one rule for the app). Ticked items are left out.
- **FR-008**: The page is `noindex`. Like `/r/` and `/e/`, the link opens in the iPhone app when it's installed (spec 054).

## Success Criteria
- **SC-001**: A security test confirms the endpoint returns only the allowed keys, can't read or change another family's items, refuses writes after the link stops, ends, or loses `can_edit`, and can't restore what it didn't clear.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `grocery_share_created` | duration (`1h`, `today`, `week`, `none`), can_edit |
| `grocery_share_changed` | duration?, can_edit? |
| `grocery_share_stopped` | hours_active |
| `grocery_list_copied` | — |
| `shared_groceries_viewed` | anonymous, no person id |
| `shared_grocery_added` | anonymous |
| `shared_grocery_ticked` | anonymous |
| `shared_grocery_removed` | anonymous |

## Warnings and errors
All copy is in the States tables of OC-ShareGroceries and OC-SharedGroceries, and in `strings/en.ts`.

## Needs your attention
- Rate limits beyond FR-004's caps are still the Cloudflare rule (032-later L2).
- Check the live updates on staging once deployed: open a link in a private window and add an item from the app.
- **Guest changes aren't in the activity log.** The log (spec 026) records members and assistants. A guest's add reads "Added via the shared link" on the row, and its ticks and removals keep no author (`updated_by` null), but none of them makes an activity entry. Say if you want them there.
- **The token is in the read's query string** (`GET ?token=`), as for recipes and events, so it can appear in the gateway's logs. Moving reads to a POST would keep it out.

## Changelog
- 2026-11-26: Ready. Written with Gabriel: link times 1 hour, Today (default), This week, Until I stop; guests add, tick and remove with Undo, everything else stays with the family.
- 2026-11-26: Built.
  - **Database**: table `grocery_share_links` (one live link per family; token made by the database; ends within 8 days or never; stopping is one-way and recorded; members can't delete links). A link whose time is up is stopped when a member creates the next one. The endpoint's functions (`shared_groceries`, `shared_grocery_add/check/clear/restore`, service role only) check the link on every call.
  - **Guest rows**: `grocery_items` gains `share_link_id` (added through a link: FR-004's cap counts them) and `deleted_share_link_id` (FR-005: Undo restores only those). Members' writes can't set either.
  - **Packs**: the family's packs are now `_ingredient_packs(fam)`, like `_ingredient_facts`, so the shared list reads the same packs as the family's view (the view keeps its columns and grants).
  - **Live updates**: a trigger pings the public topic `grocery-share:<token>` with `{table}` only, on every list change and on any change to the link. The page also refetches every 15 s.
  - **Endpoint**: Edge Function `shared-groceries` (GET reads, POST writes). Caddy lets it through, and nginx marks `/g/*` noindex and no-store. Server scripts are at version 12: run `infra/bootstrap-from-laptop.sh` before deploying.
  - Deviations:
    - A guest's add is always a new row, shown combined with the same thing already listed (spec 022's combined row), so no merge rule is written twice. The guest sees no "Already on the list" toast.
    - The public page has no pinned bar, so its add field sits under the title.
    - Each row has a ✕ that removes it at once (with Undo) instead of a ⋮ menu with one action.
    - "Ends at 15:40" isn't used: an end today reads "today at 15:40".
    - Times follow the member's clock setting on the sheet and the device's on the public page.
  - After the security review:
    - Guest ticks, removals and restores leave `updated_by` empty rather than naming the last member.
    - The ping is sent once per statement, not per row, and the page groups pings within a second into one refetch.
    - The add cap holds under parallel requests (a lock per link).
    - Guest writes are checked with a shared schema (`SharedGroceryWrite`) on the page.
    - The token helper's grants are revoked explicitly, with tests.
