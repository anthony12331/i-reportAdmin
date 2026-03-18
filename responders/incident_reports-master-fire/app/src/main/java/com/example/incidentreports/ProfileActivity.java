package com.example.incidentreports;

import android.content.Intent;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.google.android.material.bottomnavigation.BottomNavigationView;

public class ProfileActivity extends AppCompatActivity {

    private SessionManager sessionManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Set status bar color
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(ContextCompat.getColor(this, R.color.dashboard_bg));

        setContentView(R.layout.activity_profile);

        sessionManager = new SessionManager(this);

        TextView txtName = findViewById(R.id.txtProfileName);
        txtName.setText(sessionManager.getFullName());

        setupBottomNav();

        findViewById(R.id.btnLogout).setOnClickListener(v -> logout());
        
        findViewById(R.id.btnEditProfile).setOnClickListener(v -> {
            Toast.makeText(this, "Edit profile coming soon", Toast.LENGTH_SHORT).show();
        });
    }

    private void setupBottomNav() {
        BottomNavigationView bottomNav = findViewById(R.id.bottomNavigationProfile);
        bottomNav.setSelectedItemId(R.id.nav_profile);
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
                startActivity(new Intent(this, NotificationsActivity.class));
                finish();
                return true;
            } else if (itemId == R.id.nav_profile) {
                return true;
            }
            return false;
        });
    }

    private void logout() {
        sessionManager.clearSession();
        // Stop the background service on logout
        Intent stopServiceIntent = new Intent(this, EmergencyPollingService.class);
        stopService(stopServiceIntent);
        
        Intent intent = new Intent(this, LoginActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }
}
