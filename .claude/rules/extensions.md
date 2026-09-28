---
paths:
  - "src/extensions/**"
  - "src/state/slices/extensionSlice.ts"
  - "src/components/backstage/ExtensionManagerPanel.tsx"
  - "docs/extensions.md"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

### Extensiesysteem

Naar het model van Open Calc Studio (`OpenAEC-Foundation/open-calc-studio`): een extensie is een ZIP (of los `.js`) met `manifest.json` + `main.js` (CommonJS, exporteert `onLoad(api)`/`onUnload()`). Volledig frontend — geen Rust. Code in `src/extensions/` (types, api, loader, service), state in `extensionSlice`. Opslag: IndexedDB `ops-extensions`; uitvoering: `new Function(...)`-sandbox waarvan `require()` alleen `'open-planner-studio'` teruggeeft; permissies (`ribbon`, `events`, …) worden per API-call afgedwongen. UI: Backstage → Extensies (beheer/installeren/catalogus) en Backstage → Importeren (extensie-importers); extensie-ribbon-knoppen renderen via `ExtensionRibbonGroups`. Catalogus: `open-planner-studio-extensions/catalog.json` op GitHub raw (30 min cache). Extensies zijn app-niveau data (geen projectdata) — geen IFC-round-trip-impact; importer-resultaten (`ImportResult`) zijn gewone store-data. Zelftest-haken: `window.__OPS__.extensions.*` (dev-only). Auteurshandleiding: `docs/extensions.md`.

Sinds contract 1.4.0 (permissie `help`): `api.help.*` in `helpApi.ts` — artikelen naar `utils/helpArticleRegistry.ts` (bron = extensie-id, afbeeldingen als blob-URL uit de assets), `openBundledProject` via `openExampleFromString`, en het begeleidingspaneel: looptijd in `guideRuntime.ts` (module-state, geen store; `check` na store-wijzigingen, gebundeld), model/validatie in `guideModel.ts`, UI in `components/guide/GuidePanel.tsx`. Ankers (`data-tour-anchor`: `ribbon-tab:`/`ribbon-group:`/`ribbon:`) zet het generieke lint-render-pad; nooit per knop met de hand.
