// webpack.renderer.config.js
const rules = require('./webpack.rules');
const plugins = require('./webpack.plugins.config.js');

module.exports = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.jsx', '.css'],
    fallback: {
      "path": require.resolve("path-browserify")
    }
  },
  devServer: {
    hot: true,
    liveReload: true
  }
};