# Collegamenti esterni

La finestra **Collegamento esterno (tra progetti)** registra una dipendenza tra un'attività di questo progetto e un'attività in un file di progetto diverso — ad esempio un progetto di opere esterne che deve terminare prima del tuo inizio.

## Apertura

Scheda **Relazioni** → pulsante **Collegamento esterno…**. Deve essere selezionata esattamente un'attività; altrimenti compare "Seleziona una singola attività per aggiungere un collegamento esterno."

## L'ancoraggio congelato

Un collegamento esterno non calcola in tempo reale rispetto al progetto di origine. Quando lo aggiungi, la data rilevante dell'attività di origine (inizio o fine, a seconda della direzione e del tipo di relazione) viene memorizzata come **data di ancoraggio** fissa; il calcolo usa quella data come limite. Se il progetto di origine cambia in seguito, nulla si sposta di conseguenza finché non **aggiorni** il collegamento.

## Due percorsi

- **File di origine** — scegli un file sotto **Scegli un file recente**; viene letto in sola lettura ("Il file di origine viene letto in sola lettura — non viene aperto come documento."). Poi scegli l'**Attività di origine** dall'elenco; la data di ancoraggio viene letta automaticamente da quell'attività e mostrata in basso. Questo percorso richiede l'app desktop e almeno un file recente.
- **Manuale (soluzione alternativa)** — nessun file a portata di mano (o versione browser): incolla l'**Id progetto** e l'**Id attività** dell'attività esterna, facoltativamente un **Nome attività**, e inserisci tu stesso la **Data di ancoraggio**. Un collegamento manuale resta contrassegnato come "obsoleto" finché un aggiornamento non trova effettivamente l'origine.

## Campi condivisi

- **Direzione** — **Predecessore (esterno → io)**: l'attività esterna determina la mia attività; oppure **Successore (io → esterno)**: la mia attività determina quella esterna.
- **Tipo di relazione** — FS, SS, FF o SF.
- **Ritardo (giorni lavorativi)** — tempo di attesa (o negativo: sovrapposizione) oltre l'ancoraggio.

**Aggiungi collegamento** salva il collegamento (disabilitato finché i campi obbligatori non sono compilati); **Annulla** chiude senza aggiungere.

## Gestione, aggiornamento e origini mancanti

I collegamenti esistenti sono elencati nel pannello Relazioni sotto **Collegamenti esterni**:

- Per collegamento: l'attività di origine, il tipo, l'ancoraggio e un'etichetta **obsoleto** una volta che l'origine non ha (più) potuto essere caricata — con la spiegazione "origine non caricata — reimporta per aggiornare".
- **Aggiorna questo collegamento** — rilegge il file di origine di questo singolo collegamento e aggiorna l'ancoraggio.
- **Aggiorna ancoraggi esterni** — rilegge ogni file di origine referenziato e aggiorna tutti gli ancoraggi più lo stato obsoleto. In seguito una riga di stato riporta quanti ancoraggi sono stati aggiornati e quanti sono rimasti obsoleti.
- **Rimuovi** — elimina il collegamento.
- L'aggiornamento legge file e quindi funziona solo nell'app desktop; la versione browser segnala "La lettura dei file di origine è possibile solo nell'app desktop; usa la soluzione alternativa manuale."

## Per saperne di più

- [Percorso critico e analisi avanzata](docs://gids-kritiek-pad-analyse) — come i collegamenti esterni influiscono sul percorso critico.
