package com.example.lagonglongemergencysystem

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.widget.Button
import android.widget.PopupMenu
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    // 1. User Session
    private var userId: String? = null
    private var userToken: String? = null

    // 2. Location & File Paths
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var currentPhotoPath: String? = null
    private var currentVideoPath: String? = null
    private var selectedIncidentType: String? = null

    // 3. URIs
    private var photoUri: Uri? = null
    private var videoUri: Uri? = null

    // ----------------------------------------------------------------
    // LAUNCHERS
    // ----------------------------------------------------------------

    // A. Photo Launcher
    private val takePictureLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success) {
            Toast.makeText(this, "Photo Saved! Launching Video...", Toast.LENGTH_SHORT).show()
            launchVideoCamera() // Chain reaction -> Go to Video
        } else {
            Toast.makeText(this, "Report Cancelled.", Toast.LENGTH_SHORT).show()
        }
    }

    // B. Video Launcher (UPDATED: Uses generic Result to allow custom Intent flags)
    private val takeVideoLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            Toast.makeText(this, "Video Saved! Getting GPS...", Toast.LENGTH_SHORT).show()
            checkLocationPermissionAndUpload() // Chain reaction -> Go to GPS/Upload
        } else {
            Toast.makeText(this, "Video skipped. Uploading photo only...", Toast.LENGTH_SHORT).show()
            checkLocationPermissionAndUpload() // Even if video skipped, upload photo
        }
    }

    // C. Permissions
    private val requestCameraPermission = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
        if (permissions[Manifest.permission.CAMERA] == true) {
            launchCamera()
        } else {
            Toast.makeText(this, "Camera permission needed to report.", Toast.LENGTH_SHORT).show()
        }
    }

    private val requestLocationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
        if (isGranted) {
            getCurrentLocationAndUpload()
        } else {
            Toast.makeText(this, "GPS permission needed for location.", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // 4. RETRIEVE LOGIN DATA (Token & ID)
        userId = intent.getStringExtra("USER_ID")
        userToken = intent.getStringExtra("USER_TOKEN")

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        val btnReportMenu = findViewById<Button>(R.id.btn_report_menu)
        val btnLogout = findViewById<Button>(R.id.btn_main_logout)

        btnReportMenu.setOnClickListener { view ->
            val popup = PopupMenu(this, view)
            popup.menu.add("Fire")
            popup.menu.add("Accident")
            popup.menu.add("Flood")
            popup.menu.add("Medical")
            popup.menu.add("Crime")

            popup.setOnMenuItemClickListener { item ->
                selectedIncidentType = item.title.toString().lowercase(Locale.ROOT)
                // Start the Chain: Check Permission -> Photo -> Video -> Upload
                checkCameraPermissionAndLaunch()
                true
            }
            popup.show()
        }

        btnLogout.setOnClickListener {
            val intent = Intent(this, LandingActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            finish()
        }
    }

    // --- STEP 1: PERMISSIONS & PHOTO ---
    private fun checkCameraPermissionAndLaunch() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            launchCamera()
        } else {
            requestCameraPermission.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
        }
    }

    private fun launchCamera() {
        val photoFile: File? = try { createImageFile() } catch (ex: IOException) { null }
        photoFile?.also {
            val uri = FileProvider.getUriForFile(
                this,
                "com.example.lagonglongemergencysystem.fileprovider",
                it
            )
            photoUri = uri
            takePictureLauncher.launch(uri)
        }
    }

    // --- STEP 2: VIDEO (5 Seconds, Low Quality) ---
    private fun launchVideoCamera() {
        val videoFile: File? = try { createVideoFile() } catch (ex: IOException) { null }
        videoFile?.also {
            val uri = FileProvider.getUriForFile(
                this,
                "com.example.lagonglongemergencysystem.fileprovider",
                it
            )
            videoUri = uri

            // STRICT VIDEO INTENT
            val videoIntent = Intent(MediaStore.ACTION_VIDEO_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, uri)
                putExtra(MediaStore.EXTRA_DURATION_LIMIT, 5) // Stop automatically after 5 seconds
                putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 0)  // 0 = Low Quality (Small file size)
            }

            // Verify that the device has a camera app that can handle the intent
            if (videoIntent.resolveActivity(packageManager) != null) {
                takeVideoLauncher.launch(videoIntent)
            } else {
                Toast.makeText(this, "No camera app found for video", Toast.LENGTH_SHORT).show()
                checkLocationPermissionAndUpload() // Skip to upload
            }
        }
    }

    // --- STEP 3: GPS ---
    private fun checkLocationPermissionAndUpload() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            getCurrentLocationAndUpload()
        } else {
            requestLocationPermission.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    private fun getCurrentLocationAndUpload() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return
        }

        Toast.makeText(this, "Acquiring GPS...", Toast.LENGTH_SHORT).show()

        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener { location: Location? ->
                if (location != null) {
                    uploadToPocketBase(location)
                } else {
                    fusedLocationClient.lastLocation.addOnSuccessListener { lastLoc ->
                        if (lastLoc != null) uploadToPocketBase(lastLoc)
                        else Toast.makeText(this, "GPS Failed. Uploading anyway...", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .addOnFailureListener {
                Toast.makeText(this, "GPS Error: ${it.message}", Toast.LENGTH_SHORT).show()
            }
    }

    // --- STEP 4: UPLOAD (Token & Correct Columns) ---
    private fun uploadToPocketBase(location: Location) {
        val imgFile = File(currentPhotoPath ?: "")
        val vidFile = File(currentVideoPath ?: "")

        if (!imgFile.exists()) {
            Toast.makeText(this, "Error: Image file missing", Toast.LENGTH_SHORT).show()
            return
        }

        Toast.makeText(this, "Uploading Report...", Toast.LENGTH_LONG).show()

        val client = OkHttpClient()

        // MULTIPART BUILDER
        val requestBodyBuilder = MultipartBody.Builder()
            .setType(MultipartBody.FORM)

            // CORRECTED COLUMN NAMES (From your screenshots)
            .addFormDataPart("users", userId ?: "")           // Relation to User ID
            .addFormDataPart("type", selectedIncidentType ?: "other") // Fire, Accident, etc.
            .addFormDataPart("status", "pending")             // Default status
            .addFormDataPart("latitude", location.latitude.toString())
            .addFormDataPart("longitude", location.longitude.toString())

            // ADD IMAGE
            .addFormDataPart("incident_image", imgFile.name, imgFile.asRequestBody("image/jpeg".toMediaType()))

        // ADD VIDEO (Only if user recorded it)
        if (vidFile.exists() && vidFile.length() > 0) {
            requestBodyBuilder.addFormDataPart("incident_video", vidFile.name, vidFile.asRequestBody("video/mp4".toMediaType()))
        }

        val request = Request.Builder()
            .url("http://192.168.0.131:8090/api/collections/incident_reports/records")

            // AUTHORIZATION HEADER (The Key!)
            .addHeader("Authorization", "Bearer $userToken")
            .post(requestBodyBuilder.build())
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Upload Failed: Check Server Connection", Toast.LENGTH_LONG).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string()
                runOnUiThread {
                    if (response.isSuccessful) {
                        Toast.makeText(this@MainActivity, "SUCCESS! Report Sent.", Toast.LENGTH_LONG).show()
                    } else {
                        Log.e("UPLOAD_ERROR", "Code: ${response.code}, Body: $body")
                        Toast.makeText(this@MainActivity, "Server Error: ${response.code}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    // --- FILE HELPERS ---
    @Throws(IOException::class)
    private fun createImageFile(): File {
        val timeStamp: String = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir: File? = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile("JPEG_${timeStamp}_", ".jpg", storageDir).apply {
            currentPhotoPath = absolutePath
        }
    }

    @Throws(IOException::class)
    private fun createVideoFile(): File {
        val timeStamp: String = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir: File? = getExternalFilesDir(Environment.DIRECTORY_MOVIES)
        return File.createTempFile("VID_${timeStamp}_", ".mp4", storageDir).apply {
            currentVideoPath = absolutePath
        }
    }
}