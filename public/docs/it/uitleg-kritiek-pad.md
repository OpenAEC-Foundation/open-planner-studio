# Percorso critico e margine

Perché la fine del progetto è proprio quella data? E quale attività può ritardare di un giorno senza spostare la consegna? Queste sono le domande alla base del percorso critico. Questa guida spiega esattamente cosa calcola l'app, con un esempio svolto.

## Il concetto

Una pianificazione è una rete di attività unite da **relazioni**: accordi come «i telai delle finestre si montano solo quando il tetto è chiuso». Queste relazioni collegano le attività tra loro. Alcune catene di attività sono più lunghe di altre. La catena più lunga decide quanto dura l'intero progetto.

Quella catena più lunga è il **percorso critico**. Se un'attività su di esso ritarda di un giorno, la consegna slitta di un giorno. Su quel percorso non c'è margine.

Le attività fuori dal percorso critico hanno invece spazio. Questo spazio si chiama **margine**. Il muratore che costruisce il paramento esterno potrebbe iniziare due giorni più tardi senza che nessuno se ne accorga. Quei due giorni sono il margine di quell'attività.

Quindi un'attività critica non dice nulla su quanto sia importante. Dice solo che non c'è tempo da perdere.

Il metodo di calcolo si chiama **CPM** (Critical Path Method). Per questo il blocco con i risultati nel pannello *Proprietà* si chiama *Risultato CPM*.

## Come l'app calcola

L'app non ricalcola la pianificazione da sola. Il calcolo inizia con **Calcola** (F5), per esempio tramite *Home › Pianificazione › Calcola*. Se qualcosa è cambiato dall'ultimo calcolo, la barra di stato mostra *Non aggiornato — ricalcola (F5)*. Se *Calcola automaticamente* è attivo (in *Impostazioni › Progetto › Impostazioni app*, scheda *Pianificazione*, intestazione *Calcolo*), l'app lo fa da sola.

Un calcolo fa due passaggi attraverso la rete.

### Passaggio in avanti

L'app parte dall'inizio del progetto e segue le relazioni dal predecessore al successore. Per ogni attività l'app trova il primo giorno possibile in cui l'attività può iniziare. Se un'attività ha più predecessori, l'attività aspetta che finisca l'ultimo. Così ogni attività ottiene il suo **inizio anticipato** e la sua **fine anticipata**. La fine anticipata più tardiva di tutte le attività è la fine del progetto.

### Passaggio all'indietro

Poi l'app torna indietro, dalla fine del progetto fino all'inizio. Ora l'app trova, per ogni attività, l'ultimo giorno in cui l'attività deve essere finita senza spostare la fine del progetto. Se un'attività ha più successori, conta quello che deve iniziare per primo. Così si ottengono l'**inizio posticipato** e la **fine posticipata**.

### Margine totale e margine libero

La differenza tra le date più tarde e quelle anticipate di un'attività è il suo **margine totale**: il numero di giorni lavorativi di cui l'attività può ritardare o iniziare più tardi, prima che si sposti la fine del progetto. L'app conta i giorni lavorativi del calendario dell'attività. Un fine settimana o una festività non contano.

Il **margine libero** è più rigoroso. È lo spazio che un'attività ha prima che uno dei suoi successori debba iniziare più tardi. Puoi usare quello spazio senza che nessun'altra attività se ne accorga.

Il margine totale si può condividere. Se due attività non critiche si susseguono, condividono lo stesso margine. Se la prima lo consuma tutto, alla seconda non ne resta. La prima ha allora margine totale, ma non margine libero. La parte del margine totale che non è libera si chiama **margine interferente**: se la usi, si spostano anche le attività dopo. L'esempio qui sotto lo mostra con i numeri.

### Margine negativo

Il margine può diventare anche negativo. Succede quando un'attività ha una scadenza, o un vincolo che impone una data ultima, che cade prima della data che l'app calcola per quell'attività. Sulla carta l'attività è già in ritardo, e l'attività e la catena che la precede diventano critiche.

### Quando un'attività è critica?

Per impostazione predefinita un'attività è critica quando il suo margine totale è 0 o meno. Puoi cambiarlo in *Impostazioni › Progetto › Impostazioni progetto*, nel blocco *Profilo di calcolo e opzioni*, alla voce *Opzioni di calcolo di questo progetto*. Quando clicchi su *Applica*, l'app ricalcola subito la pianificazione. Le opzioni appartengono al file di progetto, non all'app.

- **Definizione di critica** con *Margine totale ≤ soglia* e il campo *Soglia (giorni lavorativi)*. La soglia è 0 per impostazione predefinita. Per tenere una riserva, impostala a 2, per esempio: ogni attività con 2 giorni lavorativi di margine o meno conta come critica e diventa rossa. Se scegli *Percorso più lungo*, un'attività è critica quando si trova sulla catena più lunga fino all'ultima fine. Il suo margine allora non conta.
- **Percorsi di margine multipli** numerano le catene in base al loro margine nella colonna *Percorso margine*. Il percorso 1 è il percorso critico. Vedi [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies).
- **Contrassegna quasi critico** con la sua *Soglia*, 2 giorni lavorativi per impostazione predefinita. Un'attività con più di 0 ma al massimo quel margine riceve una barra arancione. Così si vede quali attività hanno quasi nessun margine rimasto, senza chiamarle critiche.
- **Attività a estremità aperta critiche**: un'attività senza successore che non è ancora finita conta come critica. Utile come rete di sicurezza contro relazioni dimenticate (vedi più sotto i malintesi).
- **Calcolo del margine** decide se il margine totale si misura all'inizio dell'attività, alla sua fine, o come il più piccolo dei due. I nuovi progetti sono impostati su *Automatico (predefinito)*. Se il progetto usa il profilo Primavera P6 e questa scelta non è *Margine di fine*, un blocco arancione nelle Impostazioni progetto lo segnala; il suo pulsante imposta la scelta su *Margine di fine*. Per MS Project lo stesso pulsante la rimette su *Automatico (predefinito)*: con una data di stato, MS Project stesso calcola in quel modo.

### Dove lo vedi

Le attività critiche hanno una barra rossa nel Gantt. Dietro una barra non critica c'è una banda verde fino alla fine posticipata dell'attività: è il margine. La banda si attiva o disattiva con *Vista › Baseline e progresso › Banda di slack*.

Per un'attività selezionata, il pannello *Proprietà* elenca tutto sotto *Risultato CPM*: inizio e fine anticipati e posticipati, margine totale, libero e interferente, e se l'attività è sul percorso critico. Il margine di tutte le attività, una accanto all'altra, si trova nelle colonne sotto *Calcolato* (il **+** a destra dell'intestazione della tabella), come *Margine totale*, *Margine libero*, *Critica* e *Quasi critica*.

La barra di stato in basso conta le attività critiche, per esempio *Percorso critico: 21 attività, 45 giorni lavorativi*.

## Esempio svolto: l'ampliamento di una casa

L'esempio è il progetto di esercizio dei tutorial *House extension*, nello stato in cui si trova quando tutte le relazioni sono inserite. Nel tutorial 2, «Relazioni e percorso critico», costruisci tu stesso il progetto e controlli i numeri. Qui leggi perché i numeri sono quelli che sono.

L'ampliamento inizia lunedì 7 giugno 2027. Dopo il calcolo la consegna è venerdì 6 agosto 2027 e la barra di stato mostra *Percorso critico: 21 attività, 45 giorni lavorativi*. Due attività non sono critiche: *Build outer cavity leaf* e *Painting*.

### Due catene che si incontrano

Dopo il solaio strutturale (*Lay hollow-core floor*, finito lunedì 28 giugno) il lavoro si divide in due catene. Entrambe finiscono in *Install window frames*:

- L'interno: *Build inner cavity leaf* (5 giorni lavorativi), poi *Place roof elements* (1), poi *Apply roofing* (2). I telai delle finestre possono entrare solo quando il tetto è chiuso.
- L'esterno: *Build outer cavity leaf* (6 giorni lavorativi). I telai si trovano nella facciata, quindi anche quella deve essere finita.

**In avanti.** Entrambi i paramenti dell'intercapedine possono iniziare martedì 29 giugno. Il paramento interno è finito lunedì 5 luglio. Gli elementi del tetto si montano martedì 6 luglio, e la copertura segue mercoledì 7 e giovedì 8 luglio. Il paramento esterno è finito martedì 6 luglio. *Install window frames* aspetta la più tardiva delle due catene, cioè la copertura, e quindi inizia venerdì 9 luglio.

**All'indietro.** I telai devono iniziare venerdì 9 luglio al più tardi, altrimenti la consegna slitta. Quindi il paramento esterno deve essere finito giovedì 8 luglio al più tardi. Sei giorni lavorativi indietro, questo è un inizio posticipato giovedì 1 luglio.

**Margine.** Il paramento esterno può iniziare al più presto il 29 giugno e deve iniziare al più tardi l'1 luglio. In mezzo ci sono 2 giorni lavorativi: mercoledì 30 giugno e giovedì 1 luglio. Questo è il suo margine totale; il pannello mostra *Margine totale: 2 giorni* e *Percorso critico: No*. Anche il margine libero è di 2 giorni, perché il suo unico successore, *Install window frames*, è sul percorso critico.

La catena interna non ha margine. Ogni giorno di ritardo lì sposta i telai e tutto quello che viene dopo.

### Painting

*Painting* (3 giorni lavorativi) inizia dopo l'intonacatura, lunedì 26 luglio, e finisce mercoledì 28 luglio. L'attività successiva, *Snagging and cleaning*, aspetta anche la posa delle piastrelle. La posa è finita solo giovedì 5 agosto, perché il massetto deve prima asciugare per cinque giorni lavorativi. Quindi Painting può durare fino a giovedì 5 agosto. Così si ottengono 6 giorni lavorativi di margine: 29 e 30 luglio, e dal 2 al 5 agosto. Anche qui il margine libero è uguale al margine totale, perché il successore è critico.

### Quando il paramento esterno è in ritardo

Se il paramento esterno richiede 8 giorni lavorativi invece di 6, finisce giovedì 8 luglio: esattamente la sua fine posticipata. Il margine è sparito e l'attività diventa rossa. Entrambe le catene sono allora critiche e la barra di stato conta 22 attività critiche. La consegna resta venerdì 6 agosto.

Se richiede 9 giorni lavorativi, il paramento esterno finisce solo venerdì 9 luglio. I telai slittano a lunedì 12 luglio e la consegna a lunedì 9 agosto: un giorno lavorativo più tardi. La catena esterna è ora il percorso critico; la barra di stato mostra *Percorso critico: 19 attività, 46 giorni lavorativi*.

La catena interna ha allora 1 giorno lavorativo di margine totale, ma quel giorno è condiviso:

- *Build inner cavity leaf*: margine totale 1, margine libero 0, margine interferente 1. Se il paramento interno ritarda di un giorno, gli elementi del tetto si spostano con lui.
- *Place roof elements*: margine totale 1, margine libero 0, margine interferente 1.
- *Apply roofing*: margine totale 1, margine libero 1. Solo qui un giorno di ritardo non costa niente a nessuno.

È sempre lo stesso giorno, condiviso da tutta la catena. Se il paramento interno lo usa, non c'è più per gli elementi del tetto e per la copertura.

### Quasi critico e margine negativo

Con *Contrassegna quasi critico* attivo alla soglia predefinita di 2 giorni lavorativi, il paramento esterno, con esattamente 2 giorni di margine, riceve una barra arancione. Painting, con 6 giorni, resta blu.

Se la consegna riceve una scadenza di mercoledì 4 agosto, due giorni lavorativi prima della consegna calcolata, il margine diventa negativo. Tutte e 21 le attività sul percorso critico ricevono un margine totale di −2 giorni lavorativi. Il paramento esterno non ha più margine e diventa critico anche lui; Painting conserva 4 giorni lavorativi.

## Conseguenze e malintesi

**«Critico vuol dire importante.»** No. Un'ispezione può essere cruciale e avere comunque margine. Al contrario, un lavoro semplice può essere critico: nell'esempio, *Snagging and cleaning* è sul percorso critico. Critico riguarda solo il tempo: non resta nessun margine.

**«Questa attività ha margine, quindi può aspettare.»** Guarda prima il margine libero. Se un'attività ha margine totale ma non margine libero, ogni giorno di ritardo toglie margine alle attività che seguono, come il paramento interno nel caso di 9 giorni lavorativi.

**Una relazione dimenticata dà margine falso.** Un'attività senza successore riceve margine fino alla fine del progetto. Se nell'esempio mancasse la relazione dal paramento esterno ai telai, il paramento esterno avrebbe all'improvviso 23 giorni lavorativi di margine, fino alla consegna del 6 agosto. Sulla carta potrebbe allora ritardare di settimane senza che i telai aspettino. Con *Attività a estremità aperta critiche* attivo, in quel caso il paramento esterno diventa critico e la lacuna si vede.

**Il percorso critico non è fisso.** Se un'attività non critica ritarda più del suo margine, un'altra catena diventa la più lunga. Lo hai visto sopra con i 9 giorni di muratura. Quindi la pianificazione va ricalcolata dopo ogni modifica. Finché la barra di stato dice *Non aggiornato — ricalcola (F5)*, le barre rosse appartengono ancora al calcolo precedente.

**Il margine si conta in giorni lavorativi.** I 6 giorni lavorativi di margine di Painting vanno da giovedì 29 luglio a giovedì 5 agosto: otto giorni sul calendario, perché il fine settimana non conta. Una festività o le ferie edili nel calendario non contano neppure.

## Vedi anche

- [Aggiungere relazioni](docs://howto-relaties-leggen): i passi per collegare le attività e impostare un ritardo.
- [Relazioni e ritardo](docs://uitleg-relaties): come relazioni e ritardo determinano le date anticipate.
- [Vincoli e scadenze](docs://uitleg-constraints): come un vincolo o una scadenza produce un margine negativo.
- [Tracciare un percorso](docs://howto-pad-traceren): seguire la catena dietro un'attività.
- [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies): la definizione di critica, quasi critica e il calcolo del margine, opzione per opzione.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): un grande progetto con più percorsi di margine, attività quasi critiche (soglia 3 giorni lavorativi), un hammock, un vincolo fisso e una relazione esterna.
