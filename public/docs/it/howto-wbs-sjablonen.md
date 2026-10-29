# Salvare e inserire modelli WBS

Obiettivo: salva una fase con le sue sottoattività e le relazioni tra di esse come modello, e inseriscila di nuovo più tardi nello stesso progetto o in un altro.

## Quando ti serve questo

Continui a pianificare lo stesso tipo di lavorazione: ogni casa ha una fondazione con scavo, armatura, getto e maturazione. Invece di creare ogni volta quelle attività e collegarle tra loro, salvi la fase una sola volta come **modello**. Un modello è un ramo della tua WBS: un'attività con tutto ciò che sta sotto di essa.

## Passi

### Salvare un ramo come modello

1. Costruisci il ramo nel modo in cui vuoi riusarlo: un'attività di riepilogo con sottoattività e le relazioni tra di esse.
2. Fai clic con il tasto destro su quell'attività di riepilogo e scegli *Salva ramo come modello*. Questa voce di menu compare solo sulle attività con sottoattività.

L'app segnala *Ramo salvato come modello «Foundation»*. L'app non chiede un nome: il modello prende il nome dell'attività in cima al ramo.

### Inserire un modello

1. Seleziona l'attività sotto cui deve andare il modello, oppure non selezionare nulla.
2. Scegli *Pianificazione › Struttura › Modelli*. La lista mostra il nome di ogni modello e, per esempio, *4 attività, 2 relazioni*.
3. Fai clic sul modello.

Se è selezionata un'attività, il modello va come ultima sottoattività sotto di essa. Quell'attività diventa così un'attività di riepilogo. Se sono selezionate più attività, conta quella su cui hai fatto clic per prima. Se non è selezionato nulla, il ramo va in fondo alla lista, al livello più alto. Dopo l'inserimento il ramo inserito è selezionato.

Tutte le attività inserite partono dall'inizio del progetto e la pianificazione non è più aggiornata. Premi **Calcola** (F5), per esempio tramite *Home › Pianificazione › Calcola*, e le date seguono dalle relazioni. Un inserimento è un solo passo per *Annulla*. Salvare o eliminare un modello non fa parte di questo passo.

### Eliminare un modello

Apri *Pianificazione › Struttura › Modelli* e fai clic sul piccolo cestino a destra del modello (*Elimina modello*). L'app non chiede conferma.

### Che cosa contiene un modello

Per ogni attività, un modello conserva il nome, la descrizione, la categoria di lavoro, se è un cardine e la durata in giorni. Tra le relazioni conserva quelle tra due attività all'interno del ramo, con tipo e ritardo. Un ritardo in ore (`4h`) non viene conservato e diventa 0. Un ritardo in giorni lavorativi, giorni di calendario o percentuale viene conservato.

Tutto il resto non viene conservato: date, avanzamento e date effettive, assegnazioni di risorse, codici e campi personalizzati (vedi [Codici e campi personalizzati](docs://howto-codes-en-velden)), il calendario, vincoli e scadenze, la priorità, una categoria di lavoro personalizzata, per un cardine il suo tipo e la casella *Obbligatoria (contrattuale)*, e le relazioni con attività esterne al ramo. Dopo l'inserimento devi compilare di nuovo questi dati: assegnazioni, codici, calendario e vincoli sono vuoti, e tutte le attività partono dall'inizio del progetto.

Un'attività espressa in ore torna come attività in giorni, con la durata convertita in una frazione di giorno lavorativo. Un'attività di 5 ore con un giorno lavorativo di 8 ore diventa 0,625 giorni.

## Trabocchetti e cosa fa l'app

**I modelli non appartengono al progetto.** L'app li conserva nell'archivio dell'app su questo dispositivo, non nel file di progetto. Un collega che apre il tuo file non vede i tuoi modelli. Nella versione browser un modello appartiene a quel browser. Quindi, se i tuoi modelli ti servono, conservali anche altrove: mettili in un progetto che salvi come file.

**Lo stesso nome può comparire più volte.** Se salvi il ramo due volte, la lista contiene due modelli con lo stesso nome. L'app non sovrascrive nulla.

**La durata dell'attività in cima non conta.** Un'attività di riepilogo ottiene la sua durata dalle sottoattività, appena usi Calcola.

**Un'attività con assegnazioni di risorse come destinazione.** Se selezioni un'attività con assegnazioni che non ha ancora sottoattività e inserisci un modello sotto di essa, l'app lo rifiuta. L'attività diventerebbe un'attività di riepilogo, e quella non porta assegnazioni. L'attività in cima a un modello ha già sottoattività, quindi le assegnazioni non avrebbero dove andare. L'app te lo dice e non cambia nulla. Scegli allora un'altra attività, o nessuna, come posto. Un cardine che riceve un modello perde il contrassegno di cardine, e l'app ti avvisa con un messaggio.

**Una relazione non valida nel modello.** Se una relazione nel modello non è ammessa, per esempio un'attività verso la propria fase, oppure esiste già, l'app la salta e ti dice quante relazioni ha saltato.

## Vedi anche

- [Modificare la struttura](docs://howto-structuur-aanpassen): sposta il ramo inserito o cambia il suo rientro.
- [Aggiungere relazioni](docs://howto-relaties-leggen): crea tu stesso le relazioni dentro un ramo prima di salvarlo.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): che cosa succede al ramo inserito dopo Calcola.
