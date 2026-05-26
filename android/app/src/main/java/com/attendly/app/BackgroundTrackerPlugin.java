package com.attendly.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundTracker")
public class BackgroundTrackerPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        String userId = call.getString("userId");
        String apiKey = call.getString("apiKey");
        String serverUrl = call.getString("serverUrl");

        if (userId == null || apiKey == null || serverUrl == null) {
            call.reject("userId, apiKey, and serverUrl are required");
            return;
        }

        Intent intent = new Intent(getContext(), BackgroundTrackerService.class);
        intent.putExtra("userId", userId);
        intent.putExtra("apiKey", apiKey);
        intent.putExtra("serverUrl", serverUrl);

        if (call.getData().has("minPostIntervalMs")) {
            Long interval = call.getLong("minPostIntervalMs");
            if (interval != null) {
                intent.putExtra("minPostIntervalMs", interval);
            }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start background tracker: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), BackgroundTrackerService.class);
            getContext().stopService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to stop background tracker: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            // Fallback: open general battery optimization settings
            try {
                Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                getActivity().startActivity(fallback);
                call.resolve();
            } catch (Exception e2) {
                call.reject("Failed to open battery optimization settings: " + e2.getMessage());
            }
        }
    }
}
