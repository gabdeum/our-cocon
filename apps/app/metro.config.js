const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// packages/ui installs its own copies of its peers (React, React Native, NativeWind) for its tests.
// The app bundle must use the app's copy of each: on iOS, NativeWind's styles live in one copy, and
// UI components reading another get no styles at all.
const packagesDir = path.resolve(__dirname, '../../packages');
const peers = new Set(Object.keys(require('../../packages/ui/package.json').peerDependencies));
const fromApp = path.join(__dirname, 'package.json');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const name = moduleName.split('/').slice(0, moduleName.startsWith('@') ? 2 : 1).join('/');
  const fromPackages = context.originModulePath.startsWith(packagesDir) && !context.originModulePath.includes('node_modules');
  if (fromPackages && peers.has(name)) return context.resolveRequest({ ...context, originModulePath: fromApp }, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
