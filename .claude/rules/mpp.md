---
paths:
  - "src/services/mpp/**"
  - "src/services/formatRegistry.ts"
  - "src/services/msproject/mspdiReader.ts"
  - "src/services/calendarRecurrence.ts"
  - "tests/planning/check-mpp-*"
  - "src/state/timephasedLossNotice.ts"
  - "src/components/task-sections/TaskTimephasedNotice.tsx"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

### De `.mpp`-lezer is een eigen CFB/OLE2-implementatie, alleen-lezen

Naast de bestaande CSV/MSPDI (MS Project XML)/P6-XML-adapters kan Open Planner Studio het native
`.mpp`-formaat van Microsoft Project (MPP14, Project 2010–2021) rechtstreeks openen — geen Rust, geen
externe bibliotheek. `src/services/mpp/` is een eigen, in TypeScript geschreven CFB/OLE2-container-
parser (`cfb.ts`) plus een MPP14-fieldmap-laag (`fieldMap14.ts`, `mppContainer.ts`, `mppEntities.ts`,
`mppCalendars.ts`, `mppPrimitives.ts`, `mppTimephased.ts`), structureel afgeleid van MPXJ
(`github.com/joniles/mpxj`, LGPL-2.1) zonder de Java-afhankelijkheid. Entry point `readMPP()`
(`mppReader.ts`) levert hetzelfde `ImportResult`-contract als de andere lezers en wordt via
`src/services/formatRegistry.ts` (`READ_FORMATS`, één registry voor alle open-dispatches, ook voor
CSV/MSPDI/P6-XML/IFC) achter een dynamic import geladen, zodat de CFB/fieldmap-code
buiten de hoofdbundel blijft. De import is **alleen-lezen**: er is geen `.mpp`-schrijfpad, opslaan
gaat altijd via IFC (zie `.claude/rules/tauri-ifc.md`); oudere `.mpp`-versies (MPP8/9/12) en wachtwoord-versleutelde
bestanden worden herkend maar geweigerd met een duidelijke foutmelding.

Datumgetrouwheid tegen MS Project zelf wordt bewaakt door `tests/planning/check-mpp-fidelity.ts`
tegen een gecommitte baseline (`mpp-fidelity-baseline.json`, 216 bestanden/3413 taken uit publiek
MPXJ-/OzBuild-testmateriaal): de `GOAL_ZERO_DEVIATIONS`-poort daarin faalt zodra één gepind bestand
nog maar één dag/minuut afwijkt. Een bewerking die de MSP-eigen timephased-sturing van een taak
loslaat (contour/split/nivellering uit het bronbestand) geeft eenmalig per document een informatieve
melding (`notifyTimephasedLoss`, `src/state/timephasedLossNotice.ts`) en markeert de taak in het
eigenschappenpaneel (`TaskTimephasedNotice.tsx`); beide linken via `openHelpArticle` (`uiSlice.ts`,
`NotifyInput.helpArticleId`) naar de Help-viewer (Backstage → Help). Zie de gids
`public/docs/{nl,en}/howto-mpp-openen.md` voor het gebruikersperspectief en de overige
`tests/planning/check-mpp-*.ts`-batterijen (import/relations/calendars/summary-relations) voor de
rest van de regressiedekking.

### De MSPDI-lezer (`mspdiReader.ts`)

Besluiten van de lezer van MS Project XML: `docs/adr/0250-mspdi-lezen-ops-markeringen.md`,
`0251-mspdi-lezen-duur-rest-lag-en-baseline.md`, `0252-mspdi-lezen-uurkalender-en-tijd-van-een-datum.md`,
`0253-mspdi-lezen-werkweek-en-werkdag.md`, `0254-mspdi-lezen-uitzonderingen-en-basiskalenders.md`,
`0255-mspdi-lezen-rekenuitvoer-van-ms-project.md`, `0256-mspdi-lezen-soort-mijlpaal.md` en
`0257-mspdi-lezen-resources-en-toewijzingen.md`.

### De `.mpp`-lezer (`mppReader.ts`)

Besluiten van `readMPP`: `docs/adr/0280-mpp-lezen-taakrecords-en-bitvlaggen.md`, `0281-mpp-lezen-hierarchie-en-wbs.md`,
`0282-mpp-lezen-duur-rest-en-handmatig-anker.md`, `0283-mpp-lezen-uurkalender-en-tijd-van-een-datum.md`,
`0284-mpp-lezen-projecteigenschappen-en-statusdatum.md`, `0285-mpp-lezen-rekenuitvoer-van-ms-project.md`,
`0286-mpp-lezen-soort-mijlpaal.md`, `0287-mpp-lezen-toewijzingen-koppelen-splits-en-contouren.md`,
`0288-mpp-lezen-tijdgefaseerd-venster-en-duurwandeling.md` en `0289-mpp-lezen-melding-over-de-planning-van-ms-project.md`.

### De decoder van de tijdgefaseerde gegevens (`mppTimephased.ts`)

Besluiten van de decoder: `docs/adr/0410-mpp-tijdgefaseerd-categorieen-en-byte-indeling.md`,
`0411-mpp-tijdgefaseerd-eenheden-afronding-en-plafond.md`, `0412-mpp-tijdgefaseerd-grenzen-bij-corrupte-invoer.md`,
`0413-mpp-tijdgefaseerd-werkminuten-zonder-kalender.md` en `0414-mpp-tijdgefaseerd-splits-afleiden.md`.

### De kalenderherhaling (`calendarRecurrence.ts`)

Besluiten van de gedeelde kern voor uitzonderingen van de `.mpp`- en de MSPDI-lezer:
`docs/adr/0290-kalenderherhaling-gedeelde-kern-zonder-mpp-import.md`, `0291-kalenderherhaling-voorrang-per-datum.md`,
`0292-kalenderherhaling-patronen-codes-en-eenheden.md` en `0293-kalenderherhaling-grenzen-en-budget.md`.
