# Code-inventaris import/export-laag — Open Planner Studio

> **Herkomst (2026-08-15):** geoogst uit de parallelle branch `file-format-implementation`
> (verwijderd na oogst, eigenaarsbesluit — de code van die branch is bewust NIET overgenomen).
> Let op: de MPP-conclusies hierin (npm-`cfb`-spoor) zijn ingehaald door de inmiddels gebouwde
> native MPP14-lezer in `src/services/mpp/`; de XER/PMXML/PP-delen zijn actuele input voor
> etappe 2. Verifieer beweringen tegen de huidige code.


Read-only verkenning van worktree `.claude/worktrees/file-format-implementation` (main, 2026-08-14).
Fundament voor: XER, PMXML-verbetering, MPP, Asta PP, .ics. Alle paden relatief aan de worktree-root.

---

## 1. Import-flow via de UI

### 1.1 Het reguliere open-pad (`fileSlice`)

`src/state/slices/fileSlice.ts`:

- **`openFile`** (r189-235): roept `openFileDialog` aan met vier filters (r191-196):
  `All Supported: ['ifc','csv','xml']`, plus losse IFC/CSV/XML-filters. **Formaatkeuze is
  extensie-gedreven** (r198-207): `csv` → `readCSV`, `xml` → `parseProjectXml`, **alles anders → `readIFC`**
  (dus een `.xer` valt nu in het IFC-pad en faalt daar of levert een leeg "Imported Project").
- **`parseProjectXml`** (r41-48) is de enige inhouds-sniffer, alleen voor `.xml`:
  ```ts
  const isP6 = content.includes('APIBusinessObjects') || content.includes('Primavera');
  const isMsProject = content.includes('schemas.microsoft.com/project') || content.includes('<Project');
  ```
  P6 wint vóór MS Project; onbekend XML gooit `'Onbekend XML-formaat: …'`. Let op: `content.includes('<Project')`
  is erg ruim — willekeurige XML met een `<Project>`-element wordt als MSPDI geprobeerd.
- Fouten landen in een toast via `notify({ messageKey: 'notifications.openFailed', detail })` (r231-234).
- Na de parse: pristine-check `isActivePristine` (r28-36) → anders `newDocument()`, dan **`applyLoadedProject`**
  (r146-187) — dé gedeelde load-implementatie: bouwt payload via `payloadFromImport`, hydrateert via
  `hydratePayload` (documentcontract), en draait afhankelijk van opts `runCPM`/`requestFitToProject`/
  uur-data-melding, plus `emitExtensionEvent(HOST_EVENTS.projectLoaded, …)`.
- Open-pad-semantiek (`linkedOpen: true`, r222): behoudt bedrijfsbinding + `libraryOrigin`-stempels en draait
  daarna `runOpenBoundary()`. Een **niet-open-pad-load** (loadState/extensie-import) stript companyId +
  stempels (r166-171).
- **`openRecentFile`** (r461-504): identiek patroon, extensie uit `entry.name`.
- **`parseExternalSource`** (r405-422, Tauri-only) hergebruikt dezelfde drie readers voor externe koppelingen —
  een nieuw formaat dat hier niet in meedoet is niet als externe bron bruikbaar.

`src/services/fileAccess/index.ts`: `FileFilter { name, extensions }`, `FileRef` (`path` Tauri / `handle`
Chromium-web / `null` fallback), `openFileDialog`/`saveFileDialog`/`saveToRef`/`readFromRef` runtime-dispatch
op `isTauri()`. Web-fallback: `<input type=file>` + blob-download (`webBackend.ts` r61-80). **Alles is
string/tekst-gebaseerd** — `OpenedFile.content: string` en `file.text()`. Voor **binaire formaten (MPP, Asta PP)
is er geen bytes-pad**; dat is een structurele uitbreiding van `fileAccess`.

### 1.2 Het extensie-import-pad (moet NIET het model voor de nieuwe formaten zijn)

`src/components/backstage/Backstage.tsx` r491-546, `ImportSection`/`handleImport`:

- Toont kaarten voor `extensionImporters` uit `extensionSlice` (app-globaal, r22/53).
- `handleImport` maakt zelf een `<input type=file>` (géén `fileAccess`-dialoog, dus géén `FileRef`, géén
  recents, géén Tauri-native dialoog), roept `imp.handler(file)` (extensiecode) aan, mapt het EXT-resultaat
  via `fromExtImportResult` (`src/extensions/extMappers.ts` r488-497 — **alleen de 6 kernvelden**, geen
  resourceCalendars/baselines/structuur) en laadt via `loadState` (`projectSlice.ts` r427: in-place vervangen,
  LOS document, geen filePath, geen fit).
- Verschillen met het open-pad: geen formaat-sniffing, geen `applyLoadedProject`-open-semantiek, geen
  `runOpenBoundary`, verlies van optionele ImportResult-velden. De nieuwe formaten horen dus als **first-class
  readers naast readCSV/readMSPDI/readP6XML in `openFile`/`openRecentFile`/`parseByExtension` (MCP)**, niet als
  extensie-importer.

### 1.3 Export-UI

- `Backstage.tsx` r350-420 `ExportSection`: hardcoded lijst van 4 kaarten (`csv|mspdi|p6|ifc`) met
  i18n-keys `menu:export.csvLabel/…Desc` (bestaan in `src/i18n/locales/nl/menu.json` r289-295, 14 locales).
  IFC-kaart heeft optioneel "pool ernaast" (`exportProjectWithPool`).
- `ribbonWidgets.tsx` r370-399: zelfde formatenlijst als popover in het lint.
- Beide roepen `exportAs(format)` (fileSlice r315-372) aan; **K7-guard**: bij `scheduleStale` eerst `runCPM`,
  daarna expliciete check op `cpmResult.error` → `{ ok:false, error }` vóór de opslaan-dialoog. Deze guard is
  getest in `tests/planning/check-export-guard.ts`.

---

## 2. Bestaande adapters — wat levert/schrijft elk formaat

`ImportResult` (`src/services/importTypes.ts`): kern = project, calendar, tasks, sequences, resources,
assignments; optioneel = resourceCalendars, activityCodeTypes, customFieldDefs, baselines, activeBaselineId,
libraryPool. `ImportLabels` (r33-41): vertaalde teksten die de UI meegeeft omdat de dienstlaag geen `t(...)`
heeft (i18n/config raakt bij module-init `document.documentElement` en sloopt headless bundels).

### 2.1 IFC (`src/services/ifc/`) — natief, referentie

- `readIFC` levert **alle** ImportResult-velden incl. activityCodeTypes/customFieldDefs/baselines/libraryPool.
  Eigen STEP-parser, **géén DOMParser** — volledig headless-veilig.
- `writeIFC` neemt `WriteIFCInput` (= zelfde payloadvorm, opgebouwd via `buildWriteIFCInput` in
  `src/state/ifcSaveInput.ts`) — symmetrisch getypeerd.
- Lag: writer schrijft `lagMinutes` als `IFCDURATION('PT…')` (ifcWriter r843-848); reader zet bij een
  `T`-component **beide** velden: `lagDays` (afgerond, `PT4H`→1) én `lagMinutes` (ifcReader r763-805). Daardoor
  "ontsnapt IFC toevallig" aan de solverbug hieronder.
- Round-trip-contract permanent bewaakt door `tests/planning/check-ifc-roundtrip.ts` (maximale fixture,
  compile-afdwinging `satisfies Required<>` + key-gedreven canon, idempotentie-check, expliciete KNOWN_GAPS).
  Bekende bewuste gaps: `resource.availability` (deprecated), `durationMinutes` in dag-modus, projectkalender
  niet gedupliceerd in bibliotheek, div. normalisaties (ids, ASAP niet geschreven, completion 1 decimaal, …).
  Kalender-gaps die nog open staan (docs/TODO.md r195-207): pauze-banden/afwijkende uurbanden per weekdag
  overleven een dag-modus-round-trip niet (IFC draagt één werkweekpatroon).

### 2.2 MSPDI (`src/services/msproject/`)

Reader (`mspdiReader.ts`, 609 r) levert: project (incl. statusDate, `CriticalSlackLimit`→
`schedulingOptions.criticalDefinition`, r490-499), calendar + resourceCalendars (UID>1; **aanname: UID 1 =
projectkalender**, r140), tasks (WBS-hiërarchie herbouwd uit gepunte codes via `rebuildWbsHierarchy`, r378),
sequences (typen 0-3, lag zie §4), resources (Type 0=Material anders LABOR — **EQUIPMENT/CREW/SUBCONTRACTOR
gaan verloren**, r175-183), assignments (Units + WorkContour→curve), baselines (**alleen Baseline Number 0** →
één actieve baseline "Baseline (MSPDI)", r304-318/441-456), constraints (codes 1-7, 2/3=hard MSO/MFO, r93-104),
deadline, actuals + `normalizeImportedProgress`. Uur-modus per kalender via discriminator (sub-dag-duur of
niet-08:00-ankertijd, r210-230) → `durationMinutes`/instants.

Aannames: datums dag-modus = ISO-prefix strippen (`08:00:00`-anker); duur = `PT{H}H` ÷ hoursPerDay;
`MinutesPerDay` op projectniveau is authoritatief voor hoursPerDay (r601-606).

Writer (`mspdiWriter.ts`, 497 r): schrijft `<?xml … UTF-8?>` + `xmlns="http://schemas.microsoft.com/project"`
(r242-243). Verlies bij schrijven (console.warn): secundaire constraints weggelaten (r216-219), soft MSO→SNET /
soft MFO→FNET (`softLoss`, r68-…), kritiek-definitie anders dan totalFloat weggelaten (r285). Alleen de
actieve baseline → slot 0. Notes/hammock/externalLinks: niet native (TODO §3.8-verwijzing op r229).

### 2.3 P6 PMXML (`src/services/p6/`)

Reader (`p6xmlReader.ts`, 632 r) levert: project (PlannedStartDate/MustFinishByDate/DataDate→statusDate),
calendar + resourceCalendars (Type=Resource; **aanname: eerste `<Calendar>` = projectkalender**, r182-186),
WBS-elementen als summary-tasks + activities als leaf-tasks (echte parent-child, geen wbs-string-herbouw),
sequences (PR_FS enz.), resources (Nonlabor→EQUIPMENT — verlies, r27-33; hiërarchie via ParentObjectId;
ResourceRate → vroegste `PricePerUnit` als `costPerHour`, staffels verloren r250-272), assignments
(PlannedUnitsPerTime als fractie, PlannedCurve), constraints primair+secundair (CS_*-codes, r75-88),
milestoneKind START/FINISH (r406-410), actuals. **Geen baselines, geen activity-codes/UDF's** —
`ImportResult.baselines` blijft `undefined`.

Writer (`p6xmlWriter.ts`, 488 r): namespace `http://xmlns.oracle.com/Primavera/P6/V23.12/API/BusinessObjects`
(r208). ObjectId-tellers per soort. Verlies (console.warn): externe links (r182), hammock→gewone taak (r190),
schedulingOptions niet geëxporteerd (SCHEDOPTIONS UNVERIFIED, r197), notes (r204), procent-lag uitgebakken
naar dagen (r437), ELAPSEDTIME-lag als gewone uren (r440), LATE_PEAK→Early Peak (r478). **Baselines worden
niet geschreven** (geen enkele Baseline-referentie in de writer).

### 2.4 CSV (`src/services/csv/`)

Writer (100 r): 14 kolommen (WBS…Description), `;`-delimiter + BOM + CRLF; **negeert project, calendar,
resources, assignments volledig** (parameters met `_`-prefix). Schrijft `earlyStart || scheduleStart`
(berekende datums). Lag-notatie MS-Project-stijl: `+2d`, `+3ed`, `+50%`, `-25e%`.

Reader (314 r): delimiter-detectie (`;` vs `,` op de eerste regel), kolom-aliassen NL+EN (r142-171),
WBS-hiërarchie herbouwd, predecessor-string geparsed (regex r106), datums ISO of `DD-MM-YYYY`/`DD/MM/YYYY`.
Levert **default-kalender** (`createDefaultCalendar()`), lege resources/assignments. Verlies: alles behalve
taken+relaties. Projectnaam hard `'CSV Import'`.

---

## 3. Round-trip-gaten per formaat (writer vs eigen reader)

Eis van de user: **elk geëxporteerd bestand moet importeerbaar zijn.** Stand van zaken:

- **IFC**: symmetrisch en contract-getest (check-ifc-roundtrip + verify:examples fixpunt-digest). ✔
- **MSPDI**: uur-precisie + constraints round-trip-getest in `check-adapters-hours.ts`. Gaten:
  - Writer schrijft alleen actieve baseline (slot 0); reader leest alleen slot 0 — meerdere OPS-baselines
    verdampen tot één.
  - Resource-typen degraderen (alles behalve MATERIAL → LABOR bij herimport).
  - `priority` wordt geschreven en gelezen; maar OPS-specifieke velden (notes, hammock, externalLinks,
    activity-codes, custom fields, milestoneKind, constraint2, kleur) bestaan niet in MSPDI → weg na een
    export-import-cyclus.
  - Writer-`softLoss`: soft MSO komt terug als SNET (semantische drift, gedocumenteerd).
- **P6**: idem getest voor uur/constraints. Gaten: baselines/notes/hammock/externe links/schedulingOptions/
  procent- en elapsed-lag verdwijnen of degraderen; Nonlabor↔EQUIPMENT is wél stabiel bij herimport, maar
  CREW/SUBCONTRACTOR→Labor→LABOR degradeert.
  - Asymmetrie-detail: writer schrijft `MaxUnitsPerTime`/`PlannedUnitsPerTime` als fractie en reader leest
    fractie (L2-fix, beide kanten gedocumenteerd) — dit is nu symmetrisch.
  - Reader-aanname "eerste Calendar = projectkalender" en "ObjectId 1 = projectkalender" matcht de eigen
    writer, maar echte P6-exports kunnen daarvan afwijken (PMXML-dialectvarianten, TODO r742-743).
- **CSV**: grootste asymmetrie: writer schrijft berekende datums + Critical/Total Float; reader leest die als
  scheduleStart/Float in maar zonder kalender **verschuiven datums bij de eerstvolgende runCPM** (expliciet
  gewaarschuwd in de MCP-tooldescription, fileTools.ts r289-…). Task Type/Status round-trippen; resources niet.
- **Encoding/namespaces**: alle writers schrijven UTF-8-strings; MSPDI/P6-readers lezen via `DOMParser` met
  `getAllByLocalName`-achtige local-name-matching (namespace-tolerant). De xmldom-shim in tests kent **geen**
  namespaces/CDATA — "genoeg voor de welgevormde XML die onze writers produceren" (xmldom-shim.ts kop). Echte
  P6-bestanden met CDATA of prefixen zijn in het headless-harnas dus niet representatief testbaar zonder
  shim-uitbreiding.

---

## 4. Bekende bugs — lagMinutes geverifieerd

docs/TODO.md r231-239 klopt tegen de huidige code, maar is **deels al gefixt**:

- **Reader-kant (bevestigd, nog aanwezig):** `p6xmlReader.ts` r518-528 keyt op de **opvolger**:
  `const lagHourMode = taskHourById.get(succId) ?? false; … if (lagHourMode) seq.lagMinutes = Math.round(lagHours*60)`
  met `lagDays: 0`. `mspdiReader.ts` r395-407 idem: `taskHourById.get(link.successorId)` ⇒ `seq.lagMinutes`,
  `lagDays` blijft 0.
- **Solver-kant (fix bestaat inmiddels):** `CPMSolver.ts` r80-100 `resolveEffectiveLagDays` heeft sinds
  "fase 2.10" een expliciete tak: `lagDays === 0 && lagMinutes ≠ 0` → omrekenen naar dagen met de meegegeven
  `hoursPerDay` (voorganger-kalender; `LAG_CALENDAR = 'predecessor'` in `lagCalendar.ts` r10). Ook
  `shiftLagPred` (r320-330) en `resolveLagMinutes` (r303-309) verwerken `lagMinutes` als bron. De TODO-notitie
  "lag verdwijnt stil" beschrijft dus de situatie vóór die fix; de TODO-regel is niet bijgewerkt.
  **Restrisico**: de omrekening rondt op hele dagen af (`Math.round`) in het dag-pad — een 4-uurs-lag uit
  P6-import met dag-voorganger wordt 1 hele dag, niet 4 uur. Minuut-precies blijft alleen het uur-pad.
- De keuze opvolger-vs-voorganger in de readers blijft semantisch scheef t.o.v. `LAG_CALENDAR='predecessor'`,
  maar is nu niet meer stil-verliezend. TODO r239 waarschuwt terecht: "codelezing, geen import-fixture".
- Andere open import/export-TODO's (docs/TODO.md §3.8, r721-744): **XER** (r724-725, "hoogste
  interop-prioriteit, native TS haalbaar"), **.ics** (r726), **MPP alleen via MPXJ/JVM — besluit: niet als
  core-dependency, converter-route** (r727-729), **Asta PP zelfde MPXJ-afweging** (r738), **PMXML-dialectdekking
  als restcontrole** (r742-743). Verder: dag-pred/uur-succ-floatbug (r225-230, solver, niet adapter) en het
  `scheduleStart`-anker-datamodelpunt (r240-249) dat elke nieuwe reader raakt.

---

## 5. Testinfra

- `tests/planning/run.sh`: bundelt elk `check-*.ts` los met **esbuild** (`--platform=node --format=esm
  --alias:@=src`, defines voor import.meta.env), draait op kale Node. Bundelfouten breken de suite niet af
  (STATUS=1, doorlopen). Timezone-matrix draait de bundels nogmaals.
- `tests/planning/domShim.ts`: stubt alleen `globalThis.document = { documentElement: {} }` — nodig zodra een
  bundel (indirect) `@/i18n/config` binnentrekt. Moet de **allereerste import** zijn.
- `tests/planning/xmldom-shim.ts`: minimale `DOMParser` voor Node (parseFromString, documentElement,
  getElementsByTagName descendant, children, localName/tagName, textContent, parentElement). Geen namespaces,
  geen CDATA. `installDOMParser()` wordt in `check-adapters-hours.ts` r25 aangeroepen.
- **Headless-status van de readers**: `readIFC`/`writeIFC` puur string-werk (geen DOM nodig);
  `readP6XML`/`readMSPDI` hebben alleen `new DOMParser()` nodig (shim volstaat); `readCSV` puur.
  Geen enkele reader raakt `window`. ✔ Een nieuw formaat moet dezelfde discipline volgen (ImportLabels-patroon
  i.p.v. `t(...)`, geen `@/i18n/config`-import).
- `check-ifc-roundtrip.ts` is het sjabloon voor een formaat-round-trip-harnas: maximale fixture +
  compile-afdwinging + natural-key-canon + idempotentie + KNOWN_GAPS-classificatie. `check-adapters-hours.ts`
  is het sjabloon voor cross-formaat-checks (write→read per formaat op één gedeelde fixture + dag-bestand-
  discriminator tegen een echt example). Een nieuw `check-<formaat>-roundtrip.ts` hoeft alleen in `run.sh` een
  `bundle_check`-regel te krijgen (zoals r146/r342).
- Overig relevant: `check-export-guard.ts` (K7-cyclusguard van exportAs), `tests/mcp/` (MCP-tools headless),
  `scripts/verify-examples.ts` (echte readIFC + structureel round-trip-digest over alle examples).

---

## 6. Aanhaakpunten voor nieuwe formaten

Checklist van alles dat aangepast moet worden per nieuw formaat:

1. **Reader/writer-module** onder `src/services/<formaat>/` die `ImportResult` levert/consumeert
   (+ `ImportLabels` voor UI-teksten; hergebruik `importNormalize`/`importDates`/`xmlDom`/`subdayIo`).
2. **`ExportFormat`** (fileSlice.ts r50: `'ifc' | 'csv' | 'mspdi' | 'p6'`) + **`exportAs`-switch** (r335-366)
   voor exporteerbare formaten (.ics, XER-export). K7-guard komt gratis mee.
3. **`openFile` + `openRecentFile`**: filterlijsten (r191-196) én de extensie-dispatch (r198-207 / r472-481).
   Sniffing: `parseProjectXml` uitbreiden of een nieuwe dispatcher (XER is geen XML: `ERMHDR`-header).
4. **`parseExternalSource`** (r405-422): zelfde extensie-dispatch, anders geen externe koppelingen op het
   nieuwe formaat.
5. **MCP** `src/services/mcp/tools/fileTools.ts`: `formatOf` (r155-162) + `parseByExtension` (r165-172) +
   de VERLIES-PER-FORMAAT-tekst in de `planner_import_schedule`-description (r289-…) moeten mee.
6. **UI**: `Backstage.tsx` `formats`-array (r366-371) en `ribbonWidgets.tsx` (r~360) + i18n-keys
   `menu:export.<x>Label/Desc` in **alle 14 locales** (`src/i18n/locales/*/menu.json`) — `verify:i18n` faalt anders.
7. **documentContract**: **géén wijziging nodig** zolang het formaat alleen bestaande `ImportResult`-velden
   levert — `payloadFromImport` (documentContract.ts r333-350) dekt alles af. Wél nodig zodra een formaat een
   nieuw domeinveld introduceert: dan DOCUMENT_FIELDS + DocumentPayload + IFC-round-trip (compile-checks
   r203-268 dwingen dat af).
8. **Tests**: nieuw `tests/planning/check-<x>-roundtrip.ts` + `bundle_check`-regel in `run.sh`; eventueel
   xmldom-shim uitbreiden (namespaces/CDATA voor echte P6/Asta-bestanden).
9. **Verify-poorten** (`package.json` r17): `verify = typecheck && lint && test && verify:examples &&
   verify:docs && verify:i18n && verify:cycles && verify:audit`. Raakvlakken: `verify:examples` draait alle
   examples door readIFC (alleen geraakt als IFC zelf wijzigt); `verify:docs` eist bij een user-visible feature
   een artikel (min. `nl`+`en`) in `public/docs/` + manifest; `verify:i18n` de 14 locales.
   NB: AGENTS.md zegt "geen lint script", maar `verify` bevat inmiddels wél `npm run lint`.
10. **Binaire formaten (MPP/Asta PP)**: `fileAccess` is string-only (`OpenedFile.content: string`,
    `readTextFile`) — er is een bytes-variant nodig, of het besluit uit TODO r727-729 volgen (converter-route
    buiten de app, geen JVM-dependency).

---

## Risico's en verrassingen

1. **TODO.md is verouderd over de lagMinutes-bug**: de solver-fix (fase 2.10, `resolveEffectiveLagDays`
   r92-100) bestaat al; de TODO-regel r231-239 beschrijft de oude toestand. De reader-keying op opvolger staat
   er nog wel, en het dag-pad rondt een minuten-lag naar hele dagen af — bouw daar niet blind op.
2. **`.xer`/onbekende extensies vallen nu stil in het IFC-pad** (`else`-tak in openFile r205-207 en
   `parseByExtension` r171): geen nette "onbekend formaat"-fout zoals bij XML. Bij het toevoegen van formaten
   moet die catch-all expliciet worden.
3. **MSPDI-sniffing is te ruim** (`content.includes('<Project')`): elk XML-bestand met een Project-element
   wordt als MSPDI geparsed. Nieuwe XML-formaten (PMXML-varianten, Asta-XML?) moeten vóór die tak gesnifd worden.
4. **`fileAccess` is tekst-only** — MPP/PP (binair) passen niet zonder een bytes-uitbreiding van
   `OpenedFile`/`readFromRef` + de web-fallback.
5. **Het extensie-import-pad verliest data** (`fromExtImportResult` mapt alleen 6 kernvelden, `loadState`
   stript bedrijfsbinding) en omzeilt recents/FileRef/runOpenBoundary — terecht dat de nieuwe formaten daar
   niet doorheen moeten.
6. **P6-writer schrijft geen baselines** en de reader leest ze niet — een OPS→P6→OPS-cyclus verliest alle
   baselines stil (alleen console.warns voor andere velden, voor baselines zelfs geen warn).
7. **PMXML-dialect-aannames**: "eerste Calendar = projectkalender", "ObjectId 1 = projectkalender",
   ObjectId-tellers vanaf 1 — matcht de eigen writer, maar echte P6-exports (andere ObjectIds, Global-kalenders,
   CDATA, namespace-prefixen) kunnen hier doorheen zakken. De xmldom-testshim kan zulke bestanden bovendien
   niet representatief parsen (geen namespaces/CDATA).
8. **De MCP-tool-description somt verlies per formaat op** (fileTools.ts r289-…) — elk nieuw formaat vraagt
   daar een eerlijke verlies-paragraaf, anders adviseert de AI-brug verkeerd.
9. **ImportLabels/i18n-val**: een reader die per ongeluk `@/i18n/config` importeert sloopt álle headless
   bundels (`document is not defined`) — het patroon is labels-injectie vanuit de UI-laag.
10. **CSV-writer/reader-asymmetrie is by design maar verraderlijk**: export schrijft berekende datums, import
    krijgt de default-kalender → datums verschuiven bij herberekening. Voor .ics-export geldt straks hetzelfde
    principe (berekende datums exporteren, en .ics is export-only volgens TODO r726).
11. **AGENTS.md wijkt af van package.json**: `verify` bevat inmiddels `lint`, `verify:cycles` en
    `verify:audit` naast de vier gedocumenteerde stappen.
12. **`applyLoadedProject` behoudt view/inklap van het huidige document** (r158-160) — semantiek om te
    respecteren bij nieuwe import-paden, anders gedraagt een nieuw formaat zich anders dan de bestaande drie.
