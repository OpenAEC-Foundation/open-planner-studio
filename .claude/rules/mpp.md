---
paths:
  - "src/services/mpp/**"
  - "src/services/formatRegistry.ts"
  - "tests/planning/check-mpp-*"
  - "src/state/timephasedLossNotice.ts"
  - "src/components/task-sections/TaskTimephasedNotice.tsx"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud ongewijzigd overgenomen; "hierboven"/"hieronder" verwijst naar de oude volgorde van CLAUDE.md. -->

### De `.mpp`-lezer is een eigen CFB/OLE2-implementatie, alleen-lezen

Naast de bestaande CSV/MSPDI (MS Project XML)/P6-XML-adapters kan Open Planner Studio het native
`.mpp`-formaat van Microsoft Project (MPP14, Project 2010–2021) rechtstreeks openen — geen Rust, geen
externe bibliotheek. `src/services/mpp/` is een eigen, in TypeScript geschreven CFB/OLE2-container-
parser (`cfb.ts`) plus een MPP14-fieldmap-laag (`fieldMap14.ts`, `mppContainer.ts`, `mppEntities.ts`,
`mppCalendars.ts`, `mppPrimitives.ts`, `mppTimephased.ts`), structureel afgeleid van MPXJ
(`github.com/joniles/mpxj`, LGPL-2.1) zonder de Java-afhankelijkheid. Entry point `readMPP()`
(`mppReader.ts`) levert hetzelfde `ImportResult`-contract als de andere lezers en wordt — net als
CSV/MSPDI/P6-XML/IFC — via `src/services/formatRegistry.ts` (`READ_FORMATS`, één registry voor alle
open-dispatches en de exportlijst) achter een dynamic import geladen, zodat de CFB/fieldmap-code
buiten de hoofdbundel blijft. De import is **alleen-lezen**: er is geen `.mpp`-schrijfpad, opslaan
gaat altijd via IFC (zie hierboven); oudere `.mpp`-versies (MPP8/9/12) en wachtwoord-versleutelde
bestanden worden herkend maar geweigerd met een duidelijke foutmelding.

Datumgetrouwheid tegen MS Project zelf wordt bewaakt door `tests/planning/check-mpp-fidelity.ts`
tegen een gecommitte baseline (`mpp-fidelity-baseline.json`, 216 bestanden/3413 taken uit publiek
MPXJ-/OzBuild-testmateriaal): de `GOAL_ZERO_DEVIATIONS`-poort daarin faalt zodra één gepind bestand
nog maar één dag/minuut afwijkt. Een bewerking die de MSP-eigen timephased-sturing van een taak
loslaat (contour/split/nivellering uit het bronbestand) geeft eenmalig per document een informatieve
melding (`notifyTimephasedLoss`, `src/state/timephasedLossNotice.ts`) en markeert de taak in het
eigenschappenpaneel (`TaskTimephasedNotice.tsx`); beide linken via `openHelpArticle` (`uiSlice.ts`,
`NotifyInput.helpArticleId`) naar de Help-viewer (Backstage → Help). Zie de gids
`public/docs/{nl,en}/gids-msproject-import.md` voor het gebruikersperspectief en de overige
`tests/planning/check-mpp-*.ts`-batterijen (import/relations/calendars/summary-relations) voor de
rest van de regressiedekking.
