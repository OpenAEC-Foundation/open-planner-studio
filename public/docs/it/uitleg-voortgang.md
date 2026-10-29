# Avanzamento, data di stato e baseline

Una pianificazione è una previsione. Quando il lavoro è iniziato, vuoi sapere che cosa è finito, che cosa resta da fare e che cosa significa per la consegna. Questo articolo spiega come l'app elabora l'avanzamento: che cosa fa la data di stato, come l'app calcola il lavoro rimanente, perché un'attività già iniziata a volte aspetta ancora il suo predecessore, e come confronti lo stato attuale con l'accordo originale. Un esempio svolto mostra i numeri.

## Il concetto

**Avanzamento** è ciò che è realmente successo. Per ogni attività l'app registra tre cose: una percentuale, un **inizio effettivo** e una **fine effettiva**. Ciò che la pianificazione prevedeva resta accanto a questi dati; l'effettivo è ciò che è realmente accaduto.

La **data di stato** è il giorno in cui fai il bilancio. Tutto ciò che è successo prima di quel giorno è un fatto. Tutto ciò che deve ancora succedere, l'app lo pianifica a partire dall'inizio di quel giorno. Una data effettiva può cadere il giorno della data di stato, ma mai dopo.

Il **lavoro rimanente** è ciò che resta da fare su un'attività. Un'attività di 4 giorni lavorativi con un completamento del 25% ha 3 giorni lavorativi di lavoro rimanente.

Una **baseline** è un'istantanea della pianificazione in un certo momento, di solito il momento in cui è stato approvato l'accordo. Più tardi affianchi la pianificazione effettiva a questa baseline e vedi quanto l'esecuzione si discosta.

## Come l'app calcola

L'esempio qui sotto usa il profilo di calcolo *Open Planner Studio*, con cui l'app calcola un nuovo progetto. Più avanti puoi leggere che cosa cambia nei profili Primavera P6 e Microsoft Project.

L'app non ricalcola da sola. Dopo ogni modifica di avanzamento o della data di stato, la barra di stato mostra *Non aggiornato — ricalcola (F5)*. Premi **Calcola** (F5), per esempio tramite *Pianificazione › Pianificazione › Calcola*. Se *Calcola automaticamente* è attivo (sotto *Impostazioni › Progetto › Impostazioni app*, scheda *Pianificazione*, intestazione *Calcolo*), l'app lo fa da sola.

### La data di stato

La data di stato fa tre cose.

Per prima cosa, l'app rifiuta una data effettiva dopo la data di stato. Una data uguale alla data di stato va bene.

In secondo luogo, un'attività non ancora iniziata non può trovarsi nel passato. Se un'attività del genere è pianificata prima della data di stato, l'app la sposta alla data di stato. Questo vale anche per le attività che seguono, che si spostano con lei tramite le relazioni. Vedi l'effetto nell'esempio qui sotto. Nel profilo Microsoft Project l'app non lo fa.

In terzo luogo, il lavoro rimanente di un'attività già in corso inizia proprio alla data di stato. L'app tratta la data di stato come inizio di quel giorno. Se fai il bilancio venerdì dopo l'orario di lavoro, imposti quindi la data di stato a lunedì. Se la imposti a venerdì, l'app pianifica comunque il lavoro rimanente di quel venerdì.

Se non hai ancora una data di stato e inserisci avanzamento, l'app imposta la data di stato a oggi e te lo segnala. Imposti un'altra data in *Pianificazione › Baseline e progresso › Data di stato*. Senza data di stato l'app calcola un'attività in corso in avanti con la sua durata rimanente, ma all'indietro con la sua durata completa; il margine risulta poi negativo e l'attività sembra critica senza motivo.

### Percentuale, date effettive e durata rimanente

I campi dipendono l'uno dall'altro. Se ne compili uno, l'app compila gli altri.

- Una percentuale superiore a 0 vuol dire che l'attività è iniziata. Se non indichi un inizio effettivo, l'app prende l'inizio pianificato. Se l'attività è pianificata per iniziare dopo la data di stato, l'app ti chiede prima quando è iniziata davvero.
- Una percentuale di 100 vuol dire completata. Se non indichi una fine effettiva, diventa la data di stato, anche se il lavoro in realtà era finito prima.
- Una fine effettiva rende l'attività al 100%. Se riporti un'attività completata sotto il 100%, la fine effettiva viene eliminata. Se cancelli la fine effettiva, la percentuale torna a 0 e l'attività resta *In corso* finché non cancelli anche l'inizio effettivo.
- La **durata rimanente** è la durata moltiplicata per ciò che resta da fare, arrotondata a giorni lavorativi interi. Per un'attività di 2 giorni lavorativi, 0% e 25% danno entrambi 2 giorni lavorativi di lavoro rimanente, e 50% e 75% danno entrambi 1. Al 90% l'app arrotonda a 0: il lavoro rimanente è quindi finito alla data di stato. Un'attività espressa in ore si calcola in minuti interi: un'attività di 5 ore al 40% ha 3 ore di lavoro rimanente.
- Un cardine ha solo una data effettiva.
- Una fase (attività di riepilogo) non ha un avanzamento proprio. Dopo il calcolo, la sua percentuale segue dalle attività sotto di essa: la media ponderata delle loro percentuali, con la durata in giorni lavorativi come peso. Un cardine pesa 0.

Se modifichi la durata di un'attività già in corso, il lavoro svolto resta svolto. La percentuale si adatta: un'attività di 5 giorni lavorativi al 60% che imposti a 10 giorni lavorativi finisce al 30%. L'app rifiuta una durata più corta del lavoro già svolto.

### Attività completate e in corso

Un'attività completata è fissa sulle sue date effettive. Non si sposta più e, con una data di stato, non è mai critica. Senza data di stato un'attività completata può ancora essere critica.

Un'attività in corso mantiene il suo inizio effettivo. Si sposta solo il lavoro rimanente. Dove inizia il lavoro rimanente dipende dalla modalità di progresso.

### Retained Logic e Progress Override

Che cosa fa l'app se un'attività è già iniziata mentre il suo predecessore è ancora in corso? Una relazione così si chiama **avanzamento fuori sequenza**: l'avanzamento contraddice l'ordine. Pensa al pittore che inizia già in una stanza intonacata, mentre l'intonacatore è ancora occupato altrove.

Due modalità di progresso decidono come l'app calcola in quel caso:

- **Retained Logic** (predefinita): la relazione resta in vigore. Il lavoro rimanente del successore segue la relazione: con fine-inizio inizia solo quando il predecessore è finito, e mai prima della data di stato.
- **Progress Override**: vince la realtà. Il lavoro rimanente del successore inizia alla data di stato, senza aspettare il predecessore.

In questo profilo la differenza sta solo nel lavoro rimanente delle attività già iniziate mentre il loro predecessore non è ancora finito. Le altre attività si calcolano allo stesso modo in entrambe le modalità. L'app segnala questa relazione in entrambe le modalità: nella barra di stato come *Relazioni fuori sequenza: 1* e nel pannello *Avvisi*.

### Baseline e scostamento

Quando salvi, l'app registra per ogni attività senza sottoattività l'inizio anticipato, la fine anticipata, la durata e il tipo di cardine. Le fasi non sono incluse. Ciò che cambi dopo non tocca la baseline. Puoi tenere più baseline; una sola è **attiva**. Il Gantt, il rapporto variance e il rapporto di avanzamento usano la baseline attiva.

Lo **scostamento** è la differenza in giorni lavorativi tra la baseline e la pianificazione attuale. Un segno più vuol dire più tardi, un segno meno più presto. L'app conta nel calendario di progetto. Il rapporto variance dà lo scostamento di inizio e di fine per attività. Lo stato dipende solo dalla fine: *Più tardi* per un più, *Più presto* per un meno, altrimenti *Nei tempi*. Un'attività aggiunta dopo la baseline si chiama *Nuova*; un'attività che non esiste più è *Eliminata*.

Due osservazioni. Lo scostamento di durata si trova nella tabella attività (colonna *Scostamento durata*), non nel rapporto variance. Confronta la durata pianificata dell'attività ora con quella nella baseline. L'avanzamento non cambia quella durata pianificata: un'attività pianificata a due giorni che ne ha richiesti tre ha quindi uno scostamento fine di +1, ma uno scostamento di durata di 0. E se salvi una baseline dopo aver inserito avanzamento, registra lo stato con quelle date effettive; lo scostamento è allora zero.

Il rapporto di avanzamento mette l'avanzamento pianificato accanto a quello effettivo. Entrambi sono ponderati per giorni lavorativi. Pianificato è la parte di ogni attività che secondo la baseline avrebbe dovuto essere finita alla data di stato; effettivo è la percentuale che è stata inserita.

### Dove lo vedi

Nel Gantt una linea tratteggiata segna la data di stato, con la data nell'intestazione. Su ogni attività in corso la linea si incurva fino al punto della barra che indica la percentuale. Questa è la **linea di avanzamento**. Se spegni la linea di avanzamento e lasci accesa la linea della data di stato, resta una linea retta; con entrambe spente scompaiono la linea e l'etichetta. I pulsanti *Sovrapposizione della baseline*, *Linea di avanzamento* e *Linea data di stato* si trovano sotto *Vista › Baseline e progresso* e non cambiano nulla nel calcolo. La baseline appare come una barra sottile sotto ogni barra attività. La tabella attività ha colonne per l'avanzamento e, per ogni baseline, per lo scostamento. Nella scheda *Rapporto* trovi i tipi di report *Variance* e *Rapporto di avanzamento*.

## Esempio svolto: l'estensione dopo tre settimane

L'esempio è il progetto di esercitazione *House extension* dei tutorial, nello stato dopo che sono state aggiunte tutte le relazioni: senza ferie edili, risorse o ore. Nel tutorial 6 fai questo da solo nel progetto di esercitazione. Quel progetto ha allora più dati, quindi i numeri lì sono diversi. Qui leggi perché i numeri sono quelli che sono.

L'estensione inizia lunedì 7 giugno 2027. Sulla pianificazione calcolata l'app salva una baseline chiamata *Baseline*: consegna venerdì 6 agosto 2027, 45 giorni lavorativi.

### Lo stato lunedì 28 giugno

La data di stato è lunedì 28 giugno 2027. Questo è ciò che è successo:

- *Start of construction*, *Set up site*, *Clear garden and paving* e *Set out the extension* sono finite secondo il piano, dal 7 al 10 giugno.
- *Excavate foundation trench* era pianificata per 2 giorni lavorativi (venerdì 11 e lunedì 14 giugno) e ne ha richiesti 3: dall'11 al 15 giugno.
- *Foundation formwork and reinforcement* va dal 16 al 18 giugno. *Reinforcement inspection* è il 18 giugno, *Pour foundation* lunedì 21 giugno.
- *Foundation brickwork* (2 giorni lavorativi) è iniziata venerdì 25 giugno ed è al 50%.

Dopo **Calcola** l'app lo calcola così:

- Il lavoro rimanente dell'attività foundation brickwork è 2 × (1 − 0,5) = 1 giorno lavorativo. Inizia alla data di stato, quindi finisce lunedì 28 giugno.
- *Lay hollow-core floor* segue martedì 29 giugno. Di conseguenza *Build inner cavity leaf* inizia mercoledì 30 giugno invece di martedì 29 giugno. La consegna arriva lunedì 9 agosto: un giorno lavorativo più tardi della baseline. Il giorno in più di scavo è quindi lo slittamento di tutto il progetto, perché quell'attività era sul percorso critico.
- La barra di stato segnala *Percorso critico: 13 attività, 46 giorni lavorativi*, rispetto a 21 attività e 45 giorni lavorativi prima dell'avanzamento. Le otto attività completate che erano sul percorso critico non contano più.
- La fase *Foundations* è al 77,8%. Le attività al suo interno pesano 2 + 3 + 1 + 2 + 1 = 9 giorni lavorativi. Finiti sono 2 + 3 + 1 giorni lavorativi, più metà di 2: in totale 7. E 7 su 9 è 77,8%. Il cardine *Reinforcement inspection* pesa 0.

Il rapporto variance mette questo accanto alla baseline:

- *Excavate foundation trench*: inizio 0, fine +1 (fine della baseline 14 giugno, ora 15 giugno).
- *Foundation brickwork*: inizio +1 (24 giugno è diventato 25 giugno), fine +1.
- *Build outer cavity leaf*: +1, +1. Quell'attività non è ancora critica: aveva 2 giorni lavorativi di margine e li conserva.
- *Handover*: +1. Lo scostamento della fine del progetto è di 1 giorno lavorativo.
- In totale 19 attività sono *Più tardi* e 4 *Nei tempi*; nessuna è *Più presto*.

Il rapporto di avanzamento mostra *Pianificato* 28,3% e *Effettivo* 23,9%. Le attività pesano insieme 46 giorni lavorativi. Secondo la baseline 13 dovevano essere finiti: 4 giorni lavorativi nella preparazione, 2 per lo scavo, 3 per l'armatura, 1 per il getto, 2 per la muratura di fondazione e 1 per il solaio alveolare. Effettivamente ne sono finiti 11: 4 + 2 + 3 + 1, più la mezza giornata della muratura di fondazione.

### Cosa succede se sposti la data di stato?

Lo stesso avanzamento, una data di stato diversa. Il lavoro rimanente di foundation brickwork inizia sempre alla data di stato, quindi la consegna si sposta con lei:

- Data di stato venerdì 25 giugno: il lavoro rimanente cade venerdì 25 giugno, la consegna resta venerdì 6 agosto.
- Lunedì 28 giugno: consegna lunedì 9 agosto.
- Martedì 29 giugno: consegna martedì 10 agosto, 2 giorni lavorativi più tardi della baseline.

### Cosa succede se cambi la percentuale?

L'attività foundation brickwork ha 2 giorni lavorativi. Al 0% o al 25% il lavoro rimanente è di 2 giorni lavorativi: finisce martedì 29 giugno e la consegna diventa martedì 10 agosto. Al 50% o al 75% è di 1 giorno lavorativo: lunedì 28 giugno, consegna lunedì 9 agosto. Al 90% il lavoro rimanente è 0 e l'attività finisce alla data di stato.

### Cosa succede se imposti una data di stato senza inserire avanzamento?

Se imposti solo la data di stato a lunedì 28 giugno e non inserisci nulla, secondo la pianificazione non è ancora successo niente. Un'attività non ancora iniziata non può trovarsi nel passato. L'app quindi sposta tutto al 28 giugno: *Start of construction* è allora in quel giorno, e la consegna arriva venerdì 27 agosto, 15 giorni lavorativi dopo la baseline. Inserisci quindi prima l'avanzamento che esiste.

## Esempio pratico: intonacatore e pittore

Ora un esempio per la modalità di progresso. Stesso ampliamento, uno stato diverso: è mercoledì 21 luglio 2027. Tutto fino a *Install building services* incluso è terminato secondo il piano. L'attività *Plastering* (4 giorni lavorativi) è iniziata martedì 20 luglio ed è al 25%. *Painting* (3 giorni lavorativi) segue l'attività Plastering, ma il pittore ha già iniziato oggi ed è al 33%.

Senza avanzamento l'attività Plastering era pianificata da martedì 20 a venerdì 23 luglio, e l'attività Painting da lunedì 26 a mercoledì 28 luglio. La barra di stato ora mostra *Relazioni fuori sequenza: 1*: l'attività Painting è iniziata mentre l'attività Plastering non è terminata. Nel pannello *Avvisi* si legge: *Fuori sequenza: l'avanzamento del successore contraddice la relazione*.

L'attività Plastering ha 4 × (1 − 0,25) = 3 giorni lavorativi di lavoro rimanente: 21, 22 e 23 luglio. L'attività Painting ha 3 × (1 − 0,33) = 2 giorni lavorativi di lavoro rimanente.

- Con **Retained Logic** quel lavoro rimanente può iniziare solo quando l'attività Plastering è terminata. Ciò avviene venerdì 23 luglio, quindi l'attività Painting inizia lunedì 26 luglio e termina martedì 27 luglio. La barra va dall'inizio effettivo del 21 luglio fino al 27 luglio. Il margine totale è di 7 giorni lavorativi.
- Con **Progress Override** il lavoro rimanente inizia alla data di stato. L'attività Painting termina giovedì 22 luglio, prima che l'attività Plastering sia terminata. Il margine totale è di 10 giorni lavorativi.

La consegna resta venerdì 6 agosto in entrambi i casi: l'attività Painting aveva comunque margine.

### Altri profili di calcolo

Nei profili Primavera P6 e Microsoft Project l'attività Painting in questo esempio termina nelle stesse date (27 e 22 luglio). Differiscono sui punti seguenti. Si tratta di convenzioni del profilo; le trovi sotto *Impostazioni › Progetto › Impostazioni progetto*, nel blocco *Profilo di calcolo e opzioni*.

- Nel profilo Microsoft Project un'attività non ancora iniziata non si sposta alla data di stato (convenzione *Non spostare le attività non iniziate alla data di stato*). Se nell'esempio sopra imposti solo una data di stato e non inserisci nulla, la consegna in quel profilo resta venerdì 6 agosto.
- Nel profilo Microsoft Project anche il lavoro rimanente non inizia prima dell'inizio effettivo più la durata già trascorsa (convenzione *Il lavoro rimanente riprende dopo la durata trascorsa*). Questo è un limite inferiore in più, oltre alla data di stato: vale la più tarda delle due. Prendi *Build inner cavity leaf* (5 giorni lavorativi), iniziata martedì 29 giugno e al 40% mercoledì 30 giugno, data di stato (due squadre fanno la muratura nello stesso momento, quindi il 40% è già fatto dopo un giorno). Tutto ciò che precede è terminato secondo il piano. Open Planner Studio e Primavera P6 fanno terminare l'attività venerdì 2 luglio; Microsoft Project lunedì 5 luglio, perché martedì 29 giugno più 2 giorni lavorativi trascorsi è giovedì 1 luglio, dopo la data di stato.
- Primavera P6 mostra come inizio anticipato di un'attività in corso l'inizio del lavoro rimanente, non l'inizio effettivo (nell'esempio dell'inner-leaf mercoledì 30 giugno). La colonna *Inizio* e la barra mostrano l'inizio effettivo in ogni profilo.
- Nel profilo Primavera P6, con Progress Override, anche la relazione con un successore già iniziato non conta per il predecessore: non limita più le sue date più tarde e il suo margine libero (convenzione *Progress Override ignora anche all'indietro un successore iniziato*). Nell'esempio dell'intonacatore e del pittore non lo vedi, perché l'attività Plastering è comunque critica tramite il massetto: le sue date più tarde e il suo margine libero sono uguali con Retained Logic e con Progress Override.
- Quando apri un file .xer, l'app prende la modalità di progresso dal file. Actual Dates, la terza modalità di P6, non è nota all'app; un file del genere viene calcolato come Retained Logic.

## Conseguenze e malintesi

**«Sposto semplicemente la data di stato in avanti.»** Se la sposti, il lavoro rimanente delle attività in corso inizia alla nuova data, e un'attività non ancora iniziata non può mai trovarsi prima di quella data. Sposta quindi la data di stato solo insieme a un aggiornamento dell'avanzamento.

**«Inserire il 100% registra la fine effettiva.»** Solo se inserisci anche la fine effettiva. Se imposti un'attività al 100% senza fine effettiva, la sua fine diventa la data di stato. Se in realtà è terminata prima, inserisci la fine effettiva.

**«0% vuol dire non iniziata.»** Se un'attività ha un inizio effettivo, conta come iniziata, anche allo 0%. Il lavoro rimanente è allora l'intera durata e inizia alla data di stato. Cancella l'inizio effettivo, così conta di nuovo come non iniziata.

**«Progress Override risolve l'avviso.»** L'avviso sull'avanzamento fuori sequenza resta. La modalità decide solo come calcola l'app. Se la relazione non è più corretta, cambia la relazione.

**«La pausa in un'attività in modalità divisione scompare.»** No: una pausa nella parte ancora da fare resta nel lavoro rimanente. Prendi un'attività di 5 giorni lavorativi con una pausa di 1 giorno dopo 2 giorni di lavoro, iniziata martedì 29 giugno e, con data di stato mercoledì 30 giugno, al 40%. Il lavoro rimanente di 3 giorni lavorativi inizia alla data di stato e attraversa la pausa: la fine è lunedì 5 luglio. Senza la pausa la fine era venerdì 2 luglio.

**Ore e data di stato.** Non puoi inserire un orario nella barra multifunzione: inserisci la data di stato come data. Se fai il bilancio dopo l'orario di lavoro, imposta la data di stato sul giorno lavorativo successivo. Un'attività in ore calcola il lavoro rimanente dall'inizio della data di stato. Prendi *Lay hollow-core floor* nel progetto di prova dopo il tutorial 4, nel momento in cui tutto ciò che la precede è terminato: 5 ore, lunedì 28 giugno, giorno lavorativo dalle 07:00. Con la data di stato lunedì 28 giugno e l'attività al 40%, ha 3 ore di lavoro rimanente, dalle 07:00 alle 10:00, anche se quella mattina è già stato fatto del lavoro. Come l'app conta le ore è spiegato in [Giorni e ore](docs://uitleg-dagen-en-uren).

**Aggiornare una baseline.** Non è possibile. Salvi una nuova baseline ed elimini quella vecchia. Se sposti il progetto, le date effettive e la data di stato vengono spostate insieme, ma le baseline per impostazione predefinita non vengono spostate: così lo spostamento resta visibile come scostamento. Vedi [Spostare un progetto](docs://howto-project-verplaatsen).

## Vedi anche

- [Aggiornare l'avanzamento](docs://howto-voortgang-bijwerken): impostare la data di stato e inserire l'avanzamento.
- [Importare l'avanzamento da un foglio di calcolo](docs://howto-voortgang-importeren): leggere in una volta l'avanzamento dal personale di cantiere.
- [Scegliere la modalità di progresso](docs://howto-voortgangsmodus-kiezen): impostare Retained Logic o Progress Override.
- [Salvare e gestire una baseline](docs://howto-baseline-opslaan-en-beheren): registrare una baseline e usarla.
- [Spostare un progetto](docs://howto-project-verplaatsen): che cosa succede alle date effettive, alla data di stato e alle baseline.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): perché un'attività è critica e che cosa significa margine.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): avanzamento e una data di stato a metà progetto (20 maggio 2027).
