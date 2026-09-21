# Taken splitsen — etappe 1 (kern) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De headless kern waarmee een gebruiker straks splits kan maken en bewerken: het pure
bewerkmodel, de store-actie, de solver-fix, herkomst `'user'` en de nivelleerdergrens — zonder UI.

**Architecture:** `src/engine/scheduler/splitEdit.ts` vertaalt `Task.splitGaps` (H1-as) naar een
stukkenlijst en terug en bevat alle bewerkingen als pure functies. `taskSlice.setTaskSplits` is de
enige schrijver; hij behandelt een splitbewerking als tijdbasis-bewerking. Spec:
`docs/superpowers/specs/2026-09-19-taken-splitsen-bewerken-design.md` (lees de tabel "Verwerkte
critreview" eerst).

**Tech Stack:** TypeScript strict, Zustand + Immer, esbuild-gebundelde `tests/planning/check-*.ts`.

**Dit plan dekt alleen bouwstap 1 van de spec.** Etappe 2 (splits-modus), 3 (slepen + contextmenu),
4 (paneel) en 5 (MCP, i18n, gids, browsertest, exportmelding) krijgen elk een eigen plan ná het
kijkmoment van de voorgaande etappe — de eigenaar stuurt de UI bij op wat hij ziet, dus vooruit
uitgeschreven UI-code zou fictie zijn.

**Werkafspraken:** poorten op EXITCODE, nooit op de tail; nooit een volledige `npm run verify`
parallel aan een andere; commits in het Nederlands; niet naar `main` pushen. Losse check draaien:
`bash tests/planning/run.sh check-split-edit.ts` werkt NIET (het argument is een cases-bestand) —
gebruik het esbuild-commando uit Task 1 stap 2.

---

## Bestandsoverzicht

| Bestand | Rol |
|---|---|
| `src/types/task.ts` | `TaskSplitGap.source` krijgt `'user'` |
| `src/engine/scheduler/splitEdit.ts` (nieuw) | stukkenmodel, wélgevormdheid, bewerkingen, `canSplitTask`, `completedWorkMinutes`, `clipUserGapsToWork` |
| `src/services/ifc/ifcPsets.ts` | lezer behoudt `source: 'user'` |
| `src/engine/scheduler/CPMSolver.ts` | dag-taak-op-bandenkalender rekent met `splitTotalSpanDays` (forward + backward) |
| `src/engine/contour/contourEngine.ts` | `rescaleSplitGaps` snapt `'user'`-gaten |
| `src/utils/taskDefaults.ts` | `rescaleTaskContours` krijgt `opts.keepGaps` |
| `src/state/slices/taskSlice.ts` | actie `setTaskSplits`; `updateTask` klipt gebruikersgaten bij duurkrimp |
| `src/engine/scheduler/ResourceLeveler.ts` | geen scatter op taken met niet-`'leveling'`-gaten |
| `tests/planning/check-split-edit.ts`, `check-split-edit-store.ts` (nieuw) + `run.sh` | regressie |

---

### Task 1: Herkomst `'user'` in het type en de IFC-lezer

**Files:** Modify `src/types/task.ts` (interface `TaskSplitGap`, ~regel 118–130),
`src/services/ifc/ifcPsets.ts` (~regel 343–349); Test: `tests/planning/check-split-edit.ts` (nieuw).

- [ ] **Stap 1 — falende test.** Maak `tests/planning/check-split-edit.ts`:

```ts
// check-split-edit.ts — het pure bewerkmodel voor gebruikerssplits (issue #146, spec
// 2026-09-19-taken-splitsen-bewerken-design.md). Fixtures zijn GECOMMIT: het .mpp-corpus staat
// niet in de repo en is dus geen poort.
import type { TaskSplitGap } from '@/types/task';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void { checks++; if (!cond) diffs.push(label); }
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

// ── T1: het type draagt 'user' ───────────────────────────────────────────────
const userGap: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480, source: 'user' };
eq('T1 source user typeert', userGap.source, 'user');

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) { console.log(`OK  split-edit: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  split-edit: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
```

- [ ] **Stap 2 — zie hem falen.** `npm run typecheck` ⇒ fout: `'user'` niet toewijsbaar aan
  `'leveling'`. Los draaien van de check (hergebruik in alle volgende taken):

```bash
node_modules/.bin/esbuild tests/planning/check-split-edit.ts --log-level=error --bundle \
  --platform=node --format=esm --alias:@=./src --define:import.meta.env.DEV=false \
  --define:import.meta.env.PROD=true --define:import.meta.env.MODE='"production"' \
  --define:__OPS_DEV_INSTANCE__='"test"' --outfile=tests/planning/.splitedit.mjs \
  && node tests/planning/.splitedit.mjs; echo "exit=$?"
```

- [ ] **Stap 3 — implementeer.** In `task.ts`: `source?: 'leveling' | 'user';` en vul het docblok
  aan: `'user'` = door de gebruiker gemaakt of bewerkt (paneel/Gantt/MCP); wordt nooit door de
  nivelleerder of "nivellering wissen" aangeraakt; `rescaleSplitGaps` snapt het op de eenheid.
  In `ifcPsets.ts` vervang de `map` door:

```ts
task.splitGaps = parsed.map(g => g.source === 'leveling' || g.source === 'user'
  ? { afterMinutes: g.afterMinutes, gapMinutes: g.gapMinutes, source: g.source }
  : { afterMinutes: g.afterMinutes, gapMinutes: g.gapMinutes });
```
  en werk het commentaar erboven bij ("GESLOTEN verzameling: `'leveling'` en `'user'`").
  Zoek daarna andere plekken die de gesloten verzameling kennen:
  `grep -rn "'leveling'" src tests --include=*.ts | grep -v "=== 'leveling'\|!== 'leveling'"` —
  elke validator/typeguard (o.a. `extMappers.ts`, MCP-leesvorm, `fieldCoverage.ts`) krijgt `'user'`.

- [ ] **Stap 4 — groen.** `npm run typecheck` exit 0; check exit 0. Registreer in
  `tests/planning/run.sh` direct ná de regel met `check-split-walk.ts`:

```bash
  SPLITEDITCHECK="$DIR/.check-split-edit.mjs"
  if bundle_check "$DIR/check-split-edit.ts" "$SPLITEDITCHECK"; then node "$SPLITEDITCHECK" || STATUS=1; fi
```
  (kijk hoe `SPLITWALKCHECK` gedeclareerd is en volg exact die vorm.)

- [ ] **Stap 5 — IFC-round-trip.** Voeg in de bestaande IFC-round-trip-batterij (zoek:
  `grep -ln "splitGaps" tests/planning/check-*.ts`) een taak toe met
  `splitGaps: [{ afterMinutes: 960, gapMinutes: 480, source: 'user' }]` en eis dat `source` na
  schrijven+lezen `'user'` is. Commit: `Splits: herkomst 'user' in type en IFC-lezer`.

### Task 2: Stukkenmodel — wélgevormdheid en heen-en-terug

**Files:** Create `src/engine/scheduler/splitEdit.ts`; Test: `check-split-edit.ts`.

- [ ] **Stap 1 — falende tests** (toevoegen vóór "Uitslag"; importeer uit `@/engine/scheduler/splitEdit`):

```ts
const NEAT: TaskSplitGap[] = [{ afterMinutes: 480, gapMinutes: 480 }, { afterMinutes: 1440, gapMinutes: 480 }];
const WITH_SOURCE: TaskSplitGap[] = [{ afterMinutes: 480, gapMinutes: 960, source: 'leveling' }];
const SUBDAY: TaskSplitGap[] = [{ afterMinutes: 480, gapMinutes: 100 }];
const FRACTION: TaskSplitGap[] = [{ afterMinutes: 0.1 + 0.2, gapMinutes: 0.7 }, { afterMinutes: 3.3, gapMinutes: 1.1 }];
const OVERLAP: TaskSplitGap[] = [{ afterMinutes: 480, gapMinutes: 960 }, { afterMinutes: 960, gapMinutes: 480 }];
const BEYOND: TaskSplitGap[] = [{ afterMinutes: 1440, gapMinutes: 5760 }]; // werk = 960
const UNSORTED: TaskSplitGap[] = [{ afterMinutes: 1440, gapMinutes: 480 }, { afterMinutes: 480, gapMinutes: 480 }];

ok('T2 netjes wélgevormd', isWellFormedSplit(NEAT, 1440));
ok('T2 overlap niet', !isWellFormedSplit(OVERLAP, 1440));
ok('T2 voorbij werktotaal niet', !isWellFormedSplit(BEYOND, 960));
ok('T2 ongesorteerd niet', !isWellFormedSplit(UNSORTED, 1440));
ok('T2 NaN niet', !isWellFormedSplit([{ afterMinutes: NaN, gapMinutes: 1 }], 100));
ok('T2 gat op positie 0 niet', !isWellFormedSplit([{ afterMinutes: 0, gapMinutes: 60 }], 100));
ok('T2 leeg wélgevormd', isWellFormedSplit(undefined, 480) && isWellFormedSplit([], 480));

eq('T2 stukken NEAT', toSplitPieces(NEAT, 1440), [
  { kind: 'work', minutes: 480 }, { kind: 'gap', minutes: 480 },
  { kind: 'work', minutes: 480 }, { kind: 'gap', minutes: 480 }, { kind: 'work', minutes: 480 },
]);
eq('T2 zonder gaten = één werkstuk', toSplitPieces(undefined, 960), [{ kind: 'work', minutes: 960 }]);
ok('T2 niet-wélgevormd ⇒ null', toSplitPieces(BEYOND, 960) === null);

for (const [name, g, w] of [['NEAT', NEAT, 1440], ['WITH_SOURCE', WITH_SOURCE, 960],
  ['SUBDAY', SUBDAY, 960], ['FRACTION', FRACTION, 10]] as const) {
  const back = fromSplitPieces(toSplitPieces(g, w)!, g);
  eq(`T2 round-trip ${name}: gaten`, back.gaps, g);
  ok(`T2 round-trip ${name}: werk`, Math.abs(back.totalWorkMinutes - w) < 1e-6);
}
```

- [ ] **Stap 2 — zie falen** (module bestaat niet ⇒ bundelfout, exit ≠ 0).

- [ ] **Stap 3 — implementeer** `src/engine/scheduler/splitEdit.ts`:

```ts
// splitEdit.ts — het ENE bewerkmodel voor gebruikerssplits (issue #146). Gantt, eigenschappenpaneel
// en MCP rekenen nooit zelf op `afterMinutes`/`gapMinutes`: de H1-as (elk gat telt mee in de
// aspositie van het volgende, zie `splitWalk.ts`) wordt hier één keer vertaald naar STUKKEN — een
// afwisselende lijst werk/pauze/werk in werkminuten — en weer terug. Puur: geen store, geen kalender.
//
// NIET-WÉLGEVORMDE lijsten (overlap, gat voorbij het werktotaal, ongesorteerd, niet-eindig) kan dit
// model niet dragen zonder data te vernietigen; `toSplitPieces` geeft dan `null` en de aanroeper
// behandelt de taak als alleen-lezen. Er wordt NOOIT stil genormaliseerd.
import type { Task, TaskSplitGap } from '@/types/task';

export type SplitPiece =
  | { kind: 'work'; minutes: number }
  | { kind: 'gap'; minutes: number; source?: 'leveling' | 'user' };

const EPS = 1e-6;

export function isWellFormedSplit(gaps: readonly TaskSplitGap[] | undefined, totalWorkMinutes: number): boolean {
  if (!gaps || gaps.length === 0) return true;
  if (!(totalWorkMinutes > 0)) return false;
  let axis = 0;
  let work = 0;
  for (const g of gaps) {
    if (!Number.isFinite(g.afterMinutes) || !Number.isFinite(g.gapMinutes) || !(g.gapMinutes > 0)) return false;
    const segment = g.afterMinutes - axis;
    if (!(segment > EPS)) return false;            // overlap, ongesorteerd of gat op positie 0
    work += segment;
    if (!(work < totalWorkMinutes - EPS)) return false; // gat op of voorbij het werktotaal
    axis = g.afterMinutes + g.gapMinutes;
  }
  return true;
}

export function toSplitPieces(gaps: readonly TaskSplitGap[] | undefined, totalWorkMinutes: number): SplitPiece[] | null {
  if (!isWellFormedSplit(gaps, totalWorkMinutes)) return null;
  const pieces: SplitPiece[] = [];
  let axis = 0;
  let work = 0;
  for (const g of gaps ?? []) {
    const segment = g.afterMinutes - axis;
    pieces.push({ kind: 'work', minutes: segment });
    pieces.push(g.source ? { kind: 'gap', minutes: g.gapMinutes, source: g.source } : { kind: 'gap', minutes: g.gapMinutes });
    work += segment;
    axis = g.afterMinutes + g.gapMinutes;
  }
  pieces.push({ kind: 'work', minutes: totalWorkMinutes - work });
  return pieces;
}

/** `original` (optioneel): de gatenlijst waaruit `pieces` kwam. Een ongewijzigd gat wordt dan met
 *  zijn OORSPRONKELIJKE getallen teruggegeven — `(a − b) + b` is in floats niet altijd `a`, en
 *  alleen-kijken mag een bestand nooit wijzigen. */
export function fromSplitPieces(pieces: readonly SplitPiece[], original?: readonly TaskSplitGap[]): { gaps: TaskSplitGap[]; totalWorkMinutes: number } {
  const gaps: TaskSplitGap[] = [];
  let axis = 0;
  let work = 0;
  for (const p of pieces) {
    if (p.kind === 'work') { axis += p.minutes; work += p.minutes; continue; }
    const o = original?.[gaps.length];
    const same = o && Math.abs(o.afterMinutes - axis) < EPS && Math.abs(o.gapMinutes - p.minutes) < EPS && o.source === p.source;
    if (same) { gaps.push({ ...o }); axis = o.afterMinutes + o.gapMinutes; continue; }
    gaps.push(p.source ? { afterMinutes: axis, gapMinutes: p.minutes, source: p.source } : { afterMinutes: axis, gapMinutes: p.minutes });
    axis += p.minutes;
  }
  return { gaps, totalWorkMinutes: work };
}
```
  (`Task` wordt in Task 4 gebruikt; laat de import tot dan weg als `noUnusedLocals` klaagt.)

- [ ] **Stap 4 — groen**, `npm run typecheck` exit 0. Commit: `Splits: stukkenmodel met wélgevormdheid en verliesvrije heen-en-terug`.

### Task 3: De bewerkingen

**Files:** Modify `splitEdit.ts`; Test: `check-split-edit.ts`.

- [ ] **Stap 1 — falende tests:**

```ts
const U = 480; // dag-eenheid bij 8u
const one = toSplitPieces(undefined, 4800)!; // 10 werkdagen
const s1 = splitAt(one, 2400, 2400, U);
ok('T3 splitAt ok', s1.ok);
eq('T3 splitAt 5+5+5', s1.ok && s1.pieces, [
  { kind: 'work', minutes: 2400 }, { kind: 'gap', minutes: 2400, source: 'user' }, { kind: 'work', minutes: 2400 }]);
eq('T3 splitAt snapt positie en pauze', (() => { const r = splitAt(one, 2500, 100, U); return r.ok && r.pieces; })(), [
  { kind: 'work', minutes: 2400 }, { kind: 'gap', minutes: 480, source: 'user' }, { kind: 'work', minutes: 2400 }]);
eq('T3 splitAt op 0 geweigerd', splitAt(one, 0, U, U), { ok: false, reason: 'position-out-of-range' });
eq('T3 splitAt op eind geweigerd', splitAt(one, 4800, U, U), { ok: false, reason: 'position-out-of-range' });
eq('T3 splitAt vóór voltooid werk geweigerd', splitAt(one, 960, U, U, 1440), { ok: false, reason: 'before-completed-work' });
const p5 = s1.ok ? s1.pieces : [];
eq('T3 tweede split in het tweede stuk', (() => { const r = splitAt(p5, 3360, U, U); return r.ok && r.pieces.map(p => p.minutes); })(), [2400, 2400, 960, 480, 1440]);
eq('T3 split precies op een bestaande pauze geweigerd', splitAt(p5, 2400, U, U), { ok: false, reason: 'position-on-gap' });

eq('T3 pauze langer', (() => { const r = setGapLength(p5, 0, 3000, U); return r.ok && r.pieces.map(p => p.minutes); })(), [2400, 2880, 2400]);
eq('T3 pauze naar 0 = samenvoegen', (() => { const r = setGapLength(p5, 0, 0, U); return r.ok && r.pieces; })(), [{ kind: 'work', minutes: 4800 }]);
eq('T3 werkstuk korter verandert totaal', (() => { const r = setWorkLength(p5, 0, 1440, U); return r.ok && fromSplitPieces(r.pieces).totalWorkMinutes; })(), 3840);
eq('T3 werkstuk minimaal één eenheid', (() => { const r = setWorkLength(p5, 0, 10, U); return r.ok && r.pieces[0].minutes; })(), 480);
eq('T3 onbekende index', setGapLength(p5, 3, U, U), { ok: false, reason: 'index-out-of-range' });
eq('T3 removeAllGaps', removeAllGaps(p5), [{ kind: 'work', minutes: 4800 }]);

// Alleen het BEWERKTE stuk wordt gesnapt: een sub-dag-importgat blijft 100 minuten.
const sub = toSplitPieces([{ afterMinutes: 480, gapMinutes: 100 }, { afterMinutes: 1540, gapMinutes: 480 }], 2400)!;
eq('T3 onaangeraakt sub-dag-gat blijft', (() => { const r = setGapLength(sub, 1, 960, U); return r.ok && r.pieces.map(p => p.minutes); })(), [480, 100, 960, 960, 960]);
ok('T3 onaangeraakt gat houdt (geen) source', (() => { const r = setGapLength(sub, 1, 960, U); return r.ok && !('source' in r.pieces[1]); })());

// Adoptie: na een gebruikersbewerking zijn nivelleergaten van de gebruiker.
const lev = toSplitPieces([{ afterMinutes: 480, gapMinutes: 480, source: 'leveling' }, { afterMinutes: 1440, gapMinutes: 480 }], 1440)!;
eq('T3 adoptLevelingGaps', adoptLevelingGaps(lev).filter(p => p.kind === 'gap').map(p => (p as { source?: string }).source), ['user', undefined]);
```

- [ ] **Stap 2 — zie falen.**
- [ ] **Stap 3 — implementeer** (toevoegen aan `splitEdit.ts`):

```ts
export type SplitEditRefusal = 'position-out-of-range' | 'position-on-gap' | 'before-completed-work' | 'work-too-short' | 'index-out-of-range';
export type SplitEditResult = { ok: true; pieces: SplitPiece[] } | { ok: false; reason: SplitEditRefusal };

const snap = (minutes: number, unit: number): number => (unit > 0 ? Math.round(minutes / unit) * unit : minutes);
const totalWork = (pieces: readonly SplitPiece[]): number => pieces.reduce((s, p) => (p.kind === 'work' ? s + p.minutes : s), 0);

/** Werk- en pauze-indexen tellen los van elkaar (werkstuk 0,1,2… / pauze 0,1,2…). */
function arrayIndexOf(pieces: readonly SplitPiece[], kind: SplitPiece['kind'], n: number): number {
  let seen = -1;
  for (let i = 0; i < pieces.length; i++) if (pieces[i].kind === kind && ++seen === n) return i;
  return -1;
}

/** Splits op `workOffsetMinutes` (WERK-as, zonder pauzes). `minOffsetMinutes` = reeds voltooid werk. */
export function splitAt(pieces: readonly SplitPiece[], workOffsetMinutes: number, gapMinutes: number, unitMinutes: number, minOffsetMinutes = 0): SplitEditResult {
  const at = snap(workOffsetMinutes, unitMinutes);
  if (!(at > EPS) || !(at < totalWork(pieces) - EPS)) return { ok: false, reason: 'position-out-of-range' };
  if (at < minOffsetMinutes - EPS) return { ok: false, reason: 'before-completed-work' };
  const gap = Math.max(unitMinutes, snap(gapMinutes, unitMinutes));
  let before = 0;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.kind !== 'work') continue;
    const left = at - before;
    const right = p.minutes - left;
    if (left > EPS && right > EPS) {
      if (left < unitMinutes - EPS || right < unitMinutes - EPS) return { ok: false, reason: 'work-too-short' };
      return { ok: true, pieces: [...pieces.slice(0, i), { kind: 'work', minutes: left },
        { kind: 'gap', minutes: gap, source: 'user' }, { kind: 'work', minutes: right }, ...pieces.slice(i + 1)] };
    }
    if (Math.abs(left) <= EPS || Math.abs(right) <= EPS) return { ok: false, reason: 'position-on-gap' };
    before += p.minutes;
  }
  return { ok: false, reason: 'position-out-of-range' };
}

export function removeGap(pieces: readonly SplitPiece[], gapIndex: number): SplitEditResult {
  const i = arrayIndexOf(pieces, 'gap', gapIndex);
  if (i < 0) return { ok: false, reason: 'index-out-of-range' };
  const merged: SplitPiece = { kind: 'work', minutes: pieces[i - 1].minutes + pieces[i + 1].minutes };
  return { ok: true, pieces: [...pieces.slice(0, i - 1), merged, ...pieces.slice(i + 2)] };
}

export function setGapLength(pieces: readonly SplitPiece[], gapIndex: number, minutes: number, unitMinutes: number): SplitEditResult {
  const i = arrayIndexOf(pieces, 'gap', gapIndex);
  if (i < 0) return { ok: false, reason: 'index-out-of-range' };
  const next = snap(minutes, unitMinutes);
  if (!(next > EPS)) return removeGap(pieces, gapIndex);
  return { ok: true, pieces: pieces.map((p, k) => (k === i ? { kind: 'gap', minutes: next, source: 'user' } : p)) };
}

export function setWorkLength(pieces: readonly SplitPiece[], workIndex: number, minutes: number, unitMinutes: number): SplitEditResult {
  const i = arrayIndexOf(pieces, 'work', workIndex);
  if (i < 0) return { ok: false, reason: 'index-out-of-range' };
  const next = Math.max(unitMinutes, snap(minutes, unitMinutes));
  return { ok: true, pieces: pieces.map((p, k) => (k === i ? { kind: 'work', minutes: next } : p)) };
}

export function removeAllGaps(pieces: readonly SplitPiece[]): SplitPiece[] {
  return [{ kind: 'work', minutes: totalWork(pieces) }];
}

/** Adoptieregel (spec §2): na een gebruikersbewerking zijn nivelleergaten van de gebruiker. */
export function adoptLevelingGaps(pieces: readonly SplitPiece[]): SplitPiece[] {
  return pieces.map(p => (p.kind === 'gap' && p.source === 'leveling' ? { ...p, source: 'user' as const } : p));
}
```
  Let op de volgorde in `splitAt`: de `position-on-gap`-tak moet vóór `before += …` staan én ná de
  binnen-het-stuk-tak; controleer met de test "precies op een bestaande pauze".

- [ ] **Stap 4 — groen + typecheck.** Commit: `Splits: bewerkingen op het stukkenmodel`.

### Task 4: `canSplitTask`, voltooid werk en gat-klip

**Files:** Modify `splitEdit.ts`; Test: `check-split-edit.ts`.

- [ ] **Stap 1 — falende tests.** Bouw taken met de bestaande fabriek (zoek het patroon:
  `grep -n "createDefaultTaskTime\|function mkTask\|makeTask" tests/planning/check-split-bar-render.ts`)
  en eis:

```ts
eq('T4 gewone taak', canSplitTask(mk({ days: 10 }), 8, false), null);
eq('T4 mijlpaal', canSplitTask(mk({ days: 0, isMilestone: true }), 8, false), 'milestone');
eq('T4 verzameltaak', canSplitTask(mk({ days: 10 }), 8, true), 'summary');
eq('T4 hammock', canSplitTask(mk({ days: 10, isHammock: true }), 8, false), 'hammock');
eq('T4 elapsed', canSplitTask(mk({ days: 10, durationType: 'ELAPSEDTIME' }), 8, false), 'elapsed');
eq('T4 handmatig', canSplitTask(mk({ days: 10, manuallyScheduled: true }), 8, false), 'manual');
eq('T4 te kort', canSplitTask(mk({ days: 1 }), 8, false), 'too-short');
eq('T4 niet-bewerkbare importsplit', canSplitTask(mk({ days: 2, splitGaps: BEYOND }), 8, false), 'not-editable');
eq('T4 voltooid uit remainingTime', completedWorkMinutes(mk({ days: 10, remainingTime: 4 }), 8), 2880);
eq('T4 voltooid uit completion', completedWorkMinutes(mk({ days: 10, completion: 0.5 }), 8), 2400);
eq('T4 klip: gat voorbij nieuw werk vervalt', clipUserGapsToWork([{ afterMinutes: 480, gapMinutes: 480, source: 'user' }, { afterMinutes: 2400, gapMinutes: 480, source: 'user' }], 960),
  [{ afterMinutes: 480, gapMinutes: 480, source: 'user' }]);
eq('T4 klip raakt importgat niet', clipUserGapsToWork(BEYOND, 960), BEYOND);
```
  `mk` is een lokale helper in de check die een volledige `Task` levert (neem de vorm over uit de
  gevonden fabriek; `time` via `createDefaultTaskTime` + overrides).

- [ ] **Stap 3 — implementeer:**

```ts
import { durationMinutesOf, taskDurationUnit } from './duration';

export type SplitRefusal = 'milestone' | 'summary' | 'hammock' | 'elapsed' | 'manual' | 'too-short' | 'not-editable';

export function splitUnitMinutes(task: Task, hoursPerDay: number, hourSnapMinutes = 60): number {
  return taskDurationUnit(task) === 'hours' ? hourSnapMinutes : hoursPerDay * 60;
}

/** `null` = splitsbaar; anders de reden (UI: verbodscursor/gekleurd blok, MCP: weigertekst). */
export function canSplitTask(task: Task, hoursPerDay: number, isSummary: boolean): SplitRefusal | null {
  if (task.isMilestone) return 'milestone';
  if (isSummary) return 'summary';
  if (task.isHammock) return 'hammock';
  if (task.time.durationType === 'ELAPSEDTIME') return 'elapsed';
  if (task.manuallyScheduled) return 'manual';
  const work = durationMinutesOf(task, { hoursPerDay } as Parameters<typeof durationMinutesOf>[1]);
  if (!isWellFormedSplit(task.splitGaps, work)) return 'not-editable';
  if (work < 2 * splitUnitMinutes(task, hoursPerDay) - EPS) return 'too-short';
  return null;
}

/** Ergonomiegrens (geen rekeneis): werk dat al verricht is, op de werk-as. */
export function completedWorkMinutes(task: Task, hoursPerDay: number): number {
  const total = durationMinutesOf(task, { hoursPerDay } as Parameters<typeof durationMinutesOf>[1]);
  const remaining = taskDurationUnit(task) === 'hours' ? task.time.remainingMinutes
    : task.time.remainingTime !== undefined ? task.time.remainingTime * hoursPerDay * 60 : undefined;
  if (remaining !== undefined && Number.isFinite(remaining)) return Math.min(total, Math.max(0, total - remaining));
  return Math.min(total, Math.max(0, (task.time.completion || 0) * total));
}

/** Na een duurkrimp buiten `setTaskSplits` om: gebruikersgaten die op of voorbij het nieuwe
 *  werktotaal liggen vervallen (anders wordt de lijst niet-wélgevormd en dus alleen-lezen).
 *  Importgaten (geen `source`) en nivelleergaten blijven van hun eigen levenscyclus. */
export function clipUserGapsToWork(gaps: readonly TaskSplitGap[] | undefined, totalWorkMinutes: number): TaskSplitGap[] | undefined {
  if (!gaps || gaps.length === 0) return gaps ? [...gaps] : gaps;
  let axis = 0; let work = 0;
  const kept: TaskSplitGap[] = [];
  for (const g of gaps) {
    work += Math.max(0, g.afterMinutes - axis);
    axis = Math.max(axis, g.afterMinutes + g.gapMinutes);
    if (g.source === 'user' && !(work < totalWorkMinutes - EPS)) continue;
    kept.push({ ...g });
  }
  return kept;
}
```
  Controleer `DurationCalendar` in `duration.ts`: als het meer velden eist dan `hoursPerDay`, geef
  een echt minimaal object mee in plaats van de cast.

- [ ] **Stap 4 — groen + typecheck.** Commit: `Splits: splitsbaarheid, voltooid werk en gat-klip`.

### Task 5: Solver-fix — dag-taak op een kalender met banden

**Files:** Modify `src/engine/scheduler/CPMSolver.ts` (`addDurationChecked` ~regel 647–655 en de
spiegel in `subDuration`); Test: nieuwe case in de store-check van Task 6 óf een CPM-case.

- [ ] **Stap 1 — falende test.** In `tests/planning/check-split-edit-store.ts` (nieuw, zelfde
  kop/uitslag-vorm als Task 1; store via `createAppStoreContext()` — zie
  `tests/planning/check-commands.ts:103` voor het patroon): project met een kalender MÉT `workTime`
  (ma–vr 08–16), één dag-taak van 4 dagen vanaf maandag 2026-06-01 met
  `splitGaps: [{ afterMinutes: 960, gapMinutes: 960, source: 'user' }]`, `runCPM()`. Eis
  `earlyFinish` op 2026-06-08 (4 werkdagen + 2 pauzedagen), en `lateStart`/`totalFloat` consistent
  met een gatloze taak van 6 dagen (`totalFloat === 0` als enige taak).
- [ ] **Stap 2 — zie falen** (nu 2026-06-04).
- [ ] **Stap 3 — implementeer:** in die tak `const totalDays = splitTotalSpanDays(task, eng);` in
  plaats van `task.time.scheduleDuration`; lees `subDuration` en pas de overeenkomstige tak
  identiek aan. Zonder gaten geeft `splitTotalSpanDays` `durationDaysOf` = `scheduleDuration` terug
  ⇒ byte-identiek.
- [ ] **Stap 4 — bewijs byte-identiek:** `npm run test:planning`; exit 0 vereist (alle bestaande
  cases + de fidelity-poort). Commit: `CPM: dag-taak op bandenkalender respecteert splitGaps`.

### Task 6: Store-actie `setTaskSplits`

**Files:** Modify `src/state/slices/taskSlice.ts` (+ het slice-type), `src/utils/taskDefaults.ts`
(`rescaleTaskContours(task, old, hpd, opts?: { keepGaps?: boolean })` — met `keepGaps` wordt de
`rescaleSplitGaps`-stap overgeslagen); Test: `check-split-edit-store.ts` + `run.sh`-registratie.

- [ ] **Stap 1 — falende tests** (elk een eigen verse context):
  1. `setTaskSplits(id, pieces)` op een 10-daagse taak met 5+5(pauze)+5 ⇒ `splitGaps` =
     `[{afterMinutes:2400,gapMinutes:2400,source:'user'}]`, `isDirty`, `scheduleStale === true`,
     `scheduleFinish` = start ⊕ 15 werkdagen; `undo()` herstelt alles; `redo()` zet het terug.
  2. Twee aanroepen met dezelfde `coalesceKey` = één undo-stap.
  3. Werkduur gewijzigd (stukken tellen op tot 8 dagen) ⇒ `scheduleDuration === 8`.
  4. Adoptie: taak met een `'leveling'`-gat + bewerking van een ander gat ⇒ geen `'leveling'` meer.
  5. Z8: taak met `timephasedFinishFloor` ⇒ na de actie is het venster weg, er is precies één
     timephased-verliesmelding, en na `runCPM()` ligt `earlyFinish` LATER dan vóór de split.
  6. Contour: taak met één contour (1 periode per werkdag, 480 werk) ⇒ na een pauze-invoeging is
     het werk per WERKDAG (via `contourDaySlots` met de nieuwe gaten) ongewijzigd en de som gelijk.
  7. Weigeren: mijlpaal en `BEYOND`-taak ⇒ state referentieel ongewijzigd, geen undo-event.
  8. `removeAllGaps` op een `BEYOND`-taak mag wél (`setTaskSplits(id, null)`).
  9. `updateTask` duurkrimp 10→3 dagen op een taak met gebruikersgat na dag 5 ⇒ gat vervallen.

- [ ] **Stap 3 — implementeer.** Signatuur:
  `setTaskSplits: (taskId: string, pieces: SplitPiece[] | null, opts?: { coalesceKey?: string }) => SplitRefusal | null`.
  Binnen één `set((s) => …)`, in deze volgorde (spec §2): (1) taak zoeken, `isSummary` via
  `isSummaryTask`, `hpd` via `taskCalendarHoursPerDay`; `pieces === null` ⇒ alle gaten weg (slaat
  de `not-editable`-weigering over); anders `canSplitTask` ⇒ return reden; (2)
  `runtime.beginUndoable(s, opts)`; (3) `oldWork = taskWorkMinutesOf(task, hpd)`, oude dagslots per
  contour via `contourDaySlots`; (4) `const { gaps, totalWorkMinutes } = fromSplitPieces(adoptLevelingGaps(pieces), task.splitGaps)`;
  duur schrijven als `|totalWorkMinutes − oldWork| > 1e-6` (dagen: `/ (hpd*60)`, uren:
  `durationMinutes`); dan `rescaleTaskContours(task, oldWork, hpd, { keepGaps: true })`; (5)
  `task.splitGaps = gaps.length ? gaps : undefined`; contourperiodes terugschrijven met
  `buildEditedContourPeriods(oudePeriodes, slots, task.splitGaps, mpd)` — lees de exacte signatuur
  in `src/engine/contour/contourEdit.ts:42-110` en het gebruik in `ContourDialog.tsx:95,187`; (6)
  `clearTimephasedWindow` + (bij `timephasedDurationWalksHaveFrozenWork`) `clearTimephasedDurationWalks`;
  (7) `scheduleFinish` = start ⊕ `splitTotalSpanDays`/`splitTotalSpanMinutes` met de
  `CalendarEngine` van de effectieve taakkalender (zelfde bron als `useBarDrag`:
  `calendarForEngine`); (8) `runtime.finishMutation(s, { stale: true })`. Ná de `set`:
  `notifyTimephasedLoss(...)` bij verlies en `get().recomputeViewRows()` — kopieer de vorm van
  `setTaskCalendar` (taskSlice.ts ~459–474).
  In `updateTask`, direct na de `rescaleTaskContours`-regel: als de taak GEEN contour heeft en de
  werkduur kromp ⇒ `task.splitGaps = clipUserGapsToWork(...)` (leeg ⇒ `undefined`).
  In `contourEngine.rescaleSplitGaps`: voor `source === 'user'` de herschaalde `afterMinutes`/
  `gapMinutes` afronden op `unitMinutes` (nieuwe optionele parameter, doorgegeven vanuit
  `rescaleTaskContours`; min. één eenheid).

- [ ] **Stap 4 — groen:** beide checks exit 0, `npm run typecheck`, `npm run lint`,
  `npm run verify:store-boundaries`, `npm run verify:cycles` exit 0.
  Commit: `Splits: store-actie setTaskSplits als tijdbasis-bewerking`.

### Task 7: Nivelleerder knipt geen taak met eigen pauzes op

**Files:** Modify `src/engine/scheduler/ResourceLeveler.ts` (scatter-pad ~regel 690–700 en de plek
waar besloten wordt óf er gescatterd mag worden); Test: bestaande nivelleer-check uitbreiden
(`grep -ln "scatter\|allowSplit" tests/planning/check-*.ts tests/library/*.ts`).

- [ ] **Stap 1 — falende test:** scenario uit de bestaande scatter-test, maar de taak draagt al
  `splitGaps: [{ afterMinutes: 480, gapMinutes: 480, source: 'user' }]` ⇒ verwacht: géén nieuw
  `'leveling'`-gat op die taak (wel eventueel een `levelingDelay`), en het gebruikersgat ongewijzigd.
- [ ] **Stap 3 — implementeer:** één predicaat
  `const hasOwnGaps = (t: Task) => (t.splitGaps ?? []).some(g => g.source !== 'leveling');` en de
  scatter-tak overslaan wanneer het waar is, met een commentaarregel die naar spec-bevinding 8
  verwijst (de scatter-as kent bestaande gaten niet).
- [ ] **Stap 4 — groen:** `npm run test:planning` en `npm run test:library` exit 0.
  Commit: `Nivelleerder: taak met eigen onderbrekingen wordt niet opgeknipt`.

### Task 8: Afsluiting etappe 1

- [ ] `npm run typecheck && npm run lint && npm run test:planning && npm run test:library && npm run test:mcp`
  — elk op exitcode. (Volledige `npm run verify` pas aan het eind van etappe 5, en nooit parallel.)
- [ ] Dev-only brug: controleer dat `window.__OPS__.store.getState().setTaskSplits` bereikbaar is
  (de brug geeft de hele store door — geen wijziging verwacht; alleen verifiëren in `devBridge.ts`).
- [ ] Push de branch fast-forward naar de remote feature-branch (nooit `main`).
- [ ] Schrijf het plan voor etappe 2 (`2026-09-21-taken-splitsen-etappe2-splitsmodus.md`).

---

## Zelfcontrole tegen de spec

Gedekt in dit plan: bevinding 1 (T6.5), 2a (T5), 2b (T4), 3 (T2/T4), 4 (fixtures T2), 6/7 (T1, T3,
T6), 8 (T7), 13 (T6.6), 15 (T4), 16 (T3). Bewust in latere plannen: 5 (exportmelding, etappe 5),
9/10-gebaar, 12, 14, 17 (etappe 2/3), 11 (etappe 5), paneel (etappe 4), rooktests print/rapport
(etappe 5).
