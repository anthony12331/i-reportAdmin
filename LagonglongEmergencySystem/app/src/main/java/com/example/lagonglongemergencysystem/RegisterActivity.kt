package com.example.lagonglongemergencysystem

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class RegisterActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register)

        // 1. Find all the views
        val etfirstName = findViewById<EditText>(R.id.reg_first_name)
        val etmiddleName = findViewById<EditText>(R.id.reg_middle_name)
        val etlastName = findViewById<EditText>(R.id.reg_last_name)
        val etage = findViewById<EditText>(R.id.reg_age)
        val etcontact = findViewById<EditText>(R.id.reg_contact)
        val etaddress = findViewById<EditText>(R.id.reg_address)

        val btnNext = findViewById<Button>(R.id.btn_next)

        btnNext.setOnClickListener {
            // 2. Get the current text and remove extra spaces
            val firstName = etfirstName.text.toString().trim()
            val middleName = etmiddleName.text.toString().trim()
            val lastName = etlastName.text.toString().trim()
            val age = etage.text.toString().trim()
            val contact = etcontact.text.toString().trim()
            val address = etaddress.text.toString().trim()

            // 3. VALIDATION: Check if fields are empty
            if (firstName.isEmpty()) {
                etfirstName.error = "First name is required"
                etfirstName.requestFocus()
                return@setOnClickListener
            }

            if (lastName.isEmpty()) {
                etlastName.error = "Last name is required"
                etlastName.requestFocus()
                return@setOnClickListener
            }

            if (age.isEmpty()) {
                etage.error = "Age is required"
                etage.requestFocus()
                return@setOnClickListener
            }

            if (contact.isEmpty()) {
                etcontact.error = "Contact number is required"
                etcontact.requestFocus()
                return@setOnClickListener
            }

            if (address.isEmpty()) {
                etaddress.error = "Address is required"
                etaddress.requestFocus()
                return@setOnClickListener
            }

            // Note: Middle Name is usually optional, so we don't block the user if it's empty.
            // If you want it mandatory, just add the same check for middleName.

            // 4. If all validations pass, Create the Intent
            val nextScreenIntent = Intent(this, RegisterStepTwoActivity::class.java)

            // 5. Put the verified data into the Intent
            nextScreenIntent.putExtra("first_name", firstName)
            nextScreenIntent.putExtra("middle_name", middleName)
            nextScreenIntent.putExtra("last_name", lastName)
            nextScreenIntent.putExtra("age", age)
            nextScreenIntent.putExtra("contact", contact)
            nextScreenIntent.putExtra("address", address)

            // 6. Launch the next screen
            startActivity(nextScreenIntent)
        }
    }
}