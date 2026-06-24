const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Workaround for React 19 + Expo 54 URL protocol issue
config.resolver = {
    ...config.resolver,
    sourceExts: [...(config.resolver?.sourceExts || []), 'jsx', 'js', 'ts', 'tsx'],
};

// Disable require cycles which can cause issues with React 19
config.transformer = {
    ...config.transformer,
    getTransformOptions: async () => ({
        transform: {
            experimentalImportSupport: false,
            inlineRequires: false,
        },
    }),
};

module.exports = config;