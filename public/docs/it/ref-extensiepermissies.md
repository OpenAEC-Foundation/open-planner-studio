# Permessi delle estensioni

Ogni permesso che un'estensione può elencare nel suo manifest: che cosa consente, che cosa succede quando manca e che cosa vedi quando installi un'estensione. Come installare e gestire le estensioni è descritto in [Installare e gestire un'estensione](docs://howto-extensie-installeren).

## Che cos'è un permesso e che cosa non è

Un permesso è una **dichiarazione dell'autore**: indica quali parti dell'interfaccia dell'app l'estensione vuole usare. Non è una barriera. Il codice di un'estensione viene eseguito nello stesso ambiente dell'app e può quindi fare più di quanto dicono i suoi permessi: non c'è una sandbox. Anche l'app lo dice nella finestra di installazione. Installa solo estensioni di autori di cui ti fidi.

L'app applica un permesso in uno di tre modi, e la differenza è importante:

**Applicazione rigida.** Se il permesso manca, il metodo corrispondente genera un errore (in italiano, per esempio *Estensione «…» non ha il permesso: ribbon*) prima che succeda qualcosa.

**Avviso.** Se il permesso manca, il metodo funziona comunque, ma l'app scrive un avviso nel registro. In una versione futura diventa un rifiuto.

**Solo informativo.** Al permesso non è collegata nessuna parte dell'interfaccia. L'app lo mostra al momento dell'installazione e non ne fa altro.

Ciò che non richiede alcun permesso è la base dell'interfaccia delle estensioni: leggere il progetto, il calendario, le attività, le relazioni, le risorse e le assegnazioni; aggiungere attività e relazioni e modificare le attività; caricare un progetto, ricalcolare e raggruppare più modifiche; conservare le proprie impostazioni, leggere i file inclusi nell'estensione e mostrare una notifica.

**Il manifest.** I permessi sono nel manifest come elenco. Un'estensione che installi ora, con un permesso che questa versione dell'app non conosce, viene rifiutata. Per un'estensione più vecchia già salvata, l'app elimina i permessi sconosciuti e lo segnala nel registro.

## Come chiede l'app

Quando installi, dal catalogo (*File › Estensioni › Sfoglia › Installa*) o da un file (*ZIP* o *JS*), l'app mostra la finestra *Installare l'estensione?*. La domanda compare una sola volta, al momento dell'installazione: non ogni volta che attivi l'estensione.

La finestra mostra il nome, la versione, la descrizione, l'autore e, se c'è, il repository. Sotto *Provenienza* indica da dove viene l'estensione (*Dal catalogo estensioni online*, *Da un file ZIP su questo computer* o *Da un file JavaScript su questo computer*) e se il download è verificato: sì, con il checksum del catalogo; no, perché il catalogo non ne fornisce uno; oppure un file che hai scelto tu stesso. Sotto *A cosa stai dicendo di sì* indica che un'estensione è codice di programma che viene eseguito con gli stessi diritti dell'app, e che cosa significa in pratica: nell'app desktop, tra l'altro, leggere e scrivere file in qualsiasi punto della tua cartella utente, e accedere ai tuoi progetti, alle impostazioni e agli appunti; nel browser, accedere ai progetti e alle impostazioni salvati, ai file a cui hai concesso l'accesso e alla rete.

Sotto *Ciò che questa estensione dichiara di usare* trovi i permessi del manifest, come brevi etichette con il nome del permesso. Dice: *È la dichiarazione dell'autore, non una restrizione: il codice può comunque fare di più.* Se l'estensione non ha permessi, dice *Nulla di dichiarato*. Due permessi hanno una spiegazione: *importSource* e *help*. Gli altri sei hanno solo la loro etichetta.

Con *Installa* accetti. *Non installare*, Esc e un clic fuori dalla finestra rifiutano l'installazione.

## I permessi

**ribbon** — inserire un pulsante nella barra multifunzione. Effetto: l'estensione può aggiungere un pulsante a un gruppo su una scheda della barra multifunzione. Un'estensione senza questo permesso riceve un errore quando ci prova. I pulsanti compaiono alla fine della scheda scelta, sotto un'etichetta di gruppo dell'estensione, e scompaiono quando disattivi o rimuovi l'estensione. Predefinito: non concesso; solo ciò che è nel manifest. Applicazione: rigida. Dove: sulla scheda scelta dall'estensione.

**events** — seguire gli eventi dell'app e inviare eventi da sé. Effetto: l'estensione può iscriversi agli eventi e annullare l'iscrizione, e inviare eventi da sé. L'app stessa ne invia quattro: un progetto viene caricato (dopo un'importazione, un'apertura o un caricamento da parte di un'estensione), viene creato un progetto vuoto, la pianificazione viene (ri)calcolata e l'utente chiede un tutorial. Quest'ultimo va solo all'estensione tutorial. Predefinito: non concesso; solo ciò che è nel manifest. Applicazione: rigida. Dove: in nessun punto; l'estensione reagisce all'evento.

**backstage** — offrire un formato di importazione. Effetto: l'estensione può registrare un importatore; compare in *File › Importa*, dove fai clic su un formato e scegli un file. I formati integrati sono separati da questo (vedi [Formati di importazione ed esportazione](docs://ref-import-exportformaten)). Predefinito: non concesso; solo ciò che è nel manifest. Applicazione: avviso. Se il permesso manca, la registrazione funziona comunque, con un avviso nel registro. È una soluzione transitoria, perché le estensioni esistenti non sempre elencano il permesso. Dove: *File › Importa*.

**pdf-fonts** — fornire un font per l'esportazione PDF. Effetto: l'estensione può registrare un fornitore di font. L'esportazione PDF lo usa per i caratteri che i font integrati non coprono, come i caratteri cinesi, giapponesi e coreani. Predefinito: non concesso; solo ciò che è nel manifest. Applicazione: rigida. Dove: nel PDF di un report; nella finestra di installazione c'è solo l'etichetta.

**importSource** — leggere i byte originali di un file importato. Effetto: l'estensione può chiedere il contenuto completo del file sorgente di un progetto importato (per ora: un file Primavera), compresi i campi che l'app non porta di proposito nel tuo progetto, come i campi di audit e di provenienza, i costi, i campi di revisione e di posizione. Questo è molto più ampio del resto dell'interfaccia, ed è quindi un permesso a sé. Senza il permesso l'app non legge nemmeno un byte del file sorgente: ogni metodo genera allora un errore prima di leggere qualcosa. Predefinito: non concesso; solo ciò che è nel manifest. Applicazione: rigida, rifiutato per impostazione predefinita. Dove: nella finestra di installazione c'è una spiegazione: *importSource — i byte di origine completi di ogni file importato (ad esempio un file Primavera grezzo), compresi i campi che non arrivano mai nel progetto.*

**help** — aggiungere articoli della Guida e indicazioni. Effetto: l'estensione può registrare e ritirare articoli della Guida (tutorial), aprire un file `.ifc` incluso come nuovo documento e avviare e fermare una guida che indica parti dell'app. Un progetto incluso non sovrascrive mai il documento su cui stai lavorando: si apre come nuovo documento, oppure sostituisce solo una scheda vuota e non modificata. Dalla versione 1.4.0 del contratto. Predefinito: non concesso; solo ciò che è nel manifest. Applicazione: rigida. Dove: nella finestra *Guida* (gli articoli), come nuova scheda (il progetto) e come guida che indica pulsanti. Nella finestra di installazione c'è una spiegazione: *help — può aggiungere articoli della Guida, aprire progetti inclusi come nuovo documento e mostrare una guida che indica parti dell’app.*

**filesystem** — l'estensione dichiara di usare file. Effetto: nessuno; a questo permesso non è collegata nessuna parte dell'interfaccia e l'app non può applicarlo. Predefinito: non concesso; solo ciò che è nel manifest. Applicazione: solo informativo. Dove: come etichetta nella finestra di installazione.

**network** — l'estensione dichiara di usare la rete. Effetto: nessuno; come *filesystem*. Predefinito: non concesso; solo ciò che è nel manifest. Applicazione: solo informativo. Dove: come etichetta nella finestra di installazione.

## Vedi anche

- [Formati di importazione ed esportazione](docs://ref-import-exportformaten): i formati che l'app conosce da sola, accanto a quelli che le estensioni aggiungono sotto *File › Importa*.
- [Installare e gestire un'estensione](docs://howto-extensie-installeren): installare, disattivare e rimuovere un'estensione.
