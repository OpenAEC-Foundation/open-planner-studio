# Een externe koppeling rekent op een vast anker, met dezelfde lag als intern

Een externe koppeling verbindt een taak met een taak in een ander project. De solver ziet de andere kant alleen als
een vast moment, het anker (`anchorDate`): bij een externe voorganger de vroege finish (FS, FF) of vroege start (SS,
SF) van de brontaak, zoals de verversactie die heeft ingeschreven. Er wordt altijd op het anker gerekend, ook als
de bron ontbreekt (`sourceMissing`), zoals P6 met External Dates. Een externe voorganger is een extra ondergrens
naast de constraints, een externe opvolger een extra bovengrens. De tijd is continu: na een finishanker komt geen
extra dag. De lag telt in de lagkalender van het project, met dezelfde loper als een interne relatie
(`shiftLagPred` met een relatie van hetzelfde type en dezelfde lag), ook als die lagkalender de eigen kalender is;
anders telt een lag in dagen als vaste minuten en geeft een gelijke kopie van de kalender een andere datum. Waarom de
lagkalender ook extern geldt, en de terugval op de eigen kalender als de gekozen kant in het andere project staat,
staat in `docs/relaties-tussen-projecten.md` (keuze 9).

## Gevolgen

- Het tweede teken van het relatietype bepaalt bij een externe voorganger de kant van de eigen taak (S: start,
  F: finish); het eerste teken bij een externe opvolger.
- Lag 0 normaliseert op de eigen kalender, zonder lagkalender. Met lag is de uitkomst het rauwe moment op de
  lagkalender, dat de solver omzet zoals de relatiewiskunde dat intern doet: een FS- of SS-opvolger start op het
  eerste werkmoment op of na de grens (een kalendertijdtaak neemt het rauwe moment); bij FS mag een eindmijlpaal op
  een geldig eindmoment landen (`finishStartLaggedStart`); bij FF eindigt een dagtaak niet vóór het rauwe moment
  (`dayTaskRequiredFinish`). Achterwaarts geeft SS/SF de rauwe late start, FS het eindmoment op of vóór de grens, FF
  bij een dagtaak het vorige blokeinde als dat dezelfde grens is.
- Een FS- of FF-grens achterwaarts is een eindmoment: een anker op wo 08:00 geeft een late finish di 16:00, niet
  wo 08:00. Op de tijdas is dat hetzelfde punt, maar de getoonde late finish en de dag die een dagtaak eruit leest
  verschillen (`bg141-*` in `cases-hours-blokgrenzen.json`). Een mijlpaal en een kalendertijdtaak blijven op het
  rauwe moment.
- Bij een kalendertijdtaak en lag 0 blijft het echte ankermoment staan, ook buiten werktijd, zodat een conflict
  buiten werktijd niet verdwijnt.
- Een externe opvolger heeft een te krap anker (`externalSuccessorViolations`) als de eigen taak niet meer vóór
  anker min lag past. Bij FS en FF beslist de vroege finish, bij SS en SF de start: de werkelijke start als die er
  is, anders de vroege. Een finish uit de duur zou bij voortgang de verkeerde kant toetsen. Twee momenten zijn
  hetzelfde punt als er op de lagkalender geen werkminuut tussen zit; een kalendertijdtaak telt in kloktijd. De
  pincontrole van een harde pin met een externe opvolger (ADR 0021) gebruikt dezelfde regel, aan dezelfde kant en
  vóór de omzetting naar de kalender van de taak.
