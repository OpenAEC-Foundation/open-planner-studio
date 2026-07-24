# Risorse, istogramma e livellamento

Un'attività ti dice quando deve succedere qualcosa; una risorsa ti dice chi o cosa lo farà — e quanto ne è disponibile in un dato giorno. Non appena assegni risorse alle attività, un giorno può richiedere più di quanto ci sia capacità: una sovrallocazione. Questa guida mostra come gestire e assegnare le risorse, come leggere il carico nell'istogramma, e come (e quando *non*) il livellamento risolve una sovrallocazione.

## Cosa imparerai qui

- I cinque tipi di risorsa e quando usare ciascuno.
- Assegnare risorse alle attività — tramite il pannello delle proprietà, la finestra di dialogo attività o la barra multifunzione.
- Unità al giorno e le sei curve di distribuzione: quando scegliere quale.
- Spostare un'assegnazione a un'attività diversa.
- Calendari risorsa e capacità scaglionata nel tempo (ad esempio una seconda gru aggiunta più tardi).
- Leggere l'istogramma: il selettore di risorse, l'approfondimento per risorsa, individuare la sovrallocazione.
- Il pannello risorse agganciato accanto al Gantt.
- Livellamento: le opzioni nella finestra **Livella risorse**, la differenza tra restare entro il margine e lasciare che la data di fine si sposti, e le priorità (inclusa la priorità 1000 = "non livellare").
- La lezione onesta: quando il livellamento *non* risolve una sovrallocazione.

Segui con [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (dimensioni medie, una sovrallocazione deliberata e risolvibile con il livellamento sugli intonacatori) e con [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (grande, quasi ogni risorsa sovraccarica perché tre torri hanno bisogno delle stesse squadre e della stessa gru a torre contemporaneamente — l'esempio dove il livellamento incontra i suoi limiti).

## I cinque tipi di risorsa

Ogni risorsa ha un **Tipo** (una colonna nel pannello risorse):

- **Manodopera (LABOR)** — lavoratori specializzati: muratori, intonacatori, installatori.
- **Attrezzatura (EQUIPMENT)** — macchine e attrezzature: una gru a torre, un montacarichi da cantiere.
- **Materiale (MATERIAL)** — beni di consumo con un'**Unità** (ad esempio m³ di calcestruzzo). Il materiale non viene mai livellato e non viene mai conteggiato nell'istogramma — è una scorta, non una capacità giornaliera che può traboccare.
- **Subappaltatore (SUBCONTRACTOR)** — un'azienda esterna con il proprio limite di capacità, ad esempio un appaltatore di facciate che può schierare solo due squadre alla volta.
- **Squadra (CREW)** — un gruppo ombrello. Altre risorse possono unirsi a una squadra tramite la colonna **Squadra** nel pannello per il raggruppamento/la panoramica; questo è puramente informativo — non c'è un accumulo automatico di capacità sulla squadra.

## Gestire le risorse

Apri il pannello risorse tramite il gruppo della barra multifunzione **Gestisci** sulla scheda **Risorse**: il pulsante **Risorse** apre il pannello completo (una vista a pannello intero separata, come Tabella o Relazioni), **Nuova risorsa** aggiunge una riga direttamente. Nel pannello modifichi, per risorsa: **Nome**, **Tipo**, **Unità max.** (capacità per giorno lavorativo — 1 = una persona/elemento a tempo pieno, 2 = due unità contemporaneamente), **Calendario**, **Tariffa/ora**, **Unità** (solo materiale) e **Squadra** (a quale squadra appartiene questa risorsa). In fondo, la colonna **Totale** somma il costo di ogni risorsa (unità caricate × ore/giorno × tariffa), ricalcolato a ogni F5.

### Capacità scaglionata nel tempo

Accanto a **Unità max.** c'è una freccia che espande una sotto-riga **Capacità scaglionata nel tempo**: qui aggiungi fasi (una data **Da** + **Unità max.**) per una capacità che cambia nel corso del progetto. Il grande esempio la usa per la gru a torre: parte da **Unità max. 1**, con una fase che alza la capacità a **2** **dal giorno 130** — il momento in cui viene aggiunta una seconda gru. Prima di quella data, tutte e tre le torri devono condividere una singola gru; dopo, due torri possono sollevare contemporaneamente.

## Assegnare risorse

Ci sono tre posti dove gestisci un'assegnazione — operano sugli stessi dati sottostanti, quindi qualsiasi cosa fai in uno appare immediatamente negli altri:

1. **Pannello delle proprietà** — la sezione **Assegnazioni** sotto un'attività selezionata: un menu a tendina per **Assegna risorsa** con le risorse non ancora assegnate, e per ogni assegnazione esistente le **unità/giorno**, la **curva** e un pulsante per rimuoverla.
2. **Finestra di dialogo attività** — la stessa sezione **Assegnazioni**, nella finestra **Modifica attività**.
3. **Barra multifunzione** — scheda **Risorse**, gruppo della barra multifunzione **Assegnazione**, il pulsante **Assegna ▾**. Questo pulsante è attivo solo quando è selezionata esattamente un'attività non-traguardo e non-riepilogo; il menu a tendina permette di impostare prima **unità/giorno** e **curva** e poi elenca sotto le risorse non ancora assegnate — fai clic su un nome per completare un'assegnazione in un colpo solo.

I traguardi e le attività di riepilogo non possono avere risorse (non hanno una propria durata da caricare) — entrambi i posti mostrano una spiegazione invece del modulo di assegnazione.

### Spostare un'assegnazione

Hai assegnato una risorsa all'attività sbagliata per errore, o stai spostando lavoro da un'attività a un'altra? Nella sezione **Assegnazioni** del pannello delle proprietà (o della finestra di dialogo attività), ogni assegnazione ha un menu a tendina **Sposta in…** che elenca le attività candidate (attività foglia senza questa risorsa, esclusa l'attività attuale). Sceglierne una sposta l'assegnazione in un solo passaggio, comprese le sue unità e curva — non serve rimuoverla e ricrearla.

## Unità e curve di distribuzione

Ogni assegnazione ha **unità/giorno** (1 = una persona/elemento a tempo pieno, 0,5 = mezza giornata) e una **curva** che determina come quel carico si distribuisce sulla durata dell'attività:

- **Uniforme** — piatta, la stessa quantità ogni giorno. Il predefinito, e il punto di partenza giusto per la maggior parte delle attività.
- **Caricato all'inizio (FRONT_LOADED)** — la maggior parte del lavoro all'inizio dell'attività, che si riduce verso la fine.
- **Caricato alla fine (BACK_LOADED)** — l'immagine speculare: aumenta verso la fine, ad esempio un'attività che deve prendere slancio.
- **A campana (BELL)** — basso all'inizio e alla fine, con il picco nel mezzo — un'attività che sale, procede a pieno ritmo e poi rallenta di nuovo.
- **Picco anticipato (EARLY_PEAK)** — il picco si trova all'inizio dell'attività, poi il carico si riduce.
- **Picco tardivo (LATE_PEAK)** — il picco si trova alla fine dell'attività.

La variazione della curva si nota più chiaramente nell'istogramma: la stessa attività con le stesse unità/giorno produce una forma di barra molto diversa con una curva a campana rispetto a una uniforme. L'esempio di dimensioni medie mescola deliberatamente uniforme/caricato all'inizio/caricato alla fine sulle attività di finitura per casa, così puoi confrontare la differenza.

## Calendari risorsa

Una risorsa può stare sul **Calendario di progetto** (predefinito) o sul proprio calendario — ad esempio per un subappaltatore disponibile solo quattro giorni a settimana. Imposta questo tramite la colonna **Calendario** nel pannello risorse, o il campo **Calendario** sulla risorsa stessa. Un calendario risorsa non tocca mai le date CPM di un'attività (quelle continuano a funzionare sul calendario dell'attività/progetto) — influisce solo su **carico** e **livellamento**: se una risorsa non lavora in un giorno di cui l'attività ha bisogno, ciò conta come carenza nell'istogramma, e il livellatore avvisa che spostare non risolverà quel disallineamento di calendario. Vedi la guida [Calendari e pianificazione oraria](docs://gids-kalenders-uren) per la spiegazione completa dei calendari.

## Leggere l'istogramma

Attiva l'istogramma tramite il gruppo della barra multifunzione **Istogramma** sulla scheda **Risorse** (il pulsante **Istogramma**). Appare una striscia sotto il Gantt sullo stesso asse temporale: barre per giorno, con la parte sopra la linea di capacità mostrata in rosso.

A sinistra delle barre, sopra la colonna della tabella delle attività, si trova il **selettore di risorse**: un elenco con "Tutte le risorse" in alto e ogni risorsa sotto, ciascuna con un punto rosso se quella risorsa è sovrallocata da qualche parte. Fai clic su un nome per ingrandire quella singola risorsa — l'istogramma si riscala sul suo carico e sulla sua capacità soltanto. Fai clic di nuovo su "Tutte le risorse" per vedere di nuovo la somma di tutte le risorse. Oltre a fare clic, puoi anche scorrere le risorse con i pulsanti **Precedente**/**Successiva** nel gruppo della barra multifunzione **Istogramma**, senza toccare il selettore stesso.

Fai clic su una barra sovraccarica e un tooltip mostra quante attività contribuiscono al carico quel giorno, con i primi nomi delle attività — comodo per vedere rapidamente quale combinazione di attività causa la sovrallocazione senza controllare ogni assegnazione a mano.

Se vedi "Ricalcola (F5) per mostrare il carico" invece delle barre, la pianificazione non è stata (ri)calcolata dall'ultima modifica — l'istogramma, come il percorso critico, è un'istantanea che aggiorni tu stesso.

## Il pannello risorse agganciato

Oltre al pannello risorse completo (pulsante della barra multifunzione **Risorse**), c'è una variante compatta che puoi agganciare a destra: il pulsante **Aggancia** nel gruppo della barra multifunzione **Gestisci**. Questo pannello agganciato mostra solo il nome, le **Unità max.** (modificabili direttamente) e un punto rosso/verde per la sovrallocazione — una panoramica rapida accanto al tuo Gantt senza aprire il pannello completo. Il pannello risorse agganciato e il pannello delle proprietà di un'attività si escludono a vicenda — vedrai solo uno dei due nella colonna destra alla volta.

## Individuare la sovrallocazione

Una risorsa è sovraccarica in un giorno non appena le unità sommate di tutte le sue assegnazioni quel giorno superano le sue **Unità max.**. Lo vedrai in tre posti: la parte rossa della barra nell'istogramma, il punto rosso nel selettore di risorse e nel pannello agganciato, e il contatore **Sovrallocazione** nel gruppo della barra multifunzione sulla scheda Risorse ("N risorse" con un'icona di avviso, o "Nessuna").

L'esempio di dimensioni medie lo rende visibile di proposito: all'inizio di giugno gli **Stukadoors** (intonacatori, unità max. 2) ottengono un'assegnazione di 2 unità su tre case contemporaneamente (l'intonacatura delle case 1, 2 e 3 si sovrappone lì per alcuni giorni) — 6 unità combinate al picco, ben al di sopra della capacità di 2.

## Livellamento

Apri la finestra **Livella risorse** tramite il pulsante **Livella…** nel gruppo della barra multifunzione **Livellamento** sulla scheda Risorse. La finestra richiede un calcolo valido e aggiornato (ricalcola con F5 prima se la pianificazione non è aggiornata) e funziona in due passaggi: prima **Calcola** per una proposta, poi **Applica** — nulla cambia nella tua pianificazione finché non hai visto la proposta.

Nella finestra scegli:

- **Risorse** — quali risorse partecipano all'esecuzione del livellamento (tutte per impostazione predefinita; il materiale è sempre escluso — non viene mai livellato).
- **Livella solo entro il margine (attenuazione)** — una casella di spunta con un sottotitolo chiaro: "la data di fine progetto resta invariata". Disattivata (**livellamento**), il livellatore può spostare le attività quanto serve, anche oltre il proprio margine, il che può posticipare la data di fine progetto. Attivata (**attenuazione**), la data di fine è sacra — il livellatore sposta solo entro il margine esistente di ogni attività, e un conflitto che non ci rientra resta contrassegnato come conflitto rimanente.

Dopo **Calcola**, la finestra mostra una tabella con ogni attività il cui inizio cambia (vecchio inizio → nuovo inizio → giorni spostati), una riga che segnala se la data di fine progetto cambia, e — se restano conflitti — una sezione **Conflitti rimanenti** con, per attività, la motivazione: un disallineamento di calendario (la risorsa non lavora i giorni di cui l'attività ha bisogno), capacità libera insufficiente entro il margine, oppure un superamento intrinseco (una singola assegnazione richiede già più al suo picco di quanto la risorsa potrebbe mai fornire — nessuno spostamento lo risolve). Solo quando sei soddisfatto della proposta fai clic su **Applica**.

Provalo tu stesso sulla sovrallocazione degli intonacatori nell'esempio di dimensioni medie: apri **Nieuwbouw 6 Rijwoningen De Akkers**, vai alla scheda **Risorse** e apri **Livella risorse**. Lascia tutte le risorse selezionate, lascia l'attenuazione disattivata e fai clic su **Calcola**: i conflitti scompaiono completamente (0 conflitti rimanenti), ma la data di fine progetto si sposta di circa una settimana più tardi. Poi seleziona **Livella solo entro il margine** e calcola di nuovo: la data di fine ora resta invariata, ma un'attività (l'intonacatura in una delle case) rimane come conflitto contrassegnato — semplicemente non c'è abbastanza margine per farla rientrare interamente nella pianificazione esistente. Questo è esattamente il compromesso che questa casella rende visibile: risolvi il problema lasciando andare la data di fine, oppure mantieni la data di fine fissa e accetti un conflitto rimanente contrassegnato?

### Priorità

Ogni attività ha una **priorità di livellamento** da 0 a 1000 (predefinita 500). Fai clic destro su un'attività e scegli **Priorità** per tre preimpostazioni: **Bassa** (100), **Normale** (500) e **Alta** (900) — in un conflitto di capacità tra due attività, quella con la priorità più alta ottiene la prima rivendicazione sulla capacità scarsa. Il valore **1000** è un caso speciale: "non livellare" (MS Project lo chiama "Do Not Level"). Un'attività del genere passa comunque attraverso il ciclo di livellamento e segue i propri predecessori, eventualmente spostati, ma essa stessa non viene mai spostata per liberare capacità. Il grande esempio lo usa su "Nutsaansluitingen aanleggen" (posa degli allacciamenti alle utenze): una data di allacciamento fissa impostata dall'azienda di servizi che non deve muoversi, qualunque cosa proponga altrimenti l'esecuzione del livellamento.

**Cancella livellamento** (nel gruppo della barra multifunzione **Livellamento**) rimuove in un colpo solo ogni spostamento applicato in precedenza — comodo per tornare alla pianificazione originale, non livellata, senza reimpostare ogni attività a mano.

## La lezione onesta: quando il livellamento non aiuta

Il livellamento risolve una sovrallocazione riorganizzando il lavoro nel tempo — entro il margine, o, se necessario, con una data di fine posticipata. Funziona bene finché c'è abbastanza spazio (margine o tempo) da qualche parte nella pianificazione per ridistribuire la domanda in eccesso. Fondamentalmente *non* funziona quando la domanda è strutturalmente maggiore di quanto sarà mai disponibile, indipendentemente da come sposti le cose.

Il grande esempio lo mostra su più risorse contemporaneamente: poiché le tre torri procedono in gran parte in parallelo e condividono le stesse squadre (muratori, installatori, intonacatori, posatori di piastrelle, la gru a torre), quasi ogni risorsa di manodopera è sovraccarica a un certo punto. Livella con tutte le risorse selezionate e la data di fine libera, e la maggior parte dei conflitti scompare — ma la data di fine progetto slitta di mesi, e una manciata di attività di finitura per torre (piastrellatura, cucine, sanitari, pittura) rimangono come superamento intrinseco: il carico di picco di una singola assegnazione lì supera già la capacità, quindi nessuno spostamento aiuta. Attiva l'attenuazione per proteggere la data di fine, e una quota molto più grande dei conflitti semplicemente resta irrisolta.

La lezione non è che il livellamento "non funziona" — l'algoritmo fa esattamente ciò che gli viene chiesto. La lezione è che il livellamento è uno strumento di **pianificazione**, non uno strumento di **capacità**: riorganizza il lavoro esistente entro il tempo esistente, ma non crea manodopera, attrezzatura o giorni di calendario extra. Una carenza strutturale — troppo pochi intonacatori per tre torri contemporaneamente, una gru a torre che serve tre cantieri — richiede una soluzione diversa: assumere più capacità, adattare la suddivisione in fasi (torri una dopo l'altra invece che in parallelo, cosa che la fase della seconda gru dal giorno 130 già fa in parte), o dividere diversamente il lavoro. Il livellamento è lo strumento che ti mostra dove fa male; non risolve per te la questione di capacità sottostante.

## Continua a leggere

- Ripeti tu stesso il livellamento della sovrallocazione degli intonacatori in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Vedi i limiti del livellamento in pratica — più tutti e cinque i tipi di risorsa, tutte e sei le curve e la capacità scaglionata nel tempo della gru a torre — in [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Le risorse funzionano su calendari — leggi la guida [Calendari e pianificazione oraria](docs://gids-kalenders-uren) per i calendari risorsa e la pianificazione oraria.
- Vuoi impostare una baseline prima di iniziare a livellare, così puoi vedere la differenza? Leggi la guida [Baseline e avanzamento](docs://gids-baselines-voortgang).
- Il livellamento può cambiare quali attività sono critiche — leggi la guida [Percorso critico e analisi avanzata](docs://gids-kritiek-pad-analyse) per capire come individuarlo.
