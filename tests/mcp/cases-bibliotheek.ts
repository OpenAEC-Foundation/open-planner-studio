// MCP-TOOLS × BIBLIOTHEEKSTEMPELS (B1.1, issue #19).
//
// WAAROM DEZE BATTERIJ BESTAAT. De MCP-bridge en de bedrijfscentrische resourcebibliotheken zijn
// onafhankelijk gebouwd en raken elkaar op precies één punt: `planner_manage_resources` en
// `planner_update_calendar` kunnen items muteren die een herkomststempel (`libraryOrigin` +
// `syncedHash`) dragen. Niemand had gemeten wat daar gebeurt. Twee faalvormen, allebei erg:
//
//   1. STEMPEL WEG / STIL GESTRIPT — het item verliest zijn herkomst en valt buiten de
//      bibliotheekmechaniek; "bijwerken vanuit bibliotheek" werkt er nooit meer op.
//   2. HASH BLIND MEEGESCHREVEN — de tool werkt `syncedHash` bij zonder de POOL te wijzigen. Dan
//      geldt `fileHash === syncedHash` bij de eerstvolgende grens, wat `classifyOnOpen` als
//      'behind' leest — en 'behind' wordt door de open-boundary STIL ververst naar de poolwaarden.
//      De AI-bewerking verdwijnt dan geruisloos, zonder dat de gebruiker ooit iets gevraagd wordt.
//
// HET STEMPELBEHEER (gemeten en hier vastgepind): de tools laten de stempel met rust. Ze raken
// `libraryOrigin` niet aan en werken `syncedHash` NIET bij — geen van beide faalvormen doet zich voor.
//
// DE GATING (besluit na die meting): `planner_manage_resources` WEIGERT een wijziging op de velden
// die de bibliotheek bepaalt, in plaats van ze te schrijven en het item 'deviated' te laten worden.
// Reden: het resourcepaneel zet diezelfde velden op een geërfde rij op slot, dus zonder gating deed
// de bridge iets wat de gebruiker zelf niet kán — en de gemeten uitkomst daarvan was een
// afwijkingsvraag over een wijziging die hij niet maakte, waarbij de voor de hand liggende keuze
// ("bibliotheekwaarden gebruiken") de bewerking wegpoetst. De bibliotheek zelf blijft bewust buiten
// het bereik van de bridge: dat is app-globale data die door álle projecten gedeeld wordt en buiten
// de projecthistorie valt. De aangeraden route is losmaken — projectlokaal en ongedaan te maken.
//
// De scheiding tussen BIBLIOTHEEKVELD en PROJECTINZET is het scharnier: `maxUnits`,
// `availabilitySteps`, `calendarId` en `parentId` staan bewust niet in `RESOURCE_DIFF_FIELDS` en
// blijven dus gewoon schrijfbaar — een AI moet capaciteit kunnen bijstellen zonder tegen een muur te
// lopen. KALENDERS kennen dit slot niet (de kalenderdialoog laat een geërfde kalender gewoon
// bewerken), dus daar blijft 'deviated' het juiste, gespiegelde gedrag.
//
// Testlijst:
//   1. nulmeting — vers gematerialiseerd item is 'in-sync' en zijn hash klopt
//   2. bibliotheekveld via MCP ⇒ geweigerd, niets verandert, geen afwijking
//   3. elk vastgelegd veld weigert; een gemengde update sneuvelt in zijn geheel
//   4. projecteigen resource ⇒ volledig bewerkbaar (het slot geldt alleen bij een stempel)
//   5. list_resources toont herkomst + exact de velden die op slot zitten (leeskant ↔ schrijfkant)
//   6. losmaken maakt de velden weer schrijfbaar — de aangeraden route werkt echt
//   7. projectinzet (maxUnits) via MCP ⇒ landt en blijft 'in-sync' (geen valse afwijking)
//   8. create in een gekoppeld project ⇒ projecteigen (geen stempel), pool onaangeroerd
//   9. delete van een gestempeld item ⇒ pool onaangeroerd, geen 'removed'-ruis bij de grens
//  10. planner_update_calendar op een gestempelde kalender ⇒ stempel/hash met rust, 'deviated'
//  11. planner_batch ⇒ omzeilt de gating niet; projectinzet blijft er wél schrijfbaar
//  12. de bedoelde route (pool wijzigen) ⇒ beide kanten bewegen mee, blijft 'in-sync'
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { resourceTools } from '@/services/mcp/tools/resourceTools';
import { calendarResourceTools } from '@/services/mcp/tools/calendarResourceTools';
import { batchTools } from '@/services/mcp/tools/batchTool';
import { readTools } from '@/services/mcp/tools/readTools';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { computeResourceHash, computeCalendarHash } from '@/services/library/libraryOps';
import { capturePayload, hydratePayload } from '@/state/documentContract';
import { materializeLibraryBoundary } from '@/state/documentActivation';

const store = useAppStore;
const ALL = [...resourceTools, ...calendarResourceTools, ...batchTools, ...readTools];
// `planner_batch` zoekt zijn stappen op in de REGISTRY, niet in de lijst hierboven.
registerAllTools();

// Warm-up (zelfde reden als cases-resource-crud.ts): een verse store heeft `calendars: []`.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

function makeCtx(): McpContext {
  return makeMcpContext(appStoreContext, {
    expectedDocId: store.getState().activeDocumentId,
  });
}
async function call(name: string, args: unknown): Promise<McpToolResult> {
  const def = ALL.find((t) => t.name === name);
  if (!def) throw new Error(`tool ontbreekt: ${name}`);
  return await def.handler(args, makeCtx());
}
function expectOk(res: McpToolResult, what: string): McpToolOk {
  assert(res.ok, `${what}: verwachtte ok, kreeg ${res.ok ? '' : res.error}`);
  const rej = (res as McpToolOk).itemRejections ?? [];
  assertEq(rej, [], `${what}: onverwachte per-item-weigering`);
  return res as McpToolOk;
}
/** De ene weigeringsreden; faalt als er niet exact één is. */
function soleReason(res: McpToolResult): string {
  const rej = (res as McpToolOk).itemRejections ?? [];
  assertEq(rej.length, 1, `verwachtte precies één weigering, kreeg ${JSON.stringify(rej)}`);
  return rej[0].reason;
}

/** Testadapter rond de pure open-boundary; productiepublicaties gebruiken deze materialisatie al
 * vóór activatie en hebben daarom geen losse live storeactie meer. */
function commitOpenBoundaryForTest(): { refreshed: number; deviated: number; removed: number } {
  const state = store.getState();
  const activation = materializeLibraryBoundary({
    payload: capturePayload(state),
    companies: state.companies,
    pools: state.pools,
    mode: 'open-boundary',
  });
  store.setState(draft => {
    hydratePayload(draft, activation.payload);
    draft.viewRows = [...activation.viewRows];
    draft.resourceLoadResult = activation.resourceLoadResult;
    draft.ui.showLibraryLinkDialog = activation.signals.showLibraryLinkDialog;
    draft.ui.libraryRefreshNotice = activation.signals.libraryRefreshNotice;
  });
  const { refreshed, deviated, removed } = activation.signals;
  return { refreshed, deviated, removed };
}

/** Gekoppeld project met één gestempelde resource uit de bedrijfspool. */
function setupResource() {
  store.getState().newProject();
  const companyId = store.getState().addCompany('Testbedrijf');
  const poolResId = store.getState().addPoolResource(companyId, {
    name: 'Kraanmachinist', type: 'LABOR', description: 'Bibliotheekafspraak',
    maxUnits: 2, costPerHour: 65,
  })!;
  store.getState().bindProjectToCompany(companyId);
  const { resourceId } = store.getState().addLibraryResourceToProject(companyId, poolResId);
  const res = store.getState().resources.find((r) => r.id === resourceId)!;
  return { companyId, poolResId, resourceId: resourceId!, hashBijMaterialisatie: res.libraryOrigin!.syncedHash! };
}

/** Gekoppeld project met één gestempelde kalender uit de bedrijfspool. */
function setupCalendar() {
  store.getState().newProject();
  const companyId = store.getState().addCompany('Testbedrijf');
  const poolCalId = store.getState().addPoolCalendar(companyId, {
    name: 'Bedrijfskalender', description: 'Bibliotheekafspraak',
    workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  })!;
  store.getState().bindProjectToCompany(companyId);
  const { calendarId } = store.getState().addLibraryCalendarToProject(companyId, poolCalId);
  const cal = store.getState().calendars.find((c) => c.id === calendarId)!;
  return { companyId, poolCalId, calendarId: calendarId!, hashBijMaterialisatie: cal.libraryOrigin!.syncedHash! };
}

function resource(id: string) {
  return store.getState().resources.find((r) => r.id === id);
}

// =================================================================================================
// 1) Nulmeting — de opzet zelf klopt (anders zegt de rest niets)
// =================================================================================================
test('nulmeting: vers gematerialiseerde resource is in-sync en draagt de juiste hash', () => {
  const { resourceId, hashBijMaterialisatie } = setupResource();
  const res = resource(resourceId)!;
  assert(!!res.libraryOrigin, 'gematerialiseerde resource hoort een stempel te dragen');
  assertEq(res.libraryOrigin!.syncedHash, computeResourceHash(res), 'syncedHash hoort de verse velden te dekken');
  assertEq(hashBijMaterialisatie, computeResourceHash(res), 'hash bij materialisatie == hash van de velden');
  assertEq(store.getState().onOpenStatusForResource(resourceId), 'in-sync', 'verse materialisatie is in-sync');
  assertEq(commitOpenBoundaryForTest(), { refreshed: 0, deviated: 0, removed: 0 }, 'grens ziet niets te doen');
});

// =================================================================================================
// 2) Bibliotheekveld via MCP — WEIGEREN (spiegelt het slot in het resourcepaneel)
// =================================================================================================
test('MCP-wijziging op een BIBLIOTHEEKVELD wordt geweigerd; niets verandert, geen afwijking', async () => {
  const { resourceId, hashBijMaterialisatie } = setupResource();
  const res0 = await call('planner_manage_resources', {
    actions: [{ action: 'update', id: resourceId, costPerHour: 95 }],
  });
  assert(res0.ok, 'de call zelf slaagt; de weigering is per item (zachte weigering)');
  const reden = soleReason(res0);
  assert(reden.includes('costPerHour'), `de weigering moet het veld NOEMEN, kreeg: ${reden}`);
  assert(reden.includes('Testbedrijf'), `de weigering moet de bibliotheek noemen, kreeg: ${reden}`);
  assert(reden.includes('Losmaken'), `de weigering moet de losmaak-route noemen, kreeg: ${reden}`);
  assert(reden.includes('maxUnits'), `de weigering moet noemen wat WEL kan, kreeg: ${reden}`);

  const res = resource(resourceId)!;
  assertEq(res.costPerHour, 65, 'er mag NIETS gewijzigd zijn');
  assert(!!res.libraryOrigin, 'stempel blijft staan');
  assertEq(res.libraryOrigin!.syncedHash, hashBijMaterialisatie, 'hash blijft staan');
  assertEq(res.libraryOrigin!.syncedHash, computeResourceHash(res), 'hash dekt nog steeds de velden');
  assertEq(store.getState().onOpenStatusForResource(resourceId), 'in-sync', 'een geweigerde wijziging levert geen afwijking op');
  assertEq(commitOpenBoundaryForTest(), { refreshed: 0, deviated: 0, removed: 0 }, 'geen afwijkingsvraag');
  assert(!store.getState().ui.showLibraryLinkDialog, 'de gebruiker wordt niets gevraagd');
});

test('elk bibliotheekveld wordt geweigerd; een gemengde update wordt in ZIJN GEHEEL geweigerd', async () => {
  const { resourceId } = setupResource();
  for (const [veld, waarde] of [
    ['name', 'Kraanmachinist (AI)'], ['type', 'EQUIPMENT'], ['description', 'AI-tekst'], ['costPerHour', 95],
  ] as [string, unknown][]) {
    const r = await call('planner_manage_resources', { actions: [{ action: 'update', id: resourceId, [veld]: waarde }] });
    assert(soleReason(r).includes(veld), `${veld} hoort geweigerd te worden met vermelding van de veldnaam`);
  }
  // Gemengd: één toegestaan veld (projectinzet) + één vastgelegd veld. Half toepassen zou de
  // stille-no-op-klasse terugbrengen — dus het hele item sneuvelt.
  const gemengd = await call('planner_manage_resources', {
    actions: [{ action: 'update', id: resourceId, maxUnits: 4, costPerHour: 95 }],
  });
  assert(soleReason(gemengd).includes('costPerHour'), 'de gemengde update wordt geweigerd op het vastgelegde veld');
  const res = resource(resourceId)!;
  assertEq(res.maxUnits, 2, 'ook het TOEGESTANE veld mag niet half zijn toegepast');
  assertEq(res.costPerHour, 65, 'en het vastgelegde veld al helemaal niet');
});

test('een stempel-loze (projecteigen) resource blijft volledig bewerkbaar', async () => {
  setupResource();
  const created = await call('planner_manage_resources', {
    actions: [{ action: 'create', name: 'Eigen kracht', type: 'LABOR', costPerHour: 40 }],
  });
  const eigenId = (created as McpToolOk).data as { resources: { id: string }[] };
  const id = eigenId.resources[0].id;
  expectOk(await call('planner_manage_resources', {
    actions: [{ action: 'update', id, costPerHour: 55, name: 'Eigen kracht (bijgewerkt)' }],
  }), 'projecteigen resource wijzigen');
  const res = resource(id)!;
  assertEq(res.costPerHour, 55, 'zonder stempel geldt er geen slot');
  assertEq(res.name, 'Eigen kracht (bijgewerkt)', 'ook de naam is vrij');
});

test('list_resources toont de herkomst en precies welke velden op slot zitten', async () => {
  const { resourceId } = setupResource();
  const data = (await call('planner_list_resources', {}) as McpToolOk).data as {
    resources: { id: string; library?: { company: string; status: string; lockedFields: string[] } }[];
  };
  const rij = data.resources.find((r) => r.id === resourceId)!;
  assert(!!rij.library, 'een geërfde resource hoort zijn herkomst te tonen (leeskant ↔ schrijfkant)');
  assertEq(rij.library!.company, 'Testbedrijf', 'de bibliotheeknaam staat erbij');
  assertEq(rij.library!.status, 'in-sync', 'de status staat erbij');
  assertEq(rij.library!.lockedFields, ['name', 'type', 'description', 'costPerHour', 'unitOfMeasure'],
    'exact de velden die de tool weigert — dezelfde lijst, geen tweede administratie');
  // Een projecteigen resource draagt geen library-blok.
  const created = (await call('planner_manage_resources', {
    actions: [{ action: 'create', name: 'Eigen kracht', type: 'LABOR' }],
  }) as McpToolOk).data as { resources: { id: string }[] };
  const na = (await call('planner_list_resources', {}) as McpToolOk).data as {
    resources: { id: string; library?: unknown }[];
  };
  assert(!na.resources.find((r) => r.id === created.resources[0].id)!.library,
    'een projecteigen resource hoort GEEN library-blok te dragen');
});

test('losmaken van de bibliotheek maakt de vastgelegde velden weer schrijfbaar', async () => {
  const { resourceId } = setupResource();
  // De route die de weigering aanraadt moet ook echt werken.
  store.getState().unlinkResourceFromLibrary(resourceId);
  assert(!resource(resourceId)!.libraryOrigin, 'losmaken haalt de stempel weg');
  expectOk(await call('planner_manage_resources', {
    actions: [{ action: 'update', id: resourceId, costPerHour: 95 }],
  }), 'na losmaken');
  assertEq(resource(resourceId)!.costPerHour, 95, 'na losmaken is het veld projecteigen en schrijfbaar');
  assertEq(store.getState().onOpenStatusForResource(resourceId), null, 'geen stempel meer ⇒ geen bibliotheekstatus');
});

// =================================================================================================
// 3) Projectinzet — GEEN valse afwijking
// =================================================================================================
test('MCP-wijziging op PROJECTINZET (maxUnits) veroorzaakt geen afwijking', async () => {
  const { resourceId, hashBijMaterialisatie } = setupResource();
  expectOk(await call('planner_manage_resources', {
    actions: [{ action: 'update', id: resourceId, maxUnits: 4 }],
  }), 'maxUnits-wijziging');

  const res = resource(resourceId)!;
  assertEq(res.maxUnits, 4, 'de wijziging hoort te landen');
  assertEq(res.libraryOrigin!.syncedHash, hashBijMaterialisatie, 'hash blijft ongemoeid');
  // maxUnits zit bewust NIET in RESOURCE_DIFF_FIELDS ⇒ de hash dekt hem niet ⇒ nog steeds in-sync.
  assertEq(res.libraryOrigin!.syncedHash, computeResourceHash(res), 'de gevolgde velden zijn niet veranderd');
  assertEq(store.getState().onOpenStatusForResource(resourceId), 'in-sync', 'projectinzet is geen bedrijfsafspraak');
  assertEq(commitOpenBoundaryForTest(), { refreshed: 0, deviated: 0, removed: 0 }, 'geen afwijkingsvraag');
  assert(!store.getState().ui.showLibraryLinkDialog, 'geen dialoog voor een projectinzet-wijziging');
});

// =================================================================================================
// 4) Aanmaken in een gekoppeld project ⇒ projecteigen
// =================================================================================================
test('create in een gekoppeld project levert een PROJECTEIGEN resource (geen stempel)', async () => {
  const { companyId } = setupResource();
  expectOk(await call('planner_manage_resources', {
    actions: [{ action: 'create', name: 'Nieuwe hulpkracht', type: 'LABOR', costPerHour: 40 }],
  }), 'create');

  const nieuw = store.getState().resources.find((r) => r.name === 'Nieuwe hulpkracht')!;
  assert(!nieuw.libraryOrigin, 'een via de bridge aangemaakte resource hoort GEEN herkomststempel te krijgen');
  assertEq(store.getState().onOpenStatusForResource(nieuw.id), null, 'geen eigen-bedrijf-stempel ⇒ geen status');
  assertEq(store.getState().pools[companyId].resources.length, 1, 'de bedrijfspool mag niet meegroeien met projectwerk');
  assertEq(commitOpenBoundaryForTest(), { refreshed: 0, deviated: 0, removed: 0 }, 'projecteigen items zijn geen afwijking');
});

// =================================================================================================
// 5) Verwijderen van een gestempeld item
// =================================================================================================
test('delete van een gestempelde resource laat de bedrijfspool ongemoeid', async () => {
  const { companyId, resourceId } = setupResource();
  expectOk(await call('planner_manage_resources', {
    actions: [{ action: 'delete', id: resourceId }],
  }), 'delete');

  assert(!resource(resourceId), 'de projectresource hoort weg te zijn');
  assertEq(store.getState().pools[companyId].resources.length, 1, 'het poolorigineel blijft bestaan');
  // Geen wees-ruis: het item is wég, dus de grens heeft er niets meer over te melden.
  assertEq(commitOpenBoundaryForTest(), { refreshed: 0, deviated: 0, removed: 0 }, 'geen removed-ruis na een projectverwijdering');
  assert(!store.getState().ui.showLibraryLinkDialog, 'verwijderen levert geen afwijkingsvraag op');
});

// =================================================================================================
// 6) Kalenders — zelfde regel
// =================================================================================================
test('planner_update_calendar op een gestempelde kalender: stempel intact, hash ongewijzigd, deviated', async () => {
  const { calendarId, hashBijMaterialisatie } = setupCalendar();
  expectOk(await call('planner_update_calendar', {
    calendars: [{ id: calendarId, hoursPerDay: 6 }],
  }), 'kalenderwijziging');

  const cal = store.getState().calendars.find((c) => c.id === calendarId)!;
  assertEq(cal.hoursPerDay, 6, 'de wijziging hoort te landen');
  assert(!!cal.libraryOrigin, 'stempel moet blijven staan');
  assertEq(cal.libraryOrigin!.syncedHash, hashBijMaterialisatie, 'syncedHash mag niet meebewegen');
  assert(cal.libraryOrigin!.syncedHash !== computeCalendarHash(cal), 'hash hoort af te wijken van de gewijzigde velden');
  assertEq(store.getState().onOpenStatusForCalendar(calendarId), 'deviated', 'gewijzigde kalenderinhoud is een afwijking');
  assertEq(commitOpenBoundaryForTest(), { refreshed: 0, deviated: 1, removed: 0 }, 'de grens telt precies één afwijking');
  assertEq(store.getState().calendars.find((c) => c.id === calendarId)!.hoursPerDay, 6, 'de grens draait de wijziging niet stil terug');
});

// =================================================================================================
// 7) Het batch-pad — eigen transactieroute, zelfde uitkomst
// =================================================================================================
test('planner_batch omzeilt de bibliotheek-gating niet', async () => {
  const { resourceId, hashBijMaterialisatie } = setupResource();
  const res0 = await call('planner_batch', {
    steps: [{
      tool: 'planner_manage_resources',
      args: { actions: [{ action: 'update', id: resourceId, costPerHour: 120 }] },
    }],
  });
  assert(res0.ok, 'de batch zelf slaagt; de weigering is per item');
  assert(JSON.stringify(res0).includes('costPerHour'), 'het draaiboekrapport noemt het geweigerde veld');

  const res = resource(resourceId)!;
  assertEq(res.costPerHour, 65, 'ook via het draaiboekpad verandert er niets');
  assert(!!res.libraryOrigin, 'stempel blijft staan');
  assertEq(res.libraryOrigin!.syncedHash, hashBijMaterialisatie, 'hash blijft staan');
  assertEq(store.getState().onOpenStatusForResource(resourceId), 'in-sync', 'geen afwijking via de achterdeur');
  assertEq(commitOpenBoundaryForTest(), { refreshed: 0, deviated: 0, removed: 0 }, 'zelfde grens-uitkomst als direct');
});

test('projectinzet blijft ook via planner_batch gewoon schrijfbaar', async () => {
  const { resourceId } = setupResource();
  expectOk(await call('planner_batch', {
    steps: [{
      tool: 'planner_manage_resources',
      args: { actions: [{ action: 'update', id: resourceId, maxUnits: 4 }] },
    }],
  }), 'maxUnits via batch');
  assertEq(resource(resourceId)!.maxUnits, 4, 'projectinzet landt gewoon');
  assertEq(store.getState().onOpenStatusForResource(resourceId), 'in-sync', 'en veroorzaakt geen afwijking');
});

// =================================================================================================
// 8) De BEDOELDE route — bibliotheek wijzigen, niet het project
// =================================================================================================
test('de poolroute laat beide kanten meebewegen en blijft in-sync', () => {
  const { companyId, poolResId, resourceId } = setupResource();
  store.getState().updatePoolResource(companyId, poolResId, { costPerHour: 95 });

  const res = resource(resourceId)!;
  assertEq(res.costPerHour, 95, 'de projectkopie volgt de bibliotheek');
  assertEq(res.libraryOrigin!.syncedHash, computeResourceHash(res), 'hash beweegt hier WEL mee');
  assertEq(store.getState().onOpenStatusForResource(resourceId), 'in-sync', 'bibliotheek en project zijn het eens');
  // Let op: de dialoogvlag is APP-globaal en wordt door `newProject()` niet gewist (alleen
  // `newDocument()` doet dat) — vandaar dat we hem via de grens laten vestigen i.p.v. hem rauw te
  // lezen; de boundarymaterialisatie zet de volledige vlagtoestand, inclusief het WISSEN.
  assertEq(commitOpenBoundaryForTest(), { refreshed: 0, deviated: 0, removed: 0 }, 'de grens ziet geen afwijking');
  assert(!store.getState().ui.showLibraryLinkDialog, 'geen afwijkingsvraag op de bedoelde route');
});

await run();
