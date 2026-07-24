# Impostazioni

La finestra **Impostazioni** contiene le impostazioni dell'app: preferenze valide per questo dispositivo, indipendenti dal file di progetto. Ogni modifica viene applicata e salvata immediatamente — non c'è un pulsante OK. Le opzioni di pianificazione che modificano la pianificazione calcolata risiedono invece con il progetto — vedi [Informazioni sul progetto](docs://ref-projectgegevens).

## Apertura — tre accessi, stesso contenuto

- L'**ingranaggio** (⚙) nella barra del titolo.
- **Impostazioni** (scheda della barra multifunzione) → gruppo della barra multifunzione **Progetto** → **Impostazioni**.
- **File** → **Impostazioni** (Backstage).

Tutti e tre mostrano esattamente le stesse impostazioni, distribuite su tre schede: **Generale**, **Lingua** e **Sequenza temporale / Zoom**.

## Scheda Generale

- **Tema** — **Scuro**, **Chiaro** o **Alto contrasto**; fai clic su una scheda per cambiare.
- **Stile di cambio documento** — come passare tra i documenti aperti: **Schede orizzontali**, **Schede verticali** o **Pillola**.
- **Formato data** — **gg-mm-aaaa**, **mm-gg-aaaa** o **aaaa-mm-gg**. Solo visualizzazione; file e calcoli non ne risentono.
- **Versione** — il numero di versione dell'app (sola lettura).
- **Aggiornamenti** — **Controlla aggiornamenti** apre la finestra di aggiornamento. L'installazione degli aggiornamenti funziona solo nell'app desktop; le installazioni Snap e AppImage si aggiornano tramite il proprio canale.
- **Zoom predefinito** — il livello di zoom predefinito (sola lettura, 30 px/giorno).
- **Terminale di debug** — **Abilita il terminale di debug** mostra il pannello di log per la risoluzione dei problemi.
- **Informazioni sul progetto...** — scorciatoia alla finestra [Informazioni sul progetto](docs://ref-projectgegevens).
- **Tour** — **Avvia tour** riavvia il tour introduttivo. Lo stesso riavvio si trova anche nella scheda della barra multifunzione **Vista** → **Tour** e nel Backstage (**File** → **Avvia tour**).

## Scheda Lingua

- **Lingua** — la lingua di visualizzazione dell'app; quattordici lingue, applicate immediatamente.

## Scheda Sequenza temporale / Zoom

- **Pianificazione oraria** — **Attiva pianificazione oraria** attiva la pianificazione ora/minuto: una scala temporale oraria, turni con fasce orarie di lavoro e barre attività precise all'ora. Disattivato ⇒ l'app resta completamente granulare per giorni. Con l'interruttore attivo, compare **Consenti pianificazione mista giorno/ora** (attività a giorni e a ore in un unico progetto). Se apri un file che contiene pianificazione oraria mentre l'interruttore è disattivato, una barra in alto offre **Attiva pianificazione oraria**. Vedi [Calendari e pianificazione oraria](docs://gids-kalenders-uren).
- **Visualizzazione della durata** — **Automatica (unità propria per attività)**, **Sempre giorni** o **Sempre ore**.
- **Barre attività alle interruzioni** — **Non dividere mai**, **Dividi alla selezione** o **Dividi sempre**: se una barra si divide visivamente attorno ai giorni non lavorativi.
- **La settimana inizia il** — **Lunedì** o **Domenica** (disposizione settimanale della scala temporale).
- **Mostra i quarti d'ora con ingrandimento elevato** — gradazione extra al quarto d'ora sulla scala temporale oraria.
- **Calcolo** — **Calcola automaticamente** ricalcola la pianificazione non appena diventa obsoleta, invece di attendere F5.
- **Scorrimento e zoom** — **Modalità**:
- **Posizione** — la posizione del cursore determina la direzione di scorrimento; con **Divisione schermo** (**Sinistra/destra**, **Su/giù** o **Angolo in alto a destra**). Ctrl+rotella = zoom, Shift+rotella = orizzontale.
- **Tasti** — assegna quale comando (**Scorrimento**, **Ctrl + rotella**, **Shift + rotella**) ottiene quale funzione (**Verticale**, **Orizzontale**, **Zoom**) trascinando i chip; rilasciando su uno slot occupato si scambiano i comandi.
- **Zoom + trascina** — la rotella del mouse esegue lo zoom (ancorato al cursore); trascina lo sfondo del diagramma per scorrere la vista.
