# Installare e gestire un'estensione

Obiettivo: installare un'estensione, leggere la domanda sui permessi e più tardi disattivare o rimuovere l'estensione.

## Quando ti serve

Un'estensione aggiunge qualcosa all'app senza che tu debba aspettare una nuova versione. Un'estensione può, per esempio, aggiungere un formato di importazione che compare in *File › Importa*, mettere un pulsante nella barra multifunzione o fornire un font per l'esportazione PDF. Il catalogo ufficiale le divide in categorie: *Importa/Esporta*, *Pianificazione*, *Report*, *Utilità*, *Font* e *Altro*.

Rifletti bene prima di installarne una. Un'estensione è codice di programma che viene eseguito con gli stessi diritti dell'app stessa, e l'app non può limitarlo. Per questo l'app chiede il permesso a ogni installazione. Ciò che vedi in quella domanda è spiegato sotto.

## Passaggi

### Installare un'estensione dal catalogo

1. Scegli *File › Estensioni*.
2. Scegli la scheda *Sfoglia*. L'app carica il catalogo mentre mostra *Caricamento catalogo...*. Ciò che si trova nel catalogo lo decide la OpenAEC Foundation che lo mantiene, e può cambiare.
3. Cerca un'estensione con il campo *Cerca estensioni...*. La ricerca avviene su nome, descrizione, autore e tag.
4. Ogni riquadro mostra nome, versione, categoria, descrizione e autore. Fai clic su *Installa*.
5. Si apre la finestra *Installare l'estensione?*. Leggila, poi vai al passaggio successivo.
6. Fai clic su *Installa* per continuare. Con *Non installare* non succede nulla. Esc o un clic accanto alla finestra vale anche come rifiuto, e l'app non mostra allora alcun messaggio di errore.

Dopo l'installazione l'estensione è attiva subito. Sulla scheda *Sfoglia* il riquadro dell'estensione ora dice *Installata*. Ciò che l'estensione aggiunge lo vedi nell'app stessa: un nuovo pulsante nella barra multifunzione, oppure un formato di importazione in *File › Importa*. Alcune estensioni mostrano anche un messaggio. Lo riconosci dal prefisso *Estensione* seguito dal nome dell'estensione.

**I tutorial.** I tutorial sono un'estensione. Se vedi il pulsante *Installa i tutorial* sotto *Tutorial* in *Guida*, si apre *File › Estensioni* sulla scheda *Sfoglia*. La domanda dopo il primo giro guidato installa anche questa estensione. Entrambe le strade mostrano la stessa domanda sui permessi; puoi rifiutarla.

### Installare un'estensione da un file

Se hai ricevuto un'estensione come file, installala così.

1. Scegli *File › Estensioni*.
2. In alto a destra fai clic su *ZIP* per un file ZIP, oppure su *JS* per un file JavaScript separato.
3. Scegli il file. Si apre la finestra *Installare l'estensione?*, come sopra.

Un file ZIP deve contenere un `manifest.json` e il file principale dell'estensione. Se installi un'estensione già installata, la nuova versione sostituisce quella vecchia. Se l'app non riesce a installare il file, per esempio perché un file ZIP è danneggiato, non succede nulla: per ZIP e JS l'app non mostra alcun messaggio di errore, e l'estensione non compare nell'elenco. Il motivo però si trova nel terminale di debug. Attivalo in *Impostazioni › Progetto › Impostazioni app*, scheda *Avanzate*, *Abilita il terminale di debug*, e aprilo con il pulsante *Mostra terminale di debug* nella barra di stato. Lì compare, per esempio, *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (l'app scrive questo testo tecnico in olandese).

### Leggere la domanda sui permessi

La domanda mostra ciò che devi decidere.

- *Autore* e *Repository* indicano chi ha realizzato l'estensione e dove si trova il codice sorgente.
- *Provenienza* indica da dove viene il file e se è stato verificato. Se in rosso indica che il download non è verificato, installa solo se conosci la fonte.
- *A cosa stai dicendo di sì* ripete che un'estensione è codice di programma che viene eseguito con gli stessi diritti dell'app stessa, e che cosa questo significa sulla tua piattaforma. Installa solo estensioni di un autore di cui ti fidi.
- *Ciò che questa estensione dichiara di usare* mostra i permessi che l'autore ha dichiarato, come piccole etichette. È una dichiarazione e non una restrizione. Se indica *Nulla di dichiarato.*, l'estensione può comunque leggere e modificare i dati della tua pianificazione.

Che cosa significa ogni etichetta e i testi esatti della finestra si trovano in [Permessi delle estensioni](docs://ref-extensiepermissies).

### Disattivare, riattivare o rimuovere un'estensione

1. Scegli *File › Estensioni* e la scheda *Installate*. Ogni estensione ha un riquadro con nome, versione, categoria, descrizione e autore.
2. Con l'interruttore sul riquadro disattivi l'estensione (*Disattiva*) o la riattivi (*Attiva*). Quando è disattivata, i pulsanti e i formati di importazione che l'estensione aggiungeva scompaiono, ma l'estensione resta installata. Resta disattivata anche dopo un riavvio dell'app. Un'estensione attiva si avvia da sola quando si avvia l'app.
3. Fai clic su *Rimuovi*. Il pulsante diventa *Conferma*, con la spiegazione *Fai clic di nuovo per rimuovere definitivamente*. Fai clic ancora una volta per rimuovere l'estensione. L'app elimina anche le impostazioni che l'estensione ha salvato.

## Problemi possibili e cosa fa l'app

**Il catalogo non si carica.** Compare *Impossibile caricare il catalogo:* con il motivo tecnico dopo, e il pulsante *Riprova*. Può dipendere dal fatto che non hai una connessione internet.

**Compare *Installazione non riuscita.* sotto un riquadro del catalogo.** Il download o l'installazione non è riuscito, per esempio perché il checksum non corrispondeva. Allora non è installato nulla. Questo è diverso dal rifiutare la domanda: in quel caso non c'è nessun messaggio di errore.

**Sopra l'elenco compare *Voci del catalogo saltate: 1*.** Il catalogo conteneva una voce che l'app non può usare. Puoi installare le altre estensioni come al solito.

**Un'estensione non si avvia.** Il riquadro mostra allora un messaggio di errore, per esempio che l'estensione richiede una versione più recente di Open Planner Studio, con la tua versione attuale, oppure l'errore che l'estensione stessa ha dato. L'estensione allora non è attiva. Aggiorna l'app, oppure rimuovi l'estensione.

**Un riquadro con *Quarantena*.** L'app non ha potuto usare l'estensione salvata. Sotto il nome indica *Motivo:* con la causa. Con *Rimuovi dall'archivio* la ripulisci.

**Scrivere tu stesso un'estensione.** La guida per gli autori di estensioni (manifest, API, permessi) si trova nel repository `OpenAEC-Foundation/open-planner-studio` su GitHub, nel file `docs/extensions.md`.

**Un'estensione non appartiene a un progetto.** Le estensioni sono salvate nell'app: nell'app desktop su questo computer, nel browser nello spazio di archiviazione di quel browser. Valgono per tutti i tuoi progetti e non fanno parte del file di progetto. Se cancelli i dati del sito nel browser, le estensioni spariscono.

## Vedi anche

- [Aggiornare l'app](docs://howto-app-bijwerken): un'estensione può richiedere una versione più recente dell'app.
- [Permessi delle estensioni](docs://ref-extensiepermissies): cosa significa ogni permesso nella domanda di installazione.
