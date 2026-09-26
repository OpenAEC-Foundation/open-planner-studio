# `docs/superpowers/`

Ontwerp- en implementatiedocumenten: waaróm iets gebouwd is zoals het gebouwd is. Deze map had geen
overzicht en geen regel, waardoor niet te zien was wat er nog liep en wat allang opgeleverd was
(K-item 40).

## Onderhoudbaarheidsprogramma (2026-08-24) — uitgevoerd

Het onderhoudbaarheidsprogramma van 2026-08-24 is **uitgevoerd** (nagekeken 2026-09-26 tegen de code).
Per plan het spoor dat alleen bestaat als het werk gedaan is: Plan 0 (bewijspoorten) —
`scripts/browser-test-server.mjs`, `scripts/run-browser-tests.mjs`, `src/utils/ganttTestDriver.ts`,
`tests/browser/hook-synchronization.spec.ts`; Plan 1 (extensiecontract) — `src/extensions/validation.ts`,
`tests/planning/check-ext-contract.ts`/`check-ext-integrity.ts`/`check-ext-consent.ts`; Plan 2
(store-runtime-isolatie) — `src/state/runtime/storeRuntime.ts`, `createBatchTransactions.ts`,
`createMcpTransactions.ts`, `scripts/verify-store-boundaries.mjs`, `tests/planning/check-store-factory.ts`;
Plan 3 (Gantt-grenzen) — `useGanttPointerCoordinator.ts`, `useGanttRendererHost.ts`,
`useGanttViewportCoordinator.ts`, `ganttRenderOptions.ts`, `scripts/verify-gantt-boundaries.mjs`
(commits `de12b386`…`1819a92f`). Twee doelen uit Plan 0/3 bestaan niet meer omdat de code daarna
verdween: `TableEditor.tsx` en `useRowDrag.ts` zijn met de tabel-overhaul vervangen door
`FullTaskGrid`/`useTableRowDrag` (de TableEditor-freeze uit Plan 3 taak 8 is daarmee vervallen).
De afvinkvakjes in de plannen zijn, zoals overal hier, niet bijgehouden. Oorspronkelijke leesvolgorde
(historisch; de sprong naar alleen taak 1 van Plan 2 was een bewuste contextvoorwaarde voor Plan 1):

1. [`specs/2026-08-24-onderhoudbaarheidsprogramma-design.md`](specs/2026-08-24-onderhoudbaarheidsprogramma-design.md)
2. [`plans/2026-08-24-onderhoudbaarheid-0-bewijspoorten.md`](plans/2026-08-24-onderhoudbaarheid-0-bewijspoorten.md)
3. Plan 2, alleen taak 1:
   [`plans/2026-08-24-onderhoudbaarheid-2-store-runtime-isolatie.md`](plans/2026-08-24-onderhoudbaarheid-2-store-runtime-isolatie.md)
4. [`plans/2026-08-24-onderhoudbaarheid-1-extensiecontract.md`](plans/2026-08-24-onderhoudbaarheid-1-extensiecontract.md)
5. Plan 2, taken 2 en verder.
6. [`plans/2026-08-24-onderhoudbaarheid-3-gantt-grenzen.md`](plans/2026-08-24-onderhoudbaarheid-3-gantt-grenzen.md)

De visuele nulmeting staat in
[`docs/onderhoudbaarheid/audit-2026-08-24.html`](../onderhoudbaarheid/audit-2026-08-24.html).

## De regel

| waar | wat |
|---|---|
| `docs/superpowers/` | het ontwerp waar nu aan gewerkt wordt, of dat als naslag bij de code hoort |
| `docs/archive/superpowers/` | opgeleverd én niet meer aangehaald |
| `docs/archive/handoffs/` | verbruikte sessie-draaiboeken |

**Een document verhuist pas als óók zijn verwijzingen meeverhuizen.** Dat is geen slag om de arm maar
de reden dat er nu niet meer verplaatst is dan hieronder staat — zie *Wat er gemeten is*.

## Wat er gemeten is (2026-08-17)

Drie dingen nagekeken, want het rapport ging uit van "het overgrote deel is opgeleverd" en dat klopt,
maar de conclusie "dus verplaatsen" niet zomaar:

1. **De toenmalige 44 documenten in `specs/` en `plans/` beschreven functionaliteit die aantoonbaar
   in de code zat.** Per document is een distinctief spoor gecontroleerd (een bestand of een symbool
   dat alleen bestaat als de functie er is): 44 van de 44. Dit was de stand op 2026-08-17; het
   onderhoudbaarheidsprogramma hierboven is later toegevoegd en viel toen niet onder die conclusie
   (inmiddels wel uitgevoerd).
2. **De afvinkvakjes in de plannen zijn waardeloos als signaal.** Alle negen plannen hebben nul
   afgevinkte en tientallen open vakjes, terwijl de functies wél bestaan. Ze zijn nooit bijgehouden.
   Gebruik ze niet om te bepalen wat af is; de code is het bewijs.
3. **Ongeveer vijftig plekken in `src/`, `tests/` en `docs/` verwijzen naar bestanden hier**, met een
   pad in een commentaarregel — `src/types/task.ts` naar het constraints-ontwerp,
   `src/services/mcp/contracts.ts` naar het MCP-ontwerp ("normatief"), `src/engine/renderer/timeAxis.ts`
   naar het werkdagen-as-ontwerp, en zo verder. Die verwijzingen zijn de reden dat de documenten
   waarde houden: ze verbinden een regel code aan de afweging erachter.

Een blinde verhuizing van alle 44 zou dus vijftig pointers in code en tests breken. Dat is een
grotere ingreep dan het item vermoedt, en hij levert pas iets op als de referenties in dezelfde beweging
meegaan. Verplaats daarom per document, samen met zijn verwijzingen — niet per map.

Wél verplaatst, omdat ze nergens meer bij horen:

- `HANDOFF-2026-07-20-poorten-ongedraaid.md` → `docs/archive/handoffs/`. Opent met *"AFGEWERKT — dit
  draaiboek is verbruikt; alleen nog van historisch belang."* Dat is niet voor tweeërlei uitleg vatbaar.
- `docs/HANDOFF-mcp-bibliotheek-snap.md` → `docs/archive/handoffs/`. Sessie-draaiboek waarvan de kop
  zelf zegt dat alles op `main` staat.

## Wat er staat

**Losse documenten (map-niveau)**

| document | status |
|---|---|
| `HANDOFF-2026-08-14-roadmap.md` | **verouderd (stand 2026-08-14)** — roadmapoverzicht met peildatum `3cec89b`; sindsdien zijn o.a. B1b, XER, rekenprofielen, taaktypes en splitsen geland. Voor openstaand werk: `docs/TODO.md` |
| `specs/2026-09-04-spec-taaktypes-opgeslagen-werk.md` | **opgeleverd (gemerged via PR #170, 2026-09-26; overname van PR #101)** — taaktypes/werkregels, opgeslagen werk per toewijzing en effort-driven bewerken; opvolger van `specs/2026-08-18-spec-taaktypes-effort-driven.md`. Bevat de MSP/P6-documentatievergelijking, de regeltabel, de meetlat (31 bewerkingen), alle eigenaarsbesluiten (1–10) en per stap de status en de verwerkte reviewbevindingen (§10). Code: `src/engine/work/` (kern, brug, zichtbaarheid), bedrading in de slices/het raster/de MCP-tweeling, UI in `TaskWorkRuleField`/`TaskAssignmentsSection`, gids `gids-taaktypes`. Open punten staan in `docs/TODO.md`. |
| `werkdagen-as-ontwerp.md` | naslag; aangehaald vanuit `timeAxis.ts`, `workdayAxis.ts` en `check-workday-axis.ts` |
| `verticale-drag-ontwerp.md`, `verticale-drag-ontwerp-B.md` | naslag — twee varianten van hetzelfde ontwerp. Rij-slepen bestaat; verticaal slepen aan de balk is hersteld in `70e6596c` (PR #143) in een andere vorm dan ontworpen: `useBarDrag.onVerticalBodyDrag` draagt de sleep over aan de rijsleep van de DOM-taakgrid (`ganttRowDragBridge.ts`). Restpunten in `docs/TODO.md` |
| `modulariteit-audit.md`, `prestatie-modulariteit-audit.md` | de audits waar de P-bevindingen uit komen; aangehaald vanuit testkoppen |
| `lagen-en-federatie-conceptplan.md` | conceptplan, niet uitgevoerd |
| `workflows/triple-verify.js` | hulpscript, aangehaald vanuit `docs/TODO.md` |

**`specs/` en `plans/`** — per feature het ontwerp respectievelijk het uitvoerplan. De bestandsnaam
begint met de datum, dus chronologisch bladeren werkt. Documenten van vóór het actieve programma
zijn vooral naslag; ook de vijf programmabestanden hierboven zijn inmiddels uitgevoerd. **Bij twijfel wint de
actuele code, behalve wanneer een nog uit te voeren plan juist expliciet een gewenste grens
definieert.**

## Overzicht per stuk (peildatum 2026-09-14, bijgewerkt 2026-09-24)

Volgorde: eerst de levende stukken (specs, plannen, los), daarna de verhuisde stukken.

| stuk | stand | verwijzingen |
|---|---|---|
| `specs/2026-06-05-multi-worktree-dev-isolation-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-06-26-planning-correctheid-testplan-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-06-26-snap-packaging-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-02-constraints-deadlines-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-02-mijlpalen-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-02-volledige-dependencies-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-07-02-wbs-structuur-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-03-resources-design.md` | naslag (opgeleverd) | 5 |
| `specs/2026-07-04-baselines-voortgang-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-04-kalenders-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-04-weergaven-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-07-06-2.8b-research-codebase.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-06-2.8b-research-domein.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-06-2.9-research-codebase.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-06-2.9-research-domein.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-06-geavanceerde-cpm-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-06-uren-scheduling-design.md` | naslag (opgeleverd) | 3 |
| `specs/2026-07-07-2.10-onderdeel4-showcases-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-07-07-2.10-onderdeel5-docs-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-07-13-bouwmodus-toggle-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-20-move-project-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-07-22-vector-pdf-export-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-23-b1-1-bedrijfscentrisch-model-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-07-23-dev-server-dual-guard-prevention-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-24-github-wiki-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-07-24-mcp-bridge-design.md` | naslag (opgeleverd) | 2 |
| `specs/2026-08-14-b1b-bezettingsoverzicht-design.md` | naslag (opgeleverd) | 5 |
| `specs/2026-08-14-mijlpaal-relaties-design.md` | naslag (opgeleverd) | 1 |
| `specs/2026-08-14-rapport-code-inventaris.md` | naslag (opgeleverd) | 1 |
| `specs/2026-08-14-rapport-critreview-f0.md` | invoer voor lopend XER-werk (etappe 2) | 0 |
| `specs/2026-08-14-rapport-export-opties-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-08-14-rapport-formaat-specs.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-08-14-task-type-inheritance-parent-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-08-17-b1c-nivelleren-restcapaciteit-design.md` | deels uitgevoerd (kern `distribute.ts` en schrijfpad `applyDistribution` op `main` via `ee882777`; de verdeeldialoog niet — die staat ongemerged op `origin/t3code/b1c-etappe3`) | 2 |
| `specs/2026-08-17-datums-zoals-opgeslagen-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-08-18-issue-65-dependency-jump-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-08-18-spec-taaktypes-effort-driven.md` | naslag (opgeleverd) | 1 |
| `specs/2026-08-24-hooksite-ledger.md` | naslag (opgeleverd) | 1 |
| `specs/2026-08-24-onderhoudbaarheidsprogramma-design.md` | naslag (opgeleverd, zie boven) | 4 |
| `specs/2026-08-24-tabel-overhaul-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-06-24-auto-update-cross-platform.md` | naslag (opgeleverd) | 3 |
| `plans/2026-07-13-browser-bestandstoegang.md` | naslag (opgeleverd) | 2 |
| `plans/2026-07-23-b1-1-bedrijfscentrisch-model.md` | naslag (opgeleverd) | 1 |
| `plans/2026-08-14-f0-brief-definitief.md` | verhuisd naar archief (2026-09-15) | 0 |
| `plans/2026-08-15-plan-mpp-datumgetrouwheid.md` | naslag (opgeleverd) | 3 |
| `plans/2026-08-17-plan-mpp-nul-afwijkingen.md` | naslag (opgeleverd) | 2 |
| `plans/2026-08-24-onderhoudbaarheid-0-bewijspoorten.md` | naslag (opgeleverd, zie boven) | 0 |
| `plans/2026-08-24-onderhoudbaarheid-1-extensiecontract.md` | naslag (opgeleverd, zie boven) | 0 |
| `plans/2026-08-24-onderhoudbaarheid-2-store-runtime-isolatie.md` | naslag (opgeleverd, zie boven) | 0 |
| `plans/2026-08-24-onderhoudbaarheid-3-gantt-grenzen.md` | naslag (opgeleverd, zie boven) | 0 |
| `plans/2026-09-01-plan-issue27-voortgangsimport.md` | verhuisd naar archief (2026-09-14) | 0 |
| `HANDOFF-2026-08-14-roadmap.md` | verouderd (stand 2026-08-14) | 0 |
| `lagen-en-federatie-conceptplan.md` | concept, niet uitgevoerd | 1 |
| `modulariteit-audit.md` | naslag (opgeleverd) | 8 |
| `prestatie-modulariteit-audit.md` | naslag (opgeleverd) | 5 |
| `verticale-drag-ontwerp-B.md` | naslag (opgeleverd in afwijkende vorm: balksleep via de rijsleep van de taakgrid, `70e6596c`) | 0 |
| `verticale-drag-ontwerp.md` | naslag (opgeleverd in afwijkende vorm: balksleep via de rijsleep van de taakgrid, `70e6596c`) | 0 |
| `werkdagen-as-ontwerp.md` | naslag (opgeleverd) | 8 |
| `specs/2026-06-19-ui-modern-overhaul-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-07-07-2.10-onderdeel2-ux-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-07-07-2.10-onderdeel3-firststartup-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-07-07-2.10-sneltoetsen-contextmenu-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-07-13-browser-bestandstoegang-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-07-23-just-updated-dialog-design.md` | verhuisd naar archief (2026-09-14) | 0 |
| `specs/2026-08-14-bestandsformaten-ontwerpskelet.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-06-12-store-slices-en-extensies.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-07-23-dev-server-dual-guard-prevention.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-07-23-just-updated-dialog.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-07-24-mcp-bridge-fase1.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-14-mijlpaal-relaties.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-14-mpp-import-etappe-1.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-14-rapport-export-opties.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-14-task-type-inheritance-parent.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-17-datums-zoals-opgeslagen.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-18-issue-65-dependency-jump.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-24-gedeelde-categoriekleuren.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-24-tabel-overhaul-implementation-plan.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-27-b1c-w0-split-bewuste-fundamenten.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-08-31-b1c-plan2-verdeler-kern.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/2026-09-11-plan-issue27-xlsx-voortgangsblad.md` | verhuisd naar archief (2026-09-14) | 0 |
| `plans/archief-2026-08-14-f0-brief-concept.md` | verhuisd naar archief (2026-09-14) | 0 |

**Na de peildatum toegevoegd: XER-lezer, rekenprofielen en X12 naar nul (bijgewerkt 2026-09-23).**
Verwijzingen hier = aantal bestanden in `src/`, `tests/`, `docs/`, `public/` en `scripts/` dat de
bestandsnaam noemt (zelfde uitsluitingen als hierboven).

| stuk | stand | verwijzingen |
|---|---|---|
| `plans/2026-08-20-plan-xer-p6-lezer.md` | actief — het XER-etappeplan; §4.1 veldwhitelist, §9 dossiers, §10 overdrachtsstand | 2 |
| `specs/2026-09-22-rekenprofielen-design.md` | naslag (opgeleverd; groep C daarna bijgeschreven) — het register is de bron | 8 |
| `plans/2026-09-22-plan-rekenprofielen.md` | naslag (opgeleverd) | 2 |
| `plans/2026-09-22-rekenprofielen-overdracht.md` | actief — eigenaarsbesluiten en de lopende stand van het programma | 1 |
| `plans/2026-09-22-goalprompt-x12-naar-nul.md` | actief — regel A/B en de opdrachttekst voor elk X12-brok | 4 |
| `plans/2026-09-23-x12-restant-classificatie.md` | actief — brokkentelling per populatie (kop "Populatie na 24-09" is de actuele) | 5 |
| `plans/2026-09-23-x12-c1-c4-toets-buiten-rehab2.md` | naslag — meetonderzoek achter C1/C4 uit | 5 |
| `plans/2026-09-23-x12-b01-onderzoek.md` | naslag — meetonderzoek (rehab-2 = P3-uitvoer) | 2 |
| `plans/2026-09-24-x12-harbourpointe-kalender.md` | invoer voor lopend X12-werk | 1 |
| `plans/2026-09-24-x12-hotel-ff-60min.md` | X12-dossier (Hotel FF-60-minuten, ALAP-eindmijlpaal) — uitgesloten per eigenaarsbesluit 23-09 | 0 |
| `plans/2026-09-24-x12-sample-sf-lag0.md` | X12-dossier (Sample SF-lag-0-minuut, n=1 zonder bron) — restant | 0 |
| `plans/2026-09-24-gebruikstest-rekenprofielen-26.md` | gebruikstest van het profielblok; bevindingen B1–B5 alle gefixt (B1 invoercoherentie, B2/B5 vertrekbewaking en meldingen, B3 thema-indeling, B4 heropen-melding) | 0 |
| `plans/2026-09-24-ui-conventies-groepen-voorstel.md` | UI-voorstel conventies per thema — gemerged 24-09 (eigenaar "mergen") | 0 |
| `plans/2026-09-24-nivellering-etappe-onderzoek.md` | onderzoek P6-nivellering; fundament (data) gemerged, motoretappe wacht op vijf eigenaarsbesluiten (§8) | 0 |
| `plans/2026-09-24-pr169-body-voorstel.md` | voorstel PR-body #169 — overgenomen 24-09, daarna bijgewerkt op GitHub | 0 |
| `plans/2026-09-24-eindreview-fable-pr169.md` | eindreview van de orkestrator (Fable) op #169 in drie delen — GO met B1 inbegrepen | 0 |
| `plans/2026-09-24-fable-critreview-pr109.md` | onafhankelijke Fable-critreview #109 — LANDEN-MET-FIXES; fixes op `claude/xer-etappe3-fixes` | 0 |
| `plans/2026-09-24-fable-critreview-pr167.md` | onafhankelijke Fable-critreview #167 — LANDEN-MET-FIXES; fixes op `claude/recorded-all-formats-fixes` | 0 |
| `plans/2026-09-24-fable-critreview-pr169.md` | onafhankelijke Fable-critreview #169 — LANDEN-MET-FIXES; eigenaarsvragen A19-basis en C5 open | 0 |
| `plans/2026-09-24-verkenning-pr101-taaktypes.md` | naslag — verkenningsdossier voor de overname van PR #101 (taaktypes/werkregels): banen, 29 conflicten, regel-A-risico's, eigenaarsvragen E1–E5; de overname is als PR #170 gemerged (2026-09-26) | 0 |
| `plans/2026-09-24-x12-restant-onderzoek-284.md` | invoer voor lopend X12-werk (o.a. DCP-03 Baseline = generatoruitvoer) | 3 |
| `plans/patches/` | geparkeerde, niet gelande motorpatches (B15, zie plan XER §9) | — |

**Nog niet in dit overzicht opgenomen stukken (toegevoegd 2026-09-26).** Stand bepaald uit code en
git, niet uit het document zelf. Verwijzingen hier gemeten op 2026-09-26 (zelfde telwijze; `docs/TODO.md`
telt mee).

| stuk | stand | verwijzingen |
|---|---|---|
| `specs/2026-07-07-2.10-sneltoetsen-inventory.json` | naslag (opgeleverd) — inventaris uit fase 2.10; het register is `src/hooks/keyboard/shortcutRegistry.ts` | 1 |
| `plans/2026-08-31-b1c-plan3-schrijfpad-paneel.md` | deels uitgevoerd — schrijfpad (`applyDistribution`/`undoDistribution`, scratch-instantie) op `main` via `ee882777`; de verdeeldialoog (taken 8 e.v.) alleen op de ongemergde branch `origin/t3code/b1c-etappe3` | 3 |
| `specs/2026-09-12-b1c-verdeeldialoog-herontwerp-design.md` | niet op `main` — gebouwd op `origin/t3code/b1c-etappe3` (o.a. `3efe4e59`), niet gemerged; op `main` bestaat geen `DistributionDialog` | 2 |
| `plans/2026-09-12-b1c-plan4-verdeeldialoog-herontwerp.md` | niet op `main` — idem, uitgevoerd op `origin/t3code/b1c-etappe3` | 1 |
| `specs/2026-09-19-layouts-als-weergavepresets-design.md` | naslag (opgeleverd, issue #144: layoutknoppen, `src/components/viewControls/builtinLayouts.ts`); deel B (werkdagen in de bandkop) bewust niet gebouwd, zoals het stuk zelf zegt | 1 |
| `specs/2026-09-19-taken-splitsen-bewerken-design.md` | naslag (opgeleverd, issue #146: splits-modus, stukken slepen, sectie Onderbrekingen, `planner_set_task_splits`, gids `gids-taken-splitsen`) | 5 |
| `plans/2026-09-21-taken-splitsen-etappe1-kern.md` | naslag (opgeleverd) — `src/state/splitMutations.ts` | 0 |
| `plans/2026-09-21-taken-splitsen-etappe2-splitsmodus.md` | naslag (opgeleverd) — `useSplitGesture.ts`, `SplitModeNotice.tsx` | 1 |
| `plans/2026-09-22-taken-splitsen-etappe3-slepen.md` | naslag (opgeleverd) — stukken slepen in `useBarDrag.ts`/`getTaskBarBounds` | 0 |
| `plans/2026-09-22-taken-splitsen-etappe4-paneel.md` | naslag (opgeleverd) — sectie Onderbrekingen in `TaskPropertiesPanel.tsx` | 0 |
| `plans/2026-09-22-taken-splitsen-etappe5-afronding.md` | naslag (opgeleverd) — `planner_set_task_splits`, `exportSplitsLostNotice` | 0 |
| `plans/2026-09-24-taaktypes-integratie-baan1.md` | naslag — integratieverslag van #101 op de rekenprofielen-kop; gemerged als PR #170 (2026-09-26) | 1 |
| `plans/2026-09-24-e2-p6xml-durationtype.md` | naslag — afgesloten onderzoek (E2): de `<DurationType>`-mapping in `p6xmlReader.ts` klopt, geen fix nodig | 1 |
| `plans/2026-09-24-gebruikstest-taaktypes-170.md` | naslag — gebruikstest #170; de bevindingen zijn in de UI-fixronde van 25-09 verwerkt en met #170 gemerged | 0 |
| `plans/2026-09-24-fable-critreview-pr170.md` | naslag — Fable-critreview #170, LANDEN-MET-FIXES; #170 is daarna gemerged | 0 |
| `evidence/` | naslag/bewijs van de tabel-overhaul (baseline, eindmeting, benchmarks, Tauri-refresh-IFC's); aangehaald door `tests/planning/check-tauri-refresh-evidence.ts`, `check-relations-panel-parity.ts`, `taskGridPerformanceHarness.ts` en `run.sh` — dus niet verplaatsen zonder die mee te nemen | 5 |

Betekenis van de standen: **actief** = er wordt nu aan gewerkt of het is het geldende programma;
**naslag** = het werk is gedaan, het stuk blijft als uitleg bij de code;
**deels uitgevoerd** = een deel van het ontwerp bestaat, een deel niet (welk deel staat erbij);
**invoer voor lopend werk** = het stuk zelf is geen actief werk, maar voedt een nog lopende etappe;
**concept** = idee dat niet is uitgevoerd;
**verouderd** = een momentopname (peildatum erbij) die niet meer klopt en niet wordt bijgewerkt;
**niet op `main`** = uitgevoerd op een branch die (nog) niet gemerged is;
**verhuisd naar archief** = op de genoemde datum verplaatst naar
`docs/archive/superpowers/`, omdat het werk erop afgerond was én er nergens meer naar
verwezen werd. Als regel gaat een stuk naar het archief zodra het werk erop afgerond is en
de laatste verwijzing ernaartoe verdwenen is; wat nog loopt of nog aangehaald wordt, blijft staan.
De verwijzingentelling is gemeten op de peildatum over `src/`, `tests/`, `docs/`, `public/` en
`scripts/`, per letterlijke bestandsnaam; het archief en deze tabel zelf zijn buiten de telling
gelaten.

**De vakjes in de werkplannen worden niet bijgehouden.** Vrijwel alle plannen tonen nul
afgevinkte vakjes terwijl het werk wel gedaan is. Leid de voortgang af uit de code en uit de
stand in de tabel hierboven, niet uit de vakjes.

## Verwante mappen

- `docs/onderhoudbaarheid/` — het onderhoudbaarheidsonderzoek en de K-items. Dat is een rapport met
  een peildatum: bevindingen daarin worden niet herschreven als de code verandert.
- `docs/superpowers/prototypes/` — bewaarde speelbare HTML-prototypes uit ontwerpfasen (o.a. het
  B1c-interface-lab); niet gebundeld in de app, open ze rechtstreeks in een browser.
- `docs/archive/superpowers/` — oudere ontwerpen (zoom, debug-terminal, stijlboek), met dezelfde
  waarschuwing: nuttig voor het waarom, niet voor het wat.
