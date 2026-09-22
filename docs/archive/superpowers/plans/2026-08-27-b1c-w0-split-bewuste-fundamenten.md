# B1c-W0 — Split-bewuste fundamenten: implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Motor, lastlezers en renderer laten dezelfde werkdagen zien voor taken met
werkonderbrekingen (`Task.splitGaps`) en eigen taakkalenders — de vier W0-items uit
`docs/superpowers/specs/2026-08-17-b1c-nivelleren-restcapaciteit-design.md` (§W0), elk ook
zonder B1c een reparatie van bestaand, aantoonbaar fout gedrag.

**Architecture:** Eén nieuwe gedeelde module `src/engine/scheduler/splitWalk.ts` bevat de
correcte as-wandeling (H1-as: een gat telt zichzelf mee voor de positie van het volgende gat)
en een dag-granulaire werkdagen-enumerator. De renderer (`splitBarGeometry.ts`), de lastlezer
(`ResourceLoad.ts`) en de nivelleerder-boekhouding (`ResourceLeveler.ts`) consumeren die ene
module. Richting van de import: renderer → scheduler (bestaat al); nooit andersom
(`npm run verify:cycles` bewaakt dat).

**Tech Stack:** TypeScript strict, geen frameworks; tests als `check-*.ts`-batterijen onder
`tests/planning/` (esbuild → Node, geregistreerd in `tests/planning/run.sh`), plus één
uitbreiding van `tests/library/check-occupancy.ts`. De poort is `npm run verify` — oordeel
UITSLUITEND op de exitcode, nooit op de tekst "alles groen".

**Context voor wie hier koud instapt:**
- `TaskSplitGap = { afterMinutes, gapMinutes }` (`src/types/task.ts`) — werkonderbrekingen,
  OFFSET-gebaseerd in werkminuten. LEES HET DOCBLOK van die interface vóór je begint. De as
  is cumulatief: `afterMinutes` van gat *n* incorporeert de gaten vóór *n* al ("H1-as",
  definitie in `src/engine/scheduler/duration.ts` bij `splitTotalSpanMinutes`, regel ~282:
  aspositie = `afterMinutes + gapMinutes`).
- De bug die dit plan o.a. fixt: `src/engine/renderer/splitBarGeometry.ts` regel 89 doet
  `prevAfter = gap.afterMinutes` (pre-H1-interpretatie) en telt daardoor bij ≥2 gaten het
  vorige gat dubbel. Gereproduceerd: taak van 3 werkdagen vanaf ma 2026-06-01 (dagkalender,
  8 uur/dag) met gaten `{afterMinutes:480, gapMinutes:480}` en `{afterMinutes:1440,
  gapMinutes:480}` hoort te werken op 06-01, 06-03 en 06-05; de huidige code tekent het
  tweede segment 2 dagen breed en het derde achterstevoren voorbij het taakeinde.
- `computeResourceLoad` (`src/engine/scheduler/ResourceLoad.ts`) verdeelt de belasting nu
  over `enumerateWorkDays(projectEngine, earlyStart, earlyFinish)` — projectkalender, gaten
  onbekend. De CPM rekent duur en gaten echter op de TAAKkalender (`CPMSolver.engineFor`).
  Gevolg vandaag: belasting op pauzedagen, en verschoven/verloren belasting bij een taak met
  eigen kalender.
- De nivelleerder (`src/engine/scheduler/ResourceLeveler.ts`) boekt met `bookDemandAt` de
  eerste `scheduleDuration` projectkalender-werkdagen vanaf de start (regel ~213) en meet de
  delay met `projEngine.workDaysBetween` (regel ~284), terwijl de CPM de delay toepast op de
  taakkalender (`shiftByLevelingDelay` via `engineFor(task)`, `CPMSolver.ts` ~regel 1373).

---

## Task 1: `splitWalk.ts` — de correcte as-wandeling als gedeelde module

**Files:**
- Create: `src/engine/scheduler/splitWalk.ts`
- Create: `tests/planning/check-split-walk.ts`
- Modify: `tests/planning/run.sh` (registratie nieuwe check)

- [ ] **Step 1: Schrijf de falende test**

Maak `tests/planning/check-split-walk.ts`. Kijk eerst naar een bestaande batterij
(bijv. `tests/planning/check-split-bar-render.ts`, kop en `ok`/`eq`-helpers) en neem exact
dezelfde helperstijl en exit-conventie over (teller van fouten, `process.exit(1)` bij rood,
faalregels beginnen met `XX `). Inhoud:

```ts
// check-split-walk.ts — H1-as-wandeling en dag-enumeratie van gesplitste taken (B1c-W0.4/W0.1).
// Reproduceert de dubbeltel-bug: pre-H1 gaf segmenten [06-01..06-02], [06-03..06-05],
// [06-08..06-05] voor het referentiegeval hieronder; correct is 06-01 / 06-03 / 06-05.
import { computeSplitSegments, enumerateTaskWorkDays, splitDayPattern } from '@/engine/scheduler/splitWalk';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { TaskSplitGap } from '@/types/task';
import { parseDate, formatDate } from '@/utils/dateUtils';

let failures = 0;
const ok = (msg: string, cond: boolean) => {
  if (cond) console.log(`   OK ${msg}`);
  else { failures++; console.log(`XX ${msg}`); }
};
const eq = (msg: string, actual: unknown, expected: unknown) =>
  ok(`${msg} (kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)})`,
     JSON.stringify(actual) === JSON.stringify(expected));

// Standaard dagkalender: ma-vr werkdag, 8 uur/dag. Gebruik dezelfde kalenderfabriek als de
// andere checks (zoek in check-split-bar-render.ts hoe die zijn WorkCalendar bouwt en
// hergebruik dat letterlijk).
const cal = /* zelfde default-dagkalender als check-split-bar-render.ts */;
const eng = new CalendarEngine(cal);

// ── Referentiegeval uit de review: 3 werkdagen, twee gaten van 1 dag op de correcte H1-as ──
const gaps: TaskSplitGap[] = [
  { afterMinutes: 480, gapMinutes: 480 },   // na dag 1: 1 dag pauze
  { afterMinutes: 1440, gapMinutes: 480 },  // aspositie 1440 = 480 werk + 480 gat + 480 werk
];

console.log('-- splitDayPattern --');
eq('patroon werk/gat-blokken', splitDayPattern(gaps, 480, 3),
   [{ work: 1, gap: 1 }, { work: 1, gap: 1 }, { work: 1, gap: 0 }]);
eq('zonder gaten: één blok', splitDayPattern(undefined, 480, 4), [{ work: 4, gap: 0 }]);

console.log('-- enumerateTaskWorkDays --');
eq('werkdagen slaan de gaten over', enumerateTaskWorkDays(gaps, eng, '2026-06-01', 3),
   ['2026-06-01', '2026-06-03', '2026-06-05']);
eq('zonder gaten: aaneengesloten werkdagen', enumerateTaskWorkDays(undefined, eng, '2026-06-01', 4),
   ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04']);
// Weekend-overspanning: 3 werkdagen + gat van 1 dag vanaf donderdag → do, (vr = gat), ma, di
eq('gat + weekend combineren correct',
   enumerateTaskWorkDays([{ afterMinutes: 480, gapMinutes: 480 }], eng, '2026-06-04', 3),
   ['2026-06-04', '2026-06-08', '2026-06-09']);

console.log('-- computeSplitSegments (H1-as) --');
const segs = computeSplitSegments(gaps, parseDate('2026-06-01'), parseDate('2026-06-05'), false, eng);
eq('drie segmenten', segs.length, 3);
eq('segment 1 start', formatDate(segs[0].start), '2026-06-01');
eq('segment 2 start (NIET 06-03..06-05 breed)', formatDate(segs[1].start), '2026-06-03');
eq('segment 2 einde (exclusief)', formatDate(segs[1].end), '2026-06-04');
eq('segment 3 start (NIET voorbij het taakeinde)', formatDate(segs[2].start), '2026-06-05');
eq('segment 3 einde = taakeinde', formatDate(segs[2].end), '2026-06-05');

if (failures > 0) { console.log(`${failures} checks rood`); process.exit(1); }
console.log('check-split-walk: alles groen');
```

Vul het kalender-commentaar in met de echte fabriek uit de bestaande check (kopieer, niet
verwijzen).

- [ ] **Step 2: Registreer de check en zie hem falen**

Zoek in `tests/planning/run.sh` de regel die `check-split-bar-render` draait en voeg direct
ernaast een identieke regel voor `check-split-walk` toe. Draai dan:

```bash
bash tests/planning/run.sh 2>&1 | tail -20; echo "exit: $?"
```

Verwacht: FAIL — de module `splitWalk.ts` bestaat nog niet (bundelfout), exitcode ≠ 0.

- [ ] **Step 3: Implementeer `splitWalk.ts`**

```ts
// splitWalk.ts — B1c-W0: de ENE bron voor "welke dagen werkt een gesplitste taak".
// De as-semantiek (H1): `TaskSplitGap.afterMinutes` ligt op MSP's cumulatieve
// elapsedWork-as — elk gat telt ZICHZELF mee voor de positie van het volgende gat. De
// aspositie ná gat n is dus `afterMinutes + gapMinutes`; wie `prevAfter = afterMinutes`
// bijhoudt (de pre-H1-lezing) telt het vorige gat dubbel. Zie het docblok van
// `TaskSplitGap` (types/task.ts) en `splitTotalSpanMinutes` (duration.ts).
// Consumenten: splitBarGeometry (renderer/print), ResourceLoad (histogram/bezetting),
// ResourceLeveler (boekhouding). Eén wandeling, drie lezers — dat is het hele punt.
import type { TaskSplitGap } from '@/types/task';
import type { CalendarEngine } from './CalendarEngine';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';

export interface SplitSegmentBounds {
  start: Date;
  end: Date;
}

/**
 * Segmentgrenzen voor een taak met splits. Gedrag en dag/uur-modus-conventies zijn
 * één-op-één overgenomen uit de oude implementatie in splitBarGeometry.ts (zie het
 * uitgebreide docblok DAAR — dat verhuist mee hierheen), met één correctie: de
 * as-accumulatie volgt de H1-definitie (`prevAxis = afterMinutes + gapMinutes`).
 */
export function computeSplitSegments(
  gaps: TaskSplitGap[] | undefined,
  taskStart: Date,
  taskEnd: Date,
  hourMode: boolean,
  eng: CalendarEngine,
): SplitSegmentBounds[] {
  if (!gaps || gaps.length === 0) return [{ start: taskStart, end: taskEnd }];
  const sorted = [...gaps].sort((a, b) => a.afterMinutes - b.afterMinutes);
  const minutesPerDay = Math.max(1, eng.hoursPerDay * 60);

  const walk = (from: Date, minutes: number): Date => {
    if (minutes <= 0) return from;
    if (hourMode) return eng.addWorkMinutes(from, minutes);
    const days = Math.round(minutes / minutesPerDay);
    return days > 0 ? eng.addWorkingDaysSigned(from, days) : from;
  };

  const segments: SplitSegmentBounds[] = [];
  let cursor = taskStart;
  let prevAxis = 0;
  for (const gap of sorted) {
    const gapStart = walk(cursor, gap.afterMinutes - prevAxis);
    segments.push({ start: cursor, end: gapStart });
    cursor = walk(gapStart, gap.gapMinutes);
    prevAxis = gap.afterMinutes + gap.gapMinutes; // H1: het gat telt zichzelf mee
  }
  segments.push({ start: cursor, end: taskEnd });
  return segments;
}

/**
 * Werk/gat-patroon in HELE WERKDAGEN (dag-modus), afgeleid van de gaten op de H1-as.
 * Afronding per blok: `Math.round(minuten / minutesPerDay)` — dezelfde conventie als de
 * dag-modus van computeSplitSegments. Werkblokken worden geklemd zodat de som van de
 * werkdagen nooit boven `durationDays` uitkomt; het slotblok vult aan tot exact
 * `durationDays`.
 */
export function splitDayPattern(
  gaps: TaskSplitGap[] | undefined,
  minutesPerDay: number,
  durationDays: number,
): Array<{ work: number; gap: number }> {
  if (durationDays <= 0) return [{ work: 0, gap: 0 }];
  if (!gaps || gaps.length === 0) return [{ work: durationDays, gap: 0 }];
  const sorted = [...gaps].sort((a, b) => a.afterMinutes - b.afterMinutes);
  const mpd = Math.max(1, minutesPerDay);
  const blocks: Array<{ work: number; gap: number }> = [];
  let prevAxis = 0;
  let used = 0;
  for (const g of sorted) {
    const work = Math.min(Math.max(0, Math.round((g.afterMinutes - prevAxis) / mpd)), durationDays - used);
    const gap = Math.max(0, Math.round(g.gapMinutes / mpd));
    blocks.push({ work, gap });
    used += work;
    prevAxis = g.afterMinutes + g.gapMinutes;
  }
  blocks.push({ work: Math.max(0, durationDays - used), gap: 0 });
  return blocks;
}

/**
 * De ISO-werkdagen waarop de taak ECHT werkt: vanaf `startIso`, `durationDays` werkdagen
 * volgens `engine`, waarbij gat-blokken (in werkdagen van dezelfde engine) worden
 * overgeslagen. Zonder gaten identiek aan "de eerste N werkdagen vanaf start".
 */
export function enumerateTaskWorkDays(
  gaps: TaskSplitGap[] | undefined,
  engine: CalendarEngine,
  startIso: string,
  durationDays: number,
): string[] {
  const blocks = splitDayPattern(gaps, engine.hoursPerDay * 60, durationDays);
  const isos: string[] = [];
  let current = parseDate(startIso);
  let guard = 0;
  const MAX_DAYS = 200_000; // zelfde veiligheidsgrens als CalendarEngine/enumerateWorkDays
  const consumeWorkDays = (n: number, collect: boolean) => {
    let taken = 0;
    while (taken < n && guard++ < MAX_DAYS) {
      if (engine.isWorkDay(current)) {
        if (collect) isos.push(formatDate(current));
        taken++;
      }
      current = addCalendarDays(current, 1);
    }
  };
  for (const b of blocks) {
    consumeWorkDays(b.work, true);
    consumeWorkDays(b.gap, false);
  }
  return isos;
}
```

Controleer of `CalendarEngine` een publieke `hoursPerDay` heeft (splitBarGeometry gebruikt
`eng.hoursPerDay` al — zo ja, klaar; zo nee, kijk hoe splitBarGeometry eraan komt en doe
hetzelfde).

- [ ] **Step 4: Draai de check en zie hem groen**

```bash
bash tests/planning/run.sh 2>&1 | tail -8; echo "exit: $?"
```

Verwacht: exit 0. (Let op: de andere checks draaien mee; alleen de exitcode telt.)

- [ ] **Step 5: Commit**

```bash
git add src/engine/scheduler/splitWalk.ts tests/planning/check-split-walk.ts tests/planning/run.sh
git commit -m "feat(scheduler): splitWalk — H1-as-wandeling en dag-enumeratie voor gesplitste taken (B1c-W0)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: renderer op de gedeelde wandeling (fixt de dubbeltel-bug)

**Files:**
- Modify: `src/engine/renderer/splitBarGeometry.ts` (wordt een dunne re-export)
- Modify: `tests/planning/check-split-bar-render.ts` (multi-gat-case die de bug zou zien)

- [ ] **Step 1: Schrijf de falende rendertest**

In `check-split-bar-render.ts`: de bestaande 2-gaten-case (regels ~143-151) gebruikt
`{afterMinutes:240,gapMinutes:480}` + `{afterMinutes:480,gapMinutes:480}` — op de H1-as
overlappen die (het tweede gat begint op aspositie 480, vóór het einde van het eerste op
720), dus die case maskeert de bug. Laat die case staan (hij bewaakt het samenvouwen) en
voeg een nieuwe case toe met niet-overlappende gaten die de **x-posities** toetst:

```ts
// ── Nieuw: 2 NIET-overlappende gaten ⇒ 3 segmenten met stijgende, disjuncte x-ranges ──
console.log('-- split-bar-render: H1-as — segmenten disjunct en oplopend --');
{
  const cleanGaps: TaskSplitGap[] = [
    { afterMinutes: 480, gapMinutes: 480 },
    { afterMinutes: 1440, gapMinutes: 480 },
  ];
  // Dag-modus-taak van 3 werkdagen (gebruik de bestaande dag-taak-helper van deze batterij;
  // kijk hoe de andere dag-cases hun taak bouwen en volg dat patroon).
  const rows: ViewRow[] = [
    { kind: 'task', task: dayTask('rowH1', '2026-06-01', '2026-06-05', cleanGaps), depth: 0, dimmed: false },
  ];
  const { rects } = renderRows(rows, { barSplitMode: 'never' });
  const segs = rects.filter(r => inRow(r, 0)).sort((a, b) => a.x - b.x);
  eq('3 segmenten', segs.length, 3);
  ok('segmenten disjunct en oplopend',
     segs.length === 3 && segs[0].x + segs[0].w <= segs[1].x + 0.01 && segs[1].x + segs[1].w <= segs[2].x + 0.01);
  ok('segment 2 niet breder dan segment 1 (elk 1 werkdag)',
     segs.length === 3 && Math.abs(segs[1].w - segs[0].w) < 0.51);
  ok('segment 3 eindigt niet vóór zijn eigen start (geen omgekeerde balk)',
     segs.length === 3 && segs[2].w > 0);
}
```

Bestaat er geen `dayTask`-helper, bouw de taak zoals de andere dag-modus-cases in dit
bestand dat doen (zelfde velden, `splitGaps` als extra).

- [ ] **Step 2: Draai en zie de nieuwe case falen**

```bash
bash tests/planning/run.sh 2>&1 | grep -c "XX "; echo "exit: ${PIPESTATUS[0]}"
```

Verwacht: de nieuwe asserts rood (segment 2 te breed / segment 3 omgekeerd), exit ≠ 0.

- [ ] **Step 3: Vervang de implementatie door een re-export**

`splitBarGeometry.ts` wordt:

```ts
// Z15 → B1c-W0: de wandeling zelf is verhuisd naar engine/scheduler/splitWalk.ts (één bron
// voor renderer, print, lastlezer en nivelleerder; de H1-as-fix zit dáár). Deze module
// blijft de import-plek voor de tekenpaden (GanttRenderer, printPreview) — puur re-export,
// zodat geen enkele aanroeper hoeft te verhuizen. Het O5-besluit (een échte split tekent
// ALTIJD gesplitst; barSplitMode stuurt alleen kalender-necking) blijft bij de aanroepers.
export { computeSplitSegments, type SplitSegmentBounds } from '@/engine/scheduler/splitWalk';
```

Verplaats de waardevolle delen van het oude docblok (dag/uur-modus, exclusieve grenzen,
afrondingsconventie) naar het docblok in `splitWalk.ts` als dat daar nog niet staat.

- [ ] **Step 4: Draai en zie alles groen**

```bash
bash tests/planning/run.sh 2>&1 | tail -5; echo "exit: $?"
```

Verwacht: exit 0 — de nieuwe case én de bestaande split-render-cases (waaronder de
samenvouw-case en de uur-modus-cases) blijven groen.

- [ ] **Step 5: Commit**

```bash
git add src/engine/renderer/splitBarGeometry.ts tests/planning/check-split-bar-render.ts
git commit -m "fix(renderer): splitbalk-segmenten op de H1-as — geen dubbeltelling bij >=2 gaten (B1c-W0.4)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: `computeResourceLoad` split- en taakkalender-bewust

**Files:**
- Modify: `src/engine/scheduler/ResourceLoad.ts` (twee plekken: `computeResourceLoad`
  regel ~160 en de identieke mapping in `computeHistogramReport` regel ~297)
- Create: `tests/planning/check-resource-load-splits.ts`
- Modify: `tests/planning/run.sh` (registratie)
- Modify: `tests/library/check-occupancy.ts` (één regressiecase)

- [ ] **Step 1: Schrijf de falende test**

`tests/planning/check-resource-load-splits.ts`, zelfde helperstijl als Task 1:

```ts
// check-resource-load-splits.ts — B1c-W0.1/W0.2: belasting alleen op échte werkdagen.
import { computeResourceLoad } from '@/engine/scheduler/ResourceLoad';
// … zelfde ok/eq-helpers en kalenderfabriek als check-split-walk.ts (kopieer ze) …

// Minimale fixtures: bouw taak/resource/assignment-objecten zoals bestaande checks dat
// doen (zoek een check die computeResourceLoad of taken construeert en volg die velden).
// Taak A: 3 werkdagen vanaf ma 2026-06-01, splitGaps als in check-split-walk
// (werk op 06-01, 06-03, 06-05), resource R (maxUnits 1), assignment 1/dag UNIFORM.

const res = computeResourceLoad([resourceR], [assignmentA], [taskA], cal, []);
console.log('-- splits: pauzedagen dragen geen last --');
eq('last op werkdag 1', res.load['R']?.['2026-06-01'], 1);
eq('GEEN last op pauzedag', res.load['R']?.['2026-06-02'], undefined);
eq('last op werkdag 2', res.load['R']?.['2026-06-03'], 1);
eq('GEEN last op pauzedag 2', res.load['R']?.['2026-06-04'], undefined);
eq('last op werkdag 3', res.load['R']?.['2026-06-05'], 1);

console.log('-- taakkalender: last volgt de kalender van de taak, niet van het project --');
// Taak B: 3 werkdagen vanaf vr 2026-06-05 op een 6-daagse taakkalender (za = werkdag),
// project op 5-daags. CPM-earlyFinish van zo'n taak is za 06-06... werk = vr, za, ma.
// Geef de 6-daagse kalender mee in het `resourceCalendars`-argument (dat is sinds fase
// 2.8a de kalenderbibliotheek) en zet `taskB.calendarId` erop.
const res2 = computeResourceLoad([resourceR], [assignmentB], [taskB], cal, [zesDaags]);
eq('vrijdag belast', res2.load['R']?.['2026-06-05'], 1);
eq('ZATERDAG belast (taakkalender!)', res2.load['R']?.['2026-06-06'], 1);
eq('maandag belast', res2.load['R']?.['2026-06-08'], 1);
eq('dinsdag NIET belast (duur is op)', res2.load['R']?.['2026-06-09'], undefined);
```

Zet `taskA.time.earlyStart/earlyFinish` op de CPM-correcte waardes (06-01/06-05) en
`scheduleDuration` op 3 — de test toetst de mapping, niet de CPM.

- [ ] **Step 2: Registreer in `run.sh`, draai, zie falen**

```bash
bash tests/planning/run.sh 2>&1 | tail -12; echo "exit: $?"
```

Verwacht: rood — huidige code belast 06-01/06-02/06-03 (case 1) en slaat zaterdag over
(case 2). Exit ≠ 0.

- [ ] **Step 3: Implementeer**

In `ResourceLoad.ts`:

```ts
import { enumerateTaskWorkDays } from './splitWalk';
```

Voeg binnen `computeResourceLoad` (na `const projectEngine = …`) een gedeelde
taak-engine-helper toe en gebruik hem in de mapping:

```ts
  // W0: de dag-mapping volgt de TAAKkalender (dezelfde engine waarmee de CPM duur en
  // splits rekent — `CPMSolver.engineFor`) en slaat splitGaps over. Cache per calendarId.
  const taskEngineCache = new Map<string, CalendarEngine>();
  const engineForTask = (task: Task): CalendarEngine => {
    const key = task.calendarId ?? '';
    let eng = taskEngineCache.get(key);
    if (!eng) {
      eng = key === ''
        ? projectEngine
        : new CalendarEngine(resolveCalendar(task.calendarId, resourceCalendars, projectCalendar));
      taskEngineCache.set(key, eng);
    }
    return eng;
  };
```

en vervang in de assignment-lus:

```ts
    const workDayIsos = enumerateWorkDays(projectEngine, task.time.earlyStart, task.time.earlyFinish);
```

door:

```ts
    const workDayIsos = enumerateTaskWorkDays(task.splitGaps, engineForTask(task), task.time.earlyStart, durationDays);
```

Doe **exact hetzelfde** in `computeHistogramReport` (de tweede, identieke mapping rond
regel 297): zelfde helper (til `engineForTask` naar module-niveau als functie die een cache
meekrijgt, of herhaal de vier regels — kies wat de bestaande stijl van dit bestand het
minst geweld aandoet, maar de twee mappings MOETEN identiek blijven; zet er een
verwijscommentaar tussen).

Controleer het veld: heet het `task.calendarId`? Zoek `engineFor` in `CPMSolver.ts` en
gebruik exact dezelfde bron + fallback.

Pas het docblok van `computeResourceLoad` aan (punt 2-3): de mapping is nu "werkdagen van
de TAAKkalender vanaf earlyStart, splits overgeslagen" — de oude tekst zegt projectkalender.

- [ ] **Step 4: Draai en zie groen — inclusief de bestaande batterijen**

```bash
bash tests/planning/run.sh 2>&1 | tail -5; echo "exit: $?"
bash tests/library/run.sh 2>&1 | tail -5; echo "exit: $?"
bash tests/mcp/run.sh 2>&1 | tail -5; echo "exit: $?"
```

Verwacht: exit 0, 0, 0. LET OP: `tests/mcp/cases-histogram.ts` en occupancy-cases toetsen
bestaand gedrag; als er een case rood wordt, kijk éérst of die case een taak met eigen
kalender of splits gebruikt (dan is de nieuwe uitkomst de juiste en wordt de case
bijgewerkt mét een commentaar waarom) — pas nooit blind de verwachting aan.

- [ ] **Step 5: Voeg de occupancy-regressiecase toe**

In `tests/library/check-occupancy.ts`, achteraan bij de bestaande cases, in dezelfde
case-stijl als de rest van dat bestand: één document met een taak mét `splitGaps` (zelfde
gaten als Task 1) geboekt op een poolitem; assert dat `dailyLoad` van de booking de
pauzedagen NIET bevat en de werkdagen wél. Draai `bash tests/library/run.sh`; exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/engine/scheduler/ResourceLoad.ts tests/planning/check-resource-load-splits.ts tests/planning/run.sh tests/library/check-occupancy.ts
git commit -m "fix(scheduler): belasting op de echte werkdagen — splits overslaan, taakkalender volgen (B1c-W0.1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: nivelleerder — boeking en delay op de taakkalender

**Files:**
- Modify: `src/engine/scheduler/ResourceLeveler.ts` (bookDemandAt ~regel 213, delay-meting
  ~regel 284, plus een taak-engine-helper naast de bestaande `engineByRes`)
- Create: `tests/planning/check-leveler-splits.ts`
- Modify: `tests/planning/run.sh` (registratie)

- [ ] **Step 1: Schrijf de falende test**

`tests/planning/check-leveler-splits.ts` — roept `levelResources` rechtstreeks aan (kijk in
`tests/planning/harness.ts` hoe die de leveler-invoer opbouwt en hergebruik die vorm):

```ts
// check-leveler-splits.ts — B1c-W0.2/W0.3: de boekhouding telt dezelfde dagen als de CPM.
// Case 1 (boeking): resource cap 1. Taak A (prioriteit hoog) heeft een gat op dag 2;
// taak B (duur 1, geen relaties) wil precies die dag. Met split-bewuste boeking is dag 2
// vrij en krijgt B GEEN delay; de oude boeking bezette dag 2 ten onrechte.
const r1 = levelResources(/* A(3 wd, gap dag 2, prio 600) + B(1 wd, es = dag 2, prio 500),
                             beide 1/dag op resource R cap 1, dagkalender */);
eq('taak B hoeft niet te wijken: het gat van A is echt vrij', r1.delays['B'], undefined);
ok('geen onopgeloste conflicten', Object.keys(r1.unresolved).length === 0);

// Case 2 (delay-eenheid): taak C op een 6-daagse taakkalender (za werkdag) botst met
// hogere-prioriteit-taak D op dezelfde resource; C moet 1 werkdag opschuiven en zijn
// PF is vrijdag. Op de taakkalender is de eerstvolgende werkdag ZATERDAG: delay = 1
// (taakkalender-werkdagen). De oude meting op de projectkalender gaf voor een
// zaterdag-start een andere delta dan de CPM (die via engineFor(C) toepast) — de
// preview (`shifts`) en de echte herberekening lopen dan uiteen.
const r2 = levelResources(/* D(1 wd, prio 900) + C(1 wd, prio 100, calendarId: zesDaags),
                             beide 1/dag op resource R cap 1; C.es == D.es == vrijdag */);
eq('delay van C in taakkalender-werkdagen', r2.delays['C'], 1);
// Sluit de cirkel: pas r2 toe zoals applyLeveling dat doet (zet levelingDelay op C,
// draai solveProject) en assert dat C's earlyStart op ZATERDAG landt — de dag die de
// preview-shift beloofde.
```

Werk de twee fixture-commentaren uit tot echte objecten (zelfde task/resource-vorm als
case 1; de kalenderbibliotheek gaat mee als `resourceCalendars`-argument én als
`calendars` voor `solveProject`).

- [ ] **Step 2: Registreer, draai, zie falen**

```bash
bash tests/planning/run.sh 2>&1 | tail -12; echo "exit: $?"
```

Verwacht: case 1 rood (B krijgt nu wél een delay) en/of case 2 rood. Exit ≠ 0.

- [ ] **Step 3: Implementeer**

In `ResourceLeveler.ts`:

```ts
import { enumerateTaskWorkDays } from './splitWalk';
```

Naast `engineByRes` (regel ~117) een taak-engine-helper met dezelfde bron als
`CPMSolver.engineFor`:

```ts
  // W0: boeking en delay-meting op de TAAKkalender — dezelfde engine waarmee de CPM de
  // delay straks toepast (shiftByLevelingDelay via engineFor). Cache per calendarId.
  const taskEngineCache = new Map<string, CalendarEngine>();
  const engineForTask = (task: Task): CalendarEngine => {
    const key = task.calendarId ?? '';
    let eng = taskEngineCache.get(key);
    if (!eng) {
      eng = key === ''
        ? projEngine
        : new CalendarEngine(resolveCalendar(task.calendarId, resourceCalendars, projectCalendar));
      taskEngineCache.set(key, eng);
    }
    return eng;
  };
```

`bookDemandAt` (regel ~213): vervang

```ts
    const occ = nextWorkDays(projEngine, startDate, dur);
```

door

```ts
    const occ = enumerateTaskWorkDays(task.splitGaps, engineForTask(task), formatDate(startDate), dur);
```

Delay-meting (regel ~284): vervang

```ts
    const delay = projEngine.workDaysBetween(pf, startDate) - 1;
```

door

```ts
    const delay = engineForTask(taskById.get(pick)!).workDaysBetween(pf, startDate) - 1;
```

**Bewust NIET in deze taak**: de kandidaat-scan van `findSlot` stapt nog met
`projEngine.nextWorkDay` — een taak op een afwijkende kalender krijgt dus alleen
project-werkdagen als kandidaat-start. Dat is de bestaande beperking; hij verdwijnt pas in
de verdeler-fase (waar `findSlot` toch herbouwd wordt rond het restprofiel). Zet dit als
commentaar bij `findSlot` zodat het niet als vergeten leest.

- [ ] **Step 4: Draai de hele planningssuite**

```bash
bash tests/planning/run.sh 2>&1 | tail -5; echo "exit: $?"
```

Verwacht: exit 0 — inclusief de 25 bestaande leveling-cases
(`cases-resource-leveling.json`). Wordt daar iets rood, geldt dezelfde regel als Task 3
stap 4: eerst begrijpen, dan pas (met commentaar) een verwachting bijstellen.

- [ ] **Step 5: Commit**

```bash
git add src/engine/scheduler/ResourceLeveler.ts tests/planning/check-leveler-splits.ts tests/planning/run.sh
git commit -m "fix(scheduler): nivelleerder boekt en meet op de taakkalender, splits-bewust (B1c-W0.2/W0.3)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: de volle poort

**Files:** geen nieuwe.

- [ ] **Step 1: Draai de ene poort**

```bash
npm run verify; echo "exit: $?"
```

Verwacht: exit 0. Dit draait typecheck (incl. tests/ en scripts/), lint, alle vier de
suites, voorbeelden, docs, i18n, cycles en audit — exact wat CI draait. `verify:cycles`
bewaakt hier ook dat splitWalk geen renderer→scheduler-cyclus heeft geïntroduceerd.

- [ ] **Step 2: Commit restjes (alleen als er iets is)**

Geen losse eindjes verwacht; `git status --short` hoort schoon te zijn.

---

## Zelfreview van dit plan (uitgevoerd)

- **Spec-dekking W0**: item 1 (split-bewuste last + curve over werkdagen) = Task 3; item 2
  (split-bewuste boeking + taakkalender-testplicht) = Task 4 + Task 3-case 2; item 3
  (delay-eenheid) = Task 4; item 4 (renderer H1-as + x-positie-toetsen) = Task 1 + 2. Het
  curve-besluit uit de spec (curve over de wérkdagen; gaten rekken de spanne) is precies
  wat de mapping "distributie-index i → i-de échte werkdag" doet — geen aparte code nodig.
- **Buiten dit plan, bewust**: de verdeler, de naad-herziening (`capacityOf`-meelezers,
  reden-taxonomie), gap-invoeging, het schrijfpad en het paneel — dat zijn de volgende twee
  plannen op dezelfde spec (§4 e.v.), te schrijven ná W0.
- **Typen consistent**: `enumerateTaskWorkDays(gaps, engine, startIso, durationDays)` wordt
  in Task 1 gedefinieerd en in Task 3/4 exact zo aangeroepen; `engineForTask` is in Task 3
  en 4 een lokale helper met dezelfde vorm (bewust twee lokale kopieën in twee modules —
  de gedeelde kern is de enumerator, niet de cache).
- **Open aannames die de uitvoerder moet verifiëren** (staan óók in de betreffende stap):
  het exacte veld `task.calendarId` + fallback (spiegel `CPMSolver.engineFor`), de publieke
  `CalendarEngine.hoursPerDay`, en de helperstijl/registratie van checks in `run.sh`.
