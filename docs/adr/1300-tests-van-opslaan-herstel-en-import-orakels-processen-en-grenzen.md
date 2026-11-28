# Tests van opslaan, herstel en import: vaste orakels, een eigen proces per sessiestand en grenzen die niet van de machine afhangen

De checks in `tests/planning/` over crashherstel, opslaan, de site, documenten en import hebben een paar keuzes die
omslachtig lijken. Ze houden een toets scherp: een verwachting komt niet uit de code die getoetst wordt, toestand die
de module de hele sessie onthoudt krijgt per scenario een eigen proces, en een schaaltoets telt werk in plaats van
tijd te meten. Maak ze niet korter of "netter" zonder die reden mee te wegen.

## Gevolgen

- Vaste orakels. `check-zip.ts` bouwt zijn archieven met een eigen ruwe bouwer (`rawZip`) en niet met `writeZip`: de
  lezertests hebben archieven nodig die `writeZip` nooit maakt (Zip64-sentinels, maten die liegen, te veel entries).
  De CRC-32-verwachtingen zijn vaste, bekende controlewaarden (`0xCBF43926` voor `123456789`), niet uitgerekend met de
  eigen `crc32`. Of `select` een entry overslaat, telt de check op het aanmaken van een `DecompressionStream`, want een
  lezer die alles uitpakt en daarna filtert geeft dezelfde uitkomst.
  `check-xml-adapter-fidelity.ts` vergelijkt de geschreven MSPDI letterlijk, omdat de DOM-shim van de tests
  (`xmldom-shim.ts`) geen parseerfout meldt: alleen opnieuw inlezen ziet een kale `&` of een losse `<` niet. Zijn
  `solve` rekent met `effectiveSchedulingOptions({})` en zonder het profiel dat het bestand voorstelt, omdat de check
  de adapter vergelijkt en niet het rekenprofiel.
- `check-adapters-hours.ts` toetst een werkende uitzondering zonder banden na MSPDI op "geen banden" (afwezig of leeg),
  niet op één vorm: welke van de twee de lezer teruggeeft, is geen contract.
- `check-recovery-content.ts` vergelijkt elk veld van `DOCUMENT_FIELDS` diep. De toleranties (`metToleranties`) gelden
  elk voor één soort veld, en de rekenuitkomst (`cpmResult` en de berekende taakdatums) valt er niet onder, zodat een
  echte verschuiving rood blijft. Een restduur op een fase is alleen toegestaan als de fase er vóór het herstel geen
  had. Wat niet meegaat, staat in `NIET_HERSTELD` met een reden; elk veld daarbuiten moet exact terugkomen.
- Eigen proces per sessiestand. `recoveryStore.ts` onthoudt per module of de webopslag geweigerd of bewezen is
  (`webStorageUnavailable`, `webStorageProven`) en het sessie-id (`sessionIdPromise`). Elk weigerscenario staat daarom
  in een eigen bestand (`check-recovery-refused.ts`, `-transaction`, `-missing`, `-getter`, `-later`,
  `check-recovery-lock-refusal.ts`, `check-recovery-web-claim-order.ts`), en `check-recovery-refused-later.ts` start
  zichzelf per route opnieuw. Er komt geen resetfunctie in de productcode om dat te vermijden.
- `check-recovery-isolation.ts` maakt zijn namen met expliciete bases (`recoveryNames('recovery')`,
  `recoveryNames('recovery.wt-a')`) en niet met `ownRecoveryNames`: `run.sh` bundelt met
  `__OPS_DEV_INSTANCE__='"test"'`, dus de modulebrede namen zijn die van een dev-build en de productiebuild zou
  ongetoetst blijven.
- Laadvolgorde. `check-web-save-fallback.ts` importeert de store pas in deel 7, zodat deel 1 tot en met 6 de
  web-backend zonder de store toetsen. `check-site-host-preferences.ts` laadt de AST-scanner
  (`scripts/lib/host-setting-writes.mjs`) via een berekende URL, zodat esbuild hem niet in de checkbundel trekt; de
  scanner laadt `typescript` zelf.
- `check-auto-calc-cpm.ts` volgt de voorwaarde van `useAutoCalcCPM` in een synchrone kopie (`maybeScheduleRun`,
  `drain`) om de herhaling te kunnen tellen zonder timers. De echte hook toetst `tests/browser/auto-calc-stale.spec.ts`;
  wie de voorwaarde in de hook verandert, past de kopie mee aan.
- Bestanden zoeken vanaf de bundel. `check-adapters-hours.ts` (`HERE`) en `check-external-source-load.ts` (`root`)
  vinden hun voorbeeldbestanden via `import.meta.url` en niet via `process.cwd()`: `run.sh` gaat niet naar de
  repo-root, dus de werkmap is die van de aanroeper.
- Grenzen. `check-xml-default-scope.ts` telt de opzoekingen van de standaardnaamruimte (`Map.prototype.get` met `''`)
  tegen de nestdiepte, en geen tijd. `check-adapters-hours.ts` (f) is de uitzondering: daar keurt een tijdgrens van
  2000 ms `readMSPDI` met `MAX_CALENDAR_EXCEPTIONS` wekelijkse uitzonderingen. Die toets bewaakt dat
  `buildContributions` het budget al tijdens de opbouw afdwingt (ADR 0293). Zonder die klem blijft de uitkomst gelijk,
  want `resolveContributions` klemt ook; alleen de tijd groeit, dus een telling op de uitkomst ziet het niet. De
  fixture gebruikt de echte bestandsgrens en geen kleiner aantal records, zodat het verschil groot is tegenover de
  vaste kosten van `resolveContributions`, en de grens ligt ruim boven de tijd van de geklemde route voor een tragere
  CI-runner.
- Fixtures die het verschil maken. `check-import-missing-schedule-dates.ts` en `check-import-progress-default.ts`
  leggen hun planning in 2015, zodat een terugval op vandaag nooit toevallig de verwachte datum geeft. In
  `check-session-history-model.ts` staat de chronologie bewust niet op `sequence` gesorteerd: zo toetst de check dat
  `sequence` beslist en niet de plek in de lijst.
