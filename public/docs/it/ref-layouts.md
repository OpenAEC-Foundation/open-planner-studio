# Salvare e caricare i layout

Un layout è una configurazione di visualizzazione salvata: le colonne, il raggruppamento, l'ordinamento, il filtro e la scala temporale in un unico pacchetto. I layout sono globali per l'app (su questo dispositivo) — non appartengono a un singolo file di progetto, quindi puoi usarli in qualsiasi documento.

## Apertura

**Vista** → gruppo della barra multifunzione **Layout**. Contiene un selettore con i tuoi layout e tre pulsanti:

- **Salva come…** e **Gestisci…** — entrambi aprono la finestra **Gestisci layout** (sotto).
- **Aggiorna** — sovrascrive il layout scelto nel selettore con la vista attuale; disabilitato mentre è selezionato **(nessuno)**.

Scegliere un layout nel selettore lo applica immediatamente.

## La finestra Gestisci layout

Senza layout salvati la finestra mostra "Ancora nessun layout salvato." Altrimenti, una riga per layout con:

- **Nome** — modificabile direttamente nella riga (rinomina).
- **Applica** (segno di spunta) — chiede prima conferma: "Applicare il layout «…»? Questo sostituisce le colonne/raggruppamento/ordinamento/filtro/scala attuali."
- **Aggiorna** — sovrascrive il layout con la vista attuale, senza conferma.
- **Elimina** (icona cestino) — chiede prima conferma.

Le conferme compaiono come una piccola finestra di dialogo interna all'app; **Esc** o **Annulla** interrompe.

## Salva layout come…

In fondo alla finestra: digita un **Nome** e fai clic su **Salva** — la vista attuale viene memorizzata come nuovo layout e diventa quello attivo. Senza un nome il layout riceve il nome predefinito "Nome".

## Cosa cattura un layout

- Colonne (visibilità, ordine, larghezza) — vedi [Scelta delle colonne](docs://ref-kolommen).
- Raggruppamento e ordinamento (**Vista** → **Raggruppa…** / **Ordina…**).
- Il filtro — vedi [Filtri](docs://ref-filters).
- La scala temporale del Gantt.

Non incluso: dettagli del livello di zoom, larghezze dei pannelli e selezioni.
