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
