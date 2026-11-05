import { defineProject } from 'vitest/config';
import { rnWebResolve, rnWebServerDeps } from './test/vitest-shared.mts';

// Components render through react-native-web, the V1 target (constitution I).
export default defineProject({
  resolve: rnWebResolve,
  define: { __DEV__: 'true' },
  // Same 20 s as apps/app: 5 s (Vitest's default) is too tight on a busy laptop.
  test: { name: 'ui', environment: 'jsdom', testTimeout: 20_000, server: { deps: rnWebServerDeps } },
});
