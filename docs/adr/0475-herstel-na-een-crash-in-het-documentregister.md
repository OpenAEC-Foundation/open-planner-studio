# Herstel na een crash: het actieve document doorrekenen, de rest slapend, en gedeelde XER-archieven

`restoreDocuments` vervangt de hele set open documenten door de herstelde. Het lezen is dan al gebeurd
(`readRecoveryDocument` in `useRecoveryRestore`, die de leesfouten zelf meldt met `notifications.recoveryReadFailed`).
Herstel rekent alleen kandidaten voor het actieve document door: de kandidaten één voor één, tot er een lukt (hieronder).
De andere documenten worden zonder berekening tot payload gevormd (`payloadFromInput`, ADR 0435) en blijven verouderd
(`scheduleStale: true`) tot F5 of Automatisch berekenen. De uitzondering is een slapend document dat zijn modus *Datums
zoals opgeslagen* terugkrijgt (hieronder): dat krijgt zonder berekening een `cpmResult` uit de vastlegging en
`scheduleStale: false`. Zo rekent herstel niet voor elk tabblad, en een kandidaat die niet voor te bereiden is, houdt de
rest niet tegen.

## Gevolgen

- Eerst maakt `shareRecoveredXerArchives` van gelijke XER-bronarchieven weer één referentie, vóór er payloads van
  gemaakt worden. Herstel leest elk document apart (`readRecoveryDocument`), dus elk document met een archief krijgt
  een eigen archiefobject; zonder deze stap hield elk tabblad een eigen kopie (een groot archief zoals `rehab-2.xer` heeft
  52.640 toewijzingen, ADR 0397). Gelijk is: dezelfde lengte en sha256, en daarna dezelfde schemaversie, vorm,
  codering, BOM, regeleinde, base64-stukken en dezelfde `diagnostics` en `readModel` (`sameArchive`). Elk document met een archief wordt daarna opnieuw aan het gekozen archief gebonden met
  zijn selector (`xerSourceProjectId`, anders `xer.sourceProjectId`). Toets: `check-xer-archive-readmodel.ts` 10 en 10a
  (na herstel één archief over de drie tabbladen, en de metadata van elk document aan dat archief gebonden).
- Die stap gooit `XerSourceArchiveValidationError` bij een document met een archief zonder selector, of als het binden
  aan het archief mislukt, en `restoreDocuments` vangt dat niet af: een archief zonder vindbare documentselector is een
  kapot leesmodel, niet één kapot document. Er wordt dan niets hersteld; `useRecoveryRestore` meldt de fout en houdt de
  snapshots vast. Toets: `check-xer-archive-readmodel.ts` 10b (een selector die het archief niet kent geeft die fout).
- Het actieve document: de kandidaat met de `activeId` van vóór de crash gaat eerst, zodat een geslaagd herstel
  hetzelfde `activeDocumentId` houdt; daarna de andere in hun volgorde. Elke kandidaat heeft een eigen `try/catch` om de
  voorbereiding (`payloadFromInput`, `prepareLoadedPayload` met `recompute: true`, "datums zoals opgeslagen", de
  activatie en de minutenomzetting).
  Gooit die, dan komt het id in `skippedIds` en probeert de lus de volgende (`check-recovery-integrity.ts` 8a en 8b). Een
  overgeslagen kandidaat wordt ook niet als slapend document hersteld: de lus voor de slapende documenten en het
  register slaan `skippedIds` over.
- "Datums zoals opgeslagen" komt terug als de modus vóór de crash aan stond: `applyRecordedDatesOnLoad` krijgt
  `datesAsRecorded` uit de herstelmetadata mee, en die waarde beslist in plaats van de regel voor een heropening, als er
  een vastlegging is (`captureAllowed`). Herstel hervat een sessie en beslist niet opnieuw (ADR 0195: een feit uit het
  manifest, geen heuristiek). Stond de modus uit, dan vergeet het document de opgeslagen datums (geen aanbod-stand, eigenaar 2026-10-17, regel `state`).
  `applyRecordedDatesOnLoad` krijgt de taken van vóór de berekening (`rawPayload.tasks`): `prepareLoadedPayload` muteert
  zijn invoer niet.
- Een slapend document met `datesAsRecorded` gaat door `applyRestoredRecordedMode`. Is er een vastlegging die
  `captureAllowed` toelaat, dan zet die functie de modus terug: `recordedDates`, de datums uit de vastlegging op de taken,
  een `cpmResult` daaruit (`applyRecordedTimesToTasks`) en `scheduleStale: false`. Zonder zo'n vastlegging keert ze
  terug zonder iets te veranderen, en blijft het document verouderd zonder modus. Zonder deze stap kwam een document met
  vastlegging terug met de opgeslagen datums in `task.time`, zonder modus en met `scheduleStale`, en rekende Automatisch
  berekenen of de eerste F5 ze stil weg. Zonder berekening is er geen teller `shifted` (zie die functie). Ook de
  payloadopbouw van een slapend document heeft een eigen `try/catch` en zet een mislukt document in `skippedIds`.
- Het opslagdoel van een hersteld document met een vreemd deel komt uit `readRecoveryDocument` (ADR 0435); een herstelde
  kopie van zo'n document kan daar de browserhandle van het origineel als opslagdoel krijgen (knownbug 2511).
- Eén melding voor alle overgeslagen documenten samen (`notifications.recoveryDocumentsSkipped`), en één voor de
  herstelde documenten waarvan het XER-archief onbruikbaar was (`withXerArchiveIssueNotice`). Lukte geen enkele
  kandidaat, dan blijven de open documenten zoals ze waren en komt alleen `skippedIds` terug. `useRecoveryRestore` wist
  de snapshots alleen als er niets is overgeslagen en niets onleesbaar was, anders houdt hij ze vast
  (`holdRecoveryForLater`).
- De publicatie is één `set`: de sessiegeschiedenis leeg (`replaceSessionHistoryState`), het register, het actieve
  document met `publishActivation`, en de minutenomzetting (`recordMinuteModelTransition`, ADR 0431). De berekening liep
  al op de losse payload; daarna komen de melding van de omzetting, dezelfde zichtbare rekenfout (`scheduleFailedNotice`)
  en dezelfde host-events (`scheduleCalculated`, `projectLoaded`) als na een gewone `runCPM` en een gewone lading.
