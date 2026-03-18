package com.example.incidentreports;

import static com.example.incidentreports.BuildConfig.POCKETBASE_URL;

import android.content.Context;
import android.net.Uri;
import android.util.Log;

import androidx.annotation.NonNull;

import com.android.volley.AuthFailureError;
import com.android.volley.Request;
import com.android.volley.RequestQueue;
import com.android.volley.VolleyError;
import com.android.volley.toolbox.JsonObjectRequest;
import com.android.volley.toolbox.Volley;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Handles REST communication with PocketBase using responder_accounts.
 */
public class PocketBaseApiHelper {
    public static final String BASE_URL = POCKETBASE_URL;
    private static final String TAG = "PocketBaseApiHelper";

    private final RequestQueue requestQueue;

    public PocketBaseApiHelper(Context context) {
        requestQueue = Volley.newRequestQueue(context.getApplicationContext());
    }

    public interface AuthCallback {
        void onSuccess(String token, String userId, String fullName);
        void onError(String message);
    }

    public interface SimpleCallback {
        void onSuccess();
        void onError(String message);
    }

    public interface CreateCallback {
        void onSuccess(String id);
        void onError(String message);
    }

    public interface IncidentListCallback {
        void onSuccess(List<IncidentReport> incidents);
        void onError(String message);
    }

    public interface IncidentCallback {
        void onSuccess(IncidentReport incidentReport);
        void onError(String message);
    }

    public interface NotificationListCallback {
        void onSuccess(List<NotificationItem> notifications);
        void onError(String message);
    }

    public void loginAdmin(String email, String password, AuthCallback callback) {
        String url = BASE_URL + "/api/collections/responder_accounts/auth-with-password";
        JSONObject body = new JSONObject();
        try {
            body.put("identity", email);
            body.put("password", password);
        } catch (JSONException e) {
            callback.onError(e.getMessage());
            return;
        }

        JsonObjectRequest request = new JsonObjectRequest(Request.Method.POST, url, body,
                response -> {
                    try {
                        String token = response.getString("token");
                        JSONObject record = response.getJSONObject("record");
                        String responderId = record.getString("id");
                        String fullName = record.optString("first_name", "") + " " + record.optString("last_name", "");
                        callback.onSuccess(token, responderId.trim(), fullName.trim());
                    } catch (JSONException e) {
                        callback.onError("Unable to parse login response.");
                    }
                },
                error -> callback.onError(parseVolleyError(error)));

        requestQueue.add(request);
    }

    public void registerAdmin(String firstName, String middleName, String lastName,
                              String email, String password, String contactNumber,
                              String extension, SimpleCallback callback) {

        String url = BASE_URL + "/api/collections/responder_accounts/records";
        JSONObject body = new JSONObject();
        try {
            body.put("email", email);
            body.put("password", password);
            body.put("passwordConfirm", password);
            body.put("first_name", firstName);
            body.put("last_name", lastName);
            body.put("unit_name", firstName + " " + lastName + " Unit");
            body.put("contact_number", contactNumber);
            body.put("department", "Fire");
            body.put("is_available", true);
        } catch (JSONException e) {
            callback.onError(e.getMessage());
            return;
        }

        JsonObjectRequest request = new JsonObjectRequest(Request.Method.POST, url, body,
                response -> callback.onSuccess(),
                error -> callback.onError("Failed to register: " + parseVolleyError(error)));

        requestQueue.add(request);
    }

    public void updateIncidentStatus(String token, String incidentId, String newStatus, SimpleCallback callback) {
        String url = BASE_URL + "/api/collections/incident_reports/records/" + incidentId;
        JSONObject body = new JSONObject();
        try {
            body.put("status", newStatus);
        } catch (JSONException e) {
            callback.onError(e.getMessage());
            return;
        }

        JsonObjectRequest request = new AuthJsonRequest(Request.Method.PATCH, url, body, token,
                response -> callback.onSuccess(),
                error -> callback.onError(parseVolleyError(error)));

        requestQueue.add(request);
    }

    public void fetchIncidentById(String token, String incidentId, IncidentCallback callback) {
        String url = Uri.parse(BASE_URL + "/api/collections/incident_reports/records/" + incidentId)
                .buildUpon()
                .appendQueryParameter("expand", "users")
                .toString();

        JsonObjectRequest request = new AuthJsonRequest(Request.Method.GET, url, null, token,
                response -> {
                    IncidentReport incident = parseIncident(response);
                    callback.onSuccess(incident);
                },
                error -> callback.onError(parseVolleyError(error)));

        requestQueue.add(request);
    }

    public void fetchAssignedIncidents(String token, String responderId, IncidentListCallback callback) {
        String filter = "responders ~ \"" + responderId + "\"";
        String url = Uri.parse(BASE_URL + "/api/collections/incident_reports/records")
                .buildUpon()
                .appendQueryParameter("filter", filter)
                .appendQueryParameter("sort", "-created")
                .appendQueryParameter("expand", "users")
                .toString();

        JsonObjectRequest request = new AuthJsonRequest(Request.Method.GET, url, null, token,
                response -> {
                    List<IncidentReport> incidents = new ArrayList<>();
                    JSONArray items = response.optJSONArray("items");
                    if (items != null) {
                        for (int i = 0; i < items.length(); i++) {
                            JSONObject obj = items.optJSONObject(i);
                            if (obj != null) incidents.add(parseIncident(obj));
                        }
                    }
                    callback.onSuccess(incidents);
                },
                error -> callback.onError(parseVolleyError(error)));

        requestQueue.add(request);
    }

    public void fetchMyReports(String token, String userId, IncidentListCallback callback) {
        String filter = "users ~ \"" + userId + "\"";
        String url = Uri.parse(BASE_URL + "/api/collections/incident_reports/records")
                .buildUpon()
                .appendQueryParameter("filter", filter)
                .appendQueryParameter("sort", "-created")
                .toString();

        JsonObjectRequest request = new AuthJsonRequest(Request.Method.GET, url, null, token,
                response -> {
                    List<IncidentReport> incidents = new ArrayList<>();
                    JSONArray items = response.optJSONArray("items");
                    if (items != null) {
                        for (int i = 0; i < items.length(); i++) {
                            JSONObject obj = items.optJSONObject(i);
                            if (obj != null) incidents.add(parseIncident(obj));
                        }
                    }
                    callback.onSuccess(incidents);
                },
                error -> callback.onError(parseVolleyError(error)));

        requestQueue.add(request);
    }

    public void fetchNotifications(String token, String responderId, NotificationListCallback callback) {
        String filter = "responder = \"" + responderId + "\"";
        String url = Uri.parse(BASE_URL + "/api/collections/notifications/records")
                .buildUpon()
                .appendQueryParameter("filter", filter)
                .appendQueryParameter("sort", "-created")
                .toString();

        JsonObjectRequest request = new AuthJsonRequest(Request.Method.GET, url, null, token,
                response -> {
                    List<NotificationItem> notifications = new ArrayList<>();
                    JSONArray items = response.optJSONArray("items");
                    if (items != null) {
                        for (int i = 0; i < items.length(); i++) {
                            JSONObject obj = items.optJSONObject(i);
                            if (obj != null) {
                                notifications.add(new NotificationItem(
                                        obj.optString("id"),
                                        obj.optString("title"),
                                        obj.optString("message"),
                                        obj.optString("type"),
                                        obj.optBoolean("is_read"),
                                        obj.optString("created")
                                ));
                            }
                        }
                    }
                    callback.onSuccess(notifications);
                },
                error -> callback.onError(parseVolleyError(error)));

        requestQueue.add(request);
    }

    public void createNotification(String token, String responderId, String userId, String title, String message, String type, CreateCallback callback) {
        String url = BASE_URL + "/api/collections/notifications/records";
        JSONObject body = new JSONObject();
        try {
            body.put("responder", responderId); 
            if (userId != null && !userId.isEmpty()) {
                body.put("user", userId);
            }
            body.put("title", title);
            body.put("message", message);
            body.put("type", type);
            body.put("is_read", false);
        } catch (JSONException e) {
            if (callback != null) callback.onError(e.getMessage());
            return;
        }

        JsonObjectRequest request = new AuthJsonRequest(Request.Method.POST, url, body, token,
                response -> {
                    String id = response.optString("id");
                    if (callback != null) callback.onSuccess(id);
                },
                error -> {
                    if (callback != null) callback.onError(parseVolleyError(error));
                });

        requestQueue.add(request);
    }

    public void deleteNotification(String token, String id, SimpleCallback callback) {
        String url = BASE_URL + "/api/collections/notifications/records/" + id;
        AuthJsonRequest request = new AuthJsonRequest(Request.Method.DELETE, url, null, token,
                response -> { if (callback != null) callback.onSuccess(); },
                error -> { if (callback != null) callback.onError(parseVolleyError(error)); });
        requestQueue.add(request);
    }

    public void subscribeToRealtime(String token, String clientId, SimpleCallback callback) {
        String url = BASE_URL + "/api/realtime";
        JSONObject body = new JSONObject();
        try {
            body.put("clientId", clientId);
            JSONArray subs = new JSONArray();
            subs.put("incident_reports");
            subs.put("notifications");
            body.put("subscriptions", subs);
        } catch (JSONException e) {
            callback.onError(e.getMessage());
            return;
        }

        JsonObjectRequest request = new AuthJsonRequest(Request.Method.POST, url, body, token,
                response -> callback.onSuccess(),
                error -> callback.onError(parseVolleyError(error)));

        requestQueue.add(request);
    }

    public void markNotificationRead(String token, String notificationId, SimpleCallback callback) {
        String url = BASE_URL + "/api/collections/notifications/records/" + notificationId;
        JSONObject body = new JSONObject();
        try {
            body.put("is_read", true);
        } catch (JSONException e) {
            callback.onError(e.getMessage());
            return;
        }

        JsonObjectRequest request = new AuthJsonRequest(Request.Method.PATCH, url, body, token,
                response -> callback.onSuccess(),
                error -> callback.onError(parseVolleyError(error)));

        requestQueue.add(request);
    }

    public IncidentReport parseIncident(JSONObject obj) {
        String id = obj.optString("id", "");
        String collectionId = obj.optString("collectionId", "");
        String type = obj.optString("type", "Unknown");
        String description = obj.optString("description", "No description");
        String status = obj.optString("status", "pending");
        String created = obj.optString("created", "");
        String latitude = obj.optString("latitude", "");
        String longitude = obj.optString("longitude", "");
        String address = obj.optString("address", ""); 
        String image = obj.optString("incident_image", "");
        String video = obj.optString("incident_video", "");
        
        String reporterName = "Anonymous";
        String reporterContact = "";
        String reporterId = "";
        
        JSONObject expand = obj.optJSONObject("expand");
        if (expand != null) {
            JSONObject user = expand.optJSONObject("users");
            if (user != null) {
                reporterId = user.optString("id", "");
                String fName = user.optString("first_name", "");
                String lName = user.optString("last_name", "");
                reporterName = (fName + " " + lName).trim();
                if (reporterName.isEmpty()) {
                    reporterName = "User " + reporterId;
                }
                reporterContact = user.optString("contact_number", "");
            }
        }
        
        if (reporterId.isEmpty()) {
            reporterId = obj.optString("users", "");
        }

        return new IncidentReport(id, collectionId, type, description, status, created, latitude, longitude, address, image, video, reporterName, reporterContact, reporterId);
    }

    public String getFileUrl(String collectionId, String recordId, String fileName) {
        if (fileName == null || fileName.isEmpty()) return null;
        return BASE_URL + "/api/files/" + collectionId + "/" + recordId + "/" + fileName;
    }

    private String parseVolleyError(VolleyError error) {
        if (error.networkResponse != null && error.networkResponse.data != null) {
            try {
                String responseBody = new String(error.networkResponse.data);
                JSONObject data = new JSONObject(responseBody);
                return data.optString("message", responseBody);
            } catch (Exception e) {
                return "Network error: " + error.networkResponse.statusCode;
            }
        }
        return error.getMessage() != null ? error.getMessage() : "Network error";
    }

    private static class AuthJsonRequest extends JsonObjectRequest {
        private final String token;

        public AuthJsonRequest(int method, String url, JSONObject jsonRequest, String token,
                               com.android.volley.Response.Listener<JSONObject> listener,
                               com.android.volley.Response.ErrorListener errorListener) {
            super(method, url, jsonRequest, listener, errorListener);
            this.token = token;
        }

        @NonNull
        @Override
        public Map<String, String> getHeaders() throws AuthFailureError {
            Map<String, String> headers = new HashMap<>();
            headers.put("Authorization", token);
            headers.put("Content-Type", "application/json");
            return headers;
        }
    }
}
