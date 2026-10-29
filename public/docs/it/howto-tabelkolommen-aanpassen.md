# Regolare le colonne della tabella

Obiettivo: scegli quali colonne vedi nella tabella attività, in quale ordine e con quale larghezza.

## Quando ti serve

Nella riunione vuoi vedere la scadenza e il margine totale accanto a ogni attività. Il capocantiere vuole solo l'inizio e la fine accanto al nome. Oppure una colonna è così stretta che la sua intestazione è tagliata. La tabella attività è composta da colonne che scegli tu: ce ne sono decine, da *Nome attività* e *Durata* fino a *Scadenza*, *Margine libero* e *Risorse assegnate*.

Ci sono due tabelle attività, ciascuna con le proprie colonne:

- La **tabella attività accanto al Gantt** si trova a sinistra della linea temporale, nelle schede, tra le altre, *Home*, *Pianificazione* e *Vista*. Per impostazione predefinita ha *WBS*, *Nome attività* e *Durata*, così resta spazio per la linea temporale.
- La **tabella nella scheda Tabella** occupa tutto lo spazio di lavoro. Per impostazione predefinita ha *WBS*, *Nome attività*, *Durata*, *Inizio*, *Fine*, *Categoria di lavoro*, *Critica*, *Margine totale* e *Avanzamento*, più una colonna per ogni codice attività e campo personalizzato del progetto.

Una modifica a una tabella non cambia l'altra.

## Passaggi

### Aggiungere una colonna

1. Clicca sul segno più (**+**) a destra dell'intestazione della tabella. Nella scheda *Tabella* puoi anche usare *Tabella › Colonne › Colonne…*. Si apre la finestra *Scegli colonna*.
2. Trova la colonna. In alto, se hai già scelto colonne prima, c'è *Usate di recente*. Scrivi una parte del nome in *Cerca*, per esempio *scad* per *Scadenza*, oppure apri una categoria: *Attività*, *Pianificazione*, *Vincoli*, *Relazioni*, *Risorse*, *Avanzamento*, *Calcolato*, *Baseline*, *Personalizzato* o *Tecnico*.
3. Clicca sulla colonna. Va alla fine della tabella e la finestra si chiude.

Una colonna che è già nella tabella è grigia e non si può scegliere.

### Rimuovere una colonna

Clicca sul segno meno nell'intestazione della colonna (*Rimuovi: Scadenza*). Oppure fai clic con il tasto destro sull'intestazione e scegli *Rimuovi: Scadenza*. Con Ctrl+Z recuperi la colonna, oppure la scegli di nuovo con il più.

### Regolare la larghezza

Trascina il bordo a destra dell'intestazione della colonna verso sinistra o verso destra. Fai doppio clic su quel bordo, oppure scegli *Adatta automaticamente* nel menu dell'intestazione (tasto destro del mouse), per rendere la colonna abbastanza larga per il suo contenuto, fino a un massimo di 480 pixel. Se il bordo ha il focus, con i tasti freccia lo allarghi o lo restringi un passo alla volta.

### Bloccare colonne

Fai clic con il tasto destro sull'intestazione e scegli *Blocca*. Le colonne bloccate passano davanti e restano a sinistra quando scorri in orizzontale. Questo funziona finché insieme non sono più larghe della finestra. *Sblocca* le rimette nella riga.

### Cambiare l'ordine

Trascina l'intestazione di una colonna in un altro punto. Una colonna bloccata la sposti tra le colonne bloccate, una colonna normale tra le colonne normali.

### Tornare al predefinito

Apri la finestra *Scegli colonna* e clicca in basso su *Ripristina predefiniti*. Il pulsante è grigio se le colonne sono già quelle predefinite. Per la tabella nella scheda *Tabella* si aggiunge anche una colonna per ogni codice attività e campo personalizzato del progetto, anche se prima le avevi rimosse. Quelle colonne appartengono al progetto a cui appartiene il codice o il campo. Puoi leggere di quei codici e campi in [Codici e campi personalizzati](docs://howto-codes-en-velden).

## Problemi e cosa fa l'app

**L'intestazione è tagliata.** Una colonna stretta taglia il suo nome, per esempio *Margine totale* a *Marg…*. Fai doppio clic sul bordo dell'intestazione per adattare la colonna.

**Regoli la tabella sbagliata.** Le colonne della tabella attività accanto al Gantt e quelle della scheda *Tabella* sono separate. Se sei nella scheda *Vista* o *Home*, regoli la tabella accanto al Gantt. Il segno più nella scheda *Tabella* regola la tabella grande.

**Un layout rimette le colonne.** Se in un layout è spuntata la parte *Colonne*, un clic sul pulsante del layout rimette le colonne della tabella attività accanto al Gantt nello stato salvato. La tabella nella scheda *Tabella* non cambia. Vedi [Creare e usare un layout](docs://howto-layouts-gebruiken).

**Le colonne sono sul tuo dispositivo, non nel progetto.** L'app conserva la tua scelta di colonne per tutti i tuoi progetti su questo dispositivo e non la salva nel file di progetto. Inoltre non rende il progetto «modificato». Ogni modifica alle colonne puoi annullarla con *Annulla* (Ctrl+Z). I passaggi si chiamano, per esempio, *Aggiungi la colonna Scadenza* e *Ridimensiona la colonna Nome attività*.

## Vedi anche

- [Creare e usare un layout](docs://howto-layouts-gebruiken): mettere colonne su un pulsante insieme a un filtro o a un ordinamento.
- [Codici e campi personalizzati](docs://howto-codes-en-velden): creare colonne tue che puoi scegliere qui.
- [Colonne della tabella](docs://ref-tabelkolommen): tutte le colonne e cosa mostrano.
