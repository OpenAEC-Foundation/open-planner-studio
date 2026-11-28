import i18next from 'i18next';
import nlCommon from '@/i18n/locales/nl/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import { createAppStore, useAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { normalizeLoadedLibrary, persistLibrary } from '@/state/slices/librarySlice';
import { computeCalendarHash, computeResourceHash, diffCalendarVsPool, isResourceFieldLocked, resolveUniqueCompanyName } from '@/services/library/libraryOps';
import { PoolImportDialog } from '@/components/dialogs/PoolImportDialog';
import { DEFAULT_COMPANY_ID, createDefaultLibrary } from '@/types/library';
import { DEMO_COMPANY_ID } from '@/services/library/demoLibrary';
import { createSnapshot } from '@/state/snapshot';
import { capturePayload, hydratePayload } from '@/state/documentContract';
import { materializeLibraryBoundary } from '@/state/documentActivation';
import { readIFC } from '@/services/ifc/ifcReader';
import { createRecognitionFixture, installRecognitionFixture, legacyRecognition } from './recognition-fixture';

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

{
  await i18next.init({
    lng: 'nl', fallbackLng: 'en', ns: ['common'], defaultNS: 'common',
    resources: { nl: { common: nlCommon }, en: { common: enCommon } },
    interpolation: { escapeValue: false },
    initImmediate: false,
  });
  for (const [lng, defaultName, newName] of [
    ['nl', 'Mijn resourcebibliotheek', 'Nieuwe resourcebibliotheek'],
    ['en', 'My resource library', 'New resource library'],
  ]) {
    await i18next.changeLanguage(lng);
    const isolated = createAppStore();
    const S = () => isolated.getState();
    assert(S().companies[0].name === defaultName, `${lng}: verse store gebruikt de vertaalde standaardnaam`);
    assert(S().pools[DEFAULT_COMPANY_ID].companyName === defaultName, `${lng}: verse pool gebruikt dezelfde standaardnaam`);

    await S().initLibrary();
    assert(S().libraryLoaded, `${lng}: initLibrary voltooit de echte laadroute`);
    assert(S().companies[0].name === defaultName, `${lng}: initLibrary behoudt de vertaalde standaardnaam`);
    assert(S().defaultCompanyId === DEFAULT_COMPANY_ID && S().pools[DEFAULT_COMPANY_ID].companyName === defaultName,
      `${lng}: initialisatie behoudt de vaste identiteit en overeenkomende poolnaam`);
    assert(normalizeLoadedLibrary({}).companies[0].name === defaultName, `${lng}: lege opgeslagen data krijgt dezelfde standaardnaam`);

    const addedId = S().addCompany('   ');
    assert(S().companies.find(c => c.id === addedId)?.name === newName, `${lng}: lege nieuwe naam krijgt het vertaalde label`);
    assert(S().pools[addedId].companyName === newName, `${lng}: nieuwe pool neemt het vertaalde label over`);
    assert(resolveUniqueCompanyName('   ', []) === newName, `${lng}: lege importnaam gebruikt hetzelfde vertaalde label`);
    assert(resolveUniqueCompanyName('\u200B', [newName]) === `${newName} (2)`, `${lng}: onzichtbare importnaam behoudt de botsingsafhandeling`);
    assert(resolveUniqueCompanyName(' Eigen naam ', []) === 'Eigen naam', `${lng}: opgegeven importnaam blijft behouden`);

    await i18next.changeLanguage(lng === 'nl' ? 'en' : 'nl');
    assert(S().companies[0].name === defaultName && S().pools[DEFAULT_COMPANY_ID].companyName === defaultName,
      `${lng}: taalwissel hernoemt de aangemaakte standaardbibliotheek niet`);
    S().renameCompany(DEFAULT_COMPANY_ID, 'Projectbureau Één');
    const reloaded = normalizeLoadedLibrary({
      companies: S().companies, defaultCompanyId: S().defaultCompanyId, pools: S().pools,
    });
    assert(reloaded.companies[0].name === 'Projectbureau Één' && reloaded.pools[DEFAULT_COMPANY_ID].companyName === 'Projectbureau Één',
      `${lng}: laden behoudt de opgeslagen gebruikersnaam, ook bij het standaard-id`);
  }

  await i18next.changeLanguage('nl');
  const legacy = createDefaultLibrary();
  await i18next.changeLanguage('en');
  const preserved = normalizeLoadedLibrary(legacy);
  assert(preserved.companies[0].name === 'Mijn resourcebibliotheek'
    && preserved.pools[DEFAULT_COMPANY_ID].companyName === 'Mijn resourcebibliotheek',
    'en: bestaande Nederlandse standaardnaam wordt niet gemigreerd');

  const bootstrapped = createAppStore();
  await i18next.changeLanguage('nl');
  await bootstrapped.getState().initLibrary();
  assert(bootstrapped.getState().companies[0].name === 'Mijn resourcebibliotheek',
    'initLibrary gebruikt de inmiddels gekozen UI-taal, niet de taal bij store-aanmaak');
  await i18next.changeLanguage('en');
}

{
  const library = createDefaultLibrary();
  let notification: { severity: string; messageKey: string; detail?: string; dedupeKey?: string } | undefined;
  await persistLibrary(
    () => ({
      ...library,
      libraryLoaded: true,
      notify: (input) => { notification = input; },
    }),
    async () => { throw new Error('schijf niet beschrijfbaar'); },
  );
  assert(notification?.severity === 'error', 'issue #76: mislukte bibliotheekopslag meldt een fout aan de gebruiker');
  assert(notification?.messageKey === 'notifications.librarySaveFailed', 'issue #76: bibliotheekfout noemt expliciet dat de bibliotheek niet is opgeslagen');
  assert(notification?.detail === 'schijf niet beschrijfbaar', 'issue #76: bibliotheekfout toont de technische oorzaak');
  assert(notification?.dedupeKey === 'library-save', 'issue #76: herhaalde bibliotheekfouten worden samengevouwen');
}

const store = useAppStore.getState();

function seedRedoEvent(): void {
  const state = useAppStore.getState();
  const snapshot = createSnapshot(state);
  state.recordSessionHistoryEvent('redo-fixture', [{
    kind: 'document-data', documentId: state.activeDocumentId, before: snapshot, after: snapshot,
  }]);
  useAppStore.getState().undo();
}

function commitOpenBoundaryForTest(): { refreshed: number; deviated: number; removed: number } {
  const state = useAppStore.getState();
  const activation = materializeLibraryBoundary({
    payload: capturePayload(state),
    companies: state.companies,
    pools: state.pools,
    mode: 'open-boundary',
  });
  useAppStore.setState(draft => {
    hydratePayload(draft, activation.payload);
    draft.viewRows = [...activation.viewRows];
    draft.resourceLoadResult = activation.resourceLoadResult;
    draft.ui.showLibraryLinkDialog = activation.signals.showLibraryLinkDialog;
    draft.ui.libraryRefreshNotice = activation.signals.libraryRefreshNotice;
  });
  const { refreshed, deviated, removed } = activation.signals;
  return { refreshed, deviated, removed };
}

{
  assert(store.companies.length === 1, 'start: één standaardbedrijf');
  assert(store.defaultCompanyId === store.companies[0].id, 'start: default = standaardbedrijf');

  const id2 = store.addCompany('Onderaannemer BV');
  assert(useAppStore.getState().companies.length === 2, 'addCompany voegt bedrijf toe');
  assert(!!useAppStore.getState().pools[id2], 'addCompany maakt een lege pool');

  store.setDefaultCompany(id2);
  assert(useAppStore.getState().defaultCompanyId === id2, 'setDefaultCompany');

  store.renameCompany(id2, 'Onderaannemer 2 BV');
  assert(useAppStore.getState().companies.find(c => c.id === id2)?.name === 'Onderaannemer 2 BV', 'renameCompany');
  assert(useAppStore.getState().pools[id2].companyName === 'Onderaannemer 2 BV', 'renameCompany synct pool.companyName');

  store.removeCompany(id2);
  assert(useAppStore.getState().companies.length === 1, 'removeCompany');
  assert(useAppStore.getState().defaultCompanyId === useAppStore.getState().companies[0].id, 'removeCompany: default valt terug');

  const lastId = useAppStore.getState().companies[0].id;
  store.removeCompany(lastId);
  assert(useAppStore.getState().companies.length === 1, 'removeCompany: laatste bedrijf blijft');
}

{
  const s = useAppStore.getState();
  const cid = s.defaultCompanyId;
  const v0 = s.pools[cid].poolVersion;

  const calId = s.promoteCalendarToPool(cid, {
    id: 'proj-cal', name: 'Ploeg A', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  })!;
  let pool = useAppStore.getState().pools[cid];
  assert(pool.calendars.some(c => c.id === calId), 'promoteCalendarToPool voegt kalender toe');
  assert(pool.calendars.find(c => c.id === calId)?.libraryOrigin === undefined, 'gepromoveerde kalender heeft geen herkomst (is zelf origineel)');
  assert(pool.poolVersion === v0 + 1, 'promoteCalendarToPool bumpt de pool');

  assert(s.promoteCalendarToPool('ghost-company', {
    id: 'x', name: 'x', description: '', workDays: [1], workStartHour: 8, workEndHour: 16,
    hoursPerDay: 8, holidays: [],
  }) === null, 'promoteCalendarToPool: null bij onbestaand bedrijf');
  assert(s.promoteResourceToPool('ghost-company', { id: 'x', name: 'x', type: 'LABOR', description: '', maxUnits: 1 }) === null, 'promoteResourceToPool: null bij onbestaand bedrijf');

  const resId = s.promoteResourceToPool(cid, {
    id: 'proj-res', name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 3, calendarId: 'proj-cal',
  })!;
  pool = useAppStore.getState().pools[cid];
  assert(pool.resources.find(r => r.id === resId)?.calendarId === undefined, 'gepromoveerde resource verliest project-lokale calendarId');
  assert(pool.poolVersion === v0 + 2, 'promoteResourceToPool bumpt opnieuw');

  s.updatePoolResource(cid, resId, { maxUnits: 5 });
  pool = useAppStore.getState().pools[cid];
  assert(pool.resources.find(r => r.id === resId)?.maxUnits === 5, 'updatePoolResource');
  assert(pool.poolVersion === v0 + 3, 'updatePoolResource bumpt');

  s.removePoolResource(cid, resId);
  s.removePoolCalendar(cid, calId);
  pool = useAppStore.getState().pools[cid];
  assert(!pool.resources.some(r => r.id === resId) && !pool.calendars.some(c => c.id === calId), 'removePool* verwijdert items');
  assert(pool.poolVersion === v0 + 5, 'removePool* bumpt tweemaal');
}

{
  const cid = useAppStore.getState().defaultCompanyId;
  const pcId = useAppStore.getState().addCalendar({
    name: 'Bron-kalender', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  });
  const pcCal = useAppStore.getState().calendars.find(c => c.id === pcId)!;
  const newCalItemId = useAppStore.getState().promoteCalendarToPool(cid, pcCal)!;
  const poolVer = useAppStore.getState().pools[cid].poolVersion;
  const stampedCal = useAppStore.getState().calendars.find(c => c.id === pcId)!;
  assert(!!stampedCal.libraryOrigin, 'promoteCalendarToPool: bron-projectkalender krijgt herkomststempel');
  assert(stampedCal.libraryOrigin?.companyId === cid && stampedCal.libraryOrigin?.libraryItemId === newCalItemId, 'promoteCalendarToPool: stempel wijst naar de nieuwe pool-item-id');
  assert(stampedCal.libraryOrigin?.poolVersion === poolVer, 'promoteCalendarToPool: stempel draagt de gebumpte poolVersion (geen off-by-one)');
  const poolCalAfterPromote = useAppStore.getState().pools[cid].calendars.find(c => c.id === newCalItemId)!;
  assert(stampedCal.libraryOrigin?.syncedHash === computeCalendarHash(poolCalAfterPromote), 'promoteCalendarToPool: back-stamp syncedHash == hash van het poolitem');

  const prId = useAppStore.getState().addResource({ name: 'Bron-resource', type: 'LABOR', description: '', maxUnits: 2 });
  const prRes = useAppStore.getState().resources.find(r => r.id === prId)!;
  const newResItemId = useAppStore.getState().promoteResourceToPool(cid, prRes)!;
  const poolVer2 = useAppStore.getState().pools[cid].poolVersion;
  const stampedRes = useAppStore.getState().resources.find(r => r.id === prId)!;
  assert(!!stampedRes.libraryOrigin, 'promoteResourceToPool: bron-projectresource krijgt herkomststempel');
  assert(stampedRes.libraryOrigin?.libraryItemId === newResItemId && stampedRes.libraryOrigin?.poolVersion === poolVer2, 'promoteResourceToPool: stempel draagt de nieuwe id + gebumpte poolVersion');
  const poolResAfterPromote = useAppStore.getState().pools[cid].resources.find(r => r.id === newResItemId)!;
  assert(stampedRes.libraryOrigin?.syncedHash === computeResourceHash(poolResAfterPromote), 'promoteResourceToPool: back-stamp syncedHash == hash van het poolitem');

  const dcId = useAppStore.getState().addCalendar({
    name: 'Default-kalender', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  });
  useAppStore.getState().setProjectCalendar(dcId);
  assert(useAppStore.getState().calendar.id === dcId, 'setup: s.calendar is de projectdefault');
  const dcCal = useAppStore.getState().calendars.find(c => c.id === dcId)!;
  const newDefItemId = useAppStore.getState().promoteCalendarToPool(cid, dcCal)!;
  const poolVerDef = useAppStore.getState().pools[cid].poolVersion;
  const cache = useAppStore.getState().calendar;
  assert(!!cache.libraryOrigin, 'promoteCalendarToPool: gedenormaliseerde s.calendar-cache krijgt de stempel (projectdefault-pad)');
  assert(cache.libraryOrigin?.libraryItemId === newDefItemId && cache.libraryOrigin?.poolVersion === poolVerDef, 'promoteCalendarToPool: s.calendar-stempel draagt nieuwe id + gebumpte poolVersion');
}

{
  useAppStore.getState().newProject();
  const cid = useAppStore.getState().defaultCompanyId;
  const cId = useAppStore.getState().addCalendar({
    name: 'B4-C', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  });
  const cCal = useAppStore.getState().calendars.find(c => c.id === cId)!;
  const poolItemId = useAppStore.getState().promoteCalendarToPool(cid, cCal)!;
  assert(!!useAppStore.getState().calendars.find(c => c.id === cId)?.libraryOrigin, 'B4 scenario 1 setup: stempel aanwezig vóór undo');
  assert(useAppStore.getState().pools[cid].calendars.some(c => c.id === poolItemId), 'B4 scenario 1 setup: poolkopie aanwezig vóór undo');

  useAppStore.getState().undo();
  const s1 = useAppStore.getState();
  assert(!s1.calendars.find(c => c.id === cId)?.libraryOrigin, 'B4 scenario 1: undo van de promote-actie zelf verwijdert de stempel');
  assert(s1.pools[cid].calendars.some(c => c.id === poolItemId), 'B4 scenario 1: de poolkopie blijft staan (pool is app-globaal, niet undo-beschermd)');

  useAppStore.getState().newProject();
  const cid2 = useAppStore.getState().defaultCompanyId;
  const c1Id = useAppStore.getState().addCalendar({
    name: 'B4-C1', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  });
  const c1Cal = useAppStore.getState().calendars.find(c => c.id === c1Id)!;
  useAppStore.getState().promoteCalendarToPool(cid2, c1Cal);
  assert(!!useAppStore.getState().calendars.find(c => c.id === c1Id)?.libraryOrigin, 'B4 scenario 2 setup: C1 heeft de stempel ná promote');

  const c2Id = useAppStore.getState().addCalendar({
    name: 'B4-C2', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  });
  assert(useAppStore.getState().calendars.some(c => c.id === c2Id), 'B4 scenario 2 setup: C2 toegevoegd (ná de promote)');

  useAppStore.getState().undo();
  const s2 = useAppStore.getState();
  assert(!s2.calendars.some(c => c.id === c2Id), 'B4 scenario 2: undo verwijdert de ONGERELATEERDE latere C2 (zoals verwacht)');
  assert(!!s2.calendars.find(c => c.id === c1Id)?.libraryOrigin, 'B4 scenario 2 [FIX]: de EERDERE C1-stempel overleeft de latere, ongerelateerde undo (vóór fix B4: verloren, zie B7 A1/A2)');
}

{
  const invalid = {
    companies: [{ id: 'c1', name: 'Bedrijf 1' }, { id: 'c2', name: 'Bedrijf 2' }],
    defaultCompanyId: 'ghost-company',
    pools: {
      'orphan-company': { companyId: 'orphan-company', companyName: 'Weg', poolVersion: 0, modifiedAt: '2020-01-01T00:00:00.000Z', calendars: [], resources: [] },
      'c1': { companyId: 'c1' },
    },
  } as unknown as Parameters<typeof normalizeLoadedLibrary>[0];

  let normalized: ReturnType<typeof normalizeLoadedLibrary> | undefined;
  let threw = false;
  try { normalized = normalizeLoadedLibrary(invalid); } catch { threw = true; }
  assert(!threw, 'normalizeLoadedLibrary gooit niet op vorm-invalide input');
  assert(!!normalized && normalized.companies.length === 2, 'normalizeLoadedLibrary behoudt geldige companies');
  assert(!!normalized && normalized.companies.some(c => c.id === normalized!.defaultCompanyId), 'normalizeLoadedLibrary: ongeldige defaultCompanyId valt terug op een bestaand bedrijf');
  assert(!!normalized && !('orphan-company' in normalized.pools), 'normalizeLoadedLibrary ruimt wees-pools op');

  const p = normalized!.pools['c1'];
  assert(!!p && Array.isArray(p.calendars) && Array.isArray(p.resources), 'normalizeLoadedLibrary: kapotte pool krijgt array-calendars/resources');
  assert(!!p && typeof p.poolVersion === 'number' && p.poolVersion === 1, 'normalizeLoadedLibrary: ontbrekende poolVersion valt terug op 1');
  assert(!!p && typeof p.modifiedAt === 'string' && p.modifiedAt.length > 0, 'normalizeLoadedLibrary: ontbrekende modifiedAt valt terug op nu');

  const empty = {} as unknown as Parameters<typeof normalizeLoadedLibrary>[0];
  const seeded = normalizeLoadedLibrary(empty);
  assert(seeded.companies.length === 1, 'normalizeLoadedLibrary: lege input seedt met standaardbedrijf');
  assert(seeded.defaultCompanyId === seeded.companies[0].id, 'normalizeLoadedLibrary: lege input krijgt geldige default');
}

{
  const s = useAppStore.getState();
  const cid = s.defaultCompanyId;
  const poolCalId = s.promoteCalendarToPool(cid, {
    id: 'seed-cal', name: 'Nachtploeg', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 22, workEndHour: 6, hoursPerDay: 8, holidays: [],
  })!;
  const poolResId = s.promoteResourceToPool(cid, { id: 'seed-res', name: 'Wachter', type: 'LABOR', description: '', maxUnits: 1 })!;
  useAppStore.getState().updatePoolResource(cid, poolResId, { calendarId: poolCalId });

  useAppStore.getState().bindProjectToCompany(cid);

  const beforeCals = useAppStore.getState().calendars.length;
  const undoBefore = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  const r1 = useAppStore.getState().addLibraryResourceToProject(cid, poolResId);
  assert(r1.added === true, 'addLibraryResource: resource toegevoegd');
  let st = useAppStore.getState();
  assert(st.resources.some(r => r.id === r1.resourceId), 'addLibraryResource: resource in project');
  assert(st.calendars.length === beforeCals + 1, 'addLibraryResource: kalender reisde mee');
  assert(st.historyEvents.filter(event => event.state === 'applied').length === undoBefore + 1, 'addLibraryResource: undo-snapshot gepusht (E-3)');
  const added = st.resources.find(r => r.id === r1.resourceId)!;
  assert(!!st.calendars.find(c => c.id === added.calendarId)?.libraryOrigin, 'addLibraryResource: meegereisde kalender heeft herkomst');
  assert(st.project.companyId === cid, 'addLibraryResource: binding blijft intact na add (plan-eis 9 — add bindt niet meer zelf)');

  const undoAfterAdd = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  const r2 = useAppStore.getState().addLibraryResourceToProject(cid, poolResId);
  assert(r2.added === false && r2.resourceId === r1.resourceId, 'addLibraryResource: dedup ("al in project")');
  assert(useAppStore.getState().resources.filter(r => r.libraryOrigin?.libraryItemId === poolResId).length === 1, 'addLibraryResource: geen duplicaat');
  assert(useAppStore.getState().calendars.length === beforeCals + 1, 'addLibraryResource: kalender niet gedupliceerd bij tweede keer');
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoAfterAdd, 'addLibraryResource: dedup pusht geen undo-snapshot (E-3)');

  const poolCalId2 = useAppStore.getState().promoteCalendarToPool(cid, {
    id: 'seed-cal2', name: 'Weekendploeg', description: '', workDays: [6, 7],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  })!;
  const undoBeforeCal = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  const c1 = useAppStore.getState().addLibraryCalendarToProject(cid, poolCalId2);
  assert(c1.added === true, 'addLibraryCalendar: kalender toegevoegd');
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoBeforeCal + 1, 'addLibraryCalendar: undo-snapshot gepusht (E-3)');
  const undoAfterCal = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  const c2 = useAppStore.getState().addLibraryCalendarToProject(cid, poolCalId2);
  assert(c2.added === false, 'addLibraryCalendar: dedup ("al in project")');
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoAfterCal, 'addLibraryCalendar: dedup pusht geen undo-snapshot (E-3)');
}

{
  useAppStore.getState().newProject();
  const cid = useAppStore.getState().defaultCompanyId;
  const pCal = useAppStore.getState().promoteCalendarToPool(cid, {
    id: 'undo-cal', name: 'Undo-ploeg', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  })!;
  const pRes = useAppStore.getState().promoteResourceToPool(cid, { id: 'undo-res', name: 'Undo-res', type: 'LABOR', description: '', maxUnits: 1 })!;
  useAppStore.getState().updatePoolResource(cid, pRes, { calendarId: pCal });

  assert(!useAppStore.getState().project.companyId, 'setup: verse project is ongebonden');
  const guarded = useAppStore.getState().addLibraryResourceToProject(cid, pRes);
  assert(guarded.added === false && guarded.resourceId === null, 'materialiseren op ongebonden project: no-op (geen stille koppeling)');
  assert(!useAppStore.getState().project.companyId, 'materialiseren bindt een ongebonden project NIET (plan-eis 9)');

  useAppStore.getState().bindProjectToCompany(cid);
  const calsBefore = useAppStore.getState().calendars.length;
  const resBefore = useAppStore.getState().resources.length;
  const add = useAppStore.getState().addLibraryResourceToProject(cid, pRes);
  assert(add.added === true, 'undo-scenario: resource toegevoegd op gebonden project');
  assert(useAppStore.getState().project.companyId === cid, 'undo-scenario: project blijft gebonden');
  assert(useAppStore.getState().resources.length === resBefore + 1, 'undo-scenario: resource erbij');
  assert(useAppStore.getState().calendars.length === calsBefore + 1, 'undo-scenario: meegereisde kalender erbij');

  useAppStore.getState().undo();
  const su = useAppStore.getState();
  assert(su.resources.length === resBefore && !su.resources.some(r => r.id === add.resourceId), 'undo: resource daadwerkelijk teruggedraaid (weg)');
  assert(su.calendars.length === calsBefore, 'undo: meegereisde kalender daadwerkelijk teruggedraaid (weg)');
  assert(su.project.companyId === cid, 'undo: binding blijft sticky (project snapshot:none)');
}

{
  useAppStore.getState().newProject();
  const cid = useAppStore.getState().defaultCompanyId;
  const poolCalId = useAppStore.getState().promoteCalendarToPool(cid, {
    id: 'bind-cal', name: 'Bindploeg', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  })!;

  assert(!useAppStore.getState().project.companyId, 'setup: verse project is ongebonden');
  const guarded = useAppStore.getState().addLibraryCalendarToProject(cid, poolCalId);
  assert(guarded.added === false && guarded.calendarId === null, 'kalender-materialiseren op ongebonden project: no-op');
  assert(!useAppStore.getState().project.companyId, 'kalender-materialiseren bindt het project NIET (plan-eis 9)');

  useAppStore.getState().bindProjectToCompany(cid);
  const c = useAppStore.getState().addLibraryCalendarToProject(cid, poolCalId);
  assert(c.added === true, 'kalender-only-add op gebonden project: kalender toegevoegd');
  assert(useAppStore.getState().project.companyId === cid, 'kalender-only-add: project blijft gebonden');
}

{
  const s = useAppStore.getState();
  const cid = s.defaultCompanyId;
  useAppStore.getState().bindProjectToCompany(cid);
  const poolResId = s.promoteResourceToPool(cid, { id: 'upd-res', name: 'Elektricien', type: 'LABOR', description: '', maxUnits: 1 })!;
  const added = useAppStore.getState().addLibraryResourceToProject(cid, poolResId);
  const projResId = added.resourceId!;

  assert(useAppStore.getState().diffProjectResource(projResId)?.status === 'up-to-date', 'diffProjectResource: vers = up-to-date');

  useAppStore.getState().updateResource(projResId, { description: 'lokaal bewerkt' });

  useAppStore.getState().updatePoolResource(cid, poolResId, { maxUnits: 4 });
  const d = useAppStore.getState().diffProjectResource(projResId);
  assert(d?.status === 'changed', 'diffProjectResource: pool gewijzigd ⇒ changed (deviated kopie blijft staan)');

  const undoBeforeUpd = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  useAppStore.getState().updateProjectResourceFromLibrary(projResId);
  const updated = useAppStore.getState().resources.find(r => r.id === projResId)!;
  assert(updated.maxUnits === 1, 'F1: updateProjectResourceFromLibrary laat maxUnits (projectinzet) ongemoeid, ook al wijzigde de pool naar 4');
  assert(updated.id === projResId, 'updateProjectResourceFromLibrary: project-id behouden');
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoBeforeUpd + 1, 'updateProjectResourceFromLibrary: undo-snapshot gepusht (E-3)');
  assert(useAppStore.getState().diffProjectResource(projResId)?.status === 'up-to-date', 'na bijwerken weer up-to-date');

  const undoBeforeUpToDate = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  const isDirtyBeforeUpToDate = useAppStore.getState().isDirty;
  useAppStore.getState().updateProjectResourceFromLibrary(projResId);
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoBeforeUpToDate, 'update op up-to-date resource: geen loze undo-snapshot');
  assert(useAppStore.getState().isDirty === isDirtyBeforeUpToDate, 'update op up-to-date resource: isDirty ongewijzigd');

  useAppStore.getState().removePoolResource(cid, poolResId);
  assert(useAppStore.getState().diffProjectResource(projResId)?.status === 'removed', 'diffProjectResource: origineel weg ⇒ removed');
  const beforeName = useAppStore.getState().resources.find(r => r.id === projResId)!.name;
  const undoBeforeNoop = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  useAppStore.getState().updateProjectResourceFromLibrary(projResId);
  assert(useAppStore.getState().resources.find(r => r.id === projResId)!.name === beforeName, 'update op verwijderd origineel = no-op');
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoBeforeNoop, 'update op verwijderd origineel: geen loze undo-snapshot (E-3)');
}

{
  useAppStore.getState().newProject();
  const cid = useAppStore.getState().defaultCompanyId;
  useAppStore.getState().ensureProjectCalendarInLibrary();
  const defId = useAppStore.getState().project.calendarId;
  const defCal = useAppStore.getState().calendars.find(c => c.id === defId)!;
  const poolCalId = useAppStore.getState().promoteCalendarToPool(cid, defCal)!;
  assert(useAppStore.getState().calendar.libraryOrigin?.libraryItemId === poolCalId, 'projectdefault: promote stempelt de denorm-cache s.calendar');
  assert(useAppStore.getState().diffProjectCalendar(defId)?.status === 'up-to-date', 'projectdefault: vers = up-to-date');

  useAppStore.getState().updatePoolCalendar(cid, poolCalId, { workEndHour: 18, hoursPerDay: 9 });
  assert(useAppStore.getState().diffProjectCalendar(defId)?.status === 'changed', 'projectdefault: pool gewijzigd ⇒ changed');

  const undoBefore = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  useAppStore.getState().updateProjectCalendarFromLibrary(defId);
  const su = useAppStore.getState();
  assert(su.calendars.find(c => c.id === defId)!.workEndHour === 18, 'projectdefault: waarde overgenomen in s.calendars');
  assert(su.calendar.id === defId && su.calendar.workEndHour === 18 && su.calendar.hoursPerDay === 9, 'projectdefault: denorm-cache s.calendar in sync (E-2, §9.1)');
  assert(su.historyEvents.filter(event => event.state === 'applied').length === undoBefore + 1, 'projectdefault: undo-snapshot gepusht (E-3)');
  assert(su.diffProjectCalendar(defId)?.status === 'up-to-date', 'projectdefault: na bijwerken weer up-to-date');

  const undoBeforeUpToDate = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  const isDirtyBeforeUpToDate = useAppStore.getState().isDirty;
  useAppStore.getState().updateProjectCalendarFromLibrary(defId);
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoBeforeUpToDate, 'update op up-to-date kalender: geen loze undo-snapshot');
  assert(useAppStore.getState().isDirty === isDirtyBeforeUpToDate, 'update op up-to-date kalender: isDirty ongewijzigd');

  useAppStore.getState().removePoolCalendar(cid, poolCalId);
  assert(useAppStore.getState().diffProjectCalendar(defId)?.status === 'removed', 'projectdefault: origineel weg ⇒ removed');
  const undoNoop = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  const endHourBefore = useAppStore.getState().calendar.workEndHour;
  useAppStore.getState().updateProjectCalendarFromLibrary(defId);
  assert(useAppStore.getState().calendar.workEndHour === endHourBefore, 'projectdefault: update op verwijderd origineel = no-op');
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoNoop, 'projectdefault: no-op geen loze undo-snapshot (E-3)');
}

{
  const s = useAppStore.getState();
  const cid = s.defaultCompanyId;
  s.promoteResourceToPool(cid, { id: 'exp-res', name: 'Loodgieter', type: 'LABOR', description: '', maxUnits: 1 });
  const ifc = useAppStore.getState().exportPoolIFC(cid);
  assert(!!ifc && ifc.includes('OPS_Library'), 'exportPoolIFC produceert een pool-bestand');

  const localVersion = useAppStore.getState().pools[cid].poolVersion;
  const older = { companyId: cid, companyName: 'x', poolVersion: 0, modifiedAt: '2000-01-01T00:00:00.000Z', calendars: [], resources: [] };
  assert(useAppStore.getState().isLocalPoolNewer(cid, older) === true, 'isLocalPoolNewer: oudere import ⇒ true');

  const fresh = { companyId: 'x', companyName: 'x', poolVersion: localVersion + 10, modifiedAt: '2030-01-01T00:00:00.000Z', calendars: [], resources: [{ id: 'new-only', name: 'X', type: 'LABOR' as const, description: '', maxUnits: 1 }] };
  useAppStore.getState().replacePool(cid, fresh);
  const pool = useAppStore.getState().pools[cid];
  assert(pool.resources.length === 1 && pool.resources[0].id === 'new-only', 'replacePool vervangt de hele pool');
  assert(pool.companyId === cid, 'replacePool herschrijft companyId naar het doelbedrijf');
  assert(useAppStore.getState().isLocalPoolNewer(cid, older) === true, 'na replace: nieuwe pool nog steeds nieuwer dan oude import');
}

{
  const s = useAppStore.getState();
  const cid = s.defaultCompanyId;
  const broken = { companyId: cid, companyName: 'Kapot' } as unknown as import('@/types/library').CompanyPool;
  let replaceThrew = false;
  try { useAppStore.getState().replacePool(cid, broken); } catch { replaceThrew = true; }
  assert(!replaceThrew, 'replacePool: gooit niet op een pool zonder resources/calendars');

  const importedPool = useAppStore.getState().pools[cid];
  assert(Array.isArray(importedPool?.calendars), 'replacePool: genormaliseerde pool heeft array-calendars');
  assert(Array.isArray(importedPool?.resources), 'replacePool: genormaliseerde pool heeft array-resources');
  assert(typeof importedPool?.poolVersion === 'number', 'replacePool: poolVersion numeriek na normalisatie');
  assert(typeof importedPool?.modifiedAt === 'string' && importedPool.modifiedAt.length > 0, 'replacePool: modifiedAt string na normalisatie');

  let promoteThrew = false;
  let poolResId: string | null = null;
  try {
    poolResId = useAppStore.getState().promoteResourceToPool(cid, { id: 'post-import-res', name: 'Stukadoor', type: 'LABOR', description: '', maxUnits: 1 });
  } catch { promoteThrew = true; }
  assert(!promoteThrew, 'na kapotte import: promoteResourceToPool gooit geen TypeError op .push');
  assert(!!poolResId, 'na kapotte import: promoteResourceToPool retourneert een id');

  useAppStore.getState().bindProjectToCompany(cid);

  let addThrew = false;
  let added: { added: boolean; resourceId: string | null } = { added: false, resourceId: null };
  try {
    if (poolResId) added = useAppStore.getState().addLibraryResourceToProject(cid, poolResId);
  } catch { addThrew = true; }
  assert(!addThrew, 'na kapotte import: addLibraryResourceToProject gooit geen TypeError op .find');
  assert(added.added === true, 'na kapotte import: addLibraryResourceToProject voegt toe');
}

{
  const s = useAppStore.getState();
  const cid = s.defaultCompanyId;

  const objectFields = {
    companyId: cid, companyName: 'Objectvelden', poolVersion: 2, modifiedAt: '2026-01-01T00:00:00.000Z',
    calendars: { oops: true }, resources: { oops: true },
  } as unknown as import('@/types/library').CompanyPool;
  let threwObj = false;
  try { useAppStore.getState().replacePool(cid, objectFields); } catch { threwObj = true; }
  assert(!threwObj, 'replacePool: gooit niet als calendars/resources een object zijn i.p.v. array');
  const poolObj = useAppStore.getState().pools[cid];
  assert(Array.isArray(poolObj?.calendars) && poolObj.calendars.length === 0, 'normalizePool: object-calendars wordt een lege array (niet het object)');
  assert(Array.isArray(poolObj?.resources) && poolObj.resources.length === 0, 'normalizePool: object-resources wordt een lege array (niet het object)');
  let opsThrewObj = false;
  try {
    const cId = useAppStore.getState().promoteCalendarToPool(cid, {
      id: 'post-objfields-cal', name: 'Na-objectvelden', description: '', workDays: [1, 2, 3, 4, 5],
      workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
    });
    if (cId) useAppStore.getState().addLibraryCalendarToProject(cid, cId);
  } catch { opsThrewObj = true; }
  assert(!opsThrewObj, 'na object-calendars/resources: promote/add werken zonder TypeError');

  const versionCases: { label: string; poolVersion: unknown; expected: number }[] = [
    { label: 'string "7"', poolVersion: '7', expected: 1 },
    { label: 'negatief -3', poolVersion: -3, expected: 1 },
    { label: 'float 2.7', poolVersion: 2.7, expected: 1 },
    { label: 'ontbrekend', poolVersion: undefined, expected: 1 },
    { label: 'geldig 5', poolVersion: 5, expected: 5 },
  ];
  for (const { label, poolVersion, expected } of versionCases) {
    const raw = { companyId: cid, companyName: 'VerTest', modifiedAt: '2026-01-01T00:00:00.000Z', calendars: [], resources: [], poolVersion } as unknown as import('@/types/library').CompanyPool;
    useAppStore.getState().replacePool(cid, raw);
    const got = useAppStore.getState().pools[cid].poolVersion;
    assert(Number.isInteger(got) && got === expected, `normalizePool: poolVersion ${label} ⇒ ${expected} (was ${got})`);
  }
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Mat BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'src', name: 'Kraanmachinist', type: 'LABOR', description: '', maxUnits: 1 })!;
  const r = s.addLibraryResourceToProject(cid, resId);
  const copy = useAppStore.getState().resources.find(x => x.id === r.resourceId);
  const poolSrc = useAppStore.getState().pools[cid].resources.find(x => x.id === resId)!;
  assert(copy?.libraryOrigin?.syncedHash === computeResourceHash(poolSrc), 'materialisatie: syncedHash op de projectkopie == computeResourceHash(poolbron)');
  assert(copy?.libraryOrigin?.companyId === cid, 'materialisatie stempelt het juiste bedrijf');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Verv BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'v', name: 'Stukadoor', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 1 })!;
  const add = s.addLibraryResourceToProject(cid, resId);
  s.updatePoolResource(cid, resId, { costPerHour: 5 });
  const behindHash = computeResourceHash({ id: 'x', name: 'Stukadoor', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 1 });
  seedRedoEvent();
  useAppStore.setState((st) => {
    st.isDirty = false;
    const r = st.resources.find(r => r.id === add.resourceId);
    if (r) { r.costPerHour = 1; r.libraryOrigin!.syncedHash = behindHash; }
  });
  const changed = useAppStore.getState().refreshBehindItems(cid);
  const after = useAppStore.getState();
  assert(changed >= 1, 'refreshBehindItems telt gewijzigde items');
  assert(after.resources.find(r => r.id === add.resourceId)?.costPerHour === 5, 'verversing neemt poolwaarde over');
  assert(after.historyEvents.filter(event => event.state === 'undone').length === 0, 'verversing WIST de redoStack (plan-eis 2)');
  assert(after.isDirty === false, 'verversing zet GEEN isDirty (spec §3)');

  useAppStore.setState((st) => {
    const r = st.resources.find(r => r.id === add.resourceId);
    if (r) { r.costPerHour = 4; r.libraryOrigin!.syncedHash = behindHash; }
  });
  useAppStore.getState().refreshBehindItems(cid);
  assert(useAppStore.getState().resources.find(r => r.id === add.resourceId)?.costPerHour === 4, 'refreshBehindItems laat een deviated item ONgemoeid');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Kal Verv BV');
  s.bindProjectToCompany(cid);
  const poolCalId = s.promoteCalendarToPool(cid, {
    id: 'kv-cal', name: 'Kalverploeg', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  })!;
  const addedCal = useAppStore.getState().addLibraryCalendarToProject(cid, poolCalId);
  const projCalId = addedCal.calendarId!;
  useAppStore.getState().setProjectCalendar(projCalId);
  assert(useAppStore.getState().calendar.id === projCalId, 'setup: projectkalender is de default (s.calendar)');

  useAppStore.setState((st) => {
    const pc = st.pools[cid].calendars.find(c => c.id === poolCalId)!;
    pc.workEndHour = 18; pc.hoursPerDay = 9;
  });
  assert(useAppStore.getState().diffProjectCalendar(projCalId)?.status === 'changed', 'setup: kalender is behind (pool gewijzigd)');

  useAppStore.setState((st) => { st.scheduleStale = false; });
  const changed = useAppStore.getState().refreshBehindItems(cid);
  const after = useAppStore.getState();
  assert(changed >= 1, 'refreshBehindItems (kalendertak): telt de gewijzigde kalender');
  const refreshedCal = after.calendars.find(c => c.id === projCalId)!;
  assert(refreshedCal.workEndHour === 18 && refreshedCal.hoursPerDay === 9, 'refreshBehindItems (kalendertak): kalenderwaarden bijgewerkt');
  assert(after.scheduleStale === true, 'refreshBehindItems (kalendertak): scheduleStale === true');
  assert(after.calendar.id === projCalId && after.calendar.workEndHour === 18 && after.calendar.hoursPerDay === 9, 'refreshBehindItems (kalendertak): denorm-cache s.calendar wijst naar de nieuwe waarden');

  useAppStore.setState((st) => { st.scheduleStale = false; });
  const resId = useAppStore.getState().promoteResourceToPool(cid, { id: 'kv-res', name: 'Kalvermetselaar', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 1 })!;
  const addedRes = useAppStore.getState().addLibraryResourceToProject(cid, resId);
  useAppStore.setState((st) => {
    const pr = st.pools[cid].resources.find(r => r.id === resId)!;
    pr.costPerHour = 3;
  });
  assert(useAppStore.getState().diffProjectResource(addedRes.resourceId!)?.status === 'changed', 'setup (negatief): resource is behind');
  useAppStore.getState().refreshBehindItems(cid);
  assert(useAppStore.getState().scheduleStale === false, 'refreshBehindItems: resource-only-verversing laat scheduleStale false');
}

{
  useAppStore.getState().newProject();
  const cid = useAppStore.getState().addCompany('History refresh BV');
  useAppStore.getState().bindProjectToCompany(cid);
  const poolCalId = useAppStore.getState().promoteCalendarToPool(cid, {
    id: 'history-refresh-cal', name: 'Historyploeg', description: '',
    workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 15,
    hoursPerDay: 8, holidays: [],
  })!;
  const added = useAppStore.getState().addLibraryCalendarToProject(cid, poolCalId);
  const projectCalId = added.calendarId!;
  useAppStore.getState().setProjectCalendar(projectCalId);

  const taskId = useAppStore.getState().addTask({ name: 'Vóór hernoemen' });
  useAppStore.getState().updateTask(taskId, { name: 'Na hernoemen' });

  useAppStore.setState((state) => {
    const poolCalendar = state.pools[cid].calendars.find(cal => cal.id === poolCalId)!;
    poolCalendar.workEndHour = 18;
    poolCalendar.hoursPerDay = 9;
  });
  assert(useAppStore.getState().refreshBehindItems(cid) >= 1,
    'historyrefresh setup: stille kalenderverversing is toegepast');
  useAppStore.getState().runCPM();
  assert(useAppStore.getState().calendar.workEndHour === 18,
    'historyrefresh setup: F5 rekent met de ververste kalender');

  useAppStore.getState().undo();
  let afterHistory = useAppStore.getState();
  assert(afterHistory.tasks.find(task => task.id === taskId)?.name === 'Vóór hernoemen',
    'historyrefresh: undo draait de gewone gebruikershandeling terug');
  assert(afterHistory.calendar.workEndHour === 15 && afterHistory.calendar.hoursPerDay === 8,
    'historyrefresh: undo behoudt legacygedrag en herstelt tijdelijk het oude documentsnapshot');

  useAppStore.getState().redo();
  afterHistory = useAppStore.getState();
  assert(afterHistory.tasks.find(task => task.id === taskId)?.name === 'Na hernoemen',
    'historyrefresh: redo brengt de gewone gebruikershandeling terug');
  assert(afterHistory.calendar.workEndHour === 18 && afterHistory.calendar.hoursPerDay === 9,
    'historyrefresh: redo herstelt de ververste en doorgerekende eindtoestand');
  assert(afterHistory.scheduleStale === false,
    'historyrefresh: redo herstelt ook de na F5 verse planningstoestand');
}

{
  const s = useAppStore.getState();
  const cidA = s.addCompany('Grens A BV');
  const cidB = s.addCompany('Grens B BV');
  s.bindProjectToCompany(cidA);
  const resIdB = s.promoteResourceToPool(cidB, { id: 'grens-b', name: 'Tegelzetter', type: 'LABOR', description: '', maxUnits: 1 })!;
  const result = useAppStore.getState().addLibraryResourceToProject(cidB, resIdB);
  assert(result.added === false, 'addLibraryResourceToProject(B) op een aan A gebonden project: no-op (added=false)');
  assert(useAppStore.getState().project.companyId === cidA, 'addLibraryResourceToProject(B) op een aan A gebonden project: binding blijft op A');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Multi BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'm', name: 'Voeger', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 1 })!;
  s.addLibraryResourceToProject(cid, resId);
  const firstDoc = useAppStore.getState().activeDocumentId;
  const secondDoc = s.newDocument();
  s.updatePoolResource(cid, resId, { costPerHour: 8 });
  const dormant = useAppStore.getState().documents.find(d => d.id === firstDoc);
  const dormantRes = dormant?.payload?.resources.find(r => r.libraryOrigin?.libraryItemId === resId);
  assert(dormantRes?.costPerHour === 8, 'pool-edit ververst de slapende payload (plan-eis 1)');
  assert(secondDoc !== firstDoc, 'tweede document is een ander id');

  useAppStore.setState((st) => {
    const doc = st.documents.find(d => d.id === firstDoc);
    if (doc?.payload) doc.payload.resourceLoadResult = { load: {}, capacity: { __stale__: {} }, overallocatedDays: {}, overallocatedReasons: {}, hours: {} };
  });
  useAppStore.getState().switchDocument(firstDoc);
  const activeLoad = useAppStore.getState().resourceLoadResult;
  assert(!!activeLoad && !('__stale__' in activeLoad.capacity), 'switchDocument herberekent resourceLoadResult bij activering i.p.v. de slapende/verouderde waarde te laten staan (fix 1)');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('F1 Kalender BV');
  s.bindProjectToCompany(cid);
  const activeCalId = useAppStore.getState().project.calendarId;
  const calId = s.promoteCalendarToPool(cid, { ...useAppStore.getState().calendar, id: activeCalId })!;
  assert(calId !== activeCalId, 'F1-fixture: promoteCalendarToPool mint een VERSE pool-id (niet gelijk aan het project-item-id)');
  assert(useAppStore.getState().calendar.libraryOrigin?.companyId === cid, 'F1-fixture: de actieve projectkalender-cache draagt meteen het herkomststempel');
  assert(useAppStore.getState().calendar.libraryOrigin?.libraryItemId === calId, 'F1-fixture: het stempel verwijst naar de nieuwe pool-id');

  const docA = useAppStore.getState().activeDocumentId;
  s.newDocument();
  s.updatePoolCalendar(cid, calId, { workStartHour: 6, workEndHour: 20, hoursPerDay: 14, name: 'Verse tijden' });

  const docAEntry = useAppStore.getState().documents.find(d => d.id === docA)!;
  const freshCal = docAEntry.payload!.calendars.find(c => c.id === activeCalId);
  assert(freshCal?.workStartHour === 6, 'F1: pool-bump ververst de kalender in de SLAPENDE payload.calendars-lijst');
  assert(docAEntry.payload!.calendar.workStartHour === 6, 'F1: de gedenormaliseerde payload.calendar-cache volgt payload.calendars mee (was stale vóór de fix)');
  assert(docAEntry.payload!.calendar.id === activeCalId, 'F1: payload.calendar blijft naar de juiste project-kalender-id wijzen');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('F1 Remove BV');
  s.bindProjectToCompany(cid);
  const activeCalId = useAppStore.getState().project.calendarId;
  s.promoteCalendarToPool(cid, { ...useAppStore.getState().calendar, id: activeCalId });
  assert(useAppStore.getState().calendar.libraryOrigin?.companyId === cid, 'F1-fixture (removeCompany): de actieve projectkalender-cache draagt het stempel vóór het slapend worden');

  const docA = useAppStore.getState().activeDocumentId;
  s.newDocument();
  s.removeCompany(cid);

  const docAEntry = useAppStore.getState().documents.find(d => d.id === docA)!;
  assert(docAEntry.payload!.calendars.find(c => c.id === activeCalId)?.libraryOrigin === undefined, 'F1-fixture: payload.calendars is gestript (bestaand gedrag, sanity-check)');
  assert(docAEntry.payload!.calendar.libraryOrigin === undefined, 'F1: removeCompany strript ook de payload.calendar-denormcache (droeg anders nog het stempel van het verwijderde bedrijf)');
  assert(docAEntry.payload!.calendar.id === activeCalId, 'F1: payload.calendar blijft naar de juiste project-kalender-id wijzen ná removeCompany');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('F4 Redo BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'f4-res', name: 'Stellingbouwer', type: 'LABOR', description: '', maxUnits: 1 })!;
  const added = s.addLibraryResourceToProject(cid, resId);
  assert(added.added === true, 'F4-fixture: materialisatie is gelukt');
  useAppStore.getState().undo();
  assert(useAppStore.getState().resources.find(r => r.id === added.resourceId) === undefined, 'F4-fixture: undo verwijdert de gematerialiseerde kopie weer');
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'undone').length === 1, 'F4-fixture: er staat nu precies één redo-entry klaar (zou de materialisatie terugzetten)');

  useAppStore.getState().updatePoolResource(cid, resId, { maxUnits: 9 });
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'undone').length === 0, 'F4: updatePoolResource wist de redoStack ONVOORWAARDELIJK, ook bij nul "behind"-treffers');
  useAppStore.getState().redo();
  assert(useAppStore.getState().resources.find(r => r.name === 'Stellingbouwer') === undefined, 'F4: redo() doet niets (lege redoStack) — de net-verwijderde materialisatie komt niet stilletjes terug');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('F4 Promote BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'f4b-res', name: 'Isolatiemonteur', type: 'LABOR', description: '', maxUnits: 1 })!;
  s.addLibraryResourceToProject(cid, resId);
  useAppStore.getState().undo();
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'undone').length === 1, 'F4-promote-fixture: er staat een redo-entry klaar');

  useAppStore.getState().promoteResourceToPool(cid, { id: 'f4b-extra', name: 'Grondwerker', type: 'LABOR', description: '', maxUnits: 1 });
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'undone').length === 0, 'F4: promoteResourceToPool wist de redoStack van een gebonden document (promote-route)');
  useAppStore.getState().redo();
  assert(useAppStore.getState().resources.find(r => r.name === 'Isolatiemonteur') === undefined, 'F4 (promote-route): redo() doet niets — de net-verwijderde materialisatie komt niet terug');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Del BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'd', name: 'Dakdekker', type: 'LABOR', description: '', maxUnits: 2 })!;
  const added = s.addLibraryResourceToProject(cid, resId);
  s.removePoolResource(cid, resId);
  const copy = useAppStore.getState().resources.find(r => r.id === added.resourceId);
  assert(copy?.maxUnits === 2, 'projectkopie behoudt zijn laatste waarden na pool-verwijdering');
  assert(useAppStore.getState().onOpenStatusForResource(added.resourceId!) === 'removed', 'kopie is gemarkeerd removed');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Herk BV');
  const poolResId = s.promoteResourceToPool(cid, { id: 'p', name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 3 })!;
  const projResId = s.addResource({ name: 'metselaar', type: 'LABOR', description: '', maxUnits: 1 });
  s.bindProjectToCompany(cid);
  const cands = useAppStore.getState().computeRecognition();
  const match = cands.find(c => c.kind === 'resource' && c.projectId === projResId);
  assert(match?.suggestedPoolId === poolResId, 'herkenning stelt de naam-gelijke poolresource voor');
  useAppStore.getState().linkRecognizedItems([{ kind: 'resource', projectId: projResId, poolId: poolResId }]);
  const linked = useAppStore.getState().resources.find(r => r.id === projResId);
  assert(linked?.libraryOrigin?.libraryItemId === poolResId, 'linkRecognizedItems stempelt het projectitem');
  assert(!!linked?.libraryOrigin?.syncedHash, 'linkRecognizedItems zet een syncedHash');
  assert(linked?.maxUnits === 1, 'F1: linkRecognizedItems laat maxUnits (projectinzet) ongemoeid, ook al draagt de pool 3');
  useAppStore.getState().unbindProject();
  const after = useAppStore.getState();
  assert(after.project.companyId === undefined, 'ontkoppelen wist de bedrijfsbinding');
  assert(after.resources.find(r => r.id === projResId)?.libraryOrigin === undefined, 'ontkoppelen stript de stempels');
}

{
  const iso = createAppStore();
  const fixture = createRecognitionFixture(64);
  installRecognitionFixture(iso, fixture);
  const before = iso.getState();
  const expected = legacyRecognition(before);
  const actual = before.computeRecognition();
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    'herkenningsindex: volledige kandidaten inclusief ruwe namen, nulls en voorstelvolgorde gelijk aan oude scan');
  assert(iso.getState() === before, 'herkenningsindex: berekenen muteert de store niet');
  assert(actual[0].projectId === 'project-r-0' && actual[actual.length / 2].projectId === 'project-c-0',
    'herkenningsindex: resources eerst, daarna kalenders, elk in projectvolgorde');
  assert(!actual.some(c => c.projectId === 'project-r-33' || c.projectId === 'project-c-33'),
    'herkenningsindex: ook vreemde herkomststempels blijven buiten de volledige kandidatenlijst');
  assert(actual.find(c => c.projectId === 'project-r-7')?.suggestedPoolId === null
    && actual.find(c => c.projectId === 'project-c-9')?.suggestedPoolId === null,
    'herkenningsindex: herhaald object en herhaalde id blijven ambigu in de echte store');

  const documentItems = () => JSON.stringify({
    resources: iso.getState().resources, calendars: iso.getState().calendars, calendar: iso.getState().calendar,
  });
  const unlinked = documentItems();
  const links = actual.flatMap(c => c.suggestedPoolId === null ? [] : [{
    kind: c.kind, projectId: c.projectId, poolId: c.suggestedPoolId,
  }]);
  iso.getState().linkRecognizedItems(links);
  assert(iso.getState().resources[0].libraryOrigin?.libraryItemId === 'pool-r-0'
    && iso.getState().resources[0].maxUnits === 1 && iso.getState().resources[0].costPerHour === 50,
    'herkenningsindex: toepassen stempelt en ververst resources met behoud van projectinzet');
  assert(iso.getState().calendars[0].libraryOrigin?.libraryItemId === 'pool-c-0'
    && iso.getState().calendars[0].workStartHour === 7 && iso.getState().scheduleStale,
    'herkenningsindex: toepassen ververst kalenders en markeert de planning als verouderd');
  assert(iso.getState().historyEvents.filter(e => e.state === 'applied').length === 1,
    'herkenningsindex: de volledige bevestiging blijft één undo-stap');
  iso.getState().undo();
  assert(documentItems() === unlinked, 'herkenningsindex: undo herstelt alle resources, kalenders en kalendercache');
  assert(JSON.stringify(iso.getState().computeRecognition()) === JSON.stringify(expected),
    'herkenningsindex: na undo is het volledige voorstel identiek');

  iso.setState(s => {
    s.pools[fixture.pool.companyId].resources[0].name = 'Niet gevonden';
    s.pools[fixture.pool.companyId].calendars[0].name = 'Niet gevonden';
    s.pools[fixture.pool.companyId].resources[6].name = 'Nieuwe timmerman';
  });
  const changed = iso.getState().computeRecognition();
  assert(JSON.stringify(changed) === JSON.stringify(legacyRecognition(iso.getState())),
    'herkenningsindex: volgende aanroep leest alle gewijzigde poolnamen opnieuw');
  assert(changed.find(c => c.projectId === 'project-r-0')?.suggestedPoolId === null
    && changed.find(c => c.projectId === 'project-c-18')?.suggestedPoolId === 'pool-c-0'
    && changed.find(c => c.projectId === 'project-r-5')?.suggestedPoolId === 'pool-r-5',
    'herkenningsindex: oude match verdwijnt, nieuwe verschijnt en opgeheven ambiguïteit wordt uniek');

  for (const guard of ['geen-binding', 'onbekend-bedrijf', 'geen-pool'] as const) {
    installRecognitionFixture(iso, createRecognitionFixture(24));
    iso.setState(s => {
      if (guard === 'geen-binding') s.project.companyId = undefined;
      if (guard === 'onbekend-bedrijf') s.companies = [];
      if (guard === 'geen-pool') s.pools = {};
    });
    assert(JSON.stringify(iso.getState().computeRecognition()) === JSON.stringify(legacyRecognition(iso.getState())),
      `herkenningsindex: bestaande guard ${guard} blijft gelijk`);
  }
}

for (const size of [1000, 5000]) {
  const iso = createAppStore();
  const fixture = createRecognitionFixture(size);
  let reads = 0;
  const counted = <T extends { name: string }>(items: T[]): T[] => items.map(item => {
    const name = item.name;
    return { ...item, get name() { reads++; return name; } };
  });
  fixture.pool.resources = counted(fixture.pool.resources);
  fixture.pool.calendars = counted(fixture.pool.calendars);
  installRecognitionFixture(iso, fixture);
  reads = 0;
  const originalNormalize = String.prototype.normalize;
  let normalizations = 0;
  let candidates: ReturnType<typeof legacyRecognition> = [];
  try {
    String.prototype.normalize = function (this: string, form?: string) {
      normalizations++;
      return originalNormalize.call(this, form);
    };
    candidates = iso.getState().computeRecognition();
  } finally {
    String.prototype.normalize = originalNormalize;
  }
  const poolCount = fixture.pool.resources.length + fixture.pool.calendars.length;
  const matches = candidates.filter(c => c.suggestedPoolId !== null).length;
  assert(reads === poolCount + matches,
    `herkenning ${size}: één poolscan plus uitvoernamen (zag ${reads}, verwacht ${poolCount + matches})`);
  assert(normalizations === poolCount + candidates.length,
    `herkenning ${size}: m+n normalisaties (zag ${normalizations}, verwacht ${poolCount + candidates.length})`);

  iso.setState(s => {
    for (const items of [s.resources, s.calendars]) {
      for (const item of items) item.libraryOrigin = { companyId: 'vreemd', libraryItemId: 'bestaand', poolVersion: 1 };
    }
  });
  reads = 0;
  assert(iso.getState().computeRecognition().length === 0 && reads === 0,
    `herkenning ${size}: volledig gestempeld project bouwt geen poolindex`);
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Ambigu BV');
  s.promoteResourceToPool(cid, { id: 'amb1', name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 1 });
  s.promoteResourceToPool(cid, { id: 'amb2', name: 'timmerman', type: 'LABOR', description: '', maxUnits: 1 });
  const projResId = s.addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 1 });
  s.bindProjectToCompany(cid);
  const cands = useAppStore.getState().computeRecognition();
  const match = cands.find(c => c.kind === 'resource' && c.projectId === projResId);
  assert(match !== undefined, 'ambigu: het projectitem wordt wél als kandidaat getoond');
  assert(match?.suggestedPoolId === null && match?.suggestedPoolName === null, 'ambigu: twee gelijknamige poolitems ⇒ geen voorstel (matchByName is uniek-of-null)');
}

{
  const s = useAppStore.getState();
  const companyA = s.addCompany('F3 Bedrijf A');
  const companyB = s.addCompany('F3 Bedrijf B');
  s.promoteResourceToPool(companyB, { id: 'f3-res', name: 'Stukadoor', type: 'LABOR', description: '', maxUnits: 1 });
  const projResId = s.addResource({ name: 'Stukadoor', type: 'LABOR', description: '', maxUnits: 1 });
  useAppStore.setState((st) => {
    const r = st.resources.find(r => r.id === projResId);
    if (r) r.libraryOrigin = { companyId: companyA, libraryItemId: 'iets-in-a', poolVersion: 1 };
  });
  s.bindProjectToCompany(companyB);
  const cands = useAppStore.getState().computeRecognition();
  assert(cands.find(c => c.kind === 'resource' && c.projectId === projResId) === undefined, 'F3: een item met een stempel van een ANDER bedrijf dan het gekoppelde wordt NIET aangeboden als herkenningskandidaat');
  const unstampedId = s.addResource({ name: 'Onbekende Vakman', type: 'LABOR', description: '', maxUnits: 1 });
  const cands2 = useAppStore.getState().computeRecognition();
  assert(cands2.find(c => c.kind === 'resource' && c.projectId === unstampedId) !== undefined, 'F3 negatieve controle: een stempel-loos item wordt WEL aangeboden als kandidaat');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Kal Herk BV');
  const poolCalId = s.promoteCalendarToPool(cid, {
    id: 'kh-cal', name: 'Ochtendploeg', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 6, workEndHour: 14, hoursPerDay: 8, holidays: [],
  })!;
  const projCalId = s.addCalendar({
    name: 'ochtendploeg', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  });
  s.bindProjectToCompany(cid);
  const cands = useAppStore.getState().computeRecognition();
  const match = cands.find(c => c.kind === 'calendar' && c.projectId === projCalId);
  assert(match?.suggestedPoolId === poolCalId, 'kalender-herkenning stelt de naam-gelijke poolkalender voor');

  useAppStore.setState((st) => { st.scheduleStale = false; });
  useAppStore.getState().linkRecognizedItems([{ kind: 'calendar', projectId: projCalId, poolId: poolCalId }]);
  const linkedCal = useAppStore.getState().calendars.find(c => c.id === projCalId);
  const poolCal = useAppStore.getState().pools[cid].calendars.find(c => c.id === poolCalId)!;
  assert(linkedCal?.workStartHour === 6 && linkedCal?.workEndHour === 14, 'kalender-link: waarden overgenomen van de pool');
  assert(linkedCal?.libraryOrigin?.syncedHash === computeCalendarHash(poolCal), 'kalender-link: syncedHash == hash(poolbron)');
  assert(useAppStore.getState().scheduleStale === true, 'kalender-link: scheduleStale (GO-NA-fix 2)');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Onb Undo BV');
  const poolResId = s.promoteResourceToPool(cid, { id: 'ou-res', name: 'Lasser', type: 'LABOR', description: '', maxUnits: 2 })!;
  const poolCalId = s.promoteCalendarToPool(cid, {
    id: 'ou-cal', name: 'Lasploeg', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  })!;
  s.bindProjectToCompany(cid);
  const addedRes = useAppStore.getState().addLibraryResourceToProject(cid, poolResId);
  const addedCal = useAppStore.getState().addLibraryCalendarToProject(cid, poolCalId);
  useAppStore.getState().setProjectCalendar(addedCal.calendarId!);
  const projResId = addedRes.resourceId!;
  const projCalId = addedCal.calendarId!;
  assert(useAppStore.getState().calendar.id === projCalId, 'setup: projectkalender is de default (s.calendar)');

  const undoBefore = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  useAppStore.getState().unbindProject();
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoBefore + 1, 'unbindProject: undo-snapshot gepusht (GO-NA-fix 1)');
  assert(useAppStore.getState().resources.find(r => r.id === projResId)?.libraryOrigin === undefined, 'unbindProject: resource-stempel gestript');
  assert(useAppStore.getState().calendars.find(c => c.id === projCalId)?.libraryOrigin === undefined, 'unbindProject: kalender-stempel gestript');

  const undoBeforeNoop = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  useAppStore.getState().unbindProject();
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoBeforeNoop, 'unbindProject op een al-los project: geen loze undo-snapshot');

  useAppStore.getState().undo();
  const after = useAppStore.getState();
  assert(after.resources.find(r => r.id === projResId)?.libraryOrigin?.libraryItemId === poolResId, 'undo na unbindProject: resource-stempel terug');
  assert(after.calendars.find(c => c.id === projCalId)?.libraryOrigin?.libraryItemId === poolCalId, 'undo na unbindProject: kalender-stempel terug');
  assert(after.calendar.id === projCalId && !!after.calendar.libraryOrigin, 'undo na unbindProject: denorm-cache (s.calendar) klopt weer met de herstelde kalender');
}

{
  const s = useAppStore.getState();
  const cidA = s.addCompany('Omkop A BV');
  const cidB = s.addCompany('Omkop B BV');
  const poolResIdA = s.promoteResourceToPool(cidA, { id: 'oka-res', name: 'Schilder', type: 'LABOR', description: '', maxUnits: 1 })!;
  s.bindProjectToCompany(cidA);
  const addA = useAppStore.getState().addLibraryResourceToProject(cidA, poolResIdA);
  const projResId = addA.resourceId!;
  assert(useAppStore.getState().resources.find(r => r.id === projResId)?.libraryOrigin?.companyId === cidA, 'setup: resource gestempeld voor bedrijf A');

  const undoBeforeSame = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  useAppStore.getState().bindProjectToCompany(cidA);
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoBeforeSame, 'herbind naar hetzelfde bedrijf: geen loze undo-snapshot');

  const undoBefore = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  useAppStore.getState().bindProjectToCompany(cidB);
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoBefore + 1, 'omkoppelen A→B: undo-snapshot gepusht (GO-NA-fix 1)');
  assert(useAppStore.getState().project.companyId === cidB, 'omkoppelen A→B: project nu gebonden aan B');
  assert(useAppStore.getState().resources.find(r => r.id === projResId)?.libraryOrigin === undefined, 'omkoppel-strip: A-stempel weg ná bind naar B');

  useAppStore.getState().undo();
  const after = useAppStore.getState();
  assert(after.resources.find(r => r.id === projResId)?.libraryOrigin?.companyId === cidA, 'undo van de omkoppel-strip: A-stempel terug');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Verdwenen BV');
  const poolResId1 = s.promoteResourceToPool(cid, { id: 'vd1', name: 'Grondwerker', type: 'LABOR', description: '', maxUnits: 1 })!;
  const poolResId2 = s.promoteResourceToPool(cid, { id: 'vd2', name: 'Sloper', type: 'LABOR', description: '', maxUnits: 1 })!;
  const projRes1 = s.addResource({ name: 'grondwerker', type: 'LABOR', description: '', maxUnits: 1 });
  const projRes2 = s.addResource({ name: 'sloper', type: 'LABOR', description: '', maxUnits: 1 });
  s.bindProjectToCompany(cid);
  useAppStore.getState().removePoolResource(cid, poolResId1);

  let threw = false;
  try {
    useAppStore.getState().linkRecognizedItems([
      { kind: 'resource', projectId: projRes1, poolId: poolResId1 },
      { kind: 'resource', projectId: projRes2, poolId: poolResId2 },
    ]);
  } catch { threw = true; }
  assert(!threw, 'linkRecognizedItems: verdwenen kandidaat gooit geen throw (GO-NA-fix 3)');
  assert(useAppStore.getState().resources.find(r => r.id === projRes1)?.libraryOrigin === undefined, 'verdwenen kandidaat: link stil overgeslagen, geen stempel');
  assert(useAppStore.getState().resources.find(r => r.id === projRes2)?.libraryOrigin?.libraryItemId === poolResId2, 'geldige link gaat gewoon door naast de verdwenen kandidaat');
}

{
  const iso = createAppStore();
  installRecognitionFixture(iso, createRecognitionFixture(4));
  iso.setState(s => { s.isDirty = false; s.importPristine = true; });
  const eventsBefore = iso.getState().historyEvents.filter(e => e.state === 'applied').length;
  const itemsBefore = JSON.stringify({ resources: iso.getState().resources, calendars: iso.getState().calendars });
  iso.getState().linkRecognizedItems([
    { kind: 'resource', projectId: 'onbekend-projectitem', poolId: 'pool-r-0' },
    { kind: 'calendar', projectId: 'onbekende-kalender', poolId: 'pool-c-0' },
  ]);
  const after = iso.getState();
  assert(JSON.stringify({ resources: after.resources, calendars: after.calendars }) === itemsBefore,
    'knownbug 1991: link zonder projectitem wijzigt geen enkel projectitem');
  assert(after.isDirty === false, 'knownbug 1991: link zonder projectitem zet isDirty niet op true');
  assert(after.importPristine === true, 'knownbug 1991: link zonder projectitem wist importPristine niet');
  assert(after.historyEvents.filter(e => e.state === 'applied').length === eventsBefore,
    'knownbug 1991: link zonder projectitem pusht geen undo-event');

  iso.getState().linkRecognizedItems([{ kind: 'resource', projectId: 'project-r-0', poolId: 'pool-r-0' }]);
  const linked = iso.getState();
  assert(linked.resources.find(r => r.id === 'project-r-0')?.libraryOrigin?.libraryItemId === 'pool-r-0',
    'knownbug 1991 (controle): geldige link stempelt het projectitem alsnog');
  assert(linked.isDirty === true && linked.importPristine === false,
    'knownbug 1991 (controle): geldige link zet isDirty en wist importPristine, zoals nu');
  assert(linked.historyEvents.filter(e => e.state === 'applied').length === eventsBefore + 1,
    'knownbug 1991 (controle): geldige link pusht precies één undo-event');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Inv BV');
  s.bindProjectToCompany(cid);
  const resSnapshotBefore = JSON.stringify(useAppStore.getState().resources);
  const poolVBefore = useAppStore.getState().pools[cid].poolVersion;
  const newId = s.addPoolResource(cid, { name: 'Grondwerker', type: 'LABOR', description: '', maxUnits: 4 });
  const after = useAppStore.getState();
  assert(!!newId && after.pools[cid].resources.some(r => r.id === newId), 'addPoolResource voegt toe aan de pool');
  assert(after.pools[cid].poolVersion === poolVBefore + 1, 'addPoolResource bumpt de pool');
  assert(JSON.stringify(after.resources) === resSnapshotBefore, 'addPoolResource raakt s.resources NIET (invariant, plan-eis 3)');
  const calId = s.addPoolCalendar(cid, { name: 'Weekendploeg', description: '', workDays: [6, 0], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [] });
  assert(!!calId && useAppStore.getState().pools[cid].calendars.some(c => c.id === calId), 'addPoolCalendar voegt toe aan de pool');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Inv2 BV');
  s.bindProjectToCompany(cid);
  const projResId = s.addResource({ name: 'Steiger-Piet', type: 'LABOR', description: '', maxUnits: 1 });
  const poolResId = s.addPoolResource(cid, { name: 'Steiger-Piet', type: 'LABOR', description: '', maxUnits: 1 })!;

  const resSnapshotBeforeUpdate = JSON.stringify(useAppStore.getState().resources);
  const poolVBeforeUpdate = useAppStore.getState().pools[cid].poolVersion;
  s.updatePoolResource(cid, poolResId, { maxUnits: 7, costPerHour: 42 });
  const afterUpdate = useAppStore.getState();
  assert(afterUpdate.pools[cid].resources.find(r => r.id === poolResId)?.maxUnits === 7, 'updatePoolResource: wijziging landt in de pool');
  assert(afterUpdate.pools[cid].poolVersion === poolVBeforeUpdate + 1, 'updatePoolResource bumpt de pool');
  assert(JSON.stringify(afterUpdate.resources) === resSnapshotBeforeUpdate, 'updatePoolResource raakt s.resources NIET (invariant, issue #19 punt 1)');
  assert(afterUpdate.resources.find(r => r.id === projResId)?.maxUnits === 1, 'updatePoolResource: de gelijknamige PROJECTresource blijft exact ongewijzigd');

  const resSnapshotBeforeRemove = JSON.stringify(useAppStore.getState().resources);
  s.removePoolResource(cid, poolResId);
  const afterRemove = useAppStore.getState();
  assert(!afterRemove.pools[cid].resources.some(r => r.id === poolResId), 'removePoolResource verwijdert uit de pool');
  assert(JSON.stringify(afterRemove.resources) === resSnapshotBeforeRemove, 'removePoolResource raakt s.resources NIET (invariant, issue #19 punt 1)');
  assert(afterRemove.resources.some(r => r.id === projResId), 'removePoolResource: de gelijknamige PROJECTresource blijft gewoon in het project staan');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('F7 BV');
  const crewId = s.addPoolResource(cid, { name: 'Ploeg Noord', type: 'CREW', description: '', maxUnits: 1 })!;
  const memberId = s.addPoolResource(cid, { name: 'Lid', type: 'LABOR', description: '', maxUnits: 1 })!;
  const otherMemberId = s.addPoolResource(cid, { name: 'Ander lid (andere ploeg)', type: 'LABOR', description: '', maxUnits: 1 })!;
  s.updatePoolResource(cid, memberId, { parentId: crewId });
  s.updatePoolResource(cid, otherMemberId, { parentId: undefined });
  assert(useAppStore.getState().pools[cid].resources.find(r => r.id === memberId)?.parentId === crewId, 'setup: lid volgt de ploeg');

  s.removePoolResource(cid, crewId);
  const after = useAppStore.getState();
  assert(!after.pools[cid].resources.some(r => r.id === crewId), 'F7: de ploeg zelf is weg');
  assert(after.pools[cid].resources.find(r => r.id === memberId)?.parentId === undefined, 'F7: het lid valt terug op GEEN ouder (dangling parentId opgeruimd)');
  assert(after.pools[cid].resources.find(r => r.id === otherMemberId)?.parentId === undefined, 'F7: een lid zonder ouder blijft ongemoeid (negatieve controle op over-brede opruiming)');
}

{
  const s = useAppStore.getState();
  useAppStore.setState((st) => { st.ui.libraryRefreshNotice = null; st.ui.showLibraryLinkDialog = false; });
  const cid = s.addCompany('Open BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'o', name: 'Ijzervlechter', type: 'LABOR', description: '', maxUnits: 2, costPerHour: 2 })!;
  const added = s.addLibraryResourceToProject(cid, resId);
  s.updatePoolResource(cid, resId, { costPerHour: 9 });
  const behindHash = computeResourceHash({ id: 'x', name: 'Ijzervlechter', type: 'LABOR', description: '', maxUnits: 2, costPerHour: 2 });
  useAppStore.setState((st) => {
    const r = st.resources.find(r => r.id === added.resourceId);
    if (r) { r.costPerHour = 2; r.libraryOrigin!.syncedHash = behindHash; }
  });
  const result = commitOpenBoundaryForTest();
  const copy = useAppStore.getState().resources.find(r => r.id === added.resourceId);
  assert(copy?.costPerHour === 9, 'grens 1 ververst een behind-item stil naar de poolwaarde');
  assert(result.deviated === 0, 'geen deviated-items in dit scenario');
  assert(useAppStore.getState().ui.libraryRefreshNotice === 1, 'grens 1: discreet signaal bij behind-refresh');
  assert(useAppStore.getState().ui.showLibraryLinkDialog === false, 'grens 1: dialoog blijft dicht bij alleen-behind');
}

{
  const s = useAppStore.getState();
  useAppStore.setState((st) => { st.ui.libraryRefreshNotice = null; st.ui.showLibraryLinkDialog = false; });
  const cid = s.addCompany('Devi BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'd', name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 3, costPerHour: 3 })!;
  const added = s.addLibraryResourceToProject(cid, resId);
  useAppStore.setState((st) => {
    const r = st.resources.find(r => r.id === added.resourceId);
    if (r) r.costPerHour = 5;
  });
  useAppStore.setState((st) => {
    const poolRes = st.pools[cid].resources.find(r => r.id === resId);
    if (poolRes) poolRes.costPerHour = 9;
  });
  const result = commitOpenBoundaryForTest();
  const copy = useAppStore.getState().resources.find(r => r.id === added.resourceId);
  assert(result.deviated === 1, 'grens 1: het lokaal bewerkte item classificeert als deviated');
  assert(useAppStore.getState().ui.showLibraryLinkDialog === true, 'grens 1: ≥1 deviated ⇒ afwijkingenscherm gaat open');
  assert(copy?.costPerHour === 5, 'grens 1: een deviated-item wordt NIET ververst — lokale waarde blijft staan');
}

{
  const s = useAppStore.getState();
  useAppStore.setState((st) => { st.ui.libraryRefreshNotice = null; st.ui.showLibraryLinkDialog = false; });
  const cid = s.addCompany('Weg BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'w', name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 1 })!;
  s.addLibraryResourceToProject(cid, resId);
  useAppStore.setState((st) => {
    const pool = st.pools[cid];
    pool.resources = pool.resources.filter(r => r.id !== resId);
  });
  const result = commitOpenBoundaryForTest();
  assert(result.removed === 1, 'grens 1: een verdwenen poolitem wordt geteld als removed');
  assert(result.deviated === 0, 'grens 1: removed is geen deviated');
  assert(useAppStore.getState().ui.showLibraryLinkDialog === false, 'grens 1: removed-only opent het afwijkingenscherm niet');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Rec BV');
  const poolResId = s.promoteResourceToPool(cid, { id: 'rc', name: 'Sloper', type: 'LABOR', description: '', maxUnits: 7, costPerHour: 5 })!;
  const syncedHash = computeResourceHash({ id: 'x', name: 'Sloper', type: 'LABOR', description: '', maxUnits: 3, costPerHour: 3 });
  s.restoreDocuments([{
    id: 'doc-rec',
    project: { ...useAppStore.getState().project, id: 'p-rec', companyId: cid, companyName: 'Rec BV' },
    calendar: useAppStore.getState().calendar,
    tasks: [], sequences: [],
    resources: [{ id: 'rr', name: 'Sloper', type: 'LABOR', description: '', maxUnits: 3, costPerHour: 3, libraryOrigin: { companyId: cid, libraryItemId: poolResId, poolVersion: 1, syncedHash } }],
    assignments: [], filePath: null, isDirty: false, datesAsRecorded: false,
  }], 'doc-rec');
  const copy = useAppStore.getState().resources.find(r => r.id === 'rr');
  assert(copy?.costPerHour === 5, 'grens 4 ververst een behind-kopie stil na herstel');
  assert(useAppStore.getState().ui.libraryRefreshNotice === 1, 'grens 4 publiceert de verversingstelling tijdens herstel');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Switch BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'sw', name: 'Schilder', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 1 })!;
  const added = s.addLibraryResourceToProject(cid, resId);
  const docA = useAppStore.getState().activeDocumentId;
  const docB = s.newDocument();
  s.updatePoolResource(cid, resId, { costPerHour: 6 });
  useAppStore.setState((st) => {
    const d = st.documents.find(d => d.id === docA);
    const r = d?.payload?.resources.find(r => r.id === added.resourceId);
    if (r) {
      r.costPerHour = 1;
      if (r.libraryOrigin) r.libraryOrigin.syncedHash = computeResourceHash(r);
    }
  });
  useAppStore.setState((st) => { st.ui.showLibraryLinkDialog = true; st.ui.libraryRefreshNotice = 42; });
  s.switchDocument(docA);
  const copy = useAppStore.getState().resources.find(r => r.id === added.resourceId);
  assert(copy?.costPerHour === 6, 'grens 2 ververst het geactiveerde document naar de poolwaarde (zelfhelend na pre-grens-3-drift)');
  assert(docB !== docA, 'twee documenten');
  assert(useAppStore.getState().ui.showLibraryLinkDialog === false, 'grens 2: documentwissel reset showLibraryLinkDialog — geen dialoog-trigger, geen stale true');
  assert(useAppStore.getState().ui.libraryRefreshNotice === 1, 'grens 2: libraryRefreshNotice reflecteert DEZE verversing (1), niet de stale 42');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Switch Stil BV');
  s.bindProjectToCompany(cid);
  const docA = useAppStore.getState().activeDocumentId;
  s.newDocument();
  useAppStore.setState((st) => { st.ui.showLibraryLinkDialog = true; st.ui.libraryRefreshNotice = 7; });
  s.switchDocument(docA);
  assert(useAppStore.getState().ui.showLibraryLinkDialog === false, 'grens 2 zonder behind-items: dialoog blijft/gaat dicht');
  assert(useAppStore.getState().ui.libraryRefreshNotice === null, 'grens 2 zonder behind-items: signaal reset naar null, geen stale getal');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Imp BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'im', name: 'Betonvlechter', type: 'LABOR', description: '', maxUnits: 2, costPerHour: 2 })!;
  const added = s.addLibraryResourceToProject(cid, resId);
  const imported = { ...useAppStore.getState().pools[cid], poolVersion: 99, modifiedAt: new Date().toISOString(),
    resources: [{ id: resId, name: 'Betonvlechter', type: 'LABOR' as const, description: '', maxUnits: 2, costPerHour: 12 }] };
  s.replacePool(cid, imported);
  const copy = useAppStore.getState().resources.find(r => r.id === added.resourceId);
  assert(copy?.costPerHour === 12, 'poolimport publiceert grens 1 meteen: behind-kopie volgt de nieuwe pool');
  assert(useAppStore.getState().ui.libraryRefreshNotice === 1, 'poolimport publiceert meteen de grens-1-telling');
}

{
  const componentSrc = PoolImportDialog.toString();
  const replaceIdx = componentSrc.indexOf('replacePool(');
  const boundaryIdx = componentSrc.indexOf('runOpenBoundary()');
  assert(replaceIdx >= 0 && boundaryIdx < 0, 'confirm-handler start geen tweede runOpenBoundary() na de atomaire poolimport');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Dev BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'dv', name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 4, costPerHour: 4 })!;
  const added = s.addLibraryResourceToProject(cid, resId);
  s.updatePoolResource(cid, resId, { costPerHour: 10 });
  useAppStore.setState((st) => {
    const r = st.resources.find(r => r.id === added.resourceId);
    if (r) r.costPerHour = 6;
  });
  s.resolveDeviation({ kind: 'resource', projectId: added.resourceId! }, 'company');
  assert(useAppStore.getState().resources.find(r => r.id === added.resourceId)?.costPerHour === 10, "resolveDeviation('company') neemt de poolwaarde");

  const res2 = s.promoteResourceToPool(cid, { id: 'dv2', name: 'Ijzerman', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 1 })!;
  const add2 = s.addLibraryResourceToProject(cid, res2);
  useAppStore.setState((st) => {
    const r = st.resources.find(r => r.id === add2.resourceId);
    if (r) r.costPerHour = 3;
  });
  s.resolveDeviation({ kind: 'resource', projectId: add2.resourceId! }, 'file');
  assert(useAppStore.getState().pools[cid].resources.find(r => r.id === res2)?.costPerHour === 3, "resolveDeviation('file') schrijft de bestandswaarde naar de pool");
  const resolved = useAppStore.getState().resources.find(r => r.id === add2.resourceId);
  assert(resolved?.libraryOrigin?.syncedHash === computeResourceHash(resolved!), "resolveDeviation('file') zet de verse syncedHash op het net-opgeloste item");
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('RedoStack BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'rs', name: 'Stukadoor', type: 'LABOR', description: '', maxUnits: 2 })!;
  const added = s.addLibraryResourceToProject(cid, resId);
  useAppStore.setState((st) => {
    const r = st.resources.find(r => r.id === added.resourceId);
    if (r) r.maxUnits = 5;
  });
  seedRedoEvent();
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'undone').length === 1, 'setup: redoStack heeft één (kunstmatige) entry');
  s.resolveDeviation({ kind: 'resource', projectId: added.resourceId! }, 'file');
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'undone').length === 0, "resolveDeviation('file') wist de redoStack (niet-undoable, GO-NA-fix)");
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Invariant BV');
  s.bindProjectToCompany(cid);
  useAppStore.setState((st) => { st.ui.showLibraryLinkDialog = true; st.ui.libraryRefreshNotice = 42; });
  const result = commitOpenBoundaryForTest();
  assert(result.deviated === 0 && result.refreshed === 0, 'invariant-setup: scenario heeft niets deviated/behind');
  assert(useAppStore.getState().ui.showLibraryLinkDialog === false, 'open-materializer wist showLibraryLinkDialog ook zónder deviated-items (universele vlagtoestand)');
  assert(useAppStore.getState().ui.libraryRefreshNotice === null, 'open-materializer wist libraryRefreshNotice ook zónder behind-items (universele vlagtoestand)');
}

{
  useAppStore.getState().unbindProject();
  useAppStore.setState((st) => { st.ui.showLibraryLinkDialog = true; st.ui.libraryRefreshNotice = 7; });
  const result = commitOpenBoundaryForTest();
  assert(result.deviated === 0 && result.refreshed === 0, 'invariant-setup: ongebonden project ⇒ geen mechaniek');
  assert(useAppStore.getState().ui.showLibraryLinkDialog === false, 'open-materializer (geen bedrijf) wist showLibraryLinkDialog');
  assert(useAppStore.getState().ui.libraryRefreshNotice === null, 'open-materializer (geen bedrijf) wist libraryRefreshNotice');
}

{
  useAppStore.setState((st) => { st.ui.showLibraryLinkDialog = true; st.ui.libraryRefreshNotice = 5; });
  useAppStore.getState().newDocument();
  assert(useAppStore.getState().ui.showLibraryLinkDialog === false, 'newDocument() reset showLibraryLinkDialog');
  assert(useAppStore.getState().ui.libraryRefreshNotice === null, 'newDocument() reset libraryRefreshNotice');
}

{
  useAppStore.setState((st) => { st.ui.showLibraryLinkDialog = true; st.ui.libraryRefreshNotice = 11; });
  useAppStore.getState().newProject();
  assert(useAppStore.getState().ui.showLibraryLinkDialog === false, 'newProject() reset showLibraryLinkDialog');
  assert(useAppStore.getState().ui.libraryRefreshNotice === null, 'newProject() reset libraryRefreshNotice');
}

{
  const s0 = useAppStore.getState();
  assert(
    s0.tasks.length === 0 && s0.sequences.length === 0 && s0.resources.length === 0 && s0.filePath === null && !s0.isDirty,
    'invariant-setup: actief tabblad is pristine (createNewProject neemt het hergebruikpad)',
  );
  useAppStore.setState((st) => { st.ui.showLibraryLinkDialog = true; st.ui.libraryRefreshNotice = 6; });
  useAppStore.getState().createNewProject({
    name: 'Wizard-project', startDate: '2026-01-01', phaseNames: [],
    calendar: {
      id: 'wiz-cal', name: 'Wizardkalender', description: '',
      workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
    },
  });
  assert(useAppStore.getState().ui.showLibraryLinkDialog === false, 'createNewProject() (pristine-hergebruikpad) reset showLibraryLinkDialog');
  assert(useAppStore.getState().ui.libraryRefreshNotice === null, 'createNewProject() (pristine-hergebruikpad) reset libraryRefreshNotice');
}

{
  const active = useAppStore.getState().activeDocumentId;
  for (const id of useAppStore.getState().documents.map((d) => d.id)) {
    if (id !== active) useAppStore.getState().closeDocument(id);
  }
  assert(useAppStore.getState().documents.length === 1, 'invariant-setup: nog maar één document open');
  useAppStore.setState((st) => { st.ui.showLibraryLinkDialog = true; st.ui.libraryRefreshNotice = 9; });
  useAppStore.getState().closeDocument(useAppStore.getState().activeDocumentId);
  assert(useAppStore.getState().ui.showLibraryLinkDialog === false, 'closeDocument() laatste-sluit-naar-leeg-tak reset showLibraryLinkDialog');
  assert(useAppStore.getState().ui.libraryRefreshNotice === null, 'closeDocument() laatste-sluit-naar-leeg-tak reset libraryRefreshNotice');
}

{
  const store = createAppStore();
  const S = () => store.getState();
  const cid = S().addCompany('Bouwbedrijf Oud');
  const other = S().addCompany('Ander Bedrijf');
  S().bindProjectToCompany(cid);
  S().addTask({ name: 'x' });
  const docA = S().activeDocumentId;
  S().newDocument();
  S().bindProjectToCompany(other);
  const docOther = S().activeDocumentId;
  S().newDocument();
  S().bindProjectToCompany(cid);
  const docB = S().activeDocumentId;
  S().switchDocument(docA);
  const dirtyBefore = S().isDirty;
  const undoBefore = S().historyEvents.length;

  S().renameCompany(cid, 'Bouwbedrijf Nieuw');
  const after = S();
  assert(after.project.companyName === 'Bouwbedrijf Nieuw', 'R10: renameCompany werkt companyName van het actieve gekoppelde document bij');
  assert(after.documents.find(d => d.id === docB)?.payload?.project.companyName === 'Bouwbedrijf Nieuw', 'R10: …en van een slapend gekoppeld document');
  assert(after.documents.find(d => d.id === docOther)?.payload?.project.companyName === 'Ander Bedrijf', 'R10: een document van een andere bibliotheek blijft ongemoeid');
  assert(/'CompanyName',\$,IFCTEXT\('Bouwbedrijf Nieuw'\)/.test(writeIFC(buildWriteIFCInput(after, 'planOnly'))), 'R10: opslaan schrijft de nieuwe bibliotheeknaam in de IFC');
  assert(after.isDirty === dirtyBefore && after.historyEvents.length === undoBefore, 'R10: zoals removeCompany: geen undo-stap en geen isDirty');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Weg BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'w', name: 'Sloopman', type: 'LABOR', description: '', maxUnits: 1 })!;
  const added = s.addLibraryResourceToProject(cid, resId);
  const affected = s.countDocumentsLinkedTo(cid);
  assert(affected >= 1, 'countDocumentsLinkedTo telt het actieve document');
  s.removeCompany(cid);
  const after = useAppStore.getState();
  assert(after.project.companyId === undefined, 'removeCompany ontkoppelt het actieve document');
  assert(after.project.companyName === undefined, 'removeCompany wist ook companyName van het actieve document');
  assert(after.resources.find(r => r.id === added.resourceId)?.libraryOrigin === undefined, 'removeCompany stript de stempels van open documenten');
  assert(after.companies.every(c => c.id !== cid), 'removeCompany verwijdert het bedrijf zelf');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Reset BV');
  s.bindProjectToCompany(cid);
  useAppStore.setState((st) => { st.ui.showLibraryLinkDialog = true; st.ui.libraryRefreshNotice = 3; });
  assert(useAppStore.getState().ui.showLibraryLinkDialog === true, 'invariant-setup: showLibraryLinkDialog staat aan vóór removeCompany');
  assert(useAppStore.getState().ui.libraryRefreshNotice === 3, 'invariant-setup: libraryRefreshNotice staat aan vóór removeCompany');
  useAppStore.getState().removeCompany(cid);
  assert(useAppStore.getState().ui.showLibraryLinkDialog === false, 'removeCompany (actief bedrijf) reset showLibraryLinkDialog');
  assert(useAppStore.getState().ui.libraryRefreshNotice === null, 'removeCompany (actief bedrijf) reset libraryRefreshNotice');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Weg Dormant BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'wd', name: 'Stukadoor', type: 'LABOR', description: '', maxUnits: 1 })!;
  const added = s.addLibraryResourceToProject(cid, resId);
  const dormantId = useAppStore.getState().activeDocumentId;
  s.newDocument();
  assert(useAppStore.getState().project.companyId === undefined, 'invariant-setup: het nieuwe actieve document is ongebonden');
  assert(useAppStore.getState().countDocumentsLinkedTo(cid) === 1, 'countDocumentsLinkedTo telt een SLAPEND gekoppeld document (los van het actieve)');

  useAppStore.getState().removeCompany(cid);
  const dormant = useAppStore.getState().documents.find(d => d.id === dormantId);
  assert(dormant?.payload?.project.companyId === undefined, 'removeCompany ontkoppelt een SLAPEND document (companyId)');
  assert(dormant?.payload?.project.companyName === undefined, 'removeCompany ontkoppelt een SLAPEND document (companyName)');
  assert(dormant?.payload?.resources.find(r => r.id === added.resourceId)?.libraryOrigin === undefined, 'removeCompany stript stempels in een SLAPENDE document-payload');
  assert(useAppStore.getState().countDocumentsLinkedTo(cid) === 0, 'na removeCompany telt geen enkel document nog mee als gekoppeld aan het verwijderde bedrijf');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Load BV');
  const poolResId = s.promoteResourceToPool(cid, { id: 'ld', name: 'Betontimmerman', type: 'LABOR', description: '', maxUnits: 2 })!;
  const stampedProject = { ...useAppStore.getState().project, id: 'p-load', companyId: cid, companyName: 'Load BV' };
  const stampedRes = { id: 'lr', name: 'Betontimmerman', type: 'LABOR' as const, description: '', maxUnits: 2,
    libraryOrigin: { companyId: cid, libraryItemId: poolResId, poolVersion: 1, syncedHash: 'x' } };
  useAppStore.getState().loadState({
    project: stampedProject, calendar: useAppStore.getState().calendar,
    tasks: [], sequences: [], resources: [stampedRes], assignments: [], resourceCalendars: [],
  } as never);
  const after = useAppStore.getState();
  assert(after.project.companyId === undefined, 'loadState: gestempeld project wordt LOS geladen (companyId gestript)');
  assert(after.resources.every(r => r.libraryOrigin === undefined), 'loadState: alle libraryOrigin-stempels gestript');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Open BV');
  const poolResId = s.promoteResourceToPool(cid, { id: 'op', name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 3 })!;
  const stampedProject = { ...useAppStore.getState().project, id: 'p-open', companyId: cid, companyName: 'Open BV' };
  const stampedRes = { id: 'or', name: 'Metselaar', type: 'LABOR' as const, description: '', maxUnits: 3,
    libraryOrigin: { companyId: cid, libraryItemId: poolResId, poolVersion: 1, syncedHash: 'y' } };
  useAppStore.getState().applyLoadedProject({
    project: stampedProject, calendar: useAppStore.getState().calendar,
    tasks: [], sequences: [], resources: [stampedRes], assignments: [],
  } as never, { linkedOpen: true });
  const after = useAppStore.getState();
  assert(after.project.companyId === cid, 'applyLoadedProject(linkedOpen: true): companyId BLIJFT staan (openFile/openRecentFile-route)');
  assert(after.project.companyName === 'Open BV', 'applyLoadedProject(linkedOpen: true): companyName BLIJFT staan');
  assert(after.resources.find(r => r.id === 'or')?.libraryOrigin?.companyId === cid, 'applyLoadedProject(linkedOpen: true): libraryOrigin-stempel BLIJFT intact');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Unlink BV');
  s.bindProjectToCompany(cid);
  const resIdA = s.promoteResourceToPool(cid, { id: 'ul-a', name: 'Kraanmachinist', type: 'LABOR', description: '', maxUnits: 1 })!;
  const resIdB = s.promoteResourceToPool(cid, { id: 'ul-b', name: 'Grondwerker', type: 'LABOR', description: '', maxUnits: 1 })!;
  const addA = useAppStore.getState().addLibraryResourceToProject(cid, resIdA);
  const addB = useAppStore.getState().addLibraryResourceToProject(cid, resIdB);
  assert(!!useAppStore.getState().resources.find(r => r.id === addA.resourceId)?.libraryOrigin, 'setup: A gestempeld');
  assert(!!useAppStore.getState().resources.find(r => r.id === addB.resourceId)?.libraryOrigin, 'setup: B gestempeld');

  const undoBefore = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  useAppStore.getState().unlinkResourceFromLibrary(addA.resourceId!);
  const afterUnlink = useAppStore.getState();
  assert(afterUnlink.resources.find(r => r.id === addA.resourceId)?.libraryOrigin === undefined, 'unlinkResourceFromLibrary: stempel van A weg');
  assert(!!afterUnlink.resources.find(r => r.id === addB.resourceId)?.libraryOrigin, 'unlinkResourceFromLibrary: stempel van B blijft (raakt precies ÉÉN item)');
  assert(afterUnlink.resources.some(r => r.id === addA.resourceId), 'unlinkResourceFromLibrary: resource zelf blijft in het project staan');
  assert(afterUnlink.historyEvents.filter(event => event.state === 'applied').length === undoBefore + 1, 'unlinkResourceFromLibrary: undoable (undo-snapshot gepusht)');

  useAppStore.getState().undo();
  assert(!!useAppStore.getState().resources.find(r => r.id === addA.resourceId)?.libraryOrigin, 'undo van unlinkResourceFromLibrary: stempel van A terug');
  useAppStore.getState().redo();
  assert(useAppStore.getState().resources.find(r => r.id === addA.resourceId)?.libraryOrigin === undefined, 'redo van unlinkResourceFromLibrary: stempel weer weg');
  useAppStore.getState().undo();

  const undoBeforeNoop = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  useAppStore.getState().unlinkResourceFromLibrary('ghost-resource-id');
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoBeforeNoop, 'unlinkResourceFromLibrary: onbekend id is een no-op (geen loze undo-stap)');

  const plainResId = useAppStore.getState().addResource({ name: 'Projecteigen', type: 'LABOR', description: '', maxUnits: 1 });
  const undoBeforeNoop2 = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  useAppStore.getState().unlinkResourceFromLibrary(plainResId);
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoBeforeNoop2, 'unlinkResourceFromLibrary: resource zonder stempel is een no-op (geen loze undo-stap)');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('F4 BV');
  s.bindProjectToCompany(cid);
  const calId = s.promoteCalendarToPool(cid, {
    id: 'f4-cal', name: 'Dagploeg', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  })!;
  const resId = s.promoteResourceToPool(cid, { id: 'f4-res', name: 'Stellingbouwer', type: 'LABOR', description: '', maxUnits: 1 })!;
  s.updatePoolResource(cid, resId, { calendarId: calId });

  const added = useAppStore.getState().addLibraryResourceToProject(cid, resId);
  const travelingCalId = useAppStore.getState().resources.find(r => r.id === added.resourceId)!.calendarId!;
  assert(!!useAppStore.getState().calendars.find(c => c.id === travelingCalId)?.libraryOrigin, 'setup: de meegereisde kalender is gestempeld');

  const undoBefore = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  useAppStore.getState().unlinkResourceFromLibrary(added.resourceId!);
  assert(useAppStore.getState().resources.find(r => r.id === added.resourceId)?.libraryOrigin === undefined, 'F4: resource-stempel weg');
  assert(useAppStore.getState().calendars.find(c => c.id === travelingCalId)?.libraryOrigin === undefined, "F4 (solo): meegereisde kalender-stempel OOK weg — geen andere resource volgt 'm meer");
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoBefore + 1, 'F4: nog steeds ÉÉN undo-snapshot (zelfde transactie, geen extra stap)');
  useAppStore.getState().undo();
  assert(!!useAppStore.getState().calendars.find(c => c.id === travelingCalId)?.libraryOrigin, 'F4: undo zet OOK de kalenderstempel terug (zelfde transactie)');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('F4b BV');
  s.bindProjectToCompany(cid);
  const calId = s.promoteCalendarToPool(cid, {
    id: 'f4b-cal', name: 'Nachtploeg', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 22, workEndHour: 6, hoursPerDay: 8, holidays: [],
  })!;
  const resId1 = s.promoteResourceToPool(cid, { id: 'f4b-res', name: 'Isolatiemonteur', type: 'LABOR', description: '', maxUnits: 1 })!;
  s.updatePoolResource(cid, resId1, { calendarId: calId });
  const resId2 = s.promoteResourceToPool(cid, { id: 'f4b-res2', name: 'Buddy', type: 'LABOR', description: '', maxUnits: 1 })!;
  s.updatePoolResource(cid, resId2, { calendarId: calId });

  const added1 = useAppStore.getState().addLibraryResourceToProject(cid, resId1);
  const added2 = useAppStore.getState().addLibraryResourceToProject(cid, resId2);
  const proj1 = useAppStore.getState().resources.find(r => r.id === added1.resourceId)!;
  const proj2 = useAppStore.getState().resources.find(r => r.id === added2.resourceId)!;
  assert(proj1.calendarId === proj2.calendarId && !!proj1.calendarId, 'setup: beide resources delen dezelfde meegereisde kalendercopy (dedup op herkomst)');
  const sharedCalId = proj1.calendarId!;

  useAppStore.getState().unlinkResourceFromLibrary(added1.resourceId!);
  assert(useAppStore.getState().resources.find(r => r.id === added1.resourceId)?.libraryOrigin === undefined, 'F4 (gedeeld): resource 1 losgemaakt');
  assert(!!useAppStore.getState().calendars.find(c => c.id === sharedCalId)?.libraryOrigin, "F4 (gedeeld): kalenderstempel BLIJFT staan — resource 2 volgt 'm nog (negatieve controle op de stillFollowed-guard)");

  useAppStore.getState().unlinkResourceFromLibrary(added2.resourceId!);
  assert(useAppStore.getState().calendars.find(c => c.id === sharedCalId)?.libraryOrigin === undefined, 'F4 (gedeeld, vervolg): nu ook resource 2 losgemaakt ⇒ kalenderstempel gaat alsnog mee');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('F5 BV');
  s.bindProjectToCompany(cid);
  const resId = s.promoteResourceToPool(cid, { id: 'f5-res', name: 'Wees', type: 'LABOR', description: '', maxUnits: 1 })!;
  const added = s.addLibraryResourceToProject(cid, resId);
  s.removePoolResource(cid, resId);
  assert(useAppStore.getState().onOpenStatusForResource(added.resourceId!) === 'removed', "setup: status is 'removed' (wees) ⇒ locked zou hier al false zijn");
  assert(!!useAppStore.getState().resources.find(r => r.id === added.resourceId)?.libraryOrigin, 'setup: de wees draagt nog altijd een (dode) stempel');
  useAppStore.getState().unlinkResourceFromLibrary(added.resourceId!);
  assert(useAppStore.getState().resources.find(r => r.id === added.resourceId)?.libraryOrigin === undefined, "F5: unlink werkt OOK op een 'removed'-wees");
}

{
  const s = useAppStore.getState();
  const cidA = s.addCompany('F5f A');
  const cidB = s.addCompany('F5f B');
  s.bindProjectToCompany(cidB);
  const foreignResId = s.addResource({ name: 'Vreemdeling', type: 'LABOR', description: '', maxUnits: 1 });
  seedRedoEvent();
  useAppStore.setState((st) => {
    const r = st.resources.find(r => r.id === foreignResId);
    if (r) r.libraryOrigin = { companyId: cidA, libraryItemId: 'ghost', poolVersion: 1 };
  });
  assert(useAppStore.getState().onOpenStatusForResource(foreignResId) === null, 'setup: §2-scope ⇒ null voor een stempel van een ander bedrijf dan het gekoppelde');
  assert(!!useAppStore.getState().resources.find(r => r.id === foreignResId)?.libraryOrigin, 'setup: de resource draagt wél een (onzichtbare) stempel');
  useAppStore.getState().unlinkResourceFromLibrary(foreignResId);
  assert(useAppStore.getState().resources.find(r => r.id === foreignResId)?.libraryOrigin === undefined, 'F5: unlink werkt OOK op een stempel van een ander bedrijf dan het gekoppelde');
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('F8 BV');
  s.bindProjectToCompany(cid);
  s.promoteResourceToPool(cid, { id: 'f8-pool', name: 'Overlap', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 20 });

  const sameProjResId = s.addResource({ name: 'Overlap', type: 'LABOR', description: '', maxUnits: 9, costPerHour: 20 });
  const sameProjRes = useAppStore.getState().resources.find(r => r.id === sameProjResId)!;
  useAppStore.getState().promoteResourceToPool(cid, sameProjRes, { dedupByName: true });
  assert(useAppStore.getState().onOpenStatusForResource(sameProjResId) === 'in-sync', 'F8: dedup-koppeling aan een inhoudelijk GELIJK poolitem ⇒ in-sync');

  const diffProjResId = s.addResource({ name: 'Overlap', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 99 });
  const diffProjRes = useAppStore.getState().resources.find(r => r.id === diffProjResId)!;
  useAppStore.getState().promoteResourceToPool(cid, diffProjRes, { dedupByName: true });
  assert(useAppStore.getState().onOpenStatusForResource(diffProjResId) === 'deviated', 'F8: dedup-koppeling aan een inhoudelijk AFWIJKEND poolitem ⇒ meteen deviated — de UI-notice moet dit eerlijk melden, geen kale succesmelding');
}

{
  assert(isResourceFieldLocked(null) === false, 'isResourceFieldLocked(null): geen eigen-bedrijf-stempel ⇒ bewerkbaar');
  assert(isResourceFieldLocked('unbound') === false, "isResourceFieldLocked('unbound'): stempel-loos ⇒ bewerkbaar");
  assert(isResourceFieldLocked('removed') === false, "isResourceFieldLocked('removed'): poolorigineel weg ⇒ wees, blijft bewerkbaar");
  assert(isResourceFieldLocked('in-sync') === true, "isResourceFieldLocked('in-sync'): geldige herkomst ⇒ locked");
  assert(isResourceFieldLocked('behind') === true, "isResourceFieldLocked('behind'): geldige herkomst ⇒ locked");
  assert(isResourceFieldLocked('deviated') === true, "isResourceFieldLocked('deviated'): geldige herkomst ⇒ locked");
}

{
  const s = useAppStore.getState();
  const cid = s.addCompany('Promote BV');
  s.bindProjectToCompany(cid);

  const otherResId = s.addResource({ name: 'Ongerelateerd', type: 'LABOR', description: '', maxUnits: 1 });
  const projResId = s.addResource({ name: 'Elektricien Piet', type: 'LABOR', description: '', maxUnits: 2 });
  const projRes = useAppStore.getState().resources.find(r => r.id === projResId)!;
  const poolCountBefore = useAppStore.getState().pools[cid].resources.length;
  const undoBefore = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;

  const poolId = useAppStore.getState().promoteResourceToPool(cid, projRes, { dedupByName: true });
  const after = useAppStore.getState();
  assert(!!poolId && after.pools[cid].resources.length === poolCountBefore + 1, 'promoteResourceToPool: precies één nieuw poolitem');
  assert(after.pools[cid].resources.find(r => r.id === poolId)?.name === 'Elektricien Piet', 'promoteResourceToPool: het nieuwe poolitem draagt de juiste naam');
  assert(after.resources.find(r => r.id === projResId)?.libraryOrigin?.libraryItemId === poolId, 'promoteResourceToPool: het bronitem is gestempeld naar het nieuwe poolitem');
  assert(after.resources.find(r => r.id === otherResId)?.libraryOrigin === undefined, 'promoteResourceToPool: het ONGERELATEERDE item blijft ongemoeid');
  assert(after.historyEvents.filter(event => event.state === 'applied').length === undoBefore + 1, 'promoteResourceToPool: undoable (undo-snapshot gepusht)');
  assert(isResourceFieldLocked(useAppStore.getState().onOpenStatusForResource(projResId)) === true, 'promoteResourceToPool: het bronitem is meteen geërfd/locked (in-sync met de pool die het zelf net gevoed heeft)');

  useAppStore.getState().undo();
  assert(useAppStore.getState().resources.find(r => r.id === projResId)?.libraryOrigin === undefined, 'undo van promoteResourceToPool: stempel weer weg (poolkopie blijft staan, zelfde bekende gedrag als promote-kalenders)');
  assert(useAppStore.getState().pools[cid].resources.some(r => r.id === poolId), 'undo van promoteResourceToPool: de poolkopie zelf blijft staan (pool is app-globaal, niet undo-beschermd) — dus meteen bruikbaar als dedup-doel hieronder, ook al is projResId zelf weer stempel-loos');

  const dupProjResId = s.addResource({ name: '  elektricien piet  ', type: 'LABOR', description: '', maxUnits: 5 });
  const dupProjRes = useAppStore.getState().resources.find(r => r.id === dupProjResId)!;
  const poolCountBeforeDup = useAppStore.getState().pools[cid].resources.length;
  const dupPoolId = useAppStore.getState().promoteResourceToPool(cid, dupProjRes, { dedupByName: true });
  const afterDup = useAppStore.getState();
  assert(dupPoolId === poolId, 'promoteResourceToPool (dedup): retourneert de BESTAANDE pool-item-id, geen nieuwe');
  assert(afterDup.pools[cid].resources.length === poolCountBeforeDup, 'promoteResourceToPool (dedup): GEEN duplicaat-poolitem gepusht');
  assert(afterDup.resources.find(r => r.id === dupProjResId)?.libraryOrigin?.libraryItemId === poolId, 'promoteResourceToPool (dedup): het tweede bronitem koppelt aan hetzelfde bestaande poolitem');

  const undoBeforeAlready = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  const againId = useAppStore.getState().promoteResourceToPool(cid, useAppStore.getState().resources.find(r => r.id === dupProjResId)!, { dedupByName: true });
  assert(againId === null, 'promoteResourceToPool op een AL gestempeld item: retourneert null (F8, geen suggestie van een geslaagde koppeling)');
  assert(useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length === undoBeforeAlready, 'promoteResourceToPool op een AL gestempeld item: no-op (geen loze undo-stap, geen doublestamp)');
  assert(useAppStore.getState().pools[cid].resources.length === poolCountBeforeDup, 'promoteResourceToPool op een AL gestempeld item: geen extra poolitem');

  const ghostRes = { id: 'ghost-res', name: 'Spookresource', type: 'LABOR' as const, description: '', maxUnits: 1 };
  assert(useAppStore.getState().promoteResourceToPool('ghost-company', ghostRes, { dedupByName: true }) === null, 'promoteResourceToPool: null bij onbestaand bedrijf (los-project-equivalent — geen pool, dus niets te doen)');

  const thirdResId = s.addResource({ name: 'Elektricien Piet', type: 'LABOR', description: '', maxUnits: 1 });
  const thirdRes = useAppStore.getState().resources.find(r => r.id === thirdResId)!;
  const poolCountBeforeThird = useAppStore.getState().pools[cid].resources.length;
  const thirdPoolId = useAppStore.getState().promoteResourceToPool(cid, thirdRes);
  assert(thirdPoolId !== null && thirdPoolId !== poolId, 'promoteResourceToPool ZONDER dedupByName: nieuw poolitem, ook bij een naam-collision (oud gedrag intact)');
  assert(useAppStore.getState().pools[cid].resources.length === poolCountBeforeThird + 1, 'promoteResourceToPool ZONDER dedupByName: pusht wél een extra poolitem (negatieve controle op de opt-in-vlag)');
}

{
  const beforeCompanies = useAppStore.getState().companies.map(c => ({ ...c }));
  const beforePoolRefs = Object.fromEntries(Object.entries(useAppStore.getState().pools));
  const freshPool = {
    companyId: 'shared-fresh-co', companyName: 'Onderaannemer Fresh',
    poolVersion: 4, modifiedAt: '2026-01-01T00:00:00.000Z',
    calendars: [], resources: [{ id: 'fresh-res-1', name: 'Freskraan', type: 'EQUIPMENT' as const, description: '', maxUnits: 1 }],
  };
  const newId = useAppStore.getState().importPoolAsNewCompany(freshPool);
  assert(newId === 'shared-fresh-co', 'importPoolAsNewCompany: een vrij companyId uit het bestand wordt behouden');
  const afterA = useAppStore.getState();
  assert(afterA.companies.some(c => c.id === 'shared-fresh-co' && c.name === 'Onderaannemer Fresh'), 'importPoolAsNewCompany: nieuw bedrijf aangemaakt met de bestandsnaam');
  assert(afterA.pools['shared-fresh-co']?.resources.length === 1 && afterA.pools['shared-fresh-co'].resources[0].id === 'fresh-res-1', 'importPoolAsNewCompany: de nieuwe pool draagt de bestandsinhoud');
  assert(afterA.pools['shared-fresh-co']?.companyName === 'Onderaannemer Fresh', 'importPoolAsNewCompany: pool.companyName volgt de (hier ongewijzigde) naam');
  for (const c of beforeCompanies) {
    const stillThere = afterA.companies.find(x => x.id === c.id);
    assert(!!stillThere && stillThere.name === c.name, `importPoolAsNewCompany: bestaand bedrijf ${c.id} blijft ongemoeid`);
  }
  for (const [k, ref] of Object.entries(beforePoolRefs)) {
    assert(afterA.pools[k] === ref, `importPoolAsNewCompany: bestaande pool ${k} blijft referentieel ongewijzigd (geen mutatie)`);
  }

  const cidExisting = useAppStore.getState().defaultCompanyId;
  const existingPoolBefore = useAppStore.getState().pools[cidExisting];
  const collidingPool = {
    companyId: cidExisting, companyName: 'Zelfde-id-als-bestaand',
    poolVersion: 7, modifiedAt: '2026-02-02T00:00:00.000Z',
    calendars: [], resources: [{ id: 'collide-res-1', name: 'Botsresource', type: 'LABOR' as const, description: '', maxUnits: 1 }],
  };
  const collidedId = useAppStore.getState().importPoolAsNewCompany(collidingPool);
  const afterB = useAppStore.getState();
  assert(collidedId !== cidExisting, 'importPoolAsNewCompany: een botsend companyId leidt NIET tot hergebruik van het bestaande id');
  assert(afterB.companies.some(c => c.id === collidedId), 'importPoolAsNewCompany: het verse id staat als bedrijf geregistreerd');
  assert(afterB.pools[collidedId]?.resources[0]?.id === 'collide-res-1', 'importPoolAsNewCompany: de nieuwe pool draagt de bestandsinhoud onder het VERSE id (kopie naast de bestaande)');
  assert(afterB.pools[cidExisting] === existingPoolBefore, 'importPoolAsNewCompany: de BESTAANDE bibliotheek (zelfde companyId in het bestand) blijft volledig intact');

  const dupNamePool = { companyId: 'shared-dup-name-co', companyName: 'Onderaannemer Fresh', poolVersion: 1, modifiedAt: '2026-03-03T00:00:00.000Z', calendars: [], resources: [] };
  useAppStore.getState().importPoolAsNewCompany(dupNamePool);
  const afterC = useAppStore.getState();
  const dupCompany = afterC.companies.find(c => c.id === 'shared-dup-name-co');
  assert(dupCompany?.name === 'Onderaannemer Fresh (2)', 'importPoolAsNewCompany: naamsbotsing krijgt een onderscheidend " (2)"-achtervoegsel');
  assert(afterC.pools['shared-dup-name-co']?.companyName === 'Onderaannemer Fresh (2)', 'importPoolAsNewCompany: pool.companyName volgt de gededupliceerde naam');
  const dupNamePool2 = { companyId: 'shared-dup-name-co-2', companyName: 'Onderaannemer Fresh', poolVersion: 1, modifiedAt: '2026-03-04T00:00:00.000Z', calendars: [], resources: [] };
  useAppStore.getState().importPoolAsNewCompany(dupNamePool2);
  assert(useAppStore.getState().companies.find(c => c.id === 'shared-dup-name-co-2')?.name === 'Onderaannemer Fresh (3)', 'importPoolAsNewCompany: een DERDE gelijknamige import telt door naar " (3)"');

  const replaceTargetId = useAppStore.getState().addCompany('Vervang-doel BV');
  const replaceInput = { companyId: 'volstrekt-ander-id', companyName: 'Vreemde naam', poolVersion: 2, modifiedAt: '2026-05-05T00:00:00.000Z', calendars: [], resources: [] };
  useAppStore.getState().replacePool(replaceTargetId, replaceInput);
  assert(useAppStore.getState().pools[replaceTargetId]?.companyId === replaceTargetId, 'replacePool (ongewijzigd gedrag): herschrijft companyId naar het DOELbedrijf, ook nu importPoolAsNewCompany bestaat');

  const shareCompanyId = 'shared-co-echo-9';
  const sharedResourceInPool = { id: 'shared-res-echo', name: 'Gedeelde Vakman', type: 'LABOR' as const, description: '', maxUnits: 2, costPerHour: 3 };
  const sharedPool = {
    companyId: shareCompanyId, companyName: 'Collega BV', poolVersion: 5,
    modifiedAt: '2026-04-04T00:00:00.000Z', calendars: [], resources: [sharedResourceInPool],
  };
  useAppStore.getState().newProject();
  const sharedResId = useAppStore.getState().addResource({ name: 'Gedeelde Vakman', type: 'LABOR', description: '', maxUnits: 2, costPerHour: 3 });
  useAppStore.setState((st) => {
    st.project.companyId = shareCompanyId;
    const r = st.resources.find(r => r.id === sharedResId)!;
    r.libraryOrigin = {
      companyId: shareCompanyId, libraryItemId: 'shared-res-echo', poolVersion: 5,
      syncedHash: computeResourceHash(sharedResourceInPool),
    };
  });
  assert(useAppStore.getState().onOpenStatusForResource(sharedResId) === null, 'deel-scenario: vóór import bestaat het bedrijf lokaal niet ⇒ los-gedrag (null)');

  const importedShareId = useAppStore.getState().importPoolAsNewCompany(sharedPool);
  assert(importedShareId === shareCompanyId, 'deel-scenario: het companyId uit het bestand is behouden (was lokaal vrij) — de sleutel tot herkenning');

  const statusAfterShare = useAppStore.getState().onOpenStatusForResource(sharedResId);
  assert(statusAfterShare !== null, 'deel-scenario [DE FIX]: het project herkent zijn item als gekoppeld zodra de bibliotheek (met behoud van companyId) geïmporteerd is');
  assert(statusAfterShare === 'in-sync', 'deel-scenario: de getrackte velden matchen nog exact ⇒ in-sync (geen valse afwijkingsvraag)');
  assert(useAppStore.getState().diffProjectResource(sharedResId)?.status === 'up-to-date', 'deel-scenario: diffProjectResource bevestigt up-to-date via het echte (geïmporteerde) poolitem');
}

{
  const defaultId = useAppStore.getState().defaultCompanyId;
  assert(defaultId === DEFAULT_COMPANY_ID, 'setup F1(a): defaultCompanyId is de reserved DEFAULT_COMPANY_ID (typisch voor een verse installatie)');
  const defaultPoolBefore = useAppStore.getState().pools[defaultId];
  const poolWithDefaultId = {
    companyId: DEFAULT_COMPANY_ID, companyName: 'Kaping via standaard-id',
    poolVersion: 9, modifiedAt: '2026-06-06T00:00:00.000Z', calendars: [],
    resources: [{ id: 'kaping-res-1', name: 'Kaper', type: 'LABOR' as const, description: '', maxUnits: 1 }],
  };
  const kapingId = useAppStore.getState().importPoolAsNewCompany(poolWithDefaultId);
  assert(kapingId !== DEFAULT_COMPANY_ID, 'F1(a): importPoolAsNewCompany mint een VERS id voor een bestand met DEFAULT_COMPANY_ID, behoudt het nooit');
  assert(useAppStore.getState().pools[defaultId] === defaultPoolBefore, 'F1(a): de bestaande standaardbibliotheek blijft byte-voor-byte intact (referentiegelijk)');
  assert(useAppStore.getState().pools[kapingId]?.resources[0]?.id === 'kaping-res-1', 'F1(a): de nieuwe bibliotheek staat onder het VERSE id, met de bestandsinhoud');

  assert(!useAppStore.getState().companies.some(c => c.id === DEMO_COMPANY_ID), 'setup F1(b): de echte demo-bibliotheek bestaat nog niet');
  const poolWithDemoId = {
    companyId: DEMO_COMPANY_ID, companyName: 'Kaping via demo-id',
    poolVersion: 3, modifiedAt: '2026-06-07T00:00:00.000Z', calendars: [],
    resources: [{ id: 'kaping-demo-res-1', name: 'Kaper Demo', type: 'LABOR' as const, description: '', maxUnits: 1 }],
  };
  const kapingDemoId = useAppStore.getState().importPoolAsNewCompany(poolWithDemoId);
  assert(kapingDemoId !== DEMO_COMPANY_ID, 'F1(b): importPoolAsNewCompany mint een VERS id voor een bestand met DEMO_COMPANY_ID, behoudt het nooit');
  assert(!useAppStore.getState().companies.some(c => c.id === DEMO_COMPANY_ID), 'F1(b): DEMO_COMPANY_ID blijft VRIJ na de import (nog niet gekaapt)');

  const realDemoId = useAppStore.getState().seedDemoLibrary();
  assert(realDemoId === DEMO_COMPANY_ID, 'F1(b) [DE FIX]: seedDemoLibrary() kan de ECHTE demo-bibliotheek nog steeds aanmaken (niet permanent gekaapt door de eerdere import)');
  assert(useAppStore.getState().companies.find(c => c.id === DEMO_COMPANY_ID)?.name !== 'Kaping via demo-id', 'F1(b): de ECHTE demo-bibliotheek draagt de echte demo-naam, niet de gekaapte naam');
  assert(useAppStore.getState().pools[kapingDemoId]?.resources[0]?.id === 'kaping-demo-res-1', 'F1(b): de eerder geïmporteerde bibliotheek (vers id) blijft naast de echte demo-bibliotheek gewoon bestaan');
}

{
  const hostileIds = ['__proto__', 'constructor', ' ', '​'];
  for (const hostileId of hostileIds) {
    const beforeCount = useAppStore.getState().companies.length;
    let threw = false;
    let newId = '';
    try {
      newId = useAppStore.getState().importPoolAsNewCompany({
        companyId: hostileId, companyName: `Vijandig ${JSON.stringify(hostileId)}`,
        poolVersion: 1, modifiedAt: '2026-06-08T00:00:00.000Z', calendars: [],
        resources: [{ id: 'hostile-res', name: 'Hostile', type: 'LABOR' as const, description: '', maxUnits: 1 }],
      });
    } catch { threw = true; }
    assert(!threw, `importPoolAsNewCompany [F2]: vijandig id ${JSON.stringify(hostileId)} gooit niet`);
    assert(!!newId && newId !== hostileId, `importPoolAsNewCompany [F2]: vijandig id ${JSON.stringify(hostileId)} krijgt een VERS, veilig id`);
    assert(useAppStore.getState().companies.length === beforeCount + 1, `importPoolAsNewCompany [F2]: precies één nieuw bedrijf voor ${JSON.stringify(hostileId)}`);
    assert(useAppStore.getState().pools[newId]?.resources[0]?.id === 'hostile-res', `importPoolAsNewCompany [F2]: de nieuwe bibliotheek voor ${JSON.stringify(hostileId)} draagt de bestandsinhoud`);
  }
}

{
  useAppStore.getState().newProject();
  const boundaryCompanyId = 'shared-co-boundary-1';
  const poolResourceV2 = { id: 'boundary-res-echo', name: 'Grensvakman', type: 'LABOR' as const, description: '', maxUnits: 1, costPerHour: 9 };
  const boundaryPool = {
    companyId: boundaryCompanyId, companyName: 'Boundary Collega BV', poolVersion: 6,
    modifiedAt: '2026-06-09T00:00:00.000Z', calendars: [], resources: [poolResourceV2],
  };
  const boundaryResId = useAppStore.getState().addResource({ name: 'Grensvakman', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 3 });
  const oldFieldsHash = computeResourceHash({ id: 'x', name: 'Grensvakman', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 3 });
  useAppStore.setState((st) => {
    st.project.companyId = boundaryCompanyId;
    st.isDirty = false;
    const r = st.resources.find(r => r.id === boundaryResId)!;
    r.libraryOrigin = { companyId: boundaryCompanyId, libraryItemId: 'boundary-res-echo', poolVersion: 6, syncedHash: oldFieldsHash };
  });
  assert(useAppStore.getState().onOpenStatusForResource(boundaryResId) === null, 'F3 setup: vóór import bestaat het bedrijf lokaal niet ⇒ los-gedrag (null)');

  const undoBefore = useAppStore.getState().historyEvents.filter(event => event.state === 'applied').length;
  const isDirtyBefore = useAppStore.getState().isDirty;

  let importPublications = 0;
  const unsubscribe = useAppStore.subscribe(() => { importPublications++; });
  const importedBoundaryId = useAppStore.getState().importPoolAsNewCompany(boundaryPool);
  unsubscribe();
  assert(importedBoundaryId === boundaryCompanyId, 'F3 setup: companyId behouden (vrij, niet reserved)');

  assert(importPublications === 1, 'F3: toevoegen publiceert bedrijf, pool en actieve grens exact één keer');
  assert(useAppStore.getState().ui.libraryRefreshNotice === 1, 'F3: de toevoegen-route publiceert zelf de positieve grens-1-telling');
  const afterBoundary = useAppStore.getState();
  assert(afterBoundary.resources.find(r => r.id === boundaryResId)?.costPerHour === 9, 'F3: het behind-item is stil ververst naar de nieuw-geïmporteerde poolwaarde');
  assert(afterBoundary.historyEvents.filter(event => event.state === 'applied').length === undoBefore, 'F3: geen undo-stap (grens 1 is niet-undoable, ongewijzigd gedrag)');
  assert(afterBoundary.isDirty === isDirtyBefore, 'F3: isDirty blijft ongewijzigd (niet-undoable verversing zet geen isDirty)');
  assert(afterBoundary.historyEvents.filter(event => event.state === 'undone').length === 0, 'F3: de redoStack is gewist door de stille verversing');
}

{
  const iso = createAppStore();
  const S = () => iso.getState();
  S().setProject({ startDate: '2026-06-01' });
  const cid = S().addCompany('Leeg BV');
  const poolCalId = S().addPoolCalendar(cid, { name: 'Bouw', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [] })!;
  S().bindProjectToCompany(cid);
  const calId = S().addLibraryCalendarToProject(cid, poolCalId).calendarId!;
  S().setCalendar({ ...S().calendar, description: '' });
  assert(S().onOpenStatusForCalendar(calId) === 'in-sync', 'lege kalenderomschrijving: voorwaarde — kopie is in sync vóór opslaan');
  const parsed = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly')));
  assert(parsed.calendar.description === '', `lege omschrijving projectkalender blijft leeg na round-trip, kreeg ${JSON.stringify(parsed.calendar.description)}`);
  S().newDocument();
  S().applyLoadedProject(parsed, { filePath: 'leeg.ifc', linkedOpen: true });
  const copy = S().calendars.find(c => c.libraryOrigin?.libraryItemId === poolCalId);
  assert(copy?.description === '', `lege omschrijving bibliotheekkopie blijft leeg na heropenen, kreeg ${JSON.stringify(copy?.description)}`);
  assert(!!copy && S().onOpenStatusForCalendar(copy.id) === 'in-sync', `bibliotheekkopie met lege omschrijving is na heropenen in sync, kreeg ${copy ? S().onOpenStatusForCalendar(copy.id) : 'geen kopie'}`);
  assert(!!copy && diffCalendarVsPool(copy, S().pools[cid]).status === 'up-to-date', 'bibliotheekkopie met lege omschrijving: diff up-to-date na heropenen');
}

{
  const ctx = createAppStore();
  const g = () => ctx.getState();
  const durKey = 'notifications.workRuleDurationsChanged';
  const durMsgs = () => g().ui.notifications.filter(n => n.messageKey === durKey).map(n => n.params?.count);
  const fixedRateTask = (name: string): string => {
    const t = g().addTask({ name, time: createDefaultTaskTime('2026-06-01', 4) });
    g().assignResource(t, g().addResource({ name: `ploeg ${name}`, type: 'LABOR', description: '', maxUnits: 1 }), 1);
    g().setTaskWorkRule(t, 'FIXED_RATE');
    return t;
  };
  g().setProject({ startDate: '2026-06-01' });
  g().ensureProjectCalendarInLibrary();
  const cid = g().addCompany('H6 Bouw BV');
  g().bindProjectToCompany(cid);
  const poolCalId = g().promoteCalendarToPool(cid, g().calendars.find(c => c.id === g().project.calendarId)!)!;
  const tA = fixedRateTask('A');
  const docA = g().activeDocumentId;
  g().newDocument();
  g().setProject({ startDate: '2026-06-01' });
  g().bindProjectToCompany(cid);
  const copyId = g().addLibraryCalendarToProject(cid, poolCalId).calendarId!;
  g().setProjectCalendar(copyId);
  const tB = fixedRateTask('B');
  const docB = g().activeDocumentId;
  g().switchDocument(docA);
  ctx.setState((st) => {
    st.ui.notifications = [];
    st.isDirty = false;
    const b = st.documents.find(d => d.id === docB)!.payload!;
    b.isDirty = false;
  });
  const eventsBefore = g().historyEvents.length;
  const poolCal = g().pools[cid].calendars.find(c => c.id === poolCalId)!;
  g().updatePoolCalendar(cid, poolCalId, { ...structuredClone(poolCal), workEndHour: 13, hoursPerDay: 6 });
  const payloadB = g().documents.find(d => d.id === docB)!.payload!;
  const durB = payloadB.tasks.find(t => t.id === tB)!.time.scheduleDuration;
  assert(g().tasks.find(t => t.id === tA)!.time.scheduleDuration === 16 / 3, 'H6: actief document — Vaste inzet 32 u op 8→6 u/d ⇒ 16/3 d');
  assert(durB === 16 / 3, `H6: slapend document — settle op zijn eigen taken ⇒ 16/3 d (kreeg ${durB})`);
  assert(payloadB.assignments.find(a => a.taskId === tB)!.remainingWorkMinutes === 32 * 60, 'H6: slapend document — werk blijft 32 u');
  assert(g().historyEvents.length === eventsBefore, 'H6: verversing + settle zijn niet-undoable (geen history-event)');
  assert(!g().isDirty && !payloadB.isDirty, 'H6: verversing + settle zetten geen isDirty (actief noch slapend)');
  assert(g().scheduleStale && payloadB.scheduleStale, 'H6: beide documenten staan op herberekenen');
  assert(JSON.stringify(durMsgs()) === '[1]', `H6: één melding voor het actieve document (kreeg ${JSON.stringify(durMsgs())})`);
  assert(g().documents.find(d => d.id === docB)!.pendingWorkRuleSettle?.changed === 1, 'H6: de melding voor het slapende document staat klaar');
  ctx.setState((st) => { st.ui.notifications = []; });
  g().switchDocument(docB);
  assert(JSON.stringify(durMsgs()) === '[1]', `H6: bij activeren van B één samenvattende melding (kreeg ${JSON.stringify(durMsgs())})`);
  assert(g().documents.find(d => d.id === docA)!.pendingWorkRuleSettle === undefined, 'H6: A heeft niets openstaan');
  ctx.setState((st) => {
    const cal = st.calendars.find(c => c.id === st.project.calendarId)!;
    Object.assign(cal, { workEndHour: 16, hoursPerDay: 8, libraryOrigin: { ...cal.libraryOrigin!, syncedHash: computeCalendarHash({ ...cal, workEndHour: 16, hoursPerDay: 8 }) } });
    st.calendar = cal;
    const t = st.tasks.find(x => x.id === tB)!;
    t.time.scheduleDuration = 4;
  });
  const boundary = materializeLibraryBoundary({ payload: capturePayload(g()), companies: g().companies, pools: g().pools, mode: 'open-boundary' });
  assert(boundary.signals.refreshed === 1 && boundary.workRuleSettle?.changed === 1, `H6: de grens ververst de achterlopende kalender en meldt 1 aangepaste taak (kreeg ${JSON.stringify(boundary.signals)})`);
  assert(boundary.payload.tasks.find(t => t.id === tB)!.time.scheduleDuration === 16 / 3, 'H6: de grens settelt de taak op de payload (16/3 d)');
  assert(g().tasks.find(t => t.id === tB)!.time.scheduleDuration === 4, 'H6: de grens raakt de store niet aan (pure materialisatie)');
}

console.log(`library-slice: ${checks - fails}/${checks} groen`);
process.exit(fails > 0 ? 1 : 0);
