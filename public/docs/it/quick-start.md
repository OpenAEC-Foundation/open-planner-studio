# La tua prima pianificazione in 10 minuti

Questa guida ti porta, in circa 10 minuti, da un progetto vuoto a una pianificazione edilizia completamente calcolata: aggiungere attività, costruire una struttura delle attività, aggiungere relazioni, calcolare e salvare. Nessuna teoria in anticipo — semplicemente lo fai, passo dopo passo, usando esattamente i pulsanti e i menu che trovi in Open Planner Studio.

## Cosa farai

1. Creare un nuovo progetto.
2. Aggiungere attività — tramite la barra multifunzione, la tabella delle attività e il diagramma di Gantt.
3. Mettere le attività in una struttura (WBS) tramite il rientro.
4. Aggiungere relazioni tra le attività.
5. Calcolare la pianificazione.
6. Leggere il risultato: percorso critico e margine.
7. Salvare.

Preferisci prima vedere dove stai andando? Apri il progetto di esempio [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) tramite **File → Esempi**. (I nomi di esempio sono mostrati in olandese, come inclusi con il progetto.) È una pianificazione piccola e facile da leggere che mostra già quasi ogni passaggio qui sotto — comoda da tenere aperta accanto a questo articolo per confronto.

Tutto ciò che segue funziona in modo identico nell'app desktop e nella versione browser: stessi pulsanti, stessi menu, stesse scorciatoie.

## Passo 1 — Crea un nuovo progetto

1. Fai clic sulla scheda della barra multifunzione **File**. Si apre la schermata dei file.
2. Fai clic su **Nuovo** (oppure usa la scorciatoia **Ctrl+N** se stai già lavorando in un altro progetto). Appare la finestra di dialogo **Nuovo progetto**.
3. Inserisci un **Nome del progetto**, ad esempio "La mia prima pianificazione", e controlla la **Data di inizio** — è predefinita a oggi.
4. Per **Modello di fasi**, scegli **Vuoto**. I modelli **Edilizia residenziale** ed **Edilizia non residenziale / ristrutturazione** impostano già per te alcune attività di fase, ma per questo esercizio costruirai tutto tu stesso in modo da riconoscere ogni passaggio.
5. Lascia le opzioni del calendario ai valori predefiniti e fai clic su **Crea**.

Ora hai un progetto vuoto: una tabella delle attività vuota a sinistra, un diagramma di Gantt vuoto a destra e un calendario di lavoro già impostato dalle impostazioni predefinite.

## Passo 2 — Aggiungi attività

Assicurati di essere sulla scheda della barra multifunzione **Home**. Questa scheda mostra la tabella delle attività (sinistra) e il diagramma di Gantt (destra) affiancati — due viste della stessa pianificazione, così un'attività che aggiungi appare in entrambi i posti contemporaneamente.

### Tramite la barra multifunzione

1. Nel gruppo della barra multifunzione **Attività**, fai clic sul pulsante **Attività**. Appare una nuova attività chiamata "Nuova attività", con una durata di 5 giorni lavorativi, in fondo sia alla tabella delle attività sia al diagramma di Gantt.
2. Ripeti questo alcune volte finché non hai un'attività per ogni fase principale del tuo progetto. Se stai seguendo il progetto di esempio, usa le stesse fasi principali che usa esso: "1. Voorbereiding" (Preparazione), "2. Fundering & ruwbouw" (Fondazione e struttura grezza), "3. Afbouw" (Finiture) e "4. Oplevering" (Consegna).
3. Fai doppio clic su un'attività — nella tabella o sulla sua barra nel diagramma di Gantt — per aprire la finestra **Modifica attività**. Adatta il **Nome**, il **Tipo** e la **Durata (giorni lavorativi)** alla tua fase.

### Tramite la tabella delle attività e il diagramma di Gantt

Non devi continuare a tornare alla barra multifunzione. Fai clic destro su una **riga vuota** nella tabella delle attività, oppure su un punto vuoto nel diagramma di Gantt (dove non c'è ancora un'attività), e scegli **Nuova attività** dal menu contestuale.

Fai invece clic destro su un'attività **esistente** e ottieni un menu contestuale diverso con, tra l'altro:

- **Inserisci sopra** / **Inserisci sotto** — aggiunge un'attività prima o dopo l'attività su cui hai fatto clic destro.
- **Aggiungi sottoattività** — crea una nuova attività come figlia di quell'attività in un solo passaggio (vedi il passo 3 per il significato).

Hai digitato qualcosa di sbagliato, o aggiunto un'attività nel posto sbagliato? **Ctrl+Z** annulla l'ultima azione, **Ctrl+Y** (o **Ctrl+Shift+Z**) la ripete — entrambe funzionano in tutta la pianificazione, non solo nei campi di testo.

### Aggiungi un traguardo

Ogni pianificazione ha bisogno di almeno un traguardo, ad esempio per la consegna. Nel gruppo della barra multifunzione **Attività**, fai clic sulla freccia accanto a **Traguardo** e scegli **Cardine di fine**, **Cardine di inizio** o **Punto di ispezione (obbligatorio)** — oppure usa la scorciatoia **Ctrl+M** per un traguardo generico e rapido ("Nuovo traguardo") che rinomini in seguito.

## Passo 3 — Costruisci una struttura delle attività (WBS)

Un elenco piatto di attività diventa presto confuso. Rientrando le attività costruisci una struttura delle attività (WBS): l'attività sopra diventa allora automaticamente un'**attività di riepilogo** che copre l'intero periodo delle sue sottoattività.

1. Seleziona un'attività che deve stare sotto un'altra attività — ad esempio "Fundering aanbouw" (Fondazione dell'ampliamento) sotto l'attività di fase "2. Fundering & ruwbouw" (Fondazione e struttura grezza).
2. Premi **Alt+→** per rientrare, oppure fai clic destro e scegli **Rientra** dal menu contestuale. L'attività sopra diventa immediatamente visibile come attività di riepilogo.
3. Sei andato troppo lontano, o vuoi riportare un'attività al livello superiore? Usa **Alt+←**, oppure fai clic destro e scegli **Rimuovi rientro**.
4. Più veloce per una sottoattività del tutto nuova: fai clic destro sull'attività padre e scegli **Aggiungi sottoattività** — questo salta i passaggi separati di aggiunta e poi rientro.

Ripeti finché non sei sceso di qualche livello. Nel progetto di esempio, la fase "2. Fundering & ruwbouw" per esempio si scompone nelle sottoattività "Grondwerk aanbouw" (Movimento terra ampliamento), "Fundering aanbouw" (Fondazione ampliamento), "Begane grondvloer storten" (Getto del pavimento a piano terra), "Wanden opmetselen" (Muratura delle pareti) e "Dakconstructie plaatsen" (Posa della struttura del tetto).

Questo articolo copre la costruzione della WBS solo a livello pratico, per farti partire. Per sapere come i tipi di cardine, le attività di riepilogo e i codici attività lavorano insieme in dettaglio, leggi la guida [Pianificazione e WBS](docs://gids-plannen-wbs).

## Passo 4 — Aggiungi relazioni

Le attività senza relazioni sono indipendenti l'una dall'altra e non si spostano quando cambi un'attività precedente. Una relazione (dipendenza) collega due attività tra loro.

1. Assicurati che le barre delle due attività che vuoi collegare siano visibili nel diagramma di Gantt.
2. Tieni premuto **Shift** e trascina dalla barra del predecessore alla barra del successore. Non appena rilasci, viene creata immediatamente una relazione **Finish-Start (FS)** con un ritardo di 0 giorni lavorativi — la relazione più comune: il successore inizia solo quando il predecessore è terminato.
3. Subito dopo il rilascio, appare la finestra **Tipo di relazione**. Qui puoi cambiare il tipo di relazione (**FS**, **SS**, **FF** o **SF**) e inserire un **ritardo**, ad esempio `2d` per due giorni lavorativi di attesa tra le attività. In breve: con **FS** (Finish-Start) il successore inizia dopo che il predecessore termina, con **SS** (Start-Start) entrambe le attività iniziano (all'incirca) nello stesso momento, con **FF** (Finish-Finish) terminano (all'incirca) nello stesso momento, e con **SF** (Start-Finish) il predecessore deve iniziare prima che il successore possa terminare — quest'ultimo è il meno comune nella pratica edilizia.
4. Preferisci collegare due attività senza trascinare? Vai alla scheda della barra multifunzione **Relazioni** (oppure fai clic su **Gestisci** nel gruppo della barra multifunzione **Relazioni** sulla scheda Pianificazione), seleziona prima il predecessore, poi (tenendo premuto Ctrl/Cmd) il successore, e usa il pulsante **Nuova relazione dalla selezione** — quel pulsante funziona solo quando sono selezionate esattamente due attività, in quell'ordine.

Per l'esercizio, aggiungi almeno due relazioni: ad esempio "1. Voorbereiding" → "2. Fundering & ruwbouw" e "2. Fundering & ruwbouw" → "3. Afbouw".

## Passo 5 — Calcola

Ora che hai attività e relazioni, puoi far calcolare la pianificazione (CPM — Critical Path Method).

1. Premi **F5**, oppure fai clic sul pulsante **Calcola** nel gruppo della barra multifunzione **Pianificazione**.
2. Open Planner Studio ora calcola, per ogni attività, le date di inizio e fine più anticipate e più posticipate, il margine, e quali attività si trovano sul percorso critico.
3. Non vuoi più pensare a F5? Attiva **Calcola automaticamente** in **Impostazioni**. La pianificazione si ricalcola allora da sola non appena diventa obsoleta, invece di attendere una pressione manuale di F5.

## Passo 6 — Leggi il risultato

- In fondo allo schermo, la barra di stato mostra ad esempio "Percorso critico: 4 attività, 62 giorni lavorativi" una volta calcolata la pianificazione. Se hai cambiato qualcosa dall'ultimo calcolo, mostra invece "Non aggiornato — ricalcola (F5)".
- Nel diagramma di Gantt, le attività critiche — attività senza margine, che quindi determinano direttamente la data di fine del progetto — ottengono un colore di barra diverso rispetto alle attività che hanno ancora spazio (margine). Se un'attività critica ritarda, l'intera data di fine progetto si sposta con essa; un'attività con margine può ritardare senza conseguenze, finché il margine non è esaurito.
- Fai doppio clic su un'attività per riaprire la finestra **Modifica attività**. Nella sezione **Risultato CPM** trovi, per attività: **Inizio anticipato**, **Fine anticipata**, **Inizio posticipato**, **Fine posticipata**, **Margine totale**, **Margine libero**, e se l'attività si trova sul **Percorso critico**.
- Vuoi questi dati anche come colonne nella tabella delle attività, invece di dover aprire ogni attività? Vai alla scheda della barra multifunzione **Vista**, fai clic su **Colonne…** nel gruppo **Visualizzazione**, e seleziona **Critica** e **Margine totale**.

## Passo 7 — Salva

1. Premi **Ctrl+S**, oppure fai clic su **Salva** nella scheda **File**. La prima volta, Open Planner Studio chiede un nome file e una posizione; il progetto viene salvato come file IFC nativo.
2. Vuoi invece mantenere una copia con un nome diverso, ad esempio per tenere due varianti fianco a fianco? Usa **File → Salva come** (scorciatoia **Ctrl+Shift+S**).

## Continua a esercitarti

- Ripeti i passaggi sopra con un esempio completo: apri [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) tramite **File → Esempi** e riconosci la catena FS tra le fasi, la sovrapposizione SS tra il lavoro di muratura e la struttura del tetto, il collegamento FF tra le piastrelle e il lavoro di pittura, e il vincolo del permesso (SNET) prima dell'inizio.
- Vuoi saperne di più sulla struttura delle attività, le attività di riepilogo, i tipi di cardine e i codici attività? Leggi la guida [Pianificazione e WBS](docs://gids-plannen-wbs).
- Preferisci fare un tour visivo delle aree principali dello schermo? Riavvia il tour tramite la scheda **Vista** → pulsante **Tour**, oppure tramite **File** → **Avvia tour**.
