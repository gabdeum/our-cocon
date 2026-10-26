# Feature Specification: MCP server — groceries and permissions

**Feature Branch**: `024-mcp-groceries-permissions` · **Status**: Ready · **Depends on**: 022, 023
**Input**: Let AI assistants manage the grocery list, with simple per-member permissions. No approval step: AI deletes go to Recently deleted and can be restored for 30 days.

## User Scenarios & Testing

### User Story 1 — "Add what I need for the quiche" (P1)
**Acceptance**: **Given** Alex asks ChatGPT, **Then** the assistant first asks which ingredients they already have (or Alex says, e.g. "we have eggs and butter"), then calls `add_recipe_to_groceries` with those excluded. Spec 022's merge rules apply, and it replies with what it added.

### User Story 2 — Quick list edits (P1)
**Given** "Add milk and eggs" or "Tick off the bread", **Then** the list updates for everyone, marked "Alex via ChatGPT".

### User Story 3 — Deletes are safe without asking (P1)
**Given** "Delete the apple tart recipe" and the permission "Delete recipes: Allowed", **Then** the recipe moves to Recently deleted (spec 018), and Home's activity card shows "Alex deleted Grandma's apple tart via ChatGPT" with Restore (spec 026).

### Edge cases
- A permission set to "Not allowed" makes the tool return a polite refusal the assistant can relay, e.g. "Alex hasn't allowed assistants to delete recipes."
- A member removed from the family loses all MCP access immediately.

## Requirements

- **FR-001**: Tools: `list_groceries()`, `add_groceries(items[])`, `check_grocery(id | name)`, `remove_grocery(id)`, `clear_done_groceries()`, `add_recipe_to_groceries(recipe_id, servings?, variants?, exclude_ingredients?)`.
- **FR-002**: Permissions are per member and apply to all their connected assistants. Each action is "Allowed" or "Not allowed": create and edit recipes, change the grocery list, delete recipes. All default to Allowed.
- **FR-003**: Every AI write, including deletes and removals, is logged in the activity feed with Undo or Restore (spec 026).
- **FR-004**: Tool descriptions tell assistants to ask what the family already has before adding a recipe's ingredients.

## Success Criteria
- **SC-001**: Every AI delete can be restored from Recently deleted and the activity feed (test).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `ai_permission_changed` | permission, allowed |

## Warnings and errors
Same format as spec 023. Not allowed: "This member hasn't allowed AI to change the grocery list."

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-25: Shipped.
  - Shipped: the six grocery tools (`apps/mcp/tools/groceries`), per-member permissions (`ai_permissions`, all Allowed until changed) checked before a tool runs and again by the database on every assistant write, whatever API it uses, and the activity log for assistant grocery writes (with the item as it was, for Undo in 026). `create_recipe`/`update_recipe` need "Create & edit recipes" and `delete_recipe` needs "Delete recipes".
  - Shared with the app, unchanged: grocery reads and writes, Buy and Need, and the lines "Add to groceries" puts on the list, moved to `packages/data` (the app passes its strings for the wording).
  - Deviation: "Not allowed" is enforced by a trigger, not in the policies (032-later L58), so a delete is told apart from an edit and a refusal is an error the server can name.
  - Deviation (Warnings): the refusal adds 023's second sentence: "This member hasn't allowed AI to change the grocery list. They can change it in Settings › AI assistants." It says "This member", not the member's name (the edge case's example).
  - Deviation: `check_grocery` also unticks (`ticked: false`); `list_groceries` returns Buy and Need as the app shows them, and the recipes on the list with their servings.
  - Removing a member ends their sessions, so their assistants' tokens are refused before any tool runs.
  - Tracking: `ai_permission_changed` is defined; 025's rows send it (032-later L67). From the MCP server, as the app sends them: `grocery_item_added` (`from: 'ai'`), `grocery_item_ticked`, `done_items_cleared`, `groceries_added_from_recipe`.
  - Not built here: the "What AI can do" rows on OC-Connect (025, L67); until then a permission is changed in Supabase Studio. Restore and Undo from Home's activity card are 026's.
