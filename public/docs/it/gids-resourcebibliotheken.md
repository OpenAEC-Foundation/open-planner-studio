# Librerie di risorse

Se lavori a più progetti con le stesse squadre, gli stessi subappaltatori e gli stessi calendari, non vuoi mantenere tariffa, calendario e tipo separatamente in ogni progetto — reinserendoli ogni volta e rincorrendo ogni copia quando qualcosa cambia. È per questo che esiste una libreria di risorse: una fonte condivisa di risorse e calendari che appartiene alla tua organizzazione, vive al di fuori dei singoli progetti, e da cui più progetti possono attingere. Questa guida spiega come la libreria si relaziona a un progetto, cosa viaggia esattamente insieme e cosa resta per progetto, e come passi dall'una all'altro.

## Cosa imparerai qui

- La distinzione tra la libreria (condivisa, a livello di organizzazione) e il progetto (ciò che questo progetto usa davvero).
- Collegare un progetto a una libreria, oppure lasciarlo deliberatamente autonomo.
- Le due viste sulla scheda Risorse: **Libreria** e **Progetto**.
- I tre tipi di righe che incontri nella vista di progetto: dalla libreria, esclusive del progetto e orfane.
- Cosa porta esattamente nel progetto una risorsa di libreria, e cosa imposti liberamente per progetto.
- Le tre azioni che collegano libreria e progetto.
- Come l'app aggiorna le copie, e cosa puoi decidere quando una copia si è discostata.
- Condivisione, backup e i loro limiti.

Segui insieme a [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) e [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc): aprendo l'uno o l'altro showcase si collega automaticamente a un'unica libreria di risorse demo condivisa, e le squadre **Timmerlieden**, **Installateurs**, **Stukadoors** e **Schilders** ricompaiono con lo stesso identico nome in entrambi — la prova diretta che una libreria alimenta più progetti.

## Libreria e progetto: due mondi

La **libreria di risorse** è la fonte condivisa: appartiene alla tua organizzazione, non a un singolo progetto, e sopravvive a ogni singolo progetto. Il **progetto** decide cosa questo specifico progetto mette effettivamente al lavoro da essa — con la propria capacità, disponibilità e scelta del calendario. Un progetto si collega a esattamente una libreria, oppure resta completamente autonomo: in quel caso tutto funziona semplicemente come al solito, solo senza una fonte condivisa da cui attingere o su cui riscrivere.

## Collegare un progetto a una libreria

Scegli la libreria in due punti, che mostrano lo stesso pannello:

- La **procedura guidata del nuovo progetto** ("Nuovo progetto"), con un selettore di libreria.
- **Info progetto** per un progetto esistente — sia la finestra di dialogo sia **File → Info progetto**.

Quello stesso selettore ha anche **+ Nuova libreria di risorse…**, che ti permette di crearne una al volo senza dover prima passare da File → Libreria. **Nessuna (progetto autonomo)** è una scelta esplicita nella stessa lista — scollegare il tuo progetto non è mai un effetto collaterale accidentale, è sempre qualcosa che scegli deliberatamente.

## La scheda Risorse: due viste

Non appena un progetto è collegato a una libreria, la scheda Risorse ottiene in alto a destra un selettore con due viste:

- **Libreria** — gestisci la fonte stessa. Qui tutto è direttamente modificabile, una modifica si applica immediatamente a **tutti** i progetti che attingono da questa libreria, e resta fuori dall'annullamento (Ctrl+Z) — non è una modifica di progetto.
- **Progetto** — ciò che questo progetto usa effettivamente: la normale tabella di progetto, con contrassegni per riga per la provenienza ed eventuali scostamenti.

Se lavori con più progetti aperti che attingono tutti dalla stessa libreria, esiste anche una terza vista: **Occupazione**. Mostra, per ogni risorsa di libreria, dove è impegnata attraverso *tutti* i documenti aperti, e segnala i giorni in cui la somma di quegli impegni supera la capacità dell'azienda — la doppia prenotazione tra progetti, che nessun progetto può vedere da solo. Leggi la guida [Panoramica dell'occupazione](docs://gids-bezettingsoverzicht).

## Tre tipi di righe nella vista di progetto

Nella vista di progetto incontri tre tipi di righe:

1. **Dalla libreria** — riconoscibile dal contrassegno **Dalla libreria**. Nome, tipo, tariffa/ora e unità sono ereditati dalla libreria e qui mostrati come testo semplice: non li modifichi qui, ma nella vista **Libreria**. Unità max., la disponibilità scaglionata nel tempo e la scelta del calendario sono invece pienamente modificabili — è esattamente l'impegno proprio di questo progetto.
2. **Esclusiva del progetto** — nessun contrassegno, pienamente modificabile. Anche un progetto collegato può avere righe di questo tipo: utili per elementi occasionali che non appartengono alla libreria condivisa, come una gru a noleggio o un subappaltatore assunto per questo unico lavoro.
3. **Orfana** — l'originale in libreria non c'è più; la riga è contrassegnata come **non più nella libreria**. La copia in sé continua a funzionare normalmente — puoi scollegarla o eliminarla.

## Cosa segue la libreria — e cosa no

Questa è la parte da ricordare: alcuni campi sono un accordo a livello aziendale e seguono la libreria, altri sono l'impegno proprio di questo progetto e li imposti liberamente, senza che ciò conti mai come uno scostamento.

**Segue la libreria:**
- Nome
- Tipo
- Descrizione
- Tariffa/ora
- Unità
- Il **contenuto** di un calendario che ha viaggiato insieme a una risorsa (giorni lavorativi, orari, festività)

**Decidi per progetto, senza che conti come scostamento:**
- Unità max.
- La disponibilità scaglionata nel tempo
- La **scelta** di quale calendario è collegato alla risorsa

Assegni una risorsa di libreria, e il suo calendario viaggia insieme come copia collegata che a sua volta continua a seguire la libreria — per questo il *contenuto* di quel calendario si trova qui sopra sotto **Segue la libreria**. Ma la *scelta* di quale calendario è collegato a una risorsa si trova sotto **Decidi per progetto**: la stessa squadra può benissimo usare un calendario diverso per un lavoro urgente rispetto al solito, senza che ciò sia uno scostamento dalla libreria. Questa distinzione è sottile ma importante: cambi la tariffa o il nome di una risorsa di libreria, e la copia si discosta dalla libreria; cambi la scelta del calendario o le unità max., e stai facendo esattamente ciò per cui quel campo esiste.

## Tre azioni che collegano i due mondi

- **Assegna al progetto** — dalla libreria al progetto: crea una copia modificabile con provenienza.
- **Nella libreria** — da una riga esclusiva del progetto verso la libreria condivisa: la collega immediatamente. Se nella libreria esiste già un elemento con lo stesso nome, l'app si collega a quello invece di duplicarlo.
- **Scollega dalla libreria** — la provenienza scompare, tutto torna pienamente modificabile. Un calendario che aveva viaggiato insieme si scollega con essa, a meno che un'altra risorsa ancora collegata non usi lo stesso calendario.

## Aggiornamento e scostamenti

L'app verifica in quattro momenti fissi se le tue copie corrispondono ancora alla libreria: quando **apri** un file, quando **cambi** documento, dopo una **modifica nella libreria**, e dopo un **ripristino da arresto anomalo**.

- Se una copia è semplicemente rimasta indietro (non l'hai modificata tu stesso, ma la libreria nel frattempo sì), viene **aggiornata silenziosamente** — vedrai solo un breve avviso, nessuna domanda.
- Se una copia è stata modificata localmente (o da qualcun altro), compare il contrassegno **differisce — decidi**, e l'app chiede per ogni elemento cosa fare: **Usa i valori della libreria**, **Adotta i valori del file nella libreria**, oppure **Decidi più tardi**.

Queste scelte non si possono annullare con Ctrl+Z — la seconda opzione modifica infatti la libreria stessa, che resta fuori dalla cronologia di annullamento del progetto.

## Condivisione e backup

Un file di progetto è sempre autonomo e completo: lo dai a qualcuno senza la tua libreria, e tutto funziona comunque, solo senza una fonte condivisa. Una libreria la esporti e la importi tramite **File → Libreria** — che è anche il tuo backup.

Quando importi, scegli tra due opzioni:

- **Aggiungi come nuova libreria di risorse** — la libreria contenuta nel file viene semplicemente aggiunta, come libreria extra accanto alle tue esistenti, e non sovrascrive mai nulla di tuo. Se il mittente aveva già a sua volta separato una seconda libreria propria (ad esempio per un subappaltatore distinto), quella libreria porta con sé una propria identità: un progetto inviato insieme a essa riconosce subito di nuovo come elementi di libreria le squadre e i calendari che già usava, senza che tu debba sistemare nulla. Se il mittente aveva un'unica libreria, mai separata — la situazione più comune per la maggior parte delle persone — quel riconoscimento automatico non scatta: colleghi tu stesso, una sola volta, il progetto ricevuto alla nuova libreria, dopodiché il riconoscimento per nome fa il resto del lavoro. Se hai già esattamente quella libreria, viene aggiunta come copia separata accanto ad essa.
- **Sostituisci una libreria di risorse esistente** — l'intero contenuto della libreria che scegli viene sovrascritto con quanto si trova nel file. Se la tua versione è più recente di quella che stai importando, l'app te lo segnala prima con un avviso.

Quale opzione è già selezionata dipende dal file: se l'app non riconosce ancora la libreria, è selezionata "Aggiungi come nuova libreria di risorse"; se la riconosce (la stessa libreria, una versione diversa), è selezionata "Sostituisci una libreria di risorse esistente" con quella libreria già scelta.

Le librerie non si sincronizzano da sole tra macchine diverse: se due pianificatori lavorano con la stessa libreria su computer diversi, le librerie possono divergere.

## Libreria di risorse demo negli esempi

Apri uno degli esempi showcase (**File → Esempi**, oppure da questo pannello Guida), e l'app crea una volta sola una **Libreria di risorse demo** e collega l'esempio aperto a essa. [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) e [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) condividono le stesse squadre di quella libreria, così vedi subito come una libreria alimenti più progetti. Le tue librerie di risorse esistenti restano completamente intatte.

## Continua a leggere

- Assegnare risorse, leggere l'istogramma e livellare riguardano tutti il lato di progetto delle risorse — leggi la guida [Risorse, istogramma e livellamento](docs://gids-resources-histogram).
- Il calendario collegato a una risorsa usa gli stessi elementi costitutivi di qualsiasi altro calendario — leggi la guida [Calendari e pianificazione oraria](docs://gids-kalenders-uren).
- Vedi tu stesso le squadre condivise tra progetti in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) e [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
