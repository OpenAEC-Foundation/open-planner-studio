// #804 fase 1b, fixronde 6: de lijst van duurvormen die de merge laat staan (`src/services/ifc/foreign/durationForms.ts`).
//
// Voorwaarde 3 van Trias (bijsturing van 10 november 2026): per vorm een naam en een test die bewijst dat de lezer hem
// exact leest. Deze check doet vier dingen:
//  1. Per vorm en per slot een of meer voorbeelden. Elk voorbeeld gaat in een slot van de showcase en de check opent het
//     met de lezer van de merge (`openForeign`). De waarde na openen moet de waarde zijn die de tekst zegt. Die waarde
//     staat hieronder met de hand uitgeschreven: geen tweede duurparser. De taak #55 staat op een kalender van 8 uur per
//     dag (480 minuten), dus `P2DT12H` is 1680 minuten.
//  2. Elke vorm heeft in elk van zijn slots een voorbeeld, en elk voorbeeld valt in zijn eigen vorm (de eerste die past).
//  3. De vormen die de lezer anders leest, vallen buiten de lijst, en de lezer leest ze nu nog anders: de waarde na
//     openen staat erbij (knownbugs 1028 tot en met 1030 en 1033 tot en met 1035, en de oude lagvorm).
//  4. Elke duur in een eigen bestand van OPS in de repo staat op de lijst (voorwaarde 1: een planning die OPS maakte,
//     weigert nooit om een duur), en ook elke duur die de writer van nu schrijft. Eén bestand is met de hand gemaakt
//     en heeft een speling die OPS nooit schreef; die staat apart, met de reden. Ook elke datum en tijd van een eigen
//     bestand staat op de lijst van datumvormen (knownbug 1031). Een eigen bestand dat de scanner niet leest, slaat de
//     check over, met de reden van de scanner (`NOT_SCANNED`): de merge raakt het nooit.
// Exit 0 = alles klopt.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDeterminism } from './ifcPariteitKern';
import { cloneDomain, openForeign, settle, type Opened } from './ifcMergeKern';
import { DURATION_FORMS, durationForm, type DurationSlot } from '@/services/ifc/foreign/durationForms';
import { OLD_FRACTIONAL_CLOCK, dateTimeTexts, durationTexts, partialDateTime } from '@/services/ifc/foreign/lossCheck';
import { StepScanError, scanStep, type StepScanReason } from '@/services/ifc/foreign/stepScanner';
import { IfcParseError } from '@/services/ifc/ifcErrors';
import { writeIFC } from '@/services/ifc/ifcWriter';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
installDeterminism();
const diffs: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };
const latin1 = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));
const text = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const REVIT_WALL = [
  "#90001=IFCORGANIZATION($,'Arch',$,$,$);", "#90002=IFCAPPLICATION(#90001,'1','Revit','RVT');",
  "#90003=IFCPERSON($,'Ontwerper',$,$,$,$,$,$);", '#90004=IFCPERSONANDORGANIZATION(#90003,#90001,$);',
  '#90005=IFCOWNERHISTORY(#90004,#90002,$,.ADDED.,$,$,$,1);', "#90006=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOX',#90005,'Wand',$,$,$,$,$,$);",
];
const withLines = (src: string, lines: readonly string[]) => {
  const at = src.lastIndexOf('ENDSEC;');
  return `${src.slice(0, at)}${lines.map(l => `${l}\n`).join('')}${src.slice(at)}`;
};

// ── De bron: de showcase met een vreemd deel, zoals de merge haar ziet ──
const showcase = text(await settle(latin1(withLines(text(new Uint8Array(readFileSync(join(ROOT, 'public/examples/showcase-appartementencomplex.ifc')))), REVIT_WALL))));
const L55 = /^#55=IFCTASKTIME\((.*)\);$/m.exec(showcase);
ok('de taaktijd #55 staat in de showcase', !!L55);
const NAME = 'CPT soundings & soil investigation';
/** De showcase met slots van taaktijd #55 vervangen (#55 heeft geen komma binnen een waarde). */
const slot55 = (set: Record<number, string>) => {
  const a = L55![1].split(',');
  for (const [k, v] of Object.entries(set)) a[Number(k)] = v;
  return showcase.replace(L55![0], () => `#55=IFCTASKTIME(${a.join(',')});`);
};
const LAG631 = "#631=IFCLAGTIME('Lag',.PREDICTED.,$,IFCDURATION('P2D'),.WORKTIME.);";
ok('de lag #631 staat in de showcase', showcase.includes(LAG631));
const lag631 = (line: string) => showcase.replace(LAG631, () => line);
const IN_PROGRESS = { 17: '$', 19: '0.5' };

/** Waar een voorbeeld staat. Een slot van de lijst kan meer plekken hebben (de rest van een dagtaak en van een urentaak). */
type Use = 'duur' | 'werkelijk' | 'rest-dagtaak' | 'rest-urentaak' | 'vrije-speling' | 'totale-speling'
  | 'lag-werktijd' | 'lag-werktijd-ongetypt' | 'lag-kalendertijd' | 'lag-oud';
const SLOT_OF: Readonly<Record<Use, DurationSlot>> = {
  duur: 'duur', werkelijk: 'werkelijk', 'rest-dagtaak': 'rest', 'rest-urentaak': 'rest', 'vrije-speling': 'speling',
  'totale-speling': 'speling', 'lag-werktijd': 'lag-werktijd', 'lag-werktijd-ongetypt': 'lag-werktijd',
  'lag-kalendertijd': 'lag-kalendertijd', 'lag-oud': 'lag-oud',
};
/** De bron met de duur op die plek. */
const sourceWith = (use: Use, v: string): string => {
  switch (use) {
    case 'duur': return slot55({ 4: `'${v}'` });
    case 'werkelijk': return slot55({ 15: `'${v}'` });
    case 'rest-dagtaak': return slot55({ ...IN_PROGRESS, 4: "'P0Y0M5D'", 18: `'${v}'` });
    case 'rest-urentaak': return slot55({ ...IN_PROGRESS, 4: "'PT40H0M0S'", 18: `'${v}'` });
    case 'vrije-speling': return slot55({ 11: `'${v}'` });
    case 'totale-speling': return slot55({ 12: `'${v}'` });
    case 'lag-werktijd': return lag631(`#631=IFCLAGTIME('Lag',.PREDICTED.,$,IFCDURATION('${v}'),.WORKTIME.);`);
    case 'lag-werktijd-ongetypt': return lag631(`#631=IFCLAGTIME('Lag',.PREDICTED.,$,'${v}',.WORKTIME.);`);
    case 'lag-kalendertijd': return lag631(`#631=IFCLAGTIME('Lag',.PREDICTED.,$,IFCDURATION('${v}'),.ELAPSEDTIME.);`);
    case 'lag-oud': return lag631(`#631=IFCLAGTIME('Lag',.PREDICTED.,$,.WORKTIME.,'${v}');`);
  }
};

/** Een waarde na openen: dagen (`d`) of minuten (`m`). Een lag in kalendertijd heeft ook die eenheid. */
type Value = { readonly d: number } | { readonly m: number };
const show = (v: Value | string | undefined) => (v === undefined ? '?' : typeof v === 'string' ? v : 'd' in v ? `${v.d} d` : `${v.m} min`);
const same = (a: Value | string, b: Value) => typeof a !== 'string' && ('d' in a ? 'd' in b && Object.is(a.d, b.d) : 'm' in b && Object.is(a.m, b.m));

// De lag #631 in het domein: de relatie tussen dezelfde twee taken (een opvallende lag van 7 dagen wijst haar aan).
const lagKey = (o: Opened) => o.sequences.map(q => `${q.predecessorId}>${q.successorId}`);
const marked = await openForeign(latin1(lag631("#631=IFCLAGTIME('Lag',.PREDICTED.,$,IFCDURATION('P7D'),.WORKTIME.);")));
const LAG_SEQ = lagKey(marked)[marked.sequences.findIndex(q => q.lagDays === 7 && q.lagMinutes === undefined)];
ok(`de lag #631 is te vinden in het domein (${LAG_SEQ})`, LAG_SEQ !== undefined && marked.sequences.filter(q => q.lagDays === 7).length === 1);

/** De waarde op die plek na openen, als tekst als er iets anders mis is. */
async function readValue(use: Use, v: string): Promise<Value | string> {
  let o: Opened;
  try { o = await openForeign(latin1(sourceWith(use, v))); } catch (e) { return e instanceof IfcParseError && e.reason === 'duration' ? 'duration' : `fout bij openen: ${(e as Error).message.slice(0, 100)}`; }
  if (use.startsWith('lag')) {
    const q = o.sequences[lagKey(o).indexOf(LAG_SEQ)];
    if (!q) return 'geen lag';
    const unit = q.lagUnit ?? 'WORKTIME';
    if (unit !== (use === 'lag-kalendertijd' ? 'ELAPSEDTIME' : 'WORKTIME')) return `lagUnit ${unit}`;
    return q.lagMinutes !== undefined ? { m: q.lagMinutes } : { d: q.lagDays };
  }
  const t = o.tasks.find(q => q.name === NAME)?.time;
  if (!t) return 'geen taak';
  switch (use) {
    case 'duur': return t.durationUnit === 'hours' ? { m: t.durationMinutes ?? NaN } : { d: t.scheduleDuration };
    case 'werkelijk': return t.actualDuration === undefined ? 'geen werkelijke duur' : { d: t.actualDuration };
    case 'rest-dagtaak': return t.durationUnit === 'hours' ? 'urentaak' : { d: t.remainingTime ?? NaN };
    case 'rest-urentaak': return t.durationUnit !== 'hours' ? 'dagtaak' : { m: t.remainingMinutes ?? NaN };
    case 'vrije-speling': return { d: t.freeFloat ?? NaN };
    case 'totale-speling': return { d: t.totalFloat ?? NaN };
    default: return 'onbekende plek';
  }
}

// ── 1 en 2: de voorbeelden per vorm en per plek ──
// [vorm, plek, tekst, de waarde die de tekst zegt]
const d = (n: number): Value => ({ d: n });
const m = (n: number): Value => ({ m: n });
const EXAMPLES: readonly (readonly [string, Use, string, Value])[] = [
  ['dagen-P0Y0M', 'duur', 'P0Y0M3D', d(3)],
  ['dagen-P0Y0M', 'duur', 'P0Y0M2.5D', d(2.5)],
  ['dagen-P0Y0M', 'duur', 'P0Y0M2.3333333333333335D', d(2.3333333333333335)],
  ['dagen-P0Y0M', 'duur', 'P0Y0M1e-7D', d(1e-7)],
  ['dagen-P0Y0M', 'werkelijk', 'P0Y0M2.5D', d(2.5)],
  ['dagen-P0Y0M', 'rest-dagtaak', 'P0Y0M3.5D', d(3.5)],
  ['dagen-P0Y0M', 'vrije-speling', 'P0Y0M0.75D', d(0.75)],
  ['dagen-P0Y0M', 'totale-speling', 'P0Y0M4D', d(4)],
  ['dagen-P0Y0M', 'lag-oud', 'P0Y0M3D', d(3)],
  ['dagen-P0Y0M', 'lag-oud', 'P0Y0M2.5D', d(2.5)],
  ['dagen-P0Y0M-teken-bij-getal', 'vrije-speling', 'P0Y0M-2D', d(-2)],
  ['dagen-P0Y0M-teken-bij-getal', 'totale-speling', 'P0Y0M-1e-7D', d(-1e-7)],
  ['dagen-P0Y0M-teken-bij-getal', 'lag-oud', 'P0Y0M-2D', d(-2)],
  ['dagen-min-P0Y0M', 'vrije-speling', '-P0Y0M1D', d(-1)],
  ['dagen-min-P0Y0M', 'totale-speling', '-P0Y0M9D', d(-9)],
  ['dagen-P', 'duur', 'P5D', d(5)],
  ['dagen-P', 'werkelijk', 'P2D', d(2)],
  ['dagen-P', 'rest-dagtaak', 'P2D', d(2)],
  ['dagen-P', 'vrije-speling', 'P3D', d(3)],
  ['dagen-P', 'totale-speling', 'P2.5D', d(2.5)],
  ['dagen-P', 'lag-werktijd', 'P3D', d(3)],
  ['dagen-P', 'lag-werktijd', 'P1e-7D', d(1e-7)],
  ['dagen-P', 'lag-werktijd-ongetypt', 'P4D', d(4)],
  ['dagen-P', 'lag-kalendertijd', 'P1D', d(1)],
  ['dagen-P', 'lag-oud', 'P5D', d(5)],
  ['dagen-min-P', 'vrije-speling', '-P1D', d(-1)],
  ['dagen-min-P', 'totale-speling', '-P2.5D', d(-2.5)],
  ['dagen-min-P', 'lag-werktijd', '-P15D', d(-15)],
  ['dagen-min-P', 'lag-kalendertijd', '-P1D', d(-1)],
  ['dagen-min-P', 'lag-oud', '-P2D', d(-2)],
  ['minuten-OPS', 'duur', 'PT12H30M0S', m(750)],
  ['minuten-OPS', 'duur', 'PT552H0M0S', m(33120)],
  ['minuten-OPS', 'werkelijk', 'PT12H0M0S', d(1.5)],
  ['minuten-OPS', 'rest-dagtaak', 'PT28H0M0S', d(3.5)],
  ['minuten-OPS', 'rest-urentaak', 'PT20H0M0S', m(1200)],
  ['minuten-OPS', 'lag-werktijd', 'PT1H30M0S', m(90)],
  ['minuten-OPS', 'lag-kalendertijd', 'PT26H0M0S', m(1560)],
  ['minuten-OPS-min', 'lag-werktijd', '-PT2H0M0S', m(-120)],
  ['minuten-OPS-min', 'lag-kalendertijd', '-PT0H30M0S', m(-30)],
  ['tijd-hele-minuten', 'duur', 'PT12H', m(720)],
  ['tijd-hele-minuten', 'duur', 'PT90M', m(90)],
  ['tijd-hele-minuten', 'duur', 'PT0.5H', m(30)],
  ['tijd-hele-minuten', 'duur', 'PT0.1H', m(6)],
  ['tijd-hele-minuten', 'duur', 'PT3600S', m(60)],
  ['tijd-hele-minuten', 'duur', 'PT1H30M60S', m(91)],
  ['tijd-hele-minuten', 'werkelijk', 'PT72H', d(9)],
  ['tijd-hele-minuten', 'rest-dagtaak', 'PT4H', d(0.5)],
  ['tijd-hele-minuten', 'rest-urentaak', 'PT10H', m(600)],
  ['tijd-hele-minuten', 'lag-werktijd', 'PT10H', m(600)],
  ['tijd-hele-minuten', 'lag-werktijd-ongetypt', 'PT10H', m(600)],
  ['tijd-hele-minuten', 'lag-kalendertijd', 'PT1.5H', m(90)],
  ['tijd-hele-minuten-min', 'lag-werktijd', '-PT2H', m(-120)],
  ['tijd-hele-minuten-min', 'lag-kalendertijd', '-PT90M', m(-90)],
  ['dagen-en-tijd', 'duur', 'P2DT12H', m(1680)],
  ['dagen-en-tijd', 'duur', 'P0DT12H', m(720)],
  ['dagen-en-tijd', 'werkelijk', 'P1DT4H', d(1.5)],
  ['dagen-en-tijd', 'rest-dagtaak', 'P2DT12H', d(3.5)],
  ['dagen-en-tijd', 'rest-urentaak', 'P1DT4H', m(720)],
  ['dagen-en-tijd', 'lag-kalendertijd', 'P1DT2H', m(600)],
];
for (const [name, use, v, want] of EXAMPLES) {
  const slot = SLOT_OF[use];
  const form = durationForm(v, slot);
  ok(`${name} · ${use} '${v}': valt in de vorm ${name} (kreeg ${form?.name ?? 'geen vorm'})`, form?.name === name);
  const got = await readValue(use, v);
  ok(`${name} · ${use} '${v}': de lezer leest ${show(want)} (kreeg ${show(got)})`, same(got, want));
}
for (const form of DURATION_FORMS) {
  for (const slot of form.slots) {
    ok(`${form.name}: een voorbeeld in het slot ${slot}`, EXAMPLES.some(([name, use]) => name === form.name && SLOT_OF[use] === slot));
  }
}
ok('elke vorm heeft een unieke naam', new Set(DURATION_FORMS.map(f => f.name)).size === DURATION_FORMS.length);

// ── 3: de merge blijft conservatief; de lezer leest deze vormen exact of weigert ze ──
// [plek, tekst, de huidige leeswaarde of weigering, historische aanleiding]. `undefined`: alleen buiten de lijst (geen leesfout bekend).
const OUTSIDE: readonly (readonly [Use, string, Value | 'duration' | undefined, string])[] = [
  ['duur', 'PT-2H', 'duration', 'knownbug 1034: het minteken in het tijddeel valt weg'],
  ['werkelijk', 'PT-12H', 'duration', 'knownbug 1034'],
  ['lag-werktijd', 'PT-2H', 'duration', 'knownbug 1034'],
  ['lag-kalendertijd', 'PT-2H', 'duration', 'knownbug 1034'],
  ['duur', 'PT90S', m(1.5), 'knownbug 1035: 1,5 minuut wordt 2'],
  ['duur', 'PT30S', m(.5), 'knownbug 1035: een halve minuut wordt 1'],
  ['duur', 'PT0.01H', m(.6), 'knownbug 1035: 0,6 minuut wordt 1'],
  ['rest-urentaak', 'PT90S', m(1.5), 'knownbug 1035'],
  ['lag-werktijd', 'PT90S', m(1.5), 'knownbug 1035'],
  ['lag-kalendertijd', 'PT1M30S', m(1.5), 'knownbug 1035'],
  ['duur', 'P1,5D', d(1.5), 'knownbug 1029: alleen de cijfers na de komma'],
  ['lag-oud', 'P1,5D', d(1.5), 'knownbug 1029'],
  ['lag-werktijd-ongetypt', 'P1,5D', d(1.5), 'knownbug 1029'],
  ['duur', 'P1W', 'duration', 'knownbug 1028: weken'],
  ['duur', 'P0Y2M3D', 'duration', 'knownbug 1028: maanden'],
  ['duur', 'p3d', 'duration', 'knownbug 1030: kleine letters'],
  ['duur', 'P1E1D', 'duration', 'knownbug 1030: een exponent met hoofdletter'],
  ['duur', 'PT1H1H', 'duration', 'knownbug 1030: een deel twee keer'],
  ['duur', 'PT30M12H', 'duration', 'knownbug 1030: de delen in een andere volgorde'],
  ['vrije-speling', 'PT28H', d(3.5), 'knownbug 1033: een speling in hele dagen naar boven (3,5 wordt 4)'],
  ['totale-speling', 'P2DT12H', d(3.5), 'knownbug 1033: de uren na de dagen vallen weg'],
  ['totale-speling', 'PT90M', d(.1875), 'knownbug 1033: minuten vallen weg'],
  ['totale-speling', 'PT8H', d(1), 'knownbug 1033: hier toevallig exact (8 uur per dag), de lijst kent de kalender niet'],
  ['lag-werktijd', 'P1DT2H', m(600), "knownbug 1033: de dag vóór T telt als 24 uur werktijd, terwijl 'P1D' één werkdag is"],
  ['lag-oud', 'P1DT2H', m(600), 'de oude lagvorm leest alleen dagen: de 2 uur vallen weg'],
  ['lag-oud', 'PT10H', m(600), 'de oude lagvorm leest uren als hele werkdagen naar boven'],
  ['duur', '-P2D', undefined, 'een negatieve taakduur: OPS schrijft die nooit'],
  ['duur', 'P0Y0M-2D', undefined, 'een negatieve taakduur: OPS schrijft die nooit'],
  ['rest-dagtaak', '-PT2H', undefined, 'een negatieve restduur: OPS schrijft die nooit'],
  ['lag-werktijd', 'P0Y0M2D', undefined, 'OPS schrijft de lag in deze indeling als P2D; geen voorbeeld'],
];
for (const [use, v, reads, why] of OUTSIDE) {
  const form = durationForm(v, SLOT_OF[use]);
  ok(`buiten de lijst · ${use} '${v}' (${why}): kreeg de vorm ${form?.name}`, form === undefined);
  if (reads === undefined) continue;
  const got = await readValue(use, v);
  ok(`buiten de lijst · ${use} '${v}': de lezer leest nu ${show(reads)} (kreeg ${show(got)}; ${why})`, typeof reads === 'string' ? got === reads : same(got, reads));
}

// ── 4: elke duur in een eigen bestand van OPS staat op de lijst ──
// Elk IFC-bestand in de repo met de applicatie van OPS, ook de oude eigen bestanden (`oude-tags/`, `oud-eigen-0.1-…`).
// Met dezelfde functie als de merge (`durationTexts`): het slot zoals de lezer het kiest, de tekst na de STEP-decodering.
const HAND_MADE: Readonly<Record<string, string>> = {
  // Met de hand gemaakt in `e345c2527` (13 oktober 2026, bewust hernoemde properties): een speling als `PT72H` en `PT16H`.
  // De writer schreef de speling in elke versie in dagen (`ifcDuration`, sinds `cbde9d4e7` in hele dagen).
  'tests/planning/fixtures/werkdag-einde-tussenwaarde.ifc': "IFCTASKTIME #55: speling 'PT72H'|IFCTASKTIME #55: speling 'PT16H'",
};
const files: string[] = [];
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === '.git' || f === '.claude' || f.startsWith('dist')) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p); else if (f.toLowerCase().endsWith('.ifc')) files.push(p);
  }
};
walk(ROOT);
/** Eigen bestanden die de scanner niet leest, met de reden van de scanner. De merge raakt ze nooit: zonder scan opent het
 *  bestand via de route van main, zonder vreemd deel (`ifcBytesRoute.ts`), en de lijst van vormen geldt dan niet. */
const NOT_SCANNED: Readonly<Record<string, StepScanReason>> = {
  // OPS v2026.2.0 tot en met v2026.7.12 schreef de naam rauw in FILE_NAME (`771db15cb`): de apostrof van `O'Hara` opent
  // een tekst die tot het einde van het bestand niet sluit. Het bestand kwam met #870 (`a026bed0f`); besluit van Trias
  // (review van #870, ronde 8; knownbug 1052): zo'n bestand opent zoals op main.
  'tests/planning/fixtures/oude-tags/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc': 'tekst-zonder-einde',
};
const notScanned = new Set<string>();
/** De scan van een eigen bestand; `undefined` als het in `NOT_SCANNED` staat en de scanner om precies die reden weigert. */
const scanOwn = (rel: string, bytes: Uint8Array) => {
  try {
    return scanStep(bytes);
  } catch (e) {
    if (e instanceof StepScanError && NOT_SCANNED[rel] === e.reason) { notScanned.add(rel); return undefined; }
    throw e;
  }
};
let ownFiles = 0;
let ownDurations = 0;
const outsideIn = (index: ReturnType<typeof scanStep>) => {
  const out: string[] = [];
  let count = 0;
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i)) continue;
    for (const { text: v, slot } of durationTexts(index, i)) {
      count++;
      if (!durationForm(v, slot)) out.push(`${index.type(i)} #${index.id(i)}: ${slot} '${v}'`);
    }
  }
  return { out, count };
};
const outsideOf = (bytes: Uint8Array) => outsideIn(scanStep(bytes));
for (const file of files.sort()) {
  const bytes = new Uint8Array(readFileSync(file));
  if (!/IFCAPPLICATION\([^;]*'Open Planner Studio'/.test(text(bytes))) continue;
  ownFiles++;
  const rel = relative(ROOT, file);
  let found: { out: string[]; count: number };
  try {
    const index = scanOwn(rel, bytes);
    if (!index) continue;
    found = outsideIn(index);
  } catch (e) { ok(`${rel}: scannen lukt (${(e as Error).message.slice(0, 80)})`, false); continue; }
  ownDurations += found.count;
  const expected = HAND_MADE[rel]?.split('|') ?? [];
  ok(`${rel}: elke duur staat op de lijst (buiten de lijst: ${found.out.slice(0, 3).join(', ')})`, found.out.length === expected.length && found.out.every(x => expected.includes(x)));
}
ok(`de repo heeft eigen bestanden van OPS (${ownFiles} bestanden, ${ownDurations} duren)`, ownFiles > 50 && ownDurations > 10000);
// Hetzelfde voor de datums, tijden en datum-tijden (`dateTimeTexts`, `partialDateTime`): de lijst van datumvormen van
// fixronde 5 en 6 (knownbug 1031). OPS schreef tot `32b6222de` (26 september 2026) een werktijd die niet op het hele uur
// begint als uurbreuk (`'7.5:00:00'`). `clockToMinutes` leest die niet als tijdblok, `scalarHourFromClock` wel, als 7,5 uur:
// alleen als enige periode van het enige patroon. Daar staat de vorm sinds fixronde 7 op de lijst (`OLD_FRACTIONAL_CLOCK`,
// BLOKKEERT 3). Hier vastgelegd hoeveel er per bestand zijn, zodat dat pad niet stil wegvalt.
const OLD_CLOCK: Readonly<Record<string, number>> = { 'tests/planning/fixtures/h7-tijden-oude-writer.ifc': 4 };
{
  let dates = 0;
  for (const file of files) {
    const bytes = new Uint8Array(readFileSync(file));
    if (!/IFCAPPLICATION\([^;]*'Open Planner Studio'/.test(text(bytes))) continue;
    let index;
    try { index = scanOwn(relative(ROOT, file), bytes); } catch { continue; } // al gemeld bij de duren hierboven
    if (!index) continue;
    const out: string[] = [];
    let oldClocks = 0;
    for (let i = 0; i < index.count; i++) {
      if (!index.isEntity(i)) continue;
      for (const { text: v, kind, oldClock } of dateTimeTexts(index, i)) {
        dates++;
        if (oldClock && OLD_FRACTIONAL_CLOCK.test(v)) oldClocks++;
        if (partialDateTime(v, kind, oldClock)) out.push(`${index.type(i)} #${index.id(i)}: ${kind} '${v}'`);
      }
    }
    const old = OLD_CLOCK[relative(ROOT, file)] ?? 0;
    ok(`${relative(ROOT, file)}: elke datum en tijd staat op de lijst (buiten: ${out.slice(0, 3).join(', ')}; oude uurbreuken ${oldClocks}, verwacht ${old})`,
      out.length === 0 && oldClocks === old);
  }
  ok(`de eigen bestanden hebben datums en tijden (${dates})`, dates > 10000);
}
for (const rel of Object.keys(HAND_MADE)) ok(`${rel} bestaat nog`, files.some(f => relative(ROOT, f) === rel));
for (const [rel, reason] of Object.entries(NOT_SCANNED)) ok(`${rel}: de scanner weigert het (${reason}); anders hoort het niet meer in NOT_SCANNED`, notScanned.has(rel));

// De writer van nu: de showcase (dag- en urentaken, lags in dagen en minuten) en de taak met elke vorm van de lijst in de
// taakduur, opnieuw geschreven.
{
  const o = await openForeign(latin1(showcase));
  const written = latin1(writeIFC(cloneDomain(o)));
  const found = outsideOf(written);
  ok(`de writer van nu: elke duur staat op de lijst (${found.count} duren; buiten: ${found.out.slice(0, 3).join(', ')})`, found.count > 500 && found.out.length === 0);
  for (const [name, use, v] of EXAMPLES.filter(([, use]) => use === 'duur' || use === 'rest-dagtaak' || use === 'rest-urentaak' || use === 'lag-werktijd')) {
    const re = await openForeign(latin1(sourceWith(use, v)));
    const again = outsideOf(latin1(writeIFC(cloneDomain(re))));
    ok(`de writer van nu na ${name} · ${use} '${v}': elke duur staat op de lijst (buiten: ${again.out.slice(0, 2).join(', ')})`, again.out.length === 0);
  }
}

console.log(`check-ifc-duurvormen: ${checks} controles, ${DURATION_FORMS.length} vormen, ${EXAMPLES.length} voorbeelden, ${OUTSIDE.length} vormen buiten de lijst, ${ownFiles} eigen bestanden met ${ownDurations} duren`);
if (diffs.length > 0) {
  for (const x of diffs) console.log(`XX ${x}`);
  console.log(`check-ifc-duurvormen: ${diffs.length} afwijking(en)`);
  process.exit(1);
}
console.log('check-ifc-duurvormen: alles groen');
