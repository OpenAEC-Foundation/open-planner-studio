// Een MSPDI-relatie naar een taak in een ander project (`<CrossProject>1</CrossProject>`) mag nooit
// een interne relatie naar een gewone eigen taak worden.
//
// MS Project schrijft de externe taak zelf niet als `<Task>`; alleen de link staat er, met
// `CrossProjectName` = pad + "\" + taaknummer in het andere project (MPXJ `MSPDIWriter.java`,
// `writePredecessor`: "We'll just replicate what MS Project writes"; `MSPDIReader.java`,
// `createExternalTaskPlaceholder`). `PredecessorUID` is dan het nummer van de spooktaak, niet van een
// taak in dit bestand. Viel dat nummer toevallig samen met een eigen taak, dan maakte de lezer een
// relatie naar die (verkeerde) taak. Staat de spooktaak wél als `<Task>` met `<ExternalTask>1` in
// het bestand (andere schrijvers), dan blijft het gedrag van vóór deze check: de spooktaak wordt een
// gewone taak met die relatie, en de openingsmelding telt haar (`msProjectLostExternalTasks`).
import { readMSPDI } from '@/services/msproject/mspdiReader';
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
<Project xmlns="http://schemas.microsoft.com/project"><Name>Hoofdbouw</Name>
  <StartDate>2026-03-02T08:00:00</StartDate><MinutesPerDay>480</MinutesPerDay>${inner}</Project>`;
const task = (uid: number, name: string, extra = '') => `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${name}</Name>
  <OutlineLevel>1</OutlineLevel><Start>2026-03-02T08:00:00</Start><Finish>2026-03-03T17:00:00</Finish>
  <Duration>PT16H0M0S</Duration>${extra}</Task>`;
const link = (uid: number, crossProject: string | null) => `<PredecessorLink><PredecessorUID>${uid}</PredecessorUID>
  <Type>1</Type>${crossProject === null ? '' : `<CrossProject>${crossProject}</CrossProject>
  <CrossProjectName>C:\\Projecten\\Terrein.mpp\\5</CrossProjectName>`}<LinkLag>0</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`;
const relations = (xml: string) => {
  const result = readMSPDI(wrap(`<Tasks>${xml}</Tasks>`));
  const name = (id: string) => result.tasks.find(t => t.id === id)?.name;
  return result.sequences.map(s => `${name(s.predecessorId)} → ${name(s.successorId)}`);
};

eq('1 een gewone link blijft een interne relatie', relations(`${task(1, 'Grondwerk')}${task(2, 'Bestrating', link(1, null))}`),
  ['Grondwerk → Bestrating']);
eq('2 CrossProject=0 blijft een interne relatie', relations(`${task(1, 'Grondwerk')}${task(2, 'Bestrating', link(1, '0'))}`),
  ['Grondwerk → Bestrating']);
eq('3 CrossProject=1 met een UID buiten het bestand geeft geen relatie',
  relations(`${task(1, 'Grondwerk')}${task(2, 'Bestrating', link(9, '1'))}`), []);
eq('4 CrossProject=1 met de UID van een gewone eigen taak geeft GEEN relatie naar die taak',
  relations(`${task(1, 'Grondwerk')}${task(2, 'Bestrating', link(1, '1'))}`), []);
eq('5 CrossProject=true (andere schrijvers) telt ook als een ander project',
  relations(`${task(1, 'Grondwerk')}${task(2, 'Bestrating', link(1, 'true'))}`), []);
eq('6 een spooktaak met ExternalTask=1 in het bestand houdt haar relatie (ongewijzigd gedrag)',
  relations(`${task(1, 'Terrein bouwrijp', '<ExternalTask>1</ExternalTask>')}${task(2, 'Bestrating', link(1, '1'))}`),
  ['Terrein bouwrijp → Bestrating']);

if (failures.length) {
  console.error(`XX mspdi-cross-project: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK mspdi-cross-project: ${checks}/${checks}`);
