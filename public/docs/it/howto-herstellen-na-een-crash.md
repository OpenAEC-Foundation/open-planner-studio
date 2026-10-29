# Recupero dopo un arresto anomalo

Obiettivo: ripristinare il tuo lavoro dopo che l'app o il browser si sono fermati in modo imprevisto e tu non avevi salvato.

## Quando ti serve

Il portatile si è spento, l'app si è bloccata oppure la scheda del browser si è chiusa in modo anomalo, e non avevi ancora salvato le ultime modifiche. Appena c'è una modifica, l'app conserva in background copie di recupero di tutti i progetti aperti, al massimo una volta ogni dieci secondi. Questa copia è separata dal file di progetto. La differenza con il salvataggio e con il salvataggio automatico è spiegata in [File e formati](docs://uitleg-bestanden).

## Passaggi

1. Avvia di nuovo l'app. Nel browser ricarichi la stessa scheda: la copia di recupero appartiene a quella sola scheda.
2. Se l'app ha trovato delle copie, appare la finestra *Ripristina lavoro non salvato*: *Open Planner Studio non si è chiuso normalmente. I seguenti documenti presentavano modifiche non salvate che possono essere ripristinate:* Per ogni progetto mostra il nome, il percorso del file se il progetto ha un file (nel browser solo il nome del file), il numero di attività e l'ora della copia, per esempio *21 attività* e *Salvato: 29 set 2026, 9:41*. L'ora segue l'impostazione *Formato dell'ora*. La finestra può mostrare anche progetti che non hai modificato.
3. Scegli *Ripristina*. L'app apre tutti i progetti nell'elenco, ciascuno in una scheda, con lo stato dell'ultima copia. Invio fa lo stesso.
4. Controlla i progetti e salvali subito con Ctrl+S.

Se non vuoi ripristinare, hai due possibilità. *Non ripristinare* elimina le copie, e questo non si può annullare. Se chiudi la finestra con Esc, con la X o facendo clic accanto alla finestra, le copie restano e l'app lo chiede di nuovo al prossimo avvio.

Il punto interrogativo in alto a destra della finestra apre questo articolo senza fare una scelta. Mentre leggi nella Guida, la finestra attende. Quando torni indietro, la finestra è di nuovo lì e puoi ancora ripristinare.

## Problemi possibili e cosa fa l'app in quel caso

**Ottieni lo stato dell'ultima copia.** Le modifiche degli ultimi secondi prima dell'arresto anomalo potrebbero mancare. Un progetto con modifiche viene di nuovo contrassegnato come *Non salvato*. La cronologia di *Annulla* è vuota: non puoi annullare i passaggi precedenti all'arresto anomalo. Zoom, posizione di scorrimento e selezione vengono ricostruiti.

**Sul desktop un progetto ripristinato mantiene il suo file, nel browser no.** Sul desktop *Salva* scrive nel file originale, con lo stato ripristinato. Nel browser un progetto ripristinato non è più collegato al suo file: *Salva* chiede dove deve essere salvato il file. Anche l'interruttore *Salvataggio automatico* è grigio fino a quando non hai salvato il progetto una volta.

**Un progetto nella vista *Date come registrate* resta in quella vista.** Vedi [Date come registrate](docs://uitleg-datums-zoals-opgeslagen).

**Sul desktop la finestra non appare a ogni avvio.** Le copie di recupero si trovano nella cartella dati dell'app, come file IFC il cui nome inizia con *recovery*. Se chiudi l'app nel modo normale, l'app elimina le proprie copie. Quindi la finestra appare dopo una chiusura imprevista, dopo un riavvio per un aggiornamento dell'app, o se in un avvio precedente hai rimandato il ripristino.

**Nel browser la copia è conservata per scheda.** La copia si trova nello spazio di archiviazione del browser. Una nuova scheda o finestra non offre le copie di un'altra scheda. Le copie di schede che non esistono più vengono eliminate dopo sette giorni, non appena l'app scrive di nuovo delle copie.

**Nel browser la finestra appare anche dopo un normale ricaricamento.** Succede anche se hai salvato tutto. Se hai salvato subito prima di ricaricare e non hai cambiato nulla dopo, puoi scegliere senza rischi *Non ripristinare*: il tuo file è aggiornato.

**La finestra non appare.** In quel caso l'app non ha trovato copie. Succede se non hai ancora cambiato nulla, se usi una nuova scheda nel browser, se in precedenza hai eliminato le copie di recupero con *Non ripristinare*, oppure se l'arresto anomalo è avvenuto prima che l'app conservasse la prima copia: può richiedere fino a circa dieci secondi dopo la prima modifica.

**Una copia è danneggiata.** L'app segnala *Impossibile leggere il file ripristinato*, con il motivo, e offre gli altri progetti. Se scegli *Ripristina*, l'app poi elimina tutte le copie, anche quella illeggibile. Se nessuna copia è leggibile, la finestra non appare e le copie restano.

**Il ripristino non riesce.** L'app segnala *Ripristino non riuscito* con il motivo. Le copie restano e la domanda ritorna al prossimo avvio.

**Alcuni progetti non si possono caricare.** L'app segnala: *2 file di ripristino non sono stati caricati e sono stati ignorati.* Per un solo file dice *1 file di ripristino non è stato caricato ed è stato ignorato.* Gli altri progetti vengono ripristinati. Dato che qualcosa è stato ignorato, tutte le copie restano e la finestra torna al prossimo avvio con lo stesso elenco. Scegli quindi *Non ripristinare* se hai già ripristinato tutto ciò che era possibile.

## Vedi anche

- [File e formati](docs://uitleg-bestanden): salvataggio, salvataggio automatico e recupero dopo un arresto anomalo, a confronto.
- [Attivare il salvataggio automatico](docs://howto-automatisch-opslaan): lasciare che l'app aggiorni da sola il tuo file.
- [Aprire e salvare un file](docs://howto-bestand-openen-en-opslaan): salvare dopo il ripristino.
- [Date come registrate](docs://uitleg-datums-zoals-opgeslagen): cosa succede a un progetto in quella vista.
