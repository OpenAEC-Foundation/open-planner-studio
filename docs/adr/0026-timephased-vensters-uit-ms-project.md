# Een timephased venster wint van de duur, maar niet van een pin of de SF-eis

De `.mpp`-lezer (`deriveTimephasedWindowsForTasks` in `mppReader.ts`) geeft een taak twee soorten timephased invoer
mee. Het gelezen finishvenster (`timephasedFinishFloor`, de toewijzingsfinish van MS Project) en de gelezen
toewijzingsstart (`timephasedStartAnchor`) zet hij alleen bij voortgang 0, omdat een gelezen datum bij een gestarte
taak een cirkelmeting zou zijn. De kalenderwandelingen (`timephasedDurationWalks`: per toewijzing een anker, een
resourcekalender en eventueel `workMinutes`) zijn geen gelezen datum maar een kalenderverwijzing; die zet hij bij
elke voortgang. De lezer kiest op basis van de echte perioden en de effectieve kalenders. Een vlakke toewijzing met
een afwijkende resourcekalender kan een wandeling krijgen. In de solver geldt deze voorrang: een voltooide taak plant op
haar werkelijke datums en een lopende taak op haar hervattings- en restwerkroute; die twee takken lezen geen
timephased venster. Voor de andere taken wint het gelezen finishvenster, anders het maximum van de wandelingen,
anders de gewone duur.

## Gevolgen

- Het venster wint van de kale vroege finish uit de duur, ook als die later lag, maar nooit van een harde MFO/MSO-pin
  en nooit van een echte SF-finishvloer. Het gelezen venster verrekent niet altijd de relatiewiskunde: voor "Task 5"
  in `mpp14relations.mpp` (SF-opvolger) draagt het de naïeve datum.
- Ligt het venster vóór de vroege start (een voorganger of een SNET/MSO duwde de start voorbij het venster), dan
  klemt de finish op de start. In het corpus nooit gezien; vastgelegd in `cases-advanced-cpm.json`.
- Een wandeling telt `workMinutes` als dat gezet is, anders de volle taakduur; het pad toetst dat per item, nooit aan
  de lengte van de lijst. Een resourcekalender zonder werktijd slaat het item over.
- `deriveTimephasedWindowsForTasks` telt kandidaten voor een wandeling, ook als de taak meer
  toewijzingen heeft. Eén kandidaat wandelt de actuele taakduur. Bij meerdere kandidaten rekent de lezer via
  `decodeAssignmentWorkMinutes` en `assignmentRemainingMinutes` de werktijd uit van elke kandidaat die
  de duur stuurt. Dat geldt ook als er na het filteren één overblijft. Een duurbewerking wist een wandeling
  met bevroren importwerk via `clearTimephasedDurationWalks`.
- Een wortel met een gelezen toewijzingsstart start daar rauw: MS Project bewaart op toewijzingsniveau een ongesnapt
  moment dat buiten de taakkalender en binnen de resourcekalender kan liggen (een "Night Shift"-resource om 23:00);
  `ownAnchor` zou dat snappen. Uitzondering: is het eigen anker van de wortel een rauw blokeinde (ADR 0014), dan
  negeert de wortel de gelezen start en het gelezen finishvenster, zodat de blokeinde-correctie van de duur het
  laatste woord houdt.
- Een gestarte of voltooide taak met precies één wandeling rekent haar hele voortgangstak in de resourcekalender van
  die wandeling, als die werktijd heeft (`progressCalendarFor`): start, restwerk, splits en hervatting, niet alleen de
  finish. Bewijs: 240 minuten restwerk eindigt met een resourcekalender van 2 uur per dag op di 10:00 en met de
  taakkalender op ma 12:00 (`check-advanced-cpm.ts`, check 204). Met meer dan één wandeling blijft de taakkalender.
