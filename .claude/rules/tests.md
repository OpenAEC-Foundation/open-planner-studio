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
| `tests/browser/` | echte muis-, toets-, wheel- en DOM-handelingen voor Gantt, documenten, de Tabel-weergave, dialogen en panelen; state-/paintasserties via de dev-only brug | Playwright Chromium headless shell |

Installeer de browser en Linux-systeemafhankelijkheden eenmalig met
`npx playwright install --with-deps --only-shell chromium`. `npm run test:browser` reserveert daarna
een afzonderlijke poort voor deze worktree, start en stopt zelf een bewaakte Vite-server en draait
met één worker en nul retries. Gebruik bij falen `test-results/` voor screenshots en traces en
`playwright-report/` voor het HTML-rapport; de CI- en release-gates uploaden die mappen zeven
dagen als `playwright-*`-artefact. Testhandelingen lopen via echte browser-events. De dev-only
`window.__OPS__`-brug mag deterministische fixtures zetten en domeinstate of Canvasgeometrie lezen,
maar mag de geteste gebruikershandeling niet vervangen.

**Een nieuwe browsertest breidt eerst een bestaand scenario uit** (besluit eigenaar, 2026-10-20). Een
scenario is één `test()`-blok dat een werkroute van een planner doorloopt en onderweg controleert, zoals
"resource toevoegen → lege naam weigeren → tarief zetten → kleur kiezen → Ctrl+Z". Een werkroute ligt vast
door haar beginstand (fixture, document, weergave) en het doel van de gebruiker. Elk `test()`-blok start de
app opnieuw (de `ops`-fixture in `tests/browser/fixtures/ops.ts`); een nieuw blok in een bestaand bestand
kost dus net zoveel als een nieuw bestand.

1. Zoek een `test()`-blok met dezelfde beginstand en hetzelfde doel. Voeg je handeling en je controle daar
   toe, als stap in de route.
2. Bestaat zo'n blok niet, schrijf dan een nieuw `test()`-blok in het spec-bestand waar de route bij hoort.
   Een nieuw spec-bestand alleen voor een route die in geen bestaand bestand past.
3. Een groot bestand of een lange route is geen reden voor een nieuw blok. Wel een reden: een andere
   beginstand of een ander doel (stap 2), of een stap die de rest van de route onbruikbaar maakt (bijv. een
   document wisselen of de app herladen).

In de browser hoort alles wat alleen een echte browser laat zien: toetsen, focus, klikken, slepen,
animatieframes en de koppeling tussen UI en store, óók als het een randgeval is (bijv. de focusrace in
`table-editor.spec.ts`). Rekenlogica en lange invoermatrices (veel waarden voor dezelfde handeling) horen in
`tests/planning/`, zonder browser. Reden: de suite groeide tot 126 spec-bestanden en ongeveer 31 minuten
opgetelde testtijd over de vier CI-shards (CI-run 39275828606), met meerdere bestanden en blokken voor
dezelfde route. Bron: testaudit en review van 2026-10-20.

Draai de planningssuite na elke wijziging aan planningscode. Tussenregels als "(alles groen)" of "TZ …: groen" gaan elk alleen over hun eigen deel — ze verschijnen ook als de run als geheel rood is. De **laatste regel** (`EINDOORDEEL planningssuite: GROEN (exit 0)` of `… ROOD …`) volgt wél altijd de exitcode; de exitcode blijft het oordeel. Een nieuwe `tests/planning/check-*.ts` draait vanzelf mee in de volledige run, inclusief de tijdzone-matrix — een eigen `bundle_check`-regel in `run.sh` is alleen nodig voor een check met een omgevingsvariabele of zonder tijdzone-matrix. Een `grep` op faalregels is een handig extraatje maar **geen poort**: `grep '^XX'` werkt alleen voor `tests/planning/`. De bibliotheeksuite print zijn faalregels **ingesprongen** (`console.log(\`   XX ${msg}\`)` in `tests/library/check-*.ts`), dus `grep -c '^XX'` geeft daar 0 terwijl de suite rood staat — gemeten 2026-07-28. Gebruik `grep -c 'XX '` als je toch wilt tellen, en laat de exitcode altijd het oordeel vellen. `npm run verify` is de poort — één definitie in `package.json`. De release-gate draait hem in één keer; CI draait precies dezelfde stappen, verdeeld over parallelle jobs door `scripts/verify-parts.mjs` (dat de stappen uit die ene definitie leest), en de deploy start pas na een groene CI-run op `main`. Draai lokaal gerichte checks en laat de volledige `verify` in CI lopen (zie AGENTS.md). Zie `tests/planning/README.md` voor het toevoegen van cases.
