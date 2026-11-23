# De verse tijd en de velden van een nieuwe taak

Een nieuwe taak krijgt haar tijd uit `createDefaultTaskTime` en haar velden uit `buildNewTask` (ADR 0156), beide in
`utils/taskDefaults.ts`. `createDefaultTaskTime` geeft meteen een einde dat bij de duur past, zodat de Gantt-balk
klopt vóór de eerste berekening; `runCPM` rekent daarna de vroege en late datums. Is er geen einde volgens ADR 0210
(een dagtaak, of een urentaak zonder bruikbare kalender), dan telt het met `addBusinessDays`, dat alleen weekenden
overslaat; de kalender van de taak telt pas bij de berekening.

## Gevolgen

- Is de start onleesbaar (een kapotte import), dan wordt het einde de start zelf: `formatDate` gooit op een ongeldige
  datum (`toISOString`). De solver meldt de ongeldige start bij de berekening (`invalidStartDate` in `CPMSolver.ts`).
- `taskSlice.addTask` en de MCP-draft (`draft.addTask`) voegen de meegegeven tijd samen met een verse
  `createDefaultTaskTime` (`mergeTaskTime`, ADR 0212) voordat ze `buildNewTask` aanroepen.
- Het taaktype erft van de ouder (ADR 0156). Zonder eigen type en zonder type van de ouder kiest `buildNewTask` op de
  bouwmodus (`opts.constructionMode`). De overerving zit in `buildNewTask`, dus geldt ze bij het aanmaken; `moveTask`,
  `indentTasks` en `outdentTasks` in `taskSlice` raken het taaktype niet aan.
- `priority` gebruikt `??`, zodat 0 een geldige prioriteit blijft.
- `levelingDelay` neemt `buildNewTask` niet over uit de invoer: dat veld schrijft de nivelleerder
  (`writeLevelingResult`). `levelingDelayMinutes` en `levelingDelayElapsed` neemt het wel over.
- `workRule` gaat als kaal veld mee, zonder stap door de werkregelbrug: een nieuwe taak heeft nog geen toewijzingen.
