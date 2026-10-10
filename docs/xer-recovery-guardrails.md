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
- **Het bronarchief gaat één keer naar de crashherstelopslag, niet per snapshot** (eigenaarsbesluit
  plan (9), 2026-09-22; gebouwd 2026-10-07, ontwerp `docs/superpowers/plans/2026-10-07-xer-archief-eenmalig.md`).
  `serializeRecoverySnapshot` schrijft in de snapshot alleen een verwijzing (pset-schema 3,
  `recovery-reference-v1`: lengte + SHA-256). De ruwe bronbytes staan als content-adressed blob
  (sleutel = sha256) naast de snapshots: Tauri `<base>.xerarchive.<sha256>.bin` (temp + rename, vóór de
  manifestcommit), web object-store `xer-archives` in `ops-recovery` v2, in dezelfde transactie als
  snapshots en manifest, bestaan/opruimen via `getAllKeys` (de blob wordt per tick niet gelezen).
  De bytes worden alleen gedecodeerd als de blob ontbreekt. Twaalf documenten uit één bestand delen
  één blob. Een blob verdwijnt zodra geen manifestregel hem nog noemt. Ontbreekt de blob bij herstel,
  dan opent het document met `xerArchiveIssue` `bytes-missing`. Opslaan als IFC schrijft het archief
  ongewijzigd volledig (schema 2).
- Tauri gebruikt manifestversie 5 (v4 + de archiefverwijzing `xerArchive` per document; v4 = v3 +
  `datesAsRecorded`). Nieuwe documentinhoud krijgt een immutable generatienaam. Eerst
  worden de volledige IFC-generaties via temp+rename gepubliceerd; daarna is de atomaire rename van
  het manifest het commitpunt; oude eigen generaties worden pas daarna opgeruimd.
- De webbackend leest per tick geen snapshotinhoud terug: alleen `getAllKeys()` op beide stores en
  de manifestrecords via `get` (sinds 2026-10-07; daarvoor las `getAll()` elke tick alle snapshots).
  Een andere generatie verloopt als haar manifest ouder is dan 7 dagen of ontbreekt.
- De SHA-256 van het bronarchief wordt bij openen en bij herstel vooraf native berekend
  (`precomputeSha256`, `crypto.subtle`; pure JS alleen als terugval). Zelfde algoritme, dus dezelfde
  content-adressering. rehab-2: 610–636 ms in pure JS tegen 31–32 ms native (Node 22).
- De webbackend schrijft document-upserts, manifest en verwijderingen in één strikte IndexedDB-
  `readwrite`-transactie. Een fout mag de persisted basis van de delta-tracker niet bevorderen.
- Recoverymanifesten van versie 1 tot en met 4 blijven leesbaar; hun snapshots dragen het archief
  ingebed en herstellen zonder blob; een manifest zonder
  `datesAsRecorded` levert `false` — het gewone #63-aanbod, nooit stilzwijgend de modus. Schema-1 en schema-2 XER-bronarchieven
  blijven eveneens leesbaar; schema 2 wordt in een koud proces via
  `readIFCWithXerReconstruction` uit uitsluitend de opgeslagen bronbytes herbouwd.
- Crashherstel zet "datums zoals opgeslagen" terug uit die metadata — niet uit een heuristiek over
  de opgeslagen datums, en voor ALLE herstelde documenten, ook de slapende. Een slapend document
  wordt bewust niet doorgerekend en krijgt daarom de modus zonder verschiltellertje (zie
  `applyRestoredRecordedMode`).
- De OZB-corpusfixture opent en herstelt twaalf niet-lege documenten. Eén edit herschrijft daarvan
  slechts één IFC-snapshot. De rehab-fixture herstelt haar bronbytes checksum-exact.

- **Een onbruikbaar archief gijzelt het project niet** (eigenaarsbesluit 2026-09-24, "openen met
  melding"; draait het XER-etappebesluit "geen legacy fallback" bewust om). Valideert een aanwezig
  archief niet — schemaversie, SHA-256, ontbrekende of afgeknotte chunks, onparseerbare metadata,
  pset-structuur, of een selector zonder archief-pset — dan levert `readIFC` het document ZONDER
  `xerSourceArchive`/`xerSourceProjectId`/`xer`/`recordedTimes` en MET een verplicht
  `ImportResult.xerArchiveIssue` (`{ code, detail }`, codes `schema-version`, `hash-mismatch`,
  `truncated`, `bytes-missing`, `metadata-invalid`, `structure`). Nooit een stille terugval: waren
  er archiefsporen (`OPS_XerSourceArchive` of `OPS_XerDocument`) en ontbreekt het archief, dan is
  het signaal er. Openen én crashherstel tonen één in-app melding (K8a-kanaal, "Lees meer" naar
  `gids-xer-import`); het signaal leeft per document in `DOCUMENT_FIELDS` (`xerArchiveIssue`, rol
  `none`), overleeft documentwissel en -kopie, maar staat bewust NIET in `IFC_SAVE_KEYS`: een
  opgeslagen bestand draagt geen archiefsporen meer, en heropenen is dus stil. MCP
  (`planner_inspect_xer_provenance`: `archiveIssue: { code }`) en de extensie-API
  (`data.getImportSourceIssue()`, permissie `importSource`) melden "geen archief (onbruikbaar bij
  openen: <code>)" in plaats van "geen XER-bron". Enige uitzondering die WEL gooit: een compact
  archief via de lage synchrone `readIFC` zonder reconstructor — dat is een aanroeperscontractfout,
  geen bestandseigenschap (`IfcParseError` `'xer-source-archive'`). Herstel voor de gebruiker: de
  originele `.xer` opnieuw importeren.

Deze grenzen worden afgedwongen door `check-xer-archive-recovery-once.ts` (budgetpoort per tick,
herstel via verwijzing, gedeelde blob, ontbrekende blob, oude snapshotvorm, opruimen), `check-recovery-delta.ts`,
`measure-xer-recovery-write-amplification.ts`, `check-recovery-isolation.ts`,
`check-xer-archive-cold-read.ts`, `check-xer-archive-recovery-corpus.ts` en — voor de
archief-terugval — `check-ifc-xer-archive-container.ts` (per foutcode één case),
`check-xer-archive-readmodel.ts`, `check-xer-archive-compact.ts` en
`check-xer-archive-fallback.ts` (echt beschadigde fixture `fixtures/xer-archief-herschreven.ifc`
door productie-ingang, store, melding, documentwissel, opslaan en crashherstel).

## Informatieve schaalmeting

Op 2026-08-28 gaf één Linux/Node 22-run de volgende waarnemingen:

- rehab-2, zelfstandige compacte IFC-ronde: bron 18.592.333 bytes, IFC 50.212.986 tekens,
  25,4 s walltime en 1.559.372 KiB peak RSS;
- rehab-2, volledige recoveryronde: 74,1 s walltime en 2.829.496 KiB peak RSS, met één document-
  upsert en één manifest-put voor de edit;
- OZB, twaalf documenten: gezamenlijk 4.630.032 IFC-tekens, 4,8 s walltime en 315.400 KiB peak RSS,
  eveneens met één document-upsert en één manifest-put.

Op 2026-10-07 (Linux/Node 22, zelfde meetscript vóór en na het één-keer-schrijven, headless
IndexedDB-dubbel):

- rehab-2, bewerkingstick: vóór 60.459.788 bytes en 2,47 s; na 35.660.682 bytes en 1,42 s. De rest is de
  planning zelf (±35 MB IFC zonder archief), niet het archief. Eerste tick na: 35,7 MB snapshot plus
  één blob van 18,6 MB. Herstel: vóór 18,9 s, na 14,7 s.
- OZB, twaalf documenten: eerste tick vóór 4.820.412 bytes (twaalf ingebedde kopieën), na 2.069.829
  bytes (één blob); bewerkingstick vóór 398.672, na 154.522 bytes.

De bytes zijn de poort (`check-xer-archive-recovery-corpus.ts`: een bewerkingstick schrijft nul
archiefbytes en minstens 1,3 × de bron minder dan een ingebedde snapshot). Deze tijd- en RSS-cijfers
zijn bewust **geen pass/fail-drempels**. CPU, beschikbare RAM, garbage
collection, kernel/page-cache en CI-host verschillen te sterk. De corpuscheck eist wel dat de
metingen positief en eindig zijn, zodat een kapotte of overgeslagen probe niet groen kan lijken.
Regressies worden primair op de structurele schrijfvermenigvuldiging en checksum-exact herstel
gepoord; tijd en RSS blijven zichtbaar voor trendvergelijking.
