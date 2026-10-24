// Virtuele module die `scripts/build-mcp-server.mjs` bij het bundelen invult: de tekstbestanden uit
// `public/` die tools tijdens het draaien lezen (de agentgids en de agent-skills van
// `planner_get_planning_guide`). Sleutel = pad binnen `public/`, waarde = de inhoud.
declare module 'ops:embedded-assets' {
  export const EMBEDDED_ASSETS: Readonly<Record<string, string>>;
}
