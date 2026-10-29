# Aggiornare l'avanzamento

Obiettivo: inserire lo stato effettivo del lavoro nella pianificazione e ricalcolare la pianificazione: quali attività sono completate, quali sono in corso e quanto lavoro rimanente c'è ancora.

## Quando ti serve questo

Aggiorni l'avanzamento in momenti fissi, per esempio ogni venerdì, quando il capocantiere riferisce lo stato. Così la pianificazione vede ciò che è successo davvero e calcola il lavoro rimanente a partire dalla data di stato. Il motivo per cui l'app funziona così è spiegato in [Avanzamento, data di stato e baseline](docs://uitleg-voortgang).

## Passaggi

### 1. Imposta la data di stato

La data di stato è il giorno in cui fai il punto della situazione. Impostala prima di inserire l'avanzamento.

1. Vai a *Pianificazione › Baseline e progresso › Data di stato*.
2. Scrivi la data nelle tre caselle per giorno, mese e anno (nell'ordine della tua notazione delle date), per esempio 28, 06 e 2027, e premi Invio. L'app passa da sola alla casella successiva.
3. Il calendario del progetto ha fasce orarie (il blocco *Orari di lavoro* nella finestra *Calendari*)? Allora l'app calcola in ore e a destra compare un campo dell'orario, per esempio 17:00. Scrivi un altro orario, per esempio 12:00, e premi Invio. Se svuoti il campo dell'orario, resta solo la data. Se cambi solo la data, l'orario resta invariato. L'orario segue il formato che usi (24 o 12 ore). Senza fasce orarie l'app calcola in giorni interi: allora non c'è un campo dell'orario e la data di stato cade all'inizio del giorno.
4. Con la piccola croce accanto al campo svuoti di nuovo la data di stato.

Se fai il punto della situazione il venerdì dopo gli orari di lavoro, imposta la data di stato sul giorno lavorativo successivo, lunedì. L'app pianifica il lavoro rimanente a partire dall'inizio della data di stato.

Se inserisci l'avanzamento mentre non c'è ancora una data di stato, l'app la imposta a oggi e segnala: *Data di stato impostata a oggi (…).* Quindi imposta tu prima la data di stato.

### 2. Inserisci l'avanzamento

Scegli il modo che fa al caso tuo. Danno lo stesso risultato.

**Un'attività nel pannello proprietà.** Utile quando aggiorni una sola attività.

1. Fai clic sull'attività. Se non vedi il pannello *Proprietà*, attivalo con *Vista › Pannelli › Proprietà*.
2. Trascina il cursore *Progresso (%)* fino alla percentuale completata.
3. Se serve, compila *Inizio effettivo* e *Fine effettiva*, nello stesso modo della data di stato. L'app calcola da sola il campo *Rimanente*; qui non puoi modificarlo.

Un cardine ha un solo campo, *Data effettiva*.

**Scegliere una percentuale dal menu.** Utile per uno stato rapido.

1. Fai clic destro sulla barra dell'attività nel Gantt.
2. Scegli *Avanzamento* e poi 0%, 25%, 50%, 75% o 100%.

**Più attività nella tabella.** Utile quando aggiorni un'intera lista.

1. Fai clic sul **+** a destra dell'intestazione della tabella attività (*Aggiungi colonna*) e apri la categoria *Avanzamento*. Aggiungi le colonne *Inizio effettivo*, *Fine effettiva*, *Rimanente* e *Stato*. La colonna *Avanzamento* è già nella scheda *Tabella*.
2. Fai doppio clic su una cella, scrivi il valore e premi Invio. Scrivi una percentuale come `50` o `50%`, una data come `25-06-2027`, una durata rimanente come `1`.
3. Per *Stato*, dopo un doppio clic premi Invio e scegli *Non iniziata*, *In corso* o *Completata*.

Se scrivi una durata rimanente, l'app calcola a ritroso la percentuale: per un'attività di 2 giorni lavorativi, una durata rimanente di 1 dà una percentuale di 50. Una durata rimanente di 0 completa l'attività. La colonna *Durata effettiva* (anche nella categoria *Avanzamento*) funziona al contrario: scrivi quanto lavoro è già stato fatto e l'app calcola la percentuale. Per un'attività di 4 giorni lavorativi, una durata effettiva di 1 dà il 25%. Se scegli *Non iniziata* in *Stato*, la percentuale va a 0 e le date effettive scompaiono.

**Tutti i dati di un'attività nella finestra di modifica.** Fai clic destro sull'attività e scegli *Modifica...*. Anche i campi dell'avanzamento sono lì. Si applicano solo quando fai clic su *Salva*.

**Molte attività in una volta da un foglio di calcolo.** Vedi [Importare l'avanzamento da un foglio di calcolo](docs://howto-voortgang-importeren).

### 3. Ricalcola la pianificazione

Ogni modifica dell'avanzamento o della data di stato rende la pianificazione non aggiornata: la barra di stato segnala *Non aggiornato — ricalcola (F5)*. Premi **Calcola** (F5), per esempio tramite *Pianificazione › Pianificazione › Calcola*. Se *Calcola automaticamente* è attivo (in *Impostazioni › Progetto › Impostazioni app*, scheda *Pianificazione*), l'app lo fa da sola.

## Controlla il risultato

- Alla data di stato il Gantt mostra una linea tratteggiata con la data nell'intestazione. Sulle attività in corso la linea sporge fino alla percentuale raggiunta nella barra. Accendi o spegni queste linee con *Vista › Baseline e progresso › Linea di avanzamento* e *Linea data di stato*.
- La parte completata di una barra diventa grigia. Il resto mantiene il suo colore. Un'attività completata del tutto è tutta grigia, con un segno di spunta prima del nome e senza la banda del margine. Anche la barra di una fase diventa grigia fino alla sua percentuale derivata, così vedi per fase quanto lavoro è stato fatto. Se mostri i predecessori o i successori di un'attività, le loro barre mantengono il colore di evidenziazione, anche quando sono completate.
- Le attività completate non sono mai rosse: con una data di stato, un'attività completata non è critica.
- Le fasi mostrano una percentuale derivata e la fine della pianificazione può essersi spostata.
- Se hai salvato una baseline, la pianificazione originale si trova sotto ogni barra e il tipo di report *Variance* mostra lo scostamento.

## Problemi e cosa fa l'app

**Una data dopo la data di stato.** L'app non accetta un inizio effettivo o una fine effettiva dopo la data di stato. Nel pannello lo scrive sotto i campi con *Le date effettive non possono essere successive alla data di stato*; nella tabella la cella segnala *La data effettiva è successiva alla data di stato.* Imposta prima una data di stato più tardi, oppure correggi la data.

**Un'attività che inizierebbe solo dopo la data di stato.** Se inserisci l'avanzamento per un'attività che secondo la pianificazione non sarebbe ancora iniziata, si apre la finestra *Indica l’inizio effettivo*. Chiede quando l'attività è iniziata davvero; il suggerimento è la data di stato. Con *Applica avanzamento* lo registri; con *Annulla* non cambia nulla.

**100% senza date.** Se imposti un'attività al 100% senza una fine effettiva, la fine effettiva diventa la data di stato, anche se l'attività era già finita prima. Compila poi tu la fine effettiva.

**Una percentuale sotto il 100%.** Se riporti un'attività completata sotto il 100%, la fine effettiva viene eliminata. Se cancelli solo la fine effettiva, la percentuale va a 0 e l'attività resta *In corso*. Se vuoi che l'attività torni non iniziata, cancella anche l'inizio effettivo, oppure scegli *Non iniziata* in *Stato* nella tabella.

**Cambiare la durata di un'attività in corso.** Il lavoro già svolto resta svolto e la percentuale si adatta. Un'attività di 5 giorni lavorativi al 60% che imposti a 10 giorni lavorativi finisce al 30%. L'app non accetta una durata inferiore al lavoro già svolto: *«Build inner cavity leaf» è già completata al 60%: una durata inferiore al lavoro già svolto non è possibile. La durata non è stata modificata.* Nella tabella la cella segnala *Questa durata è inferiore al lavoro già svolto.*

**La durata rimanente viene arrotondata.** L'app arrotonda la durata rimanente a giorni lavorativi interi. Per un'attività di 2 giorni lavorativi, 50% e 75% danno entrambi un residuo di 1 giorno lavorativo.

**Una fase.** Una fase non ha un avanzamento proprio. Nel pannello c'è scritto *Derivato dalle sottoattività: modifica l'avanzamento lì. L'attività di riepilogo si aggiorna dopo il calcolo (F5).* Nella tabella la cella segnala *L'avanzamento di un'attività di riepilogo è derivato dalle sue sottoattività e non può essere modificato qui.*

**Spostare la data di stato più tardi.** Il lavoro rimanente delle attività in corso inizia alla nuova data di stato, e il lavoro che non è ancora iniziato non può trovarsi prima di quella data. Quindi sposta la data solo insieme a un aggiornamento dell'avanzamento. Se imposti una data di stato senza inserire anche l'avanzamento, tutto il lavoro che non è ancora iniziato si sposta a quella data (tranne nel profilo Microsoft Project).

**Un errore.** Ogni modifica dell'avanzamento è un solo passo per Ctrl+Z.

## Vedi anche

- [Avanzamento, data di stato e baseline](docs://uitleg-voortgang): come l'app calcola il lavoro rimanente e la data di stato, con un esempio svolto.
- [Importare l'avanzamento da un foglio di calcolo](docs://howto-voortgang-importeren): leggere l'avanzamento di molte attività in una volta.
- [Scegliere la modalità di progresso](docs://howto-voortgangsmodus-kiezen): che cosa fa l'app con un'attività iniziata mentre il suo predecessore è ancora in corso.
- [Salvare e gestire una baseline](docs://howto-baseline-opslaan-en-beheren): registrare la pianificazione originale per confrontare con essa l'avanzamento.
