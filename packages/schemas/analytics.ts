import { z } from 'zod';
import { FilterKey } from './recipe-filters';

// The converter's units (spec 013, `@cocon/quantity` CONVERTER_UNITS), and its result tiles' units.
const converterUnits = ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'fl_oz', 'c', 'f', 'gas_mark'] as const;
const ConverterUnitEvent = z.enum(converterUnits);
/** The recipe form's sections (spec 014 FR-001), in order. */
export const RecipeFormSection = z.enum(['details', 'ingredients', 'steps', 'variants']);
export type RecipeFormSection = z.infer<typeof RecipeFormSection>;
const ConverterResultUnitEvent = z.enum([...converterUnits, 'cups_of', 'fan_c', 'fan_f']);

/**
 * The highest step count events take: a recipe's 100 steps (MAX_STEPS) plus any its variants add.
 * Senders cap what they send at this, so a longer recipe never makes `track` throw.
 */
export const MAX_TRACKED_STEPS = 200;

/**
 * Every tracked user action. Each spec's Tracking table lists its events; add them here.
 * Props are closed (`strict`) so no user content (names, emails, recipe or grocery text)
 * can slip into PostHog through an extra field.
 */
export const events = {
  app_opened: z.strictObject({
    platform: z.enum(['web', 'ios']),
    app_version: z.string().min(1),
  }),
  // Spec 002: a tab in the floating tab bar was tapped (sent only when it changes the tab).
  tab_selected: z.strictObject({
    tab: z.enum(['home', 'recipes', 'groceries', 'settings']),
  }),
  // Spec 003: accounts and family.
  signed_up: z.strictObject({ method: z.enum(['email', 'google']) }),
  signed_in: z.strictObject({ method: z.enum(['email', 'google']) }),
  family_created: z.strictObject({}),
  invite_sent: z.strictObject({}),
  invite_accepted: z.strictObject({ days_since_sent: z.int().min(0) }),
  invite_expired_seen: z.strictObject({}),
  member_removed: z.strictObject({}),
  family_deleted: z.strictObject({ member_count: z.int().min(1) }),
  // Spec 004: the offline banner appeared on a screen (once per offline spell). Later screens join the enum.
  offline_banner_shown: z.strictObject({ screen: z.enum(['home', 'recipes', 'recipe', 'recipe_form', 'groceries', 'settings']) }),
  // Spec 031: an ingredient that matched nothing in the catalog was saved. One event each, never
  // its text: the count tells us where the catalog needs to grow.
  ingredient_unmatched: z.strictObject({}),
  // Spec 031: a family saved its own correction to an ingredient (Move to…, a piece weight, packs),
  // or a custom ingredient.
  catalog_override_saved: z.strictObject({ field: z.enum(['aisle', 'piece_weight', 'packs', 'custom']) }),
  // Spec 006: a search on the recipe list settled (after the 150 ms pause). Never the query text.
  recipes_searched: z.strictObject({ query_length: z.int().min(1), result_count: z.int().min(0) }),
  // Spec 006: a recipe page was opened, and from where.
  recipe_opened: z.strictObject({ from: z.enum(['list', 'search', 'home', 'link']) }),
  // Spec 007: filters were applied ("Show N recipes" or a quick pill). Which groups, never their values.
  recipe_filters_applied: z.strictObject({
    filter_keys: z.array(FilterKey).max(4).refine((keys) => new Set(keys).size === keys.length, 'Each key once'),
    result_count: z.int().min(0),
  }),
  // Spec 008: servings on a recipe page, once the stepper settles (three quick taps are one change).
  servings_changed: z.strictObject({ from: z.int().min(1).max(50), to: z.int().min(1).max(50) }),
  // Spec 008: a version pill or option switch was tapped; how many variants are now on (0 = Classic).
  variant_selected: z.strictObject({ variant_count: z.int().min(0).max(50) }),
  // Spec 010: timers, on this device only. Never their names.
  timer_started: z.strictObject({ from: z.enum(['step', 'quick']) }),
  // ±1 from the buttons; for "Set to" (011), the change in whole minutes.
  timer_adjusted: z.strictObject({ delta_min: z.int().min(-1440).max(1440) }),
  timer_finished: z.strictObject({}),
  // Spec 009/010: a step's "Start timer"; the step's position, from 0.
  step_timer_started: z.strictObject({ step_index: z.int().min(0).max(MAX_TRACKED_STEPS - 1) }),
  // Spec 011: the TimerPill was tapped, and the Timers screen opened; how many timers exist.
  timer_pill_tapped: z.strictObject({ timer_count: z.int().min(1).max(100) }),
  timers_screen_opened: z.strictObject({ timer_count: z.int().min(0).max(100) }),
  // Spec 012: cooking mode opened, finished ("Finish" on the last step) or left with Exit.
  // `at_step` counts from 1; `minutes` from opening to Finish.
  cooking_started: z.strictObject({ step_count: z.int().min(1).max(MAX_TRACKED_STEPS) }),
  cooking_finished: z.strictObject({ step_count: z.int().min(1).max(MAX_TRACKED_STEPS), minutes: z.int().min(0).max(1440) }),
  cooking_exited: z.strictObject({ at_step: z.int().min(1).max(MAX_TRACKED_STEPS), step_count: z.int().min(1).max(MAX_TRACKED_STEPS) }),
  // Spec 013: the "…" panel's quick toggles, per recipe on this device.
  kitchen_scale_toggled: z.strictObject({ on: z.boolean() }),
  units_toggled: z.strictObject({ system: z.enum(['metric', 'imperial']) }),
  // Spec 013: "Apply to recipe" in Scale by an ingredient. Never which ingredient or how much.
  scaled_by_ingredient: z.strictObject({}),
  // Spec 013: the converter settled on a value; the unit typed in and the main (honey) result.
  unit_converter_used: z.strictObject({ from_unit: ConverterUnitEvent, to_unit: ConverterResultUnitEvent }),
  // Spec 014: a recipe saved from the form. Whether it has a photo and the form's mode, never its text.
  recipe_created: z.strictObject({ source: z.enum(['app']), has_photo: z.boolean(), advanced_mode: z.boolean() }),
  // Spec 014: an existing recipe saved from the form, and the section Save was tapped in.
  recipe_edited: z.strictObject({ section: RecipeFormSection }),
  // Spec 015: an ingredient row added in the form: by "Paste a list" (once per row) or "+ Add ingredient".
  ingredient_line_added: z.strictObject({ parsed: z.boolean() }),
  // Spec 016: a step new to the recipe, sent once the form saved it; which add-ons it has.
  recipe_step_added: z.strictObject({ has_timer: z.boolean(), has_temperature: z.boolean(), has_tip: z.boolean() }),
  // Spec 017: a variant new to the recipe, sent once the form saved it; how many changes it makes.
  variant_created: z.strictObject({ change_count: z.int().min(1).max(50) }),
  // Spec 018: a recipe moved to Recently deleted, and through what (assistant names come with 023).
  recipe_deleted: z.strictObject({ source: z.enum(['app']) }),
  // Spec 018: a deleted recipe brought back (Restore, or Undo with 0); whole days since it was deleted.
  recipe_restored: z.strictObject({ days_since_delete: z.int().min(0).max(30) }),
  // Spec 019: a view-only link made (when the share sheet opens, or "Create a new link"), and
  // stopped, with how many whole days it was shared.
  share_link_created: z.strictObject({}),
  share_link_stopped: z.strictObject({ days_active: z.int().min(0) }),
  // Spec 019: on the public shared page. Anonymous only (`createAnonymousTracker`): no person,
  // even when the viewer is signed in (constitution VI).
  shared_recipe_viewed: z.strictObject({}),
  shared_units_toggled: z.strictObject({ system: z.enum(['metric', 'imperial']) }),
  // Spec 020: the grocery list. An item added (or merged into one already there), and from where:
  // typed in the app, from a recipe (022) or by an assistant (024). Never the item's text.
  grocery_item_added: z.strictObject({ from: z.enum(['app', 'recipe', 'ai']) }),
  // Ticked, not unticked.
  grocery_item_ticked: z.strictObject({}),
  // "Clear done items", and its Undo, with how many items.
  done_items_cleared: z.strictObject({ count: z.int().min(1) }),
  clear_done_undone: z.strictObject({ count: z.int().min(1) }),
  // Spec 021: where the family shops changed (the grocery settings sheet).
  store_profile_changed: z.strictObject({ profile: z.enum(['us', 'eu']) }),
  // "Clear all items" (confirmed), with how many items: the whole list, ticked or not.
  all_items_cleared: z.strictObject({ count: z.int().min(1) }),
  // Spec 022: "Add to groceries…" on a recipe, with how many ingredients were added and how many
  // were left unticked. Never which ones.
  groceries_added_from_recipe: z.strictObject({ ingredient_count: z.int().min(1).max(500), unticked_count: z.int().min(0).max(500) }),
} as const;

export type EventName = keyof typeof events;
export type EventProps<E extends EventName> = z.infer<(typeof events)[E]>;

/** Where validated events go: PostHog in the app and MCP server, nothing in tests and local dev. */
export interface AnalyticsTransport {
  capture(event: string, props: Record<string, unknown>): void;
  identify(userId: string): void;
  group(type: 'family', id: string): void;
  reset(): void;
}

export interface Tracker {
  track<E extends EventName>(event: E, props: EventProps<E>): void;
  /** Signed-in users are identified by user id only, with their family as a group. */
  identify(userId: string, familyId: string | null): void;
  /** On sign-out, so the next person on this device starts fresh. */
  reset(): void;
}

const noopTransport: AnalyticsTransport = {
  capture: () => undefined,
  identify: () => undefined,
  group: () => undefined,
  reset: () => undefined,
};

export function createTracker(transport: AnalyticsTransport | null): Tracker {
  const out = transport ?? noopTransport;
  return {
    track(event, props) {
      const schema = events[event] as z.ZodType | undefined;
      if (!schema) throw new Error(`Unknown analytics event: ${String(event)}`);
      out.capture(event, schema.parse(props) as Record<string, unknown>);
    },
    identify(userId, familyId) {
      out.identify(z.uuid().parse(userId));
      if (familyId) out.group('family', z.uuid().parse(familyId));
    },
    reset() {
      out.reset();
    },
  };
}

/** Events a shared-recipe page sends (spec 019). Never identified. */
export const anonymousEvents = ['shared_recipe_viewed', 'shared_units_toggled'] as const satisfies readonly EventName[];
export type AnonymousEventName = (typeof anonymousEvents)[number];

/** Sends events with no person attached: its transport must never identify anyone. */
export interface AnonymousTransport {
  capture(event: string, props: Record<string, unknown>): void;
}

export interface AnonymousTracker {
  track<E extends AnonymousEventName>(event: E, props: EventProps<E>): void;
}

/**
 * The shared page's tracker (spec 019). Only the anonymous events, validated like the others; the
 * app's transport is a separate PostHog client that keeps no identity.
 */
export function createAnonymousTracker(transport: AnonymousTransport | null): AnonymousTracker {
  return {
    track(event, props) {
      if (!(anonymousEvents as readonly string[]).includes(event)) throw new Error(`Not an anonymous event: ${String(event)}`);
      const schema = events[event] as z.ZodType;
      transport?.capture(event, schema.parse(props) as Record<string, unknown>);
    },
  };
}
