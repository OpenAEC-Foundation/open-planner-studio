# Het lint als data

Het lint staat in `ribbonConfig.tsx` als data: per tabblad een lijst groepen (`RibbonGroupSpec`), per groep items
(`RibbonItemSpec`). `RibbonTabContent.tsx` tekent elk tabblad uit `RIBBON_TABS` op dezelfde manier, naar het model
van `ExtensionRibbonGroups`. De winst zit in de vele knoppen en groepen die op meer tabbladen terugkomen (ADR 0481);
we persen daarom niet elke widget in data.

Er zijn drie soorten items: een knop (`kind: 'button'` of `'small'`), een stapel kleine knoppen (`'stack'`) en een
component (`'component'`). Een component is de uitweg voor een widget met eigen React-state, een popover, of een
indeling die niet uit een lijst knoppen volgt; die staan in `ribbonWidgets.tsx` en `src/components/ribbon/ai/`. Een
component in een stapel rendert zelf een `ribbon-btn small`, zoals `RecentFilesDropdown`, `ExportDropdown`,
`TemplatesDropdown` en `ScreenColorsPopoverButton`.

## Gevolgen

- Een label is een vertaalsleutel met namespace (`NsKey`, bijvoorbeeld `'menu:ribbon.calculate'`); de vertaling
  gebeurt pas bij het tekenen.
- Wat van de store afhangt (`onClick`, `active`, `disabled`, `title`, `icon`) komt uit de `use`-hook van het item
  zelf, met zijn eigen selectors. Zo loopt een tabwissel of een knopwijziging niet door één selector voor het hele
  lint. De zichtbaarheid van een groep komt op dezelfde manier uit `useVisible`.
- `uiAction` geeft `setUI` per klik een kopie van de patch: `setUI` vult zijn argument aan (de railregels in
  `uiSlice.ts`), en die aanvulling mag niet in de gedeelde patch van de knop blijven staan.
- `RIBBON_TABS` heeft een sleutel voor elk `RibbonTab` behalve `file`: dat tabblad is de Backstage. Een nieuw tabblad
  zonder inhoud geeft daardoor een compileerfout (`docs/recepten/ribbontabblad.md`).
- Bij de hernoeming van de twee knoppen in de groep Project op Instellingen (besluit 2026-10-15) bleven de
  vertaalsleutels en item-id's bewust gelijk: `projectInfo` is de knop Projectinstellingen en `projectSettings` de
  knop App-instellingen.
- De groep Kolommen op de Tabel-tab heeft als kop `common:view.columns.title` en niet het knoplabel
  `menu:ribbon.columns`, omdat dat label eindigt op een beletselteken.
