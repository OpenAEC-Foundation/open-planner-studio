import type { Task } from '@/types/task';
import { isSummaryTask as taskIsSummary } from '@/utils/taskHierarchy';
import type { Sequence, SequenceType } from '@/types/sequence';

/**
 * De regels voor het aanmaken van een relatie, op één plek.
 *
 * Waarom dit een eigen BLADMODULE is: hij importeert bewust niets uit `slices/` of `appStore`.
 * Zou hij dat wel doen, dan ontstaat de cyclus `sequenceSlice → relationRules → appStore →
 * sequenceSlice` en slaat `npm run verify:cycles` aan. Zelfde reden als bij `state/defaults.ts`.
 *
 * Waarom hij bestaat: de dedup-regel stond in twee handgeschreven kopieën (`sequenceSlice` en
 * `mcpTransaction`), en de validatie die dit ontwerp toevoegt zou daar een derde en vierde kopie
 * van maken. Dat is precies het duplicatiepatroon dat elders in deze codebase is opgeruimd
 * (het documentcontract, `applyCpmResult`) — en het bijt hier direct: zou de validatie alleen in
 * de slice-actie staan, dan is de MCP-laag het gat waardoor de bug binnenkomt die we dichten.
 */

export interface RelationEndpoints {
  predecessorId: string;
  successorId: string;
}

/**
 * `summary-endpoint` bestond hier tot het eigenaarsbesluit van 2026-08-15: relaties met een
 * verzameltaak-eindpunt werden toen ALTIJD geweigerd. Sinds `expandSummaryRelations`
 * (`src/engine/scheduler/expandSummaryRelations.ts`) zulke relaties naar bladtaken doorrekent
 * (MS Project-semantiek), is dat te grofmazig — alleen een `ancestor`-relatie (een taak gekoppeld
 * aan zijn eigen (voor)ouder-samenvatting) blijft principieel zinloos: dat zou de expansie letterlijk
 * A→B ÉN B→A laten genereren, een directe cyclus. Zie `docs/superpowers/specs/2026-08-14-mijlpaal-
 * relaties-design.md` (met de banner van 2026-08-15 bovenaan) voor de volledige voorgeschiedenis.
 */
export type RelationRejection = 'self' | 'unknown-task' | 'ancestor' | 'duplicate';

export type RelationVerdict = { ok: true } | { ok: false; reason: RelationRejection };

/**
 * Hoe komt de regelmodule aan een taak? Bewust een functie en geen `Map`: de aanroepers hebben
 * elk al een goedkope manier om op te zoeken — het Relaties-paneel heeft een `taskById`-useMemo en
 * de MCP-classificatie bouwt één map voor de hele batch. Een Map eisen zou die aanroepers dwingen
 * er een tweede te bouwen, per aanroep, binnen een lus. In de store-acties draait de lookup over
 * een Immer-draft; daar valt met deze vorm de Map-allocatie weg en sluit `find` bij een treffer
 * kort. (Het scant nog steeds lineair en materialiseert onderweg dezelfde child-proxies — dit is
 * een kleinere constante, geen andere complexiteit.)
 */
export type TaskLookup = (id: string) => Task | undefined;

/**
 * Is deze taak een verzameltaak? De gedeelde semantiek staat in `utils/taskHierarchy`: een taak
 * met kinderen én een expliciet gemarkeerde lege WBS-taak zijn allebei samenvattingen. Deze export
 * blijft bestaan voor de state-regeltests en de bestaande state-API, maar de uitvoering delegeert
 * zodat scheduler, renderer, resourcepaden en IFC exact hetzelfde begrip gebruiken.
 */
export function isSummaryTask(task: Task | undefined): boolean {
  return taskIsSummary(task);
}

/**
 * Is `maybeAncestorId` een (voor)ouder van `id` in de WBS-boom (via `parentId` omhoog)? Cyclusvast:
 * een corrupte `parentId`-keten kan hier nooit een oneindige lus geven — een reeds bezochte id breekt
 * de lus af (en geeft `false`: een echte cyclus in `parentId` is zelf al een datafout, geen antwoord
 * op deze vraag).
 */
function isAncestor(lookup: TaskLookup, maybeAncestorId: string, id: string): boolean {
  const visited = new Set<string>();
  let current = lookup(id)?.parentId ?? null;
  while (current) {
    if (current === maybeAncestorId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    current = lookup(current)?.parentId ?? null;
  }
  return false;
}

/**
 * Is dit een relatie tussen een taak en zijn EIGEN (voor)ouder-samenvatting (in beide richtingen)?
 * Dit is de ENIGE nog geweigerde vorm van een relatie die een verzameltaak raakt (eigenaarsbesluit
 * 2026-08-15, zie `RelationRejection`-doc): `expandSummaryRelations` zou zo'n relatie letterlijk
 * A→B ÉN B→A laten genereren (elke bladafstammeling van de ene kant is óók een bladafstammeling van
 * de andere kant), een directe cyclus die de HELE CPM-solve laat mislukken. In een boom (één
 * `parentId` per taak) is "delen predIds/succIds bladafstammelingen" equivalent aan "de een is
 * (voor)ouder van de ander" — vandaar dat deze functie via `parentId` omhoog loopt i.p.v. de volledige
 * bladafstammelingenlijst te bouwen zoals `expandSummaryRelations.leafDescendantsOf` doet (die heeft
 * de VOLLEDIGE lijst nodig om te expanderen; wij hebben hier alleen een ja/nee-vraag).
 *
 * DIE EQUIVALENTIE GELDT ALLEEN ALS `parentId` EN `childIds` ELKAARS SPIEGEL ZIJN (taak X in
 * `parent.childIds` ⇔ `X.parentId === parent.id`, over de hele boom). Bij een corrupte/inconsistente
 * boom (bv. een IFC-/import-artefact waar een kind wél in `childIds` staat maar zijn eigen `parentId`
 * elders — of nergens — naar wijst) kunnen deze functie (leunt op `parentId`) en de solver-eigen guard
 * in `expandSummaryRelations` (leunt op `childIds` via `leafDescendantsOf`) verschillend oordelen over
 * dezelfde relatie. Dat is GEACCEPTEERD gedrag, geen bug om hier op te lossen: de aanmaak-weigering
 * (dit bestand) en de solver-guard (expandSummaryRelations) zijn twee onafhankelijke vangnetten met
 * elk hun eigen, hier expliciet benoemde aanname — geen van beide claimt de ANDERE te vervangen.
 *
 * Bewust GEEN bredere `summary-endpoint`-weigering meer: een relatie náár (niet van-en-naar-elkaar)
 * een verzameltaak rekent sinds `expandSummaryRelations` gewoon volwaardig mee.
 */
export function isAncestorRelation(lookup: TaskLookup, seq: RelationEndpoints): boolean {
  return isAncestor(lookup, seq.predecessorId, seq.successorId)
    || isAncestor(lookup, seq.successorId, seq.predecessorId);
}

/**
 * Mag deze NIEUWE relatie erbij? Volgorde is bewust: structurele problemen eerst, duplicaat als
 * laatste — een voorouder-relatie die toevallig ook al bestaat moet het inhoudelijke probleem
 * melden, niet "bestaat al".
 */
export function relationVerdict(
  lookup: TaskLookup,
  sequences: readonly Sequence[],
  seq: RelationEndpoints & { type: SequenceType },
): RelationVerdict {
  if (seq.predecessorId === seq.successorId) return { ok: false, reason: 'self' };
  const pred = lookup(seq.predecessorId);
  const succ = lookup(seq.successorId);
  if (!pred || !succ) return { ok: false, reason: 'unknown-task' };
  // Een verzameltaak-eindpunt is sinds 2026-08-15 legaal (expandSummaryRelations rekent ermee door);
  // alleen een relatie tussen een taak en zijn EIGEN (voor)ouder-samenvatting blijft zinloos —
  // zie `isAncestorRelation`.
  if (isAncestorRelation(lookup, seq)) return { ok: false, reason: 'ancestor' };
  // Exacte duplicaten weren, maar meerdere TYPES tussen hetzelfde paar blijven toegestaan
  // (bv. SS+FF als ladder-koppeling) — anders verdwijnt de tweede relatie stil.
  const exists = sequences.some(
    (e) => e.predecessorId === seq.predecessorId
      && e.successorId === seq.successorId
      && e.type === seq.type,
  );
  return exists ? { ok: false, reason: 'duplicate' } : { ok: true };
}
