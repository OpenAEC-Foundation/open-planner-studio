# Pianificazione e WBS

Una pianificazione inizia con una struttura delle attività: quali attività esistono, come sono suddivise in fasi, e quali momenti sono abbastanza importanti da meritare un traguardo? Questa guida approfondisce quella base più della guida [Avvio rapido](docs://quick-start) — qui imparerai non solo *come* rientrare, ma anche cosa fa realmente un'attività di riepilogo, come differiscono i tre tipi di cardine, come dare alle attività i propri codici e campi, e come tenere note per attività.

## Cosa imparerai qui

- Costruire una struttura delle attività (WBS) usando il rientro e le attività di riepilogo.
- Spostare attività all'interno dello stesso livello, senza rientrare di nuovo.
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

### Spostare attività senza rientrare di nuovo

Oltre a cambiare il livello di un'attività (rientra/rimuovi rientro), puoi anche scambiare la posizione di un'attività all'interno dello stesso livello, senza cambiare la struttura stessa:

- **Alt+↑** sposta l'attività selezionata in alto, sopra l'attività attualmente sopra di essa.
- **Alt+↓** sposta l'attività in basso.

Questo funziona a qualsiasi livello dell'albero: sposta un'attività di fase, e tutte le sue sottoattività si spostano automaticamente con essa.

## Tipi di cardine

Un traguardo è un'attività senza durata che segna un momento — un inizio, una consegna, un'ispezione. Open Planner Studio ha tre modi per aggiungere un traguardo, tutti tramite il gruppo della barra multifunzione **Attività**, usando la freccia accanto al pulsante **Traguardo**:

- **Cardine di inizio** — segna l'inizio di una fase o del progetto.
- **Cardine di fine** — segna un completamento, ad esempio una consegna.
- **Punto di ispezione (obbligatorio)** — in pratica un cardine di fine con il flag **Obbligatoria (contrattuale)** già selezionato e il suo Tipo impostato direttamente su **Ispezione**, così un momento di ispezione è riconoscibile fin dall'inizio sia come contrattualmente obbligatorio sia come ispezione.

Preferisci la scorciatoia **Ctrl+M**? Ti dà un traguardo generico ("Nuovo traguardo") che poi rinomini e tipizzi tu stesso.

Vedrai questa stessa suddivisione nel pannello delle proprietà una volta selezionato un traguardo con la casella **Traguardo** attiva: il campo **Tipo di cardine** offre **Automatico**, **Attività cardine di inizio** o **Attività cardine di fine**. "Automatico" lascia che il motore di pianificazione decida come si comporta il traguardo in base alle sue relazioni — scegli questo se il traguardo non ha un carattere di inizio o fine pronunciato. Separatamente, c'è la casella **Obbligatoria (contrattuale)**: contrassegna un traguardo come vincolante dal punto di vista contrattuale, indipendentemente dal fatto che sia un cardine di inizio o di fine. Così puoi, ad esempio, rendere obbligatorio anche un cardine di inizio, oppure — come con **Punto di ispezione** — impostare un cardine di fine obbligatorio in un solo clic.

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
