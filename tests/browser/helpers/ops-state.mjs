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
