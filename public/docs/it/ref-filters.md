# Filtri

La finestra **Filtro** controlla quali attività sono visibili — nel Gantt e nella scheda Tabella. Un filtro è composto da regole (campo + operatore + valore), eventualmente raggruppate in gruppi.

## Apertura

**Vista** → gruppo della barra multifunzione **Visualizzazione** → **Filtro…**. Il pulsante resta evidenziato mentre un filtro è attivo. **Esc**, la crocetta di chiusura o un clic fuori dalla finestra la chiude senza applicare.

## Gruppi: tutte o una qualsiasi

In alto in ogni gruppo scegli come combinare le sue regole:

- **Tutte le seguenti (AND)** — un'attività deve corrispondere a ogni regola.
- **Una qualsiasi delle seguenti (OR)** — corrispondere a una regola è sufficiente.

**+ regola** aggiunge una regola; **+ gruppo** (solo al livello superiore) aggiunge un gruppo annidato, così puoi combinare AND e OR — ad esempio "Critica è sì AND (Tipo è Costruzione OR Tipo è Installazione)". Senza regole la finestra mostra: "Ancora nessuna regola — questo filtro corrisponde a tutto."

## Una regola: campo, operatore, valore

- **Campo** — tutti i campi dell'attività: WBS, Nome attività, Durata, Inizio, Fine, Tipo, Critica, Margine totale, Progresso, Traguardo, Margine libero, Margine interferente, Quasi critica, Percorso di margine e Risorse, più i codici attività e i campi personalizzati del progetto.
- **Operatore** — si adatta al tipo di campo:
- testo: **uguale a**, **diverso da**, **contiene**, **inizia con**, **è vuoto**;
- numero e data: inoltre **minore di**, **minore o uguale a**, **maggiore di**, **maggiore o uguale a** e **tra** (con **Da**/**A**);
- campi sì/no (come Critica e Traguardo): una scelta **Sì**/**No**;
- campi a scelta (come Tipo o un codice attività): **è uno tra**, con valori selezionabili.
- **Valore** — l'input segue il tipo di campo (casella di testo, numero, data o selettore); **è vuoto** non ha un valore da inserire.

L'icona del cestino dietro una regola rimuove quella regola; la crocetta in alto a destra di un gruppo annidato rimuove l'intero gruppo.

## Applica, annulla e cancella

- **Applica** attiva il filtro e chiude la finestra. Un filtro senza regole conta come "nessun filtro".
- **Annulla** chiude senza applicare le modifiche.
- **Cancella** disattiva immediatamente il filtro attivo e svuota l'editor.

Un filtro attivo fa parte di un layout salvato — vedi [Salvare e caricare i layout](docs://ref-layouts).

## Per saperne di più

- [Scelta delle colonne](docs://ref-kolommen) — quali colonne mostra la tabella.
