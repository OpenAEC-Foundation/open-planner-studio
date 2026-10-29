# Calendari e giorni lavorativi

Quanti giorni lavorativi richiede un'attività, e in quale data è finita? Dipende dal calendario in cui l'app conta. In questo articolo leggi che cos'è un calendario, come l'app conta i giorni lavorativi con quel calendario e quale calendario prevale quando ne intervengono più di uno. L'esempio svolto ti aiuta a seguire i numeri.

## Il concetto

Una pianificazione conta in **giorni lavorativi**, non in giorni di calendario. "Cinque giorni di muratura" significa cinque giorni in cui si lavora. Un fine settimana o una festività non conta, quindi un'attività del genere copre più di cinque giorni sull'agenda.

Quali giorni sono lavorativi è registrato in un **calendario**. Un calendario fissa tre cose:

- La **settimana lavorativa**: i giorni feriali in cui si lavora. Il valore predefinito è dal lunedì al venerdì.
- Gli **orari di lavoro**: inizio, fine e pausa. Danno le **ore nette al giorno**. Il valore predefinito è dalle 07:00 alle 16:00 con un'ora di pausa, quindi 8 ore.
- Le **festività**: singoli giorni o interi periodi in cui non si lavora, come il Giorno del Re, Natale o le ferie edili.

Un progetto ha una libreria di risorse con i calendari. Uno di questi è il **calendario del progetto**. Vale per ogni attività che non ha un calendario proprio. A una singola attività puoi assegnare un altro calendario, per esempio una settimana lavorativa di sei giorni per un subappaltatore che lavora anche il sabato. Anche una risorsa può avere un proprio calendario, ma ha un effetto diverso (vedi sotto).

## Come l'app calcola

Questo articolo descrive il calcolo standard: il profilo di calcolo *Open Planner Studio*, con cui calcola un nuovo progetto.

### Contare i giorni lavorativi

Il primo giorno lavorativo di un'attività conta come giorno 1. Un'attività di 5 giorni finisce quindi il quinto giorno lavorativo. Se l'inizio cade in un periodo non lavorativo, l'attività inizia il giorno lavorativo successivo. Una festività o ferie edili a metà di un'attività non contano: l'attività passa semplicemente oltre e sull'agenda diventa più lunga.

Le ore al giorno non influiscono sulle date di un'attività in giorni. Contano solo la settimana lavorativa e le festività. Gli orari di lavoro entrano in gioco solo per un'attività in ore; questo è spiegato in [Giorni e ore](docs://uitleg-dagen-en-uren).

### Quale calendario prevale

L'app sceglie un calendario per attività:

1. Se l'attività ha un calendario proprio, l'app calcola quell'attività tutta in quel calendario: durata, data di fine e margine.
2. Se non ne ha uno, vale il calendario del progetto. Se un'attività punta a un calendario che non esiste più, ricade anch'essa sul calendario del progetto.

Un'attività di riepilogo (una fase) non ha lavoro proprio e quindi nemmeno un calendario proprio. La sua durata deriva dalle date delle sue attività, e l'app la conta sul calendario del progetto.

Il calendario di una **risorsa** non influisce sulle date. In una pianificazione che costruisci tu nell'app, determina solo quando la risorsa è disponibile: nell'istogramma, per capire quando una risorsa è sovrassegnata, e durante il livellamento.

### Attività su calendari diversi

Quando due attività con calendari diversi sono collegate, vale quanto segue:

- Con una relazione fine-inizio il successore inizia il primo giorno lavorativo dopo la fine del predecessore, contato nel calendario del **successore**. Se un'attività finisce di venerdì, un successore con una settimana lavorativa di sei giorni inizia il sabato.
- Un **ritardo** conta nel calendario del **predecessore** per impostazione predefinita. Puoi cambiarlo sotto *Impostazioni › Progetto › Impostazioni progetto*, nel blocco *Profilo di calcolo e opzioni*, sotto *Opzioni di calcolo di questo progetto*, con la scelta *Calendario del ritardo*: *Predecessore* (predefinito), *Successore*, *24 ore* o *Calendario del progetto*.
- Il **margine totale** conta in giorni lavorativi del calendario dell'attività stessa. In questo profilo il **margine libero** conta nel calendario del successore.

Che cosa sia esattamente un ritardo è spiegato in [Aggiungere relazioni](docs://howto-relaties-leggen); che cosa sia il margine, in [Percorso critico e margine](docs://uitleg-kritiek-pad).

### Nel Gantt

Lo sfondo grigio nel Gantt mostra sempre i giorni non lavorativi del **calendario del progetto**. Un'attività con un calendario proprio può quindi attraversare un giorno grigio, per esempio un'attività di sei giorni che passa per il sabato. Un periodo di festività largo tre giorni o più mostra il suo nome, per esempio *Ferie edili (Nord)*. Questo non accade quando *Mostra solo i giorni lavorativi* è attivo. Se non vuoi vedere affatto i giorni grigi, attiva *Mostra solo i giorni lavorativi* sotto *Impostazioni › Progetto › Impostazioni app*, scheda *Aspetto*, titolo *Asse temporale*.

## Esempio svolto: la pianificazione del cantiere

L'esempio usa il calendario standard *Bouwkalender NL*: dal lunedì al venerdì, con le festività pubbliche olandesi. Tutte le attività durano un numero intero di giorni. Nel tutorial sui calendari (tutorial 3) costruisci tu stesso un calendario del genere.

### Fine settimana, festività e ferie edili

*Brickwork* dura 5 giorni lavorativi e inizia giovedì 13 maggio 2027. Giovedì 13 e venerdì 14 maggio sono il giorno 1 e 2. Il fine settimana e il lunedì di Pentecoste, 17 maggio, non contano. Martedì 18, mercoledì 19 e giovedì 20 maggio sono il giorno 3, 4 e 5. L'attività finisce **giovedì 20 maggio**: otto giorni di calendario per cinque giorni lavorativi.

Le ferie edili rendono la differenza più grande. Prendi *Ferie edili (Nord)*, dal 26 luglio al 13 agosto 2027 compresi, e la stessa attività di 5 giorni lavorativi a partire da venerdì 23 luglio. Venerdì 23 luglio è il giorno 1. Dopo, il calendario resta fermo per tre settimane. Da lunedì 16 a giovedì 19 agosto sono i giorni da 2 a 5. La fine è **giovedì 19 agosto**, 28 giorni di calendario dopo l'inizio. Senza le ferie edili sarebbe stata giovedì 29 luglio.

### Un'attività il sabato

Tre attività si susseguono, tutte con una relazione fine-inizio senza ritardo: *Groundwork* (4 giorni), *Pour foundation* (3 giorni) e *Brickwork* (5 giorni). Il progetto inizia lunedì 24 maggio 2027.

Se tutte e tre sono sul calendario del progetto, *Groundwork* va da lunedì 24 a giovedì 27 maggio. *Pour foundation* va da venerdì 28 maggio a martedì 1 giugno (venerdì, lunedì, martedì). *Brickwork* va da mercoledì 2 giugno a martedì 8 giugno. Il progetto finisce **martedì 8 giugno**.

Dai a *Pour foundation* il calendario *Six-day week* (dal lunedì al sabato) e il sabato conta. L'attività va da venerdì 28 maggio a **lunedì 31 maggio** (venerdì, sabato, lunedì). *Brickwork* resta sul calendario del progetto, inizia martedì 1 giugno e finisce **lunedì 7 giugno**. Tutto il progetto è un giorno più corto, perché un'attività lavora il sabato.

### Un ritardo tra due calendari

*Pour floor* (six-day week, 4 giorni) inizia lunedì 31 maggio e finisce giovedì 3 giugno. *Pointing* (calendario del progetto, 3 giorni) segue con un ritardo di 2 giorni lavorativi. Senza il ritardo *Pointing* inizierebbe venerdì 4 giugno.

- Il ritardo conta per impostazione predefinita nel calendario del predecessore, il calendario six-day week. Da venerdì 4 giugno, sabato 5 giugno è il primo giorno lavorativo e lunedì 7 giugno il secondo. *Pointing* inizia **lunedì 7 giugno** e finisce mercoledì 9 giugno.
- Se imposti *Calendario del ritardo* su *Successore*, conta il calendario del progetto. Il sabato allora non conta: lunedì 7 giugno è il primo giorno lavorativo e martedì 8 giugno il secondo. *Pointing* inizia **martedì 8 giugno** e finisce giovedì 10 giugno.

### Margine nel proprio calendario

*Brickwork* (5 giorni, calendario del progetto) e *Crane hire* (3 giorni, six-day week) iniziano entrambe lunedì 24 maggio. Entrambe sono predecessori di *Fit window frames* (2 giorni, calendario del progetto).

*Brickwork* finisce venerdì 28 maggio, quindi *Fit window frames* inizia lunedì 31 maggio. *Crane hire* è già finita mercoledì 26 maggio. Il margine totale di *Crane hire* conta nel suo calendario: giovedì 27, venerdì 28 e sabato 29 maggio, quindi **3 giorni lavorativi**. Se *Crane hire* fosse sul calendario del progetto, sarebbero stati 2 giorni lavorativi. Il margine libero è 2 giorni lavorativi (giovedì e venerdì), perché l'app lo conta nel calendario del successore.

### Il calendario di una risorsa

In un altro progetto di esempio la risorsa *Bricklaying crew* ha il calendario *Crew Mon–Thu* (dal lunedì al giovedì). È assegnata per 1 unità al giorno a *Brickwork* (5 giorni, calendario del progetto, da lunedì 31 maggio a venerdì 4 giugno).

Le date di *Brickwork* non cambiano. Ma venerdì 4 giugno è rosso nell'istogramma, con il messaggio *Non lavora in questo giorno secondo il calendario "Crew Mon–Thu"*, e la barra multifunzione segnala una risorsa sotto *Sovrallocazione*. Il livellamento non risolve questo caso. Spostare le attività non aiuta, perché cinque giorni lavorativi di fila contengono sempre un venerdì. Nella finestra *Livella risorse* l'attività è quindi elencata sotto *Conflitti rimanenti*, con il motivo *La risorsa non lavora in tutti i giorni richiesti da questa attività — lo spostamento non risolve il problema*.

## Conseguenze e malintesi

**«Il calendario della risorsa sposta le mie attività.»** No. Un calendario di risorsa non cambia nessuna data; rende solo visibili le risorse sovrassegnate. Se vuoi che l'attività stessa si svolga in altri giorni, assegnale un calendario proprio.

**«Se cambio il calendario del progetto, tutto si sposta.»** Si spostano solo le attività senza un calendario proprio. Un'attività a cui hai assegnato tu stesso un calendario dalla lista lo mantiene, anche se per caso è il vecchio calendario del progetto. Se elimini un calendario, le attività e le risorse che lo usavano ricadono sul calendario del progetto.

**«Le festività ci sono, vero?»** Le festività esistono solo per gli anni per cui sono state create. Un giorno al di fuori di quegli anni è semplicemente un giorno lavorativo. Nella finestra di dialogo del calendario l'app lo dice con *Le festività coprono 2025–2028; vuoi rigenerarle fino al 2030 compreso?*

**«Più ore al giorno rendono la mia attività più corta.»** Non per un'attività in giorni: conta giorni lavorativi interi, che il giorno abbia 6 o 8 ore. Solo per un'attività con risorse e con il tipo di attività *Lavoro fisso* o *Unità fisse*, la durata cambia con le ore.

**Un calendario senza giorni lavorativi** non può essere calcolato dall'app. Il calcolo segnala *Nel calendario non sono impostati giorni lavorativi*.

## Vedi anche

- [Giorni e ore](docs://uitleg-dagen-en-uren): come l'app conta gli orari di lavoro e che cosa succede quando si incontrano attività in giorni e attività in ore.
- [Creare e assegnare un calendario](docs://howto-kalender-maken-en-toewijzen): i passi per creare un calendario proprio e assegnarlo alle attività.
- [Generare festività e ferie edili](docs://howto-feestdagen-genereren): inserire le festività di un paese e le ferie edili.
- [Impostare il calendario di una risorsa](docs://howto-resourcekalender-instellen): registrare la disponibilità di una risorsa.
- [Finestre del calendario](docs://ref-kalenders): tutti i campi delle finestre del calendario.
