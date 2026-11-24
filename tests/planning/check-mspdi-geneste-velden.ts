// Knownbug 2011: een veld dat op een MSPDI-taak ontbreekt, mag NIET uit een genest element van die
// taak komen (`<PredecessorLink>`, `<Baseline>`, …). Taakvelden komen alleen uit de directe kinderen
// van `<Task>`; een relatie leest haar velden uit haar eigen element, een baseline uit het hare.
// Een bestand dat alle velden wél op de taak heeft, leest exact hetzelfde in als eerst.
import { readMSPDI } from '@/services/msproject/mspdiReader';
import type { ImportResult } from '@/services/importTypes';
import { localTodayIso } from '@/utils/dateUtils';
import { hourTaskScheduleDuration } from '@/utils/taskDuration';
import { installDOMParser } from './xmldom-shim';

installDOMParser();
let checks = 0;
const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
};

const wrap = (inner: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>Geneste velden</Name>
  <StartDate>2026-03-02T08:00:00</StartDate><MinutesPerDay>480</MinutesPerDay>${inner}</Project>`;

const task = (uid: number, name: string, extra = '', withDuration = true) => `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${name}</Name>
  <OutlineLevel>1</OutlineLevel><Start>2026-03-02T08:00:00</Start><Finish>2026-03-03T17:00:00</Finish>${withDuration ? `
  <Duration>PT16H0M0S</Duration>` : ''}${extra}</Task>`;

const link = (predUid: number, type: number) => `<PredecessorLink><PredecessorUID>${predUid}</PredecessorUID>
  <Type>${type}</Type><LinkLag>0</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`;

const baseline = (duration: string) => `<Baseline><Number>0</Number><Start>2026-03-09T08:00:00</Start>
  <Finish>2026-03-13T17:00:00</Finish><Duration>${duration}</Duration></Baseline>`;

const read = (tasksXml: string): ImportResult => readMSPDI(wrap(`<Tasks>${tasksXml}</Tasks>`));
const byName = (r: ImportResult, name: string) => r.tasks.find(t => t.name === name);

// 1. Taak zonder <Type> met een <PredecessorLink> met <Type>2</Type>: de linktype mag niet als
//    taaktype instromen. De relatie zelf houdt haar eigen type (2 = START_FINISH).
{
  const r = read(`${task(1, 'Voor')}${task(2, 'Na', link(1, 2))}`);
  eq('1a taak zonder eigen Type krijgt geen mspTaskType uit de link', byName(r, 'Na')?.mspTaskType, undefined);
  eq('1b de relatie leest haar Type uit haar eigen element', r.sequences.map(s => s.type), ['START_FINISH']);
}

// 2. Taak zonder <Duration> met een <Baseline> met <Duration>PT40H0M0S</Duration>: de baselineduur
//    mag niet als taakduur instromen. De baseline zelf houdt haar eigen duur (2400 min = 5 dagen).
{
  const r = read(`${task(1, 'Baseline-alleen', baseline('PT40H0M0S'), false)}`);
  const t = byName(r, 'Baseline-alleen');
  eq('2a taak zonder eigen Duration krijgt geen duur uit de baseline', t?.time.durationMinutes, 0);
  eq('2b idem voor de planningduur', t?.time.scheduleDuration, 0);
  eq('2c de baseline leest haar Duration uit haar eigen element', r.baselines[0]?.tasks[0]?.duration,
    hourTaskScheduleDuration(2400, r.calendar));
}

// 3. Taak zonder <Start>/<Finish> met een <Baseline> met eigen datums: de taakstart mag niet uit de
//    baseline komen (valt terug op vandaag, zoals bij een missende datum).
{
  const noDates = `<Task><UID>1</UID><ID>1</ID><Name>Zonder datums</Name><OutlineLevel>1</OutlineLevel>
  <Duration>PT16H0M0S</Duration>${baseline('PT40H0M0S')}</Task>`;
  const r = read(noDates);
  eq('3a taak zonder eigen Start krijgt geen start uit de baseline',
    byName(r, 'Zonder datums')?.time.scheduleStart, localTodayIso());
}

// 4. Controle: alle velden wél op de taak — dan leest het bestand exact hetzelfde in als eerst: het
//    eigen <Type> wint van de link, de eigen <Duration> van de baseline.
{
  const r = read(`${task(1, 'Voor', '<Type>1</Type>')}${task(2, 'Na', `<Type>1</Type>${link(1, 2)}${baseline('PT40H0M0S')}`)}`);
  eq('4a eigen Type op de taak wint van de link-Type', byName(r, 'Na')?.mspTaskType, 'FIXED_DURATION');
  eq('4b de relatie houdt haar eigen Type', r.sequences.map(s => s.type), ['START_FINISH']);
  eq('4c eigen Duration op de taak wint van de baseline-Duration', byName(r, 'Na')?.time.durationMinutes, 960);
  eq('4d de baseline houdt haar eigen Duration', r.baselines[0]?.tasks[0]?.duration,
    hourTaskScheduleDuration(2400, r.calendar));
}

if (failures.length) {
  console.error(`XX mspdi-geneste-velden: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK mspdi-geneste-velden: ${checks}/${checks}`);
