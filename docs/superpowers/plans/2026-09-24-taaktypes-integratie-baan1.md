# Integratieverslag — PR #101 (taaktypes) op #169, baan 1

*2026-09-24, `uitvoerder-opus-midden` (Claude Opus 5.5). Branch `claude/taaktypes-integratie`, kop
`5df3bff7` (gepusht; eerste oplevering `aa0914db`, daarna de critreviewfixes — zie "Critreviewfixes"), gebouwd op `origin/claude/rekenprofielen` `c2173141` + merge van
`origin/claude/contour-engine-planner-mnrsy3` `c5fca94a`. Dossier: `2026-09-24-verkenning-pr101-taaktypes.md`.*

## In gewone woorden

PR #101 zit nu in de rekenprofielen-branch, als echte merge (de historie blijft staan). Alle 29
conflictbestanden zijn opgelost zoals het dossier voorstelde, en de twee valkuilen zijn gedicht en met
checks vastgelegd. De meetlat is onveranderd: nul nieuwe of slechtere cellen, en MS Project-getrouwheid
blijft op nul afwijkingen. Na de critreview zijn vijf punten gedicht: de herkomstlezingen staan niet
meer in de motor (conventiegrens weer groen), een XER-import verandert het histogram niet meer bij
gewoon verricht werk, de gids blijft vindbaar vanuit de bestandsmelding, en er is een rastercheck
bij. Alle poorten staan nu groen.

**Rechtzetting.** De eerste versie van dit verslag zei bij E3 "niet aangeraakt" en impliceerde dat het
importgedrag verder ongewijzigd was. Dat klopte niet: sinds #101 kreeg elke XER-toewijzing met
verricht werk alle drie de werkvelden, en daarmee veranderden histogram, overallocatie en nivelleerder
(laag 3 in plaats van laag 4). Zie "Critreviewfixes", E3.

## Commits

| sha | wat |
|---|---|
| `02e5a295` | merge-commit (29 conflicten, API 1.3.0, `contourKeepsWork` in de bouwer, instelling naar Planning, tekstrollen, compileerfix, TODO baan 2) |
| `ca4dee6f` | checks voor de twee valkuilen (`check-hour-input-finish` 38–42) |
| `aa0914db` | melding over ontsloten taaktypes als detailregel in de ene bestandsmelding (T4-17 hersteld, nieuwe check T4-18b) |
| `350646b2` | merge `origin/claude/rekenprofielen` `c11754cf` (herstelt `check-conventions-boundary` 13/13a) |
| `b80edb2f` | E6: herkomstlezingen van de bewerkregels uit de motor verhuisd |
| `d1b475c6` | E3: verricht werk zonder afwijking bewaart alleen `actualWorkMinutes` |
| `924cccb5` | gidslink: de ontsluitdetailregel noemt de gids (T4-18c) |
| `5df3bff7` | gridcheck: kalenderwissel via de gesplitste rasterroute (check 43) |

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
| `verify:conventions` (eerste oplevering, historisch) | 1 | Datagates: `p6DurationType` 7 tegen 6 gepind (+1), `mspTaskType` 4 tegen 1 gepind (+3). De nieuwe lezingen staan in `src/engine/work/taskTypesVisibility.ts:21` (`mspTaskType` en `p6DurationType`, "draagt het document taaktypedata"), `src/engine/work/workRuleApply.ts:50` (`effectiveEffortDriven`: alleen met MSP-herkomst telt `effortDriven`) en `:254` (`contourKeepsWork`, terugval op `mspTaskType === 'FIXED_WORK'`). Alle drie horen bij bewerksemantiek en de zichtbaarheidsregel, niet bij de solver. De poort is **niet** aangepast; zie E6 |
| `bash tests/planning/run.sh` (zonder corpus, eerste oplevering, historisch) | 1 | Alleen `check-conventions-boundary` is rood: 01 (dezelfde datagate als hierboven), plus 13/13a. **13/13a waren al rood op `c2173141`**: in een losse worktree op die kop nagemeten, "2 van 65 rood", allowlist-rapport voor `legacyP6Source.ts`. Die twee komen dus niet uit de merge. De andere batterijen, inclusief de mpp-fidelity, zijn groen |
| `npm run test:mcp` | 0 | |
| `npm run test:library` | 0 | |
| browser: `work-rule` + `contour-dialog` + `scheduling-profile` | 0 | 9/9, gedraaid voor én na de meldingfix |
| `check-xer-field-whitelist` | 0 | **340 checks mét corpus** (338 zonder corpus; de eerste versie noemde 338 zonder dat onderscheid). `duration_type` is TASK-bak 1. `target_qty`/`remain_qty`/`act_reg_qty`/`act_ot_qty` zijn **TASKRSRC**-kolommen; die las `xerResourceAssignments.ts` op #169 al. De §4.1-whitelist gaat over TASK, en plan §4.1 "Opgeslagen werk" voorziet precies deze TASKRSRC-overname |

Regel A (`measure:profiles` met corpus, achter de flock, exit 0):
`P6 NULDOEL (regel A gehouden) — zesassige afwijkingen 76 … uitgesloten 42 taken in 3 projecten`;
MS Project mpp-fidelity GROEN, 2196 checks, GOAL_ZERO-rood 0 (216 gepind, 0 verbeterd/0 verslechterd).

```
CELLDELTA p6 nieuw=0 verslechterd=0 groter=0 verbeterd=0 kleiner=0 onmeetbaar=0 onbekend=0 ongemeten=0 schuld=0 totaal=221 uitgesloten=0 teruggekeerd=0
```

## Critreviewfixes (kop `5df3bff7`)

**E6 — verhuisd (optie b, orkestratorbesluit onder regel B).** De lezing van `mspTaskType`/
`p6DurationType` is per-taak-herkomst van bewaarde data, geen conventie. `taskTypesVisibility.ts`
staat nu in `src/state/` (afnemers: `documentContract.ts`, `TaskWorkRuleField`,
`TaskAssignmentsSection`, `check-work-rule-store`); `contourKeepsWork` en `effectiveEffortDriven` staan
in `src/utils/taskDefaults.ts` (dat importeert alleen `ruleProtectsWork` uit het pure
`engine/work/workTriangle.ts`, geen cyclus). Datagates terug op de pin: `p6DurationType` 6,
`mspTaskType` 1 — geen herpin nodig. `verify:conventions`/`verify:cycles`/`verify:store-boundaries` 0.
Geen gedragswijziging: `check-work-rule-store`, `check-work-rule-mapping`, `check-hour-input-finish`,
`check-document-contract` groen. Gids taaktypes nl+en: effort-driven is een formaatafhankelijke
bewerkregel, de solver leest hem niet. Mutatieproef: een `mspTaskType`-lezing terug in
`workRuleApply.ts` ⇒ `verify:conventions` exit 1 (`mspTaskType` 2 > 1); `contourKeepsWork` op
`FIXED_UNITS` ⇒ `check-work-rule-store` d4 rood.

**E3 — code volgt de spec.** Spec §4.3 (geval c: "bij import wanneer de bron een waarde levert die van
de afleiding afwijkt") en §4.4 (XER: "alleen wanneer `target_qty` afwijkt van duur ×
`target_qty_per_hr`"). `importedWorkFields` bewaart bij verricht werk zonder afwijking nu alléén
`actualWorkMinutes`; begroot/rest (het drietal) alleen bij een echte afwijking. Het verwachte restant
is `(begroot ?? afleiding) − verricht`. De MSPDI-writer leidt `<Work>` af wanneer er geen restwerk is
(anders kromp `<Work>` tot het verrichte deel). Checks: `check-work-rule-mapping` a13/a13b–d, c5b/c9,
e4–e7 (e5: XER-toewijzing met verricht werk zonder afwijking ⇒ `assignmentDayUnits` byte-identiek aan
dezelfde toewijzing zonder werkvelden, laag 4; e7: mét afwijkend restant ⇒ laag 3, totaal 60 u).
Mutatieproef: oude regel terug ⇒ a13, a13d, e4, e5 rood; "nooit het drietal" ⇒ a12, a13b, a14, a16,
c7, d7, e2, e6, e7 rood; oude MSPDI-writer ⇒ c9 rood.

Hermeting (histogram per toewijzing met vs. zonder werkvelden; eigen meetscript, mpd = effectieve
taakkalender):

| bestand | toewijzingen | met werkveld | laag 3 vóór → ná | histogram anders vóór → ná | eenheid-dagen anders vóór → ná |
|---|---|---|---|---|---|
| Roads_Project_TEC | 3575 | 158 | 158 → 35 | 158 → 35 | 793 → 196 (Σ\|Δ\| 793 → 526) |
| HarbourPointe_AssistedLiving | 417 | 121 | 121 → 119 | 119 → 119 | 20.564 → 20.564 (Σ\|Δ\| 571) |

De critreview mat 110 resp. 119 (andere meetopzet); het beeld is hetzelfde. Wat overblijft is een
echte afwijking: een relatieve tolerantie van 1 % (dossieradvies) verandert op beide bestanden niets
(nagemeten, niet ingebouwd). **Correctie her-check (Opus 5.5, 24-09):** HarbourPointe heeft géén
"structureel herschat restwerk". De lezer op het echte bestand geeft 121 toewijzingen met werkveld: 97 bij
niet-gestarte taken waar `target_qty ≠ duur × target_qty_per_hr` en `remain_qty = target_qty` (bv. EC2370:
336 u × 0,2679/u = 90 u, `target_qty` 30; EC2240: 1272 u × 0,2358 = 300 u, `target_qty` 100) — geen
herschatting maar afwijkend begroot werk; 17 bij voltooide taken over budget (bv. EC1090 verricht 495 u
tegen begroot 480 u); 5 echte herschattingen op lopende taken (bv. 76517: begroot 240, verricht 215,
restant 20 i.p.v. 25); 2 alleen verricht (laag 4). Laag 3 is er volgens spec §4.4 terecht (P6's
`target_qty` is de waarheid), maar bij die 97 blijft `unitsPerDay × duur` (90 u) oneens met het opgeslagen
werk (30 u): het histogram toont 30 u terwijl de inzetkolom iets anders suggereert — vermoedelijk een
afwijkende resourcekalender, niet uitgezocht. **Eigenaarsvraag E7** (zie §Eigenaarsvragen).

*Terugdraaien als de eigenaar toch "ook bij verricht werk" wil (E3 blijft eigenaarsvraag):* in
`importedWorkFields` de regel `if (!plannedDeviates && !remainingDeviates) return actualPresent ?
{ actualWorkMinutes: actual } : {};` terug naar `if (!plannedDeviates && !actualPresent &&
!remainingDeviates) return {};`, en de checks a13/a13c/a13d/e4/e5 terugzetten. De MSPDI-writerfix en
de nieuwe `expectedRemaining` mogen blijven (die zijn in beide lezingen juist).

**Gidslink.** Een detailregel heeft geen eigen `helpArticleId`; de melding houdt die van het bestand/
profiel. Nieuwe sleutel `notifications.taskTypesUnlockedDetail` (14 locales) noemt de gids bij naam
("Help → Taaktypes en werk", de manifesttitel per locale) — zelfde patroon als
`withSchedulingProfileNotice`. T4-18b volgt de sleutel; nieuw T4-18c eist de manifesttitel in alle 14
locales. Mutatieproef: oude sleutel ⇒ T4-18b en T4-18c rood.

**Gridcheck.** `check-hour-input-finish` 43: urentaak met nivelleergat, kalenderwissel via
`runGridMutation` (de eigen kalenderstap in `gridTransaction.ts`) ⇒ gat gewist, einde op de nieuwe
kalender (12:00). Mutatieproef: `'task-schedule'` uit `LEVELING_GAP_ROUTES` ⇒ 43 rood;
`reconcileGridInputFinish` overgeslagen ⇒ 10 en 43 rood.

**Poorten na de fixes (exitcode):** `typecheck` 0, `lint` 0; alle `verify:*` los 0 (examples, docs,
i18n, release-highlights, release-highlights-json, store-boundaries, **conventions**, gantt-boundaries,
cycles, text-roles); `bash tests/planning/run.sh` zonder corpus **0**; `test:mcp` 0 (42/0);
`test:library` 0; mpp-fidelity 216 ongewijzigd/0/0, 2196 checks; `check-xer-product-fidelity-x12` mét
corpus exit 1 op precies de drie nuldoelregels (76, by design); `measure:profiles` exit 0 — P6 76,
CELLDELTA 0 overal, uitgesloten 42 taken in 3 projecten, MSP GROEN; browser `work-rule` +
`contour-dialog` + `scheduling-profile` 9/9.

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

- **E7 (uit de her-check baan 1):** bij 97 niet-gestarte HarbourPointe-toewijzingen wijkt P6's begrote werk
  (`target_qty`) af van duur × inzet. Het histogram volgt het begrote werk (laag 3), de inzetkolom toont de
  P6-inzet. Wat moet de gebruiker zien: de inzet uit P6 (en het werk als afgeleide), het werk uit P6 (en de
  inzet als afgeleide), of beide met een markering "wijkt af"? Advies: beide tonen, werk leidend voor het
  histogram (zoals nu), en de oorzaak (resourcekalender?) eerst meten vóór een keuze.

- **E1 (gedrag van importen):** ongewijzigd. De browserspec `work-rule` laat het gedrag zien. Nog
  gebruikstest nodig.
- **E2 (P6-XML-labels):** na de merge staat de labelwissel van #101 op #169
  (`p6xmlReader.ts:132-133`: "Fixed Duration and Units" → `DT_FixedDUR2`). `check-xer-p6xml-parity` is
  groen. De bron is niet opnieuw nagelopen.
- **E3 (XER-werkvelden):** code volgt nu de spec ("alleen bij afwijking"; verricht werk alleen als
  `actualWorkMinutes`) — zie "Critreviewfixes". Omkeerbaar; de vraag aan de eigenaar blijft of hij
  "ook bij verricht werk" (het #101-gedrag) wil. Het corpuscijfer van het dossier (14.293/62.028) is
  daarmee achterhaald; alleen Roads en HarbourPointe zijn opnieuw gemeten.
- **E4 (meldingen bij openen):** nu voorlopig opgelost met een detailregel in de bestandsmelding voor
  XER en `.mpp` (die hebben een profielmelding). MSPDI, P6-XML en CSV (ops-voorstel, dus geen
  bestandsmelding) houden de losse melding van #101. De vraag aan de eigenaar wordt daarmee: "is een
  detailregel genoeg, of moet de ontsluiting uit importvelden helemaal stil zijn?"
- **E5 (UI-vorm):** de instelling staat nu op Planning, maar nog met een `scrollzoom-hint`-bijschrift,
  en "Beschermd: …" is ongewijzigd. Omzetten naar een gekleurd blok hoort in baan 5.
- **E6 (nieuw, conventiegrens) — AFGEHANDELD** (optie b, verhuisd; zie "Critreviewfixes"). Oorspronkelijke vraag: mogen de drie lezingen in `src/engine/work/` (hierboven, met
  regelnummers) als datagate herpind worden (`--write-baseline`: `p6DurationType` 6→7, `mspTaskType`
  1→4)? Of moet het werkregel-/zichtbaarheidsdeel buiten `src/engine/` (bijv. `src/state/` of
  `src/services/`)? Advies: herpinnen met een eigenaarsbesluit, want het is bewerksemantiek en geen
  solverinvoer, en de solver leest nog altijd niets van #101. Tot dat besluit blijft `npm run verify`
  rood op deze ene check.

## Baan 2 — de B1-koppeling (Claude Opus 5.5, `uitvoerder-opus-midden`, 2026-09-24)

Kort: onder Vast werk en Vaste inzet kan de duur van een taak ook veranderen doordat je inzet of werk
aanpast, of een resource toevoegt of weghaalt. Daarna bleef bij een taak in uren het ingevoerde einde
op de oude waarde staan, en bleef een nivelleerpauze op een verkeerde plek staan. Dat is nu op één
plek opgelost. Elk pad (paneel, raster, AI-assistent) heeft een eigen test die rood wordt zonder de fix.

Kop `claude/taaktypes-integratie`: **`5484532c`** (gepusht; basis `5df3bff7`). De fix zelf staat in `6a64de67`; `5484532c` is alleen de commentaarcorrectie in `workRuleMapping.ts` (`importedWorkFields`: "duur × inzet" in plaats van "restduur × inzet"), op verzoek van de orkestrator.

**Oplossing.** `settleDurationAftermath(task, deps, oldWorkMinutes, finishBasis)`: de basis
(`hourInputFinishBasis` van VÓÓR de bewerking) is een **verplichte** vierde parameter. Een aanroeper
die hem vergeet, compileert dus niet. Na contour/Z8/walks volgen `clearLevelingGaps` en daarna
`reconcileHourInputFinish` op de effectieve taakkalender, in dezelfde volgorde als `updateTask`. De
basis staat daarnaast in `CapturedTriangle.finishBasis` (raster) en `CalendarCapture.finishBasis`.
De TODO in de code en het B1c-koppelpunt in `docs/TODO.md` zijn afgevinkt.

**Inventaris: alle paden waar de driehoek de duur zet.**
- Store (`resourceSlice`): `removeResource`, `assignResource`, `updateAssignment`,
  `setAssignmentWork`, `unassignResource`, `moveAssignment` (oude en nieuwe taak). Dat zijn 7
  aanroepen; elk legt de basis vast naast `oldWorkMinutes`, vóór de mutatie.
- MCP (`createMcpTransactions`, via `afterTriangleDurationChange`): dezelfde 7 tweelingen. Een
  grep op beide bestanden geeft regel voor regel dezelfde structuur. De tools erachter zijn
  `planner_manage_assignments` en `planner_manage_resources`.
- Raster (`gridTransaction.applyAssignmentSet`): inzet/resources via `settleAssignmentPlan` en de kolom
  Resterend werk via `settleWorkEdit`. Beide gebruiken `triangle.finishBasis` van vóór het plan.
- Kalender (`settleCalendarChange`, zes aanroepers): slaat uurtaken over, dus de reconcile is daar een
  no-op. **Wel nieuw gedrag:** verandert de werkregel bij een kalender(inhoud)wissel de duur van een
  dagtaak, dan vervalt nu ook het nivelleergat (check s4). Bij `setTaskCalendar`/`updateTask` gebeurde
  dat al; bij `updateCalendar`/`setProjectCalendar` is het nieuw. Dit volgt uit "duurwijziging ⇒ gat
  weg". Bij een kalenderwissel zonder duurwijziging (standaardregel, s5) blijft het gat staan, zoals
  voorheen.
- Extensie-API `data.*`: heeft geen schrijfpad voor toewijzingen (alleen `getAssignments`).
  `updateTask({workRule})` loopt via `settleRuleChange`, die de duur niet verandert. Er valt dus niets
  te koppelen.
- `taskSlice.updateTask`/MCP `updateTask*`: een duur via `settleDurationEdit` loopt niet door
  `settleDurationAftermath`. Die paden hadden de reconcile en `clearLevelingGaps` al.

**Mutatieproef** (`check-hour-input-finish.ts` §17, checks 44–60; 63 checks in totaal):
- In `settleDurationAftermath` gaat 45–58 rood (14 checks) bij elk van deze ingrepen: koppeling weg,
  alleen de reconcile weg, alleen `clearLevelingGaps` weg, de volgorde omgedraaid, of de basis van ná
  de bewerking.
- Per pad de basis van ná de bewerking ⇒ precies dat pad rood:
  - store: updateAssignment 45, setAssignmentWork 46, assignResource 47, unassignResource 48,
    removeResource 49, moveAssignment (oud of nieuw) 50;
  - raster: 51 en 52;
  - MCP: updateAssignment 53, setAssignmentWork 54, assignResource 55, unassignResource 56,
    removeResource 57, moveAssignment (oud of nieuw) 58.
- 59 (gestarte urentaak houdt haar einde) en 60 (standaardregel byte-identiek) zijn tegenproeven.
- §18, check 61: `applyOpenedImport` (IFC-rondgang, `recompute: true`) laat een incoherent bron-einde
  van een Vast-werk-urentaak staan. Laden loopt dus niet door de koppeling.
- `check-work-rule-store.ts` (s1–s5): zonder `clearLevelingGaps` gaan s1, s3 en s4 rood; s2 en s5
  zijn de tegenproeven.

**Poorten (exitcode), allemaal 0:**
- typecheck, lint, verify:conventions, verify:cycles, verify:docs, verify:i18n;
- `bash tests/planning/run.sh` corpusloos;
- `npm run test:mcp` (42/0);
- mét corpus `check-mpp-fidelity`: 216 ongewijzigd / 0 verbeterd / 0 verslechterd, 2196 checks;
- `flock … npm run measure:profiles`: P6 76 zesassige afwijkingen, cel-delta overal 0, "regel A
  gehouden". De P6-regel eindigt bewust met exit 1: het nuldoel is by design niet gehaald;
- browserspecs `work-rule` + `contour-dialog` (4/4).

**Docs.** Het docblok in `taskDefaults.ts` heeft een lijst van paden die het einde WEL herleiden,
inclusief de werkdriehoek. De gidsen `gids-taaktypes` (nieuw punt onder "Wat u moet weten") en
`gids-rekenprofielen` ("… of als de werkregel de duur verandert …") zijn bijgewerkt in nl en en.

**Voor de orkestrator.** `removeResource` wist nivelleergaten alleen als de duur verandert. Zonder
duurwijziging gebeurde dat al niet vóór deze baan (assign/unassign/move wissen ze wél altijd). Dit
bestond al en valt buiten de opdracht; het is niet aangepast.
