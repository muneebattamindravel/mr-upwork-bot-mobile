export default ({ config }) => ({
  ...config,
  name: 'MRUpworkBot',
  slug: 'mr-upwork-bot-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#7e22ce',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.mindravel.mrupworkbot',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#7e22ce',
    },
    package: 'com.mindravel.mrupworkbot',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  scheme: 'mr-upwork-bot',
  plugins: [
    'expo-router',
    'expo-secure-store',
  ],
  extra: {
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    eas: {
      projectId: 'mr-upwork-bot-mobile',
    },
  },
});
