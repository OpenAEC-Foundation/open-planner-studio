# Finestra di dialogo calendario

La finestra **Calendari** gestisce la libreria dei calendari del progetto: l'elenco di tutti i calendari a sinistra, il modulo di modifica del calendario selezionato a destra.

## Apertura

- **Pianificazione** → gruppo della barra multifunzione **Calendario** → il pulsante **Calendario** o **Festività**.
- **Impostazioni** (scheda della barra multifunzione) → gruppo della barra multifunzione **Calendario** → **Calendario**.
- Dalla procedura guidata del progetto: scegliendo **Personalizzato…** come calendario si apre questa finestra dopo la creazione.

## Applicare e annullare

Tutte le modifiche — comprese nuovo/duplica/elimina — avvengono in una copia di lavoro. **Applica** (o **Invio**) scrive tutto in una volta e ricalcola la pianificazione; **Annulla**, **Esc**, la crocetta di chiusura o un clic fuori dalla finestra scarta tutte le modifiche.

## Libreria (colonna sinistra)

- **Elenco** — tutti i calendari; la stella contrassegna il **Calendario del progetto** (il predefinito per le attività senza un proprio calendario).
- **+** — **Nuovo calendario**.
- **Duplica** — copia del calendario selezionato.
- **Elimina** — non possibile per l'ultimo calendario; eliminando il predefinito del progetto un altro calendario diventa il predefinito.
- **Imposta come predefinito del progetto** — rende il calendario selezionato il calendario del progetto (pulsante sopra il modulo).

## Modulo (colonna destra)

- **Nome** — nome libero.
- **Giorni lavorativi** — pulsanti da **Lun** a **Dom**; attivo = giorno lavorativo. Preimpostazioni: **Lun–ven** (settimana standard, 07–16 h, 8 h/giorno) e **Continuo (24/7)**.
- **Inizio (ora)** / **Fine (ora)** / **Ore al giorno** — l'orario di lavoro dell'intera giornata. Nascosto quando il calendario ha fasce orarie di lavoro e la pianificazione oraria è attiva; le fasce determinano allora gli orari.

## Orari di lavoro (solo con pianificazione oraria attivata)

- **Ore/giorno derivate** — cifra di controllo, derivata dalle fasce.
- Preimpostazioni: **Turno diurno**, **2 turni**, **3 turni**, **Turno notturno**, **24/7** — ognuna imposta le fasce orarie di lavoro in un colpo solo.
- **Salva come preimpostazione…** — salva gli orari di lavoro attuali come tua preimpostazione personale (su questo dispositivo); le preimpostazioni personali compaiono come pulsanti con una crocetta di eliminazione.
- **Imposta per giorno della settimana…** / **Mostra/nascondi orari di lavoro** — apre o comprime l'editor delle fasce.
- **Editor delle fasce** — per ogni giorno della settimana un elenco di fasce orarie (inizio–fine), ciascuna con una casella **giorno successivo** (turno notturno oltre la mezzanotte), **Aggiungi fascia** (uno spazio vuoto tra due fasce è una pausa), **Copia su tutti i giorni lavorativi**, il totale ore per giorno e le ore/giorno derivate in fondo. Vedi [Calendari e pianificazione oraria](docs://gids-kalenders-uren).

## Genera festività…

Genera l'elenco delle festività in base a regole sull'intero periodo del progetto:

- **Paese** — Paesi Bassi, Germania, Belgio, Francia, Regno Unito, Austria, Svizzera o **Nessuna festività**.
- **Regione** — solo per i paesi con set regionali; predefinito **Nazionale**.
- **Ferie edili** — solo Paesi Bassi: **Nessuna**, **Nord**, **Centro** o **Sud**; con un avviso che si tratta di date indicative.
- **Anteprima** — riga di riepilogo ("n festività, anno–anno"), espandibile all'elenco completo.
- **Genera** sostituisce l'elenco delle festività; **Annulla** chiude il blocco.
- Se il progetto ora si estende oltre gli anni generati, in alto compare un avviso con un pulsante **Rigenera**.

## Festività

L'elenco vero e proprio: per ogni riga **Descrizione**, **Da**, **A** e un pulsante di rimozione; **Aggiungi festività** crea una nuova riga. I periodi pluri-giornalieri (ferie edili, sospensione per gelo) sono semplicemente una riga con un intervallo Da–A più lungo.
