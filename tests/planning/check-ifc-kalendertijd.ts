// Bron: Terra's gewone-opslagproef bij #886, periode-0730.ifc (zonder bouwmodel).
// Test de echte store-openactie en saveFile, met een geheugenhandle op de bestandsnaad.
import { readFileSync, readdirSync } from 'node:fs';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import { readIFC } from '@/services/ifc/ifcReader';
import { readIfcBytes } from '@/services/ifc/foreign/ifcBytesRoute';
import { IfcCalendarTimePrecisionError } from '@/services/ifc/ifcErrors';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { stepFileGrammar } from '@/services/ifc/stepFileGrammar';
import { effectiveWorkTimeBands, calendarForEngine } from '@/utils/effectiveWorkTime';
import { parseInstant } from '@/utils/dateUtils';
import type { WorkCalendar } from '@/types/calendar';
import { hoursPerDayForBlocks, workDaysFromBands } from '@/services/subdayIo';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';

installBrowserStubs();
installDeterminism();
const { createAppStoreContext } = await import('@/state/appStoreFactory');
const source = readFileSync(new URL('./fixtures/periode-0730.ifc', import.meta.url), 'utf8');
const period = "IFCTIMEPERIOD('07:30:00','16:00:00')";
let checks = 0;
const failures: string[] = [];
function eq(label: string, got: unknown, want: unknown) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
}
function hasSourceClocks(text: string | undefined, start: string, end: string): boolean {
  return !!text && text.includes(`IFCTIMEPERIOD('${start}',`) && text.includes(`,'${end}');`);
}
function memoryFile(initial: string) {
  let content = initial;
  const writes: string[] = [];
  const handle = {
    kind: 'file', name: 'werktijd.ifc',
    isSameEntry: async (other: unknown) => other === handle,
    queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    getFile: async () => new File([content], 'werktijd.ifc'),
    createWritable: async () => {
      let buffer = '';
      return { write: async (s: string) => { buffer = s; }, close: async () => { content = buffer; writes.push(buffer); } };
    },
  } as unknown as FileSystemFileHandle;
  return { handle, writes };
}

// Synthetische vreemde kloktekst: ongeldig als IfcTime, maar geldig gequote STEP.
// Bronbewaring mag na een gewone taakbewerking geen kapot bestand schrijven.
for (const [start, end] of [
  ["07:30:00''x", '16:00:00'],
  ['07:30:00', "16:00:00''y"],
] as const) {
  const sourcePeriod = `IFCTIMEPERIOD('${start}','${end}')`;
  const input = source.replace(period, sourcePeriod);
  const label = `gequote bronklok ${start}/${end}`;
  eq(`${label}: invoergrammatica`, stepFileGrammar(input).state, 'valid');
  const file = memoryFile(input);
  const store = createAppStoreContext().store;
  await store.getState().openOpenedFile({ name: 'bronklok.ifc', content: input, ref: { kind: 'handle', handle: file.handle } });
  eq(`${label}: openen behoudt taak`, store.getState().tasks.length, 1);
  const task = store.getState().tasks[0];
  if (!task) continue;
  store.getState().updateTask(task.id, { name: 'Taakbewerking blijft behouden' });
  await store.getState().saveFile();
  eq(`${label}: opslag schrijft eenmaal`, file.writes.length, 1);
  const saved = file.writes[0];
  if (!saved) continue;
  eq(`${label}: opgeslagen grammatica`, stepFileGrammar(saved).state, 'valid');
  eq(`${label}: standaardperiode behoudt bron`, saved.includes(sourcePeriod), true);
  eq(`${label}: reader behoudt taakbewerking`, readIFC(saved).tasks.map(t => t.name), ['Taakbewerking blijft behouden']);
  const reopened = createAppStoreContext().store;
  await reopened.getState().openOpenedFile({ name: 'heropend.ifc', content: saved, ref: null });
  eq(`${label}: store behoudt taakbewerking`, reopened.getState().tasks.map(t => t.name), ['Taakbewerking blijft behouden']);
  eq(`${label}: geen opslagfout`, store.getState().ui.notifications.some(n => n.severity === 'error'), false);
}

for (const [start, end, startHour, endHour] of [
  ['07:30:00', '16:00:00', 7.5, 16], ['07:15:00', '16:45:00', 7.25, 16.75],
  ['07:01:00', '16:59:00', 7 + 1 / 60, 16 + 59 / 60],
  ['00:00:00', '24:00:00', 0, 24], ['7.123456:00:00', '16:00:00', 7.123456, 16], ['7.5:00:00', '16.75:00:00', 7.5, 16.75],
] as const) {
  const input = source.replace(period, `IFCTIMEPERIOD('${start}','${end}')`);
  const file = memoryFile(input);
  const { store } = createAppStoreContext();
  await store.getState().openOpenedFile({ name: 'werktijd.ifc', content: input, ref: { kind: 'handle', handle: file.handle } });
  const hours = () => [store.getState().calendar.workStartHour, store.getState().calendar.workEndHour];
  eq(`${start}: geopend`, hours(), [startHour, endHour]);
  await store.getState().saveFile();
  eq(`${start}: gewone opslag schreef eenmaal`, file.writes.length, 1);
  if (!file.writes[0]) continue;
  const saved = file.writes[0];
  const back = readIFC(saved);
  eq(`${start}: opgeslagen kalender`, [back.calendar.workStartHour, back.calendar.workEndHour], [startHour, endHour]);
  // Controleer ook de standaard-IFC-periode: OPS-metadata mag een verkeerde klok niet maskeren.
  const canonicalStart = start === '7.5:00:00' ? '07:30:00' : start;
  const canonicalEnd = end === '16.75:00:00' ? '16:45:00' : end;
  eq(`${start}: standaardveld`, hasSourceClocks(saved, canonicalStart, canonicalEnd), true);
  const reopened = createAppStoreContext().store;
  await reopened.getState().openOpenedFile({ name: 'heropend.ifc', content: saved, ref: null });
  eq(`${start}: opnieuw geopend`, [reopened.getState().calendar.workStartHour, reopened.getState().calendar.workEndHour], [startHour, endHour]);
}

// Werkelijk geschreven door d783 (Terra-proef) én release v2026.8.1 (af71257f8).
// De releasewriter draaide ongewijzigd met weekbanden 450,5–960 minuten, zonder taken.
for (const fixture of ['periode-oude-minuutfractie.ifc', 'periode-oude-minuutfractie-v2026.8.1.ifc']) {
  const old = readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url), 'utf8');
  // De latere writer kon dezelfde bandenvorm voor een gematerialiseerde dagkalender
  // gebruiken. Een expliciete scalaire markering blijft beslissend.
  if (fixture === 'periode-oude-minuutfractie.ifc') {
    const scalar = old.replace("'IsHourCalendar',$,IFCBOOLEAN(.T.)", "'IsHourCalendar',$,IFCBOOLEAN(.F.)");
    eq('oude minuutfractie respecteert scalaire markering', readIFC(scalar).calendar.workTime, undefined);
  }
  eq('oude writerfixture bevat minuutfractie', old.includes("IFCTIMEPERIOD('07:30.5:00','16:00:00')"), true);
  const file = memoryFile(old);
  const { store } = createAppStoreContext();
  await store.getState().openOpenedFile({ name: 'oude-writer.ifc', content: old, ref: { kind: 'handle', handle: file.handle } });
  await store.getState().saveFile();
  eq('oude minuutfractie schrijft zonder bewerken', file.writes.length, 1);
  if (file.writes[0]) {
    eq('oude minuutfractie blijft in bron of standaardklok', file.writes[0].includes("'07:30.5:00'") || file.writes[0].includes("'07:30:30'"), true);
    eq('oude minuutfractie heropent op 450,5 minuten', readIFC(file.writes[0]).calendar.workTime?.byWeekday[1]?.[0]?.start, 450.5);
  }
}

// De oude scalaire dag had 8 netto uren binnen een te korte klokspanne: de
// bestaande minuutmigratie verlengt die bij openen, zonder plannerbewerking.
{
  const input = readFileSync(new URL('./fixtures/periode-oude-scalarfractie-v2026.8.1.ifc', import.meta.url), 'utf8');
  const file = memoryFile(input);
  const { store } = createAppStoreContext();
  await store.getState().openOpenedFile({ name: 'oude-scalar.ifc', content: input, ref: { kind: 'handle', handle: file.handle } });
  const before = [store.getState().calendar.workStartHour, store.getState().calendar.workEndHour];
  await store.getState().saveFile();
  eq('oude scalaire fractie schrijft na automatische migratie', file.writes.length, 1);
  if (file.writes[0]) {
    const back = readIFC(file.writes[0]).calendar;
    eq('omgezette oude scalar heropent exact', [back.workStartHour, back.workEndHour], before);
  }
}

// 1120: het kalenderherstel mag de ongewijzigde bronklok niet vervangen.
{
  const input = readFileSync(new URL('./fixtures/periode-oude-scalarfractie-v2026.8.1.ifc', import.meta.url), 'utf8');
  const original = "IFCTIMEPERIOD('9.123456:00:00','16:00:00')";
  const file = memoryFile(input);
  const { store } = createAppStoreContext();
  await store.getState().openOpenedFile({ name: 'bronklok-herstel.ifc', content: input, ref: { kind: 'handle', handle: file.handle } });
  const before = structuredClone(store.getState().calendar);
  eq('1120: effectieve werkdag na openen', [before.workStartHour, before.workEndHour, before.hoursPerDay], [9.123456, 17.123455999999997, 8]);
  await store.getState().saveFile();
  eq('1120: gewone opslag behoudt letterlijk de bronperiode', file.writes[0]?.includes(original), true);
  if (file.writes[0]) console.log('1120 gewone opslag', file.writes[0].split('\n').filter(l => l.includes('=IFCTIMEPERIOD(')).join(' | '));
  const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
  const { scanStep } = await import('@/services/ifc/foreign/stepScanner');
  const calendarBytes = (text: string) => {
    const bytes = new TextEncoder().encode(text), ix = scanStep(bytes), picked = new Set<number>();
    const walk = (c: number) => {
      if (c < 0 || picked.has(c)) return;
      picked.add(c);
      const slots: Record<string, number[]> = { IFCWORKCALENDAR: [6, 7], IFCWORKTIME: [3], IFCRECURRENCEPATTERN: [7], IFCPROPERTYSET: [4] };
      for (const k of slots[ix.type(c)] ?? []) for (const child of ix.refsAt(c, k)) walk(child);
    };
    for (let c = 0; c < ix.count; c++) if (ix.type(c) === 'IFCWORKCALENDAR') {
      walk(c);
      for (let r = 0; r < ix.count; r++) if (ix.type(r) === 'IFCRELDEFINESBYPROPERTIES' && ix.refsAt(r, 4).includes(c)) {
        picked.add(r); walk(ix.refAt(r, 5));
      }
    }
    return [...picked].sort((a, b) => a - b).map(c => new TextDecoder().decode(bytes.subarray(ix.entityStart(c), ix.end(c)))).join('');
  };
  const effective = (cal: WorkCalendar) => [cal.workStartHour, cal.workEndHour, cal.hoursPerDay];
  const binding = (cal: WorkCalendar) => cal.ifcTimePeriods?.find(p => p.binding === 'scalar');
  eq('1120: koppeling gebruikt exact het berekende einde', binding(before)?.scalarEnd, before.workEndHour);
  eq('1120: bronwaarden en layout blijven intact', [binding(before)?.end, binding(before)?.endText, before.ifcTimePeriods?.[0]?.layout],
    [960, '16:00:00', '[[1,2,3,4,5],null,[]]']);
  const againFile = memoryFile(file.writes[0]);
  const again = createAppStoreContext().store;
  await again.getState().openOpenedFile({ name: 'tweede-ronde.ifc', content: file.writes[0], ref: { kind: 'handle', handle: againFile.handle } });
  eq('1120: heropenen behoudt effectieve dag', effective(again.getState().calendar), effective(before));
  await again.getState().saveFile();
  eq('1120: tweede opslag dezelfde kalenderbytes', calendarBytes(againFile.writes[0]), calendarBytes(file.writes[0]));

  // De echte kalenderdialoog bewaart via commitCalendarLibrary; de werkregels lopen mee.
  const changeEnd = (end: number) => store.getState().commitCalendarLibrary(
    store.getState().calendars.map(c => c.id === before.id ? { ...c, workEndHour: end } : c), before.id);
  eq('1120: kalenderbewerking toegepast', changeEnd(18), true);
  await store.getState().saveFile();
  eq('1120: echte kalenderbewerking schrijft 18:00', hasSourceClocks(file.writes.at(-1), '9.123456:00:00', '18:00:00'), true);
  store.getState().undo();
  await store.getState().saveFile();
  eq('1120: undo kalenderbewerking herstelt oorspronkelijke klok', file.writes.at(-1)?.includes(original), true);
  store.getState().redo();
  await store.getState().saveFile();
  eq('1120: redo kalenderbewerking schrijft gekozen klok', hasSourceClocks(file.writes.at(-1), '9.123456:00:00', '18:00:00'), true);
  eq('1120: terugzetten op het oude effectieve einde toegepast', changeEnd(before.workEndHour), true);
  await store.getState().saveFile();
  eq('1120: netto ongewijzigd einde hergebruikt bronklok', file.writes.at(-1)?.includes(original), true);

  const originalId = store.getState().activeDocumentId;
  store.getState().newDocument();
  store.getState().switchDocument(originalId);
  eq('1120: documentwissel houdt kalender en koppeling', [effective(store.getState().calendar), binding(store.getState().calendar)], [effective(before), binding(before)]);

  // De bronfixture heeft geen taken. Eén dagtaak in dezelfde oude IFC maakt ook B5 en de kern toetsbaar.
  // Kale datums laten de scalaire kalender intact, zodat T1 werkelijk loopt vóór de berekening.
  const taskLines = [
    "#80010=IFCTASKTIME('Herstel Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M1D','2027-03-01','2027-03-01','2027-03-01','2027-03-01','2027-03-01','2027-03-01','P0Y0M0D','P0Y0M0D',.T.,$,$,$,$,'P0Y0M1D',$);",
    "#80011=IFCTASK('1tOTGtWTg8bYqp7BjjuF0J',#6,'Herstel',$,$,'1',$,$,$,.F.,$,#80010,.LOGISTIC.);",
    "#80012=IFCRELASSIGNSTOCONTROL('0rlQSjGhGX7H1QflElJHcc',#6,$,$,(#80011),$,#40);",
  ];
  const end = input.lastIndexOf('ENDSEC;');
  const withTask = input.slice(0, end) + taskLines.join('\n') + '\n' + input.slice(end);
  const b5File = memoryFile(withTask), b5 = createAppStoreContext().store;
  await b5.getState().openOpenedFile({ name: 'b5-bronklok.ifc', content: withTask, ref: { kind: 'handle', handle: b5File.handle } });
  eq('1120 B5: de kalender is echt hersteld', effective(b5.getState().calendar), effective(before));
  eq('1120 B5: een echte omzettingsstap', b5.getState().historyEvents.length, 1);
  for (const [action, pending] of [['open', false], ['undo', true], ['redo', false]] as const) {
    if (action === 'undo') b5.getState().undo();
    if (action === 'redo') b5.getState().redo();
    eq(`1120 B5 ${action}: omzettingsvlag`, b5.getState().minuteModelPending, pending);
    eq(`1120 B5 ${action}: koppeling blijft bij het einde`, binding(b5.getState().calendar)?.scalarEnd, b5.getState().calendar.workEndHour);
    await b5.getState().saveFile();
    eq(`1120 B5 ${action}: opslaan behoudt bronklok`, b5File.writes.at(-1)?.includes(original), true);
  }
  const { openIfc } = await import('@/core');
  const core = await openIfc(withTask);
  eq('1120 kern: openen en opslaan houdt bronklok', core.toIfc().includes(original), true);
  eq('1120 kern: dezelfde effectieve dag', effective(readIFC(core.toIfc()).calendar), effective(before));
  core.schedule();
  eq('1120 kern: F5 houdt bronklok', core.toIfc().includes(original), true);
  for (const active of [true, false]) {
    const recovered = createAppStoreContext().store;
    recovered.getState().restoreDocuments([
      { ...readIFC(withTask), id: 'herstel-1120', filePath: null, isDirty: true, datesAsRecorded: false },
      { ...readIFC(source), id: 'ander-1120', filePath: null, isDirty: false, datesAsRecorded: false },
    ], active ? 'herstel-1120' : 'ander-1120');
    if (!active) recovered.getState().switchDocument('herstel-1120');
    eq(`1120 crashherstel ${active}: effectieve dag`, effective(recovered.getState().calendar), effective(before));
    eq(`1120 crashherstel ${active}: klokherkomst volgt dezelfde code`, binding(recovered.getState().calendar)?.scalarEnd, before.workEndHour);
    eq(`1120 crashherstel ${active}: opslag behoudt bronklok`, writeIFC(buildWriteIFCInput(recovered.getState())).includes(original), true);
  }
  const { openForeign, cloneDomain, tryMerge, mergeProblems } = await import('./ifcMergeKern');
  const { readbackDifference } = await import('./ifcReadbackEquality');
  const { generatedModel } = await import('./ifcGeneratedModel');
  const { fileURLToPath } = await import('node:url');
  const bytes = generatedModel(fileURLToPath(new URL('../..', import.meta.url)), input, 0);
  const opened = await openForeign(bytes);
  const result = await tryMerge(cloneDomain(opened), opened.ifcSource!);
  eq('1120: de merge schrijft zonder bewerking', result.ok, true);
  if (result.ok) {
    eq('1120: merge houdt letterlijk de bronperiode', new TextDecoder().decode(result.bytes).includes(original), true);
    eq('1120: naad en volledige heropening gelijk', readbackDifference(result.shown, await openForeign(result.bytes)), undefined);
    eq('1120: vreemde bytes behouden', mergeProblems(bytes, result.bytes), []);
  } else console.log('1120 merge weigert', JSON.stringify(result.error.cases));
}

// Een expliciete middagpauze blijft effectief, ook als alleen de bronstart seconden krijgt.
{
  const withSeconds = source.replace(period, "IFCTIMEPERIOD('07:00:01','16:00:00')");
  const file = memoryFile(withSeconds);
  const { store } = createAppStoreContext();
  await store.getState().openOpenedFile({ name: 'pauze-seconden.ifc', content: withSeconds, ref: { kind: 'handle', handle: file.handle } });
  const expected = [{ start: 420 + 1 / 60, end: 720 }, { start: 780, end: 960 }];
  eq('seconden houden effectieve middagpauze', effectiveWorkTimeBands(store.getState().calendar)?.byWeekday[1], expected);
  const clock = new CalendarEngine(calendarForEngine(store.getState().calendar));
  eq('middagpauze telt geen werkminuten', clock.workMinutesBetween(parseInstant('2027-03-01T12:00:00'), parseInstant('2027-03-01T13:00:00')), 0);
  store.setState(s => { s.tasks[0].time.durationUnit = 'hours'; });
  await store.getState().saveFile();
  eq('pauzekalender met seconden schrijft', file.writes.length, 1);
  if (file.writes[0]) {
    eq('middagpauze blijft na heropenen', effectiveWorkTimeBands(readIFC(file.writes[0]).calendar)?.byWeekday[1], expected);
    eq('standaard-IFC: ochtend eindigt bij pauze', file.writes[0].includes("IFCTIMEPERIOD('07:00:01','12:00:00')"), true);
    eq('standaard-IFC: middag begint na pauze', file.writes[0].includes("IFCTIMEPERIOD('13:00:00','16:00:00')"), true);
    eq('standaard-IFC: geen ononderbroken dag', file.writes[0].includes("IFCTIMEPERIOD('07:00:01','16:00:00')"), false);
  }
}

// Dezelfde numerieke klok op zaterdag is geen bron voor een maandagbewerking.
{
  const input = source.replace(period, "IFCTIMEPERIOD('07:30:01Z','16:00:00Z')")
    .replace(',$,$,(#19),', ',$,$,(#19,#9003),')
    .replace('ENDSEC;\nEND-ISO', "#9001=IFCTIMEPERIOD('08:30:01+01:00','17:00:00+01:00');\n#9002=IFCRECURRENCEPATTERN(.WEEKLY.,$,(6),$,$,$,$,(#9001));\n#9003=IFCWORKTIME('Zaterdag',.PREDICTED.,$,#9002,$,$);\nENDSEC;\nEND-ISO");
  const file = memoryFile(input);
  const { store } = createAppStoreContext();
  await store.getState().openOpenedFile({ name: 'zones-per-dag.ifc', content: input, ref: { kind: 'handle', handle: file.handle } });
  store.setState(s => { s.calendar.workTime!.byWeekday[1][0].start = s.calendar.workTime!.byWeekday[6][0].start; });
  const error = console.error;
  console.error = () => {};
  try { await store.getState().saveFile(); } finally { console.error = error; }
  eq('maandag leent nooit de zaterdagzone', file.writes.length, 0);
  eq('zonebewerking blijft zichtbaar', store.getState().calendar.workTime?.byWeekday[1][0].start, 510 + 1 / 60);
}

// Positie is geen identiteit: verwijderen, invoegen en kopiëren mogen de
// bronzone van een overgebleven of gekopieerd tijdvak niet stil wegschrijven.
for (const edit of ['verwijderen', 'invoegen', 'kopiëren'] as const) {
  const input = readFileSync(new URL('./fixtures/periode-oude-minuutfractie.ifc', import.meta.url), 'utf8')
    .replace("IFCTIMEPERIOD('07:30.5:00','16:00:00')", "IFCTIMEPERIOD('07:00:00','12:00:00')")
    .replace('$,$,$,$,(#17))', '$,$,$,$,(#17,#9001))')
    .replace('ENDSEC;\nEND-ISO', "#9001=IFCTIMEPERIOD('13:00:01+01:00','16:00:00+01:00');\nENDSEC;\nEND-ISO");
  const file = memoryFile(input);
  const { store } = createAppStoreContext();
  await store.getState().openOpenedFile({ name: 'bandverschuiving.ifc', content: input, ref: { kind: 'handle', handle: file.handle } });
  const original = structuredClone(store.getState().calendar.workTime!);
  eq(`${edit}: bron heeft twee maandagbanden`, original.byWeekday[1].length, 2);
  await store.getState().saveFile();
  eq(`${edit}: bron schrijft zonder bewerken`, file.writes.length, 1);
  eq(`${edit}: onbewerkte zone behouden`, hasSourceClocks(file.writes[0], '13:00:01+01:00', '16:00:00+01:00'), true);
  const previousWrites = file.writes.length;
  store.setState(state => {
    const week = state.calendar.workTime!.byWeekday;
    if (edit === 'verwijderen') week[1] = week[1].filter((_, i) => i !== 0);
    if (edit === 'invoegen') week[1] = [{ start: 300, end: 360 }, ...week[1]];
    if (edit === 'kopiëren') {
      // Na verwijderen: dezelfde spread-kopie naar alle werkdagen als de editor.
      const src = week[1].filter((_, i) => i !== 0).map(b => ({ ...b }));
      for (const day of [1, 2, 3, 4, 5] as const) week[day] = src.map(b => ({ ...b }));
    }
  });
  const error = console.error;
  console.error = () => {};
  try { await store.getState().saveFile(); } finally { console.error = error; }
  eq(`${edit}: opslag weigert vóór writes`, file.writes.length, previousWrites);
  const writtenSource = file.writes.length === previousWrites || readIFC(file.writes.at(-1)!).calendar.ifcTimePeriods
    ?.some(p => p.binding === 'week:1:0' && p.startText === '13:00:01+01:00');
  eq(`${edit}: een eventuele write behoudt de maandagzone`, writtenSource, true);
  eq(`${edit}: bestaande opslagmelding`, store.getState().ui.notifications.some(n => n.messageKey === 'notifications.saveFailed'), true);
  const untouched = readIFC(file.writes[0]);
  eq(`${edit}: vorige opslag heropent met dezelfde banden`, untouched.calendar.workTime, original);
  // De planner kan de bewerking terugnemen en daarna gewoon opslaan.
  store.setState(state => { state.calendar.workTime = structuredClone(original); });
  await store.getState().saveFile();
  eq(`${edit}: teruggenomen bewerking schrijft weer`, file.writes.length, previousWrites + 1);
  eq(`${edit}: zone blijft na heropenen en opnieuw opslaan`, hasSourceClocks(file.writes.at(-1), '13:00:01+01:00', '16:00:00+01:00'), true);
}

// Een echte, zelfs zeer kleine wijziging mag nooit de oude bronklok terugkrijgen.
{
  const text = readFileSync(new URL('./fixtures/periode-oude-minuutfractie.ifc', import.meta.url), 'utf8').replace("'07:30.5:00'", "'07:30:00.000000001'");
  const parsed = readIFC(text);
  const band = parsed.calendar.workTime?.byWeekday[1]?.[0];
  eq('nanosecondebron heeft bewerkbare band', !!band, true);
  if (band) {
    band.start = 450.0000000000167;
    let refused = false;
    let output: string | undefined;
    try { output = writeIFC(parsed); } catch (e) { refused = e instanceof IfcCalendarTimePrecisionError; }
    eq('gewijzigde band schrijft exact of weigert getypeerd', output ? readIFC(output).calendar.workTime?.byWeekday[1][0].start : refused, output ? 450.0000000000167 : true);
    const file = memoryFile(text);
    const { store } = createAppStoreContext();
    await store.getState().openOpenedFile({ name: 'bandbewerking.ifc', content: text, ref: { kind: 'handle', handle: file.handle } });
    store.setState(s => { s.calendar.workTime!.byWeekday[1][0].start = 450.0000000000167; });
    const realError = console.error;
    console.error = () => {};
    try { await store.getState().saveFile(); } finally { console.error = realError; }
    eq('echte opslag volgt exact schrijfbare band', file.writes.length, refused ? 0 : 1);
    if (file.writes[0]) eq('echte opslag heropent op gewijzigde band', readIFC(file.writes[0]).calendar.workTime?.byWeekday[1][0].start, 450.0000000000167);
    eq('echte opslag meldt alleen een echte weigering', store.getState().ui.notifications.some(n => n.messageKey === 'notifications.saveFailed'), refused);
    eq('geweigerde opslag houdt bandbewerking vast', store.getState().calendar.workTime?.byWeekday[1][0].start, 450.0000000000167);

  }
}

// Ook een bewerkte scalaire klok houdt zijn volledige getalwaarde. De bestaande
// IFCREAL-metadata bewaart zo nodig meer precisie dan de afgeleide uurwaarde.
{
  const parsed = readIFC(source.replace(period, "IFCTIMEPERIOD('07:30:00.000000001','16:00:00')"));
  parsed.calendar.workStartHour += Number.EPSILON * 8;
  const value = parsed.calendar.workStartHour;
  const saved = writeIFC(parsed);
  eq('bewerkte scalaire klok komt exact terug', readIFC(saved).calendar.workStartHour, value);
}

// De andere kalenderlussen moeten dezelfde kloklezing gebruiken.
const shapes = [
  ['pauze', (text: string) => text.replace('(#17));', '(#17,#9001));')
    .replace('ENDSEC;\nEND-ISO', "#9001=IFCTIMEPERIOD('17:15:00','18:45:00');\nENDSEC;\nEND-ISO")],
  ['weekpatronen', (text: string) => text.replace(',$,$,(#19),', ',$,$,(#19,#9003),')
    .replace('ENDSEC;\nEND-ISO', "#9001=IFCTIMEPERIOD('08:15:00','15:45:00');\n#9002=IFCRECURRENCEPATTERN(.WEEKLY.,$,(6),$,$,$,$,(#9001));\n#9003=IFCWORKTIME('Zaterdag',.PREDICTED.,$,#9002,$,$);\nENDSEC;\nEND-ISO")],
  ['uitzondering', (text: string) => text.replace("#20=IFCWORKTIME('New Year''s Day',.PREDICTED.,$,$,", "#20=IFCWORKTIME('New Year''s Day',.PREDICTED.,$,#9002,")
    .replace('ENDSEC;\nEND-ISO', "#9001=IFCTIMEPERIOD('08:15:00','15:45:00');\n#9002=IFCRECURRENCEPATTERN(.DAILY.,$,$,$,$,$,$,(#9001));\nENDSEC;\nEND-ISO")],
] as const;
for (const [shape, transform] of shapes) {
  const input = transform(source);
  eq(`${shape}: fixture gewijzigd`, input !== source, true);
  const imported = readIFC(input);
  eq(`${shape}: startminuten gelezen`, imported.calendar.workTime?.byWeekday[1]?.[0]?.start ?? imported.calendar.workStartHour * 60, 450);
  if (shape !== 'uitzondering') {
    const file = memoryFile(input);
    const { store } = createAppStoreContext();
    await store.getState().openOpenedFile({ name: 'banden.ifc', content: input, ref: { kind: 'handle', handle: file.handle } });
    await store.getState().saveFile();
    eq(`${shape}: gewone opslag behoudt minuten`, file.writes[0]?.includes("IFCTIMEPERIOD('07:30:00','16:00:00')"), true);
    eq(`${shape}: heropenen behoudt banden`, readIFC(file.writes[0]).calendar.workTime, imported.calendar.workTime);
  }
  // Vervang de extra periode, zodat juist de tweede band/patroon/uitzondering wordt getoetst.
  const seconds = input.replace(/(#9001=IFCTIMEPERIOD\('\d\d:\d\d:)00/, '$101');
  eq(`${shape}: secondenfixture gewijzigd`, seconds !== input, true);
  eq(`${shape}: seconden openen`, readIFC(seconds).tasks.length, imported.tasks.length);
}

// Eigen OPS-bestanden blijven zonder plannerbewerking gewoon openen en opslaan.
// Een externe applicatiemarkering doorloopt dezelfde controle.
for (const own of [true, false]) {
 for (const scalarMark of [false, true]) {
 for (const [start, end] of [['07:30:01', '16:00:00'], ['07:15:00', '16:45:30'], ['07:15:00.5', '16:45:00'], ['07:15:00.123', '16:45:00'], ['07:30:01Z', '16:00:00Z'], ['07:30:00.0001+01:00', '16:00:00+01:00'], ['07:30:00.000000001', '16:00:00'], ['07:30:00.000000000000000001', '16:00:00']] as const) {
  const input = source.replace(period, `IFCTIMEPERIOD('${start}','${end}')`)
    .replace("'0.2','Open Planner Studio','OPS'", own ? "'0.2','Open Planner Studio','OPS'" : "'1','External planner','EXT'");
  const markedInput = scalarMark ? input.replace('ENDSEC;\nEND-ISO', "#9900=IFCPROPERTYSINGLEVALUE('IsHourCalendar',$,IFCBOOLEAN(.F.),$);\n#9901=IFCPROPERTYSET('0000000000000000000001',#6,'OPS_Calendar',$,(#9900));\n#9902=IFCRELDEFINESBYPROPERTIES('0000000000000000000002',#6,$,$,(#38),#9901);\nENDSEC;\nEND-ISO") : input;
  const label = `${scalarMark ? 'scalar-markering ' : ''}${own ? 'eigen' : 'extern'} ${start}/${end}`;
  eq(`${label}: tekst opent`, readIFC(markedInput).tasks.length, readIFC(source).tasks.length);
  eq(`${label}: bytes openen`, (await readIfcBytes(new TextEncoder().encode(markedInput))).tasks.length, readIFC(source).tasks.length);
  const { store } = createAppStoreContext();
  const file = memoryFile(markedInput);
  await store.getState().openOpenedFile({ name: 'seconden.ifc', content: markedInput, ref: { kind: 'handle', handle: file.handle } });
  await store.getState().saveFile();
  eq(`${label}: gewone opslag zonder bewerken`, file.writes.length, 1);
  if (!file.writes[0]) continue;
  eq(`${label}: bronseconden in standaardveld`, hasSourceClocks(file.writes[0], start, end), true);
  const reopened = createAppStoreContext().store;
  const savedFile = memoryFile(file.writes[0]);
  await reopened.getState().openOpenedFile({ name: 'eigen-opnieuw.ifc', content: file.writes[0], ref: { kind: 'handle', handle: savedFile.handle } });
  eq(`${label}: expliciete banden behouden`, reopened.getState().calendar.workTime, store.getState().calendar.workTime);
  await reopened.getState().saveFile();
  eq(`${label}: eigen opslag weigert nooit zonder bewerking`, savedFile.writes.length, 1);
  eq(`${label}: seconden blijven bij tweede opslag`, hasSourceClocks(savedFile.writes[0], start, end), true);
  reopened.getState().addTask({ name: 'Werk gewijzigd, kalender gelijk' });
  await reopened.getState().saveFile();
  eq(`${label}: taakbewerking bewaart seconden`, hasSourceClocks(savedFile.writes[1], start, end), true);
 }
 }
}

for (const name of [...readdirSync(new URL('./fixtures/oude-tags/', import.meta.url)).filter(n => n.endsWith('.ifc')).map(n => `oude-tags/${n}`), 'h7-tijden-oude-writer.ifc']) {
  const input = readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
  const file = memoryFile(input);
  const { store } = createAppStoreContext();
  await store.getState().openOpenedFile({ name, content: input, ref: { kind: 'handle', handle: file.handle } });
  await store.getState().saveFile();
  eq(`${name}: eigen bestand schrijft zonder bewerken`, file.writes.length, 1);
}

// Daadwerkelijke d783-writeruitvoer: de oude inhoudssleutel gebruikt dezelfde
// minuutfractie als de standaardperiode. De uitzondering moet werkend blijven.
{
  const input = readFileSync(new URL('./fixtures/kalendertijd-oud/werkende-uitzondering.ifc', import.meta.url), 'utf8');
  const expected = [{ name: 'Werkzaterdag', startDate: '2027-05-01', endDate: '2027-05-01', bands: [{ start: 510.5, end: 720 }] }];
  eq('oude uitzondering: echte writerperiode', input.includes("IFCTIMEPERIOD('08:30.5:00','12:00:00')"), true);
  eq('oude uitzondering: gewone lezer herkent werkdag', readIFC(input).calendar.workingExceptions, expected);
  eq('oude uitzondering: bytesroute herkent werkdag', (await readIfcBytes(new TextEncoder().encode(input))).calendar.workingExceptions, expected);
  const file = memoryFile(input);
  const { store } = createAppStoreContext();
  await store.getState().openOpenedFile({ name: 'oude-werkzaterdag.ifc', content: input, ref: { kind: 'handle', handle: file.handle } });
  eq('oude uitzondering: store herkent werkdag', store.getState().calendar.workingExceptions, expected);
  eq('oude uitzondering: geen feestdag', store.getState().calendar.holidays.some(h => h.name === 'Werkzaterdag'), false);
  const clock = new CalendarEngine(calendarForEngine(store.getState().calendar));
  eq('oude uitzondering: zaterdag is werkdag', clock.isWorkDay(parseInstant('2027-05-01T09:00:00')), true);
  eq('oude uitzondering: werkminuten inclusief halve minuut', clock.workMinutesBetween(parseInstant('2027-05-01T08:30:30'), parseInstant('2027-05-01T12:00:00')), 209.5);
  await store.getState().saveFile();
  eq('oude uitzondering: onbewerkt schrijft', file.writes.length, 1);
  eq('oude uitzondering: onbewerkt heropent werkend', readIFC(file.writes[0]).calendar.workingExceptions, expected);
  store.getState().setCalendar({ ...structuredClone(store.getState().calendar), workStartHour: 8 });
  await store.getState().saveFile();
  eq('oude uitzondering: kalenderbewerking schrijft', file.writes.length, 2);
  const back = readIFC(file.writes.at(-1)!);
  eq('oude uitzondering: kalenderstart gewijzigd', back.calendar.workStartHour, 8);
  eq('oude uitzondering: bewerking heropent werkend', back.calendar.workingExceptions, expected);
  eq('oude uitzondering: bronklokken behouden', hasSourceClocks(file.writes.at(-1), '08:30.5:00', '12:00:00'), true);
  // V1 blijft expliciet en leidend: geen impliciete werkdag op alleen een recurrence.
  const marker = input.split('\n').find(line => line.includes("('WorkingExceptionKeysV1',"))!;
  const emptyMarker = input.replace(marker, marker.replace(/IFCTEXT\('.*'\)/, "IFCTEXT('[]')"));
  eq('oude uitzondering: lege V1 valt niet terug op legacy ids', readIFC(emptyMarker).calendar.workingExceptions ?? [], []);
  eq('oude uitzondering: afwezige V1 gebruikt legacy ids', readIFC(input.replace(marker, '')).calendar.workingExceptions, expected);
  const changedPeriod = input.replace("IFCTIMEPERIOD('08:30.5:00','12:00:00')", "IFCTIMEPERIOD('08:31.5:00','12:00:00')");
  eq('oude uitzondering: niet-passende inhoudssleutel blijft afgewezen', readIFC(changedPeriod).calendar.workingExceptions ?? [], []);
}

// Werkelijke eigen schrijfvormen: alle normale werktijdbewerkingen blijven
// opslaanbaar. Undo/redo gebruiken de echte store-acties, geen directe terugzet.
const ownInputs: [string, string][] = ['periode-oude-minuutfractie.ifc', 'periode-oude-minuutfractie-v2026.8.1.ifc', 'periode-oude-scalarfractie-v2026.8.1.ifc', 'kalendertijd-oud/werkende-uitzondering.ifc']
  .map(name => [name, readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')]);
for (const [name, seconds] of [['eigen-minuten', 0], ['eigen-milliseconden', 0.123], ['eigen-fijnere-decimale-seconden', 0.000000001]] as const) {
  const own = readIFC(source);
  own.tasks = []; own.sequences = []; own.resources = []; own.assignments = [];
  delete own.calendar.ifcTimePeriods;
  own.calendar.workTime = { byWeekday: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } };
  for (const day of [1, 2, 3, 4, 5] as const) own.calendar.workTime.byWeekday[day] = [
    { start: 435 + seconds / 60, end: 720 + seconds / 60 }, { start: 780 + seconds / 60, end: 1005 + seconds / 60 },
  ];
  own.calendar.workingExceptions = [{ name: 'Eigen werkzaterdag', startDate: '2027-05-01', endDate: '2027-05-01', bands: [{ start: 480 + seconds / 60, end: 720 + seconds / 60 }] }];
  ownInputs.push([name, writeIFC(own)]); // echte huidige schrijver; geen tekstmutatie.
}
const shape = (cal: WorkCalendar) => ({
  workDays: cal.workDays, workStartHour: cal.workStartHour, workEndHour: cal.workEndHour, hoursPerDay: cal.hoursPerDay,
  workTime: cal.workTime ?? null, workingExceptions: cal.workingExceptions ?? [], holidays: cal.holidays,
});
let ownRoutes = 0;
for (const [name, text] of ownInputs) {
  for (const action of ['toevoegen', 'verwijderen', 'verschuiven', 'einde-verschuiven', 'band-verschuiven', 'kopiëren', 'uitzondering-toevoegen', 'uitzondering-verwijderen', 'uitzondering-verschuiven'] as const) {
    const file = memoryFile(text);
    const { store } = createAppStoreContext();
    await store.getState().openOpenedFile({ name: `${name}.ifc`, content: text, ref: { kind: 'handle', handle: file.handle } });
    const before = structuredClone(store.getState().calendar);
    if ((action === 'uitzondering-verwijderen' || action === 'uitzondering-verschuiven') && !before.workingExceptions?.length) continue;
    ownRoutes++;
    const label = `${name} · ${action}`;
    const routeFailureStart = failures.length;
    const changed = structuredClone(before);
    if (action.startsWith('uitzondering-')) {
      if (action === 'uitzondering-toevoegen') changed.workingExceptions = [...(changed.workingExceptions ?? []), { name: 'Nieuwe werkdag', startDate: '2027-05-08', endDate: '2027-05-08', bands: [{ start: 480, end: 720 }] }];
      if (action === 'uitzondering-verwijderen') changed.workingExceptions = changed.workingExceptions!.slice(1);
      if (action === 'uitzondering-verschuiven') changed.workingExceptions![0].bands![0].start += 15;
    } else {
      const bands = structuredClone(changed.workTime ?? effectiveWorkTimeBands(changed)!);
      if (action === 'toevoegen') bands.byWeekday[1].unshift({ start: 300, end: 360 });
      if (action === 'verwijderen') bands.byWeekday[1] = bands.byWeekday[1].slice(1);
      if (action === 'verschuiven') bands.byWeekday[1][0].start += 15;
      if (action === 'einde-verschuiven') bands.byWeekday[1][0].end -= 15;
      if (action === 'band-verschuiven') { bands.byWeekday[1][0].start += 15; bands.byWeekday[1][0].end += 15; }
      if (action === 'kopiëren') {
        bands.byWeekday[1][0].start += 15;
        const first = bands.byWeekday[1];
        for (const day of [2, 3, 4, 5] as const) bands.byWeekday[day] = first.map(b => ({ ...b }));
      }
      changed.workTime = bands;
      changed.workDays = workDaysFromBands(bands);
      changed.hoursPerDay = hoursPerDayForBlocks(before, changed, bands);
      delete changed.simpleBreakStartMinute; delete changed.simpleBreakDurationMinutes;
    }
    store.getState().setCalendar(changed);
    const error = console.error;
    console.error = () => {};
    try {
      await store.getState().saveFile();
      eq(`${label}: eigen bewerking schrijft`, file.writes.length, 1);
      if (file.writes.length) eq(`${label}: bewerking heropent exact`, shape(readIFC(file.writes.at(-1)!).calendar), shape(changed));
      store.getState().undo();
      eq(`${label}: undo herstelt kalender`, shape(store.getState().calendar), shape(before));
      await store.getState().saveFile();
      eq(`${label}: undo schrijft`, file.writes.length, 2);
      if (file.writes.length >= 2) eq(`${label}: undo heropent exact`, shape(readIFC(file.writes.at(-1)!).calendar), shape(before));
      store.getState().redo();
      eq(`${label}: redo herstelt bewerking`, shape(store.getState().calendar), shape(changed));
      await store.getState().saveFile();
      eq(`${label}: redo schrijft`, file.writes.length, 3);
      if (file.writes.length >= 3) eq(`${label}: redo heropent exact`, shape(readIFC(file.writes.at(-1)!).calendar), shape(changed));
      eq(`${label}: geen opslagweigering`, store.getState().ui.notifications.some(n => n.messageKey === 'notifications.saveFailed'), false);
    } finally { console.error = error; }
    console.log(`Eigen route ${label}: ${failures.length === routeFailureStart ? 'GROEN' : 'ROOD'} (opslag, undo, redo)`);
  }
}
console.log(`Eigen werktijdroutes: ${ownRoutes} bewerkingen, elk met echte undo en redo`);

// Een bewerkte tijdzoneklok kan het model niet zelfstandig van een zone voorzien.
// Weiger die opslag, in plaats van een bestaande tijdzone uit het bestand te wissen.
const zoned = readFileSync(new URL('./fixtures/periode-oude-minuutfractie.ifc', import.meta.url), 'utf8')
  .replace("IFCTIMEPERIOD('07:30.5:00','16:00:00')", "IFCTIMEPERIOD('07:30:01Z','16:00:00Z')");
const fineImport = readIFC(zoned);
fineImport.calendar.workTime!.byWeekday[1][0].start += 1;
let typed = false;
try { writeIFC(fineImport); } catch (e) { typed = e instanceof IfcCalendarTimePrecisionError; }
eq('bewerkte zoneklok: writer weigert getypeerd', typed, true);
const fineStore = createAppStoreContext().store;
const fineFile = memoryFile(zoned);
await fineStore.getState().openOpenedFile({ name: 'bewerkt.ifc', content: zoned, ref: { kind: 'handle', handle: fineFile.handle } });
fineStore.setState(s => { s.calendar.workTime!.byWeekday[1][0].start += 1; });
const active = fineStore.getState().project.id;
const realError = console.error;
console.error = () => {};
try { await fineStore.getState().saveFile(); } finally { console.error = realError; }
eq('geweigerde opslag laat bron intact', fineFile.writes.length, 0);
eq('geweigerde opslag houdt document open', fineStore.getState().project.id, active);
eq('geweigerde opslag gebruikt bestaande melding', fineStore.getState().ui.notifications.some(n => n.severity === 'error'), true);
console.error = () => {};
try { await fineStore.getState().saveFileAs(); } finally { console.error = realError; }
eq('geweigerde Opslaan als laat bron intact', fineFile.writes.length, 0);
eq('geweigerde Opslaan als gebruikt bestaande melding', fineStore.getState().ui.notifications.some(n => n.messageKey === 'notifications.saveFailed'), true);

for (const failure of failures) console.log(`XX ${failure}`);
console.log(`Kalendertijd: ${checks} controles, ${failures.length} fouten`);
if (failures.length) process.exitCode = 1;
