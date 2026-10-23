import { PostHog } from 'posthog-node';
import { createTracker, type Tracker } from '@cocon/schemas';
import type { McpConfig } from './config.js';

export interface McpAnalytics {
  /** A tracker for one member's call: user id and family only (constitution VI). */
  forCaller(userId: string, familyId: string | null): Tracker;
  shutdown(): Promise<void>;
}

/**
 * PostHog for this environment's project; nothing when no key is set. One server answers many
 * members at once, so each call gets its own tracker instead of sharing an identity.
 */
export function createMcpAnalytics(config: Pick<McpConfig, 'posthogKey' | 'posthogHost'>): McpAnalytics {
  if (!config.posthogKey) return { forCaller: () => createTracker(null), shutdown: async () => undefined };
  const posthog = new PostHog(config.posthogKey, config.posthogHost ? { host: config.posthogHost } : {});
  return {
    forCaller(userId, familyId) {
      const tracker = createTracker({
        capture: (event, properties) =>
          posthog.capture({ distinctId: userId, event, properties, ...(familyId ? { groups: { family: familyId } } : {}) }),
        identify: () => undefined,
        group: () => undefined,
        reset: () => undefined,
      });
      // Validates the ids (uuids only), as the app's tracker does.
      tracker.identify(userId, familyId);
      return tracker;
    },
    shutdown: () => posthog.shutdown(),
  };
}
