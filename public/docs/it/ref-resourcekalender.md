# Calendario risorsa

La finestra **Calendario risorsa** modifica il calendario proprio di una singola risorsa — ad esempio una squadra che lavora quattro giorni a settimana. Il modulo è identico alla [finestra di dialogo calendario](docs://ref-kalenderdialoog); questo articolo descrive solo le differenze.

## Apertura

- Apri il pannello risorse: **Risorse** → gruppo della barra multifunzione **Gestisci** → **Risorse** (pannello completo) o **Dock risorse** (agganciato accanto al Gantt).
- Nella colonna **Calendario** di una risorsa, scegli un calendario e fai clic sull'icona a matita (**Modifica…**) accanto per modificarlo; crea un nuovo calendario tramite lo stesso menu a tendina.

## Differenze rispetto alla finestra di dialogo calendario

- **Un calendario alla volta** — nessun elenco di libreria a sinistra, nessuna stella per il predefinito del progetto; solo il modulo.
- **Applica** salva il calendario; **Annulla**, **Esc**, la crocetta di chiusura o un clic fuori dalla finestra scarta le modifiche. Un nuovo calendario creato con **+ Calendario risorsa** nel menu a tendina esiste solo dopo **Applica** e viene allora subito collegato alla risorsa (insieme, un solo passo di Annulla); dopo **Annulla** non resta nulla. Parte dalla stessa impostazione predefinita di **+** nella finestra dei calendari.
- **Nessun ricalcolo automatico** — **Applica** non ricalcola la pianificazione. Nel suo ruolo di calendario risorsa, un calendario non modifica le date CPM; conta ai fini del carico (istogramma) e del livellamento, che riesegui tu stesso con F5 o **Livella…** rispettivamente. Il menu a tendina offre però tutti i calendari del progetto: se modifichi qui un calendario che è anche il calendario di progetto o quello di un'attività, la pianificazione cambia eccome. Viene allora segnata come non aggiornata e F5 la ricalcola.

## Campi

Vedi la [finestra di dialogo calendario](docs://ref-kalenderdialoog) per il riferimento completo dei campi: **Nome**, **Giorni lavorativi** (con le preimpostazioni Lun–ven e Continuo (24/7)), **Inizio (ora)** / **Fine (ora)** / **Ore al giorno**, la sezione **Orari di lavoro** (con pianificazione oraria attiva), **Genera festività…** e l'elenco **Festività**.

## Per saperne di più

- [Calendari e pianificazione oraria](docs://gids-kalenders-uren) — quando un calendario risorsa è la scelta giusta.
- [Risorse, istogramma e livellamento](docs://gids-resources-histogram) — come il calendario influisce sul carico e sul livellamento.
