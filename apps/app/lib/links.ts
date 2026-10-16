import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/** A full link to a route of this app: the site's own origin on the web, the app scheme on iOS. */
export function appUrl(path: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return new URL(path, window.location.origin).toString();
  return Linking.createURL(path);
}

/** Where to go after signing in: only this app's own paths, never another site. */
export function safeNext(next: unknown): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  return next;
}
