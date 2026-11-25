# P6 XML schrijven: de indeling, de ObjectId's en de volgorde van de WBS

`writeP6XMLWithReport` schrijft de indeling van echte P6 XML, die de lezer naast de oudere platte vorm leest (ADR
0261): de globale objecten (UDF-typen, het notitieonderwerp, kalenders, curves, resources, tarieven en het project)
direct onder `<APIBusinessObjects>`, en de objecten van het project (WBS, activiteiten, notities, relaties,
toewijzingen en `<ScheduleOptions>`) binnen `<Project>` (`check-p6xml-writer-p6.ts` (1)). De volgorde van de kinderen
en de lengtegrenzen komen uit `p6xmlSchemaOrder.ts` (`renderP6XmlWithReport`, toets (5) en (8)).

## Gevolgen

- De taken krijgen hun `ObjectId` uit één teller in de volgorde van de takenlijst (`taskObjMap`), voor WBS-elementen
  en activiteiten samen, zodat een WBS en een activiteit nooit hetzelfde nummer hebben. Resources, relaties,
  toewijzingen, notities, tarieven en curves hebben elk een eigen teller vanaf 1; de kalenders krijgen de nummering
  van `exportCalendarLayout`, met de projectkalender op 1 (ADR 0326). Het project heeft `ObjectId` 1, en elk
  projectobject verwijst ernaar met `ProjectObjectId` 1. Dat een `ObjectId` in P6 XML per soort uniek moet zijn en
  niet over het hele bestand, komt uit het weggehaalde commentaar en is niet nagegaan.
- De taken gaan in boomvolgorde het bestand in (`flattenOrder`): een ouder vóór zijn kinderen, broers in de volgorde
  van de weergave, omdat de volgorde in de store niets zegt over de weergave. `SequenceNumber` van een WBS is zijn
  plaats in die volgorde; de lezer ordent de WBS-taken erop (ADR 0261). Dat P6 WBS-broers op `SequenceNumber`
  sorteert, komt uit het weggehaalde commentaar en is niet nagegaan.
- Een taak waarvoor `isSummaryTask` waar is, ook een `isSummary` zonder kinderen (een lege WBS-rij uit P6), wordt een
  `<WBS>`; alleen een taak waarvoor `isLeafTask` waar is, wordt een `<Activity>` (toets 8h). Wat er gebeurt met een
  relatie of toewijzing van een samenvattingstaak: knownbug 2339 en 2340.
- Het `Id` van een activiteit is haar `wbsCode`, anders haar id. `renderP6XmlWithReport` kort het in tot
  `P6_ID_MAX_LENGTH` en maakt alleen een ingekorte waarde uniek (8j); twee gelijke korte codes blijven gelijk
  (knownbug 2341).
- De beschrijving van een activiteit gaat als `<ActivityNote>` onder een eigen `<NotebookTopic>` met de naam
  `OPS_DESCRIPTION_TOPIC_NAME`, en niet als `<Description>` op de activiteit (`check-p6xml-writer-p6.ts` 4e en 6g; de
  lezer: ADR 0260). Het onderwerp staat er alleen als minstens één activiteit een beschrijving heeft. Dat P6 geen
  beschrijvingsveld op een activiteit kent, komt uit het weggehaalde commentaar en is niet nagegaan. De beschrijving
  van een samenvattingstaak gaat niet mee (ADR 0367).
