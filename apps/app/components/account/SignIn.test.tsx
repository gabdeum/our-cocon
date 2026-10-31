// Spec 003 FR-001: magic link and Google, no passwords.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SignIn } from './SignIn';
import type { NativeSignIn } from '../../lib/auth';
import { fakeTracker, flush } from '../../test/fakes';

vi.mock('expo-linking', () => ({ createURL: (p: string) => p }));
vi.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, randomUUID: () => 'n', digestStringAsync: async () => 'hashed' }));
afterEach(cleanup);

function auth(error: unknown = null) {
  return { signInWithOtp: vi.fn().mockResolvedValue({ error }), signInWithOAuth: vi.fn().mockResolvedValue({ error: null }) };
}

it('sends a magic link and says where to look', async () => {
  const a = auth();
  render(<SignIn auth={a} />);
  expect(screen.getByRole('heading', { name: 'Welcome to Our Cocon' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'alex@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
  await flush();
  expect(screen.getByRole('heading', { name: 'Check your email' })).toBeTruthy();
  expect(screen.getByText('We sent a link to alex@example.com. Open it on this device to sign in. It works for 1 hour.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Send it again' }));
  await flush();
  expect(a.signInWithOtp).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Sent again. Check your email.')).toBeTruthy();
});

it('warns about a mistyped address without sending', async () => {
  const a = auth();
  render(<SignIn auth={a} />);
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'alex@' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
  await flush();
  expect(screen.getByText('Check your email address. It should look like name@example.com.')).toBeTruthy();
  expect(a.signInWithOtp).not.toHaveBeenCalled();
});

it('says what to do when sending fails', async () => {
  render(<SignIn auth={auth({ status: 429 })} />);
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'alex@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
  await flush();
  expect(screen.getByText('Too many tries. Wait a minute, then try again.')).toBeTruthy();
});

it('continues with Google', async () => {
  const a = auth();
  render(<SignIn auth={a} next="/join/abc" />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
  await flush();
  expect(a.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google' }));
});

it('goes back to the form for a different email', async () => {
  render(<SignIn auth={auth()} />);
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'alex@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
  await flush();
  fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }));
  expect(screen.getByRole('heading', { name: 'Welcome to Our Cocon' })).toBeTruthy();
});

it('says so when Google sign-in cannot open', async () => {
  const a = { signInWithOtp: vi.fn(), signInWithOAuth: vi.fn().mockResolvedValue({ error: { message: 'x' } }) };
  render(<SignIn auth={a} />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
  await flush();
  expect(screen.getByText("Couldn't open Google sign-in. Check your connection and try again.")).toBeTruthy();
});

// Spec 045: the iPhone's own Apple and Google sheets.
describe('on the iPhone', () => {
  const user = { created_at: new Date().toISOString(), app_metadata: { provider: 'apple' }, user_metadata: {} };
  function iphone(sheets: Partial<NativeSignIn> = {}, signInError: unknown = null) {
    const sheet: NativeSignIn = {
      apple: vi.fn(async () => ({ idToken: 't', code: null, givenName: null })),
      google: vi.fn(async () => ({ idToken: 'g' })),
      ...sheets,
    };
    const native = {
      client: {
        auth: { signInWithIdToken: vi.fn().mockResolvedValue({ data: { user: signInError ? null : user }, error: signInError }), updateUser: vi.fn() },
        functions: { invoke: vi.fn().mockResolvedValue({}) },
      },
      tracker: fakeTracker(),
      onSignedIn: vi.fn(),
    };
    render(<SignIn auth={auth()} next="/recipes" options={{ webGoogle: false, native: sheet }} native={native} />);
    return { sheet, native };
  }

  it('offers Apple, then Google, then the email form', () => {
    iphone();
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Continue with Apple', 'Continue with Google', 'Send me a link']);
    expect(screen.getByText('or')).toBeTruthy();
  });

  it('signs in with Apple, tracks it and goes on', async () => {
    const { native } = iphone();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Apple' }));
    await flush();
    expect(native.tracker.track).toHaveBeenCalledWith('signed_up', { method: 'apple' });
    expect(native.onSignedIn).toHaveBeenCalledWith('/recipes');
  });

  it('says what to do when Apple sign-in could not finish', async () => {
    iphone({}, { message: 'Bad ID token' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Apple' }));
    await flush();
    expect(screen.getByText("Couldn't sign in with Apple. Try again, or use your email.")).toBeTruthy();
  });

  it("says what to do when Google's sheet couldn't sign in", async () => {
    iphone({ google: async () => Promise.reject(new Error('network')) });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await flush();
    expect(screen.getByText("Couldn't open Google sign-in. Check your connection and try again.")).toBeTruthy();
  });

  it('shows nothing when the sheet is closed', async () => {
    const { native } = iphone({ google: async () => 'cancelled' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await flush();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText("Couldn't open Google sign-in. Check your connection and try again.")).toBeNull();
    expect(native.onSignedIn).not.toHaveBeenCalled();
  });

  it("offers only the email link where the sheets can't run (Expo Go)", () => {
    render(<SignIn auth={auth()} options={{ webGoogle: false, native: null }} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Send me a link']);
    expect(screen.queryByText('or')).toBeNull();
  });
});
