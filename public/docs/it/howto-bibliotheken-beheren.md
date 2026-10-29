# Gestire e condividere le librerie di risorse

Obiettivo: creare ed eliminare librerie di risorse, inserire calendari al loro interno, ed esportare o importare una libreria, come backup o per usarla su un altro computer.

## Quando ti serve

La libreria non si trova nei file del progetto, ma nell'app: nell'app desktop, in un file su questo computer; nel browser, nello spazio di archiviazione di quel browser. Non viene sincronizzata. Se cancelli i dati del sito nel browser, la libreria va persa; quindi esportala come backup. Se un collega vuole lavorare con le stesse squadre e le stesse tariffe, gli consegni anche la libreria come file. Se la tua organizzazione ha più società operative con squadre proprie, crei una libreria separata per ciascuna. Per un nuovo progetto scegli quale libreria usa.

Che cos'è una libreria, lo leggi in [La libreria di risorse](docs://uitleg-resourcebibliotheek). Qui non modifichi le risorse stesse, ma nel pannello risorse; vedi [Usare la libreria di risorse](docs://howto-resourcebibliotheek-gebruiken).

## Passaggi

### Apri la schermata di gestione

Scegli *File › Libreria*. A sinistra c'è l'elenco *Librerie di risorse*. A destra ci sono i dettagli della libreria su cui clicchi: nome, i pulsanti e l'elenco *Calendari*. In alto c'è scritto che gestisci le risorse nella scheda *Risorse*.

### Crea, rinomina e scegli una libreria predefinita

1. Clicca il segno più sopra l'elenco (*Aggiungi libreria di risorse*). Viene aggiunta una libreria *Nuova libreria di risorse* e viene subito selezionata.
2. Scrivi il nuovo nome nel campo del nome in alto, nella parte destra, e premi Invio, oppure clicca fuori dal campo. L'app non accetta un nome vuoto.
3. Clicca *Imposta come predefinita* per far sì che questa libreria sia preselezionata per i nuovi progetti da ora in poi. La libreria predefinita ha una stella nell'elenco.

### Inserisci un calendario nella libreria

1. Sotto *Calendari*, clicca *Dal progetto*. Si apre un elenco con i calendari del tuo progetto attivo.
2. Clicca la piccola freccia dopo il calendario che vuoi acquisire. Sopra l'elenco c'è scritto *Aggiunto.* Un calendario già collegato a questa libreria ha *già collegato* dopo il nome.
3. Il calendario ora è nell'elenco *Calendari* della libreria. Con la matita (*Modifica*) cambi il nome, e salvi con il segno di spunta. Il cestino elimina il calendario subito, senza chiedere conferma. Le copie nei progetti restano.

Dopo *Calendari* c'è un numero di versione, per esempio *v2*. Il numero sale a ogni modifica alla libreria. Un calendario della libreria passa al progetto quando assegni una risorsa che lo usa. Lo associ a una risorsa nella vista *Libreria* di *Risorse*, nella colonna *Calendario*.

### Esporta una libreria

1. Scegli la libreria nell'elenco.
2. Clicca *Esporta*.
3. Nell'app desktop, e in Chrome e Edge, scegli dove va il file. In altri browser il file va direttamente nella cartella dei download, e l'app te lo dice. Il file si chiama `bibliotheek-` seguito dal nome della libreria, con estensione `.ifc`.

Sotto i pulsanti c'è scritto *Esportare funge anche da backup: conserva il file in un luogo sicuro.*

### Importa una libreria

1. Clicca *Importa*. Si apre la finestra *Importa libreria* per la libreria che avevi selezionato nell'elenco.
2. Clicca *Scegli file…* e scegli il file `.ifc` di un'esportazione. Se il file non contiene una libreria, c'è scritto *Questo file IFC non contiene una libreria di risorse.*
3. L'app mostra che cosa c'è dentro, per esempio *2 calendari, 5 risorse (versione 3).*
4. Scegli che cosa vuoi farne, vedi sotto.
5. Clicca *Aggiungi* o *Sostituisci*, oppure *Annulla* per fermarti.

Hai due scelte:

- *Aggiungi come nuova libreria di risorse*: il file diventa una libreria separata accanto alle tue librerie esistenti. Sotto c'è scritto con quale nome, per esempio *Verrà aggiunta come «Mijn resourcebibliotheek (2)».* Non si perde niente, e il tuo progetto attivo resta collegato alla sua libreria.
- *Sostituisci una libreria di risorse esistente*: tutto il contenuto della libreria scelta viene sostituito con quello del file. Anche questo è scritto nell'app: *L'importazione sostituisce l'INTERO pool della libreria di risorse selezionata.* Se hai due o più librerie, scegli quale sotto *Importa nella libreria di risorse*. Se la tua libreria è più recente del file, l'app avvisa: *La tua libreria locale è più recente — importare potrebbe sovrascrivere le tue modifiche.*

L'app propone automaticamente una scelta. Per un file che conteneva la libreria predefinita, è preselezionato *Aggiungi come nuova libreria di risorse*. Se la libreria del file esiste già sul tuo computer e non è la libreria predefinita, è preselezionato *Sostituisci una libreria di risorse esistente*, con quella libreria già scelta. Nel dubbio, scegli di aggiungere: così non si sovrascrive niente.

### Elimina una libreria

1. Scegli la libreria nell'elenco e clicca *Rimuovi libreria di risorse*. Il pulsante è grigio per l'ultima libreria, perché ne resta sempre una.
2. Conferma con *Elimina*. La domanda è *Rimuovere questa libreria di risorse?* Se ci sono progetti aperti collegati, c'è scritto *Questa libreria di risorse è collegata a 1 progetto aperto. La rimozione scollegherà questo progetto. Continuare?* Per più progetti il testo è lo stesso, con il numero giusto, per esempio *collegata a 2 progetti aperti*.

Poi la libreria è sparita, con tutte le risorse e i calendari che contiene. I progetti aperti che la usavano vengono scollegati: le loro risorse restano come normali risorse del progetto. Esporta prima se vuoi conservare il contenuto.

### Consegna un progetto insieme alla sua libreria

Un file di progetto contiene le proprie copie delle risorse. Se vuoi consegnare anche l'intera libreria, procedi così. Anche l'esportazione stessa è descritta in [Esportazione](docs://howto-exporteren).

1. Apri un progetto collegato a una libreria e scegli *File › Esporta*.
2. Spunta *Salva anche il file di libreria*. La casella c'è solo per un progetto collegato.
3. Scegli la scheda *IFC* e salva il file. L'app chiede poi anche un secondo file. Il suo nome è quello del progetto, seguito da `-bibliotheek`, e contiene la libreria.

La casella funziona solo per l'esportazione IFC, non per gli altri formati di esportazione. Il tuo collega importa il secondo file come descritto sopra.

## Insidie e che cosa fa l'app in quel caso

**Due pianificatori, due librerie.** L'app non sincronizza le librerie tra i computer. La finestra di importazione mostra sempre un avviso in merito: *Nota: le librerie non vengono sincronizzate tra i computer. Se due pianificatori lavorano con la stessa libreria di risorse, le librerie possono divergere. Se la tua organizzazione condivide squadre tra società operative, scegli deliberatamente un'unica libreria di risorse condivisa.*

**Sostituire sovrascrive tutto.** Tutto ciò che avevi nella libreria scelta è sparito, e una modifica alla libreria non si può annullare con *Annulla*. Esporta prima se non sei sicuro. I tuoi progetti mantengono le loro copie. L'app aggiorna le copie che esistono ancora nel nuovo file. Le copie che non ci sono più ricevono la marcatura *non più nella libreria* e continuano a funzionare. Se una copia è diversa, si apre la finestra *Collega libreria di risorse* (vedi [Uso della libreria di risorse](docs://howto-resourcebibliotheek-gebruiken)).

**Eliminare un calendario dall'elenco avviene subito.** L'app non chiede conferma, mentre per eliminare una risorsa invece la chiede. Sembra una mancanza. Le modifiche alla libreria non si possono annullare con *Annulla*.

## Vedi anche

- [La libreria di risorse](docs://uitleg-resourcebibliotheek): come libreria e progetto sono collegati tra loro.
- [Usare la libreria di risorse](docs://howto-resourcebibliotheek-gebruiken): collegare le risorse alla libreria, assegnarle e risolvere le differenze.
- [Esportazione](docs://howto-exporteren): i formati di esportazione, incluso IFC con un file di libreria.
