// Solverfouten in de UI-taal (review taakmutaties, bijvangst B) — headless tegen de echte solver en
// een geïsoleerde storecontext.
//
// De fout: "Ongeldige startdatum voor taak …" (Nederlands) en "Circular dependency detected"
// (Engels) verschenen ongeacht de UI-taal, want de solver leverde alleen een vaste tekst. Nu levert
// hij óók een code + parameters (`CPMResult.errorInfo`) en vertaalt de UI via `scheduleErrors.*`.
// Deze batterij pint vast:
//   1. elke guard in `solve()` levert de juiste code (+ taak/kring) én nog steeds letterlijk de oude
//      `error`-tekst — MCP-tools, extensies en `mapTransactionError` lezen die;
//   2. elke code heeft in alle veertien talen een niet-lege tekst met de juiste placeholder;
//   3. de melding en het waarschuwingenpaneel dragen de code, en vertalen naar de gekozen taal.
import i18next from 'i18next';
import ar from '@/i18n/locales/ar/common.json';
import de from '@/i18n/locales/de/common.json';
import en from '@/i18n/locales/en/common.json';
import es from '@/i18n/locales/es/common.json';
import fa from '@/i18n/locales/fa/common.json';
import fr from '@/i18n/locales/fr/common.json';
import it from '@/i18n/locales/it/common.json';
import ja from '@/i18n/locales/ja/common.json';
import ko from '@/i18n/locales/ko/common.json';
import nl from '@/i18n/locales/nl/common.json';
import pl from '@/i18n/locales/pl/common.json';
import pt from '@/i18n/locales/pt/common.json';
import tr from '@/i18n/locales/tr/common.json';
import zh from '@/i18n/locales/zh/common.json';
import { createAppStoreContext } from '@/state/appStore';
import { solveProject } from '@/engine/scheduler/solveProject';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { collectScheduleWarnings } from '@/engine/scheduler/scheduleWarnings';
import { SCHEDULE_ERROR_CODES, scheduleErrorText } from '@/i18n/scheduleErrors';
import { scheduleFailedNotice } from '@/state/scheduleErrorNotice';
import type { CPMResult, ScheduleErrorCode } from '@/engine/scheduler/CPMSolver';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const truthy = (label: string, got: unknown) => { checks++; if (!got) diffs.push(`${label}: verwacht waar, kreeg ${JSON.stringify(got)}`); };

// ── 1. Elke guard: code + parameters, en de oude tekst ongewijzigd ─────────────────────────────
function task(id: string, name: string, time: Partial<Task['time']> = {}): Task {
  return {
    id, name, parentId: null, childIds: [], wbsCode: id, isMilestone: false, status: 'NOT_STARTED',
    time: { ...createDefaultTaskTime('2026-03-02', 5), ...time },
  } as unknown as Task;
}
function solve(tasks: Task[], sequences: Sequence[] = [], calendar: WorkCalendar = createDefaultCalendar()): CPMResult {
  return solveProject({ tasks, sequences, calendar, calendars: [calendar] });
}
const fs = (id: string, p: string, s: string): Sequence => ({ id, predecessorId: p, successorId: s, type: 'FINISH_START', lagDays: 0 });

const noWorkDays: WorkCalendar = { ...createDefaultCalendar(), workDays: [] };
/** Een kalender waar geen werkblok uit af te leiden valt (0 uur per dag): een WORKTIME-urentaak kan
 *  daar niet rekenen, terwijl de werkdagen-guard ervoor nog slaagt. */
const bandless: WorkCalendar = { ...createDefaultCalendar(), workTime: undefined, hoursPerDay: 0 };

const cases: { code: ScheduleErrorCode; result: CPMResult; legacy: string; info: object }[] = [
  {
    code: 'cycle',
    result: solve([task('a', 'Fundering'), task('b', 'Wanden')], [fs('s1', 'a', 'b'), fs('s2', 'b', 'a')]),
    legacy: '', // hieronder apart: de kringrichting hangt van de detectie af
    info: {},
  },
  { code: 'noWorkingDays', result: solve([task('a', 'Fundering')], [], noWorkDays),
    legacy: 'Kalender heeft geen werkdagen ingesteld', info: { code: 'noWorkingDays' } },
  { code: 'invalidDayDuration', result: solve([task('a', 'Fundering', { scheduleDuration: -1 })]),
    legacy: 'Ongeldige dagduur voor taak "Fundering"', info: { code: 'invalidDayDuration', taskName: 'Fundering' } },
  { code: 'invalidHourDuration', result: solve([task('a', 'Stellen', { durationUnit: 'hours', durationMinutes: Number.NaN })]),
    legacy: 'Ongeldige urenduur voor taak "Stellen"', info: { code: 'invalidHourDuration', taskName: 'Stellen' } },
  { code: 'hourTaskWithoutWorkHours', result: solve([task('a', 'Stellen', { durationUnit: 'hours', durationMinutes: 240, durationType: 'WORKTIME' })], [], bandless),
    legacy: 'Uurtaak "Stellen" heeft geen geldige werktijden in zijn kalender', info: { code: 'hourTaskWithoutWorkHours', taskName: 'Stellen' } },
  { code: 'invalidStartDate', result: solve([task('a', 'Grondwerk', { scheduleStart: '' })]),
    legacy: 'Ongeldige startdatum voor taak "Grondwerk"', info: { code: 'invalidStartDate', taskName: 'Grondwerk' } },
];
eq('1.0 elke code heeft een solvergeval in deze batterij', cases.map((c) => c.code).sort(), [...SCHEDULE_ERROR_CODES].sort());
for (const c of cases) {
  eq(`1 ${c.code}: errorInfo.code`, c.result.errorInfo?.code, c.code);
  if (c.code === 'cycle') continue;
  eq(`1 ${c.code}: errorInfo compleet`, c.result.errorInfo, c.info);
  eq(`1 ${c.code}: de oude error-tekst is letterlijk ongewijzigd`, c.result.error, c.legacy);
}
const cyc = cases[0].result;
const names = cyc.errorInfo?.cycleNames ?? [];
eq('1 cycle: de kring is gesloten en noemt beide taken', [names[0] === names[names.length - 1], [...new Set(names)].sort()], [true, ['Fundering', 'Wanden']]);
eq('1 cycle: de oude error-tekst is letterlijk ongewijzigd', cyc.error, `Circular dependency detected: ${names.join(' -> ')}`);
// `mapTransactionError` (MCP) herkent een kring aan deze woorden; die module sleept de i18n-config
// mee (DOM nodig), dus hier de regex zelf — de MCP-suite dekt de functie.
truthy('1 cycle: MCP herkent de kring nog aan de tekst', /circular dependency/i.test(cyc.error ?? ''));
eq('1 geen fout ⇒ geen errorInfo', solve([task('a', 'Fundering')]).errorInfo, undefined);

// ── 2. Elke code heeft in alle veertien talen een tekst met de juiste placeholder ──────────────
const COMMON: Record<string, { scheduleErrors?: Record<string, unknown> }> = {
  nl, en, fr, de, es, zh, it, pt, pl, tr, ar, ja, ko, fa,
};
const locales = Object.keys(COMMON);
eq('2.0 veertien talen', locales.length, 14);
for (const l of locales) {
  const block = COMMON[l].scheduleErrors ?? {};
  for (const code of SCHEDULE_ERROR_CODES) {
    const text: unknown = block[code];
    truthy(`2 ${l}: scheduleErrors.${code} bestaat`, typeof text === 'string' && text.trim() !== '');
    const want = code === 'cycle' ? ['{{path}}'] : code === 'noWorkingDays' ? [] : ['{{task}}'];
    eq(`2 ${l}: scheduleErrors.${code} placeholders`, (String(text).match(/\{\{\w+\}\}/g) ?? []), want);
  }
}

// ── 3. Melding, waarschuwingenpaneel en vertaling ───────────────────────────────────────────────
const translator = i18next.createInstance();
await translator.init({
  lng: 'de', fallbackLng: 'en', ns: ['common'], defaultNS: 'common', interpolation: { escapeValue: false },
  resources: { nl: { common: nl }, en: { common: en }, de: { common: de } },
});
const t = (lng: string) => translator.getFixedT(lng, 'common') as unknown as (key: string, opts?: object) => string;

const store = createAppStoreContext().store;
const S = () => store.getState();
S().newProject();
const id = S().addTask({ name: 'Grondwerk' });
store.setState((s) => {
  const x = s.tasks.find((k) => k.id === id)!;
  x.time.scheduleStart = '';
});
S().runCPM();
const notice = S().ui.notifications.find((n) => n.dedupeKey === 'cpm-error');
eq('3a de melding draagt de sleutel', notice?.detailKey, 'scheduleErrors.invalidStartDate');
eq('3b en de taak als parameter', notice?.detailParams, { task: 'Grondwerk', path: '' });
eq('3c geen rauwe (Nederlandse) tekst meer in de melding', notice?.detail, undefined);
eq('3d Engels', t('en')(notice!.detailKey!, notice!.detailParams), "Invalid start date for task 'Grondwerk'");
eq('3e Duits', t('de')(notice!.detailKey!, notice!.detailParams), "Ungültiges Startdatum für Aufgabe 'Grondwerk'");
eq('3f Nederlands', t('nl')(notice!.detailKey!, notice!.detailParams), "Ongeldige startdatum voor taak 'Grondwerk'");

eq('3g kring in het Engels', scheduleErrorText(cyc, t('en')), `Circular dependency between tasks: ${names.join(' → ')}`);
eq('3h kring in het Duits', scheduleErrorText(cyc, t('de')), `Zirkelbezug zwischen Aufgaben: ${names.join(' → ')}`);
eq('3i een resultaat zonder code valt terug op de vaste tekst', scheduleErrorText({ error: 'Circular dependency detected: A → B → A' }, t('en')), 'Circular dependency detected: A → B → A');
eq('3j geen fout ⇒ lege tekst', scheduleErrorText(null, t('en')), '');
eq('3k resultaat zonder code ⇒ melding met rauwe tekst', scheduleFailedNotice({ error: 'x' })?.detail, 'x');

const warnings = collectScheduleWarnings({ tasks: [], sequences: [], resources: [], cpmResult: cyc, resourceLoadResult: null });
const errorWarning = warnings.find((w) => w.kind === 'scheduleError');
eq('3l het waarschuwingenpaneel krijgt de code mee', errorWarning?.facts.errorInfo?.code, 'cycle');

// De melding volgt een taalwissel: dezelfde notificatie, andere taal, andere tekst — geen vaste string.
S().runCPM();
eq('3m samenvouwen houdt sleutel en parameters', [S().ui.notifications.filter((n) => n.dedupeKey === 'cpm-error').length,
  S().ui.notifications.find((n) => n.dedupeKey === 'cpm-error')?.detailKey], [1, 'scheduleErrors.invalidStartDate']);

if (diffs.length) {
  console.log(`XX  schedule-errors: ${diffs.length} van de ${checks} checks FOUT`);
  for (const d of diffs) console.log(`    - ${d}`);
  process.exit(1);
}
console.log(`OK  schedule-errors: alle checks groen (${checks})`);
