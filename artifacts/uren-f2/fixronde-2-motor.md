# F2 — fixronde 2, motor, 23 oktober 2026

Twee BLOKKEERT-punten uit review ronde 2, deel A, zijn hersteld in `CPMSolver.ts`. Op besluit van de
orkestrator zijn daarna nog drie punten hersteld: de zachte en harde MSO/MFO op een losse mijlpaal (punt 3), de
START-mijlpaal midden op de dag onder P6/MSP (punt 4) en de mijlpaal zonder soort na een voorganger met een zachte
MFO (punt 5). Daarna is de laadfix `claude/uren-f2-laden2` gemerged. De tegenproef van de reviewer gaat van 0/5
naar 5/5. Er is geen bestaande verwachting gewijzigd.

Gewijzigd: de motor (`CPMSolver.ts`, `scheduleAnalysis.ts`), één plek in de DCMA-module (`dcmaAssessment.ts`, punt
5) en de F2-reviewcheck. Laadkant, store en hooks zijn niet aangeraakt (de laadfix komt uit een merge).

Werkplek: `.claude/worktrees/uren-f2`, branch `claude/uren-f2-kern`, start op `99049810a`. Commits: `7513d5371`
(punt 1 en 2), `3b4d71571` (punt 3), `ba401e2b2` (punt 4 en 5), `2f9148ee9` (merge laadfix `7876a78b2`), en deze
notitie. Uitgevoerd door Claude Opus 5.5. Deze notitie is opgesteld door een AI-assistent.

## Punt 1 — de 24-uurswacht verliest een dag bij een opvolger

**Oorzaak.** De wacht voor hele dagen in de late pass zocht het dageinde van de kalenderdag van de
opvolgergrens. Zevendaagse kalender 00:00–24:00, A en B elk 1 d, FS+0: de grens is di 00:00. Dat is ook het
geldige einde van maandag. De wacht nam toch dinsdag (einde wo 00:00), en sprong met
`prevWorkInstantBefore(di 00:00)` naar ma 00:00. Zo verdween maandag; laat zo 00:00–ma 00:00, speling −1.

**Fix.** `CPMSolver.ts:3765`: de wacht bepaalt eerst de werkdag aan de eindkant met de bestaande
`workdayDateOfInstant(predCal, lateFinish, 'end')`. Een geldig blokeinde springt niet nog een keer terug.

## Punt 2 — B6 overschrijft een harde mijlpaalpin

**Oorzaak.** Een losse mijlpaal met een harde MSO op di 2 jun kreeg via de pin di 07:00; B6 schoof de vroege kant
daarna naar 16:00. De late pass hield 07:00: speling −1, zonder gemelde schending.

**Fix.** B6 slaat elke mijlpaal met een MSO of MFO over (`CPMSolver.ts:2638`; eerst `!hardFinishPin`, in punt 3
verbreed).

## Punt 3 — zachte en harde MSO/MFO op een losse mijlpaal

**Oorzaak.** Een MSO of MFO op een mijlpaal had aan de vroege en de late kant een ander moment. De late grens en
de schendingstoets namen `snapOnOrBefore` (di 07:00 werd ma 16:00), B6 schoof een zachte MSO naar 16:00, een
START met MFO werd her-gesnapt naar wo 07:00, en een harde MSO op 16:00 ging naar wo 07:00. Op `be58ba356` gaven
dagkalenders geen fout (dag-modus); de blokkenkalender gaf er dezelfde fouten, ook de START met harde MFO zonder
tijd (wo 07:00).

**Fix: één moment per MSO/MFO op een nulduurmijlpaal.** `milestoneConstraintMoment` (`CPMSolver.ts:3008`) geeft
in uur-modus de vroege grens uit de bestaande `forwardBoundOf`. Zonder tijd is dat D1 voor een MSO (07:00) en D2
voor een MFO (16:00); een tijd blijft staan.

| Plek | Regel |
|---|---|
| late grens, zacht | `CPMSolver.ts:3020` (`backwardBoundOf`) |
| harde pin | `CPMSolver.ts:2844` en `:2860` |
| B6 | `CPMSolver.ts:2638` |
| her-snap | `CPMSolver.ts:986` (`snapSuccessorEarlyStart`) |
| schendingstoets | `scheduleAnalysis.ts:423`, via een nieuwe invoer (`CPMSolver.ts:1758`) |

Het open eigenaarspunt (afgemelde mijlpaal zonder pin: B6 16:00 tegen D7 07:00) is niet aangeraakt.

## Punt 4 en 5 — de standaardplaats van de late kant bij het projecteinde

**Uitkomst op `be58ba356`.** Beide speling 0 (scalaire kalender in dag-modus). Nieuw in F2, dus BLOKKEERT.

- Punt 4: onder P6/MSP op een scalaire kalender kreeg een losse START om 10:00 laat 07:00, speling −0,375, ook
  zonder constraint.
- Punt 5: P → Q → N, N zonder soort met een zachte MFO op ma: vroeg ma 16:00, laat ma 07:00, speling −1, zonder
  schending.

**Oorzaak.** De late kant van een START-mijlpaal (en een mijlpaal zonder soort na een FS/SS-voorganger) begint op
een kalender zonder eigen werkblokken op het begin van de projecteinddag (`c6310b941`). Dat houdt het dagmodel
vast: een START op de laatste projectdag heeft speling 0. Staat de mijlpaal later op de dag, dan ligt die late kant
vóór de mijlpaal zelf.

**Fix.** `CPMSolver.ts:3672`: die plaats geldt alleen als de mijlpaal zelf op het eerste blokbegin van zijn
werkdag staat (`isAtDayFirstBandStart`, `CPMSolver.ts:1143`). Dat vervangt de constraint-uitzondering uit punt 3.
Een START op het begin van de laatste projectdag houdt speling 0 (getoetst). Een losse START om 10:00 naast een
taak tot 16:00 krijgt nu 0,625 d speling onder alle profielen; OPS gaf dat vóór deze ronde al.

**DCMA-kritiek-padtest (`dcmaAssessment.ts:202–203`).** De bedoeling staat in het commentaar: "Een VERPLICHTE pin
op de eindtaak gaat in de vergelijkingsruns uit … Zonder pin toetst de test precies de vraag of de logica de
vertraging doorgeeft" (`b440d207a`), en de kandidaatkeuze gebruikt sinds `edfc829cf` die run zonder pin, zodat een
MFO op het einde van een werkdag (D2) de activiteiten geen speling geeft. De code maakte de pin alleen zacht. Een
zachte MFO legt in de motor hetzelfde moment vast; op de blokkenkalender gaf dat al op de basis Q speling 1, en na
punt 5 ook op de scalaire kalender. Daarmee werd `check-dcma` s3 "na". **Aanpassing: de verplichte pin valt in de
vergelijkingsruns weg in plaats van zacht te worden.** Zachte constraints op de eindtaak blijven ongemoeid.
`check-dcma` 41/41, zonder gewijzigde verwachting.

## Vergelijking met mijlpalen mét buren

1.944 netwerken (voorganger, opvolger of beide; drie soorten; zacht en hard; MSO en MFO; drie datums en drie
tijden; OPS, P6, MSP; dag- en blokkenkalender) op `28b028823` en met de eindstand: 544 beter, 44 anders, 0
slechter. De 44 hebben hetzelfde patroon: een zachte MSO op ma terwijl de voorganger de mijlpaal naar di duwt.
Speling −1 en de schending blijven terecht staan; het late moment staat nu op ma 07:00 in plaats van vr 29 mei 16:00.

## Mutatiebewijs

Elke mutatie op een kopie, check gedraaid, teruggezet met `cp` en met `cmp` gecontroleerd.

| Mutatie | Check | Uitkomst |
|---|---|---|
| M0: 24-uurswacht op de kalenderdag | `check-hours-f2-review.ts` | 515/527, exit 1 |
| M1: late grens zonder het mijlpaalmoment | idem | 505/527, exit 1 |
| M2: B6 zonder uitzondering voor MSO/MFO | idem | 487/527, exit 1 |
| M3: her-snap zonder het mijlpaalmoment | idem | 473/527, exit 1 |
| M4: schendingstoets zonder het mijlpaalmoment | idem | 503/527, exit 1 |
| M6: harde pin zonder het mijlpaalmoment | idem | 521/527, exit 1 |
| M7: projecteindplaats ook buiten het dagbegin | idem | 501/527, exit 1 (ook punt 4 en 5) |
| M8: DCMA maakt de pin weer zacht | `check-dcma.ts` | s3 "na", exit 1 |

## Gewijzigde verwachtingen

Geen. Nieuw in `check-hours-f2-review.ts` (43 → 527 controles), indeling **B3** (gerepareerde fout):

- 18: 24 uur FS+0 onder OPS, P6 en MSP, scalair en expliciet.
- 432: losse START en FINISH, zacht en hard, MSO en MFO, zonder tijd, met de D1/D2-tijd en met 10:00, onder OPS,
  P6 en MSP, op een dag- en een blokkenkalender.
- 12: START met zachte en harde MSO di 16:00 blijft op dinsdag.
- 6: START na voorganger met zachte MFO di.
- 12: losse START om 10:00 zonder constraint, en N zonder soort na voorganger met zachte MFO (punt 4 en 5).
- 3: START op het begin van de laatste projectdag houdt speling 0.
- 1: een losse START met SNET houdt B6.

## Merge van de laadfix

`git merge origin/claude/uren-f2-laden2` (`7876a78b2`): geen conflict; `knownbugs.md` heeft nu 271 en 272. Ingang
273 is niet nodig: punt 5 was nieuw in F2 en is hersteld. `npm run i18n:resolve`: exit 0, niets gewijzigd.

## Controles na de merge

Node 24.22.0 (`~/.local/bin`). Typecheck en `measure:profiles` via `flock /tmp/ops-zwaar.lock`.

| Controle | Uitkomst | Exit |
|---|---|---|
| Tegenproef reviewer `blokkeerders.ts` | 5/5 (was 0/5) | 0 |
| Ronde 1 `regressies.ts` | 7 GOED, 0 geschonden | 0 |
| `check-import-datum-zonder-tijd.ts` | 26/26 | 0 |
| `check-minute-model-input.ts` | 35/35 | 0 |
| `check-minute-model-ifc.ts` | 63/63 | 0 |
| `check-hours-f2-review.ts` | 527/527 | 0 |
| `check-recorded-dates.ts` | 383 | 0 |
| `check-dcma.ts` | 41 | 0 |
| `check-auto-actual-start.ts` | 135/135 | 0 |
| Profielvangrails (corpusloze fidelity-gate, cel-baselinepoort) | 57 en 141 | 0 |
| Alle 24 casebatterijen via `run.sh` | 608/608 | 0 |
| F0 minutenmodel run 1 en run 2 | elk 422 dagcases; klopt met `minute-model-runs.json` | 0 / 0 |
| `npm run typecheck` | geen fouten | 0 |
| `npm run lint:fast` | geen fouten | 0 |
| `npm run measure:profiles` (corpus) | P6: `nieuw=0 verslechterd=0 groter=0`, NULDOEL (regel A gehouden); MSP rood, zie hieronder | 1 |

Vóór de merge liepen ook 33 andere gerichte checks groen (mijlpalen, 24 uur, conventies, minutenmodel, tutorial,
nivelleren, IFC, XER, constraints).

**MSP-deel van `measure:profiles`.** `timephased-cost-rollup.mpp` geeft `finishDiff` 3 (verwacht 0). Dezelfde
drie afwijkingen staan er op `99049810a` zonder deze ronde (`--only=msp`, identieke regels) en al in de
ronde-1-meting van de reviewer.

## Bijvangst (niet hersteld)

- **knownbugs 271**: nachttaak tot za 06:00 krijgt −1 speling bij een gelijk vroeg en laat venster
  (`CPMSolver.ts:1541`, ook op `be58ba356`).
