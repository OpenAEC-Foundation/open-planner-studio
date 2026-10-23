# F2 — fixronde 3, motor, 23 oktober 2026

Drie BLOKKEERT-punten uit review ronde 3, deel A, zijn hersteld in de motor (`CPMSolver.ts`,
`scheduleAnalysis.ts`). Alle drie gaan over een mijlpaal zonder duur op de grens van een werkdag. SNET en FNLT
zijn met dezelfde tegenproef nagelopen; die waren al goed. Het vervolgpunt over ALAP staat als 273 in
`knownbugs.md`. Er is geen bestaande verwachting gewijzigd.

Werkplek: `.claude/worktrees/uren-f2`, branch `claude/uren-f2-kern`. Commits: `ee613624e` (punt 2), `de6ec7c24`
(punt 3), `f88f79843` (punt 1), `626c64ad4` (knownbugs 273), en deze notitie. Uitgevoerd door Claude Opus 5.5.
Deze notitie is opgesteld door een AI-assistent.

## Punt 1 — FNET schuift een START-mijlpaal naar de volgende werkdag

**Geval.** P 1 d op maandag, FS+0 naar START-mijlpaal M, FNET di 2 jun (de store slaat di 16:00 op). M kwam op wo
07:00. Een losse START met FNET di kwam onder OPS zelfs op wo 16:00 (wo 07:00, daarna B6).

**Oorzaak.** `forwardBoundOf` geeft voor de FNET het eindmoment di 16:00. De her-snap in
`snapSuccessorEarlyStart` behandelt een START als startachtig en zet een blokeinde door naar het volgende
blokbegin. Voor een FINISH en een mijlpaal zonder soort hield de her-snap het FNET-moment al vast.

**Fix.** `CPMSolver.ts:988–994`: verschuift de FNET de mijlpaal, dan blijft die op het FNET-eindmoment. De
aanroepen geven door of de constraints de vroege start verschoven: de voorgangerstak met
`earlyStart > beforeForwardConstraints` (`:2261`, `:2271`), de worteltak alleen bij `constraintMoved` (`:2129`).
Verschuift de FNET niets, dan geldt de gewone startsnap. De ondergrens blijft zo een ondergrens, en B6 verandert
niet: een losse START met FNET di staat nu op di 16:00, en dat is al het einde van de werkdag.

**Uitkomst op `be58ba356`.** De blokkenkalender gaf dezelfde fout (losse START: wo 07:00). De dagkalender rekende
daar nog in dagen.

**Niet waarneembaar.** De voorwaarde "de FNET verschuift iets" is in de voorgangerstak met de huidige
relatiewiskunde niet te zien. Die zet een START-mijlpaal na FS, FF, SS en SF zelf al op het blokbegin; een rauw
gelijkspel op di 16:00 komt niet binnen. De voorwaarde blijft als wacht staan. De test legt vast dat een
gelijkspel (P tot di 16:00, via FS en via FF) hetzelfde geeft als zonder FNET.

## Punt 2 — projecteindplaats op een 24-uurskalender

**Geval.** Scalaire kalender 00:00–24:00. Een START op de laatste werkdag (di 00:00) kreeg laat wo 00:00, speling
+1 en was niet kritiek. Op `be58ba356`: speling 0.

**Oorzaak.** Het projecteinde wo 00:00 is het einde van dinsdag. `dayFirstBandStart(projectEnd)` nam woensdag.

**Fix.** `CPMSolver.ts:3696`: eerst de eindwerkdag met `workdayDateOfInstant(predCal, projectEnd, 'end')`, dan het
eerste blokbegin van die dag. Dat is dezelfde regel als de 24-uurswacht (`:3788`).

**Bekend, niet gewijzigd.** Met expliciete 24-uursblokken geeft dezelfde START speling 1, op de basis en nu. De
projecteindplaats geldt alleen voor kalenders zonder eigen werkblokken; dat is het bestaande urenmodel.

## Punt 3 — SNLT op een START-mijlpaal meldt een onterechte schending

**Geval.** P op maandag, FS+0 naar START M, SNLT di. M staat vroeg op di 07:00. De late kant werd ma 16:00, met
speling −1 en een gemelde schending.

**Oorzaak.** `backwardBoundOf` en de schendingstoets namen voor een SNLT `snapOnOrBefore(di 07:00)` = ma 16:00. Een
SNLT is startachtig.

**Fix.** `milestoneLateMoment` (`CPMSolver.ts:3027`) geeft voor een SNLT op een nulduurmijlpaal in uur-modus
hetzelfde moment als een SNET op die datum (di 07:00), en voor MSO/MFO het bestaande moment.
`backwardBoundOf` (`:3040`) en de schendingstoets (`scheduleAnalysis.ts:423`, invoer `:60`, koppeling
`CPMSolver.ts:1766`) gebruiken die ene functie.

**Uitkomst op `be58ba356`.** De blokkenkalender gaf dezelfde fout.

## SNET en FNLT

Tegenproef `alletypen`: START, FINISH en zonder soort × SNET, SNLT, FNET, FNLT × zonder tijd en met tijd × OPS, P6,
MSP × dag- en blokkenkalender (144 gevallen). Vóór deze ronde 132/144 goed; alle fouten waren START met SNLT of
FNET. Nu 144/144. SNET en FNLT waren al goed; daar is niets aan veranderd.

## Mutatiebewijs

Elke mutatie op het bestand, check gedraaid, teruggezet met `cp` en met `cmp` gecontroleerd.

| Mutatie | Check | Uitkomst |
|---|---|---|
| Punt 2: projecteindplaats op de kalenderdag van het projecteinde | `check-hours-f2-review.ts` | 527/530, exit 1 |
| Punt 3: late kant zonder SNLT-moment (`backwardBoundOf`) | idem | 532/554, exit 1 |
| Punt 3: schendingstoets zonder SNLT-moment | idem | 530/554, exit 1 |
| Punt 1: geen FNET-keep | idem | 590/614, exit 1 |
| Punt 1: worteltak zonder FNET-keep | idem | 602/614, exit 1 |
| Punt 1: keep ook zonder verschuiving | idem | 626/626, exit 0 — overleeft, zie "Niet waarneembaar" |

## Gewijzigde verwachtingen

Geen. Nieuw in `check-hours-f2-review.ts` (527 → 626 controles), indeling **B3** (gerepareerde fout):

- 3: START op de laatste 24-uurswerkdag (punt 2), OPS, P6 en MSP.
- 24: START en zonder soort na P met SNLT di, zonder tijd en met 07:00, drie profielen, dag- en blokkenkalender
  (punt 3).
- 72: START en zonder soort met FNET di, zonder tijd en met 16:00, na P en los, plus het gelijkspel via FS en FF,
  drie profielen, dag- en blokkenkalender (punt 1).

## Controles

Node 24.22.0 (`~/.local/bin`). Typecheck en `measure:profiles` via `flock /tmp/ops-zwaar.lock`. Stand `626c64ad4`.

| Controle | Uitkomst | Exit |
|---|---|---|
| Tegenproef ronde 3 `nieuwe-tegenproef` | 12/12 goed (na punt 3 nog 6 fout, alle FNET) | 0 |
| Tegenproef ronde 3 `store-grenzen` | 0 fouten in de store-route | 0 |
| Tegenproef ronde 3 `projectend24` | 0 geschonden | 0 |
| Tegenproef `alletypen` | 144/144 | 0 |
| Tegenproef ronde 2 `blokkeerders.ts` | 5/5 | 0 |
| Ronde 1 `regressies.ts` | 7 GOED, 0 geschonden | 0 |
| `check-hours-f2-review.ts` | 626/626 | 0 |
| `check-recorded-dates.ts`, `-mark`, `-library` | 383, 52/52, 26/26 | 0 |
| `check-dcma.ts` | 41 | 0 |
| `check-auto-actual-start.ts` | 135/135 | 0 |
| Profielvangrails (corpusloze fidelity-gate, cel-baselinepoort) | 57 en 141 | 0 |
| Alle 24 casebatterijen via `run.sh` | 608/608 | 0 |
| F0 minutenmodel run 1 en run 2 | gelijk aan ronde 2; klopt met `minute-model-runs.json` | 0 / 0 |
| Burenvergelijking (1.944 netwerken, MSO/MFO) | gelijk aan ronde 2, 0 verschillen | 0 |
| `npm run lint:fast` | geen fouten | 0 |
| `npm run typecheck` | geen fouten | 0 |
| `npm run measure:profiles` (corpus) | P6: `nieuw=0 verslechterd=0 groter=0`, NULDOEL (regel A gehouden); MSP rood op `timephased-cost-rollup.mpp` (knownbugs 187, ook op `99049810a`) | 1 |

`projectend24x` (expliciete 24-uursblokken) houdt 3 fouten, gelijk aan de basis; zie punt 2.

## Vervolg (niet hersteld)

- **knownbugs 273**: ALAP laat bij een losse mijlpaal een dagdeel vrije speling liggen (`applyAlap` telt hele
  werkdagen). Gemeten op de huidige stand en op `be58ba356` (blokkenkalender).

## Merge van de laadfix, ronde 3

`git merge origin/claude/uren-f2-laden2` (`22ad7bca9`), merge-commit `a3fd06cdb`: geen conflict. `npm run
i18n:resolve`: exit 0, niets gewijzigd. Daarna `knownbugs.md` 274 (een werkelijk einde om 08:00 wordt na import uit
P6 XML of MSPDI 16:00; ankerregel I8), commit `02a6a0357`.

| Controle na de merge (stand `02a6a0357`) | Uitkomst | Exit |
|---|---|---|
| `check-import-datum-zonder-tijd.ts` | 53/53 | 0 |
| `check-mpp-import.ts` | 3101 hard | 0 |
| `check-hours-f2-review.ts` | 626/626 | 0 |
| Groep 1 uit het laadverslag (alle `check-mspdi-*`, `check-p6xml-*`, `check-mpp-*`, `check-progress*`, `check-minute-model-input`, `check-minute-model-ifc`) | alleen `check-mpp-fidelity` rood: 3 afwijkingen op `timephased-cost-rollup.mpp` (knownbugs 187) | 1 |
| Alle 24 casebatterijen | 608/608 | 0 |
| `npm run typecheck` | geen fouten | 0 |
| `npm run lint:fast` | geen fouten | 0 |

## Ronde 4

Review ronde 4 gaf één BLOKKEERT-punt in de fix van punt 2, en één opruimpunt in de fix van punt 1. Commits:
`d661779ab` (fix en opruimen) en `bd1c69498` (knownbugs 275 en 276). Uitgevoerd door Claude Opus 5.5.

### De projecteindplaats trok een START op het projecteinde een dag terug

**Geval.** Scalaire kalender 00:00–24:00, alle dagen werkend. P 1 of 2 d vanaf ma 00:00, FS+0 naar START M, zonder
constraint. P eindigt di 00:00 en M staat daar ook; dat is het projecteinde. De fix van punt 2 nam van dat moment
alleen de eindkant (maandag): M laat ma 00:00, M en P speling −1, en P een late start vóór het projectbegin. Op
ronde 3 én op `be58ba356` speling 0. Tegenproef reviewer: 0/6 en via de store 3/3 profielen fout.

**Eerste poging, verworpen.** "Leg een tijdige mijlpaal niet vóór haar eigen vroege moment" herstelt M en P, maar
is te ruim. Een tweede START Q via SS+0 op ma 00:00 kreeg dan speling 0 (1 d) en 1 (2 d); op ronde 2 en de basis 1
en 2. En een START op wo 00:00 na een ingesteld projecteinde di kreeg speling 0; op ronde 3 en de basis −1.

**Fix.** Het berekende projecteinde opent de laatste werkdag als een mijlpaal met deze dagregel er zelf precies op
staat (`projectEndOpensDay`, `CPMSolver.ts:3450`). Dan is het projecteinde zelf het begin van de laatste
projectdag (`lastProjectDayStart`, `:1175`). Anders geldt de eindkant uit punt 2. Een ingesteld projecteinde
(`useProjectEndDateForFloat`) blijft een eindmoment (`:3458`). Het predicaat van de dagregel staat nu in één
helper, `usesLastProjectDayStart` (`:1158`); de late pass (`:3716`) en de nieuwe toets gebruiken die allebei.

| Geval (24-uurskalender) | Ronde 3 | Nu | Basis |
|---|---|---|---|
| P 1 d → START M op het projecteinde: speling M en P | −1, −1 | 0, 0 | 0, 0 |
| idem, P 2 d | −1, −1 | 0, 0 | 0, 0 |
| tweede START Q op ma 00:00 (SS+0), P 1 d / 2 d | 0 / 1 | 1 / 2 | 1 / 2 |
| START op wo 00:00, ingesteld projecteinde di | −1 | −1 | −1 |
| START op di 00:00, B tot wo 00:00 (de oorspronkelijke A2-proef) | 0 | 0 | 0 |

Op de 7–16-kalender verandert niets: daar valt een START op een dagbegin nooit samen met de eindkant van de vorige
dag.

### Opruimen

De parameter `constraintsMovedStart`, de momentopname `beforeForwardConstraints` en het doorgeven van de
vergelijking zijn weg; de aanroepen zijn weer gelijk aan `ee613624e`. De controle op het FNET-eindmoment blijft
(`CPMSolver.ts:988–992`). Die geldt nu ook na een nivelleervertraging; dat is hetzelfde punt op de werktijdas.

### Mutatiebewijs ronde 4

| Mutatie | `check-hours-f2-review.ts` |
|---|---|
| R4-M1: het projecteinde opent nooit een dag | 629/641, exit 1 |
| R4-M2: een ingesteld projecteinde opent ook een dag | 638/641, exit 1 |
| R4-M3: projecteindplaats weer op de kalenderdag (de oude A2-fout) | 635/641, exit 1 |
| R4-M4: de fix van ronde 3 zonder `projectEndOpensDay` | 629/641, exit 1 |
| R4-M5: geen FNET-controle | 617/641, exit 1 |

### Gewijzigde verwachtingen ronde 4

Geen bestaande. Nieuw (626 → 641), **B3**: 6 voor de START op het projecteinde (M en P), 6 voor Q, 3 voor het
ingestelde projecteinde; drie profielen, P 1 en 2 d.

### Controles ronde 4 (stand `bd1c69498`)

| Controle | Uitkomst | Exit |
|---|---|---|
| Tegenproeven ronde 4 `regression24`, `store24` | 6/6; 0/3 profielen fout | 0 / 0 |
| `next-boundary` | alleen de 3 foutregels anders dan de log van de reviewer, nu speling 0 | 0 |
| Probes reviewer ronde 2 en 3 (23 stuks, zonder de prestatieprobe) | alle exit 0; de 13 met een log van de reviewer op de ronde-4-head: 0 afwijkende regels; `randen` 12138/12138 | 0 |
| Eigen probes: `alletypen`, burenvergelijking, Q, ingesteld projecteinde | 144/144; 0 verschillen met ronde 2 | 0 |
| `check-hours-f2-review.ts` | 641/641 | 0 |
| `check-recorded-dates`, `-mark`, `-library` | 383, 52/52, 26/26 | 0 |
| `check-dcma.ts` | 41 | 0 |
| `check-auto-actual-start.ts` | 135/135 | 0 |
| `check-import-datum-zonder-tijd.ts` | 53/53 | 0 |
| Profielvangrails | 57 en 141 | 0 |
| Alle 24 casebatterijen | 608/608 | 0 |
| F0 run 1 en run 2 | gelijk aan ronde 3; klopt met `minute-model-runs.json` | 0 / 0 |
| `npm run lint:fast` | geen fouten | 0 |
| `npm run typecheck` | geen fouten | 0 |
| `npm run measure:profiles` (corpus) | P6 `nieuw=0 verslechterd=0 groter=0`, NULDOEL; MSP rood op `timephased-cost-rollup.mpp` (knownbugs 187) | 1 |

### Vervolg ronde 4 (niet hersteld)

- **knownbugs 275**: één werkelijke datum met een tijd maakt van een importkalender een urenkalender (I8).
- **knownbugs 276**: een FNET met een tijd buiten werktijd zet een START-mijlpaal op de volgende werkdag.

## Ronde 5

Review ronde 5 gaf één BLOKKEERT-punt in de fix van ronde 4. Commit `101137680`. Uitgevoerd door Claude Opus 5.5.

### Het dagbegin van de laatste projectdag lag niet op de eigen taakkalender

**Geval.** Kalender A ma–vr 07–16, kalender B ma–vr 08–16. P 1 d op maandag (A), FS+0 naar START M. R 1 d op
maandag (B), SS+0 naar START Q met ALAP. M staat op di 07:00; dat is het projecteinde, en het opent dinsdag.
`lastProjectDayStart` gaf in ronde 4 dan het klokmoment di 07:00 terug, ook voor Q op kalender B. Dat valt buiten
de werktijd van Q. ALAP verplaatste Q daardoor niet: Q bleef op ma 08:00, speling 1, niet kritiek. Op `b4fb9dea5`
en de basis: di 08:00, speling 0, kritiek. Fout onder OPS, P6 en MSP, via de solver en via `runCPM` in de store.

**Fix (richting van de reviewer, nagemeten).** De vlag kiest alleen de laatste werkdag; het dagbegin komt uit de
eigen kalender: `this.dayFirstBandStart(eng, projectEnd) ?? projectEnd` (`CPMSolver.ts:1178`). Nog steeds één
predicaat, één vlag en één kalenderberekening.

| Geval | Ronde 4 | Nu | `b4fb9dea5` | Basis |
|---|---|---|---|---|
| ALAP-START Q op 8–16, projecteinde di 07:00 | ma 08:00, speling 1 | di 08:00, speling 0, kritiek | idem nu | di, speling 0 |
| START Q op 7–16 naast een 24-uursprojecteinde di 00:00 | laat di 00:00, speling 1 | laat di 07:00, speling 1 | laat ma 07:00, speling 0 | laat di, speling 1 |
| idem op 8–16 | laat di 00:00, speling 1 | laat di 08:00, speling 1 | laat ma 08:00, speling 0 | laat di, speling 1 |

**Probes van de reviewer (`edges`, 1164 gevallen; `focused`, 1224).** Tegenover ronde 4 veranderen 9 en 36
gevallen. Alle 36 in `focused` en 3 in `edges` zijn weer gelijk aan `b4fb9dea5` en aan de basis. De andere 6 in
`edges` zijn de gemengde 24-uursvariant uit de tabel: Q is nu gelijk aan de basis. Geen enkel geval wijkt nu van de
basis af waar ronde 4 wel gelijk was.

**Waarneming, niet gewijzigd.** In die gemengde variant heeft de gewone taak R (1 d op 7–16 of 8–16, ma) speling 0;
op de basis 1. Dat is ook zo in ronde 4 en op `b4fb9dea5`; verder terug niet gemeten. Het projecteinde di 00:00 is
voor een gewone taak het einde van maandag (`snapOnOrBefore` geeft ma 16:00). De dagregel geldt alleen voor
mijlpalen; deze ronde raakt R niet.

### Mutatiebewijs ronde 5

| Mutatie | `check-hours-f2-review.ts` |
|---|---|
| R5-M1: de vlag geeft weer het klokmoment (ronde 4) | 641/653, exit 1 (3 solver, 3 store, 6 gemengd) |
| R5-M2: de vlag weg (ronde 3) | 635/653, exit 1 |
| R5-M3: een ingesteld projecteinde opent ook een dag | 650/653, exit 1 |
| R5-M4: de oude A2-fout terug | 647/653, exit 1 |
| R5-M5: geen FNET-controle | 629/653, exit 1 |

### Gewijzigde verwachtingen ronde 5

Geen bestaande. Nieuw (641 → 653), **B3**: 3 ALAP via de solver, 3 ALAP via `runCPM` in de store, 6 gemengd (7–16
en 8–16 naast een 24-uurskalender); drie profielen. De A2-proef, de 24-uursketen en het ingestelde projecteinde
blijven ongewijzigd in de check.

### Controles ronde 5 (stand `101137680`)

| Controle | Uitkomst | Exit |
|---|---|---|
| Tegenproef ronde 5 `blocker` | 6/6 (solver en store, drie profielen) | 0 |
| Tegenproeven ronde 4 `regression24`, `store24` | 6/6; 0/3 profielen fout | 0 / 0 |
| `next-boundary` | 0 afwijkende regels tegen de log van de reviewer | 0 |
| Probes reviewer ronde 2 en 3 (23 stuks) | alle exit 0; de 13 met een log van de reviewer in ronde 5: 0 afwijkende regels | 0 |
| Eigen probes `alletypen`, buren, Q, ingesteld projecteinde | 144/144; 0 verschillen met ronde 2 en 4 | 0 |
| `check-hours-f2-review.ts` | 653/653 | 0 |
| `check-recorded-dates`, `-mark`, `-library` | 383, 52/52, 26/26 | 0 |
| `check-dcma.ts` | 41 | 0 |
| `check-auto-actual-start.ts` | 135/135 | 0 |
| `check-import-datum-zonder-tijd.ts` | 53/53 | 0 |
| Profielvangrails | 57 en 141 | 0 |
| Alle 24 casebatterijen | 608/608 | 0 |
| F0 run 1 en run 2 | gelijk aan ronde 4; klopt met `minute-model-runs.json` | 0 / 0 |
| `npm run lint:fast` | geen fouten | 0 |
| `npm run typecheck` | geen fouten | 0 |
| `npm run measure:profiles` (corpus) | P6 `nieuw=0 verslechterd=0 groter=0`, NULDOEL; MSP rood op `timephased-cost-rollup.mpp` (knownbugs 187) | 1 |
