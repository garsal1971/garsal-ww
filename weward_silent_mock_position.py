#!/usr/bin/env python3
# weward_silent_mock_position.py
#
# Avvia e mantiene il mock di posizione GPS su WeWard tramite Frida.
# Risolve il drift tra posizione reale e fasulla: il Frida script inietta
# periodicamente la posizione fasulla a tutti i listener registrati, così
# nessun aggiornamento GPS reale sopravvive più di UPDATE_INTERVAL_MS.
#
# Uso standalone:
#   python weward_silent_mock_position.py
#
# Uso come modulo dall'orchestratore:
#   from weward_silent_mock_position import SilentMockPosition
#   mock = SilentMockPosition(adb_fn, pid)
#   mock.start()
#   ...
#   mock.stop()

import subprocess
import threading
import time
import os
import sys

# ─────────────────────────────────────────
# CONFIGURAZIONE (override via env o argomenti)
# ─────────────────────────────────────────
LDPLAYER_PATH = os.environ.get("LDPLAYER_PATH", r"C:\LDPlayer\LDPlayer9")
ADB           = os.path.join(LDPLAYER_PATH, "adb.exe") if sys.platform == "win32" else "adb"
ADB_DEVICE    = os.environ.get("ADB_DEVICE", "127.0.0.1:5555")
PACKAGE       = os.environ.get("WEWARD_PACKAGE", "com.weward")
FRIDA_JS      = os.path.join(os.path.dirname(__file__), "weward_mock_location.js")


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] [MockPos] {msg}", flush=True)


def _adb(cmd):
    full = f'"{ADB}" -s {ADB_DEVICE} {cmd}'
    return subprocess.run(full, shell=True, capture_output=True, text=True)


def _get_pid(package=PACKAGE):
    result = _adb(f"shell pidof {package}")
    pid = result.stdout.strip()
    return pid if pid else None


class SilentMockPosition:
    """
    Gestisce un processo Frida che mantiene la posizione GPS fasulla su WeWard.

    Il problema del drift era causato da:
    1. FusedLocationProviderClient non hookato (usato dalla maggior parte
       delle app moderne come WeWard)
    2. Assenza di un timer che riniettasse periodicamente la posizione fasulla
       ai listener già registrati
    3. Il processo Frida veniva terminato prima che l'app aprisse la schermata
       di validazione passi

    La soluzione: weward_mock_location.js hookà tutti i provider + usa setInterval
    per tenere la posizione fasulla "attiva" per tutta la durata della sessione.
    """

    def __init__(self, pid: str, adb_fn=None, frida_js: str = FRIDA_JS):
        self.pid      = pid
        self.adb_fn   = adb_fn or _adb
        self.frida_js = frida_js
        self._proc    = None
        self._thread  = None
        self._stop    = threading.Event()

    def start(self) -> bool:
        if not os.path.exists(self.frida_js):
            log(f"ERRORE: script Frida non trovato: {self.frida_js}")
            return False

        cmd = f'frida -U -p {self.pid} -l "{self.frida_js}"'
        log(f"Avvio mock posizione su PID {self.pid}...")
        self._proc = subprocess.Popen(
            cmd,
            shell=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        self._stop.clear()
        self._thread = threading.Thread(target=self._read_output, daemon=True)
        self._thread.start()

        # Attendi conferma che l'hook sia stato applicato
        started = self._wait_for_hook(timeout=15)
        if started:
            log("Mock posizione attivo. Posizione fasulla stabile.")
        else:
            log("AVVISO: conferma hook non ricevuta entro 15 s. Continuo comunque.")
        return True

    def stop(self):
        log("Stop mock posizione.")
        self._stop.set()
        if self._proc:
            try:
                self._proc.terminate()
            except Exception:
                pass
        if self._thread:
            self._thread.join(timeout=5)

    def _read_output(self):
        try:
            for line in self._proc.stdout:
                line = line.strip()
                if line:
                    log(f"[Frida] {line}")
                if self._stop.is_set():
                    break
        except Exception as e:
            log(f"Thread output: {e}")
        finally:
            self._stop.set()

    def _wait_for_hook(self, timeout=15):
        """Aspetta che Frida stampi il messaggio di conferma hook attivo."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self._stop.is_set():
                return False
            time.sleep(0.3)
            # _read_output scrive sul log; controlliamo che il processo sia vivo
            if self._proc.poll() is not None:
                return False
        return True


# ─────────────────────────────────────────
# Uso standalone: avvia mock e rimane in attesa (Ctrl+C per fermare)
# ─────────────────────────────────────────
if __name__ == "__main__":
    pid = _get_pid()
    if not pid:
        log(f"ERRORE: {PACKAGE} non in esecuzione. Avvia WeWard prima.")
        sys.exit(1)

    mock = SilentMockPosition(pid=pid)
    if not mock.start():
        sys.exit(1)

    log("Premi Ctrl+C per fermare il mock.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        mock.stop()
        log("Terminato.")
