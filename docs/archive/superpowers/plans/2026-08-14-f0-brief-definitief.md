# F0-brief — fundament bestandsformaten (voor GLM-5.3, uitvoerder)

> **Herkomst (2026-08-15):** geoogst uit de parallelle branch `file-format-implementation`
> (verwijderd na oogst, eigenaarsbesluit — de code van die branch is bewust NIET overgenomen).
> Let op: de MPP-conclusies hierin (npm-`cfb`-spoor) zijn ingehaald door de inmiddels gebouwde
> native MPP14-lezer in `src/services/mpp/`; de XER/PMXML/PP-delen zijn actuele input voor
> etappe 2. Verifieer beweringen tegen de huidige code.


DEFINITIEF na hyperkritische review (bear, Opus 4.8 xhigh, 2026-08-14; rapport:
/tmp/rapport-critreview-plan.md, samenvatting onderaan spec). Vervangt het concept.
Orchestrator: ox. Bron-feiten: docs/superpowers/specs/2026-08-14-rapport-code-inventaris.md
+ de reviewbevindingen (al uitgezocht, klopt gegarandeerd — niet herontdekken).

## Context (gegarandeerd correct, geverifieerd door reviewer)

- Worktree: `/home/nozzit/open-aec/open-planner-studio/.claude/worktrees/file-format-implementation`
- `src/state/slices/fileSlice.ts`: openFile r189-235 (extensie-dispatch r198-207),
  openRecentFile r461-504 (dispatch r472-481), parseExternalSource r405-422 (dispatch r411),
  `parseProjectXml` r41-48 (ruime `<Project`-includes). ExportFormat r50, exportAs r315-372.
- MCP: `src/services/mcp/tools/fileTools.ts` formatOf r155-162, parseByExtension r165-172,
  verlies-description r289-309.
- `src/services/fileAccess/`: string-only. Tauri: `readTextFile` (tauriBackend.ts r12,
  UTF-8-decode); web: `file.text()` (webBackend.ts r69/r93, UTF-8). Bytes overleven dit
  pad dus NIET.
- Een .xer via de else→readIFC-tak faalt nu met IfcParseError('not-step') — nette maar
  misleidende fout ("geen IFC-bestand").
- Corpus-feit: 11 van 38 .xer-bestanden bevatten cp1252-bytes (bv. 0xA3 in
  "P6-Viewer/XER Files/Hotel Project.xer" offset ~486): blind UTF-8-decoderen corrumpeert
  ze stil. XER-ERMHDR-versies zijn ook 1-cijferig ("6.0").
- Tests draaien headless op Node via esbuild (tests/planning/run.sh); GEEN DOMParser in
  de detector gebruiken (string/byte-prefix-checks volstaan), anders sloopt de bundel.

## Taakvolgorde (BINDEND — uit review): T3 ∥ (T2 → T1 → T4)

T3 is onafhankelijk en mag als eerste losse run. T2 en T1 zijn ÉÉN gecombineerde run
(interface bytes↔detector is te verweven om te splitsen). T4 daarna.

### Run A — T3: stille-verlies-fixes + docs (onafhankelijk, geen dependencies)

1. `src/services/p6/p6xmlWriter.ts`: baselines worden nu 100% stil gedropt (0
   baseline-referenties in writer én reader, geverifieerd). BESLUIT (niet zelf kiezen):
   in deze fase ALLEEN een console.warn conform het bestaande softLoss-patroon
   ("Baselines niet geëxporteerd (N stuks)"); het echte BaselineProject-schrijven komt
   in F2, niet nu bouwen.
2. `src/services/mcp/tools/fileTools.ts` r289-309: verlies-paragraaf uitbreiden — P6-export
   verliest baselines/notes/hammock/externe links/schedulingOptions; MSPDI verliest
   secundaire constraints en degradeert resource-typen. Eerlijk en compact.
3. `docs/TODO.md` r231-239: bijwerken — de solver-fix bestaat al
   (CPMSolver.ts r80-101 resolveEffectiveLagDays, fase 2.10). Restpunten die blijven
   staan: readers keyen lagMinutes op de OPVOLGER i.p.v. de voorganger, en het dag-pad
   rondt minuut-lags op hele dagen af. Herformuleer het TODO-item naar die restpunten.

### Run B — T2+T1: bytes-pad + formaatdetector (één run)

**T2-deel, eerst:** `src/services/fileAccess/`
- `OpenedFile` krijgt `bytes: Uint8Array` NAAST `content: string`. Tauri-backend leest
  via plugin-fs `readFile` (bytes) en decodeert zelf naar string (utf-8) voor het
  bestaande veld; web-backend via `file.arrayBuffer()`, idem. `readFromRef` idem.
  Bestaande aanroepers die alleen `content` gebruiken blijven ongebroken werken.
- De per-formaat-decode (cp1252 voor XER etc.) gebeurt NIET in fileAccess maar bij de
  aanroeper ná detectie. fileAccess levert alleen rauwe bytes + een utf-8-string.

**T1-deel, daarbovenop:** nieuw `src/services/formatDetect.ts`
- `detectFormat(name: string, bytes: Uint8Array): DetectedFormat` met
  `DetectedFormat = 'ifc' | 'csv' | 'mspdi' | 'p6' | 'xer' | 'mpp' | 'astapp' | 'unknown'`.
  Werkt op BYTES (niet op de utf-8-string — binaire magics overleven die niet).
- Magic STRIKT op offset 0 (na optionele BOM-skip), alleen de eerste ~512 bytes bekijken:
  - `D0 CF 11 E0 A1 B1 1A E1` → mpp
  - `SQLite format 3\0` → astapp
  - `ERMHDR` (ASCII, na BOM) → xer
  - `ISO-10303-21` → ifc
  - XML (`<?xml` of `<` na BOM/whitespace): dialect bepalen op de ROOT-ELEMENT-TAG +
    xmlns-attribuut binnen de eerste ~2KB (gedecodeerd als utf-8, tolerant):
    `APIBusinessObjects`/`BusinessObjects` of xmlns met `Primavera` → p6;
    xmlns `schemas.microsoft.com/project` → mspdi;
    anders: alléén bij .xml-extensie de ruime `<Project`-fallback → mspdi, anders unknown.
    GEEN includes() over het hele bestand (PMXML-notes bevatten HTML/CDATA die
    mid-file markers kan bevatten).
  - `.csv`-extensie zonder XML/andere magic → csv (inhouds-heuristiek niet nodig in F0).
  - Anders → unknown.
- **Alle VIER call-sites** door de detector, met bytes:
  1. `openFile` (fileSlice r198-207) — geef `opened.bytes` aan detectFormat, NIET
     `opened.content`.
  2. `openRecentFile` (r472-481) — idem.
  3. `parseExternalSource` (r405-422) — idem (Tauri-pad: bytes lezen).
  4. MCP `parseByExtension` (fileTools r165-172) + `formatOf` (r155-162) — description
     eerlijk houden.
  `unknown` → nette fout via de bestaande notify-flow (`notifications.openFailed`),
  NOOIT stil naar het IFC-pad. Voor xer/mpp/astapp (nog geen reader): duidelijke
  "formaat herkend maar nog niet ondersteund"-fout (Engelse fallback-string in de
  dienstlaag, geen t(...)).
- XER-decode-helper alvast (voor F1): `decodeXerBytes(bytes): string` — BOM-detectie
  (utf-8/utf-16), anders `TextDecoder('windows-1252')`. Nog niet aangesloten op een
  reader; wel unit-getest.
- **Dialoogfilters/UI expliciet NIET aanraken** (openFile r191-196 blijft
  ifc/csv/xml) — UI en i18n zijn F6; anders breekt de i18n-poort.
- Gedrag voor geldige bestaande formaten (ifc/csv/mspdi/p6) blijft functioneel identiek.
- Tests: `tests/planning/check-format-detect.ts` (esbuild-patroon volgen, GEEN
  DOMParser-import): magic-cases per formaat, BOM-varianten (utf-8, utf-16le/be),
  leeg bestand, verminkte header, magic-strings mid-file die NIET mogen matchen
  (bv. "ERMHDR" in een XML-note), .xml-met-ERMHDR-op-offset-0 (= xer),
  .pod met microsoft-xmlns (= mspdi via ns, niet via fallback), cp1252-bytes.
  Plus een bundle_check-regel in tests/planning/run.sh.

### Run C — T4: corpus-runner (na Run B)

Nieuw `scripts/corpus-check.ts` (NIET in npm run verify):
- Corpuspad via CLI-arg of env `OPS_CORPUS_DIR`; GEEN hardgecodeerd absoluut pad.
  (Orchestrator draait hem met de twee corpus-mappen; paden bevatten spaties — quoten.)
- Leest bestanden als Buffer (binair), detecteert met detectFormat, en:
  - ifc/csv/mspdi/p6: parse met de echte reader (headless; domShim + xmldom-shim
    importeren zoals check-adapters-hours.ts r23-25); rapporteer ok/fout + task/seq-counts.
  - xer/mpp/astapp: gedetecteerd-maar-overgeslagen (er is nog geen reader) — telt als
    "herkend", NIET als fout.
  - unknown: aparte telling.
- Exit-code: 0 zolang ondersteunde formaten niet crashen; parse-crash op ifc/csv/mspdi/p6
  = fail. Output als compacte tabel per formaat.
- LET OP bekende beperking: de xmldom-shim kent geen CDATA/namespaces; echte PMXML met
  CDATA kan daardoor vals falen in Node. Markeer zulke gevallen als "shim-limiet"
  (vang de parse-error, tel apart) — de shim-uitbreiding is bewust GEEN F0-scope.

## Verboden (alle runs)
- Geen commits (orchestrator commit na poort+review). Geen npm/dev-server draaien.
- Niet buiten de per-run genoemde bestanden; geen extra features; geen UI/i18n-wijzigingen.
- Geen `t(...)`/`@/i18n/config`-import in dienstlaag (sloopt headless bundels).
- B3b (geneste PMXML-Activity's) NIET fixen in F0 — dat is bewust F2, met eigen genest
  fixture. (Spec is hierop rechtgetrokken.)
- Commentaar in het Nederlands, in de stijl van het project.

## Rapport-eisen per run
Gewijzigde bestanden, oud→nieuw per wijziging, verrassingen, en wat je NIET kon
verifiëren (jij kunt geen tests draaien; de orchestrator draait de poorten).
