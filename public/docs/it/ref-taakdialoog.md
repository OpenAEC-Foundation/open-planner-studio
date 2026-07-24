# Finestra di dialogo attività

La finestra **Modifica attività** mostra tutte le proprietà di un'attività — gli stessi campi e sezioni del pannello delle proprietà a destra, ma in una finestra con un passaggio di salvataggio esplicito.

## Apertura

- **Doppio clic** su un'attività nel Gantt.
- **F2** con un'attività selezionata.
- **Clic destro** su un'attività → **Modifica...**

## Salvare e annullare

- **Salva** applica tutte le modifiche ai campi in una volta; il pulsante è disabilitato finché il nome è vuoto. **Invio** fa lo stesso di Salva (tranne all'interno di una casella di testo multiriga).
- **Annulla**, **Esc**, la crocetta di chiusura o un clic fuori dalla finestra chiude senza applicare le modifiche ai campi.
- Eccezione: le sezioni **Dipendenze**, **Assegnazioni** e **Codici e campi** agiscono direttamente sulla pianificazione (identico al pannello) — le modifiche lì hanno effetto immediato, anche se poi annulli.

## Campi

- **Nome \*** — obbligatorio; riceve automaticamente il focus all'apertura della finestra.
- **Codice WBS** — inserimento libero. Con la numerazione automatica WBS attiva (Pianificazione → Struttura) il campo è bloccato: l'app gestisce i codici.
- **Descrizione** — testo libero.
- **Tipo** — il tipo di attività (ad esempio Costruzione); determina la colorazione della barra.
- **Calendario** — **Calendario del progetto** o un calendario specifico dalla libreria; determina i giorni lavorativi di questa attività.
- **Attività padre** — sposta l'attività sotto un padre diverso, oppure **- Nessuna (radice) -**. Questo campo esiste solo nella finestra di dialogo; nel pannello, la ristrutturazione avviene trascinando o con rientra/rimuovi rientro.

## Note

Una checklist per attività: ogni riga ha una **casella di spunta fatto**, una casella di testo e un pulsante di rimozione; **Aggiungi nota** crea una nuova riga. Le righe completate sono barrate. Vedi [Pianificazione e WBS](docs://gids-plannen-wbs).

## Traguardo

- **Traguardo** — selezionandola imposta la durata a 0 e mostra il rombo invece di una barra.
- **Tipo di cardine** — **Automatico**, **Attività cardine di inizio** o **Attività cardine di fine**.
- **Obbligatoria (contrattuale)** — contrassegna il traguardo come contrattuale.

## Tempo

- **Data di inizio** — mostra l'inizio anticipato calcolato; una modifica manuale ancora la nuova data come inizio pianificato.
- **Durata (giorni lavorativi)** — giorni lavorativi interi; disabilitata per un traguardo.
- Con la **pianificazione oraria attivata** e un calendario orario sull'attività, compaiono tre caselle sincronizzate: **Giorni**, **Ore** e **Ore totali** (solo numeri interi). Senza un calendario orario compare un suggerimento: "L'inserimento in ore richiede un calendario orario (orari di lavoro)." Vedi [Calendari e pianificazione oraria](docs://gids-kalenders-uren).

## Hammock (durata derivata)

Solo su un'attività senza sottoattività che non è un traguardo. Selezionandola la durata diventa derivata: l'intervallo tra il **Driver di inizio** (relazione FS/SS in ingresso) e il **Driver di fine** (relazione FF/SF in ingresso), entrambi mostrati in sola lettura. Se manca un driver di fine, la finestra segnala che l'intervallo torna a lunghezza zero. Vedi [Percorso critico e analisi avanzata](docs://gids-kritiek-pad-analyse).

## Vincolo e scadenza

- **Vincolo** — Il più presto possibile (ASAP), Il più tardi possibile (ALAP), Iniziare non prima del (SNET), Iniziare non oltre il (SNLT), Finire non prima del (FNET), Finire non oltre il (FNLT), Deve iniziare il (MSO) o Deve finire il (MFO); con una **Data del vincolo** dove applicabile.
- **Obbligatorio (logica di blocco)** — solo MSO/MFO: blocca rigidamente la data e sovrascrive la logica delle relazioni; una violazione diventa margine negativo a monte.
- **Vincolo secondario** — un secondo limite (SNET/FNET/SNLT/FNLT) con una **Data secondaria**; non possibile con un blocco rigido. Le combinazioni non consentite diventano rosse con una motivazione.
- **Scadenza** — una data obiettivo esterna al calcolo; non rispettarla dà un avviso, non uno spostamento. Vedi [Relazioni e vincoli](docs://gids-relaties-constraints).

## Progresso

- **Progresso (%)** — cursore 0–100%.
- **Inizio effettivo** / **Fine effettiva** — fatti registrati; per un traguardo un unico campo **Data effettiva**. Le date successive alla data di stato vengono rifiutate.
- **Rimanente (giorni lavorativi)** — sola lettura, derivato da durata × (1 − progresso). Vedi [Baseline e avanzamento](docs://gids-baselines-voortgang).

## Risultato CPM (sola lettura)

**Inizio anticipato/Fine anticipata**, **Inizio posticipato/Fine posticipata**, **Margine totale**, **Margine libero**, **Margine interferente** (quando calcolato) e **Percorso critico** (sì/no). Compilato dopo un calcolo (F5).

## Dipendenze

Tutte le relazioni di questa attività: direzione (→ successore, ← predecessore), l'altra attività, un'icona a fulmine sulla **relazione determinante**, il tipo di relazione (FS/SS/FF/SF), il **ritardo** (es. 2d, 3ed, 50%) e un pulsante di rimozione. Le modifiche hanno effetto immediato.

## Assegnazioni

Per ogni risorsa assegnata: nome, **Unità/giorno**, **Curva**, **Sposta in…** (sposta l'assegnazione a un'altra attività) e rimuovi; in basso **Assegna risorsa**. Non possibile su traguardi o attività di riepilogo. Ha effetto immediato. Vedi [Risorse, istogramma e livellamento](docs://gids-resources-histogram).

## Codici e campi

Visibile solo quando il progetto ha tipi di codice attività o campi personalizzati: un selettore di valore per ogni tipo di codice, un input tipizzato per ogni campo personalizzato. Ha effetto immediato. Le definizioni si gestiscono nella finestra di struttura — vedi [Codici e campi](docs://ref-codes-velden).
