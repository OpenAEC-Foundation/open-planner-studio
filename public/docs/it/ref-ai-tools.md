# Strumenti IA (planner_*)

Tutti gli strumenti che un assistente IA può richiamare tramite il bridge, per gruppo, con ciò che fanno e ciò che rifiutano. Tutti iniziano con `planner_`. Il messaggio di connessione nella finestra *Dettagli di connessione* indica il numero attuale. L'assistente riceve l'elenco completo, con le descrizioni, direttamente dal bridge (`tools/list`). Il perché del collegamento è spiegato in [Come funziona il collegamento IA](docs://uitleg-ai-koppeling). Come lo attivi è spiegato in [Collegare un assistente IA (MCP)](docs://howto-ai-assistent-koppelen).

## Come leggere questo elenco

**Lettura** significa: lo strumento non modifica nulla. Questo funziona anche durante *Pausa* e *Sola lettura*. Una finestra di dialogo aperta, però, lo blocca (vedi *Quando uno strumento viene rifiutato* più sotto). Uno strumento di lettura dà sempre date aggiornate. Se la pianificazione non è aggiornata, lo strumento la ricalcola prima, anche durante *Pausa* e *Sola lettura*. Quelle modalità bloccano le modifiche, non il ricalcolo in lettura. Se sei nel mezzo di una modifica (trascini una barra, scrivi in un campo), lo strumento non ricalcola. L'assistente riceve allora le date di prima della tua modifica, con un avviso che sono obsolete. Se il progetto è nella vista *Date registrate*, lo strumento non ricalcola. L'assistente riceve allora le date registrate, con un avviso che non sono state ricalcolate.

**Modifica** significa: lo strumento cambia il tuo progetto. Viene rifiutato durante *Pausa*, durante *Sola lettura* e quando una finestra di dialogo è aperta. Questo vale anche per gli strumenti senza etichetta qui sotto (`planner_undo`, `planner_redo`, gli strumenti per i file e gli strumenti per i documenti, tranne `planner_list_documents`). Ogni modifica è un passo nella tua cronologia di annullamento. Se cambiano dati del progetto, l'app ricalcola da sola la pianificazione. Non devi premere *Calcola*. Prima della prima modifica per documento, l'app scrive un backup, se *Backup automatico* è attivo.

**In blocco** significa: una chiamata può contenere più elementi. Un elemento non valido viene rifiutato con un motivo. Gli elementi validi restano. La risposta indica quali elementi sono stati rifiutati.

## Lettura: pianificazione

- `planner_get_project_info` (lettura) — dettagli del progetto e cifre principali: il numero di attività, relazioni, risorse e cardini, la data di stato, la fine e la durata del progetto, se la pianificazione non è aggiornata, il profilo di calcolo e un riepilogo dei calendari. Una buona prima chiamata.
- `planner_get_project_overview` (lettura) — l'intero albero WBS in una sola risposta: per id di attività, WBS, nome, durata, date anticipate, avanzamento, se è critica, e le relazioni in uscita con il rispettivo id di relazione.
- `planner_list_tasks` (lettura) — attività con filtri (critiche, stato, finestra di date, attività senza relazioni) e paginazione.
- `planner_get_task` (lettura) — un'attività in dettaglio: date, margine, avanzamento, vincoli, scadenza, calendario, assegnazioni, predecessori e successori, interruzioni.
- `planner_get_critical_path` (lettura) — le attività critiche con il loro margine totale, e le relazioni che guidano il percorso critico.
- `planner_list_resources` (lettura) — risorse con capacità, tariffa, calendario, squadra, disponibilità e un riepilogo delle loro assegnazioni. Se una risorsa viene da una libreria di risorse, mostra quali campi sono fissi.
- `planner_get_resource_histogram` (lettura) — carico rispetto alla capacità per risorsa, per giorno, settimana o mese (predefinito: settimana). Senza finestra e senza risorse dà un riepilogo per risorsa. Con una finestra o con risorse dà la serie completa e le attività che causano sovrassegnazione.
- `planner_get_calendars` (lettura) — tutti i calendari con la definizione completa e quante attività e risorse li usano.

## Lettura: baseline e scostamento

- `planner_list_baselines` (lettura) — le baseline salvate e quale è attiva.
- `planner_compare_baseline` (lettura) — la pianificazione attuale rispetto alla baseline attiva: solo le attività che differiscono e la differenza nella fine del progetto, in giorni lavorativi sul calendario di progetto attuale. Senza baseline attiva viene rifiutato.
- `planner_analyze_delay` (lettura) — analisi del ritardo rispetto alla baseline attiva: la differenza nella consegna e le attività critiche che si sono spostate. Senza baseline attiva viene rifiutato.

## Attività e struttura

- `planner_add_tasks` (modifica, in blocco) — crea attività, inclusa una WBS annidata in una sola chiamata. Ogni attività riceve un nome temporaneo (`tmp-…`), così un'attività figlia può far riferimento al suo genitore. Senza durata un'attività riceve 5 giorni lavorativi. Un cardine ha durata 0. Tutte le attività di una chiamata riescono insieme o falliscono insieme.
- `planner_update_tasks` (modifica, in blocco) — cambia i campi di attività esistenti: nome, descrizione, durata con unità (giorni o ore), tipo di durata, categoria di lavoro, cardine, obbligatoria, priorità, vincolo, scadenza, calendario e tipo di attività. Inoltre c'è un percorso per l'avanzamento: percentuale di avanzamento, inizio effettivo e fine effettiva. Ogni altra chiave viene rifiutata con un motivo.
- `planner_delete_tasks` (modifica) — elimina attività, inclusa tutta la loro sottostruttura, relazioni e assegnazioni. La risposta indica esattamente che cosa è stato eliminato insieme a loro.
- `planner_move_task` (modifica) — sposta un'attività sotto un altro genitore, con una posizione. Un riferimento circolare, o un'attività messa sotto sé stessa, viene rifiutato.
- `planner_set_task_splits` (modifica) — imposta le interruzioni di un'attività: dopo quanti giorni lavorativi (o ore lavorative) di lavoro, e quanti giorni lavorativi (o ore lavorative) di interruzione. Una lista vuota elimina tutte le interruzioni. Vedi [Dividere un'attività](docs://howto-taak-splitsen).

## Relazioni

- `planner_add_dependencies` (modifica, in blocco) — crea relazioni con un tipo (`FS`, `SS`, `FF`, `SF` o la forma lunga) e un ritardo, per esempio `+2d`.
- `planner_update_dependencies` (modifica, in blocco) — cambia il tipo, il ritardo, il predecessore o il successore di una relazione esistente, tramite l'id della relazione. È un solo passo, invece di eliminarla e ricrearla.
- `planner_remove_dependencies` (modifica, in blocco) — elimina relazioni tramite l'id della relazione.

## Progetto e calendari

- `planner_update_project` (modifica) — nome, descrizione, autore, azienda, data di inizio, data di fine, data di stato, modalità di progresso e il valore predefinito del progetto per il tipo di attività. La data di inizio è il punto di ancoraggio per le nuove attività. Se l'assistente la imposta più tardi, si spostano solo le attività libere (senza predecessore e senza un vincolo che fissa un limite inferiore, come *iniziare non prima del (SNET)*). La risposta riporta quante sono, come `anchorsClamped`. Il resto della pianificazione resta dov'è. Vedi [Nuovo progetto e Info progetto](docs://ref-projectinfo). La data di stato non è un'etichetta, ma la data di riferimento del calcolo: su una pianificazione senza avanzamento, tutto si sposta insieme. La data di fine è solo un metadato.
- `planner_move_project` (modifica) — sposta tutta la pianificazione esistente a una nuova data di inizio. I calendari non si spostano con essa, quindi la fine può saltare di un numero di giorni diverso da quello dell'inizio. Le baseline restano, a meno che l'assistente non le sposti esplicitamente anche. Vedi [Spostare un progetto](docs://howto-project-verplaatsen).
- `planner_update_calendar` (modifica, in blocco) — cambia o crea calendari: giorni lavorativi, orari di lavoro, pausa, fasce orarie, festività (genera per un paese e una regione, oppure indicale una per una) ed eccezioni di lavoro. Non può cambiare quale calendario è il calendario di progetto.

## Risorse e unità

- `planner_manage_resources` (modifica, in blocco) — crea, cambia o elimina risorse: nome, tipo (manodopera, attrezzatura, materiale, subappaltatore o squadra), descrizione, unità max., costo all'ora, unità, calendario, squadra e disponibilità nel tempo. Rifiuta di eliminare una risorsa che ha assegnazioni, finché l'assistente non lo conferma esplicitamente. Per una risorsa da una libreria di risorse sono fissi nome, tipo, descrizione, tariffa oraria e unità.
- `planner_manage_assignments` (modifica, in blocco) — aggiungi, cambia, sposta o rimuovi assegnazioni: unità per giorno lavorativo, curva e lavoro rimanente. Solo su un'attività foglia, e la stessa risorsa solo una volta per attività. Che cosa fa una modifica delle unità alla durata dipende dal tipo di attività, come in [Tipi di attività: durata, unità e lavoro](docs://uitleg-werkregels).
- `planner_level_resources` (modifica) — livella le sovrassegnazioni. Per impostazione predefinita entro il margine, così la data di fine resta; con `constrainToFloat: false` la fine può spostarsi. Con una simulazione l'assistente riceve prima un'anteprima, senza modificare nulla. Salta i materiali. Vedi [Livellamento delle risorse](docs://uitleg-nivelleren).
- `planner_clear_leveling` (modifica) — cancella tutti i ritardi di livellamento.

## Gestione delle baseline

- `planner_save_baseline` (modifica) — salva la pianificazione attuale come baseline e la rende subito attiva. Prima ricalcola le date non aggiornate. Non si può usare in uno script.
- `planner_activate_baseline` (modifica) — rende attiva una baseline, oppure nessuna.
- `planner_rename_baseline` (modifica) — rinomina una baseline.
- `planner_delete_baseline` (modifica) — elimina una baseline. Se era quella attiva, diventa attiva l'ultima baseline rimasta, oppure nessuna se non ne resta nessuna.

## Annullare

- `planner_undo` e `planner_redo` — annulla o ripristina un passo nel documento attivo. La cronologia è la stessa della tua. La risposta indica se è stato davvero annullato qualcosa.

## Documenti e file

- `planner_list_documents` (lettura) — tutti i documenti aperti, con titolo, se sono attivi e se sono modificati, il numero di attività, la data di inizio del progetto e la fine calcolata.
- `planner_new_document` — un nuovo documento vuoto in una propria scheda, senza la finestra *Nuovo progetto*.
- `planner_duplicate_document` — copia il documento attivo in una nuova scheda, per una simulazione o una variante di gara. La copia è staccata e non ha un percorso di file.
- `planner_switch_document` — rende attivo un altro documento. È anche il modo per confermare, dopo aver cambiato scheda, su quale documento lavora l'assistente.
- `planner_import_schedule` — apre un file di pianificazione dal disco come documento: `.ifc`, `.xml` (Primavera P6 o MS Project, riconosciuto dal contenuto), `.csv`, `.xer` e `.mpp` (da MS Project 2010 fino a 2021). Niente viene unito al piano attuale. Un CSV non ha calendario, quindi le date possono spostarsi. Solo nella tua cartella utente. Dopo un import di CSV, XML o `.mpp` il documento non ha una destinazione di salvataggio. Solo un IFC ne assume il percorso.
- `planner_export_ifc` — scrive il documento attivo come file IFC, nello schema IFC del progetto (predefinito IFC 4.3 ADD2). Solo nella tua cartella utente, e un file esistente viene sovrascritto solo su richiesta esplicita. Se il documento è stato aperto in uno schema che l'app non sa scrivere (come IFC2X3), lo strumento rifiuta di scrivere su quel file. Il progetto resta non salvato.

## Guida e provenienza delle fonti

- `planner_get_planning_guide` (lettura) — la guida in inglese per assistenti (i principi di [Pianificare bene](docs://gids-goed-plannen), con gli strumenti per ogni principio), le due skill *goed-plannen* (impostare una pianificazione) e *progress-update* (aggiornare l'avanzamento), oppure tutto. Scegli con `part`: `guide`, `skill` (entrambe le skill) o `both`. Per impostazione predefinita è `both`. Restituisce, per ogni skill, i luoghi in cui va installata e gli indirizzi di download. Il parametro `language` è ancora accettato per assistenti più vecchi, ma il testo è sempre in inglese. Non tocca la pianificazione.
- `planner_inspect_xer_provenance` (lettura) — controlla la semantica di origine conservata di un file Primavera P6 (`.xer`) aperto: che cosa conteneva il file, con i conteggi dell'import e della diagnostica. I campi di testo libero del file restano invisibili per impostazione predefinita. L'assistente li deve chiedere esplicitamente. Anche i nomi delle risorse restano nascosti per impostazione predefinita, perché una risorsa P6 è di solito una persona; i codici delle risorse restano visibili. L'assistente deve chiederti il permesso prima di richiedere i nomi, perché in quel caso finiscono presso il fornitore IA. Non si può usare in uno script.

## Lo script

- `planner_batch` — esegue uno script di al massimo 100 passi come una sola modifica: un solo passo di annullamento, un ricalcolo, un backup. Se un passo fallisce in modo strutturale, l'intero script viene annullato. La risposta indica per passo che cosa è stato eseguito, che cosa è fallito e che cosa non è stato raggiunto. I nomi temporanei (`tmp-…`) di `planner_add_tasks` valgono nei passi successivi. Non sono ammessi come passo: `planner_batch` stesso, annulla e ripristina, gli strumenti per documenti e file, `planner_save_baseline`, `planner_get_planning_guide` e `planner_inspect_xer_provenance`. Uno script non è un linguaggio di programmazione: non ci sono variabili, condizioni o cicli.

## Quando uno strumento viene rifiutato

L'assistente riceve allora una risposta con un codice di errore e una spiegazione.

- `PAUSED` — *Pausa* è attiva.
- `READ_ONLY` — *Sola lettura* è attiva.
- `DIALOG_OPEN` — una finestra di dialogo è aperta. Questo vale anche per la lettura, tranne per `planner_get_planning_guide`. La risposta indica che cosa è aperto, con il suo nome interno, per esempio `showTaskDialog`.
- `DOC_DRIFT` — hai cambiato scheda mentre l'assistente lavorava. Deve confermare con `planner_switch_document` su quale documento lavora.
- `VALIDATION` — gli argomenti non corrispondono allo schema, oppure la modifica richiesta non è ammessa. La risposta indica il campo.
- `NOT_FOUND` — un id o un documento non esiste.
- `CYCLE` — la modifica creerebbe un riferimento circolare. Tutto in quella chiamata viene annullato.
- `SCOPE` — il percorso del file si trova fuori dalla tua cartella utente.
- `BACKUP_FAILED` — il backup prima della modifica non è riuscito. La modifica non è stata eseguita.
- `INTERNAL` — un errore imprevisto durante l'esecuzione di uno strumento, per esempio un'operazione su file non riuscita. La risposta riporta il messaggio di errore originale.
- `STALE_PRECONDITION` — fa parte del contratto del bridge, ma nessuno degli strumenti attuali restituisce questo codice.

Una richiesta rimasta in coda per più di 110 secondi non viene più eseguita dall'app. Il client ha già ricevuto un time-out, e eseguirla cambierebbe due volte le cose in caso di nuovo tentativo. Una chiamata che dura più di 120 secondi riceve un time-out dal bridge.

## Ciò che l'assistente non può impostare

Per attività l'assistente non può impostare: hammock, pianificata manualmente, un secondo vincolo, note, colore, codici attività, campi personalizzati, relazioni esterne e un ritardo di livellamento a mano. L'app calcola da sola il codice WBS. A livello di progetto non può cambiare il profilo di calcolo e le opzioni di calcolo. Impostazioni, tema, lingua, estensioni e aggiornamenti sono fuori portata, e lo è anche la libreria di risorse. Non ha nemmeno report, layout, filtri o vista. Il perché è spiegato in [Come funziona il collegamento IA](docs://uitleg-ai-koppeling).

## Che cosa salva l'app

- **Il token** si trova su questo computer, nelle impostazioni salvate dell'app. È lungo 64 caratteri ed è casuale. *Nuovo token* lo sostituisce.
- **La porta** è 3877 per impostazione predefinita. Si può cambiare solo quando il bridge è fermo.
- **Il pannello delle chiamate** conserva le ultime 500 chiamate, solo mentre l'app è aperta. Argomenti e risposte vengono troncati dopo 20 kB per campo. *Cancella* svuota l'elenco.
- **I backup** si trovano nella cartella `ai-backups` nella cartella dati dell'app. *Apri cartella di backup* ti porta lì. Hanno il nome `<project name>-<timestamp>.ifc`. Un file di progetto salvato ha una sola cartella per tutte le sessioni. Un documento che non hai mai salvato riceve una cartella propria per ogni sessione. Ogni volta che avvii il bridge si crea un backup per documento, oltre ai backup che fai tu stesso con *Esegui backup ora*.
- **Lo sfoltimento** avviene da solo, per cartella. Degli ultimi 7 giorni restano tutti, fino a 20. Ciò che la sessione in corso ha creato resta sempre. Dopo, resta un backup per settimana fino a 30 giorni, uno per mese fino a un anno, e poi uno per anno. I backup di un documento che non hai mai salvato spariscono completamente dopo un anno. I file nella cartella che non appartengono all'app non vengono toccati.

## Vedi anche

- [Come funziona il collegamento IA](docs://uitleg-ai-koppeling): perché il bridge è impostato così, e che cosa l'assistente può e non può fare.
- [Collegare un assistente IA (MCP)](docs://howto-ai-assistent-koppelen): avvia il bridge, collega e installa la skill.
- [Impostazioni](docs://ref-instellingen): i due interruttori IA.
- [Notifiche e avvisi](docs://ref-meldingen): il punto IA nella barra di stato.
