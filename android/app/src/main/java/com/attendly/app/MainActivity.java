package com.attendly.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    registerPlugin(MediaPermissionsPlugin.class);
    registerPlugin(ScreenSharePlugin.class);
    registerPlugin(BackgroundTrackerPlugin.class);
  }
}
