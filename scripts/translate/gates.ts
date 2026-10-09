// De poorten van de vertaalstraat (§7): pure controle van de uitvoer van een agent tegen zijn pakket.
// Hard (rood, exit 1) en zacht (waarschuwing voor de nalezer). check.ts is de dunne I/O-schil
// eromheen; `translate prepare` bundelt die tot build/translate/check.mjs.
import {
  countToken, containsTerm, nestings, placeholders, pluralCategories, textsOf, type UnitText,
} from './common';
import { conceptErrors, styleErrors, termEntryErrors } from './termbase';
import type { UiPackage } from './ui';
import type { TermsCheckPackage, TermsPackage } from './tbx';

export interface CheckResult { errors: string[]; warnings: string[] }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (xs: string[]) => xs.length ? xs.map(x => `{{${x}}}`).join(', ') : '(geen)';

/** Controleer één tekst tegen de nl-bron: invulplekken, $t-nesting, leeg, tokens. */
function checkText(at: string, text: unknown, nl: string[], tokens: string[], allowCount: boolean, errors: string[]): void {
  if (typeof text !== 'string') { errors.push(`${at}: verwacht tekst`); return; }
  if (text.trim() === '') { errors.push(`${at}: lege tekst`); return; }
  let want = placeholders(nl.join(' '));
  let got = placeholders(text);
  if (allowCount) { want = want.filter(v => v !== 'count'); got = got.filter(v => v !== 'count'); }
  if (got.join() !== want.join()) errors.push(`${at}: invulplekken ${list(got)} ≠ nl ${list(want)}`);
  const wantT = [...new Set(nl.flatMap(nestings))].sort();
  const gotT = [...new Set(nestings(text))].sort();
  if (gotT.join('\u0000') !== wantT.join('\u0000')) {
    errors.push(`${at}: $t(…) moet byte-gelijk zijn aan nl: ${wantT.join(' ') || '(geen)'}; kreeg ${gotT.join(' ') || '(geen)'}`);
  }
  for (const tok of tokens) {
    if (nl.every(s => countToken(s, tok) > 0) && countToken(text, tok) === 0) errors.push(`${at}: token "${tok}" ontbreekt (nooit vertalen)`);
  }
}

/** Zachte controles op één vertaalde tekst. */
function softText(at: string, text: string, nl: string[], en: string, pkg: UiPackage, warnings: string[]): void {
  const low = text.toLocaleLowerCase();
  for (const t of pkg.terms) {
    const inSource = nl.some(s => containsTerm(s, t.nl)) || t.en.some(e => containsTerm(en, e));
    if (!inSource) continue;
    const forms = t.forms.length ? t.forms : [t.target];
    if (!forms.some(f => low.includes(f.toLocaleLowerCase()))) warnings.push(`${at}: term "${t.target}" (${t.id}) niet gevonden`);
    // Een avoid-variant kan in de eigen term zitten ("fri slakk" ⊃ "slakk"): haal de vormen eerst weg.
    const rest = forms.map(f => f.toLocaleLowerCase()).sort((a, b) => b.length - a.length)
      .reduce((s, f) => s.split(f).join('\u0000'), low);
    for (const a of t.avoid ?? []) if (rest.includes(a.toLocaleLowerCase())) warnings.push(`${at}: vermijd "${a}" (${t.id})`);
  }
  for (const k of pkg.keep) {
    if (nl.some(s => countToken(s, k) > 0) && countToken(text, k) === 0) warnings.push(`${at}: eigennaam "${k}" niet letterlijk overgenomen`);
  }
  if (text === en && /\p{L}/u.test(en)) warnings.push(`${at}: gelijk aan en`);
  if (text.length > 20 && text.length > 1.6 * en.length) warnings.push(`${at}: ${text.length} tekens, en ${en.length} (>1,6×)`);
}

/** De UI-poorten: sleutels, CLDR-categorieën, invulplekken, $t, leeg, tokens; plus waarschuwingen. */
export function checkUi(pkg: UiPackage, out: unknown): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(out)) return { errors: ['uitvoer: verwacht een object { sleutel: tekst }'], warnings };
  const want = new Set(pkg.items.map(i => i.key));
  for (const k of Object.keys(out)) if (!want.has(k)) errors.push(`${k}: sleutel staat niet in het pakket`);
  const cats = pluralCategories(pkg.lang);
  for (const item of pkg.items) {
    const v = out[item.key];
    if (v === undefined) { errors.push(`${item.key}: ontbreekt`); continue; }
    const nl = textsOf(item.nl);
    const enText = (t: UnitText, cat?: string) => typeof t === 'string' ? t : (t[cat ?? 'other'] ?? t.other ?? '');
    if (!item.plural) {
      if (typeof v !== 'string') { errors.push(`${item.key}: verwacht één tekst, geen meervoudsvormen`); continue; }
      const before = errors.length;
      checkText(item.key, v, nl, pkg.tokens, false, errors);
      if (errors.length === before) softText(item.key, v, nl, enText(item.en), pkg, warnings);
      continue;
    }
    if (!isRecord(v)) { errors.push(`${item.key}: verwacht meervoudsvormen { ${cats.join(', ')} }`); continue; }
    const got = Object.keys(v);
    const missing = cats.filter(c => !got.includes(c));
    const extra = got.filter(c => !cats.includes(c));
    if (missing.length || extra.length) {
      errors.push(`${item.key}: meervoudsvormen moeten precies [${cats.join(', ')}] zijn`
        + `${missing.length ? ` — ontbreekt ${missing.join(', ')}` : ''}${extra.length ? ` — overbodig ${extra.join(', ')}` : ''}`);
    }
    for (const c of cats) {
      if (!(c in v)) continue;
      const before = errors.length;
      checkText(`${item.key}.${c}`, v[c], nl, pkg.tokens, true, errors);
      if (errors.length === before) softText(`${item.key}.${c}`, v[c] as string, nl, enText(item.en, c), pkg, warnings);
    }
  }
  return { errors, warnings };
}

/** Schema van `candidates-NN.out.json`: een lijst concepten (§4.1). */
export function checkConceptsOut(out: unknown): CheckResult {
  if (!Array.isArray(out)) return { errors: ['uitvoer: verwacht een lijst concepten'], warnings: [] };
  const errors = out.flatMap((c, i) => conceptErrors(c, `concept[${i}]`));
  const seen = new Set<string>();
  for (const c of out as { id?: unknown }[]) {
    if (typeof c?.id !== 'string') continue;
    if (seen.has(c.id)) errors.push(`concept ${c.id}: dubbel id`);
    seen.add(c.id);
  }
  return { errors, warnings: [] };
}

/** Schema van `terms-NN.out.json`: per concept uit het pakket precies één termregel. */
export function checkTermsOut(pkg: TermsPackage, out: unknown): CheckResult {
  if (!isRecord(out)) return { errors: ['uitvoer: verwacht een object { concept-id: termregel }'], warnings: [] };
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set(pkg.concepts.map(c => c.id));
  if (out._style !== undefined) errors.push(...styleErrors(out._style, 'uitvoer'));
  else if (!pkg.style) errors.push('uitvoer: _style ontbreekt (aanspreekvorm: formal of informal)');
  for (const k of Object.keys(out)) if (k !== '_style' && !ids.has(k)) errors.push(`${k}: concept staat niet in het pakket`);
  for (const c of pkg.concepts) {
    const v = out[c.id];
    if (v === undefined) { errors.push(`${c.id}: ontbreekt`); continue; }
    errors.push(...termEntryErrors(v, c.id));
    if (!isRecord(v)) continue;
    if (v.status === 'arbitrated') errors.push(`${c.id}: status arbitrated is alleen voor Opus`);
    if (v.status === 'existing-ui' && !pkg.existingUi) errors.push(`${c.id}: status existing-ui kan alleen bij een bestaande taal`);
    if ((v.status === 'tbx' || v.status === 'tbx-chosen') && typeof v.term === 'string'
      && !c.candidates.some(k => k.term.toLocaleLowerCase() === (v.term as string).toLocaleLowerCase())) {
      errors.push(`${c.id}: status ${String(v.status)}, maar "${v.term}" staat niet bij de kandidaten`);
    }
    if (v.uiVariants !== undefined && !(Array.isArray(v.uiVariants) && v.uiVariants.every(x => typeof x === 'string'))) {
      errors.push(`${c.id}: uiVariants moet een lijst teksten zijn`);
    }
    if (v.tbxTerm !== undefined && typeof v.tbxTerm !== 'string') errors.push(`${c.id}: tbxTerm moet tekst zijn`);
    if (v.status === 'model') warnings.push(`${c.id}: status model — krijgt een blinde controle`);
  }
  return { errors, warnings };
}

/** Schema van `terms-check-NN.out.json`: per item terugvertaling + oordeel. */
export function checkTermsCheckOut(pkg: TermsCheckPackage, out: unknown): CheckResult {
  if (!isRecord(out)) return { errors: ['uitvoer: verwacht een object { id: oordeel }'], warnings: [] };
  const errors: string[] = [];
  const ids = new Set(pkg.items.map(i => i.id));
  for (const k of Object.keys(out)) if (!ids.has(k)) errors.push(`${k}: staat niet in het pakket`);
  for (const it of pkg.items) {
    const v = out[it.id];
    if (!isRecord(v)) { errors.push(`${it.id}: ontbreekt of geen object`); continue; }
    if (typeof v.backTranslation !== 'string' || v.backTranslation.trim() === '') errors.push(`${it.id}: backTranslation ontbreekt`);
    if (typeof v.standard !== 'boolean') errors.push(`${it.id}: standard moet true of false zijn`);
    if (v.suggestion !== undefined && typeof v.suggestion !== 'string') errors.push(`${it.id}: suggestion moet tekst zijn`);
  }
  return { errors, warnings: [] };
}

/** Kies de poort op basis van `kind` in het pakket. */
export function checkPackage(pkg: unknown, out: unknown): CheckResult {
  if (!isRecord(pkg)) return { errors: ['pakket: geen object'], warnings: [] };
  switch (pkg.kind) {
    case 'ui': return checkUi(pkg as unknown as UiPackage, out);
    case 'concepts': return checkConceptsOut(out);
    case 'terms': return checkTermsOut(pkg as unknown as TermsPackage, out);
    case 'terms-check': return checkTermsCheckOut(pkg as unknown as TermsCheckPackage, out);
    default: return { errors: [`pakket: onbekend kind "${String(pkg.kind)}"`], warnings: [] };
  }
}

/** Korte uitvoer: één regel per fout of waarschuwing, en een slotregel. */
export function formatResult(id: string, r: CheckResult): string[] {
  const lines = [...r.errors.map(e => `XX ${e}`), ...r.warnings.map(w => `WW ${w}`)];
  lines.push(r.errors.length
    ? `ROOD ${id}: ${r.errors.length} fout(en), ${r.warnings.length} waarschuwing(en) — herstel de XX-regels`
    : `GROEN ${id}: 0 fouten, ${r.warnings.length} waarschuwing(en)`);
  return lines;
}
