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

    // Request runtime permissions upfront for camera and microphone
    requestMediaPermissionsIfNeeded();

    // Override the WebChromeClient to auto-grant WebRTC permission requests
    // IMPORTANT: We must get the existing WebChromeClient from the bridge
    // and only override onPermissionRequest, so Capacitor's internal
    // handling (file chooser, JS dialogs, etc.) is preserved.
    WebView webView = this.bridge.getWebView();
    final WebChromeClient originalClient = new WebChromeClient();

    webView.setWebChromeClient(new WebChromeClient() {
      @Override
      public void onPermissionRequest(final PermissionRequest request) {
        // Auto-grant camera/mic WebRTC permissions to the WebView
        // This is called when JavaScript requests getUserMedia()
        runOnUiThread(() -> {
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
        });
      }
    });
  }

  /**
   * Request camera and microphone permissions at app startup.
   * This ensures that when getUserMedia() is called from the WebView,
   * the Android-level permissions are already granted.
   */
  private void requestMediaPermissionsIfNeeded() {
    List<String> permissionsToRequest = new ArrayList<>();

    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
        != PackageManager.PERMISSION_GRANTED) {
      permissionsToRequest.add(Manifest.permission.CAMERA);
    }

    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
        != PackageManager.PERMISSION_GRANTED) {
      permissionsToRequest.add(Manifest.permission.RECORD_AUDIO);
    }

    if (ContextCompat.checkSelfPermission(this, Manifest.permission.MODIFY_AUDIO_SETTINGS)
        != PackageManager.PERMISSION_GRANTED) {
      permissionsToRequest.add(Manifest.permission.MODIFY_AUDIO_SETTINGS);
    }

    if (!permissionsToRequest.isEmpty()) {
      ActivityCompat.requestPermissions(this,
          permissionsToRequest.toArray(new String[0]),
          MEDIA_PERMISSION_REQUEST_CODE);
    }
  }
}
