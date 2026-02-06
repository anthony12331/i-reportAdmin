package com.example.lagonglongemergencysystem

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Bundle
import android.provider.MediaStore
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class RegisterStepTwoActivity : AppCompatActivity() {

    private var firstName: String? = null
    // ... other variables remain same

    // Launcher for Selfie
    private val takeselfie = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK) {
            val imageBitmap = result.data?.extras?.get("data") as Bitmap
            // Ensure this ID matches your activity_register_step_two.xml exactly!
            findViewById<ImageView>(R.id.iv_selfie_preview).setImageBitmap(imageBitmap)
        }
    }

    // Launcher for ID
    private val takeIdphoto = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK) {
            val imageBitmap = result.data?.extras?.get("data") as Bitmap
            findViewById<ImageView>(R.id.iv_id_preview).setImageBitmap(imageBitmap)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register_step_two)

        // 1. Link Buttons
        val btnSelfie = findViewById<Button>(R.id.btn_selfie)
        val btnIdPicture = findViewById<Button>(R.id.btn_id_picture)

        // 2. Selfie Button with Permission Check
        btnSelfie.setOnClickListener {
            checkPermissionAndLaunchCamera(takeselfie)
        }

        // 3. ID Button with Permission Check
        btnIdPicture.setOnClickListener {
            checkPermissionAndLaunchCamera(takeIdphoto)
        }

        // ... Catch data and Register logic remain the same
    }

    // A helper function to handle the permission "Gatekeeper"
    private fun checkPermissionAndLaunchCamera(launcher: androidx.activity.result.ActivityResultLauncher<Intent>) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
            launcher.launch(intent)
        } else {
            // If not granted, show a Toast or ask for permission
            Toast.makeText(this, "Please enable Camera permission in Settings", Toast.LENGTH_SHORT).show()
            // Pro Tip: You can also use requestPermissionLauncher here
        }
    }
}