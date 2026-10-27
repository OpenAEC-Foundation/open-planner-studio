// P6 XML-constraints: echte P6 XML (PMXML) schrijft `<PrimaryConstraintType>` en
// `<SecondaryConstraintType>` als Engels label (`Start On or After`, `Finish On or Before`); de eigen
// writer schrijft het XER-token (`CS_MSOA`). Vóór de fix las de lezer alleen de tokens, en kwam elke
// constraint uit echte P6 XML binnen als ASAP (gevonden in `p6-meerdere-projecten.xml`, project 9031:
// OZ1060 `Start On or After`, OZ1130 `Finish On or Before`).
//
// Bewaakt: (1) alle negen PMXML-labels, primair én secundair (bron: MPXJ `ConstraintTypeHelper`);
// (2) de negen `CS_*`-tokens blijven werken; (3) de round-trip met de eigen writer; (4) het
// rekenresultaat na openen via de echte open-pijplijn (`parseOpenedFile` → `applyOpenedImport`,
// mét herberekening): een SNET-label duwt de start, een FNLT-label houdt de constraint vast.
// Corpusloos (CI). Fixtures: inline, zelf geschreven, met de vorm van de activiteiten in project 9031.
import { parseOpenedFile } from '@/services/formatRegistry';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { useAppStore } from '@/state/appStore';
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

const wrap = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V8.3/API/BusinessObjects">${inner}</APIBusinessObjects>`;

/** Eén activiteit met een primaire en (optioneel) secundaire constraint. */
function activity(objId: number, id: string, primary: string, secondary = ''): string {
  return `<Activity><ObjectId>${objId}</ObjectId><Id>${id}</Id><Name>${id}</Name><Type>Task Dependent</Type>
    <PlannedDuration>8</PlannedDuration><PlannedStartDate>2025-01-02T08:00:00</PlannedStartDate>
    <PlannedFinishDate>2025-01-02T16:00:00</PlannedFinishDate>
    <PrimaryConstraintType>${primary}</PrimaryConstraintType><PrimaryConstraintDate>2025-01-02T08:00:00</PrimaryConstraintDate>
    ${secondary ? `<SecondaryConstraintType>${secondary}</SecondaryConstraintType><SecondaryConstraintDate>2025-01-27T16:00:00</SecondaryConstraintDate>` : ''}
  </Activity>`;
}

/** [PMXML-label, XER-token, OPS-type, hard] — MPXJ `ConstraintTypeHelper` (XML_TYPE_MAP ↔ XER_TYPE_MAP). */
const TABLE: readonly [string, string, string, boolean][] = [
  ['Start On', 'CS_MSO', 'MSO', false],
  ['Start On or After', 'CS_MSOA', 'SNET', false],
  ['Start On or Before', 'CS_MSOB', 'SNLT', false],
  ['Finish On', 'CS_MEO', 'MFO', false],
  ['Finish On or After', 'CS_MEOA', 'FNET', false],
  ['Finish On or Before', 'CS_MEOB', 'FNLT', false],
  ['As Late As Possible', 'CS_ALAP', 'ALAP', false],
  ['Mandatory Start', 'CS_MANDSTART', 'MSO', true],
  ['Mandatory Finish', 'CS_MANDFIN', 'MFO', true],
];

function project(activities: string): string {
  return wrap(`<Project><ObjectId>9031</ObjectId><Id>OZ</Id><Name>Constraints</Name>
    <PlannedStartDate>2025-01-02T08:00:00</PlannedStartDate>${activities}</Project>`);
}

async function main(): Promise<void> {
  // (1) + (2) Labels én tokens, primair én secundair (secundair is altijd soft: `hard` valt weg).
  for (const [form, col] of [['label', 0], ['token', 1]] as const) {
    const xml = project(TABLE.map((_row, i) => activity(100 + i, `A${i}`, TABLE[i][col], TABLE[(i + 1) % TABLE.length][col])).join(''));
    const result = readP6XML(xml);
    TABLE.forEach(([label, , type, hard], i) => {
      const t = result.tasks.find(x => x.wbsCode === `A${i}`);
      const [, , type2] = TABLE[(i + 1) % TABLE.length];
      eq(`1 ${form} '${TABLE[i][col]}' primair`, [t?.constraint?.type, t?.constraint?.hard === true, t?.constraint?.date?.slice(0, 10)],
        [type, hard, '2025-01-02']);
      eq(`1 ${form} secundair na '${label}'`, [t?.constraint2?.type, t?.constraint2?.hard, t?.constraint2?.date?.slice(0, 10)],
        [type2, undefined, '2025-01-27']);
    });
  }

  // Witruimte rond het label (pretty-printed XML) en een onbekende waarde.
  {
    const r = readP6XML(project(activity(1, 'W', '  Start On or After\n') + activity(2, 'U', 'Start Sometime')));
    eq('1w witruimte rond het label', r.tasks.find(t => t.wbsCode === 'W')?.constraint?.type, 'SNET');
    eq('1u onbekende waarde ⇒ geen constraint', r.tasks.find(t => t.wbsCode === 'U')?.constraint, undefined);
  }

  // Een waarde die als prototype-sleutel bestaat (`toString`, `constructor`) is ook onbekend.
  {
    const r = readP6XML(project(activity(1, 'T', 'toString') + activity(2, 'C', 'constructor')));
    eq('1p toString ⇒ geen constraint', r.tasks.find(t => t.wbsCode === 'T')?.constraint, undefined);
    eq('1p constructor ⇒ geen constraint', r.tasks.find(t => t.wbsCode === 'C')?.constraint, undefined);
  }

  // (3) Round-trip met de eigen writer: wat OPS schrijft, leest OPS terug.
  {
    const first = readP6XML(project(TABLE.map(([label], i) => activity(200 + i, `R${i}`, label)).join('')));
    const written = writeP6XML(first.project, first.calendar, first.tasks, first.sequences, first.resources, first.assignments);
    const again = readP6XML(written);
    TABLE.forEach(([label, , type, hard], i) => {
      const t = again.tasks.find(x => x.wbsCode === `R${i}`);
      eq(`3 round-trip '${label}'`, [t?.constraint?.type, t?.constraint?.hard === true], [type, hard]);
    });
  }

  // (4) Rekenresultaat na openen (F5 via `recompute`): OZ1060 heeft `Start On or After` op een
  //     latere dag dan zijn geplande start ⇒ de start schuift op; OZ1130 houdt `Finish On or Before`.
  {
    const xml = wrap(`<Project><ObjectId>9031</ObjectId><Id>OZ</Id><Name>Rekenen</Name>
      <PlannedStartDate>2025-01-02T08:00:00</PlannedStartDate>
      <Activity><ObjectId>1</ObjectId><Id>OZ1060</Id><Name>OZ1060</Name><Type>Task Dependent</Type>
        <PlannedDuration>8</PlannedDuration><PlannedStartDate>2025-01-02T08:00:00</PlannedStartDate>
        <PlannedFinishDate>2025-01-02T16:00:00</PlannedFinishDate>
        <PrimaryConstraintType>Start On or After</PrimaryConstraintType><PrimaryConstraintDate>2025-01-08T08:00:00</PrimaryConstraintDate></Activity>
      <Activity><ObjectId>2</ObjectId><Id>OZ1130</Id><Name>OZ1130</Name><Type>Task Dependent</Type>
        <PlannedDuration>8</PlannedDuration><PlannedStartDate>2025-01-02T08:00:00</PlannedStartDate>
        <PlannedFinishDate>2025-01-02T16:00:00</PlannedFinishDate>
        <PrimaryConstraintType>Finish On or Before</PrimaryConstraintType><PrimaryConstraintDate>2025-01-27T16:00:00</PrimaryConstraintDate></Activity>
    </Project>`);
    const parsed = await parseOpenedFile({ name: 'constraints.xml', text: xml });
    S().newProject();
    S().applyOpenedImport(parsed, { filePath: null, recompute: true, fit: false, linkedOpen: true });
    const byCode = (c: string) => S().tasks.find(t => t.wbsCode === c);
    eq('4a OZ1060 constraint in de store', [byCode('OZ1060')?.constraint?.type, byCode('OZ1060')?.constraint?.date?.slice(0, 10)], ['SNET', '2025-01-08']);
    S().runCPM(); // F5
    eq('4b OZ1060 vroegste start na F5 = constraintdatum', byCode('OZ1060')?.time.earlyStart?.slice(0, 10), '2025-01-08');
    eq('4c OZ1130 constraint in de store', [byCode('OZ1130')?.constraint?.type, byCode('OZ1130')?.constraint?.date?.slice(0, 10)], ['FNLT', '2025-01-27']);
  }
}

await main();
if (fails.length) {
  for (const f of fails) console.log(`XX  check-p6xml-constraint-labels: ${f}`);
  process.exitCode = 1;
} else {
  console.log(`OK  check-p6xml-constraint-labels: ${checks} checks (PMXML-labels + CS_-tokens, round-trip, herberekening)`);
}
