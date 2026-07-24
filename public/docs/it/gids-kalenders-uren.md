# Calendari e pianificazione oraria

Un'attività con una durata di "5 giorni" significa qualcosa solo in combinazione con un calendario: quali giorni sono lavorativi, in quali ore si lavora, e quali giorni cadono a causa di una festività o di una chiusura temporanea? Questa guida copre il calendario di progetto, i calendari risorsa e la pianificazione oraria opzionale per chi vuole pianificare fino al livello dell'ora.

## Cosa imparerai qui

- Impostare il calendario di progetto: giorni lavorativi, orari di lavoro, festività.
- Generare automaticamente le festività per anno, comprese le ferie edili.
- Aggiungere una chiusura ad-hoc una tantum (ad esempio una sospensione per gelo).
- Dare a una risorsa il proprio calendario, ad esempio per una settimana lavorativa di 4 giorni.
- Attivare l'interruttore principale **Pianificazione oraria** e impostare fasce orarie di lavoro/turni.
- Come coesistono nella stessa pianificazione le attività basate sui giorni e quelle basate sulle ore.

Segui con [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (sospensione per gelo, calendario risorsa a 4 giorni) e con [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (pianificazione oraria per il lavoro di armatura e getto), entrambi disponibili anche tramite **File → Esempi**.

## Il calendario di progetto

I calendari si gestiscono nella finestra **Calendari**, aperta tramite il gruppo della barra multifunzione **Calendario** sulla scheda **Pianificazione** (sia il pulsante **Calendario** sia **Festività** aprono la stessa finestra). Questa finestra mostra una libreria di ogni calendario nel progetto a sinistra — non solo il calendario di progetto, ma anche eventuali calendari risorsa (vedi sotto) — con una stella che contrassegna quale calendario è attualmente il **Calendario del progetto**. Seleziona un calendario a sinistra e modificalo a destra; usa **Imposta come predefinito del progetto** per rendere un calendario diverso dall'elenco il nuovo calendario di progetto. Per il calendario selezionato imposti:

- **Giorni lavorativi** — quali dei sette giorni della settimana (da lunedì a domenica) contano come giorno lavorativo. Da lunedì a venerdì per impostazione predefinita.
- **Orario di lavoro** — **Inizio (ora)**, **Fine (ora)** e le **Ore al giorno** risultanti.
- **Festività** — un elenco di giorni di chiusura, ciascuno con una **Descrizione** e una data **Da**/**A**.

Le modifiche al calendario di progetto hanno effetto immediato nel calcolo: le attività che altrimenti cadrebbero su un giorno ora non lavorativo si spostano al giorno lavorativo successivo.

### Generare automaticamente le festività

Invece di digitare le festività una per una, puoi generarle automaticamente tramite **Genera festività…** nella finestra del calendario. Scegli un **Paese** (Paesi Bassi, Germania, Belgio, Francia, Regno Unito, Austria, Svizzera) e facoltativamente una **Regione**. Per i Paesi Bassi c'è anche un'opzione specifica per l'edilizia: **Ferie edili**, con la scelta tra **Nord**, **Centro** o **Sud** (o **Nessuna**). Le date delle ferie edili generate sono date indicative — l'app avvisa di questo essa stessa: verifica le date esatte con Bouwend Nederland per l'anno in corso. Dopo aver scelto paese/regione, la finestra mostra un'anteprima — ad esempio "12 festività, 1-1-2026–31-12-2026" — prima di fare clic su **Genera**.

Se generi le festività per un progetto che attraversa un confine d'anno o viene esteso in seguito, Open Planner Studio riconosce che le festività già generate non coprono più l'intero periodo del progetto e la finestra offre **Rigenera** per aggiungere gli anni mancanti — senza perdere alcuna festività aggiunta manualmente in precedenza.

### Chiusure ad-hoc (ad esempio una sospensione per gelo)

Non ogni interruzione del lavoro è una festività ricorrente annuale. Per chiusure una tantum specifiche del progetto — una settimana di sospensione per gelo, una chiusura per un evento locale — aggiungi semplicemente una riga extra manualmente tramite **Aggiungi festività** nello stesso elenco: dalle una **Descrizione** (ad esempio "Sospensione per gelo") e un periodo **Da**/**A**. Una chiusura ad-hoc di questo tipo funziona tecnicamente in modo identico a una festività generata — il calcolo CPM ne tiene conto allo stesso modo — ma è separata dalla generazione automatica annuale, quindi una successiva **Rigenera** non la sovrascriverà.

Vedi un periodo di sospensione per gelo in pratica nell'esempio [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): la fondazione condivisa delle sei case include un periodo di sospensione per gelo aggiunto come voce separata simile a una festività sul calendario, distinta dalle festività olandesi generate automaticamente.

## Calendari risorsa

Oltre all'unico calendario di progetto, ogni risorsa può ottenere il proprio calendario — ad esempio per un subappaltatore disponibile solo quattro giorni a settimana, mentre il resto del progetto procede a cinque giorni. I calendari risorsa si gestiscono tramite il campo **Calendario** sulla risorsa (con il pulsante **Modifica…** accanto) o il titolo della finestra **Calendario risorsa**; per impostazione predefinita una risorsa è impostata su **Calendario di progetto**.

Un calendario risorsa usa lo stesso modulo del calendario di progetto (**Giorni lavorativi**, **Orario di lavoro**, **Festività**), ma è puramente informativo per la risorsa: non cambia nulla nelle date CPM proprie dell'attività. Ciò che influisce è il **carico** (istogramma) e il **livellamento**: se una risorsa è impostata su una settimana di 4 giorni mentre l'attività a cui è assegnata dura 5 giorni lavorativi, il carico della risorsa mostra una carenza il quinto giorno, e la finestra di livellamento (**Livella risorse**) avvisa che la risorsa non lavora tutti i giorni di cui l'attività ha bisogno — spostare entro il margine non risolverà automaticamente quel disallineamento di calendario.

Vedi un calendario risorsa a 4 giorni in pratica: gli installatori in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) lavorano sul proprio calendario con una settimana lavorativa ridotta, mentre il resto del progetto continua a lavorare sul normale calendario di progetto.

## Pianificazione oraria: l'interruttore principale

Per impostazione predefinita, Open Planner Studio lavora interamente a **granularità giornaliera** — ogni attività ha una durata in giorni (lavorativi) interi. Per le attività che preferisci pianificare all'ora (pensa a un getto che inizia alle 7:00 e deve essere terminato entro le 14:00, ben prima che il tempo cambi), c'è la **Pianificazione oraria** opzionale.

Attiva l'interruttore principale tramite **Impostazioni → Sequenza temporale / Zoom → Attiva pianificazione oraria**. Questo aggiunge una scala temporale oraria, turni con fasce orarie di lavoro e barre attività precise all'ora; con l'interruttore disattivato, l'app funziona interamente come prima, a granularità giornaliera. C'è anche un'opzione **Consenti pianificazione mista giorno/ora**, che attivi se vuoi combinare attività basate sui giorni e sulle ore nello stesso progetto (vedi sotto).

## Fasce orarie di lavoro e turni

Con la pianificazione oraria attiva, il calendario ottiene un livello extra: invece di solo "giorno lavorativo sì/no", imposti **fasce orarie di lavoro** per giorno (la sezione **Orari di lavoro** nella finestra del calendario) — gli esatti intervalli di tempo durante i quali si lavora. Uno spazio vuoto tra due fasce diventa automaticamente una pausa; per pianificare una pausa, regola semplicemente gli orari delle fasce adiacenti in modo che appaia uno spazio vuoto.

Per non dover disegnare le fasce a mano ogni volta, ci sono **preimpostazioni di turno** già pronte:

- **Turno diurno** — orario d'ufficio regolare, una fascia per giorno.
- **2 turni** — due turni consecutivi.
- **3 turni** — tre turni consecutivi, che coprono quasi l'intera giornata.
- **Turno notturno** — un turno che passa oltre la mezzanotte.
- **24/7** — funzionamento continuo, senza interruzione.

Oltre a queste preimpostazioni, puoi anche **Impostare per giorno della settimana…** le fasce completamente a mano, ad esempio se venerdì è più corto del resto della settimana. Hai composto una combinazione tua che vuoi riutilizzare più spesso? Salvala con **Salva come preimpostazione…** — la preimpostazione è memorizzata localmente su questo dispositivo e può poi essere scelta di nuovo in qualsiasi progetto. La sezione mostra anche le **Ore/giorno derivate**: il numero di ore lavorative effettive che deriva dalle fasce configurate.

## Attività basate sulle ore

Con la pianificazione oraria attiva e un'attività su un **calendario orario** (un calendario con fasce orarie di lavoro anziché solo giorni interi), la finestra di modifica dell'attività mostra campi extra: **Durata (ore)** accanto a **Durata (giorni)**, e un totale in **Ore totali**. Un calendario orario è richiesto per l'inserimento in ore — prova a inserire ore su un normale calendario giornaliero e il suggerimento lo segnala.

Questo è esattamente come vengono pianificate in pratica le attività di getto: un'attività "Vloer storten toren A" (Getto pavimento torre A) con una durata, diciamo, di 6 ore, collegata a un calendario a turni che ha un turno mattutino quel giorno. Vedi questo schema nel grande esempio [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), che usa la pianificazione oraria per il lavoro di armatura e getto.

## Mescolare attività basate sui giorni e sulle ore

Un progetto non deve funzionare interamente a ore per beneficiare della pianificazione oraria: con **Consenti pianificazione mista giorno/ora** selezionato, le attività basate sui giorni (sul normale calendario di progetto) e le attività basate sulle ore (su un calendario orario) possono coesistere e relazionarsi tra loro nella stessa pianificazione. In questo caso la tabella delle attività mostra la durata di ogni attività nella propria unità — un'attività a giorni in giorni, un'attività a ore in ore — e avvisa in fondo alla tabella quando attività con ore/giorno diverse procedono affiancate, così resta chiaro quali confronti sono omogenei e quali no.

## Continua a leggere

- Vedi una sospensione per gelo e un calendario risorsa a 4 giorni in pratica: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Vedi la pianificazione oraria per il lavoro di armatura e getto in pratica: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Le relazioni e il ritardo/anticipo funzionano sulle stesse unità di calendario — leggi [Relazioni e vincoli](docs://gids-relaties-constraints) per la differenza tra ritardo in giorni lavorativi e in tempo trascorso.
