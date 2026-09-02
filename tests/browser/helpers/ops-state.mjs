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

export function assertMultiDocumentEvidence(evidence) {
  const failures = [];
  for (const [field, expected] of Object.entries(MULTI_DOCUMENT_EXPECTED_REPORT)) {
    if (evidence.report?.[field] !== expected) {
      failures.push(`report.${field}=${evidence.report?.[field]}, verwacht ${expected}`);
    }
  }
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
