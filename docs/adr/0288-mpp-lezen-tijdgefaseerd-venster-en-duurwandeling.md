# MPP lezen: een gelezen venster of een kalenderwandeling, per taak in lagen

`deriveTimephasedWindowsForTasks` beslist per taak of ze een gelezen venster van MS Project krijgt
(`timephasedFinishFloor`, `timephasedStartAnchor`) of een wandeling over de resourcekalender
(`timephasedDurationWalks`), of geen van beide. Wat de solver ermee doet, staat in ADR 0026. Een gelezen datum
reageert niet op een latere bewerking; een venster op elke taak zou de berekening na het openen vastzetten en alleen
het bestand naspiegelen. Daarom geldt het venster alleen waar het bestand echte tijdgefaseerde periodes heeft, en is
de wandeling een verwijzing naar een kalender die bij elke berekening opnieuw rekent. Samenvattingstaken, taken zonder
start en toewijzingen zonder koppeling (ADR 0287) doen niet mee.

## Gevolgen

- Laag 3, het venster: alleen bij `completion` 0, en alleen voor een toewijzing met minstens één echte gedecodeerde
  periode (gedecodeerd zonder `referenceFinish`, dus een vlak samenvattend record telt niet). Het einde is het
  laatste `FINISH` van zulke toewijzingen, het anker de vroegste `START`, letterlijk gelezen, zonder
  kalenderwandeling. Volgens het weggehaalde commentaar gaf dat 0 afwijkingen op de contourtaken van het corpus. Een
  gestarte of voltooide taak krijgt geen venster (ADR 0026).
- Laag 4, de wandeling: een toewijzing zonder echte periode maar met tijdgefaseerde gegevens (`hasAnyTimephasedData`),
  met `START`, een resource-id en een gevonden resourcekalender, is een kandidaat, bij elke voortgang; bij precies
  één wandeling gebruikt de solver die kalender ook voor de voortgangstak (ADR 0026). Een taak met een venster krijgt geen wandeling. Er is
  bewust geen terugval op het gelezen `FINISH` van zo'n toewijzing: dat zou het opgeslagen antwoord teruglezen
  zonder te rekenen.
- Precies één kandidaat: alleen als haar resourcekalender afwijkt van de taakkalender
  (`calendarDiffersIncludingExceptions`), een wandeling met de volle taakduur, zonder `workMinutes` en zonder filter op
  het soort resource (knownbug 440).
- Meer kandidaten: geen kalenderverschil nodig. Alleen toewijzingen die de duur sturen wandelen mee
  (`resourceDrivesDuration`, geen kostenresource uit `costResourceIds`; een onvindbare resource stuurt niet), elk met
  haar eigen werktijd: haar werk gedeeld door haar inzet (`assignmentRemainingMinutes`, regel 2 van de werkdriehoek),
  afgerond op een tiende minuut. Ontbreekt bij een van hen werk of inzet, of stuurt niemand, dan krijgt de taak geen
  wandeling. Het anker is de vroegste `START` van alle kandidaten, ook van de kandidaten die de duur niet sturen: het
  is het vroegste ankerpunt van een taak zonder voorganger, geen invoer van de wandeling. Volgens het weggehaalde
  commentaar gold in alle 661 gemeten `.mpp`-bestanden bij een werkresource dat werk gedeeld door inzet de werktijd
  tussen `START` en `FINISH` van de toewijzing is; draagt elke toewijzing een eigen hoeveelheid ("Task A" in
  `mpp14resource.mpp`: drie keer 1440 werkminuten bij een taakduur van 2880); bij materiaal is het werk een
  hoeveelheid, geen tijd (OzBuild "Report Binding": inzet 3, werk 180); en vond het tweede geval zonder kalenderverschil
  twee toewijzingen met verschoven eigen vensters op een kalender gelijk aan die van de taak (`a69fec157074d056`). De
  lezer kent alleen LABOR en MATERIAL (`readResourcesUnsafe`); materieel, onderaannemer en ploeg komen uit `.mpp` niet
  voor. Bron: MS Project "Duration = Work / Units", en
  "assigning material resources or cost resources to a task doesn't affect task scheduling" (support.microsoft.com,
  "How Project schedules tasks: Behind the scenes", geciteerd in het weggehaalde commentaar). Dit is de fix van
  knownbug 187 (PR #722). `check-mpp-walk-units.ts` toetst vier gevallen met bytefixtures: twee werkresources op
  12,5 %, een werk- naast een kostenresource, materiaal naast een werkresource, en een inzet van 0.
- De afronding op een tiende minuut (`roundToMspDurationResolution`), omdat werk en inzet met een kleine
  drijvendekommafout in het bestand staan: in `timephased-cost-rollup.mpp` een inzet van 1249,9998779296875 voor
  12,5 % en werk 299999,96875 voor 300 minuten, wat 2399,99998 geeft in plaats van 2400 en een einde om 16:59 in plaats
  van 17:00 (geval A in `check-mpp-walk-units.ts`, met die getallen).
- Het werk van een toewijzing is de som van verricht en resterend werk uit dezelfde decoders
  (`decodeAssignmentWorkMinutes`). Een vlak record vraagt een eindanker; dat is `FINISH`, anders taakstart plus een
  minuut. Het werkgetal hangt niet van dat anker af (`check-mpp-import.ts`, `[Z19 L3]`). Geen werk geeft `null`.
- Een resourcekalender wijkt af als haar weekblokken anders zijn of haar feestdagen of werkende uitzonderingen
  (`calendarBandsDiffer` vergelijkt inhoud, geen id, omdat elke resource een eigen kalenderobject krijgt; zonder
  `workTime` aan een van beide kanten wijkt niets af). Een resource met dezelfde week maar een extra vrije dag wijkt
  zo ook af; volgens het weggehaalde commentaar komt dat voor in `mpp14timephased2.mpp` en de bestanden
  `timephased-budget*.mpp`. Een grens bij een bewerkte duur: knownbug 2313.
- Wijkt bij een taak één kandidaat af, dan doen ook de andere vlakke kandidaten van die taak mee
  (`layer4ActivatedTasks`).
- In `readMPP` krijgt een wandeling `workMinutes` alleen uit de tak met meer kandidaten; na het filter kan die lijst
  één item lang zijn en toch `workMinutes` dragen. De solver toetst daarom per item (ADR 0026).
- Alleen bij een venster krijgt elke toewijzing van de taak `workWindowStart` en `workWindowFinish`, met de waarden
  van de taak: `readAssignments` geeft elke toewijzing een nieuw id en laat de onbemande weg, dus de juiste toewijzing
  vinden kost nog een lus over `TBkndAssn` voor een veld dat alleen informeert.
- Een wandeling met `workMinutes` draagt werk uit de import, dat niet meegroeit met een bewerking. Daarom wist
  `invalidateForTimeBaseChange` (`taskDefaults.ts`) een lijst met zulke wandelingen; `invalidateForAssignmentChange`
  wist elke lijst.

## Overwogen

Een venster op elke taak, ongeacht de periodes: zette de berekening na het openen vast. Een wandeling over de som van
het werk voor alle taken in plaats van de duurwandeling: de periodes van de meeste vlakke toewijzingen dragen alleen
een totaal, en in MSPDI zijn `<Work>` en `<Duration>` verschillende grootheden. Een fout in de koppeling van uid aan
taak als verklaring van de afwijkingen: volgens het weggehaalde commentaar is die koppeling een zuivere één-op-één.
