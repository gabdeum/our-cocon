import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { strings } from '../strings/en';
import { appUrl } from './links';

export type ShareOutcome = 'shared' | 'copied' | 'dismissed';

export interface ShareDeps {
  share: (content: { message: string; url?: string }) => Promise<unknown>;
  copy: (text: string) => Promise<unknown>;
}

const defaultDeps: ShareDeps = { share: (c) => Share.share(c), copy: (t) => Clipboard.setStringAsync(t) };

export function inviteUrl(token: string) {
  return appUrl(`/join/${token}`);
}

/**
 * Sends the invite through the system share sheet (FR-004). Browsers without one get the link
 * copied instead. A closed share sheet is not an error.
 */
export async function shareInvite(token: string, familyName: string, deps: ShareDeps = defaultDeps): Promise<ShareOutcome> {
  const url = inviteUrl(token);
  const message = strings.settings.family.inviteMessage(familyName, url);
  try {
    const result = await deps.share({ message });
    return (result as { action?: string } | undefined)?.action === 'dismissedAction' ? 'dismissed' : 'shared';
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return 'dismissed';
    await deps.copy(message);
    return 'copied';
  }
}
