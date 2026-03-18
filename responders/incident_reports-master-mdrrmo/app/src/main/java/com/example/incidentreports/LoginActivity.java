package com.example.incidentreports;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class LoginActivity extends AppCompatActivity {
    private EditText edtEmail;
    private EditText edtPassword;
    private LoadingDialog loadingDialog;

    private PocketBaseApiHelper apiHelper;
    private SessionManager sessionManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Set status bar color to match app background
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(ContextCompat.getColor(this, R.color.login_bg));
        
        // Ensure status bar icons are visible (dark icons for light background)
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(true);

        setContentView(R.layout.activity_login);

        apiHelper = new PocketBaseApiHelper(this);
        sessionManager = new SessionManager(this);
        loadingDialog = new LoadingDialog(this);

        if (sessionManager.isLoggedIn()) {
            startEmergencyService();
            goToDashboard();
            return;
        }

        edtEmail = findViewById(R.id.edtEmail);
        edtPassword = findViewById(R.id.edtPassword);
        Button btnLogin = findViewById(R.id.btnLogin);
        TextView txtRegister = findViewById(R.id.txtRegisterNow);

        btnLogin.setOnClickListener(v -> attemptLogin());
        txtRegister.setOnClickListener(v -> startActivity(new Intent(this, RegisterActivity.class)));
    }

    private void attemptLogin() {
        String email = edtEmail.getText().toString().trim();
        String password = edtPassword.getText().toString().trim();

        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Email and password are required.", Toast.LENGTH_SHORT).show();
            return;
        }

        loadingDialog.show("Verifying credentials...");

        apiHelper.loginAdmin(email, password, new PocketBaseApiHelper.AuthCallback() {
            @Override
            public void onSuccess(String token, String userId, String fullName) {
                loadingDialog.dismiss();

                if (userId == null || userId.trim().isEmpty()) {
                    Toast.makeText(LoginActivity.this, "Login OK, but failed to retrieve your Responder ID!", Toast.LENGTH_LONG).show();
                    return;
                }

                sessionManager.saveSession(token, userId, fullName);
                startEmergencyService();
                goToDashboard();
            }

            @Override
            public void onError(String message) {
                loadingDialog.dismiss();
                Toast.makeText(LoginActivity.this, "Login failed: " + message, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void startEmergencyService() {
        Intent serviceIntent = new Intent(this, EmergencyPollingService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    private void goToDashboard() {
        Intent intent = new Intent(this, DashboardActivity.class);
        startActivity(intent);
        finish();
    }
}
