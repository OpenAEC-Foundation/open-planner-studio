// #804 stap 5, PR A: een slot dat de herleestoets (b) terugzette, in controle (c) (`restoredOwnSlots` en
// `restoredOwnGroupDifference` in `ownGroups.ts`), los op regels die deze proef zelf maakt. De boom is bewust zonder id's;
// een slot staat op zijn plaats: de groep, de weg via typen en namen vanaf de wortel, en het argument. Per geval: welke plaats
// het slot krijgt, of dat de groep terugvalt op het gedrag van vóór PR A (de hele groep buiten (c)); dat (c) op die plaats
// precies de regel en de bronwaarde van (b) eist (een andere waarde, een leeg slot of een andere regel weigert); en dat een
// verschil in elk ander slot, ook met hetzelfde argument of dezelfde naam elders, zichtbaar blijft. De echte opslagroute staat
// in `check-ifc-foreign-eigen-toets.ts` (blok 9) en `-eigen-uitvoer.ts` (blok 10).
import type { OutLine } from '@/services/ifc/foreign/lossCheck';
import {
  BASELINE_HEADS, TASK_OBJECT_TYPES, linesView, restoredOwnGroupDifference, restoredOwnSlots, type RestoredOwnSlots,
} from '@/services/ifc/foreign/ownGroups';
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
/** Een slot dat (b) terugzette: regel, argument en bronwaarde, en `'deels'` bij een soort die de lezer deels draagt. */
type Edit = [number, number, string] | [number, number, string, 'deels'];
/** De slots van (b), aangewezen op `lines`: O1 zoals de writer het schreef, zonder de bronwaarden. */
const placed = (lines: readonly OutLine[], ...edits: Edit[]) =>
  restoredOwnSlots(linesView(lines), edits.map(([id, arg, token, kind]) => ({ id, arg, token, ...(kind === 'deels' ? { partial: true as const } : {}) })));
const text = (r: RestoredOwnSlots) => `overslaan: ${[...r.skip].join(', ') || 'niets'}; apart: ${r.slots.map(s => `${s.place} (#${s.id})`).join(' + ') || 'niets'}`;
const NONE: RestoredOwnSlots = { skip: new Set(), slots: [] };
/** (c) op `output` tegen wat de writer schrijft (`BASE`, of `writer`): de groep van het eerste verschil, of niets. */
const caught = (output: readonly OutLine[], r: RestoredOwnSlots, writer: readonly OutLine[] = BASE) =>
  restoredOwnGroupDifference(linesView(output), linesView(writer), r)?.group;
/** De uitvoer heeft in slot `arg` van `id` de bronwaarde `restored`, de writer schrijft er `$`. Met het slot apart gelijk,
 *  zonder niet; een andere waarde of een leeg slot daar weigert; een fout in een ander slot (`others`) blijft zichtbaar. */
function masks(label: string, group: string, id: number, arg: number, restored: string, others: readonly [string, number, number, string, string?][]) {
  const output = set(BASE, id, arg, restored), r = placed(BASE, [id, arg, restored]);
  ok(`${label}: het slot krijgt een plaats`, r.skip.size === 0 && r.slots.length === 1 && r.slots[0].group === group && r.slots[0].id === id, text(r));
  ok(`${label}: zonder het slot apart leest de groep anders`, caught(output, NONE) === group);
  ok(`${label}: met het slot apart gelijk aan wat de writer schrijft`, caught(output, r) === undefined, caught(output, r));
  ok(`${label}: een andere waarde op het slot weigert`, caught(set(output, id, arg, "'Andere waarde'"), r) === group);
  ok(`${label}: het slot leeg weigert`, caught(set(output, id, arg, '$'), r) === group);
  for (const [what, otherId, otherArg, token, otherGroup] of others) {
    ok(`${label}: (c) ziet ${what}`, caught(set(output, otherId, otherArg, token), r) === (otherGroup ?? group));
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
// Twee slots in één groep: beide apart, een derde slot gewoon getoetst.
{
  const output = set(set(BASE, 4, 3, "'Van een ander programma'"), 2, 1, "'Ook van een ander programma'");
  const r = placed(BASE, [4, 3, "'Van een ander programma'"], [2, 1, "'Ook van een ander programma'"]);
  ok('twee slots in één groep: beide krijgen een plaats', r.skip.size === 0 && r.slots.length === 2, text(r));
  ok('twee slots in één groep: met de slots apart gelijk', caught(output, r) === undefined);
  ok('twee slots in één groep: een derde slot blijft zichtbaar', caught(set(output, 3, 1, "'Fout'"), r) === PS);
  ok('twee slots in één groep: het tweede slot met een andere waarde weigert', caught(set(output, 2, 1, "'Andere waarde'"), r) === PS);
}
// Een andere regel op de plaats van het slot (de review van #1095, punt 1): de pset met de bronwaarde onder een ander id. De
// boom ziet geen id's; (c) eist op die plaats de regel waarop (b) de bronwaarde zette.
{
  const output = set(BASE, 4, 3, "'Van een ander programma'"), r = placed(BASE, [4, 3, "'Van een ander programma'"]);
  const moved = output.map(l => l.id === 4 ? { ...l, id: 99 } : l.id === 5 ? { ...l, args: l.args.map((a, k) => k === 5 ? '#99' : a) } : l);
  ok('een andere regel op de plaats van het slot weigert', caught(moved, r) === PS, text(r));
}

// ── De tweede vormen: per taak en per kop, op GlobalId ──
{
  const r = masks('typenaam op een taak zonder type', TASK_OBJECT_TYPES, 20, 4, "'Type A'", [
    ['de typenaam van een andere taak', 21, 4, "'Fout'"],
    ['het PredefinedType van een andere taak', 21, 12, '.NOTDEFINED.'],
  ]);
  ok('typenaam op een taak zonder type: de plaats', r.slots[0]?.place === `${TASK_OBJECT_TYPES}|'taak1'#4`, r.slots[0]?.place);
  ok('typenaam op een taak zonder type: .USERDEFINED. op die taak blijft zichtbaar',
    caught(set(set(BASE, 20, 4, "'Type A'"), 20, 12, '.USERDEFINED.'), r) === TASK_OBJECT_TYPES);
  const other = placed(BASE, [20, 2, "'Andere naam'"]);
  ok('een ander slot van de taak (de naam) ligt in geen groep', other.slots.length === 0 && other.skip.size === 0, text(other));
}
{
  const r = masks('omschrijving op een kop', BASELINE_HEADS, 30, 3, "'Van een ander programma'", [
    ['de omschrijving van een andere kop', 31, 3, "'Fout'"],
    ['de naam van dezelfde kop', 30, 2, "'Fout'"],
  ]);
  ok('omschrijving op een kop: de plaats', r.slots[0]?.place === `${BASELINE_HEADS}|'kop1'#3`, r.slots[0]?.place);
}

// ── Niet eenduidig: de groep valt terug op het gedrag van vóór PR A (de hele groep buiten (c)) ──
function fallsBack(label: string, lines: readonly OutLine[], group: string, ...edits: Edit[]) {
  const r = placed(lines, ...edits);
  ok(`${label}: de hele groep buiten (c), geen slot apart`, r.skip.has(group) && r.slots.length === 0, text(r));
}
const FOREIGN = "'Van een ander programma'";
fallsBack('twee properties met dezelfde naam in één pset', set(BASE, 3, 0, "'A'"), PS, [2, 1, FOREIGN]);
fallsBack('twee psets met dezelfde naam', [...BASE,
  line(9, 'IFCPROPERTYSINGLEVALUE', "'C'", '$', "IFCTEXT('d')", '$'),
  line(10, 'IFCPROPERTYSET', "'g5'", '$', `'${PS}'`, '$', '(#9)'),
  line(11, 'IFCRELDEFINESBYPROPERTIES', "'g6'", '$', '$', '$', '(#1)', '#10'),
], PS, [4, 3, FOREIGN]);
fallsBack('één property in twee psets (twee groepen)', set(BASE, 7, 4, '(#6,#2)'), PS, [2, 1, FOREIGN]);
fallsBack('het slot is de naam van de property', BASE, PS, [2, 0, "'C'"]);
fallsBack('het slot is de naam van de pset', BASE, PS, [4, 2, "'Andere pset'"]);
// Een verwijzing in de bronwaarde of in de waarde van de writer: daar hangt een deel van de boom aan, of de hernummering van
// de merge verandert de waarde. Ook een verwijzing naar een stuk van een ander programma (`Creators`, 1087).
const UNIT = line(12, 'IFCSIUNIT', '*', '.LENGTHUNIT.', '$', '.METRE.');
fallsBack('de bronwaarde verwijst naar een eigen regel in de groep (een eenheid)', [...BASE, UNIT], PS, [2, 3, '#12']);
fallsBack('de waarde van de writer verwijst naar een eigen regel in de groep (een eenheid)', [...set(BASE, 2, 3, '#12'), UNIT], PS, [2, 3, '$']);
fallsBack('vreemde Creators op een kop (een verwijzing)', BASE, BASELINE_HEADS, [30, 7, '(#95300)']);
fallsBack('twee taken met dezelfde GlobalId', [...BASE, line(22, 'IFCTASK', "'taak1'", '$', "'T3'", '$', '$', '$', '$', '$', '$', '.F.', '$', '$', '.NOTDEFINED.')], TASK_OBJECT_TYPES, [20, 4, "'Type A'"]);
fallsBack('twee koppen met dezelfde GlobalId', set(BASE, 31, 0, "'kop1'"), BASELINE_HEADS, [30, 3, FOREIGN]);
fallsBack('het slot is de GlobalId van een kop', BASE, BASELINE_HEADS, [30, 0, "'kop9'"]);
// Een bronwaarde van een soort die de lezer deels draagt (lijst, JSON, samengestelde tekst; `partial`): de lezer leest haar
// mee, dus de rest van de groep kan na heropenen anders teruglezen (de weesrij op een baseline-JSON van de bron, 1770).
fallsBack('een JSON-waarde die de lezer deels draagt', BASE, PS, [2, 2, `IFCTEXT('{"a":1}')`, 'deels']);
fallsBack('een lijst die de lezer deels draagt', BASE, BASELINE_HEADS, [30, 7, "('A','B')", 'deels']);
// Eén slot niet eenduidig maakt de hele groep tot overslag, ook voor een ander slot in die groep dat wel een plaats heeft;
// een andere groep houdt haar slot apart.
{
  const lines = set(BASE, 3, 0, "'A'"), r = placed(lines, [2, 1, FOREIGN], [4, 3, FOREIGN], [7, 3, FOREIGN]);
  ok('niet eenduidig in de ene groep: die groep helemaal buiten (c), de andere groep per slot',
    r.skip.has(PS) && r.skip.size === 1 && r.slots.length === 1 && r.slots[0].group === PR && r.slots[0].id === 7, text(r));
}
// In de herschreven boom (wat de writer schrijft) moet op de plaats precies één regel staan, met een waarde zonder
// verwijzing; anders slaat (c) de groep over, zoals vóór PR A.
{
  const output = set(BASE, 4, 3, FOREIGN), r = placed(BASE, [4, 3, FOREIGN]);
  const writer = [...BASE, line(9, 'IFCPROPERTYSINGLEVALUE', "'C'", '$', "IFCTEXT('d')", '$'), line(10, 'IFCPROPERTYSET', "'g5'", '$', `'${PS}'`, '$', '(#9)'),
    line(11, 'IFCRELDEFINESBYPROPERTIES', "'g6'", '$', '$', '$', '(#1)', '#10')];
  ok('twee tegenhangers in de herschreven boom: de groep buiten (c)', caught(set(output, 2, 1, "'Fout'"), r, writer) === undefined);
  ok('een verwijzing op de plaats in de herschreven boom: de groep buiten (c)',
    caught(set(output, 2, 1, "'Fout'"), r, [...set(BASE, 4, 3, '#12'), UNIT]) === undefined);
  ok('één tegenhanger zonder verwijzing: de groep getoetst', caught(set(output, 2, 1, "'Fout'"), r) === PS);
}

console.log(`\n${passed} OK, ${failed} XX`);
if (failed > 0) process.exit(1);
