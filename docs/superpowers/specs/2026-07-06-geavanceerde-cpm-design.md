# Ontwerp: Fase 2.9 — Geavanceerde CPM

*Status: **BINDEND ontwerp** (implementatie nog niet gestart). Elke scharnier-beslissing citeert het
exacte `bestand:regel` waar hij op steunt; die regelnummers zijn in deze sessie tegen de echte broncode op
branch `fase-2.8b` gecontroleerd (niet blind uit research overgenomen). Wat niet zelf-geverifieerd is, staat
expliciet als **UNVERIFIED**.*
*Bron: [Rapport A — codebase-inventory](2026-07-06-2.9-research-codebase.md), [Rapport B —
domeinonderzoek](2026-07-06-2.9-research-domein.md). Conventie & diepgang: het 2.8b-doc
[2026-07-06-uren-scheduling-design.md](2026-07-06-uren-scheduling-design.md).*

Fase 2.9 (`docs/TODO.md` §2.9) maakt de CPM-kern "compleet" ten opzichte van P6/MSP: alle constraint-types
inclusief logica-brekende Mandatory-pins en secundaire constraints, hammock-taken, externe (cross-project)
dependencies, near-critical-analyse, meerdere kritieke paden, interfering float, en een project-scoped
scheduling-options-blok. Alles bouwt op de 2.8b-erfenis (minuut-granulariteit, `CalendarEngine`-uur-modus,
fractionele float) en moet in **dag- én uur-modus** kloppen.

---

## 1. Doel & scope

### In scope (de 7 TODO-punten)

1. **Constraints compleet** — logica-brekende **Mandatory Start/Finish** (harde pin) naast de bestaande
   soft-typen; **secundaire constraint** (P6 primair+secundair); constraints **uur-modus-correct** (nu
   dag-verankerd, §4.1).
2. **Hammock-taken** (P6 Level of Effort) — afgeleide duur die spant tussen start- en finish-driver;
   her-spant bij verschuivende dragers; uitgesloten van het kritieke pad.
3. **Externe dependencies** — cross-project links via het P6 *External-Dates*-model (bevroren anker-datum),
   met expliciet ontbrekende-bron-gedrag. **Geen** live multi-document-solve.
4. **Near-critical path** — instelbare drempel; markeer `0 < tf ≤ drempel`.
5. **Meerdere kritieke paden / multiple float paths** — driving-logic-peeling (Free Float) én
   TF-rangschikking; `floatPath`-nummer per taak.
6. **Interfering float** — `totalFloat − freeFloat` (getekend, fractioneel in uur-modus).
7. **Scheduling options** — project-scoped blok: lag-kalender-keuze (4-way), kritiek-definitie (TF≤x /
   longest path), open-ended-critical, TF-berekeningswijze, near-critical-drempel, float-paths.

### Expliciet buiten scope (met fase-/bron-verwijzing)

- **Live cross-project solve** (twee documenten tegelijk herrekenen) — raakt de bewust uitgestelde
  store-singleton-refactor (Rapport A §4, TODO §2.7 "vergt store-singleton-refactor"). 2.9 gebruikt **enkel
  bevroren anker-datums** (P6 External-Dates, Rapport B §3.1). **Later.**
- **Expected Finish-constraint** (P6-specifieke duur-override, Rapport B §1.5) — laag nut, exacte
  formule UNVERIFIED. **Later.**
- **Independent float** (INDF, Rapport B §6) — duurder (vergt predecessor-late-finish-doorgifte);
  interfering wél, independent later.
- **Native `IfcRelAssociatesConstraint/IfcObjective/IfcMetric`-graf** (Rapport B §8.1) — 2.9 blijft op de
  custom pset `OPS_Constraints` (uitgebreid); de spec-conforme graf is aspiratie, geen 2.9-eis.
- **Sub-shift resource-nivellering van hammocks** — de leveler blijft dag-emmer-gebaseerd (2.8b §5.6).

### Backwards-compat is de eerste invariant

**Elke nieuwe optie heeft als DEFAULT exact het huidige gedrag.** Dit is geen belofte maar een constructie:
alle nieuwe velden zijn optioneel, en zolang ze afwezig zijn raakt de uitvoering geen enkele nieuwe
gedragswijzigende tak. Regressie-poort: **319 handberekende cases byte-identiek groen** (`tests/planning/`,
19 batterijen, zelf-geteld: `grep -rho '"id"' tests/planning/*.json | wc -l` → 319) + de **4
check-batterijen** (`check-holidays`, `check-datetime`, `check-calendar-hours`, `check-adapters-hours`, zie
`tests/planning/run.sh`) + `verify:examples` (`package.json:15`). De invariant wordt per feature bewezen in
§8.

---

## 2. Grondslag-invarianten voor élke 2.9-feature

1. **Default = huidig gedrag, byte-identiek.** Elke optie leest uit een nieuw *optioneel* veld op `Project`
   of `Task`; afwezig ⇒ de bestaande expressie. De solver-condities zijn zó geschreven dat een 2.8b-document
   (geen 2.9-velden) precies de huidige tak evalueert — net als de 2.8b uur-opt-in (2.8b §2.2).
2. **Dag- én uur-modus.** Elke datum-rekenstap delegeert aan `CalendarEngine`, die sinds 2.8b modus-bewust
   is (`isHourMode`, geverifieerd `CalendarEngine.ts:254`). Nieuwe grenzen gebruiken de instant-vinders
   (`nextWorkInstant`/`prevWorkInstant`, `CalendarEngine.ts:374-394`) in uur-modus en de bevroren dag-lussen
   in dag-modus. Float blijft in eigen-kalender-werkdagen: integer in dag-modus, fractioneel in uur-modus via
   `signedFloat` (geverifieerd `CPMSolver.ts:242-245`).
3. **Domeinlogica in TypeScript** (project-mandaat "Keep Rust thin"). Alle 2.9-rekenkern zit in
   `src/engine/scheduler/`; Rust/WASM raakt niets.
4. **Per feature een IFC/P6/MSPDI-mapping of een expliciet "niet uitdrukbaar, met bron"** (§6).
5. **Scheduling-options horen bij het PROJECT(bestand), niet de app-settings** — gemotiveerd in §7.

---

## 3. Datamodel (exacte TS-types)

### 3.1 Constraints: harde pin + secundaire constraint

`ConstraintType` (`task.ts:26`) en `TaskConstraint` (`task.ts:28-32`) blijven; twee optionele uitbreidingen.

```ts
export interface TaskConstraint {
  type: ConstraintType;
  date?: string;              // date-only (dag) of datetime (uur, §4.1); ongewijzigd default
  /** OPTIONEEL — logica-brekende Mandatory-pin (fase 2.9). Alleen zinvol voor MSO/MFO.
   *  Afwezig/false ⇒ P6-soft "Start On"/"Finish On" (het huidige gedrag, byte-identiek).
   *  true ⇒ P6 Mandatory Start/Finish: pint ES én LF (MSO) resp. EF én LS (MFO) op de datum,
   *  overschrijft de logica, houdt TF=0 op de pin en drijft negatieve float upstream (§4.2). */
  hard?: boolean;
}

export interface Task {
  // … bestaand …
  constraint?: TaskConstraint;   // PRIMAIR (ongewijzigd, task.ts:110)
  /** OPTIONEEL — SECUNDAIRE constraint (fase 2.9, P6). Altijd soft (hard verboden op secundair).
   *  Combinatie-regel (P6, Rapport B §1.3): secundair NIET toegestaan als primair Start On/Finish On/
   *  Mandatory is; verder één forward-type + één backward-type die elkaar niet tegenspreken. */
  constraint2?: TaskConstraint;
}
```

**Motivatie `hard`-vlag i.p.v. nieuwe types `MSO_HARD`/`MFO_HARD`:** de vlag houdt de solver-tak minimaal
(één predicaat), en levert exact de soft/hard-splitsing die de **adapters** sowieso nodig hebben (OPS-soft
MSO ↔ P6 `CS_MSO` "Start On"; OPS-hard MSO ↔ P6 `CS_MANDSTART` — Rapport B §8.3). Overwogen-en-verworpen:
aparte union-leden zouden `ConstraintType` in 14 talen + `fieldCatalog` + alle `switch (type)` raken zonder
extra semantische winst. `mandatory` op `Task` (`task.ts:89`) blijft een louter rapportage-markering
(ongewijzigd) — verwar het niet met deze pin.

### 3.2 Hammock-taken

```ts
export interface Task {
  /** OPTIONEEL — hammock/LOE (fase 2.9). Afwezig/false ⇒ gewone taak (byte-identiek).
   *  true ⇒ duur wordt AFGELEID (span tussen start-driver en finish-driver, §4.3);
   *  scheduleDuration/durationMinutes worden genegeerd als invoer en overschreven met de span.
   *  Uitgesloten van het kritieke pad (isCritical altijd false). */
  isHammock?: boolean;
}
```

Een hammock is nog steeds een **leaf** (`childIds` leeg) — hij gaat dus mee door de forward/backward pass
(die nu leaf-only is, `scheduleSlice.ts:57`), i.t.t. WBS-summary's die ná de pass oprollen
(`scheduleSlice.ts:91-121`). De drivers zijn **gewone relaties**: de **start-driver** = de bindende
`SS`/`FS`-voorganger (levert `ES` zoals bij elke taak); de **finish-driver** = de bindende
`FF`/`SF`-voorganger (levert `EF` direct i.p.v. `ES ⊕ duur`). Geen nieuw relatietype nodig — we hergebruiken
de bestaande `SequenceType` (`sequence.ts:14-18`).

### 3.3 Externe (cross-project) dependencies

```ts
export interface ExternalLink {
  id: string;
  direction: 'predecessor' | 'successor';   // is de externe taak mijn voorganger of opvolger?
  relType: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays?: number; lagMinutes?: number;     // zelfde eenheid-conventie als Sequence (2.8b §3.3)
  /** Bevroren driving-datum van de andere kant (P6 External Dates, Rapport B §3.1). */
  anchorDate: string;                        // date-only (dag) of datetime (uur)
  sourceRef: { projectId: string; projectName?: string; taskId: string; taskName?: string; filePath?: string };
  /** true ⇒ bronproject niet beschikbaar; de link rekent op de gecachte anchorDate (ghost, §5.5). */
  sourceMissing: boolean;
}

export interface Task {
  /** OPTIONEEL — externe dependencies (fase 2.9). Afwezig ⇒ geen (byte-identiek). */
  externalLinks?: ExternalLink[];
}
```

**Anker-keuze:** `Project.id` (`project.ts:5`) — persistent en al de seed van de IFC-project-GlobalId
(geverifieerd `ifcWriter.ts:137` `ifcGuid(project.id)`), i.t.t. de per-sessie-verse interne document-`id`
(`documentSlice.ts:259`, Rapport A §4). `filePath` (`documentSlice.ts:59`) als secundair anker/label.
**UNVERIFIED:** of `Project.id` bij *inlezen* van elk formaat weer exact terugkomt (schrijven wél); te
verifiëren bij implementatie — desnoods `filePath` als fallback-match.

### 3.4 Scheduling options (project-scoped)

```ts
export interface SchedulingOptions {
  /** Kalender voor relatie-lag (P6 4-way, Rapport B §7.1). Default 'predecessor' = de huidige
   *  LAG_CALENDAR-constante (lagCalendar.ts:10) ⇒ byte-identiek. */
  lagCalendar?: 'predecessor' | 'successor' | '24hour' | 'projectDefault';
  /** Kritiek-definitie. Default { mode:'totalFloat', threshold:0 } = het huidige tf≤0 (CPMSolver.ts:1157). */
  criticalDefinition?: { mode: 'totalFloat' | 'longestPath'; threshold?: number };  // threshold mag negatief (P6)
  /** TF-berekeningswijze. Default 'smallest' = de huidige min(finish,start)-float (CPMSolver.ts:1150-1155). */
  totalFloatMode?: 'start' | 'finish' | 'smallest';
  /** Open-ended taken kritiek? Default = huidig gedrag (een eindtaak krijgt tf via LF−EF, CPMSolver.ts:1134). */
  makeOpenEndedCritical?: boolean;
  /** Near-critical-drempel in werkdagen (fractioneel in uur-modus). Default undefined ⇒ feature uit. */
  nearCriticalThreshold?: number;
  /** Multiple float paths. Default undefined ⇒ uit (byte-identiek). */
  floatPaths?: { enabled: boolean; method: 'FREE_FLOAT' | 'TOTAL_FLOAT'; maxPaths: number };
}

export interface Project {
  // … bestaand: statusDate, progressMode (project.ts:25-27) …
  /** OPTIONEEL — fase 2.9. Afwezig ⇒ elke default hierboven ⇒ byte-identiek gedrag. */
  schedulingOptions?: SchedulingOptions;
}
```

### 3.5 CPM-uitvoer + velden-catalogus

`CPMOptions` (`CPMSolver.ts:41-45`) krijgt de opties door:
```ts
export interface CPMOptions {
  dataDate?: string; progressMode?: 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE';   // bestaand
  schedulingOptions?: SchedulingOptions;                                       // NIEUW (fase 2.9)
}
```
`CPMResult` (`CPMSolver.ts:12-39`) breidt uit met:
```ts
  nearCriticalTaskIds: string[];             // 0 < tf ≤ drempel; leeg als drempel ongezet
  criticalPaths: string[][];                 // ALTIJD aanwezig, lengte ≥1; criticalPaths[0] == criticalPath
  floatPathByTask: Record<string, number>;   // 1 = meest kritiek; leeg als floatPaths uit
```
**`criticalPaths` is nooit `undefined`.** Wanneer `floatPaths` uit staat, is `criticalPaths` gewoon
`[criticalPath]` (lengte precies 1) — de bestaande enkele kritieke keten in een array gewikkeld. Zo hoeven
consumenten nooit op `undefined` te checken en werkt dezelfde renderpad-code met en zonder de floatPaths-optie.
`CPMTaskResult` (`CPMSolver.ts:60-68`) + `TaskTime` (`task.ts:44-75`) krijgen:
```ts
  interferingFloat?: number;   // = totalFloat − freeFloat (getekend, fractioneel in uur-modus)
  isNearCritical?: boolean;
  floatPath?: number;
```
Deze zijn **optioneel** en worden alleen geschreven wanneer de bijbehorende optie aanstaat ⇒ een
default-document serialiseert byte-identiek. **Velden-catalogus** (`types.ts:91-93`, Rapport A §2.3): voeg
`'freeFloat' | 'interferingFloat' | 'isNearCritical' | 'floatPath'` toe aan `BuiltinFieldKey` +
`FILTER_SORT_BUILTIN_KEYS` + `fieldKind` + `filterEval.ts` + `ColumnsDialog.tsx` + 14 i18n-labels (additief,
raakt geen bestaand veld).

---

## 4. Solver-ontwerp

De solver is engine-agnostisch: hij delegeert álle datumrekenkunde aan per-taak-`CalendarEngine`s
(`CPMSolver.ts:121-131`, 2.8a) en kiest de eenheid via `isHourMode`. De 2.9-wijzigingen zitten strak achter
optie-/vlag-condities.

### 4.1 Constraints uur-modus-correct

**Bevinding (zelf-geverifieerd, scharnierpunt):** `constraintDate` (`CPMSolver.ts:597-602`) parst met
`parseDate` (dag-only), en `applyForwardConstraint`/`applyBackwardBound` (`:609-653`) gebruiken uitsluitend
dag-primitieven (`nextWorkDay`/`prevWorkDay`/`addWorkingDaysSigned`). **Constraints zijn dus vandaag
dag-granulair, óók op een uur-kalender-taak** — de her-snap op `:438/474` repareert alleen de ES-consistentie
(2.8b golf 3), niet de datum zelf.

**2.9-besluit:** constraints worden **instant-bewust, maar blijven dag-verankerd by default.**
- Nieuw `constraintInstant(task, c, eng)`: dag-modus ⇒ `parseDate` (byte-identiek); uur-modus ⇒
  `parseInstant` (behoudt tijd-van-de-dag, `CPMSolver.ts:149` `parseIn`-patroon).
- `applyForwardConstraint`/`applyBackwardBound` worden modus-neutraal: dag-modus roept de bevroren
  dag-primitieven aan (**byte-identiek**); uur-modus gebruikt `nextWorkInstant`/`prevWorkInstant` +
  `addWorkingMinutesSigned` (`CalendarEngine.ts:374-394,474`), met de duur-terugvertaling via
  `durationMinutesOf` i.p.v. `scheduleDuration−1`.
- Een **date-only** constraint-string op een uur-taak ankert op de dag-grens ⇒ wordt door
  `nextWorkInstant`/`prevWorkInstant` naar de eerste/laatste werk-instant van die dag gesnapt (voorspelbaar).
  Een **datetime**-string (opt-in) draagt tijd-van-de-dag en wordt tot de minuut gehonoreerd (scenario 13).

De her-snap `snapOnOrAfter` (`:438/474`) blijft en wordt in uur-modus `nextWorkInstant` — al aanwezig
(`CPMSolver.ts:151-152`).

### 4.2 Mandatory-pin (logica-brekend) — de kern van 2.9-constraints

De huidige soft-architectuur verschuift **nooit** balken: forward neemt `max(bound, earlyStart)`
(`:621`), backward neemt `min` (`:639,642`). Een harde pin is fundamenteel anders: hij **overschrijft** en
**breekt de doorgifte**.

**Semantiek (P6, Rapport B §1.2/§4):** Mandatory Start pint `ES = LS = datum` én daarmee `EF = LF =
datum ⊕ (duur−1)` → TF=0 op de pin; negatieve float alleen **upstream** (voorgangers die de datum niet
halen). Mandatory Finish spiegelt op de finish. De pin **blokkeert** dat een strengere late-constraint verder
downstream negatieve float dóór de pin heen propageert.

**Implementatie — een pin is een barrière in béíde passes:**
- **Forward:** vóór de `max`-combinatie, als `constraint.hard && type==='MSO'`: zet
  `earlyStart = snap(constraintInstant)` **onvoorwaardelijk** (override de voorganger-`max`). Voor `MFO`:
  `earlyFinish = snap(datum)`, `earlyStart = earlyFinish ⊖ duur`. Registreer een **logica-schending** wanneer
  de voorganger-druk (`rawMax`, `:446`) later valt dan de pin — dát is de "logica-brekende" situatie (taak
  start vóór z'n voorganger klaar is). Downstream rekent gewoon door vanaf de gepinde EF.
- **Backward:** als hard, zet `lateStart/lateFinish = de gepinde waarden` **onvoorwaardelijk** (override de
  successor-`min`). Zo blijft `ES=LS`/`EF=LF` op de pin ⇒ `tf=0`; upstream krijgt via de gepinde `LS` zijn
  bovengrens en wordt negatief als het niet past. De override "reset" de late-datum bij de pin ⇒ downstream
  negatieve float propageert niet dóór de pin (P6-blokkade).

Byte-identiteit: `hard` afwezig/false ⇒ geen override-tak ⇒ de bestaande `max`/`min` draaien
(alle 319 cases hebben `hard` nergens). De pin krijgt eigen dag- én uur-cases (scenario 8).
`violatedConstraintTaskIds` (`:1096,1169-1172`) wordt uitgebreid met de hard-pin-logicaschending.

### 4.3 Secundaire constraints

`applyForwardConstraint`/`applyBackwardBound` lussen over `[constraint, constraint2]`: elke forward-type
(SNET/FNET/MSO/MFO) levert een ondergrens (`max`), elke backward-type (SNLT/FNLT/MSO/MFO) een bovengrens
(`min`). Twee bounds stapelen dus gewoon. Validatie (UI + import, Rapport B §1.3): weiger secundair bij
primair Start On/Finish On/Mandatory; venster-semantiek SNET-primair + FNLT-secundair = start-onder- +
finish-bovengrens (scenario 9). `constraint2.hard` is verboden (altijd soft). De schendings-detectie
(`:1164-1173`) evalueert beide constraints.

### 4.4 Hammocks

Een hammock loopt mee in de forward pass in topologische volgorde (drivers staan er per definitie vóór).
- **Start-anker (ES):** exact de gewone forward-`max` over `SS`/`FS`-voorganger-bounds + projectstart-vloer
  (`:440-459`) — ongewijzigde code.
- **Finish-anker (EF):** i.p.v. `ES ⊕ duur`, `EF = max` over de `FF`/`SF`-voorganger-bounds (de finish-side
  grenzen die de solver al berekent), met ondergrens `ES` (een hammock is nooit negatief lang). De
  **afgeleide duur** = `span(ES, EF)` = `workDaysBetween`/`workMinutesBetween` (uur-modus fractioneel).
- Omdat EF uit de drivers volgt en die eerder in topo-volgorde staan, **her-spant** de hammock in één
  forward pass; verschuift een driver, dan verschuift EF automatisch bij de volgende `runCPM` (scenario 10).
- **Backward pass (normatief).** Een hammock is een *gevolg*, geen oorzaak: er loopt **geen
  late-datum-doorgifte** doorheen. De gewone backward-`min`-combinatie wordt voor een hammock
  **overgeslagen**; in plaats daarvan geldt per definitie `LS = ES` en `LF = EF`. Daaruit volgt `tf = 0` en
  `ff = 0` — maar dit is een *definitorische* nul, geen kritiek-signaal: `isCritical` is geforceerd `false`
  (zie hieronder) en de hammock doet **niet** mee in de float-paths-peel (§4.6), de near-critical-set of
  `criticalPaths`. Cruciaal: de **inkomende relaties van de drivers** krijgen hun backward-druk **niet** via
  de hammock — omdat de hammock geen `LS/LF` naar boven doorgeeft, kan een strakke opvolger van de hammock
  nooit via de hammock heen negatieve float op de start-/finish-driver leggen. De driver ondervindt alleen de
  late-datums van zijn *eigen* (niet-hammock) opvolgers.
- **Kritiek:** `isCritical` geforceerd `false` (P6: LOE is een gevolg, geen oorzaak, Rapport B §2.1).
  Uitgaande relaties van een hammock rekenen gewoon door maar de hammock zelf telt nooit in `criticalPath`.
  Gedocumenteerde beperking: een hammock zonder finish-driver valt terug op `ES` (nul-lengte) + waarschuwing.

Byte-identiteit: `isHammock` afwezig ⇒ de gewone `ES ⊕ duur`-tak (`:402-403`) draait en de gewone
backward-`min`-combinatie loopt ongewijzigd.

### 4.5 Externe dependencies

Een externe link wordt in de forward/backward pass behandeld als een **bevroren datum-grens** — precies de
constraint-machinerie, geen nieuwe pass:
- `direction:'predecessor'` (externe taak = mijn voorganger): `anchorDate + relType + lag` → een
  forward **ondergrens** op mijn `ES`/`EF` (als een SNET/FNET). Bij `sourceMissing` identiek (we rekenen
  altijd op het anker — P6 External Dates degradeert de live-relatie naar een early-start-constraint,
  Rapport B §3.1).
- `direction:'successor'` (externe taak = mijn opvolger): `anchorDate` → een backward **bovengrens** op mijn
  `LF`/`LS` (als een FNLT/SNLT — P6 External Late Finish).
- **Geen cyclusrisico** (het is een datum, geen graaf-edge); de bestaande interne cyclusdetectie
  (`CPMSolver.ts:248` `detectCycle`) blijft ongewijzigd.
- **Ontbrekende-bron-gedrag (expliciet):** 2.9 rekent *altijd* op de gecachte `anchorDate` (geen live
  solve). `sourceMissing` is puur een **UI-/verse-heid-signaal**: ghost-styling + "bron niet geladen,
  her-importeer om te verversen" (scenario 15). Zo vermijden we volledig de store-singleton-refactor (§1).

### 4.6 Near-critical, interfering float, multiple float paths (analyse-laag)

Alle drie zijn **afleidingen bovenop de bestaande float** — geen wijziging aan forward/backward:

- **Interfering float** = `totalFloat − freeFloat` (getekend), beide al berekend (`:1134-1155`). Fractioneel
  in uur-modus (erft `signedFloat`). Toegevoegd in `computeResults` naast `totalFloat`/`freeFloat`.
- **Near-critical:** `isNearCritical = thr!=null && tf>0 && tf ≤ thr`. `nearCriticalTaskIds` verzameld in
  `computeResults`. Drempel-eenheid volgt de float-eenheid (werkdagen; fractioneel in uur-modus).
- **Kritiek-definitie-optie:** `criticalDefinition.mode==='totalFloat'` ⇒ `isCritical = tf ≤ threshold`
  (default 0 = huidig `:1157`). `'longestPath'` (normatief): **kritiek = elke taak die op een driving-keten
  naar de laatste project-finish ligt** — onafhankelijk van de `tf`-waarden. Het algoritme is exact de
  **Free-Float-peel van pad 1** (§4.6, hieronder): `traceFrom` over `drivingSequenceIds` vanaf de taak/taken
  met de grootste `EF`; de gevonden `drivingPredecessors ∪ {end}` zijn kritiek. **Bij ties** — meerdere
  eindtaken met dezelfde grootste `EF` — zijn **alle** zulke driving-ketens kritiek (elke eindtaak levert een
  eigen peel; de unie is de kritieke set). `tf` speelt in deze modus geen rol in de kritiek-bepaling; het
  wordt nog wel berekend en gerapporteerd. Longest-path is de betrouwbare keuze bij multi-kalender/uur-modus,
  waar pure TF-gelijkheid onbetrouwbaar is (Rapport B §5). Hammocks doen nooit mee (§4.4).
- **Multiple float paths** — post-pass op het vaste `CPMResult`, hergebruikt de driving-hooks
  (`drivingSequenceIds`/`sequenceFreeFloat`, geverifieerd `:1094-1111`) en `graphWalk.traceFrom` met
  `allowedSeqIds = drivingSeqIds` (geverifieerd `graphWalk.ts:36-55`):
  - **Free-Float-methode (driving-logic-peeling, aanbevolen):** de vroege datums veranderen *niet* door het
    peelen, dus dit is een **goedkope graaf-peel**, geen her-solve:
    1. `end` = niet-toegewezen taak met de grootste `EF`.
    2. `keten` = `traceFrom(end, seqs, drivingSeqIds).drivingPredecessors ∪ {end}`.
    3. Ken `floatPath = p` toe aan de nog niet-toegewezen taken in `keten`.
    4. Verwijder `keten` uit de kandidaten; herhaal tot `maxPaths` of leeg.
  - **Total-Float-methode:** rangschik op distinct `tf`; `floatPath` = rang (1 = kleinste tf).
  - `criticalPaths` = alle gepeelde ketens waarvan de keten kritiek is (`tf ≤ threshold`); `criticalPaths[0]`
    blijft de huidige `criticalPath` (byte-compat, scenario 11).

Byte-identiteit: `nearCriticalThreshold`/`floatPaths` ongezet ⇒ deze passes draaien niet; `interferingFloat`
is een nieuw optioneel veld dat de harness alleen vergelijkt als een case het in `expect` zet.

---

## 5. UI-schets per feature (beknopt)

- **§5.1 Mandatory-pin** (besluit B2) — `TaskPropertiesPanel` constraint-sectie (`:325-329`-buurt): naast het
  type-dropdown een **"Verplicht (pin logica)"**-checkbox, alleen actief bij MSO/MFO. Een gepinde balk
  krijgt in de Gantt een **pin-glyph** en, bij logica-schending, de bestaande violated-markering
  (`GanttRenderer.ts` constraint-markers r810-837, Rapport A §1.5) in een **waarschuwkleur**. Bij het
  **aanzetten** van de pin verschijnt éénmalig een **niet-blokkerende hint** ("pin overschrijft relaties") —
  geen bevestigingsdialoog.
- **§5.2 Secundaire constraint** — een tweede type+datum-rij onder de primaire, met live validatie van de
  verboden combinaties (rood + tooltip met de reden).
- **§5.3 Hammock** (besluit B6) — een **"Hammock (afgeleide duur)"**-toggle in `TaskPropertiesPanel`; het
  duur-veld wordt read-only en toont de afgeleide span. De drivers worden **auto-gedetecteerd** (SS/FS-kop =
  start-driver, FF/SF-kop = finish-driver, P6-conventie §3.2/§4.4); het paneel toont **read-only wélke
  relaties** als start- resp. finish-driver zijn gekozen (voorspelbaarheid zonder klikwerk). De Gantt-balk
  krijgt de LOE-conventie (dunne/haakvormige balk).
- **§5.4 Near-critical & meerdere paden** (besluit B3/B4) — de bestaande balkkleur-tak
  (`GanttRenderer.ts:626`, Rapport A §6) krijgt een derde geval: `isNearCritical ? nearCriticalColor : …`
  (oranje-band tussen kritiek rood en float groen). Near-critical staat **default uit**; aangezet is de
  **default-drempel 2 werkdagen** en de drempel-weergave **volgt de Duurweergave-instelling** (dagen of uren).
  **BINDEND user-besluit (2026-07-06): in het high-contrast-thema is kleur alléén onvoldoende — de
  near-critical-balk krijgt daar een geblokt/gearceerd vulpatroon** (canvas-pattern, bv. diagonale blokjes)
  bovenop de themakleur, zodat het onderscheid met kritiek en normaal zonder kleurwaarneming leesbaar is;
  in licht/donker blijft de amber-kleur het primaire signaal (patroon daar niet nodig). Het patroon rendert
  via een gememoized `CanvasPattern` in `GanttRenderer` (geen per-frame-creatie).
  Float-path-nummer als optionele kolom + optionele tint per pad (**default `FREE_FLOAT`, `maxPaths 10`**).
- **§5.5 Externe dependency** (besluit B7) — een **"Externe koppeling…"**-actie in het relatiepaneel: kies een
  taak uit een recent bestand (`fileSlice.ts:69` `getRecentFiles`) — we openen dat bestand **read-only** en
  tonen de taaklijst — met relType + lag; handmatig `projectId/taskId` plakken is de **fallback** in dezelfde
  dialoog. De externe taak toont als **ghost-balk** (MSP-conventie: grijs, Rapport B §3.2); `sourceMissing` ⇒
  gestippeld + "verouderd"-badge. Verversen kan **per link** (ververs-knopje) én projectbreed
  ("**Ververs externe ankers**"-actie).
- **§5.6 Interfering float** — read-only in `TaskPropertiesPanel` (`:490-493`-buurt) naast total/free; als
  filter-/kolom-veld (§3.5).
- **§5.7 Scheduling options** (besluit B5) — een nieuwe **"Berekening"**-sectie in de bestaande
  project-info/-instellingen-dialoog (§7), aanhakend bij waar `progressMode` nu zit; **geen** aparte dialoog.
  **UNVERIFIED:** de exacte huidige UI-plek van `progressMode` (Rapport A §5) — te lokaliseren in golf 7.

---

## 6. Adapter-mapping per feature

| Feature | IFC 4.3 | P6 XML | MSPDI |
|---|---|---|---|
| **Soft constraint (bestaand)** | pset `OPS_Constraints` (`ifcWriter.ts:389-410`) | **nu leeg** → `cstr_type`/`cstr_date` `CS_MSO/MSOA/MSOB/MEO/MEOA/MEOB/ALAP` (Rapport B §8.3) | **nu leeg** → `ConstraintType` 4-7, `<Deadline>` (Rapport B §8.2) |
| **Hard pin (Mandatory)** | pset `OPS_Constraints.Hard` (bool) | `cstr_type` = `CS_MANDSTART`/`CS_MANDFIN` | `ConstraintType` 2/3 (Must, = hard) — **hier klopt de semantiek** |
| **Secundaire constraint** | pset `OPS_Constraints.ConstraintType2/Date2` | `cstr_type2`/`cstr_date2` (native, Rapport B §8.3) | **niet uitdrukbaar** — MSPDI kent één `ConstraintType`-element (bron: MS Learn ConstraintType-element). App-warn bij export |
| **Soft↔hard-mismatch** | — | soft MSO→`CS_MSO`; hard MSO→`CS_MANDSTART` (correct gescheiden) | **soft** MSO mag **niet** naar MSPDI `2` (hard). Best-effort: soft Start On → `SNET`(4); documenteer het semantiek-verlies |
| **Hammock/LOE** | **niet native** (`IfcTaskTypeEnum` heeft geen LEVELOFEFFORT, Rapport B §8.1) → custom pset `OPS_Hammock` | P6 heeft native LOE-activity-type — **UNVERIFIED** exacte `task_type`-code; aspiratie | **niet native** (paste-link-hack) → export als gewone taak met berekende datums + warn |
| **Externe link** | **niet native** (geen cross-project `IfcRelSequence`, Rapport B §8.1) → custom pset `OPS_ExternalLink` | native external relationships/External Dates — aspiratie; minimaal `anchorDate` bewaren | **niet native** buiten master/subproject-context → custom/omit; ghost blijft in-app |
| **Near-critical / interfering / float-path** | **afgeleiden — niet serialiseren** (herbereken bij load; `IsCritical/FreeFloat/TotalFloat` al native `ifcWriter.ts:651`) | idem niet serialiseren | idem (`Critical`/`TotalSlack`/`FreeSlack` zijn afgeleid) |
| **Scheduling options** | custom pset `OPS_SchedulingOptions` op `IfcWorkSchedule` | native SCHEDOPTIONS — aspiratie | deels native (`CriticalSlackLimit`); lag-kalender **niet uitdrukbaar** |

**Rode draad interop-schuld (Rapport B §12):** P6-XML en MSPDI round-trippen taak-constraints **nu niet**
(zelf-bevestigd in de research-greps); 2.9 moet minimaal het soft-constraint-pad in beide bouwen, plus de
hard/secundair-uitbreiding. Custom psets (`OPS_Hammock`/`OPS_ExternalLink`/`OPS_SchedulingOptions`) zijn
gedocumenteerde OPS-extensies, net als het bestaande `OPS_Constraints`.

---

## 7. Plaatsing van de scheduling options — motivatie

**Besluit: op `Project` (het bestand), niet in de app-settings.** Verificatie (Rapport A §5, zelf tegen code
gecontroleerd): `progressMode` en `statusDate` zitten al **op `Project`** (`project.ts:25-27`) en gaan via
`CPMOptions` de solver in (`scheduleSlice.ts:59-60`); alleen `autoCalcCPM` (een UI-gemak) zit app-globaal in
`ui` (Rapport A §5). De reken-opties horen daarom op het project omdat:

1. **Reproduceerbaarheid.** Een scheduling-option verandert de *berekende* planning. Zat hij app-globaal, dan
   zou hetzelfde bestand op twee machines/gebruikers een ander schema geven — onacceptabel voor een gedeeld
   planningsbestand, en het zou `verify:examples` (byte-identieke voorbeelden) onherhaalbaar maken.
2. **Consistentie met bestaand model.** `progressMode`/`statusDate` staan al op `Project`; het opties-blok is
   de natuurlijke uitbreiding, gevoed via het bestaande `CPMOptions`-kanaal.
3. **De 3-surfaces-settings-regel geldt voor APP-opties** (MEMORY: gear/ribbon/backstage delen één
   settings-content). Reken-opties zijn géén app-opties ⇒ ze horen **niet** op die drie surfaces, maar in een
   **project-scoped** "Berekening"-sectie (project-info/-instellingen-dialoog). `autoCalcCPM` blijft
   app-globaal (het is puur "herbereken automatisch", geen rekenkeuze).

De `LAG_CALENDAR`-constante (`lagCalendar.ts:10`) wordt de **fallback-default**: de solver leest
`schedulingOptions.lagCalendar ?? LAG_CALENDAR`. **De default blijft `'predecessor'`** — niet omdat de bron
eenduidig is (Rapport B §7.1 meldt een tegenstrijdige bron die "successor" als de-facto P6-default noemt),
maar omdat `cases-kalenders.json` scenario 2 op predecessor is geijkt; de default wijzigen zou die case
breken. We ontsluiten de 4-way-keuze en documenteren beide semantieken (**besluit B1, §11**).

---

## 8. Testplan

### 8.1 Regressie-poort (ongewijzigd groen)

`bash tests/planning/run.sh` (19 batterijen, **319 cases**) + de 4 check-batterijen + `npm run
verify:examples`. Elke 2.9-golf draait dit vóór commit; byte-identiek is de merge-poort (MEMORY: geverifieerd
bewijs, geen ongeverifieerde "done").

### 8.2 Harness-uitbreidingen (`tests/planning/harness.ts`)

De case-DSL (header `harness.ts:6-40`) breidt additief uit — bestaande cases parsen ongewijzigd:
- `tasks[].constraint.hard?: boolean`; `tasks[].constraint2?: {type,date}`.
- `tasks[].hammock?: boolean`.
- `tasks[].externalLinks?: [{direction,relType,lag,anchorDate,sourceRef,sourceMissing}]`.
- `schedulingOptions?: {…}` op case-niveau → doorgegeven aan `runCPM`.
- `expect.tasks[].intf?` (interfering), `.nearCrit?` (bool), `.floatPath?` (nr).
- `expect.nearCriticalSet?`, `expect.criticalPaths?: [[names]]`, `expect.floatPaths?: {name:nr}`.

### 8.3 Nieuwe batterij `cases-advanced-cpm.json`

Alle §9-scenario's, **elk in dag- én uur-variant** waar zinvol (constraint-, pin-, hammock-, external-,
near-critical-, float-path-, interfering-cases). Uur-varianten op de H8-referentiekalender (band `[480,960]`),
naar het model van `cases-hours.json`. Byte-identiteit-cases: één "hard=false/absent ⇒ soft"-tweeling, één
"isHammock afwezig ⇒ gewone taak"-tweeling, één "geen schedulingOptions ⇒ huidige tf/crit"-tweeling.
**Hammock-backward-case (§4.4):** een hammock met een strak-begrensde opvolger (bv. FNLT op een taak áchter
de hammock) moet aantonen dat de hammock `LS=ES`/`LF=EF` houdt, `isCritical=false` blijft, níét in
`criticalPaths`/near-critical/float-paths voorkomt, en dat de start-/finish-driver **geen** negatieve float
via de hammock krijgen (backward-druk loopt niet door de hammock heen).

### 8.4 Nieuwe check-batterij `check-advanced-cpm.ts`

Naar het model van `check-datetime.ts`/`check-calendar-hours.ts` (los van de CPM-cases,
`run.sh:48-70`): (a) driving-logic-peeling-invarianten (elke taak precies één `floatPath`;
`criticalPaths[0] == criticalPath`); (b) `interferingFloat == totalFloat − freeFloat` over álle bestaande
cases (mag geen bestaande float breken); (c) hard-pin-idempotentie (twee keer solve = zelfde datums);
(d) hammock-span = `workMinutesBetween(ES,EF)` in beide modi.

---

## 9. Handberekende scenario's (alle tussenstappen)

Kalender (tenzij anders): schone **ma-vr**, geen feestdagen, anker **ma 2026-06-01** (geverifieerd Maandag:
`cst-snet-binding` in `cases-constraints.json`). Uur-scenario's: **H8**-kalender (ma-vr band `[480,960]` =
08:00-16:00, `hoursPerDay=8`), anker **ma 2026-07-06**. Conventie: `signedWorkDays(a,b)=workDaysBetween−1`
(`CPMSolver.ts:590-593`); FS-opvolger = `nextWorkDayAfter(pred.EF)`; band `[start,end)`.

**S1 — SNET forward+backward (bindend).** A(3) →FS B(2), B SNET 06-08.
Forward: A.ES 06-01, A.EF 06-03. B: FS-bound `nextWDA(06-03)=06-04`; SNET-bound `nextWD(06-08)=06-08`;
`max=06-08` → B.ES 06-08, B.EF 06-09. ProjectEnd 06-09.
Backward: B.LF 06-09, B.LS 06-08. A.LF `prevWDB(06-08)=06-05`, A.LS 06-03.
Float: A tf `min(sf(06-03,06-05), sf(06-01,06-03))=min(2,2)=2`; A ff = relFloat(A→B)=`wdB(06-04,06-08)−1=2`.
B tf 0, kritiek. (Reproduceert `cst-snet-binding`.)

**S2 — SNLT backward, negatieve float.** A(3) →FS B(2), B SNLT 06-03.
Forward: A 06-01/06-03, B.ES 06-04, B.EF 06-05. ProjectEnd 06-05.
Backward: B eindtaak LF 06-05. SNLT kapt late start: `dW=prevWD(06-03)=06-03`, bound `addSigned(06-03,+1)=06-04`
< 06-05 → B.LF 06-04, B.LS 06-03. A.LF `prevWDB(06-03)=06-02`, A.LS 05-29.
Float: B tf `min(sf(06-05,06-04), sf(06-04,06-03))=min(−1,−1)=−1` → **violated** (es 06-04 > dW 06-03),
kritiek. A tf `min(sf(06-03,06-02),sf(06-01,05-29))=−1` → negatieve float propageert upstream.

**S3 — FNET forward.** A(2) →FS B(3), B FNET 06-10.
Forward: A 06-01/06-02. B FS-bound `nextWDA(06-02)=06-03`; FNET-bound `addSigned(nextWD(06-10),−2)=06-08`;
`max=06-08` → B.ES 06-08, B.EF 06-10 (finish ≥ 06-10, precies erop). A ff = relFloat(A→B)=`wdB(06-03,06-08)−1=3`.
Backward: B.LF 06-10, B.LS 06-08; A.LF 06-05, A.LS 06-04. A tf 3.

**S4 — FNLT backward (bindend, negatief).** A(2) →FS B(3), B FNLT 06-04.
Forward: A 06-01/06-02, B.ES 06-03, B.EF 06-05. Backward: FNLT `dW=prevWD(06-04)=06-04` < 06-05 → B.LF 06-04,
B.LS 06-02. B tf `min(sf(06-05,06-04),sf(06-03,06-02))=−1` → **violated** (ef 06-05 > dW 06-04). (Een
níét-bindende FNLT — datum ná de natuurlijke finish — geeft positieve float: `LF` schuift op tot de datum.)

**S5 — MSO soft (Start On), dubbel-begrensd.** A(1) →FS B(2) →FS C(1), B MSO 06-04.
Forward: A 06-01. B FS-bound `nextWDA(06-01)=06-02`; MSO-forward `nextWD(06-04)=06-04`; `max=06-04` → B.ES 06-04,
B.EF 06-05. C.ES `nextWDA(06-05)=06-08`, C.EF 06-08. ProjectEnd 06-08. A ff=relFloat(A→B)=`wdB(06-02,06-04)−1=2`.
Backward: C.LF 06-08, C.LS 06-08. B.LF `prevWDB(06-08)=06-05`; MSO-backward `addSigned(prevWD(06-04),+1)=06-05`,
`min=06-05` → B.LF 06-05, B.LS 06-04. B tf `min(sf(06-05,06-05),sf(06-04,06-04))=0` → **ES=LS=06-04** (start op
datum), kritiek. Toont MSO als onder- én bovengrens.

**S6 — MFO soft.** B(2) MFO 06-05, root.
Forward: MFO-forward `addSigned(nextWD(06-05),−1)=06-04` → B.ES 06-04, B.EF 06-05 (finish op datum).
Backward: MFO-backward `dW=prevWD(06-05)=06-05` → B.LF 06-05, B.LS 06-04. tf 0. Finish gepind op 06-05.

**S7 — ALAP (zero free float).** A(1); A →FS B(2); A →FS C(5).
Forward: A 06-01. B.ES 06-02, B.EF 06-03. C.ES 06-02, C.EF 06-08. ProjectEnd 06-08.
ALAP-pass op B (open-ended): ff = `sf(B.EF 06-03, B.LF 06-08)=wdB(06-03,06-08)−1=3` → schuif B met +3:
B.ES `addSigned(06-02,+3)=06-05`, B.EF `addSigned(06-03,+3)=06-08` (`applyAlap`, `:661-702`). B loopt nu zo
laat mogelijk (06-05..06-08), free float 0.

**S8 — Mandatory Start (hard) die logica breekt.** A(5) →FS B(2), B **hard** MSO 06-03.
Forward: A.ES 06-01, A.EF 06-05. Gewone FS zou B.ES ≥ 06-08 dwingen; de **harde pin overschrijft**:
B.ES `= nextWD(06-03) = 06-03` (**vóór A klaar is** — logica gebroken), B.EF 06-04. `rawMax` (06-08) > pin
(06-03) ⇒ **logica-schending geregistreerd**.
Backward: B hard-gepind → B.LF 06-04, B.LS 06-03 (override successor-druk) ⇒ **tf B = 0** (pin blijft
kritiek-neutraal). A.LF `prevWDB(06-03)=06-02` < A.EF 06-05 → A tf `sf(06-05,06-02)=−3` → **−3 negatieve
float upstream**. Contrast: soft MSO zou `max(06-08,06-03)=06-08` nemen (niet-bindend, geen breuk). Dit is
precies P6 Mandatory: TF=0 op de pin, negatieve float naar de voorganger, logica onderbroken.

**S9 — Secundaire constraint (venster, conflict).** B(3), primair SNET 06-03 + secundair FNLT 06-04, root.
Forward: SNET → B.ES 06-03, B.EF 06-05 (secundair backward-only, geen forward-effect).
Backward: FNLT-secundair `dW=prevWD(06-04)=06-04` < B.LF 06-05 → B.LF 06-04, B.LS 06-02.
B tf `min(sf(06-05,06-04),sf(06-03,06-02))=−1` → het venster [start≥06-03, finish≤06-04] is te krap voor een
3-daagse taak ⇒ **violated** + negatieve float. Twee bounds uit twee constraints op één taak.

**S10 — Hammock-span bij verschuivende dragers.** Driver A(3); B(2) met A →FS B. Hammock H met
start-driver `SS(A→H)` en finish-driver `FF(B→H)`.
Forward (B dur 2): A.ES 06-01, A.EF 06-03; B.ES 06-04, B.EF 06-05. H.ES = via SS = A.ES = **06-01**; H.EF =
via FF = B.EF = **06-05**; afgeleide duur = `wdB(06-01,06-05)=5` werkdagen. H uitgesloten van kritiek pad.
**Driver verschuift** (B dur 4): B.EF `addWorkDays(06-04,4)=06-09`. Her-span: H.EF = **06-09**, duur
`wdB(06-01,06-09)=7` werkdagen — de hammock rekt automatisch mee zonder eigen duur-invoer.

**S11 — Multiple float paths op een net met 3 paden.** A1(5), A2(4), A3(2), elk →FS END(1); allen root 06-01.
Forward: A1.EF 06-05, A2.EF 06-04, A3.EF 06-02. END.ES `max(nextWDA(06-05),nextWDA(06-04),nextWDA(06-02))=06-08`,
END.EF 06-08. ProjectEnd 06-08.
Backward: END.LF 06-08. A1.LF 06-05 → tf 0 (crit). A2.LF 06-05 → tf `sf(06-04,06-05)=1`. A3.LF 06-05 → tf
`sf(06-02,06-05)=3`.
Driving (relFloat = `wdB(seqConstraint, END.ES)−1`): A1→END `wdB(06-08,06-08)−1=0` → **driving**; A2→END
`wdB(06-05,06-08)−1=1`; A3→END `wdB(06-03,06-08)−1=3`.
Free-Float-peeling: **pad 1** end=END, driving-preds={A1} → {A1,END}, `floatPath=1` (kritiek). **pad 2**
volgende end=A2 (geen driving-preds) → {A2}, `floatPath=2`. **pad 3** = {A3}, `floatPath=3`. `criticalPaths`
= [[A1,END]]. TF-methode geeft dezelfde indeling (distinct tf {0,1,3}).

**S12 (gecorrigeerd) — Interfering float.** A(2) →FS X(2); W(6) →FS Y(2); X →FS Y; P(11) →FS END(1);
Y →FS END. Alle roots 06-01.
Forward: A.EF 06-02; W.EF 06-08 (6 wd: 1,2,3,4,5,8); P.EF 06-15 (11 wd: 1-5, 8-12, 15). X.ES
`nextWDA(06-02)=06-03`, X.EF 06-04. Y.ES `max(nextWDA(X.EF 06-04)=06-05, nextWDA(W.EF 06-08)=06-09)=06-09`
→ **Y door W gedreven**, Y.EF 06-10. END.ES `max(nextWDA(Y.EF 06-10)=06-11, nextWDA(P.EF 06-15)=06-16)=06-16`,
END.EF 06-16. ProjectEnd 06-16.
X **free float** = relFloat(X→Y) = `wdB(seqConstraint 06-05, Y.ES 06-09)−1 = (05,08,09 = 3) − 1 = 2`.
X **total float**: Backward END.LF 06-16, LS 06-16 → Y.LF `prevWDB(06-16)=06-15`, Y.LS 06-12; X.LF
`prevWDB(Y.LS 06-12)=06-11`, X.LS 06-10. X tf `min(sf(06-04,06-11), sf(06-03,06-10))=min(5,5)=5`.
**Interfering = total − free = 5 − 2 = 3.** Interpretatie: X kan 2 dagen uitlopen zonder iets te raken (free);
dag 3 t/m 5 schuift de niet-kritieke Y op zonder het projecteinde te raken (interfering 3); daarna raakt hij
het project.

**S13 — Constraint op een uur-kalender-taak.** H8-kalender, anker ma 2026-07-06. A(8u) SNET **di 2026-07-07T10:00**, root.
Forward: SNET-forward uur-modus = `nextWorkInstant(parseInstant("2026-07-07T10:00"))`. 07-07 10:00 ∈
band [08:00,16:00) → 07-07T10:00. A.ES = `max(anker 07-06T08:00, 07-07T10:00) = 2026-07-07T10:00`. A.EF =
`addWorkMinutes(07-07T10:00, 480)`: 10:00→16:00 = 360 min; rest 120 min → wo 07-08 08:00 +120 = **2026-07-08T10:00**.
Backward: A.LF = A.EF, tf 0. Contrast: een **date-only** SNET "2026-07-07" zou naar 07-07T08:00 snappen
(dag-grens → eerste werk-instant). Toont: constraint tot de minuut gehonoreerd op een uur-kalender; date-only
= dag-verankerd default.

**S14 — Near-critical-drempel.** Net van S11, `nearCriticalThreshold = 1` (werkdagen): A1 tf 0 → kritiek
(niet near); A2 tf 1 → `0<1≤1` → **near-critical**; A3 tf 3 → niet. Bij drempel 3: A2 én A3 near-critical.
In uur-modus is de drempel fractioneel (bv. 0,5 werkdag = 4u op H8).

**S15 — Externe dependency, ontbrekende bron.** Lokale L(3) met externe voorganger-link: relType FS, lag 0,
`anchorDate 2026-06-08` (gecachte finish van externe taak X in project P2), `sourceMissing=true`.
Forward: degradeer naar SNET-achtige ondergrens: L.ES ≥ `nextWorkDayAfter(06-08)=06-09` → L.ES 06-09,
L.EF 06-11. Identiek of de bron nu geladen is of niet (2.9 rekent altijd op het anker). `sourceMissing=true`
⇒ ghost-balk voor X (eindigend 06-08) + "verouderd, her-importeer"-badge. Geen cyclus-impact.

---

## 10. Golfindeling (met modeltoewijzing)

Elke golf eindigt met de volledige regressie-poort (§8.1) groen vóór commit; niets naar `main` tot 2.9 af +
getest (fase-mandaat). Vrijwel alles Opus (kern-CPM = fragiel).

| Golf | Inhoud | Model |
|---|---|---|
| **0 — Datamodel + plumbing** | §3-types (`constraint.hard`, `constraint2`, `isHammock`, `externalLinks`, `SchedulingOptions`, `CPMOptions`/`CPMResult`/`TaskTime`-velden); `runCPM` geeft `schedulingOptions` door; alles default-inert | Opus xhigh |
| **1 — Constraints compleet** | Mandatory-pin (§4.2, forward+backward barrière), secundaire constraint (§4.3), uur-modus-constraints (§4.1). **Meest fragiele golf** — raakt forward/backward-kern | Opus xhigh |
| **2 — Analyse-laag** | interfering float + near-critical + kritiek-definitie-opties (§4.6, deel); `FieldRef`-keys (§3.5) — i18n-labels mechanisch | Opus high (i18n: Sonnet/mechanisch medium) |
| **3 — Multiple float paths** | driving-logic-peeling + TF-rangschikking (§4.6), `criticalPaths`/`floatPath` (nieuw algoritme op `graphWalk`) | Opus xhigh |
| **4 — Hammocks** | afgeleide-span-pass (§4.4), kritiek-uitsluiting, uur-span | Opus xhigh |
| **5 — Externe dependencies** | `ExternalLink`-model + bevroren-anker-solve (§4.5) + ghost-UI + ontbrekende-bron-gedrag | Opus xhigh |
| **6 — Adapters** | soft-constraint-round-trip in P6+MSPDI (nieuw), hard/secundair, custom psets `OPS_Hammock`/`OPS_ExternalLink`/`OPS_SchedulingOptions` (§6) | Opus high |
| **7 — Scheduling-options-UI** | project-scoped "Berekening"-sectie (§5.7/§7), constraint-/hammock-/externe-UI-schetsen (§5) | Opus (wiring) + Sonnet high (form-UI) |
| **8 — Testbatterij + QA** | `cases-advanced-cpm.json` (dag+uur), `check-advanced-cpm.ts`, docs, volledige regressie + `verify:examples` | Opus high |

---

## 11. Out-of-scope (herhaald) + UX-besluiten

**Out-of-scope** (§1, samengevat): live multi-document cross-project solve (store-singleton-refactor);
Expected Finish; Independent float; native `IfcRelAssociatesConstraint`-graf; sub-shift-nivellering van
hammocks; P6/MSPDI native LOE/external round-trip waar de veldcodes UNVERIFIED zijn (aspiratie, geen eis).

**UX-besluiten (BINDEND — de gebruiker heeft de orchestrator gemandateerd deze instelbaar-achtige keuzes
zelf te beslissen; geen open vragen meer):**

- **B1 — Lag-kalender.** Default blijft `'predecessor'` (byte-identiteit van `cases-kalenders.json`
  scenario 2, §7). De 4-way-keuze (`predecessor`/`successor`/`24hour`/`projectDefault`) komt in het
  scheduling-options-blok (§3.4, §5.7). **Beide semantieken** worden gedocumenteerd (predecessor: lag in de
  kalender van de voorganger; successor: in die van de opvolger — Rapport B §7.1).
- **B2 — Hard-pin-UX.** Een gepinde balk krijgt een **pin-glyph** op de balk; bij logica-schending toont hij
  de bestaande violated-markering in **waarschuwkleur** (§5.1). Bij het **AANZETTEN** van een pin verschijnt
  een **eenmalige, niet-blokkerende hint** ("pin overschrijft relaties") — **geen** bevestigingsdialoog.
- **B3 — Near-critical.** Feature staat **default UIT**. Wie hem aanzet krijgt **default-drempel 2 werkdagen**
  (bouwconventie, strakker dan P6's 10). De **drempel-weergave volgt de Duurweergave-instelling**: dagen als
  Duurweergave op dagen staat, uren zodra die op uren staat (§5.4).
- **B4 — Float-paths.** Default-methode **`FREE_FLOAT`** (driving-logic-peeling, §4.6); default
  **`maxPaths = 10`**.
- **B5 — Plaatsing options-blok.** Een **"Berekening"-sectie in de bestaande project-info-/instellingen-
  dialoog**, aanhakend bij waar `progressMode` nu zit (te lokaliseren in golf 7, §5.7/§7). **Geen** aparte
  dialoog.
- **B6 — Hammock-authoring.** **AUTO-detectie** volgens P6-conventie (SS/FS-kop = start-driver, FF/SF-kop =
  finish-driver, §3.2/§4.4). Het eigenschappen-paneel toont **read-only wélke relaties** als start- resp.
  finish-driver zijn gedetecteerd (voorspelbaarheid zonder klikwerk).
- **B7 — Externe-dependency-flow.** De externe taak wordt gekozen uit een **recent bestand** (we openen het
  bestand **read-only** en tonen de taaklijst, §5.5). Daarnaast een projectbrede **"Ververs externe
  ankers"-actie** plus een **ververs-knopje per link**. Handmatig `projectId/taskId` plakken is **fallback**
  in dezelfde dialoog.
