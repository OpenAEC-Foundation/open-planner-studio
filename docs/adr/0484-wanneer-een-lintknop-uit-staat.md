# Wanneer een lintknop uit staat

Uitgeschakeld en uitvoerbaar zijn twee dingen. Als ontwerpregel gebruikt een lintknop met een `disabled`-voorwaarde
dezelfde toets als zijn actie, waar die actie er een heeft: een knop die aan staat terwijl de actie een no-op is, of
andersom, geldt dan als fout. Niet elke knop heeft zo'n gedeelde toets. Een knop die aan staat, kan een actie
starten die in die stand niets verandert, en een actie kan haar eigen voorwaarden pas bij het uitvoeren toetsen. Wat
een uitgeschakelde knop of een knop met twee betekenissen zegt, staat in zijn tooltip.

## Per knop

- Nivellering wissen gebruikt `hasLevelingOutput`, dezelfde toets als de no-op-guard in `clearLeveling`
  (ADR 0106). Hier valt uit staan samen met niets kunnen doen.
- Inspringen en Uitspringen staan aan bij een selectie in boommodus (`COMMANDS.indent.isEnabled`:
  `hasSelection` en `isTreeMode`). Of de structuur dan verandert, beslist `indentTasks`/`outdentTasks` in
  `taskSlice.ts`: met de eerste en enige taak op hoofdniveau geselecteerd staan beide knoppen aan en verandert geen
  van beide de planning of de undo-geschiedenis.
- Verwijderen en Dissolve staan aan bij een taakselectie terwijl de takenlijst in beeld is. Delete en Backspace
  gebruiken dezelfde voorwaarde voor selectie en zichtbaarheid (`hasEditableSelection`, ADR 0482).
- Project verplaatsen staat uit zonder `project.startDate`: die datum is het referentiepunt van de verschuiving.
  `MoveProjectDialog` toetst de datums zelf nog.
- Voortgangsblad exporteren en Voortgang bijwerken uit een blad staan uit zonder taken; Backstage → Importeren
  gebruikt voor de import dezelfde voorwaarde.
- De splitsknop staat uit als `isGanttWorkspaceVisible` onwaar is, want het gebaar vraagt een balk in de Gantt; de
  tooltip is dan `menu:ribbon.ganttOnlyHint`.
- WBS hernummeren staat uit zolang `project.wbsAutoNumber` aan staat. Vorige en Volgende resource in het histogram
  staan uit zonder histogram (`ui.showHistogram`) of zonder resources.
- De knop Taak zegt vooraf waar de nieuwe taak komt: onder de selectie als er een selectie is en `isTreeMode` geldt,
  anders onderaan. Dat is dezelfde poort als `canInsertRelative` in `addTaskNearSelection`.
- Inklappen en Uitklappen in de groep Overzicht zijn twee knoppen en geen schakelaar: met één schakelaar kun je een
  gemengde selectie niet in één keer dezelfde kant op zetten. Ze staan nooit uit en volgen de weergave. Zonder
  groepering werken ze op de samenvattingstaken en mijlpalenreeksen in de selectie, zonder selectie op allemaal
  (`collapseTasks`, `expandTasks`). Met een groepering (`view.group`) werken ze op alle groepsbanden
  (`collapseAllGroups`, `expandAllGroups`), want `computeViewRows` negeert dan het inklappen van taken. Een
  taakselectie heeft daar bewust geen effect: een taak kan in meer banden vallen en een band is geen taak.

## Zichtbaarheid

- De groep Weergave op Beeld (`display`) is de oude, losse weergavebediening, vervangen door de layoutknoppen en de
  layoutdialoog. Hij staat er alleen met de instelling Klassieke weergaveknoppen (`ui.showClassicViewControls`,
  `legacy: true` in de instellingencatalogus).
- Het tabblad AI staat er alleen met `AI_MODE_AVAILABLE` en `ui.aiMode` (`Ribbon.tsx`); zijn vier groepen zijn
  componenten.
