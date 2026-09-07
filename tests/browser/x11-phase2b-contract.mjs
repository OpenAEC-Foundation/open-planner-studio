import {
  assertLargeResourceEvidence,
  assertRecoveryEvidence,
  assertPhase2BEvidencePrivacy,
  LARGE_RESOURCE_EXPECTED_CATALOGS,
  LARGE_RESOURCE_EXPECTED_COUNTS,
  RECOVERY_EXPECTED_DOCUMENTS,
} from './helpers/ops-state.mjs';

const recoveryDocuments = Array.from({ length: RECOVERY_EXPECTED_DOCUMENTS }, (_, index) => ({
  ordinal: index + 1,
  documentHash: `document-${index + 1}`,
  projectIdentityHash: `project-${index + 1}`,
  selectorHash: `selector-${index + 1}`,
  archiveDigest: `${String(index + 1).padStart(64, '0')}`,
  archiveByteLength: 1000 + index,
  ifcDigest: `ifc-${index + 1}`,
  ifcByteLength: 2000 + index,
  taskCount: 1,
  sourceArchivePresent: true,
  selectorPresent: true,
  cpmExecutable: true,
  cpmExecutedViaF5: true,
}));
const order = recoveryDocuments.map((document) => document.documentHash);
const recovery = {
  initial: {
    documentCount: RECOVERY_EXPECTED_DOCUMENTS,
    manifestDocumentCount: RECOVERY_EXPECTED_DOCUMENTS,
    activeDocumentHash: order.at(-1),
    manifestActiveDocumentHash: order.at(-1),
    documentOrder: [...order],
    manifestOrder: [...order],
    documents: recoveryDocuments.map((document) => ({ ...document })),
  },
  throttle: { firstAddedAt: 1_000, secondAddedAt: 11_000, intervalMs: 10_000, manifestUnchangedBeforeDue: true },
  autosaveTrigger: { route: 'visible:Home>Task', taskDelta: 1 },
  abortedTransaction: { transactionAborted: true, beforeFingerprint: 'stable-set', afterFingerprint: 'stable-set' },
  recoveryUi: { visible: true, entryCount: RECOVERY_EXPECTED_DOCUMENTS, restoredViaVisibleButton: true, beforeUnloadDialogs: 1 },
  runtime: { nativeDialogs: { alert: 0, confirm: 0, prompt: 0 } },
  restored: {
    documentCount: RECOVERY_EXPECTED_DOCUMENTS,
    activeDocumentHash: order.at(-1),
    documentOrder: [...order],
    documents: recoveryDocuments.map(({ ifcDigest: _ifcDigest, ifcByteLength: _ifcByteLength, ...document }) => ({ ...document })),
  },
  privacy: { visibleLines: ['Restore unsaved work', "Don't restore", 'Restore'] },
};

const large = {
  counts: { ...LARGE_RESOURCE_EXPECTED_COUNTS },
  sourceArchivePresent: true,
  sourceArchiveDigest: 'a'.repeat(64),
  selectorPresent: true,
  cpmPresent: true,
  catalogs: { ...LARGE_RESOURCE_EXPECTED_CATALOGS },
  gantt: {
    rootAnchor: 'gantt-vscroll',
    primaryCanvasBound: true,
    width: 1200,
    height: 600,
    sampleCount: 4096,
    nonTransparentSamples: 4096,
    uniqueColorBuckets: 12,
    luminanceRange: 48,
    transitionCount: 320,
  },
  routes: { firstGanttRendered: true, resourcesPanelVisible: true, histogramVisible: true },
  latencies: { importMs: 1, firstGanttMs: 1, tabActivationMs: 1, resourcesPanelMs: 1, histogramMs: 1 },
  runtime: { crashed: false, pageErrors: 0, nativeDialogs: { alert: 0, confirm: 0, prompt: 0 } },
  privacy: { visibleLines: ['RESOURCES', 'Histogram'] },
};

const mutation = process.env.OPS_X11_PHASE2B_MUTATION;
if (mutation === 'recovery-count') recovery.initial.manifestDocumentCount = 11;
if (mutation === 'archive') recovery.restored.documents[0].sourceArchivePresent = false;
if (mutation === 'digest') recovery.restored.documents[0].archiveDigest = 'changed';
if (mutation === 'selector') recovery.restored.documents[0].selectorPresent = false;
if (mutation === 'active-document') recovery.restored.activeDocumentHash = order[0];
if (mutation === 'order') recovery.restored.documentOrder.reverse();
if (mutation === 'missing-document') recovery.restored.documents.pop();
if (mutation === 'beforeunload-99') recovery.recoveryUi.beforeUnloadDialogs = 99;
if (mutation === 'beforeunload-0') recovery.recoveryUi.beforeUnloadDialogs = 0;
if (mutation === 'dialog-alert') recovery.runtime.nativeDialogs.alert = 1;
if (mutation === 'dialog-confirm') recovery.runtime.nativeDialogs.confirm = 1;
if (mutation === 'dialog-prompt') recovery.runtime.nativeDialogs.prompt = 1;
if (mutation === 'large-tasks') large.counts.tasks -= 1;
if (mutation === 'large-assignments') large.counts.assignments -= 1;
if (mutation === 'large-calendars') large.counts.calendars -= 1;
if (mutation === 'large-resources') large.catalogs.resources -= 1;
if (mutation === 'large-source-rows') large.catalogs.sourceRows -= 1;
if (mutation === 'large-activity-catalogs') large.catalogs.activityCodeCatalogs -= 1;
if (mutation === 'large-udf-defs') large.catalogs.udfDefs -= 1;
if (mutation === 'wrong-gantt-canvas') large.gantt.primaryCanvasBound = false;
if (mutation === 'empty-gantt') {
  large.gantt.uniqueColorBuckets = 1;
  large.gantt.luminanceRange = 0;
  large.gantt.transitionCount = 0;
}
if (mutation === 'resources-route') large.routes.resourcesPanelVisible = false;
if (mutation === 'histogram-route') large.routes.histogramVisible = false;
if (mutation === 'privacy') large.privacy.visibleLines.push('Imported project Secret Alpha');

assertRecoveryEvidence(recovery);
assertLargeResourceEvidence(large);
assertPhase2BEvidencePrivacy({
  evidenceId: 'x11-123e4567-e89b-12d3-a456-426614174000',
  stdout: 'x11-123e4567-e89b-12d3-a456-426614174000',
  metadata: { git: { head: 'a'.repeat(40) }, privacyAudit: { pathlikeDetected: false } },
  serverSummary: { httpStatus: 200, cwdMatched: true },
  stateArtifact: { counts: { documents: 12 } },
});
console.log('OK x11-phase2b-contract: recovery-, grootbestand-, route- en privacycontracten gepind');
