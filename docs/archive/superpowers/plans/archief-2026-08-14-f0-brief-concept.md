# F0-brief — fundament bestandsformaten (voor GLM-5.3, uitvoerder)

> **Herkomst (2026-08-15):** geoogst uit de parallelle branch `file-format-implementation`
> (verwijderd na oogst, eigenaarsbesluit — de code van die branch is bewust NIET overgenomen).
> Let op: de MPP-conclusies hierin (npm-`cfb`-spoor) zijn ingehaald door de inmiddels gebouwde
> native MPP14-lezer in `src/services/mpp/`; de XER/PMXML/PP-delen zijn actuele input voor
> etappe 2. Verifieer beweringen tegen de huidige code.


CONCEPT — wordt definitief na ram-rapport (formaatspecs) + hyperkritische review.
Orchestrator: ox. Bron-feiten: docs/superpowers/specs/2026-08-14-rapport-code-inventaris.md
(al uitgezocht, klopt gegarandeerd — verspil geen turns aan herontdekken).

## Context (gegarandeerd correct)

- Worktree: `/home/nozzit/open-aec/open-planner-studio/.claude/worktrees/file-format-implementation`
- `src/state/slices/fileSlice.ts`: openFile r189-235 dispatcht op extensie (csv/xml/else→IFC);
  `parseProjectXml` r41-48 snifft alleen XML (P6 vóór MSPDI; `<Project`-check is te ruim);
  openRecentFile r461-504; parseExternalSource r405-422; ExportFormat r50; exportAs r315-372.
- `src/services/fileAccess/`: string-only (`OpenedFile.content: string`); web- en Tauri-backend.
- MCP: `src/services/mcp/tools/fileTools.ts` formatOf r155-162, parseByExtension r165-172.
- Readers zijn headless-veilig; tests bundelen met esbuild op Node (tests/planning/run.sh);
  xmldom-shim heeft geen namespaces/CDATA.

## Taken (elk een afgebakende GLM-run, in deze volgorde)

### T1 — Centrale formaatdetector (B1)
Nieuw `src/services/formatDetect.ts`:
- `detectFormat(name: string, content: string | Uint8Array): DetectedFormat`
  met `DetectedFormat = 'ifc' | 'csv' | 'mspdi' | 'p6' | 'xer' | 'mpp' | 'astapp' | 'unknown'`.
- Inhouds-magic eerst, extensie als tiebreaker:
  - `ERMHDR` aan het begin (na optionele BOM) → xer
  - bytes `D0 CF 11 E0 A1 B1 1A E1` → mpp (CFB-container)
  - `SQLite format 3\0` → astapp (sqlite-variant)
  - XML: eerst PMXML-markers (`APIBusinessObjects`/`xmlns.oracle.com/Primavera`), dan MSPDI
    (`schemas.microsoft.com/project`), dan pas de ruime `<Project`-fallback; anders unknown
  - `ISO-10303-21`/`HEADER;` → ifc
- `unknown` NOOIT stil naar IFC: aanroepers gooien een nette fout (bestaande
  notify-flow `notifications.openFailed`).
- openFile/openRecentFile/parseExternalSource/MCP parseByExtension gaan alle vier door de
  detector. Gedrag van de bestaande drie formaten blijft byte-identiek voor geldige bestanden.
- Tests: `tests/planning/check-format-detect.ts` (esbuild-patroon volgen, zie
  check-adapters-hours.ts kop): magic-cases, BOM, lege bestanden, verminkte headers,
  extensie-vs-inhoud-conflicten (bv. .xml met ERMHDR erin).

### T2 — bytes-pad fileAccess (B2)
- `OpenedFile` krijgt een binaire variant of een `bytes: Uint8Array`-veld; Tauri-backend
  via plugin-fs `readFile`, web via `file.arrayBuffer()`. `readFromRef` idem.
- Tekstformaten blijven het string-pad gebruiken (geen churn); alleen mpp/astapp lezen bytes.
- Encoding-nuance XER: latin-1/cp1252 komt voor — decodeer tekstformaten expliciet
  (TextDecoder met fallback), niet blind utf-8. (Details volgen uit ram-rapport.)

### T3 — stille-verlies-fixes bestaande writers (B3)
- p6xmlWriter: baselines-verlies expliciet (console.warn, conform bestaand softLoss-patroon)
  — of schrijven indien PMXML dat draagt (beslis na ram-rapport).
- MCP-tooldescription (fileTools r289+): verlies-paragrafen actualiseren.
- docs/TODO.md r231-239 bijwerken (solver-fix bestaat; restpunt = reader-keying + dag-afronding).

### T4 — corpus-runner (harnas)
Nieuw `scripts/corpus-check.ts` (NIET in npm run verify):
- Loopt "/home/nozzit/open-aec/voor claude/testdata-crawl/" + "test bestanden voor file
  implementation/" door, detecteert formaat per bestand (T1-detector), parseert met de
  bijpassende reader en rapporteert: ok / fout / onbekend, met telling per formaat.
- Exit-code 0 zolang alleen bekende-onbekende formaten falen; parse-crashes op ondersteunde
  formaten = fail. Output als tabel.
- Curated subset (klein, gecommit onder tests/planning/fixtures/) voor CI komt in F1+.

## Verboden
- Geen commits (orchestrator commit na poort+review).
- Geen npm/dev-server draaien (permissiepoorten); orchestrator draait verify.
- Niet buiten de genoemde bestanden; geen nieuwe features; commentaar in het Nederlands,
  stijl van het project (zie bestaande bestanden).
- Geen `t(...)`/`@/i18n/config` in dienstlaag (sloopt headless bundels).

## Rapport-eisen per run
Gewijzigde bestanden, oud→nieuw per wijziging, verrassingen, en wat je NIET kon verifiëren.
