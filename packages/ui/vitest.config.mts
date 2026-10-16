import { defineProject } from 'vitest/config';
import { rnWebResolve, rnWebServerDeps } from './test/vitest-shared.mts';

// Components render through react-native-web, the V1 target (constitution I).
export default defineProject({
  resolve: rnWebResolve,
  define: { __DEV__: 'true' },
  test: { name: 'ui', environment: 'jsdom', server: { deps: rnWebServerDeps } },
});
