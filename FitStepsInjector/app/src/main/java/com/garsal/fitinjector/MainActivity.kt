package com.garsal.fitinjector

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.fitness.Fitness
import com.google.android.gms.fitness.FitnessOptions
import com.google.android.gms.fitness.data.DataPoint
import com.google.android.gms.fitness.data.DataSet
import com.google.android.gms.fitness.data.DataSource
import com.google.android.gms.fitness.data.DataType
import com.google.android.gms.fitness.data.Field
import com.google.android.material.textfield.TextInputEditText
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "FitStepsInjector"
        private const val RC_SIGN_IN = 1001
        private const val RC_STORAGE_PERMISSION = 1002
        private const val INPUT_FILE = "/sdcard/steps_input.txt"
        private const val RESULT_FILE = "/sdcard/steps_result.txt"
    }

    private lateinit var tvAccountName: TextView
    private lateinit var tvAccountEmail: TextView
    private lateinit var imgAccountIcon: ImageView
    private lateinit var btnSignIn: Button
    private lateinit var btnSignOut: Button
    private lateinit var tvCurrentSteps: TextView
    private lateinit var btnReadSteps: Button
    private lateinit var etStepCount: TextInputEditText
    private lateinit var btnInjectSteps: Button
    private lateinit var tvLog: TextView

    private val fitnessOptions: FitnessOptions by lazy {
        FitnessOptions.builder()
            .addDataType(DataType.TYPE_STEP_COUNT_DELTA, FitnessOptions.ACCESS_WRITE)
            .addDataType(DataType.AGGREGATE_STEP_COUNT_DELTA, FitnessOptions.ACCESS_READ)
            .build()
    }

    private val gso: GoogleSignInOptions by lazy {
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .build()
    }

    private val googleSignInClient: GoogleSignInClient by lazy {
        GoogleSignIn.getClient(this, gso)
    }

    private var adbMode = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvAccountName = findViewById(R.id.tvAccountName)
        tvAccountEmail = findViewById(R.id.tvAccountEmail)
        imgAccountIcon = findViewById(R.id.imgAccountIcon)
        btnSignIn = findViewById(R.id.btnSignIn)
        btnSignOut = findViewById(R.id.btnSignOut)
        tvCurrentSteps = findViewById(R.id.tvCurrentSteps)
        btnReadSteps = findViewById(R.id.btnReadSteps)
        etStepCount = findViewById(R.id.etStepCount)
        btnInjectSteps = findViewById(R.id.btnInjectSteps)
        tvLog = findViewById(R.id.tvLog)

        setupButtons()
        checkAdbModeOrRefreshUI()
    }

    private fun setupButtons() {
        btnSignIn.setOnClickListener { startSignIn() }
        btnSignOut.setOnClickListener { signOut() }
        btnReadSteps.setOnClickListener { readTodaySteps() }
        btnInjectSteps.setOnClickListener { injectStepsFromUI() }

        findViewById<Button>(R.id.btn5k).setOnClickListener { etStepCount.setText("5000") }
        findViewById<Button>(R.id.btn10k).setOnClickListener { etStepCount.setText("10000") }
        findViewById<Button>(R.id.btn15k).setOnClickListener { etStepCount.setText("15000") }
        findViewById<Button>(R.id.btn21k).setOnClickListener { etStepCount.setText("21000") }
    }

    private fun checkAdbModeOrRefreshUI() {
        val inputFile = File(INPUT_FILE)
        if (inputFile.exists()) {
            adbMode = true
            appendLog("Modalità ADB rilevata: $INPUT_FILE")
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
                proceedWithAdbMode()
            }
        } else {
            adbMode = false
            refreshAccountUI()
        }
    }

    private fun proceedWithAdbMode() {
        val inputFile = File(INPUT_FILE)
        val content = inputFile.readText().trim()
        val steps = content.toIntOrNull()
        if (steps == null || steps < 0) {
            val err = "ERROR:Invalid step count: '$content'"
            writeResult(err)
            appendLog(err)
            finish()
            return
        }
        appendLog("ADB: $steps passi letti dal file")
        val account = GoogleSignIn.getAccountForExtension(this, fitnessOptions)
        if (!GoogleSignIn.hasPermissions(account, fitnessOptions)) {
            appendLog("ADB: richiesta autorizzazione Google Fit...")
            GoogleSignIn.requestPermissions(this, RC_SIGN_IN, account, fitnessOptions)
        } else {
            insertSteps(account, steps, adb = true)
        }
    }

    private fun refreshAccountUI() {
        val account = GoogleSignIn.getLastSignedInAccount(this)
        val fitAccount = GoogleSignIn.getAccountForExtension(this, fitnessOptions)
        val authorized = GoogleSignIn.hasPermissions(fitAccount, fitnessOptions)

        if (account != null && authorized) {
            tvAccountName.text = account.displayName ?: "Account Google"
            tvAccountEmail.text = account.email ?: ""
            btnSignIn.isEnabled = false
            btnSignOut.isEnabled = true
            btnReadSteps.isEnabled = true
            btnInjectSteps.isEnabled = true
            appendLog("Account: ${account.email}")
        } else {
            tvAccountName.text = "Non connesso"
            tvAccountEmail.text = "Premi Connetti per autorizzare Google Fit"
            btnSignIn.isEnabled = true
            btnSignOut.isEnabled = false
            btnReadSteps.isEnabled = false
            btnInjectSteps.isEnabled = false
        }
    }

    private fun startSignIn() {
        val account = GoogleSignIn.getAccountForExtension(this, fitnessOptions)
        appendLog("Avvio autorizzazione Google Fit...")
        GoogleSignIn.requestPermissions(this, RC_SIGN_IN, account, fitnessOptions)
    }

    private fun signOut() {
        googleSignInClient.signOut().addOnCompleteListener {
            appendLog("Disconnesso")
            refreshAccountUI()
            tvCurrentSteps.text = "—"
        }
    }

    private fun readTodaySteps() {
        val account = GoogleSignIn.getAccountForExtension(this, fitnessOptions)
        appendLog("Lettura passi di oggi...")
        Fitness.getHistoryClient(this, account)
            .readDailyTotal(DataType.TYPE_STEP_COUNT_DELTA)
            .addOnSuccessListener { dataSet ->
                val steps = if (!dataSet.isEmpty) {
                    dataSet.dataPoints.firstOrNull()
                        ?.getValue(Field.FIELD_STEPS)?.asInt() ?: 0
                } else 0
                tvCurrentSteps.text = steps.toString()
                appendLog("Passi oggi: $steps")
            }
            .addOnFailureListener { e ->
                appendLog("Errore lettura passi: ${e.message}")
            }
    }

    private fun injectStepsFromUI() {
        val text = etStepCount.text?.toString()?.trim() ?: ""
        val steps = text.toIntOrNull()
        if (steps == null || steps < 0) {
            appendLog("Errore: inserisci un numero valido di passi")
            return
        }
        val account = GoogleSignIn.getAccountForExtension(this, fitnessOptions)
        insertSteps(account, steps, adb = false)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == RC_STORAGE_PERMISSION) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                proceedWithAdbMode()
            } else {
                writeResult("ERROR:Storage permission denied")
                appendLog("ERROR: Storage permission denied")
                finish()
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == RC_SIGN_IN) {
            if (resultCode == RESULT_OK) {
                appendLog("Autorizzazione Google Fit concessa")
                if (adbMode) {
                    proceedWithAdbMode()
                } else {
                    refreshAccountUI()
                }
            } else {
                val msg = "Sign-in fallito o annullato (resultCode=$resultCode)"
                appendLog("ERROR: $msg")
                if (adbMode) {
                    writeResult("ERROR:$msg")
                    finish()
                }
            }
        }
    }

    private fun insertSteps(account: GoogleSignInAccount, steps: Int, adb: Boolean) {
        appendLog("Inserimento $steps passi in Google Fit...")

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
            .setStreamName("FitStepsInjector - step count")
            .setType(DataSource.TYPE_RAW)
            .build()

        val dataSet = DataSet.create(dataSource)
        val dataPoint = dataSet.createDataPoint()
            .setTimeInterval(startTime, endTime, TimeUnit.MILLISECONDS)
        dataPoint.getValue(Field.FIELD_STEPS).setInt(steps)
        dataSet.add(dataPoint)

        Fitness.getHistoryClient(this, account)
            .insertData(dataSet)
            .addOnSuccessListener {
                val result = "OK:$steps"
                appendLog("Successo! $steps passi inseriti.")
                if (adb) {
                    writeResult(result)
                    finish()
                } else {
                    tvCurrentSteps.text = steps.toString()
                }
            }
            .addOnFailureListener { e ->
                val errorMsg = e.message ?: "Unknown error"
                appendLog("ERROR: $errorMsg")
                if (adb) {
                    writeResult("ERROR:$errorMsg")
                    finish()
                }
            }
    }

    private fun writeResult(result: String) {
        try {
            File(RESULT_FILE).writeText(result)
            Log.d(TAG, "Result written: $result")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to write result file: ${e.message}", e)
        }
    }

    private fun appendLog(msg: String) {
        val time = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        val line = "[$time] $msg"
        Log.d(TAG, line)
        runOnUiThread {
            val current = tvLog.text.toString()
            tvLog.text = if (current == "In attesa...") line else "$current\n$line"
        }
    }
}
