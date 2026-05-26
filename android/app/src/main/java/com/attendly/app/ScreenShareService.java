package com.attendly.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

public class ScreenShareService extends Service {

  private static final String CHANNEL_ID = "screen_share";
  private static final int NOTIF_ID = 9002;

  @Override
  public void onCreate() {
    super.onCreate();
    createNotificationChannel();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    Notification notification =
      new NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("Screen Sharing")
        .setContentText("Recording your screen")
        .setSmallIcon(android.R.drawable.ic_menu_share)
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build();

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIF_ID, notification,
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
    } else {
      startForeground(NOTIF_ID, notification);
    }

    return START_NOT_STICKY;
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID,
        "Screen Share",
        NotificationManager.IMPORTANCE_LOW
      );
      channel.setDescription("Notification for screen sharing");
      NotificationManager manager = getSystemService(NotificationManager.class);
      if (manager != null) manager.createNotificationChannel(channel);
    }
  }
}
