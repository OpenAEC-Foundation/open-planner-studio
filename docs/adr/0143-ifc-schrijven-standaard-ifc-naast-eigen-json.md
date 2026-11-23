# De IFC-writer schrijft standaard-IFC voor anderen en JSON voor de eigen lezer

Voor een aantal structuren heeft IFC wel een vorm, maar niet een die alles draagt: ids, kleuren, omschrijvingen,
de datums per baselinetaak. De writer schrijft dan twee sporen. Het standaard-IFC-spoor is er zodat andere
programma's zien dat iets bestaat. Het JSON-spoor in een eigen pset (route 3 in `docs/ifc-round-trip.md`) is
verliesloos en is voor de eigen lezer de bron. Het standaard-IFC-spoor mag daardoor kleiner zijn dan wat OPS weet,
en de writer houdt het schemageldig in plaats van volledig.

## Gevolgen

- Eigen velden en activiteitcodes: definities als `IFCPROPERTYSETTEMPLATE` met `IFCSIMPLEPROPERTYTEMPLATE`
  (`P_SINGLEVALUE` met `PrimaryMeasureType` voor eigen velden, `P_ENUMERATEDVALUE` met `IFCPROPERTYENUMERATION` voor
  codetypes), gedeclareerd aan het project met `IFCRELDECLARES`. Daarnaast één `OPS_StructureMeta` met de volledige
  definitie-JSON. De waarden per taak staan in `OPS_CustomFields` en `OPS_ActivityCodes`, met de naam van het veld of
  codetype als propertynaam; de lezer koppelt die namen via de meta-JSON terug aan ids.
- Een codetype zonder waarden krijgt geen `IFCPROPERTYENUMERATION` (Enumerators `$`), want `EnumerationValues` is een
  `LIST [1:?]`.
- De codetekst is de interoperabele vorm van een codewaarde, maar de app staat dubbele codes in één type toe. Alleen
  als een type twee waarden met dezelfde code heeft, schrijft de writer naast de code ook het waarde-id, als property
  `<typenaam> #id`. Zo kiest de lezer de goede waarde, ook na herordenen. Een type zonder dubbele codes blijft
  byte-gelijk.
- Baselines: per baseline één `IfcWorkSchedule` met `.BASELINE.`, met naam en aanmaakdatum en zonder kopie van de
  taken. De datums staan in `OPS_Baselines` op het live werkschema, met `TaskGuids` (ADR 0140) en de actieve en
  vergeleken baselines. De vergeleken baselines alleen als er minstens één gekozen is. `StartTime` en `CreationDate`
  zijn in het schema verplicht: `StartTime` is de vroegste taakstart in de baseline, anders de planstart van het
  werkschema; een baseline zonder aanmaakdatum krijgt het schrijfmoment. De eigen lezer leest die slots niet.
- `OPS_SchedulingOptions`, `OPS_SchedulingProfile` en `OPS_Library` (alleen in een poolbestand) zijn elk één
  JSON-property zonder standaard-IFC-spoor. `OPS_SchedulingProfile` staat er alleen bij een ander profiel dan het
  standaardprofiel (`carriesProfile`).
- `OPS_ImportProvenance` draagt `UnchangedSinceImport` alleen als de vlag aan staat en `SourceFormat` alleen als het
  bronformaat bekend is; zonder een van beide geen pset. Een ontbrekende vlag leest als uit.
- JSON gaat via `asciiJson` of `ifcJson`, niet via kale `ifcStr(JSON.stringify(…))` (*Tekst in IFC is STEP-gecodeerd*
  in `.claude/rules/tauri-ifc.md`).
