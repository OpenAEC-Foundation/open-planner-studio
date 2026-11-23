# Taken opheffen behoudt de keten

Opheffen (`dissolveTasksBulk`, issue #887) haalt taken weg zoals verwijderen. We kozen ervoor de keten van
voorgangers naar opvolgers te behouden: opheffen legt bruggen tussen de voorgangers en de opvolgers van wat weggaat.
Welke bruggen er komen, beslist `planDissolve` in `state/dissolveTasks.ts`; een relatie die blijft, kan een brug overbodig maken
(`check-dissolve-tasks.ts`, 25h). In de stand *Alleen de kopregel* (`ui.dissolveSummaryMode` `'header'`,
eigenaarsbesluit 2026-11-14) gaat bij een samenvattingstaak alleen de kopregel weg en schuiven de subtaken een niveau
omhoog (`dissolveSummaryHeader`, met `headerTransfers` voor de relaties). Wat de planner ziet, staat in de gids
`howto-taken-selecteren-verwijderen`.

## Gevolgen

- De hele handeling is één undo-stap.
- Deels gelukt is een weigering (eigenaarsbesluit 2026-10-17): de taken zijn weg, de geweigerde relaties zijn niet
  aangemaakt, en de melding `relationsSkippedOnDissolve` noemt ze.
- Test: `check-dissolve-tasks.ts`.
