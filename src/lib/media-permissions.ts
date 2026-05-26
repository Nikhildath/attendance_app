import { registerPlugin } from "@capacitor/core";

export interface PermissionStatus {
  camera: boolean;
  microphone: boolean;
  allGranted: boolean;
}

export interface MediaPermissionsPlugin {
  check(): Promise<PermissionStatus>;
  request(): Promise<PermissionStatus>;
}

export const MediaPermissions = registerPlugin<MediaPermissionsPlugin>("MediaPermissions");
