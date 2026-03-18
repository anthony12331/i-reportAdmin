package com.example.incidentreports;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.HashSet;
import java.util.Set;

public class SessionManager {
    private static final String PREF_NAME = "mdrrmo_app_session";
    private static final String KEY_TOKEN = "auth_token";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_FULL_NAME = "full_name";
    private static final String KEY_NOTIFIED_INCIDENTS = "notified_incidents";
    private static final String KEY_NOTIFIED_DB_NOTIFICATIONS = "notified_db_notifications";
    private static final String KEY_CREATED_INCIDENT_DB_NOTIFICATIONS = "created_incident_db_notifications";
    private static final String KEY_ACKNOWLEDGED_INCIDENTS = "acknowledged_incidents";
    private static final String KEY_DASHBOARD_ALARMED_INCIDENTS = "dashboard_alarmed_incidents";

    private final SharedPreferences sharedPreferences;

    public SessionManager(Context context) {
        sharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public synchronized void saveSession(String token, String userId, String fullName) {
        sharedPreferences.edit()
                .putString(KEY_TOKEN, token)
                .putString(KEY_USER_ID, userId)
                .putString(KEY_FULL_NAME, fullName)
                .commit(); 
    }

    public synchronized String getToken() {
        return sharedPreferences.getString(KEY_TOKEN, "");
    }

    public synchronized String getUserId() {
        return sharedPreferences.getString(KEY_USER_ID, "");
    }

    public synchronized String getFullName() {
        return sharedPreferences.getString(KEY_FULL_NAME, "");
    }

    public synchronized boolean isLoggedIn() {
        return !getToken().isEmpty() && !getUserId().isEmpty();
    }

    public synchronized boolean isIncidentNotified(String incidentId) {
        Set<String> notified = sharedPreferences.getStringSet(KEY_NOTIFIED_INCIDENTS, new HashSet<>());
        return notified != null && notified.contains(incidentId);
    }

    /**
     * Marks an incident as notified. 
     * @return true if it was newly marked, false if it was already notified.
     */
    public synchronized boolean markIncidentAsNotified(String incidentId) {
        Set<String> current = sharedPreferences.getStringSet(KEY_NOTIFIED_INCIDENTS, new HashSet<>());
        if (current != null && current.contains(incidentId)) return false;
        
        Set<String> updated = new HashSet<>(current != null ? current : new HashSet<>());
        updated.add(incidentId);
        return sharedPreferences.edit().putStringSet(KEY_NOTIFIED_INCIDENTS, updated).commit();
    }

    public synchronized boolean isDbNotificationNotified(String notificationId) {
        Set<String> notified = sharedPreferences.getStringSet(KEY_NOTIFIED_DB_NOTIFICATIONS, new HashSet<>());
        return notified != null && notified.contains(notificationId);
    }

    public synchronized boolean markDbNotificationAsNotified(String notificationId) {
        Set<String> current = sharedPreferences.getStringSet(KEY_NOTIFIED_DB_NOTIFICATIONS, new HashSet<>());
        if (current != null && current.contains(notificationId)) return false;

        Set<String> updated = new HashSet<>(current != null ? current : new HashSet<>());
        updated.add(notificationId);
        return sharedPreferences.edit().putStringSet(KEY_NOTIFIED_DB_NOTIFICATIONS, updated).commit();
    }

    public synchronized boolean markIncidentDbNotificationCreated(String incidentId) {
        Set<String> current = sharedPreferences.getStringSet(KEY_CREATED_INCIDENT_DB_NOTIFICATIONS, new HashSet<>());
        if (current != null && current.contains(incidentId)) return false;

        Set<String> updated = new HashSet<>(current != null ? current : new HashSet<>());
        updated.add(incidentId);
        return sharedPreferences.edit().putStringSet(KEY_CREATED_INCIDENT_DB_NOTIFICATIONS, updated).commit();
    }

    public synchronized boolean isIncidentAcknowledged(String incidentId) {
        Set<String> acknowledged = sharedPreferences.getStringSet(KEY_ACKNOWLEDGED_INCIDENTS, new HashSet<>());
        return acknowledged != null && acknowledged.contains(incidentId);
    }

    public synchronized boolean acknowledgeIncident(String incidentId) {
        Set<String> current = sharedPreferences.getStringSet(KEY_ACKNOWLEDGED_INCIDENTS, new HashSet<>());
        boolean alreadyAcknowledged = current != null && current.contains(incidentId);

        Set<String> updatedAcknowledged = new HashSet<>(current != null ? current : new HashSet<>());
        updatedAcknowledged.add(incidentId);

        Set<String> dashboardAlarmed = sharedPreferences.getStringSet(KEY_DASHBOARD_ALARMED_INCIDENTS, new HashSet<>());
        Set<String> updatedDashboardAlarmed = new HashSet<>(dashboardAlarmed != null ? dashboardAlarmed : new HashSet<>());
        updatedDashboardAlarmed.remove(incidentId);

        boolean saved = sharedPreferences.edit()
                .putStringSet(KEY_ACKNOWLEDGED_INCIDENTS, updatedAcknowledged)
                .putStringSet(KEY_DASHBOARD_ALARMED_INCIDENTS, updatedDashboardAlarmed)
                .commit();
        return saved && !alreadyAcknowledged;
    }

    public synchronized boolean markDashboardAlarmStarted(String incidentId) {
        Set<String> current = sharedPreferences.getStringSet(KEY_DASHBOARD_ALARMED_INCIDENTS, new HashSet<>());
        if (current != null && current.contains(incidentId)) return false;

        Set<String> updated = new HashSet<>(current != null ? current : new HashSet<>());
        updated.add(incidentId);
        return sharedPreferences.edit().putStringSet(KEY_DASHBOARD_ALARMED_INCIDENTS, updated).commit();
    }

    public void clearSession() {
        sharedPreferences.edit().clear().commit();
    }
}
