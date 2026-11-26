// Spec 072: GET /functions/v1/shared-groceries?token=<token> and POST {token, op, …}, signed out. See handler.ts.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { handle, type Refusal } from './handler.ts';

// Both are set by Supabase for every function, locally and self-hosted.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const refusals: readonly string[] = ['not_shared', 'read_only', 'too_many'] satisfies Refusal[];
/** Postgres codes for a row the table refuses: bad enum text, a failed check, a null, a bad value. */
const invalid = ['22P02', '23514', '23502', '22023', '22003'];

Deno.serve((request) =>
  handle(request, {
    rpc: async (fn, args) => {
      const { data, error } = await admin.rpc(fn, args);
      if (error) {
        if (error.code === 'P0001' && refusals.includes(error.message)) return { refused: error.message as Refusal };
        if (invalid.includes(error.code)) return { refused: 'invalid' };
        throw error;
      }
      return { data };
    },
  }),
);
