# Bestandsformaten — ontwerpskelet (orchestrator-werkdocument)

> **Herkomst (2026-08-15):** geoogst uit de parallelle branch `file-format-implementation`
> (verwijderd na oogst, eigenaarsbesluit — de code van die branch is bewust NIET overgenomen).
> Let op: de MPP-conclusies hierin (npm-`cfb`-spoor) zijn ingehaald door de inmiddels gebouwde
> native MPP14-lezer in `src/services/mpp/`; de XER/PMXML/PP-delen zijn actuele input voor
> etappe 2. Verifieer beweringen tegen de huidige code.


Status: DEFINITIEF CONCEPT — alle drie de werker-rapporten verwerkt; klaar voor hyperkritische review.
Werkers: pig (KLAAR — corpus, zie CORPUS-OVERZICHT.md in testdata-crawl), rat (KLAAR —
2026-08-14-rapport-code-inventaris.md), ram (KLAAR — 2026-08-14-rapport-formaat-specs.md).

## Doel (user, 2026-08-14)

- Alle formaten uit issue #17 importeerbaar via de **importknop** (Backstage), NIET via extensies.
  Dit herroept expliciet de TODO.md-triage van 2026-07-07 die MPP/Asta PP naar een
  MPXJ-sidecar-extensie schoof: de user wil ze native in de import-flow.
- **Round-trip-garantie**: elk bestand dat OPS exporteert moet OPS ook weer kunnen importeren.
- Grondig, edge-case-gedreven, gevalideerd tegen een grote corpus echte bestanden.
- Regelmatige hyperkritische reviews.

## Formaten-matrix (voorlopig, te bevestigen met rapporten)

| Formaat | Lezen | Schrijven | Round-trip-eis | Status |
|---|---|---|---|---|
| IFC 4.3 | ✅ bestaat | ✅ bestaat | ja (bestaande check) | natief |
| CSV | ✅ bestaat | ✅ bestaat | ja | bestaat |
| MSPDI .xml | ✅ bestaat | ✅ bestaat | ja — gaten checken | bestaat |
| P6 PMXML | ✅ bestaat | ✅ bestaat | ja — gaten checken | bestaat |
| P6 XER | NIEUW | NIEUW | ja | prioriteit 1 |
| MPP | NIEUW (readonly) | nee (niemand schrijft MPP behalve MS) | n.v.t. (geen export) | prioriteit 2 |
| Asta PP | NIEUW (readonly) | nee | n.v.t. | prioriteit 3 |
| iCalendar .ics | te besluiten | NIEUW (export) | user-eis: élke export importeerbaar ⇒ .ics-import (mijlpalen) nodig, scope bepalen | prioriteit 4 |
| .mpx / .planner / .gan | te besluiten | — | — | optioneel, rapporten afwachten |

## Open ontwerpbesluiten (voor mij, na rapporten)

Besloten op basis van rat-rapport:

- **B1 — Centrale formaatdetectie**: openFile's extensie-dispatch + `parseProjectXml` vervangen door
  één detector (extensie + inhouds-magic: `ERMHDR` voor XER, CFB-magic `D0CF11E0` voor MPP,
  `SQLite format 3`/tekst-heuristiek voor PP, XML-dialect-sniffing die PMXML vóór de te ruime
  `<Project`-check doet). Onbekende extensies mogen NIET meer stil in het IFC-pad vallen
  (risico 2 uit rat-rapport). Dispatch gedeeld door openFile/openRecentFile/parseExternalSource/MCP
  `parseByExtension`.
- **B2 — bytes-pad in fileAccess**: `OpenedFile.content` is string-only; MPP/PP vergen een binaire
  variant (`Uint8Array`) door de hele keten (Tauri `readFile`, web `file.arrayBuffer()`,
  recents/readFromRef). Structurele maar afgebakende uitbreiding — native in de app, geen converter
  (user-besluit herroept TODO r727-738).
- **B3 — Round-trip-eis geldt óók bestaande formaten**: P6-writer verliest baselines STIL (zelfs
  geen warn), MSPDI degradeert resource-typen, CSV verschuift datums na herimport. Fase 0 dicht de
  stille gaten (minstens: warn of veld meenemen) en legt per formaat een KNOWN_GAPS-lijst vast naar
  het model van check-ifc-roundtrip.
- **B3b — BEWEZEN BUG (nulmeting ox, bevestigd door critreview): echte PMXML-bestanden parsen naar 0 taken.**
  `getAllByLocalName` (p6xmlReader.ts r156-166) zoekt alleen in DIRECTE kinderen van de root;
  echte P6-exports (V18.8/OPC, 9 gecrawlde samples getest) nesten `<Activity>`/`<Relationship>`
  binnen `<Project>`. Alleen onze eigen writer-output (plat: p6xmlWriter sluit Project en pusht
  Activity als root-sibling) parst — dáárom is check-adapters-hours groen: hij test uitsluitend
  de platte eigen output en raakt het geneste pad nooit. **Fix hoort bij F2** (per Project
  itereren, NÍET plat recursief — anders smelten multi-project-bestanden samen), samen met een
  écht genest P6-fixture in de round-trip-test. Resources/kalenders parsen wél (staan plat).
- **B4 — readers blijven headless + ImportLabels-patroon** (geen t(...) in dienstlaag); nieuw
  formaat-harnas volgt check-adapters-hours/check-ifc-roundtrip-sjabloon; xmldom-shim moet
  namespaces/CDATA leren voor échte P6/Asta-bestanden.
- **B5 — lagMinutes**: solver-fix bestaat al (resolveEffectiveLagDays, fase 2.10); readers keyen nog
  op opvolger en dag-pad rondt af. Nieuwe readers volgen de voorganger-conventie; TODO.md r231-239
  bijwerken; import-fixture toevoegen (die ontbreekt).

Nog open → nu BESLOTEN (ram-rapport):

1. **MPP-diepte**: BESLOTEN — MPP9/12/14 lezen op kernniveau (taken, uniqueID/outline, datums,
   duur, milestones, relaties, kalenders, resources, assignments, voortgang); MPP8 overslaan;
   volledige fidelity (custom-field-lookups, views, timephased) expliciet buiten scope.
   Container via npm `cfb` (bewezen op 228/228 corpus-bestanden). CompObj-stream geeft versie;
   MPP14 dekt Project 2010 t/m 365. Wachtwoord-XOR (0xFF-code) meenemen.
2. **Asta PP-route**: BESLOTEN — alleen de SQLite-route in v1 (dekt PP13+; corpus: 45 echte
   .pp's V15/16/17, incl. UTF-16LE-databases). sql.js (WASM, ~1-1,5MB) lazy-laden bij eerste
   .pp-import; werkt in browser én Tauri-webview. ~20 tabellen volgens AstaSqliteReader-set;
   bar/task/milestone-mapping is het echte werk. Tekstroute (EasyProject-era) uitgesteld tot vraag.
3. **.ics-import-scope**: .ics blijft export-only (RFC 5545 VEVENT, UTC, stabiele UIDs,
   75-octet folding, CRLF). De round-trip-eis "elke export importeerbaar" wordt voor .ics
   ingevuld met een minimale mijlpalen-import (VEVENT→mijlpaal), TENZIJ de user dat overbodig
   vindt — expliciet voorleggen bij planpresentatie.
4. **Sniffing-architectuur**: BESLOTEN — zie B1.
5. **Round-trip-harnas**: nieuw check-<formaat>-roundtrip per formaat + een corpus-runner die de
   crawl-map doorloopt (buiten CI; curated subset ín CI via bundle_check in tests/planning/run.sh).
6. **Verliesrapportage**: bestaand patroon = console.warn in writers + verlies-paragraaf in de
   MCP-tooldescription (fileTools.ts r289+). Elke nieuwe adapter levert beide; stille verliezen
   (P6-baselines!) worden expliciet.
7. **lagMinutes-bug**: BESLOTEN — zie B5.

## Fasering (vastgesteld; volgorde deels uit ram's aanbeveling ICS→XER→PMXML→Asta→MPP)

- **F0**: fundament — bytes-pad fileAccess (B2, ÓÓK voor XER: cp1252-corpus bewijst het) +
  centrale formaatdetectie (B1, op bytes, magic strikt offset-0) + corpus-runner +
  stille-verlies-warns bestaande writers (B3) + TODO-update (B5).
  Volgorde BINDEND: T3 ∥ (T2→T1→T4); T1+T2 één GLM-run. Zie
  plans/2026-08-14-f0-brief-definitief.md. (Poort: bestaande suites groen + harnas op corpus.)
- **F1**: XER lezen+schrijven. CP1252-default (TextDecoder windows-1252), %T/%F/%R-parser met
  multiline-memo's, clndr_data-grammatica (1=zondag, epoch 1899-12-30), CURRTYPE-two-pass
  voor decimalen, enum-mappings uit ram-rapport §1.6, multi-project + externe relaties,
  schrijfvolgorde §1.9. Corpus: 48 crawl-XER's + 11 mpxj + 13 cpp-cases (torture/malformed).
- **F2**: PMXML-dialectfix — namespace-agnostisch, BusinessObjects-root, &#0;-pre-pass,
  geneste Activity-parsing per Project (B3b!) mét echt genest fixture, BaselineProject-lezen
  én -schrijven (heft de F0-warn op), nil-elementen weglaten bij schrijven, xmldom-shim
  CDATA/namespaces leren.
- **F3**: .ics-export (+ evt. mijlpalen-import, zie besluit 3).
- **F4**: Asta PP lezen (SQLite-route, sql.js lazy).
- **F5**: MPP lezen (kern MPP14 eerst, dan 12/9; differentiële validatie tegen de drie
  NL MPP+MSPDI-paren en mpxj-corpus).
- **F6**: UI/i18n/docs-afronding: importknop-filters, 14 locales, help-artikelen (nl+en),
  MCP-tool-parity (formatOf/parseByExtension/verlies-descriptions), parseExternalSource-dekking.
- Optioneel F7 (na userbesluit): .gan/.planner/.pod/.mpx readers — corpus ligt er al.
- Elke fase: GLM-5.3 bouwt op brief → ik poort (verify + corpus) → hyperkritische review
  → commit.

## Aanhaakpunt-checklist per formaat (uit rat-rapport §6)

reader/writer-module → ExportFormat+exportAs → openFile/openRecentFile-filters+dispatch →
parseExternalSource → MCP (formatOf, parseByExtension, verlies-description) → Backstage+ribbon+
14 locales → tests (check-roundtrip + run.sh bundle_check) → verify-poorten → docsartikel nl+en.
documentContract alleen bij nieuw domeinveld.

## Reviewverdict (bear, Opus 4.8 xhigh, 2026-08-14)

Spec fundamenteel gezond; F0-briefconcept had 3 blockers (XER hoort op het bytes-pad wegens
cp1252; detector-volgorde/interface op bytes; B3b-inconsistentie F0-vs-F2) plus 5 majors
(call-sites expliciet, corpuspad via env/arg, documentContract-waarschuwing voor F1+,
performance/security onbelegd, magic-offset-discipline). Alles verwerkt in
plans/2026-08-14-f0-brief-definitief.md. Volledig rapport: /tmp/rapport-critreview-plan.md
(ook gearchiveerd als specs/2026-08-14-rapport-critreview-f0.md).
Openstaand voor latere fasen: performance-budget (grote bestanden in browser),
sql.js-hardening (F4), Tauri file-associations (F6), documentContract-besluit per nieuw
XER/PMXML-veld in de F1/F2-briefs, .ics-lossy-round-trip-vraag aan user (F3).

## Corpus

- Eigen testmap: 3× echte NL MPP (v14+, Composite Document) + bijbehorende MSPDI-export.
  **Nulmeting 2026-08-14 (ox, headless probe met echte readMSPDI):** alle drie de
  MSPDI-bestanden parsen al: 215/51/134 taken, 225/104/111 relaties, 9/13/11 kalenders,
  0 baselines. De MPP+MSPDI-paren zijn dé differentiële validatie voor de MPP-reader (F2):
  zelfde project, twee formaten — de MPP-parse moet structureel matchen met de MSPDI-parse.
- mpxj junit/data: 849 bestanden (609 mpp / 148 xml / 60 mpd / 19 mpx / 7 xer / 4 planner /
  1 pmxml). cpp-cpm-engine: bewust-kapotte XER-cases. delay-analysis: echte grote XER's.
  pmxml-samples: 10 stuks (V8.3-V24.12).
- **pig-crawl (2026-08-14)**: crawl-pp 65 (45 echte SQLite .pp's V15/16/17 + workshop-zips!),
  crawl-xer 48 (incl. torture-test, encodings, malformed, kedular-edge-cases), crawl-mpp 49,
  crawl-mspdi 14 (meertalig: de/ru/sr/hr/pt-br/sv, ganttproject/telerik/syncfusion-dialecten),
  crawl-ics 15 (incl. bewust-invalide), crawl-ifc4d 10, crawl-gan 8, crawl-planner 7,
  crawl-pod 2, crawl-overig 1 (.mpx). Totaal corpus ±1900 bestanden.
  Zie testdata-crawl/CORPUS-OVERZICHT.md.
