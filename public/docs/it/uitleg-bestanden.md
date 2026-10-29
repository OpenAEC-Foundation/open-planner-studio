# File e formati

Che cosa c'è davvero nel file che salvi? E che cosa succede alla tua pianificazione quando la esporti verso un altro pacchetto? In questo articolo leggi come l'app gestisce i file: IFC come formato proprio, gli altri formati come adattatori, che cosa lascia fuori un'esportazione e in che cosa si differenziano salvataggio, salvataggio automatico e recupero. L'esempio alla fine mostra con i numeri che cosa fa un'esportazione.

## Il concetto

Open Planner Studio ha un formato di file proprio: **IFC**, un formato di scambio aperto per le informazioni di costruzione di buildingSMART. L'app scrive lo schema IFC del progetto, per impostazione predefinita IFC 4.3 ADD2 (vedi [Scegliere lo schema IFC](docs://howto-ifc-schema-kiezen)); nell'elenco di esportazione si chiama *IFC*. Non esiste un secondo file di progetto proprietario. *Salva* scrive l'intero progetto come file IFC (`.ifc`) e *Apri* legge di nuovo un file così. Vuoi vedere che cosa c'è nel file? La scheda *IFC* è un editor che mostra il testo IFC del tuo progetto; *Genera IFC* aggiorna quel testo e *Copia* lo mette negli appunti. Se modifichi il testo, *Applica* lo carica come tuo progetto. Questo sostituisce completamente il progetto in quella scheda.

Tutti gli altri formati sono **adattatori**: traduttori tra il modello di un altro programma e quello dell'app. L'app legge CSV, MS Project XML, Primavera P6 XML, file MS Project (`.mpp`) e file Primavera (`.xer`). Scrive CSV, MS Project XML, Primavera P6 XML e due fogli di avanzamento. Non puoi esportare verso `.mpp` o `.xer`.

Perché questa distinzione conta? Un traduttore può trasferire solo ciò che entrambi i lati conoscono. Il file IFC dell'app conserva tutto ciò che appartiene al tuo progetto. Ogni altro formato non ha una parte di questo, e quella parte resta indietro.

## Come l'app gestisce i file

### Che cosa fa l'apertura

L'app sceglie il lettore in base all'estensione: `.ifc`, `.csv`, `.xml`, `.mpp` o `.xer`. Con un file `.xml` guarda dentro il file per vedere se è MS Project XML o Primavera P6 XML. Un'estensione sconosciuta viene trattata come IFC. Se il file non è IFC, l'app mostra *Apertura del file non riuscita*, con il motivo.

Ogni file si apre in una scheda propria. Fa eccezione una scheda ancora vuota e non modificata: quella scheda prende il file. Un singolo file Primavera può produrre più schede, una per ogni progetto che ha attività.

Dopo l'apertura, l'app ricalcola sempre. Se il file viene da un altro pacchetto, le date possono differire da quelle indicate nel file. Questo è descritto in [Date come registrate](docs://uitleg-datums-zoals-opgeslagen).

Solo un file IFC diventa la **destinazione di salvataggio**: il file in cui *Salva* scrive. Un file CSV, XML, `.mpp` o `.xer` non lo diventa. Un progetto così non ha file dopo l'apertura; *Salva* chiede allora dove deve andare il nuovo file IFC. Così Ctrl+S non sovrascrive mai il tuo file originale con testo IFC.

### Che cosa scrive il salvataggio

*Salva* scrive sempre l'intero progetto. Dentro il file finisce questo:

- attività con struttura, durata, date e avanzamento;
- relazioni con ritardo, vincoli e scadenze;
- calendari, risorse e assegnazioni, comprese le curve;
- baseline, codici attività, campi personalizzati e note;
- relazioni esterne verso altri progetti;
- le impostazioni del progetto, come la data di stato, il profilo di calcolo e le opzioni di calcolo;
- il collegamento a una libreria di risorse.

Ciò che imposti sullo schermo non appartiene al progetto e non finisce nel file: zoom, posizione di scorrimento, l'attività selezionata e le fasi compresse. Le impostazioni dell'app, come lingua e tema, non sono nemmeno nel file. L'app le conserva da sola, nell'app o nel browser.

Un'esportazione verso un altro formato non tocca il progetto. Dopo un'esportazione il progetto ha ancora la stessa destinazione di salvataggio. Se era contrassegnato come *Non salvato*, lo è ancora.

### Che cosa perde un'esportazione

Ogni adattatore trasferisce ciò che il suo formato conosce.

**MS Project XML** trasferisce attività, relazioni, calendari, risorse, assegnazioni, vincoli, scadenze e la data di stato. Delle tue baseline viene trasferita solo quella attiva. Codici attività, campi personalizzati, note e relazioni esterne non vengono trasferiti. Un secondo vincolo su un'attività non viene trasferito. Un vincolo *Deve iniziare il (MSO)* o *Deve finire il (MFO)* senza la scelta *Obbligatorio (logica di blocco)* torna come *Iniziare non prima del (SNET)* o *Finire non prima del (FNET)*. *Pianificata manualmente* e il *Ritardo di livellamento* di un'attività non ritornano. Un hammock diventa un'attività normale con date calcolate.

**Primavera P6 XML** trasferisce attività, relazioni, calendari, risorse, assegnazioni, vincoli e la data di stato. Baseline e scadenze non vengono trasferite, e nemmeno codici attività, campi personalizzati, note e relazioni esterne. Anche qui un hammock diventa un'attività normale. P6 non ha ritardi in percentuale: l'app converte un ritardo così in un numero fisso di giorni. Un ritardo in giorni di calendario diventa un ritardo in giorni lavorativi.

**CSV** è un elenco di attività. Il file ha per ogni attività queste colonne: id attività, WBS, livello, nome, durata, inizio, fine, predecessori, categoria di lavoro, l'id di una categoria di lavoro personalizzata (`OPS Custom Task Type ID`), stato, completamento, inizio effettivo e fine effettiva, critico, margine totale e descrizione. Risorse, assegnazioni, calendari, vincoli, scadenze, baseline e la data di stato non sono nel file. Le intestazioni delle colonne sono sempre in inglese.

**Solo IFC contiene il profilo di calcolo e le opzioni di calcolo.** Se esporti verso CSV, MS Project XML o Primavera P6 XML, il profilo non è nel file; delle opzioni di calcolo, MS Project XML scrive al massimo la soglia critica. Un file così si riapre come *Open Planner Studio*. Se il tuo progetto calcolava con *Primavera P6* o *Microsoft Project*, per esempio perché veniva da un `.xer` o un `.mpp`, le date possono spostarsi per questo motivo. Che cosa sia un profilo di calcolo è spiegato in [Profili di calcolo e convenzioni](docs://uitleg-rekenprofielen).

Se il tuo progetto viene da un file Primavera (`.xer`), anche se lo hai salvato come IFC nel frattempo, l'app mostra dopo un'esportazione verso CSV, MS Project XML o P6 XML: *L’esportazione in CSV perde informazioni di origine XER.* Per MS Project XML dice *MSPDI* invece di *CSV*, per P6 XML dice *P6*. Per IFC non ricevi quel messaggio: il file IFC porta con sé il file sorgente di Primavera. Vedi [Aprire un file Primavera P6 (.xer)](docs://howto-xer-openen).

Due altre cose fa l'app con un'esportazione. Se la pianificazione non è aggiornata, l'app la ricalcola prima e poi esporta. Inoltre non esporta una pianificazione con una dipendenza circolare: ricevi un messaggio con il ciclo, per esempio *Dipendenza circolare tra attività: Set up site → Demolish existing extension → Set up site*.

### Salvare, salvataggio automatico e recupero

Sono tre cose diverse. Si assomigliano, ma scrivono in un posto diverso.

**Salvare** è un'azione che fai tu. L'app scrive il progetto nel tuo file e toglie il contrassegno *Non salvato*.

**Il salvataggio automatico** è disattivato per impostazione predefinita, e lo attivi tu stesso per ogni progetto. L'app scrive poi, senza finestra, nello stesso file ogni volta che ci sono modifiche, al massimo una volta ogni dieci secondi. Funziona solo se il progetto ha già un file. Vedi [Attivare il salvataggio automatico](docs://howto-automatisch-opslaan).

**Il recupero** è sempre attivo. Appena c'è una modifica in un punto qualsiasi, l'app conserva, anch'essa al massimo una volta ogni dieci secondi, una copia di recupero di tutti i progetti aperti, anche di quelli che non hai modificato tu. Quella copia non si trova nel file del progetto: nell'app desktop è nella cartella dati dell'app, nel browser è nello spazio di archiviazione del browser. All'avvio successivo l'app propone quella copia. Ne leggi in [Recuperare dopo un arresto anomalo](docs://howto-herstellen-na-een-crash). Il recupero non scrive mai nel file del progetto.

Poiché una copia viene conservata al massimo una volta ogni dieci secondi, in un arresto anomalo puoi perdere gli ultimi secondi di lavoro.

### Desktop e browser

L'app desktop e la versione per browser fanno lo stesso con il tuo progetto, ma scrivono i file in modo diverso.

Su desktop l'app lavora con percorsi reali. *Salva* scrive direttamente nel tuo file. Di solito l'app scrive prima in un file temporaneo accanto a quello (`.ops-save.tmp`) e solo dopo sostituisce il tuo file, così un arresto anomalo a metà della scrittura non taglia via il file vecchio. Se chiudi l'app con modifiche, chiede per ogni progetto se vuoi salvare. Alla chiusura regolare elimina le sue copie di recupero.

In un browser che può conservare file dove vuoi (come Chrome e Edge) ottieni una normale finestra di apertura e salvataggio. Poi *Salva* scrive direttamente nel file; per un file che hai aperto, il browser chiede il permesso una volta sola. L'elenco *Recenti* funziona, con solo i nomi dei file.

In un browser che non ha questa possibilità (come Firefox) l'app apre un file con la finestra di selezione e salva tramite un download. Con *Salva* il messaggio *Salvato come download: 'name.ifc' si trova nella cartella dei download. …* spiega questo una volta per sessione. Con *Salva come* e con le esportazioni vedi *Salvato come download: 'name.ifc' si trova ora nella cartella dei download. Questo ambiente non consente all'applicazione di scrivere direttamente nella posizione scelta.* Se il browser può mostrare una finestra di salvataggio ma non può scrivere di nuovo nel file del progetto, *Salva* chiede ogni volta un posto nuovo. Anche questo lo spiega un messaggio, una volta per sessione. *File › Recenti* c'è, ma apre una pagina vuota, e il salvataggio automatico non è disponibile. Ricevi lo stesso messaggio in ogni ambiente che non permette all'app di scrivere nel posto che hai scelto.

## Esempio: esportare il progetto di esempio

Prendi l'esempio *Refurbishment & Extension of a Family Home* (*File › Esempi*). Ha 20 attività, di cui 4 fasi e 2 cardini, e 16 relazioni. Ci sono 6 risorse con 8 assegnazioni, 1 baseline e un collegamento alla *Demo resource library*. L'attività *Demolish existing extension* ha il vincolo *Iniziare non prima del (SNET)* il 14 maggio 2027, e *Handover inspection* ha una scadenza il 29 luglio 2027. La pianificazione termina il 7 luglio 2027.

Così torna il progetto da ogni formato, misurato dopo aver riaperto il file esportato:

- Il file IFC restituisce tutto: 20 attività, 16 relazioni, 6 risorse, 8 assegnazioni, la baseline, il vincolo, la scadenza e il collegamento alla libreria. La pianificazione termina di nuovo il 7 luglio 2027.
- Il file MS Project XML restituisce anche tutto, tranne il collegamento alla libreria. La pianificazione termina il 7 luglio 2027.
- Il file P6 XML restituisce le attività, le relazioni, le risorse, le assegnazioni e il vincolo. Mancano la baseline e la scadenza. La pianificazione termina comunque il 7 luglio 2027, perché il vincolo è ancora presente.
- Il file CSV restituisce 20 attività e 16 relazioni. Mancano risorse, assegnazioni, baseline, vincolo e scadenza, e il progetto si chiama *CSV Import*. Senza il vincolo le attività si spostano in avanti: la pianificazione termina il 2 luglio 2027, cinque giorni di calendario prima.

Senza quel vincolo anche l'esempio stesso termina il 2 luglio 2027. La differenza quindi viene dal vincolo che il file CSV non porta con sé.

## Conseguenze e fraintendimenti

**Un'esportazione non è una copia di sicurezza.** Solo IFC conserva tutto. Se vuoi tenere il progetto, salvalo come IFC. Esporta solo per chi ha bisogno dell'altro formato.

**Riaprire un'esportazione non dà sempre la stessa pianificazione.** L'app ricalcola sempre all'apertura, con il profilo di calcolo che appartiene al formato. Se manca logica, come il vincolo nell'esempio CSV, o se il profilo calcola in modo diverso, il risultato cambia.

**Un'esportazione è anche in *Recenti*.** Su desktop e nei browser con accesso ai file, un'esportazione finisce in *Recenti*, proprio come un progetto salvato (i fogli di avanzamento no). Se la apri da lì, si apre come importazione di quel formato.

**Salvare non è lo stesso che il recupero.** Il recupero aiuta dopo un arresto anomalo, ma non sostituisce il salvataggio. Quindi salva prima di chiudere una scheda o l'app.

## Vedi anche

- [Aprire e salvare un file](docs://howto-bestand-openen-en-opslaan): i passi per aprire, salvare e salvare come.
- [Esportare](docs://howto-exporteren): scegliere un formato e che cosa ottieni.
- [Date come registrate](docs://uitleg-datums-zoals-opgeslagen): perché una pianificazione importata può mostrare altre date.
- [Vincoli e scadenze](docs://uitleg-constraints): che cosa fa un vincolo, e quindi che cosa scompare se manca.
- [Relazioni e ritardo](docs://uitleg-relaties): che cos'è un ritardo e come lo calcola l'app.
- [Creare un hammock](docs://howto-hammock): che cos'è un hammock, che un'esportazione scrive come attività normale.
- [Codici e campi personalizzati](docs://howto-codes-en-velden): codici attività e campi personalizzati, che solo IFC conserva.
- [Relazioni esterne verso un altro progetto](docs://howto-externe-relaties): relazioni esterne che MS Project XML e P6 XML non portano con sé.
- [Salvare e gestire una baseline](docs://howto-baseline-opslaan-en-beheren): baseline, di cui MS Project XML porta con sé solo quella attiva.
- [Formati di importazione ed esportazione](docs://ref-import-exportformaten): per formato che cosa viene trasferito e che cosa no.
