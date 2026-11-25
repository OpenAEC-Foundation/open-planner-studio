# XER lezen: de duursoort, de werkregel en de volgorde van de afleidingen

Een XER opent met het ingebouwde profiel Primavera P6 zonder afwijkingen (`builtInProfile('p6')`, `suggestedProfileId`
`p6`; regel `xer` (3)), en de werkregel van een activiteit volgt uit haar P6-duursoort (`deriveImportedWorkRules`,
ADR 0303). In een bestand uit P6 is `PROJECT.def_duration_type` daarom alleen de terugval voor een activiteit zonder
geldige duursoort, en geen eigen projectstandaard van OPS.

## Gevolgen

- `durationTypeOf` leest `duration_type`; leeg of onbekend geeft de projectstandaard uit `def_duration_type`, en is die
  ook leeg of onbekend, dan `DT_FixedDUR2`. Alleen een niet-lege onbekende waarde komt in de terugvallen
  (`check-xer-reader.ts` 8).
- Een eigen projectstandaard (`project.defaultWorkRule`) krijgt alleen een eigen export met `OPS_DefaultWorkRule`, en
  een taak met `OPS_InheritedWorkRule` erft weer van de projectstandaard, elk zolang het token van de regel nog in
  `def_duration_type` of `duration_type` staat, en voor de taak alleen als haar regel de teruggelezen
  projectstandaard is (zonder `OPS_DefaultWorkRule` de standaardregel van OPS; regel `xer` (3)). De taak verliest haar eigen werkregel pas na
  `deriveImportedWorkRules` en na de toewijzingen en relaties, zodat die afleidingen dezelfde regel zien.
- De vastgelegde rekenuitvoer (`readXerRecordedTimes`, bak 4 in de regel `xer`) leest de lezer na
  `deriveXerScheduleOptions`, omdat de kritiek in de vastlegging dezelfde `criticalDefinition` gebruikt als de solver
  krijgt.
