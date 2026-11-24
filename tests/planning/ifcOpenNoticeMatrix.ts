import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { externIfc } from '../fixtures/recordedDatesIfc';

export interface MatrixOpening {
  file: string;
  taskTypes?: boolean;
  foreignPset?: boolean;
  secondWorkPlan?: boolean;
  complexUnit?: boolean;
  derive?: 'datums' | 'profiel';
  large?: boolean;
}

export interface MatrixCase { name: string; openings: MatrixOpening[] }

export type RecordedNotice = Record<string, unknown>;
export type RecordedStep = number[];
export interface OpenNoticeReference {
  basis: string;
  notices: RecordedNotice[];
  representatives: string[];
  cases: Record<string, RecordedStep[]>;
}
export interface MainStep { calls: number; shown: RecordedNotice[] }
export interface LiveStep { calls: number; notifications: readonly RecordedNotice[] }
export interface LiveCase { steps: LiveStep[]; documentIds: string[] }

export const WITH_MODEL = 'notifications.ifcForeignOpenedWithModel';
export const OTHER_DATA = 'notifications.ifcForeignOpenedOtherData';
export const WORK_PLANS = 'notifications.ifcForeignWorkPlansMerged';
export const MAX_SHOWN = 3;

const OWN_MODEL = 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc';
const OWN = 'public/examples/showcase-verbouwing-eengezinswoning.ifc';
const ARCHIVE = 'tests/planning/fixtures/xer-archief-herschreven.ifc';
const BONSAI = 'tests/fixtures/ifc-foreign/bonsai-4d.ifc';
const TWO_PLANS = 'tests/fixtures/ifc-foreign/twee-werkplannen.ifc';
export const EXTERN_DATES_WALL = 'extern: opgenomen datums en een wand';

const KINDS: ReadonlyArray<[string, MatrixOpening, MatrixOpening]> = [
  ['geen melding', { file: OWN_MODEL }, { file: OWN }],
  ['onbruikbaar XER-archief', { file: ARCHIVE, foreignPset: true }, { file: ARCHIVE }],
  ['opgenomen datums', { file: OWN_MODEL, derive: 'datums' }, { file: OWN, derive: 'datums' }],
  ['rekenprofiel', { file: OWN_MODEL, derive: 'profiel' }, { file: OWN, derive: 'profiel' }],
];

const single = (name: string, opening: MatrixOpening): MatrixCase => ({ name, openings: [opening] });

export const OPEN_NOTICE_SINGLES: readonly MatrixCase[] = [
  ...KINDS.flatMap(([kind, foreign, plain]) => [false, true].flatMap(taskTypes => [
    single(`${kind}${taskTypes ? ', taaktypen' : ''}, geen vreemd deel`, { ...plain, taskTypes }),
    single(`${kind}${taskTypes ? ', taaktypen' : ''}, vreemd deel`, { ...foreign, taskTypes }),
    single(`${kind}${taskTypes ? ', taaktypen' : ''}, vreemd deel, groot`, { ...foreign, taskTypes, large: true }),
  ])),
  single('eigen bestand uit v2026.7.2', { file: 'tests/planning/fixtures/oude-tags/v2026.7.2-woongebouw-nieuwbouw.ifc' }),
  single('eigen bestand met los project', { file: 'tests/planning/fixtures/oude-tags/main-df9eafc7d-woongebouw-nieuwbouw.ifc' }),
  single('Bonsai-planning met model', { file: BONSAI }),
  single('Bonsai-planning met model, groot', { file: BONSAI, large: true }),
  single('twee werkplannen', { file: TWO_PLANS }),
  single('twee werkplannen, groot', { file: TWO_PLANS, large: true }),
  single('eigen planning met model en een tweede werkplan, taaktypen', { file: OWN_MODEL, taskTypes: true, secondWorkPlan: true }),
  single('eigen planning met een complexe eenheid', { file: OWN, complexUnit: true }),
  single(EXTERN_DATES_WALL, { file: EXTERN_DATES_WALL }),
  single(`${EXTERN_DATES_WALL}, groot`, { file: EXTERN_DATES_WALL, large: true }),
];

export const NAMED_SEQUENCES: readonly MatrixCase[] = [
  { name: 'reeks: groot met taaktypen, dan klein met taaktypen',
    openings: [{ file: OWN_MODEL, taskTypes: true, large: true }, { file: OWN, taskTypes: true }] },
  { name: 'reeks: klein, dan groot', openings: [{ file: OWN_MODEL }, { file: OWN_MODEL, large: true }] },
  { name: 'reeks: twee keer groot',
    openings: [{ file: OWN_MODEL, taskTypes: true, large: true }, { file: OWN_MODEL, taskTypes: true, large: true }] },
  { name: 'reeks: twee werkplannen met taaktypen, dan een eigen planning met taaktypen',
    openings: [{ file: OWN_MODEL, taskTypes: true, secondWorkPlan: true }, { file: OWN, taskTypes: true }] },
  { name: 'reeks: taaktypen en model, dezelfde soort met een ander aantal, dan een eigen planning',
    openings: [{ file: OWN_MODEL, taskTypes: true }, { file: OWN_MODEL, taskTypes: true, foreignPset: true }, { file: OWN, taskTypes: true }] },
  { name: 'reeks: Bonsai groot, dan twee werkplannen klein', openings: [{ file: BONSAI, large: true }, { file: TWO_PLANS }] },
  { name: 'reeks: drie blijvende meldingen, dan een bestand waarbij main niets toont',
    openings: [{ file: BONSAI, large: true }, { file: TWO_PLANS }, { file: OWN_MODEL }] },
  { name: 'reeks: gewone melding, blijvende melding, eigen telmelding, dan een nieuwe melding',
    openings: [{ file: OWN, taskTypes: true }, { file: OWN, derive: 'datums' }, { file: OWN_MODEL }, { file: TWO_PLANS }] },
];

const END = /ENDSEC;\s*END-ISO-10303-21;\s*$/;

const externText = () => externIfc('Matrix')
  .replace("'x','y','');", "'x','y','');\nFILE_SCHEMA(('IFC4X3_ADD2'));")
  .replace(END, "#99=IFCWALL('0abcdefghijkmnopqrstuv',$,'Wand',$,$,$,$,$,$);\nENDSEC;\nEND-ISO-10303-21;\n");

export function openingText(root: string, opening: MatrixOpening): string {
  let text = opening.file === EXTERN_DATES_WALL ? externText() : readFileSync(join(root, opening.file), 'utf8');
  const append = (lines: string) => {
    if (!END.test(text)) throw new Error(`${opening.file}: geen einde van DATA gevonden`);
    text = text.replace(END, `${lines}\nENDSEC;\nEND-ISO-10303-21;\n`);
  };
  if (opening.taskTypes) {
    const pset = /(#\d+=IFCPROPERTYSET\('[^']*',[^,]*,'OPS_ProjectSettings',\$,\()([^)]*)\)\);/;
    if (!pset.test(text)) throw new Error(`${opening.file}: geen OPS_ProjectSettings`);
    text = text.replace(pset, "#99101=IFCPROPERTYSINGLEVALUE('DefaultWorkRule',$,IFCLABEL('FIXED_WORK'),$);\n$1$2,#99101));");
  }
  if (opening.foreignPset) {
    append("#99102=IFCPROPERTYSINGLEVALUE('ExternKenmerk',$,IFCLABEL('blijft'),$);\n#99103=IFCPROPERTYSET('0123456789012345678901',$,'ExternPakket',$,(#99102));");
  }
  if (opening.secondWorkPlan) append("#99201=IFCWORKPLAN('0WerkplanTweeVanElders',$,'Plan 2',$,$,$,$,$,$,$,$,$,$,.NOTDEFINED.);");
  if (opening.complexUnit) append('#99301=(IFCNAMEDUNIT(*,.LENGTHUNIT.)IFCSIUNIT(.MILLI.,.METRE.));');
  return text;
}

export async function expectedIfcLines(text: string): Promise<RecordedNotice[]> {
  const { scanForeign } = await import('@/services/ifc/foreign/foreignScan');
  const scan = scanForeign(new TextEncoder().encode(text));
  if (!scan.ok) throw new Error('scan geweigerd');
  const objects = scan.counts.C + scan.counts.A + scan.counts.V;
  if (objects === 0) return [];
  const lines: RecordedNotice[] = [{ messageKey: text.includes('IFCWALL(') ? WITH_MODEL : OTHER_DATA, params: { count: objects }, numberParams: { objects } }];
  const plans = text.match(/=IFCWORKPLAN\(/g)?.length ?? 0;
  if (plans > 1) lines.push({ messageKey: WORK_PLANS, numberParams: { plans } });
  return lines;
}

const shiftDays = (value: string, days: number) => {
  if (!value) return value;
  const ms = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : `${value}Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, value.length);
};

export async function runOpenNoticeCase(root: string, matrixCase: MatrixCase): Promise<LiveCase> {
  const { createAppStoreContext } = await import('@/state/appStoreFactory');
  const { parseOpenedFile } = await import('@/services/formatRegistry');
  const { isMultiDocumentImport } = await import('@/services/importTypes');
  const { __resetTaskTypesNoticeForTests } = await import('@/state/taskTypesNotice');
  const { lowerForeignOpenWarnBytesForTests } = await import('@/services/ifc/foreignOpenSize');
  const encoder = new TextEncoder();
  __resetTaskTypesNoticeForTests();
  const store = createAppStoreContext().store;
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  let calls = 0;
  const notify = store.getState().notify;
  store.setState({ notify: (notice) => { calls++; notify(notice); } });
  const steps: LiveStep[] = [];
  try {
    for (const [index, opening] of matrixCase.openings.entries()) {
      lowerForeignOpenWarnBytesForTests(opening.large ? 1 : undefined);
      calls = 0;
      const name = `opening-${index + 1}.ifc`;
      const bytes = encoder.encode(openingText(root, opening));
      if (opening.derive) {
        const parsed = await parseOpenedFile({ name, bytes }, {}, { ifcBytes: true });
        const result = isMultiDocumentImport(parsed) ? parsed.results[0] : parsed;
        if (opening.derive === 'profiel') result.suggestedProfileId = 'p6';
        if (opening.derive === 'datums') {
          result.recordedTimesOrigin = 'ifc';
          const time = result.tasks[result.tasks.length - 1].time as unknown as Record<string, string>;
          for (const field of ['scheduleStart', 'scheduleFinish', 'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish']) {
            time[field] = shiftDays(time[field], 7);
          }
        }
        store.getState().openAsDocument(parsed, { name, ref: null });
      } else {
        await store.getState().openOpenedFile({ name, content: '', bytes, ref: null }, {});
      }
      steps.push({ calls, notifications: store.getState().ui.notifications as unknown as readonly RecordedNotice[] });
    }
  } finally {
    lowerForeignOpenWarnBytesForTests();
  }
  return { steps, documentIds: store.getState().documents.map(document => document.id) };
}

export function plainNotice(notice: RecordedNotice, documentIds: readonly string[], drop: readonly string[] = []): RecordedNotice {
  const rest = Object.fromEntries(Object.entries(notice).filter(([key]) => key !== 'id' && !drop.includes(key)));
  let text = JSON.stringify(rest);
  documentIds.forEach((id, position) => { text = text.split(id).join(`document-${position + 1}`); });
  return JSON.parse(text) as RecordedNotice;
}

export async function signatureOf(root: string, matrixCase: MatrixCase, shown: readonly RecordedNotice[]): Promise<string> {
  const lines = await expectedIfcLines(openingText(root, matrixCase.openings[0]));
  return JSON.stringify([
    shown.map(n => [n.severity, n.messageKey, n.sticky === true, n.dedupeKey ?? null, n.helpArticleId ?? null,
      ((n.detailLines as RecordedNotice[] | undefined) ?? []).map(line => line.messageKey)]),
    lines.map(line => line.messageKey),
  ]);
}

export async function chooseRepresentatives(root: string, shownBySingle: ReadonlyMap<string, readonly RecordedNotice[]>): Promise<string[]> {
  const seen = new Set<string>();
  const chosen: string[] = [];
  for (const matrixCase of OPEN_NOTICE_SINGLES) {
    const signature = await signatureOf(root, matrixCase, shownBySingle.get(matrixCase.name) ?? []);
    if (seen.has(signature)) continue;
    seen.add(signature);
    chosen.push(matrixCase.name);
  }
  return chosen;
}

export async function generatedSequences(root: string, representatives: readonly string[],
  shownBySingle: ReadonlyMap<string, readonly RecordedNotice[]>): Promise<MatrixCase[]> {
  const byName = new Map(OPEN_NOTICE_SINGLES.map(matrixCase => [matrixCase.name, matrixCase]));
  const reps = representatives.map(name => byName.get(name)!);
  const pairs = reps.flatMap((a, i) => reps.map((b, j): MatrixCase => ({ name: `paar ${i + 1}-${j + 1}`, openings: [...a.openings, ...b.openings] })));
  const sticky = (matrixCase: MatrixCase) => (shownBySingle.get(matrixCase.name) ?? []).filter(n => n.sticky === true).length;
  const byStickiness = reps.map((matrixCase, index) => ({ matrixCase, index })).sort((a, b) => sticky(b.matrixCase) - sticky(a.matrixCase) || a.index - b.index);
  const quiet: { matrixCase: MatrixCase; index: number }[] = [];
  for (const [index, matrixCase] of reps.entries()) {
    if ((shownBySingle.get(matrixCase.name) ?? []).length > 0) continue;
    if ((await expectedIfcLines(openingText(root, matrixCase.openings[0]))).length > 0) quiet.push({ matrixCase, index });
  }
  const sequence = (parts: { matrixCase: MatrixCase; index: number }[]): MatrixCase => ({
    name: `reeks ${parts.map(part => part.index + 1).join('-')}`, openings: parts.flatMap(part => part.matrixCase.openings),
  });
  return [
    ...pairs,
    sequence([byStickiness[0], quiet[0], byStickiness[1]]),
    sequence([byStickiness[0], byStickiness[1], byStickiness[2], quiet[0]]),
  ];
}

export async function openNoticePlan(root: string, reference: OpenNoticeReference): Promise<MatrixCase[]> {
  const shownBySingle = new Map(OPEN_NOTICE_SINGLES.map(matrixCase => [matrixCase.name,
    (reference.cases[matrixCase.name]?.[0] ?? [0]).slice(1).map(index => reference.notices[index])]));
  return [...OPEN_NOTICE_SINGLES, ...NAMED_SEQUENCES, ...await generatedSequences(root, reference.representatives, shownBySingle)];
}

export function mainSteps(reference: OpenNoticeReference, name: string): MainStep[] {
  return (reference.cases[name] ?? []).map(([calls, ...shown]) => ({ calls, shown: shown.map(index => reference.notices[index]) }));
}

export async function recordOpenNoticeReference(root: string, basis: string): Promise<string> {
  const notices: string[] = [];
  const cases: Record<string, RecordedStep[]> = {};
  const record = async (matrixCase: MatrixCase) => {
    const live = await runOpenNoticeCase(root, matrixCase);
    cases[matrixCase.name] = live.steps.map(step => [step.calls, ...step.notifications.map(notice => {
      const text = JSON.stringify(plainNotice(notice, live.documentIds));
      const known = notices.indexOf(text);
      return known >= 0 ? known : notices.push(text) - 1;
    })]);
  };
  for (const matrixCase of OPEN_NOTICE_SINGLES) await record(matrixCase);
  const shownBySingle = new Map(OPEN_NOTICE_SINGLES.map(matrixCase => [matrixCase.name,
    cases[matrixCase.name][0].slice(1).map(index => JSON.parse(notices[index]) as RecordedNotice)]));
  const representatives = await chooseRepresentatives(root, shownBySingle);
  for (const matrixCase of [...NAMED_SEQUENCES, ...await generatedSequences(root, representatives, shownBySingle)]) await record(matrixCase);
  return [
    '{',
    `"basis": ${JSON.stringify(basis)},`,
    '"notices": [',
    notices.map(text => ` ${text}`).join(',\n'),
    '],',
    `"representatives": ${JSON.stringify(representatives, null, 1)},`,
    '"cases": {',
    Object.entries(cases).map(([name, steps]) => ` ${JSON.stringify(name)}: ${JSON.stringify(steps)}`).join(',\n'),
    '}',
    '}',
    '',
  ].join('\n');
}
