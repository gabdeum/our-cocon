import { z } from 'zod';
import { WriteSource } from './sources';

/** Tables that send their changes live (spec 004 FR-002; the calendar's, spec 035 FR-003). */
export const LiveTable = z.enum(['recipes', 'recipe_steps', 'grocery_items', 'activity', 'events', 'event_members', 'event_exceptions', 'event_checklist_items']);
export type LiveTable = z.infer<typeof LiveTable>;

/**
 * What the database sends on a family's channel `family:<id>` after a write (`_broadcast_change`):
 * which row changed and who changed it, never its content. Clients refetch through RLS.
 */
export const ChangeEvent = z.object({
  table: LiveTable,
  op: z.enum(['insert', 'update', 'delete']),
  id: z.uuid(),
  recipe_id: z.uuid().optional(),
  by: z.uuid().optional(),
  source: WriteSource.optional(),
});
export type ChangeEvent = z.infer<typeof ChangeEvent>;

export const familyChannel = (familyId: string) => `family:${familyId}`;
