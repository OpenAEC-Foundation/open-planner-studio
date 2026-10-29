# Scorciatoie da tastiera

Tutte le combinazioni di tasti dell'app, raggruppate come nella finestra *Scorciatoie da tastiera*. I tasti sono fissi: non puoi riassegnarli. Come lavorare con il mouse e i menu è spiegato nelle guide pratiche; qui cerchi un tasto.

## Come leggere questo elenco

**Mac.** Dove questa guida dice Ctrl, su un Mac usa Cmd (⌘). Alt è Opzione (⌥). Su un Mac la finestra *Scorciatoie da tastiera* mostra i simboli ⌥, ⇧ e ⌘ al posto di Alt, Shift e Ctrl. Anche Ctrl funziona nell'app su un Mac.

**Combinazione esatta.** L'app confronta Ctrl, Shift e Alt in modo esatto. Ctrl+Alt+S quindi non fa nulla: i tasti devono corrispondere esattamente all'elenco.

**Aprire la finestra.** Premi Ctrl+/ oppure scegli *Impostazioni › Scorciatoie da tastiera › Scorciatoie da tastiera*. Anche Ctrl+/ chiude di nuovo la finestra. La finestra è di sola lettura. Non mostra tutti i tasti di questa guida: dei tasti della tabella mostra solo le prime sei voci, e non i tasti delle finestre di dialogo in fondo a questo articolo.

**Quando un tasto non funziona.** Ogni voce indica le sue limitazioni. Tre regole valgono quasi sempre:

- In un campo di input, un elenco a discesa o una casella di testo l'app non intercetta i tasti, quindi puoi semplicemente digitare. Eccezioni: F5, Ctrl+S, F11 ed Esc durante la presentazione funzionano anche in un campo. Se il focus è su un elenco a discesa chiuso, funzionano anche i tasti con Ctrl, per esempio Ctrl+Z dopo una scelta (non Ctrl+Delete e Ctrl+Backspace). Questo non vale in un elenco aperto o in una finestra di dialogo. Nell'app compilata (desktop e la versione web sul sito) vale lo stesso per Ctrl+Shift+S, Ctrl+O e Ctrl+N.
- Mentre una finestra di dialogo o un'altra finestra è aperta, i tasti contrassegnati sotto con *Non in una finestra di dialogo* non funzionano. Questo vale anche per il tour, la finestra di benvenuto e le domande in attesa di risposta, come la domanda se salvare le modifiche e il consenso all'installazione di un'estensione. La maggior parte di questi tasti non funziona nemmeno in modalità presentazione. Eccezione: i tasti di modifica Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Y e Delete/Backspace funzionano durante la presentazione.
- Il cambio di documento (Ctrl+1 fino a 9, Ctrl+N, Ctrl+O) non funziona nemmeno finché *File › Impostazioni progetto* contiene modifiche che non hai ancora confermato con *Applica*. Scarta o applica prima quelle modifiche.

## File

**F5** — *Calcola*: ricalcola la pianificazione, come il pulsante *Calcola* (*Home › Pianificazione › Calcola*). Funziona anche in un campo di input.

**Ctrl+S** — *Salva*: salva il progetto. Funziona anche in un campo di input.

**Ctrl+Shift+S** — *Salva come*: chiede dove deve essere salvato il file. In una versione di sviluppo non funziona in un campo di input.

**Ctrl+O** — *Apri*: apre un file, di solito in una nuova scheda. Non in una finestra di dialogo e non con modifiche non applicate in Impostazioni progetto.

**Ctrl+N** — *Nuovo progetto*: apre la finestra *Nuovo progetto*. Non in una finestra di dialogo e non con modifiche non applicate in Impostazioni progetto.

L'app compilata (desktop e la versione web sul sito) blocca anche alcuni tasti del browser, così non danno fastidio: Ctrl+R e Ctrl+Shift+R (ricarica), F12, Ctrl+Shift+I e Ctrl+Shift+J (strumenti per sviluppatori), Ctrl+U (visualizza sorgente) e Ctrl+G, Ctrl+F e Ctrl+L (trova e barra degli indirizzi). Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+N e F5 vanno all'app stessa.

## Modifica

**Ctrl+C** — *Copia*: copia le attività selezionate. Solo con una selezione. Non in una finestra di dialogo. Non in *File*, non nelle schede *Rapporto* e *IFC* e non mentre il pannello risorse completo è aperto. Nella tabella attività Ctrl+C copia le celle selezionate; la tabella gestisce questo da sola.

**Ctrl+V** — *Incolla*: incolla le attività copiate. Non in una finestra di dialogo. Non in *File*, non nelle schede *Rapporto* e *IFC* e non mentre il pannello risorse completo è aperto, perché lì la tabella attività non è visibile. Nella tabella attività incolla le celle.

**Ctrl+Z** — *Annulla*. Non in una finestra di dialogo: chiudi prima la finestra.

**Ctrl+Y** oppure **Ctrl+Shift+Z** — *Ripeti*: ripete ciò che hai annullato. Non in una finestra di dialogo.

**Delete** oppure **Backspace** — *Elimina*: elimina le attività selezionate. Solo con una selezione. Non in una finestra di dialogo. Non in *File*, non nelle schede *Rapporto* e *IFC* e non mentre il pannello risorse completo è aperto, perché lì la tabella attività non è visibile. In una cella della tabella attività, Delete e Backspace cancellano solo il contenuto della cella (vedi *Tabella*).

**F2** — *Modifica...*: apre la finestra di dialogo dell'attività per la prima attività selezionata. Solo con una selezione. Non in una finestra di dialogo. In una cella della tabella attività, F2 avvia la modifica della cella.

**Ctrl+A** — *Seleziona tutto*: seleziona tutte le attività. Non in una finestra di dialogo.

**Esc** — *Deseleziona*: annulla la selezione e nello stesso tempo disattiva la modalità relazione, la modalità divisione e il tracciamento percorso. Chiude anche la finestra di dialogo dell'attività e la panoramica del progetto. Durante la presentazione Esc chiude solo la presentazione (vedi *Visualizza*). In un campo di input Esc non fa nessuna di queste cose.

## Struttura

**Alt+Shift+→** oppure **Alt+→** — *Applica rientro*: sposta le attività selezionate di un livello più in basso nella WBS. Solo con una selezione, non in una finestra di dialogo.

**Alt+Shift+←** oppure **Alt+←** — *Riduci rientro*: porta le attività selezionate un livello più in alto. Solo con una selezione, non in una finestra di dialogo.

Rientro, riduzione del rientro e inserimento sopra o sotto un'attività selezionata funzionano solo nella vista ad albero semplice: senza filtro, raggruppamento o ordinamento. In ogni altra vista l'app li rifiuta con un messaggio, perché l'ordine mostrato non è allora l'ordine del progetto. L'inserimento senza selezione funziona in ogni vista.

**Insert** — *Inserisci sopra*: inserisce una nuova attività sopra l'attività selezionata più in alto, allo stesso livello. Senza selezione l'attività va in fondo, in ogni vista. Non in una finestra di dialogo.

**Ctrl+I** — *Inserisci sotto*: inserisce una nuova attività sotto l'attività selezionata più in basso, allo stesso livello. Senza selezione l'attività va in fondo. Non in una finestra di dialogo.

**Ctrl+M** — *Aggiungi cardine*: aggiunge un nuovo cardine in fondo all'elenco, anche se hai selezionato un'attività. Non in una finestra di dialogo.

**Alt+↑** — *Sposta attività in alto*: sposta la prima attività selezionata di un posto in alto, all'interno del suo livello. Solo con una selezione, non in una finestra di dialogo.

**Alt+↓** — *Sposta attività in basso*: lo stesso, di un posto in basso.

## Visualizza

**F11** — *Presentazione*: attiva o disattiva la modalità presentazione. L'app chiede anche alla finestra di passare a schermo intero. Funziona anche in un campo di input. Nel browser F11 non avvia la presentazione: il browser mette la finestra a schermo intero da solo e l'app resta com'è. In un browser F11 ferma una presentazione in corso.

**Esc** (durante la presentazione) — *Esci dalla presentazione*. Funziona anche in un campo di input. Questo ha la precedenza su *Deseleziona*.

**Ctrl+=** — *Ingrandisci*: ingrandisce la linea temporale di un passo fisso. Non in un campo di input.

**Ctrl+-** — *Riduci*: riduce lo zoom di un passo fisso.

**+** oppure **=** — *Ingrandisci*: ingrandisce del 10% attorno al centro dell'area Gantt. Non in un campo di input, e solo quando la linea temporale Gantt è visibile (quindi non sulle schede *Tabella*, *IFC* e *Rapporto*).

**-** — *Riduci*: riduce del 10%. Stesse limitazioni.

**0** — *Reimposta zoom*: riporta lo zoom al valore predefinito e scorre all'inizio. Stesse limitazioni.

**Ctrl+0** — *Adatta al progetto*: ingrandisce o riduce in modo che l'intero progetto sia visibile. Stesse limitazioni.

**Ctrl+/** — *Mostra scorciatoie*: apre e chiude la finestra *Scorciatoie da tastiera*. Funziona anche quando un'altra finestra di dialogo è aperta, ma non durante il tour e la finestra di benvenuto.

**Ctrl+Shift+H** — *Istogramma*: attiva o disattiva l'istogramma, come il pulsante *Istogramma* (*Risorse › Istogramma › Istogramma* oppure *Vista › Pannelli › Istogramma*). L'app ricorda la tua scelta.

**Ctrl+Shift+L** — *Avvisi*: attiva o disattiva il pannello avvisi, come il pulsante *Avvisi* (*Vista › Pannelli › Avvisi* oppure *Pianificazione › Pianificazione › Avvisi*).

## Navigazione

**Ctrl+P** — *Vai alla scheda Report*: ti porta alla scheda *Rapporto*. Quindi non è un comando di stampa. Non in una finestra di dialogo.

**F1** — *Apri guida*: apre *File › Guida*. Non in un campo di input e non in una finestra di dialogo. In una finestra usa il punto interrogativo in alto a destra: apre la guida sull'articolo di quella finestra (vedi [La barra multifunzione, scheda per scheda](docs://ref-lint), alla voce *Guida*).

**Ctrl+1** fino a **Ctrl+9** — *Cambia documento*: va dal primo al nono documento aperto. Se quel documento non esiste, non succede nulla. Non in una finestra di dialogo e non con modifiche non applicate in Impostazioni progetto.

**Ctrl+Home** — *Vai a oggi*: scorre la linea temporale in modo che una data sia a sinistra della vista. Si tratta della data di stato, se ne hai impostata una; altrimenti di oggi. Quindi l'etichetta dice «oggi», anche quando la linea temporale salta alla data di stato. Zoom e inizio della linea temporale restano invariati. Se una cella della tabella attività ha il focus, Ctrl+Home va invece alla prima cella della tabella (vedi *Tabella*).

## Tabella

Questi tasti funzionano nella tabella attività (sulla scheda *Tabella* e nella tabella a sinistra del Gantt) quando una cella ha il focus. La finestra *Scorciatoie da tastiera* mostra le prime sei voci; le altre non ci sono.

**Tab** e **Shift+Tab** — *Cella successiva/precedente*: va alla cella successiva o precedente e, alla fine di una riga, alla riga successiva. Sull'ultima cella (Tab) o sulla prima (Shift+Tab) il focus lascia la tabella.

**Enter** oppure **F2** — *Modifica cella*: apre l'editor della cella. Se la cella è di sola lettura, la tabella mostra un messaggio.

**Una lettera, una cifra o un altro carattere** — *Digitare sostituisce il contenuto della cella*: avvia la modifica e sostituisce il contenuto con ciò che digiti.

**Insert** — *Inserisci sopra*: inserisce un'attività sopra la riga attiva.

**Delete** oppure **Backspace** — *Cancella contenuto della cella*: cancella il contenuto delle celle selezionate, non l'attività stessa. La finestra *Scorciatoie da tastiera* elenca solo Delete.

**Esc** — *Deseleziona*: sposta il focus sulla tabella nel suo insieme, così che il Tab successivo lascia la tabella, e cancella anche la selezione come descritto sopra.

**Tasti freccia** — vanno alla cella sopra, sotto, a sinistra o a destra. Aggiungi Shift per estendere la selezione.

**Home** e **End** — alla prima o all'ultima colonna della riga. Con Ctrl aggiunto, alla prima cella della prima riga e all'ultima cella dell'ultima riga. Aggiungi Shift per estendere la selezione.

**Page Up** e **Page Down** — di una schermata in alto o in basso. Aggiungi Shift per estendere la selezione.

**Enter** (durante la modifica) — conferma l'input e va alla stessa colonna nella riga successiva. Shift+Enter va alla riga precedente.

**Esc** (durante la modifica) — annulla la modifica senza mantenere l'input.

La tabella delle risorse ha una gestione dei tasti propria tra i campi di input; quella non è in questo elenco.

## Finestre di dialogo e altre finestre

Questi tasti non sono nella finestra *Scorciatoie da tastiera*.

**Esc** — chiude la finestra di dialogo in primo piano (annulla). Anche in *File* (Backstage) Esc chiude la schermata, a meno che in primo piano non ci sia una finestra di dialogo o un elenco a discesa aperto.

**Enter** — conferma la finestra di dialogo in primo piano, come il pulsante principale, nelle finestre che lo supportano. Enter non lo fa in una casella di testo su più righe, in un elenco a discesa aperto o durante l'input IME.

**Esc** durante un gesto nel Gantt — annulla un riquadro di selezione (la selezione resta com'era) e un gesto di divisione (una divisione già fatta viene annullata).

**Enter** ed **Esc** nel selettore del tipo di relazione — Enter conferma, Esc annulla.

**Freccia sinistra e freccia destra** sul divisore tra la tabella attività e la linea temporale — sposta il divisore di 10 pixel alla volta, di 40 con Shift. Il divisore deve avere il focus da tastiera.

**Freccia su e freccia giù** nell'elenco delle risorse dell'istogramma — scelgono la risorsa precedente o successiva. Il campo dell'istogramma deve avere il focus.

## Vedi anche

- [Creare e stampare un report](docs://howto-rapport-maken-en-afdrukken): perché Ctrl+P non apre una finestra di stampa.
- [Dividere un'attività](docs://howto-taak-splitsen): il gesto di divisione che Esc annulla.
- [Presentare su uno schermo grande](docs://howto-presentatie): F11 ed Esc in pratica.
- [Attivare il salvataggio automatico](docs://howto-automatisch-opslaan): salvare con Ctrl+S insieme al salvataggio automatico.
- [Trascinare, spostare e ingrandire nel Gantt](docs://howto-gantt-bedienen): i gesti del mouse accanto ai tasti.
