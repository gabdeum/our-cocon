import { z } from 'zod';
import { UndoKind } from './activity';
import { CalendarView, DefaultReminder, Reminder, SlotKey, TimeType, Visibility } from './calendar';
import { AiPermission, CookingSetting, MemberColor, SignInMethod } from './family';
import { NotificationKind } from './notifications';
import { FilterKey } from './recipe-filters';
import { ConnectionAssistant, KnownAssistant, WriteSource } from './sources';

// The converter's units (spec 013, `@cocon/quantity` CONVERTER_UNITS), and its result tiles' units.
const converterUnits = ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'fl_oz', 'c', 'f', 'gas_mark'] as const;
const ConverterUnitEvent = z.enum(converterUnits);
/** The recipe form's sections (spec 014 FR-001), in order. */
export const RecipeFormSection = z.enum(['details', 'ingredients', 'steps', 'variants']);
export type RecipeFormSection = z.infer<typeof RecipeFormSection>;
/** What an event edit changed (spec 041 `event_updated`): field names only, never their values. */
export const EventField = z.enum(['title', 'type', 'place', 'notes', 'date', 'time', 'who', 'responsible', 'repeat', 'reminder', 'checklist']);
export type EventField = z.infer<typeof EventField>;
const ConverterResultUnitEvent = z.enum([...converterUnits, 'cups_of', 'fan_c', 'fan_f']);

/**
 * The highest step count events take: a recipe's 100 steps (MAX_STEPS) plus any its variants add.
 * Senders cap what they send at this, so a longer recipe never makes `track` throw.
 */
/** Spec 046: what led to the notifications ask (the first timer, the first reminder, or the page). */
export const NotificationAskTrigger = z.enum(['timer', 'reminder', 'settings']);
export type NotificationAskTrigger = z.infer<typeof NotificationAskTrigger>;

/** Spec 028: the state Home's calendar card is in. */
export const HomeCardState = z.enum(['today', 'week', 'empty']);
export type HomeCardState = z.infer<typeof HomeCardState>;

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
  // Spec 036 adds Calendar and renames Settings to Menu.
  tab_selected: z.strictObject({
    tab: z.enum(['home', 'calendar', 'recipes', 'groceries', 'menu']),
  }),
  // Spec 003: accounts and family.
  // Spec 045: Sign in with Apple on the iPhone.
  signed_up: z.strictObject({ method: SignInMethod }),
  signed_in: z.strictObject({ method: SignInMethod }),
  family_created: z.strictObject({}),
  invite_sent: z.strictObject({}),
  invite_accepted: z.strictObject({ days_since_sent: z.int().min(0) }),
  invite_expired_seen: z.strictObject({}),
  member_removed: z.strictObject({}),
  family_deleted: z.strictObject({ member_count: z.int().min(1) }),
  // Spec 033: members without the app, and member colors (the palette key, never a name).
  member_added_without_app: z.strictObject({}),
  member_color_changed: z.strictObject({ color: MemberColor }),
  managed_member_linked: z.strictObject({ days_since_added: z.int().min(0) }),
  // Spec 029: the Menu tab. A tile in Apps, a row in Settings, and signing out from Family.
  menu_app_opened: z.strictObject({ app: z.enum(['calendar', 'recipes', 'groceries', 'timers']) }),
  settings_row_opened: z.strictObject({ row: z.enum(['family', 'ai', 'notifications', 'calendar', 'recipes', 'groceries', 'deleted']) }),
  signed_out: z.strictObject({}),
  // Spec 029: a calendar setting changed. Its new value (on/off for switches), the slot changed for
  // times of day, "phone" for the home time zone: never the zone's name or the hours.
  calendar_settings_changed: z.strictObject({
    setting: z.enum(['opens_on', 'week_start', 'time_format', 'show_birthdays', 'fade_past', 'times_of_day', 'home_time_zone']),
    value: z.enum([...CalendarView.options, 'automatic', 'sunday', 'monday', '24h', '12h', ...SlotKey.options, 'on', 'off', 'phone']),
  }),
  // Spec 004: the offline banner appeared on a screen (once per offline spell). Later screens join the enum.
  offline_banner_shown: z.strictObject({ screen: z.enum(['home', 'calendar', 'recipes', 'recipe', 'recipe_form', 'groceries', 'settings', 'menu']) }),
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
  // Spec 011: the TimerPill was tapped, or hidden with its ✕ (FR-008), and the Timers screen opened; how many timers exist.
  timer_pill_tapped: z.strictObject({ timer_count: z.int().min(1).max(100) }),
  timer_pill_hidden: z.strictObject({ timer_count: z.int().min(1).max(100) }),
  timers_screen_opened: z.strictObject({ timer_count: z.int().min(0).max(100) }),
  // Spec 012: cooking mode opened or left with ✕ (the session stays in progress, spec 051).
  // `at_step` counts from 1.
  cooking_started: z.strictObject({ step_count: z.int().min(1).max(MAX_TRACKED_STEPS) }),
  cooking_exited: z.strictObject({ at_step: z.int().min(1).max(MAX_TRACKED_STEPS), step_count: z.int().min(1).max(MAX_TRACKED_STEPS) }),
  // Spec 051: a cooking session started (`resumed_existing`: "Resume" on the "already cooking"
  // sheet), resumed from a card, and ended. `steps_seen` counts from 1; `minutes` from its start.
  cook_started: z.strictObject({ recipe_id: z.uuid(), resumed_existing: z.boolean() }),
  cook_resumed: z.strictObject({ from: z.enum(['list', 'recipe', 'home']), step: z.int().min(1).max(MAX_TRACKED_STEPS) }),
  cook_finished: z.strictObject({
    status: z.enum(['done', 'cancelled']),
    cancel_reason: z.enum(['user', 'replaced']).nullable(),
    steps_seen: z.int().min(1).max(MAX_TRACKED_STEPS),
    minutes: z.int().min(0).max(4320),
  }),
  // Spec 051: the recipe form opened from the recipe page's pencil.
  recipe_edit_opened: z.strictObject({ from: z.enum(['top_bar']) }),
  // Spec 051: a member picked their own units (Menu › Recipes › For you).
  my_units_changed: z.strictObject({ system: z.enum(['metric', 'imperial']) }),
  // Spec 012: "Screen stays on" switched in cooking mode's options sheet, for this visit.
  cook_screen_awake_toggled: z.strictObject({ on: z.boolean() }),
  // Spec 013: the "…" panel's quick toggles: the kitchen scale per recipe on this device; units for
  // this visit only (spec 051).
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
  // Spec 018: a recipe moved to Recently deleted, and through what: 'app', or the assistant's name
  // when an MCP tool deleted it (spec 023, sent from the MCP server).
  recipe_deleted: z.strictObject({ source: WriteSource }),
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
  // "Clear done items", and its Undo, with how many rows (one per thing since spec 022).
  done_items_cleared: z.strictObject({ count: z.int().min(1) }),
  clear_done_undone: z.strictObject({ count: z.int().min(1) }),
  // Spec 027: a cooking setting changed for one recipe (Reset included), or for the whole family.
  // Only which setting, never the recipe.
  recipe_setting_changed: z.strictObject({ setting: CookingSetting }),
  family_default_changed: z.strictObject({ setting: CookingSetting }),
  // Spec 021: where the family shops changed (the grocery settings sheet).
  store_profile_changed: z.strictObject({ profile: z.enum(['us', 'eu']) }),
  // "Clear all items" (confirmed), with how many rows: the whole list, ticked or not.
  all_items_cleared: z.strictObject({ count: z.int().min(1) }),
  // Spec 022: "Add to groceries…" on a recipe, with how many ingredients were added and how many
  // were left unticked. Never which ones.
  groceries_added_from_recipe: z.strictObject({ ingredient_count: z.int().min(1).max(500), unticked_count: z.int().min(0).max(500) }),
  // Spec 052: the recipe opened from its card on the grocery list.
  grocery_recipe_opened: z.strictObject({ from: z.enum(['card']) }),
  // Spec 022: a recipe card's menu on the grocery list. Its items removed, and
  // its servings changed on the list. Never which recipe.
  // `item_count` counts the recipe's items removed (the banner's "Removed {n} items").
  grocery_recipe_removed: z.strictObject({ item_count: z.int().min(1).max(500) }),
  grocery_recipe_servings_changed: z.strictObject({ from: z.int().min(1).max(50), to: z.int().min(1).max(50) }),
  // Spec 023: an assistant called an MCP tool (sent from the MCP server): which tool, which
  // assistant ('claude', 'chatgpt', 'gemini' or 'mcp') and whether it worked. Never its input.
  mcp_tool_called: z.strictObject({ tool: z.string().regex(/^[a-z][a-z_]{0,59}$/), assistant: WriteSource, ok: z.boolean() }),
  // Spec 024: a member changed what their AI assistants may do (OC-Connect › What AI can do).
  ai_permission_changed: z.strictObject({ permission: AiPermission, allowed: z.boolean() }),
  // Spec 025: Settings › AI assistants. Connect opened, the check found the assistant (or not:
  // `step` is the step the message sends the member back to), and Disconnect confirmed.
  ai_connect_started: z.strictObject({ assistant: KnownAssistant }),
  ai_connected: z.strictObject({ assistant: KnownAssistant }),
  ai_connect_failed: z.strictObject({ assistant: KnownAssistant, step: z.int().min(1).max(9) }),
  ai_disconnected: z.strictObject({ assistant: ConnectionAssistant }),
  // Spec 026: a member undid an AI change from Home or the activity list, by what it did; and
  // restored a recipe or an event (spec 044) an assistant deleted. Never what it was.
  ai_change_undone: z.strictObject({ kind: UndoKind }),
  ai_delete_restored: z.strictObject({}),
  // Spec 036: the calendar was opened (from the tab bar, or Home's card in 028), its view switched,
  // and its member filter changed (how many chips are shown, never who).
  calendar_viewed: z.strictObject({ view: CalendarView, entry: z.enum(['nav', 'homepage']) }),
  calendar_view_changed: z.strictObject({ from: CalendarView, to: CalendarView }),
  calendar_member_filter_changed: z.strictObject({ members_visible: z.int().min(0) }),
  // Spec 037: a day opened from a view (Week since 038; Month until its day sheet, 2026-11-02),
  // a month day's sheet opened (how many events it lists, never which), and the month's
  // first-visit hint dismissed.
  calendar_day_opened: z.strictObject({ from_view: CalendarView }),
  calendar_day_sheet_opened: z.strictObject({ events: z.int().min(0) }),
  calendar_first_hint_dismissed: z.strictObject({}),
  // Spec 038: a week swiped left (next) or right (previous); the header's arrows don't count.
  calendar_week_swiped: z.strictObject({ direction: z.enum(['next', 'previous']) }),
  // Spec 039: a day swiped (the arrows don't count), and an empty band's "+ Add in the …" tapped.
  calendar_day_swiped: z.strictObject({ direction: z.enum(['next', 'previous']) }),
  calendar_slot_add_tapped: z.strictObject({ slot: SlotKey }),
  // Spec 041: an event added (`slot` is the first slot picked; how long the sheet was open), edited
  // ("this", "future" or "all" of a repeating event; a one-off is "all"), saved or left while the
  // soft conflict warning showed, and an add undone from its toast.
  event_created: z.strictObject({
    source: z.enum(['app', 'assistant']),
    time_type: TimeType,
    slot: SlotKey.nullable(),
    member_count: z.int().min(0),
    has_repeat: z.boolean(),
    used_more_options: z.boolean(),
    seconds_to_save: z.int().min(0),
    // Spec 053: how many days it spans (1 for one day), and whether a suggested title filled it.
    days: z.int().min(1).max(367),
    used_suggestion: z.boolean(),
  }),
  // Spec 053 FR-001: a suggested title picked in the add sheet (its place in the list, how much was typed; never the text).
  event_title_suggestion_picked: z.strictObject({ position: z.int().min(1).max(10), query_length: z.int().min(1).max(60) }),
  event_updated: z.strictObject({ fields_changed: z.array(EventField), scope: z.enum(['all', 'this', 'future']) }),
  event_conflict_shown: z.strictObject({ proceeded: z.boolean() }),
  event_create_undone: z.strictObject({}),
  // Spec 042: an event deleted from its page ("this" date, "future" dates, or "all" of it; a
  // one-off is "all"), by its creator or not, and again when the toast's Undo brings it back; a
  // copy made with Duplicate; a view-only link made (not reopened); a checklist item ticked.
  event_deleted: z.strictObject({ scope: z.enum(['all', 'this', 'future']), own_event: z.boolean(), undone: z.boolean() }),
  event_duplicated: z.strictObject({}),
  event_shared: z.strictObject({}),
  event_checklist_ticked: z.strictObject({}),
  // Spec 043: who can see an event, sent when a save changes it (a new event: Private or Surprise).
  event_visibility_set: z.strictObject({ visibility: Visibility }),
  // Spec 028: Home. The latest-recipe hero opened, a stat tile tapped, "Add your first recipe";
  // the calendar card's rows (which part, and which state the card was in), toggle and "+".
  home_hero_opened: z.strictObject({}),
  home_tile_tapped: z.strictObject({ tile: z.enum(['groceries', 'recipes']) }),
  first_recipe_cta_tapped: z.strictObject({}),
  homepage_calendar_event_tapped: z.strictObject({ section: z.enum(['today', 'week']), card_state: HomeCardState }),
  homepage_calendar_toggled: z.strictObject({ to: z.enum(['today', 'week']) }),
  homepage_calendar_add_tapped: z.strictObject({ card_state: HomeCardState }),
  // Spec 028 FR-008: a strip day picked in This week (0 today … 6).
  homepage_calendar_day_picked: z.strictObject({ day_offset: z.int().min(0).max(6) }),
  // Spec 028 FR-006: Latest activity's "All · AI only".
  homepage_activity_filter_changed: z.strictObject({ to: z.enum(['all', 'ai']) }),
  // Spec 053 FR-018: Activity's "Show more" loaded another page (2 is the first one it adds).
  activity_show_more: z.strictObject({ page: z.int().min(2) }),
  // Spec 053 FR-013: a toast closed with its ✕, by tone (sage confirmation, warn failure).
  toast_dismissed: z.strictObject({ tone: z.enum(['sage', 'warn']) }),
  // Spec 046: asking for notifications (never at launch), tapping one, and Menu › Notifications.
  notifications_ask_shown: z.strictObject({ trigger: NotificationAskTrigger }),
  notifications_permission_result: z.strictObject({ granted: z.boolean(), trigger: NotificationAskTrigger }),
  notification_opened: z.strictObject({ kind: NotificationKind, cold_start: z.boolean() }),
  notification_settings_changed: z.strictObject({
    setting: z.enum(['timers_live', 'timers_alert', 'reminders_on', 'reminders_scope', 'default_reminder']),
    value: z.enum(['on', 'off', 'mine', 'all', ...DefaultReminder.options]),
  }),
  // Spec 047: a timer-done alert on the phone: its "+1 min" or "Stop", or tapped open; and the one follow-up that arrived.
  timer_alert_action: z.strictObject({ action: z.enum(['add_minute', 'stop', 'open']) }),
  timer_alert_followup_sent: z.strictObject({}),
  // Spec 048: the Live Activity started (timers on the Lock Screen), and its "+1 min" / "Pause" / "Resume".
  timer_live_activity_started: z.strictObject({ timer_count: z.int().min(1).max(100) }),
  timer_live_activity_action: z.strictObject({ action: z.enum(['add_minute', 'remove_minute', 'pause', 'resume', 'stop', 'dismiss']) }),
  // Spec 049 (server, the notifier): one event's reminder went out for one date, to this many members.
  event_reminder_sent: z.strictObject({ kind: Reminder.exclude(['none']), recipients: z.int().min(1).max(1000) }),
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
