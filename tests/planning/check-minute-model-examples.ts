// Voorbeeldensnapshot van fase F0 van "alleen uren" (spec docs/superpowers/specs/2026-10-20-alleen-uren-design.md
// §6.3). Per IFC-voorbeeld van vóór het minutenmodel (`fixtures/minute-model-examples-f0/`, de vroegere
// `examples/`) staat in `fixtures/minute-model-examples.json` van elke taak de
// vroege en late start, het vroege en late einde en de speling na Bereken, met de motor van vandaag.
// F2 en F3 moeten die snapshot halen op dagniveau.
//
// Vergelijken op dagniveau, zoals de minutenmodel-runs van de harness: de datum uit de snapshot gaat
// door de regel van zijn veld (D1–D7, D3 voor kalendertijd; `normalizeTaskDate`), daarna vergelijkt de
// werkdag van een moment (`workdayOfInstant`) beide kanten in de klok van de taak. Zolang de motor
// datums zonder tijd geeft (F0), is dat hetzelfde als exact vergelijken. Speling met 10⁻⁶.
//
// Bijwerken (alleen na een bewuste wijziging, met de reden in de commit):
//   OPS_MINUTE_MODEL_EXAMPLES_UPDATE=1 bash tests/planning/run.sh check-minute-model-examples.ts
// Een nieuw of verwijderd voorbeeld is ook rood, totdat de snapshot is bijgewerkt.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { payloadFromImport } from '@/state/documentContract';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import { readIFC } from '@/services/ifc/ifcReader';
import { useAppStore } from '@/state/appStore';
import {
  DayClockCache, normalizeTaskDate, taskDateContext, taskDateFieldSide, type TaskDateContext, type TaskDateField,
} from '@/state/migrations/minuteModel';
import { workdayOfInstant, isDateOnly } from '@/engine/calendar/workdayRules';
import type { Task } from '@/types/task';

const HERE = fileURLToPath(new URL('.', import.meta.url));
// De voorbeelden zoals ze vóór het minutenmodel waren (zonder `OPS_Project.TimeModel`), vastgezet als
// fixture. Sinds de voorbeelden in het minutenmodel opnieuw gegenereerd zijn (zodat ze schoon openen,
// knownbug 35), toetst deze check hier nog steeds wat hij moet toetsen: een oud bestand gaat door de
// migratie op de laadgrens en haalt de F0-snapshot op dagniveau. Niet bijwerken met `gen:examples`.
const EX_DIR = join(HERE, 'fixtures', 'minute-model-examples-f0');
const SNAPSHOT = join(HERE, 'fixtures', 'minute-model-examples.json');
const UPDATE = process.env.OPS_MINUTE_MODEL_EXAMPLES_UPDATE === '1';
const S = () => useAppStore.getState();

interface TaskSnap { es: string; ef: string; ls: string; lf: string; tf: number }
interface Snapshot { toelichting: string; examples: Record<string, Record<string, TaskSnap>> }

const FIELDS = [
  ['es', 'earlyStart'], ['ef', 'earlyFinish'], ['ls', 'lateStart'], ['lf', 'lateFinish'],
] as const satisfies ReadonlyArray<readonly [keyof Omit<TaskSnap, 'tf'>, TaskDateField & keyof Task['time']]>;

/** Sleutel van een taak in de snapshot: WBS-code plus naam. Uniek binnen een voorbeeld (gecontroleerd). */
const taskKey = (t: Task): string => `${t.wbsCode ?? ''} ${t.name}`.trim();

function sameWorkday(got: string, want: string, field: TaskDateField, ctx: TaskDateContext): boolean {
  if (!isDateOnly(want)) return got === want;
  const side = taskDateFieldSide(field);
  const w = normalizeTaskDate(want, field, ctx) ?? want;
  const g = normalizeTaskDate(got, field, ctx) ?? got;
  return workdayOfInstant(ctx.clock, w, side) === workdayOfInstant(ctx.clock, g, side);
}

/** Vaste vorm: één regel per taak, zodat een wijziging in de diff per taak leesbaar blijft. */
function formatSnapshot(snap: Snapshot): string {
  const lines = ['{', `  "toelichting": ${JSON.stringify(snap.toelichting)},`, '  "examples": {'];
  const names = Object.keys(snap.examples);
  names.forEach((name, i) => {
    lines.push(`    ${JSON.stringify(name)}: {`);
    const entries = Object.entries(snap.examples[name]);
    entries.forEach(([key, v], j) => {
      const row = `{ "es": ${JSON.stringify(v.es)}, "ef": ${JSON.stringify(v.ef)}, "ls": ${JSON.stringify(v.ls)}, `
        + `"lf": ${JSON.stringify(v.lf)}, "tf": ${JSON.stringify(v.tf)} }`;
      lines.push(`      ${JSON.stringify(key)}: ${row}${j < entries.length - 1 ? ',' : ''}`);
    });
    lines.push(`    }${i < names.length - 1 ? ',' : ''}`);
  });
  lines.push('  }', '}', '');
  return lines.join('\n');
}

const failures: string[] = [];
let compared = 0;
const now: Snapshot['examples'] = {};
let pinned: Snapshot | null = null;
try {
  pinned = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Snapshot;
} catch {
  if (!UPDATE) failures.push(`snapshot ${SNAPSHOT} ontbreekt of is geen JSON`);
}

const files = readdirSync(EX_DIR).filter((f) => f.endsWith('.ifc')).sort();
if (files.length === 0) failures.push(`geen IFC-voorbeelden gevonden in ${EX_DIR}`);
for (const file of files) {
  const name = file.replace(/\.ifc$/, '');
  const parsed = readIFC(readFileSync(join(EX_DIR, file), 'utf8'));
  // Zoals scripts/verify-examples.ts: het bestand in de echte store laden en Bereken.
  S().loadState(parsed);
  S().runCPM();
  const tasks = S().tasks;
  const snap: Record<string, TaskSnap> = {};
  for (const t of tasks) {
    const key = taskKey(t);
    if (snap[key]) failures.push(`${name}: taaksleutel "${key}" is niet uniek`);
    snap[key] = { es: t.time.earlyStart, ef: t.time.earlyFinish, ls: t.time.lateStart, lf: t.time.lateFinish, tf: t.time.totalFloat };
  }
  now[name] = snap;
  if (UPDATE || !pinned) continue;

  const want = pinned.examples[name];
  if (!want) {
    failures.push(`${name}: ontbreekt in de snapshot`);
    continue;
  }
  const clocks = new DayClockCache(S().calendar, S().calendars);
  for (const t of tasks) {
    const key = taskKey(t);
    const w = want[key];
    if (!w) {
      failures.push(`${name} / ${key}: taak ontbreekt in de snapshot`);
      continue;
    }
    const ctx = taskDateContext(t, clocks);
    for (const [k, field] of FIELDS) {
      compared++;
      const got = t.time[field];
      if (typeof got !== 'string' || !sameWorkday(got, w[k], field, ctx)) {
        failures.push(`${name} / ${key}.${k}: verwacht ${w[k]}, kreeg ${String(got)}`);
      }
    }
    compared++;
    if (!(Math.abs(t.time.totalFloat - w.tf) <= 1e-6)) failures.push(`${name} / ${key}.tf: verwacht ${w.tf}, kreeg ${t.time.totalFloat}`);
  }
  for (const key of Object.keys(want)) {
    if (!snap[key]) failures.push(`${name} / ${key}: staat in de snapshot, maar niet meer in het voorbeeld`);
  }
}
if (pinned && !UPDATE) {
  for (const name of Object.keys(pinned.examples)) {
    if (!now[name]) failures.push(`${name}: staat in de snapshot, maar het voorbeeld bestaat niet meer`);
  }
}

if (UPDATE) {
  const out: Snapshot = {
    toelichting: 'Voorbeeldensnapshot van fase F0 (spec 2026-10-20-alleen-uren-design.md §6.3): per voorbeeld per taak '
      + '(WBS-code plus naam) es, ef, ls, lf en tf na Bereken, met de motor van F0. Gebruikt door '
      + 'check-minute-model-examples.ts; bijwerken staat in tests/planning/README.md.',
    examples: now,
  };
  writeFileSync(SNAPSHOT, formatSnapshot(out));
  const n = Object.values(now).reduce((a, s) => a + Object.keys(s).length, 0);
  console.log(`OK  voorbeeldensnapshot bijgewerkt: ${files.length} voorbeelden, ${n} taken.`);
}

// Exacte dagenmaat-momenten (§3.14) die de snapshot hierboven sinds F3c ook bevat. De dagen zijn per
// kalender even lang; de bestaande urenloper toetst de doelen hier onafhankelijk van de dagenmaat.
const f3Goals = [
  ["05-brugvervanging-n279", "3.1", "2027-03-17T08:36", "2027-03-31T08:36"],
  ["08-zorgcentrum-de-linde", "3.1", "2027-03-15T14:24", "2027-04-02T14:24"],
  ["10-villa-wassenaar", "3.1", "2027-03-09T08:36", "2027-03-25T08:36"],
  ["18-station-uitbreiding-breda", "3.1", "2027-03-22T14:24", "2027-04-02T14:24"],
  ["20-woonwijk-almere", "3.1", "2027-04-02T08:36", "2027-04-14T08:36"],
  ["20-woonwijk-almere", "3.2", "2027-04-07T08:36", "2027-04-19T08:36"],
  ["showcase-rijwoningen-de-akkers", "6.4", "2027-06-10T08:36", "2027-06-16T08:36"],
] as const;
for (const file of new Set(f3Goals.map(g => g[0]))) {
  const payload = payloadFromImport(readIFC(readFileSync(join(EX_DIR, `${file}.ifc`), 'utf8')), null);
  const tasks = payload.tasks.map(task => {
    if (task.time.durationUnit !== 'days' || task.isMilestone || task.childIds.length > 0) return task;
    const cal = effectiveCalendarOf(task, payload.calendar, payload.calendars);
    if (cal.workTime || cal.workingExceptions?.length) failures.push(`${file}: F3-referentie vereist gelijke werkdagen`);
    const minutesPerDay = task.time.durationType === 'ELAPSEDTIME' ? 1440 : effHoursPerDay(cal) * 60;
    return { ...task, time: { ...task.time, durationUnit: 'hours' as const,
      durationMinutes: Math.round(task.time.scheduleDuration * minutesPerDay),
    } };
  });
  const result = solveProject(solveInputFor(payload.project, tasks, payload.sequences, payload.calendar, payload.calendars));
  if (result.error) failures.push(`${file}: F3-referentie kan niet berekenen: ${result.error}`);
  for (const [, key, start, finish] of f3Goals.filter(g => g[0] === file)) {
    const t = tasks.find(task => task.wbsCode === key)?.time;
    if (t?.earlyStart !== start || t?.earlyFinish !== finish) failures.push(`${file}/${key}: F3-referentie ${t?.earlyStart} – ${t?.earlyFinish} ≠ ${start} – ${finish}`);
  }
}

if (failures.length > 0) {
  for (const f of failures.slice(0, 50)) console.log(`XX ${f}`);
  if (failures.length > 50) console.log(`XX … en nog ${failures.length - 50} afwijkingen`);
  console.log(`\n${failures.length} afwijking(en) van de voorbeeldensnapshot.`);
  process.exitCode = 1;
} else if (!UPDATE) {
  console.log(`OK  voorbeeldensnapshot: ${files.length} voorbeelden, ${compared} waarden gelijk op dagniveau; ${f3Goals.length} exacte F3-doelen getoetst.`);
}
