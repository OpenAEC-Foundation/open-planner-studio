// MCP-toolmodule — het WIJZIGEN van bestaande relaties (`planner_update_dependencies`).
//
// HET GAT DAT DIT DICHT. De bridge kende alleen `planner_add_dependencies` en
// `planner_remove_dependencies`. Een FS naar SS omzetten, of alleen de lag bijstellen, moest dus via
// verwijderen-en-opnieuw-toevoegen — nergens gedocumenteerd als route, en met twee nadelen die een
// agent niet kan zien: het sequence-id verandert (elke verwijzing die hij net uit
// `get_project_overview` haalde is dood) en het kost twee undo-stappen. Sinds de overview de
// sequence-id's in de relatienotatie meegeeft (`"→2.3 FS+2d #seq-7"`) bestaat het gereedschap om een
// relatie AAN TE WIJZEN; deze module levert het gereedschap om hem te VERANDEREN.
//
// WAAROM EEN EIGEN MODULE en niet in `taskTools.ts`. Dat bestand is met ~1000 regels al de grootste
// toolmodule van de bridge en draagt vier verschillende onderwerpen (taken, relaties, historie,
// herberekening). De relatie-tools erbij houden zou de enige winst zijn — maar die winst is er niet:
// de daadwerkelijk gedeelde kennis (type-aliassen, lag-notatie, schema-fragmenten) zit sinds deze
// wijziging in de leaf-module `sequenceFields.ts`, die `taskTools`, `readTools` én deze module
// gebruiken. Er is dus GEEN tweede parser; wel een tweede, kleiner bestand met één onderwerp.
// `add_/remove_dependencies` blijven bewust staan waar ze stonden: verhuizen zou een grote,
// betekenisloze diff opleveren midden in parallel werk.
//
// CONVENTIES (identiek aan de andere bulk-mutatietools):
//   * driedeling `parseX` / `xCore` / `handler`, zodat de tool los én als `planner_batch`-stap werkt;
//   * per-item-weigeringen zijn ZACHT (`itemRejections`) — één rotte regel rolt de bulk nooit terug;
//   * een KRINGVERWIJZING is HARD (`McpStepError('CYCLE')`) met volledige rollback;
//   * NOOIT `ok` zonder effect: een item dat de relatie niet daadwerkelijk verandert wordt geweigerd
//     met de reden dat de waarden al zo staan.
import type { McpContext, McpToolOk } from '../contracts';
import type { BatchStepTool } from './batchTool';
import { guardNonTransactional, McpStepError, runMutateTool, toolError, type MutationOutcome } from './runtime';
import { enrichOk, freshDates, okDirect, projectEndInfo } from './helpers';
import type { AppState } from '@/state/appStore';
import { validate } from '@/state/mcpValidation';
import { isAncestorRelation } from '@/state/relationRules';
import {
  ANCESTOR_RELATION_REJECTION,
  LAG_DOC,
  LAG_SCHEMA,
  lagPatchOf,
  lagReport,
  normalizeSeqType,
  parseLag,
  seqAbbrev,
  SEQ_TYPE_SCHEMA,
  unknownTypeReason,
} from './sequenceFields';
import type { Sequence, SequenceType } from '@/types/sequence';

const STD_ANNOT = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

/** De ENIGE sleutels die een update-item mag dragen. Alles daarbuiten wordt bij naam geweigerd. */
const ITEM_KEYS = ['seqId', 'type', 'lag', 'predecessorId', 'successorId'];

/**
 * Gerichte hints bij sleutels die een agent redelijkerwijs probeert. Twee categorieën:
 *   - synoniemen die wél kunnen (`lagDays`/`lagPercent`/`id`) ⇒ wijs de goede sleutel aan;
 *   - modelvelden die BEWUST NIET zetbaar zijn (`lagUnit`, `lagMinutes`) ⇒ zeg dat, en waarom. Die
 *     twee bestaan in `Sequence` en overleven de IFC-round-trip, maar de LEESKANT toont ze niet
 *     (`lagLabel` rendert alleen dagen en procent). Ze schrijfbaar maken zou een agent iets laten
 *     zetten dat hij daarna nergens kan teruglezen of verifiëren — de spiegel van precies de
 *     asymmetrie die deze ronde opruimt. Zodra de leeskant ze toont, horen ze hier zetbaar te worden.
 */
const FIELD_HINTS: Record<string, string> = {
  id: 'gebruik `seqId` — het sequence-id dat get_project_overview/get_task achter de `#` teruggeven',
  lagDays: 'gebruik `lag` (getal 2/-1 of string "+2d")',
  lagPercent: 'gebruik `lag: "+50%"` — procent-lag loopt via hetzelfde `lag`-veld',
  lagUnit:
    'de lag-EENHEID (WORKTIME/ELAPSEDTIME) is via de bridge bewust niet zetbaar: de leestools tonen ' +
    'hem niet, dus je zou het resultaat niet kunnen teruglezen',
  lagMinutes:
    'een minuut-precieze lag (uit een IFC-/P6-import) is via de bridge bewust niet zetbaar: de ' +
    'leestools tonen hem niet. Geef de lag in hele werkdagen via `lag` — dat WIST de minuut-lag, ' +
    'zodat de opgegeven waarde ook echt de werkzame is',
  fields: 'de velden staan hier direct op het item (geen `fields`-blok): { seqId, type, lag, … }',
};

/** De velden van één relatie zoals deze tool ze projecteert (id en `lagUnit` blijven ongemoeid). */
interface SeqFields {
  predecessorId: string;
  successorId: string;
  type: SequenceType;
  lagDays: number;
  lagPercent?: number;
  lagMinutes?: number;
}

/** Eén geaccepteerde wijziging: de doelstaat plus het VOOR/NA-verschil dat we rapporteren. */
interface DepCandidate {
  seqId: string;
  next: SeqFields;
  changes: Record<string, unknown>;
}

function fieldsOf(seq: Sequence): SeqFields {
  return {
    predecessorId: seq.predecessorId,
    successorId: seq.successorId,
    type: seq.type,
    lagDays: Number.isFinite(seq.lagDays) ? seq.lagDays : 0,
    ...(seq.lagPercent !== undefined ? { lagPercent: seq.lagPercent } : {}),
    ...(seq.lagMinutes !== undefined ? { lagMinutes: seq.lagMinutes } : {}),
  };
}

/** Dedup-sleutel: één relatie per (voorganger, opvolger, type) — dezelfde regel als `addSequence`. */
function tripleKey(f: SeqFields): string {
  return `${f.predecessorId}|${f.successorId}|${f.type}`;
}

/**
 * Statische classificatie van een relatie-update-batch: vormvalidatie per item, bestaan, dedup en de
 * NO-OP-check. Gedeeld door het lege-batch-snelpad (handler) en de kern — precies zoals `classifyDeps`
 * dat voor `add_dependencies` doet. De KRING-check zit hier bewust NIET in: die draait één keer over
 * de volledige projectie in de kern, als HARDE stap-fout.
 *
 * `projected` bevat na afloop ALLE relaties met de geaccepteerde wijzigingen toegepast. Daarmee zijn
 * twee items uit dezelfde call niet in staat om samen een duplicaat (of straks een kring) te maken
 * zonder dat we het zien.
 */
function classifyDepUpdates(
  st: AppState,
  updates: unknown[],
): {
  candidates: DepCandidate[];
  rejections: { id: string; reason: string }[];
  projected: Map<string, SeqFields>;
} {
  const rejections: { id: string; reason: string }[] = [];
  const candidates: DepCandidate[] = [];
  const byId = new Map(st.sequences.map((s) => [s.id, s]));
  const projected = new Map(st.sequences.map((s) => [s.id, fieldsOf(s)]));
  // Eén Map voor zowel het bestaan-check als de verzameltaak-lookup hieronder — vervangt de losse
  // `taskIds`-Set van vóór de verzameltaak-check, die dezelfde informatie droeg zonder de taakobjecten.
  const byTaskId = new Map(st.tasks.map((t) => [t.id, t]));
  const lookupTask = (tid: string) => byTaskId.get(tid);
  const seenSeqIds = new Set<string>();

  for (const raw of updates) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      rejections.push({ id: '(geen object)', reason: 'elk item moet een object met een `seqId` zijn' });
      continue;
    }
    const it = raw as Record<string, unknown>;
    const seqId = it.seqId;
    if (typeof seqId !== 'string' || seqId === '') {
      rejections.push({
        id: '(zonder seqId)',
        reason: 'elk item vereist een string-`seqId` (het sequence-id uit get_project_overview / get_task)',
      });
      continue;
    }

    // Onbekende sleutels: bij NAAM geweigerd, mét het alternatief. De schemapoort komt hier niet —
    // de binnenkant van array-items is per DIEPTE-REGEL aan de tool, juist omdat één rot item hier
    // een zachte weigering hoort te zijn en niet de hele bulk mag omgooien.
    const unknownKeys = Object.keys(it).filter((k) => !ITEM_KEYS.includes(k));
    if (unknownKeys.length > 0) {
      const k = unknownKeys[0];
      const hint = FIELD_HINTS[k];
      rejections.push({
        id: seqId,
        reason:
          `onbekend veld \`${k}\`${unknownKeys.length > 1 ? ` (en ${unknownKeys.slice(1).map((x) => `\`${x}\``).join(', ')})` : ''}` +
          `${hint ? `; ${hint}` : ''}. Toegestaan: ${ITEM_KEYS.join(', ')}`,
      });
      continue;
    }

    if (seenSeqIds.has(seqId)) {
      rejections.push({
        id: seqId,
        reason: `seqId '${seqId}' komt meerdere keren voor in deze call; voeg de wijzigingen samen in één item`,
      });
      continue;
    }
    seenSeqIds.add(seqId);

    const seq = byId.get(seqId);
    if (!seq) {
      rejections.push({ id: seqId, reason: `relatie '${seqId}' bestaat niet` });
      continue;
    }
    const cur = fieldsOf(seq);

    const touched = ITEM_KEYS.filter((k) => k !== 'seqId' && it[k] !== undefined);
    if (touched.length === 0) {
      rejections.push({
        id: seqId,
        reason: 'geen wijziging opgegeven; geef minstens één van `type`, `lag`, `predecessorId`, `successorId`',
      });
      continue;
    }

    // --- type -----------------------------------------------------------------------------------
    let nextType = cur.type;
    if (it.type !== undefined) {
      const t = normalizeSeqType(it.type);
      if (!t) { rejections.push({ id: seqId, reason: unknownTypeReason(it.type) }); continue; }
      nextType = t;
    }

    // --- endpoints ------------------------------------------------------------------------------
    let bad: string | null = null;
    let nextPred = cur.predecessorId;
    let nextSucc = cur.successorId;
    for (const [key, set] of [
      ['predecessorId', (v: string) => { nextPred = v; }],
      ['successorId', (v: string) => { nextSucc = v; }],
    ] as [string, (v: string) => void][]) {
      const v = it[key];
      if (v === undefined) continue;
      if (typeof v !== 'string') { bad = `\`${key}\` moet een taak-id (string) zijn, kreeg ${typeof v}`; break; }
      if (!byTaskId.has(v)) { bad = `taak '${v}' (\`${key}\`) bestaat niet`; break; }
      set(v);
    }
    if (bad) { rejections.push({ id: seqId, reason: bad }); continue; }
    if (nextPred === nextSucc) {
      rejections.push({ id: seqId, reason: `een relatie kan taak '${nextPred}' niet met zichzelf verbinden` });
      continue;
    }
    // Voorouder-relatie als NIEUW eindpunt-paar (eigenaarsbesluit 2026-08-15): verhangen náár een
    // relatie tussen een taak en zijn EIGEN (voor)ouder-samenvatting zou `expandSummaryRelations`
    // een directe cyclus laten genereren. Een gewoon verzameltaak-eindpunt is verder GEEN
    // weigergrond meer — dat rekent gewoon mee. Dit pad schrijft de eindpunten rechtstreeks op de
    // draft (zie de mutatie verderop), dus dit is de ENIGE plek waar dit tegengehouden kan worden —
    // anders dan bij het aanmaken (classifyDeps → addSequence) zit er hier geen tweede laag onder.
    //
    // Bewust ALLEEN op eindpunten die daadwerkelijk WIJZIGEN: een bestaande relatie kan al een
    // voorouder-eindpunt hebben (uit een import — de solver-guard in `expandSummaryRelations` droppt
    // 'm dan zelf, geen crash) en moet dan nog op type/lag te wijzigen zijn. Verhangen wég van een
    // voorouder-relatie (het herstelpad) blijft dus ook toegestaan.
    const predIsNew = nextPred !== cur.predecessorId;
    const succIsNew = nextSucc !== cur.successorId;
    if (
      (predIsNew || succIsNew)
      && isAncestorRelation(lookupTask, { predecessorId: nextPred, successorId: nextSucc })
    ) {
      rejections.push({ id: seqId, reason: ANCESTOR_RELATION_REJECTION });
      continue;
    }

    // --- lag ------------------------------------------------------------------------------------
    // Een opgegeven lag zet ALTIJD de volledige lag-representatie (dagen ⇄ procent, en de uit IFC
    // ingelezen minuut-lag gaat weg): de solver leest `lagPercent` → `lagMinutes` → `lagDays`, dus
    // een achterblijvend veld zou de nieuwe waarde stil overrulen. Zie `lagPatchOf`.
    let nextLag: Pick<SeqFields, 'lagDays' | 'lagPercent' | 'lagMinutes'> = {
      lagDays: cur.lagDays,
      ...(cur.lagPercent !== undefined ? { lagPercent: cur.lagPercent } : {}),
      ...(cur.lagMinutes !== undefined ? { lagMinutes: cur.lagMinutes } : {}),
    };
    if (it.lag !== undefined) {
      const parsed = parseLag(it.lag);
      if (!parsed.ok) { rejections.push({ id: seqId, reason: parsed.reason }); continue; }
      const p = lagPatchOf(parsed.value);
      // HIER wordt een bestaande `lagMinutes` gewist: hij wordt bewust NIET uit `cur` meegenomen.
      // Zie de waarschuwing bij `lagPatchOf` — dit is de plek die die waarschuwing opvolgt.
      nextLag = {
        lagDays: p.lagDays,
        ...(p.lagPercent !== undefined ? { lagPercent: p.lagPercent } : {}),
      };
    }

    const next: SeqFields = { predecessorId: nextPred, successorId: nextSucc, type: nextType, ...nextLag };

    // --- niets veranderd? -----------------------------------------------------------------------
    const changes: Record<string, unknown> = {};
    if (next.predecessorId !== cur.predecessorId) {
      changes.predecessorId = { from: cur.predecessorId, to: next.predecessorId };
    }
    if (next.successorId !== cur.successorId) {
      changes.successorId = { from: cur.successorId, to: next.successorId };
    }
    if (next.type !== cur.type) changes.type = { from: seqAbbrev(cur.type), to: seqAbbrev(next.type) };
    const clearedMinutes =
      cur.lagMinutes !== undefined && cur.lagMinutes !== 0 && next.lagMinutes === undefined;
    if (next.lagDays !== cur.lagDays || next.lagPercent !== cur.lagPercent || clearedMinutes) {
      changes.lag = {
        from: lagReport(cur),
        to: lagReport(next),
        // Expliciet gemeld: het label alleen zou "0 → 0" tonen terwijl de werkzame lag verdwijnt.
        ...(clearedMinutes ? { clearedLagMinutes: cur.lagMinutes } : {}),
      };
    }
    if (Object.keys(changes).length === 0) {
      rejections.push({
        id: seqId,
        reason: `relatie '${seqId}' staat al op ${seqAbbrev(cur.type)}${lagReport(cur) === '0' ? '' : lagReport(cur)} (${cur.predecessorId} → ${cur.successorId}); er valt niets te wijzigen`,
      });
      continue;
    }

    // --- duplicaat ------------------------------------------------------------------------------
    // Eén relatie per (voorganger, opvolger, type) — dezelfde regel die `addSequence` hanteert. Een
    // TYPE-wijziging (of een verlegd eindpunt) kan een bestaande relatie dubbelen; dat mag niet stil
    // gebeuren, want de store-`updateSequence` negeert zo'n botsing zonder een woord te zeggen.
    const key = tripleKey(next);
    let clash: string | null = null;
    for (const [otherId, f] of projected) {
      if (otherId !== seqId && tripleKey(f) === key) { clash = otherId; break; }
    }
    if (clash) {
      rejections.push({
        id: seqId,
        reason:
          `dat zou een duplicaat van relatie '${clash}' opleveren (zelfde voorganger, opvolger én ` +
          `type ${seqAbbrev(next.type)}); pas die aan of verwijder hem eerst`,
      });
      continue;
    }

    projected.set(seqId, next);
    candidates.push({ seqId, next, changes });
  }

  return { candidates, rejections, projected };
}

/** Vormvalidatie van `update_dependencies`; string = foutboodschap (harde VALIDATION). */
function parseUpdateDeps(args: unknown): unknown[] | string {
  const a = (args ?? {}) as { updates?: unknown };
  if (!Array.isArray(a.updates) || a.updates.length === 0) {
    return 'update_dependencies vereist een niet-lege `updates`-array';
  }
  return a.updates;
}

/**
 * Synchrone, transactie-vrije kern van `update_dependencies`.
 *
 * Er is bewust GEEN draft-primitief voor: net als bij `remove_dependencies` muteren we via één
 * draft-stijl `setState` binnen de transactie (snapshot-/recompute-vrij — de suppressievlag en de
 * eind-runCPM van `runInMcpTransaction` dekken dat). De store-actie `updateSequence` is hier
 * ONBRUIKBAAR: die pusht zijn eigen undo-snapshot én negeert een duplicaat-botsing STIL (`return`
 * zonder melding) — precies wat dit oppervlak niet mag doen.
 */
function updateDependenciesCore(ctx: McpContext, updates: unknown[]): MutationOutcome {
  const st = ctx.app.store.getState();
  const { candidates, rejections, projected } = classifyDepUpdates(st, updates);

  // KRING: over de VOLLEDIGE projectie (alle relaties mét de geaccepteerde wijzigingen), via exact
  // hetzelfde pad als `add_dependencies` — `validate.noCycle` leest alleen `sequences`, dus voeren we
  // de projectie als "voorgestelde" kanten aan en houden we de bestaande verzameling leeg.
  //
  // NB: een TYPE- of LAG-wijziging alleen kan nooit een kring maken (de kanten-graaf kent alleen
  // voorganger→opvolger, en die blijven dan gelijk). Verleg je een EINDPUNT, dan kan het wel — en
  // daarom staat de check hier onvoorwaardelijk: hij is goedkoop en dekt beide gevallen.
  const cyc = validate.noCycle(
    { tasks: st.tasks, assignments: st.assignments, sequences: [] },
    [...projected.values()].map((f) => ({ predecessorId: f.predecessorId, successorId: f.successorId })),
  );
  if (cyc) throw new McpStepError('CYCLE', `kringverwijzing gedetecteerd: ${cyc.join(' → ')}`);

  if (candidates.length > 0) {
    ctx.app.store.setState((s) => {
      for (const c of candidates) {
        const seq = s.sequences.find((x) => x.id === c.seqId);
        if (!seq) continue;
        seq.predecessorId = c.next.predecessorId;
        seq.successorId = c.next.successorId;
        seq.type = c.next.type;
        seq.lagDays = c.next.lagDays;
        // `delete` i.p.v. `= undefined`: zo blijft de relatie byte-identiek aan een die deze velden
        // nooit had (en aan wat de IFC-reader teruggeeft).
        if (c.next.lagPercent === undefined) delete seq.lagPercent;
        else seq.lagPercent = c.next.lagPercent;
        if (c.next.lagMinutes === undefined) delete seq.lagMinutes;
        else seq.lagMinutes = c.next.lagMinutes;
      }
      s.isDirty = true;
    });
  }

  return {
    data: { updated: candidates.map((c) => ({ id: c.seqId, changes: c.changes })) },
    itemRejections: rejections,
  };
}

/** De taken wier planning door een relatie-wijziging kan verschuiven: de opvolger — zowel de NIEUWE
 *  (uit de zojuist herrekende store) als de OUDE (uit de voor-staat), want een verlegd eindpunt laat
 *  de vorige opvolger juist los. */
function affectedTaskIds(state: AppState, seqIds: string[], before: Map<string, SeqFields>): string[] {
  const live = state.sequences;
  const ids = new Set<string>();
  for (const id of seqIds) {
    const now = live.find((s) => s.id === id);
    if (now) ids.add(now.successorId);
    const prev = before.get(id);
    if (prev) ids.add(prev.successorId);
  }
  return [...ids];
}

const updateDependencies: BatchStepTool = {
  name: 'planner_update_dependencies',
  description:
    'WIJZIG bestaande relaties op hun sequence-id — de route voor "maak er een SS van", "zet de lag op ' +
    '2 dagen" of "hang deze relatie aan een andere taak". Gebruik dit in plaats van ' +
    'remove_dependencies + add_dependencies: het sequence-id blijft geldig en het is één undo-stap. ' +
    'Het `seqId` staat in get_project_overview / get_task achter de `#` in de relatienotatie ' +
    '("→2.3 FS+2d #seq-7"). Per item is elk veld OPTIONEEL en wordt alleen het opgegevene gewijzigd ' +
    '(veld-merge): `type` (FINISH_START|FINISH_FINISH|START_START|START_FINISH, of kort FS/FF/SS/SF), ' +
    '`lag`, `predecessorId`, `successorId`. ' + LAG_DOC + ' ' +
    'Een verzameltaak (taak MET subtaken) als nieuwe voorganger/opvolger is TOEGESTAAN. Zacht ' +
    'geweigerd per item (de rest van de bulk gaat gewoon door): een onbekend `seqId`, een onbekend ' +
    'veld (de weigering NOEMT de sleutel), een onbekend taak-id, een relatie naar zichzelf, een ' +
    'voorouder-relatie (een nieuwe voorganger/opvolger die de EIGEN (voor)ouder-samenvattingstaak ' +
    'van de andere kant is), een wijziging die een BESTAANDE relatie zou dubbelen (zelfde ' +
    'voorganger+opvolger+type), en een ' +
    'item dat niets verandert — die laatste krijgt expliciet "er valt niets te wijzigen" in plaats ' +
    'van een `ok` zonder effect. Een KRINGVERWIJZING (mogelijk zodra je een eindpunt verlegt) is een ' +
    'harde fout die de hele call terugrolt. Retourneert per gewijzigde relatie het echte VOOR/NA-' +
    'verschil (`changes`), de herrekende datums van de geraakte taken en het nieuwe projecteinde.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...STD_ANNOT },
  inputSchema: {
    type: 'object',
    properties: {
      updates: {
        type: 'array',
        minItems: 1,
        description: 'De te wijzigen relaties; één item per sequence-id (dubbele seqId\'s worden geweigerd).',
        items: {
          type: 'object',
          required: ['seqId'],
          properties: {
            seqId: {
              type: 'string',
              description: 'Sequence-id van de te wijzigen relatie (de `#`-suffix in de relatienotatie van de leestools).',
            },
            // Gedeelde schema-fragmenten (sequenceFields.ts): identiek aan add_dependencies.
            type: SEQ_TYPE_SCHEMA,
            lag: LAG_SCHEMA,
            predecessorId: { type: 'string', description: 'Nieuwe voorganger (taak-id); weglaten = ongewijzigd.' },
            successorId: { type: 'string', description: 'Nieuwe opvolger (taak-id); weglaten = ongewijzigd.' },
          },
          additionalProperties: false,
        },
      },
    },
    required: ['updates'],
    additionalProperties: false,
  },
  batchStep(args, ctx) {
    const parsed = parseUpdateDeps(args);
    if (typeof parsed === 'string') throw new McpStepError('VALIDATION', parsed);
    return updateDependenciesCore(ctx, parsed);
  },
  async handler(args, ctx) {
    const parsed = parseUpdateDeps(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const before = new Map(ctx.app.store.getState().sequences.map((s) => [s.id, fieldsOf(s)]));
    // Lege-batch-snelpad (zelfde reden als bij de andere bulk-tools): levert de statische
    // classificatie nul kandidaten, dan mag er géén transactie draaien — die zou een spurious
    // undo-snapshot pushen en de redo-stack van de gebruiker wissen voor een AI-no-op.
    {
      const state = ctx.app.store.getState();
      const pre = classifyDepUpdates(state, parsed);
      if (pre.candidates.length === 0) {
        const g = guardNonTransactional(ctx);
        if (g) return g;
        return okDirect(ctx, { updated: [], tasks: [], projectEnd: projectEndInfo(state).projectEnd }, pre.rejections);
      }
    }
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => updateDependenciesCore(ctx, parsed));
    return enrichOk(res, () => {
      const data = (res as McpToolOk).data as { updated: { id: string; changes: Record<string, unknown> }[] };
      const state = ctx.app.store.getState();
      return {
        updated: data.updated,
        tasks: freshDates(state, affectedTaskIds(state, data.updated.map((u) => u.id), before)),
        projectEnd: projectEndInfo(state).projectEnd,
      };
    });
  },
};

/** De relatie-wijzigingsmodule (registreer via één regel in `toolRegistry.MODULES`). */
export const dependencyTools: BatchStepTool[] = [updateDependencies];
