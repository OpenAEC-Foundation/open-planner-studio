# `OPS_Sequences` telt alleen op het eigen werkschema en alleen bij precies één bron per soort

`OPS_Sequences` draagt per relatie metadata die de standaard-IFC niet heeft: de P6-grensrelaties
(`P6StartAtPredecessorFinishBoundarySequenceGuids`), de dagenmaat van een lag (`DayMeasureLags`) en de exacte
minuten van een lag (`ExactMinuteLags`). De payload sleutelt op de GlobalId van `IfcRelSequence`, niet op het
relatie-id van OPS. De pset hangt aan het `IfcWorkSchedule`. Een bestand dat door een ander programma is samengevoegd
of bewerkt, kan zo'n pset dubbel of aan het verkeerde schema dragen. De lezer neemt hem daarom alleen als bron als hij
één-op-één hangt aan een werkschema dat geen baseline is en dat de ingelezen live taken nest (`IFCRELNESTS`) of
bestuurt (`IFCRELASSIGNSTOCONTROL`). Een losse pset of een pset op een ander schema telt niet, en kan een geldige
koppeling dus niet maskeren. Zijn er voor één soort meer bronnen, in één pset of verdeeld over meer, dan is dat
ambigu en telt die soort helemaal niet: elke relatie leest dan zoals zonder record.

## Gevolgen

- Per soort telt een property als bron als ze leest: voor de grensrelaties een JSON-lijst van niet-lege strings,
  voor de twee lagrecords een JSON-object (`parseDayMeasureLags`). Ongeldige records binnen zo'n object vallen weg;
  het object blijft een bron. Wat niet zo leest, telt niet mee.
- De drie soorten worden los beoordeeld: een dubbele `DayMeasureLags` laat de grensrelaties ongemoeid.
- Of een record daarna nog geldt, volgt de leesregel in `docs/ifc-round-trip.md` ("De leesregel").
- Andere psets volgen deze regel niet. Daar gelden per pset eigen regels voor dubbele waarden (zie
  `check-ifc-property-relations.ts`: de laatste taakidentiteit, kleur en capaciteit winnen, de eerste
  bibliotheekherkomst wint, dubbele toewijzingsmetadata blijft in de wachtrij).
- Toets: `check-ifc-roundtrip.ts` (een losse pset, een losse pset vóór de geldige, een pset op een baselineschema en
  een tweede gekoppelde pset), voor de grensrelaties. Een toets op een dubbele of losse bron van de twee lagrecords
  ontbreekt.
