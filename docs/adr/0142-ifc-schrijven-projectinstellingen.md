# Wat de IFC-writer in OPS_ProjectSettings zet, en wat daar ook leeg staat

`OPS_ProjectSettings` op het `IfcProject` draagt de projectgegevens waar IFC geen plek voor heeft, of waar de plek in
IFC iets anders betekent. Voor de meeste velden geldt de gouden regel uit `docs/ifc-round-trip.md`: alleen schrijven
wat gezet is, zodat bestaande bestanden byte-gelijk blijven. Een paar velden staan er ook als ze leeg zijn, omdat de
lezer anders terugvalt op een andere bron en daarmee een waarde verzint. Een lege waarde is dan `$` als NominalValue:
"aanwezig, zonder waarde", voor de lezer iets anders dan "afwezig".

## Gevolgen

- `InternalProjectId` staat in elk bestand. Externe bronverversing koppelt op project-id en taak-id; zonder dit veld
  kreeg hetzelfde bestand bij elke keer lezen een nieuw project-id. Oudere bestanden zonder dit veld vallen in de lezer
  terug op de GlobalId.
- `ProjectStartDate` en `ProjectEndDate` zijn de contractuele projectdatums en staan in elk bestand, ook leeg. De
  slots `StartTime` en `FinishTime` van `IfcWorkPlan` dragen de afgeleide planomvang, zoals andere IFC-tools ze lezen
  (*Planomvang tegenover projectinvoer* in `docs/ifc-round-trip.md`). Ontbrak de eigenschap bij een lege einddatum,
  dan nam de lezer het einde van de planomvang en vulde een bewust leeg gelaten einddatum.
- `CreatedAt` en `ModifiedAt` staan hier als letterlijke ISO-tekst, en niet in de slots van `IfcOwnerHistory`
  (`IfcTimeStamp`). De owner history draagt al het schrijfmoment, dus teruglezen uit die slots zou `createdAt` van elk
  bestaand bestand veranderen, en `IfcTimeStamp` kapt de milliseconden af. Beide alleen als ze gezet zijn.
- Van de schemavraag (`ifcSchemaQuestion.ts`) staat er steeds één: `IfcSchemaUnconfirmed` met het schema van het
  geopende bestand zolang de vraag openstaat (na automatisch opslaan, crashherstel of een MCP-backup, ook als dat
  schema niet in de kop past, zoals IFC2X3), anders `IfcSchemaConfirmed`. Zo vraagt een bewust als IFC4 bewaard
  bestand bij heropenen niet opnieuw. Een bestand zonder een van beide (een oudere versie of een ander pakket) vraagt
  het één keer.
- Schrijft de writer geen eigen `IfcProject` omdat het project van de bron niet tot de planning hoort (ADR 0146), dan
  staan `ProjectName`, `ProjectDescription`, `Author` en `Organization` hier, ook leeg. Anders viel de lezer bij een
  lege auteur terug op de eerste owner history, en die is na de merge van het model. Zonder vreemd deel schrijft de
  writer deze vier niet.
- `ProgressMode` alleen als hij afwijkt van `RETAINED_LOGIC`. De andere velden (`wbsAutoNumber`, de standaardeenheid en
  standaardwerkregel, `StatusDate`, `CompanyId`, `CompanyName`, `P6ProjectCode`, `DependentProjectsFolder` en
  `AnchorsFromOpenDocuments`) alleen als ze gezet zijn, `AnchorsFromOpenDocuments` alleen als hij aan staat.
- Naam en omschrijving van een eigen project staan in `IfcProject` en in `IfcWorkPlan`. De lezer neemt de
  omschrijving eerst uit het werkplan en valt terug op het project.
- Datums in deze pset volgen *Datums in een property* in `docs/ifc-round-trip.md` (`ifcDateValue`).
