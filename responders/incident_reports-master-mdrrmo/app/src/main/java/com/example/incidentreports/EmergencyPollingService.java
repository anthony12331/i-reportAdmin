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
import android.location.Address;
import android.location.Geocoder;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class EmergencyPollingService extends Service {
    public static final String ACTION_START_ALARM = "com.example.incidentreports.START_ALARM";
    private static final String TAG = "EmergencyPollingService";
    public static final String ACTION_STOP_ALARM = "com.example.incidentreports.STOP_ALARM";
    public static final String REFRESH_ACTION = "com.example.incidentreports.REFRESH_DASHBOARD";
    public static final String NEW_TASK_ACTION = "com.example.incidentreports.NEW_TASK_ASSIGNED";
    private static final String REALTIME_DISCONNECT_EVENT = "PB_DISCONNECT";
    private static final long FALLBACK_POLL_INITIAL_DELAY_SECONDS = 1L;
    private static final long FALLBACK_POLL_INTERVAL_SECONDS = 1L;
    private static final String[] REALTIME_SUBSCRIPTIONS = {
            "incident_reports/*",
            "notifications/*"
    };
    
    private static final String CHANNEL_ID = "EMERGENCY_MONITOR_V17";
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
    
    private ConnectivityManager.NetworkCallback networkCallback;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service onCreate");
        apiHelper = new PocketBaseApiHelper(this);
        sessionManager = new SessionManager(this);
        notificationHelper = new NotificationHelper(this);
        
        acquireLocks();
        registerControlReceiver();
        setupNetworkMonitoring();

        isRunning = true;
        startInForeground();
        startRealtimeConnection();
        startFallbackPolling();
    }

    private void acquireLocks() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "IncidentReports:RealtimeWakeLock");
            if (!wakeLock.isHeld()) wakeLock.acquire(24 * 60 * 60 * 1000L); 
        }

        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null) {
            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "IncidentReports:WifiLock");
            if (!wifiLock.isHeld()) wifiLock.acquire();
        }
    }

    private void registerControlReceiver() {
        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_STOP_ALARM);
        filter.addAction(ACTION_START_ALARM);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(controlReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(controlReceiver, filter);
        }
    }

    private final BroadcastReceiver controlReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (ACTION_STOP_ALARM.equals(intent.getAction())) {
                stopAlarmSound();
            } else if (ACTION_START_ALARM.equals(intent.getAction())) {
                startAlarmSound();
            }
        }
    };

    private void setupNetworkMonitoring() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) {
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(@NonNull Network network) {
                    Log.d(TAG, "Network restored. Force reconnecting SSE...");
                    restartSSE();
                }
            };
            cm.registerNetworkCallback(new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build(), networkCallback);
        }
    }

    private void restartSSE() {
        new Thread(() -> {
            if (sseConnection != null) {
                try { sseConnection.disconnect(); } catch (Exception ignored) {}
            }
        }).start();
    }

    private void startInForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Emergency Service Status", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
        updateForegroundNotification("Waiting for alerts...");
    }

    private void updateForegroundNotification(String status) {
        Intent intent = new Intent(this, DashboardActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String time = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Emergency System: ACTIVE")
                .setContentText(status + " | " + time)
                .setSmallIcon(R.drawable.alert)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
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
                    Log.d(TAG, "SSE: Connecting to " + PocketBaseApiHelper.BASE_URL);
                    URL url = new URL(PocketBaseApiHelper.BASE_URL + "/api/realtime");
                    sseConnection = (HttpURLConnection) url.openConnection();
                    sseConnection.setRequestMethod("GET");
                    sseConnection.setRequestProperty("Accept", "text/event-stream");
                    sseConnection.setRequestProperty("Authorization", sessionManager.getToken());
                    sseConnection.setRequestProperty("Cache-Control", "no-cache");
                    sseConnection.setConnectTimeout(10000);
                    sseConnection.setReadTimeout(0); 
                    
                    int responseCode = sseConnection.getResponseCode();
                    if (responseCode == 200) {
                        Log.d(TAG, "SSE: Connected!");
                        mainHandler.post(() -> updateForegroundNotification("Real-time link active"));
                        
                        // Check for missed alerts
                        syncIncidentStatus();
                        syncDbNotifications(); 
                        
                        BufferedReader reader = new BufferedReader(new InputStreamReader(sseConnection.getInputStream(), StandardCharsets.UTF_8));
                        String line;
                        String currentEvent = "";
                        while (isRunning && (line = reader.readLine()) != null) {
                            if (line.startsWith("event: ")) {
                                currentEvent = line.substring(7).trim();
                            } else if (line.startsWith("data: ")) {
                                String data = line.substring(6).trim();
                                if (!data.isEmpty() && !data.equals("{}")) {
                                    processRealtimeData(currentEvent, data);
                                }
                            }
                        }
                    } else {
                        Log.e(TAG, "SSE Failed: " + responseCode);
                        mainHandler.post(() -> updateForegroundNotification("Connection error: " + responseCode));
                    }
                } catch (Exception e) {
                    Log.e(TAG, "SSE Link Error: " + e.getMessage());
                } finally {
                    if (sseConnection != null) sseConnection.disconnect();
                    if (isRunning) SystemClock.sleep(5000); 
                }
            }
        });
    }

    private void processRealtimeData(String eventType, String data) {
        try {
            JSONObject json = new JSONObject(data);
            if (json.has("clientId")) {
                subscribeToCollectionsSync(json.getString("clientId"));
            } else if (REALTIME_DISCONNECT_EVENT.equalsIgnoreCase(eventType)) {
                Log.d(TAG, "PocketBase requested realtime reconnect.");
                restartSSE();
            } else if (json.has("record")) {
                String collection = normalizeCollectionName(json.optString("collectionName", eventType));
                JSONObject record = json.getJSONObject("record");
                
                if ("incident_reports".equals(collection)) handleIncidentRealtime(record);
                else if ("notifications".equals(collection)) handleNotificationRealtime(record);
            }
        } catch (Exception e) { Log.e(TAG, "Parse error: " + e.getMessage()); }
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
                JSONArray subscriptions = new JSONArray();
                for (String subscription : REALTIME_SUBSCRIPTIONS) {
                    subscriptions.put(subscription);
                }
                body.put("subscriptions", subscriptions);
                try (java.io.OutputStream os = conn.getOutputStream()) {
                    os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
                int code = conn.getResponseCode();
                if (code == 204 || code == 200) {
                    Log.d(TAG, "SSE: Subscriptions successful");
                    mainHandler.post(() -> updateForegroundNotification("Real-time notifications active"));
                }
                conn.disconnect();
            } catch (Exception e) { Log.e(TAG, "Sub error: " + e.getMessage()); }
        }).start();
    }

    private String normalizeCollectionName(String collectionName) {
        if (collectionName == null) {
            return "";
        }
        int separatorIndex = collectionName.indexOf('/');
        if (separatorIndex >= 0) {
            return collectionName.substring(0, separatorIndex);
        }
        return collectionName;
    }

    private void handleIncidentRealtime(JSONObject record) {
        String id = record.optString("id");
        if (id.isEmpty()) return;

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
            String status = record.optString("status");
            if ("Pending".equalsIgnoreCase(status) || "Ongoing".equalsIgnoreCase(status)) {
                if (!sessionManager.markIncidentAsNotified(id)) {
                    Log.d(TAG, "Skipping duplicate incident alert for " + id);
                    return;
                }
                createDbNotificationForIncident(record);
                triggerEmergencyAlert(record);
            }
        }
    }

    private void createDbNotificationForIncident(JSONObject incident) {
        String incidentId = incident.optString("id");
        if (incidentId.isEmpty()) {
            return;
        }
        if (!sessionManager.markIncidentDbNotificationCreated(incidentId)) {
            Log.d(TAG, "Skipping duplicate DB notification for incident: " + incidentId);
            return;
        }

        String address = resolveIncidentAddress(incident);
        String title = "New Assignment!";
        String message = incident.optString("type", "Emergency") + " reported at " + address;
        String notificationType = buildIncidentNotificationType(incidentId);
        
        apiHelper.createNotification(
            sessionManager.getToken(),
            sessionManager.getUserId(),
            incident.optString("users", ""), 
            title,
            message,
            notificationType,
            new PocketBaseApiHelper.CreateCallback() {
                @Override
                public void onSuccess(String id) {
                    Log.d(TAG, "Database notification created for incident: " + id);
                    broadcastRefresh();
                }
                @Override
                public void onError(String message) {
                    Log.e(TAG, "Failed to create DB notification: " + message);
                }
            }
        );
    }

    private void handleNotificationRealtime(JSONObject record) {
        String id = record.optString("id");
        if (sessionManager.isDbNotificationNotified(id)) return;
        
        String responder = record.optString("responder");
        if (sessionManager.getUserId().equals(responder) && !record.optBoolean("is_read")) {
            sessionManager.markDbNotificationAsNotified(id);
            String incidentId = extractIncidentId(record.optString("type"));
            notificationHelper.showNotification(
                id,
                record.optString("title", "Alert"),
                record.optString("message", "New notification received"),
                incidentId
            );
            
            mainHandler.post(() -> {
                Toast.makeText(getApplicationContext(), "New Alert: " + record.optString("title"), Toast.LENGTH_LONG).show();
            });

            broadcastRefresh();
        }
    }

    private void triggerEmergencyAlert(JSONObject incident) {
        String id = incident.optString("id");
        if (id.isEmpty()) return;

        mainHandler.post(() -> {
            if (!sessionManager.isIncidentAcknowledged(id)) {
                bringAppToDashboard(incident);
            }
        });

        broadcastNewTask(incident);
        broadcastRefresh();
        Log.d(TAG, "Emergency alert triggered and broadcast sent for incident: " + id);
    }

    private void broadcastNewTask(JSONObject incident) {
        String address = resolveIncidentAddress(incident);
        Intent intent = new Intent(NEW_TASK_ACTION);
        intent.setPackage(getPackageName());
        intent.putExtra("incident_id", incident.optString("id"));
        intent.putExtra("incident_type", incident.optString("type"));
        intent.putExtra("incident_status", incident.optString("status"));
        intent.putExtra("incident_created", incident.optString("created"));
        intent.putExtra("incident_latitude", incident.optString("latitude"));
        intent.putExtra("incident_longitude", incident.optString("longitude"));
        intent.putExtra("incident_address", address);
        sendBroadcast(intent);
    }

    private void bringAppToDashboard(JSONObject incident) {
        try {
            String address = resolveIncidentAddress(incident);
            Intent dashIntent = new Intent(this, DashboardActivity.class);
            dashIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            dashIntent.putExtra("incident_id", incident.optString("id"));
            dashIntent.putExtra("incident_type", incident.optString("type"));
            dashIntent.putExtra("incident_status", incident.optString("status"));
            dashIntent.putExtra("incident_created", incident.optString("created"));
            dashIntent.putExtra("incident_latitude", incident.optString("latitude"));
            dashIntent.putExtra("incident_longitude", incident.optString("longitude"));
            dashIntent.putExtra("incident_address", address);
            startActivity(dashIntent);
        } catch (Exception e) {
            Log.e(TAG, "App foreground bring failed: " + e.getMessage());
        }
    }

    private void broadcastRefresh() {
        Intent intent = new Intent(REFRESH_ACTION);
        intent.setPackage(getPackageName());
        sendBroadcast(intent);
    }

    private void startAlarmSound() {
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) return;
                try { mediaPlayer.stop(); } catch (Exception ignored) {}
                mediaPlayer.release();
            }

            AudioAttributes aa = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();

            mediaPlayer = MediaPlayer.create(this, R.raw.notification_sound, aa, 0);

            if (mediaPlayer != null) {
                mediaPlayer.setLooping(true);
                mediaPlayer.start();
                Log.d(TAG, "Alarm sound started successfully");
            } else {
                Log.e(TAG, "Failed to create MediaPlayer for alarm sound");
            }
        } catch (Exception e) {
            Log.e(TAG, "Audio error: " + e.getMessage());
        }
    }

    private String resolveIncidentAddress(JSONObject incident) {
        String address = incident.optString("address", "").trim();
        if (!address.isEmpty()) {
            return address;
        }

        String latStr = incident.optString("latitude", "").trim();
        String lonStr = incident.optString("longitude", "").trim();
        String geocoded = getAddressFromLocation(latStr, lonStr);
        if (geocoded != null && !geocoded.trim().isEmpty()) {
            return geocoded;
        }

        if (!latStr.isEmpty() && !lonStr.isEmpty()) {
            return "Lat: " + latStr + ", Lon: " + lonStr;
        }

        return "Unknown location";
    }

    private String getAddressFromLocation(String latStr, String lonStr) {
        if (latStr == null || lonStr == null || latStr.isEmpty() || lonStr.isEmpty()) {
            return null;
        }
        try {
            double lat = Double.parseDouble(latStr);
            double lon = Double.parseDouble(lonStr);
            if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                return null;
            }
            Geocoder geocoder = new Geocoder(this, Locale.getDefault());
            java.util.List<Address> addresses = geocoder.getFromLocation(lat, lon, 1);
            if (addresses != null && !addresses.isEmpty()) {
                return addresses.get(0).getAddressLine(0);
            }
        } catch (Exception e) {
            Log.e(TAG, "Reverse geocoding failed", e);
        }
        return null;
    }

    private void stopAlarmSound() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.release();
            } catch (Exception ignored) {}
            mediaPlayer = null;
        }
    }

    private void startFallbackPolling() {
        pollScheduler.scheduleWithFixedDelay(() -> {
            if (isRunning && sessionManager.isLoggedIn()) {
                syncIncidentStatus();
                syncDbNotifications();
            }
        }, FALLBACK_POLL_INITIAL_DELAY_SECONDS, FALLBACK_POLL_INTERVAL_SECONDS, TimeUnit.SECONDS);
    }

    private void syncIncidentStatus() {
        apiHelper.fetchAssignedIncidents(sessionManager.getToken(), sessionManager.getUserId(), new PocketBaseApiHelper.IncidentListCallback() {
            @Override
            public void onSuccess(java.util.List<IncidentReport> incidents) {
                for (IncidentReport incident : incidents) {
                    String status = incident.getStatus();
                    if (("Pending".equalsIgnoreCase(status) || "Ongoing".equalsIgnoreCase(status)) 
                            && sessionManager.markIncidentAsNotified(incident.getId())) {
                        try {
                            JSONObject json = new JSONObject();
                            json.put("id", incident.getId());
                            json.put("type", incident.getType());
                            json.put("status", incident.getStatus());
                            json.put("created", incident.getCreated());
                            json.put("address", incident.getAddress());
                            json.put("latitude", incident.getLatitude());
                            json.put("longitude", incident.getLongitude());
                            json.put("users", incident.getReporterId());
                            
                            createDbNotificationForIncident(json);
                            triggerEmergencyAlert(json);
                        } catch (Exception ignored) {}
                    }
                }
            }
            @Override
            public void onError(String error) { Log.e(TAG, "Sync fail: " + error); }
        });
    }

    private void syncDbNotifications() {
        apiHelper.fetchNotifications(sessionManager.getToken(), sessionManager.getUserId(), new PocketBaseApiHelper.NotificationListCallback() {
            @Override
            public void onSuccess(java.util.List<NotificationItem> notifications) {
                for (NotificationItem item : notifications) {
                    if (!item.isRead() && sessionManager.markDbNotificationAsNotified(item.getId())) {
                        String incidentId = extractIncidentId(item.getType());
                        notificationHelper.showNotification(
                            item.getId(),
                            item.getTitle(),
                            item.getMessage(),
                            incidentId
                        );
                    }
                }
            }
            @Override
            public void onError(String message) { Log.e(TAG, "Sync notifications fail: " + message); }
        });
    }

    private String buildIncidentNotificationType(String incidentId) {
        return "new_incident:" + incidentId;
    }

    private boolean isIncidentNotificationType(String type) {
        return type != null && type.startsWith("new_incident");
    }

    private String extractIncidentId(String type) {
        if (type == null) {
            return null;
        }
        String prefix = "new_incident:";
        if (type.startsWith(prefix) && type.length() > prefix.length()) {
            return type.substring(prefix.length());
        }
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_START_ALARM.equals(action)) {
                startAlarmSound();
            } else if (ACTION_STOP_ALARM.equals(action)) {
                stopAlarmSound();
            }
        }
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Intent restartServiceIntent = new Intent(getApplicationContext(), RestartReceiver.class);
        PendingIntent restartServicePendingIntent = PendingIntent.getBroadcast(
                getApplicationContext(),
                1,
                restartServiceIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        AlarmManager alarmService = (AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
        if (alarmService != null) {
            alarmService.set(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + 1000, restartServicePendingIntent);
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        stopAlarmSound();
        try {
            if (controlReceiver != null) unregisterReceiver(controlReceiver);
            if (networkCallback != null) {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null) cm.unregisterNetworkCallback(networkCallback);
            }
        } catch (Exception ignored) {}
        
        if (sseConnection != null) new Thread(() -> sseConnection.disconnect()).start();
        sseExecutor.shutdownNow();
        pollScheduler.shutdownNow();
        
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }
}
