// Handmatig geplande taken in MS Project XML (MSPDI), issue #814.
// - Lezen: `<Manual>1` ⇒ `manuallyScheduled`; het ankerpaar `<ManualStart>`/`<ManualFinish>` wint van
//   `<Start>`/`<Finish>` (zelfde regel als de .mpp-lezer); zonder dat paar gelden `<Start>`/`<Finish>`.
//   `<Manual>0` en geen element ⇒ automatisch gepland.
// - Rekenen (de melding in #814): na F5 houdt een handmatige taak met 0 % voortgang haar datums, ook
//   met een statusdatum erna; een automatische tweelingtaak schuift wel.
// - Schrijven: `<Manual>1` met het ankerpaar, en terug lezen geeft dezelfde vlag en datums, ook voor een
//   gestarte taak (dan draagt `<Start>` de werkelijke start). Een automatische taak krijgt geen `<Manual>`.
// - Geen verliesmelding meer: het importverslag telt `<Manual>` niet (1g). Dat de MSPDI-export geen
//   categorie `manual-scheduling` meer meldt, toetst `check-xer-export-loss.ts`.
// MUTATIEBEWIJS: laat in `mspdiReader.ts` `isManual` altijd false zijn ⇒ 1a/2a/3c rood; laat de writer
// `<Manual>` weglaten ⇒ 3a/3c rood; laat het ankerpaar weg ⇒ 3d rood.
import { parseOpenedFile } from '@/services/formatRegistry';
import { useAppStore } from '@/state/appStore';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import type { ImportResult } from '@/services/importTypes';
import { activeImportResult } from '@/services/importTypes';
import { installDOMParser } from './xmldom-shim';

declare const process: { exitCode?: number };
installDOMParser();
const S = () => useAppStore.getState();

const fails: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
const day = (iso: string | undefined) => iso?.slice(0, 10);

const wrap = (inner: string, statusDate = '') => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Handmatig</Name><StartDate>2026-03-02T08:00:00</StartDate><MinutesPerDay>480</MinutesPerDay>
  ${statusDate ? `<StatusDate>${statusDate}</StatusDate>` : ''}
  <Tasks>${inner}</Tasks>
</Project>`;

const task = (uid: number, name: string, start: string, finish: string, extra = '') =>
  `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${name}</Name>
  <OutlineLevel>1</OutlineLevel><Start>${start}</Start><Finish>${finish}</Finish>
  <Duration>PT16H0M0S</Duration>${extra}</Task>`;

const byName = (result: ImportResult, name: string) => result.tasks.find(t => t.name === name);

async function main(): Promise<void> {
  // (1) Lezen.
  const read = readMSPDI(wrap([
    task(1, 'Handmatig', '2026-03-02T08:00:00', '2026-03-03T17:00:00', '<Manual>1</Manual>'),
    task(2, 'Handmatig met anker', '2026-03-04T08:00:00', '2026-03-05T17:00:00',
      '<Manual>1</Manual><ManualStart>2026-03-09T08:00:00</ManualStart><ManualFinish>2026-03-10T17:00:00</ManualFinish>'),
    task(3, 'Automatisch', '2026-03-02T08:00:00', '2026-03-03T17:00:00', '<Manual>0</Manual>'),
    task(4, 'Zonder element', '2026-03-02T08:00:00', '2026-03-03T17:00:00'),
    task(5, 'Automatisch met anker', '2026-03-02T08:00:00', '2026-03-03T17:00:00',
      '<ManualStart>2026-03-09T08:00:00</ManualStart><ManualFinish>2026-03-10T17:00:00</ManualFinish>'),
  ].join('\n')));
  eq('1a <Manual>1 ⇒ handmatig', byName(read, 'Handmatig')?.manuallyScheduled, true);
  eq('1b handmatig zonder ankerpaar: <Start>/<Finish>',
    [day(byName(read, 'Handmatig')?.time.scheduleStart), day(byName(read, 'Handmatig')?.time.scheduleFinish)],
    ['2026-03-02', '2026-03-03']);
  eq('1c handmatig met ankerpaar: het ankerpaar wint',
    [day(byName(read, 'Handmatig met anker')?.time.scheduleStart), day(byName(read, 'Handmatig met anker')?.time.scheduleFinish)],
    ['2026-03-09', '2026-03-10']);
  eq('1d <Manual>0 ⇒ automatisch', byName(read, 'Automatisch')?.manuallyScheduled, undefined);
  eq('1e geen <Manual> ⇒ automatisch', byName(read, 'Zonder element')?.manuallyScheduled, undefined);
  eq('1f automatisch: het ankerpaar telt niet',
    day(byName(read, 'Automatisch met anker')?.time.scheduleStart), '2026-03-02');
  eq('1g geen importverslag voor <Manual>', read.msProjectReport, undefined);

  // (2) De melding in #814: na F5 schuift een niet-gestarte handmatige taak niet naar de statusdatum.
  const parsed = await parseOpenedFile({ name: 'statusdatum.xml', text: wrap([
    task(1, 'Handmatig', '2026-03-02T08:00:00', '2026-03-03T17:00:00', '<Manual>1</Manual><PercentComplete>0</PercentComplete>'),
    task(2, 'Automatisch', '2026-03-02T08:00:00', '2026-03-03T17:00:00', '<PercentComplete>0</PercentComplete>'),
  ].join('\n'), '2026-03-16T08:00:00') });
  S().newProject();
  S().applyOpenedImport(parsed, { filePath: null, recompute: true, fit: false, linkedOpen: true });
  S().runCPM();
  const live = (name: string) => S().tasks.find(t => t.name === name);
  eq('2a handmatige taak na F5 nog handmatig', live('Handmatig')?.manuallyScheduled, true);
  eq('2b handmatige taak houdt haar datums', [day(live('Handmatig')?.time.earlyStart), day(live('Handmatig')?.time.earlyFinish)],
    ['2026-03-02', '2026-03-03']);
  // Tegenproef: zonder de vlag schuift dezelfde taak wel (anders toetst 2b niets).
  eq('2c automatische tweeling schuift naar de statusdatum', (day(live('Automatisch')?.time.earlyStart) ?? '') >= '2026-03-16', true);

  // (3) Schrijven en terug lezen, met een gestarte handmatige taak.
  const source = activeImportResult(parsed);
  const tasks = S().tasks.map(t => structuredClone(t));
  const started = tasks.find(t => t.name === 'Handmatig')!;
  started.time.actualStart = '2026-03-04T08:00:00';
  started.time.completion = 0.25;
  const written = writeMSPDI(S().project, S().calendar, tasks, S().sequences, S().resources, S().assignments,
    source.resourceCalendars ?? [], [], null, []);
  eq('3a de export schrijft <Manual>1 één keer', written.split('<Manual>1</Manual>').length - 1, 1);
  eq('3b een automatische taak krijgt geen <Manual>', written.includes('<Manual>0</Manual>'), false);
  const back = readMSPDI(written);
  eq('3c terug gelezen: handmatig', [byName(back, 'Handmatig')?.manuallyScheduled, byName(back, 'Automatisch')?.manuallyScheduled],
    [true, undefined]);
  eq('3d terug gelezen: het anker, niet de werkelijke start',
    [day(byName(back, 'Handmatig')?.time.scheduleStart), day(byName(back, 'Handmatig')?.time.scheduleFinish)],
    [day(started.time.scheduleStart), day(started.time.scheduleFinish)]);
  eq('3e terug gelezen: de werkelijke start blijft', day(byName(back, 'Handmatig')?.time.actualStart), '2026-03-04');

}

main().then(() => {
  if (fails.length > 0) {
    for (const f of fails) console.log(`XX  mspdi-handmatig: ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`OK  mspdi-handmatig: ${checks} controles groen`);
  }
}, (error: unknown) => {
  console.log(`XX  mspdi-handmatig: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
