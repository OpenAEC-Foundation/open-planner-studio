# Relazioni e ritardo

Perché la muratura inizia solo quando le fondamenta sono pronte? E perché la posa del tetto slitta di una settimana quando gli elementi del tetto arrivano in ritardo? Dipende dalle relazioni tra le tue attività. In questo articolo leggi quali quattro tipi di relazioni conosce l'app, che cosa fanno il ritardo e l'anticipo, in quale calendario conta un ritardo, che cosa succede a una relazione su una fase e come l'app decide quale relazione determina la data di inizio di un'attività.

Le regole e gli esempi valgono per un nuovo progetto, con il profilo di calcolo *Open Planner Studio* e una settimana lavorativa dal lunedì al venerdì.

## Il concetto

Una **relazione** registra che due attività dipendono l'una dall'altra. La prima attività è il **predecessore**, la seconda il **successore**. Una relazione è un limite minimo: il successore non può iniziare o finire prima di quanto la relazione permette, ma può iniziare o finire più tardi. Se un'attività ha più predecessori, aspetta la data più tardiva che risulta da tutte queste relazioni.

Ci sono quattro tipi. Si distinguono per il momento del predecessore (inizio o fine) che è legato a un momento del successore:

- **FS (fine-inizio).** Il successore inizia solo quando il predecessore è terminato. Gli elementi del tetto si montano solo quando i muri sono in piedi. Questo è di gran lunga il tipo più usato.
- **SS (inizio-inizio).** Il successore inizia solo quando il predecessore è iniziato. Le attività possono sovrapporsi: le tubature possono iniziare non appena la muratura è avviata.
- **FF (fine-fine).** Il successore finisce solo quando il predecessore è terminato. La stuccatura non può essere fatta prima che la muratura sia terminata, ma può iniziare prima.
- **SF (inizio-fine).** Il successore finisce solo quando il predecessore è iniziato. Questo tipo è raro. Un esempio: l'emungimento temporaneo dell'acqua di falda può terminare solo quando è iniziata la muratura delle fondamenta.

Una relazione può anche avere un **ritardo**: un tempo di attesa tra le due attività, per esempio per il calcestruzzo che deve maturare. Un ritardo negativo si chiama **anticipo**: il successore inizia allora prima che il predecessore sia terminato, quindi le attività si sovrappongono.

## Come calcola l'app

### I quattro tipi

Per ogni relazione l'app calcola la prima data in cui il successore può iniziare, e prende la più tardiva di tutte le relazioni di un'attività. Senza ritardo funziona così:

- Con FS il successore inizia il primo giorno lavorativo dopo la fine del predecessore.
- Con SS il successore inizia lo stesso giorno del predecessore.
- Con FF il successore finisce lo stesso giorno del predecessore. Per trovare l'inizio, l'app conta indietro sulla durata del successore. Un successore di 3 giorni lavorativi inizia quindi 2 giorni lavorativi prima della fine del predecessore.
- Con SF il successore finisce il giorno in cui inizia il predecessore. Anche qui l'app conta indietro sulla durata del successore.

Questi sono limiti minimi. Un successore inizia più tardi se lo richiede un'altra relazione o un vincolo. Tutte le date compaiono solo dopo **Calcola** (F5). Finché la barra di stato mostra *Non aggiornato — ricalcola (F5)*, le barre appartengono al calcolo precedente.

### Ritardo e anticipo

Un ritardo si può esprimere in quattro modi:

- In **giorni lavorativi** (`3` o `3d`): l'app salta i giorni non lavorativi e i fine settimana. Questo è il valore predefinito.
- In **giorni di calendario** (`3ed`, la e sta per *elapsed*, cioè tempo trascorso): ogni giorno conta, anche sabato e domenica. Questa è l'unità per qualcosa che continua senza che si lavori, come la maturazione.
- Come **percentuale** della durata del predecessore (`40%`): l'app calcola di nuovo questo valore a ogni calcolo e arrotonda ai giorni interi (2,5 giorni diventano 3).
- In **orari di lavoro** (`4h`): l'app conta il ritardo nel calendario del ritardo, per impostazione predefinita quello del predecessore. Se il predecessore è un'attività in giorni su un calendario senza fasce orarie proprie, come il calendario standard, l'app converte le ore in giorni lavorativi interi, arrotondando al giorno intero più vicino (mezza giornata si arrotonda per eccesso). Con un giorno lavorativo di 8 ore, `2h` e `3h` danno quindi 0 giorni, da `4h` fino e incluso `11h` danno 1 giorno e `12h` danno 2 giorni. Se quel calendario ha fasce orarie proprie, o il predecessore è un'attività in ore, il ritardo conta esattamente in ore.

La regola per un ritardo di N giorni lavorativi con FS: gli N giorni lavorativi dopo la fine del predecessore sono tempo di attesa. Il successore inizia il giorno lavorativo dopo questi. Con SS e FF il ritardo si aggiunge rispettivamente all'inizio e alla fine del predecessore. Un ritardo negativo conta all'indietro: un anticipo di 1 giorno lavorativo con FS fa iniziare il successore il giorno in cui il predecessore finisce.

Un anticipo non può spostare un'attività prima dell'inizio del progetto. Se ciò accadesse, l'app lascia il successore all'inizio del progetto e segnala nel pannello *Avvisi*: *Anticipo troncato dall'inizio del progetto — la relazione non è rispettata del tutto*.

### In quale calendario conta il ritardo

Ogni attività può avere un calendario proprio. Con un ritardo in giorni lavorativi conta il calendario che stabilisce i giorni lavorativi. L'impostazione *Calendario del ritardo* decide questo, con quattro scelte: *Predecessore*, *Successore*, *24 ore* e *Calendario del progetto*. Per impostazione predefinita il ritardo conta nel calendario del **predecessore**. Trovi l'impostazione in *Impostazioni › Progetto › Impostazioni progetto*, nel blocco *Profilo di calcolo e opzioni*, alla voce *Opzioni di calcolo di questo progetto*. La scelta appartiene al file di progetto e vale solo dopo aver cliccato su *Applica*; la pianificazione viene poi ricalcolata.

Un ritardo in giorni di calendario (`3ed`) conta sempre tutti i giorni, qualunque *Calendario del ritardo* tu scelga.

### Relazioni su attività di riepilogo

Puoi mettere una relazione su una fase (un'attività di riepilogo) invece che su un'attività al suo interno. Internamente l'app mette quella relazione su ogni attività della fase:

- Una fase come **predecessore** con FS o FF: il successore aspetta che l'ultima attività della fase da terminare sia finita.
- Una fase come **successore** con FS o SS: ogni attività della fase aspetta il predecessore, indipendentemente dalle altre attività della fase.
- Una fase come **predecessore** con SS o SF: il successore aspetta l'inizio dell'attività della fase che inizia **per ultima**, non l'inizio della fase stessa. È più prudente di quanto ti aspetti: il successore non inizia mai troppo presto, ma forse più tardi di quanto intendi. Se vuoi che il successore segua l'inizio della fase, metti la relazione sulla prima attività della fase.
- Una fase come **successore** con FF o SF: ogni attività della fase deve soddisfare da sola la richiesta di fine (con FF la fine è uguale o successiva alla fine del predecessore, con SF è uguale o successiva all'inizio del predecessore), anche un'attività che avrebbe potuto essere fatta molto prima. Metti piuttosto una relazione del genere sull'ultima attività della fase.

Una relazione tra un'attività e la fase in cui si trova non è ammessa.

### Relazioni determinanti

Se un successore ha più predecessori, di solito una sola relazione determina la sua data di inizio: la relazione che impedisce al successore di iniziare anche un solo giorno prima di quanto inizia ora. Una relazione così si chiama **determinante**. In caso di parità ci sono più relazioni determinanti. Riconosci una relazione determinante dal simbolo del fulmine nelle colonne *Predecessori* e *Successori* della tabella, dalla colonna *Determinante* (il **+** a destra dell'intestazione della tabella, sotto *Relazioni*) e dalla tinta più intensa quando segui un percorso. Come si apre quel percorso, è spiegato in [Tracciare un percorso](docs://howto-pad-traceren).

Essere determinante dice qualcosa sulle date, non sulla durata. Anche un predecessore breve può essere determinante, per esempio per via di un ritardo lungo; lo vedi nell'esempio qui sotto.

## Esempio svolto

Gli esempi usano mini-progetti separati, che iniziano tutti lunedì 7 giugno 2027, salvo indicazione diversa. I termini come percorso critico e margine sono spiegati in [Percorso critico e margine](docs://uitleg-kritiek-pad). Costruire tu stesso una rete di relazioni e verificarla è ciò che fai nel tutorial 2, «Relazioni e percorso critico».

### I quattro tipi uno accanto all'altro

*Pour foundation* dura 5 giorni lavorativi: da lunedì 7 a venerdì 11 giugno. *Build walls* (5 giorni lavorativi) segue con FS e va da lunedì 14 a venerdì 18 giugno. Quattro attività di 3 giorni lavorativi ciascuna dipendono da *Build walls*, ognuna con un tipo diverso:

- *Place roof elements* (FS) inizia lunedì 21 giugno, il primo giorno lavorativo dopo la muratura, ed è terminata mercoledì 23 giugno.
- *Pipework* (SS) inizia lunedì 14 giugno, insieme alla muratura, ed è terminata mercoledì 16 giugno.
- *Pointing* (FF) deve essere terminato venerdì 18 giugno, insieme alla muratura. Con 3 giorni lavorativi inizia quindi mercoledì 16 giugno.
- *Dewatering* (SF) deve finire lunedì 14 giugno, il giorno in cui inizia la muratura. Contando indietro 3 giorni lavorativi (giovedì 10, venerdì 11, lunedì 14 giugno) si ottiene un inizio giovedì 10 giugno.

Solo *Place roof elements* è sul percorso critico: il progetto è terminato mercoledì 23 giugno. *Pipework*, *Pointing* e *Dewatering* hanno rispettivamente 5, 3 e 7 giorni lavorativi di margine.

### Ritardo e anticipo in numeri

*Pour foundation* è terminato venerdì 18 giugno. *Build walls* (2 giorni lavorativi) segue con FS. Ecco che cosa fa il ritardo alla data di inizio:

- Senza ritardo la muratura inizia lunedì 21 giugno.
- Con ritardo `3` (tre giorni lavorativi) lunedì 21, martedì 22 e mercoledì 23 giugno sono tempo di attesa; la muratura inizia giovedì 24 giugno.
- Con ritardo `3ed` (tre giorni di calendario) sabato, domenica e lunedì contano; la muratura inizia martedì 22 giugno.
- Con ritardo `-1` (un anticipo di un giorno lavorativo) la muratura inizia venerdì 18 giugno, il giorno in cui il getto è terminato.
- Con ritardo `40%` il ritardo è il 40% di 5 giorni lavorativi, quindi 2 giorni lavorativi; la muratura inizia mercoledì 23 giugno.
- Con ritardo `50%` il ritardo è 2,5 giorni lavorativi, arrotondato a 3 giorni lavorativi; la muratura inizia giovedì 24 giugno.

### Quale calendario conta il ritardo

*Build walls* (4 giorni lavorativi) è sul calendario del progetto (dal lunedì al venerdì) ed è terminato giovedì 10 giugno. *Pointing* (2 giorni lavorativi) segue con FS e ritardo `3`, ed è su un calendario in cui anche sabato e domenica sono giorni lavorativi. Allora la data di inizio dipende dal *Calendario del ritardo*:

- *Predecessore* (predefinito): il ritardo conta nel calendario della muratura. Venerdì 11, lunedì 14 e martedì 15 giugno sono tempo di attesa; la stuccatura inizia mercoledì 16 giugno.
- *Successore*: il ritardo conta nel calendario della stuccatura. Venerdì 11, sabato 12 e domenica 13 giugno sono tempo di attesa; la stuccatura inizia lunedì 14 giugno.
- *24 ore*: ogni giorno di calendario conta. Anche qui venerdì, sabato e domenica sono tempo di attesa; la stuccatura inizia lunedì 14 giugno.
- *Calendario del progetto*: il ritardo conta nel calendario del progetto, come con *Predecessore*; la stuccatura inizia mercoledì 16 giugno.

### Relazioni su una fase

*Foundation* è una fase con due attività: *Excavate* (2 giorni lavorativi, lunedì 7 e martedì 8 giugno) e poi *Pour* (3 giorni lavorativi, da mercoledì 9 a venerdì 11 giugno). *Build walls* segue la fase *Foundation* con FS e inizia lunedì 14 giugno: l'app fa attendere *Build walls* fino a *Pour*, l'ultima attività a terminare.

Con una fase come successore: *Permit* (3 giorni lavorativi, terminato mercoledì 9 giugno) va con FS alla fase *Struttura*. La fase contiene *Build walls* (4 giorni lavorativi) e poi *Lay floor* (2 giorni lavorativi). Ogni attività della fase aspetta il permesso: *Build walls* inizia giovedì 10 giugno ed è terminata martedì 15 giugno. *Lay floor* aspetta anche la muratura e va da mercoledì 16 a giovedì 17 giugno.

Con SS da una fase: la fase *Finishing* contiene *Plastering* (2 giorni lavorativi, 7 e 8 giugno), poi *Painting* (3 giorni lavorativi, dal 9 all'11 giugno) e poi *Snagging* (2 giorni lavorativi, 14 e 15 giugno). *Cleaning* segue la fase con SS. Ti aspetteresti un inizio lunedì 7 giugno, ma l'app fa attendere *Cleaning* l'inizio di *Snagging*, l'attività che inizia per ultima: lunedì 14 giugno.

### Che cosa è determinante

*Pour foundation* (2 giorni lavorativi) va da lunedì 7 a martedì 8 giugno. Seguono due rami:

- *Build walls* (5 giorni lavorativi): da mercoledì 9 a martedì 15 giugno.
- *Order roof elements* (2 giorni lavorativi): mercoledì 9 e giovedì 10 giugno.

*Place roof elements* (3 giorni lavorativi) segue entrambi: con FS dopo la muratura, e con FS e ritardo `5` dopo l'ordine (il tempo di consegna). Dalla muratura, la posa potrebbe iniziare mercoledì 16 giugno. Dall'ordine, venerdì 11, lunedì 14, martedì 15, mercoledì 16 e giovedì 17 giugno sono tempo di attesa; la posa inizia venerdì 18 giugno. La relazione con l'ordine è quindi una relazione determinante, anche se l'ordine è molto più breve della muratura. La muratura ha 2 giorni lavorativi di margine.

## Conseguenze e idee sbagliate

**«Una relazione fissa le attività.»** No, una relazione è un limite minimo. Un successore inizia al più presto alla data che dà la relazione, e più tardi se lo chiede un'altra relazione o un vincolo. Come si inseriscono i vincoli è spiegato in [Vincoli e scadenze](docs://uitleg-constraints).

**«SS vuol dire che le attività iniziano nello stesso momento.»** SS dice solo che il successore non può iniziare prima del predecessore. Se il successore ha un altro predecessore che finisce più tardi, inizia più tardi.

**«Con FF il successore inizia lo stesso giorno.»** No, con FF coincidono le date di fine. Un successore breve quindi inizia più tardi del predecessore, come la stuccatura nell'esempio.

**«Un ritardo in giorni conta i giorni di calendario.»** Per impostazione predefinita un ritardo conta i giorni lavorativi, nel calendario del predecessore. Per la maturazione o l'asciugatura, dove anche il fine settimana conta, usi i giorni di calendario (`ed`).

**«Un'attività senza relazioni non è un problema.»** Un'attività senza predecessore inizia alla sua data di inizio pianificata, e un'attività senza successore ottiene margine fino alla fine del progetto. Se dimentichi una relazione, un'attività sembra quindi avere molto spazio; vedi le idee sbagliate in [Percorso critico e margine](docs://uitleg-kritiek-pad).

**«Una relazione su una fase è una sola relazione.»** Per il calcolo è una relazione per ogni attività della fase. Se sposti attività dentro o fuori da una fase, cambiano anche le relazioni che valgono per quelle attività.

## Vedi anche

- [Aggiungere relazioni](docs://howto-relaties-leggen): i passaggi per collegare attività tra loro e impostare un ritardo.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): ciò che l'app calcola dalle tue relazioni e perché un'attività diventa critica.
- [Vincoli e scadenze](docs://uitleg-constraints): accordi sulle date, accanto alle relazioni.
- [Tracciare un percorso](docs://howto-pad-traceren): rendere visibile la catena prima o dopo un'attività.
- [Creare un hammock](docs://howto-hammock): un'attività con una durata derivata, appesa a relazioni di tipo SS e FF.
- [Relazioni esterne verso un altro progetto](docs://howto-externe-relaties): relazioni con un'attività in un altro file di progetto.
