# F2 — fixronde 2, motor, 23 oktober 2026

Twee BLOKKEERT-punten uit review ronde 2, deel A, zijn hersteld in `CPMSolver.ts`. De tegenproef van de
reviewer gaat van 0/5 naar 5/5. Er is geen bestaande verwachting gewijzigd. Alleen de motor en de
F2-reviewcheck zijn aangepast; laadkant, store en hooks zijn niet aangeraakt.

Werkplek: `.claude/worktrees/uren-f2`, branch `claude/uren-f2-kern`, start op `99049810a` (schoon, gelijk met
origin). Fixcommit `7513d5371`. Uitgevoerd door Claude Opus 5.5. Deze notitie is opgesteld door een AI-assistent.

## Punt 1 — de 24-uurswacht verliest een dag bij een opvolger

**Oorzaak.** De wacht voor hele dagen in de late pass zocht het dageinde van de kalenderdag van de
opvolgergrens. Zevendaagse kalender 00:00–24:00, A en B elk 1 d, FS+0: de grens is di 00:00. Dat is ook het
geldige einde van maandag. De wacht nam toch dinsdag (einde wo 00:00), en sprong met
`prevWorkInstantBefore(di 00:00)` naar ma 00:00. Zo verdween maandag. De eindzijdige terugrekening in
`subDuration` maakte daar laat zo 00:00–ma 00:00 van, speling −1.

**Fix.** `src/engine/scheduler/CPMSolver.ts:3734–3737`: de wacht bepaalt eerst de werkdag aan de eindkant met de
bestaande `workdayDateOfInstant(predCal, lateFinish, 'end')`, en zoekt daarop het eerste blokbegin en het laatste
blokeinde. Een geldig blokeinde springt daardoor niet nog een keer terug. Voor een grens midden op de dag of op
een blokbegin blijft de uitkomst gelijk.

**Mutatiebewijs.** `const endDay = lateFinish;` (oude gedrag): `check-hours-f2-review.ts` 85/97, exit 1,
12 rode regels (OPS, P6 en MSP × scalair en expliciet × venster en speling van A). Teruggezet met `cp`; daarna
97/97.

## Punt 2 — B6 overschrijft een harde mijlpaalpin

**Oorzaak.** Een losse START- of FINISH-mijlpaal met een harde MSO op di 2 jun (zonder tijd of 07:00) kreeg
via de pin di 07:00. Daarna schoof B6 de vroege datum naar 16:00. De late pass hield de pin (07:00). Gevolg:
totale en vrije speling −1, zonder gemelde constraintschending.

**Fix.** `src/engine/scheduler/CPMSolver.ts:2627`: B6 geldt alleen zonder `hardFinishPin`. Die waarde rekent de
forward pass al bovenaan per taak uit; ze is alleen gezet bij een harde MSO/MFO. Een losse mijlpaal zonder pin
houdt B6. Het open eigenaarspunt (afgemelde mijlpaal zonder pin: B6 16:00 tegen D7 07:00) is niet aangeraakt.

**Mutatiebewijs.** Zonder `!hardFinishPin &&`: 89/97, exit 1, 8 rode regels (alleen OPS; START en FINISH ×
zonder tijd en 07:00 × moment en speling). P6 en MSP blijven groen, want daar staat B6 uit. Teruggezet met
`cp`; daarna 97/97.

## Gewijzigde verwachtingen

Geen. Alle bestaande cases en checks bleven groen zonder aanpassing. Nieuw in `check-hours-f2-review.ts`
(43 → 97 controles), indeling **B3** (gerepareerde fout):

- 18 controles: 24 uur FS+0 onder OPS, P6 en MSP, scalair en expliciet; venster A en B, speling A nul.
- 36 controles: losse START en FINISH met harde MSO `2026-06-02` en `2026-06-02T07:00` onder OPS, P6 en
  MSP; vier momenten op di 07:00, speling nul, geen constraintschending.

## Controles

Node 24.22.0 (`~/.local/bin`); de kernchecks ook op Node 22.23.4, met dezelfde uitkomst.

| Controle | Uitkomst | Exit |
|---|---|---|
| Tegenproef reviewer `blokkeerders.ts` | 5/5 (was 0/5) | 0 |
| Ronde 1 `regressies.ts` | 7 GOED, 0 geschonden | 0 |
| `check-hours-f2-review.ts` | 97/97 | 0 |
| `check-recorded-dates.ts` | 383 | 0 |
| `check-auto-actual-start.ts` | 135/135 | 0 |
| `check-xer-corpusless-fidelity-gate.ts` | 57 | 0 |
| `check-fidelity-cells-gate.ts` | 141 | 0 |
| Overige gerichte checks (advanced-cpm, calendar-hours, first-start, conventions-registry, conventions-p6-flags, minute-model, -transition, -boundaries, solve-input, tutorial-project, move-project, bar-progress) | groen | 0 |
| Alle 24 casebatterijen via `run.sh` | 608/608 | 0 |
| F0 minutenmodel run 1 | 422 dagcases; klopt met `minute-model-runs.json` | 0 |
| F0 minutenmodel run 2 | 422 dagcases; klopt met `minute-model-runs.json` | 0 |
| `npm run typecheck` | geen fouten | 0 |
| `npm run lint:fast` | geen fouten | 0 |
| `npm run measure:profiles` (corpus) | P6: `nieuw=0 verslechterd=0 groter=0`, status NULDOEL (regel A gehouden); MSP rood, zie hieronder | 1 |

**MSP-deel van `measure:profiles`.** `timephased-cost-rollup.mpp` geeft `finishDiff` 3 (verwacht 0). Dezelfde
drie afwijkingen staan er op `99049810a` zonder deze fix (`--only=msp`, exit 1, identieke regels) en al in de
ronde-1-meting van de reviewer. Ze komen dus niet uit deze ronde.

## Bijvangst (niet hersteld)

- **knownbugs 271** toegevoegd: nachttaak tot za 06:00 krijgt −1 speling bij een gelijk vroeg en laat
  venster (`CPMSolver.ts:1541`, ook op `be58ba356`).
- **Zachte MSO op een losse mijlpaal** (`hard` afwezig; dat is de standaard): onder OPS vroeg di 16:00, laat
  ma 16:00, speling −1 en een gemelde schending. Op `be58ba356` met een dagkalender: speling 0, geen schending.
  Twee oorzaken: (a) de late kant van een zachte MSO op een mijlpaal valt met `snapOnOrBefore` op het vorige
  dageinde (`CPMSolver.ts:2997`); dat gebeurt op de basis al bij een urenkalender en geldt in F2 voor elke
  kalender; (b) B6 schuift de vroege kant naar 16:00. Valt buiten punt 2 (alleen harde pin); voorgelegd aan de
  orkestrator.
