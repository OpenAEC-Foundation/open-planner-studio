export const AGENT_GUIDE_FILE = 'public/agent/planning-guide.md';

export function checkAgentGuideLinks(agent: string): string[] {
  const diffs: string[] = [];
  const re = /\b(docs|examples|project|settings):\/\/[^\s)]*/g;
  for (const m of agent.matchAll(re)) {
    diffs.push(`${AGENT_GUIDE_FILE}: link "${m[0]}" werkt alleen in de helpviewer — gebruik de volledige URL (https://open-planner-studio.open-aec.com/docs/en/<id>.md)`);
  }
  return diffs;
}
