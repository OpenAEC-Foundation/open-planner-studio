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
// De structurele asserties draaien op `buildProgressXlsxParts` en hebben de ZIP niet nodig. De
// zip-SAMENSTELLING wordt daarnaast getoetst op de echte bytes van `writeProgressSheetXLSX`: sinds
// T14 gaan die door de ECHTE `parseZipEntries` uit `@/services/zip` heen, dus dit is een volwaardige
// schrijver→lezer-round-trip en geen headerinspectie meer. De eerdere stub-/`--alias`-constructie
// (nodig zolang baan A's `writeZip` nog niet bestond) is daarmee vervallen.
//
// Draait via run.sh (registratie: T14). Exit 0 = alles groen; de suite print "alles groen" ook bij
// exit 1 wanneer het bundelen faalt — de exitcode is het enige geldige oordeel.

import {
  buildProgressXlsxParts,
  writeProgressSheetXLSX,
  type ProgressXlsxText,
} from '@/services/xlsx/writeProgressXlsx';
import { parseZipEntries } from '@/services/zip';
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

function parseValidation(block: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const a of block.slice(0, block.indexOf('>')).matchAll(/([a-zA-Z0-9]+)="([^"]*)"/g)) {
    attrs[a[1]!] = a[2]!;
  }
  attrs.f1 = /<formula1>([^<]*)<\/formula1>/.exec(block)?.[1] ?? '';
  attrs.f2 = /<formula2>([^<]*)<\/formula2>/.exec(block)?.[1] ?? '';
  return attrs;
}

/** Alle `dataValidation`-blokken, in bladvolgorde. */
function validations(sheet: string): Record<string, string>[] {
  return [...sheet.matchAll(/<dataValidation [\s\S]*?<\/dataValidation>/g)].map(m => parseValidation(m[0]));
}

/**
 * De validatie die over kolom `letter` gaat. Sinds de eindreview (bevinding 3) is er per
 * INVULKOLOM één blok — alleen zo kan elke kolom zijn eigen invulhint dragen — dus zoeken op
 * `type` alleen zou de twee datumkolommen niet uit elkaar houden.
 */
function validationOf(sheet: string, letter: 'F' | 'G' | 'H'): Record<string, string> {
  return validations(sheet).find(v => (v.sqref ?? '').startsWith(letter)) ?? {};
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
// Punt a van de eindreview: de vergrendeling van de alleen-lezen stijlen en van de
// verzamelrij-markering staat er UITGESCHREVEN, niet alleen geërfd via `cellStyleXfs[0]`. Vijf
// stijlen: kop, alleen-lezen tekst/datum/datumtijd en de verzamelrij-markering.
eq('vijf expliciet vergrendelde stijlen',
  cellXfEntries(st).filter(xf => xf.includes('<protection locked="1"/>')).length, 5);
ok('elke stijl met een protection-kind zegt dat ook in applyProtection',
  cellXfEntries(st).every(xf => xf.includes('<protection ') === xf.includes('applyProtection="1"')));
ok('de verzamelrij-stijl is expliciet vergrendeld',
  (cellXfEntries(st)[lockedSummaryStyle(st)] ?? '').includes('applyProtection="1"')
  && (cellXfEntries(st)[lockedSummaryStyle(st)] ?? '').includes('<protection locked="1"/>'));
eq('percentagevalidatie 0..100', (({ f1, f2, allowBlank }) => ({ f1, f2, allowBlank }))(validationOf(ws, 'F')),
  { f1: '0', f2: '100', allowBlank: '1' });
eq('de percentagekolom is een decimal-validatie', validationOf(ws, 'F').type, 'decimal');
eq('beide datumkolommen zijn type date',
  [validationOf(ws, 'G').type, validationOf(ws, 'H').type], ['date', 'date']);
// Bevinding 3 van de eindreview: één blok per INVULKOLOM. Een gedeeld `G2:H…`-blok kan maar één
// `prompt` dragen, en dat was die van *Actual Start* — de tooltip op *Actual Finish* zei dus
// "startdatum".
eq('drie validatieblokken, één per invulkolom', declaredCount(ws, 'dataValidations'), 3);
eq('…en er staan er ook echt drie', validations(ws).length, 3);
// Punt b: rij 2 is de verzameltaak; die drie invulcellen dragen een tekstmededeling, geen getal of
// datum, dus geen enkele validatie hoort erover te lopen.
eq('percentagevalidatie slaat de verzamelrij over', validationOf(ws, 'F').sqref, 'F3:F4');
eq('de werkelijke-startkolom slaat de verzamelrij over', validationOf(ws, 'G').sqref, 'G3:G4');
eq('de werkelijke-eindkolom slaat de verzamelrij over', validationOf(ws, 'H').sqref, 'H3:H4');
ok('geen enkele sqref raakt rij 2', validations(ws).every(v => !/[FGH]2\b/.test(v.sqref ?? '')));
ok('sqref is begrensd tot de laatste rij', !ws.includes('1048576'));
ok('een lege cel mag nooit een foutmelding geven',
  validations(ws).every(v => v.allowBlank === '1'));
eq('de foutmelding is een stop', validationOf(ws, 'F').errorStyle, 'stop');
ok('de invulhint hergebruikt de kopinstructie',
  validationOf(ws, 'F').prompt === 'vul hier het percentage in (0-100)');
eq('de werkelijke-startkolom heeft de starthint',
  validationOf(ws, 'G').prompt, 'vul hier de werkelijke startdatum in');
eq('de werkelijke-eindkolom heeft zijn EIGEN hint, niet die van de startkolom',
  validationOf(ws, 'H').prompt, 'vul hier de werkelijke einddatum in');
ok('de twee datumkolommen delen wél dezelfde regel en foutmelding',
  validationOf(ws, 'G').error === validationOf(ws, 'H').error
  && validationOf(ws, 'G').f1 === validationOf(ws, 'H').f1
  && validationOf(ws, 'G').f2 === validationOf(ws, 'H').f2);
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
  ok('de validatie blijft staan zonder teksten', bws.includes('<dataValidations count="3">'));
  ok('geen leeg errorTitle-attribuut', !bws.includes('errorTitle=""'));
  ok('geen leeg prompt-attribuut', !bws.includes('prompt=""'));
  // Zonder `summaryNote` is er geen enkele markering, dus ook niets om over te slaan: de bereiken
  // beginnen weer op rij 2. Dat pint dat de uitzondering aan de MARKERING hangt en niet aan
  // "heeft kinderen".
  eq('zonder markering dekt de validatie ook de verzamelrij', validationOf(bws, 'G').sqref, 'G2:G4');
}
{
  // Een leeg project: `F2:F1` zou een ongeldig bereik zijn, dus de ondergrens is rij 2. Eén rij
  // levert een kale celverwijzing op — precies wat Excel zelf schrijft.
  const empty = buildProgressXlsxParts([], text);
  const ews = empty.find(p => p.name === 'xl/worksheets/sheet1.xml')?.xml ?? '';
  eq('leeg project houdt een geldig validatiebereik', validationOf(ews, 'F').sqref, 'F2');
  ok('leeg project schrijft nooit een omgekeerd bereik', !ews.includes(':F1"') && !ews.includes(':F1 '));
  ok('leeg project heeft alleen de kopregel', !ews.includes('<row r="2"'));
}
{
  // Alléén verzameltaken: er blijft geen invulbare rij over. Een `dataValidation` zonder bereik is
  // ongeldige XML, dus het hele element hoort dan weg te blijven — niet als lege huls te blijven
  // staan.
  const allSummary = buildProgressXlsxParts(
    [tasks[0]!, { ...tasks[1]!, childIds: ['x'] }, { ...tasks[2]!, childIds: ['y'] }],
    text,
  );
  const aws = allSummary.find(p => p.name === 'xl/worksheets/sheet1.xml')?.xml ?? '';
  ok('een blad zonder invulbare rij krijgt géén dataValidations-element',
    !aws.includes('<dataValidations'));
  ok('…maar wel gewoon zijn rijen en bladbeveiliging',
    aws.includes('<row r="4"') && aws.includes('<sheetProtection sheet="1"'));
  ok('geen lege sqref in het bestand', !aws.includes('sqref=""'));
}

// ─────────────────────────────────────────────────────────────────────────────
// zip-samenstelling — de echte schrijver door de echte lezer (T14)
// ─────────────────────────────────────────────────────────────────────────────

const bytes = await writeProgressSheetXLSX(tasks, text);
ok('de schrijver levert bytes', bytes instanceof Uint8Array && bytes.length > 0);
{
  eq('het bestand begint met de ZIP-magic',
    Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);

  // De naam van de eerste entry staat in de local file header vanaf byte 30. OOXML-consumers
  // verwachten `[Content_Types].xml` als eerste — geen spec-eis, wel wat elke echte schrijver
  // doet, en sommige strikte lezers leunen erop.
  const nameLen = bytes[26]! | (bytes[27]! << 8);
  eq('[Content_Types].xml is de eerste zip-entry',
    new TextDecoder().decode(bytes.slice(30, 30 + nameLen)), '[Content_Types].xml');

  // …en dan de round-trip: uitpakken met de PRODUCTIE-lezer en de parts terugvergelijken met wat
  // `buildProgressXlsxParts` opleverde. Dat toetst in één keer de CRC's, de maten, de central
  // directory én dat er onderweg niets stilzwijgend van vorm verandert.
  const entries = await parseZipEntries(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  eq('alle zes parts komen er in dezelfde volgorde weer uit',
    entries.map(e => e.name), parts.map(p => p.name));
  const decoder = new TextDecoder();
  eq('de parts komen byte-identiek terug',
    entries.map(e => decoder.decode(e.data)), parts.map(p => p.xml));
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
