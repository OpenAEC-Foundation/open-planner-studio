// MCP-bridge — `planner_get_planning_guide`: de planningsgids en de agent-skill bij de agent
// brengen (werkblok D2b).
//
// WAAROM EEN TOOL EN NIET ALLEEN `instructions`. De initialize-respons draagt sinds D2b de
// kernregels mee (`MCP_INSTRUCTIONS` in `dispatcher.ts`), maar die tekst moet kort blijven — hij
// gaat in élke systeemprompt mee. De volledige gids ("Goed plannen") is een artikel van duizenden
// woorden; die haalt een agent hier op wanneer hij hem
// nodig heeft. Daarnaast levert deze tool de agent-SKILL plus de aanwijzing waar hij die zelf kan
// neerzetten, zodat de gids ook in een vólgende sessie meekomt zonder dat de gebruiker iets doet.
//
// DE BRON. Gids en skill zijn RUNTIME-ASSETS in `public/` — geen bundelinhoud. We halen ze op met
// `fetchTextAsset` (`@/utils/textAsset`), precies zoals `HelpPanel.tsx` dat doet: `BASE_URL`-
// relatief, met de SPA-fallback-body-sniff als "bestaat dit echt?"-poort. In Tauri werkt dat pad
// ook (`tauri://`-protocol op de gebundelde assets). Daarom is dit de enige ASYNCHRONE leestool:
// de dispatcher awaits een handler sowieso.
//
// GUARDS. Bewust GEEN `runReadTool`-wikkel en dus geen dialoog-guard: deze tool leest de PLANNING
// niet — er is geen half-bewerkte state die hij verkeerd kan zien. Hij is ook zinvol juist wanneer
// er een dialoog openstaat (de agent oriënteert zich dan). `ensureFreshSchedule` is om dezelfde
// reden niet nodig: er wordt geen berekende waarde gelezen. Read-only-modus en pauze raken alleen
// mutaties, dus deze tool blijft daar gewoon werken (spec regel 116).

import { fetchTextAsset, type TextAssetFetch } from '@/utils/textAsset';
import { buildEnvelope, toolError } from './runtime';
import type { McpContext, McpToolDef, McpToolResult, McpToolAnnotations } from '../contracts';

/** Publieke basis-URL van de webbuild — de plek waar een agent gids en skill zelf kan downloaden. */
export const GUIDE_PUBLIC_BASE = 'https://open-planner-studio.open-aec.com';

/** De twee brontalen van de gids (zoals `SOURCE_LANGS` in `scripts/verify-docs.ts`). */
export type GuideLanguage = 'nl' | 'en';

/** Artikel-id in `public/docs/manifest.json`; ook de bestandsnaam. */
const GUIDE_ARTICLE_ID = 'gids-goed-plannen';
/** Pad van de skill binnen `public/` (bron; `.claude/skills/...` is de byte-identieke kopie). */
const SKILL_PATH = 'skills/goed-plannen/SKILL.md';

export interface PlanningGuidePayload {
  language: GuideLanguage;
  part: 'guide' | 'skill' | 'both';
  /** Markdowntekst van de gids (alleen bij part guide/both). */
  guide?: string;
  /** Markdowntekst van de agent-skill (alleen bij part skill/both). */
  skill?: string;
  /** Waar de agent de skill neerzet + waar hij alles rechtstreeks kan downloaden. */
  install: {
    skillPathProject: string;
    skillPathGlobal: string;
    skillUrl: string;
    guideUrl: string;
    note: string;
  };
}

/** Absolute publieke download-URL's — dezelfde bestanden als de bundel-assets hieronder. */
function installInfo(language: GuideLanguage): PlanningGuidePayload['install'] {
  return {
    skillPathProject: '.claude/skills/goed-plannen/SKILL.md',
    skillPathGlobal: '~/.claude/skills/goed-plannen/SKILL.md',
    skillUrl: `${GUIDE_PUBLIC_BASE}/${SKILL_PATH}`,
    guideUrl: `${GUIDE_PUBLIC_BASE}/docs/${language}/${GUIDE_ARTICLE_ID}.md`,
    note:
      'Write the skill text to .claude/skills/goed-plannen/SKILL.md inside the project you are ' +
      'working in, or to ~/.claude/skills/goed-plannen/SKILL.md to have it in every project. Both ' +
      'files can also be downloaded directly from the URLs above.',
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
 * Haal gids en/of skill op. `fetchImpl` is injecteerbaar zodat de poort headless testbaar is —
 * dezelfde naad als `fetchTextAsset` zelf.
 */
export async function loadPlanningGuide(
  language: GuideLanguage,
  part: 'guide' | 'skill' | 'both',
  fetchImpl?: TextAssetFetch,
): Promise<PlanningGuidePayload> {
  const base = assetBase();
  const payload: PlanningGuidePayload = { language, part, install: installInfo(language) };
  if (part === 'guide' || part === 'both') {
    payload.guide = await fetchTextAsset(`${base}docs/${language}/${GUIDE_ARTICLE_ID}.md`, fetchImpl);
  }
  if (part === 'skill' || part === 'both') {
    payload.skill = await fetchTextAsset(`${base}${SKILL_PATH}`, fetchImpl);
  }
  return payload;
}

/** Leestool-annotaties, gelijk aan `READ_ANNOTATIONS` in `readTools.ts`. */
const READ_ANNOTATIONS: McpToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export const guideTools: McpToolDef[] = [
  {
    name: 'planner_get_planning_guide',
    description:
      'Fetch the Open Planner Studio planning guide ("Planning well") and/or the agent skill that describes how to drive the planner_* tools. ' +
      'Read this BEFORE building or restructuring a schedule. Also returns where to install the ' +
      'skill so it is available in later sessions. Read-only; touches no project data.',
    kind: 'read',
    batchable: false,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        language: {
          type: 'string',
          enum: ['nl', 'en'],
          description: 'Language of the guide text. Default "en".',
        },
        part: {
          type: 'string',
          enum: ['guide', 'skill', 'both'],
          description: 'Which text(s) to return. Default "both".',
        },
      },
    },
    annotations: READ_ANNOTATIONS,
    handler: async (args, ctx: McpContext): Promise<McpToolResult> => {
      const a = (args ?? {}) as { language?: GuideLanguage; part?: 'guide' | 'skill' | 'both' };
      const language: GuideLanguage = a.language ?? 'en';
      const part = a.part ?? 'both';
      try {
        const data = await loadPlanningGuide(language, part);
        return { ok: true, envelope: buildEnvelope(ctx), data };
      } catch (e) {
        // Een ontbrekende/onbereikbare asset is geen interne crash maar een nette melding, mét het
        // alternatief: de agent kan de tekst altijd nog van de publieke URL halen.
        const info = installInfo(language);
        return toolError(
          ctx,
          'NOT_FOUND',
          `De planningsgids kon niet uit de app-assets worden gelezen (${e instanceof Error ? e.message : String(e)}). ` +
            `Download hem in plaats daarvan van ${info.guideUrl} (skill: ${info.skillUrl}).`,
        );
      }
    },
  },
];
