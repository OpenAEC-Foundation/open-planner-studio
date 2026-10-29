# Regolare la struttura

Obiettivo: disponi le attività in fasi e sottoattività, cambia il loro ordine e mantieni corretti i numeri WBS.

## Quando ti serve

La tua pianificazione è un albero: fasi (attività di riepilogo) con sotto di esse sottoattività, come *Foundation* con *Groundwork*, *Reinforcement* e *Pouring*. Regoli quell'albero quando vuoi mettere attività sotto una fase, spostarne una fuori da una fase, o quando l'ordine non è giusto. Il **codice WBS** (1, 1.1, 1.2, 2, …) è il numero di un'attività in quell'albero.

## Passaggi

### Rientrare un'attività

1. Seleziona l'attività. Puoi selezionare più attività.
2. Scegli *Pianificazione › Struttura › Applica rientro*. Puoi anche usare Alt+→ (o Alt+Maiusc+→), oppure *Rientra* nel menu del clic destro.

L'attività diventa l'ultima sottoattività dell'attività precedente dello stesso livello. Quell'attività diventa così un'attività di riepilogo. Se selezioni un blocco continuo, il blocco viene rientrato nel suo insieme. Se l'attività non ha un'attività precedente dello stesso livello, non succede nulla e non appare alcun messaggio.

### Ridurre il rientro di un'attività

Scegli *Pianificazione › Struttura › Riduci rientro*, premi Alt+← (o Alt+Maiusc+←) oppure scegli *Rimuovi rientro* nel menu del clic destro.

L'attività diventa un'attività dello stesso livello, subito dopo la fase in cui si trovava. Le sue sottoattività la seguono. Le attività che venivano dopo di lei in quella fase restano in quella fase. Un'attività al livello più alto non può essere ridotta ulteriormente.

### Spostare un'attività

Hai tre modi.

- **Con la tastiera.** Alt+↑ e Alt+↓ scambiano l'attività con quella vicina dello stesso livello. Un'attività di riepilogo porta con sé le sue sottoattività. In cima o in fondo al livello non succede nulla. Con più attività selezionate si sposta solo l'attività su cui hai cliccato per prima.
- **Trascinare nella tabella attività.** Premi su una riga e trascina verticalmente. Il quarto superiore di una riga significa *prima*, il quarto inferiore *dopo*. Il centro di un'attività di riepilogo inserisce l'attività sotto di essa, come ultima sottoattività. Il centro di un'attività normale vale come il bordo più vicino. Se trascini una riga che fa parte di una selezione multipla, si sposta l'intera selezione.
- **Trascinare nel Gantt.** Trascina la barra verticalmente su un'altra riga. Funziona come trascinare nella tabella attività e non cambia nessuna data. Se trascini in orizzontale, sposti invece le date.

Ogni spostamento è un solo passo per *Annulla* (Ctrl+Z).

### Tenere aggiornati i numeri WBS

Guarda il pulsante *WBS auto* in *Pianificazione › Struttura*.

- **Attivo (il predefinito in un nuovo progetto).** Viene attivato anche dopo che apri un file senza questa impostazione, se tutti i codici WBS corrispondono già alla numerazione dell'albero (1, 1.1, 1.2 …). I codici non cambiano. Anche un file vuoto senza questa impostazione diventa *sì*, proprio come un nuovo progetto. L'app rinumera tutto l'albero a ogni aggiunta, eliminazione e spostamento. Il codice WBS è allora non modificabile: non puoi digitarlo nella tabella attività né nel pannello *Proprietà*. *Rinumera WBS* è disattivato.
- **Disattivo.** Il predefinito in un file con codici propri, come *A1000*, oppure con un codice che differisce dall'albero. I codici restano come sono, anche dopo spostamenti e rientri. Li digiti tu stesso, nella colonna *WBS* o nel campo *Codice WBS* in *Proprietà*, oppure li fai rinumerare una volta con *Rinumera WBS*. Così si sovrascrivono anche i codici che hai digitato tu.

Se attivi *WBS auto*, l'app numera subito l'albero. Sia *WBS auto* sia *Rinumera WBS* si possono annullare con *Annulla*.

## Trappole e cosa fa l'app

**Il filtro, il raggruppamento o l'ordinamento è attivo.** L'ordine che vedi non è allora l'ordine della pianificazione, quindi l'app blocca la struttura. *Applica rientro* e *Riduci rientro* sono disattivati, con il suggerimento *Non disponibile durante filtro/raggruppamento/ordinamento*. Alt+→ e il trascinamento mostrano lo stesso testo in una striscia rossa, con il pulsante *Cancella*. Così si tolgono in un colpo solo filtro, raggruppamento e ordinamento, e Ctrl+Z non li ripristina. La striscia resta visibile finché non clicchi la crocetta, non usi Ctrl+Z o Ctrl+Y, oppure non passi a un altro documento. *Rientra* e *Rimuovi rientro* mancano allora nel menu del clic destro.

Alt+↑ e Alt+↓ funzionano comunque in una vista così, senza messaggio. Con solo un filtro vedi subito il nuovo ordine. Con un ordinamento l'ordine nella pianificazione cambia davvero, ma lo vedi solo dopo *Cancella*.

**WBS auto è disattivo.** Succede con un file che ha codici propri, o con un file che salva l'impostazione come *no*. Una nuova attività riceve il codice che corrisponde al suo posto nell'albero, anche se un'altra attività ha già quel codice. Così possono comparire numeri doppi. Anche dopo un rientro i codici non corrispondono più all'albero. *Rinumera WBS* risolve entrambi i problemi.

**Un'attività cardine riceve sottoattività.** Un'attività cardine è un momento e non ha sottoattività. L'app toglie il contrassegno di cardine e ti avvisa.

**Un'attività con assegnazioni di risorse riceve sottoattività.** Un'attività di riepilogo non ha assegnazioni proprie. Quindi l'app chiede prima che cosa fare con quelle assegnazioni, nella finestra *L'attività diventa un'attività di riepilogo*. Questo succede quando fai un rientro, usi *Aggiungi sottoattività* o *Aggiungi cardine* su un'attività, inserisci un modello, e in *Modifica attività* quando scegli una nuova *Attività padre*: per un'attività esistente e per una nuova attività. In *Modifica attività* la domanda arriva prima del salvataggio. Se scegli *Annulla* lì, *Modifica attività* resta aperta con le tue modifiche. Scegli:

- *Annulla*: non cambia nulla, anche la struttura resta com'era.
- *Rimuovi assegnazione*: l'attività riceve le sue sottoattività e le sue assegnazioni vengono rimosse. Anche il lavoro effettivo di quelle assegnazioni viene rimosso.
- *Sposta a «…»*: le assegnazioni passano alla prima nuova sottoattività che può portarle, con il loro lavoro effettivo. Un cardine o un'attività di riepilogo non porta assegnazioni.

Se quella sottoattività ha già la stessa risorsa, o se non c'è una sottoattività adatta, *Sposta* è disattivato. Un blocco arancione nella finestra ti dice perché.

Se un'assegnazione ha già lavoro effettivo, il blocco arancione ti dice quante ore per risorsa, per esempio *L'assegnazione di Metselaar ha già 8 ore di lavoro effettivo. Rimuovendola, quel lavoro va perso.* *Annulla* è allora il pulsante predefinito: Invio non cambia nulla. Se vuoi comunque rimuovere l'assegnazione, clicca tu stesso su *Rimuovi assegnazione*.

Mentre la finestra è aperta, nessuna scorciatoia fuori dalla finestra funziona, anche *Annulla*, *Incolla*, Canc, F5 e Ctrl+S. Se un'azione crea più attività di riepilogo in una volta, la finestra mostra le risorse per attività, e la tua scelta vale per tutte. Un solo *Annulla* (Ctrl+Z) annulla l'intera azione.

**Una relazione creerebbe un ciclo.** Le relazioni di un'attività di riepilogo valgono anche per le sue sottoattività. Se uno spostamento creerebbe per questo un ciclo, l'app lo rifiuta con il messaggio *This move would create a cycle in the schedule (…)*. Non cambia nulla.

**Una relazione tra un'attività e la propria fase.** Se metti un'attività sotto una fase con cui ha già una relazione, quella relazione resta, ma non conta più nel calcolo. L'app ti avvisa. Su relazioni e ritardo delle attività di riepilogo puoi leggere di più in [Relazioni e ritardo](docs://uitleg-relaties).

**La pianificazione non è più aggiornata.** Uno spostamento verso un'altra fase può cambiare le date. Premi **Calcola** (F5). Il solo scambio di ordine nella stessa fase non lo fa.

## Vedi anche

- [Aggiungere attività e cardini](docs://howto-taken-en-mijlpalen-toevoegen): metti le nuove attività nel posto giusto.
- [Salvare e inserire modelli WBS](docs://howto-wbs-sjablonen): riusa un'intera fase.
- [Aggiungere relazioni](docs://howto-relaties-leggen): collega le attività tra loro.
- [Selezionare, eliminare e annullare attività](docs://howto-taken-selecteren-verwijderen): annulla uno spostamento.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): quattro fasi con le loro sottoattività, nel modo in cui le costruisci con i rientri.
