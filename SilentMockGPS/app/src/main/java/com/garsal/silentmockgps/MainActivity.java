package com.garsal.silentmockgps;

import android.Manifest;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public class MainActivity extends Activity {

    private static final int REQ_LOCATION = 1;
    private static final String PREFS_NAME = "silentmockgps";
    private static final String PREFS_COORDS = "coords";

    private EditText coordinatesInput, secondsInput, minutesInput;
    private Button startButton, stopButton, addCoordsButton, readGpsButton;
    private Button selectAllButton, deleteButton, mapsButton, addToInputButton;
    private TextView statusText, countdownText, emptyTableText;
    private LinearLayout coordTableLayout, statusBar;

    private final List<String> coordList = new ArrayList<>();
    private final Set<Integer> selectedSet = new HashSet<>();
    private long serviceStopAt = 0;

    private final Handler countdownHandler = new Handler(Looper.getMainLooper());
    private Runnable countdownTick;

    private BroadcastReceiver statusReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        coordinatesInput = findViewById(R.id.coordinatesInput);
        secondsInput     = findViewById(R.id.secondsInput);
        minutesInput     = findViewById(R.id.minutesInput);
        startButton      = findViewById(R.id.startButton);
        stopButton       = findViewById(R.id.stopButton);
        addCoordsButton  = findViewById(R.id.addCoordsButton);
        readGpsButton    = findViewById(R.id.readGpsButton);
        selectAllButton  = findViewById(R.id.selectAllButton);
        deleteButton     = findViewById(R.id.deleteButton);
        mapsButton       = findViewById(R.id.mapsButton);
        addToInputButton = findViewById(R.id.addToInputButton);
        statusText       = findViewById(R.id.statusText);
        countdownText    = findViewById(R.id.countdownText);
        emptyTableText   = findViewById(R.id.emptyTableText);
        coordTableLayout = findViewById(R.id.coordTableLayout);
        statusBar        = findViewById(R.id.statusBar);

        startButton.setOnClickListener(v -> onStartClicked());
        stopButton.setOnClickListener(v -> onStopClicked());
        addCoordsButton.setOnClickListener(v -> onAddCoords());
        readGpsButton.setOnClickListener(v -> onReadGps());
        selectAllButton.setOnClickListener(v -> onSelectAll());
        deleteButton.setOnClickListener(v -> onDelete());
        mapsButton.setOnClickListener(v -> onOpenMaps());
        addToInputButton.setOnClickListener(v -> onAddToInput());

        statusReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String msg = intent.getStringExtra("message");
                boolean running = intent.getBooleanExtra("running", false);
                serviceStopAt = intent.getLongExtra("stopAt", 0);
                if (msg != null) statusText.setText(msg);
                setRunningState(running);
                if (running && serviceStopAt > 0) startCountdown();
                if (!running && msg != null && msg.startsWith("Errore")) {
                    statusBar.setVisibility(View.VISIBLE);
                    statusBar.setBackgroundColor(0xFFB71C1C);
                }
            }
        };

        loadCoords();
        buildCoordTable();
        requestLocationPermissions();
    }

    // ---- Persistenza coordinate ----

    private void saveCoords() {
        StringBuilder sb = new StringBuilder();
        for (String c : coordList) {
            if (sb.length() > 0) sb.append("\n");
            sb.append(c);
        }
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit().putString(PREFS_COORDS, sb.toString()).apply();
    }

    private void loadCoords() {
        String saved = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getString(PREFS_COORDS, "");
        coordList.clear();
        if (!saved.isEmpty()) {
            coordList.addAll(Arrays.asList(saved.split("\n")));
        }
    }

    // ---- Tabella coordinate ----

    private void buildCoordTable() {
        coordTableLayout.removeAllViews();
        emptyTableText.setVisibility(coordList.isEmpty() ? View.VISIBLE : View.GONE);
        for (int i = 0; i < coordList.size(); i++) {
            addRowToTable(i);
        }
        updateActionButtons();
    }

    private void addRowToTable(int i) {
        String coord = coordList.get(i);
        boolean selected = selectedSet.contains(i);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(dp(6), 0, dp(6), 0);
        row.setBackgroundColor(selected ? 0xFFE8F5E9 : 0xFFFFFFFF);

        CheckBox cb = new CheckBox(this);
        cb.setMinHeight(0);
        cb.setMinimumHeight(0);
        cb.setPadding(0, dp(2), 0, dp(2));
        cb.setChecked(selected);
        final int idx = i;
        cb.setOnCheckedChangeListener((btn, checked) -> {
            if (checked) selectedSet.add(idx);
            else selectedSet.remove(idx);
            row.setBackgroundColor(checked ? 0xFFE8F5E9 : 0xFFFFFFFF);
            updateActionButtons();
        });

        TextView tv = new TextView(this);
        tv.setText(coord);
        tv.setTextSize(11);
        tv.setTypeface(Typeface.MONOSPACE);
        tv.setPadding(0, dp(2), 0, dp(2));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        lp.setMargins(dp(4), 0, 0, 0);
        tv.setLayoutParams(lp);
        tv.setOnClickListener(v -> cb.setChecked(!cb.isChecked()));

        row.addView(cb);
        row.addView(tv);
        coordTableLayout.addView(row);

        View divider = new View(this);
        divider.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 1));
        divider.setBackgroundColor(0xFFEEEEEE);
        coordTableLayout.addView(divider);
    }

    private void onAddCoords() {
        String raw = coordinatesInput.getText().toString().trim();
        if (raw.isEmpty()) {
            Toast.makeText(this, "Inserisci almeno una coordinata", Toast.LENGTH_SHORT).show();
            return;
        }
        int added = 0;
        for (String line : raw.split("\\n")) {
            line = line.trim();
            if (line.isEmpty()) continue;
            String[] parts = line.split("[,;\\s]+");
            if (parts.length < 2) continue;
            try {
                double lat = Double.parseDouble(parts[0].trim());
                double lon = Double.parseDouble(parts[1].trim());
                coordList.add(String.format(Locale.US, "%.6f, %.6f", lat, lon));
                added++;
            } catch (NumberFormatException ignored) {}
        }
        if (added > 0) {
            coordinatesInput.setText("");
            saveCoords();
            buildCoordTable();
            Toast.makeText(this, added + " coordinate aggiunte", Toast.LENGTH_SHORT).show();
        } else {
            Toast.makeText(this, "Nessuna coordinata valida trovata", Toast.LENGTH_SHORT).show();
        }
    }

    private void onSelectAll() {
        if (selectedSet.size() == coordList.size() && !coordList.isEmpty()) {
            selectedSet.clear();
        } else {
            for (int i = 0; i < coordList.size(); i++) selectedSet.add(i);
        }
        buildCoordTable();
    }

    private void onDelete() {
        List<String> newList = new ArrayList<>();
        for (int i = 0; i < coordList.size(); i++) {
            if (!selectedSet.contains(i)) newList.add(coordList.get(i));
        }
        coordList.clear();
        coordList.addAll(newList);
        selectedSet.clear();
        saveCoords();
        buildCoordTable();
    }

    private void onAddToInput() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < coordList.size(); i++) {
            if (selectedSet.contains(i)) {
                if (sb.length() > 0) sb.append("\n");
                sb.append(coordList.get(i));
            }
        }
        coordinatesInput.setText(sb.toString());
    }

    private void onOpenMaps() {
        if (selectedSet.size() != 1) return;
        int idx = selectedSet.iterator().next();
        String coord = coordList.get(idx);
        String[] parts = coord.split("[,\\s]+");
        if (parts.length >= 2) {
            String lat = parts[0].trim();
            String lon = parts[1].trim();
            Uri uri = Uri.parse("geo:" + lat + "," + lon + "?q=" + lat + "," + lon);
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception e) {
                Toast.makeText(this, "Nessuna app Maps trovata", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void updateActionButtons() {
        boolean hasSelected = !selectedSet.isEmpty();
        deleteButton.setEnabled(hasSelected);
        mapsButton.setEnabled(selectedSet.size() == 1);
        addToInputButton.setEnabled(hasSelected);
        selectAllButton.setText(
                selectedSet.size() == coordList.size() && !coordList.isEmpty() ? "Nessuno" : "Tutti");
    }

    // ---- Servizio ----

    private void onStartClicked() {
        if (coordList.isEmpty()) {
            Toast.makeText(this, "Aggiungi almeno una coordinata nella tabella", Toast.LENGTH_SHORT).show();
            return;
        }
        String secondsRaw = secondsInput.getText().toString().trim();
        String minutesRaw = minutesInput.getText().toString().trim();
        if (secondsRaw.isEmpty() || minutesRaw.isEmpty()) {
            Toast.makeText(this, "Inserisci secondi e minuti", Toast.LENGTH_SHORT).show();
            return;
        }
        int seconds, minutes;
        try {
            seconds = Integer.parseInt(secondsRaw);
            minutes = Integer.parseInt(minutesRaw);
        } catch (NumberFormatException e) {
            Toast.makeText(this, "Valori non validi", Toast.LENGTH_SHORT).show();
            return;
        }
        if (seconds <= 0 || minutes <= 0) {
            Toast.makeText(this, "Secondi e minuti devono essere > 0", Toast.LENGTH_SHORT).show();
            return;
        }

        StringBuilder sb = new StringBuilder();
        for (String c : coordList) {
            if (sb.length() > 0) sb.append("\n");
            sb.append(c);
        }

        Intent service = new Intent(this, MockLocationService.class);
        service.setAction(MockLocationService.ACTION_START);
        service.putExtra(MockLocationService.EXTRA_COORDS, sb.toString());
        service.putExtra(MockLocationService.EXTRA_SECONDS, seconds);
        service.putExtra(MockLocationService.EXTRA_MINUTES, minutes);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(service);
        } else {
            startService(service);
        }
        serviceStopAt = System.currentTimeMillis() + (long) minutes * 60 * 1000;
        setRunningState(true);
        startCountdown();
        statusText.setText("Avvio in corso...");
    }

    private void onStopClicked() {
        Intent service = new Intent(this, MockLocationService.class);
        service.setAction(MockLocationService.ACTION_STOP);
        startService(service);
        setRunningState(false);
        statusText.setText("Fermato.");
    }

    private void setRunningState(boolean running) {
        startButton.setEnabled(!running);
        stopButton.setEnabled(running);
        readGpsButton.setEnabled(!running);
        statusBar.setVisibility(running ? View.VISIBLE : View.GONE);
        if (!running) {
            countdownText.setText("");
            stopCountdown();
        }
    }

    // ---- Countdown ----

    private void startCountdown() {
        stopCountdown();
        countdownTick = new Runnable() {
            @Override
            public void run() {
                long remaining = serviceStopAt - System.currentTimeMillis();
                if (remaining > 0) {
                    long mins = remaining / 60000;
                    long secs = (remaining % 60000) / 1000;
                    countdownText.setText(String.format("%d:%02d", mins, secs));
                    countdownHandler.postDelayed(this, 1000);
                } else {
                    countdownText.setText("0:00");
                }
            }
        };
        countdownHandler.post(countdownTick);
    }

    private void stopCountdown() {
        if (countdownTick != null) {
            countdownHandler.removeCallbacks(countdownTick);
            countdownTick = null;
        }
    }

    // ---- GPS reale ----

    private void onReadGps() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "Permesso posizione non concesso", Toast.LENGTH_SHORT).show();
            return;
        }
        LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        // Usa l'ultima posizione nota se è recente (< 30 secondi)
        Location last = null;
        try { last = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER); } catch (Exception ignored) {}
        if (last == null) {
            try { last = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER); } catch (Exception ignored) {}
        }
        if (last != null && (System.currentTimeMillis() - last.getTime()) < 30_000) {
            addGpsCoordToInput(last);
            return;
        }
        // Richiedi fix fresco
        Toast.makeText(this, "Acquisizione GPS in corso...", Toast.LENGTH_SHORT).show();
        readGpsButton.setEnabled(false);
        final LocationListener[] ref = new LocationListener[1];
        final Runnable timeout = () -> {
            lm.removeUpdates(ref[0]);
            readGpsButton.setEnabled(!MockLocationService.isRunning());
            Toast.makeText(this, "GPS: nessun segnale. Riprova all'aperto.", Toast.LENGTH_LONG).show();
        };
        ref[0] = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                lm.removeUpdates(this);
                countdownHandler.removeCallbacks(timeout);
                addGpsCoordToInput(location);
                readGpsButton.setEnabled(!MockLocationService.isRunning());
            }
            @Override public void onStatusChanged(String provider, int status, android.os.Bundle extras) {}
            @Override public void onProviderEnabled(String provider) {}
            @Override
            public void onProviderDisabled(String provider) {
                lm.removeUpdates(this);
                countdownHandler.removeCallbacks(timeout);
                readGpsButton.setEnabled(!MockLocationService.isRunning());
                Toast.makeText(MainActivity.this, "GPS non attivo. Attivarlo nelle impostazioni.", Toast.LENGTH_LONG).show();
            }
        };
        try {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, ref[0], Looper.getMainLooper());
            countdownHandler.postDelayed(timeout, 15_000);
        } catch (Exception e) {
            readGpsButton.setEnabled(!MockLocationService.isRunning());
            Toast.makeText(this, "GPS non disponibile", Toast.LENGTH_SHORT).show();
        }
    }

    private void addGpsCoordToInput(Location loc) {
        String coord = String.format(Locale.US, "%.6f, %.6f", loc.getLatitude(), loc.getLongitude());
        String current = coordinatesInput.getText().toString().trim();
        coordinatesInput.setText(current.isEmpty() ? coord : current + "\n" + coord);
        Toast.makeText(this, "Posizione inserita: " + coord, Toast.LENGTH_LONG).show();
    }

    // ---- Permessi ----

    private void requestLocationPermissions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        boolean granted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        if (!granted) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                requestPermissions(new String[]{
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                        Manifest.permission.FOREGROUND_SERVICE_LOCATION
                }, REQ_LOCATION);
            } else {
                requestPermissions(new String[]{
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                }, REQ_LOCATION);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == REQ_LOCATION) {
            boolean granted = grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (!granted) {
                Toast.makeText(this, "Permesso posizione negato.", Toast.LENGTH_LONG).show();
            }
        }
    }

    // ---- Lifecycle ----

    @Override
    protected void onResume() {
        super.onResume();
        IntentFilter filter = new IntentFilter(MockLocationService.ACTION_STATUS);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(statusReceiver, filter);
        }
        boolean running = MockLocationService.isRunning();
        setRunningState(running);
        if (running) {
            statusText.setText("Servizio in esecuzione...");
            if (serviceStopAt > 0) startCountdown();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        unregisterReceiver(statusReceiver);
        stopCountdown();
    }

    private int dp(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }
}
