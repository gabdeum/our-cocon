import { PostHog } from 'posthog-node';
import { createTracker, type Tracker } from '@cocon/schemas';
import type { NotifierConfig } from './config.js';

export interface NotifierAnalytics {
  /** A tracker for one family's server events: no person, the family as the group (constitution VI). */
  forFamily(familyId: string): Tracker;
  shutdown(): Promise<void>;
}

/** PostHog for this environment's project; nothing when no key is set. */
export function createNotifierAnalytics(config: Pick<NotifierConfig, 'posthogKey' | 'posthogHost'>): NotifierAnalytics {
  if (!config.posthogKey) return { forFamily: () => createTracker(null), shutdown: async () => undefined };
  const posthog = new PostHog(config.posthogKey, config.posthogHost ? { host: config.posthogHost } : {});
  return {
    forFamily: (familyId) =>
      createTracker({
        capture: (event, properties) =>
          posthog.capture({ distinctId: familyId, event, properties: { ...properties, $process_person_profile: false }, groups: { family: familyId } }),
        identify: () => undefined,
        group: () => undefined,
        reset: () => undefined,
      }),
    shutdown: () => posthog.shutdown(),
  };
}
