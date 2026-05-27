package com.attendly.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

  private static final int MEDIA_PERMISSION_REQUEST_CODE = 1001;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Register custom Capacitor plugins
    registerPlugin(MediaPermissionsPlugin.class);
    registerPlugin(ScreenSharePlugin.class);
    registerPlugin(BackgroundTrackerPlugin.class);

    // Request runtime permissions upfront for camera, microphone, location, and notifications
    requestAppPermissionsIfNeeded();

    // Override the WebChromeClient using BridgeWebChromeClient to auto-grant WebRTC permission requests
    // while preserving all standard Capacitor bridge functionality (e.g. file picking, alerts).
    WebView webView = this.bridge.getWebView();
    webView.setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
      @Override
      public void onPermissionRequest(final PermissionRequest request) {
        // Auto-grant camera/mic WebRTC permissions to the WebView synchronously on the UI thread
        String[] resources = request.getResources();
        List<String> grantedResources = new ArrayList<>();

        for (String resource : resources) {
          if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
            if (ContextCompat.checkSelfPermission(MainActivity.this,
                Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
              grantedResources.add(resource);
            }
          } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
            if (ContextCompat.checkSelfPermission(MainActivity.this,
                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
              grantedResources.add(resource);
            }
          } else {
            // Grant other resources (e.g. protected media)
            grantedResources.add(resource);
          }
        }

        if (!grantedResources.isEmpty()) {
          request.grant(grantedResources.toArray(new String[0]));
        } else {
          request.deny();
        }
      }
    });
  }

  /**
   * Request necessary app permissions upfront (camera, microphone, location, notifications).
   * This ensures that web and background tracking features have runtime permissions immediately.
   */
  private void requestAppPermissionsIfNeeded() {
    List<String> permissionsToRequest = new ArrayList<>();

    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
        != PackageManager.PERMISSION_GRANTED) {
      permissionsToRequest.add(Manifest.permission.CAMERA);
    }

    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
        != PackageManager.PERMISSION_GRANTED) {
      permissionsToRequest.add(Manifest.permission.RECORD_AUDIO);
    }

    if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        != PackageManager.PERMISSION_GRANTED) {
      permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION);
    }

    if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
        != PackageManager.PERMISSION_GRANTED) {
      permissionsToRequest.add(Manifest.permission.ACCESS_COARSE_LOCATION);
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
          != PackageManager.PERMISSION_GRANTED) {
        permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS);
      }
    }

    if (!permissionsToRequest.isEmpty()) {
      ActivityCompat.requestPermissions(this,
          permissionsToRequest.toArray(new String[0]),
          MEDIA_PERMISSION_REQUEST_CODE);
    }
  }
}






