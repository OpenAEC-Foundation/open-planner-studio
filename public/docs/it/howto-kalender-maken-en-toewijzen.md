# Creare e assegnare un calendario

Obiettivo: crea un calendario tuo, per esempio una settimana lavorativa di sei giorni, e assegnalo alle attività che devono essere calcolate in quel calendario.

## Quando ti serve

Un subappaltatore lavora anche il sabato. Una squadra lavora solo dal lunedì al giovedì. Un'attività cade in un momento in cui solo quella attività resta ferma. Il calendario di progetto ha quindi i giorni lavorativi sbagliati. Con un calendario tuo, l'app calcola quelle attività nei giorni giusti, e le altre restano sul calendario di progetto. Cosa fa esattamente l'app con un calendario, puoi leggerlo in [Calendari e giorni lavorativi](docs://uitleg-kalenders).

## Passaggi

### Creare un calendario

1. Scegli *Pianificazione › Calendario › Calendario*. Lo stesso pulsante si trova in *Impostazioni › Calendario › Calendario*. Si apre la finestra *Calendari*. A sinistra ci sono i calendari del progetto; il calendario di progetto ha una stella.
2. Sotto l'elenco, clicca sul pulsante con il segno più (*Nuovo calendario*). Il nuovo calendario è una copia di quello standard: dal lunedì al venerdì, dalle 07:00 alle 16:00 con un'ora di pausa e, se *Modalità cantiere* è attiva, le festività olandesi. Se vuoi usare un calendario esistente come base, selezionalo nell'elenco e clicca sul pulsante con i due fogli sotto l'elenco (*Duplica*).
3. Dai al calendario un nome sotto *Nome* che indichi chi lo usa, per esempio *Six-day week*.
4. Sotto *Giorni lavorativi*, clicca i giorni della settimana per attivarli o disattivarli. *Lun–ven* ripristina la settimana standard, con orario dalle 07:00 alle 16:00. Se il calendario ha fasce orarie, *Lun–ven* attiva solo da lunedì a venerdì e ogni giorno mantiene le proprie fasce. *Continuo (24/7)* attiva tutti e sette i giorni, dalle 00:00 alle 24:00.
5. Se serve, regola gli orari di lavoro: *Inizio (ora)*, *Fine (ora)*, *Inizio pausa* e *Durata pausa (minuti)*. Scrivi gli orari come HH:MM; con le frecce li aumenti o diminuisci di un quarto d'ora. Se imposti la durata della pausa a 0, il calendario lavora senza pausa. L'app calcola da sola il *Giorno lavorativo standard*. Se il calendario ha fasce orarie per giorno della settimana (per esempio da MS Project), non vedi questi campi, ma il blocco *Orari di lavoro*, anche con la pianificazione oraria disattivata; vedi [Impostare gli orari di lavoro](docs://howto-werktijden-instellen).
6. Se serve, regola le festività. Come funziona è spiegato in [Generare le festività e le ferie edili](docs://howto-feestdagen-genereren).
7. Clicca *Applica*. L'app ricalcola subito la pianificazione e chiude la finestra. Con *Annulla* scarti le modifiche. Se premi Invio in un campo di inserimento, le modifiche si salvano nel frattempo e l'app ricalcola anche, senza chiudere la finestra; *Annulla* ripristina poi solo ciò che hai cambiato dopo quel momento.

### Assegnare un calendario alle attività

Un nuovo calendario fa qualcosa solo quando un'attività lo usa. Ci sono due modi.

**Tramite il pannello Proprietà**

1. Seleziona l'attività. Se non vedi il pannello *Proprietà*, attivalo con *Vista › Pannelli › Proprietà*.
2. Sotto *Attività*, scegli il calendario nell'elenco *Calendario*. La prima scelta, *Calendario di progetto* con il nome dopo, significa che l'attività non ha un calendario proprio.

**Tramite il menu del clic destro**

1. Fai clic destro sull'attività, nella tabella attività o sulla barra nel diagramma di Gantt.
2. Scegli *Assegna calendario* e poi il calendario, oppure *Calendario di progetto* per togliere di nuovo il calendario proprio. Il calendario che si applica ora ha una spunta.
3. Se vuoi dare un calendario a più attività in una volta, selezionale prima con Ctrl (⌘ su Mac) e fai clic destro su una delle attività selezionate. La scelta vale per tutte le attività selezionate. Se fai clic destro su un'attività non selezionata, la scelta vale solo per quell'attività.

Una nuova scelta di calendario non rende ancora la pianificazione aggiornata: la barra di stato mostra *Non aggiornato — ricalcola (F5)*. Premi **Calcola** (F5), per esempio tramite *Home › Pianificazione › Calcola*. Se *Calcola automaticamente* è attivo (*Impostazioni › Progetto › Impostazioni app*, scheda *Pianificazione*, sezione *Calcolo*), l'app lo fa da sola.

### Cambiare il calendario di progetto

1. Apri *Pianificazione › Calendario › Calendario* e scegli il calendario nell'elenco.
2. Sopra i campi, clicca *Imposta come predefinito del progetto*. La stella passa a quel calendario.
3. Clicca *Applica*.

Si spostano solo le attività senza un calendario proprio.

### Eliminare un calendario

1. Apri la finestra *Calendari* e scegli il calendario nell'elenco.
2. Sotto l'elenco, clicca il pulsante con il cestino (*Elimina*). Quel pulsante è disattivato finché c'è un solo calendario.
3. Clicca *Applica*. Attività e risorse che usavano il calendario ricadono sul calendario di progetto. Se elimini il calendario di progetto stesso, il primo calendario nell'elenco diventa il calendario di progetto.

## Problemi comuni e cosa fa l'app

**Nessun giorno lavorativo.** Se disattivi tutti i giorni della settimana, l'app non può calcolare. Durante il calcolo mostra *Nel calendario non sono impostati giorni lavorativi*.

**Dati non validi.** Una pausa fuori dalla giornata lavorativa, un orario di inizio dopo l'orario di fine o una festività con una data errata riceve un messaggio rosso nel campo, e *Applica* è disattivato finché non correggi. Per una pausa o una festività non valida c'è anche un segnale di avviso accanto al calendario nell'elenco (*Questo calendario contiene dati non validi*).

**Un calendario su una fase.** Una fase viene sempre calcolata sul calendario di progetto, perché la sua durata deriva dalle sue attività. Assegna il calendario alle attività stesse.

**Lo stesso calendario, due scelte.** Nell'elenco il calendario di progetto compare due volte: come *Calendario di progetto: nome* e come calendario normale con quel nome. Se scegli il secondo, è una scelta propria per quell'attività. L'attività allora non si sposta insieme quando scegli in seguito un altro calendario di progetto.

**Ore diverse al giorno.** Se cambi gli orari di lavoro o la pausa in modo che cambi il *Giorno lavorativo standard* di un calendario, un'attività espressa in giorni conta comunque lo stesso numero di giorni. Per un'attività con risorse e con il tipo di attività *Lavoro fisso* o *Unità fisse*, la durata cambia con esso, perché il lavoro resta uguale. Quaranta ore di lavoro sono 5 giorni a 8 ore al giorno e 7 giorni a 6 ore al giorno. L'app segnala quante attività hanno una durata diversa.

## Vedi anche

- [Calendari e giorni lavorativi](docs://uitleg-kalenders): come l'app conta i giorni lavorativi e quale calendario prevale.
- [Giorni e ore](docs://uitleg-dagen-en-uren): cosa fa il giorno lavorativo standard.
- [Impostare un calendario risorsa](docs://howto-resourcekalender-instellen): un calendario per una risorsa invece che per un'attività.
- [Finestre dei calendari](docs://ref-kalenders): tutti i campi delle finestre dei calendari.
