package com.example.incidentreports;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.bottomnavigation.BottomNavigationView;

import java.util.ArrayList;
import java.util.List;

public class NotificationsActivity extends AppCompatActivity {
    private static final String TAG = "NotificationsActivity";
    private PocketBaseApiHelper apiHelper;
    private SessionManager sessionManager;
    private NotificationAdapter recentAdapter, earlierAdapter;
    private List<NotificationItem> recentNotifications = new ArrayList<>();
    private List<NotificationItem> earlierNotifications = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Set status bar color
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(ContextCompat.getColor(this, R.color.dashboard_bg));

        setContentView(R.layout.activity_notifications);

        apiHelper = new PocketBaseApiHelper(this);
        sessionManager = new SessionManager(this);

        setupRecyclerViews();
        setupBottomNav();
        loadNotifications();

        findViewById(R.id.btnMarkAllRead).setOnClickListener(v -> markAllAsRead());
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
                
                // For simplicity, let's say "recent" is last 2 hours
                long twoHoursAgo = System.currentTimeMillis() - (2 * 60 * 60 * 1000);
                
                for (NotificationItem item : notifications) {
                    // This is a simple logic, you might want to parse the 'created' date properly
                    recentNotifications.add(item); // Adding everything to recent for now as demo
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
        if (!notification.isRead()) {
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
        // Navigate based on type if needed
    }

    private void markAllAsRead() {
        for (NotificationItem item : recentNotifications) {
            if (!item.isRead()) onNotificationClick(item);
        }
        for (NotificationItem item : earlierNotifications) {
            if (!item.isRead()) onNotificationClick(item);
        }
    }
}
