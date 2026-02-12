package com.example.lagonglongemergencysystem

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Bundle
import android.provider.MediaStore
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

class RegisterStepTwoActivity : AppCompatActivity() {

    // Passengers from Step 1
    private var firstName: String? = null
    private var middleName: String? = null
    private var lastName: String? = null
    private var age: String? = null
    private var contact: String? = null
    private var address: String? = null

    // Photo Storage
    private var selfieBitmap: Bitmap? = null
    private var idBitmap: Bitmap? = null

    // 1. Camera Launcher for SELFIE
    private val takeSelfie = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK) {
            val image = result.data?.extras?.get("data") as Bitmap
            selfieBitmap = image
            findViewById<ImageView>(R.id.iv_selfie_preview).setImageBitmap(image)
        }
    }

    // 2. Camera Launcher for ID PHOTO
    private val takeIdPhoto = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK) {
            val image = result.data?.extras?.get("data") as Bitmap
            idBitmap = image
            findViewById<ImageView>(R.id.iv_id_preview).setImageBitmap(image)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register_step_two)

        // Unpack Data
        firstName = intent.getStringExtra("first_name")
        middleName = intent.getStringExtra("middle_name")
        lastName = intent.getStringExtra("last_name")
        age = intent.getStringExtra("age")
        contact = intent.getStringExtra("contact")
        address = intent.getStringExtra("address")

        // Find Views
        val etEmail = findViewById<EditText>(R.id.reg_email)
        val etPassword = findViewById<EditText>(R.id.reg_password)
        val etConfirmPassword = findViewById<EditText>(R.id.reg_confirm_password)
        val btnRegister = findViewById<Button>(R.id.btn_register)

        // 3. Button Listeners for Camera
        findViewById<Button>(R.id.btn_selfie).setOnClickListener {
            checkPermissionAndLaunchCamera(takeSelfie)
        }
        findViewById<Button>(R.id.btn_id_picture).setOnClickListener {
            checkPermissionAndLaunchCamera(takeIdPhoto)
        }

        btnRegister.setOnClickListener {
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()
            val confirm = etConfirmPassword.text.toString().trim()

            // VALIDATION
            if (email.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Fill in all details", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (password != confirm) {
                Toast.makeText(this, "Passwords do not match!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            // Check if photos are taken
            if (selfieBitmap == null || idBitmap == null) {
                Toast.makeText(this, "Please take both Selfie and ID photo!", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }

            // 4. Convert Bitmaps to Files
            val selfieFile = bitmapToFile(selfieBitmap!!, "selfie.jpg")
            val idFile = bitmapToFile(idBitmap!!, "id_card.jpg")

            // 5. Generate Invisible Username
            val autoUsername = email.split("@")[0] + "_" + (1000..9999).random()

            // 6. Build Request Body
            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                // Personal Info
                .addFormDataPart("first_name", firstName ?: "")
                .addFormDataPart("middle_name", middleName ?: "")
                .addFormDataPart("last_name", lastName ?: "")
                .addFormDataPart("age", age ?: "")
                .addFormDataPart("contact_number", contact ?: "")
                .addFormDataPart("address", address ?: "")
                // Auth Info
                .addFormDataPart("username", autoUsername)
                .addFormDataPart("email", email)
                .addFormDataPart("password", password)
                .addFormDataPart("passwordConfirm", confirm)
                .addFormDataPart("status", "pending")
                // FILES (The new part!)
                .addFormDataPart("selfie", "selfie.jpg", selfieFile.asRequestBody("image/jpeg".toMediaType()))
                .addFormDataPart("id_photo", "id_card.jpg", idFile.asRequestBody("image/jpeg".toMediaType()))
                .build()

            // 7. Send to PocketBase (Emulator IP)
            val request = Request.Builder()
                .url("http://192.168.1.11:8090/api/collections/users/records")
                .post(requestBody)
                .build()

            val client = OkHttpClient()
            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    runOnUiThread {
                        Log.e("NET_ERROR", e.toString())
                        Toast.makeText(applicationContext, "Upload Failed! Check Logcat.", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onResponse(call: Call, response: Response) {
                    val bodyString = response.body?.string()
                    runOnUiThread {
                        if (response.isSuccessful) {
                            Toast.makeText(applicationContext, "Registration Success! Wait for approval.", Toast.LENGTH_LONG).show()
                            finish()
                        } else {
                            Log.e("PB_ERROR", "Code: ${response.code} | Body: $bodyString")
                            Toast.makeText(applicationContext, "Server Error: ${response.code}", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            })
        }
    }

    // Helper: Convert Bitmap to File for Upload
    private fun bitmapToFile(bitmap: Bitmap, fileName: String): File {
        val file = File(cacheDir, fileName)
        file.createNewFile()
        val bos = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 80, bos) // Quality 80 is good for mobile
        val fos = FileOutputStream(file)
        fos.write(bos.toByteArray())
        fos.flush()
        fos.close()
        return file
    }

    // Helper: Check Permission
    private fun checkPermissionAndLaunchCamera(launcher: androidx.activity.result.ActivityResultLauncher<Intent>) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
            launcher.launch(intent)
        } else {
            // If permission denied, ask for it (You can add requestPermission logic here if needed)
            Toast.makeText(this, "Camera Permission Required", Toast.LENGTH_SHORT).show()
        }
    }
}