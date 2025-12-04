const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// 只為 Web 平台添加 react-native-maps 的 mock
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: path.resolve(__dirname, 'react-native-maps-mock.js'),
      type: 'sourceFile',
    };
  }
  
  // 使用預設解析器
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;