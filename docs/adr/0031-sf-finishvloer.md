# De SF-eis is een aparte vloer op de vroege finish

Een SF-relatie eist een finish: niet eerder dan de start van de voorganger plus lag. De solver houdt die eis als een
aparte ondergrens op de vroege finish (`forwardFinishFloor` in `relationMath.ts`), naast de startdruk van de relatie.
De vroege finish wordt daarna als start plus duur herberekend, en zou de SF-eis verliezen zodra die terugtelling
precies een niet-werkperiode overspant (`mpp14relations.mpp`, "Task 5"). De vloer geldt alleen als de herberekende
finish eronder blijft. Een harde finishpin wint van die vloer (ADR 0021), en een timephased venster telt de vloer
als ondergrens mee (ADR 0026).

## Gevolgen

- In welke maat een lag telt (werkminuten, gemeten werkdagen met `workdayDurationMeasure`, of klokminuten bij
  kalendertijd) en hoe een procentlag de maat van de voorganger volgt, staat in `lagCountsInWorkdays`
  (`src/engine/scheduler/conventions/durationMeasure.ts`), in het ontwerp "alleen uren" (§3.3, B7, I11) en in de gids
  `ref-rekenopties-en-conventies.md` (*Duur in werkdagen*). `resolveEffectiveLagDays` wordt gedeeld met de
  waarschuwingen in de relatietabel, zodat er één definitie van de lag in dagen is.
