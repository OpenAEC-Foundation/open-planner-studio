// Doorstuurlogica naar de MCP-bridge van de draaiende desktop-app: elk MCP-bericht van een client gaat
// één voor één als HTTP-POST naar de bridge, en de antwoorden gaan terug. Deze module kent geen
// transport (stdio), geen manifest en geen client: wie hem gebruikt, levert poort, token, een `send` en
// de tekst waar de gebruiker token en poort instelt (`settingsHint`). Nu gebruikt de Claude
// Desktop-bundel hem (`main.ts`, `config.ts`); later de ene plugin die ook headless werkt (#570), die
// het token uit het runtimebestand van de app leest.
//
// Het HTTP-contract van de bridge staat in `src-tauri/src/mcp_bridge.rs` (kopie voor tests:
// `tests/mcp/bridgeMirror.ts`): `POST http://127.0.0.1:<poort>/mcp`, `Authorization: Bearer <token>`,
// geen `Origin`-header, `Mcp-Session-Id` uit het `initialize`-antwoord bij elk later request
// (onbekende sessie ⇒ 404). Bewust `127.0.0.1` en niet `localhost`: de bridge luistert alleen op IPv4,
// en `localhost` kan op een systeem eerst `::1` opleveren.
//
// Keuzes:
//   - Strikt één bericht tegelijk (zoals de bridge zelf). Zo kunnen twee requests niet tegelijk een
//     verloren sessie herstellen en twee sessies openen.
//   - Draait de app niet (of klopt het token niet) bij `initialize`, dan beantwoordt deze module
//     `initialize` zelf en biedt hij één statustool aan. Zo blijft de client verbonden en krijgt het
//     model een heldere fout in plaats van een stille lege toollijst. Komt de app later online, dan
//     verbindt hij bij het volgende bericht en meldt hij `notifications/tools/list_changed`.
//   - Sessieverlies (404: app herstart), ontdekt door welk bericht ook (ook een ping of notificatie):
//     hij opent een nieuwe sessie met de oorspronkelijke `initialize`-parameters en herhaalt een
//     leesrequest. Wijzigende tools blijven daarna geweigerd ("not carried out"), ook die al in de
//     wachtrij stonden, tot een geslaagde `planner_switch_document` het anker van de nieuwe sessie
//     expliciet vastlegt. Het drift-anker van de oude sessie is weg; een leestool bindt geen anker,
//     dus zonder die keuze landde een wijziging op het document dat toevallig actief is.
//   - Een annulering (`notifications/cancelled`) wordt direct bij ontvangst vastgelegd; een geannuleerde
//     aanvraag die nog wachtte (ook op opnieuw verbinden), gaat nooit naar de bridge.
//   - De toollijst wisselt tussen de plannertools en de statustool; bij elke wissel krijgt de client
//     `notifications/tools/list_changed`, en `initialize` kondigt altijd `listChanged` aan.
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export const DEFAULT_BRIDGE_PORT = 3877;
/** Iets ruimer dan de 120 s waarna de bridge zelf een 504 geeft. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 130_000;
/** De lokale tool die alleen verschijnt zolang de app niet bereikbaar is. */
export const STATUS_TOOL_NAME = 'open_planner_studio_status';
/** Protocolversie voor een lokaal `initialize`-antwoord als de client er geen noemt. */
const FALLBACK_PROTOCOL_VERSION = '2025-06-18';

export type ProxyFailure =
  | { kind: 'no-token' }
  | { kind: 'token' }
  | { kind: 'unreachable'; detail: string }
  | { kind: 'timeout' }
  | { kind: 'refused'; message: string }
  | { kind: 'http'; status: number };

/**
 * De Engelse uitleg voor het model (en via het model voor de gebruiker). `settings` zegt waar de gebruiker
 * token en poort instelt, bijv. "the settings of the … extension in Claude Desktop".
 */
export function failureMessage(failure: ProxyFailure, port: number, settings: string): string {
  switch (failure.kind) {
    case 'no-token':
      return 'No token is set for Open Planner Studio. Ask the user to open Open Planner Studio, go to the MCP tab, '
        + `click "Connect" under "Connection", copy the token and paste it into "Token" in ${settings}.`;
    case 'token':
      return 'Open Planner Studio refused the token (HTTP 401). Ask the user to copy the token again from the MCP tab '
        + `in Open Planner Studio ("Connection" › "Connect") and paste it into "Token" in ${settings}. `
        + 'A new token in the app breaks every existing connection.';
    case 'unreachable':
      return `Open Planner Studio is not running or the MCP bridge is off: nothing answers on http://127.0.0.1:${port}/mcp. `
        + 'Ask the user to open the Open Planner Studio desktop app, go to the MCP tab and click "Start bridge". '
        + `If the app uses another port than ${port}, change "Port" in ${settings}.`;
    case 'timeout':
      return `Open Planner Studio did not answer within ${Math.round(DEFAULT_REQUEST_TIMEOUT_MS / 1000)} seconds. `
        + 'It is not known whether the request was carried out. Ask the user to check the app '
        + '(an open dialog blocks the MCP client) and read the plan again before you retry a change.';
    case 'refused':
      return `Open Planner Studio refused the connection: ${failure.message}`;
    case 'http':
      return `Something answers on port ${port}, but it is not the Open Planner Studio MCP bridge (HTTP ${failure.status}). `
        + `Ask the user to check the port on the MCP tab in the app and in ${settings}.`;
  }
}

/**
 * Tool die na sessieverlies expliciet een bestaand document kiest en het drift-anker van de sessie daaraan
 * bindt (`bindExpectedDoc` in `src/services/mcp/tools/runtime.ts`). Ook een nieuw document of een import
 * heft de blokkade op (zie `DOCUMENT_RECOVERY_TOOLS`). Een leestool bindt geen anker; de eerste wijziging zou
 * het lege anker anders aan het dan actieve document binden.
 */
export const DOCUMENT_CHOICE_TOOL = 'planner_switch_document';
// Deze acties binden eveneens een nieuw anker en heffen de blokkade op, maar blijven mutaties: nooit
// automatisch herhalen.
const DOCUMENT_RECOVERY_TOOLS = new Set([DOCUMENT_CHOICE_TOOL, 'planner_new_document', 'planner_import_schedule']);

/**
 * Fout voor een wijzigende tool na sessieverlies. Het drift-anker van de oude sessie is weg; een nieuwe
 * sessie zou een wijziging aan het document binden dat nu actief is, ook als het gesprek over een ander
 * document ging. Daarom blijven wijzigingen geblokkeerd tot het model expliciet een document kiest.
 */
export const SESSION_RESET_MESSAGE =
  'The connection to Open Planner Studio was reset (the app or its MCP bridge restarted), so this change was NOT carried out. '
  + 'Another document may be active now. Changes stay blocked until you choose the document explicitly: call '
  + `planner_list_documents, pick the document you mean, confirm it with ${DOCUMENT_CHOICE_TOOL}, then send the change again. `
  + 'Alternatively, explicitly create a new plan with planner_new_document or import a file with planner_import_schedule.';

export interface BridgeProxyOptions {
  port: number;
  token: string;
  /** Versie van de server (= appversie), voor het lokale `initialize`-antwoord. */
  version: string;
  /** Waar de gebruiker token en poort instelt; komt in de foutmeldingen (zie `failureMessage`). */
  settingsHint: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  log?: (line: string) => void;
}

export interface BridgeProxy {
  /** Verwerkt één bericht van de client; berichten worden strikt na elkaar verwerkt. */
  handle(message: JSONRPCMessage): Promise<void>;
}

type Id = string | number;
type Json = Record<string, unknown>;

type Upstream =
  | { type: 'ok'; status: number; sessionId: string | null; json: unknown }
  | { type: 'session-lost' }
  | { type: 'fail'; failure: ProxyFailure };

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is Id => typeof v === 'string' || typeof v === 'number';

function describeError(error: unknown): string {
  const cause = isObject(error) && isObject(error.cause) ? error.cause : null;
  const code = cause && typeof cause.code === 'string' ? cause.code : null;
  const message = error instanceof Error ? error.message : String(error);
  return code ? `${message} (${code})` : message;
}

const STATUS_TOOL = {
  name: STATUS_TOOL_NAME,
  title: 'Open Planner Studio connection status',
  description: 'Checks the connection to the Open Planner Studio desktop app. The planner_ tools appear only while the app '
    + 'runs with its MCP bridge started. Call this tool when they are missing: it connects if it can, and otherwise '
    + 'explains what the user must do.',
  inputSchema: { type: 'object', properties: {} },
  annotations: { readOnlyHint: true, openWorldHint: false },
};

export function createBridgeProxy(opts: BridgeProxyOptions, send: (message: JSONRPCMessage) => Promise<void>): BridgeProxy {
  const endpoint = `http://127.0.0.1:${opts.port}/mcp`;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const log = opts.log ?? (() => {});

  /** De `initialize`-parameters van de client; nodig om na een herstart opnieuw te verbinden. */
  let clientInitParams: Json | null = null;
  let connected = false;
  let sessionId: string | null = null;
  let protocolVersion: string | null = null;
  /**
   * Welke toollijst de client het laatst kreeg: de plannertools van de app of alleen de statustool.
   * Bij elke overgang krijgt de client `notifications/tools/list_changed`, ook als de sessie bleef staan
   * (Stop/Start van de bridge).
   */
  let toolsShown: 'planner' | 'status' | null = null;
  /**
   * Gezet zodra een sessie verloren ging (404), ongeacht welk bericht dat ontdekte. Zolang hij staat,
   * weigert de proxy elke wijzigende tool, ook aanvragen die al in de wachtrij stonden. Alleen een
   * geslaagde hersteltool (`DOCUMENT_RECOVERY_TOOLS`: document wisselen, nieuw document of importeren) heft
   * hem op. Omdat de wachtrij strikt op volgorde loopt, zijn aanvragen die vóór dat herstel binnenkwamen dan
   * al geweigerd.
   */
  let documentCheckNeeded = false;
  /** Leestools volgens de laatste `tools/list` (`readOnlyHint`). Een onbekende tool telt als wijzigend. */
  const readOnlyTools = new Set<string>();
  /** Aanvragen die nog niet zijn doorgestuurd, ook tijdens opnieuw verbinden. */
  const queuedIds = new Set<Id>();
  /** Aanvragen die de client annuleerde vóór ze aan de beurt waren; die gaan nooit naar de bridge. */
  const cancelledIds = new Set<Id>();
  let internalId = 0;
  let queue: Promise<void> = Promise.resolve();

  async function post(message: unknown, withSession: boolean): Promise<Upstream> {
    if (opts.token === '') return { type: 'fail', failure: { kind: 'no-token' } };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${opts.token}`,
    };
    const sentSession = withSession && sessionId !== null;
    if (sentSession) headers['Mcp-Session-Id'] = sessionId as string;
    if (withSession && protocolVersion) headers['Mcp-Protocol-Version'] = protocolVersion;
    let res: Response;
    try {
      res = await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (isObject(error) && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        return { type: 'fail', failure: { kind: 'timeout' } };
      }
      return { type: 'fail', failure: { kind: 'unreachable', detail: describeError(error) } };
    }
    const text = await res.text().catch(() => '');
    if (res.status === 401) return { type: 'fail', failure: { kind: 'token' } };
    if (res.status === 404 && sentSession) {
      // Elk bericht kan het verlies ontdekken (ook een ping of notificatie); de blokkade hoort bij de
      // verbinding, niet bij dat bericht.
      documentCheckNeeded = true;
      log('session lost (app restarted); changes are blocked until the active plan is read again');
      return { type: 'session-lost' };
    }
    let json: unknown;
    if (text !== '') {
      try { json = JSON.parse(text); } catch { json = undefined; }
    }
    // 200/202 zijn de gewone antwoorden; een 400 of 504 van de bridge draagt een JSON-RPC-fout.
    if (res.status === 200 || res.status === 202 || isObject(json)) {
      return { type: 'ok', status: res.status, sessionId: res.headers.get('mcp-session-id'), json };
    }
    return { type: 'fail', failure: { kind: 'http', status: res.status } };
  }

  function initParams(): Json {
    return clientInitParams ?? {
      protocolVersion: FALLBACK_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'open-planner-studio-mcpb', version: opts.version },
    };
  }

  /** Neemt een geslaagd `initialize`-antwoord over. Geeft een fout als het antwoord een weigering is. */
  function adoptInitialize(reply: Upstream): ProxyFailure | null {
    if (reply.type === 'fail') return reply.failure;
    if (reply.type === 'session-lost') return { kind: 'http', status: 404 };
    const json = reply.json;
    if (!isObject(json) || !isObject(json.result)) {
      const error = isObject(json) && isObject(json.error) ? json.error : null;
      const message = error && typeof error.message === 'string' ? error.message : `no valid initialize answer (HTTP ${reply.status})`;
      return { kind: 'refused', message };
    }
    // Een app van vóór de MCP-sessies geeft geen sessie-id; dan werkt het ook zonder.
    sessionId = reply.sessionId && reply.sessionId !== '' ? reply.sessionId : null;
    protocolVersion = typeof json.result.protocolVersion === 'string' ? json.result.protocolVersion : null;
    connected = true;
    return null;
  }

  const notifyToolsChanged = () => send({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' } as JSONRPCMessage);

  /** De app antwoordt: kreeg de client de statustool, dan moet hij de plannertools ophalen. */
  async function markOnline(): Promise<void> {
    if (toolsShown === 'status') {
      toolsShown = null;
      await notifyToolsChanged();
    }
  }

  /** De app antwoordt niet: kreeg de client de plannertools, dan moet hij de statustool ophalen. */
  async function markOffline(): Promise<void> {
    if (toolsShown === 'planner') {
      toolsShown = null;
      await notifyToolsChanged();
    }
  }

  /** Opent een (nieuwe) sessie bij de bridge met de `initialize`-parameters van de client. */
  async function connectUpstream(): Promise<ProxyFailure | null> {
    sessionId = null;
    connected = false;
    const reply = await post({ jsonrpc: '2.0', id: `ops-mcpb-init-${++internalId}`, method: 'initialize', params: initParams() }, false);
    const failure = adoptInitialize(reply);
    if (failure) return failure;
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, true);
    log(`connected to ${endpoint}${sessionId ? ' (new session)' : ''}`);
    return null;
  }

  const reply = (id: Id, result: Json) => send({ jsonrpc: '2.0', id, result } as JSONRPCMessage);
  const replyError = (id: Id, message: string, code = -32000) =>
    send({ jsonrpc: '2.0', id, error: { code, message } } as JSONRPCMessage);
  const toolError = (id: Id, text: string) => reply(id, { content: [{ type: 'text', text }], isError: true });

  /** Antwoord zonder bridge: de client krijgt een bruikbare uitleg in plaats van een kale fout. */
  async function answerOffline(id: Id, method: string, failure: ProxyFailure): Promise<void> {
    const message = failureMessage(failure, opts.port, opts.settingsHint);
    if (method === 'tools/list') {
      toolsShown = 'status';
      await reply(id, { tools: [STATUS_TOOL] });
      return;
    }
    if (method === 'tools/call') await toolError(id, message);
    else if (method === 'ping') await reply(id, {});
    else await replyError(id, message);
    // Een timeout zegt niet dat de app weg is; de andere fouten wel.
    if (failure.kind !== 'timeout') await markOffline();
  }

  function rememberTools(json: unknown): void {
    if (!isObject(json) || !isObject(json.result) || !Array.isArray(json.result.tools)) return;
    readOnlyTools.clear();
    for (const tool of json.result.tools) {
      if (isObject(tool) && typeof tool.name === 'string' && isObject(tool.annotations) && tool.annotations.readOnlyHint === true) {
        readOnlyTools.add(tool.name);
      }
    }
  }

  /** Geeft een bridge-antwoord door; een fout zonder id krijgt het id van het request. */
  async function forwardReply(id: Id, method: string, toolName: string | null, result: Upstream & { type: 'ok' }): Promise<void> {
    const json = result.json;
    if (Array.isArray(json)) {
      for (const item of json) await send(item as JSONRPCMessage);
      return;
    }
    if (!isObject(json)) {
      await replyError(id, `Open Planner Studio gave an empty answer (HTTP ${result.status}).`, -32603);
      return;
    }
    if (json.id === null || json.id === undefined) json.id = id;
    if (method === 'initialize' && isObject(json.result)) {
      // Altijd `listChanged` aankondigen: de proxy wisselt zelf tussen statustool en plannertools.
      const capabilities = isObject(json.result.capabilities) ? json.result.capabilities : {};
      const tools = isObject(capabilities.tools) ? capabilities.tools : {};
      json.result.capabilities = { ...capabilities, tools: { ...tools, listChanged: true } };
    }
    if (method === 'tools/list' && isObject(json.result)) {
      rememberTools(json);
      toolsShown = 'planner';
    }
    // Het model koos expliciet een document en de sessie is daaraan gebonden: wijzigingen mogen weer.
    if (documentCheckNeeded && toolName !== null && DOCUMENT_RECOVERY_TOOLS.has(toolName) && isObject(json.result) && json.result.isError !== true
      && !(isObject(json.result.structuredContent) && json.result.structuredContent.ok === false)) {
      documentCheckNeeded = false;
      log(`document chosen with ${toolName}; changes are allowed again`);
    }
    await send(json as JSONRPCMessage);
  }

  async function handleStatusTool(id: Id): Promise<void> {
    let failure: ProxyFailure | null = null;
    if (connected) {
      const ping = await post({ jsonrpc: '2.0', id: `ops-mcpb-ping-${++internalId}`, method: 'ping' }, true);
      if (ping.type === 'session-lost') failure = await connectUpstream();
      else if (ping.type === 'fail') failure = ping.failure;
    } else {
      failure = await connectUpstream();
    }
    if (failure) {
      await toolError(id, failureMessage(failure, opts.port, opts.settingsHint));
      if (failure.kind !== 'timeout') await markOffline();
      return;
    }
    await reply(id, {
      content: [{ type: 'text', text: `Connected to Open Planner Studio on port ${opts.port}. The planner_ tools are available; ask for the tool list again if you do not see them.` }],
    });
    await markOnline();
  }

  async function handleInitialize(id: Id, params: Json): Promise<void> {
    clientInitParams = params;
    sessionId = null;
    connected = false;
    toolsShown = null;
    const result = await post({ jsonrpc: '2.0', id, method: 'initialize', params }, false);
    const failure = adoptInitialize(result);
    if (!failure && result.type === 'ok') {
      log(`connected to ${endpoint}`);
      await forwardReply(id, 'initialize', null, result);
      return;
    }
    // Lokaal antwoorden: de extensie blijft bruikbaar en verbindt zodra de app er is.
    const message = failureMessage(failure as ProxyFailure, opts.port, opts.settingsHint);
    log(`not connected: ${message}`);
    await reply(id, {
      protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : FALLBACK_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: true } },
      serverInfo: { name: 'open-planner-studio', version: opts.version },
      instructions: `Open Planner Studio is not connected yet. ${message} `
        + `When the user has fixed this, call ${STATUS_TOOL_NAME}; the planner_ tools then appear.`,
    });
  }

  async function handleRequest(id: Id, method: string, message: Json): Promise<void> {
    if (method === 'initialize') {
      await handleInitialize(id, isObject(message.params) ? message.params : {});
      return;
    }
    const params = isObject(message.params) ? message.params : {};
    const toolName = method === 'tools/call' && typeof params.name === 'string' ? params.name : null;
    if (toolName === STATUS_TOOL_NAME) {
      await handleStatusTool(id);
      return;
    }
    // De documentkeuze zelf mag altijd door (en na sessieverlies herhaald worden): zij heft de blokkade op.
    const mutates = toolName !== null && !readOnlyTools.has(toolName) && toolName !== DOCUMENT_CHOICE_TOOL;
    if (mutates && documentCheckNeeded && (toolName === null || !DOCUMENT_RECOVERY_TOOLS.has(toolName))) {
      await toolError(id, SESSION_RESET_MESSAGE);
      return;
    }
    if (!connected) {
      const failure = await connectUpstream();
      if (cancelledIds.has(id)) return;
      if (failure) {
        await answerOffline(id, method, failure);
        return;
      }
    }
    queuedIds.delete(id); // vanaf deze POST is de aanvraag bij de bridge, niet meer lokaal wachtend
    let result = await post(message, true);
    if (result.type === 'session-lost') {
      queuedIds.add(id); // een eventuele veilige herhaling is tijdens reconnect weer annuleerbaar
      const failure = await connectUpstream();
      if (cancelledIds.has(id)) return;
      if (failure) {
        await answerOffline(id, method, failure);
        return;
      }
      // Alleen herhalen wat niets wijzigt; een wijziging zou zonder het oude anker kunnen verdwalen.
      if (mutates) {
        await toolError(id, SESSION_RESET_MESSAGE);
        return;
      }
      queuedIds.delete(id);
      result = await post(message, true);
      if (result.type === 'session-lost') {
        await answerOffline(id, method, { kind: 'refused', message: 'the new session was refused right away; try again' });
        return;
      }
    }
    if (result.type === 'fail') {
      // De sessie blijft bewaard: na Stop/Start van de bridge in de app geldt hij nog.
      await answerOffline(id, method, result.failure);
      return;
    }
    await forwardReply(id, method, toolName, result);
    await markOnline();
  }

  async function handleNotification(message: Json): Promise<void> {
    // Een annulering van een aanvraag die de bridge nooit zag, hoeft niet door.
    if (message.method === 'notifications/cancelled' && isObject(message.params) && isId(message.params.requestId)
      && cancelledIds.delete(message.params.requestId)) {
      return;
    }
    // Zonder sessie is er niemand om het aan te melden; de eigen `initialize` stuurt zijn eigen melding.
    if (!connected) return;
    const result = await post(message, true);
    if (result.type === 'session-lost') await connectUpstream();
  }

  async function processMessage(message: JSONRPCMessage): Promise<void> {
    const raw = message as unknown as Json;
    const method = typeof raw.method === 'string' ? raw.method : null;
    if (method !== null && isId(raw.id)) {
      const id = raw.id;
      try {
        // Geannuleerd terwijl hij wachtte: niet doorsturen en niet beantwoorden.
        if (cancelledIds.has(id)) {
          log(`request ${String(id)} was cancelled before it was sent; dropped`);
          return;
        }
        await handleRequest(id, method, raw);
      } finally {
        queuedIds.delete(id); // ook lokale weigering/verbindingsfout ruimt de wachtregistratie op
      }
    } else if (method !== null) {
      await handleNotification(raw);
    }
    // Een antwoord van de client hoort bij een request van de server; de bridge stuurt die niet.
  }

  return {
    handle(message) {
      const raw = message as unknown as Json;
      // Annuleringen meteen verwerken, niet achter in de wachtrij: anders ging een wachtende wijziging
      // die de client al had opgegeven alsnog naar de bridge (MCP 2025-06-18, cancellation).
      if (raw.method === 'notifications/cancelled' && isObject(raw.params) && isId(raw.params.requestId)
        && queuedIds.has(raw.params.requestId)) {
        cancelledIds.add(raw.params.requestId);
      }
      if (typeof raw.method === 'string' && isId(raw.id)) {
        queuedIds.add(raw.id);
        cancelledIds.delete(raw.id);
      }
      const next = queue.then(() => processMessage(message)).catch(async (error: unknown) => {
        log(`error while handling a message: ${describeError(error)}`);
        // Een request zonder antwoord laat de client hangen; geef dus altijd iets terug.
        if (isId(raw.id) && typeof raw.method === 'string' && !cancelledIds.has(raw.id)) {
          await replyError(raw.id, `Internal error in the Open Planner Studio MCP proxy: ${describeError(error)}`, -32603)
            .catch(() => {});
        }
      });
      queue = next;
      return next;
    },
  };
}
