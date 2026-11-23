# Taken opheffen

Opheffen (`dissolveTasksBulk`, issue #887) haalt taken weg zoals verwijderen en koppelt elke voorganger einde-begin
zonder vertraging aan elke opvolger (`planDissolve` in `state/dissolveTasks.ts`), zodat de keten blijft staan. In de
stand *Alleen de kopregel* (`ui.dissolveSummaryMode` `'header'`, eigenaarsbesluit 2026-11-14) gaat bij een
samenvattingstaak alleen de kopregel weg (`dissolveSummaryHeader`). Wat de planner ziet, staat in de gids
`howto-taken-selecteren-verwijderen`; de test is `check-dissolve-tasks.ts`.

## Gevolgen

- De hele handeling is één undo-stap. Is geen enkel id bekend, dan gebeurt er niets.
- In de kopregelstand schuiven de subtaken een niveau omhoog, op de plek van de kopregel en in hun volgorde, met
  dezelfde plaatsing als uitspringen (ADR 0150). De relaties van de kopregel gaan over naar de begin- en eindsubtaken
  (`headerTransfers`). Een externe relatie van de kopregel gaat net zo mee: een voorganger naar de eerste subtaken, een
  opvolger naar de laatste, met soort, vertraging, anker en bron. Anders verdween ze met de kopregel.
- Bij meerdere geselecteerde kopregels gaat de bovenste eerst; een geselecteerde subfase is daarna nog een kopregel
  en volgt.
- Een overgezette relatie die er al is, vervalt stil. Een relatie die de relatieregels weigeren, of een brug die de
  kringtoets van `planDissolve` weigert, wordt niet aangemaakt. Die toets leest de hele graaf, op een gewone
  momentopname en niet door de draft.
- Deels gelukt is een weigering (eigenaarsbesluit 2026-10-17): de taken zijn weg, de geweigerde relaties niet
  aangemaakt, en de melding `relationsSkippedOnDissolve` noemt ze.
