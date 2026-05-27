package com.attendly.app;

import android.Manifest;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
  name = "MediaPermissions",
  permissions = {
    @Permission(strings = { Manifest.permission.CAMERA }, alias = "camera"),
    @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone"),
    @Permission(strings = { Manifest.permission.MODIFY_AUDIO_SETTINGS }, alias = "audio"),
    @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetooth")
  }
)
public class MediaPermissionsPlugin extends Plugin {

  @PluginMethod
  public void check(PluginCall call) {
    JSObject result = new JSObject();
    boolean cameraGranted = getPermissionState("camera") == PermissionState.GRANTED;
    boolean micGranted = getPermissionState("microphone") == PermissionState.GRANTED;
    boolean audioGranted = getPermissionState("audio") == PermissionState.GRANTED;
    result.put("camera", cameraGranted);
    result.put("microphone", micGranted);
    result.put("audio", audioGranted);
    result.put("allGranted", cameraGranted && micGranted);
    call.resolve(result);
  }

  @PluginMethod
  public void request(PluginCall call) {
    boolean cameraGranted = getPermissionState("camera") == PermissionState.GRANTED;
    boolean micGranted = getPermissionState("microphone") == PermissionState.GRANTED;
    boolean audioGranted = getPermissionState("audio") == PermissionState.GRANTED;

    if (cameraGranted && micGranted && audioGranted) {
      JSObject result = new JSObject();
      result.put("camera", true);
      result.put("microphone", true);
      result.put("audio", true);
      result.put("allGranted", true);
      call.resolve(result);
      return;
    }

    // Request all permissions that are not yet granted
    requestAllPermissions(call, "permissionResult");
  }

  @PermissionCallback
  private void permissionResult(PluginCall call) {
    JSObject result = new JSObject();
    boolean cameraGranted = getPermissionState("camera") == PermissionState.GRANTED;
    boolean micGranted = getPermissionState("microphone") == PermissionState.GRANTED;
    boolean audioGranted = getPermissionState("audio") == PermissionState.GRANTED;
    result.put("camera", cameraGranted);
    result.put("microphone", micGranted);
    result.put("audio", audioGranted);
    result.put("allGranted", cameraGranted && micGranted);
    call.resolve(result);
  }
}
