import { AiPermission, AiPermissions, DEFAULT_AI_PERMISSIONS } from '@cocon/schemas';
import type { Db } from './client';

/**
 * Spec 024 FR-002: what the signed-in member's AI assistants may do. Their own row (RLS returns no
 * one else's), or all Allowed when they've never changed anything. OC-Connect shows them (025).
 */
export async function loadAiPermissions(client: Pick<Db, 'from'>): Promise<AiPermissions> {
  const { data, error } = await client.from('ai_permissions').select('recipes_edit, groceries, events, recipes_delete').maybeSingle();
  if (error) throw error;
  return data ? AiPermissions.parse(data) : DEFAULT_AI_PERMISSIONS;
}

/** Sets one permission for the member's assistants (upsert: the first change makes the row; the database sets whose). */
export async function setAiPermission(client: Pick<Db, 'from'>, familyId: string, userId: string, permission: AiPermission, allowed: boolean): Promise<{ error: unknown }> {
  const key = AiPermission.safeParse(permission);
  if (!key.success) return { error: key.error };
  const change: Partial<AiPermissions> = { [key.data]: allowed };
  const { error } = await client.from('ai_permissions').upsert({ ...change, family_id: familyId, user_id: userId }, { onConflict: 'user_id' });
  return { error };
}
