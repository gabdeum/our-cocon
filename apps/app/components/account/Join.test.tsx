// Spec 003 User Story 2: joining from an invite link.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Join, type JoinViewer } from './Join';
import { fakeApi, fakeTracker, flush, last } from '../../test/fakes';

vi.mock('expo-linking', () => ({ createURL: (p: string) => p }));
afterEach(cleanup);

const token = 'a'.repeat(43);
const auth = { signInWithOtp: vi.fn(), signInWithOAuth: vi.fn() };
const newcomer: JoinViewer = { kind: 'signedIn', name: 'Alex', ownFamily: null };

function setup(viewer: JoinViewer, api = fakeApi()) {
  const tracker = fakeTracker();
  const onJoined = vi.fn();
  render(<Join token={token} viewer={viewer} api={api} auth={auth} tracker={tracker} onJoined={onJoined} onOpenApp={vi.fn()} />);
  return { api, tracker, onJoined };
}

it('shows who invited a signed-out visitor, with sign-in that returns here', async () => {
  setup({ kind: 'signedOut' });
  await flush();
  expect(screen.getByRole('heading', { name: 'Join The Demanges' })).toBeTruthy();
  expect(screen.getByText('Gabriel invited you to share recipes and groceries.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
});

it('joins as "Can edit" and tracks how long the invite waited (US2.1)', async () => {
  const { api, tracker, onJoined } = setup(newcomer);
  await flush();
  fireEvent.click(screen.getByRole('button', { name: 'Join The Demanges' }));
  await flush();
  expect(api.acceptInvite).toHaveBeenCalledWith(token, 'Alex', false);
  expect(tracker.track).toHaveBeenCalledWith('invite_accepted', { days_since_sent: 2 });
  expect(onJoined).toHaveBeenCalled();
});

describe('expired invites (US2.2)', () => {
  it('shows the expired message for an old or used link', async () => {
    const { tracker } = setup(newcomer, fakeApi({ inviteStatus: vi.fn().mockResolvedValue({ ok: true, data: { status: 'expired' } }) }));
    await flush();
    expect(screen.getByText('This invite has expired. Ask for a new one.')).toBeTruthy();
    expect(tracker.track).toHaveBeenCalledWith('invite_expired_seen', {});
    expect(tracker.track).toHaveBeenCalledTimes(1);
  });

  it('treats a malformed link the same way, without asking the server', async () => {
    const api = fakeApi();
    render(<Join token="nope" viewer={newcomer} api={api} auth={auth} tracker={fakeTracker()} onJoined={vi.fn()} onOpenApp={vi.fn()} />);
    await flush();
    expect(screen.getByText('This invite has expired. Ask for a new one.')).toBeTruthy();
    expect(api.inviteStatus).not.toHaveBeenCalled();
  });

  it('shows it when the invite runs out before Join is pressed', async () => {
    setup(newcomer, fakeApi({ acceptInvite: vi.fn().mockResolvedValue({ ok: false, error: 'invite_expired' }) }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Join The Demanges' }));
    await flush();
    expect(screen.getByText('This invite has expired. Ask for a new one.')).toBeTruthy();
  });
});

describe('already in a family', () => {
  it('confirms before replacing a family of one', async () => {
    const { api } = setup({ kind: 'signedIn', name: 'Sam', ownFamily: { name: "Sam's", memberCount: 1 } });
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Join The Demanges' }));
    await flush();
    expect(api.acceptInvite).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('Leave “Sam\'s” and join “The Demanges”?')).toBeTruthy();
    expect(screen.getByText("Your family “Sam's” and everything in it will be deleted. This can't be undone.")).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Join The Demanges' });
    fireEvent.click(last(buttons));
    await flush();
    expect(api.acceptInvite).toHaveBeenCalledWith(token, 'Sam', true);
  });

  it('cannot leave a family that has other people', async () => {
    const { api } = setup({ kind: 'signedIn', name: 'Lou', ownFamily: { name: "Lou's", memberCount: 2 } });
    await flush();
    expect(screen.getByText("You're already in a family with other people. Ask its owner to remove you, then open this link again.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Join The Demanges' })).toBeNull();
    expect(api.acceptInvite).not.toHaveBeenCalled();
  });
});
