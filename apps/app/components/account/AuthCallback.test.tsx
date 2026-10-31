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
  render(<AuthCallback auth={{ exchangeCodeForSession, verifyOtp: vi.fn() }} tracker={tracker} params={{ code: 'c', next: '/join/x' }} onSignedIn={onSignedIn} onBackToSignIn={vi.fn()} />);
  await flush();
  expect(tracker.track).toHaveBeenCalledWith('signed_up', { method: 'email' });
  expect(onSignedIn).toHaveBeenCalledWith('/join/x');
});

it('explains an expired link and offers a way back', async () => {
  render(<AuthCallback auth={{ exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn() }} tracker={fakeTracker()} params={{ error_code: 'otp_expired' }} onSignedIn={vi.fn()} onBackToSignIn={vi.fn()} />);
  await flush();
  expect(screen.getByText('This sign-in link has expired or was already used. Ask for a new one.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeTruthy();
});

it('shows "Signing you in…", then explains a link opened in another browser', async () => {
  const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'both auth code and code verifier should be non-empty' } });
  render(<AuthCallback auth={{ exchangeCodeForSession, verifyOtp: vi.fn() }} tracker={fakeTracker()} params={{ code: 'c' }} onSignedIn={vi.fn()} onBackToSignIn={vi.fn()} />);
  expect(screen.getByText('Signing you in…')).toBeTruthy();
  await flush();
  expect(screen.getByText('Open the link in the same browser where you asked for it, or ask for a new one.')).toBeTruthy();
});

// Spec 045 FR-001: /auth/confirm, the email link that works in any browser and opens the iPhone app.
it("signs in from the email's token and lands where it was going", async () => {
  const verifyOtp = vi.fn().mockResolvedValue({ data: { user: { created_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' } } }, error: null });
  const tracker = fakeTracker();
  const onSignedIn = vi.fn();
  render(
    <AuthCallback auth={{ exchangeCodeForSession: vi.fn(), verifyOtp }} tracker={tracker} params={{ token_hash: 'h', type: 'email', next: '/recipes' }} onSignedIn={onSignedIn} onBackToSignIn={vi.fn()} />,
  );
  await flush();
  expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'h', type: 'email' });
  expect(tracker.track).toHaveBeenCalledWith('signed_in', { method: 'email' });
  expect(onSignedIn).toHaveBeenCalledWith('/recipes');
});

it('shows the expired state for a token already used', async () => {
  const verifyOtp = vi.fn().mockResolvedValue({ data: { user: null }, error: { status: 403, message: 'Email link is invalid or has expired' } });
  const onSignedIn = vi.fn();
  render(<AuthCallback auth={{ exchangeCodeForSession: vi.fn(), verifyOtp }} tracker={fakeTracker()} params={{ token_hash: 'h', type: 'email' }} onSignedIn={onSignedIn} onBackToSignIn={vi.fn()} />);
  await flush();
  expect(screen.getByText('This sign-in link has expired or was already used. Ask for a new one.')).toBeTruthy();
  expect(onSignedIn).not.toHaveBeenCalled();
});
