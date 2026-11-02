// De agentgids (voor AI-agents, `public/agent/planning-guide.md`) staat bewust buiten `public/docs/`:
// hij is geen Help-artikel en wordt buiten de helpviewer gelezen (door een agent via
// `planner_get_planning_guide`, of als ruwe download). Poort 11 van `npm run verify:docs` keurt daarom
// elke `docs://`-, `examples://`- of `project://`-link in die gids af: die werkt alleen in de viewer.
//
// Tot november 2026 hield deze module ook een koppeltabel bij tussen de principes van het Help-artikel
// "Goed plannen" en de secties van de agentgids. Dat artikel is weg (besluit eigenaar, 2026-11-02: de
// Help beschrijft alleen nog hoe de app werkt), dus die koppeling ook. De agentgids blijft bestaan.
//
// Puur (alleen tekst in, meldingen uit), zodat `tests/mcp/cases-planning-guide.ts` het mutatiebewijs
// kan leveren zonder bestanden aan te raken.

/** De agentgids, relatief aan de repo-root (zelfde bestand als `AGENT_GUIDE_PATH` in guideTools.ts). */
export const AGENT_GUIDE_FILE = 'public/agent/planning-guide.md';

/**
 * De agentgids wordt buiten de helpviewer gelezen (door een agent, of als ruwe download): een
 * `docs://`- of `examples://`-link werkt daar niet. Alleen volledige URL's.
 */
export function checkAgentGuideLinks(agent: string): string[] {
  const diffs: string[] = [];
  const re = /\b(docs|examples|project):\/\/[^\s)]*/g;
  for (const m of agent.matchAll(re)) {
    diffs.push(`${AGENT_GUIDE_FILE}: link "${m[0]}" werkt alleen in de helpviewer — gebruik de volledige URL (https://open-planner-studio.open-aec.com/docs/en/<id>.md)`);
  }
  return diffs;
}
