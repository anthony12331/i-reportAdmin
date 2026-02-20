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

    public interface IncidentListCallback {
        void onSuccess(List<IncidentReport> incidents);
        void onError(String message);
    }

    public interface IncidentCallback {
        void onSuccess(IncidentReport incidentReport);
        void onError(String message);
    }

    // ==========================================
    // Responder Login (Targeting responder_accounts)
    // ==========================================
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

    // ==========================================
    // Responder Registration (Targeting responder_accounts)
    // ==========================================
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

    // ==========================================
    // Incident Handling (Fixing the Missing Method)
    // ==========================================

    // THIS IS THE MISSING METHOD THAT WAS CAUSING YOUR ERROR
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

    public void fetchAssignedIncidents(String token, String responderId, IncidentListCallback callback) {
        String filter = "responders ?= \"" + responderId + "\"";
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

    public void fetchIncidentById(String token, String incidentId, IncidentCallback callback) {
        String url = BASE_URL + "/api/collections/incident_reports/records/" + incidentId;
        JsonObjectRequest request = new AuthJsonRequest(Request.Method.GET, url, null, token,
                response -> callback.onSuccess(parseIncident(response)),
                error -> callback.onError(parseVolleyError(error)));
        requestQueue.add(request);
    }

    public String getFileUrl(IncidentReport report) {
        if (!report.hasImage()) return "";
        return BASE_URL + "/api/files/" + report.getCollectionId() + "/" + report.getId() + "/" + report.getImageFileName();
    }

    private IncidentReport parseIncident(JSONObject obj) {
        String id = obj.optString("id", "");
        String collectionId = obj.optString("collectionId", "");
        String type = obj.optString("type", "Unknown");
        String description = obj.optString("description", "No description");
        String status = obj.optString("status", "pending");
        String created = obj.optString("created", "");
        String latitude = obj.optString("latitude", "");
        String longitude = obj.optString("longitude", "");
        String address = obj.optString("address", "No address");

        String image = "";
        JSONArray arr = obj.optJSONArray("incident_image");
        if (arr != null && arr.length() > 0) image = arr.optString(0, "");

        return new IncidentReport(id, collectionId, type, description, status, created, latitude, longitude, address, image);
    }

    private String parseVolleyError(VolleyError error) {
        if (error.networkResponse != null && error.networkResponse.data != null) {
            return new String(error.networkResponse.data);
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
            Map<String, String> headers = new HashMap<>(super.getHeaders());
            headers.put("Authorization", "Bearer " + token);
            headers.put("Content-Type", "application/json");
            return headers;
        }
    }
}