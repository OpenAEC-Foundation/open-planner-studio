# Spoor O — verificatie van de twee auditrapporten (draaiboek §2.5 stap 2)

Basis: `main` @ `91da0168`, schone worktree `/home/user/audit/vo` (na afloop `git status --short` = alleen `?? verificatie/`).
Corpus `/home/user/ops-xer-corpus` @ `ccc952c`, alleen gelezen; manifest alleen gelezen (via de meetscripts).
Alle eigen scripts, bundels, logs en gedownloade bronpagina's staan in `verificatie/eigen/` (`scripts/`, `tmp/`, `logs/`, `web/`).

Werkwijze: de scripts van beide auditors zijn gekopieerd met de paden herschreven naar de vo-worktree
(`scripts/A-*.ts`, `scripts/B-*.ts`, bundel via `bundle.sh`) en opnieuw gedraaid; codeclaims zijn per `pad:regel`
nagelezen; bronclaims zijn met `curl` als letterlijke paginatekst opgehaald (`web/*.html`, geen samenvattend model).
`npm run measure:profiles` is één keer gedraaid (`OPS_MPP_CRAWL` = corpuswortel). Geen `npm run verify`, geen volledige suite.

Legenda oordeel: **BEVESTIGD** / **DEELS** / **WEERLEGD** / **NIET TE TOETSEN**. "Ernst?" en "Label?" = terecht ja/nee.

---

## 1. Rapport A (`rapport-A/SPOOR-O-RAPPORT.md`, 16 bevindingen + §2.2/§3-claims)

### 1.1 Bevindingen O-01 … O-16

| id | titel (kort) | oordeel | ernst terecht? | label terecht? | bewijs |
|---|---|---|---|---|---|
| O-01 | `measure:profiles` P6-deel onuitvoerbaar (41 manifestbestanden ontbreken, fail-closed) | BEVESTIGD | ja (hoog, procesblokkade poort 3) | ja (zeker) | `logs/measure-profiles.log`: `p6-x12: exit 1`, throw in `productBaseline` (`.check-xer-product-fidelity-x12.mjs:18803`), `UITSLAG: ROOD`. Eigen telling per rol via manifest: ontbrekend 41 van 93 = engine-input 14, reader-only 19, parser-fixture 7, synthetic-fixture 1; 9 orakels aanwezig. Code: `tests/planning/xerFidelity.ts:338-340` (`manifestbestand ontbreekt in corpus` ⇒ error), `check-xer-product-fidelity-x12.ts:423-424` (throw bij errors). |
| O-02 | `OPS_MPP_CRAWL` moet de corpuswortel zijn, niet `crawl-mpp`; "opdracht en draaiboek noemen de verkeerde map" | DEELS | nee: laag (omgevingsconfiguratie, geen code) | ja voor de meting | Meting klopt: `logs/mpp-fidelity-crawlmpp.log` (`OPS_MPP_CRAWL=…/crawl-mpp` ⇒ `[crawl] 49 bestand(en) gescand`, `verwacht 213, kreeg 49`, ROOD) tegenover `logs/measure-profiles.log` (wortel ⇒ MS Project GROEN, 2173 checks, 658 gescand). Baseline-labels zijn wortel-relatief (`mpp-fidelity-baseline.json`: `"crawl-mpp/MSP2016_OzBuild/…"`); `CORPUS-OVERZICHT.md:30` zegt `OPS_MPP_CRAWL=<checkout van deze repo>`. **Weerlegd**: het draaiboek noemt níét `crawl-mpp` — §2.3 r.65: "`OPS_XER_CORPUS` en `OPS_MPP_CRAWL` wijzen daarheen" (= de corpuswortel) en §5.4 r.402: "Eerst controleren hoe de scripts de paden verwachten". De "opdracht" aan de auditors is niet beschikbaar (niet te toetsen). |
| O-03 | `readP6XML` leest 0 taken uit alle 9 echte P6-XML-exports | BEVESTIGD | ja (hoog, spoor E: stil leeg project) | ja (zeker) | `logs/A-pmxml-dbg.log`: 9/9 `tasks 0` bij 2–120 `<Activity>` per bestand; ook `logs/B-probe-pmxml.log` (n=0 overal). Code: `src/services/p6/p6xmlReader.ts:192-202` loopt alleen `doc.documentElement.children`; echte export `EC00850_V2.xml`: `<Project>` op r.2242, eerste `<Activity>` op r.3209 binnen `</Project>` r.7349. Eigen writer schrijft `<Activity>` plat (`p6xmlWriter.ts:444`). `docs/TODO.md:631/978` noemt alleen "P6 XML nooit gemeten"/dialectdekking, niet dit gat. |
| O-04 | Onbruikbare/ontbrekende `OPS_SchedulingProfile`-pset ⇒ stil OPS; `conventions` leeg ⇒ 20 overrides | BEVESTIGD | aan de hoge kant: alleen beschadigde of door derden bewerkte bestanden; de 5104 cellen zijn een ablatiegetal, geen gebruikerspad ⇒ laag/middel | ja (zeker) | `logs/A-probes2.log` byte-identiek aan `rapport-A/probes2.log` (S3b/S3c/S3f/S3h ⇒ "geen profiel ⇒ ops"; S3e/S3g ⇒ A19=false A13=false). Code: `ifcReader.ts:3239-3258` (`continue`/`catch` zonder melding), `schedulingOptionsRead.ts:217-242` (ontbrekende sleutel ⇒ `legacyValue`). `ImportResult` heeft geen meldingskanaal (keys in log). |
| O-05 | MSP-profiel alleen op start/einde gemeten; TF/kritiek voltooide taken wijken af; `.mpp`-lezer zet geen `criticalDefinition` | BEVESTIGD | ja (middel, meetlat) | ja (a–c zeker, d afgeleid) | `logs/A-mpptf.log`: voltooid 17/68, gestart 46/59, niet gestart 952/1017 (identiek). `logs/A-mppcrit.log`: 120 afwijkingen, 103 handmatig, 17 regels `sd=undefined comp=1`. Code: `scheduleAnalysis.ts:283` (`completed = !!dataDate && …`), `mppReader.ts:926` (kritiekgrens alleen in `recordedTimes`), `:1593`, geen `schedulingOptions` in het `Project` (`:972-990`); `mspdiReader.ts:771-778` zet wél `criticalDefinition.threshold`. |
| O-06 | drivingPath-as meet `isCritical` onder bestandsdefinitie; 110 van 145 cellen definitieverschil | BEVESTIGD | ja (middel, meetlat) | ja | `logs/A-ablate.log` regel `opt:criticalDefinition=longestPath`: dp 145→35, worse 0, better 110; per bestand base `{TERMINAL 35, ashspace 10, HP 7, Hotel 69, OZB 24}` → variant `{ashspace 10, HP 7, OZB 18}`. Code: `check-xer-product-fidelity-x12.ts:209` `drivingPath: task.time.isCritical`. |
| O-07 | Vier P6-conventies aan zonder orakelcel (A12, A15, A16, A18); vijf n=1 | BEVESTIGD | ja (laag) | ja | `logs/A-ablate.log`: A12/A15/A16/A18 `worse 0 better 0`; A20 +2 (TERMINAL), C11 +5 (OZB), C9 +24 (Hotel), C14 +23 (HP), B5 +20 (ashspace). Hele P6-ablatie is regel-voor-regel identiek aan `rapport-A/ablate.log` (`diff`, tijden genegeerd). |
| O-08 | B3, B4, C1, C4, A23 (P6) en A22/A23 (MSP) onbewezen | BEVESTIGD | ja | ja | idem; `logs/A-ablate-mpp.log` byte-identiek aan `rapport-A/ablate-mpp.log`: A22 uit ⇒ 3 bestanden, A23 uit ⇒ 1 bestand. |
| O-09 | Standaard-lagkalender P6/MSP botst met de bronnen | BEVESTIGD | aan de hoge kant: alleen bronloze projecten, XER leest per bestand ⇒ laag | ja (onbekend) | Bronnen letterlijk (§3): Oracle General tab "If you do not select a calendar, Successor Activity Calendar is used to calculate lag."; Boyle 2018 "Relationship lags are computed according to the Task Calendar of the successor task, if it has one, or the Project Calendar." Code: `registry.ts:246` `lagCalendar: 'predecessor'`, `:265-266` MSP zet niets. Corpus: lezer geeft 7/8 predecessor, HP successor (`logs/B-oracles-variants.json` → options). `.mpp`-ablatie predecessor/successor/projectDefault 0 cellen. |
| O-10 | MSP-voortgangsconventies negeren de vier MS-statusdatumopties | DEELS | ja (laag) | ja (afgeleid) | `grep MoveRemainingStartsForward\|MoveCompletedEndsBack…` in `src/` = 0 treffers (bevestigd). **Bronclaim onjuist**: "twee standaard aan" — MPUG zegt letterlijk "By default, the second and fourth options are disabled" (uitgegrijsd tot de eerste van het paar aangevinkt is); de pagina zegt niet dat de eerste en derde standaard aan staan. |
| O-11 | Profielwissel past standaardopties alleen in de wizard toe; MSP `totalFloatMode` wizard ≠ import | BEVESTIGD | ja (laag) | **nee**: reproductie = "code" ⇒ per §2.2 *afgeleid*, niet *zeker* | Code: `SchedulingProfileSection.tsx:129-134` (`mode === 'wizard' ? withDefaultOptions… : { …value, profile }`), `registry.ts:265-266`, `mppReader.ts:972-990` (geen opties), `scheduleAnalysis.ts:321-329` (hybride). Bevestigd door B's probe P4 (`logs/B-probe-profiles.log`: wizard MSP `{"totalFloatMode":"smallest"}`). `logs/A-mpptf.log`: afwezig geeft 1015/1144, gelijk aan rapport. |
| O-12 | Bronverwijzing bij A19 (47223) ondersteunt de claim niet | BEVESTIGD | ja (laag) | ja (WebFetch-citaat, door mij letterlijk bevestigd) | `web/47223.html`: "Remaining Duration field — The total working time from the activity remaining start date to the remaining finish date … Before the activity is started, the remaining duration is the same as the planned duration." Het is een veldwoordenboek; "schedul" komt alleen voor in "behind schedule". Docblok `types/project.ts:106-108` gebruikt het als bron voor de late kant van de scheduler. |
| O-13 | Extensie-API: 6 van 11 opties, geen waardecontrole | BEVESTIGD | ja (laag) | ja | `logs/A-extopt.log` identiek: `criticalDefinition.mode="bogus"` ⇒ `crit=falsefalsefalse`; `lagCalendar:"bogus"`, `nearCriticalThreshold:"abc"` gaan door; `thresholdHours` glipt door de spread. Code: `extMappers.ts:57-66`, `extTypes.ts:63-70`. |
| O-14 | Typegat (`SchedulingOptions \| undefined`) en scanbereik van de conventiepoort | BEVESTIGD | ja (laag) | ja (afgeleid) | `grep`: `scheduleAnalysis.ts:36`, `p6CompletedTargetWindow.ts:69,115,125,179,194`, `p6CompletedRouteTrace.ts:79,156,174,209`, `p6OpenLoeTargetSpanTrace.ts:53` nemen `SchedulingOptions \| undefined`; `CPMSolver.ts:161` eist `EffectiveSchedulingOptions`. `verify-conventions.mjs:82` `ENGINE_HELPERS = ['src/utils/p6SuspendResume.ts']`, scan = `src/engine/`. Kanttekening: "géén omweg gevonden" geldt voor solve-ingangen; de formaat-gate `CPMSolver.ts:2357` (B O-12) noemt A niet. |
| O-15 | Motivatie "P6-XML opent als OPS" is verouderd | BEVESTIGD | ja (laag) | ja | `p6xmlReader.ts:796-798` noemt A12/A13/A16/A17/A20/B2; A17 staat in P6 uit (`registry.ts:104`); A13 +3, A20 +2, B2 +117 in de ablatie; A12/A16 0. Kanttekening: de aangehaalde spec `2026-09-22-rekenprofielen-design.md` bestaat niet (wel `2026-09-22-plan-rekenprofielen.md`). |
| O-16 | Sjabloon opslaan mislukt stil | BEVESTIGD | ja (laag) | ja (afgeleid) | `SchedulingProfileSection.tsx:93` `if (upsertCustomProfile(…)) setTemplates(…)` — `false` wordt genegeerd; `profileStore.ts:106-116` geeft `false` bij ongeldig, vol (`MAX_CUSTOM_PROFILES`) of schrijffout. |

### 1.2 Claims uit §2.2 en §3 van rapport A

| claim | oordeel | bewijs |
|---|---|---|
| §2.2 P6→OPS→P6 5000/5000; IFC-round-trip 3000/3000 | BEVESTIGD | `logs/A-probes1.log`: S1 5000/5000, S2 3000/3000 (58 A19-gevallen bewust buiten de telling). |
| §2.2 "de state kan een P6-profiel met letterlijke A19-override niet meer vormen" | DEELS | `switchProfile(OPS{A19:true}, 'p6')` vormt hem wél (`logs/B-probe-profiles.log` P1/P2, gereproduceerd). Zo'n OPS/MSP-profiel met letterlijke A19 ontstaat alleen uit een pset/bestand (bewerken maakt een eigen kopie; migratie gooit gepoorte A19 zonder `p6Source` weg), dus in de praktijk zeldzaam; A's afdoening is te stellig, het gevolg (laag) klopt. |
| §2.2 migratie 12 gevallen | BEVESTIGD | `logs/A-probes2.log` S4 identiek; B's P6-probe geeft hetzelfde. |
| §2.2 MCP: `update_project` weigert `schedulingOptions/schedulingProfile/leveling/floatPaths` | BEVESTIGD | `calendarResourceTools.ts:1809-1830` (`PROJECT_REFUSED`); `statusDate/progressMode/defaultWorkRule` in de schrijfbare lijst `:1805-1806`. |
| §3.1 twee runs rood om O-01/O-02 | BEVESTIGD | eigen run (`logs/measure-profiles.log`): P6 ROOD (throw), MSP GROEN met wortel, vangrails GROEN (8 entries, 221 cellen, 76 met grootte), exit 1. |
| §3.2 equivalente meting: 221 cellen, 76 zesassig, CELLDELTA 0 | BEVESTIGD | `logs/A-ablate.log` `BASE total6=76 drivingPath=145 cells=221`; `logs/B-measure-oracles.log` `base vs pin: gepind 221, gemeten 312, nieuw inexact 91, nieuw exact 0, emmer gewijzigd 0` — de 91 zijn exact het schemaduplicaat `P6-Viewer/XER Files/Hotel Project.xer` (3 zesassig + 88 dp; `logs/B-fingerprint.log`: beide `f1e5f479674e3ce4`). Gevolg voor #241 klopt. |
| §3.3 HarbourPointe 54 verouderd (tegenfeit 61→7) + 7 mijlpaalvloer | BEVESTIGD | `logs/A-hpcf.log`: orig 61, tegenfeit 7, "resterend: EC2400:3 EC2390:4", 19 taken exact, 0 nieuw. |
| §3.3 Sample: "5 cellen afronding (0,00002 min)" + "7 cellen SF-minuut" | **WEERLEGD** | `logs/B-measure-oracles.log` DETAIL Sample 771: `tf truth=11998.99998 ours=12000` — het verschil is **1,00002 minuut**, niet 0,00002 (199.983333 u × 60 = 11999,0 min = 200 u − 1 min). Alle 12 Sample-cellen (REPLBE01 ls/lf/tf/ff, REPLBE02 ff, REPLBE03 es/ef/tf, RDARCH02 es/ef/tf/ff) zijn hetzelfde één-minuut-fenomeen van de SF-lag-0-relatie; de floatcellen zijn er 6, niet 5. Een tolerantie van 0,001 min (A's advies, vraag 8) lost er nul op. A's telling "59 verklaard / 17 onbekend" wordt daarmee **54 / 22** (B's lezing). Het label *zeker* was onterecht (rekenfout, geen reproductie van de 5). |
| §3.3 Hotel ATWTPR000 3 cellen (ls/lf 60 min, tf 60) | BEVESTIGD | DETAIL Hotel 2666 ATWTPR000: ls/lf `17:00` vs `16:00`, tf `60` vs `0`. |
| §1.2 SCHEDOPTIONS-tellingen (FT_FF 9/9, rcal_Predecessor 8/9, …) | BEVESTIGD (steekproef) | OZB-rij (`grep` op het XER): FT_FF, rcal_Predecessor, open_critical N, expect_end Y, lag_early_start Y; lezer-uitvoer in `logs/B-oracles-variants.json` → options: HP `successor`, Roads `longestPath`, Sample/Hotel-2665 zonder `useProjectEndDateForFloat`. |

---

## 2. Rapport B (`rapport-B/SPOOR-O-RAPPORT.md`, 22 bevindingen + §3)

| id | titel (kort) | oordeel | ernst terecht? | label terecht? | bewijs |
|---|---|---|---|---|---|
| O-1 | `measure:profiles` weigert op de corpusclone (41 ontbrekend; MSP 49 van 213 met `crawl-mpp`) | BEVESTIGD | ja (hoog, proces) | ja | zie A O-01/O-02: `logs/measure-profiles.log`, `logs/mpp-fidelity-crawlmpp.log`. B's regelverwijzingen `xerFidelity.ts:338-340`, `check-mpp-fidelity.ts:493,731-744` kloppen. |
| O-2 | Regel A houdt op `main`, ook na #241 | BEVESTIGD | ja (info) | ja | `logs/B-measure-oracles.log`: 0 nieuw exact, 0 emmer gewijzigd; de 91 "nieuw inexact" zijn volledig het schemaduplicaat (B zegt dat zelf). Onafhankelijk: `logs/A-ablate.log` BASE 221 = pin. |
| O-3 | Registertekst over A17 ("verandert geen enkele gemeten cel") is onjuist | BEVESTIGD | ja (laag, documentatie) | ja | `logs/A-ablate.log` en `logs/B-measure-oracles.log`: A17 aan ⇒ +118 (OZB: ls 42, lf 42, tf 34). Tekst: `registry.ts:94-95`, `types/project.ts:95-97`. Uniek voor B (A meet hetzelfde getal maar meldt de tegenspraak niet). |
| O-4 | A19-achterdeur: OPS/MSP{A19 aan} → P6 → opslaan → terug verliest A19 (2 van 324) | BEVESTIGD | ja (laag) | ja | `logs/B-probe-profiles.log` P1: exact de 2 paden; P2: zonder opslaan A19=true, met opslaan false. Code `schedulingOptionsRead.ts:237`. Bereikbaarheid beperkt (zie A §2.2). |
| O-5 | "Standaardopties" overschrijft opties die de UI als alleen-lezen bronsignaal toont | BEVESTIGD | nee: laag (0 celverschil gemeten; `p6CompletedLateFromRemainingWindow` inert onder elk ingebouwd profiel; Annuleren/undo) | ja | Code: `schedulingProfileDraft.ts:177` `SOURCE_ONLY_OPTION_KEYS = ['useProjectEndDateForFloat','leveling']`; `SchedulingProfileSection.tsx:54` `SOURCE_ONLY_OPTIONS = ['useExpectedFinishDates','useProjectEndDateForFloat','p6CompletedLateFromRemainingWindow']`; docblok `:72` zegt dat `useProjectEndDateForFloat`/`leveling` "vallen dan weg", de code bewaart ze. OZB 10093 draagt `p6CompletedLateFromRemainingWindow:false` (lezer-uitvoer; `sched_retained_logic=N`, `progress_override=Y`; `xerScheduleOptions.ts:578-581`). `ui:standaardopties(P6)`: +0 −0 (`logs/B-measure-oracles.log`). |
| O-6 | Wizard met P6 op een nieuw project zet P6-bronsignalen | BEVESTIGD | ja (laag) | ja | P4: wizard P6 `{…useExpectedFinishDates:true, p6CompletedLateFromRemainingWindow:true…}`; `registry.ts:250-251`; `SchedulingProfileSection.tsx:175-176` toont het blok bij `so[key] !== undefined`; `types/project.ts:149` "Alleen de XER-lezer zet dit". |
| O-7 | Eigen → ingebouwd gooit bestandsafwijkingen weg (A13 terug op true) | BEVESTIGD | ja (laag, ontwerp) | ja | P3 gereproduceerd; `registry.ts:282-285` (`keep` alleen bij ingebouwd id), `schedulingProfileDraft.ts:47-59`. |
| O-8 | Onzichtbare letterlijke afwijking onder OPS | BEVESTIGD | ja (laag) | ja | P5: `sameSettings = true`, daarna wissel naar P6 A13 false vs true. `SchedulingProfileSection.tsx:260` `deviates = conventions[c.id] !== base[c.id]`. |
| O-9 | MSP-profiel: `smallest` geldt niet bij `.mpp`-import (hybride) | BEVESTIGD | nee: laag — op de 213 `.mpp` geven afwezig en `smallest` dezelfde TF (`logs/A-mpptf.log` 1015/1144; A-tabel §1.2) en 0 start/einde-cellen (`logs/A-ablate-mpp.log` `opt:totalFloatMode=smallest` 0) | ja (afgeleid) | `mppReader.ts:972-990` (geen opties), `registry.ts:265-266`, `scheduleAnalysis.ts:321-329`. Zelfde oorzaak als A O-11. |
| O-10 | MSPDI-export meldt `smallest` niet als verlies; MSPDI heropent zonder de optie | BEVESTIGD | ja (laag, spoor F) | ja (afgeleid) | `mspdiWriter.ts:388` `if (so.totalFloatMode && so.totalFloatMode !== 'smallest') lost.push(…)`; `mspdiReader.ts:742` `suggestedProfileId: 'ops'`, alleen `CriticalSlackLimit` ⇒ opties (`:771-778`). |
| O-11 | XER-terugval `lagCalendar` ⇒ `predecessor` tegen Oracle-tekst | BEVESTIGD | ja (laag) | ja (afgeleid) | `xerScheduleOptions.ts:520-527` (`enumValue(…, 'predecessor', fallbacks)`); Oracle General tab en WS-referentie 42402 letterlijk (§3). Geen orakel met leeg veld. |
| O-12 | Herkomst-datagate buiten elke conventie in `CPMSolver.ts:2357` | DEELS | ja (laag) | ja (afgeleid) | Feit klopt: `const mayUseResume = task.p6ProjectId ? hasValidP6SuspendResume(task) : true;` staat in de `progressMode !== 'PROGRESS_OVERRIDE'`-tak, niet achter een conventie. Maar "een omweg die `verify:conventions` niet ziet" is te sterk: `p6ProjectId` is een gepinde datagate (`verify-conventions.datagates.json`: `p6ProjectId: 13`, alleen omlaag), dus de poort telt hem wél; de regeltekst (`.claude/rules/rekenprofielen.md:55-56`) zegt alleen dat zulke gates "bínnen conventies" staan, wat hier niet zo is. |
| O-13 | Negen conventiewaarden zonder orakelbewijs; B5 alleen op ashspace | BEVESTIGD | ja (info) | ja | ablatie (zie A O-07/O-08); B's 8-bestands-TSV komt getal voor getal overeen met A's `ablate.log` en met mijn run. |
| O-14 | P6-profiel is per conventie een lokaal optimum; MSP ook | BEVESTIGD | ja (info) | ja | `logs/A-ablate.log`: geen enkele conv-flip met `better` op een zesassige as (alleen dp bij A17 −6, B1 −2); `profile:ops` 5031, `profile:msproject` 6459. `logs/A-ablate-mpp.log`: `profile:ops` 1+2+1 = 4, `profile:p6` 65+14+3 = 82 — B's getallen. |
| O-15 | drivingPath-as meet `isCritical`; met `longestPath` 233 → 54 | DEELS | ja (laag) | ja | Interpretatie bevestigd (= A O-06), maar 233 → 54 zijn 9-bestandsgetallen mét het schemaduplicaat (`Hotel Project.xer` dp 88); de officiële poortpopulatie (8) geeft 145 → 35 (`logs/A-ablate.log`; `logs/B-measure-oracles.log` `dp 233→54` reproduceert B's eigen getal). B's §1.1 zegt zelf "over die 8 officiële bestanden" — inconsistent binnen het rapport. |
| O-16 | E4-orakel "Hotel Project.xer" meet niets extra; manifestuitsluiting verschilt | BEVESTIGD | ja (laag, manifest) | ja | `logs/B-fingerprint.log`: beide `f1e5f479674e3ce4`, projecten 2661,2663,2665,2666, 4236 taken. Manifest (gelezen): TEC `excludeProjects: [{projId:"2665", reason:"… p6Computed false"}]`, P6-Viewer geen uitsluiting. dp 88 vs 69 (`logs/B-oracles-variants.json` perFile). |
| O-17 | Extensie-API: 6 van 11 opties, zonder waardecontrole; `thresholdHours` ontbreekt richting extensie | DEELS | ja (laag) | ja (afgeleid) | Whitelist 6 sleutels bevestigd (`extMappers.ts:57-66`). Maar `thresholdHours` ontbreekt alleen in het **type** (`extTypes.ts:65`); runtime kopieert `{ ...o.criticalDefinition }` hem wél (`logs/A-extopt.log`: `thresholdHours:-1e9` komt door). "komt door als `threshold: undefined`" is dus half waar: `threshold` undefined, `thresholdHours` aanwezig maar ongetypeerd. Zelfde oorzaak als A O-13. |
| O-18 | Eigen profiel met naam van alleen witruimte blokkeert Projectinfo | BEVESTIGD | ja (laag) | ja (zeker/afgeleid) | P7 gereproduceerd (`name: "   "` blijft staan); `schedulingOptionsRead.ts:177-178` `validName` = alleen lengte; `schedulingProfileDraft.ts:115-117` `hasValidProfileName` trimt; `ProjectInfoPanelContent.tsx:218` `draftValid`, `:236` `if (!draftValid) return false`. |
| O-19 | Docblokken kloppen niet: `totalFloatMode` "Default 'smallest'"; C6 citeert 99348 dat "daar niets over zegt" | DEELS | ja (laag) | **nee** (WebFetch-samenvatting als reproductie; de C6-helft is onjuist) | Deel 1 BEVESTIGD: `types/project.ts:69` "Default 'smallest'" tegenover hybride bij afwezig (`scheduleAnalysis.ts:321-329`). Deel 2 **WEERLEGD**: `web/99348-G18294.html` bevat letterlijk "Early Start: Calculates the expired lag as the number of work periods between the actual start and the data date and determines the successor's start date as the predecessor's remaining early start plus any remaining lag." — de pagina dekt de rest-lag dus letterlijk; alleen de `max(0)`-formulering in het docblok (`types/project.ts:319-321`) is een gevolgtrekking daaruit. De Professional-tekst zegt hetzelfde; B's "zegt daar niets over" is onjuist. |
| O-20 | MCP: profiel/opties alleen-lezen, schrijven expliciet geweigerd | BEVESTIGD | ja (info) | ja | `calendarResourceTools.ts:1809-1830`, `readTools.ts:238-252`. |
| O-21 | IFC-round-trip profiel + 11 opties | BEVESTIGD | ja (info) | ja | P8 gereproduceerd (opties gelijk `true`, eigen profiel gelijk `true`, conventiesleutel gestript). |
| O-22 | `suggestedProfileId` per formaat zoals de regel | BEVESTIGD | ja (info) | ja | `xerReader.ts` p6, `mppReader.ts:1671` msproject, `mspdiReader.ts:742` / `p6xmlReader.ts:798` / `csvReader.ts:520` ops. |
| — | Legacy-migratie: leeg XER-blok ⇒ P6 met A12/A13/A15/A16/A18/A20 uit als afwijking | BEVESTIGD | — | — | `logs/B-probe-profiles.log` P6 `xer-leeg`; = A's S4. |
| §3 | 76 = HP 61 + Sample 12 + Hotel 3; groepen 54 / 7 / 12 / 3; 22 onbekend | BEVESTIGD | — | ja (HP "afgeleid, niet opnieuw gemeten" is eerlijk; A's tegenfeit levert het bewijs) | `logs/B-measure-oracles.log` DETAIL-telling per bestand: HP 61, Sample 12, Hotel 3 (+3 duplicaat). |
| §1.3 | "Roads alleen via de lezer, rauwe extractie faalde op codering" | NIET TE TOETSEN | — | — | Irrelevant voor de uitkomst (lezerwaarde `predecessor` bevestigd). |

---

## 3. Bronsteekproef (letterlijke paginatekst via `curl`, `web/*.html`)

### 3.1 Rapport A (14 URL's, 20 citaten)

| bron | citaat/claim van A | klopt? |
|---|---|---|
| Oracle 99348 (G18294) | Retained Logic / Progress Override / Actual Dates / Early Start "expired lag … remaining early start plus any remaining lag" / Actual Start "data date plus any remaining lag"; geen default voor float, lagkalender, open-ended, critical | ja, alle vijf letterlijk; pagina noemt inderdaad geen standaard |
| Oracle 99348 (F88966) | idem; "geen default kalender" | ja |
| Oracle General tab (F25600) | "If you do not select a calendar, Successor Activity Calendar is used to calculate lag." / "This option is checked by default." / "Smallest of Start Float and Finish Float is the most critical float value." | ja, letterlijk (3/3) |
| Oracle 6616 | FF / SF / "converted to hours based on the predecessor activity's calendar" | ja (3/3) |
| Oracle choose_a_calendar_for_relationship_lag | lag-conversiezin; geen default | ja |
| Oracle as_late_as_possible_constraint | beide zinnen | ja |
| Oracle 47223 | Remaining Duration-definitie; niets over de scheduler | ja (O-12 staat) |
| Microsoft Total Slack | "smaller value of the Late Finish minus the Early Finish field, and the Late Start minus the Early Start field" | ja |
| Microsoft critical path | "It has no slack (or float)." / "multiple critical paths for each independent network or series of tasks" / "one or two days of slack" | ja (3/3) |
| Microsoft status date | beide zinnen | ja |
| MPUG | "By default, the second and fourth options are disabled." | citaat ja; **A's gevolgtrekking "twee standaard aan" (O-10) staat er niet** — "disabled" is uitgegrijsd tot de eerste optie van het paar aanstaat |
| learn.microsoft TotalSlack | zin | ja |
| Boyle 2018-06-27 | "Relationship lags are computed according to the Task Calendar of the successor task, if it has one, or the Project Calendar." | ja, letterlijk (sectie C, Task Calendars); NB dezelfde pagina zegt in sectie A/B "according to the Project Calendar" — A's citaat is dus het geval mét taakkalenders, correct gemarkeerd als secundair |
| Boyle 2018-07-18 | "Relationship free float and total float use the predecessor calendar." / "computed according to the PREDECESSOR's calendar" | ja (2/2) |
| mpxj howto-use-cpm | zin | ja |

Onjuiste bronclaims A: **1** (MPUG-interpretatie). Daarnaast één onjuiste documentclaim (draaiboek noemt `crawl-mpp`, O-02) en één verkeerde bestandsnaam (spec in O-15).

### 3.2 Rapport B (11 URL's, 13 citaten/claims)

| bron | citaat/claim van B | klopt? |
|---|---|---|
| Oracle 99348 (F88966) | Progress Override-zin | ja |
| Oracle General tab | lagkalenderzin; C6 "The expired lag is calculated as the number of workperiods between the actual start and the data date. The successor's start date is the predecessor's internal early start plus any remaining lag."; "checked by default"; "Define critical activities as" zonder standaard | ja (4/4) |
| Oracle 47223 | "The total working time from the activity remaining start date to the remaining finish date." | ja |
| Oracle 6616 | FF-zin | ja |
| Oracle as_late_as_possible | "This constraint sets the early dates as late as possible without affecting successor activities." | ja |
| Oracle WS-referentie 42402 | "If you do not select a calendar, the successor activity calendar is used." | ja, letterlijk |
| Microsoft Total Slack | zin | ja |
| Microsoft Free Slack | zegt niets over negatieve vrije speling | ja ("negative" komt niet voor) |
| Microsoft constraint-pagina | "The task starts as late as it can without delaying other tasks." | ja; B's conclusie dat dit "ALAP vanaf de late datums" niet ondersteunt is redelijk |
| Oracle 99348 (G18294), claim O-19 | "die pagina zegt daar [remaining lag] niets over" | **nee** — staat er letterlijk (zie O-19) |
| Oracle 99348 | floatPaths/critical: optie beschreven, geen standaard | ja |

Onjuiste bronclaims B: **1** (O-19, 99348).

---

## 4. Overlap en unieke bevindingen

**Dezelfde oorzaak in beide rapporten**

| A | B | status |
|---|---|---|
| O-01 + O-02 | O-1 | bevestigd; B rapporteert ze als één |
| O-06 | O-15 | bevestigd; B's getallen 9-bestands (deels) |
| O-07 + O-08 | O-13 | bevestigd |
| O-09 | O-11 | bevestigd; A: profielstandaard (`registry.ts:246`), B: lezer-terugval (`xerScheduleOptions.ts:520-527`) — twee code-loci, één Oracle-bron |
| O-11 | O-9 (+ O-10 als gevolg) | bevestigd; ernst A laag, B middel ⇒ laag |
| O-13 | O-17 | bevestigd; B's `thresholdHours`-detail deels |
| O-14 | O-12 | A: geen omweg; B: datagate buiten conventie — B's feit klopt, A's claim geldt alleen voor solve-ingangen |
| §2.2 (A19-achterdeur) | O-4 | B reproduceert het als bevinding; A doet het te stellig af |
| §3.2 | O-2 | bevestigd, identieke uitkomst (221 cellen, CELLDELTA 0) |
| §3.3 | §3 | HP 54/7 en Hotel 3 gelijk; Sample: A 5+7 (weerlegd), B 12 (juist) |
| §1 conventietabel | §1.2 | alle P6-ablatiegetallen identiek (8 bestanden); MSP identiek (23/58/3/1) |

**Alleen in A**: O-03 (P6-XML-lezer, hoog — B zag 0 taken maar onderzocht de oorzaak niet), O-04 (pset-corruptie ⇒ stil OPS), O-05 (MSP TF/kritiek-meting, `.mpp`-kritiekgrens), O-10, O-12, O-15, O-16, het HarbourPointe-tegenfeit (61 → 7).

**Alleen in B**: O-3 (A17-registertekst onjuist), O-5 (Standaardopties vs bronsignaal-lijsten), O-6, O-7, O-8, O-16 (Hotel-duplicaat manifestuitsluiting), O-18, O-19 (helft), O-20–O-22, de wissel-round-trip over IFC (324 paden).

---

## 5. Samenvatting per rapport

Labelmaatstaf voor documentatieclaims: een via WebFetch verkregen citaat telt als bron zolang het letterlijk blijkt te kloppen
(door mij met `curl` nagelopen, §3); A markeert dat voorbehoud zelf in zijn §5. Een WebFetch-uitspraak dat een pagina iets
*niet* zegt, is geen reproductie: die telt alleen als ze klopt (B O-19 deel 2 klopte niet).

### Rapport A
- **Totaal (16 bevindingen + 8 §2.2/§3-claims): bevestigd 20, deels 3, weerlegd 1, niet te toetsen 0.**
- 16 genummerde bevindingen: bevestigd 14, deels 2 (O-02, O-10), weerlegd 0, niet te toetsen 0.
- §2.2/§3-claims (8): bevestigd 6, deels 1 (A19 "niet te vormen"), **weerlegd 1** (Sample "5 cellen afronding").
- Onterechte *zeker*-labels: **2** — O-11 (alleen code gelezen ⇒ afgeleid) en de Sample-afrondingsclaim (rekenfout; 12000 − 11998,99998 = 1,00002 min).
- Onjuiste bronclaims: **1** (MPUG "twee standaard aan"); plus 1 onjuiste documentclaim (draaiboek zou `crawl-mpp` noemen) en 1 verkeerde bestandsnaam (spec in O-15).
- Ernst te hoog: O-02 (middel ⇒ laag: omgeving), O-04 (middel ⇒ laag/middel: alleen beschadigde bestanden), O-09 (middel ⇒ laag: alleen bronloos).
- Gemist/overdreven: de tegenspraak in de A17-registertekst (B O-3) staat niet in A hoewel A dezelfde +118 meet; de Standaardopties/bronsignaal-inconsistentie (B O-5) en het duplicaat-manifestverschil (B O-16) ontbreken; het tolerantie-advies van 0,001 min (vraag 8) berust op de weerlegde afrondingsclaim en moet niet worden opgevolgd. Sterk: de ablatiemethode, het HarbourPointe-tegenfeit en O-03.

### Rapport B
- **Totaal (22 bevindingen + migratienoot + §3-claim + §1.3-detail): bevestigd 20, deels 4, weerlegd 0, niet te toetsen 1.**
- 22 genummerde bevindingen: bevestigd 18, deels 4 (O-12, O-15, O-17, O-19), weerlegd 0, niet te toetsen 0; migratienoot en §3-herbeoordeling bevestigd; één §1.3-detail (Roads rauwe extractie) niet te toetsen, zonder gevolg. Het weerlegde deel 2 van O-19 telt binnen "deels".
- Onterechte *zeker*-labels: **1** — O-19 (documentatieclaim op een WebFetch-samenvatting; de C6-helft is onjuist).
- Onjuiste bronclaims: **1** (99348 zou niets over "remaining lag" zeggen).
- Ernst te hoog: O-5 (middel ⇒ laag: 0 celverschil, inerte optie, undo), O-9 (middel ⇒ laag: corpus onderscheidt hybride en `smallest` niet).
- Gemist/overdreven: de oorzaak van "0 taken" bij P6-XML niet onderzocht (A O-03, hoog); geen meting van opgeslagen TF/kritiek in `.mpp` (A O-05) terwijl V3 daar wel om vraagt; O-15 met 9-bestandsgetallen terwijl §1.1 de 8-bestandspopulatie belooft; de HarbourPointe-verklaring alleen uit het onderzoeksdocument overgenomen. Sterk: O-3, O-5, O-16, O-19 (deel 1), de Sample-lezing (12 = één fenomeen) en de 324-paden-round-trip.

---

## 6. Bevestigde bevindingen die actie vragen, met spoor

| # | actie | bron | spoor | aard |
|---|---|---|---|---|
| 1 | `readP6XML`: elementen recursief (of onder `<Project>`) zoeken; echte exports leveren nu stil 0 taken | A O-03 | **E** | fix (test rood op oude code: 9 corpusbestanden) |
| 2 | X12-poort: modus "alleen orakels" (ontbrekend niet-orakelbestand = INFO, ontbrekend orakel = rood), anders geen regel-A-uitslag in cloudsessies | A O-01 / B O-1 | **T/O** (eigenaarsbesluit A-vraag 1 / B V1) | meetlat |
| 3 | `OPS_MPP_CRAWL` = corpuswortel in draaiboek §5 expliciet maken en in de opdracht aan agents | A O-02 / B O-1 | orkestrator | tekst |
| 4 | drivingPath-as met `criticalDefinition = longestPath` meten (145 → 35, 0 verslechterd) en herpinnen | A O-06 / B O-15 | **T/A** (eigenaarsbesluit) | meetlat |
| 5 | MSP-meetlat uitbreiden met opgeslagen TF/kritiek; daarna `.mpp`-lezer `criticalDefinition.threshold` zoals MSPDI en de regel "voltooid ⇒ niet kritiek zonder statusdatum" beoordelen | A O-05 / B V3 | **T/O**, daarna **E/O** (E4: gedragsverandering) | meetlat, dan fix |
| 6 | Docblokken rechtzetten: A17-tekst (`registry.ts:94-95`, `types/project.ts:95-97`), `totalFloatMode` "Default 'smallest'" (`types/project.ts:69`), A19-bron 47223 (`types/project.ts:106-108`); **niet** C6/99348 (klopt) | B O-3, B O-19a, A O-12 | **O** | documentatie |
| 7 | `SOURCE_ONLY_OPTION_KEYS` (draft) en `SOURCE_ONLY_OPTIONS` (UI) gelijktrekken; docblok `SchedulingProfileSection.tsx:72` | B O-5 | **O** | kleine fix (0 celverschil) |
| 8 | A19-achterdeur beperken tot psets zonder `overrides`-veld | B O-4 | **O/D** | kleine fix, lezer |
| 9 | Extensie-opties valideren (enum/getal) en whitelist/typering (`thresholdHours`) gelijktrekken | A O-13 / B O-17 | **J** | fix |
| 10 | Stille mislukking van "sjabloon opslaan" melden via het meldingskanaal | A O-16 | **O** (UI) | kleine fix |
| 11 | Melding wanneer een `OPS_SchedulingProfile`-pset aanwezig maar onbruikbaar is | A O-04 | **D/O** (eigenaarsbesluit A-vraag 10) | fix |
| 12 | MSP-profiel: `smallest` bij `.mpp`-import of uit de standaard; MSPDI-verliesmelding voor `totalFloatMode` | A O-11 / B O-9, B O-10 | **O** (E4) en **F** | eigenaarsbesluit |
| 13 | `lagCalendar`-standaard P6/MSP en XER-terugval tegen Oracle-tekst (successor) | A O-09 / B O-11 | **O** (E4, eigenaarsbesluit) | pas na P6/MSP-run |
| 14 | Manifest: `P6-Viewer/XER Files/Hotel Project.xer` dezelfde uitsluiting (2665) geven of als duplicaat markeren | B O-16 | eigenaar (manifest) | besluit |
| 15 | `validName` in de pset-sanitizer op `trim().length > 0` | B O-18 | **O/D** | kleine fix |
| 16 | Registertekst/gids: A12, A15, A16, A18 (P6 aan) en B5 als "geen/dun orakelbewijs" markeren | A O-07 / B O-13 | **O** + gidsen (E8) | documentatie |
| 17 | Sample 12 cellen: één fenomeen (SF-lag-0, één minuut), n=1, geen bron — laten; **geen** tolerantie van 0,001 min invoeren (lost niets op) | A §3.3 (weerlegd) / B §3 | **A/O** | geen actie |

Niet-actiepunten (bevestigd, geen fout): P6→OPS→P6, IFC-round-trip, migratie, MCP-weigering, `suggestedProfileId` (XER/`.mpp`/CSV), regel A op `main` incl. #241.
