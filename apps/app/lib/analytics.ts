import PostHog from 'posthog-react-native';
import { createTracker, type AnalyticsTransport, type Tracker } from '@cocon/schemas';
import type { AppConfig } from './config';

/** PostHog in staging and prod (one project each); nothing when no key is set (local dev, tests). */
export function posthogTransport(config: AppConfig): AnalyticsTransport | null {
  if (!config.posthogKey) return null;
  const posthog = new PostHog(config.posthogKey, {
    ...(config.posthogHost ? { host: config.posthogHost } : {}),
    // Only typed events from packages/schemas/analytics.ts are sent.
    captureAppLifecycleEvents: false,
  });
  return {
    capture: (event, props) => void posthog.capture(event, props as Parameters<PostHog['capture']>[1]),
    identify: (userId) => posthog.identify(userId),
    group: (type, id) => posthog.group(type, id),
    reset: () => posthog.reset(),
  };
}

export function createAppTracker(config: AppConfig): Tracker {
  return createTracker(posthogTransport(config));
}
