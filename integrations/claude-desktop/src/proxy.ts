// Het schakelstuk van de Claude Desktop-bundel (issue #730): één MCP-server voor de client, met twee
// planners erachter. Per aanvraag kiest hij:
//   - de app: de MCP-bridge van de draaiende desktop-app (HTTP, poort en token uit `runtime.json`);
//   - zonder app: de headless MCP-server (`headless/mcp-server/`) als kindproces op de werkmap.
// Deze module kent geen transport (stdio), geen manifest, geen bestanden en geen processen: wie hem
// gebruikt, levert `findApp` (leest `runtime.json`, `discovery.ts`), een `HeadlessStarter`
// (`headlessChild.ts`), een `send` en de tekst waar de gebruiker de instellingen vindt (`settingsHint`).
// Zo blijft hij headless te toetsen (`tests/mcp/cases-mcpb.ts`) en past hij later in de ene plugin.
//
// Het HTTP-contract van de bridge staat in `src-tauri/src/mcp_bridge.rs` (kopie voor tests:
// `tests/mcp/bridgeMirror.ts`): `POST http://127.0.0.1:<poort>/mcp`, `Authorization: Bearer <token>`,
// geen `Origin`-header, `Mcp-Session-Id` uit het `initialize`-antwoord bij elk later request
// (onbekende sessie ⇒ 404). Bewust `127.0.0.1` en niet `localhost`: de bridge luistert alleen op IPv4,
// en `localhost` kan op een systeem eerst `::1` opleveren.
//
// Keuzes:
//   - Strikt één bericht tegelijk (zoals de bridge zelf). Zo kunnen twee requests niet tegelijk een
//     verloren sessie herstellen of tegelijk van stand wisselen.
//   - Per aanvraag opnieuw `runtime.json` lezen (`findApp`). Een geldig bestand van een levend proces ⇒
//     de app. Weigert of mist de bridge (geen verbinding, 401, iets anders op de poort) ⇒ zonder app,
//     zoals `docs/mcp-ontdekking.md` regel 3 voorschrijft. Een time-out ⇒ een fout, geen wissel: dan is
//     niet bekend of de app de aanvraag uitvoerde.
//   - Wisselen tijdens een sessie (de app gaat open of dicht) mag geen werk kosten:
//       * zonder app → app: alleen als de headless planner geen wijzigingen meer heeft die nog niet met
//         `planner_export_ifc` zijn weggeschreven. Anders blijft de aanvraag zonder app, met een melding,
//         tot het model ze heeft opgeslagen. Pas dan stopt het kindproces.
//       * app → zonder app: het werk staat in de app (die vraagt bij sluiten zelf om op te slaan).
//     Na elke wissel weigert de proxy wijzigende tools tot een expliciete documentkeuze (zie hieronder):
//     het model werkte op een document dat in de andere planner niet open is. Het eerstvolgende
//     toolantwoord krijgt een korte melding vooraan, en de client krijgt `notifications/tools/list_changed`.
//   - Sessieverlies bij de app (404, of een nieuwe `runtime.json`: app of bridge herstart): een nieuwe
//     sessie met de oorspronkelijke `initialize`-parameters, en een leesrequest wordt herhaald.
//     Wijzigende tools blijven daarna geweigerd ("not carried out"), ook die al in de wachtrij stonden, tot
//     een geslaagde `planner_switch_document`, `planner_new_document` of `planner_import_schedule` het anker
//     expliciet vastlegt. Een leestool bindt geen anker; zonder die keuze landde een wijziging op het
//     document dat toevallig actief is.
//   - Stopt de headless planner onverwacht, dan is zijn geheugen weg: wijzigingen blijven geweigerd tot
//     het model een bestand opnieuw opent (dezelfde blokkade).
//   - Een annulering (`notifications/cancelled`) wordt direct bij ontvangst vastgelegd; een geannuleerde
//     aanvraag die nog wachtte (ook op verbinden), gaat nooit naar een planner.
//   - Kan geen van beide planners (geen app, en geen werkmap of te oude Node), dan beantwoordt deze module
//     `initialize` zelf en biedt hij één statustool aan, met een heldere fout in plaats van een stille lege
//     toollijst. Bij elk volgend bericht probeert hij het opnieuw.
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/** Iets ruimer dan de 120 s waarna de bridge zelf een 504 geeft. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 130_000;
/** De lokale tool die alleen verschijnt zolang geen van beide planners bereikbaar is. */
export const STATUS_TOOL_NAME = 'open_planner_studio_status';
/** Protocolversie voor een lokaal `initialize`-antwoord als de client er geen noemt. */
const FALLBACK_PROTOCOL_VERSION = '2025-06-18';

/** Welke planner een aanvraag krijgt. */
export type Mode = 'app' | 'headless';

/** Waar de bridge van de app nu draait, volgens `runtime.json`. */
export interface AppTarget {
  port: number;
  token: string;
  /** Wie de bridge is (pid, poort, token). Een andere sleutel = een andere bridge: de sessie is weg. Stop en
   *  Start in dezelfde app houden de sleutel, net als de sessies in de app (`appMcpSessions`). */
  key: string;
  appVersion: string;
  pid: number;
}

/** Uitkomst van één bericht aan de headless planner. */
export type HeadlessReply =
  | { type: 'reply'; json: unknown }
  /** Een notificatie: daar hoort geen antwoord bij. */
  | { type: 'none' }
  | { type: 'timeout' }
  | { type: 'exited'; detail: string };

/** Het kanaal naar één gestart headless kindproces. */
export interface HeadlessChannel {
  readonly alive: boolean;
  request(message: unknown, timeoutMs: number): Promise<HeadlessReply>;
  close(): Promise<void>;
}

/** Start de headless planner. `start` gooit een `Error` met een Engelse uitleg als dat niet kan. */
export interface HeadlessStarter {
  /** De werkmap (voor de meldingen), of `null` als er geen is ingesteld. */
  readonly root: string | null;
  start(): Promise<HeadlessChannel>;
}

export type ProxyFailure =
  | { kind: 'no-app' }
  | { kind: 'token' }
  /** `maybeDelivered`: de verbinding brak pas nadat de aanvraag verstuurd kon zijn (alles behalve ECONNREFUSED). */
  | { kind: 'unreachable'; detail: string; maybeDelivered: boolean }
  | { kind: 'timeout' }
  | { kind: 'refused'; message: string }
  | { kind: 'http'; status: number }
  /** De stand zonder app kan niet: `message` is de uitleg voor het model. */
  | { kind: 'headless'; message: string };

/** Engelse uitleg bij een fout van de app (voor het model, en via het model voor de gebruiker). */
export function appFailureMessage(failure: ProxyFailure, port: number | null): string {
  const where = port === null ? 'the port in its runtime file' : `http://127.0.0.1:${port}/mcp`;
  switch (failure.kind) {
    case 'no-app':
      return 'The Open Planner Studio desktop app is not running, or its MCP bridge is off.';
    case 'token':
      return `Open Planner Studio refused the token from its runtime file (HTTP 401) on ${where}.`;
    case 'unreachable':
      return `Open Planner Studio does not answer on ${where} (${failure.detail}).`;
    case 'timeout':
      return `Open Planner Studio did not answer within ${Math.round(DEFAULT_REQUEST_TIMEOUT_MS / 1000)} seconds. `
        + 'It is not known whether the request was carried out. Ask the user to check the app '
        + '(an open dialog blocks the MCP client) and read the plan again before you retry a change.';
    case 'refused':
      return `Open Planner Studio refused the connection: ${failure.message}`;
    case 'http':
      return `Something answers on ${where}, but it is not the Open Planner Studio MCP bridge (HTTP ${failure.status}).`;
    case 'headless':
      return failure.message;
  }
}

/** Geen van beide planners: wat de gebruiker kan doen. */
export function offlineMessage(headless: ProxyFailure, app: ProxyFailure, port: number | null): string {
  return `${appFailureMessage(app, port)} ${appFailureMessage(headless, null)} `
    + 'To use the app, ask the user to open the Open Planner Studio desktop app, go to the MCP tab and click "Start bridge".';
}

/**
 * Tool die na sessieverlies of een wissel expliciet een bestaand document kiest en het drift-anker van de
 * sessie daaraan bindt (`bindExpectedDoc` in `src/services/mcp/tools/runtime.ts`). Ook een nieuw document of
 * een import heft de blokkade op (zie `DOCUMENT_RECOVERY_TOOLS`). Een leestool bindt geen anker; de eerste
 * wijziging zou het lege anker anders aan het dan actieve document binden.
 */
export const DOCUMENT_CHOICE_TOOL = 'planner_switch_document';
// Deze acties binden eveneens een nieuw anker en heffen de blokkade op, maar blijven mutaties: nooit
// automatisch herhalen.
const DOCUMENT_RECOVERY_TOOLS = new Set([DOCUMENT_CHOICE_TOOL, 'planner_new_document', 'planner_import_schedule']);
/** De tool die het actieve document van de headless planner op schijf zet. */
export const EXPORT_TOOL = 'planner_export_ifc';

/** Fout voor een wijzigende tool na sessieverlies bij de app. */
export const SESSION_RESET_MESSAGE =
  'The connection to Open Planner Studio was reset (the app or its MCP bridge restarted), so this change was NOT carried out. '
  + 'Another document may be active now. Changes stay blocked until you choose the document explicitly: call '
  + `planner_list_documents, pick the document you mean, confirm it with ${DOCUMENT_CHOICE_TOOL}, then send the change again. `
  + 'Alternatively, explicitly create a new plan with planner_new_document or import a file with planner_import_schedule.';

const inFolder = (root: string | null) => (root === null ? 'the working folder' : `the working folder '${root}'`);

/** Fout voor een wijzigende tool na de wissel naar de app. */
export const SWITCH_TO_APP_MESSAGE =
  'The Open Planner Studio app is open now with its MCP bridge, so requests go to the app again. This change was NOT carried out: '
  + 'the documents in the app are not the ones you had open without the app. Call planner_list_documents, choose the document '
  + `with ${DOCUMENT_CHOICE_TOOL} (or open a file with planner_import_schedule), then send the change again.`;

/** Fout voor een wijzigende tool na de wissel naar de stand zonder app. */
export function switchToHeadlessMessage(root: string | null): string {
  return 'The Open Planner Studio app closed (or its MCP bridge stopped), so requests now go to the planner without the app, '
    + `which works on files in ${inFolder(root)}. This change was NOT carried out: the documents from the app are not open here. `
    + 'Open a file with planner_import_schedule (a path like ~/plan.ifc is a file in that folder) or start a new plan with '
    + 'planner_new_document, then send the change again. Changes here are only kept when you write them with planner_export_ifc.';
}

/** Fout na een onverwachte stop van de headless planner. */
export function headlessLostMessage(root: string | null, detail: string): string {
  return `The planner without the app (${inFolder(root)}) stopped unexpectedly (${detail}). It is not known whether the `
    + 'last request was carried out, and changes that were not written with planner_export_ifc are lost. Changes stay blocked '
    + 'until you open a file again with planner_import_schedule (or start a new plan with planner_new_document).';
}

/** Melding vooraan het eerste toolantwoord na een wissel. */
const NOTE_PREFIX = 'Note from the Open Planner Studio extension: ';
export const SWITCH_TO_APP_NOTE = `${NOTE_PREFIX}the Open Planner Studio app is open now, so this answer comes from the app. `
  + 'Choose the document again before you change anything.';
export function switchToHeadlessNote(root: string | null): string {
  return `${NOTE_PREFIX}the Open Planner Studio app closed, so this answer comes from the planner without the app, in `
    + `${inFolder(root)}. Documents from the app are not open here.`;
}
/** Melding na een onverwachte stop van de headless planner terwijl hij niets deed. */
export const HEADLESS_RESTART_NOTE = `${NOTE_PREFIX}the planner without the app stopped unexpectedly and started again, `
  + 'so this answer comes from a new, empty planner. Changes that were not written with planner_export_ifc are lost.';
/** Melding als de app opengaat terwijl de headless planner nog niet opgeslagen werk heeft. */
export const UNSAVED_STAY_NOTE = `${NOTE_PREFIX}the Open Planner Studio app is open now, but the planner without the app `
  + 'still has changes that are not written to a file. Requests stay with the planner without the app until you write them '
  + 'with planner_export_ifc. While the app runs, that planner does not replace an existing file, so choose a new file name. '
  + 'After that, requests go to the app.';
/** Een eerdere wijziging zonder app kreeg geen antwoord, en de controle daarna ook niet: wacht met wijzigen. */
export const HEADLESS_BUSY_MESSAGE = 'The planner without the app did not answer an earlier change in time, and it does '
  + 'not answer yet. This request was NOT carried out, so that the earlier change stays with the right document. Try '
  + 'again in a moment; read-only tools still work.';
/** Een wijziging aan de app zonder antwoord, terwijl ze wel aangekomen kan zijn: niet opnieuw sturen. */
export const UNKNOWN_OUTCOME_MESSAGE = 'The connection to the Open Planner Studio app broke before its answer came, so it is '
  + 'not known whether this change was carried out. The extension does not send it again. Read the plan again before you '
  + 'retry the change.';

/** Uitleg achter de instructies van de planner, in beide standen. */
export function bundleInstructions(root: string | null): string {
  return '\n\nAbout this extension: requests go to the Open Planner Studio desktop app while it runs with its MCP bridge started. '
    + `Otherwise the extension starts the planner without the app, which works on files in ${inFolder(root)}: a path like `
    + '~/plan.ifc is a file in that folder, there is no auto-save, and you keep changes by writing them with planner_export_ifc. '
    + 'The extension switches by itself when the app opens or closes, and says so in the next tool answer. After a switch, '
    + 'choose the document again before you change anything.';
}

export interface PlannerProxyOptions {
  /** Versie van de server (= appversie), voor het lokale `initialize`-antwoord. */
  version: string;
  /** Leest `runtime.json` (per aanvraag): waar de bridge van de app nu draait, of `null`. */
  findApp: () => AppTarget | null;
  headless: HeadlessStarter;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  log?: (line: string) => void;
}

export interface PlannerProxy {
  /** Verwerkt één bericht van de client; berichten worden strikt na elkaar verwerkt. */
  handle(message: JSONRPCMessage): Promise<void>;
  /** Stopt een draaiend kindproces (bij het afsluiten van de bundel). */
  close(): Promise<void>;
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
  description: 'Checks the connection of the Open Planner Studio extension. The planner_ tools appear while the desktop app '
    + 'runs with its MCP bridge started, or while the extension can start the planner without the app in its working folder. '
    + 'Call this tool when they are missing: it connects if it can, and otherwise explains what the user must do.',
  inputSchema: { type: 'object', properties: {} },
  annotations: { readOnlyHint: true, openWorldHint: false },
};

export function createPlannerProxy(opts: PlannerProxyOptions, send: (message: JSONRPCMessage) => Promise<void>): PlannerProxy {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const log = opts.log ?? (() => {});
  const root = opts.headless.root;

  /** De `initialize`-parameters van de client; nodig om (opnieuw) te verbinden. */
  let clientInitParams: Json | null = null;
  /**
   * Welke toollijst de client het laatst kreeg: de plannertools of alleen de statustool. Bij elke overgang
   * (en bij elke wissel van planner) krijgt de client `notifications/tools/list_changed`.
   */
  let toolsShown: 'planner' | 'status' | null = null;
  /** Leestools volgens de laatste `tools/list` (`readOnlyHint`). Een onbekende tool telt als wijzigend. */
  const readOnlyTools = new Set<string>();
  /** Aanvragen die nog niet zijn doorgestuurd, ook tijdens verbinden. */
  const queuedIds = new Set<Id>();
  /** Aanvragen die de client annuleerde vóór ze aan de beurt waren; die gaan nooit naar een planner. */
  const cancelledIds = new Set<Id>();
  let internalId = 0;
  let queue: Promise<void> = Promise.resolve();

  /** De planner die de laatste aanvraag kreeg; `null` vóór de eerste. */
  let mode: Mode | null = null;
  /**
   * Gezet na sessieverlies, een wissel of een onverwachte stop: de fout voor elke wijzigende tool, ook voor
   * aanvragen die al in de wachtrij stonden. Alleen een geslaagde hersteltool (`DOCUMENT_RECOVERY_TOOLS`) heft
   * hem op. Omdat de wachtrij strikt op volgorde loopt, zijn aanvragen van vóór dat herstel dan al geweigerd.
   */
  let blocked: string | null = null;
  /** Melding voor het model, vooraan het volgende toolantwoord. */
  let pendingNote: string | null = null;

  // --- De app (bridge) -----------------------------------------------------------------------------
  let app: AppTarget | null = null;
  let appConnected = false;
  let sessionId: string | null = null;
  let protocolVersion: string | null = null;
  /**
   * Een aanvraag kwam niet aan (geen verbinding), maar de sessie kan nog bestaan: na Stop/Start van de bridge
   * in dezelfde app geldt hij nog (`appMcpSessions`). Dan eerst hervatten met een ping, vóór een nieuwe sessie.
   */
  let resumeSession: string | null = null;

  // --- Zonder app (headless kindproces) -------------------------------------------------------------
  let channel: HeadlessChannel | null = null;
  let headlessReady = false;
  /** Documenten van de headless planner met wijzigingen die nog niet met `planner_export_ifc` op schijf staan. */
  const unsaved = new Set<string>();
  /** Een wijziging aan de headless planner kreeg geen antwoord op tijd: ze kan uitgevoerd zijn. Tot dat bekend is,
   *  telt het actieve document als niet opgeslagen (`resolveUncertain`). */
  let uncertainChange = false;
  /** Al gemeld dat de app open is maar de headless planner nog niet opgeslagen werk heeft? */
  let unsavedNoted = false;

  const endpoint = () => `http://127.0.0.1:${app?.port ?? 0}/mcp`;

  async function postApp(message: unknown, withSession: boolean): Promise<Upstream> {
    if (app === null) return { type: 'fail', failure: { kind: 'no-app' } };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${app.token}`,
    };
    const sentSession = withSession && sessionId !== null;
    if (sentSession) headers['Mcp-Session-Id'] = sessionId as string;
    if (withSession && protocolVersion) headers['Mcp-Protocol-Version'] = protocolVersion;
    let res: Response;
    try {
      res = await fetchImpl(endpoint(), {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (isObject(error) && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        return { type: 'fail', failure: { kind: 'timeout' } };
      }
      // Alleen een geweigerde verbinding bewijst dat de bridge niets kreeg; een verbroken verbinding niet.
      const cause = isObject(error) && isObject(error.cause) ? error.cause : null;
      const maybeDelivered = cause?.code !== 'ECONNREFUSED';
      return { type: 'fail', failure: { kind: 'unreachable', detail: describeError(error), maybeDelivered } };
    }
    const text = await res.text().catch(() => '');
    if (res.status === 401) return { type: 'fail', failure: { kind: 'token' } };
    if (res.status === 404 && sentSession) {
      // Elk bericht kan het verlies ontdekken (ook een ping of notificatie); de blokkade hoort bij de
      // verbinding, niet bij dat bericht.
      blocked = SESSION_RESET_MESSAGE;
      log('session lost (app restarted); changes are blocked until a document is chosen again');
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

  /** Neemt een geslaagd `initialize`-antwoord van de bridge over. Geeft een fout als het een weigering is. */
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
    appConnected = true;
    return null;
  }

  const notifyToolsChanged = () => send({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' } as JSONRPCMessage);

  /** Een planner antwoordt: kreeg de client de statustool, dan moet hij de plannertools ophalen. */
  async function markOnline(): Promise<void> {
    if (toolsShown === 'status') {
      toolsShown = null;
      await notifyToolsChanged();
    }
  }

  /** Geen planner bereikbaar: kreeg de client de plannertools, dan moet hij de statustool ophalen. */
  async function markOffline(): Promise<void> {
    if (toolsShown === 'planner') {
      toolsShown = null;
      await notifyToolsChanged();
    }
  }

  /**
   * Opent een (nieuwe) sessie bij de bridge met de `initialize`-parameters van de client. Gebeurt dat terwijl
   * de app al de planner van deze sessie was, dan is het anker van de vorige sessie weg: wijzigingen
   * blijven geweigerd tot een documentkeuze.
   */
  async function connectApp(): Promise<ProxyFailure | null> {
    sessionId = null;
    appConnected = false;
    const reply = await postApp({ jsonrpc: '2.0', id: `ops-mcpb-init-${++internalId}`, method: 'initialize', params: initParams() }, false);
    const failure = adoptInitialize(reply);
    if (failure) return failure;
    resumeSession = null;
    await postApp({ jsonrpc: '2.0', method: 'notifications/initialized' }, true);
    log(`connected to the app: ${endpoint()} (Open Planner Studio ${app?.appVersion}, pid ${app?.pid})${sessionId ? ', new session' : ''}`);
    if (mode === 'app' && blocked === null) {
      blocked = SESSION_RESET_MESSAGE;
      log('new session with the app; changes are blocked until a document is chosen again');
    }
    return null;
  }

  async function closeHeadless(): Promise<void> {
    const old = channel;
    channel = null;
    headlessReady = false;
    unsaved.clear();
    uncertainChange = false;
    if (old) await old.close();
  }

  /**
   * Start de headless planner en stuurt `initialize`. Met `clientId` is dat het `initialize` van de client
   * zelf (het antwoord gaat terug naar de client, die daarna zelf `notifications/initialized` stuurt);
   * zonder `clientId` doet de proxy beide zelf.
   */
  async function connectHeadless(clientId?: Id): Promise<{ failure: ProxyFailure } | { json: unknown }> {
    await closeHeadless();
    let started: HeadlessChannel;
    try {
      started = await opts.headless.start();
    } catch (error) {
      return { failure: { kind: 'headless', message: error instanceof Error ? error.message : String(error) } };
    }
    channel = started;
    const init = await started.request({
      jsonrpc: '2.0', id: clientId ?? `ops-mcpb-init-${++internalId}`, method: 'initialize', params: initParams(),
    }, timeoutMs);
    if (init.type !== 'reply' || !isObject(init.json) || !isObject(init.json.result)) {
      const detail = init.type === 'exited' ? init.detail
        : init.type === 'timeout' ? `no answer within ${Math.round(timeoutMs / 1000)} seconds` : 'no valid initialize answer';
      await closeHeadless();
      return { failure: { kind: 'headless', message: `The planner without the app could not start (${detail}).` } };
    }
    if (clientId === undefined) await started.request({ jsonrpc: '2.0', method: 'notifications/initialized' }, timeoutMs);
    headlessReady = true;
    log(`started the planner without the app on ${inFolder(root)}`);
    return { json: init.json };
  }

  /** Legt de planner van deze aanvraag vast; bij een wissel tijdens de sessie volgen blokkade en melding. */
  async function enter(next: Mode): Promise<void> {
    if (mode === next) return;
    const previous = mode;
    mode = next;
    if (previous === null) {
      log(`mode: ${next === 'app' ? `the app (${endpoint()})` : `without the app (${inFolder(root)})`}`);
      return;
    }
    resumeSession = null;
    if (next === 'app') {
      await closeHeadless();
      blocked = SWITCH_TO_APP_MESSAGE;
      pendingNote = SWITCH_TO_APP_NOTE;
      log(`switched to the app (${endpoint()}); the planner without the app stopped; changes are blocked until a document is chosen`);
    } else {
      appConnected = false;
      sessionId = null;
      blocked = switchToHeadlessMessage(root);
      pendingNote = switchToHeadlessNote(root);
      log(`switched to working without the app (${inFolder(root)}); changes are blocked until a document is opened`);
    }
    // De tools zijn in beide standen dezelfde, maar een app van een andere versie kan er andere hebben.
    toolsShown = null;
    await notifyToolsChanged();
  }

  /**
   * Kiest de planner voor deze aanvraag en zorgt dat hij verbonden is. Geeft de stand, of een fout als
   * geen van beide kan (of als de app niet op tijd antwoordt).
   */
  async function selectBackend(): Promise<Mode | ProxyFailure> {
    if (headlessReady && channel?.alive !== true) {
      // Het kindproces stopte terwijl het niets deed: zijn geheugen is weg.
      headlessReady = false;
      unsaved.clear();
      uncertainChange = false;
      if (mode === 'headless') {
        blocked = headlessLostMessage(root, 'the process ended');
        pendingNote = HEADLESS_RESTART_NOTE;
      }
      log('the planner without the app ended unexpectedly; its unsaved changes are lost');
    }
    const found = opts.findApp();
    const pending = unsaved.size > 0 || uncertainChange;
    if (found === null || !pending) unsavedNoted = false;
    const stayHeadless = found !== null && mode === 'headless' && headlessReady && channel?.alive === true && pending;
    if (stayHeadless && !unsavedNoted) {
      unsavedNoted = true;
      pendingNote = UNSAVED_STAY_NOTE;
      log('the app is open, but the planner without the app has changes that are not written yet; staying without the app');
    }
    let appFailure: ProxyFailure = { kind: 'no-app' };
    if (found !== null && !stayHeadless) {
      if (app === null || app.key !== found.key) {
        // Een andere bridge dan die van de sessie (app herstart, nieuw token, andere poort): nieuwe sessie,
        // en `connectApp` blokkeert dan wijzigingen.
        app = found;
        appConnected = false;
        sessionId = null;
        resumeSession = null;
      }
      if (!appConnected && resumeSession !== null) {
        // Dezelfde bridge, na een aanvraag die niet aankwam: bestaat de sessie nog?
        sessionId = resumeSession;
        const ping = await postApp({ jsonrpc: '2.0', id: `ops-mcpb-ping-${++internalId}`, method: 'ping' }, true);
        if (ping.type === 'ok') {
          appConnected = true;
          resumeSession = null;
          log(`the session with the app on port ${found.port} is still valid; continuing`);
        } else {
          // 404: de sessie is weg (`postApp` blokkeert dan al). Anders is de bridge er nog niet: later opnieuw.
          if (ping.type === 'session-lost') resumeSession = null;
          sessionId = null;
        }
      }
      const failure = appConnected ? null : await connectApp();
      if (failure === null) {
        await enter('app');
        return 'app';
      }
      if (failure.kind === 'timeout') return failure;
      appFailure = failure;
      log(`${appFailureMessage(failure, found.port)} Working without the app.`);
    }
    if (!headlessReady) {
      const started = await connectHeadless();
      if ('failure' in started) {
        return { kind: 'headless', message: offlineMessage(started.failure, appFailure, found?.port ?? null) };
      }
    }
    await enter('headless');
    return 'headless';
  }

  const reply = (id: Id, result: Json) => send({ jsonrpc: '2.0', id, result } as JSONRPCMessage);
  const replyError = (id: Id, message: string, code = -32000) =>
    send({ jsonrpc: '2.0', id, error: { code, message } } as JSONRPCMessage);
  const toolError = (id: Id, text: string) => reply(id, { content: [{ type: 'text', text }], isError: true });

  /** Antwoord zonder planner: de client krijgt een bruikbare uitleg in plaats van een kale fout. */
  async function answerOffline(id: Id, method: string, failure: ProxyFailure): Promise<void> {
    const message = appFailureMessage(failure, app?.port ?? null);
    if (method === 'tools/list') {
      toolsShown = 'status';
      await reply(id, { tools: [STATUS_TOOL] });
      return;
    }
    if (method === 'tools/call') await toolError(id, message);
    else if (method === 'ping') await reply(id, {});
    else await replyError(id, message);
    // Een time-out zegt niet dat de app weg is; de andere fouten wel.
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

  const succeeded = (result: Json) => result.isError !== true
    && !(isObject(result.structuredContent) && result.structuredContent.ok === false);

  /** Verandert deze tool een document? `planner_export_ifc` schrijft het weg; een import of een nieuw document is
   *  nog onveranderd. */
  const changesDocument = (toolName: string | null): toolName is string => toolName !== null
    && !readOnlyTools.has(toolName) && !DOCUMENT_RECOVERY_TOOLS.has(toolName) && toolName !== EXPORT_TOOL;

  /** Het actieve document volgens de envelope van een toolresultaat. */
  function activeDocument(result: Json): string | null {
    const envelope = isObject(result.structuredContent) && isObject(result.structuredContent.envelope)
      ? result.structuredContent.envelope : null;
    return envelope && typeof envelope.activeDocumentId === 'string' ? envelope.activeDocumentId : null;
  }

  /** Houdt bij welke headless documenten wijzigingen hebben die nog niet op schijf staan. */
  function trackUnsaved(toolName: string, result: Json): void {
    if (!succeeded(result)) return;
    const docId = activeDocument(result) ?? '(unknown)';
    if (toolName === EXPORT_TOOL) unsaved.delete(docId);
    else if (changesDocument(toolName)) unsaved.add(docId);
  }

  /**
   * Na een wijziging zonder antwoord: vraag de headless planner welk document actief is (een wijziging verandert
   * dat niet) en tel dat als niet opgeslagen. Het kindproces werkt aanvragen na elkaar af, dus dit antwoord komt
   * pas als de wijziging klaar is. Geen antwoord: het blijft onzeker, en de planner blijft.
   */
  async function resolveUncertain(): Promise<void> {
    const check = await (channel as HeadlessChannel).request({
      jsonrpc: '2.0', id: `ops-mcpb-check-${++internalId}`, method: 'tools/call',
      params: { name: 'planner_list_documents', arguments: {} },
    }, timeoutMs);
    const result = check.type === 'reply' && isObject(check.json) && isObject(check.json.result) ? check.json.result : null;
    const docId = result ? activeDocument(result) : null;
    if (docId === null) return;
    unsaved.add(docId);
    uncertainChange = false;
    log(`the change without an answer counts as not written for document ${docId}`);
  }

  /** Geeft een antwoord van een planner door; een fout zonder id krijgt het id van het request. */
  async function forwardReply(id: Id, method: string, toolName: string | null, json: unknown, status: number): Promise<void> {
    if (Array.isArray(json)) {
      for (const item of json) await send(item as JSONRPCMessage);
      return;
    }
    if (!isObject(json)) {
      await replyError(id, `Open Planner Studio gave an empty answer (HTTP ${status}).`, -32603);
      return;
    }
    if (json.id === null || json.id === undefined) json.id = id;
    const result = isObject(json.result) ? json.result : null;
    if (method === 'initialize' && result) {
      // Altijd `listChanged` aankondigen: de proxy wisselt zelf tussen planners en de statustool.
      const capabilities = isObject(result.capabilities) ? result.capabilities : {};
      const tools = isObject(capabilities.tools) ? capabilities.tools : {};
      result.capabilities = { ...capabilities, tools: { ...tools, listChanged: true } };
      if (typeof result.instructions === 'string') result.instructions += bundleInstructions(root);
    }
    if (method === 'tools/list' && result) {
      rememberTools(json);
      toolsShown = 'planner';
    }
    if (method === 'tools/call' && result && toolName !== null) {
      if (mode === 'headless') trackUnsaved(toolName, result);
      // Het model koos expliciet een document en de sessie is daaraan gebonden: wijzigingen mogen weer.
      if (blocked !== null && DOCUMENT_RECOVERY_TOOLS.has(toolName) && succeeded(result)) {
        blocked = null;
        log(`document chosen with ${toolName}; changes are allowed again`);
      }
      if (pendingNote !== null && Array.isArray(result.content)) {
        result.content = [{ type: 'text', text: pendingNote }, ...result.content];
        pendingNote = null;
      }
    }
    await send(json as JSONRPCMessage);
  }

  /** Een wijzigende tool tijdens een blokkade: geweigerd, met de reden (de melding is dan overbodig). */
  async function refuseBlocked(id: Id): Promise<void> {
    await toolError(id, blocked as string);
    pendingNote = null;
  }

  async function handleStatusTool(id: Id): Promise<void> {
    if (mode === 'app' && appConnected) {
      // Leeft de sessie nog? Zo niet, dan kiest `selectBackend` opnieuw (en verbindt hij opnieuw).
      const ping = await postApp({ jsonrpc: '2.0', id: `ops-mcpb-ping-${++internalId}`, method: 'ping' }, true);
      if (ping.type !== 'ok') {
        appConnected = false;
        if (ping.type === 'fail' && ping.failure.kind !== 'token') resumeSession = sessionId;
      }
    }
    const selected = await selectBackend();
    if (typeof selected !== 'string') {
      await toolError(id, appFailureMessage(selected, app?.port ?? null));
      if (selected.kind !== 'timeout') await markOffline();
      return;
    }
    const where = selected === 'app'
      ? `the Open Planner Studio app (version ${app?.appVersion}) on port ${app?.port}`
      : `the planner without the app, in ${inFolder(root)}`;
    await reply(id, {
      content: [{ type: 'text', text: `Connected to ${where}. The planner_ tools are available; ask for the tool list again if you do not see them.` }],
    });
    await markOnline();
  }

  async function handleInitialize(id: Id, params: Json): Promise<void> {
    // Een nieuwe clientsessie begint opnieuw: geen planner, geen blokkade, geen melding.
    clientInitParams = params;
    toolsShown = null;
    blocked = null;
    pendingNote = null;
    mode = null;
    appConnected = false;
    sessionId = null;
    resumeSession = null;
    await closeHeadless();
    let appFailure: ProxyFailure = { kind: 'no-app' };
    const found = opts.findApp();
    if (found !== null) {
      app = found;
      const result = await postApp({ jsonrpc: '2.0', id, method: 'initialize', params }, false);
      const failure = adoptInitialize(result);
      if (failure === null && result.type === 'ok') {
        await enter('app');
        await forwardReply(id, 'initialize', null, result.json, result.status);
        return;
      }
      appFailure = failure ?? { kind: 'refused', message: 'no valid initialize answer' };
      log(`${appFailureMessage(appFailure, found.port)}${appFailure.kind === 'timeout' ? '' : ' Working without the app.'}`);
    }
    let message: string;
    if (appFailure.kind === 'timeout') {
      message = appFailureMessage(appFailure, found?.port ?? null);
    } else {
      const started = await connectHeadless(id);
      if ('json' in started) {
        await enter('headless');
        await forwardReply(id, 'initialize', null, started.json, 200);
        return;
      }
      message = offlineMessage(started.failure, appFailure, found?.port ?? null);
    }
    // Lokaal antwoorden: de extensie blijft bruikbaar en verbindt zodra een planner er is.
    log(`not connected: ${message}`);
    await reply(id, {
      protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : FALLBACK_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: true } },
      serverInfo: { name: 'open-planner-studio', version: opts.version },
      instructions: `Open Planner Studio is not available yet. ${message} `
        + `When the user has fixed this, call ${STATUS_TOOL_NAME}; the planner_ tools then appear.`,
    });
  }

  /** Stuurt een aanvraag naar de app. `retry` = niet afgeleverd (geen verbinding, 401): kies opnieuw. */
  async function viaApp(id: Id, method: string, toolName: string | null, mutates: boolean, message: Json): Promise<'done' | 'retry'> {
    queuedIds.delete(id); // vanaf deze POST is de aanvraag bij de bridge, niet meer lokaal wachtend
    let result = await postApp(message, true);
    if (result.type === 'session-lost') {
      queuedIds.add(id); // een eventuele veilige herhaling is tijdens opnieuw verbinden weer annuleerbaar
      const failure = await connectApp();
      if (cancelledIds.has(id)) return 'done';
      if (failure) {
        if (failure.kind === 'timeout') await answerOffline(id, method, failure);
        else if (mutates) await toolError(id, SESSION_RESET_MESSAGE);
        else return 'retry';
        return 'done';
      }
      // Alleen herhalen wat niets wijzigt; een wijziging zou zonder het oude anker kunnen verdwalen.
      if (mutates) {
        await toolError(id, SESSION_RESET_MESSAGE);
        return 'done';
      }
      queuedIds.delete(id);
      result = await postApp(message, true);
      if (result.type === 'session-lost') {
        await answerOffline(id, method, { kind: 'refused', message: 'the new session was refused right away; try again' });
        return 'done';
      }
    }
    if (result.type === 'fail') {
      if (result.failure.kind === 'timeout') {
        await answerOffline(id, method, result.failure);
        return 'done';
      }
      appConnected = false;
      if (result.failure.kind !== 'token') resumeSession = sessionId;
      // Een wijziging die aangekomen kan zijn, gaat niet opnieuw: dan zou ze twee keer gebeuren.
      if (mutates && ((result.failure.kind === 'unreachable' && result.failure.maybeDelivered) || result.failure.kind === 'http')) {
        log(`${appFailureMessage(result.failure, app?.port ?? null)} The change may have been carried out; not sending it again.`);
        await toolError(id, UNKNOWN_OUTCOME_MESSAGE);
        return 'done';
      }
      // Niet afgeleverd (de app ging net dicht, of het token geldt niet meer): opnieuw kiezen. Komt dezelfde
      // bridge terug, dan hervat `selectBackend` de sessie als die nog bestaat; anders blokkeert `connectApp`
      // wijzigingen in de nieuwe sessie. Een leesaanvraag mag altijd opnieuw.
      log(`${appFailureMessage(result.failure, app?.port ?? null)} Choosing again.`);
      return 'retry';
    }
    await forwardReply(id, method, toolName, result.json, result.status);
    await markOnline();
    return 'done';
  }

  async function viaHeadless(id: Id, method: string, toolName: string | null, message: Json): Promise<void> {
    if (uncertainChange) {
      await resolveUncertain();
      if (cancelledIds.has(id)) return; // geannuleerd terwijl de controle liep
      // Nog onzeker: niets doorsturen wat het actieve document kan veranderen (ook een documentkeuze niet),
      // anders telt de onzekere wijziging later bij het verkeerde document.
      if (uncertainChange && toolName !== null && !readOnlyTools.has(toolName)) {
        await toolError(id, HEADLESS_BUSY_MESSAGE);
        return;
      }
    }
    queuedIds.delete(id);
    const result = await (channel as HeadlessChannel).request(message, timeoutMs);
    if (result.type === 'exited') {
      headlessReady = false;
      blocked = headlessLostMessage(root, result.detail);
      log(`the planner without the app ended unexpectedly: ${result.detail}`);
      if (method === 'tools/call') await toolError(id, blocked);
      else await replyError(id, blocked);
      return;
    }
    if (result.type === 'timeout') {
      if (changesDocument(toolName)) {
        // Zonder antwoord is niet bewezen dat er niets veranderde: niet weggooien bij een wissel naar de app.
        uncertainChange = true;
        log(`no answer in time to ${toolName}; the planner without the app counts as having changes that are not written`);
      }
      const text = `The planner without the app did not answer within ${Math.round(timeoutMs / 1000)} seconds. `
        + 'It is not known whether the request was carried out. Read the plan again before you retry a change.';
      if (method === 'tools/call') await toolError(id, text);
      else await replyError(id, text);
      return;
    }
    if (result.type === 'none') {
      await replyError(id, 'The planner without the app gave no answer.', -32603);
      return;
    }
    await forwardReply(id, method, toolName, result.json, 200);
    await markOnline();
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
    const refuses = () => mutates && blocked !== null && !DOCUMENT_RECOVERY_TOOLS.has(toolName as string);
    if (refuses()) {
      await refuseBlocked(id);
      return;
    }
    // Hooguit twee keer kiezen: de tweede keer na een aanvraag die de app niet afleverde.
    for (let attempt = 0; attempt < 2; attempt++) {
      const selected = await selectBackend();
      if (cancelledIds.has(id)) return;
      if (typeof selected !== 'string') {
        await answerOffline(id, method, selected);
        return;
      }
      // Een wissel bij deze keuze zet de blokkade: dan geldt die al voor deze aanvraag.
      if (refuses()) {
        await refuseBlocked(id);
        return;
      }
      if (selected === 'headless') {
        await viaHeadless(id, method, toolName, message);
        return;
      }
      if (await viaApp(id, method, toolName, mutates, message) === 'done') return;
    }
    await answerOffline(id, method, { kind: 'refused', message: 'the connection changed twice during this request; try again' });
  }

  async function handleNotification(message: Json): Promise<void> {
    // Een annulering van een aanvraag die geen planner ooit zag, hoeft niet door.
    if (message.method === 'notifications/cancelled' && isObject(message.params) && isId(message.params.requestId)
      && cancelledIds.delete(message.params.requestId)) {
      return;
    }
    // Zonder planner is er niemand om het aan te melden; het eigen `initialize` stuurt zijn eigen melding.
    if (mode === 'headless' && headlessReady && channel !== null) {
      await channel.request(message, timeoutMs);
      return;
    }
    if (mode !== 'app' || !appConnected) return;
    const result = await postApp(message, true);
    if (result.type === 'session-lost') await connectApp();
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
        queuedIds.delete(id); // ook een lokale weigering of verbindingsfout ruimt de wachtregistratie op
      }
    } else if (method !== null) {
      await handleNotification(raw);
    }
    // Een antwoord van de client hoort bij een request van de server; de planners sturen die niet.
  }

  return {
    handle(message) {
      const raw = message as unknown as Json;
      // Annuleringen meteen verwerken, niet achter in de wachtrij: anders ging een wachtende wijziging
      // die de client al had opgegeven alsnog naar een planner (MCP 2025-06-18, cancellation).
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
          await replyError(raw.id, `Internal error in the Open Planner Studio extension: ${describeError(error)}`, -32603)
            .catch(() => {});
        }
      });
      queue = next;
      return next;
    },
    close: closeHeadless,
  };
}
