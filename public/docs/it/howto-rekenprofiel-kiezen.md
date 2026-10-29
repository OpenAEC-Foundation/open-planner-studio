# Scegliere o costruire un profilo di calcolo

Obiettivo: decidi quali regole di calcolo usa un progetto. Scegli un profilo integrato, oppure crei un profilo personalizzato con le tue convenzioni.

## Quando ti serve

Apri un progetto che deve calcolare come Primavera P6 o Microsoft Project, oppure vuoi impostare una convenzione in modo diverso da come fa il profilo. Che cos'è un profilo e perché le date possono spostarsi è spiegato in [Profili di calcolo e convenzioni](docs://uitleg-rekenprofielen).

## Passaggi

### Scegliere un profilo per un nuovo progetto

1. Scegli *Home › File › Nuovo*. Si apre la finestra *Nuovo progetto*.
2. Nell'elenco a discesa *Profilo di calcolo* scegli il profilo: *Open Planner Studio*, *Primavera P6* o *Microsoft Project*.
3. Crea il progetto. L'app sostituisce le opzioni di calcolo che avevi già compilato con i valori predefiniti del profilo.

### Cambiare il profilo di un progetto esistente

1. Scegli *Impostazioni › Progetto › Impostazioni progetto*. Puoi anche scegliere *File › Impostazioni progetto*.
2. Nel blocco *Profilo di calcolo e opzioni* apri l'elenco a discesa *Profilo di calcolo* e scegli un altro profilo.
3. Clicca su **Applica**. L'app ricalcola subito la pianificazione, anche se *Calcola automaticamente* è disattivata. Se delle attività si sono spostate, l'app indica quante.

Finché non clicchi *Applica*, la modifica esiste solo nel modulo. L'intero cambio conta come un unico passo per *Annulla*. Cambiare profilo modifica solo le convenzioni; le tue opzioni di calcolo restano come sono.

### Costruire un profilo personalizzato

1. Nel blocco *Profilo di calcolo e opzioni* clicca su *Nuovo profilo*, accanto all'elenco a discesa.
2. Inserisci un nome. L'app propone il nome *Copia di* seguito dal nome del profilo scelto, per esempio *Copia di Open Planner Studio*.
3. Clicca su *Crea*. La parte *Convenzioni di questo profilo* si espande.
4. Attiva o disattiva le convenzioni con le caselle di controllo. L'icona i dopo una riga mostra la spiegazione di quella convenzione. Una convenzione che differisce dalla base riceve l'etichetta *torna alla base*.
5. Clicca su **Applica**. Solo allora il progetto calcola con il nuovo profilo.

I tre profili integrati non si possono modificare. Le loro convenzioni sono mostrate solo a titolo informativo.

### Conservare un profilo personalizzato come modello

1. Se serve, dai al profilo personalizzato un altro nome nel campo *Nome di questo profilo personalizzato*.
2. Clicca su *Salva come modello*. L'app segnala che il modello è stato salvato oppure il motivo per cui il salvataggio non è riuscito.
3. In un altro progetto della stessa app, il modello si trova nell'elenco a discesa *Profilo di calcolo*.

Se il profilo in seguito differisce dal modello, un blocco giallo lo segnala. Scegli allora *Aggiorna il modello da questo progetto* o *Aggiorna dal modello*.

Elimini un modello con *Elimina modello*. L'app chiede prima una conferma.

## Controllare il risultato

- Il blocco *Profilo di calcolo e opzioni* mostra il profilo scelto.
- Dopo *Applica* l'app segnala le attività spostate, per esempio *Dopo l’applicazione sono state spostate 4 attività.*
- Un blocco arancione sopra le opzioni di calcolo segnala che le tue opzioni di calcolo differiscono dal predefinito del profilo. Questo è spesso voluto. Se vuoi comunque il predefinito, clicca su *Usa le impostazioni predefinite di …*.

## Errori comuni e cosa fa l'app

**Le date si spostano.** Un altro profilo può cambiare le date reali. Controlla il risultato. Se non ti piace, scegli *Annulla*: profilo e date tornano insieme.

**Un blocco giallo dopo Annulla.** Se premi *Annulla* o *Ripeti* mentre sono aperte le Impostazioni progetto, il blocco segue lo stato del progetto. Se avevi già cambiato qualcosa nel blocco tu stesso, la tua scelta resta. Un blocco giallo indica allora che *Applica* riporta quella scelta.

**Al massimo 100 modelli.** Se ce ne sono già 100, l'app non salva il modello e lo segnala. Elimina prima un modello. Anche uno spazio di archiviazione dell'app pieno o mancante dà un messaggio.

**I modelli appartengono all'app, il profilo al progetto.** Il progetto ha sempre una propria copia del profilo. Se modifichi il modello in seguito, il progetto non cambia di conseguenza.

**Impostazioni da un file di origine.** Se scegli *Primavera P6* o *Microsoft Project* per un progetto che proviene da un altro file, restano le impostazioni del file di origine. Qui non puoi cambiarle.

## Vedi anche

- [Profili di calcolo e convenzioni](docs://uitleg-rekenprofielen): che cos'è un profilo e che effetto ha sulle date.
- [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies): tutte le convenzioni e opzioni di calcolo in una vista.
- [Scegliere la modalità di progresso](docs://howto-voortgangsmodus-kiezen): Retained Logic o Progress Override, separata dal profilo.
