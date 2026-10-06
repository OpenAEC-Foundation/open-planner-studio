// MCP-bridge — de gedeelde RELATIE-VELDLAAG: één implementatie van de notatie waarin de leestools
// relaties TONEN en de schrijftools ze ACCEPTEREN.
//
// WAAROM EEN EIGEN BESTAND. Exact hetzelfde precedent als `taskFields.ts`: dat bestaat omdat
// `add_tasks` en `update_tasks` één allowlist moeten delen. Hier geldt hetzelfde voor
// `add_dependencies` (taskTools.ts) en `update_dependencies` (dependencyTools.ts) — plus de LEESKANT
// (`readTools.ts`), die de afkorting en het lag-label produceert waarop de schrijfkant zich richt.
// Zonder deze module zouden er drie kopieën van dezelfde notatiekennis rondzwerven — een bron van
// stille fouten zoals `FS` accepteren maar `+2d` stil op 0 zetten.
//
// DE KERNCONVENTIE: DE SCHRIJFKANT SPREEKT DE LEESKANT. Wat `lagLabel`/`seqAbbrev` hieronder
// PRODUCEREN, moet `normalizeSeqType`/`parseLag` hieronder ACCEPTEREN — in dezelfde string. Voeg je
// hier een leesvorm toe, dan hoort de parse-kant in dezelfde commit mee.
import type { Sequence, SequenceType } from '@/types/sequence';

/** De vier IFC-relatietypes (lange notatie), in de volgorde waarin foutmeldingen ze opsommen. */
export const SEQ_TYPES: SequenceType[] = ['FINISH_START', 'FINISH_FINISH', 'START_START', 'START_FINISH'];

/**
 * De SCHRIJFKANT MOET DE LEESKANT SPREKEN. `planner_get_task` en `planner_get_project_overview`
 * geven relatietypes terug als `FS`/`SS`/`FF`/`SF` en lag als STRING (`"+2d"`, `"-1d"`, `"+50%"`).
 * Een agent die de voorgangers van taak A leest en op taak B spiegelt, geeft dus letterlijk
 * `type: 'FS', lag: '+2d'` door. Daarom accepteert de schrijfkant beide notaties (lang/kort, getal/
 * string) en vertaalt ze; niets verdampt in stilte.
 */
const SEQ_TYPE_ALIASES: Record<string, SequenceType> = {
  FS: 'FINISH_START',
  FF: 'FINISH_FINISH',
  SS: 'START_START',
  SF: 'START_FINISH',
};

/** Korte notaties zoals de leestools ze teruggeven — ook geldig als `type`-invoer. */
export const SEQ_TYPE_SHORT = Object.keys(SEQ_TYPE_ALIASES);

/** Normaliseer een relatietype (lang of kort, hoofdletterongevoelig) ⇒ `SequenceType`, of null. */
export function normalizeSeqType(v: unknown): SequenceType | null {
  if (typeof v !== 'string') return null;
  const up = v.trim().toUpperCase();
  if ((SEQ_TYPES as string[]).includes(up)) return up as SequenceType;
  return SEQ_TYPE_ALIASES[up] ?? null;
}

/** De reden-tekst bij een onbekend relatietype; noemt BEIDE notaties. */
export function unknownTypeReason(raw: unknown): string {
  return `unknown relationship type '${String(raw)}'; allowed: ${SEQ_TYPES.join(' | ')} (or short ${SEQ_TYPE_SHORT.join('/')})`;
}

/**
 * Weigeringstekst voor een voorouder-relatie. Dit is MCP-agent-tekst,
 * geen regel — de regel zelf (`isAncestorRelation`) staat in de bladmodule `state/relationRules.ts`,
 * die geen Nederlandse volzinnen kent (alleen types en predicaten). De twee enige lezers zijn
 * `classifyDeps` (taskTools.ts, NIEUWE relaties) en `classifyDepUpdates` (dependencyTools.ts, het
 * VERHANGEN van een bestaand eindpunt) — exact de twee modules waarvoor deze gedeelde veldlaag al
 * bestaat.
 *
 * Een gewoon verzameltaak-eindpunt is GEEN weigergrond: `expandSummaryRelations` rekent zo'n
 * relatie door naar de onderliggende bladtaken (MS Project-semantiek). Alleen een relatie tussen een
 * taak en zijn EIGEN (voor)ouder-samenvatting blijft zinloos — die zou de expansie een directe cyclus
 * laten genereren.
 */
export const ANCESTOR_RELATION_REJECTION =
  'a relationship between a task and its own ancestor summary task (direct parent or higher) is not allowed (in either direction)';

/** Weigertekst voor een relatie van een taak met zichzelf — gedeeld door `add_dependencies` en
 *  `update_dependencies`, net als `ANCESTOR_RELATION_REJECTION` hierboven. */
export function selfRelationReason(taskId: string): string {
  return `a relationship cannot connect task '${taskId}' to itself`;
}

/** FS/SS/FF/SF-afkorting voor de compacte relatienotatie (leeskant). */
export function seqAbbrev(type: SequenceType): string {
  switch (type) {
    case 'FINISH_START': return 'FS';
    case 'START_START': return 'SS';
    case 'FINISH_FINISH': return 'FF';
    case 'START_FINISH': return 'SF';
  }
}

/**
 * Compacte lag-suffix: "+2d" / "-1d" / "+50%" / "" (geen lag). Percentage sluit dagen uit (model:
 * `lagDays` wordt genegeerd zodra `lagPercent` gezet is).
 *
 * BEWUST GEEN `lagMinutes`: de leeskant heeft die nooit getoond, en de schrijfkant kan hem daarom ook
 * niet zetten (zie `parseLag`). Elke lag die de bridge WÉL schrijft, wist `lagMinutes` juist — anders
 * zou een uit IFC ingelezen minuut-lag de nieuwe dag-lag stil overrulen.
 */
export function lagLabel(seq: Pick<Sequence, 'lagDays' | 'lagPercent'>): string {
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent) && seq.lagPercent !== 0) {
    return `${seq.lagPercent > 0 ? '+' : ''}${seq.lagPercent}%`;
  }
  const d = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
  if (d === 0) return '';
  return `${d > 0 ? '+' : ''}${d}d`;
}

/** Lag-label zoals hij in een VOOR/NA-rapport leesbaar is: "" (geen lag) wordt "0". */
export function lagReport(seq: Pick<Sequence, 'lagDays' | 'lagPercent'>): string {
  return lagLabel(seq) || '0';
}

/** Lag-vormen die de LEESKANT produceert: `"+2d"`, `"-1d"`, `"2d"`, `"2"`, `"+0.5d"`. */
const LAG_STRING_RE = /^([+-]?\d+(?:[.,]\d+)?)\s*(?:d|dag|dagen|day|days|wd)?$/i;
/** Procent-lag (`"+50%"`) — de derde vorm die de leeskant produceert (`Sequence.lagPercent`). */
const LAG_PERCENT_RE = /^([+-]?\d+(?:[.,]\d+)?)\s*%$/;

/**
 * Eén geparste lag, in de twee representaties die het model kent. `percent` gezet ⇒ `days` is 0 (het
 * model negeert `lagDays` zodra `lagPercent` bestaat, dus alles anders zou liegen).
 */
export interface ParsedLag {
  days: number;
  percent?: number;
}

/**
 * Zet een geparste lag om in de twee velden die de bridge op een `Sequence` schrijft: één van beide
 * draagt de waarde, de ander is `undefined` (= wissen).
 *
 * WAARSCHUWING VOOR ELKE AANROEPER: deze patch is pas volledig als je óók een bestaande `lagMinutes`
 * WEGNEEMT. `CPMSolver.resolveLagMinutes` leest in volgorde `lagPercent` → `lagMinutes` → `lagDays`,
 * dus een achtergebleven minuut-lag (uit een IFC-/P6-import) overrulet de zojuist gezette dag-lag —
 * en dan antwoordt de tool `ok` met een keurig VOOR/NA-verschil terwijl de planning geen millimeter
 * beweegt. Precies de stille no-op die dit oppervlak niet mag hebben.
 */
export function lagPatchOf(lag: ParsedLag): Pick<Sequence, 'lagDays' | 'lagPercent'> {
  return {
    lagDays: lag.percent !== undefined ? 0 : lag.days,
    lagPercent: lag.percent,
  };
}

/**
 * Valideer/normaliseer `lag`. Afwezig ⇒ 0 (bestaande default).
 *
 * Nooit stil 0 bij een niet-numerieke lag: LLM's sturen routinematig numerieke strings; die vorm
 * wordt geaccepteerd én omgezet, al het overige wordt bij naam geweigerd.
 *
 * PROCENT-LAG is zetbaar: `"+50%"` ⇒ `lagPercent: 50`. Een procent van 0 levert bewust een gewone
 * dag-lag 0 op: `lagPercent: 0` zou door de leeskant als "" (géén lag) worden gerenderd, en dan kun
 * je hem niet meer terugschrijven.
 */
export function parseLag(raw: unknown): { ok: true; value: ParsedLag } | { ok: false; reason: string } {
  if (raw === undefined || raw === null) return { ok: true, value: { days: 0 } };
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false, reason: '`lag` must be a finite number (working days)' };
    return { ok: true, value: { days: raw } };
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    const p = LAG_PERCENT_RE.exec(s);
    if (p) {
      const n = Number(p[1].replace(',', '.'));
      if (!Number.isFinite(n)) return { ok: false, reason: `\`lag\` '${s}' is not a valid percentage lag` };
      // 0% ⇒ gewone lag 0 (zie de doc hierboven: anders onleesbaar en dus niet terugschrijfbaar).
      return { ok: true, value: n === 0 ? { days: 0 } : { days: 0, percent: n } };
    }
    const m = LAG_STRING_RE.exec(s);
    if (m) {
      const n = Number(m[1].replace(',', '.'));
      if (Number.isFinite(n)) return { ok: true, value: { days: n } };
    }
    return {
      ok: false,
      reason:
        `\`lag\` '${s}' is not a valid lag; give working days (a fraction such as 0.5 is allowed) as a ` +
        'number (2, -1), as a string ("+2d", "-1d", "2") or a percentage lag of the predecessor duration ' +
        '("+50%")',
    };
  }
  return { ok: false, reason: `\`lag\` must be a number of working days (or a string such as "+2d"/"+50%"), got ${typeof raw}` };
}

// --- Gedeelde schema-fragmenten -----------------------------------------------------------------
// Eén bron voor `add_dependencies` én `update_dependencies`, zodat de twee schema's niet uit elkaar
// kunnen lopen. Gebruiken uitsluitend trefwoorden die `schemaValidate.ts` afdwingt.

export const SEQ_TYPE_SCHEMA = {
  type: 'string',
  enum: [...SEQ_TYPES, ...SEQ_TYPE_SHORT],
  description: 'Long form (FINISH_START, …) or the short form the read tools return (FS/FF/SS/SF).',
};

export const LAG_SCHEMA = {
  type: ['number', 'string'],
  description:
    'Lag. As a number (2, -1) or as the read-side string ("+2d", "-1d", "2") = WORKING DAYS; a fraction ' +
    '(0.5, "+0.5d") is allowed and not rounded (negative = lead); as a percentage string ("+50%") = ' +
    'percentage of the PREDECESSOR DURATION, re-evaluated on every recalculation. Any other form is refused ' +
    '— never silently set to 0.',
};

/** Gedeelde documentatiezin over de lag-notatie voor de tool-descriptions. */
export const LAG_DOC =
  '`lag` may be a number (2, -1), the read-side string ("+2d", "-1d", "2") or a percentage lag of the ' +
  'predecessor duration ("+50%"); any other form is REFUSED instead of silently set to 0. Setting a lag ' +
  'always clears the other lag representations (percentage ⇄ days ⇄ the minute lag read from IFC), so the ' +
  'given value is really the effective one.';
