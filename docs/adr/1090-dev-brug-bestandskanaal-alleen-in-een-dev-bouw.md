# Dev-brug: het bestandskanaal alleen in een dev-bouw

`src/utils/devBridge.ts` laadt niet alleen in een dev-bouw: `main.tsx` laadt het ook in een productiebouw met
`VITE_OPS_BENCH_BRIDGE=1`, de benchmarkbouw van `scripts/measure-large-plans.mjs`. Die bouw heeft alleen
`window.__OPS__` in de browser nodig. Het bestandskanaal van de Tauri-runtime (`startOpsTestPoller`, via
`<appDataDir>/ops-test/cmd.json`) voert elke store-actie uit en geeft met `mcpConnection` het token van de
MCP-bridge terug. Daarom start `installDevBridge` de poller alleen met `import.meta.env.DEV && isTauri()`, en
weigeren `mcpConnection`, `mcpRestart`, `mcpStop` en `log` in `runOp` nog eens zelf buiten een dev-bouw.
Die controles op `import.meta.env.DEV` lijken overbodig in een module voor zelftests, maar zijn het
niet: wie ze weghaalt, zet het kanaal open in elke benchmarkbouw die in de Tauri-runtime draait.
