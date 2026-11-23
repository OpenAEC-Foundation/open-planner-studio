# De ruwe relatiegrens is de ene bron voor vrije speling en driving

Per relatie bewaart de voorwaartse pass de grens die de relatie voor de opvolger genereerde (`seqConstraint`), vóór
de projectstartvloer en de werkdagsnap. Die ene waarde bepaalt zowel de vrije speling per relatie als de vraag of de
relatie driving is, ongeacht de eenheid van de lag. Driving volgt de definitie van P6: de grens van de relatie is de
aangenomen vroege datum van de opvolger (vrije speling van de relatie 0). Bij gelijkspel zijn meerdere voorgangers
driving. Driving is rekenuitvoer en wordt niet opgeslagen, ook niet in IFC.

## Gevolgen

- Een relatie zonder `seqConstraint` doet niet mee aan vrije speling en driving. Dat geldt voor relaties naar een
  hammock en naar een handmatig geplande taak (die zetten er nooit een), voor de relaties van een voltooide
  opvolger onder A12 (`preserveActualDatesInBackwardPass`, ook een C5-punt: een voltooide opvolger is historie) en
  onder C11 voor een open voorganger naar een gestarte opvolger bij Progress Override.
- Een resultaat dat niet weet welke relaties driving zijn ("Datums zoals opgeslagen", `cpmResultFromRecorded`, dat
  niet rekent; de driving-vlag van P6 wordt nooit gelezen), zet `drivingUnknown`. `drivingSequenceIds` is dan leeg
  zonder "niets is driving" te betekenen; lees de lijst via `knownDrivingSequenceIds` (`drivingInfo.ts`), die dan
  `undefined` geeft, zodat Gantt en rapport alles neutraal tekenen.
- In de gewone late pass is het projecteinde de beginwaarde van de late finish (voor een mijlpaal met de dagregel
  van ADR 0014 het begin van de laatste projectwerkdag). Opvolgergrenzen kunnen haar alleen naar voren halen; anders
  kan een SS-opvolger een late finish voorbij het projecteinde geven en krijgt de voorganger onterecht speling.
  Daarna gelden de late constraints en de deadline. Eigen paden buiten deze regel: het C5-punt, de A21-route, een
  voltooide taak met vastgezette werkelijke datums (A12), een hammock, een handmatige taak, het A17-eindpunt
  en een harde pin, die de late finish op de pin zet.
- C9 (`p6LateFinishOnOwnCalendar`) zet een late finish buiten de werktijd van de taak op het einde van de vorige
  werkperiode, alleen als een opvolgergrens de late finish bepaalt, ook na de late constraints. Het projecteinde en
  een strakkere constraint of deadline zijn niet gemeten en vallen erbuiten. Een grens op of binnen de werktijd
  (ook op een blokrand) blijft staan.
