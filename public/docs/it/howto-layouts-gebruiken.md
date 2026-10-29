# Creare e usare un layout

Obiettivo: passare con un clic da una vista all'altra della pianificazione, per esempio solo le attività critiche, le attività per squadra o un altro ordine di ordinamento.

## Quando ti serve

Durante la riunione in cantiere il cliente vuole vedere solo le attività critiche. Poi il responsabile di cantiere vuole vedere per squadra chi serve e quando. Poi tu vuoi di nuovo l'intera pianificazione. Impostare ogni volta filtri, raggruppamenti e ordinamenti è scomodo. Un **layout** memorizza una vista di questo tipo come pulsante nella barra multifunzione.

Un layout può memorizzare sei elementi: il filtro, il raggruppamento, l'ordinamento, le colonne della tabella attività accanto al Gantt, la scala temporale, e le linee di relazione e le sovrapposizioni (baseline, linea di avanzamento, linea della data di stato, evidenziazione delle risorse, banda del margine e colori delle fasce). Cambia solo ciò che spunti quando fai clic sul pulsante. Il resto della vista resta com'è.

Con un layout filtri, raggruppi e ordini la vista. I pulsanti separati *Filtro…*, *Raggruppa…* e *Ordina…* ora esistono solo dietro un'impostazione nascosta (vedi le insidie).

## Passi

### Usare un layout esistente

1. Scegli la scheda *Vista*. Nel gruppo *Layout* c'è un pulsante per ogni layout. Per impostazione predefinita è *Diagramma delle risorse*.
2. Fai clic su di esso. *Diagramma delle risorse* raggruppa le attività per risorsa, ordina all'interno di ogni gruppo per inizio e disattiva le linee di relazione. Un'attività con due risorse compare sotto entrambe.
3. Fai di nuovo clic per disattivare il layout. La vista torna com'era prima del tuo clic.

Ogni clic è un passo per *Annulla* (Ctrl+Z), sia per l'attivazione sia per la disattivazione.

### Creare un layout personale

1. Nel gruppo *Layout* fai clic su *Nuovo layout*. Si apre la finestra *Nuovo layout*.
2. Digita un *Nome* e scegli un'*Icona*.
3. Sotto *Che cosa memorizza questo layout?* ci sono le sei parti, ognuna con una casella di controllo. Una nuova finestra parte con tutte le parti spuntate e riempite con ciò che vedi ora sullo schermo. Togli la spunta da tutto ciò che il layout non deve cambiare. Se vuoi solo un filtro, lascia attivo solo *Filtro*. *Riprendi la vista corrente* riempie di nuovo tutte le parti con ciò che vedi sullo schermo.
4. Imposta le parti.
5. Fai clic su *Salva*.

Il layout è ora un pulsante nella barra multifunzione, ma non è ancora applicato. Fai clic sul pulsante per attivarlo.

### Impostare il filtro

Sotto *Filtro* crei le regole. Fai clic su *+ regola*, scegli un *Campo*, un *Operatore* e un valore. Se vuoi solo le attività critiche: campo *Critica*, operatore *uguale a*, valore *Sì*. I campi comprendono *Nome attività*, *Inizio*, *Fine*, *Margine totale*, *Avanzamento* e *Cardine*, oltre ai tuoi codici attività e campi e a *Risorse*. Gli operatori dipendono dal tipo di campo: per il testo puoi scegliere *contiene*, per numeri e date *tra*.

Gli operatori disponibili dipendono dal tipo di campo:

- Testo (*Nome attività*, *WBS*): *uguale a*, *diverso da*, *contiene*, *inizia con* e *è vuoto*.
- Numero e data (*Margine totale*, *Inizio*, *Avanzamento*): *uguale a*, *diverso da*, *minore di*, *minore o uguale a*, *maggiore di*, *maggiore o uguale a*, *tra* e *è vuoto*. Con *tra* ci sono due campi: per un numero con *Da* e *A* come suggerimento, per una data senza suggerimento (la prima data è l'inizio, la seconda la fine).
- Sì/no (*Critica*, *Cardine*, *Quasi critica*): *uguale a* e *diverso da*, con il valore *Sì* o *No*.
- Scelta (*Categoria di lavoro*, un codice attività): *uguale a*, *diverso da*, *è uno tra* (con valori a casella di controllo) e *è vuoto*.
- *Risorse*: *è uno tra* e *è vuoto*.
- *In corso*: solo *tra*, con due date (da e a).

Con il campo *In corso*, l'operatore *tra* e due date ottieni tutte le attività che sono in corso in un momento qualsiasi di quel periodo, per esempio tutto ciò che è attivo a giugno.

Combini più regole con l'elenco in alto: *Tutte le seguenti (AND)* mostra le attività che soddisfano tutte le regole, *Una qualsiasi delle seguenti (OR)* le attività che soddisfano almeno una regola. Con *+ gruppo* aggiungi un sottogruppo con regole proprie.

Il filtro guarda alle attività stesse. Le fasi (attività di riepilogo) a cui appartiene un'attività restano visibili in grigio, così vedi dove si colloca l'attività. Se raggruppi anche, quelle fasi grigie scompaiono.

### Raggruppare e ordinare

Sotto *Raggruppa* aggiungi un campo con *+ livello*. Ci sono al massimo due livelli di raggruppamento. Senza raggruppamento vedi l'albero della WBS. Sotto *Ordina* aggiungi un campo con *+ livello* e scegli *Crescente* o *Decrescente*. Con due livelli, il secondo decide quando i valori del primo sono uguali.

### Provare subito senza un pulsante

Nella finestra fai clic su *Applica senza salvare*. Le parti spuntate vanno sullo schermo, ma non viene aggiunto alcun pulsante. Questo è utile per un filtro che ti serve una sola volta. Ctrl+Z lo annulla.

### Modificare, copiare o eliminare un layout

Fai clic con il pulsante destro sul pulsante del layout. Scegli *Modifica…*, *Duplica* o *Elimina*. *Elimina* chiede prima una conferma. Una copia si chiama *nome (copia)*. Un layout integrato, come *Diagramma delle risorse*, non puoi modificarlo né eliminarlo; lo duplichi per creare una versione tua.

### Più layout insieme

Layout che non memorizzano le stesse parti possono essere attivi insieme. Se hai un layout che memorizza solo il filtro *Critica uguale a Sì* (chiamalo, per esempio, *Solo critiche*) e lo attivi insieme a *Diagramma delle risorse* (raggruppamento, ordinamento, linee di relazione), ottieni le attività critiche per risorsa. Se due layout memorizzano la stessa parte, per esempio entrambi un filtro, il secondo prende il posto del primo e il primo si spegne. Se disattivi di nuovo quel secondo layout, torni alla vista di prima del primo clic, non al primo layout.

## Insidie e che cosa fa l'app

**Ti dimentichi di togliere la spunta alle parti.** Un layout che memorizza anche colonne, scala temporale e sovrapposizioni riporta queste parti allo stato salvato a ogni clic. Lo zoom allora salta via, mentre volevi solo un filtro. Controlla nella finestra che siano spuntate solo le parti previste.

**Una regola incompleta non mostra nulla.** Se non scegli un valore per un campo sì/no (dice ancora *—*) o lasci vuote le date di *In corso*, nessuna attività corrisponde e l'elenco resta vuoto. Completa la regola.

**Una modifica manuale disattiva il layout.** Se modifichi tu stesso una parte che il layout memorizza, per esempio *Linee di relazione* mentre *Diagramma delle risorse* è attivo, quel layout si disattiva e le altre parti tornano alla vista di prima del layout. Lo zoom disattiva un layout che memorizza la scala temporale, e allargare una colonna disattiva un layout che memorizza le colonne. Il resto della vista allora resta com'è. *Diagramma delle risorse* non memorizza la scala temporale, quindi lo zoom non lo influenza.

**Le colonne valgono per la tabella attività accanto al Gantt.** La parte *Colonne* memorizza le colonne della tabella a sinistra della linea temporale. La tabella nella scheda *Tabella* mantiene le proprie colonne. Come scegli le colonne è spiegato in [Regolare le colonne della tabella](docs://howto-tabelkolommen-aanpassen).

**I comandi Rientra e Riduci rientro sono disattivati.** Finché un filtro, un raggruppamento o un ordinamento è attivo, l'ordine visualizzato non è l'ordine della pianificazione. *Rientra* e *Riduci rientro* sono allora disattivati, con il suggerimento *Non disponibile durante filtro/raggruppamento/ordinamento*. Disattiva il layout per regolare di nuovo la struttura, come descritto in [Regolare la struttura](docs://howto-structuur-aanpassen).

**La barra di stato non tiene conto del filtro.** *Attività:* nella barra di stato mostra il numero di attività dell'intero progetto, anche se un filtro ne mostra solo una parte.

**I layout sono sul tuo dispositivo, non nel progetto.** L'app conserva i tuoi layout e le colonne per tutti i tuoi progetti su questo dispositivo. Le sovrapposizioni di un layout (baseline, linea di avanzamento e le altre) valgono per tutti i tuoi progetti. Il filtro, il raggruppamento e l'ordinamento attivi in questo momento appartengono al progetto aperto, ma non entrano nel file del progetto: dopo il salvataggio e la riapertura la vista è di nuovo pulita. Inoltre non rendono il progetto «modificato».

**I pulsanti separati sono nascosti.** *Colonne…*, *Filtro…*, *Raggruppa…* e *Ordina…* come pulsanti separati sulla scheda *Vista* sono una vista classica. Li riporti con *Mostra i pulsanti di vista classici* sotto *Funzioni legacy* nella scheda *Avanzate* della finestra *Impostazioni app* (⚙ nella barra del titolo). Preferisci i layout.

## Vedi anche

- [Regolare le colonne della tabella](docs://howto-tabelkolommen-aanpassen): scegliere, spostare e fissare le colonne stesse.
- [Creare e stampare un report](docs://howto-rapport-maken-en-afdrukken): mettere la vista su carta con *Segui vista*.
- [Regolare la struttura](docs://howto-structuur-aanpassen): perché non puoi rientrare mentre filtri.
