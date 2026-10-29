# Creare e stampare un report

Obiettivo: scegli un report della tua pianificazione, controllalo nell'anteprima e salvalo come PDF, così puoi distribuirlo o stamparlo tu stesso.

## Quando ti serve

Venerdì c'è la riunione di cantiere. Il committente vuole la pianificazione su carta, il direttore di cantiere vuole sapere che cosa inizia nelle prossime settimane e il capocantiere vuole un foglio con solo le sue attività. Crei panoramiche come queste nella scheda *Rapporto*. L'app le calcola dalla tua pianificazione e le mostra prima come anteprima. Poi le esporti in PDF.

L'app non invia un report direttamente a una stampante. Il risultato finale è sempre un PDF. Lo stampi con il tuo lettore PDF oppure lo invii via e-mail.

## Passaggi

### 1. Apri la scheda Rapporto

Scegli *Rapporto* nella barra multifunzione, oppure premi Ctrl+P. Ctrl+P ti porta a questa scheda. Se stai scrivendo in un campo, è aperta una finestra di dialogo o è attiva la modalità presentazione, Ctrl+P non funziona. Nel browser si apre allora la finestra di stampa del browser, che stampa lo schermo e non il report.

A sinistra c'è la colonna *Rapporto* con l'elenco *Tipo di report*, un riepilogo e le impostazioni. A destra c'è l'anteprima.

### 2. Scegli il tipo di report

L'elenco *Tipo di report* contiene undici report. Scegli quello che risponde alla tua domanda.

- *Diagramma di Gantt*: la pianificazione come grafico a barre, per la pianificazione classica da distribuire.
- *Diagramma delle risorse*: le stesse barre, ma con una striscia per ogni risorsa. Per la domanda «che cosa fa la squadra X?», se vuoi con un foglio per squadra.
- *Panoramica attività cardine*: tutte le attività cardine con data e stato.
- *Variance*: la pianificazione attuale accanto alla baseline attiva. Per la domanda «di quanto siamo rimasti indietro?».
- *Previsione (look-ahead)*: ciò che è in corso o inizia nel prossimo periodo. L'elenco per la riunione settimanale.
- *Critico e quasi critico*: le attività senza margine o con quasi nessun margine.
- *Rapporto di avanzamento*: a che punto è il progetto alla data di stato, cioè il giorno in cui misuri l'avanzamento.
- *Salute del programma*: un controllo della pianificazione stessa su errori e valori insoliti.
- *Carico risorse*: per risorsa, per settimana o per mese, il fabbisogno rispetto alla disponibilità.
- *Assegnazioni risorse*: per risorsa, le attività a cui è assegnata.
- *Riepilogo WBS*: la pianificazione aggregata per livello WBS, per la direzione.

### 3. Controlla che la pianificazione sia aggiornata

L'app non calcola da sola. Se dopo l'ultimo calcolo hai cambiato attività, relazioni o calendari, premi **Calcola** (F5). I report in forma di tabella ti avvisano da soli, in cima al report: *Il programma è cambiato dall'ultimo calcolo — premi Calcola (F5) per valori aggiornati.* Oppure, se non è mai stato calcolato: *Non ancora calcolato — premi Calcola (F5) per date e slack.*

La barra multifunzione della scheda Rapporto non ha un pulsante Calcola, ma F5 funziona benissimo anche qui. *Esporta PDF* calcola anche da solo prima, se la pianificazione non è aggiornata, così il PDF non è mai indietro rispetto alla pianificazione.

### 4. Regola il report

Sotto *Impostazioni* ci sono le scelte per il Diagramma di Gantt e il Diagramma delle risorse. Previsione (look-ahead), Critico e quasi critico, Rapporto di avanzamento, Salute del programma, Carico risorse, Assegnazioni risorse e Riepilogo WBS hanno solo *Carta:* e *Orientamento:*, più un blocco *Opzioni del rapporto* con le scelte di quel report. Panoramica attività cardine e Variance non hanno opzioni proprie. Per il periodo di un report vedi [Scegliere il periodo di riferimento](docs://howto-rapportageperiode-kiezen).

- *Carta:* e *Orientamento:* determinano il foglio. Il valore predefinito è A3 orizzontale, comodo per una pianificazione di cantiere, ma non ogni stampante stampa in A3. Se hai una stampante A4, scegli subito A4: l'app impagina allora le pagine per A4, invece di doverle rimpicciolire dopo.
- Con il Diagramma delle risorse, la casella *Ogni risorsa su una nuova pagina* ti dà un foglio per squadra.
- *Dimensione carattere:* (dal 90% al 125%) rende più grandi o più piccoli il testo e la tabella. Un carattere più grande lascia meno spazio per la linea temporale.
- *Segui vista (filtro, raggruppamento, ordine)* compare solo per il Diagramma di Gantt. Per impostazione predefinita va su carta l'intero albero delle attività. Con questa casella il report disegna esattamente le righe che vedi sullo schermo, comprese le fasi ripiegate, per esempio solo le attività critiche di un layout. Come crei una vista del genere è spiegato in [Creare e usare un layout](docs://howto-layouts-gebruiken).
- *Mostra sovrapposizione baseline* mostra la baseline attiva accanto alle barre attuali. Con *Linea di stato:* scegli una *Linea data di stato* o una *Linea di avanzamento*.
- *Adatta automaticamente alla pagina* è attivo per impostazione predefinita: la linea temporale viene scalata sulla larghezza della pagina, e il numero di pagine dipende dall'altezza. Se lo disattivi, il report usa uno zoom fisso e si estende anche in larghezza, il che produce rapidamente molte pagine. Con *Cronologia su:* distribuisci la linea temporale su 2–8 pagine in larghezza, con l'adattamento automatico, per una pianificazione lunga che vuoi stampare a una dimensione leggibile.

### 5. Controlla l'anteprima

Per il Diagramma di Gantt e il Diagramma delle risorse vedi il foglio con intestazione di pagina, tabella, linea temporale e legenda. Scorri per guardare le pagine. *Qualità anteprima* imposta solo quanto è nitida l'anteprima sul tuo schermo; il PDF non cambia con questa opzione. Se sotto le pagine appare *… e 1 pagina in più — esporta per il documento completo* (con più pagine *… e 2 pagine in più — esporta per il documento completo*), l'anteprima non ha ancora tutte le pagine pronte. Il PDF le contiene tutte.

Gli altri report si vedono sullo schermo come tabella. Quello che vedi è quello che finisce nel PDF.

### 6. Esporta in PDF

In fondo alla colonna a sinistra fai clic su **Esporta PDF**. Il nome file suggerito è il nome del progetto seguito dal tipo di report; per il Diagramma di Gantt, per esempio, *Extension house-planning.pdf*.

- Nell'app desktop, e in un browser che ha una finestra di salvataggio dei file, scegli dove va il PDF. Se chiudi quella finestra senza salvare, non succede nulla.
- In un browser senza una finestra del genere, il browser salva il PDF nella cartella dei download.

### 7. Stampa il PDF

Apri il PDF nel tuo lettore PDF e stampalo lì. Se stampi un PDF in A3 su una stampante A4, la finestra di stampa deve rimpicciolire le pagine. Imposta quindi prima il formato carta nel passaggio 4.

## Trappole e che cosa fa l'app

**Il pulsante Stampa e Ctrl+P non stampano.** Il pulsante *Stampa* nel gruppo *Rapporto* si trova sulla scheda Rapporto stessa e non fa nulla di più. Ctrl+P ti porta a questa scheda. Nell'app non esiste un comando di stampa separato: il modo per arrivare su carta passa dal PDF. Se Ctrl+P non funziona (vedi passaggio 1), si apre la finestra di stampa del browser, che stampa lo schermo e non il report.

**Azienda: la sovrascrittura non viene mantenuta.** Il campo *Azienda:* del Diagramma di Gantt parte dall'azienda delle impostazioni progetto. Quello che digiti sopra non viene mantenuto. Qui non puoi scrivere in *Autore:*. Cambi entrambi con *Impostazioni › Progetto › Impostazioni progetto*, nei campi *Committente/organizzazione* e *Autore*, e confermi con *Applica*.

**Colori barre: vale anche per lo schermo.** La scelta *Colori barre:* nel report è la stessa scelta di *Colori barre* nella scheda Vista. Se la cambi nel report, anche il tuo diagramma di Gantt sullo schermo cambia.

**Variance senza baseline.** Una baseline è una copia salvata della pianificazione, con cui misuri in seguito; come salvarne una è spiegato in [Salvare e gestire una baseline](docs://howto-baseline-opslaan-en-beheren). Se non hai una baseline attiva, invece di un confronto compare *Nessuna baseline attiva — salva una baseline o impostane una come attiva.*

**Linea di stato senza data di stato.** Se scegli una *Linea di stato:* mentre il progetto non ha una data di stato, il report avvisa con *Imposta prima una data di stato* e non disegna nulla. Imposti la data di stato in *Pianificazione › Baseline e progresso › Data di stato*.

**La pianificazione contiene un ciclo.** Se la pianificazione contiene un ciclo, *Esporta PDF* non crea nessun file e mostra l'errore.

**Il formato della carta vale al momento per tutti i report.** C'è un'unica scelta per *Carta:* e *Orientamento:*, condivisa da tutti i report. La Panoramica attività cardine e la Variance non hanno una scelta di carta propria: usano quella che imposti in un altro report, con il valore predefinito A3 orizzontale. Scegli quindi prima la carta in un report che la offre, per esempio il Diagramma di Gantt, e poi torna indietro.

**Le impostazioni valgono per tutti i progetti.** Carta, dimensione del carattere, periodo e le altre scelte vengono ricordate dall'app su questo dispositivo, per tutti i tuoi progetti. Non appartengono al file di progetto.

## Vedi anche

- [Scegliere il periodo di riferimento](docs://howto-rapportageperiode-kiezen): una previsione (look-ahead) o un rapporto di avanzamento su un certo intervallo di tempo.
- [Creare e usare un layout](docs://howto-layouts-gebruiken): prima filtra o raggruppa, poi stampa con *Segui vista*.
- [Salvare e gestire una baseline](docs://howto-baseline-opslaan-en-beheren): la copia di riferimento con cui la Variance confronta.
- [Risolvere le risorse sovrassegnate](docs://howto-overbezetting-oplossen): che cosa fare quando Carico risorse mostra settimane sovrassegnate.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): perché un'attività è critica o quasi critica.
- [Tipi di report](docs://ref-rapporttypes): tutti i tipi di report e le loro opzioni.
