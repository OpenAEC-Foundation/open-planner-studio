// De `.xlsx`-schrijver van het voortgangsblad (issue #27, etappe 3 — taak T6).
//
// Wat deze batterij bewaakt, en waarom juist dít:
//   * De KINDVOLGORDES van `CT_Worksheet` en `CT_Stylesheet`. OOXML-schema's zijn `xsd:sequence`;
//     een element op de verkeerde plek levert geen nette foutmelding op maar "Excel heeft onleesbare
//     inhoud gevonden". Deze asserties vangen dat af zónder Excel.
//   * De verplichte minima die Excel nergens uitlegt maar wel eist: ≥ 1 font, ≥ 2 fills met
//     `gray125` als tweede, ≥ 1 border, ≥ 1 `cellStyleXfs`, en `count`-attributen die kloppen met
//     het werkelijke aantal kinderen.
//   * De vier dingen die eigenaarsbesluit E9 letterlijk vraagt: breedte op maat, alleen de
//     invulcellen bewerkbaar, invoervalidatie, en echte datumcellen.
//   * De POLARITEIT van `sheetProtection` — daar betekent `1` VERBODEN. Een omgedraaide boolean
//     levert een blad op dat precies het omgekeerde doet van wat gevraagd is, zonder dat er iets
//     stukgaat.
//
// De verwachte waarden komen van BUITEN de implementatie: uit ECMA-376 (de sequences, de minima,
// de `sheetProtection`-polariteit, de `_xHHHH_`-notatie) en uit wat de invuller op zijn scherm hoort
// te zien. Ze zijn niet uit de code teruggelezen.
//
// STUB, expliciet gemarkeerd: `writeZip` (taak T5, baan A) bestaat op het moment van schrijven nog
// niet. De structurele asserties draaien daarom op `buildProgressXlsxParts` en hebben de ZIP niet
// nodig; de zip-SAMENSTELLING wordt getoetst op de bytes die `writeProgressSheetXLSX` teruggeeft, op
// een manier die met beide werkt — is er een echte ZIP (`PK\x03\x04`), dan wordt de local header
// gelezen; is er een stub-`writeZip` ingealiast, dan wordt diens JSON-weergave gelezen. De ECHTE
// round-trip door de echte ZIP-lezer komt in T8/T14.
//
// Standalone draaien zolang T5 nog niet gemerged is (voeg de eerste `--alias:` toe; daarna vervalt
// die regel en draait het gewone `bundle_check`-commando uit tests/planning/README.md):
//   node_modules/.bin/esbuild tests/planning/check-progress-xlsx-writer.ts --bundle \
//     --platform=node --format=esm --alias:@/services/zip/zipWriter=<stub>.ts --alias:@=src \
//     --outfile=/tmp/check.mjs && node /tmp/check.mjs; echo "exit: $?"
//
// Draait via run.sh (registratie: T14). Exit 0 = alles groen; de suite print "alles groen" ook bij
// exit 1 wanneer het bundelen faalt — de exitcode is het enige geldige oordeel.

import {
  buildProgressXlsxParts,
  writeProgressSheetXLSX,
  type ProgressXlsxText,
} from '@/services/xlsx/writeProgressXlsx';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture — geschreven vanuit wat de INVULLER hoort te zien, niet vanuit de code
// ─────────────────────────────────────────────────────────────────────────────

function makeTask(id: string, wbsCode: string, name: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    name,
    description: '',
    wbsCode,
    taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED',
    isMilestone: false,
    priority: 500,
    parentId: null,
    childIds: [],
    resourceIds: [],
    time: createDefaultTaskTime('2026-06-08', 5),
    ...overrides,
  };
}

const tasks: readonly Task[] = [
  // Rij 2 — een VERZAMELtaak met een `&` in de naam (XML-escaping) en een em-dash in de naam zelf.
  makeTask('t-1', '1', 'Fundering — Staal & Beton', {
    childIds: ['t-2', 't-3'],
    time: { ...createDefaultTaskTime('2026-06-08', 5), earlyStart: '2026-06-08', earlyFinish: '2026-06-12', completion: 0.5 },
  }),
  // Rij 3 — een blad-taak op exact 1/3 (de decimalen-eis van X6) met een STUURTEKEN in de naam.
  makeTask('t-2', '1.1', 'Wapening vlechten', {
    parentId: 't-1',
    time: {
      ...createDefaultTaskTime('2026-06-08', 3),
      earlyStart: '2026-06-08', earlyFinish: '2026-06-10',
      completion: 1 / 3, actualStart: '2026-06-09',
    },
  }),
  // Rij 4 — een blad-taak met een DATUMTIJD als werkelijke start (uur-modus) en geen eindwaarde.
  makeTask('t-3', '1.2', 'Storten', {
    parentId: 't-1',
    time: {
      ...createDefaultTaskTime('2026-06-11', 2),
      earlyStart: '2026-06-11', earlyFinish: '2026-06-12',
      completion: 0, actualStart: '2026-06-11T08:30',
    },
  }),
];

const text: ProgressXlsxText = {
  headerNotes: {
    'OPS Task ID': 'niet wijzigen',
    WBS: 'niet wijzigen',
    Name: 'niet wijzigen',
    Start: 'geplande datum, niet wijzigen',
    Finish: 'geplande datum, niet wijzigen',
    'Completion (%)': 'vul hier het percentage in (0-100)',
    'Actual Start': 'vul hier de werkelijke startdatum in',
    'Actual Finish': 'vul hier de werkelijke einddatum in',
  },
  summaryNote: '— niet invullen: een verzameltaak krijgt geen voortgang uit een blad',
  sheetName: 'Voortgang: 2026/Q2',
  validation: {
    percentTitle: 'Ongeldig percentage',
    percentError: 'Vul een getal tussen 0 en 100 in.',
    dateTitle: 'Ongeldige datum',
    dateError: 'Vul een geldige datum in.',
  },
};

const parts = buildProgressXlsxParts(tasks, text);
const partXml = (name: string): string => parts.find(p => p.name === name)?.xml ?? '';
const ws = partXml('xl/worksheets/sheet1.xml');
const st = partXml('xl/styles.xml');
const wb = partXml('xl/workbook.xml');

// ─────────────────────────────────────────────────────────────────────────────
// Testgereedschap
// ─────────────────────────────────────────────────────────────────────────────

const idx = (s: string, needle: string): number => s.indexOf(needle);

/** Alle needles komen voor, in deze volgorde. */
function ordered(s: string, needles: readonly string[]): boolean {
  let cursor = -1;
  for (const needle of needles) {
    const at = s.indexOf(needle, cursor + 1);
    if (at < 0) return false;
    cursor = at;
  }
  return true;
}

const countOf = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
const countFills = (s: string): number => countOf(s, /<fill>/g);

/** Het `count`-attribuut zoals het bestand het CLAIMT — te vergelijken met het echte aantal. */
function declaredCount(s: string, tag: string): number {
  const m = new RegExp(`<${tag} count="(\\d+)"`).exec(s);
  return m ? Number(m[1]) : -1;
}

function section(s: string, tag: string): string {
  const open = s.indexOf(`<${tag} `);
  const close = s.indexOf(`</${tag}>`, open);
  return open < 0 || close < 0 ? '' : s.slice(open, close);
}

/** De `<xf>`-elementen van `cellXfs`, in volgorde — de stijlindex is de positie in deze lijst. */
function cellXfEntries(styles: string): string[] {
  return section(styles, 'cellXfs').match(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g) ?? [];
}

const unlockedStyleCount = (styles: string): number =>
  cellXfEntries(styles).filter(xf => xf.includes('<protection locked="0"/>')).length;

/** De stijlindex die vergrendeld is (géén `protection locked="0"`) én een fill draagt. */
function lockedSummaryStyle(styles: string): number {
  return cellXfEntries(styles).findIndex(
    xf => !xf.includes('<protection locked="0"/>') && /fillId="[1-9]/.test(xf),
  );
}

const colWidths = (sheet: string): number[] =>
  [...sheet.matchAll(/<col\b[^>]*\bwidth="([\d.]+)"/g)].map(m => Number(m[1]));

const colStyles = (sheet: string): number[] =>
  [...sheet.matchAll(/<col\b[^>]*\bstyle="(\d+)"/g)].map(m => Number(m[1]));

function validation(sheet: string, type: 'decimal' | 'date'): Record<string, string> {
  const m = new RegExp(`<dataValidation type="${type}"[^>]*>[\\s\\S]*?</dataValidation>`).exec(sheet);
  if (!m) return {};
  const block = m[0];
  const attrs: Record<string, string> = {};
  for (const a of block.slice(0, block.indexOf('>')).matchAll(/([a-zA-Z0-9]+)="([^"]*)"/g)) {
    attrs[a[1]!] = a[2]!;
  }
  attrs.f1 = /<formula1>([^<]*)<\/formula1>/.exec(block)?.[1] ?? '';
  attrs.f2 = /<formula2>([^<]*)<\/formula2>/.exec(block)?.[1] ?? '';
  return attrs;
}

/** De stijlindex van de cel die de verzamelrij-markering draagt. */
function summaryCellStyle(sheet: string): number {
  const m = /<c r="[A-Z]+\d+" s="(\d+)" t="inlineStr"><is><t[^>]*>— niet invullen/.exec(sheet);
  return m ? Number(m[1]) : -1;
}

/** De `s`-waarde van één specifieke cel. */
function cellStyleAt(sheet: string, ref: string): number {
  const m = new RegExp(`<c r="${ref}" s="(\\d+)"`).exec(sheet);
  return m ? Number(m[1]) : -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// parts
// ─────────────────────────────────────────────────────────────────────────────

eq('zes parts, niet meer', parts.length, 6);
eq('[Content_Types].xml staat vooraan', parts[0]?.name, '[Content_Types].xml');
eq('exact deze zes partnamen', parts.map(p => p.name), [
  '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
  'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/styles.xml',
]);
ok('geen sharedStrings', !parts.some(p => p.name.includes('sharedStrings')));
ok('elke part is welgevormd genoeg om met de XML-declaratie te beginnen',
  parts.every(p => p.xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')));
ok('geen DOCTYPE of ENTITY in enige part',
  parts.every(p => !p.xml.includes('<!DOCTYPE') && !p.xml.includes('<!ENTITY')));
eq('twee keer bouwen geeft hetzelfde bestand',
  JSON.stringify(buildProgressXlsxParts(tasks, text)), JSON.stringify(parts));

// ─────────────────────────────────────────────────────────────────────────────
// worksheet-volgorde (X4)
// ─────────────────────────────────────────────────────────────────────────────

ok('dimension → sheetViews → sheetFormatPr → cols → sheetData',
  ordered(ws, ['<dimension ', '<sheetViews>', '<sheetFormatPr ', '<cols>', '<sheetData>']));
ok('cols vóór sheetData', idx(ws, '<cols') < idx(ws, '<sheetData'));
ok('sheetProtection ná sheetData', idx(ws, '<sheetData') < idx(ws, '<sheetProtection'));
ok('dataValidations ná sheetProtection', idx(ws, '<sheetProtection') < idx(ws, '<dataValidations'));
ok('pane vóór selection', idx(ws, '<pane ') < idx(ws, '<selection '));
ok('kopregel bevroren', ws.includes('ySplit="1"') && ws.includes('state="frozen"'));
eq('dimension dekt acht kolommen en vier rijen', /<dimension ref="([^"]+)"/.exec(ws)?.[1], 'A1:H4');

// ─────────────────────────────────────────────────────────────────────────────
// styleSheet-volgorde en minima (X4)
// ─────────────────────────────────────────────────────────────────────────────

ok('numFmts → fonts → fills → borders → cellStyleXfs → cellXfs',
  ordered(st, ['<numFmts', '<fonts', '<fills', '<borders', '<cellStyleXfs', '<cellXfs']));
ok('cellStyles → dxfs → tableStyles sluiten de rij',
  ordered(st, ['<cellXfs', '<cellStyles', '<dxfs', '<tableStyles']));
eq('twee fills', countFills(st), 2);
ok('gray125 als tweede', st.includes('gray125'));
ok('none als eerste fill', idx(st, 'patternType="none"') < idx(st, 'gray125'));
eq('fills-count klopt met de kinderen', declaredCount(st, 'fills'), 2);
eq('fonts-count klopt met de kinderen', declaredCount(st, 'fonts'), countOf(st, /<font>/g));
eq('borders-count klopt met de kinderen', declaredCount(st, 'borders'), countOf(st, /<border>/g));
eq('cellXfs-count klopt met de kinderen', declaredCount(st, 'cellXfs'), cellXfEntries(st).length);
ok('minstens één cellStyleXfs', declaredCount(st, 'cellStyleXfs') >= 1);
ok('elke custom numFmt heeft een id vanaf 164',
  [...st.matchAll(/numFmtId="(\d+)" formatCode/g)].every(m => Number(m[1]) >= 164));

// ─────────────────────────────────────────────────────────────────────────────
// E9: breedte, slot, validatie
// ─────────────────────────────────────────────────────────────────────────────

eq('acht kolombreedtes', colWidths(ws).length, 8);
ok('elke kolom heeft een breedte', colWidths(ws).every(w => w >= 10));
ok('de naamkolom is breder dan de wbs-kolom', colWidths(ws)[2]! > colWidths(ws)[1]!);
ok('de instructie blaast de kolom NIET op', colWidths(ws).every(w => w <= 46));
// De klem op 46 alleen is te zwak: die verbergt een breedte die de instructie WEL meetelt. Deze twee
// pinnen de formule op de data plus de KALE sleutel. `Completion (%)` is 14 tekens en zijn breedste
// waarde `33.3333` is er 7, dus 14 × 1,05 + 2; met de instructie erbij (51 tekens) zou hij tegen de
// klem van 46 aanlopen. `Name` volgt zijn langste taaknaam (25 tekens), niet zijn kop.
eq('breedte volgt de kale sleutel, niet de instructie', colWidths(ws)[5], 16.7);
eq('breedte volgt de langste celwaarde', colWidths(ws)[2], 28.25);
ok('kopregel heeft een vaste hoogte', ws.includes('ht="46" customHeight="1"'));
eq('blad is beveiligd', ws.includes('<sheetProtection sheet="1"'), true);
eq('selecteren blijft toegestaan', ws.includes('selectLockedCells="0"'), true);
eq('kolombreedte aanpassen mag', ws.includes('formatColumns="0"'), true);
ok('geen wachtwoord op de bladbeveiliging', !ws.includes('password='));
eq('vier ontgrendelde stijlen', unlockedStyleCount(st), 4); // tekst/percentage/datum/datumtijd
eq('percentagevalidatie 0..100', (({ f1, f2, allowBlank }) => ({ f1, f2, allowBlank }))(validation(ws, 'decimal')),
  { f1: '0', f2: '100', allowBlank: '1' });
eq('datumvalidatie is type date', validation(ws, 'date').type, 'date');
eq('twee validatieblokken', declaredCount(ws, 'dataValidations'), 2);
eq('percentagevalidatie dekt precies de invulkolom tot de laatste rij',
  validation(ws, 'decimal').sqref, 'F2:F4');
eq('datumvalidatie dekt beide werkelijke-datumkolommen', validation(ws, 'date').sqref, 'G2:H4');
ok('sqref is begrensd tot de laatste rij', !ws.includes('1048576'));
ok('een lege cel mag nooit een foutmelding geven', validation(ws, 'date').allowBlank === '1');
eq('de foutmelding is een stop', validation(ws, 'decimal').errorStyle, 'stop');
ok('de invulhint hergebruikt de kopinstructie',
  validation(ws, 'decimal').prompt === 'vul hier het percentage in (0-100)');
eq('de invulkolommen dragen ook op kolomniveau een ontgrendelde stijl',
  colStyles(ws).slice(5), [6, 7, 7]);
eq('de alleen-lezen kolommen dragen een vergrendelde stijl', colStyles(ws).slice(0, 5), [2, 2, 2, 3, 3]);

// ─────────────────────────────────────────────────────────────────────────────
// celtypen
// ─────────────────────────────────────────────────────────────────────────────

ok('datums zijn getalcellen met datumopmaak', /<c r="D2" s="3"><v>\d+<\/v><\/c>/.test(ws));
ok('geen datum als tekst', !/t="inlineStr"><is><t[^>]*>2026-/.test(ws));
ok('percentage met decimalen', ws.includes('<v>33.3333</v>'));
ok('naam is een inline string', ws.includes('t="inlineStr"'));
ok('xml:space blijft behouden', ws.includes('xml:space="preserve"'));
eq('een werkelijke startdatum staat in de ontgrendelde datumstijl', cellStyleAt(ws, 'G3'), 7);
eq('een werkelijke startdatum MET tijd staat in de datumtijdstijl', cellStyleAt(ws, 'G4'), 8);
ok('een lege werkelijke einddatum levert geen cel op', !ws.includes('<c r="H4"'));
ok('rij-r-attributen lopen op', ordered(ws, ['<row r="1"', '<row r="2"', '<row r="3"', '<row r="4"']));
ok('cel-r-attributen lopen op binnen hun rij',
  ordered(ws, ['<c r="A3"', '<c r="B3"', '<c r="C3"', '<c r="D3"', '<c r="E3"', '<c r="F3"', '<c r="G3"']));
ok('geen cel-r-attribuut buiten zijn eigen rij',
  [...ws.matchAll(/<row r="(\d+)"[^>]*>((?:(?!<\/row>)[\s\S])*)/g)].every(m =>
    [...m[2]!.matchAll(/<c r="[A-Z]+(\d+)"/g)].every(c => c[1] === m[1])));

// ─────────────────────────────────────────────────────────────────────────────
// E8/E9: instructies en verzameltaken
// ─────────────────────────────────────────────────────────────────────────────

ok('kopcel draagt de instructie', ws.includes('OPS Task ID — niet wijzigen'));
ok('verzamelrij draagt de em-dash', ws.includes('— niet invullen'));
ok('…en die cel is vergrendeld', summaryCellStyle(ws) === lockedSummaryStyle(st));
ok('de verzamelrij verliest zijn GEPLANDE datums niet', /<c r="D2" s="3">/.test(ws));
ok('een verzameltaak krijgt geen percentage-getal', !/<c r="F2" s="\d+"><v>/.test(ws));
eq('bladnaam gesaneerd voor Excel', /<sheet name="([^"]*)"/.exec(wb)?.[1], 'Voortgang 2026 Q2');

// ─────────────────────────────────────────────────────────────────────────────
// vijandige invoer
// ─────────────────────────────────────────────────────────────────────────────

ok('stuurteken in een taaknaam breekt het blad niet', ws.includes('_x0001_'));
// XML 1.0 laat alleen tab/newline/carriage return als stuurteken toe; al het andere MOET als
// `_xHHHH_` het bestand in, anders weigert Excel de hele werkmap.
const hasRawControlChar = (s: string): boolean => {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code === 0x7f) return true;
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return true;
  }
  return false;
};
ok('…en staat nergens rauw in enige part', parts.every(p => !hasRawControlChar(p.xml)));
ok('& in een taaknaam', ws.includes('Staal &amp; Beton'));
{
  const hostile = buildProgressXlsxParts(
    [makeTask('t-x', '<1>', 'A "B" \'C\' & <D> _x0041_')],
    { sheetName: 'a'.repeat(60) },
  );
  const hws = hostile.find(p => p.name === 'xl/worksheets/sheet1.xml')?.xml ?? '';
  const hwb = hostile.find(p => p.name === 'xl/workbook.xml')?.xml ?? '';
  ok('een letterlijke _x0041_ wordt zelf ontsnapt', hws.includes('_x005F_x0041_'));
  ok('haakjes in een WBS-code worden ontsnapt', hws.includes('&lt;1&gt;'));
  ok('een rauw < in de celtekst wordt een entiteit', hws.includes('&lt;D&gt;') && !hws.includes('<D>'));
  eq('een te lange bladnaam wordt afgekapt op 31 tekens',
    (/<sheet name="([^"]*)"/.exec(hwb)?.[1] ?? '').length, 31);
}
{
  // Zonder tekstopties: geen instructies, geen markering, geen validatieteksten — maar wél een
  // geldig blad met dezelfde structuur. Dit is de tak die bestaande aanroepers zouden gebruiken.
  const bare = buildProgressXlsxParts(tasks);
  const bws = bare.find(p => p.name === 'xl/worksheets/sheet1.xml')?.xml ?? '';
  ok('zonder instructies staat de kale sleutel in de kop', bws.includes('>OPS Task ID<'));
  ok('zonder summaryNote krijgt een verzameltaak gewoon zijn waarde', /<c r="F2" s="6"><v>50<\/v>/.test(bws));
  ok('de validatie blijft staan zonder teksten', bws.includes('<dataValidations count="2">'));
  ok('geen leeg errorTitle-attribuut', !bws.includes('errorTitle=""'));
}
{
  // Een leeg project: `F2:F1` zou een ongeldig bereik zijn, dus de ondergrens is rij 2.
  const empty = buildProgressXlsxParts([], text);
  const ews = empty.find(p => p.name === 'xl/worksheets/sheet1.xml')?.xml ?? '';
  eq('leeg project houdt een geldig validatiebereik', validation(ews, 'decimal').sqref, 'F2:F2');
  ok('leeg project heeft alleen de kopregel', !ews.includes('<row r="2"'));
}

// ─────────────────────────────────────────────────────────────────────────────
// zip-samenstelling — werkt zowel met de echte `writeZip` (T5) als met een ingealiaste stub
// ─────────────────────────────────────────────────────────────────────────────

const bytes = await writeProgressSheetXLSX(tasks, text);
ok('de schrijver levert bytes', bytes instanceof Uint8Array && bytes.length > 0);
{
  const head = new TextDecoder().decode(bytes.slice(0, 4));
  if (head === 'PK') {
    // Echte ZIP: de naam van de eerste entry staat in de local file header vanaf byte 30.
    const nameLen = bytes[26]! | (bytes[27]! << 8);
    eq('[Content_Types].xml is de eerste zip-entry',
      new TextDecoder().decode(bytes.slice(30, 30 + nameLen)), '[Content_Types].xml');
  } else {
    // Stub-`writeZip`: JSON-weergave van de aangeboden bestandslijst.
    const listed = JSON.parse(new TextDecoder().decode(bytes)) as { name: string; text: string }[];
    eq('alle zes parts worden aan de zip aangeboden, in volgorde',
      listed.map(f => f.name), parts.map(p => p.name));
    eq('de parts gaan als UTF-8 de zip in', listed.map(f => f.text), parts.map(p => p.xml));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Uitkomst
// ─────────────────────────────────────────────────────────────────────────────

if (diffs.length) {
  for (const d of diffs) console.log(`   XX ${d}`);
  console.log(`XX voortgangsblad-xlsx-schrijver (#27): ${diffs.length} afwijking(en) van ${checks} checks`);
  process.exit(1);
}
console.log(`OK voortgangsblad-xlsx-schrijver (#27): ${checks} checks groen`);
