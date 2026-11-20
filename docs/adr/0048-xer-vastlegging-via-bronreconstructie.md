# "Datums zoals opgeslagen" na een XER-import overleeft IFC via het bronarchief, niet via een eigen pset

Een XER-import legt P6's rekenuitvoer vast als `recordedTimes` (bak 4, zie `.claude/rules/xer.md`). Na opslaan als
IFC en heropenen moet die vastlegging terugkomen. De IFC-lezer schrijft daarvoor geen eigen `OPS_`-pset en rekent
niets zelf na: hij krijgt via de injectienaad `IfcReadOptions.reconstructXerArchive` (type
`XerArchiveReconstructor`) de uitkomst van een volledige `readXER` over de sha256-gecontroleerde bronbytes uit het
archief. Zo is de vastlegging per constructie gelijk aan die van het oorspronkelijke openen (kalenderpromotie,
dag- of uurweergave, getalnotatie); een eigen afleiding in de IFC-laag zou dat moeten nabootsen, en één verschil in
weergave telt dan elke taak als verschoven. De selector `OPS_XerDocument` kiest het project.

## Gevolgen

- De naad houdt de chunkgrens heel: een statische import van de XER-parser (bijvoorbeeld `parseXerNumber`) trekt
  hem in de hoofdbundel. Alleen `readIFCWithXerReconstruction` vult de optie; de lage synchrone `readIFC` mag een
  compact archief nooit afhankelijk maken van een toevallig eerder geladen module.
- Het werkt ook bij opslaan buiten de modus: `runCPM` wist `recordedDates` bij het verlaten van de modus, en een
  pset zou de vastlegging dan verliezen. Taak-id's passen vanzelf: een XER-taak-id is de rauwe `task_id`, en
  `OPS_TaskIdentity` draagt die id's door de opslag. Er verandert geen documentcontract en er is geen extra parse.
- Een compact archief (schema 2) of een crashherstelverwijzing (schema 3) zonder reconstructor is geen archieffout
  maar een fout van de aanroeper: `readIFC` gooit `IfcParseError` `xer-source-archive` in plaats van het archief stil
  weg te laten. Een fout in de reconstructie zelf wordt wel een `xerArchiveIssue` (`metadata-invalid`). De
  hashcontrole geldt daarmee ook voor `recordedTimesByProject`.
- Historische archieven in schema 1 krijgen geen `recordedTimes` terug: het leesmodel bewaart de TASK-bronrijen wel,
  maar de omrekening vraagt de kalender- en getallaag van de XER-lezer, en dat pad loopt bewust zonder die chunk. De
  huidige writer schrijft alleen schema 2.
- Archief, selector en de selectorweergave van de metadata vallen samen weg als één ervan niet valideert ("openen
  met melding", zie `docs/xer-recovery-guardrails.md`). Ook een onverwachte fout in de validatie wordt een issue
  (`structure`, met de melding als detail), zodat de sidecar het project niet gijzelt. Het detail is begrensd op
  500 tekens: het kan bronfragmenten bevatten en landt in meldingen en logs.
- Een selector zonder archief-pset (een ander programma liet de grote pset vallen) is `bytes-missing`, net als een
  manifest dat bronbytes belooft zonder enige `ByteChunk`-property; een deel van de chunks is `truncated`.
- Toetsen: `check-ifc-xer-archive-container.ts`, `check-xer-recorded-roundtrip.ts`.
