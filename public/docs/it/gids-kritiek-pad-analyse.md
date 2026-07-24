# Percorso critico e analisi avanzata

Ogni pianificazione ha una catena più lunga di attività che insieme determinano quando finisce il progetto: il percorso critico. Tutto ciò che sta fuori ha margine — spazio per slittare senza toccare la data di fine. Questa guida va oltre "quali barre sono rosse": margine totale/libero/interferente, lavoro quasi critico, più percorsi ugualmente critici, hammock, blocchi rigidi e il loro effetto a monte, e collegamenti esterni tra progetti.

## Cosa imparerai qui

- Leggere il percorso critico, e la differenza tra margine totale, libero e interferente.
- Lavoro quasi critico: impostare la soglia e riconoscere il contrassegno ambra.
- Più percorsi critici contemporaneamente — quando succede e come lo vedi.
- Blocchi rigidi e il loro effetto sul margine, incluso il margine negativo che sorge a monte.
- Hammock (Level of Effort): cosa fanno e cosa non fanno.
- Collegamenti esterni tra progetti: l'ancoraggio congelato, l'aggiornamento e lo stato "origine mancante".
- Tracciare un percorso tramite il menu contestuale o la barra multifunzione.
- La sezione **Calcolo** nelle impostazioni del progetto.

Segui con [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) — il grande esempio "kitchen sink" con tre torri parallele che mostra quasi ogni argomento di questa guida: più percorsi critici, lavoro quasi critico, un hammock, un blocco rigido e un collegamento esterno a un file di origine separato.

## Leggere il percorso critico

Premi **F5** (o il pulsante **Calcola**) per eseguire la pianificazione. La barra di stato in fondo mostra allora, ad esempio, "Percorso critico: N attività, M giorni lavorativi" — il numero di attività sul percorso critico e la durata totale. Nel diagramma di Gantt, le attività critiche ottengono un colore di barra proprio (rosso): attività senza margine, dove ogni giorno di ritardo posticipa direttamente la data di fine del progetto.

Fai doppio clic su un'attività e guarda nella sezione **Risultato CPM** per i numeri esatti: **Inizio anticipato**, **Fine anticipata**, **Inizio posticipato**, **Fine posticipata**, **Margine totale**, **Margine libero** e (dove applicabile) **Margine interferente**, più se l'attività è sul **Percorso critico**. Vuoi questi campi come colonne nella tabella delle attività? **Vista → Colonne…** e selezionali.

### Margine totale, libero e interferente

- **Margine totale** — quanto un'attività può slittare in totale senza toccare la data di fine progetto. Zero significa critica.
- **Margine libero** — quanto un'attività può slittare senza toccare il suo successore immediato. Può essere minore del margine totale: un'attività può avere un po' di margine totale, eppure se slitta di un solo giorno il suo successore immediato si sposta già anch'esso (quel successore ha allora abbastanza margine proprio da non toccare la data di fine).
- **Margine interferente** — la differenza tra i due (margine totale − margine libero): la parte del tuo margine che non tocca la data di fine ma "intralcia" comunque un successore. Zero significa che margine libero e totale sono uguali — slittare entro il tuo margine allora non influisce su nessuno.

## Lavoro quasi critico

Un'attività con un margine totale piccolo, diverso da zero, è vulnerabile: un piccolo intoppo la rende critica dopotutto. Attiva questo tramite **Info progetto → Calcolo → Contrassegna quasi critico**, con una **Soglia** in giorni lavorativi (o ore, a seconda della tua visualizzazione della durata). Ogni attività con margine totale maggiore di zero e minore o uguale a quella soglia ottiene un colore di barra ambra nel Gantt — tra il rosso del critico e il verde del margine ampio.

Il grande esempio imposta la soglia a 3 giorni lavorativi. L'ispezione finale della **Torre C** ha quindi esattamente 3 giorni lavorativi di margine totale — appena entro la soglia — mentre le ispezioni finali identiche della **Torre A** e della **Torre B** si trovano a margine zero e sono genuinamente critiche. La Torre C è identica alle altre due in attività e durate tranne un'attività di finitura leggermente più corta; quella piccola differenza è esattamente sufficiente per spostarla da critica a quasi critica.

## Più percorsi critici

Normalmente c'è esattamente una catena più lunga, ma può capitare che due o più catene abbiano esattamente la stessa lunghezza — allora sono entrambe (o tutte) ugualmente critiche. Attiva **Percorsi di margine multipli** (**Info progetto → Calcolo**) per farlo calcolare: scegli il **Metodo** (**Margine libero (peeling)** o **Margine totale (classifica)**) e un valore per **Percorsi max.**. Ogni attività ottiene allora un numero di **Percorso di margine** (1 = più critico); un'attività senza percorso di margine non è su nessuno dei percorsi calcolati.

Nel grande esempio, la Torre A e la Torre B sono completamente simmetriche in attività e durate — finiscono esattamente nello stesso momento. Non appena attivi **Percorsi di margine multipli**, vedrai più di un percorso nei risultati (`criticalPaths.length` maggiore di 1 nel calcolo): non un'unica catena più lunga, ma diverse catene ugualmente critiche che attraversano il progetto. Questo è un segnale diverso da "un percorso critico con del lavoro quasi critico accanto" — significa che un ritardo in *uno qualsiasi* di quei percorsi colpisce allo stesso modo la data di fine, quindi non puoi concentrare la tua attenzione su una singola catena.

## Blocchi rigidi e il loro effetto sul margine

Un **blocco rigido** (la casella **Obbligatorio (logica di blocco)** su un vincolo MSO o MFO) fissa un'attività a una data, anche se i suoi predecessori la contraddicono logicamente. Il grande esempio lo usa su "Wegafzetting gemeente (vergunde stremmingsperiode)" (chiusura stradale comunale, periodo di chiusura autorizzato): il comune permette la chiusura solo esattamente in quella data autorizzata, punto — la logica della rete si piega attorno a essa.

L'effetto a monte è la parte difficile da comprendere: se i predecessori di un'attività bloccata hanno bisogno di più tempo di quanto disponibile fino alla data del blocco, appare **margine negativo** su quei predecessori. Il margine negativo non è quindi un errore di calcolo: è il modo in cui il motore ti dice "questa catena precedente non rientra più nel tempo che il blocco consente". Se vedi margine negativo a monte di un blocco rigido, la domanda non è "cosa è rotto qui" ma "quale di queste due cose deve cedere: la data del blocco, o la durata della catena prima di essa".

Nota: nel grande esempio, l'intera catena attorno a "Wegafzetting gemeente" — inclusa l'attività bloccata stessa — è già stata completata da tempo (inizio e fine effettivi, ben prima della data di stato). Per questo motivo, vedrai lì un piccolo margine negativo residuo su tutta la catena della fase 1, inclusa sull'attività di blocco stessa: questa è una caratteristica delle attività già completate combinate con una data di stato, non lo scenario "i predecessori non rientrano" descritto sopra. Per vedere quello scenario nella sua forma pura: cancella temporaneamente la data di stato (gruppo della barra multifunzione **Baseline e progresso**, pulsante **Cancella data di stato**) e ricalcola — l'attività di blocco stessa torna allora a margine totale zero, e il margine negativo appare solo quando rendi deliberatamente la catena precedente più lunga dello spazio disponibile prima della data del blocco.

## Hammock (Level of Effort)

Un **hammock** (la casella **Hammock (durata derivata)** nel pannello delle proprietà) è un'attività senza un proprio input di durata: il suo inizio e la sua fine seguono automaticamente dalle sue relazioni. Le relazioni **FS**/**SS** in ingresso forniscono il **driver di inizio** (l'inizio più anticipato), le relazioni **FF**/**SF** in ingresso forniscono il **driver di fine** (la fine più posticipata) — il pannello mostra entrambi in sola lettura non appena selezioni la casella hammock, così puoi vedere esattamente quali attività determinano l'intervallo. Senza un driver di fine, l'intervallo torna a lunghezza zero, con un avviso nel pannello.

Cosa fa un hammock: mostra, come una sorta di barra sovrastante, l'intero intervallo di un pezzo di lavoro senza che tu debba mantenere tu stesso una durata — comodo per, ad esempio, "supervisione" o "spese generali di cantiere" che letteralmente durano quanto il lavoro sottostante. Cosa non fa un hammock: non porta risorse o logica proprie che influiscono sul calcolo CPM — è una vista derivata, non un'attività determinante. Il grande esempio lo usa per "Ruwbouw toren A (LOE)" (struttura grezza, Torre A): un hammock che inizia non appena inizia la prima vera attività di struttura grezza della Torre A e finisce non appena è terminata l'ultima, senza posizionarsi da nessuna parte in mezzo esso stesso.

## Collegamenti esterni tra progetti

I grandi progetti a volte consistono in diverse sotto-pianificazioni gestite separatamente — ad esempio la tua pianificazione principale e un pacchetto di opere esterne gestito da un altro appaltatore. Un **collegamento esterno** (la finestra **Collegamento esterno (tra progetti)**, aperta tramite il pulsante sulla scheda **Relazioni**) registra una relazione verso un'attività in un altro file di questo tipo, senza dover aprire quel file come documento.

Scegli un **File di origine** dai tuoi file recenti (quello viene letto in sola lettura, mai aperto come documento) oppure compili **Manuale** con un id progetto, un id attività e una data di ancoraggio se non hai il file di origine a portata di mano. Poi scegli la **Direzione** (predecessore o successore), il **Tipo di relazione** (FS/SS/FF/SF) e un **Ritardo**. La **Data di ancoraggio** — la data dell'attività di origine nel momento in cui l'hai collegata — è congelata nel tuo file; quella data non segue automaticamente se il progetto di origine cambia.

Vuoi sapere se il file di origine è stato aggiornato nel frattempo? Vai alla scheda **Relazioni**, sezione **Collegamenti esterni**, e fai clic su **Aggiorna questo collegamento** (per collegamento) o **Aggiorna ancoraggi esterni** (tutti insieme) per rileggere il file di origine e aggiornare l'ancoraggio. Se il file di origine non è disponibile — spostato, rinominato o mai distribuito — il collegamento mostra l'etichetta **obsoleto** con il tooltip "origine non caricata — reimporta per aggiornare": l'app allora non può verificare da sola se l'ancoraggio congelato è ancora valido.

Il grande esempio dimostra deliberatamente esattamente quest'ultimo percorso: l'attività "Bestrating parkeerterrein" (pavimentazione dell'area parcheggio) è collegata a un file di origine di un subappaltatore di opere esterne che deliberatamente *non* viene distribuito con l'esempio. Apri l'attività e vedrai il collegamento elencato con lo stato "obsoleto" — una dimostrazione onesta di cosa succede quando un file di origine esterno non è più disponibile, invece di un collegamento che si aggiorna sempre perfettamente.

## Tracciare un percorso

Vuoi vedere esattamente quali attività influenzano una data attività a monte e a valle? Fai clic destro sull'attività e scegli **Traccia percorso** (o **Interrompi tracciamento** per disattivarlo di nuovo) — questo evidenzia in un colpo solo l'intera catena di predecessori e successori. Per un lavoro più mirato, la barra multifunzione (scheda **Pianificazione** o **Relazioni**, gruppo della barra multifunzione **Tracciamento percorso**) ha una coppia di pulsanti separata **Predecessori**/**Successori**: entrambi disattivati non mostra nulla, uno attivo mostra quella singola direzione, entrambi attivi è uguale al comando del menu contestuale. Il tracciamento distingue anche tra tutte le attività logicamente collegate e le attività che stanno effettivamente **determinando** la data (la stessa relazione "Determinante" mostrata nella tabella delle relazioni) — così vedi non solo cosa è collegato, ma cosa sta effettivamente guidando.

## Impostazioni di calcolo

La sezione **Calcolo** in **Info progetto** (Backstage → Info progetto, o la finestra **Informazioni sul progetto**) raccoglie le opzioni di calcolo che appartengono a questo particolare progetto — appartengono al file, non all'app, quindi un collega che apre lo stesso file ottiene lo stesso risultato:

- **Definizione di critico** — **Margine totale ≤ soglia** (soglia predefinita 0) o **Percorso più lungo**, che contrassegna le attività come critiche in base alla catena più lunga attraverso la rete, indipendentemente dal loro numero di margine.
- **Calcolo del margine** — come viene determinato il margine totale per un'attività con sia un lato di inizio sia uno di fine: **Minimo (inizio/fine)** (predefinito), **Margine di inizio** o **Margine di fine**.
- **Attività a estremità aperta critiche** — tratta automaticamente come critiche le attività senza successore.
- **Contrassegna quasi critico** con **Soglia** (vedi sopra).
- **Percorsi di margine multipli** con **Metodo** e **Percorsi max.** (vedi sopra).
- **Calendario del ritardo** — quale calendario usa un ritardo in giorni lavorativi: quello del **Predecessore**, del **Successore**, sempre **24 ore**, oppure il **Calendario di progetto**.

## Continua a leggere

- Vedi più percorsi critici, lavoro quasi critico, un hammock, un blocco rigido e un collegamento esterno tutti in una pianificazione: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Relazioni, ritardo/anticipo e vincoli (incluso il blocco rigido) sono spiegati più in profondità nella guida [Relazioni e vincoli](docs://gids-relaties-constraints).
- Il livellamento può cambiare la struttura del percorso critico — leggi la guida [Risorse, istogramma e livellamento](docs://gids-resources-histogram).
- Il progresso e una data di stato possono produrre margine negativo su un'attività già fissata — leggi la guida [Baseline e avanzamento](docs://gids-baselines-voortgang).
