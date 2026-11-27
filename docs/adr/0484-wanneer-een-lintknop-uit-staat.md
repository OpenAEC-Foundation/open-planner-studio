# Wanneer een lintknop uit staat

Heeft een lintknop een `disabled`-voorwaarde, dan volgt die de reden waarom de actie in die stand niets kan doen,
met dezelfde toets als de actie waar die er een heeft. Een knop die aan staat terwijl de actie een no-op is, of
andersom, geldt als fout. Wat een uitgeschakelde knop of een knop met twee betekenissen zegt, staat in zijn tooltip.
Niet elke knop heeft zo'n voorwaarde; de bekende gevallen waarin knop en actie verschillen staan in `knownbugs.md`.

## Gevolgen

- Nivellering wissen gebruikt `hasLevelingOutput`, dezelfde toets als de no-op-guard in `clearLeveling`
  (ADR 0106).
- Project verplaatsen staat uit zonder `project.startDate`: die datum is het referentiepunt van de verschuiving.
- Voortgangsblad exporteren en Voortgang bijwerken uit een blad staan uit zonder taken; Backstage → Importeren
  gebruikt voor de import dezelfde voorwaarde.
- De splitsknop staat uit als `isGanttWorkspaceVisible` onwaar is, want het gebaar vraagt een balk in de Gantt; de
  tooltip is dan `menu:ribbon.ganttOnlyHint`.
- De knop Taak zegt vooraf waar de nieuwe taak komt: onder de selectie als er een selectie is en `isTreeMode` geldt,
  anders onderaan. Dat is dezelfde poort als `canInsertRelative` in `addTaskNearSelection`.
- Inklappen en Uitklappen in de groep Overzicht zijn twee knoppen en geen schakelaar: met één schakelaar kun je een
  gemengde selectie niet in één keer dezelfde kant op zetten. Ze staan nooit uit en volgen de weergave. Zonder
  groepering werken ze op de geselecteerde taken, zonder selectie op het hele plan (`collapseTasks`,
  `expandTasks`). Met een groepering (`view.group`) werken ze op alle groepsbanden (`collapseAllGroups`,
  `expandAllGroups`), want `computeViewRows` negeert dan het inklappen van taken. Een taakselectie heeft daar bewust
  geen effect: een taak kan in meer banden vallen en een band is geen taak.
- De groep Weergave op Beeld (`display`) is de oude, losse weergavebediening, vervangen door de layoutknoppen en de
  layoutdialoog. Hij staat er alleen met de instelling Klassieke weergaveknoppen (`ui.showClassicViewControls`,
  `legacy: true` in de instellingencatalogus).
- Het tabblad AI staat er alleen met `AI_MODE_AVAILABLE` en `ui.aiMode` (`Ribbon.tsx`); zijn vier groepen zijn
  componenten.

Een geval waarin het lint een andere voorwaarde heeft dan de sneltoets voor dezelfde opdracht: knownbug 2520.
