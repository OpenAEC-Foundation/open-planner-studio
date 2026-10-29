# Tipi di report

Ogni report nella scheda *Rapporto*, con le opzioni che gli appartengono: cosa fanno, il valore iniziale, cosa cambia nel report e dove le trovi. Come creare un report e salvarlo come PDF è spiegato in [Creare e stampare un report](docs://howto-rapport-maken-en-afdrukken).

## Come funziona la finestra del report

Apri la scheda *Rapporto* (oppure premi Ctrl+P). A sinistra c'è la colonna *Rapporto* con il menu a discesa *Tipo di report*, il blocco *Riepilogo* con i conteggi, il blocco *Impostazioni* oppure *Opzioni del rapporto* e in basso il pulsante *Esporta PDF*. A destra c'è l'anteprima. Ciò che vedi nell'anteprima finisce nel PDF.

**Tipo di report** — quale report vedi. Scegli tra undici report. Predefinito: *Diagramma di Gantt*. Dove: *Rapporto*, in cima alla colonna *Rapporto*.

**Esporta PDF** — crea il PDF. Effetto: il risultato è solo un PDF; l'app non invia nulla a una stampante. Se la pianificazione non è aggiornata, l'app calcola prima. Se il calcolo dà un errore, per esempio per un ciclo nelle relazioni, il pulsante non crea alcun file e mostra l'errore. Dove: *Rapporto*, in fondo alla colonna *Rapporto*.

**Ricordato.** L'app conserva tutte le opzioni del report su questo dispositivo, per tutti i tuoi progetti. Non fanno parte del file di progetto. Solo il campo *Azienda:* del diagramma di Gantt non viene conservato.

**Pianificazione attuale.** I report usano l'ultimo calcolo. Se la pianificazione è cambiata da allora, i report a tabella mostrano in alto *Il programma è cambiato dall'ultimo calcolo — premi Calcola (F5) per valori aggiornati.* Se non è mai stato calcolato nulla, compare *Non ancora calcolato — premi Calcola (F5) per date e slack.* Se il progetto è nella vista *Date come registrate*, i report mostrano le date del file di origine e una striscia lo segnala.

**Abbreviazioni.** *gl* sono i giorni lavorativi. *TF* è il margine totale, *FF* il margine libero.

## Carta e orientamento

**Carta:** — il formato carta del PDF. Scegli tra A4, A3, A2 e A1. Predefinito: A3. Effetto: le pagine sono impaginate per quel formato. C'è una sola scelta per tutti i report: ciò che scegli per un report vale anche per gli altri. In verticale su A4 una tabella larga diventa piccola, perché la tabella è scalata alla larghezza della pagina. Dove: *Impostazioni* (diagramma di Gantt e diagramma risorse) oppure *Opzioni del rapporto* (i sette report a tabella). Panoramica dei cardini e Scostamento non hanno opzioni.

**Orientamento:** — orizzontale o verticale. Scegli tra *Orizzontale* e *Verticale*. Predefinito: *Orizzontale*. Effetto: come *Carta:*. Dove: nello stesso punto di *Carta:*.

## Diagramma di Gantt

La pianificazione come grafico a barre, con una tabella a sinistra e un asse temporale a destra, su più pagine se serve. L'anteprima mostra la carta con intestazione di pagina, tabella, asse temporale e legenda. Il blocco *Riepilogo* conta *Attività:*, *Attività foglia:*, *Critiche:* e *Relazioni:*. Tutte le opzioni sono sotto *Impostazioni*.

**Azienda:** — l'azienda nell'intestazione di pagina. Predefinito: l'azienda presa dalle impostazioni progetto. Effetto: solo l'intestazione del report; ciò che scrivi qui non viene conservato. Cambia l'azienda in *Impostazioni › Progetto › Impostazioni progetto*, nel campo *Committente/organizzazione*, e conferma con *Applica*.

**Autore:** — l'autore nell'intestazione di pagina. Sola lettura: l'app lo prende dalle impostazioni progetto.

**Dimensione carattere:** — dimensione del testo e della tabella nel report. Scegli tra 90%, 100%, 110% e 125%. Predefinito: 100%. Effetto: con un carattere più grande, testo, righe e tabella crescono e l'asse temporale perde larghezza. Indipendente da *Dimensione testo* nelle impostazioni.

**Colori barre:** — da cosa dipende il colore di una barra. Scegli tra *Percorso critico*, *Per attività — automatico* e *Per categoria*, con un menu a discesa *Campo categoria* per *Per categoria*. Predefinito: *Percorso critico*. Effetto: è la stessa scelta di *Colori barre* nella scheda *Vista*: se la cambi qui, cambia anche il diagramma di Gantt a schermo. Se il campo scelto non esiste in questo progetto, compare *Questo campo non esiste in questo progetto. Viene usata temporaneamente la categoria di lavoro.*

**Linea di stato:** — una linea alla data di stato. Scegli tra *Nessuna*, *Linea data di stato* e *Linea di avanzamento*. Predefinito: *Nessuna*. Effetto: *Linea data di stato* disegna una linea alla data di stato; *Linea di avanzamento* disegna la linea a zigzag che sporge fino all'avanzamento di ogni attività. Se il progetto non ha una data di stato, compare *Imposta prima una data di stato* e il report non disegna nulla.

**Segui vista (filtro, raggruppamento, ordine)** — solo per il diagramma di Gantt. Predefinito: disattivato. Effetto: disattivato mette sulla carta tutto l'albero delle attività. Attivato disegna esattamente le righe a schermo: con il tuo filtro, raggruppamento, ordinamento e fasi chiuse.

**Adatta automaticamente alla pagina** — scala l'asse temporale alla larghezza della pagina. Predefinito: attivato. Effetto: attivato scala l'asse temporale alla larghezza della pagina; il numero di pagine dipende dall'altezza. Disattivato usa una scala fissa (*Zoom:*) e affianca le pagine anche in larghezza, il che genera rapidamente molte pagine.

**Zoom:** — la scala fissa dell'asse temporale. Visibile solo quando *Adatta automaticamente alla pagina* è disattivato. Cursore da 1 a 40. Predefinito: 22. Effetto: un valore più alto allarga l'asse temporale, quindi più pagine in larghezza.

**Asse temporale su:** — distribuisce l'asse temporale su più larghezze di pagina. Scelta da 1 a 8 pagine. Predefinito: 1 pagina. Effetto: solo con *Adatta automaticamente alla pagina*; altrimenti la scelta è disattivata e compare *Solo con adattamento automatico*. Utile per una pianificazione lunga che vuoi stampare in formato leggibile.

**Ripeti intestazione su ogni pagina** — Predefinito: attivato. Effetto: attivato mette l'intestazione di pagina su ogni pagina; disattivato solo sulla prima.

**Ripeti piè di pagina su ogni pagina** — Predefinito: attivato. Effetto: attivato mette il piè di pagina (nome progetto, data di stampa e legenda) su ogni pagina; disattivato solo sull'ultima. Un documento senza legenda non è leggibile, per questo è attivato.

**Nomi delle attività sulle barre** — Predefinito: attivato. Effetto: il nome dell'attività sulla barra, dove c'è spazio.

**Mostra completamento** — Predefinito: attivato. Effetto: la parte completata della barra diventa grigia, come nel diagramma di Gantt, e compare la colonna *Compl* nella tabella. Un'attività completata non mostra la striscia del margine.

**Tronca i nomi delle attività** — Predefinito: attivato. Effetto: attivato taglia i nomi nella tabella alla larghezza di *Colonna nome:*. Disattivato lascia crescere la colonna con il nome più lungo; compare *La colonna del nome si adatta al nome attività più lungo.*

**Colonna nome:** — la larghezza della colonna nome. Visibile solo quando *Tronca i nomi delle attività* è attivato. Cursore da 60 a 400. Predefinito: 130.

**Mostra sovrapposizione baseline** — la baseline attiva accanto alle barre. Predefinito: disattivato. Effetto: una barra sottile nel colore della baseline sotto la barra dell'attività, solo per le attività presenti nella baseline.

**Percorso critico** — Predefinito: attivato. Effetto: controlla solo le linee rosse delle relazioni tra due attività critiche e la riga nella legenda. Le barre stesse seguono *Colori barre:*, indipendentemente da questa casella.

**Mostra margine** — Predefinito: attivato. Effetto: il margine come striscia dietro le barre non critiche.

**Dipendenze** — le linee delle relazioni. Predefinito: attivato. Effetto: disegna frecce tra le barre.

**Mostra solo i giorni lavorativi** — comprime l'asse temporale in questo report. Predefinito: disattivato. Effetto: fine settimana e festività vengono saltati, e poi strisce settimanali sostituiscono l'ombreggiatura dei fine settimana. Indipendente dalla stessa impostazione per il diagramma di Gantt a schermo.

**Fine settimana** — Predefinito: attivato. Effetto: ombreggia fine settimana e festività nell'asse temporale, finché la scala rende distinguibili i giorni. Sull'asse compresso (*Mostra solo i giorni lavorativi*) questa casella non ha effetto.

**Legenda** — Predefinito: attivato. Effetto: la legenda nel piè di pagina.

**Qualità anteprima** — quanto è nitida l'anteprima. Scegli tra *Standard*, *Alta* e *Massima*. Predefinito: *Alta*. Effetto: solo la nitidezza dell'anteprima a schermo; il PDF non cambia. Dove: *Rapporto*, sopra l'anteprima.

## Diagramma risorse

Le stesse barre del diagramma di Gantt, raggruppate per risorsa: chi fa cosa e quando. Il blocco *Riepilogo* conta *Risorse:*, *Assegnazioni:* e *Senza risorsa:* (con un periodo anche *Fuori dal periodo:*). Il diagramma condivide tutte le opzioni del diagramma di Gantt, tranne *Segui vista (filtro, raggruppamento, ordine)*, *Percorso critico* e *Dipendenze*: le righe non vengono dallo schermo, un'attività può comparire con più risorse e le relazioni non vengono disegnate. La casella *Percorso critico* è nascosta e attiva. In più ci sono le opzioni del diagramma di Gantt in *Impostazioni*, con queste quattro caselle e il periodo:

**Ogni risorsa su una nuova pagina** — Predefinito: disattivato. Effetto: ogni risorsa inizia su una nuova pagina, così puoi distribuire un foglio per squadra o per dipendente. Disattivato dà un unico documento continuo.

**Includi attività senza risorsa** — Predefinito: disattivato. Effetto: le attività senza risorsa compaiono come ultima striscia nel diagramma, per vedere che cosa non ha ancora nessuno.

**Raggruppa per tipo di risorsa** — Predefinito: disattivato. Effetto: un livello in più in cima: prima una striscia per tipo di risorsa (manodopera, squadra, subappaltatore, attrezzatura, materiale), al suo interno per risorsa.

**Mostra unità/giorno e curva** — Predefinito: attivato. Effetto: due colonne dopo il nome attività con le unità al giorno e la curva di distribuzione della risorsa di quella striscia. Se c'è troppo poco spazio per l'asse temporale, il report omette le colonne e scrive *Le colonne Unità/g e Curva sono state omesse: …*; più spazio arriva da un formato carta più grande o dall'orizzontale, da una dimensione del carattere più piccola o da una tabella più stretta.

**Periodo del report:** — solo le attività che toccano il periodo. Predefinito: *Intero progetto*. Effetto: l'asse temporale va esattamente sul periodo. Se nel periodo non c'è nulla, compare *Nessuna attività nel periodo del report — scegli un altro periodo o Intero progetto.* Vedi sotto *Periodo del report*.

## Panoramica dei cardini

Tutti i cardini del progetto in una tabella. Nessuna opzione propria. Il blocco *Riepilogo* conta *Cardini*, *Obbligatorie* e *In ritardo*. Le colonne sono *WBS*, *Nome*, *Tipo* (*Automatico*, *Inizio* o *Fine*), *Data*, *Vincolo/scadenza*, *Margine*, *Obbligatoria* e *Stato*. Lo stato è *In ritardo* se il vincolo è violato, la scadenza è superata o il margine totale è negativo; altrimenti *Critico* se il cardine è critico secondo la definizione di criticità del progetto; altrimenti *Nei tempi*. Senza cardini compare *Nessuna attività cardine in questo progetto.* Il PDF usa il formato carta e l'orientamento che hai scelto per ultimo per un altro report.

## Scostamento

La pianificazione attuale accanto alla baseline attiva, per le attività foglia. Nessuna opzione propria. Il blocco *Riepilogo* conta *Attività*, *Più tardi* e *Più presto* e mostra *Fine progetto: +3 giorni lavorativi* (la differenza in giorni lavorativi tra la fine della baseline e la fine attuale). Le colonne sono *WBS*, *Nome*, *Inizio baseline*, *Fine baseline*, *Inizio attuale*, *Fine attuale*, *Δ inizio (gl)*, *Δ fine (gl)* e *Stato*. Lo stato segue la fine: *Più tardi* se la fine è più tarda rispetto alla baseline, *Più presto* se è più presto, altrimenti *Nei tempi*. *Nuova* è un'attività che non è nella baseline, *Eliminata* un'attività che è nella baseline ma non più nella pianificazione. Senza una baseline attiva compare *Nessuna baseline attiva — salva una baseline o impostane una come attiva.* Il PDF usa il formato carta e l'orientamento che hai scelto per ultimo per un altro report.

## Anteprima

Che cosa è in corso o inizia nel periodo: l'elenco per la riunione settimanale. Le opzioni sono sotto *Opzioni del rapporto*.

**Periodo del report:** — la finestra del report. Predefinito: *Prossimo mese*. Effetto: il report contiene le attività non completate che toccano il periodo, anche se coprono tutto il periodo, più le attività in ritardo di prima del giorno di riferimento, purché la fine del periodo non sia prima del giorno di riferimento.

**Quasi critico ≤ (gl):** — la soglia per *Quasi critico*. Numero da 0 a 60. Predefinito: 5. Effetto: un'attività con un margine totale superiore a 0 e non oltre quel numero di giorni lavorativi conta come quasi critica. Con 0 conta solo ciò che l'opzione di calcolo del progetto *Contrassegna quasi critico* segna.

Il blocco *Riepilogo* conta *Attività*, *In ritardo*, *In corso*, *Doveva iniziare*, *Inizia*, *Critico* e *Quasi critico*. Lo stato per riga, sempre in relazione al giorno di riferimento: *In ritardo* (non completata e la fine è prima del giorno di riferimento), *Doveva iniziare* (non iniziata mentre l'inizio era prima del giorno di riferimento), *In corso*, *Inizia* (non ancora iniziata, inizia nella finestra). Le colonne sono *WBS*, *Nome*, *Inizio*, *Fine*, *Rest. (gl)*, *Compl.*, *ST (gl)* (TF), *Critico*, *Risorse* e *Stato*.

## Critico e quasi critico

Le attività che determinano la fine del progetto e quelle quasi critiche. L'opzione è sotto *Opzioni del rapporto*.

**Quasi critico ≤ (gl):** — Predefinito: 5. Numero da 0 a 60. Effetto e significato come per Anteprima. Il sottotitolo indica la soglia scelta.

Il report contiene le attività non completate che sono critiche (secondo il risolutore e la definizione di criticità del progetto) o quasi critiche, ordinate per percorso di margine, poi per margine totale, poi per inizio. Il blocco *Riepilogo* conta *Critico*, *Quasi critico*, *Catene critiche* e *Attività foglia*. Le colonne sono *WBS*, *Nome*, *Inizio*, *Fine*, *Rest. (gl)*, *ST (gl)* (TF), *SL (gl)* (FF), *Percorso* e *Stato*. La colonna *Percorso* mostra il percorso di margine se l'opzione di calcolo *Percorsi di margine multipli* è attiva, altrimenti un trattino.

## Report di avanzamento

Dove si trova il progetto alla data di stato. Le opzioni sono sotto *Opzioni del rapporto*.

**Periodo del report:** — Predefinito: *Ultimo mese*. Effetto: *Completate nel periodo passato* conta nel periodo. *Iniziano nel prossimo periodo* guarda avanti dalla data di stato, fino a *Anteprima fino al*; con un periodo *Ultimo* guarda avanti tanto quanto il periodo guarda indietro.

**Quasi critico ≤ (gl):** — Predefinito: 5. Come per Anteprima.

Il blocco *Riepilogo* mostra *Data di stato*, *Periodo*, *Anteprima fino al*, *Fine baseline*, *Fine prevista*, *Δ fine (gl)*, *Pianificato* (con *(baseline)* o *(programma attuale)*), *Effettivo*, e i conteggi *Completata*, *In corso*, *Non iniziata*, *In ritardo* e *Critica*. Il valore pianificato e quello effettivo sono ponderati sulla durata delle attività. Il valore pianificato si misura rispetto alla baseline se c'è una baseline attiva, altrimenti rispetto alla pianificazione attuale. Le sezioni sono *Completate nel periodo passato*, *In corso*, *Iniziano nel prossimo periodo*, *In ritardo* e *Attività critiche aperte*; un'attività può stare in più di una sezione. Ogni sezione ha le stesse colonne: *WBS*, *Nome*, *Fine baseline*, *Fine prevista*, *Compl*, *Rest. (gl)*, *ST (gl)* (TF), *Critica* e *Stato*. Lo stato per riga è *Completata*, *In corso*, *Non iniziata*, *Doveva iniziare* o *Doveva finire*.

## Salute della pianificazione

Un controllo della pianificazione stessa su errori e valori insoliti, con in cima la valutazione DCMA a 14 punti. Le opzioni si trovano in *Opzioni del rapporto*.

**Slack elevato > (gl):** — Numero da 1 a 365. Predefinito: 44. Effetto: un'attività non completata con più margine totale di questo valore ricade sotto *Slack elevato*.

**Durata lunga > (gl):** — Numero da 1 a 365. Predefinito: 44. Effetto: un'attività non completata, non un cardine, con una durata più lunga ricade sotto *Durata lunga*.

**Ritardo > (gl):** — Numero da 0 a 365. Predefinito: 10. Effetto: una relazione con più ritardo ricade sotto *Ritardo lungo*. Un ritardo negativo (anticipo) viene sempre segnalato.

**Quasi critico ≤ (gl):** — Numero da 0 a 60. Predefinito: 5. Effetto: determina il controllo *Quasi critico*.

La sezione *Valutazione DCMA a 14 punti* viene per prima. Segue i quattordici controlli della US Defense Contract Management Agency, con le formule e le soglie del loro *Opuscolo di analisi del programma EVMS* (DCMA-EA PAM 200.1, ottobre 2012). Per ogni punto vedi *Numero*, *Su* (il totale sul quale si è contato), *Valore*, *Soglia*, *Risultato* e *Dettaglio*. Il risultato è *Conforme*, *Segnalato* o *n/a*; per n/a il motivo è nel dettaglio. Una segnalazione non è un errore: l'opuscolo la chiama un motivo per approfondire. Le soglie in *Opzioni del rapporto* non si applicano a questa sezione: usa sempre le soglie dell'opuscolo.

Conta le attività foglia non completate, senza cardini e hammock, e le relazioni verso queste attività. La nota sopra il report indica entrambi i numeri. I quattordici punti:

- *Logica*: attività senza predecessore o successore. Soglia: al massimo 5%.
- *Anticipi*: relazioni con un ritardo negativo. Soglia: nessuna.
- *Ritardi*: relazioni con un ritardo positivo, anche se breve. Soglia: al massimo 5%.
- *Tipi di relazione*: la quota di relazioni FS. Soglia: almeno 90%.
- *Vincoli rigidi*: attività con un vincolo obbligatorio oppure un MSO, MFO, SNLT o FNLT. Soglia: al massimo 5%.
- *Slack elevato*: attività con più di 44 giorni lavorativi di margine totale. Soglia: al massimo 5%. Richiede un calcolo.
- *Margine negativo*: attività con un margine totale sotto 0. Soglia: nessuna. Richiede un calcolo.
- *Durata elevata*: attività più lunghe di 44 giorni lavorativi. Conta la durata della baseline se l'attività è nella baseline attiva, altrimenti la durata attuale. Soglia: al massimo 5%.
- *Date non valide*: un inizio effettivo o una fine effettiva dopo la data di stato, oppure un inizio previsto o una fine prevista prima della data di stato. Soglia: nessuna. Richiede una data di stato.
- *Risorse*: attività senza risorsa. Soglia: nessuna. Solo se il progetto usa risorse; altrimenti n/a.
- *Attività mancate*: delle attività che la baseline indica come finite entro la data di stato, la quota che finisce più tardi o che è prevista più tardi. Soglia: al massimo 5%. Richiede una data di stato e una baseline attiva.
- *Test del percorso critico*: l'app allunga un'attività critica di 100 giorni lavorativi e ricalcola, su una copia, senza modificare il progetto. Il test è superato se l'ultima attività del progetto non finisce prima di quell'attività. Il test riguarda l'attività critica non completata con l'inizio più anticipato; il dettaglio indica il nome dell'attività e di quanti giorni lavorativi si è spostata la fine. Nella vista *Date come registrate* il test è n/a (*non calcolato*): il test calcola, e il report mostra allora le date del file di origine. Premi Calcola (F5) e il test viene eseguito di nuovo.
- *CPLI*: (lunghezza del percorso critico + margine) / lunghezza del percorso critico. La lunghezza conta i giorni lavorativi dalla data di stato alla fine dell'ultima attività; il margine è la differenza rispetto alla fine della baseline di quell'attività, oppure il margine calcolato se l'attività non è nella baseline. Soglia: almeno 0,95. Richiede una data di stato.
- *BEI*: il numero di attività completate alla data di stato, diviso per il numero che la baseline prevede completato entro quella data, più le attività senza baseline. Soglia: almeno 0,95. Richiede una data di stato e una baseline attiva.

Due punti differiscono dall'opuscolo, perché l'app non ha il concetto: *Durata elevata* conta ogni attività non completata, mentre l'opuscolo la limita al periodo di pianificazione dettagliato (rolling wave), e *Risorse* guarda solo alle risorse assegnate, non ai costi. L'opuscolo non dà un numero per il test del percorso critico; i 100 giorni lavorativi sono una scelta dell'app.

I controlli stanno in quest'ordine, con la loro gravità. Errore: *Margine negativo*, *Scadenza mancata*, *Vincolo violato* e *Avanzamento incoerente* (inizio effettivo o fine effettiva dopo la data di stato, inizio previsto o fine prevista prima della data di stato, 100% senza una fine effettiva, fine effettiva ma non 100%, avanzamento senza un inizio effettivo). Avviso: *Senza predecessore (inizio aperto)* e *Senza successore (fine aperta)* (non cardini), *Durata lunga*, *Anticipo (ritardo negativo)*, *Vincolo rigido* (un vincolo obbligatorio oppure un MSO, MFO, SNLT o FNLT), *Avanzamento fuori sequenza* e *Attività mancata (rispetto alla baseline)*. Informazione: *Quasi critico*, *Slack elevato*, *Ritardo lungo*, *Relazione diversa da FS* e *Senza risorsa* (solo se il progetto usa risorse). Il report controlla solo le attività foglia che non sono hammock. Il blocco *Riepilogo* conta *Segnalazioni DCMA*, *Errori*, *Avvisi*, *Informazioni*, *Attività foglia* e *Relazioni*; sotto la sezione DCMA ci sono una sezione *Panoramica* (per controllo la gravità e il numero) e una sezione *Rilievi* (ogni attività o relazione). Senza un calcolo mancano i controlli che richiedono il margine.

## Carico risorse

Per risorsa, per settimana o per mese, si confronta quanto è richiesto con quanto è disponibile. Le opzioni si trovano in *Opzioni del rapporto*.

**Periodo del report:** — Predefinito: *Intero progetto*. Effetto: ogni settimana o mese che tocca il periodo è incluso per intero. Così una riga mostra lo stesso numero dell'istogramma.

**Aggregazione:** — Scegli tra *Settimanale* e *Mensile*. Predefinito: *Settimanale*. Effetto: una riga per settimana di calendario (colonna *Settimana del*, con il lunedì) o per mese di calendario (colonna *Mese*).

**Solo periodi sovraccarichi** — Predefinito: disattivato. Effetto: attivato mostra solo le settimane o i mesi con almeno un giorno sovrassegnato.

Le colonne sono *Risorsa*, *Tipo*, *Settimana del* o *Mese*, *Richiesto*, *Disponibile*, *Variance* (disponibile meno richiesto; un valore negativo indica una carenza), *Picco/giorno* e *Sovraccarico*. *Richiesto* è la somma delle unità-giorno. Vi compaiono solo settimane o mesi con un fabbisogno. Il blocco *Riepilogo* conta *Risorse*, *Settimane* o *Mesi*, *Settimane sovraccariche* o *Mesi sovraccarichi* e *Risorse sovraccariche*.

## Assegnazioni risorse

Per risorsa, le attività a cui è collegata: che cosa sta facendo questa squadra o questa gru? Le opzioni si trovano in *Opzioni del rapporto*.

**Periodo del report:** — Predefinito: *Intero progetto*. Effetto: con un periodo sono incluse solo le assegnazioni delle attività che toccano il periodo, più il lavoro scaduto da prima del giorno di riferimento. *Intero progetto* non filtra per data.

**Includi attività completate** — Predefinito: disattivato. Effetto: attivato include anche le assegnazioni delle attività completate.

Le righe sono per risorsa e, dentro una risorsa, per inizio. Il blocco *Riepilogo* conta *Risorse*, *Assegnazioni* e *Attività senza risorsa*. Le colonne sono *Risorsa*, *Tipo*, *WBS*, *Nome*, *Inizio*, *Fine*, *Rest. (gl)*, *Unità/giorno*, *Avanz*, *Critica* e *Stato*. *Risorsa* e *Tipo* compaiono solo sulla prima riga di una risorsa. Lo stato per riga è lo stesso del report di avanzamento: *Completata*, *In corso*, *Non iniziata*, *Doveva iniziare* o *Doveva finire*.

## Riepilogo WBS

La pianificazione riepilogata per elemento WBS: la panoramica di gestione. Le opzioni si trovano in *Opzioni del rapporto*.

**Livello:** — fino a quale livello viene mostrata la WBS. Scegli tra *WBS completa* e i livelli da 1 a 8. Predefinito: livello 2. Effetto: il sottotitolo dice *Fino al livello 2*.

**Mostra attività** — Predefinito: disattivato. Effetto: attivato mostra anche le attività foglia stesse sotto ogni elemento.

Le colonne comprendono *WBS*, *Nome*, *Inizio*, *Fine*, *Inizio baseline*, *Fine baseline*, *Durata (gl)*, *Avanz*, *Δ fine (gl)*, *ST min*, *Att* (numero di attività), *Crit*, *Attivo* e *Fatto*. Inizio e fine di un'attività di riepilogo vengono dall'ultimo calcolo. L'avanzamento è ponderato per durata sulle attività foglia. *ST min* (TF) e i conteggi riguardano le attività foglia sottostanti. Il blocco *Riepilogo* conta *Elementi WBS* e *Attività*.

## Periodo del report

Quattro report tabellari e il diagramma delle risorse usano un *Periodo del report:*: *Previsione (look-ahead)*, *Rapporto di avanzamento*, *Carico risorse*, *Assegnazioni risorse* e *Diagramma delle risorse*. Ogni report ricorda il proprio periodo. Sotto il menu a discesa ci sono *Da* e *A*, con le date che produce la scelta.

**Giorno di riferimento.** Un periodo con *Avanti* o *Ultima* si conta dalla data di stato del progetto, oppure da oggi se non c'è una data di stato. Allora i report tabellari mostrano *Nessuna data di stato impostata — il rapporto usa oggi (…).* Se sposti la data di stato, la finestra si sposta con lei. Entrambi i giorni sono inclusi.

**Prossima settimana, Prossime 2 settimane, Prossime 4 settimane, Prossime 6 settimane, Prossime 8 settimane, Prossime 12 settimane** — a partire dal giorno di riferimento, di 7 giorni per settimana. Con data di stato giovedì 20 maggio, *Prossima settimana* va dal 20 al 26 maggio e *Prossime 4 settimane* dal 20 maggio al 16 giugno.

**Ultima settimana, Ultime 2 settimane, Ultime 4 settimane, Ultime 6 settimane, Ultime 8 settimane, Ultime 12 settimane** — le stesse sei, ma contate all'indietro: di 7 giorni per settimana, fino al giorno di riferimento. *Ultime 2 settimane* va dal 7 al 20 maggio, con 20 maggio come giorno di riferimento.

**Prossimo mese, Ultimo mese** — un mese di calendario in avanti o indietro, fino a un giorno prima della stessa data nell'altro mese. *Prossimo mese* va fino al 19 giugno, partendo dal 20 maggio; *Ultimo mese* va dal 21 aprile al 20 maggio.

**Intero progetto** — dal primo inizio all'ultima fine della pianificazione.

**Personalizzato** — un periodo tuo. Effetto: *Da* e *A* diventano due campi data. Partono dalle date della scelta che hai appena fatto. La data di fine non può essere precedente alla data di inizio (*La data di fine è precedente alla data di inizio.*) e entrambi i campi devono essere compilati (*Inserisci entrambe le date.*). Se i dati inseriti non sono corretti, il report resta sull'ultimo periodo valido.

## Vedi anche

- [Creare e stampare un report](docs://howto-rapport-maken-en-afdrukken): tutto il percorso dal tipo di report al PDF.
- [Scegliere il periodo del report](docs://howto-rapportageperiode-kiezen): passi ed esempi.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): che cosa significano critico e quasi critico.
- [Avanzamento, data di stato e baseline](docs://uitleg-voortgang): la data di stato e la baseline con cui lavorano i report.
- [Risolvere le risorse sovrassegnate](docs://howto-overbezetting-oplossen): che cosa fare con le settimane sovraccariche di Carico risorse.
- [Formati di importazione ed esportazione](docs://ref-import-exportformaten): il PDF accanto agli altri formati.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): due baseline con avanzamento e una data di stato, per guardare il rapporto variance.
