// Auditbevinding H5 — EEN KALENDER MOET ÉCHT OVERZETBAAR ZIJN.
//
// `planner_get_calendars` belooft de VOLLEDIGE WorkCalendar-definitie ("genoeg om een kalender in een
// ANDER document te herbouwen") en levert die ook. De schrijfkant kende drie van die velden niet:
// `workTime` (uurbanden), `shift` (ploeg) en `generation` — die laatste onder ANDERE sleutelnamen dan
// de leeskant hem teruggaf. Gevolg: een UURkalender bouwde in het doeldocument stil op als
// DAGkalender, en dat herdefinieert de duur van elke taak eraan (`durationMinutes` telt uitsluitend
// op een uur-kalender, `engine/scheduler/duration.ts`).
//
// Dit bestand pint de reparatie vast:
//   1. leesvorm → schrijfkant LETTERLIJK: uurkalender uit doc A in doc B herbouwen, veld voor veld identiek
//   2. hetzelfde op het UPDATE-pad: de projectkalender van doc B gelijkmaken aan die van doc A
//   3. ongeldige uurbanden ⇒ zachte weigering + kalender ONAANGEROERD (geen half toegepaste kalender)
//   4. dag→uur ⇒ de gewijzigde effectieve duur staat in de respons (nooit stil)
//   5. uur→dag (`workTime: null`) ⇒ idem, en de kalender is echt weer dag-modus
//   6. `shift` overleeft het schrijven en is wisbaar
//   7. generation-round-trip: de leesvorm wordt geaccepteerd; `generate` + `generation` is tegenstrijdig;
//      de oude/verkeerde sleutelnamen wijzen de weg
//   8. `holidays` (leesvorm) vervangt exact en combineert met `generation`
//   9. onbekende velden ketsen af; de afgeleide leesvelden komen terug als `ignoredFields`
//  10. ALLES ook via `planner_batch` (de schemapoort + batchStep-pad)
//  11. IFC-round-trip van workTime/shift/generation — het native formaat moet het dragen
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

// Warm-up (zelfde reden als cases-mutate-cal-res.ts): een verse store heeft `calendars: []`.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

registerToolModules([readTools, calendarResourceTools, batchTools]);

// --- helpers -------------------------------------------------------------------------------------

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

/** De leeskant, zoals een AI hem ziet. */
async function readCalendars(): Promise<any> {
  return okData(await call('planner_get_calendars', {}));
}

/** Eén zachte weigering verwachten (en die teruggeven) — het lege-batch-snelpad levert `ok` mét
 *  `itemRejections`, dus dat is de vorm waarin een geweigerd item terugkomt. */
function soleRejection(res: McpToolResult): string {
  const rej = rejections(res);
  assertEq(rej.length, 1, `precies één weigering verwacht, kreeg ${JSON.stringify(rej)}`);
  return rej[0].reason;
}

/** De vergelijkbare KERN van een kalender — vaste sleutelvolgorde, zonder het per-document-`id`
 *  en zonder de afgeleide leesvelden. Dit is wat "identiek overgezet" betekent. */
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

/** Ma-vr 08:00-16:00 (8 netto uur) als uurbanden — de eenvoudigste échte uur-kalender. */
function bands8to16(): WorkTimeBands {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  for (const d of [1, 2, 3, 4, 5] as const) byWeekday[d] = [{ start: 480, end: 960 }];
  return { byWeekday };
}

/** Blad-taak met een expliciete dag- of uurduur. */
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

// =================================================================================================
// 1) LETTERLIJKE OVERDRACHT — get_calendars → update_calendar (create) in een TWEEDE document
// =================================================================================================
test('uurkalender uit doc A letterlijk terugschrijven in doc B ⇒ veld voor veld identiek', async () => {
  reset();
  // Doc A: een echte ploegenkalender in de bibliotheek, precies zoals de kalenderdialoog hem maakt.
  const preset = shiftPresetPatch('two-shift');
  const srcId = S().addCalendar({
    name: 'Ploegen 2x8',
    description: 'dag + avond',
    workDays: preset.workDays,
    workStartHour: preset.workStartHour,
    workEndHour: preset.workEndHour,
    hoursPerDay: preset.hoursPerDay,
    holidays: [{ name: 'Vorstverlet', startDate: '2026-01-12', endDate: '2026-01-14' }],
    // Herkomst-metadata erbij: dan dekt deze test óók de generation-round-trip over het CREATE-pad
    // (de nieuwe kalender start uit de app-default, die zijn EIGEN NL-herkomst draagt).
    generation: { ruleSetId: 'NL', region: undefined, breakChoice: 'noord', generatedFromYear: 2025, generatedToYear: 2028 },
    workTime: preset.workTime,
    shift: preset.shift,
  } as Omit<WorkCalendar, 'id'>);

  const read = await readCalendars();
  const src = read.calendars.find((c: any) => c.id === srcId);
  assert(!!src, 'de leeskant geeft de nieuwe kalender terug');
  assert(!!src.workTime && src.shift === 'SECOND', 'de leeskant draagt workTime én shift');
  assertEq(src.generation.breakChoice, 'noord', 'de leeskant draagt de herkomst in de LEESVORM');

  // Doc B: leeg tweede document.
  store.getState().newDocument();
  assertEq(S().calendars.some((c) => c.id === srcId), false, 'doc B kent dit kalender-id nog niet');

  // DE ECHTE TEST: de lezing ONGEWIJZIGD doorgeven aan de schrijfkant (alleen `create` erbij).
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

  // Ook de lezing IN doc B moet weer identiek zijn — de round-trip sluit.
  const readB = await readCalendars();
  assertEq(calShape(readB.calendars.find((c: any) => c.id === row.id)), calShape(src as WorkCalendar),
    'de lezing in doc B is gelijk aan de lezing in doc A');
});

// =================================================================================================
// 2) UPDATE-PAD — de PROJECTkalender van een ander document gelijkmaken
// =================================================================================================
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

  // Schrijven op het id uit `projectDefaultId` van doc B (dat is de gedocumenteerde route).
  const res = await call('planner_update_calendar', { calendars: [{ ...src, id: targetId }] });
  const row = okData(res).calendars[0];
  assertEq(rejections(res), [], 'geen weigeringen');
  assertEq(row.created, false, 'geen create: de projectkalender bestond al');
  assertEq(row.modeChangedFrom, 'day', 'de omschakeling dag→uur wordt gemeld');
  assertEq(row.mode, 'hour', 'de projectkalender van doc B is nu uur-modus');
  assertEq(calShape(calById(targetId)), calShape(src as WorkCalendar), 'inhoudelijk identiek aan doc A');
  // De gedenormaliseerde cache (`s.calendar`) moet meelopen — anders rekent de solver op de oude vorm.
  assertEq(S().calendar.workTime, calById(targetId)!.workTime, 'de projectkalender-cache volgt de entry');
});

// =================================================================================================
// 3) ONGELDIGE UURBANDEN — zachte weigering + kalender ONAANGEROERD
// =================================================================================================
test('ongeldige uurbanden ⇒ weigering met uitleg; de kalender blijft onaangeroerd', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();

  const week = (over: Partial<Record<string, unknown>>): unknown => ({
    byWeekday: { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], ...over },
  });

  const gevallen: { naam: string; workTime: unknown; verwacht: RegExp }[] = [
    { naam: 'eind vóór begin', workTime: week({ '1': [{ start: 960, end: 480 }] }), verwacht: /ligt niet ná|over middernacht telt DOOR|telt DOOR/i },
    { naam: 'gelijk begin en eind', workTime: week({ '1': [{ start: 480, end: 480 }] }), verwacht: /ligt niet ná/i },
    { naam: 'overlappende banden', workTime: week({ '2': [{ start: 480, end: 720 }, { start: 600, end: 960 }] }), verwacht: /overlappen of staan niet op volgorde/i },
    { naam: 'start buiten de dag', workTime: week({ '3': [{ start: 1500, end: 1600 }] }), verwacht: /valt buiten de dag/i },
    { naam: 'eind voorbij 2880', workTime: week({ '4': [{ start: 1400, end: 3000 }] }), verwacht: /overschrijdt 2880/i },
    { naam: 'ontbrekende weekdag', workTime: { byWeekday: { '1': [{ start: 480, end: 960 }] } }, verwacht: /moet ALLE weekdagen/i },
    { naam: 'verkeerde dagsleutel', workTime: week({ '8': [] }), verwacht: /onbekende dagsleutel/i },
    { naam: 'niet-numerieke band', workTime: week({ '1': [{ start: '08:00', end: '16:00' }] }), verwacht: /moeten getallen zijn in MINUTEN/i },
    { naam: 'onbekend bandveld', workTime: week({ '1': [{ start: 480, end: 960, pauze: 30 }] }), verwacht: /onbekend veld `workTime.byWeekday.1\[\].pauze`/i },
    { naam: 'wrap over de volgende dag heen', workTime: week({ '1': [{ start: 1320, end: 1900 }], '2': [{ start: 400, end: 960 }] }), verwacht: /overlapt de eerste band van dag 2/i },
    { naam: 'workTime spreekt workDays tegen', workTime: week({ '1': [{ start: 480, end: 960 }] }), verwacht: /spreekt `workTime` tegen/i },
  ];

  for (const g of gevallen) {
    const voor = JSON.stringify(S().calendars);
    const undoVoor = S().undoStack.length;
    const item: Record<string, unknown> = { id: projId, workTime: g.workTime };
    if (g.naam === 'workTime spreekt workDays tegen') item.workDays = [1, 2, 3, 4, 5];
    const res = await call('planner_update_calendar', { calendars: [item] });
    const reden = soleRejection(res);
    assert(g.verwacht.test(reden), `[${g.naam}] onbruikbare weigeringsreden: ${reden}`);
    assertEq(JSON.stringify(S().calendars), voor, `[${g.naam}] de kalender is ONAANGEROERD gebleven`);
    assertEq(S().undoStack.length, undoVoor, `[${g.naam}] geen undo-stap (geen transactie geopend)`);
    assertEq(okData(res).calendars, [], `[${g.naam}] geen enkele kalender gewijzigd`);
  }
});

test('een uur-kalender zónder één band ⇒ harde fout + VOLLEDIGE rollback (geen halve kalender)', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  addTask('Iets', 3);
  const voor = JSON.stringify(S().calendars);
  const undoVoor = S().undoStack.length;
  const leeg = { byWeekday: { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [] } };
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workTime: leeg }] });
  // Banden op geen enkele dag ⇒ afgeleide `workDays` is leeg ⇒ de eind-runCPM van de transactie
  // weigert, en die weigering rolt de HELE call terug (transactie-invariant). Dat is precies goed:
  // een kalender zonder werktijd komt er niet half in. De boodschap moet wel uitlegbaar zijn.
  assertEq(res.ok, false, 'de call faalt hard i.p.v. een onbruikbare kalender te committen');
  assert(/geen werkdagen/i.test((res as any).error), `begrijpelijke fout: ${(res as any).error}`);
  assertEq(JSON.stringify(S().calendars), voor, 'de kalender is volledig teruggerold');
  assertEq(S().undoStack.length, undoVoor, 'geen achtergebleven undo-stap');
});

test('een item met alleen afgeleide leesvelden is een no-op ⇒ zachte weigering die de velden noemt', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, isProjectDefault: true, usedByTasks: 3 }] });
  const reden = soleRejection(res);
  assert(/geen wijzigingen opgegeven/.test(reden) && /workTime/.test(reden) && /holidays/.test(reden),
    `de weigering somt de bruikbare velden op: ${reden}`);
});

// =================================================================================================
// 4) DAG → UUR — de taakeenheid en hoeveelheid blijven behouden
// =================================================================================================
test('dag→uur op de projectkalender ⇒ native taakduren blijven behouden', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  // Een expliciete urentaak blijft 240 minuten; de verouderde scheduleDuration-afleiding bepaalt
  // haar identiteit niet meer en wordt door de kalenderwissel niet als invoer hergebruikt.
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
  assert(/native hoeveelheid.*blijven behouden/.test(w), `de waarschuwing bevestigt duurbehoud: ${w}`);
  assert(!/EFFECTIEVE DUUR GEWIJZIGD/.test(w), `de waarschuwing claimt geen duurconversie: ${w}`);
  const hourTask = S().tasks.find((t) => t.id === halve)!;
  assertEq(hourTask.time.durationUnit, 'hours', 'urentaak blijft uren');
  assertEq(hourTask.time.durationMinutes, 240, 'urentaak blijft exact 240 minuten');
  const dayTask = S().tasks.find((t) => t.id === gewoon)!;
  assertEq(dayTask.time.durationUnit, 'days', 'dagtaak blijft dagen');
  assertEq(dayTask.time.scheduleDuration, 3, 'dagtaak blijft exact drie dagen');
  // Taken zónder eigen calendarId hangen aan de projectkalender — dat is precies waarom dit telt.
  assertEq(S().tasks.find((t) => t.id === halve)!.calendarId, undefined, 'de taak had geen eigen kalender');
  assertEq(calById(projId)!.workDays, [1, 2, 3, 4, 5], 'workDays is uit de banden afgeleid');
  assertEq(calById(projId)!.hoursPerDay, 8, 'hoursPerDay is uit de banden afgeleid');
});

// =================================================================================================
// 5) UUR → DAG — `workTime: null`, zonder dagfallback of stille conversie
// =================================================================================================
test('uur→dag met bestaande urentaak ⇒ transactie blokkeert zonder dagfallback', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  S().updateCalendar(projId, { workTime: bands8to16(), hoursPerDay: 8, workDays: [1, 2, 3, 4, 5] });
  const halve = addTask('Halve dag werk', 2, 240);

  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workTime: null }] });
  assert(!res.ok, 'banden verwijderen bij een bestaande urentaak hoort te worden geblokkeerd');
  assert(!res.ok && /concrete werkblokken/.test(res.error), `fout legt de vereiste uit: ${res.ok ? '' : res.error}`);
  const hourTask = S().tasks.find((t) => t.id === halve)!;
  assertEq(hourTask.time.durationUnit, 'hours', 'urentaak blijft na blokkering uren');
  assertEq(hourTask.time.durationMinutes, 240, 'exacte minuten blijven na blokkering behouden');
  assert('workTime' in (calById(projId) as object), 'rollback behoudt de concrete werkblokken');
  assertEq(S().calendar.workTime, calById(projId)!.workTime, 'projectkalender-cache blijft consistent');
});

// =================================================================================================
// 6) SHIFT — schrijfbaar en wisbaar
// =================================================================================================
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
  assert(/onbekende `shift` 'NIGHT'.*FIRST, SECOND, THIRD, USERDEFINED/s.test(soleRejection(fout)),
    'een onbekende ploeg wordt geweigerd MÉT de geldige waarden');
});

// =================================================================================================
// 7) GENERATION — de naamdrift is opgelost: de schrijfkant spreekt de leesvorm
// =================================================================================================
test('generation: de leesvorm is schrijfbaar, wisbaar, en de generator-sleutels wijzen de weg', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();

  // 7a. De leesvorm LETTERLIJK terugschrijven.
  const gen = { ruleSetId: 'DE', region: 'Bayern', breakChoice: 'zuid', generatedFromYear: 2025, generatedToYear: 2028 };
  const ok = await call('planner_update_calendar', {
    calendars: [{ id: projId, generation: gen, holidays: [{ name: 'Neujahr', startDate: '2026-01-01', endDate: '2026-01-01' }] }],
  });
  assertEq(rejections(ok), [], 'de leesvorm wordt geaccepteerd');
  assertEq(calById(projId)!.generation, gen, 'de herkomst staat letterlijk in de store');
  assertEq(okData(ok).calendars[0].becameLiteral, false, 'met een expliciete herkomst wordt de kalender niet letterlijk');
  assertEq((await readCalendars()).calendars.find((c: any) => c.id === projId).generation, gen,
    'lezen levert exact hetzelfde object op — de round-trip sluit');

  // 7b. Wissen.
  const weg = await call('planner_update_calendar', { calendars: [{ id: projId, generation: null }] });
  assertEq(rejections(weg), [], 'null wist de herkomst');
  assertEq('generation' in (calById(projId) as object), false, '`generation` is echt verwijderd');

  // 7c. De GENERATOR-sleutels in `generation` wijzen naar het juiste veld (dit was de val: de
  //     leeskant gaf `ruleSetId`, de schrijfkant wilde `country` — en dat was een kale TypeError).
  const drift = await call('planner_update_calendar', {
    calendars: [{ id: projId, generation: { country: 'NL', bouwvak: 'noord', generatedFromYear: 2025, generatedToYear: 2028 } }],
  });
  const reden = soleRejection(drift);
  assert(/`generation.country` bestaat niet/.test(reden) && /ruleSetId/.test(reden),
    `de weigering wijst naar de juiste sleutel: ${reden}`);

  // 7d. `generate` (actie) en `generation` (metadata) samen is tegenstrijdig.
  const beide = await call('planner_update_calendar', {
    calendars: [{ id: projId, generate: { country: 'NL', bouwvak: 'geen' }, generation: { ruleSetId: 'NL', generatedFromYear: 2025, generatedToYear: 2028 } }],
  });
  assert(/`generate` OF `generation`/.test(soleRejection(beide)), 'de tegenstrijdigheid wordt uitgelegd');

  // 7e. Onzin-jaren en een onbekende ruleSetId ketsen af.
  const jaren = await call('planner_update_calendar', {
    calendars: [{ id: projId, generation: { ruleSetId: 'NL', generatedFromYear: 2030, generatedToYear: 2025 } }],
  });
  assert(/ligt vóór `generatedFromYear`/.test(soleRejection(jaren)), 'omgekeerde jaarspanne geweigerd');
  const land = await call('planner_update_calendar', {
    calendars: [{ id: projId, generation: { ruleSetId: 'none', generatedFromYear: 2025, generatedToYear: 2028 } }],
  });
  assert(/onbekende `generation.ruleSetId` 'none'/.test(soleRejection(land)), "'none' bestaat niet in de leesvorm");
});

// =================================================================================================
// 8) HOLIDAYS (leesvorm) — vervangt EXACT, geen stille unie met de app-default
// =================================================================================================
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

  // Leegmaken mag (dat is de betekenis van een lege lijst in de LEESvorm) — anders dan bij rawHolidays.
  const leeg = await call('planner_update_calendar', { calendars: [{ id: projId, holidays: [] }] });
  assertEq(rejections(leeg), [], 'een lege leeslijst is een geldige opdracht');
  assertEq(calById(projId)!.holidays, [], 'alle feestdagen weg');

  // Conflicten.
  for (const [item, patroon] of [
    [{ id: projId, holidays: lijst, rawHolidays: lijst }, /`holidays` OF `rawHolidays`/],
    [{ id: projId, holidays: lijst, holidaysMode: 'replace' }, /`holidaysMode` hoort bij `rawHolidays`/],
    [{ id: projId, holidays: lijst, generate: { country: 'NL', bouwvak: 'geen' } }, /`holidays` OF `generate`/],
    [{ id: projId, holidays: [{ name: '', startDate: '2026-01-01', endDate: '2026-01-01' }] }, /niet-lege `name`/],
    [{ id: projId, holidays: [{ name: 'X', startDate: '2026-01-05', endDate: '2026-01-01' }] }, /ligt vóór startDate/],
  ] as [Record<string, unknown>, RegExp][]) {
    const bad = await call('planner_update_calendar', { calendars: [item] });
    assert(patroon.test(soleRejection(bad)), `verwacht ${patroon}, kreeg: ${soleRejection(bad)}`);
  }
});

// =================================================================================================
// 9) ONBEKENDE VELDEN — ketsen af mét de toegestane lijst (K7-patroon)
// =================================================================================================
test('een onbekend kalenderveld wordt geweigerd, niet stil weggegooid', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const res = await call('planner_update_calendar', {
    calendars: [{ id: projId, name: 'Nieuw', workingHours: 8 }],
  });
  const reden = soleRejection(res);
  assert(/onbekend veld `workingHours`/.test(reden), `noemt het veld: ${reden}`);
  assert(/workTime/.test(reden) && /generation/.test(reden), `noemt de toegestane lijst: ${reden}`);
  assertEq(calById(projId)!.name !== 'Nieuw', true, 'de rest van het item is NIET half toegepast');
});

// =================================================================================================
// 10) VIA planner_batch — de schemapoort en het batchStep-pad doen exact hetzelfde
// =================================================================================================
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
  // De leesstap in dezelfde batch ziet hem al staan.
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
  assert(/stap 1 \(planner_update_calendar\)/.test(rej[0].reason), 'de weigering noemt de stap');
  assert(/ALLE weekdagen|ligt niet ná/.test(rej[0].reason), `inhoudelijke reden: ${rej[0].reason}`);
  assertEq(JSON.stringify(S().calendars), voor, 'de kalender is onaangeroerd');
  assertEq(S().project.name, 'Loopt door', 'de volgende stap is gewoon uitgevoerd');
});

// =================================================================================================
// 11) IFC-ROUND-TRIP — IFC is het native formaat; wat de bridge schrijft moet het dragen
// =================================================================================================
test('IFC-round-trip: generation en shift overleven; workTime kent een gedocumenteerde beperking', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  // Een uur-kalender die AFWIJKT van het enkelvoudige dagpatroon (twee banden) — alleen dan
  // promoveert de reader hem terug naar uur-modus (subdayIo, discriminator a/b).
  // Vrijdag krijgt bewust een AFWIJKENDE (korte) dag — zo wordt zichtbaar wat IFC wél en niet draagt.
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

  const ifc = writeIFC(buildWriteIFCInput(S()));
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
  // GEDOCUMENTEERDE BEPERKING (ifcWriter §7.1): IFC draagt ÉÉN recurrence voor alle DayComponent-dagen,
  // dus de writer schrijft de banden van de EERSTE werkdag en de reader legt ze op élke werkdag.
  // Per-weekdag VERSCHILLENDE banden overleven het native formaat dus NIET — vrijdag ging als korte
  // dag het bestand in en komt terug als een kopie van maandag. Dit pint die bekende vlakslag vast
  // zodat niemand hem stil verandert (en zodat de bridge-beschrijvingen eerlijk blijven).
  assertEq(cal.workTime!.byWeekday[5], [{ start: 360, end: 840 }, { start: 840, end: 1320 }],
    'IFC slaat per-weekdag-verschillen plat tot het patroon van de eerste werkdag (vrijdag ≠ origineel)');
  assertEq(cal.workTime!.byWeekday[6], [], 'een niet-werkdag blijft niet-werkend');
});

test('IFC: één gewone band per dag overleeft — ook op een kalender zonder gebruikers (A2-fix)', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  await call('planner_update_calendar', { calendars: [{ id: projId, workTime: bands8to16() }] });
  addTask('Hele dagen', 2); // zelfs ZONDER sub-dag-duur
  assert(!!calById(projId)!.workTime, 'testvoorwaarde: in de store is het een uur-kalender');

  // De IFC-reader promoveert naar uur-modus bij een echte afwijking van het enkelvoudige dagpatroon
  // (>1 band of een wrap) óf bij een sub-dag-signaal elders in het bestand (`subdayIo`,
  // discriminator a/b/c). Eén band 08:00-16:00 wijkt niet af — maar de taken van een uur-kalender
  // worden mét tijd-van-de-dag weggeschreven, en dát is signaal (c). Dus: overleeft.
  const terug = readIFC(writeIFC(buildWriteIFCInput(S())));
  assert(!!terug.calendar.workTime, 'de uur-modus overleeft dankzij de uur-taken in hetzelfde bestand');
  assertEq(terug.calendar.workTime!.byWeekday[1], [{ start: 480, end: 960 }], 'de band komt exact terug');

  // OPGEHEVEN BEPERKING (B1.1, issue #19 — de "A2-fix" in `ifcReader.extractCalendarLibrary`). Deze
  // test pinde tot dan het OMGEKEERDE: de reader bouwde de bibliotheek uitsluitend uit
  // IFCRELASSIGNSTOCONTROL-relaties, dus een kalender zonder taak én zonder resource werd wél
  // geschreven maar niet teruggelezen — stil verlies, precies in het overzet-scenario ("maak de
  // kalender aan in het doeldocument"). De bedrijfsbibliotheken hadden daar zelf last van (een
  // gepromote kalender verloor zo zijn `libraryOrigin`-stempel), en de reader vangt sindsdien álle
  // overige IFCWORKCALENDAR-entiteiten op. Een ongebruikte kalender overleeft dus nu wél — dát pinnen
  // we hier vast, zodat de oude beperking niet ongemerkt terugkeert.
  reset();
  const res = await call('planner_update_calendar', {
    calendars: [{ id: 'los', create: true, name: 'Ongebruikte uurkalender', workTime: bands8to16(), holidays: [] }],
  });
  const losId = okData(res).calendars[0].id;
  assert(!!calById(losId)!.workTime, 'testvoorwaarde: in de store is het een uur-kalender');
  const zonderGebruikers = readIFC(writeIFC(buildWriteIFCInput(S())));
  const ongebruikt = zonderGebruikers.resourceCalendars?.find((c) => c.name === 'Ongebruikte uurkalender');
  assert(!!ongebruikt, 'een bibliotheek-kalender ZONDER taak/resource komt sinds de A2-fix terug uit IFC');

  // MÉT een taak eraan overleeft hij volledig — inclusief de uurbanden.
  const t = addTask('Werk op de ploegenkalender', 2);
  S().updateTask(t, { calendarId: losId });
  const metGebruiker = readIFC(writeIFC(buildWriteIFCInput(S())));
  const los = metGebruiker.resourceCalendars?.find((c) => c.name === 'Ongebruikte uurkalender');
  assert(!!los, 'met een taak eraan komt de bibliotheek-kalender wél terug');
  assertEq(los!.workTime?.byWeekday[1], [{ start: 480, end: 960 }], 'inclusief de uurbanden');
});

await run();
