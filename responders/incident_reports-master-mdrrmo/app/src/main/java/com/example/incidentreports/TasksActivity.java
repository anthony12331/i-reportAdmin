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
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.bottomnavigation.BottomNavigationView;

import java.util.ArrayList;
import java.util.List;

public class TasksActivity extends AppCompatActivity implements IncidentAdapter.OnIncidentClickListener {
    private static final String TAG = "TasksActivity";
    private PocketBaseApiHelper apiHelper;
    private SessionManager sessionManager;
    private IncidentAdapter adapter;
    private List<IncidentReport> allIncidents = new ArrayList<>();
    private String currentFilter = "all";
    private View layoutEmptyState;
    private TextView txtEmptyMessage;

    private final BroadcastReceiver refreshReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            Log.d(TAG, "Real-time refresh triggered via broadcast.");
            loadTasks();
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

        setContentView(R.layout.activity_tasks);

        apiHelper = new PocketBaseApiHelper(this);
        sessionManager = new SessionManager(this);

        layoutEmptyState = findViewById(R.id.layoutEmptyState);
        txtEmptyMessage = findViewById(R.id.txtEmptyMessage);

        RecyclerView rvTasks = findViewById(R.id.rvTasks);
        rvTasks.setLayoutManager(new LinearLayoutManager(this));
        // Initialize adapter with isTaskView = true to use R.layout.item_task
        adapter = new IncidentAdapter(this, true);
        rvTasks.setAdapter(adapter);

        setupFilters();
        setupBottomNav();
        loadTasks();
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

    private void setupFilters() {
        View btnAll = findViewById(R.id.btnFilterAll);
        View btnAssigned = findViewById(R.id.btnFilterAssigned);
        View btnOngoing = findViewById(R.id.btnFilterOngoing);
        View btnResolved = findViewById(R.id.btnFilterResolved);

        btnAll.setOnClickListener(v -> {
            currentFilter = "all";
            updateFilterUI(btnAll, btnAssigned, btnOngoing, btnResolved);
            applyFilter();
        });

        btnAssigned.setOnClickListener(v -> {
            currentFilter = "pending";
            updateFilterUI(btnAssigned, btnAll, btnOngoing, btnResolved);
            applyFilter();
        });

        btnOngoing.setOnClickListener(v -> {
            currentFilter = "ongoing";
            updateFilterUI(btnOngoing, btnAll, btnAssigned, btnResolved);
            applyFilter();
        });

        btnResolved.setOnClickListener(v -> {
            currentFilter = "resolved";
            updateFilterUI(btnResolved, btnAll, btnAssigned, btnOngoing);
            applyFilter();
        });

        // Initialize UI
        updateFilterUI(btnAll, btnAssigned, btnOngoing, btnResolved);
    }

    private void updateFilterUI(View selected, View... others) {
        selected.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.accent_blue));
        ((TextView)selected).setTextColor(ContextCompat.getColor(this, R.color.text_white));
        
        for (View other : others) {
            other.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.card_bg_lighter));
            ((TextView)other).setTextColor(ContextCompat.getColor(this, R.color.text_gray));
        }
    }

    private void setupBottomNav() {
        BottomNavigationView bottomNav = findViewById(R.id.bottomNavigationTasks);
        bottomNav.setSelectedItemId(R.id.nav_tasks);
        bottomNav.setOnItemSelectedListener(item -> {
            int itemId = item.getItemId();
            if (itemId == R.id.nav_home) {
                startActivity(new Intent(this, DashboardActivity.class));
                finish();
                return true;
            } else if (itemId == R.id.nav_tasks) {
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

    private void loadTasks() {
        String responderId = sessionManager.getUserId();
        apiHelper.fetchAssignedIncidents(sessionManager.getToken(), responderId, new PocketBaseApiHelper.IncidentListCallback() {
            @Override
            public void onSuccess(List<IncidentReport> incidents) {
                allIncidents = incidents;
                applyFilter();
            }

            @Override
            public void onError(String message) {
                Log.e(TAG, "Error: " + message);
                Toast.makeText(TasksActivity.this, "Failed to load incidents", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void applyFilter() {
        List<IncidentReport> filtered = new ArrayList<>();
        
        for (IncidentReport report : allIncidents) {
            boolean matchesStatus = currentFilter.equalsIgnoreCase("all") || 
                                   currentFilter.equalsIgnoreCase(report.getStatus());
            
            if (matchesStatus) {
                filtered.add(report);
            }
        }
        
        adapter.submitList(filtered);
        updateEmptyState(filtered.size());
    }

    private void updateEmptyState(int count) {
        if (count == 0) {
            layoutEmptyState.setVisibility(View.VISIBLE);
            String message;
            if (currentFilter.equalsIgnoreCase("all")) {
                message = "No incidents found";
            } else if (currentFilter.equalsIgnoreCase("pending")) {
                message = "No assigned tasks";
            } else if (currentFilter.equalsIgnoreCase("ongoing")) {
                message = "No ongoing tasks";
            } else if (currentFilter.equalsIgnoreCase("resolved")) {
                message = "No resolved tasks";
            } else {
                message = "No results match your filter";
            }
            txtEmptyMessage.setText(message);
        } else {
            layoutEmptyState.setVisibility(View.GONE);
        }
    }

    @Override
    public void onIncidentClick(IncidentReport incidentReport) {
        Intent intent = new Intent(this, IncidentDetailActivity.class);
        intent.putExtra("incident_id", incidentReport.getId());
        startActivity(intent);
    }
}
