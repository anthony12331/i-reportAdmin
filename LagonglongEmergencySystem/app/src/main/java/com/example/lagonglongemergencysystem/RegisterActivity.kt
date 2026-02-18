package com.example.lagonglongemergencysystem

import android.content.Intent
import android.os.AsyncTask
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

class RegisterActivity : AppCompatActivity() {

    // Data structures for the Dropdowns
    // Map: "Lagonglong" -> "1004313000" (Code needed to fetch barangays)
    private val municipalityMap = HashMap<String, String>()
    private val barangayList = ArrayList<String>()

    private lateinit var spinnerMunicipality: Spinner
    private lateinit var spinnerBarangay: Spinner

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register)

        // 1. Find all the views
        val etFirstName = findViewById<EditText>(R.id.reg_first_name)
        val etMiddleName = findViewById<EditText>(R.id.reg_middle_name)
        val etLastName = findViewById<EditText>(R.id.reg_last_name)
        val etExtension = findViewById<EditText>(R.id.reg_extension)
        val etAge = findViewById<EditText>(R.id.reg_age)
        val etContact = findViewById<EditText>(R.id.reg_contact)

        // Address Spinners
        spinnerMunicipality = findViewById(R.id.spinner_municipality)
        spinnerBarangay = findViewById(R.id.spinner_barangay)

        val btnNext = findViewById<Button>(R.id.btn_next)

        // 2. Load Municipalities for Misamis Oriental immediately
        FetchMunicipalitiesTask().execute()

        // 3. Listener for Municipality Selection
        spinnerMunicipality.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>, view: View?, position: Int, id: Long) {
                val selectedMuniName = parent.getItemAtPosition(position).toString()
                val municipalityCode = municipalityMap[selectedMuniName]

                // Fetch Barangays for this specific municipality
                if (municipalityCode != null) {
                    FetchBarangaysTask().execute(municipalityCode)
                }
            }
            override fun onNothingSelected(parent: AdapterView<*>) {}
        }

        btnNext.setOnClickListener {
            // 4. Get input values
            val firstName = etFirstName.text.toString().trim()
            val middleName = etMiddleName.text.toString().trim() // Optional
            val lastName = etLastName.text.toString().trim()
            val extension = etExtension.text.toString().trim()   // Optional
            val ageStr = etAge.text.toString().trim()
            val contact = etContact.text.toString().trim()

            // Get selected Address from spinners
            val selectedMuni = spinnerMunicipality.selectedItem?.toString() ?: ""
            val selectedBrgy = spinnerBarangay.selectedItem?.toString() ?: ""

            val baranggay = selectedBrgy
            val municipality = selectedMuni
            val province = "Misamis Oriental"


            // 5. VALIDATION LOGIC

            // Check Empty Fields
            if (firstName.isEmpty()) {
                etFirstName.error = "First name is required"
                etFirstName.requestFocus()
                return@setOnClickListener
            }
            if (lastName.isEmpty()) {
                etLastName.error = "Last name is required"
                etLastName.requestFocus()
                return@setOnClickListener
            }

            // --- AGE VALIDATION (Must be 15+) ---
            if (ageStr.isEmpty()) {
                etAge.error = "Age is required"
                etAge.requestFocus()
                return@setOnClickListener
            }
            val age = ageStr.toIntOrNull()
            if (age == null || age < 15) {
                etAge.error = "You must be at least 15 years old to register."
                etAge.requestFocus()
                Toast.makeText(this, "Age must be 15 or above", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // --- MOBILE NUMBER VALIDATION (PH Format) ---
            if (contact.isEmpty()) {
                etContact.error = "Contact number is required"
                etContact.requestFocus()
                return@setOnClickListener
            }
            // Regex: Starts with 09 (11 digits) OR +639 (13 digits)
            val mobilePattern = "^(09|\\+639)\\d{9}$".toRegex()
            if (!mobilePattern.matches(contact)) {
                etContact.error = "Invalid format. Use 09XXXXXXXXX or +639XXXXXXXXX"
                etContact.requestFocus()
                Toast.makeText(this, "Please enter a valid PH mobile number", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Check Dropdown Selection
            if (selectedMuni.isEmpty() || selectedBrgy.isEmpty()) {
                Toast.makeText(this, "Please select your Municipality and Barangay", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }

            // 6. Pass Validated Data to Next Screen
            val nextScreenIntent = Intent(this, RegisterStepTwoActivity::class.java)
            nextScreenIntent.putExtra("first_name", firstName)
            nextScreenIntent.putExtra("middle_name", middleName)
            nextScreenIntent.putExtra("last_name", lastName)
            nextScreenIntent.putExtra("extension", extension)
            nextScreenIntent.putExtra("age", ageStr) // Pass as string
            nextScreenIntent.putExtra("contact", contact)
            nextScreenIntent.putExtra("baranggay", baranggay)
            nextScreenIntent.putExtra("municipality", municipality)
            nextScreenIntent.putExtra("province", province)

            startActivity(nextScreenIntent)
        }
    }

    // --- API TASK 1: Fetch Municipalities of Misamis Oriental ---
    inner class FetchMunicipalitiesTask : AsyncTask<Void, Void, ArrayList<String>>() {
        override fun doInBackground(vararg params: Void?): ArrayList<String> {
            val names = ArrayList<String>()
            try {
                // PSGC API for Misamis Oriental (Province Code: 104300000)
                val url = URL("https://psgc.gitlab.io/api/provinces/104300000/municipalities.json")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"

                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val response = StringBuilder()
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    response.append(line)
                }
                reader.close()

                val jsonArray = JSONArray(response.toString())
                for (i in 0 until jsonArray.length()) {
                    val jsonObj = jsonArray.getJSONObject(i)
                    val name = jsonObj.getString("name")
                    val code = jsonObj.getString("code")

                    municipalityMap[name] = code
                    names.add(name)
                }
                names.sort() // Alphabetical order
            } catch (e: Exception) {
                e.printStackTrace()
            }
            return names
        }

        override fun onPostExecute(result: ArrayList<String>) {
            if (result.isNotEmpty()) {
                val adapter = ArrayAdapter(this@RegisterActivity, android.R.layout.simple_spinner_dropdown_item, result)
                spinnerMunicipality.adapter = adapter
            } else {
                Toast.makeText(this@RegisterActivity, "Failed to load municipalities. Check Internet.", Toast.LENGTH_LONG).show()
            }
        }
    }

    // --- API TASK 2: Fetch Barangays for Selected Municipality ---
    inner class FetchBarangaysTask : AsyncTask<String, Void, ArrayList<String>>() {
        override fun doInBackground(vararg params: String?): ArrayList<String> {
            val code = params[0]
            val bNames = ArrayList<String>()
            try {
                val url = URL("https://psgc.gitlab.io/api/municipalities/$code/barangays.json")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"

                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val response = StringBuilder()
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    response.append(line)
                }
                reader.close()

                val jsonArray = JSONArray(response.toString())
                for (i in 0 until jsonArray.length()) {
                    val jsonObj = jsonArray.getJSONObject(i)
                    bNames.add(jsonObj.getString("name"))
                }
                bNames.sort()
            } catch (e: Exception) {
                e.printStackTrace()
            }
            return bNames
        }

        override fun onPostExecute(result: ArrayList<String>) {
            val adapter = ArrayAdapter(this@RegisterActivity, android.R.layout.simple_spinner_dropdown_item, result)
            spinnerBarangay.adapter = adapter
        }
    }
}