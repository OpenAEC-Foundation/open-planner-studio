# Het IFC-schema: IFC4X3_ADD2 als standaard, met een terugval voor een onbekende waarde

Het schema in `FILE_SCHEMA` is een projectinstelling (`Project.ifcSchema`, *Bestandsschema per project* in de regel
`tauri-ifc`); waarom een planner een ander schema kiest, staat in de gids `howto-ifc-schema-kiezen.md`. Zonder keuze
geldt `DEFAULT_IFC_SCHEMA`, `IFC4X3_ADD2` (besluit eigenaar 2026-10-13): zo noemen IfcOpenShell en Bonsai IFC 4.3,
en volgens de gids voegt IfcOpenShell een planning alleen samen met een model in hetzelfde schema. Oudere versies van
de app schreven `IFC4X3`.

## Gevolgen

- `ifcWriter.ts` schrijft `FILE_SCHEMA` met `projectIfcSchema`. Een waarde in `Project.ifcSchema` buiten
  `IFC_SCHEMAS`, bijvoorbeeld langs de typen heen, valt daar terug op de standaard, zodat de writer die tekst niet in
  de kop zet. Bij een document met een vreemd deel ligt de kopnaam vast in `ifcSource.schemaName` (regel `tauri-ifc`).
- Bij een geopend bestand met een ander schema, zonder vreemd deel, stelt het eerste expliciete opslaan eerst de vraag
  of het naar `IFC4X3_ADD2` gaat of zijn schema houdt (`ifcSchemaQuestionFor` in `ifcSchemaQuestion.ts`; besluit
  eigenaar 2026-10-13: "we veranderen niet zomaar bestandstypes"). Houden biedt de vraag alleen voor een schema uit
  `IFC_SCHEMAS`. De open vraag staat in `Project.ifcSchemaUnconfirmed` en reist mee in `OPS_ProjectSettings`
  (ADR 0142). Welke routes niet vragen en welke kop ze dan schrijven, staat in de regel `tauri-ifc` en in
  `check-ifc-schema-question.ts`: een export vraagt niets, en bij een schema dat de app niet schrijft, zoals IFC2X3,
  krijgt de export de kop `IFC4X3_ADD2` terwijl het document zijn vraag houdt (deel E).
