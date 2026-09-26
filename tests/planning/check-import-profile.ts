// Lezers stellen het bronprofiel voor (rekenprofielen, spec v3.1 §6; plan taak C3). Exit 0 = groen.
// Alles via parseOpenedFile — dezelfde formatRegistry-naad als Bestand → Openen.
// Verwachte profielen met de hand uit spec §6 (XER ⇒ P6 — tot 2026-09-24 met A19 uit rem_target_link_flag als
// afwijking; .mpp ⇒ MS Project; MSPDI/P6-XML/CSV ⇒ OPS in deze etappe). Mutatiebewijs (plan C3
// step 4): de A19-afwijking in xerReader altijd `{}` ⇒ assertie 04 rood.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOpenedFile } from '@/services/formatRegistry';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { CONVENTION_KEYS, builtInProfile, resolveConventions } from '@/engine/scheduler/conventions/registry';
import { writeCSV } from '@/services/csv/csvWriter';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import { installDOMParser } from './xmldom-shim';

installDOMParser();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const single = (value: Awaited<ReturnType<typeof parseOpenedFile>>): ImportResult => {
  if (isMultiDocumentImport(value)) throw new Error('verwachtte één document');
  return value;
};
const noConventionKeys = (r: ImportResult) =>
  Object.keys(r.project.schedulingOptions ?? {}).filter(k => (CONVENTION_KEYS as readonly string[]).includes(k) || k === 'p6Source');

function xer(remTargetLink: 'Y' | 'N'): Uint8Array {
  return new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
    '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\trem_target_link_flag',
    `%R\tP1\tProfielen\tC1\t2026-01-01\t2026-01-01\t${remTargetLink}`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tT1\tP1\tC1\tA1\tTaak\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09',
    '%E',
  ].join('\n'));
}

const x = single(await parseOpenedFile({ name: 'p.xer', bytes: xer('N') }));
eq('01 XER ⇒ p6 zonder overrides', x.project.schedulingProfile, builtInProfile('p6'));
eq('02 XER suggestedProfileId', x.suggestedProfileId, 'p6');
eq('03 XER-opties zonder conventie of p6Source', noConventionKeys(x), []);
const xy = single(await parseOpenedFile({ name: 'p.xer', bytes: xer('Y') }));
// Sinds 2026-09-24 (eigenaarsbesluit "a") stuurt rem_target_link_flag geen conventie meer: Y en N
// geven allebei de kale P6-basis (A19 aan). Mutant: de override in xerReader terugzetten ⇒ 04 rood.
eq('04 rem_target_link_flag=Y ⇒ óók p6 zonder overrides', xy.project.schedulingProfile, builtInProfile('p6'));
eq('04a A19 aan, ongeacht de vlag', [x, xy].map(r => resolveConventions(r.project.schedulingProfile).p6UseRemainingStartForProgress), [true, true]);

const project = { ...createDefaultProject(), startDate: '2026-06-01', name: 'Profiel' };
const calendar = createDefaultCalendar();
project.calendarId = calendar.id;
const task = {
  id: 't1', name: 'T1', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: createDefaultTaskTime('2026-06-01', 3),
} as Task;
const mspdi = single(await parseOpenedFile({ name: 'p.xml', text: writeMSPDI(project, calendar, [task], [], [], []) }));
eq('05 MSPDI ⇒ OPS in deze etappe', [mspdi.project.schedulingProfile, mspdi.suggestedProfileId], [undefined, 'ops']);
const p6xml = single(await parseOpenedFile({ name: 'p.xml', text: writeP6XML(project, calendar, [task], [], [], []) }));
eq('06 P6-XML ⇒ OPS in deze etappe', [p6xml.project.schedulingProfile, p6xml.suggestedProfileId], [undefined, 'ops']);
const csv = single(await parseOpenedFile({ name: 'p.csv', text: writeCSV(project, calendar, [task], [], [], []) }));
eq('07 CSV ⇒ OPS', [csv.project.schedulingProfile, csv.suggestedProfileId], [undefined, 'ops']);

// .mpp: corpus-optioneel (zelfde map als check-mpp-import). Zonder corpus: OK-regel, geen stille groen-claim.
const CORPUS = process.env.OPS_MPP_CORPUS ?? '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
const mppFile = existsSync(CORPUS) ? readdirSync(CORPUS).find(f => f.toLowerCase().endsWith('.mpp')) : undefined;
if (mppFile) {
  const mpp = single(await parseOpenedFile({ name: mppFile, bytes: new Uint8Array(readFileSync(join(CORPUS, mppFile))) }));
  eq('08 .mpp ⇒ msproject', [mpp.project.schedulingProfile, mpp.suggestedProfileId], [builtInProfile('msproject'), 'msproject']);
} else {
  console.log('OK: .mpp-corpus afwezig — assertie 08 overgeslagen (check-mpp-import dekt het corpusloze pad)');
}

if (diffs.length === 0) console.log(`OK: lezerprofielen — ${checks} checks groen`);
else { console.log(`XX lezerprofielen — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
