// P6 XML-writer: elk keuzeveld (enum) krijgt het PMXML-label, nooit het XER-token.
//
// De fout: de writer schreef `<PrimaryConstraintType>`/`<SecondaryConstraintType>` als XER-token
// (`CS_MSOA`). Echte P6 XML (PMXML) gebruikt het label (`Start On or After`); P6 leest het token
// waarschijnlijk niet, en dan gaan de constraints verloren bij export naar P6.
// Bron van de labels: MPXJ `org.mpxj.primavera.*Helper` (`XML_TYPE_MAP`) en `XmlProjectWriter`, plus
// de waarden in echte P6 XML uit het corpus.
//
// Bewaakt:
// (1) de negen constraintsoorten als label, primair én secundair (`P6_CONSTRAINT_KINDS`);
// (2) geen enkel XER-token (`CS_`, `TT_`, `TK_`, `PR_`, `DT_`, `CP_`, `RT_`, `CA_`) in de uitvoer;
// (3) elk ander keuzeveld valt binnen de PMXML-labelset (activiteit-`Type`, `Status`,
//     `PercentCompleteType`, `DurationType`, relatie-`Type`, `ResourceType`, kalender-`Type`);
// (4) round-trip: eigen export ⇒ eigen import houdt primair + secundair (soort, hard/soft, datum).
// Corpusloos (CI).
import { readFileSync } from 'node:fs';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { P6_CONSTRAINT_KINDS } from '@/services/p6/p6ConstraintTypes';
import type { Task } from '@/types/task';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { Resource, ResourceType } from '@/types/resource';
import type { WorkRule } from '@/types/workRule';
import { installDOMParser } from './xmldom-shim';

declare const process: { exitCode?: number };
installDOMParser();

const fails: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}

// Labelsets uit MPXJ (`XML_TYPE_MAP` per helper).
const PMXML = {
  constraint: ['Start On', 'Start On or Before', 'Start On or After', 'Finish On', 'Finish On or Before',
    'Finish On or After', 'As Late As Possible', 'Mandatory Start', 'Mandatory Finish'],
  activityType: ['Task Dependent', 'Resource Dependent', 'Level of Effort', 'Start Milestone', 'Finish Milestone', 'WBS Summary'],
  activityStatus: ['Not Started', 'In Progress', 'Completed'],
  percentCompleteType: ['Physical', 'Duration', 'Units', 'Scope'],
  durationType: ['Fixed Units/Time', 'Fixed Duration and Units/Time', 'Fixed Units', 'Fixed Duration and Units'],
  relationType: ['Finish to Start', 'Finish to Finish', 'Start to Start', 'Start to Finish'],
  resourceType: ['Labor', 'Material', 'Nonlabor'],
  calendarType: ['Global', 'Project', 'Resource'],
};

// Bron: de geneste fixture; één bladtaak wordt het sjabloon voor negen taken (één per soort).
const src = readP6XML(readFileSync(new URL('./fixtures/p6xml-genest-meerdere-projecten.xml', import.meta.url), 'utf8'));
const template = src.tasks.find(t => t.childIds.length === 0 && !t.isMilestone)!;
const D1 = '2026-06-08';
const D2 = '2026-06-22';
const n = P6_CONSTRAINT_KINDS.length;
const RULES: WorkRule[] = ['FIXED_DURATION_RATE', 'FIXED_DURATION_WORK', 'FIXED_WORK', 'FIXED_RATE'];
const tasks: Task[] = P6_CONSTRAINT_KINDS.map((k, i) => {
  // Secundair: de volgende soft-soort (hard mag niet op secundair).
  const soft = P6_CONSTRAINT_KINDS.filter(x => !x.hard);
  const k2 = soft[(i + 1) % soft.length];
  return {
    ...structuredClone(template),
    id: `t${i}`, name: `T${i}`, wbsCode: `C${i}`, parentId: null, childIds: [], status: 'NOT_STARTED',
    time: {
      ...structuredClone(template.time), completion: 0, actualStart: undefined, actualFinish: undefined,
      ...(i === 7 || i === 8 ? { scheduleDuration: 0, durationMinutes: 0 } : {}),
    },
    constraint: { type: k.type, ...(k.type === 'ALAP' ? {} : { date: D1 }), ...(k.hard ? { hard: true } : {}) },
    constraint2: { type: k2.type, ...(k2.type === 'ALAP' ? {} : { date: D2 }) },
    workRule: RULES[i % RULES.length],
    isMilestone: i === 7 || i === 8,
    ...(i === 8 ? { milestoneKind: 'FINISH' as const } : {}),
  };
});
// Voortgang: één taak gestart, één klaar.
tasks[1].time = { ...tasks[1].time, completion: 0.5, actualStart: D1 };
tasks[1].status = 'STARTED';
tasks[2].time = { ...tasks[2].time, completion: 1, actualStart: D1, actualFinish: D2 };
tasks[2].status = 'COMPLETED';
const LINKS: SequenceType[] = ['FINISH_START', 'FINISH_FINISH', 'START_START', 'START_FINISH'];
const sequences: Sequence[] = LINKS.map((type, i) => ({
  ...(src.sequences[0] ?? {}), id: `s${i}`, predecessorId: `t${i}`, successorId: `t${i + 1}`, type, lagDays: 0,
} as Sequence));
const RES_TYPES: ResourceType[] = ['LABOR', 'EQUIPMENT', 'MATERIAL', 'SUBCONTRACTOR', 'CREW'];
const resources: Resource[] = RES_TYPES.map((type, i) => ({
  ...(src.resources[0] ?? {}), id: `r${i}`, name: `R${i}`, type, parentId: undefined,
} as Resource));

const warn = console.warn;
console.warn = () => {};
let xml: string;
try {
  xml = writeP6XML(src.project, src.calendar, tasks, sequences, resources, [], src.resourceCalendars ?? [], []);
} finally { console.warn = warn; }

/** Alle waarden van `<tag>` binnen elk `<parent>`-blok. */
function values(parent: string, tag: string): string[] {
  const out: string[] = [];
  for (const block of xml.matchAll(new RegExp(`<${parent}>([\\s\\S]*?)</${parent}>`, 'g'))) {
    // Alleen directe velden: kinderblokken (WorkTime, UDF …) bevatten geen `<Type>`/`<Status>`.
    for (const m of block[1].matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g'))) out.push(m[1]);
  }
  return out;
}
const act = (code: string): string => {
  const at = xml.indexOf(`<Id>${code}</Id>`);
  return xml.slice(xml.lastIndexOf('<Activity>', at), xml.indexOf('</Activity>', at));
};

// (1) Constraints als label.
P6_CONSTRAINT_KINDS.forEach((k, i) => {
  eq(`1 primair ${k.type}${k.hard ? ' (hard)' : ''} ⇒ '${k.label}'`,
    /<PrimaryConstraintType>([^<]*)</.exec(act(`C${i}`))?.[1], k.label);
  const k2 = P6_CONSTRAINT_KINDS.filter(x => !x.hard)[(i + 1) % (n - 2)];
  eq(`1 secundair ${k2.type} ⇒ '${k2.label}'`, /<SecondaryConstraintType>([^<]*)</.exec(act(`C${i}`))?.[1], k2.label);
});

// (2) Geen XER-token als elementwaarde.
eq('2 geen XER-token in de uitvoer', xml.match(/>(CS|TT|TK|PR|DT|CP|RT|CA)_[A-Za-z0-9]+</g) ?? [], []);

// (3) Elk keuzeveld binnen de PMXML-labelset, en elke verwachte waarde komt voor.
const within = (label: string, got: string[], allowed: string[], mustHave: string[]) => {
  eq(`3 ${label} binnen PMXML-set`, got.filter(v => !allowed.includes(v)), []);
  eq(`3 ${label} bevat ${mustHave.join(', ')}`, mustHave.filter(v => !got.includes(v)), []);
};
within('PrimaryConstraintType', values('Activity', 'PrimaryConstraintType'), PMXML.constraint, PMXML.constraint);
within('SecondaryConstraintType', values('Activity', 'SecondaryConstraintType'), PMXML.constraint, ['Start On', 'As Late As Possible']);
within('activiteit-Type', values('Activity', 'Type'), PMXML.activityType, ['Task Dependent', 'Start Milestone', 'Finish Milestone']);
within('activiteit-Status', values('Activity', 'Status'), PMXML.activityStatus, PMXML.activityStatus);
within('PercentCompleteType', values('Activity', 'PercentCompleteType'), PMXML.percentCompleteType, ['Physical']);
within('DurationType', values('Activity', 'DurationType'), PMXML.durationType, PMXML.durationType);
within('relatie-Type', values('Relationship', 'Type'), PMXML.relationType, PMXML.relationType);
within('ResourceType', values('Resource', 'ResourceType'), PMXML.resourceType, PMXML.resourceType);
within('kalender-Type', values('Calendar', 'Type'), PMXML.calendarType, ['Global']);

// (4) Round-trip: eigen export ⇒ eigen import.
{
  const back = readP6XML(xml);
  P6_CONSTRAINT_KINDS.forEach((k, i) => {
    const t = back.tasks.find(x => x.wbsCode === `C${i}`);
    const want = tasks[i];
    eq(`4 round-trip C${i} primair`, [t?.constraint?.type, t?.constraint?.hard === true, t?.constraint?.date?.slice(0, 10)],
      [want.constraint!.type, k.hard, want.constraint!.date]);
    eq(`4 round-trip C${i} secundair`, [t?.constraint2?.type, t?.constraint2?.hard, t?.constraint2?.date?.slice(0, 10)],
      [want.constraint2!.type, undefined, want.constraint2!.date]);
  });
  eq('4 round-trip relatietypes', LINKS.map((_l, i) => back.sequences.find(s => {
    const p = back.tasks.find(x => x.id === s.predecessorId)?.wbsCode;
    return p === `C${i}`;
  })?.type), LINKS);
}

if (fails.length) {
  for (const f of fails) console.log(`XX  check-p6xml-writer-labels: ${f}`);
  process.exitCode = 1;
} else {
  console.log(`OK  check-p6xml-writer-labels: ${checks} checks (PMXML-labels in de export, round-trip)`);
}
