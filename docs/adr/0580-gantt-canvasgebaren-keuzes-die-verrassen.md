# Gantt-canvasgebaren: keuzes die verrassen

De hooks in `src/components/canvas/hooks/` bevatten een paar keuzes die een lezer zonder uitleg zou terugdraaien. De
balksleep staat in ADR 0370 tot en met 0377, de viewportformules in ADR 0500 tot en met 0507 en de componenten
erboven in ADR 0570; hier staat wat daar niet in staat.

## Gevolgen

- Na een pan of een kaderselectie slikt de vlag `justBoxSelectedRef` de click in die op het loslaten volgt, zodat
  die de nieuwe selectie niet meteen weer wist. `usePan` zet de vlag alleen als er echt gepand is
  (`BOX_SELECT_THRESHOLD`) en alleen voor de linkerknop. Volgens het weggehaalde commentaar geeft een middelklik geen
  click, zodat de vlag dan bleef staan en de eerstvolgende gewone klik opat; niet nagegaan. Eindigt een gebaar buiten
  het canvas, dan komt er geen canvasclick die de vlag opruimt. Daarom wist `onMouseDown` in
  `useGanttPointerCoordinator` de vlaggen bij elke nieuwe mousedown, en zet `useBoxSelect` een eenmalige
  click-luisteraar op `window` in de bubble-fase.
- `useGanttHistogramInteraction` blijft gemount als het histogram uit gaat; alleen de strook in de portal
  verdwijnt. Het effect op `active` sluit de tooltip daarom zelf, anders verscheen hij zonder nieuwe hover weer zodra
  het histogram terugkwam. `TOOLTIP_SAFETY_NET_MS` sluit een tooltip die zo lang niet veranderde: volgens het weggehaalde
  commentaar geeft een tik met touch of pen wel een `mousemove` en een `click` maar geen `mouseleave`; niet nagegaan.
- `useGanttViewportCoordinator` bouwt voor de inhoudsbreedte een eigen as zonder scroll en zoom (`spanAxis`). Zo hangt
  de dagspanne niet van scroll af, en `computeContentWidth` rekent haar daarna met de zoom om in pixels; met de gedeelde as, die bij elke scroll verandert, liep de berekening
  bij elke scroll opnieuw over alle taken, volgens het weggehaalde commentaar het grootste deel van een scrollframe
  bij 8000 taken.
- De tooltip op de primaire tijdlijn zoekt zijn taak op in de actuele taken (`tooltipTask` in `useGanttPointerCoordinator`) en
  gebruikt niet de taak uit de hit. Een hit hoort bij de laatst getekende frame: na F5 kan die achterlopen, en een
  muis die stilstaat levert geen nieuwe hit.
