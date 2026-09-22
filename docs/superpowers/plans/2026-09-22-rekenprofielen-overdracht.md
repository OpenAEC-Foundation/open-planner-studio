# Rekenprofielen — besluiten van de eigenaar en overdrachtsstand (2026-09-22)

*Bedoeld om een compaction of sessiewissel te overleven: alles wat een opvolger nodig heeft om zonder de
eigenaar verder te kunnen. Besluiten zijn letterlijk; de stand is van het moment van schrijven en wordt
onderaan bijgewerkt. Spec: `docs/superpowers/specs/2026-09-22-rekenprofielen-design.md` (v3.1, go van de
critreviewer). Plan: `docs/superpowers/plans/2026-09-22-plan-rekenprofielen.md` (architect-agent, in de maak
op het moment van schrijven).*

## 0. Eindtoestand van deze sessie/dit programma

**Nul afwijkingen met XER**: X12 (`check-xer-product-fidelity-x12.ts` mét corpus) op **0** zesassige
afwijkingen, sameday 0, cel-baseline leeg, `GOAL_ZERO_DEVIATIONS_XER` aan — per cel, onder regel A, zonder
pinnen. Het rekenprofielensysteem is daarvoor de voorwaarde (regel A is pas meetbaar mét profielen),
geen eindpunt. Zodra de etappe rekenprofielen geïntegreerd is, begint het "naar nul"-werk direct met de
goal prompt `docs/superpowers/plans/2026-09-22-goalprompt-x12-naar-nul.md`, autonoom, zonder op de
eigenaar te wachten. (Eigenaar, 2026-09-22 avond: "de endstate van deze hele sessie is dat we nul
afwijkingen hebben met XER".)

## 1. Besluiten van de eigenaar, 2026-09-22 — letterlijk

### 1a. Over PR #109 / X12 (ochtend, per vraag uit de PR-tekst)

- #109 merget niet met een rode productpoort. Het restant van 15.056 cellen gaat eerst omlaag; de
  planregel "geen pinnen met reden" blijft.
- Het "datums zoals opgeslagen voor alle formaten"-werk wordt een aparte PR na de merge, niet op #109.
- (2) Crashherstel: alleen de manifestvlag telt, geen heuristiek voor oude snapshots.
- (3) Niet-vastgelegde as: CSV leeg, MCP `null`, nooit 0.
- (4) MCP-provenance: codes altijd, resourcenamen alleen achter opt-in, en de AI-client moet die opt-in
  aan zijn gebruiker vragen.
- (5) De ES/EF-regressie van 7b blijft staan als tijdelijke stand, geen pin.
- (6) Samenvattingen rollen op uit hun kinderen, zoals P6.
- (7) Driving path wordt de zevende poort-as, met de longest-path-wandeling als instelling.
- (8) Dossier 7b-4 hoort bij "naar nul": eerst meten, dan bouwen.
- (9) Bronarchief één keer schrijven, in het IFC, niet per crashherstel-snapshot.
- (11) `lagCalendar` effectief voor alle formaten: accepteren, met releasenotitie.
- Regel A (landingsregel voor de gedeelde motor) en regel B (nieuwe conventies als benoemde instelling)
  gaan beide in de goal prompt.
- Solverprofiel per project: eerst geparkeerd ná X12, later op de dag herzien (zie 1b).
- De 49 OzBuild-bestanden gaan in de privérepo (optie 1). Door de eigenaar gemeten: 213 pins groen in
  de cloud. (Lokaal op deze machine zijn alle 216 pins aanwezig en gemeten.)
- Niet expliciet beantwoord: (10) de projecteinde-fout (valt onder "restant omlaag") en (12) de
  weekend-klemheuristiek (blijft zoals hij staat).

### 1b. Over het systeem tegen compromissen = rekenprofielen (brainstorm, middag)

1. De compromissen die weg moeten: de conventiekeuzes in de gedeelde motor ("moeten we dit in de
   solver doen? dan rekent het raar voor wie MS Project gewend is").
2. Wie bepaalt: de gebruiker, als één profielkeuze per project — mét eigen profielen met eigen waarden;
   het bronbestand stelt voor.
3. Waar leeft een profiel: volledige opgeloste waarden in het IFC + profiel-id als herkomst; eigen
   profielen app-globaal (optie 2).
4. Het OPS-profiel is een bewuste keuze van de eigenaar, te nemen aan het eind, ná X12, als alles werkt.
   Tot dan = "wat OPS vandaag doet", byte-identiek.
5. Regel A = per cel, niet per som: een motorwijziging landt alleen als onder elk profiel met orakel geen
   enkele cel die exact was inexact wordt; verschilt iets per profiel, dan is het een benoemde
   instelling (regel B), nooit een `if` op het bronformaat. Bevestigd: "ja dit is goed".
6. Volgorde: eerst het volledige profielsysteem (incl. eigen profielen), daarna X12 eronder, daarna de
   OPS-inhoud.
7. Openen: automatisch het bronprofiel, met een melding die zegt waar je het aanpast.
8. Werkwijze vandaag: alles critreviewen; zoveel mogelijk werk tegelijk; subagents NOOIT op Opus 5
   (alias `opus` = Opus 5.5, gemeten); geen Fable in subagents.

### 1c. Besluiten die de orkestrator zelf nam (te corrigeren door de eigenaar, anders staand)

- Spec v1→v3.1 na drie critreview-rondes: twee lagen (15 pakketconventies in het profiel;
  `project.schedulingOptions` blijft voor de 9 bestandsopties + `progressMode`); migratie per veld;
  `legacyValue`; `EffectiveSchedulingOptions` als verplicht solver-type; MSPDI én P6-XML blijven deze
  etappe op OPS (geen orakel); eigen profielen = sjablonen zonder doorwerking; herkomstvelden
  (`p6ProjectId` e.d.) blijven datagates met een gepinde telling; A22/A23 gespiegeld in
  `OPS_SchedulingOptions` alleen als `true`; profielwissel bewaart bestandsoverrides (A19).
- Merge-review PR #109: voortgangsbladen krijgen geen XER-verliesmelding; tekstrol `text-small`;
  AGENTS.md 41 tools — gedaan, `bd0fb55b` op de PR-branch.
- `measure:profiles`: de bekende NULDOEL-toestand (X12 rood op precies de drie nuldoel-regels + cel-poort
  groen) telt als geslaagd; `--strict` maakt hem rood.
- `recorded-all-formats`: no-go van de review (8 punten) wordt door een fix-agent verwerkt op
  `claude/recorded-all-formats-v2`, gerebased op de PR-branch.

### 1d. Open vragen voor de eigenaar (ontstaan tijdens het autonome werk; niet zelf beslist)

1. **B01 — 7.516 van de 15.056 cellen** (de helft van het X12-restant) zitten op zes taken in
   `rehab-2.xer` (V3114490 e.a.) die bij P6 TF 0 hebben terwijl hun opvolgers maanden speling geven en
   drie van de zes FF > TF. Uit de relaties in het bestand volgt dat niet; kandidaten (relaties die de
   splitter weggooide; een constraint die bij een import verloren ging) zijn niet aantoonbaar. Volgens
   de goal prompt (regel 4) is dit escaleren, niet pinnen. Besluit nodig: dit bestand (deels) uit het
   orakel halen in het manifest, of accepteren dat het nuldoel hier niet uit P6-regels te halen is.
   Zie `docs/superpowers/plans/2026-09-23-x12-restant-classificatie.md` B01.
2. **Synthetische bestanden S1–S10 — 1.814 cellen** (MER-1, groupdocs, ProjectLens, gimmer/nPlan
   GraphGen, meridianiq, p6diff, …): de orakels zijn intern tegenstrijdig of door een generator
   geschreven. Besluit nodig over hun status in `xer-corpus-manifest.json` (role/included). Samen met
   B01 is dat 62 % van het restant; zonder besluit is 0 op het volledige corpus niet te halen.
3. **Projecteinde (brok 1):** de fix landt (P6-conform voor de klasse zonder enig einde), maar Oracle
   beschrijft `CalculateFloatBasedOnFinishDate` als een multi-project-optie ("each activity's float is
   calculated based on its project's ScheduledFinishDate"), niet als Must Finish By; en OZB-Start
   registreert negatieve float zonder `plan_end_date`. Vervolgvraag in plan XER §9; `project.endDate =
   start` + `<MustFinishByDate>` in de P6-XML-export is een vervolgpunt.

## 2. Waar het werk staat (bijwerken bij elke mijlpaal)

| wat | branch | stand |
|---|---|---|
| PR #109 (XER-etappe) | `claude/file-formats-support-phase-3-a0ebe2` | main t/m #166 gemerged en gepusht (`0a29147c`): planning/library/browser 164/mcp/dev-server groen, X12 15.056; draft blijft tot X12 nul is |
| rekenprofielen (etappe) | `claude/rekenprofielen` (bovenop de PR-branch) | A, B, C, D, cellen en X12-brok 1 gemerged; `npm run verify` groen op `1fe5dfc8` (planning 560, mcp 41, browser 165), `measure:profiles` NULDOEL; eindreview I4 = landen-met-fixes (D-agent verwerkt de codepunten; goal prompt/spec gefixt); daarna I5 gebruikstest + I6 draft-PR gestapeld op #109 |
| baan A: register/profiel/IFC/migratie/sjablonen | `claude/rekenprofielen-baan-a` | GO na fixronde (`c7e7799e`); **gemerged** (`3fdf80c6`), migratiehelpers verhuisd naar `src/services/ifc/schedulingProfileMigration.ts`. Open voor baan D: A19 bewaren bij wissel vanaf een EIGEN profiel; `defaultStorage()` buiten try; label "(aangepast)" op `diffAgainstBase` baseren |
| baan B: p6Source uit de motor | `claude/rekenprofielen-baan-b` | GO na fixronde (`893e9955`); **gemerged** in `claude/rekenprofielen` (`e3545ed7`). Integratiepunt: tabeltest op `resolveLegacyP6SourceConventions` (zes gepoorte vlaggen zonder bron ⇒ false) corpusloos toevoegen; tijdelijke laag `legacyP6Source.ts` verwijderen zodra de lezers het profiel zetten |
| cel-baseline + `measure:profiles` | `claude/rekenprofielen-celbaseline` | GO na vier fixrondes (`f639f96b`); **gemerged** (`921afa0b`); `npm run measure:profiles` mét corpus op de etappebranch: P6 NULDOEL 15.056, cellen 15.473, MS Project GROEN (661 bestanden), vangrails GROEN. Herpinrecept + verboden omwegen in `scripts/README.md` en de goal prompt |
| uitvoeringsplan | `claude/rekenprofielen` | klaar: `2026-09-22-plan-rekenprofielen.md` (`66bb8ccc`, stand-noot `be4f4206`); 31 taken; C10 (MSPDI ⇒ MS Project) geblokkeerd tot eigenaarsbesluit |
| baan C: M1.3–M1.5 + C1–C9 | `claude/rekenprofielen-baan-c` | GO (`dcbb0f6a`); **gemerged** (`29f55cc0`): X12 15.056 + cellen 0/0/0, lezerprofielen/solver-invoer/roundtrip/contract groen. Voor de PR-tekst: C5 geldt bij elk openen en crashherstel (releasenotitie); export-guard-gat `.mpp`→MSPDI; R8-markeringen en X12-testnaam r.~1178 (aanbevolen) |
| baan D (deel 1 + 2) | `claude/rekenprofielen-baan-d` | deel 2 klaar (`85d29514`, gepusht): merge C, D10 af (verify:conventions in `verify`, 17 datagates gepind), D3 `applySchedulingSettings`, D4 `SchedulingProfileSection`, D5 Projectinfo, D6 browsertest 1/1; screenshots in de agent-worktree `qa/d4-0*.png`; her-check loopt; merge-tree conflictvrij |
| recorded-all-formats | `claude/recorded-all-formats-v2` | **draft-PR #167**, gestapeld op de PR-branch van #109; `npm run verify` groen (`eda674a9`); merget ná #109 (base dan naar main) |

| X12 naar nul — brok 1: projecteinde-fout | `claude/x12-brok1-projecteinde` (`d879c32b`) | GO; **gemerged** in de etappebranch. Vervolg (plan §9): commentaar over de P6-vlag corrigeren (Oracle: multi-project-optie op ScheduledFinishDate), `project.endDate = start` + `<MustFinishByDate>` in P6-XML-export |
| X12-restant-classificatie (meting) | `docs/superpowers/plans/2026-09-23-x12-restant-classificatie.md` | klaar: 28 brokken = exact 15.056 (+417 drivingPath in 4 groepen). Bouwvolgorde: B02 7b-4 (1.531) → B03 restlag (772) → B04 out-of-sequence (~676) → B07 CP_Phys (~446) → B06 FF eigen kalender (362) → B08 (210) → B05 → B15 → B09 → B11 → B12 → B13/B14. B01 (7.516) en synthetisch (1.814) = eigenaarsbesluit (§1d) |

Zijbranches van agents staan in worktrees onder `/home/nozzit/open-aec/open-planner-studio/.claude/worktrees/agent-*`
tot ze gemerged en gepusht zijn; na merge naar `claude/rekenprofielen` pushen en de worktree opruimen.

## 3. Werkvolgorde voor de opvolger

1. Reviews van baan B en cel-baseline verwerken (must-fixes), mergen in `claude/rekenprofielen`, pushen.
2. Baan A afwachten → critreview → merge. Dan conflicten A×B oplossen (`types/project.ts`,
   `schedulingOptionsRead.ts`), typecheck, X12 15.056 exact, mpp 216 exact.
3. Plan van de architect verwerken (self-review), banen C (lezers, `solveInputFor`, melding, export-guard,
   extensie-API, MCP) en D (UI, i18n 14 talen, gids, CLAUDE.md, recept, goal prompt, browser-test,
   `verify:conventions`) starten in eigen worktrees, elk na afloop een critreview.
4. Integratie (§10 spec stap 6): tijdelijke `legacyP6Source`-laag weg, testmigratie 106 treffers,
   `OPS_SchedulingOptions` alleen opties + A22/A23, `npm run verify` (één tegelijk machinebreed!),
   critreview op de hele diff, gebruikstest in de browser.
5. Daarna X12 "naar nul" onder regel A met de goal prompt (`2026-09-22-goalprompt-x12-naar-nul.md`,
   al geschreven): per brok restant een uitvoerder-opus-midden-agent in eigen worktree, `measure:profiles`
   vóór elke commit, critreview per landing; herhalen tot X12 exit 0. Dit is de eindtoestand (§0).

## 4. Vaste regels (uit het geheugen van de eigenaar, hier herhaald)

- Poorten op exitcode; máx. één `verify`/zware suite tegelijk machinebreed (`ps aux | grep run.sh`).
- Nooit naar `main` pushen; alles via PR; de eigenaar merget. Releasen alleen met akkoord.
- Subagents: nooit Fable, nooit Opus 5; `uitvoerder-opus-laag/-midden` (Opus 5.5); model in naam en
  rapport; critreviews via de `critreview`-skill met [BEVESTIGD]/[VERMOED].
- Corpus: `OPS_XER_CORPUS="/home/nozzit/open-aec/voor claude/testdata-crawl"` (93/93); `.mpp` vindt
  zijn 216 pins zelf. Node: `export PATH="/home/nozzit/.nvm/versions/node/v22.23.2/bin:$PATH"`.
