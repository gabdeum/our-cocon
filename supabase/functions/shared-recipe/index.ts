// Spec 019: GET /functions/v1/shared-recipe?token=<token>, signed out. See handler.ts.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { handle, type Shared } from './handler.ts';

// Both are set by Supabase for every function, locally and self-hosted.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((request) =>
  handle(request, {
    sharedRecipe: async (token) => {
      const { data, error } = await admin.rpc('shared_recipe', { p_token: token });
      if (error) throw error;
      return (data as Shared | null) ?? null;
    },
    signPhotos: async (paths, seconds) => {
      const { data, error } = await admin.storage.from('recipe-photos').createSignedUrls(paths, seconds);
      if (error) throw error;
      // Only the path and token: the host is Supabase's internal one (handler.ts).
      const relative = (url: string) => {
        const u = new URL(url);
        return u.pathname + u.search;
      };
      return Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl && !d.error ? [[d.path, relative(d.signedUrl)]] : [])));
    },
  }),
);
