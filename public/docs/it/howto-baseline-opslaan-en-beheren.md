# Salvare e gestire una baseline

Obiettivo: registrare la pianificazione come accordo (una baseline), così puoi vedere in seguito quanto l'esecuzione si discosta, e conservare, rinominare, scegliere ed eliminare più baseline.

## Quando ti serve questo

Registri una baseline quando la pianificazione è stata approvata e il lavoro deve ancora iniziare. Se la pianificazione viene rivista formalmente in seguito, per esempio dopo un ordine di variazione, salvi una seconda baseline e conservi la prima. Così misuri l'esecuzione rispetto al primo accordo e rispetto a quello rivisto. Che cosa registra esattamente una baseline e come l'app calcola lo scostamento è spiegato in [Avanzamento, data di stato e baseline](docs://uitleg-voortgang).

## Passaggi

### Salvare una baseline

1. Premi **Calcola** (F5), per esempio tramite *Pianificazione › Pianificazione › Calcola*. La baseline registra le date calcolate in quel momento.
2. Scegli *Pianificazione › Baseline e progresso › Gestisci baseline…*. Si apre la finestra *Baseline*.
3. Sotto *Salva nuova baseline* c'è un nome suggerito, per esempio *Baseline 1 — (data di oggi)*. Scrivi un nome tuo che riconoscerai più tardi, per esempio *Baseline*.
4. Clicca su *Salva*. La baseline è ora nell'elenco e diventa subito la baseline attiva.
5. Clicca su *Chiudi*.

Sotto ogni barra attività nel Gantt c'è ora una barra sottile con le date della baseline; un cardine riceve un piccolo rombo. Attivi o disattivi quella sovrapposizione con *Vista › Baseline e progresso › Sovrapposizione della baseline*.

### Scegliere la baseline attiva

Apri *Gestisci baseline…* e scegli nella colonna *Attivo* la baseline con cui vuoi confrontare. Finché ci sono baseline, ne è attiva esattamente una. La sovrapposizione nel Gantt, il tipo di report *Variance* e il *Rapporto di avanzamento* la usano.

### Rinominare una baseline

Cambia il nome nell'elenco. La modifica è subito effettiva; non devi cliccare su *Salva*.

### Eliminare una baseline

Clicca sul piccolo cestino accanto alla baseline nell'elenco. Se elimini la baseline attiva, l'app chiede *Eliminare la baseline attiva?*. Poi la baseline rimasta più recente diventa quella attiva. Se non ce n'è un'altra, non c'è più una baseline attiva e la sovrapposizione scompare. Con Ctrl+Z riporti una baseline eliminata. Chiudi prima la finestra: Ctrl+Z non funziona dentro una finestra.

### Scostamenti nella tabella attività

Ogni baseline ha sei colonne nella tabella attività. Clicca sul **+** a destra dell'intestazione della tabella attività (*Aggiungi colonna*) e apri la categoria *Baseline*. Per ogni baseline ci sono *Inizio pianificato*, *Fine pianificata*, *Durata*, *Scostamento inizio*, *Scostamento fine* e *Scostamento durata*, con il nome della baseline davanti, per esempio *Baseline — Scostamento fine*. Gli scostamenti sono in giorni lavorativi: un più significa più tardi, un meno significa più presto. Un'attività che non è nella baseline mostra un trattino (—) in quelle colonne.

## Problemi frequenti e cosa fa l'app

**Una pianificazione non aggiornata.** Se la pianificazione non è aggiornata, la finestra dice *La pianificazione non è aggiornata — ricalcola prima (F5)*. È un avviso; salvare resta possibile. Ma così salvi le vecchie date. Chiudi la finestra, premi **Calcola** e solo poi salva.

**Una baseline con avanzamento.** Se salvi una baseline dopo aver inserito l'avanzamento, registra lo stato con quelle date effettive. Lo scostamento è allora zero e non dice più nulla sull'esecuzione. Registra la baseline prima che il lavoro inizi.

**Una baseline non si può aggiornare.** Se vuoi rivedere l'accordo, salva una nuova baseline ed elimina quella vecchia, se serve.

**Un ⚠ in Durata o Scostamento durata.** Per un'attività in ore, un giorno corrisponde agli orari di lavoro del suo calendario. Se il calendario ha un proprio numero di ore al giorno (per esempio 8 con fasce da 10 ore, da Primavera P6), una versione precedente dell'app contava i giorni in modo diverso. Una baseline di quella versione conserva il vecchio numero: un'attività di 1870 ore è 233,75 giorni nella baseline e 187 giorni ora. L'app non converte una baseline così. Le colonne *Durata* e *Scostamento durata* di quella baseline mostrano allora un ⚠; passaci sopra con il puntatore per la spiegazione. Le date della baseline sono corrette. Salva una nuova baseline ed elimina quella vecchia, se serve.

**Solo attività senza sottoattività.** Una fase non è nella baseline: non ha una barra baseline né uno scostamento. La fase deriva dalle attività che contiene.

**Attività nuove ed eliminate.** Un'attività che aggiungi dopo il salvataggio non ha una barra baseline. Nel rapporto variance appare come *Nuova*. Un'attività che elimini appare come *Eliminata*.

**Sposta progetto.** Nella finestra *Sposta progetto…*, appena ci sono baseline, c'è la casella *Sposta anche le baseline*. Per impostazione predefinita è disattivata: le baseline restano dove sono, così lo spostamento appare come scostamento. Vedi [Spostare un progetto](docs://howto-project-verplaatsen).

**Memorizzato nel file di progetto.** Le baseline e la scelta della baseline attiva sono salvate con il progetto e tornano quando apri il file.

## Vedi anche

- [Avanzamento, data di stato e baseline](docs://uitleg-voortgang): cosa registra una baseline e come si calcola lo scostamento.
- [Spostare un progetto](docs://howto-project-verplaatsen): la casella *Sposta anche le baseline*.
- [Aggiornare l'avanzamento](docs://howto-voortgang-bijwerken): inserire lo stato effettivo con cui confronti la baseline.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): una baseline (*Baseline at start*) prima dell'inizio, con avanzamento e una data di stato del 20 maggio 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): due baseline, *Contract* e *Re-baseline (variation order)*, con avanzamento e una data di stato del 5 luglio 2027.
