# XER-bronarchief en crashherstel — technische vangrails

Deze notitie beschrijft de opslaggrens van de X9-implementatie. Het doel is niet om de actuele
machineprestaties als productspecificatie vast te leggen, maar om te voorkomen dat een latere
optimalisatie opnieuw alle open documenten serialiseert of een half gecommitte herstelset kan
publiceren.

## Harde, machine-onafhankelijke grenzen

- De recoverydelta vergelijkt de volledige `IFCSaveSource` via `sameIFCSource`. `isDirty`, het
  actieve tabblad, bestandspaden én de weergavestand "datums zoals opgeslagen"
  (`datesAsRecorded`) zijn manifestmetadata; ze zijn geen inhoudsrevisie. Een wissel van die
  weergavestand is dus wél een manifestcommit — anders zou de vlag pas bij de volgende
  inhoudswijziging op schijf landen, precies de ronde waarin een crash hem kwijt zou zijn.
- Eén inhoudsbewerking serialiseert precies één keer met `writeIFC` en levert precies één volledige
  IFC-upsert. De overige open documenten houden hun bestaande snapshot.
- Een actieve-documentwissel is metadata-only: nul IFC-upserts, één manifestcommit.
- Tauri gebruikt manifestversie 4 (v3 + `datesAsRecorded` per document). Nieuwe documentinhoud krijgt een immutable generatienaam. Eerst
  worden de volledige IFC-generaties via temp+rename gepubliceerd; daarna is de atomaire rename van
  het manifest het commitpunt; oude eigen generaties worden pas daarna opgeruimd.
- De webbackend schrijft document-upserts, manifest en verwijderingen in één strikte IndexedDB-
  `readwrite`-transactie. Een fout mag de persisted basis van de delta-tracker niet bevorderen.
- Recoverymanifesten van versie 1, 2 en 3 blijven leesbaar; een manifest zonder
  `datesAsRecorded` levert `false` — het gewone #63-aanbod, nooit stilzwijgend de modus. Schema-1 en schema-2 XER-bronarchieven
  blijven eveneens leesbaar; schema 2 wordt in een koud proces via
  `readIFCWithXerReconstruction` uit uitsluitend de opgeslagen bronbytes herbouwd.
- Crashherstel zet "datums zoals opgeslagen" terug uit die metadata — niet uit een heuristiek over
  de opgeslagen datums, en voor ALLE herstelde documenten, ook de slapende. Een slapend document
  wordt bewust niet doorgerekend en krijgt daarom de modus zonder verschiltellertje (zie
  `applyRestoredRecordedMode`).
- De OZB-corpusfixture opent en herstelt twaalf niet-lege documenten. Eén edit herschrijft daarvan
  slechts één IFC-snapshot. De rehab-fixture herstelt haar bronbytes checksum-exact.

Deze grenzen worden afgedwongen door `check-recovery-delta.ts`,
`measure-xer-recovery-write-amplification.ts`, `check-recovery-isolation.ts`,
`check-xer-archive-cold-read.ts` en `check-xer-archive-recovery-corpus.ts`.

## Informatieve schaalmeting

Op 2026-08-28 gaf één Linux/Node 22-run de volgende waarnemingen:

- rehab-2, zelfstandige compacte IFC-ronde: bron 18.592.333 bytes, IFC 50.212.986 tekens,
  25,4 s walltime en 1.559.372 KiB peak RSS;
- rehab-2, volledige recoveryronde: 74,1 s walltime en 2.829.496 KiB peak RSS, met één document-
  upsert en één manifest-put voor de edit;
- OZB, twaalf documenten: gezamenlijk 4.630.032 IFC-tekens, 4,8 s walltime en 315.400 KiB peak RSS,
  eveneens met één document-upsert en één manifest-put.

Deze tijd- en RSS-cijfers zijn bewust **geen pass/fail-drempels**. CPU, beschikbare RAM, garbage
collection, kernel/page-cache en CI-host verschillen te sterk. De corpuscheck eist wel dat de
metingen positief en eindig zijn, zodat een kapotte of overgeslagen probe niet groen kan lijken.
Regressies worden primair op de structurele schrijfvermenigvuldiging en checksum-exact herstel
gepoord; tijd en RSS blijven zichtbaar voor trendvergelijking.
