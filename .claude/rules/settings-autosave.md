---
paths:
  - "src/utils/settings*.ts"
  - "src/components/settings/**"
  - "src/hooks/useAutoSave.ts"
  - "src/services/recovery/**"
  - "src/services/actualAutosave/**"
  - "src/services/stats/**"
  - "src/components/dialogs/StatsDialog.tsx"
  - "index.html"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

# Instellingen en auto-save

### Settings persistence

`src/utils/settingsStore.ts` persists settings to `localStorage` only, under `ops-`-prefixed keys — it does **not** use `@tauri-apps/plugin-store` (that package is a dependency but unused here). De **load**-kant loopt declaratief via `src/utils/settingsRegistry.ts`: één descriptor per instelling (localStorage-sleutel → validator/parser → doelveld in `UIState`), naar het `SHORTCUTS`-patroon. Een nieuwe instelling toevoegen = één entry daar, eventueel een dunne `saveX`-wrapper in `settingsStore.ts`, plus de gedeelde UI. Drie bewuste afwijkers worden expliciet in `loadAllSettings()` afgehandeld: thema (`initTheme()` migreert legacy-namen, persisteert de conversie en levert áltijd een voorkeur; `useResolvedUITheme()` zet de extra voorkeur `system` live om naar Light/Dark voor DOM en Canvas), bouwmodus (synchroon, want de kalenderfabriek leest 'm direct) en balkkleurkeuze (`barColorSelection`, één objectkeuze met legacy-migratie uit twee oude instellingen). `UI_THEMES` bevat bewust alleen de drie handmatig kiesbare thema's; de pre-paintspiegel in `index.html` resolveert `system` al vóór React. Sleutels die buiten de opstart-hydratatie lazy laden (layouts, workTimePresets, welcomeSeen, locale) staan bewust níét in het register. Settings-UI-conventie: elke instelling moet op alle drie de plekken verschijnen — tandwiel-popup (⚙), Instellingen-ribbontab en Backstage → Instellingen — door één gedeeld component te gebruiken (`src/components/settings/SettingsPanelContent`). Op het tabblad Toepassing staat sinds 2026-09 naast Benchmark de knop **Statistieken…** (`ui.showStatsDialog` → `StatsDialog.tsx` met `DownloadStatsSection.tsx`; bewust een knop en geen eigen tabblad, de gemiddelde gebruiker heeft er niets aan): geen instelling maar een leesweergave van `downloads.json` op de `stats`-databranch (`src/services/stats/downloadStats.ts`, 30 min cache in `ops-downloadStats`, in-flight-dedupe, verlopen cache als terugval bij een netwerkfout) — dezelfde drie ingangen, nooit een GitHub-API-call vanuit de app. Regressie: `tests/planning/check-download-stats.ts` en `tests/browser/settings-stats.spec.ts`.

Separately, project **auto-save** draait zowel in Tauri als in de browser: een store-subscription (`src/hooks/useAutoSave.ts`, **gethrottled op 10 s** — bewust een throttle en geen debounce, want een debounce schrijft pas 10 s ná de láátste wijziging en vergroot dus juist het dataverliesvenster tijdens een lange bewerksessie) schrijft per open document één IFC-snapshot naar een gedeelde backend (`src/services/recovery/recoveryStore.ts` — Tauri: `appDataDir` via `plugin-fs`; web: IndexedDB) als `recovery[.<slug>].<docId>.ifc` plus een `recovery[.<slug>].documents.json`-manifest, met opruimen van verouderde snapshots, hersteld bij de volgende start. De oude enkele `recovery[.<slug>].ifc` wordt alleen nog als legacy-fallback gelezen. Dat crashherstel staat los van de runtime-only keuze **Automatisch opslaan** per document: `src/services/actualAutosave/` schrijft uitsluitend een gewijzigd, al bestaand `FileRef` terug op dezelfde 10-seconden-throttle, zonder dialoog, downloadfallback of browser-permissieprompt. Een nieuw document of een browserhandle zonder bestaand schrijfrecht kan dus nooit stil overschreven worden; uitzetten stopt alleen die bestandswrite, niet het crashherstel.
