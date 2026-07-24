# Codici e campi (finestra di struttura)

La finestra **Codici e campi** gestisce le definizioni della struttura del progetto: i **codici attività** (dimensioni liberamente definibili come Ubicazione o Disciplina) e i **campi personalizzati** (campi utente tipizzati). I valori per attività si compilano poi tramite il pannello delle proprietà o la [finestra di dialogo attività](docs://ref-taakdialoog).

## Apertura

**Pianificazione** → gruppo della barra multifunzione **Struttura** → **Codici e campi**. **Esc**, la crocetta di chiusura o un clic fuori dalla finestra la chiude. Tutte le modifiche hanno effetto immediato (e possono essere annullate con Ctrl+Z) — non c'è un pulsante di salvataggio separato.

## Codici attività

"Dimensioni definibili liberamente (es. Ubicazione, Disciplina) per raggruppare e filtrare — al massimo un valore per tipo per attività."

Un blocco per ogni tipo di codice:

- **Nome del tipo di codice** — modificabile direttamente.
- **Rimuovi tipo di codice** (cestino) — rimuove il tipo, inclusi tutti i valori e le assegnazioni sulle attività.
- Una riga per valore: **Codice** (etichetta breve), **Descrizione** e un selettore di **Colore** (colora tra l'altro i raggruppamenti), più un pulsante di rimozione.
- **Aggiungi valore** — nuovo valore sotto questo tipo.

In basso: campo di inserimento **Nuovo tipo di codice (es. Ubicazione)** + pulsante **Aggiungi tipo di codice** (funziona anche Invio).

## Campi personalizzati

"Campi utente tipizzati, visibili come colonne nella tabella e modificabili per attività."

Una riga per campo: il **nome** (modificabile direttamente), il **tipo** (sola lettura dopo la creazione) e un pulsante di rimozione.

In basso: campo di inserimento **Nuovo campo (es. Appaltatore)**, un selettore del tipo — **Testo**, **Numero**, **Numero intero**, **Costo**, **Data** o **Sì/no** — e il pulsante **Aggiungi campo** (funziona anche Invio). Il tipo non può essere modificato dopo la creazione; crea un nuovo campo se necessario.

## Dove compaiono le definizioni

- Come sezione **Codici e campi** per attività nel pannello delle proprietà e nella finestra di dialogo attività.
- Come colonne nella vista tabella (campi personalizzati) e come dimensione di raggruppamento/filtro (codici attività).

## Per saperne di più

- [Pianificazione e WBS](docs://gids-plannen-wbs) — strutturare una pianificazione, con codici e campi in pratica.
