# Een lopende P6-taak staat op haar restwerk

P6 plant een lopende activiteit op haar restduur: "the total working time from the activity remaining start date to
the remaining finish date" (Oracle P6 Help, Durations Columns). Onder A19 (`p6UseRemainingStartForProgress`) zijn de
vroege en late start van een lopende taak daarom het begin van het restwerk, niet de werkelijke start. XER
exporteert ook die waarde op de as van de vroege start. Het begin van het restwerk volgt alleen uit invoer
(statusdatum, relatiegrens en een gevalideerde suspend/resume); de solver leest geen vroege of late uitvoer van P6.
De regel per conventie staat in de gids `ref-rekenopties-en-conventies.md`.

## Gevolgen

- A19, late kant: achterwaarts over een SS-relatie is de late finish de toegestane late start plus de restduur, niet
  plus de volle duur. Rest 0 maakt de taak een nulduur (LS = LF). Alleen SS: SF is niet gemeten. Niet bij
  kalendertijd of splitgaten. De late pass trekt bij een lopende taak de restduur af van de late finish
  (`subRemainingDuration`), als spiegel van de restduurtak voorwaarts.
- Zonder A19 maar met A12 blijft een vastgelegde werkelijke start van een lopende taak ook haar late start.
- C6 (`p6InProgressStartLagElapsed`, alleen met A19): van een positieve SS-lag in werktijd uit een lopende
  voorganger telt alleen `max(0, lag − werktijd(werkelijke start → statusdatum))`, voorwaarts en achterwaarts (Roads
  OCEC10311 SS+70 h naar OCEC10851: de late start in P6 is die van de opvolger).
- De projectoptie `startToStartLagFrom` = `actualStart` ankert die rest-lag voorwaarts op de statusdatum in plaats
  van op het begin van het restwerk ("the data date plus any remaining lag"). Achterwaarts begrenst zo'n relatie de
  lopende voorganger dan niet, omdat ze voorwaarts aan de statusdatum hangt en niet aan de voorganger (ongemeten,
  knownbug 1966).
- C8 (`p6StartedTaskIgnoresPlannedStartFloor`): voor een lopende taak is het geplande venster geen vloer (A16).
- C11 (`p6ProgressOverrideIgnoresStartedSuccessor`): onder Progress Override telt de relatie van een open voorganger
  naar een gestarte, nog lopende opvolger niet als voorgangerdruk, niet achterwaarts en niet in vrije speling en
  driving. Uitzondering: de FF-kloktijdgrens van C12 blijft op het restwerk van die opvolger werken, omdat de lopende
  tak geen Progress Override-poort heeft. In `check-conventions-p6-flags.ts` (geval f, ongemeten, zonder P6-orakel)
  eindigt de opvolger met C12 op ma 12 jan 08:00 en zonder C12 op wo 7 jan 17:00.
- Met `useExpectedFinishDates` wordt een verwachte einddatum van een P6-taak de vroege finish. Een datum zonder tijd
  heeft finishprecisie op de dag: de solver zoekt het laatste werkmoment op of vóór het einde van die kalenderdag.
  Is er binnen de scangrens geen, dan blijft de berekende finish staan in plaats van een middernachtanker te
  verzinnen.
