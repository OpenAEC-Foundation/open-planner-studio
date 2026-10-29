# Pannello risorse

Il pannello risorse è il luogo in cui gestisci le risorse: chi e che cosa è disponibile, con quale capacità e su quale calendario. L'istogramma sotto il Gantt e la sovrassegnazione fanno parte di questo pannello. Questo articolo spiega per ogni campo e pulsante che cosa fa, qual è il valore predefinito e che cosa noti. Come creare e assegnare risorse è spiegato in [Gestire le risorse](docs://howto-resources-beheren) e [Assegnare risorse con una curva](docs://howto-resource-toewijzen). Come risolvere la sovrassegnazione è spiegato in [Risolvere la sovrassegnazione](docs://howto-overbezetting-oplossen).

## Dove trovarlo

- **Pannello completo** — *Risorse › Gestisci › Risorse* oppure *Vista › Pannelli › Risorse*. Occupa tutta l'area di lavoro; la croce in alto a destra lo chiude.
- **Dock risorse** — *Risorse › Gestisci › Dock risorse* oppure *Vista › Pannelli › Dock risorse*: un elenco compatto nella colonna a destra, accanto al Gantt. Vedi sotto.
- **Istogramma** — *Risorse › Istogramma › Istogramma* oppure *Vista › Pannelli › Istogramma*: una striscia sotto il Gantt. Vedi sotto.
- **Viste** — se il progetto appartiene a una libreria di risorse, in alto a destra del pannello puoi scegliere tra *Libreria*, *Progetto* e *Occupazione*. Senza libreria c'è solo la tabella del progetto. Ogni volta che lo apri, il pannello si avvia su *Progetto*. Così non finisci per caso nella libreria condivisa.

## Nuova risorsa

- **Nuova risorsa nel progetto** (nella vista *Libreria*: *Nuova risorsa nella libreria*) — pulsante in alto a destra. Apre una riga di bozza in fondo alla tabella. Non si crea nulla finché non inserisci un nome e lasci la riga (o premi Invio). Se clicchi altrove con la riga vuota, o premi Esc, non resta nulla: nessuna risorsa e nessun passo sotto *Annulla*. Puoi compilare i campi in qualsiasi ordine; tutto viene salvato in una volta. Invio o la freccia in giù salva la riga e apre una nuova riga di bozza. Maiusc+Invio o la freccia in su salva la riga e torna nella tabella. La riga di bozza non ha la freccia per la capacità, la matita del calendario e il cestino, perché questi lavorano su una risorsa che non esiste ancora. Il pulsante *Nuova risorsa* in *Risorse › Gestisci* fa lo stesso.
- **Navigazione nella griglia** — nella tabella, Invio, Maiusc+Invio e le frecce su e giù spostano il cursore tra le righe. Invio sull'ultima riga apre una nuova riga di bozza.

## La vista Progetto

La tabella di ciò che questo progetto usa. Ogni riga è una risorsa. Le modifiche a testo e tariffa hanno effetto appena lasci il campo e contano come un solo passo sotto *Annulla*.

- **Colore** — un selettore di colore. Predefinito: il primo colore libero della tavolozza. Effetto: il colore dell'accento risorsa sotto le barre del Gantt (*Vista › Baseline e progresso › Accento risorsa*) e del campione nel dock.
- **Nome** — il nome della risorsa. Un nome vuoto non viene salvato; il campo torna al nome precedente.
- **Tipo** — *Manodopera*, *Attrezzatura*, *Materiale*, *Subappaltatore* o *Squadra*. Predefinito per una nuova risorsa: *Manodopera*. Effetto: *Materiale* ha una *Unità* e non conta nella somma *Tutte le risorse* dell'istogramma; il livellamento salta il materiale. *Squadra* si può scegliere come *Squadra* di altre risorse. Gli altri tipi calcolano allo stesso modo.
- **Unità max** — quanta parte della risorsa è disponibile per giorno, un numero maggiore di 0 (sono ammesse frazioni). Predefinito: 1. Effetto: la capacità per giorno. Se il carico è più alto, la risorsa è sovrassegnata. La freccia accanto apre la *Capacità scaglionata nel tempo*; il numero accanto alla freccia è il numero di fasi.
- **Capacità scaglionata nel tempo** — fasi con *Da* (una data) e *Unità max*. *Aggiungi fase* aggiunge una fase con oggi e 1. Senza fasi compare *Nessuna fase — si applica sempre l'unità max. fissa.* Effetto: dalla data di una fase vale la sua *Unità max* al posto del valore fisso. Vince l'ultima fase con una data uguale o precedente al giorno.
- **Calendario** — un elenco con *Calendario di progetto* (predefinito), i calendari del progetto e *+ Calendario risorsa* per crearne uno nuovo. La matita (*Modifica…*) apre il calendario scelto ed è disattivata per *Calendario di progetto*. Effetto: i giorni in cui la risorsa lavora. In un giorno libero la capacità è 0; se è pianificato lavoro, la risorsa è sovrassegnata con il motivo *Non lavora in questo giorno secondo il calendario "…"*. Il calendario risorsa non cambia le date di un'attività. Vedi [Finestre del calendario](docs://ref-kalenders).
- **Tariffa/ora** — il costo per ora. Vuoto = nessuna tariffa; un numero non valido torna al valore precedente. Effetto: nessuna influenza sulla pianificazione o sul carico. La tariffa determina la colonna *Totale*, viene salvata nel file IFC e viene scritta anche quando esporti verso MS Project (tariffa standard) e Primavera P6 XML (prezzo per unità).
- **Totale** — sola lettura: le ore caricate × la tariffa, con due decimali; *—* senza tariffa o carico. In fondo una riga *Totale* somma tutte le risorse. Le ore vengono dall'ultimo calcolo e contano unità × ore per giorno del calendario dell'attività. Non aggiornato? Premi *Calcola*.
- **Unità** — l'unità di misura del materiale, per esempio `m³`. Compilabile solo per il tipo *Materiale* (suggerimento *Da compilare solo per le risorse di tipo Materiale.*). Effetto: un'etichetta; non calcola nulla.
- **Squadra** — la squadra a cui appartiene la risorsa, scelta tra le risorse di tipo *Squadra*. Predefinito: *Nessuna*. Effetto: solo raggruppamento; la capacità e il carico di una squadra non sono la somma dei suoi membri.
- **Elimina** (il cestino) — elimina la risorsa. Se ha assegnazioni, l'app chiede prima *'…' ha … assegnazione/i — eliminare?* con un segno di spunta per confermare e una croce per annullare.
- **Alla libreria** — solo quando il progetto appartiene a una libreria di risorse, per una risorsa con un nome che non viene ancora dalla libreria. La mette nella libreria, oppure la collega a un elemento esistente con lo stesso nome, e segnala cosa è successo (*Aggiunto.*, *Esisteva già nella libreria — ora collegato.* oppure *Collegato all'elemento esistente della libreria — i valori differiscono, vedi il contrassegno.*).
- **Scollega dalla libreria** — l'icona di scollegamento su una risorsa che viene dalla libreria. Rimuove l'origine; dopo, tutti i campi sono di nuovo liberi.

Senza risorse compare *Ancora nessuna risorsa. Aggiungine una per iniziare.* Se il progetto appartiene a una libreria, compare *Questo progetto non utilizza ancora risorse dalla libreria.* con un suggerimento.

### Risorse dalla libreria

Una risorsa che viene dalla libreria ha una piccola icona di libreria (*Dalla libreria*). Il suo *Nome*, *Tipo*, *Tariffa/ora* e *Unità* sono allora solo testo (*Valore di libreria — modificalo nella vista Libreria, oppure scollega questa risorsa dalla libreria.*), perché la libreria decide che cosa è la risorsa. *Colore*, *Unità max*, le fasi di capacità, *Calendario* e *Squadra* restano modificabili, perché il progetto decide quanto e quando. Possono comparire due contrassegni: *differisce — decidi* (un clic apre la finestra *Collega libreria di risorse*) e *non più nella libreria*, con il pulsante *Rimuovi dal progetto*.

## La vista Libreria

Solo quando il progetto appartiene a una libreria di risorse. Vedi [Usare la libreria di risorse](docs://howto-resourcebibliotheek-gebruiken) e [Gestire e condividere le librerie di risorse](docs://howto-bibliotheken-beheren). In alto c'è un avviso colorato: *Questo modifica la libreria e vale per tutti i progetti — fuori dall'annulla.* La tabella ha gli stessi campi della vista *Progetto*, con queste differenze:

- Non c'è la colonna *Totale*: è un calcolo per un solo progetto.
- La colonna *Squadra* compare non appena la libreria ha risorse.
- La colonna *Calendario* offre i calendari della libreria, con *Nessun calendario* come predefinito.
- **Assegna al progetto** — mette la risorsa nel progetto, con una copia del suo calendario. Mostra *Aggiunto.* oppure *Già presente nel progetto.*
- **Elimina** — chiede *Rimuovere «…» dalla libreria? Questo vale per tutti i progetti e non può essere annullato.*
- Senza risorse compare *Ancora nessuna risorsa nel pool.*

## La vista Occupazione

Una vista di sola lettura su tutti i documenti aperti: quali risorse della libreria sono prenotate dove. Non c'è un pulsante per una nuova risorsa. Vedi [Usare la panoramica dell'occupazione](docs://howto-bezettingsoverzicht-gebruiken).

- **Tabella** — per ogni risorsa della libreria: *Nome*, *Documenti* (il numero di documenti in cui compare), *Periodo* e *Picco / capacità* (il carico combinato più alto, rispetto alla capacità di quel giorno). Un *N giorni con doppia prenotazione* in rosso significa che, in più documenti, la risorsa supera la sua capacità. La freccia accanto a un nome apre i documenti, ciascuno con periodo e picco. Un clic su una riga mostra l'istogramma di quella risorsa (*Seleziona una risorsa per vedere l'istogramma.*).
- **Cosa conta** — solo i documenti aperti in questa app (*Questa panoramica vede solo i documenti aperti in questa applicazione.*). Un documento che non è stato calcolato riceve un messaggio nella sua riga. Il documento attivo conta con gli ultimi valori calcolati (*Non aggiornato: questi sono gli ultimi valori calcolati — premi F5 in questo documento.*). Un altro documento viene calcolato in anticipo dalla panoramica (*Calcolato in anticipo per questa panoramica — il documento stesso mostra ancora le date precedenti finché non premi F5 al suo interno o attivi “Calcola automaticamente”.*). Se *Calcola automaticamente* è attivo, la panoramica calcola davvero quei documenti. Se il calcolo non riesce, il documento non conta (*Non conteggiato: pianificazione non calcolata — attiva questo documento e premi F5.*). Senza risorse prenotate compare *Nessuna risorsa della libreria prenotata nei documenti aperti.*
- **Ordine** — prima le risorse con doppie prenotazioni, con più giorni in conflitto in cima, poi in ordine alfabetico.

## Il dock risorse

Un elenco compatto nella colonna a destra, accanto al pannello *Proprietà*. Per ogni risorsa: un campione di colore, il nome (sola lettura), un triangolo rosso *Sovrassegnato* appena la risorsa ha almeno un giorno sovrassegnato, e *Unità max* da modificare. Se c'è una selezione di attività, sono elencate solo le risorse di quelle attività. Nell'intestazione ci sono *Pannello completo* (apre il pannello completo) e *Chiudi aggancio*. Senza risorse compare *Ancora nessuna risorsa. Aggiungine una per iniziare.*

## L'istogramma

Una striscia sotto il Gantt che mostra il carico di una risorsa per giorno. Attivala o disattivala con *Risorse › Istogramma › Istogramma* oppure *Vista › Pannelli › Istogramma*. Predefinito: disattivato; la tua scelta viene ricordata. L'altezza è 160 pixel per impostazione predefinita e si può trascinare sul bordo tra il Gantt e l'istogramma.

- **Selettore** — a sinistra, sotto la tabella attività, c'è un elenco: *Tutte le risorse* fissato in alto, sotto una riga per ogni risorsa. Un clic sceglie la riga, i tasti freccia la scorrono, e *Risorse › Istogramma › Precedente* e *Successiva* fanno lo stesso. Un punto rosso accanto a una riga significa che quella risorsa ha almeno un giorno sovrassegnato; per *Tutte le risorse* il punto guarda solo le risorse che non sono materiale. Se c'è una selezione di attività, l'elenco contiene solo le risorse di quelle attività. Se la risorsa scelta ne è fuori, la striscia mostra per un momento *Tutte le risorse* della selezione.
- **Barre** — una barra per giorno: il carico in unità. Una linea mostra la capacità; la parte della barra sopra la capacità è rossa. In alto a sinistra c'è il valore più alto con *unità*. *Tutte le risorse* somma il carico e la capacità di tutte le risorse, escluso il materiale.
- **Suggerimento** — tieni fermo il mouse per un momento sopra un giorno: *N attività contribuiscono il {date}* con i nomi di al massimo otto attività. Per una risorsa scelta e un giorno in cui il suo calendario non lavora, compare anche *Non lavora in questo giorno secondo il calendario "…"*.
- **Messaggi nella striscia** — *Ricalcola (F5) per mostrare il carico* finché non c'è carico, *Ancora nessuna risorsa* senza risorse, e *⚠ Pianificazione non aggiornata — ricalcola (F5)* in alto a destra quando la pianificazione non è aggiornata.
- **Cosa conta** — le unità per giorno di ogni assegnazione, distribuite sui giorni lavorativi dell'attività secondo la *Curva* (oppure la *Distribuzione ore*); solo attività foglia, senza cardini. Il carico si aggiorna dopo *Calcola* e dopo modifiche alle risorse e alle assegnazioni. Se cambi le date delle attività, conta solo dopo *Calcola*.

## Sovrassegnazione

Una risorsa è sovrassegnata in un giorno se il suo carico è più alto della sua capacità. La capacità è *Unità max* (con le fasi di capacità) in un giorno lavorativo del suo calendario, e 0 in un giorno libero. Anche il materiale conta qui. La causa è una capacità troppo bassa, oppure un giorno in cui la risorsa non lavora secondo il suo calendario.

Dove lo vedi:

- **Risorse › Sovrassegnazione** — il numero di risorse sovrassegnate, oppure *Nessuna*.
- **Barra di stato** — *N risorsa/e sovrassegnata/e*; un clic apre il pannello *Avvisi*.
- **Avvisi** — una riga per risorsa *Sovrassegnata per N giorno/i (primo – ultimo)*, con *la risorsa non lavora in questi giorni secondo il suo calendario* aggiunto se tutti i giorni sono giorni liberi, oppure *di cui N giorno/i la risorsa non lavora secondo il suo calendario* per un misto. Vedi [Notifiche e avvisi](docs://ref-meldingen).
- **Istogramma** — le parti rosse delle barre e il punto rosso nel selettore.
- **Dock** — il triangolo *Sovrassegnato*.

Il livellamento può risolvere la sovrassegnazione facendo iniziare le attività più tardi. Per impostazione predefinita la data di fine del progetto può spostarsi; con *livellamento* resta entro il margine. Il livellamento non risolve una risorsa che deve lavorare in un giorno libero. Vedi [Livellamento](docs://uitleg-nivelleren).
