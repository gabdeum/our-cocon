import { z } from 'zod';

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
  offline_banner_shown: z.strictObject({ screen: z.enum(['home', 'recipes', 'groceries', 'settings']) }),
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
