// P6 XML-lezer leest echte PMXML (projectobjecten BINNEN <Project>) — corpusloze CI-poort.
//
// Aanleiding (review PR #169, sectie "Bijvangst", 2026-10-12): `readP6XML` keek alleen naar directe
// kinderen van <APIBusinessObjects>. Echte P6 XML zet Activity/WBS/Relationship/ResourceAssignment
// binnen <Project>, dus elk echt bestand gaf 0 taken; alleen de platte vorm van de eigen writer werkte.
// Deze check leest een zelf geschreven fixture in de echte, geneste vorm met drie projecten
// (leeg omhulsel A, doelproject B, tweede project C), een baseline, een plat object van C en een
// externe relatie. Alle aantallen met ===. Mutatiebewijs: met de oude top-level-zoekfunctie geeft
// de fixture 0 taken en wordt deze check rood.
import { readFileSync } from 'node:fs';
import { readP6XML, readP6XMLDocuments } from '@/services/p6/p6xmlReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { documentTitle } from '@/utils/documents';
import { documentProjectCode } from '@/utils/documentProjectCode';
import { installDOMParser } from './xmldom-shim';

declare const process: { exitCode?: number };
installDOMParser();

const fails: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const xml = readFileSync(new URL('./fixtures/p6xml-genest-meerdere-projecten.xml', import.meta.url), 'utf8');
const r = readP6XML(xml);
const leaves = r.tasks.filter(t => t.childIds.length === 0);
const byCode = (code: string) => r.tasks.find(t => t.wbsCode === code);
const libByName = (name: string) => (r.resourceCalendars ?? []).find(c => c.name === name);

// (1) Projectkeuze: A is leeg ⇒ B (het eerste project mét activiteiten). CDATA + entiteit in de naam.
// Eigenaarsbesluit 2026-10-13: de naam blijft kaal, de P6 Project-ID staat apart (zoals XER).
eq('1a projectnaam en -code apart', [r.project.name, r.project.p6ProjectCode], ['Project B & bouw', 'B-BOUW']);
eq('1b projectstart', r.project.startDate, '2026-04-13');
eq('1c statusdatum uit DataDate', r.project.statusDate?.slice(0, 10), '2026-04-20');

// (2) Aantallen: 2 WBS + 4 activiteiten van B; niets van A, C, de baseline of het platte C-object.
eq('2a taken totaal', r.tasks.length, 6);
eq('2b bladtaken', leaves.length, 4);
eq('2c bladcodes', leaves.map(t => t.wbsCode).sort(), ['B1000', 'B1010', 'B1020', 'B1030']);
eq('2d geen object van C of baseline', r.tasks.some(t => /C1000|C1010|C-PLAT|baseline/.test(`${t.wbsCode} ${t.name}`)), false);
eq('2e relaties (externe naar C valt weg)', r.sequences.length, 3);
eq('2f resources (globaal)', r.resources.length, 1);
eq('2g toewijzingen', r.assignments.length, 1);

// (3) WBS-boom: Fundering onder Ruwbouw, activiteiten onder hun WBS.
const ruwbouw = r.tasks.find(t => t.name === 'Ruwbouw');
const fundering = r.tasks.find(t => t.name === 'Fundering');
eq('3a Fundering onder Ruwbouw', fundering?.parentId === ruwbouw?.id && ruwbouw !== undefined, true);
eq('3b B1000 onder Fundering', byCode('B1000')?.parentId === fundering?.id, true);
eq('3c B1030 onder Ruwbouw', byCode('B1030')?.parentId === ruwbouw?.id, true);

// (4) Projectkalender = ActivityDefaultCalendarObjectId (10), niet de eerste <Calendar> toevallig.
//     P6-eindtijd 11:59/16:59 = laatste minuut ⇒ banden tot 12:00/17:00.
eq('4a projectkalender', r.calendar.name, 'Globaal 5 dagen');
eq('4b uren per dag', r.calendar.hoursPerDay, 8);
eq('4c werkdagen (StandardWorkHours, meervoud)', r.calendar.workDays, [1, 2, 3, 4, 5]);
eq('4d scalar werktijd 8–17', [r.calendar.workStartHour, r.calendar.workEndHour], [8, 17]);
eq('4e feestdagen (zonder WorkTime + 00:00–23:59)', r.calendar.holidays.map(h => h.startDate), ['2026-04-27', '2026-05-05']);
eq('4f werkende uitzondering (zaterdag 08:00–12:00)',
  (r.calendar.workingExceptions ?? []).map(w => [w.startDate, w.bands]),
  [['2026-05-09', [{ start: 480, end: 720 }]]]);

// (5) Bibliotheekkalenders: alleen de gebruikte (11 globaal, 13 projectkalender binnen <Project>).
eq('5a bibliotheekkalenders', (r.resourceCalendars ?? []).map(c => c.name).sort(), ['Globaal 4 dagen', 'Projectkalender B 10 uur']);
eq('5b 4-dagenkalender: werkdagen', libByName('Globaal 4 dagen')?.workDays, [1, 2, 3, 4]);
eq('5c 4-dagenkalender: geen NL-standaardfeestdagen', libByName('Globaal 4 dagen')?.holidays.length, 0);
eq('5d projectkalender B: 10 uur', libByName('Projectkalender B 10 uur')?.hoursPerDay, 10);
eq('5e B1020 op de 4-dagenkalender', byCode('B1020')?.calendarId, libByName('Globaal 4 dagen')?.id);
eq('5f B1030 op projectkalender B', byCode('B1030')?.calendarId, libByName('Projectkalender B 10 uur')?.id);
eq('5g B1000 op de projectkalender (geen taakkalender)', byCode('B1000')?.calendarId, undefined);
eq('5h resource op de 4-dagenkalender', r.resources[0]?.calendarId, libByName('Globaal 4 dagen')?.id);

// (6) Datums, duur en voortgang. P6 schrijft het percentage als fractie (0.5 = 50 %).
eq('6a B1010 start', byCode('B1010')?.time.scheduleStart.slice(0, 10), '2026-04-20');
eq('6b B1010 einde', byCode('B1010')?.time.scheduleFinish.slice(0, 10), '2026-05-01');
eq('6c B1010 duur 80 u = 10 werkdagen', Math.round((byCode('B1010')?.time.scheduleDuration ?? 0) * 1000) / 1000, 10);
eq('6d B1010 voortgang 0.5 ⇒ 50 %', byCode('B1010')?.time.completion, 0.5);
eq('6e B1000 voltooid', [byCode('B1000')?.time.completion, byCode('B1000')?.status], [1, 'COMPLETED']);
eq('6f B1030 eindmijlpaal', [byCode('B1030')?.isMilestone, byCode('B1030')?.milestoneKind], [true, 'FINISH']);
eq('6g toewijzing op B1020', r.assignments[0]?.taskId, byCode('B1020')?.id);

// (7) Rekenprofiel blijft OPS (besluit B28), ook voor echte P6 XML.
eq('7 rekenprofiel (P6 XML rekent als P6, #775)', r.suggestedProfileId, 'p6');

// (8) Eigen round-trip: schrijven (P6-vorm: objecten binnen <Project>) → lezen geeft dezelfde aantallen en voortgang.
function roundTrip(src: ImportResult): ImportResult {
  const out = writeP6XML(src.project, src.calendar, src.tasks, src.sequences, src.resources,
    src.assignments, src.resourceCalendars ?? [], src.customTaskTypes ?? []);
  return readP6XML(out);
}
const originalWarn = console.warn;
console.warn = () => {};
let rt: ImportResult;
try { rt = roundTrip(r); } finally { console.warn = originalWarn; }
eq('8a round-trip taken', rt.tasks.length, r.tasks.length);
eq('8b round-trip relaties', rt.sequences.length, r.sequences.length);
eq('8c round-trip toewijzingen', rt.assignments.length, r.assignments.length);
eq('8d round-trip bibliotheekkalenders', (rt.resourceCalendars ?? []).length, (r.resourceCalendars ?? []).length);
eq('8e round-trip voortgang B1010 (OPS-export schrijft procenten)', rt.tasks.find(t => t.wbsCode === 'B1010')?.time.completion, 0.5);
eq('8f round-trip projectkalender', [rt.calendar.name, rt.calendar.workDays], [r.calendar.name, r.calendar.workDays]);

// (9) Percentagesoort — zelfde lijn als de XER-lezer (`complete_pct_type`): de status leidt, de
//     soort kiest de kolom, geen terugval op de kolom van een andere soort. P6-fracties (0..1).
function completionOf(fields: string): number | undefined {
  const doc = `<?xml version="1.0"?><APIBusinessObjects><Project><ObjectId>1</ObjectId><Name>P</Name>
    <PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate>
    <Activity><ObjectId>1</ObjectId><Id>X</Id><Name>X</Name><PlannedDuration>40</PlannedDuration>
      <PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-06T17:00:00</PlannedFinishDate>
      ${fields}</Activity></Project></APIBusinessObjects>`;
  const warn = console.warn;
  console.warn = () => {};
  try { return readP6XML(doc).tasks[0]?.time.completion; } finally { console.warn = warn; }
}
const started = '<Status>In Progress</Status><ActualStartDate>2026-03-02T08:00:00</ActualStartDate>';
const cols = '<PhysicalPercentComplete>0.4</PhysicalPercentComplete><DurationPercentComplete>0.7</DurationPercentComplete><UnitsPercentComplete>0.2</UnitsPercentComplete>';
const near = (v: number | undefined) => (v === undefined ? v : Math.round(v * 1000) / 1000);
eq('9a Physical ⇒ PhysicalPercentComplete', near(completionOf(`${started}<PercentCompleteType>Physical</PercentCompleteType>${cols}`)), 0.4);
eq('9b Duration ⇒ DurationPercentComplete', near(completionOf(`${started}<PercentCompleteType>Duration</PercentCompleteType>${cols}`)), 0.7);
eq('9c Units ⇒ UnitsPercentComplete', near(completionOf(`${started}<PercentCompleteType>Units</PercentCompleteType>${cols}`)), 0.2);
eq('9d Duration zonder kolom ⇒ 1 − rest/gepland', near(completionOf(`${started}<PercentCompleteType>Duration</PercentCompleteType><RemainingDuration>30</RemainingDuration>`)), 0.25);
eq('9e Units zonder kolom ⇒ 0 (geen terugval op Physical)', near(completionOf(`${started}<PercentCompleteType>Units</PercentCompleteType><PhysicalPercentComplete>0.4</PhysicalPercentComplete>`)), 0);
eq('9f geen soort ⇒ Physical', near(completionOf(`${started}${cols}`)), 0.4);
eq('9g onbekende soort ⇒ Duration', near(completionOf(`${started}<PercentCompleteType>Foo</PercentCompleteType>${cols}`)), 0.7);
eq('9h status Completed leidt', near(completionOf(`<Status>Completed</Status><ActualStartDate>2026-03-02T08:00:00</ActualStartDate><ActualFinishDate>2026-03-06T17:00:00</ActualFinishDate><PercentCompleteType>Physical</PercentCompleteType><PhysicalPercentComplete>0.1</PhysicalPercentComplete>`)), 1);
eq('9i status Not Started leidt', near(completionOf(`<Status>Not Started</Status><PercentCompleteType>Physical</PercentCompleteType><PhysicalPercentComplete>0.5</PhysicalPercentComplete>`)), 0);

// (10) Meerdere projecten zoals XER: elk project mét activiteiten wordt een document, lege worden
//      overgeslagen, <BaselineProject> wordt baseline van zijn eigenaar, relaties tussen projecten
//      worden geen Sequence, het document met de meeste activiteiten is actief.
const opened = readP6XMLDocuments(xml);
eq('10a meervoudige import', isMultiDocumentImport(opened), true);
const docs = isMultiDocumentImport(opened) ? opened.results : [opened];
eq('10b documenten (B en C, niet A, niet de baselines)', docs.map(d => [d.project.name, d.project.p6ProjectCode]),
  [['Project B & bouw', 'B-BOUW'], ['Project C', 'C-AFBOUW']]);
eq('10c actief document = B (meeste activiteiten)', isMultiDocumentImport(opened) ? opened.activeDocumentIndex : 0, 0);
eq('10d C: activiteiten (2 binnen <Project> + 1 plat met ProjectObjectId 300)',
  docs[1].tasks.filter(t => t.childIds.length === 0).map(t => t.wbsCode).sort(), ['C-PLAT', 'C1000', 'C1010']);
eq('10e C: eigen relatie', docs[1].sequences.length, 1);
eq('10f verslag', docs[0].p6xmlReport, {
  projectsSeen: 3, documentsOpened: 2, emptyProjectsSkipped: 1, baselinesMaterialized: 2, crossProjectRelations: 1,
  danglingBaselineReferences: 0, unassignedActivities: 0,
});
eq('10g zelfde verslag op elk document', JSON.stringify(docs[1].p6xmlReport), JSON.stringify(docs[0].p6xmlReport));
const bls = docs[0].baselines ?? [];
eq('10h B: twee baselines', bls.map(b => b.name), ['Baseline B (B-BOUW-BL1)', 'Eerste baseline B (B-BOUW-BL0)']);
eq('10i B: actieve baseline = CurrentBaselineProjectObjectId 201', docs[0].activeBaselineId, bls[0]?.id);
const blTask = bls[0]?.tasks.find(t => t.sourceTaskCode === 'B1000');
eq('10j baseline gekoppeld aan de B-taak met dezelfde code', blTask?.taskId, docs[0].tasks.find(t => t.wbsCode === 'B1000')?.id);
eq('10k baselinedatum B1000', blTask?.start.slice(0, 10), '2026-04-06');
eq('10l baseline-aanmaakdatum uit LastBaselineUpdateDate', bls[0]?.createdAt, '2026-04-01T09:00:00');
eq('10m C: geen baselines', docs[1].baselines, undefined);
eq('10n readP6XML = het eerste document (B), mét baselines', [r.project.name, (r.baselines ?? []).length], ['Project B & bouw', 2]);
// Actief document = meeste activiteiten, ook als dat niet het eerste is (XER-regel).
const act = (id: number) => `<Activity><ObjectId>${id}</ObjectId><Id>A${id}</Id><Name>A${id}</Name><PlannedDuration>8</PlannedDuration>
  <PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-02T17:00:00</PlannedFinishDate></Activity>`;
const twoProjects = readP6XMLDocuments(`<?xml version="1.0"?><APIBusinessObjects>
  <Project><ObjectId>1</ObjectId><Name>Klein</Name>${act(11)}</Project>
  <Project><ObjectId>2</ObjectId><Name>Groot</Name>${act(21)}${act(22)}${act(23)}</Project></APIBusinessObjects>`);
eq('10o actief = het grootste project, niet het eerste',
  isMultiDocumentImport(twoProjects) ? twoProjects.results[twoProjects.activeDocumentIndex].project.name : 'geen meervoud', 'Groot');

// (12) `Not Started` met (vul)datums als werkelijk begin/einde (aspose_p6_multiproject: 2000-01-01):
//      geen voortgang, geen actuals. Een gestarte taak houdt haar actuals.
const filler = readP6XML(`<?xml version="1.0"?><APIBusinessObjects><Project><Id>F</Id><ObjectId>1</ObjectId><Name>F</Name>
  <PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate>
  <Activity><ActualFinishDate>2000-01-01T00:00:00</ActualFinishDate><ActualStartDate>2000-01-01T00:00:00</ActualStartDate><Id>N</Id><Name>N</Name><ObjectId>1</ObjectId>
    <PlannedDuration>8</PlannedDuration><PlannedFinishDate>2026-03-02T17:00:00</PlannedFinishDate><PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><Status>Not Started</Status></Activity>
  <Activity><ActualStartDate>2026-03-02T08:00:00</ActualStartDate><Id>S</Id><Name>S</Name><ObjectId>2</ObjectId>
    <PlannedDuration>16</PlannedDuration><PlannedFinishDate>2026-03-03T17:00:00</PlannedFinishDate><PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><Status>In Progress</Status></Activity>
</Project></APIBusinessObjects>`);
const fTask = (code: string) => filler.tasks.find(t => t.wbsCode === code);
eq('12a Not Started: geen voortgang en geen actuals', [fTask('N')?.status, fTask('N')?.time.completion, fTask('N')?.time.actualStart, fTask('N')?.time.actualFinish],
  ['NOT_STARTED', 0, undefined, undefined]);
eq('12b In Progress houdt zijn werkelijke start', [fTask('S')?.status, fTask('S')?.time.actualStart], ['STARTED', '2026-03-02T08:00']);

// (13) Randen van het meerdere-projecten-pad (testgaten uit de review van #330).
{
  const rel = `<Relationship><Lag>0</Lag><ObjectId>77</ObjectId><PredecessorActivityObjectId>11</PredecessorActivityObjectId><PredecessorProjectObjectId>1</PredecessorProjectObjectId>
    <SuccessorActivityObjectId>21</SuccessorActivityObjectId><SuccessorProjectObjectId>2</SuccessorProjectObjectId><Type>Finish to Start</Type></Relationship>`;
  // 13a: een gelijk aantal activiteiten ⇒ het EERSTE project is actief (XER: de eerste met de meeste).
  const tie = readP6XMLDocuments(`<?xml version="1.0"?><APIBusinessObjects>
    <Project><Id>P1</Id><ObjectId>1</ObjectId><Name>Eerste</Name>${act(11)}${rel}</Project>
    <Project><Id>P2</Id><ObjectId>2</ObjectId><Name>Tweede</Name>${act(21)}${rel}</Project></APIBusinessObjects>`);
  eq('13a gelijkspel ⇒ het eerste project actief', isMultiDocumentImport(tie) ? tie.activeDocumentIndex : -1, 0);
  // 13b: dezelfde externe relatie staat onder BEIDE projecten ⇒ één keer geteld.
  eq('13b externe relatie onder beide projecten telt één keer',
    isMultiDocumentImport(tie) ? tie.results[0].p6xmlReport?.crossProjectRelations : -1, 1);
}
{
  // 13c: baseline-koppeling op code alleen bij een UNIEKE code in het eigenaarproject. Twee eigenaartaken
  //      met code DUP ⇒ de baselinetaak met code DUP koppelt aan geen van beide (blijft bij haar eigen id).
  const owner = readP6XML(`<?xml version="1.0"?><APIBusinessObjects>
    <Project><Id>E</Id><ObjectId>1</ObjectId><Name>E</Name><CurrentBaselineProjectObjectId>9</CurrentBaselineProjectObjectId>
      <Activity><Id>DUP</Id><Name>a</Name><ObjectId>11</ObjectId><PlannedDuration>8</PlannedDuration><PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-02T17:00:00</PlannedFinishDate></Activity>
      <Activity><Id>DUP</Id><Name>b</Name><ObjectId>12</ObjectId><PlannedDuration>8</PlannedDuration><PlannedStartDate>2026-03-03T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-03T17:00:00</PlannedFinishDate></Activity>
      <Activity><Id>UNI</Id><Name>c</Name><ObjectId>13</ObjectId><PlannedDuration>8</PlannedDuration><PlannedStartDate>2026-03-04T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-04T17:00:00</PlannedFinishDate></Activity>
    </Project>
    <BaselineProject><Id>E-BL</Id><ObjectId>9</ObjectId><Name>E</Name><OriginalProjectObjectId>1</OriginalProjectObjectId>
      <Activity><Id>DUP</Id><Name>a</Name><ObjectId>91</ObjectId><PlannedDuration>8</PlannedDuration><PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-02T17:00:00</PlannedFinishDate></Activity>
      <Activity><Id>UNI</Id><Name>c</Name><ObjectId>93</ObjectId><PlannedDuration>8</PlannedDuration><PlannedStartDate>2026-03-04T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-04T17:00:00</PlannedFinishDate></Activity>
    </BaselineProject></APIBusinessObjects>`);
  const ownerIds = new Set(owner.tasks.map(t => t.id));
  const blTasks = owner.baselines?.[0]?.tasks ?? [];
  eq('13c dubbele code koppelt niet, unieke code wel', blTasks.map(b => [b.sourceTaskCode, ownerIds.has(b.taskId)]), [['DUP', false], ['UNI', true]]);
}

// (11) Documentnaam zoals XER: "Naam (Id)". OZB-14 heeft twaalf updates met dezelfde naam; de tabbladen
//      moeten onderscheidbaar zijn. De naam blijft kaal, de code staat apart (eigenaarsbesluit
//      2026-10-13); de eigen export zet de code terug in <Id>, heropenen geeft dezelfde naam én code.
const sameName = readP6XMLDocuments(`<?xml version="1.0"?><APIBusinessObjects>
  <Project><Id>OZB-01</Id><ObjectId>1</ObjectId><Name>OZB Update</Name>${act(11)}</Project>
  <Project><Id>OZB-02</Id><ObjectId>2</ObjectId><Name>OZB Update</Name>${act(21)}</Project>
  <Project><Id>OZB Update</Id><ObjectId>3</ObjectId><Name>OZB Update</Name>${act(31)}</Project></APIBusinessObjects>`);
const sameDocs = isMultiDocumentImport(sameName) ? sameName.results : [];
const sameTitles = sameDocs.map(d => documentTitle(null, d.project.name, documentProjectCode(d.project)));
eq('11a documentnamen met Id, uniek', [sameTitles, new Set(sameTitles).size], [['OZB Update (OZB-01)', 'OZB Update (OZB-02)', 'OZB Update'], 3]);
eq('11a2 projectnamen kaal, code apart', sameDocs.map(d => [d.project.name, d.project.p6ProjectCode]),
  [['OZB Update', 'OZB-01'], ['OZB Update', 'OZB-02'], ['OZB Update', 'OZB Update']]);
for (const name of ['Project B & bouw (B-BOUW)', 'Kantoor', 'Een heel lange projectnaam die langer is dan veertig tekens']) {
  const src = readP6XML(xml);
  src.project.name = name;
  const back = readP6XML(writeP6XML(src.project, src.calendar, src.tasks, src.sequences, src.resources, src.assignments, src.resourceCalendars ?? []));
  eq(`11b naam en code round-trip: ${name}`, [back.project.name, back.project.p6ProjectCode], [name, 'B-BOUW']);
}

if (fails.length > 0) {
  for (const f of fails) console.log(`XX  p6xml-nested: ${f}`);
  console.log(`XX  p6xml-nested: ${fails.length} van ${checks} controles rood`);
  process.exitCode = 1;
} else {
  console.log(`OK  p6xml-nested: ${checks} controles groen (echte geneste PMXML, meerdere projecten, round-trip)`);
}
