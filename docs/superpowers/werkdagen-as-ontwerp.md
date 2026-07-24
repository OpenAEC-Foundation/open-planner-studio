# Ontwerp — «Alleen werkbare dagen tonen» (issue #21 punt 5)

> **Status:** ONTWERP (geen productiecode). Alles hieronder is geverifieerd tegen de
> code op worktree `issue-21-verbeterpunten` (stand 2026-07-24), tenzij als *open vraag*
> gemarkeerd. Een parallelle bouwsessie werkt ondertussen aan `src/state/` en aan een
> **nieuw** bestand `src/engine/view/dropTarget.ts` — die raken we in dit ontwerp alleen
> lezend en benoemen we als **coördinatiepunt**, niet als te-wijzigen bestand.

## 0. Doel, user-besluiten, scope

**Doel.** Eén instelling (toggle) «alleen werkbare dagen tonen» die de Gantt-tijd-as
**comprimeert**: weekenden én feestdagen/vakanties uit de projectkalender worden
volledig weggelaten. Na vrijdag komt direct maandag. Een taak van 5 werkdagen die over
een weekend + een feestdag heen loopt, is exact **5 kolommen** breed.

**Vastliggende user-besluiten (niet ter discussie).**
- (a) Het is een instelling die via het gedeelde `SettingsPanelContent` op **alle drie**
  de plekken verschijnt (tandwiel-popup ⚙, Instellingen-ribbontab, Backstage →
  Instellingen), exact zoals `barSplitMode`.
- (b) **Default UIT.**

**Niet in scope (expliciet).** MiniMap-strip en Print blijven in de eerste fase(s) op de
kalender-as — beide zijn bewust gescheiden transformaties (zie §4). De IFC- en
planning-logica (CPM, datums) worden **niet** aangeraakt: compressie is puur weergave.

---

## 1. Status van de aangeleverde feiten (verificatie)

De verkenner had de feiten grotendeels goed, met **twee pad-fouten** en een aantal
**aanvullende call-sites**. Onderstaand wat ik zelf geverifieerd heb.

### 1.1 Correcties op de brief
- `src/components/gantt/` **bestaat niet**. De echte map is **`src/components/canvas/`**
  (`GanttCanvas.tsx`, `hooks/`, `MiniMap.tsx`).
- `useGanttZoom.ts` staat in **`src/hooks/useGanttZoom.ts`**, niet in `canvas/hooks/`.

### 1.2 Bevestigd
- **`timeAxis.ts:18-27`** is de enige gedeelde bron voor `dateToX`; exporteert `MS_PER_DAY`.
  Importeurs: `GanttRenderer.ts:13` (wrapper `:184-186`), `HistogramRenderer.ts:9`
  (wrapper `:62`). Header-comment HistogramRenderer eist bit-identiekheid aan de Gantt-as.
- **`GanttRenderer` heeft al een `projectEngine: CalendarEngine`** (`:123`, gebouwd uit
  `opts.calendar` op `:148`) plus `engineCache` (`:134`). Wordt al in de render-loop
  gebruikt voor niet-werkdag-arcering (`:270`). → *Natural injection-point* voor de laag.
- **`dateToX` is het enige as-chokepoint in de renderer.** Alles — grid, feestdagarcering,
  feestdaglabels, vandaag-/status-/voortgangslijn, baseline, balken, segmenten, mijlpalen,
  constraint-pins, ghosts, pijlen én de header-tick-positie — gaat door `this.dateToX`
  (`:184`). Eén methode vervangen → het hele beeld verandert.
- **CalendarEngine biedt alles voor een prefix-som**: `workDayMask[1..7]`,
  `workDaysPerWeek`, `holidayDaySet` (UTC-dagindices), `holidayWorkdayIdxSorted`,
  `workDaysBetween` (O(log n), binary-search), `MS_PER_DAY` (static). Zie `CalendarEngine.ts:30-33, 104-166`.
- **`drawTierLabels`** (`:549-590`): tick-*logica* is pure kalender-arithmetiek
  (`snapToTickStart`/`nextTickBoundary` uit `timelineTiers.ts`), tick-*positie* is
  `dateToX(cursor)`/`dateToX(next)`. → Bij compressie worden week-/maand-ticks variabel
  breed; de **dag-tier moet bewust over werkdagen stappen** (zie §4.1).

### 1.3 Aanvullende call-sites die de brief niet noemde (moeten óók door de laag)
| file:line | wat | inverse? |
|---|---|---|
| `useBarDrag.ts:82` | uur-modus inverse `rawMs=(pixelDelta/zoom)*86400000` (**derde** inverse) | ja (uur) |
| `GanttCanvas.tsx:585-586` | split-view cursor-anker-zoom (dupliceert `useGanttZoom`) | ja |
| `GanttRenderer.ts:260` | `startOffset=floor(scrollX/zoom)` — eerste zichtbare dag (grid-loop) | ja |
| `GanttRenderer.ts:308/321` | `minWidthPx=zoom*3`, `widthPx=days*zoom` (feestdaglabel) | nee (px-uit) |
| `GanttRenderer.ts:957` | `ghostW=max(zoom*1.5,28)` (external ghost) | nee (px-uit) |
| `MiniMap.tsx:79,95,100` | strip↔hoofd-`scrollX`-wiskunde in de MiniMap-**component** | gemengd |
| `ganttViewport.ts:49,93-94` | `computeFitToProject` (`span=diffCalendarDays+1`), `computeScrollToDate` | nee (dagen-uit) |
| `ganttViewport.ts:55,118-131` | `ORIGIN_PADDING_DAYS=14`, `maxScrollX`-grenzen | nee (dagen-uit) |
| `printPreview.ts:298,318,501,510` | eigen `dateToX` (zonder scrollX), `chartWidth`, float-balk | nee |

> **MiniMap-renderer** (`MiniMapRenderer.ts:59-68`) en **Print** (`printPreview.ts`) zijn
> bewust *andere* transformaties (taak-span-gebaseerd, geen viewStart/scrollX). Die blijven
> in Fase 0–3 op de kalender-as; alleen het **viewport-kader** van de MiniMap moet de
> as-eenheid kennen (zie §5.5, §8).

---

## 2. De WorkdayAxis-laag (variant A)

**Keuze: variant A (één mappinglaag waar álle aanroepers doorheen gaan), niet variant B
(lokale correcties per plek).** Motivatie: (i) `dateToX` is al het enkele chokepoint in de
renderer; (ii) de brief telt 4 kopieën + de verkenning vond er nog 3 inverses bij — exact
de divergentie die variant B reproduceren zou. Lokale correcties *convergeren* naar A;
sla de omweg over.

### 2.1 Interface (as-abstractie, twee implementaties)

Beide implementaties delen één interface, zodat de renderer én alle interactie-code
polymorf door `this.axis` gaan en toggle-uit **byte-identiek** is aan vandaag:

```ts
// src/engine/renderer/axis/timeAxis.ts (bestaat; hier uitgebreid met inverse + interface)
export interface GanttAxis {
  /** datum (met sub-dag-precisie) → X op het chart-canvas (incl. −scrollX). */
  dateToX(date: Date): number;
  /** inverse: een X op het chart-canvas → datum (middag van de betreffende dag). */
  xToDate(x: number): Date;
  /** aantal *getoonde* dag-eenheden tussen twee datums (kalender- of werkdagen). */
  daySpan(from: Date, to: Date): number;
  /** de dag-index (0-gebaseerd) van `date` op de getoonde as; voor fit/scroll/width. */
  dayIndexOf(date: Date): number;
}
```

- **`CalendarAxis`** (toggle uit) = de huidige lineaire wiskunde: `daySpan=diffCalendarDays`,
  `dateToX` = huidige `timeAxis.dateToX`, `xToDate` = `viewStart + (x+scrollX-tableW)/zoom`.
  **Byte-identiek** aan vandaag per definitie.
- **`WorkdayAxis`** (toggle aan) = de prefix-som-mapping (§2.2).

De renderer krijgt `this.axis` in de constructor (naast `this.projectEngine`); `dateToX()`
wordt `return this.axis.dateToX(date)`. Eén aanroep-site verandert; alle 30+ `this.dateToX`
-aanroepen werken ongewijzigd door.

### 2.2 WorkdayAxis — datastructuur (prefix-som)

Sleutel-inzicht dat het ontwerp dramatisch vereenvoudigt: **`GanttRenderer` construeert elke
render een verse `CalendarEngine`** uit de actuele `opts.calendar` (`:148`). Bouw de
`WorkdayAxis` in dezelfde constructor → **geen cross-render cache, geen invalidatie-logica
voor de hoofd-render**: de volgende render = nieuwe engine + nieuwe axis, altijd actueel.
(Enkel callers *buiten* de renderer — `GanttCanvas`, `useBarDrag`, `useGanttZoom`,
`ganttViewport` — bouwen hun eigen axis via de pure factory; dat zijn geen hotpaths en ze
lezen de kalender uit de store, dus ook altijd actueel.)

**Datastructuur.** Een dichte prefix-array over een eindig venster, plus een
fallback-arithmetiek voor datums erbuiten:

```ts
// src/engine/renderer/axis/WorkdayAxis.ts
export interface WorkdayWindow { originDay: number; len: number; }      // UTC-dagindex-venster
export interface WorkdayAxisData {
  window: WorkdayWindow;
  prefix: Uint32Array;        // prefix[k] = #werkdagen met dagindex in [originDay, originDay+k]
  workDayList: number[];      // oplopende UTC-dagindices van alle werkdagen in het venster (voor inverse)
}
export function buildWorkdayAxis(cal: WorkCalendar, win: WorkdayWindow): WorkdayAxisData;
```

- `prefix[k]` is monotoon stijgend; `prefix[k+1]-prefix[k] ∈ {0,1}` (1 als dag `originDay+k`
  een werkdag is). Gebouwd uit `CalendarEngine`-afgeleiden (`workDayMask` +
  `holidayDaySet`): voor elke dag in het venster `isWorkDay` → +1. O(n) over het venster.
- **Lookup `dayIndexOf(d)`** = `prefix[d − originDay]` voor `d` in venster → **O(1)**. Dat
  is de hotpath (render-loop itereert alleen over het zichtbare bereik).
- **Out-of-range fallback** (mijlpaal/constraint/baseline ver buiten beeld): `dayIndexOf`
  valt terug op de bestaande `workDaysBetween(epoch, d)`-arithmetiek van CalendarEngine
  (O(log n)) of clamt naar de vensterrand + `console.warn`. Out-of-range is zeldzaam op de
  hotpath (alles wat getekend wordt ligt in `[viewStart-padding, maxTaskFinish+padding]`),
  dus de fallback hoeft niet snel, alleen correct.

**Venstergrootte.** `[min(viewStart, earliestTask) − 2·ORIGIN_PADDING_DAYS,
 max(viewEnd, latestTask) + 2·ORIGIN_PADDING_DAYS]` — dekt alles wat de renderer ooit
tekent. Voor een 10-jaars-horizon ≈ 7300 entries × 4 bytes = **~30 KB**; triviaal, en
wordt per render weggegooid (geen lekkage).

### 2.3 Sub-dag-interpolatie (belangrijk voor urenplanning, §6)

`dateToX` vandaag is *fractioneel* in tijd (`daysFromStart = Δms/MS_PER_DAY`, mag niet-heel
zijn). De `WorkdayAxis` moet dat behouden **binnen een werkdag-kolom**, zodat een uur-taak
`do 09:00–11:00` correct binnen de donderdag-kolom landt:

- Voor een **werkdag** `d` op as-index `i`: `x(d + f·dag) = base + i·zoom + f·zoom`,
  `f ∈ [0,1)`.
- Voor een **niet-werkdag**: géén interpolatie (er is geen kolom) → kleef naar de naad (§2.4).

`base = taskTableWidth − dayIndexOf(viewStart)·zoom` (zodat `viewStart` op zijn plek staat).
`dateToX(d) = base + effectiveIndex(d)·zoom + intraDayFraction(d)·zoom − scrollX`, waarbij
`effectiveIndex` de kleef-rechts-semantiek (§2.4) toepast op de dagmaatschap.

### 2.4 Randgeval: waar «landt» een niet-werkdag? — *kleef-rechts (naad-landing)*

Dit is de semantiekkeuze die het hele beeld coherent maakt. Een niet-werkdag (za/zo/feestdag)
kán op de gecomprimeerde as nergens «eigen» ruimte krijgen. Drie kandidaten:

| optie | niet-werkdag `d` landt op | effect |
|---|---|---|
| (i) kleef-links | x van `prevWorkDay(d)` (linkerrand vorige werkdag) | mijlpaal-op-za valt *op* de vr-kolom → liegt («za = vr») |
| (ii) **kleef-rechts (naad)** | x van de volgende rasterlijn = `dayIndexOf(prevWorkDay(d))+1` | mijlpaal-op-za valt exact op de **naad** vr→ma |
| (iii) midden-clamp | halverwege | niet continu met balk-einden |

**Gekozen: (ii) kleef-rechts / naad-landing.** Motivatie:
1. **Continu van links.** Een dag-taak die op vrijdag eindigt, heeft balkbreedte
   `[x(Vr), x(Vr)+zoom]`; het rechteruiteinde = `x(Vr)+zoom` = `dayIndexOf(Vr)+1` = de naad.
   Een mijlpaal op zaterdag krijgt **dezelfde x** als dat balkuiteinde → ze vallen coherent
   samen op de naad, niet «erbinnen».
2. **Consistent met de kalender-arithmetiek** die er al is: `nextWorkDay`/`prevWorkDay`
   behandelen een niet-werkdag als «hoort bij de volgende werkdag-grens».
3. **Samenval met de naad-marker** (§4.3): de naad is zélfs de natuurlijke plek om de
   verborgen pauze te markeren, dus een datum die daar landt is informatief, niet verwarrend.

**Gedocumenteerde ambiguïteit (onvermijdelijk bij compressie):** een mijlpaal op za, een
mijlpaal op zo, én een taak die op maandag start vallen **alle drie** op dezelfde naad-x.
Informatieverlies dat inherent is aan compressie; afgevangen in §7 (open vragen: marker).

### 2.5 Invalidatie-samenvatting
- **Binnen de renderer:** geen — fresh-per-render (§2.2).
- **Buiten de renderer (`GanttCanvas`, `useBarDrag`, `useGanttZoom`, `ganttViewport`,
  `MiniMap.tsx`):** bouw de axis on-demand uit (kalender uit store, venster uit view+tasks).
  Geen memoisatie-strategie nodig voor v1; eventuele memo op `(calendar.id, window-key)`
  is een later-optimisatie, geen correctheid.

---

## 3. Fase 0 — Consolidatie (gedragsneutraal, toggle bestaat nog niet)

**Doel:** alle `pixels = dagen × zoom`-wiskunde (én de inverses) door **één** functie-paar
(`dateToX` + `xToDate`) leiden, **zonder** ook maar één pixel te veranderen. Dit is de
voorwaarde waardoor Fase 2 één schakel kan omzetten in plaats van 9 plekken te moeten
patchen. MiniMap-strip en Print blijven ongemoeid (andere transformatie).

### 3.1 Bestanden
- **Wijzig `src/engine/renderer/timeAxis.ts`:** voeg `xToDate` + de `GanttAxis`-interface
  toe. `dateToX` zelf ongewijzigd (signature dekt alle call-sites: `originDate`,
  `taskTableWidth`, `zoom`, `scrollX`; print/auto-scroll geven `scrollX=0`).
- **Wijzig `src/services/print/printPreview.ts:318`:** vervang de inline `(date)=>TABLE_WIDTH+diffCalendarDays(minDate,date)*zoom`
  door `dateToX(date, minDate, TABLE_WIDTH, zoom, 0)`. Identieke output (scrollX was er niet).
- **Wijzig `src/components/canvas/GanttCanvas.tsx:706-707`:** vervang door
  `dateToX(..., evs, tableW, v.zoom, 0)` (de bewuste «zonder −scrollX»-variant = `scrollX:0`).
- **Wijzig de inverses** naar één `xToDate`-helper:
  `useBarDrag.ts:140` (dag), `useBarDrag.ts:82` (uur — apart pad, zie §6),
  `useGanttZoom.ts:38-42`, `GanttCanvas.tsx:585-586` (split-view),
  `GanttRenderer.ts:260` (grid `startOffset`).

### 3.2 Hoe bewijs je byte-identiek?
Pixel-diffs zijn fragiel (font-hinting, AA). Beter: een **headless ctx-recorder**.
De renderer roept een beperkte subset van `CanvasRenderingContext2D` aan
(`fillRect`, `moveTo`, `lineTo`, `stroke`, `fillText`, …). Vervang de `ctx` in een
Node-test door een spy die elke aanroep als een serialiseerbaar record logt
(`{op, args}`), render hetzelfde project **voor** en **na** Fase 0, en assert dat de twee
commando-arrays **diep-gelijk** zijn. Deterministisch, geen native-canvas-afhankelijkheid,
werkt in de bestaande headless esbuild/Node-testinfra (`tests/planning/`).

- **Per-call-site eenheidstest:** `expect(consolidated(input)).toEqual(oldInline(input))`
  over een rooster van inputs (randen: `viewStart`-exact, halve dag, ver ervoor/erna).
- **Render-snapshot:** één keer `GanttRenderer.render()` met een fixture-project recorder-
  mock, array opslaan; na Fase 0 opnieuw, diff moet leeg zijn.
- **Poort:** `tsc` groen + `tests/planning/run.sh` ongewijzigd (raakt deze code niet, maar
  voorkomt regressie in de store). Fase 0 mag **niet** de suite beïnvloeden → exitcode 0.

---

## 4. Per teken-onderdeel — wat verandert bij toggle-aan

Alles hieronder gebeurt **in Fase 3** (na de instelling). Per onderdeel de concrete aanpassing.

### 4.1 Header-tiers (`drawTimelineHeader` / `drawTierLabels`, `:505-590`)
- **Week-/maand-tier (major/mid):** werkt *vrijwel automatisch* — `x1=dateToX(cursor)`,
  `x2=dateToX(next)` geven nu de gecomprimeerde breedte. Een weektick krijgt `5·zoom` i.p.v.
  `7·zoom`; een maand krijgt `(werkdagen in die maand)·zoom`. `minLabelWidth`-skip-regel
  (`:582`) blijft gelden. **Eén aandachtspunt:** `snapToTickStart('week')` geeft een maandag;
  als de werkweek op een andere dag begint (of de week-start op een feestdag valt), kleine
  afwijking — acceptabel, documenteer.
- **Dag-tier (minor):** de cursor-loop stapt nu met `nextTickBoundary('day')=+1 kalenderdag`.
  Bij compressie vallen za & zo op **dezelfde naad-x** → de labels «Za»/«Zo»/«Ma» zouden
  overlappen. **Aanpassing:** in compressed-modus de dag-tier laten itereren met
  `nextWorkDay(cursor)` i.p.v. `nextTickBoundary`. Niet-werkdagen krijgen geen label. Dit is
  de belangrijkste header-wijziging; de others vloeien voort uit `dateToX`.

### 4.2 Grid + niet-werkdag-arcering (`drawGridBackground`, `:254-295`)
- De loop itereert vandaag per *kalenderdag* (`addCalendarDays(viewStart, offset+i)`) en
  arceert niet-werkdagen (`:270`, breedte `zoom`). Bij compressie: itereren per **werkdag**
  (`nextWorkDay`), en de **arcering vervalt volledig** (er zijn geen niet-werkdagen meer om
  te arceren — dat is het hele punt). De verticale grid-lijn per werkdag-kolom blijft.
- `startOffset` (`:260`) wordt via `axis`-inverse bepaald (eerste zichtbare werkdag-index).

### 4.3 Feestdaglabels (`drawHolidayLabels`, `:298-352`) — vervangen door naad-marker
- Vandaag: `widthPx = days*zoom` (`:321`); bij compressie = 0 → géén label meer (feestdagen
  zijn weggecomprimeerd, er is niets om een naam boven te zetten). Dat is **correct** maar
  verliest informatie.
- **Vervanging: een «naad-marker»** op elke overgang waar ≥1 niet-werkdag is overgeslagen.
  Twee lagen, beide optioneel (instelling-afleidbaar in een latere iteratie, default aan):
  1. een **subtiele verticale lijn** (1 px, dim-grijs, `colors.grid`-familie) op de naad-x;
  2. een **mini-badge** met de feestdag-naam bij *meerdaagse* blokken (bv. bouwvak), klein
     en verticaal langs de naad — hergebruik de verticale-tektstcode uit `:340-348`.
- Weekend-naaden krijgen alleen de lijn (geen naam); feestdag-naaden krijgen lijn + badge.
  Zo blijft «waarom is deze taak maar 3 kolommen i.p.v. 5?» zichtbaar verklaard — het
  oorspronkelijke 2.5-QA-doel van `drawHolidayLabels` (commentaar `:298-303`) blijft gewaarborgd.

### 4.4 Vandaag-lijn, statusdatumlijn, voortgangslijn (`:354-415`)
- `x = dateToX(today/statusDay)`. Valt de datum op een niet-werkdag → landt op de naad (§2.4).
- **Vandaag in het weekend:** de lijn staat op de naad vr→ma. Acceptabel en informatief;
  eventueel iets dimmer/breedte-verhoging zodat hij niet in de naad-lijn verdwijnt
  (open vraag §7).

### 4.5 Mijlpalen (`drawMilestone`, `:898-945`)
- `x = dateToX(date) + anchor` (`:909`), `anchor` afhankelijk van START/FINISH/uur. Een
  mijlpaal op een niet-werkdag → naad-x + anchor. Bij START-mijlpaal op maandag = linkerrand
  Ma-kolom = naad → coherent. Bij FINISH-mijlpaal op vrijdag = `x(Vr)+zoom` = naad → coherent.
  De ambiguïteit uit §2.4 geldt (mijlpaal-op-za ≡ taak-start-op-ma op dezelfde naad).

### 4.6 Baselines, balken, summary/hammock, pijlen, constraint-pins, ghosts
- Allemaal via `this.dateToX` → werken automatisch mee zodra `dateToX` door `axis` gaat.
- **Balkbreedte dag-taak** `[x(start), x(end)+zoom]`: `end` op een werkdag → correcte
  kolombreedte; het `+zoom` sluit de eind-kolom af. Exact het user-doel (5 werkdagen = 5
  kolommen) — géén aparte logica nodig.
- **Pijlen** (`:1145-1170`) gebruiken `dateToX(predEnd)+zoom` en `dateToX(succStart)`; bij
  compressie klopt de geometrie automatisch (een pijl over een weekend heen wordt kort).

### 4.7 Groepsbanden (summary/hammock)
- De brief stelt: «volle breedte, niet via dateToX». Laten staan — een groepsband die het hele
  chart overbrugt hoeft niet te comprimeren. Als een summary-volledig-binnen-een-daterange
  via dateToX gaat, werkt het mee; anders ongemoeid laten. **Open vraag §7** of
  summary-banden de compressie moeten volgen.

---

## 5. Interactie — allemaal via de laag

### 5.1 Drag-snapping (`useBarDrag.ts:82,140`)
- **Dag-modus:** `daysDelta = round(pixelDelta/zoom)` → vervangen door
  `workDayDelta = round(pixelDelta/zoom)` → `addWorkDays(origStart, workDayDelta)` i.p.v.
  `addCalendarDays`. Sleep-beweeging snapt op werkdag-grid. (De `axis.daySpan`/`xToDate`
  dekt dit; liever `axis.xToDate` gebruiken voor de nieuwe start en de duur ongewijzigd
  laten — dan blijft «5 werkdagen» 5 werkdagen na een sleep.)
- **Uur-modus (`:82`):** lineair `rawMs=(pixelDelta/zoom)*86400000` blijft geldig *binnen*
  een werkdag-kolom (1 kolom = 24 uur = `zoom` px in beide modi, §6). Bij een sleep die een
  naad overschrijdt: de ms-afstand «liegt» over de verborgen tijd — acceptabel voor v1,
  documenteer (§7).

### 5.2 Cursor-verankerd zoomen (`useGanttZoom.ts:38-42`)
- Vandaag: `daysUnderCursor = localX/zoom`; bewaar die dag onder de cursor na `setZoom`.
- Bij compressie: werk met **as-index** i.p.v. kalenderdag. Vervang door
  `idxUnderCursor = axis.dayIndexOf(axis.xToDate(localX))` (of direct
  `localX/zoom`-equivalent op de werkdag-as), en herstel `scrollX` zodat die index onder de
  cursor blijft. De `GanttCanvas.tsx:585-586` split-view-variant krijgt dezelfde behandeling.

### 5.3 `totalContentWidth` (`GanttCanvas.tsx:312-324`)
- Vandaag: `maxDays = max(diffDays(viewStart, end))` over taken → `(maxDays·1.2)·zoom`.
- Bij compressie: `maxDays` wordt `axis.daySpan(viewStart, maxTaskFinish)`.
  `Math.max(2000, …)`-floor blijft. Dit bepaalt scrollbar/virtuele breedte — moet
  werkdag-eenheden tellen, anders is de balk te breed (kalenderdagen) of te smal.

### 5.4 Hit-testing
- Alle hit-tests (welke kolom/dag onder de cursor, welk balk-uiteinde bij resize) rekenen
  `pixel → date` → gaan via `axis.xToDate`. Wie vandaag `/ zoom` deelt moet door `axis`.
  (Concrete hit-test-call-sites zitten in `GanttCanvas`/`useBarDrag`; identificeer ze in
  Fase 3 via `grep -nE "scrollX|/ zoom|/ *zoom" src/components/canvas/`.)

### 5.5 MiniMap viewport-kader + `ganttViewport.ts`
- **MiniMap-strip** (`MiniMapRenderer.ts:59-68`): blijft op kalender-as (andere
  transformatie; bewust gescheiden, zie `timeAxis.ts:6-8`-commentaar). Fase 1 scope.
- **Viewport-kader** (`MiniMapRenderer.ts:97-99`, `MiniMap.tsx:79,95,100`): `leftDay =
  scrollX/zoom`, `visibleDays = chartWidth/zoom`. Bij compressie moet dit de **as-eenheid**
  kennen: `leftIdx = axis.dayIndexOf(viewStart) + scrollX/zoom`,
  `visibleIdx = chartWidth/zoom`. → **Introduceer één gedeelde helper** (bv. in
  `src/utils/ganttViewport.ts` of een nieuw `src/engine/renderer/axis/viewportMath.ts`)
  die «scrollX/zoom ↔ as-index» vertaalt, gebruikt door MiniMap-renderer, `MiniMap.tsx` én
  `GanttRenderer`-grid. Dit doodt de verspreide `/ zoom`-delingen die agent B signaleerde.
- **`computeFitToProject` (`ganttViewport.ts:34-56`):** `span = diffCalendarDays+1` →
  `axis.daySpan(minStart, maxFinish)`. Zo past het project edge-to-edge in *werkdag*-eenheden.
- **`computeScrollToDate` (`:80-95`) + scroll-bounds (`:118-131`):** `days`-tellling →
  `axis.dayIndexOf`-verschil; `ORIGIN_PADDING_DAYS=14` wordt «14 getoonde eenheden»
  (semantiekkeuze: behoud 14 als getal, of maak het modus-bewust — open vraag §7, default:
  behoud 14 als *getoonde* eenheden = consistent met fit).

### 5.6 DropTarget (coördinatiepunt, niet zelf wijzigen)
- `src/engine/view/dropTarget.ts` **bestaat nog niet** — de parallelle sessie maakt het aan.
- De drop-landing (op welke datum een gesleepte taak neerkomt) moet bij compressie op een
  **werkdag** landen, niet op een naad. → **Afstemming:** vraag de parallelle sessie om de
  doel-datum via `axis.xToDate` + `nextWorkDay` te normaliseren, of laat de drop-target de
  ruwe datum teruggeven en normaliseer in `useBarDrag`. *Wij schrijven dropTarget.ts niet;
  we leggen deze afspraak vast in een korte notitie aan die sessie* (open vraag §7 heeft het
  concrete coördinatie-item).

---

## 6. Urenplanning — combineren TOEGESTAAN (niet uitsluiten)

**Vraag uit de brief:** mag de toggle gecombineerd met `enableHourPlanning`, of in v1
wederzijds uitsluiten?

**Advies: combineren toestaan.** Motivatie:
1. **Compressie is dag-niveau; uren leven binnen een werkdag.** Een uur-taak `do 09:00–11:00`
   staat nog steeds in de donderdag-kolom; er verandert niets binnen de dag. De
   sub-dag-interpolatie (§2.3) bewaart de uur-precisie.
2. **De lineaire uur-wiskunde blijft geldig binnen een kolom:** `zoom` = px per
   *getoonde dag-eenheid* = 24 uur in beide modi. `rawMs=(pixelDelta/zoom)*86400000`
   (`useBarDrag.ts:82`) klopt dus voor bewegingen binnen één werkdag en voor sprongen die
   hele werkdagen bedragen.
3. **Gebruikers die urenplanten, willen juist de niet-werkdagen weggecomprimeerd zien**
   (minder lege ruimte, compactere planning). Uitsluiten zou nut wegnemen.

**Randgeval (documenteren, niet blokkeren):** een uur-taak die een naad *overspant*
(bv. `vr 22:00 → ma 02:00`) tekent bij compressie «over de naad heen» en liegt over de
verborgen tijd. Zeldzaam (uren-taken overspannen normaal geen weekend) en inherent aan
compressie; oplossen door de taak in werkdag-segmenten te tekenen (al aanwezig:
`workIntervalsBetween`/`shouldSplit`, `:226-228`) zou het netjes dekken — **open vraag §7**
of dat voor v1 meegaat.

**Fallback-advies voor de bouwer:** mocht de sub-dag-interpolatie (§2.3) in de praktijk te
fragiel blijken, dan is «wederzijds uitsluiten» een aanvaardbare v1-simplificatie (toggle
uit-forceren zodra `enableHourPlanning` aan, met een tooltip). Maar dat is de tweede keus;
het primair ontwerp staat combineren toe.

---

## 7. De instelling zelf

### 7.1 Naam + veld
- **Naam (intern):** `compressNonWorkdays: boolean` (kort, beschrijvend; «tonen» is de
  inverse-toggle — UI-label mag «alleen werkbare dagen tonen» zijn).
- **UI-label/i18n-key:** `settings.compressNonWorkdays` / `.compressNonWorkdaysHint`,
  toe te voegen in **alle 14 talen × relevante namespaces** (`common`/`menu`), Nederlands
  als canonieke bron (werktaal), via `t(...)`.

### 7.2 Waar in de stack (volgt `barSplitMode` exact)
1. **`src/types/view.ts`** of **`src/state/slices/types.ts`**: velddeclaraties
   (`compressNonWorkdays: boolean` in **UIState**, zie §7.4).
2. **`src/state/slices/uiSlice.ts:79`**-regio: default `compressNonWorkdays: false`.
3. **`src/utils/settingsRegistry.ts`** (~`:153`): één regel
   `setting({ key: 'compressNonWorkdays', field: 'compressNonWorkdays', parse: parseBoolean })`.
4. **`src/utils/settingsStore.ts`** (~`:229`): `saveCompressNonWorkdays(v)` →
   `setSetting('compressNonWorkdays', v)` → `localStorage 'ops-compressNonWorkdays'`.
5. **`src/components/settings/SettingsPanelContent.tsx`** (~`:191`-patroon): één
   checkbox-rij + hint. Dat component deelt zich over alle 3 de plekken (⚙, ribbontab,
   Backstage) — één edit = drie plekken gedekt (de «3 surfaces»-conventie).
6. **Bedrading in `GanttCanvas.tsx`:** lees `s.ui.compressNonWorkdays` (naast
   `s.ui.barSplitMode` `:77`), geef door in renderer-opts (`:493,543`) + deps-array.

### 7.3 Globaal (UIState) vs per-document (ViewState) — **globaal, met motivatie**
De brief vraagt dit expliciet te motiveren. Feiten: `ViewState` (per-document, meegeswapt
bij `switchDocument`) bevat `scrollX/scrollY/zoom/timeScale/viewDate` — dingen die per
project verschillen (je scrollt/zoomt anders per document). `UIState` (globaal) bevat
`barSplitMode/enableHourPlanning/enableQuarterHourZoom/showMiniMap/durationDisplay` —
weergave-*voorkeuren*.

**Keuze: globaal (UIState).** Motivatie:
- **Precedent:** «as-vorm»-achtige toggles (`barSplitMode`, `enableHourPlanning`) zijn
  allemaal globaal. Een uitzondering introduceren schept inconsistentie.
- **Semantiek:** «ik wil altijd niet-werkdagen weggecomprimeerd zien» is een persoonlijke
  voorkeur, geen project-specifieke view-toestand. Een user die het aan zet, wil het
  consistent over álle documenten.
- **Coherentie met zoom:** hoewel `zoom` per-document is, blijft de *absolute* zoom-waarde
  gelijk; alleen de *eenheid* (px/kalenderdag vs px/werkdag) verandert met de toggle. De
  `WorkdayAxis` vertaalt consistent, dus geen conflict met per-document zoom/scroll.

**Subtiel neveneffect om te documenteren:** bij `switchDocument` krijgt het nieuwe document
zijn eigen `zoom/scrollX`, maar de toggle is globaal → de «eenheid» van die zoom verandert
mee. Dat is geen bug (de as is consistent), maar de gebruiker ziet eventueel een andere
 «efficiëntie» van dezelfde zoom-waarde. Acceptabel.

### 7.4 Interactie met MiniMap-kader-berekening
Zie §5.5: het viewport-kader moet de as-eenheid kennen. **De instelling moet dus niet
alleen naar de renderer, maar ook naar de MiniMap-renderer + `MiniMap.tsx` +
`ganttViewport.ts`.** Concreet: dezelfde `axis`-instantie (of een daarvan afgeleide
as-eenheid-helper) doorgeven aan die call-sites. Als de toggle verandert, herbouwen ze hun
axis. Dit is de reden dat §5.5 om één gedeelde helper vraagt.

---

## 8. Fasering (4 apart bouwbare + verifieerbare stappen)

Elke fase: eigen commit, eigen poort, laat het werkend achter.

### Fase 0 — Consolidatie (gedragsneutraal)
- **Bestanden:** `timeAxis.ts` (+`xToDate`+`GanttAxis`-iface); `printPreview.ts:318`;
  `GanttCanvas.tsx:706-707,585-586`; `useBarDrag.ts:82,140`; `useGanttZoom.ts:38-42`;
  `GanttRenderer.ts:260`; nieuw `tests/.../axisConsolidation.test.ts`.
- **Poort:** headless ctx-recorder-snapshot = lege diff vóór/na; `tsc` groen;
  `tests/planning/run.sh` exit 0; **visueel identiek** aan main (screenshot-diff leeg).
- **Toggle:** bestaat nog niet.

### Fase 1 — WorkdayAxis + as-abstractie (toggle uit = no-op, headless)
- **Bestanden:** nieuw `src/engine/renderer/axis/WorkdayAxis.ts`,
  `src/engine/renderer/axis/CalendarAxis.ts`, iface in `timeAxis.ts`;
  `GanttRenderer.ts` (`dateToX` → `this.axis.dateToX`, axis in constructor naast
  `projectEngine`); nieuw `tests/.../workdayAxis.test.ts`.
- **Inhoud:** `buildWorkdayAxis` (prefix-som + venster + fallback), `CalendarAxis`
  (lineair), sub-dag-interpolatie, `kleef-rechts`-semantiek.
- **Poort:** unit-tests `WorkdayAxis` (5 werkdagen over weekend+feestdag = 5 kolommen;
  niet-werkdag → naad-x; out-of-range → fallback); renderer met `CalendarAxis` =
  byte-identiek aan Fase 0 (recorder-snapshot).
- **Toggle:** bestaat nog niet; renderer hardcodeert `CalendarAxis`.

### Fase 2 — Instelling + bedrading (toggle doet de as-mapping; header nog ruw)
- **Bestanden:** `types/view.ts`/`slices/types.ts`; `uiSlice.ts`; `settingsRegistry.ts`;
  `settingsStore.ts`; `SettingsPanelContent.tsx`; `GanttCanvas.tsx`; `GanttRenderer.ts`
  (kies `CalendarAxis` vs `WorkdayAxis` op `opts.compressNonWorkdays`); i18n (14 talen).
- **Coördinatie:** `src/state/` wordt ook door de parallelle sessie bewerkt →
  **merge-volgorde afstemmen** of het veld in een niet-betwist sub-bestand zetten. Open
  item, niet blokkerend voor Fase 1.
- **Poort:** toggle UIT → byte-identiek aan main; toggle AAN → balken/grid/π comprimeren
  zichtbaar (screenshot). **Bekende limiet:** header toont nog dubbele dag-labels (Fase 3),
  interactie slaat nog op kalenderdagen. Expliciet als «half af» markeren in de PR.
- **Visueel bewijsmateriaal:** vóór/na-screenshot bij toggle; `window.__OPS__`-store-check
  (`ui.compressNonWorkdays` true/false round-tript via reload).

### Fase 3 — Header + grid + naad + interactie + MiniMap + randgevallen
- **Bestanden:** `GanttRenderer.ts` (`drawGridBackground`, `drawHolidayLabels`→naad-marker,
  `drawTierLabels` workday-step, `drawTodayLine`/status/mijlpaal op naad);
  `useBarDrag.ts` (workDay-snap); `useGanttZoom.ts` + `GanttCanvas.tsx:585`
  (cursor-anker op as-index); `GanttCanvas.tsx` (`totalContentWidth` + hit-tests);
  `MiniMapRenderer.ts:97-99` + `MiniMap.tsx:79,95,100`; `ganttViewport.ts` (fit/scroll/
  bounds); nieuw `src/engine/renderer/axis/viewportMath.ts` (gedeelde as-eenheid-helper);
  dropTarget-coördinatie (§5.6, niet zelf editen).
- **Poort:** volledige visuele suite (mijlpaal-op-feestdag, taak-over-weekend = 5 kolommen,
  vandaag-in-weekend, cursor-zoom behoudt werkdag, drag snapt op werkdag, MiniMap-kader
  klopt, fit-to-project past in werkdagen); `tsc` groen; `tests/planning` exit 0;
  hyperkritische review vóór merge.

> Waarom 4 en niet 3: Fase 1 (axis headless) loskoppelen van Fase 2 (instelling) houdt de
> byte-identiteit-poort schoon — Fase 1 bewijst «geen gedragsverandering» zonder dat er al
> een toggle in de UI zit die een reviewer kan verwarren. Fase 2 mag dan «half af» in de
> PR staan zonder Fase 3 te blokkeren.

---

## 9. Randgevallen + open productvragen

### Harde randgevallen (gedocumenteerde semantiek)
1. **Mijlpaal/constraint op een niet-werkdag** → naad-x (§2.4); ambigu met taak-start op de
   volgende werkdag. Markeer in de naad (§4.3).
2. **Vandaag-/statuslijn in het weekend/op feestdag** → naad-x; eventueel dimmen/breedte
   verhogen zodat hij niet in de naad-lijn opgaat.
3. **`viewStart` zelf op een niet-werkdag** → `dayIndexOf(viewStart)` kleef-rechts; de
   origin verschuift naar de volgende werkdag-grens. Documenteer; overweeg bij openen een
   `viewStart` op een niet-werkdag automatisch naar `nextWorkDay` te duwen (open vraag).
4. **Lege werkweek / kalender zonder werkdagen** → `WorkdayAxis` degeneren: alle dagen zijn
   «naad», de as stort in. Vang af met `CalendarEngine.hasWorkingDays()` (`:95`): toggle
   uitzetten (force `CalendarAxis`) + console-warn. Geen vastloper.
5. **Out-of-range datum** (ver buiten venster) → fallback-arithmetiek + clamp (§2.2).

### Open productvragen (beslissen vóór/in Fase 3)
- **Q1 — Naad-marker default aan/uit en hoe prominent?** Lijnen bij elke weekend-overgang
  kunnen druk worden bij week-zoom. Voorstel: lijn subtiel (1 px, dim); alleen badge bij
  ≥2-daagse feestdagblokken. Bevestig met user-screenshot.
- **Q2 — Vandaag-lijn in weekend dimmen?** Zie randgeval 2.
- **Q3 — `viewStart` op niet-werkdag auto-corrigeren?** Zie randgeval 3.
- **Q4 — Summary/groepsbanden comprimeren mee?** (§4.7.) Voorstel: ja, via dateToX waar ze
  het al gebruiken; volle-breedte-banden ongemoeid.
- **Q5 — `ORIGIN_PADDING_DAYS` modus-bewust maken?** (§5.5.) Voorstel: behoud 14 als
  *getoonde* eenheden (consistent met fit); bevestig.
- **Q6 — Uur-taak over een naad in segmenten tekenen?** (§6.) Voorstel: v1 niet, documenteren;
  v2 via `workIntervalsBetween`.
- **Q7 — dropTarget-coördinatie:** concreet item voor de parallelle sessie: «normaliseer de
  drop-doeldatum op een werkdag via `axis`+`nextWorkDay`, OF geef ruwe datum terug en laat
  `useBarDrag` normaliseren». Vastleggen vóór Fase 3.
- **Q8 — Toggle × `enableHourPlanning` uitsluiten als fallback?** (§6.) Primair: toestaan;
  fallback alleen als sub-dag-interpolatie fragiel blijkt.

### Niet-gedaan (bewust)
- MiniMap-strip en Print blijven op kalender-as in alle fases (andere transformatie). Een
  apart vervolg-ticket kan die later aansluiten als de as-eenheid-helper (§5.5) er eenmaal is.
