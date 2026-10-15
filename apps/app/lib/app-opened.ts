import type { Tracker } from '@cocon/schemas';

let sent = false;

/** `app_opened` once per launch (spec 001 Tracking). */
export function trackAppOpened(tracker: Tracker, platform: string, appVersion: string) {
  if (sent) return;
  sent = true;
  tracker.track('app_opened', { platform: platform === 'ios' ? 'ios' : 'web', app_version: appVersion });
}

export function resetAppOpenedForTests() {
  sent = false;
}
