// Kalenderdialogen: wat hun Toepassen/Enter in de store doet (audit resources-kalenders, bevindingen
// 4, 5 en 7). Headless tegen de echte store; de bediening zelf (klikken, Enter, Annuleren) bewaakt
// tests/browser/calendar-dialog.spec.ts met echte browser-events.
//
// Bevinding 4 — "Toepassen" of Enter zonder wijziging is een no-op. `CalendarDialog` commit de hele
// buffer via `commitCalendarLibrary` en herberekent alleen als er iets gecommit is;
// `ResourceCalendarDialog` stuurt de hele draft naar `updateCalendar`. Zonder guard werd het document
// "gewijzigd", kwam er een lege undo-stap bij en verliet een document de modus "datums zoals
// opgeslagen" (issue #63).
//
// Bevinding 5 — een feestdag met einde vóór begin (of zonder geldige begindatum) werd in het formulier
// stil bewaard en telde in de engine als nul dagen, terwijl MCP hem weigerde. Eén regel
// (`holidayIssue`) voor formulier, beide dialogen en MCP.
//
// Bevinding 7 — "+" in de kalenderdialoog gaf een kalender zonder feestdagen, "+ Resourcekalender"
// (en MCP `create`) de app-standaard. Eén fabriek: `createNewCalendar`.
import './domStub';
import { createAppStore } from '@/state/appStore';
import { readIFC } from '@/services/ifc/ifcReader';
import { holidayEndDate, type WorkCalendar } from '@/types/calendar';
import { externIfc } from '../fixtures/recordedDatesIfc';
import { calendarHasHolidayIssue, holidayIssue, withCanonicalHolidayEnds } from '@/utils/holidayRange';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { createDefaultCalendar, createNewCalendar } from '@/engine/calendar/defaultCalendar';
import { parseDate } from '@/utils/dateUtils';

const failures: string[] = [];
let checks = 0;
function equal(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

type Store = ReturnType<typeof createAppStore>;

/** Document in de modus "datums zoals opgeslagen" (#63), zoals de review het in de browser opzette. */
function recordedDatesDocument(): Store {
  const store = createAppStore();
  const s = store.getState();
  s.applyLoadedProject(readIFC(externIfc('2')), { filePath: null, recompute: true });
  store.getState().showRecordedDates();
  // De kalenderdialoog doet dit bij openen (puur additief, geen undo-stap).
  store.getState().ensureProjectCalendarInLibrary();
  return store;
}

function observe(store: Store) {
  const s = store.getState();
  return {
    datesAsRecorded: s.datesAsRecorded,
    isDirty: s.isDirty,
    scheduleStale: s.scheduleStale,
    undo: s.historyEvents.filter((e) => e.state === 'applied').length,
  };
}

/** Exact de body van `CalendarDialog.commit`: de buffer (diepe kopie van de bibliotheek, lege
 *  einddatums canoniek gemaakt) committen en alleen bij een echte commit herberekenen. */
function dialogCommit(store: Store, calendars: WorkCalendar[], projectCalendarId: string): boolean {
  const normalized = calendars.map((c) => ({
    ...c, holidays: c.holidays.map((h) => ({ ...h, endDate: holidayEndDate(h) })),
  }));
  const committed = store.getState().commitCalendarLibrary(normalized, projectCalendarId);
  if (committed) store.getState().runCPM();
  return committed;
}

// ── 4A: kalenderdialoog, Toepassen zonder wijziging ─────────────────────────────────────────────
{
  const store = recordedDatesDocument();
  const before = observe(store);
  equal('4A uitgangspunt: modus "datums zoals opgeslagen"', before.datesAsRecorded, true);
  const committed = dialogCommit(store, structuredClone(store.getState().calendars), store.getState().project.calendarId);
  equal('4A commitCalendarLibrary meldt "niets gecommit"', committed, false);
  equal('4A toestand ongewijzigd (modus, isDirty, stale, undo)', observe(store), before);
}

// ── 4B: kalenderdialoog, drie keer Enter zonder wijziging ───────────────────────────────────────
{
  const store = recordedDatesDocument();
  const before = observe(store);
  for (let i = 0; i < 3; i++) {
    dialogCommit(store, structuredClone(store.getState().calendars), store.getState().project.calendarId);
  }
  equal('4B 3× Enter zonder wijziging laat alles staan', observe(store), before);
}

// ── 4C: een echte wijziging commit wél (één undo-stap) en herberekent ───────────────────────────
{
  const store = recordedDatesDocument();
  const pid = store.getState().project.calendarId;
  const undoBefore = observe(store).undo;
  const renamed = structuredClone(store.getState().calendars).map((c) => (c.id === pid ? { ...c, name: 'Hernoemd' } : c));
  equal('4C een naamswijziging wordt gecommit', dialogCommit(store, renamed, pid), true);
  equal('4C de naam staat in de store', store.getState().calendar.name, 'Hernoemd');
  equal('4C document gewijzigd', store.getState().isDirty, true);
  equal('4C precies één commit-stap (plus die van runCPM in de #63-modus)', observe(store).undo > undoBefore, true);
  // Daarna nogmaals Enter zonder verdere wijziging: geen extra stap.
  const afterFirst = observe(store);
  equal('4C tweede Enter zonder wijziging commit niets',
    dialogCommit(store, structuredClone(store.getState().calendars), pid), false);
  equal('4C tweede Enter laat undo staan', observe(store), afterFirst);
}

// ── 4D: alleen een andere projectdefault (ster) is een wijziging ────────────────────────────────
{
  const store = createAppStore();
  store.getState().ensureProjectCalendarInLibrary();
  const { id: _drop, ...base } = structuredClone(store.getState().calendar);
  void _drop;
  const otherId = store.getState().addCalendar({ ...base, name: 'Tweede' });
  store.setState({ isDirty: false });
  const undoBefore = observe(store).undo;
  equal('4D projectdefault wisselen wordt gecommit',
    store.getState().commitCalendarLibrary(structuredClone(store.getState().calendars), otherId), true);
  equal('4D projectdefault gewisseld', store.getState().project.calendarId, otherId);
  equal('4D één undo-stap', observe(store).undo, undoBefore + 1);
}

// ── 4E: een commit die verweesde verwijzingen opruimt is geen no-op ─────────────────────────────
{
  const store = createAppStore();
  store.getState().ensureProjectCalendarInLibrary();
  const taskId = store.getState().addTask({ name: 'Verweesd' });
  store.setState((s) => {
    const t = s.tasks.find((x) => x.id === taskId)!;
    t.calendarId = 'bestaat-niet';
  });
  equal('4E ongewijzigde bibliotheek maar een verweesde taakverwijzing ⇒ commit',
    store.getState().commitCalendarLibrary(structuredClone(store.getState().calendars), store.getState().project.calendarId), true);
  equal('4E verwijzing opgeruimd', store.getState().tasks.find((t) => t.id === taskId)!.calendarId, undefined);
}

// ── 4F: resourcekalenderdialoog (updateCalendar met de hele draft) zonder wijziging ─────────────
{
  const store = recordedDatesDocument();
  const before = observe(store);
  const existing = store.getState().calendars.find((c) => c.id === store.getState().project.calendarId)!;
  store.getState().updateCalendar(existing.id, structuredClone(existing));
  equal('4F updateCalendar met een identieke draft is een no-op', observe(store), before);
  // Andere sleutelvolgorde en een expliciet `undefined`-veld zijn per saldo ook geen wijziging.
  const reordered = Object.fromEntries(Object.entries(structuredClone(existing)).reverse()) as WorkCalendar;
  store.getState().updateCalendar(existing.id, { ...reordered, shift: undefined });
  equal('4F andere sleutelvolgorde / veld: undefined is geen wijziging', observe(store), before);
  store.getState().updateCalendar(existing.id, { ...structuredClone(existing), workEndHour: 17 });
  const after = observe(store);
  equal('4F een echte wijziging telt wél (undo +1, stale)', { undo: after.undo, stale: after.scheduleStale, dirty: after.isDirty },
    { undo: before.undo + 1, stale: true, dirty: true });
}

// ── 4G: dezelfde dialoog in de Bibliotheekweergave (updatePoolCalendar) zonder wijziging ────────
{
  const store = createAppStore();
  const cid = store.getState().addCompany('Bouwbedrijf');
  store.getState().bindProjectToCompany(cid);
  const { id: _drop, ...base } = structuredClone(store.getState().calendar);
  void _drop;
  const poolCalId = store.getState().addPoolCalendar(cid, { ...base, name: 'Poolkalender' })!;
  const versionBefore = store.getState().pools[cid].poolVersion;
  const poolCal = store.getState().pools[cid].calendars.find((c) => c.id === poolCalId)!;
  store.getState().updatePoolCalendar(cid, poolCalId, structuredClone(poolCal));
  equal('4G pool-editor Toepassen zonder wijziging bumpt de poolversie niet',
    store.getState().pools[cid].poolVersion, versionBefore);
  store.getState().updatePoolCalendar(cid, poolCalId, { ...structuredClone(poolCal), workEndHour: 17 });
  equal('4G een echte wijziging bumpt wél', store.getState().pools[cid].poolVersion, versionBefore + 1);
}

// ── 5A: de gedeelde feestdagregel ───────────────────────────────────────────────────────────────
{
  equal('5A geldig bereik', holidayIssue({ startDate: '2026-07-13', endDate: '2026-07-17' }), undefined);
  equal('5A lege einddatum = eendaags, geldig', holidayIssue({ startDate: '2026-07-13', endDate: '' }), undefined);
  equal('5A einde vóór begin', holidayIssue({ startDate: '2026-07-17', endDate: '2026-07-13' }), 'endBeforeStart');
  equal('5A jaar doorgeschoven op alleen Van (review-scenario)',
    holidayIssue({ startDate: '2027-07-19', endDate: '2026-08-07' }), 'endBeforeStart');
  equal('5A lege begindatum', holidayIssue({ startDate: '', endDate: '2026-07-17' }), 'invalidStart');
  equal('5A onleesbare einddatum', holidayIssue({ startDate: '2026-07-13', endDate: '17-07-2026' }), 'invalidEnd');
  const cal = { ...createDefaultCalendar(), holidays: [{ name: 'Bouwvak', startDate: '2026-07-17', endDate: '2026-07-13' }] };
  equal('5A kalender met zo\'n regel is ongeldig', calendarHasHolidayIssue(cal), true);
  // Waarom het ertoe doet: de engine telt de omgekeerde regel stil als nul dagen.
  equal('5A engine: omgekeerde regel maakt 15-07 géén vrije dag',
    new CalendarEngine({ ...cal, workDays: [1, 2, 3, 4, 5] }).isWorkDay(parseDate('2026-07-15')), true);
}

// ── 5B: beide dialogen schrijven dezelfde vorm weg ──────────────────────────────────────────────
{
  const cal = { ...createDefaultCalendar(), holidays: [{ name: 'Koningsdag', startDate: '2026-04-27', endDate: '' }] };
  equal('5B lege einddatum wordt bij opslaan de begindatum', withCanonicalHolidayEnds(cal).holidays,
    [{ name: 'Koningsdag', startDate: '2026-04-27', endDate: '2026-04-27' }]);
  equal('5B origineel ongemoeid', cal.holidays[0].endDate, '');
}

// ── 7A: één fabriek voor een nieuwe kalender ────────────────────────────────────────────────────
{
  const created = createNewCalendar('Ploeg 4-daags');
  const { id: _id, ...standard } = createDefaultCalendar();
  void _id;
  equal('7A geen id (de bibliotheek kent er een toe)', 'id' in created, false);
  equal('7A naam zoals opgegeven', created.name, 'Ploeg 4-daags');
  equal('7A verder exact de app-standaard (werktijden, feestdagen, herkomst)',
    { ...created, name: standard.name }, standard);
  // In de headless omgeving staat bouwmodus op zijn standaard (aan): dus met de NL-feestdagen.
  equal('7A bouwmodus-standaard ⇒ NL-feestdagen met herkomst', {
    some: created.holidays.length > 0, ruleSet: created.generation?.ruleSetId,
  }, { some: true, ruleSet: 'NL' });
}

if (failures.length > 0) {
  for (const failure of failures) console.log(`XX ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`OK calendar-dialog-commits: ${checks} controles groen`);
}
