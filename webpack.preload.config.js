// webpack.preload.config.js
module.exports = {
    entry: './src/preload/preload.js',
    target: 'electron-preload',
    module: {
      rules: require('./webpack.rules'),
    },
    output: {
      filename: 'preload.js'
    }
  };