// MSPDI-export van een eigen project met een kritiek-drempel in uren (#561): de drempel gaat verloren, en de
// planner krijgt daar een melding over. Via de echte route (`exportAs('mspdi')`), zonder XER-archief, zoals de
// exportknoppen dat doen; het geschreven bestand wordt onderschept aan de onderkant van `fileAccess` (de
// web-download-fallback), zoals in `check-mspdi-baseline-export.ts`.
//
// Draait via run.sh. Exit 0 = alles groen.
import { installDOMParser } from './xmldom-shim';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Project } from '@/types/project';

// ── Headless browser-stubs: zonder `showOpenFilePicker` pakt de web-backend de download-fallback ──────
let captured: string | null = null;
const g = globalThis as any;
g.window = g.window ?? {};
g.Blob = class {
  constructor(parts: unknown[]) { captured = parts.join(''); }
};
g.URL = g.URL ?? {};
g.URL.createObjectURL = () => 'blob:test';
g.URL.revokeObjectURL = () => { /* no-op */ };
g.document = {
  createElement: () => ({ href: '', download: '', click() { /* no-op */ } }),
};

installDOMParser();

const { useAppStore } = await import('@/state/appStore');
const S = () => useAppStore.getState();

const diffs: string[] = [];
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (J(got) !== J(want)) diffs.push(`${label}: verwacht ${J(want)}, kreeg ${J(got)}`);
};

const KEY = 'notifications.exportCriticalHoursLost';
type CriticalDefinition = NonNullable<NonNullable<Project['schedulingOptions']>['criticalDefinition']>;

/** Eigen project (geen XER-herkomst) met één taak en deze kritiek-definitie, geëxporteerd naar `format`. */
async function exportWith(format: 'mspdi' | 'csv', definition: CriticalDefinition) {
  S().newProject();
  S().setProject({ name: 'Kritiek-drempel', startDate: '2026-11-02' });
  S().addTask({ name: 'Fundering', time: createDefaultTaskTime('2026-11-02', 5) });
  useAppStore.setState(state => {
    state.project.schedulingOptions = { criticalDefinition: definition };
    state.ui.notifications = [];
  });
  S().runCPM();
  captured = null;
  const result = await S().exportAs(format);
  const keys = S().ui.notifications.map(n => n.messageKey).filter(k => k === KEY);
  return { ok: result.ok, keys, xml: captured ?? '' };
}

{
  const lost = await exportWith('mspdi', { mode: 'totalFloat', threshold: 1, thresholdHours: 4 });
  eq('01 uren-drempel: export geslaagd', lost.ok, true);
  eq('02 uren-drempel: één melding', lost.keys, [KEY]);
  eq('03 uren-drempel: geen CriticalSlackLimit in het bestand', lost.xml.includes('<CriticalSlackLimit>'), false);
  eq('04 uren-drempel: bestand geschreven', lost.xml.includes('<Project'), true);
}
{
  const days = await exportWith('mspdi', { mode: 'totalFloat', threshold: 2 });
  eq('05 dagdrempel: geen melding', days.keys, []);
  eq('06 dagdrempel: CriticalSlackLimit 2', days.xml.match(/<CriticalSlackLimit>([^<]*)</)?.[1], '2');
}
{
  const zero = await exportWith('mspdi', { mode: 'totalFloat', thresholdHours: 0 });
  eq('07 0 uur: geen melding', zero.keys, []);
  eq('08 0 uur: CriticalSlackLimit 0', zero.xml.match(/<CriticalSlackLimit>([^<]*)</)?.[1], '0');
}
{
  const longest = await exportWith('mspdi', { mode: 'longestPath', thresholdHours: 4 });
  eq('09 langste pad: geen uren-melding (de drempel telt daar niet)', longest.keys, []);
}
{
  const csv = await exportWith('csv', { mode: 'totalFloat', thresholdHours: 4 });
  eq('10 CSV: geen MSPDI-melding', csv.keys, []);
}

console.log(`check-mspdi-export-kritiek-uren-melding: ${checks} controles, ${diffs.length} fout`);
for (const d of diffs) console.log(`XX ${d}`);
process.exit(diffs.length === 0 ? 0 : 1);
