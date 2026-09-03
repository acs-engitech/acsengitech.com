const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, 'js/index.js'),
  output: {
    path: path.resolve(__dirname, '..', 'admin'),
    publicPath: '/admin/',
    filename: 'assets/[name].[contenthash].js',
    clean: true,
  },
  module: {
    rules: [
      { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'] },
      { test: /\.(png|svg|jpe?g|gif|woff2?)$/, type: 'asset/resource', generator: { filename: 'assets/[hash][ext]' } },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'index.html'), filename: 'index.html', scriptLoading: 'defer' }),
    new MiniCssExtractPlugin({ filename: 'assets/[name].[contenthash].css' }),
  ],
};
