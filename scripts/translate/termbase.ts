// Termbase: schema-controle, samenvoegen van concepten en het verwerken van gekozen termen (§4).
// Pure functies; de CLI (cli.ts) leest en schrijft de bestanden.
import {
  CONCEPT_KINDS, TERM_STATUSES, termEntries,
  type Concept, type LangTermbase, type Style, type TermEntry,
} from './common';

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// ── Stam ─────────────────────────────────────────────────────────────────────────────────────

function longestCommonSubstring(a: string[], b: string[]): number {
  let best = 0;
  const prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) best = prev[j];
      diag = tmp;
    }
  }
  return best;
}

/**
 * Deelt `form` een stam met `term`? Een heuristiek, bewust ruim: de langste gemeenschappelijke
 * reeks tekens (hoofdletterongevoelig) is minstens min(4, ⌈lengte van term / 2⌉). Zo passen
 * verbuigingen (cs *celková časová rezerva* → *celkové časové rezervy*, fi *polku* → *polun*) en
 * lidwoord-voorvoegsels (ar *المسار*), maar geen ander woord.
 */
export function sharesStem(term: string, form: string): boolean {
  const a = Array.from(term.trim().toLocaleLowerCase());
  const b = Array.from(form.trim().toLocaleLowerCase());
  if (a.length === 0 || b.length === 0) return false;
  return longestCommonSubstring(a, b) >= Math.min(4, Math.ceil(a.length / 2));
}

// ── Schema ───────────────────────────────────────────────────────────────────────────────────

/** Fouten in één concept (leeg = goed). */
export function conceptErrors(c: unknown, where: string): string[] {
  if (!isRecord(c)) return [`${where}: geen object`];
  const e: string[] = [];
  const id = isStr(c.id) ? c.id : '?';
  const at = `${where} ${id}`;
  if (!isStr(c.id) || !ID_RE.test(c.id)) e.push(`${at}: id moet kebab-case zijn (a-z, 0-9, -)`);
  if (!CONCEPT_KINDS.includes(c.kind as never)) e.push(`${at}: kind moet term, token of keep zijn`);
  if (!isStr(c.nl)) e.push(`${at}: nl ontbreekt`);
  if (!isStrList(c.en) || c.en.length === 0) e.push(`${at}: en moet een niet-lege lijst teksten zijn`);
  if (!isStr(c.definition)) e.push(`${at}: definition ontbreekt`);
  if (c.enBySource !== undefined) {
    if (!isRecord(c.enBySource) || !Object.values(c.enBySource).every(isStr)) e.push(`${at}: enBySource moet { bron: tekst } zijn`);
    else if (isStrList(c.en)) {
      const en = c.en.map(s => s.toLowerCase());
      for (const [src, v] of Object.entries(c.enBySource)) {
        if (!en.includes(String(v).toLowerCase())) e.push(`${at}: enBySource.${src} "${String(v)}" staat niet in en`);
      }
    }
  }
  if (c.seeAlso !== undefined && !isStrList(c.seeAlso)) e.push(`${at}: seeAlso moet een lijst id's zijn`);
  const allowed = new Set(['id', 'kind', 'nl', 'en', 'enBySource', 'definition', 'seeAlso']);
  for (const k of Object.keys(c)) if (!allowed.has(k)) e.push(`${at}: onbekend veld "${k}"`);
  return e;
}

/** Fouten in de hele conceptenlijst: per concept, plus dubbele id's en dode seeAlso-verwijzingen. */
export function conceptsErrors(list: unknown): string[] {
  if (!Array.isArray(list)) return ['concepts.json: verwacht een lijst concepten'];
  const errors = list.flatMap((c, i) => conceptErrors(c, `concept[${i}]`));
  const ids = new Set<string>();
  for (const c of list as Concept[]) {
    if (ids.has(c.id)) errors.push(`concept ${c.id}: dubbel id`);
    ids.add(c.id);
  }
  for (const c of list as Concept[]) {
    for (const s of c.seeAlso ?? []) if (!ids.has(s)) errors.push(`concept ${c.id}: seeAlso "${s}" bestaat niet`);
  }
  return errors;
}

export function styleErrors(s: unknown, where: string): string[] {
  if (!isRecord(s)) return [`${where}: _style moet een object zijn`];
  const e: string[] = [];
  if (s.address !== 'formal' && s.address !== 'informal') e.push(`${where}: _style.address moet formal of informal zijn`);
  if (s.note !== undefined && typeof s.note !== 'string') e.push(`${where}: _style.note moet tekst zijn`);
  if (s.commands !== undefined && typeof s.commands !== 'string') e.push(`${where}: _style.commands moet tekst zijn`);
  if (s.quotes !== undefined && typeof s.quotes !== 'string') e.push(`${where}: _style.quotes moet tekst zijn`);
  return e;
}

/** Fouten in één termregel (leeg = goed). */
export function termEntryErrors(t: unknown, at: string): string[] {
  if (!isRecord(t)) return [`${at}: geen object`];
  const e: string[] = [];
  if (!isStr(t.term)) e.push(`${at}: term ontbreekt`);
  if (!isStrList(t.forms) || t.forms.length === 0) e.push(`${at}: forms moet een niet-lege lijst zijn`);
  else if (isStr(t.term)) {
    for (const f of t.forms) if (!sharesStem(t.term, f)) e.push(`${at}: vorm "${f}" deelt geen stam met "${t.term}"`);
  }
  if (t.avoid !== undefined && !isStrList(t.avoid)) e.push(`${at}: avoid moet een lijst teksten zijn`);
  if (!isStr(t.source)) e.push(`${at}: source ontbreekt`);
  if (!TERM_STATUSES.includes(t.status as never)) e.push(`${at}: status moet één van ${TERM_STATUSES.join(', ')} zijn`);
  return e;
}

export interface TermbaseReport { errors: string[]; missing: string[] }

/**
 * Controleer één taalbestand tegen de concepten. `errors` = schemafouten (rood); `missing` =
 * term-concepten zonder regel (een rapport: de termbase groeit per taal).
 */
export function validateLangTermbase(lang: string, tb: unknown, concepts: Concept[]): TermbaseReport {
  if (!isRecord(tb)) return { errors: [`${lang}: geen object`], missing: [] };
  const errors: string[] = [];
  const byId = new Map(concepts.map(c => [c.id, c]));
  if (tb._style !== undefined) errors.push(...styleErrors(tb._style, lang));
  else errors.push(`${lang}: _style ontbreekt`);
  for (const [id, entry] of Object.entries(tb)) {
    if (id === '_style') continue;
    if (!byId.has(id)) { errors.push(`${lang}.${id}: onbekend concept`); continue; }
    errors.push(...termEntryErrors(entry, `${lang}.${id}`));
  }
  const missing = concepts.filter(c => c.kind === 'term' && !(c.id in tb)).map(c => c.id);
  return { errors, missing };
}

// ── Concepten samenvoegen (concepts-merge) ───────────────────────────────────────────────────

const sameConcept = (a: Concept, b: Concept) => JSON.stringify(normalizeConcept(a)) === JSON.stringify(normalizeConcept(b));

/** Vaste veldvolgorde, zodat de bestanden stabiel blijven. */
export function normalizeConcept(c: Concept): Concept {
  const bySource = c.enBySource && Object.keys(c.enBySource).length > 0
    ? Object.fromEntries(Object.entries(c.enBySource).sort(([a], [b]) => a.localeCompare(b)))
    : undefined;
  return {
    id: c.id, kind: c.kind, nl: c.nl, en: [...c.en],
    ...(bySource ? { enBySource: bySource } : {}),
    definition: c.definition,
    ...(c.seeAlso && c.seeAlso.length > 0 ? { seeAlso: [...c.seeAlso] } : {}),
  };
}

export interface MergeResult { concepts: Concept[]; added: number; conflicts: string[] }

/**
 * Voeg nieuwe concepten toe aan de bestaande lijst. Dedup op id: gelijk = één keer; verschillend =
 * een conflict (de eerste versie blijft, de andere wordt gemeld). Bestaande concepten winnen altijd.
 * Uitkomst gesorteerd op id.
 */
export function mergeConcepts(existing: Concept[], incoming: { file: string; concepts: Concept[] }[]): MergeResult {
  const byId = new Map<string, { c: Concept; from: string }>();
  for (const c of existing) byId.set(c.id, { c: normalizeConcept(c), from: 'concepts.json' });
  const conflicts: string[] = [];
  let added = 0;
  for (const { file, concepts } of incoming) {
    for (const raw of concepts) {
      const c = normalizeConcept(raw);
      const prev = byId.get(c.id);
      if (!prev) { byId.set(c.id, { c, from: file }); added++; continue; }
      if (!sameConcept(prev.c, c)) conflicts.push(`${c.id}: ${file} wijkt af van ${prev.from} (behouden: ${prev.from})`);
    }
  }
  const concepts = [...byId.values()].map(v => v.c).sort((a, b) => a.id.localeCompare(b.id));
  return { concepts, added, conflicts };
}

// ── Gekozen termen verwerken (apply-terms) ───────────────────────────────────────────────────

/** Een regel in `terms-NN.out.json`: een termregel, plus meldingen voor het inconsistentierapport. */
export interface TermOut extends TermEntry {
  /** Andere vertalingen van hetzelfde concept die de bestaande UI ook gebruikt (§4.4). */
  uiVariants?: string[];
  /** De TBX-term als de UI iets anders gebruikt dan de vakterm. */
  tbxTerm?: string;
  note?: string;
}

export interface TermsOut { _style?: Style; [id: string]: TermOut | Style | undefined }

const stripReport = (t: TermOut): TermEntry => ({
  term: t.term, forms: [...t.forms],
  ...(t.avoid && t.avoid.length > 0 ? { avoid: [...t.avoid] } : {}),
  source: t.source, status: t.status,
});

/**
 * Zet goedgekeurde termregels in een taalbestand. `_style` uit de uitvoer geldt alleen als het
 * bestand er nog geen heeft. Volgorde: `_style`, daarna de concepten in de volgorde van concepts.json.
 */
export function applyTerms(tb: LangTermbase, outs: TermsOut[], concepts: Concept[]): LangTermbase {
  const entries = new Map(termEntries(tb));
  let style = tb._style;
  for (const out of outs) {
    if (!style && out._style) style = out._style;
    for (const [id, v] of Object.entries(out)) {
      if (id === '_style' || v === undefined) continue;
      entries.set(id, stripReport(v as TermOut));
    }
  }
  const result: LangTermbase = {};
  if (style) result._style = style;
  for (const c of concepts) {
    const e = entries.get(c.id);
    if (e) result[c.id] = e;
  }
  for (const [id, e] of entries) if (!(id in result)) result[id] = e;
  return result;
}

/** Het inconsistentierapport voor een bestaande taal (Markdown), uit de meldingen in de uitvoer. */
export function inconsistencyReport(lang: string, outs: TermsOut[], concepts: Concept[]): string {
  const byId = new Map(concepts.map(c => [c.id, c]));
  const variants: string[] = [];
  const deviations: string[] = [];
  for (const out of outs) {
    for (const [id, v] of Object.entries(out)) {
      if (id === '_style' || v === undefined) continue;
      const t = v as TermOut;
      const c = byId.get(id);
      const label = c ? `${id} (nl *${c.nl}*, en *${c.en.join(' / ')}*)` : id;
      if (t.uiVariants && t.uiVariants.length > 0) {
        variants.push(`- ${label}: gekozen *${t.term}*; de UI gebruikt ook ${t.uiVariants.map(x => `*${x}*`).join(', ')}`);
      }
      if (t.tbxTerm && t.tbxTerm !== t.term) {
        deviations.push(`- ${label}: UI *${t.term}*, vakterm (TBX) *${t.tbxTerm}*${t.note ? ` — ${t.note}` : ''}`);
      }
    }
  }
  return [
    `# Inconsistenties in de bestaande UI — ${lang}`,
    '',
    'Gegenereerd door `npm run translate -- apply-terms`. Invoer voor PR 3 (herstel in de UI); Opus beslist.',
    '',
    `## Eén concept, meer vertalingen (${variants.length})`,
    '',
    ...(variants.length ? variants : ['Geen.']),
    '',
    `## Afwijking van de vakterm (${deviations.length})`,
    '',
    ...(deviations.length ? deviations : ['Geen.']),
    '',
  ].join('\n');
}
