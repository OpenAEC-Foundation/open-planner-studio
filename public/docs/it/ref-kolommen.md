# Scelta delle colonne

La **Tabella** (scheda **Tabella**) e l'elenco delle attività accanto al Gantt hanno ciascuno le proprie colonne. Le modifichi nella tabella stessa: il più nell'intestazione della tabella apre il selettore delle colonne, e nell'intestazione di una colonna sposti, allarghi, blocchi o rimuovi una colonna. Ogni modifica si applica subito; non c'è un passaggio OK.

Per impostazione predefinita l'elenco delle attività accanto al Gantt mostra **Struttura di scomposizione del lavoro (WBS)**, **Nome attività** e **Durata**. La Tabella mostra in più **Inizio**, **Fine**, **Tipo attività**, **Critica**, **Margine totale** e **Avanzamento**, oltre ai codici attività e ai campi personalizzati del progetto.

## Aprire il selettore delle colonne

- Il più a destra nell'intestazione della tabella. La Tabella e l'elenco delle attività accanto al Gantt hanno ciascuno il proprio più, che modifica solo la propria tabella.
- La scheda **Tabella** → **Colonne…** apre il selettore delle colonne della Tabella.
- Se i pulsanti di vista classici sono attivi (**Impostazioni** → scheda **Avanzate** → **Funzioni legacy** → **Mostra i pulsanti di vista classici**), **Vista** → gruppo della barra multifunzione **Visualizzazione** → **Colonne…** fa lo stesso: il pulsante passa alla scheda Tabella e vi apre il selettore delle colonne.

**Esc**, un clic fuori dal selettore o un altro clic sul più chiude il selettore.

## Aggiungere una colonna

Il selettore **Scegli colonna** contiene, dall'alto in basso:

- **Usate di recente** — i campi che hai aggiunto di recente con il selettore. Questo blocco compare non appena hai aggiunto una colonna.
- Il campo **Cerca** — digita parte del nome di un campo; i **Risultati della ricerca** provengono da tutti i gruppi.
- I campi per gruppo: **Attività**, **Pianificazione**, **Vincoli**, **Relazioni**, **Risorse**, **Avanzamento**, **Calcolato**, **Baseline**, **Personalizzato** e **Tecnico**. Un clic su un gruppo lo espande; il numero accanto indica quanti campi contiene.
- In fondo il pulsante **Ripristina predefiniti** (vedi più avanti).

Fai clic su un campo per aggiungerlo come ultima colonna; il selettore si chiude. Un campo che è già una colonna è spuntato e non si può scegliere di nuovo. I codici attività e i campi personalizzati del progetto si trovano sotto **Personalizzato**, i campi delle tue baseline sotto **Baseline**.

Sotto **Calcolato** si trovano tra l'altro i campi di analisi **Margine libero**, **Margine interferente**, **Quasi critica** e **Percorso margine**. Ricevono valori solo dopo un calcolo (**F5**), e **Quasi critica** e **Percorso margine** solo se l'opzione di pianificazione corrispondente è attiva — vedi [Percorso critico e analisi avanzata](docs://gids-kritiek-pad-analyse).

## Modificare le colonne nell'intestazione

- **Spostare** — trascina l'intestazione di una colonna in un'altra posizione. Le colonne bloccate restano insieme all'inizio; una colonna non bloccata si sposta solo tra le colonne non bloccate.
- **Larghezza** — trascina il bordo destro dell'intestazione di una colonna (da 40 a 480 pixel). Un doppio clic su quel bordo adatta la colonna all'intestazione e al valore più lungo. Da tastiera: porta il focus sul bordo e usa le frecce sinistra e destra, con **Shift** per passi più grandi.
- **Rimuovere** — il segno meno che compare nell'intestazione della colonna quando ci passi sopra con il puntatore. Il campo resta disponibile nel selettore delle colonne.
- **Clic destro** sull'intestazione di una colonna offre **Blocca** (o **Sblocca**), **Adatta automaticamente** e **Rimuovi**. Una colonna bloccata passa all'inizio, insieme alle altre colonne bloccate, e resta visibile quando scorri la tabella in orizzontale (finché le colonne bloccate stanno insieme nella tabella).

## Inizio, Fine e le date pianificate

**Inizio** e **Fine** (nella disposizione predefinita della Tabella) mostrano le stesse date della barra nel Gantt: la pianificazione calcolata e, prima del primo calcolo, le date inserite. Se digiti un'altra data in Inizio, diventa l'inizio pianificato. Una Fine diversa modifica la durata di un'attività pianificata automaticamente; per un'attività pianificata manualmente diventa la fine pianificata. Poi premi **F5** per ricalcolare. Se digiti di nuovo la stessa data, non cambia nulla.

I campi **Inizio pianificato** e **Fine pianificata** mostrano le date inserite stesse, anche quando il calcolo sposta l'attività. Fine pianificata è modificabile solo per un'attività pianificata manualmente: per le altre attività l'inizio e la durata determinano la fine. Inizio e Fine di un'attività di riepilogo pianificata automaticamente derivano dalle sue sottoattività e non sono modificabili.

## Ripristina predefiniti

**Ripristina predefiniti** si trova in fondo al selettore delle colonne. Un clic riporta le colonne di quella tabella alla disposizione predefinita: quali colonne sono mostrate, il loro ordine e la larghezza, e le colonne bloccate. I campi aggiunti in più escono dalla tabella e restano disponibili nel selettore. È anche il modo per ottenere la nuova disposizione predefinita dopo un aggiornamento, per esempio **Inizio** e **Fine** al posto di **Inizio pianificato** e **Fine pianificata**: una disposizione personale salvata in precedenza non cambia da sola. Se la tabella usa già la disposizione predefinita, il pulsante è disattivato.

## Salvataggio, annullamento e layout

La disposizione delle colonne è una preferenza personale su questo dispositivo: vale per tutti i tuoi progetti e non viene salvata nel file del progetto. Ogni azione sulle colonne — aggiungere, rimuovere, spostare, allargare, bloccare o **Ripristina predefiniti** — è un passo che **Ctrl+Z** annulla.

Un layout può anche memorizzare le colonne. Riprende la disposizione della tabella che vedi quando crei il layout e, con un clic sul pulsante del layout, la applica alla tabella visibile in quel momento: nella scheda Tabella la Tabella, nelle altre schede l'elenco delle attività accanto al Gantt. Vedi [Salvare e caricare i layout](docs://ref-layouts).

## Per saperne di più

- [Filtri](docs://ref-filters) — quali attività mostrano la tabella e il Gantt.
