# MPP lezen: een gelezen venster, één wandeling of wandelingen per toewijzing

`deriveTimephasedWindowsForTasks` levert per taak een gelezen venster van MS Project (`timephasedFinishFloor`,
`timephasedStartAnchor`), een of meer wandelingen over een resourcekalender (`timephasedDurationWalks`), of niets.
Welke van die velden bij het rekenen voorgaat, en wat een pin of een werkelijke start daaraan verandert, staat in
ADR 0026. Een gelezen datum reageert niet op een latere bewerking; een venster op elke taak zou de berekening na het
openen vastzetten en alleen het bestand naspiegelen. Daarom levert de lezer het venster alleen waar het bestand echte
tijdgefaseerde periodes heeft, en is een wandeling een verwijzing naar een kalender die bij elke berekening opnieuw
rekent. Alleen bladtaken met een start en toewijzingen met een koppeling (ADR 0287) doen mee.

## Gevolgen

- Venster: alleen als `time.completion` 0 is, uit de toewijzingen met minstens één echte gedecodeerde periode
  (gedecodeerd zonder `referenceFinish`, dus een vlak samenvattend record telt niet). Het einde is het laatste
  `FINISH` van die toewijzingen, het anker de vroegste `START`, letterlijk gelezen. Zonder bruikbaar `FINISH` levert de
  lezer geen venster. De lezer kijkt alleen naar `completion`, niet naar een werkelijke start. Volgens het weggehaalde
  commentaar gaf het venster 0 afwijkingen op de contourtaken van het corpus.
- Kandidaat voor een wandeling is elke andere gekoppelde toewijzing met tijdgefaseerde gegevens
  (`hasAnyTimephasedData`), een `START`, een resource-id en een gevonden resourcekalender; bij een `completion` boven 0
  ook een toewijzing met echte periodes. Er is bewust geen terugval op het gelezen `FINISH` van zo'n toewijzing: dat
  zou het opgeslagen antwoord teruglezen zonder te rekenen. Een taak met een venster krijgt geen wandeling.
- Precies één kandidaat: een wandeling met de volle taakduur (geen `workMinutes`), alleen als haar resourcekalender
  volgens `calendarDiffersIncludingExceptions` afwijkt van de taakkalender, en zonder filter op het soort resource
  (knownbug 440). Die vergelijker kijkt naar de weekblokken (`workTime.byWeekday`; zonder `workTime` aan een van beide
  kanten wijkt niets af) en naar de datumbereiken van feestdagen en werkende uitzonderingen, niet naar de werktijden
  binnen een werkende uitzondering (knownbug 2317). Volgens het weggehaalde commentaar wijkt zo een resource met een
  extra vrije dag af, zoals in `mpp14timephased2.mpp` en de bestanden `timephased-budget*.mpp`. Een grens bij een
  bewerkte duur: knownbug 2313.
- Meer kandidaten: geen kalenderverschil nodig. Alleen toewijzingen die de duur sturen wandelen mee
  (`resourceDrivesDuration`, geen kostenresource uit `costResourceIds`; een onvindbare resource stuurt niet), elk met
  haar werk gedeeld door haar inzet (`assignmentRemainingMinutes`, regel 2 van de werkdriehoek), afgerond op een tiende
  minuut. Ontbreekt bij een van hen werk of inzet, is een inzet niet groter dan 0, of stuurt niemand, dan levert de lezer voor
  de taak geen wandeling. Het anker is de vroegste `START` van alle kandidaten, ook van die de duur niet sturen.
  `check-mpp-walk-units.ts` toetst vier gevallen in één bytefixture: twee werkresources op 12,5 %, een werk- naast een
  kostenresource, materiaal naast een werkresource, en een inzet van 0 (geen wandeling). Bron: MS Project
  "Duration = Work / Units" en "assigning material resources or cost resources to a task doesn't affect task
  scheduling" (support.microsoft.com, "How Project schedules tasks: Behind the scenes", geciteerd in het weggehaalde
  commentaar); dit is de fix van knownbug 187 (PR #722).
- De afronding op een tiende minuut (`roundToMspDurationResolution`), omdat werk en inzet met een kleine
  drijvendekommafout in het bestand staan: in `timephased-cost-rollup.mpp` een inzet van 1249,9998779296875 voor
  12,5 % en werk 299999,96875 voor 300 minuten, wat 2399,99998 geeft en een einde om 16:59 in plaats van 17:00
  (geval A in `check-mpp-walk-units.ts`, met die getallen).
- Metingen uit het weggehaalde commentaar, niet in de repo nagegaan: in alle 661 gemeten `.mpp`-bestanden was bij een
  werkresource werk gedeeld door inzet de werktijd tussen `START` en `FINISH` van de toewijzing; "Task A" in
  `mpp14resource.mpp` heeft drie toewijzingen van elk 1440 werkminuten bij een taakduur van 2880; bij materiaal is het
  werk een hoeveelheid (OzBuild "Report Binding": inzet 3, werk 180); en `a69fec157074d056` heeft twee toewijzingen
  met verschoven eigen vensters op een kalender gelijk aan die van de taak. De lezer kent alleen LABOR en MATERIAL
  (`readResourcesUnsafe`).
- Het werk van een toewijzing is de som van verricht en resterend werk uit dezelfde decoders
  (`decodeAssignmentWorkMinutes`); een vlak record vraagt een eindanker, dat is `FINISH` of anders taakstart plus een
  minuut. `check-mpp-import.ts` (`[Z19 L3]`) toetst die helper: met en zonder anker hetzelfde werk, en `null` bij 0.
- `workMinutes` komt alleen uit de tak met meer kandidaten; na het filter kan die lijst één item lang zijn en toch
  `workMinutes` dragen (volgens het weggehaalde commentaar in `timephased-end-cost-resource.mpp`).
- Heeft een taak een venster, dan krijgt elke toewijzing van die taak `workWindowFinish` met het venstereinde van de taak, en
  `workWindowStart` alleen als er ook een anker is. De juiste toewijzing vinden zou nog een lus over `TBkndAssn` kosten,
  omdat `readAssignments` elke toewijzing een nieuw id geeft en de onbemande weglaat.
- Na een bewerking wist `invalidateForTimeBaseChange` (`taskDefaults.ts`) een lijst met `workMinutes`, omdat dat werk
  uit de import niet meegroeit; `invalidateForAssignmentChange` wist elke lijst.

## Overwogen

Een venster op elke taak, ongeacht de periodes: zette de berekening na het openen vast. Een wandeling over de som van
het werk voor alle taken in plaats van de duurwandeling: de periodes van de meeste vlakke toewijzingen dragen alleen
een totaal, en in MSPDI zijn `<Work>` en `<Duration>` verschillende grootheden. Een fout in de koppeling van uid aan
taak als verklaring van de afwijkingen: volgens het weggehaalde commentaar is die koppeling een zuivere één-op-één.
