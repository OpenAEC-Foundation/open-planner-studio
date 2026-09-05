// MCP-bridge — begrensde, alleen-lezen inspectie van retained XER/P6-bronsemantiek.
//
// Deze tool leest uitsluitend het reeds opgeslagen `xerSourceArchive` en de actieve
// `xerImportMetadata`-view. Hij parset geen bytes opnieuw en raakt de store nooit. Summary is
// bewust vrij van raw rows en raw bytes; bronrijen en bytes zijn aparte, expliciet gepagineerde
// secties.
//
// DE EIGENSCHAP (review2-3d.md, ronde 3): niet "drie paden dichtzetten" en ook niet "drie
// sleutelnamen blokkeren" — een blocklist van vrije-tekstvelden vergeet onvermijdelijk een synoniem
// (`text`/`comment`/`memo`/`remark`/`title`/`longName` glipten er in ronde 2 allemaal doorheen, en
// `taskProjections.notes` — een objectarray, geen string — helemaal, omdat de blocklist alleen op de
// buitenste sleutel keek). `sanitizeProvenanceValue` hieronder is nu DENY-BY-DEFAULT: hij loopt
// recursief over WAT een sectiefunctie ook teruggeeft, herkent een XER-bronrij STRUCTUREEL (elk plain
// object met een numerieke `line` en een `cells`-veld van louter strings — dus ook op plekken waar
// niemand een allowlist-regel voor had geschreven, en ook als de rij méér dan die twee velden draagt,
// zoals `XerScheduleOptionsSourceRow`'s `table`) en classificeert elke LOSSE string op sleutelnaam
// tegen `SAFE_LABEL_KEYS`: staat de sleutel er niet expliciet in — ook een onbekende toekomstige
// sleutel — dan is de waarde zonder `includeRawRows` VOLLEDIG onzichtbaar en met opt-in afgekapt op
// 2.000 tekens. Staat de sleutel er wél in (id's, codes, korte labels, enum-/tokenvelden), dan blijft
// hij altijd zichtbaar maar hard afgekapt op 200 tekens. Cel-/veldNAMEN (de `%F`-kolomkop van het
// bronbestand) lopen door dezelfde afkap- en budgetlogica als celWAARDEN — anders ontsnapt een
// aanvaller-gecontroleerde kolomnaam aan zowel de zichtbaarheidsgrens als de responsbegroting.
// `summary` (de default-sectie) loopt door DEZELFDE poort plus dezelfde responsgrens; er is geen
// aparte, ongesaneerde vorm meer.

import type { AppState } from '@/state/appStore';
import type { McpContext, McpErrorCode, McpToolDef, McpToolResult } from '../contracts';
import { runReadTool, toolError } from './runtime';
import {
  XER_SOURCE_ARCHIVE_CHUNK_BYTES,
  type XerSourceArchive,
} from '@/services/xerSourceArchive';

const SECTIONS = ['summary', 'resourceCatalog', 'metadataCatalog', 'taskSourceRowsByProject', 'diagnostics', 'rawSource'] as const;
type Section = typeof SECTIONS[number];

const RESOURCE_COLLECTIONS = [
  'resources', 'identities', 'resourceSources', 'roleSources', 'rates', 'curves', 'assignmentSources', 'issues',
] as const;
const METADATA_COLLECTIONS = [
  'activityCodeTypes', 'customFieldDefs', 'taskProjections', 'issues',
  'ACTVTYPE', 'ACTVCODE', 'TASKACTV', 'UDFTYPE', 'UDFVALUE', 'MEMOTYPE', 'TASKNOTE', 'TASKMEMO',
  'TASK_NOTES', 'deferredUdfValues', 'unknownUdfTypes',
] as const;
const DIAGNOSTIC_COLLECTIONS = [
  'tableIssues', 'unknownTables', 'unknownFields', 'scheduleOptions', 'relationResolutionIssues',
  'resourceCatalogIssues', 'metadataCatalogIssues', 'documentViews', 'importReport',
] as const;
const ALL_COLLECTIONS = [...RESOURCE_COLLECTIONS, ...METADATA_COLLECTIONS, ...DIAGNOSTIC_COLLECTIONS] as const;

type Collection = typeof ALL_COLLECTIONS[number];

interface XerProvenanceArgs {
  section?: unknown;
  collection?: unknown;
  projectId?: unknown;
  limit?: unknown;
  offset?: unknown;
  includeRawSource?: unknown;
  includeRawRows?: unknown;
}

/** Sections die door de generieke bronrij-/vrije-tekstpoort lopen. `diagnostics` zit erbij sinds
 *  review2-3d.md #1: `documentViews` draagt via `resources.assignments[].rawRow` dezelfde vrije
 *  XER-cellen als de andere drie secties en hoorde dus niet buiten deze lijst te vallen. */
const RAW_ROWS_SECTIONS: readonly Section[] = ['resourceCatalog', 'metadataCatalog', 'taskSourceRowsByProject', 'diagnostics'];

/** Lagere paginalimiet zodra `includeRawRows` echte celwaarden ontgrendelt — spiegelt de aparte,
 *  strakkere grens die `rawSource` al had voor ruwe bytes. */
const RAW_ROWS_OPT_IN_MAX_LIMIT = 100;
/** Per-cel/per-string afkapgrens voor VRIJE tekst (rawRow-cellen, notities, customFields-waarden). */
const RAW_CELL_MAX_CHARS = 2000;
/** Per-string afkapgrens voor korte LABEL-achtige velden (namen, omschrijvingen buiten `rawRow`) die
 *  altijd zichtbaar blijven — review2-3d.md #2: zonder deze cap kon een misbruikt `name`-veld
 *  ongehinderd megabytes meesturen omdat "genormaliseerd" werd gelezen als "veilig". */
const LABEL_MAX_CHARS = 200;
/** Cap op het aantal cellen/velden per bronrij of vrije-tekstkaart — review2-3d.md #6: zonder deze
 *  cap bepaalt de `%F`-kolomkop van het bronbestand ongehinderd hoeveel cellen één rij draagt (een
 *  aanvaller-gecontroleerd bestand kan er 20.000 declareren). */
const MAX_CELLS_PER_ROW = 200;
/** Harde bovengrens op de totale geserialiseerde paginarespons, in ECHTE UTF-8-bytes
 *  (review2-3d.md #4: `String.length` telt UTF-16-code-units, geen bytes — voor CJK/Arabisch/emoji
 *  zit daar een factor 2–3 tussen). */
const MAX_SECTION_RESPONSE_BYTES = 256 * 1024;

/** DENY-BY-DEFAULT allowlist (review2-3d.md ronde 3, N1/N2): id-/code-/labelachtige sleutels die
 *  zonder opt-in zichtbaar mogen blijven (afgekapt op 200 tekens). Alles wat hier niet in staat —
 *  `text`/`comment`/`memo`/`remark`/`title`/`longName`, een taaknotitie, een onbekende toekomstige
 *  sleutel — is zonder `includeRawRows` volledig onzichtbaar. Bewust een allowlist en geen blocklist:
 *  een vergeten sleutel hier betekent "verbergen" (fail-safe), een vergeten sleutel in een blocklist
 *  betekent "lekken" (fail-open) — precies het verschil dat ronde 2 fout deed gaan.
 *
 *  GEACCEPTEERD RISICO (review2-3d.md ronde 4, R6): `name` en `code` blijven zichtbaar (afgekapt op
 *  200 tekens) omdat een provenance-inspectie zonder namen nutteloos is — maar een P6-resourcenaam
 *  is in de praktijk routinematig een persoonsnaam. Dit is dus bewust GEEN AVG-schone lijst. Moet
 *  deze tool ooit persoonsgegevensvrij zijn, dan hoort `name` alsnog achter `includeRawRows`.
 *
 *  Elke sleutel hieronder is nagelopen tegen de daadwerkelijk blootgestelde grafiek (resourceCatalog,
 *  metadataCatalog, diagnostics, taskSourceRowsByProject, summary) — geen sleutel "voor het geval
 *  dat". `unit`/`currShortName` zijn om die reden verwijderd (kwamen nergens exposed voor;
 *  `curr_short_name` is alleen een interne XER-kolomnaam voor numberFormat-detectie, geen
 *  responsveld). `unitOfMeasure` staat er wél echt (Resource.unitOfMeasure, `xerResources.ts`). */
const SAFE_LABEL_KEYS = new Set([
  // id's/verwijzingen
  'id', 'sourceId', 'internalId', 'taskId', 'predecessorTaskId', 'projectId', 'sourceProjectId',
  'currentProjectId', 'resourceId', 'roleId', 'curveId', 'parentId', 'parentSourceId', 'calendarId',
  'calendarSourceId', 'defaultRoleSourceId', 'unitSourceId', 'taskSourceId', 'companyId',
  'libraryItemId', 'syncedHash',
  // korte labels/codes
  'name', 'shortName', 'code', 'taskCode', 'wbsCode', 'unitOfMeasure', 'currencyCode',
  'defaultCurrencyCode',
  // structurele/enum-/tokenvelden
  'kind', 'type', 'rawType', 'table', 'field', 'reason', 'fallback', 'bestFit', 'encoding',
  'newline', 'bom', 'format', 'source', 'algorithm', 'status', 'from', 'token', 'decimal', 'group',
  'progressMode', 'mappedProgressMode', 'effectiveDate',
  // vaste, systeemeigen waarden (geen bronvrije tekst). `value` is vandaag uitsluitend
  // `summary.source.digest.value` (de SHA-256) — de generiekste naam hier en dus de eerste kandidaat
  // om ooit per ongeluk vrije tekst te dragen; bij twijfel eerst hercontroleren tegen de grafiek.
  'sha256', 'value', 'availableProjectIds', 'baselineFallbackReasons',
]);
/** Vrije-tekstkáárten (UDF-/activiteitswaarden e.d.): net als een rawRow geeft dit zonder opt-in
 *  alleen een `fieldCount` (transparant dát er iets verborgen is), i.p.v. een leeg object — dat zou
 *  de generieke deny-by-default-recursie anders ook al doen, maar dan zonder die transparantie. */
const FREE_TEXT_MAP_KEYS = new Set(['customFields']);

class XerProvenanceError extends Error {
  constructor(public readonly code: McpErrorCode, message: string) {
    super(message);
  }
}

/** Codepoint-veilig afkappen (review2-3d.md #7): `slice(0, n)` op code-units kan een surrogaatpaar
 *  doormidden knippen (bv. een emoji), wat een well-formed maar kapotte string oplevert voor de
 *  client. Schuif de grens één code-unit terug zodra hij op een eenzame high surrogate uitkomt. */
function truncateAt(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  let end = maxChars;
  const codeUnit = value.charCodeAt(end - 1);
  if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) end -= 1;
  return `${value.slice(0, end)}…(afgekapt op ${maxChars} tekens)`;
}

function truncateCell(value: string): string {
  return truncateAt(value, RAW_CELL_MAX_CHARS);
}

function truncateLabel(value: string): string {
  return truncateAt(value, LABEL_MAX_CHARS);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Structurele herkenning van een XER-bronrij: een numerieke `line` plus een `cells`-kaart van
 *  louter strings. Bewust op VORM, niet op een exact sleutelaantal (review2-3d.md ronde 3, N5): de
 *  oorspronkelijke "exact twee sleutels"-eis faalde OPEN zodra een rijvorm een derde veld droeg
 *  (`XerScheduleOptionsSourceRow` = `{table, line, cells}`) — zo'n rij viel dan door naar de
 *  generieke objecttak, waar `cells` een gewoon record werd en elke celwaarde als LABEL zichtbaar
 *  kwam, zonder opt-in. Overige velden naast `line`/`cells` (zoals `table`) projecteert
 *  `projectSourceRow` gewoon mee via dezelfde poort — fail-CLOSED in plaats van fail-open. */
function isRawSourceRowLike(value: Record<string, unknown>): value is Record<string, unknown> & { line: number; cells: Record<string, string> } {
  if (typeof value.line !== 'number' || !isPlainRecord(value.cells)) return false;
  return Object.values(value.cells).every((cell) => typeof cell === 'string');
}

/** Voegt `key` toe aan `used` zonder een bestaande sleutel te overschrijven — nodig omdat
 *  afgekapte kolomnamen (`truncateLabel`) op elkaar kunnen samenvallen (review2-3d.md ronde 3, N4). */
function uniqueTruncatedKey(candidate: string, used: Set<string>): string {
  let key = candidate;
  let suffix = 1;
  while (used.has(key)) {
    key = `${candidate}#${suffix}`;
    suffix += 1;
  }
  used.add(key);
  return key;
}

/** Houdt de opgebouwde UTF-8-bytegrootte van een pagina bij TERWIJL cellen/labels geprojecteerd
 *  worden, en breekt meteen af zodra het budget vol is — vóór de dure, autoritatieve
 *  `JSON.stringify`-meting in `finalizeBounded` (review2-3d.md #6: "begroot vóór serialisatie"). Dit
 *  voorkomt dat één rij met bv. 20.000 cellen alsnog een tientallen-MB-tussenstring opbouwt: de
 *  teller breekt al af halverwege díé ene rij. */
interface ByteBudget {
  charge(text: string): void;
}
function createByteBudget(maxBytes: number): ByteBudget {
  const encoder = new TextEncoder();
  let used = 0;
  return {
    charge(text: string): void {
      used += encoder.encode(text).byteLength;
      if (used > maxBytes) {
        throw new XerProvenanceError(
          'VALIDATION',
          `Deze pagina overschrijdt de responsgrens van ${MAX_SECTION_RESPONSE_BYTES} bytes — verlaag \`limit\` of gebruik \`offset\` om te pagineren.`,
        );
      }
    },
  };
}

/** Projecteert één bronrij (`line` + `cells`, plus eventuele overige velden zoals `table`). Zonder
 *  `includeRawRows`: alleen `line` + het WERKELIJKE celaantal + de overige velden (die zelf weer door
 *  de generieke poort gaan — geen kortsluiting). Met opt-in: tot `MAX_CELLS_PER_ROW` cellen; zowel de
 *  celNAAM als de celWAARDE wordt afgekapt én budget-gecharged (review2-3d.md ronde 3, N4: een
 *  aanvaller-gecontroleerde kolomnaam van 60.001 tekens kwam voorheen verbatim mee en telde als nul
 *  in het budget). Botsende afgekapte kolomnamen krijgen een `#N`-suffix i.p.v. elkaar stil te
 *  overschrijven. Méér cellen dan de cap krijgen een expliciete `cellsTruncatedAt`-marker. */
function projectSourceRow(
  row: Record<string, unknown> & { line: number; cells: Record<string, string> },
  includeRawRows: boolean,
  budget: ByteBudget,
): unknown {
  const { line, cells, ...rest } = row;
  const fieldNames = Object.keys(cells);

  const restProjected: Record<string, unknown> = {};
  for (const [restKey, restValue] of Object.entries(rest)) {
    const sanitized = sanitizeProvenanceValue(restValue, restKey, includeRawRows, budget);
    if (sanitized !== undefined) restProjected[restKey] = sanitized;
  }

  if (!includeRawRows) {
    return { line, fieldCount: fieldNames.length, ...restProjected };
  }

  const limited = fieldNames.slice(0, MAX_CELLS_PER_ROW);
  const projectedCells: Record<string, string> = {};
  const usedCellKeys = new Set<string>();
  for (const field of limited) {
    const truncatedField = uniqueTruncatedKey(truncateLabel(field), usedCellKeys);
    budget.charge(truncatedField);
    const truncatedValue = truncateCell(cells[field]);
    budget.charge(truncatedValue);
    projectedCells[truncatedField] = truncatedValue;
  }
  const projected: Record<string, unknown> = { line, cells: projectedCells, ...restProjected };
  if (fieldNames.length > MAX_CELLS_PER_ROW) {
    projected.fieldCount = fieldNames.length;
    projected.cellsTruncatedAt = MAX_CELLS_PER_ROW;
  }
  return projected;
}

/** Zelfde cap/afkap-/opt-in-/sleutelbegroting-regime als `projectSourceRow`, voor een vrije-
 *  tekstkáárt (`customFields` e.d.) die geen `{line,cells}`-vorm heeft maar dezelfde
 *  privacy-eigenschap draagt. */
function projectFreeTextMap(map: Record<string, unknown>, includeRawRows: boolean, budget: ByteBudget): unknown {
  const keys = Object.keys(map);
  if (!includeRawRows) return { fieldCount: keys.length };
  const limited = keys.slice(0, MAX_CELLS_PER_ROW);
  const out: Record<string, string> = {};
  const usedKeys = new Set<string>();
  for (const key of limited) {
    const truncatedKey = uniqueTruncatedKey(truncateLabel(key), usedKeys);
    budget.charge(truncatedKey);
    const raw = map[key];
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const truncatedValue = truncateCell(text);
    budget.charge(truncatedValue);
    out[truncatedKey] = truncatedValue;
  }
  const projected: Record<string, unknown> = { ...out };
  if (keys.length > MAX_CELLS_PER_ROW) projected.__truncated = { fieldCount: keys.length, cellsTruncatedAt: MAX_CELLS_PER_ROW };
  return projected;
}

/**
 * DE ENE POORT (review2-3d.md, ronde 3 — deny-by-default): elke waarde die een sectiefunctie
 * teruggeeft loopt hierdoor vóór hij de respons in gaat. Regels, in volgorde:
 *   1. een string onder een sleutel die NIET in `SAFE_LABEL_KEYS` staat is zonder opt-in VOLLEDIG
 *      onzichtbaar (de sleutel verdwijnt uit het resultaat), met opt-in afgekapt op 2.000 tekens —
 *      dit is het deny-by-default-hoofdpad en dekt zo ook geneste vrije tekst (`notes[].text`) zonder
 *      dat de context expliciet hoeft te worden doorgegeven: de LEAF-sleutel (`text`) bepaalt het lot;
 *   2. een string onder een `SAFE_LABEL_KEYS`-sleutel blijft ALTIJD zichtbaar maar hard afgekapt op
 *      200 tekens (labels/namen/ids/codes/enum-tokens);
 *   3. een object dat STRUCTUREEL een XER-bronrij is (`line`+string-`cells`, zie `isRawSourceRowLike`)
 *      gaat via `projectSourceRow`, ongeacht waar in de boom hij zit en ongeacht overige velden;
 *   4. een object onder een vrije-tekstkáárt-sleutel (`customFields`) gaat via `projectFreeTextMap`;
 *   5. arrays en overige objecten recurseren; getallen/booleans/`null` gaan ongewijzigd mee.
 * Nooit een alias naar de bevroren archiefstate: elke tak bouwt een vers object/array op, dus er is
 * ook geen `structuredClone` meer nodig zoals de oude `page()` die had.
 */
function sanitizeProvenanceValue(value: unknown, key: string | null, includeRawRows: boolean, budget: ByteBudget): unknown {
  if (typeof value === 'string') {
    const isSafeLabel = key !== null && SAFE_LABEL_KEYS.has(key);
    if (!isSafeLabel) {
      if (!includeRawRows) return undefined;
      const truncated = truncateCell(value);
      budget.charge(truncated);
      return truncated;
    }
    const truncated = truncateLabel(value);
    budget.charge(truncated);
    return truncated;
  }
  if (Array.isArray(value)) {
    // review2-3d.md ronde 4, R7: een verborgen string-element mapt anders naar `undefined` → `null`
    // in JSON (`[null, null]`) — geen lek, maar onduidelijk voor de lezer. Verborgen elementen eruit
    // filteren i.p.v. ze als `null` te laten staan.
    return value
      .map((item) => sanitizeProvenanceValue(item, key, includeRawRows, budget))
      .filter((item) => item !== undefined);
  }
  if (isPlainRecord(value)) {
    if (isRawSourceRowLike(value)) {
      return projectSourceRow(value, includeRawRows, budget);
    }
    if (key !== null && FREE_TEXT_MAP_KEYS.has(key)) {
      return projectFreeTextMap(value, includeRawRows, budget);
    }
    // review2-3d.md ronde 4, R8: dezelfde afkap-/budgetbehandeling voor de SLEUTEL als voor de
    // waarde — anders overleeft een bronvrije sleutel (bv. een 80.000-tekens proj_id die als
    // objectsleutel wordt gebruikt, zoals `catalogCounts.taskSourceRowsByProject`) altijd zodra zijn
    // waarde overleeft, want een getal overleeft altijd.
    const out: Record<string, unknown> = {};
    const usedKeys = new Set<string>();
    for (const [childKey, childValue] of Object.entries(value)) {
      const sanitized = sanitizeProvenanceValue(childValue, childKey, includeRawRows, budget);
      if (sanitized === undefined) continue;
      const truncatedKey = uniqueTruncatedKey(truncateLabel(childKey), usedKeys);
      budget.charge(truncatedKey);
      out[truncatedKey] = sanitized;
    }
    return out;
  }
  return value;
}

/** Autoritatieve, echte-bytes backstop (review2-3d.md #4): meet de UITEINDELIJKE geserialiseerde
 *  respons met `TextEncoder`, niet `String.length`. De budget-tijdens-projectie hierboven vangt de
 *  dominante kosten al vroeg af; dit is de correctheidsgarantie voor de rest (JSON-structuuroverhead,
 *  velden die niet via de budget-charge liepen). */
function finalizeBounded<T extends Record<string, unknown>>(result: T): T {
  const byteLength = new TextEncoder().encode(JSON.stringify(result)).length;
  if (byteLength > MAX_SECTION_RESPONSE_BYTES) {
    throw new XerProvenanceError(
      'VALIDATION',
      `Deze pagina overschrijdt de responsgrens van ${MAX_SECTION_RESPONSE_BYTES} bytes geserialiseerd — verlaag \`limit\` of gebruik \`offset\` om te pagineren.`,
    );
  }
  return result;
}

function readTool(ctx: McpContext, fn: (state: AppState) => unknown): McpToolResult {
  const captured: { error: XerProvenanceError | null } = { error: null };
  const result = runReadTool(ctx, (state) => {
    try {
      return fn(state);
    } catch (error) {
      if (error instanceof XerProvenanceError) {
        captured.error = error;
        return undefined;
      }
      throw error;
    }
  });
  return captured.error
    ? toolError(ctx, captured.error.code, captured.error.message)
    : result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireOnlyKeys(args: unknown): XerProvenanceArgs {
  if (args === undefined || args === null) return {};
  if (!isObject(args)) throw new XerProvenanceError('VALIDATION', 'inspect_xer_provenance verwacht een object met argumenten.');
  const allowed = ['section', 'collection', 'projectId', 'limit', 'offset', 'includeRawSource', 'includeRawRows'];
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) {
      throw new XerProvenanceError('VALIDATION', `onbekend argument \`${key}\` voor inspect_xer_provenance; toegestaan: ${allowed.join(', ')}.`);
    }
  }
  return args;
}

interface PageOptions {
  /** Verlaagt de generieke bovengrens van 1000; gebruikt voor `rawSource` (8 chunks) en de
   *  `includeRawRows`-opt-in (100 rijen). */
  maxLimit?: number;
  /** Naam voor de foutmelding zodra `limit` de verlaagde grens overschrijdt. */
  label?: string;
  /** Eenheid in de foutmelding ("chunks" voor rawSource, "rijen" voor raw rows). */
  unit?: string;
}

function requirePage(args: XerProvenanceArgs, options: PageOptions = {}): { limit: number; offset: number } {
  const maxLimit = options.maxLimit ?? 1000;
  const limit = args.limit === undefined ? 50 : args.limit;
  const offset = args.offset === undefined ? 0 : args.offset;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    if (options.label) {
      // Een expliciete raw-data-call mag nooit ongemerkt een onbeperkte respons worden. Boven deze
      // grens moet de client nog een pagina opvragen.
      throw new XerProvenanceError(
        'VALIDATION',
        `\`${options.label}\` accepteert maximaal ${maxLimit} ${options.unit ?? 'items'} per antwoord; gebruik offset voor volgende pagina's.`,
      );
    }
    throw new XerProvenanceError('VALIDATION', `\`limit\` moet een geheel getal van 1 t/m ${maxLimit} zijn.`);
  }
  if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
    throw new XerProvenanceError('VALIDATION', '`offset` moet een geheel getal ≥ 0 zijn.');
  }
  return { limit, offset };
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new XerProvenanceError('VALIDATION', `\`${name}\` moet een niet-lege string zijn.`);
  }
  return value;
}

interface Paginated<T> {
  readonly slice: readonly T[];
  readonly total: number;
  readonly offset: number;
}

/** Slice EERST (op de ongesaneerde bron), sanitize DAARNA alleen de teruggegeven pagina — nooit
 *  andersom. Werk is zo ∝ `limit`, niet ∝ collectiegrootte, en de budget-tijdens-projectie hierboven
 *  charged alleen wat ook echt de respons in gaat. */
function paginateRaw<T>(items: readonly T[], args: XerProvenanceArgs, options: PageOptions = {}): Paginated<T> {
  const { limit, offset } = requirePage(args, options);
  return { slice: items.slice(offset, offset + limit), total: items.length, offset };
}

function envelope(paged: Paginated<unknown>, items: unknown[]): {
  items: unknown[];
  total: number;
  has_more: boolean;
  next_offset: number | null;
} {
  const next = paged.offset + items.length;
  return {
    items,
    total: paged.total,
    has_more: next < paged.total,
    next_offset: next < paged.total ? next : null,
  };
}

function collectionOf<T>(section: Section, collection: unknown, allowed: readonly string[], value: T): T {
  if (typeof collection !== 'string' || !allowed.includes(collection)) {
    throw new XerProvenanceError(
      'VALIDATION',
      `${section} vereist \`collection\` uit: ${allowed.join(', ')}.`,
    );
  }
  return value;
}

/** ÉÉN selectorbron (review2-3d.md #5): de unie van `documentViews` (daadwerkelijk geopende
 *  projecten) en `taskSourceRowsByProject` (elk project met TASK-rijen, óók leeg/baseline-
 *  uitgesloten). Vóór deze fix keurde de generieke `projectId`-precheck alleen `documentViews` goed,
 *  terwijl `summary.catalogCounts.taskSourceRowsByProject` bredere projecten adverteerde die de tool
 *  vervolgens zelf met NOT_FOUND weigerde. */
function projectIds(archive: XerSourceArchive): string[] {
  const ids = new Set<string>([
    ...Object.keys(archive.diagnostics.documentViews),
    ...Object.keys(archive.readModel.taskSourceRowsByProject),
  ]);
  return Array.from(ids).sort();
}

function requireArchive(state: AppState): XerSourceArchive {
  if (!state.xerSourceArchive) {
    throw new XerProvenanceError('NOT_FOUND', 'Het actieve document bevat geen retained XER-bron.');
  }
  return state.xerSourceArchive;
}

function validateProjectSelector(archive: XerSourceArchive, projectId: unknown): string | undefined {
  if (projectId === undefined) return undefined;
  const selected = requireString(projectId, 'projectId');
  if (!projectIds(archive).includes(selected)) {
    throw new XerProvenanceError('NOT_FOUND', `Onbekende XER-projectselector: ${selected}.`);
  }
  return selected;
}

function summary(state: AppState, archive: XerSourceArchive | null): unknown {
  if (!archive) {
    // review2-3d.md ronde 4, R9: `state.xerSourceProjectId` is GEEN statische tekst — het is een
    // documentveld dat uit het bestand komt en de IFC-round-trip overleeft, dus hoort net als elke
    // andere bronstring door de poort + responsgrens. Alleen de hardcoded systeemmelding (`note`) is
    // echt statisch; die wordt bewust NA het saneren toegevoegd (anders zou de sleutel `note` — niet
    // op `SAFE_LABEL_KEYS`, met reden — zichzelf verbergen).
    const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
    const sanitized = sanitizeProvenanceValue(
      { sourcePresent: false, source: null, selector: { currentProjectId: state.xerSourceProjectId, availableProjectIds: [] } },
      null,
      false,
      budget,
    ) as Record<string, unknown>;
    sanitized.note = 'Er is voor dit document geen retained XER-bronarchief beschikbaar.';
    return finalizeBounded(sanitized);
  }
  const readModel = archive.readModel;
  const file = archive.diagnostics.file;
  const table = file.tableReport;
  const metadata = readModel.metadataCatalog;
  const resources = readModel.resourceCatalog;
  const schedule = state.xerImportMetadata?.scheduleOptions;
  const ids = projectIds(archive);
  const raw = {
    sourcePresent: true,
    source: {
      format: archive.format,
      schemaVersion: archive.schemaVersion,
      byteLength: archive.byteLength,
      sha256: archive.sha256,
      digest: { algorithm: 'SHA-256', value: archive.sha256 },
      encoding: archive.encoding,
      bom: archive.bom,
      newline: archive.newline,
      byteChunkCount: archive.byteChunks.length,
    },
    selector: {
      currentProjectId: state.xerSourceProjectId ?? state.xerImportMetadata?.sourceProjectId ?? null,
      availableProjectIds: ids,
    },
    numberFormat: readModel.numberFormat,
    schedoptions: {
      source: schedule?.source ?? 'xer-defaults',
      retainedSource: schedule?.retainedSource ?? {},
      mappedProgressMode: state.project.progressMode,
      mappedSchedulingOptions: state.project.schedulingOptions ?? null,
      sourceRowCount: schedule?.sourceRows.length ?? 0,
      fallbackCount: schedule?.fallbacks.length ?? 0,
      diagnosticCount: schedule?.diagnostics.length ?? 0,
    },
    importReport: file.importReport,
    diagnostics: {
      tableIssueCount: table.issues.length,
      unknownTableCount: table.unknownTables.length,
      unknownFieldCount: table.unknownFields?.length ?? 0,
      scheduleOptionsCount: file.scheduleOptions.length,
      relationResolutionIssueCount: file.relationResolutionIssues.length,
      resourceCatalogIssueCount: file.resourceCatalogIssues.length,
      metadataCatalogIssueCount: file.metadataCatalogIssues.length,
    },
    catalogCounts: {
      resourceCatalog: {
        resources: resources.resources.length,
        identities: resources.identities.length,
        resourceSources: resources.rows.resources.length,
        roleSources: resources.rows.roles.length,
        rates: resources.rows.rates.length,
        curves: resources.rows.curves.length,
        assignmentSources: resources.rows.assignments.length,
        issues: resources.issues.length,
      },
      metadataCatalog: {
        activityCodeTypes: metadata.activityCodeTypes.length,
        customFieldDefs: metadata.customFieldDefs.length,
        taskProjections: metadata.taskProjections.length,
        issues: metadata.issues.length,
        sourceData: Object.fromEntries(Object.entries(metadata.sourceData).map(([name, rows]) => [name, rows.length])),
      },
      taskSourceRowsByProject: Object.fromEntries(
        Object.entries(readModel.taskSourceRowsByProject).map(([projectId, rows]) => [projectId, rows.length]),
      ),
    },
  };
  // Review2-3d.md ronde 3, N3: `summary` (de default-sectie!) liep door GEEN van beide poorten —
  // `numberFormat.currencyCode` kwam onafgekapt mee en `importReport` was een LEVENDE ALIAS naar het
  // bevroren archief (het kopcommentaar van `sanitizeProvenanceValue` belooft "nooit een alias"; dit
  // was de ene plek die dat niet waarmaakte). `summary` zit niet in `RAW_ROWS_SECTIONS`, dus
  // `includeRawRows` is hier altijd `false` — vrije tekst is dus altijd volledig onzichtbaar, nooit
  // slechts afgekapt, precies zoals de sectie altijd al beloofde ("bewust vrij van raw rows").
  const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
  const sanitized = sanitizeProvenanceValue(raw, null, false, budget) as Record<string, unknown>;
  return finalizeBounded(sanitized);
}

function resourceCatalog(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  const catalog = archive.readModel.resourceCatalog;
  const collection = collectionOf('resourceCatalog', args.collection, RESOURCE_COLLECTIONS, args.collection as Collection);
  const values: Record<Collection, readonly unknown[]> = {
    resources: catalog.resources,
    identities: catalog.identities,
    resourceSources: catalog.rows.resources,
    roleSources: catalog.rows.roles,
    rates: catalog.rows.rates,
    curves: catalog.rows.curves,
    assignmentSources: catalog.rows.assignments,
    issues: catalog.issues,
  } as Record<Collection, readonly unknown[]>;
  const includeRawRows = args.includeRawRows === true;
  const pageOptions: PageOptions = includeRawRows
    ? { maxLimit: RAW_ROWS_OPT_IN_MAX_LIMIT, label: 'includeRawRows', unit: 'rijen' }
    : {};
  const paged = paginateRaw(values[collection], args, pageOptions);
  const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
  const items = paged.slice.map((item) => sanitizeProvenanceValue(item, null, includeRawRows, budget));
  return finalizeBounded({ section: 'resourceCatalog', collection, ...envelope(paged, items) });
}

function metadataCatalog(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  const catalog = archive.readModel.metadataCatalog;
  const collection = collectionOf('metadataCatalog', args.collection, METADATA_COLLECTIONS, args.collection as Collection);
  const values: Record<string, readonly unknown[]> = {
    activityCodeTypes: catalog.activityCodeTypes,
    customFieldDefs: catalog.customFieldDefs,
    taskProjections: catalog.taskProjections,
    issues: catalog.issues,
    ...catalog.sourceData,
  };
  const includeRawRows = args.includeRawRows === true;
  const pageOptions: PageOptions = includeRawRows
    ? { maxLimit: RAW_ROWS_OPT_IN_MAX_LIMIT, label: 'includeRawRows', unit: 'rijen' }
    : {};
  const paged = paginateRaw(values[collection] ?? [], args, pageOptions);
  const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
  const items = paged.slice.map((item) => sanitizeProvenanceValue(item, null, includeRawRows, budget));
  return finalizeBounded({ section: 'metadataCatalog', collection, ...envelope(paged, items) });
}

function diagnostics(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  const file = archive.diagnostics.file;
  const collection = collectionOf('diagnostics', args.collection, DIAGNOSTIC_COLLECTIONS, args.collection as Collection);
  const includeRawRows = args.includeRawRows === true;
  if (collection === 'importReport') {
    if (args.limit !== undefined || args.offset !== undefined) {
      throw new XerProvenanceError('VALIDATION', '`limit` en `offset` horen niet bij diagnostics/importReport.');
    }
    // Review2-3d.md #3/#6: ook het scalaire importReport-pad loopt nu door de poort + responsgrens —
    // structureel onbegrensd blijven is fout, ongeacht wat het type vandaag toevallig bevat.
    const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
    const report = sanitizeProvenanceValue(file.importReport, null, includeRawRows, budget);
    return finalizeBounded({ section: 'diagnostics', collection, report });
  }
  const values: Record<string, readonly unknown[]> = {
    tableIssues: file.tableReport.issues,
    unknownTables: file.tableReport.unknownTables,
    unknownFields: file.tableReport.unknownFields ?? [],
    scheduleOptions: file.scheduleOptions,
    relationResolutionIssues: file.relationResolutionIssues,
    resourceCatalogIssues: file.resourceCatalogIssues,
    metadataCatalogIssues: file.metadataCatalogIssues,
    // Draagt via `resources.assignments[].rawRow` dezelfde vrije XER-cellen als de andere secties
    // (review2-3d.md #1) — `sanitizeProvenanceValue` vindt die structureel, ook zonder dat deze
    // regel er iets specifieks voor doet.
    documentViews: Object.entries(archive.diagnostics.documentViews).sort(([left], [right]) => left.localeCompare(right)).map(([projectId, view]) => ({ projectId, view })),
  };
  const pageOptions: PageOptions = includeRawRows
    ? { maxLimit: RAW_ROWS_OPT_IN_MAX_LIMIT, label: 'includeRawRows', unit: 'rijen' }
    : {};
  const paged = paginateRaw(values[collection], args, pageOptions);
  const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
  const items = paged.slice.map((item) => sanitizeProvenanceValue(item, null, includeRawRows, budget));
  return finalizeBounded({
    section: 'diagnostics',
    collection,
    ...(collection === 'tableIssues' ? { encoding: file.tableReport.encoding, endMarkerSeen: file.tableReport.endMarkerSeen } : {}),
    ...envelope(paged, items),
  });
}

function taskSourceRows(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  const projectId = requireString(args.projectId, 'projectId');
  if (!Object.prototype.hasOwnProperty.call(archive.readModel.taskSourceRowsByProject, projectId)) {
    throw new XerProvenanceError('NOT_FOUND', `Onbekende XER-projectselector: ${projectId}.`);
  }
  const includeRawRows = args.includeRawRows === true;
  const rows = archive.readModel.taskSourceRowsByProject[projectId] ?? [];
  const pageOptions: PageOptions = includeRawRows
    ? { maxLimit: RAW_ROWS_OPT_IN_MAX_LIMIT, label: 'includeRawRows', unit: 'rijen' }
    : {};
  const paged = paginateRaw(rows, args, pageOptions);
  const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
  const items = paged.slice.map((row) => sanitizeProvenanceValue(row, null, includeRawRows, budget));
  return finalizeBounded({ section: 'taskSourceRowsByProject', projectId, ...envelope(paged, items) });
}

function rawSource(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  if (args.includeRawSource !== true) {
    throw new XerProvenanceError('VALIDATION', 'rawSource vereist `includeRawSource: true`; bronbytes kunnen namen en vrije notities bevatten.');
  }
  const paged = paginateRaw(archive.byteChunks, args, { maxLimit: 8, label: 'rawSource', unit: 'chunks' });
  const next = paged.offset + paged.slice.length;
  return {
    section: 'rawSource',
    privacy: 'expliciet aangevraagd; base64-brondata kan vrije projectinformatie bevatten',
    byteLength: archive.byteLength,
    sha256: archive.sha256,
    encoding: 'base64',
    chunkSizeBytes: XER_SOURCE_ARCHIVE_CHUNK_BYTES,
    totalChunks: archive.byteChunks.length,
    chunks: paged.slice.map((base64, index) => ({ index: paged.offset + index, base64 })),
    total: paged.total,
    has_more: next < paged.total,
    next_offset: next < paged.total ? next : null,
  };
}

function inspect(state: AppState, rawArgs: unknown): unknown {
  const args = requireOnlyKeys(rawArgs);
  if (args.section !== undefined && (typeof args.section !== 'string' || !(SECTIONS as readonly string[]).includes(args.section))) {
    throw new XerProvenanceError('VALIDATION', `\`section\` moet één van ${SECTIONS.join(', ')} zijn.`);
  }
  if (args.includeRawSource !== undefined && typeof args.includeRawSource !== 'boolean') {
    throw new XerProvenanceError('VALIDATION', '`includeRawSource` moet een boolean zijn.');
  }
  if (args.includeRawRows !== undefined && typeof args.includeRawRows !== 'boolean') {
    throw new XerProvenanceError('VALIDATION', '`includeRawRows` moet een boolean zijn.');
  }
  const section = (args.section ?? 'summary') as Section;
  const archive = state.xerSourceArchive;
  if (args.projectId !== undefined && (typeof args.projectId !== 'string' || args.projectId.trim() === '')) {
    throw new XerProvenanceError('VALIDATION', '`projectId` moet een niet-lege string zijn.');
  }
  if (section !== 'rawSource' && args.includeRawSource !== undefined) {
    throw new XerProvenanceError('VALIDATION', '`includeRawSource` hoort alleen bij section `rawSource`.');
  }
  if (args.includeRawRows !== undefined && !RAW_ROWS_SECTIONS.includes(section)) {
    throw new XerProvenanceError(
      'VALIDATION',
      '`includeRawRows` hoort alleen bij section `resourceCatalog`, `metadataCatalog`, `taskSourceRowsByProject` of `diagnostics`.',
    );
  }
  if (section === 'summary') {
    if (args.collection !== undefined) throw new XerProvenanceError('VALIDATION', '`collection` hoort niet bij section `summary`.');
    if (args.limit !== undefined || args.offset !== undefined) throw new XerProvenanceError('VALIDATION', '`limit` en `offset` horen niet bij section `summary`.');
    if (args.projectId !== undefined && archive) validateProjectSelector(archive, args.projectId);
    return summary(state, archive);
  }
  if (args.projectId !== undefined && archive) validateProjectSelector(archive, args.projectId);
  const selected = requireArchive(state);
  if (section === 'rawSource') {
    if (args.collection !== undefined || args.projectId !== undefined) throw new XerProvenanceError('VALIDATION', '`rawSource` neemt alleen includeRawSource, limit en offset.');
    return rawSource(selected, args);
  }
  if (section === 'taskSourceRowsByProject') {
    if (args.collection !== undefined) throw new XerProvenanceError('VALIDATION', '`collection` hoort niet bij section `taskSourceRowsByProject`.');
    return taskSourceRows(selected, args);
  }
  if (section === 'resourceCatalog') return resourceCatalog(selected, args);
  if (section === 'metadataCatalog') return metadataCatalog(selected, args);
  if (section === 'diagnostics') return diagnostics(selected, args);
  throw new XerProvenanceError('VALIDATION', `Onbekende section: ${section}.`);
}

const inputSchema = {
  type: 'object',
  properties: {
    section: { type: 'string', enum: [...SECTIONS], description: 'Inspectieonderdeel; default summary.' },
    collection: { type: 'string', enum: [...ALL_COLLECTIONS], description: 'Gepagineerde collectie binnen resourceCatalog, metadataCatalog of diagnostics.' },
    projectId: { type: 'string', description: 'Verplichte expliciete XER-projectselector voor taskSourceRowsByProject.' },
    limit: { type: 'number', description: 'Aantal items/chunks; default 50, rawSource maximaal 8, includeRawRows maximaal 100.' },
    offset: { type: 'number', description: 'Startindex; default 0.' },
    includeRawSource: { type: 'boolean', description: 'Verplicht true voor de expliciete rawSource-sectie.' },
    includeRawRows: {
      type: 'boolean',
      description:
        'Alleen bij resourceCatalog/metadataCatalog/taskSourceRowsByProject/diagnostics: ontgrendelt ' +
        'vrije-tekstvelden (notities, customFields, willekeurige XER-kolommen) i.p.v. ze weg te laten, ' +
        'met een lagere paginalimiet (100), een cap van 200 cellen/velden per rij en per-cel-afkapping ' +
        'op 2.000 tekens. Korte label-/naamvelden blijven ALTIJD zichtbaar maar afgekapt op 200 tekens,' +
        ' met of zonder deze opt-in.',
    },
  },
  additionalProperties: false,
} as const;

export const xerProvenanceTools: McpToolDef[] = [{
  name: 'planner_inspect_xer_provenance',
  description:
    'Bounded read-only inspectie van retained Primavera P6/XER-bronsemantiek. `section` is summary ' +
    '(bronaanwezigheid, byteLength, SHA-256, chunk count, selector, number format, SCHEDOPTIONS-, ' +
    'import- en diagnostiektellingen), resourceCatalog, metadataCatalog, taskSourceRowsByProject, ' +
    'diagnostics of rawSource. Cataloguscollecties zijn expliciet benoemd en gepagineerd met `limit`, ' +
    '`offset`, `total`, `has_more` en `next_offset`. `selector.availableProjectIds` (summary) is de ' +
    'unie van geopende documentviews en elk project met TASK-rijen (óók leeg/baseline-uitgesloten) — ' +
    'exact de projecten die `taskSourceRowsByProject` accepteert. DENY-BY-DEFAULT voor elke string: ' +
    'alleen expliciet als id/code/label/enum-token herkende velden (namen, ids, codes, eenheden, ' +
    'currencyCode, …) blijven zonder `includeRawRows:true` zichtbaar, en dan hard afgekapt op 200 ' +
    'tekens. Elke andere string — ruwe XER-cellen, notities, `customFields`-waarden, en ook onbekende ' +
    'of geneste vrije tekst zoals een taaknotitie-array — is zonder de opt-in VOLLEDIG ONZICHTBAAR, ' +
    'met opt-in afgekapt op 2.000 tekens. Dit geldt voor élke string in élke sectie, inclusief ' +
    '`summary` zelf en `diagnostics/documentViews`. Met opt-in gelden een lagere paginalimiet (100) en ' +
    'een cap van 200 cellen/velden per rij; zowel celWAARDEN als celNAMEN (kolomkoppen uit het ' +
    'bronbestand) zijn afgekapt en tellen mee in de responsbegroting. Elke pagina — óók summary — ' +
    'kent een harde responsgrens (256 kB, gemeten in echte UTF-8-bytes). rawSource vereist expliciet ' +
    '`includeRawSource:true`, geeft maximaal acht vaste base64-chunks per antwoord en meldt de ' +
    'privacygrens. De tool gebruikt alleen retained state, muteert de store niet, voert geen CPM uit ' +
    'en ondersteunt geen schrijfpad. Niet batchable: roep hem los aan, nooit als stap in `planner_batch`.',
  kind: 'read',
  batchable: false,
  inputSchema,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: (args, ctx) => readTool(ctx, (state) => inspect(state, args)),
}];
