# Aggiungere attività e cardini

Obiettivo: inserire una nuova attività o un nuovo cardine nella tua pianificazione, nel punto in cui appartiene.

## Quando ti serve

Stai costruendo una pianificazione, si aggiungono lavori, oppure vuoi registrare un momento come una consegna o un'ispezione.

Un'**attività** è un'operazione che richiede tempo. Una nuova attività dura 5 giorni lavorativi per impostazione predefinita (con pianificazione oraria il predefinito del progetto può essere in ore). Un **cardine** è un momento senza durata: 0 giorni. Un'attività con sottoattività si chiama **attività di riepilogo**; in edilizia spesso è una fase. La sua durata e le sue date derivano dalle sottoattività non appena usi **Calcola** (F5).

## Passaggi

### Aggiungere un'attività

1. Scegli *Home › Attività › Attività*. Lo stesso pulsante è nella scheda *Tabella*.
2. Il pannello *Proprietà* si apre e il campo *Nome* è selezionato. Digita il nome e premi Invio.

La nuova attività si chiama all'inizio *Nuova attività* e inizia alla data di inizio del progetto.

Se un'attività è selezionata, la nuova attività va subito sotto di essa, allo stesso livello. Se l'attività selezionata è un'attività di riepilogo, la nuova attività va sotto l'intera fase, quindi dopo le sue sottoattività. Se non è selezionato nulla, va in fondo all'elenco. Il suggerimento del pulsante indica quale delle due cose succederà: *Nuova attività subito sotto la selezione* oppure *Nuova attività in fondo all’elenco*. Se selezioni più attività, viene creata una sola nuova attività, sotto la più in basso della selezione come la vedi sullo schermo.

### Passare rapidamente da un'attività all'altra nella tabella attività

Sotto l'ultima attività della tabella attività c'è sempre una riga grigia *Nuova attività*. Non è ancora un'attività: non compare nel diagramma di Gantt e non è nel file.

1. Fai clic su una cella di quella riga, oppure vai alla riga con la freccia giù.
2. Digita il nome e premi Invio. Ora è un'attività vera, allo stesso livello dell'attività sopra. Il cursore si trova subito sulla nuova riga grigia sotto.
3. Digita il nome successivo, e così via.

Se compili solo una durata o una data sulla riga grigia, l'attività si chiama *Nuova attività*. Se esci senza compilare nulla, non succede niente: nessuna attività e nessun passo in *Annulla*. Creare l'attività e il suo primo valore formano insieme un solo passo in *Annulla*. La riga grigia c'è solo quando la tabella attività non è filtrata, raggruppata o ordinata.

### Con il tasto destro del mouse su uno spazio vuoto

Fai clic destro su uno spazio vuoto: nella tabella attività sotto l'ultima attività, oppure nel diagramma di Gantt accanto o sotto le barre. Scegli *Nuova attività* oppure *Aggiungi cardine*. L'attività va in fondo all'elenco. Nel diagramma di Gantt inizia alla data in cui hai fatto clic. Nella tabella attività la cella del nome si apre subito, così puoi digitare.

### Sopra o sotto una specifica attività

Fai clic destro sull'attività e scegli *Inserisci sopra* oppure *Inserisci sotto*. Anche la tastiera funziona: Insert aggiunge sopra l'attività selezionata, Ctrl+I (⌘+I su Mac) sotto. Nella tabella attività la cella del nome si apre subito dopo Insert, pronta per la digitazione.

Con più attività selezionate viene creata una sola nuova attività: *Inserisci sopra* la mette sopra l'attività più in alto della selezione, *Inserisci sotto* sotto la più in basso.

### Aggiungere una sottoattività

Fai clic destro sull'attività e scegli *Aggiungi sottoattività*. La nuova attività va in fondo alle sottoattività di quell'attività. Nella tabella attività accanto al diagramma di Gantt, anche un'attività di riepilogo ha un piccolo **+** dopo il nome, che fa lo stesso.

### Aggiungere un cardine

1. Scegli *Home › Attività › Cardine ▾* e poi *Cardine di inizio*, *Cardine di fine* oppure *Punto di ispezione (obbligatorio)*.
2. Digita il nome e premi Invio. La posizione segue la stessa regola di *Attività*.

I tre tipi si comportano in modo diverso:

- Un *Cardine di inizio* va all'inizio del giorno, un *Cardine di fine* alla fine del giorno. Nel diagramma di Gantt il rombo si trova rispettivamente a sinistra o a destra della colonna del giorno. Conta anche per il successore. Supponi che un cardine sia martedì 29 settembre 2026 e che un'attività lo segua con una relazione fine-inizio: dopo un cardine di inizio, quell'attività inizia lo stesso martedì; dopo un cardine di fine, inizia mercoledì 30 settembre.
- Un *Punto di ispezione (obbligatorio)* è un cardine di fine con la categoria di lavoro *Ispezione* e la spunta *Obbligatoria (contrattuale)*.

### Trasformare un'attività esistente in cardine

Fai clic destro sull'attività e scegli *Alterna cardine*, oppure spunta *Cardine* nel pannello *Proprietà*. La voce di menu funziona per tutta la selezione. La durata diventa 0.

Se lo disattivi di nuovo, resta un'attività normale con durata 0: inserisci tu una durata.

### Altri modi

- Ctrl+M (⌘+M su Mac) mette un nuovo cardine in fondo all'elenco, anche se un'attività è selezionata. Il pannello *Proprietà* non si apre.
- Un cardine che crei con Ctrl+M o con il menu del clic destro riceve la categoria di lavoro *Ispezione*. Un *Cardine di inizio* o *Cardine di fine* da *Cardine ▾* riceve *Altro*. Cambia la categoria di lavoro in *Proprietà*, se ti serve.
- *Aggiungi cardine* nel menu del clic destro di un'attività rende il cardine una sottoattività di quell'attività, non un elemento allo stesso livello.

### Copiare un'attività o un intero ramo

1. Nel diagramma di Gantt, fai clic sulla barra dell'attività. Seleziona altre attività con Ctrl+clic.
2. Premi Ctrl+C (⌘+C su Mac). L'app copia l'attività con tutte le sue sottoattività, le relazioni tra le attività copiate e le loro assegnazioni di risorse.
3. Se vuoi, fai clic sulla barra dell'attività accanto alla quale deve andare la copia, e premi Ctrl+V (⌘+V).

La copia ha lo stesso nome, le stesse date e lo stesso avanzamento. Va inserita allo stesso livello dell'attività selezionata (con più attività: quella su cui hai fatto clic per prima), in fondo tra quelle di pari livello. Se non è selezionato nulla, va in fondo all'elenco. Le attività copiate sono selezionate dopo l'operazione, i codici WBS (il numero di ciascuna attività nell'albero, per esempio 1.2; vedi [Modificare la struttura](docs://howto-structuur-aanpassen)) vengono assegnati di nuovo e la pianificazione non è più aggiornata.

Gli appunti sono condivisi da tutta l'app, quindi puoi incollare anche in un altro documento. Ciò che lì non esiste, per esempio un calendario attività, una categoria di lavoro personalizzata, un codice attività o un campo personalizzato, l'app lo cancella e te lo segnala.

### Dopo

Una nuova attività non cambia ancora le altre date. La barra di stato mostra *Non aggiornato — ricalcola (F5)*. Premi **Calcola** (F5), per esempio tramite *Home › Pianificazione › Calcola*.

## Errori comuni e cosa fa l'app

**Ogni nuova attività inizia alla data di inizio del progetto.** Senza relazioni un'attività non aspetta nulla. Aggiungi relazioni, vedi [Aggiungere relazioni](docs://howto-relaties-leggen).

**Filtro, raggruppamento o ordinamento sono attivi.** L'ordine che vedi allora non è l'ordine della pianificazione. Con un'attività selezionata, *Attività* e *Cardine ▾* aggiungono la nuova attività in fondo. Compare una notifica rossa con il testo *La nuova attività si trova in fondo. Durante il filtraggio, il raggruppamento o l'ordinamento, l'app non può metterla sotto la tua selezione*. *Inserisci sopra* e *Inserisci sotto* sono rifiutati, con la striscia *Non disponibile durante filtro/raggruppamento/ordinamento*. Il pulsante *Cancella* nella notifica o nella striscia rimuove filtro, raggruppamento e ordinamento in una sola volta. Questo non fa parte di *Annulla*: Ctrl+Z non li ripristina.

**Una sottoattività sotto un'attività con assegnazioni di risorse.** L'attività diventa un'attività di riepilogo, e un'attività di riepilogo non ha assegnazioni proprie. L'app sposta le assegnazioni sulla nuova sottoattività e te lo segnala. Se non è possibile, per esempio perché hai scelto *Aggiungi cardine* e un cardine non può avere assegnazioni, l'app non aggiunge nulla e spiega perché.

**Una sottoattività sotto un cardine.** Il cardine diventa un'attività di riepilogo e l'app rimuove il contrassegno di cardine, con un messaggio.

**Cardine attivato per un'attività di riepilogo o per un'attività con assegnazioni.** L'app lo rifiuta e spiega perché. Con assegnazioni: rimuovile prima.

**Copia nella tabella attività.** Nella tabella attività (e nella scheda *Tabella*) Ctrl+C copia solo i valori delle celle selezionate, come in un foglio di calcolo, e Ctrl+V incolla nelle celle. Copiare attività funziona quindi solo se usi il diagramma di Gantt: fai prima clic su una barra.

## Vedi anche

- [Modificare la struttura](docs://howto-structuur-aanpassen): crea rientri e sposta le attività, e mantieni aggiornati i numeri WBS.
- [Aggiungere relazioni](docs://howto-relaties-leggen): collega le attività tra loro.
- [Selezionare, eliminare e annullare attività](docs://howto-taken-selecteren-verwijderen): rimuovi di nuovo un'attività.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): ciò che l'app calcola quando ci sono relazioni.
- [Finestra attività e pannello proprietà](docs://ref-taak-eigenschappen): tutti i campi di un'attività.
- [Nuovo progetto e Info progetto](docs://ref-projectinfo): iniziare con un modello di fasi.
- [Menu del clic destro](docs://ref-contextmenus): tutte le voci del menu su un'attività.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): un piccolo progetto di esempio (*File › Esempi*) con quattro fasi, un cardine di inizio e un cardine di consegna obbligatorio.
