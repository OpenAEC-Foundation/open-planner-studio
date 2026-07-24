// Fase 2.10, onderdeel 5, golf 7 (QA): statische verificatie van de in-app help-documentatie
// (`public/docs/**`) — analoog aan `scripts/verify-examples.ts` (exit 0/1, per-item OK/XX-output).
// Draait puur op bestanden/JSON (geen store nodig), maar loopt via dezelfde `run-ts.mjs`-harness
// als verify-examples zodat de invocatie-conventie (`npm run verify:docs`) identiek blijft.
//
// Checks:
//   1. Elk manifest-artikel-id heeft public/docs/nl/<id>.md EN public/docs/en/<id>.md; geen
//      wees-bestanden (md op schijf zonder manifest-entry); geen dubbele ids in het manifest.
//   2. Elke docs://<id>-link wijst naar een bestaand manifest-id.
//   3. Elke examples://<file>-link wijst naar een bestand in public/examples/manifest.json.
//   4. title.nl/title.en niet leeg; layer ∈ {quickstart, gidsen, referentie}.
//   5. Parser-compatibiliteit tegen de subset die src/utils/miniMarkdown.tsx ondersteunt (koppen
//      #/##/### zonder nesting, paragrafen, single-level ongeordende/geordende lijsten, **vet**/
//      *cursief*/`code`, ```-codeblokken, alleen docs://- en examples://-links, ![alt](pad)):
//      waarschuwt op h4+, tabellen, blockquotes, horizontale lijnen, genest/ingesprongen
//      lijst-items, voetnoten, reference-style links, raw HTML-tags (buiten inline-code) en
//      linkschema's anders dan docs:///examples://.
//   6. Basishygiëne: geen dubbele koppen binnen één artikel, geen lege bestanden, NL≉EN
//      (>60% identieke niet-lege regels tussen de twee taalversies = verdachte niet-vertaling).
//
//   npm run verify:docs          # exit 0 = alles groen, 1 = minstens één afwijking
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DOCS_DIR = join(ROOT, 'public', 'docs');
const MANIFEST_PATH = join(DOCS_DIR, 'manifest.json');
const EXAMPLES_MANIFEST_PATH = join(ROOT, 'public', 'examples', 'manifest.json');

interface ManifestArticle {
  id: string;
  title?: Record<string, string>;
  layer?: string;
  cluster?: string;
}
interface Manifest {
  version: number;
  articles: ManifestArticle[];
}

const VALID_LAYERS = new Set(['quickstart', 'gidsen', 'referentie']);
// Alle 14 UI-locales met een eigen vertaalde docs-map (moet gelijk lopen met DOC_LANGS in
// src/components/backstage/HelpPanel.tsx en Locale in src/i18n/config.ts).
const LANGS = ['nl', 'en', 'fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'fa'] as const;

interface Check { ok: boolean; msg: string }
function expect(diffs: string[], ok: boolean, msg: string): Check {
  if (!ok) diffs.push(msg);
  return { ok, msg };
}

function loadManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

function loadExampleFiles(): Set<string> {
  const raw = JSON.parse(readFileSync(EXAMPLES_MANIFEST_PATH, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.examples ?? [];
  return new Set(list.map((e: any) => e.file));
}

/** Strip fenced code blocks and inline-code spans vóór de parser-compat-scan, zodat backtick-
 *  gequote voorbeeldsyntax (bv. `` `<Notes>` `` als MSPDI-veldnaam) niet als "raw HTML" of anders
 *  onbedoeld gemarkeerd wordt — binnen `code` rendert miniMarkdown de tekst altijd als platte
 *  tekst, dus daar gelden de blok-niveau-beperkingen niet. */
function stripCode(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length))
    .replace(/`[^`\n]+`/g, (m) => ' '.repeat(m.length));
}

const HEADER_RE = /^(#{1,3})\s+(.*)$/;

function extractHeadings(source: string): string[] {
  const headings: string[] = [];
  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    const m = HEADER_RE.exec(line);
    if (m) headings.push(m[2].trim());
  }
  return headings;
}

/** Kop-NIVEAUS (1/2/3) in volgorde — code-blokken eerst gestript zodat een `#`-shellcomment in een
 *  ```-blok niet als kop meetelt. Dient voor de bron↔vertaling-pariteitscheck (tekst mag verschillen,
 *  maar aantal + niveauvolgorde niet). */
function extractHeadingLevels(source: string): number[] {
  const levels: number[] = [];
  for (const line of stripCode(source).replace(/\r\n/g, '\n').split('\n')) {
    const m = HEADER_RE.exec(line);
    if (m) levels.push(m[1].length);
  }
  return levels;
}

/** Alle interne link-targets (docs://, examples://) gesorteerd — voor de bron↔vertaling-pariteit:
 *  een vertaling mag geen link laten vallen, toevoegen of het target wijzigen (labels mogen wél
 *  vertaald zijn; die staan hier niet in). */
function extractLinkTargets(source: string): string[] {
  return [...source.matchAll(/(docs|examples):\/\/([^\s)\]]+)/g)]
    .map((m) => `${m[1]}://${m[2]}`)
    .sort();
}

/** Check 5: markdown-constructies buiten de subset die src/utils/miniMarkdown.tsx ondersteunt. */
function checkParserCompat(id: string, lang: string, source: string, diffs: string[]) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const scanLines = stripCode(source).replace(/\r\n/g, '\n').split('\n');
  const label = `${id}/${lang}`;

  scanLines.forEach((line, idx) => {
    const n = idx + 1;
    if (/^#{4,}\s/.test(line)) {
      diffs.push(`${label}:${n} h4+ kop niet ondersteund (parser kent alleen #/##/###)`);
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      diffs.push(`${label}:${n} tabel-syntax (|) niet ondersteund door miniMarkdown`);
    }
    if (/^\s*>/.test(line)) {
      diffs.push(`${label}:${n} blockquote (>) niet ondersteund door miniMarkdown`);
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      diffs.push(`${label}:${n} horizontale lijn (---/***) niet ondersteund door miniMarkdown`);
    }
    if (/^\s{1,}[-*]\s+\S/.test(line)) {
      diffs.push(`${label}:${n} ingesprongen (geneste) ongeordende lijst-item niet ondersteund — UL_RE vereist regel-start op kolom 0`);
    }
    if (/^\s{1,}\d+\.\s+\S/.test(line)) {
      diffs.push(`${label}:${n} ingesprongen (geneste) geordende lijst-item niet ondersteund — OL_RE vereist regel-start op kolom 0`);
    }
    if (/\[\^[^\]]+\]/.test(line)) {
      diffs.push(`${label}:${n} voetnoot-syntax ([^ref]) niet ondersteund door miniMarkdown`);
    }
    if (/\[[^\]]+\]\[[^\]]*\]/.test(line)) {
      diffs.push(`${label}:${n} reference-style link ([tekst][ref]) niet ondersteund door miniMarkdown`);
    }
    if (/~~[^~]+~~/.test(line)) {
      diffs.push(`${label}:${n} doorhaal-syntax (~~tekst~~) niet ondersteund door miniMarkdown`);
    }
    const htmlTag = /<\/?[a-zA-Z][a-zA-Z0-9]*(\s[^<>]*)?>/.exec(line);
    if (htmlTag) {
      diffs.push(`${label}:${n} raw HTML-tag (${htmlTag[0]}) wordt niet geïnterpreteerd, alleen als platte tekst getoond`);
    }
    // Linkschema's anders dan docs://, examples:// (echte tekst — inline code is al gestript,
    // dus dit ziet ook markdown-links binnen backticks niet als fout-positief).
    const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(line)) !== null) {
      const href = lm[1];
      if (!href.startsWith('docs://') && !href.startsWith('examples://')) {
        diffs.push(`${label}:${n} linkschema niet toegestaan (alleen docs:// en examples://): ${href}`);
      }
    }
  });

  // Afbeeldingen: pad moet niet-leeg zijn (parser lost het altijd op tegen BASE_URL/docs/<pad>,
  // dus een lege/ontbrekende alt of pad is een content-fout, geen parser-fout — toch signaleren).
  const imgRe = /!\[([^\]]*)\]\(([^)]*)\)/g;
  let im: RegExpExecArray | null;
  const rawLines = lines;
  rawLines.forEach((line, idx) => {
    imgRe.lastIndex = 0;
    while ((im = imgRe.exec(line)) !== null) {
      if (!im[2].trim()) diffs.push(`${label}:${idx + 1} afbeelding zonder pad: ![${im[1]}]()`);
    }
  });
}

/** Check 6c: vertaalsteekproef — een verdacht hoog aandeel woordelijk identieke regels (>60%) t.o.v.
 *  het Engelse bronbestand duidt op een vergeten/overgeslagen vertaling (bv. GLM die de tekst in het
 *  Engels liet staan, of NL-tekst gekopieerd naar het EN-bestand). */
function checkTranslationDrift(id: string, lang: string, translated: string, enSource: string, diffs: string[]) {
  const norm = (s: string) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const tLines = norm(translated);
  const enLines = norm(enSource);
  if (tLines.length === 0 || enLines.length === 0) return; // lege-bestand-check gebeurt elders
  const enSet = new Set(enLines);
  const identical = tLines.filter((l) => enSet.has(l)).length;
  const ratio = identical / tLines.length;
  if (ratio > 0.6) {
    diffs.push(`${id}: ${lang} verdacht identiek aan EN (${Math.round(ratio * 100)}% van de ${lang}-regels komt woordelijk terug in EN) — vertaling mogelijk vergeten`);
  }
}

function main() {
  let anyFail = false;
  const globalDiffs: string[] = [];

  const manifest = loadManifest();
  const exampleFiles = loadExampleFiles();
  const ids = manifest.articles.map((a) => a.id);
  const idSet = new Set(ids);

  // 1a. Dubbele ids in het manifest.
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  for (const d of dupes) globalDiffs.push(`manifest: dubbele id "${d}"`);

  // 1b. Wees-bestanden: .md op schijf zonder manifest-entry.
  for (const lang of LANGS) {
    const dir = join(DOCS_DIR, lang);
    if (!existsSync(dir)) { globalDiffs.push(`map ontbreekt: public/docs/${lang}`); continue; }
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const id = file.slice(0, -3);
      if (!idSet.has(id)) globalDiffs.push(`wees-bestand zonder manifest-entry: public/docs/${lang}/${file}`);
    }
  }

  console.log('── Manifest-hygiëne ──');
  if (globalDiffs.length === 0) console.log('  OK  geen dubbele ids, geen wees-bestanden');
  else { anyFail = true; for (const d of globalDiffs) console.log(`  XX  ${d}`); }

  // 2/3/4/5/6: per artikel.
  for (const article of manifest.articles) {
    const diffs: string[] = [];

    // 1c. Bestaan van beide taalbestanden.
    const paths: Record<string, string> = {};
    for (const lang of LANGS) {
      const p = join(DOCS_DIR, lang, `${article.id}.md`);
      paths[lang] = p;
      expect(diffs, existsSync(p), `ontbreekt: public/docs/${lang}/${article.id}.md`);
    }

    // 4. Titels (alle 14 talen) + layer.
    for (const lang of LANGS) {
      expect(diffs, !!article.title?.[lang]?.trim(), `title.${lang} ontbreekt of is leeg`);
    }
    expect(diffs, !!article.layer && VALID_LAYERS.has(article.layer), `ongeldige layer "${article.layer}" (verwacht quickstart/gidsen/referentie)`);

    const sources: Record<string, string> = {};
    for (const lang of LANGS) {
      if (!existsSync(paths[lang])) continue;
      const source = readFileSync(paths[lang], 'utf8');
      sources[lang] = source;

      // 6b. Lege bestanden.
      expect(diffs, source.trim().length > 0, `${lang}: bestand is leeg`);

      // 2. docs://-links.
      const docsLinks = [...source.matchAll(/docs:\/\/([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
      for (const target of docsLinks) {
        expect(diffs, idSet.has(target), `${lang}: docs://${target} wijst naar een onbekend artikel-id`);
      }

      // 3. examples://-links.
      const exLinks = [...source.matchAll(/examples:\/\/([^\s)\]]+)/g)].map((m) => m[1]);
      for (const file of exLinks) {
        expect(diffs, exampleFiles.has(file), `${lang}: examples://${file} staat niet in public/examples/manifest.json`);
      }

      // 5. Parser-compatibiliteit.
      checkParserCompat(article.id, lang, source, diffs);

      // 6a. Dubbele koppen binnen één artikel.
      const headings = extractHeadings(source);
      const headSeen = new Set<string>();
      for (const h of headings) {
        if (headSeen.has(h)) diffs.push(`${lang}: dubbele kop "${h}"`);
        headSeen.add(h);
      }
    }

    // 6c. Vertaalsteekproef: elke niet-EN-taal mag niet grotendeels woordelijk gelijk zijn aan EN.
    if (sources.en) {
      for (const lang of LANGS) {
        if (lang === 'en') continue;
        if (sources[lang]) checkTranslationDrift(article.id, lang, sources[lang], sources.en, diffs);
      }
    }

    // 6d. Structuur-pariteit vertaling ↔ EN-bron: kop-aantal + niveauvolgorde en de link-target-set
    //     (docs://, examples://) moeten identiek zijn. Vangt een vertaling die een sectie of interne
    //     link laat vallen/toevoegt — wat de andere checks per taal niet zien (labels/tekst mogen
    //     verschillen, structuur niet). EN is de bron van waarheid.
    if (sources.en) {
      const enLevels = extractHeadingLevels(sources.en);
      const enLinks = extractLinkTargets(sources.en);
      for (const lang of LANGS) {
        if (lang === 'en' || !sources[lang]) continue;
        const lLevels = extractHeadingLevels(sources[lang]);
        if (lLevels.length !== enLevels.length || lLevels.some((v, i) => v !== enLevels[i])) {
          diffs.push(`${lang}: kop-structuur wijkt af van EN — EN heeft ${enLevels.length} koppen [${enLevels.join('')}], ${lang} heeft ${lLevels.length} [${lLevels.join('')}] (sectie mogelijk weggevallen/toegevoegd)`);
        }
        const lLinks = extractLinkTargets(sources[lang]);
        if (lLinks.length !== enLinks.length || lLinks.some((v, i) => v !== enLinks[i])) {
          diffs.push(`${lang}: link-targets wijken af van EN — EN [${enLinks.join(', ')}] vs ${lang} [${lLinks.join(', ')}]`);
        }
      }
    }

    const ok = diffs.length === 0;
    if (!ok) anyFail = true;
    console.log(`${ok ? 'OK ' : 'XX '} ${article.id}`);
    for (const d of diffs) console.log(`     - ${d}`);
  }

  console.log(`\n${manifest.articles.length} artikelen × ${LANGS.length} talen geverifieerd — ${anyFail ? 'FALEN' : 'alles groen'}`);
  process.exit(anyFail ? 1 : 0);
}

main();
