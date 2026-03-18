package com.example.incidentreports;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.location.Address;
import android.location.Geocoder;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.google.android.material.bottomnavigation.BottomNavigationView;

import org.osmdroid.api.IMapController;
import org.osmdroid.config.Configuration;
import org.osmdroid.library.BuildConfig;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

public class DashboardActivity extends AppCompatActivity {
    private static final String TAG = "DashboardActivity";
    private static final int PERMISSION_REQUEST_CODE = 101;
    private static final long REALTIME_FETCH_DELAY_MS = 2500L;
    private static final long DASHBOARD_REFRESH_INTERVAL_MS = 3000L;
    
    private TextView txtAssignedCount, txtOngoingCount, txtTodayCount;
    private TextView txtIncidentTitle, txtIncidentLocation, txtTime, txtDistance;
    private ImageView imgIncidentType;
    private FrameLayout layoutMapPlaceholder;
    private Button btnRespond;
    private MapView mapView;
    
    private PocketBaseApiHelper apiHelper;
    private SessionManager sessionManager;
    private NotificationHelper notificationHelper;
    private String responderId;
    private IncidentReport latestIncidentReport;
    private final Handler uiHandler = new Handler(Looper.getMainLooper());
    private final Runnable delayedDashboardRefresh = this::fetchDashboardData;
    private final Runnable periodicDashboardRefresh = new Runnable() {
        @Override
        public void run() {
            fetchDashboardData();
            uiHandler.postDelayed(this, DASHBOARD_REFRESH_INTERVAL_MS);
        }
    };
    private long lastRealtimeIncidentAt = 0L;

    private final BroadcastReceiver refreshReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (EmergencyPollingService.NEW_TASK_ACTION.equals(action)) {
                Log.d(TAG, "New task broadcast received while dashboard is open.");
                applyRealtimeIncident(intent);
                scheduleDelayedRefresh();
            } else {
                Log.d(TAG, "Real-time refresh received via broadcast.");
                fetchDashboardData();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Configuration.getInstance().setUserAgentValue(BuildConfig.LIBRARY_PACKAGE_NAME);
        
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(ContextCompat.getColor(this, R.color.dashboard_bg));
        
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(true);
        
        setContentView(R.layout.activity_dashboard);

        apiHelper = new PocketBaseApiHelper(this);
        sessionManager = new SessionManager(this);
        notificationHelper = new NotificationHelper(this);
        responderId = sessionManager.getUserId();

        if (responderId == null || responderId.isEmpty()) {
            logoutAndGoToLogin();
            return;
        }

        checkAndRequestPermissions();
        startEmergencyService();
        scheduleNotificationWorker();

        initViews();
        setupBottomNav();
        initMap();
        applyRealtimeIncident(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        boolean appliedRealtimeIncident = applyRealtimeIncident(intent);
        Log.d(TAG, "Dashboard brought to front via onNewIntent, refreshing...");
        if (appliedRealtimeIncident) {
            scheduleDelayedRefresh();
        } else {
            fetchDashboardData();
        }
    }

    private void initMap() {
        mapView = findViewById(R.id.mapview);
        if (mapView != null) {
            mapView.setTileSource(TileSourceFactory.MAPNIK);
            mapView.setMultiTouchControls(true);
            IMapController mapController = mapView.getController();
            mapController.setZoom(15.0);
            mapView.setBuiltInZoomControls(false);
            
            View mapOverlay = findViewById(R.id.mapOverlay);
            if (mapOverlay != null) {
                mapOverlay.setOnClickListener(v -> {
                    if (latestIncidentReport != null) {
                        openIncidentDetails();
                    }
                });
            }
        }
    }

    private void updateMapLocation(double lat, double lon) {
        if (mapView != null) {
            GeoPoint startPoint = new GeoPoint(lat, lon);
            mapView.getController().setCenter(startPoint);
            
            mapView.getOverlays().clear();
            Marker marker = new Marker(mapView);
            marker.setPosition(startPoint);
            marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
            marker.setTitle("Incident Location");
            mapView.getOverlays().add(marker);
            mapView.invalidate();
        }
    }

    private void scheduleNotificationWorker() {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        PeriodicWorkRequest workRequest = new PeriodicWorkRequest.Builder(NotificationWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build();

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "IncidentNotificationWorker",
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest
        );
    }

    @Override
    protected void onStart() {
        super.onStart();
        IntentFilter filter = new IntentFilter();
        filter.addAction("com.example.incidentreports.REFRESH_DASHBOARD");
        filter.addAction(EmergencyPollingService.NEW_TASK_ACTION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(refreshReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(refreshReceiver, filter);
        }
        uiHandler.removeCallbacks(periodicDashboardRefresh);
        uiHandler.post(periodicDashboardRefresh);
    }

    @Override
    protected void onStop() {
        super.onStop();
        uiHandler.removeCallbacks(delayedDashboardRefresh);
        uiHandler.removeCallbacks(periodicDashboardRefresh);
        try {
            unregisterReceiver(refreshReceiver);
        } catch (Exception ignored) {}
    }

    private void checkAndRequestPermissions() {
        List<String> permissions = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (!permissions.isEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        } else {
            checkBackgroundPermissions();
        }
    }

    private void checkBackgroundPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                showPermissionGuidanceDialog("Battery Optimization", 
                    "To receive instant alerts even when the app is closed, please disable battery optimization for this app.",
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, 
                    Uri.parse("package:" + getPackageName()));
                return;
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                showPermissionGuidanceDialog("Display Over Other Apps", 
                    "This app needs permission to display alerts over other apps so you never miss an emergency.",
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION, 
                    Uri.parse("package:" + getPackageName()));
            }
        }
    }

    private void showPermissionGuidanceDialog(String title, String message, String action, Uri data) {
        new AlertDialog.Builder(this)
                .setTitle(title)
                .setMessage(message)
                .setCancelable(false)
                .setPositiveButton("Grant Permission", (dialog, which) -> {
                    Intent intent = new Intent(action);
                    if (data != null) intent.setData(data);
                    startActivity(intent);
                })
                .show();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            checkBackgroundPermissions();
        }
    }

    private void startEmergencyService() {
        Intent serviceIntent = new Intent(this, EmergencyPollingService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mapView != null) mapView.onResume();
        long now = System.currentTimeMillis();
        long elapsedSinceRealtime = now - lastRealtimeIncidentAt;
        if (elapsedSinceRealtime < REALTIME_FETCH_DELAY_MS) {
            scheduleDelayedRefresh();
        } else {
            fetchDashboardData();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (mapView != null) mapView.onPause();
    }

    private void initViews() {
        txtAssignedCount = findViewById(R.id.txtAssignedCount);
        txtOngoingCount = findViewById(R.id.txtOngoingCount);
        txtTodayCount = findViewById(R.id.txtTodayCount);
        txtIncidentTitle = findViewById(R.id.txtIncidentTitle);
        txtIncidentLocation = findViewById(R.id.txtIncidentLocation);
        txtTime = findViewById(R.id.txtTime);
        txtDistance = findViewById(R.id.txtDistance);
        imgIncidentType = findViewById(R.id.imgIncidentType);
        layoutMapPlaceholder = findViewById(R.id.layoutMapPlaceholder);
        btnRespond = findViewById(R.id.btnRespond);

        findViewById(R.id.btnViewAll).setOnClickListener(v -> startActivity(new Intent(this, TasksActivity.class)));
        findViewById(R.id.imgProfile).setOnClickListener(v -> startActivity(new Intent(this, ProfileActivity.class)));
        
        findViewById(R.id.cardCurrentTask).setOnClickListener(v -> {
            if (latestIncidentReport != null) {
                openIncidentDetails();
            } else {
                startActivity(new Intent(this, TasksActivity.class));
            }
        });

        btnRespond.setOnClickListener(v -> {
            if (latestIncidentReport != null) {
                openIncidentDetails();
            }
        });
    }

    private void setupBottomNav() {
        BottomNavigationView bottomNav = findViewById(R.id.bottomNavigation);
        bottomNav.setSelectedItemId(R.id.nav_home);
        bottomNav.setOnItemSelectedListener(item -> {
            int itemId = item.getItemId();
            if (itemId == R.id.nav_home) return true;
            else if (itemId == R.id.nav_tasks) {
                startActivity(new Intent(this, TasksActivity.class));
                finish();
                return true;
            } else if (itemId == R.id.nav_alerts) {
                startActivity(new Intent(this, NotificationsActivity.class));
                finish();
                return true;
            } else if (itemId == R.id.nav_profile) {
                startActivity(new Intent(this, ProfileActivity.class));
                finish();
                return true;
            }
            return false;
        });
    }

    private void fetchDashboardData() {
        apiHelper.fetchAssignedIncidents(sessionManager.getToken(), responderId, new PocketBaseApiHelper.IncidentListCallback() {
            @Override
            public void onSuccess(List<IncidentReport> incidents) {
                updateCounts(incidents);
                latestIncidentReport = null;
                for (IncidentReport report : incidents) {
                    if ("pending".equalsIgnoreCase(report.getStatus()) || "ongoing".equalsIgnoreCase(report.getStatus())) {
                        latestIncidentReport = report;
                        break; 
                    }
                }
                
                if (latestIncidentReport != null) {
                    maybeHandleNewLatestIncident();
                    txtIncidentTitle.setText("ADDRESS");
                    txtIncidentLocation.setText(getAddressFromLocation(latestIncidentReport.getLatitude(), latestIncidentReport.getLongitude()));
                    if (txtTime != null && latestIncidentReport.getCreated() != null) {
                        String time = latestIncidentReport.getCreated().split("\\.")[0].replace("T", " ");
                        txtTime.setText("Reported: " + time);
                    }
                    try {
                        double lat = Double.parseDouble(latestIncidentReport.getLatitude());
                        double lon = Double.parseDouble(latestIncidentReport.getLongitude());
                        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                            updateMapLocation(lat, lon);
                        }
                    } catch (Exception ignored) {}
                    toggleIncidentUI(true);
                } else {
                    txtIncidentTitle.setText("No New Assignment");
                    txtIncidentLocation.setText("Waiting for new reports...");
                    toggleIncidentUI(false);
                }
            }
            @Override public void onError(String message) {
                Log.e(TAG, "Error fetching dashboard data: " + message);
            }
        });
    }

    private boolean applyRealtimeIncident(Intent intent) {
        if (intent == null) {
            return false;
        }
        String incidentId = intent.getStringExtra("incident_id");
        if (incidentId == null || incidentId.isEmpty()) {
            return false;
        }

        latestIncidentReport = new IncidentReport(
                incidentId,
                "",
                getExtraOrDefault(intent, "incident_type", "Emergency"),
                "",
                getExtraOrDefault(intent, "incident_status", "pending"),
                getExtraOrDefault(intent, "incident_created", ""),
                getExtraOrDefault(intent, "incident_latitude", ""),
                getExtraOrDefault(intent, "incident_longitude", ""),
                getExtraOrDefault(intent, "incident_address", ""),
                "",
                "",
                "",
                "",
                ""
        );

        txtIncidentTitle.setText("ADDRESS");
        String address = latestIncidentReport.getAddress();
        if (address == null || address.trim().isEmpty()) {
            address = getAddressFromLocation(latestIncidentReport.getLatitude(), latestIncidentReport.getLongitude());
        }
        txtIncidentLocation.setText(address);

        if (txtTime != null) {
            String created = latestIncidentReport.getCreated();
            if (created != null && !created.isEmpty()) {
                txtTime.setText("Reported: " + created.split("\\.")[0].replace("T", " "));
            } else {
                txtTime.setText("Reported just now");
            }
        }

        try {
            double lat = Double.parseDouble(latestIncidentReport.getLatitude());
            double lon = Double.parseDouble(latestIncidentReport.getLongitude());
            if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                updateMapLocation(lat, lon);
            }
        } catch (Exception ignored) {}

        lastRealtimeIncidentAt = System.currentTimeMillis();
        maybeHandleNewLatestIncident();
        toggleIncidentUI(true);
        return true;
    }

    private void scheduleDelayedRefresh() {
        uiHandler.removeCallbacks(delayedDashboardRefresh);
        uiHandler.postDelayed(delayedDashboardRefresh, REALTIME_FETCH_DELAY_MS);
    }

    private void maybeHandleNewLatestIncident() {
        if (latestIncidentReport == null) {
            return;
        }
        String incidentId = latestIncidentReport.getId();
        if (incidentId == null || incidentId.isEmpty()) {
            return;
        }
        if (sessionManager.isIncidentAcknowledged(incidentId)) {
            return;
        }
        if (!sessionManager.markDashboardAlarmStarted(incidentId)) {
            return;
        }
        sendAlarmCommand(EmergencyPollingService.ACTION_START_ALARM);
    }

    private void sendAlarmCommand(String action) {
        Intent serviceIntent = new Intent(this, EmergencyPollingService.class);
        serviceIntent.setAction(action);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    private void openIncidentDetails() {
        if (latestIncidentReport == null) {
            return;
        }
        sessionManager.acknowledgeIncident(latestIncidentReport.getId());
        notificationHelper.cancelNotification(latestIncidentReport.getId());
        sendAlarmCommand(EmergencyPollingService.ACTION_STOP_ALARM);

        Intent intent = new Intent(this, IncidentDetailActivity.class);
        intent.putExtra("incident_id", latestIncidentReport.getId());
        startActivity(intent);
    }

    private String getExtraOrDefault(Intent intent, String key, String fallback) {
        String value = intent.getStringExtra(key);
        return value == null ? fallback : value;
    }

    private void toggleIncidentUI(boolean visible) {
        int visibility = visible ? View.VISIBLE : View.GONE;
        if (imgIncidentType != null) imgIncidentType.setVisibility(visibility);
        if (layoutMapPlaceholder != null) layoutMapPlaceholder.setVisibility(visibility);
        if (txtTime != null) txtTime.setVisibility(visibility);
        if (txtDistance != null) txtDistance.setVisibility(visibility);
        if (btnRespond != null) btnRespond.setVisibility(visibility);
    }

    private String getAddressFromLocation(String latStr, String lonStr) {
        if (latStr == null || lonStr == null || latStr.isEmpty() || lonStr.isEmpty()) return "Unknown Location";
        try {
            double lat = Double.parseDouble(latStr);
            double lon = Double.parseDouble(lonStr);
            if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                return "Lat: " + latStr + ", Lon: " + lonStr;
            }
            Geocoder geocoder = new Geocoder(this, Locale.getDefault());
            List<Address> addresses = geocoder.getFromLocation(lat, lon, 1);
            if (addresses != null && !addresses.isEmpty()) return addresses.get(0).getAddressLine(0);
        } catch (Exception e) {
            Log.e(TAG, "Geocoding error", e);
        }
        return "Lat: " + latStr + ", Lon: " + lonStr;
    }

    private void updateCounts(List<IncidentReport> incidents) {
        int assigned = 0, ongoing = 0, todayCount = 0;
        String todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
        for (IncidentReport incident : incidents) {
            if ("pending".equalsIgnoreCase(incident.getStatus())) assigned++;
            else if ("ongoing".equalsIgnoreCase(incident.getStatus())) ongoing++;
            if (incident.getCreated() != null && incident.getCreated().startsWith(todayDate)) todayCount++;
        }
        txtAssignedCount.setText(String.valueOf(assigned));
        txtOngoingCount.setText(String.valueOf(ongoing));
        txtTodayCount.setText(String.valueOf(todayCount));
    }

    private void logoutAndGoToLogin() {
        sessionManager.clearSession();
        Intent intent = new Intent(this, LoginActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }
}
