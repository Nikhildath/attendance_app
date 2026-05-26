import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.attendly.app',
  appName: 'Attendly',
  webDir: 'dist',
  android: {
    useLegacyBridge: true,
  },
};

export default config;
