// check-recorded-dates-library.ts — V1 (eigenaarsbesluit 2026-10-12, optie 1): een kalenderwijziging
// uit de resourcebibliotheek terwijl "datums zoals opgeslagen" aan staat.
//
// Besluit: "De strook blijft en toont het juiste getal, bijvoorbeeld '3 taken verschuiven'. Je ziet nog
// de datums uit het bestand, tot je op Berekenen drukt."
//
// Per route toetst deze check: de modus blijft aan, `scheduleStale` blijft uit, de getoonde datums
// blijven die uit het bestand, en het strookgetal (`recordedDates.shifted`) is precies wat een echte
// F5 (`runCPM`) daarna verschuift.
//
// Routes:
//   (a) `refreshAllDocumentsFromPool` — actief document (bibliotheekkalender bewerken)
//   (b) idem — SLAPEND document, daarna terugwisselen
//   (c) `resolveDeviation('company')` — "Bibliotheekwaarden gebruiken"
//   (d) heropenen: eigen IFC (XER-archief) openen terwijl de bibliotheek intussen veranderde; het
//       getal telt NA de bibliotheekverversing van de open-grens
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { createAppStore } from '@/state/appStore';
import { readXER } from '@/services/xer/xerReader';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { countShiftedTasks, type RecordedTime } from '@/engine/scheduler/recordedDates';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readXerArchiveIFC } from './xerArchiveTestReader';
import { recountShiftedAfterLibraryRefresh } from '@/state/documentActivation';
import type { Sequence } from '@/types/sequence';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: kreeg ${g}, verwachtte ${w}`);
}

// Drie taken, vastgelegd door P6. Bij laden wijkt er één af (R2: P6 legde hem een week later).
// Met vrijdag vrij in de bibliotheekkalender verschuiven alle drie.
const TASK_FIELDS = [
  'task_id', 'proj_id', 'clndr_id', 'task_code', 'task_name', 'task_type', 'duration_type',
  'status_code', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt', 'target_start_date', 'target_end_date',
  'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
  'total_float_hr_cnt', 'free_float_hr_cnt',
].join('\t');
const XER = new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tV1Proef\tC1\t2026-01-01\t2026-01-01',
  '%T\tTASK',
  `%F\t${TASK_FIELDS}`,
  '%R\tR1\tP1\tC1\tA1\tEen\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09\t2026-01-05\t2026-01-09\t2026-01-12\t2026-01-16\t40\t0',
  '%R\tR2\tP1\tC1\tA2\tTwee\tTT_Task\tDT_FixedDUR\tTK_NotStart\t32\t32\t2026-02-02\t2026-02-05\t2026-02-09\t2026-02-12\t2026-02-09\t2026-02-12\t0\t0',
  '%R\tR3\tP1\tC1\tA3\tDrie\tTT_Task\tDT_FixedDUR\tTK_NotStart\t80\t80\t2026-03-02\t2026-03-13\t2026-03-02\t2026-03-13\t2026-03-02\t2026-03-13\t0\t0',
  '%E',
].join('\r\n'));

function parsedXer(): ImportResult {
  const opened = readXER(XER);
  if (isMultiDocumentImport(opened)) throw new Error('verwachtte één project');
  return opened;
}

type Store = ReturnType<typeof createAppStore>;
interface Fixture { store: Store; S: () => ReturnType<Store['getState']>; cid: string; poolId: string }

/** XER geopend (modus aan, strook "1"), gekoppeld aan een bedrijf, projectkalender in de bibliotheek. */
function fixture(): Fixture {
  const store = createAppStore();
  const S = () => store.getState();
  S().applyOpenedImport(parsedXer(), { filePath: '/tmp/v1.xer', recompute: true, fit: false, linkedOpen: true });
  const cid = S().addCompany('Kalenderbibliotheek BV');
  S().bindProjectToCompany(cid);
  const poolId = S().promoteCalendarToPool(cid, S().calendars.find((c) => c.id === S().project.calendarId)!)!;
  return { store, S, cid, poolId };
}

const shownDates = (f: Fixture) => f.S().tasks.map((t) => `${t.id}:${t.time.earlyStart}..${t.time.earlyFinish}`);
const strip = (f: Fixture) => f.S().recordedDates?.shifted;
const fridayOff = (f: Fixture, workDays = [1, 2, 3, 4]) => f.S().updatePoolCalendar(f.cid, f.poolId, { workDays });

/** Wat een echte F5 verschuift t.o.v. de vastlegging. Draait `runCPM` op de store zelf — dus als
 *  laatste stap van een scenario. */
function realF5Shift(f: Fixture): number {
  const times: Record<string, RecordedTime> = f.S().recordedDates!.times;
  f.S().runCPM();
  return countShiftedTasks(f.S().tasks, times);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- voorwaarde: de fixture opent in de modus met strookgetal 1 --');
{
  const f = fixture();
  eq('v1 modus aan, niet verouderd, strook 1', [f.S().datesAsRecorded, f.S().scheduleStale, strip(f)], [true, false, 1]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (a) actief document: bibliotheekkalender bewerken --');
{
  const f = fixture();
  const datesBefore = shownDates(f);
  const cpmBefore = f.S().cpmResult;
  fridayOff(f);
  eq('a0 voorwaarde: de projectkalender is ververst', f.S().calendar.workDays, [1, 2, 3, 4]);
  eq('a1 modus blijft aan, scheduleStale blijft uit', [f.S().datesAsRecorded, f.S().scheduleStale], [true, false]);
  eq('a2 getoonde datums blijven die uit het bestand', shownDates(f), datesBefore);
  eq('a3 cpmResult blijft de reconstructie (zelfde object)', f.S().cpmResult === cpmBefore, true);
  eq('a4 strookgetal = 3 (vrijdag vrij verschuift alle drie)', strip(f), 3);
  eq('a5 strookgetal = wat F5 echt verschuift', strip(f), realF5Shift(f));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (b) slapend document: bibliotheek bewerkt terwijl het sliep --');
{
  const f = fixture();
  const docA = f.S().activeDocumentId;
  const datesBefore = shownDates(f);
  f.S().newDocument();
  fridayOff(f);
  const sleeping = f.S().documents.find((d) => d.id === docA)?.payload;
  eq('b0 slapende payload telt al na de verversing', sleeping?.recordedDates?.shifted, 3);
  f.S().switchDocument(docA);
  eq('b1 terug in A: modus aan, niet verouderd', [f.S().datesAsRecorded, f.S().scheduleStale], [true, false]);
  eq('b2 getoonde datums blijven die uit het bestand', shownDates(f), datesBefore);
  eq('b3 strookgetal = 3', strip(f), 3);
  eq('b4 strookgetal = wat F5 echt verschuift', strip(f), realF5Shift(f));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (c) resolveDeviation(company): "Bibliotheekwaarden gebruiken" --');
{
  const f = fixture();
  // Lokaal "bewerkt" zonder de modus te verlaten: de stempel past niet meer bij de kopie, dus de
  // bibliotheekbewerking hieronder ververst NIET vanzelf (de kopie wijkt af).
  f.store.setState((s) => {
    const cal = s.calendars.find((c) => c.id === s.project.calendarId)!;
    cal.libraryOrigin = { ...cal.libraryOrigin!, syncedHash: 'lokaal-bewerkt' };
  });
  fridayOff(f);
  eq('c0 voorwaarde: de afwijkende kopie is niet vanzelf ververst', [f.S().calendar.workDays, strip(f)], [[1, 2, 3, 4, 5], 1]);
  const datesBefore = shownDates(f);
  f.S().resolveDeviation({ kind: 'calendar', projectId: f.S().project.calendarId }, 'company');
  eq('c1 bibliotheekwaarden overgenomen', f.S().calendar.workDays, [1, 2, 3, 4]);
  eq('c2 modus aan, niet verouderd, datums uit het bestand', [f.S().datesAsRecorded, f.S().scheduleStale, shownDates(f)], [true, false, datesBefore]);
  eq('c3 strookgetal = 3', strip(f), 3);
  eq('c4 strookgetal = wat F5 echt verschuift', strip(f), realF5Shift(f));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (d) heropenen: eigen IFC, bibliotheek intussen gewijzigd --');
{
  const f = fixture();
  // Opslaan in de modus; daarna wijzigt de bibliotheek (vrijdag vrij) terwijl het bestand dicht is.
  const ifc = writeIFC(buildWriteIFCInput(f.S()));
  f.S().newProject();
  fridayOff(f);
  f.S().applyOpenedImport(readXerArchiveIFC(ifc), { filePath: '/tmp/v1.ifc', recompute: true, fit: false, linkedOpen: true });
  eq('d0 voorwaarde: de open-grens ververste de kalender', f.S().calendar.workDays, [1, 2, 3, 4]);
  // Het bestand is sinds de import bewerkt (koppeling aan de bibliotheek), maar IN de modus
  // opgeslagen: het opent weer in de modus, "zoals je het achterliet" (eigenaar, 2026-10-17). De
  // strook telt NA de verversing van de open-grens.
  eq('d1 bewerkt maar in de modus opgeslagen: modus aan, strook telt NA de verversing: 3',
    [f.S().datesAsRecorded, f.S().recordedDates !== null, strip(f)], [true, true, 3]);
  // Hetzelfde bestand als ONBEWERKT (vlag aan) opent wél in de modus; de strook telt dan NA de
  // verversing.
  f.S().newProject();
  f.S().applyOpenedImport({ ...readXerArchiveIFC(ifc), importPristine: true }, { filePath: '/tmp/v1.ifc', recompute: true, fit: false, linkedOpen: true });
  eq('d2 onbewerkt: modus aan, strook telt NA de verversing: 3', [f.S().datesAsRecorded, f.S().scheduleStale, strip(f)], [true, false, 3]);
  eq('d2b de lijst per taak hoort bij hetzelfde getal', f.S().recordedDates?.shiftedTaskIds?.length, 3);
  eq('d3 strookgetal = wat F5 echt verschuift', strip(f), realF5Shift(f));
}


// ═══════════════════════════════════════════════════════════════════════════
// (e) Foutpad van de hertelling: faalt de doorrekening (cyclus), dan GEEN teller en GEEN lijst per
// taak — een oude meting mag niet blijven staan als "N taken verschuiven".
// MUTATIEBEWIJS: haal `delete next.shiftedTaskIds;` weg uit `recountShiftedAfterLibraryRefresh`
// (`documentActivation.ts`) ⇒ e2 slaat ROOD.
console.log('-- (e) hertelling met een solverfout: geen verzonnen meting --');
{
  const f = fixture();
  const st = f.S();
  eq('e0 voorwaarde: er is een meting', [st.recordedDates?.shifted, st.recordedDates?.shiftedTaskIds?.length], [1, 1]);
  const [a, b] = st.tasks;
  const cyclus: Sequence[] = [
    { id: 'cyc-1', predecessorId: a!.id, successorId: b!.id, type: 'FINISH_START', lagDays: 0 },
    { id: 'cyc-2', predecessorId: b!.id, successorId: a!.id, type: 'FINISH_START', lagDays: 0 },
  ];
  const next = recountShiftedAfterLibraryRefresh({ ...st, sequences: [...st.sequences, ...cyclus] });
  eq('e1 solverfout: geen teller', next?.shifted, undefined);
  eq('e2 solverfout: geen lijst per taak', next?.shiftedTaskIds, undefined);
  eq('e3 de vastlegging zelf blijft', Object.keys(next?.times ?? {}).length, Object.keys(st.recordedDates!.times).length);
}

if (diffs.length > 0) {
  console.error(`FAIL recorded-dates-library: ${diffs.length}/${checks} afwijkingen`);
  for (const d of diffs) console.error(`XX  ${d}`);
  process.exitCode = 1;
} else {
  console.log(`OK  recorded-dates-library: ${checks}/${checks}`);
}
