/** Author: BinaryBeast1209 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@vladmandic/face-api' && platform === 'web') {
    return {
      filePath: path.resolve(
        __dirname,
        'node_modules/@vladmandic/face-api/dist/face-api.esm.js',
      ),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
