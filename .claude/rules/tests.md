---
paths:
  - "tests/**"
  - "scripts/run-browser-tests.mjs"
  - "playwright.config.*"
  - "eslint.config.js"
  - "tsconfig*.json"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

# Testsuites

Er is geen vitest/jest; `tsc` is de statische hoofdcheck — draai `npm run typecheck` (dekt óók `scripts/` en `tests/`, incl. het casus-schema) in plaats van alleen `npm run build`. TypeScript staat op `strict` met `noUnusedLocals`/`noUnusedParameters`, dus builds leggen vaak dode code bloot. Daarnaast draait er een **bewust minimale** ESLint-config (`eslint.config.js`): géén stijlregels — wel `no-floating-promises`, `no-misused-promises`, `no-control-regex`, `react-hooks/rules-of-hooks` en `react-hooks/exhaustive-deps`, plus een fout op ongebruikte suppressies. `import/no-cycle` staat er bewust NIET in: `verify:cycles` doet dat beter (graaf ná type-erasure, dus geen valse treffers op `import type`). De gedragstests zitten in vijf suites, samen achter `npm test`:

| suite | wat | runner |
|---|---|---|
| `tests/planning/` | data-driven CPM/kalender-cases + losse `check-*.ts`-batterijen (IFC-round-trip en STEP-stringveiligheid, recovery-integriteit en -isolatie, documentcontract, meldingen, undo-begrenzing, export-guard, werkdagen-as, i18n-pluralvormen, renderer, `.mpp`-lezer-datumgetrouwheid met de `GOAL_ZERO_DEVIATIONS`-poort, …), afgesloten met een tijdzone-matrix | `run.sh`, esbuild → Node |
| `tests/library/` | bibliotheek, pool-IFC, vijandige IFC-invoer, i18n-meervouden | `run.sh` |
| `tests/mcp/` | de MCP-tools headless tegen de echte store | `run.sh` |
| `tests/dev-server/` | poortallocatie en flock-races van de dev-server | `node:test` + `integration.sh` |
| `tests/browser/` | echte muis-, toets-, wheel- en DOM-handelingen voor Gantt, documenten, TableEditor, dialogen en panelen; state-/paintasserties via de dev-only brug | Playwright Chromium headless shell |

Installeer de browser en Linux-systeemafhankelijkheden eenmalig met
`npx playwright install --with-deps --only-shell chromium`. `npm run test:browser` reserveert daarna
een afzonderlijke poort voor deze worktree, start en stopt zelf een bewaakte Vite-server en draait
met één worker en nul retries. Gebruik bij falen `test-results/` voor screenshots en traces en
`playwright-report/` voor het HTML-rapport; de CI-, live- en release-gates uploaden die mappen zeven
dagen als `playwright-*`-artefact. Testhandelingen lopen via echte browser-events. De dev-only
`window.__OPS__`-brug mag deterministische fixtures zetten en domeinstate of Canvasgeometrie lezen,
maar mag de geteste gebruikershandeling niet vervangen.

Draai de planningssuite na elke wijziging aan planningscode. **De suite print "alles groen" ook bij exit 1** wanneer het bundelen faalt — vertrouw op de **exitcode**, nooit op de tail. Een `grep` op faalregels is een handig extraatje maar **geen poort**: `grep '^XX'` werkt alleen voor `tests/planning/`. De bibliotheeksuite print zijn faalregels **ingesprongen** (`console.log(\`   XX ${msg}\`)` in `tests/library/check-*.ts`), dus `grep -c '^XX'` geeft daar 0 terwijl de suite rood staat — gemeten 2026-07-28. Gebruik `grep -c 'XX '` als je toch wilt tellen, en laat de exitcode altijd het oordeel vellen. `npm run verify` is de poort — één definitie in `package.json`. De release- en deploy-gate draaien hem in één keer; CI draait precies dezelfde stappen, verdeeld over parallelle jobs door `scripts/verify-parts.mjs` (dat de stappen uit die ene definitie leest), dus wat lokaal groen is, is ook in CI groen. Zie `tests/planning/README.md` voor het toevoegen van cases.
