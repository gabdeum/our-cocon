// Spec 045 FR-009: POST /functions/v1/apple-sign-in. See handler.ts.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { appleApi, appleConfig } from '../_shared/apple.ts';
import { handle } from './handler.ts';

// Set by Supabase for every function, locally and self-hosted.
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const config = appleConfig((name) => Deno.env.get(name));

Deno.serve((request) =>
  handle(request, {
    serviceKey,
    apple: config ? appleApi(config) : null,
    member: async (jwt) => {
      const { data, error } = await admin.auth.getUser(jwt);
      if (error || !data.user) return null;
      const apple = data.user.identities?.find((i) => i.provider === 'apple');
      return { id: data.user.id, appleSub: apple?.id ?? null };
    },
    keepToken: async (userId, refreshToken) => {
      const { error } = await admin.rpc('apple_keep_token', { p_user: userId, p_token: refreshToken });
      if (error) throw error;
    },
    toRevoke: async (userId) => {
      const { data, error } = await admin.rpc('apple_tokens_to_revoke', userId ? { p_user: userId } : {});
      if (error) throw error;
      return (data ?? []) as { id: number; refresh_token: string }[];
    },
    tried: async (id, revoked) => {
      const { error } = await admin.rpc('apple_revocation_tried', { p_id: id, p_revoked: revoked });
      if (error) throw error;
    },
  }),
);
