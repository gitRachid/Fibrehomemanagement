module.exports = ({ config }) => {
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const plugins = config.plugins || [];
  const pluginsWithoutMaps = plugins.filter((plugin) => {
    return !(Array.isArray(plugin) ? plugin[0] === 'react-native-maps' : plugin === 'react-native-maps');
  });

  return {
    ...config,
    plugins: [
      ...pluginsWithoutMaps,
      ...(googleMapsApiKey
        ? [
            [
              'react-native-maps',
              {
                androidGoogleMapsApiKey: googleMapsApiKey,
              },
            ],
          ]
        : []),
    ],
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        ...(googleMapsApiKey
          ? {
              googleMaps: {
                apiKey: googleMapsApiKey,
              },
            }
          : {}),
      },
    },
  };
};
