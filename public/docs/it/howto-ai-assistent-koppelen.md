# Collegare un client MCP

Obiettivo: consenti a un client MCP di seguire la tua pianificazione e di lavorarci, con visibilità su ciò che fa e con limiti che imposti tu.

## Rapido: lascia fare a Claude

Lavori con Claude Desktop o Claude Code? Allora Claude può installare da solo la connessione:

1. Clicca su *Copia prompt* qui sotto.
2. Incolla il prompt in una nuova chat con Claude e invialo.

Claude installa poi l'estensione per Open Planner Studio e spiega strada facendo cosa fa. Se devi fare tu qualcosa, per esempio cliccare *Installa* in Claude Desktop, Claude ti dice esattamente quale clic fare. Non ti serve un token per questo.

```prompt
Installa per me l'estensione Open Planner Studio, così da poter leggere e modificare le mie pianificazioni di costruzione in Open Planner Studio. Fai il più possibile da solo. Prima di ogni passo, spiega in una sola frase semplice cosa stai per fare e perché. Se hai bisogno di me, chiedi una cosa alla volta e aspetta la mia risposta. Se devo fare qualcosa io stesso, dimmi esattamente quale singolo clic o azione fare, e dove.

Cosa devi sapere:
- L'estensione è un unico file, open-planner-studio-<version>.mcpb, nell'ultima release: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. Il link diretto si trova in https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (il file il cui nome finisce in .mcpb). Il file è un file ZIP.
- L'estensione funziona con l'app desktop Open Planner Studio e anche senza l'app. Quando l'app è aperta e il suo bridge MCP è in esecuzione, lavori nella pianificazione aperta nell'app. Quando l'app è chiusa, lavori sui file di pianificazione in una cartella di lavoro che scelgo io.
- L'installazione non richiede né token né password. Non chiedermene uno e non leggerne né mostrarne uno.

Se usi Claude Desktop:
1. Se puoi scaricare un file e aprirlo sul mio computer, fallo con il file .mcpb. Se non puoi, dammi il link diretto per il download e dimmi di fare doppio clic sul file quando il download è completato.
2. Claude Desktop mostra poi l'estensione Open Planner Studio. Dimmi di cliccare Installa. Poi dimmi di scegliere, in Working folder, la cartella con i miei file di pianificazione.
3. Dimmi di avviare una nuova chat e di chiederti lì quali strumenti di Open Planner Studio vedi.

Se usi Claude Code:
1. Controlla che sia installato Node.js 22 o una versione più recente. Se non è installato, dimmi come installarlo e fermati.
2. Chiedimi quale cartella contiene i miei file di pianificazione. Quella è la cartella di lavoro.
3. Scarica il file .mcpb e decomprimilo in una nuova cartella propria nella mia cartella utente. Leggi lì manifest.json: server.mcp_config indica come si avvia il server. Sostituisci ${__dirname} con la cartella decompressa e ${user_config.workdir} con la cartella di lavoro.
4. Esegui claude mcp list. Se c'è già un server con il nome open-planner-studio, chiedimi se puoi sostituirlo. Non mostrare le sue impostazioni, perché possono contenere un token.
5. Aggiungi il server per il mio account utente, per esempio: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<cartella di lavoro> -- node <cartella decompressa>/server/index.mjs
6. Dimmi di avviare una nuova sessione di Claude Code, e che /mcp lì mostra se open-planner-studio è connesso.

Se ti trovi altrove, per esempio in claude.ai nel browser, dimmi che serve Claude Desktop o Claude Code. Se non sai in quale programma ti trovi, chiedimelo.

Quando l'installazione è completata, spiega in poche frasi:
- come ti permetto di lavorare nell'app aperta: in Open Planner Studio, scegli Impostazioni › Progetto › Impostazioni app, scheda Avanzate, e attiva Consenti connessione MCP. Poi clicca su Avvia bridge nella scheda MCP.
- che senza l'app una modifica è nel file solo dopo che lo salvi, e che non sovrascrivi un file esistente mentre l'app è aperta.
Se un passo fallisce, dimmi in una frase cosa è andato storto e cosa posso fare io. Non indovinare.
```

Preferisci farlo da solo, oppure usi un altro client MCP? Allora segui i passi qui sotto.

## Quando ti serve questo

Vuoi che un client MCP legga, analizzi o modifichi la tua pianificazione. Per esempio per fargli preparare una prima WBS, correggere attività o spiegare il percorso critico. Questo funziona tramite il **Model Context Protocol** (MCP): uno standard che permette a un programma di intelligenza artificiale, il **client MCP**, di usare gli strumenti di un altro programma. Per questo Open Planner Studio avvia sul tuo computer un piccolo server, il **bridge**. Offre una serie di strumenti, tutti con un nome che inizia con `planner_`: lettura e modifica di attività, relazioni, risorse, calendari, baseline, documenti e file. Quali sono e che cosa rifiutano è descritto in [Strumenti MCP](docs://ref-ai-tools). Il client MCP lavora nel progetto che hai aperto, non in una copia: un'attività che aggiunge compare subito nel Gantt. Usa lo stesso calcolo e la stessa cronologia di *Annulla* che usi tu.

Il bridge funziona solo nell'app desktop. Se consenti la connessione MCP nel browser, vedi la scheda *MCP*, ma il pulsante *Avvia bridge* è grigio con il testo *Il bridge funziona solo nell'app desktop.* Il resto di questo articolo riguarda l'app desktop. Nel browser sono grigi anche *Esegui backup ora* e *Apri cartella di backup*.

## Passaggi

### 1. Consenti il collegamento MCP

1. Scegli *Impostazioni › Progetto › Impostazioni app*. Puoi anche scegliere *File › Impostazioni app*, oppure l'icona a ingranaggio in alto.
2. Scegli la scheda *Avanzate* e attiva *Consenti collegamento MCP*. La scheda *MCP* compare nella barra multifunzione.
3. Se vuoi che il bridge sia attivo appena si avvia l'app, attiva anche *Avvia il bridge automaticamente*. Questa opzione funziona solo con il collegamento MCP attivo, e solo nell'app desktop. È disattivata per impostazione predefinita, perché aprire una porta è una scelta deliberata.

Se disattivi il collegamento MCP, il bridge si arresta e la scheda *MCP* scompare.

### 2. Avvia il bridge

1. Vai alla scheda *MCP* e clicca su *Avvia bridge* sotto *Server*.
2. Guarda lo stato accanto al pulsante. Può dire *Disattivo*, *Attivo sulla porta 3877*, *Porta 3877 occupata* o *Errore*. Se l'avvio riesce, dice *Attivo sulla porta 3877* e il pulsante si chiama *Arresta bridge*. Con *Porta 3877 occupata* o *Errore* il pulsante resta *Avvia bridge*; vedi i problemi possibili.

Il bridge ascolta solo sul tuo computer, su una porta. Per impostazione predefinita è la 3877. Nel gruppo *Connessione* puoi scegliere un'altra porta sotto *Porta*, ma solo mentre il bridge è arrestato. Il collegamento è HTTP semplice sul tuo computer. L'app stessa non invia nulla all'esterno. Quello che il client MCP fa con la tua pianificazione, per esempio quello che il suo fornitore ne fa, è al di fuori dell'app.

### 3. Collega il client MCP

1. Clicca su *Connetti* sotto *Connessione*. Si apre la finestra *Dettagli di connessione*.
2. Scegli ciò che serve al tuo client, vedi sotto.
3. Il token è nascosto. Con l'icona dell'occhio lo mostri. I pulsanti di copia copiano sempre il valore reale, anche se lo schermo nasconde il token.
4. Fai chiedere al client MCP l'elenco degli strumenti. Questo controllo è anche nel prompt di connessione: il client dovrebbe vedere gli strumenti con il prefisso `planner_`; il numero atteso è nel prompt di connessione.

La finestra offre quattro modi per collegarti:

- *Lascia fare a Claude*: lo stesso prompt che trovi in cima a questo articolo, con il pulsante *Copia prompt*. È per Claude Desktop e Claude Code. Per questo non serve un token.
- *Frammento di configurazione*: un pezzo di configurazione che incolli nelle impostazioni MCP del tuo client.
- *Prompt di connessione*: un testo che incolli nel tuo client MCP, dopodiché si collega da solo.
- *Endpoint* e *Autenticazione*: i dettagli separati. L'endpoint è `http://localhost:3877/mcp` con trasporto *streamable HTTP*. Ogni richiesta ha bisogno di un'intestazione `Authorization: Bearer` seguita dal tuo token. Anche il tuo client deve supportare le sessioni MCP: quando si collega, il bridge dà un codice di sessione nell'intestazione `Mcp-Session-Id`, e rifiuta ogni richiesta successiva senza quel codice. Claude Code e `mcp-remote` lo fanno da soli.

**Collegati di nuovo dopo un aggiornamento dell'app.** Se il tuo client MCP era già collegato a una versione più vecchia dell'app, non invia ancora un codice di sessione, e il bridge rifiuta ogni richiesta. Quindi collegati di nuovo dopo l'aggiornamento: avvia una nuova sessione in Claude Code, e chiudi del tutto Claude Desktop, poi riavvialo.

**Claude Code.** Il frammento di configurazione funziona direttamente con Claude Code. Esegui questo comando in un terminale, con il tuo token al posto di `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Puoi anche mettere il frammento nel file `.mcp.json` nella cartella del progetto. Non inserire quel file in git, perché il token dà accesso al tuo piano. Un server da `.mcp.json` va approvato la prima volta in Claude Code.

**Claude Desktop.** Per Claude Desktop c'è un'estensione: il file `open-planner-studio-<version>.mcpb`. Con un doppio clic Claude Desktop la installa. Non ti serve Node.js per questo. L'estensione funziona con l'app e senza l'app. Con il prompt in cima a questo articolo è più rapido; sotto trovi i passaggi a mano.

1. Scarica il file `.mcpb` dall'ultima versione: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Fai doppio clic sul file. Claude Desktop si apre e mostra l'estensione *Open Planner Studio*. Installala. Se il doppio clic non funziona, apri *Impostazioni › Estensioni* in Claude Desktop e installa lì il file.
3. Alla voce *Cartella di lavoro* scegli la cartella con i tuoi file di pianificazione. Claude usa questa cartella solo quando l'app è chiusa. Claude legge e scrive poi solo in quella cartella.
4. Attiva l'estensione e avvia una nuova chat. Chiedi a Claude quali strumenti di Open Planner Studio vede.

Non inserisci un token né una porta: mentre il bridge è attivo, l'estensione trova l'app da sola. Per ogni domanda di Claude, l'estensione sceglie di nuovo:

- *L'app è aperta e il bridge è attivo*: Claude lavora nel piano aperto nell'app. Ogni modifica compare subito nell'app.
- *L'app è chiusa, oppure il bridge è spento*: Claude lavora su un file di pianificazione nella cartella di lavoro. Una modifica è nel file solo quando Claude salva il file. Non c'è salvataggio automatico. Mentre l'app è aperta, Claude non sovrascrive un file esistente, ma salva con un nuovo nome.

Se l'app si apre o si chiude mentre Claude lavora, l'estensione passa all'altra modalità e lo comunica a Claude. Claude sceglie o apre di nuovo il piano, e solo dopo cambia qualcosa. Se Claude ha ancora modifiche senza l'app che non sono salvate, l'estensione continua a lavorare senza l'app finché Claude non le ha salvate. Così non va perso nessun lavoro. Se l'estensione non riesce a raggiungere l'app e non c'è una cartella di lavoro utilizzabile, Claude vede solo lo strumento `open_planner_studio_status`, con un messaggio che ti dice cosa fare.

**Claude Desktop senza l'estensione.** Se non puoi usare l'estensione, collega Claude Desktop con lo strumento esterno `mcp-remote`. Il frammento di configurazione non si adatta direttamente a Claude Desktop: nel file `claude_desktop_config.json` indichi un programma che Claude Desktop avvia da solo, non un indirizzo. `mcp-remote` richiede Node.js. In Claude Desktop scegli *Impostazioni › Sviluppatore › Modifica configurazione*, metti questo nel file (con il tuo token) e riavvia Claude Desktop:

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

Il token sta in `env` e non in `args` apposta: su Windows Claude Desktop spezza un argomento che contiene uno spazio. Un *connettore personalizzato* in Claude (*Personalizza › Connettori*) non funziona con il bridge. Claude si collega allora dal cloud di Anthropic, e quel cloud non può raggiungere il bridge sul tuo computer.

Nel gruppo *Connessione* c'è anche il campo *Token*. È un codice lungo e casuale che l'app crea per te e salva su questo computer. Nella finestra c'è scritto *Questo token dà accesso al piano aperto. Non condividerlo con altri.* Con l'icona *Nuovo token* crei un nuovo token. L'app chiede prima *Generare un nuovo token interrompe tutte le connessioni esistenti. Continuare?* Se il bridge è attivo, si riavvia con il nuovo token e quello vecchio non funziona più.

**Come l'estensione trova l'app.** Mentre il bridge è attivo, l'app desktop scrive la porta e il token nel file `mcp/runtime.json` nella cartella dati dell'app. L'estensione per Claude Desktop legge quel file per ogni domanda. Su Linux e macOS solo il tuo account utente può leggere il file. Su Windows la ACL predefinita della tua cartella profilo protegge il file; l'app non controlla questo separatamente. Quando arresti il bridge o disattivi il collegamento MCP, l'app rimuove il file. L'app tiene anche una lista dei file aperti in `mcp/open-files.json`, anche quando il collegamento MCP è disattivato. Finché quel file esiste, l'estensione e il server MCP headless non sovrascrivono nessun file esistente, nemmeno un file che hai appena aperto e che non è ancora nella lista. Un nuovo file è permesso. Leggere è permesso anche: Claude vede allora la versione su disco, senza le tue modifiche non ancora salvate.

### 4. Vedi cosa fa il client MCP

1. Clicca su *Pannello attività* sotto *Attività*. Nella colonna laterale si apre il pannello *Attività MCP*.
2. Ogni chiamata del bridge è su una riga, la più recente in alto: ora, cosa è successo, quanto tempo ha richiesto e se è riuscita oppure no. Clicca su una riga per espandere *Argomenti* e *Risposta*.
3. Con *Svuota* svuoti l'elenco. Il pannello conserva le ultime 500 chiamate. Finché non è successo nulla, dice *Ancora nessuna attività MCP. Le chiamate del bridge compaiono qui.*

Con il collegamento MCP attivo, in basso a destra nella barra di stato c'è un punto con *MCP*. Il suo colore mostra lo stato del bridge, e un clic su di esso ti porta alla scheda *MCP*.

### 5. Imposta i limiti

Sotto *Sicurezza* ci sono i pulsanti con cui limiti il client MCP:

- *Metti in pausa*: il client MCP non può cambiare nulla per il momento, la lettura resta permessa. Il bridge resta attivo. Il pulsante diventa *Riprendi*.
- *Sola lettura*: tutti gli strumenti che cambiano qualcosa vengono rifiutati mentre questa opzione è attiva.
- *Backup automatico: attivo*: prima della prima modifica del client MCP in un documento, l'app scrive un backup IFC. Questo è attivo per impostazione predefinita. Con il pulsante lo disattivi, e allora dice *Backup automatico: disattivo*. Questo avviene una volta per documento ogni volta che avvii il bridge.
- *Esegui backup ora*: crea subito un backup del documento attivo. Dopo dice *Backup creato:* con il nome del file.
- *Apri cartella di backup*: apre la cartella con i backup.

I backup si trovano nella cartella `ai-backups` nella cartella dati dell'app. L'app conserva i backup recenti e sfoltisce quelli più vecchi; il funzionamento esatto è descritto in [Strumenti MCP](docs://ref-ai-tools).

### 6. Fai pianificare bene il client MCP

Un client MCP pianifica bene solo se conosce le regole di pianificazione. Questo lo fai tu stesso:

1. **Non fare nulla per le regole principali.** Arrivano da sole quando ti colleghi: il bridge le invia nel campo `instructions` dello scambio iniziale MCP. Se il tuo client le inserisce nel suo prompt di sistema, dipende dal client.
2. **Fai leggere la guida.** Il prompt di connessione della finestra *Dettagli di connessione* chiede al client MCP di leggere la guida con lo strumento `planner_get_planning_guide`. Se non usi il prompt, scrivi al client: *Leggi prima la guida alla pianificazione con planner_get_planning_guide, prima di modificare qualcosa.* Puoi leggere tu stesso la guida su `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Facoltativo: installa le skill.** Funziona solo con un client MCP che supporta le skill. Metti il `SKILL.md` di *goed-plannen* e *progress-update* in `.claude/skills/goed-plannen/SKILL.md` e `.claude/skills/progress-update/SKILL.md` nella cartella del progetto in cui lavora il client MCP, oppure sotto `~/.claude/skills/` per ogni progetto.

Ci sono due modi per ottenere i file. Chiedi al client MCP di chiamare lo strumento `planner_get_planning_guide` con `part` impostato su `skill`: la risposta contiene entrambi i testi e, per ogni skill, i punti in cui vanno. Oppure scaricali da `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` e `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Se *goed-plannen* è ancora presente da una versione più vecchia dell'app, sostituiscilo: quel vecchio testo è in olandese e rimanda all'articolo di aiuto invece che alla guida per i client MCP.

Se il client MCP ha letto davvero la guida, lo vedi nel *Pannello attività*: c'è allora una chiamata a `planner_get_planning_guide`. La risposta finale dovrebbe contenere un elenco di ipotesi: durate stimate, la scomposizione scelta, le relazioni che ha creato da sé e ogni vincolo che ha impostato. Se quell'elenco manca, chiedilo. Dopo un aggiornamento di avanzamento secondo *progress-update*, la risposta dovrebbe indicare la data di stato, la nuova data di fine e lo scostamento rispetto alla baseline.

## Problemi possibili e cosa fa l'app in quel caso

**Il client MCP cambia qualcosa che vuoi annullare.** Ogni modifica del client MCP è un passaggio che annulli con *Annulla* (Ctrl+Z). Una serie di modifiche che il client MCP invia in un unico blocco è un solo passaggio. Dopo, il progetto risulta non salvato. Dopo una modifica la pianificazione viene ricalcolata, quindi non devi premere tu stesso F5.

**L'app rifiuta una chiamata del client MCP.** Con *Metti in pausa* e *Sola lettura* l'app rifiuta tutte le modifiche, mentre la lettura resta possibile, incluso il ricalcolo di una pianificazione non aggiornata. Se stai facendo tu una modifica, per esempio trascinando una barra o scrivendo in un campo, il client MCP riceve le date di prima della tua modifica, con un avviso che non sono più aggiornate. Se hai aperta una finestra di dialogo, per esempio le impostazioni, una finestra di attività o la finestra di benvenuto, oppure se la modalità presentazione è attiva, l'app rifiuta tutte le chiamate, compresa la lettura, finché non chiudi la finestra. Il client MCP riceve allora un messaggio di errore con il nome interno di ciò che è aperto, per esempio `showTaskDialog`. Solo `planner_get_planning_guide` continua a funzionare, perché non legge la tua pianificazione.

**Passi da una scheda all'altra mentre il client MCP sta lavorando.** Il client MCP lavora sul documento in cui è finita la sua prima modifica. Se nel frattempo cambi scheda, l'app rifiuta la sua modifica successiva finché non conferma che vuole lavorare sull'altra scheda. Così niente finisce nel progetto sbagliato. Se il client MCP apre o duplica lui stesso un documento, da quel momento lavora in quel nuovo documento.

**Il client MCP scrive o apre un file.** Il client MCP può scrivere una pianificazione come file IFC e aprire un file di pianificazione in una nuova scheda. Può farlo solo nella tua cartella utente. Sovrascrive un file esistente solo se lo chiede esplicitamente.

**Lo stato è *Porta 3877 occupata*.** Un altro programma usa la porta. Sotto lo stato compare il messaggio dell'app. Il campo porta resta allora bloccato (*Modificabile solo quando il server è arrestato.*), anche se il bridge non è attivo, e non c'è un pulsante di arresto. È un difetto noto. Finché non è risolto: disattiva e riattiva *Consenti collegamento MCP*. Lo stato torna allora a *Disattivo* e puoi scegliere un'altra porta. Copia poi di nuovo i dettagli di connessione, perché l'endpoint contiene la porta.

**Il client non riesce a collegarsi dopo un nuovo token.** Un nuovo token interrompe tutte le connessioni esistenti. Dai al client il nuovo token, oppure incolla di nuovo il frammento di configurazione. L'estensione in Claude Desktop legge da sola il nuovo token; lì non devi fare nulla.

**Hai arrestato tu il bridge e non si avvia da solo.** *Avvia il bridge automaticamente* funziona una volta ogni volta che l'app si avvia. Se arresti tu il bridge, l'app non lo riattiva di nascosto.

**La scheda *MCP* non c'è più.** Il collegamento MCP è disattivato. Attivalo al passaggio 1.

**Una pagina web nel tuo browser non può parlare con il bridge.** Il bridge rifiuta ogni richiesta che arriva da un browser, e ogni richiesta senza il token giusto.

## Senza l'app

Esiste anche un server MCP che funziona senza l'app desktop: il **server MCP headless**. Offre gli stessi strumenti `planner_*`, ma lavora su un file di pianificazione sul disco invece che sul progetto aperto. Quindi non vedi le modifiche nel diagramma di Gantt, e *Annulla* nell'app non si applica a queste modifiche. Usalo quando non vuoi tenere aperta l'app, o su un computer senza schermo.

L'estensione per Claude Desktop avvia da sola questo server quando l'app è chiusa (vedi il passo 3). I passi seguenti sono per un altro client MCP, come Claude Code.

La versione non include un server pronto da scaricare. Lo compili tu dal codice sorgente con `npm run build:mcp-server`; per questo ti serve Node.js 22 o più recente. Il risultato è un solo file, `server.mjs`.

1. Scegli una cartella di lavoro con i tuoi file di pianificazione. Il server legge e scrive solo in quella cartella.
2. Collega il tuo client MCP. Per Claude Code, il comando si trova sotto questi passi.
3. Chiedi al client MCP di aprire una pianificazione, per esempio `~/plan.ifc`. In questo server, `~` indica la cartella di lavoro.
4. Chiedi al client MCP di salvare il risultato. Non c'è un salvataggio automatico: il client MCP scrive il file con `planner_export_ifc`. Ciò che non viene salvato va perso quando il server si arresta.

Per il passo 2 con Claude Code, dai questo comando in un terminale, con i tuoi percorsi:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Prima della prima modifica di ogni documento, il server crea un backup MCP, come l'app. Un client MCP che sceglie un percorso fuori dalla cartella di lavoro, anche tramite una scorciatoia (link simbolico), riceve un rifiuto. Mentre l'app è aperta, il server non sovrascrive un file esistente.

## Vedi anche

- [Inviare un feedback](docs://howto-feedback-geven): se il collegamento funziona in modo diverso da quanto descritto qui, segnalalo.
- [Strumenti MCP](docs://ref-ai-tools): tutti gli strumenti `planner_*` per gruppo, i codici di errore e per quanto tempo si conservano i backup.
- [Impostazioni dell'app](docs://ref-instellingen): le impostazioni MCP.
