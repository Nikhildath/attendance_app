import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.attendly.app',
  appName: 'Attendly',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  android: {
    // Allow WebView to prompt for permissions (camera, mic)
    webContentsDebuggingEnabled: false,
    // Allow mixed content for WebRTC
    allowMixedContent: true,
  },
};

export default config;
