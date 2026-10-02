// Eerste-startervaring, vervolg (eigenaarsbesluit 2026-09-28): welkomst → rondleiding → tutorialvraag.
//
// WAT HIER VASTLIGT.
//  A. "Update beschikbaar" wacht zolang de eerste-startervaring loopt (`isOnboardingActive`).
//  B. Alleen een VOLTOOIDE rondleiding opent de tutorialvraag, en alleen zolang die nog niet
//     beantwoord is (`tourFinishPatch`); de overgang is één patch. In `TourOverlay` is Volgende/Klaar
//     op de laatste stap de enige route naar `finish('completed')` (bron-assert).
//  C. `tutorialOfferAnswered` is een blijvende instelling (register → `ops-tutorialOfferAnswered`).
//  D. De Ja-route (`startFirstTutorial`) met gemockte afhankelijkheden: al actief, aan het laden,
//     uitgeschakeld, installeren (geïnstalleerd / geweigerd / mislukt / niet actief), geen entry,
//     offline, geen tutorial, niet gestart. Het host-event gaat pas uit NA de installatie.
//  E. Met de echte loader: een net "geïnstalleerde" extensie met een trage (async) `onLoad` krijgt
//     `host:tutorial-requested` pas als haar listener staat, en start de begeleiding.
//  (De "Net bijgewerkt"-regel voor de eerste start staat in check-just-updated.ts.)
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isOnboardingActive, tourFinishPatch } from '@/state/onboarding';
import { createAppStoreContext, useAppStore } from '@/state/appStore';
import { SETTINGS, loadAllSettings } from '@/utils/settingsRegistry';
import { saveTutorialOfferAnswered } from '@/utils/settingsStore';
import { startFirstTutorial, TUTORIALS_EXTENSION_ID, type FirstTutorialDeps } from '@/extensions/firstTutorial';
import { HOST_EVENTS, emitExtensionEvent, type HostTutorialRequest } from '@/services/extensionEvents';
import { enableExtension, whenExtensionSettled, type ExtensionStorage } from '@/extensions/extensionLoader';
import { parseExtensionManifest } from '@/extensions/validation';
import { getGuideView, stopGuideSession } from '@/extensions/guideRuntime';
import { getRegisteredHelpArticles } from '@/utils/helpArticleRegistry';
import { tutorialsInOrder } from '@/utils/helpManifest';
import type { CatalogEntry, ExtensionStatus } from '@/extensions/types';
import type { InstallOutcome } from '@/extensions/extensionService';
import type { TourUiSnapshot } from '@/state/slices/types';
import { FetchTimeoutError, fetchWithTimeout } from '@/services/fetchWithTimeout';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

// ── A. Onboarding blokkeert de updatedialoog ─────────────────────────────────────────────────
{
  const idle = { welcomePending: false, showWelcomeDialog: false, showTourOverlay: false, showTutorialOffer: false };
  eq('A1 niets open → niet actief', isOnboardingActive(idle), false);
  eq('A2 welkomst nog op komst → actief', isOnboardingActive({ ...idle, welcomePending: true }), true);
  eq('A3 welkomst open → actief', isOnboardingActive({ ...idle, showWelcomeDialog: true }), true);
  eq('A4 rondleiding open → actief', isOnboardingActive({ ...idle, showTourOverlay: true }), true);
  eq('A5 tutorialvraag open → actief', isOnboardingActive({ ...idle, showTutorialOffer: true }), true);
}

// ── B. Einde van de rondleiding ──────────────────────────────────────────────────────────────
{
  const snapshot: TourUiSnapshot = {
    activeRibbonTab: 'planning', backstageSection: 'recent', showHistogram: false,
    rightPanelCollapsed: true, showPropertiesPanel: false,
  };
  const done = tourFinishPatch({ tourSnapshot: snapshot, tutorialOfferAnswered: false }, 'completed');
  eq('B1 voltooid + onbeantwoord → tutorialvraag open', done.showTutorialOffer, true);
  eq('B2 voltooid → tour dicht en snapshot teruggezet in dezelfde patch',
    [done.showTourOverlay, done.tourSnapshot, done.activeRibbonTab, done.rightPanelCollapsed, done.showHistogram],
    [false, null, 'planning', true, false]);
  const aborted = tourFinishPatch({ tourSnapshot: snapshot, tutorialOfferAnswered: false }, 'aborted');
  eq('B3 afgebroken (Overslaan/Esc/anker) → geen tutorialvraag', 'showTutorialOffer' in aborted, false);
  eq('B4 afgebroken → tour wel dicht', aborted.showTourOverlay, false);
  const again = tourFinishPatch({ tourSnapshot: snapshot, tutorialOfferAnswered: true }, 'completed');
  eq('B5 al beantwoord → een nieuwe voltooide rondleiding vraagt niet nog eens', 'showTutorialOffer' in again, false);
  eq('B6 zonder snapshot → Start-tabblad', tourFinishPatch({ tourSnapshot: null, tutorialOfferAnswered: false }, 'aborted').activeRibbonTab, 'start');

  // Store: één setUI, en in die ene notificatie is de onboarding nog steeds actief (geen gat).
  const ctx = createAppStoreContext();
  ctx.store.getState().setUI({ showTourOverlay: true, tourSnapshot: snapshot });
  const seen: boolean[] = [];
  const unsubscribe = ctx.store.subscribe(s => { seen.push(isOnboardingActive(s.ui)); });
  ctx.store.getState().setUI(tourFinishPatch(ctx.store.getState().ui, 'completed'));
  unsubscribe();
  eq('B7 overgang rondleiding → tutorialvraag: abonnee ziet nooit "alles dicht"', seen, [true]);

  const tour = readFileSync(join(process.cwd(), 'src/components/tour/TourOverlay.tsx'), 'utf8');
  const completedCalls = tour.match(/finish\('completed'\)/g) ?? [];
  eq('B8 TourOverlay: precies één route naar "voltooid"', completedCalls.length, 1);
  eq('B9 …en die zit achter isLast in de Volgende-knop', /if \(isLast\) finish\('completed'\);/.test(tour), true);
  eq('B10 Overslaan, Escape en auto-skip breken af', [
    /<button onClick=\{abort\}[^>]*>\{t\('tour\.skip'\)\}/.test(tour),
    /useDialogKeys\(\{ onCancel: abort \}\)/.test(tour),
    /else abort\(\);/.test(tour),
    /if \(!step\) \{ abort\(\); return; \}/.test(tour),
  ], [true, true, true, true]);

  const welcome = readFileSync(join(process.cwd(), 'src/components/dialogs/WelcomeDialog.tsx'), 'utf8');
  eq('B11 Welkomst → rondleiding in één patch',
    /setUI\(\{ showWelcomeDialog: false, showTourOverlay: true, tourStepIndex: 0 \}\)/.test(welcome), true);
}

// ── C. Blijvende instelling ──────────────────────────────────────────────────────────────────
{
  eq('C1 register kent tutorialOfferAnswered', SETTINGS.some(d => d.key === 'tutorialOfferAnswered' && d.field === 'tutorialOfferAnswered'), true);
  localStorage.removeItem('ops-tutorialOfferAnswered');
  eq('C2 zonder sleutel: niet in de patch (default onwaar)', 'tutorialOfferAnswered' in await loadAllSettings(), false);
  await saveTutorialOfferAnswered(true);
  eq('C3 bewaard onder ops-tutorialOfferAnswered', localStorage.getItem('ops-tutorialOfferAnswered'), 'true');
  eq('C4 hydrateert als true', (await loadAllSettings()).tutorialOfferAnswered, true);
  localStorage.removeItem('ops-tutorialOfferAnswered');
  eq('C5 default in de store is onwaar', createAppStoreContext().store.getState().ui.tutorialOfferAnswered, false);
}

// ── D. De Ja-route, gemockt ──────────────────────────────────────────────────────────────────
const ENTRY: CatalogEntry = {
  id: 'tutorials', name: 'Tutorials', version: '1.0.0', author: 'OpenAEC', description: '', category: 'Other',
  tags: [], minAppVersion: '0.0.0', repository: '', downloadUrl: 'https://example.invalid/tutorials.zip',
};

interface MockOpts {
  status?: ExtensionStatus | null;
  entries?: CatalogEntry[];
  catalogError?: string | null;
  installResult?: InstallOutcome;
  /** Status na installeren; standaard `enabled` bij 'installed'. */
  statusAfterInstall?: ExtensionStatus;
  statusAfterSettle?: ExtensionStatus | null;
  statusAfterEnable?: ExtensionStatus;
  tutorialId?: string | null;
  /** Start de "extensie" een begeleiding op het event? */
  listens?: boolean;
}

function mock(o: MockOpts) {
  const log: string[] = [];
  const emitted: Array<{ event: string; data: HostTutorialRequest }> = [];
  let status: ExtensionStatus | null = o.status ?? null;
  let guideFor: string | null = null;
  const deps: FirstTutorialDeps = {
    extensionStatus: () => status,
    whenSettled: async () => { log.push('settle'); status = o.statusAfterSettle ?? 'enabled'; },
    enable: async () => { log.push('enable'); status = o.statusAfterEnable ?? 'enabled'; },
    fetchCatalog: async () => { log.push('fetch'); },
    catalog: () => ({ entries: o.entries ?? [], error: o.catalogError ?? null }),
    install: async () => {
      log.push('install');
      const result = o.installResult ?? 'installed';
      if (result === 'installed') status = o.statusAfterInstall ?? 'enabled';
      return result;
    },
    firstTutorialId: () => (o.tutorialId === undefined ? 'tut-1-eerste-planning' : o.tutorialId),
    emit: (event, data) => {
      log.push('emit');
      emitted.push({ event, data });
      // Een extensie luistert pas als ze actief is (haar onLoad zette de listener).
      if (o.listens !== false && status === 'enabled') guideFor = data.extensionId;
    },
    guideRunningFor: id => guideFor === id,
  };
  return { deps, log, emitted };
}

{
  const m = mock({ status: 'enabled' });
  eq('D1 al actief → gestart', await startFirstTutorial(m.deps), { kind: 'started' });
  eq('D1 geen catalogus, geen installatie', m.log, ['emit']);
  eq('D1 event: naam en data', m.emitted, [{ event: 'host:tutorial-requested', data: { extensionId: 'tutorials', tutorialId: 'tut-1-eerste-planning' } }]);
  eq('D1 standaard-id is "tutorials"', TUTORIALS_EXTENSION_ID, 'tutorials');
  eq('D1 host-event staat in HOST_EVENTS', HOST_EVENTS.tutorialRequested, 'host:tutorial-requested');
}
{
  const m = mock({ status: null, entries: [ENTRY] });
  eq('D2 niet geïnstalleerd → installeren en starten', await startFirstTutorial(m.deps), { kind: 'started' });
  eq('D2 volgorde: ophalen → installeren → pas dan het event', m.log, ['fetch', 'install', 'emit']);
}
{
  const m = mock({ status: null, entries: [ENTRY], installResult: 'declined' });
  eq('D3 toestemming geweigerd → declined', await startFirstTutorial(m.deps), { kind: 'declined' });
  eq('D3 geen event', m.emitted.length, 0);
}
{
  const m = mock({ status: null, entries: [ENTRY], installResult: 'failed' });
  eq('D4 installatie mislukt → unavailable', await startFirstTutorial(m.deps), { kind: 'unavailable', reason: 'install-failed' });
  eq('D4 geen event', m.emitted.length, 0);
}
{
  const m = mock({ status: null, entries: [] });
  eq('D5 catalogus zonder entry → unavailable', await startFirstTutorial(m.deps), { kind: 'unavailable', reason: 'no-entry' });
  eq('D5 niets geïnstalleerd', m.log, ['fetch']);
}
{
  const m = mock({ status: null, entries: [], catalogError: 'Failed to fetch' });
  eq('D6 offline/catalogusfout → unavailable', await startFirstTutorial(m.deps), { kind: 'unavailable', reason: 'catalog-error' });
}
{
  const m = mock({ status: null, entries: [ENTRY], statusAfterInstall: 'error' });
  eq('D7 geïnstalleerd maar onLoad faalde → not-active', await startFirstTutorial(m.deps), { kind: 'unavailable', reason: 'not-active' });
  eq('D7 geen event naar een niet-actieve extensie', m.emitted.length, 0);
}
{
  const m = mock({ status: 'loading' });
  eq('D8 nog aan het laden → wachten, dan starten', await startFirstTutorial(m.deps), { kind: 'started' });
  eq('D8 eerst afwachten, dan het event', m.log, ['settle', 'emit']);
}
{
  const m = mock({ status: 'disabled' });
  eq('D9 uitgeschakeld → aanzetten en starten', await startFirstTutorial(m.deps), { kind: 'started' });
  eq('D9 geen catalogus nodig', m.log, ['enable', 'emit']);
}
{
  const m = mock({ status: 'disabled', statusAfterEnable: 'error' });
  eq('D10 aanzetten mislukt → not-active', await startFirstTutorial(m.deps), { kind: 'unavailable', reason: 'not-active' });
}
{
  const m = mock({ status: 'error', entries: [ENTRY] });
  eq('D11 foutstand → opnieuw uit de catalogus', await startFirstTutorial(m.deps), { kind: 'started' });
  eq('D11 volgorde', m.log, ['fetch', 'install', 'emit']);
}
{
  const m = mock({ status: 'enabled', listens: false });
  eq('D12 event zonder begeleiding (oude versie) → not-started', await startFirstTutorial(m.deps), { kind: 'unavailable', reason: 'not-started' });
}
{
  const m = mock({ status: 'enabled', tutorialId: null });
  eq('D13 geen geregistreerde tutorial → no-tutorial, geen event', [await startFirstTutorial(m.deps), m.emitted.length],
    [{ kind: 'unavailable', reason: 'no-tutorial' }, 0]);
}

// ── E. Echte loader: het event komt pas na een trage onLoad ─────────────────────────────────────
{
  const id = 'tutorials';
  const manifest = {
    id, name: 'Tutorials', version: '1.0.0', apiVersion: '1.4', minAppVersion: '0.0.0', author: 'test',
    description: '', category: 'Other', main: 'main.js', permissions: ['help', 'events'],
  };
  // onLoad wacht eerst (zoals een extensie die assets leest) en zet PAS DAARNA artikel en listener.
  const code = `
    const sdk = require('open-planner-studio');
    module.exports = {
      async onLoad(api) {
        await new Promise(r => setTimeout(r, 30));
        api.help.registerArticles([{ id: 'tut-1-eerste-planning', kind: 'tutorial', order: 1,
          title: { nl: 'Je eerste planning', en: 'Your first schedule' }, body: { nl: '# a', en: '# a' } }]);
        api.events.on(sdk.hostEvents.tutorialRequested, (data) => {
          if (!data || data.extensionId !== 'tutorials' || data.tutorialId !== 'tut-1-eerste-planning') return;
          api.help.startGuide({ id: 'tut-1-eerste-planning', title: { nl: 'Je eerste planning', en: 'Your first schedule' },
            steps: [{ id: 'a', body: { nl: 'Doe a.', en: 'Do a.' } }] });
        });
      },
    };`;
  const records: Record<string, unknown> = {};
  const storage: ExtensionStorage = {
    get: async (key) => (records[String(key)] ? { storageKey: key, value: records[String(key)] } : undefined),
    getAll: async () => Object.keys(records).map(k => ({ storageKey: k, value: records[k] })),
    save: async (ext) => { records[ext.id] = { ...ext }; },
    remove: async (key) => { delete records[String(key)]; },
  };
  const earlyEvents: unknown[] = [];
  const deps: FirstTutorialDeps = {
    extensionStatus: x => useAppStore.getState().installedExtensions[x]?.status ?? null,
    whenSettled: whenExtensionSettled,
    enable: x => enableExtension(x, storage),
    fetchCatalog: async () => {},
    catalog: () => ({ entries: [ENTRY], error: null }),
    // Zoals installFromZipBlob ná de toestemming: opslaan, registreren, activeren (wacht op onLoad).
    install: async () => {
      const parsed = parseExtensionManifest(manifest, 'fresh');
      if (!parsed.ok) throw new Error(parsed.error);
      records[id] = { id, manifest: parsed.value, mainCode: code, enabled: true };
      useAppStore.getState().registerReadyExtension({ kind: 'ready', id, manifest: parsed.value, status: 'disabled' });
      // Zou de host hier al uitzenden, dan hoort niemand het: onLoad loopt nog.
      emitExtensionEvent(HOST_EVENTS.tutorialRequested, { extensionId: id, tutorialId: 'tut-1-eerste-planning' });
      earlyEvents.push(getGuideView());
      await enableExtension(id, storage);
      return 'installed';
    },
    firstTutorialId: x => tutorialsInOrder(getRegisteredHelpArticles().filter(a => a.source === x))[0]?.id ?? null,
    emit: emitExtensionEvent,
    guideRunningFor: x => getGuideView()?.extensionId === x,
  };
  const outcome = await startFirstTutorial(deps);
  eq('E1 een event tijdens onLoad bereikt niemand (daarom wacht de host)', earlyEvents, [null]);
  eq('E2 na de installatie: gestart', outcome, { kind: 'started' });
  eq('E3 de begeleiding van de extensie loopt', [getGuideView()?.extensionId, getGuideView()?.guideId], ['tutorials', 'tut-1-eerste-planning']);
  stopGuideSession();
}

// ── F. Netwerk met tijdslimiet: de Ja-route kan niet eeuwig "bezig" blijven ─────────────────────
//  (M2, review PR #261) Catalogus en ZIP lopen via `fetchWithTimeout`; een hangend verzoek eindigt in
//  een fout, en die valt in de bestaande foutroute (catalog-error / install-failed → Help › Tutorials).
{
  const outcome = async <T,>(p: Promise<T>): Promise<string> =>
    p.then(v => `ok:${String(v)}`, e => (e instanceof FetchTimeoutError ? `timeout:${e.timeoutMs}` : `fout:${(e as Error).message}`));
  // Een server die nooit antwoordt, maar het abort-signaal volgt (zoals de echte fetch).
  let seenSignal: AbortSignal | undefined;
  const hangsHonoring: typeof fetch = (_url, init) => new Promise((_, reject) => {
    seenSignal = init?.signal ?? undefined;
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
  eq('F1 nooit antwoord → FetchTimeoutError', await outcome(fetchWithTimeout('u', {}, 20, async () => 1, hangsHonoring)), 'timeout:20');
  eq('F1 …en het verzoek is echt afgebroken', seenSignal?.aborted, true);
  const hangsIgnoring: typeof fetch = () => new Promise(() => {});
  eq('F2 ook als fetch het signaal negeert', await outcome(fetchWithTimeout('u', {}, 20, async () => 1, hangsIgnoring)), 'timeout:20');
  const answers: typeof fetch = async () => new Response('x');
  eq('F3 de limiet dekt ook het lezen van de body', await outcome(fetchWithTimeout('u', {}, 20, () => new Promise<number>(() => {}), answers)), 'timeout:20');
  let fastSignal: AbortSignal | undefined;
  const fast: typeof fetch = async (_url, init) => { fastSignal = init?.signal ?? undefined; return new Response('{"a":1}'); };
  eq('F4 op tijd → de waarde', await outcome(fetchWithTimeout('u', {}, 20, r => r.text(), fast)), 'ok:{"a":1}');
  await new Promise(r => setTimeout(r, 40));
  eq('F4 …en de timer is opgeruimd (geen late afbreking)', fastSignal?.aborted, false);
  const offline: typeof fetch = async () => { throw new TypeError('Failed to fetch'); };
  eq('F5 een gewone netwerkfout blijft zichzelf', await outcome(fetchWithTimeout('u', {}, 20, async () => 1, offline)), 'fout:Failed to fetch');

  const service = readFileSync(join(process.cwd(), 'src/extensions/extensionService.ts'), 'utf8');
  eq('F6 extensionService: geen kale fetch meer', /(^|[^.\w])fetch\(/m.test(service.replace(/\/\/.*$/gm, '')), false);
  eq('F7 catalogus en ZIP met hun eigen limiet', [
    /fetchWithTimeout\(CATALOG_URL,[^\n]*CATALOG_FETCH_TIMEOUT_MS/.test(service),
    /fetchWithTimeout\(entry\.downloadUrl,[^\n]*EXTENSION_DOWNLOAD_TIMEOUT_MS/.test(service),
  ], [true, true]);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: eerste start — ${checks} checks groen`);
} else {
  console.log(`XX eerste start — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
