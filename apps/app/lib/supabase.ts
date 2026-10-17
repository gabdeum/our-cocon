import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '@cocon/schemas';
import { config } from './tracker';

export type Client = SupabaseClient<Database>;

/**
 * The app's one Supabase client (constitution II: the app talks to Supabase directly, RLS is the
 * boundary). PKCE sign-in; the session is kept in the browser's storage on the web and in
 * AsyncStorage on iOS, and refreshed in the background (spec 003 FR-001b).
 */
export const supabase: Client = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    // /auth/callback exchanges the code itself, so it can show what went wrong.
    detectSessionInUrl: false,
  },
});
