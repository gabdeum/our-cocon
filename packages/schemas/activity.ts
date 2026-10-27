import { z } from 'zod';

const Name = z.string().regex(/^[a-z][a-z_]{0,39}$/);

/**
 * An activity entry (spec 026): what was done, to what, and the data to undo it. The database
 * sets the family, the person and the source.
 */
export const ActivityInput = z.strictObject({
  action: Name,
  target_kind: Name,
  target_id: z.uuid().nullish(),
  payload: z.record(z.string(), z.unknown()),
});
export type ActivityInput = z.infer<typeof ActivityInput>;

/** What an AI entry did (`_activity_kind` in the database), for its title and the undo event. */
export const ActivityKind = z.enum([
  'recipe_created',
  'recipe_edited',
  'recipe_deleted',
  'groceries_added',
  'groceries_ticked',
  'groceries_unticked',
  'groceries_removed',
  'groceries_cleared',
  'other',
]);
export type ActivityKind = z.infer<typeof ActivityKind>;
/** The kinds Undo applies to; an AI delete is Restored instead (FR-004). */
export const UndoKind = ActivityKind.exclude(['recipe_deleted']);
export type UndoKind = z.infer<typeof UndoKind>;

/** One AI tool call as Home and the activity list show it (`activity_entries`, spec 026 FR-001). */
export const ActivityEntry = z.object({
  key: z.uuid(),
  actor_id: z.uuid().nullable(),
  source: z.string(),
  kind: ActivityKind,
  created_at: z.string(),
  count: z.int().min(0),
  names: z.array(z.string()),
  recipe_id: z.uuid().nullable(),
  recipe_name: z.string().nullable(),
  undone_by: z.uuid().nullable(),
  undone_at: z.string().nullable(),
  undo_action: z.enum(['undo', 'restore']).nullable(),
  can_undo: z.boolean(),
  can_restore: z.boolean(),
});
export type ActivityEntry = z.infer<typeof ActivityEntry>;

/**
 * Rows someone changed after the AI did, grouped by who and how ("Mia ticked 2 of these items").
 * `gone`: no longer there to put back (purged, or removed since); nobody to name.
 */
export const UndoConflict = z.object({ kind: z.enum(['ticked', 'cleared', 'edited', 'gone']), by: z.uuid().nullable(), count: z.int().min(1) });
export type UndoConflict = z.infer<typeof UndoConflict>;
/**
 * What `undo_ai_change` did: nothing (`applied` false) while there are conflicts and the rest wasn't
 * asked for; `left` is then what undoing the rest would still do.
 */
export const UndoResult = z.object({
  applied: z.boolean(),
  kind: ActivityKind,
  done: z.int().min(0),
  left: z.int().min(0).optional(),
  conflicts: z.array(UndoConflict),
});
export type UndoResult = z.infer<typeof UndoResult>;
