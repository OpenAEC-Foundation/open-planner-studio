# Colonne della tabella

La tabella attività ha 86 colonne fisse, oltre a una colonna per ogni codice attività e campo personalizzato del progetto e otto colonne per ogni baseline. Questo articolo indica per ogni colonna che cosa mostra, se puoi modificarla e in quale forma è scritto il valore. Come scegliere e disporre le colonne è descritto in [Personalizzazione delle colonne della tabella](docs://howto-tabelkolommen-aanpassen).

## Dove scegli le colonne

La tabella attività accanto al Gantt e la tabella nella scheda *Tabella* hanno ciascuna una propria scelta di colonne. Il segno più a destra dell'intestazione apre il selettore delle colonne (titolo della finestra *Scegli colonna*); su *Tabella* puoi anche usare *Tabella › Colonne › Colonne…*. Il selettore elenca le colonne per categoria: *Attività*, *Pianificazione*, *Vincoli*, *Relazioni*, *Risorse*, *Avanzamento*, *Calcolato*, *Baseline*, *Personalizzato* e *Tecnico*. Cerchi per nome, e *Usate di recente* è in cima. *Ripristina predefiniti* ripristina le colonne predefinite.

Per impostazione predefinita la tabella accanto al Gantt mostra *WBS*, *Nome attività* e *Durata*. La tabella nella scheda *Tabella* mostra *WBS*, *Nome attività*, *Durata*, *Inizio*, *Fine*, *Categoria di lavoro*, *Critica*, *Margine totale* e *Avanzamento*, oltre a una colonna per ogni codice attività e campo personalizzato del progetto.

## Come si leggono e si modificano i valori

- **Colonne calcolate** — le colonne della categoria *Calcolato* e alcune altre sono in sola lettura: derivano dal calcolo. Se provi a modificare una cella in sola lettura, l'app mostra *Questa colonna calcolata non può essere modificata*. Quel testo è il messaggio generale per ogni cella in sola lettura, anche quando la colonna non è calcolata. Se sono obsolete perché hai cambiato qualcosa, accanto appare *obsoleto* finché non premi *Calcola*.
- **Date** — compaiono nel formato che hai scelto in *Impostazioni app*, scheda *Aspetto*, intestazione *Formato data*.
- **Durate e margini** — una durata compare nell'unità dell'attività (`5d`, `12h`), oppure secondo *Visualizzazione della durata* nella stessa scheda (*Automatica (unità propria per attività)*, *Sempre giorni* o *Sempre ore*). Il margine compare in giorni lavorativi con due decimali e con il separatore decimale della tua lingua.
- **Sì/No** — un valore sì/no compare come *Sì* o *No*; un valore vuoto come trattino (—).
- **Modifica** — digita o scegli un valore. Un valore non valido viene rifiutato con un motivo sotto la cella, per esempio *Inserisci una durata valida, ad esempio 5d o 8h*. Oppure *Inserisci una percentuale tra 0 e 100*. Incollare un blocco di celle funziona cella per cella; le celle in sola lettura vengono saltate e l'app indica quante sono.

## Attività

- **Nome attività** — il nome dell'attività. Modificabile; obbligatorio. Un'attività di riepilogo è mostrata in grassetto, con una leggera tinta di sfondo sulla cella del nome; un cardine è mostrato in grassetto nel colore del cardine (la stessa famiglia di colori del cardine nel Gantt). Un'attività normale resta com'è. È solo formattazione: selezionare, trascinare e modificare funzionano allo stesso modo.
- **Descrizione** — la descrizione. Modificabile; testo libero.
- **WBS** — il codice WBS. Modificabile e obbligatorio, ma in sola lettura mentre *WBS auto* è attivo.
- **Categoria di lavoro** — la categoria di lavoro (*Costruzione*, *Installazione*, *Demolizione*, *Logistica*, *Ispezione*, *Trasferimento*, *Ristrutturazione*, *Manutenzione* o *Altro*). Modificabile con un elenco.
- **Categoria di lavoro personalizzata** — la categoria di lavoro personalizzata del progetto, oppure un trattino. Modificabile con un elenco delle categorie di lavoro personalizzate del progetto.
- **Colore** — il colore salvato dell'attività, come codice colore, per esempio `#1a73e8`. Modificabile con un selettore colore. Il colore è salvato nel file IFC, ma nessuna barra o report lo usa; i colori delle barre si impostano in *Vista › Baseline e progresso › Colori barre*.
- **Note** — le note nella forma `✓ testo; ○ testo`. Modificabili finché c'è al massimo una nota (in quel caso modifichi il suo testo); con più note in sola lettura.

## Pianificazione

- **Cardine** — indica se l'attività è un cardine. Modificabile. Attivandolo la durata diventa 0; l'app lo rifiuta per un'attività di riepilogo e per un'attività con assegnazioni.
- **Tipo di cardine** — *Attività cardine di inizio* o *Attività cardine di fine*, oppure un trattino per automatico. Modificabile solo su un cardine.
- **Cardine obbligatorio** — il contrassegno *Obbligatoria (contrattuale)*. Modificabile solo su un cardine.
- **Priorità di livellamento** — un numero intero da 0 a 1000, predefinito 500. Modificabile. 1000 fissa l'attività per il livellamento.
- **Lacune di divisione** — il numero di interruzioni, come `Lacune di divisione: 2`, oppure un trattino. In sola lettura; le modifichi nel pannello *Proprietà*.
- **Tipo di attività** — il tipo di attività; vuoto significa il valore predefinito del progetto. Modificabile con un elenco, ma vuoto e in sola lettura su un cardine, un'attività di riepilogo o un hammock. Compare nel selettore solo quando i tipi di attività sono visibili (*Usa tipi di attività*, oppure il file contiene tipi di attività).
- **Hammock (durata derivata)** — indica se l'attività è un hammock. Modificabile, tranne su un cardine o un'attività di riepilogo.
- **Calendario** — l'ID del calendario proprio dell'attività; vuoto (—) è il calendario del progetto. Digita o scegli un ID dai suggerimenti; un ID sconosciuto viene rifiutato. Nota: la cella mostra per ora l'ID interno invece del nome; meglio scegliere un calendario nel pannello *Proprietà*.
- **Tipo di durata** — *Tempo lavorativo* (la durata conta in giorni lavorativi o in orari di lavoro del calendario) oppure *Tempo trascorso* (la durata conta in tempo continuo dell'orologio, senza calendario). Modificabile.
- **Unità della durata** — *Giorni* o *Ore*. Modificabile, tranne su un'attività di riepilogo, un hammock o un cardine; il cambio funziona solo se la conversione è esatta e *Attiva pianificazione oraria* è attivo.
- **Durata** — la durata dell'attività, nell'unità dell'attività o secondo *Visualizzazione della durata*. Modificabile: digita `5d`, `12h` o `1h 30m`; anche un numero nell'unità dell'attività. In sola lettura su un'attività di riepilogo, un hammock e un cardine con durata 0.
- **Inizio** — l'inizio visualizzato, la stessa data della barra nel Gantt. Per un'attività iniziata è l'inizio effettivo. Modificabile. Se dai un nuovo inizio a un'attività con predecessore, questa riceve il vincolo *Iniziare non prima del (SNET)* su quella data. In sola lettura su un'attività di riepilogo o un hammock, tranne se pianificata manualmente, e su un'attività già iniziata (*Questa attività è iniziata; il suo inizio è l’inizio effettivo. Modificalo tramite l’avanzamento*).
- **Fine** — la fine visualizzata. Per un'attività completata è la fine effettiva. Modificabile: una nuova fine diventa una nuova durata. L'app la rifiuta per un cardine, un'attività in tempo trascorso e un'attività con interruzioni, e per una fine prima dell'inizio (*La fine è precedente all’inizio*). In sola lettura su un'attività di riepilogo o un hammock, tranne se pianificata manualmente, e su un'attività completata (*Questa attività è completata; la sua fine è la fine effettiva. Modificala tramite l’avanzamento*).
- **Inizio pianificato** — il punto di partenza da cui parte il calcolo (non per forza l'inizio visualizzato). Modificabile; ha lo stesso effetto che digitare in *Inizio*.
- **Fine pianificata** — la fine inserita. Modificabile solo su un'attività pianificata manualmente; altrimenti l'app mostra *La fine pianificata vale solo per un’attività pianificata manualmente. Modifica la fine tramite la colonna Fine o la durata*.

## Vincoli

- **Tipo di vincolo** — il tipo del vincolo, da *Il più presto possibile (ASAP)* a *Deve finire il (MFO)*. Modificabile; un'attività senza vincolo mostra *ASAP*.
- **Data del vincolo** — la data del vincolo. Modificabile.
- **Vincolo rigido** — il contrassegno *Obbligatorio (logica di blocco)*. Modificabile solo su *MSO* e *MFO*.
- **Tipo di vincolo secondario** — il tipo del secondo limite, oppure un trattino. Modificabile; la tabella offre tutti i tipi, ma una combinazione non ammessa viene rifiutata: deve essere *SNET*, *FNET*, *SNLT* o *FNLT*, il vincolo primario deve essere un limite (non *ASAP*, *ALAP*, *MSO*, *MFO* o un vincolo rigido) e i due limiti devono stare su lati opposti (un limite inferiore *SNET*/*FNET* con un limite superiore *SNLT*/*FNLT*, o viceversa).
- **Data del vincolo secondario** — la data del secondo limite. Modificabile.
- **Scadenza** — la data obiettivo per la fine. Modificabile.

## Relazioni

- **Predecessori** — i predecessori, nella forma `WBS tipo±ritardo`, separati da `; `, per esempio `1.2 FS+2d`. Modificabili digitando nella stessa forma. Una relazione esterna non si aggiunge qui, ma con *Pianificazione › Relazioni › Collega › Aggiungi relazione esterna…*.
- **Successori** — i successori, nella stessa forma. Modificabili.
- **Relazioni determinanti** — le relazioni che determinano la data di questa attività, come `← 1.2` (predecessore) o `→ 1.4` (successore). In sola lettura; è *obsoleto* finché non premi *Calcola*.
- **Margine libero** (nella categoria *Relazioni*) — il margine libero per relazione, come `← 1.2: 3d`. Non è la stessa colonna di *Margine libero* sotto *Calcolato*, che mostra il margine dell'attività stessa. In sola lettura.
- **Avvisi** — avvisi per relazione, per esempio *Fuori sequenza* o *Non inclusa nel calcolo*. In sola lettura. Vedi [Notifiche e avvisi](docs://ref-meldingen).

## Risorse

- **Risorse assegnate** — i nomi delle risorse assegnate, separati da virgole. Modificabile: aggiungere un nome assegna la risorsa con 1 unità al giorno, togliere un nome rimuove l'assegnazione. In sola lettura su un cardine o un'attività di riepilogo.
- **Unità di assegnazione al giorno** — le unità per risorsa, come `Name: 1; Name: 0.5`, con al massimo due decimali. Il valore salvato resta esatto. Modificabile su un'attività con assegnazioni.
- **Unità pianificate al giorno** — il ritmo pianificato per risorsa, come `Name: 1.11`, con al massimo due decimali, come *Unità di assegnazione al giorno*. Solo per un'assegnazione da Primavera P6 con un ritmo rimanente diverso; *Unità di assegnazione al giorno* mostra allora il ritmo rimanente. In sola lettura.
- **Curva di assegnazione** — la curva per risorsa, come `Nome: Uniforme`. Modificabile su un'attività con assegnazioni.
- **Inizio finestra di lavoro** e **Fine finestra di lavoro** — la finestra di lavoro per risorsa, da un file importato, come `Nome: data`. In sola lettura.
- **Lavoro previsto (ore)** e **Lavoro effettivo (ore)** — il lavoro previsto ed effettivo per risorsa in ore, come `Nome: 617.14`, con al massimo due decimali, da un file importato. In sola lettura.
- **Lavoro rimanente (ore)** — il lavoro rimanente per risorsa in ore, come `Nome: 6` o `Nome: 26.67`: il lavoro salvato, altrimenti la durata rimanente × unità. Modificabile su un'attività con assegnazioni a cui si applica un tipo di attività, con la virgola o il punto come separatore decimale. Compare nel selettore solo quando i tipi di attività sono visibili. Un ⚠ giallo nella cella significa che il lavoro salvato è diverso da unità × durata rimanente, come il ⚠ accanto a *Lavoro (rim.)* nel pannello delle attività.

## Avanzamento

- **Stato** — *Non iniziata*, *In corso* o *Completata*. Modificabile, tranne su un'attività di riepilogo.
- **Avanzamento** — la percentuale, come `40%`. Modificabile con un numero da 0 a 100, tranne su un'attività di riepilogo.
- **Inizio effettivo** — la data in cui l'attività è iniziata. Modificabile, tranne su un'attività di riepilogo.
- **Fine effettiva** — la data in cui l'attività è finita. Modificabile, tranne su un'attività di riepilogo.
- **Durata effettiva** — la durata effettiva, come numero. Modificabile, tranne su un'attività di riepilogo.
- **Rimanente** — la durata rimanente, nell'unità dell'attività. Modificabile, tranne su un'attività di riepilogo.
- **Data di ripresa** e **Data di arresto** — la ripresa e l'arresto di un'attività in corso da un file MS Project o Primavera. In sola lettura.

Le colonne di avanzamento seguono le regole di avanzamento dell'app: una data effettiva dopo la data di stato viene rifiutata. Su un'attività di riepilogo l'app mostra *L'avanzamento di un'attività di riepilogo è derivato dalle sue sottoattività e non può essere modificato qui*.

## Calcolato

Tutte le colonne di questa categoria sono in sola lettura.

- **Ritardo di livellamento** — di quanti giorni lavorativi il livellamento ha ritardato l'attività; un trattino se non è stato applicato alcun livellamento.
- **Inizio anticipato** e **Fine anticipata** — le date più anticipate dal calcolo. Per un'attività iniziata possono differire da *Inizio* e *Fine*: il profilo di calcolo *Primavera P6* porta l'inizio anticipato di un'attività in corso o completata alla data di stato.
- **Inizio posticipato** e **Fine posticipata** — le date più tarde in cui l'attività può ancora iniziare o finire senza ritardare il progetto.
- **Margine libero** — i giorni lavorativi di cui l'attività può slittare senza ritardare un successore.
- **Margine totale** — i giorni lavorativi di cui l'attività può slittare senza ritardare la fine del progetto. Negativo se non è possibile rispettare un vincolo o una scadenza.
- **Critica** — *Sì* se l'attività è sul percorso critico.
- **Margine interferente** — margine totale meno margine libero.
- **Quasi critica** — *Sì* per un'attività quasi critica. Viene compilata solo se *Contrassegna quasi critico* è attivo (*Impostazioni progetto*, blocco *Profilo di calcolo e opzioni*); altrimenti un trattino.
- **Percorso di margine** — il numero del percorso di margine, 1 per il più critico. Viene compilato solo se *Percorsi di margine multipli* è attivo; altrimenti un trattino.
- **Origine delle date registrate** — finché l'app mostra le date del file: *Parzialmente non registrato* su un'attività per cui il file non contiene tutto. Compare nel selettore solo in quella vista. Su un asse temporale non registrato compare *Non registrato* nelle colonne delle date più tarde e dei margini.

Vedi [Percorso critico e margine](docs://uitleg-kritiek-pad).

## Baseline

Per ogni baseline del progetto si aggiungono colonne, con il nome della baseline davanti al nome della colonna (`<baseline> — Inizio pianificato`). Sono in sola lettura. Un'attività che non è nella baseline mostra un trattino con il suggerimento *Non presente in questa baseline*.

- **Inizio pianificato**, **Fine pianificata** e **Durata** — inizio, fine e durata come le ha registrate la baseline.
- **Scostamento inizio** e **Scostamento fine** — il numero di giorni lavorativi tra la baseline e l'inizio o la fine visualizzati, nel calendario del progetto; positivo se l'attività è più tardi.
- **Scostamento durata** — la durata attuale meno la durata nella baseline, in giorni lavorativi.

## Personalizzato

- **Codice attività** — una colonna per ogni codice attività, con il nome del codice. Mostra il codice del valore scelto. Modificabile: digita il codice o scegline uno dai suggerimenti; un codice sconosciuto viene rifiutato, e se un codice compare più volte l'app ti chiede di sceglierlo dall'elenco.
- **Campo personalizzato** — una colonna per ogni campo personalizzato, con il suo nome. L'input corrisponde al tipo: testo, numero, intero, costo, data o sì/no. Modificabile.

Queste colonne appartengono al progetto in cui si trovano il codice o il campo. Vedi [Codici e campi personalizzati](docs://howto-codes-en-velden).

## Tecnico

Tutte le colonne di questa categoria sono in sola lettura. Mostrano dati che l'app salva ma non mostra in una colonna normale, per esempio per controllare un'importazione.

- **ID attività** — l'ID interno dell'attività.
- **ID attività padre** e **ID attività figlie** — gli ID dell'attività padre e delle attività figlie.
- **ID risorse** — gli ID delle risorse dell'attività.
- **ID assegnazione**, **ID attività dell'assegnazione** e **ID risorsa dell'assegnazione** — gli ID delle assegnazioni, delle attività e delle risorse di questa attività.
- **Durata (minuti)** e **Rimanente (minuti)** — la durata e la durata rimanente in minuti; compilate solo su un'attività in ore.
- **Ritardo di livellamento (minuti)** e **Ritardo di livellamento trascorso** — il ritardo di livellamento da MS Project in minuti, e se conta come tempo trascorso.
- **Pianificata manualmente** — se l'attività è pianificata manualmente.
- **Tipo attività MS Project (import)** e **Basata sull’impegno** — il tipo di attività e il contrassegno basata sull’impegno come li aveva MS Project.
- **Provenienza Primavera P6** — i campi di origine da un file Primavera, come `key: value`.
- **Attività di riepilogo esplicita** — se l'attività è un'attività di riepilogo esplicita senza sottoattività (da un file Primavera).
- **Limite minimo della fine per distribuzione oraria**, **Ancoraggio inizio per distribuzione oraria**, **Segmenti di durata per distribuzione oraria** e **Contorni per distribuzione oraria** — la distribuzione oraria da un file MS Project, come date e conteggi.
- **Dati codici attività**, **Dati campi personalizzati** e **Dati note** — il numero di assegnazioni di codici, di campi personalizzati e di note.
- **Dati relazioni interne** e **Dati relazioni esterne** — il numero di relazioni interne ed esterne.
- Per ogni baseline compaiono anche **Cardine** e **Tipo di cardine**, come li ha registrati la baseline.
