const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

// Operations platform bundle: served for /ops/*, /portal/* and /admin/command (see vercel.json rewrites).
module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, 'js/index.js'),
  output: {
    path: path.resolve(__dirname, '..', 'ops'),
    publicPath: '/ops/',
    filename: 'assets/[name].[contenthash].js',
    clean: true,
  },
  module: {
    rules: [
      { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'] },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'index.html'), filename: 'index.html', scriptLoading: 'defer' }),
    new MiniCssExtractPlugin({ filename: 'assets/[name].[contenthash].css' }),
  ],
};
