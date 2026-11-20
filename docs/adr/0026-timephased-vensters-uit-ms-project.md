# Een timephased venster uit MS Project volgt een vaste beslistabel

Voor de vroege finish van een taak uit MS Project geldt een gelaagde beslistabel. De lezer
(`deriveTimephasedWindowsForTasks` in `mppReader.ts`) vult de invoer; de solver past haar toe. Laag 1: een voltooide
taak plant op haar werkelijke datums. Laag 2: een lopende taak plant op haar hervattings- en restwerkroute. Voor die
twee lagen is er nooit een timephased venster, want dat zou een cirkelmeting zijn; de lezer zet de velden alleen op
een taak met voortgang 0. Laag 3: een gelezen venster (`timephasedFinishFloor`, de toewijzingsfinish van MS
Project). Laag 4: een verse wandeling per toewijzing door haar eigen resourcekalender
(`timephasedDurationWalks`), het maximum over de lijst. Laag 5: geen van beide, de gewone duur. Laag 3 en 4 komen
nooit samen op één taak.

## Gevolgen

- Het venster wint van de kale vroege finish uit de duur, ook als die later lag, maar nooit van een harde MFO/MSO-pin
  en nooit van een echte SF-finishvloer. Het gelezen venster verrekent niet altijd de relatiewiskunde: voor "Task 5"
  in `mpp14relations.mpp` (SF-opvolger) draagt het de naïeve datum. Ondanks de veldnaam is `timephasedFinishFloor`
  dus geen ondergrens maar een vervanging.
- Ligt het venster vóór de vroege start (een voorganger of een SNET/MSO duwde de start voorbij het venster), dan
  klemt de finish op de start. In het corpus nooit gezien; vastgelegd in `cases-advanced-cpm.json`.
- In laag 4 wandelt elk item `workMinutes` als dat gezet is, anders de volle taakduur. De lezer zet `workMinutes`
  bij meerdere toewijzingen: dan wandelt geen toewijzing de volle taakduur, maar haar eigen werktijd (werk gedeeld
  door inzet, de term van regel 2 van de werkdriehoek, `assignmentRemainingMinutes`). Zonder die verdeling gaf
  "Task A" in `mpp14resource.mpp` (drie toewijzingen) een ongeveer twee keer te late datum. Het pad toetst per item
  of `workMinutes` er is, nooit de lengte van de lijst: het corpus heeft lijsten van lengte 1 mét `workMinutes`.
  Een resourcekalender zonder werktijd slaat het item over.
- Een wortel met een timephased toewijzingsstart (`timephasedStartAnchor`) start daar rauw. MS Project bewaart op
  toewijzingsniveau een ongesnapt moment dat buiten de taakkalender en binnen de resourcekalender kan liggen (een
  "Night Shift"-resource om 23:00); `ownAnchor` zou dat snappen. Het is een preciezer gelezen anker, geen berekende
  waarde; zonder deze tak veranderen `mpp14timephased.mpp` en `mpp14timephasedsegmentsmanual(offsets).mpp`.
- Uitzondering: is het eigen anker van de wortel een rauw blokeinde (ADR 0014), dan volgt het timephased anker dat
  anker en is het niet onafhankelijk. De wortel negeert dan laag 3 helemaal, start en finish, zodat de
  blokeinde-correctie van de duur het laatste woord houdt. Dat is een invoervoorwaarde, geen vergelijking met de
  eigen berekening.
- Een gestarte of voltooide taak met precies één duurwandeling (de lezer zet die alleen bij een echt afwijkende
  resourcekalender) rekent haar hele voortgangstak in die resourcekalender als die werktijd heeft
  (`progressCalendarFor`): start, restwerk, splits en hervatting, niet alleen de finish. Anders rekent de tak half in
  de taakkalender en half in de resourcekalender. Het lezersveld is hier alleen een kalenderverwijzing, geen gelezen
  datum.
