# Gestione baseline

La finestra **Baseline** gestisce gli snapshot salvati della pianificazione: salvare, rinominare, scegliere la baseline attiva ed eliminare.

## Apertura

**Pianificazione** → gruppo della barra multifunzione **Baseline e progresso** → **Salva nuova baseline** o **Gestisci baseline…** (entrambi aprono la stessa finestra). **Esc**, **Chiudi**, la crocetta di chiusura o un clic fuori dalla finestra chiude; tutte le modifiche in questa finestra hanno effetto immediato.

## La tabella delle baseline

Una riga per ogni baseline salvata:

- **Attiva** — pulsante di opzione; può essere attiva esattamente una baseline. La baseline attiva è la base di confronto per la sovrapposizione della baseline nel Gantt e per il rapporto Variance.
- **Nome** — modificabile direttamente nella riga.
- **Creata** — la data in cui la baseline è stata salvata.
- **Elimina** (cestino) — rimuove la baseline. Se è quella attiva, la finestra chiede prima conferma ("Eliminare la baseline attiva?"); dopodiché la baseline rimanente salvata più di recente diventa attiva, oppure nessuna se non ne resta nessuna.

Senza baseline la finestra mostra "Nessuna baseline ancora".

## Salva nuova baseline

- **Campo nome** — precompilato con "Baseline {n} — {data}"; modifica il nome a piacere.
- **Salva** — registra l'inizio, la fine e (per i traguardi) la data di ogni attività e rende attiva la nuova baseline.
- **Avviso** — se la pianificazione non è aggiornata dall'ultimo calcolo, compare "La pianificazione non è aggiornata — ricalcola prima (F5)": un suggerimento, non un blocco. Una baseline su una pianificazione non aggiornata congelerebbe le date sbagliate.

## Per saperne di più

- [Baseline e avanzamento](docs://gids-baselines-voortgang) — sovrapposizione della baseline, rapporto Variance, progresso e data di stato.
