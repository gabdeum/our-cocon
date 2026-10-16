import { defineProject } from 'vitest/config';
import { rnWebResolve, rnWebServerDeps } from '../../packages/ui/test/vitest-shared.mts';

// Components render through react-native-web, the V1 target (constitution I), as in packages/ui.
export default defineProject({
  resolve: rnWebResolve,
  define: { __DEV__: 'true' },
  test: { name: 'app', environment: 'jsdom', server: { deps: rnWebServerDeps } },
});
