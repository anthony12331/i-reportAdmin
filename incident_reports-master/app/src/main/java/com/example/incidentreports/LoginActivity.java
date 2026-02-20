package com.example.incidentreports;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class LoginActivity extends AppCompatActivity {
    private EditText edtEmail;
    private EditText edtPassword;
    private ProgressBar progressBar;

    private PocketBaseApiHelper apiHelper;
    private SessionManager sessionManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        apiHelper = new PocketBaseApiHelper(this);
        sessionManager = new SessionManager(this);

        if (sessionManager.isLoggedIn()) {
            goToTaskList();
            return;
        }

        edtEmail = findViewById(R.id.edtEmail);
        edtPassword = findViewById(R.id.edtPassword);
        Button btnLogin = findViewById(R.id.btnLogin);
        TextView txtRegister = findViewById(R.id.txtRegisterNow);
        progressBar = findViewById(R.id.progressLogin);

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

        setLoading(true);

        // Note: The method is still named loginAdmin to keep your exact structure,
        // but it is now securely routing directly to 'responder_accounts' behind the scenes!
        apiHelper.loginAdmin(email, password, new PocketBaseApiHelper.AuthCallback() {
            @Override
            public void onSuccess(String token, String userId, String fullName) {
                setLoading(false);

                // SAFETY CHECK:
                // Since we are logging directly into responder_accounts, userId is the responder ID.
                if (userId == null || userId.trim().isEmpty()) {
                    Toast.makeText(LoginActivity.this, "Login OK, but failed to retrieve your Responder ID!", Toast.LENGTH_LONG).show();
                    return;
                }

                sessionManager.saveSession(token, userId, fullName);
                Toast.makeText(LoginActivity.this, "Login successful! Credentials are correct.", Toast.LENGTH_SHORT).show();
                goToTaskList();
            }

            @Override
            public void onError(String message) {
                setLoading(false);
                Toast.makeText(LoginActivity.this, "Login failed: " + message, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void setLoading(boolean loading) {
        progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
    }

    private void goToTaskList() {
        Intent intent = new Intent(this, TaskListActivity.class);
        startActivity(intent);
        finish();
    }
}