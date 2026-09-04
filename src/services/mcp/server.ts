// MCP-bridge — server-levenscyclus (fase 1, spec §Beveiliging & levenscyclus).
//
// Deze module bedient de Tauri-only bridge: token verzekeren, `mcp_bridge_start`/`mcp_bridge_stop`
// invoken, en de twee Tauri-events koppelen aan de dispatcher + de ui-state:
//   - `mcp://request`  {id, body}  → `handleMcpMessage(body, ctx)` → emit `mcp://response` {id, body}
//   - `mcp://status`   {state, port, message} → `setAiServerStatus(...)`
//
// HARDE REPO-REGEL: een top-niveau `import` van `@tauri-apps/*` breekt de web-build. Daarom staan
// ALLE Tauri-imports achter `isTauri()` als dynamische `import(...)` binnen `startMcpServer`/
// `stopMcpServer`. De kern-bouwstenen (`createRequestHandler`, `createStatusHandler`,
// `attemptBridgeStart`, `buildMcpContext`, `ensureMcpToken`/`generateToken`) nemen hun Tauri-randen
// als injecteerbare functies, zodat ze headless — zonder Tauri — te testen zijn (`tests/mcp/`).
//
// De per-request `ctx` is VOLLEDIG aangesloten (SYNC-2): `paused`/`readOnly` komen live uit de
// ui-state, `expectedDocId` (drift-anker) en `tempIdMap` (batch-executor) zijn per verbinding
// meegroeiende velden, en `ensureBackup` wijst naar de ECHTE AI-backup uit `backup.ts` — geen stub
// meer. `initMcpRuntime()` hieronder registreert de tool-modules; de T16-backupfuncties reizen als
// één contextbinding met ieder request mee. Zie de tool-contracten in `contracts.ts` (`McpContext`).

import { appStoreContext, useAppStore, type AppStoreContext } from '@/state/appStore';
import { mcpTransactions } from '@/state/mcpTransaction';
import { createMcpTransactions, type McpTransactions } from '@/state/runtime/createMcpTransactions';
import { loadMcpPort, loadMcpToken, saveMcpToken, saveAiMode } from '@/utils/settingsStore';
import { handleMcpMessage } from './dispatcher';
import { record as recordActivity, capField } from './activityLog';
import { createAppBackupService, ensureBackup, resetBackupSession, markDuplicateBorn } from './backup';
import { registerAllTools } from './toolRegistry';
import type { McpBackupBinding, McpContext, McpServerStatus, ActivityEntry } from './contracts';

/** Draaien we in de Tauri-shell? (zelfde runtime-poort als de rest van de app-code). */
const isTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// --- Runtime-init (SYNC-2: de integratiedraden tussen de tool-banen) ------------------------------

/**
 * Knoop de losse tool-banen aan elkaar. Idempotent en zonder Tauri-afhankelijkheid, dus veilig om
 * meermaals én in de web-build aan te roepen. Twee draden:
 *
 * **De toolregistratie.** `toolRegistry.ts` registreert zichzelf al bij module-load, maar dat is
 *     een side-effect van het importeren. Deze expliciete aanroep garandeert dat `tools/list` in de
 *     echte app de VOLLEDIGE set toont, ook als een eerdere (test-)aanroep de registratie tot een
 *     deelverzameling had afgeknot. De T16-backupbinding zit niet langer in module-init: iedere
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
 * Pas de AI-modus toe (T14, spec §UI): schrijf de ui-spiegel + persisteer. Bij UITZETTEN wordt de
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
 * kan ze tussen requests door omzetten). `expectedDocId` begint op null en `tempIdMap` is leeg.
 * De backup-hook hoort bij dezelfde storecontext. De app-singleton behoudt de publieke, Tauri-gated
 * wrapper; een custom context krijgt zijn eigen per-context service. Tests en andere composition
 * roots mogen die hook expliciet injecteren.
 */
export function buildMcpContext(
  app: AppStoreContext = appStoreContext,
  transactions?: McpTransactions,
  backupOverride?: McpBackupBinding,
): McpContext {
  const ui = app.store.getState().ui;
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
  return {
    app,
    transactions: transactions ?? (app === appStoreContext ? mcpTransactions : createMcpTransactions(app)),
    expectedDocId: null,
    tempIdMap: new Map<string, string>(),
    paused: ui.aiPaused,
    readOnly: ui.aiReadOnly,
    ensureBackup: backup.ensureBackup,
    markDuplicateBorn: backup.markDuplicateBorn,
  };
}

// --- Request-handler (injecteerbaar → headless testbaar) -----------------------------------------

export interface RequestHandlerDeps {
  /** Emit-functie (echt: Tauri `emit`); ontvangt het event + payload. */
  emit: (event: string, payload: unknown) => void | Promise<void>;
  /** Bouwt de per-request ctx (echt: `buildMcpContext`). */
  buildContext: () => McpContext;
  /** Verwerkt de rauwe JSON-RPC-body (echt: `handleMcpMessage`). */
  handleMessage: (body: string, ctx: McpContext) => Promise<string>;
}

// --- Activiteits-samenvatting (T15) --------------------------------------------------------------

/**
 * Vat de args van een `tools/call` compact samen voor het activiteitenpaneel: het eerste array-veld
 * wordt "N <veld>" (bijv. "42 tasks"); ontbreekt dat, dan de veldnamen; lege args → "". Bewust géén
 * i18n (de samenvatting is opgeslagen data, geen UI-string) en bewust generiek (geen per-tool-kennis
 * — dit blijft correct als er nieuwe tools bijkomen).
 */
function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return '';
  const obj = args as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) return `${v.length} ${k}`;
  }
  const keys = Object.keys(obj);
  return keys.length ? keys.join(', ') : '';
}

/** Best-effort foutmelding uit een MCP-tool-fout-respons (result.isError) — content-tekst of niets. */
function extractToolError(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const r = result as Record<string, unknown>;
  const content = r.content;
  if (Array.isArray(content)) {
    for (const c of content) {
      if (c && typeof c === 'object' && typeof (c as any).text === 'string') return (c as any).text;
    }
  }
  return undefined;
}

/**
 * Parse request- + respons-body licht (try/catch) en `record` één `ActivityEntry`: tijdstip, tool/
 * methode, compacte samenvatting, duur, ok/fout (+ evt. foutcode), en de volledige args/result-JSON
 * (afgekapt op 20 kB per veld). Notificaties (lege respons-body) worden NIET gelogd — het paneel toont
 * request/respons-paren, geen fire-and-forget-notificaties. Nooit gooien: het log mag de bridge niet
 * kunnen breken.
 */
function recordRequestActivity(reqBody: string, respBody: string, durationMs: number): void {
  // Notificatie ⇒ geen respons-body ⇒ niet loggen.
  if (!respBody) return;
  try {
    let method = '?';
    let tool = '?';
    let argsJson = '';
    let summary = '';
    try {
      const req = JSON.parse(reqBody) as { method?: unknown; params?: any };
      method = typeof req.method === 'string' ? req.method : '?';
      if (method === 'tools/call' && req.params && typeof req.params === 'object') {
        tool = typeof req.params.name === 'string' ? req.params.name : '?';
        const args = req.params.arguments ?? {};
        argsJson = JSON.stringify(args);
        const argsSummary = summarizeArgs(args);
        summary = argsSummary ? `${tool}: ${argsSummary}` : tool;
      } else {
        tool = method;
        argsJson = req.params !== undefined ? JSON.stringify(req.params) : '';
        summary = method;
      }
    } catch {
      summary = 'onparseerbaar request';
    }

    let ok = true;
    let error: string | undefined;
    try {
      const resp = JSON.parse(respBody) as { error?: any; result?: any };
      if (resp.error) {
        ok = false;
        const code = resp.error.code;
        const msg = typeof resp.error.message === 'string' ? resp.error.message : '';
        error = code != null ? `${code}: ${msg}` : (msg || 'fout');
      } else if (resp.result && resp.result.isError === true) {
        ok = false;
        error = extractToolError(resp.result);
      }
    } catch {
      // Onparseerbaar antwoord: markeer als fout zodat het in het paneel opvalt.
      ok = false;
      error = 'onparseerbaar antwoord';
    }

    const entry: ActivityEntry = {
      ts: Date.now(),
      tool,
      summary,
      durationMs,
      ok,
      ...(error ? { error } : {}),
      argsJson: capField(argsJson),
      resultJson: capField(respBody),
    };
    recordActivity(entry);
  } catch {
    /* het activiteitenlog mag de request-flow nooit kunnen breken */
  }
}

/**
 * Maak de `mcp://request`-handler. Elk request draait door de dispatcher; het antwoord gaat 1-op-1
 * terug als `mcp://response` met HETZELFDE Rust-correlatie-id. Óók een notificatie (lege respons-
 * body) wordt geëmit — de Rust-loop correleert op id en wacht altijd op een antwoord, dus een
 * uitgebleven emit zou daar in een timeout lopen.
 */
export function createRequestHandler(
  deps: RequestHandlerDeps,
): (payload: { id: number; body: string }) => Promise<void> {
  return async (payload) => {
    const ctx = deps.buildContext();
    const start = performance.now();
    const body = await deps.handleMessage(payload.body, ctx);
    // T15: leg de aanroep vast in het activiteitenlog (notificaties = lege body worden overgeslagen).
    recordRequestActivity(payload.body, body, performance.now() - start);
    await deps.emit('mcp://response', { id: payload.id, body });
  };
}

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
}

export interface BridgeController {
  start: () => Promise<void>;
  stop: () => Promise<void>;
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
  let unlisteners: Array<() => void> = [];
  let starting = false;

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
      });
      const onStatus = createStatusHandler({ setStatus: deps.setStatus });

      const unReq = await deps.listen<{ id: number; body: string }>('mcp://request', (p) => { void onRequest(p); });
      const unStatus = await deps.listen<{ state: string; port: number; message?: string }>('mcp://status', (p) => { onStatus(p); });
      unlisteners = [unReq, unStatus];

      const started = await attemptBridgeStart({ invoke: deps.invoke, setStatus: deps.setStatus, port, token });
      if (!started) {
        // Bind mislukt: `attemptBridgeStart` heeft net (synchroon, in de invoke-reject-catch)
        // `setStatus(port-busy)` gezet; hier ruimen we — óók synchroon, zonder tussenliggende
        // event-loop-turn (geen macrotask-yield tussen setStatus en deze cleanup) — de listeners op.
        // Daardoor is de `mcp://status`-listener al afgemeld voordat het aparte Rust "error"-event
        // (dat `mcp_bridge_start` vóór zijn Err emit) als nieuwe taak kan binnenkomen: dat event zou
        // anders via `mapRustState` de status naar 'error' zetten en onze 'port-busy' overschrijven.
        cleanup();
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
  }

  return { start, stop, activeListenerCount: () => unlisteners.length };
}

// --- Live wiring (Tauri-only; achter isTauri(), niet headless getest — dat is E2E/poort 2) --------

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
  resetBackupSession(); // verse server-sessie ⇒ per-document auto-backup-tellers leeg (spec §Triggerregels)
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
