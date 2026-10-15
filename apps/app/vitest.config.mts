import { defineProject } from 'vitest/config';

// Components render through react-native-web, the V1 target (constitution I).
export default defineProject({
  resolve: { alias: { 'react-native': 'react-native-web' } },
  define: { __DEV__: 'true' },
  test: { name: 'app', environment: 'jsdom' },
});
