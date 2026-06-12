# FitStepsInjector

An Android app that reads a step count from a file on the device's SD card and injects it into Google Fit via the History API. Designed to be triggered silently from ADB.

---

## Prerequisites

### 1. Google Cloud Console — Enable the Fitness API

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Create a new project (or use an existing one).
3. Navigate to **APIs & Services > Library**.
4. Search for **Fitness API** and click **Enable**.

### 2. Create an OAuth 2.0 Android Client ID

1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Application type: **Android**.
4. Package name: `com.garsal.fitinjector`
5. SHA-1 certificate fingerprint (firma fissa del keystore CI):
   ```
   9E:0D:F1:6D:F2:FF:DE:A5:1B:43:26:E4:B8:30:B1:8F:15:53:D9:C1
   ```
   Questo valore è sempre lo stesso perché il keystore è hardcodato nel workflow `build-fitinjector.yml`.
6. Click **Create**. Note your Client ID.

### 3. Set Up Firebase and Download google-services.json

1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Import or create a project linked to the same Google Cloud project above.
3. Add an Android app:
   - Package name: `com.garsal.fitinjector`
   - SHA-1: same as above
4. Download `google-services.json`.
5. **Replace** the placeholder `google-services.json` in the project root with this file.

### 4. Build the APK

Il build avviene tramite **GitHub Actions** (workflow `build-fitinjector.yml`), che parte automaticamente ad ogni push su `master` o su branch `claude/**`.

1. Vai su **GitHub → Actions → Build FitStepsInjector APK**
2. Apri l'ultimo run completato con successo
3. Scorri fino alla sezione **Artifacts** in fondo alla pagina
4. Scarica `FitStepsInjector-signed-<numero_run>`

L'APK scaricato è già firmato con il keystore fisso (SHA-1 sopra).

> Non usare `./gradlew assembleDebug` in locale: l'APK prodotto avrebbe
> una firma diversa (debug key locale) e Android chiederebbe di
> disinstallare quella CI prima di installarlo.

### 5. Install on Device

```bash
adb install -r FitStepsInjector-signed-XX.apk
```

> **Nota — prima installazione / cambio keystore**
> Se sul telefono è già installata una versione firmata con una chiave
> diversa, Android rifiuta l'aggiornamento e chiede di disinstallare.
> Basta disinstallare l'app vecchia una sola volta; da quel momento tutti
> i build successivi usano lo stesso keystore fisso e si installano senza
> problemi.

---

## Usage

### Manual ADB launch

```bash
# Write the desired step count to the device
adb shell "echo -n 8000 > /sdcard/steps_input.txt"

# Launch the app
adb shell am start -n com.garsal.fitinjector/.MainActivity

# Read the result (after a few seconds)
adb shell cat /sdcard/steps_result.txt
# Output: OK:8000  (or ERROR:some message)
```

### Using the helper script

```bash
cd adb_scripts
chmod +x run_fitsteps.sh
./run_fitsteps.sh 8000
```

---

## First-Run OAuth Flow

On the **very first launch**, Google Play Services will display an OAuth consent screen on the device asking the user to grant Google Fit access. You must:

1. Physically interact with the device (or use `adb shell input tap` to tap the Allow button if scripting).
2. Once granted, the token is saved by Google Play Services automatically — subsequent launches will proceed without any UI prompt.

---

## How It Works

1. `MainActivity.onCreate()` is called (triggered by ADB or tapping the launcher icon).
2. Reads `/sdcard/steps_input.txt` — expected to contain a single integer.
3. Calls `GoogleSignIn.getAccountForExtension()` with `FITNESS_ACTIVITY_WRITE` scope.
4. If not yet authorized, launches the Google Sign-In/Fit consent screen via `GoogleSignIn.requestPermissions()`.
5. Once authorized, calls `Fitness.getHistoryClient().insertData()` with a `DataSet` of type `TYPE_STEP_COUNT_DELTA` spanning from midnight today to the current time.
6. Writes `OK:NNNN` or `ERROR:message` to `/sdcard/steps_result.txt`.
7. Calls `finish()`.

---

## File Structure

```
FitStepsInjector/
├── app/
│   ├── build.gradle
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/garsal/fitinjector/
│       │   └── MainActivity.kt
│       └── res/
│           ├── layout/activity_main.xml
│           └── values/strings.xml
├── adb_scripts/
│   └── run_fitsteps.sh
├── build.gradle
├── google-services.json        ← REPLACE with real file from Firebase
├── settings.gradle
└── gradle/wrapper/
    └── gradle-wrapper.properties
```

---

## MockLocationService (posizione GPS fasulla)

Il service mantiene una posizione GPS fasulla stabile su WeWard senza root.

**Prerequisito una-tantum sul telefono:**
`Impostazioni → Opzioni Sviluppatore → App per posizione fittizia → FitStepsInjector`

**Comandi ADB:**
```bash
# Avvia (posizione default: Milano 45.4654, 9.1859)
adb shell am startservice -n com.garsal.fitinjector/.MockLocationService

# Avvia con coordinate personalizzate
adb shell am startservice -n com.garsal.fitinjector/.MockLocationService \
    --ef lat 45.4654219 --ef lng 9.1859243

# Ferma
adb shell am stopservice -n com.garsal.fitinjector/.MockLocationService
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails: `google-services.json` not valid | Replace with real file from Firebase Console |
| `SIGN_IN_REQUIRED` error at runtime | First-run OAuth not completed — launch app manually on device and grant permissions |
| `API_NOT_CONNECTED` | Fitness API not enabled in Cloud Console, or SHA-1 mismatch |
| Result file not created | Check `adb logcat -s FitStepsInjector` for stack trace |
| Steps not visible in Google Fit app | Google Fit may take a few minutes to sync; also verify the account on the device matches the authorized account |
| Android chiede di disinstallare prima di installare | La versione sul telefono è firmata con una chiave diversa da quella del CI. Disinstalla l'app vecchia una volta sola, poi installa l'APK dal CI. Non succederà più finché il keystore nel workflow non cambia. |
| MockLocationService non funziona / posizione reale ancora visibile | Controllare che l'app sia selezionata come "App per posizione fittizia" nelle Opzioni Sviluppatore del telefono |
