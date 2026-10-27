import { strings } from '../strings/en';
import { appUrl } from './links';
import { shareMessage, systemShare, type ShareDeps, type ShareOutcome } from './system-share';

export type { ShareDeps, ShareOutcome } from './system-share';

export function inviteUrl(token: string) {
  return appUrl(`/join/${token}`);
}

/**
 * Sends the invite through the system share sheet (FR-004), or copies it where there's none.
 * `memberName`: the link is for that member without the app (spec 033).
 */
export async function shareInvite(token: string, familyName: string, deps: ShareDeps = systemShare, memberName?: string): Promise<ShareOutcome> {
  const f = strings.settings.family;
  const url = inviteUrl(token);
  return shareMessage(memberName ? f.inviteMessageAs(familyName, memberName, url) : f.inviteMessage(familyName, url), deps);
}
