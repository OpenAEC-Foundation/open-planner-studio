# B1c — Etappe 2: de verdeler-kern en de naad-herziening (implementatieplan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De **rekenkern** van B1c bouwen: een pure, headless testbare verdeler die de boeking op één
poolitem over meerdere geopende documenten herverdeelt (spec §4, "Het plaatsingsprotocol"), plus de
**naad-herziening** in `ResourceLeveler.ts` die daarvoor nodig is (spec §4, "De naad in de
nivelleerder"). Leidende bron: `docs/superpowers/specs/2026-08-17-b1c-nivelleren-restcapaciteit-design.md`.
Alle eigenaarsbesluiten staan in §11 van die spec; dit plan wijkt daar nergens van af (de drie plekken
waar het *concretiseert* zijn expliciet gemarkeerd met **KEUZE VAN DIT PLAN**).

**Architecture:** Twee lagen, strikt gescheiden.

1. **`src/engine/scheduler/ResourceLeveler.ts`** blijft de motor die *binnen één document* plaatst.
   Hij krijgt in dit plan vier nieuwe, allemaal **optionele** invoeren (`scopeTaskIds`,
   `overrunCeilingDays`, `poolLedger`, `allowSplits`) en een eerlijkere reden-taxonomie. Zonder die
   invoeren is zijn gedrag **byte-identiek** aan vandaag — dat is de dragende regressie-eis van
   taken 1–9.
2. **`src/services/library/distribute.ts`** (nieuw) is de verdeler: puur, geen store, geen I/O — exact
   het model van `src/services/library/occupancy.ts`. Hij leest de bezetting van één poolitem
   (`computeLibraryOccupancy`), bouwt het gedeelde poolitem-grootboek, en draait de motor
   **document voor document in rangorde**. Richting van de import: `services/library` →
   `engine/scheduler` (bestaat al via `occupancy.ts`); nooit andersom.

**Tech Stack:** TypeScript strict, geen frameworks. Tests als `check-*.ts`-batterijen onder
`tests/planning/` (geregistreerd in `tests/planning/run.sh`) en `tests/library/` (geregistreerd in
`tests/library/run.sh`). De poort is `npm run verify` — oordeel **UITSLUITEND op de exitcode**, nooit
op de tekst "alles groen"; `tests/library/` print zijn faalregels bovendien **ingesprongen**
(`   XX …`), dus `grep '^XX'` is daar structureel blind.

---

## Scope

**In dit plan (etappe 2):**

- De naad-herziening in de nivelleerder: scope-behoud, plafond, kalender ≠ capaciteit, nul-guard in
  de conflictverzamelaar, scanhorizon, reden-taxonomie, injecteerbaar poolitem-grootboek.
- De onderbreek-modus ("Onderbrekingen toestaan") als **plaatsingslogica** in de motor, inclusief het
  herkomstveld op `TaskSplitGap` en zijn IFC-round-trip.
- De verdeler-kern `computeDistribution` — het sequentiële plaatsingsprotocol, twee grootboeken,
  tekorten zonder cascade, pins, plafonds, #63-documenten.
- Drie geparkeerde W0-keuringsbevindingen: **M10** (taak 1), **L3** (taak 2), **scanLimit-horizon**
  (taken 5 en 6).

**NIET in dit plan — dat is etappe 3 (het schrijfpad en het paneel).** Deze grens is hard; een
implementatie-agent die hem overschrijdt maakt etappe 3 onwerkbaar:

| onderwerp | waar het hoort |
|---|---|
| `applyLeveling` scope-behoudend + `splitGaps` schrijven (spec §5, "op drie plekken" — punt 1) | **etappe 3** |
| Het schrijfpad naar slapende documenten (headless scratch-instantie, `createAppStoreContext`) | **etappe 3** |
| Context-bewuste `emitExtensionEvent`, `notify`-randen van de scratch-run (spec §5) | **etappe 3** |
| "Toegepast"-strook + "alles terugdraaien" | **etappe 3** |
| Het paneel: fasestroken, handles, pins, rangordelijst, gereedschapsschakelaar (spec §6/§7) | **etappe 3** |
| De monotone mutatieteller op de store-runtime + voorstel-invalidatie (spec §6a), `resetDocumentScopedUI` | **etappe 3** |
| **i18n voor de nieuwe reden-codes** en alle paneelteksten (14 talen, CLDR-pluralen) | **etappe 3** |
| De gebruikersgids `public/docs/{nl,en}/` + manifest-entry (spec §8) | **etappe 3** |
| De **wiring** van `clearLevelingGaps` op tijdbasis-bewerkingen (spec §4, "Invalidatie") | **etappe 3** |
| MCP-tools voor de verdeler | buiten scope (spec §10) |

**Waarom i18n hier niet in zit** (bewuste keuze, expliciet opschrijven zodat het niet als vergeten
leest): `LevelingDialog.tsx` mapt reden-codes met een if/else-keten en laat een onbekende code
gewoon **zonder uitleg**; een nieuwe code veroorzaakt daar dus geen crash en geen verkeerde tekst,
alleen een ontbrekende toelichtingsregel — strikt beter dan de huidige situatie, waarin een
horizon-uitputting als "onvoldoende capaciteit" wordt weggeschreven. Eén nieuwe sleutel toevoegen
kost daarentegen **veertien** locale-bestanden (`npm run verify:i18n` eist volledigheid t.o.v. `nl`);
die pass hoort bij het paneel, in één keer, in etappe 3.

---

## Context voor wie hier koud instapt

Lees dit vóór taak 1. Alles hieronder is in de huidige code geverifieerd (2026-08-31, ná de
main-merge met taaktypen/duur-eenheden).

- **De motor.** `levelResources` (`src/engine/scheduler/ResourceLeveler.ts`, ~630 regels) is een
  serieel SGS: hij sorteert de actieve taken (priority desc, float asc, ES asc, aanmaakvolgorde),
  kiest telkens de hoogst gesorteerde taak waarvan alle voorgangers geplaatst zijn, berekent haar
  **PF** (precedence-feasible start) met een verse `CPMSolver`-run op een werkkopie, zoekt met
  `findSlot` de eerste dag waarop de dagvraag past, boekt met `bookDemandAt`, en meet de
  `levelingDelay` als afstand PF → geplaatste start. Lees het moduleblok bovenaan dat bestand
  helemaal door voordat je iets aanraakt — de invarianten (verse baseline, ONVERPLAATSBAAR-taken als
  vaste last, ELAPSEDTIME vs. WORKTIME als twee aparte assen) zijn met de hand veroverd en staan er
  uitgeschreven.
- **De gedeelde dagenset.** `occurrenceFor(task, startDate)` geeft de ISO-dagen die de taak
  daadwerkelijk boekt. Sinds de kwaliteitsronde (I5/I6) is dat **één functie voor twee afnemers**:
  `findSlot`s capaciteitscheck én `bookDemandAt`s boeking. Wie hier een tweede dagenset introduceert
  brengt precies de bug terug die die ronde weghaalde.
- **`splitWalk.ts`** (`src/engine/scheduler/splitWalk.ts`, opgeleverd in W0) is de ENE bron voor
  "welke dagen werkt een gesplitste taak": `computeSplitSegments` (Date-grenzen, renderer),
  `splitDayPattern` (werk/gat-blokken in hele werkdagen) en `enumerateTaskWorkDays` (ISO-werkdagen).
  Het moduleblok draagt de H1-as-definitie: `afterMinutes` ligt op MSP's **cumulatieve**
  elapsedWork-as, dus de aspositie ná gat *n* is `afterMinutes + gapMinutes`. Lees dat blok vóór
  taak 8.
- **De bezettingskern.** `computeLibraryOccupancy` (`src/services/library/occupancy.ts`) aggregeert
  per poolitem de boeking van elk geopend document (`OccupancyRow.docs[].dailyLoad`, ISO → eenheden),
  rekent stale documenten **efemeer** door via een injecteerbare rand (`OccupancyEphemeralSolve`), en
  markeert conflictdagen tegen `maxUnitsOn(poolItem, dag)`. Een document dat níét doorgerekend kon
  worden komt terug als `counted: false` — dat is precies het geval dat B1c **blokkeert** (spec §3.1).
- **Na de main-merge.** `TaskTime.durationUnit` (`'days' | 'hours'`) is **verplicht** — elke
  handgebouwde `TaskTime`-fixture moet hem zetten (`durationUnit: 'days'` in de bestaande checks). De
  duur-eenheid bepaalt of `scheduleDuration` (werkdagen) of `durationMinutes` (werkminuten) de
  canonieke bron is. Alles in dit plan werkt **dag-granulair** (`splitDayPattern`,
  `enumerateTaskWorkDays`, `maxUnitsOn` per ISO-dag); zie de v1-grens bij taak 9.
- **De testrunners.** `tests/planning/run.sh` registreert een check met twee regels
  (`XCHECK="$DIR/.x.mjs"` + `if bundle_check "$DIR/check-x.ts" "$XCHECK"; then node "$XCHECK" || STATUS=1; fi`)
  — kopieer het blok rond `LEVELERSPLITSCHECK` (regel ~408). `tests/library/run.sh` is simpeler: één
  regel `run_check check-x` onderaan; dat bestand draait óók `tsc -p tests/library/tsconfig.check.json`
  als eerste stap, dus fixture-typen worden daar hard afgedwongen.

---

## Task 1: M10 — `levelingDelayMinutes` maakt `levelingDelay` een stille no-op

**Bevinding (nu BEVESTIGD, was VERMOED).** `CPMSolver.shiftByLevelingDelay` (regel ~762) toetst
**eerst** `task.levelingDelayMinutes` en pas in de `else`-tak `task.levelingDelay`. Maar:

- `scheduleSlice.applyLeveling` (regel ~254) en `createMcpTransactions.applyLeveling` (regel ~718)
  schrijven **alleen** `levelingDelay`;
- `clearLeveling` (beide varianten) wist **alleen** `levelingDelay`;
- de leveler-baseline `workTasks` (`ResourceLeveler.ts` regel ~187) strípt **alleen**
  `levelingDelay: undefined`.

Gevolg op een `.mpp`-geïmporteerd project (`mppReader.ts` zet `levelingDelayMinutes` zodra
`levelingDelayRaw !== 0`): nivelleren schrijft een delay die de CPM **nooit leest**, "nivellering
wissen" wist niets zichtbaars, en de leveler-baseline is niet delay-vrij — dus zelfs de sorteersleutels
en PF kloppen niet. Pre-existing, los van B1c, maar het raakt exact de code die de rest van dit plan
verbouwt; daarom eerst.

**Files:**
- Modify: `src/state/slices/scheduleSlice.ts` (`applyLeveling`, `clearLeveling`)
- Modify: `src/state/runtime/createMcpTransactions.ts` (`applyLeveling`, `clearLeveling`)
- Modify: `src/engine/scheduler/ResourceLeveler.ts` (`workTasks`-strip)
- Create: `tests/planning/check-leveling-delay-units.ts`
- Modify: `tests/planning/run.sh` (registratie)

- [ ] **Step 1: Schrijf de falende test**

`tests/planning/check-leveling-delay-units.ts`. Helperstijl: kopieer `eq`/`ok` + de `PROJECT_CAL`- en
`task()`-fabrieken letterlijk uit `tests/planning/check-leveler-splits.ts` (inclusief
`durationUnit: 'days'`). Voor het store-deel: kijk hoe `tests/planning/check-move-assignment.ts` de
echte store aanspreekt (`useAppStore.getState()`) en volg dat patroon.

```ts
// check-leveling-delay-units.ts — B1c-plan-2 taak 1 (M10): `levelingDelayMinutes` heeft in
// `CPMSolver.shiftByLevelingDelay` VOORRANG op `levelingDelay`, maar applyLeveling/clearLeveling en
// de leveler-baseline kenden alleen `levelingDelay` — een stille no-op-familie op elk
// `.mpp`-geïmporteerd project. Deze batterij pint alle drie de plekken.

// ── Deel 1 (pure CPM): de voorrang zelf, als vastgelegd gedrag ────────────────────────────────
// Taak T, 1 werkdag, geen relaties, projectstart ma 2026-06-01. Zet BEIDE velden:
//   levelingDelay: 1 (één werkdag)  én  levelingDelayMinutes: 2400 (= 5 werkdagen à 8u)
// `solveProject` moet op 06-08 uitkomen (5 werkdagen later), NIET op 06-02 — dat is de voorrang.
eq('levelingDelayMinutes wint van levelingDelay', tT.time.earlyStart, '2026-06-08');

// ── Deel 2 (leveler-baseline): de strip is compleet ───────────────────────────────────────────
// Twee taken op resource R (cap 1), beide 1 werkdag, beide willen ma 06-01, geen relaties.
// A draagt levelingDelayMinutes 2400 UIT EEN EERDERE nivellering/import. De baseline hoort
// delay-VRIJ te zijn, dus A's PF is 06-01 en de leveler beslist zélf wie wijkt (prioriteit).
// Vóór de fix zag de baseline A op 06-08 staan en verdween het conflict volledig uit beeld.
ok('baseline is delay-vrij: er is een echt conflict en precies één taak wijkt',
   Object.keys(r.delays).length === 1);

// ── Deel 3 (store): applyLeveling/clearLeveling wissen ook de sub-dag-velden ───────────────────
// Bouw via de store één taak met levelingDelayMinutes 2400 + levelingDelayElapsed true.
// applyLeveling({ delays: { T: 2 }, … }) ⇒ levelingDelay 2, levelingDelayMinutes/-Elapsed weg,
// en de aansluitende runCPM plaatst T op PF + 2 WERKdagen (niet + 5).
eq('applyLeveling wist de sub-dag-precisie', tAfter.levelingDelayMinutes, undefined);
eq('applyLeveling wist de elapsed-vlag', tAfter.levelingDelayElapsed, undefined);
eq('de CPM past de NIEUWE delay toe', tAfter.time.earlyStart, '<PF + 2 werkdagen>');
// clearLeveling daarna ⇒ alle drie de velden weg en T staat weer op PF.
eq('clearLeveling wist ook levelingDelayMinutes', tCleared.levelingDelayMinutes, undefined);
```

Registreer de check in `tests/planning/run.sh` (kopieer het `LEVELERSPLITSCHECK`-blok, regel ~408) en
draai:

```bash
bash tests/planning/run.sh 2>&1 | tail -20; echo "exit: ${PIPESTATUS[0]}"
```

Verwacht: **rood** op deel 2 en deel 3 (deel 1 is bestaand gedrag en hoort meteen groen te zijn — is
dat niet zo, stop en meld het: dan is de aanname onder deze taak verkeerd).

- [ ] **Step 2: Implementeer**

`src/engine/scheduler/ResourceLeveler.ts`, de `workTasks`-regel (~187):

```ts
  // De werkkopie is de DELAY-VRIJE baseline. Sinds B1c-plan-2 taak 1 (M10) strippen we ook de
  // sub-dag-precisie: `CPMSolver.shiftByLevelingDelay` toetst `levelingDelayMinutes` VÓÓR
  // `levelingDelay`, dus een `.mpp`-geïmporteerde vertraging zou hier stil in de baseline blijven
  // staan en zowel de sorteersleutels als de PF vervalsen.
  const workTasks: Task[] = tasks.map(t => ({
    ...t,
    levelingDelay: undefined,
    levelingDelayMinutes: undefined,
    levelingDelayElapsed: undefined,
    time: { ...t.time },
  }));
```

`src/state/slices/scheduleSlice.ts`, `applyLeveling`s reset-lus:

```ts
      for (const task of s.tasks) {
        const d = result.delays[task.id];
        task.levelingDelay = d !== undefined && d > 0 ? d : undefined;
        // M10: `CPMSolver.shiftByLevelingDelay` leest `levelingDelayMinutes` VÓÓR `levelingDelay`.
        // Een achtergebleven sub-dag-waarde (uit een `.mpp`-import) zou de zojuist berekende delay
        // stil overrulen — nivelleren zou dan zichtbaar niets doen. De nivelleerder rekent in hele
        // werkdagen, dus de sub-dag-precisie van de VORIGE nivellering vervalt hier bewust.
        task.levelingDelayMinutes = undefined;
        task.levelingDelayElapsed = undefined;
      }
```

`clearLeveling` in dezelfde slice: dezelfde drie velden wissen, én de no-op-guard verbreden:

```ts
      if (!s.tasks.some((t) =>
        t.levelingDelay !== undefined || t.levelingDelayMinutes !== undefined)) return;
```

`src/state/runtime/createMcpTransactions.ts`: exact dezelfde twee wijzigingen in zijn
`applyLeveling`/`clearLeveling` (de snapshot/recompute-vrije varianten) — met een
verwijscommentaar naar de store-variant, zodat de twee niet uit elkaar kunnen lopen.

- [ ] **Step 3: Draai de suites**

```bash
bash tests/planning/run.sh 2>&1 | tail -5; echo "exit: $?"
bash tests/mcp/run.sh 2>&1 | tail -5; echo "exit: $?"
```

Verwacht: exit 0, 0. **Let op de `.mpp`-getrouwheidspoort**: `tests/planning/check-mpp-fidelity.ts`
leest en solvet, hij nivelleert niet — deze wijziging raakt hem niet. Wordt hij tóch rood, stop en
meld het (dan draait er ergens een leveler in dat pad en is dat een bevinding op zich).

- [ ] **Step 4: Commit**

```bash
git add src/state/slices/scheduleSlice.ts src/state/runtime/createMcpTransactions.ts src/engine/scheduler/ResourceLeveler.ts tests/planning/check-leveling-delay-units.ts tests/planning/run.sh
git commit -m "fix(scheduler): nivelleren wist ook de sub-dag-vertraging — geen stille no-op meer (M10)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: `occurrenceFor`-memoisatie (L3)

**Bevinding L3 (uit de W0-keuring).** `findSlot` roept `occurrenceFor(task, cand)` aan voor **elke**
kandidaatdag in de scan, en daarna nog eens voor `snappedPf`; `bookDemandAt` roept hem nóg een keer
aan voor de gekozen dag. Elke aanroep doet een volledige `splitDayPattern` + kalenderwandeling. Op de
schaal die de spec als ondersteund noemt (≈1000 taken, scanLimit in dezelfde orde) is dat de
dominante term in de kwadratische kern — en de verdeler draait de motor **per document**, dus de
kosten vermenigvuldigen zich.

**Files:**
- Modify: `src/engine/scheduler/ResourceLeveler.ts`
- Modify: `tests/planning/check-leveler-splits.ts` (één invariant-case)

- [ ] **Step 1: Implementeer de memo**

In `levelResources`, direct boven `occurrenceFor` (regel ~248):

```ts
  // L3 (W0-keuring): `occurrenceFor` wordt in de kandidaat-scan van `findSlot` per kandidaatdag
  // opnieuw berekend, en daarna nóg eens door `bookDemandAt` voor de gekozen dag — telkens een
  // volledige `splitDayPattern` + kalenderwandeling. Het antwoord hangt uitsluitend af van
  // (taak, startdag) en beide zijn binnen één `levelResources`-aanroep onveranderlijk, dus
  // memoiseren is zuiver. UITZONDERING: de onderbreek-modus (taak 9 van dit plan) kent een taak
  // NIEUWE `splitGaps` toe tijdens de run — die MOET daarna `occCache.delete(...)` voor die taak
  // doen; zie de aanroepplek daar.
  const occCache = new Map<string, string[]>();
```

en wikkel de bestaande body:

```ts
  const occurrenceFor = (task: Task, startDate: Date): string[] => {
    if (isNaN(startDate.getTime())) return []; // niet cachen: geen sleutel te maken (I4-precedent)
    const key = `${task.id}|${formatDate(startDate)}`;
    const hit = occCache.get(key);
    if (hit) return hit;
    const result = computeOccurrence(task, startDate);
    occCache.set(key, result);
    return result;
  };
  const computeOccurrence = (task: Task, startDate: Date): string[] => {
    /* … de bestaande body, ONGEWIJZIGD, minus de isNaN-guard die nu boven staat … */
  };
```

Let op de volgorde van declaraties: `computeOccurrence` is een `const`-arrow, dus hij moet **boven**
`occurrenceFor` staan (of allebei `function`-declaraties worden). Kies de vorm die de bestaande stijl
van het bestand het minst geweld aandoet — de rest van de lokale helpers zijn `const`-arrows, dus:
eerst `computeOccurrence`, dan `occurrenceFor`.

- [ ] **Step 2: Pin de invariant**

Voeg achteraan in `tests/planning/check-leveler-splits.ts`, in de stijl van de bestaande gevallen, één
geval toe dat de memo **inhoudelijk** bewaakt (niet de snelheid — dat is geen poort):

```ts
// ── B1c-plan-2 taak 2 (L3): memoisatie van `occurrenceFor` is ZUIVER ─────────────────────────────
// Twee identieke `levelResources`-aanroepen op dezelfde (niet-gemuteerde) invoer moeten
// byte-identieke resultaten geven — de cache mag nooit tussen taken of tussen startdagen lekken.
// Bewust een fixture MET een gesplitste taak én een taak op een afwijkende kalender: dat zijn de
// twee gevallen waarin de dagenset per taak verschilt, dus waarin een verkeerde cachesleutel
// (bv. alleen de datum, zonder taak-id) meteen zichtbaar wordt.
eq('memo-zuiverheid: twee identieke runs, identiek resultaat',
   JSON.stringify(levelResources(...args)), JSON.stringify(levelResources(...args)));
```

Bouw `args` uit de al bestaande fixtures van dat bestand (case 1 gebruikt een gesplitste taak, het
zesdaagse geval een afwijkende taakkalender — combineer die twee in één takenlijst).

- [ ] **Step 3: Draai en zie groen**

```bash
bash tests/planning/run.sh 2>&1 | tail -5; echo "exit: $?"
```

Verwacht: exit 0 — **alle 25 cases in `cases-resource-leveling.json` inbegrepen**. Wordt daar iets
rood, dan is de cachesleutel fout (vrijwel zeker: taak-id vergeten); repareer de sleutel, pas nooit
een verwachting aan.

- [ ] **Step 4: Commit**

```bash
git add src/engine/scheduler/ResourceLeveler.ts tests/planning/check-leveler-splits.ts
git commit -m "perf(scheduler): memoiseer de dagenset per (taak, startdag) in de nivelleerder (L3)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: scope-behoudend nivelleren (`scopeTaskIds`)

**Spec §5, "Scope-behoudend toepassen — op drie plekken".** Twee van de drie plekken zitten in de
motor en horen hier: (a) de interne strip in `levelResources` (`workTasks`) en (b) de baseline waarop
het plafond straks rekent (taak 4). De derde plek — de reset-lus in `applyLeveling` — is schrijfpad en
hoort in **etappe 3**; zolang de verdeler niets schrijft is er geen inconsistentie.

De spec eist hier expliciet één validatie: *"het implementatieplan valideert expliciet dat `computePF`
met behouden out-of-scope-delays overweg kan"*. Dat is stap 3 hieronder.

**Files:**
- Modify: `src/engine/scheduler/ResourceLeveler.ts`
- Create: `tests/planning/check-leveler-scope.ts`
- Modify: `tests/planning/run.sh` (registratie)

- [ ] **Step 1: Schrijf de falende test**

`tests/planning/check-leveler-scope.ts`, helperstijl gekopieerd uit `check-leveler-splits.ts`:

```ts
// check-leveler-scope.ts — B1c-plan-2 taak 3: `scopeTaskIds` begrenst WAT er genivelleerd wordt.
// Taken buiten de scope houden hun bestaande `levelingDelay` en tellen als VASTE LAST — precies wat
// de verdeler nodig heeft om per poolitem te nivelleren zonder de rest van het document te
// herschikken (spec §5, "scope-behoudend toepassen").
//
// Fixture: resource R (cap 1). Taak A (prio 500, 1 wd, ES ma 06-01) draagt AL `levelingDelay: 2`
// uit een eerdere nivellering ⇒ zij staat feitelijk op wo 06-03. Taak B (prio 500, 1 wd, ES
// wo 06-03, aanmaakvolgorde ná A) vraagt dezelfde dag. Scope = alleen B.

const r = levelResources(tasks, [], [R], assigns, PROJECT_CAL, [], cpmStub,
  { constrainToFloat: false, scopeTaskIds: ['B'] });

ok('A houdt haar delay: geen delay-vermelding voor A in het resultaat', r.delays['A'] === undefined);
eq('B wijkt om A heen — A stond op 06-03, dus B krijgt delay 1', r.delays['B'], 1);
// Zonder scope-behoud zou A's delay in de baseline weggestript zijn, stond A op 06-01, en had
// B GEEN delay nodig gehad. Dat is precies de regressie die deze case pint:
const rNoScope = levelResources(/* … zelfde invoer, ZONDER scopeTaskIds … */);
ok('controle: zonder scope levert dezelfde fixture een ANDER (delay-vrij-baseline) antwoord',
   JSON.stringify(rNoScope.delays) !== JSON.stringify(r.delays));

// Tweede geval — `computePF` met behouden out-of-scope-delay (de spec-validatieplicht):
// C (buiten scope, delay 3) → FS → D (binnen scope). D's PF MOET C's verschoven einde volgen,
// niet C's ongenivelleerde einde.
eq('PF van een opvolger volgt de BEHOUDEN delay van zijn voorganger',
   r2.shifts['D']?.newStart, '<C.ES + 3 werkdagen + 1 werkdag>');
```

Registreer in `run.sh` en draai; verwacht rood (`scopeTaskIds` bestaat nog niet ⇒ typefout/bundelfout,
exit ≠ 0).

- [ ] **Step 2: Implementeer**

`LevelingOptions` uitbreiden:

```ts
  /** Alleen deze taken mogen (opnieuw) genivelleerd worden. Taken BUITEN de scope behouden hun
   *  bestaande `levelingDelay`/`splitGaps` en tellen mee als VASTE LAST op hun huidige, genivelleerde
   *  positie — ze worden nooit verschoven en verschijnen nooit in `delays`. Afwezig ⇒ alle taken
   *  (byte-identiek met het gedrag van vóór B1c-etappe-2).
   *
   *  Waarom dit bestaat (spec §5): de verdeler nivelleert per POOLITEM. De taken die niets met dat
   *  poolitem te maken hebben moeten precies blijven staan waar ze staan — anders lost B1c een
   *  bibliotheekconflict op door het hele document te herschikken. */
  scopeTaskIds?: string[];
```

In `levelResources`:

```ts
  // Scope (B1c-plan-2 taak 3). `null` = alles in scope; dat is het bestaande gedrag.
  const scope = options.scopeTaskIds ? new Set(options.scopeTaskIds) : null;
  const inScope = (id: string): boolean => scope === null || scope.has(id);
```

1. **De strip wordt selectief** (regel ~187, en dus óók de M10-velden uit taak 1):

```ts
  const workTasks: Task[] = tasks.map(t => inScope(t.id)
    ? { ...t, levelingDelay: undefined, levelingDelayMinutes: undefined, levelingDelayElapsed: undefined, time: { ...t.time } }
    : { ...t, time: { ...t.time } }); // buiten scope: delay BEHOUDEN — die is nu vaste last
```

2. **De indeling verandert** (de lus die `movableIds`/`pinnedIds`/`fixedLoadIds` vult, regel ~301).
   Een taak buiten de scope is nóg strenger dan vastgepind: ze schuift niet, ze volgt geen
   voorgangers, ze boekt op haar eigen (behouden) baselinepositie:

```ts
  for (const t of tasks) {
    if (!hasDemand(t.id)) continue;
    if (!inScope(t.id)) { fixedLoadIds.push(t.id); continue; }  // buiten scope — vóór alle andere checks
    if (isImmovableTask(t)) { fixedLoadIds.push(t.id); continue; }
    if (t.priority === 1000) pinnedIds.push(t.id);
    else movableIds.push(t.id);
  }
```

   `fixedLoadIds` boekt al op `baseEs(id)` — en `baseEs` komt uit de baseline-solve op `workTasks`,
   die de behouden delay nu meeneemt. Daarmee klopt de boekingspositie vanzelf; schrijf dat als
   commentaar bij de `fixedLoadIds`-lus, want het is een niet-vanzelfsprekende koppeling.

3. **`shifts` blijft over álle taken lopen** (ongewijzigd): de preview moet ook meeschuivende
   niet-gescopete opvolgers tonen. `delays` bevat per constructie alleen gescopete taken, want alleen
   die lopen door de eligibility-lus.

- [ ] **Step 3: Valideer `computePF` (spec-plicht) en draai**

```bash
bash tests/planning/run.sh 2>&1 | tail -8; echo "exit: $?"
```

Verwacht: exit 0. De tweede case van stap 1 **ís** de gevraagde validatie: `computePF` draait de
`CPMSolver` op `workTasks`, en die dragen nu out-of-scope-delays; de solver past ze toe via
`shiftByLevelingDelay` en propageert ze naar opvolgers. Draait die case groen, dan is de spec-vraag
beantwoord — noteer dat in het docblok van `computePF`.

- [ ] **Step 4: Commit**

```bash
git add src/engine/scheduler/ResourceLeveler.ts tests/planning/check-leveler-scope.ts tests/planning/run.sh
git commit -m "feat(scheduler): scopeTaskIds — nivelleren binnen een scope, delays daarbuiten blijven vaste last (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: plafond per document (`overrunCeilingDays`) + de deadline-reden

**Spec §4, "Plafond-referentiepunt"** en **§6**: het plafond "maximale uitloop van de einddatum =
X werkdagen" wordt door de motor vertaald naar een per-taak-venster `lateStart + X`, berekend op een
baseline die de bestaande delays behoudt (dat is taak 3). **Plafond 0** betekent: einddatum vast, maar
binnen de float mag de motor werken — dat is per constructie exact het bestaande
`constrainToFloat`-venster (`lateStart`). Deadlines en backward-constraints kunnen een plafond
onhaalbaar maken vóórdat het bereikt is; dat krijgt een **eigen reden**, geen generiek
capaciteitstekort.

**Files:**
- Modify: `src/engine/scheduler/ResourceLeveler.ts`
- Create: `tests/planning/check-leveler-ceiling.ts`
- Modify: `tests/planning/run.sh` (registratie)

- [ ] **Step 1: Schrijf de falende test**

```ts
// check-leveler-ceiling.ts — B1c-plan-2 taak 4: het uitloop-plafond als per-taak-venster.
//
// Geval 1 — plafond 0 == constrainToFloat. Zelfde fixture, twee aanroepen, identiek resultaat.
eq('plafond 0 gedraagt zich als constrainToFloat',
   JSON.stringify(levelResources(..., { constrainToFloat: false, overrunCeilingDays: 0 })),
   JSON.stringify(levelResources(..., { constrainToFloat: true })));

// Geval 2 — plafond N laat precies N werkdagen uitloop toe. Resource R cap 1; taak A (prio 900,
// 3 wd) bezet ma-wo; taak B (prio 100, 1 wd, ES ma, lateStart ma ⇒ float 0) moet 3 werkdagen wijken.
// Met plafond 2 past dat NIET (venster = lateStart + 2 = wo), met plafond 3 wél.
ok('plafond 2 ⇒ B onopgelost', r2.unresolved['B']?.length > 0);
eq('plafond 2 ⇒ reden CEILING_TOO_TIGHT', r2.unresolvedReasons['B'], 'CEILING_TOO_TIGHT');
eq('plafond 3 ⇒ B past precies', r3.delays['B'], 3);
ok('plafond 3 ⇒ geen onopgelost conflict', Object.keys(r3.unresolved).length === 0);

// Geval 3 — deadline/backward-constraint maakt het plafond onbereikbaar. Taak C heeft een
// FINISH_NO_LATER_THAN-constraint (of `deadline`) die haar lateStart VÓÓR haar PF duwt: zelfs met
// een ruim plafond ligt het hele venster achter de rug vóór de scan begint. Uitloop geven helpt
// dan niet — dat moet als eigen reden terugkomen, niet als "onvoldoende capaciteit".
eq('onbereikbaar plafond door constraint ⇒ eigen reden',
   r4.unresolvedReasons['C'], 'CEILING_UNREACHABLE');
```

Bouw geval 3 met de bestaande constraint-velden (zoek in `cases-resource-leveling.json` en
`src/types/task.ts` hoe een `constraintType`/`constraintDate`/`deadline` op een taak gezet wordt, en
kies de variant die `lateStart` daadwerkelijk naar voren trekt — verifieer met een kale
`solveProject` dat de baseline-`lateStart` vóór de PF ligt vóórdat je de leveler aanroept).

Registreer in `run.sh`, draai, verwacht rood (optie bestaat niet).

- [ ] **Step 2: Implementeer**

`LevelingOptions`:

```ts
  /** Maximale uitloop van de projecteinddatum, in werkdagen t.o.v. de HUIDIGE (mét bestaande
   *  nivellering berekende) planning — spec §4, "Plafond-referentiepunt". De motor vertaalt dit naar
   *  een per-taak-venster `lateStart + N` op de TAAKkalender (ELAPSEDTIME: kalenderdagen, zelfde as
   *  als `shiftByLevelingDelay`). `0` ⇒ identiek aan `constrainToFloat: true`: de einddatum staat
   *  vast maar de float mag benut worden. Afwezig ⇒ onbegrensd (bestaand leveling-gedrag).
   *  Staat `constrainToFloat` óók aan, dan wint het STRENGSTE venster. */
  overrunCeilingDays?: number;
```

`LevelingReason` uitbreiden (twee nieuwe leden; laat de bestaande drie ongemoeid):

```ts
export type LevelingReason =
  | 'CALENDAR_MISMATCH' | 'INSUFFICIENT_CAPACITY' | 'INTRINSIC_OVERRUN'
  /** Het uitloop-plafond laat te weinig ruimte: binnen `lateStart + plafond` is geen venster vrij. */
  | 'CEILING_TOO_TIGHT'
  /** Uitloop geven helpt hier niet: een deadline/backward-constraint duwt het venster vóór de
   *  precedence-feasible start — de taak kan zelfs zónder capaciteitsdruk niet binnen het plafond. */
  | 'CEILING_UNREACHABLE';
```

In de hoofdlus vervangt dit de bestaande `ls`-berekening (regel ~434):

```ts
      // Vensterbovengrens: het strengste van (a) de float (constrainToFloat) en (b) het
      // uitloop-plafond (`lateStart + N`). Beide op de VERSE baseline-lateStart (A2), dus mét de
      // behouden out-of-scope-delays uit taak 3 — dat is precies het referentiepunt dat de spec
      // eist ("t.o.v. de huidige opgeslagen projecteinddatum, mét bestaande nivellering").
      const limit = windowLimit(pick);
      const slot = findSlot(pick, pf, limit);
```

met de helper naast `nextCandidateFor` (regel ~160):

```ts
  const windowLimit = (id: string): Date | null => {
    const ls = parseDate(baseLs(id));
    const ceilingDays = options.overrunCeilingDays;
    if (ceilingDays === undefined) return options.constrainToFloat ? ls : null;
    const t = taskById.get(id)!;
    const ceiling = t.time.durationType === 'ELAPSEDTIME'
      ? addCalendarDays(ls, ceilingDays)
      : engineForTask(t).addWorkingDaysSigned(ls, ceilingDays);
    // Beide aan ⇒ het strengste venster wint.
    return options.constrainToFloat && ls < ceiling ? ls : ceiling;
  };
```

In `findSlot` verandert alleen de **reden**, niet de scanlogica (de `if (ls && next > ls) break;`-tak
blijft letterlijk staan; hernoem de parameter naar `limit` voor leesbaarheid). Vóór de scan:

```ts
    // CEILING_UNREACHABLE (spec §4): staat er een plafond, en ligt de EERSTE kandidaat er al
    // voorbij, dan is het venster leeg vóórdat capaciteit ook maar geraadpleegd is — de binder is
    // dan een deadline/backward-constraint (die drukt `lateStart` naar voren), niet de capaciteit.
    // Bewust ALLEEN bij een expliciet plafond: met kaal `constrainToFloat` is `pf > ls` bestaand,
    // getest gedrag (de eerste kandidaat wordt altijd geprobeerd) en dat blijft byte-identiek.
    const ceilingSet = options.overrunCeilingDays !== undefined;
    const ceilingUnreachable = ceilingSet && limit !== null && nextCandidateFor(task, pf) > limit;
```

en in de reden-keuze aan het eind van `findSlot`: geef `ceilingUnreachable` en `ceilingSet` door aan
`reasonFor`, dat zijn volgorde krijgt:

```ts
  function reasonFor(byRes, calendarFeasibleSeen, ceilingSet, ceilingUnreachable): LevelingReason {
    // 1. Intrinsiek blijft altijd bovenaan: dan helpt geen enkele plaatsing.
    for (const [resId, arr] of byRes) { … 'INTRINSIC_OVERRUN' … }
    // 2. Een leeg venster door een constraint gaat vóór de kalender/capaciteit: het is het enige
    //    geval waarin de gebruiker iets anders moet doen dan plafond of capaciteit bijstellen.
    if (ceilingUnreachable) return 'CEILING_UNREACHABLE';
    if (!calendarFeasibleSeen) return 'CALENDAR_MISMATCH';
    if (ceilingSet) return 'CEILING_TOO_TIGHT';
    return 'INSUFFICIENT_CAPACITY';
  }
```

- [ ] **Step 3: Draai**

```bash
bash tests/planning/run.sh 2>&1 | tail -5; echo "exit: $?"
```

Verwacht: exit 0 — de 25 bestaande leveling-cases zetten geen `overrunCeilingDays`, dus die zijn
byte-identiek. Wordt er tóch iets rood: eerst begrijpen, dan pas (mét commentaar) bijstellen.

- [ ] **Step 4: Commit**

```bash
git add src/engine/scheduler/ResourceLeveler.ts tests/planning/check-leveler-ceiling.ts tests/planning/run.sh
git commit -m "feat(scheduler): uitloop-plafond als per-taak-venster, met eigen reden bij een blokkerende constraint (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: naad-hygiëne — kalender ≠ capaciteit, nul-guard, eerlijke horizon

**Spec §4, "De naad in de nivelleerder"**, drie van de vier punten. Ze zijn nú al fout (los van elk
restprofiel) en moeten vóór de grootboek-injectie recht staan, anders bouwt taak 6 op een verkeerde
diagnose.

1. **`calendarOk` verwart kalender met capaciteit.** Hij toetst `capacityOf(...) <= 0` en
   `capacityOf` is `isWorkDay ? maxUnitsOn : 0`. Een resource met `maxUnits: 0` (of een
   `availabilityStep` naar 0) op een werkdag wordt zo als *kalender-onhaalbaar* gerapporteerd —
   "de resource werkt niet op alle dagen die deze taak nodig heeft" — terwijl hij gewoon geen
   capaciteit heeft. Met een restprofiel (taak 6) is 0 zelfs de **normale** waarde van een volle dag.
2. **De conflictverzamelaar mist de nul-guard die `fits` wél heeft.** `fits` slaat `arr[i] <= 0` over;
   de verzamelaar (`findSlot`, regel ~562) niet. Bij een curve met een nul-dag, of straks bij een
   geklemd restprofiel van 0, rapporteert hij dan een dag zonder vraag als conflictdag.
3. **`scanLimit` is een ondergrens-argument geworden.** Het moduleblok bij `scanLimit` (regel ~343,
   L4) schrijft dat al uit: sinds de ELAPSEDTIME-kalenderdag-as en de gesplitste taken is
   `totalWork + 10` geen exacte garantie meer. Loopt de scan leeg, dan meldt de motor vandaag
   "onvoldoende capaciteit" — een verzonnen diagnose. Dat wordt een eigen, eerlijke reden.

**Files:**
- Modify: `src/engine/scheduler/ResourceLeveler.ts`
- Create: `tests/planning/check-leveler-seam.ts`
- Modify: `tests/planning/run.sh` (registratie)

- [ ] **Step 1: Schrijf de falende test**

```ts
// check-leveler-seam.ts — B1c-plan-2 taak 5: de meelezers van `capacityOf` stellen een EERLIJKE
// diagnose. Drie gevallen, alle drie vandaag fout (spec §4, "De naad in de nivelleerder").

// ── Geval 1: nul CAPACITEIT is geen kalender-mismatch ────────────────────────────────────────────
// Resource R op de gewone ma-vr-kalender, maar met `availabilitySteps` die maxUnits vanaf 06-01
// op 0 zetten (en pas ver voorbij de scanhorizon weer op 1). Taak A vraagt 1/dag.
// De resource WERKT op die dagen — hij heeft alleen niets te bieden.
ok('geen slot', r1.unresolved['A']?.length > 0);
ok('reden is NIET CALENDAR_MISMATCH', r1.unresolvedReasons['A'] !== 'CALENDAR_MISMATCH');
eq('reden is de eerlijke horizon-uitputting', r1.unresolvedReasons['A'], 'NO_WINDOW_IN_HORIZON');

// ── Geval 2: een ECHTE kalender-mismatch blijft CALENDAR_MISMATCH ────────────────────────────────
// Resource R op een kalender die alleen zaterdag werkt; taak A op de ma-vr-projectkalender.
eq('echte mismatch blijft herkend', r2.unresolvedReasons['A'], 'CALENDAR_MISMATCH');

// ── Geval 3: nul-guard in de conflictverzamelaar ─────────────────────────────────────────────────
// Taak met een curve die op dag 1 nul eenheden legt (FRONT_LOADED op een lange duur levert
// nul-dagen aan de staart; kies een fixture waarin distributeUnits aantoonbaar een 0 bevat —
// assert dat eerst) en een resource die op precies die nul-dag geen capaciteit heeft.
// Die dag mag NIET in `unresolved` staan: er is niets te boeken, dus niets te botsen.
ok('geen fantoom-conflictdag op een dag zonder vraag', !r3.unresolved['A']?.includes('<de nul-dag>'));
```

Registreer in `run.sh`, draai, verwacht rood op geval 1 en geval 3.

- [ ] **Step 2: Implementeer**

**(a) Kalender los van capaciteit.** Naast `capacityOf` (regel ~165):

```ts
  /** Werkt de resource op die dag volgens ZIJN kalender? Puur de kalender-uitlijning, ONGEACHT hoeveel
   *  eenheden hij die dag te bieden heeft (spec §4: met een restprofiel is 0 de normale waarde van
   *  een volle dag, en ook zonder restprofiel is `maxUnits: 0` een capaciteits- en geen
   *  kalenderprobleem). `capacityOf` hieronder blijft de gecombineerde waarde — die is voor `fits`
   *  precies goed. */
  const isResWorkDay = (resId: string, iso: string): boolean => {
    const eng = engineByRes.get(resId);
    return !!eng && eng.isWorkDay(parseDate(iso));
  };
```

en `calendarOk` gebruikt hem:

```ts
        if (i >= occ.length) return false;
        if (!isResWorkDay(resId, occ[i])) return false;
```

**(b) Nul-guard in de conflictverzamelaar** (regel ~562), spiegel `fits` letterlijk:

```ts
      for (let i = 0; i < arr.length && i < occ.length; i++) {
        if (arr[i] <= 0) continue; // zelfde guard als `fits` — een dag zonder vraag kan niet botsen
        if (bookedOn(resId, occ[i]) + arr[i] > capacityOf(resId, occ[i]) + EPS) conflicts.push(occ[i]);
      }
```

**(c) Eerlijke horizon.** `LevelingReason` krijgt er één lid bij:

```ts
  /** De kandidaat-scan liep leeg vóórdat er een passend venster gevonden was. Sinds C1/C2 is
   *  `scanLimit` een ONDERGRENS-argument (zie het blok bij `scanLimit`), dus dit is een reële
   *  uitkomst en geen "onvoldoende capaciteit" — de motor weet simpelweg niet of er verderop nog
   *  ruimte is. */
  | 'NO_WINDOW_IN_HORIZON'
```

In `findSlot`: de loop-uitgang onderscheiden. Vandaag is `while (guard++ < scanLimit)`; die valt door
zowel bij horizon-uitputting als (via `break`) bij het venster. Maak het expliciet:

```ts
    let horizonExhausted = true;   // wordt false zodra we via een `break` (venstergrens) uitstappen
    while (guard++ < scanLimit) {
      …
      const next = nextCandidateAfterFor(task, cand);
      if (limit && next > limit) { horizonExhausted = false; break; }
      cand = next;
    }
```

en in `reasonFor` komt de nieuwe reden **ná** de kalender-check en **vóór** het capaciteitsvangnet
(de volgorde uit taak 4, uitgebreid):

```ts
    if (ceilingUnreachable) return 'CEILING_UNREACHABLE';
    if (!calendarFeasibleSeen) return 'CALENDAR_MISMATCH';
    if (ceilingSet) return 'CEILING_TOO_TIGHT';       // venster bekend en te krap ⇒ concreter dan horizon
    if (horizonExhausted) return 'NO_WINDOW_IN_HORIZON';
    return 'INSUFFICIENT_CAPACITY';
```

Werk het `scanLimit`-blokcommentaar (regel ~343) bij: de L4-alinea eindigt nu niet meer met "vergroot
de marge", maar met "een uitputting is sinds B1c-etappe-2 een eigen, gerapporteerde uitkomst
(`NO_WINDOW_IN_HORIZON`) in plaats van een verzonnen capaciteitsdiagnose; de marge vergroten blijft
de reparatie wanneer een uitputting *onterecht* optreedt".

Werk óók de tool-tekst in `src/services/mcp/tools/calendarResourceTools.ts` (regel ~1290) bij: de
opsomming van reden-codes noemt er drie en er zijn er nu zes. Plain Dutch string, geen i18n.

- [ ] **Step 3: Draai**

```bash
bash tests/planning/run.sh 2>&1 | tail -8; echo "exit: $?"
bash tests/mcp/run.sh 2>&1 | tail -5; echo "exit: $?"
```

Verwacht: exit 0, 0. **Verwachte struikelplek:** een bestaande case in
`cases-resource-leveling.json` of `tests/mcp/` die vandaag `CALENDAR_MISMATCH` verwacht terwijl de
oorzaak in werkelijkheid nul *capaciteit* is. Wordt zo'n case rood, controleer eerst welke van de twee
het echt is (kijk naar de resource-kalender vs. zijn `maxUnits`/`availabilitySteps`); is het capaciteit,
dan is de nieuwe uitkomst de juiste en wordt de verwachting bijgewerkt **mét een commentaarregel die
zegt waarom**. Pas nooit blind aan.

- [ ] **Step 4: Commit**

```bash
git add src/engine/scheduler/ResourceLeveler.ts src/services/mcp/tools/calendarResourceTools.ts tests/planning/check-leveler-seam.ts tests/planning/run.sh
git commit -m "fix(scheduler): kalender-haalbaarheid los van capaciteit, nul-guard en eerlijke horizon-reden (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: het poolitem-grootboek — injecteerbare restcapaciteit

**Spec §4, plaatsingsprotocol punt 2**: *"Er zijn twee grootboeken, want de motor toetst per
`resourceId` en de bibliotheekvraag leeft per poolitem: (a) de bestaande per-resource-toets tegen de
eigen projectinzet … én (b) een gedeeld poolitem-grootboek met `maxUnitsOn(poolitem, dag) −
vasteLast(dag) − Σ boekingen van reeds geplaatste documenten(dag)`, geklemd op minimaal 0. Een dag
past alleen als béíde toetsen slagen."* Dat is exact hetzelfde als de `min(projectinzet,
poolrest)`-formulering elders in §4 — schrijf dat als commentaar op, zodat een lezer de twee
formuleringen niet als tegenspraak leest.

En punt 3: *"kan een taak binnen plafond en profiel niet geplaatst worden, dan wordt zijn vraag
**niet** in het poolitem-grootboek geboekt maar als tekort per document geregistreerd; het restprofiel
blijft ≥ 0."*

**Files:**
- Modify: `src/engine/scheduler/ResourceLeveler.ts`
- Create: `tests/planning/check-leveler-pool-ledger.ts`
- Modify: `tests/planning/run.sh` (registratie)

- [ ] **Step 1: Schrijf de falende test**

```ts
// check-leveler-pool-ledger.ts — B1c-plan-2 taak 6: een injecteerbaar poolitem-grootboek naast de
// bestaande per-resource-toets (spec §4, "twee grootboeken"). De test bouwt het grootboek met de
// hand (een Map met dagcapaciteiten) — de verdeler doet dat straks uit `computeLibraryOccupancy`.

// ── Geval 1: BEIDE toetsen moeten slagen ─────────────────────────────────────────────────────────
// Projectresource R met maxUnits 5 (ruim), poolitem P met restprofiel 1/dag. Taak A vraagt 2/dag.
// De projecttoets slaagt overal, de pooltoets nergens ⇒ geen slot binnen de horizon.
eq('pool blokkeert waar het project ruimte heeft', r1.delays['A'], undefined);
eq('reden: restcapaciteit vol', r1.unresolvedReasons['A'], 'RESIDUAL_FULL');

// ── Geval 2: het omgekeerde — de PROJECTinzet blokkeert ──────────────────────────────────────────
// R maxUnits 1, poolrest 99. Twee taken van 1/dag die dezelfde dag willen: de tweede wijkt, en de
// reden is de gewone INSUFFICIENT_CAPACITY — NIET RESIDUAL_FULL.
eq('projectinzet blokkeert ⇒ gewone capaciteitsreden', r2.unresolvedReasons['B'], 'INSUFFICIENT_CAPACITY');

// ── Geval 3: twee gestempelde resources in ÉÉN document trekken van HETZELFDE grootboek ──────────
// R1 en R2 hangen allebei aan poolitem P (restprofiel 1/dag), elk met ruime eigen maxUnits.
// Taak A boekt 1/dag op R1, taak B boekt 1/dag op R2, beide willen ma. Zonder gedeeld grootboek
// zou dat "passen" (elke resource heeft ruimte); mét gedeeld grootboek wijkt B één dag.
eq('gedeeld grootboek: geen dubbeltelling', r3.delays['B'], 1);

// ── Geval 4: een NIET-geplaatste taak boekt NIET in het poolgrootboek ─────────────────────────────
// Poolrest 1/dag; taak A (prio 900, 1/dag) past, taak B (prio 100, vraagt 5/dag ⇒ past nooit) niet.
// Na de run moet het grootboek op de betrokken dag exact 1 geboekt hebben (van A), niet 6.
eq('geen boeking voor een niet-plaatsbare taak', ledger.bookedOn('P', '2026-06-01'), 1);
ok('en dus geen negatief restprofiel', ledger.residualOn('P', '2026-06-01') >= 0);
```

Registreer in `run.sh`, draai, verwacht rood (de optie bestaat niet).

- [ ] **Step 2: Implementeer**

Nieuw geëxporteerd contract in `ResourceLeveler.ts`, boven `LevelingOptions`:

```ts
/**
 * Het GEDEELDE poolitem-grootboek (spec §4, "twee grootboeken"). De motor toetst per `resourceId`
 * tegen de eigen projectinzet; dit grootboek voegt de tweede toets toe: de restcapaciteit van het
 * BIBLIOTHEEK-poolitem waaraan de resource via zijn `libraryOrigin`-stempel hangt.
 *
 * "Beide toetsen moeten slagen" is identiek aan de `min(projectinzet, poolrest)`-formulering elders
 * in de spec — twee schrijfwijzen van dezelfde regel, geen tegenspraak.
 *
 * De implementatie hiervan woont bij de aanroeper (de verdeler, `services/library/distribute.ts`) en
 * is bewust NIET van de motor: hij is gedeeld over meerdere documenten, en de motor draait per
 * document. Injecteerbaar dus, zelfde patroon als `OccupancyEphemeralSolve` in `occupancy.ts`.
 */
export interface LevelingPoolLedger {
  /** Het poolitem waaraan `resourceId` hangt, of `null` wanneer deze resource geen
   *  bibliotheekstempel heeft — dan geldt alleen de gewone per-resource-toets. */
  poolItemOf(resourceId: string): string | null;
  /** Restcapaciteit van dat poolitem op die dag. ALTIJD ≥ 0 (de implementatie klemt; spec §4). */
  residualOn(poolItemId: string, iso: string): number;
  /** Boek geplaatste vraag terug. UITSLUITEND aangeroepen voor een taak die daadwerkelijk een
   *  passend venster kreeg — een niet-plaatsbare taak boekt NIET (spec §4 stap 3: anders wordt het
   *  restprofiel negatief en cascadeert het tekort naar elk volgend document). */
  book(poolItemId: string, iso: string, units: number): void;
  /** Laatste dag waarvoor het restprofiel betekenisvol is; `null` ⇒ geen extra horizon-eis. Zie de
   *  scanhorizon hieronder: zodra er vaste last van buiten dit document in het grootboek zit, kan
   *  het eerste vrije venster voorbij `totalWork + marge` liggen. */
  horizonIso: string | null;
}
```

`LevelingOptions` krijgt `poolLedger?: LevelingPoolLedger;` met een verwijzing naar dat docblok.

**(a) De tweede toets in `fits`:**

```ts
  function fits(byRes: Map<string, number[]>, occ: string[]): boolean {
    for (const [resId, arr] of byRes) {
      const poolItem = ledger ? ledger.poolItemOf(resId) : null;
      for (let i = 0; i < arr.length && i < occ.length; i++) {
        if (arr[i] <= 0) continue;
        if (bookedOn(resId, occ[i]) + arr[i] > capacityOf(resId, occ[i]) + EPS) { poolBlockedOnly = false; return false; }
        if (poolItem !== null && arr[i] > ledger!.residualOn(poolItem, occ[i]) + EPS) return false;
      }
    }
    return true;
  }
```

`poolBlockedOnly` is een `let` in `findSlot`-scope, geïnitialiseerd op `true` en op `false` gezet zodra
een kandidaat op de **projecttoets** faalde. Dat stuurt de reden (zie (c)). Geef `fits` daarvoor een
extra parameter of gebruik een closure-variabele — kies wat de bestaande stijl aanhoudt; `fits` staat
al in de closure van `findSlot`s omhullende functie, dus een `let` op `findSlot`-niveau plus een
uit-parameter is het minst invasief:

```ts
    // Reden-sturing (spec §4-taxonomie): faalde ELKE afgewezen kandidaat uitsluitend op het
    // POOLitem-grootboek, dan is de eerlijke uitkomst "restcapaciteit vol — anderen bezetten de
    // pool", niet het generieke "onvoldoende capaciteit" (dat wijst de gebruiker naar zijn eigen
    // projectinzet, waar niets mis mee is).
    let poolBlockedOnly = ledger !== undefined;
```

**(b) Boeken alleen bij succes.** `bookDemandAt` krijgt een derde parameter:

```ts
  const bookDemandAt = (taskId: string, startDate: Date, toPoolLedger: boolean): string[] => {
    const task = taskById.get(taskId)!;
    const occ = occurrenceFor(task, startDate);
    const byRes = demandByTask.get(taskId)!;
    for (const [resId, arr] of byRes) {
      const poolItem = ledger && toPoolLedger ? ledger.poolItemOf(resId) : null;
      for (let i = 0; i < arr.length && i < occ.length; i++) {
        book(resId, occ[i], arr[i]);                      // per-resource: ONVOORWAARDELIJK (bestaand gedrag)
        if (poolItem !== null) ledger!.book(poolItem, occ[i], arr[i]);
      }
    }
    return occ;
  };
```

Aanroepplekken:
- `fixedLoadIds`-lus (regel ~399): `bookDemandAt(id, parseDate(startIso), true)` — een onverplaatsbare
  of out-of-scope taak bezet de pool écht.
- Hoofdlus (regel ~441): `bookDemandAt(pick, startDate, slotUnresolved.length === 0)` — **dit is de
  hele spec-regel "niet-plaatsbaar = tekort, geen cascade"**. Schrijf dat er letterlijk bij.
- Vastgepinde taken (priority 1000) hebben `slotUnresolved.length === 0` (ze scannen niet) en boeken
  dus wél — correct: ze bezetten de pool ongeacht of dat past. Dat het restprofiel daardoor op 0
  geklemd kan raken terwijl er feitelijk overboeking is, is **geen motorprobleem**: de verdeler
  detecteert dat als een tekort op poolniveau (taak 10). Zet dat als commentaar bij de aanroep.

**(c) De reden.** In `reasonFor`, tussen `CEILING_TOO_TIGHT` en `NO_WINDOW_IN_HORIZON`:

```ts
    if (poolBlockedOnly) return 'RESIDUAL_FULL';
```

en `LevelingReason` krijgt:

```ts
  /** De eigen projectinzet had ruimte, maar de RESTcapaciteit van het bibliotheek-poolitem is op —
   *  andere documenten bezetten de pool (spec §4-taxonomie). */
  | 'RESIDUAL_FULL'
```

**(d) De horizon.** Vervang de scan-lusconditie in `findSlot`:

```ts
    // Scanhorizon (L4 + spec §4). `scanLimit` is een ONDERGRENS-argument dat rust op de eigen
    // taakduren; zodra het grootboek externe vaste last bevat, kan het eerste vrije venster ver
    // voorbij die horizon liggen. Zit er een grootboek mét horizon, dan scannen we door tot minstens
    // die dag — met een harde bovengrens tegen een oneindige lus.
    const horizonDate = ledger?.horizonIso ? parseDate(ledger.horizonIso) : null;
    const HARD_SCAN_CAP = 200_000; // zelfde orde als CalendarEngine's MAX_DAYS
    let horizonExhausted = false;
    while (guard++ < HARD_SCAN_CAP) {
      … (de bestaande body: occ, calendarOk, fits, return) …
      const next = nextCandidateAfterFor(task, cand);
      if (limit && next > limit) break;                                   // venstergrens (float/plafond)
      if (guard >= scanLimit && !(horizonDate && next <= horizonDate)) { horizonExhausted = true; break; }
      cand = next;
    }
```

Let op de volgorde: de **venstergrens** wint van de horizon (een plafond is een gebruikerskeuze, de
horizon een rekengrens), en `horizonExhausted` wordt alleen gezet in de horizon-tak — het initieel
`true` uit taak 5 vervalt dus, zet hem daar op `false` en laat deze tak hem zetten. Controleer bij het
implementeren dat de `HARD_SCAN_CAP`-uitgang óók `horizonExhausted = true` oplevert (dat is een
uitputting, geen venstergrens) — zet dat na de lus:

```ts
    if (guard >= HARD_SCAN_CAP) horizonExhausted = true;
```

- [ ] **Step 3: Draai**

```bash
bash tests/planning/run.sh 2>&1 | tail -8; echo "exit: $?"
bash tests/mcp/run.sh 2>&1 | tail -5; echo "exit: $?"
```

Verwacht: exit 0, 0. Zonder `poolLedger` is `ledger === undefined`, dus `poolBlockedOnly` is `false`,
er is geen tweede toets en geen horizon-verlenging — byte-identiek.

- [ ] **Step 4: Commit**

```bash
git add src/engine/scheduler/ResourceLeveler.ts tests/planning/check-leveler-pool-ledger.ts tests/planning/run.sh
git commit -m "feat(scheduler): injecteerbaar poolitem-grootboek als tweede capaciteitstoets (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: `TaskSplitGap.source` — herkomst van een leveling-gat

**Spec §4, "Herkomst"**: *"`TaskSplitGap` krijgt een optioneel herkomstveld (`source?: 'leveling'`;
afwezig = importdata, byte-identiek voor bestaande bestanden), mee door de `OPS_TaskSplits`-round-trip.
`applyLeveling` (idempotent herschrijven), 'nivellering wissen' en 'alles terugdraaien' raken
uitsluitend leveling-gaps; importsplits zijn brondata en blijven staan."*

Deze taak levert het **veld**, de **round-trip** en de **pure helper**. De wiring van die helper op
tijdbasis-bewerkingen (spec §4, "Invalidatie") is etappe 3 — er kunnen op dit punt nog geen
leveling-gaps bestaan, want niets schrijft ze.

**Files:**
- Modify: `src/types/task.ts` (`TaskSplitGap`)
- Modify: `src/services/ifc/ifcPsets.ts` (validator van `PSET.Splits`)
- Modify: `src/utils/taskDefaults.ts` (`clearLevelingGaps`)
- Modify: `tests/planning/check-split-walk.ts` **of** de bestaande IFC-round-trip-batterij — zie stap 1

- [ ] **Step 1: Schrijf de falende test**

Zoek eerst de bestaande round-trip-dekking voor `splitGaps`: `grep -rn "OPS_TaskSplits\|splitGaps" tests/`
en voeg de cases toe aan de batterij die de `OPS_`-psets al door writer+reader haalt (dat is de
goedkoopste plek; maak géén nieuwe check aan als er al een is). Drie asserts:

```ts
// B1c-plan-2 taak 7: het herkomstveld op een werkonderbreking.
// 1. Round-trip: een gat met source 'leveling' komt er als 'leveling' weer uit; een gat zonder
//    source blijft zonder source (byte-identiek voor bestaande bestanden).
// 2. Vijandige invoer: een gat met `source: "iets-anders"` in het IFC verliest ALLEEN het
//    source-veld — het gat zelf blijft staan (conservatief, zelfde lat als de bestaande
//    corrupte-JSON-tak die de load niet breekt).
// 3. clearLevelingGaps: wist uitsluitend gaten met source 'leveling', laat importsplits staan,
//    en geeft `true` terug precies wanneer er iets gewist is (zelfde contract als
//    clearTimephasedWindow in dat bestand).
```

Voor punt 3 hoort de assert in de batterij die `taskDefaults.ts` al dekt — `grep -rn "clearTimephasedWindow" tests/`
wijst 'm aan.

- [ ] **Step 2: Implementeer**

`src/types/task.ts` — de interface staat op één regel (regel 118); maak er een docblok van:

```ts
export interface TaskSplitGap {
  afterMinutes: number;
  gapMinutes: number;
  /** OPTIONEEL — waar dit gat vandaan komt. AFWEZIG = brondata: een split die uit een `.mpp`-import
   *  komt (`deriveSplitGapsForTasks`) of die de gebruiker zelf via een importbestand meebracht — die
   *  wordt NOOIT door de nivelleerder aangeraakt. `'leveling'` = door de verdeler ingevoegde
   *  pauzedag (B1c, spec §4 "Herkomst"): idempotent herschreven bij een nieuwe nivellering, gewist
   *  door "nivellering wissen"/"alles terugdraaien", en gewist zodra de tijdbasis van de taak
   *  wijzigt (een gat op een verouderde as is geen planning maar ruis). Afwezig ⇒ byte-identiek voor
   *  elk bestaand bestand. */
  source?: 'leveling';
}
```

`src/services/ifc/ifcPsets.ts`, de `apply` van `PSET.Splits` (regel ~319). De writer hoeft **niets**:
hij doet `JSON.stringify(gaps)` en neemt het veld vanzelf mee. De **lezer** moet het veld valideren in
plaats van blind door te laten — anders komt een willekeurige string uit een handgemaakt IFC-bestand
als `source` in het domeinmodel terecht:

```ts
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidGap)) {
            // B1c: `source` is een gesloten verzameling. Een onbekende waarde wordt WEGGELATEN
            // (het gat zelf blijft staan) — zelfde conservatieve lat als de corrupte-JSON-tak
            // hieronder: liever een gat zonder herkomst dan een geweigerde load.
            task.splitGaps = parsed.map(g => g.source === 'leveling'
              ? { afterMinutes: g.afterMinutes, gapMinutes: g.gapMinutes, source: 'leveling' as const }
              : { afterMinutes: g.afterMinutes, gapMinutes: g.gapMinutes });
          }
```

`src/utils/taskDefaults.ts`, naast `clearTimephasedWindow` (regel ~254), exact hetzelfde contract
(muteert de taak, geeft terug of er iets gewijzigd is):

```ts
/**
 * Wist de door de nivelleerder ingevoegde werkonderbrekingen (`source === 'leveling'`) van `task` en
 * laat IMPORTSPLITS (gaten zonder `source`) staan — spec §4, "Herkomst"/"Invalidatie". Geeft `true`
 * terug wanneer er daadwerkelijk iets gewist is; zelfde contract als `clearTimephasedWindow`
 * hierboven. Blijft er niets over, dan wordt `splitGaps` op `undefined` gezet (niet op een lege
 * array) — de golden rule van de IFC-round-trip is "leeg/afwezig ⇒ niets geschreven".
 *
 * De AANROEPPLEKKEN (bewerkingen die de tijdbasis van een taak raken: duur, kalender, handmatige
 * datums, voortgang) worden in B1c-etappe 3 bedraad; zolang niets leveling-gaps schrijft, kan er ook
 * niets verouderen.
 */
export function clearLevelingGaps(task: Task): boolean {
  const gaps = task.splitGaps;
  if (!gaps || gaps.length === 0) return false;
  const kept = gaps.filter(g => g.source !== 'leveling');
  if (kept.length === gaps.length) return false;
  task.splitGaps = kept.length > 0 ? kept : undefined;
  return true;
}
```

- [ ] **Step 3: Draai**

```bash
bash tests/planning/run.sh 2>&1 | tail -5; echo "exit: $?"
bash tests/library/run.sh 2>&1 | tail -5; echo "exit: $?"
npx tsc --noEmit -p tsconfig.json; echo "exit: $?"
```

Verwacht: exit 0, 0, 0. Let op `check-mpp-fidelity.ts`: de `.mpp`-lezer zet geen `source`, dus de
baseline blijft ongewijzigd — wordt hij tóch rood, stop en meld het.

- [ ] **Step 4: Commit**

```bash
git add src/types/task.ts src/services/ifc/ifcPsets.ts src/utils/taskDefaults.ts tests/
git commit -m "feat(model): herkomstveld op een werkonderbreking — leveling-gaten los van importsplits (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: `splitGapsFromWorkDayBlocks` — de as-conversie terug

**Spec §4, "As- en eenheidconversie"**: *"De verdeler kiest pauzedagen op de taakkalender en schrijft
ze via één gedeelde conversieroutine naast `splitTotalSpanMinutes`; testplicht bij taakkalender ≠
projectkalender en niet-gehele `hoursPerDay`."*

**KEUZE VAN DIT PLAN (afwijking van de letter van de spec, niet van de bedoeling):** de routine komt
in `src/engine/scheduler/splitWalk.ts`, niet naast `splitTotalSpanMinutes` in `duration.ts`. Reden:
`splitWalk.ts` is sinds W0 **de** eigenaar van de H1-as-wandeling en draagt al de heen-richting
(`splitDayPattern`: gaten → werk/gat-blokken in hele werkdagen). De terugweg naast zijn eigen inverse
zetten maakt de round-trip-invariant in één bestand toetsbaar; in `duration.ts` zou hij van zijn
tegenhanger gescheiden raken — precies wat W0 kwam repareren.

**Files:**
- Modify: `src/engine/scheduler/splitWalk.ts`
- Modify: `tests/planning/check-split-walk.ts`

- [ ] **Step 1: Schrijf de falende test**

Achteraan in `tests/planning/check-split-walk.ts`, zelfde `ok`/`eq`-stijl als de rest van dat bestand:

```ts
console.log('-- splitGapsFromWorkDayBlocks (de as-conversie terug) --');
// Referentiegeval, spiegelt het `splitDayPattern`-geval bovenaan dit bestand:
// blokken [{work:1,gap:1},{work:1,gap:1},{work:1,gap:0}] bij 480 min/dag ⇒ de H1-as-gaten
// {480,480} en {1440,480}. Let op de CUMULATIE: 1440 = 480 werk + 480 gat + 480 werk.
eq('blokken → H1-gaten', splitGapsFromWorkDayBlocks([{work:1,gap:1},{work:1,gap:1},{work:1,gap:0}], 480, 'leveling'),
   [{ afterMinutes: 480, gapMinutes: 480, source: 'leveling' },
    { afterMinutes: 1440, gapMinutes: 480, source: 'leveling' }]);
eq('een slotblok zonder gat levert geen gat op', splitGapsFromWorkDayBlocks([{work:4,gap:0}], 480), []);
eq('zonder source-argument blijft het veld weg',
   splitGapsFromWorkDayBlocks([{work:1,gap:1},{work:1,gap:0}], 480), [{ afterMinutes: 480, gapMinutes: 480 }]);

// ── ROUND-TRIP-INVARIANT: de conversie is de exacte inverse van `splitDayPattern` ────────────────
// Voor elk van deze blokpatronen (en elke minutesPerDay uit de lijst) moet gelden:
//   splitDayPattern(splitGapsFromWorkDayBlocks(b, mpd), mpd, Σwork) === b
// Neem mpd-waarden die een NIET-GEHELE hoursPerDay dekken (spec-testplicht): 480 (8u), 450 (7,5u),
// 390 (6,5u). Elke blokreeks eindigt op een blok met gap 0 — dat is de vorm die splitDayPattern
// oplevert (zie de INVARIANT-alinea in zijn docblok).
for (const mpd of [480, 450, 390]) {
  for (const blocks of [[{work:1,gap:1},{work:1,gap:0}], [{work:2,gap:3},{work:1,gap:1},{work:2,gap:0}], [{work:5,gap:0}]]) {
    const total = blocks.reduce((s, b) => s + b.work, 0);
    eq(`round-trip mpd=${mpd} ${JSON.stringify(blocks)}`,
       splitDayPattern(splitGapsFromWorkDayBlocks(blocks, mpd), mpd, total), blocks);
  }
}

// ── En de dagen die eruit rollen kloppen op een AFWIJKENDE taakkalender (spec-testplicht) ────────
// Zesdaagse kalender (ma-za): 3 werkdagen met een gat van 1 werkdag na dag 1, vanaf vr 2026-06-05
// ⇒ vr, (za = gat), ma, di.
eq('gaten uit blokken, geënumereerd op de taakkalender',
   enumerateTaskWorkDays(splitGapsFromWorkDayBlocks([{work:1,gap:1},{work:2,gap:0}], 480), sixDayEng, '2026-06-05', 3),
   ['2026-06-05', '2026-06-08', '2026-06-09']);
```

Bouw `sixDayEng` als een `CalendarEngine` op een ma-za-kalender (kopieer `SIX_DAY_CAL` uit
`tests/planning/check-leveler-splits.ts`).

Draai `bash tests/planning/run.sh`; verwacht rood (functie bestaat niet).

- [ ] **Step 2: Implementeer**

In `splitWalk.ts`, direct ná `splitDayPattern` (zodat heen en terug naast elkaar staan):

```ts
/**
 * De EXACTE INVERSE van `splitDayPattern`: werk/gat-blokken in hele werkdagen → `TaskSplitGap[]` op
 * de H1-as. Dit is de ene gedeelde conversieroutine waar spec §4 ("As- en eenheidconversie") om
 * vraagt: de verdeler kiest pauzedagen op de TAAKkalender (dus in hele werkdagen van díé kalender)
 * en schrijft ze hiermee om naar de cumulatieve elapsedWork-as die `duration.ts`,
 * `CPMSolver.ts` en de renderer lezen.
 *
 * De cumulatie is het hele punt: `afterMinutes` van gat n incorporeert alle voorgaande werk- ÉN
 * gat-minuten (`axisPos += work + gap`). Wie hier alleen de werkminuten optelt produceert gaten die
 * de CPM te vroeg laat vallen — de spiegelfout van de pre-H1-bug die W0 repareerde.
 *
 * Een blok met `gap === 0` levert geen gat op (het slotblok, en elk blok waar de aanroeper geen
 * pauze wil). `source` wordt op elk geproduceerd gat gezet wanneer meegegeven — de verdeler geeft
 * `'leveling'`, zodat "nivellering wissen" zijn eigen gaten later terugvindt (spec §4, "Herkomst").
 *
 * INVARIANT (getest in `check-split-walk.ts`):
 *   `splitDayPattern(splitGapsFromWorkDayBlocks(b, mpd), mpd, Σb.work) === b`
 * voor elk blokpatroon dat eindigt op een blok met `gap: 0`.
 */
export function splitGapsFromWorkDayBlocks(
  blocks: Array<{ work: number; gap: number }>,
  minutesPerDay: number,
  source?: 'leveling',
): TaskSplitGap[] {
  const mpd = Math.max(1, minutesPerDay);
  const gaps: TaskSplitGap[] = [];
  let axisPos = 0;
  for (const b of blocks) {
    const work = Math.max(0, Math.round(b.work));
    const gap = Math.max(0, Math.round(b.gap));
    axisPos += work * mpd;
    if (gap > 0) {
      gaps.push(source ? { afterMinutes: axisPos, gapMinutes: gap * mpd, source } : { afterMinutes: axisPos, gapMinutes: gap * mpd });
      axisPos += gap * mpd; // H1: het gat telt zichzelf mee voor de positie van het VOLGENDE gat
    }
  }
  return gaps;
}
```

- [ ] **Step 3: Draai en commit**

```bash
bash tests/planning/run.sh 2>&1 | tail -5; echo "exit: $?"
```

Verwacht: exit 0.

```bash
git add src/engine/scheduler/splitWalk.ts tests/planning/check-split-walk.ts
git commit -m "feat(scheduler): werkdag-blokken terug naar H1-gaten — de gedeelde as-conversie (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 9: de onderbreek-modus in de nivelleerder (`allowSplits`)

**Spec §4** (stap 0 van het concept + de vier afspraken) en **§11.4** (eigenaarsbesluit: in v1).
Uit = alleen uitlopen; aan = de verdeler mag pauzedagen invoegen. Van de vier afspraken zijn
"Herkomst" en "As- en eenheidconversie" af (taken 7 en 8); "Invalidatie" is etappe 3; **"In-progress"**
is deze taak: *"In v1 voegt de verdeler alleen gaps toe aan niet-gestarte taken (`completion === 0`)."*

**KEUZE VAN DIT PLAN (v1-grens, expliciet):** leveling-gaten worden alleen ingevoegd op taken met
`durationType === 'WORKTIME'` **én** `durationUnit === 'days'` **én** `completion === 0`. Reden: de hele
gaten-machinerie in `splitWalk.ts` is dag-granulair (`splitDayPattern` rondt minuten af op hele
werkdagen), dus een uur-modus-taak zou een gat krijgen dat op zijn eigen as afrondt en dan niet meer
exact terugleest; ELAPSEDTIME kent geen werkdagbegrip. Zulke taken wijken uitsluitend via uitloop —
exact zoals ze dat vandaag doen. Dit is een **beperking van de plaatsingslogica, geen aanname over de
invoer**: een geïmporteerde uur-modus-taak mét splits blijft gewoon werken.

**Files:**
- Modify: `src/engine/scheduler/ResourceLeveler.ts`
- Create: `tests/planning/check-leveler-splitmode.ts`
- Modify: `tests/planning/run.sh` (registratie)

- [ ] **Step 1: Schrijf de falende test**

```ts
// check-leveler-splitmode.ts — B1c-plan-2 taak 9: "Onderbrekingen toestaan" (spec §4, stap 0).
//
// ── Geval 1: uit ⇒ uitlopen, aan ⇒ onderbreken ──────────────────────────────────────────────────
// Resource R cap 1. Taak A (prio 900, 3 wd) bezet ma/di/wo. Taak B (prio 100, 2 wd) wil ma.
// - allowSplits: false ⇒ B schuift naar do (delay 3), geen gaten.
// - allowSplits: true met een resource die op DI wél ruimte heeft (bouw A zó dat hij ma+wo+do
//   bezet — bv. via een importsplit op A) ⇒ B werkt di en vr, met één leveling-gat ertussen.
eq('zonder onderbrekingen: B loopt uit', rOff.delays['B'], 3);
eq('zonder onderbrekingen: geen gaten geschreven', rOff.gaps['B'], undefined);
eq('met onderbrekingen: B start op de eerste vrije dag', rOn.delays['B'], 1);
ok('met onderbrekingen: B krijgt precies één leveling-gat',
   rOn.gaps['B']?.length === 1 && rOn.gaps['B'][0].source === 'leveling');
// De geschreven gaten moeten de ECHTE werkdagen opleveren die de leveler geboekt heeft:
eq('gaten reproduceren de geboekte dagen',
   enumerateTaskWorkDays(rOn.gaps['B'], projEng, '<B se nieuwe start>', 2), ['<dag1>', '<dag2>']);

// ── Geval 2: de trial-solve ZIET de gaten ───────────────────────────────────────────────────────
// `projectEndAfter` en `shifts` komen uit één proef-CPM-run op de werkkopieën. Staat het gat niet
// op de werkkopie, dan belooft de preview een einddatum die de echte runCPM nooit haalt.
ok('projectEndAfter houdt rekening met de opgerekte spanne van B', rOn.projectEndAfter >= '<verwachte dag>');

// ── Geval 3: de v1-grens ────────────────────────────────────────────────────────────────────────
// Een taak in uitvoering (completion 0,5) is sowieso ONVERPLAATSBAAR (vaste last) — die mag geen
// gaten krijgen. Een taak met completion 1 ZONDER actualFinish is wél movable (rand van
// isCompletedTask/isInProgressTask!) maar heeft completion > 0 ⇒ ook geen gaten.
eq('completion > 0 ⇒ geen leveling-gaten, alleen uitloop', rOn.gaps['CDone'], undefined);
// Een ELAPSEDTIME-taak en een uur-modus-taak evenmin:
eq('ELAPSEDTIME ⇒ geen leveling-gaten', rOn.gaps['E'], undefined);
eq('uur-modus ⇒ geen leveling-gaten', rOn.gaps['H'], undefined);

// ── Geval 4: bestaande importsplits blijven staan ───────────────────────────────────────────────
// Taak F draagt een importsplit (zonder source). De leveler mag die NOOIT weggooien; komt er een
// leveling-gat bij, dan staan beide in het resultaat en is alleen de nieuwe gemarkeerd.
ok('importsplit blijft, leveling-gat komt erbij',
   rOn.gaps['F']?.filter(g => g.source === undefined).length === 1);
```

Registreer in `run.sh`, draai, verwacht rood.

- [ ] **Step 2: Implementeer**

`LevelingOptions`:

```ts
  /** "Onderbrekingen toestaan" (spec §4 stap 0; MS Project: *Leveling can create splits in remaining
   *  work*). `false`/afwezig ⇒ bestaand gedrag: een taak wijkt alleen als GEHEEL (uitloop). `true` ⇒
   *  de nivelleerder mag pauzedagen invoegen wanneer er geen aaneengesloten venster past.
   *
   *  V1-GRENS (bewust, zie het plan bij taak 9): alleen taken met `durationType === 'WORKTIME'`,
   *  `durationUnit === 'days'` en `completion === 0` komen ervoor in aanmerking. De gaten-machinerie
   *  is dag-granulair, en MSP's eigen formulering is "splits in REMAINING work" — een gestarte taak
   *  wijkt uitsluitend via uitloop. */
  allowSplits?: boolean;
```

`LevelingResult` krijgt er één veld bij (additief; `LevelingDialog`/MCP negeren het vanzelf):

```ts
  /** taskId → de door de nivelleerder INGEVOEGDE werkonderbrekingen, inclusief de importsplits die
   *  de taak al droeg (de volledige, te schrijven `splitGaps`-waarde — niet alleen het verschil).
   *  Alleen aanwezig voor taken die daadwerkelijk een leveling-gat kregen; `applyLeveling` schrijft
   *  dit veld in etappe 3. */
  gaps: Record<string, TaskSplitGap[]>;
```

De plaatsing zelf. In `findSlot`, ná de mislukte aaneengesloten scan en vóór het
"geen slot"-vangnet, één nieuwe tak:

```ts
    // ── Onderbreek-modus (spec §4, stap 0) ────────────────────────────────────────────────────────
    // Er is geen AANEENGESLOTEN venster gevonden. Mag de taak onderbroken worden, dan plaatsen we
    // haar dag-voor-dag: loop vanaf de gesnapte PF over de kandidaat-werkdagen en neem telkens de
    // eerstvolgende dag waarop de vraag van de VOLGENDE curve-index past. De overgeslagen werkdagen
    // ertussen worden de pauzedagen. Greedy van links naar rechts — bewust GEEN zoektocht: de spec
    // (§3.4) verbiedt iteratie over kandidaatstanden, en het greedy-antwoord is per constructie de
    // vroegst mogelijke onderbroken plaatsing.
    //
    // De vraag per dag is `arr[i]` van de CURVE (index i = i-de werkdag van de taak) — dat is
    // dezelfde array die `fits`/`bookDemandAt` gebruiken, dus de curve blijft over de WERKdagen
    // liggen en de gaten rekken alleen de spanne (het W0-curve-besluit, ongewijzigd).
```

Concreet, als lokale helper naast `findSlot`:

```ts
  /** Mag deze taak leveling-gaten krijgen? Zie de v1-grens bij `LevelingOptions.allowSplits`. */
  function splitEligible(task: Task): boolean {
    return options.allowSplits === true
      && task.time.durationType === 'WORKTIME'
      && task.time.durationUnit === 'days'
      && task.time.completion === 0;
  }

  /** Dag-voor-dag-plaatsing. Geeft de gekozen werkdagen (ISO, oplopend) of `null` wanneer er binnen
   *  het venster geen volledige set te vinden is. `limit` begrenst de LAATSTE dag (niet de start):
   *  met onderbrekingen groeit de FINISH van de taak, en dát is wat het plafond moet binden. */
  function scatterSlot(taskId: string, pf: Date, finishLimit: Date | null): string[] | null {
    const task = taskById.get(taskId)!;
    const byRes = demandByTask.get(taskId)!;
    const need = task.time.scheduleDuration;
    const chosen: string[] = [];
    let cand = nextCandidateFor(task, pf);
    let guard = 0;
    while (chosen.length < need && guard++ < HARD_SCAN_CAP) {
      if (finishLimit && cand > finishLimit) return null;
      const iso = formatDate(cand);
      if (dayFits(byRes, chosen.length, iso)) chosen.push(iso);
      cand = nextCandidateAfterFor(task, cand);
    }
    return chosen.length === need ? chosen : null;
  }

  /** Past curve-index `i` van deze taak op dag `iso`? Zelfde twee toetsen als `fits` (projectinzet
   *  én poolitem-grootboek), maar voor één index/één dag. */
  function dayFits(byRes: Map<string, number[]>, i: number, iso: string): boolean { /* … */ }
```

De `finishLimit` komt uit een tweede vensterhelper naast `windowLimit` (taak 4), op de baseline
**lateFinish**:

```ts
  /** Bovengrens voor de LAATSTE werkdag in de onderbreek-modus: `lateFinish + plafond` (of, bij
   *  `constrainToFloat` zonder plafond, `lateFinish` zelf). Met onderbrekingen schuift de start
   *  misschien nauwelijks, maar het EINDE wel — en het plafond gaat over de einddatum. */
  const finishWindowLimit = (id: string): Date | null => { /* spiegel `windowLimit`, met baseLf */ };
```

Voeg `baseLf` toe naast `baseEs`/`baseLs`/`baseFloat` (regel ~199), uit `baseline.tasks.get(id)?.lateFinish`.

`findSlot` geeft bij een geslaagde scatter de gekozen dagen terug:

```ts
  function findSlot(taskId, pf, limit): { start: Date; unresolved: string[]; reason?: LevelingReason; scatterDays?: string[] }
```

en de **hoofdlus** verwerkt dat als volgt (dit is het gevoeligste stuk van deze taak — schrijf het
commentaar erbij):

```ts
      if (slot.scatterDays) {
        // 1. Zet de gaten op de WERKKOPIE, vóór de boeking. `occurrenceFor` leest `task.splitGaps`
        //    van de ORIGINELE taak, dus die zou de nieuwe gaten niet zien — daarom boeken we hier
        //    rechtstreeks op `slot.scatterDays` en invalideren we de memo van taak 2 voor deze taak,
        //    zodat een latere aanroep (conflictverzameling, preview) niet op de oude dagenset valt.
        const mpd = engineForTask(pickedTask).hoursPerDay * 60;
        const newGaps = [...(pickedTask.splitGaps ?? []),
                         ...splitGapsFromWorkDayBlocks(blocksFromDays(slot.scatterDays, engineForTask(pickedTask)), mpd, 'leveling')];
        workById.get(pick)!.splitGaps = newGaps;   // ⇒ de proef-solve (A1) ziet de opgerekte spanne
        gapsOut[pick] = newGaps;                   // ⇒ komt in LevelingResult.gaps
        for (const key of [...occCache.keys()]) if (key.startsWith(`${pick}|`)) occCache.delete(key);
      }
```

`blocksFromDays(days, engine)` is een kleine lokale helper: loop de gekozen dagen af en tel per
overgang hoeveel **werkdagen van die engine** ertussen zijn overgeslagen ⇒ `{work, gap}`-blokken.
Bouw hem als pure functie naast `scatterSlot` en test hem impliciet via geval 1 (de
`enumerateTaskWorkDays`-assert reproduceert exact de geboekte dagen — dat is de sluitende controle).

Boeken gebeurt in dit geval op de scatter-dagen in plaats van via `occurrenceFor`; geef
`bookDemandAt` daarvoor een optionele `occOverride?: string[]`:

```ts
  const bookDemandAt = (taskId, startDate, toPoolLedger, occOverride?: string[]): string[] => {
    const occ = occOverride ?? occurrenceFor(taskById.get(taskId)!, startDate);
    …
  };
```

**LET OP — de belangrijkste valkuil van deze taak:** de gaten moeten **vóór** de proef-solve op
`workTasks` staan, anders belooft `projectEndAfter` een einddatum die `applyLeveling` → `runCPM` nooit
haalt (geval 2 van de test pint dat). En ze moeten **na** de PF-berekening van díé taak komen, want de
PF gaat over de start, niet over de spanne.

- [ ] **Step 3: Draai**

```bash
bash tests/planning/run.sh 2>&1 | tail -8; echo "exit: $?"
```

Verwacht: exit 0 — zonder `allowSplits` is `splitEligible` overal `false`, dus `scatterSlot` draait
nooit en het gedrag is byte-identiek. `LevelingResult.gaps` is dan `{}`.

- [ ] **Step 4: Commit**

```bash
git add src/engine/scheduler/ResourceLeveler.ts tests/planning/check-leveler-splitmode.ts tests/planning/run.sh
git commit -m "feat(scheduler): onderbreek-modus — de nivelleerder mag pauzedagen invoegen (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 10: de verdeler-kern — `computeDistribution`

**Spec §4, "Het plaatsingsprotocol (de verdeler)"** — het hart van de etappe. Puur, headless, geen
store, geen I/O; het model is `computeLibraryOccupancy`.

**Files:**
- Create: `src/services/library/distribute.ts`
- Create: `tests/library/check-distribute.ts`
- Modify: `tests/library/run.sh` (`run_check check-distribute` onderaan)

- [ ] **Step 1: Schrijf de falende test**

`tests/library/check-distribute.ts`. Hergebruik de fixture-bouwstenen van
`tests/library/check-occupancy.ts` letterlijk (`cal()`, `poolRes()`, `stamped()`, `task()`,
`assign()`, `doc()`, `pool()`) — kopiëren, niet importeren (dat is de stijl van die suite). De cases
komen **één op één** uit de spec-testlijst (§9, blok "Verdeler"); nummer ze zo:

```ts
// check-distribute.ts — B1c-plan-2 taak 10: het sequentiële plaatsingsprotocol (spec §4/§9).
// Cases 1-14 volgen letterlijk de spec-testlijst. Poolitem P (capaciteit 2/dag) in bibliotheek c1;
// week ma 2026-08-03 t/m vr 2026-08-07 tenzij anders vermeld.

// 1. Float eerst: een document met float benut die en verschuift zijn EINDDATUM niet.
ok('float wordt benut zonder einddatum-kosten', d1.endShiftWorkdays === 0 && d1.delays['A'] === 1);
// 2. Rangorde gerespecteerd: nr. 1 nivelleert alleen tegen de vaste last (hij ziet géén van de
//    andere deelnemers), nr. 2 ziet nr. 1 wél.
eq('nr. 1 blijft staan', p.docs[0].delays, {});
ok('nr. 2 wijkt om nr. 1 heen', Object.keys(p.docs[1].delays).length > 0);
// 3. Uitschieter minimaal: draai dezelfde fixture met de rangorde omgedraaid en toon dat de
//    verdeling meebeweegt — de rangorde ÍS de fairness-knop (spec §4 stap 2).
// 4. Plafonds hard: doc met plafond 1 mag hooguit 1 werkdag uitlopen; lukt dat niet ⇒ tekort.
eq('plafond hard', p4.docs[1].shortfalls[0].reason, 'CEILING_TOO_TIGHT');
// 5. Plafond t.o.v. de einddatum MÉT bestaande nivellering (spec §4-referentiepunt): een document
//    waarvan een taak al een levelingDelay draagt, meet zijn plafond vanaf die verschoven positie.
// 6. Plafond onhaalbaar door deadline/backward-constraint ⇒ eigen reden.
eq('constraint-blokkade', p6.docs[0].shortfalls[0].reason, 'CEILING_UNREACHABLE');
// 7. Gepind document: volledig ongemoeid ÉN meegeteld als vaste last.
eq('gepind document doet niet mee', p7.docs[0].delays, {});
ok('maar bezet het profiel wél', p7.fixedLoadByDay['2026-08-03'] > 0);
// 8. Priority-1000-document (alle taken vastgepind) ⇒ "kan niet wijken".
eq('document kan niet wijken', p8.docs[1].cannotMove, true);
// 9. `min` met de projectinzet: een document waarvan de PROJECTkopie maxUnits 1 heeft, mag niet
//    2 boeken ook al is er poolrest 2.
// 10. Dubbele stempel in één document: twee gestempelde resources op hetzelfde poolitem trekken
//     van HETZELFDE grootboek — geen dubbeltelling (dat is taak 6's geval 3, hier op verdelerniveau).
// 11. Som ≠ oplossing (systeembevinding uit het Interface-lab): een stand waarin de plafonds
//     sómmeren tot genoeg ruimte maar geen enkele plaatsing haalbaar is ⇒ tekort, niet "opgelost".
// 12. Niet-plaatsbaar document ⇒ tekort geregistreerd, restprofiel blijft ≥ 0, GEEN cascade:
//     het document ná het tekort krijgt exact dezelfde plaatsing als wanneer het tekortdocument
//     er niet was.
ok('geen cascade', JSON.stringify(p12.docs[2].delays) === JSON.stringify(pZonderTekortdoc.docs[1].delays));
for (const v of Object.values(p12.residualByDay)) ok('restprofiel blijft >= 0', v >= 0);
// 13. Document in "datums zoals opgeslagen" (#63) ⇒ impliciet gepind, met eigen label.
eq('#63 is impliciet gepind', p13.docs[0].pinnedReason, 'dates-as-recorded');
eq('#63-document wordt nooit beschreven', p13.docs[0].delays, {});
// 14. UNCOUNTED document blokkeert de HELE actie met uitleg (spec §3.1) — geen stille uitsluiting.
eq('uncounted blokkeert', p14.blocked?.reason, 'UNCOUNTED_DOCUMENT');
eq('en noemt welk document', p14.blocked?.docIds, ['doc-stale']);
ok('en levert geen voorstel', p14.docs.length === 0);
// 15. Onderbreek-modus: met `allowSplits` schrijft het voorstel geldige `splitGaps` MÉT
//     herkomstveld, en die komen door de OPS_TaskSplits-round-trip heen (schrijf ze door
//     `ifcPsets`' write+apply en vergelijk).
```

Registreer in `tests/library/run.sh` en draai; verwacht rood (module bestaat niet).

- [ ] **Step 2: Implementeer `src/services/library/distribute.ts`**

Moduleblok bovenaan (dit is de plek waar het protocol wordt uitgelegd — schrijf het uit, in de stijl
van `occupancy.ts`):

```ts
// B1c — de verdeler-kern (spec 2026-08-17-b1c-nivelleren-restcapaciteit-design.md §4).
// Herverdeelt de boeking op ÉÉN poolitem over de geopende documenten die het boeken. Volledig puur
// en headless testbaar (tests/library/check-distribute.ts): geen store, geen I/O — het schrijfpad en
// het paneel zijn etappe 3.
//
// HET PROTOCOL IS SEQUENTIEEL, NIET SIMULTAAN. De eerste versie van de spec gaf een formule waarin
// iedereen iedereen op zijn huidige plek zag — dan is er nergens rest en is verdelen onmogelijk.
// Hier: documenten één voor één in RANGORDE. Nr. 1 nivelleert alleen tegen de vaste last; elk
// volgend document ziet de ECHTE boekingen van zijn voorgangers.
//
// TWEE GROOTBOEKEN. De motor toetst per `resourceId` tegen de eigen projectinzet (dat voorkomt dat
// we een bibliotheekconflict oplossen door een projectconflict te maken); dit bestand voegt het
// gedeelde POOLITEM-grootboek toe. Beide toetsen moeten slagen — identiek aan de
// `min(projectinzet, poolrest)`-formulering elders in de spec.
//
// EEN TEKORT CASCADEERT NIET. Kan een taak binnen plafond en profiel niet geplaatst worden, dan
// wordt haar vraag NIET in het poolgrootboek geboekt (`LevelingPoolLedger.book` wordt overgeslagen)
// maar als tekort geregistreerd. Zo blijft het restprofiel ≥ 0 en krijgt het volgende document
// exact de ruimte die er echt is. Een voorstel mét tekorten is een geldige preview, maar blokkeert
// Toepassen (etappe 3 zet die knop uit-met-reden).
//
// UITSLUITEND DOORGEREKENDE CIJFERS (§3.1). `computeLibraryOccupancy` rekent stale documenten
// efemeer door; blijft er tóch één `counted: false`, dan is de hele actie GEBLOKKEERD met uitleg —
// nooit een stille uitsluiting, want nivelleren tegen een niet-doorgerekend document is nivelleren
// tegen een getal dat nergens vandaan komt.
```

Typen:

```ts
/** Eén deelnemend document. Erft de bezettings-invoer (zodat aanroeper en bezettingsoverzicht
 *  dezelfde mapping delen) en voegt de drie tune-bedieningen van spec §6 toe. */
export interface DistributionDocInput extends OccupancyDocInput {
  /** 1 = wordt het meest ontzien en plaatst als eerste. Duplicaten worden stabiel op `docId`
   *  gebroken; de aanroeper (het paneel) levert een echte volgorde. */
  rank: number;
  /** De pin uit §6: bevriest het document volledig (einddatum ÉN werkdagen). Doet niet mee in de
   *  verdeling, telt als vaste last. */
  pinned: boolean;
  /** #63 — "datums zoals opgeslagen" (§3.3a). Impliciet gepind: het document meldt `counted: true`
   *  met datums die de motor niet berekend heeft, dus B1c raakt zijn data NOOIT aan. */
  datesAsRecorded: boolean;
  /** "Maximale uitloop van de einddatum", in werkdagen; `null` = onbegrensd. `0` = einddatum vast,
   *  float mag benut worden (§6: plafond 0 ≠ bevroren — daarvoor is de pin). */
  ceilingWorkdays: number | null;
  /** Planningsinvoer voor de motor-run van dít document: de VOLLEDIGE takenlijst, relaties en
   *  CPM-opties — zelfde eis en zelfde reden als `OccupancySolveInput` (een gesnoeide lijst geeft
   *  een andere planning dan `runCPM`). */
  levelInput: OccupancySolveInput;
}

export interface DistributionOptions {
  /** "Onderbrekingen toestaan" (§4 stap 0 / §11.4). */
  allowSplits: boolean;
}

/** Waarom een document niet kon wijken — DOCUMENT-niveau, naast de taak-niveau `LevelingReason`. */
export type DistributionPinReason = 'pin' | 'dates-as-recorded';

export interface DistributionShortfall {
  taskId: string;
  reason: LevelingReason;
  /** De dagen waarop het niet paste (uit `LevelingResult.unresolved`). */
  days: string[];
}

export interface DistributionDocResult {
  docId: string;
  title: string;
  /** false ⇒ gepind of #63: het document telde als vaste last en werd niet herplaatst. */
  participated: boolean;
  pinnedReason?: DistributionPinReason;
  /** Alle taken in het document zijn priority 1000 ⇒ het KAN niet wijken (§4-taxonomie): een eigen
   *  uitkomst, geen generieke capaciteitsmelding. */
  cannotMove: boolean;
  delays: Record<string, number>;
  /** Volledige, te schrijven `splitGaps` per taak (leeg wanneer `allowSplits` uit staat). */
  gaps: Record<string, TaskSplitGap[]>;
  projectEndBefore: string;
  projectEndAfter: string;
  /** Werkdagen die de einddatum opschuift — het getal dat het paneel bij de handle toont (§6). */
  endShiftWorkdays: number;
  shortfalls: DistributionShortfall[];
}

export interface DistributionProposal {
  libraryItemId: string;
  /** Niet-null ⇒ er is GEEN voorstel; `docs` is leeg. */
  blocked: { reason: 'UNCOUNTED_DOCUMENT'; docIds: string[] } | null;
  docs: DistributionDocResult[];
  /** ISO-dag → vaste last (gepinde documenten + documenten buiten de verdeling die op dit poolitem
   *  boeken). Voedt de fasestrook-achtergrond in etappe 3. */
  fixedLoadByDay: Record<string, number>;
  /** ISO-dag → wat er ná de hele verdeling nog vrij is. ALTIJD ≥ 0. */
  residualByDay: Record<string, number>;
  /** Minstens één document houdt een tekort ⇒ Toepassen blijft uit (etappe 3). */
  hasShortfall: boolean;
}

export function computeDistribution(
  companyId: string,
  pool: CompanyPool,
  libraryItemId: string,
  docs: DistributionDocInput[],
  options: DistributionOptions,
  /** Injecteerbare motor-rand, zelfde patroon als `OccupancyEphemeralSolve`. Default = de echte
   *  `levelResources`. Tests gebruiken de echte motor voor gedrag en een stub voor foutpaden. */
  runLeveling: DistributionLevelRun = defaultLevelRun,
): DistributionProposal
```

Algoritme, in deze volgorde:

1. **Bezetting lezen.** `computeLibraryOccupancy(companyId, pool, docs)` en de rij van
   `libraryItemId` pakken. Geen rij ⇒ leeg voorstel (`docs: []`, `blocked: null`).
2. **Blokkade.** Is er in die rij één `counted: false`-booking, dan `blocked: { reason:
   'UNCOUNTED_DOCUMENT', docIds }` en klaar. **Vóór** alle rekenwerk — spec §3.1.
3. **Vaste last.** Sommeer per ISO-dag de `dailyLoad` van (a) elk gepind document, (b) elk
   `datesAsRecorded`-document, en (c) elk document dat wél op het poolitem boekt maar níét in `docs`
   voorkomt als deelnemer. (c) hoort erbij volgens spec §4 stap 1; de aanroeper levert die documenten
   gewoon mee met `pinned: true` als hij ze niet wil laten meedoen — schrijf dat als contract op, dan
   heeft de kern maar één mechanisme.
4. **Het grootboek.** Bouw één `LevelingPoolLedger`:
   - `poolItemOf(resourceId)`: uit de resource-stempels van het document dat nú aan de beurt is
     (dus per document opnieuw gebonden — de resource-id's zijn documentlokaal!). Dit is de
     makkelijkste plek om het fout te doen: bouw de map per document, vlak vóór zijn motor-run.
   - `residualOn(itemId, iso)`: `Math.max(0, maxUnitsOn(poolItem, iso) − fixedLoad[iso] − placed[iso])`.
     De klem op 0 is de spec-eis en tegelijk de garantie dat een gepinde/overboekende taak het profiel
     niet negatief maakt.
   - `book(itemId, iso, units)`: `placed[iso] += units`.
   - `horizonIso`: de laatste dag met vaste last of geplaatste boeking, plus een marge van de langste
     document-spanne — dat is de dag waarvoorbij het profiel gegarandeerd vrij is. Documenteer dat het
     een **ondergrens-argument** is, precies als `scanLimit` (zie taak 6): de motor mag ook verder
     scannen, deze waarde zegt alleen "tot hier heeft doorscannen zeker zin".
5. **Plaatsen in rangorde.** Sorteer de deelnemende documenten op `rank` (dan `docId`). Per document:
   - Gepind of `datesAsRecorded` ⇒ `participated: false`, `pinnedReason`, geen motor-run. De boeking
     zat al in de vaste last (stap 3).
   - Alle taken die op dit poolitem boeken hebben `priority === 1000` ⇒ `cannotMove: true`, geen
     motor-run, boeking rechtstreeks in het grootboek (het document bezet de pool wél).
   - Anders: `runLeveling(doc, { constrainToFloat: false, scopeTaskIds: <de taken van dit document
     die via een gestempelde resource op dit poolitem boeken>, overrunCeilingDays: doc.ceilingWorkdays ??
     undefined, allowSplits: options.allowSplits, poolLedger: ledgerFor(doc) })`.
   - Map `LevelingResult` → `DistributionDocResult`: `delays`, `gaps`, `unresolved`+`unresolvedReasons`
     → `shortfalls`, en `endShiftWorkdays` uit `projectEndBefore`/`projectEndAfter` op de
     projectkalender van dat document.
6. **Nawerk.** `residualByDay` uit het grootboek, `hasShortfall` = er is minstens één shortfall.

**KEUZE VAN DIT PLAN (concretisering, geen afwijking):** spec §4 stap 2 zegt *"eerst float benutten
(kost geen einddatum), dan het restant zó dat de grootste einddatum-verschuiving minimaal is"*. Dat
vraagt géén tweede algoritme: de SGS-plaatsing zoekt per taak het **vroegste** venster vanaf haar PF,
dus float wordt per constructie eerst opgesoupeerd en de uitloop is per taak minimaal; de rangorde
bepaalt wie de vroege ruimte krijgt. Schrijf die redenering als commentaar in `computeDistribution` —
anders leest de afwezigheid van een aparte "float-pass" als een gat.

**Ook opschrijven, ook in commentaar:** de kostenlabels uit spec §4 stap 1 ("alleen dit project laten
opschuiven kost +N") en de prijskaartjes van de gereedschapsschakelaar zijn géén aparte API — dat is
`computeDistribution` opnieuw draaien met een andere rangorde respectievelijk `allowSplits`. De kern
levert dus alles wat het paneel nodig heeft; het cache-/schaalbeleid (§3.4) hoort bij het paneel.

- [ ] **Step 3: Draai**

```bash
bash tests/library/run.sh 2>&1 | tail -8; echo "exit: $?"
bash tests/planning/run.sh 2>&1 | tail -5; echo "exit: $?"
npm run verify:cycles; echo "exit: $?"
```

Verwacht: exit 0, 0, 0. `verify:cycles` bewaakt dat `services/library → engine/scheduler` geen
circulaire import heeft geïntroduceerd.

- [ ] **Step 4: Commit**

```bash
git add src/services/library/distribute.ts tests/library/check-distribute.ts tests/library/run.sh
git commit -m "feat(library): verdeler-kern — sequentieel plaatsen over documenten tegen restcapaciteit (B1c)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 11: de volle poort

**Files:** eventueel `docs/library.md` (zie stap 2).

- [ ] **Step 1: Draai de ene poort**

```bash
npm run verify; echo "exit: $?"
```

Verwacht: exit 0. Dit draait typecheck (incl. `tests/` en `scripts/`), lint, alle vijf de suites,
voorbeelden, docs, i18n, cycles, store-grenzen en audit — exact wat CI draait. Oordeel **alleen op de
exitcode**.

Drie poorten die in dit plan bijzondere aandacht verdienen:
- `verify:store-boundaries` — `distribute.ts` mag **nooit** `useAppStore` of `appStoreContext`
  importeren. Doet hij dat wel, dan is de kern niet puur en faalt deze poort terecht.
- `verify:cycles` — `services/library` → `engine/scheduler` is de toegestane richting.
- `verify:i18n` — dit plan voegt bewust géén sleutel toe (zie *Scope*); faalt deze poort, dan heeft
  iemand tóch UI-tekst toegevoegd en hoort die in etappe 3.

- [ ] **Step 2: Werk `docs/library.md` bij (alleen de kern, geen UI)**

Eén alinea onder de bestaande B1b/B1c-tekst: dat de verdeler-kern bestaat, wat hij doet (sequentieel
plaatsen tegen restcapaciteit, twee grootboeken, tekort ≠ cascade), en dat het schrijfpad en het paneel
nog niet bestaan. Geen schermbeschrijvingen — die horen bij etappe 3, en `verify:docs` gaat over
`public/docs/`, niet over dit bestand.

```bash
git add docs/library.md && git commit -m "docs(library): de verdeler-kern beschreven (B1c-etappe-2)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 3: `git status --short` hoort schoon te zijn**

---

## Zelfreview van dit plan (uitgevoerd)

**Spec-dekking (§4 e.v.).**

| spec-onderdeel | taak |
|---|---|
| Plaatsingsprotocol stap 1 (vaste last) | 10 (stap 3) |
| stap 2 (twee grootboeken, min-formule, geklemd ≥ 0) | 6 + 10 |
| stap 3 (rangorde, tekort zonder cascade, één pass) | 6 (boeken-alleen-bij-succes) + 10 |
| Onderbreek-modus + de vier afspraken | 7 (herkomst), 8 (as-conversie), 9 (plaatsing + in-progress); **invalidatie-wiring → etappe 3** |
| Naad: `calendarOk` | 5 |
| Naad: nul-guard conflictverzamelaar | 5 |
| Naad: `scanLimit`-horizon + eerlijke reden | 5 (reden) + 6 (horizon uit het profiel) |
| Naad: `reasonFor`/`maxCapacityOf` + nieuwe taxonomie | 4 (`CEILING_*`), 5 (`NO_WINDOW_IN_HORIZON`), 6 (`RESIDUAL_FULL`), 10 (`cannotMove` op documentniveau) |
| Naad: plafond-referentiepunt op een baseline die delays behoudt | 3 + 4 |
| Scope-behoudend toepassen, plek 1 (`levelResources`-strip) en 3 (plafond-baseline) | 3, 4 |
| Scope-behoudend toepassen, plek 2 (`applyLeveling`) | **etappe 3** (bewust, zie *Scope*) |
| §3.1 uncounted blokkeert | 10 (case 14) |
| §3.3a #63 impliciet gepind | 10 (case 13) |
| §6 pin en plafond als kern-invoer | 10 (`pinned`, `ceilingWorkdays`) |
| §9 testlijst "Verdeler" | 10 (cases 1–15, één op één) |
| §9 testlijst "Naad" | 5, 6, en 3 (scope-behoud) |
| §9 testlijst "Store-niveau" | **etappe 3** (dat is het schrijfpad) |

**Geparkeerde W0-bevindingen.** M10 → taak 1 (in de huidige code **BEVESTIGD**, zie de analyse daar).
L3 → taak 2. `scanLimit` als ondergrens-argument → taak 5 (eerlijke reden) én taak 6 (horizon uit het
restprofiel, met een expliciete "ondergrens-argument"-alinea in het grootboek-docblok).

**Byte-identiteit als dragende eis.** Elke motoroptie die dit plan toevoegt is optioneel en default-uit
(`scopeTaskIds`, `overrunCeilingDays`, `poolLedger`, `allowSplits`). Taken 1 en 5 zijn de enige die
bestaand gedrag **bewust** veranderen: taak 1 wist de sub-dag-velden mee (M10), taak 5 verschuift de
diagnose van "kalender-mismatch" naar een capaciteits-/horizonreden waar het geen kalender betrof.
Beide stappen zeggen expliciet dat een rode bestaande case eerst begrepen en pas dán — mét
commentaarregel — bijgesteld wordt.

**Drie plekken waar dit plan concretiseert (en dat markeert):** de plaats van de as-conversie
(taak 8, `splitWalk.ts` in plaats van `duration.ts`), de v1-grens van de onderbreek-modus (taak 9,
alleen WORKTIME/dag/`completion === 0`), en de lezing van "float eerst, uitschieter minimaal"
(taak 10: dat ís de vroegste-venster-plaatsing van de bestaande SGS, geen tweede algoritme).

**Open aannames die de uitvoerder moet verifiëren** (staan óók in de betreffende stap): of er al een
bestaande IFC-round-trip-batterij voor `splitGaps` is (taak 7 stap 1), welke constraint-vorm
`lateStart` daadwerkelijk vóór de PF trekt (taak 4 geval 3), en of een bestaande leveling-/MCP-case op
de oude `CALENDAR_MISMATCH`-conflatie leunt (taak 5 stap 3).
