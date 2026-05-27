package com.attendly.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;

import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class BackgroundTrackerService extends Service {
    private static final String CHANNEL_ID = "attendly_tracker_channel";
    private static final int NOTIFICATION_ID = 28352;
    private static final long DEFAULT_POST_INTERVAL_MS = 15_000L;
    private static final long RESTART_ALARM_INTERVAL_MS = 15_000L;
    private static final String ACTION_RESTART = "com.attendly.app.RESTART_TRACKER";

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private ExecutorService executor;
    private PowerManager.WakeLock wakeLock;
    private Handler mainHandler;

    private String userId;
    private String apiKey;
    private String serverUrl;
    private long minPostIntervalMs = DEFAULT_POST_INTERVAL_MS;
    private long lastPostTime = 0;
    private volatile boolean isTracking = false;
    private volatile boolean isDestroyed = false;
    public static boolean explicitlyStopped = false;

    @Override
    public void onCreate() {
        super.onCreate();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        executor = Executors.newSingleThreadExecutor();
        mainHandler = new Handler(Looper.getMainLooper());
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.hasExtra("userId")) {
            userId = intent.getStringExtra("userId");
            apiKey = intent.getStringExtra("apiKey");
            serverUrl = intent.getStringExtra("serverUrl");
            if (intent.hasExtra("minPostIntervalMs")) {
                minPostIntervalMs = intent.getLongExtra("minPostIntervalMs", DEFAULT_POST_INTERVAL_MS);
            }
        }

        if (!isTracking && userId != null && apiKey != null && serverUrl != null) {
            Notification notification = buildNotification();
            boolean started = false;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                } else {
                    startForeground(NOTIFICATION_ID, notification);
                }
                started = true;
            } catch (android.app.ForegroundServiceStartNotAllowedException e) {
                // Android 12+: foreground service not allowed from background (AlarmManager restart path)
                // Retry after a short delay so the OS allows it
                mainHandler.postDelayed(() -> {
                    if (isDestroyed) return;
                    Intent retryIntent = new Intent(this, BackgroundTrackerService.class);
                    retryIntent.putExtra("userId", userId);
                    retryIntent.putExtra("apiKey", apiKey);
                    retryIntent.putExtra("serverUrl", serverUrl);
                    retryIntent.putExtra("minPostIntervalMs", minPostIntervalMs);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(retryIntent);
                    } else {
                        startService(retryIntent);
                    }
                }, 2000);
            } catch (Exception e) {
                e.printStackTrace();
            }
            if (!started) return START_STICKY;

            acquireWakeLock();
            startLocationUpdates();
            scheduleRestartAlarm();
            isTracking = true;
        }

        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        scheduleRestartAlarm();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        isDestroyed = true;
        isTracking = false;
        stopLocationUpdates();
        releaseWakeLock();
        if (mainHandler != null) {
            mainHandler.removeCallbacksAndMessages(null);
        }
        if (!explicitlyStopped) {
            scheduleRestartAlarm();
        }
        if (executor != null && !executor.isShutdown()) {
            executor.shutdown();
        }
        super.onDestroy();
    }

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "attendly:location"
                );
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
        wakeLock = null;
    }

    private void scheduleRestartAlarm() {
        try {
            Intent restartIntent = new Intent(this, BackgroundTrackerService.class);
            restartIntent.putExtra("userId", userId);
            restartIntent.putExtra("apiKey", apiKey);
            restartIntent.putExtra("serverUrl", serverUrl);
            restartIntent.putExtra("minPostIntervalMs", minPostIntervalMs);

            int flags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
            PendingIntent pendingIntent = PendingIntent.getService(this, 0, restartIntent, flags);

            AlarmManager alarm = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (alarm != null) {
                // Use setAndAllowWhileIdle as fallback if setExactAndAllowWhileIdle requires
                // SCHEDULE_EXACT_ALARM permission (Android 12+) and permission is denied
                try {
                    alarm.setExactAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        SystemClock.elapsedRealtime() + RESTART_ALARM_INTERVAL_MS,
                        pendingIntent
                    );
                } catch (SecurityException e) {
                    // Missing SCHEDULE_EXACT_ALARM permission on Android 12+
                    alarm.setAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        SystemClock.elapsedRealtime() + RESTART_ALARM_INTERVAL_MS,
                        pendingIntent
                    );
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void cancelRestartAlarm() {
        try {
            Intent restartIntent = new Intent(this, BackgroundTrackerService.class);
            int flags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_NO_CREATE;
            PendingIntent pendingIntent = PendingIntent.getService(this, 0, restartIntent, flags);
            if (pendingIntent != null) {
                AlarmManager alarm = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                if (alarm != null) {
                    alarm.cancel(pendingIntent);
                }
                pendingIntent.cancel();
            }
        } catch (Exception ignored) {}
    }

    private void startLocationUpdates() {
        if (fusedLocationClient == null) return;

        // Use the modern Builder API (requires play-services-location 21+)
        LocationRequest locationRequest = new LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 10_000L
        )
                .setMinUpdateIntervalMillis(5_000L)
                .setWaitForAccurateLocation(false)
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                Location location = locationResult.getLastLocation();
                if (location != null) {
                    handleNewLocation(location);
                }
            }
        };

        try {
            fusedLocationClient.requestLocationUpdates(
                    locationRequest,
                    locationCallback,
                    Looper.getMainLooper() // must not be null on API 31+
            );
        } catch (SecurityException e) {
            e.printStackTrace();
        }
    }

    private void stopLocationUpdates() {
        if (fusedLocationClient != null && locationCallback != null) {
            try {
                fusedLocationClient.removeLocationUpdates(locationCallback);
            } catch (Exception ignored) {}
        }
        isTracking = false;
    }

    private void handleNewLocation(Location location) {
        long now = System.currentTimeMillis();
        if (now - lastPostTime < minPostIntervalMs) return;
        lastPostTime = now;

        double lat = location.getLatitude();
        double lng = location.getLongitude();
        float speed = location.hasSpeed() ? location.getSpeed() : 0;
        float accuracy = location.hasAccuracy() ? location.getAccuracy() : 0;

        executor.execute(() -> postLocationToServer(lat, lng, speed, accuracy));
    }

    private void postLocationToServer(double lat, double lng, float speed, float accuracy) {
        if (userId == null || apiKey == null || serverUrl == null) return;

        try {
            URL url = new URL(serverUrl.replaceAll("/+$", "") + "/api/location");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("x-api-key", apiKey);
            conn.setRequestProperty("x-user-id", userId);
            conn.setDoOutput(true);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);

            int batteryLevel = -1;
            try {
                android.content.IntentFilter ifilter = new android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED);
                android.content.Intent batteryStatus = registerReceiver(null, ifilter);
                if (batteryStatus != null) {
                    int level = batteryStatus.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1);
                    int scale = batteryStatus.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1);
                    if (level != -1 && scale != -1) {
                        batteryLevel = Math.round((level / (float) scale) * 100);
                    }
                }
            } catch (Exception ignored) {}

            String deviceInfo = android.os.Build.MODEL + " | Android " + android.os.Build.VERSION.RELEASE;

            JSONObject body = new JSONObject();
            body.put("userId", userId);
            body.put("lat", lat);
            body.put("lng", lng);
            body.put("speed", speed);
            body.put("accuracy", accuracy);
            body.put("battery", batteryLevel >= 0 ? batteryLevel : 0);
            body.put("task", "Background tracking");
            body.put("status", "active");
            body.put("deviceInfo", deviceInfo);

            OutputStream os = conn.getOutputStream();
            os.write(body.toString().getBytes("UTF-8"));
            os.close();

            int responseCode = conn.getResponseCode();
            conn.disconnect();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Location Tracking",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Notification for background location tracking");
            channel.enableLights(false);
            channel.enableVibration(false);
            channel.setSound(null, null);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Attendly Tracking")
                .setContentText("Location tracking active")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .build();
    }
}
