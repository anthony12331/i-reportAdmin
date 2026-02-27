package com.example.lagonglongemergencysystem

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class LoginActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        val etEmail = findViewById<EditText>(R.id.et_login_email)
        val etPassword = findViewById<EditText>(R.id.et_login_password)
        val btnLogin = findViewById<Button>(R.id.btn_login_submit)
        val btnBack = findViewById<Button>(R.id.btn_login_back)

        // Navigation: Go back to LandingActivity
        btnBack.setOnClickListener {
            val intent = Intent(this, LandingActivity::class.java)
            startActivity(intent)
            finish()
        }

        btnLogin.setOnClickListener {
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (email.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Please enter all details", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            loginUser(email, password)
        }
    }

    private fun loginUser(email: String, pass: String) {
        val client = OkHttpClient()
        val json = JSONObject()
        json.put("identity", email)
        json.put("password", pass)

        val mediaType = "application/json; charset=utf-8".toMediaType()
        val body = json.toString().toRequestBody(mediaType)

        val request = Request.Builder()
            .url("http://192.168.0.131:8090/api/collections/users/auth-with-password")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    Toast.makeText(this@LoginActivity, "Connection Error: Check server", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseData = response.body?.string()

                runOnUiThread {
                    if (response.isSuccessful && responseData != null) {
                        try {
                            // 1. Parse the full JSON response
                            val jsonResponse = JSONObject(responseData)

                            // 2. EXTRACT THE TOKEN (The "Security Badge")
                            val token = jsonResponse.getString("token")

                            // 3. Get user details from the 'record' object inside the response
                            val userObj = jsonResponse.getJSONObject("record")
                            val status = userObj.getString("status")
                            val userId = userObj.getString("id")

                            if (status == "verified") {
                                Toast.makeText(this@LoginActivity, "Login Successful!", Toast.LENGTH_SHORT).show()

                                val intent = Intent(this@LoginActivity, MainActivity::class.java)
                                // 4. PASS BOTH ID AND TOKEN TO HOME PAGE
                                intent.putExtra("USER_ID", userId)
                                intent.putExtra("USER_TOKEN", token)
                                startActivity(intent)
                                finish()
                            } else {
                                Toast.makeText(this@LoginActivity, "Account pending admin approval.", Toast.LENGTH_LONG).show()
                            }
                        } catch (e: Exception) {
                            Log.e("LOGIN_ERROR", e.toString())
                            Toast.makeText(this@LoginActivity, "Error processing server response", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Toast.makeText(this@LoginActivity, "Invalid login credentials", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }
}