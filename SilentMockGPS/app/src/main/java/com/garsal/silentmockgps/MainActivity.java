package com.garsal.silentmockgps;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {

    private EditText coordinatesInput, secondsInput, minutesInput;
    private Button startButton, stopButton;
    private TextView statusText, versionText;
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
        statusText       = findViewById(R.id.statusText);
        versionText      = findViewById(R.id.versionText);

        versionText.setText("v" + BuildConfig.VERSION_NAME + " (build " + BuildConfig.VERSION_CODE + ")");

        startButton.setOnClickListener(v -> onStartClicked());
        stopButton.setOnClickListener(v -> onStopClicked());

        statusReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String msg = intent.getStringExtra("message");
                boolean running = intent.getBooleanExtra("running", false);
                if (msg != null) statusText.setText(msg);
                setRunningState(running);
            }
        };
    }

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
        if (running) statusText.setText("Servizio in esecuzione...");
    }

    @Override
    protected void onPause() {
        super.onPause();
        unregisterReceiver(statusReceiver);
    }

    private void onStartClicked() {
        String coordsRaw = coordinatesInput.getText().toString().trim();
        String secondsRaw = secondsInput.getText().toString().trim();
        String minutesRaw = minutesInput.getText().toString().trim();

        if (coordsRaw.isEmpty()) {
            Toast.makeText(this, "Inserisci almeno una coordinata", Toast.LENGTH_SHORT).show();
            return;
        }
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

        Intent service = new Intent(this, MockLocationService.class);
        service.setAction(MockLocationService.ACTION_START);
        service.putExtra(MockLocationService.EXTRA_COORDS, coordsRaw);
        service.putExtra(MockLocationService.EXTRA_SECONDS, seconds);
        service.putExtra(MockLocationService.EXTRA_MINUTES, minutes);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(service);
        } else {
            startService(service);
        }
        setRunningState(true);
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
    }
}
