# Pianificare bene

Che cosa rende buona una pianificazione? Non il suo aspetto ordinato, ma se risponde alla domanda che conta quando i lavori sono in corso: se questo slitta, che cosa succede alla consegna? Questo articolo spiega i principi di una pianificazione affidabile, e perché pesano così tanto in Open Planner Studio: l'app calcola con ciò che inserisci, e con nient'altro.

Gli esempi vengono dal settore edile: opere strutturali, lavorazioni di finitura, tempi di approvvigionamento, ritardi dovuti al maltempo, subappaltatori e una data di consegna contrattuale. I principi in sé, però, non sono specifici del settore edile.

## Il concetto

Una buona pianificazione non è un'immagine di ciò che speri, ma un **modello di calcolo**: attività con una durata, collegate da relazioni, in un calendario. L'app calcola le date da quel modello. Quando qualcosa cambia, il modello si ricalcola e vedi subito che cosa significa per il resto.

Un pianificatore lavora in un ordine fisso:

1. L'obiettivo: cardini e data di consegna.
2. La scomposizione: fasi, pacchetti di lavoro, attività.
3. La durata di ogni attività.
4. Le relazioni.
5. Vincoli e date fisse.
6. Calendari.
7. Risorse.
8. Percorso critico e margine.
9. Baseline e avanzamento.
10. Verifica.

Quell'ordine non è una questione di buone maniere. Se salti un passo, poi ti trovi davanti a una sorpresa: le attività senza relazioni non si spostano con le altre, le durate senza calendario sono sbagliate e una baseline che salvi solo dopo congela il ritardo invece dell'accordo.

## Come calcola l'app con questo

Ogni principio qui sotto è collegato a qualcosa che l'app fa. Per questo questa parte segue lo stesso ordine.

### Parti dall'obiettivo, non dalle attività

Fissa per prima cosa i momenti fissi, e solo dopo il lavoro che deve entrare tra di essi: inizio della preparazione del cantiere, permesso definitivo, edificio impermeabile, inizio delle finiture, consegna. Questi sono **cardini**. Sono punti senza durata, che devi inserire come cardine (*Home › Attività › Cardine ▾*), e non come attività di zero giorni con un nome che somiglia a un cardine.

Perché questo ordine: una pianificazione che parte da un elenco di attività diventa una somma, e una somma raramente cade sulla data del contratto. Parti dai cardini e la domanda giusta è subito chiara: non «quanto tempo richiede tutto insieme», ma «il lavoro sta tra questi due momenti e, se no, che cosa deve cambiare». Risali dalla data di consegna richiesta fino al momento in cui l'edificio deve essere impermeabile al più tardi, e da lì fino all'inizio.

Una consegna fissata dal contratto riceve la casella di controllo *Obbligatoria (contrattuale)*. Così chi apre il file vede che questo momento non è né negoziabile né spostabile. La casella è un marcatore per il Gantt e per i report; non protegge una data. Per quello usi una scadenza o un vincolo (vedi sotto).

### La scomposizione: fasi, pacchetti di lavoro, attività

Sotto i cardini costruisci la struttura: fasi, sotto di esse pacchetti di lavoro, sotto questi le attività. Lo fai con i rientri. Un'attività con sottoattività diventa automaticamente un'**attività di riepilogo**: l'app ricava la sua barra e la sua durata dalle attività che stanno sotto di lei. Quindi non inserire mai tu una durata per un'attività di riepilogo.

Vale come regola pratica per il dettaglio: **un'attività dura da circa un giorno a due settimane**. Più corta di un giorno significa che pianifichi il lavoro operativo del cantiere invece del progetto. Quello appartiene al piano settimanale del direttore di cantiere, non a un modello di calcolo che deve durare per mesi. Più lunga di due settimane significa un'attività che non puoi stimare bene e non puoi seguire durante l'esecuzione: «finishing ground floor, 40 days, 45% complete» non dice a nessuno se le cose vanno bene. Nelle revisioni della pianificazione si conta quindi spesso quante attività durano più di circa due mesi; sopra qualche percento questo vale come mancanza di dettaglio.

Troppo fine fa altrettanto danno di troppo grossolano. Ogni attività richiede manutenzione: relazioni da creare, avanzamento da registrare, una nuova valutazione dopo ogni modifica. Una pianificazione di duemila attività per un progetto di sei mesi non diventa più precisa, diventa impossibile da tenere aggiornata. E una pianificazione che nessuno aggiorna è finzione entro tre settimane. Scegli il livello al quale puoi riferire l'avanzamento in modo onesto, ogni settimana.

In pratica: «3. Finishing» è una fase, «Finishing house 4» un pacchetto di lavoro, «Plastering house 4 ground floor» un'attività di cinque giorni. Puoi superare di proposito il limite superiore per i tempi di consegna e la sorveglianza: la consegna dei serramenti di dieci settimane è davvero un unico blocco indivisibile di attesa, e la sorveglianza continua appartiene a un hammock, non a una serie di pezzi artificiali.

### Stimare la durata

Una durata è una stima di quanto dura il lavoro, non di quanto potrebbe andare veloce. Stima per una giornata normale con la squadra che avrai davvero, non per la giornata migliore con la squadra migliore. L'ottimismo si accumula lungo la catena: una pianificazione in cui ogni attività presuppone la giornata migliore quasi mai rispetta la data di consegna.

Giorni o ore è una scelta reale, non una questione di formato. Scegli **giorni** per il lavoro che detta il ritmo in cantiere, come muratura, intonacatura e piastrellatura: dura cinque giorni, anche se una giornata ha otto o nove ore. Scegli **ore** quando le ore stesse sono l'unità e conta quello che resta della giornata: un'ispezione di tre ore, un getto di calcestruzzo di quattordici ore spalmato su due giorni, il lavoro a turni. L'app salva questa scelta per ogni attività. La trovi solo dopo aver attivato prima *Attiva pianificazione oraria*; vedi [Giorni e ore](docs://uitleg-dagen-en-uren).

Non nascondere il rischio nelle singole durate. Aggiungere un giorno ovunque seppellisce il margine, così che nessuno lo vede più o può guidarlo. E dove il margine serviva davvero, si scopre che è troppo piccolo. Rendi visibile la riserva: un'attività di riserva esplicita prima della data di consegna, oppure una tolleranza separata per il meteo. Attenzione alla doppia conta: i circa 180 giorni lavorativi utili all'anno con cui il settore edile olandese fa i suoi conti sono un valore annuo contrattuale (UAV). Da questo valore sono già sottratte le festività, la chiusura collettiva del settore *e* i giorni persi. Se le festività e la chiusura sono già nel tuo calendario di progetto, resta come voce separata solo il ritardo dovuto al meteo. I ritardi per gelo e tempesta seguono le proprie regole nel contratto collettivo Onwerkbaar weer Bouw & Infra. Inserisci quei giorni persi previsti nel calendario o in una voce separata, non nascosti nella durata della muratura.

### Relazioni: senza una rete non è una pianificazione

L'app calcola le date lungo le **relazioni**: un'attività inizia solo quando glielo permettono i suoi predecessori. Un'attività senza relazioni non è legata a nulla. Se le opere strutturali slittano di due settimane, un'attività di finitura scollegata non segue, e la pianificazione dice il falso senza che nulla diventi rosso.

Per questo ogni attività ha almeno un predecessore e almeno un successore. Fanno eccezione solo la prima attività del progetto e l'ultimo cardine. Nelle revisioni della pianificazione questo è il primo controllo: non più di qualche percento delle attività può avere una logica mancante.

**Fine-inizio è il predefinito**, e deve restare così: fondazione completata, poi opere strutturali. In una pianificazione edile sana circa nove relazioni su dieci sono fine-inizio. È un requisito di leggibilità: fine-inizio è l'unico tipo che tutti in cantiere capiscono senza spiegazione, e durante l'esecuzione si comporta in modo prevedibile.

**Inizio-inizio con ritardo** serve per il lavoro che davvero corre in parallelo invece di aspettare. Il caso classico è una fila di case a schiera o una torre con piani: l'installatore segue tre giorni dopo la muratura. Quello è un inizio-inizio con ritardo di tre giorni, non un fine-inizio su un'attività spezzettata artificialmente. Aggiungi accanto un fine-fine, altrimenti il successore in teoria potrebbe finire prima del predecessore. In edilizia non si usa quasi mai l'inizio-fine.

Collega preferibilmente quell'inizio-inizio tra attività, non tra fasi. Se il predecessore di un inizio-inizio o inizio-fine è una fase, l'app fa aspettare il successore fino all'attività di quella fase che inizia **per ultima**, non fino a quella che inizia per prima. Così non pianifica mai troppo presto, ma a volte più tardi di quanto volevi. Fine-inizio e fine-fine con una fase come predecessore aspettano che finisca l'ultima attività della fase, e di solito è esattamente quello che intendi.

Usa i ritardi con parsimonia, e soprattutto quelli negativi. Un ritardo è tempo di attesa senza una ragione visibile: più tardi nessuno sa dire perché ci sono sette giorni in mezzo. Se si tratta di maturazione del calcestruzzo, fallo come ritardo in giorni di calendario (il calcestruzzo matura anche nel fine settimana), oppure, meglio ancora, come vera attività «curing» che tutti possono vedere e seguire. Un ritardo negativo — un anticipo, una sovrapposizione — non dovrebbe proprio esserci; nelle revisioni della pianificazione la norma è zero. Se vuoi una sovrapposizione, dividi il predecessore oppure usa un inizio-inizio.

### Vincoli e date fisse: il meno possibile

Ogni attività parte «il più presto possibile», e nella grande maggioranza dei casi deve restare così. Un **vincolo** è un limite di data accanto alle relazioni. Più ne aggiungi, meno la pianificazione calcola e più diventa un disegno. Un piano pieno di date fisse sembra stabile e proprio per questo nasconde il rischio: non si sposta più, quindi non avvisa più.

Usa un vincolo solo per una data esterna e rigida su cui la pianificazione stessa non ha influenza: il permesso che non sarà definitivo prima del 1 marzo (*Iniziare non prima del (SNET)*), la finestra di chiusura concessa dal comune, la data di allacciamento della società di distribuzione. «Voglio questa attività a maggio» non è un fatto esterno; lo risolvi con la logica o con una durata diversa. Come regola pratica: al massimo qualche percento delle attività rimanenti porta un limite di data rigido.

Non inserire mai una data di inizio per fissare un'attività nella posizione voluta. Per un'attività con un predecessore, l'app trasforma un inizio digitato (o trascinato) in un vincolo *Iniziare non prima del (SNET)*. L'attività si trova allora dove vuoi, e ci resta anche quando tutta la catena prima di lei ritarda.

Se vuoi controllare una data senza guidare il calcolo, usa una **scadenza**. Non sposta niente, ma dà un margine negativo e un avviso non appena l'attività non la rispetta più: esattamente il segnale che vuoi vedere. Riserva un blocco rigido (*Obbligatorio (logica di blocco)*) per il caso estremo, e tieni presente che così si genera un margine negativo nella catena che lo precede: è la pianificazione che segnala che non ci sta, non che qualcosa è rotto.

### Calendari: prima il progetto, poi le eccezioni

Tutte le durate si contano in giorni lavorativi o in ore lavorative di un calendario. Imposta quindi bene il calendario di progetto prima di inserire le durate: giorni lavorativi, orari di lavoro, festività e ferie edili. Un calendario che correggi a metà sposta tutta la pianificazione. Aggiungi subito le chiusure prevedibili: il periodo di gelo in cui non si getta calcestruzzo, la chiusura aziendale tra Natale e Capodanno.

Dai a una risorsa un calendario proprio solo se è davvero diverso: il posatore di facciate che lavora quattro giorni alla settimana, la squadra che fa una vacanza estiva diversa. Un calendario di risorsa non cambia nemmeno una data di un'attività; quella continua a seguire il calendario dell'attività o del progetto. Mostra solo che la risorsa non lavora in uno dei giorni lavorativi dell'attività: nell'istogramma compare come risorsa sovrassegnata. Quella differenza è difficile da capire se non sai di averla creata tu.

### Risorse: chi lo fa, e se è possibile

Una pianificazione senza risorse risponde solo a metà della domanda. Appena assegni squadre e attrezzature, l'istogramma mostra quello che una sola linea temporale non mostra: che il 14 giugno ti servono tre squadre di intonacatori, mentre ne hai due.

Inizia dalle risorse che stringono. Non ogni vite deve entrarci; la gru a torre, le tue squadre, i subappaltatori con un limite di capacità e i lunghi tempi di consegna sì. Dai a ogni risorsa una capacità onesta: due intonacatori vuol dire due, non «due, ma in emergenza tre».

Leggi l'istogramma come una domanda, non come un errore. Rosso sopra la linea vuol dire che la pianificazione chiede più di quello che hai in quel giorno. A volte la risposta è: spostare le attività. Spesso la risposta è: così non funziona, e questo volevo sapere. Il **livellamento** sposta le attività finché la domanda rientra nella capacità. Se la data di fine può respirare, lascialo fare; se la data di consegna è fissa, livella solo entro il margine (la casella *Livella solo entro il margine (attenuazione) — la data di fine progetto resta invariata*). La data di fine allora resta dov'è, e ti resta un conflitto residuo segnalato: un risultato più onesto di una pianificazione che sembra solo risolta.

*Non* livellare quando la domanda è strutturalmente più grande della capacità. Il livellamento riorganizza nel tempo il lavoro che c'è già; non assume altri intonacatori e non costruisce una seconda gru. Tre torri che richiedono la stessa squadra nello stesso momento restano tre torri che richiedono la stessa squadra dopo il livellamento; l'unica cosa che cambia è che la consegna si sposta. Ciò che aiuta allora è dividere in fasi, aggiungere capacità o fare lavori diversi. Non livellare nemmeno prima che logica e durate siano pronte: livelleresti una pianificazione che domani sarà diversa.

### Percorso critico e margine: dove la pianificazione è vulnerabile

L'app non ricalcola a ogni modifica. Lancia il calcolo con **Calcola** (F5) e leggi solo dopo. Se la barra di stato dice *Non aggiornato — ricalcola (F5)*, stai guardando il calcolo precedente, non quello attuale. Con l'impostazione *Calcola automaticamente* l'app lo fa da sola.

Il **percorso critico** è la catena senza margine: ogni giorno perso lì è un giorno in più per la consegna. Lì vanno la tua sorveglianza e le tue persone migliori. Non guardare solo il rosso. Il **margine totale** dice di quanto un'attività può ritardare senza influire sulla consegna; il **margine libero** dice di quanto può ritardare senza spostare il suo successore. La differenza non cambia la data di fine di nessuno, ma intralcia qualcuno: utile quando lavori con subappaltatori che non puoi pianificare due volte.

Osserva tre segnali. Un'attività con pochi giorni di margine non è un'attività sicura ma una quasi critica; con *Contrassegna quasi critico* queste attività ricevono un colore proprio. Un'attività con un margine estremo — nelle revisioni della pianificazione più di 44 giorni lavorativi, circa due mesi — manca quasi sempre di un successore; ti indica subito i buchi nella tua rete. E un margine negativo non è mai un errore di calcolo: è la pianificazione che dice che una scadenza o una data fissa non ci sta.

### Baseline prima dell'inizio, poi tienila aggiornata

Salva una **baseline** appena la pianificazione è approvata e prima che il primo colpo di vanga tocchi il terreno (*Pianificazione › Baseline e progresso › Gestisci baseline…*). Calcola prima: la baseline salva le date dell'ultimo calcolo. Senza quel riferimento più tardi puoi dire solo *che* le cose vanno diversamente, non di quanto né da quando. Proprio questo ti serve in una riunione di cantiere, per lavori extra e quando si discute di ritardi.

Una baseline salva le date, ma non le ipotesi alla base di esse, e proprio su quelle si chiede appena si parla di ritardi. Quindi, quando la salvi, scrivi in breve su che cosa si basa questa pianificazione (nella pratica: la *base della pianificazione*): quali valori di produttività hai usato, quale calendario e perché è impostato così, che cosa hai escluso di proposito dalla pianificazione, chi ha fornito i tempi di consegna che hai ipotizzato e chi ha approvato la pianificazione. Mezza pagina basta.

Dopo questo, tenerla aggiornata è un ritmo, non un progetto. Aggiorna ogni settimana, nello stesso ordine: imposta la **data di stato** sulla data di rendicontazione, inserisci l'inizio effettivo e la fine effettiva per ciò che è iniziato e finito, correggi la durata rimanente di ciò che è in corso, e calcola. Una percentuale da sola non basta: le date effettive sono la registrazione dei fatti che più tardi verrà controllata.

Sappi che cosa fa la data di stato: il lavoro non ancora iniziato viene spostato dall'app alla data di stato, e le attività che seguono si spostano con lui (eccetto nel profilo di calcolo Microsoft Project). Quindi, se dimentichi di chiudere un'attività o un cardine finito, si sposta da sola verso destra. Non è un errore, ma il modello che rifiuta di fingere che qualcosa nel passato possa ancora accadere. Se ricevi un avviso *Fuori sequenza*, il lavoro è stato fatto in un ordine diverso da quello che la logica prescrive. Di solito è un motivo per rivedere la sequenza, non per cliccare via l'avviso. Crea una nuova baseline solo per un vero cambio di ambito, e poi accanto alla prima, non sopra di essa.

Infine: una pianificazione è affidabile solo se chi fa il lavoro ci crede. Fai confrontare il piano settimanale con questo modello al direttore di cantiere e ai subappaltatori. Se settimana dopo settimana raggiungi solo metà di quanto concordato, il problema sta più spesso nella pianificazione che nell'esecuzione.

## Esempio svolto: tre scelte che rendono la pianificazione inesatta in silenzio

I numeri vengono da due esempi svolti altrove nella Guida: il progetto di esercizio *House extension* dei tutorial e una piccola rete per un ampliamento. Qui conta che cosa fa ogni scelta alla tua pianificazione. Puoi provarlo tu stesso nel tutorial 2 (relazioni e percorso critico) e nel tutorial 3 (un vincolo e una scadenza).

### Una relazione dimenticata

Nell'ampliamento, i lavori iniziano lunedì 7 giugno 2027 e la consegna è venerdì 6 agosto. *Build outer cavity leaf* (6 giorni lavorativi) ha *Install window frames* come successore, perché i telai si trovano nella facciata. Con quella relazione il paramento esterno ha 2 giorni lavorativi di margine.

Se dimentichi quella relazione, il paramento esterno ha di colpo 23 giorni lavorativi di margine, fino alla consegna. Sulla carta può ritardare di settimane senza che nessuno ne sia in attesa. Non diventa nulla di rosso e non compare alcun avviso. Solo con l'opzione di calcolo *Attività a estremità aperta critiche* un'attività del genere, senza successore, diventa critica, e così la lacuna si nota.

### Una data inserita invece di una relazione

La piccola rete: *Groundwork* (3 giorni lavorativi), *Pour foundation* (2), *Brickwork* (5) e *Roofing* (3), uno dopo l'altro, da lunedì 7 giugno 2027. Il progetto finisce mercoledì 23 giugno.

Se inserisci come inizio lunedì 21 giugno per *Brickwork*, perché i mattoni arrivano solo allora, questo diventa un vincolo di tipo *iniziare non prima del (SNET)*. *Brickwork* si sposta di una settimana e il progetto finisce mercoledì 30 giugno. *Groundwork* e *Pour foundation* ottengono 5 giorni lavorativi di margine e non sono più critiche. Se i mattoni arrivano dopotutto prima, *Brickwork* resta al 21 giugno: ora comanda la data, non la logica.

Se invece inserisci mercoledì 9 giugno, prima che le fondamenta siano finite, non succede nulla: le relazioni fanno comunque iniziare *Brickwork* solo lunedì 14 giugno.

### Una scadenza invece di un vincolo

Se vuoi che *Roofing* finisca venerdì 18 giugno, inserisci lì una scadenza. Non si sposta nulla: *Roofing* resta da lunedì 21 a mercoledì 23 giugno. Però la catena ottiene −3 giorni lavorativi di margine e l'app segnala *Scadenza 18-06-2027 superata — fine anticipata 23-06-2027*. Così vedi subito che l'accordo non torna, invece di una barra nel posto giusto con dietro una catena che non ci arriva.

## Conseguenze e idee sbagliate

- **Attività senza predecessore o successore.** È l'errore più comune e il più dannoso: queste attività non si spostano con il resto e ottengono un margine falso.
- **Inserire date o trascinare barre invece di creare le relazioni tra le attività.** Così imposti in silenzio un vincolo.
- **Troppi vincoli, e un vincolo fisso usato come segnalibro.** La pianificazione allora non si calcola più, si limita a disegnare.
- **Attività di tre mesi, o di mezza giornata.** L'intervallo utile va da circa un giorno a due settimane.
- **Durate ottimistiche, e margine nascosto in ogni singola attività** invece di essere visibile come riserva.
- **Fermi per maltempo e ferie edili non inseriti nel calendario.** Finiranno comunque nel calendario, a gennaio.
- **Ritardi invece di attività.** Sette giorni di attesa senza nome sono incomprensibili tre mesi dopo.
- **Eseguire il livellamento prima che la logica sia definita**, o continuare a eseguirlo con una carenza strutturale di capacità.
- **Dimenticare di calcolare.** *Non aggiornato* nella barra di stato significa che stai guardando il calcolo precedente.
- **Nessuna baseline, o una baseline salvata solo dopo l'inizio.**
- **Avanzamento registrato solo come percentuale**, senza date effettive e senza data di stato.
- **Chiudere il pannello *Avvisi* senza leggerlo.** È lì che si raccolgono le scadenze superate, i vincoli violati, le relazioni fuori sequenza e le risorse sovrassegnate (*Pianificazione › Pianificazione › Avvisi*).

## Vedi anche

- [Percorso critico e margine](docs://uitleg-kritiek-pad): come l'app calcola le date anticipate e le date più tarde, e il margine.
- [Relazioni e ritardo](docs://uitleg-relaties): i quattro tipi di relazione, il ritardo e le relazioni su una fase.
- [Vincoli e scadenze](docs://uitleg-constraints): che effetto hanno ogni vincolo e una scadenza sul calcolo.
- [Calendari e giorni lavorativi](docs://uitleg-kalenders): come l'app conta i giorni lavorativi e quale calendario prevale.
- [Giorni e ore](docs://uitleg-dagen-en-uren): pianificare in giorni, in ore o in modo misto.
- [Livellamento delle risorse](docs://uitleg-nivelleren): che cosa sposta il livellamento e che cosa no.
- [Avanzamento, data di stato e baseline](docs://uitleg-voortgang): che cosa fa la data di stato e come leggere lo scostamento.
- [Aggiungere attività e cardini](docs://howto-taken-en-mijlpalen-toevoegen): inserire i cardini e le attività.
- [Aggiungere relazioni](docs://howto-relaties-leggen): collegare le attività tra loro.
- [Collegare un assistente IA (MCP)](docs://howto-ai-assistent-koppelen): un assistente che pianifica secondo questi principi.
- [Notifiche e avvisi](docs://ref-meldingen): tutti gli avvisi in un unico posto.
