# Ongeldige OPS-metadata is inert en dubbele metadata faalt gesloten

De `OPS_`-psets kunnen corrupt zijn, met de hand bewerkt, of uit een ander programma komen dat ze half meenam. De
lezer behandelt ze als bron die zichzelf moet bewijzen: een property die niet de verwachte vorm heeft, telt als
afwezig, en het gedrag wordt dat van een bestand zonder die property. Corrupte JSON geeft nooit een leesfout en nooit
een halve waarde. Zijn er twee geldige bronnen voor dezelfde betekenis, dan is dat ambigu en telt geen van beide. Zo
kan een losse of verkeerd gehangen pset een geldige koppeling niet maskeren, en raadt de lezer niets.

## Gevolgen

- Terugval bij corrupte JSON: `OPS_StructureMeta` valt terug op de `IFCPROPERTYSETTEMPLATE`-declaraties (met nieuwe
  id's; ook voor een bestand van een ander pakket); `OPS_SchedulingOptions` op de standaarden van de solver;
  `OPS_SchedulingProfile` (ook boven `MAX_PROFILE_JSON_LENGTH`) op de migratie van het oude optieblok; de pool van
  de bibliotheek, de baselines en de vergelijkingsset op niets; `TaskGuids` op het herberekenen van de GlobalId.
  `sanitizeSchedulingOptions` en `sanitizeSchedulingProfile` laten onbekende sleutels en verkeerde typen weg.
- `OPS_Sequences` telt alleen als de pset één-op-één hangt aan een werkschema dat geen baseline is en dat de
  ingelezen live taken nest of bestuurt. Meer dan één geldige pset voor de grensrelaties, de dagenmaat of de exacte
  minuten: geen records, en elke relatie leest zoals zonder record. Alleen een volledige lijst van niet-lege strings
  activeert een grensvlag. De payload sleutelt op de GlobalId van `IfcRelSequence`, niet op het relatie-id van OPS.
- `OPS_Calendar`: een onvolledige herkomst (`RuleSetId` of de jaren ontbreken) is geen herkomst; een kalender wordt
  nooit hergegenereerd op een gok. `WinterStop` (een verwijderde functie) wordt genegeerd; de feestdagen staan los in
  de kalender. `LibraryOrigin` en `HoursPerDay` worden los van de herkomst gelezen, zodat een kalender met alleen een
  stempel of alleen een afwijkende werktijd die niet verliest. Een expliciete `HoursPerDay` wint van de afgeleide
  werktijd. De P6-stempel (`P6Source = XER`) geldt alleen samen met een geldige lijst `P6NonWorkPenaltyDates`
  (echte datums, ook leeg); anders blijft alleen de status, nooit een halve stempel.
- `OPS_Resource`: een kleur telt alleen als `#rrggbb`. De eerste geldige `LibraryOrigin` wint, net als bij
  kalenders; een `syncedHash` die geen string is, valt weg en de rest van de stempel blijft. `ParentGuid` is een
  vangnet: de ploeg komt uit `IFCRELNESTS` en `ParentGuid` telt alleen als die geen ouder gaf.
- `OPS_ProjectSettings`: een onbekende werkregel of voortgangsmodus valt weg; een opgeslagen project- of taak-id
  telt alleen als string tot 256 tekens zonder stuurtekens.
- `OPS_TaskTypes`: zonder catalogus blijft een `USERDEFINED`-taak `USERDEFINED` en raadt de lezer geen id uit
  `ObjectType`; definities zonder id of naam, of met een dubbel id of een dubbele naam (hoofdletterongevoelig),
  vallen weg.
- `OPS_ImportProvenance.UnchangedSinceImport` geldt alleen bij exact `IFCBOOLEAN(.T.)`; `SourceFormat` alleen met een
  bekende waarde. Geen bron is geen modus. `OPS_RecoveryForeignSource` met een onvolledige vingerafdruk telt als
  afwezig.
- Toetsen: `check-ifc-roundtrip.ts` (`OPS_Sequences` op een ander schema en dubbel), `check-ifc-property-relations.ts`,
  `tests/library/check-ifc-hostile.ts`, `check-ifc-pset-register.ts`.
