import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDeterminism } from './ifcPariteitKern';
import { cloneDomain, mergeProblems, openForeign, settle, type Domain, type Opened } from './ifcMergeKern';
import { storeEdit } from './ifcAppRoute';
import { checkMergeOutput, MergeNeedsPhase2Error, prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import type { IfcSource, PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { scanStep } from '@/services/ifc/foreign/stepScanner';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { unusedAssignmentKeyNames } from '@/services/ifc/assignmentKeys';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const reseed = installDeterminism();
const diffs: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };
const read = (rel: string) => new Uint8Array(readFileSync(join(ROOT, rel)));
const latin1 = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));
const text = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const setLine = (s: string, id: number, line: string) => {
  const re = new RegExp(`^#${id}=.*;$`, 'm');
  if (!re.test(s)) throw new Error(`geen #${id}`);
  return s.replace(re, () => line);
};
const after = (s: string, id: number, lines: string) => s.replace(new RegExp(`^(#${id}=.*;)$`, 'm'), (m) => `${m}\n${lines}`);
const show = (x: unknown) => JSON.stringify(x);

const R109 = '3LKE2mEiGfOR4VMIq3h_xv';
const R110 = '34SuBObt1dKPNSent0osWG';
const TASK_GUID = '06AdBvh4v8lXgXlHO1$rfO';
type Key = readonly [string, string];
const own0: Key = [`${R109}#0`, "IFCTEXT('1|UNIFORM')"];
const own1: Key = [`${R110}#1`, "IFCTEXT('2|UNIFORM')"];
const extra = (name: string): Key => [name, "IFCTEXT('7|BACKLOADED')"];
const bare: Key = [R110, "IFCTEXT('5|FRONTLOADED')"];
const real = (name: string): Key => [name, 'IFCREAL(3.)'];
const written = (name: string, units: number): Key => [name, `IFCTEXT('${units}|UNIFORM')`];

function assignmentPsetOf(index: ReturnType<typeof scanStep>, taskGuid: string): number {
  const tasks = new Set<number>();
  for (let i = 0; i < index.count; i++) if (index.isEntity(i) && index.type(i) === 'IFCTASK' && index.globalId(i) === taskGuid) tasks.add(i);
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i) || index.type(i) !== 'IFCRELDEFINESBYPROPERTIES') continue;
    if (!index.refsAt(i, 4).some(t => tasks.has(t))) continue;
    const pset = index.refAt(i, 5);
    if (pset >= 0 && index.name(pset) === 'OPS_Assignments') return pset;
  }
  return -1;
}
function assignmentKeysOf(bytes: Uint8Array, taskGuid: string): Key[] {
  const index = scanStep(bytes);
  const pset = assignmentPsetOf(index, taskGuid);
  if (pset < 0) return [];
  return index.refsAt(pset, 4).map(p => [index.name(p) ?? '', (index.argTokens(p)?.[2] ?? '').trim()] as const);
}

const taskOf = (o: Opened) => o.tasks.find(t => o.ifcSource!.stepIds[`task:${t.id}`] === 63)!;
const resOf = (o: Opened, step: number) => o.resources.find(r => o.ifcSource!.stepIds[`res:${r.id}`] === step)!;
function assignmentsOf(o: Opened): string[] {
  const task = taskOf(o);
  const step = (id: string) => o.ifcSource!.stepIds[`res:${id}`];
  return o.assignments.filter(a => a.taskId === task.id).map(a => `${step(a.resourceId)}:${a.unitsPerDay}`);
}
function unusedValuesOf(source: IfcSource, taskStep: number): string[] {
  const index = scanStep(source.bytes);
  const entry = source.unusedKeys?.find(k => k.taskStepId === taskStep);
  return (entry?.propertyStepIds ?? []).map(id => (index.argTokens(index.chunkOf(String(id)))?.[2] ?? '').trim());
}

async function save(label: string, domain: Domain, source: IfcSource): Promise<PreparedIfcWrite | undefined> {
  try { return await prepareIfcWrite(domain, source); }
  catch (e) {
    if (!(e instanceof MergeNeedsPhase2Error)) throw e;
    ok(`${label}: verwacht schrijven, kreeg een weigering — ${e.cases.slice(0, 3).map(c => `${c.kind}: ${c.detail}`).join(' | ')}`, false);
    return undefined;
  }
}

const eigen = text(await settle(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
ok('bron: de OPS_Assignments van #63 is #154 met #152 en #153',
  /^#154=IFCPROPERTYSET\('26EUCC2ORYjlLXgzsMT4U9',#6,'OPS_Assignments',\$,\(#152,#153\)\);$/m.test(eigen));
ok('bron: #63 heeft de toewijzingen #109 en #110', /^#145=IFCRELASSIGNSTOPROCESS\(.*,\(#109,#110\),\$,#63,\$\);$/m.test(eigen));
const UNUSED_LINES = [
  `#9200=IFCPROPERTYSINGLEVALUE('${R109}#2',$,IFCTEXT('7|BACKLOADED'),$);`,
  `#9201=IFCPROPERTYSINGLEVALUE('${R110}',$,IFCTEXT('5|FRONTLOADED'),$);`,
  `#9202=IFCPROPERTYSINGLEVALUE('${R109}#9',$,IFCREAL(3.),$);`,
];
const withUnused = latin1(after(
  setLine(eigen, 154, "#154=IFCPROPERTYSET('26EUCC2ORYjlLXgzsMT4U9',#6,'OPS_Assignments',$,(#152,#153,#9200,#9201,#9202));"),
  153, UNUSED_LINES.join('\n')));
const SOURCE_UNUSED = ["IFCTEXT('7|BACKLOADED')", "IFCTEXT('5|FRONTLOADED')", 'IFCREAL(3.)'];

{
  const plainOpened = await openForeign(latin1(eigen));
  const opened = await openForeign(withUnused);
  ok(`openen: dezelfde toewijzingen als zonder de extra sleutels (${assignmentsOf(opened)})`,
    show(assignmentsOf(opened)) === show(assignmentsOf(plainOpened)) && show(assignmentsOf(opened)) === show(['109:1', '110:2']));
  ok(`openen: de bron bewaart de drie ongebruikte sleutels van #63 (${show(opened.ifcSource?.unusedKeys)})`,
    show(opened.ifcSource?.unusedKeys) === show([{ taskStepId: 63, propertyStepIds: [9200, 9201, 9202] }]));
  ok('openen: zonder ongebruikte sleutels heeft de bron geen lijst', plainOpened.ifcSource?.unusedKeys === undefined);
}

type Edit = (d: Domain, o: Opened) => void | Domain | Promise<void | Domain>;
async function scenario(label: string, edit: Edit, wantKeys: readonly Key[], wantAssignments: readonly string[]): Promise<PreparedIfcWrite | undefined> {
  const opened = await openForeign(withUnused);
  let domain = cloneDomain(opened);
  domain.project.description = `${domain.project.description} (proef ongebruikte sleutels)`;
  const edited = await edit(domain, opened);
  if (edited) domain = edited;
  const prepared = await save(label, domain, opened.ifcSource!);
  if (!prepared) return undefined;
  const problems = mergeProblems(withUnused, prepared.bytes);
  ok(`${label}: de invarianten van de merge (${problems.slice(0, 2).join(' | ')})`, problems.length === 0);
  const keys = assignmentKeysOf(prepared.bytes, TASK_GUID);
  ok(`${label}: de sleutels van #63 na opslaan (${show(keys)})`, show(keys) === show(wantKeys));
  const again = await openForeign(prepared.bytes);
  ok(`${label}: na heropenen de toewijzingen van #63 (${show(assignmentsOf(again))})`, show(assignmentsOf(again)) === show(wantAssignments));
  ok(`${label}: na heropenen dezelfde ongebruikte waarden bij #63 (${show(unusedValuesOf(again.ifcSource!, 63))})`,
    show(unusedValuesOf(again.ifcSource!, 63)) === show(SOURCE_UNUSED));
  ok(`${label}: de bron na opslaan noemt dezelfde ongebruikte sleutels als heropenen (${show(prepared.source.unusedKeys)} / ${show(again.ifcSource?.unusedKeys)})`,
    show(prepared.source.unusedKeys) === show(again.ifcSource?.unusedKeys));

  const next = structuredClone(domain);
  next.project.description = `${next.project.description} (tweede opslag)`;
  const second = await save(`${label}, tweede opslag op de nieuwe bron`, next, prepared.source);
  if (second) {
    ok(`${label}, tweede opslag: dezelfde sleutels van #63 (${show(assignmentKeysOf(second.bytes, TASK_GUID))})`,
      show(assignmentKeysOf(second.bytes, TASK_GUID)) === show(wantKeys));
    ok(`${label}, tweede opslag: de invarianten van de merge`, mergeProblems(prepared.bytes, second.bytes).length === 0);
  }
  return prepared;
}

const of = (d: Domain, o: Opened, step: number) => d.assignments.find(a => a.taskId === taskOf(o).id && a.resourceId === resOf(o, step).id)!;
const kept = await scenario('alleen herschrijven', () => {},
  [own0, own1, extra(`${R109}#2`), bare, real(`${R109}#9`)], ['109:1', '110:2']);
await scenario('een toewijzing van #109 erbij: de ongebruikte #2 schuift naar #3',
  (d, o) => { d.assignments.push({ ...of(d, o, 109), id: 'proef-1', unitsPerDay: 4 }); },
  [own0, own1, written(`${R109}#2`, 4), extra(`${R109}#3`), bare, real(`${R109}#9`)], ['109:1', '110:2', '109:4']);
await scenario('twee toewijzingen erbij (#110, dan #109): de ongebruikte #2 schuift boven de eigen #3',
  (d, o) => {
    d.assignments.push({ ...of(d, o, 110), id: 'proef-1', unitsPerDay: 4 });
    d.assignments.push({ ...of(d, o, 109), id: 'proef-2', unitsPerDay: 6 });
  },
  [own0, own1, written(`${R110}#2`, 4), written(`${R109}#3`, 6), extra(`${R109}#4`), bare, real(`${R109}#9`)],
  ['109:1', '110:2', '110:4', '109:6']);
await scenario('de toewijzing van #110 weg: de kale sleutel blijft ongebruikt',
  (d, o) => { d.assignments = d.assignments.filter(a => a !== of(d, o, 110)); },
  [own0, extra(`${R109}#2`), bare, real(`${R109}#9`)], ['109:1']);
await scenario('alle toewijzingen van #63 weg: de pset houdt alleen de ongebruikte sleutels',
  (d, o) => { d.assignments = d.assignments.filter(a => a.taskId !== taskOf(o).id); },
  [extra(`${R109}#2`), bare, real(`${R109}#9`)], []);

{
  const opened = await openForeign(withUnused);
  const domain = await storeEdit(cloneDomain(opened), s => s.deleteTask(taskOf(opened).id));
  const prepared = await save('taak #63 wissen', domain, opened.ifcSource!);
  if (prepared) {
    ok(`taak #63 wissen: geen OPS_Assignments meer voor de taak (${show(assignmentKeysOf(prepared.bytes, TASK_GUID))})`,
      assignmentKeysOf(prepared.bytes, TASK_GUID).length === 0);
    ok(`taak #63 wissen: de bron na opslaan heeft geen ongebruikte sleutels (${show(prepared.source.unusedKeys)})`,
      prepared.source.unusedKeys === undefined);
  }
}

if (kept) {
  const opened = await openForeign(withUnused);
  const domain = cloneDomain(opened);
  domain.project.description = `${domain.project.description} (proef ongebruikte sleutels)`;
  const verdict = async (bytes: Uint8Array) => {
    try {
      await checkMergeOutput(bytes, domain, opened.ifcSource!, { stepIds: kept.source.stepIds, writtenAt: new Date(), skip: new Set(), slots: [] });
      return 'laat door';
    }
    catch (e) {
      if (!(e instanceof MergeNeedsPhase2Error)) throw e;
      return e.cases.map(c => `${c.kind}: ${c.detail}`).join(' | ');
    }
  };
  const out = text(kept.bytes);
  const lineId = (name: string) => {
    const line = out.split(/\r?\n/).find(l => l.includes(`=IFCPROPERTYSINGLEVALUE('${name}',`));
    if (!line) throw new Error(`geen property ${name}`);
    return Number(/^#(\d+)=/.exec(line)![1]);
  };
  const psetWith = (id: number) => {
    const m = new RegExp(`^(#\\d+=IFCPROPERTYSET\\(.*'OPS_Assignments',\\$,\\()([^)]*#${id}\\b[^)]*)(\\)\\);)$`, 'm').exec(out);
    if (!m) throw new Error(`geen pset met #${id}`);
    return m;
  };
  const unusedId = lineId(`${R109}#2`);
  const [whole, head, members, tail] = psetWith(unusedId);
  const dropped = members.split(',').filter(x => x !== `#${unusedId}`).join(',');
  const refused = (v: string) => /^uitvoer-controle: .*ongebruikte sleutels/.test(v);
  ok(`uitvoercontrole: de echte uitvoer gaat door (${await verdict(kept.bytes)})`, await verdict(kept.bytes) === 'laat door');
  const withoutLine = out.replace(whole, `${head}${dropped}${tail}`).replace(new RegExp(`^#${unusedId}=.*;\\r?\\n`, 'm'), '');
  ok('uitvoercontrole: de proefbewerking haalde de sleutel en haar regel weg', !new RegExp(`^#${unusedId}=`, 'm').test(withoutLine));
  const withoutKey = await verdict(latin1(withoutLine));
  ok(`uitvoercontrole: een ongebruikte sleutel die uit de pset viel, weigert (${withoutKey})`, refused(withoutKey));
  const otherValue = await verdict(latin1(out.replace("IFCTEXT('7|BACKLOADED')", "IFCTEXT('8|BACKLOADED')")));
  ok(`uitvoercontrole: een andere waarde weigert (${otherValue})`, refused(otherValue));
  const maxId = Math.max(...[...out.matchAll(/^#(\d+)=/gm)].map(m => Number(m[1])));
  const added = out.replace(whole, `${head}${members},#${maxId + 1}${tail}\n#${maxId + 1}=IFCPROPERTYSINGLEVALUE('${R109}#20',$,IFCTEXT('9|UNIFORM'),$);`);
  const extraKey = await verdict(latin1(added));
  ok(`uitvoercontrole: een ongebruikte sleutel die de bron niet had, weigert (${extraKey})`, refused(extraKey));
}

{
  const opened = await openForeign(latin1(eigen));
  const ownText = writeIFC(cloneDomain(opened));
  const index = scanStep(latin1(ownText));
  const ownKeys = assignmentKeysOf(latin1(ownText), TASK_GUID);
  ok(`flag uit: het eigen bestand heeft de twee sleutels van de taak (${show(ownKeys)})`, show(ownKeys) === show([own0, own1]));
  const pset = assignmentPsetOf(index, TASK_GUID);
  const psetLine = new RegExp(`^#${index.id(pset)}=IFCPROPERTYSET\\((.*)\\(([^)]*)\\)\\);$`, 'm');
  const maxId = Math.max(...[...ownText.matchAll(/^#(\d+)=/gm)].map(m => Number(m[1])));
  const ids = [maxId + 1, maxId + 2, maxId + 3];
  const lines = UNUSED_LINES.map((l, k) => l.replace(/^#\d+=/, `#${ids[k]}=`)).join('\n');
  const withKeys = ownText.replace(psetLine, (_line, headArgs: string, members: string) =>
    `#${index.id(pset)}=IFCPROPERTYSET(${headArgs}(${members},${ids.map(id => `#${id}`).join(',')}));\n${lines}`);
  ok('flag uit: de proefbewerking zette de drie sleutels in de pset', withKeys !== ownText && assignmentKeysOf(latin1(withKeys), TASK_GUID).length === 5);
  reseed(7);
  const plainWithout = writeIFC(readIFC(ownText));
  reseed(7);
  const plainWith = writeIFC(readIFC(withKeys));
  ok('flag uit (de route van main): de gewone writer geeft met de ongebruikte sleutels dezelfde bytes als zonder', plainWith === plainWithout);
  ok(`flag uit (de route van main): de ongebruikte sleutels vallen weg, zoals op main (${show(assignmentKeysOf(latin1(plainWith), TASK_GUID))})`,
    show(assignmentKeysOf(latin1(plainWith), TASK_GUID)) === show([own0, own1]));
  const flagOn = await openForeign(latin1(withKeys));
  ok('flag aan zonder vreemd deel: geen vreemd deel, dus de gewone writer (knownbug 2210)', flagOn.ifcSource?.foreign === false);
}

{
  const pset154 = (members: string) => setLine(eigen, 154, `#154=IFCPROPERTYSET('26EUCC2ORYjlLXgzsMT4U9',#6,'OPS_Assignments',$,(${members}));`);
  const refusesWithout = async (label: string, bytes: Uint8Array) => {
    const opened = await openForeign(bytes);
    const domain = cloneDomain(opened);
    domain.project.description = `${domain.project.description} (proef grens)`;
    try {
      const prepared = await prepareIfcWrite(domain, opened.ifcSource!);
      ok(`grens, ${label}: verwacht een weigering (knownbug 2210), maar de merge schreef: ${show(assignmentKeysOf(prepared.bytes, TASK_GUID))}`, false);
    } catch (e) {
      if (!(e instanceof MergeNeedsPhase2Error)) throw e;
      ok(`grens, ${label}: weigert met niet-gedragen of niet-eenduidig (${e.cases.slice(0, 2).map(c => `${c.kind}: ${c.detail}`).join(' | ')})`,
        e.cases.every(c => c.kind === 'niet-gedragen' || c.kind === 'niet-eenduidig'));
    }
  };
  await refusesWithout('een ongebruikte sleutel tussen de eigen sleutels',
    latin1(after(pset154('#152,#9200,#153'), 153, UNUSED_LINES[0])));
  await refusesWithout('een kale sleutel vóór de eigen sleutels',
    latin1(after(pset154('#9201,#152,#153'), 153, UNUSED_LINES[1])));
  await refusesWithout('een ander programma nam de eerste toewijzing weg (de eigen sleutel krijgt een ander nummer)',
    latin1(setLine(eigen, 145, "#145=IFCRELASSIGNSTOPROCESS('0qaSpDMFm3_b9f8mO9$CFm',#6,$,$,(#110),$,#63,$);")));

  const terra = latin1(after(
    setLine(eigen, 157, "#157=IFCPROPERTYSET('189__mkvSZ4kbXQD0Hw2XN',#6,'OPS_Assignments',$,(#156,#9203));"),
    156, "#9203=IFCPROPERTYSINGLEVALUE('1XVcwxvomwVx$qDRoCxjQu#1',$,IFCTEXT('9|UNIFORM'),$);"));
  const opened = await openForeign(terra);
  const domain = cloneDomain(opened);
  domain.project.description = `${domain.project.description} (proef Terra)`;
  const prepared = await save('Terra: één toewijzing met twee sleutels voor dezelfde resource', domain, opened.ifcSource!);
  if (prepared) {
    const line = /^#\d+=IFCPROPERTYSINGLEVALUE\('1XVcwxvomwVx\$qDRoCxjQu#1',\$,IFCTEXT\('9\|UNIFORM'\),\$\);$/m.test(text(prepared.bytes));
    ok('Terra: de tweede sleutel staat er na opslaan met dezelfde naam en waarde', line);
    const again = await openForeign(prepared.bytes);
    const task65 = again.tasks.find(t => again.ifcSource!.stepIds[`task:${t.id}`] === 65)!;
    const units = again.assignments.filter(a => a.taskId === task65.id).map(a => a.unitsPerDay);
    ok(`Terra: de lezer neemt voor de toewijzing dezelfde waarde als vóór opslaan (${show(units)})`, show(units) === show([2]));
  }
}

{
  const names = (own: readonly string[], unused: readonly string[]) => show(unusedAssignmentKeyNames(own, unused));
  const g = R109, h = R110;
  ok('nummers: zonder eigen sleutels houdt elke sleutel haar naam', names([], [`${g}#0`, `${g}#3`, h]) === show([`${g}#0`, `${g}#3`, h]));
  ok('nummers: een nummer boven de eigen nummers blijft', names([`${g}#0`], [`${g}#1`]) === show([`${g}#1`]));
  ok('nummers: een nummer dat de writer zelf gebruikt, schuift naar het eerste vrije erboven',
    names([`${g}#0`, `${h}#1`], [`${g}#1`]) === show([`${g}#2`]));
  ok('nummers: een naam die erboven al vastligt, blijft van haar eigen sleutel',
    names([`${g}#0`, `${h}#1`], [`${g}#0`, `${g}#2`]) === show([`${g}#3`, `${g}#2`]));
  ok('nummers: twee keer dezelfde naam boven de eigen nummers blijft uniek', names([], [`${g}#4`, `${g}#4`]) === show([`${g}#4`, `${g}#0`]));
  ok('nummers: een kale sleutel houdt haar naam', names([`${h}#0`], [h, h]) === show([h, h]));
}

if (diffs.length > 0) {
  console.log(`XX  ifc-foreign-ongebruikte-sleutels: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 60)) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-ongebruikte-sleutels: alle checks groen (${checks})`);
process.exit(0);
