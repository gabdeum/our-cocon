import { z } from 'zod';

/** Read once at start-up. Every URL and key comes from the environment (spec 001 FR-002). */
export const NotifierConfig = z.object({
  env: z.enum(['local', 'staging', 'prod']),
  commit: z.string().min(1),
  /** /health for the Docker health check: inside Docker only, never routed. */
  port: z.coerce.number().int().positive(),
  supabaseUrl: z.url(),
  /** Spec 046 FR-005: the notifier reads every family's devices, so it uses the service role. */
  serviceRoleKey: z.string().min(1),
  /** Expo's access token, once "Enhanced push security" is on (docs/operations.md › Secrets). */
  expoAccessToken: z.string().optional(),
  intervalMs: z.coerce.number().int().positive(),
  /** Spec 049: `event_reminder_sent` goes to this environment's PostHog project; nothing without a key. */
  posthogKey: z.string().optional(),
  posthogHost: z.url().optional(),
});
export type NotifierConfig = z.infer<typeof NotifierConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): NotifierConfig {
  return NotifierConfig.parse({
    env: env.COCON_ENV ?? 'local',
    commit: env.COCON_COMMIT ?? 'dev',
    port: env.NOTIFIER_PORT ?? 8789,
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SERVICE_ROLE_KEY,
    expoAccessToken: env.EXPO_ACCESS_TOKEN || undefined,
    intervalMs: env.NOTIFIER_INTERVAL_MS ?? 60_000,
    posthogKey: env.POSTHOG_KEY || undefined,
    posthogHost: env.POSTHOG_HOST || undefined,
  });
}
