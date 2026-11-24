# P6 XML lezen: een export van OPS herkennen, en de oudere eigen vormen

Een P6 XML-bestand kan uit Primavera P6 komen, uit een ander programma of uit OPS zelf, en een eigen export bedoelt
sommige velden anders dan P6. `readP6XmlProject` neemt een bestand als export van OPS (`writtenByOps`) als het een
`<UDFType>` draagt met SubjectArea `Activity`, DataType `Text`, de titel `OPS_DURATION_UNIT_NAME` en een `ObjectId`:
de eigen writer schrijft die definitie in elke export (`writeP6XMLWithReport`). Een OPS-waarde op een activiteit
telt alleen onder een `<UDFType>` met de exacte OPS-titel, zodat de vrije tekst van een ander programma geen
OPS-gegeven wordt. De duureenheid en de maatrecords vragen daarbij SubjectArea `Activity` en DataType `Text`; het
eigen taaktype alleen de titel `OPS_CUSTOM_TASK_TYPE_UDF_TITLE`, en `decodeCustomTaskType` toetst daarna de waarde
zelf.

## Gevolgen

- `writtenByOps` stuurt de keuzes waarin een eigen export iets anders bedoelt dan een bestand van P6: de status als
  bron van voortgang, werkelijke datums en lopende taken (ADR 0266), de schaal van het percentage (ADR 0266), de
  eindtijdregel en de dagkalender met pauze (ADR 0262) en de geërfde werkregel (ADR 0267).
- Een export van OPS v2026.6.0 tot en met v2026.8.1 heeft die definitie nog niet. `isLegacyOpsP6Xml` herkent zo'n
  bestand aan de vorm van die writers (knownbug 300; de echte uitvoer staat in `tests/fixtures/legacyOpsExports.ts`,
  `check-uren-f5b-adapters.ts` (11) en (12)). Die herkenning gaat alleen naar de tijdregel (`xmlTimeRule`,
  ADR 0264); voor elke andere keuze is zo'n bestand een vreemd bestand.
- Naast de vorm van P6 leest de lezer de oudere vorm van de eigen writer (`check-p6xml-writer-p6.ts` (7)):
  `<StandardWorkHour>` naast `<StandardWorkHours>`, het relatietype als XER-token (`P6_LEGACY_SEQUENCE_TYPE`) naast
  het label, losse `<UDFValue>`-objecten (`ForeignObjectId`, `UDFTypeObjectId` en de tekst in `Text`, anders
  `TextValue`) naast `<UDF>` in de activiteit, en `<Description>` op de activiteit naast een `<ActivityNote>`.
  Het percentage in procenten staat in ADR 0266, de constraintsoort als `CS_*`-token in ADR 0267.
- Een `<ActivityNote>` wordt alleen de beschrijving als hij onder een `<NotebookTopic>` met de naam
  `OPS_DESCRIPTION_TOPIC_NAME` staat; heeft een activiteit zo'n notitie niet, dan geldt haar `<Description>`. Per
  activiteit telt de eerste zulke notitie, de eerste waarde van elk maatrecord en de eerste geldige waarde van het
  eigen taaktype; van de duureenheid telt de laatste geldige waarde, met eerst de losse `<UDFValue>`-objecten en dan
  de `<UDF>` in de activiteiten.
