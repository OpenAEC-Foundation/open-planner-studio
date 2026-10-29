# Impostazioni app

Ogni impostazione dell'app: cosa fa, il valore iniziale, cosa cambia e dove la trovi. Per le opzioni di calcolo di un progetto (profilo di calcolo, definizione di critico) vedi [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies): quelle appartengono al file di progetto, non all'app.

## Dove trovarle e come funzionano

Il pannello delle impostazioni si trova in tre posti, ed è sempre lo stesso pannello: l'ingranaggio in alto nella finestra, *Impostazioni › Progetto › Impostazioni app* e *File › Impostazioni app*. Il pannello ha tre schede: *Aspetto*, *Pianificazione* e *Avanzate*. Ogni impostazione qui sotto indica solo la scheda.

Una modifica ha effetto subito. Non c'è un pulsante *Applica* e non c'è un pulsante *Annulla*.

**Per l'intera app, non per progetto.** Tutte le impostazioni di questo articolo valgono per tutti i tuoi progetti e appartengono a questo dispositivo. L'app le conserva nella memoria dell'app o del tuo browser, non nel file di progetto. Quindi un'altra persona che apre il tuo file vede le proprie impostazioni. Un browser di cui cancelli la memoria riparte dai valori iniziali.

## Scheda Aspetto

**Tema** — lo schema di colori dell'interfaccia. Scegli tra *Scuro*, *Chiaro* e *Alto contrasto*. Predefinito: *Scuro*. Effetto: i colori di tutta l'interfaccia, incluso il Gantt e l'istogramma. Dove: *Aspetto*.

**Segui tema di sistema** — lascia decidere lo schema di colori del tuo sistema operativo. Predefinito: disattivato. Effetto: l'app è *Chiaro* o *Scuro*, a seconda del tuo sistema; i tre riquadri dei temi sono allora disattivati. *Alto contrasto* non segue il sistema: lo scegli tu. Se lo disattivi, resta il tema visibile in quel momento. Dove: *Aspetto*, sotto *Tema*.

**Lingua** — la lingua dell'interfaccia. Predefinito: la lingua del tuo browser o del sistema, se l'app la conosce, altrimenti l'inglese. Effetto: tutti i testi dell'app; le lingue sono ordinate per il loro codice breve. L'arabo e il persiano mostrano l'interfaccia da destra a sinistra. La lingua degli articoli della Guida la imposti separatamente, sotto *Lingua della documentazione* in *File › Guida*. Dove: *Aspetto*.

**Carattere** — il carattere di tutta l'interfaccia. Scegli tra *Predefinito*, *Sistema*, *Serif* e *Monospace*. Predefinito: *Predefinito*. Effetto: titoli e testi nella finestra, e il testo nel Gantt e nell'istogramma. Un'app web non segue da sola il carattere del tuo sistema. Per questo lo scegli qui. Dove: *Aspetto*.

**Dimensione del testo** — scala dell'interfaccia. Scegli tra 90%, 100%, 110% e 125%. Predefinito: 100%. Effetto: il testo e il layout della barra multifunzione, dei pannelli e delle finestre di dialogo diventano più grandi o più piccoli, e l'altezza delle righe della tabella e del Gantt cambia di conseguenza. Non c'è una scelta sopra il 125%, perché le etichette dei pulsanti nella barra multifunzione andrebbero a capo su più righe. Dove: *Aspetto*.

**Formato data** — come appaiono le date nell'app. Scegli tra *gg-mm-aaaa*, *mm-gg-aaaa* e *aaaa-mm-gg*. Predefinito: *gg-mm-aaaa*. Effetto: le date nella tabella, nelle finestre di dialogo, nei report e nella stampa. File e calcoli non cambiano: cambia solo la visualizzazione. Dove: *Aspetto*.

**Formato ora** — come appaiono gli orari nell'app. Scegli tra *24 ore (13:00)* e *12 ore (1:00 PM)*. Predefinito: *24 ore (13:00)*. Effetto: gli orari nella finestra dei calendari, la data e l'ora delle attività in ore (tabella, divisioni, messaggi) e la scala temporale *Ora* nel Gantt. In un campo orario puoi scrivere una delle due forme: *13:00*, *1300*, *13*, *1:00 PM* o *1 pm*. La mezzanotte come fine della giornata è *24:00* o *12:00 AM*. File e calcoli non cambiano: restano a 24 ore. Dove: *Aspetto*.

**Visualizzazione durata** — in quale unità si mostra la durata di un'attività. Scegli tra *Automatica (unità propria per attività)*, *Sempre giorni* e *Sempre ore*. Predefinito: *Automatica (unità propria per attività)*. Effetto: nella tabella attività, nelle etichette delle barre del Gantt, nel suggerimento a comparsa, nella stampa e nei report. Con *Automatico* un'attività in giorni mostra giorni e un'attività in ore mostra ore. Con *Sempre giorni* o *Sempre ore* l'app converte usando le ore per giorno del calendario dell'attività. Se l'unità dell'attività è diversa, aggiunge tra parentesi la sua unità, per esempio `2.25d(18h)`. Cambia solo la visualizzazione: l'attività mantiene la sua unità. Dove: *Aspetto*.

**Stile di cambio documento** — come passi da un progetto aperto all'altro. Scegli tra *Schede orizzontali*, *Schede verticali* e *Pillola*. Predefinito: *Schede orizzontali*. Effetto: *Schede orizzontali* mette una barra con schede sotto la barra multifunzione; *Schede verticali* mette una barra dei progetti a sinistra; *Pillola* mette un piccolo pulsante del progetto nella barra del titolo. Dove: *Aspetto*.

### Sezione Gantt

**Mostra solo giorni lavorativi** — comprime l'asse temporale. Predefinito: disattivato. Effetto: i fine settimana e le festività del calendario di progetto vengono saltati, quindi un'attività di 5 giorni lavorativi occupa esattamente 5 giorni sulla scala temporale. Anche le scorciatoie *Vai a oggi* e *Adatta al progetto* contano allora in giorni lavorativi. Il report ha una propria casella con lo stesso nome, indipendente da questa impostazione. Dove: *Aspetto*, sotto *Gantt › Asse temporale*.

**Mostra i quarti d'ora con zoom molto ravvicinato** — una scala temporale più fine. Predefinito: disattivato. Effetto: puoi ingrandire ancora e la scala delle ore riceve una riga in più per i quarti d'ora. Trascinando la barra di un'attività in ore, lo spostamento può agganciarsi ai quarti d'ora invece che alle ore intere. Lo vedi solo se *Attiva pianificazione oraria* è attivo. Dove: *Aspetto*, sotto *Gantt › Zoom al quarto d'ora*.

**Barre delle attività alle interruzioni** — se un'attività in ore viene disegnata a blocchi. Scegli tra *Non dividere mai*, *Dividi alla selezione* e *Dividi sempre*. Predefinito: *Dividi alla selezione*. Effetto: la barra di un'attività in ore viene disegnata per fascia oraria, invece che come un unico blocco continuo. *Dividi alla selezione* lo fa solo per l'attività selezionata. Riguarda solo le attività in ore. Un'attività che è davvero divisa (con *Dividi attività*) mostra la sua interruzione, indipendentemente da questa impostazione. Dove: *Aspetto*, sotto *Gantt*.

**Scorrimento e zoom › Modalità** — cosa fa la rotella del mouse sopra il Gantt. Scegli tra *Posizione*, *Tasti* e *Zoom + trascina*. Predefinito: *Zoom + trascina*. Effetto: con *Zoom + trascina* la rotella ingrandisce o riduce attorno al cursore, Shift+rotella scorre tra le righe, trascinando lo sfondo sposti l'asse temporale e Ctrl+trascinamento (Cmd su Mac) disegna un riquadro di selezione. Con *Posizione* la funzione della rotella dipende da dove si trova il cursore. Ctrl+rotella ingrandisce sempre e Shift+rotella scorre sempre in orizzontale. Con *Tasti* scegli tu quale tasto fa cosa. La scelta vale anche per il secondo asse temporale della vista divisa. Dove: *Aspetto*, sotto *Gantt › Scorrimento e zoom*.

**Scorrimento e zoom › Divisione dello schermo** — dove deve trovarsi il cursore per ciascuna funzione. Visibile solo nella modalità *Posizione*. Scegli tra *Sinistra/destra*, *Su/giù* e *Angolo in alto a destra*. Predefinito: *Sinistra/destra*. Effetto: con *Sinistra/destra* la rotella scorre in verticale sulla metà sinistra e in orizzontale sulla metà destra. Con *Su/giù* la rotella scorre in orizzontale sul 30% superiore, vicino alla scala temporale, e in verticale sotto di esso. Con *Angolo in alto a destra* la rotella scorre in orizzontale nel quadrante in alto a destra e in verticale nel resto. Dove: *Aspetto*, sotto *Gantt › Scorrimento e zoom*.

**Scorrimento e zoom › Verticale, Orizzontale, Zoom** — quale tasto appartiene a quale funzione della rotella. Visibile solo nella modalità *Tasti*. Per ogni funzione scegli tra *Scorrimento*, *Ctrl + rotella* o *Shift + rotella*. Predefinito: *Verticale* è *Scorrimento*, *Zoom* è *Ctrl + rotella* e *Orizzontale* è *Shift + rotella*. Effetto: se scegli un tasto già in uso, si scambia con la funzione che lo aveva. Dove: *Aspetto*, sotto *Gantt › Scorrimento e zoom*.

## Scheda Pianificazione

**Attiva modalità costruzione** — valori iniziali per nuovi progetti, orientati alla costruzione. Predefinito: attivo. Effetto: con attivo, un nuovo progetto riceve il calendario *Bouwkalender NL* con le festività pubbliche olandesi, puoi scegliere una festività edile quando generi le festività, puoi scegliere i modelli di fasatura *Edilizia residenziale* e *Edilizia non residenziale / ristrutturazione*, e le nuove attività ricevono la categoria di lavoro *Costruzione*. Con disattivato hai il calendario *Standaardkalender* senza festività, solo il modello *Vuoto* e la categoria di lavoro *Altro*. Una nuova attività sotto un'attività padre che ha una categoria di lavoro eredita prima quella categoria; *Costruzione* o *Altro* si applica dopo. Attività e calendari esistenti non cambiano. Dove: *Pianificazione*.

**Attiva pianificazione oraria** — pianificazione in ore lavorative accanto ai giorni lavorativi. Predefinito: disattivato. Effetto: la scala temporale *Ora* compare sotto *Vista › Scala temporale*. Nella finestra *Calendari* un calendario normale può ricevere fasce orarie (il blocco *Orari di lavoro*; un calendario che ha già fasce orarie mostra sempre quel blocco), e la finestra *Nuovo progetto* riceve le scelte *Turno* e *Unità predefinita per le nuove attività*. Anche *Impostazioni progetto* riceve la scelta *Unità predefinita per le nuove attività*. Disattivato, l'app lavora solo con i giorni. Le attività già in ore restano e sono incluse nel calcolo. Puoi modificarne la durata solo dopo aver attivato la pianificazione oraria. Dove: *Pianificazione*, sotto *Pianificazione oraria*. Vedi [Attivare la pianificazione oraria](docs://howto-urenplanning-aanzetten).

**Consenti pianificazione mista giorni/ore** — se scegli l'unità per ogni attività. Visibile solo quando *Attiva pianificazione oraria* è attivo. Predefinito: attivo. Effetto: con attivo compare il menu a tendina *Unità di durata* accanto alla durata di ogni attività. Disattivato nasconde quel menu. Dove: *Pianificazione*, sotto *Pianificazione oraria*. Vedi [Giorni e ore](docs://uitleg-dagen-en-uren).

**Inizio settimana** — il primo giorno della settimana. Scegli tra *Lunedì* e *Domenica*. Predefinito: *Lunedì*. Effetto: la struttura delle settimane e i numeri di settimana della scala temporale nel Gantt e nei report (la stampa del diagramma di Gantt), e l'ordine dei giorni della settimana nella finestra *Calendari*. Dove: *Pianificazione*.

**Calcola automaticamente** — ricalcola la pianificazione appena non è più aggiornata. Predefinito: disattivato. Effetto: con disattivato devi premere tu *Calcola* (F5). Con attivo l'app ricalcola la pianificazione in una frazione di secondo dopo una modifica alle attività, alle relazioni o al calendario. Durante un trascinamento, o mentre scrivi in un campo, l'app aspetta e calcola una volta sola quando hai finito. Dopo un calcolo non riuscito, l'app calcola di nuovo solo dopo che hai cambiato qualcosa. Dove: *Pianificazione*, sotto *Calcolo*.

**Usa tipi di attività** — i campi tipo di attività e lavoro nell'app. Predefinito: disattivato. Effetto: con attivo compaiono il campo *Tipo di attività* su un'attività e la colonna del lavoro per le assegnazioni, e diventa disponibile la colonna della tabella *Tipo di attività*. Disattivato li nasconde: durata e unità restano e il lavoro si adegua. Un progetto che contiene già dati di tipo di attività o di lavoro, per esempio da un file `.mpp` o `.xer`, li mostra sempre, anche se l'impostazione è disattivata. Dove: *Pianificazione*, sotto *Calcolo*. Vedi [Tipi di attività: durata, unità e lavoro](docs://uitleg-werkregels).

## Scheda Avanzate

**Mostra una spiegazione dopo l'apertura** — una casella per formato: *File Primavera (.xer)*, *File MS Project (.mpp)*, *MS Project XML*, *Primavera P6 XML* e *File CSV*. Predefinito: tutte attive. Effetto: con attivo compare una finestra con una breve spiegazione del formato dopo che apri un file di quel tipo: che cosa l'app ha importato, che cosa no, e come funzionano il salvataggio e la riscrittura. *Non mostrare più per …* in quella finestra toglie la spunta qui; qui la riattivi. Un file IFC, un esempio e un progetto che un assistente IA o un'estensione apre non ricevono mai questa spiegazione. Dove: *Avanzate*, sotto *Mostra una spiegazione dopo l'apertura di*. Vedi [Aprire e salvare un file](docs://howto-bestand-openen-en-opslaan).

**Abilita modalità IA** — lascia lavorare un assistente IA con la tua pianificazione. Predefinito: disattivato. Effetto: con attivo compare la scheda *IA* con il bridge MCP. Così un assistente IA può lavorare con la tua pianificazione tramite il Model Context Protocol. Disattivato nasconde la scheda e ferma il bridge. Dove: *Avanzate*, sotto *Modalità IA*. Vedi [Collegare un assistente IA (MCP)](docs://howto-ai-assistent-koppelen).

**Avvia bridge automaticamente** — avvia il bridge MCP quando l'app si avvia. Si può attivare solo quando *Abilita modalità IA* è attivo. Predefinito: disattivato. Effetto: il bridge è subito attivo, quindi un client IA può collegarsi senza che tu prima apra la scheda *IA*. Funziona solo nell'app desktop, e una volta per ogni avvio: se poi disattivi tu il bridge, non riparte. Dove: *Avanzate*, sotto *Modalità IA*.

**Attiva terminale di debug** — un pannello di log per la risoluzione dei problemi. Predefinito: disattivato. Effetto: con attivo compare un pulsante terminale nella barra di stato, che mostra o nasconde il pannello di log. Disattivato chiude il pannello. Dove: *Avanzate*, sotto *Terminale di debug*.

**Benchmark…** — misura le prestazioni del motore di pianificazione. Effetto: apre una finestra in cui si genera una pianificazione di prova della dimensione scelta e si misurano le fasi principali. Il progetto aperto resta intatto. È un pulsante, non un'impostazione: non c'è nulla da ricordare. Dove: *Avanzate*, sotto *Benchmark*.

**Statistiche…** — quante volte è stata scaricata l'app. Effetto: apre la finestra *Statistiche dei download* con cifre pubbliche da GitHub Releases; da te non viene raccolto nulla. È un pulsante, non un'impostazione. Dove: *Avanzate*, sotto *Statistiche*. Nella finestra:

- *Download per sistema operativo* — per sistema mostra le colonne *Download*, *Installer* (ciò che una persona scarica) e *Aggiornamenti* (ciò che l'aggiornamento nell'app scarica), con un *Totale*. Su Linux i due non si possono separare: l'aggiornamento scarica lo stesso file `.deb`, `.rpm` o `.AppImage` che le persone scaricano anche a mano. Per questo lì conta come installer solo il file snap. Sotto c'è *Controlli di aggiornamento dall'app*: quante volte l'aggiornamento di un'app installata ha scaricato il file di versione da GitHub per cercare una nuova versione. Sono controlli, non installazioni.
- *Per release* — gli stessi download per versione, con la data. Prima le sei più recenti, con *Mostra tutte le … release* per le altre.
- *Fonte* — la data delle cifre (GitHub Releases, aggiornato ogni settimana) e *Aggiorna ora*. L'app conserva le cifre scaricate per mezz'ora. Se il download non riesce, la finestra lo indica. Le installazioni tramite Snap Store non passano da GitHub e mancano.

**Avvia tour** — il tour introduttivo di nuovo. Effetto: chiude la finestra *Impostazioni app* e avvia il tour dal primo passo. Dove: *Avanzate*, sotto *Tour*.

**Versione** — il numero di versione dell'app, con due pulsanti. *Controlla aggiornamenti* apre la finestra di aggiornamento. *Novità* mostra le novità della versione attuale. Dove: *Avanzate*, sotto *Versione*.

**Mostra pulsanti classici della vista** — una funzione sostituita, sotto *Funzioni legacy*. Predefinito: disattivato. Effetto: con attivo torna un gruppo *Visualizzazione* nella scheda *Vista*, con i pulsanti separati *Colonne…*, *Filtro…*, *Raggruppa…* e *Ordina…*. Sono stati sostituiti dal segno più nell'intestazione della tabella, dai pulsanti del layout e dalla finestra del layout. Dove: *Avanzate*, sotto *Funzioni legacy*.

## Scelte di visualizzazione ricordate fuori dal pannello

L'app conserva anche queste scelte su questo dispositivo, ma le imposti sull'elemento stesso, non nel pannello delle impostazioni.

**Sovrapposizione della baseline** — la baseline attiva come barra sottile sotto la barra attività. Predefinito: attivo. Dove: *Vista › Baseline e progresso › Sovrapposizione della baseline*.

**Linea di avanzamento** — la linea a zigzag dell'avanzamento alla data di stato. Predefinito: attivo. Effetto: la linea appare solo se il progetto ha una data di stato, e sostituisce allora la linea data di stato separata. Dove: *Vista › Baseline e progresso › Linea di avanzamento*.

**Linea data di stato** — una linea tratteggiata alla data di stato. Predefinito: attivo. Effetto: se la linea di avanzamento è attiva, la linea data di stato disegna il segno da sola. Dove: *Vista › Baseline e progresso › Linea data di stato*.

**Accento risorsa** — una striscia sottile nel colore della risorsa sotto la barra attività. Predefinito: disattivato. Dove: *Vista › Baseline e progresso › Accento risorsa*.

**Banda di slack** — il margine come banda dietro le barre non critiche. Non vale per le attività completate. Predefinito: attivo. Dove: *Vista › Baseline e progresso › Banda di slack*.

**Colori barre** — da che cosa dipende il colore di una barra. Scegli tra *Percorso critico*, *Per attività — automatico* e *Per categoria*. Predefinito: *Percorso critico*. Effetto: vale per il Gantt e per il report nello stesso momento. Dove: *Vista › Baseline e progresso › Colori barre*.

**Istogramma** — la striscia dell'istogramma sotto il Gantt. Predefinito: disattivato. Dove: *Risorse › Istogramma › Istogramma*, *Vista › Pannelli › Istogramma* oppure Ctrl+Maiusc+H. Imposti l'altezza della striscia (predefinita 160 pixel, tra 80 e 480) trascinandone il bordo.

**Minimappa** — una mappa panoramica della linea temporale. Predefinito: disattivato. Dove: *Vista › Presentazione › Minimappa*.

**Comprimi la barra multifunzione** — una barra multifunzione compatta. Predefinito: disattivato. Dove: il pulsante a freccia in basso a destra della barra multifunzione.

**Larghezza della tabella attività** — predefinita 350 pixel, tra 150 e 800. La imposti trascinando il divisore accanto alla tabella, oppure con i tasti freccia sinistra e freccia destra quando il divisore è attivo.

**Larghezza del pannello destro** — predefinita 280 pixel, tra 200 e 900. La imposti trascinando il bordo del pannello.

**Altezza di *Proprietà* e *Avvisi* nel pannello destro** — predefinite 240 e 220 pixel, tra 120 e 2000. *Proprietà* ha quell'altezza anche quando è aperta la lista delle risorse. Imposti l'altezza con la maniglia di trascinamento tra le sezioni. L'app non ricorda se le sezioni sono aperte o chiuse.

**Anche ricordate, descritte altrove** — le colonne della tabella ([Regolare le colonne della tabella](docs://howto-tabelkolommen-aanpassen)), i tuoi layout ([Creare e usare un layout](docs://howto-layouts-gebruiken)), le opzioni dei report ([Tipi di report](docs://ref-rapporttypes)), i tuoi modelli di profilo di calcolo ([Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies)) e la *Lingua della documentazione* della Guida (*File › Guida*) sono anche salvati dall'app su questo dispositivo, non nel file di progetto.

## Vedi anche

- [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies): le opzioni che appartengono a un progetto.
- [Attivare la pianificazione oraria](docs://howto-urenplanning-aanzetten): i passi per l'interruttore *Attiva pianificazione oraria*.
- [Giorni e ore](docs://uitleg-dagen-en-uren): come l'app conta giorni e ore.
- [Tipi di attività: durata, unità e lavoro](docs://uitleg-werkregels): che cosa rende visibile *Usa tipi di attività*.
- [Tasti di scelta rapida](docs://ref-sneltoetsen): tutti i tasti dell'app, compresi quelli per lo zoom e lo scorrimento.
