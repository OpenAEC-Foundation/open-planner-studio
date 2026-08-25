import './domStub';
import { createAppStore } from '@/state/appStore';
import {
  capturePayload,
  freshPayload,
  hydratePayload,
  payloadFromInput,
  type DocumentPayload,
  type RecoveryDocInput,
} from '@/state/documentContract';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

type LegacyHistoryFields = {
  undoStack: unknown[];
  redoStack: unknown[];
};

function hasLegacyHistoryFields(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  return 'undoStack' in value || 'redoStack' in value;
}

const oldMarker = 'oude-history-mag-nooit-terugkomen';

// Een oude slapende documentpayload kan de verdwenen arrays nog als extra runtimekeys dragen.
// Hydrate leest uitsluitend DOCUMENT_FIELDS: projectdata landt, de oude historykeys niet.
const payloadStore = createAppStore();
const legacyBase = freshPayload();
const legacyPayload = {
  ...legacyBase,
  project: { ...legacyBase.project, name: 'Oude payload' },
  undoStack: [{ marker: oldMarker }],
  redoStack: [{ marker: oldMarker }],
} satisfies DocumentPayload & LegacyHistoryFields;
payloadStore.setState(state => hydratePayload(state, legacyPayload));
eq('Oude payload hydrateert de gewone projectdata', payloadStore.getState().project.name, 'Oude payload');
ok('Oude payload maakt geen legacy historykeys op de actieve store',
  !hasLegacyHistoryFields(payloadStore.getState()));
ok('Capture schrijft oude historykeys nooit opnieuw naar een documentpayload',
  !hasLegacyHistoryFields(capturePayload(payloadStore.getState())));
ok('Capture lekt ook de oude marker niet via een andere key',
  !JSON.stringify(capturePayload(payloadStore.getState())).includes(oldMarker));

// Een recovery-invoer uit een oude sessie mag dezelfde extra keys bevatten. payloadFromInput bouwt
// een verse payload uit de bekende IFC-/identiteitsvelden en neemt de oude arrays niet over.
const base = freshPayload();
const legacyRecovery = {
  id: 'legacy-recovery',
  project: { ...base.project, id: 'legacy-project', name: 'Oud crashherstel' },
  calendar: base.calendar,
  tasks: base.tasks,
  sequences: base.sequences,
  resources: base.resources,
  assignments: base.assignments,
  resourceCalendars: base.calendars,
  activityCodeTypes: base.activityCodeTypes,
  customFieldDefs: base.customFieldDefs,
  baselines: base.baselines,
  activeBaselineId: base.activeBaselineId,
  filePath: '/tmp/legacy-recovery.ifc',
  isDirty: false,
  undoStack: [{ marker: oldMarker }],
  redoStack: [{ marker: oldMarker }],
} satisfies RecoveryDocInput & LegacyHistoryFields;
const migratedRecoveryPayload = payloadFromInput(legacyRecovery);
eq('Recoverymigratie behoudt projectdata', migratedRecoveryPayload.project.name, 'Oud crashherstel');
ok('Recoverymigratie neemt geen legacy historykeys over',
  !hasLegacyHistoryFields(migratedRecoveryPayload));
ok('Recoverymigratie lekt de oude marker nergens in de nieuwe payload',
  !JSON.stringify(migratedRecoveryPayload).includes(oldMarker));

// De echte multi-documentherstelgrens wist bestaande sessiehistory, hydrateert de oude invoer en
// schrijft bij de eerstvolgende capture uitsluitend het nieuwe documentcontract terug.
const recoveryStore = createAppStore();
const R = () => recoveryStore.getState();
R().addTask({ name: 'Bestaande sessiehandeling' });
ok('Setup: vóór herstel bestaat sessiehistory', R().historyEvents.length > 0);
R().restoreDocuments([legacyRecovery], legacyRecovery.id);
eq('Crashherstel start met een lege sessieledger', R().historyEvents, []);
eq('Crashherstel reset de sessieteller', R().nextHistorySequence, 1);
eq('Crashherstel publiceert de gewone projectdata', R().project.name, 'Oud crashherstel');
ok('Crashherstel publiceert geen oude historykeys op store of open payload',
  !hasLegacyHistoryFields(R())
  && R().getOpenDocumentPayloads().every(document => !hasLegacyHistoryFields(document.payload)));
ok('De recovery-output bevat de oude marker nergens',
  !JSON.stringify(R().getOpenDocumentPayloads()).includes(oldMarker));
eq('Het negeren van oude history maakt een schoon document niet dirty', R().isDirty, false);

// Nieuwe payloads hebben uitsluitend het huidige contract en beginnen zonder sessiehistoryvelden.
const currentPayload = freshPayload();
ok('Een nieuwe payload bevat geen legacy historykeys', !hasLegacyHistoryFields(currentPayload));
ok('Een nieuwe payload draagt evenmin de globale session-historyledger',
  !('historyEvents' in currentPayload) && !('nextHistorySequence' in currentPayload));

if (diffs.length > 0) {
  console.error(`FAIL session-history-migration: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  session-history-migration: ${checks}/${checks}`);
}
