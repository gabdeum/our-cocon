import { strings } from '../strings/en';
import { appUrl } from './links';
import { shareMessage, systemShare, type ShareDeps, type ShareOutcome } from './system-share';

export type { ShareDeps, ShareOutcome } from './system-share';

export function inviteUrl(token: string) {
  return appUrl(`/join/${token}`);
}

/** Sends the invite through the system share sheet (FR-004), or copies it where there's none. */
export async function shareInvite(token: string, familyName: string, deps: ShareDeps = systemShare): Promise<ShareOutcome> {
  return shareMessage(strings.settings.family.inviteMessage(familyName, inviteUrl(token)), deps);
}
