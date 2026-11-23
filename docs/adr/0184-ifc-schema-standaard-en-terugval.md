# Het IFC-schema: IFC4X3_ADD2 als standaard en nooit een vrije tekst in de kop

Het schema in `FILE_SCHEMA` is een projectinstelling (`Project.ifcSchema`, *Bestandsschema per project* in de regel
`tauri-ifc`); waarom een planner een ander schema kiest, staat in de gids `howto-ifc-schema-kiezen.md`. Zonder keuze
geldt `DEFAULT_IFC_SCHEMA`, `IFC4X3_ADD2` (besluit eigenaar 2026-10-13): zo noemen IfcOpenShell en Bonsai IFC 4.3, en
een samenvoeging met een model vraagt hetzelfde schema. Oudere versies van de app schreven `IFC4X3`.

## Gevolgen

- `ifcWriter.ts` schrijft `FILE_SCHEMA` met `projectIfcSchema`. Een waarde buiten `IFC_SCHEMAS`, die alleen langs de
  typen heen in het project kan komen, valt daar terug op de standaard, zodat er geen vrije tekst in de kop komt. Bij
  een document met een vreemd deel ligt de kopnaam vast in `ifcSource.schemaName` (regel `tauri-ifc`).
- Een geopend bestand met een ander schema houdt dat schema tot de planner kiest (besluit eigenaar 2026-10-13: "we
  veranderen niet zomaar bestandstypes"). De openstaande vraag staat in `Project.ifcSchemaUnconfirmed` en reist mee
  in `OPS_ProjectSettings` (ADR 0142); de vraag zelf stelt `ifcSchemaQuestion.ts`.
