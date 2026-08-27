// MCP-bridge — de gedeelde RELATIE-VELDLAAG: één implementatie van de notatie waarin de leestools
// relaties TONEN en de schrijftools ze ACCEPTEREN.
//
// WAAROM EEN EIGEN BESTAND. Exact hetzelfde precedent als `taskFields.ts`: dat bestaat omdat
// `add_tasks` en `update_tasks` één allowlist moeten delen. Hier geldt hetzelfde voor
// `add_dependencies` (taskTools.ts) en `update_dependencies` (dependencyTools.ts) — plus de LEESKANT
// (`readTools.ts`), die de afkorting en het lag-label produceert waarop de schrijfkant zich richt.
// Zonder deze module zouden er drie kopieën van dezelfde notatiekennis rondzwerven, en dat is precies
// de klasse fouten die de eerlijkheidsronde heeft opgeruimd (`FS` accepteren maar `+2d` stil op 0
// zetten was een variant daarvan).
//
// DE KERNCONVENTIE: DE SCHRIJFKANT SPREEKT DE LEESKANT. Wat `lagLabel`/`seqAbbrev` hieronder
// PRODUCEREN, moet `normalizeSeqType`/`parseLag` hieronder ACCEPTEREN — in dezelfde string. Voeg je
// hier een leesvorm toe, dan hoort de parse-kant in dezelfde commit mee.
import type { Sequence, SequenceType } from '@/types/sequence';

/** De vier IFC-relatietypes (lange notatie), in de volgorde waarin foutmeldingen ze opsommen. */
export const SEQ_TYPES: SequenceType[] = ['FINISH_START', 'FINISH_FINISH', 'START_START', 'START_FINISH'];

/**
 * De SCHRIJFKANT MOET DE LEESKANT SPREKEN (audit-bevindingen H1/H2). `planner_get_task` en
 * `planner_get_project_overview` geven relatietypes terug als `FS`/`SS`/`FF`/`SF` en lag als STRING
 * (`"+2d"`, `"-1d"`, `"+50%"`), maar `add_dependencies` eiste de lange enum plus een `number`. Een
 * agent die de voorgangers van taak A leest en op taak B spiegelt, gaf dus letterlijk `type: 'FS',
 * lag: '+2d'` door — waarna het type zacht werd geweigerd en de lag STIL 0 werd. Daarom accepteert de
 * schrijfkant beide notaties en vertaalt ze; niets verdampt meer in stilte.
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

/** De reden-tekst bij een onbekend relatietype; noemt BEIDE notaties (H1). */
export function unknownTypeReason(raw: unknown): string {
  return `onbekend relatietype '${String(raw)}'; toegestaan: ${SEQ_TYPES.join(' | ')} (of kort ${SEQ_TYPE_SHORT.join('/')})`;
}

/**
 * Weigeringstekst voor een voorouder-relatie (eigenaarsbesluit 2026-08-15). Dit is MCP-agent-tekst,
 * geen regel — de regel zelf (`isAncestorRelation`) staat in de bladmodule `state/relationRules.ts`,
 * die geen Nederlandse volzinnen kent (alleen types en predicaten). De twee enige lezers zijn
 * `classifyDeps` (taskTools.ts, NIEUWE relaties) en `classifyDepUpdates` (dependencyTools.ts, het
 * VERHANGEN van een bestaand eindpunt) — exact de twee modules waarvoor deze gedeelde veldlaag al
 * bestaat.
 *
 * Een gewoon verzameltaak-eindpunt is GEEN weigergrond meer: `expandSummaryRelations` rekent zo'n
 * relatie door naar de onderliggende bladtaken (MS Project-semantiek). Alleen een relatie tussen een
 * taak en zijn EIGEN (voor)ouder-samenvatting blijft zinloos — die zou de expansie een directe cyclus
 * laten genereren.
 */
export const ANCESTOR_RELATION_REJECTION =
  'een relatie tussen een taak en zijn eigen voorouder-samenvattingstaak (directe ouder of hoger) is niet toegestaan (in beide richtingen)';

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
 * Was (audit-bevinding K4) `typeof c.lag === 'number' ? c.lag : 0` — een niet-numerieke lag werd
 * daarmee STIL 0 en de tool antwoordde gewoon `added: [...]`. LLM's sturen routinematig numerieke
 * strings; die vorm wordt geaccepteerd én omgezet, al het overige wordt bij naam geweigerd.
 *
 * PROCENT-LAG is sinds `planner_update_dependencies` WÉL zetbaar (hij was de enige leesvorm die de
 * schrijfkant niet sprak). `"+50%"` ⇒ `lagPercent: 50`. Een procent van 0 levert bewust een gewone
 * dag-lag 0 op: `lagPercent: 0` zou door de leeskant als "" (géén lag) worden gerenderd, en dan kon
 * je hem niet meer terugschrijven — de asymmetrie die we juist opheffen.
 */
export function parseLag(raw: unknown): { ok: true; value: ParsedLag } | { ok: false; reason: string } {
  if (raw === undefined || raw === null) return { ok: true, value: { days: 0 } };
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false, reason: '`lag` moet een eindig getal zijn (hele werkdagen)' };
    return { ok: true, value: { days: raw } };
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    const p = LAG_PERCENT_RE.exec(s);
    if (p) {
      const n = Number(p[1].replace(',', '.'));
      if (!Number.isFinite(n)) return { ok: false, reason: `\`lag\` '${s}' is geen geldige procent-lag` };
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
        `\`lag\` '${s}' is geen geldige lag; geef hele werkdagen als getal (2, -1), als string ` +
        '("+2d", "-1d", "2") of een procent-lag van de voorgangerduur ("+50%")',
    };
  }
  return { ok: false, reason: `\`lag\` moet een getal in werkdagen zijn (of een string als "+2d"/"+50%"), kreeg ${typeof raw}` };
}

// --- Gedeelde schema-fragmenten -----------------------------------------------------------------
// Eén bron voor `add_dependencies` én `update_dependencies`, zodat de twee schema's niet uit elkaar
// kunnen lopen. Gebruiken uitsluitend trefwoorden die `schemaValidate.ts` afdwingt.

export const SEQ_TYPE_SCHEMA = {
  type: 'string',
  enum: [...SEQ_TYPES, ...SEQ_TYPE_SHORT],
  description: 'Lange vorm (FINISH_START, …) of de korte vorm die de leestools teruggeven (FS/FF/SS/SF).',
};

export const LAG_SCHEMA = {
  type: ['number', 'string'],
  description:
    'Lag. Als getal (2, -1) of als de leeskant-string ("+2d", "-1d", "2") = HELE WERKDAGEN ' +
    '(negatief = lead); als procent-string ("+50%") = percentage van de VOORGANGERDUUR, per ' +
    'herberekening opnieuw bepaald. Elke andere vorm wordt geweigerd — nooit stil op 0 gezet.',
};

/** Gedeelde documentatiezin over de lag-notatie voor de tool-descriptions. */
export const LAG_DOC =
  '`lag` mag een getal (2, -1), de leeskant-string ("+2d", "-1d", "2") of een procent-lag van de ' +
  'voorgangerduur ("+50%") zijn; elke andere vorm wordt GEWEIGERD in plaats van stil op 0 gezet. ' +
  'Een lag zetten wist altijd de andere lag-representaties (procent ⇄ dagen ⇄ de uit IFC ingelezen ' +
  'minuut-lag), zodat de opgegeven waarde ook echt de werkzame is.';
