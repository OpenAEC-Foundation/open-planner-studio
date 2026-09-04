# Pianificazione e WBS

Una pianificazione inizia con una struttura delle attività: quali attività esistono, come sono suddivise in fasi, e quali momenti sono abbastanza importanti da meritare un traguardo? Questa guida approfondisce quella base più della guida [Avvio rapido](docs://quick-start) — qui imparerai non solo *come* rientrare, ma anche cosa fa realmente un'attività di riepilogo, come differiscono i tre tipi di cardine, come dare alle attività i propri codici e campi, e come tenere note per attività.

## Cosa imparerai qui

- Costruire una struttura delle attività (WBS) usando il rientro e le attività di riepilogo.
- Spostare attività all'interno dello stesso livello, senza rientrare di nuovo — con la tastiera,
  trascinando, o nella scheda **Tabella**, in stile foglio di calcolo.
- I tre tipi di cardine e il flag obbligatorio separato per i momenti contrattuali.
- Gestire i codici attività e i campi personalizzati tramite la finestra **Codici e campi**, e raggrupparli.
- Usare le note (una checklist per attività) per tenere traccia degli elementi aperti.

Preferisci seguire con un esempio completo? Apri [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) tramite **File → Esempi** — la suddivisione in fasi "1. Voorbereiding" (Preparazione) / "2. Fundering & ruwbouw" (Fondazione e struttura grezza) / "3. Afbouw" (Finiture) / "4. Oplevering" (Consegna) con le sue sottoattività è esattamente la struttura spiegata sotto.

## Costruire una struttura delle attività

Un elenco piatto di attività non dice nulla su come si relazionano. Rientrando un'attività sotto un'altra attività, costruisci una struttura ad albero (WBS — Work Breakdown Structure): l'attività padre diventa allora automaticamente un'**attività di riepilogo**.

1. Seleziona l'attività che vuoi posizionare più in profondità nella struttura.
2. Premi **Alt+→** per rientrare. Esiste una seconda scorciatoia per la stessa azione: **Alt+Shift+→** — comoda se la tua disposizione della tastiera usa già Alt+→ per qualcos'altro. Entrambe fanno esattamente la stessa cosa.
3. Preferisci lavorare con il mouse? Fai clic destro sull'attività e scegli **Rientra** dal menu contestuale.
4. Sei andato un livello troppo lontano? **Alt+←** (o clic destro → **Rimuovi rientro**) riporta l'attività indietro di un livello.
5. Per una sottoattività del tutto nuova c'è un percorso più veloce: fai clic destro sull'attività padre e scegli **Aggiungi sottoattività**. Questo crea una nuova attività, già rientrata, in un solo passaggio, invece di aggiungere prima un'attività e rientrarla separatamente in seguito.

Non appena un'attività ha almeno una sottoattività, diventa automaticamente un'attività di riepilogo: la sua barra nel diagramma di Gantt copre allora l'intero periodo dall'inizio più anticipato alla fine più posticipata di tutte le sottoattività sottostanti, e la sua propria durata e le sue date non possono più essere impostate in modo indipendente. Un'attività di riepilogo è quindi sempre un valore derivato, mai una pianificazione che inserisci direttamente — elimina o sposta le sottoattività, e la barra dell'attività di riepilogo si adatta automaticamente.

**Comprimi ed espandi.** Con una WBS grande, a volte vuoi rendere l'albero temporaneamente più compatto. La scheda della barra multifunzione **Vista**, gruppo **Struttura**, ha per questo due pulsanti separati — **Comprimi** ed **Espandi** — deliberatamente non un unico interruttore, perché con una selezione mista (alcuni rami aperti, altri chiusi) un interruttore non potrebbe mai impostare tutto nello stesso senso.

- **Con una selezione**, i pulsanti agiscono sulle attività selezionate; sono coinvolte solo le attività con sottoattività, le attività singole vengono ignorate.
- **Senza selezione**, agiscono sull'intera pianificazione. Deseleziona con **Esc**, oppure fai clic su un'area vuota della vista Gantt.
- In una vista raggruppata (vedi *Raggruppare per codici e campi* più avanti) i pulsanti comprimono/espandono le fasce di gruppo — comprese quelle annidate — invece delle attività.

La freccia davanti a un'attività di riepilogo continua comunque a funzionare come prima, per aprire o chiudere solo quel ramo.

### Inserire una nuova attività nel punto giusto

Le nuove attività non devono più finire in fondo. Tutti i pulsanti e i tasti che creano un'attività seguono la stessa regola:

- **Se un'attività è selezionata**, la nuova attività si inserisce direttamente **sotto** di essa, non in fondo all'intero elenco. Eredita il livello e l'attività superiore della selezione, quindi una nuova attività dentro una fase resta in quella fase.
- **Se non è selezionato nulla**, finisce in coda, come sempre.
- **Se sono selezionate più attività**, si posiziona sotto l'attività **più in basso** della selezione così come la vedi a schermo — mai in mezzo alla selezione, e l'ordine in cui le hai cliccate non conta.

Vale per il pulsante **Attività** e per il menu **Traguardo** nel gruppo della barra multifunzione **Attività**, e per **Nuova attività** nel menu contestuale. Quel gruppo è presente sia sulla scheda **Home** sia sulla scheda **Tabella**, con gli stessi tre pulsanti (**Attività**, **Traguardo**, **Collegamento**), così non devi più cambiare scheda per inserire attività.

Con la tastiera è ancora più rapido:

- **Ins** inserisce un'attività **sopra** la selezione.
- **Ctrl+I** (**Cmd+I** su macOS) inserisce un'attività **sotto** la selezione — di solito è lì che vuoi andare mentre scorri un elenco.

Entrambi compaiono anche nel riepilogo delle scorciatoie (**Ctrl+/**), nella categoria **Struttura**.

**Solo nella normale vista ad albero.** Inserire sopra o sotto è un intervento strutturale, e ha senso solo finché l'ordine mostrato è anche quello reale. Con un filtro, un ordinamento o un raggruppamento attivo, la nuova attività comparirebbe altrove rispetto a dove l'hai messa. L'app rifiuta allora l'inserimento sopra/sotto e mostra una striscia che spiega il perché, con un pulsante per azzerare filtro, ordinamento e raggruppamento in un clic. I pulsanti **Attività** e **Traguardo** continuano a funzionare in quel caso, ma mettono l'attività in fondo — con la stessa spiegazione.

### Spostare attività senza rientrare di nuovo

Oltre a cambiare il livello di un'attività (rientra/rimuovi rientro), puoi anche scambiare la posizione di un'attività all'interno dello stesso livello, senza cambiare la struttura stessa:

- **Alt+↑** sposta l'attività selezionata in alto, sopra l'attività attualmente sopra di essa.
- **Alt+↓** sposta l'attività in basso.

Questo funziona a qualsiasi livello dell'albero: sposta un'attività di fase, e tutte le sue sottoattività si spostano automaticamente con essa.

Preferisci il mouse? Afferra un'attività dalla sua riga nella tabella delle attività (la colonna sinistra della vista Gantt, con lo stesso comportamento di trascinamento sulla scheda della barra multifunzione **Tabella**) e trascinala su o giù. Rilasciala tra due righe per riordinarla tra i suoi elementi allo stesso livello, esattamente come Alt+↑/↓. Rilasciala invece sulla parte inferiore della riga di un'attività di riepilogo, e si annida: l'attività diventa la nuova ultima sottoattività di quell'attività di riepilogo, rientrandola in un solo movimento — è l'equivalente col mouse di Alt+→. Seleziona prima più attività (Ctrl/Cmd-clic, o una selezione a riquadro) e l'intera selezione si trascina e si rilascia insieme.

La scheda della barra multifunzione **Tabella** mostra questa stessa struttura come una semplice griglia modificabile, utile quando inserisci o correggi molte attività in una volta: un singolo clic su una cella modificabile avvia subito la modifica con il valore esistente selezionato, i tasti freccia spostano un cursore di cella senza aprirla, **F2**/**Invio** apre la cella corrente per la modifica, e **Tab**/**Shift+Tab** passa alla cella successiva/precedente continuando sulla riga attività successiva/precedente. Il rientro resta su **Alt+→**/**Alt+←**. Raggiungere **Invio** o **↓** sull'ultimissima riga crea lì una nuova attività dello stesso livello con il cursore già nella cella del nome, così puoi continuare a compilare un intero elenco senza toccare il mouse — questo funziona solo nella normale vista ad albero, perché con un filtro, un ordinamento o un raggruppamento attivo la nuova attività potrebbe finire subito fuori vista, quindi l'app lo chiede prima invece di posizionare in silenzio un'attività che non vedi.

## Tipi di cardine

Un traguardo è un'attività senza durata che segna un momento — un inizio, una consegna, un'ispezione. Open Planner Studio ha tre modi per aggiungere un traguardo, tutti tramite il gruppo della barra multifunzione **Attività**, usando la freccia accanto al pulsante **Traguardo**:

- **Cardine di inizio** — segna l'inizio di una fase o del progetto.
- **Cardine di fine** — segna un completamento, ad esempio una consegna.
- **Punto di ispezione (obbligatorio)** — in pratica un cardine di fine con il flag **Obbligatoria (contrattuale)** già selezionato e il suo Tipo impostato direttamente su **Ispezione**, così un momento di ispezione è riconoscibile fin dall'inizio sia come contrattualmente obbligatorio sia come ispezione.

Preferisci la scorciatoia **Ctrl+M**? Ti dà un traguardo generico ("Nuovo traguardo") che poi rinomini e tipizzi tu stesso.

Vedrai questa stessa suddivisione nel pannello delle proprietà una volta selezionato un traguardo con la casella **Traguardo** attiva: il campo **Tipo di cardine** offre **Automatico**, **Cardine di inizio** o **Cardine di fine**. "Automatico" lascia che il motore di pianificazione decida come si comporta il traguardo in base alle sue relazioni — scegli questo se il traguardo non ha un carattere di inizio o fine pronunciato. Separatamente, c'è la casella **Obbligatoria (contrattuale)**: contrassegna un traguardo come vincolante dal punto di vista contrattuale, indipendentemente dal fatto che sia un cardine di inizio o di fine. Così puoi, ad esempio, rendere obbligatorio anche un cardine di inizio, oppure — come con **Punto di ispezione** — impostare un cardine di fine obbligatorio in un solo clic.

## Codici e campi: codici attività e campi personalizzati

Le pianificazioni più grandi hanno presto bisogno di dimensioni extra che non rientrano nella WBS: quale unità, quale disciplina, quale appaltatore. È a questo che servono i **codici attività** e i **campi personalizzati**, entrambi gestiti tramite la finestra **Codici e campi** (il gruppo della barra multifunzione **Struttura** sulla scheda **Pianificazione**, pulsante etichettato **Codici e campi**).

- I **codici attività** sono dimensioni definibili liberamente (ad esempio "Ubicazione" o "Disciplina") con un elenco di valori — ogni valore ha un **Codice**, una **Descrizione** e un **Colore**. Un'attività può avere al massimo un valore per tipo di codice. Usa **Aggiungi tipo di codice** per iniziare una nuova dimensione, e **Aggiungi valore** per costruire i possibili valori.
- I **campi personalizzati** sono campi tipizzati propri — **Testo**, **Numero**, **Numero intero**, **Costo**, **Data** o **Sì/no** — che compaiono come colonna nella tabella delle attività e possono essere compilati per attività. Pensa a un campo "Appaltatore" (testo) o "Permesso ricevuto" (sì/no).

Una volta creati, assegni un codice attività o compili un campo personalizzato tramite le colonne nella tabella delle attività (rendile visibili prima tramite **Vista → Colonne…** se necessario) oppure tramite il pannello delle proprietà dell'attività.

### Raggruppare per codici e campi

I codici attività e i campi personalizzati si ripagano davvero una volta che raggruppi per essi: vai alla scheda della barra multifunzione **Vista**, apri **Raggruppa** e scegli il codice attività o il campo personalizzato da usare per raggruppare sotto **Campo**. La tabella delle attività mostra allora intestazioni di gruppo invece dell'albero WBS — comodo per vedere, ad esempio, tutte le attività per unità o per disciplina insieme, attraverso la suddivisione in fasi. Puoi impostare fino a due livelli di raggruppamento contemporaneamente (ad esempio prima per unità, poi per disciplina).

## Note: una checklist per attività

Ogni attività ha una sezione **Note** nel pannello delle proprietà — essenzialmente una piccola checklist che rimane collegata all'attività. Questo è pensato per il tipo di elementi d'azione sciolti che non rientrano in una data di pianificazione: "devo ancora verificare con l'appaltatore", "devo ancora ordinare il materiale", "in attesa del disegno v2".

1. Fai clic su **+ Aggiungi nota**. Appare una nuova riga vuota con il focus nel campo di testo.
2. Digita il testo della nota.
3. Seleziona la casella una volta gestito l'elemento — il testo viene allora barrato, ma la nota rimane visibile (contrassegnata come fatta anziché eliminata) così la storia di un'attività rimane leggibile.
4. Usa l'icona del cestino per rimuovere definitivamente una nota.

Le note sono puramente informative: non influiscono sulla pianificazione o sul calcolo, quindi sono lo strumento giusto per osservazioni che non possono essere espresse come data o durata. Vedi un mix di note aperte e completate in pratica nell'esempio di dimensioni medie "Nieuwbouw 6 Rijwoningen De Akkers" (etichetta *aantekeningen*/note in **File → Esempi**).

## Continua a leggere

- Vedi questa struttura — suddivisione in fasi, attività di riepilogo, traguardi — in pratica in [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Ora che la struttura è a posto, il passo successivo è collegare le attività tra loro: leggi la guida [Relazioni e vincoli](docs://gids-relaties-constraints).
- Sei ancora nuovo di Open Planner Studio? Inizia con la guida [Avvio rapido](docs://quick-start) per un esercizio continuo da un progetto vuoto a una pianificazione calcolata.
