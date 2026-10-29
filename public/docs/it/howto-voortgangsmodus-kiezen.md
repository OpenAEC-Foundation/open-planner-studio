# Scegliere la modalità di progresso

Obiettivo: decidi come l'app pianifica il lavoro rimanente di un'attività già iniziata mentre il suo predecessore è ancora in corso: secondo la relazione (Retained Logic) oppure secondo quello che succede davvero (Progress Override).

## Quando ti serve questo

In cantiere i lavori spesso vanno più avanti della logica. Il pittore inizia già nelle stanze che sono state intonacate, mentre l'intonacatore è ancora occupato altrove. Nella pianificazione questo è, per esempio, una relazione fine-inizio il cui successore inizia prima che il predecessore sia finito. L'app lo chiama **avanzamento fuori sequenza**. Se la barra di stato mostra *Relazioni fuori sequenza: N*, hai un caso del genere e la modalità di progresso decide come l'app pianifica il lavoro rimanente del successore. Che cosa fanno le due modalità, con un esempio svolto, è spiegato in [Avanzamento, data di stato e baseline](docs://uitleg-voortgang).

## Passaggi

1. Aggiorna l'avanzamento e imposta la data di stato, come descritto in [Aggiornare l'avanzamento](docs://howto-voortgang-bijwerken).
2. Vai a *Pianificazione › Baseline e progresso › Modalità di progresso* e apri l'elenco.
3. Scegli *Retained Logic* o *Progress Override*.
4. Premi **Calcola** (F5), per esempio tramite *Pianificazione › Pianificazione › Calcola*. La scelta rende la pianificazione non più aggiornata: la barra di stato mostra *Non aggiornato — ricalcola (F5)*. Se *Calcola automaticamente* è attivo, l'app lo fa da sola.

Come scegli?

- **Retained Logic** è il predefinito. La relazione resta valida: il lavoro rimanente del successore inizia solo quando il predecessore è finito. Scegli questa opzione se l'ordine è davvero fisso, o se vuoi pianificare con prudenza.
- **Progress Override** dà la priorità alla realtà. Il lavoro rimanente del successore inizia alla data di stato, senza aspettare il predecessore. Scegli questa opzione se il successore continua davvero a lavorare e la data di fine non deve dipendere da un predecessore ancora in corso.

## Controllare il risultato

- Clicca sul messaggio *Relazioni fuori sequenza: N* nella barra di stato. Si apre il pannello *Avvisi*, raggiungibile anche tramite *Pianificazione › Pianificazione › Avvisi*. Ogni relazione vi compare con il testo *Fuori sequenza: l'avanzamento del successore contraddice la relazione*, per esempio *4.2 Plastering → 4.5 Painting (FS)*.
- Guarda la barra del successore. Con Retained Logic la barra continua fino a dopo la fine del suo predecessore. Con Progress Override finisce prima. Nell'esempio della spiegazione: martedì 27 luglio invece di giovedì 22 luglio.

## Insidie e cosa fa l'app

**Nessuna differenza.** La modalità ha effetto solo sulle attività che sono già iniziate mentre il loro predecessore non è ancora finito. Senza un'attività del genere non cambia nulla.

**Il messaggio resta.** Progress Override non risolve il messaggio di avanzamento fuori sequenza. La modalità decide come l'app calcola; la contraddizione tra relazione e avanzamento resta. Se la relazione non è più corretta, modificala ([Aggiungere relazioni](docs://howto-relaties-leggen)).

**Appartiene al progetto.** La scelta viene salvata nel file di progetto, vale per tutto il progetto e si può annullare con Ctrl+Z. Un nuovo progetto è impostato su Retained Logic.

**Un file P6.** Se apri un file Primavera P6 (.xer), l'app prende la modalità dal file. Oltre a Retained Logic e Progress Override, P6 ha anche Actual Dates. L'app non conosce quella terza modalità; un file del genere viene calcolato come Retained Logic. Il messaggio di importazione lo segnala come *1 impostazione di pianificazione P6 con fallback sicuro.*

**Il profilo di calcolo.** Nel profilo Primavera P6 anche Progress Override agisce all'indietro, sulle date più tarde e sul margine libero del predecessore (convenzione *Progress Override ignora anche all'indietro un successore iniziato*). Nei profili Open Planner Studio e Microsoft Project non è così. Le convenzioni le trovi sotto *Impostazioni › Progetto › Impostazioni progetto*, nel blocco *Profilo di calcolo e opzioni*. Nell'esempio della spiegazione questo effetto all'indietro non si può vedere.

## Vedi anche

- [Avanzamento, data di stato e baseline](docs://uitleg-voortgang): la differenza tra le due modalità, con i numeri.
- [Aggiornare l'avanzamento](docs://howto-voortgang-bijwerken): inserire l'avanzamento su cui lavora la modalità.
- [Aggiungere relazioni](docs://howto-relaties-leggen): modificare una relazione che non è più corretta.
