# Rekenprofielen — één solver, benoemde conventies, profielen per project

*Ontwerp, 2026-09-22. Status: besproken met de eigenaar (vragen 1–7 hieronder beantwoord), wordt
uitgevoerd vóór het X12-vervolg. Bijlage A (de conventietabel) is de inventaris van de motor op de
kop van `claude/file-formats-support-phase-3-a0ebe2` ná de merge van main (`c2284cf6`).*

## 1. Waarom

Bij elke formaat-etappe (`.mpp`, XER, straks PMXML/PP) kwam dezelfde vraag terug: "moeten we dit
in de solver doen? Dan rekent het raar voor wie MS Project gewend is." Eén gedeelde motor, drie
scholen (Primavera P6, MS Project, en wat OPS zelf tot nu toe deed), en elke etappe moest kiezen
wiens gedrag de motor krijgt. De huidige uitweg is een vlag — `schedulingOptions.p6Source === 'XER'`,
fail-closed — waarachter P6-takken schuilen. Dat werkt, maar elke nieuwe pakketregel is opnieuw een
vraag aan de eigenaar, en het antwoord landt als een `if` op het bronformaat. Voorbeelden uit de
XER-etappe: echte totale speling op voltooide activiteiten (7a), het projecteinde als anker van de
late kant, de sameday-conventie, `lagCalendar`, longest-path-kritiek.

Dit ontwerp haalt die keuze uit de motor. De solver kent geen bestandsformaten meer, alleen
**conventies**; een **profiel** is een benoemde set waarden voor alle conventies; elk project heeft
precies één profiel. "Moeten we dit in de solver doen?" wordt "welke conventie is dit, en wat is de
waarde per profiel?" — een tabelrij, geen compromis.

## 2. Besluiten van de eigenaar (2026-09-22)

| # | vraag | besluit |
|---|---|---|
| 1 | welke compromissen | de conventiekeuzes in de gedeelde motor (P6 vs MS Project vs OPS) |
| 2 | wie bepaalt de conventie | de gebruiker, als één profielkeuze per project — mét eigen profielen met eigen waarden; het bronbestand stelt voor |
| 3 | waar leeft een profiel | volledige opgeloste waarden in het IFC + profielnaam als herkomst; eigen profielen app-globaal |
| 4 | OPS-profiel | bewuste keuze van de eigenaar, te nemen ná X12; tot dan = "wat OPS vandaag doet", byte-identiek |
| 5 | regel A (landingsregel) | een motorwijziging landt alleen als onder elk profiel met orakel geen enkele cel die exact was inexact wordt — per cel, niet per som; en een conventie die per profiel verschilt is altijd een benoemde instelling (regel B), nooit een `if` op het formaat |
| 6 | volgorde | eerst het volledige profielsysteem (incl. eigen profielen), daarna X12 eronder, daarna de OPS-inhoud |
| 7 | openen van een bestand | automatisch het bronprofiel, met één melding die zegt waar je het aanpast; geen dialoog |

"Geen pinnen met reden" (plan XER §6, X12) blijft onverkort: binnen een profiel is nul nul; het
referentiepakket is per profiel (P6-profiel ⇒ P6 is het orakel, MS Project-profiel ⇒ MS Project).

## 3. Datamodel

### 3.1 Conventieregister

`src/engine/scheduler/conventions/registry.ts` — één descriptor per conventie:

```ts
interface ConventionDescriptor<V> {
  id: ConventionId;                 // stabiele sleutel, ook de IFC-sleutel
  kind: 'choice' | 'boolean' | 'number';
  values?: readonly V[];            // bij 'choice'
  range?: { min: number; max: number };   // bij 'number'
  builtIn: { p6: V; msproject: V; ops: V };
  labelKey: string;                 // i18n, `conventions.<id>.label` / `.help` (namespace common)
  since: string;                    // ISO-datum van introductie
}
```

`SchedulingConventions` is het opgeloste type (`{ [id]: waarde }`), afgeleid uit het register.
De bestaande `SchedulingOptions`-velden (`lagCalendar`, `totalFloatMode`, `makeOpenEndedCritical`,
`nearCriticalThreshold`, `floatPaths`, `resumeFromActualElapsed`, `unstartedIgnoresStatusDate`,
en de `p6*`-velden) worden conventies in dít register; er blijven geen twee systemen naast elkaar.
Het register is de enige bron: UI, IFC-lezer/-schrijver, gids-tabel en poorten lopen erover.

### 3.2 Profiel

```ts
interface SchedulingProfile {
  baseId: 'p6' | 'msproject' | 'ops';   // ingebouwde basis
  id: string;                            // 'p6' | 'msproject' | 'ops' | eigen id (nanoid)
  name: string;                          // weergavenaam; ingebouwd ⇒ i18n
  overrides: Partial<SchedulingConventions>;  // alleen afwijkingen van de basis
}
```

`resolveConventions(profile)` = basiswaarden uit het register + overrides. De opgeloste set staat
nooit dubbel in de state; de solver krijgt uitsluitend het opgeloste object.

- **Project**: `project.schedulingProfile: SchedulingProfile` (documentveld, `DOCUMENT_FIELDS`,
  snapshot-rol `clone`, undo-baar). Vervangt `project.schedulingOptions` — de migratie staat in §3.4.
- **Eigen profielen**: app-globaal, niet per document geswapt; persistentie `ops-schedulingProfiles`
  via `settingsStore`/`settingsRegistry` (JSON-lijst van `SchedulingProfile`). Een eigen profiel is
  klein (alleen overrides) en hoort niet in de bibliotheekopslag.

### 3.3 IFC-round-trip

Pset `OPS_SchedulingProfile` op het `IfcProject`:

- `ProfileId`, `ProfileName`, `BaseId`;
- per conventie één property met de **opgeloste** waarde (niet alleen de override), zodat een
  bestand overal identiek rekent, ook waar het eigen profiel ontbreekt.

Lezen via `sanitizeSchedulingProfile` (opvolger van `sanitizeSchedulingOptions`): onbekende sleutel ⇒
genegeerd; ongeldige waarde ⇒ waarde van de basis; ontbrekende basis ⇒ `ops`. Bij het openen wordt
`overrides` herleid als verschil tussen de gelezen waarden en de basis, zodat de state compact
blijft en een aanwezig eigen profiel met dezelfde naam níét stil de bestandswaarden overschrijft
(de bestandswaarden winnen; de UI toont "wijkt af van het opgeslagen profiel" zodra ze verschillen).
De oude pset `OPS_SchedulingOptions` wordt nog gelezen (§3.4) en niet meer geschreven.

### 3.4 Migratie (byte-identiek in rekenresultaat)

| bestand | profiel na openen |
|---|---|
| geen `OPS_SchedulingProfile`, geen `OPS_SchedulingOptions` | `ops` zonder overrides |
| alleen `OPS_SchedulingOptions` zonder `p6Source` | `ops` met de gelezen opties als overrides |
| `OPS_SchedulingOptions` met `p6Source: 'XER'` | `p6` met de overige gelezen opties als overrides |
| `OPS_SchedulingProfile` | zoals gelezen |

De corpusloze planningssuite bewijst dat elk bestaand fixture identiek rekent; X12 en
`check-mpp-fidelity` bewijzen het op de corpora (§5).

## 4. De motor

- `CPMSolver`, `solveProject`, `applyCpmResult`, `recordedDates`, `p6Completed*`, `p6OpenLoe*`,
  `ResourceLoad`/`ResourceLeveler` krijgen `conventions: SchedulingConventions` en lezen uitsluitend
  daaruit. Elke `p6Source === 'XER'`-tak wordt een conventie met `p6: aan, msproject: uit, ops: uit`
  (= vandaag). Bijlage A is de volledige lijst; elke rij daar wordt één conventie of wordt expliciet
  als "geen conventie, blijft hard" gemotiveerd.
- De ombouw is **gedragsbehoudend**: ná de refactor X12 exact 15.056 (P6-profiel), `check-mpp-fidelity`
  exact 216 ongewijzigd (MS Project-profiel), corpusloze suite groen (OPS). Dat is het bewijs dat er
  alleen verplaatst is.
- Nieuwe mechanische poort `npm run verify:conventions` (in `verify`): AST-scan dat `src/engine/`
  nergens `p6Source`, `importFormat`, `readFormat`, `mspTaskType`-als-formaatdetectie of een
  lezer-module importeert of leest om rekengedrag te sturen; alleen `conventions.<id>`. Zelfde patroon
  als `verify:store-boundaries`. `p6Source` verdwijnt als veld; taakvelden uit een import
  (`p6ActivityType`, `mspTaskType`) blijven data over de taak en mogen gelezen worden — zij zeggen
  wat de taak ís, niet uit welk pakket het bestand komt.

## 5. Regel A als poort

- **Cel-baseline**: `tests/planning/xer-product-fidelity-cells.json` — per corpusbestand, per as, de
  gesorteerde lijst van taak-id's die **niet** exact zijn (nu ±15k). Een cel die exact was en inexact
  wordt is een nieuwe id in die lijst ⇒ rood. Verdwijnende id's zijn groen; herpinnen mag alleen
  omlaag (de poort weigert een baseline met méér id's dan de meting). Zelfde vorm voor het
  `.mpp`-corpus: `mpp-fidelity-cells.json` (start/einde per taak; later zes assen).
- `npm run measure:profiles`: één script dat X12 onder het P6-profiel, mpp-fidelity onder het
  MS Project-profiel en de corpusloze suite voor OPS draait en per profiel `exit` én de cel-delta
  rapporteert. Dit is de landingspoort voor elke motorwijziging; corpus blijft buiten de repo, CI
  blijft corpusloos, de cel-baselines zijn gecommit.
- **Goal prompt**: `docs/superpowers/plans/2026-09-22-goalprompt-x12-naar-nul.md` — de opdrachttekst
  voor het X12-vervolg met regel A (per cel, elk profiel, `measure:profiles` vóór elke commit) en
  regel B (verschil per profiel ⇒ conventie in het register, nooit een `if` op het formaat).

## 6. Wat de gebruiker ziet

- **Openen**: XER ⇒ P6; `.mpp`/MSPDI ⇒ MS Project; CSV, nieuw project en IFC uit een ander pakket ⇒
  OPS; eigen IFC ⇒ wat erin staat. `ImportResult.suggestedProfileId` komt uit de lezer via
  `formatRegistry`. Eén melding via het K8a-kanaal: "Dit project rekent als Primavera P6 — aanpassen
  via Bestand → Projectinfo → Rekenprofiel", met de bestaande `helpArticleId`-link naar de gids en een
  actie die Backstage → Projectinfo opent. Geen dialoog.
- **Kiezen**: keuzelijst *Rekenprofiel* in de projectwizard (`ProjectInfoDialog`) en op
  Backstage → Projectinfo. Wisselen = `markScheduleStale` + de gewone herbereken-flow; in "datums
  zoals opgeslagen" verlaat het de modus, net als F5.
- **Eigen profiel**: één gedeeld paneel *Rekenprofiel* (`SettingsPanelContent`, dus op alle drie de
  instellingenplekken) toont elke conventie uit het register met naam, uitleg en de waarde in het
  huidige profiel. Een waarde wijzigen op een ingebouwd profiel maakt automatisch een eigen profiel
  "Kopie van P6" (hernoembaar) en koppelt het project eraan; verwijderen kan alleen als geen open
  document het gebruikt. Geen import/export van profielen (YAGNI: het IFC draagt de waarden al).
- **Docs**: gids `gids-rekenprofielen.md` (nl+en, manifest-entry) met de conventietabel in
  mensentaal; `gids-xer-import`/`gids-msproject-import`/`gids-import-export` verwijzen ernaar;
  CLAUDE.md krijgt een sectie *Rekenprofielen*; `docs/recepten/conventie.md` beschrijft hoe je een
  conventie toevoegt (register-rij, drie waarden, i18n, gidsregel, poort).
- i18n: `conventions.<id>.label/.help`, `profiles.builtIn.*`, `notifications.schedulingProfileApplied`
  in alle 14 locales (`verify:i18n`).

## 7. Tests

- `tests/planning/check-conventions-registry.ts`: elke conventie heeft drie ingebouwde waarden binnen
  `values`/`range`, unieke id's, i18n-sleutels aanwezig; `resolveConventions` met/zonder overrides.
- `check-scheduling-profile-roundtrip.ts`: IFC schrijven/lezen voor de drie ingebouwde en een eigen
  profiel; de vier migratierijen uit §3.4; `sanitize` op vijandige waarden; documentcontract
  (`check-document-contract.ts` breidt uit).
- Gedragsbehoud: bestaande suites ongewijzigd groen; X12 15.056 en mpp 216 exact (mét corpus, in de
  etappe gemeten en in het commitbericht).
- `verify:conventions`-poort met een mutant (een `p6Source`-lezing in `src/engine/` ⇒ rood).
- Browser: `tests/browser/scheduling-profile.spec.ts` — XER openen toont de melding met de link, de
  keuzelijst wisselt naar MS Project en herberekent, een waarde wijzigen maakt "Kopie van …".
- Cel-baseline: `check-xer-product-fidelity-x12.ts` krijgt de cel-vergelijking erbij; mutatiebewijs:
  één id toevoegen aan de meting ⇒ rood, één weghalen ⇒ groen.

## 8. Buiten scope

De inhoud van het OPS-profiel (eigenaar, ná X12); driving path als zevende as; dossier 7b-4; het
X12-restant zelf; `recorded-all-formats` (aparte PR); import/export van profielen; profielen per
taak.

## 9. Volgorde binnen de etappe

1. Register + `SchedulingProfile` + migratie + solverombouw, gedragsbehoudend (poorten exact gelijk).
2. Cel-baselines + `measure:profiles` + `verify:conventions`.
3. Import-koppeling + melding.
4. UI: keuzelijst, paneel, eigen profielen.
5. Gids, CLAUDE.md, recept, goal prompt.
6. Critreview (Opus) op de hele diff; gebruikstest in de browser met de gids als meetlat.

Branch `claude/rekenprofielen` bovenop `claude/file-formats-support-phase-3-a0ebe2`; PR ná #109 of
gestapeld erop — besluit eigenaar bij aanbieden.

## 3.5 Gevolgen van de inventaris voor het model (2026-09-22, uit bijlage A)

1. **Elf conventies zijn projectdata, geen pakketconstante.** A2–A8, A10, A11, A14, A19 en A21 komen
   per bestand uit `SCHEDOPTIONS`/`PROJECT` (XER) of `CriticalSlackLimit` (MSPDI). Het profiel levert
   daar alleen de **standaard**; de gelezen waarde is een override op de basis. Een profiel dat "de
   P6-waarde" invult overschrijft dus nooit bestandsdata — het model basis + overrides dekt dit, en
   de lezers schrijven hun bestandswaarden in `overrides`.
2. **A7 (`totalFloatMode`) heeft een vierde waarde nodig.** OPS rekent vandaag bij *afwezig* hybride
   (finish-float bij statusdatum + gestarte taak, anders min). Het register krijgt de expliciete
   waarde `'auto'` met precies dat gedrag; het OPS-profiel staat op `'auto'`, P6 op `'finish'`,
   MS Project op `'smallest'`. De UI toont dan wat de solver doet (nu toont hij "smallest").
3. **A6 (`thresholdHours`) mag niet meer wegvallen bij een UI-bewerking**: het paneel bewerkt de
   opgeloste set per conventie, niet `{mode, threshold}` als geheel.
4. **Groep B wordt zeven benoemde conventies** (P6 aan, MS Project/OPS uit): `p6RelationFinishBoundary`
   (B1, inclusief het strippen van `Sequence.p6StartAtPredecessorFinishBoundary` wanneer uit),
   `p6BackwardLagFinishBoundary` (B2), `p6CompletedDataDateWindow` (B3), `p6CompletedLoeActualFinish`
   (B4), `p6OpenLoeTargetSpan` (B5). B6 en B7 zijn taakprovenance resp. lezerwerk en blijven zoals
   ze zijn. `p6Source` verdwijnt als veld; `WorkCalendar.p6Source` (alleen diagnose) blijft.
5. **Groep D blijft hard** in deze etappe. Regel B maakt een regel pas conventie zodra een profiel er
   een andere waarde voor nodig heeft; tot dan is een schakelaar zonder tweede waarde YAGNI. De lijst
   in bijlage A is de kandidatenlijst voor het X12-vervolg en voor de OPS-keuze van de eigenaar.
6. **Groep C blijft taakdata.** `manuallyScheduled`, `levelingDelayMinutes`, timephased-velden,
   `resume`, `mspTaskType` zeggen wat een taak ís; het ontwerp staat het lezen daarvan toe (§4).
7. **Vier aanroepers geven niet alle opties door** (`documentActivation`, `occupancy`, `distribute`,
   `benchmark/runner`): A14 werkt daar niet. Eén helper `solveInputFor(project, …)` levert voortaan
   de volledige set (profiel opgelost + `projectStartDate`/`projectEndDate`) aan élke aanroeper.
8. **`progressMode` blijft een projectveld** naast het profiel (het heeft eigen UI in het lint en een
   MCP-ingang); het profiel levert er wel de standaard voor (P6/OPS: RETAINED_LOGIC; MS Project:
   ONBEKEND ⇒ RETAINED_LOGIC tot een meting anders zegt).
9. **A23-waarschuwing.** Wisselen van MS Project naar P6 op een `.mpp` met een oude statusdatum
   verschuift niet-gestarte taken naar de statusdatum (gemeten: ±8 jaar op
   `calendar-exception-precedence.mpp`). Een profielwissel toont daarom vóór het herberekenen hoeveel
   taken verschuiven (dezelfde telling als de "datums zoals opgeslagen"-strook).

## Bijlage A — conventietabel (inventaris van de motor, 2026-09-22)

*Inventaris door een Opus-5.5-agent op de kop van `claude/rekenprofielen` (= XER-branch ná merge van
main, `16785c73`). Regelnummers indicatief; bestand + functie leidend. Afkortingen: CPM =
`src/engine/scheduler/CPMSolver.ts`, SA = `scheduleAnalysis.ts`, RM = `relationMath.ts`, ACR =
`applyCpmResult.ts`, CRT = `p6CompletedRouteTrace.ts`, OLT = `p6OpenLoeTargetSpanTrace.ts`, CTW =
`src/utils/p6CompletedTargetWindow.ts`, XSO = `src/services/xer/xerScheduleOptions.ts`; RT =
round-tript via `OPS_SchedulingOptions`; UI-CO = `CalcOptionsSection.tsx`.*

### A. Al benoemd in `SchedulingOptions` of als projectveld

| # | Conventie | Waar | Aansturing nu | P6 / MS Project / OPS vandaag | IFC / UI |
|---|---|---|---|---|---|
| A1 | Hoofdschakelaar "P6-semantiek aan" | CPM `p6XerOption`, constructor; SA; CRT; OLT; CTW | `p6Source === 'XER'` | P6 `'XER'` / MSP afwezig / OPS afwezig | RT, geen UI — **vervalt** |
| A2 | Voortgangsmodus retained logic / progress override | CPM | projectveld `progressMode` | P6 uit `sched_retained_logic`/`sched_progress_override` / MSP ONBEKEND / OPS RETAINED_LOGIC | `OPS_ProjectSettings.ProgressMode`; lint-UI; MCP |
| A3 | Kalender waarin de relatie-lag telt | CPM `relDeps.lagEngine`; RM | `lagCalendar` | P6 `sched_calendar_on_relationship_lag` (default predecessor) / MSP ONBEKEND / OPS predecessor | RT, UI-CO |
| A4 | Kritiek: totale speling of longest path | SA | `criticalDefinition.mode` | P6 `critical_path_type` / MSP ONBEKEND / OPS totalFloat | RT, UI-CO |
| A5 | Kritiek-drempel in dagen | SA | `criticalDefinition.threshold` | P6 n.v.t. / MSP `CriticalSlackLimit` (alleen MSPDI) / OPS 0 | RT, UI-CO |
| A6 | Kritiek-drempel in uren, per taak op eigen kalender | SA | `criticalDefinition.thresholdHours` (wint) | P6 `critical_drtn_hr_cnt` / MSP n.v.t. / OPS afwezig | RT; **UI laat hem vallen** |
| A7 | Formule totale speling | SA | `totalFloatMode` | P6 `sched_float_type` (XER-default finish) / MSP smallest / OPS **afwezig = hybride** | RT, UI-CO (toont ten onrechte smallest) |
| A8 | Open eindtaak kritiek | SA | `makeOpenEndedCritical` | P6 `sched_open_critical_flag` (N) / MSP ONBEKEND / OPS uit | RT, UI-CO |
| A9 | Near-critical-drempel | SA | `nearCriticalThreshold` | P6 ONBEKEND / MSP ONBEKEND / OPS uit | RT, UI-CO |
| A10 | Meerdere floatpaden | SA | `floatPaths` | P6 `enable_multiple_longest_path_calc` e.a. / MSP ONBEKEND / OPS uit | RT, UI-CO |
| A11 | Verwachte einddatum begrenst restduur | CPM | `useExpectedFinishDates` + taakvelden `p6ProjectId`/`p6ExpectedFinish`; **niet** achter p6Source | P6 `sched_use_expect_end_flag` (Y) / MSP n.v.t. / OPS uit | RT, geen UI |
| A12 | Bundel "actuals behouden in backward pass" (zes deelgedragingen; poort voor A21, B3, B4) | CPM, SA, CRT, CTW | `preserveActualDatesInBackwardPass`; **niet** achter p6Source | P6 aan / MSP uit / OPS uit | RT, geen UI |
| A13 | Vrije speling nooit negatief | SA | `clampNegativeFreeFloat`; **niet** achter p6Source | P6 aan / MSP ONBEKEND / OPS uit | RT, geen UI |
| A14 | Projecteinddatum als anker van de late pass (+ FF=0 open eindmijlpaal) | CPM, SA | `useProjectEndDateForFloat` + `CPMOptions.projectEndDate`; **niet** achter p6Source | P6 `sched_use_project_end_date_for_float` + `plan_end_date` / MSP ONBEKEND / OPS uit | RT, geen UI; bekende fout (plan §9) |
| A15 | Nulduur-activiteit: geplande kalendergrens is start- of eindgrens (twee deelgedragingen) | CPM, RM | `p6ZeroDurationUsesPlannedBoundary` (achter p6Source) + `p6ActivityType` | P6 aan / MSP uit / OPS uit | RT, geen UI |
| A16 | Geplande start als extra vloer (elke taak met voorganger) | CPM | `p6UseTaskPlannedStartFloor` (achter p6Source) | P6 aan / MSP uit / OPS uit | RT, geen UI — **risico bij aanzetten buiten P6** |
| A17 | TT_FinMile als grensvenster (drie deelgedragingen) | CPM, SA | `p6FinishMilestoneBoundaryWindow` (achter p6Source) + `milestoneKind` | P6 aan / MSP uit / OPS uit | RT, geen UI |
| A18 | Actuals als exacte broninstants | CPM | `p6PreserveActualInstants` (achter p6Source) + `p6ProjectId` | P6 aan / MSP uit / OPS uit | RT, geen UI |
| A19 | Lopende taak: ES/LS = begin restwerk (poort voor B3/B4) | CPM | `p6UseRemainingStartForProgress` (achter p6Source) | P6 **per bestand** `rem_target_link_flag` / MSP uit / OPS uit | RT, geen UI |
| A20 | Datetime-constraint op nulduurmijlpaal exact (backward) | CPM `backwardBoundOf` | `p6PreserveZeroDurationConstraintInstants` (achter p6Source) | P6 aan / MSP uit / OPS uit | RT, geen UI |
| A21 | Voltooide activiteit krijgt echte totale speling | CPM, SA, CRT | `p6CompletedLateFromRemainingWindow` + p6Source + A12 + B3 | P6 aan (uit bij niet-retained; bewijs correlationeel) / MSP uit / OPS uit | RT, geen UI |
| A22 | Restwerk hervat op actualStart + verstreken duur | CPM | `resumeFromActualElapsed` | P6 uit / MSP aan (**alleen `.mpp`**) / OPS uit | RT, geen UI |
| A23 | Niet-gestarte taak niet naar statusdatum schuiven | CPM | `unstartedIgnoresStatusDate` | P6 uit / MSP aan (**alleen `.mpp`**) / OPS uit | RT, geen UI |

### B. Achter `p6Source`/P6-provenance zonder eigen instelling ⇒ worden conventies

| # | Conventie | Waar | Aansturing nu | Nieuwe conventie-id |
|---|---|---|---|---|
| B1 | FS-nul-lag op gedeelde bandgrens: opvolger start op de finish van de voorganger; relatievlag gestript zonder p6Source | CPM constructor, RM forward/backward | `Sequence.p6StartAtPredecessorFinishBoundary` + p6Source | `p6RelationFinishBoundary` |
| B2 | Backward WORKTIME-lag vanaf finishgrens landt op complementaire vorige finishgrens | CPM `shiftLagPred` | alleen p6Source | `p6BackwardLagFinishBoundary` (nog geen eigen test — toevoegen) |
| B3 | Voltooide taak: ES/EF als statusdatum-venster, EF telt voor projecteinde | CTW, CPM, SA | p6Source + A19 + taakvelden | `p6CompletedDataDateWindow` |
| B4 | Voltooide LOE met alleen SS-ingang via actual-finish-route | CRT, CPM | p6Source + A19 + A12 + A18 + taakvelden | `p6CompletedLoeActualFinish` |
| B5 | Niet-gestarte LOE neemt targetvenster als span | OLT, CPM | p6Source + taakvelden | `p6OpenLoeTargetSpan` |
| B6 | Resume-override alleen na geldige P6-suspend/resume | CPM | taakprovenance `p6ProjectId` + `p6SuspendResume` | blijft taakdata |
| B7 | TT_FinMile-normalisatie in de lezer | `xerReader.ts` | lezercode | blijft lezerwerk |

Traces (`backwardFloatTrace`, `plannedFloorTraceByTaskId`) staan ook achter p6Source maar hebben geen
rekeneffect; ze volgen `p6RelationFinishBoundary`/`p6CompletedDataDateWindow` als aan-schakelaar.

### C. MS-Project-specifiek via taakvelden (blijft taakdata)

C1 `manuallyScheduled` (alleen `.mpp`-lezer; MSPDI leest het niet), C2 `levelingDelayMinutes`/`-Elapsed`,
C3 timephased-velden (`timephasedStartAnchor`/`-FinishFloor`/`-DurationWalks`), C4 `time.resume` bij
≤1 toewijzing, C5 `mspTaskType` FIXED_WORK houdt werk vast bij contour-herschaling.

### D. Hard gecodeerd, zonder schakelaar (kandidatenlijst; blijft hard tot een profiel een andere waarde nodig heeft)

D1 kritiek = tf ≤ drempel, voltooid mét statusdatum nooit kritiek, hammock nooit · D2 driving = relatie-FF
0 in opvolgerkalender · D3 FF eindtaak = LF−EF · D4 getekende negatieve speling uit late constraints ·
D5 projecteinde = max(EF) · D6 projectstart ondergrens voor taken met voorganger, wortels houden eigen
anker ("MSP-semantiek") · D7 dagmodus inclusieve finishdag, FS = volgende werkdag · D8 uurmodus half-open
banden · D9 Z11 FS+0 over twee kalenders · D10 Z13 wortelanker op laatste band-einde · D11 Z19
nulduurmijlpaal met datetime snapt forward niet · D12 T6 eindmijlpaal zonder lag op rauw finish-instant ·
D13 actuals snappen alleen binnen dezelfde dag · D14 ELAPSEDTIME 24/7 · D15 procent-lag afgerond op
hele dagen · D16 harde/zachte MSO/MFO (lezers verschillen: MSPDI/MPP MSO hard, XER CS_MSO zacht,
CS_MAND* hard) · D17 datum-constraint dag-verankerd · D18 deadline = zachte LF-bovengrens · D19 ALAP
schuift met eigen vrije speling · D20 hammock/LOE tf=ff=0 · D21 alleen bladtaken, rollup + afgeleide
duur in projectkalender · D22 samenvattingsrelaties uitgevouwen naar bladkinderen · D23 statusdatum
gesnapt in projectkalender, RETAINED = max(statusdatum, druk) · D24 out-of-sequence alleen waarschuwing ·
D25 projectduur 0 bij alleen mijlpalen · D26 import completion ≥1 ⇒ actualFinish (niet XER) · D27
"datums zoals opgeslagen" alleen automatisch bij verse XER (verandert in `recorded-all-formats`) · D28
nivelleerder: MATERIAL nooit, voltooid/lopend onverplaatsbaar · D29 `levelingDelay` in hele werkdagen.

### Plekken buiten `src/engine/` die het bronformaat lezen om rekengedrag te sturen

`xerScheduleOptions.ts` (zet p6Source + alle p6-vlaggen; leidt A2–A8, A10, A11, A14, A19, A21 per
bestand af), `xerReader.ts` (A14-endDate, B1-vlag, B7, hammock/milestoneKind, CS_*-mapping),
`xerCalendarData.ts` (`calendar.p6Source`, diagnose), `mppReader.ts` (A22/A23 + C1–C4),
`mspdiReader.ts` (A5; MSO hard; leest géén manual/resume/A22/A23 — twee MSP-formaten rekenen dus
verschillend), `mspdiWriter.ts`/`p6xmlWriter.ts` (verlieswaarschuwingen), `schedulingOptionsRead.ts`
+ `ifcReader.ts`/`ifcWriter.ts`, `documentActivation.ts` (D27), `CalcOptionsSection.tsx` (A3–A5, A7–A10),
`ribbonWidgets.tsx` (A2), MCP `calendarResourceTools.ts`/`readTools.ts`/`xerProvenanceTools.ts`,
extensies `extTypes.ts`/`extMappers.ts`. **Onvolledige aanroepers**: `documentActivation.ts` (geen
`projectEndDate`), `occupancy.ts` en `distribute.ts` (geen `projectStartDate`/`projectEndDate`),
`benchmark/runner.ts` (`{}`).

### Bestaande poorten die de refactor mechanisch bewaken

Corpusloze planningssuite (case-batterijen + alle `check-xer-*`/`check-p6-*`/`check-mpp-import`),
`check-ifc-roundtrip` + `check-ext-contract` + `check-document-contract` (alle sleutels, compile-time
in `sanitizeSchedulingOptions`), X12 mét corpus (15.056), `check-mpp-fidelity` (216). Er is nog géén
poort die `src/engine/` verbiedt `p6Source` te lezen (⇒ `verify:conventions`), en B2 heeft geen eigen
test.
