# Een lintknop en zijn opdracht

Een actie die zowel een lintknop als een sneltoets heeft, staat één keer in `COMMANDS` (`src/state/commands.ts`). De
lintknop bindt haar alleen via `useCommandBinding(COMMANDS.x)`, de sneltoets via `run: COMMANDS.x.run`; zo kunnen
de twee niet uit elkaar lopen. `check-commands.ts` telt per opdracht die bindingsvorm in `ribbonConfig.tsx` en
`shortcutRegistry.ts`, en eist dat het lint `COMMANDS` nergens anders voor gebruikt.

## Gevolgen

- Een actie die maar op één plek bestaat, staat niet in `COMMANDS`. Dissolve heeft een lintknop en een
  menu-item maar geen sneltoets; het paneel Verschuivingen heeft alleen de lintknop. Hun `use`-hook roept de
  store-actie of `setUI` zelf aan.
- Heeft een knop meer nodig dan aan en uit, dan spreidt hij de gedeelde binding en vult hij aan. De schakelaars voor
  het histogram en het waarschuwingspaneel voegen `active` toe; het omzetten zelf, bij het histogram ook het
  bewaren van de instelling, zit in de opdracht die Ctrl+Shift+H en Ctrl+Shift+L ook uitvoeren.
- Inspringen en uitspringen voegen buiten boommodus (`isTreeMode`) een tooltip toe aan de uitgeschakelde knop
  (`common:view.structureLockedHint`). Een sneltoets kan geen tooltip dragen: `COMMANDS.indent.run` en
  `COMMANDS.outdent.run` melden daar `notifyStructureLocked`.
