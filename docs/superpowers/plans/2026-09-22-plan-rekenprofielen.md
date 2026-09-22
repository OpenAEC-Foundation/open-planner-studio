# Rekenprofielen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

*Plan geschreven 2026-09-22 door Opus 5.5 (architect) op spec **v3.1**
(`docs/superpowers/specs/2026-09-22-rekenprofielen-design.md`, reviewer-go) en de overdrachtsstand
`docs/superpowers/plans/2026-09-22-rekenprofielen-overdracht.md`. Namen in dit plan volgen de **gebouwde
code** van baan A (`claude/rekenprofielen-baan-a`, `5e2084fd` + `56602e59`) en baan B
(`claude/rekenprofielen-baan-b`, t/m `893e9955`): de code is de bron.*

**In gewone woorden.** De rekenmotor kende één verborgen schakelaar "dit komt uit Primavera P6", met
daarachter tientallen P6-regels. Banen A en B hebben die schakelaar al vervangen door vijftien benoemde
*conventies* (register + profieltype + IFC-pset + motorvlaggen). Dit plan maakt het af: de lezers zetten
het juiste profiel, elke solver-aanroep gaat via één helper, de gebruiker ziet en kiest het profiel in
Projectinfo, en de oude `p6Source`-vlag verdwijnt helemaal. De motor rekent daarna precies zoals vandaag
(harde eis), zodat het X12-werk "naar nul" er direct bovenop kan.

**Goal:** De solver stuurt uitsluitend op benoemde conventies (profiel) plus projectopties; elk project
draagt één rekenprofiel dat door IFC, undo, documentwissel en crashherstel reist; de lezers stellen het
bronprofiel voor; de gebruiker ziet en wijzigt het in Projectinfo — gedragsbehoudend (X12 exact 15.056,
`.mpp` GOAL_ZERO groen met 216 pins ongewijzigd, corpusloze suite groen).

**Architecture:** Twee lagen op het bestaande `SchedulingOptions`-type: vijftien `ConventionKey`s uit
`project.schedulingProfile` (basis + overrides, opgelost door `src/engine/scheduler/conventions/registry.ts`),
negen `ProjectOptionKey`s in `project.schedulingOptions`. `effectiveSchedulingOptions(project)` levert het
verplichte solvertype `EffectiveSchedulingOptions` (conventies als laatste gespreid); de nieuwe helpers
`solveOptionsFor`/`solveInputFor` zijn de enige weg naar de solver. IFC: `OPS_SchedulingProfile` (JSON)
naast `OPS_SchedulingOptions` (opties + A22/A23 alleen als `true`); `legacyOptionsToProfile` migreert
oude bestanden per veld.

**Tech Stack:** TypeScript (strict), React 19, Zustand + Immer, esbuild-gebundelde `check-*.ts`-suites
(exitcode = poort), Playwright, i18next (14 locales), de `typescript`-compiler-API voor AST-poorten.

---

## 0. Werkregels voor elke implementer (lees dit eerst)

1. **Node op het pad.** Elke shell begint met
   `export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"`. Achtergrondshells missen het
   nvm-pad (exit 127): zet het expliciet en schrijf de exitcode naar een log.
2. **Eén zware suite tegelijk, machinebreed** (`ps aux | grep run.sh` vóór je iets zwaars start).
   Implementers draaien alleen **gerichte** checks: `bash tests/planning/run.sh check-<naam>.ts
   [check-<naam2>.ts …]` (ook `cases-<naam>.json` mag), `bash tests/library/run.sh check-<naam>.ts`,
   `bash tests/mcp/run.sh cases-<naam>.ts`, `npm run test:browser -- <naam>`, `npm run typecheck`,
   `npm run lint`, `npm run verify:i18n`, `npm run verify:docs`. De volledige planningssuite,
   `npm test`, `npm run verify` en de corpusmetingen draaien **alleen** in M1 en de integratie (I).
3. **De exitcode is de poort**, nooit de tail. `run.sh` print "alles groen" ook bij exit 1 als bundelen
   faalt. Faalset = `XX`-regels + stacktraces + exitcode per check (de bibliotheeksuite springt haar
   `XX`-regels in: tel met `grep -c 'XX '`).
4. **Regelnummers zijn indicatief** — "verifieer op inhoud": zoek op de geciteerde code.
5. **Vóór elke `git commit`:** `git status --short`; stage **alleen** je eigen bestanden (expliciete
   paden, nooit `git add -A` of `git add .`); commitbericht in het Nederlands, afgesloten met
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nooit naar `main`; pushen alleen naar de
   eigen baanbranch.
6. **Hardening-checklist** — elke taak beantwoordt deze vijf punten expliciet in haar laatste stap:
   - **H1** Geen allocaties of lussen waarvan de grootte uit een ongevalideerde bestandswaarde komt
     (lussen over vaste registers als `CONVENTIONS`; lijsten eerst afkappen; strings een lengtegrens
     vóór ze gekopieerd worden).
   - **H2** Fixtures nooit naar de implementatie toe schrijven: verwachte waarden komen uit de spec of
     zijn met de hand afgeleid, nooit uit een eerste run gekopieerd. (Een *ratchet*-pin is per definitie
     een gemeten stand; dat staat er dan expliciet bij.)
   - **H3** Testcommentaar claimt alleen wat mutatiebewezen is; waar een poort geclaimd wordt, staat de
     mutant in de taak (breek ⇒ rood ⇒ herstel ⇒ groen).
   - **H4** Geen module-level muteerbare singletons in nieuwe code (nieuwe store-tests gebruiken
     `createAppStoreContext()`; geen `let` op moduleniveau; opslag als parameter zoals `profileStore.ts`).
   - **H5** Elke nieuwe `try/catch` heeft een rode-pad-fixture die de catch-tak aantoonbaar raakt.
7. **i18n.** Elke nieuwe zichtbare tekst via `t(...)`, in **alle 14 locales** (`nl, en, fr, de, es, zh,
   it, pt, pl, tr, ar, ja, ko, fa`); `npm run verify:i18n` is de poort (CLDR: `zh/ja/ko` alleen
   `_other`; `pl` `_one/_few/_many/_other`; `es/fr/it/pt` `_one/_many/_other` met `_many` = `_other`;
   `ar` `_zero/_one/_two/_few/_many/_other`). **Alleen baan D raakt localebestanden**; baan C gebruikt
   de sleutels die D1 levert. (Baan A zette `profiles.builtIn.*` alleen in nl/en — `verify:i18n` is
   daardoor rood tot D1.)
8. **Nieuwe `check-*.ts` in `tests/planning/`** moet in `run.sh` bedraad zijn (anders faalt de
   wees-inventaris). M1 bedraadt alle nieuwe checks van C en D vooraf met stubs; C en D vervangen alleen
   de inhoud van hun eigen stub en raken `run.sh` niet aan.
9. **Markeringen.** `TIJDELIJK` / `TIJDELIJK(rekenprofielen)` = overgangscode die in C3 verdwijnt (baan B
   gebruikt `// TIJDELIJK — rekenprofielen baan B`); `INTEGRATIE(rekenprofielen)` = baan-A-code die C2
   activeert; `STUB(rekenprofielen)` = M1-stub; `C5-GEDRAGSWIJZIGING` = bewust onvolledige solverinvoer
   die C5 repareert. Taak I2 faalt zolang één van deze markeringen bestaat.

## 1. Het contract — wat er ligt (banen A en B) en wat C/D toevoegen

### 1.1 Baan A (gebouwd) — `src/types/project.ts`

`ConventionKey` (unie van 15), `ProjectOptionKey = Exclude<keyof SchedulingOptions, ConventionKey | 'p6Source'>`
(9), `ProjectSchedulingOptions = Pick<SchedulingOptions, ProjectOptionKey>`,
`SchedulingConventions = Required<Pick<SchedulingOptions, ConventionKey>>`,
`EffectiveSchedulingOptions = ProjectSchedulingOptions & SchedulingConventions`,
`BuiltInProfileId = 'p6' | 'msproject' | 'ops'`,
`interface SchedulingProfile { baseId: BuiltInProfileId; id: string; name: string; overrides: Partial<SchedulingConventions> }`,
`Project.schedulingProfile?: SchedulingProfile` (afwezig ≡ `ops` zonder afwijkingen). De vijf
B-booleans staan in `SchedulingOptions`; `p6Source?: 'XER'` staat er **nog** (verdwijnt in C3).

### 1.2 Baan A (gebouwd) — `src/engine/scheduler/conventions/registry.ts`

```ts
export const BUILT_IN_PROFILE_IDS: readonly ['p6', 'msproject', 'ops'];
export interface ConventionDescriptor {
  id: ConventionKey; kind: 'boolean' | 'choice' | 'number'; values?: readonly string[]; range?: { min: number; max: number };
  builtIn: Record<BuiltInProfileId, boolean>;
  group: 'A' | 'B';            // bijlage A: groep A (bestaande vlag) of B (was alleen p6Source)
  perFile: boolean;            // waarde komt per bestand (nu alleen A19)
  legacyValue: boolean;        // voor bestanden MÉT OPS_SchedulingProfile die de sleutel missen
  gatedByP6Source: boolean;    // A15–A20 en B1–B5: vóór de profielen alleen actief onder p6Source
  labelKey: string;            // `conventions.<id>`; i18n = `${labelKey}.label` / `${labelKey}.help` (namespace common)
  since: string;
}
export const CONVENTIONS: readonly ConventionDescriptor[];          // vaste volgorde = IFC-JSON-volgorde
export const CONVENTION_KEYS: readonly ConventionKey[];
export function isConventionKey(key: string): key is ConventionKey;
export function isBuiltInProfileId(value: unknown): value is BuiltInProfileId;
export function builtInConventions(baseId: BuiltInProfileId): SchedulingConventions;
export function legacyConventions(): SchedulingConventions;
export function builtInProfile(id: BuiltInProfileId): SchedulingProfile;   // { baseId: id, id, name: '', overrides: {} }
export function displayNameKey(id: BuiltInProfileId): string;             // `profiles.builtIn.${id}`
export function resolveConventions(profile: SchedulingProfile | undefined): SchedulingConventions;
export function diffAgainstBase(baseId: BuiltInProfileId, conventions: Partial<SchedulingConventions>): Partial<SchedulingConventions>;
export function isDefaultProfile(profile: SchedulingProfile | undefined): boolean;   // afwezig, of ops+ops zonder afwijking
export function p6OptionDefaults(): { lagCalendar: 'predecessor'; criticalDefinition: { mode: 'totalFloat'; thresholdHours: number };
  totalFloatMode: 'finish'; makeOpenEndedCritical: boolean; useExpectedFinishDates: boolean; p6CompletedLateFromRemainingWindow: boolean };
export function defaultOptionsFor(baseId: BuiltInProfileId): ProjectSchedulingOptions;
export function optionKeysOnly(options: SchedulingOptions | undefined): ProjectSchedulingOptions | undefined;  // strip conventies + p6Source
export function legacyOptionsToProfile(blob: SchedulingOptions | undefined): { profile: SchedulingProfile; options: ProjectSchedulingOptions | undefined };
export function legacyOptionsBlobFor(project: Pick<Project, 'schedulingProfile' | 'schedulingOptions'>): SchedulingOptions | undefined; // opties + A22/A23 als true
export function switchProfile(profile: SchedulingProfile | undefined, newBaseId: BuiltInProfileId): SchedulingProfile;
export function effectiveSchedulingOptions(project: Pick<Project, 'schedulingProfile' | 'schedulingOptions'>): EffectiveSchedulingOptions; // conventies LAATST
```

### 1.3 Baan A (gebouwd) — IFC en sjablonen

- `src/services/ifc/schedulingOptionsRead.ts`: `sanitizeSchedulingOptions` (behoudt `p6Source: 'XER'`
  — de migratie heeft hem nodig), `sanitizeProjectOptions` (= `optionKeysOnly(sanitize…)`),
  `MAX_PROFILE_JSON_LENGTH = 64 * 1024`, `MAX_PROFILE_ID_LENGTH = 64`, `MAX_PROFILE_NAME_LENGTH = 200`,
  `sanitizeSchedulingProfile(input)` (ontbrekende conventiesleutel ⇒ `legacyValue`; **ongeldig getypeerde**
  waarde ⇒ de basiswaarde — zo gebouwd en gereviewd; spec §3.3 zegt "⇒ legacyValue", voor alle huidige
  conventies verschilt dat alleen onder p6/msproject), `schedulingProfileToJson(profile)`,
  `sanitizeStoredSchedulingProfile(input)`.
- `src/services/ifc/ifcWriter.ts`/`ifcReader.ts`: `OPS_SchedulingProfile` wordt **al geschreven en
  gelezen** (profiel-pset wint, anders `legacyOptionsToProfile(blok).profile`; standaardprofiel ⇒ niets).
  Het **optieblok** is nog ongewijzigd (incl. `p6Source` en conventiesleutels), gemarkeerd
  `INTEGRATIE(rekenprofielen)` in beide bestanden ⇒ taak C2.
- `src/services/schedulingProfiles/profileStore.ts`: `SCHEDULING_PROFILES_KEY = 'ops-schedulingProfiles'`,
  `MAX_CUSTOM_PROFILES = 100`, `MAX_STORED_PROFILES_LENGTH`, `type ProfileStorage`,
  `loadCustomProfiles(storage?)`, `saveCustomProfiles(list, storage?)`, `upsertCustomProfile(profile, storage?): boolean`,
  `deleteCustomProfile(id, storage?)`. **Geen** store-veld en geen `settingsRegistry`-entry: de sjablonen
  worden in de UI rechtstreeks via deze module gelezen/geschreven (D4).
- Tests: `tests/planning/check-conventions-registry.ts` (incl. `@ts-expect-error`-bewijs dat een kale
  `SchedulingOptions` geen `EffectiveSchedulingOptions` is), `tests/planning/check-scheduling-profile-roundtrip.ts`
  (IFC, migratie, vijandige pset, byte-identiteit, `profileStore`). i18n: alleen `profiles.builtIn.*` in nl/en.

### 1.4 Baan B (gemerged, `e3545ed7`) — de motor

`p6Source` wordt nergens meer in de motor gelezen behalve in de tijdelijke vertaling
`src/engine/scheduler/conventions/legacyP6Source.ts` (`resolveLegacyP6SourceConventions(options,
legacyTranslation = true)`, `LEGACY_P6_SOURCE_CONVENTION_KEYS` (B1–B5), `LEGACY_P6_SOURCE_GATED_FLAGS`
(A15–A20)), toegepast in de `CPMSolver`-constructor en in de publieke `explain*`-diagnoses; de
solverpaden gebruiken `*Resolved`-varianten. Testhaak `CPMOptions.legacyP6SourceTranslation?` (+
doorgifte in `SolveProjectInput`). `p6CompletedTargetWindow` staat nu in `src/engine/scheduler/`. Reden
`notXerSource` ⇒ `conventionOff`. Check: `tests/planning/check-conventions-p6-flags.ts` (26 mutanten,
incl. een bronscan dat `p6Source` onder `src/engine/` alleen in de tijdelijke vertaling staat).

### 1.5 Wat C en D toevoegen (nieuwe namen in dit plan)

```ts
// src/engine/scheduler/solveInput.ts (C1)
export type SolveProjectFields = Pick<Project,
  'statusDate' | 'progressMode' | 'schedulingOptions' | 'schedulingProfile' | 'startDate' | 'endDate'>;
export interface ProjectSolveOptions {
  dataDate: string | undefined; progressMode: ProgressMode | undefined;
  schedulingOptions: EffectiveSchedulingOptions;
  projectStartDate: string | undefined; projectEndDate: string | undefined;
}
export function solveOptionsFor(project: SolveProjectFields): ProjectSolveOptions;
export function solveInputFor(project: SolveProjectFields, tasks: Task[], sequences: Sequence[],
  calendar: WorkCalendar, calendars: WorkCalendar[]): SolveProjectInput;

// src/types/project.ts (C3) — blijvend, want oude bestanden blijven p6Source dragen; alleen de IFC-lezer
// (sanitizeSchedulingOptions) en legacyOptionsToProfile gebruiken het
export type LegacySchedulingOptions = SchedulingOptions & { p6Source?: 'XER' };

// src/services/importTypes.ts (C3)
//   ImportResult.suggestedProfileId?: BuiltInProfileId

// src/state/slices/types.ts (C6)
export type NotificationActionLabelKey = 'notifications.actions.openProjectInfo';
export interface NotificationAction { kind: 'openBackstageSection'; section: BackstageSection; labelKey: NotificationActionLabelKey }
//   AppNotification.action?: NotificationAction
//   NotificationMessageKey += 'notifications.schedulingProfileApplied' | 'notifications.schedulingProfileShifted'

// src/state/schedulingProfileNotice.ts (C6)
export function withSchedulingProfileNotice(results: readonly ImportResult[], xerNotice: NotifyInput | undefined,
  importKey: string): NotifyInput | undefined;

// src/state/schedulingProfileDraft.ts (D2) — puur bewerkmodel; src/state/slices/schedulingProfileSlice.ts (D3)
export interface SchedulingSettingsDraft { profile: SchedulingProfile | undefined; options: ProjectSchedulingOptions | undefined }
//   AppState.applySchedulingSettings(next): { changed: boolean; shifted: number | null }
```

## 2. Banen, bestandskaarten en volgorde

```
  baan A (gebouwd) ──┐
                     ├─► M1 (merge + switchProfile→spec + stubs) ─┬─► baan C: C1…C9 ─────────────────────┐
  baan B (gemerged) ─┘                                            │                                      ├─► I
                                                                  └─► baan D: D1, D2, D7, D8 ─► (merge C) ─► D3–D6, D10 ┘
```

- **C en D zijn disjunct op bestandsniveau.** D's store- en UI-taken (D3–D6) gebruiken `solveInputFor`
  (C1), de lezerprofielen (C3) en de meldingssleutels/-actie (C6); D10 vereist dat de tijdelijke
  vertaling weg is (C3). D haalt daarom vóór D3 `claude/rekenprofielen-baan-c` binnen met `git merge`
  (geen conflict: disjuncte bestanden). D1, D2, D7 en D8 kunnen direct ná M1.
- **Bewuste afwijking van spec §10 stap 6:** de IFC-optieomzetting (A's `INTEGRATIE`-markeringen), het
  verwijderen van B's tijdelijke vertaling en de `p6Source`-testmigratie staan in **baan C** (C2–C4),
  niet in de integratie. Reden: zodra de lezers geen `p6Source` meer zetten (C3), worden de
  `delete p6Source`-mutanten in de tests stille no-ops en gaan die checks rood; de migratie hoort dus in
  dezelfde baan als de lezeromzetting. De integratie verifieert (I2).
- **Waarom C1 vóór de lezers kan.** `effectiveSchedulingOptions` spreidt de conventies als laatste; een
  project zónder profiel maar mét legacy-opties (verse XER-/`.mpp`-import vóór C3) zou zijn conventies
  kwijtraken. `solveOptionsFor` heeft daarom tot C3 een gemarkeerde overgangstak die zulke opties door
  `legacyOptionsToProfile` haalt — dezelfde functie die baan A als byte-identiek test.
- **Goal prompt:** bestaat al (`docs/superpowers/plans/2026-09-22-goalprompt-x12-naar-nul.md`,
  `66418a62`) — geen taak in dit plan; D8 en I verwijzen ernaar.

| baan | bestanden (**M** maken, **W** wijzigen, **X** verwijderen) |
|---|---|
| A (gebouwd) | zie §1.1–1.3 |
| B (gemerged) | zie §1.4 |
| M1 | merges; W `src/engine/scheduler/conventions/registry.ts` (alleen `switchProfile`, M1.2) + W `tests/planning/check-conventions-registry.ts` (idem); W `tests/planning/check-conventions-registry.ts` (M1.3-sectie); W `tests/planning/run.sh`; M zes stubs (M1.5) |
| C | M `src/engine/scheduler/solveInput.ts`; W `src/engine/scheduler/{CPMSolver,solveProject,p6CompletedRouteTrace,p6OpenLoeTargetSpanTrace,p6CompletedTargetWindow}.ts` (typen + C3-opruiming); X `src/engine/scheduler/conventions/legacyP6Source.ts`; W `src/state/slices/{scheduleSlice,documentSlice,projectSlice,fileSlice,types}.ts`; W `src/state/documentActivation.ts`; M `src/state/schedulingProfileNotice.ts`; W `src/components/layout/NotificationHost.tsx`; W `src/components/panels/ResourceOccupancyView.tsx`; W `src/services/library/{occupancy,distribute}.ts`; W `src/services/benchmark/runner.ts`; W `src/services/ifc/{ifcWriter,ifcReader,schedulingOptionsRead}.ts`; W `src/engine/scheduler/conventions/registry.ts` (alleen de `legacyOptionsToProfile`-parametertype in C3); W `src/services/xer/{xerScheduleOptions,xerReader}.ts`; W `src/services/mpp/mppReader.ts`; W `src/services/msproject/mspdiReader.ts`; W `src/services/p6/p6xmlReader.ts`; W `src/services/csv/csvReader.ts`; W `src/services/importTypes.ts`; W `src/types/project.ts`; W `src/services/xerExportLoss.ts`; W `src/extensions/{extTypes,extMappers,apiVersion}.ts`; W `docs/extensions.md`; W `src/services/mcp/tools/{readTools,xerProvenanceTools,calendarResourceTools}.ts`; M `tests/planning/{p6SemanticsOff,legacySolveOptions}.ts`; W `tests/planning/harness.ts` + alle `tests/planning/*.ts` uit de C1-/C4-tabellen + `check-conventions-p6-flags.ts`, `check-conventions-registry.ts` (XER-pin), `check-scheduling-profile-roundtrip.ts`, `check-document-contract.ts`; W de drie C-stubs; M `tests/library/neutralSolveOptions.ts`; W `tests/library/{check-occupancy,check-distribute,check-showcase-occupancy}.ts`; M `tests/mcp/cases-scheduling-profile.ts` |
| D | M `src/state/schedulingProfileDraft.ts`; M `src/state/slices/schedulingProfileSlice.ts`; W `src/state/appStore.ts`; M `src/components/settings/SchedulingProfileSection.tsx`; X `src/components/dialogs/CalcOptionsSection.tsx`; W `src/components/settings/ProjectInfoPanelContent.tsx`; W `src/i18n/locales/*/common.json` + `*/menu.json` (14×2); M `public/docs/{nl,en}/gids-rekenprofielen.md`; W `public/docs/manifest.json`; W `public/docs/{nl,en}/{gids-xer-import,gids-msproject-import,gids-import-export}.md`; W `CLAUDE.md`; M `docs/recepten/conventie.md`; W `docs/recepten/README.md`; W `docs/ifc-round-trip.md`; M `scripts/verify-conventions.mjs`; M `scripts/verify-conventions.datagates.json`; W `scripts/README.md`; W `package.json`; W de drie D-stubs; M `tests/browser/scheduling-profile.spec.ts` |
| I | merges, markeringssweep, poorten, critreview, gebruikstest (productcode alleen als een poort rood is) |

**Bestaande poorten die dit plan gebruikt maar níét bouwt:** de cel-baseline
(`tests/planning/xer-product-fidelity-cells.json`, cel-poort in `check-xer-product-fidelity-x12.ts`, zes
assen + `drivingPath`) en `npm run measure:profiles` (branch `claude/rekenprofielen-celbaseline`). Taak I3
gebruikt ze als landingspoort.

---

## Baan A — *gebouwd* (`claude/rekenprofielen-baan-a`: `5e2084fd`, `56602e59`)

> Geen open taken meer in de baan zelf; de API staat in §1.1–1.3. Wat er bewust nog open ligt en waar
> het landt:
>
> | open punt | landt in |
> |---|---|
> | `switchProfile` houdt alleen `perFile`-afwijkingen; spec v3.1 §3.2 (`594fa2d6`, ná baan A) zegt: overrides op een ingebouwd id **letterlijk** bewaren | M1.2 |
> | optieblok in IFC nog legacy (`INTEGRATIE(rekenprofielen)` in `ifcWriter.ts`/`ifcReader.ts`) | C2 |
> | `legacyOptionsToProfile(blob: SchedulingOptions)` leest `blob.p6Source`; dat type verdwijnt | C3 (parametertype `LegacySchedulingOptions`) |
> | `XER_SCHEDULING_DEFAULTS` draagt nog `p6Source` + conventies (pin in `check-conventions-registry.ts`) | C3 |
> | recovery-round-trip van het profiel in `check-document-contract.ts` | C2 |
> | i18n buiten `profiles.builtIn.*` (nl/en) — `verify:i18n` rood | D1 |
> | sjablonen hebben geen store-veld (bewust: `profileStore` met opslag als parameter) | D4 leest/schrijft ze rechtstreeks |

## Baan B — *gebouwd en gemerged* (`claude/rekenprofielen-baan-b` t/m `893e9955`, merge `e3545ed7`)

> Go na de fixronde (A15–A20 zonder bron weer inert, A19-docblok, CRLF). De API staat in §1.4. Open
> integratiepunt uit de overdracht: een corpusloze tabeltest dat de tijdelijke vertaling en A's
> legacy-migratie per conventie gelijk zijn ⇒ M1.3; de vertaling zelf verdwijnt in C3.

---

## M1 — samenvoegen A + B en de banen C/D voorbereiden

### Task M1.1: Merge en contractcontrole

**Files:** merge-commits op `claude/rekenprofielen`.

- [ ] **Step 1:** `git status --short` (schoon). Baan B is al gemerged (`e3545ed7`); merge nu baan A:
  `git merge --no-ff claude/rekenprofielen-baan-a`. Verwachte conflicten: `src/types/project.ts` (A:
  profieltypen en docblokken van de B-vlaggen; B: dezelfde B-vlaggen + A19-docblok — één set B-velden
  houden, B's docblokken winnen voor de motorsemantiek), `src/services/ifc/schedulingOptionsRead.ts`
  (beide voegden de vijf B-sleutels aan `BOOLEAN_KEYS` toe — één keer houden), `tests/planning/run.sh`
  (beide bedraadden checks — beide blokken houden), `tests/planning/check-ifc-roundtrip.ts` (beide
  hunks houden).
- [ ] **Step 2: contractprobe.** Maak tijdelijk `src/__contractProbe.ts` (niet committen):

```ts
import type { ConventionKey, ProjectOptionKey, ProjectSchedulingOptions, SchedulingConventions,
  EffectiveSchedulingOptions, BuiltInProfileId, SchedulingProfile, Project } from '@/types/project';
import { BUILT_IN_PROFILE_IDS, CONVENTIONS, CONVENTION_KEYS, isConventionKey, isBuiltInProfileId, builtInConventions,
  legacyConventions, builtInProfile, displayNameKey, resolveConventions, diffAgainstBase, isDefaultProfile,
  p6OptionDefaults, defaultOptionsFor, optionKeysOnly, legacyOptionsToProfile, legacyOptionsBlobFor, switchProfile,
  effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { sanitizeSchedulingOptions, sanitizeProjectOptions, sanitizeSchedulingProfile, schedulingProfileToJson,
  sanitizeStoredSchedulingProfile, MAX_PROFILE_JSON_LENGTH, MAX_PROFILE_ID_LENGTH, MAX_PROFILE_NAME_LENGTH } from '@/services/ifc/schedulingOptionsRead';
import { SCHEDULING_PROFILES_KEY, MAX_CUSTOM_PROFILES, loadCustomProfiles, saveCustomProfiles, upsertCustomProfile,
  deleteCustomProfile, type ProfileStorage } from '@/services/schedulingProfiles/profileStore';
import { resolveLegacyP6SourceConventions, LEGACY_P6_SOURCE_CONVENTION_KEYS, LEGACY_P6_SOURCE_GATED_FLAGS } from '@/engine/scheduler/conventions/legacyP6Source';
import type { CPMOptions } from '@/engine/scheduler/CPMSolver';
const k: ConventionKey = 'p6OpenLoeTargetSpan';
const o: ProjectOptionKey = 'lagCalendar';
const p: SchedulingProfile = builtInProfile('p6');
const po: ProjectSchedulingOptions = defaultOptionsFor('msproject');
const c: SchedulingConventions = resolveConventions(p);
const e: EffectiveSchedulingOptions = effectiveSchedulingOptions({ schedulingProfile: p, schedulingOptions: po });
const b: BuiltInProfileId = 'ops';
const pr: Pick<Project, 'schedulingProfile'> = { schedulingProfile: switchProfile(p, 'msproject') };
const hook: CPMOptions['legacyP6SourceTranslation'] = false;
const st: ProfileStorage | undefined = undefined;
void [k, o, po, c, e, b, pr, hook, st, BUILT_IN_PROFILE_IDS, CONVENTIONS, CONVENTION_KEYS, isConventionKey, isBuiltInProfileId,
  builtInConventions, legacyConventions, displayNameKey, diffAgainstBase, isDefaultProfile, p6OptionDefaults, optionKeysOnly,
  legacyOptionsToProfile, legacyOptionsBlobFor, sanitizeSchedulingOptions, sanitizeProjectOptions, sanitizeSchedulingProfile,
  schedulingProfileToJson, sanitizeStoredSchedulingProfile, MAX_PROFILE_JSON_LENGTH, MAX_PROFILE_ID_LENGTH,
  MAX_PROFILE_NAME_LENGTH, SCHEDULING_PROFILES_KEY, MAX_CUSTOM_PROFILES, loadCustomProfiles, saveCustomProfiles,
  upsertCustomProfile, deleteCustomProfile, resolveLegacyP6SourceConventions, LEGACY_P6_SOURCE_CONVENTION_KEYS,
  LEGACY_P6_SOURCE_GATED_FLAGS];
```

  Run: `npx tsc --noEmit -p tsconfig.json` ⇒ 0 fouten. Wijkt een naam af (de fixronde van B kan iets
  hernoemen): pas **dit plan** aan (zoek-en-vervang in de C/D-snippets), niet de code. Verwijder de probe.
- [ ] **Step 3:** `npm run typecheck` ⇒ exit 0.

### Task M1.2: `switchProfile` naar spec v3.1 §3.2 (overrides op een ingebouwd id letterlijk)

**Files:** Modify `src/engine/scheduler/conventions/registry.ts` (`switchProfile`),
`tests/planning/check-conventions-registry.ts` (de `switchProfile`-sectie).

Spec v3.1 §3.2 (commit `594fa2d6`, ná baan A): "Een profielwissel vervangt `baseId` en `id`, maar bewaart
de overrides op een ingebouwd id **letterlijk** — die zijn per definitie uit het bestand of de migratie
(A19 uit `rem_target_link_flag`), want een handmatige wijziging maakt een kopie — zo geeft P6 → MS Project
→ P6 weer exact het resultaat van vlak na het openen." Baan A's `switchProfile` houdt alleen de opgeloste
`perFile`-waarden (A19); een migratie-override (bv. een oud XER-IFC met A18 uit) ging bij P6 → MSP → P6
verloren.

- [ ] **Step 1: falende test** — voeg aan de `switchProfile`-sectie van `check-conventions-registry.ts` toe:

```ts
{
  // Spec v3.1 §3.2: overrides op een INGEBOUWD id blijven letterlijk staan bij een wissel.
  const migrated: SchedulingProfile = { ...builtInProfile('p6'), overrides: { p6PreserveActualInstants: false, p6UseRemainingStartForProgress: true } };
  const there = switchProfile(migrated, 'msproject');
  eq('M1-01 wissel bewaart overrides letterlijk', there.overrides, { p6PreserveActualInstants: false, p6UseRemainingStartForProgress: true });
  eq('M1-02 heen en terug = het origineel', resolveConventions(switchProfile(there, 'p6')), resolveConventions(migrated));
  // Een EIGEN profiel: zijn afwijkingen zijn handmatig; een wissel naar een ingebouwd profiel houdt dan
  // alleen de per-bestand-waarden (A19) — de oude regel van baan A.
  const own: SchedulingProfile = { baseId: 'p6', id: 'prof-own', name: 'Eigen', overrides: { clampNegativeFreeFloat: false, p6UseRemainingStartForProgress: true } };
  eq('M1-03 vanaf een eigen profiel: alleen perFile blijft', switchProfile(own, 'p6'), { ...builtInProfile('p6'), overrides: { p6UseRemainingStartForProgress: true } });
}
```

- [ ] **Step 2:** `bash tests/planning/run.sh check-conventions-registry.ts` ⇒ M1-01/M1-02 rood.
- [ ] **Step 3: implementatie** — vervang de body van `switchProfile`:

```ts
export function switchProfile(profile: SchedulingProfile | undefined, newBaseId: BuiltInProfileId): SchedulingProfile {
  // Spec v3.1 §3.2: overrides op een INGEBOUWD id komen per definitie uit het bestand of de migratie
  // (een handmatige wijziging maakt een kopie met eigen id) en blijven letterlijk staan, zodat
  // P6 → MS Project → P6 exact het resultaat van vlak na het openen teruggeeft. Van een EIGEN profiel
  // blijven alleen de per-bestand-waarden (`perFile`, nu A19).
  if (profile && isBuiltInProfileId(profile.id)) {
    return { ...builtInProfile(newBaseId), overrides: { ...profile.overrides } };
  }
  const current = resolveConventions(profile);
  const kept: Partial<SchedulingConventions> = {};
  for (const d of CONVENTIONS) {
    if (d.perFile) kept[d.id] = current[d.id];
  }
  return { ...builtInProfile(newBaseId), overrides: diffAgainstBase(newBaseId, kept) };
}
```

  Werk het docblok bij (verwijs naar spec §3.2). Bestaande `switchProfile`-asserties die op de oude regel
  steunen bij een ingebouwd id: pas de **verwachting** aan naar de spec en noteer dat in het commitbericht.
- [ ] **Step 4:** groen; mutant: zet de ingebouwd-tak uit (`if (false && …)`) ⇒ M1-01 rood ⇒ herstel.
- [ ] **Step 5:** commit `fix(rekenprofielen): switchProfile bewaart overrides op een ingebouwd id letterlijk (spec v3.1 §3.2)`.
- Hardening: H1 vaste lus; H2 verwachtingen uit de spectekst; H3 mutant.

### Task M1.3: Tabeltest — tijdelijke vertaling ≡ migratie (vóór de laag in C3 verdwijnt)

> Integratiepunt uit de overdracht (baan-B-go): "tabeltest op `resolveLegacyP6SourceConventions` (zes
> gepoorte vlaggen zonder bron ⇒ false) corpusloos toevoegen". Dit bewijst dat de twee legacy-paden —
> B's vertaling in de motor en A's `legacyOptionsToProfile` in de lezer — per conventie hetzelfde
> zeggen. Daarop leunt C3 wanneer het de vertaling schrapt.

**Files:** Modify `tests/planning/check-conventions-registry.ts` (nieuwe sectie "M1.3").

- [ ] **Step 1: test** (imports bovenaan dedupliceren):

```ts
// ── M1.3: B's tijdelijke vertaling en A's migratie zeggen per conventie hetzelfde ──────────────────
// C3 verwijdert deze sectie samen met legacyP6Source.ts.
import { resolveLegacyP6SourceConventions } from '@/engine/scheduler/conventions/legacyP6Source';
{
  const GATED = ['p6ZeroDurationUsesPlannedBoundary', 'p6UseTaskPlannedStartFloor', 'p6FinishMilestoneBoundaryWindow',
    'p6PreserveActualInstants', 'p6UseRemainingStartForProgress', 'p6PreserveZeroDurationConstraintInstants'] as const;
  const allGatedOn = Object.fromEntries(GATED.map(k => [k, true])) as SchedulingOptions;
  const table: Array<[string, SchedulingOptions]> = [
    ['leeg', {}],
    ['alleen p6Source', { p6Source: 'XER' }],
    ['p6Source + A16', { p6Source: 'XER', p6UseTaskPlannedStartFloor: true }],
    ['p6Source + B1 expliciet uit', { p6Source: 'XER', p6RelationFinishBoundary: false }],
    ['zes gepoorte vlaggen zonder bron', allGatedOn],
    ['zes gepoorte + A12/A13 zonder bron', { ...allGatedOn, preserveActualDatesInBackwardPass: true, clampNegativeFreeFloat: true }],
    ['.mpp-vlaggen', { resumeFromActualElapsed: true, unstartedIgnoresStatusDate: true }],
    ['alleen A22', { resumeFromActualElapsed: true }],
    ['XER-defaults zoals de lezer ze zaait', { ...XER_SCHEDULING_DEFAULTS.schedulingOptions }],
  ];
  for (const [label, blob] of table) {
    const viaLayer = resolveLegacyP6SourceConventions(blob) ?? {};
    const migrated = legacyOptionsToProfile(blob);
    const viaMigration = effectiveSchedulingOptions({ schedulingProfile: migrated.profile, schedulingOptions: migrated.options });
    for (const key of CONVENTION_KEYS) {
      eq(`M1.3 ${label}: ${key}`, viaMigration[key], viaLayer[key] === true);
    }
  }
  eq('M1.3 zonder bron zijn de zes gepoorte vlaggen uit (laag)',
    GATED.map(k => (resolveLegacyP6SourceConventions(allGatedOn) ?? {})[k] === true), GATED.map(() => false));
}
```

  (Een uitkomst "afwezig" in de laag telt als `false` — zo rekende de solver ermee. Een expliciete
  `false` voor een B-vlag onder `p6Source` wint in de laag én in de migratie.)
- [ ] **Step 2:** `bash tests/planning/run.sh check-conventions-registry.ts` ⇒ groen (beide paden zijn al
  gebouwd; deze test legt vast dát ze overeenkomen). Mutant: zet in `legacyOptionsToProfile` de
  B-groep zonder `p6Source` op `true` ⇒ rij "zes gepoorte vlaggen zonder bron" rood ⇒ herstel. Tweede
  mutant: laat in `resolveLegacyP6SourceConventions` het uitzetten van de gepoorte vlaggen weg ⇒ de
  slot-assertie rood.
- [ ] **Step 3:** commit `test(rekenprofielen): tijdelijke vertaling en legacy-migratie zijn per conventie gelijk`.
- Hardening: H2 de tabel is invoer, de verwachting komt uit de ándere implementatie (twee onafhankelijke
  paden); H3 twee mutanten.

### Task M1.4: Poorten op het mergepunt (integratiepunt: volledige suite toegestaan, één tegelijk)

- [ ] `bash tests/planning/run.sh > /tmp/m1-planning.log 2>&1; echo "exit $?"` ⇒ exit 0. Elke `XX`-regel
  of stacktrace blokkeert C/D.
- [ ] `npm run measure:profiles` (als de cel-baseline al op de branch staat; anders X12 en
  `check-mpp-fidelity` los met `OPS_XER_CORPUS="/home/nozzit/open-aec/voor claude/testdata-crawl"`):
  X12 exact 15.056, `.mpp` GOAL_ZERO groen met 216 pins ongewijzigd. Getallen in het mergecommitbericht.
- [ ] `npm run verify:i18n` is **bekend rood** (baan A: `profiles.builtIn.*` alleen nl/en) tot D1 — noteer
  dat in het mergecommitbericht; geen andere `verify`-deelpoort mag rood zijn.

### Task M1.5: Stubs en bedrading voor de nieuwe checks van C en D

**Files:** Modify `tests/planning/run.sh`; Create de zes stubs.

Elke stub heeft exact deze inhoud (naam/baan/taak per bestand invullen):

```ts
// STUB(rekenprofielen) — baan <C|D> vervangt dit bestand volledig in taak <taak>.
// Taak I2 faalt zolang deze markering ergens in tests/ staat.
console.log('OK: stub <bestandsnaam> — nog niet ingevuld');
```

| stub | baan / taak |
|---|---|
| `tests/planning/check-solve-input.ts` | C1 (C5 breidt uit) |
| `tests/planning/check-import-profile.ts` | C3 |
| `tests/planning/check-scheduling-profile-notice.ts` | C6 |
| `tests/planning/check-scheduling-profile-draft.ts` | D2 |
| `tests/planning/check-scheduling-profile-actions.ts` | D3 |
| `tests/planning/check-conventions-boundary.ts` | D10 |

Bedrading in `run.sh`, direct ná het rekenprofielen-blok van baan A (zoek
`SCHEDPROFRTCHECK="$DIR/.scheduling-profile-roundtrip.mjs"` en voeg ná die `if bundle_check …`-regel in):

```bash
  # Rekenprofielen (plan 2026-09-22): solver-invoer, lezerprofielen, melding, afnemers, bewerkmodel,
  # store-acties en de conventiegrens van de motor. Vooraf bedraad in M1 zodat banen C en D run.sh
  # niet hoeven aan te raken.
  SOLVEINPUTCHECK="$DIR/.solve-input.mjs"
  if bundle_check "$DIR/check-solve-input.ts" "$SOLVEINPUTCHECK"; then node "$SOLVEINPUTCHECK" || STATUS=1; fi
  IMPORTPROFILECHECK="$DIR/.import-profile.mjs"
  if bundle_check "$DIR/check-import-profile.ts" "$IMPORTPROFILECHECK"; then node "$IMPORTPROFILECHECK" || STATUS=1; fi
  PROFILENOTICECHECK="$DIR/.scheduling-profile-notice.mjs"
  if bundle_check "$DIR/check-scheduling-profile-notice.ts" "$PROFILENOTICECHECK"; then node "$PROFILENOTICECHECK" || STATUS=1; fi
  PROFILEDRAFTCHECK="$DIR/.scheduling-profile-draft.mjs"
  if bundle_check "$DIR/check-scheduling-profile-draft.ts" "$PROFILEDRAFTCHECK"; then node "$PROFILEDRAFTCHECK" || STATUS=1; fi
  PROFILEACTIONSCHECK="$DIR/.scheduling-profile-actions.mjs"
  if bundle_check "$DIR/check-scheduling-profile-actions.ts" "$PROFILEACTIONSCHECK"; then node "$PROFILEACTIONSCHECK" || STATUS=1; fi
  CONVBOUNDARYCHECK="$DIR/.conventions-boundary.mjs"
  if bundle_check "$DIR/check-conventions-boundary.ts" "$CONVBOUNDARYCHECK"; then node "$CONVBOUNDARYCHECK" || STATUS=1; fi
```

- [ ] Step 1: stubs + bedrading. Step 2: `bash tests/planning/run.sh check-solve-input.ts
  check-import-profile.ts check-scheduling-profile-notice.ts
  check-scheduling-profile-draft.ts check-scheduling-profile-actions.ts check-conventions-boundary.ts` ⇒
  exit 0, zes OK-regels. Step 3: `git status --short`; stage `tests/planning/run.sh` + de zes stubs;
  commit `chore(rekenprofielen): M1 — stubs en bedrading voor banen C en D`.
- [ ] Step 4: `git branch claude/rekenprofielen-baan-c` en `git branch claude/rekenprofielen-baan-d` vanaf
  deze commit; elke baan in een **eigen worktree** (nooit twee banen in één worktree); pushen.

---

## Baan C — solver-invoer, IFC-omzetting, lezers, testmigratie, melding, afnemers

Werk in de worktree van `claude/rekenprofielen-baan-c`. Volgorde C1 → C9 (C3 en C4 horen samen: tussen
die twee commits zijn de `p6Source`-checks bewust rood; push pas ná C4).

### Task C1: `solveOptionsFor`/`solveInputFor` + verplicht `EffectiveSchedulingOptions` (gedragsbehoudend)

**Files:**
- Create: `src/engine/scheduler/solveInput.ts`
- Modify: `src/engine/scheduler/CPMSolver.ts` (alleen `CPMOptions.schedulingOptions`)
- Modify: `src/engine/scheduler/solveProject.ts` (alleen `SolveProjectInput.schedulingOptions` + de doorgifte)
- Modify: `src/state/slices/scheduleSlice.ts` (r.~127 `runCPM`, r.~251 `levelResources`)
- Modify: `src/state/slices/documentSlice.ts` (r.~712 `recalculateStaleSleepingDocuments`)
- Modify: `src/state/slices/projectSlice.ts` (r.~379 `previewMoveProject`)
- Modify: `src/state/documentActivation.ts` (r.~198 `prepareLoadedPayload`)
- Modify: `src/services/library/occupancy.ts`, `src/services/library/distribute.ts`
- Modify: `src/components/panels/ResourceOccupancyView.tsx` (r.~276)
- Modify: `src/services/benchmark/runner.ts` (r.~152)
- Create: `tests/planning/legacySolveOptions.ts`, `tests/library/neutralSolveOptions.ts`
- Modify: elke test die `solveProject(`/`new CPMSolver(`/`levelResources(`/`computeLeveling(` aanroept
  (inventaris: `grep -rln "new CPMSolver(\|solveProject(\|levelResources(\|computeLeveling(" tests scripts`
  — 44 bestanden bij het schrijven)
- Test: `tests/planning/check-solve-input.ts` (vervangt de M1-stub)

- [ ] **Step 1: falende test** — vervang `tests/planning/check-solve-input.ts` volledig door:

```ts
// Solver-invoer (rekenprofielen, spec v3.1 §3.1/§3.2; plan taak C1, C5 breidt uit). Exit 0 = groen.
//
// Wat hier bewezen wordt: (1) solveOptionsFor neemt de vijf projectvelden letterlijk over en levert
// EffectiveSchedulingOptions (conventies uit het profiel, als LAATSTE gespreid); (2) compile-time: een
// kale projectoptie-set is geen geldige CPMOptions (de @ts-expect-error hieronder faalt `npm run
// typecheck` zodra het veld optioneel of breder wordt — mutant in het plan, taak C1 step 7).
import { solveOptionsFor, solveInputFor } from '@/engine/scheduler/solveInput';
import { CONVENTION_KEYS, builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import type { EffectiveSchedulingOptions, ProjectSchedulingOptions } from '@/types/project';
import type { CPMOptions } from '@/engine/scheduler/CPMSolver';
import type { SolveProjectInput } from '@/engine/scheduler/solveProject';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const project = {
  ...createDefaultProject(),
  startDate: '2026-06-01', endDate: '2026-12-31', statusDate: '2026-07-01',
  progressMode: 'PROGRESS_OVERRIDE' as const,
  schedulingOptions: { lagCalendar: 'successor' as const },
};
const o = solveOptionsFor(project);
eq('01 vijf projectvelden letterlijk', [o.dataDate, o.progressMode, o.projectStartDate, o.projectEndDate],
  ['2026-07-01', 'PROGRESS_OVERRIDE', '2026-06-01', '2026-12-31']);
eq('02 zonder profiel: vijftien conventies uit', CONVENTION_KEYS.map(k => o.schedulingOptions[k]), CONVENTION_KEYS.map(() => false));
eq('03 projectopties komen mee', o.schedulingOptions.lagCalendar, 'successor');
eq('04 p6-profiel zet B1 aan',
  solveOptionsFor({ ...project, schedulingProfile: builtInProfile('p6') }).schedulingOptions.p6RelationFinishBoundary, true);
const stray = {
  ...project, schedulingProfile: builtInProfile('ops'),
  schedulingOptions: { clampNegativeFreeFloat: true } as unknown as ProjectSchedulingOptions,
};
eq('05 profiel wint van een verdwaalde conventiesleutel in de opties', solveOptionsFor(stray).schedulingOptions.clampNegativeFreeFloat, false);
// TIJDELIJK(rekenprofielen): tot C3 dragen verse XER-imports hun p6Source nog in de opties.
const legacy = { ...project, schedulingOptions: { p6Source: 'XER' } as unknown as ProjectSchedulingOptions };
eq('06 TIJDELIJK legacy p6Source ⇒ B-vlaggen aan', solveOptionsFor(legacy).schedulingOptions.p6OpenLoeTargetSpan, true);
const cal = createDefaultCalendar();
const input: SolveProjectInput = solveInputFor(project, [], [], cal, [cal]);
eq('07 solveInputFor = invoerlijsten + solveOptionsFor', [input.projectStartDate, input.calendar === cal, input.schedulingOptions.lagCalendar],
  ['2026-06-01', true, 'successor']);

// Compile-time bewijs (npm run typecheck): een kale projectoptie-set is GEEN solverinvoer.
// @ts-expect-error — CPMOptions.schedulingOptions eist EffectiveSchedulingOptions (conventies verplicht)
const bad: CPMOptions = { schedulingOptions: { lagCalendar: 'successor' } as ProjectSchedulingOptions };
const good: CPMOptions = { schedulingOptions: effectiveSchedulingOptions({}) satisfies EffectiveSchedulingOptions };
void bad; void good;

if (diffs.length === 0) console.log(`OK: solver-invoer — ${checks} checks groen`);
else { console.log(`XX solver-invoer — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
```

- [ ] **Step 2:** `bash tests/planning/run.sh check-solve-input.ts` ⇒ rood (`solveInput` ontbreekt:
  "XX  bundelen mislukt").
- [ ] **Step 3: implementatie** — `src/engine/scheduler/solveInput.ts`:

```ts
// De ENIGE weg van een project naar de solver (rekenprofielen, spec v3.1 §3.2).
//
// `solveOptionsFor` levert de volledige solve-opties van een project: de effectieve reken-opties
// (conventies uit het profiel, projectopties uit het bestand — `effectiveSchedulingOptions`), plus
// statusdatum, voortgangsmodus en de twee projectdatums. `solveInputFor` plakt daar de vier
// invoerlijsten bij. `CPMOptions.schedulingOptions` is verplicht `EffectiveSchedulingOptions`: wie deze
// helper overslaat en een kale `project.schedulingOptions` doorgeeft, compileert niet.
import type {
  EffectiveSchedulingOptions, Project, ProgressMode, SchedulingOptions,
} from '@/types/project';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import {
  CONVENTION_KEYS, effectiveSchedulingOptions,
  legacyOptionsToProfile, // TIJDELIJK(rekenprofielen)
} from './conventions/registry';
import type { SolveProjectInput } from './solveProject';

export type SolveProjectFields = Pick<Project,
  'statusDate' | 'progressMode' | 'schedulingOptions' | 'schedulingProfile' | 'startDate' | 'endDate'>;

export interface ProjectSolveOptions {
  dataDate: string | undefined;
  progressMode: ProgressMode | undefined;
  schedulingOptions: EffectiveSchedulingOptions;
  projectStartDate: string | undefined;
  projectEndDate: string | undefined;
}

/** TIJDELIJK(rekenprofielen): tot C3 dragen verse XER-/.mpp-imports hun conventies (en `p6Source`) nog
 *  in `project.schedulingOptions`, zonder profiel. Omdat de conventies als LAATSTE gespreid worden,
 *  gingen ze anders verloren; deze tak haalt zulke opties door dezelfde migratie die baan A byte-identiek
 *  bewijst. C3 verwijdert hem (de lezers zetten dan zelf het profiel). */
function settingsOf(project: SolveProjectFields): Pick<Project, 'schedulingProfile' | 'schedulingOptions'> {
  const raw = project.schedulingOptions as Record<string, unknown> | undefined;
  const legacy = project.schedulingProfile === undefined && raw !== undefined
    && ('p6Source' in raw || CONVENTION_KEYS.some(key => key in raw));
  if (!legacy) return { schedulingProfile: project.schedulingProfile, schedulingOptions: project.schedulingOptions };
  const migrated = legacyOptionsToProfile(project.schedulingOptions as SchedulingOptions);
  return { schedulingProfile: migrated.profile, schedulingOptions: migrated.options };
}

export function solveOptionsFor(project: SolveProjectFields): ProjectSolveOptions {
  return {
    dataDate: project.statusDate,
    progressMode: project.progressMode,
    schedulingOptions: effectiveSchedulingOptions(settingsOf(project)),
    projectStartDate: project.startDate,
    projectEndDate: project.endDate,
  };
}

export function solveInputFor(
  project: SolveProjectFields, tasks: Task[], sequences: Sequence[],
  calendar: WorkCalendar, calendars: WorkCalendar[],
): SolveProjectInput {
  return { tasks, sequences, calendar, calendars, ...solveOptionsFor(project) };
}
```

- [ ] **Step 4: verplicht type.** In `CPMSolver.ts` wordt het veld in `export interface CPMOptions`:

```ts
  /** Rekenprofielen (spec v3.1 §3.1): verplicht en uitsluitend het opgeloste type. Aanroepers komen
   *  hier via `solveOptionsFor`/`solveInputFor` (`solveInput.ts`) of `effectiveSchedulingOptions`. */
  schedulingOptions: EffectiveSchedulingOptions;
```

  (import `type EffectiveSchedulingOptions` uit `@/types/project`; de bestaande
  `this.options.schedulingOptions?.x`-lezingen mogen blijven). In `solveProject.ts`:
  `schedulingOptions: EffectiveSchedulingOptions;` in `SolveProjectInput` (overige velden blijven
  optioneel), doorgifte `schedulingOptions: input.schedulingOptions`. B's tijdelijke vertaling in de
  `CPMSolver`-constructor (`resolveLegacyP6SourceConventions`) blijft tot C3 staan; typ haar
  resultaat intern als `SchedulingOptions` als het verplichte type in de weg zit (geen gedragswijziging:
  `EffectiveSchedulingOptions` draagt geen `p6Source` en alle B-vlaggen expliciet, dus de vertaling is
  voor elke aanroeper via `solveOptionsFor` een no-op).
- [ ] **Step 5: productie-aanroepers** (per bestand exact deze vorm; commentaar dat erboven stond blijft):

```ts
// scheduleSlice.ts — runCPM (vervangt het hele solveProject({ … })-object)
      const result = solveProject(solveInputFor(s.project, s.tasks, s.sequences, s.calendar, s.calendars));

// scheduleSlice.ts — levelResources (vervangt het laatste argument van computeLeveling)
      solveOptionsFor(s.project),

// documentSlice.ts — recalculateStaleSleepingDocuments
        const result = solveProject(
          solveInputFor(payload.project, tasks, payload.sequences, payload.calendar, payload.calendars));

// projectSlice.ts — previewMoveProject (de "voor"/"na"-solve)
      return new CPMSolver(leaf, expandedSequences, s.calendar, s.calendars, {
        ...solveOptionsFor(s.project),
        dataDate,
        projectStartDate,
        projectEndDate,
      }).solve();

// documentActivation.ts — prepareLoadedPayload
  payload.cpmResult = solveProject({
    ...solveInputFor(payload.project, payload.tasks, payload.sequences, payload.calendar, payload.calendars),
    // C5-GEDRAGSWIJZIGING: het laadpad gaf nooit projectEndDate door; taak C5 laat deze regel vallen.
    projectEndDate: undefined,
  });

// benchmark/runner.ts — CPM-fase
    const solver = new CPMSolver(leafTasks, expandedSequences, data.calendar, [], {
      // C5-GEDRAGSWIJZIGING: de benchmark rekende altijd met lege opties; taak C5 ⇒ solveOptionsFor(data.project).
      schedulingOptions: effectiveSchedulingOptions({}),
    });
```

  `occupancy.ts` — de invoervorm wordt de volledige solve-opties plus één bouwfunctie die de UI gebruikt:

```ts
export interface OccupancySolveInput {
  /** De VOLLEDIGE takenlijst van het document (zie de oude toelichting — ongewijzigd). */
  tasks: Task[];
  sequences: Sequence[];
  /** De solve-opties van het document, via `occupancySolveInputFor` ⇒ `solveOptionsFor(project)`. */
  options: ProjectSolveOptions;
}

/** Bouw de efemere solve-invoer van een document. De ENIGE bouwplek (ResourceOccupancyView gebruikt
 *  hem), zodat C5 de onvolledigheid op één plek repareert en test. */
export function occupancySolveInputFor(
  payload: { tasks: Task[]; sequences: Sequence[]; project: SolveProjectFields },
): OccupancySolveInput {
  return {
    tasks: payload.tasks,
    sequences: payload.sequences,
    options: {
      ...solveOptionsFor(payload.project),
      // C5-GEDRAGSWIJZIGING: de efemere solve gaf nooit projectdatums door; taak C5 laat deze twee vallen.
      projectStartDate: undefined,
      projectEndDate: undefined,
    },
  };
}

// in ephemeralSolve:
  const result = solveProject({
    tasks, sequences: input.sequences, calendar: doc.calendar, calendars: doc.calendars, ...input.options,
  });
```

  `ResourceOccupancyView.tsx`: `...(isActive ? {} : { solveInput: occupancySolveInputFor(payload) }),`.
  `distribute.ts` (`defaultLevelRun` en `currentProjectEndFor`): `solveProject({ tasks, sequences:
  doc.levelInput.sequences, calendar: doc.calendar, calendars: doc.calendars, ...doc.levelInput.options })`
  en als laatste argument van `levelResources` `doc.levelInput.options`.
- [ ] **Step 6: testaanroepers** (typecheck-gedreven). Maak eerst de twee helpers:

```ts
// tests/planning/legacySolveOptions.ts
// Testhulp (rekenprofielen C1): een oude SchedulingOptions-blob (evt. met p6Source en conventiesleutels)
// omzetten naar solverinvoer via EXACT de migratie die een IFC-bestand krijgt (baan A; M1.3 bewijst gelijkheid met de oude laag).
import { effectiveSchedulingOptions, legacyOptionsToProfile } from '@/engine/scheduler/conventions/registry';
import type { EffectiveSchedulingOptions, SchedulingOptions } from '@/types/project';

export function legacyEffective(blob: SchedulingOptions & { p6Source?: 'XER' }): EffectiveSchedulingOptions {
  const { profile, options } = legacyOptionsToProfile(blob);
  return effectiveSchedulingOptions({ schedulingProfile: profile, schedulingOptions: options });
}
```

```ts
// tests/library/neutralSolveOptions.ts
// De solve-opties die de bibliotheektests vóór de rekenprofielen impliciet gebruikten: geen statusdatum,
// geen projectdatums, OPS-conventies, geen opties — byte-identiek met de oude aanroepen.
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import type { ProjectSolveOptions } from '@/engine/scheduler/solveInput';

export const neutralSolveOptions = (): ProjectSolveOptions => ({
  dataDate: undefined, progressMode: undefined, schedulingOptions: effectiveSchedulingOptions({}),
  projectStartDate: undefined, projectEndDate: undefined,
});
```

  Vervangregels per aanroepvorm (`npm run typecheck` wijst elke plek aan):

| vorm in de test | vervanging |
|---|---|
| `solveProject({ …, dataDate: X.project.statusDate, progressMode: X.project.progressMode, schedulingOptions: X.project.schedulingOptions, projectStartDate: X.project.startDate[, projectEndDate: X.project.endDate] })` | `solveProject({ ...solveInputFor(X.project, tasks, sequences, calendar, calendars)[, projectEndDate: undefined] })` — een veld dat het origineel **wegliet** wordt ná de spread expliciet `undefined` (gedrag identiek) |
| `schedulingOptions: <literal zonder conventiesleutel/p6Source>` | `schedulingOptions: effectiveSchedulingOptions({ schedulingOptions: <literal> })` |
| `schedulingOptions: <literal mét conventiesleutel of p6Source>` | `schedulingOptions: legacyEffective(<literal>)` |
| `schedulingOptions: X.project.schedulingOptions` zonder de andere projectvelden | `schedulingOptions: solveOptionsFor(X.project).schedulingOptions` |
| geen `schedulingOptions` / `new CPMSolver(…, {})` | `schedulingOptions: effectiveSchedulingOptions({})` erbij |
| bibliotheektests: `solveInput`/`levelInput: { tasks, sequences }` | `{ tasks, sequences, options: neutralSolveOptions() }` |

- [ ] **Step 7: groen + mutant.** `npm run typecheck` ⇒ exit 0. Gericht:
  `bash tests/planning/run.sh check-solve-input.ts check-project-start-anchor.ts check-recorded-dates.ts
  check-move-project.ts check-xer-schedule-options-wiring.ts check-xer-progress.ts check-mpp-import.ts`
  en `bash tests/library/run.sh check-occupancy.ts check-distribute.ts check-showcase-occupancy.ts` ⇒
  exit 0. Mutant: maak `schedulingOptions?:` optioneel in `CPMOptions` ⇒ `npm run typecheck` rood op
  "Unused '@ts-expect-error' directive" in `check-solve-input.ts` ⇒ herstel ⇒ groen.
- [ ] **Step 8:** `git status --short`; stage precies de bestanden van deze taak; commit
  `refactor(rekenprofielen): solveInputFor als enige solveringang, EffectiveSchedulingOptions verplicht`.
- Hardening: H1 `CONVENTION_KEYS.some` over een vaste lijst; H2 verwachte waarden uit de fixture zelf;
  H3 compile-mutant step 7; H4 geen modulestaat; H5 geen try/catch.

### Task C2: IFC-optieblok omzetten (A's `INTEGRATIE`-markeringen) + recovery-bewijs

> Baan A schrijft en leest `OPS_SchedulingProfile` al. Open is het **optieblok**: de schrijver schrijft
> nog de legacy-opties (incl. `p6Source`/conventies), de lezer zet ze nog ongestript op het project.

**Files:**
- Modify: `src/services/ifc/ifcWriter.ts` (r.~331, de `INTEGRATIE(rekenprofielen)`-regel bij `writeSchedulingOptionsMeta`)
- Modify: `src/services/ifc/ifcReader.ts` (r.~247, de `INTEGRATIE(rekenprofielen)`-regel bij `extractSchedulingOptions`)
- Modify: `tests/planning/check-scheduling-profile-roundtrip.ts` (sectie "C2 optieblok")
- Modify: `tests/planning/check-ifc-roundtrip.ts` (fixture `SCHED_OPTS` r.~377 en de vijandige blob r.~845 — voor zover A/B ze nog niet omzetten)
- Modify: `tests/planning/check-document-contract.ts` (recovery-round-trip van het profiel)

- [ ] **Step 1: falende test** — voeg aan `check-scheduling-profile-roundtrip.ts` toe (imports bovenaan
  dedupliceren met wat er al staat):

```ts
// ── C2: het optieblok in het eindmodel ──────────────────────────────────────────────────────────
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { freshPayload } from '@/state/documentContract';
import type { ProjectSchedulingOptions } from '@/types/project';

const OPTIONS_JSON = /IFCPROPERTYSINGLEVALUE\('SchedulingOptions',\$,IFCTEXT\('([^']*)'\),\$\)/;
const optionsJsonOf = (ifc: string): string | undefined => OPTIONS_JSON.exec(ifc)?.[1];
function roundTripC2(profile: SchedulingProfile | undefined, options: ProjectSchedulingOptions | SchedulingOptions | undefined) {
  const base = freshPayload();
  const written = writeIFC(buildWriteIFCInput({ ...base, project: { ...base.project, schedulingProfile: profile, schedulingOptions: options } }));
  return { written, read: readIFC(written).project };
}
{
  const opts: ProjectSchedulingOptions = { totalFloatMode: 'finish', useProjectEndDateForFloat: true };
  const { written, read } = roundTripC2(builtInProfile('p6'), opts);
  eq('C2-01 P6: optieblok = alleen de projectopties', optionsJsonOf(written), JSON.stringify(opts));
  eq('C2-02 P6: opties lezen terug zonder conventies', read.schedulingOptions, opts);
}
{
  const { written, read } = roundTripC2(builtInProfile('msproject'), undefined);
  eq('C2-03 MS Project: A22/A23 gespiegeld, alleen als true (compat oude versies)',
    optionsJsonOf(written), '{"resumeFromActualElapsed":true,"unstartedIgnoresStatusDate":true}');
  eq('C2-04 gespiegelde conventies komen niet terug als optie', read.schedulingOptions, undefined);
  eq('C2-05 profiel wint van de spiegel', read.schedulingProfile, builtInProfile('msproject'));
}
{
  const { written, read } = roundTripC2(undefined, { lagCalendar: 'successor' });
  eq('C2-06 OPS: geen profiel-pset', written.includes('OPS_SchedulingProfile'), false);
  eq('C2-07 OPS: optieblok byte-identiek aan vóór de profielen', optionsJsonOf(written), '{"lagCalendar":"successor"}');
  eq('C2-08 OPS leest terug zonder profiel', [read.schedulingProfile, read.schedulingOptions], [undefined, { lagCalendar: 'successor' }]);
}
{
  // TIJDELIJK(rekenprofielen): een verse XER-import vóór C3 heeft nog geen profiel maar legacy-opties.
  const legacy = { ...XER_SCHEDULING_DEFAULTS.schedulingOptions } as SchedulingOptions;
  const { written, read } = roundTripC2(undefined, legacy);
  eq('C2-09 TIJDELIJK legacy-XER-opties ⇒ P6-profiel in het bestand', read.schedulingProfile?.baseId, 'p6');
  eq('C2-10 TIJDELIJK en het optieblok draagt geen p6Source meer', (optionsJsonOf(written) ?? '').includes('p6Source'), false);
}
```

  (`XER_SCHEDULING_DEFAULTS` importeren uit `@/services/xer/xerScheduleOptions`; C3 schrapt C2-09/C2-10
  samen met de overgangstak.)
- [ ] **Step 2:** `bash tests/planning/run.sh check-scheduling-profile-roundtrip.ts` ⇒ rood op C2-01,
  C2-02, C2-04, C2-10.
- [ ] **Step 3: implementatie** — `ifcWriter.ts`, vervang het `INTEGRATIE`-commentaar + de twee
  schrijfregels door:

```ts
  // Rekenprofielen (spec v3.1 §3.3): OPS_SchedulingOptions = projectopties + A22/A23 alleen als ze
  // opgelost true zijn (compat met uitgebrachte versies); het profiel staat in OPS_SchedulingProfile,
  // alleen als het ≠ het standaardprofiel (OPS-bestanden blijven byte-identiek).
  const scheduling = schedulingSettingsForWrite(project);
  writeSchedulingOptionsMeta(ctx, workSchedId, legacyOptionsBlobFor(scheduling), ownerHistId);
  writeSchedulingProfileMeta(ctx, workSchedId, scheduling.schedulingProfile, ownerHistId);
```

  en naast `writeSchedulingOptionsMeta`:

```ts
/** TIJDELIJK(rekenprofielen): tot C3 hebben verse XER-/.mpp-imports nog geen profiel maar legacy-opties
 *  met conventies (en `p6Source`). Die gaan hier door dezelfde migratie als bij het lezen. */
function schedulingSettingsForWrite(project: Project): Pick<Project, 'schedulingProfile' | 'schedulingOptions'> {
  const raw = project.schedulingOptions as Record<string, unknown> | undefined;
  if (project.schedulingProfile === undefined && raw !== undefined
    && ('p6Source' in raw || CONVENTION_KEYS.some(key => key in raw))) {
    const migrated = legacyOptionsToProfile(project.schedulingOptions);
    return { schedulingProfile: migrated.profile, schedulingOptions: migrated.options };
  }
  return { schedulingProfile: project.schedulingProfile, schedulingOptions: project.schedulingOptions };
}
```

  (imports `CONVENTION_KEYS`, `legacyOptionsBlobFor`, `legacyOptionsToProfile` uit
  `@/engine/scheduler/conventions/registry`; `writeSchedulingProfileMeta` slaat het standaardprofiel al
  over.) `ifcReader.ts`, vervang het `INTEGRATIE`-commentaar + `if (schedulingOptions) project.schedulingOptions = schedulingOptions;` door:

```ts
  // Rekenprofielen (spec v3.1 §3.3): eerst `legacyOptionsToProfile` over het gelezen blok (het profiel
  // hieronder komt alleen daaruit als er geen OPS_SchedulingProfile is), dán conventiesleutels en
  // `p6Source` strippen: het project draagt alleen projectopties.
  const projectOptions = legacyOptionsToProfile(schedulingOptions).options;
  if (projectOptions) project.schedulingOptions = projectOptions;
```

  (de bestaande profielregels van baan A eronder blijven ongewijzigd.)
- [ ] **Step 4: bestaande asserties.** `check-ifc-roundtrip.ts` (alleen wat A/B nog niet omzetten): de
  fixture `SCHED_OPTS` wordt `SCHED_OPTS` (alleen de negen projectopties, waarden ongewijzigd) plus op
  het fixtureproject `schedulingProfile: { baseId: 'p6', id: 'prof-fixture', name: 'Fixtureprofiel',
  overrides: { clampNegativeFreeFloat: false, p6UseRemainingStartForProgress: true } }`; de canon vergelijkt
  beide. De vijandige blob (r.~850) verwacht `project.schedulingOptions` ≡
  `{ p6CompletedLateFromRemainingWindow: true, totalFloatMode: 'finish' }` en een p6-profiel met als
  overrides precies de zeven eigen-sleutel-conventies van de p6-basis die de blob niet geldig draagt
  (`preserveActualDatesInBackwardPass, clampNegativeFreeFloat, p6ZeroDurationUsesPlannedBoundary,
  p6UseTaskPlannedStartFloor, p6FinishMilestoneBoundaryWindow, p6PreserveActualInstants,
  p6PreserveZeroDurationConstraintInstants` ⇒ `false`; A19 staat op de p6-basis al uit). Voeg de
  **vijandige blob zónder `p6Source`** toe (alle zes A15–A20 `true`) ⇒ `schedulingProfile === undefined`
  en opties zonder die sleutels. `check-document-contract.ts`: voeg de recovery-assertie toe — een
  document met `schedulingProfile: builtInProfile('p6')` gaat via `capturePayload` → `writeIFC` →
  `readIFC` → `payloadFromInput` terug en draagt daarna hetzelfde profiel.
- [ ] **Step 5:** `bash tests/planning/run.sh check-scheduling-profile-roundtrip.ts check-ifc-roundtrip.ts
  check-document-contract.ts check-xer-recorded-roundtrip.ts check-conventions-registry.ts` ⇒ exit 0.
  Mutant: laat de strip in de lezer weg ⇒ C2-02 rood ⇒ herstel. (Bestaat een genoemde check niet, zoek
  de echte naam met `ls tests/planning/check-*`; neem geen check weg.)
- [ ] **Step 6:** commit `feat(rekenprofielen): IFC-optieblok draagt alleen projectopties (+ A22/A23 als true)`.
- Hardening: H1 de JSON-lezing blijft begrensd door `MAX_PROFILE_JSON_LENGTH` en de sanitizers; H2
  JSON-verwachtingen met de hand; H3 mutant step 5; H5 de bestaande corrupte-JSON-`catch` in
  `extractSchedulingOptions` houdt zijn fixture (controleer dat die nog raakt).

### Task C3: Lezers op het profiel, `Project.schedulingOptions` versmald, tijdelijke lagen weg

**Files:**
- Modify: `src/services/xer/xerScheduleOptions.ts`, `src/services/xer/xerReader.ts` (r.~966 projectliteral)
- Modify: `src/services/mpp/mppReader.ts` (r.~1346 `parseProjectProperties`, en het resultaat van `readMPP`)
- Modify: `src/services/msproject/mspdiReader.ts`, `src/services/p6/p6xmlReader.ts`, `src/services/csv/csvReader.ts` (alleen `suggestedProfileId`)
- Modify: `src/services/importTypes.ts` (`suggestedProfileId`)
- Modify: `src/types/project.ts` (`p6Source` uit `SchedulingOptions`, `LegacySchedulingOptions` erbij, `schedulingOptions?: ProjectSchedulingOptions`, `ProjectOptionKey` zonder `'p6Source'`)
- Modify: `src/services/ifc/schedulingOptionsRead.ts` (`sanitizeSchedulingOptions` geeft `LegacySchedulingOptions`)
- Modify: `src/engine/scheduler/conventions/registry.ts` (alleen: `legacyOptionsToProfile(blob: LegacySchedulingOptions | undefined)`)
- Modify: `src/engine/scheduler/solveInput.ts`, `src/services/ifc/ifcWriter.ts` (TIJDELIJK-takken weg)
- Delete: `src/engine/scheduler/conventions/legacyP6Source.ts`; Modify `src/engine/scheduler/{CPMSolver,solveProject,p6CompletedRouteTrace,p6OpenLoeTargetSpanTrace,p6CompletedTargetWindow}.ts` (vertaling + testhaak `legacyP6SourceTranslation` weg)
- Modify: `tests/planning/harness.ts` (r.~619, legacy-adapter voor `cases-*.json`)
- Modify: `tests/planning/check-solve-input.ts` (assertie 06 weg), `tests/planning/check-scheduling-profile-roundtrip.ts` (C2-09/C2-10 weg), `tests/planning/check-conventions-registry.ts` (XER-pin), `tests/planning/check-conventions-p6-flags.ts` (testhaak en bronscan)
- Test: `tests/planning/check-import-profile.ts` (vervangt de M1-stub)

- [ ] **Step 1: falende test** — vervang `tests/planning/check-import-profile.ts` door:

```ts
// Lezers stellen het bronprofiel voor (rekenprofielen, spec v3.1 §6; plan taak C3). Exit 0 = groen.
// Alles via parseOpenedFile — dezelfde formatRegistry-naad als Bestand → Openen.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOpenedFile } from '@/services/formatRegistry';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { CONVENTION_KEYS, builtInProfile } from '@/engine/scheduler/conventions/registry';
import { writeCSV } from '@/services/csv/csvWriter';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import { installDOMParser } from './xmldom-shim';

installDOMParser();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const single = (value: Awaited<ReturnType<typeof parseOpenedFile>>): ImportResult => {
  if (isMultiDocumentImport(value)) throw new Error('verwachtte één document');
  return value;
};
const noConventionKeys = (r: ImportResult) =>
  Object.keys(r.project.schedulingOptions ?? {}).filter(k => (CONVENTION_KEYS as readonly string[]).includes(k) || k === 'p6Source');

function xer(remTargetLink: 'Y' | 'N'): Uint8Array {
  return new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
    '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\trem_target_link_flag',
    `%R\tP1\tProfielen\tC1\t2026-01-01\t2026-01-01\t${remTargetLink}`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tT1\tP1\tC1\tA1\tTaak\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09',
    '%E',
  ].join('\n'));
}

const x = single(await parseOpenedFile({ name: 'p.xer', bytes: xer('N') }));
eq('01 XER ⇒ p6 zonder overrides', x.project.schedulingProfile, builtInProfile('p6'));
eq('02 XER suggestedProfileId', x.suggestedProfileId, 'p6');
eq('03 XER-opties zonder conventie of p6Source', noConventionKeys(x), []);
const xy = single(await parseOpenedFile({ name: 'p.xer', bytes: xer('Y') }));
eq('04 rem_target_link_flag=Y ⇒ A19 als override', xy.project.schedulingProfile?.overrides, { p6UseRemainingStartForProgress: true });

const project = { ...createDefaultProject(), startDate: '2026-06-01', name: 'Profiel' };
const calendar = createDefaultCalendar();
project.calendarId = calendar.id;
const task = {
  id: 't1', name: 'T1', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: createDefaultTaskTime('2026-06-01', 3),
} as Task;
const mspdi = single(await parseOpenedFile({ name: 'p.xml', text: writeMSPDI(project, calendar, [task], [], [], []) }));
eq('05 MSPDI ⇒ OPS in deze etappe', [mspdi.project.schedulingProfile, mspdi.suggestedProfileId], [undefined, 'ops']);
const p6xml = single(await parseOpenedFile({ name: 'p.xml', text: writeP6XML(project, calendar, [task], [], [], []) }));
eq('06 P6-XML ⇒ OPS in deze etappe', [p6xml.project.schedulingProfile, p6xml.suggestedProfileId], [undefined, 'ops']);
const csv = single(await parseOpenedFile({ name: 'p.csv', text: writeCSV(project, [task], [], calendar) }));
eq('07 CSV ⇒ OPS', [csv.project.schedulingProfile, csv.suggestedProfileId], [undefined, 'ops']);

// .mpp: corpus-optioneel (zelfde map als check-mpp-import). Zonder corpus: OK-regel, geen stille groen-claim.
const CORPUS = process.env.OPS_MPP_CORPUS ?? '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
const mppFile = existsSync(CORPUS) ? readdirSync(CORPUS).find(f => f.toLowerCase().endsWith('.mpp')) : undefined;
if (mppFile) {
  const mpp = single(await parseOpenedFile({ name: mppFile, bytes: new Uint8Array(readFileSync(join(CORPUS, mppFile))) }));
  eq('08 .mpp ⇒ msproject', [mpp.project.schedulingProfile, mpp.suggestedProfileId], [builtInProfile('msproject'), 'msproject']);
} else {
  console.log('OK: .mpp-corpus afwezig — assertie 08 overgeslagen (check-mpp-import dekt het corpusloze pad)');
}

if (diffs.length === 0) console.log(`OK: lezerprofielen — ${checks} checks groen`);
else { console.log(`XX lezerprofielen — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
```

  (Controleer de werkelijke signaturen van `writeCSV`/`writeMSPDI`/`writeP6XML` — de argumentvolgorde
  hierboven volgt `check-adapters-hours.ts`/`check-xer-p6xml-parity.ts`; pas alleen de aanroep aan,
  niet de asserties.)
- [ ] **Step 2:** `bash tests/planning/run.sh check-import-profile.ts` ⇒ rood op 01–07.
- [ ] **Step 3: implementatie.**
  `importTypes.ts` — in `ImportResult`:

```ts
  /** Rekenprofielen (spec v3.1 §6): welk ingebouwd profiel deze LEZER voorstelt. Gezet door de
   *  formaatlezers (XER ⇒ 'p6', `.mpp` ⇒ 'msproject', MSPDI/P6-XML/CSV ⇒ 'ops'); afwezig bij IFC
   *  (het bestand draagt zijn eigen profiel) en bij extensie-importers. `applyOpenedImport` meldt
   *  alleen bij een voorstel ≠ 'ops' (C6). Het profiel zelf staat al op `project.schedulingProfile`. */
  suggestedProfileId?: BuiltInProfileId;
```

  `xerScheduleOptions.ts` — `XER_SCHEDULING_DEFAULTS` blijft hier staan (baan A bouwt hem al uit het
  register) maar draagt voortaan **alleen projectopties**:
  `{ progressMode: 'RETAINED_LOGIC', schedulingOptions: p6OptionDefaults() }` (geen `p6Source`, geen
  conventies; `satisfies { progressMode: ProgressMode; schedulingOptions: ProjectSchedulingOptions }`);
  `XerScheduleOptionsResult.schedulingOptions` wordt `ProjectSchedulingOptions` en krijgt een zuster
  `p6UseRemainingStartForProgress: boolean`; `freshDefaults()` levert alleen de opties; `deriveXerScheduleOptions` zet
  `p6UseRemainingStartForProgress: projectRemainingStartValue(projectRow, fallbacks)` op het **resultaat**
  (niet meer in de opties) in beide `return`-takken; de `XER_SCHEDULEOPTIONS_COLUMN_DISPOSITIONS`-rij
  van `rem_target_link_flag` (indien aanwezig) wijst naar `schedulingProfile.overrides.p6UseRemainingStartForProgress`.
  `xerReader.ts` — in de projectliteral naast `schedulingOptions`:

```ts
      progressMode,
      schedulingOptions,
      // Rekenprofielen: XER ⇒ P6; A19 is per bestand (PROJECT.rem_target_link_flag) en dus een override.
      schedulingProfile: {
        ...builtInProfile('p6'),
        overrides: derivedSchedule.p6UseRemainingStartForProgress ? { p6UseRemainingStartForProgress: true } : {},
      },
```

  en `suggestedProfileId: 'p6',` op het `ImportResult`-object (naast `recordedTimesOrigin`).
  `mppReader.ts` — in `parseProjectProperties` vervalt het blok `schedulingOptions: { resumeFromActualElapsed:
  true, unstartedIgnoresStatusDate: true }` en komt er `schedulingProfile: builtInProfile('msproject'),`
  (de T9/B1-toelichting erboven blijft, met als slotzin "Sinds de rekenprofielen staan beide
  conventies in het MS Project-profiel"); het `ImportResult` van `readMPP` krijgt
  `suggestedProfileId: 'msproject'`. `mspdiReader.ts`, `p6xmlReader.ts`, `csvReader.ts`: alleen
  `suggestedProfileId: 'ops'` op het resultaat (P6-XML: deze etappe OPS, spec §6; CSV:
  `defaultOptionsFor('ops')` is `{}` ⇒ geen optieveld nodig).
  `types/project.ts`: `p6Source` verdwijnt uit `SchedulingOptions`; `ProjectOptionKey` wordt
  `Exclude<keyof SchedulingOptions, ConventionKey>`; `Project.schedulingOptions?: ProjectSchedulingOptions`
  (docblok: "sinds C3 alleen projectopties"); en blijvend, voor de migratie van oude bestanden:

```ts
/** Een `OPS_SchedulingOptions`-blob zoals oudere bestanden hem schreven: met de XER-herkomstmarkering.
 *  Alleen de IFC-lezer en `legacyOptionsToProfile` zien dit type; de motor en de state nooit. */
export type LegacySchedulingOptions = SchedulingOptions & { p6Source?: 'XER' };
```

  `schedulingOptionsRead.ts`: `sanitizeSchedulingOptions(input): LegacySchedulingOptions | undefined`
  (de `case 'p6Source'` schrijft op het legacy-type); `registry.ts`: `legacyOptionsToProfile(blob:
  LegacySchedulingOptions | undefined)` — verder niets aan het register.
  **Tijdelijke lagen weg:** verwijder `src/engine/scheduler/conventions/legacyP6Source.ts`; in
  `CPMSolver.ts` de vertaling in de constructor en het veld `legacyP6SourceTranslation` uit `CPMOptions`;
  in `solveProject.ts` de doorgifte van die testhaak; in `p6CompletedRouteTrace.ts`,
  `p6OpenLoeTargetSpanTrace.ts` en `p6CompletedTargetWindow.ts` delegeren de publieke `explain*`-wrappers
  voortaan rechtstreeks naar hun `*Resolved`-variant (geen hernoemingsgolf); in `solveInput.ts` vervallen
  `settingsOf` en de `legacyOptionsToProfile`-import (`schedulingOptions: effectiveSchedulingOptions(project)`);
  in `ifcWriter.ts` wordt `schedulingSettingsForWrite(project)` simpelweg
  `{ schedulingProfile: project.schedulingProfile, schedulingOptions: project.schedulingOptions }` (of
  vervalt, met `project` direct aan `legacyOptionsBlobFor`). Schrap assertie 06 in `check-solve-input.ts`
  en C2-09/C2-10 in `check-scheduling-profile-roundtrip.ts`, en de hele M1.3-sectie in
  `check-conventions-registry.ts` (de laag die ze vergelijkt bestaat niet meer). Werk in
  `types/project.ts` de docblokken bij die nog naar de tijdelijke vertaling verwijzen (de B-vlaggen en
  het verdwenen `p6Source`-veld): na C3 staat het woord `TIJDELIJK` nergens meer in `src/types`,
  `src/engine`, `src/services/ifc` of `src/state`.
  `check-conventions-registry.ts`: de pin "`legacyOptionsToProfile(XER_SCHEDULING_DEFAULTS.schedulingOptions)`
  ⇒ p6-profiel" wordt "`XER_SCHEDULING_DEFAULTS.schedulingOptions` ≡ `defaultOptionsFor('p6')` én een
  gelezen XER-fixture draagt `builtInProfile('p6')`". `check-conventions-p6-flags.ts`: de testhaak
  bestaat niet meer — arm 3/5/6 ("testhaak uit") worden gewone aanroepen; arm 1/4 ("vertaling aan")
  halen hun conventies voortaan uit het profiel via `solveOptionsFor(imported.project)`; de bronscan eist
  nu **nul** `p6Source`-lezingen onder `src/engine/` (was: alleen in de tijdelijke vertaling).
  `harness.ts` (r.~619):

```ts
  if (c.schedulingOptions) {
    // Rekenprofielen: de case-JSON's zijn oude SchedulingOptions-blobs (bv. cases-progress.json met
    // resumeFromActualElapsed). Ze gaan door EXACT de IFC-migratie, dus het gedrag blijft identiek.
    const migrated = legacyOptionsToProfile(c.schedulingOptions);
    S().setProject({
      schedulingOptions: migrated.options,
      schedulingProfile: isDefaultProfile(migrated.profile) ? undefined : migrated.profile,
    });
  }
```

  (imports `isDefaultProfile`, `legacyOptionsToProfile` uit `@/engine/scheduler/conventions/registry`.)

- [ ] **Step 4:** `npm run typecheck` — elke resterende plek die conventies in `project.schedulingOptions`
  zet is nu een compileerfout; los ze op met de C4-tabel (de meeste staan daar al). Daarna
  `bash tests/planning/run.sh check-import-profile.ts check-solve-input.ts check-mpp-import.ts
  check-xer-schedule-options.ts check-xer-schedule-options-wiring.ts check-conventions-registry.ts
  check-conventions-p6-flags.ts check-scheduling-profile-roundtrip.ts cases-progress.json` ⇒ exit 0 —
  op de `p6Source`-checks van de C4-tabel na, die pas ná C4 groen zijn.
  Mutant: zet in `xerReader` de override altijd op `{}` ⇒ assertie 04 rood.
- [ ] **Step 5:** commit `feat(rekenprofielen): lezers zetten het bronprofiel; tijdelijke vertaallagen weg`
  (niet pushen vóór C4).
- Hardening: H1 geen nieuwe lussen over bestandswaarden (A19 is één cel); H2 profielwaarden met de hand;
  H3 mutant step 4; H5 geen try/catch.

### Task C4: `p6Source`-testmigratie (de tweede inventaris, per bestand)

**Files:** Create `tests/planning/p6SemanticsOff.ts`; Modify de bestanden in de tabel.

- [ ] **Step 1: helper** — `tests/planning/p6SemanticsOff.ts`:

```ts
// Rekenprofielen C4 — de nabootsing van het oude `delete project.schedulingOptions.p6Source`.
//
// Vóór de rekenprofielen zette het weghalen van p6Source ALLE p6Source-gepoorte conventies uit
// (`gatedByP6Source`: A15–A20 en B1–B5); de niet-gepoorte (A12, A13, A22, A23) bleven staan. Precies
// dat doet deze helper, als een expliciet profiel — NIET "ops met dezelfde overrides" (spec v3.1 §7).
// De projectopties blijven ongemoeid (A21 werkt in de motor alleen via de B3/B4-keten en valt daarmee
// vanzelf stil).
import { CONVENTIONS, diffAgainstBase, resolveConventions } from '@/engine/scheduler/conventions/registry';
import type { ConventionKey, SchedulingProfile } from '@/types/project';

export const P6_SOURCE_GATED_CONVENTIONS: readonly ConventionKey[] =
  CONVENTIONS.filter(c => c.gatedByP6Source).map(c => c.id);

export function withoutP6Semantics(target: { project: { schedulingProfile?: SchedulingProfile } }): void {
  const current = target.project.schedulingProfile;
  const baseId = current?.baseId ?? 'ops';
  const values = resolveConventions(current);
  for (const key of P6_SOURCE_GATED_CONVENTIONS) values[key] = false;
  target.project.schedulingProfile = {
    baseId, id: 'test-p6-semantiek-uit', name: 'test: P6-semantiek uit', overrides: diffAgainstBase(baseId, values),
  };
}

/** Eén conventie expliciet zetten op het bestaande profiel (vervangt `schedulingOptions.<vlag> = x`). */
export function setConvention(
  target: { project: { schedulingProfile?: SchedulingProfile } }, key: ConventionKey, value: boolean,
): void {
  const current = target.project.schedulingProfile;
  const baseId = current?.baseId ?? 'ops';
  const values = resolveConventions(current);
  values[key] = value;
  target.project.schedulingProfile = {
    baseId, id: current?.id ?? baseId, name: current?.name ?? '', overrides: diffAgainstBase(baseId, values),
  };
}

/** Voor asserties die vroeger `schedulingOptions?.p6Source` lazen: staat alle P6-semantiek uit? */
export function p6SemanticsOff(project: { schedulingProfile?: SchedulingProfile }): boolean {
  const values = resolveConventions(project.schedulingProfile);
  return P6_SOURCE_GATED_CONVENTIONS.every(key => values[key] === false);
}
```

- [ ] **Step 2: migratieregels** (R1–R8) en de tabel. Een regel geldt voor de getoonde regel en alle
  gelijkvormige regels in hetzelfde bestand; regelnummers indicatief (van vóór baan B). Baan B heeft een
  deel van deze plekken al omgezet naar de testhaak `legacyP6SourceTranslation: false` of naar
  `'conventionOff'`; die haak bestaat na C3 niet meer — zet ook die plekken om volgens R2.

  - **R1 bronstempel-assertie** `source: X.project.schedulingOptions?.p6Source` met verwachting `'XER'` ⇒
    `profile: X.project.schedulingProfile?.id` met verwachting `'p6'`.
  - **R2 mutant** `delete X.project.schedulingOptions?.p6Source` of `…, p6Source: undefined` ⇒
    `withoutP6Semantics(X)`; een direct erop volgende `X.project.schedulingOptions.<conventie> = v` ⇒
    `setConvention(X, '<conventie>', v)`; redencode `'notXerSource'` ⇒ `'conventionOff'`.
  - **R3 optieliteral met `p6Source: 'XER'`** (fixture of verwachting) ⇒ `p6Source` en alle
    conventiesleutels eruit; op het project `schedulingProfile: builtInProfile('p6')` (plus
    `overrides` voor elke conventie die de literal afwijkend van p6 zette).
  - **R4 `calendar.p6Source` / `WorkCalendar`/`ExtCalendar`-fixtures** ⇒ ongewijzigd (diagnoseveld blijft).
  - **R5 extensie-invoer / generieke import** die `project.schedulingOptions?.p6Source` controleerde ⇒
    `project.schedulingProfile` verwacht `undefined` (extensie ⇒ OPS).
  - **R6 verwachte optie-objecten van de XER-lezer** ⇒ zonder `p6Source` en zonder conventiesleutels;
    daarnaast `expect(project.schedulingProfile)` ≡ `builtInProfile('p6')` (of met A19-override als
    het fixture `rem_target_link_flag=Y` heeft).
  - **R7 IFC-neutraliteit** `projectSource: …schedulingOptions?.p6Source` na een IFC-round-trip zonder
    XER-stempels ⇒ `projectP6Off: p6SemanticsOff(X.project)` met verwachting `true`.
  - **R8 vijandige invoer die juist `p6Source` moet bevatten** (extensie-hostile, legacy-blobs) ⇒
    literal houden, typen met `as unknown as ProjectSchedulingOptions` resp. als rauwe JSON-string.

| bestand | regels (indicatief) | regel |
|---|---|---|
| `check-xer-product-fidelity-x12.ts` | 158, 581 (solverinvoer) | al C1 (`solveInputFor`) |
| | 1064–1068, 1111–1116, 1420, 1658, 1660 | R2 (`explicitOff`-regels ⇒ `setConvention`) |
| | 1150 | R3 |
| | 1203 | R5 (`projectProfile: genericExtensionImport.project.schedulingProfile` ⇒ `undefined`) |
| | 1257, 1597, 1644 | R1 |
| | 1667 | R7 |
| | 1523, 1532, 1554, 1598, 1645, 1659, 1661, 1668, 1678 | R4 |
| | commentaarregels die naar "de TIJDELIJKE vertaling" verwijzen (baan B; r.~47, ~1114, ~1472) | herschrijven: het gedrag komt nu uit het profiel (`withoutP6Semantics`/`setConvention`) |
| `check-ifc-roundtrip.ts` | 142, 156, 173, 527, 838, 894, 905, 908, 914, 920 | R4 |
| | 378 (`SCHED_OPTS`), 846–872 (vijandige blob) | al C2 step 4 |
| `check-xer-task-replay.ts` | 278, 294, 310, 326, 446, 472, 506, 533, 557 (`p6Source: 'XER'` in replay-verwachtingen) | R6: het replay-diagnoseveld heet voortaan `profileId` met waarde `'p6'` (zie `xerTaskReplayProduct.ts`) |
| | 497 | R1 |
| `xerTaskReplayProduct.ts` | 336, 349 (`p6Source: context.schedulingOptions?.p6Source ?? null`) | ⇒ `profileId: context.schedulingProfile?.id ?? null` (context krijgt `schedulingProfile`) |
| | 361 (`matched: source.p6Source === 'XER'`) | ⇒ `matched: source.profileId === 'p6'` |
| | 369–375 (`if (… p6Source !== 'XER') return; imported.project.schedulingOptions = { …, <vlag> }`) | ⇒ `if (imported.project.schedulingProfile?.baseId !== 'p6') return;` + `setConvention(imported, '<vlag>', <waarde>)` |
| `check-ext-contract.ts` | 93, 141, 155, 280, 334–341 | R4 |
| | 305 (hostile `p6Source: 'XER' as const` + conventies) | R8; verwachting: `fromExtProject` levert géén `schedulingProfile` en alleen publieke opties (C8 breidt uit) |
| `check-xer-open-loe-target-span.ts` | 83, 194, 279 | R1 |
| | 249, 285 | R2 (+ `'notXerSource'` ⇒ `'conventionOff'`) |
| `check-xer-completed-loe-actual-finish.ts` | 119 | R1 |
| | 178 | R2 (+ reden) |
| `check-xer-completed-cp-phys-window.ts` | 86 | R1 |
| `check-xer-completed-suspend-resume-window.ts` | 224 | R2 |
| `check-xer-backward-float-trace.ts` | 356 | R1 |
| | 365 | R6 (verwachting `'XER'` ⇒ `'p6'`) |
| | 464 | R2 — en assert dat `backwardFloatTrace` `undefined` is zodra `p6CompletedDataDateWindow` uit staat |
| `check-calendar-mirror.ts` | 19, 20, 294, 303 | R4 |
| `xerScheduleOptionsGroundTruth.ts` | 192 | R6 — de verwachte opties zonder `p6Source`; de conventies worden vergeleken op de **opgeloste set** met een hand-lijst in dit bestand (géén import uit het register — spec v3.1 §7): `{ preserveActualDatesInBackwardPass:true, clampNegativeFreeFloat:true, p6ZeroDurationUsesPlannedBoundary:true, p6UseTaskPlannedStartFloor:true, p6FinishMilestoneBoundaryWindow:true, p6PreserveActualInstants:true, p6UseRemainingStartForProgress:<rem_target_link_flag==='Y'>, p6PreserveZeroDurationConstraintInstants:true, resumeFromActualElapsed:false, unstartedIgnoresStatusDate:false, p6RelationFinishBoundary:true, p6BackwardLagFinishBoundary:true, p6CompletedDataDateWindow:true, p6CompletedLoeActualFinish:true, p6OpenLoeTargetSpan:true }` |
| `check-xer-schedule-options-wiring.ts` | 108, 130, 257 | R6 |
| `check-xer-schedule-options.ts` | 639, 711, 867 | R6 |
| | 742 (pin `XER_SCHEDULING_DEFAULTS`) | ⇒ pin ≡ `{ progressMode:'RETAINED_LOGIC', schedulingOptions:{ lagCalendar:'predecessor', criticalDefinition:{ mode:'totalFloat', thresholdHours:0 }, totalFloatMode:'finish', makeOpenEndedCritical:false, useExpectedFinishDates:true, p6CompletedLateFromRemainingWindow:true } }` én `resolveConventions(builtInProfile('p6'))` ≡ de hand-lijst hierboven met A19 `false` |
| `check-adapters-hours.ts` | 135 (`[p.project.schedulingOptions?.p6Source, p.calendar.p6Source]`) | ⇒ `[p.project.schedulingProfile, p.calendar.p6Source]` ⇒ `[undefined, undefined]` (MSPDI/P6-XML zijn OPS) |
| `check-mpp-import.ts` | 1173 (`result.project.schedulingOptions?.p6Source === undefined && …`) | ⇒ `result.project.schedulingProfile?.id === 'msproject' && result.calendar.p6Source === undefined` |
| `check-xer-export-loss.ts` | 308 (fixture `schedulingOptions: { p6Source:'XER', lagCalendar:'24hour', makeOpenEndedCritical:true }`) | R3 (`schedulingProfile: builtInProfile('p6')`, opties zonder `p6Source`) — C7 breidt dit bestand uit |
| `check-xer-source-retention.ts` | 194 | R6 |
| | 250, 687 | R4 |
| `check-xer-progress.ts` | 167 (`imported.project.schedulingOptions = { useExpectedFinishDates: expectFlag }`) | ⇒ `imported.project.schedulingProfile = undefined; imported.project.schedulingOptions = { useExpectedFinishDates: expectFlag };` en de solve via `solveProject({ ...solveInputFor(imported.project, imported.tasks, imported.sequences, imported.calendar, [imported.calendar, ...(imported.resourceCalendars ?? [])]), projectEndDate: undefined })` — **ops + alleen `useExpectedFinishDates`** (spec v3.1 §7) |

- [ ] **Step 3: inventaris als poort.** Na de migratie moet dit leeg zijn (alleen kalender-, extensie-kalender-
  en bewust vijandige R8-regels mogen `p6Source` noemen):

```bash
grep -rn "p6Source" tests --include=*.ts \
  | grep -v "calendar\.p6Source\|Calendar\b.*p6Source\|p6Source: KEEP\|P6Source\b\|R8(rekenprofielen)" \
  | grep -v "^tests/planning/check-calendar-mirror.ts\|^tests/planning/check-scheduling-profile-roundtrip.ts\|^tests/planning/legacySolveOptions.ts\|^tests/planning/check-conventions-registry.ts"
```

  Expected: geen uitvoer. (De drie uitgezonderde bestanden testen juist de migratie van oude blobs met
  `p6Source`.) Markeer elke bewust behouden R8-regel met het commentaar
  `// R8(rekenprofielen): vijandige invoer draagt bewust p6Source`.
- [ ] **Step 4: poort.** `npm run typecheck` ⇒ 0. Gericht (één run, alle aangeraakte checks):
  `bash tests/planning/run.sh check-xer-product-fidelity-x12.ts check-ifc-roundtrip.ts check-xer-task-replay.ts
  check-ext-contract.ts check-xer-open-loe-target-span.ts check-xer-completed-loe-actual-finish.ts
  check-xer-completed-cp-phys-window.ts check-xer-completed-suspend-resume-window.ts
  check-xer-backward-float-trace.ts check-calendar-mirror.ts check-xer-schedule-options-wiring.ts
  check-xer-schedule-options.ts check-adapters-hours.ts check-mpp-import.ts check-xer-export-loss.ts
  check-xer-source-retention.ts check-xer-progress.ts check-conventions-p6-flags.ts` ⇒ exit 0. Mutant:
  laat in `withoutP6Semantics` de B-vlaggen staan (filter `c.gatedByP6Source && c.group === 'A'`) ⇒ minstens één
  x12-provenance-assertie (1064-blok, `differsFromProven`) rood ⇒ herstel.
- [ ] **Step 5:** commit `test(rekenprofielen): p6Source-testmigratie naar profielen (per bestand)`;
  nu pas pushen naar `claude/rekenprofielen-baan-c`.
- Hardening: H2 alle verwachtingen blijven de oude getallen (de migratie verandert geen rekenwaarde —
  elke gewijzigde verwachte **tijd** is een bug, geen testupdate); H3 mutant step 4.

### Task C5: Benoemde gedragswijziging — de vier onvolledige aanroepers krijgen de volledige invoer

> Eigen commit, eigen test, **niet** onder het gedragsbehoud-bewijs (spec v3.1 §3.2). Releasenotitie-
> waardig: slapende XER-documenten met `useProjectEndDateForFloat` rekenen bij laden nu met het
> projecteinde-anker; het bezettingsoverzicht respecteert de projectstart-vloer zoals F5.

**Files:** Modify `src/state/documentActivation.ts`, `src/services/library/occupancy.ts`,
`src/services/benchmark/runner.ts`; Test: `tests/planning/check-solve-input.ts` (sectie C5).

- [ ] **Step 1: falende test** — voeg toe aan `check-solve-input.ts` (vóór de eindafrekening):

```ts
// ── C5: benoemde gedragswijziging — laadpad en bezetting rekenen met dezelfde invoer als F5 ─────────
import { prepareLoadedPayload } from '@/state/documentActivation';
import { freshPayload } from '@/state/documentContract';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import { ephemeralSolve, occupancySolveInputFor } from '@/services/library/occupancy';
import { createAppStoreContext } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';

{
  const cal5 = createDefaultCalendar();
  const task = {
    id: 'a', name: 'A', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: createDefaultTaskTime('2026-06-01', 5),
  } as Task;
  const base = freshPayload();
  const payload = {
    ...base,
    project: { ...base.project, calendarId: cal5.id, startDate: '2026-06-01', endDate: '2026-06-30',
      schedulingOptions: { useProjectEndDateForFloat: true } },
    calendar: cal5, calendars: [cal5], tasks: [task], sequences: [], cpmResult: null,
  };
  const loaded = prepareLoadedPayload(payload, { recompute: true });
  const direct = solveProject(solveInputFor(payload.project, cloneTasksForSolve([task]), [], cal5, [cal5]));
  eq('C5-01 laadpad rekent met het projecteinde-anker zoals F5',
    loaded.cpmResult?.tasks.get('a')?.lateFinish, direct.tasks.get('a')?.lateFinish);
  eq('C5-02 dat anker doet er in deze fixture toe (LF ≠ EF)',
    direct.tasks.get('a')?.lateFinish !== direct.tasks.get('a')?.earlyFinish, true);
}
{
  const ctx = createAppStoreContext();
  const S = () => ctx.store.getState();
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-04', 2) });
  const b = S().addTask({ name: 'B', time: createDefaultTaskTime('2026-05-04', 2) });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 } as Omit<Sequence, 'id'>);
  S().runCPM();
  const f5 = S().tasks.find(t => t.id === b)?.time.earlyStart ?? '';
  const solved = ephemeralSolve({
    docId: 'd', title: '', scheduleStale: true, companyId: null, resources: [], assignments: [],
    tasks: S().tasks, calendar: S().calendar, calendars: S().calendars,
    solveInput: occupancySolveInputFor({ tasks: S().tasks, sequences: S().sequences, project: S().project }),
  });
  eq('C5-03 bezetting rekent met de projectstart-vloer zoals F5', solved?.find(t => t.id === b)?.time.earlyStart, f5);
  eq('C5-04 die vloer doet er in deze fixture toe', f5 >= '2026-06-01', true);
}
```

- [ ] **Step 2:** `bash tests/planning/run.sh check-solve-input.ts` ⇒ rood op C5-01 en C5-03 (de
  `C5-GEDRAGSWIJZIGING`-regels geven `undefined` door). Dat is tegelijk het mutatiebewijs.
- [ ] **Step 3: implementatie** — verwijder in `documentActivation.ts` en `occupancy.ts` de regels met
  `C5-GEDRAGSWIJZIGING` (en hun commentaar); `runner.ts` wordt
  `new CPMSolver(leafTasks, expandedSequences, data.calendar, [], solveOptionsFor(data.project))`.
  `distribute.ts` heeft geen eigen bouwplek (de aanroeper levert `levelInput.options`); de enige
  productiebouwer — straks de verdeeldialoog — moet `occupancySolveInputFor` gebruiken: zet dat als
  één zin in de docstring van `DistributionDocInput.levelInput`.
- [ ] **Step 4:** check groen; `bash tests/library/run.sh check-occupancy.ts check-distribute.ts
  check-showcase-occupancy.ts` ⇒ exit 0 (die tests gebruiken `neutralSolveOptions` en veranderen dus
  niet); `check-benchmark-generator.ts` gericht groen.
- [ ] **Step 5:** commit `fix(rekenprofielen): laadpad, bezetting en benchmark rekenen met de volledige projectinvoer (benoemde gedragswijziging)`
  met in de body de twee gebruikersgevolgen uit de kop van deze taak.
- Hardening: H2 geen hard-gecodeerde datums als verwachting (vergelijking met F5 zelf); H3 step 2;
  benchmark: alleen compile-gedekt — claim in de commit niets meer dan dat.

> **Imports in de test-snippets van C2 en C5:** zet de `import`-regels bij de bestaande imports
> bovenaan het bestand (dedupliceer); de snippets tonen ze bij het blok alleen voor de leesbaarheid.

### Task C6: Melding bij openen — serialiseerbaar actieveld, één melding per bestand

**Files:**
- Modify: `src/state/slices/types.ts` (`NotificationMessageKey`, `NotificationAction`, `AppNotification.action`)
- Create: `src/state/schedulingProfileNotice.ts`
- Modify: `src/state/slices/fileSlice.ts` (in `applyOpenedImport`, de `xerImportNotice`-aanroep na de lus)
- Modify: `src/components/layout/NotificationHost.tsx`
- Test: `tests/planning/check-scheduling-profile-notice.ts` (vervangt de M1-stub)

- [ ] **Step 1: falende test** — vervang de stub door:

```ts
// Melding bij openen (rekenprofielen, spec v3.1 §6; plan taak C6). Exit 0 = groen.
import { createAppStoreContext } from '@/state/appStore';
import { withSchedulingProfileNotice, OPEN_PROJECT_INFO_ACTION } from '@/state/schedulingProfileNotice';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { readXER } from '@/services/xer/xerReader';
import type { ImportResult } from '@/services/importTypes';
import type { BuiltInProfileId, SchedulingProfile } from '@/types/project';
import type { NotifyInput } from '@/state/slices/types';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
function importOf(profile: SchedulingProfile | undefined, suggested: BuiltInProfileId | undefined): ImportResult {
  const calendar = createDefaultCalendar();
  const project = { ...createDefaultProject(), calendarId: calendar.id, startDate: '2026-06-01', schedulingProfile: profile };
  return {
    project, calendar, tasks: [], sequences: [], resources: [], assignments: [],
    ...(suggested ? { suggestedProfileId: suggested } : {}),
  };
}

// 1. De pure regel.
const mpp = withSchedulingProfileNotice([importOf(builtInProfile('msproject'), 'msproject')], undefined, 'doc-1');
eq('01 .mpp-voorstel ⇒ profielmelding', mpp?.messageKey, 'notifications.schedulingProfileApplied');
eq('02 profiel als merknaam', mpp?.params, { profile: 'Microsoft Project' });
eq('03 actie naar Backstage → Projectinfo', mpp?.action,
  { kind: 'openBackstageSection', section: 'project-info', labelKey: 'notifications.actions.openProjectInfo' });
eq('04 lees-meer naar de gids', mpp?.helpArticleId, 'gids-rekenprofielen');
eq('05 dedupe per import', mpp?.dedupeKey, 'scheduling-profile-applied:doc-1');
eq('06 voorstel ops (CSV/MSPDI/P6-XML) ⇒ geen melding',
  withSchedulingProfileNotice([importOf(undefined, 'ops')], undefined, 'd'), undefined);
eq('07 eigen IFC (geen voorstel, wel p6-profiel) ⇒ geen melding',
  withSchedulingProfileNotice([importOf(builtInProfile('p6'), undefined)], undefined, 'd'), undefined);
const xerNotice: NotifyInput = {
  severity: 'info', messageKey: 'notifications.xerImportOpened', params: { count: 2 },
  detailLines: [{ messageKey: 'notifications.xerImportProjectsSeen', params: { count: 2 } }],
  helpArticleId: 'gids-xer-import',
};
const merged = withSchedulingProfileNotice(
  [importOf(builtInProfile('p6'), 'p6'), importOf(builtInProfile('p6'), 'p6')], xerNotice, 'doc-x');
eq('08 XER: samengevoegd, geen tweede toast', merged?.messageKey, 'notifications.xerImportOpened');
eq('09 XER: profielregel bovenaan', merged?.detailLines?.[0],
  { messageKey: 'notifications.schedulingProfileApplied', params: { profile: 'Primavera P6' } });
eq('10 XER: actie erbij, XER-gids blijft lees-meer', [merged?.action?.section, merged?.helpArticleId], ['project-info', 'gids-xer-import']);
eq('11 XER zonder profielvoorstel: ongewijzigd', withSchedulingProfileNotice([importOf(undefined, undefined)], xerNotice, 'd'), xerNotice);

// 2. Store: applyOpenedImport meldt precies één keer per geopend bestand.
const ctx = createAppStoreContext();
const S = () => ctx.store.getState();
const clear = () => { for (const n of [...S().ui.notifications]) S().dismissNotification(n.id); };
const profileNotices = () => S().ui.notifications.filter(n =>
  n.messageKey === 'notifications.schedulingProfileApplied'
  || n.detailLines?.some(line => line.messageKey === 'notifications.schedulingProfileApplied'));
S().applyOpenedImport(importOf(builtInProfile('msproject'), 'msproject'), { filePath: null, recompute: true });
eq('12 .mpp-achtige import ⇒ één profielmelding', profileNotices().length, 1);
eq('13 actie in de store is serialiseerbaar', JSON.parse(JSON.stringify(profileNotices()[0]?.action ?? null)), OPEN_PROJECT_INFO_ACTION);
clear();
S().applyOpenedImport(importOf(undefined, 'ops'), { filePath: null, recompute: true });
eq('14 CSV-achtige import ⇒ geen profielmelding', profileNotices().length, 0);
clear();
const twoProjects = readXER(new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tEen\tC1\t2026-01-01\t2026-01-01',
  '%R\tP2\tTwee\tC1\t2026-01-01\t2026-01-01',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tC1\tA1\tEen\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09',
  '%R\tT2\tP2\tC1\tB1\tTwee\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09',
  '%E',
].join('\n')));
S().applyOpenedImport(twoProjects, { filePath: null, recompute: true });
eq('15 XER met twee projecten ⇒ precies één melding, met de profielregel', profileNotices().length, 1);
eq('16 …en dat is de XER-openingsmelding', profileNotices()[0]?.messageKey, 'notifications.xerImportOpened');

if (diffs.length === 0) console.log(`OK: profielmelding — ${checks} checks groen`);
else { console.log(`XX profielmelding — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
```

- [ ] **Step 2:** `bash tests/planning/run.sh check-scheduling-profile-notice.ts` ⇒ rood (module ontbreekt).
- [ ] **Step 3: implementatie.** `types.ts` — in de `NotificationMessageKey`-unie
  `| 'notifications.schedulingProfileApplied' | 'notifications.schedulingProfileShifted'`, en naast
  `NotificationDetailLine`:

```ts
/** Rekenprofielen (spec v3.1 §6): het actielabel is een i18n-sleutel in `common`. */
export type NotificationActionLabelKey = 'notifications.actions.openProjectInfo';

/** Een SERIALISEERBARE vervolgactie op een melding (geen functies in de store). `NotificationHost`
 *  voert hem uit; nieuwe soorten krijgen een eigen `kind`. */
export interface NotificationAction {
  kind: 'openBackstageSection';
  section: BackstageSection;
  labelKey: NotificationActionLabelKey;
}
```

  en in `AppNotification`: `action?: NotificationAction;` met docblok "Optionele vervolgknop; zie
  `NotificationAction`". `src/state/schedulingProfileNotice.ts`:

```ts
// De melding "dit project rekent als …" bij het openen van een bestand (rekenprofielen, spec v3.1 §6).
// Puur: de store roept hem aan in `applyOpenedImport`. Eén melding per geopend BESTAND: een XER met N
// projecten geeft er één, samengevoegd met de bestaande XER-openingsmelding; andere formaten met een
// voorstel ≠ 'ops' krijgen een eigen melding. Heropenen uit eigen IFC (geen voorstel) en crashherstel
// (loopt niet door applyOpenedImport) melden niets.
import type { BuiltInProfileId, SchedulingProfile } from '@/types/project';
import type { ImportResult } from '@/services/importTypes';
import type { NotificationAction, NotifyInput } from '@/state/slices/types';
import { builtInProfile, isBuiltInProfileId } from '@/engine/scheduler/conventions/registry';

export const SCHEDULING_PROFILE_HELP_ARTICLE_ID = 'gids-rekenprofielen';

/** Merknamen — bewust onvertaald (ook `profiles.builtIn.*` in de locales zijn deze merknamen). De
 *  store heeft geen `t()`, en een merknaam hoort niet per taal te verschillen. */
export const BUILT_IN_PROFILE_BRANDS: Readonly<Record<BuiltInProfileId, string>> = {
  p6: 'Primavera P6', msproject: 'Microsoft Project', ops: 'Open Planner Studio',
};

export const OPEN_PROJECT_INFO_ACTION: NotificationAction = {
  kind: 'openBackstageSection', section: 'project-info', labelKey: 'notifications.actions.openProjectInfo',
};

export function profileBrand(profile: SchedulingProfile): string {
  if (isBuiltInProfileId(profile.id)) return BUILT_IN_PROFILE_BRANDS[profile.id];
  return profile.name || BUILT_IN_PROFILE_BRANDS[profile.baseId];
}

export function withSchedulingProfileNotice(
  results: readonly ImportResult[], xerNotice: NotifyInput | undefined, importKey: string,
): NotifyInput | undefined {
  const suggesting = results.find(r => r.suggestedProfileId !== undefined && r.suggestedProfileId !== 'ops');
  if (!suggesting || suggesting.suggestedProfileId === undefined) return xerNotice;
  const profile = suggesting.project.schedulingProfile ?? builtInProfile(suggesting.suggestedProfileId);
  const params = { profile: profileBrand(profile) };
  if (xerNotice) {
    return {
      ...xerNotice,
      detailLines: [{ messageKey: 'notifications.schedulingProfileApplied', params }, ...(xerNotice.detailLines ?? [])],
      action: OPEN_PROJECT_INFO_ACTION,
    };
  }
  return {
    severity: 'info',
    messageKey: 'notifications.schedulingProfileApplied',
    params,
    helpArticleId: SCHEDULING_PROFILE_HELP_ARTICLE_ID,
    action: OPEN_PROJECT_INFO_ACTION,
    dedupeKey: `scheduling-profile-applied:${importKey}`,
  };
}
```

  `fileSlice.ts` (`applyOpenedImport`), vervang de twee regels `const notice = xerImportNotice(…);
  if (notice) get().notify(notice);` door:

```ts
      // Rekenprofielen (spec v3.1 §6): één melding per geopend bestand — bij XER samengevoegd met de
      // openingsmelding, anders een eigen melding met de actie naar Bestand → Projectinfo.
      const notice = withSchedulingProfileNotice(
        results,
        xerImportNotice(results, datesAsRecordedShiftedTotal, datesAsRecordedOfferTotal),
        openedDocumentIds[0] ?? '',
      );
      if (notice) get().notify(notice);
```

  `NotificationHost.tsx` — `const setUI = useAppStore((s) => s.setUI);` en ná het `helpArticleId`-knopje:

```tsx
          {n.action && (
            // Rekenprofielen (spec v3.1 §6): de serialiseerbare actie uit de store. `stopPropagation`
            // zodat de klik niet ook de wegklik-handler van de toast triggert (zelfde als "Lees meer").
            <button
              type="button"
              className="ops-textlink ops-toast-readmore"
              data-ops-notification-action={n.action.kind}
              onClick={(e) => {
                e.stopPropagation();
                const action = n.action!;
                setUI({ activeRibbonTab: 'file', backstageSection: action.section });
                dismissNotification(n.id);
              }}
            >
              {t(n.action.labelKey)}
            </button>
          )}
```

- [ ] **Step 4:** check groen; `bash tests/planning/run.sh check-notifications.ts check-xer-reader.ts` ⇒
  exit 0; `npm run typecheck`, `npm run lint` ⇒ 0. Mutant: laat in `fileSlice` de wrapper weg (terug naar
  alleen `xerImportNotice`) ⇒ 12 rood. Tweede mutant: geef `action` een functie i.p.v. object ⇒ typecheck rood.
  (De zichtbare knop en de klik zelf bewijst D6 in de browser; de labeltekst komt uit D1.)
- [ ] **Step 5:** commit `feat(rekenprofielen): melding bij openen met serialiseerbare actie naar Projectinfo`.
- Hardening: H1 `results.find` over de geopende documenten (begrensd door de lezer); H2 merknamen uit de
  spec; H3 mutanten step 4; H4 geen modulestaat; H5 geen try/catch.

### Task C7: Export-guard — "overleeft het heropenen via het doelformaat"

**Files:** Modify `src/services/xerExportLoss.ts`; Test: `tests/planning/check-xer-export-loss.ts`
(nieuwe sectie C7; dit bestand staat ook in de C4-tabel).

- [ ] **Step 1: falende test** — voeg onderaan (vóór de eindafrekening) toe:

```ts
// ── C7 (rekenprofielen, spec v3.1 §7): het criterium is "overleeft het heropenen via het doelformaat".
// Alle drie de doelformaten heropenen deze etappe als OPS; een P6-profiel overleeft dat niet.
resetProject('Profiel zonder opties');
store().setProject({ schedulingProfile: builtInProfile('p6') });
installXer(makeXerFixture({ sourceBytes: '%T\tTASK\r\n%F\ttask_id\r\n%R\tprofiel\r\n%E' }));
expect('C7-01 P6-profiel naar CSV ⇒ schedule-verlies (heropent als OPS)',
  categoriesOf(await store().exportAs('csv')).includes('schedule-options-and-provenance'));
resetProject('OPS zonder opties');
installXer(makeXerFixture({ sourceBytes: '%T\tTASK\r\n%F\ttask_id\r\n%R\tops\r\n%E' }));
expect('C7-02 OPS-profiel zonder opties naar CSV ⇒ geen schedule-verlies',
  !categoriesOf(await store().exportAs('csv')).includes('schedule-options-and-provenance'));
```

  (Is C7-02 al vóór deze taak rood omdat `makeXerFixture` schedule-provenance meelevert, maak dan een
  kalere fixture in dezelfde stijl — de assertie zelf blijft.)
- [ ] **Step 2:** `bash tests/planning/run.sh check-xer-export-loss.ts` ⇒ C7-01 rood.
- [ ] **Step 3: implementatie** — in `ExportCapabilities`:

```ts
  /** Met welk ingebouwd profiel dit doelformaat heropent = het `suggestedProfileId` van zijn lezer.
   *  Deze etappe heropenen CSV, MSPDI en P6-XML alle drie als OPS (spec v3.1 §6). */
  readonly reopenProfile: BuiltInProfileId;
```

  met `reopenProfile: 'ops'` in alle vijf de matrixrijen; `XerExportLossInput.project` wordt
  `Pick<Project, 'progressMode' | 'schedulingOptions' | 'schedulingProfile'>`; en:

```ts
function hasScheduleLoss(capabilities: ExportCapabilities, input: XerExportLossInput): boolean {
  if (hasScheduleProvenance(input) || input.project.progressMode !== undefined) return true;
  // Rekenprofielen (spec v3.1 §7): een profiel dat niet overleeft wat de lezer van het doelformaat
  // voorstelt, is verlies — niet "er is iets gedefinieerd".
  const kept = resolveConventions(input.project.schedulingProfile);
  const reopened = builtInConventions(capabilities.reopenProfile);
  if (CONVENTION_KEYS.some(key => kept[key] !== reopened[key])) return true;
  const options = input.project.schedulingOptions;
  if (!options || Object.values(options).every(value => value === undefined)) return false;
  return capabilities.schedulingOptions === 'none' || !isMspdiCriticalSlackLimit(options);
}
```

  (imports `CONVENTION_KEYS`, `builtInConventions`, `resolveConventions` uit
  `@/engine/scheduler/conventions/registry`; in de test `builtInProfile` uit hetzelfde register.)
- [ ] **Step 4:** groen; mutant: laat de profielregel weg ⇒ C7-01 rood.
- [ ] **Step 5:** commit `feat(rekenprofielen): export-guard meet of het profiel het heropenen overleeft`.
- **Benoemd gat (in de PR-tekst opnemen):** `detectXerExportLoss` draait alleen voor documenten met
  XER-herkomst (`sourceArchive`/`importMetadata`). Het spec-voorbeeld "`.mpp` → MSPDI verliest A22/A23"
  wordt daardoor níét gemeld; een algemene profielverlies-waarschuwing voor niet-XER-documenten is een
  vervolgtaak (eigen waarschuwingscode + i18n), buiten deze etappe.
- Hardening: H1 vaste vergelijking; H3 mutant.

### Task C8: Extensie-API — `ExtProject.schedulingProfile` (apiVersion 1.2.0)

**Files:** Modify `src/extensions/extTypes.ts`, `src/extensions/extMappers.ts`,
`src/extensions/apiVersion.ts` (`'1.2.0'`), `docs/extensions.md`; Test: `tests/planning/check-ext-contract.ts`.

- [ ] **Step 1: falende test** — in `check-ext-contract.ts`: voeg `'schedulingProfile'` toe aan de
  `ExtProject`-sleutellijst (r.~87) en aan de lijst "interne velden die bewust niet terug oversteken"
  voor `fromExtProject`; geef `VOL_PROJECT` (`satisfies Required<Project>`) een
  `schedulingProfile: { baseId: 'p6', id: 'prof-vol', name: 'Vol', overrides: { clampNegativeFreeFloat: false } }`;
  en voeg toe:

```ts
{
  const exposed = toExtProject({ ...VOL_PROJECT, schedulingProfile: builtInProfile('p6') });
  eq('C8-01 toExtProject toont het opgeloste profiel', [exposed.schedulingProfile?.id, exposed.schedulingProfile?.conventions.p6RelationFinishBoundary], ['p6', true]);
  eq('C8-02 OPS-project toont het ops-profiel', toExtProject({ ...VOL_PROJECT, schedulingProfile: undefined }).schedulingProfile?.id, 'ops');
  eq('C8-03 fromExtProject neemt NOOIT een profiel over (extensie-import ⇒ OPS)', fromExtProject(exposed).schedulingProfile, undefined);
  eq('C8-04 contractversie 1.2.0', EXTENSION_API_VERSION, '1.2.0');
}
```

- [ ] **Step 2:** `bash tests/planning/run.sh check-ext-contract.ts` ⇒ rood (compile: sleutellijst).
- [ ] **Step 3: implementatie.** `extTypes.ts`:

```ts
/** Rekenprofiel van het project, alleen-lezen (contractversie 1.2.0). `fromExtProject` en
 *  `fromExtImportResult` nemen dit veld NOOIT over: een extensie-import rekent als OPS. */
export interface ExtSchedulingProfile {
  id: string;
  baseId: 'p6' | 'msproject' | 'ops';
  /** Leeg bij een ingebouwd profiel (de app toont dan de vertaalde naam). */
  name: string;
  /** De vijftien opgeloste conventies (sleutel = conventie-id). */
  conventions: Record<string, boolean>;
}
// in ExtProject:
  /** Sinds 1.2.0 — het opgeloste rekenprofiel. Alleen-lezen. */
  schedulingProfile?: ExtSchedulingProfile;
```

  `extMappers.ts` — in `toExtProject`:

```ts
    schedulingProfile: {
      id: p.schedulingProfile?.id ?? 'ops',
      baseId: p.schedulingProfile?.baseId ?? 'ops',
      name: p.schedulingProfile?.name ?? '',
      conventions: { ...resolveConventions(p.schedulingProfile) },
    },
```

  (`resolveConventions` uit `@/engine/scheduler/conventions/registry`; in de test `builtInProfile` idem.)
  `fromExtProject` zet geen `schedulingProfile` (commentaar: "bewust: extensie ⇒ OPS"). `apiVersion.ts`:
  `EXTENSION_API_VERSION = '1.2.0'` (+ regel in de versiehistorie-commentaarkop als die bestaat).
  `docs/extensions.md`: sectie "Rekenprofiel (sinds 1.2.0)" — drie zinnen: wat het veld is, dat het
  alleen-lezen is, en dat een importer-resultaat altijd als OPS opent.
- [ ] **Step 4:** groen; mutant: laat `fromExtProject` het profiel kopiëren ⇒ C8-03 rood.
- [ ] **Step 5:** commit `feat(rekenprofielen): extensie-API toont het rekenprofiel (apiVersion 1.2.0)`.
- Hardening: H1 `resolveConventions` loopt over het vaste register; H3 mutant.

### Task C9: MCP — profiel tonen, opgeloste set, weigerteksten

**Files:** Modify `src/services/mcp/tools/readTools.ts` (`planner_get_project_info`, r.~277),
`src/services/mcp/tools/xerProvenanceTools.ts` (r.~529), `src/services/mcp/tools/calendarResourceTools.ts`
(`PROJECT_REFUSED`, r.~1519); Create `tests/mcp/cases-scheduling-profile.ts`.

- [ ] **Step 1: falende test** — `tests/mcp/cases-scheduling-profile.ts`:

```ts
// Rekenprofielen via MCP (plan taak C9): tonen, opgeloste set, en een eerlijke weigering bij schrijven.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpToolOk, McpToolResult } from '@/services/mcp/contracts';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';

const S = () => useAppStore.getState();
const call = (name: string, args: unknown = {}) => getTool(name)!.handler(args, makeMcpContext(appStoreContext, {})) as McpToolResult;

test('get_project_info toont het profiel met de opgeloste conventies', () => {
  S().newProject();
  S().setProject({ schedulingProfile: builtInProfile('p6') });
  const res = call('planner_get_project_info');
  assert(res.ok, 'get_project_info moet slagen');
  const profile = ((res as McpToolOk).data as { project: { schedulingProfile?: { id: string; conventions: Record<string, boolean> } } }).project.schedulingProfile;
  assertEq(profile?.id, 'p6', 'profiel-id');
  assertEq(profile?.conventions.p6RelationFinishBoundary, true, 'B1 opgelost aan onder P6');
});

test('get_project_info toont ook een OPS-project expliciet', () => {
  S().newProject();
  const res = call('planner_get_project_info') as McpToolOk;
  assertEq((res.data as { project: { schedulingProfile?: { id: string } } }).project.schedulingProfile?.id, 'ops', 'ops expliciet');
});

test('update_project weigert schedulingProfile met een verwijzing naar Projectinfo', () => {
  S().newProject();
  const res = call('planner_update_project', { schedulingProfile: { id: 'p6' } });
  assert(!res.ok, 'moet weigeren');
  assert(!res.ok && /Projectinfo/.test(res.error), `weigertekst noemt Projectinfo: ${res.ok ? '' : res.error}`);
});

await run();
```

- [ ] **Step 2:** `bash tests/mcp/run.sh cases-scheduling-profile.ts` ⇒ rood.
- [ ] **Step 3: implementatie.** `readTools.ts` (in het `project`-object van `get_project_info`):

```ts
      schedulingProfile: {
        id: p.schedulingProfile?.id ?? 'ops',
        baseId: p.schedulingProfile?.baseId ?? 'ops',
        name: p.schedulingProfile?.name ?? '',
        overrides: { ...(p.schedulingProfile?.overrides ?? {}) },
        conventions: resolveConventions(p.schedulingProfile),
      },
```

  (`resolveConventions`/`effectiveSchedulingOptions` uit `@/engine/scheduler/conventions/registry`.)
  `xerProvenanceTools.ts` (in `schedoptions`): houd `mappedSchedulingOptions` (bevat sinds C3 geen
  `p6Source` meer) en voeg toe `schedulingProfileId: state.project.schedulingProfile?.id ?? 'ops',
  effectiveSchedulingOptions: effectiveSchedulingOptions(state.project),`. Staat het uitvoertype in
  `src/services/mcp/contracts.ts`, werk het daar bij (dan hoort dat bestand bij deze taak).
  `calendarResourceTools.ts` — `PROJECT_REFUSED`:

```ts
  schedulingOptions:
    'de reken-opties (`schedulingOptions`, waaronder `floatPaths`, `criticalDefinition`, `lagCalendar`) ' +
    'zijn NIET via de bridge instelbaar: samen met het rekenprofiel bepalen ze de solver-semantiek van het ' +
    'hele document. Zet ze in de app onder Bestand → Projectinfo → Rekenprofiel en reken-opties; ' +
    '`planner_get_project_info` toont het actieve profiel, `planner_get_critical_path` meldt met `pathsMode` welke stand geldt.',
  schedulingProfile:
    'het rekenprofiel (P6 / MS Project / OPS / eigen) is NIET via de bridge instelbaar: een wissel verschuift ' +
    'datums van het hele document. Kies het in de app onder Bestand → Projectinfo → Rekenprofiel; ' +
    '`planner_get_project_info` toont het actieve profiel met zijn vijftien opgeloste conventies.',
  floatPaths:
    '`floatPaths` hoort in `project.schedulingOptions` en is NIET via de bridge instelbaar (zie de app onder ' +
    'Bestand → Projectinfo → Rekenprofiel en reken-opties). `planner_get_critical_path` meldt met `pathsMode` welke stand geldt.',
```

  Houdt `schemaValidate` `schedulingProfile` al vóór de handler tegen (onbekende sleutel), zet de sleutel
  dan in het schema als toegestaan-maar-geweigerd, zoals `schedulingOptions` daar staat — de weigertekst
  moet de gebruiker bereiken.
- [ ] **Step 4:** groen; `bash tests/mcp/run.sh cases-read.ts cases-xer-provenance.ts cases-toolregistry.ts`
  ⇒ exit 0. Mutant: haal `schedulingProfile` uit `PROJECT_REFUSED` ⇒ derde case rood.
- [ ] **Step 5:** commit `feat(rekenprofielen): MCP toont het profiel en weigert het eerlijk bij schrijven`.
- Hardening: H3 mutant; H4 de case gebruikt de harness-context (bestaand patroon voor MCP-cases).

### Task C10: MSPDI ⇒ MS Project-profiel — **GEBLOKKEERD tot een expliciet eigenaarsbesluit**

> Niet uitvoeren binnen deze etappe zonder schriftelijk akkoord van de eigenaar (spec v3.1 §6/§9). Staat
> hier zodat het werk klaarligt. De wissel verandert elk MSPDI-bestand met voortgang (A22/A23 gaan aan)
> en heeft geen orakel.

**Files:** Modify `src/services/msproject/mspdiReader.ts` (`suggestedProfileId: 'msproject'` +
`project.schedulingProfile = builtInProfile('msproject')` in `parseProject`), `tests/planning/check-import-profile.ts`
(assertie 05), `src/services/xerExportLoss.ts` (`mspdi.reopenProfile: 'msproject'`), `docs/release-notes/v<versie>.md`
(releasenotitie), `public/docs/{nl,en}/gids-rekenprofielen.md` (tabelregel).

- [ ] Step 1: pas assertie 05 aan naar `[builtInProfile('msproject'), 'msproject']` ⇒ rood. Step 2: implementatie.
  Step 3: **meting** — draai `check-mpp-fidelity`-achtige vergelijking voor MSPDI niet (geen orakel); tel in
  plaats daarvan over het MSPDI-deel van het corpus hoeveel taken verschuiven t.o.v. OPS en zet dat getal
  in de releasenotitie. Step 4: gericht groen. Step 5: commit
  `feat(rekenprofielen): MSPDI opent als MS Project (eigenaarsbesluit <datum>)`.

**Acceptatie baan C:** `npm run typecheck`, `npm run lint` groen; alle checks die C aanraakte gericht groen;
de eerste twee `git grep`-regels van taak I2 leeg; push naar `claude/rekenprofielen-baan-c`.

---

## Baan D — i18n, bewerkmodel, store-acties, UI, docs, poort, browsertest

Werk in de worktree van `claude/rekenprofielen-baan-d`. D1, D2, D7 en D8 direct ná M1. **Vóór D3:**
`git merge claude/rekenprofielen-baan-c` (C moet minstens t/m C6 gepusht zijn; voor D10 t/m C4).

### Task D1: Vertaalsleutels in alle 14 locales

**Files:** Modify `src/i18n/locales/{nl,en,fr,de,es,zh,it,pt,pl,tr,ar,ja,ko,fa}/common.json` en
`…/menu.json`; Modify `tests/planning/check-conventions-registry.ts` (i18n-sectie).

- [ ] **Step 1: falende test** — voeg aan `check-conventions-registry.ts` toe (imports bovenaan):

```ts
import { readFileSync } from 'node:fs';
const LOCALES = ['nl', 'en', 'fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'fa'];
for (const locale of LOCALES) {
  const common = JSON.parse(readFileSync(`src/i18n/locales/${locale}/common.json`, 'utf8')) as {
    conventions?: Record<string, { label?: unknown; help?: unknown }>;
    profiles?: { builtIn?: Record<string, unknown> };
    notifications?: { schedulingProfileApplied?: unknown; actions?: { openProjectInfo?: unknown } };
  };
  for (const c of CONVENTIONS) {
    eq(`i18n ${locale} ${c.labelKey}.label`, typeof common.conventions?.[c.id]?.label, 'string');
    eq(`i18n ${locale} ${c.labelKey}.help`, typeof common.conventions?.[c.id]?.help, 'string');
  }
  for (const id of ['p6', 'msproject', 'ops']) eq(`i18n ${locale} profiles.builtIn.${id}`, typeof common.profiles?.builtIn?.[id], 'string');
  eq(`i18n ${locale} notifications.schedulingProfileApplied`, typeof common.notifications?.schedulingProfileApplied, 'string');
  eq(`i18n ${locale} notifications.actions.openProjectInfo`, typeof common.notifications?.actions?.openProjectInfo, 'string');
}
// Merknamen zijn in elke taal gelijk (de store-melding gebruikt ze onvertaald, zie schedulingProfileNotice.ts).
for (const locale of LOCALES) {
  const builtIn = (JSON.parse(readFileSync(`src/i18n/locales/${locale}/common.json`, 'utf8')) as { profiles?: { builtIn?: unknown } }).profiles?.builtIn;
  eq(`i18n ${locale} merknamen`, builtIn, { p6: 'Primavera P6', msproject: 'Microsoft Project', ops: 'Open Planner Studio' });
}
```

- [ ] **Step 2:** `bash tests/planning/run.sh check-conventions-registry.ts` ⇒ rood op de i18n-regels.
- [ ] **Step 3: sleutels.** Baan A zette `profiles.builtIn.{p6,msproject,ops}` al in nl/en: voeg daar
  alleen `modified` en `copyOf` aan het bestaande `profiles`-object toe (geen tweede `profiles`-sleutel).
  `common.json` **nl** — voeg top-level toe (en merge `profiles`):

```json
"conventions": {
  "preserveActualDatesInBackwardPass": { "label": "Actuele datums behouden in de terugwaartse berekening", "help": "Een gestarte of voltooide taak houdt haar geregistreerde datums ook aan de late kant; een voltooide opvolger trekt een open voorganger niet terug in het verleden." },
  "clampNegativeFreeFloat": { "label": "Vrije speling nooit negatief", "help": "Bij een onhaalbare late constraint blijft de totale speling negatief, maar de vrije speling wordt nul." },
  "p6ZeroDurationUsesPlannedBoundary": { "label": "Mijlpaal volgt de geplande kalendergrens", "help": "Een mijlpaal zonder duur blijft op de kalendergrens die het bestand plande: een dagstart blijft een startmijlpaal, een bandeinde mag op de finish van de voorganger landen." },
  "p6UseTaskPlannedStartFloor": { "label": "Geplande start als extra ondergrens", "help": "De geplande start uit het bestand telt als ondergrens zodra start én einde meer dan een kalenderdag later liggen dan het netwerk toelaat." },
  "p6FinishMilestoneBoundaryWindow": { "label": "Eindmijlpaal als grensvenster", "help": "Een eindmijlpaal mag op twee aangrenzende kalendergrenzen staan: vroege start aan het begin van een band, vroeg einde aan het einde van de vorige band." },
  "p6PreserveActualInstants": { "label": "Actuele datums exact overnemen", "help": "Geregistreerde actuele start- en einddatums worden niet naar een werktijdband verschoven." },
  "p6UseRemainingStartForProgress": { "label": "Lopende taak: vroege start = begin van het restwerk", "help": "De vroege en late start van een lopende taak beschrijven waar het resterende werk begint, niet de historische actuele start. Komt per bestand uit Primavera P6." },
  "p6PreserveZeroDurationConstraintInstants": { "label": "Constraintmoment op een mijlpaal exact", "help": "Een datum-en-tijdconstraint op een mijlpaal zonder duur is een exact punt, ook aan het begin van een werkband." },
  "resumeFromActualElapsed": { "label": "Restwerk hervat na de al verstreken duur", "help": "Een lopende taak hervat haar restwerk op de actuele start plus de al verstreken duur, niet op de statusdatum." },
  "unstartedIgnoresStatusDate": { "label": "Niet-gestarte taken niet naar de statusdatum", "help": "Een taak die nog niet begonnen is, schuift niet vanzelf naar op of na de statusdatum." },
  "p6RelationFinishBoundary": { "label": "Opvolger start op de finishgrens", "help": "Bij een einde-begin-relatie zonder lag op een gedeelde bandgrens begint de opvolger op de finish van de voorganger (alleen relaties die het bestand zo markeert)." },
  "p6BackwardLagFinishBoundary": { "label": "Lag terugrekenen vanaf een finishgrens", "help": "Trekt de terugwaartse berekening een werktijd-lag af vanaf een finishgrens en komt ze precies op een bandstart uit, dan landt ze op de vorige finishgrens." },
  "p6CompletedDataDateWindow": { "label": "Voltooide taak in het statusdatumvenster", "help": "Een voltooide taak krijgt vroege datums in het venster van de statusdatum, en haar einde telt mee voor het projecteinde (alleen taken met P6-herkomst)." },
  "p6CompletedLoeActualFinish": { "label": "Voltooide LOE via het actuele einde", "help": "Een voltooide level-of-effort-activiteit met alleen een begin-begin-ingang volgt de route via haar actuele einde (alleen taken met P6-herkomst)." },
  "p6OpenLoeTargetSpan": { "label": "Niet-gestarte LOE neemt het doelvenster", "help": "Een level-of-effort-activiteit die nog niet begonnen is, neemt haar doelvenster als looptijd (alleen taken met P6-herkomst)." }
},
"profiles": {
  "builtIn": { "p6": "Primavera P6", "msproject": "Microsoft Project", "ops": "Open Planner Studio" },
  "modified": "{{name}} (aangepast)",
  "copyOf": "Kopie van {{name}}"
},
"schedulingProfile": {
  "title": "Rekenprofiel en reken-opties",
  "profile": "Rekenprofiel",
  "conventionsTitle": "Conventies van dit profiel",
  "optionsTitle": "Reken-opties van dit project",
  "customName": "Naam van dit eigen profiel",
  "saveAsTemplate": "Opslaan als sjabloon",
  "updateTemplate": "Sjabloon bijwerken vanuit dit project",
  "applyTemplate": "Bijwerken vanuit sjabloon",
  "deleteTemplate": "Sjabloon verwijderen",
  "templateDeviates": "Dit profiel wijkt af van het sjabloon “{{name}}”.",
  "applyDefaultOptions": "Standaardopties van dit profiel toepassen"
}
```

  en in het bestaande `notifications`-object:

```json
"schedulingProfileApplied": "Dit project rekent als {{profile}}. Aanpassen via Bestand → Projectinfo → Rekenprofiel.",
"schedulingProfileShifted_one": "Het nieuwe rekenprofiel verschoof {{count}} taak.",
"schedulingProfileShifted_other": "Het nieuwe rekenprofiel verschoof {{count}} taken.",
"actions": { "openProjectInfo": "Rekenprofiel openen" }
```

  `menu.json` **nl**, in `projectInfo.calc`: `"tfAuto": "Automatisch (standaard)"`,
  `"critThresholdHours": "Drempel (uren, per taakkalender)"`.

  `common.json` **en**:

```json
"conventions": {
  "preserveActualDatesInBackwardPass": { "label": "Keep actual dates in the backward pass", "help": "A started or completed task keeps its recorded dates on the late side too; a completed successor does not pull an open predecessor back into the past." },
  "clampNegativeFreeFloat": { "label": "Free float never negative", "help": "With an unachievable late constraint, total float stays negative but free float becomes zero." },
  "p6ZeroDurationUsesPlannedBoundary": { "label": "Milestone follows the planned calendar boundary", "help": "A zero-duration milestone stays on the calendar boundary the file planned: a day start stays a start milestone, a band end may land on the predecessor's finish." },
  "p6UseTaskPlannedStartFloor": { "label": "Planned start as an extra floor", "help": "The planned start from the file acts as a floor once both start and finish lie more than one calendar day later than the network allows." },
  "p6FinishMilestoneBoundaryWindow": { "label": "Finish milestone as a boundary window", "help": "A finish milestone may sit on two adjacent calendar boundaries: early start at the start of a band, early finish at the end of the previous band." },
  "p6PreserveActualInstants": { "label": "Keep actual dates exact", "help": "Recorded actual start and finish dates are not moved to a working-time band." },
  "p6UseRemainingStartForProgress": { "label": "In-progress task: early start = start of remaining work", "help": "The early and late start of an in-progress task describe where the remaining work begins, not the historical actual start. Set per file by Primavera P6." },
  "p6PreserveZeroDurationConstraintInstants": { "label": "Exact constraint moment on a milestone", "help": "A date-and-time constraint on a zero-duration milestone is an exact point, also at the start of a working band." },
  "resumeFromActualElapsed": { "label": "Remaining work resumes after the elapsed duration", "help": "An in-progress task resumes its remaining work at the actual start plus the elapsed duration, not at the status date." },
  "unstartedIgnoresStatusDate": { "label": "Don't move unstarted tasks to the status date", "help": "A task that has not started is not moved to on or after the status date automatically." },
  "p6RelationFinishBoundary": { "label": "Successor starts on the finish boundary", "help": "For a finish-to-start relation without lag on a shared band boundary, the successor starts at the predecessor's finish (only relations the file marks this way)." },
  "p6BackwardLagFinishBoundary": { "label": "Backward lag from a finish boundary", "help": "When the backward pass subtracts a working-time lag from a finish boundary and lands exactly on a band start, it lands on the previous finish boundary." },
  "p6CompletedDataDateWindow": { "label": "Completed task in the data-date window", "help": "A completed task gets early dates in the data-date window, and its finish counts toward the project finish (only tasks with P6 provenance)." },
  "p6CompletedLoeActualFinish": { "label": "Completed LOE via its actual finish", "help": "A completed level-of-effort activity with only a start-to-start input follows the route through its actual finish (only tasks with P6 provenance)." },
  "p6OpenLoeTargetSpan": { "label": "Unstarted LOE uses the target window", "help": "A level-of-effort activity that has not started takes its target window as its span (only tasks with P6 provenance)." }
},
"profiles": {
  "builtIn": { "p6": "Primavera P6", "msproject": "Microsoft Project", "ops": "Open Planner Studio" },
  "modified": "{{name}} (modified)",
  "copyOf": "Copy of {{name}}"
},
"schedulingProfile": {
  "title": "Calculation profile and options",
  "profile": "Calculation profile",
  "conventionsTitle": "Conventions of this profile",
  "optionsTitle": "Calculation options of this project",
  "customName": "Name of this custom profile",
  "saveAsTemplate": "Save as template",
  "updateTemplate": "Update template from this project",
  "applyTemplate": "Update from template",
  "deleteTemplate": "Delete template",
  "templateDeviates": "This profile differs from the template “{{name}}”.",
  "applyDefaultOptions": "Apply this profile's default options"
}
```

  `notifications` **en**: `"schedulingProfileApplied": "This project calculates as {{profile}}. Change it via File → Project info → Calculation profile."`,
  `"schedulingProfileShifted_one": "The new calculation profile moved {{count}} task."`,
  `"schedulingProfileShifted_other": "The new calculation profile moved {{count}} tasks."`,
  `"actions": { "openProjectInfo": "Open calculation profile" }`. `menu.json` **en**: `"tfAuto": "Automatic (default)"`,
  `"critThresholdHours": "Threshold (hours, per task calendar)"`.

  **De overige twaalf locales** krijgen exact dezelfde sleutelstructuur met een vertaling van de Engelse
  tekst door de implementer (Opus), met deze vaste regels: `profiles.builtIn.*` blijven de drie
  merknamen letterlijk; `{{profile}}`, `{{name}}`, `{{count}}` blijven onvertaald; menupaden volgen de
  bestaande vertaling van "Bestand/File", "Projectinfo/Project info" in dezelfde locale (zoek de
  bestaande sleutels `menu:backstage.projectInfo` e.d. en neem die woorden over); `schedulingProfileShifted`
  krijgt per locale precies de CLDR-categorieën (§0 punt 7). `ar` en `fa` zijn RTL — de pijlen `→` blijven
  staan (bestaande praktijk in die locales controleren en volgen).
- [ ] **Step 4:** `bash tests/planning/run.sh check-conventions-registry.ts` ⇒ exit 0; `npm run verify:i18n`
  ⇒ exit 0. Mutant: verwijder `schedulingProfileShifted_few` uit `pl` ⇒ `verify:i18n` rood ⇒ herstel.
- [ ] **Step 5:** commit `i18n(rekenprofielen): conventies, profielen en meldingen in 14 talen`.
- Hardening: H1 n.v.t.; H2 nl/en-teksten staan hier letterlijk; H3 mutant step 4.

### Task D2: Het bewerkmodel (puur) — keuze, wissel, kopie-bij-wijziging, optievelden

**Files:** Create `src/state/schedulingProfileDraft.ts`; Test: `tests/planning/check-scheduling-profile-draft.ts`
(vervangt de M1-stub).

- [ ] **Step 1: falende test** — vervang de stub door:

```ts
// Bewerkmodel van het rekenprofielblok (rekenprofielen, spec v3.1 §3.2/§6; plan taak D2). Exit 0 = groen.
import {
  choiceOf, selectProfile, editConvention, renameProfile, profileLabel, templateRelation,
  totalFloatModeToUi, totalFloatModeFromUi, withCriticalMode, withCriticalThreshold, withDefaultOptions, sameSettings,
} from '@/state/schedulingProfileDraft';
import { builtInProfile, defaultOptionsFor } from '@/engine/scheduler/conventions/registry';
import type { SchedulingProfile } from '@/types/project';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const xerP6: SchedulingProfile = { ...builtInProfile('p6'), overrides: { p6UseRemainingStartForProgress: true } };
const own: SchedulingProfile = { baseId: 'p6', id: 'prof-own', name: 'Eigen', overrides: { clampNegativeFreeFloat: false } };
const copy = { id: 'prof-new', name: 'Kopie van Primavera P6' };

eq('01 keuzewaarde ingebouwd', choiceOf(xerP6, []), 'builtin:p6');
eq('02 keuzewaarde sjabloon', choiceOf(own, [own]), 'template:prof-own');
eq('03 keuzewaarde los eigen profiel', choiceOf(own, []), 'current');
eq('04 afwezig = ops', choiceOf(undefined, []), 'builtin:ops');
eq('05 wissel bewaart overrides op een ingebouwd id letterlijk (spec §3.2)', selectProfile(xerP6, 'builtin:msproject', []),
  { baseId: 'msproject', id: 'msproject', name: '', overrides: { p6UseRemainingStartForProgress: true } });
eq('06 wissel vanaf een eigen profiel = basis + alleen perFile', selectProfile(own, 'builtin:p6', []), builtInProfile('p6'));
eq('07 wissel naar schone ops = afwezig', selectProfile(builtInProfile('p6'), 'builtin:ops', []), undefined);
const fromTemplate = selectProfile(undefined, 'template:prof-own', [own]);
eq('08 sjabloon wordt gekopieerd (eigen kopie op het project)', [fromTemplate, fromTemplate === own], [own, false]);
eq('09 conventie wijzigen op ingebouwd ⇒ eigen kopie', editConvention(xerP6, 'clampNegativeFreeFloat', false, copy),
  { baseId: 'p6', id: 'prof-new', name: 'Kopie van Primavera P6', overrides: { clampNegativeFreeFloat: false, p6UseRemainingStartForProgress: true } });
eq('10 conventie wijzigen op eigen profiel houdt het id', editConvention(own, 'p6OpenLoeTargetSpan', false, copy)?.id, 'prof-own');
eq('11 terug naar de basiswaarde haalt de override weg', editConvention(own, 'clampNegativeFreeFloat', true, copy)?.overrides, {});
eq('12 ongewijzigde waarde = no-op (zelfde object)', editConvention(own, 'clampNegativeFreeFloat', false, copy) === own, true);
eq('13 hernoemen trimt en kapt af op 200', renameProfile(own, `  ${'x'.repeat(10_000_000)}  `)?.name.length, 200);
eq('14 ingebouwd is niet hernoembaar', renameProfile(xerP6, 'Nee'), xerP6);
eq('15 lege naam wordt genegeerd', renameProfile(own, '   ')?.name, 'Eigen');
eq('16 label ingebouwd met bestandsoverride = aangepast', profileLabel(xerP6), { kind: 'builtIn', baseId: 'p6', modified: true });
eq('17 label eigen profiel', profileLabel(own), { kind: 'custom', name: 'Eigen' });
eq('18 sjabloonrelatie', [templateRelation(own, []), templateRelation(own, [own]),
  templateRelation({ ...own, overrides: {} }, [own])], ['none', 'same', 'deviates']);
eq("19 'auto' is alleen UI", [totalFloatModeToUi(undefined), totalFloatModeFromUi('auto'), totalFloatModeFromUi('finish')], ['auto', undefined, 'finish']);
eq('20 modewissel houdt thresholdHours (A6)',
  withCriticalMode({ criticalDefinition: { mode: 'totalFloat', thresholdHours: 8 } }, 'longestPath').criticalDefinition,
  { mode: 'longestPath', thresholdHours: 8 });
eq('21 drempel in dagen zetten houdt thresholdHours',
  withCriticalThreshold({ criticalDefinition: { mode: 'totalFloat', thresholdHours: 8 } }, 'threshold', 2).criticalDefinition,
  { mode: 'totalFloat', thresholdHours: 8, threshold: 2 });
eq('22 standaardopties van p6', withDefaultOptions(builtInProfile('p6')), defaultOptionsFor('p6'));
eq('23 standaardopties van ops = afwezig', withDefaultOptions(undefined), undefined);
eq('24 sameSettings negeert sleutelvolgorde en normaliseert ops',
  sameSettings({ profile: builtInProfile('ops'), options: { lagCalendar: 'successor', totalFloatMode: 'finish' } },
    { profile: undefined, options: { totalFloatMode: 'finish', lagCalendar: 'successor' } }), true);

if (diffs.length === 0) console.log(`OK: bewerkmodel rekenprofiel — ${checks} checks groen`);
else { console.log(`XX bewerkmodel rekenprofiel — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
```

- [ ] **Step 2:** `bash tests/planning/run.sh check-scheduling-profile-draft.ts` ⇒ rood (module ontbreekt).
- [ ] **Step 3: implementatie** — `src/state/schedulingProfileDraft.ts`:

```ts
// Het pure bewerkmodel achter het blok "Rekenprofiel en reken-opties" (rekenprofielen, spec v3.1).
// Geen store, geen React: de UI (SchedulingProfileSection) en de store-actie delen deze regels.
import type {
  BuiltInProfileId, ConventionKey, ProjectSchedulingOptions, SchedulingConventions, SchedulingProfile,
} from '@/types/project';
import {
  CONVENTION_KEYS, builtInProfile, defaultOptionsFor, diffAgainstBase, isBuiltInProfileId, isDefaultProfile,
  resolveConventions, switchProfile,
} from '@/engine/scheduler/conventions/registry';
import { MAX_PROFILE_NAME_LENGTH } from '@/services/ifc/schedulingOptionsRead';

export interface SchedulingSettingsDraft {
  profile: SchedulingProfile | undefined;
  options: ProjectSchedulingOptions | undefined;
}
export type ProfileChoice = `builtin:${BuiltInProfileId}` | `template:${string}` | 'current';

export function copyProfile(p: SchedulingProfile): SchedulingProfile {
  return { baseId: p.baseId, id: p.id, name: p.name, overrides: { ...p.overrides } };
}

export function choiceOf(profile: SchedulingProfile | undefined, templates: readonly SchedulingProfile[]): ProfileChoice {
  const p = profile ?? builtInProfile('ops');
  if (isBuiltInProfileId(p.id)) return `builtin:${p.id}`;
  if (templates.some(t => t.id === p.id)) return `template:${p.id}`;
  return 'current';
}

/** Keuzelijst-wissel: een ingebouwde keuze gaat via `switchProfile` (spec v3.1 §3.2: overrides op een
 *  ingebouwd id blijven letterlijk; van een eigen profiel blijven alleen de per-bestand-waarden). Een
 *  sjabloon wordt gekopieerd: het project draagt zijn eigen kopie (matching op id). */
export function selectProfile(
  current: SchedulingProfile | undefined, choice: ProfileChoice, templates: readonly SchedulingProfile[],
): SchedulingProfile | undefined {
  if (choice === 'current') return current;
  if (choice.startsWith('builtin:')) {
    const next = switchProfile(current, choice.slice('builtin:'.length) as BuiltInProfileId);
    return isDefaultProfile(next) ? undefined : next;
  }
  const template = templates.find(t => t.id === choice.slice('template:'.length));
  return template ? copyProfile(template) : current;
}

function clampName(name: string): string {
  return name.slice(0, MAX_PROFILE_NAME_LENGTH + 1).trim().slice(0, MAX_PROFILE_NAME_LENGTH);
}

/** Handmatige conventiewijziging. Op een ingebouwd id maakt dat automatisch een eigen profiel
 *  ("Kopie van P6", spec v3.1 §6); op een eigen profiel blijft het id. */
export function editConvention(
  current: SchedulingProfile | undefined, key: ConventionKey, value: boolean, copy: { id: string; name: string },
): SchedulingProfile | undefined {
  const p = current ?? builtInProfile('ops');
  const values = resolveConventions(p);
  if (values[key] === value) return current;
  values[key] = value;
  const overrides = diffAgainstBase(p.baseId, values);
  if (isBuiltInProfileId(p.id)) return { baseId: p.baseId, id: copy.id, name: clampName(copy.name), overrides };
  return { ...p, overrides };
}

export function renameProfile(current: SchedulingProfile | undefined, name: string): SchedulingProfile | undefined {
  if (!current || isBuiltInProfileId(current.id)) return current;
  const clean = clampName(name);
  return clean ? { ...current, name: clean } : current;
}

export type ProfileLabel =
  | { kind: 'builtIn'; baseId: BuiltInProfileId; modified: boolean }
  | { kind: 'custom'; name: string };

export function profileLabel(profile: SchedulingProfile | undefined): ProfileLabel {
  const p = profile ?? builtInProfile('ops');
  if (isBuiltInProfileId(p.id)) {
    return { kind: 'builtIn', baseId: p.id, modified: Object.keys(diffAgainstBase(p.baseId, resolveConventions(p))).length > 0 };
  }
  return { kind: 'custom', name: p.name };
}

function sameConventions(a: SchedulingConventions, b: SchedulingConventions): boolean {
  return CONVENTION_KEYS.every(key => a[key] === b[key]);
}

export type TemplateRelation = 'none' | 'same' | 'deviates';
export function templateRelation(profile: SchedulingProfile | undefined, templates: readonly SchedulingProfile[]): TemplateRelation {
  if (!profile || isBuiltInProfileId(profile.id)) return 'none';
  const t = templates.find(x => x.id === profile.id);
  if (!t) return 'none';
  return t.baseId === profile.baseId && t.name === profile.name
    && sameConventions(resolveConventions(t), resolveConventions(profile)) ? 'same' : 'deviates';
}

/** 'auto' bestaat alleen in de UI (spec v3.1 §3.1): in de state is het `undefined` (hybride formule). */
export type TotalFloatModeUi = 'auto' | 'start' | 'finish' | 'smallest';
export function totalFloatModeToUi(value: ProjectSchedulingOptions['totalFloatMode']): TotalFloatModeUi {
  return value ?? 'auto';
}
export function totalFloatModeFromUi(value: TotalFloatModeUi): ProjectSchedulingOptions['totalFloatMode'] {
  return value === 'auto' ? undefined : value;
}

/** Kritiekdefinitie per veld — `thresholdHours` valt nooit weg (spec v3.1 §6, A6). */
export function withCriticalMode(
  options: ProjectSchedulingOptions | undefined, mode: 'totalFloat' | 'longestPath',
): ProjectSchedulingOptions {
  return { ...(options ?? {}), criticalDefinition: { ...(options?.criticalDefinition ?? {}), mode } };
}
export function withCriticalThreshold(
  options: ProjectSchedulingOptions | undefined, field: 'threshold' | 'thresholdHours', value: number,
): ProjectSchedulingOptions {
  const previous = options?.criticalDefinition ?? { mode: 'totalFloat' as const };
  return { ...(options ?? {}), criticalDefinition: { ...previous, [field]: value } };
}

export function withDefaultOptions(profile: SchedulingProfile | undefined): ProjectSchedulingOptions | undefined {
  const options = defaultOptionsFor((profile ?? builtInProfile('ops')).baseId);
  return Object.keys(options).length > 0 ? options : undefined;
}

export function normalizeProfile(profile: SchedulingProfile | undefined): SchedulingProfile | undefined {
  return isDefaultProfile(profile) ? undefined : profile;
}
export function normalizeOptions(options: ProjectSchedulingOptions | undefined): ProjectSchedulingOptions | undefined {
  if (!options) return undefined;
  const clean = JSON.parse(JSON.stringify(options)) as ProjectSchedulingOptions;
  return Object.keys(clean).length > 0 ? clean : undefined;
}
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => (v && typeof v === 'object' && !Array.isArray(v))
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
    : v) ?? 'undefined';
}
export function sameSettings(a: SchedulingSettingsDraft, b: SchedulingSettingsDraft): boolean {
  return canonicalJson(normalizeProfile(a.profile)) === canonicalJson(normalizeProfile(b.profile))
    && canonicalJson(normalizeOptions(a.options)) === canonicalJson(normalizeOptions(b.options));
}
```

- [ ] **Step 4:** groen (vereist M1.2 voor assertie 05). Mutanten: (a) in `withCriticalMode` de spread van
  de vorige definitie weglaten ⇒ 20 rood; (b) in `selectProfile` `switchProfile` vervangen door
  `builtInProfile` ⇒ 05 rood; (c) in `editConvention` de kopietak weglaten ⇒ 09 rood.
- [ ] **Step 5:** commit `feat(rekenprofielen): bewerkmodel voor profielkeuze, kopie-bij-wijziging en reken-opties`.
- Hardening: H1 naam afgekapt vóór trim, vaste conventielus; H2 verwachtingen met de hand; H3 mutanten;
  H4 geen modulestaat.

### Task D3: Store-actie — toepassen (één undo-stap + herberekenen + telling)

> Vereist C (merge `claude/rekenprofielen-baan-c` t/m C6: `solveInputFor` in `runCPM` en de
> meldingssleutel `notifications.schedulingProfileShifted`). Sjablonen horen **niet** in de store: die
> leest/schrijft de UI rechtstreeks via `profileStore` (baan A).

**Files:** Create `src/state/slices/schedulingProfileSlice.ts`; Modify `src/state/appStore.ts`;
Test: `tests/planning/check-scheduling-profile-actions.ts` (vervangt de M1-stub).

- [ ] **Step 1: falende test**:

```ts
// Store-actie van het rekenprofiel (rekenprofielen, spec v3.1 §6; plan taak D3). Exit 0 = groen.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ctx = createAppStoreContext();
const S = () => ctx.store.getState();
const applied = () => S().historyEvents.filter(event => event.state === 'applied').length;

S().newProject();
S().setProject({ startDate: '2026-05-04' });
const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-04', 3) });
S().setStatusDate('2026-06-01');
S().runCPM();
eq('01 uitgangspunt: OPS zet de niet-gestarte taak op of na de statusdatum',
  (S().tasks.find(t => t.id === a)?.time.earlyStart ?? '') >= '2026-06-01', true);
const before = applied();
const result = S().applySchedulingSettings({ profile: builtInProfile('msproject'), options: undefined });
eq('02 wissel is een wijziging', result.changed, true);
eq('03 MS Project (A23) laat de taak op haar eigen start', S().tasks.find(t => t.id === a)?.time.earlyStart, '2026-05-04');
eq('04 telling achteraf', result.shifted, 1);
eq('05 melding "1 taak verschoven"', S().ui.notifications.some(n =>
  n.messageKey === 'notifications.schedulingProfileShifted' && n.params?.count === 1), true);
eq('06 precies één undo-stap', applied(), before + 1);
eq('07 herberekend, dus niet stale', S().scheduleStale, false);
const again = S().applySchedulingSettings({ profile: builtInProfile('msproject'), options: undefined });
eq('08 zelfde instellingen ⇒ geen wijziging en geen undo-stap', [again.changed, applied()], [false, before + 1]);
S().undo();
eq('09 undo herstelt het vorige profiel', S().project.schedulingProfile, undefined);
ctx.store.setState(s => { s.datesAsRecorded = true; s.scheduleStale = false; }); // fixture: modus aan
S().applySchedulingSettings({ profile: builtInProfile('p6'), options: undefined });
eq('10 een wissel verlaat "datums zoals opgeslagen"', S().datesAsRecorded, false);
S().applySchedulingSettings({ profile: builtInProfile('ops'), options: {} });
eq('11 ops-zonder-overrides en lege opties ⇒ afwezig', [S().project.schedulingProfile, S().project.schedulingOptions], [undefined, undefined]);

if (diffs.length === 0) console.log(`OK: rekenprofiel-actie — ${checks} checks groen`);
else { console.log(`XX rekenprofiel-actie — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
```

- [ ] **Step 2:** `bash tests/planning/run.sh check-scheduling-profile-actions.ts` ⇒ rood.
- [ ] **Step 3: implementatie** — `src/state/slices/schedulingProfileSlice.ts`:

```ts
// Store-actie van het rekenprofiel (rekenprofielen, spec v3.1 §6). Het profiel en de projectopties zijn
// documentdata (`project`, rijdt mee in DOCUMENT_FIELDS/snapshot). Eigen sjablonen zijn app-globaal en
// leven buiten de store (`services/schedulingProfiles/profileStore.ts`).
import type { AppSliceFactory } from './types';
import { countShiftedTasks, type RecordedTime } from '@/engine/scheduler/recordedDates';
import { isLeafTask } from '@/utils/taskHierarchy';
import {
  copyProfile, normalizeOptions, normalizeProfile, sameSettings, type SchedulingSettingsDraft,
} from '@/state/schedulingProfileDraft';

export type SchedulingSettings = SchedulingSettingsDraft;

export interface SchedulingProfileSlice {
  /** Eén undo-stap: `finishMutation({ stale: true })` (verlaat ook "datums zoals opgeslagen"), daarna
   *  `runCPM()` zoals Toepassen in Projectinfo altijd deed (ook met Automatisch berekenen uit), daarna
   *  één melding "N taken verschoven" (vóór/ná-telling, dezelfde als de #63-strook). Geen kloon-solve
   *  vooraf, geen dialoog. */
  applySchedulingSettings: (next: SchedulingSettings) => { changed: boolean; shifted: number | null };
}

export const createSchedulingProfileSlice: AppSliceFactory<SchedulingProfileSlice> = (runtime) => (set, get) => ({
  applySchedulingSettings: (next) => {
    const before = get();
    if (sameSettings({ profile: before.project.schedulingProfile, options: before.project.schedulingOptions }, next)) {
      return { changed: false, shifted: null };
    }
    const profile = normalizeProfile(next.profile);
    const options = normalizeOptions(next.options);
    const times: Record<string, RecordedTime> = {};
    for (const task of before.tasks) {
      if (isLeafTask(task) && task.time.earlyStart && task.time.earlyFinish) {
        times[task.id] = { start: task.time.earlyStart, finish: task.time.earlyFinish };
      }
    }
    set((s) => {
      runtime.beginUndoable(s);
      s.project.schedulingProfile = profile ? copyProfile(profile) : undefined;
      s.project.schedulingOptions = options;
      s.project.modifiedAt = new Date().toISOString();
      runtime.finishMutation(s, { stale: true });
    });
    get().runCPM();
    const after = get();
    if (after.cpmResult?.error) return { changed: true, shifted: null };
    const shifted = countShiftedTasks(after.tasks, times);
    if (shifted > 0) {
      after.notify({
        severity: 'info',
        messageKey: 'notifications.schedulingProfileShifted',
        params: { count: shifted },
        dedupeKey: `scheduling-profile-shifted:${after.activeDocumentId}`,
      });
    }
    return { changed: true, shifted };
  },
});
```

  `appStore.ts`: `import { createSchedulingProfileSlice, type SchedulingProfileSlice } from './slices/schedulingProfileSlice';`,
  `& SchedulingProfileSlice` in `AppState`, en `...createSchedulingProfileSlice(runtime)(...a),` in
  `createAppStoreContext` (na `createLibrarySlice`). Geen nieuw dataveld ⇒ `documentContract.ts` hoeft
  niets te classificeren.
- [ ] **Step 4:** groen; `bash tests/planning/run.sh check-document-contract.ts check-store-runtime-isolation.ts`
  ⇒ exit 0; `npm run verify:store-boundaries` ⇒ exit 0. Mutanten: laat `get().runCPM()` weg ⇒ 03 rood;
  laat de `notify` weg ⇒ 05 rood.
- [ ] **Step 5:** commit `feat(rekenprofielen): store-actie voor profielwissel met telling achteraf`.
- Hardening: H1 lus over de takenlijst van het document (geen bestandswaarde); H3 mutanten; H4 geen
  modulestaat; H5 geen try/catch.

### Task D4: Het blok "Rekenprofiel en reken-opties" (vervangt `CalcOptionsSection`)

**Files:** Create `src/components/settings/SchedulingProfileSection.tsx`; Delete
`src/components/dialogs/CalcOptionsSection.tsx` (in D5, zodra niets hem meer importeert).

Ontwerpregels: de profielkeuze is een **native** `<select>` (zoals de bibliotheekkeuze in
`ProjectInfoPanelContent`, en daardoor bedienbaar in de browsertest); uitleg per conventie staat in de
`title`-tooltip, niet als verspreide bijschriften; mededelingen ("wijkt af van het sjabloon") staan in
één gekleurd blok (werkafspraak UI). Het blok is een **draft**: niets gaat naar de store vóór Toepassen,
behalve het opslaan/verwijderen van een app-globaal sjabloon (dat is geen projectdata).

- [ ] **Step 1: component** — `src/components/settings/SchedulingProfileSection.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Select } from '@/components/common/Select';
import {
  BUILT_IN_PROFILE_IDS, CONVENTIONS, displayNameKey, resolveConventions,
} from '@/engine/scheduler/conventions/registry';
import { deleteCustomProfile, loadCustomProfiles, upsertCustomProfile } from '@/services/schedulingProfiles/profileStore';
import type { BuiltInProfileId, ProjectSchedulingOptions } from '@/types/project';
import { generateId } from '@/utils/id';
import { isHourCalendar } from '@/services/subdayIo';
import { effHoursPerDay } from '@/utils/taskDuration';
import {
  choiceOf, editConvention, profileLabel, renameProfile, selectProfile, templateRelation, totalFloatModeFromUi,
  totalFloatModeToUi, withCriticalMode, withCriticalThreshold, withDefaultOptions,
  type ProfileChoice, type SchedulingSettingsDraft, type TotalFloatModeUi,
} from '@/state/schedulingProfileDraft';

interface SchedulingProfileSectionProps {
  /** 'wizard' = alleen de keuzelijst; een keuze past meteen de standaardopties van dat profiel toe.
   *  'edit' = het volledige blok (dialoog én Backstage → Projectinfo). */
  mode: 'wizard' | 'edit';
  /** DRAFT (lokale kopie in ProjectInfoPanelContent), NIET de store. */
  value: SchedulingSettingsDraft;
  onChange: (next: SchedulingSettingsDraft) => void;
}

/**
 * Rekenprofielen (spec v3.1 §6) — opvolger van `CalcOptionsSection`. Bovenaan het profiel (ingebouwd,
 * eigen sjablonen, of het eigen profiel van dit project), daaronder de vijftien conventies en de negen
 * projectopties. Commit gebeurt pas op Toepassen via `applySchedulingSettings` (één undo-stap,
 * herberekenen, melding "N taken verschoven").
 */
export function SchedulingProfileSection({ mode, value, onChange }: SchedulingProfileSectionProps) {
  const { t } = useTranslation('common');
  const { t: tMenu } = useTranslation('menu');
  // Eigen sjablonen: app-globaal, buiten de store (profileStore, baan A). Lezen bij mount; na opslaan of
  // verwijderen opnieuw lezen, zodat de lijst altijd gelijk is aan wat er gepersisteerd staat.
  const [templates, setTemplates] = useState(() => loadCustomProfiles());
  const saveTemplate = (p: NonNullable<SchedulingSettingsDraft['profile']>) => {
    if (upsertCustomProfile(p)) setTemplates(loadCustomProfiles());
  };
  const deleteTemplate = (id: string) => {
    deleteCustomProfile(id);
    setTemplates(loadCustomProfiles());
  };
  const durationDisplay = useAppStore(s => s.ui.durationDisplay);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);
  const projectCal = useAppStore(s => s.calendar);

  const profile = value.profile;
  const so: ProjectSchedulingOptions = value.options ?? {};
  const conventions = useMemo(() => resolveConventions(profile), [profile]);
  const label = profileLabel(profile);
  const relation = templateRelation(profile, templates);
  const brand = (id: BuiltInProfileId) => t(displayNameKey(id));
  const currentName = label.kind === 'builtIn' ? brand(label.baseId) : label.name;
  const choice = choiceOf(profile, templates);

  const choices: { value: ProfileChoice; label: string }[] = [
    ...BUILT_IN_PROFILE_IDS.map(id => ({
      value: `builtin:${id}` as ProfileChoice,
      label: label.kind === 'builtIn' && label.baseId === id && label.modified
        ? t('profiles.modified', { name: brand(id) }) : brand(id),
    })),
    ...templates.map(tp => ({ value: `template:${tp.id}` as ProfileChoice, label: tp.name })),
    ...(choice === 'current' ? [{ value: 'current' as ProfileChoice, label: currentName }] : []),
  ];

  const onChoose = (next: ProfileChoice) => {
    const nextProfile = selectProfile(profile, next, templates);
    onChange(mode === 'wizard'
      ? { profile: nextProfile, options: withDefaultOptions(nextProfile) }
      : { ...value, profile: nextProfile });
  };
  const patchOptions = (next: ProjectSchedulingOptions) => onChange({ ...value, options: next });

  const inputCls =
    'px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent';
  const numCls =
    'w-20 px-2 py-1 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent';
  const labelCls = 'text-text-secondary font-medium';

  const profileSelect = (
    <div className="flex flex-col gap-1">
      <label className={labelCls} htmlFor="ops-scheduling-profile">{t('schedulingProfile.profile')}</label>
      <select
        id="ops-scheduling-profile"
        value={choice}
        onChange={e => onChoose(e.target.value as ProfileChoice)}
        className={inputCls}
        data-ops-scheduling-profile-select
      >
        {choices.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    </div>
  );

  if (mode === 'wizard') return profileSelect;

  // Reken-opties (overgenomen uit CalcOptionsSection, met twee reparaties: 'auto' voor afwezig, en
  // thresholdHours die bij een bewerking niet meer wegvalt — spec v3.1 §6, A6/A7).
  const hpd = effHoursPerDay(projectCal);
  const hourUnit = enableHourPlanning
    && (durationDisplay === 'hours' || (durationDisplay === 'auto' && isHourCalendar(projectCal)));
  const crit = so.criticalDefinition;
  const critMode = crit?.mode ?? 'totalFloat';
  const hoursThreshold = crit?.thresholdHours !== undefined;
  const ncEnabled = so.nearCriticalThreshold !== undefined;
  const ncDays = so.nearCriticalThreshold ?? 2;
  const ncDisplay = hourUnit ? +(ncDays * hpd).toFixed(2) : ncDays;
  const fp = so.floatPaths;
  const copyTarget = { id: generateId('prof'), name: t('profiles.copyOf', { name: currentName }) };

  return (
    <div className="flex flex-col gap-3" data-ops-scheduling-profile-section>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="text-body leading-5 font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
        {t('schedulingProfile.title')}
      </span>
      {profileSelect}

      {label.kind === 'custom' && (
        <div className="flex flex-col gap-1">
          <label className={labelCls} htmlFor="ops-scheduling-profile-name">{t('schedulingProfile.customName')}</label>
          <input
            id="ops-scheduling-profile-name"
            value={label.name}
            onChange={e => onChange({ ...value, profile: renameProfile(profile, e.target.value) })}
            className={inputCls}
            data-ops-scheduling-profile-name
          />
        </div>
      )}

      {relation === 'deviates' && (
        <div
          className="rounded-[8px] px-2 py-1.5"
          style={{ background: 'var(--theme-warning-soft, rgba(217,119,6,0.12))', color: 'var(--theme-text-primary)' }}
          data-ops-scheduling-template-deviates
        >
          {t('schedulingProfile.templateDeviates', { name: templates.find(tp => tp.id === profile?.id)?.name ?? '' })}
        </div>
      )}

      {label.kind === 'custom' && profile && (
        <div className="flex flex-wrap gap-2">
          {relation === 'none' && (
            <button type="button" className="btn" onClick={() => saveTemplate(profile)} data-ops-scheduling-save-template>
              {t('schedulingProfile.saveAsTemplate')}
            </button>
          )}
          {relation === 'deviates' && (
            <>
              <button type="button" className="btn" onClick={() => saveTemplate(profile)}>{t('schedulingProfile.updateTemplate')}</button>
              <button type="button" className="btn" onClick={() => onChoose(`template:${profile.id}`)}>{t('schedulingProfile.applyTemplate')}</button>
            </>
          )}
          {relation !== 'none' && (
            <button type="button" className="btn" onClick={() => deleteTemplate(profile.id)}>{t('schedulingProfile.deleteTemplate')}</button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1" data-ops-scheduling-conventions>
        <span className={labelCls}>{t('schedulingProfile.conventionsTitle')}</span>
        {CONVENTIONS.map(c => (
          <label key={c.id} className="flex items-center gap-1.5" title={t(`${c.labelKey}.help`)}>
            <input
              type="checkbox"
              className="accent-accent"
              checked={conventions[c.id]}
              onChange={e => onChange({ ...value, profile: editConvention(profile, c.id, e.target.checked, copyTarget) })}
              data-ops-convention={c.id}
            />
            {t(`${c.labelKey}.label`)}
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2" data-ops-scheduling-options>
        <div className="flex items-center justify-between gap-2">
          <span className={labelCls}>{t('schedulingProfile.optionsTitle')}</span>
          <button type="button" className="btn" onClick={() => onChange({ ...value, options: withDefaultOptions(profile) })}
            data-ops-scheduling-apply-defaults>
            {t('schedulingProfile.applyDefaultOptions')}
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls}>{tMenu('projectInfo.calc.criticalDefinition')}</label>
          <div className="grid grid-cols-2 gap-2">
            <Select
              aria-label={tMenu('projectInfo.calc.criticalDefinition')}
              value={critMode}
              onChange={v => patchOptions(withCriticalMode(so, v as 'totalFloat' | 'longestPath'))}
              options={[
                { value: 'totalFloat', label: tMenu('projectInfo.calc.critTotalFloat') },
                { value: 'longestPath', label: tMenu('projectInfo.calc.critLongestPath') },
              ]}
            />
            {critMode === 'totalFloat' && (
              <input
                type="number"
                step="any"
                aria-label={hoursThreshold ? tMenu('projectInfo.calc.critThresholdHours') : tMenu('projectInfo.calc.critThreshold')}
                title={hoursThreshold ? tMenu('projectInfo.calc.critThresholdHours') : tMenu('projectInfo.calc.critThreshold')}
                value={hoursThreshold ? crit?.thresholdHours : (crit?.threshold ?? 0)}
                onChange={e => {
                  const n = parseFloat(e.target.value);
                  patchOptions(withCriticalThreshold(so, hoursThreshold ? 'thresholdHours' : 'threshold', Number.isFinite(n) ? n : 0));
                }}
                className={numCls}
                data-ops-crit-threshold
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls}>{tMenu('projectInfo.calc.totalFloatMode')}</label>
          <Select
            aria-label={tMenu('projectInfo.calc.totalFloatMode')}
            value={totalFloatModeToUi(so.totalFloatMode)}
            onChange={v => patchOptions({ ...so, totalFloatMode: totalFloatModeFromUi(v as TotalFloatModeUi) })}
            options={[
              { value: 'auto', label: tMenu('projectInfo.calc.tfAuto') },
              { value: 'smallest', label: tMenu('projectInfo.calc.tfSmallest') },
              { value: 'start', label: tMenu('projectInfo.calc.tfStart') },
              { value: 'finish', label: tMenu('projectInfo.calc.tfFinish') },
            ]}
          />
        </div>

        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-accent" checked={!!so.makeOpenEndedCritical}
            onChange={e => patchOptions({ ...so, makeOpenEndedCritical: e.target.checked || undefined })} data-ops-open-ended />
          {tMenu('projectInfo.calc.makeOpenEndedCritical')}
        </label>

        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="accent-accent" checked={ncEnabled}
              onChange={e => patchOptions({ ...so, nearCriticalThreshold: e.target.checked ? 2 : undefined })} data-ops-near-critical-enable />
            {tMenu('projectInfo.calc.nearCritical')}
          </label>
          {ncEnabled && (
            <div className="flex items-center gap-2 pl-5">
              <span className="text-text-secondary">{tMenu('projectInfo.calc.nearCriticalThreshold')}</span>
              <input type="number" step="any" min={0} aria-label={tMenu('projectInfo.calc.nearCriticalThreshold')} value={ncDisplay}
                onChange={e => {
                  const n = parseFloat(e.target.value);
                  if (!Number.isFinite(n)) return;
                  patchOptions({ ...so, nearCriticalThreshold: hourUnit && hpd > 0 ? n / hpd : n });
                }}
                className={numCls} data-ops-near-critical-threshold />
              <span className="text-text-secondary">{hourUnit ? tMenu('projectInfo.calc.unitHours') : tMenu('projectInfo.calc.unitDays')}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="accent-accent" checked={!!fp?.enabled}
              onChange={e => patchOptions({ ...so, floatPaths: e.target.checked
                ? { enabled: true, method: fp?.method ?? 'FREE_FLOAT', maxPaths: fp?.maxPaths ?? 10 } : undefined })}
              data-ops-float-paths-enable />
            {tMenu('projectInfo.calc.floatPaths')}
          </label>
          {fp?.enabled && (
            <div className="grid grid-cols-2 gap-2 pl-5">
              <Select aria-label={tMenu('projectInfo.calc.floatPathsMethod')} value={fp.method}
                onChange={v => patchOptions({ ...so, floatPaths: { ...fp, method: v as 'FREE_FLOAT' | 'TOTAL_FLOAT' } })}
                options={[
                  { value: 'FREE_FLOAT', label: tMenu('projectInfo.calc.methodFree') },
                  { value: 'TOTAL_FLOAT', label: tMenu('projectInfo.calc.methodTotal') },
                ]} />
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">{tMenu('projectInfo.calc.maxPaths')}</span>
                <input type="number" min={1} step={1} aria-label={tMenu('projectInfo.calc.maxPaths')} value={fp.maxPaths}
                  onChange={e => {
                    const n = parseInt(e.target.value, 10);
                    patchOptions({ ...so, floatPaths: { ...fp, maxPaths: Number.isFinite(n) && n > 0 ? n : 10 } });
                  }}
                  className={numCls} data-ops-max-paths />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls}>{tMenu('projectInfo.calc.lagCalendar')}</label>
          <Select aria-label={tMenu('projectInfo.calc.lagCalendar')} value={so.lagCalendar ?? 'predecessor'}
            onChange={v => patchOptions({ ...so, lagCalendar: v as ProjectSchedulingOptions['lagCalendar'] })}
            options={[
              { value: 'predecessor', label: tMenu('projectInfo.calc.lagPredecessor') },
              { value: 'successor', label: tMenu('projectInfo.calc.lagSuccessor') },
              { value: '24hour', label: tMenu('projectInfo.calc.lag24hour') },
              { value: 'projectDefault', label: tMenu('projectInfo.calc.lagProjectDefault') },
            ]} />
        </div>
      </div>
    </div>
  );
}
```

  Weigert de i18next-typering de dynamische sleutels (`` t(`${c.labelKey}.label`) ``, `t(displayNameKey(id))`),
  volg dan het bestaande patroon `tCommon(SHIFT_PRESET_LABEL[k] as 'calendar.shift.day')` uit
  `ProjectInfoPanelContent` (cast naar één concrete sleutel), niet `as any`. Klasse `btn` en de
  CSS-variabele: gebruik wat de bestaande knoppen in Projectinfo gebruiken; bestaat
  `--theme-warning-soft` niet, kies de bestaande waarschuwingsachtergrond uit `globals.css` (grep `warning`).
  Tekstgroottes alleen via de zes rollen (`verify:text-roles`).
- [ ] **Step 2:** `npm run typecheck` en `npm run lint` ⇒ 0 (de component wordt in D5 aangesloten).
- [ ] **Step 3:** commit `feat(rekenprofielen): blok Rekenprofiel en reken-opties`.
- Hardening: H1 lijsten komen uit het vaste register en de begrensde sjabloonlijst; H4 geen modulestaat
  (`generateId` per render is een pure functieaanroep); de gedragsdekking zit in D2 (model) en D6 (browser).

### Task D5: Aansluiten in Projectinfo (dialoog, Backstage, wizard)

**Files:** Modify `src/components/settings/ProjectInfoPanelContent.tsx`; Delete
`src/components/dialogs/CalcOptionsSection.tsx`.

- [ ] **Step 1: draft-state vervangen.** Vervang de import van `CalcOptionsSection` en `SchedulingOptions`
  door `SchedulingProfileSection` en `SchedulingSettingsDraft`; vervang de `schedulingOptions`-state door:

```tsx
    const applySchedulingSettings = useAppStore(s => s.applySchedulingSettings);
    // Rekenprofiel + reken-opties als DRAFT (spec v3.1 §6): zelfde commit-op-Toepassen als de rest.
    const [scheduling, setSchedulingRaw] = useState<SchedulingSettingsDraft>(
      isNew ? { profile: undefined, options: undefined }
        : { profile: project.schedulingProfile, options: project.schedulingOptions },
    );
    const setScheduling = (next: SchedulingSettingsDraft) => {
      setCalcTouched(true);
      setSchedulingRaw(next);
    };
```

  In het documentwissel-effect: `setSchedulingRaw({ profile: p.schedulingProfile, options: p.schedulingOptions });`.
  `runCPM` uit de hook-lijst verdwijnt als niets anders hem nog gebruikt (lint vangt het).
- [ ] **Step 2: commit-pad.** In `handleSubmit`, wizardtak, direct ná de bibliotheekkoppeling:
  `if (calcTouched) applySchedulingSettings(scheduling);`. Edit-tak: schrap het hele
  `soChanged`/`normalized`-blok en de slotregel `if (calcTouched && soChanged) runCPM();`, en zet na de
  bind/unbind-tak: `if (calcTouched) applySchedulingSettings(scheduling);` (de actie is zelf no-op bij
  gelijke instellingen, draait `runCPM()` en meldt de telling).
- [ ] **Step 3: render.** Vervang `{!isNew && <CalcOptionsSection … />}` door
  `<SchedulingProfileSection mode={isNew ? 'wizard' : 'edit'} value={scheduling} onChange={setScheduling} />`
  en werk de JSDoc-kop bij ("Berekening-sectie" ⇒ "Rekenprofiel en reken-opties").
- [ ] **Step 4:** `git rm src/components/dialogs/CalcOptionsSection.tsx`; `npm run typecheck`, `npm run lint`,
  `npm run verify:text-roles`, `npm run verify:cycles` ⇒ 0. Handmatige kijkcheck in de browser
  (`npm run dev`, poort uit de uitvoer): Backstage → Projectinfo toont het blok, wizard toont alleen de
  keuzelijst — screenshot in `qa/` (niet committen).
- [ ] **Step 5:** commit `feat(rekenprofielen): Projectinfo bewerkt profiel en opties als één draft`.
- Hardening: H3 gedrag bewezen in D3 (actie) en D6 (browser); H4 geen modulestaat.

### Task D6: Browsertest — openen, melding met actie, wisselen, kopie-bij-wijziging

**Files:** Create `tests/browser/scheduling-profile.spec.ts`.

- [ ] **Step 1: test**:

```ts
// Rekenprofielen in de echte gebruikersflow (spec v3.1 §8). Een .xer via de ribbonknop Openen; daarna
// alleen echte klikken. `window.__OPS__` wordt uitsluitend gebruikt om de uitkomst te LEZEN.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

// Statusdatum (last_recalc_date) 2026-03-02, niet-gestarte taak gepland op 2026-01-05: onder P6 schuift
// hij naar de statusdatum, onder MS Project (A23) niet ⇒ de wissel verschuift precies één taak.
const XER = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tProfielBrowser\tC1\t2026-03-02\t2026-01-05',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tC1\tA1\tNiet gestart\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09',
  '%E',
].join('\n');

async function openXer(page: Page): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'profiel.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(XER) });
}
const profileOf = (page: Page) => page.evaluate(() => {
  const p = window.__OPS__!.store.getState().project.schedulingProfile;
  return p ? { id: p.id, baseId: p.baseId, name: p.name } : null;
});

test('rekenprofiel: XER opent als P6 met melding, wissel naar MS Project herberekent, conventie wijzigen maakt een kopie',
  async ({ page, ops: _ops }) => {
    await openXer(page);
    await expect.poll(() => profileOf(page)).toEqual({ id: 'p6', baseId: 'p6', name: '' });

    // Eén melding voor het bestand, met de profielregel en de actieknop (info-toasts leven 5 s).
    const toast = page.locator('.ops-toast').filter({ hasText: /Primavera P6/ });
    await expect(toast).toHaveCount(1);
    await toast.locator('[data-ops-notification-action="openBackstageSection"]').click();

    // De actie opent Backstage → Projectinfo op het profielblok.
    const select = page.locator('[data-ops-scheduling-profile-select]');
    await expect(select).toHaveValue('builtin:p6');

    // Wisselen naar MS Project en toepassen ⇒ herberekend, één taak verschoven, melding met de telling.
    await select.selectOption('builtin:msproject');
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
    await expect.poll(() => profileOf(page)).toEqual({ id: 'msproject', baseId: 'msproject', name: '' });
    await expect(page.locator('.ops-toast').filter({ hasText: /verschoof 1 taak|moved 1 task/ })).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);

    // Een conventie wijzigen op een ingebouwd profiel maakt "Kopie van Microsoft Project".
    // Toepassen in Backstage roept `onDone` aan en keert terug naar het Start-tabblad; open daarom
    // opnieuw Bestand → Projectinfo met echte klikken.
    await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
    await page.getByRole('button', { name: /^(Project info|Projectinfo)$/ }).first().click();
    await expect(select).toHaveValue('builtin:msproject');
    await page.locator('[data-ops-convention="clampNegativeFreeFloat"]').check();
    await expect(select).toHaveValue('current');
    await expect(page.locator('[data-ops-scheduling-profile-name]')).toHaveValue(/^(Kopie van|Copy of) Microsoft Project$/);
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
    await expect.poll(() => profileOf(page).then(p => [p?.baseId, p?.id.startsWith('prof')]))
      .toEqual(['msproject', true]);
  });
```

  (Controleer bij het eerste draaien de toegankelijke rol van het Bestand-tabblad en het
  Projectinfo-navigatie-item in de DOM — zijn het `tab`/`link` i.p.v. `button`, pas dan alleen de rol in
  `getByRole` aan. Nooit een `.catch()` om een klik: een falende klik moet de test rood maken.)
- [ ] **Step 2:** `npm run test:browser -- scheduling-profile` ⇒ groen. Mutant: laat in `NotificationHost`
  de actieknop weg ⇒ de test faalt op de klik ⇒ herstel. Bij falen: `test-results/` en
  `playwright-report/` bekijken.
- [ ] **Step 3:** commit `test(rekenprofielen): browserflow profiel openen, wisselen en kopiëren`.
- Hardening: H3 mutant; `__OPS__` alleen lezend.


### Task D7: Gids `gids-rekenprofielen` (nl + en), manifest en verwijzingen

**Files:** Create `public/docs/nl/gids-rekenprofielen.md`, `public/docs/en/gids-rekenprofielen.md`;
Modify `public/docs/manifest.json`; Modify `public/docs/{nl,en}/gids-xer-import.md`,
`public/docs/{nl,en}/gids-msproject-import.md`, `public/docs/{nl,en}/gids-import-export.md`.

De gids is ook de **meetlat van de gebruikstest** (I5): elke bewering moet in de app te zien zijn.
Alleen de Markdown-subset van `miniMarkdown.tsx` (koppen `#`/`##`, alinea's, enkelvoudige lijsten,
`**vet**`, `` `code` ``, `docs://`-links; géén tabellen).

- [ ] **Step 1: falende poort** — manifest-entry toevoegen (ná `gids-xer-import`), zonder artikelen:

```json
    {
      "id": "gids-rekenprofielen",
      "title": {
        "nl": "Rekenprofielen",
        "en": "Calculation profiles",
        "de": "Berechnungsprofile",
        "fr": "Profils de calcul",
        "es": "Perfiles de cálculo",
        "zh": "计算配置文件",
        "it": "Profili di calcolo",
        "pt": "Perfis de cálculo",
        "pl": "Profile obliczeń",
        "tr": "Hesaplama profilleri",
        "ar": "ملفات الحساب",
        "ja": "計算プロファイル",
        "ko": "계산 프로필",
        "fa": "پروفایل‌های محاسبه"
      },
      "layer": "gidsen",
      "cluster": "rekenprofielen"
    },
```

  `npm run verify:docs` ⇒ rood (nl/en-artikel ontbreekt).
- [ ] **Step 2: `public/docs/nl/gids-rekenprofielen.md`**:

```markdown
# Rekenprofielen

Open Planner Studio rekent met één planningsmotor, maar Primavera P6 en Microsoft Project maken op een handvol plekken een andere keuze. Een **rekenprofiel** bundelt die keuzes. Elk project heeft precies één profiel; je ziet en wijzigt het onder **Bestand → Projectinfo → Rekenprofiel en reken-opties**.

## Wat je hier leert

- Wat een rekenprofiel is en welke drie ingebouwde profielen er zijn.
- Welk profiel een geopend bestand krijgt, en waarom je daar een melding over ziet.
- Hoe je van profiel wisselt en wat er dan met je planning gebeurt.
- Hoe je een eigen profiel maakt en als sjabloon bewaart.
- Wat de vijftien conventies doen.
- Wanneer een combinatie geen referentiepakket heeft.

## Wat een rekenprofiel is

Een profiel is een set van vijftien **conventies**: regels die bij een planningspakket horen, zoals "een niet-gestarte taak schuift niet vanzelf naar de statusdatum". Daarnaast heeft elk project **reken-opties** die per bestand verschillen, zoals de lag-kalender, de kritiek-definitie en de speling-berekening. Die opties horen bij het project; het profiel levert er alleen de standaard voor bij een nieuw project.

De drie ingebouwde profielen:

- **Open Planner Studio** — de standaard voor nieuwe projecten, CSV-bestanden en IFC-bestanden uit andere programma's. Rekent zoals Open Planner Studio altijd rekende.
- **Primavera P6** — de conventies van P6. Een `.xer`-bestand opent met dit profiel.
- **Microsoft Project** — de voortgangsconventies van MS Project. Een `.mpp`-bestand opent met dit profiel.

## Welk profiel krijgt een geopend bestand?

- `.xer` (Primavera P6): **Primavera P6**. De reken-opties uit het bestand worden de reken-opties van het project.
- `.mpp` (Microsoft Project): **Microsoft Project**.
- MS Project XML en P6 XML: in deze versie **Open Planner Studio**. Voor deze formaten bestaat nog geen referentiemeting; een automatische keuze zou datums verschuiven zonder dat aantoonbaar is dat het klopt.
- CSV, een nieuw project en IFC uit een ander programma: **Open Planner Studio**.
- Een eigen IFC-bestand: het profiel dat erin is opgeslagen.

Opent een bestand met een ander profiel dan Open Planner Studio, dan zie je één melding, bijvoorbeeld "Dit project rekent als Primavera P6". De knop in die melding opent Projectinfo meteen op het goede blok. Bij een `.xer`-bestand staat die regel in de gewone openingsmelding, ook als het bestand meerdere projecten bevat.

## Van profiel wisselen

Kies in **Projectinfo** een ander profiel en klik op **Toepassen**. De planning wordt meteen opnieuw berekend, ook als *Automatisch berekenen* uit staat, en een melding vertelt hoeveel taken daardoor verschoven zijn. Een wissel is één stap in *Ongedaan maken*.

Sommige waarden kwamen uit het bestand zelf, zoals de P6-instelling voor het begin van het restwerk. Die blijven bij een wissel staan. Daarom kan in de keuzelijst "Primavera P6 (aangepast)" staan: dat is geen eigen profiel, maar het ingebouwde profiel met waarden uit je bestand.

De reken-opties van het project veranderen bij een wissel niet. Wil je de standaardopties van het nieuwe profiel, klik dan op **Standaardopties van dit profiel toepassen**.

Let op bij een wissel naar Primavera P6 voor een project dat niet uit P6 komt: de conventie *Geplande start als extra ondergrens* maakt de geplande start van een taak tot ondergrens zodra die meer dan een kalenderdag later ligt dan het netwerk toelaat.

## Een eigen profiel maken

Zet in het blok een conventie aan of uit. Is het profiel ingebouwd, dan maakt Open Planner Studio er automatisch een eigen kopie van, bijvoorbeeld "Kopie van Primavera P6". Die naam kun je aanpassen.

Met **Opslaan als sjabloon** bewaar je het eigen profiel in de app, zodat je het in andere projecten kunt kiezen. Een project bewaart altijd een eigen kopie van zijn profiel: een sjabloon later wijzigen verandert geen bestaand project. Wijkt het profiel van een project af van zijn sjabloon, dan zie je dat in een gekleurd blok, met de knoppen **Bijwerken vanuit sjabloon** en **Sjabloon bijwerken vanuit dit project**.

## De vijftien conventies

Onder Open Planner Studio staan ze alle vijftien uit.

- **Actuele datums behouden in de terugwaartse berekening** (Primavera P6) — een gestarte of voltooide taak houdt haar geregistreerde datums ook aan de late kant.
- **Vrije speling nooit negatief** (Primavera P6) — bij een onhaalbare late constraint blijft de totale speling negatief, maar wordt de vrije speling nul.
- **Mijlpaal volgt de geplande kalendergrens** (Primavera P6) — een mijlpaal zonder duur blijft op de kalendergrens die het bestand plande.
- **Geplande start als extra ondergrens** (Primavera P6) — zie de waarschuwing hierboven.
- **Eindmijlpaal als grensvenster** (Primavera P6) — een eindmijlpaal mag op twee aangrenzende kalendergrenzen staan.
- **Actuele datums exact overnemen** (Primavera P6) — geregistreerde actuele datums worden niet naar een werktijdband verschoven.
- **Lopende taak: vroege start = begin van het restwerk** (per bestand uit Primavera P6) — de vroege start van een lopende taak is waar het resterende werk begint.
- **Constraintmoment op een mijlpaal exact** (Primavera P6) — een datum-en-tijdconstraint op een mijlpaal is een exact punt.
- **Restwerk hervat na de al verstreken duur** (Microsoft Project) — een lopende taak hervat op de actuele start plus de al verstreken duur.
- **Niet-gestarte taken niet naar de statusdatum** (Microsoft Project) — een taak die nog niet begonnen is, schuift niet vanzelf naar de statusdatum.
- **Opvolger start op de finishgrens** (Primavera P6) — bij relaties die het bestand zo markeert.
- **Lag terugrekenen vanaf een finishgrens** (Primavera P6) — een lag die precies op een bandstart uitkomt, landt op de vorige finishgrens.
- **Voltooide taak in het statusdatumvenster** (Primavera P6) — alleen voor taken met P6-herkomst.
- **Voltooide LOE via het actuele einde** (Primavera P6) — alleen voor taken met P6-herkomst.
- **Niet-gestarte LOE neemt het doelvenster** (Primavera P6) — alleen voor taken met P6-herkomst.

## Combinaties zonder referentiepakket

Een deel van de P6-conventies werkt alleen op taken met P6-herkomst, dus uit een `.xer`-bestand. Kies je Primavera P6 voor een eigen project, een `.mpp`-bestand of een P6 XML-bestand, dan gaan die regels niet aan. Een `.xer`-project onder het profiel Microsoft Project is eveneens een combinatie waarvoor geen referentiepakket bestaat. Zulke combinaties rekenen consistent, maar er is geen pakket om de uitkomst tegen te controleren.

## Opslaan en uitwisselen

Het profiel wordt in het IFC-bestand opgeslagen, met alle vijftien waarden, zodat het bestand overal hetzelfde rekent. Een project met het standaardprofiel slaat niets extra's op. Oudere versies van Open Planner Studio kennen het profiel niet: zij lezen alleen de reken-opties en de twee voortgangsconventies van Microsoft Project, en rekenen een P6-project zonder P6-conventies.

Bij exporteren naar CSV, MS Project XML of P6 XML gaat het profiel niet mee; die bestanden openen weer als Open Planner Studio. Voor een project uit een `.xer`-bestand meldt de export dat verlies.

## Verder lezen

- [Primavera P6 (.xer) openen](docs://gids-xer-import)
- [MS Project openen](docs://gids-msproject-import)
- [Importeren en exporteren](docs://gids-import-export)
```

- [ ] **Step 3: `public/docs/en/gids-rekenprofielen.md`** — dezelfde structuur en dezelfde koppen in het
  Engels (vertaling van de nl-tekst; conventienamen exact zoals de `en`-labels uit D1, profielnamen als
  merknaam, menupad "File → Project info → Calculation profile and options", knoppen "Apply",
  "Save as template", "Update from template", "Update template from this project", "Apply this
  profile's default options"). Koppen: `# Calculation profiles`, `## What you'll learn`,
  `## What a calculation profile is`, `## Which profile does an opened file get?`,
  `## Switching profiles`, `## Making a custom profile`, `## The fifteen conventions`,
  `## Combinations without a reference package`, `## Saving and exchanging`, `## Further reading`.
- [ ] **Step 4: verwijzingen** (nl + en, telkens één zin + een regel onder "Verder lezen"/"Further reading"):
  - `gids-xer-import`: aan het eind van "Openen en documenten" — "Een `.xer`-bestand opent met het
    rekenprofiel **Primavera P6**; zie [Rekenprofielen](docs://gids-rekenprofielen)."
  - `gids-msproject-import`: aan het eind van "Openen" — "Een `.mpp`-bestand opent met het rekenprofiel
    **Microsoft Project**; MS Project XML opent in deze versie als **Open Planner Studio**. Zie
    [Rekenprofielen](docs://gids-rekenprofielen)." In "Voortgang: MS Project se eigen hervattingsconventie"
    één zin: "Deze conventie heet in Projectinfo *Restwerk hervat na de al verstreken duur* en hoort bij
    het profiel Microsoft Project."
  - `gids-import-export`: onder "Exporteren naar andere formaten" — "Het rekenprofiel gaat niet mee naar
    CSV, MS Project XML of P6 XML; zie [Rekenprofielen](docs://gids-rekenprofielen)."
- [ ] **Step 5:** `npm run verify:docs` ⇒ exit 0. Mutant: maak van één lijst in de nl-gids een
  tabel (`| a | b |`) ⇒ `verify:docs` rood ⇒ herstel.
- [ ] **Step 6:** commit `docs(rekenprofielen): gids Rekenprofielen (nl+en) en verwijzingen`.
- Hardening: H2 elke bewering in de gids is een eis voor I5; geen belofte die de code niet waarmaakt.

### Task D8: CLAUDE.md, recept `conventie.md`, recepten-README, `ifc-round-trip.md`

**Files:** Modify `CLAUDE.md`; Create `docs/recepten/conventie.md`; Modify `docs/recepten/README.md`;
Modify `docs/ifc-round-trip.md`.

- [ ] **Step 1: CLAUDE.md — commandoblok**: voeg ná de regel van `verify:store-boundaries` toe:

```
npm run verify:conventions # los: AST-poort — src/engine/ leest geen bronformaat (p6Source/readFormat/lezer-imports); herkomst-datagates gepind, alleen omlaag
```

- [ ] **Step 2: CLAUDE.md — XER-sectie, regel (3)**: vervang de alinea die begint met
  "(3) **P6-gedrag is fail-closed op `p6Source`.**" door:

```markdown
(3) **P6-gedrag loopt via het rekenprofiel, niet via het bronformaat.** De XER-lezer zet
`project.schedulingProfile` op het ingebouwde profiel Primavera P6 (A19 per bestand als override uit
`rem_target_link_flag`); elke P6-specifieke solvertak staat achter een eigen conventievlag (zie
*Rekenprofielen* hieronder). `SchedulingOptions.p6Source` bestaat niet meer; oude IFC-bestanden met
`p6Source` migreren per veld (`legacyOptionsToProfile`). `WorkCalendar.p6Source` blijft als diagnoseveld.
Uitzondering: `lagCalendar` is sinds X5 een werkende instelling voor élk formaat.
```

- [ ] **Step 3: CLAUDE.md — nieuwe sectie** direct ná de XER-sectie:

```markdown
### Rekenprofielen: benoemde conventies, geen formaatvlag

Eén motor, drie scholen (Primavera P6, MS Project, OPS). Een **rekenprofiel** (`project.schedulingProfile`,
basis `p6 | msproject | ops` + overrides) levert vijftien **conventies** (`ConventionKey`, booleans);
`project.schedulingOptions` draagt alleen de negen **projectopties** (`ProjectOptionKey`, per bestand) en
`progressMode` blijft een eigen projectveld. De bron voor beide is `src/engine/scheduler/conventions/registry.ts`
(`CONVENTIONS` met per conventie drie ingebouwde waarden, `legacyValue`, `gatedByP6Source`, `perFile`).
De solver krijgt uitsluitend `EffectiveSchedulingOptions` via `solveOptionsFor`/`solveInputFor`
(`src/engine/scheduler/solveInput.ts`) — `CPMOptions.schedulingOptions` is verplicht dat type, dus een
aanroeper die het profiel overslaat compileert niet. Lezers stellen het profiel voor (`ImportResult.suggestedProfileId`:
XER ⇒ p6, `.mpp` ⇒ msproject, MSPDI/P6-XML/CSV ⇒ ops deze etappe); openen meldt het profiel met een
actie naar Projectinfo. IFC: `OPS_SchedulingProfile` (alle vijftien opgelost, alleen ≠ standaardprofiel)
naast `OPS_SchedulingOptions` (opties + A22/A23 alleen als true). Eigen profielen zijn app-globale
sjablonen (`ops-schedulingProfiles`, `services/schedulingProfiles/profileStore.ts`); een project draagt
zijn eigen kopie. UI: het blok *Rekenprofiel en reken-opties* in Projectinfo
(`SchedulingProfileSection.tsx`, bewerkmodel `state/schedulingProfileDraft.ts`, actie
`applySchedulingSettings`). **Regel A/B voor motorwerk:** een wijziging landt alleen als onder elk
profiel met orakel geen exacte cel inexact wordt (`npm run measure:profiles`, cel-baseline); verschilt
iets per profiel, dan is het een conventie in het register — nooit een `if` op het formaat.
`npm run verify:conventions` bewaakt dat mechanisch. Recept: `docs/recepten/conventie.md`; gids:
`public/docs/{nl,en}/gids-rekenprofielen.md`; spec: `docs/superpowers/specs/2026-09-22-rekenprofielen-design.md`.
```

  En in de *Docs*-lijst: de bullet over `docs/recepten/` noemt ook "een nieuwe rekenconventie".
- [ ] **Step 4: `docs/recepten/conventie.md`**:

```markdown
# Een nieuwe rekenconventie toevoegen

Een **conventie** is een regel die per planningspakket verschilt (P6 doet het zo, MS Project anders) en
niet per bestand. Verschilt iets per bestand, dan is het een **projectoptie** (`ProjectOptionKey`) of —
als de waarde uit het bronbestand komt maar een pakketregel is — een conventie met `perFile: true` die de
lezer als override zet (zoals A19). Twijfel je: regel B uit de goal prompt
(`docs/superpowers/plans/2026-09-22-goalprompt-x12-naar-nul.md`) beslist.

**Dit is een toelichting, geen vervanging.** Loopt het ooit achter, dan heeft de code gelijk.

## De stappen

1. **Type.** Voeg de boolean toe aan `SchedulingOptions` (`src/types/project.ts`) met een docblok (wat,
   waar in de motor, P6/MS Project/OPS), en aan de unie `ConventionKey`. De compiler dwingt daarna
   stap 2 af (`_everyConventionNamed` in het register) en houdt `ProjectOptionKey` disjunct.
2. **Register-rij** in `CONVENTIONS` (`src/engine/scheduler/conventions/registry.ts`): groep, de drie
   ingebouwde waarden, `gatedByP6Source: false` (nieuwe conventies hebben geen `p6Source`-verleden),
   `perFile`, en `since` = vandaag. `legacyValue` = het gedrag vóór vandaag (bijna altijd de OPS-waarde):
   dat geldt voor bestanden mét `OPS_SchedulingProfile` die de sleutel nog niet kennen.
3. **Motor.** Lees uitsluitend `schedulingOptions.<id>`. Nooit het bronformaat, nooit een lezer-import:
   `npm run verify:conventions` faalt anders. Een nieuwe lezing van een herkomstveld (`p6ProjectId`
   e.d.) laat de gepinde datagate-telling stijgen en maakt de poort ook rood — bespreek dat eerst.
4. **Lezer** (alleen bij `perFile`): de lezer zet de bestandswaarde als override op het profiel.
5. **i18n**: `conventions.<id>.label` en `.help` in alle 14 `common.json`-bestanden (`npm run verify:i18n`).
6. **Gids**: één regel onder "De vijftien conventies" in `public/docs/{nl,en}/gids-rekenprofielen.md`
   (pas "vijftien" aan).
7. **Tests**: `check-conventions-registry.ts` dekt de rij vanzelf; voeg een aan/uit-fixture met een
   met de hand afgeleid verschil toe (mutatiebewijs, patroon `check-conventions-p6-flags.ts`).
8. **Landingspoort**: `npm run measure:profiles` vóór de commit — geen exacte cel mag inexact worden
   onder welk profiel met orakel ook (regel A).

IFC hoeft niets: `OPS_SchedulingProfile` schrijft alle conventies opgelost; oude bestanden vallen via
`legacyValue` terug.
```

  `docs/recepten/README.md`: "zes terugkerende ontwikkelklussen" ⇒ "zeven", plus de bullet
  `- [\`conventie.md\`](conventie.md) — een nieuwe rekenconventie (rekenprofielen) toevoegen.`
  `docs/ifc-round-trip.md`: voeg onder de psets op de `IfcWorkSchedule` (zoek `OPS_SchedulingOptions`)
  een alinea toe: "`OPS_SchedulingProfile` — één JSON `{ id, baseId, conventions, name? }` met alle
  conventies opgelost; alleen geschreven als het profiel ≠ het standaardprofiel. De lezer geeft hem
  voorrang op het (gemigreerde) `OPS_SchedulingOptions`. Een nieuwe conventie heeft hier geen extra werk
  nodig (zie `docs/recepten/conventie.md`)."
- [ ] **Step 5:** `npm run verify:docs` ⇒ exit 0 (raakt `public/docs` niet, maar bewaakt de links naar
  CLAUDE.md-verwezen gidsen niet — lees de gewijzigde alinea's na op kloppende paden met
  `ls` per genoemd bestand).
- [ ] **Step 6:** commit `docs(rekenprofielen): CLAUDE.md-sectie, recept conventie en IFC-round-trip-notitie`.

### Task D9: Goal prompt — *vervallen*

De goal prompt `docs/superpowers/plans/2026-09-22-goalprompt-x12-naar-nul.md` (regel A en B) is al
geschreven en gecommit (`66418a62`). D8 en I6 verwijzen ernaar; geen werk in deze baan.

### Task D10: `verify:conventions` — de motor leest geen bronformaat, datagates alleen omlaag

> Vereist C3 (de tijdelijke vertaling is weg); haal vóór deze taak de C-branch opnieuw binnen.

**Files:** Create `scripts/verify-conventions.mjs`, `scripts/verify-conventions.datagates.json`;
Modify `package.json`, `scripts/README.md`; Test: `tests/planning/check-conventions-boundary.ts`
(vervangt de M1-stub).

- [ ] **Step 1: falende test** — vervang de stub door:

```ts
// Mechanische conventiegrens van de motor (rekenprofielen, spec v3.1 §4; plan taak D10).
// Draait de echte repositorypoort en bewijst met tijdelijke bronfixtures dat de poort (1) commentaar en
// gewone strings niet als lek ziet, (2) p6Source-lezingen, lezer-imports (statisch, relatief, dynamisch)
// weigert, (3) de datagate-telling alleen omlaag laat gaan, (4) een corrupte pin rood maakt en (5) nooit
// een baseline herschrijft zolang er iets rood is.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const diffs: string[] = [];
let checks = 0;
const ok = (label: string, condition: boolean, detail = '') => {
  checks++;
  if (!condition) diffs.push(`${label}${detail ? `: ${detail}` : ''}`);
};
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const script = join(root, 'scripts', 'verify-conventions.mjs');
const run = (checkRoot: string, extra: string[] = []) =>
  spawnSync(process.execPath, [script, '--root', checkRoot, ...extra], { cwd: root, encoding: 'utf8' });
function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'ops-conventions-'));
  for (const [rel, source] of Object.entries(files)) {
    const target = join(dir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source, 'utf8');
  }
  return dir;
}
function withFixture(files: Record<string, string>, body: (dir: string) => void): void {
  const dir = fixture(files);
  try { body(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const PIN = 'scripts/verify-conventions.datagates.json';
const ENGINE = 'src/engine/scheduler/fixture.ts';
const CLEAN = [
  '// p6Source staat hier alleen in commentaar',
  'export function f(o: { schedulingOptions: { p6RelationFinishBoundary: boolean } }, task: { p6ProjectId?: string }): boolean {',
  "  const label = 'p6Source';",
  '  return o.schedulingOptions.p6RelationFinishBoundary && task.p6ProjectId !== undefined && label.length > 0;',
  '}',
].join('\n');

// 1. De echte repository.
const real = run(root);
ok('01 actuele conventiegrens is groen', real.status === 0, `${real.stdout}${real.stderr}`.trim());

// 2. Commentaar en strings zijn geen lek; één datagate-lezing binnen de pin.
withFixture({ [ENGINE]: CLEAN, [PIN]: JSON.stringify({ p6ProjectId: 1 }) }, dir => {
  const r = run(dir);
  ok('02 commentaar/string/gepinde datagate ⇒ groen', r.status === 0, `${r.stdout}${r.stderr}`.trim());
});

// 3. Een p6Source-lezing in de motor.
withFixture({
  [ENGINE]: "export const leak = (o: { schedulingOptions: { p6Source?: string } }) => o.schedulingOptions.p6Source === 'XER';",
  [PIN]: '{}',
}, dir => {
  const r = run(dir);
  const out = `${r.stdout}${r.stderr}`;
  ok('03 p6Source-lezing ⇒ rood', r.status !== 0, out.trim());
  ok('03a rapport noemt bestand en naam', out.includes('src/engine/scheduler/fixture.ts') && out.includes('p6Source'), out.trim());
});

// 4–6. Lezer-imports: alias, relatief, dynamisch.
for (const [label, source, needle] of [
  ['04 alias-import uit services/xer', "import { readXER } from '@/services/xer/xerReader';\nexport const x = readXER;", 'src/services/xer'],
  ['05 relatieve import uit services/mpp', "import '../../services/mpp/mppReader';", 'src/services/mpp'],
  ['06 dynamische import van formatRegistry', "export const load = () => import('@/services/formatRegistry');", 'formatRegistry'],
] as const) {
  withFixture({ [ENGINE]: source, [PIN]: '{}' }, dir => {
    const r = run(dir);
    const out = `${r.stdout}${r.stderr}`;
    ok(`${label} ⇒ rood`, r.status !== 0 && out.includes(needle), out.trim());
  });
}

// 7. Datagate stijgt boven de pin.
withFixture({ [ENGINE]: CLEAN, [PIN]: JSON.stringify({ p6ProjectId: 0 }) }, dir => {
  const r = run(dir);
  const out = `${r.stdout}${r.stderr}`;
  ok('07 datagate boven de pin ⇒ rood', r.status !== 0 && out.includes('p6ProjectId'), out.trim());
});

// 8. Datagate daalt onder de pin: groen, met herpin-advies.
withFixture({ [ENGINE]: CLEAN, [PIN]: JSON.stringify({ p6ProjectId: 2 }) }, dir => {
  const r = run(dir);
  ok('08 datagate onder de pin ⇒ groen + te herpinnen', r.status === 0 && r.stdout.includes('te herpinnen'), `${r.stdout}${r.stderr}`.trim());
});

// 9. Corrupte pin (rode-pad-fixture voor de try/catch in het script).
withFixture({ [ENGINE]: CLEAN, [PIN]: '{kapot' }, dir => {
  const r = run(dir);
  ok('09 corrupte pin ⇒ rood', r.status !== 0 && `${r.stdout}${r.stderr}`.includes('geen geldige JSON'), `${r.stdout}${r.stderr}`.trim());
});

// 10. --write-baseline weigert bij rood en laat de pin ongemoeid.
withFixture({ [ENGINE]: CLEAN, [PIN]: JSON.stringify({ p6ProjectId: 0 }) }, dir => {
  const r = run(dir, ['--write-baseline']);
  ok('10 herpinnen geweigerd bij rood', r.status !== 0 && readFileSync(join(dir, PIN), 'utf8') === JSON.stringify({ p6ProjectId: 0 }),
    `${r.stdout}${r.stderr}`.trim());
});

// 11. --write-baseline schrijft de gemeten telling als alles groen is.
withFixture({ [ENGINE]: CLEAN, [PIN]: JSON.stringify({ p6ProjectId: 2 }) }, dir => {
  const r = run(dir, ['--write-baseline']);
  const pinned = JSON.parse(readFileSync(join(dir, PIN), 'utf8')) as Record<string, number>;
  ok('11 herpinnen schrijft de gemeten telling', r.status === 0 && pinned.p6ProjectId === 1, `${r.stdout}${r.stderr}`.trim());
});

if (diffs.length === 0) console.log(`OK: conventiegrens — ${checks} checks groen`);
else { console.log(`XX conventiegrens — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
```

- [ ] **Step 2:** `bash tests/planning/run.sh check-conventions-boundary.ts` ⇒ rood (script ontbreekt).
- [ ] **Step 3: implementatie** — `scripts/verify-conventions.mjs`:

```js
#!/usr/bin/env node
// Mechanische poort voor de rekenprofielen (spec docs/superpowers/specs/2026-09-22-rekenprofielen-design.md
// §4): de rekenmotor (src/engine/**) stuurt uitsluitend op conventies, nooit op het bronformaat.
//  1. Verboden: elke identifier `p6Source`, `importFormat`, `readFormat` (ook als string-index), en
//     imports (statisch, re-export of dynamisch) uit src/services/{xer,mpp,msproject,p6,csv} of
//     src/services/formatRegistry.
//  2. Herkomst-datagates (bijlage A: p6ProjectId e.d.) zijn toegestaan maar geteld; de telling per veld
//     staat gepind in scripts/verify-conventions.datagates.json en mag alleen omlaag.
// AST-scan: commentaar en gewone strings geven geen vals alarm. `--root <pad>` voor de fixtures van
// tests/planning/check-conventions-boundary.ts; `--write-baseline` herpint, alleen als er niets rood is.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const rootFlag = args.indexOf('--root');
if (rootFlag >= 0 && !args[rootFlag + 1]) {
  console.error('Gebruik: node scripts/verify-conventions.mjs [--root <repositorypad>] [--write-baseline]');
  process.exit(2);
}
const root = resolve(rootFlag >= 0 ? args[rootFlag + 1] : resolve(here, '..'));
const writeBaseline = args.includes('--write-baseline');
const baselinePath = join(root, 'scripts', 'verify-conventions.datagates.json');

const FORBIDDEN_NAMES = new Set(['p6Source', 'importFormat', 'readFormat']);
const FORBIDDEN_SERVICE_DIRS = new Set(['xer', 'mpp', 'msproject', 'p6', 'csv']);
const DATAGATES = [
  'p6ProjectId', 'p6TaskId', 'p6ActivityType', 'p6ExplicitTargetWindow', 'p6CompletePctType', 'p6DurationType',
  'p6SuspendResume', 'p6ExpectedFinish', 'manuallyScheduled', 'levelingDelayMinutes', 'timephasedStartAnchor',
  'timephasedFinishFloor', 'timephasedDurationWalks', 'resume', 'mspTaskType',
];

const slash = (value) => value.split(sep).join('/');
const own = (file) => slash(relative(root, file));

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  const found = [];
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const target = join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (/\.(?:ts|tsx|mts)$/.test(entry.name)) found.push(target);
    }
  }
  return found.sort();
}

function forbiddenModule(file, specifier) {
  let target;
  if (specifier.startsWith('@/')) target = resolve(root, 'src', specifier.slice(2));
  else if (specifier.startsWith('.')) target = resolve(dirname(file), specifier);
  else return null;
  const rel = slash(relative(resolve(root, 'src', 'services'), target));
  if (rel.startsWith('..')) return null;
  const [first, ...rest] = rel.split('/');
  const name = first.replace(/\.(?:ts|tsx|mts|js|mjs)$/, '');
  if (FORBIDDEN_SERVICE_DIRS.has(name) && rest.length > 0) return `src/services/${name}`;
  if (name === 'formatRegistry') return 'src/services/formatRegistry';
  return null;
}

const violations = [];
const counts = Object.fromEntries(DATAGATES.map((gate) => [gate, 0]));
const files = sourceFiles(resolve(root, 'src', 'engine'));
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const report = (node, message) => violations.push(
    `${own(file)}:${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1} — ${message}`);
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const hit = forbiddenModule(file, node.moduleSpecifier.text);
      if (hit) report(node, `import uit ${hit} (lezer/formaat) in de motor`);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
      const hit = forbiddenModule(file, node.arguments[0].text);
      if (hit) report(node, `dynamische import uit ${hit} in de motor`);
    }
    if (ts.isIdentifier(node) && FORBIDDEN_NAMES.has(node.text)) {
      report(node, `'${node.text}' in de motor (regel B: een per-profiel-verschil is een conventie in het register)`);
    }
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
      const name = node.argumentExpression.text;
      if (FORBIDDEN_NAMES.has(name)) report(node, `'${name}' via string-index in de motor`);
      if (Object.hasOwn(counts, name)) counts[name]++;
    }
    if (ts.isPropertyAccessExpression(node) && Object.hasOwn(counts, node.name.text)) counts[node.name.text]++;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

let baseline = null;
if (existsSync(baselinePath)) {
  try {
    baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  } catch {
    violations.push(`${own(baselinePath)} — geen geldige JSON`);
  }
} else if (!writeBaseline) {
  violations.push(`${own(baselinePath)} ontbreekt — meet eenmalig met --write-baseline`);
}
const toRepin = [];
if (baseline && typeof baseline === 'object') {
  for (const gate of DATAGATES) {
    const pinned = Number.isInteger(baseline[gate]) ? baseline[gate] : 0;
    if (counts[gate] > pinned) {
      violations.push(`datagate '${gate}': ${counts[gate]} lezingen in src/engine, gepind ${pinned} — een nieuwe `
        + 'herkomstlezing in de motor (maak er een conventie van, of meet en bespreek eerst)');
    } else if (counts[gate] < pinned) {
      toRepin.push(`${gate} ${pinned}→${counts[gate]}`);
    }
  }
}

if (writeBaseline) {
  if (violations.length > 0) {
    console.error('XX baseline NIET herschreven — er is iets rood:');
    for (const violation of violations) console.error(`  - ${violation}`);
    process.exit(1);
  }
  writeFileSync(baselinePath, `${JSON.stringify(counts, null, 2)}\n`);
  console.log(`OK — datagate-telling gepind in ${own(baselinePath)}.`);
  process.exit(0);
}

if (violations.length === 0) {
  console.log(`OK — conventiegrens bewaakt in ${files.length} motorbestanden; datagates: `
    + DATAGATES.map((gate) => `${gate}=${counts[gate]}`).join(', '));
  if (toRepin.length > 0) console.log(`  te herpinnen (omlaag): ${toRepin.join(', ')} — draai met --write-baseline`);
  process.exit(0);
}
console.error(`XX ${violations.length} overtreding${violations.length === 1 ? '' : 'en'} van de conventiegrens:`);
for (const violation of violations) console.error(`  - ${violation}`);
process.exit(1);
```

  `scripts/verify-conventions.datagates.json`: **ratchet-pin, gemeten stand** (H2-uitzondering) — maak
  hem met `node scripts/verify-conventions.mjs --write-baseline` op de kop ná de merge van C (engine
  zonder `p6Source`) en commit het resultaat ongewijzigd. `package.json`: script
  `"verify:conventions": "node scripts/verify-conventions.mjs"` en in `verify` ná
  `npm run verify:store-boundaries` de schakel `&& npm run verify:conventions`. `scripts/README.md`: één
  regel onder de verify-poorten ("`verify-conventions.mjs` — AST-poort: de motor leest geen bronformaat;
  herkomst-datagates gepind in `verify-conventions.datagates.json`, alleen omlaag. Aangeroepen door
  `npm run verify:conventions` en `check-conventions-boundary.ts`.").
- [ ] **Step 4:** `bash tests/planning/run.sh check-conventions-boundary.ts` ⇒ exit 0; `npm run verify:conventions`
  ⇒ exit 0. Mutant: zet in `src/engine/scheduler/scheduleAnalysis.ts` tijdelijk
  `void (so as { p6Source?: string } | undefined)?.p6Source;` ⇒ `verify:conventions` rood ⇒ herstel.
- [ ] **Step 5:** commit `feat(rekenprofielen): verify:conventions — motor zonder bronformaat, datagates alleen omlaag`.
- Hardening: H1 de scan loopt over bronbestanden van de repo, niet over invoer; H3 fixtures + mutant; H5
  de enige `catch` (corrupte pin) heeft fixture 09.

---

## I — Integratie

### Task I1: Banen samenvoegen

- [ ] `git status --short` (schoon); `git merge --no-ff claude/rekenprofielen-baan-c`; daarna
  `git merge --no-ff claude/rekenprofielen-baan-d` (D bevat C al; er horen geen conflicten te zijn — is
  er toch één, dan hebben de bestandskaarten van §2 een gat: los het op en noteer het in het mergebericht).
- [ ] `npm run typecheck` ⇒ exit 0.

### Task I2: Markeringssweep en `p6Source`-inventaris (alle vier moeten leeg zijn)

```bash
git grep -n "STUB(rekenprofielen)\|INTEGRATIE(rekenprofielen)\|C5-GEDRAGSWIJZIGING\|legacyP6SourceTranslation\|resolveLegacyP6SourceConventions" -- src tests scripts
git grep -n "TIJDELIJK" -- src/types src/engine src/services/ifc src/state
git grep -n "p6Source" -- src ':!src/types/calendar.ts' ':!src/services/xer/xerCalendarData.ts' \
  | grep -v "calendar\.p6Source\|cal\.p6Source\|LegacySchedulingOptions\|ExtCalendar\|p6Source: c\.p6Source"
grep -rn "p6Source" tests --include=*.ts \
  | grep -v "calendar\.p6Source\|Calendar\b.*p6Source\|p6Source: KEEP\|P6Source\b\|R8(rekenprofielen)" \
  | grep -v "^tests/planning/check-calendar-mirror.ts\|^tests/planning/check-scheduling-profile-roundtrip.ts\|^tests/planning/legacySolveOptions.ts\|^tests/planning/check-conventions-registry.ts"
```

  Elke overgebleven regel is ofwel legitiem (legacy-migratie in `schedulingOptionsRead.ts`/`registry.ts`,
  kalenderdiagnose) — dan de filter uitbreiden **met motivatie in het commitbericht** — ofwel een gat:
  terug naar de baan die het bestand bezit.

### Task I3: Poorten (één tegelijk, machinebreed)

- [ ] `npm run verify > /tmp/i3-verify.log 2>&1; echo "exit $?"` ⇒ exit 0 (incl. `verify:i18n`,
  `verify:docs`, `verify:conventions`, `verify:store-boundaries`, `verify:cycles`, `verify:text-roles`, de
  vijf suites met de browsersuite).
- [ ] `OPS_XER_CORPUS="/home/nozzit/open-aec/voor claude/testdata-crawl" npm run measure:profiles` ⇒
  X12 exact **15.056** (de bekende nuldoel-toestand: rood op precies de drie nuldoelregels, cel-poort
  groen — telt volgens de overdracht als geslaagd; geen exacte cel inexact, `drivingPath`-as incluis);
  `.mpp` "GOAL_ZERO_DEVIATIONS groen, 216 pins ongewijzigd (0 verbeterd / 0 verslechterd)";
  `check-xer-corpusless-fidelity-gate` groen. Alle getallen in de PR-tekst.

### Task I4: Critreview op de hele diff

- [ ] Roep de skill `critreview` aan (Opus 5.5, geen Fable, geen Opus 5) op
  `git diff <kop van claude/file-formats-support-phase-3-a0ebe2>...claude/rekenprofielen`, met als
  aandachtspunten: byte-identiteit van OPS-bestanden, migratie per veld, de verplichte solverinvoer,
  de melding (één per bestand), het bewerkmodel (overrides letterlijk bij een wissel, kopie bij
  wijziging), `thresholdHours`, i18n in 14 talen, en de benoemde gaten. [BEVESTIGD]/[VERMOED]-labels
  intact laten; must-fixes verwerken in de bestanden van de baan die ze bezit; daarna I3 opnieuw.

### Task I5: Gebruikstest in de browser met de gids als meetlat

- [ ] `npm run dev` (poort uit de uitvoer). Loop `public/docs/nl/gids-rekenprofielen.md` sectie voor
  sectie na met echte bestanden: een `.xer` uit het corpus (melding + actie + P6), een `.mpp` (MS Project),
  een MSPDI-export (OPS), een CSV (OPS), een eigen IFC met P6-profiel (géén melding bij heropenen);
  wissel P6 → MS Project → P6 (telling, "(aangepast)" bij A19, zelfde datums terug); conventie wijzigen
  (kopie, hernoemen, opslaan als sjabloon, afwijkingsblok, bijwerken in beide richtingen); standaardopties
  toepassen; undo van een wissel; export naar CSV van een XER-project (verliesmelding). Elke bewering die
  niet klopt: óf de code óf de gids aanpassen (in de baan die het bestand bezit). Screenshots in `qa/`
  (niet committen).

### Task I6: Aanbieden

- [ ] Push `claude/rekenprofielen`. PR-tekst (Nederlands, begint met 2–4 zinnen mensentaal): wat de
  gebruiker ziet, de poortgetallen uit I3, de benoemde gedragswijziging uit C5 (releasenotitie), en de
  benoemde gaten: (1) export-guard dekt alleen documenten met XER-herkomst (`.mpp` → MSPDI meldt het
  profielverlies niet); (2) MSPDI en P6-XML openen als OPS (C10 wacht op een eigenaarsbesluit);
  (3) `sanitizeSchedulingProfile` zet een ongeldig getypeerde conventiewaarde op de basiswaarde, de spec
  zegt `legacyValue` (voor alle huidige conventies alleen verschillend onder p6/msproject). Niet mergen:
  de eigenaar beslist over stapelen op #109. Daarna start het X12-werk "naar nul" met
  `docs/superpowers/plans/2026-09-22-goalprompt-x12-naar-nul.md`.

---

## Self-review (architect, 2026-09-22)

**Spec-dekking (v3.1).** §3.1 register/typen ⇒ baan A + M1.2; §3.2 profiel, `effectiveSchedulingOptions`,
`solveInputFor`, sjablonen ⇒ A, C1, C5, D2–D4; §3.3 IFC ⇒ A + C2; §3.4 migratie ⇒ A + M1.3 + C2 (vijandige
en gedeeltelijke blobs); §4 motor + `verify:conventions` ⇒ B + C3 + D10; §5 cel-baseline/`measure:profiles`
⇒ bestaande poort, gebruikt in M1.4/I3; goal prompt ⇒ bestaat (D9 vervallen); §6 openen/melding/actie ⇒
C3 + C6; kiezen/bewerken/wisselen/`thresholdHours`/'auto' ⇒ D2–D5; docs ⇒ D7 + D8; i18n ⇒ D1; §7
export-guard ⇒ C7, extensie-API ⇒ C8, MCP ⇒ C9, testmigratie ⇒ C1 + C4; §8 tests ⇒ per taak; §9 MSPDI ⇒
C10 (geblokkeerd); §10 volgorde ⇒ §2 (met de gemotiveerde verschuiving naar baan C).

**Bewuste afwijkingen van de spec** (alle in de PR-tekst): IFC-optieomzetting, verwijderen van de
tijdelijke vertaling en de testmigratie in baan C in plaats van de integratie (§2); `switchProfile` in
M1.2 naar spec §3.2 gebracht (baan A volgde de oudere regel); sjablonen buiten de store (zo gebouwd in
baan A); de `.mpp`→MSPDI-kant van de export-guard blijft een benoemd gat (C7).

**Placeholder-scan.** Geen TBD/TODO in taken. Bewuste open plekken, telkens met een concrete opdracht:
de twaalf niet-nl/en-vertalingen (D1, regels gegeven), de Engelse gidstekst (D7, koppen gegeven),
signaturen van `writeCSV`/`writeMSPDI`/`writeP6XML` verifiëren (C3), de toegankelijke rol van twee
Backstage-knoppen (D6), en de ratchet-pin van D10 (gemeten, per definitie).

**Typeconsistentie.** Alle snippets gebruiken de namen van §1 (gebouwde code van A/B, nieuwe namen van
C/D). Bij afwijking van de fixronde-code: M1.1 step 2 (contractprobe) vangt het vóór C/D starten.
