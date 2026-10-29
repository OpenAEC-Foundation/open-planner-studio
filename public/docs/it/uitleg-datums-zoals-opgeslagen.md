# Date come registrate

Apri una pianificazione da Primavera o MS Project e le date sono diverse da ciò che hai visto in quel programma. È andata male l'importazione? Di solito no. In questo articolo leggi perché l'app ricalcola da sola, quando mostra le date del file, che cosa resta vuoto allora e come torni al proprio calcolo. L'esempio alla fine segue due attività per tutto il processo.

## Il concetto

Un file di pianificazione contiene due tipi di dati. Il primo è la logica: attività, durate, relazioni, calendari e vincoli. Il secondo sono le date che il programma stesso ha calcolato da quella logica. All'apertura, Open Planner Studio usa la logica e calcola da sé. Quindi le date nel file non sono dati in ingresso.

Se il calcolo dell'app dà date diverse da quelle indicate nel file, non sai quale sia quella giusta. Nel file può mancare una logica che il programma ha usato. Il programma può anche calcolare in modo diverso dall'app su qualche punto. Per questo l'app può mostrare le date **come registrate**: le date che l'altro programma ha scritto nel file. Così confronti con ciò che hai visto in quel programma.

## Come l'app gestisce la cosa

### Quale profilo di calcolo usa l'app

L'app calcola con un **profilo di calcolo**: un insieme di regole di calcolo (convenzioni) che decide, per esempio, come tratta l'inizio pianificato di un'attività e i vincoli. Vedi [Profili di calcolo e convenzioni](docs://uitleg-rekenprofielen). Ci sono tre profili integrati: *Primavera P6*, *Microsoft Project* e *Open Planner Studio*. Un `.xer` si apre con *Primavera P6* e un `.mpp` con *Microsoft Project*. CSV, MS Project XML e Primavera P6 XML si aprono con *Open Planner Studio*. Il profilo di un progetto si trova in *File › Impostazioni progetto*, alla voce *Profilo di calcolo e opzioni*. Un file IFC creato dall'app conserva il suo profilo.

### Quando l'app confronta

All'apertura, l'app registra che cosa diceva il file e lo confronta con il proprio risultato. Lo fa per:

- un file Primavera (`.xer`) e Primavera P6 XML;
- MS Project XML e file MS Project (`.mpp`);
- un file IFC di un altro programma, per le attività i cui inizi anticipati sono nel file;
- un file IFC dell'app stessa che ha memorizzato la sua origine. Più avanti leggi quando succede.

L'app non confronta mai un file CSV: la data di inizio in un CSV è un dato in ingresso, non il risultato di un calcolo. Anche un file IFC dell'app senza origine memorizzata non viene confrontato.

Se nessuna attività differisce, non noti nulla. Se almeno un'attività differisce in un file che stai importando ora, l'app attiva subito la vista.

Con un file Primavera l'app calcola con il profilo di calcolo *Primavera P6*. Così mantiene l'inizio pianificato del file come inizio anticipato. Un'attività che nel file è più tardi di quanto richiedano le relazioni, ma che è anche pianificata lì, resta quindi dov'è: in quel caso non c'è alcuna differenza.

### Che cosa vedi

Sotto la barra multifunzione c'è una striscia: *Stai visualizzando le date come registrate nel file; un ricalcolo sposterebbe 4 attività.* Con una fonte Primavera (un `.xer` o Primavera P6 XML) dice *Stai visualizzando la pianificazione come registrata da Primavera; un ricalcolo sposterebbe 1 attività.* A destra della striscia c'è il pulsante *Ricalcola*. La striscia non ha una croce.

C'è anche un messaggio: *12 attività mostrano le date come registrate nel file (non ricalcolate).* Solo con un `.xer` dice *12 attività mostrano le date come registrate da Primavera (non ricalcolate).* Quel numero conta ogni attività per cui il file ha registrato delle date, comprese le attività che non differiscono. Il numero delle attività che differiscono dopo un ricalcolo è nella striscia. Ogni attività per cui il file ha registrato delle date mostra un blocco arancione nel pannello *Proprietà*, subito sopra *Inizio*: *Vedi le date che Primavera ha salvato, non il calcolo dell'app.* Con un'altra fonte dice *Vedi le date presenti nel file, non il calcolo dell'app.* Una seconda riga dice che cosa succede a quell'attività quando ricalcoli: *Al ricalcolo questa attività cambia.* oppure *Al ricalcolo questa attività resta invariata.* Il Gantt, la tabella attività e la barra di stato mostrano le date del file.

### Attività iniziate o completate

Un'attività completata occupa i giorni in cui è realmente avvenuta: dall'inizio effettivo alla fine effettiva. Un'attività in corso inizia il giorno in cui è realmente iniziata. Termina alla fine calcolata. Questo vale in questa vista, dopo il ricalcolo e con ogni profilo di calcolo, come in Primavera e MS Project.

Per un'attività del genere il file spesso registra altre date anticipate. Primavera mette l'inizio anticipato di un'attività in corso o completata sulla data di stato. Vedi quelle date nelle colonne *Inizio anticipato* e *Fine anticipata*, non in *Inizio* e *Fine*. Un'attività completata quindi non conta mai come differenza. Un'attività in corso conta solo quando la sua fine differisce.

Per un'attività iniziata non puoi più scrivere l'inizio. Nella tabella attività, nel pannello *Proprietà* e in *Modifica attività* l'inizio è quindi in sola lettura. Per un'attività completata, questo vale anche per la fine nella tabella attività. Cambia invece *Inizio effettivo* o *Fine effettiva*, con l'avanzamento. Nel Gantt la barra di un'attività del genere non si sposta; ricevi allora un messaggio.

### Che cosa resta vuoto in questa vista

In questa vista l'app non calcola nulla. Mostra solo ciò che il file ha registrato. Quindi vedi il margine e il percorso critico solo se il file li contiene. Se il file non registra attività critiche, la barra di stato indica 0 attività critiche. Questo non dice nulla sul percorso critico nel programma stesso. Ciò che esce solo da un calcolo non esiste in questa vista: quali relazioni guidano la pianificazione, vincoli violati, attività fuori sequenza e attività quasi critiche.

Se il file non registra tutto per un'attività, il blocco arancione nel pannello *Proprietà* ottiene una terza riga, per esempio *Primavera non ha salvato tutto per questa attività. Mancano: margine libero.* Con un'altra fonte dice *Il file non contiene tutto per questa attività.* Le prime due righe restano: così vedi anche, per quell'attività, che le date vengono dal file e se l'attività cambia quando ricalcoli. I valori mancanti hanno gli stessi nomi delle colonne della tabella attività. In un export CSV restano vuote le colonne *Critica* e *Margine totale* per quell'attività, invece di uno zero inventato.

### Uscire dalla vista

Esci dalla vista in due modi:

- Fai clic su *Ricalcola* nella striscia, oppure scegli *Calcola* (F5). L'app calcola con le proprie regole.
- Modifica qualcosa che può cambiare le date, per esempio la durata di un'attività o una nuova attività. L'app esce dalla vista e ricalcola subito, anche se *Calcola automaticamente* è disattivato. Cambiare un nome, una descrizione, una categoria di lavoro o un tipo di attività non ha questo effetto: la vista resta attiva.

Una modifica del calendario dalla libreria di risorse lascia attiva la vista e invariate le date del file, ma aggiorna il numero nella striscia.

Dopo l'uscita non c'è un pulsante per tornare alla vista. Ctrl+Z la riporta, subito dopo il ricalcolo o subito dopo una modifica di questo tipo. Altrimenti puoi aprire di nuovo il file di origine. Con un `.xer`, anche aprire un file IFC che hai salvato dopo il ricalcolo, ma non hai modificato, attiva di nuovo la vista.

### Recupero dopo un arresto anomalo

Se recuperi un progetto dopo un arresto anomalo mentre era nella vista, la vista resta attiva. Se la vista era disattivata, l'app dimentica le date del file. Il progetto attivo mostra la stessa striscia di prima. Un progetto su un'altra scheda mostra la striscia senza numero: *Stai visualizzando le date come registrate nel file. Non è stato eseguito alcun ricalcolo.* Vedi [Recupero dopo un arresto anomalo](docs://howto-herstellen-na-een-crash).

### Salvare e riaprire

Se salvi mentre usi la vista, l'app scrive le date visualizzate nel file IFC, insieme al formato di origine. Se poi riapri quel file IFC, la vista è di nuovo attiva, senza un nuovo messaggio. Questo vale anche se hai cambiato nella vista qualcosa che non tocca le date, come un nome. L'app apre il file come l'hai lasciato.

Se salvi dopo essere uscito dalla vista, con un ricalcolo o con una modifica che può cambiare le date, il file contiene il calcolo dell'app. Alla riapertura vedi quel calcolo, senza striscia e senza blocco nel pannello *Proprietà*. Fa eccezione un `.xer` che hai solo ricalcolato e non modificato (vedi sopra). La tua pianificazione modificata è ora la pianificazione; le vecchie date del pacchetto di origine non le appartengono più. Se vuoi ancora vederle, apri di nuovo il file di origine.

## Esempio svolto: l'ampliamento

Immagina di aprire un file Primavera *Uitbouw* (ampliamento) con due attività, su un calendario senza festività. Nel 2027, il 6 maggio è l'Ascensione e il 17 maggio è il lunedì di Pentecoste: con le festività nel calendario, le date risulterebbero diverse. *Fundering storten* (gettare le fondazioni) dura 5 giorni lavorativi, *Metselwerk* (muratura) 10 giorni lavorativi, e Metselwerk segue Fundering con una relazione fine-inizio. Il file registra che Fundering va da lunedì 3 maggio a venerdì 7 maggio 2027 e Metselwerk da lunedì 17 maggio a venerdì 28 maggio 2027: una settimana dopo l'inizio anticipato che la relazione consente. L'inizio pianificato di Metselwerk nel file è lunedì 10 maggio 2027.

Subito dopo l'apertura vedi le date del file. La barra di stato dice *Fine: 28-05-2027* e *Percorso critico: 2 attività, 20 giorni lavorativi*. La striscia indica che un ricalcolo sposterebbe 1 attività. Entrambe le attività mostrano il blocco arancione *Vedi le date che Primavera ha salvato, non il calcolo dell'app.* Sotto di esso, Metselwerk dice *Al ricalcolo questa attività cambia.* e Fundering dice *Al ricalcolo questa attività resta invariata.*

Con *Ricalcola*, Fundering resta dal 3 al 7 maggio. Metselwerk ora inizia lunedì 10 maggio, il giorno lavorativo dopo la fine di Fundering, e finisce venerdì 21 maggio. La pianificazione finisce il 21 maggio 2027 e dura 15 giorni lavorativi invece di 20. Il percorso critico è composto dalle stesse 2 attività.

E se va diversamente?

- Se anche Metselwerk è pianificata nel file per lunedì 17 maggio, il profilo di calcolo *Primavera P6* mantiene quell'inizio. Il calcolo dà date dal 17 al 28 maggio, non c'è alcuna differenza e la vista non si attiva.
- Aggiungi un'attività nella vista: l'app fa lo stesso ricalcolo. Metselwerk passa dal 10 al 21 maggio.
- Salvi nella vista e riapri il file IFC senza modificarlo: Metselwerk è di nuovo dal 17 al 28 maggio.
- Ricalcoli, salvi senza modificare ancora e riapri il file IFC: la vista è di nuovo attiva e Metselwerk è dal 17 al 28 maggio.
- Cambi solo il nome di Metselwerk nella vista, salvi e riapri: la vista è di nuovo attiva e Metselwerk è dal 17 al 28 maggio.
- Aggiungi un'attività nella vista, salvi e riapri: l'app dimentica le date del file. Metselwerk è dal 10 al 21 maggio, senza striscia e senza blocco.
- Fundering è già completata nel file: è iniziata davvero il 3 maggio e finita davvero il 7 maggio. Il file registra la data di stato come suo inizio anticipato. La barra di Fundering resta dal 3 al 7 maggio, nella vista e dopo il ricalcolo. Fundering non conta come differenza.

## Conseguenze e malintesi

**Una differenza non è un errore di importazione.** L'app calcola con le proprie regole: con un `.xer` con il profilo di calcolo *Primavera P6*, con un `.mpp` con *Microsoft Project*, con CSV, MS Project XML e Primavera P6 XML con *Open Planner Studio*. Il motivo per cui le date nel pacchetto di origine risultano diverse può dipendere dal file o dal programma. La vista ti mostra *che* le date differiscono.

**La vista non è un risultato di calcolo.** L'app non ha calcolato le date. Non prenderle semplicemente come risultato della tua pianificazione.

**Salvare nella vista conserva le date del pacchetto di origine.** Il file IFC contiene allora ciò che diceva il pacchetto di origine, non ciò che l'app calcolerebbe.

**Dopo una modifica che può cambiare le date, le date del file non tornano.** Se sei uscito dalla vista con una modifica del genere, dopo il salvataggio e la riapertura vedi solo il calcolo dell'app. Cambiare un nome non conta: la vista resta allora attiva (vedi *Salvare e riaprire*). Apri di nuovo il file di origine se vuoi vedere le date del pacchetto di origine.

## Vedi anche

- [File e formati](docs://uitleg-bestanden): cosa l'app conserva in un file e cosa portano un'importazione o un export.
- [Aprire un file Primavera P6 (.xer)](docs://howto-xer-openen): i passaggi e i messaggi per un file `.xer`.
- [Aprire un file MS Project (.mpp)](docs://howto-mpp-openen): i passaggi e i messaggi per un file `.mpp`.
- [Recupero dopo un arresto anomalo](docs://howto-herstellen-na-een-crash): cosa succede a questo progetto dopo un arresto anomalo.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): come l'app calcola il margine e la criticità quando calcola.
