// Spec 003 FR-001: magic link and Google, no passwords.
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SignIn } from './SignIn';
import { flush } from '../../test/fakes';

vi.mock('expo-linking', () => ({ createURL: (p: string) => p }));
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
