# Native .mpp-import (alleen-lezen, MPP14) — Implementatieplan (fase 3.8, etappe 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Doel:** `.mpp`-bestanden van MS Project 2010 t/m 2021 (MPP14-containerformaat) openen via het gewone open-pad (Openen-dialoog, recents, MCP `planner_import_schedule`, devBridge), met een native TypeScript-lezer in de kern — alleen-lezen; oudere formaten (MPP8/9/12) en wachtwoord-versleutelde bestanden geven een vertaalde, handelingsgerichte foutmelding ("exporteer als XML uit MS Project").

**Architectuur:** een nieuw `src/services/formatRegistry.ts` wordt de éne bron voor de extensie→reader-dispatch (nu 5× gedupliceerd) en de exportlijst; `fileAccess` krijgt een binair leespad; de MPP-lezer zelf (`src/services/mpp/`) is een gelaagde port van de MPXJ-Java-bronnen (CFB/OLE2 → container/Props → FixedMeta/FixedData/VarMeta/Var2Data → FieldMap14 → `ImportResult`) en blijft via dynamic import + `manualChunks` buiten de main chunk. Doel-datamodel is het bestaande `ImportResult` met dezelfde veldsemantiek als `readMSPDI`.

**Tech stack:** bestaand — TypeScript strict, geen nieuwe dependencies (CFB-lezer zelf schrijven, conform de eigen-parser-traditie: IFC-parser, harfbuzz-subsetter). Referentie-implementatie: MPXJ (Java, LGPL-2.1) — alleen als leesbron, geen runtime-dependency.

**Besluitstatus:** de route "native TS in de kern" is een vaststaand user-besluit (2026-08-14) en herziet de triage van 2026-07-07 in `docs/TODO.md` §3.8 — die rustte op de premisse dat native niet realistisch was; corpusonderzoek toont dat Project 2010–2021 allemaal hetzelfde onversleutelde MPP14-formaat schrijven. Taak T10 werkt TODO.md bij. Niet heropenen.

---

## Corpus & referentiemateriaal (paden buiten de repo — mét spatie in "voor claude")

- **Ground-truth-corpus** (echte bedrijfsbestanden van de gebruiker — **NOOIT in de repo committen**; tests lezen ze via een pad/env-var):
  `/home/nozzit/open-aec/voor claude/test bestanden voor file implementation/`
  Drie MPP14-bestanden, onversleuteld (PASSWORD_FLAG=0), elk mét MSPDI-export van hetzelfde project als ground truth:
  | bestand | taken | links | resources | assignments | kalenders |
  |---|---|---|---|---|---|
  | `Bijlage 13 Productieplanning.mpp` (+ `.mpp.xml`) | 51 | 104 | 9 | 51 | 13 |
  | `Bijlage 20 productieplanning PKB.mpp` (+ `.mpp.xml`) | 134 | 111 | 7 | 146 | 11 |
  | `bijlage 7 Productie planning.mpp` (+ `.mpp.xml`) | 215 | 225 | 5 | 221 | 9 |
- **Breedte-corpus** (mogelijk auteursrechtelijk beschermd cursusmateriaal — **niet committen**): `/home/nozzit/open-aec/voor claude/testdata-crawl/crawl-mpp/` — 49 `.mpp` (submappen `MSP2016_OzBuild`, `MSP2021_OzBuild`), allemaal MPP14 onversleuteld.
- **MPXJ-bronnen** (LGPL-2.1, Jon Iles e.a.): `/home/nozzit/open-aec/voor claude/testdata-crawl/mpxj/src/main/java/org/mpxj/mpp/` — kernbestanden:
  - `MPPReader.java` — entry; CompObj-detectie, `FILE_CLASS_MAP` r. 445–455 (`"MSProject.MPP14"` → MPP14Reader)
  - `MPP14Reader.java` — wachtwoordvlag r. 154; `processCalendarData` r. 966; `processTaskData` r. 982 (field map r. 985, primitieven r. 991–996); `processConstraintData` (= **relaties**) r. 1541; `processResourceData` r. 1550 (field map r. 1553); `processAssignmentData` r. 1714 (field map r. 1717)
  - `FieldMap.java` / `FieldMap14.java` — de field maps worden **uit het bestand zelf gelezen** (data-gedreven, via de Props-stream); geen giga-statische offsettabellen nodig
  - `Props.java` / `Props14.java` / `PropsKey.java` — `PASSWORD_FLAG(893386752)` r. 73, `ENCRYPTION_CODE(893386759)` r. 59
  - `FixedMeta.java`, `FixedData.java`, `VarMeta.java`/`AbstractVarMeta.java`/`VarMeta12.java` (**MPP14 gebruikt VarMeta12** — zie MPP14Reader r. 991), `Var2Data.java`, `MPPUtility.java` (datums/durations/unicode-strings), `MPP14CalendarFactory.java` + `AbstractCalendarAndExceptionFactory.java`, `ConstraintFactory.java` (TBkndCons = relaties+lag), `CompObj.java`
  - `DocumentInputStreamFactory.java` (XOR-decodering) — **buiten scope**: versleuteld ⇒ nette fout
- **Containerstructuur van de doelbestanden (geverifieerd):** root bevat `\x01CompObj` (formaatstring `MSProject.MPP14`), `Props14`, storage `"   114"` (drie spaties + `114`) met stream `Props` (~88 kB) en substorages `TBkndTask`/`TBkndRsc`/`TBkndAssn`/`TBkndCons`/`TBkndCal` (elk `FixedMeta`/`FixedData`/`Fixed2Meta`/`Fixed2Data`/`VarMeta`/`Var2Data`); lege `TBkndLabel`/`Checklist`/`Conversation`/`Attachment` (negeren) en storage `"   214"` (views — **overslaan**, kan MB's groot zijn).

> ⚠️ **Corpusbevinding T5-spec-review (2026-08-14): de drie `.mpp.xml`-ground-truths zijn een ándere
> documentversie dan de `.mpp`'s** (compact hernummerde UID==ID 1..N, verplaatste taken, deels andere
> datums — projectstart bestand 3 verschilt zelfs). De aantallen in de tabel hierboven (kalenders
> 13/11/9, links 104/111/225, resources 9/7/5, assignments 51/146/221) zijn daardoor NIET gezaghebbend
> voor de `.mpp`-inhoud; ruwe TBkndCons-scan geeft bv. 115/134/252 linkrecords. T6/T7/T9 mogen die
> XML-aantallen dus niet hard asserteren — gebruik naam-gematchte vergelijking + per-veld-budgetten
> zoals de T5-sectie van `check-mpp-import.ts` nu doet, en leg gemeten baselines vast.

## Bewust NIET in etappe 1

- Geen `.mpp`-export (bestaat nergens, ook MPXJ niet — de MS-Project-export blijft de bestaande MSPDI-writer).
- Geen MPP8/9/12, geen wachtwoord-versleutelde bestanden (nette fout), geen Asta `.pp` — de managed-tools-route blijft daarvoor als optie genoteerd in TODO.md (T10).
- Geen baselines, custom fields/outline codes, subprojecten, kostenvelden of grafische data uit de `.mpp` — veldenset = exact wat `readMSPDI` óók levert, minus baselines (gedocumenteerde beperking in het docs-artikel).
- Geen in-repo `.mpp`-fixture: een licentie-schoon bestand is zonder MS Project niet te maken, dus de regressietest is uitsluitend corpus-gedreven met nette skip (expliciet gedocumenteerd in de check-header).

## Parallelliseringsoverzicht

```
BAAN A (app-plumbing):   T1 registry-refactor → T2 binair leespad
BAAN B (parser):         T3 CFB-lezer → T4 containerlaag → T5 taken → T6 kalenders → T7 relaties/resources/assignments
                                   ▼  SYNC: beide banen af, npm test groen
Serieel:                 T8 integratie → T9 contract-test → T10 docs/TODO/credits → T11 eindreview + verify
```

Banen A en B raken disjuncte bestanden en mogen in parallelle worktrees. `tests/planning/check-mpp-import.ts` is exclusief BAAN B-terrein (T3 maakt hem aan, T4–T7 en T9 breiden uit).

**Testgate bij elke taak:** `npx tsc --noEmit` groen + `npm test` (exitcode is de poort, nooit de tail-uitvoer) + de taakspecifieke acceptatiecriteria. Elke taak eindigt met een commit.

## Bestandsstructuur

**Nieuw:**
- `src/services/formatRegistry.ts` — formaatregistry (T1) + mpp-registratie (T8)
- `src/services/mpp/cfb.ts` — CFB/OLE2-lezer (T3)
- `src/services/mpp/errors.ts` — `MppUnsupportedError` (T4)
- `src/services/mpp/mppContainer.ts` — CompObj-detectie, Props, wachtwoordvlag (T4)
- `src/services/mpp/mppPrimitives.ts` — FixedMeta/FixedData/VarMeta/Var2Data + MPPUtility-equivalenten (T4)
- `src/services/mpp/fieldMap14.ts` — FieldMap-port (T5)
- `src/services/mpp/mppCalendars.ts` — kalenderfabriek (T6)
- `src/services/mpp/mppReader.ts` — entry `readMPP(bytes, labels?)` → `ImportResult` (T5–T7), mét MPXJ-attributieheader
- `tests/planning/check-mpp-import.ts` — corpus-gedreven regressiecheck (T3, groeit t/m T9)
- `public/docs/nl/gids-msproject-import.md` + `public/docs/en/gids-msproject-import.md` (T10)

**Gewijzigd:** `src/state/slices/fileSlice.ts` (dispatch → registry; foutmelding-mapping), `src/services/fileAccess/index.ts` + `tauriBackend.ts` + `webBackend.ts` (binair leespad), `src/services/mcp/tools/fileTools.ts` (registry + `readFile`), `src/utils/devBridge.ts` (registry), `src/components/backstage/Backstage.tsx` (exportlijst uit registry), `vite.config.ts` (manualChunks), `tests/planning/run.sh` (check-registratie), `tests/mcp/cases-doc-file.ts`/`cases-backup.ts`/`cases-sync2-integration.ts` (fs-fake + `readFile`), `src/i18n/locales/*/common.json` (14 talen), `public/docs/manifest.json`, `docs/TODO.md`.

---

## BAAN A — app-plumbing

### Taak T1 — Formaatregistry-refactor (pure refactor, gedrag ongewijzigd)

**Afhankelijk van:** niets. **Blokkeert:** T2, T8.
**Files:** Create `src/services/formatRegistry.ts`; Modify `src/state/slices/fileSlice.ts`, `src/services/mcp/tools/fileTools.ts`, `src/utils/devBridge.ts`, `src/components/backstage/Backstage.tsx`.

De extensie→reader-dispatch bestaat nu 5×: `fileSlice.openFile` (r. 189–235; filters r. 191–196, dispatch r. 198–207), `openRecentFile` (r. 476–485), `parseExternalSource` (r. 415), `fileTools.parseByExtension` (r. 164–172) en `devBridge.openFromPath` (r. 77–84). De XML-subdispatch (`parseProjectXml`, fileSlice r. 41–48) en de exportlijst (`ExportFormat` r. 50 + Backstage `formats`-array r. 366–371) horen bij dezelfde familie. Eén registry voedt ze allemaal.

- [x] **Stap 1: schrijf de registry.** Create `src/services/formatRegistry.ts`:

```ts
import { readIFC } from '@/services/ifc/ifcReader';
import { readCSV } from '@/services/csv/csvReader';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { readP6XML } from '@/services/p6/p6xmlReader';
import type { ImportLabels, ImportResult } from '@/services/importTypes';
import type { FileFilter } from '@/services/fileAccess';

/** Invoer voor een reader: tekstformaten krijgen `text`, binaire formaten `bytes`. */
export interface FormatInput { name: string; text?: string; bytes?: Uint8Array }

export interface ReadFormat {
  id: string;
  extensions: string[];
  kind: 'text' | 'binary';
  /** Dialoogfilterlabel — bewust hard-coded Engels (bestaande conventie: 'IFC Files'). */
  filterName: string;
  read(input: FormatInput, labels?: ImportLabels): Promise<ImportResult>;
}

/** Kies de juiste XML-reader op inhoudsmarkers (P6 vóór MS Project) — verhuisd uit fileSlice,
 *  gedrag letterlijk gelijk (incl. de throw bij onbekend XML-formaat). */
export function parseProjectXml(content: string): ImportResult {
  const isP6 = content.includes('APIBusinessObjects') || content.includes('Primavera');
  const isMsProject =
    content.includes('schemas.microsoft.com/project') || content.includes('<Project');
  if (isP6) return readP6XML(content);
  if (isMsProject) return readMSPDI(content);
  throw new Error('Onbekend XML-formaat: geen MS Project- of Primavera-markers gevonden');
}

// Volgorde = bestaande filtervolgorde in openFile ('All Supported' met ifc,csv,xml).
const READ_FORMATS: ReadFormat[] = [
  { id: 'ifc', extensions: ['ifc'], kind: 'text', filterName: 'IFC Files',
    read: async (i, labels) => readIFC(i.text ?? '', labels) },
  { id: 'csv', extensions: ['csv'], kind: 'text', filterName: 'CSV Files',
    read: async (i) => readCSV(i.text ?? '') },
  { id: 'xml', extensions: ['xml'], kind: 'text', filterName: 'XML Files',
    read: async (i) => parseProjectXml(i.text ?? '') },
];

/** Extensie-match; onbekende extensie ⇒ IFC (bestaand gedrag: de else-tak van alle vijf kopieën). */
export function readFormatForFile(name: string): ReadFormat {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return READ_FORMATS.find((f) => f.extensions.includes(ext)) ?? READ_FORMATS[0];
}

export function openDialogFilters(): FileFilter[] {
  return [
    { name: 'All Supported', extensions: READ_FORMATS.flatMap((f) => f.extensions) },
    ...READ_FORMATS.map((f) => ({ name: f.filterName, extensions: f.extensions })),
  ];
}

export function binaryExtensions(): string[] {
  return READ_FORMATS.filter((f) => f.kind === 'binary').flatMap((f) => f.extensions);
}

export function parseOpenedFile(input: FormatInput, labels?: ImportLabels): Promise<ImportResult> {
  return readFormatForFile(input.name).read(input, labels);
}

/** Vertaalsleutel voor een mislukte open-actie. Duck-typed op `mppCode` zodat deze module de
 *  (lazy geladen) mpp-chunk niet statisch hoeft te importeren. */
export function importErrorMessageKey(err: unknown): string {
  const code = (err as { mppCode?: string } | null | undefined)?.mppCode;
  if (code === 'MPP_ENCRYPTED') return 'notifications.mppEncrypted';
  if (code === 'MPP_LEGACY') return 'notifications.mppLegacy';
  return 'notifications.openFailed';
}

// ── Export-kant ──────────────────────────────────────────────────────────────────────────────
export type ExportFormat = 'ifc' | 'csv' | 'mspdi' | 'p6';
export interface ExportFormatMeta { format: ExportFormat; icon: string; labelKey: string; descKey: string }
/** Volgorde = bestaande Backstage-volgorde (Backstage.tsx r. 366–371). */
export const EXPORT_FORMATS: ExportFormatMeta[] = [
  { format: 'csv',   icon: 'CSV', labelKey: 'export.csvLabel',   descKey: 'export.csvDesc' },
  { format: 'mspdi', icon: 'XML', labelKey: 'export.mspdiLabel', descKey: 'export.mspdiDesc' },
  { format: 'p6',    icon: 'P6',  labelKey: 'export.p6Label',    descKey: 'export.p6Desc' },
  { format: 'ifc',   icon: 'IFC', labelKey: 'export.ifcLabel',   descKey: 'export.ifcDesc' },
];
```

- [x] **Stap 2: fileSlice omzetten.** In `src/state/slices/fileSlice.ts`:
  - Verwijder de lokale `parseProjectXml` en het lokale `export type ExportFormat`; vervang door `export { parseProjectXml } from '@/services/formatRegistry';` en `export type { ExportFormat } from '@/services/formatRegistry';` (bestaande importeurs — Backstage, MCP — blijven werken).
  - `openFile`: `openFileDialog(openDialogFilters())`; dispatch wordt `const parsed = await parseOpenedFile({ name: opened.name, text: opened.content }, labels);`.
  - `openRecentFile`: idem (`{ name: entry.name, text: content }`).
  - `parseExternalSource`: idem (`{ name: filePath, text: content }`).
- [x] **Stap 3: fileTools omzetten.** In `src/services/mcp/tools/fileTools.ts`: importeer `parseProjectXml` voortaan uit `@/services/formatRegistry`; vervang `parseByExtension(path, content)` door `await parseOpenedFile({ name: path, text: content })`. Laat `formatOf` staan (die levert het AI-facing label).
- [x] **Stap 4: devBridge omzetten.** In `src/utils/devBridge.ts` `openFromPath` (r. 77–84): vervang de `csv/ifc`-ternary door `await parseOpenedFile({ name: path, text: content })`. (Kleine dev-only gedragsverbetering: `.xml` werkt daar nu ook — noteer dat in de commitboodschap.)
- [x] **Stap 5: Backstage-exportlijst.** In `src/components/backstage/Backstage.tsx` r. 366–371: vervang de hard-coded `formats`-array door `EXPORT_FORMATS.map((m) => ({ format: m.format, label: tMenu(m.labelKey), desc: tMenu(m.descKey), icon: m.icon }))`.
- [x] **Stap 6: gate.** `npx tsc --noEmit` groen; `npm test` groen (exitcode!); `npm run verify:cycles` groen (de registry importeert readers, fileSlice importeert de registry — geen cyclus, want de registry importeert níéts uit `state/`). Handmatige controle: `grep -rn "readCSV(" src/ | grep -v formatRegistry` toont geen dispatch-plekken meer buiten de registry (wel de import in de registry zelf).
- [x] **Stap 7: commit.** `refactor(formats): één formatRegistry voedt de 5 open-dispatches + exportlijst (fase 3.8 e1, T1)`

### Taak T2 — Binair leespad in fileAccess (Tauri + web + recents + MCP-fs + devBridge)

**Afhankelijk van:** T1. **Blokkeert:** T8.
**Files:** Modify `src/services/fileAccess/index.ts`, `src/services/fileAccess/tauriBackend.ts`, `src/services/fileAccess/webBackend.ts`, `src/state/slices/fileSlice.ts`, `src/services/mcp/tools/fileTools.ts`, `src/utils/devBridge.ts`, `tests/mcp/cases-doc-file.ts`, `tests/mcp/cases-backup.ts`, `tests/mcp/cases-sync2-integration.ts`.

Het hele open-pad is nu tekst-only (`readTextFile` / `file.text()`). Binaire formaten hebben bytes nodig; tekstformaten blijven exact zoals ze zijn.

- [x] **Stap 1: `OpenedFile` + dialoog-opties.** In `src/services/fileAccess/index.ts`:

```ts
export interface OpenedFile {
  name: string;
  /** Tekstinhoud; bij een binair formaat (opts.binaryExtensions) leeg — gebruik dan `bytes`. */
  content: string;
  bytes?: Uint8Array;
  ref: FileRef | null;
}
export interface OpenDialogOpts {
  /** Extensies (zonder punt, lowercase) die als bytes gelezen moeten worden i.p.v. tekst. */
  binaryExtensions?: string[];
}
export function openFileDialog(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  return isTauri() ? openFileDialogTauri(filters, opts) : openFileDialogWeb(filters, opts);
}
/** Bytes van een bewaarde ref herlezen (recents met een binair formaat). `null` bij fout/geweigerd. */
export function readBytesFromRef(ref: FileRef): Promise<Uint8Array | null> {
  return isTauri() ? readBytesFromRefTauri(ref) : readBytesFromRefWeb(ref);
}
```

- [x] **Stap 2: Tauri-backend.** In `tauriBackend.ts`: geef `openFileDialogTauri` de extra `opts`-parameter; na de picker: `const isBinary = (opts?.binaryExtensions ?? []).includes(path.split('.').pop()?.toLowerCase() ?? '');` — bij binair `const { readFile } = await import('@tauri-apps/plugin-fs'); const bytes = await readFile(path); return { name: basename(path), content: '', bytes, ref: { kind: 'path', path } };`, anders het bestaande `readTextFile`-pad. Voeg toe:

```ts
export async function readBytesFromRefTauri(ref: FileRef): Promise<Uint8Array | null> {
  if (ref.kind !== 'path') return null;
  try {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    return await readFile(ref.path);
  } catch { return null; }
}
```

- [x] **Stap 3: web-backend.** In `webBackend.ts`: zelfde extensie-beslissing in `openFileDialogWeb` (FSA-tak: `new Uint8Array(await file.arrayBuffer())`; `openViaInput`-fallback idem). Voeg `readBytesFromRefWeb` toe als spiegel van `readFromRefWeb` (zelfde permissie-dans, maar `arrayBuffer()`), `null` bij fout.
- [x] **Stap 4: aanroepers.** `fileSlice.openFile`: `openFileDialog(openDialogFilters(), { binaryExtensions: binaryExtensions() })` en geef `bytes: opened.bytes` mee aan `parseOpenedFile`. `openRecentFile`: als `readFormatForFile(entry.name).kind === 'binary'` dan `readBytesFromRef(entry.ref)` (bij `null` dezelfde stille verwijdering als nu), anders het bestaande `readFromRef`; geef `bytes` door. `parseExternalSource` en `devBridge.openFromPath`: bij een binair formaat `readFile` (plugin-fs) i.p.v. `readTextFile`, en `bytes` doorgeven.
- [x] **Stap 5: MCP-fs.** In `src/services/mcp/tools/fileTools.ts`: breid `McpFileFs` uit met `readFile(path: string): Promise<Uint8Array>;` en implementeer in `realFs()` via `plugin-fs`-`readFile`. In de `planner_import_schedule`-handler: als `readFormatForFile(path).kind === 'binary'` dan `const bytes = await fs.readFile(path)` en `parseOpenedFile({ name: path, bytes })`, anders het bestaande `readTextFile`-pad. Werk de drie in-memory fakes in `tests/mcp/` bij (grep `getFs`): geef ze een `readFile` die `new TextEncoder().encode(...)` over de tekst-map teruggeeft.
- [x] **Stap 6: gate.** `npx tsc --noEmit`; `npm test` (m.n. `tests/mcp/` en `tests/planning/check-web-save-fallback.ts` moeten ongemoeid groen zijn — er verandert niets aan het tekstpad).
- [x] **Stap 7: commit.** `feat(fileAccess): binair leespad (bytes) voor open-dialoog, recents, MCP-fs en devBridge (T2)`

---

## BAAN B — de MPP14-lezer

### Taak T3 — Minimale CFB/OLE2-lezer + corpus-check-scaffold

**Afhankelijk van:** niets (parallel met BAAN A). **Blokkeert:** T4.
**Files:** Create `src/services/mpp/cfb.ts`, `tests/planning/check-mpp-import.ts`; Modify `tests/planning/run.sh`.

Eigen implementatie, alleen-lezen; geen dependency (conform de eigen-parser-traditie van dit project). Specificatie: MS-CFB (Compound File Binary). De essentiële feiten staan hieronder volledig — er is geen externe doc nodig.

- [x] **Stap 1: schrijf `src/services/mpp/cfb.ts`.** API:

```ts
export interface CfbEntry {
  name: string;                      // UTF-16LE-naam; kan \x01/\x05-prefixtekens bevatten (\x01CompObj)
  type: 'storage' | 'stream';
  size: number;
  children: Map<string, CfbEntry>;   // alleen gevuld bij storages
}
export class CfbFile {
  constructor(bytes: Uint8Array);    // gooit Error('CFB: ...') bij ongeldige magic/structuur
  readonly root: CfbEntry;
  /** Stream-inhoud op pad door storages, bv. getStream(['   114', 'TBkndTask', 'FixedData']). */
  getStream(path: string[]): Uint8Array | null;
  /** Storage-entry op pad; null als afwezig. */
  getStorage(path: string[]): CfbEntry | null;
}
```

  Formaatfeiten (alles little-endian):
  - **Header (512 bytes):** magic `D0 CF 11 E0 A1 B1 1A E1` @0; major version u16 @26 (3 ⇒ 512-byte sectoren, 4 ⇒ 4096); sector shift u16 @30 (2^n = sectorgrootte); mini sector shift u16 @32 (altijd 6 ⇒ 64-byte minisectoren); aantal FAT-sectoren u32 @44; eerste directory-sector u32 @48; mini-stream-cutoff u32 @56 (altijd 4096); eerste mini-FAT-sector u32 @60; aantal mini-FAT-sectoren u32 @64; eerste DIFAT-sector u32 @68; aantal DIFAT-sectoren u32 @72; 109 DIFAT-entries (u32) @76.
  - **Sectornummering:** sector n begint op byteoffset `(n + 1) * sectorSize`. Speciale FAT-waarden: `0xFFFFFFFE` ENDOFCHAIN, `0xFFFFFFFF` vrij, `0xFFFFFFFD` FAT-sector, `0xFFFFFFFC` DIFAT-sector.
  - **FAT:** de DIFAT (109 header-entries + geketende DIFAT-sectoren; laatste u32 van elke DIFAT-sector = volgende DIFAT-sector) somt de FAT-sectoren op; de FAT is een u32-array die per sector de volgende sector in de keten geeft.
  - **Directory:** keten vanaf de eerste directory-sector; entries van 128 bytes: naam UTF-16LE @0 (64 bytes), naamlengte-in-bytes-incl-terminator u16 @64, type u8 @66 (0 ongebruikt, 1 storage, 2 stream, 5 root), rood-zwart-kleur u8 @67 (negeren), left/right/child sibling-ids u32 @68/72/76, startsector u32 @116, streamgrootte u64 @120 (u32 lezen volstaat hier). Kinderen van een storage vormen een binaire boom via het `child`-id en de left/right-ids — loop hem plat met een expliciete stack en verzamel álle entries (geen rood-zwart-logica nodig, `0xFFFFFFFF` = geen knoop).
  - **Mini-stream:** streams < 4096 bytes (behalve de root-stream zelf) staan in de mini-stream (de stream van de root-entry, gelezen via de gewone FAT), opgedeeld in 64-byte minisectoren geketend via de mini-FAT.

- [x] **Stap 2: check-scaffold.** Create `tests/planning/check-mpp-import.ts` naar het patroon van `tests/planning/check-mspdi-baseline-export.ts` (OK/XX-regels, `process.exit(0|1)`). Kop van het bestand documenteert expliciet: *corpus-gedreven, geen in-repo fixture (echte bedrijfsbestanden + licentie; er is geen licentie-schone .mpp te maken zonder MS Project); CI zonder corpus slaat netjes over.* Kern:

```ts
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CfbFile } from '@/services/mpp/cfb';

const CORPUS = process.env.OPS_MPP_CORPUS
  ?? '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
const FILES = [
  'Bijlage 13 Productieplanning.mpp',
  'Bijlage 20 productieplanning PKB.mpp',
  'bijlage 7 Productie planning.mpp',
];
if (!existsSync(CORPUS)) {
  console.log('OK  mpp-import: corpus niet aanwezig (OPS_MPP_CORPUS) — check overgeslagen');
  process.exit(0);
}
// Per corpusbestand: CFB parsen en de bekende structuur asserten.
for (const f of FILES) {
  const cfb = new CfbFile(new Uint8Array(readFileSync(join(CORPUS, f))));
  // asserts (OK/XX): root heeft '\x01CompObj'; storage '   114' bestaat; daarbinnen stream 'Props'
  // en substorages TBkndTask/TBkndRsc/TBkndAssn/TBkndCons/TBkndCal elk met FixedMeta/FixedData/
  // VarMeta/Var2Data; getStream(['   114','TBkndTask','FixedData']) levert > 0 bytes.
}
```

- [x] **Stap 3: registreer de check in `tests/planning/run.sh`,** binnen het `RUN_HOLIDAYS`-blok, naar het bestaande `bundle_check`-patroon (bijv. direct na het `check-adapters-hours`-blok):

```bash
  # MPP-import (fase 3.8 e1): CFB/OLE2 + MPP14-lezer tegen het lokale corpus (echte bedrijfs-
  # bestanden, NIET in de repo). Zonder corpus (CI) slaat de check netjes over met een OK-regel.
  MPPCHECK="$DIR/.mpp-import.mjs"
  if bundle_check "$DIR/check-mpp-import.ts" "$MPPCHECK"; then node "$MPPCHECK" || STATUS=1; fi
```

  Let op: de bundel draait daarna ook 5× mee in de tijdzone-matrix — houd de check tijdzone-robuust (datums alleen als strings vergelijken) en herdraaibaar.
- [x] **Stap 4: gate.** `npx tsc --noEmit`; `bash tests/planning/run.sh` exit 0 (mét corpus lokaal: de nieuwe asserts groen; de OK/XX-regels tonen de drie bestanden).
- [x] **Stap 5: commit.** `feat(mpp): eigen CFB/OLE2-lezer + corpus-check-scaffold (T3)`

### Taak T4 — MPP-containerlaag: formaatdetectie, Props, wachtwoordvlag, low-level-primitieven

**Afhankelijk van:** T3. **Blokkeert:** T5.
**Files:** Create `src/services/mpp/errors.ts`, `src/services/mpp/mppContainer.ts`, `src/services/mpp/mppPrimitives.ts`; Modify `tests/planning/check-mpp-import.ts`.

Referentie (poort-bron, lees deze Java-bestanden vóór je begint): `/home/nozzit/open-aec/voor claude/testdata-crawl/mpxj/src/main/java/org/mpxj/mpp/` — `CompObj.java`, `MPPReader.java` (r. 445–455), `Props.java` + `Props14.java` + `PropsKey.java`, `FixedMeta.java`, `FixedData.java`, `AbstractVarMeta.java` + `VarMeta12.java`, `Var2Data.java`, `MPPUtility.java`. Elke nieuwe TS-file krijgt een attributieheader (zie T10, stap 3 — zet hem er meteen in).

- [x] **Stap 1: fouten.** Create `src/services/mpp/errors.ts`:

```ts
/** Herkenbaar afgewezen .mpp. `mppCode` wordt duck-typed gelezen door
 *  `importErrorMessageKey` in formatRegistry (bewust geen statische import daarheen:
 *  deze module leeft in de lazy mpp-chunk). Boodschappen in het Engels (dienstlaag-
 *  conventie), mét de handelingshint — die tekst ziet de AI-/console-kant. */
export class MppUnsupportedError extends Error {
  readonly mppCode: 'MPP_LEGACY' | 'MPP_ENCRYPTED';
  constructor(code: 'MPP_LEGACY' | 'MPP_ENCRYPTED', detail: string) {
    super(`${detail} Open the file in MS Project and export it as XML (File > Save As > XML), then open that file.`);
    this.name = 'MppUnsupportedError';
    this.mppCode = code;
  }
}
```

- [x] **Stap 2: containerlaag.** Create `src/services/mpp/mppContainer.ts`:
  - `detectMppVariant(cfb: CfbFile): 'MPP8'|'MPP9'|'MPP12'|'MPP14'` — parse de `\x01CompObj`-stream (CompObj.java: de format-string zit achterin de stream) en map `"MSProject.MPP14"` → `'MPP14'` etc. (MPPReader.java r. 445–455). Onbekende format-string of geen CompObj ⇒ gooi een gewone `Error('Not a recognised MS Project MPP file')`.
  - `class Props` — port van Props.java/Props14.java: parse de `Props`-stream uit storage `"   114"` naar een `Map<number, Uint8Array>` met `getByte/getShort/getInt/getByteArray(key)`-accessors.
  - `assertReadable(cfb)`: MPP8/9/12 ⇒ `throw new MppUnsupportedError('MPP_LEGACY', 'This .mpp uses the older Project 98/2000–2007 file format.')`; `props.getByte(893386752 /* PASSWORD_FLAG */) !== 0` ⇒ `throw new MppUnsupportedError('MPP_ENCRYPTED', 'This .mpp is password-protected.')` (MPP14Reader.java r. 154; PropsKey.java r. 59/73). XOR-decodering (DocumentInputStreamFactory.java) bewust NIET porten.
- [x] **Stap 3: primitieven.** Create `src/services/mpp/mppPrimitives.ts` — ports van:
  - `FixedMeta` (FixedMeta.java — let op de twee constructor-varianten: vaste itemSize én de afgeleide variant die MPP14Reader r. 995 gebruikt), `FixedData` (FixedData.java, incl. de maxFixedDataSize-variant van r. 994), `VarMeta` (AbstractVarMeta.java + VarMeta12.java — **MPP14 gebruikt VarMeta12**, zie MPP14Reader r. 991), `Var2Data` (Var2Data.java: per uniqueID+type een offset in de datastream).
  - MPPUtility-equivalenten (MPPUtility.java): `getShort/getInt` (LE), `getUnicodeString` (UTF-16LE, null-terminated), `getTimestamp`/`getDate`/`getTime` (MS-Project-epoch en minuten-encoding — neem de constanten letterlijk uit de Java over), `getDuration` + `getDurationTimeUnits` (durations in tienden van minuten + unit-codes), `getGUID`.
- [x] **Stap 4: check uitbreiden.** In `tests/planning/check-mpp-import.ts`: per corpusbestand assert `detectMppVariant === 'MPP14'`, `assertReadable` gooit niet, en de TBkndTask-primitieven leveren > 0 items (`FixedData.getItemCount()`); plus een negatieve casus: een raar-maar-geldig CFB'tje in-memory zonder CompObj gooit de nette `Error`.
- [x] **Stap 5: gate.** `npx tsc --noEmit`; `bash tests/planning/run.sh` exit 0.
- [x] **Stap 6: commit.** `feat(mpp): containerlaag — MPP14-detectie, Props, wachtwoordvlag, FixedMeta/FixedData/VarMeta/Var2Data (T4)`

### Taak T5 — FieldMap14 + taken, hiërarchie, constraints/deadline, actuals/progress, projectprops

**Afhankelijk van:** T4. **Blokkeert:** T6.
**Files:** Create `src/services/mpp/fieldMap14.ts`, `src/services/mpp/mppReader.ts`; Modify `tests/planning/check-mpp-import.ts`.

Referentie: `FieldMap.java` (met name `createTaskFieldMap(props)` — de field map wordt **uit de Props-data gelezen**, data-gedreven) + `FieldMap14.java` (de MPP14-specifieke veld-id→veld-mapping en varData-typen) + `MPP14Reader.java` `processTaskData` (r. 982–…). Port **alleen** de velden die `ImportResult` nodig heeft; de veldsemantiek van de doelvelden staat in `src/services/msproject/mspdiReader.ts` (`readMSPDI`, vanaf r. 113) — lees die eerst en spiegel de mapping veld-voor-veld, zodat MPP- en MSPDI-import identiek gedrag hebben.

- [x] **Stap 1: fieldMap14.** Create `src/services/mpp/fieldMap14.ts`: port `createTaskFieldMap`/`createResourceFieldMap`/`createAssignmentFieldMap` (FieldMap.java + FieldMap14-overrides) met een klein TS-enum voor uitsluitend de benodigde veld-ids: taak = uniqueID, id, naam, outline level, WBS, start, finish, duration (+ units), milestone-vlag, summary-vlag, constraint type + constraint date, deadline, percent complete, actual start, actual finish, task calendar; resource = uniqueID, naam, type, max units; assignment = uniqueID, task uniqueID, resource uniqueID, units. Neem de veld-id-constanten letterlijk uit FieldMap14.java over.
- [x] **Stap 2: entry + taken.** Create `src/services/mpp/mppReader.ts` met:

```ts
import type { ImportLabels, ImportResult } from '@/services/importTypes';
export function readMPP(bytes: Uint8Array, labels?: ImportLabels): ImportResult { ... }
```

  Flow: `new CfbFile(bytes)` → `detectMppVariant` + `assertReadable` → Props → field maps → taken uit `"   114"/TBkndTask` (FixedData + Var2Data, precies de leesvolgorde van `processTaskData`). Belangrijk voor count-pariteit: **null-/verwijderde taken overslaan** zoals MPP14Reader dat doet (uniqueID-validatie tegen VarMeta + de null-task-checks). Hiërarchie: ken `parentId`/`summary` toe op basis van outline level (stack-lopen over de taakvolgorde); zet `task.wbs` uit het WBS-veld. Datums dag-modus via de bestaande helpers (`isoDatePrefixOrToday`-equivalent op de geformatteerde timestamp), duur in dagen via hoursPerDay uit de projectprops — zelfde afronding als `parseMSPDuration` in mspdiReader. Constraints: MSP-constrainttype-codes → `TaskConstraint` exact zoals mspdiReader dat doet; deadline idem. Actuals + percent complete → daarna `normalizeImportedProgress(tasks, statusDate)` uit `@/services/importNormalize`. Projectprops (naam, startdatum, statusdatum, hoursPerDay) uit de Props-stream (`processProjectProperties`, MPP14Reader r. 295). Kalenders/relaties/resources/assignments blijven in deze taak lege arrays (T6/T7); retourneer een geldig `ImportResult` met een defaultkalender (`createDefaultCalendar`) als placeholder, zoals `readCSV` dat ook doet.
- [x] **Stap 3: check uitbreiden.** Per corpuspaar ook de `.mpp.xml` met `readMSPDI` (via `installDOMParser` uit `tests/planning/xmldom-shim`) parsen en assert: gelijk aantal taken (51/134/215), en per taak (gematcht op volgorde) gelijke naam, start- en finishdatum (eerste 10 tekens), duur in dagen, milestone-vlag, outline-diepte, constrainttype+datum, deadline en completion.
- [x] **Stap 4: gate.** `npx tsc --noEmit`; `bash tests/planning/run.sh` exit 0 (taakvergelijking groen op alle drie corpusbestanden).
- [x] **Stap 5: commit.** `feat(mpp): FieldMap14 + taken/hiërarchie/constraints/actuals uit TBkndTask (T5)`

### Taak T6 — Kalenders (MPP14CalendarFactory-equivalent)

**Afhankelijk van:** T5. **Blokkeert:** T7.
**Files:** Create `src/services/mpp/mppCalendars.ts`; Modify `src/services/mpp/mppReader.ts`, `tests/planning/check-mpp-import.ts`.

Referentie: `MPP14CalendarFactory.java` + `AbstractCalendarAndExceptionFactory.java` + `MPP14Reader.java` `processCalendarData` (r. 966). Doelsemantiek: identiek aan de kalendersectie van `readMSPDI` — basiskalenders + uitzonderingen → `WorkCalendar` (`workDays` ISO 1–7, `holidays` als gematerialiseerde ranges, uurbanden via `canonicalizeBands` + `registerCalendarBands` uit `@/services/subdayIo`, promotie via `promoteHourCalendar` waar mspdiReader dat ook doet).

- [x] **Stap 1:** port de kalenderfabriek: `"   114"/TBkndCal` (FixedMeta/FixedData/VarMeta/Var2Data), basiskalenders + afgeleide resource-kalenders (base-verwijzing volgen), weekdag-uren → `workDays` + banden, uitzonderingen → `holidays`. Projectkalender: koppel `project.calendarId` aan de kalender uit de projectprops; resource-kalenders → `ImportResult.resourceCalendars`.
- [x] **Stap 2:** check uitbreiden: kalender-aantallen per corpusbestand (13/11/9, tel hoofd- + resourceCalendars zoals de MSPDI-kant ze telt), en van de projectkalender: gelijke `workDays` en gelijke holiday-datumverzameling als de MSPDI-ground-truth.
- [x] **Stap 3: gate.** `npx tsc --noEmit`; `bash tests/planning/run.sh` exit 0.
- [x] **Stap 4: commit.** `feat(mpp): kalenders uit TBkndCal — werkdagen, uurbanden, uitzonderingen (T6)`

### Taak T7 — Relaties (TBkndCons), resources en assignments

**Afhankelijk van:** T6. **Blokkeert:** T8, T9.
**Files:** Modify `src/services/mpp/mppReader.ts` (evt. hulpsecties in aparte functies binnen dezelfde file), `tests/planning/check-mpp-import.ts`.

Referentie: `ConstraintFactory.java` (LET OP naamverwarring: "constraints" heet in het MPP-bestandsjargon de **relatie-/link-data** in `TBkndCons` — taak-datumconstraints kwamen al uit het taak-fieldmap in T5), `MPP14Reader.java` `processConstraintData` (r. 1541), `processResourceData` (r. 1550), `processAssignmentData` (r. 1714).

- [x] **Stap 1: relaties.** Port de TBkndCons-rijen → `Sequence[]`: voorganger-/opvolger-uniqueID, type (FF/FS/SF/SS-codes zoals mspdiReader's `mspTypeToSequenceType`), lag (tienden van minuten + unit-code) → `lagDays`/`lagMinutes`/`lagUnit` met exact de mspdiReader-lag-semantiek.
- [x] **Stap 2: resources + assignments.** Resources uit TBkndRsc via het resource-fieldmap (naam, type Work/Material/Cost → `ResourceType` zoals mspdiReader, maxUnits/100 → `maxUnits`); assignments uit TBkndAssn (task-uniqueID, resource-uniqueID, units) → `ResourceAssignment` met dezelfde `unitsPerDay`-afleiding als de assignmentsectie van mspdiReader (lees die sectie en spiegel hem).
- [x] **Stap 3: check uitbreiden.** Per corpuspaar: link-aantallen (104/111/225) + per link (gematcht op voorganger+opvolger-naam) gelijk type en lag; resource-aantallen (9/7/5) + namen; assignment-aantallen (51/146/221) + per assignment gelijke taak/resource-koppeling en units.
- [x] **Stap 4: gate.** `npx tsc --noEmit`; `bash tests/planning/run.sh` exit 0.
- [x] **Stap 5: commit.** `feat(mpp): relaties (TBkndCons), resources en assignments → compleet ImportResult (T7)`

---

## Integratie en afronding (serieel, na SYNC van baan A + B)

### Taak T8 — Registratie, lazy chunk, i18n, foutmeldingen

**Afhankelijk van:** T2 + T7.
**Files:** Modify `src/services/formatRegistry.ts`, `src/state/slices/fileSlice.ts`, `src/services/mcp/tools/fileTools.ts`, `vite.config.ts`, `src/i18n/locales/*/common.json` (alle 14).

- [x] **Stap 1: registry-entry.** In `READ_FORMATS` (ná `xml`):

```ts
  { id: 'mpp', extensions: ['mpp'], kind: 'binary', filterName: 'MS Project Files',
    read: async (i, labels) => {
      if (!i.bytes) throw new Error('MPP requires binary content');
      // Dynamic import: de parser (CFB + fieldmaps) blijft buiten de main chunk.
      const { readMPP } = await import('@/services/mpp/mppReader');
      return readMPP(i.bytes, labels);
    } },
```

  Daarmee lopen openFile ('All Supported' + eigen filter), openRecentFile, parseExternalSource, MCP `planner_import_schedule` en devBridge automatisch mee (T1+T2).
- [x] **Stap 2: chunk-regel.** In `vite.config.ts` `manualChunks` (naast de locales-regel r. 92): `if (id.includes('/src/services/mpp/')) return 'mpp-reader';`. Controleer dat NIETS uit `src/services/mpp/` statisch geïmporteerd wordt vanuit de main-graf (grep `from '@/services/mpp` — alleen de dynamic import in de registry en de testbestanden mogen matchen), anders laadt de chunk alsnog eager.
- [x] **Stap 3: foutmeldingen.** In `fileSlice.openFile` en `openRecentFile` catch-blokken (r. 233 en r. 506): `messageKey: importErrorMessageKey(err)` i.p.v. de vaste `'notifications.openFailed'` (de `detail` blijft `err.message`). MCP/devBridge hoeven niets: daar is de Engelse `MppUnsupportedError`-boodschap (met de export-als-XML-hint) precies goed.
- [x] **Stap 4: i18n.** Breid éérst de literal-union `NotificationMessageKey` in `src/state/slices/types.ts` (r. 160-171) uit met `'notifications.mppLegacy' | 'notifications.mppEncrypted'` — zonder dat faalt de typecheck op de notify-callsites (bevinding kwaliteitsreview T1). Voeg daarna in `src/i18n/locales/<taal>/common.json` onder `notifications` twee sleutels toe, in **alle 14** talen (`nl, en, fr, de, es, zh, it, pt, pl, tr, ar, ja, ko, fa` — `verify:i18n` eist compleetheid t.o.v. nl). nl:
  - `"mppLegacy": "Dit .mpp-bestand gebruikt een oud formaat (Project 2007 of ouder). Exporteer het in MS Project als XML (Bestand → Opslaan als → XML) en open dat bestand."`
  - `"mppEncrypted": "Dit .mpp-bestand is met een wachtwoord beveiligd. Exporteer het in MS Project als XML (Bestand → Opslaan als → XML) en open dat bestand."`
  en: `"mppLegacy": "This .mpp file uses an older format (Project 2007 or earlier). In MS Project, export it as XML (File → Save As → XML) and open that file."` / `"mppEncrypted": "This .mpp file is password-protected. In MS Project, export it as XML (File → Save As → XML) and open that file."` — overige 12: vertaal in dezelfde register/toon als de omliggende sleutels.
- [x] **Stap 5a: geen opslagdoel voor binaire formaten (bevinding kwaliteitsreview T2).** In `fileSlice.openFile` en `openRecentFile`: zet bij `readFormatForFile(...).kind === 'binary'` GEEN `filePath`/`fileHandle` als opslagdoel (opslaan = opslaan-als), anders schrijft Ctrl+S na een .mpp-open IFC-tekst over het binaire bronbestand. De MCP-kant heeft deze guard al (`!isBinary` op het opslagdoel, commit T2-review). Asserteer in `tests/mcp` via de nieuwe `readFileCalls`-log dat een binair formaat via het bytes-pad loopt.
- [x] **Stap 5: MCP-notice.** In de `planner_import_schedule`-handler: `formatOf` laten herkennen (`ext === 'mpp'` → `'MPP14'`) en bij dat formaat een notice toevoegen: `'MPP-import is alleen-lezen (best effort; baselines en custom fields komen niet mee). Opslaan schrijft IFC; export naar MS Project = MSPDI-XML.'` — plus de bestaande geen-opslagdoel-notice geldt automatisch (formaat ≠ IFC).
- [x] **Stap 6: gate.** `npx tsc --noEmit`; `npm test`; `npm run verify:i18n`; `npm run build` gevolgd door twee controles: `ls dist/assets | grep mpp-reader` levert precies één chunk, en `grep -l 'TBkndTask' dist/assets/index-*.js` levert NIETS (de parser zit niet in de main chunk).
- [x] **Stap 7: handmatige rooktest (Tier 1).** `npm run dev` (poort uit de dev-server-uitvoer lezen); open in de browser via de Openen-dialoog een corpus-`.mpp` — taken/Gantt zichtbaar, daarna via recents heropenen. Web-fallbackpad (input-element) is hiermee ook geraakt als je een niet-Chromium-profiel gebruikt; minimaal het FSA-pad aantonen.
- [x] **Stap 8: commit.** `feat(mpp): .mpp via het open-pad — registry-registratie, lazy chunk, i18n-foutmeldingen (T8)`

### Taak T9 — Contract-/regressietest: MPP-lezer vs MSPDI-ground-truth + crawl-smoke

> **Bijgewerkt tijdens uitvoering (2026-08-15):** Stap 1 hieronder ("Eén `comparePair(mppPath,
> xmlPath)`-functie die per corpuspaar ALLE domeinen dekt") is BEWUST NIET zo gebouwd — T5/T6/T7
> hadden de vergelijkingen tegen die tijd al gebouwd, opgesplitst per domein in drie bestanden
> (`check-mpp-import.ts` = taken/hiërarchie, `check-mpp-calendars.ts` = kalenders,
> `check-mpp-relations.ts` = relaties/resources/assignments). Die splitsing is een bewuste,
> gereviewde keuze (elk bestand blijft behapbaar, domeinen kunnen onafhankelijk groeien) en is NIET
> teruggedraaid. T9 was daarmee een afrondings-pass: de end-to-end-crawl-smoke over de VOLLEDIGE
> `readMPP()` (stap 2, hieronder verbreed met een taakaantal-baseline + spooktaak-plausibiliteits-
> assert), de negatieve paden (stap 3) en een dekkingskaart per checkbestand — zie de
> moduleheaders van de drie/vijf mpp-checkbestanden.
>
> Stap 2's oorspronkelijke eis ("elk bestand moet … tot een `ImportResult` met ≥ 1 taak") bleek bij
> uitvoering te strak: 4 van de 49 crawl-bestanden (`OzBuild Workshop 02/03.mpp`, in zowel
> `MSP2016_OzBuild` als `MSP2021_OzBuild`) zijn legitiem taakloze oefensjablonen (0 taken, 0
> relaties, 0 assignments — geverifieerd tot op de FixedMeta-recordlaag, geen leesfout). De
> gebouwde check vervangt de per-bestand-hard-eis daarom door: (a) géén exception over alle 49
> bestanden, (b) een gepind totaal-taakaantal over het corpus (`>=`, gemeten 788), en (c) een apart
> gepind aantal taakloze bestanden (`<=`, gemeten 4) — zodat een ECHTE regressie (meer taakloze
> bestanden, of een dalend totaal) nog steeds faalt, zonder de bekende lege sjablonen te bestraffen.

**Afhankelijk van:** T8.
**Files:** Modify `tests/planning/check-mpp-import.ts`.

De vergelijkingen uit T5–T7 bestaan al; deze taak maakt de check af en hardt hem.

- [x] **Stap 1: volledige paar-vergelijking consolideren.** Eén `comparePair(mppPath, xmlPath)`-functie die per corpuspaar alle domeinen dekt (taken, hiërarchie, constraints/deadline, progress/actuals, relaties+lag, resources, assignments, kalenders, projectnaam + projectstart) met per afwijking één `XX`-regel (`bestand :: domein :: veld: verwacht X, kreeg Y`). Datumvergelijking altijd op de eerste 10 tekens (dag-granulair, tijdzone-robuust — de bundel draait ook onder de TZ-matrix).
- [x] **Stap 2: crawl-smoke.** Tweede corpusblok: `OPS_MPP_CRAWL` (default `/home/nozzit/open-aec/voor claude/testdata-crawl/crawl-mpp`), recursief alle `*.mpp` globben (verwacht 49); elk bestand moet zonder exception parsen tot een `ImportResult` met ≥ 1 taak; ook hier nette OK-skip als het pad ontbreekt. Geen ground-truth-vergelijking (geen MSPDI-paren) — dit is een geen-crash/plausibiliteits-poort.
- [x] **Stap 3: negatieve paden.** In-memory: (a) niet-CFB-bytes → nette `Error`, (b) een corpusbestand waarvan je byte 0 van de PASSWORD_FLAG-Props-waarde in-memory op 1 patcht → `MppUnsupportedError` met `mppCode === 'MPP_ENCRYPTED'` (patch via de Props-parser-offsets; als dat te fragiel blijkt: bouw een minimale synthetische Props-stream met alleen die key en test `assertReadable` los).
- [x] **Stap 4: gate.** `bash tests/planning/run.sh` exit 0 mét corpus; daarna éénmalig `OPS_MPP_CORPUS=/nonexistent bash tests/planning/run.sh` — nog steeds exit 0 met de skip-OK-regels (het CI-pad).
- [x] **Stap 5: commit.** `test(mpp): corpus-contracttest MPP↔MSPDI + crawl-smoke + negatieve paden (T9)`

### Taak T10 — Documentatie, TODO-besluitupdate, attributie

**Afhankelijk van:** T8 (functie bestaat).
**Files:** Create `public/docs/nl/gids-msproject-import.md`, `public/docs/en/gids-msproject-import.md`; Modify `public/docs/manifest.json`, `docs/TODO.md`, `src/services/mpp/mppReader.ts` (headercheck).

- [x] **Stap 0 (bevinding T6-review): benoem in het artikel expliciet dat recurrente kalenderuitzonderingen** (jaarlijks terugkerende feestdagen zoals Kerst/Nieuwjaar mét herhaalregel — in het crawl-corpus 276 van de 484 records) **niet worden geïmporteerd**; alleen concrete/afgevlakte uitzonderingsdatums komen mee. mspdiReader kan dit ook niet, dus het is consistent — maar het is gebruikerzichtbaar verlies en hoort in de beperkingenlijst.
- [x] **Stap 1: docs-artikel** (gebruikerszichtbare functie ⇒ verplicht, CLAUDE.md). Binnen de miniMarkdown-subset (koppen/paragrafen/enkelvoudige lijsten/vet/cursief/code; géén tabellen). Inhoud nl (en = vertaling): wat werkt (Project 2010–2021 `.mpp` openen via Bestand → Openen, recents, wat er meekomt: taken/hiërarchie/relaties/kalenders/resources/toewijzingen/voortgang), wat niet (alleen-lezen; geen baselines/custom fields; oude formaten en wachtwoordbestanden → exporteer als XML uit MS Project), dat opslaan altijd IFC schrijft en export naar MS Project via MSPDI-XML loopt, en een korte "Herkomst"-alinea: *de MPP-lezer is afgeleid van MPXJ (Jon Iles e.a., LGPL) — net als Open Planner Studio zelf open source onder LGPL.* Manifest-entry in `public/docs/manifest.json`: id `gids-msproject-import`, `layer: "gidsen"`, titelobject in alle 14 talen (patroon van de bestaande entries; nl "MS Project (.mpp) openen", en "Opening MS Project (.mpp)").
- [x] **Stap 2: TODO.md.** Vervang in `docs/TODO.md` §3.8 het MPP-blok (r. 654–664, het punt "MS Project MPP import (readonly) — realistisch alleen via MPXJ (JVM) …" t/m de managed-tools-alinea) door:

```markdown
- [x] **MS Project MPP import (alleen-lezen)** — sinds fase 3.8 etappe 1 native in TS (MPP14 =
  Project 2010 t/m 2021; `src/services/mpp/`, afgeleid van de MPXJ-bronnen, LGPL). **Besluit
  herzien 2026-08-14:** de triage van 2026-07-07 ("realistisch alleen via MPXJ/JVM") rustte op de
  premisse dat een native lezer onhaalbaar was; corpusonderzoek (2026-08-14, 52 bestanden uit
  Project 2010–2021) toonde één stabiel, onversleuteld MPP14-containerformaat — native in de kern
  is dus de lichtste route en de JVM-sidecar vervalt voor dit doel. Wachtwoord-versleutelde
  bestanden en MPP8/9/12 geven een nette "exporteer als XML"-fout. Er bestaat geen .mpp-EXPORT
  (ook MPXJ schrijft het niet): de export-tegenhanger blijft MSPDI-XML.
- [ ] MPP9/12-legacy en Asta Powerproject PP — de eerder uitgewerkte "managed tools"-route
  (user-besluit 2026-07-07: catalogus-extensie declareert een MPXJ-CLI-hulpprogramma met checksum;
  de APP-KERN beheert download/levenscyclus; sandbox ongewijzigd; web = "alleen desktop") blijft
  hiervoor de optie als er vraag naar blijkt.
```

- [x] **Stap 3: attributie.** Controleer dat elke file in `src/services/mpp/` de attributieheader draagt (T4/T5 hoorden hem al te zetten), model:

```ts
/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 */
```

- [x] **Stap 4: gate.** `npm run verify:docs` groen; `npm run verify:i18n` groen; lees het artikel na in de app (Backstage → Help).
- [x] **Stap 5: commit.** `docs(mpp): gids nl+en + manifest, TODO §3.8-besluit herzien, MPXJ-attributie (T10)`

### Taak T11 — Eindreview + volledige verify

**Afhankelijk van:** T9 + T10.
**Files:** geen nieuwe (alleen fixes die uit de review rollen).

- [x] **Stap 0-bis (T7-kwaliteitsreview): `mppReader.ts` (1100+ regels, 4 verantwoordelijkheden) splitsen** — `readResources*`/`readAssignments*` hebben nul afhankelijkheid van de rest (schone verhuizing naar `mppResources.ts`/`mppAssignments.ts` of één `mppEntities.ts`); `readRelations*` hangt alleen aan de gedeelde duurhelper. Gemeten advies van de reviewer: nu goedkoopst, T8-T10 raken dit bestand nauwelijks.
  **Gedaan:** één `src/services/mpp/mppEntities.ts` (readRelations/readResources/readAssignments +
  hun uitsluitende helpers, incl. `mppLagToSequenceFields`) — gemotiveerd boven drie losse
  bestanden: ze deelden al één T7-banner, dezelfde altijd-vangende-wrapper-conventie en blijven
  elkaars buren in `readMPP`'s orkestratie. `mppReader.ts` houdt orkestratie + taken (readTasks,
  hiërarchie/WBS, openMppProject, readMPP). Pure verhuizing, baselines exact gelijk. Tests
  bijgewerkt: `check-mpp-relations.ts` importeert nu rechtstreeks uit `mppEntities.ts`.
- [x] **Stap 0: onderhoudsagenda uit de T2-kwaliteitsreview (optioneel maar geagendeerd).** (a) drievoudige "isBinary ? readFile : readTextFile"-duplicatie (fileSlice/devBridge/fileTools) samentrekken tot een `readFormatInput(name, io)`-helper in formatRegistry; (b) de gedupliceerde permissie-dans in webBackend (`readFromRefWeb`/`readBytesFromRefWeb`) naar één `readRefWeb<T>`-strategie; (c) 4× extensie-extractie naar één `extensionOf` in `@/utils/filePath`; (d) `parseProjectXml`-export heroverwegen (geen externe afnemer) en de `!` op de DEFAULT_FORMAT_ID-lookup vervangen door een benoemde const-entry.
  **Gedaan:** (a)/(b)/(c) geïmplementeerd zoals beschreven. (d) bleek al vervallen: T8 had
  `parseProjectXml` al niet-geëxporteerd gemaakt en de `!`-lookup al vervangen door de benoemde
  `IFC_FORMAT`-const (zie formatRegistry.ts's T1-restpunt-commentaar) — niets meer te doen.
- [x] **Stap 0-ter: onderhoudsagenda uit de T8-kwaliteitsreview.** (a) `buildVarMetaBytes` (VarMeta12-blob) staat nu **4×** los: `check-mpp-import.ts`, `check-mpp-relations.ts`, `check-mpp-calendars.ts` en — sinds fb6ea03c — als `mppBuildTaskVarMetaBytes` in `tests/mcp/cases-doc-file.ts`. Verhuizen naar `tests/planning/mppFixtures.ts` en overal importeren; die vierde kopie importeert dáár al `buildNestedCfb`/`encodePropsEntries` uit, dus het "cross-suite import kan niet"-argument in de comment daar gaat niet op. (b) opslagdoel-regel als eigenschap op `ReadFormat` (`canBeSaveTarget`, alleen `true` op de IFC-entry) i.p.v. de magische `id === 'ifc'`-vergelijking in `fileSlice` en de aparte `formatOf`-classificatie in `fileTools`; `formatOf` houdt dan puur zijn AI-facing label. (c) `buildImportLabels(t)`-helper voor de 10 callsites die `{ importedProject, unassignedResource }` met de hand opbouwen. (d) een echte poort op de lazy mpp-chunk (nu alleen handmatige build+grep).
  **Gedaan:** (a) `buildVarMetaBytes` nu geëxporteerd uit `mppFixtures.ts`, alle vier
  aanroepplekken importeren 'm. (b) `canBeSaveTarget` op `ReadFormat` + gedeelde `saveTargetFor`-
  helper; `check-mpp-open-guard.ts` asserteert dat exact één formaat de vlag draagt. (c)
  `src/i18n/importLabels.ts`'s `buildImportLabels(t)`, 14 callsites (10 met beide velden + 4 met
  alleen `importedProject`, allemaal omgezet — `unassignedResource` is toch optioneel). (d)
  `tests/planning/check-mpp-chunk-boundary.ts`: lexicale node:fs-scan, geen build nodig,
  geregistreerd in run.sh.
- [x] **Stap 1: zelf-review-checklist.**
  - `grep -rn "readIFC(\|readCSV(\|readMSPDI(\|readP6XML(" src/ | grep -v "formatRegistry\|Reader.ts\|Writer.ts"` — geen dispatch-restanten buiten de registry (losse legitieme gebruikers zoals `openExampleFromString`/IFCPanel benoemen en laten staan).
  - `grep -rn "from '@/services/mpp" src/` — uitsluitend de dynamic import in `formatRegistry.ts`.
  - `npm run build` + chunk-controles van T8 stap 6 herhalen.
  - Alle taakvinkjes in dit plan afgevinkt; corpusbestanden NIET in `git status`.
  **Uitgevoerd:** beide greps schoon (readIFC-treffers zijn de bekende legitieme call-sites:
  useRecoveryRestore/benchmark-runner/libraryIfc/IFCPanel/devBridge-roundTrip/openExampleFromString
  — geen dispatch-restanten; de `from '@/services/mpp`-grep geeft 0 treffers omdat de enige
  toegestane import een `await import(...)` is, wat geen `from '` bevat — precies wat
  `check-mpp-chunk-boundary.ts` nu automatisch bewaakt). `npm run build` groen; `ls dist/assets |
  grep mpp-reader` → precies 1 chunk; `grep -l 'TBkndTask' dist/assets/index-*.js` → niets.
  `git status` schoon, geen corpusbestanden. Als addendum: de `findSafeCorpusFile`-filter + het
  `TODO(T11)` in `check-mpp-open-guard.ts` zijn verwijderd (de CPM-fix — 04909f36/130e7750 — is
  geland en gereviewd) — Part B daar loopt nu over ALLE drie corpusbestanden (incl. 'Bijlage 13
  Productieplanning.mpp', die de samenvattingstaak-relatie draagt die vóór de fix crashte); 32/32
  groen (was 18).
- [x] **Stap 2: DE poort.** `npm run verify` — exitcode 0 is het oordeel (typecheck + lint + alle vier testsuites + examples/docs/i18n/cycles/audit), nooit de tail-uitvoer.
  **Uitgevoerd:** exit 0. Alle baselines exact gelijk: mpp-import 2733 hard/1735 soft,
  mpp-calendars 66, mpp-relations 111/880/36/330, mpp-summary-relations 14, mpp-open-guard 32
  (was 18, +14 uit de corpus-verbreding), mpp-chunk-boundary 2 (nieuw), planning 444/444, MCP
  33/0, library/dev-server/examples/docs(28×14)/i18n(13 locales)/cycles(387 modules)/audit(0
  vulns) allemaal groen. Extra: `OPS_MPP_CORPUS=/nonexistent bash tests/planning/run.sh` —
  exit 0, alle vier mpp-checks vallen netjes terug op de skip-OK-regel (CI-pad).
- [x] **Stap 3: commit** van eventuele review-fixes: `chore(mpp): eindreview fase 3.8 etappe 1 — verify groen`.
