// CSV-lezer/-schrijver (audit import/export, 2026-09): vier gaten waar `readCSV`/`writeCSV` anders
// deden dan de rest van de app. Alles hier loopt door de ECHTE `readCSV`/`writeCSV`.
//
//  1. (bevinding 5) "Completion (%)" = "1" werd bij Openen 100 % (de oude heuristiek "≤ 1 is een
//     fractie"), terwijl "Voortgang importeren" (`parseSheetPercent`) dezelfde cel als 1 % leest en
//     onze eigen export hele procenten schrijft. Nu: een %-markering in de kop óf de cel ⇒ dezelfde
//     parser als de voortgangsimport. Alleen een kop ZONDER % houdt de fractie-heuristiek.
//  2. (bevinding 9) CSV-import zette `priority: 0` op elke taak; alle andere routes gebruiken 500.
//  3. (bevinding 4, CSV-deel) de writer kende geen `lagMinutes` en de lezer geen uren: alle lags van
//     een uurproject (daar staan ook dag-lags in minuten) verdwenen stil. Nu één notatie:
//     `formatLagShort` schrijft, `parseLagInput` leest — bestaande dag-lag-CSV's lezen gelijk.
//  4. (bijvangst review) decimale komma: "2,5" dagen / "33,4" % werden stil 2 / 33.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { readCSV } from '@/services/csv/csvReader';
import { writeCSV } from '@/services/csv/csvWriter';
import { parseSheetPercent } from '@/services/progressImport/sheetValues';
import { formatLagShort, parseLagInput } from '@/utils/lagFormat';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { useAppStore } from '@/state/appStore';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { ImportResult } from '@/services/importTypes';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const ok = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(label);
};

/** Vangt `console.warn` af tijdens `fn` (de import meldt weggelaten/onleesbare cellen zo). */
function withWarnings<T>(fn: () => T): { out: T; warns: string[] } {
  const warns: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => { warns.push(a.join(' ')); };
  try { return { out: fn(), warns }; } finally { console.warn = orig; }
}

/** Een CSV zoals een spreadsheet hem schrijft: kop + rijen, cellen letterlijk (quotes zelf zetten). */
const csvOf = (headers: string[], rows: string[][], delimiter = ';') =>
  [headers.join(delimiter), ...rows.map(r => r.join(delimiter))].join('\r\n') + '\r\n';

const task = (id: string, wbs: string, name: string, time: Partial<Task['time']> = {}): Task => ({
  id, name, description: '', wbsCode: wbs, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: { ...createDefaultTaskTime('2026-03-02', 5), ...time },
});
const noProject = {} as Project;
const noCalendar = {} as WorkCalendar;

/** De voortgangsimport-lezing van een cel (fractie), of NaN als die de cel weigert. */
const pct = (cell: string): number => {
  const v = parseSheetPercent(cell);
  return v?.kind === 'value' ? v.value : NaN;
};

/** De vier lag-velden van een relatie, alleen de gezette (zoals de lezer ze op een Sequence zet). */
const lagOf = (s: Pick<Sequence, 'lagDays' | 'lagMinutes' | 'lagUnit' | 'lagPercent'>) => ({
  lagDays: s.lagDays,
  ...(s.lagMinutes !== undefined ? { lagMinutes: s.lagMinutes } : {}),
  ...(s.lagUnit !== undefined ? { lagUnit: s.lagUnit } : {}),
  ...(s.lagPercent !== undefined ? { lagPercent: s.lagPercent } : {}),
});
/** Relaties van een import, per "voorganger-WBS>opvolger-WBS". */
const lagsByLink = (r: ImportResult) => {
  const wbs = new Map(r.tasks.map(t => [t.id, t.wbsCode]));
  return Object.fromEntries(r.sequences.map(s => [`${wbs.get(s.predecessorId)}>${wbs.get(s.successorId)}`, lagOf(s)]));
};

// ═══════════════════════════════════════════════════════════════════════════
// 1) Completion (%) — één percentageparser (bevinding 5)
// ═══════════════════════════════════════════════════════════════════════════
{
  // 1a. Eigen export terug openen: 1 % wordt "1" in de cel en moet 1 % blijven, niet 100 %.
  const csv = writeCSV(noProject, noCalendar, [task('t1', '1', 'Net gestart', { completion: 0.01, actualStart: '2026-03-02' })], [], [], []);
  eq('1a eigen export schrijft hele procenten ("1")', csv.split('\r\n')[1].split(';')[11], '1');
  const back = readCSV(csv).tasks[0];
  eq('1a eigen export 1 % ⇒ Openen 1 % (niet 100 %)', back.time.completion, 0.01);
  eq('1a …en dus STARTED, niet COMPLETED', back.status, 'STARTED');
  eq('1a …en geen verzonnen werkelijk einde', back.time.actualFinish, undefined);

  // 1b. Kop met % ⇒ exact dezelfde lezing als "Voortgang importeren" (parseSheetPercent).
  for (const cell of ['1', '0.5', '0,5', '33,4', '33.4', '100', '1%', '50 %', '0']) {
    const r = readCSV(csvOf(['WBS', 'Name', 'Completion (%)'], [['1', 'A', cell]])).tasks[0];
    eq(`1b "Completion (%)" = "${cell}" leest als parseSheetPercent`, r.time.completion, pct(cell));
  }
  eq('1c "% complete" = "1" ⇒ 1 %', readCSV(csvOf(['WBS', 'Name', '% complete'], [['1', 'A', '1']])).tasks[0].time.completion, 0.01);

  // 1d. Kop ZONDER % (derde tools die 0..1 schrijven): heuristiek blijft — behalve als de CEL een % draagt.
  const noPct = (cell: string) => readCSV(csvOf(['WBS', 'Name', 'Completion'], [['1', 'A', cell]])).tasks[0].time.completion;
  eq('1d "Completion" = "1%" ⇒ 1 % (expliciete % in de cel)', noPct('1%'), 0.01);
  eq('1d "Completion" = "0.5" ⇒ fractie 50 % (heuristiek voor kop zonder %)', noPct('0.5'), 0.5);
  eq('1d "Completion" = "50" ⇒ 50 %', noPct('50'), 0.5);
  eq('1d "Completion" = "1" ⇒ fractie 100 % (kop zonder %: bewust ongewijzigd)', noPct('1'), 1);

  // 1e. Onleesbaar / buiten bereik in een %-kolom: geen stille gok naar 100 %, wel een melding.
  for (const cell of ['150', '838', 'abc']) {
    const { out, warns } = withWarnings(() => readCSV(csvOf(['WBS', 'Name', 'Completion (%)'], [['1', 'A', cell]])));
    eq(`1e "Completion (%)" = "${cell}" ⇒ geen voortgang (0)`, out.tasks[0].time.completion, 0);
    ok(`1e "Completion (%)" = "${cell}" ⇒ console.warn noemt de cel, kreeg [${warns.join(' | ')}]`, warns.some(w => w.includes(`"${cell}"`)));
  }
  const { warns: cleanWarns } = withWarnings(() => readCSV(csv));
  eq('1f eigen export ⇒ geen enkele warn', cleanWarns, []);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2) Prioriteit — de gedeelde default, geen 0 (bevinding 9)
// ═══════════════════════════════════════════════════════════════════════════
{
  const S = () => useAppStore.getState();
  const id = S().addTask({ name: 'Handmatig' });
  const storeDefault = S().tasks.find(t => t.id === id)?.priority;
  eq('2a addTask-default is 500 (Task.priority-documentatie)', storeDefault, 500);
  const r = readCSV(csvOf(['WBS', 'Name', 'Duration (days)'], [['1', 'A', '5'], ['2', 'B', '3']]));
  eq('2b CSV-import ⇒ elke taak dezelfde prioriteit als addTask', r.tasks.map(t => t.priority), [storeDefault, storeDefault]);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3) Lags — één notatie: formatLagShort schrijft, parseLagInput leest (bevinding 4, CSV-deel)
// ═══════════════════════════════════════════════════════════════════════════
{
  const tasks = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(w => task(`t${w}`, w, `T${w}`));
  const link = (p: string, s: string, type: Sequence['type'], lag: Partial<Sequence>): Sequence =>
    ({ id: `s${p}${s}`, predecessorId: `t${p}`, successorId: `t${s}`, type, lagDays: 0, ...lag });
  const seqs: Sequence[] = [
    link('1', '2', 'FINISH_START', { lagMinutes: 120 }),                           // "+2u" werkuren
    link('2', '3', 'FINISH_START', { lagMinutes: 180, lagUnit: 'ELAPSEDTIME' }),   // "+3eu" elapsed uren
    link('3', '4', 'FINISH_START', { lagMinutes: 960 }),                           // uurproject: MSP-"2d" = 960 min
    link('4', '5', 'START_START', { lagMinutes: -90 }),                            // lead in uren
    link('5', '6', 'FINISH_START', { lagDays: 3 }),                                // dag-lag (ongewijzigd)
    link('6', '7', 'START_START', { lagDays: -1 }),
    link('7', '8', 'FINISH_FINISH', { lagDays: 3, lagUnit: 'ELAPSEDTIME' }),
    link('8', '9', 'FINISH_START', { lagPercent: -25, lagUnit: 'ELAPSEDTIME' }),
  ];
  const csv = writeCSV(noProject, noCalendar, tasks, seqs, [], []);
  const predCol = csv.split('\r\n').slice(1, 10).map(r => r.split(';')[7]);
  eq('3a Predecessors-kolom in de korte lag-notatie van de app',
    predCol, ['', '1FS+2u', '2FS+3eu', '3FS+16u', '4SS-1.5u', '5FS+3d', '6SS-1d', '7FF+3ed', '8FS-25e%']);
  const back = lagsByLink(readCSV(csv));
  for (const s of seqs) {
    const key = `${s.predecessorId.slice(1)}>${s.successorId.slice(1)}`;
    eq(`3b round-trip ${key} ("${formatLagShort(s)}")`, back[key], lagOf(s));
    // Eén notatie: wat de CSV teruggeeft is letterlijk wat de lag-parser van de app van die tekst maakt.
    eq(`3c ${key} = parseLagInput(formatLagShort(seq))`, back[key], lagOf(parseLagInput(formatLagShort(s))!));
  }

  // 3d. Bestaande CSV's (met de hand of uit een oudere versie) lezen gelijk; "h"/"eh" als invoer-alias.
  const legacy = readCSV(csvOf(['WBS', 'Name', 'Predecessors'], [
    ['1', 'A', ''], ['2', 'B', '1FS+3d'], ['3', 'C', '2SS-1d'], ['4', 'D', '3FF+3ed'],
    ['5', 'E', '4SS+50%'], ['6', 'F', '5FS-25e%'], ['7', 'G', '6'], ['8', 'H', '7FS+2'],
    ['9', 'I', '8FS+2h'], ['10', 'J', '9FS+1.5eh'], ['11', 'K', '"1FS+2d, 2SS"'],
  ]));
  eq('3d bestaande dag/procent-notatie + h-alias', lagsByLink(legacy), {
    '1>2': { lagDays: 3 },
    '2>3': { lagDays: -1 },
    '3>4': { lagDays: 3, lagUnit: 'ELAPSEDTIME' },
    '4>5': { lagDays: 0, lagPercent: 50 },
    '5>6': { lagDays: 0, lagUnit: 'ELAPSEDTIME', lagPercent: -25 },
    '6>7': { lagDays: 0 },
    '7>8': { lagDays: 2 },
    '8>9': { lagDays: 0, lagMinutes: 120 },
    '9>10': { lagDays: 0, lagMinutes: 90, lagUnit: 'ELAPSEDTIME' },
    '1>11': { lagDays: 2 },
    '2>11': { lagDays: 0 },
  });
  eq('3d relatietypen blijven gelijk', legacy.sequences.map(s => s.type),
    ['FINISH_START', 'START_START', 'FINISH_FINISH', 'START_START', 'FINISH_START', 'FINISH_START',
      'FINISH_START', 'FINISH_START', 'FINISH_START', 'FINISH_START', 'START_START']);

  // 3e. Doorgerekend zoals Bestand → Openen (applyLoadedProject met de opts van openFile): een CSV
  //     draagt geen kalender, dus het project draait op de standaard-dagkalender (8 u/dag). Een lag van
  //     16 u is daar 2 werkdagen — precies wat "+2d" geeft. Voorheen was hij na de export weg.
  const S = () => useAppStore.getState();
  const openCsv = (lag: string) => {
    S().applyLoadedProject(readCSV(csvOf(['WBS', 'Name', 'Duration (days)', 'Start', 'Predecessors'], [
      ['1', 'A', '5', '2026-03-02', ''], ['2', 'B', '5', '2026-03-02', `1FS${lag}`],
    ])), { filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: true });
    return S().tasks.find(t => t.wbsCode === '2')?.time.earlyStart;
  };
  eq('3e Openen: zonder lag start B na A (ma 9 mrt)', openCsv(''), '2026-03-09');
  eq('3e Openen: "1FS+16u" ⇒ B start als bij "1FS+2d"', openCsv('+16u'), openCsv('+2d'));
  eq('3e …en dat is woensdag 11 mrt', openCsv('+16u'), '2026-03-11');
}

// ═══════════════════════════════════════════════════════════════════════════
// 4) Decimale komma — lezen waar hij eenduidig is (bijvangst review)
// ═══════════════════════════════════════════════════════════════════════════
{
  const H = ['WBS', 'Name', 'Duration (days)', 'Completion (%)', 'Total Float'];
  // 4a. ";"-bestand (NL/DE/FR-spreadsheet): de komma is het decimaalteken.
  const nl = readCSV(csvOf(H, [['1', 'A', '2,5', '33,4', '1,5'], ['2', 'B', '2,5 dagen', '0', '0']])).tasks;
  eq('4a ";": Duration "2,5" ⇒ 2.5 (niet afgekapt, niet afgerond)', nl[0].time.scheduleDuration, 2.5);
  eq('4a ";": Completion (%) "33,4" ⇒ 33,4 % (zoals parseSheetPercent)', nl[0].time.completion, pct('33,4'));
  eq('4a ";": Total Float "1,5" ⇒ 1.5', nl[0].time.totalFloat, 1.5);
  eq('4a ";": "2,5 dagen" ⇒ 2.5 (eenheidstekst achter het getal blijft toegestaan)', nl[1].time.scheduleDuration, 2.5);

  // 4b. Onze eigen export schrijft een decimale PUNT met ";" — die blijft gewoon werken.
  const own = writeCSV(noProject, noCalendar, [task('t1', '1', 'Half', { scheduleDuration: 2.5 })], [], [], []);
  eq('4b eigen export "2.5" ⇒ 2.5', readCSV(own).tasks[0].time.scheduleDuration, 2.5);
  eq('4b "5 days" ⇒ 5 (oud parseFloat-gedrag)', readCSV(csvOf(H, [['1', 'A', '5 days', '0', '0']])).tasks[0].time.scheduleDuration, 5);

  // 4c. ","-bestand: een komma kan alleen in een GEQUOTE cel staan; "2,5" is daar ook een decimaal.
  const us = readCSV(csvOf(H, [['1', 'A', '"2,5"', '"33,4"', '"0,125"']], ',')).tasks[0];
  eq('4c ",": gequote "2,5" ⇒ 2.5', us.time.scheduleDuration, 2.5);
  eq('4c ",": gequote "33,4" % ⇒ 33,4 %', us.time.completion, pct('33,4'));
  eq('4c ",": gequote "0,125" ⇒ 0.125 (voorloopnul: nooit een duizendtal)', us.time.totalFloat, 0.125);

  // 4d. ","-bestand, "1,250": Engels duizendtal (1250) óf decimaal (1.25) — factor 1000, niet gokken.
  const { out: amb, warns } = withWarnings(() => readCSV(csvOf(H, [['1', 'A', '"1,250"', '0', '0']], ',')));
  eq('4d ",": dubbelzinnig "1,250" ⇒ gewone onleesbaar-terugval (5 d), geen 1 of 1.25', amb.tasks[0].time.scheduleDuration, 5);
  ok(`4d …met een console.warn die de cel noemt, kreeg [${warns.join(' | ')}]`, warns.some(w => w.includes('"1,250"')));
  const { out: ambNl } = withWarnings(() => readCSV(csvOf(H, [['1', 'A', '1,250', '0', '0']])));
  eq('4d ";": "1,250" is wél eenduidig (duizendtal is daar "." of spatie) ⇒ 1.25', ambNl.tasks[0].time.scheduleDuration, 1.25);

  // 4e. Kop zonder %, fractie met komma.
  eq('4e ";": "Completion" = "0,5" ⇒ fractie 50 %', readCSV(csvOf(['WBS', 'Name', 'Completion'], [['1', 'A', '0,5']])).tasks[0].time.completion, 0.5);
}

// 5. (audit 2026-09-26) Meerregelige cel, taaktype-naam met scheidingsteken, decimale komma in de
//    vastgelegde speling — alle drie via de ECHTE writer ⇒ reader.
{
  const multi = task('t1', '1', 'Fundering');
  multi.description = 'Regel 1\nRegel 2; met "quote"';
  const csv = writeCSV(noProject, noCalendar, [multi, task('t2', '2', 'Kelder')], [], [], []);
  const back = readCSV(csv);
  eq('5a meerregelige omschrijving ⇒ nog steeds 2 taken', back.tasks.length, 2);
  eq('5a omschrijving komt heel terug', back.tasks[0]?.description, 'Regel 1\nRegel 2; met "quote"');
  eq('5a de volgende rij blijft intact', back.tasks[1]?.name, 'Kelder');

  const typed = task('t1', '1', 'Prefab');
  typed.customTaskTypeId = 'ct-1';
  typed.description = 'omschrijving';
  const typedCsv = writeCSV(noProject, noCalendar, [typed], [], [], [], [{ id: 'ct-1', name: 'Beton; prefab' } as never]);
  const { out: typedBack } = withWarnings(() => readCSV(typedCsv));
  eq('5b taaktype-naam met ";" schuift de kolommen niet: type-id', typedBack.tasks[0]?.customTaskTypeId, 'ct-1');
  eq('5b …en de omschrijving blijft op haar plek', typedBack.tasks[0]?.description, 'omschrijving');

  const stray = readCSV(csvOf(['WBS', 'Name', 'Duration'], [['1', 'Pijp 5"', '3'], ['2', 'Bocht', '4']]));
  eq('5c losse inch-quote midden in een ongequote cel slokt de volgende rij niet op', stray.tasks.map(t => t.name), ['Pijp 5"', 'Bocht']);

  const lf = readCSV('WBS;Name;Description\n1;A;"x\r\ny"\n2;B;z\n');
  eq('5d LF-bestand met CRLF binnen een quote-cel', lf.tasks.map(t => [t.name, t.description]), [['A', 'x\r\ny'], ['B', 'z']]);

  const fl = readCSV(csvOf(['WBS', 'Name', 'Start', 'Finish', 'Total Float'], [['1', 'A', '2026-03-02', '2026-03-06', '2,5']]));
  const flId = fl.tasks[0]?.id ?? '';
  eq('5e vastgelegde speling "2,5" ⇒ 2.5 (niet 2)', fl.recordedTimes?.[flId]?.totalFloat, 2.5);
}

if (diffs.length === 0) {
  console.log(`OK  csv-import-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  csv-import-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
