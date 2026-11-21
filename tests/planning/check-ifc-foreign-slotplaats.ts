// #804 stap 5, PR A: het aanwijzen van een slot dat de herleestoets (b) terugzette, in de boom van controle (c)
// (`restoredOwnSlots` en `ownGroupTrees` in `ownGroups.ts`), los op regels die deze proef zelf maakt. De boom is bewust zonder
// id's; een slot staat op zijn plaats: de groep, de weg via typen en namen vanaf de wortel, en het argument. Per geval: welke
// plaats het slot krijgt, of dat de groep terugvalt op het gedrag van vóór PR A (de hele groep buiten (c)), en dat het masker
// alleen dat ene slot verbergt: een verschil in elk ander slot, ook met hetzelfde argument of dezelfde naam elders, blijft
// zichtbaar. De echte opslagroute staat in `check-ifc-foreign-eigen-toets.ts` (blok 9) en `-eigen-uitvoer.ts` (blok 10).
import type { OutLine } from '@/services/ifc/foreign/lossCheck';
import { BASELINE_HEADS, TASK_OBJECT_TYPES, linesView, ownGroupTrees, restoredOwnSlots } from '@/services/ifc/foreign/ownGroups';
import { PSET } from '@/services/ifc/ifcPsets';

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`OK ${name}`); } else { failed++; console.error(`XX ${name}${detail ? `: ${detail}` : ''}`); }
}

const PS = PSET.ProjectSettings, PR = PSET.Project, SM = PSET.StructureMeta;
const line = (id: number, type: string, ...args: string[]): OutLine => ({ id, type, args });
/** Een project met twee eigen psets (`OPS_ProjectSettings` met twee properties, `OPS_Project` met één), de codes van
 *  `OPS_StructureMeta` (een template met een enumeratie), twee taken en twee baselinekoppen. */
const BASE: readonly OutLine[] = [
  line(1, 'IFCPROJECT'),
  line(2, 'IFCPROPERTYSINGLEVALUE', "'A'", '$', "IFCTEXT('a')", '$'),
  line(3, 'IFCPROPERTYSINGLEVALUE', "'B'", '$', "IFCTEXT('b')", '$'),
  line(4, 'IFCPROPERTYSET', "'g1'", '$', `'${PS}'`, '$', '(#2,#3)'),
  line(5, 'IFCRELDEFINESBYPROPERTIES', "'g2'", '$', '$', '$', '(#1)', '#4'),
  line(6, 'IFCPROPERTYSINGLEVALUE', "'A'", '$', "IFCTEXT('c')", '$'),
  line(7, 'IFCPROPERTYSET', "'g3'", '$', `'${PR}'`, '$', '(#6)'),
  line(8, 'IFCRELDEFINESBYPROPERTIES', "'g4'", '$', '$', '$', '(#1)', '#7'),
  line(40, 'IFCSIMPLEPROPERTYTEMPLATE', "'t1'", '$', "'Code A'", '$', '.P_ENUMERATEDVALUE.', '$', '$', '#41', '$', '$', '$', '$'),
  line(41, 'IFCPROPERTYENUMERATION', "'Code A'", "(IFCLABEL('A'))", '$'),
  line(42, 'IFCPROPERTYSETTEMPLATE', "'t2'", '$', `'${PSET.ActivityCodes}'`, '$', '.PSET_TYPEDRIVENOVERRIDE.', '$', '(#40)'),
  line(43, 'IFCRELDECLARES', "'t3'", '$', '$', '$', '#1', '(#42)'),
  line(20, 'IFCTASK', "'taak1'", '$', "'T1'", '$', '$', '$', '$', '$', '$', '.F.', '$', '$', '.NOTDEFINED.'),
  line(21, 'IFCTASK', "'taak2'", '$', "'T2'", '$', "'Type A'", '$', '$', '$', '$', '.F.', '$', '$', '.USERDEFINED.'),
  line(30, 'IFCWORKSCHEDULE', "'kop1'", '$', "'B1'", '$', '$', '$', "'2026-11-01T00:00:00'", '$', '$', '$', '$', "'2027-01-01T00:00:00'", '$', '.BASELINE.'),
  line(31, 'IFCWORKSCHEDULE', "'kop2'", '$', "'B2'", '$', '$', '$', "'2026-11-02T00:00:00'", '$', '$', '$', '$', "'2027-01-01T00:00:00'", '$', '.BASELINE.'),
];
/** De regels met slot `arg` van regel `id` op `token`. */
const set = (lines: readonly OutLine[], id: number, arg: number, token: string) =>
  lines.map(l => l.id === id ? { ...l, args: l.args.map((a, k) => k === arg ? token : a) } : l);
/** Een slot dat (b) terugzette: regel en argument, en `'deels'` bij een soort die de lezer deels draagt. */
type Edit = [number, number] | [number, number, 'deels'];
const placed = (lines: readonly OutLine[], ...edits: Edit[]) =>
  restoredOwnSlots(linesView(lines), edits.map(([id, arg, kind]) => ({ id, arg, partial: kind === 'deels' })));
const text = (r: ReturnType<typeof placed>) => `overslaan: ${[...r.skip].join(', ') || 'niets'}; masker: ${[...r.mask].join(' + ') || 'niets'}`;
/** De boom van één groep, met masker. */
const groupOf = (lines: readonly OutLine[], group: string, mask: ReadonlySet<string>) => (ownGroupTrees(linesView(lines), mask).get(group) ?? []).join('\n');
/** De uitvoer heeft in slot `arg` van `id` de bronwaarde `restored`, de writer schrijft er `$`; het masker uit `restoredOwnSlots`
 *  op de uitvoer. Gelijk met het masker, anders zonder; en een fout in een ander slot (`other`) blijft zichtbaar. */
function masks(label: string, group: string, id: number, arg: number, restored: string, others: readonly [string, number, number, string, string?][]) {
  const output = set(BASE, id, arg, restored), r = placed(output, [id, arg]);
  ok(`${label}: het slot krijgt een plaats`, r.skip.size === 0 && r.mask.size === 1 && r.slots[0]?.group === group && r.slots[0].place !== undefined, text(r));
  ok(`${label}: zonder masker leest de groep anders`, groupOf(output, group, new Set()) !== groupOf(BASE, group, new Set()));
  ok(`${label}: met het masker gelijk aan wat de writer schrijft`, groupOf(output, group, r.mask) === groupOf(BASE, group, r.mask));
  for (const [what, otherId, otherArg, token, otherGroup] of others) {
    const wrong = set(output, otherId, otherArg, token), g = otherGroup ?? group;
    ok(`${label}: het masker verbergt ${what} niet`, groupOf(wrong, g, r.mask) !== groupOf(BASE, g, r.mask));
  }
  return r;
}

// ── Eén slot in een pset, in een property, in een template; het masker verbergt alleen dat slot ──
{
  const r = masks('omschrijving van de pset', PS, 4, 3, "'Van een ander programma'", [
    ['de omschrijving van een property in dezelfde pset', 2, 1, "'Fout'"],
    ['de waarde van een property in dezelfde pset', 3, 2, "IFCTEXT('fout')"],
    ['de omschrijving van een andere pset (hetzelfde argument, andere groep)', 7, 3, "'Fout'", PR],
  ]);
  ok('omschrijving van de pset: de plaats', r.slots[0]?.place === `${PS}|IFCRELDEFINESBYPROPERTIES/5:IFCPROPERTYSET('${PS}')#3`, r.slots[0]?.place);
}
{
  const r = masks('omschrijving van property A', PS, 2, 1, "'Van een ander programma'", [
    ['dezelfde omschrijving op property B (hetzelfde argument, ander lid)', 3, 1, "'Fout'"],
    ['de waarde van property A (hetzelfde lid, ander argument)', 2, 2, "IFCTEXT('fout')"],
    ['de omschrijving van property A in een andere pset (dezelfde naam, andere groep)', 6, 1, "'Fout'", PR],
  ]);
  ok('omschrijving van property A: de plaats', r.slots[0]?.place === `${PS}|IFCRELDEFINESBYPROPERTIES/5:IFCPROPERTYSET('${PS}')/4:IFCPROPERTYSINGLEVALUE('A')#1`, r.slots[0]?.place);
}
{
  const r = masks('omschrijving van een codetemplate', SM, 40, 3, "'Van een ander programma'", [
    ['het label van haar enumeratie', 41, 1, "(IFCLABEL('B'))"],
    ['de omschrijving van het template van de codes', 42, 3, "'Fout'"],
  ]);
  ok('omschrijving van een codetemplate: de plaats', r.slots[0]?.place
    === `${SM}|IFCRELDECLARES/5:IFCPROPERTYSETTEMPLATE('${PSET.ActivityCodes}')/6:IFCSIMPLEPROPERTYTEMPLATE('Code A')#3`, r.slots[0]?.place);
}
// Twee slots in één groep: beide gemaskeerd, een derde niet.
{
  const output = set(set(BASE, 4, 3, "'Van een ander programma'"), 2, 1, "'Ook van een ander programma'");
  const r = placed(output, [4, 3], [2, 1]);
  ok('twee slots in één groep: beide krijgen een plaats', r.skip.size === 0 && r.mask.size === 2, text(r));
  ok('twee slots in één groep: met het masker gelijk', groupOf(output, PS, r.mask) === groupOf(BASE, PS, r.mask));
  ok('twee slots in één groep: een derde slot blijft zichtbaar', groupOf(set(output, 3, 1, "'Fout'"), PS, r.mask) !== groupOf(BASE, PS, r.mask));
}

// ── De tweede vormen: per taak en per kop, op GlobalId ──
{
  const r = masks('typenaam op een taak zonder type', TASK_OBJECT_TYPES, 20, 4, "'Type A'", [
    ['de typenaam van een andere taak', 21, 4, "'Fout'"],
    ['het PredefinedType van een andere taak', 21, 12, '.NOTDEFINED.'],
  ]);
  ok('typenaam op een taak zonder type: de plaats', r.slots[0]?.place === `${TASK_OBJECT_TYPES}|'taak1'#4`, r.slots[0]?.place);
  ok('typenaam op een taak zonder type: .USERDEFINED. op die taak blijft zichtbaar',
    groupOf(set(set(BASE, 20, 4, "'Type A'"), 20, 12, '.USERDEFINED.'), TASK_OBJECT_TYPES, r.mask) !== groupOf(BASE, TASK_OBJECT_TYPES, r.mask));
  const other = placed(BASE, [20, 2]);
  ok('een ander slot van de taak (de naam) ligt in geen groep', other.slots[0] === undefined && other.skip.size === 0 && other.mask.size === 0, text(other));
}
{
  const r = masks('omschrijving op een kop', BASELINE_HEADS, 30, 3, "'Van een ander programma'", [
    ['de omschrijving van een andere kop', 31, 3, "'Fout'"],
    ['de naam van dezelfde kop', 30, 2, "'Fout'"],
  ]);
  ok('omschrijving op een kop: de plaats', r.slots[0]?.place === `${BASELINE_HEADS}|'kop1'#3`, r.slots[0]?.place);
  // Een verwijzing naar een stuk van een ander programma (`Creators`, 1087): geen eigen regel, dus het slot krijgt hier een
  // plaats. Op de echte route is `(#…)` een lijst, een soort die de lezer deels draagt: daar valt de groep terug (hieronder,
  // en blok 9 van `check-ifc-foreign-eigen-toets.ts`).
  const creators = masks('vreemde Creators op een kop', BASELINE_HEADS, 30, 7, '(#95300)', [['de omschrijving van dezelfde kop', 30, 3, "'Fout'"]]);
  ok('vreemde Creators op een kop: de plaats', creators.slots[0]?.place === `${BASELINE_HEADS}|'kop1'#7`, creators.slots[0]?.place);
}

// ── Niet eenduidig: de groep valt terug op het gedrag van vóór PR A (de hele groep buiten (c)) ──
function fallsBack(label: string, lines: readonly OutLine[], group: string, ...edits: Edit[]) {
  const r = placed(lines, ...edits);
  ok(`${label}: de hele groep buiten (c), geen masker`, r.skip.has(group) && r.mask.size === 0 && r.slots.every(s => s?.group === group && s.place === undefined), text(r));
}
fallsBack('twee properties met dezelfde naam in één pset', set(BASE, 3, 0, "'A'"), PS, [2, 1]);
fallsBack('twee psets met dezelfde naam', [...BASE,
  line(9, 'IFCPROPERTYSINGLEVALUE', "'C'", '$', "IFCTEXT('d')", '$'),
  line(10, 'IFCPROPERTYSET', "'g5'", '$', `'${PS}'`, '$', '(#9)'),
  line(11, 'IFCRELDEFINESBYPROPERTIES', "'g6'", '$', '$', '$', '(#1)', '#10'),
], PS, [4, 3]);
fallsBack('één property in twee psets (twee groepen)', set(BASE, 7, 4, '(#6,#2)'), PS, [2, 1]);
fallsBack('het slot is de naam van de property', BASE, PS, [2, 0]);
fallsBack('het slot is de naam van de pset', BASE, PS, [4, 2]);
fallsBack('het slot verwijst naar een eigen regel in de groep (een eenheid)', [...set(BASE, 2, 3, '#12'), line(12, 'IFCSIUNIT', '*', '.LENGTHUNIT.', '$', '.METRE.')], PS, [2, 3]);
fallsBack('twee taken met dezelfde GlobalId', [...BASE, line(22, 'IFCTASK', "'taak1'", '$', "'T3'", '$', '$', '$', '$', '$', '$', '.F.', '$', '$', '.NOTDEFINED.')], TASK_OBJECT_TYPES, [20, 4]);
fallsBack('twee koppen met dezelfde GlobalId', set(BASE, 31, 0, "'kop1'"), BASELINE_HEADS, [30, 3]);
fallsBack('het slot is de GlobalId van een kop', BASE, BASELINE_HEADS, [30, 0]);
// Een bronwaarde van een soort die de lezer deels draagt (lijst, JSON, samengestelde tekst; `partial`): de lezer leest haar
// mee, dus de rest van de groep kan na heropenen anders teruglezen (de weesrij op een baseline-JSON van de bron, 1770).
fallsBack('een JSON-waarde die de lezer deels draagt', set(BASE, 2, 2, `IFCTEXT('{"a":1}')`), PS, [2, 2, 'deels']);
fallsBack('vreemde Creators op een kop (een lijst)', set(BASE, 30, 7, '(#95300)'), BASELINE_HEADS, [30, 7, 'deels']);
// Eén slot niet eenduidig maakt de hele groep tot overslag, ook voor een ander slot in die groep dat wel een plaats heeft;
// een andere groep houdt haar masker.
{
  const lines = set(BASE, 3, 0, "'A'"), r = placed(lines, [2, 1], [4, 3], [7, 3]);
  ok('niet eenduidig in de ene groep: die groep helemaal buiten (c), de andere groep per slot',
    r.skip.has(PS) && r.skip.size === 1 && [...r.mask].every(m => m.startsWith(`${PR}|`)) && r.mask.size === 1, text(r));
}

console.log(`\n${passed} OK, ${failed} XX`);
if (failed > 0) process.exit(1);
