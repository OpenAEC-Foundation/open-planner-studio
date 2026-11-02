// X9 — P6XML is geen gelijkwaardige XER-archiefadapter. Deze smoke bewaakt de zichtbare asymmetrie.
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { readFileSync } from 'node:fs';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { createDefaultProject } from '@/state/defaults';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { installDOMParser } from './xmldom-shim';
import { XER_DURATION_TYPE_TOKEN } from '@/engine/work/workRuleMapping';
import { DEFAULT_WORK_RULE } from '@/types/workRule';

declare const process: { exit(code: number): never };
installDOMParser();
const failures: string[] = [];
const expect = (label: string, condition: boolean) => { if (!condition) failures.push(label); };
const project = createDefaultProject();
project.id = 'P6XML-X9'; project.name = 'P6XML asymmetrie';
const calendar = createDefaultCalendar(); project.calendarId = calendar.id;
const task = {
  id: 'p6xml-x9-task', name: 'P6 velden', description: '', wbsCode: 'A1',
  taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
  parentId: null, childIds: [], resourceIds: [], time: createDefaultTaskTime('2032-02-02', 1),
  p6ProjectId: 'XER-PROJ', p6TaskId: 'XER-TASK', p6DurationType: 'DT_FixedRate',
  p6ActivityType: 'TT_LOE', p6CompletePctType: 'CP_Phys', p6ExpectedFinish: '2032-02-10',
} as Task;
const warnings: string[] = [];
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
let xml = '';
try { xml = writeP6XML(project, calendar, [task], [], [], []); } finally { console.warn = originalWarn; }
const roundTripped = readP6XML(xml).tasks.find(candidate => candidate.name === task.name);
expect('1 P6XML schrijft reguliere planningdata', xml.includes('<Activity>') && roundTripped !== undefined);
// Taaktypes-etappe (2026-09-05, bouwstap 2): <DurationType> is sindsdien de ENE uitzondering op de
// asymmetrie — de writer schrijft het label uit de werkregel of het bewaarde token, de lezer leest
// het terug (spec §4.4). De overige P6-velden blijven éénrichting.
// Sinds #775 zet de P6 XML-lezer zijn EIGEN P6-herkomst (ObjectId's en het activiteittype uit `<Type>`), zodat de
// P6-regels in de motor gelden zoals bij een XER. De XER-identiteit en het XER-type van het origineel gaan niet mee.
expect('2 P6XML claimt geen XER/P6-veldpariteit (behalve DurationType, taaktypes-etappe)',
  // Zonder eigen werkregel erft de taak de projectstandaard; de schrijver schrijft dan geen eigen <DurationType>
  // (review Sol #781), en de lezer geeft haar het token van `ActivityDefaultDurationType`, zonder eigen regel.
  roundTripped?.p6DurationType === XER_DURATION_TYPE_TOKEN[DEFAULT_WORK_RULE]
  && roundTripped?.workRule === undefined
  && roundTripped?.p6ActivityType === 'TT_Task'
  && roundTripped?.p6ProjectId !== undefined && roundTripped?.p6ProjectId !== 'XER-PROJ'
  && roundTripped?.p6TaskId !== undefined && roundTripped?.p6TaskId !== 'XER-TASK');
expect('3 de asymmetrie is als TODO in de writer vastgelegd',
  warnings.length === 0
  && xml.includes('<PlannedDuration>')
  && readFileSync(new URL('../../src/services/p6/p6xmlWriter.ts', import.meta.url), 'utf8').includes('TODO(X9/P6XML)'));
// Contour-engine-vervolgafspraak (2026-09, taaktypes-etappe): `<DurationType>` is de ENE asymmetrie
// die niet langer tweerichtingsverkeer mist op de lezer — writeP6XML schrijft het element niet (zie
// hierboven, assertie 2/3 blijven onveranderd waar), maar readP6XML leest het nu wél wanneer een
// ECHT P6-bestand (niet onze eigen writer) het meebrengt. Injecteer het element handmatig in de
// writer-uitvoer (dezelfde truc als de rest van dit bestand voor "een echt P6-bestand zou dit
// dragen") om de vier canonieke PMXML-labels en de gerapporteerde terugval te bewijzen.
function withDurationType(baseXml: string, label: string | null): string {
  // Sinds bouwstap 2 van de taaktypes-etappe schrijft de writer het element zelf; strip het eerst,
  // zodat elke case hieronder precies één (of géén) <DurationType> ziet.
  const stripped = baseXml.replace(/\s*<DurationType>[^<]*<\/DurationType>/, '');
  if (label === null) return stripped;
  return stripped.replace(/(<Activity>[\s\S]*?<Type>[^<]*<\/Type>)/, `$1<DurationType>${label}</DurationType>`);
}
function readDurationType(label: string | null): { value: string | undefined; warnings: string[] } {
  const warned: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => warned.push(args.join(' '));
  let value: string | undefined;
  try {
    value = readP6XML(withDurationType(xml, label)).tasks.find(t => t.name === task.name)?.p6DurationType;
  } finally {
    console.warn = original;
  }
  return { value, warnings: warned };
}

// Taaktypes-etappe (2026-09-05): paren volgens Oracle's XER Import/Export Data Map Guide
// (TASK.duration_type): DT_FixedDrtn = "Fixed Duration and Units/Time", DT_FixedDUR2 = "Fixed
// Duration and Units". De vorige versie van deze tabel had de twee Fixed-Duration-labels verwisseld.
const knownDurationTypeLabels: Readonly<Record<string, string>> = {
  'Fixed Duration and Units': 'DT_FixedDUR2',
  'Fixed Duration and Units/Time': 'DT_FixedDrtn',
  'Fixed Units/Time': 'DT_FixedRate',
  'Fixed Units': 'DT_FixedQty',
};
for (const [label, expected] of Object.entries(knownDurationTypeLabels)) {
  const { value, warnings: labelWarnings } = readDurationType(label);
  expect(`4 <DurationType>${label}</DurationType> leest naar ${expected}, geen melding`,
    value === expected && labelWarnings.length === 0);
}

// Sinds #775 erft een activiteit zonder bruikbaar `<DurationType>` de projectstandaard (`ActivityDefaultDurationType`),
// zoals een XER-activiteit `PROJECT.def_duration_type` erft. De schrijver zet die standaard altijd.
const projectDefaultToken = XER_DURATION_TYPE_TOKEN[DEFAULT_WORK_RULE];
const { value: unknownValue, warnings: unknownWarnings } = readDurationType('Fixed Whatever');
expect('5 onbekend <DurationType>-label erft de projectstandaard en wordt gerapporteerd',
  unknownValue === projectDefaultToken
  && unknownWarnings.length === 1
  && unknownWarnings[0].includes('Fixed Whatever'));

const { value: missingValue, warnings: missingWarnings } = readDurationType(null);
expect('6 ontbrekend <DurationType>-element erft de projectstandaard, geen melding',
  missingValue === projectDefaultToken && missingWarnings.length === 0);

if (failures.length === 0) {
  console.log('OK  xer-p6xml-parity: asymmetrie zichtbaar, geen gelijkwaardigheidsclaim');
  process.exit(0);
}
console.log(`XX  xer-p6xml-parity: ${failures.length} afwijking(en)`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
