package com.example.lagonglongemergencysystem

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class LandingActivity : AppCompatActivity() {

    private lateinit var tvStatus: TextView
    private lateinit var btnTurnOnNow: Button
    private lateinit var layoutAuth: LinearLayout
    private lateinit var btnLogin: Button
    private lateinit var btnRegister: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_landing)

        tvStatus = findViewById(R.id.tvStatus)
        btnTurnOnNow = findViewById(R.id.btnTurnOnNow)
        layoutAuth = findViewById(R.id.layoutAuth)
        btnLogin = findViewById(R.id.btnLogin)
        btnRegister = findViewById(R.id.btnRegister)

        // Run the permission check immediately
        checkPermissions()

        btnTurnOnNow.setOnClickListener {
            // Request permission standard way
            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }

        btnLogin.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
        }

        btnRegister.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }
    }

    private fun checkPermissions() {
        val fineLocation = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        )

        if (fineLocation == PackageManager.PERMISSION_GRANTED) {
            updateUI(true)
        } else {
            updateUI(false)
        }
    }

    private fun updateUI(isReady: Boolean) {
        if (isReady) {
            layoutAuth.visibility = View.VISIBLE
            btnTurnOnNow.visibility = View.GONE
            tvStatus.text = "Location access granted.\nProceed below."
        } else {
            layoutAuth.visibility = View.GONE
            btnTurnOnNow.visibility = View.VISIBLE
            tvStatus.text = "Location access required for\nemergency services."
        }
    }

    private val locationPermissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { isGranted ->
            if (isGranted) {
                updateUI(true)
            } else {
                Toast.makeText(
                    this,
                    "Permission denied. Location is required.",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }

    override fun onResume() {
        super.onResume()
        checkPermissions()
    }
}