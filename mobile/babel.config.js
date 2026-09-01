module.exports = function (api) {
  api.cache(true)

  return {
    // babel-preset-expo already wires the worklets plugin for Reanimated.
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  }
}
