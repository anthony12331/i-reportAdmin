package com.example.incidentreports;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.wifi.WifiManager;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * High-reliability real-time service for incident monitoring.
 * Optimized for INSTANT notification delivery even when backgrounded.
 */
public class EmergencyPollingService extends Service {
    private static final String TAG = "EmergencyPollingService";
    
    public static final String ACTION_STOP_ALARM = "com.example.incidentreports.STOP_ALARM";
    public static final String ACTION_START_MONITOR = "com.example.incidentreports.START_MONITOR";
    
    private static final String CHANNEL_ID = "REALTIME_EMERGENCY_V15";
    private static final int NOTIFICATION_ID = 1001;

    private PocketBaseApiHelper apiHelper;
    private SessionManager sessionManager;
    private NotificationHelper notificationHelper;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private boolean isRunning = false;
    
    private final ExecutorService sseExecutor = Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService pollScheduler = Executors.newSingleThreadScheduledExecutor();
    private HttpURLConnection sseConnection;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private MediaPlayer mediaPlayer;
    
    private final Map<String, String> incidentStatusCache = new HashMap<>();

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
        
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "IncidentReports:RealtimeWakeLock");
            wakeLock.setReferenceCounted(false);
            if (!wakeLock.isHeld()) wakeLock.acquire(24 * 60 * 60 * 1000L); 
        }

        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null) {
            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "IncidentReports:WifiLock");
            wifiLock.setReferenceCounted(false);
            if (!wifiLock.isHeld()) wifiLock.acquire();
        }

        IntentFilter filter = new IntentFilter(ACTION_STOP_ALARM);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(controlReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(controlReceiver, filter);
        }

        isRunning = true;
        startInForeground();
        startRealtimeConnection();
        startFallbackPolling();
    }

    private void startInForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Critical Emergency Monitor", NotificationManager.IMPORTANCE_HIGH);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }

        Intent intent = new Intent(this, DashboardActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Emergency System: ACTIVE")
                .setContentText("Listening for real-time alerts...")
                .setSmallIcon(R.drawable.alert)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void startRealtimeConnection() {
        sseExecutor.execute(() -> {
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
                    sseConnection.setRequestProperty("Cache-Control", "no-cache");
                    sseConnection.setRequestProperty("Connection", "keep-alive");
                    sseConnection.setRequestProperty("Authorization", sessionManager.getToken());
                    sseConnection.setConnectTimeout(5000); 
                    sseConnection.setReadTimeout(60000); 
                    
                    if (sseConnection.getResponseCode() == 200) {
                        Log.d(TAG, "SSE: Real-time LINK ACTIVE");
                        mainHandler.post(this::syncIncidentStatus);
                        
                        BufferedReader reader = new BufferedReader(new InputStreamReader(sseConnection.getInputStream(), StandardCharsets.UTF_8));
                        String line;
                        while (isRunning && (line = reader.readLine()) != null) {
                            if (line.startsWith("data: ")) {
                                processRealtimeData(line.substring(6).trim());
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "SSE Link Lost: " + e.getMessage());
                } finally {
                    if (sseConnection != null) sseConnection.disconnect();
                    if (isRunning) SystemClock.sleep(2000); 
                }
            }
        });
    }

    private void startFallbackPolling() {
        pollScheduler.scheduleWithFixedDelay(() -> {
            try {
                if (isRunning && sessionManager.isLoggedIn()) {
                    syncIncidentStatus();
                    checkNewNotifications();
                }
            } catch (Exception e) { Log.e(TAG, "Poll Error", e); }
        }, 10, 10, TimeUnit.SECONDS); 
    }

    private void processRealtimeData(String data) {
        if (data.isEmpty()) return;
        try {
            JSONObject json = new JSONObject(data);
            if (json.has("clientId")) {
                subscribeToCollectionsSync(json.getString("clientId"));
            } else if (json.has("record")) {
                String collection = json.optString("collectionName", "");
                JSONObject record = json.getJSONObject("record");
                if (record != null && !"delete".equalsIgnoreCase(json.optString("action"))) {
                    if ("incident_reports".equals(collection)) handleIncidentRealtime(record);
                    else if ("notifications".equals(collection)) handleNotificationRealtime(record);
                }
            }
        } catch (Exception e) { Log.e(TAG, "Real-time Parse Error", e); }
    }

    private void subscribeToCollectionsSync(String clientId) {
        new Thread(() -> {
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
                Log.d(TAG, "SSE: Subscribed");
            } catch (Exception e) { Log.e(TAG, "Sub Error", e); }
        }).start();
    }

    private void handleIncidentRealtime(JSONObject record) {
        String id = record.optString("id", "");
        if (id.isEmpty() || sessionManager.isIncidentNotified(id)) return;

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

        if (assignedToMe) {
            Log.d(TAG, "INSTANT INCIDENT DETECTED: " + id);
            sessionManager.markIncidentAsNotified(id);
            playAlarmSound();
            mainHandler.post(() -> notificationHelper.showNotification(id, "REAL-TIME ALERT!", "New Task: " + record.optString("type")));
            createDbNotification(id, record.optString("type"), record.optString("users", ""));
            sendRefreshBroadcast();
        }
    }

    private void handleNotificationRealtime(JSONObject record) {
        String id = record.optString("id", "");
        if (id.isEmpty() || sessionManager.isDbNotificationNotified(id)) return;

        String responderId = record.optString("responder", "");
        String type = record.optString("type", "");
        if (sessionManager.getUserId().equals(responderId) && !record.optBoolean("is_read", false)) {
            if ("new_incident".equals(type) || "assignment".equalsIgnoreCase(type)) {
                sessionManager.markDbNotificationAsNotified(id);
                return;
            }
            sessionManager.markDbNotificationAsNotified(id);
            mainHandler.post(() -> notificationHelper.showNotification(id, record.optString("title", "Update"), record.optString("message", "")));
        }
    }

    private void syncIncidentStatus() {
        apiHelper.fetchAssignedIncidents(sessionManager.getToken(), sessionManager.getUserId(), new PocketBaseApiHelper.IncidentListCallback() {
            @Override
            public void onSuccess(List<IncidentReport> incidents) {
                for (IncidentReport incident : incidents) {
                    if (!sessionManager.isIncidentNotified(incident.getId())) {
                        sessionManager.markIncidentAsNotified(incident.getId());
                        playAlarmSound();
                        notificationHelper.showNotification(incident.getId(), "NEW TASK!", incident.getType());
                        createDbNotification(incident.getId(), incident.getType(), incident.getReporterId());
                        sendRefreshBroadcast();
                    }
                }
            }
            @Override public void onError(String msg) {}
        });
    }

    private void checkNewNotifications() {
        apiHelper.fetchNotifications(sessionManager.getToken(), sessionManager.getUserId(), new PocketBaseApiHelper.NotificationListCallback() {
            @Override
            public void onSuccess(List<NotificationItem> notifications) {
                for (NotificationItem item : notifications) {
                    if (!item.isRead() && !sessionManager.isDbNotificationNotified(item.getId())) {
                        if ("new_incident".equals(item.getType())) {
                            sessionManager.markDbNotificationAsNotified(item.getId());
                            continue;
                        }
                        sessionManager.markDbNotificationAsNotified(item.getId());
                        mainHandler.post(() -> notificationHelper.showNotification(item.getId(), item.getTitle(), item.getMessage()));
                    }
                }
            }
            @Override public void onError(String msg) {}
        });
    }

    private void createDbNotification(String incidentId, String incidentType, String reporterId) {
        apiHelper.createNotification(sessionManager.getToken(), sessionManager.getUserId(), reporterId, "New Task!", "Assigned: " + incidentType, "new_incident", new PocketBaseApiHelper.CreateCallback() {
            @Override
            public void onSuccess(String id) {
                sessionManager.markDbNotificationAsNotified(id);
            }
            @Override
            public void onError(String message) {}
        });
    }

    private void sendRefreshBroadcast() {
        Intent refreshIntent = new Intent("com.example.incidentreports.REFRESH_DASHBOARD");
        refreshIntent.setPackage(getPackageName());
        sendBroadcast(refreshIntent);
    }

    private void playAlarmSound() {
        mainHandler.post(() -> {
            try {
                if (mediaPlayer != null && mediaPlayer.isPlaying()) return;
                if (mediaPlayer != null) { mediaPlayer.release(); mediaPlayer = null; }
                mediaPlayer = MediaPlayer.create(this, R.raw.notification_sound);
                if (mediaPlayer != null) {
                    mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
                    mediaPlayer.setLooping(true);
                    mediaPlayer.start();
                }
            } catch (Exception e) { Log.e(TAG, "Audio Error", e); }
        });
    }

    private void stopAlarmSound() {
        mainHandler.post(() -> {
            if (mediaPlayer != null) {
                try { if (mediaPlayer.isPlaying()) mediaPlayer.stop(); } catch (Exception ignored) {}
                finally { mediaPlayer.release(); mediaPlayer = null; }
            }
        });
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startInForeground();
        if (intent != null && ACTION_STOP_ALARM.equals(intent.getAction())) {
            stopAlarmSound();
        }
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.d(TAG, "Task Removed! Scheduling restart...");
        Intent restartServiceIntent = new Intent(getApplicationContext(), this.getClass());
        restartServiceIntent.setPackage(getPackageName());
        PendingIntent restartServicePendingIntent = PendingIntent.getService(getApplicationContext(), 1, restartServiceIntent, PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager alarmService = (AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
        alarmService.set(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + 1000, restartServicePendingIntent);
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        stopAlarmSound();
        if (sseConnection != null) sseConnection.disconnect();
        sseExecutor.shutdown();
        pollScheduler.shutdown();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        super.onDestroy();
    }

    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
