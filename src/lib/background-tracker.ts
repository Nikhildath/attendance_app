import { registerPlugin, Capacitor } from "@capacitor/core";

interface BackgroundTrackerPlugin {
  start(options: {
    userId: string;
    apiKey: string;
    serverUrl: string;
    minPostIntervalMs?: number;
  }): Promise<void>;
  stop(): Promise<void>;
}

const BackgroundTracker = registerPlugin<BackgroundTrackerPlugin>("BackgroundTracker");

export async function startBackgroundTracker(config: {
  userId: string;
  apiKey: string;
  serverUrl: string;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await BackgroundTracker.start({
      userId: config.userId,
      apiKey: config.apiKey,
      serverUrl: config.serverUrl,
      minPostIntervalMs: 30_000,
    });
  } catch (err) {
    console.error("[BackgroundTracker] Failed to start:", err);
  }
}

export async function stopBackgroundTracker(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await BackgroundTracker.stop();
  } catch (err) {
    console.error("[BackgroundTracker] Failed to stop:", err);
  }
}
