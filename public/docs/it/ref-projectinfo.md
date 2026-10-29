# Nuovo progetto e Impostazioni progetto

I campi della finestra *Nuovo progetto* e di *Impostazioni progetto*: cosa fa ogni campo, qual è il predefinito e dove ha effetto. Sono due lati dello stesso modulo. *Nuovo progetto* crea un nuovo progetto e ha alcuni campi in più. *Impostazioni progetto* cambia il progetto che hai aperto.

## Apertura

**Nuovo progetto** — *File › Nuovo*, Ctrl+N, oppure il pulsante + a destra delle schede del documento (*Avvia un progetto*, poi *Nuovo progetto*). La finestra si apre con il cursore in *Nome del progetto*.

**Impostazioni progetto** — *Impostazioni › Progetto › Impostazioni progetto* apre il modulo in una finestra con il titolo *Impostazioni progetto*. *File › Impostazioni progetto* mostra lo stesso modulo nella schermata *File*. Il blocco *Profilo di calcolo e opzioni* si trova in fondo in entrambi i casi; cosa contiene è descritto in [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies).

## Crea, Applica e annulla

**Crea** (in *Nuovo progetto*) crea il progetto. Se la scheda corrente è vuota e non modificata, l'app usa quella scheda; altrimenti il progetto si apre in una nuova scheda. **Applica** (in *Impostazioni progetto*) scrive le modifiche nel progetto.

- **Solo con Applica.** Scrivi in una bozza. Il progetto cambia solo quando fai clic su *Applica*. *Applica* scrive solo ciò che hai davvero modificato, in un unico passo in *Annulla*. Se fai clic su *Applica* senza modificare nulla, non succede niente e non si aggiunge nessun passo.
- **Annulla, la X ed Esc** chiudono la finestra senza salvare nulla. Un clic accanto alla finestra non la chiude: quello che hai scritto resta.
- **Invio** fa lo stesso di *Crea* o *Applica*, tranne nel campo *Descrizione* e in un menu a discesa aperto.
- **Nella schermata File** *Impostazioni progetto* mostra in fondo *Modifiche non applicate: fai clic su Applica per conservarle.* finché la bozza è diversa. Se poi esci dalla schermata, l'app chiede se vuoi applicare, scartare o annullare. Vedi [La barra multifunzione, scheda per scheda](docs://ref-lint).
- **Un profilo di calcolo personalizzato senza nome** blocca *Applica* e *Crea*. Dagli un nome oppure scarta la modifica.

## Campi in entrambe le finestre

**Nome del progetto** — il nome del progetto nella barra del titolo, sulla scheda e nel nome del file quando salvi. Predefinito: vuoto. Un campo vuoto è ammesso: il progetto si chiama allora *Nuova pianificazione*, mostrato come testo grigio nel campo. Dove: l'intera schermata.

**Descrizione** — testo libero. Predefinito: vuoto. Effetto: viene salvato con il progetto, nel file IFC e nell'esportazione verso Primavera P6 XML, e non influisce sulla pianificazione.

**Autore** — testo libero. Predefinito: vuoto. Effetto: finisce nel file IFC e compare come *Autore:* nell'intestazione di un report, dove non puoi riscriverlo.

**Libreria di risorse** — a quale libreria di risorse è collegato il progetto. Scegli tra *nessuna (progetto autonomo)*, le tue librerie esistenti e *+ Nuova libreria di risorse…*. Predefinito: in *Nuovo progetto* la libreria predefinita, in *Impostazioni progetto* il collegamento attuale. Effetto: vedi [Usare la libreria di risorse](docs://howto-resourcebibliotheek-gebruiken). Con *+ Nuova libreria di risorse…* scrivi un nome in un campo sotto; la libreria viene creata solo con *Crea* o *Applica*, quindi annullare non lascia niente indietro. Un collegamento in *Impostazioni progetto* cambia solo se modifichi tu questo campo.

**Cliente/organizzazione** — testo libero. Predefinito: vuoto. Effetto: finisce nel file IFC e compare come *Azienda:* nell'intestazione di un report.

**Data di inizio** — l'inizio del progetto. Predefinito: in *Nuovo progetto* oggi. Cosa fa il campo è spiegato sotto, in *Cosa fa la data di inizio*.

**Data di fine** — la fine pianificata del progetto. Predefinito: vuoto. Effetto: un'informazione, non un obbligo: l'app non pianifica verso questa data. Compare nell'intestazione di un report e nelle esportazioni, e stabilisce fino a quale anno vengono generate le festività. Solo per un file Primavera con l'impostazione *Calcola il margine fino alla data di fine progetto* (vedi [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies)) il calcolo del margine arriva fino a questa data.

**Unità predefinita per le nuove attività** — visibile solo quando *Attiva pianificazione oraria* è attivo. Scegli tra *Giorni* e *Ore*. Predefinito: *Giorni*. Effetto e condizioni: vedi [Attivare la pianificazione oraria](docs://howto-urenplanning-aanzetten).

**Profilo di calcolo e opzioni** — in *Impostazioni progetto* l'intero blocco, in *Nuovo progetto* solo il menu a discesa *Profilo di calcolo* con *Primavera P6*, *Microsoft Project* e *Open Planner Studio*. Predefinito: *Open Planner Studio*. Scegliere un profilo imposta anche le opzioni predefinite di quel profilo. Vedi [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies).

## Solo in Impostazioni progetto

**Schema IFC al salvataggio** — quale schema IFC è indicato nell'intestazione del file salvato. Scelta tra *IFC 4.3 ADD2 (predefinito)*, *IFC 4.3* e *IFC4*. Predefinito: *IFC 4.3 ADD2 (predefinito)*; per un file IFC aperto, lo schema di quel file. Effetto: cambia solo l'intestazione del file, non il contenuto. Usalo per unire la pianificazione con un modello di edificio nello stesso schema. Se un file aperto ha un altro schema rispetto al predefinito, l'app chiede la prima volta che salvi se vuoi mantenere quello schema; una scelta qui conta come risposta. Un'altra scelta qui non è un passo in *Annulla*: lo schema appartiene al file. Vedi [Scegliere lo schema IFC](docs://howto-ifc-schema-kiezen).

## Solo nella finestra Nuovo progetto

**Modello di fasi** — quali fasi ha il progetto all'inizio. Scegli tra *Vuoto*, *Edilizia residenziale* e *Edilizia non residenziale / ristrutturazione*. Predefinito: *Vuoto*. Effetto: *Vuoto* crea un progetto senza attività. Le altre due creano otto attività di fase già pronte, ciascuna con una durata di 5 nell'unità predefinita del progetto (5 giorni lavorativi, oppure 5 ore se scegli *Ore* in *Unità predefinita per le nuove attività*) e senza relazioni; le rinomini, sposti ed estendi tu stesso. Per *Edilizia residenziale* sono: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking e Oplevering. Per *Edilizia non residenziale / ristrutturazione*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen e Oplevering. I nomi sono dati del tuo progetto e restano in olandese, anche in un'altra lingua dell'interfaccia. Se *Attiva la modalità cantiere* è disattivato, esiste solo *Vuoto*. Vedi [Impostazioni dell'app](docs://ref-instellingen).

**Turno** — visibile solo quando *Attiva pianificazione oraria* è attivo. Scegli tra *Turno diurno*, *2 turni*, *3 turni* e *24/7*. Predefinito: *Turno diurno*. Effetto: *Turno diurno* lascia il calendario standard com'è, un normale calendario giornaliero da lunedì a venerdì. Le altre tre mettono fasce orarie di lavoro nel calendario del progetto, come i pulsanti con lo stesso nome nella finestra *Calendari*. Gli orari esatti sono descritti in [Impostare gli orari di lavoro](docs://howto-werktijden-instellen). Con *Turno diurno* non puoi scegliere *Ore* in *Unità predefinita per le nuove attività*, perché un calendario giornaliero non ha fasce orarie di lavoro.

**Set di festività** — quali giorni liberi riceve il calendario del progetto. Per *Paese* scegli *Paesi Bassi* (predefinito), *Germania*, *Belgio*, *Francia*, *Regno Unito*, *Austria*, *Svizzera*, *Nessuna festività* o *Personalizzato…*. Se il paese ha regioni, si aggiunge un menu a discesa *Regione*. Per i Paesi Bassi scegli anche, se *Attiva la modalità cantiere* è attivo, le *Ferie edili*: *Nessuna* (predefinito), *Nord*, *Centro* o *Sud*. Sotto c'è una riga come *36 festività, 2025–2029*, che apri per vedere la lista. Gli anni vanno dall'anno prima della data di inizio all'anno dopo la data di fine, oppure fino a tre anni dopo l'anno di inizio se non c'è una data di fine. *Personalizzato…* crea un calendario senza festività e apre subito dopo la creazione la finestra *Calendari*, così puoi compilarle tu stesso. Il calendario del progetto si chiama *Bouwkalender NL*, oppure *Standaardkalender* se *Attiva la modalità cantiere* è disattivato; la scelta è allora anche *Nessuna festività*. Come funziona il generatore è descritto in [Generare festività e ferie edili](docs://howto-feestdagen-genereren).

## Cosa fa la data di inizio

La data di inizio è il punto di partenza del progetto. Tre regole:

- **Le nuove attività iniziano alla data di inizio.** Un'attività che aggiungi riceve come inizio pianificato l'inizio del progetto.
- **Un'attività con predecessore non inizia mai prima della data di inizio.** Se la fine del predecessore è prima, l'attività aspetta fino alla data di inizio. Un'attività *senza* predecessore mantiene la sua data, anche se è prima della data di inizio. Questo serve per mostrare una pianificazione di MS Project o Primavera nel modo in cui la mostra il programma di origine. Un vincolo *Deve iniziare il (MSO)* o *Deve finire il (MFO)* rompe entrambe le regole: un'attività del genere resta sulla sua data, anche se cade prima della data di inizio.
- **Una data di inizio posticipata sposta le attività libere.** Se imposti in *Impostazioni progetto* una data di inizio più tarda e fai clic su *Applica*, le attività senza predecessore e senza un vincolo che fissa un limite inferiore (*iniziare non prima del (SNET)*, *deve iniziare il*, *finire non prima del* o *deve finire il*) che cadrebbero prima della nuova data si spostano a quella data, in un unico passo in *Annulla*. L'app dice quante attività sono spostate. Questo succede solo quando cambi tu la data di inizio, mai quando apri un file. Impostare una data di inizio più tarda non sposta il resto della pianificazione: lo fa *Sposta progetto*, vedi [Spostare un progetto](docs://howto-project-verplaatsen).

## Vedi anche

- [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies): il blocco *Profilo di calcolo e opzioni*.
- [Profili di calcolo e convenzioni](docs://uitleg-rekenprofielen): perché un profilo cambia il risultato.
- [Spostare un progetto](docs://howto-project-verplaatsen): l'intera pianificazione verso un altro inizio.
- [Aggiungere attività e cardini](docs://howto-taken-en-mijlpalen-toevoegen): iniziare con le prime attività.
- [Generare festività e ferie edili](docs://howto-feestdagen-genereren): il set di festività in dettaglio.
- [Scegliere lo schema IFC](docs://howto-ifc-schema-kiezen): salvare per un modello di edificio in IFC4.
