// Fase 2.10, onderdeel 5, golf 7 (QA): statische verificatie van de in-app help-documentatie
// (`public/docs/**`) — analoog aan `scripts/verify-examples.ts` (exit 0/1, per-item OK/XX-output).
// Draait puur op bestanden/JSON (geen store nodig), maar loopt via dezelfde `run-ts.mjs`-harness
// als verify-examples zodat de invocatie-conventie (`npm run verify:docs`) identiek blijft.
//
// Checks:
//   1. Elk manifest-artikel-id heeft public/docs/nl/<id>.md EN public/docs/en/<id>.md (brontalen,
//      hard vereist); de overige 12 talen worden gevalideerd wanneer aanwezig maar mogen ontbreken
//      (maandelijkse vertaalronde). Geen wees-bestanden (md zonder manifest-entry); geen dubbele ids.
//   2. Elke docs://<id>-link wijst naar een bestaand manifest-id.
//   3. Elke examples://<file>-link wijst naar een bestand in public/examples/manifest.json.
//   4. title.nl/title.en niet leeg (overige talen: niet leeg indien aanwezig); layer ∈ {quickstart, gidsen, referentie}.
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
// Brontalen: hard vereist voor elk artikel. De overige 12 worden maandelijks vertaald en daarom
// alleen gevalideerd wanneer ze aanwezig zijn — zo faalt de poort niet op een nieuw artikel dat nog
// niet vertaald is, terwijl bestaande vertalingen wél volledig getoetst blijven (structuur/drift/parser).
const SOURCE_LANGS: readonly string[] = ['nl', 'en'];

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
  const referenced = [...claude.matchAll(/npm run ([a-z][\w:-]*)/g)].map((m) => m[1]);
  const dangling = [...new Set(referenced)].filter((s) => !(s in pkg.scripts));
  if (dangling.length) {
    diffs.push(`CLAUDE.md verwijst naar npm-scripts die niet bestaan: ${dangling.join(', ')}`);
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
  const toolsDir = join(ROOT, 'src', 'services', 'mcp', 'tools');
  const toolNames = new Set<string>();
  for (const file of readdirSync(toolsDir)) {
    if (!file.endsWith('.ts')) continue;
    const src = readFileSync(join(toolsDir, file), 'utf8');
    for (const m of src.matchAll(/['"](planner_[a-z_]+)['"]/g)) toolNames.add(m[1]);
  }
  const claimed = claude.match(/De (\d+)\s*\n?`planner_\*`-tools/);
  if (!claimed) {
    diffs.push('CLAUDE.md-check: geen "De N `planner_*`-tools"-bewering gevonden (is de zin herschreven?)');
  } else if (Number(claimed[1]) !== toolNames.size) {
    diffs.push(`CLAUDE.md zegt ${claimed[1]} \`planner_*\`-tools, maar src/services/mcp/tools/ definieert er ${toolNames.size}`);
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
  for (const [name, text] of Object.entries({ ...files, 'CLAUDE.md': claude, ...wikiFiles })) {
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

function main() {
  let anyFail = false;
  const globalDiffs: string[] = [];

  const manifest = loadManifest();
  const exampleFiles = loadExampleFiles();
  const ids = manifest.articles.map((a) => a.id);
  const idSet = new Set(ids);

  // 7. Machinaal controleerbare beweringen in CLAUDE.md (zie checkAgentDocs).
  checkAgentDocs(globalDiffs);
  // 8. Machinaal controleerbare beweringen in AGENTS.md/README.md/CONTRIBUTING.md (zie checkSupportingDocs).
  checkSupportingDocs(globalDiffs, manifest.articles.length);

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
  if (globalDiffs.length === 0) console.log('  OK  geen dubbele ids, geen wees-bestanden, de vier onboardingdocumenten lopen gelijk met de code');
  else { anyFail = true; for (const d of globalDiffs) console.log(`  XX  ${d}`); }

  // 2/3/4/5/6: per artikel.
  for (const article of manifest.articles) {
    const diffs: string[] = [];

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

    // 4. Titels + layer. Brontalen (nl/en) zijn verplicht; een titel in een andere taal wordt alleen
    //    afgekeurd als hij bestaat maar leeg is (ontbreken mag — volgt in de maandelijkse vertaalronde).
    for (const lang of LANGS) {
      const hasTitle = article.title?.[lang] !== undefined;
      if (SOURCE_LANGS.includes(lang) || hasTitle) {
        expect(diffs, !!article.title?.[lang]?.trim(), `title.${lang} ontbreekt of is leeg`);
      }
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
