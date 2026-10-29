# Profili di calcolo e convenzioni

La stessa pianificazione può dare date diverse, a seconda delle regole di calcolo che applichi. Questo articolo spiega perché Primavera P6 e Microsoft Project calcolano in modo diverso su alcuni punti, come l'app registra questa differenza in un **profilo di calcolo**, e in che cosa un profilo si distingue dalle opzioni di calcolo che imposti tu stesso per ogni progetto. Un esempio svolto con una piccola rete mostra che cosa questo fa alle date.

## Il concetto

Attività, relazioni e calendario decidono la maggior parte di una pianificazione, ma non tutto. Che cosa succede al lavoro non ancora iniziato, quando imposti una data di stato? Da dove inizia il lavoro rimanente di un'attività già in corso? Qual è il margine libero di un'attività quando una scadenza viene superata? La rete non dice nulla in proposito. Un pacchetto di pianificazione deve scegliere una regola. L'app conosce vari punti in cui la regola di Primavera P6 e quella di Microsoft Project differiscono.

L'app chiama una scelta di questo tipo una **convenzione**. Un **profilo di calcolo** è l'insieme di convenzioni che appartiene a un pacchetto. L'app ne ha tre:

- *Open Planner Studio*: il profilo con cui calcola un nuovo progetto. Nessuna convenzione è attiva.
- *Primavera P6*: le convenzioni che l'app conosce da P6.
- *Microsoft Project*: le convenzioni che l'app conosce da Microsoft Project.

Quindi il profilo dice come calcola un pacchetto. Che cosa vuoi per il tuo progetto non fa parte del profilo. Queste sono invece le **opzioni di calcolo**: scelte come quanto poco margine rende un'attività critica, oppure in quale calendario conta un ritardo. Le imposti per ogni progetto.

## Come calcola l'app

### Convenzioni e opzioni di calcolo

Una convenzione è un interruttore: attivo o disattivo. Il profilo decide quali interruttori sono attivi. Un'opzione di calcolo è una scelta che fai tu. Puoi vedere la differenza nell'app stessa, nel blocco *Profilo di calcolo e opzioni*:

- **Convenzioni** si trovano sotto *Convenzioni di questo profilo*, raggruppate per argomento, per esempio *Avanzamento e lavoro completato*, *Relazioni e ritardo* e *Margine e date più tarde*. All'inizio questa parte è chiusa. La sua intestazione mostra quante convenzioni ci sono e, se il profilo è diverso, un'etichetta *modificate: 1*. Fai clic sull'intestazione per aprirla. Con un profilo integrato ogni riga ha un'etichetta *ATTIVO* o *DISATTIVO*. Questi valori sono solo informativi e non si possono cambiare. Con un profilo personalizzato ogni riga ha una casella di controllo, con accanto il valore di base (*base: attivo* o *base: disattivo*). Se la tua scelta è diversa, la riga si distingue e compare *torna alla base*. L'icona i dopo una riga apre la spiegazione di quella convenzione. Passaci sopra con il mouse, raggiungila con Tab oppure toccala. Leggi prima quella spiegazione se vuoi cambiare una convenzione. Se una convenzione funziona solo con la pianificazione oraria, oppure solo su attività da un file .xer, accanto a essa c'è un'etichetta blu che lo dice: *solo pianificazione oraria* o *solo attività da .xer*. Pianificazione oraria significa: un calendario con fasce di lavoro, un'attività la cui durata è in ore, oppure il *Calendario del ritardo* impostato su *24 ore*. Un progetto con solo un calendario giornaliero e attività in giorni non è influenzato da una convenzione con l'etichetta *solo pianificazione oraria*, a meno che il calendario del ritardo sia impostato su *24 ore*. Allora un ritardo conta in ore, e una convenzione sul ritardo può cambiare qualcosa.
- **Opzioni di calcolo** si trovano sotto *Opzioni di calcolo di questo progetto*: tra le altre *Definizione di critico*, *Calcolo del margine*, *Attività a estremità aperta critiche*, *Contrassegna quasi critico* e *Calendario del ritardo*. Dicono che cosa vuoi per questo progetto, non come calcola un profilo. Che cosa fanno è spiegato in [Percorso critico e margine](docs://uitleg-kritiek-pad) e [Relazioni e ritardo](docs://uitleg-relaties).

Un esempio per ciascuno. «Un'attività è critica se il suo margine totale è 0 o meno» è un'opzione di calcolo: puoi impostare la soglia a 4, e allora tutto ciò che ha 4 giorni lavorativi di margine o meno è critico. «Il lavoro non ancora iniziato si sposta alla data di stato» è una convenzione: Open Planner Studio e Primavera P6 lo fanno, Microsoft Project no.

Il profilo e le opzioni di calcolo appartengono al file di progetto, non all'app. Se salvi il progetto, viaggiano con esso. Due progetti nella stessa app possono quindi calcolare con un profilo diverso. Un progetto senza profilo calcola come Open Planner Studio.

Se il progetto viene da un file .xer, in fondo al blocco compare anche *Impostazioni dal file di origine*: opzioni di calcolo che conosce solo Primavera e che il file ha portato con sé. Qui non puoi cambiarle. Anche il pulsante per le impostazioni predefinite e il cambio di profilo le lasciano come sono. Un nuovo progetto non le ha, nemmeno con *Primavera P6*.

### Dove scegli il profilo

Per un nuovo progetto il profilo si trova nella finestra *Nuovo progetto*, che apri tramite *Home › File › Nuovo*. Lì *Profilo di calcolo* è un elenco a discesa. Se scegli lì un profilo, l'app sostituisce le opzioni di calcolo che avevi già compilato con i valori predefiniti di quel profilo; restano solo le impostazioni da un file di origine. Con *Primavera P6*, *Calcolo del margine* diventa *Margine di fine*. Con *Microsoft Project* e *Open Planner Studio* ogni opzione di calcolo ha il valore predefinito, quindi *Calcolo del margine* è *Automatico (predefinito)*. Con una data di stato, anche MS Project calcola così: un'attività iniziata riceve il margine di fine, e ogni altra attività riceve il più piccolo tra margine di inizio e margine di fine.

Per un progetto esistente scegli il profilo sotto *Impostazioni › Progetto › Impostazioni progetto*, nel blocco *Profilo di calcolo e opzioni*, nell'elenco a discesa *Profilo di calcolo*. Puoi arrivare allo stesso punto anche tramite *File › Info progetto*. Qui cambiare profilo modifica solo le convenzioni. Le tue opzioni di calcolo restano come sono. Se le tue opzioni di calcolo sono diverse dal valore predefinito del profilo, un blocco arancione sopra le opzioni lo dice. Spesso è voluto, per esempio perché le opzioni vengono dal file aperto. Se vuoi comunque il predefinito, scegli *Usa le impostazioni predefinite di …* in quel blocco. La croce nasconde il blocco per questo file aperto.

Finché non premi *Applica*, una modifica esiste solo nel modulo. Con *Applica* l'app ricalcola subito la pianificazione, anche se *Calcola automaticamente* è disattivato. Se delle attività si sono spostate, lo dice con un numero, per esempio *Dopo l’applicazione sono state spostate 4 attività.* L'intera modifica è un solo passo per *Annulla*. Se premi *Annulla* o *Ripeti* mentre *Impostazioni progetto* è aperto, il blocco segue lo stato del progetto. Se avevi già cambiato qualcosa nel blocco, la tua scelta resta e un blocco giallo dice che *Applica* rimette quella scelta.

I tre profili integrati non si possono cambiare. Per altre convenzioni crei un profilo personalizzato; puoi anche conservarlo come modello per altri progetti in questa app. Il progetto ha sempre una copia propria: se cambi il modello più tardi, il progetto non cambia con esso. I passaggi sono in [Scegliere o costruire un profilo di calcolo](docs://howto-rekenprofiel-kiezen).

### Quando l'app sceglie da sola un profilo

Quando apri un file, l'app propone un profilo in base al formato:

- Un file .mpp (Microsoft Project) si apre con il profilo *Microsoft Project*.
- Un file .xer (Primavera P6) si apre con il profilo *Primavera P6*.
- Un file nel formato *MS Project XML*, *Primavera P6 XML* o *CSV (separato da punto e virgola)* si apre con *Open Planner Studio*, senza messaggio sul profilo.
- Il tuo progetto (.ifc) si apre con il profilo memorizzato al suo interno.

Per un file .mpp o .xer l'app segnala il profilo: *Questo progetto calcola come Microsoft Project. Modificalo da File → «Info progetto» → «Profilo di calcolo e opzioni».* Il pulsante *Apri profilo di calcolo* nel messaggio ti porta direttamente a Impostazioni progetto. Per un file .xer questa riga è la prima riga di dettaglio del messaggio di apertura del file. Più informazioni sul messaggio si trovano in [Aprire un file Primavera P6 (.xer)](docs://howto-xer-openen) e [Aprire un file MS Project (.mpp)](docs://howto-mpp-openen).

Per un file .mpp l'app imposta solo il profilo. Le opzioni di calcolo restano vuote, come in un nuovo progetto con il profilo *Microsoft Project*: *Calcolo del margine* è *Automatico (predefinito)*. Un file .mpp aperto e un nuovo progetto con *Microsoft Project* calcolano quindi il margine nello stesso modo.

## Esempio svolto: una rete, tre profili

L'esempio è una piccola rete. Il calendario ha una settimana lavorativa dal lunedì al venerdì e nessun giorno libero in queste settimane. La modalità di progresso è Retained Logic (quella predefinita). L'inizio del progetto è lunedì 7 giugno 2027. Tutte le attività sono in giorni lavorativi.

- *Pour foundation*: 5 giorni lavorativi, pianificata da lunedì 7 giugno.
- *Lay walls*: 5 giorni lavorativi, dopo *Pour foundation* (fine-inizio).
- *Order window frames*: 3 giorni lavorativi, senza predecessore, pianificata da lunedì 7 giugno.
- *Fit roof*: 2 giorni lavorativi, dopo *Lay walls* e dopo *Order window frames*. La fine di questa attività è la consegna.

I numeri sono stati calcolati con il motore di calcolo dell'app. Li leggi nel pannello *Proprietà*, sotto *Risultato CPM*.

**Senza data di stato e senza avanzamento, i tre profili calcolano questa rete allo stesso modo.** *Pour foundation* va da lunedì 7 a venerdì 11 giugno, *Lay walls* da lunedì 14 a venerdì 18 giugno e *Fit roof* lunedì 21 e martedì 22 giugno. La consegna è martedì 22 giugno. *Order window frames* (da lunedì 7 a mercoledì 9 giugno) ha 7 giorni lavorativi di margine totale.

Ora registri lo stato. La data di stato è mercoledì 9 giugno. La fondazione è iniziata lunedì 7 giugno ed è al 60 %. Il lavoro rimanente è quindi 2 giorni lavorativi (5 × 40 %). Per *Order window frames* il lavoro non è ancora iniziato. Come funzionano [l'avanzamento e la data di stato](docs://uitleg-voortgang) è spiegato in quell'articolo. Qui la domanda è che cosa fa il profilo con questo.

### Open Planner Studio

Il lavoro rimanente della fondazione inizia alla data di stato: mercoledì 9 e giovedì 10 giugno. L'inizio anticipato resta la data effettiva di inizio, lunedì 7 giugno. La fine anticipata è giovedì 10 giugno. *Lay walls* va da venerdì 11 a giovedì 17 giugno e *Fit roof* venerdì 18 e lunedì 21 giugno.

*Order window frames* era pianificata per lunedì 7 giugno, ma il lavoro non è ancora iniziato. Il lavoro non ancora iniziato non può stare nel passato. Quindi l'app lo sposta alla data di stato: da mercoledì 9 a venerdì 11 giugno, con 4 giorni lavorativi di margine totale. La consegna è lunedì 21 giugno.

### Primavera P6

Tutto è uguale a Open Planner Studio, tranne un punto: l'inizio anticipato di *Pour foundation* è mercoledì 9 giugno. È l'inizio del lavoro rimanente, non la data effettiva di inizio. Lo fa la convenzione *Attività in corso: inizio anticipato = inizio del lavoro rimanente*, nel gruppo *Avanzamento e lavoro completato*. La fine e il margine non cambiano per questo. La consegna è lunedì 21 giugno.

### Microsoft Project

Qui le date sono diverse. Due convenzioni nel gruppo *Avanzamento come in Microsoft Project* lo causano.

*Non spostare le attività non iniziate alla data di stato*: *Order window frames* resta da lunedì 7 a mercoledì 9 giugno, anche se questo periodo cade in parte prima della data di stato. Il margine totale è di 7 giorni lavorativi.

*Il lavoro rimanente riprende dopo la durata trascorsa*: il lavoro rimanente inizia non prima della data di stato, e non prima della data effettiva di inizio più il tempo già trascorso. Al 60 % di 5 giorni lavorativi, 3 giorni lavorativi sono già fatti. Lunedì 7 giugno più 3 giorni lavorativi è giovedì 10 giugno. Questo cade dopo la data di stato, quindi il lavoro rimanente va da giovedì 10 a venerdì 11 giugno. *Lay walls* va da lunedì 14 a venerdì 18 giugno e *Fit roof* lunedì 21 e martedì 22 giugno. La consegna è martedì 22 giugno: un giorno lavorativo più tardi rispetto agli altri due profili.

### E se

**La fondazione è al 20 % invece che al 60 %.** Il lavoro rimanente è allora di 4 giorni lavorativi. Con tutti e tre i profili la fondazione finisce lunedì 14 giugno e la consegna è mercoledì 23 giugno. La convenzione di Microsoft Project per il lavoro rimanente qui non fa differenza: lunedì 7 giugno più 1 giorno lavorativo di tempo trascorso è martedì 8 giugno, e questo è prima della data di stato. Una convenzione così è un limite minimo: può solo far iniziare il lavoro rimanente più tardi. *Order window frames* e l'inizio anticipato con Primavera P6 differiscono ancora, come sopra. Con Microsoft Project, *Order window frames* ha poi 8 giorni lavorativi di margine totale.

**Imposti solo una data di stato e non inserisci avanzamento.** Con Open Planner Studio e Primavera P6 l'intera rete si sposta a mercoledì 9 giugno. La fondazione va allora da mercoledì 9 a martedì 15 giugno e la consegna diventa giovedì 24 giugno: due giorni lavorativi più tardi rispetto a senza data di stato. Con Microsoft Project tutto resta dov'era e la consegna è martedì 22 giugno.

**Crei un profilo tu stesso.** Con Open Planner Studio crei un profilo personalizzato, *Copia di Open Planner Studio*, tramite *Nuovo profilo*, e attivi in esso solo *Non spostare le attività non iniziate alla data di stato*. Con l'avanzamento al 60 % la fondazione mantiene allora le date di Open Planner Studio (fine giovedì 10 giugno, consegna lunedì 21 giugno). *Order window frames* resta davvero da lunedì 7 a mercoledì 9 giugno, con 6 giorni lavorativi di margine totale. Quindi un profilo è un insieme di interruttori separati, e puoi cambiarli uno per uno.

**Un'opzione di calcolo al posto di una convenzione.** Se con Open Planner Studio imposti *Definizione di critico* (*Margine totale ≤ soglia*) con *Soglia (giorni lavorativi)* a 4, *Order window frames* diventa critica, perché il suo margine totale è esattamente 4. Nessuna data cambia. Un'opzione di calcolo è una tua scelta per il progetto ed è indipendente dal profilo.

**Una scadenza non rispettata.** Dai a *Fit roof* una scadenza venerdì 18 giugno. Con Open Planner Studio il margine totale di *Fit roof* è allora −1 giorno lavorativo, e anche il margine libero è −1. Con Primavera P6 il margine totale resta −1, ma il margine libero diventa 0. È quello che fa la convenzione *Margine libero mai negativo*, nel gruppo *Margine e date più tarde*. Con Microsoft Project sono entrambi −2, perché lì la consegna cade un giorno più tardi. Come funziona una scadenza è spiegato in [Vincoli e scadenze](docs://uitleg-constraints).

## Conseguenze e fraintendimenti

**«Il profilo è un'impostazione dell'app.»** No. Il profilo e le opzioni di calcolo appartengono al progetto e viaggiano nel file. Solo i modelli che conservi appartengono all'app, e un progetto conserva sempre una propria copia.

**«Se esporto, il mio profilo mi segue nel file.»** Solo con il tuo formato di progetto (.ifc). Se esporti in *MS Project XML*, *Primavera P6 XML* o *CSV (separato da punto e virgola)*, il profilo non è nel file. Tra le opzioni di calcolo, l'esportazione in MS Project XML scrive al massimo la soglia critica. L'app avvisa di questo solo per un progetto che viene da un .xer file. Per un progetto che hai creato tu, non ricevi nessun messaggio. Il file si apre poi come Open Planner Studio, senza messaggio sul profilo. Prendi l'esempio con il profilo Microsoft Project e 60 % di avanzamento. Se lo esporti in *MS Project XML* e lo riapri, l'app mostra prima le date del file, con la consegna di martedì 22 giugno. Se fai ricalcolare l'app da sola, diventa lunedì 21 giugno. Che cos'altro perde un'esportazione, lo trovi in [File e formati](docs://uitleg-bestanden).

**«Il profilo Primavera P6 dà lo stesso risultato di P6.»** L'app non può garantirlo. Il profilo attiva le convenzioni che l'app conosce da P6, e non sono tutte le impostazioni di P6. Oltre a Retained Logic e Progress Override, P6 ha una terza modalità di progresso, Actual Dates. L'app non la conosce: un .xer file del genere viene calcolato come Retained Logic, e il messaggio di apertura lo segnala, per esempio come *1 impostazione di pianificazione P6 con fallback sicuro.* Anche alcune convenzioni del profilo Primavera P6 funzionano solo su attività che vengono da un xer file, come *LOE non iniziata usa la finestra obiettivo* e *Mantieni esatte le date effettive*. Per alcune di esse la spiegazione lo dice: «solo attività con provenienza P6». Su attività che crei tu, queste convenzioni non fanno nulla.

**«La modalità di progresso fa parte del profilo.»** No. Retained Logic o Progress Override è una scelta separata per progetto. La imposti a parte dal profilo, vedi [Scegliere la modalità di progresso](docs://howto-voortgangsmodus-kiezen). Una convenzione di Primavera P6, *Progress Override ignora anche all'indietro un successore iniziato*, ha effetto solo con Progress Override.

**«Cambio solo il profilo per vedere cosa succede.»** Puoi farlo, perché con *Annulla* torni indietro in un solo passo da *Applica*: profilo e date tornano insieme. Ma le date si possono spostare davvero. Nell'esempio, il passaggio da Open Planner Studio a Microsoft Project sposta tutte e 4 le attività. Il messaggio le conta per te. Controlla la pianificazione dopo, prima di continuare. Se l'app mostra ancora le date del file dopo aver aperto un file .xer o .mpp, un cambio di profilo lascia questa vista e l'app calcola da sola. Come funziona, lo trovi in [Date come registrate](docs://uitleg-datums-zoals-opgeslagen).

**L'esempio mostra quattro convenzioni, e l'elenco nell'app è più lungo.** Ogni riga del blocco ha una sua spiegazione. Leggila per prima. Guarda anche il gruppo *Solo per profili personalizzati*: quelle convenzioni sono disattive in ogni profilo incorporato, anche in Primavera P6. Solo un profilo personalizzato può attivarle: creane uno con *Nuovo profilo*.

## Vedi anche

- [Scelta o costruzione di un profilo di calcolo](docs://howto-rekenprofiel-kiezen): scegliere, cambiare o costruire un profilo.
- [Avanzamento, data di stato e baseline](docs://uitleg-voortgang): cosa fanno la data di stato e il lavoro rimanente, con le differenze per profilo.
- [Scegliere la modalità di progresso](docs://howto-voortgangsmodus-kiezen): scegliere Retained Logic o Progress Override.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): le opzioni di calcolo per il percorso critico e il margine.
- [Relazioni e ritardo](docs://uitleg-relaties): l'opzione di calcolo *Calendario del ritardo*.
- [File e formati](docs://uitleg-bestanden): cosa contiene un'esportazione e cosa no.
- [Esportare](docs://howto-exporteren): esportare un progetto.
- [Aggiornare l'avanzamento](docs://howto-voortgang-bijwerken): inserire la percentuale, l'inizio effettivo e la data di stato.
- [Date come registrate](docs://uitleg-datums-zoals-opgeslagen): perché le date importate possono differire da quelle che l'app calcola da sola.
- [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies): tutte le convenzioni e le opzioni di calcolo in un unico elenco.
