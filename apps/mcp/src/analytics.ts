import { PostHog } from 'posthog-node';
import { createTracker, type Tracker } from '@cocon/schemas';
import type { McpConfig } from './config.js';

/** PostHog for this environment's project; nothing when no key is set. */
export function createMcpTracker(config: McpConfig): { tracker: Tracker; shutdown: () => Promise<void> } {
  if (!config.posthogKey) return { tracker: createTracker(null), shutdown: async () => undefined };
  const posthog = new PostHog(config.posthogKey, config.posthogHost ? { host: config.posthogHost } : {});
  let distinctId = 'anonymous';
  let familyId: string | undefined;
  const tracker = createTracker({
    capture: (event, properties) =>
      posthog.capture({ distinctId, event, properties, ...(familyId ? { groups: { family: familyId } } : {}) }),
    identify: (userId) => {
      distinctId = userId;
    },
    group: (_type, id) => {
      familyId = id;
    },
    reset: () => {
      distinctId = 'anonymous';
      familyId = undefined;
    },
  });
  return { tracker, shutdown: () => posthog.shutdown() };
}
