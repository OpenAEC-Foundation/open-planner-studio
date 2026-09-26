// Audit resources-kalenders R2: de bibliotheek volgt ook het pauzepatroon en de werkende
// uitzonderingen van een kalender — door de echte store, de echte IFC-writer/-reader en het echte
// open-pad (`applyLoadedProject` met `linkedOpen`, dezelfde grens-1-check als Bestand → Openen).
//
// Vóór de fix: een pauzewijziging in de bibliotheek bereikte de projectkopieën niet, terwijl die "in
// sync" bleven heten; een kopie kreeg wel de nieuwe `hoursPerDay` (8,5) maar hield de oude pauze
// (60 min), dus rekende de engine 8 u en zeiden veld en dialoog 8,5.
//
// De pure kant (diff, hash, classificatie incl. de hash-migratie) staat in check-library-ops.ts.
// Hier: (1) de verversing bereikt actieve én slapende documenten en de planning volgt; (2) een kopie
// met een OUDE stempel (vóór R2, de "v1-vorm") wordt na een poolwijziging stil ververst ('behind'),
// niet als afwijking gemeld; (3) de stempel round-tript via IFC. Exitcode = poort.
import { createAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { computeCalendarHash, diffKey } from '@/services/library/libraryOps';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

/** De hash van vóór R2, letterlijk: tien velden in deze volgorde. Zo staat hij in bestaande bestanden. */
const V1 = ['name', 'description', 'workDays', 'workStartHour', 'workEndHour', 'hoursPerDay',
  'holidays', 'generation', 'workTime', 'shift'] as const;
const legacyHash = (c: WorkCalendar): string => JSON.stringify(V1.map((f) => diffKey(c[f])));

const engineHpd = (c: WorkCalendar): number => new CalendarEngine(calendarForEngine(c)).hoursPerDay;
const brk = (c: WorkCalendar | undefined) => c
  ? { start: c.simpleBreakStartMinute, dur: c.simpleBreakDurationMinutes, hpd: c.hoursPerDay }
  : null;

/** Bibliotheekkalender 07:00–16:00 met pauze 12:00 (60 min) ⇒ 8 netto uren. De omschrijving is
 *  bewust niet leeg: een lege omschrijving komt uit IFC terug als de standaardtekst van de lezer
 *  (los, al bestaand punt) en zou de kopie dan om een andere reden laten afwijken. */
function poolCalendar(extra: Partial<WorkCalendar> = {}): Omit<WorkCalendar, 'id'> {
  return {
    name: 'Bouw 07-16', description: 'Bouwploeg', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16,
    hoursPerDay: 8, holidays: [], simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 60, ...extra,
  };
}

// ── (1) Pauze en werkende uitzonderingen uit de bibliotheek bereiken actieve én slapende kopieën ──
{
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  const cid = S().addCompany('Bouwbedrijf');
  const poolCalId = S().addPoolCalendar(cid, poolCalendar())!;

  // Document A: kopie + urentaak van 8,5 u.
  S().bindProjectToCompany(cid);
  const calA = S().addLibraryCalendarToProject(cid, poolCalId).calendarId!;
  const task = S().addTask({ name: 'Urentaak 8,5h', calendarId: calA, time: createDefaultTaskTime('2026-06-01', 8.5, 'hours') });
  const docA = S().activeDocumentId;
  // Document B (actief), A slaapt.
  S().newDocument();
  S().setProject({ startDate: '2026-06-01' });
  S().bindProjectToCompany(cid);
  const calB = S().addLibraryCalendarToProject(cid, poolCalId).calendarId!;

  // Bibliotheekweergave → potlood → pauzeduur 60 → 30 → Toepassen: de dialoog stuurt de hele draft,
  // met de netto uren die de form uit werkdag en pauze afleidt (8,5).
  const draft = structuredClone(S().pools[cid].calendars.find((c) => c.id === poolCalId)!);
  draft.simpleBreakDurationMinutes = 30;
  draft.hoursPerDay = 8.5;
  S().updatePoolCalendar(cid, poolCalId, draft);

  const copyB = S().calendars.find((c) => c.id === calB)!;
  assert(JSON.stringify(brk(copyB)) === JSON.stringify({ start: 720, dur: 30, hpd: 8.5 }),
    `(1) actief document: pauzeduur uit de bibliotheek overgenomen (kreeg ${JSON.stringify(brk(copyB))})`);
  assert(engineHpd(copyB) === 8.5, `(1) actief document: de engine rekent de netto uren van de bibliotheek (kreeg ${engineHpd(copyB)})`);
  const sleepingA = S().documents.find((d) => d.id === docA)!.payload!.calendars.find((c) => c.id === calA)!;
  assert(JSON.stringify(brk(sleepingA)) === JSON.stringify({ start: 720, dur: 30, hpd: 8.5 }),
    `(1) slapend document: pauzeduur uit de bibliotheek overgenomen (kreeg ${JSON.stringify(brk(sleepingA))})`);

  S().switchDocument(docA);
  assert(S().diffProjectCalendar(calA)?.status === 'up-to-date', '(1) na de verversing: diff up-to-date');
  assert(S().onOpenStatusForCalendar(calA) === 'in-sync', '(1) na de verversing: in-sync');
  S().runCPM();
  const ef = S().tasks.find((t) => t.id === task)!.time.earlyFinish;
  assert(ef === '2026-06-01T16:00', `(1) een urentaak van 8,5 u vult precies één werkdag van de bibliotheekkalender (EF ${ef})`);

  // Pauze alleen verschuiven (duur gelijk) — vroeger bleef zelfs de hash gelijk.
  S().updatePoolCalendar(cid, poolCalId, { simpleBreakStartMinute: 750 });
  assert(S().calendars.find((c) => c.id === calA)?.simpleBreakStartMinute === 750, '(1) verschoven pauze (zelfde duur) volgt de bibliotheek');

  // Werkende uitzondering (bv. uit een MSPDI-import van de bibliotheekkalender).
  const WE = [{ name: 'Inhaalzaterdag', startDate: '2026-06-06', endDate: '2026-06-06' }];
  S().updatePoolCalendar(cid, poolCalId, { workingExceptions: WE });
  assert(JSON.stringify(S().calendars.find((c) => c.id === calA)?.workingExceptions) === JSON.stringify(WE),
    '(1) werkende uitzonderingen volgen de bibliotheek');
}

// ── (2)+(3) Stempel via IFC; een OUDE stempel wordt na een poolwijziging stil ververst ──────────
/** Sla het actieve document op en open het opnieuw via het echte open-pad (grens 1), in een nieuw document. */
function saveAndReopen(store: ReturnType<typeof createAppStore>): ReturnType<typeof readIFC> {
  const S = () => store.getState();
  const parsed = readIFC(writeIFC(buildWriteIFCInput(S())));
  S().newDocument();
  S().applyLoadedProject(parsed, { filePath: 'kopie.ifc', linkedOpen: true });
  return parsed;
}

for (const variant of ['zonder pauze', 'met pauze'] as const) {
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  const cid = S().addCompany('Bouwbedrijf');
  const poolCalId = S().addPoolCalendar(cid, variant === 'met pauze'
    ? poolCalendar()
    : poolCalendar({ simpleBreakStartMinute: undefined, simpleBreakDurationMinutes: undefined }))!;
  S().bindProjectToCompany(cid);
  const calId = S().addLibraryCalendarToProject(cid, poolCalId).calendarId!;

  // (3) Nieuwe stempel: round-trip via IFC, byte-identiek, en daarna in sync.
  const fresh = S().calendars.find((c) => c.id === calId)!;
  const freshStamp = fresh.libraryOrigin!.syncedHash!;
  assert(freshStamp === computeCalendarHash(fresh), `(3) ${variant}: materialisatie stempelt de hash van de kopie`);
  if (variant === 'zonder pauze') {
    assert(freshStamp === legacyHash(fresh), '(3) zonder pauze: de stempel is byte-identiek aan de vorm van vóór R2');
  }
  {
    const parsed = saveAndReopen(store);
    const read = parsed.resourceCalendars?.find((c) => c.libraryOrigin?.libraryItemId === poolCalId);
    assert(read?.libraryOrigin?.syncedHash === freshStamp, `(3) ${variant}: syncedHash round-tript via IFC`);
    assert(JSON.stringify(brk(read)) === JSON.stringify(brk(fresh)), `(3) ${variant}: pauzevelden round-trippen via IFC`);
    const reopened = S().calendars.find((c) => c.libraryOrigin?.libraryItemId === poolCalId)!;
    assert(S().onOpenStatusForCalendar(reopened.id) === 'in-sync', `(3) ${variant}: na openen in-sync`);
    assert(!S().ui.showLibraryLinkDialog, `(3) ${variant}: geen afwijkingenscherm na openen`);
  }

  // (2) Oude stempel: zet de stempel op de v1-vorm (zoals een bestand van vóór R2 hem draagt), sla
  // op, wijzig de bibliotheek, en open het bestand opnieuw.
  S().switchDocument(S().documents[0].id);
  store.setState((st) => {
    const c = st.calendars.find((x) => x.id === calId)!;
    c.libraryOrigin!.syncedHash = legacyHash(c as WorkCalendar);
  });
  const oldText = writeIFC(buildWriteIFCInput(S()));
  const oldRead = readIFC(oldText).resourceCalendars?.find((c) => c.libraryOrigin?.libraryItemId === poolCalId);
  assert(oldRead?.libraryOrigin?.syncedHash === legacyHash(fresh), `(2) ${variant}: de oude stempel round-tript ongewijzigd via IFC`);

  // Bibliotheek wijzigt een v1-veld (feestdag erbij) terwijl het bestand dicht is.
  S().updatePoolCalendar(cid, poolCalId, { holidays: [{ name: 'Bouwvak', startDate: '2026-07-20', endDate: '2026-08-07' }] });
  S().newDocument();
  S().applyLoadedProject(readIFC(oldText), { filePath: 'oud.ifc', linkedOpen: true });
  let opened = S().calendars.find((c) => c.libraryOrigin?.libraryItemId === poolCalId)!;
  assert(opened.holidays.length === 1, `(2) ${variant}: oude stempel + poolwijziging ⇒ bij openen stil ververst (behind), niet 'deviated'`);
  assert(!S().ui.showLibraryLinkDialog, `(2) ${variant}: geen afwijkingenscherm voor een ongewijzigde kopie met oude stempel`);
  assert(S().onOpenStatusForCalendar(opened.id) === 'in-sync', `(2) ${variant}: na de verversing in-sync`);
  assert(opened.libraryOrigin!.syncedHash === computeCalendarHash(opened), `(2) ${variant}: na de verversing een stempel in de nieuwe vorm`);

  // En de volgende poolwijziging (nu de pauze zelf) volgt ook.
  S().updatePoolCalendar(cid, poolCalId, { simpleBreakStartMinute: 780, simpleBreakDurationMinutes: 30, hoursPerDay: 8.5 });
  opened = S().calendars.find((c) => c.libraryOrigin?.libraryItemId === poolCalId)!;
  assert(opened.simpleBreakStartMinute === 780 && opened.simpleBreakDurationMinutes === 30,
    `(2) ${variant}: daarna volgt ook een pauzewijziging uit de bibliotheek`);
  assert(S().onOpenStatusForCalendar(opened.id) === 'in-sync', `(2) ${variant}: en blijft de kopie in-sync`);
}

console.log(`library-calendar-fields: ${checks - fails}/${checks} groen`);
process.exit(fails > 0 ? 1 : 0);
