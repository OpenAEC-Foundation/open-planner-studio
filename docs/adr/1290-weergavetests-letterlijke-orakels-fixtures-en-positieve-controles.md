# Tests van weergave, bediening en rapporten: letterlijke orakels, fixtures die afwijken en positieve controles

De tests in `tests/planning/` over de Gantt-weergave, de tabel en de rapporten bewaken vaak een refactor of een
optimalisatie waarbij het gedrag gelijk moest blijven. Ze houden daarvoor de oude code als letterlijke kopie in de
test en vergelijken de nieuwe code daarmee. Zo'n orakel deelt geen code met wat het meet, dus een fout in de nieuwe
code komt er niet vanzelf in mee. Ruim de kopieën niet op en vervang ze niet door een import uit `src/`, ook niet als
ze dubbel lijken. Hetzelfde geldt voor de lijsten met verwachte waarden die er met de hand in staan.

## Gevolgen

- Letterlijke orakels: de `old…`-functies in `check-gantt-render-options.ts` (de lichamen van de oude `useMemo`'s uit
  `GanttCanvas.tsx`) en in `check-axis-consolidation.ts` (de oude formules van print, GanttCanvas, de raster-`startOffset`
  en de uursleep), `oldResourceNames` in `check-view-index.ts`, `reference` in `check-move-candidates-scale.ts` en
  `oudVrij` in `check-print-screen-parity.ts`. Eén orakel deelt wel code: `oldTrace` en de huidige `buildTrace` lopen
  allebei via `traceFrom` (`src/engine/taskGrid/trace.ts`). De gekopieerde beslislogica (modus, focus, drijvende
  reeksen) blijft onafhankelijk; de graafwandeling eronder is gedeeld, dus een fout daarin vangt deze vergelijking niet. `check-bar-label-color.ts` ontleedt hex zelf (`rgbOf`) in plaats van
  de helper uit `themePalette.ts` te gebruiken.
- Lijsten met de hand: `recentsVerwacht` in `check-export-guard.ts` noemt elk exportformaat met de hand, en de check
  ernaast eist dat elk formaat uit `EXPORT_FORMATS` erin staat. De verwachte DCMA-uitkomsten in `check-dcma.ts` staan
  er als getallen, niet afgeleid uit `dcmaAssessment.ts`, met één uitzondering: punt 12 (de kritiek-padtest) verwacht
  de verschuiving `CRITICAL_PATH_TEST_SLIP_DAYS` uit `dcmaAssessment.ts`. De formules en normen per punt komen uit DCMA-EA
  PAM 200.1 (oktober 2012), hoofdstuk 4 en §3.1.2.3–3.1.2.4.
- De fixture van `check-gantt-render-options.ts` wijkt bewust af van de standaard. Velden in `baseInput` zoals
  `weekStartDay: 'sunday'`, `barSplitMode: 'always'`, `showFloatBand: false` en `showBarDates: true` hebben een andere
  waarde dan de terugval van de renderer bij een ontbrekend veld (niet elk veld: `durationDisplay: 'auto'` en
  `highContrast: false` vallen samen met de terugval), en de booleans staan niet allemaal op
  dezelfde waarde. Anders blijft een bouwer die een veld laat vallen of twee velden verwisselt groen. Om dezelfde reden
  ligt het extreme punt van de ketens `earlyStart || scheduleStart || lateStart` op de middelste schakel, en heeft de
  trace-focus zowel een voorganger als een opvolger. De fixture-bewakers (de bodem van 365 dagen moet overschreden
  zijn, de focus heeft aan beide kanten iets) horen daarbij.
- `check-gantt-event-ownership.ts` eist naast de negatieve eigendomschecks een lijst symbolen die er moeten zijn voor
  de overdracht van de verticale balksleep naar de rijsleep. Een negatieve check ziet niet dat een schakel verdwijnt.
  De lijst zoekt op woordgrenzen, zodat een hernoemd symbool met dezelfde beginletters niet meetelt.
- `check-zoom-steps.ts` laat de bronscans eerst de canonieke `ZOOM_STEP` in `ganttViewport.ts` vinden (03b), voordat
  de scans die een lege lijst verwachten iets zeggen. Een scan die niet werkt, geeft ook een lege lijst.
- De bron-asserts in `check-mutation-cost.ts` (deel 5) zijn de enige poort voor de wijzigingen die alleen tijd
  besparen: de WBS-nummering die buiten de draft leest en de belastingberekening buiten de producer. Daar is geen
  gedrag om op te toetsen.
- Twee pins bewaken een besluit van de eigenaar. `check-dependency-presentation.ts`: de rolmarkering vóór het WBS-nummer
  heeft geen ring in de tekstkleur (besluit 2026-10-19, PR #388); alleen op licht krijgt de vorm een rand in een
  donkerdere tint van de eigen kleur, omdat de tracekleuren daar zelf geen 3:1 halen. `check-theme-bar-contrast.ts`:
  de actieve baseline in het donkere thema heeft hoogstens L* 90 (`MAX_L_DONKER_ACTIEF`), want wit was daar te fel
  (bevinding eigenaar 2026-11-02, PR #780); in hoog contrast mag hij wit blijven.
