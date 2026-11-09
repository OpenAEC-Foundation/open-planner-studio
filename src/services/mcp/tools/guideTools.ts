// MCP-bridge — `planner_get_planning_guide`: de agentgids en de twee agent-skills bij de agent
// brengen.
//
// WAAROM EEN TOOL EN NIET ALLEEN `instructions`. De initialize-respons draagt de kernregels mee
// (`MCP_INSTRUCTIONS` in `dispatcher.ts`), maar die tekst moet kort blijven — hij gaat in élke
// systeemprompt mee. De volledige gids haalt een agent hier op wanneer hij hem nodig heeft. Daarnaast
// levert deze tool de twee agent-SKILLS plus de aanwijzing waar hij die zelf kan neerzetten, zodat ze
// ook in een vólgende sessie meekomen zonder dat de gebruiker iets doet.
//
// KORT. Agents betalen per token. Gids en skills zijn regels, geen lesstof: elk principe één keer, in
// de gids (ook de volgorde); `goed-plannen` verwijst alleen naar de gids, `progress-update` is zelfstandig;
// parameters staan in `tools/list` (besluit eigenaar, 2026-11-07, #818). Het antwoord laat de frontmatter
// en de eerste kop weg (`readingText`): die zeggen de toolbeschrijving en `skills[].name` al. De volle
// bestanden blijven de bron om te installeren (`install`).
//
// AGENTGIDS ≠ HELP-ARTIKEL. Tot oktober 2026 leverde deze tool het Help-artikel voor mensen
// (`public/docs/<taal>/gids-goed-plannen.md`). Een mens drukt op F5 en klikt in het lint; een agent
// gebruikt tools en het rekenen gaat vanzelf. Daarom is er een aparte, Engelse agentgids
// (`public/agent/planning-guide.md`) met per principe de tools. Het Help-artikel is sinds november
// 2026 weg (besluit eigenaar, 2026-11-02: de Help beschrijft alleen hoe de app werkt); het oude id is
// een alias in het manifest. `npm run verify:docs` (poort 11) bewaakt dat de agentgids geen
// helpviewer-links bevat.
//
// TAAL. Gids en skills zijn alleen Engels (alles wat de agent leest is Engels). De parameter
// `language` blijft voor oudere clients geaccepteerd, maar verandert de inhoud niet.
//
// DE BRON. Gids en skills zijn RUNTIME-ASSETS in `public/` — geen bundelinhoud. We halen ze op met
// `fetchTextAsset` (`@/utils/textAsset`), precies zoals `HelpPanel.tsx` dat doet: `BASE_URL`-
// relatief, met de SPA-fallback-body-sniff als "bestaat dit echt?"-poort. In Tauri werkt dat pad
// ook (`tauri://`-protocol op de gebundelde assets). Daarom is dit de enige ASYNCHRONE leestool:
// de dispatcher awaits een handler sowieso.
//
// GUARDS. Bewust GEEN `runReadTool`-wikkel en dus geen dialoog-guard: deze tool leest de PLANNING
// niet — er is geen half-bewerkte state die hij verkeerd kan zien. Hij is ook zinvol juist wanneer
// er een dialoog openstaat (de agent oriënteert zich dan). `ensureFreshSchedule` is om dezelfde
// reden niet nodig: er wordt geen berekende waarde gelezen. Read-only-modus en pauze raken alleen
// mutaties, dus deze tool blijft daar gewoon werken.

import { fetchTextAsset, type TextAssetFetch } from '@/utils/textAsset';
import { buildEnvelope, toolError } from './runtime';
import type { McpContext, McpToolDef, McpToolResult } from '../contracts';
import { READ_ANNOTATIONS } from './helpers';

/** Publieke basis-URL van de webbuild — de plek waar een agent gids en skills zelf kan downloaden. */
export const GUIDE_PUBLIC_BASE = 'https://open-planner-studio.open-aec.com';

/** Pad van de agentgids binnen `public/` (dus ook in `dist/` en de Tauri-bundel). Bewust NIET onder
 *  `public/docs/`: daar staan alleen Help-artikelen (verify:docs, helpviewer, wiki). */
export const AGENT_GUIDE_PATH = 'agent/planning-guide.md';
/** Publieke download-URL van de agentgids (o.a. de uitweg bij `te_groot` in `siteAppTools.ts`). */
export const AGENT_GUIDE_URL = `${GUIDE_PUBLIC_BASE}/${AGENT_GUIDE_PATH}`;

/** De agent-skills, in de volgorde waarin de tool ze levert. `goed-plannen` behoudt zijn
 *  Nederlandse slug: oudere app-versies installeren hem op dat pad. */
export const AGENT_SKILLS = [{ name: 'goed-plannen' }, { name: 'progress-update' }] as const;

export type AgentSkillName = (typeof AGENT_SKILLS)[number]['name'];

/** Pad van een skill binnen `public/` (bron; `.claude/skills/...` is de byte-identieke kopie). */
export function skillAssetPath(name: AgentSkillName): string {
  return `skills/${name}/SKILL.md`;
}

/** Publieke download-URL van een bestand binnen `public/`. */
export function publicAssetUrl(path: string): string {
  return `${GUIDE_PUBLIC_BASE}/${path}`;
}

/** De twee waarden die `language` nog accepteert (compatibiliteit; de inhoud is altijd Engels). */
export type GuideLanguage = 'nl' | 'en';

/**
 * Wat elk `part` levert. Eén part per taak (#818): een agent die gaat opbouwen haalt de gids (`guide`, de
 * standaard), een voortgangsronde alleen `progress-update` (die skill is zelfstandig). `goed-plannen` levert
 * de gids plus die skill, `skill` beide skills: dat zijn de parts om te installeren, en alleen die krijgen
 * `install` (een voortgangsronde betaalt die tekst niet elke keer; #818, ronde 5). `both` blijft werken voor
 * oudere clients.
 */
export const GUIDE_PARTS = {
  'goed-plannen': { guide: true, skills: ['goed-plannen'], install: true },
  'progress-update': { guide: false, skills: ['progress-update'], install: false },
  guide: { guide: true, skills: [], install: false },
  skill: { guide: false, skills: ['goed-plannen', 'progress-update'], install: true },
  both: { guide: true, skills: ['goed-plannen', 'progress-update'], install: true },
} as const satisfies Record<string, { guide: boolean; skills: readonly AgentSkillName[]; install: boolean }>;

export type GuidePart = keyof typeof GUIDE_PARTS;

/** Zonder `part`: alleen de gids. Wie zonder keuze leest, gaat meestal opbouwen of herstructureren (zo noemt de
 *  beschrijving van deze tool hem; voor voortgang noemt die `part: "progress-update"`). De gids heeft de hele
 *  volgorde; de skill `goed-plannen` zegt alleen deze tool te lezen, dus die hoeft niet mee (#818, ronde 4). */
export const DEFAULT_GUIDE_PART: GuidePart = 'guide';

/** Waar een agent een skill bewaart voor latere sessies. Eén tekst voor alle skills (#818). Het volle
 *  bestand (mét frontmatter, die het antwoord weglaat) komt van de publieke URL. De tekst noemt beide
 *  skillnamen: bij `goed-plannen` komt alleen die skill mee, maar wie installeert, wil ook `progress-update`
 *  (dat part zelf krijgt geen `install`). */
export const SKILL_INSTALL_HINT =
  `Install ${GUIDE_PUBLIC_BASE}/skills/<name>/SKILL.md to .claude/skills/<name>/SKILL.md (project or ~/); ` +
  `names: ${AGENT_SKILLS.map((s) => s.name).join(', ')}.`;

/**
 * De tekst om te LEZEN: zonder frontmatter (`---`-blok op regel 1) en zonder de eerste kop (`# …`), met
 * de lege regels erna. Die zeggen niets wat de agent niet al weet (toolbeschrijving, `skills[].name`).
 */
export function readingText(markdown: string): string {
  let text = markdown.replace(/\r\n/g, '\n');
  const fm = /^---\n[\s\S]*?\n---\n/.exec(text);
  if (fm) text = text.slice(fm[0].length);
  text = text.replace(/^\n+/, '');
  const h1 = /^# [^\n]*\n+/.exec(text);
  if (h1) text = text.slice(h1[0].length);
  return text;
}

export interface MissingAsset {
  path: string;
  url: string;
  reason: string;
}

export interface PlanningGuidePayload {
  /** Alleen gezet wanneer om een andere taal werd gevraagd (de inhoud is altijd Engels). */
  languageNote?: string;
  /** Markdowntekst van de agentgids, als `readingText` (alleen bij een part met gids). */
  guide?: string;
  /** De skills van dit part, met hun tekst als `readingText`. Het oude veld `skill` (een tweede kopie van `goed-plannen`)
   *  is weg: het kostte de agent elke keer duizenden tokens (besluit eigenaar, 2026-11-07). */
  skills?: { name: AgentSkillName; text: string }[];
  /** Alleen gezet wanneer een deel niet laadde: welk bestand, waarom, en waar het publiek staat. De
   *  rest komt gewoon mee — één ontbrekende skill blokkeert de gids niet. */
  missing?: MissingAsset[];
  /** Waar de agent een skill neerzet (alleen bij de installatieparts, zie `GUIDE_PARTS`). Het veld `part` is
   *  weg: de agent weet wat hij vroeg (#818, ronde 5). */
  install?: string;
}

/**
 * Basis waarop de asset-URL's worden opgebouwd. Losse helper omdat `import.meta.env` in de
 * headless testbundel alleen via de esbuild-defines bestaat; de terugval houdt dit bestand
 * importeerbaar zonder Vite-omgeving (zelfde patroon als `MCP_SERVER_VERSION`).
 */
function assetBase(): string {
  const base: unknown = import.meta.env?.BASE_URL;
  return typeof base === 'string' && base !== '' ? base : '/';
}

/**
 * Haal gids en/of skills op, elk bestand APART: een ontbrekend bestand komt in `missing` (met de
 * publieke URL als alternatief) en houdt de andere niet tegen. `fetchImpl` is injecteerbaar zodat de
 * poort headless testbaar is — dezelfde naad als `fetchTextAsset` zelf.
 */
export async function loadPlanningGuide(
  part: GuidePart,
  fetchImpl?: TextAssetFetch,
): Promise<Pick<PlanningGuidePayload, 'guide' | 'skills' | 'missing'>> {
  const base = assetBase();
  const missing: MissingAsset[] = [];
  const load = async (path: string): Promise<string | undefined> => {
    try {
      return await fetchTextAsset(`${base}${path}`, fetchImpl);
    } catch (e) {
      missing.push({ path, url: publicAssetUrl(path), reason: e instanceof Error ? e.message : String(e) });
      return undefined;
    }
  };
  const out: Pick<PlanningGuidePayload, 'guide' | 'skills' | 'missing'> = {};
  const wanted = GUIDE_PARTS[part];
  if (wanted.guide) {
    const guide = await load(AGENT_GUIDE_PATH);
    if (guide !== undefined) out.guide = readingText(guide);
  }
  if (wanted.skills.length > 0) {
    const skills: { name: AgentSkillName; text: string }[] = [];
    for (const name of wanted.skills) {
      const text = await load(skillAssetPath(name));
      if (text !== undefined) skills.push({ name, text: readingText(text) });
    }
    out.skills = skills;
  }
  if (missing.length > 0) out.missing = missing;
  return out;
}

/**
 * Injecteerbare bron voor gids en skills. Leeg in de app: daar haalt `fetchTextAsset` ze met `fetch` uit
 * de eigen bundel. De headless MCP-server (`headless/mcp-server/`, issue #570) heeft geen webserver en
 * zet hier een functie die de in de serverbundel ingebedde teksten teruggeeft.
 */
export const guideToolDeps: { fetchImpl?: TextAssetFetch } = {};

export const guideTools: McpToolDef[] = [
  {
    name: 'planner_get_planning_guide',
    description:
      // Leesplicht plus beide routes: zonder `part` de gids (opbouwen, herstructureren), voor voortgang de skill
      // (#818, ronde 6). De parts om te installeren staan bij `part`.
      'Read before building or restructuring; for progress, `part: "progress-update"`.',
    kind: 'read',
    batchable: false,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        language: {
          type: 'string',
          enum: ['nl', 'en'],
          description: 'Ignored (compatibility).',
        },
        part: {
          type: 'string',
          enum: Object.keys(GUIDE_PARTS),
          description: '"goed-plannen" (guide + skill) or "skill" (both skills): to install; "both": legacy.',
        },
      },
    },
    annotations: READ_ANNOTATIONS,
    handler: async (args, ctx: McpContext): Promise<McpToolResult> => {
      const a = (args ?? {}) as { language?: GuideLanguage; part?: GuidePart };
      const part = a.part ?? DEFAULT_GUIDE_PART;
      const texts = await loadPlanningGuide(part, guideToolDeps.fetchImpl);
      // Niets geladen ⇒ een nette NOT_FOUND mét de publieke URL's van wat ontbrak. Een deel geladen ⇒
      // gewoon `ok`, met `missing` voor wat ontbrak.
      if (texts.guide === undefined && (texts.skills?.length ?? 0) === 0) {
        const missing = texts.missing ?? [];
        return toolError(
          ctx,
          'NOT_FOUND',
          `The planning guide could not be read from the app assets (${missing.map((m) => `${m.path}: ${m.reason}`).join('; ')}). ` +
            `Download instead: ${missing.map((m) => m.url).join(', ')}.`,
        );
      }
      const data: PlanningGuidePayload = { ...texts };
      if (GUIDE_PARTS[part].install) data.install = SKILL_INSTALL_HINT;
      if (a.language !== undefined && a.language !== 'en') {
        data.languageNote = 'English only; `language` is ignored.';
      }
      return { ok: true, envelope: buildEnvelope(ctx), data };
    },
  },
];
