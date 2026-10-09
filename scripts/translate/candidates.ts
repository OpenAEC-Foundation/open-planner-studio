// Kandidaat-termen voor de conceptenlijst (§4.2 stap 1). Pure functies; een Haiku-agent maakt er
// daarna concepten van (prompts/concepts.md).
import { textsOf, unitsOf } from './common';
import type { JsonObject } from '../i18n-tools';

export interface Candidate {
  term: string;
  freq: number;
  ui: number;
  docs: number;
  /** nl-teksten van sleutels waarvan de en-tekst gelijk is aan de term (max 3). */
  nl: string[];
  /** Voorbeeldsleutels (`ns:pad`) of artikelen (`docs:<id>`), max 3. */
  examples: string[];
}

const STOP = new Set(('a an the and or of to in on at by for with from as is are be this that it its your you '
  + 'not no if then than into per via all any each other more less one two can will was were has have had do '
  + 'does which what when where who how also only just here there these those they them their our we us')
  .split(' '));

/** Opschonen: witruimte, leestekens aan de randen, en geen getallen, code of lange zinnen. */
export function normalizeCandidate(raw: string): string | null {
  const s = raw.replace(/\s+/g, ' ').replace(/^[\s"'“”‘’(«[]+|[\s"'“”‘’)»\].,:;!?…]+$/g, '').trim();
  if (s.length < 2 || s.length > 60) return null;
  if (!/\p{L}/u.test(s)) return null;
  if (/[{}<>`=/\\|]|\$t\(/.test(s)) return null;
  const words = s.split(' ');
  if (words.length > 5) return null;
  if (words.length === 1 && STOP.has(s.toLowerCase())) return null;
  return s;
}

/** Cursieve en vette stukken uit een Markdown-tekst; een pad (*A › B › C*) wordt in delen geknipt. */
export function emphasisOf(md: string): string[] {
  const out: string[] = [];
  const text = md.replace(/`[^`\n]*`/g, ' ');
  for (const m of text.matchAll(/\*\*([^*\n]+?)\*\*/g)) out.push(m[1]);
  const noBold = text.replace(/\*\*([^*\n]+?)\*\*/g, ' ');
  for (const m of noBold.matchAll(/(?<![*\w])\*([^*\n]+?)\*(?![*\w])/g)) out.push(m[1]);
  return out.flatMap(s => s.split(/\s*›\s*/)).map(s => s.replace(/\s*[▾▸]\s*$/, ''));
}

/** Woordgroepen van 2–3 woorden uit een tekst, zonder stopwoord aan de randen. */
export function phrasesOf(text: string): string[] {
  const words = text.replace(/\{\{[^}]*\}\}/g, ' | ').split(/[^\p{L}\p{N}'-]+|\s+/u).filter(Boolean);
  const out: string[] = [];
  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const g = words.slice(i, i + n);
      if (STOP.has(g[0].toLowerCase()) || STOP.has(g[n - 1].toLowerCase())) continue;
      if (g.some(w => /^\d+$/.test(w))) continue;
      out.push(g.join(' '));
    }
  }
  return out;
}

/**
 * Verzamel kandidaten uit de UI (korte labels van ≤ 4 woorden en vaak terugkerende woordgroepen in
 * de en-UI) en uit de Engelse docs (cursief en vet). Sleutel = kleine letters; de weergave is de
 * meest voorkomende schrijfwijze. Gesorteerd op frequentie (hoog eerst), dan alfabetisch.
 */
export function collectCandidates(opts: {
  ui: { ns: string; nl: JsonObject; en: JsonObject }[];
  docs: { id: string; md: string }[];
  minPhraseFreq?: number;
}): Candidate[] {
  const minPhrase = opts.minPhraseFreq ?? 3;
  type Acc = Candidate & { spellings: Map<string, number> };
  const acc = new Map<string, Acc>();
  const add = (raw: string, where: 'ui' | 'docs', example: string, nl?: string) => {
    const term = normalizeCandidate(raw);
    if (!term) return;
    const k = term.toLowerCase();
    let a = acc.get(k);
    if (!a) { a = { term, freq: 0, ui: 0, docs: 0, nl: [], examples: [], spellings: new Map() }; acc.set(k, a); }
    a.freq++;
    a[where]++;
    a.spellings.set(term, (a.spellings.get(term) ?? 0) + 1);
    if (a.examples.length < 3 && !a.examples.includes(example)) a.examples.push(example);
    if (nl && a.nl.length < 3 && !a.nl.includes(nl)) a.nl.push(nl);
  };

  const phraseCount = new Map<string, { n: number; example: string }>();
  for (const { ns, nl, en } of opts.ui) {
    const nlUnits = new Map(unitsOf(nl).map(u => [u.key, u]));
    for (const u of unitsOf(en)) {
      const enText = textsOf(u.text)[0];
      const nlU = nlUnits.get(u.key);
      const nlText = nlU ? textsOf(nlU.text)[0] : undefined;
      if (!/\{\{/.test(enText) && enText.split(/\s+/).length <= 4) add(enText, 'ui', `${ns}:${u.key}`, nlText);
      for (const p of new Set(phrasesOf(enText))) {
        const k = p.toLowerCase();
        const c = phraseCount.get(k);
        if (c) c.n++; else phraseCount.set(k, { n: 1, example: `${ns}:${u.key}` });
      }
    }
  }
  for (const [k, { n, example }] of phraseCount) {
    if (n < minPhrase || acc.has(k)) continue;
    const term = normalizeCandidate(k);
    if (!term) continue;
    acc.set(k, { term, freq: n, ui: n, docs: 0, nl: [], examples: [example], spellings: new Map([[term, n]]) });
  }
  for (const { id, md } of opts.docs) for (const e of emphasisOf(md)) add(e, 'docs', `docs:${id}`);

  return [...acc.values()]
    .map(({ spellings, ...c }) => ({ ...c, term: [...spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0] }))
    .sort((a, b) => b.freq - a.freq || a.term.localeCompare(b.term));
}

/** Knip een lijst in pakketten van `size`. */
export function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}
