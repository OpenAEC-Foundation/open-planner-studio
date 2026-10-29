# Notifiche e avvisi

L'app ti mostra che cosa succede in quattro punti: la barra di stato in basso, il pannello *Avvisi* nella colonna destra, le notifiche che compaiono brevemente in fondo allo schermo e le strisce sotto la barra multifunzione. Questo articolo spiega per ogni punto che cosa vedi, quando compare e che cosa puoi fare. Perché una pianificazione è critica o sovrassegnata è spiegato in [Percorso critico e margine](docs://uitleg-kritiek-pad). Come risolvi una risorsa sovrassegnata è spiegato in [Risolvere una risorsa sovrassegnata](docs://howto-overbezetting-oplossen). Come crei relazioni è spiegato in [Creare relazioni](docs://howto-relaties-leggen).

## La differenza tra le quattro

- **Barra di stato** — una riga fissa con contatori. Vengono dall'ultimo calcolo e restano finché non calcoli di nuovo.
- **Pannello Avvisi** — l'elenco dietro quei contatori, con tutto ciò che ha trovato l'ultimo calcolo. Con un clic vai all'attività, alla relazione o alla risorsa. Il pannello viene ricavato dall'ultimo calcolo; non viene salvato nulla.
- **Notifiche** — messaggi brevi su qualcosa che hai appena fatto (salvataggio non riuscito, relazione rifiutata, file importato). Un'informazione scompare di nuovo, un errore resta finché non lo chiudi. Non sono nel pannello.
- **Striscia sotto la barra multifunzione** — una striscia colorata con una spiegazione e un pulsante. Appartiene a uno stato del documento o a una modalità e resta finché quello stato vale. Vedi *Le strisce sotto la barra multifunzione*.

## La barra di stato

La barra in basso mostra, da sinistra a destra:

- **Attività:** — il numero di attività foglia (le attività di riepilogo non si contano).
- **Cardini:** — il numero di cardini.
- **Percorso critico: N attività, N giorni lavorativi** — il numero di attività critiche e la durata del progetto. Compare solo dopo un calcolo.
- **Fine:** — la fine del progetto dal calcolo. Compare solo dopo un calcolo; un progetto vuoto non ne ha una.
- **N scadenza/e superata/e**, **N vincolo/i violato/i**, **N relazione/i fuori sequenza** e **N risorsa/e sovrassegnata/e** — ciascuno è un pulsante con un segnale di avviso. Compare solo quando il contatore è sopra 0 e c'è un calcolo. Un clic apre il pannello *Avvisi* (testo di aiuto: *Apri il pannello Avvisi (dettagli e navigazione)*). Se ti trovi nella scheda *IFC* o *Rapporto*, l'app passa contemporaneamente a *Home*, perché nella colonna destra di quelle schede non c'è nulla. Il contatore *risorsa/e sovrassegnata/e* si aggiorna anche dopo modifiche alle risorse e alle assegnazioni. Gli altri contatori cambiano solo dopo *Calcola*. I quattro contatori sono una selezione: ciò che il pannello mostra in più (anticipo troncato, relazione ignorata, hammock senza driver di fine, data di fine limitata, errore di pianificazione) non è nella barra di stato.
- **Non aggiornata — ricalcola (F5)** — con un segnale di avviso (testo di aiuto: *Pianificazione non aggiornata — ricalcola (F5)*). Compare appena cambi qualcosa che influisce sulla pianificazione e non hai ancora ricalcolato. Se *Calcola automaticamente* è attivo, non compare, tranne quando il calcolo ha dato un errore: in quel caso resta.
- **Selezione: N attività** — il numero di attività selezionate. Compare solo con una selezione.
- **Scala:** e **Zoom: Npx/giorno** — la scala temporale della timeline e il livello di zoom. La scala dipende dallo zoom.
- **Non salvato** — finché il documento contiene modifiche che non sono nel file.
- **IA** — un punto colorato con la parola IA, solo quando la modalità IA è attiva. Il testo di aiuto dice *Ponte IA:* con *Disattivo*, *Attivo sulla porta N*, *Porta N occupata* o *Errore*. Un clic apre la scheda *IA*.
- **Terminale di debug** — un pulsante terminale, solo quando il terminale di debug è attivato. Mostra o nasconde il terminale (*Mostra terminale di debug* / *Nascondi terminale di debug*).

## Il pannello Avvisi

- **Apertura** — *Pianificazione › Pianificazione › Avvisi*, *Vista › Pannelli › Avvisi*, oppure un contatore nella barra di stato. Il pannello si trova nella colonna destra, sotto *Proprietà* e il pannello risorse. Espande una colonna chiusa. Per impostazione predefinita è chiuso e non viene ricordato tra una sessione e l'altra. Trascina l'altezza dal bordo quando si trova sotto altri pannelli; quell'altezza viene ricordata. La croce in alto a destra chiude il pannello (*Chiudi avvisi*).
- **Riga di intestazione** — *N errore/i, N avviso/i*. Se non è ancora stato calcolato nulla, dice *Non ancora calcolato — premi Calcola (F5) per eseguire i controlli.*
- **Calcola** — un pulsante nella riga di intestazione. È visibile finché la pianificazione non è aggiornata o non è ancora calcolata. Fa la stessa cosa di *Calcola* nella barra multifunzione.
- **Segnale di avviso nella riga di intestazione** — quando la pianificazione non è aggiornata, con il testo di aiuto *Pianificazione obsoleta — questo elenco proviene dall'ultimo calcolo. Ricalcola (F5).* L'elenco non viene nascosto, viene solo segnato come obsoleto.
- **Elenco vuoto** — *Nessun avviso. La pianificazione supera tutti i controlli.*
- **Riga** — in alto il luogo (attività, relazione, risorsa o progetto) e sotto la descrizione. Un errore ha un proprio segnale ottagonale, un avviso un segnale triangolare. Un'attività compare come `nome WBS`. Una relazione compare come `predecessore → successore (FS+2d)`, con tipo e ritardo. Un clic va al luogo (testo di aiuto *Vai a: …*), vedi sotto. La riga che appartiene alla tua attività attiva (per una relazione: il suo successore) o alla risorsa scelta nell'istogramma è evidenziata.
- **Ordine** — prima gli errori; poi per tipo, nell'ordine della lista sotto; dentro ogni tipo nell'ordine del documento (per una relazione quello del successore, per una risorsa quello della lista risorse). Un'attività, relazione o risorsa cancellata dopo l'ultimo calcolo scompare dall'elenco.

### Tipi di avviso

- **Errore di pianificazione** — *La pianificazione non ha potuto essere calcolata: …*, con il motivo dopo i due punti; vedi sotto. Un clic: per un ciclo l'app seleziona tutte le attività del ciclo e va alla prima. Per altri errori non c'è niente a cui andare e la riga non è un pulsante.
- **Scadenza superata** — *Scadenza {date} superata — fine anticipata {date}*. L'attività ha una scadenza e il calcolo non la rispetta. Un clic va all'attività. Per risolvere: modifica la logica o la durata, oppure sposta la scadenza.
- **Vincolo violato** — *Il vincolo {type and date} è superato dalla logica (margine negativo)*. Il vincolo non si può rispettare senza rompere la logica; il margine è negativo. Un clic va all'attività. Vedi [Vincoli](docs://uitleg-constraints).
- **Fuori sequenza** — *Fuori sequenza: l'avanzamento del successore contraddice la relazione*. L'avanzamento del successore non si adatta al tipo di relazione. Per esempio: il successore è già in corso, mentre il predecessore non è ancora finito in una relazione fine-inizio. Un clic seleziona entrambe le attività, con il successore attivo. Controlla le date effettive o la relazione.
- **Anticipo troncato** — *Anticipo troncato dall'inizio del progetto — la relazione non è rispettata del tutto*. L'anticipo (ritardo negativo) della relazione va prima dell'inizio del progetto. Un clic seleziona entrambe le attività.
- **Relazione ignorata** — *Relazione ignorata: predecessore o successore mancante o non è un'attività foglia*. Il calcolo non usa la relazione. Un clic seleziona le attività che esistono ancora. Vedi [Relazioni](docs://uitleg-relaties).
- **Hammock senza driver di fine** — *Hammock senza driver di fine (nessun predecessore FF/SF): la durata torna a zero*. Un clic va all'attività. Vedi [Attività hammock](docs://howto-hammock).
- **Data di fine limitata** — *Data di fine limitata: il calendario non lascia alcuna finestra lavorativa per questa attività*. Il calcolo ha raggiunto il limite di giorni che cerca, per esempio per un lungo periodo ininterrotto di giorni di riposo nel calendario. Un clic va all'attività. Vedi [Calendari e giorni lavorativi](docs://uitleg-kalenders).
- **Risorsa sovrassegnata** — *Sovrassegnata per N giorno/i (primo – ultimo)*. Se tutti i giorni sono giorni di riposo, si aggiunge *la risorsa non lavora questi giorni secondo il suo calendario*. In caso di mix si aggiunge *di cui N giorno/i la risorsa non lavora secondo il suo calendario*. Un clic seleziona le attività con un'assegnazione su quella risorsa, attiva l'istogramma e sceglie quella risorsa. Dalle schede *Tabella*, *IFC* o *Rapporto* l'app passa a *Risorse*. Vedi [Pannello risorse](docs://ref-resourcepaneel).

### Motivi di un errore di pianificazione

- *Dipendenza circolare tra attività: {path}* — le relazioni formano un ciclo. Le attività sono nel percorso. Inverti o elimina una relazione.
- *Nel calendario non sono impostati giorni lavorativi* — assegna al calendario almeno un giorno lavorativo. Vedi [Finestre del calendario](docs://ref-kalenders).
- *Durata in giorni non valida per l'attività '{task}'* e *Durata in ore non valida per l'attività '{task}'* — la durata dell'attività non è un numero valido.
- *L'attività in ore '{task}' non ha orari di lavoro validi nel suo calendario* — un'attività in ore su un calendario senza orari di lavoro.
- *Data di inizio non valida per l'attività '{task}'* — la data di inizio dell'attività non è valida.

## Le strisce sotto la barra multifunzione

Una striscia si trova direttamente sotto la barra multifunzione, sopra l'area di lavoro. Ha un testo e un pulsante. Una striscia per una modalità non ha una croce; le altre le chiudi con la croce. Le cinque strisce:

- **Modalità collegamento** — *Modalità collegamento: trascina da una barra all'altra nel Gantt per creare una relazione. Esc per uscire.* Resta finché la modalità collegamento è attiva. Pulsante: *Interrompi*. Vedi [Creare relazioni](docs://howto-relaties-leggen).
- **Modalità divisione** — *Fai clic su una barra nel giorno in cui inizia l'interruzione e trascina verso destra per la durata. Esc per uscire.* Resta finché *Dividi attività* è attiva. Pulsante: *Interrompi*.
- **Pianificazione oraria nel file** — *Questo file contiene una pianificazione oraria.* Compare quando un file aperto contiene una pianificazione oraria mentre *Attiva pianificazione oraria* è disattivata. Pulsante: *Attiva pianificazione oraria*. Vedi [Attivare la pianificazione oraria](docs://howto-urenplanning-aanzetten).
- **Struttura bloccata** — *Non disponibile durante filtro/raggruppamento/ordinamento*. Compare quando rientro e riduci rientro vengono rifiutati perché la tabella attività è filtrata, raggruppata o ordinata. Pulsante: *Cancella*, che rimuove il filtro, il raggruppamento e l'ordinamento.
- **Date come registrate** — dopo l'apertura di un file in cui il ricalcolo ha spostato delle date: *Il ricalcolo ha spostato N di M attività rispetto alle date nel file.* con il pulsante *Mostra date registrate*. Mentre la vista è attiva: *Stai visualizzando le date come registrate nel file …* con il pulsante *Ricalcola*. Vedi [Date come registrate](docs://uitleg-datums-zoals-opgeslagen).

## Notifiche

Le notifiche compaiono in fondo allo schermo, anche nella tabella, in Backstage e nella modalità presentazione. Una notifica è un *errore* o un'*info*. Un errore è rosso e resta finché non fai clic sulla croce. Un'info scompare dopo 5 secondi (una notifica con molte spiegazioni resta più a lungo), e questi timer ricominciano non appena cambia la pila. Ogni notifica ha una croce in alto a destra (suggerimento *Chiudi notifica*) che la chiude subito. Un clic sul testo della notifica non fa nulla. Un rifiuto è sempre un errore: una notifica che dice che l'app non ha eseguito qualcosa che hai fatto, come una relazione, una durata, un inizio o un cardine rifiutati. Così non te la perdi se distogli lo sguardo per un momento. Un rifiuto scompare dopo Ctrl+Z o Ctrl+Y e quando passi a un altro documento, perché allora non è più corretto. Un altro errore, come *Salvataggio non riuscito*, resta. Questo vale anche se il resto della stessa azione è riuscito, per esempio quando incolli in più celle. Se sono coinvolte più attività, una riga sotto dice quali attività non sono state modificate, per esempio *Non modificato: Foundation, Masonry.* Con più di cinque, la notifica finisce con *e altre N attività*. Lo stesso rifiuto si raccoglie in una riga con un contatore quando si ripete. Ne sono mostrati al massimo tre alla volta. Se ne arriva una quarta, va via per prima l'info più vecchia. Se non ci sono info, va via il rifiuto più vecchio, poi la notifica di apertura fissa più vecchia, e solo dopo l'errore più vecchio. Quindi un'info o un rifiuto non spinge mai via un altro errore, come *Salvataggio non riuscito*. La pila si sposta lontano dai pulsanti di una finestra di dialogo aperta e dalle barre di azione fisse. Una notifica all'apertura di un file resta anche finché non fai clic sulla croce, se l'app durante l'apertura ha compilato, sostituito, riparato o lasciato fuori dati: una riga su riscontri del parser o del calendario, problemi di formato dei numeri, ripieghi per le enumerazioni, impostazioni di pianificazione P6 con fallback sicuro, un ripiego protettivo della baseline, riferimenti di baseline ignorati, attività senza inizio pianificato a cui è stato dato un inizio, relazioni tra progetti o attività senza progetto che non sono state importate (P6 XML), qualcosa di un file MS Project che non è stato importato (MS Project XML e `.mpp`) o un archivio sorgente XER inutilizzabile, e le notifiche su id duplicati e relazioni che non vengono calcolate. Se contiene solo informazioni senza una modifica di questo tipo (come il numero di progetti, documenti o la codifica del testo), la notifica scompare dopo 5 secondi.

- **Contatore ×N** — una notifica con una chiave fissa unisce una ripetizione in una riga con un contatore, per esempio un errore di salvataggio che torna o una relazione rifiutata che ripeti. Non ogni notifica lo fa.
- **Ulteriori informazioni** — alcune notifiche hanno un collegamento *Ulteriori informazioni* o un argomento proprio (per esempio *Tipi di attività spiegati*) che porta alla guida in Backstage › Aiuto.
- **Pulsante di azione** — la notifica sul profilo di calcolo ha un pulsante *Apri profilo di calcolo* che porta a Info progetto.

L'elenco qui sotto è una selezione, raggruppata per argomento. Dove non dice altro, si tratta di un'info.

### Salvataggio, apertura e recupero

- **Salvataggio non riuscito** (errore) — *Salvataggio non riuscito* con il motivo sotto. Al salvataggio, al salvataggio con nome e all'esportazione di un report.
- **Salvato come download** (info) — *Salvato come download: «{name}» si trova ora nella cartella dei download. …* Con *Salva come* e con le esportazioni, quando l'ambiente non permette all'app di scrivere direttamente nella posizione scelta. Due download uno dopo l'altro si uniscono.
- **Salvato come download (spiegazione)** (info, 15 secondi) — *Salvato come download: «{name}» si trova nella cartella dei download. Questo browser non permette all'app di scrivere in una posizione propria, …* Con *Salva* in un browser che salva solo tramite un download. Una volta per sessione, con un collegamento alla spiegazione dei file.
- **Il browser non scrive di nuovo** (info, 15 secondi) — *Questo browser non permette all'app di scrivere di nuovo in «{name}». …* Con *Salva* di un progetto che ha un file, quando il browser deve chiedere di nuovo una posizione. Una volta per sessione, con un collegamento alla spiegazione dei file.
- **Salvataggio automatico non riuscito** (errore) — *Salvataggio automatico non riuscito* con il motivo. Vale per il salvataggio automatico nel file e per il recupero dopo un arresto anomalo.
- **Impossibile salvare la libreria** (errore) — *Impossibile salvare la libreria*, quando salvi la libreria di risorse.
- **Apertura del file non riuscita** (errore) — *Apertura del file non riuscita* con il motivo. Per esempio un file recente o un file importato.
- **File .mpp vecchio o protetto** (errore) — *Questo file .mpp usa un formato più vecchio (Project 2007 o precedente)…* oppure *Questo file .mpp è protetto da password…*, entrambi con il consiglio di esportarlo come XML in MS Project e di aprire quel file.
- **File XER non valido** (errore) — uno dei testi *XER…*, per esempio *Questo file XER non è valido o supportato.* oppure *Il file XER contiene una tabella duplicata.*, con il motivo aggiunto.
- **IFC non leggibile** (errore) — *Impossibile leggere l'IFC* con il motivo, nella vista IFC.
- **Ripristino** (errore) — *Impossibile leggere il file ripristinato*, *Ripristino non riuscito* e *N file di ripristino non sono stati caricati e sono stati ignorati.* Quando ripristini dopo uno spegnimento imprevisto.
- **Ramo salvato come modello** (info) — *Ramo salvato come modello «{name}»*.
- **Messaggio di un'estensione** (info, oppure errore se l'estensione segnala un errore) — *Estensione {name}: {message}*. Un'estensione può mostrare al massimo tre nuovi messaggi ogni 10 secondi, così non riempie la pila. Se un passaggio della guida di un'estensione non riesce, dice *Un passaggio dell’estensione {name} non è riuscito. La guida continua.* e, se un file di progetto di un'estensione non si può aprire, *Impossibile aprire il file di progetto {file} dell’estensione {name}.* Entrambi sono errori.
- **Una modifica nel frattempo** (errore) — *Una modifica dell'assistente IA o di un'estensione è arrivata nel frattempo. …* Quando annulli la finestra di dialogo delle attività mentre l'IA o un'estensione ha cambiato qualcosa nel frattempo: le modifiche alle attività fatte prima di quella modifica non vengono annullate e restano come normali passaggi sotto *Annulla*.

### Calcolo

- **Impossibile calcolare la programmazione** (errore) — *Impossibile calcolare la programmazione* con il motivo sotto (vedi *Motivi di un errore di pianificazione*). Su *Calcola*, quando passi a un altro documento e quando apri un file.
- **Data di stato impostata a oggi** (info) — *Data di stato impostata a oggi ({date}).* Quando inserisci l'avanzamento in un progetto senza data di stato. L'app misura l'avanzamento fino alla data di stato, quindi senza data di stato non può elaborare l'avanzamento. Imposti una data diversa in *Pianificazione › Baseline e progresso › Data di stato*. Con un collegamento *Ulteriori informazioni* a [Avanzamento, data di stato e baseline](docs://uitleg-voortgang).
- **Durata più breve del lavoro svolto** (errore) — *«{name}» è già completata al {N}%: una durata inferiore al lavoro già svolto non è possibile. La durata non è stata modificata.*

### Relazioni e gerarchia

- **Relazione rifiutata** (errore) — *Questa relazione esiste già*, *Una relazione tra un'attività e la propria attività di riepilogo antenata non è consentita.* oppure *Questa relazione creerebbe un ciclo nella pianificazione ({cycle}) e non è stata creata.* Il ciclo indica le attività, così sai quale relazione rimuovere o invertire per prima.
- **Spostamento rifiutato** (errore) — *Questo spostamento creerebbe un ciclo nella pianificazione ({cycle}): le relazioni di un'attività di riepilogo valgono anche per le sue sottoattività. Non è stato spostato nulla.*
- **Relazioni escluse dopo uno spostamento** (info) — *Dopo lo spostamento, N relazioni collegano un'attività alla propria attività di riepilogo antenata; non vengono più considerate nel calcolo.*
- **Relazioni saltate all'inserimento** (errore) — *N relazioni non sono state create: collegamento non valido…*, quando incolli o inserisci un ramo. Una riga sotto dice quali relazioni, per esempio *Non creato: Foundation → Masonry.*
- **Relazioni non conteggiate dopo l'importazione** (info) — *N relazione/i non hanno potuto essere incluse. Controlla le colonne Predecessori e Successori.*
- **Id duplicati dopo l'importazione** (info) — *Oggetti con un id duplicato in questo file: N. Hanno ricevuto un id proprio…*

### Modifica delle attività

- **Inizio registrato come vincolo** (info) — *«{name}» non inizia prima del {date} (SNET).* Quando cambi l'inizio di un'attività con un predecessore. Il predecessore stabilisce l'inizio, quindi l'app registra la tua data come vincolo *iniziare non prima del (SNET)*. Dopo il ricalcolo (F5) l'attività non inizia prima di quella data. Se l'attività aveva già un vincolo di questo tipo, l'app mostra *«{name}» ora non inizia prima del {date} (SNET).*; per più attività insieme indica un conteggio. Con un collegamento *Ulteriori informazioni* a [Vincoli e scadenze](docs://uitleg-constraints).
- **Inizio non applicato** (errore) — *Il nuovo inizio di «{name}» non è stato applicato: l'attività ha un predecessore e il vincolo {type} {date}, e quelli stabiliscono il suo inizio. Cambia quel vincolo per spostare l'inizio.*
- **Cardine rifiutato** (errore) — *«{task}» ha assegnazioni di risorse e non può diventare un cardine. Rimuovi prima le assegnazioni.* oppure *«{task}» è un'attività di riepilogo con sottoattività e non può diventare un cardine.* Quando converti nella finestra dell'attività, nel pannello delle proprietà, nel menu contestuale e nella tabella.
- **Assegnazioni spostate in una sottoattività** (info) — *Assegnazione spostata nella sottoattività «{child}».* oppure *N assegnazioni spostate nella sottoattività «{child}».* Quando un'estensione dà sottoattività a un'attività con assegnazioni. Quell'attività diventa un'attività di riepilogo, e un'attività di riepilogo non ha assegnazioni proprie. Per questo passano alla prima nuova sottoattività. Nell'app stessa scegli questo nella finestra *L'attività diventa un'attività di riepilogo*; questo messaggio non segue. Con un collegamento *Ulteriori informazioni* a [Modificare la struttura](docs://howto-structuur-aanpassen).
- **Contrassegno di cardine rimosso** (info) — *«{phase}» non è più un cardine.* Quando un cardine riceve sottoattività. Un cardine è un momento senza sottoattività; con sottoattività diventa un'attività di riepilogo. Con un collegamento *Ulteriori informazioni* a [Modificare la struttura](docs://howto-structuur-aanpassen).
- **Domanda non più aggiornata** (errore) — *Le attività o le assegnazioni sono cambiate mentre la domanda era aperta. Non è stato modificato nulla; riprova.* Quando scegli nella finestra *L'attività diventa un'attività di riepilogo*, ma la domanda non corrisponde più.
- **Attività di riepilogo rifiutata** (errore) — *«{phase}» non può diventare un'attività di riepilogo: …* con il motivo, e *Non è stato modificato nulla.* Quando un'estensione dà sottoattività a un'attività con assegnazioni e le assegnazioni non possono andare alla prima nuova sottoattività. Nell'app stessa questo messaggio non compare: lì la finestra *L'attività diventa un'attività di riepilogo* chiede cosa fare, e *Sposta* è allora disattivato.
- **Celle ignorate all'incolla** (errore) — *N celle ignorate: sono di sola lettura (ad esempio un codice WBS numerato automaticamente o una colonna calcolata).*
- **Riferimenti cancellati all'incolla** (info) — *N riferimenti non esistevano in questo documento e sono stati cancellati (calendari delle attività, categorie di lavoro personalizzate, codici attività o campi personalizzati del documento di origine).*
- **La struttura è bloccata** (errore, striscia rossa sotto la barra multifunzione) — *Non disponibile durante filtro/raggruppamento/ordinamento*, con il pulsante *Cancella*. Mentre l'elenco è filtrato, raggruppato o ordinato: quando aumenti il rientro, riduci il rientro e trascini le attività, e con *Inserisci sopra* e *Inserisci sotto* (menu del tasto destro o scorciatoia). La striscia resta finché non fai clic sulla croce, non usi Ctrl+Z o Ctrl+Y, o non passi a un altro documento. Vedi [Modificare la struttura](docs://howto-structuur-aanpassen).
- **Attività aggiunta in fondo** (errore) — *La nuova attività si trova in fondo. Durante il filtraggio, il raggruppamento o l'ordinamento, l'app non può metterla sotto la tua selezione.* Con il pulsante *Cancella*. Con *Attività* e *Cardine ▾* mentre un'attività è selezionata e l'elenco è filtrato, raggruppato o ordinato. L'attività viene aggiunta, ma in fondo. *Cancella* rimuove filtro, raggruppamento e ordinamento e chiude la notifica. Vedi [Aggiungere attività e cardini](docs://howto-taken-en-mijlpalen-toevoegen).
- **Durate adeguate dal tipo di attività** (info) — *Dopo la modifica del calendario il tipo di attività ha adeguato la durata di N attività (il lavoro resta, le ore al giorno sono cambiate).* Con un collegamento *Tipi di attività spiegati*.

### Primavera P6 XML

- **File P6 XML aperto** (info) — *File P6 XML aperto: N documenti di progetto.* Dopo l'apertura di un file P6 XML.
- **Non importato** (resta visibile) — *N relazioni tra progetti non sono state importate come relazioni.* e *N attività senza progetto non sono state lette.* Controlla se la tua pianificazione è completa.
- **Vuoto o inutilizzabile** (errore) — non si apre nulla. Tre motivi: *Questo file non contiene attività che l'app può leggere.*, *Le attività non hanno un ObjectId. …* e *Il file usa nomi di colonne XER … Apri il file .xer stesso.*

### Primavera (XER)

- **File XER aperto** (info) — *File XER aperto: N documenti di progetto.* Una notifica per file, anche se il file apre più progetti, con un collegamento *Ulteriori informazioni* e righe di dettaglio sotto. Sempre *N progetti trovati.* Solo quando il numero è sopra 0: *N progetti vuoti ignorati.*, *N progetti di baseline esclusi.*, *N baseline materializzate.*, *N riferimenti di baseline sospesi ignorati.*, *È stato usato un ripiego protettivo per la baseline.* e *N relazioni esterne conservate.* Solo per una codifica diversa da UTF-8: *Codifica del testo scelta: {encoding}.* Inoltre, quando il numero è sopra 0: *N riscontri del parser.*, *N riscontri del calendario.*, *N problemi di formato numerico.*, *N ripieghi enum* e *N impostazioni di pianificazione P6 con fallback sicuro.*
- **Date come registrate da Primavera** (riga di dettaglio nella stessa notifica) — *N attività mostrano le date come registrate da Primavera (non ricalcolate).* N conta ogni attività per cui il file aveva registrato date, anche quelle che non differiscono. Oppure, se la modalità non si è attivata, *N attività differiscono dalle date nel file: puoi mostrarle.*
- **Archivio sorgente XER inutilizzabile** (info) — *L'archivio sorgente XER di questo file è inutilizzabile ed è stato omesso; il progetto stesso è stato aperto per intero.* con il motivo (per esempio *Motivo: il checksum non corrisponde ai byte sorgente: l'archivio è danneggiato.*) e la conseguenza (*La pianificazione, il profilo di calcolo e tutti i dati di progetto dell'IFC sono completi. …*). Quando apri un file IFC in cui un archivio sorgente XER salvato in precedenza non può essere usato. Anche quando ripristini dopo uno spegnimento imprevisto, se l'archivio di ripristino non contiene più l'archivio sorgente.
- **Esportazione con perdita di informazioni XER** (info) — *L’esportazione in {format} perde informazioni di origine XER.* Dopo un'esportazione riuscita in un formato diverso da IFC di un progetto con dati che esistono solo in un file XER. Con un collegamento *Ulteriori informazioni*.

### Importazione, esportazione e profilo di calcolo

- **Date come nel file** (info) — *N attività mostrano le date come registrate nel file (non ricalcolate).* (N conta ogni attività con date registrate) oppure *N attività differiscono dalle date nel file: puoi mostrarle.* Quando apri un file con date registrate.
- **Lavoro e tipi di attività visibili** (info) — *Questo file contiene lavoro salvato o tipi di attività; il tipo di attività e il lavoro rimanente sono visibili per questo progetto.*
- **Pianificazione di MS Project letta** (info) — *Questo file di MS Project contiene N attività con una pianificazione suddivisa, livellata o guidata dalle risorse. Vengono importate e mostrate così come sono.*
- **Interruzioni non esportate** (info) — *N attività con interruzioni sono state esportate senza le loro interruzioni: MS Project/P6 le conoscono solo come distribuzione del lavoro.* Quando esporti in MS Project o Primavera.
- **Inizio del progetto spostato** (info) — *N attività si sono spostate con l’inizio del progetto.* Quando sposti l'inizio del progetto più tardi. Si spostano a quella data solo le attività senza predecessore e senza un vincolo che cadrebbe prima della nuova data di inizio. Con un collegamento *Ulteriori informazioni* a [Nuovo progetto e Info progetto](docs://ref-projectinfo).
- **La finestra di date non guida più** (info) — *La finestra di date di MS Project non guida più N attività dopo questa modifica; …* Una volta per documento.
- **Arrotondamento del ritardo di livellamento** (info) — *Il livellamento arrotonda il ritardo di livellamento di MS Project, preciso al minuto, per N attività a giornate lavorative intere.* Una volta per documento.
- **Profilo di calcolo applicato** (info) — *Questo progetto calcola come {profile}. Modificalo da File → «Info progetto» → «Profilo di calcolo e opzioni».* Con il pulsante *Apri profilo di calcolo*. Dopo l'applicazione di un profilo segue *Dopo l’applicazione sono state spostate N attività.*, se necessario.
