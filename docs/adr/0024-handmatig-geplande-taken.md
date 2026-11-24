# Een handmatig geplande taak houdt haar eigen datums

Een taak met `manuallyScheduled` (MS Project "Manually Scheduled") houdt haar opgeslagen `scheduleStart` en
`scheduleFinish` rauw aan: geen kalendersnap (MS Project snapt een handmatig anker nooit naar werktijd), geen druk
van voorgangers en geen afdwinging van constraints. Handmatig wint ook van een harde MSO/MFO-pin; de constraint is
dan een dode letter (`msp-58-z9a-manual-wint-van-constraint`). Haar opvolgers rekenen gewoon door op haar datums.
De lezer van `.mpp` zorgt dat zo'n taak het juiste veldpaar draagt (`resolveScheduleField`).

## Gevolgen

- De handmatige tak gaat vóór de hervatting, de voortgangskalender, het timephased venster en de
  nivelleervertraging: een handmatige taak met voortgang, venster of vertraging houdt haar rauwe anker. In het
  corpus dragen 10 van de 1659 handmatige taken ook voortgang en resume (onder meer "Task Three" en "Task Four" in
  `mpp14timephasedsegmentsmanual.mpp`, met de handmatige start 07:00 als eigen start van MS Project); geen enkele
  draagt `levelingDelayMinutes`.
- Slaat een bestand een finish vóór de start op, dan wordt de start de finish.
- Achterwaarts is LS = ES en LF = EF (`msp-57-z9a-manual-pin-forward`): de afgeleide duur van een handmatige taak is
  geen contract, en de gewone late pass zou spookspeling geven. De speling is in `scheduleAnalysis` per definitie 0
  (de telling in werkdagen geeft op een anker op een niet-werkdag een artefact, `msp-56`). Kritiek wordt niet
  geforceerd: met speling 0 geeft de gewone drempelregel het juiste antwoord, en een handmatige taak is, anders dan
  een hammock, een echt anker dat kritiek kan zijn.
- Anders dan een hammock legt een handmatige taak wel achterwaartse druk op haar voorgangers, met haar rauwe datums
  als late datums. Dat kan negatieve speling op een voorganger geven; dat is juist, want een vastgezette datum kan
  een echt logicaprobleem tonen. Geen corpusgeval raakt dit.
- ALAP schuift een handmatige taak nooit op, ook niet als ze een ALAP-constraint meedraagt. Een relatie naar een
  handmatige opvolger krijgt ook na een ALAP-verschuiving van de voorganger geen `seqConstraint`, zodat ze buiten
  vrije speling en driving blijft (ADR 0030).
