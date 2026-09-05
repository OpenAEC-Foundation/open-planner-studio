// check-work-triangle.ts — de meetlat van de taaktypes-etappe (ontwerp 2026-09-04 §9) tegen de
// pure rekenkern `src/engine/work/workTriangle.ts` (bouwstap 3). Twee lagen:
//   (a) `work-triangle-cases.json`: de 31 genummerde bewerkingen uit de spec als data — per case
//       een resterende toestand, één of meer bewerkingen en de verwachte uitkomst, met het
//       bewijslabel (documented/reasoned/decided/measured). Cases met `scope: 'store'` (contour,
//       undo) horen bij de bedrading en worden hier geteld maar overgeslagen.
//   (b) eigenschappen die geen enkele case apart toetst: "afwezig ⇒ afgeleid" blijft afwezig onder
//       de inzetbeschermende regels, de typewissel verandert geen getal, weigeringen laten de
//       toestand onaangeraakt, materiaal telt nergens mee, en de afronding gaat naar boven.
//
// Draait via run.sh (esbuild-bundel, Node). Exit 0 = groen. Geen store: alles is puur.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  applyAssignmentAdded, applyAssignmentRemoved, applyDurationEdit, applyRuleChange, applyTaskWorkEdit,
  applyUnitsEdit, applyWorkEdit, remainingWorkOf, roundUpRemaining,
  type TriangleAssignment, type TriangleResult, type TriangleState,
} from '@/engine/work/workTriangle';
import { WORK_RULES, type WorkRule } from '@/types/workRule';

declare const process: { exit(code: number): never };

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function near(label: string, actual: number | undefined, expected: number | undefined, tol = 0.005): void {
  checks++;
  if (actual === undefined || expected === undefined) {
    if (actual !== expected) diffs.push(`${label}: kreeg ${String(actual)}, verwacht ${String(expected)}`);
    return;
  }
  if (Math.abs(actual - expected) > tol) diffs.push(`${label}: kreeg ${actual}, verwacht ${expected}`);
}

// ── (a) de meetlat als data ─────────────────────────────────────────────────────────────────────

interface CaseAssignment { id: string; units: number; hours?: number; material?: boolean }
interface CaseState {
  rule: WorkRule; effortDriven?: boolean; days?: number; minutes?: number; hoursPerDay?: number;
  wholeDays?: boolean; assignments: CaseAssignment[];
}
interface ExpectAssignment { units?: number; hours?: number | null; derivedHours?: number }
interface Expect { days?: number; minutes?: number; assignments?: Record<string, ExpectAssignment>; rejected?: string }
type Edit =
  | { kind: 'duration'; days?: number; minutes?: number }
  | { kind: 'units'; id: string; units: number }
  | { kind: 'work'; id: string; hours: number }
  | { kind: 'taskWork'; hours: number }
  | { kind: 'add'; id: string; units: number; material?: boolean }
  | { kind: 'remove'; id: string }
  | { kind: 'rule'; rule: WorkRule }
  | ({ kind: 'check' } & Expect);
interface Case {
  id: string; nr: number; evidence: 'documented' | 'reasoned' | 'decided' | 'measured'; source: string;
  scope?: 'store'; state?: CaseState; edits?: Edit[]; expect?: Expect;
}

const here = dirname(fileURLToPath(import.meta.url));
const file = JSON.parse(readFileSync(join(here, 'work-triangle-cases.json'), 'utf8')) as { cases: Case[] };

function toState(c: CaseState): TriangleState {
  const hpd = c.hoursPerDay ?? 8;
  const slotMinutes = hpd * 60;
  const remainingMinutes = c.minutes ?? (c.days ?? 0) * slotMinutes;
  return {
    rule: c.rule,
    effortDriven: c.effortDriven,
    remainingMinutes,
    slotMinutes,
    wholeDays: c.wholeDays ?? c.minutes === undefined,
    assignments: c.assignments.map((a): TriangleAssignment => ({
      id: a.id,
      unitsPerDay: a.units,
      drivesDuration: !a.material,
      ...(a.hours !== undefined ? { remainingWorkMinutes: a.hours * 60 } : {}),
    })),
  };
}

function apply(state: TriangleState, e: Edit): TriangleResult {
  switch (e.kind) {
    case 'duration': return applyDurationEdit(state, e.minutes ?? (e.days ?? 0) * state.slotMinutes);
    case 'units': return applyUnitsEdit(state, e.id, e.units);
    case 'work': return applyWorkEdit(state, e.id, e.hours * 60);
    case 'taskWork': return applyTaskWorkEdit(state, e.hours * 60);
    case 'add': return applyAssignmentAdded(state, { id: e.id, unitsPerDay: e.units, drivesDuration: !e.material });
    case 'remove': return applyAssignmentRemoved(state, e.id);
    case 'rule': return applyRuleChange(state, e.rule);
    case 'check': return { ok: true, state };
  }
}

function assertExpect(label: string, state: TriangleState, x: Expect): void {
  if (x.days !== undefined) near(`${label}: restduur (dagen)`, state.remainingMinutes / state.slotMinutes, x.days);
  if (x.minutes !== undefined) near(`${label}: restduur (minuten)`, state.remainingMinutes, x.minutes);
  if (!x.assignments) return;
  ok(`${label}: aantal toewijzingen`, state.assignments.length === Object.keys(x.assignments).length);
  for (const [id, ex] of Object.entries(x.assignments)) {
    const a = state.assignments.find((s) => s.id === id);
    ok(`${label}: toewijzing ${id} aanwezig`, !!a);
    if (!a) continue;
    if (ex.units !== undefined) near(`${label}: ${id} inzet`, a.unitsPerDay, ex.units, 0.0005);
    if (ex.hours === null) ok(`${label}: ${id} werkveld afwezig (afgeleid)`, a.remainingWorkMinutes === undefined);
    else if (ex.hours !== undefined) near(`${label}: ${id} restwerk (u)`, (a.remainingWorkMinutes ?? Number.NaN) / 60, ex.hours);
    if (ex.derivedHours !== undefined) near(`${label}: ${id} afgeleid werk (u)`, remainingWorkOf(a, state.remainingMinutes) / 60, ex.derivedHours);
  }
}

const evidenceCount: Record<string, number> = {};
let storeScoped = 0;
for (const c of file.cases) {
  evidenceCount[c.evidence] = (evidenceCount[c.evidence] ?? 0) + 1;
  if (c.scope === 'store') { storeScoped++; continue; }
  if (!c.state || !c.edits || !c.expect) { diffs.push(`${c.id}: onvolledige case (state/edits/expect)`); continue; }
  let state = toState(c.state);
  let rejected: string | undefined;
  for (const e of c.edits) {
    if (e.kind === 'check') { assertExpect(`${c.id} (tussenstand)`, state, e); continue; }
    const r = apply(state, e);
    if (!r.ok) { rejected = r.reason; break; }
    state = r.state;
  }
  if (c.expect.rejected !== undefined) {
    ok(`${c.id}: verwacht weigering ${c.expect.rejected}, kreeg ${rejected ?? 'geen'}`, rejected === c.expect.rejected);
    continue;
  }
  if (rejected) { diffs.push(`${c.id}: onverwacht geweigerd (${rejected})`); continue; }
  assertExpect(c.id, state, c.expect);
}
ok('meetlat: 31 genummerde bewerkingen aanwezig', new Set(file.cases.map((c) => c.nr)).size === 31);
ok('meetlat: geen enkele case is al gemeten (measured) — anders hoort de spec bijgewerkt', (evidenceCount.measured ?? 0) === 0);

// ── (b) eigenschappen ───────────────────────────────────────────────────────────────────────────

const base: TriangleState = {
  rule: 'FIXED_DURATION_RATE', remainingMinutes: 2400, slotMinutes: 480, wholeDays: true,
  assignments: [{ id: 'a', unitsPerDay: 1, drivesDuration: true }, { id: 'b', unitsPerDay: 0.5, drivesDuration: true }],
};

// Afwezig blijft afwezig onder de regels van vandaag: geen enkel veld wordt geschreven.
for (const rule of ['FIXED_DURATION_RATE', 'FIXED_RATE'] as const) {
  const s = { ...base, rule };
  const r1 = applyDurationEdit(s, 4800);
  ok(`${rule}: duurwijziging schrijft geen werkveld`, r1.ok && r1.state.assignments.every((a) => a.remainingWorkMinutes === undefined));
  const r2 = applyUnitsEdit(s, 'b', 1);
  ok(`${rule}: inzetwijziging laat het werkveld van de ANDERE toewijzing afwezig`, r2.ok && r2.state.assignments.find((a) => a.id === 'a')?.remainingWorkMinutes === undefined);
}
// FIXED_DURATION_RATE is byte-identiek aan vandaag: inzet gewijzigd ⇒ duur blijft.
{
  const r = applyUnitsEdit(base, 'b', 2);
  ok('FIXED_DURATION_RATE: inzet gewijzigd ⇒ restduur ongewijzigd', r.ok && r.state.remainingMinutes === 2400);
}
// Typewissel verandert geen getal, in alle 16 richtingen; naar een werkbeschermende regel legt hij het werk vast.
for (const from of WORK_RULES) {
  for (const to of WORK_RULES) {
    const r = applyRuleChange({ ...base, rule: from }, to);
    ok(`typewissel ${from}→${to}: duur en inzet ongewijzigd`, r.ok && r.state.remainingMinutes === 2400
      && r.state.assignments.every((a, i) => a.unitsPerDay === base.assignments[i].unitsPerDay)
      && r.state.rule === to);
    const fixed = to === 'FIXED_WORK' || to === 'FIXED_DURATION_WORK';
    ok(`typewissel ${from}→${to}: werk ${fixed ? 'vastgelegd' : 'blijft afgeleid'}`, r.ok && r.state.assignments.every((a) =>
      (a.remainingWorkMinutes !== undefined) === fixed));
  }
}
// Weigeringen laten de invoer onaangeraakt en noemen de reden.
{
  const s = { ...base, rule: 'FIXED_WORK' as const };
  ok('weigering: duur 0', !applyDurationEdit(s, 0).ok);
  ok('weigering: duur NaN', !applyDurationEdit(s, Number.NaN).ok);
  ok('weigering: werk 0', !applyWorkEdit(s, 'a', 0).ok);
  ok('weigering: onbekende toewijzing', (() => { const r = applyUnitsEdit(s, 'zz', 1); return !r.ok && r.reason === 'unknown-assignment'; })());
  ok('weigering: dubbele toewijzing', (() => { const r = applyAssignmentAdded(s, { id: 'a', unitsPerDay: 1 }); return !r.ok && r.reason === 'duplicate-assignment'; })());
  ok('weigering: toewijzing erbij met inzet 0', !applyAssignmentAdded(s, { id: 'c', unitsPerDay: 0 }).ok);
  ok('weigering: invoer onaangeraakt', s.assignments[0].remainingWorkMinutes === undefined && s.remainingMinutes === 2400);
}
// Materiaal: telt nergens mee — ook niet als enige "resource" (dan is er geen werkresource, dus geen regel).
{
  const s: TriangleState = { ...base, rule: 'FIXED_WORK', assignments: [{ id: 'm', unitsPerDay: 100, drivesDuration: false }] };
  const r1 = applyDurationEdit(s, 4800);
  ok('materiaal: duurwijziging laat materiaal met rust', r1.ok && r1.state.assignments[0].unitsPerDay === 100 && r1.state.assignments[0].remainingWorkMinutes === undefined);
  const r2 = applyAssignmentAdded(s, { id: 'a', unitsPerDay: 1 });
  ok('materiaal: eerste werkresource erbij ⇒ afgeleid werk, duur ongewijzigd', r2.ok && r2.state.remainingMinutes === 2400 && r2.state.assignments[1].remainingWorkMinutes === undefined);
  const r3 = applyUnitsEdit({ ...s, rule: 'FIXED_WORK' }, 'm', 50);
  ok('materiaal: hoeveelheid wijzigen raakt de duur niet', r3.ok && r3.state.remainingMinutes === 2400 && r3.state.assignments[0].unitsPerDay === 50);
}
// Taakniveau-werk: naar rato van bestaand restwerk (regel §6.2), daarna per regel.
{
  const s: TriangleState = { ...base, rule: 'FIXED_DURATION_RATE', assignments: [
    { id: 'a', unitsPerDay: 1, drivesDuration: true, remainingWorkMinutes: 2400 },
    { id: 'b', unitsPerDay: 0.5, drivesDuration: true, remainingWorkMinutes: 1200 },
  ] };
  const r = applyTaskWorkEdit(s, 7200);
  ok('taakwerk (duur vast): 120 u verdeeld 80/40 ⇒ inzet 2,0 en 1,0', r.ok && r.state.remainingMinutes === 2400
    && Math.abs(r.state.assignments[0].unitsPerDay - 2) < 1e-9 && Math.abs(r.state.assignments[1].unitsPerDay - 1) < 1e-9);
  const r2 = applyTaskWorkEdit({ ...s, rule: 'FIXED_WORK' }, 7200);
  ok('taakwerk (werk vast): 120 u verdeeld 80/40 ⇒ R = max(80/8, 40/4) = 10 d', r2.ok && r2.state.remainingMinutes === 4800
    && r2.state.assignments.every((a) => Math.abs(a.unitsPerDay - (a.id === 'a' ? 1 : 0.5)) < 1e-9));
}
// Afronding: naar boven, nooit onder één slot; uurmodus op hele minuten.
near('afronding: 2,5 d → 3 d', roundUpRemaining(1200, base), 1440, 0);
near('afronding: precies 3 d blijft 3 d', roundUpRemaining(1440, base), 1440, 0);
near('afronding: 3 d + drijvende-kommaruis blijft 3 d', roundUpRemaining(1440 + 1e-10, base), 1440, 0);
near('afronding: minimaal één slot', roundUpRemaining(1, base), 480, 0);
near('afronding: uurmodus 100,2 min → 101', roundUpRemaining(100.2, { slotMinutes: 480, wholeDays: false }), 101, 0);
// Werk vast + inzet vast tegelijk kan niet: FIXED_RATE met twee toewijzingen — de andere houdt haar inzet en
// haar (afgeleide) werk groeit met de langere duur (§6.2, beslispunt 10).
{
  const s: TriangleState = { ...base, rule: 'FIXED_RATE' };
  const r = applyUnitsEdit(s, 'a', 0.5);
  ok('FIXED_RATE, twee toewijzingen: R = max(40/4, 20/4) = 10 d, b houdt inzet 0,5', r.ok && r.state.remainingMinutes === 4800
    && r.state.assignments[1].unitsPerDay === 0.5 && r.state.assignments[1].remainingWorkMinutes === undefined);
}

// ── Uitslag ─────────────────────────────────────────────────────────────────────────────────────

const label = `check-work-triangle: ${checks} checks; meetlat ${file.cases.length} cases (${Object.entries(evidenceCount).map(([k, v]) => `${k} ${v}`).join(', ')}; ${storeScoped} store-scoped overgeslagen)`;
if (diffs.length > 0) {
  console.log(`XX  ${label} — ${diffs.length} afwijking(en):`);
  for (const d of diffs) console.log(`    ${d}`);
  process.exit(1);
}
console.log(`OK  ${label}`);
