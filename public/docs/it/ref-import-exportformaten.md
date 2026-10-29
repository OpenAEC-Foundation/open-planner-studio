# Formati di importazione ed esportazione

Per formato di file: se puoi aprirlo, salvarlo ed esportarlo, cosa viene incluso e cosa no, e con quale profilo di calcolo si apre. Il perché di tutto questo, con un esempio con numeri, si trova in [File e formati](docs://uitleg-bestanden).

## In breve

**Apertura** funziona con IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` e `.xer`. Un file con un'altra estensione viene trattato dall'app come IFC.

**Salvataggio** scrive sempre IFC. Solo un file IFC aperto diventa la destinazione del salvataggio. Un progetto di un altro formato non ha un file dopo l'apertura. *Salva* chiede allora dove salvare il file IFC.

**Esportazione** funziona verso IFC, MS Project XML, Primavera P6 XML, CSV e due fogli di avanzamento (Excel e CSV). Un'esportazione non cambia il tuo progetto.

**Sola lettura** sono `.mpp` e `.xer`: l'app può aprirli, ma non scriverli.

**PDF** viene solo da un report (vedi [Tipi di report](docs://ref-rapporttypes)). L'app non legge il PDF.

**Dove.** Apertura: *Home › File › Apri*, *File › Apri* oppure Ctrl+O. Esportazione: *Home › File › Esporta* o *File › Esporta*. Un foglio di avanzamento compilato lo leggi con *File › Importa*. Oppure usi il pulsante *Aggiorna l'avanzamento da un foglio* nel gruppo *Avanzamento* della barra multifunzione sulle schede *Pianificazione*, *Tabella* e *Rapporto*.

**Profilo di calcolo all'apertura.** Ogni formato si apre con un profilo di calcolo. Cosa sia, lo spiega [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies). `.xer` si apre con *Primavera P6*, `.mpp` con *Microsoft Project*, e CSV, MS Project XML e P6 XML con *Open Planner Studio*. IFC mantiene il profilo salvato nel file. Per `.xer` e `.mpp` l'app segnala che il progetto calcola in questo modo. Solo IFC contiene il profilo di calcolo e le opzioni di calcolo. Delle opzioni di calcolo, MS Project XML scrive al massimo la soglia critica. Un'esportazione riaperta di un altro formato calcola come *Open Planner Studio*.

## IFC

**Apertura** — sì, `.ifc`. L'app legge IFC4 e IFC 4.3 (anche ADD2). Un file in un altro schema, come IFC2X3, si apre anche. Al primo salvataggio scegli poi uno schema che l'app sa scrivere (vedi [Scegliere lo schema IFC](docs://howto-ifc-schema-kiezen)). Profilo di calcolo: quello nel file.

**Salvataggio** — sì, ed è l'unico formato che si salva. *Salva* scrive l'intero progetto come file IFC, nello schema IFC del progetto (IFC 4.3 ADD2 per impostazione predefinita). Il file diventa la destinazione del salvataggio.

**Esportazione** — sì, come *IFC*, nello schema IFC del progetto (predefinito IFC 4.3 ADD2). Nome predefinito: il nome del progetto con l'estensione `.ifc`. Se il tuo progetto è collegato a una libreria di risorse, la casella *Salva anche il file di libreria* si trova sotto i riquadri in *File › Esporta*. Se è spuntata, l'app chiede dove salvare *projectname-bibliotheek.ifc*, dopo il progetto. La casella non è nell'elenco della scheda *Home*.

**Cosa viene incluso** — tutto ciò che appartiene al progetto: attività con struttura, durata, date e avanzamento; relazioni con ritardo; vincoli e scadenze; calendari; risorse e assegnazioni, inclusa la distribuzione in ore; baseline; codici attività e campi personalizzati; note; relazioni esterne verso altri progetti; interruzioni; tipi di attività e categorie di lavoro personalizzate; le impostazioni del progetto, come la data di stato, la modalità di progresso, il profilo di calcolo e le opzioni di calcolo; il collegamento con una libreria di risorse. Per un progetto da un `.xer` viene incluso anche il file sorgente originale. Una categoria di lavoro personalizzata viene salvata come tipo IFC `USERDEFINED` con il suo nome nel campo ObjectType, così altri programmi IFC leggono l'attività normalmente. L'app conserva anche l'ID fisso della categoria di lavoro, quindi rinominarla non interrompe il collegamento. Se qualcuno apre il file su un altro computer, la categoria di lavoro appare lì sotto *Da questo progetto*, non in *Le mie categorie di lavoro*.

**Cosa non viene incluso** — come hai impostato la schermata (zoom, posizione di scorrimento, attività selezionata, fasi compresse, filtro e raggruppamento scelti) e le impostazioni dell'app ([Impostazioni](docs://ref-instellingen)). La scheda *IFC* è un editor con il testo IFC del tuo progetto. *Genera IFC* lo aggiorna, *Copia* lo mette negli appunti e *Applica* carica il testo come tuo progetto, al posto del progetto in quella scheda.

## MS Project XML (MSPDI)

**Apertura** — sì. L'app riconosce un file `.xml` come MS Project XML dall'elemento radice `Project`, nello spazio dei nomi di MS Project (oppure senza spazio dei nomi). Profilo di calcolo: *Open Planner Studio*. Dopo l'apertura, l'app ti dice in un unico messaggio che cosa non ha importato; vedi [Aprire un file MS Project (.mpp)](docs://howto-mpp-openen).

**Salvataggio** — no. Un progetto così non ottiene una destinazione di salvataggio.

**Esportazione** — sì, come *MS Project XML* (*Apribile in Microsoft Project. Struttura WBS completa.*). Nome predefinito: il nome del progetto con `.xml`.

**Cosa viene incluso** — attività con struttura (livello e WBS), durata, date e avanzamento; relazioni con ritardo, anche in ore o percentuali; vincoli, inclusa la scadenza; calendari, inclusi i calendari di attività e di risorsa; risorse e assegnazioni, inclusa la curva o la distribuzione in ore; la data di stato; la soglia critica, come numero intero di giorni lavorativi di 0 o più, con *Margine totale ≤ soglia*; la descrizione di un'attività (come nota); il tipo di attività di un'attività (come tipo di attività di MS Project); una categoria di lavoro personalizzata, in un campo libero (`ExtendedAttribute`) che l'app legge di nuovo e che MS Project può ignorare. Delle tue baseline viene incluso solo quella attiva, come baseline 0. Un'attività in ore mantiene la sua unità. Un cardine mantiene il suo tipo: inizio, fine o automatico.

**Cosa non viene incluso** — note (la checklist di un'attività), relazioni esterne verso altri progetti, codici attività e campi personalizzati, un secondo vincolo, il contrassegno *Pianificata manualmente*, il ritardo di livellamento, il punto di ripresa e di arresto di un'attività con avanzamento fuori sequenza, le convenzioni *Il lavoro rimanente riprende dopo la durata trascorsa* e *Non spostare le attività non iniziate alla data di stato* di un profilo di MS Project, e le altre opzioni di calcolo. Attività interrotte senza distribuzione in ore vengono incluse senza le interruzioni.

**Festività all'apertura.** Un calendario derivato eredita le eccezioni del suo calendario di base. Un calendario con una propria settimana lavorativa e senza eccezioni non riceve festività. Solo un calendario semplice, senza calendario di base, settimana lavorativa o eccezioni, mantiene le festività olandesi standard. Se mancano festività, la data di fine può essere diversa: vedi [Generare le festività e le ferie edili](docs://howto-feestdagen-genereren).

**Cosa cambia durante il trasferimento** — un vincolo *Deve iniziare il (MSO)* o *Deve finire il (MFO)* senza la scelta *Obbligatorio (logica di blocco)* diventa *Iniziare non prima del (SNET)* o *Finire non prima del (FNET)*. Un hammock diventa un'attività normale con date calcolate. MS Project XML salva le ore al giorno solo per il calendario del progetto. Un altro calendario con proprie ore al giorno riceve, all'apertura del file, il suo orario di lavoro come ore al giorno: 8 ore al giorno con orari di lavoro di 10 ore diventano 10. Un'attività in giorni su un calendario così diventa poi più corta, per esempio 4 giorni invece di 5.

## File MS Project (`.mpp`)

**Apertura** — sì, da MS Project 2010 fino a 2021. Profilo di calcolo: *Microsoft Project*. L'app legge solo il file: non modifica mai il tuo `.mpp`. Un file di MS Project 2007 o precedente, e un file protetto da password, vengono rifiutati con un messaggio che rimanda all'esportazione XML di MS Project. Dopo l'apertura, l'app ti dice in un unico messaggio che cosa non ha importato.

**Salvataggio** — no, e non c'è una destinazione di salvataggio: *Salva* scrive un nuovo file IFC.

**Esportazione** — no.

**Cosa viene incluso** — attività con struttura, durata e vincoli; relazioni con ritardo; calendari; risorse e assegnazioni; avanzamento; un codice WBS che hai compilato tu stesso in MS Project. Anche le date e il margine che MS Project ha calcolato da solo vengono letti, per la vista *Date come registrate*.

**Cosa non viene incluso** — baseline, costi e tariffe, note, collegamenti ipertestuali, i campi personalizzati di MS Project, il collegamento di sottoprogetti e attività esterne, e la soglia critica. Vedi [Aprire un file MS Project (.mpp)](docs://howto-mpp-openen).

**Origine e licenza** — il lettore `.mpp` è stato scritto per Open Planner Studio ed è derivato dal codice sorgente e dalla conoscenza strutturale di MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), una libreria Java con licenza LGPL-2.1. Struttura e costanti dei campi sono state portate in TypeScript. Open Planner Studio stesso è software libero con licenza LGPL-3.0. Il lettore `.xer` non è un derivato: MPXJ è stato consultato solo come fonte di comprensione.

## Primavera P6 XML

**Apertura** — sì. L'app riconosce un file `.xml` come P6 XML dall'elemento radice `APIBusinessObjects`. Profilo di calcolo: *Open Planner Studio*.

**Più progetti in un file.** Ogni progetto con attività si apre nella propria scheda, chiamata *Nome progetto (ID progetto)*. L'app salta un progetto senza attività. La scheda attiva è il progetto con più attività. L'app non trasferisce una relazione verso un altro progetto, né un'attività che non appartiene a nessun progetto. Dopo l'apertura, l'app segnala quanti progetti ha aperto.

**Festività all'apertura.** Valgono le stesse regole di MS Project XML: un calendario con una propria settimana lavorativa e senza eccezioni non riceve festività.

**Baseline.** Un `<BaselineProject>` nel file diventa una baseline del suo progetto. La baseline che P6 contrassegna come attiva è attiva anche nell'app.

**Ritmo di un'assegnazione.** Se resta lavoro da fare, il ritmo rimanente (`RemainingUnitsPerTime`) diventa *Unità/giorno*. Altrimenti è il ritmo pianificato (`PlannedUnitsPerTime`). Per un materiale resta il ritmo pianificato. L'app non ricalcola nulla all'apertura del file. Con un'esportazione in P6 XML scrive il ritmo pianificato come `PlannedUnitsPerTime`. Scrive il ritmo rimanente come `RemainingUnitsPerTime` solo quando l'assegnazione ha un ritmo pianificato separato.

**Nessuna attività leggibile.** Se l'app non trova nessuna attività che può leggere, non apre una scheda. Lo segnala, con la causa se è nota. Esempi: attività senza `ObjectId` oppure nomi di colonne XER in un file XML. Esporta allora di nuovo il progetto da P6 come P6 XML, oppure aprilo come `.xer`.

**Salvataggio** — no.

**Esportazione** — sì, come *Primavera P6 XML* (*Per Oracle Primavera P6.*). Nome predefinito: il nome del progetto con `.xml`, con tra parentesi l'ID progetto se il progetto ne ha uno. Anche un'esportazione MS Project XML riceve lo stesso nome: dai tu stesso nomi diversi.

**Nome progetto e ID progetto.** L'app tiene l'ID progetto di P6 separato dal nome del progetto, come con un `.xer`. *Impostazioni progetto* mostra solo il nome, per esempio *Bid for Facility Extension*. La scheda mostra *Bid for Facility Extension (OZB-05)*. Se rinomini il progetto in *Hall extension*, la scheda si chiama *Hall extension (OZB-05)*. Con un'esportazione in P6 XML l'app scrive di nuovo *OZB-05* come ID progetto e *Hall extension* come nome. Così P6 riconosce il progetto. Anche un progetto da un `.xer` porta con sé il proprio ID progetto. L'ID progetto resta quando salvi il progetto come IFC. Le parentesi nel nome stesso, come in *New build (phase 2)*, restano nel nome. Un progetto senza ID progetto riceve all'esportazione un ID unico proprio dall'app, che inizia con *OPS:*.

**Cosa viene incluso** — struttura WBS e attività con durata, date e avanzamento; relazioni con ritardo; vincoli (anche un secondo, come vincolo flessibile); calendari; risorse e assegnazioni; la data di stato (come `DataDate`); una categoria di lavoro personalizzata, in un campo proprio, `OPS Custom Task Type`, che l'app legge di nuovo e che P6 può ignorare.

**Cosa non viene incluso** — baseline e scadenze; codici attività, campi personalizzati, note e relazioni esterne; le opzioni di calcolo; i nomi delle festività. P6 non ha un nome per ogni giorno libero: dopo la riapertura una festività si chiama *Holiday* e un'eccezione lavorativa si chiama *Working exception*. I giorni liberi consecutivi tornano come un unico intervallo. L'app accorcia un nome o un codice più lungo di quanto P6 permette: il nome di un'attività a 120 caratteri, un ID attività o codice WBS a 40, un nome WBS o di progetto a 100. Segnala quanti nomi e codici ha accorciato. P6 non ha ritardi in percentuale: l'app li converte in un numero fisso di giorni. Un ritardo in giorni di calendario diventa un ritardo in orari di lavoro: 3 giorni di calendario diventano 3 giorni lavorativi. Un hammock diventa un'attività normale, un'attività pianificata manualmente diventa un'attività normale con date calcolate, e un ritardo di livellamento di meno di un giorno viene eliminato.

## File Primavera (`.xer`)

**Apertura** — sì. Profilo di calcolo: *Primavera P6*. L'app legge solo il file: non scrive `.xer` e non cambia mai il tuo file. Apre una scheda per progetto con attività. Un file senza attività o con tabelle danneggiate viene rifiutato con un messaggio.

**Salvataggio** — no, e non c'è una destinazione di salvataggio: *Salva* scrive un nuovo file IFC, con dentro il file `.xer` originale.

**Esportazione** — no. Se esporti un progetto da un `.xer` in CSV, MS Project XML o P6 XML, l'app segnala che le informazioni sorgente XER vanno perse, anche se nel frattempo hai salvato il progetto come IFC. In IFC non si perde nulla.

**Cosa viene incluso** — la struttura WBS e le attività con durata, date, vincoli e avanzamento; relazioni con ritardo; calendari; risorse con assegnazioni; codici attività; campi personalizzati (UDF); note; le impostazioni di pianificazione di P6. Un'attività di tipo *Level of Effort* diventa un hammock. Un progetto di baseline diventa la baseline attiva del progetto che vi fa riferimento. Una relazione tra due progetti viene conservata dall'app come dato sorgente.

**Unità di un'assegnazione.** Se resta lavoro rimanente, l'unità rimanente (`remain_qty_per_hr`) diventa *Unità/giorno*. Altrimenti è l'unità pianificata (`target_qty_per_hr`). Il lavoro pianificato, effettivo e rimanente resta come nel file. Per il materiale resta l'unità pianificata.

**Un sabato o una domenica libera che non è nel file.** Alcune esportazioni da P6 spostano un giorno libero del fine settimana, dentro un gruppo di più giorni liberi, al venerdì prima o al lunedì dopo. Se il calendario lavora il sabato o la domenica, quel giorno diventerebbe per errore un giorno lavorativo. Se l'app vede questo schema in un gruppo di almeno tre giorni liberi, rende comunque libero quel giorno del fine settimana. Nel calendario il giorno si chiama *Eccezione di calendario (ricostruzione del fine settimana)*, e conta nella riga *N riscontri del calendario.* del messaggio. Su un calendario che non lavora nel fine settimana non cambia nulla.

**Margine fino alla fine del progetto, senza data di fine.** È attiva l'opzione P6 per calcolare il margine fino alla fine del progetto, ma il file non ha una data di fine per il progetto e nessuna data di fine pianificata per alcuna attività? Allora l'app disattiva l'opzione *Calcola il margine fino alla data di fine progetto*. Calcola poi le date più tarde a ritroso dalla fine anticipata più recente. Questo conta nella riga *N impostazioni di pianificazione P6 con fallback sicuro.*

**Attività completate sulla data di stato.** Alcuni file non registrano le date effettive di un'attività completata, ma una finestra sulla data di stato. Nella vista *Date come registrate* un'attività del genere appare allora come una barra stretta sulla data di stato. Se il ricalcolo la sposta altrove, rientra nel conteggio delle attività che la barra fornisce. La convenzione *Attività completata nella finestra della data di stato* calcola una finestra del genere. Solo con quella convenzione un'attività completata ottiene un margine reale, tramite l'opzione di calcolo *Attività completata: date più tarde dalla data di stato*. Questa convenzione è un'approssimazione: l'app ha visto questo comportamento solo nell'output di P3, e Primavera non lo conferma da nessuna parte. Per questo è disattivata in ogni profilo integrato, anche sotto *Primavera P6*. Attivala nel blocco *Profilo di calcolo e opzioni*; il progetto riceve allora un profilo personalizzato. Vedi [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies).

**Numeri con la virgola come separatore decimale.** P6 registra il separatore decimale e il separatore delle migliaia nella tabella `CURRTYPE`. L'app legge questi caratteri prima di convertire durate, lavoro e margine. Se queste informazioni mancano, l'app usa il punto come separatore decimale. Se il file contiene ancora numeri con la virgola decimale, l'app non apre nulla. Così una pianificazione con numeri letti in modo errato non si apre mai.

**Cosa non viene incluso** — un progetto senza attività, e una relazione tra due progetti come vera relazione nella tua pianificazione. Vedi [Aprire un file Primavera P6 (.xer)](docs://howto-xer-openen).

## CSV

**Apertura** — sì. L'app legge `;` e `,` come separatore. Riconosce le intestazioni di colonna in inglese e in olandese (per esempio `Name` o `Naam`, `Duration` o `Duur`, `Predecessors` o `Voorgangers`). Le date possono essere *aaaa-mm-gg*, *gg-mm-aaaa* o *gg/mm/aaaa*. Un predecessore lo scrivi come codice WBS, tipo di relazione e ritardo, per esempio `1.2FS+2d`. Profilo di calcolo: *Open Planner Studio*. Il progetto si chiama *CSV Import*. La colonna `Task Type` contiene la categoria di lavoro, non il tipo di attività; l'app legge anche le intestazioni `Werksoort` e `Work category`. Un `Task Type` che non è uno dei codici fissi (come `CONSTRUCTION` o `INSTALLATION`, che l'app scrive da sola) diventa una categoria di lavoro personalizzata sotto *Da questo progetto*, non in *Le mie categorie di lavoro*; con `OPS Custom Task Type ID` viene conservato l'id di una categoria di lavoro personalizzata.

**Salvataggio** — no.

**Esportazione** — sì, come *CSV (;)* (*Esportazione tabella universale. Tutte le attività con date e durate.*), sulla scheda *CSV (separato da punto e virgola)*. Il file usa il punto e virgola come separatore, è in UTF-8 con BOM e ha intestazioni di colonna in inglese.

**Cosa viene incluso** — per attività queste colonne: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` e `Description`. La colonna `Task Type` contiene la categoria di lavoro. Il completamento è in percentuali intere. Un ritardo in ore riceve il segno delle ore della lingua dell'app: `1.2FS+2h` in inglese, `1.2FS+2u` in olandese. All'apertura l'app legge entrambi.

**Cosa non viene incluso** — risorse, assegnazioni, calendari, vincoli, scadenze, baseline e la data di stato. Se le date sono nella vista *Date come registrate*, l'esportazione lascia vuote le colonne `Critical` e `Total Float` per le attività il cui file sorgente non lo registrava.

## Foglio di avanzamento (Excel e CSV)

**Apertura** — sì, tramite *File › Importa* (*Aggiorna l'avanzamento da un foglio*). Oppure tramite il pulsante con quel nome nel gruppo *Avanzamento* della barra multifunzione su *Pianificazione*, *Tabella* e *Rapporto*. L'app legge `.xlsx` e `.csv`, fino a 16 MB e 50.000 righe. Così non apri un progetto: aggiorni l'avanzamento del progetto aperto. Vedi [Importare l'avanzamento da un foglio](docs://howto-voortgang-importeren).

**Salvataggio** — no.

**Esportazione** — sì, come *Foglio di avanzamento (Excel)* (*Avanzamento (Excel)* nell'elenco) e *Foglio di avanzamento (CSV)* (*Avanzamento (CSV)*). Nome predefinito: *projectname-voortgang*. Il pulsante *Esporta foglio di avanzamento* nello stesso gruppo crea il foglio Excel con un clic. Il foglio Excel ha larghezze di colonna fisse, campi bloccati e controllo delle date. Il foglio CSV ha lo stesso contenuto come testo semplice.

**Cosa viene incluso** — le colonne `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` e `Actual Finish`. Quando lo leggi, l'app usa `Completion (%)`, `Actual Start` e `Actual Finish`. `Start` e `Finish` servono solo a riconoscere la notazione della data e non cambiano la tua pianificazione. L'app collega le righe alle attività tramite `OPS Task ID`, oppure tramite un codice WBS unico.

**Cosa non viene incluso** — tutto ciò che sta fuori da queste colonne: durata, relazioni, risorse e il resto della tua pianificazione. Un'attività di riepilogo non riceve avanzamento dal foglio.

## PDF

**Apertura** — no.

**Salvataggio** — no.

**Esportazione** — sì, da un report: nella scheda *Rapporto* il pulsante *Esporta PDF*. L'app non invia un report direttamente a una stampante. Per stampare su carta si usa il PDF. Il contenuto dipende dal tipo di report: vedi [Tipi di report](docs://ref-rapporttypes) e [Creare e stampare un report](docs://howto-rapport-maken-en-afdrukken).

## Vedi anche

- [File e formati](docs://uitleg-bestanden): perché IFC è il formato proprio dell'app e cosa perde un'esportazione, con un esempio.
- [Aprire e salvare un file](docs://howto-bestand-openen-en-opslaan): i passi.
- [Esportare](docs://howto-exporteren): scegliere un formato e i messaggi dopo un'esportazione.
- [Date come registrate](docs://uitleg-datums-zoals-opgeslagen): perché un file aperto può mostrare altre date.
- [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies): i profili di calcolo.
