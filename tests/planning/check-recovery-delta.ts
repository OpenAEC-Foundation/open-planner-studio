// X9 recovery-delta — de pure grens tussen documentinhoud en recovery-opslag.
//
// Bewijst dat `isDirty` uitsluitend manifestmetadata blijft: inhoudsdelta's volgen de volledige
// IFCSaveSource via sameIFCSource. Daardoor kan één bewerking precies één writeIFC/upsert geven,
// terwijl tab- of metadatawijzigingen geen grote IFC-payload raken.
import {
  RecoveryDeltaTracker,
  persistedRecoveryState,
  planRecoveryDelta,
  type RecoverySourceDocument,
} from '@/services/recovery/recoveryDelta';
import type { IFCSaveSource } from '@/state/ifcSaveInput';

declare const process: { exit(code: number): never };

const failures: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks += 1;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

// Alle referenties zijn bewust afzonderlijk. De concrete domeinvorm doet hier niet ter zake: de
// productregel is dat `sameIFCSource` precies deze velden referentieel vergelijkt.
const source = (label: string): IFCSaveSource => ({
  project: { label }, calendar: { label }, tasks: [{ label }], sequences: [{ label }],
  resources: [{ label }], assignments: [{ label }], activityCodeTypes: [{ label }],
  customFieldDefs: [{ label }], calendars: [{ label }], baselines: [{ label }],
  activeBaselineId: label, xerImportMetadata: { label }, xerSourceArchive: { label },
  xerSourceProjectId: label,
} as unknown as IFCSaveSource);

const a = source('a');
const b = source('b');
const docs: RecoverySourceDocument[] = [
  { id: 'a', source: a, filePath: '/tmp/a.ifc', isDirty: true },
  { id: 'b', source: b, filePath: '/tmp/b.ifc', isDirty: true },
];

const first = planRecoveryDelta('a', docs, null);
eq('1 verse recovery schrijft beide documentinhouden', first.changedDocuments.map((document) => document.id), ['a', 'b']);
eq('2 verse recovery schrijft manifestmetadata', first.manifestChanged, true);

const persisted = persistedRecoveryState('a', docs);
const aChanged = source('a-gewijzigd');
const afterOneEdit: RecoverySourceDocument[] = [
  { ...docs[0]!, source: aChanged },
  docs[1]!,
];
const oneEdit = planRecoveryDelta('a', afterOneEdit, persisted);
eq('3 één inhoudsbewerking selecteert exact één IFC-upsert', oneEdit.changedDocuments.map((document) => document.id), ['a']);
eq('4 één inhoudsbewerking zonder metadatawijziging schrijft geen extra manifestvorm', oneEdit.manifestChanged, false);

const afterEditPersisted = persistedRecoveryState('a', afterOneEdit);
const activeOnly = planRecoveryDelta('b', afterOneEdit, afterEditPersisted);
eq('5 actieve-tabwissel heeft nul IFC-upserts', activeOnly.changedDocuments.length, 0);
eq('6 actieve-tabwissel is manifest-only', activeOnly.manifestChanged, true);

const dirtyOnly: RecoverySourceDocument[] = [
  { ...afterOneEdit[0]!, isDirty: false },
  afterOneEdit[1]!,
];
const metadataOnly = planRecoveryDelta('a', dirtyOnly, afterEditPersisted);
eq('7 dirty-vlag zonder andere bronvelden heeft nul IFC-upserts', metadataOnly.changedDocuments.length, 0);
eq('8 dirty-vlag zonder inhoud is manifestmetadata', metadataOnly.manifestChanged, true);

const unchangedButDirty: RecoverySourceDocument[] = afterOneEdit.map((document) => ({ ...document, isDirty: true }));
const stillNoContentDelta = planRecoveryDelta('a', unchangedButDirty, afterEditPersisted);
eq('9 isDirty=true is nooit zelfstandig een inhoudsrevisie', stillNoContentDelta.changedDocuments.length, 0);

const noop = planRecoveryDelta('a', afterOneEdit, afterEditPersisted);
eq('10 identieke bron én metadata doet geen I/O', noop.needsPersist, false);

// De hook gebruikt deze tracker direct. Cruciaal: een serialization-cache is veilig, maar een
// storagefout mag de persisted basis niet promoten. De retry MOET daarom dezelfde upsert opnieuw
// aanbieden, ook wanneer hij de reeds gebouwde IFC-string mag hergebruiken.
const tracker = new RecoveryDeltaTracker();
let serializations = 0;
const serialize = (value: IFCSaveSource): string => {
  serializations += 1;
  return `IFC-${(value.project as unknown as { label: string }).label}`;
};
const initialWrite = tracker.prepare('a', docs, serialize)!;
eq('11 tracker bouwt initieel twee IFC-teksten', [initialWrite.upserts.length, serializations], [2, 2]);
tracker.commit('a', docs);
const failedWrite = tracker.prepare('a', afterOneEdit, serialize)!;
eq('12 na één edit biedt tracker exact één upsert aan', failedWrite.upserts.map((document) => document.id), ['a']);
eq('13 die edit wordt éénmaal geserialiseerd', serializations, 3);
// Simuleer de mislukte `saveRecovery`: bewust GEEN commit.
const retryAfterFailure = tracker.prepare('a', afterOneEdit, serialize)!;
eq('14 storagefout houdt de gewijzigde bron in de volgende delta', retryAfterFailure.upserts.map((document) => document.id), ['a']);
eq('15 retry mag de al gebouwde IFC-string hergebruiken', serializations, 3);
tracker.commit('a', afterOneEdit);
const manifestOnly = tracker.prepare('b', afterOneEdit, serialize)!;
eq('16 na succesvolle edit is actieve-tabwissel manifest-only', [manifestOnly.upserts.length, serializations], [0, 3]);

if (failures.length === 0) {
  console.log(`OK  recovery-delta: alle ${checks} checks groen`);
  process.exit(0);
}
console.log(`XX  recovery-delta: ${failures.length} afwijking(en) van ${checks}`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
