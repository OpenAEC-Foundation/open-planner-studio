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
- `src/services/progressImport/`: het voortgangsblad (Excel en CSV, exporteren en importeren). Eerst `parseProgressCsv`/`parseProgressXlsx`, dan `matchProgressRows` (eerst id, dan WBS-code), dan `buildProgressImportPlan` voor de preview. Alleen voortgangsvelden (`completion`, `actualStart`, `actualFinish`) worden naar taken geschreven; de kolommen Start/Finish en de naam dienen alleen voor datumvolgorde-detectie en leesbaarheid. Limieten: `PROGRESS_IMPORT_LIMITS`.

Het formaat zelf staat in `public/docs/en/ref-import-exportformaten.md` (nl + en samen bijwerken).
