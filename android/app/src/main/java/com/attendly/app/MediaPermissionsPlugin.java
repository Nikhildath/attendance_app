package com.attendly.app;

import android.Manifest;

import com.getcapacitor.JSObject;
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
  }
)
public class MediaPermissionsPlugin extends Plugin {

  @PluginMethod
  public void check(PluginCall call) {
    JSObject result = new JSObject();
    result.put("camera", hasPermission(Manifest.permission.CAMERA));
    result.put("microphone", hasPermission(Manifest.permission.RECORD_AUDIO));
    result.put("allGranted", hasRequiredPermissions());
    call.resolve(result);
  }

  @PluginMethod
  public void request(PluginCall call) {
    if (hasRequiredPermissions()) {
      JSObject result = new JSObject();
      result.put("allGranted", true);
      call.resolve(result);
      return;
    }
    requestAllPermissions(call, "permissionResult");
  }

  @PermissionCallback
  private void permissionResult(PluginCall call) {
    JSObject result = new JSObject();
    result.put("camera", hasPermission(Manifest.permission.CAMERA));
    result.put("microphone", hasPermission(Manifest.permission.RECORD_AUDIO));
    result.put("allGranted", hasRequiredPermissions());
    call.resolve(result);
  }
}
