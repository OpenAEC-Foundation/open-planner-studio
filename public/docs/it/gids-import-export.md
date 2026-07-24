# Importazione/esportazione

Open Planner Studio memorizza un progetto come IFC per impostazione predefinita — nessun file di
progetto separato accanto ad esso. Ma a volte una pianificazione deve anche vivere fuori dall'app: in
Primavera P6, in Microsoft Project, o come tabella semplice per un foglio di calcolo. Questa guida
spiega cosa significa esattamente "IFC è il formato nativo", cosa porta e non porta ogni formato di
esportazione, e dove vivono l'importazione/esportazione nell'app.

## Cosa imparerai qui

- Cosa significa precisamente "IFC è il formato nativo" per l'apertura e il salvataggio.
- Cosa viene incluso e cosa no esportando verso MS Project (MSPDI) e Primavera P6 XML.
- Cosa contiene l'esportazione CSV — e cosa è deliberatamente escluso.
- Dove importare ed esportare: **Backstage → Esporta** e **Backstage → Importa**.
- Come le estensioni possono aggiungere formati di importazione extra.

## IFC: il formato nativo

Un progetto di Open Planner Studio *è* un file IFC 4x3 (lo standard buildingSMART). Non c'è un file
JSON o di progetto separato accanto ad esso: **Salva** e **Apri** (Backstage, oppure **Ctrl+S**/**Ctrl+O**)
leggono e scrivono IFC direttamente. Questo significa che tutto ciò che fai nell'app — attività, WBS,
relazioni con vincoli, risorse e assegnazioni, calendari (sia il calendario di progetto sia i calendari
risorsa), baseline, progresso, note, codici attività e campi personalizzati, collegamenti esterni tra
progetti — finisce nello stesso file e torna integralmente la volta successiva che lo **apri**. Se ti
imbatti in un nuovo tipo di dati di progetto nell'app, puoi presumere che faccia il round-trip
attraverso IFC; se qualcosa *non* fa il round-trip, viene segnalato esplicitamente qui sotto.

IFC è anche il modo in cui questa app si collega al resto del toolkit OpenAEC: lo stesso file può
essere letto dal software BIM per il collegamento 4D (pianificazione insieme al modello dell'edificio).

## Esportazione verso altri formati

Apri **Backstage → Esporta** per quattro formati:

- **CSV (separato da punto e virgola)** — esportazione tabella universale. Tutte le attività con date
  e durate.
- **MS Project XML** — si apre in Microsoft Project. Struttura WBS completa.
- **Primavera P6 XML** — per Oracle Primavera P6.
- **IFC 4x3** — lo standard buildingSMART, lo stesso del formato nativo (comodo come "salva come" su
  un file separato, o per condividere una copia senza toccare il resto dei tuoi documenti aperti).

Ogni formato ha le proprie limitazioni: più ricco è il formato di destinazione, più cose vengono
incluse, ma nessuno dei tre formati esterni è uno specchio completo di IFC.

### CSV

L'esportazione CSV contiene **solo la tabella delle attività**: codice WBS, nome, durata (giorni),
inizio, fine, predecessori (come codice testuale, es. `2.1FS+3d`), tipo di attività, stato,
completamento (%), inizio/fine effettivi, critica (sì/no), margine totale e descrizione. **Risorse,
assegnazioni, calendari e baseline sono deliberatamente esclusi** — il CSV è puramente una tabella
delle attività per chi vuole visualizzare o modificare la pianificazione in un foglio di calcolo, non
uno scambio di progetto ad alta fedeltà. Quando **importi** di nuovo un file CSV, le baseline restano
quindi vuote (non c'era nulla da cui leggerle).

### MS Project XML (MSPDI)

MSPDI è considerevolmente più ricco del CSV: risorse, assegnazioni (compresa la loro curva di
caricamento), calendari e baseline vengono inclusi. Tuttavia, non tutto è esprimibile in MSPDI. In fase
di esportazione l'app avvisa nella console degli sviluppatori (`console.warn`) ogni volta che qualcosa
va perso, con il numero esatto degli elementi interessati:

- I **collegamenti esterni** tra progetti vengono eliminati (il riferimento "fantasma" dell'altra
  attività resta solo in-app).
- I **vincoli morbidi Start On/Finish On** (MSO/MFO morbidi) vengono degradati a SNET/FNET — i codici
  MSPDI 2/3 sono *rigidi* (Must), quindi il limite superiore della variante morbida viene perso. MSO/MFO
  rigidi si esportano esattamente.
- I **vincoli secondari** vengono persi — MSPDI ha solo un campo vincolo per attività.
- Le **attività hammock** (durata derivata) vengono esportate come attività normale con le date
  calcolate — MSPDI non ha un tipo hammock/LOE nativo.
- Le **note delle attività** deliberatamente **non** vengono esportate, anche se MSPDI ha un campo
  `<Notes>`: le nostre note sono una checklist con caselle di spunta che non si traduce in modo pulito
  in testo semplice.
- La **definizione del percorso critico** (modalità/soglia quasi critico) e altre opzioni di
  pianificazione non sono esprimibili nativamente in MSPDI e vengono quindi perse — quelle si
  conservano solo tramite IFC.

### Primavera P6 XML

Lo stesso tipo di compromesso di MSPDI, con alcune particolarità specifiche di P6:

- I **collegamenti esterni** e le **attività hammock** vengono eliminati/semplificati nello stesso modo
  di MSPDI, ciascuno con un avviso.
- Anche qui le **note delle attività** vengono escluse — il P6 XML non ha un campo adatto per esse.
- Il **ritardo percentuale** su una relazione (es. 40% della durata del predecessore) viene "cristallizzato"
  in un numero fisso di giorni, perché P6 non ha un concetto di ritardo percentuale.
- Il **ritardo in giorni di calendario** (ritardo in giorni trascorsi anziché lavorativi) viene esportato
  come un ritardo semplice basato sulle ore — P6 non ha un'unità di ritardo separata per relazione.
- La curva di caricamento **LATE_PEAK** non ha un equivalente P6 e viene esportata come l'approssimazione
  più vicina ("Early Peak").
- Le opzioni di pianificazione (come con MSPDI) non vengono esportate.

Questi avvisi non sono trascuratezza — sono una scelta deliberata ed esplicita: un avviso visibile per
ogni elemento eliminato batte una perdita di dati silenziosa. Apri, ad esempio, l'esempio
[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (ha note sulle
attività e una relazione con un ritardo percentuale) ed esporta verso P6 o MS Project XML: la console
degli sviluppatori mostra allora esattamente quali elementi sono stati eliminati o semplificati, e quanti.

## Importazione

**File → Apri** (o **Backstage → Apri**) accetta file `.ifc`, `.csv` e `.xml`. Per un file `.xml`,
l'app rileva da sola se si tratta di un file Primavera P6 o MS Project, in base al contenuto. Come
descritto sopra: un'importazione CSV o P6 produce un progetto **senza baseline** (non ce n'erano
nell'origine), mentre IFC e MSPDI le includono.

## Importatori tramite estensioni

Oltre ai formati fissi sopra descritti, le estensioni installate possono aggiungere i propri
importatori — ad esempio per un formato non supportato per impostazione predefinita. Questi compaiono
sotto **Backstage → Importa**, ciascuno con il proprio nome, descrizione ed estensioni di file
corrispondenti; senza estensioni di importazione installate, quella sezione è vuota. Controlla
**Backstage → Estensioni** per vedere cosa è disponibile.

## Per saperne di più

- Le baseline vengono incluse solo tramite IFC e MS Project XML, non tramite CSV o P6 — leggi la guida
  [Baseline e avanzamento](docs://gids-baselines-voortgang) per come registrare una baseline.
- Risorse, assegnazioni e curve di caricamento — leggi la guida
  [Risorse, istogramma e livellamento](docs://gids-resources-histogram) per come si costruiscono prima
  di esportare.
