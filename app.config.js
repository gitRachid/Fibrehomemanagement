const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const withHttpNetworkSecurity = (config) => {
  config = withAndroidManifest(config, (modConfig) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(modConfig.modResults);
    mainApplication.$['android:usesCleartextTraffic'] = 'true';
    mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return modConfig;
  });

  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      const xmlDir = path.join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">94.177.204.65</domain>
  </domain-config>
</network-security-config>
`,
      );
      return modConfig;
    },
  ]);
};

module.exports = ({ config }) => {
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const plugins = config.plugins || [];
  const pluginsWithoutMaps = plugins.filter((plugin) => {
    return !(Array.isArray(plugin) ? plugin[0] === 'react-native-maps' : plugin === 'react-native-maps');
  });
  const pluginsWithoutNativePickers = pluginsWithoutMaps.filter((plugin) => {
    return !(Array.isArray(plugin) ? plugin[0] === '@react-native-community/datetimepicker' : plugin === '@react-native-community/datetimepicker');
  });

  return {
    ...config,
    plugins: [
      withHttpNetworkSecurity,
      ...pluginsWithoutNativePickers,
      '@react-native-community/datetimepicker',
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
