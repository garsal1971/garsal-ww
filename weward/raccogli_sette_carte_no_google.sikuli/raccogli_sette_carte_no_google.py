# -*- coding: utf-8 -*-
import time
import sys
import math
import subprocess
import os

sys.path.append(getBundlePath())
from sikuli import *
import java.awt.Robot as Robot
import java.awt.event.InputEvent as InputEvent

# ================================================================
# CONFIGURAZIONE GENERALE
# ================================================================
STOP_FILE  = r"C:\Users\garsa\Desktop\stop.txt"
LDCONSOLE  = r"C:\LDPlayer\LDPlayer9\dnconsole.exe"
INDEX_FILE = r"C:\Archivio\sikulix-automation\gps_index.txt"
ADB        = r"C:\LDPlayer\LDPlayer9\adb.exe"
ADB_PORT   = "127.0.0.1:5556"   # <-- cambia in 5556 per istanza 1

_robot = Robot()
TARGET = (14, 129, 115)

# ================================================================
# STOP
# ================================================================
def check_stop():
    print(">>> controllo [STOP]")
    if os.path.exists(STOP_FILE):
        print(">>> [STOP] file stop.txt trovato, interruzione script.")
        sys.exit(0)
    return False

# ================================================================
# CONFIGURAZIONE GPS FAKE
# ================================================================
POSITIONS = [
    (44.50717, 11.36210),
    (44.50788, 11.35419),
    (44.50682, 11.35790),
    (44.50390, 11.36318),
    (44.50396, 11.36761),
    (44.51046, 11.35915),
    (44.50462, 11.35990),
    (44.51039, 11.35599),
]

def get_current_index():
    if os.path.exists(INDEX_FILE):
        with open(INDEX_FILE, "r") as f:
            return int(f.read().strip())
    return 0

def save_index(index):
    with open(INDEX_FILE, "w") as f:
        f.write(str(index))

def adb_connect():
    subprocess.call(
        [ADB, "connect", ADB_PORT],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )

def set_next_position(idx=None):
    adb_connect()

    if idx is None:
        idx = get_current_index()
    else:
        idx = idx % len(POSITIONS)

    lat, lon = POSITIONS[idx]

    cmd = (
        "am broadcast -a com.garsal.silentmockgps.SET_LOCATION "
        "--es lat \"{0}\" --es lon \"{1}\""
    ).format(lat, lon)
    result = subprocess.Popen(
        [ADB, "-s", ADB_PORT, "shell", cmd],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    out, err = result.communicate()
    print(">>> [GPS] posizione {0}/{1}: ({2}, {3}) -> {4}".format(
        idx + 1, len(POSITIONS), lat, lon, str(out).strip()))

    save_index((idx + 1) % len(POSITIONS))

# ================================================================
# CONFIGURAZIONE ACCOUNT
# ================================================================
ACCOUNT_CONFIG = [
    ('nadiafilippabognanni', "1775319561626.png"),
    ('garsal1971.ft',        "1775319581445.png"),
    ('garsal1971.bollette',  "1775324188161.png"),
    ('garsal1971.fit',       "1775325772118.png"),
]

# ================================================================
# UTILITY SCROLL
# ================================================================
def scroll_giu(volte=35, x=185, y=400, sposta_mouse=True):
    if sposta_mouse:
        _robot.mouseMove(x, y)
    for i in range(volte):
        _robot.mouseWheel(3)
        wait(0.05)

# ================================================================
# UTILITY GENERALI
# ================================================================
def cerca_con_tentativi(immagine, max_tentativi=5, attesa=0.5):
    for t in range(1, max_tentativi + 1):
        if exists(immagine):
            return True
        print("    tentativo {0}/{1} fallito per [{2}], attendo {3}s...".format(
              t, max_tentativi, immagine, attesa))
        wait(attesa)
    print("  ERRORE: [{0}] non trovata dopo {1} tentativi.".format(immagine, max_tentativi))
    return False

def colore_vicino(c1, c2, soglia=20):
    return (abs(c1[0]-c2[0]) < soglia and
            abs(c1[1]-c2[1]) < soglia and
            abs(c1[2]-c2[2]) < soglia)

def distanza(x1, y1, x2, y2):
    return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)

# ================================================================
# APERTURA APP
# ================================================================
def apri_weward(max_tentativi=5, attesa=0.5):
    print(">>> [apri_weward] cerco icona app...")
    if not cerca_con_tentativi("1775145501224.png", max_tentativi, attesa):
        print(">>> [apri_weward] ERRORE: icona app non trovata.")
        return False
    click(getLastMatch())
    print(">>> [apri_weward] app aperta OK")
    wait(0.5)
    return True

# ================================================================
# LOGIN ACCOUNT
# ================================================================
def apri_account(account, img_google, max_tentativi=5, attesa=0.5):
    print("\n>>> [apri_account] avvio login per: {0}".format(account))

    print("  [1/7] apertura menu account...")
    if not cerca_con_tentativi("1775145932354.png", max_tentativi, attesa):
        print("  [1/7] ERRORE: menu account non trovato.")
        return False
    click(getLastMatch())
    print("  [1/7] menu account aperto OK")
    wait(0.3)

    print("  [2/7] selezione account {0} tramite bentornato...".format(account))
    if not cerca_con_tentativi(Pattern("1775294157365.png").targetOffset(-6, -5), max_tentativi, attesa):
        print("  [2/7] ERRORE: schermata bentornato non trovata.")
        return False
    click(getLastMatch())
    print("  [2/7] account selezionato OK")
    wait(0.5)

    print("  [3/7] avvio login Google...")
    if not cerca_con_tentativi(img_google, max_tentativi, attesa):
        print("  [3/7] ERRORE: pulsante Google non trovato.")
        return False
    click(getLastMatch())
    print("  [3/7] login Google avviato, attendo caricamento pagina...")
    wait(2)

    print("  [4/7] conferma login...")
    if not cerca_con_tentativi("1775319983606.png", max_tentativi, attesa):
        print("  [4/7] ERRORE: pulsante conferma non trovato.")
        return False
    click(getLastMatch())
    print("  [4/7] login confermato OK")
    wait(2.5)

    print("  [5/7] apri mail...")
    if not cerca_con_tentativi("1775320409291.png", max_tentativi, attesa):
        print("  [5/7] ERRORE: apri mail non trovato.")
        return False
    click(getLastMatch())
    print("  [5/7] apri mail OK")
    wait(0.5)

    print("  [6/7] torna a weward...")
    if not cerca_con_tentativi(Pattern("1775321401860.png").targetOffset(3, 95), max_tentativi, attesa):
        print("  [6/7] ERRORE: torna a weward non trovato.")
        return False
    click(getLastMatch())
    print("  [6/7] torna a weward OK")
    wait(0.5)

    print("  [7/7] conferma login...")
    if not cerca_con_tentativi("1776599872334.png", max_tentativi, attesa):
        print("  [7/7] ERRORE: pulsante conferma non trovato.")
        return False
    click(getLastMatch())
    print("  [7/7] login confermato OK")
    wait(0.5)

    print(">>> [apri_account] login {0} completato OK".format(account))
    return True

# ================================================================
# NAVIGAZIONE SEZIONI
# ================================================================
def posizionati_su_carte(attesa_iniziale=5, max_tentativi=5, attesa=0.5):
    print("  [nav] apertura sezione Carte...")
    wait(attesa_iniziale)
    if not cerca_con_tentativi("1775294025267.png", max_tentativi, attesa):
        print("  [nav] ERRORE: icona sezione Carte non trovata.")
        return False
    click(getLastMatch())
    print("  [nav] sezione Carte aperta OK")
    wait(0.5)
    return True

def posizionati_su_attivita(max_tentativi=5, attesa=0.5):
    print("  [nav] apertura sezione Attivita...")
    if not cerca_con_tentativi("1775217437436.png", max_tentativi, attesa):
        print("  [nav] ERRORE: icona sezione Attivita non trovata.")
        return False
    click(getLastMatch())
    print("  [nav] sezione Attivita aperta OK")
    wait(0.5)
    return True

def posizionati_su_menuutenza(max_tentativi=5, attesa=0.5):
    print("  [nav] apertura menu utente...")
    if not cerca_con_tentativi(Pattern("1775217620164.png").targetOffset(-2, 32), max_tentativi, attesa):
        print("  [nav] ERRORE: icona menu utente non trovata.")
        return False
    click(getLastMatch())
    print("  [nav] menu utente aperto OK")
    wait(0.5)
    return True

def posizionati_su_menuutenza_ingranaggio(max_tentativi=5, attesa=0.5):
    print("  [nav] apertura impostazioni ingranaggio...")
    if not cerca_con_tentativi(Pattern("1775217843520.png").targetOffset(20, 19), max_tentativi, attesa):
        print("  [nav] ERRORE: icona ingranaggio non trovata.")
        return False
    click(getLastMatch())
    print("  [nav] impostazioni aperte OK")
    wait(0.5)
    return True

# ================================================================
# LOGOUT
# ================================================================
def esci(max_tentativi=5, attesa=0.5):
    print("  [logout 1/4] cerco pulsante Esci...")
    if not cerca_con_tentativi("1775218288286.png", max_tentativi, attesa):
        print("  [logout 1/4] ERRORE: pulsante Esci non trovato.")
        return False
    click(getLastMatch())
    print("  [logout 1/4] pulsante Esci cliccato OK")
    wait(0.5)

    scroll_giu(volte=35, x=185, y=400, sposta_mouse=False)

    print("  [logout 2/4] prima conferma logout...")
    if not cerca_con_tentativi(Pattern("1775217958402.png").targetOffset(-141, 45), max_tentativi, attesa):
        print("  [logout 2/4] ERRORE: prima conferma non trovata.")
        return False
    click(getLastMatch())
    print("  [logout 2/4] prima conferma OK")
    wait(0.5)

    print("  [logout 3/4] seconda conferma logout...")
    if not cerca_con_tentativi(Pattern("1775218411391.png").targetOffset(111, 51), max_tentativi, attesa):
        print("  [logout 3/4] ERRORE: seconda conferma non trovata.")
        return False
    click(getLastMatch())
    print("  [logout 3/4] logout completato OK")
    wait(0.5)

    print("  [logout 4/4] chiudi app WeWard...")
    if not cerca_con_tentativi(Pattern("1775296520334.png").targetOffset(14, -2), max_tentativi, attesa):
        print("  [logout 4/4] ERRORE: chiudi app non trovato.")
        return False
    click(getLastMatch())
    print("  [logout 4/4] app chiusa OK")
    wait(0.5)

    print("  [logout 4b/4] chiudi Gmail...")
    if not cerca_con_tentativi(Pattern("1775323087954.png").targetOffset(23, 0), max_tentativi, attesa):
        print("  [logout 4b/4] ERRORE: chiudi Gmail non trovato.")
        return False
    click(getLastMatch())
    print("  [logout 4b/4] Gmail chiusa OK")
    wait(0.5)

    return True

def esci_weward(max_tentativi=5, attesa=0.5):
    print(">>> [esci_weward] avvio sequenza logout...")
    ok = True
    ok = posizionati_su_attivita(max_tentativi, attesa) and ok
    ok = posizionati_su_menuutenza(max_tentativi, attesa) and ok
    ok = posizionati_su_menuutenza_ingranaggio(max_tentativi, attesa) and ok
    ok = esci(max_tentativi, attesa) and ok
    if ok:
        print(">>> [esci_weward] logout completato OK")
    else:
        print(">>> [esci_weward] ATTENZIONE: logout completato con errori.")
    return ok

# ================================================================
# CONTROLLO CARTE
# ================================================================
def controlla_carte(max_tentativi=5, attesa=0.5):
    print("  [controlla_carte] cerco lista carte...")
    if not cerca_con_tentativi("1775384530118.png", max_tentativi, attesa):
        print("  [controlla_carte] ERRORE: lista carte non trovata.")
        return None
    click(getLastMatch())
    wait(0.5)

    print("  [controlla_carte] verifico carte disponibili...")
    nessuna = cerca_con_tentativi(Pattern("1775384584244.png").similar(0.91), 2, attesa)
    wait(0.5)

    print("  [controlla_carte] torno indietro...")
    if cerca_con_tentativi("1775385203175.png", max_tentativi, attesa):
        click(getLastMatch())
        print("  [controlla_carte] indietro OK")

    if nessuna:
        print("  [controlla_carte] nessuna carta disponibile.")
        return False

    print("  [controlla_carte] carte da raccogliere: SI")
    return True

# ================================================================
# RACCOLTA CARTE
# ================================================================
def raccogli_carte(max_tentativi=10, attesa=4):
    print("==> Cerco puntoblu...")
    doubleClick("1776370021625-3.png")
    wait(0.5)
    doubleClick("1776370021625-3.png")
    wait(0.5)
    doubleClick("1776370021625-3.png")
    wait(0.5)

    tentativo = 0
    prese = 0
    while prese < 7 and tentativo < max_tentativi:
        check_stop()
        print("--- Tentativo %d di %d ---" % (tentativo, max_tentativi))

        set_next_position()
        wait(1)

        carta = exists(Pattern("1776442897675-3.png").similar(0.90))
        if carta:
            print("esiste carta, clicco...")
            try:
                click(carta)
                if exists("1776443662760-3.png"):
                    print("esiste carta da aprire")
                    click("1776443662760-3.png")
                    if exists("1776443756642-3.png"):
                        print("esiste chiudo carta presa")
                        click("1776443756642-3.png")
                        prese = prese + 1
            except FindFailed:
                print("  carta sparita dopo GPS update, riprovo")

        tentativo = tentativo + 1

    print("prese " + str(prese) + " - tentativo " + str(tentativo))
    return

# ================================================================
# ESECUZIONE TUTTI GLI ACCOUNT
# ================================================================
def esegui_tutti(max_tentativi=5, attesa=0.5):
    print("\n==============================")
    print("AVVIO CICLO SU TUTTI GLI ACCOUNT")
    print("==============================")
    risultati = []

    for account, img_google in ACCOUNT_CONFIG:
        check_stop()
        wait(1.5)

        if not apri_weward(max_tentativi, attesa):
            print("ERRORE: impossibile aprire WeWard, script interrotto.")
            return

        print("\n------------------------------")
        ok = apri_account(account, img_google, max_tentativi, attesa)

        if ok:
            if posizionati_su_carte(attesa_iniziale=5, max_tentativi=max_tentativi, attesa=attesa):
                stato = controlla_carte(max_tentativi, attesa)
                if stato is True:
                    raccogli_carte(max_tentativi=21)
                elif stato is False:
                    print("  nessuna carta da raccogliere, passo al prossimo account.")
                else:
                    print("  ERRORE verifica carte, passo al prossimo account.")
        else:
            print("  account {0} saltato per errore login.".format(account))

        esci_weward(max_tentativi, attesa)
        risultati.append((account, 'OK' if ok else 'FAIL'))

    print("\n==============================")
    print("RIEPILOGO FINALE")
    print("==============================")
    for acc, esito in risultati:
        print("  {0}  {1}".format(esito, acc))

# ================================================================
# ESECUZIONE SINGOLO ACCOUNT
# ================================================================
def esegui_uno(account, img_google, max_tentativi=5, attesa=0.5):
    print("\n==============================")
    print("AVVIO SINGOLO ACCOUNT: {0}".format(account))
    print("==============================")
    wait(1.5)
    if not apri_weward(max_tentativi, attesa):
        print("ERRORE: impossibile aprire WeWard, script interrotto.")
        return
    ok = apri_account(account, img_google, max_tentativi, attesa)
    if ok:
        if posizionati_su_carte(attesa_iniziale=5, max_tentativi=max_tentativi, attesa=attesa):
            stato = controlla_carte(max_tentativi, attesa)
            if stato is True:
                raccogli_carte(max_tentativi=21)
            elif stato is False:
                print("  nessuna carta da raccogliere.")
            else:
                print("  ERRORE verifica carte.")
    else:
        print("  account {0} saltato per errore login.".format(account))
    esci_weward(max_tentativi, attesa)

# ================================================================
# AVVIO SCRIPT
# ================================================================
adb_connect()

# esegui_tutti(max_tentativi=15, attesa=0.5)
# esegui_uno('nadiafilippabognanni', '1775319561626.png', max_tentativi=15, attesa=0.5)
set_next_position(0)
# raccogli_carte(max_tentativi=15)

# esegui_tutti(max_tentativi=15, attesa=0.5)