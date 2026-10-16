import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AuthCallback } from './AuthCallback';
import { fakeTracker, flush } from '../../test/fakes';

vi.mock('expo-linking', () => ({ createURL: (p: string) => p }));
afterEach(cleanup);

it('signs in, tracks sign-up with its method and continues to the invite', async () => {
  const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { user: { created_at: new Date().toISOString(), app_metadata: { provider: 'email' } } }, error: null });
  const tracker = fakeTracker();
  const onSignedIn = vi.fn();
  render(<AuthCallback auth={{ exchangeCodeForSession }} tracker={tracker} params={{ code: 'c', next: '/join/x' }} onSignedIn={onSignedIn} onBackToSignIn={vi.fn()} />);
  await flush();
  expect(tracker.track).toHaveBeenCalledWith('signed_up', { method: 'email' });
  expect(onSignedIn).toHaveBeenCalledWith('/join/x');
});

it('explains an expired link and offers a way back', async () => {
  render(<AuthCallback auth={{ exchangeCodeForSession: vi.fn() }} tracker={fakeTracker()} params={{ error_code: 'otp_expired' }} onSignedIn={vi.fn()} onBackToSignIn={vi.fn()} />);
  await flush();
  expect(screen.getByText('This sign-in link has expired or was already used. Ask for a new one.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeTruthy();
});

it('shows "Signing you in…", then explains a link opened in another browser', async () => {
  const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'both auth code and code verifier should be non-empty' } });
  render(<AuthCallback auth={{ exchangeCodeForSession }} tracker={fakeTracker()} params={{ code: 'c' }} onSignedIn={vi.fn()} onBackToSignIn={vi.fn()} />);
  expect(screen.getByText('Signing you in…')).toBeTruthy();
  await flush();
  expect(screen.getByText('Open the link in the same browser where you asked for it, or ask for a new one.')).toBeTruthy();
});
