// Spec 023 FR-001: a member approves (or refuses) an AI assistant acting as them.
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OAuthConsent, describeClient, safeRedirect } from './OAuthConsent';
import { flush } from '../../test/fakes';

vi.mock('expo-linking', () => ({ createURL: (p: string) => p }));
afterEach(cleanup);

const details = {
  authorization_id: 'abc123',
  redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
  client: { id: 'c1', name: 'Claude', uri: '', logo_uri: '' },
  user: { id: 'u1', email: 'g@example.com' },
  scope: 'email',
};

function setup({ signedIn = true, id = 'abc123', found = true as boolean | 'redirect', assistant = 'claude' as string | null, name = 'Claude', redirect = 'https://claude.ai/cb?code=xyz&state=s' } = {}) {
  const oauth = {
    getAuthorizationDetails: vi.fn().mockResolvedValue(
      found === 'redirect' ? { data: { redirect_url: 'https://claude.ai/cb?code=old' }, error: null } : found ? { data: { ...details, client: { ...details.client, name } }, error: null } : { data: null, error: new Error('authorization not found') },
    ),
    approveAuthorization: vi.fn().mockResolvedValue({ data: { redirect_url: redirect }, error: null }),
    denyAuthorization: vi.fn().mockResolvedValue({ data: { redirect_url: 'https://claude.ai/cb?error=access_denied' }, error: null }),
  };
  const auth = { signInWithOtp: vi.fn(), signInWithOAuth: vi.fn(), oauth };
  const onRedirect = vi.fn();
  const verify = vi.fn().mockResolvedValue(assistant);
  render(<OAuthConsent authorizationId={id} signedIn={signedIn} auth={auth as never} verify={verify} onRedirect={onRedirect} />);
  return { oauth, onRedirect };
}

it('asks whether the assistant may act as the member, and says where it goes back to', async () => {
  setup();
  await flush();
  expect(screen.getByRole('heading', { name: 'Let Claude use Our Cocon?' })).toBeTruthy();
  expect(screen.getByText("After this you'll go back to claude.ai.")).toBeTruthy();
});

it('Allow sends the assistant its code', async () => {
  const { oauth, onRedirect } = setup();
  await flush();
  fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
  await flush();
  expect(oauth.approveAuthorization).toHaveBeenCalledWith('abc123', { skipBrowserRedirect: true });
  expect(onRedirect).toHaveBeenCalledWith('https://claude.ai/cb?code=xyz&state=s');
  expect(screen.getByText('All set. You can go back to Claude.')).toBeTruthy();
});

it("Don't allow sends the refusal back", async () => {
  const { oauth, onRedirect } = setup();
  await flush();
  fireEvent.click(screen.getByRole('button', { name: "Don't allow" }));
  await flush();
  expect(oauth.denyAuthorization).toHaveBeenCalled();
  expect(onRedirect).toHaveBeenCalledWith('https://claude.ai/cb?error=access_denied');
  expect(screen.getByText("Claude wasn't given access.")).toBeTruthy();
});

it('goes straight back when the member already allowed this assistant', async () => {
  const { onRedirect } = setup({ found: 'redirect' });
  await flush();
  expect(onRedirect).toHaveBeenCalledWith('https://claude.ai/cb?code=old');
});

it('signs a signed-out member in first, coming back to this request', async () => {
  const { oauth } = setup({ signedIn: false });
  await flush();
  expect(screen.getByRole('heading', { name: 'Sign in to connect your AI assistant' })).toBeTruthy();
  expect(oauth.getAuthorizationDetails).not.toHaveBeenCalled();
});

it('says an old or malformed request has expired', async () => {
  setup({ found: false });
  await flush();
  expect(screen.getByText('This request has expired. Go back to your AI assistant and connect again.')).toBeTruthy();
  cleanup();
  const { oauth } = setup({ id: '<script>' });
  await flush();
  expect(screen.getByText('This request has expired. Go back to your AI assistant and connect again.')).toBeTruthy();
  expect(oauth.getAuthorizationDetails).not.toHaveBeenCalled();
});

it('never trusts the name an app gave itself: a fake "Claude" is shown as such, with a warning', async () => {
  setup({ assistant: null, name: 'Claude' });
  await flush();
  expect(screen.getByRole('heading', { name: 'Let “Claude” use Our Cocon?' })).toBeTruthy();
  expect(screen.getByText('This app calls itself Claude, but it would send you back to claude.ai. Only allow it if you trust claude.ai.')).toBeTruthy();
});

it('names a proven assistant by its own name, whatever it called itself', () => {
  expect(describeClient('Totally Claude', 'chatgpt', 'chatgpt.com')).toMatchObject({ name: 'ChatGPT', verified: true, impostor: false });
  expect(describeClient('My notes app', null, 'notes.example')).toMatchObject({ name: 'My notes app', verified: false, impostor: false });
});

it('never sends the member to an address that would run in this page', async () => {
  const { onRedirect } = setup({ redirect: 'javascript:alert(1)' });
  await flush();
  fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
  await flush();
  expect(onRedirect).not.toHaveBeenCalled();
  expect(screen.getByText('This request has expired. Go back to your AI assistant and connect again.')).toBeTruthy();
});

it('allows https, local http and app schemes only', () => {
  expect(['https://claude.ai/cb', 'http://localhost:4000/cb', 'http://127.0.0.1:33418/callback', 'cursor://auth'].map(safeRedirect)).toEqual([true, true, true, true]);
  expect(['http://evil.example/cb', 'javascript:alert(1)', 'data:text/html,x', 'JAVASCRIPT:alert(1)', 'not a url'].map(safeRedirect)).toEqual([false, false, false, false, false]);
});
