import type { MilestoneKind } from './task';

/** Eén taak zoals hij in de baseline vastligt. Keyed op de stabiele Task.id zodat matching over
 *  hernoemingen heen werkt; in IFC reist per taak het gebruikte GlobalId mee (`writeBaselineMeta`). */
export interface BaselineTask {
  taskId: string;
  /** Oorspronkelijke bronidentiteit als deze baseline uit een extern bronproject is opgebouwd.
   *  `taskId` blijft bewust de koppeling naar de huidige OPS-taak voor varianceweergave. */
  sourceTaskId?: string;
  sourceTaskCode?: string;
  start: string;           // ISO 8601 — snapshot van de getoonde start t.t.v. opslaan (`shownStart`: werkelijke start, anders earlyStart, anders scheduleStart)
  finish: string;          // ISO 8601 — snapshot van het getoonde einde (`shownFinish`: werkelijk einde bij voltooid, anders earlyFinish, anders scheduleFinish)
  duration: number;        // werkdagen (task.time.scheduleDuration)
  isMilestone: boolean;
  milestoneKind?: MilestoneKind;
}

/** De compacte tekeninvoer voor de actieve baseline. Zowel Gantt als rapport gebruiken deze
 * afleiding, zodat ze per taak altijd exact dezelfde opgeslagen datums tonen. */
export interface BaselineOverlayEntry {
  start: string;
  finish: string;
  isMilestone: boolean;
}

export type BaselineOverlay = Map<string, BaselineOverlayEntry>;

/** Een P6-stijl baseline: onbeperkt aantal; precies één is "actief" (activeBaselineId in de slice). */
export interface Baseline {
  id: string;
  /** Projectidentiteit van een gematerialiseerd extern baselineproject (bv. een XER-baselineproject). */
  sourceProjectId?: string;
  name: string;
  createdAt: string;       // ISO datetime — de snapshot-datum (ook getoond in het rapport)
  tasks: BaselineTask[];   // keyed op taskId
  projectEnd: string;      // ISO — projecteinde t.t.v. de snapshot (voor de variance-samenvatting)
  projectDuration: number; // werkdagen
}

/** Bouw de taak-id-index van de actieve baseline; geen actieve of onbekende baseline = geen overlay. */
export function buildBaselineOverlay(
  baselines: Baseline[],
  activeBaselineId: string | null | undefined,
): BaselineOverlay | undefined {
  if (!activeBaselineId) return undefined;
  const active = baselines.find(b => b.id === activeBaselineId);
  if (!active) return undefined;
  const map: BaselineOverlay = new Map();
  for (const task of active.tasks) {
    map.set(task.taskId, { start: task.start, finish: task.finish, isMilestone: task.isMilestone });
  }
  return map;
}

// ── Meerdere baselines tegelijk in de Gantt (issue #391) ────────────────────────────────────────

/** Vaste kleurplaats van een baseline in de strook: 0 = de actieve baseline (huidige
 *  baselinekleur), 1 en 2 = de twee vergelijkingsbaselines, elk met een eigen kleur. */
export type BaselineLayerSlot = 0 | 1 | 2;

/** De twee vergelijkingsplaatsen naast de actieve baseline. Een plaats houdt haar kleur, ook als de
 *  andere leeg wordt. Documentveld (`DOCUMENT_FIELDS`), bewaard in `OPS_Baselines`. */
export type ComparedBaselineIds = [string | null, string | null];

/** Geen vergelijking. */
export const noComparedBaselines = (): ComparedBaselineIds => [null, null];

/** Eén getekende baseline in de Gantt. */
export interface BaselineLayer {
  slot: BaselineLayerSlot;
  baselineId: string;
  name: string;
  overlay: BaselineOverlay;
}

/** Maximaal aantal extra baselines naast de actieve. */
export const MAX_COMPARED_BASELINES = 2;

/**
 * Maakt een vergelijkingskeuze consistent met de baselines van het document: een onbekend id, het id
 * van de actieve baseline of een dubbel id wordt een lege plaats. Geeft dezelfde referentie terug als
 * er niets verandert (geen loze state-wijziging).
 */
export function normalizeComparedBaselines(
  compared: readonly (string | null | undefined)[] | null | undefined,
  baselines: readonly Baseline[],
  activeBaselineId: string | null | undefined,
): ComparedBaselineIds {
  const seen = new Set<string>();
  const clean = (id: string | null | undefined): string | null => {
    if (!id || id === activeBaselineId || seen.has(id) || !baselines.some(b => b.id === id)) return null;
    seen.add(id);
    return id;
  };
  const next: ComparedBaselineIds = [clean(compared?.[0]), clean(compared?.[1])];
  if (Array.isArray(compared) && compared.length === 2 && compared[0] === next[0] && compared[1] === next[1]) {
    return compared as ComparedBaselineIds;
  }
  return next;
}

/** De baselines die de Gantt tekent, van de actieve naar de vergelijkingsplaatsen 1 en 2. Een
 *  plaats met een onbekend id of met het id van de actieve baseline telt niet mee. */
export function buildBaselineLayers(
  baselines: Baseline[],
  activeBaselineId: string | null | undefined,
  compared: readonly (string | null)[],
): BaselineLayer[] {
  const layers: BaselineLayer[] = [];
  const add = (id: string | null | undefined, slot: BaselineLayerSlot) => {
    if (!id) return;
    if (slot !== 0 && id === activeBaselineId) return;
    const baseline = baselines.find(b => b.id === id);
    if (!baseline) return;
    const overlay = buildBaselineOverlay(baselines, id);
    if (!overlay) return;
    layers.push({ slot, baselineId: id, name: baseline.name, overlay });
  };
  add(activeBaselineId, 0);
  compared.slice(0, MAX_COMPARED_BASELINES).forEach((id, i) => add(id, (i + 1) as BaselineLayerSlot));
  return layers;
}

/** De vergelijkingslagen (plaats 1 en 2) als invoer voor de Gantt-renderer en de afdruk. */
export function comparisonOverlays(layers: readonly BaselineLayer[]): { slot: 1 | 2; overlay: BaselineOverlay }[] {
  return layers
    .filter((layer): layer is BaselineLayer & { slot: 1 | 2 } => layer.slot !== 0)
    .map(layer => ({ slot: layer.slot, overlay: layer.overlay }));
}

/** Eerste en laatste dag (`YYYY-MM-DD`) die de getoonde baselines beslaan, of `null`. */
export interface BaselineReach {
  earliest: string | null;
  latest: string | null;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Het bereik van de baselines die de Gantt tekent (actief + vergelijkingen). De tijdas, het
 * scrollbereik en het rapportbereik nemen dit mee, zodat een vergelijkingsbaseline die ver vóór of
 * na de huidige taken ligt, bereikbaar blijft. Alleen de dag telt (een tijd valt binnen die dag).
 */
export function baselineReach(overlays: Iterable<BaselineOverlay>): BaselineReach {
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const overlay of overlays) {
    for (const entry of overlay.values()) {
      const s = entry.start.slice(0, 10);
      const f = (entry.finish || entry.start).slice(0, 10);
      if (DAY_RE.test(s) && (earliest === null || s < earliest)) earliest = s;
      if (DAY_RE.test(f) && (latest === null || f > latest)) latest = f;
    }
  }
  return { earliest, latest };
}

/** {@link baselineReach} van de baselines die de Gantt tekent: de actieve plus de vergelijkingen. */
export function shownBaselineReach(
  baselines: Baseline[],
  activeBaselineId: string | null | undefined,
  compared: readonly (string | null)[] | undefined,
): BaselineReach {
  return baselineReach(buildBaselineLayers(baselines, activeBaselineId, compared ?? []).map(l => l.overlay));
}

/** Zet een baseline in of uit de vergelijking. Aan: de eerste lege plaats (vol = geen wijziging).
 *  Uit: alleen die plaats wordt leeg, zodat de andere baseline haar kleur houdt. */
export function toggleComparedBaseline(
  compared: readonly [string | null, string | null],
  id: string,
): ComparedBaselineIds {
  const next: ComparedBaselineIds = [compared[0], compared[1]];
  const at = next.indexOf(id);
  if (at >= 0) {
    next[at] = null;
    return next;
  }
  const free = next.indexOf(null);
  if (free < 0) return next;
  next[free] = id;
  return next;
}
