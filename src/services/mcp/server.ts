// MCP-bridge — server-levenscyclus.
//
// Deze module bedient de Tauri-only bridge: token verzekeren, `mcp_bridge_start`/`mcp_bridge_stop`
// invoken, en de twee Tauri-events koppelen aan de dispatcher + de ui-state:
//   - `mcp://request`  {id, body, sessionId?} → `handleMcpMessage(body, ctx)` → emit `mcp://response`
//     {id, body, sessionId?, status?} (sessie-afhandeling: zie `createRequestHandler`)
//   - `mcp://status`   {state, port, message} → `setAiServerStatus(...)`
//
// HARDE REPO-REGEL: een top-niveau `import` van `@tauri-apps/*` breekt de web-build. Daarom staan
// ALLE Tauri-imports achter `isTauri()` als dynamische `import(...)` binnen `startMcpServer`/
// `stopMcpServer`. De kern-bouwstenen (`createRequestHandler`, `createStatusHandler`,
// `attemptBridgeStart`, `buildMcpContext`, `ensureMcpToken`/`generateToken`) nemen hun Tauri-randen
// als injecteerbare functies, zodat ze headless — zonder Tauri — te testen zijn (`tests/mcp/`).
//
// De per-request `ctx`: `paused`/`readOnly` komen live uit de ui-state, `expectedDocId`
// (drift-anker) leeft per verbinding (de request-handler draagt hem van request naar request over),
// `tempIdMap` (batch-executor) is per request, en `ensureBackup` wijst naar de AI-backup uit
// `backup.ts`. `initMcpRuntime()` hieronder registreert de tool-modules; de backupfuncties reizen als
// één contextbinding met ieder request mee. Zie de tool-contracten in `contracts.ts` (`McpContext`).

import { appStoreContext, useAppStore, type AppStoreContext } from '@/state/appStore';
import { mcpTransactions } from '@/state/mcpTransaction';
import { createMcpTransactions, type McpTransactions } from '@/state/runtime/createMcpTransactions';
import { loadMcpPort, loadMcpToken, saveMcpToken, saveAiMode } from '@/utils/settingsStore';
import { isTauri } from '@/utils/platform';
import { handleMcpMessage } from './dispatcher';
import { createAppBackupService, ensureBackup, resetBackupSession, markDuplicateBorn } from './backup';
import { registerAllTools } from './toolRegistry';
import { getMcpDiscoveryWriter } from './discoveryFiles';
import { createMcpContext } from './context';
import type { McpBackupBinding, McpContext, McpServerStatus } from './contracts';
import {
  createRequestHandler, createMcpSessionTable, type McpRequestEvent, type McpSessionTable,
} from './requestHandler';

// --- Runtime-init ---------------------------------------------------------------------------------

/**
 * Registreer de toolset. Idempotent en zonder Tauri-afhankelijkheid, dus veilig om meermaals én in
 * de web-build aan te roepen.
 *
 * **De toolregistratie.** `toolRegistry.ts` registreert zichzelf al bij module-load, maar dat is
 *     een side-effect van het importeren. Deze expliciete aanroep garandeert dat `tools/list` in de
 *     echte app de VOLLEDIGE set toont, ook als een eerdere (test-)aanroep de registratie tot een
 *     deelverzameling had afgeknot. De backupbinding zit niet in module-init: iedere
 *     `McpContext` draagt `ensureBackup` en `markDuplicateBorn` van exact dezelfde service.
 */
export function initMcpRuntime(): void {
  registerAllTools();
}

// Bij module-load uitvoeren; `startMcpServer` herhaalt dit idempotent zodat een test die de registry
// afknot de volledige productie-toolset weer terugkrijgt.
initMcpRuntime();

// --- Token ---------------------------------------------------------------------------------------

/** Genereer een vers Bearer-token: 32 crypto-random bytes, hex-gecodeerd (64 tekens). */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Verzeker een persistent bridge-token: lees `ops-mcpToken`; ontbreekt hij, genereer een nieuw
 * (32 bytes crypto-random, hex) en persisteer 'm. Geeft altijd hetzelfde token terug zolang de
 * gebruiker niet regenereert.
 */
export function ensureMcpToken(): string {
  const existing = loadMcpToken();
  if (existing) return existing;
  const token = generateToken();
  saveMcpToken(token);
  return token;
}

/**
 * Regenereer het bridge-token: genereer een vers token en overschrijf de gepersisteerde waarde.
 * Verbreekt bewust alle bestaande koppelingen (die dragen het oude token) — de UI vraagt daarom
 * eerst om bevestiging. Geeft het nieuwe token terug.
 */
export function regenerateMcpToken(): string {
  const token = generateToken();
  saveMcpToken(token);
  return token;
}

/**
 * Regenereer het token én trek het oude echt in (audit 2026-09-26). De Rust-bridge kopieert het
 * token bij `mcp_bridge_start`; alleen de opgeslagen waarde vervangen liet een uitgelekt token
 * gewoon werken tot de volgende herstart, terwijl de bevestigingstekst belooft dat bestaande
 * koppelingen verbroken worden. Draait de bridge, dan herstarten we hem met het nieuwe token (via
 * de bestaande commands — geen nieuw Rust-oppervlak).
 */
export async function regenerateAndApplyMcpToken(isRunning: () => boolean): Promise<string> {
  const token = regenerateMcpToken();
  // Nieuw token = alle oude koppelingen vervallen, dus ook hun sessies en documentbindingen: wie opnieuw
  // verbindt, begint een nieuwe sessie en bindt opnieuw. Ook als de bridge niet draait.
  appMcpSessions.clear();
  if (isTauri() && isRunning()) {
    // Het nieuwe token staat al opgeslagen: ook als de herstart faalt (bv. `listen` of de dynamische
    // import werpt) moet het veld het tonen, anders liet de UI het oude, niet meer geldige token zien.
    try {
      const controller = await getLiveController();
      await controller.restart();
    } catch (error) {
      console.error('MCP: herstart na nieuw token mislukt:', error);
    }
  }
  return token;
}

// --- AI-modus-toggle (injecteerbaar → headless testbaar) -----------------------------------------

export interface ApplyAiModeDeps {
  /** Schrijf de ui-spiegel (echt: `setUI({ aiMode })`). */
  setAiMode: (value: boolean) => void;
  /** Persisteer de setting (echt: `saveAiMode`). */
  persist: (value: boolean) => void | Promise<void>;
  /** Stop de bridge (echt: `stopMcpServer`); alleen aangeroepen bij uitzetten. */
  stopServer: () => void | Promise<void>;
  /** Zet de serverstatus (echt: `setAiServerStatus`); geforceerd off bij uitzetten. */
  setStatus: (status: McpServerStatus) => void;
  /** Poort voor het off-statusobject (echt: `loadMcpPort()`). */
  port: number;
}

/**
 * Pas de AI-modus toe: schrijf de ui-spiegel + persisteer. Bij UITZETTEN wordt de
 * bridge geforceerd gestopt en de serverstatus expliciet op `off` gezet (op de web-build is
 * `stopMcpServer` een no-op, dus de status-reset moet hier gebeuren, niet uit een stop-event).
 * De reducer (`setUI`) valt zelf al terug naar de start-tab als het AI-tabblad actief was.
 */
export async function applyAiMode(value: boolean, deps: ApplyAiModeDeps): Promise<void> {
  deps.setAiMode(value);
  await deps.persist(value);
  if (!value) {
    await deps.stopServer();
    deps.setStatus({ state: 'off', port: deps.port });
  }
}

/** Productie-wiring van `applyAiMode` op de echte store + settings + bridge-lifecycle. */
export function applyAiModeLive(value: boolean): Promise<void> {
  const state = useAppStore.getState();
  return applyAiMode(value, {
    setAiMode: (v) => state.setUI({ aiMode: v }),
    persist: saveAiMode,
    stopServer: stopMcpServer,
    setStatus: state.setAiServerStatus,
    port: loadMcpPort(),
  });
}

// --- Per-request context -------------------------------------------------------------------------

/**
 * Bouw de `McpContext` voor één request. Store en transacties worden samen gebonden: de app-singleton
 * hergebruikt zijn compatibiliteitsfactory, een geïnjecteerde context krijgt standaard een verse
 * factory rond diezelfde runtime. `paused`/`readOnly` worden LIVE uit die ui-state gelezen (de user
 * kan ze tussen requests door omzetten). `expectedDocId` begint op null (de request-handler zet het
 * anker van de verbinding erin) en `tempIdMap` is leeg.
 * De backup-hook hoort bij dezelfde storecontext. De app-singleton behoudt de publieke, Tauri-gated
 * wrapper; een custom context krijgt zijn eigen per-context service. Tests en andere composition
 * roots mogen die hook expliciet injecteren.
 */
export function buildMcpContext(
  app: AppStoreContext = appStoreContext,
  transactions?: McpTransactions,
  backupOverride?: McpBackupBinding,
): McpContext {
  const contextBackupService = app === appStoreContext ? null : createAppBackupService(app);
  const backup: McpBackupBinding = backupOverride ?? (
    app === appStoreContext
      ? { ensureBackup, markDuplicateBorn }
      : {
          ensureBackup: (docId, kind) => isTauri()
            ? contextBackupService!.ensureBackup(docId, kind)
            : Promise.resolve(null),
          markDuplicateBorn: contextBackupService!.markDuplicateBorn,
        }
  );
  return createMcpContext(
    app,
    transactions ?? (app === appStoreContext ? mcpTransactions : createMcpTransactions(app)),
    backup,
  );
}

// --- Request-handler (verplaatst naar `requestHandler.ts`; hier opnieuw geëxporteerd) ------------

export {
  createRequestHandler, createMcpSessionTable, MCP_MAX_SESSIONS, MCP_QUEUE_DEADLINE_MS,
  type RequestHandlerDeps, type McpRequestEvent, type McpResponseEvent, type McpSessionTable,
} from './requestHandler';

/**
 * De sessietabel van deze app-sessie (de webview). Leeft langer dan één bridge-start: stop/start en een
 * poortwissel behouden sessies en ankers, zodat een client na een herstart met zijn oude sessie-id gewoon
 * `DOC_DRIFT` blijft krijgen. Alleen een nieuw token wist hem (`regenerateAndApplyMcpToken`). Een herstart
 * van de hele app begint leeg; dat is een nieuwe start.
 */
export const appMcpSessions: McpSessionTable = createMcpSessionTable();

// --- Status-handler (injecteerbaar) --------------------------------------------------------------

/**
 * Map de Rust-statusstring (`mcp_bridge.rs` emit "running"/"stopped"/"error") naar de bevroren
 * contract-state (`McpServerStatus`). `port-busy` komt NIET uit een status-event maar uit de
 * `mcp_bridge_start`-fout (zie `attemptBridgeStart`).
 */
function mapRustState(state: string): McpServerStatus['state'] {
  switch (state) {
    case 'running': return 'live';
    case 'stopped': return 'off';
    default: return 'error';
  }
}

export interface StatusHandlerDeps {
  setStatus: (status: McpServerStatus) => void;
}

/** Maak de `mcp://status`-handler: mapt de Rust-state en schrijft de ui-state bij. */
export function createStatusHandler(
  deps: StatusHandlerDeps,
): (payload: { state: string; port: number; message?: string }) => void {
  return (payload) => {
    deps.setStatus({
      state: mapRustState(payload.state),
      port: payload.port,
      // Rust stuurt bij succes een lege message; die laten we weg zodat het statusobject schoon blijft.
      ...(payload.message ? { message: payload.message } : {}),
    });
  };
}

// --- Bridge-start (injecteerbaar → poort-bezet-test zonder Tauri) --------------------------------

export interface AttemptStartDeps {
  invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown>;
  setStatus: (status: McpServerStatus) => void;
  port: number;
  token: string;
}

/**
 * Roep `mcp_bridge_start` aan. Slaagt de bind → `true` (de "live"-status volgt uit het
 * `mcp://status`-event, dus we schrijven hier niets). Faalt de bind (poort bezet / andere bind-
 * fout) → vertaal de invoke-fout naar `state:'port-busy'` mét melding en geef `false`. Nooit stil
 * doorschuiven.
 */
export async function attemptBridgeStart(deps: AttemptStartDeps): Promise<boolean> {
  try {
    await deps.invoke('mcp_bridge_start', { port: deps.port, token: deps.token });
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    deps.setStatus({ state: 'port-busy', port: deps.port, message });
    return false;
  }
}

// --- Levenscyclus-controller (injecteerbaar → listener-boekhouding headless testbaar) ------------

/**
 * De Tauri-randen die de bridge-controller nodig heeft, als injecteerbare functies. De echte
 * wiring (achter `isTauri()`, met dynamische `@tauri-apps/*`-imports) zit in `buildLiveController`;
 * de headless tests injecteren fakes (`tests/mcp/cases-server.ts`) en tellen zo de listener-
 * boekhouding + de dubbel-start-guard zonder Tauri.
 */
export interface BridgeDeps {
  /** Koppel een event-handler; resolve met de unlisten-callback (echt: Tauri `listen`). */
  listen: <T>(event: string, handler: (payload: T) => void) => Promise<() => void>;
  invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown>;
  emit: (event: string, payload: unknown) => void | Promise<void>;
  setStatus: (status: McpServerStatus) => void;
  buildContext: () => McpContext;
  handleMessage: (body: string, ctx: McpContext) => Promise<string>;
  getPort: () => number;
  getToken: () => string;
  /** Sessietabel die alle starts van deze controller delen (echt: `appMcpSessions`). Ontbreekt hij, dan
   *  maakt de controller er één voor zijn hele levensduur. */
  sessions?: McpSessionTable;
  /** De bridge draait nu op `port` met `token` (echt: `runtime.json` schrijven, zie `discoveryFiles.ts`).
   *  Een fout hier stopt de bridge niet. */
  onBridgeStarted?: (port: number, token: string) => void | Promise<void>;
  /** Er draait geen bridge meer: na een stop of een mislukte start (echt: `runtime.json` verwijderen). */
  onBridgeStopped?: () => void | Promise<void>;
}

export interface BridgeController {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** Stop + start: pikt een gewijzigd token (of poort) op zonder dat de gebruiker het doet. Sessies en
   *  ankers blijven (zie `appMcpSessions`). */
  restart: () => Promise<void>;
  /** Aantal op dit moment gekoppelde listeners (test-inspectie). */
  activeListenerCount: () => number;
}

/**
 * Bouw een bridge-controller die zijn eigen listener-boekhouding + dubbel-start-guard omsluit.
 * Invarianten:
 *   - **Nooit verweesde `mcp://request`-listeners:** `start()` ruimt eerst een eventuele vorige set
 *     op (`cleanup()`) vóór het registreren. Twee gekoppelde request-listeners zouden elk request
 *     dubbel door de dispatcher laten lopen → dubbele mutaties.
 *   - **Geen re-entry:** een `starting`-vlag laat een tweede *gelijktijdige* `start()` vroeg
 *     returnen (geen spuriëuze `port-busy` terwijl de bridge gewoon opstart).
 */
export function createBridgeController(deps: BridgeDeps): BridgeController {
  // Eén tabel voor alle starts: een herstart (nieuw token, poortwissel, handmatig stop/start) mag een
  // client zijn documentbinding niet laten verliezen (review 3 PR #439).
  const sessions = deps.sessions ?? createMcpSessionTable();
  let unlisteners: Array<() => void> = [];
  let starting = false;

  /** Meld een start of stop aan de ontdekkingsbestanden; een fout daar raakt de bridge niet. */
  async function notify(hook: (() => void | Promise<void>) | undefined): Promise<void> {
    if (!hook) return;
    try { await hook(); } catch (error) { console.warn('MCP: ontdekkingsbestand bijwerken mislukt:', error); }
  }

  function cleanup(): void {
    for (const un of unlisteners) {
      try { un(); } catch { /* al afgemeld — niet fataal */ }
    }
    unlisteners = [];
  }

  async function start(): Promise<void> {
    // In-flight-lock: een tweede gelijktijdige start vroeg afwijzen (de eerste is nog bezig).
    if (starting) return;
    starting = true;
    try {
      // Defensief: verweesde listeners van een vorige (half-)start eerst opruimen — nooit een
      // dubbele mcp://request-listener overhouden (elk request zou dan dubbel gedispatcht worden).
      cleanup();

      const port = deps.getPort();
      const token = deps.getToken();

      const onRequest = createRequestHandler({
        emit: deps.emit,
        buildContext: deps.buildContext,
        handleMessage: deps.handleMessage,
        sessions,
      });
      const onStatus = createStatusHandler({ setStatus: deps.setStatus });

      const unReq = await deps.listen<McpRequestEvent>('mcp://request', (p) => { void onRequest(p); });
      const unStatus = await deps.listen<{ state: string; port: number; message?: string }>('mcp://status', (p) => { onStatus(p); });
      unlisteners = [unReq, unStatus];

      // Eerste poging stil: mislukt hij, dan kan het zijn dat de Rust-bridge van een eerdere
      // webview-sessie nog draait (herlaad van de webview: JS-status is weer "uit", Rust luistert
      // nog) — `mcp_bridge_start` zegt dan "draait al", en zonder herstel bleef de status op
      // port-busy hangen terwijl requests naar een listener gingen die er niet meer was. Daarom één
      // keer stoppen (onschadelijk als er niets draait) en opnieuw; pas die tweede mislukking is
      // echt port-busy.
      let started = await attemptBridgeStart({ invoke: deps.invoke, setStatus: () => {}, port, token });
      if (!started) {
        try { await deps.invoke('mcp_bridge_stop', {}); } catch { /* er draaide niets — prima */ }
        started = await attemptBridgeStart({ invoke: deps.invoke, setStatus: deps.setStatus, port, token });
      }
      if (!started) {
        // Bind mislukt: `attemptBridgeStart` heeft net (synchroon, in de invoke-reject-catch)
        // `setStatus(port-busy)` gezet; hier ruimen we — óók synchroon, zonder tussenliggende
        // event-loop-turn (geen macrotask-yield tussen setStatus en deze cleanup) — de listeners op.
        // Daardoor is de `mcp://status`-listener al afgemeld voordat het aparte Rust "error"-event
        // (dat `mcp_bridge_start` vóór zijn Err emit) als nieuwe taak kan binnenkomen: dat event zou
        // anders via `mapRustState` de status naar 'error' zetten en onze 'port-busy' overschrijven.
        cleanup();
        await notify(deps.onBridgeStopped);
      } else {
        await notify(deps.onBridgeStarted ? () => deps.onBridgeStarted!(port, token) : undefined);
      }
    } finally {
      starting = false;
    }
  }

  async function stop(): Promise<void> {
    // Eerst afmelden: de stop-invoke emit weliswaar een "stopped"-event, maar we willen dat niet
    // meer verwerken — de status zetten we hieronder expliciet op off.
    cleanup();
    try { await deps.invoke('mcp_bridge_stop', {}); } catch { /* al gestopt / geen bridge — niet fataal */ }
    deps.setStatus({ state: 'off', port: deps.getPort() });
    await notify(deps.onBridgeStopped);
  }

  async function restart(): Promise<void> {
    await stop();
    await start();
  }

  return { start, stop, restart, activeListenerCount: () => unlisteners.length };
}

// --- Live wiring (Tauri-only; achter isTauri(), niet headless getest) ----------------------------

/** Gecachte controller-belofte: gedeeld over alle start/stop-aanroepen zodat er nooit twee losse
 *  controllers (elk met een eigen listener-set) ontstaan bij een gelijktijdige start. */
let liveControllerPromise: Promise<BridgeController> | null = null;

async function buildLiveController(): Promise<BridgeController> {
  const { invoke } = await import('@tauri-apps/api/core');
  const { emit, listen } = await import('@tauri-apps/api/event');
  return createBridgeController({
    listen: <T>(event: string, handler: (payload: T) => void) =>
      listen<T>(event, (ev) => handler(ev.payload)),
    invoke: (cmd, args) => invoke(cmd, args),
    emit: (event, payload) => emit(event, payload),
    setStatus: useAppStore.getState().setAiServerStatus,
    buildContext: buildMcpContext,
    handleMessage: handleMcpMessage,
    getPort: loadMcpPort,
    getToken: ensureMcpToken,
    sessions: appMcpSessions,
    // `runtime.json` voor de MCP-plugin (issue #570); de writer is alleen in de desktop-app actief.
    onBridgeStarted: (port, token) => getMcpDiscoveryWriter()?.bridgeStarted(port, token),
    onBridgeStopped: () => getMcpDiscoveryWriter()?.bridgeStopped(),
  });
}

function getLiveController(): Promise<BridgeController> {
  if (!liveControllerPromise) liveControllerPromise = buildLiveController();
  return liveControllerPromise;
}

/**
 * Start de bridge: token verzekeren, de twee events koppelen, dan `mcp_bridge_start` invoken. Web-
 * build / niet-Tauri = no-op. Dubbel-start-veilig via de gedeelde controller + zijn in-flight-lock.
 */
export async function startMcpServer(): Promise<void> {
  initMcpRuntime(); // backup-naad + volledige toolregistratie (idempotent; zie initMcpRuntime)
  if (!isTauri()) return;
  resetBackupSession(); // verse server-sessie ⇒ per-document auto-backup-tellers leeg
  const controller = await getLiveController();
  await controller.start();
}

/**
 * Stop de bridge netjes: listeners afmelden, `mcp_bridge_stop` invoken, ui-status op off. Web-build
 * / niet-Tauri = no-op.
 */
export async function stopMcpServer(): Promise<void> {
  if (!isTauri()) return;
  const controller = await getLiveController();
  await controller.stop();
}
