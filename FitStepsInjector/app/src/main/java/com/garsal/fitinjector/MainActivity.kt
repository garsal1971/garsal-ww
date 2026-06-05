package com.garsal.fitinjector

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.fitness.Fitness
import com.google.android.gms.fitness.FitnessOptions
import com.google.android.gms.fitness.data.DataPoint
import com.google.android.gms.fitness.data.DataSet
import com.google.android.gms.fitness.data.DataSource
import com.google.android.gms.fitness.data.DataType
import java.io.File
import java.util.Calendar
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "FitStepsInjector"
        private const val RC_SIGN_IN = 1001
        private const val RC_STORAGE_PERMISSION = 1002
        private const val INPUT_FILE = "/sdcard/steps_input.txt"
        private const val RESULT_FILE = "/sdcard/steps_result.txt"
    }

    private lateinit var statusText: TextView
    private var stepCount: Int = 0

    private val fitnessOptions: FitnessOptions by lazy {
        FitnessOptions.builder()
            .addDataType(DataType.TYPE_STEP_COUNT_DELTA, FitnessOptions.ACCESS_WRITE)
            .addDataType(DataType.AGGREGATE_STEP_COUNT_DELTA, FitnessOptions.ACCESS_WRITE)
            .build()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        statusText = findViewById(R.id.statusText)

        updateStatus("Starting...")
        Log.d(TAG, "onCreate: FitStepsInjector launched")

        // Request storage permissions on Android 6+ (API 23+), not needed for legacy /sdcard on some ROMs
        // but required for general compatibility
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(
                    Manifest.permission.READ_EXTERNAL_STORAGE,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
                ),
                RC_STORAGE_PERMISSION
            )
        } else {
            proceedWithReadingSteps()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == RC_STORAGE_PERMISSION) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                proceedWithReadingSteps()
            } else {
                writeResult("ERROR:Storage permission denied")
                updateStatus("ERROR: Storage permission denied")
                finish()
            }
        }
    }

    private fun proceedWithReadingSteps() {
        // Read step count from input file
        val inputFile = File(INPUT_FILE)
        if (!inputFile.exists()) {
            writeResult("ERROR:Input file not found: $INPUT_FILE")
            updateStatus("ERROR: $INPUT_FILE not found")
            Log.e(TAG, "Input file not found: $INPUT_FILE")
            finish()
            return
        }

        val content = inputFile.readText().trim()
        val parsed = content.toIntOrNull()
        if (parsed == null || parsed < 0) {
            writeResult("ERROR:Invalid step count in file: '$content'")
            updateStatus("ERROR: Invalid step count: '$content'")
            Log.e(TAG, "Invalid step count: '$content'")
            finish()
            return
        }

        stepCount = parsed
        updateStatus("Read $stepCount steps from file. Checking Google Sign-In...")
        Log.d(TAG, "Step count read: $stepCount")

        checkGoogleSignInAndInsert()
    }

    private fun checkGoogleSignInAndInsert() {
        val account = GoogleSignIn.getAccountForExtension(this, fitnessOptions)

        if (!GoogleSignIn.hasPermissions(account, fitnessOptions)) {
            // Need to request OAuth / sign-in
            updateStatus("Requesting Google Fit authorization...")
            Log.d(TAG, "No Fit permissions found, launching sign-in flow")

            GoogleSignIn.requestPermissions(
                this,
                RC_SIGN_IN,
                account,
                fitnessOptions
            )
        } else {
            // Already authorized
            Log.d(TAG, "Already authorized. Inserting steps...")
            insertSteps(account, stepCount)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == RC_SIGN_IN) {
            if (resultCode == RESULT_OK) {
                Log.d(TAG, "Sign-in successful, proceeding to insert steps")
                val account = GoogleSignIn.getAccountForExtension(this, fitnessOptions)
                insertSteps(account, stepCount)
            } else {
                val errorMsg = "Google Sign-In failed or cancelled (resultCode=$resultCode)"
                writeResult("ERROR:$errorMsg")
                updateStatus("ERROR: $errorMsg")
                Log.e(TAG, errorMsg)
                finish()
            }
        }
    }

    private fun insertSteps(account: GoogleSignInAccount, steps: Int) {
        updateStatus("Inserting $steps steps into Google Fit...")
        Log.d(TAG, "insertSteps: count=$steps")

        // Calculate time window: midnight today → now
        val calendar = Calendar.getInstance()
        val endTime = calendar.timeInMillis

        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        val startTime = calendar.timeInMillis

        Log.d(TAG, "Time window: $startTime → $endTime")

        // Build data source
        val dataSource = DataSource.Builder()
            .setAppPackageName(this)
            .setDataType(DataType.TYPE_STEP_COUNT_DELTA)
            .setStreamName("FitStepsInjector - step count")
            .setType(DataSource.TYPE_RAW)
            .build()

        // Build data set with a single data point covering midnight → now
        val dataSet = DataSet.builder(dataSource)
            .add(
                DataPoint.builder(dataSource)
                    .setField(com.google.android.gms.fitness.data.Field.FIELD_STEPS, steps)
                    .setTimeInterval(startTime, endTime, TimeUnit.MILLISECONDS)
                    .build()
            )
            .build()

        // Insert into Google Fit History
        Fitness.getHistoryClient(this, account)
            .insertData(dataSet)
            .addOnSuccessListener {
                val result = "OK:$steps"
                writeResult(result)
                updateStatus("Success! Inserted $steps steps.")
                Log.d(TAG, "insertData success: $result")
                finish()
            }
            .addOnFailureListener { e ->
                val errorMsg = e.message ?: "Unknown error"
                writeResult("ERROR:$errorMsg")
                updateStatus("ERROR: $errorMsg")
                Log.e(TAG, "insertData failed: $errorMsg", e)
                finish()
            }
    }

    private fun writeResult(result: String) {
        try {
            File(RESULT_FILE).writeText(result)
            Log.d(TAG, "Result written to $RESULT_FILE: $result")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to write result file: ${e.message}", e)
        }
    }

    private fun updateStatus(msg: String) {
        runOnUiThread {
            statusText.text = msg
        }
    }
}
