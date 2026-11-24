import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface MatrixOpening {
  file: string;
  taskTypes?: boolean;
  foreignPset?: boolean;
  secondWorkPlan?: boolean;
  complexUnit?: boolean;
  pad?: number;
  derive?: 'datums' | 'profiel';
}

export interface MatrixCase {
  name: string;
  route: 'document' | 'bestand';
  threshold?: number | 'eerste';
  openings: MatrixOpening[];
}

export type RecordedNotice = Record<string, unknown>;
export interface OpenNoticeReference { basis: string; cases: Record<string, RecordedNotice[][]> }

const OWN_MODEL = 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc';
const OWN = 'public/examples/showcase-verbouwing-eengezinswoning.ifc';
const ARCHIVE = 'tests/planning/fixtures/xer-archief-herschreven.ifc';

const KINDS: ReadonlyArray<[string, MatrixOpening, MatrixOpening]> = [
  ['geen melding', { file: OWN_MODEL }, { file: OWN }],
  ['onbruikbaar XER-archief', { file: ARCHIVE, foreignPset: true }, { file: ARCHIVE }],
  ['opgenomen datums', { file: OWN_MODEL, derive: 'datums' }, { file: OWN, derive: 'datums' }],
  ['rekenprofiel', { file: OWN_MODEL, derive: 'profiel' }, { file: OWN, derive: 'profiel' }],
];

export const OPEN_NOTICE_CASES: readonly MatrixCase[] = [
  ...KINDS.flatMap(([kind, foreign, plain]) => [false, true].flatMap(taskTypes => [true, false].flatMap(withForeign =>
    [false, true].map((large): MatrixCase => ({
      name: `${kind}${taskTypes ? ', taaktypen' : ''}${withForeign ? ', vreemd deel' : ', geen vreemd deel'}${large ? ', drempel laag' : ''}`,
      route: 'document',
      ...(large ? { threshold: 1 } : {}),
      openings: [{ ...(withForeign ? foreign : plain), taskTypes }],
    }))))),
  { name: 'eigen bestand uit v2026.7.2', route: 'bestand', openings: [{ file: 'tests/planning/fixtures/oude-tags/v2026.7.2-woongebouw-nieuwbouw.ifc' }] },
  { name: 'eigen bestand met los project', route: 'bestand', openings: [{ file: 'tests/planning/fixtures/oude-tags/main-df9eafc7d-woongebouw-nieuwbouw.ifc' }] },
  { name: 'Bonsai-planning met model', route: 'bestand', openings: [{ file: 'tests/fixtures/ifc-foreign/bonsai-4d.ifc' }] },
  { name: 'eigen planning met een complexe eenheid', route: 'bestand', openings: [{ file: OWN, complexUnit: true }] },
  { name: 'reeks: groot met taaktypen, dan klein met taaktypen', route: 'bestand', threshold: 1,
    openings: [{ file: OWN_MODEL, taskTypes: true }, { file: OWN, taskTypes: true }] },
  { name: 'reeks: klein, dan groot', route: 'bestand', threshold: 'eerste', openings: [{ file: OWN_MODEL }, { file: OWN_MODEL, pad: 4096 }] },
  { name: 'reeks: twee keer groot', route: 'bestand', threshold: 1,
    openings: [{ file: OWN_MODEL, taskTypes: true }, { file: OWN_MODEL, taskTypes: true, pad: 4096 }] },
  { name: 'reeks: twee werkplannen met taaktypen, dan een eigen planning met taaktypen', route: 'bestand',
    openings: [{ file: OWN_MODEL, taskTypes: true, secondWorkPlan: true }, { file: OWN, taskTypes: true }] },
  { name: 'reeks: taaktypen en model, dezelfde soort met een ander aantal, dan een eigen planning', route: 'bestand',
    openings: [{ file: OWN_MODEL, taskTypes: true }, { file: OWN_MODEL, taskTypes: true, foreignPset: true }, { file: OWN, taskTypes: true }] },
];

const END = /ENDSEC;\s*END-ISO-10303-21;\s*$/;

export function openingText(root: string, opening: MatrixOpening): string {
  let text = readFileSync(join(root, opening.file), 'utf8');
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
  if (opening.pad) text = text.replace('\nDATA;\n', `\nDATA;\n/*${' '.repeat(opening.pad)}*/\n`);
  return text;
}

const shiftDays = (value: string, days: number) => {
  if (!value) return value;
  const ms = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : `${value}Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, value.length);
};

export async function runOpenNoticeCase(root: string, matrixCase: MatrixCase): Promise<RecordedNotice[][]> {
  const { createAppStoreContext } = await import('@/state/appStoreFactory');
  const { parseOpenedFile } = await import('@/services/formatRegistry');
  const { isMultiDocumentImport } = await import('@/services/importTypes');
  const { __resetTaskTypesNoticeForTests } = await import('@/state/taskTypesNotice');
  const { lowerForeignOpenWarnBytesForTests } = await import('@/services/ifc/foreignOpenSize');
  const encoder = new TextEncoder();
  const texts = matrixCase.openings.map(opening => openingText(root, opening));
  const threshold = matrixCase.threshold === 'eerste' ? encoder.encode(texts[0]).length : matrixCase.threshold;
  __resetTaskTypesNoticeForTests();
  lowerForeignOpenWarnBytesForTests(threshold);
  const store = createAppStoreContext().store;
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  const steps: RecordedNotice[][] = [];
  try {
    for (const [index, opening] of matrixCase.openings.entries()) {
      const name = `opening-${index + 1}.ifc`;
      const bytes = encoder.encode(texts[index]);
      if (matrixCase.route === 'bestand') {
        await store.getState().openOpenedFile({ name, content: '', bytes, ref: null }, {});
      } else {
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
      }
      let recorded = JSON.stringify(store.getState().ui.notifications.map(({ id: _id, ...rest }) => rest));
      store.getState().documents.forEach((document, position) => { recorded = recorded.split(document.id).join(`document-${position + 1}`); });
      steps.push(JSON.parse(recorded) as RecordedNotice[]);
    }
  } finally {
    lowerForeignOpenWarnBytesForTests();
  }
  return steps;
}

export async function runOpenNoticeMatrix(root: string): Promise<Record<string, RecordedNotice[][]>> {
  const out: Record<string, RecordedNotice[][]> = {};
  for (const matrixCase of OPEN_NOTICE_CASES) out[matrixCase.name] = await runOpenNoticeCase(root, matrixCase);
  return out;
}
