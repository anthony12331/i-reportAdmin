package com.example.incidentreports;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.location.Address;
import android.location.Geocoder;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Foreground service that listens to PocketBase real-time events via SSE.
 * It triggers system notifications and plays an alarm sound on new incidents.
 */
public class NotificationService extends Service {
    private static final String TAG = "NotificationService";
    private static final String CHANNEL_ID = "INCIDENT_NOTIFICATION_CHANNEL";
    private static final int FOREGROUND_ID = 999;
    
    public static final String ACTION_STOP_ALARM = "com.example.incidentreports.STOP_ALARM";

    private PocketBaseApiHelper apiHelper;
    private SessionManager sessionManager;
    private NotificationHelper notificationHelper;
    
    private HttpURLConnection sseConnection;
    private final ExecutorService executorService = Executors.newFixedThreadPool(3);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private MediaPlayer mediaPlayer;
    private PowerManager.WakeLock wakeLock;
    private boolean isRunning = false;

    private final BroadcastReceiver controlReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (ACTION_STOP_ALARM.equals(intent.getAction())) {
                stopAlarmSound();
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        apiHelper = new PocketBaseApiHelper(this);
        sessionManager = new SessionManager(this);
        notificationHelper = new NotificationHelper(this);
        
        createNotificationChannel();
        startForeground(FOREGROUND_ID, createStickyNotification());

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "IncidentReports:NotificationWakeLock");
            wakeLock.acquire(10 * 60 * 1000L);
        }

        IntentFilter filter = new IntentFilter(ACTION_STOP_ALARM);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(controlReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(controlReceiver, filter);
        }

        isRunning = true;
        startSseListener();
    }

    private android.app.Notification createStickyNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Emergency Monitoring")
                .setContentText("Listening for real-time incident reports...")
                .setSmallIcon(R.drawable.alert)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
    }

    private void startSseListener() {
        executorService.execute(() -> {
            while (isRunning) {
                if (!sessionManager.isLoggedIn()) {
                    SystemClock.sleep(5000);
                    continue;
                }
                try {
                    Log.d(TAG, "SSE: Connecting...");
                    URL url = new URL(PocketBaseApiHelper.BASE_URL + "/api/realtime");
                    sseConnection = (HttpURLConnection) url.openConnection();
                    sseConnection.setRequestMethod("GET");
                    sseConnection.setRequestProperty("Accept", "text/event-stream");
                    sseConnection.setReadTimeout(0);
                    
                    if (sseConnection.getResponseCode() == 200) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(sseConnection.getInputStream()));
                        String line;
                        while (isRunning && (line = reader.readLine()) != null) {
                            if (line.startsWith("data: ")) {
                                processSseData(line.substring(6));
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "SSE Error: " + e.getMessage());
                    SystemClock.sleep(5000);
                } finally {
                    if (sseConnection != null) sseConnection.disconnect();
                }
            }
        });
    }

    private void processSseData(String data) {
        try {
            JSONObject json = new JSONObject(data);
            if (json.has("clientId")) {
                subscribeToCollections(json.getString("clientId"));
            } else if (json.has("record")) {
                String collection = json.optString("collectionName");
                JSONObject record = json.getJSONObject("record");
                
                if ("incident_reports".equals(collection)) {
                    handleIncidentUpdate(record);
                } else if ("notifications".equals(collection)) {
                    handleNotificationUpdate(record);
                }
            }
        } catch (Exception e) { Log.e(TAG, "SSE Data Parse Error", e); }
    }

    private void subscribeToCollections(String clientId) {
        executorService.execute(() -> {
            try {
                URL url = new URL(PocketBaseApiHelper.BASE_URL + "/api/realtime");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Authorization", sessionManager.getToken());
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                JSONObject body = new JSONObject();
                body.put("clientId", clientId);
                body.put("subscriptions", new JSONArray().put("incident_reports").put("notifications"));
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
                conn.getResponseCode();
                conn.disconnect();
            } catch (Exception e) { Log.e(TAG, "SSE Sub Error", e); }
        });
    }

    private void handleIncidentUpdate(JSONObject record) {
        String status = record.optString("status").toLowerCase();
        String id = record.optString("id");
        String myId = sessionManager.getUserId();
        
        boolean assignedToMe = false;
        Object responders = record.opt("responders");
        if (responders instanceof JSONArray) {
            JSONArray arr = (JSONArray) responders;
            for (int i = 0; i < arr.length(); i++) {
                if (myId.equals(arr.optString(i))) { assignedToMe = true; break; }
            }
        } else if (myId.equals(record.optString("responders"))) {
            assignedToMe = true;
        }

        if (assignedToMe && ("ongoing".equals(status) || "assigned".equals(status) || "pending".equals(status))) {
            if (!sessionManager.isIncidentNotified(id)) {
                IncidentReport incident = apiHelper.parseIncident(record);
                triggerIncidentAlert(incident);
                sessionManager.markIncidentAsNotified(id);
                broadcastStatus(true);
            }
        }
    }

    private void handleNotificationUpdate(JSONObject record) {
        String responder = record.optString("responder");
        if (sessionManager.getUserId().equals(responder) && !record.optBoolean("is_read")) {
            NotificationItem item = new NotificationItem(
                    record.optString("id"),
                    record.optString("title"),
                    record.optString("message"),
                    record.optString("type"),
                    false,
                    record.optString("created")
            );
            handler.post(() -> showSystemNotificationFromDb(item));
        }
    }

    private void broadcastStatus(boolean hasNew) {
        Intent intent = new Intent("com.example.incidentreports.REFRESH_DASHBOARD");
        intent.putExtra("has_new", hasNew);
        sendBroadcast(intent);
    }

    private void triggerIncidentAlert(IncidentReport incident) {
        String addressStr = incident.getAddress();
        if (addressStr == null || addressStr.trim().isEmpty()) {
            addressStr = "Location: " + incident.getLatitude() + ", " + incident.getLongitude();
        }
        
        final String displayAddress = addressStr;
        
        handler.post(() -> {
            showSystemNotification(incident, displayAddress);
            playAlarmSound();
            bringAppToDashboard();
        });

        executorService.execute(() -> {
            String betterAddress = getAddressFromLocation(incident.getLatitude(), incident.getLongitude());
            final String finalAddress = (betterAddress != null && !betterAddress.isEmpty()) ? betterAddress : displayAddress;
            
            if (betterAddress != null && !betterAddress.equals(displayAddress)) {
                handler.post(() -> showSystemNotification(incident, betterAddress));
            }
            
            handler.post(() -> {
                String title = "New Assignment!";
                String message = incident.getType() + " reported at " + finalAddress;
                apiHelper.createNotification(sessionManager.getToken(), sessionManager.getUserId(), incident.getReporterId(), title, message, "new_incident", new PocketBaseApiHelper.CreateCallback() {
                    @Override public void onSuccess(String id) { 
                        sessionManager.markDbNotificationAsNotified(id); 
                    }
                    @Override public void onError(String msg) {
                        Log.e(TAG, "Failed to create DB notification record: " + msg);
                    }
                });
            });
        });
    }

    private void bringAppToDashboard() {
        try {
            Intent dashIntent = new Intent(this, DashboardActivity.class);
            dashIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(dashIntent);
        } catch (Exception e) {
            Log.e(TAG, "App foreground bring failed (System restriction).");
        }
    }

    private String getAddressFromLocation(String latStr, String lonStr) {
        if (latStr == null || lonStr == null || latStr.isEmpty() || lonStr.isEmpty()) return null;
        try {
            double lat = Double.parseDouble(latStr);
            double lon = Double.parseDouble(lonStr);
            
            if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                return null;
            }

            Geocoder geocoder = new Geocoder(this, Locale.getDefault());
            List<Address> addresses = geocoder.getFromLocation(lat, lon, 1);
            if (addresses != null && !addresses.isEmpty()) return addresses.get(0).getAddressLine(0);
        } catch (Exception e) { Log.e(TAG, "Geocoding failed", e); }
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Incident Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.enableVibration(true);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private void showSystemNotification(IncidentReport incident, String address) {
        Intent intent = new Intent(this, DashboardActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, (int)System.currentTimeMillis(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.alert)
                .setContentTitle("CRITICAL: NEW TASK!")
                .setContentText(incident.getType() + " - " + address)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setFullScreenIntent(pendingIntent, true) 
                .setContentIntent(pendingIntent);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify((int) System.currentTimeMillis(), builder.build());
    }

    private void showSystemNotificationFromDb(NotificationItem dbNotification) {
        Intent intent = new Intent(this, DashboardActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, (int) System.currentTimeMillis(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.alert)
                .setContentTitle(dbNotification.getTitle())
                .setContentText(dbNotification.getMessage())
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setFullScreenIntent(pendingIntent, true)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify((int) System.currentTimeMillis(), builder.build());
        
        if ("new_incident".equals(dbNotification.getType())) {
            playAlarmSound();
            bringAppToDashboard();
        }
    }

    private void playAlarmSound() {
        if (mediaPlayer != null && mediaPlayer.isPlaying()) return;
        try {
            if (mediaPlayer != null) mediaPlayer.release();
            mediaPlayer = MediaPlayer.create(this, R.raw.notification_sound);
            mediaPlayer.setLooping(true);
            mediaPlayer.start();
        } catch (Exception e) { Log.e(TAG, "Sound Playback Error", e); }
    }

    private void stopAlarmSound() {
        if (mediaPlayer != null) {
            try { if (mediaPlayer.isPlaying()) mediaPlayer.stop(); } catch (Exception e) {}
            mediaPlayer.release();
            mediaPlayer = null;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP_ALARM.equals(intent.getAction())) stopAlarmSound();
        broadcastStatus(true);
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Ensure service restarts if swiped away
        Intent restartServiceIntent = new Intent(getApplicationContext(), RestartReceiver.class);
        PendingIntent restartServicePendingIntent = PendingIntent.getBroadcast(getApplicationContext(), 1, restartServiceIntent, PendingIntent.FLAG_IMMUTABLE);
        AlarmManager alarmService = (AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
        if (alarmService != null) {
            alarmService.set(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + 1000, restartServicePendingIntent);
        }
        super.onTaskRemoved(rootIntent);
    }

    @Nullable @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (sseConnection != null) sseConnection.disconnect();
        executorService.shutdown();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }
}
