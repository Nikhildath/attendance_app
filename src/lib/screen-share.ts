import { registerPlugin } from "@capacitor/core";

export interface ScreenFrame {
  data: string;
  width: number;
  height: number;
}

export interface ScreenSharePlugin {
  start(options: { width?: number; height?: number }): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: "screenFrame",
    listener: (frame: ScreenFrame) => void
  ): Promise<{ remove: () => void }>;
}

export const ScreenShare = registerPlugin<ScreenSharePlugin>("ScreenShare");
