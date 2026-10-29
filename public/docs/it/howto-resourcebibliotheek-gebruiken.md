# Usare la libreria di risorse

Obiettivo: usa risorse dalla libreria di risorse nel tuo progetto, e metti nella libreria una risorsa che hai creato in un progetto, così tutti i progetti usano gli stessi dati.

## Quando ti serve questo

Hai una squadra fissa di muratori, una gru e un intonacatore che compaiono in più progetti. Senza libreria li inserisci di nuovo in ogni progetto, con il rischio di nomi e tariffe diversi. Nessun progetto vede che un altro chiede anche la stessa squadra. Nella libreria li registri una volta sola.

Che cos'è la libreria e che cosa un progetto prende da essa, lo leggi in [La libreria di risorse](docs://uitleg-resourcebibliotheek). Questo articolo parla delle azioni. Creare, esportare ed eliminare librerie è descritto in [Gestire e condividere le librerie di risorse](docs://howto-bibliotheken-beheren).

## Passaggi

### 1. Collega il progetto a una libreria

Lavori con la libreria solo se il progetto è collegato. Senza collegamento, il pannello *Risorse* non mostra il selettore *Libreria*, *Progetto* e *Occupazione*.

Per un nuovo progetto:

1. Scegli *File › Nuovo*. Si apre la finestra *Nuovo progetto*.
2. Guarda *Libreria di risorse*. Il campo è impostato sulla libreria predefinita. Puoi scegliere un'altra libreria, *nessuna (progetto autonomo)* oppure *+ Nuova libreria di risorse…*.
3. Fai clic su *Crea*.

Per un progetto esistente:

1. Scegli *File › Impostazioni progetto*.
2. Sotto *Libreria di risorse*, scegli la libreria.
3. Fai clic su *Applica*. Fino ad allora, in basso, c'è scritto *Modifiche non applicate: fai clic su Applica per conservarle.*

Se il progetto ha già risorse con lo stesso nome di un elemento della libreria, si apre la finestra *Collega libreria di risorse* con la sezione *Riconosci*. Ogni risorsa con una corrispondenza scrive *Suggerimento: Bricklayer*. Fai clic su *Collega* per collegare quella, oppure su *Collega tutti i suggerimenti* se ce n'è più di uno. L'app confronta i nomi senza tenere conto di maiuscole e doppi spazi. Quando colleghi, la risorsa prende nome, tipo, tariffa, unità e descrizione dall'elemento della libreria. *Unità max* resta quello che avevi nel progetto. La finestra mostra anche i calendari del progetto che hanno lo stesso nome di un calendario della libreria. Con *Decidi più tardi* chiudi la finestra senza collegare.

### 2. Metti una risorsa nella libreria

1. Scegli *Risorse › Gestisci › Risorse*. Il pannello risorse occupa l'area di lavoro. Si apre sempre su *Progetto*, anche per un progetto collegato.
2. Scegli *Libreria* in alto a destra. Sopra la tabella c'è scritto *Questo modifica la libreria e vale per tutti i progetti — fuori dall'annulla.*
3. Fai clic su *Nuova risorsa nella libreria*. In fondo alla tabella appare una riga vuota.
4. Scrivi il nome, per esempio *Bricklayer*, e premi Invio. La risorsa è ora nella libreria e subito si apre una riga vuota per la successiva. Premi Esc quando hai finito. Senza nome l'app non crea niente.
5. Compila il resto della riga. *Tipo* è *Manodopera* per impostazione predefinita. Sotto *Unità max* scrivi quante di queste risorse ci sono in totale, per esempio 3 per tre muratori. La panoramica dell'occupazione usa questo numero come capacità. *Tariffa/ora* è facoltativo. Puoi compilare *Unità* solo per il tipo *Materiale*. Sotto *Calendario* scegli un calendario dalla libreria, oppure *+ Calendario risorsa* per crearne uno, vedi [Impostare un calendario risorsa](docs://howto-resourcekalender-instellen). L'app salva nome, tariffa e unità quando esci dal campo, e gli altri campi subito.

Ogni modifica nella libreria passa subito alle copie non modificate nei tuoi progetti aperti.

### 3. Assegna una risorsa al tuo progetto

1. Nella vista *Libreria*, scegli *Assegna al progetto* sulla risorsa. Sopra la tabella c'è scritto *Aggiunto.* Se fai clic di nuovo, c'è scritto *Già presente nel progetto.* e non compare una seconda copia.
2. Scegli *Progetto*. La copia è nella tabella con una piccola icona della libreria accanto al nome, con la dicitura *Dalla libreria*. Nome, tipo, tariffa e unità sono testo normale. Se passi il mouse sopra, vedi *Valore di libreria — modificalo nella vista Libreria, oppure scollega questa risorsa dalla libreria.*
3. Imposta *Unità max* per questo progetto. Il campo parte dal valore della libreria e resta modificabile nel progetto.
4. Ora assegna la risorsa alle attività come ogni altra risorsa, vedi [Assegnare risorse con una curva](docs://howto-resource-toewijzen). *Risorse › Assegnazione › Assegna* mostra solo le risorse già presenti nel progetto, quindi assegna prima una risorsa della libreria al progetto in questo modo.

*Assegna al progetto* esiste solo nella vista *Libreria* di un progetto collegato a quella libreria.

### 4. Porta una risorsa dal tuo progetto nella libreria

Lo fai per una risorsa che hai creato nel progetto e usi più spesso, come una gru a noleggio.

1. Nella vista *Progetto*, scegli *Nella libreria* sulla risorsa. Il pulsante compare solo su una risorsa che ha un nome e non viene ancora dalla libreria, in un progetto collegato.
2. Leggi il messaggio sopra la tabella.

Il messaggio può dire tre cose:

- *Aggiunto.* Nella libreria non c'era un elemento con quel nome. È stato creato un nuovo elemento e la tua risorsa vi è collegata.
- *Esisteva già nella libreria — ora collegato.* C'era un elemento con lo stesso nome e gli stessi dati. La tua risorsa vi è collegata.
- *Collegato all'elemento esistente della libreria — i valori differiscono, vedi il contrassegno.* C'era un elemento con lo stesso nome ma con dati diversi. La tua risorsa è collegata e subito segnata *differisce — decidi*. Continua al passaggio 6.

### 5. Scollega una copia

Se in un progetto vuoi discostarti dalla libreria, per esempio con una tariffa diversa, scolleghi la copia.

1. Nella vista *Progetto*, fai clic sull'icona *Scollega dalla libreria* alla fine della riga.
2. La risorsa ora è una normale risorsa del progetto. Tutti i campi sono modificabili e non segue più la libreria. Anche il calendario che è arrivato con la risorsa viene scollegato, a meno che un'altra risorsa di questo progetto lo segua ancora.

Con *Annulla* (Ctrl+Z) annulli lo scollegamento.

### 6. Risolvi una deviazione

Una copia che dice *differisce — decidi* è diversa dall'elemento della libreria. L'app non sceglie chi ha ragione.

1. Fai clic sul contrassegno *differisce — decidi* sulla risorsa. Si apre la finestra *Collega libreria di risorse*. Si apre anche da sola quando apri un file con una copia così.
2. Nella sezione *Deviazioni*, scegli che cosa vuoi per l'elemento, vedi sotto.
3. Fai clic su *Decidi più tardi* se non vuoi ancora scegliere. La finestra si chiude e il contrassegno resta.

Per una deviazione hai due scelte:

- *Usa i valori della libreria*: la copia prende i dati dalla libreria.
- *Adotta i valori del file nella libreria*: la libreria prende i dati dalla tua copia. Sotto c'è scritto *Attenzione: questo modifica la libreria e vale per tutti i tuoi progetti.* Le copie negli altri progetti aperti seguono.

## Problemi possibili e che cosa fa allora l'app

**I progetti di esempio hanno una libreria propria.** Se apri uno dei tre esempi dimostrativi (*File › Esempi*, oppure tramite un link nella Guida), l'app crea una volta la libreria *Libreria di risorse demo* e collega il progetto a lei. Le risorse del progetto con lo stesso nome di un elemento della libreria vengono collegate subito; i calendari no. Le tue librerie restano invariate. Se apri due esempi dimostrativi uno accanto all'altro, insieme mostrano conflitti in [Usare la panoramica dell'occupazione](docs://howto-bezettingsoverzicht-gebruiken), per esempio per la squadra di muratori (*Masonry crew*) tra *Refurbishment & Extension of a Family Home* e *6 New Terraced Houses, De Akkers*.

**Non vedi il selettore.** Il progetto non è collegato a una libreria. Fai il passaggio 1.

**Modifichi la libreria per sbaglio.** Il pannello si apre sempre su *Progetto* per evitarlo. Le modifiche nella vista *Libreria* valgono per tutti i progetti e non rientrano in *Annulla*.

**Elimini una risorsa dalla libreria.** L'app chiede prima *Rimuovere «Bricklayer» dalla libreria? Questo vale per tutti i progetti e non può essere annullato.* Le copie nei tuoi progetti restano e continuano a funzionare. Ottengono il contrassegno *non più nella libreria* e sono completamente modificabili. Con *Rimuovi dal progetto* togli una copia dal progetto.

**Sotto *Libreria di risorse* scegli un'altra libreria o *nessuna (progetto autonomo)*.** Le tracce di origine della libreria precedente scompaiono. Le risorse restano nel progetto come normali risorse del progetto. Con un'altra libreria, l'app cerca di nuovo le risorse con lo stesso nome.

**Una risorsa non ha suggerimenti in *Riconosci*.** Lì c'è scritto *Nessun suggerimento — scegli manualmente*, ma questa finestra non ha un pulsante per questo. Sembra una mancanza. Metti una risorsa così nella libreria con *Nella libreria* (passaggio 4).

## Vedi anche

- [La libreria di risorse](docs://uitleg-resourcebibliotheek): che cosa decide la libreria, che cosa decide il progetto, e come seguono le copie.
- [Gestire e condividere le librerie di risorse](docs://howto-bibliotheken-beheren): creare, esportare e importare librerie.
- [Usare la panoramica dell'occupazione](docs://howto-bezettingsoverzicht-gebruiken): vedere se due progetti chiedono la stessa risorsa nello stesso momento.
- [Gestire le risorse](docs://howto-resources-beheren): le risorse di un singolo progetto.
