# Aprire e salvare un file

Obiettivo: apri un progetto da un file e conserva le tue modifiche.

## Quando ti serve

Riprendi il lavoro con il progetto di ieri, ricevi un file da un collega o da un altro programma, oppure vuoi salvare uno stato intermedio prima di cambiare qualcosa di grosso. Che cosa l'app conserva in un file, e perché solo IFC conserva l'intero progetto, è spiegato in [File e formati](docs://uitleg-bestanden).

## Passaggi

### Aprire un file

1. Scegli *Home › File › Apri*, oppure *File › Apri*, oppure premi Ctrl+O (⌘+O su Mac). Il gruppo *File* si trova anche nella scheda *Tabella*.
2. Scegli il file. Apri un file alla volta. Sul desktop e nei browser con accesso ai file, come Chrome ed Edge, la finestra mostra un elenco di tipi di file: *Tutti i formati supportati*, *File IFC*, *File CSV*, *File XML*, *File MS Project* e *File Primavera XER*.
3. Il progetto si apre in una nuova scheda. Se la scheda attuale era ancora vuota e non modificata, il progetto si apre in quella scheda.
4. Se il file non è IFC, appare una finestra con una breve spiegazione di quel formato. Un blocco verde indica che cosa l'app trasferisce, un blocco ambra che cosa non è incluso o solo in parte, e un blocco blu come funzionano il salvataggio e la riscrittura. *Leggi di più* apre la guida di quel formato. Fai clic su *Capito* per chiudere la finestra. Se non vuoi più vedere questa spiegazione per quel formato, spunta prima *Non mostrare più per …*. La riattivi in [Impostazioni dell'app](docs://ref-instellingen), nella scheda *Avanzate*.

Un file IFC dà il suo nome alla scheda. Un progetto da un altro formato riceve il suo nome di progetto.

L'app apre `.ifc`, `.csv`, `.xml` (XML di MS Project o XML di Primavera P6), `.mpp` e `.xer`. Per gli ultimi due ci sono passaggi separati in [Aprire un file MS Project (.mpp)](docs://howto-mpp-openen) e [Aprire un file Primavera P6 (.xer)](docs://howto-xer-openen).

### Aprire un progetto recente

Scegli *Home › File › Recenti* e fai clic su un file nell'elenco, oppure scegli *File › Recenti*. L'elenco conserva gli ultimi dieci file che hai aperto, salvato o esportato. Anche qui, dopo un file che non è IFC, compare la spiegazione del suo formato. L'app desktop mostra il percorso di ogni file, un browser solo il nome.

Se l'app non riesce più a leggere un file nell'elenco, per esempio perché l'hai spostato, il file scompare dall'elenco senza messaggio. Nei browser senza accesso ai file, come Firefox, *Recenti* resta vuoto.

### Aprire un esempio

Scegli *File › Esempi* e fai clic su un progetto di esempio. Si apre in una scheda, senza file: *Salva* quindi chiede dove vuoi conservarlo.

### Salvare

Scegli *Home › File › Salva* oppure *File › Salva*, oppure premi Ctrl+S. Quello che succede dipende dal tuo progetto:

1. Se il progetto ha già un file, perché hai aperto un file IFC o l'hai già salvato prima, l'app scrive in quel file. Non appare nessuna finestra, tranne al primo salvataggio di un file con uno schema IFC diverso da IFC 4.3 ADD2. In quel caso l'app chiede prima *In quale schema IFC salvare?* Vedi [Scegliere lo schema IFC](docs://howto-ifc-schema-kiezen).
2. Se il progetto non ha ancora un file, l'app chiede dove deve andare. Propone il nome del progetto con `.ifc`. Da quel momento quel file è il file del progetto.
3. Se il tuo browser salva solo tramite un download (come Firefox), il file finisce nella cartella dei download, e ogni salvataggio crea un nuovo download. La prima volta in una sessione vedi il messaggio *Salvato come download: «name.ifc» si trova nella cartella dei download. Questo browser non permette all'app di scrivere in una posizione propria, quindi ogni salvataggio crea un nuovo download. In Chrome, Edge o nell'app desktop, Salva aggiorna semplicemente lo stesso file.*
4. Se il tuo browser non può riscrivere nel file del progetto, l'app chiede ogni volta di nuovo dove mettere il file quando salvi. Sembra *Salva come*, ma è un limite del browser. La prima volta in una sessione il messaggio *Questo browser non permette all'app di riscrivere «name.ifc».* lo spiega, con un collegamento a [File](docs://uitleg-bestanden).

Dopo il salvataggio, il segno *Non salvato* scompare: il punto sulla scheda, l'asterisco prima del nome del progetto in alto e il testo *Non salvato* in basso a destra nella barra di stato.

### Salvare con un altro nome

Scegli *Home › File › Salva come* oppure *File › Salva come*, oppure premi Ctrl+Maiusc+S. Scegli un nome e una posizione (in Firefox l'app scarica invece un nuovo file). Da quel momento il progetto lavora con questo nuovo file: il prossimo *Salva* scrive lì. Il vecchio file resta com'era l'ultima volta che hai salvato.

### Chiudere un progetto

Fai clic sulla croce sulla scheda, oppure scegli *File › Chiudi progetto*. Se il progetto ha modifiche che non hai salvato, l'app chiede: *Modifiche non salvate: «name» ha modifiche che non sono ancora state salvate.* Scegli *Annulla* (il progetto resta aperto), *Non salvare* (il progetto si chiude e le tue modifiche sono perse) oppure *Salva* (prima salva, poi chiudi). Se chiudi tutta l'app sul desktop (con il pulsante di chiusura, Alt+F4 o il menu del sistema operativo), l'app chiede questo per ogni progetto con modifiche; *Annulla*, oppure un salvataggio che non riesce, interrompe la chiusura. Dopo una chiusura normale così, l'app elimina le copie di ripristino di quella sessione, quindi la finestra di ripristino compare solo dopo un vero arresto anomalo. Se un progetto ha modifiche e chiudi la scheda o la finestra del browser, il browser chiede una conferma.

## Trappole e cosa fa l'app in quel caso

**Un file IFC aperto diventa subito il file del tuo progetto.** *Salva* sovrascrive quel file, anche se viene da un altro programma. Se vuoi conservare l'originale, scegli prima *Salva come*.

**Gli altri formati non vengono mai sovrascritti.** Un `.csv`, `.xml`, `.mpp` o `.xer` non ha un file dopo l'apertura. *Salva* scrive un nuovo file IFC e lascia l'originale intatto.

**In Firefox ogni salvataggio crea un nuovo file.** L'app non può scrivere nel tuo file lì. Scarica ogni volta un nuovo file, con il nome del progetto come nome del file e non il nome del file che hai aperto.

**Chrome ed Edge chiedono il permesso.** Al primo *Salva* di un file che hai aperto, il browser chiede se l'app può scrivere in quel file. Se rifiuti, l'app apre una finestra in cui scegli un nuovo file. In Chrome ed Edge ottieni quella finestra anche se scrivere nel file esistente non riesce, per esempio perché il file è scomparso o bloccato.

**Un messaggio su id doppi o relazioni che non contano.** Dopo l'apertura può restare visibile un messaggio. Se dice *Oggetti con un id doppio in questo file*, ogni oggetto doppio ha ricevuto un proprio id e i riferimenti puntano alla prima occorrenza. Controlla quindi relazioni e assegnazioni. Se dice *relazione/i non inclusa/e nel calcolo*, la relazione si trovava su un'attività di riepilogo e non ha effetto, per esempio un'attività con una relazione verso il proprio riepilogo. Il file stesso non cambia. Vedi [Relazioni](docs://uitleg-relaties) per ciò che fa una relazione su un'attività di riepilogo.

**Il salvataggio può non riuscire.** Se il salvataggio stesso dà un errore, l'app segnala *Salvataggio non riuscito*, con il motivo. Il progetto resta aperto e risulta ancora *Non salvato*.

## Vedi anche

- [File e formati](docs://uitleg-bestanden): cosa c'è in un file IFC e come l'app tratta i formati.
- [Attivare AutoSave](docs://howto-automatisch-opslaan): lasciare che l'app aggiorni da sola il tuo file.
- [Scegliere lo schema IFC](docs://howto-ifc-schema-kiezen): che cosa significa la domanda *In quale schema IFC salvare?*
- [Esportare](docs://howto-exporteren): fare una copia in un altro formato.
- [Ripristinare dopo un arresto anomalo](docs://howto-herstellen-na-een-crash): cosa fai se l'app non si è chiusa correttamente.
- [Formati di importazione ed esportazione](docs://ref-import-exportformaten): per formato, cosa viene trasferito e cosa no.
