// MCP-bridge — `planner_batch`: de batch-executor (taak T22, spec §Compositie (1): `batch`).
//
// Eén call met een DECLARATIEF draaiboek: `steps: [{ tool, args }, …]` (max 100), synchroon en in
// volgorde uitgevoerd binnen het actieve document, als ÉÉN `runInMcpTransaction`. Bewust géén
// scripttaal (geen loops/expressies): dat zou een tweede, zwakkere sandbox zijn met onbeheersbare
// undo-/beveiligingssemantiek. Wie wil programmeren heeft het extensiesysteem.
//
// DE VIER DRAGENDE EIGENSCHAPPEN (spec §Compositie):
//  1. Eén undo-snapshot + één eindherberekening — de batch draait als één `runMutateTool(kind:'batch')`,
//     dus ook precies één AI-backup-trigger en één drift-/dialoog-check (nooit één per stap).
//  2. Gedeelde temp-id-namespace — de executor bezit de tempId→realId-map (`ctx.tempIdMap`): zodra een
//     stap een `created`-map teruggeeft (`add_tasks`), worden de args van látere stappen recursief
//     herschreven: elke string-waarde die exact een bekende tempId is, wordt het echte id.
//  3. Stap-fout ≠ item-weigering — een STRUCTURELE stapfout (onbekende tool, schema-ongeldige args,
//     geblokkeerde dialoog, kring, `cpmResult.error`) rolt de HELE batch terug en levert een rapport
//     per stap (uitgevoerd/gefaald/niet bereikt). PER-ITEM-weigeringen binnen een bulk-stap zijn ZACHT:
//     de stap telt als geslaagd en de weigeringen worden prominent bovenaan de respons verzameld.
//  4. De stappenloop is VOLLEDIG SYNCHROON (WP0-invariant b): geen enkele asynchrone grens tussen
//     stappen, zodat de user fysiek niet mid-batch van tabblad kan wisselen. `tests/mcp/cases-batch.ts`
//     dwingt dat statisch af op de broncode van `executeSteps`/`invokeStep`/`recomputeMidBatch`.
//
// STAP-DISPATCH — waarom niet gewoon `def.handler(...)`?
// De handler van een mutatietool is per definitie async: hij loopt via `runMutateTool`, dat de
// AI-backup asynchroon afhandelt en een EIGEN `runInMcpTransaction` opent (niet herintreedbaar). Een
// batch-stap moet dus een SYNCHRONE, transactie-vrije kern aanroepen. Die kern is `batchStep` op de
// tooldefinitie (zie `BatchStepTool`): dezelfde `() => MutationOutcome`-closure die de handler binnen
// zijn `runMutateTool` draait, maar dan los benoemd. Leestools hebben géén `batchStep` nodig — hun
// handler IS synchroon (de `readTool`-wikkel) en wordt direct aangeroepen.
// Een tool die batchable heet maar geen synchrone kern aanbiedt, wordt vóór enige mutatie geweigerd
// met een expliciete melding — nooit stil overgeslagen.
//
// SCHEMAPOORT PER STAP — waarom hier en niet in `checkExclusions`.
// Omdat de stappen NIET via `dispatcher.ts` lopen, zou de schemapoort die daar vóór `def.handler`
// hangt (audit-fix S) elke batch-stap missen: een agent kon élk `type`/`enum`/`required`/`minItems`/
// `additionalProperties` van alle 33 tools omzeilen door zijn call in een batch te wikkelen. Daarom
// draait `validateToolArgs` hier óók, met EXACT dezelfde diepte-instelling als de dispatcher
// (`deepArrayItems: ATOMIC_ITEM_TOOLS.has(def.name)`), zodat een stap zich precies gedraagt als
// dezelfde call los — één waarheid, geen tweede validator.
// De plek is bewust IN DE STAPPENLOOP, niet in de pre-transactionele `checkExclusions`:
//   1. De spec noemt "schema-ongeldige args" letterlijk een STRUCTURELE STAPFOUT (zie punt 3 boven),
//      met volledige rollback én een rapport per stap (uitgevoerd/gefaald/niet bereikt). Datzelfde
//      argument staat al bij `checkExclusions`: de onbekende tool wordt daar bewust NIET afgevangen,
//      juist zodat de loop hem tegenkomt en het rapport betekenis heeft. Een schemafout hoort in
//      precies dezelfde categorie thuis.
//   2. TEMP-ID'S. Vooraf keuren zou args keuren waarin de `tmp-…`-verwijzingen nog NIET vervangen
//      zijn. Dat levert valse afwijzingen zodra een schema meer eist dan "string" op een id-plek —
//      `planner_add_tasks.tasks[].tempId` draagt bijvoorbeeld `pattern: ^tmp[-_]`, en een hergebruikte
//      tempId wordt door `resolveTempIds` juist wél naar een echt id herschreven. Door ná
//      `resolveTempIds` te valideren keuren we exact de args die de stap daadwerkelijk uitvoert.
// Bewust de leaf-module `toolIndex` en NIET `toolRegistry`: die laatste importeert alle tool-modules
// (incl. deze) en zou een import-cyclus opleveren — zie de kop van toolIndex.ts.
import { getTool } from '../toolIndex';
import { ATOMIC_ITEM_TOOLS, validateToolArgs } from '../schemaValidate';
import { runMutateTool, toolError, McpStepError, type MutationOutcome } from './runtime';
import type {
  ActivityEntry, McpContext, McpToolDef, McpToolResult, McpErrorCode,
} from '../contracts';

/** Harde bovengrens op het aantal stappen (spec §Compositie). */
export const MAX_BATCH_STEPS = 100;

/** JSON-afkapgrens per substep-veld: het activiteitenpaneel toont samenvattingen, geen dumps. */
const MAX_JSON_CHARS = 4000;

/**
 * Tooldefinitie mét synchrone batch-kern. Additieve, OPTIONELE uitbreiding op `McpToolDef` — bewust
 * hier en niet in het bevroren `contracts.ts`: alleen de batch-executor kent dit veld, en de
 * mutatiemodules (andere banen) kunnen het bij SYNC-2 toevoegen zonder het gedeelde contract te raken.
 *
 * WIE KRIJGT ER ÉÉN: uitsluitend de tools uit spec §Tool-set *Muteren* die op een draft-primitief
 * draaien (taken, relaties, kalenders, assignments, leveling, project) — precies het oppervlak dat WP0
 * transactie-veilig heeft gemaakt. Leestools hebben er geen nodig (hun handler is al synchroon), en
 * alles wat géén draft-primitief heeft (document- en bestandstools, undo/redo, save_baseline) hoort
 * per spec sowieso niet in een batch en krijgt er dus expliciet géén.
 *
 * De kern draait BINNEN de batch-transactie en moet daarom:
 *   - synchroon zijn (geen asynchrone grens, geen I/O);
 *   - géén eigen `runInMcpTransaction`/`beginUndoable`/`runCPM` doen (de batch bezit die);
 *   - structurele fouten gooien (bij voorkeur als `McpStepError` met een precieze code) en
 *     per-item-weigeringen ZACHT teruggeven via `MutationOutcome.itemRejections`.
 */
export interface BatchStepTool extends McpToolDef {
  batchStep?: (args: unknown, ctx: McpContext) => MutationOutcome;
}

/** Eén ingezonden stap na vormvalidatie. */
interface ParsedStep {
  tool: string;
  args: unknown;
}

/** Uitkomststatus per stap in het rapport. */
type StepStatus = 'uitgevoerd' | 'gefaald' | 'niet bereikt';

/** Eén rapportregel; `data` draagt de respons van de stap (o.a. het resultaat van een slot-leesstap). */
export interface StepReport {
  step: number;
  tool: string;
  status: StepStatus;
  data?: unknown;
  error?: string;
}

interface Rejection {
  id: string;
  reason: string;
}

/**
 * Tools die NOOIT als batch-stap mogen draaien, ongeacht wat hun `batchable`-vlag zegt (spec
 * §Compositie "Uitgesloten"). `def.batchable === false` is de primaire poort; deze lijst is de
 * defense-in-depth voor het geval een toolmodule zijn vlag verkeerd zet — precies de tools waar dat
 * echt schade doet:
 *   - `planner_batch` zelf (geneste transactie, onbepaalde semantiek);
 *   - `undo`/`redo` (beheren hun eigen undo-stack; binnen één batch-snapshot betekenisloos);
 *   - de document-tools (een documentwissel mid-batch breekt de "één actief document"-aanname).
 *     `list_documents` staat er óók bij hoewel het alleen leest: de spec rekent het bij de
 *     document-tools, en zijn antwoord gaat over ANDERE documenten dan het document waarop de batch
 *     werkt — het beschrijft bovendien planningen die de batch niet herrekent, dus de cijfers zouden
 *     misleidend vers lijken. Als losse call is de tool volledig beschikbaar;
 *   - `export_ifc`/`import_schedule` (echte bestands-I/O ⇒ asynchroon, en niet terug te rollen);
 *   - `save_baseline` (een nulmeting hoort een losse, bewuste actie op een vers schema te zijn; bij
 *     een rollback zou de baseline mee-gewist worden).
 */
const BLOCKED_STEP_NAMES = new Set<string>([
  'planner_batch',
  'planner_undo',
  'planner_redo',
  'planner_new_document',
  'planner_switch_document',
  'planner_duplicate_document',
  'planner_list_documents',
  'planner_export_ifc',
  'planner_import_schedule',
  'planner_save_baseline',
]);

/** De levelingtool heeft — net als een leesstap — een VERSE planning nodig, anders kloppen de
 *  before/after-delta's niet (spec §level_resources-contract). */
const LEVEL_TOOL = 'planner_level_resources';

// ── Hulpjes ──────────────────────────────────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isThenable(v: unknown): v is Promise<unknown> {
  return typeof (v as { then?: unknown } | null)?.then === 'function';
}

/** Compacte JSON voor het activiteitenlog; onserialiseerbare of enorme payloads worden afgekapt. */
function compactJson(value: unknown): string {
  let s: string;
  try {
    s = JSON.stringify(value) ?? 'null';
  } catch {
    s = '"<niet serialiseerbaar>"';
  }
  return s.length > MAX_JSON_CHARS ? `${s.slice(0, MAX_JSON_CHARS)}…(afgekapt)` : s;
}

/** Classificeer een kale foutstring (spiegelt `mapTransactionError` in runtime.ts). */
function classify(message: string): McpErrorCode {
  return /circular dependency|kringverwijzing|\bkring\b|cyclus|\bcycle\b/i.test(message) ? 'CYCLE' : 'VALIDATION';
}

/**
 * GERESERVEERDE TEMP-ID-SYNTAX. Binnen een batch moet elke tempId met `tmp-` of `tmp_` beginnen.
 * Alleen strings die aan dit patroon voldoen ÉN als tempId geregistreerd zijn, worden in de args van
 * latere stappen vervangen. Zonder zo'n gereserveerd naamruimtetje is elke vrije tekst een potentieel
 * doelwit: een `add_tasks` met `tempId:'Fundering'` maakte van een latere `name:'Fundering'` stil het
 * interne taak-id (reviewbevinding I1, met probe bewezen). Een `created`-map met een tempId die niet
 * aan het patroon voldoet, laat de batch LUID falen — nooit stil half toepassen.
 */
const TEMP_ID_PATTERN = /^tmp[-_]/;

/**
 * Sleutels waaronder NOOIT herschreven wordt: vrije tekst van de gebruiker. De uitsluiting geldt voor
 * de hele subboom onder zo'n sleutel (`fields: { name: … }`, `tasks: [{ name: … }]`), want alles
 * daaronder is óók vrije tekst. Id's staan nooit onder deze sleutels — die heten `taskId`, `parentId`,
 * `predecessorId`, `resourceId`, … De deny-list is de tweede vangrail náást `TEMP_ID_PATTERN`: zelfs
 * een correct gevormde `tmp-`-string blijft in een naam of notitie ongemoeid.
 */
const NO_REWRITE_KEYS = new Set<string>([
  'name', 'names', 'description', 'descriptions', 'notes', 'note', 'title', 'label',
  'code', 'wbsCode', 'summary', 'text', 'author', 'company', 'reason', 'comment',
]);

/**
 * Vervang recursief elke string-waarde die (a) aan `TEMP_ID_PATTERN` voldoet, (b) als tempId
 * geregistreerd staat en (c) niet onder een vrije-tekst-sleutel hangt, door het echte id — in
 * objecten, arrays en willekeurig diep geneste combinaties daarvan. Bewust op WAARDEN, niet op
 * sleutels: id's staan in waarden (`parentId`, `predecessorId`, `taskId`, …).
 *
 * `deniedBranch` draagt de deny-list door naar de hele subboom: zodra we onder `name`/`notes`/… zitten,
 * blijft alles daaronder letterlijk staan.
 */
function resolveTempIds(value: unknown, map: Map<string, string>, deniedBranch = false): unknown {
  if (map.size === 0) return value;
  if (typeof value === 'string') {
    if (deniedBranch || !TEMP_ID_PATTERN.test(value)) return value;
    return map.get(value) ?? value;
  }
  if (Array.isArray(value)) return value.map((v) => resolveTempIds(v, map, deniedBranch));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveTempIds(v, map, deniedBranch || NO_REWRITE_KEYS.has(k));
    }
    return out;
  }
  return value;
}

/**
 * Neem de tempId→realId-map uit een stapresultaat over (`data.created`, het `add_tasks`-contract).
 * Een tempId die niet aan de gereserveerde syntax voldoet is een STRUCTURELE fout: hem stil negeren
 * zou latere stappen met niet-opgeloste verwijzingen laten draaien, hem stil accepteren zou vrije
 * tekst kunnen raken. Dus: luide `VALIDATION` ⇒ de hele batch rolt terug.
 */
function collectCreated(data: unknown, map: Map<string, string>, stepNr: number): void {
  const created = isPlainObject(data) ? data.created : undefined;
  if (!isPlainObject(created)) return;
  for (const [tempId, realId] of Object.entries(created)) {
    if (typeof realId !== 'string') continue;
    if (!TEMP_ID_PATTERN.test(tempId)) {
      throw new McpStepError(
        'VALIDATION',
        `stap ${stepNr}: tempId '${tempId}' voldoet niet aan de gereserveerde batch-syntax — ` +
        'binnen planner_batch moet elke tempId met `tmp-` of `tmp_` beginnen (bijv. `tmp-fundering`), ' +
        'zodat de automatische vervanging nooit gewone tekst kan raken',
      );
    }
    map.set(tempId, realId);
  }
}

/** Rapport als één regel LEESBARE tekst voor in `error`; de gestructureerde vorm (steps + substeps)
 *  reist op het faalpad mee in het additieve `data`-veld van de McpToolErr. */
function formatReport(report: StepReport[]): string {
  const rows = report.map((r) => {
    if (r.status === 'uitgevoerd') return `${r.step}. ${r.tool} — uitgevoerd (teruggedraaid)`;
    if (r.status === 'gefaald') return `${r.step}. ${r.tool} — gefaald: ${r.error ?? 'onbekende reden'}`;
    return `${r.step}. ${r.tool} — niet bereikt`;
  });
  return `Rapport per stap (alles teruggedraaid): ${rows.join('; ')}.`;
}

// ── Tussentijdse herberekening ───────────────────────────────────────────────────────────────────

/**
 * Herbereken MIDDEN in de batch — synchroon, exact de drie stappen die de transactie ook aan het eind
 * doet. Nodig vóór een leesstap of een `level_resources`-stap die op mutaties volgt: die zouden anders
 * verouderde datums lezen. `runCPM` pusht per invariant (WP0-a) geen undo-snapshot, dus dit kost géén
 * extra undo-stap — met één uitzondering (issue #63): staat het document in "datums zoals opgeslagen",
 * dan verlaat `runCPM` die modus en pusht daarvoor wél één snapshot. Binnen een batch is dat onzichtbaar,
 * want `beginUndoable` zwijgt zolang de transactie loopt en die nam haar ene snapshot al vóór de eerste
 * stap — mét de modus aan, dus één undo draait de hele batch inclusief het modusverlies terug.
 * Eindigt de herberekening in `cpmResult.error` (kringverwijzing), dan is dat
 * een structurele stapfout: gooien, zodat de hele batch schoon terugrolt.
 */
export function recomputeMidBatch(ctx: McpContext): void {
  ctx.app.store.getState().runCPM();
  ctx.app.store.getState().recomputeViewRows();
  ctx.app.store.getState().recomputeResourceLoad();
  const err = ctx.app.store.getState().cpmResult?.error;
  if (err) throw new McpStepError(classify(err), `tussentijdse herberekening faalde: ${err}`);
}

// ── Stap-dispatch ────────────────────────────────────────────────────────────────────────────────

/**
 * Voer één stap SYNCHROON uit en geef zijn uitkomst terug.
 *   - Muterende tools: via de synchrone `batchStep`-kern (transactie-vrij; de batch bezit de transactie).
 *   - Leestools: via de handler, die bij een leestool synchroon is (`readTool`-wikkel). Levert die tóch
 *     een thenable, dan is dat een ontwikkelfout — weigeren i.p.v. een halve stap laten lopen (de
 *     belofte wordt afgevangen zodat er geen losse afwijzing ontsnapt).
 * Een NIET-ok resultaat van een leestool is een structurele stapfout (onbekend id, ongeldige args) en
 * gooit met de code die de tool zelf koos.
 */
export function invokeStep(def: BatchStepTool, args: unknown, ctx: McpContext): MutationOutcome {
  if (def.batchStep) return def.batchStep(args, ctx);

  const res = def.handler(args, ctx) as McpToolResult | Promise<McpToolResult>;
  if (isThenable(res)) {
    res.then(() => undefined, () => undefined);
    throw new McpStepError('INTERNAL', `tool '${def.name}' leverde een asynchroon resultaat; batch-stappen moeten synchroon zijn`);
  }
  if (!res.ok) throw new McpStepError(res.code, res.error);
  return { data: res.data, ...(res.itemRejections ? { itemRejections: res.itemRejections } : {}) };
}

// ── De stappenloop ───────────────────────────────────────────────────────────────────────────────

/**
 * De stappenloop — draait BINNEN `runInMcpTransaction` en is daarom volledig synchroon (WP0-invariant
 * b; statisch afgedwongen door cases-batch.ts). Vult `report`, `substeps` en `rejections` in-place, zodat
 * die ook ná een rollback nog beschikbaar zijn voor de foutrapportage.
 *
 * Per stap: tool opzoeken (onbekend ⇒ structurele stapfout, spec) → args herschrijven met de
 * temp-id-map → zo nodig tussentijds herberekenen (leesstap of levelingstap ná mutaties) → uitvoeren →
 * `created`-map overnemen → zachte weigeringen verzamelen (met stapherkomst) → activiteitsregel loggen.
 */
export function executeSteps(
  steps: ParsedStep[],
  ctx: McpContext,
  report: StepReport[],
  substeps: ActivityEntry[],
  rejections: Rejection[],
): MutationOutcome {
  let mutatedSinceRecompute = false;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const startedAt = Date.now();
    const def = getTool(step.tool) as BatchStepTool | undefined;

    if (!def) {
      const message = `stap ${i + 1}: onbekende tool '${step.tool}'`;
      report[i].status = 'gefaald';
      report[i].error = message;
      substeps.push({
        ts: startedAt, tool: step.tool, summary: `stap ${i + 1}/${steps.length} — ${step.tool}`,
        durationMs: Date.now() - startedAt, ok: false, error: message,
        argsJson: compactJson(step.args), resultJson: 'null',
      });
      throw new McpStepError('VALIDATION', message);
    }

    const args = resolveTempIds(step.args, ctx.tempIdMap);

    try {
      // SCHEMAPOORT — dezelfde die `dispatcher.ts` vóór `def.handler` hangt, met dezelfde
      // diepte-instelling (zie de kop van dit bestand). Ná `resolveTempIds`, zodat we exact de args
      // keuren die de stap uitvoert. Vóór de tussentijdse herberekening: een stap die tóch niet mag
      // draaien, hoeft geen verse planning. De boodschap noemt het STAPNUMMER (welke regel van het
      // draaiboek) én het PAD binnen de args (welk veld daarin) — de agent moet beide weten.
      const schemaError = validateToolArgs(def.inputSchema, args, {
        deepArrayItems: ATOMIC_ITEM_TOOLS.has(def.name),
      });
      if (schemaError) {
        throw new McpStepError(
          'VALIDATION',
          `stap ${i + 1}: ongeldige argumenten voor ${def.name} — ${schemaError}`,
        );
      }

      // Verse planning vóór een lezing of een levelingstap die op mutaties volgt (spec §Compositie).
      if (mutatedSinceRecompute && (def.kind === 'read' || def.name === LEVEL_TOOL)) {
        recomputeMidBatch(ctx);
        mutatedSinceRecompute = false;
      }

      const outcome = invokeStep(def, args, ctx);
      if (def.kind !== 'read') mutatedSinceRecompute = true;

      collectCreated(outcome.data, ctx.tempIdMap, i + 1);
      for (const r of outcome.itemRejections ?? []) {
        rejections.push({ id: r.id, reason: `stap ${i + 1} (${def.name}): ${r.reason}` });
      }

      // Twee lezers, twee vormen (bewuste, beperkte duplicatie): `steps[].data` is de VOLLEDIGE
      // respons van de stap — daar leest de AI de `created`-map en het resultaat van een slot-leesstap
      // uit. `substeps[]` is de activiteitenlog-vorm (ActivityEntry) voor het AI-paneel, met afgekapte
      // JSON zodat een grote bulk-stap het paneel niet dichtslibt.
      report[i].status = 'uitgevoerd';
      report[i].data = outcome.data;
      substeps.push({
        ts: startedAt, tool: def.name, summary: `stap ${i + 1}/${steps.length} — ${def.name}`,
        durationMs: Date.now() - startedAt, ok: true,
        argsJson: compactJson(args), resultJson: compactJson(outcome.data),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      report[i].status = 'gefaald';
      report[i].error = message;
      substeps.push({
        ts: startedAt, tool: def.name, summary: `stap ${i + 1}/${steps.length} — ${def.name}`,
        durationMs: Date.now() - startedAt, ok: false, error: message,
        argsJson: compactJson(args), resultJson: 'null',
      });
      throw e; // door laten gaan: de transactie rolt de hele batch schoon terug
    }
  }

  return {
    // `rejections` staat bewust VOORAAN in het object: de spec eist dat deel-weigeringen prominent
    // bovenaan de batch-respons komen — nooit stil onderin.
    data: { rejections, stepCount: steps.length, steps: report, substeps },
    ...(rejections.length > 0 ? { itemRejections: rejections } : {}),
  };
}

// ── Vormvalidatie + uitsluitingen (vóór enige mutatie) ───────────────────────────────────────────

/** Valideer de args-vorm. Retourneert de stappen, of een foutboodschap (string). */
function parseSteps(args: unknown): ParsedStep[] | string {
  const raw = isPlainObject(args) ? args.steps : undefined;
  if (!Array.isArray(raw)) return 'planner_batch vereist een `steps`-array met minstens één stap';
  if (raw.length === 0) return 'planner_batch vereist een niet-lege `steps`-array';
  if (raw.length > MAX_BATCH_STEPS) {
    return `planner_batch accepteert maximaal ${MAX_BATCH_STEPS} stappen, kreeg er ${raw.length}`;
  }
  const steps: ParsedStep[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s: unknown = raw[i];
    if (!isPlainObject(s) || typeof s.tool !== 'string' || s.tool === '') {
      return `stap ${i + 1}: elke stap vereist een string-veld \`tool\``;
    }
    if (s.args !== undefined && !isPlainObject(s.args)) {
      return `stap ${i + 1}: \`args\` moet een object zijn (of weggelaten worden)`;
    }
    steps.push({ tool: s.tool, args: s.args });
  }
  return steps;
}

/**
 * Beleidspoort vóór de transactie: welke BEKENDE tools mogen nooit een batch-stap zijn (spec
 * §Compositie "Uitgesloten"), en welke missen een synchrone batch-kern. Een ONBEKENDE tool wordt hier
 * bewust NIET afgevangen: de spec rekent die tot de structurele STAP-fouten (volledige rollback +
 * rapport uitgevoerd/gefaald/niet bereikt), en dat rapport heeft alleen betekenis als de loop hem
 * tegenkomt. Retourneert een foutboodschap, of null wanneer het draaiboek uitvoerbaar is.
 */
function checkExclusions(steps: ParsedStep[]): string | null {
  for (let i = 0; i < steps.length; i++) {
    const def = getTool(steps[i].tool) as BatchStepTool | undefined;
    if (!def) continue; // onbekende tool ⇒ stap-niveau-fout in de loop (zie doc hierboven)
    const at = `stap ${i + 1}: '${def.name}'`;
    if (BLOCKED_STEP_NAMES.has(def.name)) {
      return `${at} is uitgesloten van planner_batch (batch/undo/redo, document- en bestandstools, save_baseline) — roep die tool los aan`;
    }
    if (def.kind === 'document' || def.kind === 'batch') {
      return `${at} is een ${def.kind}-tool en is uitgesloten van planner_batch — roep die tool los aan`;
    }
    if (def.batchable === false) {
      return `${at} is niet batchable en is uitgesloten van planner_batch — roep die tool los aan`;
    }
    if (!def.batchStep && def.kind !== 'read') {
      return `${at} biedt geen synchrone batch-kern (batchStep) en kan daarom niet als batch-stap draaien — roep die tool los aan`;
    }
  }
  return null;
}

// ── De tooldefinitie ─────────────────────────────────────────────────────────────────────────────

const batch: McpToolDef = {
  name: 'planner_batch',
  description:
    'Voer een DRAAIBOEK van maximaal 100 tool-stappen uit als ÉÉN atomaire wijziging: één undo-stap ' +
    'voor de gebruiker, één herberekening, één backup. De stappen draaien synchroon en in volgorde in ' +
    'het actieve document. Faalt één stap structureel (onbekende tool, ongeldige args, kringverwijzing, ' +
    'open dialoog), dan wordt de HELE batch teruggedraaid en meldt de fout per stap wat is uitgevoerd, ' +
    'gefaald of niet bereikt. Per-item-weigeringen binnen een bulk-stap (bijv. één ongeldige ' +
    'voortgangsregel van twintig) zijn zacht: die stap slaagt en de weigeringen staan bovenaan in het ' +
    'antwoord onder `rejections`. TEMP-ID\'s: binnen een batch MOET elke tempId met "tmp-" of "tmp_" ' +
    'beginnen (bijv. "tmp-fundering") — een andere vorm laat de batch falen. Een `add_tasks`-stap ' +
    'levert een tempId→id-map; elke string-waarde in LATERE stappen die exact zo\'n geregistreerde ' +
    'tempId is, wordt automatisch vervangen door het echte id (ook diep genest). Vrije tekst blijft ' +
    'altijd ongemoeid: onder `name`, `description`, `notes`, `title`, `code`, `wbsCode` en dergelijke ' +
    'wordt nooit vervangen. De map geldt alleen BINNEN deze batch; een volgende batch begint leeg. ' +
    'LEESSTAPPEN: alleen een SLOT-leesstap is zinvol, want alle args liggen vast op het moment van ' +
    'inzenden; een vroege lezing kan latere stappen niet voeden. Zoek namen→ID\'s dus met losse ' +
    'lees-calls VÓÓR de batch. UITGESLOTEN: planner_batch zelf, undo/redo, de document- en ' +
    'bestandstools (import/export) en save_baseline — roep die los aan. Dit is geen scripttaal: geen ' +
    'variabelen, condities of loops.',
  kind: 'batch',
  batchable: false,
  annotations: {
    readOnlyHint: false,
    // Een draaiboek mag verwijderende stappen bevatten ⇒ eerlijk als destructief annoteren, zodat een
    // client die daarop bevestiging vraagt dat ook echt doet.
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  inputSchema: {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_BATCH_STEPS,
        description: 'De stappen, in uitvoervolgorde. Maximaal 100.',
        items: {
          type: 'object',
          required: ['tool'],
          properties: {
            tool: { type: 'string', description: 'Naam van de tool, inclusief `planner_`-prefix.' },
            args: { type: 'object', description: 'De args van die tool; weglaten voor tools zonder args.' },
          },
        },
      },
    },
    required: ['steps'],
  },
  async handler(args, ctx) {
    const parsed = parseSteps(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);

    const excluded = checkExclusions(parsed);
    if (excluded) return toolError(ctx, 'VALIDATION', excluded);

    // Rapport vooraf op "niet bereikt": elke stap die de loop niet haalt, blijft zo staan.
    const report: StepReport[] = parsed.map((s, i) => ({ step: i + 1, tool: s.tool, status: 'niet bereikt' as StepStatus }));
    const substeps: ActivityEntry[] = [];
    const rejections: Rejection[] = [];

    // LEVENSDUUR VAN DE TEMP-ID-MAP: strikt per batch. `ctx` leeft per server-sessie, dus zonder deze
    // schoonmaak zouden tempId's uit een eerdere batch de args van een látere batch herschrijven —
    // actie-op-afstand die niemand kan zien (reviewbevinding I1c). Leegmaken vóór ÉN na de uitvoering:
    // vooraf zodat we gegarandeerd leeg starten, achteraf zodat er niets blijft hangen voor de
    // volgende call — ook niet na een rollback.
    ctx.tempIdMap.clear();

    // Eén muterende aanroep: één backup-trigger, één drift-/dialoog-check, één transactie.
    const res = await runMutateTool(ctx, 'batch', () => executeSteps(parsed, ctx, report, substeps, rejections));
    ctx.tempIdMap.clear();

    // Guard-weigeringen (pauze/alleen-lezen/dialoog/drift/backup) raken de loop niet — dan is er niets
    // uit te leggen. Kwam de loop wél op gang, dan reist het rapport twee keer mee: leesbaar in
    // `error` (voor de AI/gebruiker) en gestructureerd in het additieve `data`-veld van de McpToolErr —
    // zonder dat laatste zou het activiteitenpaneel juist bij een MISLUKTE batch zijn sub-stappen
    // kwijt zijn (reviewbevinding I2).
    if (!res.ok && report.some((r) => r.status !== 'niet bereikt')) {
      return { ...res, error: `${res.error}\n${formatReport(report)}`, data: { steps: report, substeps } };
    }
    return res;
  },
};

/** Module-export voor de registry (spec §componenten: elke tool-module levert zijn eigen array). */
export const batchTools: McpToolDef[] = [batch];
