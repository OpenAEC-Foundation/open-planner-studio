# Come funziona il collegamento IA

Cosa succede davvero quando un assistente IA lavora nella tua pianificazione? In questo articolo leggi che cos'è il collegamento, perché si differenzia dallo scambio di un file, quali limiti l'app si impone da sola e come l'assistente scopre come si deve costruire una pianificazione. L'esempio alla fine mostra con numeri che cosa un assistente può fare in una volta sola e che cosa ne ricavi tu.

## Il concetto

Un assistente IA, come un programma di chat o un assistente di programmazione, può comandare un altro programma tramite il **Model Context Protocol** (MCP). In questo scambio Open Planner Studio fa da server. L'app desktop avvia un piccolo server sul tuo computer, il **bridge**. L'assistente si collega al bridge e riceve una lista di **strumenti**: funzioni con un nome che inizia con `planner_`, per esempio leggere attività, aggiungere una relazione o salvare una baseline. Quali strumenti esistono, lo trovi in [Strumenti IA](docs://ref-ai-tools).

La parte notevole è che l'assistente lavora nel progetto che hai aperto in quel momento, non in una copia. Non esporti nulla, non importi nulla e non c'è nessun momento in cui tu e l'assistente guardate due versioni diverse. Un'attività che l'assistente aggiunge compare subito nel Gantt. L'app non è ingenua su questo punto: l'assistente lavora con lo stesso calcolo, la stessa cronologia di annullamento e le stesse regole che usi tu.

Come attivi il collegamento è descritto in [Collegare un assistente IA (MCP)](docs://howto-ai-assistent-koppelen). Qui sotto leggi come funziona.

## Come l'app lo gestisce

### Un server che sente solo il tuo computer

Il bridge ascolta solo sul tuo computer (`127.0.0.1`), su una porta, di default 3877. Accetta richieste solo all'indirizzo `/mcp`, e solo con il tuo **token** nell'intestazione `Authorization: Bearer`. Rifiuta una richiesta senza il token giusto. Anche una richiesta che arriva da un browser riconosciuto dall'intestazione `Origin` viene rifiutata, così una pagina web che hai aperta per caso non può parlare con la tua pianificazione. Il bridge elabora le richieste rigorosamente una alla volta.

La connessione è HTTP normale sul tuo computer; l'app stessa non invia nulla verso l'esterno. Che cosa fa un assistente con la pianificazione che legge, per esempio che cosa ne fa il suo fornitore, dipende dall'assistente e sta al di fuori dell'app.

### L'assistente lavora su un solo documento

Alla sua prima modifica, il bridge collega la connessione al documento attivo in quel momento. Se poi cambi scheda tu stesso, l'app rifiuta la modifica successiva dell'assistente (codice `DOC_DRIFT`) finché non conferma con `planner_switch_document` su quale documento vuole lavorare. Così niente finisce nel progetto sbagliato. Un assistente che apre o duplica lui stesso un documento, da quel momento lavora in quel nuovo documento.

### Ogni modifica ricalcola

Nell'app pianifichi a mano: cambi qualcosa, poi premi *Calcola* (F5), a meno che *Calcola automaticamente* sia attivo. Questo non vale per una modifica dell'assistente. Ogni azione di scrittura dell'assistente passa per una sola transazione. Se in essa cambiano dati di progetto, l'app ricalcola alla fine da sola, una volta per script. Uno strumento di lettura dà sempre date aggiornate: se la pianificazione non è aggiornata, per esempio perché hai cambiato qualcosa tu e non hai ancora premuto *Calcola*, lo strumento di lettura ricalcola prima. C'è una eccezione: se il progetto è nella vista *Date come registrate* (dopo un'importazione), uno strumento di lettura non ricalcola in silenzio, perché così sostituirebbe quelle date. L'assistente riceve allora le date registrate, con un avviso che non sono state ricalcolate. Una modifica dell'assistente stesso ricalcola sempre, anche in quel caso. Dopo una modifica dell'assistente non devi premere *Calcola*. L'assistente legge poi il risultato, come la fine del progetto e il percorso critico, con gli strumenti di lettura. Vedi anche [Date come registrate](docs://uitleg-datums-zoals-opgeslagen).

### Uno script è un solo passo

Un assistente può inviare una serie di passi come un tutt'uno con `planner_batch`, uno script di al massimo 100 passi. Così hai un solo passo di annullamento, un solo ricalcolo e un solo backup. Se un passo fallisce in modo strutturale, per esempio uno strumento sconosciuto o un riferimento circolare, l'app annulla tutto lo script. Non ti ritrovi mai con una pianificazione a metà. Il rifiuto di un elemento in un passo in blocco, per esempio una riga di avanzamento non valida su venti, è meno grave: quell'elemento resta fuori e il resto viene eseguito. I rifiuti si trovano in cima alla risposta.

### I tuoi limiti

Quattro cose le imposti tu stesso, nella scheda *IA*:

- *Metti in pausa* e *Sola lettura* lasciano l'assistente collegato, ma rifiutano ogni modifica. Leggere resta possibile, anche il ricalcolo di una pianificazione non aggiornata durante la lettura: sono campi calcolati, non dati di progetto, quindi non si aggiunge nessun passo di annullamento e il progetto non risulta modificato. Se sei in mezzo a una modifica tu stesso, per esempio trascini una barra o scrivi in un campo, uno strumento di lettura non ricalcola: l'assistente riceve allora le date di prima della tua modifica, con un avviso che non sono aggiornate.
- Una finestra di dialogo aperta blocca tutto. Con una finestra di dialogo per attività, le impostazioni, la modalità presentazione o la finestra di benvenuto aperta, per esempio, l'app rifiuta anche la lettura, perché sei in mezzo a un'azione manuale. L'assistente riceve il codice di errore `DIALOG_OPEN`. Il messaggio indica il nome interno di ciò che è aperto, per esempio `showTaskDialog` per la finestra di dialogo per attività.
- Il *Backup automatico* scrive una copia IFC prima della prima modifica per documento. Se quel backup non riesce, l'app non esegue la modifica.
- Il *Pannello attività* mostra ogni chiamata, con argomenti e risposta.

Oltre a questo c'è il tuo normale *Annulla* (Ctrl+Z). L'assistente condivide quella cronologia con te e dispone inoltre di `planner_undo` e `planner_redo`.

### Che cosa l'assistente non può fare

Il bridge è volutamente più limitato dell'app. Ciò che l'assistente non può fare ha di solito una di tre ragioni.

**Va oltre il progetto.** Un assistente non può modificare la libreria di risorse. Una libreria è condivisa da tutti i tuoi progetti e sta al di fuori della cronologia di annullamento; una sola modifica di tariffa avrebbe effetto su progetti che non sono nemmeno aperti. Per una risorsa da una libreria, nome, tipo, descrizione, tariffa oraria e unità sono fissi, come nel pannello risorse. Ciò che decide il progetto resta all'assistente: unità max., disponibilità nel tempo, calendario e squadra. Non può nemmeno scegliere quale calendario è il calendario di progetto. Può leggere il profilo di calcolo e le opzioni di calcolo, ma non modificarli; può solo impostare la modalità di progresso e il valore predefinito di progetto per il tipo di attività. Non ci sono strumenti per impostazioni, tema, lingua, estensioni o aggiornamenti.

**Non si presta a una validazione affidabile.** Un assistente non può impostare un hammock, pianificare un'attività a mano, impostare un secondo vincolo, compilare note, colori, codici attività, campi personalizzati o relazioni esterne, e non può impostare a mano un ritardo di livellamento. Non sceglie nemmeno un codice WBS; quello lo deriva l'app da sola.

**Tocca qualcosa che devi decidere tu.** Registra l'avanzamento solo se c'è una data di stato. Non la sceglie da solo: è la tua data di riferimento. Se un'attività non iniziata ha un inizio pianificato dopo la data di stato, deve fornire l'inizio effettivo. Legge e scrive file solo nella tua cartella utente, e sovrascrive un file esistente solo se lo chiede esplicitamente. Un'esportazione non è un *Salva*: il progetto resta non salvato nell'app.

### Come l'assistente sa come pianificare

Un assistente che conosce gli strumenti può comunque costruire una pianificazione che nessun pianificatore può usare: attività senza relazioni, una data fissa su ogni attività, oppure una suddivisione troppo fine. Quindi l'app gli fornisce tre cose.

**Le regole base nell'handshake.** Quando si collega, il bridge invia un breve testo nel campo `instructions` dell'handshake MCP. Molti client mettono quel testo nel loro prompt di sistema; se il tuo lo fa dipende dal client. Le regole: parti dai cardini e dalla data di consegna, crea attività di circa un giorno fino a due settimane, guida la pianificazione con relazioni invece che con date fisse, usa i vincoli solo per date esterne vincolanti, correggi per prima cosa un calcolo fallito, usa `planner_batch` per una serie coerente, registra l'avanzamento solo con la tua data di stato e le date effettive che fornisci, e alla fine dichiara che cosa hai supposto e che cosa hai deliberatamente non fatto.

**La guida per assistenti.** Lo strumento `planner_get_planning_guide` restituisce una guida scritta apposta per gli assistenti. Segue gli stessi principi di [Pianificare bene](docs://gids-goed-plannen), ma un assistente lavora in modo diverso da te: non preme F5 e non clicca sulla barra multifunzione, chiama strumenti e l'app ricalcola per lui. Quindi la guida indica, per ogni principio, gli strumenti che l'assistente usa per esso, e spiega che cosa fa l'assistente con *Date come registrate* o con un calcolo fallito. La guida è in inglese, come tutto ciò che l'assistente legge tramite il collegamento; lo strumento accetta ancora una scelta di lingua per assistenti più vecchi, ma questo non cambia il testo. Puoi leggerla tu stesso all'indirizzo `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Il prompt di collegamento nella finestra *Dettagli di connessione* chiede all'assistente di leggere prima la guida. Lo strumento funziona anche mentre una finestra di dialogo è aperta, in pausa e in modalità sola lettura, perché non legge la tua pianificazione.

**Due skill.** Una skill è un piccolo file di istruzioni che un assistente legge in ogni sessione. Ce ne sono due, perché sono due tipi di lavoro. Impostare una pianificazione riguarda la logica; aggiornare l'avanzamento riguarda fatti che solo tu conosci. La skill *goed-plannen* serve per impostare o ristrutturare una pianificazione: l'ordine in cui si usano gli strumenti, la regola di ricalcolo, `planner_batch` e il dovere di riportare le supposizioni. La skill *progress-update* serve per l'aggiornamento settimanale dell'avanzamento: prima la tua data di stato, poi le date effettive di inizio e fine e la percentuale di avanzamento, e dopo un report dello scostamento rispetto alla baseline, del percorso critico e della nuova data di fine. I principi di pianificazione stessi sono nella guida. Entrambe le skill sono in inglese. Lo strumento restituisce entrambe e indica dove vanno. Come le installi, è descritto in [Collegare un assistente IA (MCP)](docs://howto-ai-assistent-koppelen).

## Un esempio

Chiedi a un assistente: costruisci un ampliamento con fondazione, muratura e tetto, in quest'ordine. Il tuo progetto inizia lunedì 2 marzo 2026. L'assistente legge prima la guida e poi invia un solo script:

1. l'inizio del progetto il 2 marzo 2026;
2. tre attività: Foundation di 5 giorni lavorativi, Brickwork di 10 e Roof di 4;
3. due relazioni fine-inizio: Foundation verso Brickwork, Brickwork verso Roof.

L'app esegue i tre passi e ricalcola. Se l'assistente legge poi, trova: fine del progetto giovedì 26 marzo 2026, durata del progetto di 19 giorni lavorativi, tutte e tre le attività critiche. Questo corrisponde alla somma: 5 + 10 + 4 fa 19 giorni lavorativi, e 19 giorni lavorativi dopo lunedì 2 marzo finiscono giovedì 26 marzo. Lo script intero è un solo passo nella tua cronologia. Un *Annulla* elimina le tre attività, le due relazioni e il nuovo inizio del progetto.

Ora lo scenario what-if. Poi chiedi all'assistente di aggiornare l'avanzamento, e per questo imposta la data di stato a lunedì 16 marzo. Una data di stato non è un'etichetta: il lavoro che non è ancora iniziato non può trovarsi prima di quella data e si sposta fino ad essa. Senza una sola riga di avanzamento, tutta la pianificazione quindi si sposta: Foundation va dal 16 al 20 marzo, Brickwork dal 23 marzo al 7 aprile e Roof dall'8 al 13 aprile. La fine del progetto passa dal 26 marzo al 13 aprile. La pianificazione slitta di due settimane lavorative, e il calendario in questo esempio, *Bouwkalender NL*, ha il Venerdì Santo (3 aprile) e la Pasqua (5 e 6 aprile). Questi due giorni infrasettimanali festivi spingono la fine di altri due giorni. Per questo l'assistente imposta la data di stato solo su tua richiesta, e solo quando c'è avanzamento reale da registrare.

## Conseguenze per la tua pianificazione e idee sbagliate comuni

**L'assistente non ha una copia propria.** Quello che cambia, cambia il tuo progetto. Con il *Backup automatico* attivo, hai un backup IFC prima della sua prima modifica. Con *Sola lettura* può analizzare senza cambiare nulla.

**Un nuovo token interrompe tutti i collegamenti.** Il token è la password del bridge. Un nuovo token rende invalido il vecchio, anche su un bridge in funzione, e all'assistente va dato il nuovo.

**Che l'assistente dica di aver funzionato non è una prova.** Il *Pannello attività* mostra quale strumento ha chiamato davvero e che cosa è tornato indietro. Un rifiuto indica quasi sempre il campo che era sbagliato e la strada che invece funziona.

**L'assistente non può fare un what-if con annullamento.** Condivide l'annullamento con te, quindi per le varianti duplica il documento con `planner_duplicate_document`. La copia è staccata, non ha un percorso di file e risulta come non salvata. L'assistente non chiude le varianti; lo decidi tu.

**Un'esportazione dell'assistente non è un salvataggio.** Scrive un file IFC in un percorso che sceglie lui stesso, dentro la tua cartella utente, e sovrascrive un file esistente solo se lo chiede esplicitamente. Il tuo progetto resta non salvato nell'app e mantiene la propria destinazione di salvataggio. Se importa un file, questo si apre in una nuova scheda o in una scheda vuota e invariata.

## Vedi anche

- [Collegare un assistente IA (MCP)](docs://howto-ai-assistent-koppelen): i passi per avviare il bridge, collegare un assistente e installare la skill.
- [Strumenti IA](docs://ref-ai-tools): tutti gli strumenti per gruppo, che cosa rifiutano e per quanto tempo si conservano i backup.
- [Pianificare bene](docs://gids-goed-plannen): i principi di pianificazione; l'assistente li riceve in una versione inglese con gli strumenti aggiunti.
- [Avanzamento, data di stato e baseline](docs://uitleg-voortgang): che cosa fa la data di stato alla tua pianificazione.
