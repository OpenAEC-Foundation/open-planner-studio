# Collegare un assistente IA (MCP)

Open Planner Studio può aprirsi a un assistente IA. Attivi la modalità IA e l'app stessa diventa un **server MCP**: un assistente come Claude si collega alla finestra che hai aperto in quel momento, legge la tua pianificazione e può modificarla. Tu guardi in diretta — ogni attività che aggiunge appare subito nel Gantt — e qualsiasi cosa faccia l'assistente, la annulli con un solo Ctrl+Z.

È un modello fondamentalmente diverso dall'esportare un file, farlo modificare altrove e reimportarlo. Non c'è copia, non c'è formato intermedio e non c'è un momento in cui tu e l'assistente state guardando cose diverse. Questa guida mostra come attivarla, come collegare un assistente, cosa può e non può fare, e cosa provare quando non funziona.

## Cosa imparerai qui

- Attivare la modalità IA e trovare la scheda IA.
- Avviare il bridge, e farlo partire automaticamente con l'app.
- Collegare un assistente — con un prompt già pronto o un frammento di configurazione.
- Cosa può fare un assistente alla tua pianificazione.
- I controlli di sicurezza: pausa, sola lettura, backup automatico e il pannello attività.
- Cosa fare quando la connessione non riesce.

Il bridge funziona **solo nell'app desktop**. Nella versione browser la scheda IA è visibile, ma il server vero e proprio gira nella shell desktop e lì non può partire.

## Attivazione

La modalità IA è disattivata per impostazione predefinita. La attivi in **Impostazioni → Applicazione → Abilita modalità IA** — tramite l'icona a forma di ingranaggio, la scheda della barra multifunzione Impostazioni o File → Impostazioni; tutti e tre mostrano lo stesso interruttore.

Una volta attiva, nella barra multifunzione compare una scheda **IA** in più. Disattivi di nuovo la modalità IA e la scheda scompare, mentre un bridge in esecuzione viene fermato immediatamente — non resta quindi mai un server in ascolto senza che la scheda sia presente.

Sotto trovi **Avvia il bridge automaticamente**. Con questa opzione attiva, il server va live non appena apri l'app, così un assistente può collegarsi senza che tu debba prima visitare la scheda IA. È disattivata per impostazione predefinita: aprire una porta in ascolto sul tuo computer deve essere una scelta consapevole.

## La scheda IA

La scheda è composta da quattro gruppi.

**Server** — il pulsante **Avvia bridge** (o **Arresta bridge**) con accanto lo stato: *Disattivo*, *Attivo sulla porta 3877*, *Porta … occupata* o *Errore*. Lo stesso stato compare come pallino colorato in basso a destra nella barra di stato, così puoi vedere se il bridge è vivo anche da un'altra scheda.

**Connessione** — il numero di porta (modificabile solo mentre il server è fermo; un server in esecuzione mantiene la propria porta), il token e il pulsante **Connetti**. Il token è nascosto per impostazione predefinita; il pulsante a forma di occhio lo rivela, il pulsante di copia lo preleva, e **Nuovo token** ne genera uno nuovo. Attenzione: quest'ultima azione interrompe *ogni* connessione esistente, perché tutte portano il vecchio token — per questo l'app chiede prima conferma.

**Sicurezza** — **Metti in pausa**, **Sola lettura**, l'interruttore **Backup automatico**, e i pulsanti **Esegui backup ora** e **Apri cartella di backup**. Cosa fanno esattamente è descritto più avanti in *I controlli di sicurezza*.

**Attività** — il pulsante **Pannello attività** apre un elenco di ogni chiamata effettuata dall'assistente: orario, nome dello strumento, quanto ha impiegato e se è andata a buon fine. Ogni riga si può espandere per vedere gli argomenti e la risposta. Quello è il tuo registro: non devi fidarti sulla parola dell'assistente su cosa ha fatto.

## Collegare un assistente

Fai clic su **Connetti**. La finestra che si apre contiene quattro blocchi che puoi copiare uno alla volta:

1. **Endpoint** — l'indirizzo su cui il bridge è in ascolto, per impostazione predefinita `http://localhost:3877/mcp`. Il trasporto è HTTP in streaming.
2. **Autenticazione** — l'header HTTP che deve accompagnare ogni richiesta, nella forma `Authorization: Bearer …`.
3. **Frammento di configurazione** — un blocco JSON già pronto da incollare nella configurazione MCP del tuo client.
4. **Prompt di connessione** — un testo che incolli direttamente nel tuo assistente; si collega da solo e poi verifica il proprio elenco di strumenti.

Quest'ultimo è la via più rapida e funziona con qualsiasi assistente in grado di aggiungere server MCP. Il prompt è deliberatamente neutro rispetto al fornitore: nomina solo l'indirizzo, il token e cosa l'assistente deve controllare in seguito, così funziona allo stesso modo con un fornitore o con un altro.

Il collegamento è completo non appena l'assistente riesce a elencare i propri strumenti. Dovrebbe vederne circa quaranta, tutti che iniziano con `planner_`. Se non ne vede nessuno, il bridge non è avviato oppure il token è sbagliato.

Il token dà accesso al piano che hai aperto in questo momento. Trattalo come una password: non in un documento condiviso, non in una chat con altre persone.

## Cosa può fare un assistente

Gli strumenti coprono grosso modo tutto ciò che fai tu stesso nell'app:

- **Lettura** — panoramica del progetto, elenco attività, un'attività singola nel dettaglio, il percorso critico, le risorse e il loro istogramma, i calendari, le baseline e il confronto con una baseline.
- **Pianificazione** — creare attività (un'intera WBS con fasi e sottoattività in un colpo solo), modificarle, spostarle ed eliminarle; aggiungere, modificare e rimuovere relazioni; registrare l'avanzamento.
- **Configurazione** — creare e assegnare risorse, gestire calendari e giorni non lavorativi, salvare e attivare baseline, livellare.
- **Gestione** — creare, duplicare e cambiare documenti, importare file di pianificazione ed esportare in IFC.

Due cose contano più dell'elenco in sé.

**Un assistente può lavorare in un unico script.** Invece di chiamare uno strumento dopo l'altro, può inviare una sequenza di passaggi come un unico blocco. Non è solo più veloce: l'intero script diventa un solo passo nella tua cronologia. Se costruisce in un colpo solo una pianificazione di quaranta attività con tutte le relazioni, un solo Ctrl+Z la rimuove di nuovo. Se qualcosa va strutturalmente storto a metà strada, l'intero script viene annullato invece di lasciarti con una pianificazione a metà.

**La pianificazione viene ricalcolata dopo ogni modifica.** L'assistente non deve richiederlo separatamente e quindi non può per errore continuare a lavorare su date non aggiornate.

## Cosa un assistente non può fare

Il bridge è deliberatamente più ristretto dell'app. Ci sono alcune cose che un assistente non può fare, anche se glielo chiedi — riceve un rifiuto che spiega quale sia la strada giusta. Non è un blocco cieco: si tratta sempre di qualcosa che va oltre il progetto che stai guardando in quel momento.

**La libreria di risorse in sé.** Un assistente non può creare, modificare o eliminare una risorsa o un calendario di libreria. Una libreria è dato a livello di app condiviso da tutti i tuoi progetti, e le modifiche al suo interno restano fuori dalla normale cronologia di annullamento. Un'unica modifica di tariffa si ripercuoterebbe quindi su progetti che magari non sono nemmeno aperti, senza possibilità di tornare indietro. Questo lo fai tu, in File → Libreria.

**I campi fissi di una risorsa ereditata.** Se una risorsa proviene da una libreria, è quella libreria a decidere cos'*è* la risorsa: nome, tipo, descrizione, tariffa oraria e unità. Nella scheda Risorse quei campi compaiono non a caso come testo semplice — non puoi modificarli nemmeno lì — e l'assistente non può accedervi più di quanto puoi farlo tu. Quello che decide il *progetto* resta invece a sua disposizione: unità max., la disponibilità scaglionata nel tempo, il calendario e l'appartenenza alla squadra. Chiedi comunque una tariffa oraria diversa, e il rifiuto indica le due strade reali: modificarla nella libreria (vale allora per *ogni* progetto), oppure scollegare prima la risorsa dalla libreria — dopodiché è di proprietà del progetto e pienamente modificabile, e lo scollegamento stesso si annulla con Ctrl+Z.

**Quale calendario è il calendario di progetto.** Il contenuto di quel calendario può modificarlo, ma cambiare quale calendario usa il progetto è qualcosa che fai tu stesso nella libreria dei calendari. Vale lo stesso per opzioni di pianificazione come l'impostazione dei percorsi critici multipli.

**L'app in sé.** Non esiste uno strumento per impostazioni, tema, lingua, estensioni o l'aggiornamento. Un assistente non cambia nulla nel modo in cui è configurato il tuo programma.

**File — sì, ma entro limiti.** Importare significa che può leggere un file di pianificazione dal tuo disco, ed esportare significa che può scrivere un IFC. La scrittura è confinata alla tua cartella personale, e un file esistente non viene mai sovrascritto a meno che ciò non sia stato richiesto esplicitamente. Un'esportazione non è nemmeno un "salvataggio": il tuo documento resta contrassegnato come non salvato nell'app, quindi non può sostituire il tuo file di progetto alle tue spalle.

Quando richiede l'elenco delle risorse, un assistente vede subito quali risorse provengono da una libreria, a quale libreria appartengono e quali campi sono fissi. Non deve prima sbattere contro il muro per scoprirlo.

## I controlli di sicurezza

**Metti in pausa** mantiene il bridge attivo ma rifiuta ogni modifica; la lettura resta consentita. Utile quando vuoi fare qualcosa tu stesso senza interrompere la connessione.

**Sola lettura** fa la stessa cosa, ma come posizione fissa invece che come pausa: lascia che un assistente analizzi, riferisca o confronti la tua pianificazione, senza poterla modificare in alcun modo.

**Backup automatico** scrive automaticamente una copia IFC prima della prima modifica su un documento. Succede una volta per documento per sessione, così non accumuli una pila di file a ogni chiamata. **Esegui backup ora** lo fa immediatamente — comodo appena prima di lasciare che un assistente faccia qualcosa di drastico. **Apri cartella di backup** ti porta dove si trovano; l'app conserva gli ultimi dieci per documento.

A questo si aggiunge la normale cronologia di annullamento, che un assistente condivide con te. Tutto ciò che fa, puoi annullarlo — e può farlo anche l'assistente stesso, perché annulla e ripeti fanno parte del suo strumentario.

## Quando non funziona

**"Porta … occupata."** Qualcos'altro è già in ascolto su quella porta. Di solito è una seconda finestra di questa app: il bridge può servirne solo una alla volta. Chiudi l'altra finestra, oppure scegli un numero di porta diverso mentre il server è fermo.

**L'assistente non riceve risposta, o resta bloccato.** Succede quando la finestra dietro il server è scomparsa o è stata ricaricata. Arresta il bridge e riavvialo; se non basta, riavvia l'app. Se non sei sicuro che sia ancora vivo, controlla il pallino di stato nella barra di stato.

**L'assistente non vede strumenti, o segnala un errore di accesso.** Allora il token è sbagliato. Succede soprattutto dopo aver fatto clic su **Nuovo token** quando una connessione era già stabilita: l'assistente porta ancora con sé quello vecchio. Copia quello nuovo dalla finestra **Connetti** e aggiorna la configurazione del tuo client.

**Non succede nulla anche se l'assistente dice che ha funzionato.** Controlla il pannello attività per vedere cosa ha effettivamente chiamato e cosa è tornato indietro. Se c'è un rifiuto, indica quasi sempre anche il campo che era sbagliato e l'alternativa.

## Far pianificare bene il tuo assistente IA

Un assistente che conosce gli strumenti può comunque costruire un programma inutilizzabile per un pianificatore: attività senza legami, una data fissa su ogni attività, o una scomposizione troppo fine per essere mantenuta. I principi che lo evitano sono nella guida [Pianificare bene: dai requisiti a un programma affidabile](docs://gids-goed-plannen) — falla leggere al tuo assistente prima che inizi, oppure richiamala nelle tue istruzioni. Nel codice sorgente di Open Planner Studio c'è inoltre una breve skill per agenti sotto `.claude/skills/goed-plannen/`, che per i contenuti rimanda alla stessa guida e aggiunge solo ciò che è specifico dell'agente: in quale ordine usare gli strumenti `planner_` e che cosa riferire all'utente.

## Per saperne di più

- [Baseline e avanzamento](docs://gids-baselines-voortgang) — cosa fa la data di stato alla tua pianificazione. Bene saperlo prima di lasciarla impostare a un assistente: non è solo una data di riferimento, sposta in avanti anche il lavoro non ancora iniziato.
- [Im- ed esportazione](docs://gids-import-export) — come si relazionano tra loro IFC, CSV, MS Project e P6.
- [Impostazioni](docs://ref-instellingen) — tutte le impostazioni in un unico posto, compresi i due interruttori IA.
