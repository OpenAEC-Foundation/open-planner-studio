# Prestatie- & modulariteitsaudit — Open Planner Studio

*Datum: 2026-07-20 · Basis: `7fe4fdf` (v2026.7.11 + benchmark-tool, pakket S) · Worktree
`keen-khayyam-019013`, branch `claude/planner-perf-modularity-audit-3882e5`*

## Aanpak

Zes parallelle deel-audits (scheduler, renderer/Gantt-interactie, IFC-I/O, state/React,
bundle/opstartpad, modulariteits-restpunten), elk strikt read-only en elk met **eigen
metingen** — headless esbuild-bundels tegen de échte store/engine (het `tests/planning/`-patroon),
CPU-profielen via `node --cpu-prof`, een opnemende canvas-ctx-stub voor de renderer, en een
productie-`vite build` met sourcemap-attributie voor de bundle. De deterministische generator
`generateBenchmarkProject(size)` uit de ingebouwde benchmark-tool (pakket S) is de gedeelde
databron, zodat alle cijfers onderling vergelijkbaar zijn en later reproduceerbaar blijven.

**Meethygiëne.** De machine draaide tijdens de audit parallel werk (`nproc`=16). Absolute
milliseconden zijn daarom **indicatief**; de *relatieve attributie* (welk deel van het werk waar
zit) is machine-load-onafhankelijk en is het eigenlijke product. Waar een claim niet zelf gemeten
kon worden, staat dat expliciet als UNVERIFIED in de deelrapporten.

**Poorten bij vertrek gecontroleerd:** `tsc --noEmit` exit 0 en `bash tests/planning/run.sh`
**exit 0** (395/395 cases + alle check-batterijen).

---

## Hoofdconclusie

**Eén oorzaak domineert alles: de datum-/kalenderlaag van de CPM-solver.** Twee onafhankelijke
deel-audits (scheduler en IFC) wijzen dezelfde dader aan. Bij het openen van een groot bestand is
`readIFC` 134 ms en `runCPM` **9.350 ms** — 98,6% van de wachttijd. Binnen `solve()` is ~90% van
de tijd één keten:

```
computeScheduleResults → signedFloat → signedWorkDays → workDaysBetween → isWorkDay → formatDate
```

`workDaysBetween` telt **dag voor dag** over de speling-spanne van elke taak, en `isWorkDay`
alloceert per gescande dag een string (`toISOString().split('T')[0]`). Bij ~900 taken × 2 calls ×
~700 dagen zijn dat ~1,26 miljoen string-allocaties per solve — 60,6% self-tijd in één functie.
Omdat de speling-spanne meegroeit met de projecthorizon is dit effectief **O(n²)**: 1000→2500
taken is 15,9× duurder voor 2,5× het werk.

Dit verklaart meteen de tegenstrijdige historische metingen (1000 taken ⇒ ~300 ms in de benchmark
vs. 2000 taken ⇒ 40-80 ms in een oudere meting): de kost is niet evenredig met het aantal taken of
relaties, maar met **Σ speling-spanne in kalenderdagen**. Een strak gepland project scant nauwelijks;
het benchmarkproject heeft een lange horizon met veel speling en scant honderden dagen per taak.
De forward/backward-pass en de complete relatie-wiskunde zijn samen **<7%** van solve.

**Tweede rode draad: undo-snapshots op de Immer-draft.** Elke muterende actie roept
`createSnapshot` aan mét de draft (binnen de producer), waardoor de JSON-deepclone de volledige
draft traverseert en Immer élk object proxy't. Dezelfde kloon op plain state kost 19 ms, op de
draft **145 ms** (7,6×). Dat maakt één toetsaanslag op 5000 taken ~226 ms en één sleepstap ~39 ms.

**Derde: er wordt structureel te veel gedaan dat niemand ziet.** De pijlenlaag in de Gantt tekent
álle relaties zonder verticale culling (84-96% van een render); de auto-save serialiseert élk open
document ook als er maar één gewijzigd is; de bundel bevat alle 14 talen terwijl er één actief is
(~190 kB gzip dood gewicht) en laadt alle 19 dialogs eager.

**Wat WEL gezond is** (niet verbouwen): IFC-I/O schaalt lineair, geen O(n²), round-trip klopt op
alle groottes en de writer buffert al optimaal. De React-selectors zijn voorbeeldig atomisch — nul
object-bouwende of afgeleide selectors, `useShallow` nergens nodig. `setScroll`, `selectTask` en
`switchDocument` zijn praktisch gratis. Balken/tabel/tijdas in de renderer zijn correct
window-gecullied (0,4 ms bij 5000 taken). Immer's autoFreeze kost slechts 4%.

---

## Nulmeting (referentiecijfers)

### Headless (Node, 16 cores onder parallelle load — indicatief)

| Grootte | `solve()` | store `runCPM()` | `updateTask` | `addTask` | render (ctx-stub) | IFC write | IFC read |
|--------:|----------:|-----------------:|-------------:|----------:|------------------:|----------:|---------:|
| 1000 | 339 ms | 1.555 ms | 46,8 ms | 782 ms | 2,52 ms | 10,6 ms | 28,1 ms |
| 2500 | 5.393 ms | 21.354 ms | — | — | — | 27,6 ms | 52,2 ms |
| 5000 | ~9.952 ms | ~40-60 s (extrapolatie) | 226,6 ms | **16.248 ms** | 15,58 ms | 46,3 ms | 106,4 ms |

Geheugen: 50 bewerkingen op 5000 taken laten de heap groeien van 10,4 MB naar **258 MB**
(4,95 MB per snapshot, geen cap, geen structural sharing).

### In-app benchmark (browser, gedeeltelijk — machine was belast)

| Grootte | genereren | CPM-kern | IFC write | IFC read | render | IFC-grootte |
|--------:|----------:|---------:|----------:|---------:|-------:|------------:|
| 500 | 3,0 ms | 270,4 ms | 8,3 ms | 15,5 ms | 1,7 ms | 324 KB |
| 1000 | 7,2 ms | 298,4 ms | 17,7 ms | 32,9 ms | 2,9 ms | 643 KB |

De 1000-taken-CPM-waarde (298 ms) bevestigt zowel de historische referentie (~280-355 ms) als de
headless meting (339 ms) — de kalibratie klopt. **Openstaand:** 2500/5000 in de browser en de
opstart-/FCP-meting op de productiebundel moeten op een rustige machine herhaald worden (zie
"Openstaande nulmetingen").

### Bundel (hard gemeten, productie-`vite build`)

| Asset | Rol | Raw | Gzip |
|---|---|---:|---:|
| `index-*.js` | alle app-code | 654.102 | 177.613 |
| `locales-*.js` | 14 talen × 4 namespaces | 562.713 | **203.098** |
| `react-vendor-*.js` | react-dom (94%) + react | 192.570 | 60.266 |
| `i18n-vendor-*.js` | i18next + react-i18next | 48.686 | 15.963 |
| `icons-vendor-*.js` | lucide-react | 22.701 | 7.622 |
| `state-vendor-*.js` | zustand + immer | 13.071 | 5.026 |
| `index-*.css` | Tailwind + 49 @font-face | 114.466 | 31.855 |
| **Totaal eager first-load** | | **1.608.309** | **≈ 501.443** |

Fonts (92 bestanden, 1,29 MB) staan hier buiten: allemaal self-hosted met `font-display: swap`,
niet gepreload → **blokkeren de first paint niet**. De updater blokkeert evenmin (`isTauri()`-bail +
dynamische import). Nul `React.lazy` in de hele codebase.

---

## Werkpakketten — gerangschikt

Score = (Impact + Risico-verlaging) × urgentie, maar in de praktijk gerangschikt op
**gemeten winst ÷ risico**. "Poort" = het bewijs dat het pakket mag landen.

### Spoor 1 — Prestaties

| # | Pakket | Gemeten winst | Risico | Moeite | Poort / bewijs |
|---|--------|---------------|--------|--------|----------------|
| **A1** | **Allocatievrije `isWorkDay`** — `holidaySet` als `Set<number>` (UTC-dagindex) + weekdag-mask i.p.v. `formatDate`-string + `workDays.includes` | micro-bench **3,6×**; solve 1000 339 → ~110-140 ms | **Laag** — zelfde lidmaatschapstest, andere sleutelrepresentatie; 0/3000 mismatches in de micro-bench | S | suite exit 0 + solve-mediaan vóór/ná |
| **A2** | **Arithmetische `workDaysBetween`** — O(1) weekberekening + binary-search over feestdagen i.p.v. dag-voor-dag-lus | micro-bench **~750×**; solve 2500 5,4 s → **<0,3 s**, 5000 ~10 s → **<0,5 s** | **Middel** — de `MAX_DAYS`-cap voor sentinel-datums moet exact gerepliceerd; enige echte risicopunt | M | suite exit 0 + tijdelijke assert `arith == scan` over alle case-datums + solve-mediaan 2500/5000 |
| **A3** | **Solve buiten de Immer-`produce`** — solver op plain `get()`-state, alleen resultaten binnen `set()` schrijven | Immer-proxy-primitieven ≈34% van runCPM → schil −30-40% | Laag — solve muteert niets, is puur | S/M | suite + document-contract-check + runCPM-mediaan |
| **A4** | **`updateSummary` met een `Map`** — `s.tasks.find` in een recursieve rollup is O(n²) | verwijdert 21% inclusive uit runCPM | Laag — zelfde rollup-volgorde en -waarden | S | idem A3 |
| **B1** | **Undo-snapshot op plain state** (`beginUndoable` splitsen: `createSnapshot(get())` buiten `set`, push binnen) | `updateTask`-set 171 → 45 ms bij 5000 (**3,8×**); raakt alle ~54 muterende acties | Middel — guard-ordening moet blijven (geen snapshot bij no-op); elke callsite nalopen | M | suite + document-contract-check + actie-medianen 1k/5k |
| **B2** | **O(n²) WBS-nummering** — `flattenOrder` (`utils/wbs.ts:10-29`) scant per taak de hele lijst; draait bij elke add/delete óp de draft | `addTask` 16,2 s en `deleteTask` 7,3 s bij 5000 → richting tientallen ms (samen met B1) | Laag/Middel — WBS-volgorde moet byte-identiek blijven (dotted codes koppelen aan export/CSV/MSP) | M | IFC-round-trip + suite + actie-medianen |
| **B3** | **Undo-stack cappen + copy-on-write snapshot** — nu 4,95 MB per snapshot, onbegrensd, en een taak-edit kloont ook 5850 relaties + 2819 toewijzingen | 50 bewerkingen 248 MB → een fractie; snapshot-tijd fors omlaag | Middel — "geraakte collecties" per actie moeten kloppen; `DOCUMENT_FIELDS`-rollen blijven leidend | cap S / COW L | document-contract-check + geheugenmeting vóór/ná |
| **C1** | **Dependency-pijlen cullen + parse-cache** — `drawDependencyArrows` itereert álle sequences zonder verticale cull, met `parseDate`×2 per pijl per frame | render 11,6 → **~1-2 ms** bij 5000; scroll/zoom/selectie profiteren 1-op-1 | Laag — maar een pijl die tussen twee offscreen rijen door het venster kruist mag niet verdwijnen | M | **ctx-call-log-diff**: de getekende pijlset moet identiek zijn over een raster van scroll-posities |
| **C2** | **Sleep-hotpath ontlasten** — één undo-snapshot per sleep i.p.v. per mousemove, `recomputeViewRows` bij mouseup | sleepstap 39 → ~12 ms, met C1 richting **~2-3 ms** | Middel — undo-granulariteit moet identiek blijven (één sleep = één stap) | M | gerichte test "N mousemoves → 1 undo-stap → undo herstelt begintoestand" + Playwright-sleep in de echte app |
| **C3** | **Canvas-realloc + renderer-hergebruik** — `canvas.width` wordt elke paint gereset (backing-store-realloc) en er wordt elk frame een nieuwe `GanttRenderer` gebouwd | constructie 0,60 ms/frame bij 5000 + realloc (UNVERIFIED in ms) | Laag | S/M | ctx-call-log-diff + echte-app-frametijd |
| **D1** | **Auto-save schrijft alleen dirty documenten** — nu serialiseert elke tick élk open document | 5 tabs/1 dirty: **318 → 64 ms**; constant i.p.v. lineair in open tabs | Laag — niet-dirty snapshots veranderen niet | S | tick-kost vóór/ná + recovery-round-trip |
| **D2** | **Serialisatie naar een Web Worker** | 46-318 ms UI-blocking → 0 | Middel — reader-in-worker vereist de `loadConstructionMode`-vlag; writer-input is plain en cloneable | M | long-task-meting + sha256-gate (klok bevroren) |
| **E1** | **Locale lazy-load** — 14 talen eager terwijl er één actief is | first-load **501 → ~306 kB gzip** (−190 kB) | Middel — FOUC; mitigatie: `en`-fallback eager + actieve locale preloaden uit `localStorage` | M | bundle-bytes (hard) + FCP-meting vóór/ná |
| **E2** | **Paneel-/adapter-splitting** — Backstage, p6/msproject/csv/print, zeldzame dialogs, ReportPanel/IFCPanel/DebugTerminal lazy | −35…55 kB gzip | Laag/Middel — Suspense-flikker bij eerste opening van user-getriggerde overlays | M | bundle-bytes + smoke-test per lazy oppervlak |

### Spoor 2 — Modulariteit (restpunten)

| # | Punt | Prio | Opmerking |
|---|------|------|-----------|
| **M1** | IFCTASK/IFCTASKTIME-slot-descriptors + STEP-module | ~18-21 | Laatste grote "één-veld-erbij"-valkuil in de IFC-laag; slot-kennis staat op ≥3 plekken, alleen via commentaar gekoppeld. Round-trip-batterij is de poort. |
| **M2** | A7 TaskTime-split, **type-only** (`Pick<>`-varianten) | 15 | Bewust géén runtime-verandering ⇒ nul hotpath-impact, nul IFC-slot-impact. De runtime-variant (prio 8) wordt afgeraden. |
| **M3** | C7 runCPM-injectie + rollup-extractie | 15 | **Valt samen met A3/A4** — solver injecteerbaar maken is de voorwaarde voor een latere worker/WASM-verhuizing. Doen als onderdeel van het prestatiepakket. |
| **M4** | backward-FS uur/dag-symmetrie | 15 | Raakt `relationMath.ts`; suite-case `rr-fs-pred-startms` gaat bewust rood en de verwachting moet mee. |
| **M5** | P17 ThemePalette-injectie + P7 TimeAxis + print-kleurtabel | 12 | Vier oppervlakken met half-DOM/half-hardcoded kleuren; maakt de renderer eindelijk puur/headless-testbaar. |
| **M6** | Hygiëne-pakket: `remove*`-existentie-guards, UIState persisted/session-split (type-only), `fileAccess`-restjes | 10-20 (formeel) | Goedkoop, compiler-gedekt. De formele score overdrijft het nut: de settings-registry heeft het echte risico uit de UIState-split al gehaald. |
| — | P13 platformFileService | **vervallen** | Achterhaald: de browser-bestandstoegang (v2026.7.11, `src/services/fileAccess/`) heeft de facade al gebouwd en `fileSlice` gebruikt hem. |

---

## Gefaseerd plan

Elk pakket volgt hetzelfde ritme: Opus-implementer → **onafhankelijke** Opus-reviewer die de
bewijzen zélf reproduceert → poorten (`tsc` exit 0 + suite **exit 0**, 395 cases + 113
contract-checks) → losse commit met uitvoerige NL-message → rebase op `origin/main` → poorten
opnieuw → push. Bij gedragsneutrale refactors geldt byte-identiek-bewijs oud-vs-nieuw
(`git archive HEAD` + eigen esbuild-alias); bij prestatiewerk de vóór/ná-meting met getallen.

### Fase 1 — De kalender-hotspot (grootste winst, laagste risico)
**A1 → A2 → A3 → A4.** Dit is de kern: samen brengen ze `runCPM` bij 2500 taken van 21 seconden
naar naar verwachting onder de seconde, en ze maken de groei weer lineair. A1 en A2 zijn al
micro-bewezen byte-identiek (0/3000 mismatches). **M3 (C7) landt mee in A3** — de solver wordt
daar tóch uit de Immer-producer getild, dus injecteerbaarheid is dan bijna gratis.

### Fase 2 — De sleep- en bewerk-hotpath
**B1 → B2 → C1 → C2 → C3.** B1 raakt ~54 acties maar is mechanisch; B2 haalt de 16-secondenpiek
bij `addTask` weg. C1 is de grootste rendervangst en verifieerbaar met een ctx-call-log-diff. C2
bouwt op B1 voort. **Verificatie op de echte desktop-app is hier verplicht** (jij test handmatig
met `npm run tauri:dev`) — de ctx-stub meet JS-werk, geen GPU-rasterisatie.

### Fase 3 — I/O en opstart
**D1 → E1 → E2 → D2.** D1 is de goedkoopste echte winst van de hele audit. E1 halveert bijna de
first-load-bundel. D2 (worker) als laatste, want het is de enige met echte architectuurimpact.

### Fase 4 — Modulariteit
**M1 (IFC-slots + STEP) → M5 (ThemePalette + TimeAxis) → M2 (TaskTime type-only) → M4
(backward-FS) → M6 (hygiëne).** M4 hoort in dezelfde golf als eventueel later solver-werk, want
het raakt `relationMath.ts`. M2 en M5 zijn bewust orthogonaal aan het prestatiespoor gehouden.

### Wat bewust NIET gedaan wordt
- **Reactief herrekenen** (CPM automatisch bij elke edit) — botst met het bewuste "manual, not
  reactive"-ontwerp en met byte-identiteit.
- **Compute naar Rust/WASM** — A1+A2 halen het in pure TypeScript; de projectregel is "Rust dun".
- **Relatie-wiskunde micro-optimaliseren** — <7% van solve.
- **De writer of tokenizer herschrijven** — de writer buffert al optimaal; een custom STEP-scanner
  is veel risico (quoting, `''`-escapes, geneste haakjes) voor ~10% van de leestijd.
- **`structuredClone` i.p.v. JSON-deepclone** — gemeten 14 vs 12 ms; JSON is zelfs sneller.
- **autoFreeze uitzetten** — 4% winst, en het vangt mutatiebugs.
- **Selectors herstructureren / `useShallow`** — het atomische patroon is al correct.
- **React vervangen, fonts preloaden, OffscreenCanvas/WebGL** — hoog risico, geen onderbouwde winst.
- **`switchDocument`, balken/tabel/tijdas, `recomputeViewRows`** — gemeten goedkoop, laat staan.

---

## Openstaande nulmetingen (op een rustige machine te herhalen)

1. **In-app benchmark 2500 en 5000 taken** in de browser — de 500/1000-runs staan hierboven; de
   grotere maten zijn afgebroken omdat de machine belast was.
2. **Opstartmeting op de productiebundel**: `performance.getEntriesByType('navigation')`
   (`domContentLoadedEventEnd`) en `first-contentful-paint`, vóór en ná E1/E2. Een eerste poging
   gaf DCL 64 ms maar géén paint-entry (headless-artefact) — dit moet met een echte
   paint-observatie herhaald worden.
3. **Echte-canvas frametijd** tijdens slepen/scrollen bij 1000 en 5000 taken (Playwright +
   `window.__OPS__`, DOM/store-asserties — nooit canvas-pixels), als tegenwicht voor de
   ctx-stub-cijfers.

## Deelrapporten

De zes volledige deelrapporten met alle meettabellen, CPU-profiel-attributies, `file:regel`-bewijzen
en herbruikbare meetharnassen staan in de sessie-scratchpad onder `audit-scheduler/`,
`audit-renderer/`, `audit-ifc/`, `audit-state/`, `audit-bundle/` en `audit-modulariteit/`.
