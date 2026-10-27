import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database, Tracker } from '@cocon/schemas';
import type { Client } from './supabase';
import { familyApi, type FamilyApi } from './family';
import { suggestedName } from './auth';

export type Member = Database['public']['Tables']['members']['Row'];
/** A member who signs in (spec 033 FR-001): the signed-in person always is one. */
export type AccountMember = Member & { user_id: string };
export type Family = Database['public']['Tables']['families']['Row'];

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'noFamily'; userId: string; suggestedName: string }
  | { status: 'ready'; userId: string; me: AccountMember; family: Family; members: Member[] };

interface SessionContextValue {
  state: SessionState;
  client: Pick<Client, 'auth' | 'from' | 'rpc' | 'storage'>;
  api: FamilyApi;
  tracker: Tracker;
  /** Reloads the family after a change (create, join, remove…). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Members in join order, so rows and initials read the same everywhere. */
function byJoined(a: Member, b: Member) {
  return a.joined_at.localeCompare(b.joined_at);
}

async function loadFamily(client: SessionContextValue['client'], session: Session): Promise<SessionState> {
  const userId = session.user.id;
  // RLS returns only the caller's family and its members.
  const [members, families] = await Promise.all([client.from('members').select('*'), client.from('families').select('*')]);
  if (members.error || families.error) throw members.error ?? families.error;
  const me = members.data.find((m): m is AccountMember => m.user_id === userId);
  const family = families.data[0];
  if (!me || !family) return { status: 'noFamily', userId, suggestedName: suggestedName(session.user) };
  return { status: 'ready', userId, me, family, members: [...members.data].sort(byJoined) };
}

/** The cache key of a person's family (spec 004: saved on the device, so it stays readable offline). */
export const familyKey = (userId: string | undefined) => ['family', userId] as const;

/** Whose data the cache holds; saved with it, so it is never shown to anyone else. */
const cacheOwnerKey = ['cache-owner'] as const;

/** Who is signed in and their family (spec 003). Everything signed-in reads it through useSession(). */
export function SessionProvider({
  client,
  tracker,
  persister,
  restored = Promise.resolve(),
  clearDevice,
  children,
}: {
  client: SessionContextValue['client'];
  tracker: Tracker;
  /** The saved copy of the cache (lib/query.ts), deleted on sign-out. */
  persister?: { removeClient: () => PromiseLike<void> | void };
  /** Resolves once the saved cache is loaded back (PersistQueryClientProvider onSuccess). */
  restored?: Promise<void>;
  /** Anything else this person keeps on the device (their timers, spec 010), removed on sign-out. */
  clearDevice?: (userId: string) => Promise<void>;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // Before anyone's data is read: if the cache belongs to someone else, or nobody is signed in
    // (signed out here, elsewhere, or while the app was closed), it is emptied.
    const take = async (next: Session | null) => {
      await restored;
      const person = next?.user.id ?? null;
      const owner = queryClient.getQueryData<string>(cacheOwnerKey);
      if (owner !== undefined && owner !== person) queryClient.clear();
      if (person) queryClient.setQueryData(cacheOwnerKey, person);
      setSession(next);
    };
    void client.auth.getSession().then(({ data }) => take(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) => void take(next));
    return () => data.subscription.unsubscribe();
  }, [client, queryClient, restored]);

  // Loaded once per person (not on every token refresh), and kept from the cache while offline:
  // an offline reload keeps the family instead of asking to set one up.
  const userId = session?.user.id;
  const family = useQuery({
    queryKey: familyKey(userId),
    queryFn: () => loadFamily(client, session as Session),
    enabled: !!session,
  });

  const refresh = useCallback(async () => {
    if (userId) await queryClient.refetchQueries({ queryKey: familyKey(userId) });
  }, [queryClient, userId]);

  const { data: cached, isError, isFetching } = family;
  const state = useMemo((): SessionState => {
    if (session === undefined) return { status: 'loading' };
    if (session === null) return { status: 'signedOut' };
    // A cached "no family" may be out of date (made on another device): wait for the fresh answer.
    if (cached && !(cached.status === 'noFamily' && isFetching)) return cached;
    // Online but failing (or a removed member whose session is ending): treat as no family for now.
    if (isError) return { status: 'noFamily', userId: session.user.id, suggestedName: suggestedName(session.user) };
    return { status: 'loading' };
  }, [session, cached, isError, isFetching]);

  const familyId = state.status === 'ready' ? state.family.id : null;
  useEffect(() => {
    if (userId) tracker.identify(userId, familyId);
  }, [tracker, userId, familyId]);

  const signOut = useCallback(async () => {
    await client.auth.signOut();
    queryClient.clear();
    // The saved copy too, now: the cache is only written to the device every second or so.
    await persister?.removeClient();
    if (userId) await clearDevice?.(userId);
    tracker.reset();
  }, [client, queryClient, persister, clearDevice, userId, tracker]);

  const api = useMemo(() => familyApi(client), [client]);
  const value = useMemo(() => ({ state, client, api, tracker, refresh, signOut }), [state, client, api, tracker, refresh, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession needs a SessionProvider');
  return value;
}

/** Routes anyone can open; the rest need a signed-in member (design/flows.md). */
// `r`: a shared recipe (spec 019), open to anyone, signed in or not. `oauth`: an AI assistant asking
// to connect (spec 023); it signs people in itself, so it can bring them back with the request.
const PUBLIC = new Set(['welcome', 'auth', 'join', 'r', 'oauth']);

/**
 * Where the gate sends someone, or null to stay. `segments` are Expo Router's route segments
 * ("welcome", "family" for /welcome/family; "(tabs)" for the tabs).
 */
export function gateRedirect(status: SessionState['status'], segments: readonly string[]): '/' | '/welcome' | '/welcome/family' | null {
  const [first = '', second] = segments;
  const isPublic = PUBLIC.has(first);
  switch (status) {
    case 'loading':
      return null;
    case 'signedOut':
      return isPublic && !(first === 'welcome' && second === 'family') ? null : '/welcome';
    case 'noFamily':
      if (first === 'join' || first === 'auth' || first === 'r' || first === 'oauth') return null;
      return first === 'welcome' && second === 'family' ? null : '/welcome/family';
    case 'ready':
      return first === 'welcome' ? '/' : null;
  }
}
