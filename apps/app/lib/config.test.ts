import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const runtime = {
  env: 'staging',
  commit: '3f2a9c1d0e8b7a6f5e4d3c2b1a0f9e8d7c6b5a49',
  supabaseUrl: 'https://api-staging.ourcocon.com',
  supabaseAnonKey: 'anon',
  mcpUrl: 'https://mcp-staging.ourcocon.com',
  posthogKey: 'phc_test',
  posthogHost: 'https://eu.i.posthog.com',
};

describe('loadConfig', () => {
  it('reads the settings the web container writes', () => {
    expect(loadConfig(runtime)).toEqual(runtime);
  });

  it('rejects an unknown environment', () => {
    expect(() => loadConfig({ ...runtime, env: 'production' })).toThrow();
  });

  it('falls back to EXPO_PUBLIC_* variables in local dev', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'local-anon';
    expect(loadConfig(undefined)).toMatchObject({ env: 'local', commit: 'dev', supabaseUrl: 'http://127.0.0.1:54321', mcpUrl: 'http://localhost:8787' });
  });
});
