# Opzioni di livellamento

La finestra **Livella risorse** risolve le sovrallocazioni spostando le attività. Funziona in due passaggi: **Calcola** costruisce una proposta (nulla cambia ancora), **Applica** la esegue.

## Apertura

**Risorse** → gruppo della barra multifunzione **Livellamento** → **Livella…**. **Esc**, la crocetta di chiusura o un clic fuori dalla finestra chiude senza applicare.

## Opzioni

- **Livella solo entro il margine (attenuazione) — la data di fine progetto resta invariata** — se selezionata, il livellamento sposta le attività solo entro il loro margine totale: la data di fine non può spostarsi, ma non tutti i conflitti possono allora essere risolti. Non selezionata (predefinito), la data di fine progetto può estendersi per risolvere tutti i conflitti.
- **Risorse** — una casella di spunta per risorsa: quali risorse partecipano. Le risorse materiali sono assenti qui (il materiale non viene livellato). Tutte le risorse sono attive per impostazione predefinita.

## Calcola

Richiede un calcolo aggiornato; altrimenti la finestra mostra "Calcola la pianificazione (F5) prima di livellare." Il pulsante è disabilitato anche finché nessuna risorsa è selezionata. Ogni modifica alle opzioni invalida una proposta precedente — calcola di nuovo.

## Proposta (anteprima)

- **Riga della data di fine progetto** — "invariata (data)" oppure "data precedente → nuova data" (in rosso) se il progetto si estende.
- **Tabella** — per ogni attività spostata: **Attività**, **Inizio precedente**, **Nuovo inizio** e **Giorni spostati**. Sono incluse anche le attività successive senza risorse che si spostano di conseguenza tramite la logica.
- Se non c'è nulla da fare, la finestra segnala "Nessuna attività deve essere spostata — la pianificazione è già priva di conflitti."

## Conflitti rimanenti

Attività che non rientrano nelle regole, con per attività il numero di giorni in conflitto e una motivazione:

- "… raggiunge un picco di … unità/giorno, la capacità è … — non risolvibile spostando." — un'assegnazione richiede al suo picco più di quanto la risorsa possa fornire; riduci le unità/giorno o aumenta le unità max.
- "La risorsa non lavora in tutti i giorni richiesti da questa attività — lo spostamento non risolve il problema." — disallineamento di calendario tra attività e risorsa.
- "Capacità libera insufficiente entro il margine per risolvere questo conflitto." — soprattutto con l'attenuazione: nessuna finestra libera entro il margine disponibile.

## Applica e annulla

**Applica** esegue la proposta e chiude la finestra; **Annulla** chiude senza modifiche. Annulla un livellamento applicato con **Cancella livellamento** (stesso gruppo della barra multifunzione) o Ctrl+Z.

## Per saperne di più

- [Risorse, istogramma e livellamento](docs://gids-resources-histogram) — individuare le sovrallocazioni nell'istogramma e il flusso di lavoro completo del livellamento.
