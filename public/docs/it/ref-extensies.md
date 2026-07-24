# Gestire e installare le estensioni

Le estensioni aggiungono funzionalità all'app, come formati di importazione aggiuntivi o pulsanti personalizzati della barra multifunzione. Sono a livello di app: appartengono a questa installazione su questo dispositivo, non a un file di progetto.

## Apertura

**File** → **Estensioni** (Backstage). In alto si trovano due schede — **Installate** e **Sfoglia** — accanto ai pulsanti **ZIP** e **JS**, con un campo di ricerca sotto (**Cerca estensioni...**).

## Installate

Una scheda per estensione con nome, versione, categoria, descrizione e autore, più:

- **Interruttore attiva/disattiva** — attiva o disattiva l'estensione senza rimuoverla.
- **Rimuovi** — fai clic di nuovo su **Conferma** per rimuovere definitivamente.

Un'estensione il cui caricamento non è riuscito mostra un messaggio di errore sulla sua scheda. Senza estensioni la scheda segnala: "Nessuna estensione installata."

## Sfoglia (catalogo)

La scheda **Sfoglia** recupera il catalogo online delle estensioni (richiede una connessione internet). Ogni voce del catalogo è una scheda con **Installa**; le estensioni già installate mostrano il badge **Installata**. Se il caricamento non riesce, compare un messaggio di errore con **Riprova**.

## Installazione da file

- **ZIP** — installa uno ZIP di estensione (con `manifest.json` + `main.js`).
- **JS** — installa un singolo file `.js` con un manifest incorporato.

Dopo l'installazione l'estensione viene attivata immediatamente e gli eventuali pulsanti della barra multifunzione compaiono subito.

## Importare tramite le estensioni

**File** → **Importa** elenca i formati di importazione offerti dalle estensioni installate; fai clic su un formato e scegli un file. Senza estensioni di importazione la pagina segnala: "Nessuna estensione di importazione installata. Aggiungine una tramite Estensioni." I formati di importazione integrati (CSV, MS Project, P6) sono separati da questo — vedi [Importazione/esportazione](docs://gids-import-export).

## Scrivere le proprie estensioni

La guida per gli autori di estensioni (manifest, API, permessi) si trova nel repository: `github.com/OpenAEC-Foundation/open-planner-studio`, file `docs/extensions.md`.
