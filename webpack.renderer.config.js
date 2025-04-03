const rules = require('./webpack.rules');
const plugins = require('./webpack.plugins.config.js');

module.exports = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.jsx', '.css'],
  },
  devServer: {
    hot: true,
    liveReload: true
  }
};