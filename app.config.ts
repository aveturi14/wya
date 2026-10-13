import { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the real config. A bundle ID belongs to one Apple team, so each
// of us builds to our own phone under our own ID: IOS_BUNDLE_ID=com.you.wya.dev
export default ({ config }: ConfigContext): ExpoConfig => {
  const bundleIdentifier = process.env.IOS_BUNDLE_ID;
  if (!bundleIdentifier) return config as ExpoConfig;
  return { ...config, ios: { ...config.ios, bundleIdentifier } } as ExpoConfig;
};
