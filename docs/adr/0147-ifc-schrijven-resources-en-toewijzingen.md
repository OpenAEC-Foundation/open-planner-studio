# Hoe de IFC-writer resources en toewijzingen schrijft

Een resource is een van de vijf resource-entiteiten van IFC, een toewijzing een `IFCRELASSIGNSTOPROCESS` per taak.
Wat IFC niet draagt, staat in eigen psets. Een relatie kan in IFC geen pset dragen
(`IfcRelDefinesByProperties.RelatedObjects` accepteert geen `IfcRelationship`), dus alles per toewijzing staat in een
pset op de taak, gesleuteld als `<resource-GlobalId>#<index>`. Hoe de lezer dat terugzet, staat in ADR 0045.

## Gevolgen

- Een resource-entiteit heeft de 11 argumenten van het schema, met `PredefinedType` `.NOTDEFINED.`. `.USERDEFINED.`
  eist een `ObjectType` (WHERE-regel `CorrectPredefinedType`), en OPS kent geen verfijning onder de vijf soorten. Het
  type komt uit `RESOURCE_TYPE_TO_IFC`; een onbekend type wordt materiaal.
- Een kostenresource (#815) is een materiaalentiteit met `ObjectType` `COST` (`COST_RESOURCE_OBJECT_TYPE`) en
  `.USERDEFINED.`; de lezer zet die combinatie terug naar `COST`.
- `OPS_Resource` staat er alleen als minstens één veld van de standaard afwijkt of gezet is. De beschikbaarheid in
  stappen staat als `from:maxUnits;from:maxUnits`, op datum gesorteerd. De kleur reist mee zodat de rapportexport op
  elke machine gelijk kleurt.
- Een ploeg hangt aan haar leden met `IFCRELNESTS` (de ploeg als `RelatingObject`), zoals de WBS-hiërarchie van
  taken, en alleen als de ploeg leden heeft. `ParentGuid` in `OPS_Resource` is daarnaast een vangnet, zodat de eigen
  lezer niet afhangt van hoe andere programma's de richting van die relatie lezen. Een ploeg met het id `NaN`
  (beschadigde invoer) krijgt geen `IFCRELNESTS`, zoals bij de kalenderrelaties (ADR 0144).
- Een toewijzing waarvan de resource niet in het bestand staat (zoals een beschadigde toewijzing met `resourceId`
  `null`), slaat de writer over. Anders crashte elke opslag en elke AutoSave van dat document. Voor een gezond document
  valt er niets weg. Eén functie (`writtenAssignmentsByTask`) bepaalt welke toewijzingen meedoen en in welke volgorde,
  want die volgorde is de `<index>` in de sleutels van `OPS_Assignments` en `OPS_Timephased`.
- `OPS_Assignments` houdt één tekst per toewijzing, `"unitsPerDay|curve"`, met `UNIFORM` als er geen curve is. Al het
  andere per toewijzing (venster, curvewaarden, begroot, verricht en resterend werk, begroot tempo, het bedrag van een
  kostentoewijzing) staat als één JSON in `OPS_Timephased` met dezelfde sleutel. De writer breidt het pipe-formaat
  niet uit, zodat oudere lezers het blijven lezen. Een toewijzing zonder een van die velden staat niet in de JSON, en
  een taak zonder zulke toewijzingen krijgt geen `OPS_Timephased`.
- `OPS_TimephasedDurationWalks` is een eigen pset en loopt niet via `PER_TASK_PSETS`: een wandeling verwijst naar een
  kalender-id dat bij inlezen een ander id kan krijgen, dus de writer schrijft de GlobalId van de kalender
  (`resourceCalendarGuid`, ADR 0046). `workMinutes` staat er alleen als hij gezet is.
- Toetsen: `check-assign-resource-guard.ts` (de beschadigde toewijzing), `check-ifc-roundtrip.ts`.
