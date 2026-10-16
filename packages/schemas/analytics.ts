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
} as const;

export type EventName = keyof typeof events;
export type EventProps<E extends EventName> = z.infer<(typeof events)[E]>;

/** Where validated events go: PostHog in the app and MCP server, nothing in tests and local dev. */
export interface AnalyticsTransport {
  capture(event: string, props: Record<string, unknown>): void;
  identify(userId: string): void;
  group(type: 'family', id: string): void;
}

export interface Tracker {
  track<E extends EventName>(event: E, props: EventProps<E>): void;
  /** Signed-in users are identified by user id only, with their family as a group. */
  identify(userId: string, familyId: string | null): void;
}

const noopTransport: AnalyticsTransport = {
  capture: () => undefined,
  identify: () => undefined,
  group: () => undefined,
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
  };
}
