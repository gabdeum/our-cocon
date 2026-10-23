import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';

/**
 * A Supabase client acting as one signed-in member: the app's own, or the MCP server's with an
 * assistant's token (spec 023). RLS is the boundary either way (constitution II).
 */
export type Db = SupabaseClient<Database>;
