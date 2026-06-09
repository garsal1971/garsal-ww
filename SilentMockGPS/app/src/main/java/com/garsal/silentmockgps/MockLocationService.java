package com.garsal.silentmockgps;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.location.Criteria;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

import java.util.ArrayList;
import java.util.List;

public class MockLocationService extends Service {

    private static final String TAG = "SilentMockGPS";
    private static final String CHANNEL_ID = "silentmockgps";
    private static final int NOTIF_ID = 1;

    public static final String ACTION_START  = "com.garsal.silentmockgps.START";
    public static final String ACTION_STOP   = "com.garsal.silentmockgps.STOP";
    public static final String ACTION_STATUS = "com.garsal.silentmockgps.STATUS";

    public static final String EXTRA_COORDS  = "coords";
    public static final String EXTRA_SECONDS = "seconds";
    public static final String EXTRA_MINUTES = "minutes";

    private static volatile boolean running = false;

    private Handler handler;
    private Runnable cycleRunnable;
    private long stopAt = 0;

    public static boolean isRunning() { return running; }

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction();
        if (action == null) return START_NOT_STICKY;

        switch (action) {
            case ACTION_START:
                String coordsRaw = intent.getStringExtra(EXTRA_COORDS);
                int seconds = intent.getIntExtra(EXTRA_SECONDS, 30);
                int minutes = intent.getIntExtra(EXTRA_MINUTES, 30);
                startCycle(coordsRaw, seconds, minutes);
                break;
            case ACTION_STOP:
                stopCycle();
                stopSelf();
                break;
        }
        return START_NOT_STICKY;
    }

    private void startCycle(String coordsRaw, int secondsPerCoord, int totalMinutes) {
        List<double[]> coords = parseCoords(coordsRaw);
        if (coords.isEmpty()) {
            sendStatus("Errore: nessuna coordinata valida", false);
            stopSelf();
            return;
        }

        startForeground(NOTIF_ID, buildNotification("Avvio ciclo GPS..."));
        running = true;

        stopAt = System.currentTimeMillis() + (long) totalMinutes * 60 * 1000;
        final int[] index = {0};

        cycleRunnable = new Runnable() {
            @Override
            public void run() {
                if (!running || System.currentTimeMillis() >= stopAt) {
                    stopCycle();
                    stopSelf();
                    return;
                }

                double[] coord = coords.get(index[0] % coords.size());
                double lat = coord[0];
                double lon = coord[1];
                setMockLocation(lat, lon);

                long remaining = (stopAt - System.currentTimeMillis()) / 1000;
                String msg = String.format("📍 %.4f, %.4f | %ds per coord | %ds rimasti",
                        lat, lon, secondsPerCoord, remaining);
                sendStatus(msg, true);
                updateNotification(msg);

                index[0]++;
                handler.postDelayed(this, secondsPerCoord * 1000L);
            }
        };

        handler.post(cycleRunnable);
        Log.d(TAG, "Ciclo avviato: " + coords.size() + " coordinate, " + secondsPerCoord + "s, " + totalMinutes + "min");
    }

    private void stopCycle() {
        running = false;
        if (cycleRunnable != null) {
            handler.removeCallbacks(cycleRunnable);
            cycleRunnable = null;
        }
        sendStatus("Fermato.", false);
        Log.d(TAG, "Ciclo fermato");
    }

    private void setMockLocation(double lat, double lon) {
        LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        if (lm == null) return;
        pushMock(lm, LocationManager.GPS_PROVIDER, lat, lon);
        pushMock(lm, LocationManager.NETWORK_PROVIDER, lat, lon);
    }

    private void pushMock(LocationManager lm, String provider, double lat, double lon) {
        try {
            lm.addTestProvider(provider, false, false, false, false,
                    true, true, true, Criteria.POWER_LOW, Criteria.ACCURACY_FINE);
        } catch (IllegalArgumentException ignored) {}
        try {
            lm.setTestProviderEnabled(provider, true);
        } catch (SecurityException e) {
            sendStatus("Errore: imposta questa app come Mock Location nelle Opzioni Sviluppatore", false);
            stopCycle();
            stopSelf();
            return;
        }
        Location loc = new Location(provider);
        loc.setLatitude(lat);
        loc.setLongitude(lon);
        loc.setAltitude(0.0);
        loc.setAccuracy(1.0f);
        loc.setTime(System.currentTimeMillis());
        loc.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());
        lm.setTestProviderLocation(provider, loc);
    }

    private List<double[]> parseCoords(String raw) {
        List<double[]> list = new ArrayList<>();
        if (raw == null) return list;
        for (String line : raw.split("\\n")) {
            line = line.trim();
            if (line.isEmpty()) continue;
            String[] parts = line.split("[,;\\s]+");
            if (parts.length < 2) continue;
            try {
                double lat = Double.parseDouble(parts[0].trim());
                double lon = Double.parseDouble(parts[1].trim());
                list.add(new double[]{lat, lon});
            } catch (NumberFormatException e) {
                Log.w(TAG, "Coordinata ignorata: " + line);
            }
        }
        return list;
    }

    private void sendStatus(String message, boolean isRunning) {
        Intent i = new Intent(ACTION_STATUS);
        i.putExtra("message", message);
        i.putExtra("running", isRunning);
        i.putExtra("stopAt", stopAt);
        sendBroadcast(i);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "SilentMockGPS", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Mock GPS location service");
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification(String text) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return new Notification.Builder(this, CHANNEL_ID)
                    .setContentTitle("SilentMockGPS")
                    .setContentText(text)
                    .setSmallIcon(android.R.drawable.ic_menu_compass)
                    .setOngoing(true)
                    .build();
        } else {
            return new Notification.Builder(this)
                    .setContentTitle("SilentMockGPS")
                    .setContentText(text)
                    .setSmallIcon(android.R.drawable.ic_menu_compass)
                    .setOngoing(true)
                    .build();
        }
    }

    private void updateNotification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification(text));
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
