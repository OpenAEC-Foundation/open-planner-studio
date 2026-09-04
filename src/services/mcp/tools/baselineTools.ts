// MCP-toolmodule — BASELINEBEHEER: opsommen, activeren, hernoemen, verwijderen.
//
// WAAROM DEZE MODULE BESTAAT (auditbevinding): `planner_save_baseline` (calendarResourceTools) kon er
// één MAKEN, en `planner_compare_baseline`/`planner_analyze_delay` (readTools) weigerden zonder
// ACTIEVE baseline met de tekst "activeer er een" — terwijl er geen enkele tool bestond om er één te
// activeren, op te sommen, te hernoemen of te verwijderen. De agent kreeg dus een instructie die hij
// niet kón opvolgen: het antwoord wees naar een weg die niet bestond. Dat is dezelfde klasse fout als
// de stille no-ops die deze bridge net heeft uitgeroeid, alleen dan aan de kant van het ADVIES.
//
// GEEN TWEEDE MODEL. De store kán dit alles al: `baselineSlice` heeft `saveBaseline`,
// `deleteBaseline`, `renameBaseline` en `setActiveBaseline`, en de BaselineDialog gebruikt precies
// die vier. Deze module legt daar alleen het MCP-oppervlak op — er is dus GEEN nieuwe slice-actie
// bijgekomen en de UI en de bridge blijven op één waarheid werken (inclusief de terugval-regel bij
// het verwijderen van de actieve baseline, die in de slice woont).
//
// CONVENTIES (zie de kop van `taskTools.ts`): `planner_`-prefix, een description waarop de AI kiest,
// de standaard-annotaties, en per muterende tool de driedeling `parseX` (pure vormvalidatie ⇒ args of
// een foutstring) / `xCore` (synchrone, transactie-vrije mutatie ⇒ `MutationOutcome`) / `handler`
// (guards + backup + eigen transactie via `runMutateTool`). Daardoor draait elke tool zowel los als
// als `batchStep` binnen `planner_batch`, met exact ÉÉN implementatie van de mutatie.
//
// NOOIT `ok` ZONDER EFFECT — en ook nooit een spurious undo-stap. Een activatie/hernoeming die
// niets verandert (al actief, zelfde naam) gaat NIET door `runInMcpTransaction`: dat zou een
// undo-snapshot pushen en de redo-stack van de gebruiker wissen voor een AI-no-op. Zo'n call komt
// terug via `okDirect` met `changed: false` en een reden — geslaagd én eerlijk.
//
// VERSHEID SPEELT HIER GEEN ROL. Anders dan `save_baseline` (die een SNAPSHOT van de planning maakt
// en daarom `ensureFreshSchedule()` nodig heeft) raken deze vier tools alleen metadata: welke
// baseline bestaat, hoe hij heet en welke actief is. Een stale planning maakt die antwoorden niet
// onjuist, dus er wordt hier bewust niet herrekend.
import type { AppState } from '@/state/appStore';
import type { Baseline } from '@/types/baseline';
import type { McpContext, McpToolDef } from '../contracts';
import type { BatchStepTool } from './batchTool';
import { okDirect } from './helpers';
import {
  guardNonTransactional,
  McpStepError,
  runMutateTool,
  runReadTool,
  toolError,
  type MutationOutcome,
} from './runtime';

const STD_ANNOT = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

/** Leestool-annotaties, gelijk aan die van `readTools.ts`. */
const READ_ANNOT = { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false };

/** Standaardverwijzing in elke weigering: waar haalt de agent geldige id's vandaan? */
const LIST_HINT = "haal geldige id's op met planner_list_baselines";

// ── Gedeelde vormcontrole ────────────────────────────────────────────────────────────────────────

/**
 * Weiger onbekende argumentsleutels ZELF (dus niet alleen via de schemapoort in de dispatcher):
 * dezelfde reden als bij de leestools — een tool hoort correct te zijn ongeacht welk pad hem
 * aanroept, en een genegeerde sleutel is een antwoord dat plausibel lijkt maar iets anders deed dan
 * gevraagd. Retourneert een foutboodschap, of null wanneer de sleutels kloppen.
 */
function rejectUnknownKeys(args: unknown, allowed: readonly string[], toolName: string): string | null {
  if (args === undefined || args === null) return null;
  if (typeof args !== 'object' || Array.isArray(args)) {
    return `${toolName} verwacht een object met argumenten`;
  }
  for (const key of Object.keys(args as Record<string, unknown>)) {
    if (allowed.includes(key)) continue;
    return allowed.length === 0
      ? `${toolName} neemt geen argumenten, maar kreeg \`${key}\``
      : `onbekend argument \`${key}\` voor ${toolName}; toegestaan: ${allowed.join(', ')}`;
  }
  return null;
}

/** Compacte, leesbare regel per baseline voor in een foutmelding (max 5, daarna "…"). */
function knownBaselinesHint(s: AppState): string {
  if (s.baselines.length === 0) return 'er zijn nog geen baselines — maak er één met planner_save_baseline';
  const shown = s.baselines.slice(0, 5).map((b) => `${b.id} ('${b.name}')`);
  const rest = s.baselines.length - shown.length;
  return `bekende baselines: ${shown.join(', ')}${rest > 0 ? ` (+${rest} meer)` : ''}`;
}

/** Zoek een baseline; `null` wanneer onbekend. */
function findBaseline(s: AppState, id: string): Baseline | null {
  return s.baselines.find((b) => b.id === id) ?? null;
}

/** Naam van een baseline-id, of null (voor de before/after-rapportage). */
function nameOf(s: AppState, id: string | null): string | null {
  if (!id) return null;
  return findBaseline(s, id)?.name ?? null;
}

// =================================================================================================
// 1. planner_list_baselines  (LEESTOOL)
// =================================================================================================

function listBaselinesCore(s: AppState) {
  const active = s.activeBaselineId;
  const baselines = s.baselines.map((b) => ({
    id: b.id,
    name: b.name,
    createdAt: b.createdAt,
    taskCount: b.tasks.length,
    projectEnd: b.projectEnd || null,
    projectDuration: b.projectDuration,
    isActive: b.id === active,
  }));
  // De hint is het antwoord op "en nu?" — precies wat er ontbrak toen compare_baseline naar een
  // niet-bestaande tool wees.
  let hint: string | undefined;
  if (baselines.length === 0) {
    hint = 'Er zijn nog geen baselines. Leg er een vast met planner_save_baseline; pas daarna kunnen planner_compare_baseline en planner_analyze_delay meten.';
  } else if (!active) {
    hint = 'Er is geen ACTIEVE baseline; planner_compare_baseline en planner_analyze_delay weigeren tot je er één activeert met planner_activate_baseline.';
  }
  return {
    count: baselines.length,
    activeBaselineId: active,
    activeBaselineName: nameOf(s, active),
    baselines,
    ...(hint ? { hint } : {}),
  };
}

const listBaselines: McpToolDef = {
  name: 'planner_list_baselines',
  description:
    'Som alle opgeslagen baselines (nulmetingen) op: id, naam, opslagmoment, aantal vastgelegde taken, ' +
    'vastgelegd projecteinde en WELKE er actief is. Gebruik dit om aan de id\'s te komen voor ' +
    'planner_activate_baseline / planner_rename_baseline / planner_delete_baseline, en om te zien ' +
    'waartegen planner_compare_baseline en planner_analyze_delay meten. Is er geen (actieve) baseline, ' +
    'dan zegt `hint` welke tool dat verhelpt.',
  kind: 'read',
  batchable: true,
  annotations: { ...READ_ANNOT },
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler(args, ctx) {
    const bad = rejectUnknownKeys(args, [], 'planner_list_baselines');
    if (bad) return toolError(ctx, 'VALIDATION', bad);
    return runReadTool(ctx, (s) => listBaselinesCore(s));
  },
};

// =================================================================================================
// 2. planner_activate_baseline
//
// `baselineId: null` is bewust geldig: "meet nergens tegen af". Dat is de enige manier om terug te
// komen in de toestand waarin compare_baseline/analyze_delay weigeren, en de store ondersteunt hem
// (`setActiveBaseline(null)`). Zonder die mogelijkheid zou de bridge minder kunnen dan de UI.
// =================================================================================================

interface ActivateArgs { baselineId: string | null }

function parseActivate(args: unknown): ActivateArgs | string {
  const bad = rejectUnknownKeys(args, ['baselineId'], 'planner_activate_baseline');
  if (bad) return bad;
  const a = (args ?? {}) as { baselineId?: unknown };
  if (!('baselineId' in a) || a.baselineId === undefined) {
    return '`baselineId` is verplicht (het id van de baseline die actief moet worden, of null om geen baseline actief te hebben)';
  }
  if (a.baselineId === null) return { baselineId: null };
  if (typeof a.baselineId !== 'string' || a.baselineId === '') {
    return `\`baselineId\` moet een niet-lege string zijn (of null), kreeg ${typeof a.baselineId} '${String(a.baselineId)}'`;
  }
  return { baselineId: a.baselineId };
}

/** Beschrijft wat een activatie zou doen — gedeeld door de handler (no-op-snelpad) en de kern. */
function activatePlan(s: AppState, p: ActivateArgs): { error: string } | { changed: boolean; data: unknown } {
  if (p.baselineId !== null && !findBaseline(s, p.baselineId)) {
    return { error: `onbekende baseline-id '${p.baselineId}' — ${LIST_HINT} (${knownBaselinesHint(s)})` };
  }
  const previousActiveBaselineId = s.activeBaselineId;
  const changed = previousActiveBaselineId !== p.baselineId;
  return {
    changed,
    data: {
      activeBaselineId: p.baselineId,
      activeBaselineName: nameOf(s, p.baselineId),
      previousActiveBaselineId,
      previousActiveBaselineName: nameOf(s, previousActiveBaselineId),
      changed,
      ...(changed
        ? {}
        : {
            reason: p.baselineId === null
              ? 'er was al geen actieve baseline — er is niets gewijzigd'
              : 'deze baseline was al actief — er is niets gewijzigd',
          }),
      ...(p.baselineId === null && changed
        ? { note: 'Er is nu GEEN actieve baseline; planner_compare_baseline en planner_analyze_delay weigeren tot je er weer één activeert.' }
        : {}),
    },
  };
}

function activateCore(ctx: McpContext, p: ActivateArgs): MutationOutcome {
  const s = ctx.app.store.getState();
  const plan = activatePlan(s, p);
  if ('error' in plan) throw new McpStepError('VALIDATION', plan.error);
  // Ook binnen een batch: geen wijziging ⇒ geen store-aanroep (setActiveBaseline is dan zelf al een
  // no-op, maar we melden het expliciet i.p.v. te doen alsof er iets gebeurde).
  if (plan.changed) ctx.app.store.getState().setActiveBaseline(p.baselineId);
  return { data: plan.data };
}

const activateBaseline: BatchStepTool = {
  name: 'planner_activate_baseline',
  description:
    'Maak een bestaande baseline de ACTIEVE — dat is degene waartegen planner_compare_baseline en ' +
    'planner_analyze_delay meten. Geef `baselineId: null` om géén baseline actief te hebben (die twee ' +
    'tools weigeren dan). Id\'s haal je op met planner_list_baselines; een onbekend id wordt geweigerd. ' +
    'Was de baseline al actief, dan meldt het antwoord `changed: false` en verandert er niets (geen ' +
    'extra ongedaan-maak-stap).',
  kind: 'mutate',
  batchable: true,
  // Idempotent: dezelfde baseline nogmaals activeren levert dezelfde toestand op.
  annotations: { ...STD_ANNOT, idempotentHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      baselineId: {
        type: ['string', 'null'],
        description: 'Id van de baseline die actief moet worden (planner_list_baselines), of null voor geen actieve baseline.',
      },
    },
    required: ['baselineId'],
    additionalProperties: false,
  },
  batchStep(args, ctx) {
    const parsed = parseActivate(args);
    if (typeof parsed === 'string') throw new McpStepError('VALIDATION', parsed);
    return activateCore(ctx, parsed);
  },
  async handler(args, ctx) {
    const parsed = parseActivate(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);

    const g = guardNonTransactional(ctx);
    if (g) return g;

    const plan = activatePlan(ctx.app.store.getState(), parsed);
    if ('error' in plan) return toolError(ctx, 'VALIDATION', plan.error);
    // No-op-snelpad (zelfde patroon als move_project met Δ=0): geen transactie, dus geen
    // undo-snapshot en geen gewiste redo-stack voor een AI-call die niets veranderde.
    if (!plan.changed) return okDirect(ctx, plan.data, []);

    return await runMutateTool(ctx, 'mutate', (): MutationOutcome => activateCore(ctx, parsed));
  },
};

// =================================================================================================
// 3. planner_rename_baseline
// =================================================================================================

interface RenameArgs { baselineId: string; name: string }

function parseRename(args: unknown): RenameArgs | string {
  const bad = rejectUnknownKeys(args, ['baselineId', 'name'], 'planner_rename_baseline');
  if (bad) return bad;
  const a = (args ?? {}) as { baselineId?: unknown; name?: unknown };
  if (typeof a.baselineId !== 'string' || a.baselineId === '') {
    return `\`baselineId\` moet een niet-lege string zijn (${LIST_HINT}), kreeg ${a.baselineId === undefined ? 'niets' : `${typeof a.baselineId} '${String(a.baselineId)}'`}`;
  }
  if (typeof a.name !== 'string') {
    return `\`name\` moet een string zijn, kreeg ${a.name === undefined ? 'niets' : `${typeof a.name} '${String(a.name)}'`}`;
  }
  // Een lege/witruimte-naam maakt de baseline in de lijst en de dialoog onherkenbaar; hem stil
  // accepteren zou een geslaagde call zijn die de agent zijn eigen referentiepunt kost.
  if (a.name.trim() === '') return '`name` mag niet leeg zijn — geef een herkenbare naam';
  return { baselineId: a.baselineId, name: a.name };
}

function renamePlan(s: AppState, p: RenameArgs): { error: string } | { changed: boolean; data: unknown } {
  const b = findBaseline(s, p.baselineId);
  if (!b) {
    return { error: `onbekende baseline-id '${p.baselineId}' — ${LIST_HINT} (${knownBaselinesHint(s)})` };
  }
  const changed = b.name !== p.name;
  const duplicate = s.baselines.some((x) => x.id !== p.baselineId && x.name === p.name);
  return {
    changed,
    data: {
      baselineId: p.baselineId,
      name: p.name,
      previousName: b.name,
      changed,
      ...(changed ? {} : { reason: 'de baseline heette al zo — er is niets gewijzigd' }),
      // Dubbele namen zijn toegestaan (de UI staat ze ook toe) maar maken de lijst dubbelzinnig;
      // dat melden we, i.p.v. het stil te laten gebeuren of het onnodig te weigeren.
      ...(duplicate ? { warning: `Een andere baseline heet ook '${p.name}'; ze zijn alleen nog op id te onderscheiden.` } : {}),
    },
  };
}

function renameCore(ctx: McpContext, p: RenameArgs): MutationOutcome {
  const plan = renamePlan(ctx.app.store.getState(), p);
  if ('error' in plan) throw new McpStepError('VALIDATION', plan.error);
  if (plan.changed) ctx.app.store.getState().renameBaseline(p.baselineId, p.name);
  return { data: plan.data };
}

const renameBaseline: BatchStepTool = {
  name: 'planner_rename_baseline',
  description:
    'Hernoem een opgeslagen baseline. `baselineId` haal je op met planner_list_baselines; een onbekend ' +
    'id of een lege naam wordt geweigerd. Draagt de baseline de naam al, dan meldt het antwoord ' +
    '`changed: false` en verandert er niets. De naam hoeft niet uniek te zijn, maar een botsing wordt ' +
    'als `warning` gemeld.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...STD_ANNOT, idempotentHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      baselineId: { type: 'string', description: 'Id van de te hernoemen baseline (planner_list_baselines).' },
      name: { type: 'string', description: 'De nieuwe naam; mag niet leeg zijn.' },
    },
    required: ['baselineId', 'name'],
    additionalProperties: false,
  },
  batchStep(args, ctx) {
    const parsed = parseRename(args);
    if (typeof parsed === 'string') throw new McpStepError('VALIDATION', parsed);
    return renameCore(ctx, parsed);
  },
  async handler(args, ctx) {
    const parsed = parseRename(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);

    const g = guardNonTransactional(ctx);
    if (g) return g;

    const plan = renamePlan(ctx.app.store.getState(), parsed);
    if ('error' in plan) return toolError(ctx, 'VALIDATION', plan.error);
    if (!plan.changed) return okDirect(ctx, plan.data, []);

    return await runMutateTool(ctx, 'mutate', (): MutationOutcome => renameCore(ctx, parsed));
  },
};

// =================================================================================================
// 4. planner_delete_baseline
//
// VERWIJDEREN IS GEVAARLIJK WERK — daarom drie bewuste keuzes:
//   1. ÉÉN id per call, geen bulk. De andere verwijdertool (`delete_tasks`) is bulk omdat taken met
//      tientallen tegelijk sneuvelen; baselines zijn schaars, kostbaar (een nulmeting is niet te
//      reconstrueren uit het huidige plan) en het verwijderen ervan verschuift bovendien de
//      MEETLAT. Eén per call houdt elke verwijdering een expliciete beslissing.
//   2. Onbekend id ⇒ HARDE weigering, geen zachte per-item-melding en zeker geen `ok`. Er valt bij
//      één id niets deels te slagen.
//   3. De respons meldt het ECHTE voor/na-verschil, inclusief het NEVENEFFECT op de actieve
//      baseline. De slice laat `activeBaselineId` bij het verwijderen van de actieve terugvallen op
//      de LAATST OVERGEBLEVEN baseline (en anders op null) — dat is bestaand, door de UI gedeeld
//      gedrag, en het betekent dat compare_baseline/analyze_delay dáárna tegen een ANDERE meetlat
//      meten. Dat stil laten gebeuren zou precies de onderrapportage zijn die bij `delete_tasks` is
//      gefixt, dus het staat expliciet in `activeBaselineId`/`note`.
// =================================================================================================

interface DeleteArgs { baselineId: string }

function parseDelete(args: unknown): DeleteArgs | string {
  const bad = rejectUnknownKeys(args, ['baselineId'], 'planner_delete_baseline');
  if (bad) return bad;
  const a = (args ?? {}) as { baselineId?: unknown };
  if (typeof a.baselineId !== 'string' || a.baselineId === '') {
    return `\`baselineId\` moet een niet-lege string zijn (${LIST_HINT}), kreeg ${a.baselineId === undefined ? 'niets' : `${typeof a.baselineId} '${String(a.baselineId)}'`}`;
  }
  return { baselineId: a.baselineId };
}

function deleteCore(ctx: McpContext, p: DeleteArgs): MutationOutcome {
  const before = ctx.app.store.getState();
  const target = findBaseline(before, p.baselineId);
  if (!target) {
    throw new McpStepError(
      'VALIDATION',
      `onbekende baseline-id '${p.baselineId}' — ${LIST_HINT} (${knownBaselinesHint(before)})`,
    );
  }
  const wasActive = before.activeBaselineId === p.baselineId;
  const previousActiveBaselineId = before.activeBaselineId;

  ctx.app.store.getState().deleteBaseline(p.baselineId);

  // NA-staat vers uit de store lezen: de terugval-regel woont in de slice, dus we RAPPORTEREN wat er
  // gebeurd is in plaats van hem hier na te rekenen (twee waarheden zouden gaan divergeren).
  const after = ctx.app.store.getState();
  if (findBaseline(after, p.baselineId)) {
    throw new McpStepError('INTERNAL', `baseline '${p.baselineId}' staat er na het verwijderen nog steeds`);
  }
  const activeBaselineId = after.activeBaselineId;
  const activeBaselineName = nameOf(after, activeBaselineId);

  let note: string | undefined;
  if (wasActive && activeBaselineId) {
    note =
      `De verwijderde baseline was de ACTIEVE; '${activeBaselineName}' (${activeBaselineId}) is nu actief. ` +
      'planner_compare_baseline en planner_analyze_delay meten voortaan tegen díe meetlat — kies zo nodig ' +
      'een andere met planner_activate_baseline.';
  } else if (wasActive) {
    note =
      'De verwijderde baseline was de ACTIEVE en er is er geen meer over: planner_compare_baseline en ' +
      'planner_analyze_delay weigeren nu tot je er een nieuwe vastlegt met planner_save_baseline.';
  }

  return {
    data: {
      deletedBaselineId: target.id,
      deletedName: target.name,
      deletedCreatedAt: target.createdAt,
      deletedTaskCount: target.tasks.length,
      wasActive,
      previousActiveBaselineId,
      activeBaselineId,
      activeBaselineName,
      remainingCount: after.baselines.length,
      ...(note ? { note } : {}),
    },
  };
}

const deleteBaseline: BatchStepTool = {
  name: 'planner_delete_baseline',
  description:
    'Verwijder ÉÉN opgeslagen baseline (een nulmeting is daarna niet te reconstrueren — de gebruiker ' +
    'kan het wel ongedaan maken). `baselineId` haal je op met planner_list_baselines; een onbekend id ' +
    'wordt geweigerd. LET OP: verwijder je de ACTIEVE baseline, dan valt de actieve terug op de laatst ' +
    'overgebleven baseline, of op géén als er niets overblijft — het antwoord meldt met `wasActive`, ' +
    '`activeBaselineId` en `remainingCount` exact wat er daarna geldt, want dit verschuift de meetlat ' +
    'van planner_compare_baseline en planner_analyze_delay.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...STD_ANNOT, destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      baselineId: { type: 'string', description: 'Id van de te verwijderen baseline (planner_list_baselines).' },
    },
    required: ['baselineId'],
    additionalProperties: false,
  },
  batchStep(args, ctx) {
    const parsed = parseDelete(args);
    if (typeof parsed === 'string') throw new McpStepError('VALIDATION', parsed);
    return deleteCore(ctx, parsed);
  },
  async handler(args, ctx) {
    const parsed = parseDelete(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    // Geen no-op-snelpad: een bekend id verwijdert altijd iets, een onbekend id is een fout.
    return await runMutateTool(ctx, 'mutate', (): MutationOutcome => deleteCore(ctx, parsed));
  },
};

/** Alle baselinebeheer-tools als vlakke module-array (registreer via één regel in toolRegistry.MODULES). */
export const baselineTools: McpToolDef[] = [
  listBaselines,
  activateBaseline,
  renameBaseline,
  deleteBaseline,
];

/** Losse export voor gerichte tests/tooling. */
export { listBaselines, activateBaseline, renameBaseline, deleteBaseline };
