# Codici e campi personalizzati

Obiettivo: collega alle tue attività le tue classificazioni (codici attività, come *Ubicazione*) e i tuoi campi (come *Appaltatore*).

## Quando ti serve

Oltre ai dati fissi di un'attività (nome, durata, relazioni, …) puoi aggiungere dati tuoi. Se vuoi classificare le attività per ala nord e ala sud, per disciplina, oppure tenere traccia di quale appaltatore esegue un'attività, la registri tu stesso. Ci sono due modi, e la differenza conta.

Un **codice attività** è una classificazione con un elenco di scelta fisso. Crei un **tipo di codice** (per esempio *Ubicazione*) con **valori** (*N* per l'ala nord, *Z* per l'ala sud). Un'attività riceve al massimo un valore per tipo di codice.

Un **campo personalizzato** (sotto *Campi personalizzati* nella finestra) è un campo di input libero con un tipo: *Testo*, *Numero*, *Numero intero*, *Costo*, *Data* o *Sì/no*. Il campo può avere un valore diverso su ogni attività.

## Passaggi

### Definire codici e campi

1. Scegli *Pianificazione › Struttura › Codici e campi*.
2. **Creare un tipo di codice.** Sotto *Nuovo tipo di codice (es. Ubicazione)* scrivi il nome e premi Invio, oppure fai clic su *Aggiungi tipo di codice*.
3. **Aggiungere valori.** Sotto il tipo di codice fai clic su *Aggiungi valore*. L'app mette lì un codice provvisorio, per esempio *V1*. Cambialo nella casella *Codice* (corto, come lo scriveresti tu: *N*). Se serve, compila una *Descrizione* (*Ala nord*) e scegli un *Colore*. Una modifica è valida appena esci dalla casella o premi Invio.
4. **Creare un campo personalizzato.** Sotto *Nuovo campo (es. Appaltatore)* scrivi il nome, scegli il tipo e fai clic su *Aggiungi campo* (oppure premi Invio).

La finestra non ha un pulsante OK: ogni modifica si applica subito. Dopo la creazione non si può cambiare il tipo di un campo, solo il nome. Se vuoi un altro tipo, crea un nuovo campo.

### Compilare un codice o un campo su un'attività

Puoi farlo in due modi.

- **Nel pannello *Proprietà*** (o nella finestra che apri con F2). In fondo c'è il blocco *Codici e campi*: un elenco di scelta per ogni tipo di codice e un campo di input per ogni campo. Il blocco compare solo quando esiste almeno un tipo di codice o un campo.
- **Come colonna nella tabella attività.** Fai clic sul **+** a destra dell'intestazione della tabella (*Aggiungi colonna*) e, sotto *Personalizzato*, scegli il tipo di codice o il campo. Nella cella di un tipo di codice scrivi il codice, per esempio `N`, oppure scegli dall'elenco. Un codice che non esiste mostra *Scegli un valore di questo codice attività*.

### Utilizzarli

Puoi usare un tipo di codice o un campo personalizzato per filtrare, raggruppare e ordinare. Imposta questo con un layout: *Vista › Layout › Nuovo layout*. Nella finestra spunta le parti che vuoi includere. Con *Salva* ottieni un pulsante in *Vista › Layout* su cui puoi fare clic di nuovo più tardi; con *Applica senza salvare* lo mostri solo adesso sullo schermo. Quando raggruppi, le attività senza valore finiscono sotto *(nessuno)*.

Per il colore delle barre scegli *Vista › Baseline e progresso › Colori barre*, poi *Per categoria* e il tipo di codice. Ogni barra prende allora il *Colore* del suo valore.

## Problemi e cosa fa l'app

**Eliminare rimuove i valori sulle attività.** Se elimini un tipo di codice, un valore o un campo con il cestino, l'app non chiede conferma, e con esso spariscono le assegnazioni su tutte le attività. Anche un raggruppamento o un ordinamento su quel tipo di codice o campo decade. *Annulla* (Ctrl+Z, chiudi prima la finestra) ripristina il tipo di codice, il valore o il campo e i valori compilati, ma non il raggruppamento o l'ordinamento: li imposti di nuovo.

**Due valori con lo stesso codice.** *Aggiungi valore* continua la numerazione dal numero di valori che ci sono. Se elimini un valore e ne aggiungi uno, un codice può quindi comparire due volte. Se scrivi quel codice in una cella di colonna, l'app rifiuta con *Questo valore del codice attività compare più volte. Sceglilo dall'elenco*. Dai a ogni valore un codice proprio.

**I modelli non portano con sé codici e campi.** Vedi [Salvare e inserire modelli WBS](docs://howto-wbs-sjablonen). Se incolli attività in un altro documento, l'app cancella i codici e i campi che lì non esistono e te lo dice.

**Un campo di tipo data non si sposta insieme.** Se sposti tutto il progetto, i campi personalizzati compilati di tipo *Data* restano sulla loro data. L'app lo segnala nell'anteprima.

## Vedi anche

- [Modificare la struttura](docs://howto-structuur-aanpassen): l'albero WBS, l'altro modo per organizzare le attività.
- [Spostare un progetto](docs://howto-project-verplaatsen): cosa succede alle date quando sposti il progetto.
- [Creare e usare un layout](docs://howto-layouts-gebruiken): raggruppare e filtrare su un codice o un campo personalizzato.
- [Modificare le colonne della tabella](docs://howto-tabelkolommen-aanpassen): mostrare un codice o un campo personalizzato come colonna.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): i codici attività *House* e *Discipline*, il campo personalizzato *Cost estimate* e le note (aperte e completate).
