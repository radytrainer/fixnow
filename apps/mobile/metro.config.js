// Metro config: watch the shared package that lives outside this app folder.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const sharedDir = path.resolve(__dirname, '../../packages/shared');
config.watchFolders = [...(config.watchFolders ?? []), sharedDir];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
module.exports = config;
