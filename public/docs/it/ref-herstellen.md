# Ripristino dopo un arresto anomalo

L'app desktop conserva automaticamente snapshot di ripristino del tuo lavoro. Se l'app si chiude inaspettatamente (arresto anomalo, interruzione di corrente), all'avvio successivo offre di recuperare quel lavoro.

## Come funziona il salvataggio automatico

- Poco dopo ogni modifica (meno di un secondo) l'app scrive uno snapshot per ogni documento aperto nella propria cartella dati — per tutte le schede aperte, comprese quelle mai salvate.
- Questo non sostituisce il salvataggio: il file di progetto vero e proprio non cambia. Continua quindi a salvare il tuo lavoro con Ctrl+S.
- Gli snapshot vengono ripuliti non appena fai una scelta nella finestra di ripristino (**Ripristina** o **Non ripristinare**).
- **Solo app desktop.** La versione browser non ha salvataggio automatico né ripristino — lì salva regolarmente tu stesso.

## La finestra "Ripristina lavoro non salvato"

Compare all'avvio quando vengono trovati degli snapshot: "Open Planner Studio non si è chiuso normalmente. I seguenti documenti presentavano modifiche non salvate che possono essere ripristinate:" Per ogni documento mostra:

- il **nome** (nome file o nome progetto; senza nome: "Progetto senza titolo");
- il **percorso del file**, se il documento è mai stato salvato;
- il **numero di attività** nello snapshot;
- **Salvato** — l'orario dell'ultimo snapshot.

## Le scelte

- **Ripristina** (o **Invio**) — tutti i documenti elencati ritornano come schede aperte. Contano quindi come non salvati: salvali tu stesso.
- **Non ripristinare** — gli snapshot vengono scartati; inizi con un progetto vuoto.
- **Crocetta di chiusura**, **Esc** o un clic fuori dalla finestra — rimanda la scelta in sicurezza: nulla viene scartato e nulla viene ripristinato; la domanda ricompare al prossimo avvio.

## Per saperne di più

- [Avvio rapido](docs://quick-start) — salvare e aprire progetti.
