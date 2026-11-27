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

- Delete en Backspace toetsen `COMMANDS.delete` via `isCommandEnabled` en volgen de invoer- en dialoogbewaking
  van de sneltoetsen. Delete, Backspace, Verwijderen en Dissolve gebruiken `hasEditableSelection` voor selectie
  en zichtbaarheid. Er moet een taak geselecteerd zijn en de takenlijst moet in beeld zijn. De lintknop Dissolve
  leest `hasEditableSelection` rechtstreeks.
- Dissolve heeft een lintknop en een menu-item maar geen sneltoets, en het paneel Verschuivingen geen sneltoets;
  ze staan niet in `COMMANDS`. Hun `use`-hook roept de store-actie of `setUI` zelf aan.
- Heeft een knop meer nodig dan aan en uit, dan spreidt hij de gedeelde binding en vult hij aan. De schakelaars voor
  het histogram en het waarschuwingspaneel voegen `active` toe; het omzetten zelf, bij het histogram ook het
  bewaren van de instelling, zit in de opdracht die Ctrl+Shift+H en Ctrl+Shift+L ook uitvoeren.
- Inspringen en uitspringen voegen buiten boommodus (`isTreeMode`) een tooltip toe aan de uitgeschakelde knop
  (`common:view.structureLockedHint`). Een sneltoets kan geen tooltip dragen: `COMMANDS.indent.run` en
  `COMMANDS.outdent.run` melden daar `notifyStructureLocked`.
