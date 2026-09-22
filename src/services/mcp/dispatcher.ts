// MCP-dispatcher — minimale streamable-HTTP-JSON-RPC-afhandeling zonder SDK-dependency.
//
// Ontvangt de RAUWE HTTP-body (JSON-RPC) en geeft de RAUWE respons-body terug; de Rust-shell
// forwardt alleen bytes (spec §Architectuur: "TS weet niets van HTTP"). Tools-only subset:
// initialize / notifications/initialized / tools/list / tools/call / ping.
//
// Guards (drift, pauze/alleen-lezen, AI-backup, transactie) zitten NIET hier — die draaien in een
// hogere laag op de dispatch-grens (spec §Sessie-semantiek / §AI-backup). Deze laag routeert puur.
import type { McpContext, McpToolResult, McpToolDef } from './contracts';
import { getTools, getTool } from './toolRegistry';
import { ATOMIC_ITEM_TOOLS, validateToolArgs } from './schemaValidate';

/** serverInfo.name in de initialize-respons. */
export const MCP_SERVER_NAME = 'open-planner-studio';
/**
 * `serverInfo.version` in de initialize-respons: de APP-CalVer uit package.json, via de
 * `__APP_VERSION__`-define uit vite.config.ts — dezelfde bron als de titelbalk, de updater en de
 * extensie-SDK. Eén versie voor het hele product dus: een AI-client die logt met welke bridge hij
 * praat, noemt daarmee de echte app-versie (Cargo blijft bewust 0.1.0 en telt hier niet mee).
 *
 * De `typeof`-terugval is het codebase-patroon uit `extensionLoader.ts`: in de headless testrunners
 * draait esbuild zónder die define, en een kale verwijzing zou daar een ReferenceError geven.
 */
export const MCP_SERVER_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
/** Onze default MCP-protocolversie wanneer de client er geen bekende meestuurt. */
export const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

/**
 * `InitializeResult.instructions` — het optionele vrije-tekstveld uit de MCP-spec dat clients
 * (Claude Code e.d.) in hun systeemprompt zetten. Dit is het ENIGE kanaal waarlangs de app een
 * agent ONGEVRAAGD iets kan meegeven: tools/list beschrijft losse tools, maar niet hoe je een
 * planning hoort te bouwen. Zonder dit veld begint elke agent blanco en levert hij het klassieke
 * resultaat op — taken zonder relaties, een vaste datum op alles, een veel te fijne opdeling.
 *
 * ENGELS, en dat is bewust: de dispatcher kent de UI-taal niet (hij draait onder de Rust-bridge,
 * los van i18n) en een MCP-client vertaalt zelf naar de taal van het gesprek — dezelfde afweging
 * als bij `MCP_UNTITLED_TITLE` in `tools/runtime.ts`.
 *
 * KORT HOUDEN: dit gaat in élke systeemprompt mee. Alleen de regels die een agent zonder verdere
 * vraag fout doet; de volledige inhoud staat in de gids, bereikbaar via de tool die hieronder
 * genoemd wordt (`planner_get_planning_guide`, `tools/guideTools.ts`). Eén exportconstante zodat
 * `tests/mcp/cases-planning-guide.ts` hem tegen de initialize-respons kan houden.
 */
export const MCP_INSTRUCTIONS = [
  'Open Planner Studio is a construction planning application. You are editing a real schedule that a person will rely on.',
  '',
  'Core rules:',
  '- Start from the milestones and the delivery date, then fill in the work that leads to them.',
  '- Build a WBS of tasks that each take roughly one day to two weeks. Finer is unmaintainable, coarser is unsteerable. Summary tasks never get their own duration.',
  '- Drive the schedule with relationships, not fixed dates. Finish-to-start is the default; every task needs at least one predecessor and one successor apart from the first task and the final milestone. Use date constraints only for hard external dates the user gave you (permit, closure window, connection date) — a few percent of tasks at most, and never a negative lag.',
  '- Mutating tools recalculate the schedule themselves, so you never work on stale dates. Call planner_run_cpm to OBTAIN the result (project end, duration, critical path) — not to refresh anything.',
  '- Use planner_batch for a coherent series of steps: one undo step, one recalculation, one backup.',
  '- Finish by telling the user what you assumed: estimated durations, the chosen granularity, relationships you added on your own, resource capacities, calendar assumptions, and every constraint you set and why. Also say what you deliberately did not do.',
  '',
  'For the full guide call `planner_get_planning_guide`, or read https://open-planner-studio.open-aec.com/docs/en/gids-goed-plannen.md',
].join('\n');

/** Protocolversies die we herkennen en dus mogen echoën (nieuwste eerst). */
const KNOWN_PROTOCOL_VERSIONS = new Set(['2025-06-18', '2025-03-26', '2024-11-05']);

type JsonRpcId = string | number | null;

// --- JSON-RPC-encoders ---------------------------------------------------------------------------

function resultMsg(id: JsonRpcId, result: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function errorMsg(id: JsonRpcId, code: number, message: string): string {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

// --- Verpakkers ----------------------------------------------------------------------------------

/** Eén list-item voor tools/list: naam, beschrijving, inputSchema en annotaties. */
function toolListEntry(def: McpToolDef): object {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    annotations: def.annotations,
  };
}

/** Verpak een `McpToolResult` als MCP-tool-result (content-tekst + structuredContent + isError). */
function wrapToolResult(result: McpToolResult): object {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: result,
    isError: !result.ok,
  };
}

// --- Dispatch ------------------------------------------------------------------------------------

/**
 * Verwerk één rauwe JSON-RPC-body en geef de rauwe respons-body terug.
 * Notificaties (bericht zonder `id`) leveren een lege string op — geen respons.
 */
export async function handleMcpMessage(rawBody: string, ctx: McpContext): Promise<string> {
  let msg: any;
  try {
    msg = JSON.parse(rawBody);
  } catch {
    return errorMsg(null, -32700, 'Parse error');
  }

  // Batch-arrays worden bewust niet ondersteund (tools-only subset).
  if (Array.isArray(msg)) {
    return errorMsg(null, -32600, 'Batch-arrays van JSON-RPC-berichten worden niet ondersteund');
  }
  if (msg === null || typeof msg !== 'object') {
    return errorMsg(null, -32600, 'Ongeldig JSON-RPC-bericht');
  }

  const isNotification = !('id' in msg);
  const id: JsonRpcId = isNotification ? null : msg.id;
  const method: unknown = msg.method;

  if (typeof method !== 'string') {
    return isNotification ? '' : errorMsg(id, -32600, 'Ongeldig JSON-RPC-bericht: ontbrekende methode');
  }

  // Notificaties (o.a. notifications/initialized): geen respons.
  if (isNotification) {
    return '';
  }

  switch (method) {
    case 'initialize': {
      const clientVersion: unknown = msg.params?.protocolVersion;
      const protocolVersion =
        typeof clientVersion === 'string' && KNOWN_PROTOCOL_VERSIONS.has(clientVersion)
          ? clientVersion
          : DEFAULT_PROTOCOL_VERSION;
      return resultMsg(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
        // Optioneel spec-veld; clients zetten het in hun systeemprompt. Zie MCP_INSTRUCTIONS.
        instructions: MCP_INSTRUCTIONS,
      });
    }

    case 'ping':
      return resultMsg(id, {});

    case 'tools/list':
      return resultMsg(id, { tools: getTools().map(toolListEntry) });

    case 'tools/call': {
      const name: unknown = msg.params?.name;
      const def = typeof name === 'string' ? getTool(name) : undefined;
      if (!def) {
        return errorMsg(id, -32602, `Onbekende tool: ${String(name)}`);
      }
      // SCHEMA-POORT (audit-fix S): valideer de argumenten tegen `def.inputSchema` VÓÓR de handler.
      // Zonder deze regel was elk `enum`/`type`/`required`/`minimum`/`additionalProperties` in de 33
      // schema's puur decoratief — het ging mee in tools/list (waar de AI zich erop verlaat) maar
      // werd nergens afgedwongen, dus alles wat een tool niet zélf hercontroleerde gleed erdoor.
      // De schending komt terug als TOOL-resultaat (isError + structuredContent met code VALIDATION),
      // niet als JSON-RPC-fout: zo ziet de AI-client dezelfde foutvorm als bij elke andere
      // VALIDATION-weigering. Geen envelop: die hangt aan de store-laag en die raken we hier niet aan.
      //
      // DIEPTE — DE BULK-CONVENTIE BLIJFT LEIDEND. Deze poort mag een bulk-call NOOIT in zijn geheel
      // afwijzen om één rot item: spec §batch (T19/T20) zegt dat één rotte regel de bulk niet
      // terugrolt, en de handlers maken er een `itemRejections`-regel van. De poort is daarom STRIKT
      // op het bovenste niveau (onbekende top-level sleutels, `required`, scalairen, en van arrays de
      // buitenkant: array-zijn, `minItems`, elementtype) en laat de BINNENKANT van array-items aan de
      // tool. Enige uitzondering: `ATOMIC_ITEM_TOOLS` (vandaag alleen `planner_add_tasks`), wiens
      // contract per definitie alles-of-niets is. Zie de DIEPTE-REGEL in `schemaValidate.ts`.
      const schemaError = validateToolArgs(def.inputSchema, msg.params?.arguments, {
        deepArrayItems: ATOMIC_ITEM_TOOLS.has(def.name),
      });
      if (schemaError) {
        const err: McpToolResult = {
          ok: false,
          code: 'VALIDATION',
          error: `ongeldige argumenten voor ${def.name} — ${schemaError}`,
        };
        return resultMsg(id, wrapToolResult(err));
      }
      // Crash-barrière: een gooiende/rejectende handler mag de dispatcher niet laten omvallen én
      // mag geen interne details (message/stack) naar de client lekken — statische -32603-melding.
      let result: McpToolResult;
      try {
        result = await def.handler(msg.params?.arguments, ctx);
      } catch (e) {
        if (import.meta.env.DEV) console.error(`[mcp] handler '${def.name}' gooide:`, e);
        return errorMsg(id, -32603, `Interne fout bij uitvoeren van tool ${def.name}`);
      }
      return resultMsg(id, wrapToolResult(result));
    }

    default:
      return errorMsg(id, -32601, `Onbekende methode: ${method}`);
  }
}
