# De eigen psets hebben één register voor hun namen en properties

Writer en lezer staan in verschillende bestanden. Een tikfout in de naam van een pset of property, of een verschil
tussen wat de writer schrijft en wat de lezer zoekt, geeft geen fout: de lezer vindt dan niets, en na opslaan en
heropenen is het gegeven weg. Daarom staat alles wat writer en lezer moeten delen in `ifcPsets.ts`: `PSET` met de naam
van elke eigen pset, `PROP` met per pset de propertynamen die de lezer leest, en voor de psets per taak met dezelfde vorm
een descriptor in `PER_TASK_PSETS` met de schrijfkant (`write`) en de leeskant (`apply`) samen. De writer schrijft die
psets uit de lijst (`emitPerTaskPsets`), de lezer zoekt de descriptor op naam op (`PER_TASK_PSET_BY_NAME` in
`extractStructure`). Writer en lezer gebruiken alleen deze constanten; `check-ifc-pset-register.ts` leest hun bron en
is rood bij een propertynaam als losse tekst en bij een nieuwe tekst in een vergelijking van de lezer (de regels A tot
en met E in die check). De route voor een nieuw veld staat in `docs/ifc-round-trip.md`, route 2.

## Gevolgen

- `PROP` is ook het register van #804 (ontwerp "Gebouwmodel behouden", §4.2): een property in een eigen pset die er
  niet in staat, is een vreemd lid (`foreign/classify.ts`). Een oude naam die de writer niet meer schrijft maar de
  lezer nog leest, blijft daarom in `PROP`, zoals `InterferingFloat`, `IsNearCritical` en `FloatPath` in
  `OPS_Analysis`. Een nieuwe property komt eerst in `PROP`.
- Vier psets hebben ook sleutels uit de data. Hun herkenner staat in `foreign/classify.ts`: `OPS_Assignments`
  (sleutels in GlobalId-vorm), `OPS_CustomFields` en `OPS_ActivityCodes` (namen uit de definities, met
  `ACTIVITY_CODE_ID_SUFFIX` voor het waarde-id, ADR 0143) en `OPS_XerSourceArchive` (een voorvoegsel uit
  `XER_ARCHIVE_CHUNK` plus zes cijfers, `xerArchiveChunkName`, gedeeld door writer, lezer en indeling).
- `OWN_PSET_PROPERTY_NAMES` is afgeleid uit `PROP` voor de psets zonder descriptor; samen met `readProps` van de
  descriptors dekt het elke pset in `PSET` (regel E van de check).
- Een descriptor krijgt alleen de taak en `PerTaskWriteOptions`. Een pset op project, werkschema, resource of
  kalender, een JSON-blok dat de bron is, of een pset waarvan het lezen andere objecten nodig heeft, deelt alleen de
  naam; schrijven en lezen staan dan in `ifcWriter.ts` en `ifcReader.ts`. Zo heeft `OPS_TimephasedDurationWalks` geen
  descriptor, want een wandeling verwijst naar een kalender (ADR 0147).
- De volgorde van `PER_TASK_PSETS` is de schrijfvolgorde: per descriptor alle taken. De lezer hangt niet van de
  volgorde af. GlobalId's van pset en relatie komen uit `psetSeed` en `relSeed` met het taak-id (`guidOf`, ADR 0140).
- Gelezen sturing en brondata staan in aparte psets. `OPS_TimephasedWindow` draagt het gelezen venster, dat een
  bewerking loslaat; `OPS_TimephasedContours` draagt de gedecodeerde contourperiodes uit een `.mpp`, die geen
  bewerking wist (ADR 0213). `OPS_WorkRule` staat naast `OPS_MspTaskType` en `OPS_P6Progress` (ADR 0303) en draagt ook
  de records `DayMeasureDurations` en `ExactMinutes`, omdat de werkregelbrug duur en werk beheert
  (`docs/ifc-round-trip.md`, "Dagenmaat met een breuk, lagmaat en speling"). `OPS_P6Progress` draagt alleen de velden
  van ADR 0303; de ruwe XER-bytes staan in `OPS_XerSourceArchive`, het bronarchief van ADR 0048.
- `OPS_Sequences` hangt aan het werkschema en sleutelt op de GlobalId van de relatie (ADR 0047). De reden in het
  weggehaalde commentaar: IFC laat een `IfcPropertySet` niet rechtstreeks aan een `IfcRelSequence` hangen. Dat is niet
  in de repo nagegaan; de schematabel van `check-ifc-schema.ts` noemt alleen de entiteiten die de writer gebruikt.
