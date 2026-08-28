# Impostazioni

La finestra **Impostazioni** contiene le impostazioni dell'app: preferenze valide per questo dispositivo, indipendenti dal file di progetto. Ogni modifica viene applicata e salvata immediatamente — non c'è un pulsante OK. Le opzioni di pianificazione che modificano la pianificazione calcolata risiedono invece con il progetto — vedi [Informazioni sul progetto](docs://ref-projectgegevens).

## Apertura — tre accessi, stesso contenuto

- L'**ingranaggio** (⚙) nella barra del titolo.
- **Impostazioni** (scheda della barra multifunzione) → gruppo della barra multifunzione **Progetto** → **Impostazioni**.
- **File** → **Impostazioni** (Backstage).

Tutti e tre mostrano esattamente le stesse impostazioni. A seconda della tua versione sono distribuite
su tre o quattro schede — una quarta, **Applicazione**, si è recentemente separata dalla coda della
prima scheda — ma le impostazioni stesse e cosa fanno sono identiche in entrambi i casi; questo
articolo le raggruppa come **Generale**, **Lingua** e **Sequenza temporale / Zoom**.

## Scheda Generale

**Aspetto:**

- **Tema** — **Scuro**, **Chiaro** o **Alto contrasto**; fai clic su una scheda per cambiare.
- **Carattere** — **Predefinito**, **Sistema**, **Serif** o **Monospace**; sovrascrive il carattere tipografico dell'interfaccia. Le app web non seguono automaticamente l'impostazione del carattere di sistema, quindi questa e la prossima opzione sono il modo in cui lo scegli tu stesso.
- **Dimensione testo** — 90%, 100%, 110% o 125%; scala il testo e l'impaginazione dell'interfaccia.
- **Stile di cambio documento** — come passare tra i documenti aperti: **Schede orizzontali**, **Schede verticali** o **Pillola**.
- **Formato data** — **gg-mm-aaaa**, **mm-gg-aaaa** o **aaaa-mm-gg**. Solo visualizzazione; file e calcoli non ne risentono.
- **Modalità cantiere** — **Attiva la modalità cantiere** cambia i valori predefiniti per i *nuovi* progetti tra un'impostazione orientata all'edilizia (un calendario di cantiere con festività olandesi, ferie edili, modelli di fasi) e una configurazione neutra, non specifica per l'edilizia. I progetti esistenti non ne risentono in entrambi i casi.

**Applicazione:**

- **Versione** — il numero di versione dell'app (sola lettura), con un link **Controlla aggiornamenti** che apre la finestra di aggiornamento. L'installazione degli aggiornamenti funziona solo nell'app desktop; le installazioni Snap e AppImage si aggiornano tramite il proprio canale. A parte questo, la prima volta che apri l'app dopo che si è aggiornata automaticamente, compare da sola una finestra di dialogo una tantum "Sei stato appena aggiornato" — il salto di versione, la differenza di dimensione dell'installer, i giorni trascorsi dalla release precedente e le note di rilascio di GitHub, per quanto sia stato possibile recuperarle. È un momento diverso, automatico, rispetto al link manuale **Controlla aggiornamenti** qui sopra.
- **Informazioni sul progetto...** — una scorciatoia alla finestra [Informazioni sul progetto](docs://ref-projectgegevens).
- **Tour** — **Avvia tour** riavvia il tour introduttivo. Lo stesso riavvio si trova anche nella scheda della barra multifunzione **Vista** → **Tour** e nel Backstage (**File** → **Avvia tour**).
- **Benchmark** — apre lo strumento di benchmark integrato, per misurare le prestazioni di calcolo/rendering di questa macchina.
- **Modalità IA** — **Attiva la modalità IA** mostra la scheda della barra multifunzione **IA** con il bridge MCP, così un assistente IA può lavorare con la tua pianificazione tramite il Model Context Protocol; disattivarla arresta immediatamente un bridge in esecuzione. **Avvia il bridge automaticamente** (disponibile solo con la modalità IA attiva) avvia il bridge non appena parte l'app, senza dover prima visitare la scheda IA — solo app desktop. Vedi la guida in-app all'assistente IA per il quadro completo.
- **Terminale di debug** — **Abilita il terminale di debug** mostra il pannello di log per la risoluzione dei problemi.

## Scheda Lingua

- **Lingua** — la lingua di visualizzazione dell'app, applicata immediatamente.

## Scheda Sequenza temporale / Zoom

- **Pianificazione oraria** — **Attiva pianificazione oraria** abilita la scala oraria e le fasce di lavoro. Quando è disattivata, le nuove attività iniziano in giorni e quelle a ore esistenti restano esatte. Quando è attiva, attività a giorni e a ore possono coesistere. Vedi [Calendari e pianificazione oraria](docs://gids-kalenders-uren).
- **Visualizzazione della durata** — **Automatica (unità propria per attività)**, **Sempre giorni** o **Sempre ore**.
- **Barre attività alle interruzioni** — **Non dividere mai**, **Dividi alla selezione** o **Dividi sempre**: se una barra si divide visivamente attorno ai giorni non lavorativi.
- **Asse della sequenza temporale** — **Mostra solo i giorni lavorativi** comprime la sequenza temporale: i fine settimana e i giorni festivi del calendario di progetto vengono saltati, così un'attività di 5 giorni lavorativi è larga esattamente 5 colonne, qualunque sia l'aspetto del calendario nel mezzo.
- **La settimana inizia il** — **Lunedì** o **Domenica** (disposizione settimanale della scala temporale).
- **Mostra i quarti d'ora con ingrandimento elevato** — gradazione extra al quarto d'ora sulla scala temporale oraria.
- **Calcolo** — **Calcola automaticamente** ricalcola la pianificazione non appena diventa obsoleta, invece di attendere F5.
- **Scorrimento e zoom** — **Modalità**:
- **Zoom + trascina** (predefinita) — la rotella del mouse esegue lo zoom (ancorato al cursore); trascina lo sfondo del diagramma per scorrere la vista; Shift+rotella scorre tra le righe; Ctrl/⌘+trascina disegna un riquadro di selezione.
- **Posizione** — la posizione del cursore determina la direzione di scorrimento; con **Divisione schermo** (**Sinistra/destra**, **Su/giù** o **Angolo in alto a destra**). Ctrl+rotella = zoom, Shift+rotella = orizzontale.
- **Tasti** — assegna quale comando (**Scorrimento**, **Ctrl + rotella**, **Shift + rotella**) ottiene quale funzione (**Verticale**, **Orizzontale**, **Zoom**) trascinando i chip; rilasciando su uno slot occupato si scambiano i comandi.
