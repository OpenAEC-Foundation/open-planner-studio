import { produce } from 'immer';
import { latestAppliedDocumentDataDelta } from '@/state/sessionHistory';
import './domStub';
import { useAppStore } from '@/state/appStore';
import { createSnapshot, type Snapshot } from '@/state/snapshot';
import { withTransaction } from '@/state/batchTransaction';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const truthy = (label: string, got: boolean) => {
  checks++;
  if (!got) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

function vervangen(voor: readonly { id: string }[], na: readonly { id: string }[]): string[] {
  const naById = new Map(na.map(t => [t.id, t]));
  const uit: string[] = [];
  for (const t of voor) {
    const n = naById.get(t.id);
    if (n && n !== t) uit.push(t.id);
  }
  return uit;
}

S().newProject();
const ids: string[] = [];
for (let i = 0; i < 20; i++) ids.push(S().addTask({ name: `T${i}` }));
S().runCPM();

{
  const voor = S().tasks;
  S().addTask({ name: 'nieuw achteraan' });
  const geraakt = vervangen(voor, S().tasks);
  eq('1 addTask vervangt geen bestaande taak', geraakt, []);
  eq('1a de nieuwe taak staat er echt bij', S().tasks.length, 21);
  eq('1b en heeft de volgende WBS-code', S().tasks[20]?.wbsCode, '21');
}

{
  const voor = S().tasks;
  S().updateTask(ids[3], { name: 'hernoemd' });
  eq('2 updateTask vervangt alleen de bewerkte taak', vervangen(voor, S().tasks), [ids[3]]);
}

{
  const voor = S().tasks;
  S().addSequence({ predecessorId: ids[0], successorId: ids[1], type: 'FINISH_START', lagDays: 0 });
  eq('3 addSequence vervangt geen enkele taak', vervangen(voor, S().tasks), []);
}

{
  const resId = S().addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
  const voor = S().tasks;
  S().assignResource(ids[4], resId, 1);
  eq('4 assignResource vervangt alleen de doeltaak', vervangen(voor, S().tasks), [ids[4]]);
}

{
  const voor = S().tasks;
  S().addTask({ name: 'nieuw vooraan', position: { anchorId: ids[0], where: 'above' } });
  const geraakt = vervangen(voor, S().tasks);
  truthy('5 invoegen vóóraan hernummert wél (>= 20 taken vervangen)', geraakt.length >= 20);
  eq('5a de eerste taak heeft nu code 1', S().tasks[0]?.wbsCode, '1');
  eq('5b de oude eerste taak is doorgeschoven naar 2', S().tasks.find(t => t.id === ids[0])?.wbsCode, '2');
}

{
  S().newProject();
  const a = S().addTask({ name: 'A' });
  S().addTask({ name: 'B' });
  const takenVoor = S().tasks;
  S().updateTask(a, { name: 'A2' });

  const snap = latestAppliedDocumentDataDelta(S())!.before;
  eq('6 de snapshot deelt de takenarray van vóór de mutatie', snap.tasks === takenVoor, true);
  eq('6a de snapshot ziet de oude naam', snap.tasks.find(t => t.id === a)?.name, 'A');
  eq('6b de live state ziet de nieuwe', S().tasks.find(t => t.id === a)?.name, 'A2');

  S().updateTask(a, { name: 'A3' });
  eq('7 de eerste snapshot beweegt niet mee met latere mutaties', snap.tasks.find(t => t.id === a)?.name, 'A');

  S().undo();
  eq('8 undo herstelt de tussenstand', S().tasks.find(t => t.id === a)?.name, 'A2');
  S().undo();
  eq('9 en de stand daarvóór', S().tasks.find(t => t.id === a)?.name, 'A');
  S().redo();
  eq('10 redo gaat weer vooruit', S().tasks.find(t => t.id === a)?.name, 'A2');

  const naUndo = S().tasks;
  S().updateTask(a, { name: 'A4' });
  eq('11 muteren ná een undo laat de herstelde array met rust', naUndo.find(t => t.id === a)?.name, 'A2');
  eq('11a en de live state is bij', S().tasks.find(t => t.id === a)?.name, 'A4');
}

function bevroren(label: string) {
  const s = S();
  const slecht: string[] = [];
  const gezien = new Set<unknown>();
  const loop = (v: unknown, pad: string, diepte: number) => {
    if (v === null || typeof v !== 'object' || diepte > 6 || gezien.has(v)) return;
    gezien.add(v);
    if (!Object.isFrozen(v)) slecht.push(pad);
    if (Array.isArray(v)) v.slice(0, 4).forEach((x, i) => loop(x, `${pad}[${i}]`, diepte + 1));
    else for (const k of Object.keys(v as object)) loop((v as Record<string, unknown>)[k], `${pad}.${k}`, diepte + 1);
  };
  for (const [k, v] of Object.entries({
    project: s.project, calendar: s.calendar, tasks: s.tasks, sequences: s.sequences,
    resources: s.resources, assignments: s.assignments, calendars: s.calendars, baselines: s.baselines,
  })) loop(v, k, 0);
  eq(label, slecht.slice(0, 5), []);
}

S().newProject();
bevroren('12 bevroren na newProject');
const f1 = S().addTask({ name: 'F1' });
const f2 = S().addTask({ name: 'F2' });
bevroren('13 bevroren na addTask');
S().updateTask(f1, { name: 'F1b' });
bevroren('14 bevroren na updateTask');
S().addSequence({ predecessorId: f1, successorId: f2, type: 'FINISH_START', lagDays: 0 });
const fr = S().addResource({ name: 'R', type: 'LABOR', description: '', maxUnits: 2 });
S().assignResource(f2, fr, 1);
bevroren('15 bevroren na relatie/resource/toewijzing');
S().runCPM();
bevroren('16 bevroren na runCPM');
S().undo();
bevroren('17 bevroren na undo');
S().redo();
bevroren('18 bevroren na redo');
withTransaction(() => { for (let i = 0; i < 5; i++) S().addTask({ name: `bulk${i}` }); });
bevroren('19 bevroren na een bulk-transactie');

{
  checks++;
  let gooide = false;
  try { (S().tasks[0] as { name: string }).name = 'stiekem'; } catch { gooide = true; }
  if (!gooide && S().tasks[0]?.name === 'stiekem') {
    diffs.push('20 in-place muteren van een taak buiten een producer LUKTE — het delen is dan onveilig');
  }
}

{
  S().newProject();
  const grote: string[] = [];
  withTransaction(() => { for (let i = 0; i < 2000; i++) grote.push(S().addTask({ name: `G${i}` })); });
  eq('21 het grote project staat er', S().tasks.length, 2000);

  const voor = S().tasks;
  S().addTask({ name: 'er nog eentje bij' });
  eq('22 één addTask op 2.000 taken raakt geen bestaande taak aan', vervangen(voor, S().tasks).length, 0);

  const voor2 = S().tasks;
  S().updateTask(grote[1000], { name: 'midden' });
  eq('23 één updateTask op 2.000 taken raakt precies één taak aan', vervangen(voor2, S().tasks), [grote[1000]]);

  const snap = latestAppliedDocumentDataDelta(S())!.before;
  eq('24 en de snapshot daarvan deelt de oude array', snap.tasks === voor2, true);

  S().undo();
  eq('25 undo op 2.000 taken herstelt de naam', S().tasks.find(t => t.id === grote[1000])?.name, 'G1000');
}

{
  S().newProject();
  S().addTask({ name: 'A' });
  const voorNaam = S().tasks[0].name;

  let binnenProducer!: Snapshot;
  const na = produce(S(), (draft) => {
    draft.tasks[0].name = 'GEMUTEERD';
    binnenProducer = createSnapshot(draft);
  });

  eq('25a createSnapshot leest binnen een producer de VOOR-staat', binnenProducer.tasks[0].name, voorNaam);
  eq('25b en de producer muteerde wel degelijk', na.tasks[0].name, 'GEMUTEERD');
  truthy('25c de snapshot blijft leesbaar ná afloop van de producer',
    JSON.parse(JSON.stringify(binnenProducer.tasks)).length === na.tasks.length);
}

{
  const { readFileSync, existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { join, dirname } = await import('node:path');
  let root = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(root, 'package.json')) && dirname(root) !== root) root = dirname(root);

  const strip = (src: string): string => {
    let out = ''; let mode: 'code' | 'line' | 'block' | '"' | "'" | '`' = 'code';
    for (let i = 0; i < src.length; i++) {
      const c = src[i], n = src[i + 1];
      if (mode === 'code') {
        if (c === '/' && n === '/') { mode = 'line'; i++; continue; }
        if (c === '/' && n === '*') { mode = 'block'; i++; continue; }
        if (c === '"' || c === "'" || c === '`') mode = c;
        out += c;
      } else if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } }
      else if (mode === 'block') { if (c === '*' && n === '/') { mode = 'code'; i++; } }
      else { if (c === '\\') { out += c + (n ?? ''); i++; continue; } if (c === mode) mode = 'code'; out += c; }
    }
    return out;
  };

  const paden = {
    snapshot: 'src/state/snapshot.ts',
    immerDraft: 'src/state/immerDraft.ts',
    wbs: 'src/utils/wbs.ts',
    schedule: 'src/state/slices/scheduleSlice.ts',
    store: 'src/state/appStore.ts',
  };
  const ontbreekt = Object.values(paden).filter(p => !existsSync(join(root, p)));
  checks++;
  if (ontbreekt.length) {
    diffs.push(`26 bron-assert overgeslagen: niet gevonden vanaf de bundelplek (${ontbreekt.join(', ')})`);
  } else {
    const src = Object.fromEntries(
      Object.entries(paden).map(([k, p]) => [k, strip(readFileSync(join(root, p), 'utf8'))]),
    ) as Record<keyof typeof paden, string>;

    eq('26a de stripper haalt commentaar weg', src.snapshot.includes('WAAROM GEEN DIEPE KLOON'), false);
    eq('26b de stripper laat code staan', src.snapshot.includes('export function createSnapshot'), true);

    eq('27 createSnapshot doet geen JSON-kloon', /JSON\.(parse|stringify)/.test(src.snapshot), false);
    eq('27a createSnapshot normaliseert een draft via originalAppState()',
      src.snapshot.includes('originalAppState('), true);
    eq('27b originalAppState() leest de producerbasis via original()',
      /export function originalAppState\b[\s\S]*?\boriginal\s*[<(]/.test(src.immerDraft), true);
    eq('27c en snapshot.ts leest nooit current()', src.snapshot.includes('current('), false);

    eq('28 wbs.ts leest de draft plain via current()', src.wbs.includes('current('), true);
    truthy('28a applyWbsNumbering schrijft alleen bij een verschil',
      /!==\s*view\[i\]\.wbsCode/.test(src.wbs));

    const rrl = src.schedule.slice(src.schedule.indexOf('recomputeResourceLoad:'));
    const body = rrl.slice(0, rrl.indexOf('runCPM:'));
    truthy('29 recomputeResourceLoad rekent buiten de producer', /const s = get\(\);/.test(body));
    eq('29a en rekent via de betrouwbaarheidspoort buiten de producer',
      /computeReliableResourceLoad\(\s*s\.cpmResult,\s*s\./.test(body), true);
    eq('29b computeResourceLoad staat niet ín een set()-producer',
      /set\(\([a-z]+\) => \{\s*[a-z]+\.resourceLoadResult = computeResourceLoad/.test(body), false);

    for (const [naam, code] of Object.entries(src)) {
      eq(`30 ${naam} zet auto-freeze niet uit`, code.includes('setAutoFreeze'), false);
    }
  }
}

if (diffs.length === 0) {
  console.log(`OK: mutatiekosten — ${checks} checks groen`);
} else {
  console.log(`XX mutatiekosten — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
