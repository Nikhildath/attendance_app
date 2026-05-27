package com.attendly.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
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
    @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
  }
)
public class MediaPermissionsPlugin extends Plugin {

  private boolean isPermissionGranted(String alias) {
    PermissionState state = getPermissionState(alias);
    if (state == PermissionState.GRANTED) {
      return true;
    }
    // Fallback: check Android system permission status directly
    if ("camera".equals(alias)) {
      return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    } else if ("microphone".equals(alias)) {
      return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }
    return false;
  }

  @PluginMethod
  public void check(PluginCall call) {
    JSObject result = new JSObject();
    boolean cameraGranted = isPermissionGranted("camera");
    boolean micGranted = isPermissionGranted("microphone");
    result.put("camera", cameraGranted);
    result.put("microphone", micGranted);
    result.put("allGranted", cameraGranted && micGranted);
    call.resolve(result);
  }

  @PluginMethod
  public void request(PluginCall call) {
    boolean cameraGranted = isPermissionGranted("camera");
    boolean micGranted = isPermissionGranted("microphone");

    if (cameraGranted && micGranted) {
      JSObject result = new JSObject();
      result.put("camera", true);
      result.put("microphone", true);
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
    boolean cameraGranted = isPermissionGranted("camera");
    boolean micGranted = isPermissionGranted("microphone");
    result.put("camera", cameraGranted);
    result.put("microphone", micGranted);
    result.put("allGranted", cameraGranted && micGranted);
    call.resolve(result);
  }
}
