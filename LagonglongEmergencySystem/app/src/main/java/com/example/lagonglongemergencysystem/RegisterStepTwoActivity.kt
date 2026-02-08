package com.example.lagonglongemergencysystem

import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import java.io.IOException

class RegisterStepTwoActivity : AppCompatActivity() {

    // Passengers from Step 1
    private var firstName: String? = null
    private var middleName: String? = null
    private var lastName: String? = null
    private var age: String? = null
    private var contact: String? = null
    private var address: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register_step_two)

        // 1. Unpack Step 1 Data
        firstName = intent.getStringExtra("first_name")
        middleName = intent.getStringExtra("middle_name")
        lastName = intent.getStringExtra("last_name")
        age = intent.getStringExtra("age")
        contact = intent.getStringExtra("contact")
        address = intent.getStringExtra("address")

        // 2. Find Step 2 Account Views
        // Ensure these IDs exist in your XML!
        val etUsername = findViewById<EditText>(R.id.reg_username)
        val etEmail = findViewById<EditText>(R.id.reg_email)
        val etPassword = findViewById<EditText>(R.id.reg_password)
        val etConfirmPassword = findViewById<EditText>(R.id.reg_confirm_password)
        val btnRegister = findViewById<Button>(R.id.btn_register)

        // Note: I removed the Camera Buttons logic. They will just do nothing if clicked.

        btnRegister.setOnClickListener {
            val username = etUsername.text.toString().trim()
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()
            val confirm = etConfirmPassword.text.toString().trim()

            // Basic Validation
            if (username.isEmpty() || email.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Fill in all account details", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (password != confirm) {
                Toast.makeText(this, "Passwords do not match!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // 3. Build Request Body (TEXT ONLY - No Files)
            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                // Personal Info
                .addFormDataPart("first_name", firstName ?: "")
                .addFormDataPart("middle_name", middleName ?: "")
                .addFormDataPart("last_name", lastName ?: "")
                .addFormDataPart("age", age ?: "")
                .addFormDataPart("contact_number", contact ?: "") // Matches your DB field
                .addFormDataPart("address", address ?: "")
                // Auth Info
                .addFormDataPart("username", username)
                .addFormDataPart("email", email)
                .addFormDataPart("password", password)
                .addFormDataPart("passwordConfirm", confirm)
                .addFormDataPart("status", "pending")
                .build()

            // 4. Execute API Call
            // FIX: Use 10.0.2.2 for Emulator and removed double port error
            val request = Request.Builder()
                .url("http://10.0.2.2:8090/api/collections/users/records")
                .post(requestBody)
                .build()

            val client = OkHttpClient()
            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    runOnUiThread {
                        Log.e("NET_ERROR", e.toString())
                        Toast.makeText(applicationContext, "Connection Failed!", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onResponse(call: Call, response: Response) {
                    val bodyString = response.body?.string()
                    runOnUiThread {
                        if (response.isSuccessful) {
                            Toast.makeText(applicationContext, "Success! Text data sent.", Toast.LENGTH_LONG).show()
                            // Finish and go back to Login or Main
                            finish()
                        } else {
                            // Log the exact error from PocketBase
                            Log.e("PB_ERROR", "Code: ${response.code} | Body: $bodyString")
                            Toast.makeText(applicationContext, "Server Error: ${response.code}", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            })
        }
    }
}