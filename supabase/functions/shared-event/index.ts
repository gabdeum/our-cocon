// Spec 042: GET /functions/v1/shared-event?token=<token>, signed out. See handler.ts.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { handle } from './handler.ts';

// Both are set by Supabase for every function, locally and self-hosted.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((request) =>
  handle(request, {
    sharedEvent: async (token) => {
      const { data, error } = await admin.rpc('shared_event', { p_token: token });
      if (error) throw error;
      return (data as Record<string, unknown> | null) ?? null;
    },
  }),
);
