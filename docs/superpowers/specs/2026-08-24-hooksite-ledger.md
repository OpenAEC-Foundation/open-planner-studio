# Hooksite-ledger — onderhoudbaarheidsprogramma

**Datum nulmeting:** 24 augustus 2026

**Scope:** `src/**/*.{ts,tsx}`

**Status:** gesloten bewijsregister voor Plan 0, Tasks 7–13

Deze ledger maakt de aangetroffen React-hookschuld en de afronding ervan controleerbaar. De
reparatierichting was geen bevel om blind dependencies toe te voegen: per site bleef de functionele
invariant vooropstaan. Regels zijn de historische regelnummers in commit `afdc9265`, direct vóór
de eerste hookpoort. Alle H01–H41-sites zijn opgelost; het gegroepeerde commit- en testbewijs staat
onder de nulmeting.

## Reproduceerbare nulmeting

De meting is onder Node 22 uitgevoerd met de bestaande flat config en tijdelijke CLI-overrides:

```bash
npm exec -- eslint src \
  --rule "react-hooks/rules-of-hooks:error" \
  --rule "react-hooks/exhaustive-deps:warn" \
  --format json

npm exec -- eslint src --no-inline-config \
  --rule "react-hooks/rules-of-hooks:error" \
  --rule "react-hooks/exhaustive-deps:warn" \
  --format json

rg -n "eslint-disable.*react-hooks/(exhaustive-deps|rules-of-hooks)" src
```

De uitkomsten zijn:

- `rules-of-hooks`: **0 diagnoses**;
- normale `exhaustive-deps`-run: **21 waarschuwingen**, **0 fouten**;
- broncode: **21 inline suppressieregels**;
- met `--no-inline-config`: **42 diagnoses op 41 hooksites**.

Het verschil tussen 42 diagnoses en 41 sites is bewust: `GanttCanvas.tsx:743` meldt zowel een
ontbrekende dependency als een complexe dependency-expressie. De suppressie op
`UpdateDialog.tsx:89` dekte in deze nulmeting geen actuele diagnose af; die verouderde suppressie is
in Task 11 eveneens verwijderd. `reportUnusedDisableDirectives` staat sinds de sluiting van dit
register weer op `error`.

## Sites

In de kolom *reparatie* staat de uitgevoerde implementatierichting. *Regressiecheck* beschrijft het
gedragsbewijs dat voor de site groen is gemaakt. Iedere rij H01–H41 is opgelost; de bewijsclusters
eronder koppelen alle IDs expliciet aan hun commit en uitgevoerde tests.

| ID | Historische site en diagnose | Functionele invariant | Uitgevoerde reparatie | Afgeronde regressiecheck |
|---|---|---|---|---|
| H01 | `Backstage.tsx:58` — `closeBackstage` ontbreekt | Escape sluit altijd de actuele Backstage-sessie | `closeBackstage` stabiliseren met `useCallback` en opnemen | lint; voorgeschreven planning- en Gantt/documentbatterij van Task 8 |
| H02 | `HelpPanel.tsx:213` — `handleOpenExample` ontbreekt | Navigatie en openen gebruiken de actuele helpselectie | `handleNavigate` en `handleOpenExample` stabiliseren en beide opnemen | lint; bestaande help-/documentnavigatie plus Task-8-browserbatterij |
| H03 | `GanttCanvas.tsx:258` — `tMenu` ontbreekt | Een taalwissel vernieuwt de canvasmenuvertalingen | vertaalcallback als echte memo-dependency opnemen | lint; browsercheck op Gantt en taal-/rendervernieuwing |
| H04 | `GanttCanvas.tsx:262` — `tCommon` ontbreekt | Een taalwissel vernieuwt algemene canvaslabels | vertaalcallback als echte memo-dependency opnemen | lint; browsercheck op Gantt en taal-/rendervernieuwing |
| H05 | `GanttCanvas.tsx:459` — `uiTheme` is schijndependency | Een themawissel repaint de Gantt hoewel kleuren imperatief uit CSS komen | expliciete primitieve theme-/renderrevision doorgeven | `theme-render.spec.ts`: echte themawissel, painttoename en geen pageerror |
| H06 | `GanttCanvas.tsx:743` — `splitView` ontbreekt én complexe dependency | Wheel-routing volgt de actuele splitstatus zonder listenerlek | `splitEnabled` primitief afleiden; handler leest actuele storestate | `gantt-split-scroll.spec.ts`: echte wheel-events en juiste scrolloppervlakken |
| H07 | `MiniMap.tsx:89` — `uiTheme` is schijndependency | Een themawissel repaint de minimap | expliciete primitieve theme-/renderrevision doorgeven | `theme-render.spec.ts`: Gantt en minimap repainten zonder pageerror |
| H08 | `useBarDrag.ts:246` — vier kalender-/uurdependencies ontbreken | Dragberekening gebruikt kalender en precisie van de actieve render | kalender, effectieve kaart en beide uurmodi opnemen | planningbatterij plus echte Gantt-drag/undo-browsercase |
| H09 | `useBoxSelect.ts:131` — stabiele refs ontbreken | Boxselect blijft aan hetzelfde canvas en dezelfde renderer gekoppeld | drie stabiele refs expliciet opnemen | planningbatterij plus echte Gantt-selectie/drag-browsercase |
| H10 | `useCanvasLayer.ts:59` — spreaddependency is oncontroleerbaar | Canvas repaint uitsluitend op zichtbare, primitieve invalidatie | `extraDeps` vervangen door één `renderRevision` | thema-, split- en histogrambrowserchecks; geen ResizeObserver-loop |
| H11 | `useDependencyDraw.ts:75` — canvas-/rendererref ontbreken | Dependencygesture gebruikt de gemounte primaire laag | stabiele refs expliciet opnemen | planningbatterij en Gantt-browserinteractie zonder pageerror |
| H12 | `useDependencyDraw.ts:123` — container-/lijnref ontbreken | Overlayafmeting en cleanup blijven aan dezelfde nodes gekoppeld | stabiele refs expliciet opnemen | planningbatterij en Gantt-browserinteractie zonder pageerror |
| H13 | `usePan.ts:63` — selectieref ontbreekt | Pannen onderdrukt de click na boxselect met de actuele ref | stabiele ref expliciet opnemen | planningbatterij en echte Gantt-pointerinteractie |
| H14 | `useRowDrag.ts:110` — `computeHover` ontbreekt | Een actieve canvas-rowdrag verliest zijn listeners niet bij propwijziging | hoverberekening stabiliseren of actuele optionsref gebruiken | dragcase met storewijziging tijdens gesture; mouseup precies één commit |
| H15 | `useRowDrag.ts:176` — `computeHover` ontbreekt | Escape annuleert dezelfde actieve rowdrag zonder mutatie | dezelfde stabiele hover/optionsref en volledige cleanup | dragcase met Escape: nul mutaties; listener blijft tot annulering gekoppeld |
| H16 | `Select.tsx:107` — indices ontbreken | Openen initialiseert highlight; optie-update tijdens open menu wist cursor niet | actuele indices in refs; effect alleen op gesloten→open | `hook-synchronization.spec.ts`: echte toetsen en optiesupdate |
| H17 | `SequenceLagInput.tsx:21` — `seq` ontbreekt | Ongerelateerde sequencewijziging wist half ingevoerde lag niet | primitieve signatuur van vier getoonde lagvelden | `hook-synchronization.spec.ts`: half ingevoerde lag blijft staan |
| H18 | `CalendarDialog.tsx:50` — storeactie ontbreekt | Lokale kalenderbuffer initialiseert één keer per mount | stabiele Zustand-actie opnemen | lint; planningbatterij en openen/sluiten van kalenderdialoog |
| H19 | `PoolImportDialog.tsx:74` — bedrijven/default/selectie ontbreken | Bedrijfsupdate in open dialoog overschrijft handmatige keuze niet | open-sessie-id of gesloten→open als synchronisatiesleutel | `hook-synchronization.spec.ts`: handmatige keuze overleeft update |
| H20 | `ScreenshotAnnotator.tsx:189` — `shapes` ontbreekt | Shape-update tekent opnieuw maar schaalt canvas niet opnieuw | resize- en redraw-effecten scheiden; `shapes` alleen bij redraw | `hook-synchronization.spec.ts`: paint wel, resize niet |
| H21 | `DebugTerminal.tsx:56` — `entries` ontbreekt | Nieuwe logs bewegen een gepauzeerd snapshot niet | nieuwste entries in ref; alleen pauze-overgang snapshotten | `hook-synchronization.spec.ts`: gepauzeerde regels blijven gelijk |
| H22 | `IFCPanel.tsx:64` — `tCommon` ontbreekt | Import/exportmelding gebruikt actuele vertaling | stabiele vertaalcallback opnemen | lint; planning/documentbatterij en IFC-paneelactie |
| H23 | `RelationsPanel.tsx:109` — `rowData` ontbreekt | Relatietabel rekent met actuele, stabiele rijdata | `rowData` memoïseren en opnemen | lint; planningbatterij bewaakt relatiepresentatie |
| H24 | `ReportPanel.tsx:399` — `options` ontbreekt | Preview gebruikt dezelfde actuele opties als export | één volledig gememoiseerd `PrintOptions`-waardeobject | `report-options.spec.ts`: optie-/headerwijziging gelijk in preview en export |
| H25 | `ReportPanel.tsx:596` — header en timeline ontbreken | Export leest geen verouderde zelfstandig gebruikte velden | `repeatHeader` en `timelineColumns` echt opnemen | `report-options.spec.ts`: export na beide wijzigingen |
| H26 | `ResourceOccupancyView.tsx:133` — pool/company zijn schijndependencies | Cachedata lekt nooit tussen pool- of companycombinaties | cache-ref met expliciete `{companyId, pool}`-sleutel | library occupancycheck plus browsercase voor pool/companywissel |
| H27 | `ResourceOccupancyView.tsx:234` — verborgen documentinvalidatie | Actieve documentedit vernieuwt bezetting zonder documentwissel | payload uit concrete subscriptions of één expliciete documentrevision | librarycheck en occupancybrowsercase voor actieve edit |
| H28 | `ResourcePanel.tsx:222` — `openDraft` ontbreekt | Openen gebruikt altijd de actuele viewvariant | `openDraft` stabiliseren | `resource-panel-effects.spec.ts`: pending-new opent één juiste draft |
| H29 | `ResourcePanel.tsx:270` — `variantForView` ontbreekt | Viewwissel ruimt alleen de bijbehorende draft op | `variantForView` stabiliseren en effectdoel isoleren | resourcepanelspec: wissel behoudt andere drafts |
| H30 | `ResourcePanel.tsx:308` — view en storeactie ontbreken | Mount-/koppeling-reset gebeurt alleen op de bedoelde overgang | benoemde `useResourceViewReset` met echte dependencies | resourcepanelspec: reset niet bij ongerelateerde update |
| H31 | `ResourcePanel.tsx:330` — draft/focus/storeactie ontbreken | Pending-new wordt precies eenmaal geconsumeerd en gefocust | benoemde `usePendingResourceDraft` met stabiele callbacks | resourcepanelspec: één draft en één focusactie |
| H32 | `useTableRowDrag.ts:133` — hover en blockedcallback ontbreken | Actieve DOM-rowdrag leest actuele opties zonder herkoppeling | stabiele hover of actuele optionsref, inclusief `onBlocked` | table dragcase met storewijziging; mouseup precies één commit |
| H33 | `useTableRowDrag.ts:215` — `computeHover` ontbreekt | Escape annuleert de DOM-rowdrag zonder mutatie | dezelfde actuele-refvorm en identieke listenercleanup | table dragcase met Escape: nul mutaties |
| H34 | `TourOverlay.tsx:133` — `setUI` ontbreekt | Het startsnapshot wordt één keer genomen en later exact hersteld | stabiele storeactie opnemen; mountsemantiek behouden | `tour-layout.spec.ts`: start/finish herstelt UI-snapshot |
| H35 | `TourOverlay.tsx:184` — `finish`, `goTo`, `step` ontbreken | Ontbrekend anker wordt met actuele staplogica overgeslagen | callbacks en `step` stabiliseren/opnemen | tourspec: ontbrekend anker gaat correct door/af |
| H36 | `TourOverlay.tsx:204` — layout-effect zonder dependencyarray | Inhouds-/taalmaatwijziging hermeet zonder setState-lus | `ResizeObserver` op card, maten vergelijken vóór `setState` | tourspec: taal-/inhoudswijziging hermeet; geen loop/pageerror |
| H37 | `useAutoSave.ts:96` — `autoSaveEnabled` ontbreekt | Aan/uitzetten volgt de actuele instelling zonder throttle-semantie te wijzigen | echte primitieve dependency opnemen | lint; autosave-/documentbatterij en bestaande throttlechecks |
| H38 | `useGanttZoom.ts:107` — `zoomAt` ontbreekt | Zoomlistener gebruikt de actuele stabiele zoomactie | callback stabiliseren/opnemen | planningbatterij en echte Gantt-wheel/zoom-browseractie |
| H39 | `useRecoveryRestore.ts:161` — `t` ontbreekt | Recovery start eenmaal; taalwissel start geen tweede herstel | initiële vertaalcallback eenmalig in ref vastleggen | `hook-synchronization.spec.ts`: taalwissel zonder tweede recovery |
| H40 | `useSettingsBootstrap.ts:26` — `setUI` ontbreekt | Instellingen bootstrap eenmaal met de stabiele storeactie | Zustand-actie opnemen | lint; bestaande settingsbootstrap-/browserstartupcheck |
| H41 | `useSplitter.ts:47` — `opts` ontbreekt | Gesturelisteners blijven gekoppeld en lezen actuele grenzen/callbacks | `useLatestRef(opts)`; effect alleen op `isResizing` | `splitter.spec.ts`: opties wijzigen tijdens drag; commit eenmaal, Escape nul |

## Inline suppressieregels bij de nulmeting

De 21 regels zijn, vóór reparatie:

```text
HelpPanel.tsx:212
GanttCanvas.tsx:258
GanttCanvas.tsx:262
GanttCanvas.tsx:742
useCanvasLayer.ts:58
useRowDrag.ts:109
useRowDrag.ts:175
Select.tsx:106
CalendarDialog.tsx:49
PoolImportDialog.tsx:73
ScreenshotAnnotator.tsx:188
UpdateDialog.tsx:89
RelationsPanel.tsx:108
ResourcePanel.tsx:221
ResourcePanel.tsx:269
ResourcePanel.tsx:307
ResourcePanel.tsx:329
useTableRowDrag.ts:132
useTableRowDrag.ts:214
TourOverlay.tsx:132
TourOverlay.tsx:183
```

## Afgerond commit- en testbewijs

Alle 41 sites zijn hieronder zonder restgroep opgenomen. De browserchecks voeren de bedoelde
muisklikken, toetsen, wheel- en pointerevents uit; `window.__OPS__` levert uitsluitend fixtures,
Canvasgeometrie en state-/paintasserties.

| Opgeloste sites | Commit | Groen regressiebewijs |
|---|---|---|
| H01, H02, H08, H09, H11, H12, H13, H18, H22, H23, H37, H38, H40 | `7afd445c` | `npm run lint`; `bash tests/planning/run.sh`; `npm run test:browser -- --grep "Gantt|document"` |
| H03, H04 | `daa1dfe2` | `npm run test:browser -- tests/browser/gantt-localization.spec.ts`; Duitse weekdag- en duursuffixpaint na echte taalkeuze; twee rustige vensters van 500 ms; `npm run lint`; `npm run typecheck` |
| H05, H06, H07, H10, H26, H27 | `4623fc9f` | `npm run lint`; `npm run test:library`; `npm run test:browser -- --grep "theme|split|histogram|occupancy"` |
| H14, H15, H32, H33, H41 | `ed1e2ec6` | `npm run lint`; `npm run test:browser -- --grep "drag|splitter"`; actuele opties tijdens gesture, eenmaal committen en Escape zonder mutatie |
| H16, H17, H19, H20, H21, H39 | `4ce894ae` | `npm run test:browser -- --grep "hook synchronization"`; zeven echte synchronisatieflows; `npm run lint`; `npm run typecheck` |
| H24, H25, H28, H29, H30, H31, H34, H35, H36 | `75ae9001` | `npm run test:browser -- --grep "report options|resource panel|tour layout"`; zes echte UI-flows; `npm run lint`; `npm run typecheck` |

De afsluitende broncontrole
`rg -n "eslint-disable.*react-hooks/(exhaustive-deps|rules-of-hooks)" src` levert geen regels op
en eindigt daardoor met exitcode 1. Zowel `react-hooks/rules-of-hooks` als
`react-hooks/exhaustive-deps` en ongebruikte directives zijn nu fouten in `eslint.config.js`.

## Afsluitcriterium

Het afsluitcriterium is bereikt: voor alle H01–H41 zijn het bedoelde gedrag, de commit en een groene
regressiecheck vastgelegd; alle hook-suppressies zijn verdwenen; `rules-of-hooks` en
`exhaustive-deps` staan op `error`; ongebruikte directives worden opnieuw hard afgekeurd.
