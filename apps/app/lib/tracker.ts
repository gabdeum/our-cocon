import { loadConfig } from './config';
import { createAppAnonymousTracker, createAppTracker } from './analytics';

/** The app's one tracker (PostHog in staging and prod, nothing locally). */
export const config = loadConfig();
export const tracker = createAppTracker(config);
/** The shared-recipe page's tracker (spec 019): anonymous only. */
export const anonymousTracker = createAppAnonymousTracker(config);
