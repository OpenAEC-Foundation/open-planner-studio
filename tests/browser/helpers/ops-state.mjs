const XER_OPENED_MESSAGE = 'notifications.xerImportOpened';

export async function readOpsState(page) {
  return page.evaluate((xerMessageKey) => {
    const bridge = window.__OPS__;
    if (!bridge) throw new Error('window.__OPS__ ontbreekt');
    const state = bridge.store.getState();
    const notifications = Object.values(state.ui.notifications.entries);
    const xerNotification = notifications.find((item) => item.messageKey === xerMessageKey);
    return {
      documents: state.documents.count,
      // De 4 WBS-samenvattingsrijen zijn afgeleide structuur; SMALL-A telt de 8 echte
      // geïmporteerde werk-/mijlpaaltaken die in de XER TASK-tabel staan.
      tasks: state.tasks.importedCount,
      relations: state.sequences.count,
      cpm: state.cpmResult,
      xerSourceArchive: state.xerSourceArchive.present,
      xerSourceProjectId: state.xerSourceProjectId,
      xerNotification: xerNotification ? {
        messageKey: xerNotification.messageKey,
        helpArticleId: xerNotification.helpArticleId ?? null,
      } : null,
      notifications: notifications.map((item) => ({
        severity: item.severity,
        messageKey: item.messageKey,
        helpArticleId: item.helpArticleId ?? null,
      })),
    };
  }, XER_OPENED_MESSAGE);
}

export async function readMultiDocumentOpsState(page) {
  return page.evaluate((xerMessageKey) => {
    const bridge = window.__OPS__;
    if (!bridge) throw new Error('window.__OPS__ ontbreekt');
    const state = bridge.store.getState();
    const notifications = Object.values(state.ui.notifications.entries);
    const notification = notifications.find((item) => item.messageKey === xerMessageKey);
    return {
      report: { ...state.xerImportReport },
      documentCount: state.documents.count,
      activeDocument: { ...state.activeDocument },
      ui: {
        activeRibbonTab: state.ui.activeRibbonTab,
        backstageSection: state.ui.backstageSection,
        pendingHelpArticleConsumed: state.ui.pendingHelpArticleConsumed,
      },
      notification: notification ? {
        messageKey: notification.messageKey,
        helpArticleId: notification.helpArticleId,
        count: notification.count,
        detailLines: Object.values(notification.detailLines).map((line) => ({ ...line })),
      } : null,
    };
  }, XER_OPENED_MESSAGE);
}

export async function readPhase2BDocumentState(page) {
  return page.evaluate(() => {
    const state = window.__OPS__?.store.getState();
    if (!state) throw new Error('window.__OPS__-snapshot ontbreekt');
    return {
      documentCount: state.documents.count,
      documentOrder: Object.values(state.documents.order),
      activeDocumentHash: state.documents.activeDocumentHash,
      activeDocument: { ...state.activeDocument },
      ui: {
        activeRibbonTab: state.ui.activeRibbonTab,
        showResourcePanel: state.ui.showResourcePanel,
        showHistogram: state.ui.showHistogram,
      },
    };
  });
}

export function assertSmallAState(snapshot) {
  const failures = [];
  if (snapshot.documents !== 1) failures.push(`documents=${snapshot.documents}, verwacht 1`);
  if (snapshot.tasks !== 8) failures.push(`tasks=${snapshot.tasks}, verwacht 8`);
  if (snapshot.relations !== 7) failures.push(`relations=${snapshot.relations}, verwacht 7`);
  if (!snapshot.cpm) failures.push('cpmResult ontbreekt');
  if (!snapshot.xerSourceArchive) failures.push('xerSourceArchive ontbreekt');
  if (!snapshot.xerSourceProjectId) failures.push('xerSourceProjectId is leeg');
  if (snapshot.xerNotification?.messageKey !== XER_OPENED_MESSAGE) {
    failures.push('XER-openmelding ontbreekt');
  }
  if (snapshot.xerNotification?.helpArticleId !== 'gids-xer-import') {
    failures.push('XER-openmelding mist helpArticleId gids-xer-import');
  }
  if (failures.length > 0) throw new Error(`SMALL-A store-assertie mislukt: ${failures.join('; ')}`);
}

export const XER_OPEN_MESSAGE_KEY = XER_OPENED_MESSAGE;

export const MULTI_DOCUMENT_EXPECTED_REPORT = Object.freeze({
  projectsSeen: 15,
  documentsOpened: 12,
  emptyProjectsSkipped: 3,
  baselineProjectsExcluded: 0,
  baselinesMaterialized: 0,
  danglingBaselineReferences: 9,
});

export const MULTI_DOCUMENT_EXPECTED_ENCODING = Object.freeze({
  messageKey: 'notifications.xerImportEncoding',
  value: 'windows-1252',
});

export const RECOVERY_EXPECTED_DOCUMENTS = 12;

// De taakpin wordt door de echte headed proef aan de actieve rijke projectprojectie gemeten.
// De zichtbare browserroute telt 6.977 niet-samenvattende werk-/mijlpaaltaken. De X11-planoracle
// van 6.976 betreft de bronactiviteiten vóór deze UI-projectie. De overige tellingen komen uit
// dezelfde actieve, rijke projectprojectie.
export const LARGE_RESOURCE_EXPECTED_COUNTS = Object.freeze({
  tasks: 6977,
  assignments: 52640,
  calendars: 124,
});

export const LARGE_RESOURCE_EXPECTED_CATALOGS = Object.freeze({
  resources: 179,
  sourceRows: 179,
  activityCodeCatalogs: 12,
  udfDefs: 3,
});

const RECOVERY_PRIVACY_LINES = Object.freeze([
  'Restore unsaved work',
  "Don't restore",
  'Restore',
]);

const LARGE_RESOURCE_PRIVACY_LINES = Object.freeze(['RESOURCES', 'Histogram']);

function assertExactPrivacyLines(observed, expected, label) {
  if (!Array.isArray(observed) || observed.length !== expected.length) {
    throw new Error(`${label}-privacyallowlist rood: regels=${JSON.stringify(observed)}`);
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (observed[index] !== expected[index]) {
      throw new Error(
        `${label}-privacyallowlist rood: regel ${index + 1}=${JSON.stringify(observed[index])}, ` +
          `verwacht ${JSON.stringify(expected[index])}`,
      );
    }
  }
}

function assertFiniteLatency(value, label, failures) {
  if (!Number.isFinite(value) || value < 0) failures.push(`${label} is niet eindig`);
}

const OPAQUE_EVIDENCE_ID = /^x11-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_FINGERPRINT = /^sha256-[0-9a-f]{64}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const GIT_OBJECT_ID = /^[0-9a-f]{40}$/;
const FNV1A_FINGERPRINT = /^fnv1a-[0-9a-f]{8}$/;

const exactString = (...allowed) => (value) => allowed.includes(value);
const matchesString = (pattern) => (value) => pattern.test(value);

// Positieve stringgrens: ieder evidencekanaal legt alle toegestane stringpaden en
// hun structurele waardeformaat vast. Een string op ieder ander pad is standaard rood.
export const PHASE2B_STRING_FIELD_ALLOWLIST = Object.freeze({
  metadata: Object.freeze([
    Object.freeze({ path: /^metadata\.runId$/, format: 'opaque-x11-uuid', validate: matchesString(OPAQUE_EVIDENCE_ID) }),
    Object.freeze({ path: /^metadata\.scenario$/, format: 'scenario-enum', validate: exactString('multidoc-recovery', 'large-resources') }),
    Object.freeze({ path: /^metadata\.git\.(?:worktreeFingerprint|branchFingerprint|statusFingerprint)$/, format: 'sha256-fingerprint', validate: matchesString(SHA256_FINGERPRINT) }),
    Object.freeze({ path: /^metadata\.git\.(?:head|base|commitParent)$/, format: 'git-object-id', validate: matchesString(GIT_OBJECT_ID) }),
    Object.freeze({ path: /^metadata\.server\.outputDigest$/, format: 'sha256-fingerprint', validate: matchesString(SHA256_FINGERPRINT) }),
    Object.freeze({ path: /^metadata\.devBridgeOpenGate\.wrapped\.\d+$/, format: 'fixed-bridge-wrapper', validate: exactString('devBridge.openFromPath') }),
    Object.freeze({ path: /^metadata\.devBridgeOpenGate\.storeFacade\.facadeFunctions\.\d+$/, format: 'fixed-facade-function', validate: exactString('devBridge.store.getState') }),
  ]),
  serverSummary: Object.freeze([
    Object.freeze({ path: /^serverSummary\.outputDigest$/, format: 'sha256-fingerprint', validate: matchesString(SHA256_FINGERPRINT) }),
  ]),
  stateArtifact: Object.freeze([
    Object.freeze({ path: /^stateArtifact\.abortedTransaction\.(?:beforeFingerprint|afterFingerprint)$/, format: 'fnv1a-fingerprint', validate: matchesString(FNV1A_FINGERPRINT) }),
    Object.freeze({ path: /^stateArtifact\.autosaveTrigger\.route$/, format: 'fixed-visible-route', validate: exactString('visible:Home>Task') }),
    Object.freeze({ path: /^stateArtifact\.initial\.(?:activeDocumentHash|manifestActiveDocumentHash)$/, format: 'fnv1a-fingerprint', validate: matchesString(FNV1A_FINGERPRINT) }),
    Object.freeze({ path: /^stateArtifact\.initial\.(?:documentOrder|manifestOrder)\.\d+$/, format: 'fnv1a-fingerprint', validate: matchesString(FNV1A_FINGERPRINT) }),
    Object.freeze({ path: /^stateArtifact\.initial\.documents\.\d+\.(?:documentHash|projectIdentityHash|selectorHash|ifcDigest)$/, format: 'fnv1a-fingerprint', validate: matchesString(FNV1A_FINGERPRINT) }),
    Object.freeze({ path: /^stateArtifact\.initial\.documents\.\d+\.archiveDigest$/, format: 'sha256-hex', validate: matchesString(SHA256_HEX) }),
    Object.freeze({ path: /^stateArtifact\.restored\.activeDocumentHash$/, format: 'fnv1a-fingerprint', validate: matchesString(FNV1A_FINGERPRINT) }),
    Object.freeze({ path: /^stateArtifact\.restored\.documentOrder\.\d+$/, format: 'fnv1a-fingerprint', validate: matchesString(FNV1A_FINGERPRINT) }),
    Object.freeze({ path: /^stateArtifact\.restored\.documents\.\d+\.(?:documentHash|projectIdentityHash|selectorHash)$/, format: 'fnv1a-fingerprint', validate: matchesString(FNV1A_FINGERPRINT) }),
    Object.freeze({ path: /^stateArtifact\.restored\.documents\.\d+\.archiveDigest$/, format: 'sha256-hex', validate: matchesString(SHA256_HEX) }),
    Object.freeze({ path: /^stateArtifact\.sourceArchiveDigest$/, format: 'sha256-hex', validate: matchesString(SHA256_HEX) }),
    Object.freeze({ path: /^stateArtifact\.gantt\.rootAnchor$/, format: 'fixed-gantt-anchor', validate: exactString('gantt-vscroll') }),
    Object.freeze({ path: /^stateArtifact\.privacy\.visibleLines\.0$/, format: 'fixed-ui-term', validate: exactString('Restore unsaved work', 'RESOURCES') }),
    Object.freeze({ path: /^stateArtifact\.privacy\.visibleLines\.1$/, format: 'fixed-ui-term', validate: exactString("Don't restore", 'Histogram') }),
    Object.freeze({ path: /^stateArtifact\.privacy\.visibleLines\.2$/, format: 'fixed-ui-term', validate: exactString('Restore') }),
  ]),
});

const PATHLIKE_PATTERNS = [
  { label: 'slash', pattern: /[\\/]/ },
  { label: 'url', pattern: /\b[a-z][a-z0-9+.-]*:\/\//i },
  { label: 'drive', pattern: /\b[A-Za-z]:[\\/]/ },
  { label: 'source-file', pattern: /\.(?:xer|ifc|mpp|xml|csv)\b/i },
  { label: 'corpus-name', pattern: /\b(?:crawl-xer|rehab-2|p6diff-baseline)\b/i },
];

function inspectAllowedStringFields(value, channel, violations, seen) {
  if (typeof value === 'string') {
    const rule = PHASE2B_STRING_FIELD_ALLOWLIST[channel.split('.')[0]]?.find(({ path }) => path.test(channel));
    if (!rule) {
      violations.push(`${channel}:unknown-string-field`);
    } else if (!rule.validate(value)) {
      violations.push(`${channel}:invalid-${rule.format}`);
    }
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const [key, member] of Object.entries(value)) {
    inspectAllowedStringFields(member, `${channel}.${key}`, violations, seen);
  }
}

function inspectPathlikeStrings(value, channel, violations, seen) {
  if (typeof value === 'string') {
    for (const { label, pattern } of PATHLIKE_PATTERNS) {
      if (pattern.test(value)) violations.push(`${channel}:${label}`);
    }
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const [key, member] of Object.entries(value)) {
    inspectPathlikeStrings(member, `${channel}.${key}`, violations, seen);
  }
}

/** Gesloten fase-2B-privacygrens voor alle tekstuele evidencekanalen. */
export function assertPhase2BEvidencePrivacy(envelope) {
  const shapeViolations = [];
  const denylistViolations = [];
  if (!OPAQUE_EVIDENCE_ID.test(envelope?.evidenceId ?? '')) shapeViolations.push('evidenceId:not-opaque');
  if (envelope?.stdout !== envelope?.evidenceId || !OPAQUE_EVIDENCE_ID.test(envelope?.stdout ?? '')) {
    shapeViolations.push('stdout:not-opaque-id-only');
  }
  for (const channel of ['metadata', 'serverSummary', 'stateArtifact']) {
    if (!envelope?.[channel] || typeof envelope[channel] !== 'object' || Array.isArray(envelope[channel])) {
      shapeViolations.push(`${channel}:object-required`);
      continue;
    }
    inspectAllowedStringFields(envelope[channel], channel, shapeViolations, new WeakSet());
    inspectPathlikeStrings(envelope[channel], channel, denylistViolations, new WeakSet());
  }
  inspectPathlikeStrings(envelope?.stdout, 'stdout', denylistViolations, new WeakSet());
  if (shapeViolations.length > 0 || denylistViolations.length > 0) {
    const details = [
      ...[...new Set(shapeViolations)].map((violation) => `shape:${violation}`),
      ...[...new Set(denylistViolations)].map((violation) => `denylist:${violation}`),
    ];
    throw new Error(`X11 fase-2B-privacycontract rood: ${details.join('; ')}`);
  }
  return Object.freeze({
    stdoutOpaqueIdOnly: true,
    stringSchemaSafe: true,
    denylistSafe: true,
    pathlikeDetected: false,
    metadataSafe: true,
    serverArtifactSafe: true,
    stateArtifactSafe: true,
  });
}

export function assertRecoveryEvidence(evidence) {
  const failures = [];
  const initial = evidence?.initial ?? {};
  const restored = evidence?.restored ?? {};
  if (initial.documentCount !== RECOVERY_EXPECTED_DOCUMENTS) failures.push(`initial.documentCount=${initial.documentCount}`);
  if (initial.manifestDocumentCount !== RECOVERY_EXPECTED_DOCUMENTS) failures.push(`manifestDocumentCount=${initial.manifestDocumentCount}`);
  if (restored.documentCount !== RECOVERY_EXPECTED_DOCUMENTS) failures.push(`restored.documentCount=${restored.documentCount}`);

  const initialDocuments = Array.isArray(initial.documents) ? initial.documents : [];
  const restoredDocuments = Array.isArray(restored.documents) ? restored.documents : [];
  if (initialDocuments.length !== RECOVERY_EXPECTED_DOCUMENTS) failures.push(`initial.documents=${initialDocuments.length}`);
  if (restoredDocuments.length !== RECOVERY_EXPECTED_DOCUMENTS) failures.push(`restored.documents=${restoredDocuments.length}`);

  if (JSON.stringify(initial.documentOrder) !== JSON.stringify(initial.manifestOrder)) {
    failures.push('manifestvolgorde wijkt af van documentvolgorde');
  }
  if (JSON.stringify(restored.documentOrder) !== JSON.stringify(initial.documentOrder)) {
    failures.push('herstelde documentvolgorde wijkt af');
  }
  if (initial.activeDocumentHash !== initial.manifestActiveDocumentHash) failures.push('manifest activeDocumentId wijkt af');
  if (restored.activeDocumentHash !== initial.activeDocumentHash) failures.push('verkeerd hersteld actief document');

  const documentHashes = new Set();
  const projectHashes = new Set();
  for (let index = 0; index < RECOVERY_EXPECTED_DOCUMENTS; index += 1) {
    const before = initialDocuments[index];
    const after = restoredDocuments[index];
    const ordinal = index + 1;
    if (!before || !after) continue;
    if (before.ordinal !== ordinal || after.ordinal !== ordinal) failures.push(`document ${ordinal}: ordinal wijkt af`);
    if (!before.documentHash || documentHashes.has(before.documentHash)) failures.push(`document ${ordinal}: documenthash ontbreekt/dubbel`);
    documentHashes.add(before.documentHash);
    if (!before.projectIdentityHash || projectHashes.has(before.projectIdentityHash)) failures.push(`document ${ordinal}: projectidentiteit ontbreekt/dubbel`);
    projectHashes.add(before.projectIdentityHash);
    if (after.documentHash !== before.documentHash) failures.push(`document ${ordinal}: identiteit niet behouden`);
    if (after.projectIdentityHash !== before.projectIdentityHash) failures.push(`document ${ordinal}: project-id niet behouden`);
    if (!before.sourceArchivePresent || !after.sourceArchivePresent) failures.push(`document ${ordinal}: bronarchief ontbreekt`);
    if (!before.archiveDigest || after.archiveDigest !== before.archiveDigest) failures.push(`document ${ordinal}: archivedigest niet behouden`);
    if (!Number.isInteger(before.archiveByteLength) || before.archiveByteLength <= 0 || after.archiveByteLength !== before.archiveByteLength) {
      failures.push(`document ${ordinal}: archieflengte niet behouden`);
    }
    if (!before.selectorPresent || !after.selectorPresent || !before.selectorHash || after.selectorHash !== before.selectorHash) {
      failures.push(`document ${ordinal}: selector niet behouden`);
    }
    if (!before.ifcDigest || !Number.isInteger(before.ifcByteLength) || before.ifcByteLength <= 0) {
      failures.push(`document ${ordinal}: IFC-recoverysnapshot ontbreekt`);
    }
    if (!Number.isInteger(after.taskCount) || after.taskCount <= 0) failures.push(`document ${ordinal}: hersteld document is leeg`);
    if (!after.cpmExecutable) failures.push(`document ${ordinal}: CPM niet uitvoerbaar`);
    if (!after.cpmExecutedViaF5) failures.push(`document ${ordinal}: zichtbare F5-CPM-route niet uitgevoerd`);
  }

  const throttle = evidence?.throttle ?? {};
  if (evidence?.autosaveTrigger?.route !== 'visible:Home>Task' || evidence?.autosaveTrigger?.taskDelta !== 1) {
    failures.push('zichtbare autosavetrigger ontbreekt');
  }
  assertFiniteLatency(throttle.intervalMs, 'throttle.intervalMs', failures);
  if (!throttle.manifestUnchangedBeforeDue) failures.push('manifest wijzigde vóór throttletermijn');
  if (throttle.secondAddedAt - throttle.firstAddedAt < 9_500) failures.push('10s-throttle niet bewezen');
  const aborted = evidence?.abortedTransaction ?? {};
  if (!aborted.transactionAborted) failures.push('IndexedDB-transactie is niet werkelijk afgebroken');
  if (!aborted.beforeFingerprint || aborted.afterFingerprint !== aborted.beforeFingerprint) {
    failures.push('vorige consistente recoveryset veranderde na abort');
  }
  if (!evidence?.recoveryUi?.visible || evidence.recoveryUi.entryCount !== RECOVERY_EXPECTED_DOCUMENTS ||
      !evidence.recoveryUi.restoredViaVisibleButton) {
    failures.push('normale zichtbare recoveryroute niet bewezen');
  }
  if (evidence?.recoveryUi?.beforeUnloadDialogs !== 1) {
    failures.push(`beforeUnloadDialogs=${evidence?.recoveryUi?.beforeUnloadDialogs}, verwacht exact 1`);
  }
  const recoveryDialogs = evidence?.runtime?.nativeDialogs ?? {};
  if (recoveryDialogs.alert !== 0) failures.push(`alert=${recoveryDialogs.alert}, verwacht 0`);
  if (recoveryDialogs.confirm !== 0) failures.push(`confirm=${recoveryDialogs.confirm}, verwacht 0`);
  if (recoveryDialogs.prompt !== 0) failures.push(`prompt=${recoveryDialogs.prompt}, verwacht 0`);
  assertExactPrivacyLines(evidence?.privacy?.visibleLines, RECOVERY_PRIVACY_LINES, 'recovery');
  if (failures.length > 0) throw new Error(`X11 recoverycontract rood: ${failures.join('; ')}`);
}

export function assertLargeResourceEvidence(evidence) {
  const failures = [];
  for (const [field, expected] of Object.entries(LARGE_RESOURCE_EXPECTED_COUNTS)) {
    if (evidence?.counts?.[field] !== expected) failures.push(`counts.${field}=${evidence?.counts?.[field]}, verwacht ${expected}`);
  }
  if (!evidence?.sourceArchivePresent || !evidence.sourceArchiveDigest) failures.push('bronarchief/digest ontbreekt');
  if (!evidence?.selectorPresent) failures.push('projectselector ontbreekt');
  if (!evidence?.cpmPresent) failures.push('CPM ontbreekt');
  for (const [field, expected] of Object.entries(LARGE_RESOURCE_EXPECTED_CATALOGS)) {
    if (evidence?.catalogs?.[field] !== expected) failures.push(`catalogs.${field}=${evidence?.catalogs?.[field]}, verwacht ${expected}`);
  }
  const gantt = evidence?.gantt ?? {};
  if (gantt.rootAnchor !== 'gantt-vscroll') failures.push('Gantt-root is niet specifiek aan gantt-vscroll gebonden');
  if (!gantt.primaryCanvasBound) failures.push('verkeerde canvas: primaire Gantt-canvas niet bewezen');
  if (!Number.isInteger(gantt.width) || gantt.width <= 300 || !Number.isInteger(gantt.height) || gantt.height <= 150) {
    failures.push('primaire Gantt-canvas heeft ongeldige afmetingen');
  }
  if (!Number.isInteger(gantt.sampleCount) || gantt.sampleCount < 1024) failures.push('Gantt-sample is te klein');
  if (!Number.isInteger(gantt.nonTransparentSamples) || gantt.nonTransparentSamples < gantt.sampleCount * 0.9) {
    failures.push('Gantt-render bevat te weinig niet-transparante samples');
  }
  if (!Number.isInteger(gantt.uniqueColorBuckets) || gantt.uniqueColorBuckets < 4 ||
      !Number.isFinite(gantt.luminanceRange) || gantt.luminanceRange < 8 ||
      !Number.isInteger(gantt.transitionCount) || gantt.transitionCount < 10) {
    failures.push('lege Gantt: onvoldoende geaggregeerde pixelvariatie');
  }
  for (const field of ['firstGanttRendered', 'resourcesPanelVisible', 'histogramVisible']) {
    if (!evidence?.routes?.[field]) failures.push(`route.${field} ontbreekt`);
  }
  for (const field of ['importMs', 'firstGanttMs', 'tabActivationMs', 'resourcesPanelMs', 'histogramMs']) {
    assertFiniteLatency(evidence?.latencies?.[field], `latencies.${field}`, failures);
  }
  if (evidence?.runtime?.crashed) failures.push('Chromium-page crashte');
  if (evidence?.runtime?.pageErrors !== 0) failures.push(`pageErrors=${evidence?.runtime?.pageErrors}`);
  const dialogs = evidence?.runtime?.nativeDialogs ?? {};
  if (dialogs.alert !== 0 || dialogs.confirm !== 0 || dialogs.prompt !== 0) failures.push(`native dialogs=${JSON.stringify(dialogs)}`);
  assertExactPrivacyLines(evidence?.privacy?.visibleLines, LARGE_RESOURCE_PRIVACY_LINES, 'grootbestand');
  if (failures.length > 0) throw new Error(`X11 grootbestandcontract rood: ${failures.join('; ')}`);
}

export const MULTI_DOCUMENT_EXPECTED_TOAST_LINES = Object.freeze([
  'XER file opened: 12 project documents.',
  '15 projects found.',
  '3 empty projects skipped.',
  '9 dangling baseline references ignored.',
  'Text encoding selected: windows-1252.',
  'Read more',
]);

const EXPECTED_SWITCH_ROUTES = new Map([
  [1, 'shortcut:Control+1'],
  [5, 'shortcut:Control+5'],
  [9, 'shortcut:Control+9'],
  [10, 'click'],
  [11, 'keyboard:ArrowRight'],
  [12, 'keyboard:ArrowRight'],
]);

function finiteLatency(value) {
  return Number.isFinite(value) && value >= 0;
}

export function normalizeVisibleToastLines(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/[^\S\r\n]+/g, ' ').trim())
    .filter(Boolean);
}

export function assertMultiDocumentToastLines(lines) {
  const observed = Array.isArray(lines) ? lines : [];
  const expected = MULTI_DOCUMENT_EXPECTED_TOAST_LINES;
  if (observed.length !== expected.length) {
    const extras = observed.filter((line) => !expected.includes(line));
    throw new Error(
      `X11 multi-documenttoast-allowlist rood: regels=${observed.length}, verwacht ${expected.length}` +
        `${extras.length > 0 ? `; extra=${JSON.stringify(extras)}` : ''}`,
    );
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (observed[index] !== expected[index]) {
      throw new Error(
        `X11 multi-documenttoast-allowlist rood: regel ${index + 1}=${JSON.stringify(observed[index])}, ` +
          `verwacht ${JSON.stringify(expected[index])}`,
      );
    }
  }
}

export function assertMultiDocumentEvidence(evidence) {
  const failures = [];
  for (const [field, expected] of Object.entries(MULTI_DOCUMENT_EXPECTED_REPORT)) {
    if (evidence.report?.[field] !== expected) {
      failures.push(`report.${field}=${evidence.report?.[field]}, verwacht ${expected}`);
    }
  }
  if (evidence.encoding?.messageKey !== MULTI_DOCUMENT_EXPECTED_ENCODING.messageKey) {
    failures.push(`encoding-messageKey=${evidence.encoding?.messageKey ?? 'ontbreekt'}, verwacht ${MULTI_DOCUMENT_EXPECTED_ENCODING.messageKey}`);
  }
  if (evidence.encoding?.value !== MULTI_DOCUMENT_EXPECTED_ENCODING.value) {
    failures.push(`encoding=${evidence.encoding?.value ?? 'ontbreekt'}, verwacht ${MULTI_DOCUMENT_EXPECTED_ENCODING.value}`);
  }
  assertMultiDocumentToastLines(evidence.toastLines);
  if (!finiteLatency(evidence.openLatencyMs)) failures.push('openLatencyMs is niet eindig');

  const documents = Array.isArray(evidence.documents) ? evidence.documents : [];
  if (documents.length !== 12) failures.push(`documents=${documents.length}, verwacht 12`);
  const documentHashes = new Set();
  const projectHashes = new Set();
  for (let index = 0; index < documents.length; index += 1) {
    const document = documents[index];
    const expectedOrdinal = index + 1;
    if (document.ordinal !== expectedOrdinal) failures.push(`documentordinal=${document.ordinal}, verwacht ${expectedOrdinal}`);
    if (!document.documentHash) failures.push(`document ${expectedOrdinal}: documenthash ontbreekt`);
    if (documentHashes.has(document.documentHash)) failures.push(`document ${expectedOrdinal}: dubbele documenthash`);
    documentHashes.add(document.documentHash);
    if (!document.projectIdentityHash) failures.push(`document ${expectedOrdinal}: project-id-hash ontbreekt`);
    if (projectHashes.has(document.projectIdentityHash)) failures.push(`document ${expectedOrdinal}: dubbel project-id`);
    projectHashes.add(document.projectIdentityHash);
    if (!Number.isInteger(document.taskCount) || document.taskCount <= 0) failures.push(`document ${expectedOrdinal}: leeg document`);
    if (!document.sourceArchivePresent) failures.push(`document ${expectedOrdinal}: bronarchief ontbreekt`);
    if (!document.cpmPresent) failures.push(`document ${expectedOrdinal}: CPM ontbreekt`);
  }

  const switches = Array.isArray(evidence.switches) ? evidence.switches : [];
  if (switches.length !== 12) failures.push(`switches=${switches.length}, verwacht 12`);
  for (let index = 0; index < switches.length; index += 1) {
    const item = switches[index];
    const ordinal = index + 1;
    const expectedRoute = EXPECTED_SWITCH_ROUTES.get(ordinal) ?? 'click';
    if (item.requestedOrdinal !== ordinal) failures.push(`switch ${ordinal}: requestedOrdinal=${item.requestedOrdinal}`);
    if (item.observedOrdinal !== ordinal) failures.push(`switch ${ordinal}: schakelde naar ${item.observedOrdinal}`);
    if (item.route !== expectedRoute) failures.push(`switch ${ordinal}: route=${item.route}, verwacht ${expectedRoute}`);
    if (!item.outsideInput) failures.push(`switch ${ordinal}: focus stond in invoerveld`);
    if (!item.tabVisible) failures.push(`switch ${ordinal}: actieve tab niet zichtbaar`);
    if (!item.tabpanelCorrelated) failures.push(`switch ${ordinal}: tabpanel niet gecorreleerd`);
    if (!item.activeDocumentHashCorrelated) failures.push(`switch ${ordinal}: actief document niet gecorreleerd`);
    if (!finiteLatency(item.latencyMs)) failures.push(`switch ${ordinal}: latency is niet eindig`);
  }

  const help = evidence.help ?? {};
  if (help.notificationHelpArticleId !== 'gids-xer-import') failures.push('verkeerde Help-artikelroute');
  if (help.activeTocTitle !== 'Opening Primavera P6 (.xer)') failures.push('verkeerde actieve Help-titel');
  if (help.articleHeading !== 'Opening Primavera P6 (.xer)') failures.push('verkeerde Help-artikelkop');
  if (help.activeRibbonTab !== 'file' || help.backstageSection !== 'help') failures.push('Backstage Help-route niet actief');
  if (!help.pendingHelpArticleConsumed) failures.push('Help-routeverzoek niet geconsumeerd');
  if (!help.hasMultiDocumentExplanation) failures.push('multi-documentuitleg ontbreekt');
  if (!help.hasEmptyProjectExplanation) failures.push('lege-projectuitleg ontbreekt');
  if (!help.hasBaselineExplanation) failures.push('baseline-uitleg ontbreekt');

  if (failures.length > 0) throw new Error(`X11 multi-documentcontract rood: ${failures.join('; ')}`);
}
