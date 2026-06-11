package com.garsal.fitinjector

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Foreground service che fornisce una posizione GPS fasulla stabile.
 *
 * Problema risolto: il drift tra posizione reale e fasulla era causato dal fatto
 * che il test provider smetteva di inviare aggiornamenti, e dopo qualche secondo
 * il sistema tornava alla posizione GPS reale.
 *
 * Soluzione: un Handler ripete setTestProviderLocation() ogni INTERVAL_MS ms per
 * tutti i provider (gps, network, passive). Questo mantiene la posizione fasulla
 * sempre "fresca" e impedisce il fallback al GPS reale.
 *
 * Prerequisito: nelle Opzioni Sviluppatore del telefono, impostare questa app
 * come "App per posizione fittizia".
 *
 * Avvio da ADB:
 *   adb shell am startservice -n com.garsal.fitinjector/.MockLocationService
 *   adb shell am startservice -n com.garsal.fitinjector/.MockLocationService \
 *       --ef lat 45.4654219 --ef lng 9.1859243
 * Stop da ADB:
 *   adb shell am stopservice -n com.garsal.fitinjector/.MockLocationService
 */
class MockLocationService : Service() {

    companion object {
        private const val TAG            = "MockLocationService"
        private const val CHANNEL_ID     = "mock_location_channel"
        private const val NOTIF_ID       = 42
        private const val INTERVAL_MS    = 1500L   // aggiorna ogni 1,5 s

        // Posizione default (Milano) – sovrascrivibile via extra Intent
        private const val DEFAULT_LAT    = 45.4654219
        private const val DEFAULT_LNG    = 9.1859243
        private const val DEFAULT_ALT    = 122.0
        private const val ACCURACY_M     = 4.0f

        // Provider da simulare (tutti, così FusedLocationProvider li raccoglie)
        private val PROVIDERS = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        )

        const val EXTRA_LAT = "lat"
        const val EXTRA_LNG = "lng"
    }

    private lateinit var locationManager: LocationManager
    private val handler = Handler(Looper.getMainLooper())
    private var fakeLat = DEFAULT_LAT
    private var fakeLng = DEFAULT_LNG

    private val pushTask = object : Runnable {
        override fun run() {
            pushFakeLocation()
            handler.postDelayed(this, INTERVAL_MS)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager
        startForeground(NOTIF_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        fakeLat = intent?.getDoubleExtra(EXTRA_LAT, DEFAULT_LAT) ?: DEFAULT_LAT
        fakeLng = intent?.getDoubleExtra(EXTRA_LNG, DEFAULT_LNG) ?: DEFAULT_LNG

        registerProviders()
        handler.removeCallbacks(pushTask)
        handler.post(pushTask)

        Log.d(TAG, "Mock GPS avviato: lat=$fakeLat lng=$fakeLng")
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(pushTask)
        removeProviders()
        Log.d(TAG, "Mock GPS fermato.")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ─────────────────────────────────────────────────────────────────────────
    // Registra i test provider. Deve avvenire prima di setTestProviderLocation.
    // ─────────────────────────────────────────────────────────────────────────
    private fun registerProviders() {
        for (provider in PROVIDERS) {
            try {
                // Rimuovi provider precedente se esiste, poi ricrea
                if (locationManager.allProviders.contains(provider)) {
                    try { locationManager.removeTestProvider(provider) } catch (_: Exception) {}
                }
                locationManager.addTestProvider(
                    provider,
                    /* requiresNetwork   */ false,
                    /* requiresSatellite */ false,
                    /* requiresCell      */ false,
                    /* hasMonetaryCost   */ false,
                    /* supportsAltitude  */ true,
                    /* supportsSpeed     */ true,
                    /* supportsBearing   */ true,
                    /* powerRequirement  */ android.location.Criteria.POWER_LOW,
                    /* accuracy          */ android.location.Criteria.ACCURACY_FINE
                )
                locationManager.setTestProviderEnabled(provider, true)
            } catch (e: Exception) {
                Log.w(TAG, "addTestProvider $provider: ${e.message}")
            }
        }
    }

    private fun removeProviders() {
        for (provider in PROVIDERS) {
            try {
                locationManager.setTestProviderEnabled(provider, false)
                locationManager.removeTestProvider(provider)
            } catch (_: Exception) {}
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Costruisce la Location e la inietta in tutti i provider.
    // elapsedRealtimeNanos è obbligatorio su Android 7+: senza di esso il
    // sistema considera la location "stale" e torna al GPS reale (drift).
    // ─────────────────────────────────────────────────────────────────────────
    private fun pushFakeLocation() {
        val now = System.currentTimeMillis()
        val elapsedNanos = SystemClock.elapsedRealtimeNanos()

        for (provider in PROVIDERS) {
            try {
                val loc = Location(provider).apply {
                    latitude              = fakeLat
                    longitude             = fakeLng
                    altitude              = DEFAULT_ALT
                    accuracy              = ACCURACY_M
                    time                  = now
                    elapsedRealtimeNanos  = elapsedNanos
                    speed                 = 1.4f   // m/s, passo normale
                    bearing               = 90f
                }
                // API 31+: rimuove il flag isMock che alcune app controllano
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    loc.isMock = false
                }
                locationManager.setTestProviderLocation(provider, loc)
            } catch (e: Exception) {
                Log.w(TAG, "setTestProviderLocation $provider: ${e.message}")
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Notifica persistente (obbligatoria per Foreground Service su API 26+)
    // ─────────────────────────────────────────────────────────────────────────
    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Mock GPS", NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Mock GPS attivo")
            .setContentText("Posizione fasulla in corso — lat=$fakeLat lng=$fakeLng")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
