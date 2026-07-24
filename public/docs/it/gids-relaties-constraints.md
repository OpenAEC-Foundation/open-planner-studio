# Relazioni e vincoli

Le attività autonome non si spostano quando la pianificazione cambia. Le relazioni registrano quella dipendenza; i vincoli registrano un requisito rigido o morbido su una data. Questa guida approfondisce entrambi più di [Avvio rapido](docs://quick-start): quando scegli quale tipo di relazione, cosa fa esattamente un ritardo/anticipo, cosa significa un blocco rigido e quando specificamente *non* dovresti usarlo, e come si relaziona una scadenza a un vincolo?

## Cosa imparerai qui

- I quattro tipi di relazione (FS/SS/FF/SF) e quando usare ciascuno.
- Ritardo e anticipo, incluso il ritardo percentuale e il ritardo in tempo trascorso (ad esempio per la maturazione del calcestruzzo).
- Aggiungere relazioni in tre modi: trascinando, con la selezione e tramite la tabella delle relazioni.
- Tutti e otto i tipi di vincolo, più il blocco rigido (P6 Mandatory) e il vincolo secondario.
- La differenza tra una scadenza e un vincolo.

Segui con l'esempio di livello base [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) (permesso SNET, sovrapposizione SS, collegamento FF) e, per il conflitto di scadenza, con [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).

## I quattro tipi di relazione

Ogni relazione ha un **Predecessore** e un **Successore**, e uno dei quattro tipi:

- **FS — Finish-Start**: il successore inizia solo quando il predecessore è terminato. Di gran lunga la relazione più comune nell'edilizia: prima la fondazione, poi la struttura grezza. Usa FS quando un'attività fisicamente non può iniziare finché l'altra non è finita.
- **SS — Start-Start**: entrambe le attività iniziano (all'incirca) nello stesso momento. Usa questo quando due attività possono procedere insieme una volta che la prima si avvia — ad esempio il lavoro di muratura e la struttura del tetto che iniziano a sovrapporsi una volta che la struttura grezza è avviata, senza che una attenda che l'altra finisca.
- **FF — Finish-Finish**: entrambe le attività terminano (all'incirca) nello stesso momento. Utile quando due attività possono procedere indipendentemente ma devono essere completate insieme — ad esempio la pittura che deve terminare poco dopo la posa delle piastrelle, così una stanza può essere consegnata in un colpo solo.
- **SF — Start-Finish**: il predecessore deve iniziare prima che il successore possa terminare. Di gran lunga il tipo meno comune nella pratica edilizia — riservalo a casi limite in cui un'attività di finitura può fermarsi solo una volta che un'altra attività è iniziata (ad esempio un passaggio di consegne tra turni).

Vuoi riconoscere questi primi tre tipi in un esempio reale? L'esempio "Verbouwing & Aanbouw Eengezinswoning" contiene una catena FS tra le fasi principali, una sovrapposizione SS tra il lavoro di muratura e la struttura del tetto, e un collegamento FF tra le piastrelle e il lavoro di pittura.

## Ritardo e anticipo

Una relazione non deve essere zero: un **ritardo** (positivo) aggiunge tempo di attesa tra predecessore e successore, un **anticipo** (negativo, inserito come numero negativo) permette al successore di iniziare prima — una sovrapposizione deliberata. Il campo del ritardo (**Ritardo**, nel pannello delle proprietà e nella tabella delle relazioni) accetta una notazione breve:

- `2d` — 2 giorni lavorativi di ritardo (l'unità predefinita: giorni sul calendario di progetto).
- `3ed` — 3 giorni **trascorsi** (elapsed): giorni di calendario che passano anche attraverso i fine settimana o le festività. Questa è l'unità che vuoi per, ad esempio, la **maturazione del calcestruzzo**: il calcestruzzo continua a maturare anche sabato e domenica, quindi un ritardo di "3 giorni lavorativi" sottostimerebbe il tempo di maturazione se in mezzo cade un fine settimana. In quel caso, imposta il ritardo sull'unità trascorsa.
- `50%` — un ritardo percentuale: il 50% della durata del predecessore, ricalcolato a ogni esecuzione CPM man mano che cambia la durata del predecessore (la stessa logica di MS Project). Utile quando il tempo di attesa scala naturalmente con la dimensione dell'attività precedente.
- `-25e%` — un ritardo percentuale negativo in tempo trascorso: un anticipo del 25% della durata del predecessore, in giorni trascorsi.

Un numero negativo (anticipo) significa che il successore inizia mentre il predecessore è ancora in corso — ad esempio la posa delle piastrelle che inizia già durante gli ultimi giorni di intonacatura nella stessa stanza.

## Aggiungere relazioni

Ci sono tre modi per creare una relazione, a seconda di dove stai già lavorando:

1. **Trascinamento nel diagramma di Gantt**: tieni premuto **Shift** e trascina dalla barra del predecessore alla barra del successore. Non appena rilasci, viene creata immediatamente una relazione FS con ritardo 0, e la finestra **Tipo di relazione** appare subito — lì puoi regolare il tipo (FS/SS/FF/SF) e il ritardo senza dover aprire il pannello delle proprietà.
2. **Selezione + pulsante**: seleziona prima il predecessore, tieni premuto Ctrl/Cmd e seleziona poi il successore (in quest'ordine), e fai clic su **Nuova relazione dalla selezione** (il gruppo della barra multifunzione **Relazioni** sulla scheda **Pianificazione**, oppure la scheda **Relazioni** stessa). Questo pulsante funziona solo quando sono selezionate esattamente due attività.
3. **Direttamente nella tabella delle relazioni**: apri la scheda **Relazioni** (tramite **Gestisci** nel gruppo della barra multifunzione Relazioni). La tabella mostra, per relazione, le colonne **Predecessore**, **Tipo**, **Ritardo**, **Successore**, **Determinante** e **Margine libero** — tipo e ritardo possono essere modificati direttamente qui, anche per le relazioni create in precedenza trascinando o con la selezione.

La colonna **Determinante** mostra, dopo un calcolo, quale relazione determina effettivamente la data di inizio o di fine del successore — per un'attività con più predecessori, non è necessariamente la relazione creata più di recente, ma quella con la data (determinante) più tardiva.

## Tipi di vincolo

Un vincolo impone un limite di data su un'attività, indipendentemente dalle sue relazioni. Open Planner Studio ha otto tipi, impostati tramite il campo **Vincolo** nel pannello delle proprietà:

- **Il più presto possibile (ASAP)** — nessun limite di data, il predefinito.
- **Il più tardi possibile (ALAP)** — l'attività si sposta il più possibile entro il suo margine.
- **Iniziare non prima del (SNET)** — un limite inferiore sulla data di inizio (ad esempio: non iniziare prima che il permesso sia concesso).
- **Iniziare non oltre il (SNLT)** — un limite superiore sulla data di inizio.
- **Finire non prima del (FNET)** — un limite inferiore sulla data di fine.
- **Finire non oltre il (FNLT)** — un limite superiore sulla data di fine.
- **Deve iniziare il (MSO)** — una data di inizio fissa.
- **Deve finire il (MFO)** — una data di fine fissa.

SNET/SNLT/FNET/FNLT sono tutti **limiti morbidi**: il calcolo CPM ne tiene conto, ma una violazione porta "solo" a margine negativo, non a un blocco o un errore. L'esempio "Verbouwing & Aanbouw Eengezinswoning" usa un vincolo SNET, ad esempio, per impedire che un'attività inizi prima che il permesso sia concesso.

### Il blocco rigido (P6 Mandatory)

MSO e MFO possono inoltre essere resi **rigidi** tramite la casella **Obbligatorio (logica di blocco)**, che compare solo per questi due tipi. Questo è il vincolo "P6 Mandatory" di Primavera P6: la barra è fissata sulla data, anche se i suoi predecessori logicamente lo contraddicono. Quando attivi un blocco rigido, Open Planner Studio mostra un avviso una tantum: **un blocco rigido sovrascrive le relazioni — la barra è fissata alla data, anche prima dei suoi predecessori. Una violazione diventa margine negativo a monte.**

Quindi usa un blocco rigido solo quando una data è genuinamente non negoziabile e sta a sé rispetto alla logica della pianificazione — ad esempio una data di consegna fissata legalmente che resta valida indipendentemente dall'avanzamento. **Non** usarlo come regola pratica per "voglio che questa attività stia su quella data": in quel caso un vincolo morbido (SNET/FNLT/ecc.) o semplicemente una catena di relazioni ben pianificata è quasi sempre la scelta migliore. Un blocco rigido può comprimere l'intera rete a monte: se le attività precedenti vogliono procedere oltre il blocco, appare margine negativo che si propaga attraverso l'intera catena prima dell'attività bloccata — un segno che la pianificazione è in conflitto, non che il blocco ha risolto il problema.

### Vincolo secondario

Per un vincolo non rigido (quindi non ASAP/ALAP e non un MSO/MFO rigido), puoi aggiungere un **vincolo secondario**: un secondo limite dagli stessi quattro tipi morbidi (SNET/FNET/SNLT/FNLT), che non può limitare lo stesso lato di quello primario. Questo ti permette di impostare, ad esempio, sia un limite inferiore sia uno superiore sulla data di inizio contemporaneamente. Open Planner Studio convalida la combinazione in tempo reale e mostra un errore non appena la combinazione non è valida — ad esempio un vincolo secondario accanto a un blocco rigido, il che non è consentito.

## Scadenze contro vincoli

Una **scadenza** (un campo separato, pannello delle proprietà) assomiglia a un vincolo ma è deliberatamente diversa: è un limite superiore morbido e informativo sulla data di fine, mostrato nel diagramma di Gantt come un indicatore a freccia verso il basso — verde finché l'attività è ancora in orario, rosso una volta che la sua fine anticipata la supera. Una scadenza non forza la pianificazione (a differenza di un vincolo MFO/FNLT, che partecipa attivamente al calcolo), ma conta come limite superiore nel calcolo del margine: se la pianificazione naturalmente non rispetta la scadenza, questo produce **margine negativo** senza che sia coinvolto alcun vincolo.

È esattamente ciò che accade nell'esempio [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): contiene una scadenza contrattuale deliberatamente stretta che la durata naturale della pianificazione non rispetta, risultando in un margine negativo visibile — un buon esempio da guardare se vuoi vedere come appare in pratica un conflitto di scadenza, senza che nulla sia "rotto": la pianificazione semplicemente calcola e mostra dove è sotto pressione.

Regola pratica: usa una **scadenza** per una data obiettivo che vuoi monitorare senza forzare la logica della pianificazione, e usa un **vincolo** (morbido o, eccezionalmente, rigido) quando una data è genuinamente un limite che il calcolo deve rispettare.

## Continua a leggere

- Vedi SNET, la sovrapposizione SS e il collegamento FF in pratica: [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Vedi il conflitto di scadenza in pratica: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Struttura non ancora a posto? Leggi prima [Pianificazione e WBS](docs://gids-plannen-wbs).
- Per calendari e orari di lavoro che influiscono sulla durata delle attività: la guida [Calendari e pianificazione oraria](docs://gids-kalenders-uren).
