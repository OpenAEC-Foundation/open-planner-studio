// Gedeelde fixtures voor "datums zoals opgeslagen" bij P6 XML, MSPDI en CSV (eigenaarsbesluit
// 2026-09-09: "het moet altijd gaan zoals het nu bij XER werkt"). Gedeeld door
// `tests/planning/check-recorded-times-formats.ts` en `tests/browser/recorded-dates.spec.ts`,
// zodat headless en browser over exact hetzelfde bestand praten.
//
// Twee taken, dagmodus, ma–vr 07:00–16:00 met hoursPerDay 8 (de vorm die `writeP6XML`/
// `writeMSPDI` zelf schrijven en die beide lezers rond-trippen — zie check-adapters-hours):
//   A: 1.1, gepland 2026-03-02 … 03-06, met VOLLEDIGE bronuitvoer: early = gepland, late 1 week
//      later, totale speling 5 dagen (P6: 40 uur; MSP: 24.000 tienden van een minuut), vrije
//      speling 0, niet kritiek.
//   B: 1.2, gepland 2026-03-16 … 03-20 mét FS-relatie op A — onze herberekening zet B direct na
//      A (03-09), dus de vastlegging (03-16) WIJKT AF ⇒ de modus gaat automatisch aan. B draagt
//      alleen vroege datums (geen late, geen speling): "niet vastgelegd" op vier assen.
//   C: 1.3, zonder enige datum in de bronuitvoer ⇒ géén vastlegging.

const P6_CALENDAR = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => `
      <StandardWorkHour>
        <DayOfWeek>${day}</DayOfWeek>
        <WorkTime>
          <Start>07:00:00</Start>
          <Finish>16:00:00</Finish>
        </WorkTime>
      </StandardWorkHour>`).join('') + `
      <StandardWorkHour>
        <DayOfWeek>Saturday</DayOfWeek>
      </StandardWorkHour>
      <StandardWorkHour>
        <DayOfWeek>Sunday</DayOfWeek>
      </StandardWorkHour>`;

export const P6XML_FIXTURE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V23.12/API/BusinessObjects" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Project>
    <ObjectId>1</ObjectId>
    <Id>REC-P6</Id>
    <Name>RecordedP6</Name>
    <PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate>
    <Status>Planned</Status>
  </Project>
  <Calendar>
    <ObjectId>1</ObjectId>
    <Name>Werkkalender</Name>
    <Type>Global</Type>
    <HoursPerDay>8</HoursPerDay>
    <HoursPerWeek>40</HoursPerWeek>
    <HoursPerMonth>160</HoursPerMonth>
    <StandardWorkWeek>${P6_CALENDAR}
    </StandardWorkWeek>
  </Calendar>
  <Activity>
    <ObjectId>1</ObjectId>
    <Id>1.1</Id>
    <Name>A</Name>
    <ProjectObjectId>1</ProjectObjectId>
    <Type>Task Dependent</Type>
    <Status>Not Started</Status>
    <PlannedDuration>40</PlannedDuration>
    <PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate>
    <PlannedFinishDate>2026-03-06T08:00:00</PlannedFinishDate>
    <EarlyStartDate>2026-03-02T08:00:00</EarlyStartDate>
    <EarlyFinishDate>2026-03-06T08:00:00</EarlyFinishDate>
    <LateStartDate>2026-03-09T08:00:00</LateStartDate>
    <LateFinishDate>2026-03-13T08:00:00</LateFinishDate>
    <TotalFloat>40</TotalFloat>
    <FreeFloat>0</FreeFloat>
    <IsCritical>false</IsCritical>
    <CalendarObjectId>1</CalendarObjectId>
  </Activity>
  <Activity>
    <ObjectId>2</ObjectId>
    <Id>1.2</Id>
    <Name>B</Name>
    <ProjectObjectId>1</ProjectObjectId>
    <Type>Task Dependent</Type>
    <Status>Not Started</Status>
    <PlannedDuration>40</PlannedDuration>
    <PlannedStartDate>2026-03-16T08:00:00</PlannedStartDate>
    <PlannedFinishDate>2026-03-20T08:00:00</PlannedFinishDate>
    <EarlyStartDate>2026-03-16T08:00:00</EarlyStartDate>
    <EarlyFinishDate>2026-03-20T08:00:00</EarlyFinishDate>
    <CalendarObjectId>1</CalendarObjectId>
  </Activity>
  <Activity>
    <ObjectId>3</ObjectId>
    <Id>1.3</Id>
    <Name>C</Name>
    <ProjectObjectId>1</ProjectObjectId>
    <Type>Task Dependent</Type>
    <Status>Not Started</Status>
    <PlannedDuration>8</PlannedDuration>
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
</APIBusinessObjects>
`;

const MSPDI_WEEKDAYS = [2, 3, 4, 5, 6].map(day => `
        <WeekDay>
          <DayType>${day}</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>07:00:00</FromTime>
              <ToTime>16:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>`).join('') + `
        <WeekDay>
          <DayType>1</DayType>
          <DayWorking>0</DayWorking>
        </WeekDay>
        <WeekDay>
          <DayType>7</DayType>
          <DayWorking>0</DayWorking>
        </WeekDay>`;

export const MSPDI_FIXTURE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>RecordedMSPDI</Name>
  <Title>RecordedMSPDI</Title>
  <StartDate>2026-03-02T08:00:00</StartDate>
  <ScheduleFromStart>1</ScheduleFromStart>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <CalendarUID>1</CalendarUID>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Werkkalender</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <WeekDays>${MSPDI_WEEKDAYS}
      </WeekDays>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task>
      <UID>1</UID>
      <ID>1</ID>
      <Name>A</Name>
      <Duration>PT40H0M0S</Duration>
      <DurationFormat>7</DurationFormat>
      <Start>2026-03-02T08:00:00</Start>
      <Finish>2026-03-06T08:00:00</Finish>
      <EarlyStart>2026-03-02T08:00:00</EarlyStart>
      <EarlyFinish>2026-03-06T08:00:00</EarlyFinish>
      <LateStart>2026-03-09T08:00:00</LateStart>
      <LateFinish>2026-03-13T08:00:00</LateFinish>
      <TotalSlack>24000</TotalSlack>
      <FreeSlack>0</FreeSlack>
      <Critical>0</Critical>
      <WBS>1.1</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <PercentComplete>0</PercentComplete>
      <Priority>500</Priority>
      <CalendarUID>1</CalendarUID>
    </Task>
    <Task>
      <UID>2</UID>
      <ID>2</ID>
      <Name>B</Name>
      <Duration>PT40H0M0S</Duration>
      <DurationFormat>7</DurationFormat>
      <Start>2026-03-16T08:00:00</Start>
      <Finish>2026-03-20T08:00:00</Finish>
      <EarlyStart>2026-03-16T08:00:00</EarlyStart>
      <EarlyFinish>2026-03-20T08:00:00</EarlyFinish>
      <WBS>1.2</WBS>
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
    <Task>
      <UID>3</UID>
      <ID>3</ID>
      <Name>C</Name>
      <Duration>PT8H0M0S</Duration>
      <DurationFormat>7</DurationFormat>
      <WBS>1.3</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <PercentComplete>0</PercentComplete>
      <Priority>500</Priority>
      <CalendarUID>1</CalendarUID>
    </Task>
  </Tasks>
</Project>
`;

/** CSV mét kolom "Total Float" en "Critical"; C heeft géén datums en dus geen vastlegging. */
export const CSV_FIXTURE = [
  'WBS,Name,Duration,Start,Finish,Predecessors,Total Float,Critical',
  '1.1,A,5,2026-03-02,2026-03-06,,5,No',
  '1.2,B,5,2026-03-16,2026-03-20,1.1,,',
  '1.3,C,1,,,,,',
].join('\n');

/** Dezelfde CSV zónder speling-/kritiekkolom: alleen start en einde zijn "wat er is". */
export const CSV_FIXTURE_DATES_ONLY = [
  'WBS,Name,Duration,Start,Finish,Predecessors',
  '1.1,A,5,2026-03-02,2026-03-06,',
  '1.2,B,5,2026-03-16,2026-03-20,1.1',
].join('\n');
