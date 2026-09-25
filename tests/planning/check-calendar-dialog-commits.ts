// Kalenderdialogen: wat hun Toepassen/Enter in de store doet (audit resources-kalenders, bevindingen
// 4, 5 en 7). Headless tegen de echte store; de bediening zelf (klikken, Enter, Annuleren) bewaakt
// tests/browser/calendar-dialog.spec.ts met echte browser-events.
//
// Bevinding 4 — "Toepassen" of Enter zonder wijziging is een no-op. `CalendarDialog` commit de hele
// buffer via `commitCalendarLibrary` en herberekent alleen als er iets gecommit is;
// `ResourceCalendarDialog` stuurt de hele draft naar `updateCalendar`. Zonder guard werd het document
// "gewijzigd", kwam er een lege undo-stap bij en verliet een document de modus "datums zoals
// opgeslagen" (issue #63).
import './domStub';
import { createAppStore } from '@/state/appStore';
import { readIFC } from '@/services/ifc/ifcReader';
import { holidayEndDate, type WorkCalendar } from '@/types/calendar';
import { externIfc } from '../fixtures/recordedDatesIfc';

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

if (failures.length > 0) {
  for (const failure of failures) console.log(`XX ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`OK calendar-dialog-commits: ${checks} controles groen`);
}
