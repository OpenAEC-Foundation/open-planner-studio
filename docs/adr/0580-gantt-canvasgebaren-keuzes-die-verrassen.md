# Gantt-canvasgebaren: keuzes die verrassen

De hooks in `src/components/canvas/hooks/` bevatten een paar keuzes die een lezer zonder uitleg zou terugdraaien. De
balksleep staat in ADR 0370 tot en met 0377, de viewportformules in ADR 0500 tot en met 0507 en de componenten
erboven in ADR 0570; hier staat wat daar niet in staat.

## Gevolgen

- Na een pan of een kaderselectie slikt de vlag `justBoxSelectedRef` de click in die op het loslaten volgt, zodat
  die de nieuwe selectie niet meteen weer wist. `usePan` zet de vlag alleen als er echt gepand is
  (`BOX_SELECT_THRESHOLD`) en alleen voor de linkerknop. Een middelklik geeft geen `click` (UI Events: `click` alleen
  voor de primaire knop, de andere knoppen geven `auxclick`), zodat de vlag dan bleef staan en de eerstvolgende gewone
  klik opat. Eindigt een gebaar buiten
  het canvas, dan komt er geen canvasclick die de vlag opruimt. Daarom wist `onMouseDown` in
  `useGanttPointerCoordinator` de vlaggen bij elke nieuwe mousedown, en zet `useBoxSelect` een eenmalige
  click-luisteraar op `window` in de bubble-fase.
- `useGanttHistogramInteraction` blijft gemount als het histogram uit gaat; alleen de strook in de portal
  verdwijnt. Het effect op `active` sluit de tooltip daarom zelf, anders verscheen hij zonder nieuwe hover weer zodra
  het histogram terugkwam. `TOOLTIP_SAFETY_NET_MS` sluit een tooltip die zo lang niet veranderde: een tik met touch kan een tooltip openen
  die geen `mouseleave` krijgt (Touch Events §7 laat het omzetten van een tik naar muisevents, en wat daarna volgt,
  aan de browser over).
- `useGanttViewportCoordinator` bouwt voor de inhoudsbreedte een eigen as zonder scroll en zoom (`spanAxis`). Zo hangt
  de dagspanne niet van scroll af, en `computeContentWidth` rekent haar daarna met de zoom om in pixels; met de gedeelde as, die bij elke scroll verandert, liep de berekening
  bij elke scroll opnieuw over alle taken (een bevinding uit het profiel met 8000 taken in de commit "perf(gantt):
  scrollframes zonder volledige taak-, relatie- en toewijzingspasses").
- De tooltip op de primaire tijdlijn zoekt zijn taak op in de actuele taken (`tooltipTask` in `useGanttPointerCoordinator`) en
  gebruikt niet de taak uit de hit. Een hit hoort bij de laatst getekende frame: na F5 kan die achterlopen, en een
  muis die stilstaat levert geen nieuwe hit.
