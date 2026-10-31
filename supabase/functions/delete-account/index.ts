// Spec 045 FR-009: POST /functions/v1/delete-account. See handler.ts.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { appleApi, appleConfig } from '../_shared/apple.ts';
import { handle } from './handler.ts';

// Set by Supabase for every function, locally and self-hosted.
const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const config = appleConfig((name) => Deno.env.get(name));

Deno.serve((request) =>
  handle(request, {
    apple: config ? appleApi(config) : null,
    deleteAccount: async (jwt) => {
      // As the member: PostgREST checks the token, and an assistant's role can't run this function.
      const asMember = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { error, status } = await asMember.rpc('delete_my_account');
      if (!error) return { ok: true };
      // The database's refusals (owner_must_delete_family, not signed in) go back as the RPC's would;
      // anything else stays on the server.
      return status >= 400 && status < 500 ? { ok: false, status, message: error.message } : { ok: false, status: 500, message: 'failed' };
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
