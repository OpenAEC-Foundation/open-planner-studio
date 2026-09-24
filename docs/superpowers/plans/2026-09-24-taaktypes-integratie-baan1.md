# Integratieverslag — PR #101 (taaktypes) op #169, baan 1

*2026-09-24, `uitvoerder-opus-midden` (Claude Opus 5.5). Branch `claude/taaktypes-integratie`, kop
`aa0914db` (gepusht), gebouwd op `origin/claude/rekenprofielen` `c2173141` + merge van
`origin/claude/contour-engine-planner-mnrsy3` `c5fca94a`. Dossier: `2026-09-24-verkenning-pr101-taaktypes.md`.*

## In gewone woorden

PR #101 zit nu in de rekenprofielen-branch, als echte merge (de historie blijft staan). Alle 29
conflictbestanden zijn opgelost zoals het dossier voorstelde, en de twee valkuilen zijn gedicht en met
checks vastgelegd. De meetlat is onveranderd: nul nieuwe of slechtere cellen, en MS Project-getrouwheid
blijft op nul afwijkingen. Er staat nog één poort rood: de conventiegrens telt vier nieuwe lezingen van
importvelden in `src/engine/work/`. Die poort heb ik niet aangepast; dat vraagt een besluit.

## Commits

| sha | wat |
|---|---|
| `02e5a295` | merge-commit (29 conflicten, API 1.3.0, `contourKeepsWork` in de bouwer, instelling naar Planning, tekstrollen, compileerfix, TODO baan 2) |
| `ca4dee6f` | checks voor de twee valkuilen (`check-hour-input-finish` 38–42) |
| `aa0914db` | melding over ontsloten taaktypes als detailregel in de ene bestandsmelding (T4-17 hersteld, nieuwe check T4-18b) |

## Keuze per conflictbestand

| bestand | keuze |
|---|---|
| `src/state/slices/taskSlice.ts` | Volgorde van #169, met de stappen van #101 ertussen: basis → K2-kalenderstap → driehoek → merge → Δ-rest → contour + `settleDurationEdit` → `settleRuleChange` → Z8 → `clearLevelingGaps` → `reconcileHourInputFinish`. `addTask`: seed plus K3-ontsluiting. `setTaskCalendar`: basis → capture → wissel → settle → Z8 → gaten → reconcile. Beide valkuilen opgelost (zie hieronder) |
| `src/state/runtime/createMcpTransactions.ts` | Zelfde oplossing in `updateTaskFields` (`updates` naar de nivelleerpoort, basis vóór de K2-stap) en `patchTaskFields` (basis vóór de K2-stap; `top` bevatte `calendarId` al). `draft.addTask`: seed plus K3 |
| `src/state/slices/resourceSlice.ts` | Allebei gehouden: `clearLevelingGaps` van #169 in `assignResource`/`moveAssignment`, en `stale` na een duurwijziging uit de driehoek van #101. Imports samengevoegd |
| `src/state/gridTransaction.ts` | `buildTaskEditPlanEnvironment` van #169 aangehouden; `contourKeepsWork` van #101 daarin opgenomen. Zo krijgen de voortgangsimport (#27) en de `planTaskCellEdits`-paden in de store hem ook |
| `src/utils/taskDefaults.ts` | Imports van beide kanten samen (B1 plus `effHoursPerDay`); de rest was al automatisch samengevoegd |
| `src/types/project.ts` | Versie van #169, plus `defaultWorkRule`. De CRLF-verschillen vallen weg |
| `src/state/slices/types.ts` | Meldingssleutels van beide kanten samengevoegd |
| `src/types/taskGrid.ts`, `taskGridAdapter.ts`, `FullTaskGrid.tsx` | Beide kanten samen: `recordedMark` en `recordedUnrecordedAxes` naast `taskTypesUnlocked`; afhankelijkheden van beide kanten |
| `src/services/mcp/tools/readTools.ts` | Beide kanten samen (`defaultWorkRule` plus profiel en opties) |
| 9 × `src/i18n/locales/*/task.json` | Driewegmerge per sleutel: `workRule` en drie werkkolommen erbij, geen botsingen |
| `public/docs/manifest.json`, `README.md` | `gids-taaktypes` zonder cluster (veld is optioneel); nu 37 artikelen |
| `src/services/xer/xerReader.ts`, `p6xmlReader.ts`, `mspdiReader.ts` | Imports samengevoegd (`rebuildImportedHierarchy` van #169, `deriveImportedWorkRules` van #101) |
| `src/services/msproject/mspdiWriter.ts` | Het werkveld gaat vóór; zonder werkveld blijft de afleiding van #169 met `workHpd` (de taakkalender) |
| `src/components/settings/SettingsPanelContent.tsx` | "Toon taaktypes" staat op tab **Planning**, onder Urenplanning. De secties duur, balk en comprimeren uit #101 vervallen, want op #169 staan die al op Weergave |
| `tests/planning/check-ext-contract.ts` | `defaultWorkRule` toegevoegd aan de canon |
| `tests/planning/check-milestone-duration-render.ts` | Datumonafhankelijke variant van #169 aangehouden |

Buiten de conflicten om:
- `EXTENSION_API_VERSION` gaat naar **1.3.0**, met historie in `apiVersion.ts`; C8-04 is bijgewerkt.
- `TaskAssignmentsSection`: `contourOf` staat weer naast `contouredIds` van #169. Na de merge was dit een compileerfout.
- Vijf plekken in de nieuwe UI van #101 kregen tekstrollen (`text-caption`/`text-small`) voor `verify:text-roles`.
- Er staat een TODO-commentaar in `settleDurationAftermath` voor baan 2.

## De twee valkuilen

- **(a) Kalenderwissel laat nivelleergaten staan.** #101 haalt `calendarId` uit `rest`. Daardoor zag
  `taskUpdateInvalidatesLevelingGaps(rest, time)` de kalenderwissel niet meer. De fix geeft `updates`
  mee in `taskSlice.updateTask` en `createMcpTransactions.updateTaskFields`. Checks:
  `check-hour-input-finish` **41** (store) en **42** (MCP). Mutatie terug naar `rest`: 41 en 42 rood.
- **(b) Ingevoerd einde blijft oud na een kalenderwissel.** De fix legt `hourInputFinishBasis` vast vóór
  de K2-kalenderstap, in store `updateTask`, MCP `updateTaskFields` en `patchTaskFields`; bij
  `setTaskCalendar` vóór de capture. Checks: **38** (store), **39** (MCP updateTaskFields), **40** (MCP
  patchTaskFields). Mutatie met de basis ná de kalenderstap: 38–41 rood.

## Extra botsing buiten het dossier (voorlopig opgelost)

Op #169 geldt: één melding per geopend bestand (X10, rekenprofielen spec §6). Na de merge gaf een
XER-bestand twee meldingen, want #101 meldt apart dat taaktypes ontsloten zijn. `check-xer-open-wiring`
T4-17/T4-18 werden daardoor rood.

De oplossing:
- `applyOpenedImport` zet de ontsluiting per document vast, via `claimTaskTypesNotice` en
  `deferTaskTypesNotice`.
- De ontsluiting verschijnt als detailregel in die ene bestandsmelding.
- Heeft een bestand geen eigen melding (MSPDI/P6-XML/CSV/IFC onder ops), dan blijft de losse melding
  van #101 staan.

Nieuwe check T4-18b. Mutatiebewijs: zonder `deferTaskTypesNotice` worden T4-17, T4-18 en T4-18b rood;
zonder de detailregel wordt T4-18b rood. Dit is een **voorlopige** keuze; de vorm is eigenaarsvraag E4.

## Poorten (exitcode)

| poort | exit | opmerking |
|---|---|---|
| `npm run typecheck` | 0 | |
| `npm run lint` | 0 | |
| `verify:docs` / `verify:i18n` / `verify:examples` / `verify:release-highlights-json` | 0 | |
| `verify:store-boundaries` / `verify:gantt-boundaries` / `verify:cycles` / `verify:text-roles` | 0 | |
| **`verify:conventions`** | **1** | Datagates: `p6DurationType` 7 tegen 6 gepind (+1), `mspTaskType` 4 tegen 1 gepind (+3). De nieuwe lezingen staan in `src/engine/work/taskTypesVisibility.ts:21` (`mspTaskType` en `p6DurationType`, "draagt het document taaktypedata"), `src/engine/work/workRuleApply.ts:50` (`effectiveEffortDriven`: alleen met MSP-herkomst telt `effortDriven`) en `:254` (`contourKeepsWork`, terugval op `mspTaskType === 'FIXED_WORK'`). Alle drie horen bij bewerksemantiek en de zichtbaarheidsregel, niet bij de solver. De poort is **niet** aangepast; zie E6 |
| `bash tests/planning/run.sh` (zonder corpus) | 1 | Alleen `check-conventions-boundary` is rood: 01 (dezelfde datagate als hierboven), plus 13/13a. **13/13a waren al rood op `c2173141`**: in een losse worktree op die kop nagemeten, "2 van 65 rood", allowlist-rapport voor `legacyP6Source.ts`. Die twee komen dus niet uit de merge. De andere batterijen, inclusief de mpp-fidelity, zijn groen |
| `npm run test:mcp` | 0 | |
| `npm run test:library` | 0 | |
| browser: `work-rule` + `contour-dialog` + `scheduling-profile` | 0 | 9/9, gedraaid voor én na de meldingfix |
| `check-xer-field-whitelist` | 0 | 338 checks. `duration_type` is TASK-bak 1. `target_qty`/`remain_qty`/`act_reg_qty`/`act_ot_qty` zijn **TASKRSRC**-kolommen; die las `xerResourceAssignments.ts` op #169 al. De §4.1-whitelist gaat over TASK, en plan §4.1 "Opgeslagen werk" voorziet precies deze TASKRSRC-overname |

Regel A (`measure:profiles` met corpus, achter de flock, exit 0):
`P6 NULDOEL (regel A gehouden) — zesassige afwijkingen 76 … uitgesloten 42 taken in 3 projecten`;
MS Project mpp-fidelity GROEN, 2196 checks, GOAL_ZERO-rood 0 (216 gepind, 0 verbeterd/0 verslechterd).

```
CELLDELTA p6 nieuw=0 verslechterd=0 groter=0 verbeterd=0 kleiner=0 onmeetbaar=0 onbekend=0 ongemeten=0 schuld=0 totaal=221 uitgesloten=0 teruggekeerd=0
```

## Wat baan 2 moet doen

`settleDurationAftermath` (`src/engine/work/workRuleApply.ts`, TODO staat erop) is de ene plek voor
store, raster en MCP (`afterTriangleDurationChange`). Drie stappen:
1. De basis vastleggen vóór de driehoekstap, `hourInputFinishBasis` vóór `applyTriangleResult`. Dat
   vraagt een kleine API-wijziging: de aanroepers geven de basis mee, of de capture neemt hem op.
2. `clearLevelingGaps` aanroepen. Vandaag doen `assignResource`/`unassignResource`/`moveAssignment` dat
   zelf, maar `updateAssignment`/`setAssignmentWork`, het assignment-set-pad van het raster en de
   MCP-toewijzingstools niet.
3. Daarna `reconcileHourInputFinish` op de taakkalender.

Nieuwe cases in `check-work-rule-store`:
- Een niet-gestarte urentaak onder FIXED_WORK, inzet ×2 via store, raster en MCP ⇒ `scheduleFinish` =
  start + nieuwe duur.
- Een genivelleerde taak ⇒ gaten weg.

Mutatiebewijs: haal de reconcile weg ⇒ rood.

Daarnaast nog uit te zoeken: de volgorde in `taskEditPlan.ts` (Δ-rest vóór reconcile) en
`projectSlice.setProjectCalendar` (zijn automatisch samengevoegd, niet apart getoetst).

## Eigenaarsvragen, concreter gemaakt

- **E1 (gedrag van importen):** ongewijzigd. De browserspec `work-rule` laat het gedrag zien. Nog
  gebruikstest nodig.
- **E2 (P6-XML-labels):** na de merge staat de labelwissel van #101 op #169
  (`p6xmlReader.ts:132-133`: "Fixed Duration and Units" → `DT_FixedDUR2`). `check-xer-p6xml-parity` is
  groen. De bron is niet opnieuw nagelopen.
- **E3 (XER-werkvelden):** niet aangeraakt. Het corpuscijfer van het dossier (14.293/62.028) geldt nog.
- **E4 (meldingen bij openen):** nu voorlopig opgelost met een detailregel in de bestandsmelding voor
  XER en `.mpp` (die hebben een profielmelding). MSPDI, P6-XML en CSV (ops-voorstel, dus geen
  bestandsmelding) houden de losse melding van #101. De vraag aan de eigenaar wordt daarmee: "is een
  detailregel genoeg, of moet de ontsluiting uit importvelden helemaal stil zijn?"
- **E5 (UI-vorm):** de instelling staat nu op Planning, maar nog met een `scrollzoom-hint`-bijschrift,
  en "Beschermd: …" is ongewijzigd. Omzetten naar een gekleurd blok hoort in baan 5.
- **E6 (nieuw, conventiegrens):** mogen de drie lezingen in `src/engine/work/` (hierboven, met
  regelnummers) als datagate herpind worden (`--write-baseline`: `p6DurationType` 6→7, `mspTaskType`
  1→4)? Of moet het werkregel-/zichtbaarheidsdeel buiten `src/engine/` (bijv. `src/state/` of
  `src/services/`)? Advies: herpinnen met een eigenaarsbesluit, want het is bewerksemantiek en geen
  solverinvoer, en de solver leest nog altijd niets van #101. Tot dat besluit blijft `npm run verify`
  rood op deze ene check.
