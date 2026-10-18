// Spec 004 edge case: offline, cached data stays readable, including after a reload.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { SessionProvider, familyKey, useSession, type SessionState } from './session';
import { alex, fakeTracker, family, flush, gabriel } from '../test/fakes';

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

const session = { user: { id: gabriel.user_id, email: 'gabriel@example.com', user_metadata: {} } };
const cached: SessionState = { status: 'ready', userId: gabriel.user_id, me: gabriel, family, members: [gabriel, alex] };

function fakeClient(rows: () => Promise<{ data: unknown[] | null; error: unknown }>, signedIn: typeof session | null = session) {
  return {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: signedIn } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    from: vi.fn(() => ({ select: vi.fn(rows) })),
    rpc: vi.fn(),
  };
}

function Status() {
  const { state } = useSession();
  return <span role="status">{state.status === 'ready' ? `ready:${state.family.name}` : state.status}</span>;
}

function setup(client: ReturnType<typeof fakeClient>, queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider client={client as never} tracker={fakeTracker()}>
        <Status />
      </SessionProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('SessionProvider cache', () => {
  it('keeps the cached family on an offline reload instead of asking to set one up', async () => {
    onlineManager.setOnline(false);
    const client = fakeClient(() => Promise.reject(new TypeError('Failed to fetch')));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(familyKey(gabriel.user_id), cached);
    queryClient.setQueryData(['cache-owner'], gabriel.user_id);
    setup(client, queryClient);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('ready:The Demanges'));
  });

  it('loads the family online', async () => {
    const client = fakeClient(() => Promise.resolve({ data: [], error: null }));
    client.from.mockImplementation(((table: string) => ({
      select: vi.fn(() => Promise.resolve({ data: table === 'members' ? [gabriel] : [family], error: null })),
    })) as never);
    setup(client);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('ready:The Demanges'));
  });

  it('falls back to no family when the load fails online with nothing cached', async () => {
    setup(fakeClient(() => Promise.reject(new Error('boom'))));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('noFamily'));
  });

  it('empties the cache on sign-out, so the next person sees nothing', async () => {
    const client = fakeClient(() => Promise.resolve({ data: [], error: null }));
    const queryClient = new QueryClient();
    const persister = { removeClient: vi.fn(() => Promise.resolve()) };
    function SignOut() {
      const { signOut } = useSession();
      return (
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      );
    }
    render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider client={client as never} tracker={fakeTracker()} persister={persister}>
          <SignOut />
        </SessionProvider>
      </QueryClientProvider>,
    );
    await flush();
    queryClient.setQueryData(['grocery_items'], [{ id: 'x' }]);
    screen.getByRole('button', { name: 'Sign out' }).click();
    await flush();
    expect(queryClient.getQueryData(['grocery_items'])).toBeUndefined();
    expect(persister.removeClient).toHaveBeenCalled();
  });

  it("wipes a restored cache that belongs to someone else before it is read", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['cache-owner'], 'u-someone-else');
    queryClient.setQueryData(['grocery_items'], [{ id: 'theirs' }]);
    setup(fakeClient(() => new Promise(() => undefined)), queryClient);
    await flush();
    expect(queryClient.getQueryData(['grocery_items'])).toBeUndefined();
    expect(queryClient.getQueryData(['cache-owner'])).toBe(gabriel.user_id);
  });

  it('wipes a restored cache when nobody is signed in at startup', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['cache-owner'], gabriel.user_id);
    queryClient.setQueryData(['grocery_items'], [{ id: 'x' }]);
    setup(fakeClient(() => new Promise(() => undefined), null), queryClient);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('signedOut'));
    expect(queryClient.getQueryData(['grocery_items'])).toBeUndefined();
  });

  it("keeps the owner's own cache", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['cache-owner'], gabriel.user_id);
    queryClient.setQueryData(['grocery_items'], [{ id: 'mine' }]);
    setup(fakeClient(() => new Promise(() => undefined)), queryClient);
    await flush();
    expect(queryClient.getQueryData(['grocery_items'])).toEqual([{ id: 'mine' }]);
  });
});
