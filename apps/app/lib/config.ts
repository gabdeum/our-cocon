import { z } from 'zod';

/**
 * Per-environment settings. The same web build runs on staging and prod: the container writes
 * `window.__COCON__` into /config.js when it starts. In local dev and native builds the values
 * come from EXPO_PUBLIC_* variables, inlined at build time.
 */
export const AppConfig = z.object({
  env: z.enum(['local', 'staging', 'prod']),
  commit: z.string().min(1),
  supabaseUrl: z.url(),
  supabaseAnonKey: z.string().min(1),
  /** The MCP server's address, without /mcp (spec 025: members paste it into their assistant). */
  mcpUrl: z.url(),
  posthogKey: z.string().optional(),
  posthogHost: z.url().optional(),
});
export type AppConfig = z.infer<typeof AppConfig>;

declare global {
  interface Window {
    __COCON__?: unknown;
  }
}

function blankToUndefined(v: string | undefined) {
  return v ? v : undefined;
}

function fromBuildEnv(): Record<string, unknown> {
  // Each variable is referenced in full so Expo can inline it.
  return {
    env: process.env.EXPO_PUBLIC_ENV ?? 'local',
    commit: process.env.EXPO_PUBLIC_COMMIT ?? 'dev',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    // Locally the MCP server runs beside the app (pnpm dev, apps/mcp/src/config.ts).
    mcpUrl: process.env.EXPO_PUBLIC_MCP_URL || 'http://localhost:8787',
    posthogKey: blankToUndefined(process.env.EXPO_PUBLIC_POSTHOG_KEY),
    posthogHost: blankToUndefined(process.env.EXPO_PUBLIC_POSTHOG_HOST),
  };
}

export function loadConfig(runtime: unknown = typeof window === 'undefined' ? undefined : window.__COCON__): AppConfig {
  return AppConfig.parse(runtime ?? fromBuildEnv());
}
