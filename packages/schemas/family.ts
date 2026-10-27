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
export const SignInMethod = z.enum(['email', 'google']);

export type MemberRole = z.infer<typeof MemberRole>;
export type SignInMethod = z.infer<typeof SignInMethod>;

/** What invite_status returns. `member_name`: the link is for that member without the app (spec 033 FR-006). */
export const InviteStatus = z.discriminatedUnion('status', [
  z.object({ status: z.literal('valid'), family_name: z.string(), inviter_name: z.string(), member_name: z.string().optional() }),
  z.object({ status: z.literal('expired') }),
]);
export type InviteStatus = z.infer<typeof InviteStatus>;

/** What accept_invite returns; `days_since_added` when the account was linked to a member without the app. */
export const InviteAccepted = z.object({ days_since_sent: z.int().min(0), days_since_added: z.int().min(0).optional() });
export type InviteAccepted = z.infer<typeof InviteAccepted>;

/**
 * Spec 033 FR-004: the member palette, in the order new members get it (the database's
 * `member_color`, tokens `member-*`).
 */
export const MEMBER_COLORS = ['honey', 'rose', 'sky', 'mint', 'lilac', 'peach', 'pistachio', 'clay'] as const;
export const MemberColor = z.enum(MEMBER_COLORS);
export type MemberColor = z.infer<typeof MemberColor>;

/** The first color nobody has; past 8 members the palette repeats (mirrors `_next_color`). */
export function nextMemberColor(taken: readonly MemberColor[]): MemberColor {
  return MEMBER_COLORS.find((c) => !taken.includes(c)) ?? MEMBER_COLORS[taken.length % MEMBER_COLORS.length] ?? 'honey';
}

/** Spec 033 FR-001: account members signed in; managed members have no account. */
export type MemberKind = 'account' | 'managed';
export function memberKind(member: { user_id: string | null }): MemberKind {
  return member.user_id === null ? 'managed' : 'account';
}

/**
 * Initials by member id, for avatars and chips. In join order, the first member with a letter
 * keeps one letter; later ones with the same letter show two ("Ev", "El").
 */
export function memberInitials(members: readonly { id: string; display_name: string; joined_at: string }[]): Map<string, string> {
  const seen = new Set<string>();
  const out = new Map<string, string>();
  for (const m of [...members].sort((a, b) => a.joined_at.localeCompare(b.joined_at))) {
    const letters = Array.from(m.display_name.trim());
    const first = (letters[0] ?? '?').toUpperCase();
    out.set(m.id, seen.has(first) && letters.length > 1 ? first + (letters[1] ?? '').toLowerCase() : first);
    seen.add(first);
  }
  return out;
}

/**
 * Spec 033 FR-005: who an event can be for besides members. Not rows: every family has both.
 * Everyone reads "All"; Others (people outside the family) shows a person icon.
 */
export const WHO_EVERYONE = { key: 'everyone', color: 'everyone' } as const;
export const WHO_OTHERS = { key: 'others', color: 'others' } as const;

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
  'not_managed',
  'color_taken',
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
