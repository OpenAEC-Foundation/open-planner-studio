---
paths:
  - "src/engine/scheduler/conventions/**"
  - "src/engine/scheduler/solveInput.ts"
  - "src/engine/scheduler/CPMSolver.ts"
  - "src/engine/scheduler/p6*"
  - "src/services/ifc/schedulingProfileMigration.ts"
  - "src/services/schedulingProfiles/**"
  - "src/services/leveling/**"
  - "src/state/schedulingProfileDraft.ts"
  - "src/state/schedulingProfileNotice.ts"
  - "src/components/**/SchedulingProfileSection.tsx"
  - "scripts/measure-profiles*.mjs"
  - "scripts/verify-conventions*"
  - "docs/recepten/conventie.md"
  - "tests/planning/check-conventions-*"
  - "tests/planning/check-*profile*"
  - "tests/planning/check-leveling-input.ts"
  - "tests/planning/xerManifestLeveling.ts"
---

<!-- Verplaatst uit CLAUDE.md (2026-09, bij het samenvoegen van de rekenprofielen-etappe #169 met de
CLAUDE.md-inkorting van #176): laadt alleen wanneer Claude een bestand leest dat op `paths` past. -->

### Rekenprofielen: benoemde conventies, geen formaatvlag

Eén motor, drie scholen (Primavera P6, MS Project, OPS). Een **rekenprofiel** (`project.schedulingProfile`,
basis `p6 | msproject | ops` + overrides) levert zevenentwintig **conventies** (`ConventionKey`, booleans);
`project.schedulingOptions` draagt alleen de elf **projectopties** (`ProjectOptionKey`, per bestand) en
`progressMode` blijft een eigen projectveld. De bron voor beide is `src/engine/scheduler/conventions/registry.ts`
(`CONVENTIONS` met per conventie drie ingebouwde waarden, `legacyValue` en `gatedByP6Source`); de migratie
van oude optieblokken (`legacyOptionsToProfile`) staat bewust buiten de motor, in
`src/services/ifc/schedulingProfileMigration.ts`. Geen conventie komt per bestand uit de bron (het vroegere
per-bestand-mechanisme voor A19 is op 2026-09-24 vervallen: A19 staat gewoon aan in P6); wat per bestand
verschilt is een projectoptie. Afwijkingen op een ingebouwd id blijven bij een wissel letterlijk staan
(`switchProfile`), en `isDefaultProfile` is letterlijk "ops zonder enige afwijking" — zo geeft P6 → OPS → P6
het origineel terug.

De solver krijgt uitsluitend `EffectiveSchedulingOptions` via `solveOptionsFor`/`solveInputFor`
(`src/engine/scheduler/solveInput.ts`) — `CPMOptions.schedulingOptions` is verplicht dat type, dus een
aanroeper die het profiel overslaat compileert niet. Lezers stellen het profiel voor
(`ImportResult.suggestedProfileId`: XER ⇒ p6, `.mpp` ⇒ msproject, MSPDI/P6-XML/CSV ⇒ ops deze etappe);
openen meldt het profiel met een actie naar Projectinfo (`src/state/schedulingProfileNotice.ts`; bij een
onbruikbaar XER-archief stapelt `withXerArchiveIssueNotice` er als buitenste laag omheen). IFC:
`OPS_SchedulingProfile` (alle zevenentwintig opgelost plus de letterlijke afwijkingen, alleen ≠
standaardprofiel) naast `OPS_SchedulingOptions` (opties + A22/A23 alleen als true) — door
`writeIFC`/`readIFC` geschreven en gelezen. Eigen profielen zijn app-globale sjablonen
(`ops-schedulingProfiles`, `services/schedulingProfiles/profileStore.ts`); een project draagt zijn eigen
kopie. UI: het blok *Rekenprofiel en reken-opties* in Projectinfo (`SchedulingProfileSection.tsx`,
bewerkmodel `state/schedulingProfileDraft.ts`, actie `applySchedulingSettings`). Extensies lezen het
opgeloste profiel via `ExtProject.schedulingProfile` (API 1.2.0).

**Regel A/B voor motorwerk:** een wijziging landt alleen als onder elk profiel met orakel geen exacte cel
inexact wordt (`npm run measure:profiles`, cel-baseline); verschilt iets per profiel, dan is het een
conventie in het register — nooit een `if` op het formaat (wél bestaan er gepinde herkomstpoorten bínnen
conventies, zoals `task.p6ProjectId !== undefined`: de datagates). `npm run verify:conventions` bewaakt dat
mechanisch: `src/engine/` leest geen bronformaat (`p6Source`/`readFormat`/XER-bronsignalen/lezer-imports);
opties-sleutels alleen uit het register (+ elke conventie gelezen in de solver); ongepinde
`p6…`/`xer…`/`mpp…`/`msp…`-velden rood; herkomst-datagates gepind, alleen omlaag. Syntactisch: een
opties-object via een helper in een ander bestand onder een neutrale naam, of via `any`, ziet hij niet.
Recept: `docs/recepten/conventie.md`; gids: `public/docs/{nl,en}/gids-rekenprofielen.md`; spec:
`docs/superpowers/specs/2026-09-22-rekenprofielen-design.md`; regel A en B:
`docs/superpowers/plans/2026-09-22-goalprompt-x12-naar-nul.md`.

### Het nivelleringsfundament (projectoptie `leveling`)

De elfde projectoptie, `leveling`, is het **fundament voor P6-nivellering** en nog pure data: de XER-lezer
vult hem uit SCHEDOPTIONS (`level_keep_sched_date_flag`, `level_all_rsrc_flag`, `LevelPriorityList`) en
RSRCLEVELLIST (+ `RSRCRATE.max_qty_per_hr`), bewust zonder aan/uit-veld (P6 bewaart niet óf er
genivelleerd is; de vorm van de aan/uit is eigenaarsbeslissing 1); hij round-tript via
`OPS_SchedulingOptions` en MCP `get_project_info` toont hem, maar motor, UI en `ResourceLeveler.ts` lezen
hem niet. De motoretappe leest hem straks uitsluitend via `src/services/leveling/levelingInput.ts`
(hangende resource-ids gemeld, gesloten mapping P6-kolomnaam ⇒ eigen berekende grootheid, nooit
opgeslagen P6-uitvoer). Het manifestveld `leveledProjects` (`tests/planning/xerManifestLeveling.ts`) is het
bijbehorende meetmechanisme, zonder data en zonder invloed op de telling (eigenaarsbeslissing 2). Plan en
open besluiten: `docs/superpowers/plans/2026-09-24-nivellering-etappe-onderzoek.md`.
