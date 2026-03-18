package com.example.incidentreports;

import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.content.ContextCompat;

public class RegisterActivity extends AppCompatActivity {
    private EditText edtFirstName, edtLastName, edtEmail, edtPassword, edtContact;
    private LoadingDialog loadingDialog;
    private PocketBaseApiHelper apiHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(ContextCompat.getColor(this, R.color.dashboard_bg));
        
        setContentView(R.layout.activity_register);

        apiHelper = new PocketBaseApiHelper(this);
        loadingDialog = new LoadingDialog(this);

        edtFirstName = findViewById(R.id.edtFirstName);
        edtLastName = findViewById(R.id.edtLastName);
        edtEmail = findViewById(R.id.edtRegisterEmail);
        edtPassword = findViewById(R.id.edtRegisterPassword);
        edtContact = findViewById(R.id.edtContactNumber);
        Button btnRegister = findViewById(R.id.btnRegister);

        btnRegister.setOnClickListener(v -> attemptRegister());
        
        // Check if txtBackToLogin exists before setting listener to avoid crash
        if (findViewById(R.id.txtBackToLogin) != null) {
            findViewById(R.id.txtBackToLogin).setOnClickListener(v -> finish());
        }
    }

    private void attemptRegister() {
        String fName = edtFirstName.getText().toString().trim();
        String lName = edtLastName.getText().toString().trim();
        String email = edtEmail.getText().toString().trim();
        String pass = edtPassword.getText().toString().trim();
        String contact = edtContact.getText().toString().trim();

        if (fName.isEmpty() || lName.isEmpty() || email.isEmpty() || pass.isEmpty() || contact.isEmpty()) {
            Toast.makeText(this, "All fields are required", Toast.LENGTH_SHORT).show();
            return;
        }

        loadingDialog.show("Creating account...");

        apiHelper.registerAdmin(fName, "", lName, email, pass, contact, "", new PocketBaseApiHelper.SimpleCallback() {
            @Override
            public void onSuccess() {
                loadingDialog.dismiss();
                finish();
            }

            @Override
            public void onError(String message) {
                loadingDialog.dismiss();
                Toast.makeText(RegisterActivity.this, "Registration failed: " + message, Toast.LENGTH_LONG).show();
            }
        });
    }
}
