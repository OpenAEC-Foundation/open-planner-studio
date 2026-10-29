# Aggiungere relazioni

Obiettivo: collega le attività tra loro, in modo che un'attività inizi solo quando il lavoro precedente è finito, e aggiungi dove serve un tempo di attesa (ritardo) tra di esse.

## Quando ti serve

Senza relazioni l'app non sa che il muratore può iniziare solo quando la fondazione è stata gettata. Ogni attività inizia quindi all'inizio del progetto e la data di fine non significa nulla. Una **relazione** registra quell'ordine. La prima attività è il **predecessore**, la seconda il **successore**.

Aggiungi relazioni quando costruisci una pianificazione, quando aggiungi un'attività, o quando due lavori, dopo tutto, risultano dipendere l'uno dall'altro. Un **ritardo** è un tempo di attesa tra due attività, ad esempio calcestruzzo che deve maturare o un massetto che deve asciugare.

La relazione predefinita è **FS** (fine-inizio): il successore può iniziare solo quando il predecessore è finito. L'app conosce anche SS, FF e SF, che collegano un inizio o una fine a un inizio o una fine. Con SS (inizio-inizio), ad esempio, l'intonaco può iniziare solo quando sono iniziati gli impianti.

Non sai quale tipo ti serve? Sotto la scelta del tipo, una frase con i nomi reali delle attività lo spiega, ad esempio *Metselwerk inizia solo dopo la fine di Fundering.* Scegli un altro tipo e la frase cambia. La vedi nella finestra *Tipo di relazione*, nel blocco *Dipendenze* e nella colonna *Predecessori* o *Successori*.

## Passaggi

Ci sono quattro modi per aggiungere una relazione. Creano la stessa relazione; scegli il modo che si adatta meglio alla tua situazione.

### Collegare due attività selezionate

Utile quando lavori nella tabella attività.

1. Nella tabella attività, fai clic sull'attività che viene prima: il predecessore.
2. Tieni premuto Ctrl (⌘ su un Mac) e fai clic sull'attività che viene dopo: il successore.
3. Scegli *Home › Attività › Collega ▾ › Collega le attività selezionate*. Lo stesso pulsante è anche in *Pianificazione › Relazioni*.

L'app crea una relazione fine-inizio senza ritardo. La vedi come una freccia nel Gantt e nella colonna *Predecessori*; una notifica compare solo se l'app rifiuta la relazione. Il pulsante funziona solo con esattamente due attività selezionate.

### Disegnare una relazione nel Gantt

Utile quando aggiungi molte relazioni di seguito.

1. Scegli *Home › Attività › Collega ▾ › Disegna relazione*. Sopra la pianificazione compare l'avviso *Modalità collegamento: trascina da una barra all'altra nel Gantt per creare una relazione. Esc per uscire.*
2. Premi sulla barra del predecessore e trascina fino alla barra del successore. Una linea tratteggiata con una freccia ti segue.
3. Rilascia il pulsante. Compare una piccola finestra *Tipo di relazione* con il tipo (FS per impostazione predefinita) e un campo per il ritardo.
4. Se serve, cambia il tipo o il ritardo e premi Invio, oppure fai clic fuori dalla finestra. La relazione viene creata.
5. Aggiungi subito la successiva: la modalità resta attiva. Puoi uscire con Esc, con il pulsante *Esci* nell'avviso, oppure scegliendo di nuovo *Disegna relazione*.

Se premi Esc nella finestra *Tipo di relazione*, non viene registrato nulla. Per una sola relazione non devi attivare la modalità: tieni premuto Shift mentre trascini da barra a barra. *Avvia relazione da qui* nel menu che si apre con il clic destro su una barra attiva la modalità collegamento; il trascinamento lo fai comunque tu. Nella scheda *Tabella*, senza Gantt, *Disegna relazione* è disattivato.

### Aggiungere una relazione nel pannello Proprietà

Utile quando guardi una sola attività e vuoi aggiungere i suoi predecessori o successori.

1. Seleziona l'attività. Il pannello *Proprietà* si trova a destra; se non lo vedi, attivalo con *Vista › Pannelli › Proprietà*.
2. Nel blocco *Dipendenze* fai clic su *Aggiungi relazione*.
3. Lascia la direzione su *Predecessore* se l'altra attività viene prima, oppure scegli *Successore*.
4. Scrivi una parte del nome dell'altra attività. Scegli quella giusta con i tasti freccia e Invio, oppure fai clic su di essa.
5. Scegli il tipo (FS per impostazione predefinita) e, se serve, compila un ritardo.
6. Premi Invio o fai clic sul segno di spunta (*Crea relazione*).

Le relazioni dell'attività compaiono poi in *Dipendenze*, ciascuna con il numero WBS dell'altra attività, il tipo e il ritardo.

### Scrivere relazioni nella colonna Predecessori

Utile quando lavori in fretta con la tastiera e conosci i numeri WBS.

1. Fai clic sul **+** a destra dell'intestazione della tabella attività (*Aggiungi colonna*) e, sotto *Relazioni*, scegli la colonna *Predecessori*. La colonna *Successori* funziona allo stesso modo.
2. Nella colonna *Predecessori*, fai clic sulla cella del successore.
3. Scrivi il numero WBS del predecessore, uno spazio e il tipo, ad esempio `2.6 FS`. Scrivi il ritardo subito dopo: `2.6 FS+1d`. Separa più predecessori con un punto e virgola o una virgola: `3.1 FS; 3.2 SS+2d`.
4. Premi Invio.

Quello che scrivi sostituisce tutta la cella. Se nella cella ci sono già dei predecessori, scrivili anche tu (vedi le insidie). Se premi Invio o F2 nella cella invece di scrivere, si apre un campo che conserva le relazioni esistenti: cerchi un'attività per numero WBS o nome e scegli il tipo e il ritardo per ogni relazione.

### Impostare o modificare un ritardo

Scrivi un ritardo nel campo accanto al tipo, con ciascuno dei modi sopra. Modifichi un ritardo esistente in *Dipendenze*: fai clic nel campo del ritardo, scrivi il nuovo valore e premi Invio.

- `3` oppure `3d`: 3 giorni lavorativi. Il fine settimana non conta. L'app mostra `+3d`.
- `3ed`: 3 giorni di calendario. Il fine settimana conta, come per il calcestruzzo che matura anche il sabato e la domenica.
- `-1`: un ritardo negativo (anticipo). Il successore può iniziare un giorno prima, quindi le attività si sovrappongono.
- `4h`: 4 ore lavorative; l'app lo mostra come `+4h`. Se il predecessore è un'attività in giorni su un calendario senza fasce orarie proprie, come il calendario standard, l'app converte questo valore in giorni lavorativi interi, arrotondato al giorno intero più vicino: `4h` vale allora 1 giorno, `2h` vale 0. Su un calendario con fasce orarie proprie, o dopo un'attività in ore, il ritardo conta esattamente in ore.
- `50%`: la metà della durata del predecessore.

Esempio: il calcestruzzo della fondazione deve maturare prima che il muratore possa lavorarci, quindi *Pour foundation → Foundation brickwork* riceve una relazione FS con ritardo `3`. Se il getto è venerdì 18 giugno 2027, la muratura inizia dopo il comando **Calcola**, giovedì 24 giugno: da lunedì a mercoledì è tempo di attesa. Con `3ed` il fine settimana conta e la muratura inizia martedì 22 giugno.

### Infine: ricalcola

Una nuova relazione non sposta ancora nessuna barra; la barra di stato indica *Non aggiornato — ricalcola (F5)*. Premi **Calcola** (F5), ad esempio tramite *Home › Pianificazione › Calcola*. Solo allora i successori ricevono le nuove date. Se vuoi che l'app lo faccia per te, attiva *Calcola automaticamente* in *Impostazioni › Progetto › Impostazioni app*, scheda *Pianificazione*.

## Insidie e comportamento dell'app

**Ordine invertito.** Con *Collega le attività selezionate* conta l'ordine dei tuoi clic, non l'ordine nella tabella attività. Se clicchi prima sull'attività che viene dopo, la relazione è nel verso sbagliato. Eliminala in *Dipendenze* con l'icona del cestino e aggiungila di nuovo.

**Scrivere nella colonna cancella quello che c'era.** Se la cella contiene `3.4 FS; 3.2 FS` e tu scrivi solo `3.2 FS`, la relazione con 3.4 è persa, senza messaggio. Scrivi tutti i predecessori, usa Invio o F2 per aggiungerne, oppure annulla con Ctrl+Z.

**Un ciclo.** Se aggiungi una relazione che riporta a un'attività precedente nella catena, la pianificazione non potrebbe mai iniziare. L'app rifiuta una relazione così: *Questa relazione creerebbe un ciclo nella pianificazione (…) e non è stata creata*, con le attività del ciclo tra parentesi. Elimina prima la relazione che chiude il ciclo.

**Un'attività con la propria attività di riepilogo.** Una relazione tra un'attività e l'attività di riepilogo sotto cui si trova non è possibile. L'app mostra *Una relazione tra un'attività e la propria attività di riepilogo antenata non è consentita.*

**Duplicato.** Se la relazione esiste già, l'app mostra *Questa relazione esiste già* e non cambia nulla.

**Messaggi più corti nella colonna.** La colonna *Predecessori* dà gli stessi rifiuti con un testo più corto sotto la cella: *Questa modifica creerebbe un ciclo nella pianificazione.*, *Questa relazione esiste già.* oppure *Un'attività non può avere una relazione con la propria attività di riepilogo.* Se scrivi solo un numero WBS, come `3.1`, manca il tipo e la cella mostra *Usa, ad esempio, 1.2 FS+2d.* La cella resta aperta; correggi l'input oppure premi Esc per annullare.

**Nessuna mezza giornata di ritardo.** Un ritardo in giorni è sempre un numero intero: `1.5` diventa `+2d`, e un ritardo in ore dopo un'attività in giorni su un calendario senza fasce orarie proprie viene arrotondato a giorni lavorativi interi. Un input non leggibile, ad esempio una parola, non viene salvato: il campo torna al valore precedente.

## Vedi anche

- [Percorso critico e margine](docs://uitleg-kritiek-pad): ciò che l'app calcola a partire dalle tue relazioni, e perché un'attività diventa critica.
- [Relazioni e ritardo](docs://uitleg-relaties): che effetto hanno sulle date i quattro tipi di relazione e un ritardo.
- [Tracciare un percorso](docs://howto-pad-traceren): mostrare la catena di predecessori e successori.
- [Finestra attività e pannello proprietà](docs://ref-taak-eigenschappen): i campi per relazioni e ritardo nel pannello e nella finestra.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): una catena di relazioni fine-inizio con una relazione inizio-inizio (pareti e tetto, ritardo di 2 giorni) e una relazione fine-fine (piastrelle e verniciatura, ritardo di 1 giorno).
