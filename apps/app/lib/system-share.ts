import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export type ShareOutcome = 'shared' | 'copied' | 'dismissed';

export interface ShareDeps {
  share: (content: { message: string; url?: string }) => Promise<unknown>;
  copy: (text: string) => Promise<unknown>;
}

export const systemShare: ShareDeps = { share: (c) => Share.share(c), copy: (t) => Clipboard.setStringAsync(t) };

/**
 * Sends a message through the system share sheet (invites, spec 003; shared recipes, 019).
 * Browsers without one get it copied instead. A closed share sheet is not an error.
 */
export async function shareMessage(message: string, deps: ShareDeps = systemShare): Promise<ShareOutcome> {
  try {
    const result = await deps.share({ message });
    return (result as { action?: string } | undefined)?.action === 'dismissedAction' ? 'dismissed' : 'shared';
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return 'dismissed';
    await deps.copy(message);
    return 'copied';
  }
}
