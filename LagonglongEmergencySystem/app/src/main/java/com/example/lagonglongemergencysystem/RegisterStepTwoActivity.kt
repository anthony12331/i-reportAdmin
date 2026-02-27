package com.example.lagonglongemergencysystem

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Bundle
import android.provider.MediaStore
import android.text.method.HideReturnsTransformationMethod
import android.text.method.PasswordTransformationMethod
import android.util.Log
import android.view.MotionEvent
import android.widget.*
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
    private var extension: String? = null
    private var age: String? = null
    private var contact: String? = null
    private var baranggay: String? = null
    private var municipality: String? = null
    private var province: String? = null

    // Photo Storage
    private var selfieBitmap: Bitmap? = null
    private var idBitmap: Bitmap? = null

    // Toggles for Password Visibility
    private var isPasswordVisible = false
    private var isConfirmVisible = false

    // 1. Permission Request Handler
    private val requestCameraPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
        if (isGranted) {
            Toast.makeText(this, "Camera access granted! Click the button again.", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Permission Denied. We cannot take photos.", Toast.LENGTH_SHORT).show()
        }
    }

    // 2. Camera Launchers
    private val takeSelfie = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK) {
            val image = result.data?.extras?.get("data") as Bitmap
            selfieBitmap = image
            findViewById<ImageView>(R.id.iv_selfie_preview).setImageBitmap(image)
        }
    }

    private val takeIdPhoto = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK) {
            val image = result.data?.extras?.get("data") as Bitmap
            idBitmap = image
            findViewById<ImageView>(R.id.iv_id_preview).setImageBitmap(image)
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register_step_two)

        // Unpack Data (Matched keys exactly with Step 1)
        firstName = intent.getStringExtra("first_name")
        middleName = intent.getStringExtra("middle_name")
        lastName = intent.getStringExtra("last_name")
        extension = intent.getStringExtra("extension")
        age = intent.getStringExtra("age")
        contact = intent.getStringExtra("contact")
        // NOTE: Make sure this key matches Step 1 exactly!
        baranggay = intent.getStringExtra("baranggay") ?: intent.getStringExtra("barangay")
        municipality = intent.getStringExtra("municipality")
        province = intent.getStringExtra("province")

        // Find Views
        val etEmail = findViewById<EditText>(R.id.reg_email)
        val etPassword = findViewById<EditText>(R.id.reg_password)
        val etConfirmPassword = findViewById<EditText>(R.id.reg_confirm_password)
        val btnRegister = findViewById<Button>(R.id.btn_register)

        // --- PASSWORD VISIBILITY TOGGLE LOGIC ---
        // 1. Main Password Toggle
        etPassword.setOnTouchListener { v, event ->
            if (event.action == MotionEvent.ACTION_UP) {
                // Check if touch is on the "Eye" icon (Drawable End)
                if (event.rawX >= (etPassword.right - etPassword.compoundDrawables[2].bounds.width())) {
                    isPasswordVisible = !isPasswordVisible
                    if (isPasswordVisible) {
                        etPassword.transformationMethod = HideReturnsTransformationMethod.getInstance()
                    } else {
                        etPassword.transformationMethod = PasswordTransformationMethod.getInstance()
                    }
                    return@setOnTouchListener true
                }
            }
            return@setOnTouchListener false
        }

        // 2. Confirm Password Toggle
        etConfirmPassword.setOnTouchListener { v, event ->
            if (event.action == MotionEvent.ACTION_UP) {
                if (event.rawX >= (etConfirmPassword.right - etConfirmPassword.compoundDrawables[2].bounds.width())) {
                    isConfirmVisible = !isConfirmVisible
                    if (isConfirmVisible) {
                        etConfirmPassword.transformationMethod = HideReturnsTransformationMethod.getInstance()
                    } else {
                        etConfirmPassword.transformationMethod = PasswordTransformationMethod.getInstance()
                    }
                    return@setOnTouchListener true
                }
            }
            return@setOnTouchListener false
        }
        // ----------------------------------------

        // Camera Buttons
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
                etConfirmPassword.error = "Passwords do not match!"
                return@setOnClickListener
            }
            // 2. GMAIL CHECK (New Feature)
            if (!email.lowercase().endsWith("@gmail.com")) {
                etEmail.error = "Only @gmail.com addresses are allowed"
                etEmail.requestFocus()
                return@setOnClickListener
            }

            if (selfieBitmap == null || idBitmap == null) {
                Toast.makeText(this, "Please take both Selfie and ID photo!", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }

            // 4. Convert Bitmaps to Files
            val selfieFile = bitmapToFile(selfieBitmap!!, "selfie.jpg")
            val idFile = bitmapToFile(idBitmap!!, "id_card.jpg")

            // 5. Generate Invisible Username
            val autoUsername = email.split("@")[0] + "_" + (1000..9999).random()

            // 6. Build Request Body (MATCHING POCKETBASE COLUMNS)
            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                // Personal Info
                .addFormDataPart("first_name", firstName ?: "")
                .addFormDataPart("middle_name", middleName ?: "")
                .addFormDataPart("extension", extension ?: "")
                .addFormDataPart("last_name", lastName ?: "")
                .addFormDataPart("age", age ?: "")
                .addFormDataPart("contact_number", contact ?: "") // Check PB column name
                .addFormDataPart("baranggay", baranggay ?: "")    // Check PB column name
                .addFormDataPart("municipality", municipality ?: "")
                .addFormDataPart("province", province ?: "")
                // Auth Info
                .addFormDataPart("username", autoUsername)
                .addFormDataPart("email", email)
                .addFormDataPart("password", password)
                .addFormDataPart("passwordConfirm", confirm)
                .addFormDataPart("status", "pending")
                // FILES
                .addFormDataPart("selfie", "selfie.jpg", selfieFile.asRequestBody("image/jpeg".toMediaType()))
                .addFormDataPart("id_photo", "id_card.jpg", idFile.asRequestBody("image/jpeg".toMediaType()))
                .build()

            // 7. Send to PocketBase
            val request = Request.Builder()
                .url("http://192.168.0.131:8090/api/collections/users/records")
                .post(requestBody)
                .build()

            // Disable button to prevent double clicks
            btnRegister.isEnabled = false
            btnRegister.text = "UPLOADING..."

            val client = OkHttpClient()
            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    runOnUiThread {
                        btnRegister.isEnabled = true
                        btnRegister.text = "COMPLETE REGISTRATION"
                        Log.e("NET_ERROR", e.toString())
                        Toast.makeText(applicationContext, "Upload Failed: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onResponse(call: Call, response: Response) {
                    val bodyString = response.body?.string()
                    runOnUiThread {
                        btnRegister.isEnabled = true
                        btnRegister.text = "COMPLETE REGISTRATION"

                        if (response.isSuccessful) {
                            Toast.makeText(applicationContext, "Registration Success! Wait for approval.", Toast.LENGTH_LONG).show()
                            finish() // Close activity
                        } else {
                            Log.e("PB_ERROR", "Code: ${response.code} | Body: $bodyString")
                            Toast.makeText(applicationContext, "Server Error: ${response.code}", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            })
        }
    }

    // Helper: Convert Bitmap to File
    private fun bitmapToFile(bitmap: Bitmap, fileName: String): File {
        val file = File(cacheDir, fileName)
        file.createNewFile()
        val bos = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 80, bos)
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
            // Updated: Properly asks for permission now
            requestCameraPermission.launch(Manifest.permission.CAMERA)
        }
    }
}