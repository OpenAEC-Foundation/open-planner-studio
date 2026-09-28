// Import-audit 2026-09-26: twee stille dataverliezen bij openen, via de ECHTE writers/readers.
//
//  1. IFC: een LEGE naam (taak, resource, kalender, feestdag, werkende uitzondering) schrijft de
//     writer als STEP-null `$`; de reader las hem met een kale `stripQuotes` terug als de letterlijke
//     tekst "$" (truthy, dus de terugval greep niet). Na één keer opslaan + openen heetten naamloze
//     feestdagen uit een MSPDI/XER-import "$". Nu: `ifcSlotText`, net als de omschrijvingen (fix B7).
//  2. MSPDI: `<WorkWeeks><WorkWeek><WeekDays><WeekDay>` (een tijdelijke werkweek, bv. een
//     zomerrooster met zaterdag) heeft óók een `WeekDays`-ouder. De reader telde die dagen als
//     permanente werkdagen van de standaardweek — elke zaterdag van het jaar werd werkdag.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { createDefaultProject } from '@/state/slices/projectSlice';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import type { Task } from '@/types/task';
import type { Resource } from '@/types/resource';
import { installDOMParser } from './xmldom-shim';

installDOMParser();

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(label);
};

// ── 1. IFC: lege namen ─────────────────────────────────────────────────────────────────────────
{
  const project = createDefaultProject();
  const calendar = { ...createDefaultCalendar(), name: '', holidays: [{ name: '', startDate: '2026-12-25', endDate: '2026-12-25' }] };
  const task: Task = {
    id: 'task-leeg', name: '', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: createDefaultTaskTime(project.startDate, 1),
  };
  const resource = { id: 'res-leeg', name: '', type: 'LABOR', maxUnits: 1 } as unknown as Resource;
  const ifc = writeIFC({ project, calendar, tasks: [task], sequences: [], resources: [resource], assignments: [], customTaskTypes: [] });
  const back = readIFC(ifc);
  const names = [
    back.tasks[0]?.name,
    back.resources?.[0]?.name,
    back.calendar?.name,
    ...(back.calendar?.holidays ?? []).map(h => h.name),
  ];
  ok(`1 geen letterlijke "$" als naam na IFC-round-trip, kreeg ${JSON.stringify(names)}`, names.every(n => n !== '$'));
  ok(`1 elke naam is een string, kreeg ${JSON.stringify(names)}`, names.every(n => typeof n === 'string'));
}

// ── 2. MSPDI: tijdelijke werkweek lekt niet in de standaardweek ─────────────────────────────────
{
  const project = createDefaultProject();
  const calendar = createDefaultCalendar();
  const base = writeMSPDI(project, calendar, [], [], [], [], [], [], null, []);
  eq('2 voorwaarde: standaardweek ma-vr', readMSPDI(base).calendar?.workDays, calendar.workDays);

  // Een zomerrooster (juli) met zaterdag 06:00–12:00 als ENIGE werktijd van die tijdelijke week.
  const workWeeks = `<WorkWeeks><WorkWeek><TimePeriod><FromDate>2026-07-01T00:00:00</FromDate><ToDate>2026-07-31T23:59:00</ToDate></TimePeriod>`
    + `<Name>Zomer</Name><WeekDays><WeekDay><DayType>7</DayType><DayWorking>1</DayWorking>`
    + `<WorkingTimes><WorkingTime><FromTime>06:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime></WorkingTimes>`
    + `</WeekDay></WeekDays></WorkWeek></WorkWeeks>`;
  const firstCalEnd = base.indexOf('</Calendar>');
  ok('2 voorwaarde: de writer schrijft een <Calendar>', firstCalEnd > 0);
  const withWorkWeek = base.slice(0, firstCalEnd) + workWeeks + base.slice(firstCalEnd);
  const cal = readMSPDI(withWorkWeek).calendar;
  eq('2 zaterdag uit een tijdelijke werkweek wordt geen permanente werkdag', cal?.workDays, calendar.workDays);
  eq('2 de standaarduren komen uit de standaardweek, niet uit de tijdelijke', [cal?.workStartHour, cal?.workEndHour], [calendar.workStartHour, calendar.workEndHour]);
}

if (diffs.length === 0) {
  console.log(`OK  import-namen-werkweek: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  import-namen-werkweek: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
