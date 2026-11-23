# De verse tijd en de velden van een nieuwe taak

Een nieuwe taak krijgt haar tijd uit `createDefaultTaskTime` en haar velden uit `buildNewTask` (ADR 0156), beide in
`utils/taskDefaults.ts`. `createDefaultTaskTime` geeft meteen een einde dat bij de duur past, zodat de Gantt-balk
klopt vóór de eerste berekening; `runCPM` rekent daarna de vroege en late datums. Bij een dagtaak is dat
`addBusinessDays` over de duur, die weekenden overslaat; de kalender van de taak telt pas bij de berekening. Bij een
urentaak met kalender is het het ingevoerde einde van ADR 0210. De functie staat in `src/utils/` en niet bij de typen
in `src/types/`, omdat ze datumfuncties als waarde nodig heeft en `src/types/` alleen typen bevat.

## Gevolgen

- Is de start onleesbaar (een kapotte import), dan wordt het einde de start zelf. `formatDate` gooit op een ongeldige
  datum (`toISOString`); de solver meldt de ongeldige start bij de berekening als fout (`invalidStartDate` in
  `CPMSolver.ts`).
- `taskSlice.addTask` en de MCP-draft (`draft.addTask`) voegen de meegegeven tijd samen met een verse
  `createDefaultTaskTime` (`mergeTaskTime`, ADR 0212) voordat ze `buildNewTask` aanroepen. Ontbrekende verplichte
  velden krijgen zo de verse standaard.
- Het taaktype erft van de ouder (ADR 0156); zonder eigen type en zonder type van de ouder is het `CONSTRUCTION` in de
  bouwmodus (`ui.constructionMode`) en anders `USERDEFINED`. De overerving zit in `buildNewTask`, dus geldt ze bij het
  aanmaken; `moveTask`, `indentTasks` en `outdentTasks` in `taskSlice` raken het taaktype niet aan.
- `priority` gebruikt `??`, zodat 0 een geldige prioriteit blijft. De standaard 500 is *Normaal* uit de gids
  `howto-overbezetting-oplossen.md`.
- `levelingDelay` neemt `buildNewTask` niet over uit de invoer: dat veld schrijft de nivelleerder
  (`writeLevelingResult`). `levelingDelayMinutes` en `levelingDelayElapsed` neemt het wel over.
- `workRule` gaat als kaal veld mee, zonder stap door de werkregelbrug: een nieuwe taak heeft nog geen toewijzingen.
