# Informazioni sul progetto

La finestra **Informazioni sul progetto** contiene i metadati del progetto più la sezione **Calcolo** con le opzioni di pianificazione. Lo stesso modulo funge anche da procedura guidata del progetto per **Nuovo**.

## Apertura

- **Impostazioni** (scheda della barra multifunzione) → gruppo della barra multifunzione **Progetto** → **Info progetto**.
- Finestra Impostazioni (ingranaggio ⚙) → scheda **Generale** → **Informazioni sul progetto...**
- **File** → **Info progetto** — una variante semplificata nel Backstage, con solo i campi dei metadati (senza la sezione Calcolo).

**Applica** conferma tutte le modifiche in una volta; **Annulla**, **Esc** o un clic fuori dalla finestra le scarta. **Invio** fa lo stesso di Applica.

## Metadati

- **Nome del progetto** — il nome nella barra del titolo e nella scheda del documento.
- **Descrizione** — testo libero.
- **Ingegnere** e **Azienda** — testo libero; memorizzati nel file IFC.
- **Data di inizio** — l'inizio del progetto da cui il calcolo parte a contare.
- **Data di fine** — fine informativa del progetto.

## Calcolo

Opzioni di pianificazione per questo progetto — sono memorizzate con il file, non con l'app, quindi viaggiano su altre macchine. Se cambi qualcosa qui, la pianificazione viene ricalcolata automaticamente dopo **Applica**.

- **Definizione di critico** — **Margine totale ≤ soglia** (con **Soglia (giorni lavorativi)**, predefinita 0) o **Percorso più lungo**.
- **Calcolo del margine** — **Minimo (inizio/fine)** (predefinito), **Margine di inizio** o **Margine di fine**.
- **Attività a estremità aperta critiche** — contrassegna come critiche le attività senza successore.
- **Contrassegna quasi critico** — selezionandola rivela una **Soglia** aggiuntiva (predefinita 2 giorni lavorativi; l'unità segue la visualizzazione della durata, quindi eventualmente ore): le attività con poco margine ricevono il contrassegno "quasi critica".
- **Percorsi di margine multipli** — selezionandola rivela il **Metodo** (**Margine libero (peeling)** o **Margine totale (classifica)**) e i **Percorsi max.** (predefinito 10): il calcolo numera allora i percorsi di margine più importanti.
- **Calendario del ritardo** — quale calendario conta il ritardo di una relazione: **Predecessore** (predefinito), **Successore**, **24 ore** o **Calendario di progetto**.

Come leggere questi risultati è spiegato in [Percorso critico e analisi avanzata](docs://gids-kritiek-pad-analyse).

## La procedura guidata del progetto (Nuovo)

**Nuovo** apre la stessa finestra come procedura guidata (titolo **Nuovo progetto**, pulsante **Crea**). Oltre ai campi dei metadati, la procedura guidata contiene:

- **Modello di fasi** — **Vuoto**, **Edilizia residenziale** o **Edilizia non residenziale / ristrutturazione**: riempie il nuovo progetto con una struttura di fasi.
- **Turno** — visibile solo con la pianificazione oraria attivata: **Turno diurno** (predefinito), **2 turni**, **3 turni** o **24/7**.
- **Set di festività** — genera il calendario del progetto: scegli un paese (con regione e ferie edili dove applicabile), **Nessuna festività**, oppure **Personalizzato…** — quest'ultimo apre la finestra di dialogo del calendario subito dopo la creazione così puoi comporre il calendario a mano. Vedi [Finestra di dialogo calendario](docs://ref-kalenderdialoog).

La sezione Calcolo è assente dalla procedura guidata; impostala in seguito tramite uno degli accessi sopra indicati.
