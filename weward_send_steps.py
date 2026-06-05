#!/usr/bin/env python3
# weward_send_steps.py
# Legge il token da file e invia i passi a WeWard

import requests
import random
import time
import os
import sys

# ─────────────────────────────────────────
# CONFIGURAZIONE
# ─────────────────────────────────────────
TOKEN_FILE  = r"C:\Sviluppo\Git\AutoWeWard\weward_token.txt"
STEPS       = random.randint(20500, 22000)

# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────
def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

if __name__ == "__main__":
    log(f"=== WeWard Send Steps === Passi: {STEPS}")

    # 1. Leggi token
    if not os.path.exists(TOKEN_FILE):
        log("ERRORE: file token non trovato. Esegui prima weward_get_token.py")
        sys.exit(1)

    with open(TOKEN_FILE, "r") as f:
        token = f.read().strip()

    if not token or len(token) < 10:
        log("ERRORE: token non valido.")
        sys.exit(1)

    log(f"Token: {token[:30]}...")

    # 2. Invia passi
    url = "https://backend.prod.weward.fr/api/v1.0/validate_steps?type=uplevel_v2"
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
    body = {
        "amount": STEPS,
        "steps_needing_validation": None,
        "device_id": "SM-S9110",
        "device_manufacturer": "samsung",
        "device_model": "SM-S9110",
        "device_product": "SM-S9110",
        "device_system_name": "Android",
        "device_system_version": "9",
        "device_uptime_ms": str(int(time.time() * 1000)),
        "googlefit_steps": STEPS,
        "steps_source": "GoogleFit",
        "data_sources": ["step_count"]
    }

    log(f"Invio {STEPS} passi...")
    response = requests.post(url, json=body, headers=headers)
    log(f"Status: {response.status_code}")
    log(f"Risposta: {response.text}")

    if response.status_code == 200:
        log(f"=== Completato! {STEPS} passi inviati con successo ===")
    else:
        log("=== ERRORE invio passi ===")
        sys.exit(1)
