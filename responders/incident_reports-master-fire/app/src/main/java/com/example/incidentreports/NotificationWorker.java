package com.example.incidentreports;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class NotificationWorker extends Worker {
    private static final String TAG = "NotificationWorker";
    private final SessionManager sessionManager;

    public NotificationWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
        sessionManager = new SessionManager(context);
    }

    @NonNull
    @Override
    public Result doWork() {
        if (!sessionManager.isLoggedIn()) return Result.success();

        Log.d(TAG, "Worker running: Secondary check for updates...");
        
        // This worker acts as a redundancy check
        checkIncidentsSync();
        checkNotificationsSync();

        return Result.success();
    }

    private void checkIncidentsSync() {
        String urlStr = PocketBaseApiHelper.BASE_URL + "/api/collections/incident_reports/records?filter=responders~\"" + sessionManager.getUserId() + "\"";
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestProperty("Authorization", sessionManager.getToken());
            
            if (conn.getResponseCode() == 200) {
                BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) response.append(inputLine);
                in.close();

                JSONObject json = new JSONObject(response.toString());
                JSONArray items = json.getJSONArray("items");
                
                for (int i = 0; i < items.length(); i++) {
                    JSONObject obj = items.getJSONObject(i);
                    String id = obj.getString("id");
                    String status = obj.getString("status");

                    // If we find something that might need a notification, ensure the service is running
                    if ("ongoing".equalsIgnoreCase(status) && !sessionManager.isIncidentNotified(id)) {
                        triggerService();
                        break;
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Worker incident check failed: " + e.getMessage());
        }
    }

    private void checkNotificationsSync() {
        String urlStr = PocketBaseApiHelper.BASE_URL + "/api/collections/notifications/records?filter=responder=\"" + sessionManager.getUserId() + "\"&sort=-created";
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestProperty("Authorization", sessionManager.getToken());
            
            if (conn.getResponseCode() == 200) {
                BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) response.append(inputLine);
                in.close();

                JSONObject json = new JSONObject(response.toString());
                JSONArray items = json.getJSONArray("items");
                
                for (int i = 0; i < items.length(); i++) {
                    JSONObject obj = items.getJSONObject(i);
                    String id = obj.getString("id");
                    boolean isRead = obj.getBoolean("is_read");

                    if (!isRead && !sessionManager.isDbNotificationNotified(id)) {
                        triggerService();
                        break;
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Worker notification check failed: " + e.getMessage());
        }
    }

    private void triggerService() {
        Log.d(TAG, "Worker detected possible new data, ensuring EmergencyPollingService is running...");
        Intent serviceIntent = new Intent(getApplicationContext(), EmergencyPollingService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getApplicationContext().startForegroundService(serviceIntent);
        } else {
            getApplicationContext().startService(serviceIntent);
        }
    }
}
