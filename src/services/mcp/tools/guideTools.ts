import { fetchTextAsset, type TextAssetFetch } from '@/utils/textAsset';
import { buildEnvelope, toolError } from './runtime';
import type { McpContext, McpToolDef, McpToolResult } from '../contracts';
import { READ_ANNOTATIONS } from './helpers';

export const GUIDE_PUBLIC_BASE = 'https://open-planner-studio.open-aec.com';

export const AGENT_GUIDE_PATH = 'agent/planning-guide.md';
export const AGENT_GUIDE_URL = `${GUIDE_PUBLIC_BASE}/${AGENT_GUIDE_PATH}`;

export const AGENT_SKILLS = [{ name: 'goed-plannen' }, { name: 'progress-update' }] as const;

export type AgentSkillName = (typeof AGENT_SKILLS)[number]['name'];

export function skillAssetPath(name: AgentSkillName): string {
  return `skills/${name}/SKILL.md`;
}

export function publicAssetUrl(path: string): string {
  return `${GUIDE_PUBLIC_BASE}/${path}`;
}

export type GuideLanguage = 'nl' | 'en';

export const GUIDE_PARTS = {
  'goed-plannen': { guide: true, skills: ['goed-plannen'], install: true },
  'progress-update': { guide: false, skills: ['progress-update'], install: false },
  guide: { guide: true, skills: [], install: false },
  skill: { guide: false, skills: ['goed-plannen', 'progress-update'], install: true },
  both: { guide: true, skills: ['goed-plannen', 'progress-update'], install: true },
} as const satisfies Record<string, { guide: boolean; skills: readonly AgentSkillName[]; install: boolean }>;

export type GuidePart = keyof typeof GUIDE_PARTS;

export const DEFAULT_GUIDE_PART: GuidePart = 'guide';

export const SKILL_INSTALL_HINT =
  `Install ${GUIDE_PUBLIC_BASE}/skills/<name>/SKILL.md to .claude/skills/<name>/SKILL.md (project or ~/); ` +
  `names: ${AGENT_SKILLS.map((s) => s.name).join(', ')}.`;

export function readingText(markdown: string): string {
  let text = markdown.replace(/\r\n/g, '\n');
  const fm = /^---\n[\s\S]*?\n---\n/.exec(text);
  if (fm) text = text.slice(fm[0].length);
  text = text.replace(/^\n+/, '');
  const h1 = /^# [^\n]*\n+/.exec(text);
  if (h1) text = text.slice(h1[0].length);
  return text.replace(/\n{2,}/g, '\n');
}

export interface MissingAsset {
  path: string;
  url: string;
  reason: string;
}

export interface PlanningGuidePayload {
  languageNote?: string;
  guide?: string;
  skills?: { name: AgentSkillName; text: string }[];
  missing?: MissingAsset[];
  install?: string;
}

function assetBase(): string {
  const base: unknown = import.meta.env?.BASE_URL;
  return typeof base === 'string' && base !== '' ? base : '/';
}

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
  const shape = wanted.install ? (text: string) => text : readingText;
  if (wanted.guide) {
    const guide = await load(AGENT_GUIDE_PATH);
    if (guide !== undefined) out.guide = shape(guide);
  }
  if (wanted.skills.length > 0) {
    const skills: { name: AgentSkillName; text: string }[] = [];
    for (const name of wanted.skills) {
      const text = await load(skillAssetPath(name));
      if (text !== undefined) skills.push({ name, text: shape(text) });
    }
    out.skills = skills;
  }
  if (missing.length > 0) out.missing = missing;
  return out;
}

export const guideToolDeps: { fetchImpl?: TextAssetFetch } = {};

export const guideTools: McpToolDef[] = [
  {
    name: 'planner_get_planning_guide',
    description:
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
