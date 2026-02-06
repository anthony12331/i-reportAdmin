package com.example.lagonglongemergencysystem

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.selects.SelectInstance

class RegisterActivity : AppCompatActivity(){
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register)

        //finding views in kotlin

        val etfirstName = findViewById<EditText>(R.id.reg_first_name)
        val etmiddleName = findViewById<EditText>(R.id.reg_middle_name)
        val etlastName = findViewById<EditText>(R.id.reg_last_name)
        val etage = findViewById<EditText>(R.id.reg_age)
        val etcontact = findViewById<EditText>(R.id.reg_contact)
        val etaddress = findViewById<EditText>(R.id.reg_address)

        val btnNext = findViewById<Button>(R.id.btn_next)

        btnNext.setOnClickListener {
            // 1. Define the "Bridge": From this screen (this) to the next (RegisterStepTwoActivity)
            val nextScreenIntent = Intent(this, RegisterStepTwoActivity::class.java)

            // 2. Put the "Passengers" (data) into the NEW intent
            nextScreenIntent.putExtra("first_name", etfirstName.text.toString())
            nextScreenIntent.putExtra("middle_name", etmiddleName.text.toString())
            nextScreenIntent.putExtra("last_name", etlastName.text.toString())
            nextScreenIntent.putExtra("age", etage.text.toString())
            nextScreenIntent.putExtra("contact", etcontact.text.toString())
            nextScreenIntent.putExtra("address", etaddress.text.toString())

            // 3. Launch the new intent
            startActivity(nextScreenIntent)
        }

    }
}