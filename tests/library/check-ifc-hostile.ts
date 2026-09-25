// Vloot-regressiebatterij B5/B6 (fixes A1 t/m A6). Dekt de zes fuzz-bevindingen dicht:
//   A1 — quote-bewuste STEP-parsing: namen/JSON met ");" corrumperen het bestand niet meer.
//   A2 — ongebruikte bibliotheekkalender (mét/zonder stempel) overleeft de round-trip.
//   A3 — applyCalendarUpdate/applyResourceUpdate gooien i.p.v. stil te corrumperen als de bron mist.
//   A4 — diffFields is volgorde-ongevoelig voor array-velden (gehusselde holidays ⇒ up-to-date).
//   A5 — findCopyByOrigin guardt tegen falsy sleutels (geen vals undefined===undefined-match).
//   A6 — dubbele LibraryOrigin-props: EERSTE geldige wint op ZOWEL kalender- als resourcepad.
// Headless op Node (esbuild-patroon van de zusterchecks). Exitcode = poort.
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { writePoolIFC, readPoolIFC } from '@/services/library/libraryIfc';
import {
  findCopyByOrigin, applyCalendarUpdate, applyResourceUpdate,
  diffCalendarVsPool, makeOrigin,
} from '@/services/library/libraryOps';
import { createDefaultProject } from '@/state/slices/projectSlice';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { ImportResult } from '@/services/importTypes';
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Resource } from '@/types/resource';
import type { CompanyPool } from '@/types/library';

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

// ── Fixture-bouwers ────────────────────────────────────────────────────────────────────────────
function baseCalendar(overrides: Partial<WorkCalendar> = {}): WorkCalendar {
  return {
    id: 'cal-default', name: 'Standaard', description: '',
    workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 9,
    holidays: [], ...overrides,
  };
}
function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj1', name: 'Testproject', description: '', startDate: '2026-01-01', endDate: '2026-06-01',
    calendarId: 'cal-default', createdAt: '2026-01-01T00:00:00.000Z', modifiedAt: '2026-01-01T00:00:00.000Z',
    author: 'Tester', company: 'TestCo', ...overrides,
  } as Project;
}
function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1', name: 'Taak 1', description: '', type: 'CONSTRUCTION', taskType: 'CONSTRUCTION',
    wbsCode: '1', childIds: [], parentId: undefined, isMilestone: false,
    time: {
      durationType: 'WORKTIME', scheduleDuration: 5, scheduleStart: '2026-01-05', scheduleFinish: '2026-01-10',
      earlyStart: '2026-01-05', earlyFinish: '2026-01-10', lateStart: '2026-01-05', lateFinish: '2026-01-10',
      totalFloat: 0, freeFloat: 0, isCritical: true, completion: 0,
    },
    predecessors: [], status: 'NOT_STARTED', priority: 500, ...overrides,
  } as unknown as Task;
}
function minimalFixture(overrides: Partial<ImportResult> = {}): ImportResult {
  return {
    project: baseProject(), calendar: baseCalendar(), tasks: [baseTask()], sequences: [],
    resources: [], assignments: [], activityCodeTypes: [], customFieldDefs: [],
    resourceCalendars: [], baselines: [], activeBaselineId: null, libraryPool: undefined, ...overrides,
  };
}
function res(id: string, name: string, calendarId?: string): Resource {
  return { id, name, type: 'LABOR', description: '', maxUnits: 1, calendarId };
}
function samplePool(overrides: Partial<CompanyPool> = {}): CompanyPool {
  return {
    companyId: 'c1', companyName: 'Aannemer BV', poolVersion: 3, modifiedAt: '2026-07-20T09:30:00.000Z',
    calendars: [], resources: [], ...overrides,
  };
}

// ── A1: quote-bewuste STEP-parsing (project-IFC + pool-IFC) ──────────────────────────────────────
// Hostile-content met de STEP-gevoelige `);`-reeks in taaknaam, resourcenaam, companyName én in een
// libraryOrigin-stempel (companyId). Vóór de fix knipte de entity-regex af op de eerste `);` binnen
// de string en corrumpeerde het hele bestand (verkeerde velden / verdwenen stempels).
{
  const hostile = `Firma AB);IFCWALL('injected'`;
  const cal = baseCalendar({ libraryOrigin: { companyId: hostile, libraryItemId: 'lib-x', poolVersion: 3 } });
  const resource: Resource = {
    ...res('r1', hostile), description: hostile,
    libraryOrigin: { companyId: 'c1', libraryItemId: hostile, poolVersion: 5 },
  };
  const fixture = minimalFixture({
    calendar: cal, resources: [resource], tasks: [baseTask({ name: hostile })],
    project: baseProject({ companyId: hostile, companyName: hostile }),
  });
  const back = readIFC(writeIFC(fixture));
  assert(back.tasks.length === 1 && back.tasks[0].name === hostile, 'A1: taaknaam met ");" overleeft project-round-trip');
  assert(back.resources.length === 1 && back.resources[0].name === hostile, 'A1: resourcenaam met ");" overleeft');
  assert(back.resources[0]?.libraryOrigin?.libraryItemId === hostile, 'A1: resource-stempel (libraryItemId) met ");" overleeft');
  assert(back.calendar.libraryOrigin?.companyId === hostile, 'A1: kalender-stempel (companyId) met ");" overleeft');
  assert(back.project.companyId === hostile, 'A1: project.companyId met ");" overleeft');
  assert(back.project.companyName === hostile, 'A1: project.companyName met ");" overleeft');
}
// A1 pool-export→import: pool-JSON met "();" in een resourcenaam mag readPoolIFC niet laten falen
// met "bevat geen resourcebibliotheek" (de blob eindigt vroegtijdig zonder quote-bewuste parsing).
{
  const pool = samplePool({ poolVersion: 1, resources: [res('r1', 'Kraan (); DROP TABLE')] });
  let back: CompanyPool | undefined;
  let threw = false;
  try { back = await readPoolIFC(writePoolIFC(pool)); } catch { threw = true; }
  assert(!threw, 'A1: pool met "();" in resourcenaam leest zonder te gooien');
  assert(back?.resources.length === 1 && back.resources[0].name === 'Kraan (); DROP TABLE', 'A1: pool-resourcenaam met "();" komt exact terug');
  assert(back?.companyName === 'Aannemer BV', 'A1: pool-metadata intact naast hostile resourcenaam');
}

// ── A2: ongebruikte bibliotheekkalender (mét en zonder stempel) overleeft round-trip ─────────────
{
  const stamped = baseCalendar({
    id: 'lib-cal-stamp', name: 'Ongebruikt met stempel',
    libraryOrigin: { companyId: 'c1', libraryItemId: 'lib-item-orphan', poolVersion: 1 },
  });
  const bare = baseCalendar({ id: 'lib-cal-bare', name: 'Ongebruikt zonder stempel' });
  // Geen enkele resource/taak wijst naar deze kalenders — het "voeg toe vóór toewijzing"-patroon.
  const fixture = minimalFixture({ resourceCalendars: [stamped, bare] });
  const back = readIFC(writeIFC(fixture));
  const backStamped = back.resourceCalendars?.find(c => c.name === 'Ongebruikt met stempel');
  const backBare = back.resourceCalendars?.find(c => c.name === 'Ongebruikt zonder stempel');
  assert(!!backStamped, 'A2: ongebruikte kalender MET stempel komt terug (was stil verlies)');
  assert(backStamped?.libraryOrigin?.companyId === 'c1' && backStamped?.libraryOrigin?.libraryItemId === 'lib-item-orphan' && backStamped?.libraryOrigin?.poolVersion === 1, 'A2: libraryOrigin-stempel van de ongebruikte kalender behouden');
  assert(!!backBare, 'A2: ongebruikte kalender ZONDER stempel komt ook terug');
  // 2e ronde stabiel (semantisch).
  const back2 = readIFC(writeIFC(back));
  assert(back2.resourceCalendars?.some(c => c.name === 'Ongebruikt met stempel') === true, 'A2: ongebruikte kalender stabiel over 2e round-trip');
}

// ── A3: applyCalendarUpdate/applyResourceUpdate gooien als de bron mist (geen stille corruptie) ──
{
  const projectCal: WorkCalendar = { ...baseCalendar({ id: 'local-cal', name: 'Lokale kalender' }), libraryOrigin: { companyId: 'c1', libraryItemId: 'weg-uit-pool', poolVersion: 2 } };
  const poolZonder = samplePool({ calendars: [], resources: [] }); // origineel bestaat niet meer
  let threwCal = false;
  try { applyCalendarUpdate(projectCal, poolZonder); } catch (e) {
    threwCal = e instanceof Error && (e as Error).message.includes('Lokale kalender');
  }
  assert(threwCal, 'A3: applyCalendarUpdate gooit met kalendernaam als pool-origineel ontbreekt');

  const projectRes: Resource = { ...res('local-r', 'Lokale resource'), libraryOrigin: { companyId: 'c1', libraryItemId: 'weg-uit-pool', poolVersion: 2 } };
  let threwRes = false;
  try { applyResourceUpdate(projectRes, poolZonder); } catch (e) {
    threwRes = e instanceof Error && (e as Error).message.includes('Lokale resource');
  }
  assert(threwRes, 'A3: applyResourceUpdate gooit met resourcenaam als pool-origineel ontbreekt');
}

// ── A4: diffFields is volgorde-ongevoelig voor array-velden (gehusselde holidays ⇒ up-to-date) ──
{
  const holidaysA = [
    { name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-26' },
    { name: 'Nieuwjaar', startDate: '2026-01-01', endDate: '2026-01-01' },
    { name: 'Pasen', startDate: '2026-04-05', endDate: '2026-04-06' },
  ];
  const holidaysShuffled = [holidaysA[2], holidaysA[0], holidaysA[1]]; // zelfde set, andere volgorde
  const poolCal = baseCalendar({ id: 'pcal', name: 'Ploeg', holidays: holidaysA });
  const pool = samplePool({ calendars: [poolCal] });
  const projectCal: WorkCalendar = { ...baseCalendar({ id: 'local', name: 'Ploeg', holidays: holidaysShuffled }), libraryOrigin: makeOrigin(pool, 'pcal') };
  assert(diffCalendarVsPool(projectCal, pool).status === 'up-to-date', 'A4: gehusselde holidays ⇒ up-to-date (volgorde niet betekenisvol)');
  // Controle: een ÉCHT ander feestdag-set is nog steeds "changed".
  const projectChanged: WorkCalendar = { ...projectCal, holidays: [holidaysA[0]] };
  const d = diffCalendarVsPool(projectChanged, pool);
  assert(d.status === 'changed' && d.fields.some(f => f.field === 'holidays'), 'A4: écht andere holiday-set blijft "changed"');
  // Muteert de invoer niet.
  assert(projectCal.holidays[0].name === 'Pasen', 'A4: diff muteert de holidays-invoer niet (kopie-sortering)');
}

// ── A5: findCopyByOrigin guardt tegen falsy sleutels ─────────────────────────────────────────────
{
  const zonderStempel: Resource[] = [res('x', 'Geen stempel')]; // libraryOrigin === undefined
  assert(findCopyByOrigin(zonderStempel, '', 'lib') === undefined, 'A5: lege companyId matcht geen item zonder stempel (geen undefined===undefined)');
  assert(findCopyByOrigin(zonderStempel, 'c1', '') === undefined, 'A5: lege libraryItemId matcht geen item zonder stempel');
  assert(findCopyByOrigin(zonderStempel, undefined as unknown as string, undefined as unknown as string) === undefined, 'A5: undefined sleutels matchen geen item zonder stempel');
  // Positieve controle: geldige sleutels vinden nog steeds de kopie.
  const metStempel: Resource[] = [{ ...res('y', 'Met stempel'), libraryOrigin: { companyId: 'c1', libraryItemId: 'lib', poolVersion: 1 } }];
  assert(findCopyByOrigin(metStempel, 'c1', 'lib')?.id === 'y', 'A5: geldige sleutels vinden de kopie nog steeds');
}

// ── A6: dubbele LibraryOrigin-props — EERSTE geldige wint op ZOWEL kalender- als resourcepad ─────
// Bouw een basisbestand met stempels en injecteer een DECOY-LibraryOrigin-prop in het pset, één keer
// vóór en één keer ná de originele prop. Verwachting: de prop die als EERSTE in de pset-reflist staat
// bepaalt de uitkomst — identiek gedrag voor kalender en resource (vóór de fix koos het resourcepad
// de LAATSTE).
{
  function buildBaseIfc(): string {
    const cal = baseCalendar({ libraryOrigin: { companyId: 'ORIG', libraryItemId: 'lib-cal', poolVersion: 2 } });
    const resource: Resource = { ...res('r1', 'Metselaar'), libraryOrigin: { companyId: 'ORIG', libraryItemId: 'lib-res', poolVersion: 2 } };
    return writeIFC(minimalFixture({ calendar: cal, resources: [resource] }));
  }
  // Injecteer een decoy-prop in het pset met de gegeven psetnaam; `before=true` zet de decoy-ref vóór
  // de bestaande refs, anders erachter.
  function injectDecoy(ifc: string, psetName: string, decoyId: number, before: boolean): string {
    const decoyLine = `#${decoyId}=IFCPROPERTYSINGLEVALUE('LibraryOrigin',$,IFCTEXT('{"companyId":"DECOY","libraryItemId":"decoy","poolVersion":99}'),$);\n`;
    const re = new RegExp(`#(\\d+)=IFCPROPERTYSET\\('[^']*',#\\d+,'${psetName}',\\$,\\(([^)]*)\\)\\);`);
    const m = ifc.match(re);
    if (!m) return ifc; // caller assert't apart dat er iets veranderde
    const [full, psetId, refs] = m;
    const newRefs = before ? `#${decoyId},${refs}` : `${refs},#${decoyId}`;
    return ifc.replace(full, decoyLine + `#${psetId}=IFCPROPERTYSET('x',#6,'${psetName}',$,(${newRefs}));`);
  }

  // Kalender: decoy ná origineel ⇒ origineel (ORIG) wint; decoy vóór origineel ⇒ decoy (DECOY) wint.
  {
    const calAfter = readIFC(injectDecoy(buildBaseIfc(), 'OPS_Calendar', 91001, false));
    assert(calAfter.calendar.libraryOrigin?.companyId === 'ORIG', 'A6: kalender — decoy NA origineel ⇒ eerste (ORIG) wint');
    const calBefore = readIFC(injectDecoy(buildBaseIfc(), 'OPS_Calendar', 91002, true));
    assert(calBefore.calendar.libraryOrigin?.companyId === 'DECOY', 'A6: kalender — decoy VÓÓR origineel ⇒ eerste (DECOY) wint');
  }
  // Resource: identiek eerste-wint-gedrag (dit was de bug: resourcepad koos vroeger de laatste).
  {
    const resAfter = readIFC(injectDecoy(buildBaseIfc(), 'OPS_Resource', 92001, false));
    assert(resAfter.resources[0]?.libraryOrigin?.companyId === 'ORIG', 'A6: resource — decoy NA origineel ⇒ eerste (ORIG) wint (was: laatste)');
    const resBefore = readIFC(injectDecoy(buildBaseIfc(), 'OPS_Resource', 92002, true));
    assert(resBefore.resources[0]?.libraryOrigin?.companyId === 'DECOY', 'A6: resource — decoy VÓÓR origineel ⇒ eerste (DECOY) wint');
  }
}

// ── A7 (fix B7): lege kalender-omschrijving komt NIET terug als het letterlijke STEP-null-token `$` ──
// `buildCalendarFromEntity` gebruikte kale `stripQuotes` i.p.v. `ifcSlotText` op de omschrijving:
// `stripQuotes('$')` laat een niet-gequote string ongewijzigd, dus een lege omschrijving (die de
// writer als `$` serialiseert, de STEP-null-conventie) kwam letterlijk als de tekst "$" terug.
{
  const cal = baseCalendar({ description: '' });
  const fixture = minimalFixture({ calendar: cal });
  const back = readIFC(writeIFC(fixture));
  assert(back.calendar.description !== '$', 'A7: lege kalender-omschrijving komt niet terug als letterlijke "$"');

  // Zelfde voor een bibliotheek-/resourcekalender (tweede leespad, `readCalendarLibrary`, gebruikt
  // dezelfde `buildCalendarFromEntity`).
  const libCal = baseCalendar({ id: 'lib-desc-cal', name: 'Bib-kalender zonder omschrijving', description: '' });
  const fixture2 = minimalFixture({ resourceCalendars: [libCal] });
  const back2 = readIFC(writeIFC(fixture2));
  const backLibCal = back2.resourceCalendars?.find(c => c.name === 'Bib-kalender zonder omschrijving');
  assert(!!backLibCal && backLibCal.description !== '$', 'A7: lege omschrijving van een bibliotheekkalender komt niet terug als letterlijke "$"');
}

// --- B1.1: syncedHash round-trippt door IFC (plan-eis 8 / spec §8) ---
{
  const origin = { companyId: 'c1', libraryItemId: 'pr1', poolVersion: 3, syncedHash: 'abc123' };
  const resIn: Resource = { id: 'r1', name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 2, libraryOrigin: origin };
  const ifc = writeIFC({
    project: { ...createDefaultProject(), companyId: 'c1', companyName: 'B' },
    calendar: createDefaultCalendar(), tasks: [], sequences: [],
    resources: [resIn], assignments: [], resourceCalendars: [],
  });
  const back = readIFC(ifc);
  const resOut = back.resources.find(r => r.name === 'Metselaar');
  assert(resOut?.libraryOrigin?.syncedHash === 'abc123', 'syncedHash overleeft de IFC-round-trip');
}
// GO-NA-FIX 2 (critreview 9f9f0aa): kalender-variant — de resource-variant hierboven dekt alleen het
// resource-leespad; de kalender loopt via een apart leespad (`extractCalendarLibraryOrigin`, dat het
// hele libraryOrigin-object teruggeeft), dus die verdient een eigen bewijs.
{
  const calOrigin = { companyId: 'c1', libraryItemId: 'pc1', poolVersion: 5, syncedHash: 'cal-hash-xyz' };
  const calIn: WorkCalendar = { ...baseCalendar({ id: 'lib-cal-hash', name: 'Ploegkalender' }), libraryOrigin: calOrigin };
  const fixture = minimalFixture({ resourceCalendars: [calIn] });
  const back = readIFC(writeIFC(fixture));
  const calOut = back.resourceCalendars?.find(c => c.name === 'Ploegkalender');
  assert(calOut?.libraryOrigin?.syncedHash === 'cal-hash-xyz', 'kalender: syncedHash overleeft de IFC-round-trip');
}

// --- F2 (vloot-fixpakket, issue #19): syncedHash-typecheck in de LibraryOrigin-reader-paden — een
// corrupte/vervalste `syncedHash` die geen string is (bv. een getal, door een handmatig bewerkt of
// door een derde tool geëxporteerd bestand) mag het veld NIET als "syncedHash" doorlaten; de rest van
// de stempel (companyId/libraryItemId/poolVersion) blijft intact ("veilige"/deviated-kant: ontbrekende
// syncedHash ⇒ classifyOnOpen behandelt het item als mogelijk extern bewerkt, nooit als crash-bron). ---
{
  const validOrigin = { companyId: 'c1', libraryItemId: 'pr1', poolVersion: 3, syncedHash: 'abc123' };
  const resIn: Resource = { id: 'r1', name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 2, libraryOrigin: validOrigin };
  const ifc = writeIFC({
    project: { ...createDefaultProject(), companyId: 'c1', companyName: 'B' },
    calendar: createDefaultCalendar(), tasks: [], sequences: [],
    resources: [resIn], assignments: [], resourceCalendars: [],
  });
  const hostileIfc = ifc.replace('"syncedHash":"abc123"', '"syncedHash":12345');
  assert(hostileIfc !== ifc, 'F2 test-fixture: de syncedHash-substring is daadwerkelijk vervangen (anders test dit niets)');
  let didThrow = false;
  let resOut: Resource | undefined;
  try {
    const back = readIFC(hostileIfc);
    resOut = back.resources.find(r => r.name === 'Metselaar');
  } catch { didThrow = true; }
  assert(!didThrow, 'F2: readIFC gooit niet op een numerieke syncedHash in het resource-libraryOrigin-pset');
  assert(resOut?.libraryOrigin?.syncedHash === undefined, 'F2: numerieke syncedHash wordt weggelaten (niet als "12345"-string doorgelaten)');
  assert(resOut?.libraryOrigin?.companyId === 'c1' && resOut?.libraryOrigin?.libraryItemId === 'pr1' && resOut?.libraryOrigin?.poolVersion === 3, 'F2: de rest van de stempel (companyId/libraryItemId/poolVersion) blijft intact naast de weggelaten syncedHash');
}
{
  const calOrigin = { companyId: 'c1', libraryItemId: 'pc1', poolVersion: 5, syncedHash: 'cal-hash-xyz' };
  const calIn: WorkCalendar = { ...baseCalendar({ id: 'lib-cal-hash2', name: 'Ploegkalender met numeriek-hash-aanval' }), libraryOrigin: calOrigin };
  const fixture = minimalFixture({ resourceCalendars: [calIn] });
  const ifc = writeIFC(fixture);
  const hostileIfc = ifc.replace('"syncedHash":"cal-hash-xyz"', '"syncedHash":12345');
  assert(hostileIfc !== ifc, 'F2 test-fixture (kalender): de syncedHash-substring is daadwerkelijk vervangen');
  let didThrow = false;
  let calOut: WorkCalendar | undefined;
  try {
    const back = readIFC(hostileIfc);
    calOut = back.resourceCalendars?.find(c => c.name === 'Ploegkalender met numeriek-hash-aanval');
  } catch { didThrow = true; }
  assert(!didThrow, 'F2: readIFC gooit niet op een numerieke syncedHash in het kalender-libraryOrigin-pset');
  assert(calOut?.libraryOrigin?.syncedHash === undefined, 'F2 (kalender): numerieke syncedHash wordt weggelaten');
  assert(calOut?.libraryOrigin?.companyId === 'c1' && calOut?.libraryOrigin?.libraryItemId === 'pc1' && calOut?.libraryOrigin?.poolVersion === 5, 'F2 (kalender): de rest van de stempel blijft intact naast de weggelaten syncedHash');
}

console.log(`ifc-hostile: ${checks - fails}/${checks} groen`);
process.exit(fails > 0 ? 1 : 0);
