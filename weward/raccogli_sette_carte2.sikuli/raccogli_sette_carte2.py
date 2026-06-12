# -*- coding: utf-8 -*-
import time
import sys
import math
import subprocess
import os
import random
import re

sys.path.append(getBundlePath())
from sikuli import *
import java.awt.Robot as Robot
import java.awt.event.InputEvent as InputEvent

# ================================================================
# CONFIGURAZIONE GENERALE
# ================================================================
STOP_FILE  = r"C:\Users\garsa\Desktop\stop.txt"
LDCONSOLE  = r"C:\LDPlayer\LDPlayer9\ldconsole.exe"   # NON dnconsole.exe: richiede privilegi admin (errore 740)
INDEX_FILE = r"C:\Archivio\sikulix-automation\gps_index.txt"
ADB        = r"C:\LDPlayer\LDPlayer9\adb.exe"
ADB_PORT   = "127.0.0.1:5555"
WEWARD_PKG = "com.weward"
FITINJ_PKG = "com.garsal.fitinjector"
STEPS_RESULT = "/sdcard/steps_result.txt"
LD_INDEX   = 0   # indice istanza LDPlayer (0 = prima istanza, porta 5555)

_robot = Robot()
TARGET = (14, 129, 115)

# ================================================================
# STOP
# ================================================================
def check_stop():
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
    (44.51026, 11.35965),
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

# ================================================================
# LDPLAYER
# ================================================================
def emulatore_pronto():
    adb_connect()
    result = subprocess.Popen(
        [ADB, "-s", ADB_PORT, "shell", "getprop sys.boot_completed"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    out, err = result.communicate()
    return "1" in str(out)

def ldplayer_in_esecuzione():
    # True/False dallo stato della console, None se la console non e' eseguibile
    try:
        result = subprocess.Popen(
            [LDCONSOLE, "isrunning", "--index", str(LD_INDEX)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        out, err = result.communicate()
        return "running" in str(out)
    except OSError as e:
        print(">>> [LDPlayer] console non eseguibile: {0}".format(e))
        return None

def avvia_ldplayer(timeout=120):
    stato = ldplayer_in_esecuzione()

    if stato is True:
        print(">>> [LDPlayer] istanza {0} gia' in esecuzione".format(LD_INDEX))
        return True

    if stato is None:
        # console bloccata (es. errore 740: servono privilegi elevati):
        # se l'emulatore e' comunque gia' acceso, proseguiamo lo stesso
        if emulatore_pronto():
            print(">>> [LDPlayer] console non disponibile ma emulatore attivo, proseguo")
            return True
        print(">>> [LDPlayer] ERRORE: console bloccata ed emulatore spento.")
        print(">>>            Avvia SikuliX come amministratore oppure apri LDPlayer a mano.")
        return False

    print(">>> [LDPlayer] avvio istanza {0}...".format(LD_INDEX))
    try:
        subprocess.Popen(
            [LDCONSOLE, "launch", "--index", str(LD_INDEX)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
    except OSError as e:
        print(">>> [LDPlayer] ERRORE: impossibile lanciare la console: {0}".format(e))
        print(">>>            Avvia SikuliX come amministratore oppure apri LDPlayer a mano.")
        return False

    inizio = time.time()
    while time.time() - inizio < timeout:
        check_stop()
        if emulatore_pronto():
            print(">>> [LDPlayer] boot completato in {0}s".format(int(time.time() - inizio)))
            wait(5)   # margine per il caricamento della home
            return True
        wait(3)

    print(">>> [LDPlayer] ERRORE: boot non completato entro {0}s".format(timeout))
    return False

def chiudi_ldplayer():
    print(">>> [LDPlayer] chiusura istanza {0}...".format(LD_INDEX))
    try:
        subprocess.Popen(
            [LDCONSOLE, "quit", "--index", str(LD_INDEX)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        ).communicate()
    except OSError as e:
        print(">>> [LDPlayer] ERRORE: impossibile chiudere via console: {0}".format(e))

def posiziona_finestra_ldplayer(x=0, y=0):
    # sposta la finestra di LDPlayer (processo dnplayer) in (x, y)
    # senza ridimensionarla, via SetWindowPos di user32.dll
    print(">>> [LDPlayer] sposto la finestra in ({0}, {1})...".format(x, y))
    ps = (
        "$sig = '[DllImport(\"user32.dll\")] public static extern bool "
        "SetWindowPos(IntPtr hWnd, IntPtr hAfter, int X, int Y, int W, int H, uint uFlags);'; "
        "Add-Type -MemberDefinition $sig -Name Win -Namespace Native; "
        "$p = Get-Process dnplayer -ErrorAction SilentlyContinue | "
        "Where-Object {{ $_.MainWindowHandle -ne 0 }} | Select-Object -First 1; "
        "if ($p) {{ [Native.Win]::SetWindowPos($p.MainWindowHandle, [IntPtr]::Zero, "
        "{0}, {1}, 0, 0, 0x0001 -bor 0x0004) }} else {{ Write-Output 'NOWINDOW' }}"
    ).format(x, y)
    result = subprocess.Popen(
        ["powershell", "-NoProfile", "-Command", ps],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    out, err = result.communicate()
    if "NOWINDOW" in str(out):
        print(">>> [LDPlayer] ERRORE: finestra dnplayer non trovata.")
        return False
    print(">>> [LDPlayer] finestra posizionata OK")
    wait(1)
    return True

def avvia_silentmock():
    adb_connect()
    result = subprocess.Popen(
        [ADB, "-s", ADB_PORT, "shell",
         "am start -n com.garsal.silentmockgps/.MainActivity"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    result.communicate()
    wait(2)
    print(">>> [SilentMockGPS] servizio avviato")

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
    output = str(out).strip()

    # se result=0 il servizio si e' fermato — riavvia e riprova
    if "result=0" in output or "result=" not in output:
        print(">>> [GPS] servizio fermo, riavvio...")
        avvia_silentmock()
        result = subprocess.Popen(
            [ADB, "-s", ADB_PORT, "shell", cmd],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        out, err = result.communicate()
        output = str(out).strip()

    print(">>> [GPS] posizione {0}/{1}: ({2}, {3}) -> {4}".format(
        idx + 1, len(POSITIONS), lat, lon, output))

    save_index((idx + 1) % len(POSITIONS))

# ================================================================
# CONFIGURAZIONE ACCOUNT
# ================================================================
ACCOUNT_CONFIG = {
    'garsal1971': {
        'google': "1776969044180.png",
        'email':  "garsal1971@gmail.com"
    },
    'adagarofalobognanni': {
        'google': "1776969054823.png",
        'email':  "adagarofalobognanni@gmail.com"
    },
    'berros1974': {
        'google': "1776969065567.png",
        'email':  "berros1974@gmail.com"
    },
    'gmx.salgar71': {
        'google': "1776969075679.png",
        'email':  None   # email Google mancante: iniezione passi saltata
    },
    'berros7426': {
        'google': "1776969088481.png",
        'email':  "berros7426@gmail.com"
    }
}

# ================================================================
# INIEZIONE PASSI (FitStepsInjector)
# ================================================================
def inietta_passi(email, passi=None, timeout=60):
    if passi is None:
        passi = random.randint(20000, 23500)

    print(">>> [passi] inietto {0} passi su {1}...".format(passi, email))
    adb_connect()

    # permessi storage per il file di risultato (idempotente)
    for perm in ("android.permission.WRITE_EXTERNAL_STORAGE",
                 "android.permission.READ_EXTERNAL_STORAGE"):
        subprocess.Popen(
            [ADB, "-s", ADB_PORT, "shell",
             "pm grant {0} {1}".format(FITINJ_PKG, perm)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        ).communicate()

    # rimuovi l'esito della run precedente
    subprocess.Popen(
        [ADB, "-s", ADB_PORT, "shell", "rm -f " + STEPS_RESULT],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    ).communicate()

    cmd = ("am start -n {0}/.MainActivity --es account {1} "
           "--ei steps {2} --ez auto true").format(FITINJ_PKG, email, passi)
    subprocess.Popen(
        [ADB, "-s", ADB_PORT, "shell", cmd],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    ).communicate()

    inizio = time.time()
    while time.time() - inizio < timeout:
        check_stop()
        result = subprocess.Popen(
            [ADB, "-s", ADB_PORT, "shell", "cat " + STEPS_RESULT],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        out, err = result.communicate()
        esito = str(out).strip()

        if "OK:" in esito:
            print(">>> [passi] iniezione completata: " + esito)
            subprocess.Popen(
                [ADB, "-s", ADB_PORT, "shell", "am force-stop " + FITINJ_PKG],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE
            ).communicate()
            return True
        if "ERROR:" in esito:
            print(">>> [passi] ERRORE iniezione: " + esito)
            return False
        wait(2)

    print(">>> [passi] TIMEOUT: nessun esito entro {0}s".format(timeout))
    return False

# ================================================================
# UTILITY GENERALI
# ================================================================
_screen_size = [None]

def get_screen_size():
    # risoluzione interna dell'emulatore (es. "Physical size: 540x960")
    if _screen_size[0] is None:
        adb_connect()
        result = subprocess.Popen(
            [ADB, "-s", ADB_PORT, "shell", "wm size"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        out, err = result.communicate()
        m = re.search(r"(\d+)x(\d+)", str(out))
        if m:
            _screen_size[0] = (int(m.group(1)), int(m.group(2)))
        else:
            print(">>> [scroll] wm size non leggibile, uso default 540x960")
            _screen_size[0] = (540, 960)
    return _screen_size[0]

def focalizza_ldplayer():
    # porta la finestra LDPlayer in primo piano: i tasti della
    # tastiera vanno solo alla finestra con il focus
    try:
        App.focus("LDPlayer")
    except Exception as e:
        print("  [focus] ATTENZIONE: focus LDPlayer fallito: {0}".format(e))
    wait(0.3)

def scroll_giu(volte=26):
    # freccia giu' sulla finestra LDPlayer: unico metodo che scorre
    # in modo affidabile (rotella, adb swipe e dragDrop non andavano)
    focalizza_ldplayer()
    print("  [scroll] {0} pressioni di freccia giu'...".format(volte))
    for i in range(volte):
        type(Key.DOWN)
        wait(0.05)

def scroll_giu_adb(volte=6):
    # variante via adb (input swipe), tenuta come ripiego
    w, h = get_screen_size()
    x  = w // 2
    y1 = int(h * 0.75)
    y2 = int(h * 0.25)
    for i in range(volte):
        subprocess.Popen(
            [ADB, "-s", ADB_PORT, "shell",
             "input swipe {0} {1} {2} {3} 400".format(x, y1, x, y2)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        ).communicate()
        wait(0.4)

def cerca_con_tentativi(immagine, max_tentativi=5, attesa=0.5):
    for t in range(1, max_tentativi + 1):
        if exists(immagine):
            return True
        print("    tentativo {0}/{1} fallito per [{2}], attendo {3}s...".format(
              t, max_tentativi, immagine, attesa))
        wait(attesa)
    print("  ERRORE: [{0}] non trovata dopo {1} tentativi.".format(immagine, max_tentativi))
    return False

def distanza(x1, y1, x2, y2):
    return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)

# ================================================================
# APERTURA APP
# ================================================================
def apri_weward(max_tentativi=2, attesa=0.5):
    print(">>> [apri_weward] avvio WeWard via adb...")
    adb_connect()
    result = subprocess.Popen(
        [ADB, "-s", ADB_PORT, "shell",
         "monkey -p {0} -c android.intent.category.LAUNCHER 1".format(WEWARD_PKG)],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    out, err = result.communicate()
    output = str(out).strip()

    if "monkey aborted" in output or "No activities found" in output:
        print(">>> [apri_weward] ERRORE: avvio fallito -> " + output)
        return False

    print(">>> [apri_weward] app aperta OK")
    attendi_barra_nav()
    return True

def attendi_barra_nav(timeout=20):
    # la barra di navigazione in basso (Attivita/Riscatta/Social/WeCards/Promo)
    # compare quando la home ha finito di caricare: e' il segnale di
    # "schermata pronta" da attendere PRIMA di qualsiasi altra azione
    print(">>> [home] attendo la barra di navigazione (home pronta)...")
    if exists(Pattern("1775217437436-3.png").similar(0.80), timeout):
        print(">>> [home] barra di navigazione comparsa, home pronta OK")
        wait(0.5)
        return True
    print(">>> [home] ATTENZIONE: barra non rilevata entro {0}s, proseguo".format(timeout))
    return False

def chiudi_weward():
    print(">>> [chiudi_weward] chiusura WeWard via adb...")
    result = subprocess.Popen(
        [ADB, "-s", ADB_PORT, "shell", "am force-stop " + WEWARD_PKG],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    result.communicate()
    print(">>> [chiudi_weward] app chiusa OK")

# ================================================================
# LOGIN ACCOUNT
# ================================================================
def apri_account(account='', max_tentativi=5, attesa=0.5):
    print("\n>>> [apri_account] avvio login per: {0}".format(account))

    if account not in ACCOUNT_CONFIG:
        print(">>> [apri_account] ERRORE: account {0} non presente in ACCOUNT_CONFIG.".format(account))
        return False

    cfg = ACCOUNT_CONFIG[account]

    print("  [1/5] apertura menu account...")
    if not cerca_con_tentativi("1776968842981.png", max_tentativi, attesa):
        print("  [1/5] ERRORE: menu account non trovato.")
        return False
    click(getLastMatch())
    print("  [1/5] menu account aperto OK")
    wait(attesa)

    print("  [2/5] selezione account {0} tramite bentornato...".format(account))
    hover(Location(185, 272))
    wait(0.5)
    click(Location(185, 272))
    print("  [2/5] account selezionato OK")
    wait(attesa)
    print("  [3/5] avvio login Google...")
    click(Location(185, 172))
    if not cerca_con_tentativi(cfg['google'], max_tentativi, attesa):
        print("  [3/5] ERRORE: pulsante Google non trovato.")
        return False
    click(getLastMatch())
    print("  [3/5] login Google avviato, attendo caricamento pagina...")
    wait(attesa)

    print("  [4/5] conferma login...")
    if not cerca_con_tentativi("1776969639793.png", max_tentativi, attesa):
        print("  [4/5] ERRORE: pulsante conferma non trovato.")
        return False
    click(getLastMatch())
    print("  [4/5] login confermato OK")
    wait(attesa)

    print(">>> [apri_account] login {0} completato OK".format(account))
    return True

# ================================================================
# NAVIGAZIONE SEZIONI
# ================================================================
def posizionati_su_carte():
    print("  [nav] apertura sezione Carte...")
    wait(5)
    if not cerca_con_tentativi("1775294025267-3.png", 5, 0.5):
        print("  [nav] ERRORE: icona sezione Carte non trovata.")
        return False
    click(getLastMatch())
    print("  [nav] sezione Carte aperta OK")
    wait(0.5)
    return True

def posizionati_su_attivita():
    print("  [nav] apertura sezione Attivita...")
    if not cerca_con_tentativi("1775217437436-3.png", 5, 0.5):
        print("  [nav] ERRORE: icona sezione Attivita non trovata.")
        return False
    click(getLastMatch())
    print("  [nav] sezione Attivita aperta OK")
    wait(0.5)
    return True

def posizionati_su_menuutenza():
    print("  [nav] apertura menu utente...")
    # l'immagine contiene la barra di stato: l'iconcina utente sta sotto,
    # quindi il click va spostato con targetOffset (come nello script no_google)
    if not cerca_con_tentativi(Pattern("1775217620164-3.png").targetOffset(-2, 32), 5, 0.5):
        print("  [nav] ERRORE: icona menu utente non trovata.")
        return False
    click(getLastMatch())
    print("  [nav] menu utente aperto OK")
    wait(0.5)
    return True

def sposta_mouse_neutro():
    # allontana il puntatore prima di cercare un'immagine:
    # LDPlayer disegna il cursore nell'emulatore e puo' coprire il match.
    # Il punto deve restare DENTRO la finestra LDPlayer (non sulla
    # barra laterale), altrove la finestra perderebbe i comandi
    hover(Location(300, 500))
    wait(0.3)

def posizionati_su_menuutenza_ingranaggio():
    print("  [nav] apertura impostazioni ingranaggio...")
    sposta_mouse_neutro()
    # l'immagine include la barra di stato: l'ingranaggio sta sotto,
    # click spostato con targetOffset (come nello script no_google)
    if not cerca_con_tentativi(Pattern("1775217843520-3.png").targetOffset(20, 19), 5, 0.5):
        print("  [nav] ERRORE: icona ingranaggio non trovata.")
        return False
    click(getLastMatch())
    print("  [nav] impostazioni aperte OK")
    wait(0.5)
    return True

# ================================================================
# LOGOUT
# ================================================================
def esci():
    # attesa caricamento pagina impostazioni: se le frecce partono
    # prima del rendering, le prime pressioni vanno perse
    print("  [logout 1/4] attendo caricamento pagina impostazioni...")
    wait(2.5)

    # 26 frecce giu' portano la selezione sul pulsante Esci in fondo
    # alla pagina impostazioni: INVIO lo attiva, senza ricerca immagine
    print("  [logout 1/4] scorro fino a Esci e premo INVIO...")
    scroll_giu(volte=26)
    wait(0.5)
    type(Key.ENTER)
    print("  [logout 1/4] INVIO su Esci OK")
    wait(0.5)

    print("  [logout 2/4] conferma 'vuoi uscire' con Si'...")
    if not cerca_con_tentativi("1775217958402-3.png", 5, 0.5):
        print("  [logout 2/4] ERRORE: prima conferma non trovata.")
        return False
    click(getLastMatch())
    print("  [logout 2/4] prima conferma OK")
    wait(0.5)

    print("  [logout 3/4] seconda conferma logout...")
    if not cerca_con_tentativi("1775218411391-3.png", 5, 0.5):
        print("  [logout 3/4] ERRORE: seconda conferma non trovata.")
        return False
    click(getLastMatch())
    print("  [logout 3/4] logout completato OK")
    wait(0.5)

    print("  [logout 4/4] chiudi app...")
    if not cerca_con_tentativi("1775296520334-3.png", 5, 0.5):
        print("  [logout 4/4] ERRORE: chiudi app non trovato.")
        return False
    click(getLastMatch())
    print("  [logout 4/4] app chiusa OK")
    wait(0.5)

    return True

def esci_weward():
    print(">>> [esci_weward] avvio sequenza logout...")
    posizionati_su_attivita()
    posizionati_su_menuutenza()
    posizionati_su_menuutenza_ingranaggio()
    esci()
    print(">>> [esci_weward] logout completato OK")

def assicura_account_scollegato():
    # WeWard deve mostrare la schermata di login: se invece c'e' ancora
    # la sessione del giro precedente, esegui il logout e riapri l'app
    print(">>> [pre-login] verifico che nessun account sia collegato...")
    if exists("1776968842981.png", 3):
        print(">>> [pre-login] schermata di login presente, OK")
        return True

    print(">>> [pre-login] sessione attiva rilevata, eseguo logout...")
    esci_weward()
    wait(1)

    if not apri_weward():
        print(">>> [pre-login] ERRORE: impossibile riaprire WeWard dopo il logout.")
        return False
    if exists("1776968842981.png", 5):
        print(">>> [pre-login] account scollegato, schermata di login OK")
        return True

    print(">>> [pre-login] ERRORE: schermata di login non trovata dopo il logout.")
    return False

# ================================================================
# RACCOLTA CARTE
# ================================================================
def raccogli_carte(max_tentativi=10, attesa=4):
    print("==> Cerco puntoblu...")
    doubleClick("1776970355761.png")
    wait(1)
    doubleClick("1776970355761.png")
    wait(1)
    doubleClick("1776970355761.png")
    wait(1)

    tentativo = 0
    prese = 0
    while prese < 7 and tentativo < max_tentativi:
        check_stop()
        print("--- Tentativo %d di %d ---" % (tentativo, max_tentativi))

        set_next_position()
        wait(4)

        carta = exists("1776442897675-3.png")
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
# CONTROLLO CARTE
# ================================================================
def controlla_carte():
    flagexit = True

    if not cerca_con_tentativi("1777034619146.png", 2, 0.5):
        print("  [controlla_carte] lista carte non trovata.")
        return False
    click(getLastMatch())
    wait(0.5)

    print("  [controlla_carte] verifico carte disponibili...")
    if cerca_con_tentativi("1775384584244-3.png", 2, 0.5):
        print("  [controlla_carte] nessuna carta disponibile.")
        return False
        wait(0.5)

    print("  [controlla_carte] torno indietro...")
    if cerca_con_tentativi("1777127421332.png", 5, 0.5):
        click(getLastMatch())
        print("  [controlla_carte] indietro OK")

    print("  [controlla_carte] carte da raccogliere: {0}".format(str(flagexit)))
    return True
# ================================================================
# ESECUZIONE TUTTI GLI ACCOUNT
# ================================================================
def esegui_tutti(max_tentativi=5, attesa=0.5):
    print("\n==============================")
    print("AVVIO CICLO SU TUTTI GLI ACCOUNT")
    print("==============================")
    risultati = {}
    for account in ACCOUNT_CONFIG:
        wait(1.5)

        email = ACCOUNT_CONFIG[account].get('email')
        if email:
            if not inietta_passi(email):
                print("  ATTENZIONE: iniezione passi fallita per {0}, proseguo comunque.".format(account))
        else:
            print("  email non configurata per {0}, iniezione passi saltata.".format(account))

        if not apri_weward(max_tentativi, attesa):
            print("ERRORE: impossibile aprire WeWard, script interrotto.")
            continue

        if not assicura_account_scollegato():
            print("  account precedente ancora collegato, salto {0}.".format(account))
            risultati[account] = 'FAIL'
            continue

        print("\n------------------------------")
        ok = apri_account(account, max_tentativi, attesa)
        risultati[account] = 'OK' if ok else 'FAIL'
        if ok:
            posizionati_su_carte()
            if controlla_carte():
                raccogli_carte(max_tentativi=21)
            else:
                print("  nessuna carta da raccogliere, passo al prossimo account.")
            esci_weward()
        else:
            print("  account {0} saltato per errore login.".format(account))

    print("\n==============================")
    print("RIEPILOGO FINALE")
    print("==============================")
    for acc, esito in risultati.items():
        print("  {0}  {1}".format(esito, acc))
    return

# ================================================================
# AVVIO SCRIPT
# ================================================================
#set_next_position(4)
if not avvia_ldplayer():
    print("ERRORE: LDPlayer non avviato, script interrotto.")
    sys.exit(1)
posiziona_finestra_ldplayer(0, 0)
adb_connect()
avvia_silentmock()
esegui_tutti(max_tentativi=15, attesa=0.5)
# raccogli_carte(max_tentativi=15)
# chiudi_ldplayer()   # scommenta per spegnere LDPlayer a fine ciclo