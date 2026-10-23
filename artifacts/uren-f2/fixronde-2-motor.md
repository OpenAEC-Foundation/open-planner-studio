# F2 — fixronde 2, motor, 23 oktober 2026

Twee BLOKKEERT-punten uit review ronde 2, deel A, zijn hersteld in `CPMSolver.ts`. Op besluit van de
orkestrator is daarna ook de zachte MSO/MFO op een losse mijlpaal hersteld (punt 3). De tegenproef van de reviewer
gaat van 0/5 naar 5/5. Er is geen bestaande verwachting gewijzigd. Alleen de motor (`CPMSolver.ts`,
`scheduleAnalysis.ts`) en de F2-reviewcheck zijn aangepast; laadkant, store en hooks zijn niet aangeraakt.

Werkplek: `.claude/worktrees/uren-f2`, branch `claude/uren-f2-kern`, start op `99049810a` (schoon, gelijk met
origin). Commits: `7513d5371` (punt 1 en 2), `28b028823` (notitie), daarna punt 3. Uitgevoerd door Claude Opus 5.5.
Deze notitie is opgesteld door een AI-assistent.

## Punt 1 — de 24-uurswacht verliest een dag bij een opvolger

**Oorzaak.** De wacht voor hele dagen in de late pass zocht het dageinde van de kalenderdag van de
opvolgergrens. Zevendaagse kalender 00:00–24:00, A en B elk 1 d, FS+0: de grens is di 00:00. Dat is ook het
geldige einde van maandag. De wacht nam toch dinsdag (einde wo 00:00), en sprong met
`prevWorkInstantBefore(di 00:00)` naar ma 00:00. Zo verdween maandag. De eindzijdige terugrekening in
`subDuration` maakte daar laat zo 00:00–ma 00:00 van, speling −1.

**Fix.** `src/engine/scheduler/CPMSolver.ts:3761`: de wacht bepaalt eerst de werkdag aan de eindkant met de
bestaande `workdayDateOfInstant(predCal, lateFinish, 'end')`, en zoekt daarop het eerste blokbegin en het laatste
blokeinde. Een geldig blokeinde springt daardoor niet nog een keer terug. Voor een grens midden op de dag of op
een blokbegin blijft de uitkomst gelijk.

## Punt 2 — B6 overschrijft een harde mijlpaalpin

**Oorzaak.** Een losse START- of FINISH-mijlpaal met een harde MSO op di 2 jun (zonder tijd of 07:00) kreeg
via de pin di 07:00. Daarna schoof B6 de vroege datum naar 16:00. De late pass hield de pin (07:00). Gevolg:
totale en vrije speling −1, zonder gemelde constraintschending.

**Fix.** Eerst `!hardFinishPin` in de B6-voorwaarde (`7513d5371`). In punt 3 is dat verbreed: B6 slaat elke
mijlpaal met een MSO of MFO over (`CPMSolver.ts:2633`).

## Punt 3 — zachte en harde MSO/MFO op een losse mijlpaal (orkestratorbesluit)

**Oorzaak.** Een MSO of MFO op een mijlpaal had aan de vroege en de late kant een ander moment:

- De late grens en de schendingstoets namen `snapOnOrBefore`; een grens op het blokbegin di 07:00 werd ma 16:00.
  Gevolg: een gemelde schending, onder OPS ook speling −1 door B6.
- B6 schoof de vroege kant van een zachte MSO naar 16:00.
- Een START-mijlpaal met een MFO (di 16:00) werd her-gesnapt naar wo 07:00.
- Onder P6 en MSP begon de late kant van een START-mijlpaal op een scalaire kalender bij het begin van de
  projecteinddag (di 07:00), ook als de MFO di 16:00 zei.
- Een harde MSO op een blokeinde (di 16:00) werd wo 07:00; de zachte variant hield 16:00 al vast.

Op `be58ba356` gaven dagkalenders geen fout (dag-modus). De blokkenkalender gaf er dezelfde fouten; ook de
START-mijlpaal met een harde MFO zonder tijd stond daar al op wo 07:00.

**Fix: één moment per MSO/MFO op een nulduurmijlpaal.** `milestoneConstraintMoment` (`CPMSolver.ts:3003`)
geeft in uur-modus de vroege grens uit de bestaande `forwardBoundOf`. Dat moment gebruiken:

| Plek | Regel |
|---|---|
| late grens, zacht | `CPMSolver.ts:3015` (`backwardBoundOf`) |
| harde pin | `CPMSolver.ts:2839` en `:2855` (`hardPinStart`, `hardPinFinish`) |
| B6 | `CPMSolver.ts:2633`: geen B6 bij een MSO/MFO |
| her-snap | `CPMSolver.ts:986` (`snapSuccessorEarlyStart`): een mijlpaal op dat moment blijft staan |
| beginwaarde late kant bij het projecteinde | `CPMSolver.ts:3667–3668`: niet bij een losse mijlpaal of een START met een MSO/MFO |
| schendingstoets | `scheduleAnalysis.ts:423`, via een nieuwe invoer `milestoneConstraintMoment` (`CPMSolver.ts:1753`) |

Zonder tijd geeft dat D1 voor een MSO (di 07:00) en D2 voor een MFO (di 16:00); een tijd blijft staan. Het open
eigenaarspunt (afgemelde mijlpaal zonder pin: B6 16:00 tegen D7 07:00) is niet aangeraakt.

**Bewuste grens.** Een mijlpaal zonder soort mét voorganger houdt de oude beginwaarde bij het projecteinde. Daar
leunt `check-dcma.ts` s3 op: de kritiek-padtest maakt de harde MFO zacht, en alleen die oude beginwaarde maakt Q
kritiek. Met de verbrede regel werd s3 "na" in plaats van "pass". Zie de bijvangst hieronder.

**Vergelijking met buren.** 1.944 netwerken (voorganger, opvolger of beide; drie soorten; zacht en hard; MSO en
MFO; drie datums en drie tijden; OPS, P6, MSP; dag- en blokkenkalender) op `28b028823` en met de fix: 508 beter,
44 anders, 0 slechter. Die 44 hebben allemaal hetzelfde patroon: een zachte MSO op ma terwijl de voorganger de
mijlpaal naar di duwt. Speling −1 en de schending blijven terecht staan; alleen het late moment staat nu op ma
07:00 in plaats van vr 29 mei 16:00.

## Mutatiebewijs

Elke mutatie op een kopie, check gedraaid, teruggezet met `cp` en met `cmp` gecontroleerd. Check:
`check-hours-f2-review.ts` (512 controles).

| Mutatie | Uitkomst |
|---|---|
| M0: 24-uurswacht op de kalenderdag (`const endDay = lateFinish`) | 500/512, exit 1 |
| M1: late grens zonder het mijlpaalmoment | 490/512, exit 1 |
| M2: B6 zonder uitzondering voor MSO/MFO | 472/512, exit 1 |
| M3: her-snap zonder het mijlpaalmoment | 458/512, exit 1 |
| M4: schendingstoets zonder het mijlpaalmoment | 488/512, exit 1 |
| M5: geen uitzondering op de beginwaarde bij het projecteinde | 491/512, exit 1 |
| M5b: uitzondering alleen voor losse mijlpalen (zonder het START-deel) | 509/512, exit 1 |
| M6: harde pin zonder het mijlpaalmoment | 506/512, exit 1 |

## Gewijzigde verwachtingen

Geen. Alle bestaande cases en checks bleven groen zonder aanpassing. Nieuw in `check-hours-f2-review.ts`
(43 → 512 controles), indeling **B3** (gerepareerde fout):

- 18: 24 uur FS+0 onder OPS, P6 en MSP, scalair en expliciet.
- 432: losse START en FINISH, zacht en hard, MSO en MFO, zonder tijd, met de D1/D2-tijd en met 10:00, onder OPS,
  P6 en MSP, op een dag- en een blokkenkalender: vier gelijke momenten, speling nul, geen schending.
- 12: START met zachte en harde MSO di 16:00 blijft op dinsdag.
- 6: START na voorganger met zachte MFO di blijft op di 16:00, speling nul.
- 1: een losse START met SNET houdt B6.

## Controles

Node 24.22.0 (`~/.local/bin`). Typecheck en `measure:profiles` via `flock /tmp/ops-zwaar.lock`.

| Controle | Uitkomst | Exit |
|---|---|---|
| Tegenproef reviewer `blokkeerders.ts` | 5/5 (was 0/5) | 0 |
| Ronde 1 `regressies.ts` | 7 GOED, 0 geschonden | 0 |
| `check-hours-f2-review.ts` | 512/512 | 0 |
| `check-recorded-dates.ts` | 383 | 0 |
| `check-auto-actual-start.ts` | 135/135 | 0 |
| `check-xer-corpusless-fidelity-gate.ts` | 57 | 0 |
| `check-fidelity-cells-gate.ts` | 141 | 0 |
| `check-dcma.ts` | 41 | 0 |
| 33 andere gerichte checks (mijlpalen, 24 uur, conventies, minutenmodel, tutorial, nivelleren, IFC, XER, constraints) | groen | 0 |
| Alle 24 casebatterijen via `run.sh` | 608/608 | 0 |
| F0 minutenmodel run 1 en run 2 | elk 422 dagcases; klopt met `minute-model-runs.json` | 0 / 0 |
| `npm run typecheck` | geen fouten | 0 |
| `npm run lint:fast` | geen fouten | 0 |
| `npm run measure:profiles` (corpus) | P6: `nieuw=0 verslechterd=0 groter=0`, NULDOEL (regel A gehouden); MSP rood, zie hieronder | 1 |

**MSP-deel van `measure:profiles`.** `timephased-cost-rollup.mpp` geeft `finishDiff` 3 (verwacht 0). Dezelfde
drie afwijkingen staan er op `99049810a` zonder deze ronde (`--only=msp`, identieke regels) en al in de
ronde-1-meting van de reviewer.

## Bijvangst (niet hersteld)

- **knownbugs 271** toegevoegd: nachttaak tot za 06:00 krijgt −1 speling bij een gelijk vroeg en laat
  venster (`CPMSolver.ts:1541`, ook op `be58ba356`).
- **Mijlpaal zonder soort mét voorganger en een zachte MFO** (het DCMA-s3-netwerk: P → Q → N, MFO ma): vroeg ma
  16:00, laat ma 07:00, speling −1 op N, zonder schending. Oorzaak: de beginwaarde bij het projecteinde
  (`CPMSolver.ts:3657–3669`). Herstel maakt `check-dcma.ts` s3 "na", want de DCMA-proef maakt de pin zacht in plaats
  van hem weg te halen (`src/engine/reports/dcmaAssessment.ts:196–201`). Met de harde pin heeft Q in het document
  zelf al een dag speling (D2: MFO ma = ma 16:00). Nog geen nummer.
- **START-mijlpaal midden op de dag onder P6 en MSP op een scalaire kalender**, ook zonder constraint (eigen
  anker di 10:00): vroeg di 10:00, laat di 07:00, speling −0,375. Dezelfde beginwaarde bij het projecteinde.
  Nieuw in F2: op de basis rekenden scalaire kalenders in dag-modus. Nog geen nummer.
