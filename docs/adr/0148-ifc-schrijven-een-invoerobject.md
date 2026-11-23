# De IFC-writer krijgt één invoerobject, met een paar velden alleen voor crashherstel en backup

`writeIFC` en de andere ingangen nemen één object, `WriteIFCInput`, en geen losse parameters. Met losse parameters
schreef een aanroeper stil een onvolledig bestand als hij er één vergat; met één object dwingt de compiler de
kernvelden af. `WriteIFCInput` is `ImportResult` plus een paar schrijfopties: de writer heeft dezelfde payload nodig
als wat de lezers teruggeven, dus er is geen tweede typedefinitie die kan afwijken. De optionele velden krijgen in de
writer hun standaard (`[]`, `null` of afwezig). De app bouwt het object uit een document met `buildWriteIFCInput`
(`src/state/ifcSaveInput.ts`).

## Gevolgen

- Twee velden zijn voor crashherstel en backup, niet voor een bestand van de gebruiker:
  - `xerSourceArchiveStorage: 'recovery-reference'` schrijft van het XER-bronarchief alleen lengte en SHA-256; de bytes
    staan één keer als blob naast de snapshots (`docs/xer-recovery-guardrails.md`). Alleen
    `recoverySnapshotInput.ts` zet het. De standaard `embedded` schrijft de volledige bronbytes.
  - `recoveryForeignSource` schrijft de vingerafdruk van een bron met een vreemd deel (`OPS_RecoveryForeignSource`:
    SHA-256 en lengte, nooit de bytes), zodat een hersteld document weet dat het uit een modelbestand kwam. Het
    crashherstel zet het (`recoverySnapshotInput.ts`), en de MCP-backup met het doel erbij (`backupService.ts`), want
    een backup heeft geen manifest. `buildWriteIFCInput` zet het niet, dus opslaan en exporteren schrijven het niet.
- `withheldTaskTimeFields` vult `buildWriteIFCInput` alleen in de modus *Datums zoals opgeslagen*: per taak de
  rekenslots die als `$` gaan, omdat de taak daar een weergave-terugval draagt en geen vastlegging uit het
  bronbestand. Zo'n slot krijgt ook geen record in `ExactFloat`.
- De vaste schrijfdatum van `writeIFCForComparison` staat onder *Vergelijkingsklok* in `.claude/rules/tauri-ifc.md`;
  de letterlijke kalenders die `writeIFCWithChoices` teruggeeft onder *Letterlijke kalender blijft letterlijk* in
  `docs/ifc-round-trip.md`.
