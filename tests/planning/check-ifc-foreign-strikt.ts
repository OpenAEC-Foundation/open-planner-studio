// #804 fase 1b, fixronde 4 van #867: de strikte verliesbewaking. Regel van deze ronde: bij twijfel weigeren.
//
// Elke proef hieronder is een tegenproef uit ronde 3 (Sol en Terra) of uit de lijst met verklaarplekken van de expert
// (plek 1 tot en met 53), met de bronwijziging letterlijk erin. Per proef staat erbij wat de merge moet doen: schrijven
// (en dan wat er in de uitvoer staat of niet meer staat), of weigeren met een bepaald geval. Daarna de combinaties: een
// bewerking samen met een wijziging van het project, en twee bewerkingen samen, op vier bestanden. Een combinatie mag
// alleen schrijven als elk deel apart ook schrijft (een bewerking verklaart nooit het verlies van een andere).
//
// De check gebruikt alleen `writeIfcMerge` (via `tryMerge`) en de lezers, geen interne functie van de merge: zo draait hij
// ook tegen een oudere versie (de lijst "rood op 305049927, groen na de fix" in de PR-body van #867).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDeterminism } from './ifcPariteitKern';
import { basicEdits, cloneDomain, mergeProblems, openForeign, plannerEdits, settle, tryMerge, type Domain, type MergeOutcome, type Opened } from './ifcMergeKern';
import { readXER } from '@/services/xer/xerReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { isMultiDocumentImport } from '@/services/importTypes';
import { scanStep } from '@/services/ifc/foreign/stepScanner';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
installDeterminism();
const diffs: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };
const read = (rel: string) => new Uint8Array(readFileSync(join(ROOT, rel)));
const latin1 = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));
const text = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const lineOf = (bytes: Uint8Array, id: string) => {
  const index = scanStep(bytes);
  const i = index.chunkOf(id);
  return i < 0 ? '' : text(bytes.subarray(index.entityStart(i), index.end(i))).trim();
};
const linesOfType = (bytes: Uint8Array, type: string) => {
  const index = scanStep(bytes);
  const out: string[] = [];
  for (let i = 0; i < index.count; i++) if (index.isEntity(i) && index.type(i) === type) out.push(text(bytes.subarray(index.entityStart(i), index.end(i))).trim());
  return out;
};
const setLine = (s: string, id: number, line: string) => {
  const re = new RegExp(`^#${id}=.*;$`, 'm');
  if (!re.test(s)) throw new Error(`geen #${id}`);
  return s.replace(re, () => line);
};
const after = (s: string, id: number, lines: string) => s.replace(new RegExp(`^(#${id}=.*;)$`, 'm'), (m) => `${m}\n${lines}`);
const withLines = (src: string, lines: readonly string[]) => {
  const at = src.lastIndexOf('ENDSEC;');
  return `${src.slice(0, at)}${lines.map(l => `${l}\n`).join('')}${src.slice(at)}`;
};
/** Een wand van Revit met een eigen owner history: genoeg voor een vreemd deel. */
const REVIT_WALL = [
  "#90001=IFCORGANIZATION($,'Arch',$,$,$);", "#90002=IFCAPPLICATION(#90001,'1','Revit','RVT');",
  "#90003=IFCPERSON($,'Ontwerper',$,$,$,$,$,$);", '#90004=IFCPERSONANDORGANIZATION(#90003,#90001,$);',
  '#90005=IFCOWNERHISTORY(#90004,#90002,$,.ADDED.,$,$,$,1);', "#90006=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOX',#90005,'Wand',$,$,$,$,$,$);",
];

/** De uitkomst van een merge als tekst: `schrijft`, de gevallen van de weigering, of een andere fout (`fout: …`). */
type Result = { label: string; outcome: 'schrijft' | 'weigert' | 'fout'; kinds: string[]; details: string[]; out?: Uint8Array };
/** Elk bestand één keer openen; elke merge krijgt een kopie van het domein (de bron blijft gedeeld en onbewerkt). */
const openedOf = new Map<Uint8Array, Opened>();
async function merge(label: string, bytes: Uint8Array, edit?: (d: Domain, o: Opened) => void): Promise<Result> {
  let opened = openedOf.get(bytes);
  if (!opened) {
    try { opened = await openForeign(bytes); } catch (e) { return { label, outcome: 'fout', kinds: [], details: [`openen: ${(e as Error).message.slice(0, 160)}`] }; }
    openedOf.set(bytes, opened);
  }
  if (!opened.ifcSource?.foreign) return { label, outcome: 'fout', kinds: [], details: ['geen vreemd deel'] };
  const d = cloneDomain(opened);
  edit?.(d, opened);
  let r: MergeOutcome;
  try { r = await tryMerge(d, opened.ifcSource); } catch (e) {
    return { label, outcome: 'fout', kinds: [], details: [`${(e as Error).name}: ${(e as Error).message.slice(0, 160)}`] };
  }
  if (r.ok) {
    const problems = mergeProblems(bytes, r.bytes);
    if (problems.length > 0) return { label, outcome: 'fout', kinds: [], details: problems.slice(0, 3).map(p => `invariant: ${p}`), out: r.bytes };
    return { label, outcome: 'schrijft', kinds: [], details: [], out: r.bytes };
  }
  return { label, outcome: 'weigert', kinds: r.kinds, details: r.error.cases.map(c => `${c.kind}: ${c.detail}`) };
}
const results: Result[] = [];
/** Een proef met de verwachte uitkomst: `schrijft`, of het geval van de weigering. */
async function proof(plek: string, label: string, bytes: Uint8Array, want: string, edit?: (d: Domain, o: Opened) => void, check?: (out: Uint8Array) => string | undefined, only?: RegExp): Promise<Result> {
  const r = await merge(`${plek} · ${label}`, bytes, edit);
  if (only && r.outcome === 'weigert') {
    const other = r.details.filter(x => !only.test(x));
    ok(`${r.label}: alleen ${only} (${other.slice(0, 2).join(' | ')})`, other.length === 0);
  }
  results.push(r);
  const got = r.outcome === 'weigert' ? `weigert (${r.kinds.join(', ')})` : r.outcome;
  const pass = want === 'schrijft' ? r.outcome === 'schrijft' : r.outcome === 'weigert' && r.kinds.includes(want);
  ok(`${r.label}: verwacht ${want}, kreeg ${got}${r.details.length ? ` — ${r.details.slice(0, 2).join(' | ')}` : ''}`, pass);
  if (pass && check && r.out) {
    const problem = check(r.out);
    ok(`${r.label}: ${problem}`, problem === undefined);
  }
  return r;
}

// ── De bronnen ──
const fix3 = await settle(read('tests/fixtures/ifc-foreign/council/fix3-twee-data.ifc'));
const eigen = text(await settle(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const showcase = text(await settle(latin1(withLines(text(read('public/examples/showcase-appartementencomplex.ifc')), REVIT_WALL))));
const r6sol = await settle(read('tests/fixtures/ifc-foreign/council/r6sol-twee-werkplannen.ifc'));
const eigenOpened = await openForeign(latin1(eigen));
const taskBy = (o: Opened, step: number) => o.tasks.find(t => o.ifcSource!.stepIds[`task:${t.id}`] === step)!;
const resBy = (o: Opened, step: number) => o.resources.find(r => o.ifcSource!.stepIds[`res:${r.id}`] === step)!;
const PREP = 'task-mvp6ekzlhuk71306';
/** Een taak wissen met haar kinderen, relaties en toewijzingen (zoals `plannerEdits`, "taak wissen"). */
const wipe = (id: string) => (x: Domain) => {
  const m = new Map(x.tasks.map(t => [t.id, t]));
  const isDesc = (t: string): boolean => { for (let c = m.get(t); c?.parentId; c = m.get(c.parentId)) if (c.parentId === id) return true; return false; };
  const gone = new Set([id, ...x.tasks.filter(o => isDesc(o.id)).map(o => o.id)]);
  const t = m.get(id)!;
  if (t.parentId) { const p = m.get(t.parentId)!; p.childIds = p.childIds.filter(c => c !== id); }
  x.tasks = x.tasks.filter(o => !gone.has(o.id));
  x.sequences = x.sequences.filter(s => !gone.has(s.predecessorId) && !gone.has(s.successorId));
  x.assignments = x.assignments.filter(a => !gone.has(a.taskId));
};
const has = (needle: string | RegExp, want = true) => (out: Uint8Array) => {
  const found = typeof needle === 'string' ? text(out).includes(needle) : needle.test(text(out));
  return found === want ? undefined : `${want ? 'mist' : 'heeft nog'} ${needle}`;
};

// ── B1 en plek 1 tot 3: geen algemene vrijstelling; verklaren per veld ──
// De proeven van de expert op fix3 (`p1-fix3.ts`, `p1b-fix3.ts`): '1. Preparation' wissen verandert de tijden van de
// andere taken en de werkweek van de kalender (knownbug 1026). Geen andere bewerking mag dat verklaren.
await proof('plek 1–3', "fix3: '1. Preparation' wissen", fix3, 'niet-gedragen', wipe(PREP));
await proof('plek 1', 'fix3: wissen + projectnaam', fix3, 'niet-gedragen', (x) => { wipe(PREP)(x); x.project.name = 'Andere naam'; });
await proof('plek 3', 'fix3: wissen + Earthworks hernoemen', fix3, 'niet-gedragen', (x) => {
  wipe(PREP)(x); x.tasks.find(t => t.name.startsWith('2. Earthworks'))!.name = 'Earthworks hernoemd';
});
await proof('plek 3', 'fix3: wissen + elke andere taak een notitie', fix3, 'niet-gedragen', (x) => {
  wipe(PREP)(x);
  for (const t of x.tasks) t.notes = [{ id: 'n1', text: 'x', createdAt: '2026-11-10T00:00:00' }] as never;
});
await proof('plek 2–3', 'fix3: wissen + elke andere taak hernoemd', fix3, 'niet-gedragen', (x) => { wipe(PREP)(x); for (const t of x.tasks) t.name = `${t.name} *`; });
// Plek 2 apart: elke taak krijgt een veld in `time` waar de writer niets uit schrijft. De werkweek en `OPS_Calendar`
// blijven onverklaard: geen bewerking van de kalender. Sinds fixronde 5 verklaart een deel van `time` alleen de tijdslots
// die de writer eruit schrijft (`TASKTIME_SLOT_FIELDS`), dus ook de tijden van de taken blijven onverklaard. Tot fixronde 4
// verklaarde elke wijziging in `time` elk tijdslot (VERVOLG van Terra).
const CALENDAR_DETAIL = /^niet-(gedragen|eenduidig): IFC(TIMEPERIOD|RECURRENCEPATTERN|WORKTIME|WORKCALENDAR|PROPERTYSET #\d+ \(OPS_Calendar\)|PROPERTYSINGLEVALUE #\d+ \((LiteralTimes|WorkStartHour|WorkEndHour|HoursPerDay|IsHourCalendar)\))/;
const p2 = await proof('plek 2', 'fix3: wissen + elke andere taak een veld in `time` (de kalender blijft onverklaard)', fix3, 'niet-gedragen', (x) => {
  wipe(PREP)(x); for (const t of x.tasks) (t.time as unknown as Record<string, unknown>).zonderBetekenis = 1;
});
ok(`${p2.label}: de kalender staat bij de weigeringen`, p2.details.some(x => CALENDAR_DETAIL.test(x)));
ok(`${p2.label}: een deel van \`time\` zonder slot verklaart geen tijdslot (${p2.details.filter(x => !CALENDAR_DETAIL.test(x)).slice(0, 1).join('')})`,
  p2.details.some(x => /^niet-gedragen: IFCTASKTIME #\d+, argument \d+ na de bewerking: /.test(x)));
// Zonder de wissing schrijven dezelfde bewerkingen (de controle dat de proeven hierboven om de wissing weigeren).
await proof('plek 3', 'fix3: elke taak hernoemd (zonder wissen)', fix3, 'schrijft', (x) => { for (const t of x.tasks) t.name = `${t.name} *`; });
await proof('plek 1', 'fix3: projectnaam (zonder wissen)', fix3, 'schrijft', (x) => { x.project.name = 'Andere naam'; });

// ── B2: een duur met dagen vóór T (knownbug 1027), en een duur met weken (knownbug 1028) ──
const T55 = "#55=IFCTASKTIME('CPT soundings & soil investigation Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M3D'";
ok('B2: de taaktijd #55 staat in de showcase', showcase.includes(T55));
const cpt = (o: Opened) => o.tasks.find(q => q.name === 'CPT soundings & soil investigation')!;
const p2dt12h = latin1(showcase.replace(T55, T55.replace("'P0Y0M3D'", "'P2DT12H'")));
await proof('B2, plek 7', 'Terra m1: P2DT12H, de duur expliciet op 720 en de taak hernoemd', p2dt12h, 'duur-deels-gelezen', (x, o) => {
  const q = x.tasks.find(z => z.id === cpt(o).id)!; q.time.durationMinutes = 720; q.name = 'Hernoemd';
});
await proof('B2', 'P2DT12H zonder bewerking', p2dt12h, 'duur-deels-gelezen');
await proof('B2', 'P0Y0M3D (dagen zonder tijddeel) schrijft', latin1(showcase), 'schrijft', (x, o) => { x.tasks.find(z => z.id === cpt(o).id)!.name = 'Hernoemd'; },
  has(/IFCTASKTIME\('Hernoemd Time',\.PREDICTED\.,\$,\.WORKTIME\.,'P0Y0M3D'/));
await proof('B2', 'P1W (weken: de lezer leest geen weken, knownbug 1028)', latin1(showcase.replace(T55, T55.replace("'P0Y0M3D'", "'P1W'"))), 'duur-deels-gelezen');

// ── Fixronde 5, BLOKKEERT 1 (plek 7): de duur na dezelfde tekstdecodering als de lezer ──
// `P2\X2\0044\X0\T12H` is na STEP-decodering `P2DT12H`. De lezer decodeert, dus de toets ook, met dezelfde regel per
// stuk (`index.tokenText`). `\S\` codeert alleen tekens 128 tot 255, en kan dus geen `D`, `T` of komma vormen.
const t55 = (dur: string, src = showcase) => latin1(src.replace(T55, T55.replace("'P0Y0M3D'", `'${dur}'`)));
const rename55 = (x: Domain, o: Opened) => { x.tasks.find(z => z.id === cpt(o).id)!.name = 'Hernoemd'; };
const m1 = (x: Domain, o: Opened) => { const q = x.tasks.find(z => z.id === cpt(o).id)!; q.time.durationMinutes = 720; q.name = 'Hernoemd'; };
for (const dur of ['P2\\X2\\0044\\X0\\T12H', 'P2\\X\\44T12H', 'P2\\X4\\00000044\\X0\\T12H']) {
  await proof('BLOKKEERT 1, plek 7', `Sol en Terra: ${dur} (P2DT12H in STEP-codering), de duur 720 en de taak hernoemd`, t55(dur), 'duur-deels-gelezen', m1);
  await proof('BLOKKEERT 1, plek 7', `${dur} zonder bewerking`, t55(dur), 'duur-deels-gelezen');
}
await proof('BLOKKEERT 1', 'P0Y0M\\X\\33D (P0Y0M3D in STEP-codering), de taak hernoemd: schrijft', t55('P0Y0M\\X\\33D'), 'schrijft', rename55);
// De oude letterlijke codering (een eigen bestand van versie 0.1): de lezer decodeert dan niet en leest de tekst zoals hij
// er staat. Die tekst is geen duur van ISO 8601: ook dan weigert de merge (knownbug 1030).
const literal = showcase.replace("#5=IFCAPPLICATION(#4,'0.2','Open Planner Studio','OPS');", "#5=IFCAPPLICATION(#4,'0.1','Open Planner Studio','OPS');");
ok('BLOKKEERT 1: de showcase heeft de eigen applicatie in versie 0.2', literal !== showcase);
await proof('BLOKKEERT 1', 'letterlijke codering: P2\\X2\\0044\\X0\\T12H, de taak hernoemd', t55('P2\\X2\\0044\\X0\\T12H', literal), 'duur-deels-gelezen', rename55);
await proof('BLOKKEERT 1', 'letterlijke codering: P0Y0M3D, de taak hernoemd: schrijft', t55('P0Y0M3D', literal), 'schrijft', rename55);

// ── Fixronde 5, BLOKKEERT 2: een duur met een decimale komma (knownbug 1029, besluit van Trias) ──
// De lezer leest `P1,5D` als 5 dagen en `PT4,5H` als 300 minuten. Weigeren als deels gelezen, tot de fix in main staat.
for (const dur of ['P1,5D', 'P0Y0M1,5D', 'PT4,5H', 'P1\\X\\2C5D', 'PT4\\X2\\002C\\X0\\5H']) {
  await proof('BLOKKEERT 2', `Terra: ${dur}, de taak hernoemd`, t55(dur), 'duur-deels-gelezen', rename55);
}
await proof('BLOKKEERT 2', 'P1.5D (een punt), de taak hernoemd: schrijft', t55('P1.5D'), 'schrijft', rename55, has("'P1.5D'"));

// ── Fixronde 5, zoektocht punt 4: een duur buiten de vorm van ISO 8601 (knownbug 1030) ──
// De lezer zoekt een getal voor `D` of `H` ergens in de tekst: `p3d` geeft 0 dagen, `P1E1D` 10, `PT1H1H` 60 minuten,
// `PT30M12H` 750. Een ander programma weigert zo'n waarde of leest haar anders. Weigeren als deels gelezen.
for (const dur of ['p3d', 'P3d', 'P1E1D', 'PT1H1H', 'PT30M12H', 'P', 'PT', '']) {
  await proof('zoektocht 4', `'${dur}' (geen vorm van ISO 8601), de taak hernoemd`, t55(dur), 'duur-deels-gelezen', rename55);
}
// Vormen die de lezer leest zoals ze bedoeld zijn: schrijven. `P0Y0M-2D` is de oude eigen vorm van een negatieve duur.
for (const dur of ['PT90M', 'PT3600S', 'PT0.5H', 'P0DT12H', 'P0Y0M-2D', '-P2D']) {
  await proof('zoektocht 4', `'${dur}', de taak hernoemd: schrijft`, t55(dur), 'schrijft', rename55);
}

// ── Fixronde 5, zoektocht punt 4: een datum-tijd of tijd die de lezer anders leest (knownbug 1030) ──
// De lezer laat een tijdzone weg (`parseImportedInstant`, `clockToMinutes`) en leest geen seconden. Na een spatie in plaats
// van `T` leest hij de tijd niet (00:00). Een ander programma leest `Z` als UTC, dus een uur of twee anders.
{
  const l55 = lineOf(latin1(showcase), '55');
  const start55 = "'2027-03-01T07:00:00','2027-03-03T16:00:00'";
  ok('zoektocht 4: #55 begint op 2027-03-01T07:00:00', l55.includes(`'P0Y0M3D',${start55}`));
  const startAs = (v: string) => latin1(showcase.replace(l55, l55.replace(`'P0Y0M3D',${start55}`, `'P0Y0M3D','${v}','2027-03-03T16:00:00'`)));
  for (const v of ['2027-03-01T07:00:00Z', '2027-03-01T07:00:00+02:00', '2027-03-01 07:00:00', '2027-03-01T07:00:30']) {
    await proof('zoektocht 4', `ScheduleStart '${v}', de taak hernoemd`, startAs(v), 'tijd-deels-gelezen', rename55);
  }
  for (const v of ['2027-03-01T07:00:00.000', '2027-03-01T07:00']) {
    await proof('zoektocht 4', `ScheduleStart '${v}', de taak hernoemd: schrijft`, startAs(v), 'schrijft', rename55, has(`'${v}'`));
  }
  const tp = /^#(\d+)=IFCTIMEPERIOD\('07:00:00','12:00:00'\);$/m.exec(showcase);
  ok('zoektocht 4: de showcase heeft het tijdblok 07:00–12:00', tp !== null);
  if (tp) {
    const period = (a: string, b: string) => latin1(showcase.replace(tp[0], `#${tp[1]}=IFCTIMEPERIOD('${a}','${b}');`));
    for (const [a, b] of [['07:00:00Z', '12:00:00Z'], ['07:00:00', '12:00:00+01:00'], ['07:00:30', '12:00:00'], ['7:00:00', '12:00:00'], ['0700', '1200']]) {
      await proof('zoektocht 4', `IfcTimePeriod '${a}'–'${b}', de taak hernoemd`, period(a, b), 'tijd-deels-gelezen', rename55);
    }
    await proof('zoektocht 4', "IfcTimePeriod '07:00'–'12:00', de taak hernoemd: schrijft", period('07:00', '12:00'), 'schrijft', rename55);
  }
}

// ── B3: een compact XER-archief, via dezelfde ingang als openen ──
{
  const xer = readXER(read('tests/browser/fixtures/xer/zonder-bijzonderheden.xer'));
  const result = isMultiDocumentImport(xer) ? xer.results[0] : xer;
  ok('B3: de XER-planning heeft een bronarchief', result.xerSourceArchive !== undefined);
  const ifc = writeIFC(result);
  ok('B3: de IFC heeft een compact archief', ifc.includes('OPS_XerSourceArchive'));
  const bytes = new TextEncoder().encode(withLines(ifc, REVIT_WALL));
  const plain = await proof('B3, plek 33', 'XER → IFC (compact) + wand, zonder bewerking', bytes, 'schrijft');
  const sha = (await openForeign(bytes)).xerSourceArchive?.sha256;
  ok('B3: het bronarchief komt na de merge terug', sha !== undefined && plain.out !== undefined && (await openForeign(plain.out)).xerSourceArchive?.sha256 === sha);
  await proof('B3, plek 33', 'XER → IFC (compact) + wand, een taak hernoemd', bytes, 'schrijft', (x) => { x.tasks.find(t => t.childIds.length === 0)!.name = 'Hernoemd'; },
    has("'Hernoemd'"));
}

// ── B4: getallen en duren exact ──
// Een getal dat de lezer afrondt, is een ander getal: de toets ziet het verschil, en (b) zet de bronwaarde terug (de
// uitvoer houdt het getal van de bron). Tot fixronde 4 telde het als gelijk en schreef de writer zijn afgeronde getal.
const e0 = latin1(setLine(eigen, 39, "#39=IFCPROPERTYSINGLEVALUE('HoursPerDay',$,IFCREAL(8.0000000000000001),$);"));
await proof('B4, plek 17', 'Terra e0: HoursPerDay 8.0000000000000001 blijft', e0, 'schrijft', undefined, has('IFCREAL(8.0000000000000001)'));
await proof('B4, plek 17', 'e0, de taak hernoemd: HoursPerDay blijft', e0, 'schrijft', (x) => { x.tasks.find(q => q.id === taskBy(eigenOpened, 63).id)!.name = 'X'; },
  has('IFCREAL(8.0000000000000001)'));
await proof('B4, plek 17', 'e0, de planner zet 9 uur per dag: zijn waarde', e0, 'schrijft', (x) => { x.calendar.hoursPerDay = 9; }, has('IFCREAL(8.0000000000000001)', false));
await proof('B4, plek 18', 'e1: duur P0Y0M6.0000000000000001D blijft', latin1(setLine(eigen, 62, lineOf(latin1(eigen), '62').replace("'P0Y0M6D'", "'P0Y0M6.0000000000000001D'"))),
  'schrijft', undefined, has("'P0Y0M6.0000000000000001D'"));
await proof('B4', 'HoursPerDay 8.0E0 (dezelfde waarde) schrijft', latin1(setLine(eigen, 39, "#39=IFCPROPERTYSINGLEVALUE('HoursPerDay',$,IFCREAL(8.0E0),$);")), 'schrijft');
await proof('B4', 'HoursPerDay 9007199254740993 (boven 2^53) blijft', latin1(setLine(eigen, 39, "#39=IFCPROPERTYSINGLEVALUE('HoursPerDay',$,IFCREAL(9007199254740993.),$);")),
  'schrijft', undefined, has('IFCREAL(9007199254740993.)'));

// ── B5 en plek 26, 27, 29: niet eenduidig paren ──
{
  // Sol (plek 29): twee gelijke toewijzingen van #109 aan #63; alleen de eerste property heeft een Description.
  let s = setLine(eigen, 145, "#145=IFCRELASSIGNSTOPROCESS('0qaSpDMFm3_b9f8mO9$CFm',#6,$,$,(#109,#109,#110),$,#63,$);");
  s = setLine(s, 152, "#152=IFCPROPERTYSINGLEVALUE('3LKE2mEiGfOR4VMIq3h_xv#0','BEWAAR-DIT',IFCTEXT('1|UNIFORM'),$);");
  s = setLine(s, 153, "#153=IFCPROPERTYSINGLEVALUE('34SuBObt1dKPNSent0osWG#2',$,IFCTEXT('2|UNIFORM'),$);");
  s = after(s, 152, "#9152=IFCPROPERTYSINGLEVALUE('3LKE2mEiGfOR4VMIq3h_xv#1',$,IFCTEXT('1|UNIFORM'),$);");
  s = setLine(s, 154, "#154=IFCPROPERTYSET('26EUCC2ORYjlLXgzsMT4U9',#6,'OPS_Assignments',$,(#152,#9152,#153));");
  const bytes = latin1(s);
  const o = await openForeign(bytes);
  const t = taskBy(o, 63);
  const r109 = resBy(o, 109);
  const dropNth = (n: number) => (x: Domain) => {
    let k = -1;
    x.assignments = x.assignments.filter(a => !(a.taskId === t.id && a.resourceId === r109.id && ++k === n));
  };
  await proof('B5, plek 29', 'Sol a0: twee gelijke toewijzingen, zonder bewerking', bytes, 'schrijft', undefined, has("'BEWAAR-DIT'"));
  await proof('B5, plek 29', 'Sol a1: de eerste toewijzing van #109 wissen', bytes, 'niet-eenduidig', dropNth(0));
  await proof('B5, plek 29', 'Sol a2: de tweede toewijzing van #109 wissen', bytes, 'niet-eenduidig', dropNth(1));
  await proof('B5, plek 29', 'een volgordeverschuiving: de eerste toewijzing van #109 achteraan', bytes, 'niet-eenduidig', (x) => {
    const i = x.assignments.findIndex(a => a.taskId === t.id && a.resourceId === r109.id);
    const [a] = x.assignments.splice(i, 1);
    x.assignments.push(a);
  });
}
{
  // Zoektocht punt 2 (fixronde 5): de properties van `OPS_Assignments` heten `<resource-GUID>#<plek in de lijst>`. Het paren
  // gaat op de resource; de plek schuift bij wissen. De eerste toewijzing van #63 (#109) heeft een bronwaarde die de lezer
  // niet draagt. Wissen plus verplaatsen en verwisselen mogen die niet naar een andere toewijzing laten verhuizen.
  const bytes = latin1(setLine(eigen, 152, "#152=IFCPROPERTYSINGLEVALUE('3LKE2mEiGfOR4VMIq3h_xv#0','BEWAAR-DIT',IFCTEXT('1|UNIFORM'),$);"));
  ok('zoektocht 2: #63 heeft de toewijzingen #109 en #110', lineOf(latin1(eigen), '145').includes(',(#109,#110),$,#63,'));
  const o = await openForeign(bytes);
  const t = taskBy(o, 63);
  const r109 = resBy(o, 109);
  const r110 = resBy(o, 110);
  const of = (x: Domain, r: { id: string }) => x.assignments.find(a => a.taskId === t.id && a.resourceId === r.id)!;
  const kept = (out: Uint8Array) => (linesOfType(out, 'IFCPROPERTYSINGLEVALUE').some(l => /^#\d+=IFCPROPERTYSINGLEVALUE\('3LKE2mEiGfOR4VMIq3h_xv#0','BEWAAR-DIT',IFCTEXT\('3\|UNIFORM'\)/.test(l))
    ? undefined : 'BEWAAR-DIT staat niet op de toewijzing van #109 met 3 eenheden');
  await proof('zoektocht 2', 'toewijzingen: zonder bewerking', bytes, 'schrijft', undefined, has("'BEWAAR-DIT'"));
  await proof('zoektocht 2', 'toewijzingen: de eenheden van #109 op 3 (de bronwaarde blijft)', bytes, 'schrijft', (x) => { of(x, r109).unitsPerDay = 3; }, kept);
  await proof('zoektocht 2', 'toewijzingen: een nieuwe toewijzing achteraan (de bronwaarde blijft)', bytes, 'schrijft', (x) => {
    of(x, r109).unitsPerDay = 3;
    x.assignments.push({ ...of(x, r110), id: 'nieuw', resourceId: resBy(o, 111).id });
  }, kept);
  await proof('zoektocht 2', 'toewijzingen: #109 wissen en #110 naar #109 zetten', bytes, 'niet-eenduidig', (x) => {
    const b = of(x, r110);
    x.assignments = x.assignments.filter(a => a !== of(x, r109));
    b.resourceId = r109.id;
  });
  await proof('zoektocht 2', 'toewijzingen: de resources van #109 en #110 verwisseld', bytes, 'niet-eenduidig', (x) => {
    const a = of(x, r109);
    const b = of(x, r110);
    [a.resourceId, b.resourceId] = [r110.id, r109.id];
  });
  await proof('zoektocht 2', 'toewijzingen: alleen #110 gewist (bij twijfel weigeren)', bytes, 'niet-eenduidig', (x) => {
    x.assignments = x.assignments.filter(a => a !== of(x, r110));
  });
  await proof('zoektocht 2', 'toewijzingen: #109 gewist (de bronwaarde verdwijnt met het stuk: weigeren)', bytes, 'niet-gedragen', (x) => {
    x.assignments = x.assignments.filter(a => a !== of(x, r109));
  });
  // Zonder bronwaarde weigert niets hiervan.
  await proof('zoektocht 2', 'zonder bronwaarde: #109 wissen en #110 naar #109 zetten', latin1(eigen), 'schrijft', (x) => {
    const b = of(x, r110);
    x.assignments = x.assignments.filter(a => a !== of(x, r109));
    b.resourceId = r109.id;
  });
  await proof('zoektocht 2', 'zonder bronwaarde: de resources verwisseld', latin1(eigen), 'schrijft', (x) => {
    const a = of(x, r109);
    const b = of(x, r110);
    [a.resourceId, b.resourceId] = [r110.id, r109.id];
  });
}
{
  // Plek 26: twee gelijke eigen psets `OPS_Calendar` op de kalender, elk met een eigen relatie.
  const twice = after(eigen, 41, "#9039=IFCPROPERTYSINGLEVALUE('HoursPerDay',$,IFCREAL(8.),$);\n#9040=IFCPROPERTYSET('0yQpbypZj4u9f68zIkoEO1',#6,'OPS_Calendar',$,(#9039));\n#9041=IFCRELDEFINESBYPROPERTIES('0EGdQpeHVqDZMJewwgwnUd',#6,$,$,(#38),#9040);");
  await proof('B5, plek 26', 'f0: OPS_Calendar twee keer op de kalender', latin1(twice), 'niet-eenduidig');
  await proof('B5, plek 26', 'f1: de tweede met een andere waarde', latin1(twice.replace("IFCREAL(8.),$);\n#9040", "IFCREAL(8.),'BEWAAR-TWEEDE');\n#9040")), 'niet-eenduidig');
}
{
  // Plek 27: werktijden met dezelfde naam (een feestdag per jaar). Een bronwaarde die de lezer niet draagt, staat op #21.
  const bytes = latin1(setLine(eigen, 21, "#21=IFCWORKTIME('Good Friday',.USERDEFINED.,'BEWAAR-21',$,'2027-03-26','2027-03-26');"));
  const gf = (year: string) => (out: Uint8Array) => linesOfType(out, 'IFCWORKTIME').find(l => l.includes(`'${year}-`) && l.includes("'Good Friday'"));
  const on2027 = (out: Uint8Array) => (gf('2027')(out)?.includes("'BEWAAR-21'") && !gf('2028')(out)?.includes('BEWAAR-21') ? undefined : `BEWAAR-21 niet (alleen) op Good Friday 2027: ${gf('2027')(out)} | ${gf('2028')(out)}`);
  await proof('B5, plek 27', 'c0: Good Friday 2027 met een bronwaarde, zonder bewerking', bytes, 'schrijft', undefined, on2027);
  await proof('B5, plek 27', 'c1: Good Friday 2027 hernoemd', bytes, 'niet-eenduidig', (x) => {
    x.calendar.holidays!.find(q => q.name === 'Good Friday' && q.startDate === '2027-03-26')!.name = 'Goede Vrijdag';
  });
  await proof('B5, plek 27', 'c2: Good Friday 2027 gewist (de bronwaarde gaat mee, niet naar 2028)', bytes, 'schrijft', (x) => {
    x.calendar.holidays = x.calendar.holidays!.filter(q => !(q.name === 'Good Friday' && q.startDate === '2027-03-26'));
  }, has('BEWAAR-21', false));
  await proof('B5, plek 27', 'c3: een nieuwe Good Friday 2026 vooraan (de bronwaarde blijft op 2027)', bytes, 'schrijft', (x) => {
    x.calendar.holidays = [{ name: 'Good Friday', startDate: '2026-04-03', endDate: '2026-04-03' } as never, ...x.calendar.holidays!];
  }, on2027);
  // BLOKKEERT 3 (fixronde 5, Sol): naam plus datum is geen identiteit. De kalenderdialoog wijzigt en wist per plek in de
  // lijst. Verdween een feestdag van de bron, kreeg er een een andere naam of datum, of staan ze in een andere volgorde, dan
  // kan elke feestdag met een andere verwisseld zijn: dan gaat geen bronwaarde over en weigert de merge.
  const gfAt = (x: Domain, year: string) => x.calendar.holidays!.findIndex(q => q.name === 'Good Friday' && q.startDate.startsWith(year));
  const to2027 = (x: Domain) => { const h = x.calendar.holidays![gfAt(x, '2028')]; h.startDate = '2027-03-26'; h.endDate = '2027-03-26'; };
  const drop = (year: string) => (x: Domain) => { x.calendar.holidays!.splice(gfAt(x, year), 1); };
  await proof('BLOKKEERT 3, plek 27', 'Sol: alleen 2028 naar de datum van 2027', bytes, 'niet-eenduidig', to2027);
  await proof('BLOKKEERT 3, plek 27', 'Sol: 2027 wissen en 2028 naar de datum van 2027', bytes, 'niet-eenduidig', (x) => { drop('2027')(x); to2027(x); });
  await proof('BLOKKEERT 3, plek 27', 'Sol: de datums van 2027 en 2028 verwisseld', bytes, 'niet-eenduidig', (x) => {
    const a = x.calendar.holidays![gfAt(x, '2027')];
    const b = x.calendar.holidays![gfAt(x, '2028')];
    [a.startDate, a.endDate, b.startDate, b.endDate] = [b.startDate, b.endDate, a.startDate, a.endDate];
  });
  await proof('BLOKKEERT 3, plek 27', 'de namen van Good Friday 2027 en Easter 2027 verwisseld', bytes, 'niet-eenduidig', (x) => {
    const h = x.calendar.holidays!;
    const a = h[gfAt(x, '2027')];
    const b = h.find(q => q.name === 'Easter' && q.startDate.startsWith('2027'))!;
    [a.name, b.name] = [b.name, a.name];
  });
  // Een andere datum zonder wissen: de sleutel van de feestdag veranderde, dus gaat de bronwaarde niet over (en niet stil
  // weg: zonder zekere wissing telt een verdwenen lid niet als gewist, `deletedExceptionItems`).
  await proof('BLOKKEERT 3, plek 27', 'Good Friday 2027 een dag later (geen wissing)', bytes, 'niet-eenduidig', (x) => {
    const h = x.calendar.holidays![gfAt(x, '2027')]; h.startDate = '2027-03-27'; h.endDate = '2027-03-27';
  });
  await proof('BLOKKEERT 3, plek 27', 'een andere feestdag gewist en een nieuwe erbij (geen zekere wissing)', bytes, 'niet-eenduidig', (x) => {
    const h = x.calendar.holidays!;
    h.splice(h.findIndex(q => q.name === 'Christmas' && q.startDate.startsWith('2028')), 1);
    h.push({ name: 'Extra', startDate: '2029-01-02', endDate: '2029-01-02' } as never);
  });
  // Bij twijfel weigeren: wist de planner alleen 2028, dan is uit de uitvoer niet te zien of 2027 bleef, of dat hij 2027
  // wiste en 2028 naar 2027 zette (de uitvoer is dan bijna gelijk). Dan weigert de merge ook.
  await proof('BLOKKEERT 3, plek 27', 'alleen Good Friday 2028 gewist (bij twijfel weigeren)', bytes, 'niet-eenduidig', drop('2028'));
  await proof('BLOKKEERT 3, plek 27', 'een nieuwe feestdag achteraan (de bronwaarde blijft op 2027)', bytes, 'schrijft', (x) => {
    x.calendar.holidays!.push({ name: 'Extra', startDate: '2029-01-02', endDate: '2029-01-02' } as never);
  }, on2027);
  // Zonder bronwaarde op een feestdag weigert niets van dit alles.
  for (const [label, edit] of [['2027 wissen en 2028 naar de datum van 2027', (x: Domain) => { drop('2027')(x); to2027(x); }],
    ['alleen 2028 gewist', drop('2028')], ['Good Friday 2027 een dag later', (x: Domain) => {
      const h = x.calendar.holidays![gfAt(x, '2027')]; h.startDate = '2027-03-27'; h.endDate = '2027-03-27';
    }]] as const) {
    await proof('BLOKKEERT 3', `zonder bronwaarde: ${label}`, latin1(eigen), 'schrijft', edit);
  }
}

// ── B6 en plek 8 tot 10: waarden die de lezer deels leest ──
{
  const t = taskBy(eigenOpened, 63);
  const r109 = resBy(eigenOpened, 109);
  const units2 = (x: Domain) => { for (const a of x.assignments) if (a.taskId === t.id && a.resourceId === r109.id) a.unitsPerDay = 2; };
  const b = latin1(setLine(eigen, 152, "#152=IFCPROPERTYSINGLEVALUE('3LKE2mEiGfOR4VMIq3h_xv#0',$,IFCTEXT('1|UNIFORM|BEWAAR-DIT'),$);"));
  await proof('B6, plek 8', 'Sol b0: 1|UNIFORM|BEWAAR-DIT, zonder bewerking', b, 'schrijft', undefined, has("'1|UNIFORM|BEWAAR-DIT'"));
  await proof('B6, plek 8', 'Sol b1: 1|UNIFORM|BEWAAR-DIT, eenheden 1 → 2', b, 'niet-gedragen', units2);
  const vendor = latin1(setLine(eigen, 152, "#152=IFCPROPERTYSINGLEVALUE('3LKE2mEiGfOR4VMIq3h_xv#0',$,IFCTEXT('1|VENDORCURVE'),$);"));
  await proof('B6, plek 8', 'b3: 1|VENDORCURVE, eenheden 1 → 2', vendor, 'niet-gedragen', units2);
  const abc = latin1(setLine(eigen, 152, "#152=IFCPROPERTYSINGLEVALUE('3LKE2mEiGfOR4VMIq3h_xv#0',$,IFCTEXT('1.5abc|UNIFORM'),$);"));
  await proof('B6, plek 8', 'b5: 1.5abc|UNIFORM, de taak hernoemd', abc, 'schrijft', (x) => { x.tasks.find(q => q.id === t.id)!.name = 'X'; }, has("'1.5abc|UNIFORM'"));
  // AvailabilitySteps (`datum:eenheden;…`): de lezer splitst en neemt een getal; een deel erachter draagt hij niet.
  // In de eigen `OPS_Resource` van #110 (#122), op de plek waar de writer haar schrijft (vóór ParentGuid #121).
  const pset122 = lineOf(latin1(eigen), '122');
  ok('B6: #122 is de OPS_Resource van #110 met ParentGuid als laatste', pset122.endsWith(',#121));'));
  const steps = latin1(after(setLine(eigen, 122, pset122.replace(',#121));', ',#9201,#121));')), 120,
    "#9201=IFCPROPERTYSINGLEVALUE('AvailabilitySteps',$,IFCTEXT('2027-01-04:2;2027-06-01:1x'),$);"));
  await proof('B6', 'AvailabilitySteps met een deel dat de lezer niet draagt, zonder bewerking', steps, 'schrijft', undefined, has("'2027-01-04:2;2027-06-01:1x'"));
  await proof('B6', 'AvailabilitySteps: de planner wijzigt de beschikbaarheid', steps, 'niet-gedragen', (x, o) => {
    const r = x.resources.find(q => q.id === resBy(o, 110).id)!;
    r.availabilitySteps = [...(r.availabilitySteps ?? []), { from: '2027-09-01', maxUnits: 3 }];
  });
  // Plek 5: de planner wist het veld; de property verdwijnt uit O1 terwijl de resource blijft. Ook dan weigert de merge
  // (een waarde die de lezer deels draagt, `lostPartial`), want het deel dat de lezer niet draagt, ging mee.
  await proof('B6, plek 5', 'AvailabilitySteps: de planner wist de beschikbaarheid', steps, 'niet-gedragen', (x, o) => {
    x.resources.find(q => q.id === resBy(o, 110).id)!.availabilitySteps = undefined;
  });
  // BLOKKEERT 4 (fixronde 5, Sol): het wissen van een bekende waarde verklaart niet het wissen van een slot ernaast dat de
  // lezer niet draagt, van welke soort ook. De writer schrijft die slots altijd hetzelfde (`CONSTANT_SLOTS`).
  const wipeSteps = (x: Domain, o: Opened) => { x.resources.find(q => q.id === resBy(o, 110).id)!.availabilitySteps = undefined; };
  const addStep = (x: Domain, o: Opened) => {
    const r = x.resources.find(q => q.id === resBy(o, 110).id)!;
    r.availabilitySteps = [...(r.availabilitySteps ?? []), { from: '2027-09-01', maxUnits: 3 }];
  };
  const stepsWith = (description: string) => latin1(after(setLine(eigen, 122, pset122.replace(',#121));', ',#9201,#121));')), 120,
    `#9201=IFCPROPERTYSINGLEVALUE('AvailabilitySteps',${description},IFCTEXT('2027-01-04:2;2027-06-01:1'),$);`));
  const described = stepsWith("'BEWAAR-BESCHRIJVING'");
  await proof('BLOKKEERT 4, plek 5', 'tekst: AvailabilitySteps met een Description, zonder bewerking', described, 'schrijft', undefined, has("'BEWAAR-BESCHRIJVING'"));
  await proof('BLOKKEERT 4, plek 5', 'tekst: idem, met een extra stap', described, 'schrijft', addStep, has("'BEWAAR-BESCHRIJVING'"));
  await proof('BLOKKEERT 4, plek 5', 'Sol: tekst: de planner wist de beschikbaarheid', described, 'niet-gedragen', wipeSteps);
  await proof('BLOKKEERT 4', 'zonder Description: de beschikbaarheid wissen schrijft', stepsWith('$'), 'schrijft', wipeSteps, has("'AvailabilitySteps'", false));
  // Enumeratie: de herkomst van een lag (`IfcLagTime` #97 van relatie #98, DataOrigin). Wist de planner de lag, dan schrijft
  // de writer geen `IfcLagTime` meer.
  ok('BLOKKEERT 4: #98 is de relatie met lag #97', lineOf(latin1(eigen), '98').includes(',#97,'));
  const seq98 = (x: Domain, o: Opened) => x.sequences.find(q => q.id === o.sequences.find(z => o.ifcSource!.stepIds[`seq:${z.id}`] === 98)!.id)!;
  const noLag = (x: Domain, o: Opened) => { const q = seq98(x, o); q.lagDays = 0; delete q.lagMinutes; delete q.lagPercent; };
  const measured = latin1(setLine(eigen, 97, "#97=IFCLAGTIME('Lag',.MEASURED.,$,IFCDURATION('P2D'),.WORKTIME.);"));
  await proof('BLOKKEERT 4', 'enumeratie: een lag met DataOrigin .MEASURED., zonder bewerking', measured, 'schrijft', undefined, has("IFCLAGTIME('Lag',.MEASURED.,"));
  await proof('BLOKKEERT 4', 'enumeratie: idem, de lag een dag langer', measured, 'schrijft', (x, o) => { seq98(x, o).lagDays = 3; }, has(/IFCLAGTIME\('Lag',\.MEASURED\.,\$,IFCDURATION\('[^']*3D'\)/));
  await proof('BLOKKEERT 4', 'enumeratie: de planner wist de lag', measured, 'niet-gedragen', noLag);
  await proof('BLOKKEERT 4', 'zonder bronwaarde: de lag wissen schrijft', latin1(eigen), 'schrijft', noLag);
  // Getal: een werkweek met twee groepen (de vrijdag korter), waarvan het patroon van de vrijdag Interval 1 heeft (een slot
  // dat de writer leeg laat). Maakt de planner de week weer gelijk, dan verdwijnt de groep van de vrijdag.
  const band = { start: 420, end: 960 };
  const week = (fri: { start: number; end: number }) => ({ byWeekday: { 1: [band], 2: [band], 3: [band], 4: [band], 5: [fri], 6: [], 7: [] } });
  const perDay = cloneDomain(eigenOpened);
  perDay.calendar.workTime = week({ start: 420, end: 720 });
  const perDayText = text(await settle(latin1(withLines(writeIFC(perDay), REVIT_WALL))));
  const fridayPattern = /^#(\d+)=IFCRECURRENCEPATTERN\(\.WEEKLY\.,\$,\(5\),\$,\$,\$,\$,(\(#\d+\))\);$/m.exec(perDayText);
  ok('BLOKKEERT 4: de werkweek per dag heeft een eigen patroon voor de vrijdag', fridayPattern !== null);
  if (fridayPattern) {
    const interval = latin1(perDayText.replace(fridayPattern[0], `#${fridayPattern[1]}=IFCRECURRENCEPATTERN(.WEEKLY.,$,(5),$,$,1,$,${fridayPattern[2]});`));
    const uniform = (x: Domain) => { x.calendar.workTime = week(band); };
    await proof('BLOKKEERT 4', 'getal: Interval 1 op het patroon van de vrijdag, zonder bewerking', interval, 'schrijft', undefined, has('(5),$,$,1,$,'));
    await proof('BLOKKEERT 4', 'getal: idem, de vrijdag een uur langer (het patroon blijft)', interval, 'schrijft', (x) => { x.calendar.workTime = week({ start: 420, end: 780 }); }, has('(5),$,$,1,$,'));
    await proof('BLOKKEERT 4', 'getal: de planner maakt de week gelijk', interval, 'niet-gedragen', uniform);
    await proof('BLOKKEERT 4', 'zonder bronwaarde: de week gelijk maken schrijft', latin1(perDayText), 'schrijft', uniform);
  }
  // ProjectStartDate: de lezer leest de eerste tien tekens.
  const settings = /^#(\d+)=IFCPROPERTYSINGLEVALUE\('ProjectStartDate',\$,(IFC(?:TEXT|DATE))\('(\d{4}-\d\d-\d\d)'\),\$\);$/m.exec(eigen);
  ok('B6: eigen-plus-model heeft ProjectStartDate', settings !== null);
  if (settings) {
    const start = latin1(setLine(eigen, Number(settings[1]), `#${settings[1]}=IFCPROPERTYSINGLEVALUE('ProjectStartDate',$,${settings[2]}('${settings[3]}T07:30:00'),$);`));
    await proof('B6', 'ProjectStartDate met een tijd, zonder bewerking', start, 'schrijft', undefined, has(`'${settings[3]}T07:30:00'`));
    await proof('B6', 'ProjectStartDate met een tijd: de planner verschuift de start', start, 'niet-gedragen', (x) => { x.project.startDate = '2027-02-01'; });
  }
  // Plek 9 en 28: een uitzondering in de eigen kalender die van een ander programma is (C), in een lijst met eigen leden.
  const cal = lineOf(latin1(eigen), '38');
  let s = setLine(eigen, 38, cal.replace('#36,#37),', '#36,#37,#9020),'));
  s = withLines(s, [
    "#9017=IFCTIMEPERIOD('00:00:00','23:59:00');",
    '#9018=IFCRECURRENCEPATTERN(.WEEKLY.,$,(7),$,$,$,$,(#9017));',
    "#9020=IFCWORKTIME('Leverancier: zondag dicht',.PREDICTED.,$,#9018,$,$);",
    "#9021=IFCPROPERTYREFERENCEVALUE('Kalenderuitzondering',$,$,#9020);",
  ]);
  const i = latin1(s);
  await proof('B6, plek 9', 'i0: een vreemde uitzondering in de eigen kalender, zonder bewerking', i, 'schrijft', undefined, (out) => (lineOf(out, '38').includes('#9020') ? undefined : 'de kalender mist #9020'));
  await proof('B6, plek 9 en 28', 'i1: een feestdag erbij', i, 'niet-gedragen', (x) => {
    x.calendar.holidays = [...x.calendar.holidays!, { name: 'Extra', startDate: '2027-10-01', endDate: '2027-10-01' } as never];
  });
  await proof('B6, plek 9', 'i2: een taak hernoemd (de kalender blijft)', i, 'schrijft', (x) => { x.tasks.find(q => q.id === t.id)!.name = 'X'; },
    (out) => (lineOf(out, '38').includes('#9020') ? undefined : 'de kalender mist #9020'));
}

// ── Plek 5: een bronwaarde in een regel die van type wisselt ──
{
  const bytes = latin1(setLine(eigen, 110, "#110=IFCLABORRESOURCE('34SuBObt1dKPNSent0osWG',#6,'Bricklayers',$,$,'BEWAAR-R',$,$,$,$,.NOTDEFINED.);"));
  await proof('plek 5', 'een resource met Identification, zonder bewerking', bytes, 'schrijft', undefined, has("'BEWAAR-R'"));
  // Een regel met een ander type paart niet (het paren eist hetzelfde type): O1 meldt het stuk als ontbrekend, en geen veld
  // verklaart dat (tot fixronde 4 verklaarde de vrijstelling per object het; alleen `entiteittype` weigerde).
  const r = await proof('plek 5', 'de planner maakt van de arbeidsresource materieel (ander entiteittype)', bytes, 'niet-gedragen', (x, o) => {
    x.resources.find(q => q.id === resBy(o, 110).id)!.type = 'EQUIPMENT';
  });
  ok(`plek 5: O1 meldt de resource als ontbrekend (${r.details.slice(0, 2).join(' | ')})`, r.details.some(x => /^niet-gedragen: IFCLABORRESOURCE #110\b.*ontbreekt in de uitvoer na de bewerking/.test(x)));
}

// ── Plek 19: een tekst met een ongeldige STEP-reeks ──
{
  const bytes = latin1(setLine(eigen, 63, "#63=IFCTASK('06AdBvh4v8lXgXlHO1$rfO',#6,'Build masonry walls','caf\\X2\\00E\\X0\\',$,'3.4',$,$,$,.F.,$,#62,.CONSTRUCTION.);"));
  await proof('plek 19', 'een omschrijving met een ongeldige reeks, zonder bewerking', bytes, 'schrijft', undefined, has("'caf\\X2\\00E\\X0\\'"));
  await proof('plek 19', 'idem, de taak hernoemd (de omschrijving blijft byte-gelijk)', bytes, 'schrijft', (x) => { x.tasks.find(q => q.id === taskBy(eigenOpened, 63).id)!.name = 'X'; },
    has("'caf\\X2\\00E\\X0\\'"));
}

// ── De tijd van de lezer: openen op dag 1, opslaan op dag 2 (VERMOED uit de lijst van de expert) ──
{
  // Een taak zonder ScheduleStart (`$`): de lezer neemt de datum van vandaag. Opent de planner op dag 1 en slaat hij op
  // dag 2 op, dan is het gelezen domein van de merge anders dan dat van het openen.
  const t62 = lineOf(latin1(eigen), '62');
  const noStart = latin1(setLine(eigen, 62, t62.replace(/^(#62=IFCTASKTIME\((?:[^,]*,){5})'[^']*'/, '$1$')));
  const RealDate = globalThis.Date;
  const shifted = (ms: number) => class extends RealDate {
    constructor(...a: unknown[]) { if (a.length === 0) super(RealDate.now() + ms); else super(...(a as [number])); }
    static now(): number { return RealDate.now() + ms; }
  } as unknown as DateConstructor;
  const rename63 = (x: Domain) => { x.tasks.find(q => q.id === taskBy(eigenOpened, 63).id)!.name = 'X'; };
  /** Openen op dag 1, de merge op dag 2 (de klok een dag later). */
  const nextDay = async (label: string, bytes: Uint8Array): Promise<Result> => {
    const opened = await openForeign(bytes);
    const d = cloneDomain(opened);
    rename63(d);
    globalThis.Date = shifted(86_400_000);
    let r: MergeOutcome;
    try { r = await tryMerge(d, opened.ifcSource!); } finally { globalThis.Date = RealDate; }
    const res: Result = r.ok ? { label, outcome: 'schrijft', kinds: [], details: [], out: r.bytes }
      : { label, outcome: 'weigert', kinds: r.kinds, details: r.error.cases.map(c => `${c.kind}: ${c.detail}`) };
    results.push(res);
    return res;
  };
  // Een `$` in ScheduleStart weigert al op dezelfde dag (de bronwaarde `$` geeft na herlezen een andere planning).
  const day1 = await proof('tijd', 'ScheduleStart $, openen en opslaan op dezelfde dag', noStart, 'niet-gedragen', rename63);
  const day2 = await nextDay('tijd · ScheduleStart $, openen op dag 1 en opslaan op dag 2', noStart);
  ok(`tijd: ScheduleStart $ op dag 2 zoals op dag 1 (${day1.outcome}, ${day2.outcome}: ${day2.details.slice(0, 1).join('')})`, day2.outcome === day1.outcome);
  // Zonder CreatedAt en ModifiedAt in `OPS_ProjectSettings` neemt de lezer het moment van lezen (`ifcReader.ts`). De
  // uitvoer krijgt het moment van openen, op dag 1 en op dag 2.
  const created = /^#(\d+)=IFCPROPERTYSINGLEVALUE\('CreatedAt',.*$/m.exec(eigen);
  const modified = /^#(\d+)=IFCPROPERTYSINGLEVALUE\('ModifiedAt',.*$/m.exec(eigen);
  ok('tijd: eigen-plus-model heeft CreatedAt en ModifiedAt', created !== null && modified !== null);
  if (created && modified) {
    const ids = new Set([created[1], modified[1]]);
    const settingsLine = /^#\d+=IFCPROPERTYSET\('[^']*',#\d+,'OPS_ProjectSettings',\$,\(([^)]*)\)\);$/m.exec(eigen)!;
    const members = settingsLine[1].split(',').filter(m => !ids.has(m.slice(1))).join(',');
    let noDates = eigen.replace(settingsLine[0], settingsLine[0].replace(`(${settingsLine[1]})`, `(${members})`));
    for (const id of ids) noDates = noDates.replace(new RegExp(`^#${id}=.*\n`, 'm'), '');
    const bytes = latin1(noDates);
    const a = await proof('tijd', 'zonder CreatedAt en ModifiedAt, op dezelfde dag', bytes, 'schrijft', rename63);
    const b = await nextDay('tijd · zonder CreatedAt en ModifiedAt, openen op dag 1 en opslaan op dag 2', bytes);
    const dates = (r: Result) => (r.out ? linesOfType(r.out, 'IFCPROPERTYSINGLEVALUE').filter(l => /'(CreatedAt|ModifiedAt)'/.test(l)).map(l => l.replace(/^#\d+=/, '')).join(' ') : r.details.slice(0, 1).join(''));
    ok(`tijd: zonder CreatedAt op dag 2 zoals op dag 1 (${dates(a)} | ${dates(b)})`, b.outcome === a.outcome && dates(a) === dates(b));
  }
}

// ── Fixronde 5, plek 6 (besluit van Trias): wijzigt de planner het domeinveld, dan vervalt de bronwaarde van dat slot ──
{
  // De proef van de expert (`p2-eigen.ts`, d1): Status 'ON HOLD' op #63; de lezer leest alleen 'STARTED'.
  ok("plek 6: #63 is 'Build masonry walls' zonder Status", lineOf(latin1(eigen), '63') === "#63=IFCTASK('06AdBvh4v8lXgXlHO1$rfO',#6,'Build masonry walls',$,$,'3.4',$,$,$,.F.,$,#62,.CONSTRUCTION.);");
  const onHold = latin1(setLine(eigen, 63, "#63=IFCTASK('06AdBvh4v8lXgXlHO1$rfO',#6,'Build masonry walls',$,$,'3.4',$,'ON HOLD',$,.F.,$,#62,.CONSTRUCTION.);"));
  const t63 = (x: Domain, o: Opened) => x.tasks.find(q => q.id === taskBy(o, 63).id)!;
  const complete = (x: Domain, o: Opened) => {
    const q = t63(x, o); q.time.completion = 1; q.status = 'COMPLETED' as never; q.time.actualStart = q.time.scheduleStart; q.time.actualFinish = q.time.scheduleFinish;
  };
  const statusOf = (s: string) => /^#\d+=IFCTASK\('06AdBvh4v8lXgXlHO1\$rfO',#\d+,'Build masonry walls',\$,\$,'[^']*',\$,('[^']*'|\$),/m.exec(s)?.[1];
  await proof('plek 6', "'ON HOLD', zonder bewerking", onHold, 'schrijft', undefined, has("'ON HOLD'"));
  await proof('plek 6', "'ON HOLD', de taak hernoemd (de bronwaarde blijft)", onHold, 'schrijft', (x, o) => { t63(x, o).name = 'Hernoemd'; }, has("'ON HOLD'"));
  await proof('plek 6', "'ON HOLD', het geplande begin een dag later (geen veld van de Status: de bronwaarde blijft)", onHold, 'schrijft',
    (x, o) => { t63(x, o).time.scheduleStart = '2027-05-07'; }, has("'ON HOLD'"));
  const done = await proof('plek 6', "Trias: 'ON HOLD' en dan voltooid zetten geeft de Status van de writer", onHold, 'schrijft', complete, has("'ON HOLD'", false));
  if (done.out) {
    const o = await openForeign(onHold);
    const d = cloneDomain(o);
    complete(d, o);
    const writer = statusOf(writeIFC(d));
    ok(`plek 6: de Status na voltooien is die van de writer (${statusOf(text(done.out))} = ${writer})`, writer !== undefined && statusOf(text(done.out)) === writer);
  }
}

// ── Fixronde 5, plek 34 (besluit van Trias): een nieuwe pset mag alleen als het een van onze registerpsets is ──
{
  // De proef van de expert (`p4-toevoeging.ts`, o2): de `OPS_Assignments` van #63 (#152 tot #155) weg uit de bron. De writer
  // schrijft haar weer, als nieuwe pset zonder bron. Een pset buiten het register schrijft de writer niet; die toetst
  // `check-ifc-foreign-preserve.ts` (sectie 5g, plek 34) met een O1 die de proef zelf bouwt.
  const noAsg = [152, 153, 154, 155].reduce((acc, id) => acc.replace(new RegExp(`^#${id}=.*;\\n`, 'm'), ''), eigen);
  ok('plek 34: #152 tot #155 zijn weg', ![152, 153, 154, 155].some(id => new RegExp(`^#${id}=`, 'm').test(noAsg)));
  const psets = (out: string) => linesOfType(latin1(out), 'IFCPROPERTYSET').filter(l => l.includes("'OPS_Assignments'")).length;
  await proof('plek 34', 'Trias: OPS_Assignments van #63 weg uit de bron; de writer schrijft haar weer (een registerpset)', latin1(noAsg), 'schrijft', undefined,
    (out) => (psets(text(out)) === psets(noAsg) + 1 ? undefined : `OPS_Assignments: ${psets(text(out))} in de uitvoer, ${psets(noAsg)} in de bron`));
}

// ── Fixronde 5, VERVOLG van Terra: een tijdslot volgt uit zijn eigen delen van `time` ──
{
  // DurationType `.NOTDEFINED.` op de taaktijd #62 van #63: de writer schrijft `.WORKTIME.`, (b) zet de bronwaarde terug.
  // Een bewerking van een ander deel van `time` verklaart dat slot niet: de bronwaarde blijft. Tot fixronde 4 verklaarde
  // elke wijziging in `time` het slot, en ging `.NOTDEFINED.` na plek 6 verloren.
  const t62 = lineOf(latin1(eigen), '62');
  ok('VERVOLG: #62 heeft DurationType .WORKTIME.', t62.startsWith("#62=IFCTASKTIME('Build masonry walls Time',.PREDICTED.,$,.WORKTIME.,"));
  const notDefined = latin1(setLine(eigen, 62, t62.replace(',$,.WORKTIME.,', ',$,.NOTDEFINED.,')));
  // De taaktijd heeft geen vast id in de uitvoer: zoek haar op naam.
  const keep = has("IFCTASKTIME('Build masonry walls Time',.PREDICTED.,$,.NOTDEFINED.,");
  const time63 = (x: Domain, o: Opened) => x.tasks.find(q => q.id === taskBy(o, 63).id)!.time;
  const other = taskBy(eigenOpened, 65).time;
  await proof('VERVOLG', '.NOTDEFINED., zonder bewerking', notDefined, 'schrijft', undefined, keep);
  const edits: [string, (x: Domain, o: Opened) => void][] = [
    ['het geplande begin', (x, o) => { time63(x, o).scheduleStart = '2027-05-07'; }],
    ['het geplande einde', (x, o) => { time63(x, o).scheduleFinish = '2027-05-14'; }],
    ['de duur', (x, o) => { time63(x, o).scheduleDuration += 1; }],
    ['vroeg en laat', (x, o) => { const t = time63(x, o); t.earlyStart = other.earlyStart; t.earlyFinish = other.earlyFinish; t.lateStart = other.lateStart; t.lateFinish = other.lateFinish; }],
    ['het werkelijke begin', (x, o) => { time63(x, o).actualStart = '2027-05-06'; }],
    ['de resterende duur', (x, o) => { time63(x, o).remainingTime = 2; }],
  ];
  for (const [label, edit] of edits) await proof('VERVOLG', `.NOTDEFINED., de planner wijzigt ${label}`, notDefined, 'schrijft', edit, keep);
  // Wijzigt de planner het veld zelf, dan vervalt de bronwaarde (plek 6).
  await proof('VERVOLG', '.NOTDEFINED., de planner zet de duur op kalendertijd', notDefined, 'schrijft', (x, o) => { time63(x, o).durationType = 'ELAPSEDTIME'; },
    has(".PREDICTED.,$,.NOTDEFINED.,", false));
}

// ── Combinaties: een bewerking met een wijziging van het project, en twee bewerkingen samen ──
// Regel: een combinatie schrijft alleen als elk deel apart ook schrijft. Een wijziging van het project verklaart alleen
// haar eigen velden (B1), en een bewerking nooit het verlies van een andere.
type Edit = { label: string; apply: (d: Domain) => void };
const projectEdits = (d: Domain): Edit[] => [
  { label: 'projectnaam', apply: (x) => { x.project.name = 'Andere naam'; } },
  { label: 'projectomschrijving', apply: (x) => { x.project.description = 'Andere omschrijving'; } },
  { label: 'statusdatum', apply: (x) => { x.project.statusDate = '2027-04-01'; } },
  { label: 'modifiedAt', apply: (x) => { x.project.modifiedAt = '2026-12-01T10:00:00.000Z'; } },
  { label: 'kalenderkeuze', apply: (x) => {
    const other = { ...structuredClone(x.calendar), id: `${d.calendar.id}-b4`, name: 'Andere kalender' };
    x.resourceCalendars = [...(x.resourceCalendars ?? []), structuredClone(x.calendar)];
    x.calendar = other;
    x.project.calendarId = other.id;
  } },
];
const files: [string, Uint8Array][] = [['fix3', fix3], ['eigen-plus-model', latin1(eigen)], ['showcase + wand', latin1(showcase)], ['r6sol', r6sol]];
let combos = 0;
let combosWritten = 0;
for (const [name, bytes] of files) {
  const opened = await openForeign(bytes);
  const taskEdits: Edit[] = [
    ...basicEdits(opened),
    ...plannerEdits(opened, 2).filter(e => e.kind === 'taak-wissen' || e.kind === 'andere-ouder').slice(0, 2),
  ].map(e => ({ label: e.label, apply: e.apply }));
  const projects = projectEdits(opened);
  const alone = new Map<string, Result>();
  for (const e of [...taskEdits, ...projects]) alone.set(e.label, await merge(`${name} · ${e.label}`, bytes, e.apply));
  const pairs: [Edit, Edit][] = [];
  for (const e of taskEdits) for (const p of projects) pairs.push([e, p]);
  for (let a = 0; a < taskEdits.length; a++) for (let b = a + 1; b < taskEdits.length; b++) pairs.push([taskEdits[a], taskEdits[b]]);
  for (const [e, f] of pairs) {
    const r = await merge(`${name} · ${e.label} + ${f.label}`, bytes, (x) => { e.apply(x); f.apply(x); });
    combos++;
    if (r.outcome === 'schrijft') combosWritten++;
    const parts = [alone.get(e.label)!, alone.get(f.label)!];
    ok(`combinatie ${r.label}: geen fout (${r.details.slice(0, 2).join(' | ')})`, r.outcome !== 'fout');
    ok(`combinatie ${r.label}: schrijft alleen als elk deel apart schrijft (delen: ${parts.map(p => p.outcome).join(', ')})`,
      r.outcome !== 'schrijft' || parts.every(p => p.outcome === 'schrijft'));
  }
  for (const [label, r] of alone) ok(`${name} · ${label}: geen fout (${r.details.slice(0, 2).join(' | ')})`, r.outcome !== 'fout');
}

// ── De tabel: per proef de uitkomst (voor de PR-body) ──
console.log('| proef | uitkomst |');
console.log('|---|---|');
for (const r of results) {
  const first = r.details.find(x => x.startsWith('niet-eenduidig')) ?? r.details[0] ?? '';
  console.log(`| ${r.label} | ${r.outcome === 'weigert' ? `weigert (${r.kinds.join(', ')})` : r.outcome}${first ? `: ${first.slice(0, 140).replace(/\|/g, '/')}` : ''} |`);
}
console.log(`Combinaties: ${combos}, waarvan ${combosWritten} schrijven.`);

if (diffs.length > 0) {
  console.log(`XX  ifc-foreign-strikt: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 60)) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-strikt: alle checks groen (${checks}; ${results.length} proeven, ${combos} combinaties)`);
process.exit(0);
