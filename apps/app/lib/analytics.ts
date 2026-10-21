import PostHog from 'posthog-react-native';
import { createAnonymousTracker, createTracker, type AnalyticsTransport, type AnonymousTracker, type AnonymousTransport, type Tracker } from '@cocon/schemas';
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

/**
 * The shared-recipe page's events (spec 019): a second PostHog client that keeps its id in memory
 * only and is never identified, so no event links to a person, even a signed-in one. Made on the
 * first event, so other pages never start it.
 */
export function anonymousTransport(config: AppConfig): AnonymousTransport | null {
  const { posthogKey, posthogHost } = config;
  if (!posthogKey) return null;
  let posthog: PostHog | null = null;
  return {
    capture: (event, props) => {
      posthog ??= new PostHog(posthogKey, {
        ...(posthogHost ? { host: posthogHost } : {}),
        persistence: 'memory',
        captureAppLifecycleEvents: false,
        personProfiles: 'never',
      });
      void posthog.capture(event, { ...props, $process_person_profile: false } as Parameters<PostHog['capture']>[1]);
    },
  };
}

export function createAppAnonymousTracker(config: AppConfig): AnonymousTracker {
  return createAnonymousTracker(anonymousTransport(config));
}

