// Fase 2.10, onderdeel 5, golf 7 (QA): statische verificatie van de in-app help-documentatie
// (`public/docs/**`) — analoog aan `scripts/verify-examples.ts` (exit 0/1, per-item OK/XX-output).
// Draait puur op bestanden/JSON (geen store nodig), maar loopt via dezelfde `run-ts.mjs`-harness
// als verify-examples zodat de invocatie-conventie (`npm run verify:docs`) identiek blijft.
//
// Checks:
//   1. Elk manifest-artikel-id heeft public/docs/nl/<id>.md EN public/docs/en/<id>.md (brontalen,
//      hard vereist); de overige 12 talen worden gevalideerd wanneer aanwezig maar mogen ontbreken
//      (maandelijkse vertaalronde; voor nieuwe `kind`-artikelen zijn ze helemaal niet vereist).
//      Geen wees-bestanden (md zonder manifest-entry); geen dubbele ids.
//   2. Elke docs://<id>-link wijst naar een bestaand manifest-id of een alias; een `#anker` erachter
//      moet een kop in dat artikel zijn (zelfde taal, anders en; ankers volgen `headingSlug` in
//      src/utils/helpManifest.ts). Een niet-draft artikel linkt niet naar een draft (in productie
//      zou dat "artikel niet gevonden" geven).
//   3. Elke examples://<file>-link wijst naar een bestand in public/examples/manifest.json.
//   4. Manifest v2 (ontwerp gebruikersdocumentatie §6.1, bijgesteld 2026-09-28):
//      - `version` is 2; title.nl/title.en niet leeg (overige talen: niet leeg indien aanwezig);
//      - elk artikel heeft óf `layer` ∈ {quickstart, gidsen, referentie} (oud, tot fase 4) óf
//        `kind` ∈ {howto, uitleg, referentie} (nieuw), nooit beide. `kind: tutorial` en `order` horen
//        niet in het manifest: tutorials levert een extensie via src/utils/helpArticleRegistry.ts;
//      - `draft` is, als hij er staat, een boolean;
//      - `aliases` (oud id → nieuw id): het oude id is geen bestaand artikel-id (geen overschaduwing),
//        het nieuwe id bestaat en is geen draft.
//   5. Parser-compatibiliteit tegen de subset die src/utils/miniMarkdown.tsx ondersteunt (koppen
//      #/##/### zonder nesting, paragrafen, single-level ongeordende/geordende lijsten, **vet**/
//      *cursief*/`code`, ```-codeblokken, alleen docs://- en examples://-links, ![alt](pad)):
//      waarschuwt op h4+, tabellen, blockquotes, horizontale lijnen, genest/ingesprongen
//      lijst-items, voetnoten, reference-style links, raw HTML-tags (buiten inline-code) en
//      linkschema's anders dan docs:///examples://. Afbeeldingen: niet-lege alt-tekst en een
//      niet-leeg pad; de placeholder `{lang}` in het pad mag (de viewer vult nl of en in) en het
//      bestand moet onder public/docs bestaan (voor een draft een waarschuwing).
//   7/8. Machinaal controleerbare beweringen in CLAUDE.md (+ .claude/rules/)/AGENTS.md/README.md/CONTRIBUTING.md.
//   9. De agent-skill `goed-plannen` staat byte-identiek in `public/skills/` (bron, uitgeleverd)
//      en `.claude/skills/` (waar Claude Code hem leest) — geen symlink, want Windows-CI.
//   10. Elk artikel-id dat de app gebruikt — elke stringexport van src/state/helpArticles.ts en elke
//      `docsId` in src/services/updater/releaseHighlights.ts — bestaat in het manifest (als artikel
//      of alias) en is in productie zichtbaar (geen draft). Een `#anker` erin moet in nl én en
//      bestaan. Zo breekt een hernoemd artikel niet meer stil een "Lees meer" of een ?-knop.
//   6. Basishygiëne: geen dubbele koppen binnen één artikel, geen lege bestanden, NL≉EN
//      (>60% identieke niet-lege regels tussen de twee taalversies = verdachte niet-vertaling), en
//      geen achtergebleven nl/en-titel als h1, manifest-titel of docs://-linktekst in een vertaling.
//
//   npm run verify:docs          # exit 0 = alles groen, 1 = minstens één afwijking
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  HELP_IMAGE_LANG_PLACEHOLDER, MANIFEST_HELP_KINDS, extractHeadingSlugs, resolveHelpImagePath, splitHelpTarget,
} from '@/utils/helpManifest';
import * as APP_HELP_ARTICLES from '@/state/helpArticles';
import { RELEASE_HIGHLIGHT_CATALOG } from '@/services/updater/releaseHighlights';

const ROOT = process.cwd();
const DOCS_DIR = join(ROOT, 'public', 'docs');
const MANIFEST_PATH = join(DOCS_DIR, 'manifest.json');
const EXAMPLES_MANIFEST_PATH = join(ROOT, 'public', 'examples', 'manifest.json');

interface ManifestArticle {
  id: string;
  title?: Record<string, string>;
  layer?: string;
  kind?: string;
  order?: unknown;
  draft?: unknown;
  cluster?: string;
}
interface Manifest {
  version: number;
  articles: ManifestArticle[];
  aliases?: unknown;
}

const MANIFEST_VERSION = 2;

const VALID_LAYERS = new Set(['quickstart', 'gidsen', 'referentie']);
// Alle 14 UI-locales met een eigen vertaalde docs-map (moet gelijk lopen met DOC_LANGS in
// src/components/backstage/HelpPanel.tsx en Locale in src/i18n/config.ts).
const LANGS = ['nl', 'en', 'fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'fa'] as const;
// Brontalen: hard vereist voor elk artikel. De overige 12 worden maandelijks vertaald en daarom
// alleen gevalideerd wanneer ze aanwezig zijn — zo faalt de poort niet op een nieuw artikel dat nog
// niet vertaald is, terwijl bestaande vertalingen wél volledig getoetst blijven (structuur/drift/parser).
const SOURCE_LANGS: readonly string[] = ['nl', 'en'];
// Vertaalronde-modus: `npm run verify:docs -- --strict-translations` maakt de structuurcheck 6d ook
// voor de 12 vertaaltalen hard. Standaard is een achterlopende vertaling daar een waarschuwing (zie 6d).
const STRICT_TRANSLATIONS = process.argv.includes('--strict-translations');

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
  // Het `#anker` telt niet mee: dat volgt de koptekst en verschilt dus per taal.
  return [...source.matchAll(/(docs|examples):\/\/([^\s)\]#]+)/g)]
    .map((m) => `${m[1]}://${m[2]}`)
    .sort();
}

/** Check 5: markdown-constructies buiten de subset die src/utils/miniMarkdown.tsx ondersteunt. */
function checkParserCompat(id: string, lang: string, source: string, diffs: string[], draftNotes: string[], isDraft: boolean) {
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
    // `(?<!!)`: een afbeelding `![alt](pad)` is geen link (die toetst het afbeeldingsblok hieronder).
    const linkRe = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(line)) !== null) {
      const href = lm[1];
      if (!href.startsWith('docs://') && !href.startsWith('examples://')) {
        diffs.push(`${label}:${n} linkschema niet toegestaan (alleen docs:// en examples://): ${href}`);
      }
    }
  });

  // Afbeeldingen (codeblokken en inline code gestript: een voorbeeld-syntax telt niet). Het pad
  // wordt door de viewer opgelost tegen BASE_URL/docs/<pad>, met `{lang}` = nl of en; alt-tekst is
  // verplicht (schermlezers, en de placeholder als het beeld ontbreekt toont juist die tekst).
  const imgRe = /!\[([^\]]*)\]\(([^)]*)\)/g;
  let im: RegExpExecArray | null;
  scanLines.forEach((line, idx) => {
    imgRe.lastIndex = 0;
    while ((im = imgRe.exec(line)) !== null) {
      const [, alt, rawPath] = im;
      const where = `${label}:${idx + 1}`;
      if (!alt.trim()) diffs.push(`${where} afbeelding zonder alt-tekst: ![](${rawPath}) — beschrijf wat het beeld toont`);
      const path = rawPath.trim();
      if (!path) { diffs.push(`${where} afbeelding zonder pad: ![${alt}]()`); continue; }
      const leftover = path.split(HELP_IMAGE_LANG_PLACEHOLDER).join('').match(/\{[^}]*\}/);
      if (leftover) diffs.push(`${where} onbekende placeholder ${leftover[0]} in afbeeldingspad (alleen ${HELP_IMAGE_LANG_PLACEHOLDER})`);
      const resolved = resolveHelpImagePath(path, lang);
      if (/^[a-z]+:/i.test(resolved) || resolved.startsWith('/') || resolved.split('/').includes('..')) {
        diffs.push(`${where} afbeeldingspad moet relatief binnen public/docs blijven: ${path}`);
      } else if (!existsSync(join(DOCS_DIR, resolved))) {
        (isDraft ? draftNotes : diffs).push(`${where} afbeelding bestaat niet: public/docs/${resolved}`);
      }
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

/** De eerste h1 van een artikel (codeblokken gestript), of undefined. */
function firstH1(source: string): string | undefined {
  return /^# (.+)$/m.exec(stripCode(source).replace(/\r\n/g, '\n'))?.[1].trim();
}

/** De bronnamen van een artikel voor check 6e: de nl- en en-titel en -h1, min elke naam die in nl
 *  én en voorkomt. Zo'n naam is een internationaal woord ("Filters", "Layouts") en mag in elke taal
 *  zo heten; een naam die alleen in nl of alleen in en voorkomt, is brontaal. */
function sourceNames(article: ManifestArticle): Set<string> {
  const read = (lang: string) => {
    const p = join(DOCS_DIR, lang, `${article.id}.md`);
    return existsSync(p) ? firstH1(readFileSync(p, 'utf8')) : undefined;
  };
  const nl = [article.title?.nl, read('nl')].filter((s): s is string => !!s);
  const en = [article.title?.en, read('en')].filter((s): s is string => !!s);
  return new Set([...nl, ...en].filter((s) => !(nl.includes(s) && en.includes(s))));
}

/** Check 6e: achtergebleven brontitels. Een vertaling (niet nl/en) mag een bronnaam (zie
 *  `sourceNames`) niet letterlijk dragen als h1, als manifest-titel of als tekst van een
 *  docs://-link naar dat artikel. Zo bleven twintig zh-gidsen met een Nederlandse h1 staan
 *  ("Sneltoetsen & bediening") en stond "Task types" als titel in twaalf talen: de TOC was vertaald,
 *  het artikel of de verwijzing niet. Alleen letterlijke gelijkheid telt, dus een eigen vertaling
 *  of parafrase slaagt altijd. */
function checkUntranslatedTitles(
  article: ManifestArticle,
  sources: Record<string, string>,
  namesById: Map<string, Set<string>>,
  diffs: string[],
) {
  const own = namesById.get(article.id) ?? new Set<string>();
  for (const lang of LANGS) {
    if (SOURCE_LANGS.includes(lang)) continue;
    const title = article.title?.[lang];
    if (title && own.has(title)) {
      diffs.push(`title.${lang} "${title}" is de onvertaalde nl/en-titel — vertaal hem of laat hem weg (dan geldt title.en)`);
    }
    const source = sources[lang];
    if (!source) continue;
    const h1 = firstH1(source);
    if (h1 && own.has(h1)) {
      diffs.push(`${lang}: h1 "${h1}" is de onvertaalde nl/en-titel`);
    }
    for (const m of stripCode(source).matchAll(/\[([^\]]+)\]\(docs:\/\/([a-zA-Z0-9_-]+)\)/g)) {
      if (namesById.get(m[2])?.has(m[1].trim())) {
        diffs.push(`${lang}: linktekst "[${m[1]}](docs://${m[2]})" is de onvertaalde nl/en-titel van dat artikel`);
      }
    }
  }
}

/** De padgebonden Claude-rules (`.claude/rules/*.md`): de diepgang die uit CLAUDE.md is verhuisd
 *  zodat CLAUDE.md zelf klein blijft. Ze hoeven de "moet genoemd worden"-beweringen van Poort 7 niet
 *  te herhalen, maar wát ze beweren mag niet wegdrijven — daarom lezen 7c (dode `npm run`), 7e (het
 *  toolaantal) en 8d (`localhost:3007`) ze mee. */
function readClaudeRules(): Record<string, string> {
  const dir = join(ROOT, '.claude', 'rules');
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.md')) out[`.claude/rules/${file}`] = readFileSync(join(dir, file), 'utf8');
  }
  return out;
}

/**
 * Poort 7 — machinaal controleerbare beweringen in CLAUDE.md.
 *
 * CLAUDE.md en AGENTS.md zijn de eerste bron die een bijdrager (mens of agent) leest, en ze
 * driftten stelselmatig: de dev-server-beschrijving stond ruim een maand achter op de code, de
 * auto-save-interval noemde nog de oude waarde, en twee ribbon-tabbladen plus drie
 * Backstage-secties ontbraken. Elk van die gevallen was mechanisch te betrappen geweest.
 *
 * Deze check pakt alleen de beweringen die je écht uit de code kúnt afleiden. Prozaïsche
 * beweringen blijven mensenwerk — er wordt hier bewust geen tekstuele gelijkenis gemeten.
 */
function checkAgentDocs(diffs: string[]): void {
  const claude = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  const types = readFileSync(join(ROOT, 'src', 'state', 'slices', 'types.ts'), 'utf8');
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };

  // 7a. `RibbonTab` en `BackstageSection`: elk lid van de union moet als `identifier` in CLAUDE.md
  //     staan. Backticks in plaats van de Nederlandse weergavenaam, juist zodat dit te checken is.
  const union = (name: string): string[] => {
    const m = types.match(new RegExp(`export type ${name} =([\\s\\S]*?);`));
    if (!m) return [];
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };
  for (const typeName of ['RibbonTab', 'BackstageSection']) {
    const members = union(typeName);
    if (members.length === 0) {
      diffs.push(`CLAUDE.md-check: kon de union ${typeName} niet uit slices/types.ts lezen (is hij hernoemd?)`);
      continue;
    }
    const missing = members.filter((m) => !claude.includes(`\`${m}\``));
    if (missing.length) {
      diffs.push(`CLAUDE.md noemt ${missing.length} van de ${members.length} ${typeName}-waarden niet: ${missing.map((m) => `\`${m}\``).join(', ')}`);
    }
  }

  // 7b. De auto-save-interval. Dit is precies de bewering die verouderde ("gedebounced 800 ms"
  //     terwijl de code al op een throttle van 10 s zat) — een getal dat in twee bestanden staat.
  const autoSave = readFileSync(join(ROOT, 'src', 'hooks', 'useAutoSave.ts'), 'utf8');
  const intervalMatch = autoSave.match(/AUTOSAVE_INTERVAL_MS\s*=\s*([\d_]+)/);
  if (!intervalMatch) {
    diffs.push('CLAUDE.md-check: AUTOSAVE_INTERVAL_MS niet gevonden in useAutoSave.ts');
  } else {
    const seconds = Number(intervalMatch[1].replace(/_/g, '')) / 1000;
    if (!claude.includes(`${seconds} s`)) {
      diffs.push(`CLAUDE.md noemt de auto-save-interval niet als "${seconds} s" (useAutoSave.ts staat op ${intervalMatch[1]} ms)`);
    }
  }

  // 7c. Elk npm-script moet in CLAUDE.md staan, en elk `npm run X` in CLAUDE.md moet bestaan.
  //     Zo werd `verify:docs`/`publish:wiki` onzichtbaar: het script bestond, de doc noemde het niet,
  //     en een agent wist dus niet dat er een 14-talige handleiding meemoet bij een nieuwe functie.
  //     Uitgezonderd: wrappers en aliassen die niets toevoegen aan wat er al beschreven staat.
  const SCRIPT_ALLOWLIST = new Set(['tauri', 'preview']);
  const undocumented = Object.keys(pkg.scripts)
    .filter((s) => !SCRIPT_ALLOWLIST.has(s))
    .filter((s) => !claude.includes(`npm run ${s}`) && !(s === 'test' && claude.includes('npm test')));
  if (undocumented.length) {
    diffs.push(`package.json-scripts die CLAUDE.md niet noemt: ${undocumented.join(', ')}`);
  }
  const rules = readClaudeRules();
  for (const [name, text] of Object.entries({ 'CLAUDE.md': claude, ...rules })) {
    const referenced = [...text.matchAll(/npm run ([a-z][\w:-]*)/g)].map((m) => m[1]);
    const dangling = [...new Set(referenced)].filter((s) => !(s in pkg.scripts));
    if (dangling.length) {
      diffs.push(`${name} verwijst naar npm-scripts die niet bestaan: ${dangling.join(', ')}`);
    }
  }

  // 7d. De locale-lijst. CLAUDE.md somt de talen op in één backtick-span; die span wordt hier
  //     GEPARSED en als verzameling vergeleken. Bewust niet met `claude.includes('ko')`: een
  //     tweeletterige code komt overal als deelwoord voor ("ko" in "koppeling"), dus zo'n check
  //     slaagt altijd — vacuüm groen, precies de faalmodus die dit script hoort te vangen.
  const listSpan = [...claude.matchAll(/`([a-z]{2}(?:,\s*[a-z]{2})+)`/g)]
    .map((m) => m[1].split(',').map((s) => s.trim()))
    .find((codes) => codes.length >= LANGS.length - 2);
  if (!listSpan) {
    diffs.push(`CLAUDE.md bevat geen herkenbare locale-opsomming (verwacht: een backtick-span met ${LANGS.length} komma-gescheiden codes)`);
  } else {
    const missing = LANGS.filter((l) => !listSpan.includes(l));
    const extra = listSpan.filter((l) => !(LANGS as readonly string[]).includes(l));
    if (missing.length) diffs.push(`CLAUDE.md's locale-opsomming mist: ${missing.join(', ')}`);
    if (extra.length) diffs.push(`CLAUDE.md's locale-opsomming noemt onbekende locales: ${extra.join(', ')}`);
  }

  // 7e. Het aantal `planner_*`-MCP-tools. Dit getal dreef stil weg (CLAUDE.md zei 38 terwijl de
  //     bridge er 39 draaide): een tool erbij is één regel in de registry, en niemand denkt dan
  //     aan een zin verderop in CLAUDE.md. Precies het soort drift dat deze poort hoort te vangen.
  //     Geteld over de tool-bestanden zelf, niet over een lijst die óók bij kan raken.
  //
  //     Bewust GEEN dynamic import van toolRegistry.ts/toolIndex.ts hier: dat sleept via
  //     `contracts.ts` → `AppStoreContext` de hele storelaag (en indirect Tauri/DOM-afhankelijkheden)
  //     mee een kaal Node-script in dat verder puur op bestanden/JSON draait (zie de kopcommentaar
  //     hierboven) — precies de complicatie die `tests/mcp/cases-toolregistry.ts` uit de weg gaat
  //     door ook niet te importeren, maar wél de bron te lezen.
  //
  //     In plaats daarvan hergebruiken we exact dezelfde aanpak als die poort (zie de toelichting
  //     bovenin `cases-toolregistry.ts`): een regex op de `name: '...'`-veldliteralen van de
  //     `McpToolDef`-objecten, niet op elke `planner_...`-achtige stringliteral. De oude regex
  //     (`['"](planner_[a-z_]+)['"]`) matchte ELKE stringliteral met die vorm — dus ook een
  //     tool-naam die louter in beschrijvingsproza wordt genoemd (bv. "roep hierna planner_foo aan")
  //     terwijl `planner_foo` niet bestaat. Zo'n verzonnen naam voegde stil een extra element aan de
  //     Set toe zonder dat er een tool bijkwam — de telling bleef toevallig kloppen zolang niemand
  //     ook de N in CLAUDE.md aanpaste, en een niet-bestaande tool in de doc-tekst viel dus nooit op.
  //     De `name:`-geankerde regex telt uitsluitend de daadwerkelijke contract-registraties.
  const toolsDir = join(ROOT, 'src', 'services', 'mcp', 'tools');
  const toolNames = new Set<string>();
  for (const file of readdirSync(toolsDir)) {
    if (!file.endsWith('.ts')) continue;
    const src = readFileSync(join(toolsDir, file), 'utf8');
    for (const m of src.matchAll(/\bname:\s*["'](planner_[a-z_]+)["']/g)) toolNames.add(m[1]);
  }
  const claimed = claude.match(/De (\d+)\s*\n?`planner_\*`-tools/);
  if (!claimed) {
    diffs.push('CLAUDE.md-check: geen "De N `planner_*`-tools"-bewering gevonden (is de zin herschreven?)');
  } else if (Number(claimed[1]) !== toolNames.size) {
    diffs.push(`CLAUDE.md zegt ${claimed[1]} \`planner_*\`-tools, maar src/services/mcp/tools/ definieert er ${toolNames.size}`);
  }
  for (const [name, text] of Object.entries(rules)) {
    const ruleClaim = text.match(/De (\d+)\s*\n?`planner_\*`-tools/);
    if (ruleClaim && Number(ruleClaim[1]) !== toolNames.size) {
      diffs.push(`${name} zegt ${ruleClaim[1]} \`planner_*\`-tools, maar src/services/mcp/tools/ definieert er ${toolNames.size}`);
    }
  }
}

/** Knipt fenced code blocks (```…```) uit vóórdat we op backtick-spans scannen, zodat een
 *  commentaarregel in een ```bash-blok niet meetelt als "backtick-vermelding" — alleen ECHTE
 *  inline-code-citaten in lopende tekst tellen. Regeltelling blijft gelijk (newlines behouden) zodat
 *  eventuele toekomstige regelnummer-gebaseerde diagnostiek niet verschuift. */
function stripFencedBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Alle inline single-backtick-spans in `text`, ná het strippen van fenced code blocks. */
function backtickSpans(text: string): string[] {
  return [...stripFencedBlocks(text).matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

/** Staat `token` als LOS WOORD (regex-`\b`) binnen minstens één backtick-span? Dekt zowel een kale
 *  vermelding (`` `verify:cycles` ``) als ingebed in een grotere backtickte vorm (`` `npm run
 *  test:planning` ``, `` `tests/mcp/` ``) — maar NIET een toevallige substring in kale lopende tekst
 *  (bv. "lint" binnen "**No lint script.**", of "mcp" binnen een niet-backtickt Engels/Nederlands
 *  woord). Dat onderscheid is precies wat Poort 8b/8c hoort te maken; zie het docblock hierboven. */
function mentionsToken(text: string, token: string): boolean {
  const re = new RegExp(`\\b${escapeRegExp(token)}\\b`);
  return backtickSpans(text).some((span) => re.test(span));
}

/**
 * Poort 8 — AGENTS.md, README.md en CONTRIBUTING.md mechanisch tegen package.json (en, voor de
 * poortbewering, tegen CLAUDE.md en de handmatig onderhouden wiki-bronpagina's in `docs/wiki/`).
 *
 * Poort 7 hierboven bewaakt alléén CLAUDE.md. De drie andere top-level onboardingdocumenten lazen
 * niet mee en dreven onopgemerkt weg — AGENTS.md beweerde "no lint script" terwijl er allang een
 * `npm run lint` bestond, README had een Ribbon-tab "Relaties" die niet bestaat, en CONTRIBUTING
 * had zowel een hardgecodeerde poort 3007 (die per worktree varieert) als een verify-tabel die twee
 * ketenstappen miste.
 *
 * Wat deze poort WEL vangt — vijf beweringen die uit package.json (en het docs-manifest) af te
 * leiden zijn:
 *   8a. dode `npm run <x>`-verwijzingen in de drie bestanden;
 *   8b. of AGENTS.md/CONTRIBUTING.md elke stap uit de `verify`-keten noemt;
 *   8c. of alle drie de bestanden elke suite uit `npm test` noemen;
 *   8d. hardgecodeerde `localhost:3007` (AGENTS/README/CONTRIBUTING/CLAUDE.md/de wiki-bronpagina's);
 *   8e. of README's "N artikelen"-bewering (indien aanwezig) het manifest-aantal volgt.
 *
 * 8b/8c tellen een stap-/suitenaam alleen mee als hij als LOS WOORD binnen een backtick-span
 * voorkomt in lopende tekst (`mentionsToken` hierboven) — bv. `` `verify:cycles` ``,
 * `` `npm run test:planning` `` of `` `tests/mcp/` ``. Vermeldingen binnen ```-fenced code blocks
 * tellen daarbij NIET mee (`stripFencedBlocks` knipt ze eruit vóórdat er op backtick-spans gescand
 * wordt) — ook een letterlijke naam in een bash-commentaarregel is geen backtick-citaat in proza,
 * en zou anders precies het soort toevallige, niet-bedoelde match zijn die deze poort moet vermijden.
 * Kale substring-matching over de hele lopende tekst (de vorige versie van deze poort) is vacuüm
 * gebleken op twee manieren, allebei gevonden door
 * de review tegen de PRE-diff-documenten: (1) een bewering als "**No lint script.**" bevat toevallig
 * de substring "lint" en liet die leugen dus vals slagen; (2) korte namen als `mcp`/`test`/`library`
 * matchen bijna altijd ergens toevallig in Nederlands/Engels proza, dus de check kon nooit rood
 * worden ook al ontbrak de bedoelde vermelding. Backtick-scoping + woordgrens sluit beide gaten.
 *
 * Wat deze poort NIET vangt: inhoudelijke onwaarheden waarvan de tegenspraak niet in package.json of
 * het manifest zit — bijvoorbeeld een architectuurbewering als "de enige `invoke()` is X" terwijl de
 * code drie commands aanroept, of een beschrijving van hoe `runCPM` intern werkt die niet meer klopt.
 * Dat soort proza blijft mensenwerk (of een gerichte poort zoals Poort 7 hierboven voor CLAUDE.md).
 */
function checkSupportingDocs(diffs: string[], manifestArticleCount: number): void {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const files: Record<string, string> = {
    'AGENTS.md': readFileSync(join(ROOT, 'AGENTS.md'), 'utf8'),
    'README.md': readFileSync(join(ROOT, 'README.md'), 'utf8'),
    'CONTRIBUTING.md': readFileSync(join(ROOT, 'CONTRIBUTING.md'), 'utf8'),
  };
  const claude = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  const wikiDir = join(ROOT, 'docs', 'wiki');
  const wikiFiles: Record<string, string> = {};
  if (existsSync(wikiDir)) {
    for (const file of readdirSync(wikiDir)) {
      if (file.endsWith('.md')) wikiFiles[`docs/wiki/${file}`] = readFileSync(join(wikiDir, file), 'utf8');
    }
  }

  // 8a. Dode verwijzingen: elke `npm run <x>` in deze drie bestanden moet als script bestaan.
  for (const [name, text] of Object.entries(files)) {
    const referenced = [...text.matchAll(/npm run ([a-z][\w:-]*)/g)].map((m) => m[1]);
    const dangling = [...new Set(referenced)].filter((s) => !(s in pkg.scripts));
    if (dangling.length) {
      diffs.push(`${name} verwijst naar npm-scripts die niet bestaan: ${dangling.join(', ')}`);
    }
  }

  // 8b. Verify-ketendekking: de stappenlijst wordt AFGELEID uit de `verify`-definitie in
  //     package.json (gesplitst op `&&`, `npm run `/`npm test` gestript) — niet hardgecodeerd, zodat
  //     een toekomstige ketenwijziging vanzelf een doc-update afdwingt. AGENTS.md en CONTRIBUTING.md
  //     moeten elke stapnaam als los woord binnen een backtick-span noemen (`mentionsToken`); README
  //     hoeft de keten niet te enumereren (zie 8c voor wat README wél moet noemen).
  if (typeof pkg.scripts.verify !== 'string') {
    diffs.push('package.json#scripts.verify ontbreekt of is geen string — Poort 8b kan de verify-keten niet lezen (check uitgezet, geen crash)');
  } else {
    const rawSteps = pkg.scripts.verify.split('&&').map((s) => s.trim());
    const verifySteps: string[] = [];
    const unparsed: string[] = [];
    for (const s of rawSteps) {
      if (s === 'npm test') { verifySteps.push('test'); continue; }
      const m = s.match(/^npm run ([\w:-]+)$/);
      if (m) { verifySteps.push(m[1]); continue; }
      unparsed.push(s);
    }
    if (unparsed.length) {
      // Bevinding: vóór deze guard viel Poort 8b terug op de rauwe shellstring als "stapnaam" en
      // eiste die letterlijk terug in de docs — een verwarrende, lekkende faalmelding. Nu een
      // expliciete, begrijpelijke melding in plaats van dat lek.
      diffs.push(`Poort 8b: de verify-keten bevat een stap zonder \`npm run <x>\`-vorm (${unparsed.join(', ')}) — breid Poort 8 uit (scripts/verify-docs.ts, checkSupportingDocs) in plaats van op de rauwe shellstring te vertrouwen`);
    }
    for (const name of ['AGENTS.md', 'CONTRIBUTING.md']) {
      const text = files[name];
      const missing = verifySteps.filter((step) => !mentionsToken(text, step));
      if (missing.length) {
        diffs.push(`${name} noemt niet elke stap uit de verify-keten (package.json#scripts.verify) als backtick-token: mist ${missing.join(', ')}`);
      }
    }
  }

  // 8c. Suitedekking: de suitelijst wordt AFGELEID uit de `test`-definitie (test:planning →
  //     planning, …). Alle drie de bestanden moeten elke suitenaam als los woord binnen een
  //     backtick-span noemen (bv. `` `tests/planning/` ``, `` `npm run test:planning` `` of kaal
  //     `` `planning` ``) — géén kale substring-match meer over lopende tekst.
  if (typeof pkg.scripts.test !== 'string') {
    diffs.push('package.json#scripts.test ontbreekt of is geen string — Poort 8c kan de suitelijst niet lezen (check uitgezet, geen crash)');
  } else {
    const suites = [...pkg.scripts.test.matchAll(/npm run test:([\w-]+)/g)].map((m) => m[1]);
    for (const [name, text] of Object.entries(files)) {
      const missing = suites.filter((suite) => !mentionsToken(text, suite));
      if (missing.length) {
        diffs.push(`${name} noemt niet elke suite uit package.json#scripts.test als backtick-token: mist ${missing.join(', ')}`);
      }
    }
  }

  // 8d. Hardgecodeerde dev-poort. De poort is per worktree vast toegewezen in het bereik 3007–3106
  //     (scripts/dev-port.mjs), niet altijd 3007 — "localhost:3007" hardcoderen is dus altijd fout,
  //     ook in CLAUDE.md en de handmatig onderhouden wiki-bronpagina's (`docs/wiki/*.md`, die via
  //     `npm run publish:wiki` naar de publieke GitHub-wiki gaan).
  for (const [name, text] of Object.entries({ ...files, 'CLAUDE.md': claude, ...readClaudeRules(), ...wikiFiles })) {
    if (text.includes('localhost:3007')) {
      diffs.push(`${name} hardcodeert "localhost:3007" — de dev-poort is per worktree vast toegewezen (3007–3106); lees hem uit de dev-server-uitvoer of .claude/launch.json`);
    }
  }

  // 8e. README's artikelaantal. "N artikelen" in README.md (Projectstructuur-boom) moet gelijk zijn
  //     aan het aantal manifest-artikelen — zelfde idee als Poort 7b's auto-save-intervalcheck: een
  //     getal dat los in twee bronnen staat en stil kan wegdrijven (27 vs. 31 was zo'n geval, gemeten
  //     2026-09-01). Alleen gecontroleerd als README de bewering al maakt — geen eis dat hij bestaat.
  const articleClaim = files['README.md'].match(/(\d+)\s+artikelen/);
  if (articleClaim && Number(articleClaim[1]) !== manifestArticleCount) {
    diffs.push(`README.md zegt "${articleClaim[1]} artikelen" maar public/docs/manifest.json telt er ${manifestArticleCount}`);
  }
}

/**
 * Poort 9 — de agent-skill "goed-plannen" heeft ÉÉN bron.
 *
 * `public/skills/goed-plannen/SKILL.md` is de bron: die wordt met de webbuild meegeleverd en is dus
 * publiek downloadbaar (én de tool `planner_get_planning_guide` leest hem daar). Claude Code leest
 * skills uitsluitend uit `.claude/skills/`, dus daar moet een kopie staan. Een symlink kan niet:
 * CI draait óók op Windows, waar een repo-symlink zonder ontwikkelaarsmodus als tekstbestand
 * uitcheckt — dan serveert de app een pad in plaats van een skill.
 *
 * Dus: byte-identieke kopie, met deze poort als bewaker. Wijzig altijd de bron in `public/` en
 * kopieer daarna; de foutmelding hieronder zegt precies dat.
 */
function checkSkillCopy(diffs: string[]): void {
  const source = join(ROOT, 'public', 'skills', 'goed-plannen', 'SKILL.md');
  const copy = join(ROOT, '.claude', 'skills', 'goed-plannen', 'SKILL.md');
  if (!existsSync(source)) {
    diffs.push('ontbreekt: public/skills/goed-plannen/SKILL.md (de bron van de agent-skill, publiek geserveerd door de webbuild)');
    return;
  }
  if (!existsSync(copy)) {
    diffs.push('ontbreekt: .claude/skills/goed-plannen/SKILL.md — kopieer hem uit public/skills/goed-plannen/SKILL.md (Claude Code leest skills alleen daar)');
    return;
  }
  const a = readFileSync(source);
  const b = readFileSync(copy);
  if (!a.equals(b)) {
    diffs.push(
      '.claude/skills/goed-plannen/SKILL.md wijkt af van public/skills/goed-plannen/SKILL.md — ' +
      'de bron staat in public/ (die wordt uitgeleverd en gedownload); kopieer hem daarna over de ' +
      '.claude-versie heen (`cp public/skills/goed-plannen/SKILL.md .claude/skills/goed-plannen/SKILL.md`)',
    );
  }
}

/** Het alias-object van het manifest (leeg als het ontbreekt of geen object is; dat meldt poort 4). */
function manifestAliases(manifest: Manifest): Record<string, string> {
  const raw = manifest.aliases;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === 'string'));
}

/** Een docs://-doel (id of alias) → het manifestartikel, of undefined. */
function resolveTarget(manifest: Manifest, id: string): ManifestArticle | undefined {
  return manifest.articles.find((a) => a.id === id)
    ?? manifest.articles.find((a) => a.id === manifestAliases(manifest)[id]);
}

/** De kopankers van een artikel in een taal (terugval en, zoals de viewer). */
function anchorsOf(id: string, lang: string): Set<string> | undefined {
  for (const l of [lang, 'en']) {
    const p = join(DOCS_DIR, l, `${id}.md`);
    if (existsSync(p)) return new Set(extractHeadingSlugs(readFileSync(p, 'utf8')));
  }
  return undefined;
}

/** Poort 4 (manifestniveau): versie en aliassen (zie de kop van dit bestand). */
function checkManifestV2(manifest: Manifest, diffs: string[]): void {
  if (manifest.version !== MANIFEST_VERSION) {
    diffs.push(`manifest: version is ${JSON.stringify(manifest.version)}, verwacht ${MANIFEST_VERSION}`);
  }
  const raw = manifest.aliases;
  if (raw === undefined) return;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    diffs.push('manifest: aliases moet een object zijn (oud id → nieuw id)');
    return;
  }
  const byId = new Map(manifest.articles.map((a) => [a.id, a] as const));
  for (const [from, to] of Object.entries(raw)) {
    if (typeof to !== 'string' || !to) { diffs.push(`alias "${from}": doel is geen artikel-id`); continue; }
    if (byId.has(from)) diffs.push(`alias "${from}" overschaduwt een bestaand artikel-id — een alias is alleen voor een id dat niet meer bestaat`);
    const target = byId.get(to);
    if (!target) diffs.push(`alias "${from}" → "${to}": dat artikel-id bestaat niet in het manifest`);
    else if (target.draft === true) diffs.push(`alias "${from}" → "${to}": het doel is een draft en bestaat in productie niet`);
  }
}

/** Poort 4 (per artikel): layer óf kind, geen tutorial/order in het manifest, draft is boolean. */
function checkArticleKind(article: ManifestArticle, diffs: string[]): void {
  const hasLayer = article.layer !== undefined;
  const hasKind = article.kind !== undefined;
  if (hasLayer && hasKind) diffs.push('heeft zowel layer als kind — een artikel is óf oud (layer) óf nieuw (kind)');
  else if (!hasLayer && !hasKind) diffs.push('heeft geen layer en geen kind');
  if (hasLayer && !VALID_LAYERS.has(article.layer!)) {
    diffs.push(`ongeldige layer "${article.layer}" (verwacht quickstart/gidsen/referentie)`);
  }
  if (hasKind && article.kind === 'tutorial') {
    diffs.push('kind "tutorial" hoort niet in het manifest — tutorials levert een extensie via het Help-register (src/utils/helpArticleRegistry.ts)');
  } else if (hasKind && !(MANIFEST_HELP_KINDS as readonly string[]).includes(article.kind!)) {
    diffs.push(`ongeldige kind "${article.kind}" (verwacht ${MANIFEST_HELP_KINDS.join('/')})`);
  }
  if (article.order !== undefined) diffs.push('order hoort niet in het manifest (alleen geregistreerde tutorials hebben een leerroute)');
  if (article.draft !== undefined && typeof article.draft !== 'boolean') diffs.push(`draft moet true of false zijn, niet ${JSON.stringify(article.draft)}`);
}

/**
 * Poort 10 — elk artikel-id dat de app zelf gebruikt, bestaat en is in productie zichtbaar.
 *
 * Voorheen stonden die id's verspreid als losse strings en brak een hernoemd artikel stil een
 * "Lees meer"-link (ontwerp gebruikersdocumentatie §8.2). Nu staan ze in src/state/helpArticles.ts
 * (elke stringexport daar telt) plus de `docsId` van de release-hoogtepunten (historische data van
 * uitgebrachte versies, die bewust letterlijk blijft staan). Een id mag een alias zijn; het doel mag
 * geen draft zijn. Een `#anker` moet in nl én en bestaan, want de app kent de docstaal van de lezer niet.
 */
function checkAppHelpArticles(manifest: Manifest, diffs: string[]): void {
  const used: Array<[string, string]> = [];
  for (const [name, value] of Object.entries(APP_HELP_ARTICLES)) {
    if (typeof value !== 'string') { diffs.push(`src/state/helpArticles.ts: export ${name} is geen artikel-id-string`); continue; }
    used.push([`helpArticles.${name}`, value]);
  }
  if (used.length === 0) diffs.push('src/state/helpArticles.ts exporteert geen artikel-ids (is het bestand verplaatst?)');
  for (const [version, entry] of Object.entries(RELEASE_HIGHLIGHT_CATALOG)) {
    if (entry.primary.docsId !== undefined) used.push([`releaseHighlights ${version}`, entry.primary.docsId]);
  }
  for (const [where, value] of used) {
    const { id, anchor } = splitHelpTarget(value);
    const target = resolveTarget(manifest, id);
    if (!target) { diffs.push(`${where}: "${id}" is geen artikel of alias in public/docs/manifest.json`); continue; }
    if (target.draft === true) { diffs.push(`${where}: "${id}" wijst naar een draft — in productie "artikel niet gevonden"`); continue; }
    if (anchor) {
      for (const lang of SOURCE_LANGS) {
        if (!anchorsOf(target.id, lang)?.has(anchor)) diffs.push(`${where}: anker "#${anchor}" bestaat niet in public/docs/${lang}/${target.id}.md`);
      }
    }
  }
}

function main() {
  let anyFail = false;
  let laggingTranslations = 0;
  const globalDiffs: string[] = [];

  const manifest = loadManifest();
  const exampleFiles = loadExampleFiles();
  const ids = manifest.articles.map((a) => a.id);
  const idSet = new Set(ids);

  // 7. Machinaal controleerbare beweringen in CLAUDE.md (zie checkAgentDocs).
  checkAgentDocs(globalDiffs);
  // 8. Machinaal controleerbare beweringen in AGENTS.md/README.md/CONTRIBUTING.md (zie checkSupportingDocs).
  // Het README-aantal telt wat een gebruiker ziet: drafts niet.
  checkSupportingDocs(globalDiffs, manifest.articles.filter((a) => a.draft !== true).length);
  // 9. De agent-skill heeft één bron (zie checkSkillCopy).
  checkSkillCopy(globalDiffs);
  // 4 (manifestniveau). Versie en aliassen.
  checkManifestV2(manifest, globalDiffs);
  // 10. Artikel-id's die de app gebruikt (zie checkAppHelpArticles).
  checkAppHelpArticles(manifest, globalDiffs);

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

  console.log('── Manifest-hygiëne + CLAUDE.md/AGENTS.md/README.md/CONTRIBUTING.md-beweringen ──');
  if (globalDiffs.length === 0) console.log('  OK  manifest v2 en aliassen geldig, geen dubbele ids, geen wees-bestanden, app-artikel-id\'s bestaan, de vier onboardingdocumenten lopen gelijk met de code');
  else { anyFail = true; for (const d of globalDiffs) console.log(`  XX  ${d}`); }

  // 6e heeft de bronnamen van ÁLLE artikelen nodig: een linktekst noemt een ander artikel.
  const namesById = new Map(manifest.articles.map((a) => [a.id, sourceNames(a)] as const));

  // 2/3/4/5/6: per artikel.
  for (const article of manifest.articles) {
    const diffs: string[] = [];
    const warnings: string[] = [];
    // Nog niet af in een draft (bijv. een screenshot dat nog gegenereerd moet worden): geen fout zolang
    // het artikel in productie verborgen is, wel zichtbaar in de uitvoer.
    const draftNotes: string[] = [];

    // 1c. Bestaan van de taalbestanden. Brontalen (nl/en) zijn hard vereist; de overige talen worden
    //     alleen getoetst als het bestand er is — een nog niet vertaald nieuw artikel blokkeert de
    //     poort dus niet, maar bestaande vertalingen worden hieronder volledig gevalideerd.
    const paths: Record<string, string> = {};
    for (const lang of LANGS) {
      const p = join(DOCS_DIR, lang, `${article.id}.md`);
      paths[lang] = p;
      if (SOURCE_LANGS.includes(lang)) {
        expect(diffs, existsSync(p), `ontbreekt: public/docs/${lang}/${article.id}.md`);
      }
    }

    // 4. Titels + layer/kind. Brontalen (nl/en) zijn verplicht; een titel in een andere taal wordt alleen
    //    afgekeurd als hij bestaat maar leeg is (ontbreken mag — volgt in de maandelijkse vertaalronde).
    for (const lang of LANGS) {
      const hasTitle = article.title?.[lang] !== undefined;
      if (SOURCE_LANGS.includes(lang) || hasTitle) {
        expect(diffs, !!article.title?.[lang]?.trim(), `title.${lang} ontbreekt of is leeg`);
      }
    }
    checkArticleKind(article, diffs);
    const isDraft = article.draft === true;

    const sources: Record<string, string> = {};
    for (const lang of LANGS) {
      if (!existsSync(paths[lang])) continue;
      const source = readFileSync(paths[lang], 'utf8');
      sources[lang] = source;

      // 6b. Lege bestanden.
      expect(diffs, source.trim().length > 0, `${lang}: bestand is leeg`);

      // 2. docs://-links (id of alias, eventueel met #anker; code gestript zodat een voorbeeld-syntax
      //    in backticks niet meetelt — die rendert de viewer als platte tekst).
      const docsLinks = [...stripCode(source).matchAll(/docs:\/\/([a-zA-Z0-9_-]+)(?:#([^\s)\]]*))?/g)];
      for (const [, target, anchor] of docsLinks) {
        const resolved = resolveTarget(manifest, target);
        if (!resolved) { diffs.push(`${lang}: docs://${target} wijst naar een onbekend artikel-id`); continue; }
        if (!isDraft && resolved.draft === true) {
          diffs.push(`${lang}: docs://${target} wijst naar een draft — in productie "artikel niet gevonden"`);
        }
        if (anchor !== undefined) {
          const anchors = anchorsOf(resolved.id, lang);
          expect(diffs, !!anchor && !!anchors?.has(anchor), `${lang}: docs://${target}#${anchor} — geen kop met dat anker in ${resolved.id} (${lang}, anders en)`);
        }
      }

      // 3. examples://-links.
      const exLinks = [...source.matchAll(/examples:\/\/([^\s)\]]+)/g)].map((m) => m[1]);
      for (const file of exLinks) {
        expect(diffs, exampleFiles.has(file), `${lang}: examples://${file} staat niet in public/examples/manifest.json`);
      }

      // 5. Parser-compatibiliteit.
      checkParserCompat(article.id, lang, source, diffs, draftNotes, isDraft);

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
    //     Hard voor NL (brontaal: nl en en worden altijd samen bijgewerkt). Voor de 12 vertaaltalen
    //     een WAARSCHUWING: die lopen per afspraak achter tot de maandelijkse vertaalronde (de
    //     helpviewer meldt dat de gebruiker ook), dus een nieuwe kop of link in een EN-gids mag de
    //     poort niet rood maken. Voorheen was dit ook voor hen hard, wat de `docs-update`-skill
    //     ("overige locales laat je met rust") tegensprak. Tijdens de vertaalronde maakt
    //     `--strict-translations` het weer hard, zodat een vertaler geen sectie laat vallen.
    if (sources.en) {
      const enLevels = extractHeadingLevels(sources.en);
      const enLinks = extractLinkTargets(sources.en);
      for (const lang of LANGS) {
        if (lang === 'en' || !sources[lang]) continue;
        const sink = SOURCE_LANGS.includes(lang) || STRICT_TRANSLATIONS ? diffs : warnings;
        const lLevels = extractHeadingLevels(sources[lang]);
        if (lLevels.length !== enLevels.length || lLevels.some((v, i) => v !== enLevels[i])) {
          sink.push(`${lang}: kop-structuur wijkt af van EN — EN heeft ${enLevels.length} koppen [${enLevels.join('')}], ${lang} heeft ${lLevels.length} [${lLevels.join('')}] (sectie mogelijk weggevallen/toegevoegd)`);
        }
        const lLinks = extractLinkTargets(sources[lang]);
        if (lLinks.length !== enLinks.length || lLinks.some((v, i) => v !== enLinks[i])) {
          sink.push(`${lang}: link-targets wijken af van EN — EN [${enLinks.join(', ')}] vs ${lang} [${lLinks.join(', ')}]`);
        }
      }
    }

    // 6e. Achtergebleven brontitels in vertalingen (zie checkUntranslatedTitles).
    checkUntranslatedTitles(article, sources, namesById, diffs);

    const ok = diffs.length === 0;
    if (!ok) anyFail = true;
    laggingTranslations += warnings.length;
    console.log(`${ok ? 'OK ' : 'XX '} ${article.id}`);
    for (const d of diffs) console.log(`     - ${d}`);
    for (const w of warnings) console.log(`     ! ${w} — loopt achter op EN, bijwerken in de vertaalronde`);
    for (const n of draftNotes) console.log(`     ! ${n} — draft, vóór het publiceren oplossen`);
  }

  if (laggingTranslations > 0) {
    console.log(`\n! ${laggingTranslations} vertaling(en) lopen structureel achter op EN — waarschuwing, geen fout (hard met --strict-translations)`);
  }
  console.log(`\n${manifest.articles.length} artikelen × ${LANGS.length} talen geverifieerd — ${anyFail ? 'FALEN' : 'alles groen'}`);
  process.exit(anyFail ? 1 : 0);
}

main();
