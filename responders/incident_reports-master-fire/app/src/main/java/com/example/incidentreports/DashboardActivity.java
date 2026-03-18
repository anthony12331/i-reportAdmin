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
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.android.material.bottomnavigation.BottomNavigationView;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class DashboardActivity extends AppCompatActivity {
    private static final String TAG = "DashboardActivity";
    private static final int PERMISSION_REQUEST_CODE = 101;
    
    private TextView txtAssignedCount, txtOngoingCount, txtTodayCount;
    private TextView txtIncidentTitle, txtIncidentLocation, txtTime, txtDistance;
    private ImageView imgIncidentType;
    private FrameLayout layoutMapPlaceholder;
    private Button btnRespond;
    
    private PocketBaseApiHelper apiHelper;
    private SessionManager sessionManager;
    private String responderId;
    private IncidentReport latestIncidentReport;

    private final BroadcastReceiver refreshReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            Log.d(TAG, "Real-time refresh triggered via broadcast.");
            fetchDashboardData();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(ContextCompat.getColor(this, R.color.dashboard_bg));
        
        setContentView(R.layout.activity_dashboard);

        apiHelper = new PocketBaseApiHelper(this);
        sessionManager = new SessionManager(this);
        responderId = sessionManager.getUserId();

        if (responderId == null || responderId.isEmpty()) {
            logoutAndGoToLogin();
            return;
        }

        checkAndRequestPermissions();
        startEmergencyService();

        initViews();
        setupBottomNav();
    }

    @Override
    protected void onStart() {
        super.onStart();
        IntentFilter filter = new IntentFilter("com.example.incidentreports.REFRESH_DASHBOARD");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(refreshReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(refreshReceiver, filter);
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
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
        }

        requestBatteryOptimizations();
    }

    private void requestBatteryOptimizations() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                Intent intent = new Intent();
                intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                try {
                    startActivity(intent);
                } catch (Exception e) {
                    Log.e(TAG, "Battery optimization request failed", e);
                }
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean allGranted = true;
            for (int res : grantResults) {
                if (res != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            if (!allGranted) {
                Toast.makeText(this, "Permissions are required for real-time alerts to work properly.", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void startEmergencyService() {
        Log.d(TAG, "Starting EmergencyPollingService...");
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
        stopAlarm();
        fetchDashboardData();
    }

    private void stopAlarm() {
        Intent stopIntent = new Intent("com.example.incidentreports.STOP_ALARM");
        stopIntent.setPackage(getPackageName());
        sendBroadcast(stopIntent);
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
                Intent intent = new Intent(this, IncidentDetailActivity.class);
                intent.putExtra("incident_id", latestIncidentReport.getId());
                startActivity(intent);
            } else {
                startActivity(new Intent(this, TasksActivity.class));
            }
        });

        btnRespond.setOnClickListener(v -> {
            if (latestIncidentReport != null) {
                Intent intent = new Intent(this, IncidentDetailActivity.class);
                intent.putExtra("incident_id", latestIncidentReport.getId());
                startActivity(intent);
            }
        });
    }

    private void setupBottomNav() {
        BottomNavigationView bottomNav = findViewById(R.id.bottomNavigation);
        bottomNav.setSelectedItemId(R.id.nav_home);
        bottomNav.setOnItemSelectedListener(item -> {
            int itemId = item.getItemId();
            if (itemId == R.id.nav_home) {
                return true;
            } else if (itemId == R.id.nav_tasks) {
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
                    txtIncidentTitle.setText("ADDRESS");
                    txtIncidentLocation.setText(getAddressFromLocation(latestIncidentReport.getLatitude(), latestIncidentReport.getLongitude()));
                    if (txtTime != null && latestIncidentReport.getCreated() != null) {
                        String time = latestIncidentReport.getCreated().split("\\.")[0].replace("T", " ");
                        txtTime.setText("Reported: " + time);
                    }
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
        } catch (IOException | IllegalArgumentException e) {
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
