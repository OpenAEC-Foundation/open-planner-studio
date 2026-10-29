# Menu del tasto destro

Quali menu apre il tasto destro del mouse nel Gantt e nella tabella attività, che cosa fa ogni voce e a quali attività si applica. Le voci che esistono anche come pulsante o come scorciatoia sono in [La barra multifunzione, scheda per scheda](docs://ref-lint) e [Scorciatoie da tastiera](docs://ref-sneltoetsen).

## Quale menu dove

Ci sono quattro menu. Quale menu ottieni dipende da dove fai clic:

- **Su una barra attività nel Gantt** — il menu attività, con *Avvia relazione da qui* in cima.
- **Su un'attività nella tabella attività** — lo stesso menu attività, senza quella voce in cima. Vale per la tabella attività a sinistra del Gantt e per la scheda *Tabella*.
- **Su un'intestazione di gruppo nella tabella attività** — un piccolo menu per espandere e comprimere i gruppi. Le intestazioni di gruppo compaiono solo quando raggruppi, per esempio con il layout *Diagramma delle risorse*.
- **Su uno spazio vuoto** — nel Gantt accanto o sotto le barre, e nella tabella attività sotto l'ultima attività o sulla riga grigia *Nuova attività*. Il menu contiene *Nuova attività*, *Aggiungi cardine* e *Incolla*; nel Gantt anche *Reimposta zoom* e *Adatta al progetto*. Una nuova attività o un nuovo cardine va in fondo alla lista. Nel Gantt inizia alla data in cui hai fatto clic; nella tabella attività si apre subito la cella del nome, così puoi scrivere.

Sulla fascia di un'intestazione di gruppo nel Gantt, il tasto destro apre il menu per lo spazio vuoto; l'intestazione di gruppo stessa ha un menu solo nella tabella attività. Un clic destro nell'intestazione della scala temporale non fa nulla. Le intestazioni delle colonne della tabella attività hanno un proprio menu, descritto in [Regolare le colonne della tabella](docs://howto-tabelkolommen-aanpassen).

**A quali attività si applica una voce?** Fai clic su un'attività, ma la selezione stabilisce l'ambito. Se l'attività su cui fai clic fa parte della selezione, la voce si applica a tutta la selezione. Se non ne fa parte, si applica solo a quell'attività. Con un clic destro su una barra nel Gantt o su una riga della tabella attività, quell'attività sostituisce la selezione se non ne faceva parte. Ogni voce che cambia qualcosa corrisponde a un solo passo di *Annulla*, anche per tutta una selezione.

## Il menu attività

Le voci sono in quest'ordine. Una linea tra gruppi è un separatore nel menu.

**Avvia relazione da qui** — solo nel Gantt, su una barra. Attiva la modalità relazione con questa attività selezionata; poi trascini fino al successore. Vedi [Aggiungere relazioni](docs://howto-relaties-leggen).

**Rimuovi l'interruzione** e **Rimuovi tutte le pause** — solo nel Gantt, su una barra con interruzioni. *Rimuovi l'interruzione* è presente solo se fai clic su un'interruzione o sul pezzo che segue e l'interruzione è modificabile; rimuove quella sola interruzione. *Rimuovi tutte le pause* rimuove tutte le interruzioni, incluse quelle di un file di origine che non puoi modificare. Vedi [Dividere un'attività](docs://howto-taak-splitsen).

**Modifica...** — apre la finestra *Modifica attività* per questa attività. Vedi [Finestra attività e pannello proprietà](docs://ref-taak-eigenschappen).

**Inserisci sopra** e **Inserisci sotto** — inserisce una nuova attività sopra l'attività più in alto o sotto l'attività più in basso dell'ambito, allo stesso livello. Funziona solo nella vista ad albero pura, senza filtro, raggruppamento o ordinamento; altrimenti l'app rifiuta con un messaggio. Vedi [Aggiungere attività e cardini](docs://howto-taken-en-mijlpalen-toevoegen).

**Aggiungi sottoattività** — aggiunge una nuova attività come sottoattività dell'attività su cui hai fatto clic, in fondo alle sue sottoattività. Solo per quella attività, non per l'intera selezione.

**Aggiungi cardine** — aggiunge un cardine come sottoattività dell'attività su cui hai fatto clic. Solo per quella attività.

**Aggiungi relazione** — fa lo stesso di *Avvia relazione da qui*: attiva la modalità relazione con questa attività selezionata. Nella tabella attività la voce è disattivata se il Gantt non è visibile, con il suggerimento *Disponibile solo quando il diagramma di Gantt è visibile*.

**Aumenta rientro** e **Riduci rientro** — sposta le attività dell'ambito di un livello più in basso o di un livello più in alto nella WBS. Queste due sono solo nella vista ad albero pura. Vedi [Modificare la struttura](docs://howto-structuur-aanpassen).

**Attiva/disattiva cardine** — trasforma l'attività in un cardine, o di nuovo in attività. Il nuovo stato dipende dall'attività su cui hai fatto clic e vale per tutto l'ambito: se quella è un'attività, tutte le attività dell'ambito diventano cardini. Un'attività di riepilogo e un'attività con assegnazioni non diventano cardine; il resto dell'ambito sì, e ricevi un messaggio per ogni motivo.

**Assegna calendario ▸** — un sottomenu con *Calendario di progetto* (l'attività allora non ha un calendario proprio) e sotto di esso i calendari disponibili. La scelta attuale ha un segno di spunta. Un'attività che è già su quel calendario non conta e non crea un passo extra di *Annulla*. Vedi [Creare e assegnare un calendario](docs://howto-kalender-maken-en-toewijzen).

**Avanzamento ▸** — un sottomenu con 0%, 25%, 50%, 75% e 100%. Il valore attuale ha un segno di spunta. Un'attività di riepilogo non ha un avanzamento proprio: se ce n'è una nell'ambito, le sue attività foglia ricevono la percentuale. Senza data di stato, l'app imposta la data di stato su oggi, con un messaggio. Un'attività pianificata per iniziare solo dopo la data di stato e senza ancora un inizio effettivo, porta prima a una domanda sull'inizio effettivo; se annulli, non cambia nulla. Vedi [Aggiornare l'avanzamento](docs://howto-voortgang-bijwerken).

**Priorità ▸** — un sottomenu con *Bassa* (100), *Normale* (500) e *Alta* (900), la priorità di livellamento dell'attività. Il valore attuale ha un segno di spunta. Vedi [Livellamento delle risorse](docs://uitleg-nivelleren).

**Traccia percorso** — mostra i predecessori e i successori di questa attività. Se il tracciamento è già attivo, la voce si chiama *Interrompi tracciamento*. Vedi [Tracciare un percorso](docs://howto-pad-traceren).

**Comprimi**, **Espandi** e **Salva ramo come modello** — solo per un'attività di riepilogo. *Comprimi* e *Espandi* ci sono sempre entrambe, anche se l'attività è già compressa o espansa, e valgono per tutto l'ambito. *Salva ramo come modello* salva l'attività con le sue sottoattività e le relazioni tra di esse come modello WBS. Vedi [Salvare e inserire modelli WBS](docs://howto-wbs-sjablonen).

**Elimina** — elimina le attività dell'ambito, con le loro sottoattività. Non c'è una conferma; le recuperi con Ctrl+Z, con un solo passo per tutto l'ambito. Vedi [Selezionare, eliminare e annullare attività](docs://howto-taken-selecteren-verwijderen).

## Il menu di un'intestazione di gruppo

Questo menu esiste solo nella tabella attività, su un'intestazione di gruppo:

**Comprimi gruppo** o **Espandi gruppo** — comprime o espande solo questo gruppo. La voce mostra che cosa puoi fare.

**Espandi tutto** e **Comprimi tutto** — espandono o comprimono tutti i gruppi in una volta.

Imposti il raggruppamento con un layout. Vedi [Creare e usare un layout](docs://howto-layouts-gebruiken).

## Vedi anche

- [Trascinare, spostarsi e ingrandire nel Gantt](docs://howto-gantt-bedienen): che cosa fa trascinare con il tasto sinistro e con il tasto centrale del mouse.
- [La barra multifunzione, scheda per scheda](docs://ref-lint): i pulsanti con le stesse azioni.
- [Scorciatoie da tastiera](docs://ref-sneltoetsen): i tasti che corrispondono.
