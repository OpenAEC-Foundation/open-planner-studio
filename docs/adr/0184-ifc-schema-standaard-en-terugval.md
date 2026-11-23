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
- Zolang voor een document een schemavraag openstaat (`Project.ifcSchemaUnconfirmed`) en het geen vreemd deel heeft,
  stelt het eerste expliciete opslaan die vraag eerst (`ifcSchemaQuestionFor` in `ifcSchemaQuestion.ts`; besluit
  eigenaar 2026-10-13: "we veranderen niet zomaar bestandstypes"). Wanneer een vraag openstaat, welke keuzes ze
  biedt en hoe een bewaarde keuze haar bij heropenen voorkomt, staat in ADR 0142 en in
  `check-ifc-schema-question.ts`. Welke routes niet vragen en welke kop ze dan schrijven, staat in de regel
  `tauri-ifc` en in dezelfde check: een export vraagt niets, en bij een schema dat de app niet schrijft, zoals
  IFC2X3, krijgt de export de kop `IFC4X3_ADD2` terwijl het document zijn vraag houdt (deel E).
