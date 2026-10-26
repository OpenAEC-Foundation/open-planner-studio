// Aanval a11 na #600: een werkelijk eindmoment om middernacht moet een voortgangsblad heel
// overleven, in `.xlsx` én in CSV.
//
// Het gat: op een kalender van 00:00–24:00 eindigt een taak van 1 d die op 1 juni begint om
// `2026-06-02T00:00`. Dat is een MOMENT (exclusief einde). De XLSX-schrijver zag alleen dat het
// seriële getal geheel was (`46175`) en gaf de cel een datumopmaak zonder tijd. De lezer maakte er
// de kale datum `2026-06-02` van, en de voortgangsimport leest een kale einddatum als "einde van die
// werkdag": `2026-06-03T00:00`. Eén dag te laat, zonder melding.
//
// De keten hier is de ECHTE: store → `writeProgressSheetXLSX`/`writeProgressSheetCSV` → lezer →
// `finalizeProgressRows` → `previewProgressImport`/`applyProgressImport` op de EERDERE, voortgangsloze
// stand van dezelfde taak. Tegen de al voltooide bron zou de no-op-filter het verlies maskeren.
//
// Drie gevallen per formaat:
//   1. einde om 00:00 (24-uurskalender)    → exact hetzelfde moment terug;
//   2. einde om 16:00 (standaardkalender)  → exact hetzelfde moment terug;
//   3. een kale datum in het blad          → blijft "einde van die werkdag" (ongewijzigd gedrag).
//   4. de celopmaak bepaalt of een geheel getal een moment is (review r1 van #659): alleen een opmaak
//      waarvan de GELDENDE sectie een datum én een kloktijd toont. Ingebouwd 34/35 (per landinstelling
//      datum of tijd), een tweede sectie met tijd, een voorwaardelijke sectie, opvulling `_h`, tekst
//      tussen aanhalingstekens en een opmaak met alleen een tijd blijven een kale datum. Ook met
//      bestanden die LibreOffice opnieuw heeft opgeslagen (`fixtures/xlsx-libreoffice/`).
//
// Exit 0 = alles groen. De exitcode is het enige geldige oordeel.

import { useAppStore } from '@/state/appStore';
import { writeProgressSheetXLSX, buildProgressXlsxParts } from '@/services/xlsx/writeProgressXlsx';
import { parseProgressXlsx } from '@/services/progressImport/parseProgressXlsx';
import { parseProgressCsv } from '@/services/progressImport/parseProgressCsv';
import { finalizeProgressRows } from '@/services/progressImport/sheetValues';
import { writeProgressSheetCSV } from '@/services/csv/csvWriter';
import { readXlsxSheet } from '@/services/xlsx/readXlsxSheet';
import { writeZip } from '@/services/zip';
import type { ProgressRow, ProgressSheet } from '@/services/progressImport/types';
import type { Task } from '@/types/task';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const S = () => useAppStore.getState();

/** Eén taak van 1 d op 1 juni 2026, OPS-profiel; met `hour24` op een kalender van 00:00–24:00. */
function voltooideTaak(hour24: boolean): Task {
  S().newProject();
  S().setProject({ name: 'middernacht', startDate: '2026-06-01', schedulingProfile: { baseId: 'ops', id: 'ops', name: '', overrides: {} } });
  if (hour24) {
    S().setCalendar({ ...S().calendar, workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0, workEndHour: 24, hoursPerDay: 24 });
  }
  const id = S().addTask({ name: 'Volle dag' });
  const t = S().tasks.find(task => task.id === id)!;
  S().updateTask(id, { time: { ...t.time, durationUnit: 'days', scheduleDuration: 1 } });
  S().runCPM();
  S().setActualStart(id, '2026-06-01');
  S().setActualFinish(id, '2026-06-01');
  S().runCPM();
  return structuredClone(S().tasks.find(task => task.id === id)!);
}

/** Dezelfde taak vóór de voortgang: geen werkelijke datums, 0 %. */
function zonderVoortgang(task: Task): Task {
  return {
    ...task,
    status: 'NOT_STARTED',
    time: { ...task.time, completion: 0, actualStart: undefined, actualFinish: undefined },
  };
}

/** Past de rijen toe op de voortgangsloze stand en geeft preview, toepassing en het resultaat. */
function pasToe(bron: Task, rows: readonly ProgressRow[]) {
  useAppStore.setState({ tasks: [zonderVoortgang(bron)] });
  const preview = S().previewProgressImport(rows);
  const applied = S().applyProgressImport(rows);
  const after = S().tasks.find(task => task.id === bron.id)!;
  return {
    preview: [preview.appliedCount, preview.refusedCount],
    applied: [applied.appliedCount, applied.refusedCount],
    actualStart: after.time.actualStart,
    actualFinish: after.time.actualFinish,
  };
}

async function viaXlsx(task: Task): Promise<readonly ProgressRow[]> {
  const sheet: ProgressSheet = await parseProgressXlsx(await writeProgressSheetXLSX([task]));
  eq(`${task.time.actualFinish}: xlsx zonder bestandsprobleem`, sheet.fileIssue, undefined);
  return finalizeProgressRows(sheet, 'dmy');
}

function viaCsv(task: Task): readonly ProgressRow[] {
  const sheet = parseProgressCsv(writeProgressSheetCSV([task]));
  eq(`${task.time.actualFinish}: csv zonder bestandsprobleem`, sheet.fileIssue, undefined);
  return finalizeProgressRows(sheet, 'dmy');
}

// ── 1. Einde om middernacht (24-uurskalender) ──────────────────────────────────────────────
{
  const bron = voltooideTaak(true);
  eq('24u: de store bewaart het begin als moment', bron.time.actualStart, '2026-06-01T00:00');
  eq('24u: de store bewaart het einde als moment', bron.time.actualFinish, '2026-06-02T00:00');

  // De cel moet als datumTIJD opgemaakt zijn, ook bij een geheel serieel getal.
  const xml = buildProgressXlsxParts([bron]).find(p => p.name === 'xl/worksheets/sheet1.xml')!.xml;
  const finishCell = /<c r="H2" s="(\d+)"><v>([^<]*)<\/v><\/c>/.exec(xml);
  eq('24u: werkelijk einde staat als serieel getal 46175', finishCell?.[2], '46175');
  eq('24u: …met de invul-datumtijdstijl (8)', finishCell?.[1], '8');

  for (const [vorm, rows] of [['xlsx', await viaXlsx(bron)], ['csv', viaCsv(bron)]] as const) {
    eq(`24u ${vorm}: de lezer houdt T00:00`, rows[0]?.actualFinish, { kind: 'value', iso: '2026-06-02T00:00' });
    eq(`24u ${vorm}: toepassen op de stand zonder voortgang`, pasToe(bron, rows), {
      preview: [1, 0], applied: [1, 0], actualStart: '2026-06-01T00:00', actualFinish: '2026-06-02T00:00',
    });
  }
}

// ── 2. Einde om 16:00 (standaardkalender) ──────────────────────────────────────────────────
{
  const bron = voltooideTaak(false);
  eq('16u: de store bewaart het einde als moment', bron.time.actualFinish, '2026-06-01T16:00');
  for (const [vorm, rows] of [['xlsx', await viaXlsx(bron)], ['csv', viaCsv(bron)]] as const) {
    eq(`16u ${vorm}: toepassen op de stand zonder voortgang`, pasToe(bron, rows), {
      preview: [1, 0], applied: [1, 0], actualStart: bron.time.actualStart, actualFinish: '2026-06-01T16:00',
    });
  }
}

// ── 3. Een kale datum in het blad blijft "einde van die werkdag" ─────────────────────────
{
  const bron = voltooideTaak(false);
  // Een blad waarin de invuller zelf een DATUM typt (stijl 7 = invul-datum, `yyyy-mm-dd`): het
  // seriële getal van 1 juni 2026, zonder tijd.
  const parts = buildProgressXlsxParts([zonderVoortgang(bron)]).map(part => {
    if (part.name !== 'xl/worksheets/sheet1.xml') return part;
    return { ...part, xml: part.xml.replace('</row></sheetData>', '<c r="H2" s="7"><v>46174</v></c></row></sheetData>') };
  });
  const encoder = new TextEncoder();
  const bytes = await writeZip(parts.map(part => ({ name: part.name, data: encoder.encode(part.xml) })));
  const raw = await readXlsxSheet(bytes);
  eq('datum: de cel heeft geen klok', raw.rows[1]?.cells.find(c => c.col === 7)?.hasTime, undefined);
  const rows = finalizeProgressRows(await parseProgressXlsx(bytes), 'dmy');
  eq('datum: de lezer geeft een kale datum', rows[0]?.actualFinish, { kind: 'value', iso: '2026-06-01' });
  eq('datum: toepassen leest het als einde van de werkdag', pasToe(bron, rows).actualFinish, '2026-06-01T16:00');

  // En in CSV: een kale datum in de kolom Actual Finish.
  const csv = writeProgressSheetCSV([zonderVoortgang(bron)]).replace(/\r?\n$/, '');
  const lines = csv.split(/\r?\n/);
  // De laatste kolom (Actual Finish) is leeg in een blad zonder voortgang: daar komt de datum.
  lines[1] = `${lines[1]}2026-06-01`;
  const csvRows = finalizeProgressRows(parseProgressCsv(lines.join('\n')), 'dmy');
  eq('datum csv: de lezer geeft een kale datum', csvRows[0]?.actualFinish, { kind: 'value', iso: '2026-06-01' });
  eq('datum csv: toepassen leest het als einde van de werkdag', pasToe(bron, csvRows).actualFinish, '2026-06-01T16:00');
}

// ── 4. De opmaak van de cel: alleen een datum mét kloktijd maakt een moment ────────────────
{
  /** Een blad zonder voortgang, met in H2 het getal `value` in een opmaak naar keuze. */
  async function bladMetOpmaak(bron: Task, value: number, fmt: { id: number } | { code: string }): Promise<Uint8Array> {
    const parts = buildProgressXlsxParts([zonderVoortgang(bron)]).map(part => {
      if (part.name === 'xl/styles.xml') {
        // Stijl 7 (invul-datum) gebruikt numFmt 164: die krijgt de testopmaak.
        const xml = 'id' in fmt
          ? part.xml.replace(/<xf numFmtId="164"/g, `<xf numFmtId="${fmt.id}"`)
          : part.xml.replace('formatCode="yyyy-mm-dd"', `formatCode="${fmt.code.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"`);
        return { ...part, xml };
      }
      if (part.name === 'xl/worksheets/sheet1.xml') {
        return { ...part, xml: part.xml.replace('</row></sheetData>', `<c r="H2" s="7"><v>${value}</v></c></row></sheetData>`) };
      }
      return part;
    });
    const encoder = new TextEncoder();
    return writeZip(parts.map(part => ({ name: part.name, data: encoder.encode(part.xml) })));
  }

  // Datum zonder moment: 1 juni (46174) op de standaardkalender wordt einde van de werkdag, 16:00.
  const dag = voltooideTaak(false);
  const datumOpmaken: readonly [string, { id: number } | { code: string }][] = [
    ['ingebouwd 34', { id: 34 }],
    ['ingebouwd 35', { id: 35 }],
    ['ingebouwd 32 (alleen tijd)', { id: 32 }],
    ['ingebouwd 18 (alleen tijd)', { id: 18 }],
    ['tweede sectie met tijd', { code: 'yyyy-mm-dd;yyyy-mm-dd hh:mm' }],
    ['voorwaardelijke sectie', { code: '[>50000]yyyy-mm-dd hh:mm;yyyy-mm-dd' }],
    ['opvulling _h', { code: 'yyyy-mm-dd_h' }],
    ['herhaling *s', { code: 'yyyy-mm-dd*s' }],
    ['tekst tussen aanhalingstekens', { code: 'yyyy-mm-dd" uur"' }],
    ['escape \\h', { code: 'yyyy-mm-dd\\h' }],
    ['alleen een tijd', { code: 'h:mm:ss' }],
  ];
  for (const [label, fmt] of datumOpmaken) {
    const rows = finalizeProgressRows(await parseProgressXlsx(await bladMetOpmaak(dag, 46174, fmt)), 'dmy');
    eq(`opmaak ${label}: de lezer geeft een kale datum`, rows[0]?.actualFinish, { kind: 'value', iso: '2026-06-01' });
    const uit = pasToe(dag, rows);
    eq(`opmaak ${label}: toepassen geeft 16:00`, [uit.preview, uit.applied, uit.actualFinish], [[1, 0], [1, 0], '2026-06-01T16:00']);
  }

  // Bestanden die LibreOffice opende en opnieuw als XLSX opsloeg (review r1 van #659). Het taak-id in
  // die bladen komt uit een andere sessie; de rij wordt aan de fixturetaak gekoppeld. LibreOffice
  // schrijft ingebouwd 34 terug als eigen opmaak `h:mm:ss`: alleen een tijd, dus ook een kale datum.
  const lo = (naam: string) => new Uint8Array(readFileSync(join(ROOT, 'tests', 'planning', 'fixtures', 'xlsx-libreoffice', `${naam}.xlsx`)));
  for (const naam of ['builtin-34', 'custom-sections', 'custom-padding']) {
    const rows = finalizeProgressRows(await parseProgressXlsx(lo(naam)), 'dmy').map(r => ({ ...r, taskId: dag.id }));
    eq(`LibreOffice ${naam}: toepassen geeft 16:00`, pasToe(dag, rows).actualFinish, '2026-06-01T16:00');
  }

  // Wel een moment: 2 juni 00:00 (46175) op de 24-uurskalender blijft 2 juni 00:00.
  const nacht = voltooideTaak(true);
  const momentOpmaken: readonly [string, { id: number } | { code: string }][] = [
    ['ingebouwd 22', { id: 22 }],
    ['datum en tijd', { code: 'yyyy-mm-dd hh:mm' }],
    ['taalcode en AM/PM', { code: '[$-409]yyyy-mm-dd h:mm AM/PM' }],
    ['voorwaarde die de tijdsectie kiest', { code: '[>40000]yyyy-mm-dd hh:mm;yyyy-mm-dd' }],
    ['verstreken uren', { code: 'yyyy-mm-dd [h]:mm' }],
  ];
  for (const [label, fmt] of momentOpmaken) {
    const rows = finalizeProgressRows(await parseProgressXlsx(await bladMetOpmaak(nacht, 46175, fmt)), 'dmy');
    eq(`opmaak ${label}: de lezer houdt T00:00`, rows[0]?.actualFinish, { kind: 'value', iso: '2026-06-02T00:00' });
    eq(`opmaak ${label}: toepassen houdt middernacht`, pasToe(nacht, rows).actualFinish, '2026-06-02T00:00');
  }

  {
    const rows = finalizeProgressRows(await parseProgressXlsx(lo('source-midnight')), 'dmy').map(r => ({ ...r, taskId: nacht.id }));
    eq('LibreOffice source-midnight: toepassen houdt middernacht', pasToe(nacht, rows).actualFinish, '2026-06-02T00:00');
  }
}

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`check-progress-sheet-middernacht: ${diffs.length} van ${checks} controles ROOD`);
  process.exit(1);
}
console.log(`OK  check-progress-sheet-middernacht: ${checks} controles groen`);
