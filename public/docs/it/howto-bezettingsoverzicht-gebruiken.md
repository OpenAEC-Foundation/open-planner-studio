# Usare la panoramica dell'occupazione

Obiettivo: vedere in quali giorni due o più progetti aperti chiedono insieme più di quanto la libreria di risorse ha a disposizione per una risorsa.

## Quando ti serve

La tua squadra di muratori lavora sulle facciate in un progetto e sui garage in un altro. In ogni progetto la squadra risulta pianificata in modo ordinato, perché l'istogramma e la sovrassegnazione di un progetto guardano solo quel progetto. Solo quando metti i progetti uno accanto all'altro, risulta che negli stessi giorni chiedono insieme più muratori di quanti ne hai. La panoramica dell'occupazione mette per te i progetti uno accanto all'altro.

La panoramica conteggia solo le risorse che provengono dalla libreria di risorse, nei progetti collegati alla stessa libreria. Come viene calcolato, lo leggi in [La libreria di risorse](docs://uitleg-resourcebibliotheek).

## Passi

### 1. Prepara i progetti

1. Apri i progetti che vuoi confrontare, ciascuno nella propria scheda, vedi [Lavorare con più progetti contemporaneamente](docs://howto-meerdere-projecten). La panoramica vede solo i progetti aperti in questa applicazione.
2. Collega ogni progetto alla stessa libreria e usa la risorsa della libreria in ogni progetto. Senza collegamento alla libreria, il pannello risorse non mostra la panoramica. Vedi [Usare la libreria di risorse](docs://howto-resourcebibliotheek-gebruiken).
3. Calcola i progetti con *Calcola* (F5), oppure attiva *Calcola automaticamente*. Che cosa fa la panoramica con i progetti non aggiornati è descritto più sotto, nelle insidie.

### 2. Apri la panoramica

1. Vai a uno dei progetti e scegli *Risorse › Gestisci › Risorse*.
2. In alto a destra scegli *Occupazione*. La panoramica appartiene alla libreria del progetto in cui ti trovi. In questo pannello non puoi cambiare nulla: è una finestra di sola lettura.

### 3. Leggi la tabella

Ogni risorsa della libreria che è prenotata in almeno un progetto aperto ottiene una riga. Le risorse senza prenotazione non sono elencate. In cima ci sono le righe con più giorni sovrassegnati, poi in ordine alfabetico.

- *Documenti* indica in quanti progetti la risorsa è prenotata, per esempio *2 documenti*.
- *Periodo* va dal primo all'ultimo giorno con carico, scritto come yyyy-mm-dd, per esempio *2027-06-07 – 2027-06-14*.
- *Picco / Capacità* confronta il carico giornaliero più alto di tutti i progetti insieme con la capacità della risorsa nella libreria, per esempio *4,0 / 3,0*. Se c'è almeno un giorno sovrassegnato, il valore è mostrato in rosso.
- Un indicatore rosso dopo la riga, per esempio *3 giorni con doppia prenotazione*, conta i giorni in cui la somma è maggiore della capacità. Se passi con il mouse sopra, vedi le date.

### 4. Guarda per progetto

1. Fai clic sulla piccola freccia prima del nome di una risorsa. La riga si apre.
2. In cima ci sono le date sovrassegnate: le prime cinque e poi *… e altri 3* se ce ne sono di più. Sotto, per progetto, c'è il nome con il periodo e il picco di quel singolo progetto, per esempio *Houses North 2027-06-07 – 2027-06-11 Picco: 2,0*.
3. Fai clic sulla riga stessa per vedere un istogramma in basso. Ogni progetto ha un proprio colore e le barre sono impilate. La linea tratteggiata è la capacità della libreria. Se cambia nel tempo, vedi dei gradini. I giorni sovrassegnati ricevono una striscia rossa dietro alle barre. Fai di nuovo clic sulla riga per chiudere l'istogramma. Senza una riga scelta compare il testo *Seleziona una risorsa per vedere l'istogramma.*

### 5. Risolvi il problema

La panoramica mostra il problema, ma non lo risolve. Hai due opzioni:

- Sposta un'attività in uno dei progetti, oppure assegnale meno unità al giorno. Poi ricalcola quel progetto con F5.
- Se si aggiunge davvero personale, aumenta *Unità max* della risorsa nella libreria. Lo fai in *Risorse › Gestisci › Risorse*, vista *Libreria*.

*Livella…* nella barra multifunzione non aiuta qui: guarda alle risorse del solo progetto in cui ti trovi, vedi [Livellamento delle risorse](docs://uitleg-nivelleren).

## Insidie e cosa fa l'app in quel caso

**La panoramica è vuota.** Compare il testo *Nessuna risorsa della libreria prenotata nei documenti aperti.* Allora nessun progetto aperto ha una risorsa della libreria di risorse su un'attività.

**Non vedi il pulsante *Occupazione*.** Il progetto in cui ti trovi non è collegato a una libreria di risorse.

**Un progetto non viene conteggiato.** Non è aperto in questa applicazione, è collegato a un'altra libreria di risorse, oppure la risorsa al suo interno è una risorsa propria di quel progetto. In fondo alla panoramica c'è sempre il testo *Questa panoramica vede solo i documenti aperti in questa applicazione.* Anche una copia di una risorsa che nel frattempo è stata rimossa dalla libreria di risorse non viene conteggiata.

**Una copia o una variante conta per intero.** Ogni progetto aperto collegato alla libreria di risorse conta, anche se è una copia o una variante di un altro progetto aperto, per esempio una variante creata da un assistente IA con `planner_duplicate_document`. Originale e variante insieme possono quindi mostrare una doppia prenotazione che in realtà esiste una sola volta. La panoramica non filtra questo in silenzio: chiudi per un momento la variante, oppure non tenerne conto.

**Un progetto non è aggiornato.** Un progetto non è aggiornato se hai modificato qualcosa nella pianificazione senza ricalcolare. La panoramica gestisce allora quel progetto così:

- Per un progetto che non è la scheda attiva, la panoramica calcola da sola in anticipo, senza cambiare il progetto. Sopra la tabella compare allora il testo *I documenti modificati sono stati calcolati in anticipo per questa panoramica; premi F5 nel documento, oppure attiva “Calcola automaticamente” per farlo in modo permanente.* Dopo il progetto compare il testo *Calcolato in anticipo per questa panoramica — il documento stesso mostra ancora le date precedenti finché non premi F5 al suo interno o attivi “Calcola automaticamente”.* Se *Calcola automaticamente* è attiva (*Impostazioni › Progetto › Impostazioni app*, scheda *Pianificazione*), l'app ricalcola davvero questi progetti non appena guardi la panoramica, e il messaggio scompare. Se anche il progetto attivo non è aggiornato, al suo posto sopra la tabella compare il messaggio del punto seguente.
- La panoramica non calcola da sola il progetto in cui ti trovi. Se quel progetto non è aggiornato, compare il testo *Un documento modificato non è ancora stato ricalcolato; qui è conteggiato con i suoi ultimi valori calcolati. Premi F5 in quel documento, oppure attiva “Calcola automaticamente”.* E dopo il progetto il testo *Non aggiornato: questi sono gli ultimi valori calcolati — premi F5 in questo documento.* Attenzione: *ultimi valori calcolati* non è del tutto esatto. La panoramica prende le vecchie date di inizio, ma una durata o un'assegnazione già modificata. Le cifre possono quindi differire sia dalla vecchia sia dalla nuova pianificazione, e dalle barre nel Gantt. Fidati di quei valori solo dopo F5.
- Se la panoramica non riesce a calcolare un progetto, per esempio a causa di un ciclo nelle sue relazioni, quel progetto non viene conteggiato. Compare comunque nell'elenco, con il testo *Non conteggiato: pianificazione non calcolata — attiva questo documento e premi F5.* e sopra la tabella il testo *Almeno un documento non è stato calcolato e non è incluso nell'occupazione.*

**La panoramica non corrisponde a quanto ti aspetti.** La capacità viene dalla libreria di risorse (*Unità max* della voce della libreria di risorse, oppure la sua *Capacità scaglionata nel tempo* in quel giorno), non dalle *Unità max* della copia nel progetto. Una somma uguale alla capacità non è un conflitto.

## Vedi anche

- [La libreria di risorse](docs://uitleg-resourcebibliotheek): come viene conteggiata l'occupazione, con un esempio svolto.
- [Usare la libreria di risorse](docs://howto-resourcebibliotheek-gebruiken): collegare progetti e assegnare risorse.
- [Risolvere le risorse sovrassegnate](docs://howto-overbezetting-oplossen): sovrassegnazione all'interno di un solo progetto.
