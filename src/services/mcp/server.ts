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
import { record as recordActivity, capField } from './activityLog';
import { createAppBackupService, ensureBackup, resetBackupSession, markDuplicateBorn } from './backup';
import { registerAllTools } from './toolRegistry';
import type { McpBackupBinding, McpContext, McpServerStatus, ActivityEntry } from './contracts';

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
  /** Klok in ms (test-injectie; echt: `Date.now`). */
  now?: () => number;
  /** Nieuwe sessie-id (test-injectie; echt: 16 crypto-random bytes, hex). Alleen gebruikt als
   *  `sessions` ontbreekt. */
  newSessionId?: () => string;
  /** De sessietabel. Echt: één per app-sessie (`appMcpSessions`, via de bridge-controller), zodat een
   *  bridge-herstart sessies en ankers behoudt. Ontbreekt hij, dan krijgt deze handler een eigen tabel. */
  sessions?: McpSessionTable;
}

/** Eén request zoals Rust het doorgeeft: de body plus de `Mcp-Session-Id`-header als die er was. */
export interface McpRequestEvent {
  id: number;
  body: string;
  sessionId?: string | null;
}

/** Het antwoord terug naar Rust. `sessionId` ⇒ Rust zet de `Mcp-Session-Id`-header; `status` ⇒ Rust
 *  antwoordt met die HTTP-status in plaats van 200: `400` (sessie-header ontbreekt, met JSON-RPC-fout als
 *  body) of `404` (onbekende sessie, zonder body). */
export interface McpResponseEvent {
  id: number;
  body: string;
  sessionId?: string;
  status?: number;
}

/**
 * Zoveel MCP-sessies (elk met een eigen drift-anker) onthoudt de app. Een nieuwe sessie boven die grens
 * verdringt de oudste sessie ZONDER anker (die heeft geen binding te verliezen; de client krijgt `404` en
 * begint opnieuw). Een sessie MET anker wordt nooit verdrongen: anders landde de mutatie van een client die
 * net `DOC_DRIFT` kreeg na zijn nieuwe `initialize` stil op het andere tabblad (review 3 PR #439). Zijn alle
 * plekken bezet door sessies met anker, dan weigert de app een nieuwe `initialize` met een JSON-RPC-fout.
 * 32 is ruim boven wat een gebruiker tegelijk koppelt (één tot een paar AI-clients).
 */
export const MCP_MAX_SESSIONS = 32;

/** De sessietabel: sessie-id → drift-anker (`null` = nog niet gebonden). */
export interface McpSessionTable {
  has(id: string): boolean;
  anchor(id: string): string | null;
  setAnchor(id: string, anchor: string | null): void;
  /** Is er plek voor een nieuwe sessie (eventueel door een sessie zonder anker te verdringen)? */
  canOpen(): boolean;
  /** Open een nieuwe sessie; verdringt zo nodig de oudste sessie zonder anker. `null` = vol. */
  open(): string | null;
  /** Alle sessies weg (nieuw token: oude koppelingen gelden niet meer). */
  clear(): void;
  size(): number;
}

export function createMcpSessionTable(
  newSessionId: () => string = randomSessionId,
  max: number = MCP_MAX_SESSIONS,
): McpSessionTable {
  // Map-volgorde = volgorde van openen; de oudste sessie zonder anker gaat eerst.
  const anchors = new Map<string, string | null>();
  const oldestUnanchored = (): string | undefined => {
    for (const [id, anchor] of anchors) if (anchor === null) return id;
    return undefined;
  };
  return {
    has: (id) => anchors.has(id),
    anchor: (id) => anchors.get(id) ?? null,
    setAnchor: (id, anchor) => { if (anchors.has(id)) anchors.set(id, anchor); },
    canOpen: () => anchors.size < max || oldestUnanchored() !== undefined,
    open: () => {
      if (anchors.size >= max) {
        const victim = oldestUnanchored();
        if (victim === undefined) return null;
        anchors.delete(victim);
      }
      const id = newSessionId();
      anchors.set(id, null);
      return id;
    },
    clear: () => { anchors.clear(); },
    size: () => anchors.size,
  };
}

/**
 * De sessietabel van deze app-sessie (de webview). Leeft langer dan één bridge-start: stop/start en een
 * poortwissel behouden sessies en ankers, zodat een client na een herstart met zijn oude sessie-id gewoon
 * `DOC_DRIFT` blijft krijgen. Alleen een nieuw token wist hem (`regenerateAndApplyMcpToken`). Een herstart
 * van de hele app begint leeg; dat is een nieuwe start.
 */
export const appMcpSessions: McpSessionTable = createMcpSessionTable();

function randomSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Hoe lang een request in de wachtrij mag staan voordat het NIET meer wordt uitgevoerd. Rust geeft
 * na `RESPONSE_TIMEOUT` (120 s, `mcp_bridge.rs`) de client al een 504; een daarna alsnog uitgevoerde
 * mutatie zou de client als mislukt zien en bij een retry dubbel landen. De marge (10 s) dekt de
 * tijd tussen Rusts klok-start en de aankomst van het event hier: liever een request te veel
 * weigeren (niet uitgevoerd + fout = consistent) dan er een te veel uitvoeren.
 */
export const MCP_QUEUE_DEADLINE_MS = 110_000;

// --- Activiteits-samenvatting --------------------------------------------------------------------

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
 *
 * SESSIES (MCP streamable HTTP, `Mcp-Session-Id`; reviewrondes 1 en 2 van PR #439). Elke geslaagde
 * `initialize` krijgt een nieuwe sessie-id; Rust zet die als header op het antwoord en geeft de header van
 * latere requests door. Het drift-anker hoort bij de sessie en bij niets anders:
 *   - ELK request behalve `initialize` moet een bekende sessie-id dragen, ook leesrequests, pings en
 *     notificaties. Ontbreekt de header: `400` met een JSON-RPC-fout (de spec: "Servers that require a
 *     session ID SHOULD respond to requests without an Mcp-Session-Id header (other than initialization)
 *     with HTTP 400 Bad Request"). Onbekend (verdrongen zonder anker, na een nieuw token of na een herstart
 *     van de app): `404` zonder body, waarna de client volgens de spec opnieuw initialiseert. Eén regel voor alles is het
 *     eenvoudigste dat spec-conform is: er bestaat geen pad meer waarlangs een request zonder sessie
 *     een tool draait, dus ook geen gedeeld anker dat een ander kan wissen.
 *   - Een `initialize` raakt nooit het anker van een andere sessie; een `initialize` zonder `id` is een
 *     notificatie, maakt geen sessie en raakt niets.
 * De sessietabel zit hier en niet in Rust: alleen deze laag weet of een antwoord een geslaagde
 * `initialize` is, en Rust blijft zo protocol-onwetend.
 */
export function createRequestHandler(
  deps: RequestHandlerDeps,
): (payload: McpRequestEvent) => Promise<void> {
  // Het drift-anker leeft per VERBINDING (= per handler, dus per bridge-start), niet per request:
  // `buildContext` levert elk request een verse ctx met `expectedDocId: null`. Zonder deze overdracht
  // bond elke eerste mutatie van ieder request opnieuw aan het dán actieve document, zodat een
  // user-tabwissel tussen twee AI-calls nooit `DOC_DRIFT` gaf en de mutatie stil op het andere
  // tabblad landde; ook het verzetten door `switch_document`/`new_document`/`duplicate_document`/
  // `import_schedule` ging met de weggegooide ctx verloren. `tempIdMap` blijft bewust per request
  // (batch-only, de batch-executor bezit hem).
  // Anker per sessie, in een tabel die (in de app) langer leeft dan deze handler.
  const sessions = deps.sessions ?? createMcpSessionTable(deps.newSessionId ?? randomSessionId);
  // Requests strikt NA elkaar (audit 2026-09-26). Rust houdt één request tegelijk in de lucht, maar
  // geeft dat slot na zijn time-out (120 s) vrij terwijl de webview nog aan het oude request werkt;
  // zonder deze keten liep het volgende request (vaak een retry van dezelfde import) bij elke await
  // door het oude heen. De keten voorkomt dat verweven; een request dat al door Rust is opgegeven
  // slaat hij over (`MCP_QUEUE_DEADLINE_MS`). Een retry die pas NA die grens binnenkomt is voor ons
  // een nieuw request: een import opent dan wel een tweede tabblad (geen ontdubbeling op pad).
  let tail: Promise<void> = Promise.resolve();
  const now = deps.now ?? Date.now;
  const handleOne = async (payload: McpRequestEvent, arrivedAt: number): Promise<void> => {
    const isInitialize = requestMethod(payload.body) === 'initialize';
    const incoming = typeof payload.sessionId === 'string' && payload.sessionId !== '' ? payload.sessionId : null;
    // Een nieuwe MCP-sessie (`initialize`) begint zonder anker: anders erfde een herstarte client
    // de documentbinding van de vorige en kreeg hij DOC_DRIFT op een tabblad dat hij nooit zag.
    let session: string | null = null;
    if (!isInitialize) {
      if (incoming === null) {
        await deps.emit('mcp://response', { id: payload.id, body: missingSessionResponse(payload.body), status: 400 } satisfies McpResponseEvent);
        return;
      }
      if (!sessions.has(incoming)) {
        await deps.emit('mcp://response', { id: payload.id, body: '', status: 404 } satisfies McpResponseEvent);
        return;
      }
      session = incoming;
    } else if (requestHasId(payload.body) && !sessions.canOpen()) {
      // Vol met gebonden sessies: niet stil verdringen, maar deze initialize weigeren.
      const body = sessionsFullResponse(payload.body);
      recordRequestActivity(payload.body, body, 0);
      await deps.emit('mcp://response', { id: payload.id, body } satisfies McpResponseEvent);
      return;
    }
    const ctx = deps.buildContext();
    if (ctx.expectedDocId === null) {
      ctx.expectedDocId = session !== null ? sessions.anchor(session) : null;
    }
    const start = performance.now();
    let body: string;
    try {
      body = now() - arrivedAt >= MCP_QUEUE_DEADLINE_MS
        ? queueTimeoutResponse(payload.body)
        : await deps.handleMessage(payload.body, ctx);
    } catch (error) {
      // Vangnet buiten de dispatcher-crashbarrière (bv. een niet-serialiseerbaar resultaat): altijd
      // een JSON-RPC-fout terugsturen, anders wacht de client tot de Rust-time-out.
      body = internalErrorResponse(payload.body, error);
    } finally {
      if (session !== null) sessions.setAnchor(session, ctx.expectedDocId);
    }
    const response: McpResponseEvent = { id: payload.id, body };
    if (isInitialize && isResultResponse(body)) {
      const id = sessions.open();
      if (id !== null) {
        response.sessionId = id;
      } else {
        // Kan alleen als de tabel tussen de controle en hier volliep (requests lopen serieel, dus niet in
        // de praktijk); dan liever een fout dan een initialize zonder sessie.
        response.body = sessionsFullResponse(payload.body);
      }
    }
    // Leg de aanroep vast in het activiteitenlog (notificaties = lege body worden overgeslagen).
    recordRequestActivity(payload.body, body, performance.now() - start);
    await deps.emit('mcp://response', response);
  };
  return (payload) => {
    const arrivedAt = now();
    const run = tail.then(() => handleOne(payload, arrivedAt));
    tail = run.catch((error) => { console.error('MCP: antwoord versturen mislukt:', error); });
    return run;
  };
}

/** Heeft dit JSON-RPC-bericht een `id` (een request, geen notificatie)? */
function requestHasId(rawBody: string): boolean {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'id' in parsed;
  } catch { return false; }
}

/** JSON-RPC-fout voor een `initialize` terwijl alle sessieplekken bezet zijn door gebonden sessies. */
function sessionsFullResponse(rawBody: string): string {
  let id: unknown = null;
  try { id = (JSON.parse(rawBody) as { id?: unknown }).id ?? null; } catch { /* id null */ }
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: {
      code: -32000,
      message: `Too many MCP sessions: all ${MCP_MAX_SESSIONS} are bound to a document. Close other MCP connections, or generate a new token in Open Planner Studio (MCP tab) to reset all connections.`,
    },
  });
}

/** JSON-RPC-fout bij een request zonder `Mcp-Session-Id` (HTTP 400). */
function missingSessionResponse(rawBody: string): string {
  let id: unknown = null;
  try {
    const parsed = JSON.parse(rawBody) as { id?: unknown };
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) id = parsed.id ?? null;
  } catch { /* onparseerbaar ⇒ id null */ }
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code: -32600, message: 'Bad Request: missing Mcp-Session-Id header; send initialize first and include the session id it returns' },
  });
}

/** Is dit een geslaagd JSON-RPC-antwoord (met `result`, zonder `error`)? */
function isResultResponse(rawBody: string): boolean {
  try {
    const parsed = JSON.parse(rawBody) as { result?: unknown; error?: unknown };
    return !!parsed && typeof parsed === 'object' && 'result' in parsed && !('error' in parsed);
  } catch { return false; }
}

/** De `method` van een enkel JSON-RPC-request, of null (batch-array, onparseerbaar). */
function requestMethod(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody) as { method?: unknown };
    return parsed && typeof parsed === 'object' && typeof parsed.method === 'string' ? parsed.method : null;
  } catch { return null; }
}

/** Antwoord voor een request dat te lang in de wachtrij stond en daarom niet is uitgevoerd: dezelfde
 *  `-32001 timeout` als Rust geeft. Een notificatie krijgt een lege body. */
function queueTimeoutResponse(rawBody: string): string {
  let id: unknown = null;
  try {
    const parsed = JSON.parse(rawBody) as { id?: unknown };
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !('id' in parsed)) return '';
    id = (parsed as { id?: unknown })?.id ?? null;
  } catch { /* onparseerbaar ⇒ id null */ }
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32001, message: 'timeout: not executed, waited too long in the queue' } });
}

/** JSON-RPC `-32603 Internal error` voor een request waarvan de verwerking zelf wierp. Een
 *  notificatie (geen `id`) krijgt, zoals altijd, een lege body. */
function internalErrorResponse(rawBody: string, error: unknown): string {
  let id: unknown = null;
  try {
    const parsed = JSON.parse(rawBody) as { id?: unknown };
    if (parsed && typeof parsed === 'object' && !('id' in parsed)) return '';
    id = parsed?.id ?? null;
  } catch { /* onparseerbaar ⇒ id null */ }
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message: `Internal error: ${message}` } });
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
  /** Sessietabel die alle starts van deze controller delen (echt: `appMcpSessions`). Ontbreekt hij, dan
   *  maakt de controller er één voor zijn hele levensduur. */
  sessions?: McpSessionTable;
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
