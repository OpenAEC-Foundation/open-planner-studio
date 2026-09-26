// Datum-tijden met een tijdzone-aanduiding uit een BESTAND lezen als wandklok. Het model rekent in
// lokale wandkloktijd; `hasNonAnchorTime` (dag-/uurmodusbeslissing) negeerde de offset al, maar het
// inlezen ging via `parseInstant`, dat hem toepaste: `09:30+01:00` werd als uurtaak herkend en om
// 08:30 ingelezen, en een tijd kort na middernacht landde op de vorige dag.
//
// Draait via run.sh. Exit 0 = alles groen.
import { installDOMParser } from './xmldom-shim';
import { useAppStore } from '@/state/appStore';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { importDateTime, importStatusDate, parseImportedInstant } from '@/services/importDates';
import { formatInstant } from '@/utils/dateUtils';

installDOMParser();
const S = () => useAppStore.getState();
let checks = 0;
const fails: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

// ── Unit ──
const h = (s: string) => formatInstant(parseImportedInstant(s), 'hour');
eq('+01:00 genegeerd', h('2026-03-09T09:30:00+01:00'), '2026-03-09T09:30');
eq('-05:00 genegeerd', h('2026-03-09T09:30:00-05:00'), '2026-03-09T09:30');
eq('+0100 (zonder dubbele punt) genegeerd', h('2026-03-09T00:30:00+0100'), '2026-03-09T00:30');
eq('Z ongewijzigd', h('2026-03-09T09:30:00Z'), '2026-03-09T09:30');
eq('zonder aanduiding ongewijzigd', h('2026-03-09T09:30:00'), '2026-03-09T09:30');
eq('milliseconden + Z', h('2026-03-09T09:30:00.250Z'), '2026-03-09T09:30');
eq('importDateTime uur', importDateTime('2026-03-09T00:30:00+01:00', true), '2026-03-09T00:30');
eq('importDateTime dag (prefix, ongewijzigd)', importDateTime('2026-03-09T00:30:00+01:00', false), '2026-03-09');
eq('importStatusDate', importStatusDate('2026-03-09T17:00:00+01:00'), '2026-03-09T17:00');

// ── End-to-end: MSPDI met offsettijden ──
S().newProject();
const a = S().addTask({ name: 'Offsettaak' });
void a;
S().runCPM();
const st = S();
let xml = writeMSPDI(st.project, st.calendar, st.tasks, st.sequences, st.resources, st.assignments, st.calendars);
const block = xml.match(/<Task>(?:(?!<\/Task>)[\s\S])*?<Name>Offsettaak<\/Name>[\s\S]*?<\/Task>/);
if (!block) throw new Error('taakblok niet gevonden');
const patched = block[0]
  .replace(/<Start>[^<]*<\/Start>/, '<Start>2026-03-09T09:30:00+01:00</Start>')
  .replace(/<Finish>[^<]*<\/Finish>/, '<Finish>2026-03-09T15:30:00+01:00</Finish>');
xml = xml.replace(block[0], patched);
const parsed = readMSPDI(xml);
const task = parsed.tasks.find((t) => t.name === 'Offsettaak');
eq('MSPDI: start als wandklok', task?.time.scheduleStart, '2026-03-09T09:30');
eq('MSPDI: einde als wandklok', task?.time.scheduleFinish, '2026-03-09T15:30');

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`check-import-tz-offset: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`check-import-tz-offset: ${checks}/${checks} groen`);
