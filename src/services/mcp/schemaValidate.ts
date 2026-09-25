// MCP-bridge — RUNTIME-validatie van tool-argumenten tegen de `inputSchema` van de tool.
//
// WAAROM DIT BESTAAT (systemische root-cause uit de 33-tool-audit): de dispatcher riep
// `def.handler(args, ctx)` aan ZONDER het schema ooit te raadplegen. Elke `enum`, `type`, `required`,
// `minimum`, `pattern` en `additionalProperties` in de 33 schema's was daarmee puur decoratief: het
// ging mee in `tools/list` (waar de AI hem leest en zich er dus naar richt) en verder nergens heen.
// Alles wat een tool niet zélf nogmaals controleerde, gleed er ongezien doorheen — de bron van de
// hele klasse "tool antwoordt `ok`, maar deed niets".
//
// SCOPE — bewust GEEN volledige JSON-Schema-implementatie en bewust GEEN dependency. De 33 schema's
// gebruiken samen precies twaalf trefwoorden (geïnventariseerd, zie `SUPPORTED_KEYWORDS`); dit is een
// klein, gesloten probleem. Wat we dekken:
//   type (incl. de array-vorm `['string','null']`), enum, required, properties,
//   additionalProperties (alleen `false`), items, minItems, maxItems,
//   minimum, maximum, exclusiveMinimum, pattern.
// Wat we BEWUST NIET dekken (en dus stil negeren i.p.v. half-verkeerd afdwingen): $ref/definities,
// oneOf/anyOf/allOf/not, if/then/else, dependent*, patternProperties, propertyNames, contains,
// uniqueItems, minLength/maxLength, format, const, default, multipleOf, exclusiveMaximum,
// minProperties/maxProperties. Zodra een schema er één van gaat gebruiken moet die hier landen —
// `assertSchemaKeywordsSupported` (zie tests) bewaakt dat.
//
// SEMANTIEK: trefwoorden gelden PER INSTANTIETYPE, precies zoals JSON Schema voorschrijft.
// `required`/`properties` doen niets op een niet-object, `items`/`minItems` niets op een niet-array,
// `minimum` niets op een niet-getal. Dat is geen detail: `constraint` is `type: ['object','null']`
// mét `required: ['type']` — zou `required` ook op `null` slaan, dan werd wissen met `null` ineens
// een fout.
//
// FOUTVORM: elke schending noemt het PAD én de verwachting, bijv.
// `updates[0].fields.duration: verwacht number, kreeg string "10"`. Nooit een kale TypeError.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// DIEPTE-REGEL — NIET OMDRAAIEN ZONDER DE SPEC TE WIJZIGEN.
//
// De bulk-conventie van de bridge (spec §batch, T19/T20) is: ÉÉN ROTTE REGEL ROLT DE BULK NOOIT
// TERUG. Vijf kalenders waarvan er één een fout `generate.country` heeft, horen vier verwerkte
// kalenders + één `itemRejections`-regel op te leveren — niet vijf mislukkingen. Zou deze poort de
// BINNENKANT van array-items hard afkeuren, dan zou hij die conventie stilzwijgend omdraaien voor
// elke bulk-tool. Daarom:
//
//   * BOVENSTE NIVEAU — STRIKT. Onbekende top-level sleutels, `required`, scalaire argumenten en de
//     BUITENKANT van arrays (is het een array? `minItems`/`maxItems`? is elk element van het door
//     `items.type` gevraagde type?) worden hard afgedwongen. Dat zijn vormfouten van de CALL, niet
//     van één regel erin, en de tool kan er sowieso niets zinnigs mee.
//   * BINNENKANT VAN ARRAY-ITEMS — AAN DE TOOL. Properties/enum/required/pattern binnen een
//     array-item slaat deze validator standaard over; de handlers hebben daar allemaal hun eigen
//     allowlist met PER-ITEM-weigering (`taskFields.ts`, `parseProgress`, `parseLag`, de kalender-/
//     resource-tools). Zo blijft één rot item één `itemRejections`-regel.
//   * UITZONDERING — `ATOMIC_ITEM_TOOLS`. Een tool wier contract per definitie ALLES-OF-NIETS is,
//     kent geen per-item-weigering; daar is een harde VALIDATION juist correct. Vandaag zijn dat
//     `planner_add_tasks` — zijn contract is de VOLLEDIGE tempId→realId-map, dus een half geslaagde
//     call is voor de aanroeper onbruikbaar (een onbekend veld in één item laat de hele call falen) —
//     en `planner_set_task_splits`, dat de hele onderbrekingenlijst van één taak vervangt.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Trefwoorden die deze validator daadwerkelijk afdwingt (de rest wordt genegeerd). */
export const SUPPORTED_KEYWORDS: readonly string[] = [
  'type',
  'enum',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'pattern',
];

/** Trefwoorden die puur documentatie zijn en dus geen validatie-betekenis hoeven te hebben. */
const DOC_KEYWORDS: readonly string[] = ['description', 'title', 'examples', 'default'];

/**
 * Tools wier contract ALLES-OF-NIETS is en die dus géén per-item-weigering kennen: daar mag (en
 * moet) de schemapoort óók de binnenkant van array-items hard afkeuren. Zie de DIEPTE-REGEL boven.
 * Voeg hier alleen een tool aan toe die aantoonbaar geen `itemRejections` kan teruggeven.
 */
export const ATOMIC_ITEM_TOOLS: ReadonlySet<string> = new Set(['planner_add_tasks', 'planner_set_task_splits']);

type Json = unknown;

/** JSON-typenaam van een waarde, in de termen die JSON Schema gebruikt. */
function jsonType(v: Json): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'number') return Number.isInteger(v as number) ? 'integer' : 'number';
  return t; // string | boolean | object | undefined | function | symbol | bigint
}

/** Korte, veilige weergave van de ONTVANGEN waarde voor in de foutmelding. */
function show(v: Json): string {
  if (v === undefined) return 'undefined';
  let s: string;
  try {
    s = JSON.stringify(v) ?? String(v);
  } catch {
    s = String(v);
  }
  return s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

/** Typenaam zoals we hem in "kreeg X" tonen (integer telt daar gewoon als number). */
function gotLabel(v: Json): string {
  const t = jsonType(v);
  return `${t === 'integer' ? 'number' : t} ${show(v)}`;
}

function isPlainObject(v: Json): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Voldoet `v` aan één schema-typenaam? `number` accepteert ook gehele getallen; `integer` niet andersom. */
function matchesType(v: Json, want: string): boolean {
  switch (want) {
    case 'null': return v === null;
    case 'array': return Array.isArray(v);
    case 'object': return isPlainObject(v);
    case 'string': return typeof v === 'string';
    case 'boolean': return typeof v === 'boolean';
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'integer': return typeof v === 'number' && Number.isInteger(v);
    default: return true; // onbekende typenaam: niet afdwingen (zie SCOPE)
  }
}

function joinPath(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}

/** Zet een pad + boodschap om in één regel; het lege pad (de argumenten zelf) heet `arguments`. */
function violation(path: string, message: string): string {
  return `${path || 'arguments'}: ${message}`;
}

/**
 * Valideer `value` tegen `schema` en verzamel ALLE schendingen (geen fail-fast: een agent die drie
 * dingen fout doet wil dat in één beurt horen).
 */
function walk(schema: Json, value: Json, path: string, out: string[], deepArrayItems: boolean): void {
  if (!isPlainObject(schema)) return;

  // --- type -------------------------------------------------------------------------------------
  const t = schema.type;
  if (typeof t === 'string' || Array.isArray(t)) {
    const wanted = (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string');
    if (wanted.length > 0 && !wanted.some((w) => matchesType(value, w))) {
      out.push(violation(path, `verwacht ${wanted.join(' of ')}, kreeg ${gotLabel(value)}`));
      // Type klopt niet ⇒ de overige trefwoorden zouden alleen ruis opleveren.
      return;
    }
  }

  // --- enum -------------------------------------------------------------------------------------
  if (Array.isArray(schema.enum)) {
    const allowed = schema.enum as Json[];
    // Vergelijking op primitieven (alle enums in deze bridge zijn strings/null) — JSON-gelijkheid
    // als vangnet voor het onwaarschijnlijke geval van een samengestelde enum-waarde.
    const hit = allowed.some((a) => a === value || (typeof a === 'object' && JSON.stringify(a) === JSON.stringify(value)));
    if (!hit) {
      out.push(violation(path, `moet één van [${allowed.map((a) => show(a)).join(', ')}] zijn, kreeg ${show(value)}`));
    }
  }

  // --- string-trefwoorden -----------------------------------------------------------------------
  if (typeof value === 'string' && typeof schema.pattern === 'string') {
    let re: RegExp | null = null;
    try { re = new RegExp(schema.pattern); } catch { re = null; }
    if (re && !re.test(value)) {
      out.push(violation(path, `voldoet niet aan het verwachte patroon /${schema.pattern}/, kreeg ${show(value)}`));
    }
  }

  // --- getal-trefwoorden ------------------------------------------------------------------------
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      out.push(violation(path, `moet ≥ ${schema.minimum} zijn, kreeg ${value}`));
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      out.push(violation(path, `moet ≤ ${schema.maximum} zijn, kreeg ${value}`));
    }
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
      out.push(violation(path, `moet > ${schema.exclusiveMinimum} zijn, kreeg ${value}`));
    }
  }

  // --- array-trefwoorden ------------------------------------------------------------------------
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      out.push(violation(path, `verwacht minstens ${schema.minItems} item(s), kreeg ${value.length}`));
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      out.push(violation(path, `verwacht hoogstens ${schema.maxItems} item(s), kreeg ${value.length}`));
    }
    if (isPlainObject(schema.items)) {
      for (let i = 0; i < value.length; i++) {
        if (deepArrayItems) {
          walk(schema.items, value[i], `${path}[${i}]`, out, true);
        } else {
          // DIEPTE-REGEL: alleen de BUITENKANT van het element (het type). De inhoud is aan de tool,
          // die er een per-item-weigering van maakt in plaats van de hele bulk om te gooien.
          walk({ type: (schema.items as Record<string, Json>).type }, value[i], `${path}[${i}]`, out, false);
        }
      }
    }
  }

  // --- object-trefwoorden -----------------------------------------------------------------------
  if (isPlainObject(value)) {
    const props = isPlainObject(schema.properties) ? schema.properties : undefined;
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (typeof key !== 'string') continue;
        if (!(key in value) || value[key] === undefined) {
          out.push(violation(path, `verplicht veld \`${key}\` ontbreekt`));
        }
      }
    }
    if (schema.additionalProperties === false && props) {
      const allowed = Object.keys(props);
      for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) {
          out.push(violation(path, `onbekend veld \`${key}\`; toegestaan: ${allowed.join(', ')}`));
        }
      }
    }
    if (props) {
      for (const [key, sub] of Object.entries(props)) {
        if (!(key in value) || value[key] === undefined) continue;
        walk(sub, value[key], joinPath(path, key), out, deepArrayItems);
      }
    }
  }
}

/**
 * Valideer tool-argumenten tegen het `inputSchema`.
 *
 * Retourneert `null` bij geldige invoer, anders één leesbare boodschap met ALLE schendingen
 * (pad + verwachting, gescheiden door `; `).
 *
 * `undefined`/`null` als argumentenblok telt als `{}` — dat is precies wat elke handler zelf al doet
 * (`(args ?? {})`), en het geeft bij een ontbrekend verplicht veld een véél bruikbaardere melding
 * ("verplicht veld `ids` ontbreekt") dan "verwacht object, kreeg undefined".
 *
 * `opts.deepArrayItems` (DEFAULT FALSE — zie de DIEPTE-REGEL boven): standaard wordt van array-items
 * alleen het TYPE gecontroleerd, zodat de per-item-weigeringsconventie van de bulk-tools intact
 * blijft. Alleen tools uit `ATOMIC_ITEM_TOOLS` zetten hem aan.
 */
export function validateToolArgs(
  schema: unknown,
  args: unknown,
  opts: { deepArrayItems?: boolean } = {},
): string | null {
  const value = args === undefined || args === null ? {} : args;
  const out: string[] = [];
  walk(schema, value, '', out, opts.deepArrayItems === true);
  if (out.length === 0) return null;
  // Cap: bij een volledig verkeerd gevormde call zijn de eerste paar regels informatief, de rest ruis.
  const shown = out.slice(0, 8);
  const rest = out.length - shown.length;
  return shown.join('; ') + (rest > 0 ? ` (+${rest} verdere schending(en))` : '');
}

/**
 * Testhaak: loop een schema na op trefwoorden die deze validator NIET kent. Een niet-lege uitkomst
 * betekent dat een schema iets belooft dat runtime niet wordt afgedwongen — precies het gat dat dit
 * bestand dicht. `tests/mcp/cases-schemavalidatie.ts` draait dit over ALLE geregistreerde tools.
 */
export function unsupportedKeywords(schema: unknown): string[] {
  const found = new Set<string>();
  const visit = (s: Json): void => {
    if (!isPlainObject(s)) return;
    for (const k of Object.keys(s)) {
      if (!SUPPORTED_KEYWORDS.includes(k) && !DOC_KEYWORDS.includes(k)) found.add(k);
    }
    if (isPlainObject(s.properties)) for (const v of Object.values(s.properties)) visit(v);
    if (isPlainObject(s.items)) visit(s.items);
  };
  visit(schema);
  return [...found].sort();
}
