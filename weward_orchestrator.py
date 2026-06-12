#!/usr/bin/env python3
# weward_orchestrator.py
# Orchestratore completo: LDPlayer -> Frida -> SikuliX -> validate_steps

import subprocess
import time
import os
import sys
import random
import requests

# ─────────────────────────────────────────
# CONFIGURAZIONE
# ─────────────────────────────────────────
LDPLAYER_PATH   = r"C:\LDPlayer\LDPlayer9"
SIKULIX_JAR     = r"C:\Oculix\sikulixide-2.0.5-windows.jar"
SIKULIX_SCRIPT  = r"C:\sviluppo\git\AutoWeWard\weward_open.sikuli"
ADB             = os.path.join(LDPLAYER_PATH, "adb.exe")
FRIDA_JS        = r"C:\sviluppo\git\AutoWeWard\weward_capture_token.js"
FRIDA_SERVER    = "/data/local/tmp/frida-server"
TOKEN_FILE_DEV  = "/data/local/tmp/weward_token.txt"
TOKEN_FILE_LOCAL= r"C:\sviluppo\git\AutoWeWard\weward_token.txt"
ADB_DEVICE      = "127.0.0.1:5555"
PACKAGE         = "com.weward"

STEPS           = random.randint(20500, 22000)

# ─────────────────────────────────────────
# FUNZIONI
# ─────────────────────────────────────────
def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def adb(cmd):
    full = f'"{ADB}" -s {ADB_DEVICE} {cmd}'
    return subprocess.run(full, shell=True, capture_output=True, text=True)

def adb_bg(cmd):
    full = f'"{ADB}" -s {ADB_DEVICE} {cmd}'
    return subprocess.Popen(full, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def wait_for_device(timeout=60):
    log("Attendo LDPlayer...")
    start = time.time()
    while time.time() - start < timeout:
        result = subprocess.run(f'"{ADB}" devices', shell=True, capture_output=True, text=True)
        if ADB_DEVICE in result.stdout:
            log("LDPlayer connesso.")
            return True
        time.sleep(3)
    log("ERRORE: LDPlayer non trovato.")
    return False

def start_frida_server():
    log("Avvio Frida server...")
    # Termina eventuale istanza precedente
    subprocess.Popen(
        f'"{ADB}" -s {ADB_DEVICE} shell "su -c \'pkill frida-server\'"',
        shell=True, stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(2)
    # Avvia in background con nohup
    subprocess.Popen(
        f'"{ADB}" -s {ADB_DEVICE} shell "su -c \'nohup {FRIDA_SERVER} &\'"',
        shell=True, stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(3)
    result = subprocess.run(
        f'"{ADB}" -s {ADB_DEVICE} shell ps',
        shell=True, capture_output=True, text=True
    )
    if "frida" in result.stdout:
        log("Frida server avviato.")
        return True
    log("ERRORE: Frida server non avviato.")
    return False

def get_pid():
    result = adb(f"shell pidof {PACKAGE}")
    pid = result.stdout.strip()
    if pid:
        log(f"PID WeWard: {pid}")
        return pid
    return None

def launch_frida_js(pid, token_holder):
    log("Avvio Frida JS per cattura token...")
    import threading

    token_event = threading.Event()

    cmd = f'frida -U -p {pid} -l "{FRIDA_JS}"'
    proc = subprocess.Popen(
        cmd, shell=True,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        creationflags=subprocess.CREATE_NO_WINDOW
    )

    def read_output():
        try:
            for line in proc.stdout:
                line = line.strip()
                if line:
                    log(f"[Frida] {line}")
                if "TOKEN:" in line:
                    token = line.split("TOKEN:")[1].strip()
                    log(f"[+] Token catturato")
                    token_holder["token"] = token
                if "HEADERS:" in line:
                    import json
                    headers_json = line.split("HEADERS:")[1].strip()
                    token_holder["headers"] = json.loads(headers_json)
                    log(f"[+] Headers catturati")
                if "BODY:" in line:
                    token_holder["body"] = line.split("BODY:")[1].strip()
                    log(f"[+] Body catturato")
                    token_event.set()
                    proc.terminate()
                    break
        except Exception as e:
            log(f"[-] Errore thread: {e}")
        finally:
            token_event.set()

    t = threading.Thread(target=read_output, daemon=True)
    t.start()
    return proc, token_event

def run_sikulix():
    log("Avvio SikuliX per aprire WeWard...")
    cmd = f'java -jar "{SIKULIX_JAR}" -r "{SIKULIX_SCRIPT}"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
    log("SikuliX completato.")
    return result

def wait_for_token(timeout=60):
    log("Attendo token...")
    start = time.time()
    while time.time() - start < timeout:
        if os.path.exists(TOKEN_FILE_LOCAL):
            with open(TOKEN_FILE_LOCAL, "r") as f:
                token = f.read().strip()
            if token and len(token) > 10:
                log(f"Token ricevuto: {token[:30]}...")
                return token
        time.sleep(2)
    log("ERRORE: Token non ricevuto entro il timeout.")
    return None

def send_steps(token, steps, real_headers=None):
    log(f"Invio {steps} passi a WeWard...")
    url = "https://backend.prod.weward.fr/api/v1.0/validate_steps?type=uplevel_v2"

    if real_headers:
        headers = real_headers
        headers["authorization"] = token
        log("[+] Usando headers reali catturati")
    else:
        headers = {
            "ww_app_version": "8.13.0",
            "ww_os": "android",
            "ww_os_version": "28",
            "ww_build_version": "8.13.0",
            "ww_codepush_version": "base",
            "ww-unique-device-id": "26b8ebc8a12e49a7",
            "ww_device_ts": str(int(time.time() * 1000)),
            "ww_device_timezone": "Europe/Amsterdam",
            "ww_device_country": "IT",
            "ww_user_language": "it",
            "ww_user_advertising_id": "809b7053-01f2-419a-930b-fef539606969",
            "ww_adjust_id": "",
            "push_notification_enabled": "1",
            "amplitude_device_id": "0406ba30-79c4-4045-bbdd-835a5ce7b89e",
            "ww_app_instance_id": "50d1e6ccff5bb26e8a8189c98af06cf9",
            "ww_user_agent": "Mozilla/5.0 (Linux; Android 9; SM-S9110 Build/PQ3A.190605.03171033; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36",
            "ww_device_session": "25bf79e3-079a-4eff-a447-6275a6ac76af",
            "authorization": token,
            "content-type": "application/json",
            "ww_track": "f93192d567bba0c029df89d5f341248e42e9c0ffdbbfdc135862a9fa01ecd131",
            "User-Agent": "okhttp/4.9.0"
        }

    import json
    body = {
        "amount": steps,
        "steps_needing_validation": None,
        "device_id": "SM-S9110",
        "device_manufacturer": "samsung",
        "device_model": "SM-S9110",
        "device_product": "SM-S9110",
        "device_system_name": "Android",
        "device_system_version": "9",
        "device_uptime_ms": str(int(time.time() * 1000)),
        "googlefit_steps": steps,
        "steps_source": "GoogleFit",
        "data_sources": ["step_count"]
    }

    response = requests.post(url, json=body, headers=headers)
    log(f"Status: {response.status_code}")
    log(f"Risposta: {response.text}")
    return response.status_code == 200

# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────
if __name__ == "__main__":
    log(f"=== WeWard Orchestrator === Passi: {STEPS}")

    # 1. Verifica LDPlayer
    if not wait_for_device():
        sys.exit(1)

    # 2. Avvia Frida server
    if not start_frida_server():
        sys.exit(1)

    # 3. Pulisci eventuale token precedente
    adb(f"shell rm -f {TOKEN_FILE_DEV}")
    if os.path.exists(TOKEN_FILE_LOCAL):
        os.remove(TOKEN_FILE_LOCAL)

    # 4. Avvia WeWard via ADB
    log("Apertura WeWard via ADB...")
    adb(f"shell monkey -p {PACKAGE} -c android.intent.category.LAUNCHER 1")
    time.sleep(5)  # attendi caricamento app

    # 5. Ottieni PID WeWard dopo avvio
    pid = get_pid()
    if not pid:
        log("ERRORE: impossibile ottenere PID WeWard.")
        sys.exit(1)

    # 6. Avvia Frida JS agganciato al PID aggiornato
    token_holder = {"token": None}
    frida_proc, token_event = launch_frida_js(pid, token_holder)
    time.sleep(2)

    # 7. Attendi token tramite evento
    log("Attendo token...")
    token_event.wait(timeout=60)

    token = token_holder["token"]
    if not token:
        log("ERRORE: Token non ricevuto entro il timeout.")
        frida_proc.terminate()
        sys.exit(1)

    log(f"Token: {token[:30]}...")

    # 8. Termina Frida (già terminato dal thread, ma per sicurezza)
    try:
        frida_proc.terminate()
    except:
        pass
    time.sleep(1)

    # 9. Invia passi
    success = send_steps(token, STEPS, real_headers=token_holder.get("headers"))
    if success:
        log(f"=== Completato! {STEPS} passi inviati con successo ===")
    else:
        log("=== ERRORE invio passi ===")
        sys.exit(1)
