import { loadConfig } from './config';
import { createAppTracker } from './analytics';

/** The app's one tracker (PostHog in staging and prod, nothing locally). */
export const config = loadConfig();
export const tracker = createAppTracker(config);
