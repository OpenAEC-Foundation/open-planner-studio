# La barra multifunzione, scheda per scheda

La barra multifunzione in alto nello schermo ha schede. Ogni scheda ha gruppi di pulsanti. Questo articolo dice, per ogni pulsante, che cosa fa e dove vedi il risultato. Come svolgere un lavoro passo per passo è nelle guide pratiche; qui cerchi che cosa è un pulsante. Un pulsante che esiste o funziona solo a una condizione ha accanto quella condizione.

## Come si comporta la barra multifunzione

- **Schede** — *File* è a sinistra, poi *Home*, *Pianificazione*, *Risorse*, *Vista*, *Impostazioni*, *Tabella*, *IFC*, *Rapporto* e, solo con la modalità IA attiva, *IA*.
- **Finestra stretta** — quando la barra multifunzione non ci sta, i pulsanti si riducono a un'icona da destra a sinistra. Il nome diventa allora il suggerimento del pulsante. Ogni pulsante senza suggerimento proprio mostra il suo nome.
- **Comprimi la barra multifunzione** — la piccola freccia in basso a destra della barra multifunzione la trasforma in una striscia piatta con solo icone. Il gruppo *Baseline e progresso* e il gruppo *Connessione* della scheda IA scompaiono allora dietro un unico pulsante con un menu a comparsa. Predefinito: espansa. La tua scelta viene ricordata.
- **Pulsanti delle estensioni** — un'estensione può aggiungere un proprio gruppo alla fine di una scheda. Un pulsante così fa quello che gli assegna l'estensione.

## File

Se clicchi su *File*, una schermata propria (il Backstage) prende il posto dell'area di lavoro. Non ha una barra multifunzione. *Indietro* la chiude. Se hai cambiato qualcosa in *Impostazioni progetto* e non l'hai applicato, l'app ti chiede prima che cosa farne.

- **Nuovo** — apre la finestra *Nuovo progetto* e chiude il Backstage. I campi sono in [Nuovo progetto e Impostazioni progetto](docs://ref-projectinfo).
- **Apri** — sceglie un file e lo apre come documento. Chiude il Backstage.
- **Recenti** — un elenco dei progetti aperti di recente; un clic ne apre uno. Visibile solo quando l'ambiente può riaprire i file: nell'app desktop e nei browser che offrono accesso ai file, come Chrome ed Edge. Negli altri browser il pulsante c'è, ma la pagina resta vuota.
- **Esempi** — pianificazioni di esempio incluse, divise in *Pianificazioni showcase complete* (etichetta *Tutte le funzionalità*) e *Esempi semplici*. Un clic ne apre una in una nuova scheda.
- **Salva** — scrive il progetto nel file di questo documento. Se il documento non ha ancora un file, scegli prima un nome e una posizione. Un file che hai aperto in un formato diverso da IFC non viene mai sovrascritto; in quel caso *Salva* chiede un nome e una posizione per un file IFC.
- **Salva con nome** — sceglie un nuovo nome o una nuova posizione e salva lì come IFC.
- **Esporta** — riquadri per formato di esportazione, con una descrizione. Un clic converte il progetto e lo salva, e ti riporta a *Home*. Se la pianificazione ha un ciclo, l'errore compare nel Backstage e tu resti lì. Se il progetto è collegato a una libreria di risorse, sotto compare la casella *Salva anche il file di libreria*; funziona solo per il riquadro IFC.
- **Importa** — in alto il riquadro *Aggiorna l'avanzamento da un foglio* (disattivato senza attività), sotto gli importatori che aggiungono le estensioni.
- **Stampa** — il pulsante *Apri anteprima di stampa* ti porta alla scheda *Rapporto*.
- **Impostazioni progetto** — i metadati e il profilo di calcolo di questo progetto. Le modifiche hanno effetto solo dopo *Applica*. Vedi [Nuovo progetto e Impostazioni progetto](docs://ref-projectinfo) e [Profili di calcolo e convenzioni](docs://uitleg-rekenprofielen).
- **Impostazioni app** — le stesse impostazioni della finestra *Impostazioni app*.
- **Estensioni** — gestione e installazione delle estensioni; vedi [Installare e gestire un'estensione](docs://howto-extensie-installeren).
- **Libreria** — gestione delle librerie di risorse; vedi [Gestire e condividere le librerie di risorse](docs://howto-bibliotheken-beheren).
- **Guida** — la documentazione integrata, anche con F1. Il campo di ricerca cerca nei titoli, nelle intestazioni e nel testo stesso. Gli articoli sono in quattro sezioni: *Tutorial*, *Guide pratiche*, *Spiegazioni* e *Riferimento*. Sotto *Lingua della documentazione* scegli *Segui la lingua dell'app* o una lingua dell'elenco. L'olandese e l'inglese sono le lingue di partenza; le altre lingue hanno gli articoli già tradotti. Se un articolo manca nella tua lingua, leggi la versione inglese, con un avviso. La scelta viene salvata su questo dispositivo, separatamente dalla lingua dell'app. Puoi anche aprire la Guida da una finestra o da un pannello: molte finestre e i pannelli *Proprietà*, *Risorse* e *Avvisi* hanno un punto interrogativo in alto a destra (*Guida su questo argomento*), che apre la Guida sull'articolo di quella finestra o di quel pannello. Se hai inserito qualcosa nella finestra e non è ancora salvato, l'app ti chiede prima *Salva*, *Annulla* (scarta quello che hai inserito) o *Indietro* (resta nella finestra); poi la finestra si chiude e si apre la Guida. Alcune finestre, come *Modifica attività* e *Livella risorse*, chiedono sempre. Senza input, la Guida si apre subito.
- **Avvia tour** — chiude il Backstage e avvia la visita guidata dal passo 1.
- **Chiudi progetto** — chiude il documento attivo. Se ha modifiche non salvate, l'app chiede una conferma.

## Home

### Home › File

- **Nuovo**, **Salva**, **Apri** e **Salva con nome** — le stesse azioni di *File*.
- **Recenti** — menu a discesa con i progetti recenti; un clic ne apre uno. Visibile solo alla stessa condizione di *File › Recenti*. Senza file recenti dice *Nessun file recente*.
- **Esporta** — menu a discesa con i formati di esportazione (nomi brevi). Un clic converte il progetto e lo salva.

### Home › Modifica

- **Annulla** — annulla l'ultima modifica. Disattivato quando non c'è niente da annullare.
- **Ripristina** — ripristina l'ultima modifica annullata. Disattivato quando non c'è niente da ripristinare.
- **Elimina** — elimina le attività selezionate, insieme alle loro sottoattività, in un unico passo. Disattivato senza selezione.

### Home › Attività

- **Attività** — aggiunge un'attività di nome *Nuova attività*, con una durata di 5 giorni lavorativi, che inizia all'inizio del progetto. (Se *Attiva pianificazione oraria* è attivo e *Unità predefinita per le nuove attività* in *Impostazioni progetto* è ore, la durata è 5 ore.) Se è selezionata un'attività e la vista è l'albero semplice, la nuova attività finisce subito sotto l'attività selezionata più in basso (suggerimento *Nuova attività subito sotto la selezione*). Senza selezione va in fondo (suggerimento *Nuova attività in fondo all’elenco*). Con una selezione ma durante filtro, raggruppamento o ordinamento, va anche in fondo. Una notifica rossa dice poi che l'app non può metterla sotto la tua selezione, con il pulsante *Cancella*. La nuova attività diventa l'unica selezione, il Gantt si sposta su di essa e il suo nome è pronto per essere sovrascritto nel pannello *Proprietà*.
- **Cardine ▾** — menu a discesa che mette un cardine (durata 0) nello stesso posto di *Attività*. *Attività cardine di inizio* e *Attività cardine di fine* impostano il tipo di cardine; il nuovo cardine si chiama *Nuovo cardine* e riceve la categoria di lavoro *Altro*. *Punto di ispezione (obbligatorio)* crea un cardine di fine con categoria di lavoro *Ispezione* e il contrassegno *Obbligatoria (contrattuale)*, di nome *Nuovo punto di ispezione*.
- **Collega ▾** — menu a discesa con quattro azioni fisse; il pulsante principale non cambia mai significato. Vedi *Pianificazione › Relazioni* per le quattro azioni.
- **Dividi attività** — attiva o disattiva la modalità divisione. Attiva: una striscia sotto la barra multifunzione spiega che clicchi su una barra dove inizia l'intervallo e trascini a destra per la sua lunghezza. Disattivato quando il Gantt non è visibile (nelle schede *Tabella*, *IFC* e *Rapporto* e sotto il pannello risorse completo); il suggerimento dice allora *Disponibile solo quando il diagramma di Gantt è visibile*. Vedi [Dividere un'attività](docs://howto-taak-splitsen).

### Home › Programma

- **Calcola** — calcola la pianificazione: date, margine, percorso critico e carico delle risorse. Non succede mai da solo, a meno che tu non attivi *Calcola automaticamente* (*Impostazioni app*, scheda *Pianificazione*, intestazione *Calcolo*). Mentre la pianificazione non è aggiornata, la barra di stato dice *Non aggiornato — ricalcola (F5)*.

### Home › Zoom

- **Zoom +** — ingrandisce l'asse del tempo di 10 pixel per giorno.
- **Zoom -** — riduce l'asse del tempo di 10 pixel per giorno.

## Pianificazione

### Pianificazione › Programma

Il pulsante *Calcola* è lo stesso di *Home*.

- **Sposta progetto…** — apre la finestra *Sposta progetto*. Disattivato senza una data di inizio del progetto. Vedi [Spostare un progetto](docs://howto-project-verplaatsen).
- **Avvisi** — mostra o nasconde il pannello *Avvisi* nella colonna a destra. Il pulsante si illumina mentre vedi il pannello. Attivandolo si espande una colonna compressa. Quello che contiene è descritto in [Notifiche e avvisi](docs://ref-meldingen).

### Pianificazione › Relazioni

Il gruppo ha il pulsante *Collega ▾* con quattro azioni e il pulsante *Dividi attività* (come in *Home*). Le quattro azioni:

- **Disegna relazione** — attiva o disattiva la modalità collegamento; quando è attiva compare un segno di spunta e il pulsante principale si illumina. Attiva: trascini da una barra all'altra nel Gantt per creare una relazione, e una striscia sotto la barra multifunzione dice come uscire (*Esci* oppure Esc). Disattivato quando il Gantt non è visibile.
- **Collega attività selezionate** — crea una relazione fine-inizio senza ritardo tra due attività; quella selezionata per prima diventa il predecessore. Disponibile solo con esattamente due attività selezionate (altrimenti *Seleziona esattamente due attività*). Una relazione doppia o un ciclo viene rifiutata con un messaggio.
- **Aggiungi relazione esterna…** — apre una finestra per aggiungere un predecessore o un successore esterno all'attività selezionata. Disponibile solo con esattamente un'attività selezionata (altrimenti *Seleziona esattamente un’attività*).
- **Aggiorna tutte le relazioni esterne** — aggiorna gli ancoraggi di tutte le relazioni esterne e nel menu indica quante sono state aggiornate o mancano. Disponibile solo quando il progetto ha relazioni esterne (altrimenti *Questo progetto non contiene relazioni esterne*).

Per il motivo delle relazioni vedi [Creare relazioni](docs://howto-relaties-leggen) e [Relazioni e ritardo](docs://uitleg-relaties).

### Pianificazione › Tracciamento percorso

- **Predecessori** — evidenzia nel Gantt i predecessori delle attività selezionate, catena per catena.
- **Successori** — evidenzia i successori delle attività selezionate.

Puoi attivarle entrambe insieme; un secondo clic su un pulsante disattiva di nuovo quel lato. Le relazioni determinanti ricevono una tinta più forte. Vedi [Tracciare un percorso](docs://howto-pad-traceren).

### Pianificazione › Calendario

- **Calendario** — apre la finestra *Calendari* con la libreria dei calendari del progetto. Vedi [Finestre dei calendari](docs://ref-kalenders).

### Pianificazione › Struttura

- **Codici e campi** — apre la finestra *Codici e campi* per i codici attività e i campi personalizzati. Vedi [Codici e campi personalizzati](docs://howto-codes-en-velden).
- **WBS auto** — attiva o disattiva la numerazione automatica dei codici WBS. Predefinito: attivo in un nuovo progetto. In un file aperto senza questa impostazione: attivo se il file è vuoto o se tutti i codici corrispondono già alla numerazione dell'albero, altrimenti disattivo. Attiva: tutto l'albero viene rinumerato in una volta, i codici seguono poi ogni modifica della struttura, e il campo *Codice WBS* nel pannello e nella finestra è disattivato.
- **Rinumera WBS** — rinumera una volta i codici WBS, secondo la posizione nell'albero (1.2.3). Disattivato mentre *WBS auto* è attivo.
- **Modelli** — menu a discesa con i modelli WBS salvati, ciascuno con il suo numero di attività e relazioni. Un clic inserisce il modello sotto l'attività selezionata, oppure al livello superiore senza selezione. L'icona del cestino elimina un modello. Senza modelli dice come salvarne uno (clic destro su un'attività di riepilogo, *Salva ramo come modello*). Vedi [Salvare e inserire modelli WBS](docs://howto-wbs-sjablonen).
- **Rientra** — rende le attività selezionate sottoattività dell'attività che le precede. Disattivato senza selezione e appena filtri, raggruppi o ordini; il suggerimento dice allora *Non disponibile durante filtro/raggruppamento/ordinamento*.
- **Riduci rientro** — sposta le attività selezionate di un livello verso l'alto, subito dopo il loro attuale genitore. Stesse condizioni di *Rientra*.

### Pianificazione › Baseline e progresso

- **Gestisci baseline…** — apre la finestra delle baseline. Vedi [Salvare e gestire una baseline](docs://howto-baseline-opslaan-en-beheren).
- **Data di stato** — la data fino alla quale misuri l'avanzamento. Digita una data; la croce (*Cancella data di stato*) la rimuove. Se il calendario del progetto ha fasce orarie, l'app calcola in ore e accanto alla data compare un campo per l'ora (MS Project spesso salva 17:00). L'ora conta quindi: 12:00 invece di 17:00 dà una differenza di mezza giornata nel lavoro rimanente. Senza fasce orarie l'app calcola in giorni interi e non c'è un campo per l'ora. Effetto: l'avanzamento viene misurato fino a quella data, e la linea della data di stato e la linea di avanzamento nel Gantt passano su di essa. Vedi [Avanzamento, data di stato e baseline](docs://uitleg-voortgang).
- **Modalità di progresso** — una scelta tra *Retained Logic* e *Progress Override*. Predefinito: *Retained Logic*. Effetto: con *Retained Logic* il lavoro rimanente di un successore già iniziato segue la relazione; con *Progress Override* il lavoro rimanente inizia alla data di stato, senza aspettare il predecessore. Vedi [Scegliere la modalità di progresso](docs://howto-voortgangsmodus-kiezen).

Nella barra multifunzione compressa questi tre si trovano dietro un unico pulsante a bandierina intitolato *Baseline e progresso*.

### Pianificazione › Avanzamento

- **Esporta foglio di avanzamento** — crea un foglio `.xlsx` con le attività, per compilare l'avanzamento fuori dall'app. Disattivato senza attività.
- **Aggiorna l'avanzamento da un foglio** — apre la finestra di importazione per un foglio restituito. Disattivato senza attività. Vedi [Importare l'avanzamento da un foglio](docs://howto-voortgang-importeren).

Questo gruppo c'è anche nelle schede *Tabella* e *Rapporto*.

## Risorse

### Risorse › Gestione

- **Risorse** — apre il pannello risorse completo; prende il posto dell'area di lavoro. Si illumina mentre vedi quel pannello. Vedi [Pannello risorse](docs://ref-resourcepaneel).
- **Dock risorse** — aggancia il pannello risorse compatto nella colonna a destra, accanto al Gantt. Si illumina mentre il dock è visibile; un secondo clic lo chiude. Il dock mostra solo nome, colore, un avviso in caso di sovrassegnazione e *Unità max*, e con una selezione di attività solo le risorse di quelle attività.
- **Nuova risorsa** — apre il pannello risorse completo con una riga di bozza vuota per una nuova risorsa. Non viene creato niente finché non inserisci un nome; se clicchi altrove non resta nulla. La risorsa va nella libreria di risorse o nel progetto, a seconda della vista.

### Risorse › Assegnazione

- **Assegna ▾** — assegna una risorsa all'attività selezionata. Disponibile solo con esattamente un'attività selezionata che è un'attività foglia e non un cardine; altrimenti il pulsante è grigio. Nel menu imposti prima *Unità/giorno* (predefinito 1) e *Curva* (predefinito *Uniforme*); un clic su una risorsa la assegna con quei valori. Il menu elenca solo le risorse che non sono ancora sull'attività. Vedi [Assegnare risorse con una curva](docs://howto-resource-toewijzen).

### Risorse › Istogramma

- **Istogramma** — mostra o nasconde la striscia dell'istogramma sotto il Gantt. Predefinito: disattivato. La tua scelta viene ricordata.
- **Precedente** e **Successiva** — scorrono le risorse nel selettore della striscia dell'istogramma, con *Tutte le risorse* come passo extra nel giro. Disattivati quando l'istogramma è disattivato o il progetto non ha risorse.

### Risorse › Livellamento

- **Livella…** — apre la finestra *Livella risorse*. Vedi [Livellamento](docs://uitleg-nivelleren).
- **Cancella livellamento** — rimuove i ritardi e le interruzioni che il livellamento ha applicato. Disattivato quando nessuna attività ha un risultato di livellamento.

### Risorse › Sovrassegnazione

- **Sovrassegnazione** — non è un pulsante ma un contatore: il numero di risorse con almeno un giorno sovrassegnato, oppure *Nessuna*. Diventa rosso con un'icona di avviso appena ce n'è una. Il numero si aggiorna dopo *Calcola* e dopo modifiche a risorse e assegnazioni; se cambi le date delle attività, questo conta solo dopo *Calcola*.

## Vista

### Vista › Scala temporale

- **Zoom +** e **Zoom -** — ingrandiscono o riducono l'asse temporale di 10 pixel per giorno.
- **Reimposta** — riporta lo zoom al predefinito di 30 pixel per giorno.
- **Adatta al progetto** — ingrandisce e scorre in modo che tutto il progetto sia visibile.
- **Scelta della scala** — un elenco con *Anno*, *Trimestre*, *Mese*, *Settimana*, *Giorno* e, solo con *Attiva pianificazione oraria* attivo, *Ora*. Una scelta imposta uno zoom fisso. Il valore mostrato segue lo zoom attuale. Sotto di esso lo zoom è mostrato in pixel per giorno.

### Vista › Visualizzazione

- **Colonne…**, **Filtro…**, **Raggruppa…** e **Ordina…** — visibili solo quando *Mostra i pulsanti di vista classici* è attivo (*Impostazioni app*, scheda *Avanzate*, titolo *Funzioni legacy*). Predefinito: disattivato. *Colonne…* ti porta a *Tabella* e apre lì il selettore delle colonne. *Filtro…* apre subito la finestra del filtro, finché non c'è un filtro salvato. Con filtri salvati apre un menu con *Filtro…*, *Cancella* (solo quando un filtro è attivo) e i filtri salvati. *Raggruppa…* permette due livelli. *Ordina…* permette più livelli. Un pulsante si evidenzia quando l'impostazione di vista corrispondente è attiva. Nella barra multifunzione attuale questo si fa con i pulsanti dei layout; vedi [Creare e usare un layout](docs://howto-layouts-gebruiken).

### Vista › Struttura

- **Comprimi** — comprime le attività di riepilogo selezionate; senza selezione, tutte. In una vista raggruppata comprime tutti i gruppi e una selezione non ha effetto.
- **Espandi** — il contrario.

### Vista › Layout

- **Pulsanti layout** — ogni layout è un interruttore con un'icona e un nome. *Diagramma delle risorse* è incluso. Un clic attiva il layout, un altro clic lo disattiva e riporta la vista di prima del clic. Layout con parti diverse possono essere attivi insieme. Fai clic destro su un layout: *Modifica…*, *Duplica* ed *Elimina* (dopo conferma). Un layout incluso si può solo duplicare.
- **Nuovo layout** — apre la finestra del layout per un nuovo layout.

### Vista › Presentazione

- **Presentazione** — attiva o disattiva la modalità presentazione (Esc per interrompere; nell'app desktop anche F11): solo il Gantt riempie lo schermo. Vedi [Presentare su uno schermo grande](docs://howto-presentatie).
- **Vista divisa** — divide il Gantt in due finestre temporali che partono entrambe dallo zoom e dalla posizione attuali (divisione al 50 per cento), oppure la riporta a una sola. Predefinito: disattivato. Vedi [Uso della vista divisa e della minimappa](docs://howto-split-view-en-mini-map).
- **Minimappa** — mostra o nasconde la minimappa. Predefinito: disattivato. La tua scelta viene ricordata.

### Vista › Pannelli

- **Proprietà** — mostra o nasconde il pannello *Proprietà* nella colonna destra. Predefinito: attivo. Vedi [Finestra attività e pannello proprietà](docs://ref-taak-eigenschappen).

I pulsanti *Risorse*, *Dock risorse* e *Istogramma* sono uguali a quelli di *Risorse*, e *Avvisi* è uguale a quello di *Pianificazione*.

**La colonna a destra.** La colonna a destra del Gantt è presente appena almeno uno dei pannelli *Proprietà*, *Dock risorse* o *Avvisi* è attivo. Se nessuno è attivo, non c'è nessuna colonna. Se un pannello completo occupa l'area di lavoro, per esempio il pannello risorse completo, la colonna scompare. Solo nella scheda *Tabella* resta.

- **Larghezza** — trascina il separatore tra area di lavoro e colonna. Una larghezza vale per tutti i pannelli della colonna.
- **Divisione** — se due pannelli sono attivi, trascina il bordo tra i due. Se ne è attivo uno solo, quel pannello riempie tutta la colonna.
- **Comprimi** — il pulsante *Comprimi la colonna laterale* nell'intestazione nasconde la colonna. Una striscia stretta con il pulsante *Espandi la colonna laterale* la riporta, con gli stessi pannelli di prima.
- **Chiudi** — ogni pannello ha una croce nella sua intestazione. È lo stesso interruttore del pulsante della barra multifunzione.
- **Pannello completo** — nel dock risorse, il pulsante *Pannello completo* apre il pannello risorse completo.

### Vista › Baseline e avanzamento

Questo gruppo ha lo stesso nome di quello in *Pianificazione*, ma contiene le opzioni di disegno del Gantt.

- **Sovrapposizione baseline** — mostra la baseline attiva come una barra sottile sotto ogni barra attività. Predefinito: attivo. Senza una baseline attiva non c'è nulla da vedere.
- **Linea di avanzamento** — disegna una linea sulla data di stato che sporge per ogni attività in base al suo avanzamento. Predefinito: attivo. Senza data di stato non c'è nulla da vedere. Quando la linea di avanzamento è attiva, quella linea segna anche la data di stato.
- **Linea data di stato** — disegna una linea tratteggiata sulla data di stato. Predefinito: attivo. La vedi solo quando la linea di avanzamento è disattivata, perché altrimenti quella linea ne prende il posto. L'etichetta con la data nell'intestazione resta visibile finché almeno una delle due è attiva. L'etichetta segue la notazione della data, per esempio 20-09-2006. Se l'app calcola in ore, linea ed etichetta si trovano all'ora del giorno e l'etichetta mostra anche l'ora, per esempio 20-09-2006 17:00.
- **Colori barre** — sceglie come vengono colorate le barre: *Percorso critico* (predefinito), *Per attività — automatico* oppure *Per categoria* con una scelta di campo. Se quel campo non è in questo progetto, il menu indica che *Categoria di lavoro* viene usata temporaneamente. Fuori da *Percorso critico* un contorno rosso segna il percorso critico. La scelta vale anche per il report.
- **Accento risorsa** — disegna una striscia sottile nel colore della risorsa sotto la barra di ogni attività senza sottoattività, divisa in proporzione alle unità per giorno. Predefinito: disattivato.
- **Banda del margine** — disegna la banda verde dopo una barra non critica, fino alla fine posticipata dell'attività. Predefinito: attivo.
- **Linee di relazione** — mostra o nasconde le linee di relazione tra attività. Predefinito: attivo. La scelta appartiene al documento e al layout.

## Impostazioni

### Impostazioni › Progetto

- **Impostazioni progetto** — apre la finestra *Impostazioni progetto*: i metadati del progetto e, nel blocco *Profilo di calcolo e opzioni*, il modo in cui il progetto calcola. Vedi [Nuovo progetto e Impostazioni progetto](docs://ref-projectinfo).
- **Impostazioni app** — apre la finestra *Impostazioni app* con le schede *Aspetto*, *Pianificazione* e *Avanzate*. Le stesse impostazioni si trovano sotto *File › Impostazioni app*.

### Impostazioni › Calendario

Il pulsante *Calendario* è uguale a quello in *Pianificazione*.

### Impostazioni › Scorciatoie da tastiera

- **Scorciatoie da tastiera** — apre la finestra *Scorciatoie da tastiera*.

## Tabella

La scheda *Tabella* mostra le attività come tabella completa invece del Gantt. I gruppi *File*, *Modifica*, *Attività*, *Pianificazione* e *Tracciamento percorso* sono uguali a quelli di *Home* e *Pianificazione* e agiscono sulla stessa selezione. Non c'è il gruppo *Zoom*, perché lo zoom scala solo l'asse temporale del Gantt. I pulsanti *Dividi attività* e *Disegna relazione* sono non disponibili qui: non c'è un Gantt.

### Tabella › Colonne

- **Colonne…** — apre il selettore delle colonne di questa tabella. Lo stesso selettore si apre con il segno più nell'intestazione della tabella. Il suggerimento dice *Scegli le colonne della vista Tabella*. Vedi [Regolare le colonne della tabella](docs://howto-tabelkolommen-aanpassen) e [Colonne della tabella](docs://ref-tabelkolommen).

## IFC

La scheda mostra il pannello IFC nell'area di lavoro. La barra multifunzione non ha pulsanti qui, solo la riga di testo *IFC - Industry Foundation Classes, nello schema del progetto (predefinito IFC 4.3 ADD2)*.

## Rapporto

### Rapporto › Rapporto

- **Stampa** — solo su questa scheda, dove non fa nulla perché *Rapporto* è già aperto; le scelte del report si trovano nella schermata del report.

## IA

La scheda *IA* esiste solo quando *Abilita modalità IA* è attivo (*Impostazioni app*, scheda *Avanzate*, titolo *Modalità IA*). Predefinito: disattivato. Disattivarla rimuove la scheda e arresta il bridge. Un assistente IA lavora con la tua pianificazione tramite un bridge MCP che avvii qui. Vedi [Collegare un assistente IA (MCP)](docs://howto-ai-assistent-koppelen).

### IA › Server

- **Avvia bridge** e **Arresta bridge** — avviano o arrestano il bridge MCP. Accanto c'è lo stato: *Disattivo*, *Attivo sulla porta …*, *Porta … occupata* (con il motivo) oppure *Errore*. Non disponibile nella versione web; il suggerimento dice *Il bridge funziona solo nell'app desktop.* Lo stesso stato si vede come un punto con *IA* nella barra di stato.

### IA › Connessione

- **Porta** — la porta del bridge. Predefinito: 3877. Modificabile solo quando lo stato è *Disattivo* (suggerimento *Modificabile solo quando il server è arrestato.*).
- **Token** — la password del bridge, con i caratteri nascosti. Piccoli pulsanti *Mostra token*/*Nascondi token*, *Copia* e *Nuovo token*. *Nuovo token* chiede prima una conferma, perché un nuovo token interrompe tutte le connessioni esistenti; se il bridge è in esecuzione, si riavvia con il nuovo token.
- **Connetti** — mostra i dettagli della connessione: endpoint, token, un frammento di configurazione e un prompt di connessione che incolli nel tuo agente IA.

### IA › Sicurezza

- **Pausa** / **Riprendi** — rifiuta temporaneamente tutte le modifiche dell'IA; la lettura resta permessa e il bridge resta attivo. Il pulsante si illumina di rosso durante la pausa.
- **Sola lettura** — rifiuta tutti gli strumenti che cambiano dati finché è attiva.
- **Backup automatico: attivo** / **Backup automatico: disattivo** — scrive automaticamente un backup IFC prima della prima modifica IA per documento. Predefinito: attivo.
- **Esegui backup ora** — scrive subito un backup e mostra il nome del file. Solo nell'app desktop.
- **Apri cartella dei backup** — apre la cartella con i backup. Solo nell'app desktop.

### IA › Attività

- **Pannello attività** — mostra o nasconde il pannello *Attività IA* con le chiamate al bridge, con i relativi argomenti e la risposta.
