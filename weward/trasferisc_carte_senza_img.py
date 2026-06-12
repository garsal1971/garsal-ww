# WeCards_AutoRegala.sikuli
#
# SETUP IMMAGINI (catturale con l'IDE SikuliX dalla schermata dell'app):
#   badge_orange.png  -> il cerchio arancione con numero in alto a dx della card
#   btn_regala.png    -> pulsante "Regala a un amico"
#   riga_garsal.png   -> la riga "garsal1971 / @garsal1971" nella lista amici
#   btn_seleziona.png -> pulsante "Seleziona" attivo (arancione pieno)
#   btn_invia.png     -> pulsante "Invia" arancione nella schermata conferma
#   btn_inviane.png   -> pulsante "Inviane un'altra" arancione

Settings.OcrTextRead  = True
Settings.OcrTextSearch = True

WAIT_TIMEOUT = 3    # secondi max attesa per ogni elemento
STEP_DELAY   = 3  # pausa tra uno step e l'altro (aumenta se l'app e' lenta)
SIMILARITY   = 0.77   # soglia similarita' immagine (0.0-1.0)

def step(pattern_file, label):
    """Aspetta l'elemento, ci clicca, fa pausa. Lancia FindFailed se non trovato."""
    el = wait(Pattern(pattern_file).similar(SIMILARITY), WAIT_TIMEOUT)
    click(el)
    wait(STEP_DELAY)
    print("  OK: " + label)

iterazione = 0
errori_consecutivi = 0
MAX_ERRORI = 4  # ferma dopo N errori di fila

while True:
    iterazione += 1
    print("\n=== Iterazione %d ===" % iterazione)

    try:
    
# --- 1. Cerca e clicca una card con badge arancione (prova N varianti) ---
        print("  Cerco badge arancione...")

        click(Location(100, 450))
        wait(STEP_DELAY)
        print("  OK: badge cliccato")

        # --- 2. Clicca "Regala a un amico" ---
        click(Location(100, 580))
        wait(STEP_DELAY)
        print("  OK: Regala cliccato")

        # --- 3. Clicca sulla riga "garsal1971" ---
        click(Location(100,320))
        wait(STEP_DELAY)
        print("  OK: garsal1971 cliccato")
        # --- 4. Clicca "Seleziona" ---
        click(Location(100, 610))
        wait(STEP_DELAY)
        print("  OK: Seleziona cliccato")
        # --- 5. Clicca "Invia" ---
        click(Location(100, 580))
        wait(STEP_DELAY)
        print("  OK: Invia cliccato")
        # --- 6. Clicca "Inviane un'altra" -> torna alla collezione ---
        click(Location(100, 610))
        wait(STEP_DELAY)
        print("  OK: Inviane un'altra cliccato")
        print("  Carta inviata con successo!")
        errori_consecutivi = 0  # reset contatore errori
        wait(2)

    except FindFailed as e:
        errori_consecutivi += 1
        print("ERRORE FindFailed (%d/%d): %s" % (errori_consecutivi, MAX_ERRORI, str(e)))

        # Tentativo di recupero: chiudi eventuali dialog aperti
        type(Key.ESC)
        wait(3)

        if errori_consecutivi >= MAX_ERRORI:
            print("Troppi errori consecutivi. Script interrotto.")
            break

    except Exception as e:
        print("ERRORE GENERICO: " + str(e))
        break

print("\nScript terminato dopo %d iterazioni." % iterazione)