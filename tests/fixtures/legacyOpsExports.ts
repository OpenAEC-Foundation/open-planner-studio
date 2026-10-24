// Exports van de ECHTE writers van oude OPS-versies, voor de regressies van review #591 r1 (punt 1 en 2):
// een oude OPS-export leest met de tijdregel van zijn eigen writer (`xmlInterchange.ts`, `XmlTimeRule`).
//
// Herkomst (gemaakt op 2026-10-24, F5b fixronde 1). Per versie de bron met `git archive <versie> src
// tsconfig.json` naar /tmp, en het generatorscript hieronder gebundeld met de esbuild van deze repo en
// `--alias:@=<map>/src` (de imports wijzen dus naar de code van die versie, niet naar die van nu):
//   - v2026.6.0 (417fd0bf5) en v2026.7.0 (e9e8db1db): `gen-legacy.ts`, met een los projectobject in plaats
//     van `createDefaultProject` (die versies hebben nog geen `state/defaults.ts`). Hun uitvoer is byte-gelijk;
//     hier staat v2026.7.0. Die writers schrijven nog geen `<StatusDate>`/`<DataDate>`.
//   - v2026.7.14 (ca652f967), v2026.8.0 (4aaa5305f) en v2026.8.1 (af71257f8): `gen-legacy.ts`. Hun uitvoer is
//     byte-gelijk; hier staat v2026.8.1. Geen van deze versies schrijft een OPS-markering.
//   - de basis van F5b, 2c7e33134 (F5a), en v2026.10.0 (a3827b55b): `gen-hours.ts`. Beide schrijven de
//     duureenheidmarkering, geen `OPS_LiteralCalendars`.
// De sha256 van elk bestand staat bij de constante. `git archive` en esbuild draaiden buiten de repo; er is
// niets van die versies in deze repo gekopieerd behalve hun uitvoer.
//
// gen-legacy.ts (punt 2: een voltooide dagtaak van twee werkdagen, kalender 08:00–16:00):
//   // Generator voor de regressiefixtures van fixronde 1 (#591): draait de ECHTE writers van een oude versie.
//   // Bundel met --alias:@=/tmp/f5b-old/<versie>/src. Gebruikt voor v2026.6.0 tot en met v2026.8.1 (geen OPS-markering).
//   import { writeMSPDI } from '@/services/msproject/mspdiWriter';
//   import { writeP6XML } from '@/services/p6/p6xmlWriter';
//   import { createDefaultProject } from '@/state/defaults';
//   import type { Task } from '@/types/task';
//   import type { WorkCalendar } from '@/types/calendar';
//   import type { Sequence } from '@/types/sequence';
//   import { writeFileSync } from 'node:fs';
//
//   const calendar: WorkCalendar = {
//     id: 'cal-default', name: 'Kalender 08-16', description: 'ma-vr 08:00-16:00',
//     workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
//   } as WorkCalendar;
//   const base = (id: string, name: string, wbs: string): Task => ({
//     id, name, description: '', wbsCode: wbs, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
//     priority: 500, parentId: null, childIds: [], resourceIds: [],
//     time: {
//       durationType: 'WORKTIME', scheduleDuration: 0, scheduleStart: '', scheduleFinish: '',
//       earlyStart: '', earlyFinish: '', lateStart: '', lateFinish: '', freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
//     },
//   } as unknown as Task);
//   // A: voltooide dagtaak van twee werkdagen, 1–2 juni (het geval van review r1, punt 2).
//   const a = base('task-a', 'Voltooid 1-2 juni', '1');
//   Object.assign(a, { status: 'COMPLETED' });
//   Object.assign(a.time, {
//     scheduleDuration: 2, scheduleStart: '2026-06-01', scheduleFinish: '2026-06-02',
//     earlyStart: '2026-06-01', earlyFinish: '2026-06-02', lateStart: '2026-06-01', lateFinish: '2026-06-02',
//     actualStart: '2026-06-01', actualFinish: '2026-06-02', completion: 1, remainingTime: 0, isCritical: true,
//   });
//   // B: niet-gestarte opvolger (FS), 3–4 juni.
//   const b = base('task-b', 'Opvolger 3-4 juni', '2');
//   Object.assign(b.time, {
//     scheduleDuration: 2, scheduleStart: '2026-06-03', scheduleFinish: '2026-06-04',
//     earlyStart: '2026-06-03', earlyFinish: '2026-06-04', lateStart: '2026-06-03', lateFinish: '2026-06-04', isCritical: true,
//   });
//   const seq = { id: 'seq-1', predecessorId: 'task-a', successorId: 'task-b', type: 'FINISH_START', lagDays: 0 } as unknown as Sequence;
//   const project = { ...createDefaultProject(), id: 'proj-oud', modifiedAt: '2026-06-03T10:00:00.000Z', name: 'Oude export', startDate: '2026-06-01', statusDate: '2026-06-03', createdAt: '2026-06-01T09:12:00.000Z' };
//   const out = process.env.OUT!;
//   writeFileSync(`${out}.mspdi.xml`, writeMSPDI(project, calendar, [a, b], [seq], [], []));
//   writeFileSync(`${out}.p6.xml`, writeP6XML(project, calendar, [a, b], [seq], [], []));
//   console.log('ok', out);
//
// gen-hours.ts (punt 1: een voltooide urentaak van 07:00 tot 08:00, kalender 07:00–15:00):
//   // Generator voor de regressiefixtures van fixronde 1 (#591), punt 1: draait de ECHTE writers van de basis
//   // (2c7e33134) en van v2026.10.0. Bundel met --alias:@=/tmp/f5b-old/<versie>/src.
//   import { writeMSPDI } from '@/services/msproject/mspdiWriter';
//   import { writeP6XML } from '@/services/p6/p6xmlWriter';
//   import { createDefaultProject } from '@/state/defaults';
//   import type { Task } from '@/types/task';
//   import type { WorkCalendar } from '@/types/calendar';
//   import type { Sequence } from '@/types/sequence';
//   import { writeFileSync } from 'node:fs';
//
//   const day = [{ start: 7 * 60, end: 15 * 60 }];
//   const calendar: WorkCalendar = {
//     id: 'cal-default', name: 'Kalender 07-15', description: 'ma-vr 07:00-15:00',
//     workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
//     workTime: { byWeekday: { 1: day, 2: day, 3: day, 4: day, 5: day, 6: [], 7: [] } },
//   } as WorkCalendar;
//   const base = (id: string, name: string, wbs: string): Task => ({
//     id, name, description: '', wbsCode: wbs, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
//     priority: 500, parentId: null, childIds: [], resourceIds: [],
//     time: {
//       durationType: 'WORKTIME', durationUnit: 'hours', scheduleDuration: 0, scheduleStart: '', scheduleFinish: '',
//       earlyStart: '', earlyFinish: '', lateStart: '', lateFinish: '', freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
//     },
//   } as unknown as Task);
//   // A: voltooide urentaak 07:00–08:00 (60 min) op 1 juni (het geval van review r1, punt 1).
//   const a = base('task-a', 'Voltooid 07-08', '1');
//   Object.assign(a, { status: 'COMPLETED' });
//   Object.assign(a.time, {
//     scheduleDuration: 60 / 480, durationMinutes: 60,
//     scheduleStart: '2026-06-01T07:00', scheduleFinish: '2026-06-01T08:00',
//     earlyStart: '2026-06-01T07:00', earlyFinish: '2026-06-01T08:00', lateStart: '2026-06-01T07:00', lateFinish: '2026-06-01T08:00',
//     actualStart: '2026-06-01T07:00', actualFinish: '2026-06-01T08:00', completion: 1, remainingMinutes: 0, isCritical: true,
//   });
//   // B: niet-gestarte urentaak (FS), 08:00–10:00 op 1 juni: een echte start om 08:00.
//   const b = base('task-b', 'Opvolger 08-10', '2');
//   Object.assign(b.time, {
//     scheduleDuration: 120 / 480, durationMinutes: 120,
//     scheduleStart: '2026-06-01T08:00', scheduleFinish: '2026-06-01T10:00',
//     earlyStart: '2026-06-01T08:00', earlyFinish: '2026-06-01T10:00', lateStart: '2026-06-01T08:00', lateFinish: '2026-06-01T10:00', isCritical: true,
//   });
//   const seq = { id: 'seq-1', predecessorId: 'task-a', successorId: 'task-b', type: 'FINISH_START', lagDays: 0 } as unknown as Sequence;
//   const project = { ...createDefaultProject(), id: 'proj-uren', modifiedAt: '2026-06-01T10:00:00.000Z', name: 'Urenexport',
//     startDate: '2026-06-01', createdAt: '2026-06-01T09:12:00.000Z' };
//   const out = process.env.OUT!;
//   writeFileSync(`${out}.mspdi.xml`, writeMSPDI(project, calendar, [a, b], [seq], [], []));
//   writeFileSync(`${out}.p6.xml`, writeP6XML(project, calendar, [a, b], [seq], [], []));
//   console.log('ok', out);

/** `v2026.7.0.mspdi.xml`, sha256 4fa04c4bd6b8d99a650cacdc98699de2852819ebc46b2024f124cc3e1c6f29e0. */
export const LEGACY_V2026_7_0_MSPDI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Oude export</Name>
  <Title>Oude export</Title>
  <Author></Author>
  <Company></Company>
  <CreationDate>2026-06-01T08:00:00</CreationDate>
  <StartDate>2026-06-01T08:00:00</StartDate>
  <ScheduleFromStart>1</ScheduleFromStart>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Kalender 08-16</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <WeekDays>
        <WeekDay>
          <DayType>2</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>08:00:00</FromTime>
              <ToTime>16:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>3</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>08:00:00</FromTime>
              <ToTime>16:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>4</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>08:00:00</FromTime>
              <ToTime>16:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>5</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>08:00:00</FromTime>
              <ToTime>16:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>6</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>08:00:00</FromTime>
              <ToTime>16:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>7</DayType>
          <DayWorking>0</DayWorking>
        </WeekDay>
        <WeekDay>
          <DayType>1</DayType>
          <DayWorking>0</DayWorking>
        </WeekDay>
      </WeekDays>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>Oude export</Name>
      <OutlineLevel>0</OutlineLevel>
      <Summary>1</Summary>
    </Task>
    <Task>
      <UID>1</UID>
      <ID>1</ID>
      <Name>Voltooid 1-2 juni</Name>
      <Duration>PT16H0M0S</Duration>
      <Start>2026-06-01T08:00:00</Start>
      <Finish>2026-06-02T08:00:00</Finish>
      <WBS>1</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <PercentComplete>100</PercentComplete>
      <Priority>500</Priority>
      <CalendarUID>1</CalendarUID>
    </Task>
    <Task>
      <UID>2</UID>
      <ID>2</ID>
      <Name>Opvolger 3-4 juni</Name>
      <Duration>PT16H0M0S</Duration>
      <Start>2026-06-03T08:00:00</Start>
      <Finish>2026-06-04T08:00:00</Finish>
      <WBS>2</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <PercentComplete>0</PercentComplete>
      <Priority>500</Priority>
      <CalendarUID>1</CalendarUID>
      <PredecessorLink>
        <PredecessorUID>1</PredecessorUID>
        <Type>1</Type>
        <LinkLag>0</LinkLag>
        <LagFormat>7</LagFormat>
      </PredecessorLink>
    </Task>
  </Tasks>
</Project>`;

/** `v2026.7.0.p6.xml`, sha256 d26c00a1bd8429e862556f5f3c31044dd5259dcccd001fb5342c875b3a8cab9f. */
export const LEGACY_V2026_7_0_P6 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V23.12/API/BusinessObjects" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Project>
    <ObjectId>1</ObjectId>
    <Id>proj-oud</Id>
    <Name>Oude export</Name>
    <Description></Description>
    <PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate>
    <Status>Planned</Status>
  </Project>
  <Calendar>
    <ObjectId>1</ObjectId>
    <Name>Kalender 08-16</Name>
    <Type>Global</Type>
    <HoursPerDay>8</HoursPerDay>
    <HoursPerWeek>40</HoursPerWeek>
    <HoursPerMonth>160</HoursPerMonth>
  </Calendar>
  <Activity>
    <ObjectId>1</ObjectId>
    <Id>1</Id>
    <Name>Voltooid 1-2 juni</Name>
    <ProjectObjectId>1</ProjectObjectId>
    <Type>Task Dependent</Type>
    <Status>Completed</Status>
    <PlannedDuration>16</PlannedDuration>
    <PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate>
    <PlannedFinishDate>2026-06-02T08:00:00</PlannedFinishDate>
    <PhysicalPercentComplete>100</PhysicalPercentComplete>
    <CalendarObjectId>1</CalendarObjectId>
  </Activity>
  <Activity>
    <ObjectId>2</ObjectId>
    <Id>2</Id>
    <Name>Opvolger 3-4 juni</Name>
    <ProjectObjectId>1</ProjectObjectId>
    <Type>Task Dependent</Type>
    <Status>Not Started</Status>
    <PlannedDuration>16</PlannedDuration>
    <PlannedStartDate>2026-06-03T08:00:00</PlannedStartDate>
    <PlannedFinishDate>2026-06-04T08:00:00</PlannedFinishDate>
    <CalendarObjectId>1</CalendarObjectId>
  </Activity>
  <Relationship>
    <ObjectId>1</ObjectId>
    <PredecessorActivityObjectId>1</PredecessorActivityObjectId>
    <SuccessorActivityObjectId>2</SuccessorActivityObjectId>
    <Type>PR_FS</Type>
    <Lag>0</Lag>
    <ProjectObjectId>1</ProjectObjectId>
  </Relationship>
</APIBusinessObjects>`;

/** `v2026.8.1.mspdi.xml`, sha256 1b31f65c4292b94151ba82772e9a582f6d48667b82e8f5fa357a128cc6f0fddd. */
export const LEGACY_V2026_8_1_MSPDI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Oude export</Name>
  <Title>Oude export</Title>
  <Author></Author>
  <Company></Company>
  <CreationDate>2026-06-01T08:00:00</CreationDate>
  <StartDate>2026-06-01T08:00:00</StartDate>
  <StatusDate>2026-06-03T08:00:00</StatusDate>
  <ScheduleFromStart>1</ScheduleFromStart>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Kalender 08-16</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <WeekDays>
        <WeekDay>
          <DayType>2</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>08:00:00</FromTime>
              <ToTime>16:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>3</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>08:00:00</FromTime>
              <ToTime>16:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>4</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>08:00:00</FromTime>
              <ToTime>16:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>5</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>08:00:00</FromTime>
              <ToTime>16:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>6</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>08:00:00</FromTime>
              <ToTime>16:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>7</DayType>
          <DayWorking>0</DayWorking>
        </WeekDay>
        <WeekDay>
          <DayType>1</DayType>
          <DayWorking>0</DayWorking>
        </WeekDay>
      </WeekDays>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>Oude export</Name>
      <OutlineLevel>0</OutlineLevel>
      <Summary>1</Summary>
    </Task>
    <Task>
      <UID>1</UID>
      <ID>1</ID>
      <Name>Voltooid 1-2 juni</Name>
      <Duration>PT16H0M0S</Duration>
      <Start>2026-06-01T08:00:00</Start>
      <Finish>2026-06-02T08:00:00</Finish>
      <WBS>1</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <PercentComplete>100</PercentComplete>
      <ActualStart>2026-06-01T08:00:00</ActualStart>
      <ActualFinish>2026-06-02T08:00:00</ActualFinish>
      <RemainingDuration>PT0H0M0S</RemainingDuration>
      <Priority>500</Priority>
      <CalendarUID>1</CalendarUID>
    </Task>
    <Task>
      <UID>2</UID>
      <ID>2</ID>
      <Name>Opvolger 3-4 juni</Name>
      <Duration>PT16H0M0S</Duration>
      <Start>2026-06-03T08:00:00</Start>
      <Finish>2026-06-04T08:00:00</Finish>
      <WBS>2</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <PercentComplete>0</PercentComplete>
      <Priority>500</Priority>
      <CalendarUID>1</CalendarUID>
      <PredecessorLink>
        <PredecessorUID>1</PredecessorUID>
        <Type>1</Type>
        <LinkLag>0</LinkLag>
        <LagFormat>7</LagFormat>
      </PredecessorLink>
    </Task>
  </Tasks>
  <Resources>
  </Resources>
</Project>`;

/** `v2026.8.1.p6.xml`, sha256 642e2f9807359f98fd332a7f6926c2c4fd7986630253db891f09b46a7c59aa27. */
export const LEGACY_V2026_8_1_P6 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V23.12/API/BusinessObjects" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Project>
    <ObjectId>1</ObjectId>
    <Id>proj-oud</Id>
    <Name>Oude export</Name>
    <Description></Description>
    <PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate>
    <Status>Planned</Status>
    <DataDate>2026-06-03T08:00:00</DataDate>
  </Project>
  <Calendar>
    <ObjectId>1</ObjectId>
    <Name>Kalender 08-16</Name>
    <Type>Global</Type>
    <HoursPerDay>8</HoursPerDay>
    <HoursPerWeek>40</HoursPerWeek>
    <HoursPerMonth>160</HoursPerMonth>
    <StandardWorkWeek>
      <StandardWorkHour>
        <DayOfWeek>Monday</DayOfWeek>
        <WorkTime>
          <Start>08:00:00</Start>
          <Finish>16:00:00</Finish>
        </WorkTime>
      </StandardWorkHour>
      <StandardWorkHour>
        <DayOfWeek>Tuesday</DayOfWeek>
        <WorkTime>
          <Start>08:00:00</Start>
          <Finish>16:00:00</Finish>
        </WorkTime>
      </StandardWorkHour>
      <StandardWorkHour>
        <DayOfWeek>Wednesday</DayOfWeek>
        <WorkTime>
          <Start>08:00:00</Start>
          <Finish>16:00:00</Finish>
        </WorkTime>
      </StandardWorkHour>
      <StandardWorkHour>
        <DayOfWeek>Thursday</DayOfWeek>
        <WorkTime>
          <Start>08:00:00</Start>
          <Finish>16:00:00</Finish>
        </WorkTime>
      </StandardWorkHour>
      <StandardWorkHour>
        <DayOfWeek>Friday</DayOfWeek>
        <WorkTime>
          <Start>08:00:00</Start>
          <Finish>16:00:00</Finish>
        </WorkTime>
      </StandardWorkHour>
      <StandardWorkHour>
        <DayOfWeek>Saturday</DayOfWeek>
      </StandardWorkHour>
      <StandardWorkHour>
        <DayOfWeek>Sunday</DayOfWeek>
      </StandardWorkHour>
    </StandardWorkWeek>
  </Calendar>
  <Activity>
    <ObjectId>1</ObjectId>
    <Id>1</Id>
    <Name>Voltooid 1-2 juni</Name>
    <ProjectObjectId>1</ProjectObjectId>
    <Type>Task Dependent</Type>
    <Status>Completed</Status>
    <PlannedDuration>16</PlannedDuration>
    <PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate>
    <PlannedFinishDate>2026-06-02T08:00:00</PlannedFinishDate>
    <PhysicalPercentComplete>100</PhysicalPercentComplete>
    <ActualStartDate>2026-06-01T08:00:00</ActualStartDate>
    <ActualFinishDate>2026-06-02T08:00:00</ActualFinishDate>
    <RemainingDuration>0</RemainingDuration>
    <CalendarObjectId>1</CalendarObjectId>
  </Activity>
  <Activity>
    <ObjectId>2</ObjectId>
    <Id>2</Id>
    <Name>Opvolger 3-4 juni</Name>
    <ProjectObjectId>1</ProjectObjectId>
    <Type>Task Dependent</Type>
    <Status>Not Started</Status>
    <PlannedDuration>16</PlannedDuration>
    <PlannedStartDate>2026-06-03T08:00:00</PlannedStartDate>
    <PlannedFinishDate>2026-06-04T08:00:00</PlannedFinishDate>
    <CalendarObjectId>1</CalendarObjectId>
  </Activity>
  <Relationship>
    <ObjectId>1</ObjectId>
    <PredecessorActivityObjectId>1</PredecessorActivityObjectId>
    <SuccessorActivityObjectId>2</SuccessorActivityObjectId>
    <Type>PR_FS</Type>
    <Lag>0</Lag>
    <ProjectObjectId>1</ProjectObjectId>
  </Relationship>
</APIBusinessObjects>`;

/** `2c7e33134.mspdi.xml`, sha256 7ef692d59e7b80be5c0feab8965325f8e9c2e73ae3b18ae578ae3e4288584082. */
export const F5A_BASE_MSPDI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Urenexport</Name>
  <Title>Urenexport</Title>
  <Author></Author>
  <Company></Company>
  <CreationDate>2026-06-01T08:00:00</CreationDate>
  <StartDate>2026-06-01T08:00:00</StartDate>
  <ScheduleFromStart>1</ScheduleFromStart>
  <CalendarUID>1</CalendarUID>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <ExtendedAttributes>
    <ExtendedAttribute>
      <FieldID>188744016</FieldID>
      <FieldName>OPS_TaskDurationUnit</FieldName>
      <Alias>OPS_TaskDurationUnit</Alias>
    </ExtendedAttribute>
    <ExtendedAttribute>
      <FieldID>188744015</FieldID>
      <FieldName>OPS_MilestoneKind</FieldName>
      <Alias>OPS_MilestoneKind</Alias>
    </ExtendedAttribute>
    <ExtendedAttribute>
      <FieldID>188744014</FieldID>
      <FieldName>OPS_DayMeasureDurations</FieldName>
      <Alias>OPS_DayMeasureDurations</Alias>
    </ExtendedAttribute>
    <ExtendedAttribute>
      <FieldID>188744013</FieldID>
      <FieldName>OPS_ExactMinutes</FieldName>
      <Alias>OPS_ExactMinutes</Alias>
    </ExtendedAttribute>
    <ExtendedAttribute>
      <FieldID>188744012</FieldID>
      <FieldName>OPS_DayMeasureLags</FieldName>
      <Alias>OPS_DayMeasureLags</Alias>
    </ExtendedAttribute>
  </ExtendedAttributes>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Kalender 07-15</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <WeekDays>
        <WeekDay>
          <DayType>2</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>07:00:00</FromTime>
              <ToTime>15:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>3</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>07:00:00</FromTime>
              <ToTime>15:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>4</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>07:00:00</FromTime>
              <ToTime>15:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>5</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>07:00:00</FromTime>
              <ToTime>15:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>6</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>07:00:00</FromTime>
              <ToTime>15:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>7</DayType>
          <DayWorking>0</DayWorking>
        </WeekDay>
        <WeekDay>
          <DayType>1</DayType>
          <DayWorking>0</DayWorking>
        </WeekDay>
      </WeekDays>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>Urenexport</Name>
      <OutlineLevel>0</OutlineLevel>
      <Summary>1</Summary>
    </Task>
    <Task>
      <UID>1</UID>
      <ID>1</ID>
      <Name>Voltooid 07-08</Name>
      <Duration>PT1H0M0S</Duration>
      <DurationFormat>5</DurationFormat>
      <Start>2026-06-01T07:00:00</Start>
      <Finish>2026-06-01T08:00:00</Finish>
      <WBS>1</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <PercentComplete>100</PercentComplete>
      <ActualStart>2026-06-01T07:00:00</ActualStart>
      <ActualFinish>2026-06-01T08:00:00</ActualFinish>
      <RemainingDuration>PT0H0M0S</RemainingDuration>
      <Priority>500</Priority>
      <CalendarUID>1</CalendarUID>
      <ExtendedAttribute>
        <FieldID>188744016</FieldID>
        <Value>hours</Value>
      </ExtendedAttribute>
    </Task>
    <Task>
      <UID>2</UID>
      <ID>2</ID>
      <Name>Opvolger 08-10</Name>
      <Duration>PT2H0M0S</Duration>
      <DurationFormat>5</DurationFormat>
      <Start>2026-06-01T08:00:00</Start>
      <Finish>2026-06-01T10:00:00</Finish>
      <WBS>2</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <PercentComplete>0</PercentComplete>
      <Priority>500</Priority>
      <CalendarUID>1</CalendarUID>
      <ExtendedAttribute>
        <FieldID>188744016</FieldID>
        <Value>hours</Value>
      </ExtendedAttribute>
      <PredecessorLink>
        <PredecessorUID>1</PredecessorUID>
        <Type>1</Type>
        <LinkLag>0</LinkLag>
        <LagFormat>7</LagFormat>
      </PredecessorLink>
    </Task>
  </Tasks>
  <Resources>
  </Resources>
</Project>`;

/** `2c7e33134.p6.xml`, sha256 355a639e9811490f158ddb1d368ee32b4cac850e7fc2c420ca903cad8b23fa24. */
export const F5A_BASE_P6 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V23.12/API/BusinessObjects" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <UDFType>
    <DataType>Text</DataType>
    <ObjectId>1</ObjectId>
    <SubjectArea>Activity</SubjectArea>
    <Title>OPS_TaskDurationUnit</Title>
  </UDFType>
  <UDFType>
    <DataType>Text</DataType>
    <ObjectId>900000003</ObjectId>
    <SubjectArea>Activity</SubjectArea>
    <Title>OPS_DayMeasureDurations</Title>
  </UDFType>
  <UDFType>
    <DataType>Text</DataType>
    <ObjectId>900000004</ObjectId>
    <SubjectArea>Activity</SubjectArea>
    <Title>OPS_ExactMinutes</Title>
  </UDFType>
  <UDFType>
    <DataType>Text</DataType>
    <ObjectId>900000005</ObjectId>
    <SubjectArea>Activity</SubjectArea>
    <Title>OPS_DayMeasureLags</Title>
  </UDFType>
  <Calendar>
    <HoursPerDay>8</HoursPerDay>
    <HoursPerMonth>160</HoursPerMonth>
    <HoursPerWeek>40</HoursPerWeek>
    <Name>Kalender 07-15</Name>
    <ObjectId>1</ObjectId>
    <Type>Global</Type>
    <StandardWorkWeek>
      <StandardWorkHours>
        <DayOfWeek>Monday</DayOfWeek>
        <WorkTime>
          <Start>07:00:00</Start>
          <Finish>14:59:00</Finish>
        </WorkTime>
      </StandardWorkHours>
      <StandardWorkHours>
        <DayOfWeek>Tuesday</DayOfWeek>
        <WorkTime>
          <Start>07:00:00</Start>
          <Finish>14:59:00</Finish>
        </WorkTime>
      </StandardWorkHours>
      <StandardWorkHours>
        <DayOfWeek>Wednesday</DayOfWeek>
        <WorkTime>
          <Start>07:00:00</Start>
          <Finish>14:59:00</Finish>
        </WorkTime>
      </StandardWorkHours>
      <StandardWorkHours>
        <DayOfWeek>Thursday</DayOfWeek>
        <WorkTime>
          <Start>07:00:00</Start>
          <Finish>14:59:00</Finish>
        </WorkTime>
      </StandardWorkHours>
      <StandardWorkHours>
        <DayOfWeek>Friday</DayOfWeek>
        <WorkTime>
          <Start>07:00:00</Start>
          <Finish>14:59:00</Finish>
        </WorkTime>
      </StandardWorkHours>
      <StandardWorkHours>
        <DayOfWeek>Saturday</DayOfWeek>
        <WorkTime xsi:nil="true" />
      </StandardWorkHours>
      <StandardWorkHours>
        <DayOfWeek>Sunday</DayOfWeek>
        <WorkTime xsi:nil="true" />
      </StandardWorkHours>
    </StandardWorkWeek>
  </Calendar>
  <Project>
    <ActivityDefaultCalendarObjectId>1</ActivityDefaultCalendarObjectId>
    <Id>OPS:proj-uren</Id>
    <Name>Urenexport</Name>
    <ObjectId>1</ObjectId>
    <PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate>
    <Status>Planned</Status>
    <Activity>
      <ActualFinishDate>2026-06-01T08:00:00</ActualFinishDate>
      <ActualStartDate>2026-06-01T07:00:00</ActualStartDate>
      <CalendarObjectId>1</CalendarObjectId>
      <Id>1</Id>
      <Name>Voltooid 07-08</Name>
      <ObjectId>1</ObjectId>
      <PercentCompleteType>Physical</PercentCompleteType>
      <PhysicalPercentComplete>1</PhysicalPercentComplete>
      <PlannedDuration>1</PlannedDuration>
      <PlannedFinishDate>2026-06-01T08:00:00</PlannedFinishDate>
      <PlannedStartDate>2026-06-01T07:00:00</PlannedStartDate>
      <ProjectObjectId>1</ProjectObjectId>
      <RemainingDuration>0</RemainingDuration>
      <Status>Completed</Status>
      <Type>Task Dependent</Type>
      <UDF>
        <TypeObjectId>1</TypeObjectId>
        <TextValue>hours</TextValue>
      </UDF>
    </Activity>
    <Activity>
      <CalendarObjectId>1</CalendarObjectId>
      <Id>2</Id>
      <Name>Opvolger 08-10</Name>
      <ObjectId>2</ObjectId>
      <PercentCompleteType>Physical</PercentCompleteType>
      <PlannedDuration>2</PlannedDuration>
      <PlannedFinishDate>2026-06-01T10:00:00</PlannedFinishDate>
      <PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate>
      <ProjectObjectId>1</ProjectObjectId>
      <Status>Not Started</Status>
      <Type>Task Dependent</Type>
      <UDF>
        <TypeObjectId>1</TypeObjectId>
        <TextValue>hours</TextValue>
      </UDF>
    </Activity>
    <Relationship>
      <Lag>0</Lag>
      <ObjectId>1</ObjectId>
      <PredecessorActivityObjectId>1</PredecessorActivityObjectId>
      <PredecessorProjectObjectId>1</PredecessorProjectObjectId>
      <SuccessorActivityObjectId>2</SuccessorActivityObjectId>
      <SuccessorProjectObjectId>1</SuccessorProjectObjectId>
      <Type>Finish to Start</Type>
    </Relationship>
  </Project>
</APIBusinessObjects>`;

/** `v2026.10.0.mspdi.xml`, sha256 b307c219cdb564333141d2d2b0e525738b0253af3923a894e622ec950ebe19ec. */
export const V2026_10_0_MSPDI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Urenexport</Name>
  <Title>Urenexport</Title>
  <Author></Author>
  <Company></Company>
  <CreationDate>2026-06-01T08:00:00</CreationDate>
  <StartDate>2026-06-01T08:00:00</StartDate>
  <ScheduleFromStart>1</ScheduleFromStart>
  <CalendarUID>1</CalendarUID>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <ExtendedAttributes>
    <ExtendedAttribute>
      <FieldID>188744016</FieldID>
      <FieldName>OPS_TaskDurationUnit</FieldName>
      <Alias>OPS_TaskDurationUnit</Alias>
    </ExtendedAttribute>
    <ExtendedAttribute>
      <FieldID>188744015</FieldID>
      <FieldName>OPS_MilestoneKind</FieldName>
      <Alias>OPS_MilestoneKind</Alias>
    </ExtendedAttribute>
  </ExtendedAttributes>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Kalender 07-15</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <WeekDays>
        <WeekDay>
          <DayType>2</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>07:00:00</FromTime>
              <ToTime>15:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>3</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>07:00:00</FromTime>
              <ToTime>15:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>4</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>07:00:00</FromTime>
              <ToTime>15:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>5</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>07:00:00</FromTime>
              <ToTime>15:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>6</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>07:00:00</FromTime>
              <ToTime>15:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>
        <WeekDay>
          <DayType>7</DayType>
          <DayWorking>0</DayWorking>
        </WeekDay>
        <WeekDay>
          <DayType>1</DayType>
          <DayWorking>0</DayWorking>
        </WeekDay>
      </WeekDays>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>Urenexport</Name>
      <OutlineLevel>0</OutlineLevel>
      <Summary>1</Summary>
    </Task>
    <Task>
      <UID>1</UID>
      <ID>1</ID>
      <Name>Voltooid 07-08</Name>
      <Duration>PT1H0M0S</Duration>
      <DurationFormat>5</DurationFormat>
      <Start>2026-06-01T07:00:00</Start>
      <Finish>2026-06-01T08:00:00</Finish>
      <WBS>1</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <PercentComplete>100</PercentComplete>
      <ActualStart>2026-06-01T07:00:00</ActualStart>
      <ActualFinish>2026-06-01T08:00:00</ActualFinish>
      <RemainingDuration>PT0H0M0S</RemainingDuration>
      <Priority>500</Priority>
      <CalendarUID>1</CalendarUID>
      <ExtendedAttribute>
        <FieldID>188744016</FieldID>
        <Value>hours</Value>
      </ExtendedAttribute>
    </Task>
    <Task>
      <UID>2</UID>
      <ID>2</ID>
      <Name>Opvolger 08-10</Name>
      <Duration>PT2H0M0S</Duration>
      <DurationFormat>5</DurationFormat>
      <Start>2026-06-01T08:00:00</Start>
      <Finish>2026-06-01T10:00:00</Finish>
      <WBS>2</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <PercentComplete>0</PercentComplete>
      <Priority>500</Priority>
      <CalendarUID>1</CalendarUID>
      <ExtendedAttribute>
        <FieldID>188744016</FieldID>
        <Value>hours</Value>
      </ExtendedAttribute>
      <PredecessorLink>
        <PredecessorUID>1</PredecessorUID>
        <Type>1</Type>
        <LinkLag>0</LinkLag>
        <LagFormat>7</LagFormat>
      </PredecessorLink>
    </Task>
  </Tasks>
  <Resources>
  </Resources>
</Project>`;

/** `v2026.10.0.p6.xml`, sha256 8007be5aab94ae5ded37a95e3e16913f062154d7b723913415a89fba2f26e1ef. */
export const V2026_10_0_P6 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V23.12/API/BusinessObjects" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <UDFType>
    <DataType>Text</DataType>
    <ObjectId>1</ObjectId>
    <SubjectArea>Activity</SubjectArea>
    <Title>OPS_TaskDurationUnit</Title>
  </UDFType>
  <Calendar>
    <HoursPerDay>8</HoursPerDay>
    <HoursPerMonth>160</HoursPerMonth>
    <HoursPerWeek>40</HoursPerWeek>
    <Name>Kalender 07-15</Name>
    <ObjectId>1</ObjectId>
    <Type>Global</Type>
    <StandardWorkWeek>
      <StandardWorkHours>
        <DayOfWeek>Monday</DayOfWeek>
        <WorkTime>
          <Start>07:00:00</Start>
          <Finish>14:59:00</Finish>
        </WorkTime>
      </StandardWorkHours>
      <StandardWorkHours>
        <DayOfWeek>Tuesday</DayOfWeek>
        <WorkTime>
          <Start>07:00:00</Start>
          <Finish>14:59:00</Finish>
        </WorkTime>
      </StandardWorkHours>
      <StandardWorkHours>
        <DayOfWeek>Wednesday</DayOfWeek>
        <WorkTime>
          <Start>07:00:00</Start>
          <Finish>14:59:00</Finish>
        </WorkTime>
      </StandardWorkHours>
      <StandardWorkHours>
        <DayOfWeek>Thursday</DayOfWeek>
        <WorkTime>
          <Start>07:00:00</Start>
          <Finish>14:59:00</Finish>
        </WorkTime>
      </StandardWorkHours>
      <StandardWorkHours>
        <DayOfWeek>Friday</DayOfWeek>
        <WorkTime>
          <Start>07:00:00</Start>
          <Finish>14:59:00</Finish>
        </WorkTime>
      </StandardWorkHours>
      <StandardWorkHours>
        <DayOfWeek>Saturday</DayOfWeek>
        <WorkTime xsi:nil="true" />
      </StandardWorkHours>
      <StandardWorkHours>
        <DayOfWeek>Sunday</DayOfWeek>
        <WorkTime xsi:nil="true" />
      </StandardWorkHours>
    </StandardWorkWeek>
  </Calendar>
  <Project>
    <ActivityDefaultCalendarObjectId>1</ActivityDefaultCalendarObjectId>
    <Id>OPS:proj-uren</Id>
    <Name>Urenexport</Name>
    <ObjectId>1</ObjectId>
    <PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate>
    <Status>Planned</Status>
    <Activity>
      <ActualFinishDate>2026-06-01T08:00:00</ActualFinishDate>
      <ActualStartDate>2026-06-01T07:00:00</ActualStartDate>
      <CalendarObjectId>1</CalendarObjectId>
      <Id>1</Id>
      <Name>Voltooid 07-08</Name>
      <ObjectId>1</ObjectId>
      <PercentCompleteType>Physical</PercentCompleteType>
      <PhysicalPercentComplete>1</PhysicalPercentComplete>
      <PlannedDuration>1</PlannedDuration>
      <PlannedFinishDate>2026-06-01T08:00:00</PlannedFinishDate>
      <PlannedStartDate>2026-06-01T07:00:00</PlannedStartDate>
      <ProjectObjectId>1</ProjectObjectId>
      <RemainingDuration>0</RemainingDuration>
      <Status>Completed</Status>
      <Type>Task Dependent</Type>
      <UDF>
        <TypeObjectId>1</TypeObjectId>
        <TextValue>hours</TextValue>
      </UDF>
    </Activity>
    <Activity>
      <CalendarObjectId>1</CalendarObjectId>
      <Id>2</Id>
      <Name>Opvolger 08-10</Name>
      <ObjectId>2</ObjectId>
      <PercentCompleteType>Physical</PercentCompleteType>
      <PlannedDuration>2</PlannedDuration>
      <PlannedFinishDate>2026-06-01T10:00:00</PlannedFinishDate>
      <PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate>
      <ProjectObjectId>1</ProjectObjectId>
      <Status>Not Started</Status>
      <Type>Task Dependent</Type>
      <UDF>
        <TypeObjectId>1</TypeObjectId>
        <TextValue>hours</TextValue>
      </UDF>
    </Activity>
    <Relationship>
      <Lag>0</Lag>
      <ObjectId>1</ObjectId>
      <PredecessorActivityObjectId>1</PredecessorActivityObjectId>
      <PredecessorProjectObjectId>1</PredecessorProjectObjectId>
      <SuccessorActivityObjectId>2</SuccessorActivityObjectId>
      <SuccessorProjectObjectId>1</SuccessorProjectObjectId>
      <Type>Finish to Start</Type>
    </Relationship>
  </Project>
</APIBusinessObjects>`;
