# Baseline e avanzamento

Una pianificazione che non aggiorni mai è una previsione. Una volta iniziato il lavoro, vuoi vedere due cose contemporaneamente: cosa era stato originariamente concordato, e cosa sta effettivamente succedendo ora. Una **baseline** congela la prima; il **progresso** e la **data di stato** tracciano la seconda. Questa guida mostra come salvare e gestire una baseline, come rendere visibile la variance, come inserire il progresso, ed esattamente cosa fa la data di stato alla tua pianificazione.

## Cosa imparerai qui

- Salvare e gestire una baseline, e quale baseline è attiva.
- Vedere la variance: la sovrapposizione della baseline nel Gantt e il rapporto Variance.
- Inserire il progresso — percentuale, date effettive — tramite il pannello, la finestra di dialogo attività e il menu contestuale.
- La data di stato: cosa fa alle attività non ancora iniziate e ai traguardi non contrassegnati.
- Avvisi fuori sequenza: cosa significano e come risolverli.
- Leggere la linea di avanzamento.

Segui con [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (una baseline prima dell'inizio, più progresso e una data di stato a metà del progetto) e con [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (due baseline — una baseline contrattuale e una ri-baseline dopo un ordine di modifica — con il proprio progresso e la propria data di stato).

## Salvare e gestire una baseline

Apri la finestra **Baseline** tramite il gruppo della barra multifunzione **Baseline e progresso** sulla scheda **Pianificazione**: **Salva nuova baseline** salva immediatamente una nuova baseline con un nome suggerito ("Baseline 1 — [data]"), **Gestisci baseline…** apre la stessa finestra per rivedere, rinominare o eliminare.

La finestra mostra una tabella con ogni baseline salvata: un pulsante di opzione **Attiva**, il **Nome** (modificabile direttamente), la data **Creata** e un pulsante di eliminazione. Può essere attiva esattamente una baseline alla volta — è quella con cui si confrontano la sovrapposizione del Gantt e il rapporto Variance. Eliminare la baseline attiva chiede conferma (nessuna baseline resta attiva in seguito finché non ne scegli un'altra o ne salvi una nuova). Se la pianificazione non è aggiornata dall'ultimo calcolo, la finestra mostra un suggerimento accanto a "Salva nuova baseline" per ricalcolare prima — una baseline salvata su una pianificazione non aggiornata congelerebbe le date sbagliate.

Una baseline è un'istantanea: l'inizio, la fine e (per i traguardi) la data di ogni attività al momento in cui l'hai salvata. Cambia ulteriormente la pianificazione in seguito e la baseline resta invariata finché non ne salvi una nuova tu stesso.

## Vedere la variance

### Nel Gantt: la sovrapposizione della baseline

Attiva la sovrapposizione tramite **Vista → gruppo della barra multifunzione Baseline e progresso → Sovrapposizione della baseline**. Sotto ogni barra dell'attività appare una sottile sotto-barra (o un rombo per un traguardo), nel colore della baseline, alle date originali della baseline. Se la barra principale supera la sua sotto-barra, puoi vedere a colpo d'occhio quanto un'attività è slittata rispetto alla baseline — senza aprire un rapporto separato.

### Come rapporto: il rapporto Variance

Vai alla scheda **Rapporto**, scegli **Variance** per **Tipo di report**. Il rapporto mostra, per attività: **Inizio baseline**, **Fine baseline**, **Inizio attuale**, **Fine attuale**, **Δ inizio (gl)**, **Δ fine (gl)** e uno **Stato** (**Nei tempi**, **Più tardi**, **Più presto**, **Nuova** per le attività aggiunte dopo la baseline, oppure **Eliminata** per le attività rimosse da allora). In alto il rapporto totalizza il numero di attività, quante sono più tardi e quante più presto, e — se la data di fine progetto è slittata — una riga con il numero di giorni lavorativi di differenza rispetto alla baseline. Se non c'è una baseline attiva, il rapporto lo dichiara esplicitamente invece di mostrare una tabella vuota.

## Inserire il progresso

Imposti il progresso in tre posti, tutti con lo stesso effetto:

1. **Pannello delle proprietà** — la sezione **Progresso** sotto un'attività selezionata: un cursore per la **percentuale di completamento**, e (per un'attività normale) i campi **Inizio effettivo**/**Fine effettiva**, oppure (per un traguardo) un unico campo **Data effettiva**. Spingi la percentuale sopra lo 0% senza una data di inizio effettiva, e viene compilata automaticamente con l'inizio anticipato pianificato; riportala sotto il 100% e qualsiasi fine effettiva inserita viene di nuovo cancellata.
2. **Finestra di dialogo attività** — la stessa sezione **Progresso**, nella finestra **Modifica attività**.
3. **Menu contestuale** — clic destro su un'attività, sottomenu **Avanzamento**, con i passi fissi **0%**, **25%**, **50%**, **75%** e **100%**. Comodo per un aggiornamento rapido senza aprire un pannello; per una percentuale intermedia o una data effettiva specifica usa il pannello o la finestra di dialogo attività.

Le date effettive non possono mai essere successive alla data di stato — prova a inserirne una successiva e l'app la rifiuta con un errore. Questo è un limite deliberato: un "fatto" (qualcosa che è effettivamente successo) non può, per definizione, trovarsi nel futuro rispetto al momento in cui stai registrando il progresso.

## La data di stato

La **data di stato** (gruppo della barra multifunzione **Baseline e progresso** sulla scheda Pianificazione, campo **Data di stato**) segna "oggi" all'interno della pianificazione — il momento a cui hai registrato il progresso. Una volta impostata, fa due cose contemporaneamente:

- Qualsiasi attività o traguardo non ancora iniziato (0% completato, nessun inizio effettivo) non può iniziare prima della data di stato, anche se la logica (predecessori, relazioni) altrimenti permetterebbe un inizio anticipato. Il suo inizio anticipato calcolato viene "portato" alla data di stato.
- Le attività già iniziate o terminate mantengono le loro date effettive — quelle non vengono mai sovrascritte dalla data di stato.

Puoi vederlo esattamente nell'esempio di dimensioni medie: con la data di stato impostata al 20 maggio 2027, diverse attività non ancora iniziate (ad esempio la muratura e l'impiantistica idraulica su case diverse) hanno il loro inizio anticipato fissato esattamente su quella data, anche se procedono in case diverse e avrebbero, senza il limite della data di stato, iniziato in date diverse e più anticipate.

### Perché un traguardo non contrassegnato "si sposta a destra"

Nel calcolo un traguardo non è altro che un'attività a durata zero, quindi si applica la stessa regola: se non è ancora stato contrassegnato come completato (nessun 100%, nessuna data effettiva), la sua data calcolata non può cadere prima della data di stato. Continua a spingere in avanti la data di stato senza contrassegnare il traguardo come completato, e la sua data visualizzata nel Gantt continua a spostarsi a destra insieme a essa, anche se non è cambiato nulla nelle attività sottostanti — la pianificazione sta effettivamente dicendo "questo momento non può trovarsi nel passato se non l'hai ancora spuntato." Una volta che contrassegni il traguardo come completato con una data effettiva, scatta indietro a quella data fissa e smette di spostarsi.

## Avvisi fuori sequenza

Una volta impostata una data di stato, il calcolo verifica anche se i fatti registrati (date effettive di inizio/fine) non contraddicono la logica delle relazioni — ad esempio un successore già iniziato mentre il suo predecessore, secondo la pianificazione, non dovrebbe ancora essere terminato. Questi casi sono chiamati **fuori sequenza** e compaiono come avviso nella barra di stato in fondo allo schermo ("N relazione/i fuori sequenza"), con un tooltip per il conteggio. È un avviso, non un errore bloccante — il calcolo prosegue comunque.

Risolvi un avviso fuori sequenza registrando accuratamente la situazione effettiva: compila la data effettiva di inizio/fine mancante o errata sulle attività coinvolte (tramite il pannello, la finestra di dialogo attività o il menu contestuale, come sopra), così i fatti registrati tornano ad allinearsi con ciò che logicamente doveva precederli. Spesso questo significa semplicemente: un'attività che nella realtà è già terminata non era ancora stata contrassegnata come tale nella pianificazione.

## La linea di avanzamento

Attiva la linea di avanzamento tramite **Vista → gruppo della barra multifunzione Baseline e progresso → Linea di avanzamento**. Disegna una linea tratteggiata arancione (4/4 trattini, stesso stile della linea della data di stato) che traccia, per ogni attività, un punto nella posizione corrispondente alla sua percentuale di completamento, e lo collega alla data di stato — il classico schema a zigzag. Una piegatura a sinistra della data di stato significa che un'attività è indietro rispetto a quanto ci si aspetterebbe in base al tempo trascorso; una piegatura a destra significa che è in anticipo. La linea di avanzamento disegna già essa stessa la verticale della data di stato come spina dorsale dello zigzag, quindi l'interruttore separato **Linea della data di stato** (stesso gruppo della barra multifunzione) passa in secondo piano mentre la linea di avanzamento è attiva — torna visibile solo quando disattivi la linea di avanzamento e vuoi comunque che la data di stato sia mostrata come semplice linea verticale.

## Continua a leggere

- Vedi una baseline prima dell'inizio e il progresso a metà percorso in pratica: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Vedi due baseline (Contratto → ri-baseline dopo un ordine di modifica) in pratica: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Le risorse e il loro carico vengono anch'essi ricalcolati a ogni F5 — leggi la guida [Risorse, istogramma e livellamento](docs://gids-resources-histogram) per la sovrallocazione e il livellamento.
- Il progresso e una data di stato possono produrre margine negativo su un'attività già fissata — leggi la guida [Percorso critico e analisi avanzata](docs://gids-kritiek-pad-analyse) per capire come leggerlo.
