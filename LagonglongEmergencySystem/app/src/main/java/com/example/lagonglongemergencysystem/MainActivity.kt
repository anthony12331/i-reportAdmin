package com.example.lagonglongemergencysystem

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.PopupMenu
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.FileProvider
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority // ADDED THIS IMPORT
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private var userId: String? = null
    private var userToken: String? = null

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var currentPhotoPath: String? = null
    private var selectedIncidentType: String? = null

    private lateinit var btnReportMenu: Button
    private lateinit var btnLogout: Button

    private val takePictureLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success) {
            Toast.makeText(this, "Photo taken! Acquiring GPS signal...", Toast.LENGTH_SHORT).show()
            getCurrentLocationAndUpload()
        } else {
            Toast.makeText(this, "Camera cancelled.", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        userId = intent.getStringExtra("USER_ID")
        userToken = intent.getStringExtra("USER_TOKEN")

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        btnReportMenu = findViewById(R.id.btn_report_menu)
        btnLogout = findViewById(R.id.btn_main_logout)

        btnReportMenu.setOnClickListener { view ->
            showIncidentMenu(view)
        }

        btnLogout.setOnClickListener {
            val intent = Intent(this, LandingActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            finish()
        }
    }

    private fun showIncidentMenu(view: View) {
        val popup = PopupMenu(this, view)
        popup.menu.add("Fire")
        popup.menu.add("Accident")

        popup.setOnMenuItemClickListener { item ->
            selectedIncidentType = item.title.toString().lowercase(Locale.ROOT)
            checkCameraPermissionAndLaunch()
            true
        }
        popup.show()
    }

    private fun checkCameraPermissionAndLaunch() {
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            launchCamera()
        } else {
            requestPermissions(arrayOf(Manifest.permission.CAMERA), 100)
        }
    }

    private fun launchCamera() {
        val photoFile: File? = try {
            createImageFile()
        } catch (ex: IOException) {
            Toast.makeText(this, "Error creating file", Toast.LENGTH_SHORT).show()
            null
        }

        photoFile?.also {
            val photoURI: Uri = FileProvider.getUriForFile(
                this,
                "com.example.lagonglongemergencysystem.fileprovider",
                it
            )
            takePictureLauncher.launch(photoURI)
        }
    }

    @Throws(IOException::class)
    private fun createImageFile(): File {
        val timeStamp: String = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir: File? = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile("JPEG_${timeStamp}_", ".jpg", storageDir).apply {
            currentPhotoPath = absolutePath
        }
    }

    // UPDATED: Use getCurrentLocation instead of lastLocation for high reliability
    private fun getCurrentLocationAndUpload() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "Permission required", Toast.LENGTH_SHORT).show()
            return
        }

        // forces the GPS to wake up and get fresh coordinates immediately
        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener { location: Location? ->
                if (location != null) {
                    uploadToPocketBase(location)
                } else {
                    // Fallback to lastLocation if getCurrentLocation fails
                    fusedLocationClient.lastLocation.addOnSuccessListener { lastLoc ->
                        if (lastLoc != null) {
                            uploadToPocketBase(lastLoc)
                        } else {
                            Toast.makeText(this, "Unable to get location. Please ensure GPS is ON and you are outdoors.", Toast.LENGTH_LONG).show()
                        }
                    }
                }
            }
            .addOnFailureListener { e ->
                Log.e("GPS_ERROR", e.message.toString())
                Toast.makeText(this, "GPS Signal Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
    }

    private fun uploadToPocketBase(location: Location) {
        val file = File(currentPhotoPath ?: "")
        if (!file.exists()) {
            Toast.makeText(this, "Image file not found.", Toast.LENGTH_SHORT).show()
            return
        }

        val client = OkHttpClient()

        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("users", userId ?: "")
            .addFormDataPart("type", selectedIncidentType ?: "other")
            .addFormDataPart("latitude", location.latitude.toString())
            .addFormDataPart("longitude", location.longitude.toString())
            .addFormDataPart("status", "pending")
            .addFormDataPart(
                "incident_image",
                file.name,
                file.asRequestBody("image/jpeg".toMediaType())
            )
            .build()

        val request = Request.Builder()
            .url("http://192.168.1.11:8090/api/collections/incident_reports/records")
            .addHeader("Authorization", "Bearer $userToken")
            .post(requestBody)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Upload Failed: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string()
                runOnUiThread {
                    if (response.isSuccessful) {
                        Toast.makeText(this@MainActivity, "Report Sent Successfully!", Toast.LENGTH_LONG).show()
                    } else {
                        Log.e("UPLOAD_ERROR", "Code: ${response.code}, Body: $body")
                        Toast.makeText(this@MainActivity, "Server Error: ${response.code}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }
}