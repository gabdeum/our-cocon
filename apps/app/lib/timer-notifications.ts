import type { LocalNotifications } from './timer-alerts';

/** The web: no timer alerts while the app is closed (spec 047 is iPhone first). The iPhone: timer-notifications.ios.ts. */
export const timerNotifications: LocalNotifications | null = null;
