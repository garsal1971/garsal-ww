package com.garsal.fitinjector

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.fitness.Fitness
import com.google.android.gms.fitness.FitnessOptions
import com.google.android.gms.fitness.data.DataPoint
import com.google.android.gms.fitness.data.DataSet
import com.google.android.gms.fitness.data.DataSource
import com.google.android.gms.fitness.data.DataType
import com.google.android.gms.fitness.data.Field
import com.google.android.gms.fitness.request.DataReadRequest
import java.io.File
import java.util.Calendar
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "FitStepsInjector"
        private const val RC_SIGN_IN = 1001
        private const val RC_STORAGE_PERMISSION = 1002
        private const val RC_MANAGE_STORAGE = 1003
        private const val RC_ACTIVITY_RECOGNITION = 1004
        private const val RESULT_FILE = "/sdcard/steps_result.txt"
    }

    private lateinit var statusText: TextView
    private lateinit var currentStepsText: TextView
    private lateinit var accountText: TextView
    private lateinit var stepsInput: EditText
    private lateinit var injectButton: Button
    private lateinit var refreshButton: Button
    private lateinit var disconnectButton: Button

    private var pendingSteps: Int = -1
    private var pendingAction: PendingAction = PendingAction.NONE

    private enum class PendingAction { NONE, READ, INJECT }

    private val fitnessOptions: FitnessOptions by lazy {
        FitnessOptions.builder()
            .addDataType(DataType.TYPE_STEP_COUNT_DELTA, FitnessOptions.ACCESS_WRITE)
            .addDataType(DataType.AGGREGATE_STEP_COUNT_DELTA, FitnessOptions.ACCESS_READ)
            .build()
    }

    private val signInClient by lazy {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .addExtension(fitnessOptions)
            .build()
        GoogleSignIn.getClient(this, gso)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.statusText)
        currentStepsText = findViewById(R.id.currentStepsText)
        accountText = findViewById(R.id.accountText)
        stepsInput = findViewById(R.id.stepsInput)
        injectButton = findViewById(R.id.injectButton)
        refreshButton = findViewById(R.id.refreshButton)
        disconnectButton = findViewById(R.id.disconnectButton)

        showAccount(GoogleSignIn.getLastSignedInAccount(this))
        currentStepsText.text = "..."
        stepsInput.setText((20000..23500).random().toString())

        disconnectButton.setOnClickListener {
            disconnectGoogleFit()
        }

        refreshButton.setOnClickListener {
            pendingAction = PendingAction.READ
            checkGoogleFitAuth()
        }

        injectButton.setOnClickListener {
            val input = stepsInput.text.toString().trim()
            val steps = input.toIntOrNull()
            if (steps == null || steps < 0) {
                Toast.makeText(this, "Inserisci un numero valido di passi", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            pendingSteps = steps
            pendingAction = PendingAction.INJECT
            checkGoogleFitAuth()
        }

        // Carica i passi attuali all'avvio
        pendingAction = PendingAction.READ
        requestActivityRecognitionThenLoad()
    }

    private fun requestActivityRecognitionThenLoad() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.ACTIVITY_RECOGNITION),
                    RC_ACTIVITY_RECOGNITION
                )
                return
            }
        }
        checkGoogleFitAuth()
    }

    private fun checkGoogleFitAuth() {
        signInClient.silentSignIn()
            .addOnSuccessListener { account ->
                showAccount(account)
                if (!GoogleSignIn.hasPermissions(account, fitnessOptions)) {
                    updateStatus("Richiesta autorizzazione Google Fit...")
                    startActivityForResult(signInClient.signInIntent, RC_SIGN_IN)
                } else {
                    executePendingAction(account)
                }
            }
            .addOnFailureListener {
                updateStatus("Accedi con Google Fit...")
                startActivityForResult(signInClient.signInIntent, RC_SIGN_IN)
            }
    }

    private fun showAccount(account: GoogleSignInAccount?) {
        val email = account?.email
            ?: account?.account?.name
            ?: account?.displayName
        accountText.text = email ?: "—"
    }

    private fun executePendingAction(account: GoogleSignInAccount) {
        showAccount(GoogleSignIn.getLastSignedInAccount(this) ?: account)
        when (pendingAction) {
            PendingAction.READ -> readCurrentSteps(account)
            PendingAction.INJECT -> injectSteps(account, pendingSteps)
            PendingAction.NONE -> {}
        }
    }

    private fun readCurrentSteps(account: GoogleSignInAccount) {
        updateStatus("Lettura passi in corso...")
        val calendar = Calendar.getInstance()
        val endTime = calendar.timeInMillis
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        val startTime = calendar.timeInMillis

        val readRequest = DataReadRequest.Builder()
            .aggregate(DataType.TYPE_STEP_COUNT_DELTA, DataType.AGGREGATE_STEP_COUNT_DELTA)
            .setTimeRange(startTime, endTime, TimeUnit.MILLISECONDS)
            .bucketByTime(1, TimeUnit.DAYS)
            .build()

        Fitness.getHistoryClient(this, account)
            .readData(readRequest)
            .addOnSuccessListener { response ->
                var totalSteps = 0
                for (bucket in response.buckets) {
                    for (dataSet in bucket.dataSets) {
                        for (dp in dataSet.dataPoints) {
                            totalSteps += dp.getValue(Field.FIELD_STEPS).asInt()
                        }
                    }
                }
                currentStepsText.text = totalSteps.toString()
                updateStatus("Aggiornato")
                Log.d(TAG, "Passi letti: $totalSteps")
            }
            .addOnFailureListener { e ->
                updateStatus("Errore lettura: ${e.message}")
                Log.e(TAG, "Errore lettura passi", e)
            }
    }

    private fun injectSteps(account: GoogleSignInAccount, steps: Int) {
        updateStatus("Iniezione di $steps passi in corso...")
        injectButton.isEnabled = false

        val calendar = Calendar.getInstance()
        val endTime = calendar.timeInMillis
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        val startTime = calendar.timeInMillis

        val dataSource = DataSource.Builder()
            .setAppPackageName(this)
            .setDataType(DataType.TYPE_STEP_COUNT_DELTA)
            .setStreamName("FitStepsInjector")
            .setType(DataSource.TYPE_RAW)
            .build()

        val dataSet = DataSet.builder(dataSource)
            .add(
                DataPoint.builder(dataSource)
                    .setField(Field.FIELD_STEPS, steps)
                    .setTimeInterval(startTime, endTime, TimeUnit.MILLISECONDS)
                    .build()
            )
            .build()

        Fitness.getHistoryClient(this, account)
            .insertData(dataSet)
            .addOnSuccessListener {
                writeResult("OK:$steps")
                updateStatus("✓ $steps passi inseriti con successo!")
                currentStepsText.text = steps.toString()
                stepsInput.text.clear()
                injectButton.isEnabled = true
                Log.d(TAG, "Iniezione riuscita: $steps passi")
            }
            .addOnFailureListener { e ->
                val errorMsg = e.message ?: "Errore sconosciuto"
                writeResult("ERROR:$errorMsg")
                updateStatus("✗ Errore: $errorMsg")
                injectButton.isEnabled = true
                Log.e(TAG, "Iniezione fallita", e)
            }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == RC_MANAGE_STORAGE) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && Environment.isExternalStorageManager()) {
                checkGoogleFitAuth()
            } else {
                updateStatus("Permesso file negato")
            }
            return
        }

        if (requestCode == RC_SIGN_IN) {
            GoogleSignIn.getSignedInAccountFromIntent(data)
                .addOnSuccessListener { account ->
                    showAccount(account)
                    executePendingAction(account)
                }
                .addOnFailureListener { e ->
                    updateStatus("Autorizzazione Google Fit negata")
                    Log.e(TAG, "Sign-in fallito", e)
                }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            RC_STORAGE_PERMISSION -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    checkGoogleFitAuth()
                } else {
                    updateStatus("Permesso storage negato")
                }
            }
            RC_ACTIVITY_RECOGNITION -> {
                // procedi anche se negato (l'errore verrà mostrato al momento della lettura)
                checkGoogleFitAuth()
            }
        }
    }

    private fun disconnectGoogleFit() {
        val client = GoogleSignIn.getClient(this, GoogleSignInOptions.DEFAULT_SIGN_IN)
        client.revokeAccess().addOnCompleteListener {
            client.signOut().addOnCompleteListener {
                currentStepsText.text = "—"
                showAccount(null)
                updateStatus("Disconnesso da Google Fit")
                Log.d(TAG, "Disconnesso da Google Fit")
            }
        }
    }

    private fun writeResult(result: String) {
        try {
            File(RESULT_FILE).writeText(result)
        } catch (e: Exception) {
            Log.e(TAG, "Errore scrittura file risultato: ${e.message}", e)
        }
    }

    private fun updateStatus(msg: String) {
        runOnUiThread { statusText.text = msg }
    }
}
