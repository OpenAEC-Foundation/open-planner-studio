import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { calendarResourceTools } from '@/services/mcp/tools/calendarResourceTools';
import { readTools } from '@/services/mcp/tools/readTools';
import { batchTools } from '@/services/mcp/tools/batchTool';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { shiftPresetPatch } from '@/utils/shiftPresets';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';

const store = useAppStore;
const S = () => store.getState();

store.getState().addTask({ name: 'warmup' });
store.getState().undo();

registerToolModules([readTools, calendarResourceTools, batchTools]);

function makeCtx(overrides: McpContextOverrides = {}): McpContext {
  return makeMcpContext(appStoreContext, {
    ...overrides,
  });
}

function toolDef(name: string) {
  const def = [...calendarResourceTools, ...readTools, ...batchTools].find((t) => t.name === name);
  if (!def) throw new Error(`tool ontbreekt: ${name}`);
  return def;
}

async function call(name: string, args: unknown, ctx: McpContext = makeCtx()): Promise<McpToolResult> {
  return await toolDef(name).handler(args, ctx);
}

function okData(res: McpToolResult): any {
  assert(res.ok, `verwachtte ok, kreeg fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data as any;
}

function rejections(res: McpToolResult): { id: string; reason: string }[] {
  return (res as McpToolOk).itemRejections ?? [];
}

async function readCalendars(): Promise<any> {
  return okData(await call('planner_get_calendars', {}));
}

function soleRejection(res: McpToolResult): string {
  const rej = rejections(res);
  assertEq(rej.length, 1, `precies één weigering verwacht, kreeg ${JSON.stringify(rej)}`);
  return rej[0].reason;
}

function calShape(c: Partial<WorkCalendar> | undefined): unknown {
  assert(!!c, 'kalender ontbreekt');
  return {
    name: c!.name,
    description: c!.description,
    workDays: c!.workDays,
    workStartHour: c!.workStartHour,
    workEndHour: c!.workEndHour,
    hoursPerDay: c!.hoursPerDay,
    workTime: c!.workTime ?? null,
    shift: c!.shift ?? null,
    holidays: c!.holidays,
    generation: c!.generation ?? null,
  };
}

const calById = (id: string): WorkCalendar | undefined => S().calendars.find((c) => c.id === id);

function bands8to16(): WorkTimeBands {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  for (const d of [1, 2, 3, 4, 5] as const) byWeekday[d] = [{ start: 480, end: 960 }];
  return { byWeekday };
}

function addTask(name: string, durationDays: number, durationMinutes?: number): string {
  const id = S().addTask({ name });
  const t = S().tasks.find((x) => x.id === id)!;
  S().updateTask(id, {
    time: {
      ...t.time,
      durationUnit: durationMinutes !== undefined ? 'hours' : 'days',
      scheduleDuration: durationDays,
      durationMinutes,
    },
  });
  return id;
}

function reset(): void {
  S().newProject();
}

test('uurkalender uit doc A letterlijk terugschrijven in doc B ⇒ veld voor veld identiek', async () => {
  reset();
  const preset = shiftPresetPatch('two-shift');
  const srcId = S().addCalendar({
    name: 'Ploegen 2x8',
    description: 'dag + avond',
    workDays: preset.workDays,
    workStartHour: preset.workStartHour,
    workEndHour: preset.workEndHour,
    hoursPerDay: preset.hoursPerDay,
    holidays: [{ name: 'Vorstverlet', startDate: '2026-01-12', endDate: '2026-01-14' }],
    generation: { ruleSetId: 'NL', region: undefined, breakChoice: 'noord', generatedFromYear: 2025, generatedToYear: 2028 },
    workTime: preset.workTime,
    shift: preset.shift,
  } as Omit<WorkCalendar, 'id'>);

  const read = await readCalendars();
  const src = read.calendars.find((c: any) => c.id === srcId);
  assert(!!src, 'de leeskant geeft de nieuwe kalender terug');
  assert(!!src.workTime && src.shift === 'SECOND', 'de leeskant draagt workTime én shift');
  assertEq(src.generation.breakChoice, 'noord', 'de leeskant draagt de herkomst in de LEESVORM');

  store.getState().newDocument();
  assertEq(S().calendars.some((c) => c.id === srcId), false, 'doc B kent dit kalender-id nog niet');

  const res = await call('planner_update_calendar', { calendars: [{ ...src, create: true }] });
  const data = okData(res);
  assertEq(rejections(res), [], 'geen enkele weigering op de letterlijke lezing');
  const row = data.calendars[0];
  assertEq(row.created, true, 'de kalender is aangemaakt in doc B');
  assertEq(row.requestedId, srcId, 'het bron-id komt terug als requestedId');
  assertEq(row.mode, 'hour', 'de kopie is een UUR-kalender');
  assertEq(row.ignoredFields, ['isProjectDefault', 'usedByTasks', 'usedByResources'],
    'de afgeleide leesvelden worden gemeld, niet stil geslikt');

  const copy = calById(row.id);
  assertEq(calShape(copy), calShape(src as WorkCalendar), 'de kopie is veld voor veld gelijk aan de lezing');
  assertEq(copy!.hoursPerDay, 16, 'de netto uren per dag zijn meegekomen (2 × 8u banden)');

  const readB = await readCalendars();
  assertEq(calShape(readB.calendars.find((c: any) => c.id === row.id)), calShape(src as WorkCalendar),
    'de lezing in doc B is gelijk aan de lezing in doc A');
});

test('projectkalender gelijkmaken aan een lezing uit een ander document (update-pad)', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const preset = shiftPresetPatch('night');
  S().updateCalendar(projId, {
    name: 'Nachtploeg', workTime: preset.workTime, shift: preset.shift,
    workDays: preset.workDays, workStartHour: preset.workStartHour,
    workEndHour: preset.workEndHour, hoursPerDay: preset.hoursPerDay,
  });
  const src = (await readCalendars()).calendars.find((c: any) => c.id === projId);
  assertEq(src.isProjectDefault, true, 'testvoorwaarde: dit is de projectkalender van doc A');

  store.getState().newDocument();
  const readB = await readCalendars();
  const targetId = readB.projectDefaultId;
  assertEq(calById(targetId)!.workTime, undefined, 'doc B start met een DAG-kalender');

  const res = await call('planner_update_calendar', { calendars: [{ ...src, id: targetId }] });
  const row = okData(res).calendars[0];
  assertEq(rejections(res), [], 'geen weigeringen');
  assertEq(row.created, false, 'geen create: de projectkalender bestond al');
  assertEq(row.modeChangedFrom, 'day', 'de omschakeling dag→uur wordt gemeld');
  assertEq(row.mode, 'hour', 'de projectkalender van doc B is nu uur-modus');
  assertEq(calShape(calById(targetId)), calShape(src as WorkCalendar), 'inhoudelijk identiek aan doc A');
  assertEq(S().calendar.workTime, calById(targetId)!.workTime, 'de projectkalender-cache volgt de entry');
});

test('ongeldige uurbanden ⇒ weigering met uitleg; de kalender blijft onaangeroerd', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();

  const week = (over: Partial<Record<string, unknown>>): unknown => ({
    byWeekday: { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], ...over },
  });

  const gevallen: { naam: string; workTime: unknown; verwacht: RegExp }[] = [
    { naam: 'eind vóór begin', workTime: week({ '1': [{ start: 960, end: 480 }] }), verwacht: /does not lie after|keeps COUNTING/i },
    { naam: 'gelijk begin en eind', workTime: week({ '1': [{ start: 480, end: 480 }] }), verwacht: /does not lie after/i },
    { naam: 'overlappende banden', workTime: week({ '2': [{ start: 480, end: 720 }, { start: 600, end: 960 }] }), verwacht: /overlap or are out of order/i },
    { naam: 'start buiten de dag', workTime: week({ '3': [{ start: 1500, end: 1600 }] }), verwacht: /falls outside the day/i },
    { naam: 'negatieve start', workTime: week({ '3': [{ start: -30, end: 480 }] }), verwacht: /falls outside the day/i },
    { naam: 'eind voorbij 2880', workTime: week({ '4': [{ start: 1400, end: 3000 }] }), verwacht: /exceeds 2880/i },
    { naam: 'ontbrekende weekdag', workTime: { byWeekday: { '1': [{ start: 480, end: 960 }] } }, verwacht: /must contain ALL weekdays/i },
    { naam: 'verkeerde dagsleutel', workTime: week({ '8': [] }), verwacht: /unknown day key/i },
    { naam: 'niet-numerieke band', workTime: week({ '1': [{ start: '08:00', end: '16:00' }] }), verwacht: /must be numbers in MINUTES/i },
    { naam: 'onbekend bandveld', workTime: week({ '1': [{ start: 480, end: 960, pauze: 30 }] }), verwacht: /unknown field `workTime.byWeekday.1\[\].pauze`/i },
    { naam: 'wrap over de volgende dag heen', workTime: week({ '1': [{ start: 1320, end: 1900 }], '2': [{ start: 400, end: 960 }] }), verwacht: /overlaps the first band of day 2/i },
    { naam: 'workTime spreekt workDays tegen', workTime: week({ '1': [{ start: 480, end: 960 }] }), verwacht: /contradicts `workTime`/i },
  ];

  for (const g of gevallen) {
    const voor = JSON.stringify(S().calendars);
    const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
    const item: Record<string, unknown> = { id: projId, workTime: g.workTime };
    if (g.naam === 'workTime spreekt workDays tegen') item.workDays = [1, 2, 3, 4, 5];
    const res = await call('planner_update_calendar', { calendars: [item] });
    const reden = soleRejection(res);
    assert(g.verwacht.test(reden), `[${g.naam}] onbruikbare weigeringsreden: ${reden}`);
    assertEq(JSON.stringify(S().calendars), voor, `[${g.naam}] de kalender is ONAANGEROERD gebleven`);
    assertEq(S().historyEvents.filter(event => event.state === 'applied').length, undoVoor, `[${g.naam}] geen undo-stap (geen transactie geopend)`);
    assertEq(okData(res).calendars, [], `[${g.naam}] geen enkele kalender gewijzigd`);
  }
});

test('een uur-kalender zónder één band ⇒ harde fout + VOLLEDIGE rollback (geen halve kalender)', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  addTask('Iets', 3);
  const voor = JSON.stringify(S().calendars);
  const undoVoor = S().historyEvents.filter(event => event.state === 'applied').length;
  const leeg = { byWeekday: { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [] } };
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workTime: leeg }] });
  assertEq(res.ok, false, 'de call faalt hard i.p.v. een onbruikbare kalender te committen');
  assertEq((res as any).error, 'Calendar has no working days configured', 'begrijpelijke Engelse kalenderfout');
  assertEq(JSON.stringify(S().calendars), voor, 'de kalender is volledig teruggerold');
  assertEq(S().historyEvents.filter(event => event.state === 'applied').length, undoVoor, 'geen achtergebleven undo-stap');
});

test('een item met alleen afgeleide leesvelden is een no-op ⇒ zachte weigering die de velden noemt', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, isProjectDefault: true, usedByTasks: 3 }] });
  const reden = soleRejection(res);
  assert(/no changes given/.test(reden) && /workTime/.test(reden) && /holidays/.test(reden),
    `de weigering somt de bruikbare velden op: ${reden}`);
});

test('dag→uur op de projectkalender ⇒ native taakduren blijven behouden', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const halve = addTask('Halve dag werk', 2, 240);
  const gewoon = addTask('Gewone taak', 3);

  const res = await call('planner_update_calendar', {
    calendars: [{ id: projId, workTime: bands8to16() }],
  });
  const data = okData(res);
  const row = data.calendars[0];
  assertEq(row.modeChangedFrom, 'day', 'de omschakeling wordt als zodanig gemeld');
  assertEq(row.mode, 'hour', 'de kalender is nu uur-modus');
  assertEq(row.hoursPerDayEffective, 8, 'de afgeleide netto uren per dag');
  assertEq(row.taskDurationsPreserved, true, 'de respons bevestigt dat native taakduren behouden zijn');
  assertEq(row.durationEffects, undefined, 'oude kalenderafhankelijke duurconversies zijn verwijderd');

  const w = (data.warnings as string[]).join(' | ');
  assert(/native quantity.*are preserved/.test(w), `de waarschuwing bevestigt duurbehoud: ${w}`);
  assert(!/EFFECTIVE DURATION CHANGED/.test(w), `de waarschuwing claimt geen duurconversie: ${w}`);
  const hourTask = S().tasks.find((t) => t.id === halve)!;
  assertEq(hourTask.time.durationUnit, 'hours', 'urentaak blijft uren');
  assertEq(hourTask.time.durationMinutes, 240, 'urentaak blijft exact 240 minuten');
  const dayTask = S().tasks.find((t) => t.id === gewoon)!;
  assertEq(dayTask.time.durationUnit, 'days', 'dagtaak blijft dagen');
  assertEq(dayTask.time.scheduleDuration, 3, 'dagtaak blijft exact drie dagen');
  assertEq(S().tasks.find((t) => t.id === halve)!.calendarId, undefined, 'de taak had geen eigen kalender');
  assertEq(calById(projId)!.workDays, [1, 2, 3, 4, 5], 'workDays is uit de banden afgeleid');
  assertEq(calById(projId)!.hoursPerDay, 8, 'hoursPerDay is uit de banden afgeleid');
});

test('uur→dag met bestaande urentaak ⇒ effectieve scalaire blokken behouden de taakminuten', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  S().updateCalendar(projId, { workTime: bands8to16(), hoursPerDay: 8, workDays: [1, 2, 3, 4, 5] });
  const halve = addTask('Halve dag werk', 2, 240);

  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workTime: null }] });
  okData(res);
  const hourTask = S().tasks.find((t) => t.id === halve)!;
  assertEq(hourTask.time.durationUnit, 'hours', 'urentaak blijft uren');
  assertEq(hourTask.time.durationMinutes, 240, 'exacte minuten blijven behouden');
  assert(!('workTime' in (calById(projId) as object)), 'de scalaire kalender heeft geen expliciete blokken');
  assertEq(S().calendar.workTime, calById(projId)!.workTime, 'projectkalender-cache blijft consistent');
});

test('speling van een uurtaak staat in werkdagen: 4 uur naast een taak van 8 uur ⇒ 0.5', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  S().updateCalendar(projId, { workTime: bands8to16(), hoursPerDay: 8, workDays: [1, 2, 3, 4, 5] });
  const kort = addTask('Vier uur', 1, 240);
  const lang = addTask('Acht uur', 1, 480);
  const eind = addTask('Gereed', 0);
  S().addSequence({ predecessorId: kort, successorId: eind, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: lang, successorId: eind, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const data = okData(await call('planner_get_task', { taskId: kort }));
  assertEq(data.durationUnit, 'hours', 'testvoorwaarde: een uurtaak');
  assertEq(data.schedule.freeFloat, 0.5, 'vrije speling van 4 werkuren op een dag van 8 uur = 0.5 werkdag');
  assertEq(data.schedule.totalFloat, 0.5, 'totale speling idem');
  for (const name of ['planner_get_task', 'planner_get_critical_path']) {
    assert(/Float is in working days/.test(toolDef(name).description), `${name} noemt de eenheid van de speling`);
  }
});

test('`shift` is schrijfbaar, leesbaar en wisbaar', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();

  const res = await call('planner_update_calendar', { calendars: [{ id: projId, shift: 'THIRD' }] });
  assertEq(okData(res).calendars[0].shift, 'THIRD', 'de respons meldt de ploeg');
  assertEq(calById(projId)!.shift, 'THIRD', 'de ploeg staat in de store');
  const gelezen = (await readCalendars()).calendars.find((c: any) => c.id === projId);
  assertEq(gelezen.shift, 'THIRD', 'de leeskant geeft hem terug');

  const weg = await call('planner_update_calendar', { calendars: [{ id: projId, shift: null }] });
  assertEq(rejections(weg), [], 'wissen mag');
  assertEq('shift' in (calById(projId) as object), false, '`shift` is echt verwijderd');

  const fout = await call('planner_update_calendar', { calendars: [{ id: projId, shift: 'NIGHT' }] });
  assert(/unknown `shift` 'NIGHT'.*FIRST, SECOND, THIRD, USERDEFINED/s.test(soleRejection(fout)),
    'een onbekende ploeg wordt geweigerd MÉT de geldige waarden');
});

test('generation: de leesvorm is schrijfbaar, wisbaar, en de generator-sleutels wijzen de weg', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();

  const gen = { ruleSetId: 'DE', region: 'Bayern', breakChoice: 'zuid', generatedFromYear: 2025, generatedToYear: 2028 };
  const ok = await call('planner_update_calendar', {
    calendars: [{ id: projId, generation: gen, holidays: [{ name: 'Neujahr', startDate: '2026-01-01', endDate: '2026-01-01' }] }],
  });
  assertEq(rejections(ok), [], 'de leesvorm wordt geaccepteerd');
  assertEq(calById(projId)!.generation, gen, 'de herkomst staat letterlijk in de store');
  assertEq(okData(ok).calendars[0].becameLiteral, false, 'met een expliciete herkomst wordt de kalender niet letterlijk');
  assertEq((await readCalendars()).calendars.find((c: any) => c.id === projId).generation, gen,
    'lezen levert exact hetzelfde object op — de round-trip sluit');

  const weg = await call('planner_update_calendar', { calendars: [{ id: projId, generation: null }] });
  assertEq(rejections(weg), [], 'null wist de herkomst');
  assertEq('generation' in (calById(projId) as object), false, '`generation` is echt verwijderd');

  const drift = await call('planner_update_calendar', {
    calendars: [{ id: projId, generation: { country: 'NL', bouwvak: 'noord', generatedFromYear: 2025, generatedToYear: 2028 } }],
  });
  const reden = soleRejection(drift);
  assert(/`generation.country` does not exist/.test(reden) && /ruleSetId/.test(reden),
    `de weigering wijst naar de juiste sleutel: ${reden}`);

  const beide = await call('planner_update_calendar', {
    calendars: [{ id: projId, generate: { country: 'NL', bouwvak: 'geen' }, generation: { ruleSetId: 'NL', generatedFromYear: 2025, generatedToYear: 2028 } }],
  });
  assert(/`generate` OR `generation`/.test(soleRejection(beide)), 'de tegenstrijdigheid wordt uitgelegd');

  const jaren = await call('planner_update_calendar', {
    calendars: [{ id: projId, generation: { ruleSetId: 'NL', generatedFromYear: 2030, generatedToYear: 2025 } }],
  });
  assert(/lies before `generatedFromYear`/.test(soleRejection(jaren)), 'omgekeerde jaarspanne geweigerd');
  const land = await call('planner_update_calendar', {
    calendars: [{ id: projId, generation: { ruleSetId: 'none', generatedFromYear: 2025, generatedToYear: 2028 } }],
  });
  assert(/unknown `generation.ruleSetId` 'none'/.test(soleRejection(land)), "'none' bestaat niet in de leesvorm");
});

test('`holidays` vervangt de lijst exact en botst niet met rawHolidays/generate', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  assert(calById(projId)!.holidays.length > 0, 'testvoorwaarde: de standaardkalender draagt feestdagen');

  const lijst = [
    { name: 'Bedrijfssluiting', startDate: '2026-07-20', endDate: '2026-08-07' },
    { name: 'Nieuwjaar', startDate: '2026-01-01', endDate: '2026-01-01' },
  ];
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, holidays: lijst }] });
  assertEq(rejections(res), [], 'de leesvorm wordt geaccepteerd');
  assertEq(calById(projId)!.holidays.map((h) => h.name), ['Nieuwjaar', 'Bedrijfssluiting'],
    'de lijst is EXACT vervangen (en canoniek op startdatum gesorteerd)');
  assertEq(okData(res).calendars[0].becameLiteral, true, 'zonder herkomst wordt de kalender letterlijk');
  assertEq('generation' in (calById(projId) as object), false, 'de generator-herkomst is vervallen');

  const leeg = await call('planner_update_calendar', { calendars: [{ id: projId, holidays: [] }] });
  assertEq(rejections(leeg), [], 'een lege leeslijst is een geldige opdracht');
  assertEq(calById(projId)!.holidays, [], 'alle feestdagen weg');

  for (const [item, patroon] of [
    [{ id: projId, holidays: lijst, rawHolidays: lijst }, /`holidays` OR `rawHolidays`/],
    [{ id: projId, holidays: lijst, holidaysMode: 'replace' }, /`holidaysMode` belongs to `rawHolidays`/],
    [{ id: projId, holidays: lijst, generate: { country: 'NL', bouwvak: 'geen' } }, /`holidays` OR `generate`/],
    [{ id: projId, holidays: [{ name: '', startDate: '2026-01-01', endDate: '2026-01-01' }] }, /non-empty `name`/],
    [{ id: projId, holidays: [{ name: 'X', startDate: '2026-01-05', endDate: '2026-01-01' }] }, /lies before startDate/],
  ] as [Record<string, unknown>, RegExp][]) {
    const bad = await call('planner_update_calendar', { calendars: [item] });
    assert(patroon.test(soleRejection(bad)), `verwacht ${patroon}, kreeg: ${soleRejection(bad)}`);
  }
});

test('een onbekend kalenderveld wordt geweigerd, niet stil weggegooid', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const res = await call('planner_update_calendar', {
    calendars: [{ id: projId, name: 'Nieuw', workingHours: 8 }],
  });
  const reden = soleRejection(res);
  assert(/unknown field `workingHours`/.test(reden), `noemt het veld: ${reden}`);
  assert(/workTime/.test(reden) && /generation/.test(reden), `noemt de toegestane lijst: ${reden}`);
  assertEq(calById(projId)!.name !== 'Nieuw', true, 'de rest van het item is NIET half toegepast');
});

test('kalender overzetten binnen een draaiboek (planner_batch, via de dispatcher)', async () => {
  reset();
  const preset = shiftPresetPatch('continuous');
  const srcId = S().addCalendar({
    name: '24/7', description: 'continu', workDays: preset.workDays,
    workStartHour: preset.workStartHour, workEndHour: preset.workEndHour, hoursPerDay: preset.hoursPerDay,
    holidays: [], workTime: preset.workTime, shift: preset.shift,
  } as Omit<WorkCalendar, 'id'>);
  const src = (await readCalendars()).calendars.find((c: any) => c.id === srcId);

  store.getState().newDocument();
  const raw = await handleMcpMessage(
    JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: {
        name: 'planner_batch',
        arguments: {
          steps: [
            { tool: 'planner_update_calendar', args: { calendars: [{ ...src, create: true }] } },
            { tool: 'planner_get_calendars' },
          ],
        },
      },
    }),
    makeCtx(),
  );
  const msg = JSON.parse(raw);
  assert(msg.result !== undefined, `batch gaf een fout: ${raw.slice(0, 400)}`);
  const payload = JSON.parse(msg.result.content[0].text);
  assert(payload.ok !== false, `batch niet ok: ${JSON.stringify(payload).slice(0, 400)}`);
  const stap1 = payload.data.steps[0].data;
  assertEq(stap1.calendars[0].mode, 'hour', 'de overgezette kalender is uur-modus (via de batch)');
  const kopie = calById(stap1.calendars[0].id);
  assertEq(calShape(kopie), calShape(src as WorkCalendar), 'veld voor veld identiek — ook via de batch');
  const gelezen = payload.data.steps[1].data.calendars.find((c: any) => c.id === stap1.calendars[0].id);
  assert(!!gelezen && !!gelezen.workTime, 'de leesstap in dezelfde batch ziet de uurbanden');
});

test('ongeldige banden binnen een batch: zachte weigering, de batch loopt door', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const voor = JSON.stringify(S().calendars);
  const raw = await handleMcpMessage(
    JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: {
        name: 'planner_batch',
        arguments: {
          steps: [
            { tool: 'planner_update_calendar', args: { calendars: [{ id: projId, workTime: { byWeekday: { '1': [{ start: 960, end: 480 }] } } }] } },
            { tool: 'planner_update_project', args: { name: 'Loopt door' } },
          ],
        },
      },
    }),
    makeCtx(),
  );
  const payload = JSON.parse(JSON.parse(raw).result.content[0].text);
  assert(payload.ok !== false, `batch niet ok: ${JSON.stringify(payload).slice(0, 300)}`);
  const rej = (payload.itemRejections ?? []) as { reason: string }[];
  assertEq(rej.length, 1, `precies één zachte weigering, kreeg ${JSON.stringify(rej)}`);
  assert(/step 1 \(planner_update_calendar\)/.test(rej[0].reason), 'de weigering noemt de stap');
  assert(/ALL weekdays|does not lie after/.test(rej[0].reason), `inhoudelijke reden: ${rej[0].reason}`);
  assertEq(JSON.stringify(S().calendars), voor, 'de kalender is onaangeroerd');
  assertEq(S().project.name, 'Loopt door', 'de volgende stap is gewoon uitgevoerd');
});

test('IFC-round-trip: generation, shift en per-weekdag-verschillende banden overleven', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const tweeBanden = {
    byWeekday: {
      1: [{ start: 360, end: 840 }, { start: 840, end: 1320 }],
      2: [{ start: 360, end: 840 }, { start: 840, end: 1320 }],
      3: [{ start: 360, end: 840 }, { start: 840, end: 1320 }],
      4: [{ start: 360, end: 840 }, { start: 840, end: 1320 }],
      5: [{ start: 360, end: 840 }],
      6: [], 7: [],
    },
  } as WorkTimeBands;
  await call('planner_update_calendar', {
    calendars: [{
      id: projId, name: 'Ploegen 2x8', workTime: tweeBanden, shift: 'SECOND',
      generation: { ruleSetId: 'NL', breakChoice: 'noord', generatedFromYear: 2025, generatedToYear: 2028 },
      holidays: [{ name: 'Bouwvak noord', startDate: '2026-07-27', endDate: '2026-08-14' }],
    }],
  });
  addTask('Iets', 2);

  const ifc = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  const terug = readIFC(ifc);
  const cal = terug.calendar;

  assertEq(cal.shift, 'SECOND', 'de ploeg-classificatie overleeft IFC (PredefinedType)');
  assertEq(cal.generation, { ruleSetId: 'NL', breakChoice: 'noord', generatedFromYear: 2025, generatedToYear: 2028 },
    'de generator-herkomst overleeft IFC (OPS_Calendar-pset)');
  assertEq(cal.holidays.length, 1, 'de feestdag overleeft IFC');
  assert(!!cal.workTime, 'de uurbanden overleven IFC (uur-modus wordt herkend)');
  assertEq(cal.workTime!.byWeekday[1], [{ start: 360, end: 840 }, { start: 840, end: 1320 }],
    'de banden van maandag komen exact terug');
  assertEq(cal.hoursPerDay, 16, 'de afgeleide netto uren komen terug');
  assertEq(cal.workTime!.byWeekday[5], [{ start: 360, end: 840 }],
    'vrijdag komt terug als de korte dag die het bestand in ging');
  assertEq(cal.workTime!.byWeekday[4], [{ start: 360, end: 840 }, { start: 840, end: 1320 }],
    'donderdag houdt zijn twee banden');
  assertEq(cal.workDays, [1, 2, 3, 4, 5], 'de werkdagen komen terug');
  assertEq(cal.workTime!.byWeekday[6], [], 'een niet-werkdag blijft niet-werkend');
});

test('IFC: één gewone band per dag overleeft — ook op een kalender zonder gebruikers (A2-fix)', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  await call('planner_update_calendar', { calendars: [{ id: projId, workTime: bands8to16() }] });
  addTask('Hele dagen', 2);
  assert(!!calById(projId)!.workTime, 'testvoorwaarde: in de store is het een uur-kalender');

  const terug = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly')));
  assert(!!terug.calendar.workTime, 'de uur-modus overleeft dankzij de uur-taken in hetzelfde bestand');
  assertEq(terug.calendar.workTime!.byWeekday[1], [{ start: 480, end: 960 }], 'de band komt exact terug');

  reset();
  const res = await call('planner_update_calendar', {
    calendars: [{ id: 'los', create: true, name: 'Ongebruikte uurkalender', workTime: bands8to16(), holidays: [] }],
  });
  const losId = okData(res).calendars[0].id;
  assert(!!calById(losId)!.workTime, 'testvoorwaarde: in de store is het een uur-kalender');
  const zonderGebruikers = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly')));
  const ongebruikt = zonderGebruikers.resourceCalendars?.find((c) => c.name === 'Ongebruikte uurkalender');
  assert(!!ongebruikt, 'een bibliotheek-kalender ZONDER taak/resource komt sinds de A2-fix terug uit IFC');
  assertEq(ongebruikt!.workTime?.byWeekday[1], [{ start: 480, end: 960 }], 'ongebruikte kalender behoudt ook zijn uurbanden');
  const description = toolDef('planner_update_calendar').description;
  assert(!/does NOT survive save\+reload/.test(description), 'geen achterhaalde waarschuwing voor kalenderverlies');

  const t = addTask('Werk op de ploegenkalender', 2);
  S().updateTask(t, { calendarId: losId });
  const metGebruiker = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly')));
  const los = metGebruiker.resourceCalendars?.find((c) => c.name === 'Ongebruikte uurkalender');
  assert(!!los, 'met een taak eraan komt de bibliotheek-kalender wél terug');
  assertEq(los!.workTime?.byWeekday[1], [{ start: 480, end: 960 }], 'inclusief de uurbanden');
});

function twoBlocks(a: [number, number], b: [number, number]): WorkTimeBands {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  for (const d of [1, 2, 3, 4, 5] as const) byWeekday[d] = [{ start: a[0], end: a[1] }, { start: b[0], end: b[1] }];
  return { byWeekday };
}

test('uur→dag met pauzeduur 30 ⇒ pauze 12:00, netto 8,5 h (07–11 + 11:30–16)', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  S().updateCalendar(projId, { workTime: twoBlocks([420, 660], [690, 960]), workStartHour: 7, workEndHour: 16,
    hoursPerDay: 8.5, workDays: [1, 2, 3, 4, 5], simpleBreakStartMinute: undefined, simpleBreakDurationMinutes: undefined });
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workTime: null, simpleBreakDurationMinutes: 30 }] });
  okData(res);
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(projId)!;
  assertEq({ workTime: cal.workTime, start: cal.simpleBreakStartMinute, duration: cal.simpleBreakDurationMinutes, hpd: cal.hoursPerDay },
    { workTime: undefined, start: 720, duration: 30, hpd: 8.5 }, 'dagkalender met pauze 12:00 van 30 min, netto 8,5 h');
});

test('uur→dag met pauzeduur 30 bij 05–09 + 09:30–11 ⇒ zachte weigering, kalender ongewijzigd', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  S().updateCalendar(projId, { workTime: twoBlocks([300, 540], [570, 660]), workStartHour: 5, workEndHour: 11,
    hoursPerDay: 5.5, workDays: [1, 2, 3, 4, 5], simpleBreakStartMinute: undefined, simpleBreakDurationMinutes: undefined });
  const before = JSON.stringify(calById(projId));
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workTime: null, simpleBreakDurationMinutes: 30 }] });
  const reason = soleRejection(res);
  assert(/simpleBreakStartMinute/.test(reason), `de melding noemt simpleBreakStartMinute: ${reason}`);
  assertEq(JSON.stringify(calById(projId)), before, 'de kalender blijft ongewijzigd');
});

await run();
