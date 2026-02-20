package com.example.incidentreports;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Patterns;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

public class RegisterActivity extends AppCompatActivity {
    private EditText edtFirstName, edtMiddleName, edtLastName, edtEmail, edtPassword, edtConfirmPassword, edtContactNumber, edtExtension;
    private TextView errFirstName, errLastName, errEmail, errPassword, errConfirmPassword, errContact, errExtension;
    private ProgressBar progressBar;
    private Button btnRegister;

    private PocketBaseApiHelper apiHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        apiHelper = new PocketBaseApiHelper(this);

        // Bind Views
        edtFirstName = findViewById(R.id.edtFirstName);
        edtMiddleName = findViewById(R.id.edtMiddleName);
        edtLastName = findViewById(R.id.edtLastName);
        edtExtension = findViewById(R.id.edtExtension);
        edtEmail = findViewById(R.id.edtRegisterEmail);
        edtPassword = findViewById(R.id.edtRegisterPassword);
        edtConfirmPassword = findViewById(R.id.edtConfirmPassword);
        edtContactNumber = findViewById(R.id.edtContactNumber);

        errFirstName = findViewById(R.id.errFirstName);
        errLastName = findViewById(R.id.errLastName);
        errExtension = findViewById(R.id.errExtension);
        errEmail = findViewById(R.id.errEmail);
        errPassword = findViewById(R.id.errPassword);
        errConfirmPassword = findViewById(R.id.errConfirmPassword);
        errContact = findViewById(R.id.errContact);

        btnRegister = findViewById(R.id.btnRegister);
        progressBar = findViewById(R.id.progressRegister);

        btnRegister.setOnClickListener(v -> attemptRegister());

        // Optional: Real-time clear error on typing
        setupTextWatchers();
    }

    private void setupTextWatchers() {
        TextWatcher commonWatcher = new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int count, int after) {
                clearErrors();
            }
            @Override public void afterTextChanged(Editable s) {}
        };
        edtFirstName.addTextChangedListener(commonWatcher);
        edtMiddleName.addTextChangedListener(commonWatcher);
        edtLastName.addTextChangedListener(commonWatcher);
        edtExtension.addTextChangedListener(commonWatcher);
        edtEmail.addTextChangedListener(commonWatcher);
        edtPassword.addTextChangedListener(commonWatcher);
        edtConfirmPassword.addTextChangedListener(commonWatcher);
        edtContactNumber.addTextChangedListener(commonWatcher);
    }

    private void clearErrors() {
        errFirstName.setVisibility(View.GONE);
        errLastName.setVisibility(View.GONE);
        errExtension.setVisibility(View.GONE);
        errEmail.setVisibility(View.GONE);
        errPassword.setVisibility(View.GONE);
        errConfirmPassword.setVisibility(View.GONE);
        errContact.setVisibility(View.GONE);
    }

    private boolean validate() {
        boolean isValid = true;
        clearErrors();

        String fName = edtFirstName.getText().toString().trim();
        String lName = edtLastName.getText().toString().trim();
        String extension = edtExtension.getText().toString().trim();
        String email = edtEmail.getText().toString().trim();
        String pass = edtPassword.getText().toString().trim();
        String confPass = edtConfirmPassword.getText().toString().trim();
        String contact = edtContactNumber.getText().toString().trim();

        if (fName.isEmpty()) {
            errFirstName.setVisibility(View.VISIBLE);
            isValid = false;
        }
        if (lName.isEmpty()) {
            errLastName.setVisibility(View.VISIBLE);
            isValid = false;
        }

        if (contact.isEmpty()) {
            errContact.setVisibility(View.VISIBLE);
            isValid = false;
        }
        if (email.isEmpty() || !Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            errEmail.setVisibility(View.VISIBLE);
            isValid = false;
        }
        if (pass.length() < 8) {
            errPassword.setVisibility(View.VISIBLE);
            isValid = false;
        }
        if (!confPass.equals(pass)) {
            errConfirmPassword.setVisibility(View.VISIBLE);
            isValid = false;
        }

        return isValid;
    }

    private void attemptRegister() {
        if (!validate()) return;

        setLoading(true);
        String fName = edtFirstName.getText().toString().trim();
        String mName = edtMiddleName.getText().toString().trim();
        String lName = edtLastName.getText().toString().trim();
        String extension = edtExtension.getText().toString().trim();
        String email = edtEmail.getText().toString().trim();
        String pass = edtPassword.getText().toString().trim();
        String contact = edtContactNumber.getText().toString().trim();

        // This method call now hits the 'responder_accounts' collection because
        // we updated the URL inside PocketBaseApiHelper.java
        apiHelper.registerAdmin(fName, mName, lName, email, pass, contact, extension, new PocketBaseApiHelper.SimpleCallback() {
            @Override
            public void onSuccess() {
                setLoading(false);
                showSuccessDialog();
            }

            @Override
            public void onError(String message) {
                setLoading(false);
                // In case of server error (e.g. email already exists)
                new AlertDialog.Builder(RegisterActivity.this)
                        .setTitle("Registration Error")
                        .setMessage(message)
                        .setPositiveButton("OK", null)
                        .show();
            }
        });
    }

    private void showSuccessDialog() {
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_success, null);
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setView(dialogView)
                .setCancelable(false)
                .create();

        Button btnOk = dialogView.findViewById(R.id.btnSuccessOk);
        btnOk.setOnClickListener(v -> {
            dialog.dismiss();
            finish();
        });

        dialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        dialog.show();
    }

    private void setLoading(boolean loading) {
        progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        btnRegister.setEnabled(!loading);
    }
}