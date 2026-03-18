package com.example.incidentreports;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * High-priority notification helper for emergency alerts.
 * Uses channel V21 to ensure settings are refreshed.
 */
public class NotificationHelper {
    private static final String TAG = "NotificationHelper";
    private static final String CHANNEL_ID = "EMERGENCY_ALERTS_SILENT_V22";
    private static final String CHANNEL_NAME = "Emergency Alerts";

    private final Context context;

    public NotificationHelper(Context context) {
        this.context = context.getApplicationContext();
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Critical incident assignments");
            channel.enableLights(true);
            channel.setLightColor(Color.RED);
            channel.enableVibration(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setBypassDnd(false);
            channel.setSound(null, null);

            manager.createNotificationChannel(channel);
        }
    }

    public void showNotification(String id, String title, String message) {
        showNotification(id, title, message, null);
    }

    public void showNotification(String id, String title, String message, String incidentId) {
        Log.d(TAG, "Displaying alert: " + title + " - " + message);

        Intent intent = new Intent(context, NotificationClickReceiver.class);
        intent.putExtra("incident_id", incidentId);
        
        int notificationId = resolveNotificationId(id);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 
                notificationId, 
                intent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.falling) // Updated icon to fallen
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setColor(Color.RED)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .setLights(Color.RED, 3000, 3000);

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(notificationId, builder.build());
        }
    }

    public void cancelNotification(String id) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(resolveNotificationId(id));
        }
    }

    private int resolveNotificationId(String id) {
        if (id != null && !id.trim().isEmpty()) {
            return id.hashCode();
        }
        return CHANNEL_ID.hashCode();
    }
}
