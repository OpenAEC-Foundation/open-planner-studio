# Trascinare, spostare e fare zoom nel Gantt

Obiettivo: usare la linea temporale con il mouse: spostare una barra o cambiarne la durata, spostare la linea temporale, selezionare attività con un riquadro e fare zoom avanti e indietro.

## Quando ti serve

Nel Gantt vedi che la muratura deve iniziare due giorni dopo, o che il getto richiede un giorno in più, e vuoi farlo direttamente sulla barra. Oppure hai un progetto lungo mesi e vuoi scorrere rapidamente fino alla chiusura estiva dei cantieri. Il mouse ha alcuni gesti per questo. Quale gesto fa cosa dipende da dove inizi a trascinare e dall'impostazione dello scorrimento.

## Passaggi

### Spostare una barra

1. Premi al centro di una barra attività e trascina in orizzontale. Inizio e fine si spostano insieme, a giorni interi; la durata resta uguale.
2. Rilascia il mouse. La barra resta nella nuova posizione. La pianificazione non è più aggiornata: premi *Calcola* (F5), oppure lascia che l'app lo faccia da sola se *Calcola automaticamente* è attivo.

Se l'attività ha un predecessore, l'app registra il nuovo inizio come vincolo *Iniziare non prima del (SNET)* e lo indica dopo che hai rilasciato il mouse. Il motivo e cosa succede con un altro vincolo sono spiegati in [Vincoli e scadenze](docs://uitleg-constraints). Se trascini di nuovo fino all'inizio originale, torna anche il vincolo originale.

Se trascini soprattutto verso l'alto o verso il basso invece che di lato, sposti l'attività su un'altra riga e le date restano. La direzione che scegli nei primi pochi pixel vale per tutto il trascinamento, quindi un solo gesto non cambia mai date e struttura insieme. Vedi [Modificare la struttura](docs://howto-structuur-aanpassen).

### Modificare la durata

1. Porta il mouse sul bordo destro della barra. Il puntatore diventa una freccia che punta a sinistra e a destra.
2. Trascina il bordo. Mentre trascini, una piccola etichetta nel colore di accento del tema (per impostazione predefinita arancione) mostra la durata che l'attività avrebbe ora, per esempio *4d*. Segue il movimento in tempo reale, quindi vedi la nuova durata prima di rilasciare il mouse. Al bordo destro l'etichetta è dentro la barra, al bordo sinistro appena a sinistra di essa. L'etichetta mostra la durata nello stesso modo in cui la mostra la colonna durata.
3. Rilascia il mouse. La durata è quella che mostrava l'etichetta.

Il bordo sinistro sposta l'inizio e lascia la fine, quindi l'attività diventa più corta o più lunga all'inizio. Vale la stessa regola SNET di quando sposti la barra. Quando trascini il centro della barra, l'etichetta non appare: la durata non cambia.

La durata conta i giorni lavorativi del calendario dell'attività. I fine settimana e i giorni liberi non contano, e un'attività in giorni non può diventare più corta di un giorno lavorativo. Per un'attività in ore l'app arrotonda al passo della linea temporale sotto il mouse: almeno un'ora, oppure un quarto d'ora se fai zoom avanti abbastanza e *Mostra i quarti d'ora con ingrandimento elevato* è attivo.

Un trascinamento è un solo passo in *Annulla*, per quanto lungo sia. Su una barra divisa i bordi funzionano in modo diverso; vedi [Dividere un'attività](docs://howto-taak-splitsen).

### Spostare la linea temporale

Che cosa fa un trascinamento sullo sfondo vuoto dipende dalla modalità di scorrimento. La scegli in *Impostazioni app*, scheda *Aspetto*, sotto *Gantt › Scorrimento e zoom* alla voce *Modalità*:

- **Zoom + trascina** (predefinita): se trascini sullo sfondo vuoto con il tasto sinistro del mouse, la linea temporale si sposta con il mouse, come su una mappa. Il puntatore è una mano. Su una barra, un trascinamento avvia semplicemente un gesto sulla barra.
- **Posizione** e **Tasti**: lo stesso trascinamento crea un riquadro di selezione. Sposti la linea temporale con la rotella (vedi [Impostazioni app](docs://ref-instellingen)) o con il tasto centrale del mouse.

**Il tasto centrale del mouse** (la rotella premuta) sposta la linea temporale in ogni modalità, anche se inizi su una barra. Non funziona mentre è in corso un altro gesto, come il trascinamento di una barra.

### Selezionare attività con un riquadro

Un riquadro seleziona tutte le attività delle righe che tocca. Conta solo l'altezza del riquadro, non l'asse temporale.

1. Inizia sullo sfondo vuoto. Con *Zoom + trascina* tieni premuto Ctrl (⌘ su un Mac) mentre lo fai; con *Posizione* e *Tasti* non serve.
2. Trascina sulle righe che vuoi selezionare. La selezione ottiene una cornice.
3. Rilascia il mouse. Con Esc durante il trascinamento annulli il riquadro e la selezione resta com'era.

Più informazioni sulla selezione sono in [Selezionare, eliminare e annullare attività](docs://howto-taken-selecteren-verwijderen). Sullo spazio vuoto nella tabella attività stessa, il trascinamento non fa nulla.

### Fare zoom avanti e indietro

1. Usa *Zoom +* e *Zoom -* (*Inizio › Zoom*), oppure i tasti + e -. Anche la rotella fa zoom; quando lo fa dipende dalla tua modalità di scorrimento (vedi [Impostazioni app](docs://ref-instellingen)).
2. Se vuoi vedere tutto il progetto, scegli *Vista › Scala temporale › Adatta al progetto* oppure premi Ctrl+0. *Reimposta* (nella scheda *Vista*) oppure il tasto 0 riporta lo zoom al valore predefinito.
3. In basso a destra nella barra di stato c'è lo zoom in pixel per giorno, per esempio *Zoom: 15px/giorno*.

Più rimpicciolisci, meno linee della griglia ci sono. Da 8 pixel per giorno in su c'è una linea per ogni giorno, con una linea più spessa al limite della settimana. Tra 2 e 8 pixel per giorno resta solo il limite della settimana. Sotto 2 pixel per giorno, nella vista annuale, restano solo i limiti dei mesi. Altrimenti l'area del Gantt diventerebbe un motivo a strisce uniforme in cui le barre scompaiono. I fine settimana e i giorni liberi in grigio, e le strisce settimanali con colore alternato, restano a ogni livello; reggono la struttura della settimana quando le linee spariscono. Nell'intestazione della linea temporale i numeri di settimana e di giorno compaiono solo quando c'è spazio per loro, e da 40 pixel per giorno compare anche il giorno della settimana prima del numero del giorno.

Il nome dell'attività è mostrato nella barra, se ci sta tutto. Se non ci sta, per esempio quando rimpicciolisci, il nome completo è mostrato a destra della barra.

### Vedere i dettagli di un'attività

Tieni fermo il mouse su una barra. Compare una piccola scheda con il nome dell'attività, *WBS*, *Durata*, *Inizio*, *Fine*, *Stato*, *Critica* e *Margine totale*. Durante il trascinamento, lo spostamento della linea temporale, un riquadro di selezione o un menu del tasto destro la scheda sparisce.

## Problemi frequenti e cosa fa l'app allora

**L'inizio non si sposta.** Se l'attività ha un predecessore e un vincolo diverso da SNET, per esempio *Il più tardi possibile (ALAP)*, l'app non applica l'inizio trascinato. Dopo che hai rilasciato il mouse, l'app indica quale vincolo trattiene l'inizio. Cambia quel vincolo per spostare l'inizio. Il bordo destro funziona, perché cambia solo la durata.

**Il gesto fa un'altra cosa.** In modalità relazione e in modalità divisione i gesti sulla barra fanno cose diverse; Esc interrompe queste modalità. Se tieni premuto Maiusc mentre trascini da una barra, crei una relazione invece di spostare la barra. Vedi [Aggiungere relazioni](docs://howto-relaties-leggen).

**In modalità Posizione o Tasti il tasto sinistro del mouse non sposta la vista.** Vedi allora un puntatore normale invece di una mano. Usa la rotella o il tasto centrale del mouse, oppure imposta la modalità su *Zoom + trascina*.

**Un clic in una pausa di una barra divisa** seleziona l'attività e non avvia né un trascinamento né un riquadro.

## Vedi anche

- [Menu del tasto destro](docs://ref-contextmenus): i menu su una barra, una riga e un'intestazione di gruppo.
- [Scorciatoie da tastiera](docs://ref-sneltoetsen): i tasti per fare zoom e per annullare un gesto.
- [Impostazioni app](docs://ref-instellingen): la modalità di scorrimento e l'asse temporale.
- [Vincoli e scadenze](docs://uitleg-constraints): perché un inizio spostato diventa un vincolo.
