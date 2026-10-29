# Esportare

Obiettivo: consegnare la tua pianificazione come file in un altro formato, per qualcuno che non legge IFC o per un altro programma.

## Quando ti serve

Il consulente lavora in MS Project, il cliente in Primavera, il subappaltatore vuole le attività in Excel, oppure tu invii una pianificazione a un programma che non sa gestire IFC. Un'esportazione è una copia in un altro formato. Se vuoi conservare il tuo progetto stesso, salvalo: così scrivi IFC e tutto viene portato con sé. Che cosa porta e che cosa non porta ogni formato è spiegato in [File e formati](docs://uitleg-bestanden).

## Passaggi

1. Scegli *Home › File › Esporta* e scegli un formato dall'elenco, oppure scegli *File › Esporta*. Lì ogni formato è un riquadro con una breve descrizione.
2. Nella finestra scegli un nome e una posizione. L'app propone il nome del progetto, con l'estensione del formato. I fogli di avanzamento si chiamano *nomeprogetto-avanzamento* e si aprono, dove possibile, nella cartella dei download.
3. Conferma. Non appare nessun messaggio se l'esportazione riesce, a parte i messaggi qui sotto. Da *File › Esporta* torni dopo alla scheda *Home*, anche se annulli la finestra. Se annulli la finestra per un'esportazione dall'elenco nella scheda *Home*, non succede nulla.

Se il tuo browser salva solo tramite un download (come Firefox), il file è nella cartella dei download subito dopo il passaggio 1. Vedi il messaggio *Salvato come download: 'name.xml' si trova ora nella cartella dei download. Questo ambiente non consente all'applicazione di scrivere direttamente nella posizione scelta.*

### Quale formato scegli?

L'elenco nella scheda *Home* e i riquadri in *File › Esporta* offrono gli stessi formati:

- *Avanzamento (Excel)* e *Avanzamento (CSV)*, sui riquadri *Foglio di avanzamento (Excel)* e *Foglio di avanzamento (CSV)*: un foglio snello con id, WBS, nome, date e completamento, da inviare a chi inserisce l'avanzamento.
- *CSV (;)*, sul riquadro *CSV (separato da punto e virgola)*: un elenco di attività che apri in un foglio di calcolo.
- *MS Project XML*: si può aprire in Microsoft Project.
- *Primavera P6 XML*: per Oracle Primavera P6.
- *IFC*: il formato proprio dell'app, con tutto dentro, nello schema IFC del progetto (predefinito IFC 4.3 ADD2).

### Un'esportazione IFC con un file di libreria

Se il tuo progetto è collegato a una libreria di risorse, la casella *Salva anche il file di libreria* si trova sotto i riquadri in *File › Esporta*. Se la spunti e scegli *IFC*, l'app chiede due volte una posizione: prima per il progetto, poi per *nomeprogetto-biblioteca.ifc*. Questa casella è solo in *File › Esporta*, non nell'elenco nella scheda *Home*.

### Ripristinare un foglio di avanzamento

Importa un foglio di avanzamento compilato tramite *File › Importa*. Vedi [Importare l'avanzamento da un foglio di calcolo](docs://howto-voortgang-importeren).

## Insidie e che cosa fa l'app in quel caso

**Il tuo progetto non cambia.** Il file del tuo progetto resta uguale e l'indicazione *Non salvato* resta, se c'era.

**Una pianificazione non aggiornata si ricalcola prima.** Così ottieni le date attuali, anche se hai dimenticato di premere *Calcola*.

**Anche un'esportazione compare in Recenti.** Questo non vale per i fogli di avanzamento. Se apri un'esportazione da lì, si apre come importazione di quel formato.

**Un'esportazione non porta tutto.** Un file CSV non ha risorse né vincoli, il XML di P6 non ha baseline né scadenze. Anche il profilo di calcolo non viene portato: un'esportazione riaperta viene calcolata come *Open Planner Studio*. Solo IFC porta tutto. Un esempio con numeri si trova in [File e formati](docs://uitleg-bestanden).

**Due formati con la stessa estensione.** MS Project XML e Primavera P6 XML ricevono entrambi il nome *nomeprogetto.xml*. Dai tu stesso nomi diversi, altrimenti dopo non saprai quale file è quale formato.

**Una pianificazione con una relazione circolare non viene esportata.** L'app calcola prima e si ferma se c'è un ciclo. Nella scheda *Home* ottieni il messaggio *Impossibile calcolare la programmazione*; sotto di esso, ad esempio, c'è *Dipendenza circolare tra attività: Set up site → Demolish existing extension → Set up site*. In *File › Esporta* è visibile solo il secondo testo. Risolvi il ciclo ed esporta di nuovo.

**Un progetto da Primavera perde informazioni di origine.** Se esporti un progetto così in CSV, MS Project XML o P6 XML, l'app mostra: *L’esportazione in CSV perde informazioni di origine XER.* Per MS Project XML dice *MSPDI*, per P6 XML *P6*. Vedi [Aprire un file Primavera P6 (.xer)](docs://howto-xer-openen).

**Le attività in modalità divisione perdono le loro divisioni.** MS Project e Primavera conoscono una divisione solo come distribuzione delle ore. Se il tuo progetto contiene attività in modalità divisione senza distribuzione delle ore, l'app mostra dopo un'esportazione in MS Project XML o P6 XML: *2 attività con interruzioni sono state esportate senza le loro interruzioni: MS Project/P6 le conoscono solo come distribuzione del lavoro.* Per una sola attività dice *1 attività con interruzioni è stata esportata senza le sue interruzioni: MS Project/P6 le conoscono solo come distribuzione del lavoro.* Vedi [Dividere un'attività](docs://howto-taak-splitsen).

**Una pianificazione nella vista *Date come registrate*.** Se esporti in CSV mentre vedi le date del file di origine, l'app lascia vuoti `Critical` e `Total Float` per le attività per cui il file di origine non ha registrato questo dato. Vedi [Date come registrate](docs://uitleg-datums-zoals-opgeslagen).

## Vedi anche

- [File e formati](docs://uitleg-bestanden): che cosa porta ogni formato e che cosa no.
- [Aprire e salvare un file](docs://howto-bestand-openen-en-opslaan): conservare il tuo progetto stesso come IFC.
- [Importare l'avanzamento da un foglio di calcolo](docs://howto-voortgang-importeren): leggere un foglio di avanzamento compilato.
- [Formati di importazione ed esportazione](docs://ref-import-exportformaten): per formato che cosa viene portato e che cosa no.
