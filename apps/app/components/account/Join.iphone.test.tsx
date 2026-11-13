// Spec 054 FR-003: an invite opened in the iPhone app signs in with the iPhone's own sheets, then comes back to Join.
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Join } from './Join';
import { fakeApi, fakeTracker, flush } from '../../test/fakes';

vi.mock('expo-linking', () => ({ createURL: (p: string) => p }));
vi.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, randomUUID: () => 'n', digestStringAsync: async () => 'hashed' }));
vi.mock('../../lib/native-sign-in', () => ({
  signInOptions: {
    webGoogle: false,
    native: { apple: async () => ({ idToken: 't', code: null, givenName: null }), google: async () => ({ idToken: 'g' }) },
  },
}));
afterEach(cleanup);

const token = 'a'.repeat(43);

it('offers Apple and Google in the app, and comes back to the invite after signing in', async () => {
  const native = {
    client: {
      auth: { signInWithIdToken: vi.fn().mockResolvedValue({ data: { user: { created_at: new Date().toISOString(), app_metadata: { provider: 'apple' }, user_metadata: {} } }, error: null }), updateUser: vi.fn() },
      functions: { invoke: vi.fn().mockResolvedValue({}) },
    },
    tracker: fakeTracker(),
    onSignedIn: vi.fn(),
  };
  render(
    <Join token={token} viewer={{ kind: 'signedOut' }} api={fakeApi()} auth={{ signInWithOtp: vi.fn(), signInWithOAuth: vi.fn() }} tracker={fakeTracker()} onJoined={vi.fn()} onOpenApp={vi.fn()} native={native} />,
  );
  await flush();
  expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Continue with Apple', 'Continue with Google', 'Send me a link']);
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Apple' }));
  await flush();
  expect(native.onSignedIn).toHaveBeenCalledWith(`/join/${token}`);
});
