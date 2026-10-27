import { z } from 'zod';
import { StoreProfile } from './catalog';

/**
 * Spec 003 inputs. The database checks the same limits (supabase/migrations, accounts_family);
 * these give the forms an answer before anything is sent.
 */
export const DisplayName = z.string().trim().min(1).max(40);
export const FamilyName = z.string().trim().min(1).max(60);
export const Email = z.string().trim().toLowerCase().pipe(z.email());
/** 32 random bytes, base64url without padding (create_invite). */
export const InviteToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const MemberRole = z.enum(['owner', 'editor']);
export const AvatarTone = z.enum(['honey', 'sage', 'peach']);
export const SignInMethod = z.enum(['email', 'google']);

export type MemberRole = z.infer<typeof MemberRole>;
export type AvatarTone = z.infer<typeof AvatarTone>;
export type SignInMethod = z.infer<typeof SignInMethod>;

/** What invite_status returns. */
export const InviteStatus = z.discriminatedUnion('status', [
  z.object({ status: z.literal('valid'), family_name: z.string(), inviter_name: z.string() }),
  z.object({ status: z.literal('expired') }),
]);
export type InviteStatus = z.infer<typeof InviteStatus>;

/** Error codes raised by the family functions, as the app maps them to copy. */
export const FamilyError = z.enum([
  'not_signed_in',
  'not_in_family',
  'not_owner',
  'already_in_family',
  'already_in_this_family',
  'own_family_has_members',
  'invite_expired',
  'rate_limited',
  'cannot_remove_self',
  'not_a_member',
  'owner_must_delete_family',
]);
export type FamilyError = z.infer<typeof FamilyError>;

export function familyErrorOf(error: { message?: string } | null | undefined): FamilyError | null {
  const parsed = FamilyError.safeParse(error?.message);
  return parsed.success ? parsed.data : null;
}

/** Spec 027: units, for the family and a recipe (the database's `unit_system`). */
export const UnitSystem = z.enum(['metric', 'imperial']);
export type UnitSystem = z.infer<typeof UnitSystem>;

/** Spec 027: the cooking settings a family sets once and a recipe can change for itself. */
export const CookingSetting = z.enum(['keep_awake', 'has_scale', 'has_thermometer', 'units']);
export type CookingSetting = z.infer<typeof CookingSetting>;

/**
 * Spec 021: the family's settings (one `family_settings` row): where it shops (021) and its cooking
 * defaults (027). No row means these defaults.
 */
export const FamilySettings = z.object({
  store_profile: StoreProfile,
  round_to_packs: z.boolean(),
  keep_awake: z.boolean(),
  has_scale: z.boolean(),
  has_thermometer: z.boolean(),
  units: UnitSystem,
});
export type FamilySettings = z.infer<typeof FamilySettings>;
export const DEFAULT_FAMILY_SETTINGS: FamilySettings = {
  store_profile: 'us',
  round_to_packs: true,
  keep_awake: true,
  has_scale: true,
  has_thermometer: true,
  units: 'metric',
};
/** What a change sends: one setting or more. */
export const FamilySettingsUpdate = FamilySettings.partial().strict();
export type FamilySettingsUpdate = z.infer<typeof FamilySettingsUpdate>;

/** Spec 027: a recipe's own cooking settings (columns on `recipes`); null means the family's default. */
export const RecipeOverrides = z.object({
  keep_awake: z.boolean().nullable(),
  has_scale: z.boolean().nullable(),
  has_thermometer: z.boolean().nullable(),
  units: UnitSystem.nullable(),
});
export type RecipeOverrides = z.infer<typeof RecipeOverrides>;
export const NO_RECIPE_OVERRIDES: RecipeOverrides = { keep_awake: null, has_scale: null, has_thermometer: null, units: null };
/** What a change sends: one setting or more; null resets it. */
export const RecipeOverridesUpdate = RecipeOverrides.partial().strict();
export type RecipeOverridesUpdate = z.infer<typeof RecipeOverridesUpdate>;

/** What's in force for a recipe (spec 027 FR-001): its own setting, else the family's. */
export interface CookingSettings {
  keepAwake: boolean;
  scale: boolean;
  thermometer: boolean;
  system: UnitSystem;
}

export function resolveCooking(family: Pick<FamilySettings, CookingSetting>, recipe: Partial<RecipeOverrides> = {}): CookingSettings {
  return {
    keepAwake: recipe.keep_awake ?? family.keep_awake,
    scale: recipe.has_scale ?? family.has_scale,
    thermometer: recipe.has_thermometer ?? family.has_thermometer,
    system: recipe.units ?? family.units,
  };
}

/**
 * Spec 024: what a member's AI assistants may do (FR-002), each Allowed (true) or Not allowed. One
 * `ai_permissions` row per member; no row means all Allowed. Keys match the database's `ai_allowed`.
 */
export const AiPermission = z.enum(['recipes_edit', 'groceries', 'recipes_delete']);
export type AiPermission = z.infer<typeof AiPermission>;
export const AiPermissions = z.object({ recipes_edit: z.boolean(), groceries: z.boolean(), recipes_delete: z.boolean() });
export type AiPermissions = z.infer<typeof AiPermissions>;
export const DEFAULT_AI_PERMISSIONS: AiPermissions = { recipes_edit: true, groceries: true, recipes_delete: true };
