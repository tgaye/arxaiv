// webpack.renderer.config.js

const rules = require('./webpack.rules');
const plugins = require('./webpack.plugins.config.js');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
  entry: './src/renderer/index.js',
  module: {
    rules: [
      ...rules,
      // PDF.js worker loader
      {
        test: /pdf\.worker(\.min)?\.js$/,
        use: {
          loader: 'worker-loader',
          options: {
            filename: '[name].[contenthash].worker.js'
          }
        }
      }
    ]
  },
  plugins: [
    ...plugins,
    new MonacoWebpackPlugin({
      languages: ['javascript', 'typescript', 'json', 'html', 'css', 'python', 'cpp', 'xml', 'markdown'],
      filename: 'monaco/[name].[contenthash].worker.js'
    })
  ],
  resolve: {
    extensions: ['.js', '.jsx', '.css'],
    fallback: {
      path: require.resolve('path-browserify'),
      fs: false
    }
  },
  devServer: {
    hot: true,
    liveReload: true,
    client: false,
    overlay: false,
  }
};
