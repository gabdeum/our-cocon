import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { loadConfig } from './config';

/**
 * A full link to a route of this app: the site's own origin on the web. iPhone builds use the web
 * app's address too (spec 045 FR-003: Universal Links open it in the app, and no other app can
 * claim it); only local development and Expo Go use the app's own scheme.
 */
export function appUrl(path: string): string {
  return linkOn(Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : loadConfig().appUrl, path);
}

/** `path` on the web address `base`, or on the app's own scheme without one. */
export function linkOn(base: string | undefined, path: string): string {
  return base ? new URL(path, base).toString() : Linking.createURL(path);
}

/** Cooking mode at a step (spec 012), as "Go to step" on Timers and the Lock Screen card (spec 048) open it. */
export function cookStepPath(recipeId: string, stepId: string): string {
  return `/recipes/${recipeId}/cook?step=${encodeURIComponent(stepId)}`;
}

/** Where to go after signing in: only this app's own paths, never another site. */
export function safeNext(next: unknown): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  return next;
}
