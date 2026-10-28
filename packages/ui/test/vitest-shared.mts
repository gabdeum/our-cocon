import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Shared by packages/ui and apps/app: render React Native components through react-native-web
// under Vitest, like Metro does on web.
const require = createRequire(import.meta.url);
const svgRoot = dirname(require.resolve('react-native-svg/package.json'));
const safeAreaRoot = dirname(require.resolve('react-native-safe-area-context/package.json'));

export const rnWebAlias = {
  'react-native-svg': join(svgRoot, 'lib/module/ReactNativeSVG.web.js'),
  'react-native-safe-area-context': join(safeAreaRoot, 'lib/module/index.js'),
  nativewind: join(dirname(fileURLToPath(import.meta.url)), 'nativewind.ts'),
  // React Native 0.88 dropped this package; react-native-svg's web build still imports it.
  '@react-native/assets-registry/registry': 'react-native-web/dist/modules/AssetRegistry',
  'react-native': 'react-native-web',
};

export const rnWebResolve = {
  alias: rnWebAlias,
  extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.mjs', '.js', '.json'],
};

export const rnWebServerDeps = { inline: [/react-native-svg/, /react-native-safe-area-context/] };
