package com.example.incidentreports;

import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class RegisterActivity extends AppCompatActivity {
    private EditText edtFirstName, edtMiddleName, edtLastName, edtExtension, edtEmail, edtPassword, edtConfirmPassword, edtContact;
    private ProgressBar progressRegister;
    private LoadingDialog loadingDialog;
    private PocketBaseApiHelper apiHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(ContextCompat.getColor(this, R.color.login_bg));
        
        // Ensure status bar icons are visible (dark icons for light background)
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(true);
        
        setContentView(R.layout.activity_register);

        apiHelper = new PocketBaseApiHelper(this);
        loadingDialog = new LoadingDialog(this);

        edtFirstName = findViewById(R.id.edtFirstName);
        edtMiddleName = findViewById(R.id.edtMiddleName);
        edtLastName = findViewById(R.id.edtLastName);
        edtExtension = findViewById(R.id.edtExtension);
        edtEmail = findViewById(R.id.edtRegisterEmail);
        edtPassword = findViewById(R.id.edtRegisterPassword);
        edtConfirmPassword = findViewById(R.id.edtConfirmPassword);
        edtContact = findViewById(R.id.edtContactNumber);
        progressRegister = findViewById(R.id.progressRegister);
        Button btnRegister = findViewById(R.id.btnRegister);

        btnRegister.setOnClickListener(v -> attemptRegister());
        
        if (findViewById(R.id.txtBackToLogin) != null) {
            findViewById(R.id.txtBackToLogin).setOnClickListener(v -> finish());
        }
    }

    private void attemptRegister() {
        String fName = edtFirstName.getText().toString().trim();
        String mName = edtMiddleName.getText().toString().trim();
        String lName = edtLastName.getText().toString().trim();
        String extension = edtExtension.getText().toString().trim();
        String email = edtEmail.getText().toString().trim();
        String pass = edtPassword.getText().toString().trim();
        String confirmPass = edtConfirmPassword.getText().toString().trim();
        String contact = edtContact.getText().toString().trim();

        if (fName.isEmpty() || lName.isEmpty() || email.isEmpty() || pass.isEmpty() || contact.isEmpty()) {
            Toast.makeText(this, "Please fill in all required fields", Toast.LENGTH_SHORT).show();
            return;
        }

        if (!pass.equals(confirmPass)) {
            Toast.makeText(this, "Passwords do not match", Toast.LENGTH_SHORT).show();
            return;
        }

        if (pass.length() < 8) {
            Toast.makeText(this, "Password must be at least 8 characters", Toast.LENGTH_SHORT).show();
            return;
        }

        loadingDialog.show("Creating account...");
        if (progressRegister != null) progressRegister.setVisibility(View.VISIBLE);

        apiHelper.registerAdmin(fName, mName, lName, email, pass, contact, extension, new PocketBaseApiHelper.SimpleCallback() {
            @Override
            public void onSuccess() {
                loadingDialog.dismiss();
                if (progressRegister != null) progressRegister.setVisibility(View.GONE);
                SuccessDialog successDialog = new SuccessDialog(RegisterActivity.this, new SuccessDialog.OnOkClickListener() {
                    @Override
                    public void onOkClick() {
                        finish();
                    }
                });
                successDialog.show();
            }

            @Override
            public void onError(String message) {
                loadingDialog.dismiss();
                if (progressRegister != null) progressRegister.setVisibility(View.GONE);
                Toast.makeText(RegisterActivity.this, "Registration failed: " + message, Toast.LENGTH_LONG).show();
            }
        });
    }
}
