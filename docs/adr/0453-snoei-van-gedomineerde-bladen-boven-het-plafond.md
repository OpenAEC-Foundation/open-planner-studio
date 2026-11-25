# Boven het plafond eerst gedomineerde bladen snoeien

Twee fasen van honderden bladen, met een keten erin, gingen over het plafond (ADR 0452) en de relatie tussen de
fasen viel in haar geheel weg: de planning negeerde de logica tussen de fasen (audit 2026-09-26). Gaat een relatie
over wat er van het plafond over is, dan snoeit `pruneDominated` daarom eerst de bladen die de grens aan hun kant
nooit kunnen bepalen; de solver neemt toch het maximum (ADR 0450). Past het gesnoeide kruisproduct, dan schrijft
`expandSummaryRelations` dat uit; anders valt de relatie weg zoals in ADR 0452. Onder het plafond wordt niets
gesnoeid. Alleen een FS-relatie met een lag van 0 of meer tussen twee bladen van dezelfde kant telt als dominantie:
na `p → p2` liggen start en finish van p2 na de finish van p. Aan de voorgangerkant valt blad p weg als een ander
blad van die kant zo op p volgt; aan de opvolgerkant valt blad q weg als het zo op een ander blad van die kant volgt.
SS en FF als dominantie zijn verworpen: in uurmodus gaven ze dezelfde werktijdpositie, maar bij een bandgrens een
andere weergave (16:00 van de ene werkdag in plaats van 08:00 van de volgende).

## Gevolgen

- Als dominantierelatie telt alleen een relatie uit de invoer met aan beide kanten een bladtaak, met lag in hele
  werkdagen (`wholeDayLag`: geen minutenlag en geen `lagUnit` `ELAPSEDTIME`), zonder negatieve waarde in `lagDays`,
  `lagMinutes` of `lagPercent` (`nonNegativeLag`), tussen twee taken met dezelfde `calendarId` die allebei `followsLogic`
  volgen. `followsLogic` sluit handmatig geplande taken, hammocks, mijlpalen, taken met voortgang (een werkelijke
  start of finish, of `completion` boven 0), taken zonder positieve `scheduleDuration` en de constraints MSO en MFO
  uit; zo'n harde constraint kan een taak vóór haar voorganger trekken, en een nulduurmijlpaal heeft eigen regels op
  een daggrens.
- `pruneDominated` snoeit niets en de relatie valt weg als de relatie zelf een procentuele lag heeft die niet 0 is
  (die rekent per voorgangerblad, knownbug 2479), als haar lag geen hele werkdagen is, als een blad aan een van de
  kanten de duursoort `ELAPSEDTIME` heeft, of als de bladen niet allemaal dezelfde duureenheid hebben
  (`taskDurationUnit`). Een minutenlag telt voor een dagvoorganger in afgeronde dagen en voor een uurvoorganger
  exact, en een lag in `ELAPSEDTIME` telt 24 uur per dag; dan houdt de dominantie niet altijd stand. In zulke
  gevallen vond de review van 2026-09-28 een gesnoeide uitkomst die een dag afweek.
- `check-summary-relation-prune.ts` vergelijkt in 900 willekeurige projecten (dag, uur en gemengd, in de profielen
  ops, p6 en msproject, alle relatietypen, met mijlpalen, handmatige taken en constraints) de berekening met het
  volledige kruisproduct en met de snoei, bij een plafond net onder het kruisproduct: elke taakdatum en speling, de
  drijvende relaties, de vrije speling per relatie, de kritieke paden, de floatpaden en de afgekapte leads moeten
  gelijk zijn. De twee gevallen uit de review van 2026-09-28 moeten de snoei overslaan of gelijk uitkomen, en een
  relatie tussen twee fasen van 300 bladen met elk een keten valt niet meer weg.
