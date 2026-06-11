'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// weward_mock_location.js
// Frida hook per posizione GPS fasulla stabile su WeWard.
//
// Problema risolto: il sistema continuava a oscillare tra posizione reale e
// fasulla perché:
//   1. Solo alcuni provider venivano hookati (GPS ma non Network/Fused)
//   2. I callback dei LocationListener ricevevano aggiornamenti reali
//      tra un'iniezione manuale e l'altra
//   3. FusedLocationProviderClient (API Google Play) non era intercettato
//
// Soluzione: hook di tutti i path che portano una Location all'app + timer
// che rinietta la posizione fasulla ogni UPDATE_INTERVAL_MS ms.
// ─────────────────────────────────────────────────────────────────────────────

const FAKE_LAT          = 45.4654219;   // Milano – cambia a piacere
const FAKE_LNG          = 9.1859243;
const FAKE_ALT          = 122.0;
const FAKE_ACCURACY     = 4.5;          // metri, valore tipico GPS buono
const FAKE_BEARING      = 90.0;         // gradi (Est)
const FAKE_SPEED        = 1.4;          // m/s (~5 km/h, passo normale)
const UPDATE_INTERVAL_MS = 3000;        // rinietta ogni 3 s ai listener registrati

// Raccoglie tutti i LocationListener registrati via requestLocationUpdates
const registeredListeners = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// Costruisce un oggetto android.location.Location con i valori fasci
// ─────────────────────────────────────────────────────────────────────────────
function makeFakeLocation(providerName) {
    const Location    = Java.use('android.location.Location');
    const SystemClock = Java.use('android.os.SystemClock');

    const loc = Location.$new(providerName || 'gps');
    loc.setLatitude(FAKE_LAT);
    loc.setLongitude(FAKE_LNG);
    loc.setAltitude(FAKE_ALT);
    loc.setAccuracy(FAKE_ACCURACY);
    loc.setBearing(FAKE_BEARING);
    loc.setSpeed(FAKE_SPEED);
    loc.setTime(Date.now());

    // API 17+: imposta elapsed realtime nanos per evitare che il sistema
    // consideri la location "stale" e la scarti
    try {
        loc.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());
    } catch (_) {}

    // Imposta il flag isMock = false per evitare rilevamento anti-cheat
    // (disponibile solo API 31+, ignorato su versioni precedenti)
    try {
        loc.setIsMock(false);
    } catch (_) {}

    return loc;
}

Java.perform(function () {

    // ─────────────────────────────────────────────────────────────────────────
    // 1. android.location.LocationManager
    //    Copre le API classiche pre-Google Play Services
    // ─────────────────────────────────────────────────────────────────────────
    const LocationManager = Java.use('android.location.LocationManager');

    // getLastKnownLocation – restituisce sempre la posizione fasulla
    LocationManager.getLastKnownLocation
        .overload('java.lang.String')
        .implementation = function (provider) {
            return makeFakeLocation(provider);
        };

    // requestLocationUpdates – variante con Listener
    const rlVariants = [
        ['java.lang.String', 'long', 'float', 'android.location.LocationListener'],
        ['java.lang.String', 'long', 'float', 'android.location.LocationListener', 'android.os.Looper'],
        ['java.lang.String', 'long', 'float', 'android.app.PendingIntent'],
    ];
    rlVariants.forEach(function (sig) {
        try {
            LocationManager.requestLocationUpdates
                .overload.apply(LocationManager.requestLocationUpdates, sig)
                .implementation = function () {
                    // Registra il listener (ultimo argomento se è un LocationListener)
                    const lastArg = arguments[arguments.length - 1];
                    if (lastArg && typeof lastArg.onLocationChanged === 'function') {
                        registeredListeners.add(lastArg);
                        // Invia subito una posizione fasulla così l'app non aspetta
                        Java.scheduleOnMainThread(function () {
                            try { lastArg.onLocationChanged(makeFakeLocation('gps')); } catch (_) {}
                        });
                    }
                    // Non chiamare l'originale: evita che il provider reale si registri
                };
        } catch (_) {}
    });

    // requestSingleUpdate
    try {
        LocationManager.requestSingleUpdate
            .overload('java.lang.String', 'android.location.LocationListener', 'android.os.Looper')
            .implementation = function (provider, listener, looper) {
                if (listener) {
                    Java.scheduleOnMainThread(function () {
                        try { listener.onLocationChanged(makeFakeLocation(provider)); } catch (_) {}
                    });
                }
            };
    } catch (_) {}

    console.log('[MockLocation] LocationManager hookato.');

    // ─────────────────────────────────────────────────────────────────────────
    // 2. com.google.android.gms.location.FusedLocationProviderClient
    //    Usato dalla maggior parte delle app moderne (inclusa WeWard)
    // ─────────────────────────────────────────────────────────────────────────
    try {
        const FLP = Java.use('com.google.android.gms.location.FusedLocationProviderClient');

        // getLastLocation() → restituisce un Task<Location> già completato
        FLP.getLastLocation.overload().implementation = function () {
            const Tasks  = Java.use('com.google.android.gms.tasks.Tasks');
            return Tasks.forResult(makeFakeLocation('fused'));
        };

        // requestLocationUpdates – varianti con LocationCallback
        const flpVariants = [
            ['com.google.android.gms.location.LocationRequest',
             'com.google.android.gms.location.LocationCallback',
             'android.os.Looper'],
            ['com.google.android.gms.location.LocationRequest',
             'com.google.android.gms.location.LocationCallback',
             'android.os.Handler'],
        ];
        flpVariants.forEach(function (sig) {
            try {
                FLP.requestLocationUpdates
                    .overload.apply(FLP.requestLocationUpdates, sig)
                    .implementation = function (req, callback, extra) {
                        if (callback) {
                            registeredListeners.add({ isFusedCallback: true, cb: callback });
                            const LocationResult = Java.use('com.google.android.gms.location.LocationResult');
                            const arr = Java.array('android.location.Location',
                                [makeFakeLocation('fused')]);
                            Java.scheduleOnMainThread(function () {
                                try {
                                    callback.onLocationResult(LocationResult.create(arr));
                                } catch (_) {}
                            });
                        }
                        const Tasks = Java.use('com.google.android.gms.tasks.Tasks');
                        return Tasks.forResult(null);
                    };
            } catch (_) {}
        });

        console.log('[MockLocation] FusedLocationProviderClient hookato.');
    } catch (e) {
        console.log('[MockLocation] FusedLocationProviderClient non trovato (normale su emulatore senza GMS): ' + e);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Timer periodico – rinietta la posizione fasulla a TUTTI i listener
    //    registrati. Questo risolve il drift: anche se arriva un aggiornamento
    //    GPS reale, il prossimo tick sovrascrive la posizione a quella fasulla.
    // ─────────────────────────────────────────────────────────────────────────
    setInterval(function () {
        registeredListeners.forEach(function (entry) {
            try {
                if (entry && entry.isFusedCallback) {
                    // FusedLocationProviderClient LocationCallback
                    const LocationResult = Java.use('com.google.android.gms.location.LocationResult');
                    const arr = Java.array('android.location.Location',
                        [makeFakeLocation('fused')]);
                    Java.scheduleOnMainThread(function () {
                        try { entry.cb.onLocationResult(LocationResult.create(arr)); } catch (_) {}
                    });
                } else if (entry && typeof entry.onLocationChanged === 'function') {
                    // LocationManager LocationListener classico
                    Java.scheduleOnMainThread(function () {
                        try { entry.onLocationChanged(makeFakeLocation('gps')); } catch (_) {}
                    });
                }
            } catch (_) {
                registeredListeners.delete(entry);
            }
        });
    }, UPDATE_INTERVAL_MS);

    console.log('[MockLocation] Timer attivo ogni ' + UPDATE_INTERVAL_MS + ' ms. Lat=' + FAKE_LAT + ' Lng=' + FAKE_LNG);
});
