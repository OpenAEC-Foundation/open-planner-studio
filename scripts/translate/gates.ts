// De poorten van de vertaalstraat (§7): pure controle van de uitvoer van een agent tegen zijn pakket.
// Hard (rood, exit 1) en zacht (waarschuwing voor de nalezer). check.ts is de dunne I/O-schil
// eromheen; `translate prepare` bundelt die tot build/translate/check.mjs.
import {
  countToken, containsTerm, findAvoid, nestings, placeholders, pluralCategories, textsOf, type UnitText,
} from './common';
import { conceptErrors, styleErrors, termEntryErrors } from './termbase';
import type { UiLabel, UiPackage } from './ui';
import { sectionHash, splitSections, structureOf, subsetErrors, type DocSection } from '../lib/docs-structure';
import {
  avoidWords, blocksOf, codesOf, hasStem, hasWord, italicsOf, normLabel, outSections, type Block, type DocsPackage,
} from './docs';
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

/**
 * Labelpoort: noemt de nl-tekst een andere UI-tekst letterlijk (een knop, tab of blok), dan moet de
 * vertaling de huidige vertaling van dat label letterlijk bevatten (hard). Nog geen vertaling van het
 * label: alleen een waarschuwing. Alleen labels die in deze nl-vorm staan tellen.
 */
function checkLabels(at: string, text: string, nl: string[], labels: UiLabel[] | undefined, errors: string[], warnings: string[]): void {
  for (const l of labels ?? []) {
    if (!nl.some(s => s.includes(l.nl))) continue;
    if (l.targets.length === 0) {
      warnings.push(`${at}: label "${l.nl}" (${l.keys[0]}) heeft nog geen vaste vertaling; gebruik straks precies die`);
      continue;
    }
    if (!l.targets.some(t => text.includes(t))) {
      errors.push(`${at}: label "${l.nl}" (${l.keys[0]}) moet letterlijk "${l.targets.join('" of "')}" zijn`);
    }
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
    for (const a of findAvoid(text, forms, t.avoid ?? [])) warnings.push(`${at}: vermijd "${a}" (${t.id})`);
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
      if (errors.length === before) checkLabels(item.key, v, nl, item.labels, errors, warnings);
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
    // Elke vorm vergelijkt met de nl-vorm voor dezelfde getallen: `one` met nl `one`, de rest met nl `other`.
    // Een familie mag per vorm andere invulplekken hebben ("'{{task}}' heeft…" tegenover "{{count}} taken…").
    const nlFor = (c: string): string[] => {
      if (typeof item.nl === 'string') return nl;
      const src = c === 'one' && item.nl.one !== undefined ? item.nl.one : item.nl.other;
      return src === undefined ? nl : [src];
    };
    for (const c of cats) {
      if (!(c in v)) continue;
      const before = errors.length;
      checkText(`${item.key}.${c}`, v[c], nlFor(c), pkg.tokens, true, errors);
      if (errors.length === before) checkLabels(`${item.key}.${c}`, v[c] as string, nlFor(c), item.labels, errors, warnings);
      if (errors.length === before) softText(`${item.key}.${c}`, v[c] as string, nlFor(c), enText(item.en, c), pkg, warnings);
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

// ── Docs (§7) ────────────────────────────────────────────────────────────────────────────────

const bag = (xs: string[]): Map<string, number> => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
};
const BLOCK_NAME: Record<Block['kind'], string> = {
  h1: 'een #-kop', h2: 'een ##-kop', h3: 'een ###-kop', p: 'een alinea', ul: 'een opsomming (-)', ol: 'een genummerde lijst (1.)',
  img: 'een afbeelding', code: 'een codeblok',
};
const short = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);
const NON_ASCII_DIGIT = /(?![0-9])\p{Nd}/u;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** Patroon van een UI-tekst met `{{…}}` als open plek (labelsoort b). */
const fillRe = (target: string): RegExp =>
  new RegExp(target.split(/\{\{\s*[\w.-]+\s*\}\}/).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+?'), 'u');

/** Cursieve stukken die een a/b-label zijn (bron: de en-tekst; vertaling: een doelkandidaat) uit de tekst halen. */
function withoutLabelSpans(text: string, labels: DocsPackage['labels'], side: 'src' | 'out'): string {
  if (labels.length === 0) return text;
  let rest = text;
  for (const span of new Set(italicsOf(text))) {
    const parts = [normLabel(span), ...span.split(/\s*[›→]\s*/).map(normLabel)];
    const hit = (p: string) => labels.some(l => side === 'src'
      ? normLabel(l.en) === p
      : (l.targets ?? []).some(t => (placeholders(t).length ? fillRe(t).test(p) : normLabel(t) === p)));
    if (parts.some(hit)) rest = rest.split(span).join(' ');
  }
  return rest;
}

/** Harde en zachte poorten voor één sectie: bron (en) tegen vertaling. */
function checkDocsSection(pkg: DocsPackage, idx: number, src: DocSection, out: DocSection, errors: string[], warnings: string[]): void {
  const at = `sectie ${idx}${src.heading ? ` (${short(src.heading)})` : ''}`;
  const o = out.text;
  const s = src.text;
  if (o.trim() === '') { errors.push(`${at}: leeg`); return; }

  // Opbouw: dezelfde blokken in dezelfde volgorde (koppen, alinea's, lijsten, afbeeldingen).
  const sb = blocksOf(s);
  const ob = blocksOf(o);
  for (let i = 0; i < Math.max(sb.length, ob.length); i++) {
    const a = sb[i];
    const b = ob[i];
    if (a && b && a.kind === b.kind) {
      if (a.items !== b.items) errors.push(`${at}, regel ${b.line}: lijst met ${b.items} item(s), de bron heeft er ${a.items}`);
      continue;
    }
    if (b?.kind === 'ol' && a?.kind !== 'ol') {
      errors.push(`${at}, regel ${b.line}: "${short(b.text)}" begint met een getal en een punt; miniMarkdown maakt daar een genummerde lijst, de bron niet — zet het getal niet vooraan`);
    } else if (!b) {
      errors.push(`${at}: ${BLOCK_NAME[a!.kind]} ontbreekt (bron regel ${a!.line}: "${short(a!.text)}")`);
    } else {
      errors.push(`${at}, regel ${b.line}: ${BLOCK_NAME[b.kind]}, de bron heeft daar ${a ? BLOCK_NAME[a.kind] : 'niets meer'}`);
    }
    break;
  }
  // Een regel "18. června" midden in een alinea wordt een genummerde lijst (ook als de opbouw al eerder afweek).
  const lines = o.split('\n');
  lines.forEach((line, i) => {
    const prev = i > 0 ? lines[i - 1] : '';
    if (/^\d+\.\s/.test(line) && prev.trim() !== '' && !/^(\d+\.|[-*])\s/.test(prev)) {
      const msg = `${at}, regel ${i + 1}: "${short(line)}" begint met een getal en een punt; miniMarkdown maakt daar een genummerde lijst, de bron niet — zet het getal niet vooraan`;
      if (!errors.includes(msg)) errors.push(msg);
    }
  });
  const ss = structureOf(s);
  const os = structureOf(o);
  if (ss.headings.join() !== os.headings.join()) errors.push(`${at}: kopniveaus [${os.headings.join(', ')}], de bron [${ss.headings.join(', ')}]`);
  if (ss.links.join('\n') !== os.links.join('\n')) errors.push(`${at}: links ${os.links.join(' ') || '(geen)'} ≠ bron ${ss.links.join(' ') || '(geen)'} (doelen en volgorde ongewijzigd)`);
  if (ss.images.join('\n') !== os.images.join('\n')) errors.push(`${at}: afbeeldingen ${os.images.join(' ') || '(geen)'} ≠ bron ${ss.images.join(' ') || '(geen)'}`);
  if (ss.listItems !== os.listItems) errors.push(`${at}: ${os.listItems} lijstitem(s), de bron ${ss.listItems}`);

  // Inline code: byte-gelijk, behalve de display-voorbeelden.
  const sc = codesOf(s);
  const oc = codesOf(o);
  if (sc.length !== oc.length) errors.push(`${at}: ${oc.length} inline-code-stuk(ken), de bron ${sc.length}`);
  const display = pkg.display ?? [];
  const have = bag(oc);
  for (const [code, n] of bag(sc.filter(c => !display.includes(c)))) {
    if ((have.get(code) ?? 0) < n) errors.push(`${at}: inline code \`${code}\` ontbreekt of is veranderd (byte-gelijk overnemen)`);
  }

  // Cijfers: elke cijferreeks van de bron staat er, alleen ASCII-cijfers.
  const bad = o.match(new RegExp(NON_ASCII_DIGIT.source, 'gu'));
  if (bad) errors.push(`${at}: niet-ASCII-cijfers ${[...new Set(bad)].join(' ')} — schrijf 0-9`);
  // Getallen binnen een herkend UI-label (soort a/b) tellen niet mee: de labelregel controleert het label zelf
  // (de ar-vorm van "1 task shows …" schrijft het getal uit).
  const sectionLabelsHere = pkg.labels.filter(x => x.section === idx && (x.kind === 'a' || x.kind === 'b'));
  const sd = bag(withoutLabelSpans(s, sectionLabelsHere, 'src').match(/[0-9]+/g) ?? []);
  const od = bag(withoutLabelSpans(o, sectionLabelsHere, 'out').match(/[0-9]+/g) ?? []);
  for (const [d, n] of sd) if ((od.get(d) ?? 0) < n) errors.push(`${at}: getal ${d} staat ${n}× in de bron, ${od.get(d) ?? 0}× in de vertaling`);
  const extra = [...od].filter(([d, n]) => n > (sd.get(d) ?? 0)).map(([d]) => d);
  if (extra.length) warnings.push(`${at}: getallen die de bron niet heeft: ${extra.join(', ')}`);

  // Placeholders: een `{{…}}` die de bron niet heeft, is een UI-tekst met een open plek die in de proza belandde.
  const sp = bag((s.match(/\{\{[^{}]*\}\}/g) ?? []).map(x => x.replace(/\s+/g, '')));
  for (const [ph, n] of bag((o.match(/\{\{[^{}]*\}\}/g) ?? []).map(x => x.replace(/\s+/g, '')))) {
    if (n > (sp.get(ph) ?? 0)) errors.push(`${at}: invulplek ${ph} staat niet in de bron — schrijf de tekst zoals de bron hem toont (bv. "…" of het getal)`);
  }

  // Labels (§5.3).
  // Tabbladplekken in de vertaling: een heel cursief stuk, of het eerste deel van een pad (niet een later deel:
  // cs *Domů › Plán › Přepočítat* is de groep Plán, niet het tabblad).
  const parts = italicsOf(o).map(x => normLabel(x.split(/\s*›\s*/)[0]));
  for (const l of pkg.labels.filter(x => x.section === idx)) {
    const what = `label *${short(l.en)}*${l.keys ? ` (${l.keys.slice(0, 2).join(', ')}${l.keys.length > 2 ? ', …' : ''})` : ''}`;
    if (l.kind === 'c') {
      if (!o.includes(l.en)) errors.push(`${at}: ${what} moet letterlijk blijven: "${l.en}"`);
      continue;
    }
    const targets = l.targets ?? [];
    if (targets.length === 0) { warnings.push(`${at}: ${what} heeft nog geen vertaling in de UI; vertaal het als korte UI-naam`); continue; }
    if (l.role === 'tab') {
      // Een tabblad: precies één van de tabbladnamen, als eigen cursief deel (niet als deel van een langer woord).
      const want = new Set(targets.map(normLabel));
      const got = parts.filter(p => want.has(p)).length;
      const need = l.count ?? 1;
      if (got < need) {
        errors.push(`${at}: ${what} staat ${need}× op een tabbladplek (pad of "tab *…*"), de vertaling heeft ${got}× *${targets.join('* of *')}* — schrijf daar precies die tabbladnaam (cursief: los, of als eerste deel van het pad), geen andere vertaling van "${short(l.en)}"`);
      }
      continue;
    }
    const okLabel = l.kind === 'a' ? targets.some(t => (placeholders(t).length ? fillRe(t).test(o) : o.includes(t))) : targets.some(t => fillRe(t).test(o));
    if (!okLabel) {
      errors.push(`${at}: ${what} moet ${l.kind === 'a' ? 'letterlijk' : 'volgens het patroon'} "${targets.slice(0, 3).join('" of "')}"${targets.length > 3 ? ' (of een andere kandidaat uit het pakket)' : ''} zijn`);
    }
  }

  // Tokens en keep-namen.
  for (const t of pkg.tokens) if (countToken(s, t) > 0 && countToken(o, t) === 0) errors.push(`${at}: token "${t}" ontbreekt (nooit vertalen)`);
  for (const k of pkg.keep) if (countToken(s, k) > 0 && countToken(o, k) === 0) errors.push(`${at}: naam "${k}" ontbreekt (niet vertalen)`);
  for (const k of pkg.keepSoft ?? []) if (countToken(s, k) > 0 && countToken(o, k) === 0) warnings.push(`${at}: naam "${k}" niet letterlijk (mag in deze taal)`);

  // Termen: niet gevonden is zacht (de bron kan het woord in een andere betekenis gebruiken). Een avoid-woord
  // als los woord is hard: buiten inline code, buiten UI-labels en buiten de vormen van alle termen.
  const allForms = pkg.terms.flatMap(t => (t.forms.length ? t.forms : [t.target]));
  const labelTexts = pkg.labels.filter(x => x.section === idx).flatMap(l => l.targets ?? []);
  const prose = o.replace(/`[^`]+`/g, ' ');
  const avoidSoft = new Set((pkg.avoidSoft ?? []).map(a => a.toLocaleLowerCase()));
  for (const t of pkg.terms) {
    if (!t.en.some(e => hasStem(s, e))) continue;
    const forms = t.forms.length ? t.forms : [t.target];
    if (!forms.some(f => hasStem(o, f))) warnings.push(`${at}: term "${t.target}" (${t.id}) niet gevonden`);
    // Staat het avoid-woord zelf in de Engelse bron (een afkorting uitgeschreven: "Critical Path Method"), dan is het overgenomen.
    // Alleen vormen en labels die het avoid-woord zelf bevatten worden weggestreept ("konec projektu" ⊃ "konec");
    // een korte vorm als "المهام" mag "قائمة المهام" niet opbreken.
    const hits = (t.avoid ?? []).filter(a => avoidWords(prose, [...allForms, ...labelTexts].filter(f => hasWord(f, a)), [a]).length > 0)
      .filter(a => !hasWord(s, a));
    for (const a of hits) {
      if (avoidSoft.has(a.toLocaleLowerCase())) { warnings.push(`${at}: vermijd "${a}" (${t.id}) — ook een gewoon woord; alleen goed als het Engels hier iets anders bedoelt dan de term`); continue; }
      errors.push(`${at}: vermijd "${a}" (${t.id}) — schrijf de term "${t.target}"${forms.length > 1 ? ` of een vorm ervan (${forms.slice(0, 4).join(', ')})` : ''}; heeft het Engelse woord hier een andere betekenis, vertaal het dan zonder "${a}"`);
    }
  }
  const ratio = o.length / Math.max(1, s.length);
  if (ratio > 1.8) warnings.push(`${at}: ${o.length} tekens, de bron ${s.length} (>1,8×)`);
  if (ratio < (CJK.test(o) ? 0.15 : 0.4)) warnings.push(`${at}: ${o.length} tekens, de bron ${s.length} (veel korter: iets weggelaten?)`);
  if (sectionHash(o) === sectionHash(s)) warnings.push(`${at}: gelijk aan en`);
}

/** Geen kop twee keer (behalve als de bron hem ook twee keer heeft). */
function duplicateHeadings(src: string, out: string): string[] {
  const heads = (md: string) => blocksOf(md).filter(b => b.kind.startsWith('h')).map(b => b.text.trim());
  const sb = bag(heads(src));
  return [...bag(heads(out))].filter(([h, n]) => n > 1 && n > (sb.get(h) ?? 0)).map(([h]) => `kop "${short(h)}" staat ${'meer dan één'} keer in de vertaling`);
}

/**
 * De docs-poort (§7): `.out.md` tegen `.src.md` en het pakket. Hard: dezelfde secties, blokken,
 * kopniveaus, links, afbeeldingen en lijstitems; de miniMarkdown-subset; geen dubbele kop; labels a/b/c
 * (een tabblad: precies een tabbladnaam als eigen cursief deel); inline code byte-gelijk (behalve `display`);
 * dezelfde cijferreeksen, alleen ASCII-cijfers; geen `{{…}}` die de bron niet heeft; tokens en keep-namen;
 * een avoid-woord als los woord (buiten code, labels en termvormen). Zacht: term niet gevonden, lengte,
 * gelijk aan en.
 */
export function checkDocs(pkg: DocsPackage, srcMd: string, outMd: string): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (outMd.trim() === '') return { errors: ['uitvoer: leeg'], warnings };
  const srcSecs = outSections(pkg, srcMd);
  if ('error' in srcSecs) return { errors: [`.src.md past niet bij het pakket: ${srcSecs.error}`], warnings };
  for (const line of subsetErrors(outMd)) errors.push(`regel ${line} (buiten de Markdown-subset)`);
  errors.push(...duplicateHeadings(srcMd, outMd));
  const outSecs = outSections(pkg, outMd);
  if ('error' in outSecs) { errors.push(outSecs.error); return { errors, warnings }; }
  pkg.sections.forEach((meta, k) => checkDocsSection(pkg, meta.index, srcSecs[k], outSecs[k], errors, warnings));
  return { errors, warnings };
}

/**
 * De poort op een samengevoegd artikel (`apply docs`): alleen wat over het hele artikel gaat — de
 * opbouw gelijk aan de en-bron, de subset, geen dubbele kop, een H1.
 */
export function checkDocsArticle(enMd: string, md: string): string[] {
  const errors: string[] = [];
  const a = structureOf(enMd);
  const b = structureOf(md);
  if (JSON.stringify(a) !== JSON.stringify(b)) errors.push(`opbouw wijkt af van en: ${JSON.stringify(b)} ≠ ${JSON.stringify(a)}`);
  for (const line of subsetErrors(md)) errors.push(`regel ${line} (buiten de Markdown-subset)`);
  errors.push(...duplicateHeadings(enMd, md));
  if (!/^#\s+\S/m.test(md)) errors.push('geen #-kop (titel)');
  if (splitSections(md).length !== splitSections(enMd).length) errors.push('aantal ##-secties wijkt af van en');
  return errors;
}

/** Kies de poort op basis van `kind` in het pakket. */
export function checkPackage(pkg: unknown, out: unknown): CheckResult {
  if (!isRecord(pkg)) return { errors: ['pakket: geen object'], warnings: [] };
  switch (pkg.kind) {
    case 'ui': return checkUi(pkg as unknown as UiPackage, out);
    case 'concepts': return checkConceptsOut(out);
    case 'terms': return checkTermsOut(pkg as unknown as TermsPackage, out);
    case 'terms-check': return checkTermsCheckOut(pkg as unknown as TermsCheckPackage, out);
    case 'docs': return { errors: ['pakket: docs-pakket — controleer met checkDocs (`.src.md` en `.out.md`)'], warnings: [] };
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
