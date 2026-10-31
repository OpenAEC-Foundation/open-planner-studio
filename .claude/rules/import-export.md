---
paths:
  - "src/services/progressImport/**"
  - "src/services/xlsx/**"
  - "src/services/zip/**"
---

# Voortgangsblad, XLSX en ZIP

Drie pure, injecteerbare lagen: geen store, geen React, geen `@tauri-apps/*`, geen module-level muteerbare state.

- `src/services/zip/`: gedeelde ZIP-lezer en -schrijver (`zipReader.ts`, `zipWriter.ts`, `crc32.ts`) voor de extensie-installatie én de `.xlsx`-laag. Begrensd lezen (`inflateRawBounded`); de extensielimieten zijn 24 MiB per bestand en 48 MiB totaal (`EXTENSION_ZIP_LIMITS`), geen Zip64.
- `src/services/xlsx/`: `readXlsxSheet` en `writeProgressXlsx` met eigen `XLSX_LIMITS` (16 MiB bestand, 50 000 rijen, 256 kolommen). De schrijver krijgt alle zichtbare tekst van buiten (`ProgressXlsxText`), dus geen i18n in de laag. Importeer lezer of schrijver in app-code via een dynamic import, niet via de barrel, zodat de hoofdbundel klein blijft.
- `src/services/progressImport/`: het voortgangsblad (alleen Excel, exporteren en importeren; het CSV-blad is weg, eigenaarsbesluit 2026-10-30). Eerst `parseProgressXlsx`, dan `matchProgressRows` (eerst id, dan WBS-code), dan `buildProgressImportPlan` voor de preview. Alleen voortgangsvelden (`completion`, `actualStart`, `actualFinish`) worden naar taken geschreven; de kolommen Start/Finish en de naam dienen alleen voor datumvolgorde-detectie en leesbaarheid. Limieten: `PROGRESS_IMPORT_LIMITS`.
- De exportstand (`exportState.ts`, issue #743): het `.xlsx`-blad draagt per taak een verborgen, vergrendelde cel `OPS Export` met de stand bij de export. `buildProgressImportPlan` vergelijkt per veld de exportstand, het blad en de app: alleen de app veranderd ⇒ `keptApp`, beide veranderd ⇒ `conflicts`. Een botsing zonder keuze (`conflictChoices`) maakt de rij `unresolved`, en `applyProgressImport` schrijft dan niets (eigenaarsbesluit 2026-10-30). Verandert de taakplanner een veld dat de app houdt (bijvoorbeeld een bladeinde bij keuze `app` op de voltooiing), dan weigert de rij met `conflictingProgressInputs`. Zonder geldige exportstand of na een koppeling aan een andere taak geldt de oude vergelijking, en de rij telt in `withoutExportStateCount`.

Het formaat zelf staat in `public/docs/en/ref-import-exportformaten.md` (nl + en samen bijwerken).
