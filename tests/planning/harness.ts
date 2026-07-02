// Datagestuurd testharnas voor de ECHTE store + rekenmotor (headless).
// Voert testgevallen (JSON) uit via de echte acties en vergelijkt actueel vs. verwacht.
//
// Gebruik:  node harness.mjs <cases.json>
// cases.json = { cases: Case[] }  (zie type Case hieronder)
//
// Case = {
//   id, title,
//   calendar?: { workDays?: number[], holidays?: {name,startDate,endDate}[] }  // default: SCHOON (ma-vr, geen feestdagen)
//   anchor?: "YYYY-MM-DD"   // startdatum voor wortel-taken (default 2026-06-01)
//   tasks: [{ name, dur?, start?, milestone? }]      // dur in werkdagen (default 1); milestone => duur 0
//   links: [{ pred, succ, type, lag?, lagUnit?, lagPercent? }]
//     type: FINISH_START|START_START|FINISH_FINISH|START_FINISH
//     lag in dagen (default 0, negatief = lead); lagUnit: WORKTIME (default) | ELAPSEDTIME (kalenderdagen);
//     lagPercent: % van de voorgangerduur (overstemt lag)
//   expect: {
//     tasks?: { [name]: { es?,ef?,ls?,lf?,tf?,ff?,crit? } },   // datums "YYYY-MM-DD"; tf/ff getallen; crit boolean
//     criticalPathSet?: [names],   // vergeleken als verzameling (volgorde-onafhankelijk)
//     drivingSet?: [[pred,succ,type]],  // welke relaties driving zijn (verzameling van triples)
//     projectEnd?, projectDuration?,
//     error?: boolean | string     // true => verwacht een fout; string => substring in de foutmelding
//   }
// }
import { useAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/types/task';
import { readFileSync } from 'node:fs';

const S = () => useAppStore.getState();
const CLEAN_WORKDAYS = [1, 2, 3, 4, 5];

type Cal = { workDays?: number[]; holidays?: { name: string; startDate: string; endDate: string }[] };
interface Case {
  id: string; title: string;
  calendar?: Cal; anchor?: string;
  tasks: { name: string; dur?: number; start?: string; milestone?: boolean; parent?: string }[];
  links?: { pred: string; succ: string; type: string; lag?: number; lagUnit?: string; lagPercent?: number }[];
  expect: any;
}

function buildAndSolve(c: Case) {
  S().newProject();
  // Kalender: schoon tenzij expliciet opgegeven.
  const base = S().calendar;
  S().setCalendar({
    ...base,
    workDays: c.calendar?.workDays ?? CLEAN_WORKDAYS,
    holidays: c.calendar?.holidays ?? [],
  } as any);
  const anchor = c.anchor ?? '2026-06-01';
  S().setProject({ startDate: anchor });

  const ids: Record<string, string> = {};
  for (const t of c.tasks) {
    // Luide fouten i.p.v. stille maskering: dubbele namen (de naam is de enige sleutel in
    // ids/expect/criticalPathSet), en een ouder die nog niet bestaat (anders wordt het kind
    // stil een root, met een heel andere topologie maar zonder waarschuwing).
    if (ids[t.name]) throw new Error(`dubbele taaknaam "${t.name}"`);
    if (t.parent && !ids[t.parent]) {
      throw new Error(`taak "${t.name}": ouder "${t.parent}" nog niet gedefinieerd — zet de ouder eerder in de tasks-lijst`);
    }
    const start = t.start ?? anchor;
    const dur = t.milestone ? 0 : (t.dur ?? 1);
    const id = S().addTask({
      name: t.name,
      isMilestone: !!t.milestone,
      parentId: t.parent ? ids[t.parent] : null,
      time: createDefaultTaskTime(start, dur),
    });
    ids[t.name] = id;
  }
  for (const l of c.links ?? []) {
    if (!ids[l.pred]) throw new Error(`relatie: onbekende voorganger "${l.pred}"`);
    if (!ids[l.succ]) throw new Error(`relatie: onbekende opvolger "${l.succ}"`);
    S().addSequence({
      predecessorId: ids[l.pred], successorId: ids[l.succ], type: l.type as any,
      lagDays: l.lag ?? 0,
      ...(l.lagUnit !== undefined ? { lagUnit: l.lagUnit as any } : {}),
      ...(l.lagPercent !== undefined ? { lagPercent: l.lagPercent } : {}),
    });
  }
  S().runCPM();
  return ids;
}

function readTask(name: string, ids: Record<string, string>) {
  const t = S().tasks.find(x => x.id === ids[name]);
  if (!t) return null;
  return {
    es: t.time.earlyStart, ef: t.time.earlyFinish,
    ls: t.time.lateStart, lf: t.time.lateFinish,
    tf: t.time.totalFloat, ff: t.time.freeFloat, crit: t.time.isCritical,
  };
}

const KEYMAP: Record<string, string> = { es: 'es', ef: 'ef', ls: 'ls', lf: 'lf', tf: 'tf', ff: 'ff', crit: 'crit' };

function runCase(c: Case) {
  const diffs: string[] = [];
  let ids: Record<string, string> = {};
  try {
    ids = buildAndSolve(c);
  } catch (e) {
    return { id: c.id, title: c.title, pass: false, diffs: [`THREW: ${String(e)}`] };
  }
  const cpm = S().cpmResult;
  const exp = c.expect ?? {};

  // Fout-verwachting
  if (exp.error !== undefined) {
    const gotErr = cpm?.error ?? '';
    if (exp.error === true && !gotErr) diffs.push(`error: verwacht een fout, kreeg geen`);
    if (exp.error === false && gotErr) diffs.push(`error: verwacht geen fout, kreeg "${gotErr}"`);
    if (typeof exp.error === 'string' && !gotErr.includes(exp.error)) diffs.push(`error: verwacht substring "${exp.error}", kreeg "${gotErr}"`);
  }

  // Per-taak velden
  if (exp.tasks) {
    for (const [name, want] of Object.entries<any>(exp.tasks)) {
      const got = readTask(name, ids);
      if (!got) { diffs.push(`taak "${name}" niet gevonden`); continue; }
      for (const [k, wv] of Object.entries<any>(want)) {
        const gk = KEYMAP[k] ?? k;
        const gv = (got as any)[gk];
        if (gv !== wv) diffs.push(`${name}.${k}: verwacht ${JSON.stringify(wv)}, kreeg ${JSON.stringify(gv)}`);
      }
    }
  }

  // Driving relaties als verzameling van [voorganger, opvolger, type]-triples
  if (exp.drivingSet) {
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const seqById = new Map(S().sequences.map(q => [q.id, q]));
    const got = ((cpm as any)?.drivingSequenceIds ?? [])
      .map((sid: string) => {
        const q = seqById.get(sid);
        return q ? `${idToName[q.predecessorId] ?? q.predecessorId}|${idToName[q.successorId] ?? q.successorId}|${q.type}` : '?';
      })
      .sort();
    const want = [...exp.drivingSet].map((t: string[]) => t.join('|')).sort();
    if (JSON.stringify(got) !== JSON.stringify(want))
      diffs.push(`drivingSet: verwacht {${want.join(', ')}}, kreeg {${got.join(', ')}}`);
  }

  // Kritiek pad als verzameling (namen)
  if (exp.criticalPathSet) {
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const gotNames = (cpm?.criticalPath ?? []).map(i => idToName[i] ?? i).sort();
    const wantNames = [...exp.criticalPathSet].sort();
    if (JSON.stringify(gotNames) !== JSON.stringify(wantNames))
      diffs.push(`criticalPath: verwacht {${wantNames.join(',')}}, kreeg {${gotNames.join(',')}}`);
  }

  if (exp.projectEnd !== undefined && cpm?.projectEnd !== exp.projectEnd)
    diffs.push(`projectEnd: verwacht ${exp.projectEnd}, kreeg ${cpm?.projectEnd}`);
  if (exp.projectDuration !== undefined && cpm?.projectDuration !== exp.projectDuration)
    diffs.push(`projectDuration: verwacht ${exp.projectDuration}, kreeg ${cpm?.projectDuration}`);

  return { id: c.id, title: c.title, pass: diffs.length === 0, diffs };
}

const files = process.argv.slice(2);
let grandPass = 0;
let grandTotal = 0;
let anyFail = false;
for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const cases: Case[] = data.cases ?? [];
  const name = file.replace(/^.*\/cases-/, '').replace(/\.json$/, '');
  // Een leeg/sleutelloos casusbestand mag niet stil als "0/0 groen" passeren.
  if (cases.length === 0) {
    console.log(`XX ${name}: GEEN cases (leeg of ontbrekende "cases"-sleutel)`);
    anyFail = true;
    continue;
  }
  const results = cases.map(runCase);
  const passed = results.filter((r) => r.pass).length;
  grandPass += passed;
  grandTotal += results.length;
  const ok = passed === results.length;
  if (!ok) anyFail = true;
  console.log(`${ok ? 'OK ' : 'XX '} ${name}: ${passed}/${results.length}`);
  for (const r of results) {
    if (r.pass) continue;
    console.log(`   x [${r.id}] ${r.title}`);
    for (const d of r.diffs) console.log(`       - ${d}`);
  }
}
console.log(`\nTOTAAL: ${grandPass}/${grandTotal}${anyFail ? '  (FALEN)' : '  (alles groen)'}`);
process.exit(anyFail ? 1 : 0);
