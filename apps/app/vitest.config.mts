import { defineProject } from 'vitest/config';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { rnWebResolve, rnWebServerDeps } from '../../packages/ui/test/vitest-shared.mts';

// NetInfo's ES-module build, inlined, so its `react-native` import resolves to react-native-web.
const netInfoRoot = dirname(createRequire(import.meta.url).resolve('@react-native-community/netinfo/package.json'));

// Components render through react-native-web, the V1 target (constitution I), as in packages/ui.
export default defineProject({
  resolve: { ...rnWebResolve, alias: { ...rnWebResolve.alias, '@react-native-community/netinfo': join(netInfoRoot, 'lib/module/index.js') } },
  define: { __DEV__: 'true' },
  // Screen tests click through whole flows; 5 s (Vitest's default) is too tight on a busy laptop.
  test: { name: 'app', environment: 'jsdom', testTimeout: 20_000, server: { deps: { inline: [...rnWebServerDeps.inline, /@react-native-community\/netinfo/] } } },
});
