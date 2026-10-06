// MCP-bridge — `planner_get_planning_guide`: de agentgids en de twee agent-skills bij de agent
// brengen.
//
// WAAROM EEN TOOL EN NIET ALLEEN `instructions`. De initialize-respons draagt de kernregels mee
// (`MCP_INSTRUCTIONS` in `dispatcher.ts`), maar die tekst moet kort blijven — hij gaat in élke
// systeemprompt mee. De volledige gids is duizenden woorden; die haalt een agent hier op wanneer hij
// hem nodig heeft. Daarnaast levert deze tool de twee agent-SKILLS plus de aanwijzing waar hij die
// zelf kan neerzetten, zodat ze ook in een vólgende sessie meekomen zonder dat de gebruiker iets doet.
//
// AGENTGIDS ≠ HELP-ARTIKEL. Tot oktober 2026 leverde deze tool het Help-artikel voor mensen
// (`public/docs/<taal>/gids-goed-plannen.md`). Een mens drukt op F5 en klikt in het lint; een agent
// gebruikt tools en het rekenen gaat vanzelf. Daarom is er nu een aparte, Engelse agentgids
// (`public/agent/planning-guide.md`) met per principe de tools. Het Help-artikel blijft voor mensen,
// met id en pad ongewijzigd (oudere app-versies en hun MCP-instructie wijzen er nog naar).
// `npm run verify:docs` (poort 11) bewaakt dat elk principe van het Help-artikel een tegenhanger in de
// agentgids heeft.
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
/** Publieke download-URL van de agentgids (ook in `MCP_INSTRUCTIONS`). */
export const AGENT_GUIDE_URL = `${GUIDE_PUBLIC_BASE}/${AGENT_GUIDE_PATH}`;

/** De agent-skills, in de volgorde waarin de tool ze levert. `goed-plannen` behoudt zijn
 *  Nederlandse slug: oudere app-versies installeren hem op dat pad. */
export const AGENT_SKILLS = [
  {
    name: 'goed-plannen',
    purpose: 'Building or restructuring a schedule: tool order, recalculation, planner_batch, reporting assumptions.',
  },
  {
    name: 'progress-update',
    purpose: 'Recording a weekly progress update: status date, actual dates, percent complete, variance against the baseline.',
  },
] as const;

export type AgentSkillName = (typeof AGENT_SKILLS)[number]['name'];

/** Pad van een skill binnen `public/` (bron; `.claude/skills/...` is de byte-identieke kopie). */
export function skillAssetPath(name: AgentSkillName): string {
  return `skills/${name}/SKILL.md`;
}

/** De twee waarden die `language` nog accepteert (compatibiliteit; de inhoud is altijd Engels). */
export type GuideLanguage = 'nl' | 'en';
export type GuidePart = 'guide' | 'skill' | 'both';

export interface SkillInstallInfo {
  name: AgentSkillName;
  purpose: string;
  installPathProject: string;
  installPathGlobal: string;
  url: string;
}

export interface PlanningGuidePayload {
  /** Taal van de inhoud: altijd `en`. */
  language: 'en';
  /** Alleen gezet wanneer om een andere taal werd gevraagd. */
  languageNote?: string;
  part: GuidePart;
  /** Markdowntekst van de agentgids (alleen bij part guide/both). */
  guide?: string;
  /** Beide skills, met hun tekst (alleen bij part skill/both). */
  skills?: { name: AgentSkillName; text: string }[];
  /** De tekst van `goed-plannen` — hetzelfde als `skills[0].text`; blijft voor oudere clients. */
  skill?: string;
  /** Waar de agent de skills neerzet + waar hij alles rechtstreeks kan downloaden. */
  install: {
    guideUrl: string;
    skills: SkillInstallInfo[];
    /** Velden van vóór de tweede skill (gelden voor `goed-plannen`); blijven voor oudere clients. */
    skillPathProject: string;
    skillPathGlobal: string;
    skillUrl: string;
    note: string;
  };
}

function skillInstall(name: AgentSkillName, purpose: string): SkillInstallInfo {
  return {
    name,
    purpose,
    installPathProject: `.claude/skills/${name}/SKILL.md`,
    installPathGlobal: `~/.claude/skills/${name}/SKILL.md`,
    url: `${GUIDE_PUBLIC_BASE}/${skillAssetPath(name)}`,
  };
}

/** Installatiepaden en absolute publieke download-URL's — dezelfde bestanden als de bundel-assets. */
export function installInfo(): PlanningGuidePayload['install'] {
  const skills = AGENT_SKILLS.map((s) => skillInstall(s.name, s.purpose));
  const first = skills[0];
  return {
    guideUrl: AGENT_GUIDE_URL,
    skills,
    skillPathProject: first.installPathProject,
    skillPathGlobal: first.installPathGlobal,
    skillUrl: first.url,
    note:
      'Write each skill text to .claude/skills/<name>/SKILL.md inside the project you are working in, or to ' +
      '~/.claude/skills/<name>/SKILL.md to have it in every project (see `skills` for both paths per skill). ' +
      'The guide and the skills can also be downloaded directly from the URLs above.',
  };
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
 * Haal gids en/of skills op. `fetchImpl` is injecteerbaar zodat de poort headless testbaar is —
 * dezelfde naad als `fetchTextAsset` zelf. Gooit bij het eerste bestand dat niet laadt, met het
 * pad erbij (de handler maakt er een nette NOT_FOUND van).
 */
export async function loadPlanningGuide(
  part: GuidePart,
  fetchImpl?: TextAssetFetch,
): Promise<Pick<PlanningGuidePayload, 'guide' | 'skills' | 'skill'>> {
  const base = assetBase();
  const load = async (path: string): Promise<string> => {
    try {
      return await fetchTextAsset(`${base}${path}`, fetchImpl);
    } catch (e) {
      throw new Error(`${path}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const out: Pick<PlanningGuidePayload, 'guide' | 'skills' | 'skill'> = {};
  if (part === 'guide' || part === 'both') {
    out.guide = await load(AGENT_GUIDE_PATH);
  }
  if (part === 'skill' || part === 'both') {
    const skills: { name: AgentSkillName; text: string }[] = [];
    for (const s of AGENT_SKILLS) skills.push({ name: s.name, text: await load(skillAssetPath(s.name)) });
    out.skills = skills;
    out.skill = skills[0].text;
  }
  return out;
}

export const guideTools: McpToolDef[] = [
  {
    name: 'planner_get_planning_guide',
    description:
      'Fetch the Open Planner Studio planning guide for AI agents and/or the two agent skills. The guide gives ' +
      'the planning principles with the planner_* tools that apply each of them, and how recalculation works ' +
      'through the tools. The skills are `goed-plannen` (building or restructuring a schedule) and ' +
      '`progress-update` (recording a weekly progress update). Read the guide BEFORE building or restructuring ' +
      'a schedule. Also returns where to install each skill so it is available in later sessions, and the ' +
      'public download URLs. All content is English; `language` is still accepted for compatibility but does ' +
      'not change the content. Read-only; touches no project data.',
    kind: 'read',
    batchable: false,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        language: {
          type: 'string',
          enum: ['nl', 'en'],
          description: 'Accepted for compatibility with older clients; the guide and the skills are English only.',
        },
        part: {
          type: 'string',
          enum: ['guide', 'skill', 'both'],
          description: '"guide" = the agent guide, "skill" = both skills, "both" = everything. Default "both".',
        },
      },
    },
    annotations: READ_ANNOTATIONS,
    handler: async (args, ctx: McpContext): Promise<McpToolResult> => {
      const a = (args ?? {}) as { language?: GuideLanguage; part?: GuidePart };
      const part = a.part ?? 'both';
      const install = installInfo();
      try {
        const texts = await loadPlanningGuide(part);
        const data: PlanningGuidePayload = { language: 'en', part, ...texts, install };
        if (a.language !== undefined && a.language !== 'en') {
          data.languageNote = 'The guide and the skills are English only; the `language` parameter is accepted for compatibility and does not change the content.';
        }
        return { ok: true, envelope: buildEnvelope(ctx), data };
      } catch (e) {
        // Een ontbrekende/onbereikbare asset is geen interne crash maar een nette melding, mét het
        // alternatief: de agent kan de teksten altijd nog van de publieke URL's halen.
        return toolError(
          ctx,
          'NOT_FOUND',
          `The planning guide could not be read from the app assets (${e instanceof Error ? e.message : String(e)}). ` +
            `Download it instead from ${install.guideUrl}; the skills: ` +
            install.skills.map((s) => `${s.name} ${s.url}`).join(', ') + '.',
        );
      }
    },
  },
];
