# Aggiornare l'app

Obiettivo: sapere se hai l'ultima versione, aggiornare l'app e leggere cosa c'è di nuovo in una versione.

## Quando ti serve

Una nuova versione di Open Planner Studio esce regolarmente. Vuoi sapere se ce l'hai già, per esempio prima di segnalare un errore o perché un'estensione chiede una versione più recente. Oppure hai appena aggiornato e vuoi vedere cosa è cambiato.

L'aggiornamento funziona solo nell'app desktop. La versione per il browser non ha un programma di aggiornamento.

## Passaggi

### Aggiorna quando l'app stessa segnala una nuova versione

1. Avvia l'app desktop. All'avvio l'app controlla in background se c'è una nuova versione. Se non c'è una nuova versione, oppure il controllo non riesce, per esempio senza internet, non noti nulla.
2. Se c'è una nuova versione, si apre la finestra *Aggiornamento software*. Mostra *Versione attuale*, *Nuova versione*, il messaggio *È disponibile una nuova versione* e, sotto *Novità*, il testo che accompagna l'aggiornamento.
3. Salva i progetti aperti.
4. Clicca su *Scarica e installa*. Una barra di avanzamento mostra *Download in corso…*, poi segue l'installazione. Non puoi chiudere la finestra mentre il download è in corso.
5. Aspetta che l'app si riavvii da sola. Quella è la nuova versione.

Poco prima che l'aggiornamento venga installato, l'app crea anche uno snapshot di recupero (per il recupero dopo un crash) di ciò che hai aperto, vedi [Recupero dopo un crash](docs://howto-herstellen-na-een-crash).

### Controlla tu stesso se c'è una nuova versione

1. Scegli *Impostazioni › Progetto › Impostazioni app*. Puoi anche scegliere *File › Impostazioni app*, oppure l'ingranaggio in alto.
2. Scegli la scheda *Avanzate*. Sotto *Versione* c'è il numero della tua versione attuale.
3. Clicca su *Controlla aggiornamenti*. Si apre la finestra *Aggiornamento software* e mostra *Controllo in corso…*. Dopo, mostra *Stai usando la versione più recente* oppure il messaggio che c'è una nuova versione, con lo stesso pulsante *Scarica e installa*.

Nel browser questo pulsante non fa nulla di speciale: la finestra mostra subito *Stai usando la versione più recente*, senza che l'app controlli nulla.

### Leggi cosa c'è di nuovo

1. Se avvii l'app desktop per la prima volta con una versione diversa da quella precedente, si apre da sola una finestra. Il titolo è *Sei aggiornato!* Dopo una nuova installazione la finestra non si apre: il primo avvio non è un aggiornamento. Se vuoi vederla lo stesso, usa il pulsante *Novità* (vedi sotto).
2. In alto c'è il passaggio dalla versione precedente a quella nuova. Con il pulsante *Novità* si mostra solo la nuova versione.
3. Se per questa versione l'app ha un riepilogo integrato, vedi un punto principale e quattro punti più piccoli. Il punto principale può avere un pulsante *Leggi la guida*. Altrimenti vedi solo il passaggio di versione e ciò che sta sotto.
4. Con *Note di rilascio complete* apri il changelog su GitHub. Se non funziona, la finestra mostra *Impossibile aprire le note di rilascio.*
5. Sotto *Questo aggiornamento in numeri* ci sono il numero di giorni dal rilascio precedente, il numero di commit e il numero di righe di codice aggiunte. Se l'app riesce a trovare la differenza di dimensione del pacchetto di installazione, viene mostrata anche quella. Ogni cifra si mostra solo se è disponibile.
6. Clicca su *Capito* per chiudere la finestra.

Se vuoi rivedere questa finestra più tardi, scegli *Impostazioni › Progetto › Impostazioni app*, scheda *Avanzate*, e sotto *Versione* il pulsante *Novità*. La finestra si apre allora per la tua versione attuale, senza una versione precedente.

## Problemi possibili e cosa fa l'app in quel caso

**L'aggiornamento non riesce.** La finestra mostra *Si è verificato un problema durante l'aggiornamento* con sotto il motivo tecnico, e il pulsante *Riprova*.

**Hai installato l'app come pacchetto .deb e l'installazione non riesce.** La finestra spiega: *Aggiorna manualmente eseguendo questo comando in un terminale, oppure scarica l'ultimo pacchetto.* Sotto *Comando di installazione* c'è il comando, con il pulsante *Copia comando* (dopo mostra *Copiato*). Con *Apri pagina di download* vai alla pagina di download dell'ultima versione.

**Hai l'app tramite lo Snap Store.** In quel caso l'app non si aggiorna da sola e non controlla nemmeno all'avvio. Lo fa lo Snap Store. Nella finestra c'è scritto *Questa versione viene aggiornata automaticamente tramite lo Snap Store — non devi fare nulla.*

**All'avvio non compare niente.** È normale se hai già l'ultima versione. Il controllo all'avvio non segnala errori. Se vuoi essere sicuro di avere l'ultima versione, controlla tu stesso, come descritto sopra.

## Vedi anche

- [Inviare un feedback](docs://howto-feedback-geven): segnala un errore nell'ultima versione.
