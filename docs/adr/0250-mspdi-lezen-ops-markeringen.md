# MSPDI lezen: een OPS-veld telt alleen met zijn definitie in de projectkop

Een MSPDI-bestand kan van MS Project, van een ander programma of van OPS zelf komen. OPS schrijft zijn eigen
gegevens (duureenheid, soort mijlpaal, maatrecords, lagkalender, letterlijke kalenders) in gewone tekstvelden van
MS Project; welke velden dat zijn, staat bij de constanten in `mspdiWriter.ts`. Een vreemd bestand kan hetzelfde
veld zelf gebruiken. Daarom leest `readMSPDI` zo'n taakveld alleen als de projectkop een definitie draagt met
precies dat FieldID en die FieldName (`hasOpsFieldDefinition`, in een `<ExtendedAttributes>` direct onder
`<Project>`). `check-adapters-hours.ts` toetst een eigen export waaruit de definities zijn weggehaald: de
duureenheid op de taak telt dan niet en de taak komt in de urenmaat terug.

## Gevolgen

- De definitie van de duureenheid (`opsDurationUnitFieldId`: het huidige FieldID of het oude,
  `OPS_DURATION_UNIT_LEGACY_FIELD_ID`) geldt als bewijs dat OPS het bestand schreef. `readMSPDI` gebruikt dat voor
  de tijdregel (ADR 0252) en `readCalendars` voor de dagkalender met pauze (`opsFile`, ADR 0253).
- Een export van OPS v2026.6.0 tot en met v2026.8.1 heeft nog geen markering. `isLegacyOpsMspdi` herkent die aan de
  vorm van die writers (knownbug 300, `check-uren-f5b-adapters.ts` (11) en (12)). In `readMSPDI` gaat die
  herkenning alleen naar `xmlTimeRule`: zo'n bestand is voor de duureenheid en voor `opsFile` een vreemd bestand.
- Zonder duureenheid op de taak is de taak in de urenmaat (`taskDurationUnit`, spec alleen-uren §3.10, T15).
  `DurationFormat` bepaalt alleen of de taak kalendertijd is (`taskDurationType`).
- Het eigen taaktype (`readOpsCustomTaskType`) vraagt geen definitie in de kop: `decodeCustomTaskType` eist de
  OPS-marker in de waarde zelf. Een waarde zonder die marker slaat de lezer over, en hij zoekt verder in de volgende
  `<ExtendedAttribute>` met hetzelfde FieldID.
