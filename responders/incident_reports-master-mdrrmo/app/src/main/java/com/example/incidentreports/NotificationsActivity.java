package com.example.incidentreports;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.bottomnavigation.BottomNavigationView;

import java.util.ArrayList;
import java.util.List;

public class NotificationsActivity extends AppCompatActivity {
    private static final String TAG = "NotificationsActivity";
    private PocketBaseApiHelper apiHelper;
    private SessionManager sessionManager;
    private NotificationHelper notificationHelper;
    private NotificationAdapter recentAdapter, earlierAdapter;
    private List<NotificationItem> recentNotifications = new ArrayList<>();
    private List<NotificationItem> earlierNotifications = new ArrayList<>();

    private final BroadcastReceiver refreshReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            Log.d(TAG, "Real-time notifications refresh triggered via broadcast.");
            loadNotifications();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Set status bar color
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(ContextCompat.getColor(this, R.color.dashboard_bg));
        
        // Ensure status bar icons are visible (dark icons for light background)
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(true);

        setContentView(R.layout.activity_notifications);

        apiHelper = new PocketBaseApiHelper(this);
        sessionManager = new SessionManager(this);
        notificationHelper = new NotificationHelper(this);

        setupRecyclerViews();
        setupBottomNav();
        loadNotifications();

        findViewById(R.id.btnMarkAllRead).setOnClickListener(v -> markAllAsRead());
    }

    @Override
    protected void onStart() {
        super.onStart();
        startEmergencyService();
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

    private void startEmergencyService() {
        Intent serviceIntent = new Intent(this, EmergencyPollingService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    private void setupRecyclerViews() {
        RecyclerView rvRecent = findViewById(R.id.rvRecentNotifications);
        rvRecent.setLayoutManager(new LinearLayoutManager(this));
        recentAdapter = new NotificationAdapter(this, recentNotifications, this::onNotificationClick);
        rvRecent.setAdapter(recentAdapter);

        RecyclerView rvEarlier = findViewById(R.id.rvEarlierNotifications);
        rvEarlier.setLayoutManager(new LinearLayoutManager(this));
        earlierAdapter = new NotificationAdapter(this, earlierNotifications, this::onNotificationClick);
        rvEarlier.setAdapter(earlierAdapter);
    }

    private void setupBottomNav() {
        BottomNavigationView bottomNav = findViewById(R.id.bottomNavigation);
        bottomNav.setSelectedItemId(R.id.nav_alerts);
        bottomNav.setOnItemSelectedListener(item -> {
            int itemId = item.getItemId();
            if (itemId == R.id.nav_home) {
                startActivity(new Intent(this, DashboardActivity.class));
                finish();
                return true;
            } else if (itemId == R.id.nav_tasks) {
                startActivity(new Intent(this, TasksActivity.class));
                finish();
                return true;
            } else if (itemId == R.id.nav_alerts) {
                return true;
            } else if (itemId == R.id.nav_profile) {
                startActivity(new Intent(this, ProfileActivity.class));
                finish();
                return true;
            }
            return false;
        });
    }

    private void loadNotifications() {
        apiHelper.fetchNotifications(sessionManager.getToken(), sessionManager.getUserId(), new PocketBaseApiHelper.NotificationListCallback() {
            @Override
            public void onSuccess(List<NotificationItem> notifications) {
                recentNotifications.clear();
                earlierNotifications.clear();
                
                for (NotificationItem item : notifications) {
                    recentNotifications.add(item);
                }
                
                recentAdapter.notifyDataSetChanged();
                earlierAdapter.notifyDataSetChanged();
                
                findViewById(R.id.txtEarlierHeader).setVisibility(earlierNotifications.isEmpty() ? View.GONE : View.VISIBLE);
            }

            @Override
            public void onError(String message) {
                Log.e(TAG, "Error: " + message);
            }
        });
    }

    private void onNotificationClick(NotificationItem notification) {
        openNotificationTarget(notification);
        markNotificationAsRead(notification);
    }

    private void openNotificationTarget(NotificationItem notification) {
        String incidentId = extractIncidentId(notification.getType());
        if (incidentId != null && !incidentId.isEmpty()) {
            sessionManager.acknowledgeIncident(incidentId);
            notificationHelper.cancelNotification(incidentId);
            sendAlarmCommand(EmergencyPollingService.ACTION_STOP_ALARM);

            Intent detailIntent = new Intent(this, IncidentDetailActivity.class);
            detailIntent.putExtra("incident_id", incidentId);
            startActivity(detailIntent);
        }
    }

    private String extractIncidentId(String type) {
        String prefix = "new_incident:";
        if (type != null && type.startsWith(prefix) && type.length() > prefix.length()) {
            return type.substring(prefix.length());
        }
        return null;
    }

    private void markNotificationAsRead(NotificationItem notification) {
        if (notification.isRead()) {
            return;
        }
        apiHelper.markNotificationRead(sessionManager.getToken(), notification.getId(), new PocketBaseApiHelper.SimpleCallback() {
            @Override
            public void onSuccess() {
                notification.setRead(true);
                recentAdapter.notifyDataSetChanged();
                earlierAdapter.notifyDataSetChanged();
            }

            @Override
            public void onError(String message) {}
        });
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

    private void markAllAsRead() {
        for (NotificationItem item : recentNotifications) {
            markNotificationAsRead(item);
        }
        for (NotificationItem item : earlierNotifications) {
            markNotificationAsRead(item);
        }
    }
}
