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
import { basicEdits, cloneDomain, mergeProblems, openForeign, plannerEdits, sameBytes, settle, tryMerge, type Domain, type MergeOutcome, type Opened } from './ifcMergeKern';
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

// ── B2: een duur met dagen vóór T (knownbug 1027, opgelost met #871), en een duur met weken (knownbug 1028) ──
// Sinds #871 (`9ee06bb71`) leest de lezer de dagen vóór `T` mee, met de minuten per dag van de taak: `P2DT12H` is bij 8 uur
// per dag 1680 minuten. In fixronde 4 en 5 weigerde de merge zo'n duur tijdelijk; sinds fixronde 5b (besluit van Trias van
// 10 november 2026) schrijft hij. De regressietest: zonder bewerking blijft elk argument van de taaktijd byte-gelijk, ook
// de duur zelf, en is een tweede ronde byte-gelijk aan de eerste; na een andere bewerking van de taak leest de herlezing
// dezelfde minuten als de lezer. Twee dingen zijn wel anders, ook in de showcase zonder `P2DT12H`: de merge geeft de eigen
// stukken een nieuw `#id`, en een urentaak krijgt de nulduur in haar eigen vorm (`RemainingTime` `P0Y0M0D` wordt
// `PT0H0M0S`, net als bij `PT90M`; elk onderdeel is gelijk).
const T55 = "#55=IFCTASKTIME('CPT soundings & soil investigation Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M3D'";
ok('B2: de taaktijd #55 staat in de showcase', showcase.includes(T55));
const cpt = (o: Opened) => o.tasks.find(q => q.name === 'CPT soundings & soil investigation')!;
const p2dt12h = latin1(showcase.replace(T55, T55.replace("'P0Y0M3D'", "'P2DT12H'")));
/** Elk argument van taaktijd #55 uit de bron staat byte-gelijk in de uitvoer, op de nulduur van een urentaak na (zie hierboven).
 *  #55 heeft geen komma binnen een waarde. */
const sameTaskTime = (src: Uint8Array) => {
  const a = /^#55=IFCTASKTIME\((.*)\);$/m.exec(text(src))![1].split(',');
  return (out: Uint8Array) => {
    const m = /^#\d+=IFCTASKTIME\(('CPT soundings & soil investigation Time',.*)\);$/m.exec(text(out));
    if (!m) return 'mist de taaktijd van de taak';
    const b = m[1].split(',');
    const diff = a.flatMap((v, k) => (v === b[k] || (k === 18 && v === "'P0Y0M0D'" && b[k] === "'PT0H0M0S'") ? [] : [`argument ${k}: ${v} → ${b[k]}`]));
    return diff.length === 0 && a.length === b.length ? undefined : `de taaktijd is anders: ${diff.slice(0, 3).join(', ')}`;
  };
};
/** Een tweede ronde zonder bewerking is byte-gelijk aan de eerste. */
const secondRoundSame = async (label: string, r: Result) => {
  if (!r.out) return;
  const o = await openForeign(r.out);
  const second = await tryMerge(cloneDomain(o), o.ifcSource!);
  ok(`${label}: een tweede ronde is byte-gelijk aan de eerste`, second.ok && sameBytes(second.bytes, r.out));
};
await proof('B2, plek 7', 'Terra m1: P2DT12H, de duur expliciet op 720 en de taak hernoemd: schrijft de nieuwe duur', p2dt12h, 'schrijft', (x, o) => {
  const q = x.tasks.find(z => z.id === cpt(o).id)!; q.time.durationMinutes = 720; q.name = 'Hernoemd';
}, (out) => has(/IFCTASKTIME\('Hernoemd Time',\.PREDICTED\.,\$,\.WORKTIME\.,'PT12H0M0S'/)(out) ?? has("'P2DT12H'", false)(out));
await secondRoundSame('regressie 1027 · P2DT12H zonder bewerking',
  await proof('regressie 1027', 'P2DT12H zonder bewerking: schrijft, elk argument van de taaktijd byte-gelijk', p2dt12h, 'schrijft', undefined, sameTaskTime(p2dt12h)));
{
  const before = cpt(await openForeign(p2dt12h)).time.durationMinutes;
  ok(`regressie 1027: de lezer leest P2DT12H als 1680 minuten (kreeg ${before})`, before === 1680);
  const r = await proof('regressie 1027', 'P2DT12H, de taak hernoemd: schrijft en houdt P2DT12H', p2dt12h, 'schrijft', (x, o) => {
    x.tasks.find(z => z.id === cpt(o).id)!.name = 'Hernoemd';
  }, has(/IFCTASKTIME\('Hernoemd Time',\.PREDICTED\.,\$,\.WORKTIME\.,'P2DT12H'/));
  const after = r.out ? (await openForeign(r.out)).tasks.find(q => q.name === 'Hernoemd')?.time.durationMinutes : undefined;
  ok(`regressie 1027: de herlezing leest dezelfde minuten als de lezer (${before} → ${after})`, after === before);
}
await proof('B2', 'P0Y0M3D (dagen zonder tijddeel) schrijft', latin1(showcase), 'schrijft', (x, o) => { x.tasks.find(z => z.id === cpt(o).id)!.name = 'Hernoemd'; },
  has(/IFCTASKTIME\('Hernoemd Time',\.PREDICTED\.,\$,\.WORKTIME\.,'P0Y0M3D'/));
await proof('B2', 'P1W (weken: de lezer leest geen weken, knownbug 1028)', latin1(showcase.replace(T55, T55.replace("'P0Y0M3D'", "'P1W'"))), 'duur-deels-gelezen');

// ── Fixronde 5, BLOKKEERT 1 (plek 7): de duur na dezelfde tekstdecodering als de lezer ──
// `P2\X2\0044\X0\T12H` is na STEP-decodering `P2DT12H`. De lezer decodeert, dus de toets ook, met dezelfde regel per
// stuk (`index.tokenText`). `\S\` codeert alleen tekens 128 tot 255, en kan dus geen `D`, `T` of komma vormen.
const t55 = (dur: string, src = showcase) => latin1(src.replace(T55, T55.replace("'P0Y0M3D'", `'${dur}'`)));
const rename55 = (x: Domain, o: Opened) => { x.tasks.find(z => z.id === cpt(o).id)!.name = 'Hernoemd'; };
const m1 = (x: Domain, o: Opened) => { const q = x.tasks.find(z => z.id === cpt(o).id)!; q.time.durationMinutes = 720; q.name = 'Hernoemd'; };
// Sinds fixronde 5b leest de lezer `P2DT12H` goed (knownbug 1027 opgelost), dus ook de gecodeerde vormen: ze schrijven.
// De toets blijft na de decodering kijken: de komma (BLOKKEERT 2) en de vorm (zoektocht 4) ziet hij ook gecodeerd.
for (const dur of ['P2\\X2\\0044\\X0\\T12H', 'P2\\X\\44T12H', 'P2\\X4\\00000044\\X0\\T12H']) {
  await proof('BLOKKEERT 1, plek 7', `Sol en Terra: ${dur} (P2DT12H in STEP-codering), de duur 720 en de taak hernoemd: schrijft de nieuwe duur`, t55(dur), 'schrijft', m1,
    has(/IFCTASKTIME\('Hernoemd Time',\.PREDICTED\.,\$,\.WORKTIME\.,'PT12H0M0S'/));
  await secondRoundSame(`BLOKKEERT 1 · ${dur} zonder bewerking`,
    await proof('BLOKKEERT 1, plek 7', `${dur} zonder bewerking: schrijft, elk argument van de taaktijd byte-gelijk`, t55(dur), 'schrijft', undefined, sameTaskTime(t55(dur))));
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
// Vormen die de lezer leest zoals ze bedoeld zijn: schrijven.
for (const dur of ['PT90M', 'PT3600S', 'PT0.5H', 'P0DT12H']) {
  await proof('zoektocht 4', `'${dur}', de taak hernoemd: schrijft`, t55(dur), 'schrijft', rename55);
}
// Fixronde 6: een negatieve taakduur staat niet op de lijst (`durationForms.ts`). OPS schreef die in geen enkele versie;
// het minteken staat alleen op de lijst in de speling en de lag. Tot fixronde 5b schreven deze twee.
for (const dur of ['P0Y0M-2D', '-P2D']) {
  await proof('fixronde 6', `'${dur}' (een negatieve taakduur), de taak hernoemd`, t55(dur), 'duur-deels-gelezen', rename55, undefined,
    /^duur-deels-gelezen: IFCTASKTIME #55: de duur '.*' staat niet op de lijst .*een negatieve taakduur/);
}

// ── Fixronde 5b: dagen vóór T per duurslot na #871; de speling en de lag in werktijd (knownbug 1033) ──
// Gemeten per slot van `IfcTaskTime` en voor de lag, met dezelfde lengte in drie vormen op een kalender van 8 uur per dag
// (`P2DT12H`, `PT28H`, `P0Y0M3.5D`). Taakduur, restduur en werkelijke duur leest de lezer sinds #871 goed: die schrijven, en
// de herlezing leest hetzelfde. Een mijlpaal en een taak in kalendertijd ook: `P2DT12H` leest hij daar als `PT28H` en
// `PT60H`. De speling leest hij alleen in hele dagen (`parseDurationDays`): `P2DT12H` als 2, `PT28H` als 4 en `PT90M` als
// 0. Een lag in werktijd met dagen vóór `T` telt hij als 24 uur werktijd per dag, terwijl `P1D` één werkdag is. Die twee
// weigeren (knownbug 1033). Ook de ongetypte duur van een lag, die de lezer ook leest, valt nu onder de toets.
const L55 = /^#55=IFCTASKTIME\((.*)\);$/m.exec(showcase);
ok('5b: de regel van taaktijd #55 staat in de showcase', !!L55);
/** De showcase met slots van taaktijd #55 vervangen (#55 heeft geen komma binnen een waarde). */
const slot55 = (set: Record<number, string>, src = showcase) => {
  const a = L55![1].split(',');
  for (const [k, v] of Object.entries(set)) a[Number(k)] = v;
  return latin1(src.replace(L55![0], () => `#55=IFCTASKTIME(${a.join(',')});`));
};
const reread = async (r: Result) => (r.out ? (await openForeign(r.out)).tasks.find(q => q.name === 'Hernoemd')?.time : undefined);
const IN_PROGRESS = { 17: '$', 19: '0.5' };
{
  const r1 = await proof('5b', "ActualDuration 'P2DT12H', de taak hernoemd: schrijft", slot55({ 15: "'P2DT12H'" }), 'schrijft', rename55, has(/IFCTASKTIME\('Hernoemd Time',(?:[^,]*,){14}'P2DT12H'/));
  const t1 = await reread(r1);
  ok(`5b: ActualDuration 'P2DT12H' is na herlezen 3,5 dagen (kreeg ${t1?.actualDuration})`, t1?.actualDuration === 3.5);
  const r2 = await proof('5b', "RemainingTime 'P2DT12H' van een dagtaak in uitvoering, de taak hernoemd: schrijft", slot55({ ...IN_PROGRESS, 4: "'P0Y0M5D'", 18: "'P2DT12H'" }), 'schrijft', rename55);
  const t2 = await reread(r2);
  ok(`5b: de restduur 'P2DT12H' van een dagtaak is na herlezen 3,5 dagen (kreeg ${t2?.remainingTime})`, t2?.remainingTime === 3.5);
  const r3 = await proof('5b', "RemainingTime 'P2DT12H' van een urentaak in uitvoering, de taak hernoemd: schrijft", slot55({ ...IN_PROGRESS, 4: "'PT40H'", 18: "'P2DT12H'" }), 'schrijft', rename55);
  const t3 = await reread(r3);
  ok(`5b: de restduur 'P2DT12H' van een urentaak is na herlezen 1680 minuten (kreeg ${t3?.remainingMinutes})`, t3?.remainingMinutes === 1680);
  const r4 = await proof('5b', "kalendertijd: ScheduleDuration 'P2DT12H', de taak hernoemd: schrijft", slot55({ 3: '.ELAPSEDTIME.', 4: "'P2DT12H'" }), 'schrijft', rename55);
  const t4 = await reread(r4);
  ok(`5b: 'P2DT12H' in kalendertijd is na herlezen 3600 minuten, als 'PT60H' (kreeg ${t4?.durationMinutes})`, t4?.durationMinutes === 3600);
  // Een mijlpaal: `P2DT0H` leest de lezer als `PT16H` (960 minuten), niet als `P2D` (0). Dat verschil tussen de dagvorm en
  // de urenvorm staat in knownbug 1042 (#871) en hangt niet af van de dagen vóór `T`.
  const T56 = "#56=IFCTASK('3rXhB$Ss9iyKAT8OUYn2nh',#6,'CPT soundings & soil investigation',$,$,'2.1',$,$,$,.F.,";
  ok('5b: de taak #56 staat in de showcase', showcase.includes(T56));
  const milestone = showcase.replace(T56, () => T56.replace('.F.,', '.T.,'));
  const r5 = await proof('5b', "mijlpaal: ScheduleDuration 'P2DT0H', de taak hernoemd: schrijft", slot55({ 4: "'P2DT0H'" }, milestone), 'schrijft', rename55);
  const t5 = await reread(r5);
  const pt16 = cpt(await openForeign(slot55({ 4: "'PT16H'" }, milestone))).time.durationMinutes;
  ok(`5b: een mijlpaal met 'P2DT0H' leest na herlezen als 'PT16H' (${t5?.durationMinutes} en ${pt16})`, t5?.durationMinutes === 960 && pt16 === 960);
}
// De speling: alleen hele dagen, zonder tijddeel.
for (const [k, name] of [[11, 'FreeFloat'], [12, 'TotalFloat']] as const) {
  for (const dur of ['P2DT12H', 'PT28H', 'PT90M', 'P0DT4H']) {
    await proof('5b, knownbug 1033', `${name} '${dur}' (de lezer leest een speling in hele dagen), de taak hernoemd`, slot55({ [k]: `'${dur}'` }), 'duur-deels-gelezen', rename55, undefined,
      /^duur-deels-gelezen: IFCTASKTIME #55: de speling '/);
  }
  for (const dur of ['P0Y0M3.5D', 'P2D', '-P0Y0M1D', 'P0Y0M-2D']) {
    await proof('5b, fixronde 6', `${name} '${dur}' (een vorm van OPS of in dagen), de taak hernoemd: schrijft`, slot55({ [k]: `'${dur}'` }), 'schrijft', rename55);
  }
  // Fixronde 6: een speling met een tijddeel staat niet op de lijst, ook als het tijddeel nul is (tot fixronde 5b
  // schreven `P2DT0H` en `PT0H`), en ook als het toevallig op hele dagen valt (`PT8H` bij 8 uur per dag; de lijst kent de
  // kalender niet, VERVOLG bij knownbug 1033).
  for (const dur of ['P2DT0H', 'PT0H', 'PT8H']) {
    await proof('fixronde 6', `${name} '${dur}' (een speling met een tijddeel), de taak hernoemd`, slot55({ [k]: `'${dur}'` }), 'duur-deels-gelezen', rename55, undefined,
      /^duur-deels-gelezen: IFCTASKTIME #55: de speling '/);
  }
}
// De lag (#631, SS tussen twee taken van de showcase). In werktijd met dagen vóór `T` weigert hij; in kalendertijd niet.
const LAG631 = "#631=IFCLAGTIME('Lag',.PREDICTED.,$,IFCDURATION('P2D'),.WORKTIME.);";
ok('5b: de lag #631 staat in de showcase', showcase.includes(LAG631));
const lag631 = (value: string, unit = '.WORKTIME.') => latin1(showcase.replace(LAG631, () => `#631=IFCLAGTIME('Lag',.PREDICTED.,$,${value},${unit});`));
const lagAt = (o: Opened) => o.sequences.filter(q => q.lagMinutes !== undefined || (q.lagDays !== 2 && q.lagDays !== 0) || (q.lagUnit !== undefined && q.lagUnit !== 'WORKTIME'));
const LAG_DAYS = /^duur-deels-gelezen: IFCLAGTIME #631: de lag in werktijd '/;
await proof('5b, knownbug 1033', "lag in werktijd IFCDURATION('P1DT2H'), de taak hernoemd", lag631("IFCDURATION('P1DT2H')"), 'duur-deels-gelezen', rename55, undefined, LAG_DAYS);
await proof('5b, knownbug 1033', "lag in werktijd IFCDURATION('P1DT0H'), de taak hernoemd", lag631("IFCDURATION('P1DT0H')"), 'duur-deels-gelezen', rename55, undefined, LAG_DAYS);
await proof('5b, knownbug 1033', "lag zonder DurationType (werktijd) IFCDURATION('P1DT2H'), de taak hernoemd", lag631("IFCDURATION('P1DT2H')", '$'), 'duur-deels-gelezen', rename55, undefined, LAG_DAYS);
await proof('5b, knownbug 1033', "ongetypte lag in werktijd 'P1DT2H', de taak hernoemd", lag631("'P1DT2H'"), 'duur-deels-gelezen', rename55, undefined, LAG_DAYS);
await proof('5b, knownbug 1029', "ongetypte lag 'P1,5D' (de lezer leest 5 dagen), de taak hernoemd", lag631("'P1,5D'"), 'duur-deels-gelezen', rename55, undefined,
  /^duur-deels-gelezen: IFCLAGTIME #631: de lag in werktijd 'P1,5D' staat niet op de lijst .*een decimale komma.*Tijdelijk, tot de fix van knownbug 1029 in main staat\.$/);
{
  const r = await proof('5b', "lag in kalendertijd IFCDURATION('P1DT2H'), de taak hernoemd: schrijft", lag631("IFCDURATION('P1DT2H')", '.ELAPSEDTIME.'), 'schrijft', rename55, has("IFCDURATION('P1DT2H'),.ELAPSEDTIME."));
  const lags = r.out ? lagAt(await openForeign(r.out)) : [];
  ok(`5b: de lag 'P1DT2H' in kalendertijd is na herlezen 1560 minuten (${JSON.stringify(lags.map(q => q.lagMinutes))})`, lags.length === 1 && lags[0].lagMinutes === 1560);
}
await proof('5b', "lag in werktijd IFCDURATION('PT26H'), de taak hernoemd: schrijft", lag631("IFCDURATION('PT26H')"), 'schrijft', rename55);
await proof('5b', "ongetypte lag in werktijd 'PT10H', de taak hernoemd: schrijft", lag631("'PT10H'"), 'schrijft', rename55);

// ── Fixronde 6: de lijst van duurvormen (`durationForms.ts`) ──
// BLOKKEERT 1: de oude lagvorm van OPS (tot `b1a8cb52c`) met de duur in argument 5. De lezer kiest dat slot met
// `lagValueSlot` (`ifcLagTimeSlots.ts`), de merge met dezelfde functie, en leest er met `parseDurationDays` alleen dagen.
const oldLag = (v: string) => latin1(showcase.replace(LAG631, () => `#631=IFCLAGTIME('Lag',.PREDICTED.,$,.WORKTIME.,${v});`));
const OLD_LAG = /^duur-deels-gelezen: IFCLAGTIME #631: de lag in de oude vorm '/;
await proof('fixronde 6, BLOKKEERT 1', "oude lagvorm 'P1,5D' (de lezer leest 5 dagen), de taak hernoemd", oldLag("'P1,5D'"), 'duur-deels-gelezen', rename55, undefined, OLD_LAG);
await proof('fixronde 6, BLOKKEERT 1', "oude lagvorm 'P1DT2H' (de lezer leest 1 dag), de taak hernoemd", oldLag("'P1DT2H'"), 'duur-deels-gelezen', rename55, undefined, OLD_LAG);
await proof('fixronde 6, BLOKKEERT 1', "oude lagvorm 'PT10H' (de lezer leest 2 werkdagen), de taak hernoemd", oldLag("'PT10H'"), 'duur-deels-gelezen', rename55, undefined, OLD_LAG);
{
  // De lag #631 in het domein: de relatie tussen dezelfde twee taken (een lag van 7 dagen wijst haar aan).
  const key = (q: { predecessorId: string; successorId: string }) => `${q.predecessorId}>${q.successorId}`;
  const marked = (await openForeign(lag631("IFCDURATION('P7D')"))).sequences.filter(q => q.lagDays === 7);
  ok(`fixronde 6: de lag #631 is te vinden in het domein (${marked.length})`, marked.length === 1);
  const lag = (await openForeign(oldLag("'P1,5D'"))).sequences.find(q => marked[0] && key(q) === key(marked[0]));
  ok(`fixronde 6: de lezer leest de oude lagvorm 'P1,5D' als 5 dagen (kreeg ${lag?.lagDays})`, lag?.lagDays === 5 && lag.lagMinutes === undefined);
  for (const v of ["'P2D'", "'P0Y0M2.5D'", "'P0Y0M-2D'", "'-P2D'"]) {
    await proof('fixronde 6, BLOKKEERT 1', `oude lagvorm ${v} (een vorm van OPS), de taak hernoemd: schrijft`, oldLag(v), 'schrijft', rename55);
  }
}
// BLOKKEERT 2: een minteken in het tijddeel (knownbug 1034). De lezer leest `PT-2H` als +120 minuten. Ook als de planner de
// waarde op 120 zet (wat hij ziet), mag de bron niet blijven: die zegt -2 uur.
const MINUS = /^duur-deels-gelezen: IFC(?:TASK|LAG)TIME #(?:55|631): .* staat niet op de lijst .*een minteken in een deel/;
await proof('fixronde 6, BLOKKEERT 2', "ScheduleDuration 'PT-2H', de taak hernoemd", t55('PT-2H'), 'duur-deels-gelezen', rename55, undefined, MINUS);
await proof('fixronde 6, BLOKKEERT 2', "ScheduleDuration 'PT-2H', de duur op 120 minuten gezet en de taak hernoemd", t55('PT-2H'), 'duur-deels-gelezen', (x, o) => {
  const q = x.tasks.find(z => z.id === cpt(o).id)!; q.time.durationMinutes = 120; q.name = 'Hernoemd';
}, undefined, MINUS);
await proof('fixronde 6, BLOKKEERT 2', "lag IFCDURATION('PT-2H'), de taak hernoemd", lag631("IFCDURATION('PT-2H')"), 'duur-deels-gelezen', rename55, undefined, MINUS);
{
  const o = await openForeign(lag631("IFCDURATION('PT-2H')"));
  const at = o.sequences.findIndex(q => q.lagMinutes === 120);
  ok(`fixronde 6: de lezer leest de lag 'PT-2H' als +120 minuten (knownbug 1034; index ${at})`, at >= 0);
  await proof('fixronde 6, BLOKKEERT 2', "lag IFCDURATION('PT-2H'), de lag op 120 minuten gezet en de taak hernoemd", lag631("IFCDURATION('PT-2H')"), 'duur-deels-gelezen', (x, oo) => {
    x.sequences[at].lagMinutes = 120; rename55(x, oo);
  }, undefined, MINUS);
}
{
  const r = await proof('fixronde 6, BLOKKEERT 2', "lag IFCDURATION('-PT2H') (het minteken vóór de P), de taak hernoemd: schrijft", lag631("IFCDURATION('-PT2H')"), 'schrijft', rename55, has(/IFCDURATION\('-PT2H(?:0M0S)?'\)/));
  const lags = r.out ? (await openForeign(r.out)).sequences.filter(q => q.lagMinutes === -120) : [];
  ok(`fixronde 6: de lag '-PT2H' is na herlezen -120 minuten (${lags.length})`, lags.length === 1);
}
await proof('fixronde 6, BLOKKEERT 2', "lag IFCDURATION('-PT2H0M0S') (zo schrijft OPS een negatieve lag in uren), de taak hernoemd: schrijft", lag631("IFCDURATION('-PT2H0M0S')"), 'schrijft', rename55);
// BLOKKEERT 3: een tijddeel dat niet op een hele minuut valt (knownbug 1035). De lezer rondt af: `PT90S` wordt 2 minuten.
const SECONDS = /^duur-deels-gelezen: IFC(?:TASK|LAG)TIME #(?:55|631): .* staat niet op de lijst .*niet op een hele minuut/;
await proof('fixronde 6, BLOKKEERT 3', "ScheduleDuration 'PT90S', de taak hernoemd", t55('PT90S'), 'duur-deels-gelezen', rename55, undefined, SECONDS);
await proof('fixronde 6, BLOKKEERT 3', "ScheduleDuration 'PT90S', de duur op 2 minuten gezet en de taak hernoemd", t55('PT90S'), 'duur-deels-gelezen', (x, o) => {
  const q = x.tasks.find(z => z.id === cpt(o).id)!; q.time.durationMinutes = 2; q.name = 'Hernoemd';
}, undefined, SECONDS);
await proof('fixronde 6, BLOKKEERT 3', "ScheduleDuration 'PT0.01H' (0,6 minuut), de taak hernoemd", t55('PT0.01H'), 'duur-deels-gelezen', rename55, undefined, SECONDS);
await proof('fixronde 6, BLOKKEERT 3', "lag IFCDURATION('PT90S'), de taak hernoemd", lag631("IFCDURATION('PT90S')"), 'duur-deels-gelezen', rename55, undefined, SECONDS);
await proof('fixronde 6, BLOKKEERT 3', "lag in kalendertijd IFCDURATION('PT1M30S'), de taak hernoemd", lag631("IFCDURATION('PT1M30S')", '.ELAPSEDTIME.'), 'duur-deels-gelezen', rename55, undefined, SECONDS);
await proof('fixronde 6, BLOKKEERT 3', "ScheduleDuration 'PT120S' (2 hele minuten), de taak hernoemd: schrijft", t55('PT120S'), 'schrijft', rename55);
await proof('fixronde 6, BLOKKEERT 3', "lag IFCDURATION('PT0.25H') (15 minuten), de taak hernoemd: schrijft", lag631("IFCDURATION('PT0.25H')"), 'schrijft', rename55);
// De oude vormen van OPS staan op de lijst: de dagen als JavaScript-getal, zoals de writer ze schreef tot `b738a5096` (24
// september 2026). Met een korte breuk schrijft de merge. Met meer dan zes decimalen of een exponent weigert hij wel, maar
// niet om de vorm: de writer van nu rondt af op een miljoenste dag (`ifcDayNumber`), dus de bronwaarde terugzetten geeft
// een andere planning dan de writer (`niet-gedragen`). Zo weigerde hij op `ae8c3f882` ook (`P0Y0M1e-7D` daar bovendien als
// `duur-deels-gelezen`). Geen bestand in de repo heeft zo'n getal; VERVOLG in de PR-tekst.
await proof('fixronde 6', "ScheduleDuration 'P0Y0M2.5D' (een korte breuk), de taak hernoemd: schrijft", t55('P0Y0M2.5D'), 'schrijft', rename55);
for (const [k, dur] of [[4, 'P0Y0M2.3333333333333335D'], [4, 'P0Y0M1e-7D'], [11, 'P0Y0M1e-7D'], [12, 'P0Y0M1e-7D']] as const) {
  await proof('fixronde 6', `slot ${k} '${dur}' (zo schreef OPS tot b738a5096), de taak hernoemd: weigert niet om de vorm`, slot55({ [k]: `'${dur}'` }), 'niet-gedragen', rename55, undefined,
    /^niet-gedragen: de bronwaarden \(/);
}
// Zoektocht 3: de rest van een urentaak in uitvoering in dagvorm. Die vorm staat op de lijst (de lezer leest hem bij een
// dagtaak exact), maar bij een urentaak leidt de lezer de rest af van de voortgang (`PT40H` met 50 % wordt 1200 minuten),
// niet uit het slot. De verliesbewaking ziet dat bij het terugzetten van de bron: `niet-gedragen`.
await proof('fixronde 6, zoektocht 3', "RemainingTime 'P0Y0M3.5D' van een urentaak in uitvoering, de taak hernoemd", slot55({ ...IN_PROGRESS, 4: "'PT40H'", 18: "'P0Y0M3.5D'" }), 'niet-gedragen', rename55);

// ── Fixronde 5, zoektocht punt 4: een datum-tijd of tijd die de lezer anders leest (knownbug 1031) ──
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
// Fixronde 6, zoektocht 2: het begin en einde van een feestdag (`IfcWorkTime`, een `IfcDate`) leest de lezer als de eerste
// tien tekens (`parseDateFromIFC`). Een tijd erachter valt weg (de planner ziet een hele feestdag), en een datum zonder
// voorloopnul komt ongetoetst door. Alleen `JJJJ-MM-DD` staat op de lijst; zo schrijft OPS het in elke versie.
const GOOD_FRIDAY = "'Good Friday',.PREDICTED.,$,$,'2027-03-26','2027-03-26'";
ok('fixronde 6: de feestdag Good Friday 2027 staat in de showcase', showcase.includes(GOOD_FRIDAY));
const goodFriday = (start: string, end = '2027-03-26') => latin1(showcase.replace(GOOD_FRIDAY, () => `'Good Friday',.PREDICTED.,$,$,'${start}','${end}'`));
const DATE_FORM = /^tijd-deels-gelezen: IFCWORKTIME #\d+: de datum '.*' is geen datum in de vorm JJJJ-MM-DD/;
for (const [start, end] of [['2027-03-26T12:00:00', '2027-03-26'], ['2027-3-26', '2027-3-26'], ['2027-03-26', '2027-03-26T16:00:00Z'], ['20270326', '20270326']]) {
  await proof('fixronde 6, zoektocht 2', `feestdag '${start}'–'${end}', de taak hernoemd`, goodFriday(start, end), 'tijd-deels-gelezen', rename55, undefined, DATE_FORM);
}
await proof('fixronde 6, zoektocht 2', "feestdag '2027-03-26'–'2027-03-27' (kale datums), de taak hernoemd: schrijft", goodFriday('2027-03-26', '2027-03-27'), 'schrijft', rename55);
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
  // Een andere datum zonder wissen: de sleutel van de feestdag veranderde, dus gaat de bronwaarde niet over.
  await proof('BLOKKEERT 3, plek 27', 'Good Friday 2027 een dag later (geen wissing)', bytes, 'niet-eenduidig', (x) => {
    const h = x.calendar.holidays![gfAt(x, '2027')]; h.startDate = '2027-03-27'; h.endDate = '2027-03-27';
  });
  await proof('BLOKKEERT 3, plek 27', 'een andere feestdag gewist en een nieuwe erbij (geen zekere wissing)', bytes, 'niet-eenduidig', (x) => {
    const h = x.calendar.holidays!;
    h.splice(h.findIndex(q => q.name === 'Christmas' && q.startDate.startsWith('2028')), 1);
    h.push({ name: 'Extra', startDate: '2029-01-02', endDate: '2029-01-02' } as never);
  });
  // Wissen plus een nieuwe feestdag: het aantal blijft gelijk, dus is Good Friday 2027 niet zeker gewist (de planner kan
  // haar ook veranderd hebben). Het paren op plek koppelt haar aan de nieuwe feestdag; de lijst is niet stabiel.
  await proof('BLOKKEERT 3, plek 27', 'Good Friday 2027 gewist en een nieuwe feestdag achteraan (geen zekere wissing)', bytes, 'niet-eenduidig', (x) => {
    drop('2027')(x);
    x.calendar.holidays!.push({ name: 'Extra', startDate: '2029-01-02', endDate: '2029-01-02' } as never);
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
  // Zoektocht punt 2: twee werkende uitzonderingen met dezelfde naam, elk met een eigen patroon en tijdblok. Het patroon
  // van de eerste heeft Interval 1. Wist de planner de eerste en zet hij de tweede op haar datum, dan paart de overgebleven
  // uitzondering op de eerste; haar patroon mag de bronwaarde niet erven (`inheritAmbiguity`).
  const exc = cloneDomain(eigenOpened);
  exc.calendar.workingExceptions = [
    { name: 'Zaterdag', startDate: '2027-06-05', endDate: '2027-06-05', bands: [{ start: 420, end: 720 }] },
    { name: 'Zaterdag', startDate: '2027-06-12', endDate: '2027-06-12', bands: [{ start: 480, end: 780 }] },
  ];
  const excText = text(await settle(latin1(withLines(writeIFC(exc), REVIT_WALL))));
  const firstExc = /^#\d+=IFCWORKTIME\('Zaterdag',\.PREDICTED\.,\$,#(\d+),'2027-06-05','2027-06-05'\);$/m.exec(excText);
  ok('zoektocht 2: de eerste werkende uitzondering heeft een eigen patroon', firstExc !== null);
  if (firstExc) {
    const pat = new RegExp(`^#${firstExc[1]}=IFCRECURRENCEPATTERN\\(\\.DAILY\\.,\\$,\\$,\\$,\\$,\\$,\\$,(\\(#\\d+\\))\\);$`, 'm').exec(excText);
    ok('zoektocht 2: het patroon van de eerste uitzondering', pat !== null);
    if (pat) {
      const interval = latin1(excText.replace(pat[0], `#${firstExc[1]}=IFCRECURRENCEPATTERN(.DAILY.,$,$,$,$,1,$,${pat[1]});`));
      const at = (x: Domain, day: string) => x.calendar.workingExceptions!.findIndex(w => w.startDate === day);
      await proof('zoektocht 2', 'werkende uitzondering: Interval 1 op het patroon, zonder bewerking', interval, 'schrijft', undefined, has('(.DAILY.,$,$,$,$,1,$,'));
      const wipeMove = (x: Domain) => {
        x.calendar.workingExceptions!.splice(at(x, '2027-06-05'), 1);
        const w = x.calendar.workingExceptions![at(x, '2027-06-12')];
        w.startDate = '2027-06-05'; w.endDate = '2027-06-05';
      };
      const moved = await proof('zoektocht 2', 'werkende uitzondering: de eerste gewist en de tweede op haar datum', interval, 'niet-eenduidig', wipeMove);
      ok(`${moved.label}: het patroon met de bronwaarde paart niet eenduidig (${moved.details.slice(0, 2).join(' | ')})`,
        moved.details.some(x => /^niet-eenduidig: IFCRECURRENCEPATTERN #\d+/.test(x)));
      // Zonder bronwaarde schrijven dezelfde bewerkingen. `WorkingExceptionIds` (de STEP-ids van de uitzonderingen) krijgt
      // dan de waarde van de writer: de merge nummert die stukken opnieuw (`ID_LIST_PROPS`). Tot fixronde 4 weigerde het
      // wissen van een werkende uitzondering daarop, en na plek 6 ook een ander blok werktijd.
      const ids = (out: Uint8Array) => {
        const v = /'WorkingExceptionIds',\$,IFCTEXT\('(\[[^']*\])'\)/.exec(text(out))?.[1];
        const want = JSON.stringify(linesOfType(out, 'IFCWORKTIME').filter(l => l.includes("IFCWORKTIME('Zaterdag'")).map(l => /^#(\d+)=/.exec(l)![1]));
        return v === want ? undefined : `WorkingExceptionIds ${v}, de uitzonderingen ${want}`;
      };
      await proof('zoektocht 2', 'zonder bronwaarde: de eerste gewist en de tweede op haar datum', latin1(excText), 'schrijft', wipeMove, ids);
      await proof('zoektocht 2', 'zonder bronwaarde: de eerste werkende uitzondering gewist', latin1(excText), 'schrijft', (x) => { x.calendar.workingExceptions!.splice(at(x, '2027-06-05'), 1); }, ids);
      await proof('zoektocht 2', 'zonder bronwaarde: de tweede werkende uitzondering een uur langer', latin1(excText), 'schrijft', (x) => {
        x.calendar.workingExceptions![at(x, '2027-06-12')].bands = [{ start: 480, end: 840 }];
      }, ids);
    }
  }
  // Zoektocht punt 2: de werktijdgroepen van die week paren op hun naam (`Standard work week (Fri)`). Een bronwaarde op de
  // groep van de vrijdag blijft zolang de groep dezelfde dagen heeft; krijgt de groep andere dagen, dan weigert de merge.
  const friday = /^#(\d+)=IFCWORKTIME\('Standard work week \(Fri\)',\.PREDICTED\.,\$,(#\d+),\$,\$\);$/m.exec(perDayText);
  ok('zoektocht 2: de werkweek per dag heeft een werktijd voor de vrijdag', friday !== null);
  if (friday) {
    const measured = latin1(perDayText.replace(friday[0], `#${friday[1]}=IFCWORKTIME('Standard work week (Fri)',.MEASURED.,$,${friday[2]},$,$);`));
    const short = { start: 420, end: 720 };
    await proof('zoektocht 2', 'werktijdgroep: .MEASURED. op de vrijdag, de vrijdag een uur langer', measured, 'schrijft', (x) => { x.calendar.workTime = week({ start: 420, end: 780 }); },
      has("IFCWORKTIME('Standard work week (Fri)',.MEASURED.,"));
    await proof('zoektocht 2', 'werktijdgroep: de donderdag kort en de vrijdag gewoon', measured, 'niet-eenduidig', (x) => {
      x.calendar.workTime = { byWeekday: { ...week(band).byWeekday, 4: [short] } };
    });
    await proof('zoektocht 2', 'werktijdgroep: de week gelijk', measured, 'niet-gedragen', (x) => { x.calendar.workTime = week(band); });
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
