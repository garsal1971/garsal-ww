#!/usr/bin/env python3
# weward_get_token.py
# Passo 1: avvia Frida, cattura token e lo salva in weward_token.txt

import subprocess
import time
import os
import sys

# ─────────────────────────────────────────
# CONFIGURAZIONE
# ─────────────────────────────────────────
LDPLAYER_PATH   = r"C:\LDPlayer\LDPlayer9"
ADB             = os.path.join(LDPLAYER_PATH, "adb.exe")
FRIDA_JS        = r"C:\Sviluppo\Git\AutoWeWard\weward_capture_token.js"
FRIDA_SERVER    = "/data/local/tmp/frida-server"
FRIDA_LOG       = r"C:\Sviluppo\Git\AutoWeWard\frida_output.txt"
TOKEN_FILE      = r"C:\Sviluppo\Git\AutoWeWard\weward_token.txt"
ADB_DEVICE      = "127.0.0.1:5555"
PACKAGE         = "com.weward"

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def adb(cmd):
    return subprocess.run(f'"{ADB}" -s {ADB_DEVICE} {cmd}', shell=True, capture_output=True, text=True)

# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────
if __name__ == "__main__":
    log("=== WeWard Get Token ===")

    # 1. Pulisci file precedenti
    for f in [TOKEN_FILE, FRIDA_LOG]:
        if os.path.exists(f):
            os.remove(f)

    # 2. Avvia Frida server
    log("Avvio Frida server...")
    subprocess.Popen(f'"{ADB}" -s {ADB_DEVICE} shell "su -c \'pkill frida-server\'"',
        shell=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)
    subprocess.Popen(f'"{ADB}" -s {ADB_DEVICE} shell "su -c \'nohup {FRIDA_SERVER} &\'"',
        shell=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(3)

    # 3. Avvia WeWard
    log("Apertura WeWard...")
    adb(f"shell monkey -p {PACKAGE} -c android.intent.category.LAUNCHER 1")
    time.sleep(5)

    # 4. Ottieni PID
    pid = adb(f"shell pidof {PACKAGE}").stdout.strip()
    if not pid:
        log("ERRORE: PID WeWard non trovato.")
        sys.exit(1)
    log(f"PID WeWard: {pid}")

    # 5. Avvia Frida con -o per scrivere output su file
    log(f"Avvio Frida JS (output -> {FRIDA_LOG})...")
    proc = subprocess.Popen(
        f'frida -U -p {pid} -l "{FRIDA_JS}" -o "{FRIDA_LOG}"',
        shell=True,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    # 6. Leggi FRIDA_LOG cercando TOKEN:
    log("In attesa del token (WeWard si avvia automaticamente)...")
    start = time.time()
    token = None
    while time.time() - start < 60:
        time.sleep(2)
        if os.path.exists(FRIDA_LOG):
            with open(FRIDA_LOG, "r", errors="ignore") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("TOKEN:"):
                        token = line[6:].strip()
                        break
        if token:
            break

    proc.terminate()

    if token:
        with open(TOKEN_FILE, "w") as f:
            f.write(token)
        log(f"Token salvato: {token[:30]}...")
        log(f"=== Ora esegui: python weward_send_steps.py ===")
    else:
        log("ERRORE: Token non ricevuto entro il timeout.")
        sys.exit(1)
