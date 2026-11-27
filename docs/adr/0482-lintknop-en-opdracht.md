# Een lintknop en zijn opdracht

De opdrachten in `COMMANDS` (`src/state/commands.ts`) hebben elk een lintknop en een sneltoets. De lintknop bindt
zo'n opdracht alleen via `useCommandBinding(COMMANDS.x)`, de sneltoets via `run: COMMANDS.x.run`; zo kunnen de twee
voor die opdrachten niet uit elkaar lopen. `check-commands.ts` telt voor elke opdracht in `COMMANDS` die
bindingsvorm in `ribbonConfig.tsx` en `shortcutRegistry.ts`, en eist dat het lint `COMMANDS` nergens anders voor
gebruikt.

Niet elke actie met een lintknop en een sneltoets staat in `COMMANDS`. Bereken en F5 roepen elk zelf `recalculate`
aan, Nieuw en Ctrl+N zetten elk zelf `showNewProjectDialog`, en de knop Sneltoetsen op Instellingen opent de
dialoog, terwijl Ctrl+/ haar ook weer sluit. De toets van `check-commands.ts` dekt die paren niet.

## Gevolgen

- Een sneltoets heeft naast de opdracht een eigen poort (`when` in `shortcutRegistry.ts`), die de lintknop niet
  leest. Delete en Backspace vuren alleen als de takenlijst in beeld is (`isTaskListOutOfView`), de lintknop
  Verwijderen kijkt alleen naar `COMMANDS.delete.isEnabled`; zie knownbug 2520.
- Dissolve heeft een lintknop en een menu-item maar geen sneltoets, en het paneel Verschuivingen geen sneltoets;
  ze staan niet in `COMMANDS`. Hun `use`-hook roept de store-actie of `setUI` zelf aan.
- Heeft een knop meer nodig dan aan en uit, dan spreidt hij de gedeelde binding en vult hij aan. De schakelaars voor
  het histogram en het waarschuwingspaneel voegen `active` toe; het omzetten zelf, bij het histogram ook het
  bewaren van de instelling, zit in de opdracht die Ctrl+Shift+H en Ctrl+Shift+L ook uitvoeren.
- Inspringen en uitspringen voegen buiten boommodus (`isTreeMode`) een tooltip toe aan de uitgeschakelde knop
  (`common:view.structureLockedHint`). Een sneltoets kan geen tooltip dragen: `COMMANDS.indent.run` en
  `COMMANDS.outdent.run` melden daar `notifyStructureLocked`.
