# Gantt-canvascomponenten: keuzes die verrassen

De componenten in `src/components/canvas/` (zonder `hooks/`) bevatten een paar keuzes die een lezer zonder uitleg
zou terugdraaien. Ze staan hier, per onderwerp, met de reden.

## Renderopties

- `ganttRenderOptions.ts` is puur en importeert geen React, store of DOM, zodat `check-gantt-render-options.ts`
  dezelfde functies draait als de app. De `useMemo`-aanroepen met hun afhankelijkheden blijven bij de aanroepers
  (`GanttCanvas.tsx`, `useGanttViewportCoordinator.ts`): `drawPrimary` en `drawSecondary` in `useGanttRendererHost.ts`
  melden tijdens het tekenen de gemeten maat terug, en volgens het weggehaalde commentaar kan een verschoven memogrens
  dan een renderlus geven die geen headless test ziet.
- `buildSharedAxis` krijgt geen eigen cache over renders heen: een as die een kalenderwijziging overleeft, tekent op
  de oude werkdagen.
- `GanttRenderOptionsInput` is afgeleid van `GanttRenderOptions` met elke sleutel verplicht (`ExplicitlyRequired`,
  niet `Required`, zodat `undefined` als waarde mag blijven), en `buildGanttRenderOptions` geeft door met een spread.
  Zo breekt elk nieuw rendererveld bij het compileren beide plekken in `GanttCanvas` die de invoer opbouwen (primair
  en het tweede paneel), en wie een veld bewust weglaat, schrijft `undefined` op.

## Contextmenu

- De aangeklikte taak is de handgreep, de selectie de reikwijdte (`contextMenuOutlineScope`): zit de taak in de
  selectie, dan geldt de actie voor de hele selectie, anders alleen voor die taak, net als bij verticaal slepen. De
  selectie wordt op het moment van de klik uit de store gelezen, niet uit de render.
- Mijlpaal aan/uit leidt de nieuwe waarde af uit de aangeklikte taak en zet die op de hele reikwijdte; een schakelaar
  per taak geeft bij een gemengde selectie geen voorspelbare uitkomst. Inklappen en Uitklappen zijn om dezelfde reden
  twee items die nooit uit staan, zoals in het lint (ADR 0484).
- `CONTEXT_MENU_ITEM_CLASS` draagt geen tekstkleur: elke aanroeper zet zijn eigen kleur. Volgens het weggehaalde
  commentaar beslist bij twee kleurklassen van gelijke specificiteit de volgorde in de gegenereerde Tailwind-CSS en
  niet die in de `className`; niet nagegaan.

## Lay-out en invoer

- De pane-rij in `GanttCanvas` staat op `dir="ltr"`, ook in ar/fa: de minimapstrook eronder is ook op ltr vastgezet,
  en de ratiosleep (`useGanttViewportCoordinator`) rekent met `clientX - rect.left` op die rij. De schuifbalken zijn
  zwevende lagen in die rij en geen eigen kolom, zodat canvas en takenlijst tot de rand doorlopen.
- De histogramcontainer krijgt een callback-ref die de node ook in React-state zet (`setHistogramContainerNode`): de
  strook kan opnieuw mounten (het portaldoel bestaat pas na de eerste render) terwijl het `RefObject` gelijk blijft, en
  de listeners en observers moeten dan opnieuw hechten.
- Het label bij de splitslijn staat in de DOM en niet op het canvas, zodat het de tekstrollen en de tekengrootte volgt.
- `HoverTooltip` meet en klemt in een `useLayoutEffect` zonder afhankelijkheden: de doos verandert ook van maat door
  inhoud buiten `left`/`top` (andere taak, taal of tekengrootte).
- `RelationTypePopover` legt vast via een vlag en een effect, en de Enter-luisteraar stopt het event niet: het
  lagveld zet bij Enter zijn waarde nog in het concept, en pas na die render leest het effect het concept. De vlag
  voorkomt een tweede relatie als Enter en een klik buiten samenvallen. De focus op de typekeuze wacht op een timer:
  de klik die bij het loslaten hoort, zet de focus anders terug op het canvas.
- Uit het weggehaalde commentaar, niet nagegaan: een klik op een canvas geeft niet in elke browser DOM-focus, daarom
  roept `focusCanvas` in `GanttCanvas` `focus()` zelf aan; en een `<canvas>` valt vóór zijn eerste tekening terug op
  300×150, daarom zet `MiniMap` `maxWidth`/`maxHeight` op 100%.
