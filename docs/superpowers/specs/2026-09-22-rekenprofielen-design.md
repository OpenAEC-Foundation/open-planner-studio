# Rekenprofielen — één solver, benoemde conventies, profielen per project

*Ontwerp, 2026-09-22, **versie 3.1** (+ 2026-09-23: groep C — drie P6-conventies uit X12-brok 2: `p6CompletedPredecessorAtDataDate`, `p6FreeFloatOnOwnCalendar`, `p6CompletedRemainingLag`; het register telt daarmee 18 conventies; de tellingen hieronder zijn die van het ontwerp, het register is de bron) (na drie critreview-rondes: v1 no-go op veertien punten, v2 no-go op
negen tekstpunten, v3 go onder drie voorwaarden; alle verwerkt — zie §11). Status: besproken met de eigenaar (vragen 1–7 beantwoord), wordt uitgevoerd
vóór het X12-vervolg. Bijlage A is de inventaris van de motor op de kop van
`claude/file-formats-support-phase-3-a0ebe2` ná de merge van main (`c2284cf6`).*

## 1. Waarom

Bij elke formaat-etappe (`.mpp`, XER, straks PMXML/PP) kwam dezelfde vraag terug: "moeten we dit in
de solver doen? Dan rekent het raar voor wie MS Project gewend is." Eén gedeelde motor, drie scholen
(Primavera P6, MS Project, en wat OPS zelf tot nu toe deed), en elke etappe moest kiezen wiens gedrag
de motor krijgt. De huidige uitweg is een vlag — `schedulingOptions.p6Source === 'XER'`, fail-closed —
waarachter P6-takken schuilen. Elke nieuwe pakketregel is dan opnieuw een vraag aan de eigenaar, en het
antwoord landt als een `if` op het bronformaat.

Dit ontwerp haalt die keuze uit de motor. Het onderscheidt twee dingen die v1 op één hoop gooide:

- **Pakketconventies** — regels die bij een *school* horen en niet per bestand verschillen: "een
  finishmijlpaal is een grensvenster", "actuals zijn exacte broninstants", "restwerk hervat op
  actualStart + verstreken duur". Dat zijn er achttien (bijlage A: groep A-conventies + B, het ontwerp telde er vijftien; sinds 2026-09-23 plus groep C). Zij vormen
  het **rekenprofiel**.
- **Reken-opties van het project** — instellingen die P6 en MS Project *per project* opslaan en die de
  lezer uit het bestand haalt: lagkalender, kritiekdefinitie en -drempel, floatformule, open einden,
  near-critical, floatpaden, verwachte einddatums, projecteinde-anker, `rem_target_link_flag`,
  en de voortgangsmodus. Die blijven `project.schedulingOptions` (en `project.progressMode`); het
  profiel levert er alleen de standaard voor bij een nieuw of bronloos project.

"Moeten we dit in de solver doen?" wordt zo: *is het een pakketconventie (rij in het register, drie
waarden) of een projectoptie (veld in het bestand, profiel geeft de default)?* Beide zijn tabelwerk.

## 2. Besluiten van de eigenaar (2026-09-22)

| # | vraag | besluit |
|---|---|---|
| 1 | welke compromissen | de conventiekeuzes in de gedeelde motor (P6 vs MS Project vs OPS) |
| 2 | wie bepaalt de conventie | de gebruiker, als één profielkeuze per project — mét eigen profielen met eigen waarden; het bronbestand stelt voor |
| 3 | waar leeft een profiel | volledige opgeloste waarden in het IFC + profiel-id als herkomst; eigen profielen app-globaal |
| 4 | OPS-profiel | bewuste keuze van de eigenaar, te nemen ná X12; tot dan = "wat OPS vandaag doet", byte-identiek |
| 5 | regel A (landingsregel) | een motorwijziging landt alleen als onder elk profiel met orakel geen enkele cel die exact was inexact wordt — per cel, niet per som; en een conventie die per profiel verschilt is altijd een benoemde instelling (regel B), nooit een `if` op het formaat |
| 6 | volgorde | eerst het volledige profielsysteem (incl. eigen profielen), daarna X12 eronder, daarna de OPS-inhoud |
| 7 | openen van een bestand | automatisch het bronprofiel, met één melding die zegt waar je het aanpast; geen dialoog |

"Geen pinnen met reden" (plan XER §6, X12) blijft onverkort: binnen een profiel is nul nul; het
referentiepakket is per profiel (P6-profiel ⇒ P6 is het orakel, MS Project-profiel ⇒ MS Project).
Plan XER §10.f is hierop bijgewerkt (het "geparkeerd ná X12" van de ochtend is door dit besluit
vervangen).

## 3. Datamodel

### 3.1 De drieëntwintig conventies en het register

`SchedulingOptions` (`src/types/project.ts`) blijft het opgeloste type dat de solver leest — geen
hernoeming van honderd callsites. Binnen dat type worden twee disjuncte sleutelverzamelingen benoemd:

- **`ConventionKey`** (15): `preserveActualDatesInBackwardPass` (A12), `clampNegativeFreeFloat` (A13),
  `p6ZeroDurationUsesPlannedBoundary` (A15), `p6UseTaskPlannedStartFloor` (A16),
  `p6FinishMilestoneBoundaryWindow` (A17), `p6PreserveActualInstants` (A18),
  `p6UseRemainingStartForProgress` (A19 — P6-semantiek voor de ES/LS van een lopende taak; de waarde
  komt per bestand uit `rem_target_link_flag`, dus de XER-lezer zet hem als **override** op het
  profiel — een per-bestand-conventie (`perFile`) die bij élke wissel, ook naar MS Project of OPS,
  letterlijk blijft staan (besluit orkestrator 2026-09-22, overdracht §1c); alleen een bestand zonder
  die vlag rekent er niet mee), `p6PreserveZeroDurationConstraintInstants` (A20),
  `resumeFromActualElapsed` (A22), `unstartedIgnoresStatusDate` (A23), en nieuw voor groep B: `p6RelationFinishBoundary` (B1),
  `p6BackwardLagFinishBoundary` (B2), `p6CompletedDataDateWindow` (B3), `p6CompletedLoeActualFinish`
  (B4), `p6OpenLoeTargetSpan` (B5). Allemaal booleans.
- **`ProjectOptionKey`** (9): `lagCalendar`, `criticalDefinition` (mode + threshold + thresholdHours),
  `totalFloatMode`, `makeOpenEndedCritical`, `nearCriticalThreshold`, `floatPaths`,
  `useExpectedFinishDates`, `useProjectEndDateForFloat`, `p6CompletedLateFromRemainingWindow` (A21 —
  hangt in de motor aan de B3/B4-keten en werkt dus alleen onder een profiel met die conventies aan).
  Plus `project.progressMode` als apart projectveld.
- Typen: `ProjectSchedulingOptions = Pick<SchedulingOptions, ProjectOptionKey>`,
  `SchedulingConventions = Required<Pick<SchedulingOptions, ConventionKey>>`, en
  **`EffectiveSchedulingOptions = ProjectSchedulingOptions & SchedulingConventions`** — het ENIGE type
  dat `CPMOptions.schedulingOptions` (verplicht) accepteert. Omdat de conventies daarin `Required`
  zijn, is een kale `project.schedulingOptions` er niet aan toewijsbaar: een aanroeper die
  `effectiveSchedulingOptions(project)` vergeet, compileert niet (geverifieerd principe: een
  optionele-sleutels-type was wél toewijsbaar, daarom deze vorm).

`p6Source` verdwijnt uit `SchedulingOptions`. `WorkCalendar.p6Source` (diagnose, round-trip) blijft.

`src/engine/scheduler/conventions/registry.ts`:

```ts
interface ConventionDescriptor {
  id: ConventionKey;
  builtIn: { p6: boolean; msproject: boolean; ops: boolean };
  /** Waarde die geldt als een opgeslagen bestand de sleutel niet kent (= het gedrag vóór `since`). */
  legacyValue: boolean;
  labelKey: string;   // common:conventions.<id>.label / .help
  since: string;      // ISO-datum; documenteert vanaf wanneer `legacyValue` ≠ basiswaarde kan zijn
}
type SchedulingConventions = Required<Pick<SchedulingOptions, ConventionKey>>;
```

Ingebouwde waarden (bijlage A): **P6** = alle achttien aan (ook groep C), behalve `resumeFromActualElapsed`,
`unstartedIgnoresStatusDate` en `p6UseRemainingStartForProgress` (uit; per bestand als override);
**MS Project** = alleen `resumeFromActualElapsed` en `unstartedIgnoresStatusDate` aan; **OPS** = alles
uit. `legacyValue` geldt voor bestanden mét `OPS_SchedulingProfile` waarin een (later toegevoegde)
sleutel ontbreekt; voor alle huidige conventies is dat uit. Voor bestanden ZONDER die pset geldt niet
`legacyValue` maar de migratietabel §3.4 (die speelt de oude `p6Source`-afleiding na, waarin B1–B5
aan stonden).

Daarnaast levert het register per basis de **standaard-projectopties**, `defaultOptionsFor(baseId)`,
die ALLEEN worden toegepast (1) in de projectwizard bij het kiezen van een profiel voor een nieuw
project, (2) bij een import zonder eigen opties in het bestand — CSV en extensie-import — en (3) op
verzoek via de knop *Standaardopties van dit profiel toepassen* in Projectinfo. Een profielwissel
raakt de opties nooit. Per basis: p6 = de optie-defaults uit
`XER_SCHEDULING_DEFAULTS` (die constante verhuist naar het register; `xerScheduleOptions.ts` importeert
hem daar); msproject = `{ totalFloatMode: 'smallest' }`; ops = `{}`. `totalFloatMode` krijgt GEEN nieuwe
state-waarde: het huidige gedrag bij afwezig (finish-float bij statusdatum én gestarte taak, anders
min) blijft `undefined` in de state, en alleen de UI toont dat als "automatisch" (nu ten onrechte als
"smallest"). Zo lekt er niets naar de extensie-API of de writers.

### 3.2 Profiel en project

```ts
interface SchedulingProfile {
  baseId: 'p6' | 'msproject' | 'ops';
  id: string;                               // 'p6' | 'msproject' | 'ops' | eigen id
  name: string;                             // alleen betekenisvol voor eigen profielen
  overrides: Partial<SchedulingConventions>;
}
```

- `project.schedulingProfile: SchedulingProfile` — een veld **binnen** `project`; `project` staat al in
  `DOCUMENT_FIELDS` (snapshot-rol `data`), dus geen eigen contract-entry. Undo, documentwissel,
  crashherstel en opslaan volgen vanzelf.
- `resolveConventions(profile)` = basiswaarden + overrides. `effectiveSchedulingOptions(project)` =
  `{ ...project.schedulingOptions, ...resolveConventions(project.schedulingProfile) }` — de conventies
  als laatste, zodat een achtergebleven conventiesleutel in een oude payload nooit wint; de sanitizer
  stript conventiesleutels uit `schedulingOptions` (runtime) en het type sluit ze uit (compile-time).
- Eén helper `solveInputFor(project, tasks, sequences, calendar, calendars)` levert de volledige
  solver-invoer (`EffectiveSchedulingOptions`, `progressMode`, `dataDate`, `projectStartDate`,
  `projectEndDate`). Dat de vier aanroepers die nu niet alles doorgeven (`documentActivation`,
  `occupancy`, `distribute`, `benchmark/runner`) daarmee óók `projectStart/EndDate` krijgen is een
  **benoemde gedragswijziging** in een eigen commit met eigen test (C5) — niet onder het
  gedragsbehoud-bewijs van §3.4. Reikwijdte, gemeten in de critreview op baan C: `prepareLoadedPayload`
  is het laadpad van **elk geopend bestand én crashherstel**, dus elke XER (en heropende IFC met
  XER-archief) met `useProjectEndDateForFloat` toont bij het openen voortaan dezelfde late datums en
  speling als na F5 en als in de X12-meting (voorheen weken die bij het openen af); ook de telling in de
  #63-melding verandert daardoor. Releasenotitie verplicht.
- **Eigen profielen** zijn app-globale **sjablonen** (`ops-schedulingProfiles`, JSON-lijst van
  `SchedulingProfile` via het `settingsStore`-patroon, gesanitized bij lezen, nooit throwen). Een
  project draagt zijn eigen kopie; een sjabloon wijzigen werkt **niet** door naar open documenten. De
  UI biedt "bijwerken vanuit sjabloon" en "sjabloon bijwerken vanuit dit project". Matching op `id`,
  nooit op naam.
- **Overrides bij een wissel.** Een profielwissel vervangt `baseId` en `id`, maar bewaart de overrides
  op een ingebouwd id **letterlijk** — die zijn per definitie uit het bestand of de migratie (A19 uit
  `rem_target_link_flag`), want een handmatige wijziging maakt een kopie — zo geeft P6 → MS Project → P6 weer
  exact het resultaat van vlak na het openen. Een ingebouwd id mét overrides verschijnt in de
  keuzelijst als "P6 (aangepast)" en is géén kopie: pas een handmatige wijziging van een conventie
  maakt "Kopie van P6".

### 3.3 IFC-round-trip

Eén JSON-veld, pset `OPS_SchedulingProfile` op de `IfcWorkSchedule` (exact het patroon van
`OPS_SchedulingOptions`/`OPS_Baselines`): `{ id, baseId, conventions: <alle 15 opgelost>, name? }`
— `name` alleen voor eigen profielen (ingebouwde namen zijn vertaald en horen niet in een bestand).
De pset wordt **alleen geschreven als het profiel ≠ `ops` zonder overrides** ⇒ bestaande
**OPS-bestanden** blijven byte-identiek. Een `.mpp`-IFC uit v2026.9.0 (beide mpp-vlaggen) migreert naar
MS Project en krijgt bij heropslaan de pset; een P6-bestand dat door een uitgebrachte versie zonder
profielkennis heen gaat, verliest zijn profiel (die versie kent geen XER, dus geen verlies t.o.v.
vandaag) — beide in de gids. `OPS_SchedulingOptions` blijft precies zoals nu en draagt de optie-sleutels
plus — voor neerwaartse compatibiliteit met uitgebrachte versies, die van de conventies alleen
`resumeFromActualElapsed`/`unstartedIgnoresStatusDate` kennen — A22 en A23, uitsluitend wanneer ze
`true` zijn (een OPS-project zonder opties krijgt dus geen pset: byte-identiek). De nieuwe lezer geeft
`OPS_SchedulingProfile` voorrang; een oude versie rekent een nieuw `.mpp`-project dus nog steeds met
A22/A23. Leesvolgorde: eerst `legacyOptionsToProfile` over de
blob, dán conventiesleutels strippen uit `schedulingOptions`.

Lezen: `sanitizeSchedulingProfile` (whitelist: `baseId` uit de drie, `id`/`name` strings met
lengtegrens, `conventions` booleans; onbekende sleutel genegeerd, ongeldige waarde ⇒ `legacyValue`,
**ontbrekende sleutel ⇒ `legacyValue`**, nooit de basiswaarde — anders rekent een ouder bestand na een
nieuwe conventie ineens anders). `overrides` wordt bij het lezen herleid als verschil met de basis.

### 3.4 Migratie (byte-identiek in rekenresultaat), per veld

`legacyOptionsToProfile(blob)` speelt de huidige semantiek na:

| bestand | profiel na openen | `schedulingOptions` |
|---|---|---|
| geen `OPS_SchedulingProfile`, geen `OPS_SchedulingOptions` | `ops` zonder overrides | leeg |
| `OPS_SchedulingOptions` mét `p6Source: 'XER'` | `p6`; per conventie: sleutel aanwezig ⇒ die waarde als override waar hij van p6 afwijkt; A-sleutel **afwezig ⇒ uit** (`legacyValue`, want afwezig was uit); B1–B5 ⇒ **aan** (die werden uit `p6Source` afgeleid) | de optiesleutels |
| `OPS_SchedulingOptions` zónder `p6Source`, beide `.mpp`-vlaggen `true` | `msproject`; overrides = afwijkende niet-gepoorte conventies | de optiesleutels |
| `OPS_SchedulingOptions` zónder `p6Source`, anders | `ops`; de `p6Source`-**gepoorte** conventies (A15–A20, dus ook A19) worden **weggegooid** (ze waren inert), de niet-gepoorte (A12, A13, A22, A23) worden overrides | de optiesleutels |
| `OPS_SchedulingProfile` | zoals gelezen (§3.3) | `OPS_SchedulingOptions` |

Bewijs: de corpusloze planningssuite (alle fixtures identiek), X12 mét corpus exact 15.056 onder het
P6-profiel, `check-mpp-fidelity` "GOAL_ZERO_DEVIATIONS groen, 216 pins ongewijzigd (0 verbeterd / 0
verslechterd)", plus een vijandige-blob-test: p6-vlaggen `true` (incl. A19) zonder `p6Source` ⇒ geen overrides, en
de gedeeltelijke-blob-test: `{ p6Source, p6UseTaskPlannedStartFloor }` ⇒ alleen A16 en B1–B5 aan.

## 4. De motor

- `CPMSolver`, `scheduleAnalysis`, `relationMath`, `p6Completed*`, `p6OpenLoe*` en
  `p6CompletedTargetWindow` (verhuist van `src/utils` naar `src/engine/scheduler`) lezen uitsluitend
  `schedulingOptions.<sleutel>`. Elke `p6Source === 'XER'`-poort (incl. `p6XerOption`) vervalt: de vlag
  zelf is de conventie. De vijf B-takken krijgen hun eigen vlag; de traces volgen
  `p6CompletedDataDateWindow` (backward-float-trace) resp. `p6UseTaskPlannedStartFloor`
  (planned-floor-trace). Redencode `notXerSource` wordt `conventionOff`, op exact dezelfde plek in de
  guardvolgorde. B2 krijgt zijn eerste eigen (negatieve) test.
- **Herkomstvelden op taken** (`p6ProjectId`, `p6TaskId`, `p6ActivityType`, `p6ExplicitTargetWindow`,
  `p6CompletePctType`, `p6DurationType`, `manuallyScheduled`, `levelingDelayMinutes`, timephased-velden,
  `resume`, `mspTaskType`) blijven **datagates**: zij zeggen wat een taak ís, en veranderen daarvan
  zou X12-gedrag wijzigen zonder eigen meting. Gevolg, eerlijk benoemd: een P6-profiel op een project
  zonder P6-taakprovenance (eigen project, `.mpp`, P6-XML) activeert B3–B5 en A11/A18 niet, en een
  XER-project onder het MS Project-profiel is een combinatie zonder orakel. De gids zegt dat; de poort
  `verify:conventions` telt deze datagates (lijst in bijlage A) tegen een **gepinde telling die alleen
  omlaag mag** — een nieuwe herkomstlezing in de motor is rood.
- De ombouw is **gedragsbehoudend** (bewijs §3.4). Tot de lezers op het profiel staan, vertaalt een
  tijdelijke, gemarkeerde laag `p6Source` ⇒ de vijf B-vlaggen aan; de integratie verwijdert haar.
- `npm run verify:conventions` (in `verify`): AST-scan over `src/engine/**` — verbiedt `p6Source`,
  `importFormat`/`readFormat` en imports uit `src/services/{xer,mpp,msproject,p6,csv}`; rapporteert de
  datagates. Mutatietest met `--root` (patroon `check-store-runtime-boundaries.ts`).

## 5. Regel A als poort

- **Cel-baseline** `tests/planning/xer-product-fidelity-cells.json`: per corpusbestand (sha256-sleutel,
  canonicalisatie als de v2-baseline) per project per as de gesorteerde lijst van inexacte cellen
  `(taskId, bucket)` met bucket ∈ {sameday, diff, missing}, geordend exact < sameday < diff < missing.
  De assen zijn de zes nuldoel-assen **plus `drivingPath`** als zevende poort-as in de cel-ratchet
  (eigenaarsbesluit 2026-09-22, vraag 7): een driving-vlag die goed was mag niet omslaan, maar de as
  telt niet mee in het zesassige nuldoel-getal (15.056) en de longest-path-wandeling als instelling
  hoort bij het X12-vervolg, niet bij deze etappe. Poort: een cel die exact was en nu een
  bucket heeft ⇒ rood; een bucket die verslechtert ⇒ rood; verbetering ⇒ groen + "te herpinnen: N";
  verouderde regels (cel nu exact) zijn toegestaan; de schrijfmodus herschrijft de baseline alleen
  zonder rode cellen. Corpusloos: overslaan met OK-regel. Geen `.mpp`-cellenbaseline: die baseline
  staat al op nul met `GOAL_ZERO_DEVIATIONS` per bestand.
- `npm run measure:profiles`: X12 mét corpus (nuldoelregels + cel-poort) onder het P6-profiel,
  `check-mpp-fidelity` onder het MS Project-profiel, `check-xer-corpusless-fidelity-gate`; `--full`
  voegt de corpusloze suite toe. Eén samenvattingstabel; exit 1 bij één rode regel. Niet in `verify`.
  Benoemd gat: het MS Project-orakel meet twee assen (start/einde); MSPDI en P6-XML hebben geen orakel.
- **Goal prompt** `docs/superpowers/plans/2026-09-22-goalprompt-x12-naar-nul.md`: regel A (per cel,
  elk profiel, `measure:profiles` vóór elke commit) en regel B (verschil per profiel ⇒ conventie in het
  register, nooit een `if` op het formaat; per-bestand-waarden ⇒ projectoptie).

## 6. Wat de gebruiker ziet

- **Openen**: XER ⇒ P6 (+ SCHEDOPTIONS als projectopties); `.mpp` ⇒ MS Project; MSPDI ⇒ **OPS** (+
  `CriticalSlackLimit`) in deze etappe — de wissel naar MS Project verandert elk MSPDI-bestand met
  voortgang en heeft geen orakel; dat is een aparte, apart gemeten taak met releasenotitie, alleen op
  besluit van de eigenaar; P6-XML ⇒ **OPS** in deze etappe, om dezelfde reden als MSPDI (de lezer zet vandaag geen opties;
  onder P6 gaan A12/A13/A16/A17/A20/B2 aan zonder orakel — vooral A16, de geplande-startvloer op élke
  taak); CSV,
  nieuw project, IFC uit een ander pakket en extensie-importers ⇒ OPS; eigen IFC ⇒ wat erin staat.
  `ImportResult.suggestedProfileId` komt uit de lezer via `formatRegistry`.
- **Melding** (K8a-kanaal, één per geopend bestand — een XER met N projecten geeft er één, `dedupeKey`
  per import; bij XER samengevoegd met de bestaande openingsmelding): "Dit project rekent als
  Primavera P6 — aanpassen via Bestand → Projectinfo → Rekenprofiel", met `helpArticleId` naar de gids
  en een nieuw **serialiseerbaar** actieveld `AppNotification.action?: { kind: 'openBackstageSection';
  section: BackstageSection; labelKey: string }` dat `NotificationHost` afhandelt (geen functies in de
  store). Niet bij heropenen uit eigen IFC of crashherstel.
- **Kiezen en bewerken**: het bestaande `CalcOptionsSection` wordt het blok *Rekenprofiel en
  reken-opties* in Projectinfo (wizard: alleen de keuzelijst, die dan `defaultOptionsFor` toepast;
  dialoog én Backstage → Projectinfo: het volledige blok): bovenaan de keuzelijst
  (P6 / MS Project / OPS / eigen sjablonen), daaronder de drieëntwintig conventies (aan/uit, met uitleg) en
  de bestaande projectopties. `thresholdHours` wordt niet meer weggegooid bij een bewerking. Een
  conventie wijzigen op een ingebouwd profiel maakt automatisch een eigen profiel "Kopie van P6" op
  het project (hernoembaar; "opslaan als sjabloon" zet hem in de app-lijst). Géén paneel in
  `SettingsPanelContent`: dit is projectdata, geen app-instelling.
- **Wisselen** = in één producer `finishMutation(state, { stale: true })` (niet `markScheduleStale`,
  dat doet niets in "datums zoals opgeslagen"), gevolgd door `runCPM()` — zoals Projectinfo vandaag na *Toepassen* altijd doorrekent, ook met
  *Automatisch berekenen* uit; dat blijft zo voor het hele blok; daarna één melding "N taken
  verschoven" (verschil vóór/ná, zelfde telling als de #63-strook — achteraf, geen kloon-solve vooraf,
  geen dialoog). De gids waarschuwt bij een handmatige wissel naar P6 voor A16 (geplande start
  wordt een vloer zodra hij meer dan een dag later ligt dan het netwerk).
- **Docs**: gids `gids-rekenprofielen.md` (nl+en, manifest) met de conventietabel in mensentaal en de
  "geen orakel"-waarschuwing; `gids-xer-import`/`gids-msproject-import`/`gids-import-export` verwijzen
  ernaar; CLAUDE.md-sectie *Rekenprofielen*; `docs/recepten/conventie.md`; `docs/ifc-round-trip.md`
  noemt `OPS_SchedulingProfile`.
- i18n: `conventions.<id>.label/.help` (15×2), `profiles.builtIn.*`,
  `notifications.schedulingProfileApplied`, actielabel — alle 14 locales (`verify:i18n`).

## 7. Afnemers

- **Export-guard** `xerExportLoss.hasScheduleLoss`: criterium is *overleeft het heropenen* — het
  doelformaat plus het `suggestedProfileId` van zijn lezer plus zijn native opties. Voorbeelden: een
  `.mpp`-project naar MSPDI heropent als OPS en verliest A22/A23 ⇒ verlies; een XER-project naar
  P6-XML heropent (deze etappe) als OPS ⇒ verlies van de P6-conventies; de bestaande regel
  `progressMode !== undefined ⇒ verlies` blijft. Writers (`mspdiWriter`, `p6xmlWriter`) lezen alleen projectopties —
  ongewijzigd.
- **Extensie-API**: `ExtProject.schedulingProfile` additief (apiVersion 1.2.0); `publicSchedulingOptions`
  blijft; `fromExtProject`/`fromExtImportResult` nemen **nooit** een meegegeven profiel over
  (extensie-import ⇒ OPS). `ExtCalendar.p6Source` blijft (gepubliceerd).
- **MCP**: `planner_get_project_info` toont het profiel; `planner_xer_provenance` geeft de opgeloste
  set i.p.v. `mappedSchedulingOptions` met `p6Source`; de weigerteksten in `calendarResourceTools`
  worden bijgewerkt.
- **Tests**: 106 `p6Source`-treffers (tweede inventaris) — per bestand voorgeschreven in het
  uitvoeringsplan `docs/superpowers/plans/2026-09-22-plan-rekenprofielen.md` (in de maak); de
  vijf riskante: x12-mutanten `delete p6Source` ⇒ "alle gepoorte + B-vlaggen uit" (niet ops-met-
  overrides); `check-xer-progress.ts:167` ⇒ ops + alleen `useExpectedFinishDates`; de vijandige
  blob-test wordt de migratietest; `xerScheduleOptionsGroundTruth` vergelijkt op de opgeloste set
  zonder het register te importeren; `check-xer-schedule-options` pint `XER_SCHEDULING_DEFAULTS` ≡
  p6-basis + p6-optie-defaults.

## 8. Tests

- `check-conventions-registry.ts`: 18 conventies (ontwerp: 15), drie ingebouwde waarden, `legacyValue`, unieke ids,
  i18n-sleutels; resolve/diff-identiteit; `'auto'` ≡ afwezig; `XER_SCHEDULING_DEFAULTS` ≡ p6.
- `check-scheduling-profile-roundtrip.ts`: IFC-round-trip voor drie ingebouwde + één eigen profiel; de
  vijf migratierijen; vijandige pset (onbekende baseId, onzin-conventies, 10 MB name) valt terug zonder
  throw; bestaande fixtures byte-identiek; `check-document-contract` groen.
- `check-conventions-p6-flags.ts`: per B-vlag aan/uit ⇒ ander bekend resultaat (mutatiebewijs), B2
  incl.; `p6Source` doet niets meer zodra de tijdelijke laag uit staat.
- `verify:conventions`-poort met mutant (een `p6Source`-lezing in `src/engine/` ⇒ rood).
- Gedragsbehoud: bestaande asserties gelijk (harness via de legacy-adapter); X12 15.056; mpp
  GOAL_ZERO groen, 216 pins ongewijzigd (vereist het OzBuild-materiaal: lokaal aanwezig, niet op CI).
- Browser `scheduling-profile.spec.ts`: XER openen ⇒ melding met actie; keuzelijst wisselt naar
  MS Project en herberekent (telling zichtbaar); conventie wijzigen ⇒ "Kopie van …".
- Cel-baseline: mutatiebewijs (één nieuwe inexacte cel ⇒ rood; verslechterde bucket ⇒ rood).

## 9. Buiten scope

De inhoud van het OPS-profiel (eigenaar, ná X12); MSPDI ⇒ MS Project (eigen taak op besluit);
de longest-path-wandeling als instelling voor de driving-path-as; dossier 7b-4; het X12-restant; `recorded-all-formats` (aparte PR);
import/export van sjablonen; profielen per taak; het ombouwen van herkomst-datagates naar conventies.

## 10. Volgorde binnen de etappe

1. Baan A: register + `SchedulingProfile` + `effectiveSchedulingOptions` + IFC-pset + migratie +
   sjabloonopslag (gedragsbehoudend: schrijver/lezer van `OPS_SchedulingOptions` pas bij de integratie
   omgezet, gemarkeerd `INTEGRATIE(rekenprofielen)`).
2. Baan B: `p6Source` uit de motor, vijf B-conventies, `p6CompletedTargetWindow` naar de engine,
   tijdelijke vertaallaag, `check-conventions-p6-flags`.
3. Cel-baseline + `measure:profiles` (loopt parallel).
4. Baan C: lezers op het profiel (`suggestedProfileId`), `solveInputFor` voor alle aanroepers, melding
   met actieveld, export-guard, extensie-API, MCP.
5. Baan D: UI-blok, sjablonen-UI, i18n 14 talen, gids, CLAUDE.md, recept, goal prompt, browser-test,
   `verify:conventions`.
6. Integratie: merges, tijdelijke laag weg, testmigratie (106 treffers), `OPS_SchedulingOptions` alleen
   opties, X12 15.056 exact, mpp GOAL_ZERO + 216 pins, `npm run verify`, critreview op de hele diff,
   gebruikstest in de browser met de gids als meetlat.

Branch `claude/rekenprofielen` bovenop `claude/file-formats-support-phase-3-a0ebe2`; PR ná #109 of
gestapeld erop — besluit eigenaar bij aanbieden.

## 11. Verwerking van de critreview op v1 (2026-09-22)

Verwerkt: (1) twee lagen i.p.v. één profiel met overrides; (2) migratie per veld met `p6Source`-poort
nagespeeld; (3) `legacyValue`; (4) MSPDI blijft OPS, extra migratierij voor `.mpp`-IFC; (5) scan
inclusief `p6CompletedTargetWindow` (verhuist naar de engine), datagates geteld en benoemd; (6) plan
§10.f gelijkgetrokken, "216" herformuleerd; (7) één ratchetregel met bucket, geen `.mpp`-cellen;
(8) alle 20 sleutels ingedeeld, `progressMode` benoemd; (9) `CalcOptionsSection` wordt het blok, geen
Settings-paneel, `thresholdHours`, matching op id, ingebouwde naam niet in het IFC; (10)
`finishMutation`; (11) serialiseerbaar actieveld; (12) afnemers-paragraaf; (13) snapshot-rol `data`,
één JSON-veld op de IfcWorkSchedule, "geen pset bij ops-zonder-overrides". Bewust **niet** verwerkt:
herkomstvelden als verboden gedragsschakelaar (§4 — eigen meting nodig; wél een gepinde telling) en
het schrappen van eigen sjablonen (§3.2 — eigenaarsbesluit 2).

**Ronde 2 (v2 → v3):** N1 A19 is een conventie met per-bestand-override, rij 4 gooit hem weg; N2 rij 2
met `legacyValue` voor A en "aan" voor B1–B5; N3 `EffectiveSchedulingOptions` met `Required`-conventies
als verplicht solver-type; N4 P6-XML blijft OPS, A16 in de gidswaarschuwing; N5 A12/A13/A22/A23
gespiegeld in `OPS_SchedulingOptions`; N6 opties bij wissel onaangeraakt, knop voor standaardopties,
wizard-keuzelijst, `'auto'` alleen weergave; N7 telling achteraf + `runCPM`; N8 `solveInputFor`-reparatie
als benoemde gedragswijziging; N9 traces (§4 leidend), leesvolgorde, export-guard-criterium,
planverwijzing, één melding per bestand; bucket-volgorde; datagate-telling gepind.

**Ronde 3 (v3 → v3.1, go onder voorwaarden):** V1 alleen A22/A23 gespiegeld en alleen als `true`;
V2 overrides uit het bestand blijven bij een wissel bewaard, "P6 (aangepast)" in de keuzelijst; V3
tellingen naar 15; plus: conventies als laatste gespreid, `runCPM` na Toepassen zoals vandaag.

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
rekeneffect; ze volgen `p6CompletedDataDateWindow` resp. `p6UseTaskPlannedStartFloor` (§4).

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
