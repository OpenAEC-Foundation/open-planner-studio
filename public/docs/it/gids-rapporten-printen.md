# Report e stampa

Una pianificazione non è finita finché non puoi condividerla — su carta per una riunione di cantiere,
come immagine in una presentazione, o come panoramica di ciò che sta arrivando e cosa è già slittato.
È a questo che serve la scheda **Rapporto**, con tre tipi di report e un'anteprima di stampa.

## Cosa imparerai qui

- I tre tipi di report sulla scheda **Rapporto**: stampa Gantt, panoramica traguardi, variance.
- Come funziona l'anteprima di stampa: formato carta, orientamento e quali elementi attivi/disattivi.
- Come stampare effettivamente un report o salvarlo come file.
- Cosa fa **Ctrl+P** in questa app.

## Arrivare alla schermata del report

Ci sono tre modi per arrivare alla stessa schermata: fai clic sulla scheda della barra multifunzione
**Rapporto**, vai a **Backstage → Stampa** (che apre direttamente la schermata del report), oppure
premi **Ctrl+P**. Tutti e tre portano allo stesso posto — non c'è una finestra di dialogo "stampa"
separata; la schermata del report *è* l'anteprima di stampa.

La schermata è divisa in due colonne: un pannello delle impostazioni a sinistra con il selettore
**Tipo di report** in alto, e un'anteprima dal vivo a destra che si aggiorna immediatamente man mano
che cambi le impostazioni a sinistra.

## I tre tipi di report

### Stampa Gantt

Una stampa completa e formattata delle barre del Gantt — questo è l'unico tipo di report con un blocco
di impostazioni:

- **Carta**: A4, A3 o A1.
- **Orientamento**: orizzontale o verticale.
- **Adatta automaticamente alla pagina** (attivo = la pianificazione si scala automaticamente al
  formato scelto) oppure un cursore manuale di **zoom** se disattivi l'adattamento automatico.
- Interruttori per **nomi attività sulle barre**, **mostra avanzamento**, **percorso critico**,
  **mostra margine**, **dipendenze**, **fine settimana** e **legenda**.
- Un campo **azienda** (auto-compilato dall'impostazione del progetto, ma modificabile separatamente
  qui) e l'**autore** (sola lettura, dalle info del progetto).

Il blocco di riepilogo sopra mostra il conteggio dal vivo di attività, attività foglia, attività
critiche e relazioni nel progetto.

### Panoramica attività cardine

Una tabella di ogni traguardo nel progetto: WBS, nome, tipo (automatico/inizio/fine), data, il vincolo
o la scadenza sottostante, margine, se il traguardo è obbligatorio, e stato (nei tempi / critico / in
ritardo). Il blocco di riepilogo mostra il conteggio totale dei traguardi, quanti sono obbligatori e
quanti sono in ritardo. Questo report non ha impostazioni di formato carta/orientamento — stampa la
tabella esattamente come mostrata.

### Variance

Confronta la pianificazione attuale con la baseline attiva: inizio/fine baseline rispetto a
inizio/fine attuali, la differenza in giorni lavorativi per inizio e fine, e uno stato per attività
(nei tempi / in ritardo / in anticipo / nuova / eliminata). Se non c'è una baseline attiva, la
schermata lo dichiara esplicitamente invece di mostrare un report vuoto. Il blocco di riepilogo mostra
anche lo spostamento della data di fine del progetto in giorni lavorativi, se presente. Vedi la guida
[Baseline e avanzamento](docs://gids-baselines-voortgang) per come registrare una baseline prima che
questo report possa dirti qualcosa di utile.

## Stampare ed esportare

Il pannello delle impostazioni ha sempre un pulsante **Stampa...** in fondo — apre una finestra di
stampa separata contenente il report e attiva immediatamente la finestra di dialogo di stampa del
browser/sistema operativo. Per il report Gantt, quella finestra usa il formato carta e l'orientamento
scelti; i report traguardi e variance stampano la tabella come visualizzata.

Solo il report Gantt ha anche un pulsante **Esporta PDF**. Questo salva l'anteprima attuale come vero
e proprio file PDF (nome file terminante in `-planning.pdf`) — una pagina dimensionata alle dimensioni
fisiche del formato carta e dell'orientamento scelti. Il file PDF è **vettoriale**: barre, linee e
testo sono memorizzati come istruzioni di disegno PDF anziché come singola immagine incorporata, così
resta nitido a qualsiasi livello di zoom e il testo è selezionabile e ricercabile in qualsiasi lettore
PDF. Questo vale per il testo latino, cirillico e greco; se il progetto contiene testo cinese,
giapponese, coreano, arabo o persiano, l'esportazione ricade automaticamente su un'immagine raster per
quel testo — comunque visualizzata correttamente, ma non selezionabile o ricercabile. Comodo per
l'email o l'archiviazione senza passare per la finestra di dialogo di stampa di sistema. Se preferisci
stampare direttamente (o salvare in PDF tramite la finestra di dialogo di sistema, ad esempio per
scegliere un formato carta diverso da quello configurato sopra), usa **Stampa...**.

## I report in pratica

Ogni tipo di report serve una conversazione diversa:

- Il **report Gantt** è il classico volantino per la riunione di cantiere: il percorso critico
  evidenziato, il margine visibile sulle barre non critiche, e la legenda che spiega cosa significa
  ogni colore. Attiva **nomi attività sulle barre** e **mostra avanzamento** se il pubblico non
  conosce già la pianificazione; disattivali per una panoramica pulita su A1 se viene distribuito
  separatamente un elenco delle attività.
- La **panoramica delle attività cardine** è per chi vuole solo le date importanti senza sfogliare
  decine di righe di attività — ad esempio un cliente che vuole principalmente sapere se le date di
  consegna obbligatorie vengono rispettate. Il simbolo ◆ prima di un nome di traguardo nella tabella
  contrassegna un traguardo **obbligatorio**.
- Il **rapporto Variance** è la conversazione sulla correzione della rotta: quali attività stanno
  slittando rispetto alla baseline, e di quanti giorni lavorativi. Vedi questo report in pratica
  nell'esempio [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc),
  che ha due baseline (una baseline contrattuale e una ri-baseline dopo un ordine di modifica) con il
  proprio progresso e la propria data di stato — un buon esempio di come le colonne Δ si compilano una
  volta che c'è una differenza effettiva tra la baseline e la pianificazione attuale.

L'anteprima dal vivo a destra si aggiorna a ogni modifica delle impostazioni a sinistra — non c'è un
pulsante "aggiorna" separato, e nulla viene calcolato solo al momento della stampa.

## Per saperne di più

- Un rapporto Variance non ha nulla da confrontare finché non è stata registrata una baseline — leggi
  la guida [Baseline e avanzamento](docs://gids-baselines-voortgang).
- Il percorso critico e il margine mostrati nel report Gantt provengono dallo stesso calcolo della
  vista Gantt stessa — leggi la guida [Percorso critico e analisi avanzata](docs://gids-kritiek-pad-analyse)
  per come leggerlo.
