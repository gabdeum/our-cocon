// NativeWind turns `className` into styles (spec 002). babel-preset-expo adds the Reanimated plugin.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
