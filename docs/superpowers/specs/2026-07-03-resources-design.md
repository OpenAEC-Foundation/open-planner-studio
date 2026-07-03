# Ontwerp: Fase 2.5 — Resources

*Status: **geïmplementeerd (2026-07-03)** — alle "invulling, te bevestigen bij
review"-punten zijn bevestigd; de review corrigeerde daarnaast §5.5 (levelingDelay t.o.v.
precedence-feasible start i.p.v. CPM-ES; capaciteitsgrootboek begint leeg; eligibility-lus),
§7.6 (veilige priority-parse) en voegde de ketting-propagatie-testcase toe in §9.1.*
*Datum: 2026-07-03 · Bron: [docs/TODO.md](../../TODO.md) §2.5, PLAN.md §2.5, codebase-inventaris
(`/home/nozzit/.claude/jobs/fd7f4482/tmp/research-codebase-inventaris.md`) + domeinrapport P6/MSP/IFC 4.3
(`/home/nozzit/.claude/jobs/fd7f4482/tmp/research-domein-p6-msp-ifc.md`) · Conventie: zie
[2026-07-02-mijlpalen-design.md](2026-07-02-mijlpalen-design.md)*

Dit document is bedoeld om zelfstandig te implementeren zonder de twee bronrapporten te lezen: elke
beslissing citeert het exacte bestand/regel waar hij op aansluit. Beslissingen (B1–B12) zijn genomen
door de architect en niet heropend; waar een beslissing een open detail liet, staat de invulling
gemarkeerd als *"invulling, te bevestigen bij review"*.

---

## 1. Samenvatting & scope

Fase 2.5 voegt aan Open Planner Studio toe: vijf resourcetypes (Labor/Equipment/Material/Subcontractor
+ nieuw Crew), resource-kalenders (informatief), tijd-gefaseerde capaciteit, toewijzingen met
`unitsPerDay` + verdeelcurve, een dagelijkse belasting-/overallocatie-engine, een histogramstrook onder
de Gantt, en — **in afwijking van het domeinrapport-advies om dit uit te stellen** — volledige
nivellering (leveling) én smoothing met een serieel SGS-algoritme. De architect heeft dit advies
expliciet overruled: de fase moet in één keer grondig en compleet zijn.

### In scope (B1)

- Datamodel: `CREW`-resourcetype, resource-kalenders, tijd-gefaseerde capaciteit (`availabilitySteps`),
  `unitsPerDay` + curve op assignments, `priority`/`levelingDelay` op taken, ploeg-hiërarchie
  (`parentId`, weergave-only).
- Belasting-/overallocatie-engine (`ResourceLoad.ts`) met curve-bewuste dagverdeling.
- Nivellering + smoothing (`ResourceLeveler.ts`): serieel SGS-algoritme, `constrainToFloat`-toggle,
  prioriteitsvolgorde, before/after-diff.
- UI: ribbontab **Resources**, resource-beheerpaneel, toewijzingssectie in TaskPropertiesPanel,
  histogramstrook, nivelleer-dialoog.
- IFC 4.3 round-trip (schrijver + lezer) voor alles hierboven.
- P6-XML- en MSPDI-adapters voor resources/toewijzingen/kalenders (CSV nadrukkelijk niet).
- Testharnas-uitbreiding (`tests/planning/`) met resource-/belasting-/nivelleer-cases.

### Expliciet buiten scope

- **Task-splitting** bij nivellering (een taak in sub-runs opknippen) — de IFC-round-trip-vraag voor
  gesplitste taken is nog niet ontworpen (domeinrapport §5, stap 4d).
- **P6 "Resource Dependent"-activity-type** — resource-kalenders zijn in 2.5 zuiver informatief; ze
  voeden capaciteit/overallocatie, maar raken de CPM-forward/backward-pass-datums niet aan (§3).
- **Rollen** (P6 Roles / generieke skill-placeholders).
- **Effort-driven/duration-type-automaat** — geen vier-standenknop, geen stille herberekening; OPS
  gedraagt zich vast als P6 **"Fixed Duration & Units"**: duur is heilig (planner-invoer), units zijn
  invoer, werk (`duur × unitsPerDay`) is altijd afgeleid en nooit opgeslagen.
- **Effective-dated tariefstaffels** (P6 5 tarieven met ingangsdatum, MSP Cost Rate Tables A–E) —
  `costPerHour` blijft één vlak tarief.
- **MSP "Cost"-resourcetype** (boekhoudkundig line-item zonder tarief/eenheid) — een taak-kostenveld
  dekt dat use-case al niet in scope van 2.5.
- **CSV-resource-kolommen** — de CSV-adapter (`csvWriter.ts`/`csvReader.ts`) blijft ongewijzigd: hij
  accepteert vandaag al genegeerde `_resources`/`_assignments`-parameters (`csvWriter.ts:42-43`) en
  levert lege arrays terug (`csvReader.ts:321-322`); dat blijft zo.

### Bewust nooit doen (uit het rapport-slot, §10)

Deze vijf anti-patronen zijn vendor-gedocumenteerde valkuilen en worden in OPS structureel vermeden,
niet later "uitgezet via een instelling":

1. MSP's effort-driven-driehoek als stille automaat (§10, geen sectie-nummer nodig — kernaanbeveling §2).
2. Kalender-intersectie als default combinatiegedrag tussen taak- en resource-kalender (§3, P10).
3. Materiaal-nivellering (§10-P4: materials worden nooit door de leveler bewogen).
4. Configureerbare overallocatie-granulariteit (§10-P5: één vaste dagregel, geen Minute/Hour/Week-keuze).
5. Curves die het histogram wél maar de leveler niet gebruiken (§10-P12, Ron Winter: "P6 does not
   consider resource usage curves when resource leveling" — `distributeUnits` is de ENE functie voor
   beide, zie §4).

---

## 2. Datamodel

### 2.1 `src/types/resource.ts` (huidige inhoud: 18 regels, zie hieronder als basis)

```ts
export type ResourceType = 'LABOR' | 'EQUIPMENT' | 'MATERIAL' | 'SUBCONTRACTOR' | 'CREW';

export interface AvailabilityStep {
  /** ISO-datum: vanaf deze dag geldt maxUnits (P6 "Max Units/Time"-rijen, effective-dated). */
  from: string;
  maxUnits: number;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  description: string;
  costPerHour?: number;
  /** @deprecated vervangen door `maxUnits`. Alleen gelezen bij migratie van oude bestanden/state
   *  (zie §2.4); nieuwe code schrijft dit veld niet meer. */
  availability?: number;
  /** Capaciteit per werkdag (P6/MSP "Max Units"): 1 = 100% (één persoon/stuk), 3 = drie eenheden.
   *  Vervangt `availability`. */
  maxUnits: number;
  /** Verwijst naar `resourceCalendars[].id`; undefined = projectkalender (`s.calendar`). Puur
   *  informatief in 2.5 — voedt alleen belasting/overallocatie, niet de CPM-datums (§3). */
  calendarId?: string;
  /** Tijd-gefaseerde capaciteit (P6 Units-and-Prices-model, effective-dated). Leeg/undefined =
   *  vlakke `maxUnits` geldt altijd. Sorteren op `from`; de eerstvolgende stap ≤ peildatum geldt. */
  availabilitySteps?: AvailabilityStep[];
  /** Alleen materiaal: verplichte eenheid (P6 Unit of Measure / MSP Material Label). */
  unitOfMeasure?: string;
  /** Ploeg-lidmaatschap: verwijst naar een CREW-resource. Puur groepering/weergave — GEEN
   *  automatische rollup van capaciteit/belasting (P6-gedrag, domeinrapport §1). */
  parentId?: string;
}

export type ResourceCurve = 'UNIFORM' | 'FRONT_LOADED' | 'BACK_LOADED' | 'BELL' | 'EARLY_PEAK' | 'LATE_PEAK';

export interface ResourceAssignment {
  id: string;
  taskId: string;
  resourceId: string;
  /** Eenheden per werkdag (P6 Units/Time, MSP Units): 1 = 100% (één persoon), 0.5 = halve dag.
   *  Vervangt `units`. Werk = duur(werkdagen) × unitsPerDay — altijd afgeleid, nooit opgeslagen. */
  unitsPerDay: number;
  /** Verdeelcurve over de duur (P6 resource curves, vereenvoudigd — zie §4). undefined = UNIFORM. */
  curve?: ResourceCurve;
}
```

**Migratie (backwards-compatible):**
- `Resource.availability` → `maxUnits` bij het inladen van state (fase-1-bestanden/IFC-imports zonder
  `maxUnits`): `maxUnits = resource.availability ?? 1`. Nieuwe code (UI, addResource-default) schrijft
  altijd `maxUnits` en laat `availability` weg.
- `ResourceAssignment.units` → `unitsPerDay` 1:1 (zelfde getal, hernoemd veld). Elke plek die vandaag
  `units` leest/schrijft moet mee (zie §2.3).

### 2.2 `src/types/task.ts` — hergebruik van het bestaande `priority`-veld

**Inconsistentie ontdekt tegen B2:** `Task` heeft al een **verplicht** veld `priority: number`
(`src/types/task.ts:80`), gedefault op `0` op alle drie de plekken waar taken gemaakt worden:
`taskSlice.ts:71` (`partial.priority || 0`), `taskSlice.ts:444` (multi-taak-operatie), `projectSlice.ts:151`,
en teruggelezen als hardcoded `0` in `ifcReader.ts:253`. Het veld wordt nergens gebruikt (geen CPM-,
UI- of IFC-schrijf-verwijzing) — het is fase-1-restant, geen fase-2.5-nieuwbouw.

B2 vraagt `priority?: number` (0–1000, default 500) toe te voegen als *nieuw optioneel* veld. Omdat de
naam al bezet is met een ander default-regime, is de invulling: **hergebruik het bestaande verplichte
veld**, geen tweede `priority`-property.

```ts
export interface Task {
  // ... bestaande velden ...
  /** Leveling-prioriteit (MSP-conventie, P6 "Activity Priority" analoog): 0–1000, default 500.
   *  1000 = "Do Not Level" (vastgepind, wordt door de nivelleerder nooit verschoven). Ongebruikt
   *  vóór fase 2.5 (was hardcoded 0 overal); vanaf 2.5 stuurt dit de nivelleervolgorde (§5). */
  priority: number;
  /** Vertraging in werkdagen t.o.v. de precedence-feasible early start — d.w.z. de ES die de
   *  forward pass berekent nadat óók de voorgangers hun levelingDelay hebben gekregen (§5.5 stap 4f;
   *  NIET t.o.v. de oorspronkelijke CPM-ES, dat zou voorgangersverschuivingen dubbel tellen).
   *  Gezet door de nivelleerder (§5). undefined = geen nivellering toegepast. "Nivellering wissen"
   *  zet dit overal terug naar undefined. */
  levelingDelay?: number;
}
```

**Migratie:** de default verandert van `0` naar `500` op alle drie de plekken
(`taskSlice.ts:71,444`, `projectSlice.ts:151`, `ifcReader.ts:253`). Dit is een gedragswijziging voor
bestaand ongebruikt veld, geen breaking change (er is geen consument van de oude `0`-default).
`levelingDelay` is nieuw en optioneel, dus geen migratie nodig.

### 2.3 `ResourceAssignment.units` → `unitsPerDay`: alle raakpunten

| Bestand | Regel(s) | Wijziging |
|---|---|---|
| `src/types/resource.ts` | 12-17 | veld hernoemen + `curve?` toevoegen (zie §2.1) |
| `src/state/slices/resourceSlice.ts` | `assignResource: (taskId, resourceId, units) =>` (regel 39) | signatuur → `(taskId, resourceId, unitsPerDay, curve?)`; body gebruikt `unitsPerDay` |
| `src/services/ifc/ifcWriter.ts` | `writeAssignments` (463-479) | schrijft nu geen `units` weg — moet `unitsPerDay`+`curve` per assignment in `OPS_Assignments`-pset zetten (§7) |
| `src/services/ifc/ifcReader.ts` | `extractAssignments` (590-620), hardcode `units: 1` (613) | → `unitsPerDay: 1` als pset ontbreekt (legacy-fallback), anders uit pset lezen |
| `src/state/slices/taskSlice.ts` | copy/paste-diepe-kopie van assignments (321-389) | veldnaam meenemen, geen gedragswijziging |
| P6/MSP-adapters (§8) | writer/reader | `unitsPerDay` als brontabel-veld |

### 2.4 Leaf-only, geen-milestone-assignment-regel

**Afdwingen op twee plekken:**
1. **`resourceSlice.assignResource`** — vroege return (geen assignment aanmaken, geen undo-snapshot)
   wanneer de taak `isMilestone` is of `task.childIds.length > 0` (samenvattingstaak). Reden:
   domeinrapport §4/§10-P6 — P6 verbiedt structureel units op milestones en telt histogram-belasting
   uitsluitend over leaf-assignments; summary-assignments zijn de gedocumenteerde vervuilingsbron.
2. **UI** — toewijzingssectie in TaskPropertiesPanel (§6.3) toont een disabled-staat met tooltip
   i.p.v. de invoer, zodra de geselecteerde taak milestone is of kinderen heeft.

### 2.5 Wat NIET verandert

`Resource.description`, `costPerHour` (blijft één vlak tarief, geen effective-dated staffel — buiten
scope), `ResourceAssignment.id/taskId/resourceId`.

---

## 3. Kalender-registry

### 3.1 Store

```ts
// resourceSlice.ts (uitbreiding)
export interface ResourceSlice {
  resources: Resource[];
  assignments: ResourceAssignment[];
  /** Resource-kalenders (fase 2.5). Elke NamedCalendar is gewoon een WorkCalendar — het type heeft
   *  al `id`/`name` (src/types/calendar.ts:1-4), dus geen nieuwe intersectie-type nodig (zie
   *  inconsistentie hieronder). Informatief: raakt CPM niet aan, voedt alleen belasting (§4). */
  resourceCalendars: WorkCalendar[];
  addResourceCalendar: (cal: Omit<WorkCalendar, 'id'>) => string;
  updateResourceCalendar: (id: string, updates: Partial<WorkCalendar>) => void;
  removeResourceCalendar: (id: string) => void; // resources met calendarId===id vallen terug op undefined (projectkalender)
  // ... bestaande + uitgebreide acties, zie §2.3/§5
}
```

**Inconsistentie ontdekt tegen B3:** de beslissing definieert `NamedCalendar = WorkCalendar & { id:
string; name: string }`. `WorkCalendar` (`src/types/calendar.ts:1-10`) heeft **al** `id: string` en
`name: string` als verplichte velden — de intersectie voegt dus niets toe. Invulling: gebruik
`WorkCalendar` rechtstreeks als het registry-elementtype (`resourceCalendars: WorkCalendar[]`); een
`NamedCalendar`-alias is optioneel en puur leesbaarheid (`export type NamedCalendar = WorkCalendar;`
als iemand semantisch onderscheid wil in imports).

### 3.2 `s.calendar` blijft ongewijzigd

`setCalendar`/`s.calendar` (`projectSlice.ts:24,30,36,75,96`) is en blijft de projectkalender — nul
regressierisico voor de bestaande 202-cases CPM-suite. `CalendarEngine` is al stateless-per-instantie
(`new CalendarEngine(s.calendar)` in `scheduleSlice.ts:17`) en volledig herbruikbaar: instantieer per
resource-kalender in `ResourceLoad.ts` (`new CalendarEngine(resourceCal ?? s.calendar)`), geen wijziging
aan `CalendarEngine.ts` zelf nodig.

### 3.3 Per-document meenemen

`resourceCalendars` moet overal waar `resources`/`assignments` nu al staan mee (documentSlice.ts is
al het volledige patroon):
- `DocumentPayload` (34-48) — `resourceCalendars: WorkCalendar[]` naast `resources`/`assignments`.
- `RecoveryDocInput` (67-79) — idem.
- `capturePayload`/`hydratePayload`/`freshPayload`/`payloadFromInput` (100-183) — elk krijgt de
  extra regel `resourceCalendars: s.resourceCalendars` / `p.resourceCalendars` / `[]` /
  `d.resourceCalendars ?? []`.
- **Snapshot (undo/redo):** `src/state/snapshot.ts` — `Snapshot`-interface + `createSnapshot` krijgen
  `resourceCalendars: WorkCalendar[]` naast `resources`/`assignments` (regels 7-24). Zonder dit zou
  een undo na kalenderbewerking de kalenderregistry laten staan terwijl taken/resources teruggaan —
  inconsistente state.
- **Recovery/auto-save** (App.tsx, zie CLAUDE.md "Auto-update & releases"-sectie is niet relevant hier;
  het is de auto-save-sectie): de recovery-IFC-snapshot per document gaat via dezelfde
  `RecoveryDocInput`, dus automatisch gedekt zodra dat veld bestaat.

### 3.4 UI: hergebruik `CalendarDialog`

`src/components/dialogs/CalendarDialog.tsx` (234 regels) is vandaag hard gekoppeld aan de
projectkalender: `const calendar = useAppStore(s => s.calendar); const setCalendar = ...;` (regels
12-13) en een lokale `draft`-state die op Apply via `setCalendar(draft)` + `runCPM()` committeert
(22-26). Om dit te hergebruiken voor resource-kalenders **zonder** de projectkalender-flow te breken:

- Extraheer de body (regels 66-234: het formulier — naam, werkdagen, uren, feestdagen) naar een
  presentational component `CalendarForm({ draft, onChange }: { draft: WorkCalendar; onChange:
  (patch: Partial<WorkCalendar>) => void })` die geen store kent.
- `CalendarDialog` (projectkalender) wordt een dunne wrapper: leest `s.calendar`/`setCalendar`,
  rendert `<CalendarForm>`, committeert met `runCPM()` erna (bestaand gedrag, ongewijzigd).
- Nieuwe `ResourceCalendarDialog` (Resources-ribbontab, §6.1): leest/schrijft één item uit
  `s.resourceCalendars` via `updateResourceCalendar`/`addResourceCalendar`, rendert dezelfde
  `<CalendarForm>`, **geen** `runCPM()`-aanroep na Apply (resource-kalenders zijn informatief — ze
  raken de CPM-datums niet aan, dus geen herberekening nodig; wél `runCPM()` als de gebruiker
  daarna expliciet op Nivelleren/Herberekenen drukt, want dat leest `resourceLoadResult` opnieuw).

---

## 4. Belasting-engine & curves

### 4.1 `distributeUnits` — het curve-algoritme (domeinrapport §7)

Nieuw bestand `src/engine/scheduler/ResourceLoad.ts`, eerste (en enige) bouwsteen:

```ts
export type ResourceCurve = 'UNIFORM' | 'FRONT_LOADED' | 'BACK_LOADED' | 'BELL' | 'EARLY_PEAK' | 'LATE_PEAK';

/** Controlepunten per curve: (t ∈ [0,1] = positie in de duur, gewicht). Lineair geïnterpoleerd
 *  tussen punten; niet genormaliseerd (distributeUnits normaliseert zelf via Σraw). */
const CURVE_POINTS: Record<ResourceCurve, [number, number][]> = {
  UNIFORM:      [[0, 1.0], [1, 1.0]],
  FRONT_LOADED: [[0, 1.0], [1, 0.2]],
  BACK_LOADED:  [[0, 0.2], [1, 1.0]],
  BELL:         [[0, 0.2], [0.5, 1.0], [1, 0.2]],
  EARLY_PEAK:   [[0, 0.2], [1 / 3, 1.0], [1, 0.2]],
  LATE_PEAK:    [[0, 0.2], [2 / 3, 1.0], [1, 0.2]],
};

/**
 * Verdeelt `unitsPerDay × durationDays` totale eenheden over `durationDays` werkdagen volgens
 * `curve`, met lineaire interpolatie tussen controlepunten en grootste-rest-afronding zodat de som
 * EXACT klopt (geen 0.1-drift door floating point of afronding per dag). D=1 → alles op dag 0,
 * voor elke curve (randgeval, domeinrapport §7 slot).
 *
 * Deze ENE functie voedt zowel het histogram (§4.2) als de nivelleerder (§5) — nooit de
 * P6-inconsistentie reproduceren waarbij de leveler curves negeert (§10-P12).
 */
export function distributeUnits(unitsPerDay: number, durationDays: number, curve: ResourceCurve = 'UNIFORM'): number[] {
  const total = unitsPerDay * durationDays;
  if (durationDays <= 1) return durationDays === 1 ? [total] : [];

  const points = CURVE_POINTS[curve];
  const raw: number[] = [];
  for (let i = 0; i < durationDays; i++) {
    const t = i / (durationDays - 1);
    raw.push(interpolate(points, t));
  }
  const sumRaw = raw.reduce((a, b) => a + b, 0);
  const weights = raw.map(r => r / sumRaw);

  // Grootste-rest-methode: eerst afronden naar beneden, dan de grootste fractionele resten
  // ophogen tot de som weer exact `total` is (bij 2 decimalen precisie, i.e. honderdsten van een
  // eenheid — dag-granulaire assignments zijn zelden fijner dan dat).
  return largestRemainderRound(weights.map(w => w * total), total);
}

function interpolate(points: [number, number][], t: number): number {
  for (let i = 0; i < points.length - 1; i++) {
    const [t0, w0] = points[i];
    const [t1, w1] = points[i + 1];
    if (t >= t0 && t <= t1) {
      const frac = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return w0 + frac * (w1 - w0);
    }
  }
  return points[points.length - 1][1];
}

function largestRemainderRound(values: number[], targetSum: number): number[] {
  const scale = 100; // 2 decimalen precisie (honderdsten van een eenheid)
  const floors = values.map(v => Math.floor(v * scale));
  let remainder = Math.round(targetSum * scale) - floors.reduce((a, b) => a + b, 0);
  const fracIdx = values
    .map((v, i) => ({ i, frac: v * scale - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < fracIdx.length && remainder > 0; k++, remainder--) {
    result[fracIdx[k].i] += 1;
  }
  return result.map(v => v / scale);
}
```

Named presets zijn exact de vijf uit het domeinrapport (`front-loaded [(0,1.0),(1,0.2)]`,
`back-loaded [(0,0.2),(1,1.0)]`, `bell [(0,0.2),(0.5,1.0),(1,0.2)]`, `early/late-peak` piek op ⅓/⅔).
*Invulling, te bevestigen bij review*: een power-user-optie om een eigen controlepunt-array op te
geven (domeinrapport noemt dit als mogelijke uitbreiding) wordt **niet** gebouwd in 2.5 — de zes
presets dekken de scope; `ResourceCurve` blijft een gesloten enum, geen vrije-vorm-curve-editor.

### 4.2 `computeResourceLoad`

```ts
export interface DailyLoad {
  /** ISO-datum → belaste eenheden (som over alle assignments van deze resource op deze dag). */
  [isoDate: string]: number;
}

export interface ResourceLoadResult {
  /** resourceId → per-dag-belasting (alleen dagen met >0 belasting of capaciteit, dag-granulair). */
  load: Record<string, DailyLoad>;
  /** resourceId → per-dag-capaciteit (kalender × maxUnits/availabilitySteps; 0 op niet-werkdagen). */
  capacity: Record<string, DailyLoad>;
  /** resourceId → ISO-datums waar load > capacity. */
  overallocatedDays: Record<string, string[]>;
}

export function computeResourceLoad(
  resources: Resource[],
  assignments: ResourceAssignment[],
  tasks: Task[],           // alleen leaf-taken tellen mee (§2.4)
  projectCalendar: WorkCalendar,
  resourceCalendars: WorkCalendar[],
): ResourceLoadResult { /* ... */ }
```

**Logica:**
1. Filter assignments op leaf-taken zonder milestone (dubbele bewaking t.o.v. §2.4 — defensief, mocht
   een oud bestand toch een ongeldige assignment bevatten).
2. Per assignment: `days = distributeUnits(a.unitsPerDay, task.time.scheduleDuration, a.curve ??
   'UNIFORM')` gemapt op de **werkdagen** tussen `task.time.earlyStart` en `task.time.earlyFinish`
   (CPM-datums, niet de ruwe schedule-datums — zie `scheduleSlice.ts:33-34`: `earlyStart`/`earlyFinish`
   zijn de door CPM berekende datums). Elke `days[i]` hoort bij de i-de werkdag van de taak volgens
   de **projectkalender** (resource-kalenders sturen de CPM-datums niet aan, §3.2/§B1).
3. Accumuleer per resource per dag: `load[resourceId][iso] += days[i]`.
4. Capaciteit per resource per kalenderdag: `maxUnits` (met `availabilitySteps`: de laatste stap met
   `from <= dag` geldt, anders het vlakke `maxUnits`) op werkdagen van `resource.calendarId
   ? resourceCalendars.find(...) : projectCalendar`; **0 op niet-werkdagen** van die kalender.
5. **Materiaal telt ook mee voor overallocatie** (`load > maxUnits` ⇒ vlag), ondanks dat materiaal
   nooit genivelleerd wordt (§5) — expliciete B4-beslissing: `maxUnits` voor materiaal = "leverbaar
   per dag", en een verbruik daarboven is een reëel signaal (inkoop-/levertijdwaarschuwing,
   domeinrapport §10-P4), alleen de *leveler* slaat MATERIAL over.
6. `overallocatedDays[resourceId] = [iso, ...]` waar `load[iso] > capacity[iso]`.

**Trigger:** berekend binnen `runCPM` (`scheduleSlice.ts`), ná de bestaande CPM-pass en
samenvattingstaak-rollup (regel 87, vóór de `emitExtensionEvent`-call), opgeslagen als nieuw
store-veld `resourceLoadResult: ResourceLoadResult | null` — past bij "manual, not reactive"
(CLAUDE.md-architectuurregel: scheduling is niet reactief, alleen expliciete triggers). Hergebruikt
door de nivelleerder (§5) als startpunt voor de capaciteitsgrootboek-scan.

---

## 5. Nivellering & smoothing

### 5.1 Eén engine, één toggle

Domeinrapport §6, kernbevinding: **geen enkele tool heeft een aparte smoothing-feature** — P6's
"Level Resources Only Within Activity Total Float" en MSP's "Level only within available slack" zijn
allebei gewoon de gewone leveling-engine met een boolean aan. OPS volgt dit 1:1: `ResourceLeveler.ts`
heeft één functie, één `constrainToFloat`-parameter.

```ts
export interface LevelingOptions {
  /** true = smoothing: alleen binnen de totale float schuiven, einddatum heilig, onoplosbare
   *  conflicten blijven gemarkeerd staan. false = leveling: mag de einddatum verschuiven. */
  constrainToFloat: boolean;
  /** default: alle renewable resources (LABOR/EQUIPMENT/CREW/SUBCONTRACTOR). */
  resourceIds?: string[];
}

export interface LevelingResult {
  /** taskId → toegepaste levelingDelay (werkdagen), alleen taken die daadwerkelijk verschoven zijn. */
  delays: Record<string, number>;
  /** taskId → resterende, onoplosbare conflictdagen (alleen relevant bij constrainToFloat=true). */
  unresolved: Record<string, string[]>;
  /** projecteinddatum vóór en na — UI toont dit altijd expliciet (B5, domeinrapport §6 slot). */
  projectEndBefore: string;
  projectEndAfter: string;
}

export function levelResources(
  tasks: Task[], sequences: Sequence[], resources: Resource[], assignments: ResourceAssignment[],
  projectCalendar: WorkCalendar, resourceCalendars: WorkCalendar[],
  cpmResult: CPMResult, options: LevelingOptions,
): LevelingResult { /* ... */ }
```

### 5.2 Sorteervolgorde (determinisme als feature, §10-P1)

Letterlijke volgorde, gepubliceerd zodat gedrag reproduceerbaar is (geen stille terugval op interne
ID-sortering zoals P6's gedocumenteerde fallback, domeinrapport §10-P1):

1. **`priority` descending** — MSP-semantiek: **hoger = belangrijker/eerder geplaatst** (niet P6's
   "lager eerst"-lezing die de vraag suggereerde — B5 kiest expliciet MSP-semantiek en documenteert
   het hier). `priority === 1000` → vastgepind, überhaupt niet in de plaatsingslus (zie §5.4).
2. **Total Float ascending** (krapste taken eerst — minste ruimte om te schuiven).
3. **Early Start ascending** (uit de laatst gedraaide `runCPM`).
4. **Taak-ID ascending** — deterministische laatste sleutel, altijd toegepast, nooit weggelaten.

### 5.3 Alleen renewables

`LABOR | EQUIPMENT | CREW | SUBCONTRACTOR` — nooit `MATERIAL` (§10-P4). Een taak met uitsluitend
material-assignments wordt behandeld als "geen assignments op geselecteerde resources" (§5.4).

### 5.4 Uitsluitingen (geen verschuiving)

- **`task.priority === 1000`** → vastgepind (MSP "Do Not Level"-conventie, domeinrapport §5): blijft
  op zijn CPM-early-start staan, telt wél mee als bezette capaciteit voor andere taken.
- **Taken zonder assignments op geselecteerde renewable resources** → niet verschoven (geen
  capaciteitsvraag om tegen te plannen).
- **Milestones** → duur 0, dus geen dag-vraag; sowieso al uitgesloten van assignments (§2.4).

### 5.5 Algoritme (serieel SGS, domeinrapport §5 stap 1-6)

1. **CPM eerst** — leest het resultaat van de laatst gedraaide `runCPM` (geen impliciete herberekening;
   de gebruiker moet zelf `runCPM` gedraaid hebben, anders werkt de leveler op stale data — expliciet
   zichtbaar in de UI, zie §6.4).
2. **Werklijst + eligibility-lus** (standaard serieel SGS): sorteer alle in aanmerking komende taken
   volgens §5.2 en kies telkens de **hoogst gesorteerde taak waarvan alle voorgangers al een
   definitieve positie hebben** (vastgepinde en niet-verschuifbare taken gelden als geplaatst). Zo
   blijft de volgorde prioriteit-gedreven zonder ooit een taak vóór zijn voorgangers te plaatsen.
3. **Capaciteitsgrootboek begint LEEG** en wordt gevuld terwijl taken geplaatst worden. Vooraf worden
   alleen geboekt: vastgepinde taken (`priority === 1000`) en taken die niet kunnen verschuiven (geen
   assignments op geselecteerde renewables) — die staan vast op hun CPM-positie en verbruiken daar
   capaciteit. **Niet** `computeResourceLoad`-met-alle-taken als startboeking gebruiken: dan zou
   capaciteit dubbel gereserveerd zijn voor taken die nog geplaatst moeten worden. Wat wél wordt
   hergebruikt uit §4.2 is de *capaciteitskant* (kalender × maxUnits/availabilitySteps per dag).
4. **Per gekozen taak**:
   a. **Precedence-feasible start (PF)** bepalen = de vroegste start volgens de al-geplaatste
      voorgangers (dezelfde relatie-/lag-regels als de forward pass, maar berekend tegen de
      vérschoven voorgangersposities) én de eigen datumconstraints. Voor een taak zonder verschoven
      voorgangers is PF gewoon de CPM-`earlyStart`.
   b. Dagvraag per resource = `distributeUnits(unitsPerDay, resterende duur, curve)` — **dezelfde
      functie als het histogram** (§4.1), nooit een aparte "vlakke" aanname (§10-P12).
   c. Scan vanaf **PF** dag-voor-dag naar de **eerste aaneengesloten run van werkdagen**
      (lengte = duur) waarin élke benodigde resource élke dag voldoende restcapaciteit heeft.
   d. **`constrainToFloat: true`**: zoekvenster beperkt tot `[PF, lateStart uit de oorspronkelijke
      CPM-run]`. Geen slot gevonden binnen dat venster → de taak blijft op PF staan, wordt **dáár
      geboekt** (inclusief het conflict — zo plannen volgende taken tegen de reële belasting) en
      komt in `unresolved`.
   e. **`constrainToFloat: false`**: zoekvenster onbeperkt vooruit — mag de projecteinddatum
      verschuiven (leveling in de PMBOK-zin).
   f. **Commit**: boek de dagvraag op de gevonden startdag af van het grootboek; zet
      `task.levelingDelay = werkdagen tussen PF en de gevonden startdag` (0 als geen verschuiving
      nodig was — expliciet zetten, niet weglaten, zodat "geen conflict" zichtbaar onderscheiden is
      van "nog niet berekend" (`undefined`)). **De delay is t.o.v. PF, niet t.o.v. de oorspronkelijke
      CPM-ES**: de forward pass (§5.6) berekent bij het naspelen éérst zelf de ES op basis van de
      (verschoven) voorgangers en telt de delay dáárbij op — een delay t.o.v. de oude CPM-ES zou
      voorgangersverschuivingen dubbel tellen.
5. **Herbereken**: ná alle plaatsingen éénmalig `runCPM` met de gezette `levelingDelay`s — de forward
   pass reproduceert dan exact de geplaatste posities (per constructie van PF in 4a/4f), en de
   backward pass herrekent de float eerlijk (§5.6). Geen incrementele per-plaatsing-herberekening
   nodig; de bestaande `CPMSolver` is al een volledige-graaf-oplosser.
6. **Rapporteer**: `LevelingResult.delays`, `unresolved`, `projectEndBefore/After` — UI toont dit als
   preview vóór commit (§6.4).

### 5.6 CPMSolver-hook: geen phantom float (§10-P2)

De **kern van de fix voor "phantom float"** (domeinrapport §10-P2, de best gedocumenteerde valkuil:
"A resource-leveled activity can delay the project and still indicate positive total float"): OPS
laat `levelingDelay` gewoon door de bestaande forward pass lopen, zodat de backward pass en dus de
float **eerlijk herrekend** worden — geen apart "geleveld schema" met stale CPM-float.

Concreet hook-punt in `src/engine/scheduler/CPMSolver.ts`, `forwardPass` (regel 239-304): direct ná
het bepalen van `earlyStart` (zowel de geen-voorgangers-tak, regel 259-260, als de
met-voorgangers-tak, regel 293-294 — telkens vlak vóór `const earlyFinish = ...`, regel 298):

```ts
// Nieuw, ná applyForwardConstraint + nextWorkDay, vóór earlyFinish-berekening:
if (task.levelingDelay) {
  earlyStart = this.calendar.addWorkingDaysSigned(earlyStart, task.levelingDelay);
}
```

`addWorkingDaysSigned` bestaat al (`CalendarEngine.ts:185`, "zuivere offset, begindag telt niet") —
exact het gedrag dat nodig is om N werkdagen op te schuiven zonder de dag-inclusief/exclusief-regels
van `addWorkDays` door elkaar te halen. Na deze wijziging draait de bestaande backward pass
ongewijzigd door: total/free float worden op de **verschoven** early-datums berekend, dus float na
nivellering is altijd de waarheid, nooit een pre-leveling-artefact.

**"Nivellering wissen"** = `task.levelingDelay = undefined` voor alle taken + `runCPM()` — één
undo-snapshot (via de bestaande `updateTask`-actie op alle betrokken taken, of een nieuwe
bulk-actie `clearLeveling()` in `resourceSlice`/`scheduleSlice` die zelf één snapshot pusht i.p.v.
N losse snapshots).

**Nivelleren zelf = één undo-snapshot**: de nieuwe actie `applyLeveling(result: LevelingResult)` pusht
één snapshot vóór het schrijven van alle `levelingDelay`-waarden, dan `runCPM()` — zodat Ctrl+Z de
hele nivelleerslag in één stap terugdraait, niet taak voor taak.

### 5.7 Curve-bewuste capaciteitscheck

Zowel `computeResourceLoad` (histogram) als `levelResources` (leveler) roepen `distributeUnits` aan —
geen tweede, "simpelere" verdeelfunctie voor de leveler. Dit is de directe, structurele fix voor
domeinrapport §10-P12.

### 5.8 UI-flow

Dialoog **"Nivelleer resources…"** (Resources-ribbontab, §6.1): opties (`constrainToFloat`-toggle met
het dubbele label uit het domeinrapport-advies: *"Alleen binnen speling nivelleren (smoothing) —
projecteinddatum blijft vast"*, resource-multiselect default alle renewables) → **Berekenen**-knop
→ preview-diff (tabel: taak, oorspronkelijke start, nieuwe start, dagen verschoven; footer: "Project­
einddatum: 12-08-2026 → 19-08-2026" of "ongewijzigd"; sectie "Resterende conflicten" als
`unresolved` niet leeg is) → **Toepassen** (committeert, zie §5.6) / **Annuleren** (gooit het
`LevelingResult` weg, geen store-mutatie).

---

## 6. UI

### 6.1 Ribbontab `'resources'`

`RibbonTab`-type (`src/state/slices/types.ts:53`) uitbreiden:

```ts
export type RibbonTab = 'file' | 'start' | 'planning' | 'resources' | 'relations' | 'beeld' | 'instellingen' | 'table' | 'ifc' | 'report';
```

Positie: direct na `'planning'` (tabvolgorde in de tab-strip volgt deze array-volgorde, zie
`Ribbon.tsx:571` `ribbon-tabs`-rendering). Groepen (patroon: `<RibbonGroup label={tMenu('ribbon.x')}>`
+ `<div className="ribbon-separator" />` ertussen, exact zoals de bestaande tabs in
`Ribbon.tsx:592-750`):

```
[Beheer]              [Toewijzing]           [Histogram]              [Nivellering]           [Indicator]
 Resources-paneel       Toewijzen aan          Toggle histogram         Nivelleren…              Overallocatie:
 openen                 geselecteerde taak      Vorige/volgende          Nivellering wissen        ⚠ 2 resources
 Nieuwe resource                                resource
```

- **Beheer**: `RibbonButton` → `setUI({ showResourcePanel: true })`; `RibbonButton` "Nieuwe resource"
  → opent het paneel én een lege editorrij (of een klein inline-formulier — implementatiedetail,
  *invulling, te bevestigen bij review*: kies inline-rij-toevoegen in de tabel, consistent met hoe
  `TableEditor` nieuwe taken toevoegt, i.p.v. een apart modaal).
- **Toewijzing**: knop "Toewijzen" — alleen enabled als er precies één leaf-, niet-milestone-taak
  geselecteerd is (`selectedTaskIds.length === 1` + validatie §2.4); opent een klein
  resource-picker-popover (niet een volledig modaal) die direct `assignResource` aanroept.
- **Histogram**: toggle-knop (`ui.showHistogram`) + vorige/volgende-resource-navigatie (cyclisch door
  `resources.filter(r => r.type !== 'MATERIAL' || toonMateriaalOok)`).
- **Nivellering**: "Nivelleren…" opent de dialoog (§5.8); "Nivellering wissen" (disabled als geen
  enkele taak een `levelingDelay` heeft).
- **Indicator**: read-only samenvatting — telt `Object.keys(resourceLoadResult?.overallocatedDays ?? {}).filter(id => (overallocatedDays[id]?.length ?? 0) > 0).length`, rood icoon zodra > 0 (MSP-patroon, domeinrapport §4: "lichtgewicht rood-icoon ... het goedkopere, actionabelere signaal").

### 6.2 Resource-beheerpaneel (full-panel, patroon `TableEditor`)

Nieuwe UI-state `ui.showResourcePanel: boolean` (analoog aan hoe `activeRibbonTab === 'table'` de
`TableEditor` als full-panel toont in `App.tsx` — `isFullPanel`-logica, regel 274 volgens de
inventaris). Kolommen: naam, type (dropdown met de vijf `ResourceType`-waarden), maxUnits (getal),
kalender (dropdown: "Projectkalender" + alle `resourceCalendars`, met een "Bewerken…"-knopje dat
`ResourceCalendarDialog` opent, §3.4), tarief (`costPerHour`, alleen zichtbaar/invulbaar wanneer
relevant — geen harde restrictie, gewoon leeg voor materiaal), eenheid (alleen material-rijen),
ploeg/parent (dropdown van CREW-resources). Inline bewerken, rij toevoegen/verwijderen — zelfde
interactiepatroon als de bestaande taaktabel.

### 6.3 TaskPropertiesPanel: sectie "Toewijzingen"

Toegevoegd na de bestaande dependencies-sectie (`TaskPropertiesPanel.tsx:348-392` is het
dependencies-blok; de nieuwe sectie komt ernaast/erna, zelfde stijl als de custom-fields-sectie
394-424 met een lijst + toevoegen/verwijderen). Per rij: resource-naam (dropdown, gefilterd op
niet-al-toegewezen resources voor "toevoegen"), `unitsPerDay` (getal-input, patroon
`CustomFieldInput`'s number-tak, regel 48-60), curve (dropdown met de zes `ResourceCurve`-waarden,
label "Uniform" als default/undefined-weergave), verwijder-knop (`Trash2`-icoon, zelfde als
custom-fields-rij). **Uitgeschakeld** (hele sectie disabled + tooltip "Toewijzingen zijn niet
mogelijk op mijlpalen/samenvattingstaken") wanneer `task.isMilestone || task.childIds.length > 0`
(§2.4).

### 6.4 Histogramstrook

**Layout-wijziging in `GanttCanvas.tsx`:** de huidige structuur is één flex-kolom
(`className="flex-1 flex flex-col overflow-hidden"`, regel 723) met daarin `containerRef`
(`flex-1 overflow-hidden relative`, regel 724 — bevat de hoofd-canvas + de dependency-overlay-canvas)
gevolgd door de horizontale scrollbar-div (796-804). De histogramstrook wordt een **derde canvas**,
ingevoegd tussen de container en de scrollbar-div, als eigen vaste-hoogte band:

```tsx
<div className="flex-1 flex flex-col overflow-hidden">
  <div ref={containerRef} className="flex-1 overflow-hidden relative"> {/* bestaand: hoofd-canvas + dep-overlay */} </div>
  {showHistogram && (
    <>
      <div className="histogram-splitter" onMouseDown={...} />  {/* verticale resize-handle, analoog aan de bestaande kolom-splitter */}
      <div ref={histogramContainerRef} style={{ height: histogramHeight }} className="relative overflow-hidden">
        <canvas ref={histogramCanvasRef} className="absolute inset-0" />
      </div>
    </>
  )}
  <div ref={hScrollRef} className="overflow-x-auto overflow-y-hidden" style={{ height: 14 }}>{/* bestaand */}</div>
</div>
```

**Gedeelde X-as, eigen Y-as**: de histogram-canvas gebruikt **dezelfde** `dateToX`-berekening als
`GanttRenderer.dateToX` (`GanttRenderer.ts:187-191`: `taskTableWidth + daysFromStart*zoom - scrollX`)
— dus dezelfde `effectiveView` (met de effectieve origin-padding, `GanttCanvas.tsx:162-181`),
dezelfde `view.zoom`, dezelfde `scrollX`/`taskTableWidth`. Een nieuwe, kleine
`HistogramRenderer`-klasse (`src/engine/renderer/HistogramRenderer.ts`) hergebruikt deze mapping maar
kent een eigen verticale schaal (units i.p.v. rijen): Y-as = `maxCapacityInView` boven,
`0`-lijn onderaan. Links van `taskTableWidth`: een resource-kiezer-lijst (naam + rood badge bij
overallocatie ergens in het project), rechts: staafjes per dag + een horizontale capaciteitslijn
(stap-vormig als `availabilitySteps` actief zijn); het deel van een staaf boven de lijn wordt rood
getekend (P6-patroon, domeinrapport §4).

**UI-state** (`slices/types.ts`, `UIState`-interface):
```ts
showHistogram: boolean;        // persisted via settingsStore (§6.5)
histogramHeight: number;       // persisted via settingsStore
```
**Geselecteerde resource**: *invulling, te bevestigen bij review* — B6 vraagt te kiezen tussen
`ViewState` en `UIState`, per document. Keuze: `ViewState.histogramResourceId?: string` (naast
`groupBy`, `ViewState`-velden zijn al per-document via `DocumentPayload.view`, §3.3 hoeft dus niets
extra te doen). Reden: dit is net als `groupBy` een document-specifieke weergavekeuze (welke
resource je bekijkt hoort net zo bij "hoe kijk ik naar dít project" als scroll/zoom), niet een
globale UI-instelling.
"Alle resources"-somweergave: `histogramResourceId: undefined` (of een sentinel `'__ALL__'`) toont de
som van alle renewable-belasting tegen de som van alle capaciteit — *invulling*: gebruik `undefined`
als "alle", zodat een lege `ViewState`-default (geen resources geselecteerd) meteen correct is.

**Drill-down** (klik op een rode dag, domeinrapport §10-P5 — "elke vlag moet klikbaar zijn naar de
exacte assignments+dagen die hem veroorzaken"): minimale invulling zoals B6 toestaat — een klik toont
een tooltip/statusbar-regel met de taaknamen die op die resource+dag bijdragen (afgeleid uit
`assignments.filter(a => a.resourceId === id).map(a => tasks.find(t => t.id === a.taskId))` gefilterd
op de datum binnen `[earlyStart, earlyFinish]`), geen aparte selectie-state of markering in de
hoofd-Gantt in 2.5.

### 6.5 Instellingen-3-plekken-regel geldt hier NIET (B12)

`showHistogram`/`histogramHeight` zijn **view-state**, geen instellingen — zelfde categorie als
`rightPanelWidth`/`rightPanelCollapsed` (die ook geen tandwiel-/Instellingen-tab-/Backstage-vermelding
hebben, zie CLAUDE.md "Settings persistence"-sectie: dat gaat over *instellingen* als thema/locale/
zoom-default, niet over paneel-groottes). Ze persisten via `settingsStore.ts` (localStorage,
`ops-`-prefix) zoals `leftPanelWidth`/`rightPanelWidth` dat vandaag al doen, maar hoeven **niet** in
`SettingsPanelContent` te verschijnen.

---

## 7. IFC 4.3-mapping

### 7.1 Resourcetypes → entiteiten

| `ResourceType` | IFC-entiteit (schrijven) | Reader accepteert ook |
|---|---|---|
| `LABOR` | `IFCLABORRESOURCE` | — |
| `EQUIPMENT` | `IFCCONSTRUCTIONEQUIPMENTRESOURCE` | `IFCCONSTRUCTIONPRODUCTRESOURCE` → `EQUIPMENT` (herbruikbaar bekisting e.d., domeinrapport §8.A) |
| `MATERIAL` | `IFCCONSTRUCTIONMATERIALRESOURCE` | — |
| `SUBCONTRACTOR` | `IFCSUBCONTRACTRESOURCE` | — |
| `CREW` (nieuw) | `IFCCREWRESOURCE` | — |

Huidige `writeResource` (`ifcWriter.ts:445-461`) heeft al vier van de vijf takken; toevoegen:
`case 'CREW': entity = \`IFCCREWRESOURCE(${ifcStr(ifcGuid(res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,.USERDEFINED.)\`;`
— zelfde 9-argumenten-patroon (GUID, ownerHist, Name, Description, ObjectType `$`, Identification `$`,
LongDescription `$`, Usage `$`, PredefinedType `.USERDEFINED.`) als de bestaande takken. `default:`
blijft `MATERIAL` (ongewijzigd fallback-gedrag).

`extractResources` (`ifcReader.ts:557-588`): `resTypes`-map (561-565) krijgt een vijfde entry
`IFCCREWRESOURCE: 'CREW'` en een zesde `IFCCONSTRUCTIONPRODUCTRESOURCE: 'EQUIPMENT'`. PredefinedType
blijft ongebruikt (geen categorie-veld in ons model, zoals vandaag — `.USERDEFINED.` overal).

### 7.2 `OPS_Resource`-pset — capaciteit/tarief/eenheid

Exact het `OPS_Constraints`/`OPS_Milestone`-patroon (`ifcWriter.ts:314-339,347-367`:
`IFCPROPERTYSINGLEVALUE` per veld → `IFCPROPERTYSET('OPS_Resource', ...)` →
`IFCRELDEFINESBYPROPERTIES` naar de resource-entiteit). Alleen schrijven wanneer minstens één veld
afwijkt van de default (gouden regel, §7.6):

| Property | IFC-type | Wanneer geschreven |
|---|---|---|
| `MaxUnits` | `IFCREAL` | altijd wanneer `maxUnits !== 1` (default) |
| `CostPerHour` | `IFCMONETARYMEASURE` | wanneer `costPerHour` gezet is |
| `UnitOfMeasure` | `IFCLABEL` | wanneer `unitOfMeasure` gezet is (material) |
| `AvailabilitySteps` | `IFCTEXT` | wanneer `availabilitySteps` niet leeg is — compacte encoding **`"2026-01-01:2;2026-03-01:5"`** (`from:maxUnits`, `;`-gescheiden, chronologisch), zoals B8 voorschrijft |

Reader (`extractResources`, spiegel-patroon van `OPS_Constraints`-lezen, `ifcReader.ts:449-473`):
parsen via dezelfde `parseTypedValue`/`stripQuotes`-helpers; `AvailabilitySteps` splitsen op `;` dan
`:`.

### 7.3 Ploeg-hiërarchie: `IfcRelNests` (verificatie B8)

**Bevinding**: het domeinrapport (§8.A) noemt zelf al `IsDecomposedBy` als de manier om
crew-samenstelling te modelleren — dat is de **inverse attribuutnaam van `IfcRelAggregates`** in de
IFC4.3 EXPRESS-schema (niet van `IfcRelNests`, waarvan de inverse `Nests`/`IsNestedBy` heet). Beide
relaties zijn echter syntactisch bruikbaar: zowel `IfcRelAggregates` als `IfcRelNests` hebben
`RelatingObject`/`RelatedObjects: SET[1:?] IfcObjectDefinition`, en `IfcResource` ⊂ `IfcObject` ⊂
`IfcObjectDefinition`, dus beide zijn typecorrect.

De bestaande OPS-writer gebruikt al **beide** relaties voor verschillende soorten hiërarchie in
hetzelfde bestand: `IFCRELAGGREGATES` voor de workplan→workschedule-koppeling (`ifcWriter.ts:124-125`,
een echte whole/part-decompositie), en `IFCRELNESTS` voor de WBS-taakhiërarchie
(`writeWBSNesting`, `ifcWriter.ts:402-414` — een geordende, functionele groepering, geen ruimtelijke
decompositie). Ploeg-lidmaatschap (een CREW-resource met leden) is qua semantiek dichter bij de
WBS-groepering (functionele samenstelling, geen whole/part-boekhouding) dan bij de
workplan/workschedule-aggregatie.

**Invulling, te bevestigen bij review**: kies **`IFCRELNESTS`**, consistent met hoe OPS al
taakhiërarchie modelleert — `RelatingObject` = de CREW-resource, `RelatedObjects` = de leden
(`resources.filter(r => r.parentId === crew.id)`). Als een externe tool dit anders leest, is de
`OPS_Resource`-pset-fallback (GUID-referentie, zie B8) het vangnet: voeg een `ParentGuid`-property
(`IFCTEXT`, de IFC-GUID van de parent-resource) toe aan `OPS_Resource` naast de `IFCRELNESTS`-relatie,
zodat de eigen reader nooit afhankelijk is van interpretatie van de relatie-richting door andere
software.

### 7.4 Assignments: `OPS_Assignments`-pset op de taak (verificatie B8)

**Bevestigd afwijzen van het domeinrapport-detailvoorstel**: het rapport zelf (§8.E) stelt voor een
Pset op de `IfcRelAssignsToProcess`-relatie te zetten voor per-assignment-data — B8 constateert
terecht dat dit **niet uitvoerbaar** is: `IfcRelDefinesByProperties.RelatedObjects` is getypeerd als
`SET[1:?] IfcObjectDefinition`, en `IfcRelAssignsToProcess` (een `IfcRelationship`, niet een
`IfcObjectDefinition`) past daar niet in. Een pset kan dus principieel niet aan een relatie-instantie
hangen.

**Gekozen invulling** (B8, uitgewerkt): huidige `writeAssignments` (`ifcWriter.ts:463-479`) groepeert
per taak tot één `IFCRELASSIGNSTOPROCESS` (task = `RelatingProcess` in arg 6, resources in
`RelatedObjects` arg 4 — bevestigd correcte richting, `extractAssignments` leest dit al goed terug,
`ifcReader.ts:600,605`). De per-assignment-payload gaat in een **nieuwe** `OPS_Assignments`-pset **op
de `IFCTASK`-entiteit** (niet op de relatie): één `IFCPROPERTYSINGLEVALUE` per assignment, met
**property-naam = de resource-GUID** en **waarde = `"unitsPerDay|curve"`** (bv.
`'2h7K...9x': IFCTEXT('1.5|BACK_LOADED')`), zoals B8 voorschrijft. Alleen geschreven wanneer de taak
minstens één assignment heeft.

```ts
function writeAssignmentMeta(ctx: WriteContext, tasks: Task[], assignments: ResourceAssignment[], ownerHistId: number): void {
  const byTask = new Map<string, ResourceAssignment[]>();
  for (const a of assignments) {
    if (!byTask.has(a.taskId)) byTask.set(a.taskId, []);
    byTask.get(a.taskId)!.push(a);
  }
  for (const task of tasks) {
    const list = byTask.get(task.id);
    if (!list || list.length === 0) continue;
    const props = list.map(a => {
      const resGuid = ifcGuid(a.resourceId); // zelfde GUID als writeResource gebruikte
      const val = `${a.unitsPerDay}|${a.curve ?? 'UNIFORM'}`;
      const propId = addLine(ctx, `_asgn_${task.id}_${a.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(resGuid)},$,IFCTEXT(${ifcStr(val)}),$)`);
      return `#${propId}`;
    });
    const setId = addLine(ctx, `_pset_asgn_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(ifcGuid('pset_asgn_' + task.id))},#${ownerHistId},'OPS_Assignments',$,(${props.join(',')}))`);
    addLine(ctx, `_rel_asgn_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(ifcGuid('rel_asgn_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}
```

Reader: spiegelt de `OPS_Constraints`-lees-tak (`ifcReader.ts:449-473`-patroon) — bij
`psetName === 'OPS_Assignments'`, voor elke property: `IFCPROPERTYSINGLEVALUE`'s **naam** (args[0]) is
de resource-GUID, matchen tegen `resourceStepIdMap`/de al opgebouwde GUID→id-mapping (moet in
`extractResources` bijgehouden worden — vandaag bouwt die functie geen GUID-index, dat moet erbij: een
`Map<ifcGuid, ourResourceId>` naast `resourceStepIdMap` (STEP-# → ons id)); waarde parsen als
`"unitsPerDay|curve"` via split op `|`. Assignment zonder pset-entry (legacy bestand) → fallback
`unitsPerDay: 1, curve: undefined` (huidige hardcoded `units: 1`-gedrag, `ifcReader.ts:613`).

### 7.5 Resource-kalenders: `IfcWorkCalendar` + `IfcRelAssignsToControl`

Bevestigde IFC 4.3-bevinding (domeinrapport §8.D, letterlijk uit de spec): `IfcWorkCalendar` "is used
to define a work calendar for tasks (IfcTask) and resources (IfcResource)" via
`IfcRelAssignsToControl` met `RelatingControl = IfcWorkCalendar`. Er is **geen** `CalendarId`-achtig
attribuut op de resource zelf — één relatie-instantie per kalender↔resource(s)-paar.

- Elke `resourceCalendars[]`-entry → een extra `IFCWORKCALENDAR`, geschreven met **exact dezelfde**
  `writeCalendar`-functie als de projectkalender (`ifcWriter.ts:369-390`) — die functie is al
  parametrisch in `cal: WorkCalendar`, dus rechtstreeks herbruikbaar, geen aanpassing nodig. Elke
  aanroep krijgt een unieke `ctx`-key (`_calendar` is vandaag hardcoded als key voor de proceskalender,
  regel 388 — dat moet parametrisch worden: `writeCalendar(ctx, cal, ownerHistId, key)` met
  `key = 'calendar_' + cal.id` voor resource-kalenders, `'_calendar'` blijft voor de projectkalender
  zodat bestaande verwijzingen niet breken).
- Per resource met `calendarId` gezet: één `IFCRELASSIGNSTOCONTROL(guid, ownerHist, $, $,
  (resourceRef), $, calendarRef)` — `RelatedObjects` = de resource(s) met die `calendarId` (groepeer
  net als `writeAssignments` doet per taak, hier per kalender), `RelatingControl` = de
  `IFCWORKCALENDAR`-ref.

**Reader**: nieuwe functie `extractResourceCalendars` — alle `IFCWORKCALENDAR`-entiteiten **behalve**
degene die de bestaande `extractCalendar` (`ifcReader.ts:194-218`, zoekt de **eerste**
`IFCWORKCALENDAR` via `entities.find`) al als projectkalender heeft gepakt. Onderscheid: volg
`IFCRELASSIGNSTOCONTROL`-relaties waarvan `RelatedObjects` **taken** bevat (→ dat is de
projectkalender-koppeling naar `workSchedId`/taken, bestaand gedrag) versus relaties waarvan
`RelatedObjects` **resources** bevat (→ nieuwe resource-kalenders). Herstel `resourceCalendars[]` +
zet `resource.calendarId` voor elke gekoppelde resource.

*Invulling, te bevestigen bij review*: de huidige `extractCalendar` pakt domweg de eerste
`IFCWORKCALENDAR` in het bestand als projectkalender, zonder de `IFCRELASSIGNSTOCONTROL`-relatie te
volgen — dat blijft zo (regressierisico vermijden), maar het betekent dat de **volgorde** waarin
kalenders in het bestand staan er in de praktijk toe doet als een ander IFC-tool het bestand
herschrijft. Voor OPS-eigen round-trip is dit geen probleem (OPS schrijft de projectkalender altijd
eerst, `ifcWriter.ts:110`, vóór de resources op regel 149-151); voor bestanden van andere tools kan
dit fragiel zijn — buiten scope om nu te repareren, wel hier genoteerd.

### 7.6 `Task.priority` en `Task.levelingDelay`

- **`Priority`**: IFC 4.3 `IfcTask` heeft een eigen `Priority`-attribuut (INTEGER) — native, geen
  Pset nodig (domeinrapport §8.E-tabel: "geen (IfcTask hééft wel een eigen Priority-attribuut)").
  *Invulling, te bevestigen bij review*: de huidige `writeTask` (`ifcWriter.ts:398-399`) schrijft een
  vaste 12-argumenten-STEP-regel met `$`-placeholders voor de niet-gebruikte attributen (Status,
  WorkMethod, Identification, LongDescription) — geen van die posities is vandaag geverifieerd tegen
  de exacte IFC4.3-EXPRESS-attribuutvolgorde (de schrijver is een pragmatische subset, geen
  volledig-conform-schema-dump). `Priority` moet op zijn correcte positie in die argumentenlijst
  ingevoegd worden (vermoedelijk vlak vóór `TaskTime`, na `IsMilestone`, gebaseerd op de
  attribuutvolgorde Status/WorkMethod/IsMilestone/Priority/TaskTime/PredefinedType in de
  overervingsketen) — **exacte index bij implementatie tegen de IFC4.3-HTML-spec verifiëren**, niet
  zomaar aannemen. Alleen schrijven wanneer `priority !== 500` (default), anders `$` (gouden regel).
  Reader: `extractTasks` (`ifcReader.ts:245-258`) leest vandaag hardcoded `priority: 0` — wordt een
  veilige parse op de juiste index: `const p = parseInt(raw, 10); priority = Number.isFinite(p) ? p : 500`.
  **Niet** het patroon `parseInt(...) || 500` gebruiken: `0 || 500` evalueert naar `500`, waardoor een
  legitieme prioriteit 0 (laagste, levelt als eerste weg) stilletjes zou corrumperen naar de default.
- **`LevelingDelay`**: geen native IFC-slot op taakniveau (het zit wél op `IfcResourceTime.Usage`,
  maar dat is per-resource-instantie, niet per-taak — en OPS heeft geen per-assignment
  resource-occurrence-model, §2.4/§7.4). Nieuwe `OPS_Leveling`-pset op de `IFCTASK` (zelfde
  `OPS_Constraints`-patroon): property `LevelingDelay` (`IFCINTEGER`, werkdagen), alleen geschreven
  wanneer `task.levelingDelay` gezet en `!== 0` is.

### 7.7 Gouden regel & migratie

Een bestand zonder resources/toewijzingen/kalenders/prioriteiten-afwijkingen/leveling-delays
round-trippt **bit-identiek** met vandaag: elke nieuwe pset/attribuut-schrijfweg heeft een
"alleen schrijven als afwijkend van default"-guard, exact zoals `writeConstraints`/`writeMilestoneMeta`
dat al doen (`ifcWriter.ts:318,328,349,356` — telkens een `if`-guard vóór `props.push`). Concreet:
geen `OPS_Resource`-pset bij `maxUnits===1 && !costPerHour && !unitOfMeasure && !availabilitySteps`;
geen `OPS_Assignments`-pset bij nul assignments; geen extra `IFCWORKCALENDAR` bij lege
`resourceCalendars`; geen `Priority`-attribuutwaarde (blijft `$`) bij `priority===500`; geen
`OPS_Leveling`-pset bij `levelingDelay===undefined||0`.

**Migratie oude bestanden**: reader die `MaxUnits`/`unitsPerDay` niet vindt in de betreffende psets →
`maxUnits=1`/`unitsPerDay=1` (huidig gedrag, `ifcReader.ts:583,613`, ongewijzigd als default-fallback
— alleen de veldnamen zijn hernoemd, de waarden niet).

---

## 8. P6/MSP-mapping + verliesmatrix

CSV blijft ongewijzigd (buiten scope, §1). Adapterbestanden en huidige signaturen:
`src/services/p6/p6xmlWriter.ts` (`writeP6XML`, regel 53, met vandaag genegeerde `_resources`/
`_assignments`, regel 58-59) en `src/services/p6/p6xmlReader.ts` (`readP6XML`, regel 64, retourneert
lege arrays, regel 247-248); `src/services/msproject/mspdiWriter.ts` (`writeMSPDI`, regel 62, met
genegeerde `_resources`/`_assignments`, regel 67-68) en `src/services/msproject/mspdiReader.ts`
(`readMSPDI`, regel 56, lege arrays regel 218-219).

### 8.1 P6-XML

**`<Resource>`** (nieuw, per resource): `Id`/`ObjectId`, `Name`, `ResourceType` =
`Labor|Nonlabor|Material` (`LABOR`→`Labor`, `EQUIPMENT`/`SUBCONTRACTOR`→`Nonlabor`, `CREW`→`Labor`
+ `ParentObjectId` gezet op het eigen id zodat leden ernaar kunnen verwijzen, `MATERIAL`→`Material`
+ verplichte `UnitOfMeasureAbbreviation` = `resource.unitOfMeasure`), `MaxUnitsPerTime` =
`maxUnits × calendar.hoursPerDay` (uren/dag — P6 slaat dit in tijdseenheden op, domeinrapport §9),
`CalendarObjectId` (verwijst naar de nieuw geschreven `<Calendar Type="Resource">`-entry wanneer
`calendarId` gezet is; anders naar de bestaande projectkalender-entry — huidige writer hardcodeert
`<CalendarObjectId>1</CalendarObjectId>` op regel 141, dat wordt de echte referentie), `ParentObjectId`
voor ploeg-leden (`resource.parentId` → het P6-`ObjectId` van de parent-CREW-resource).

**`<ResourceAssignment>`** (nieuw, per assignment): `ActivityObjectId`/`ResourceObjectId`,
`PlannedUnitsPerTime` = `unitsPerDay × calendar.hoursPerDay`, `PlannedCurve` = curve-naam-mapping
(zie tabel §8.3).

**Reader**: omgekeerd — `Nonlabor`→`EQUIPMENT` als default (SUBCONTRACTOR is niet onderscheidbaar uit
alleen `ResourceType`; *invulling, te bevestigen bij review*: als P6 een `RoleObjectId`/naam-heuristiek
geeft is dat niet betrouwbaar genoeg — kies `EQUIPMENT` als P6→OPS-default voor `Nonlabor` zonder
verdere info, consistent met hoe de huidige IFC-reader ook geen onderscheid maakt tenzij het expliciet
in het bestand staat).

### 8.2 MSPDI

**`<Resources><Resource>`**: `Type` = `1` (Work) voor `LABOR|EQUIPMENT|CREW|SUBCONTRACTOR`, `0`
(Material) voor `MATERIAL`; `MaxUnits` = `maxUnits` als float (`1.0` = 100%); `MaterialLabel` =
`unitOfMeasure`; `CalendarUID` + een `<Calendars><Calendar>`-entry per resource-kalender (huidige
`writeMSPDI` schrijft al een `<Calendars>`-sectie voor de projectkalender — hergebruik dat blok
parametrisch voor resource-kalenders).

**`<Assignments><Assignment>`**: `TaskUID`/`ResourceUID`, `Units` = `unitsPerDay`, `WorkContour` =
curve-enum-mapping (zie §8.3 — **B9 vraagt de enum-volgorde te verifiëren**: MSPDI-schema-documentatie
geeft `0=Flat, 1=BackLoaded, 2=FrontLoaded, 4=EarlyPeak, 5=LatePeak, 6=Bell` — dit **wijkt af** van de
door B9 zelf gesuggereerde volgorde in de opgave; zie tabel + toelichting §8.3), `Work` =
`duur × unitsPerDay × hoursPerDay` in `PT`-formaat (hergebruik van de bestaande
`durationToISO8601`-helper, `mspdiWriter.ts:23-27`, die exact dit al doet voor taakduur — nu ook
aanroepen voor assignment-`Work`).

**Reader**: omgekeerd, `Type===0`→`MATERIAL`, anders `LABOR` als default (MSP heeft geen
CREW/SUBCONTRACTOR-onderscheid — *invulling, te bevestigen bij review*: alle `Type=1`-resources zonder
verdere hint komen terug als `LABOR`; een gebruiker die een MSP-Subcontractor-workaround importeert
krijgt dus `LABOR` i.p.v. `SUBCONTRACTOR`, geaccepteerd verlies, zie §8.4).

### 8.3 Curve-/contour-naammapping

| OPS `ResourceCurve` | P6 `PlannedCurve` (naam) | MSPDI `WorkContour` (enum) |
|---|---|---|
| `UNIFORM` | `Linear` (P6-default) | `0` (Flat) |
| `FRONT_LOADED` | `Front Loaded` | `2` (FrontLoaded) |
| `BACK_LOADED` | `Back Loaded` | `1` (BackLoaded) |
| `BELL` | `Bell Shaped` | `6` (Bell) |
| `EARLY_PEAK` | `Early Peak` | `4` (EarlyPeak) |
| `LATE_PEAK` | *(geen P6-equivalent — domeinrapport §7: "Late Peak" is een MSP-naam, geen P6-curve)* → schrijf `Early Peak` als beste benadering, of laat leeg | `5` (LatePeak) |

**Verificatie-opmerking bij B9**: de opgave suggereerde de MSPDI-`WorkContour`-volgorde
`0=Flat,1=BackLoaded,2=FrontLoaded,4=EarlyPeak,5=LatePeak,6=Bell` — dit is exact wat hierboven staat
(geen correctie nodig, de opgave was al juist); de indices 3 en 7+ (`Contoured`/varianten) worden niet
gebruikt. *Bevestig bij implementatie tegen een echte "Save as XML"-export of de MPXJ-bron
(`mpxj.org`) zoals het domeinrapport zelf aanraadt (§9), dit is niet onafhankelijk heront-dekt in dit
ontwerpdocument.*

### 8.4 Verliesmatrix

| Concept | P6-XML | MSPDI | Verlies |
|---|---|---|---|
| `CREW`/`SUBCONTRACTOR`-onderscheid | Crew→`Labor`+parent (verlies: type-info alleen via hiërarchie terugleesbaar) | Beide→`Type=1` (verlies: geen onderscheid, komt terug als `LABOR`) | Bij MSP-import: crew/subcontractor-informatie is weg tenzij de gebruiker het handmatig herstelt |
| `availabilitySteps` (tijd-gefaseerd) | Native (Units-and-Prices-rijen, effective dates) — vlak schrijven volstaat voor 2.5 (geen staffel-export in eerste iteratie, *invulling*: alleen de vlakke `maxUnits` exporteren, staffel-export is een latere uitbreiding) | `AvailabilityPeriods` bestaat, maar MSP's eigen scheduler negeert het voor de forward pass (domeinrapport §1) — kan wel geschreven worden voor leveling-doeleinden aan MSP-zijde, maar OPS exporteert in 2.5 alleen vlakke `MaxUnits` | Tijd-gefaseerde capaciteit gaat verloren bij export naar beide formaten in de eerste iteratie |
| `curve` | `PlannedCurve` (naam) — 5/6 mappen 1:1, `LATE_PEAK` bij benadering | `WorkContour` (enum) — alle 6 mappen 1:1 | Klein verlies bij P6-`LATE_PEAK` |
| `parentId`/ploeg-hiërarchie | `ParentObjectId` — native | Geen (geen `OutlineCode`-mapping in 2.5) | MSP-export verliest ploeg-structuur volledig |
| `unitOfMeasure` | `UnitOfMeasureAbbreviation` — native | `MaterialLabel` — native | Geen verlies |
| `costPerHour` | Prijs-tabel-mechanisme (5 tiers) — OPS schrijft één vlak tarief in de eerste tier | `StandardRate` — één vlak tarief, native | Geen verlies (OPS heeft toch maar één tarief) |

---

## 9. Testplan

`tests/planning/harness.ts` (huidige case-spec: regel 36-42) uitbreiden. Nieuwe velden op `Case`:

```ts
interface Case {
  // ... bestaand ...
  resources?: { name: string; type?: ResourceType; maxUnits?: number;
                calendar?: { workDays?: number[]; holidays?: {name,startDate,endDate}[] };
                steps?: { from: string; maxUnits: number }[] }[];
  // per taak (uitbreiding van het bestaande tasks[]-element):
  //   assign?: { res: string; units: number; curve?: ResourceCurve }[]
  level?: { constrainToFloat?: boolean; resources?: string[] };
  expect: {
    // ... bestaand ...
    load?: { [resName: string]: { [isoDate: string]: number } };          // spot-checks
    overallocatedDays?: { [resName: string]: string[] };
  };
}
```

`buildAndSolve` (regel 44-91) uitbreiden: na het aanmaken van taken, `S().addResource(...)` per
`c.resources[]`-entry (en `S().addResourceCalendar(...)` als `calendar` is opgegeven), dan per taak met
een `assign[]`-array `S().assignResource(taskId, resId, units, curve)` aanroepen, en als `c.level` is
opgegeven `S().levelResources(options)` ná `runCPM()` (gevolgd door een herbevestiging dat
`cpmResult` de nivelleer-`levelingDelay`s heeft verwerkt — dat gebeurt automatisch omdat
`applyLeveling` zelf `runCPM()` aanroept, §5.6).

Nieuwe assertie-helpers in `runCase`: `load`-spotchecks vergelijken
`S().resourceLoadResult?.load[resId]?.[iso]` tegen de verwachte waarde (op naam→id gemapt, zelfde
patroon als `readTask`); `overallocatedDays` vergelijkt als verzameling (zelfde patroon als
`criticalPathSet`).

### 9.1 Nieuwe casebestanden

**`cases-resource-load.json`** (curves, som-exactheid, randgevallen):
- Elke curve (`UNIFORM/FRONT_LOADED/BACK_LOADED/BELL/EARLY_PEAK/LATE_PEAK`) op een 5-dagen-taak met
  `unitsPerDay=2`: verwacht `Σ load[dag] === 10` exact (grootste-rest-afronding getest).
- `D=1`: alle curves geven `[unitsPerDay]` op de enige dag.
- Kalender-capaciteit-0 op een niet-werkdag van de resource-kalender (resource met eigen
  weekend-kalender afwijkend van de projectkalender) → `capacity[iso] === 0` op die dag, ook al is het
  een werkdag in de projectkalender.
- `availabilitySteps`: twee stappen, verwacht dat capaciteit vóór/na de ingangsdatum verschilt.
- `CREW`-resource: belasting telt op als normale renewable, geen automatische rollup van leden
  (expliciete case die bewijst dat een parent-CREW z'n eigen assignment nodig heeft — leden-belasting
  telt niet automatisch mee bij de crew).
- Materiaal: belasting/overallocatie-vlag werkt (verbruik > `maxUnits`), maar wordt door de leveler
  genegeerd (zie leveling-cases).
- Leaf-only: een poging tot `assignResource` op een milestone of summary-taak resulteert in **geen**
  nieuwe assignment (regressietest voor §2.4-enforcement).

**`cases-resource-leveling.json`** (~conflictscenario's, hand-berekend):
- Basisconflict: 2 taken, gelijke prioriteit, 1 gedeelde resource met te weinig capaciteit voor beide
  tegelijk → de een schuift op, `levelingDelay` correct, float na nivellering eerlijk herrekend
  (test dat total float NIET meer de pre-leveling-waarde toont, §10-P2-regressie).
- Smoothing (`constrainToFloat: true`) binnen float vs. leveling (`false`) voorbij de einddatum:
  zelfde input, verschillend `constrainToFloat` → verschillende `projectEndAfter`.
- Priority-volgorde: hogere priority eerst geplaatst (MSP-semantiek, §5.2); `priority: 1000` blijft
  vastgepind ondanks conflict.
- Determinisme-tiebreak: twee taken met identieke priority/float/ES → laagste taak-ID wint de
  volgorde (test met bewust omgekeerde aanmaakvolgorde vs. verwachte plaatsingsvolgorde).
- Curve-bewust nivelleren: een front-loaded en een back-loaded taak op dezelfde resource conflicteren
  alleen op de dagen waar hun curve-pieken overlappen — test dat de leveler dat correct detecteert
  (i.p.v. een vlakke-verdeling-aanname die het conflict zou missen of onterecht zou vinden).
- Materiaal genegeerd: een MATERIAL-overallocatie blijft staan na nivelleren (leveler raakt het niet
  aan), terwijl een LABOR-conflict op dezelfde taken wel wordt opgelost.
- Multi-resource-taak: een taak met twee renewable-assignments waarvan er één een conflict heeft —
  de hele taak schuift (P6-gedrag: taak-niveau-verschuiving, geen per-assignment-split in 2.5, buiten
  scope §1).
- Ketting-propagatie (PF-semantiek, §5.5-4f): taak A schuift door een resourceconflict; opvolger B
  (FS-relatie) deelt de resource met een derde taak. Verwacht: B start exact ná A's verschoven finish
  (of later als B's eigen conflict dat vergt), en B's `levelingDelay` is t.o.v. zijn precedence-
  feasible start — hand-berekende einddatums bewijzen dat er géén dubbeltelling van A's verschuiving
  in B's positie zit.
- Conflict-onoplosbaar-binnen-float: `constrainToFloat: true`, geen slot binnen `[ES,LS]` → taak
  blijft ongewijzigd, `unresolved` bevat de resource+conflictdagen.

**Richtgetal**: ±35 nieuwe cases over beide bestanden samen, hand-berekend (geen orakel-gebaseerde
verwachtingen). Alle 202 bestaande cases (176 uit de mijlpalen-inventarisatie + de sindsdien
toegevoegde constraint/lag-batterijen — het exacte aantal ten tijde van dit schrijven, zie
CLAUDE.md: "176 stuks" was de stand op 2026-07-02, ondertussen bijgewerkt) blijven ongewijzigd groen —
resources raken de bestaande CPM-paden niet aan tenzij `levelingDelay` gezet is (default `undefined`,
dus de nieuwe forwardPass-regel in §5.6 is een no-op voor alle bestaande cases).

---

## 10. i18n-keylijst

Geen nieuwe namespace (B11) — vier bestaande namespaces (`common`, `task`, `report`, `menu`,
`src/i18n/config.ts:126`), 14 locales (`config.ts:76-78`, RTL voor `ar`/`fa` via `RTL_LOCALES:80`).

**`menu`-namespace** (ribbon/backstage-labels, patroon `ribbon.xxx` zoals bestaande
`ribbon.calendar`/`ribbon.schedule` etc.):
```
ribbon.resources                    // tabnaam "Resources"
ribbon.resourceManagement           // groep "Beheer"
ribbon.openResourcePanel
ribbon.newResource
ribbon.resourceAssignment           // groep "Toewijzing"
ribbon.assignResource
ribbon.histogram                    // groep "Histogram"
ribbon.toggleHistogram
ribbon.prevResource / ribbon.nextResource
ribbon.leveling                     // groep "Nivellering"
ribbon.levelResourcesDialog         // "Nivelleren…"
ribbon.clearLeveling                // "Nivellering wissen"
ribbon.overallocationIndicator      // groep "Indicator"
```

**`common`-namespace** onder een `resource.*`-prefix (editor, histogram, nivelleer-dialoog — patroon
zoals bestaande `structure.*`/`ribbon.calendarDialog.*`-genest-keys):
```
resource.type.labor / .equipment / .material / .subcontractor / .crew
resource.name / resource.maxUnits / resource.calendarId / resource.costPerHour / resource.unitOfMeasure / resource.parent
resource.availabilityStepsEditor.title / .addStep / .from / .maxUnits
resource.panel.title / .addRow / .deleteRow
resource.calendarDialog.title        // ResourceCalendarDialog-titel (hergebruikt ribbon.calendarDialog.* verder)
resource.histogram.allResources
resource.histogram.overallocatedTooltip  // "{count} taken dragen bij op {date}"
resource.leveling.dialogTitle
resource.leveling.constrainToFloat       // "Alleen binnen speling nivelleren (smoothing) — projecteinddatum blijft vast"
resource.leveling.resourceSelect
resource.leveling.calculate / .apply / .cancel
resource.leveling.projectEndUnchanged / .projectEndChanged
resource.leveling.remainingConflicts
resource.curve.uniform / .frontLoaded / .backLoaded / .bell / .earlyPeak / .latePeak
```

**`task`-namespace** (properties-panel, sectie "Toewijzingen"):
```
properties.assignments.title
properties.assignments.add / .remove
properties.assignments.unitsPerDay
properties.assignments.curve
properties.assignments.disabledMilestone     // tooltip
properties.assignments.disabledSummary       // tooltip
properties.priority                          // label bij priority-veld (indien in UI getoond)
properties.levelingDelay                     // read-only weergave, indien getoond
```

*Vertalen naar de overige 13 talen gebeurt in een latere stap* (B11) — dit document benoemt alleen de
key-structuur; de NL-bronwaarden volgen de projectconventie (Nederlands werktaal, CLAUDE.md i18n-sectie).

---

## 11. Implementatievolgorde

Gebaseerd op de gap-afhankelijkheden uit de inventaris (§"Gaps — gerangschikt op
bouwvolgorde-afhankelijkheid"), aangevuld met de nivelleer-scope:

1. **Datamodel** (`src/types/resource.ts`, `task.ts`-priority-hergebruik+`levelingDelay`) +
   `resourceSlice.ts`-signatuurwijzigingen (`assignResource`) + migratie-defaults
   (`taskSlice.ts:71,444`, `projectSlice.ts:151`, `ifcReader.ts:253` priority-default 0→500). Geen
   enkele volgende stap kan zonder dit.
2. **Kalender-registry** in de store (`resourceCalendars`) + snapshot/documentSlice/recovery-wiring
   (§3.3) + `CalendarDialog`-extractie naar `CalendarForm` + `ResourceCalendarDialog` (§3.4).
3. **`resourceSlice` undo-snapshots** (ontbreken vandaag volledig, inventaris §2) + nieuwe acties voor
   kalenders/curves/prioriteit/levelingDelay-wissen. `isDirty` overal.
4. **Testharnas-uitbreiding** (§9) — vóór de engines zelf, TDD-stijl: `resources`/`assign`/`level`
   in de case-spec + assertie-helpers, zodat cases 5 en 6 rood-dan-groen kunnen.
5. **`ResourceLoad.ts`**: `distributeUnits` + `computeResourceLoad`, aangeroepen vanuit `runCPM`
   (`scheduleSlice.ts`), nieuw store-veld `resourceLoadResult`. `cases-resource-load.json` rood→groen.
6. **`ResourceLeveler.ts`** + CPMSolver-hook (`forwardPass`, §5.6) + `applyLeveling`/`clearLeveling`-
   acties. `cases-resource-leveling.json` rood→groen. Alle 202 bestaande cases blijven groen
   (regressiebewijs dat `levelingDelay===undefined` een no-op is).
7. **UI-state + ribbon** (`RibbonTab`, `showResourcePanel`/`showHistogram`/`histogramHeight`,
   `ViewState.histogramResourceId`) — geen technische afhankelijkheid, maar logisch na (3).
8. **Resource-beheer-UI** (paneel, toewijzingssectie in TaskPropertiesPanel, ribbon-Resources-tab
   met alle knoppen, nivelleer-dialoog met preview-diff).
9. **Histogramstrook** (`HistogramRenderer` + `GanttCanvas`-layout-split) — de grootste renderer-
   wijziging; hangt af van (5) voor data en (7) voor UI-state.
10. **IFC round-trip** (§7): resourcetype-uitbreiding, `OPS_Resource`/`OPS_Assignments`/`OPS_Leveling`-
    psets, resource-kalender via `IfcRelAssignsToControl`, `Priority`-attribuut (index-verificatie!).
    Headless round-trip-verificatie (schrijf → lees → vergelijk) als onderdeel van deze stap.
11. **P6/MSP-adapters** (§8): resource/assignment-tabellen, curve-mapping, verliesmatrix-gedrag
    verifiëren tegen een echte export indien mogelijk.
12. **i18n** (§10): NL-bronkeys in alle vier namespaces; overige 13 talen in een latere stap (B11).
13. **Zelftest** (browser + `window.__OPS__` + Playwright, per `docs/self-test-harness.md`) +
    screenshots van histogram/nivelleer-dialoog/resource-paneel + docs-update
    (`docs/TODO.md`, `docs/CHANGELOG.md`).

---

## 12. Risico's & valkuilen

Uit domeinrapport §10, per valkuil de OPS-tegenmaatregel (samengevat, met verwijzing naar de sectie
hierboven die het al implementeert):

1. **Arbitraire ID-tiebreak** [V] — OPS publiceert de volledige, deterministische sorteervolgorde
   (§5.2) inclusief expliciete laatste sleutel (taak-ID); geen stille terugval zoals P6.
2. **Phantom float** [V] (best gedocumenteerd) — `levelingDelay` loopt door de echte forward+backward
   pass (§5.6); float na nivellering is altijd de waarheid, nooit een pre-leveling-artefact.
3. **Stille einddatum-verschuiving** [V] — de UI toont altijd expliciet `projectEndBefore/After` vóór
   commit (§5.8), nooit stilzwijgend.
4. **Materiaal + leveling** [V]/[S] — leveler slaat `MATERIAL` altijd over (§5.3); overallocatie-
   detectie blijft wel actief als inkoop-/levertijdsignaal (§4.2 punt 5).
5. **Valse overallocatie door granulariteit** [V] — één vaste dagregel, geen instelbare basis (§4.2,
   §1 "bewust nooit doen"-lijst).
6. **Histogramvervuiling door summary-rijen** [V] — leaf-only enforcement op twee plekken (§2.4);
   milestones kunnen sowieso geen assignments dragen.
7. **Eenheid zonder validatie/conversie** [V] — `unitOfMeasure` blijft in 2.5 vrije tekst (zoals P6/MSP
   zelf); getypeerde dimensies/conversie is een expliciete niet-doen voor deze fase (niet in B1
   genoemd als in-scope, dus niet gebouwd — risico blijft bestaan, gedocumenteerd als bekende
   beperking, geen mitigatie in 2.5).
8. **Tijdseenheid-ambiguïteit bij bestandsuitwisseling** [V] — IFC bewaart eenheden expliciet
   (`hoursPerDay` uit de kalender bij P6/MSP-conversie, §8.1/§8.2); presentatie-eenheid is puur UI.
9. **Role + resource tariefsubstitutie** [V] — niet van toepassing: OPS heeft geen Roles in 2.5
   (buiten scope, §1), dus dit risico bestaat nog niet totdat rollen ooit gebouwd worden.
10. **Kalender×leveling valse conflicten** [V] — resource-kalenders zijn informatief en raken de
    CPM-datums niet aan (§3.2); de leveler gebruikt wél de resource-kalender voor capaciteit (§4.2
    punt 4) — een taakkalender-dag die geen werkdag is voor een resource geeft daardoor mogelijk een
    onoplosbaar conflict bij `constrainToFloat: true`, wat correct in `unresolved` terechtkomt (geen
    silent failure, wel een reëel risico dat gebruikers dit als "bug" ervaren — te mitigeren met
    duidelijke UI-copy bij `unresolved`-items, *invulling, te bevestigen bij review*: exacte
    tekst/uitleg in de preview-diff).
11. **Percent-complete-semantiek-divergentie** [V] — niet van toepassing: OPS heeft nog geen
    voortgangsregistratie op resource-niveau in 2.5 (buiten scope).
12. **Curves in histogram maar niet in leveler** [V] — structureel onmogelijk door ontwerp: één
    `distributeUnits`-functie voor beide (§4.1, §5.7).

---

## Samenvatting: invullingen en inconsistenties (voor de reviewer)

**"Invulling, te bevestigen bij review"** (verspreid door het document, hier verzameld):
- §3.1: `NamedCalendar` als los type is overbodig (`WorkCalendar` heeft al `id`/`name`) — voorstel:
  gebruik `WorkCalendar` rechtstreeks, optioneel een leesbaarheids-alias.
- §6.1: "Nieuwe resource" opent een inline tabelrij i.p.v. een modaal.
- §6.4: geselecteerde histogram-resource leeft in `ViewState` (niet `UIState`), sentinel `undefined`
  = "alle resources".
- §7.3: ploeg-hiërarchie via `IFCRELNESTS` (niet `IFCRELAGGREGATES`), met een `ParentGuid`-fallback-
  property in `OPS_Resource` als vangnet.
- §7.6: exacte STEP-argument-index van `IfcTask.Priority` moet bij implementatie tegen de IFC4.3-spec
  geverifieerd worden (niet in dit onderzoek onafhankelijk vastgesteld).
- §8.1: P6→OPS `Nonlabor` zonder verdere hint → `EQUIPMENT` als default.
- §8.2: MSP→OPS `Type=1` zonder verdere hint → `LABOR` als default.
- §8.4: `availabilitySteps` wordt in eerste iteratie NIET geëxporteerd naar P6/MSP (alleen vlakke
  `maxUnits`) — staffel-export is een latere uitbreiding.
- §12-10: exacte UI-copy voor onoplosbare kalender-conflicten in de nivelleer-preview.

**Inconsistenties ontdekt tegen de vastgestelde beslissingen** (B-nummer → bevinding):
- **B2**: vraagt een nieuw `priority?: number`-veld op `Task`, maar `Task.priority: number` bestaat
  al (verplicht, ongebruikt, default 0 op drie plekken). Opgelost door hergebruik i.p.v. een tweede
  veld — zie §2.2.
- **B3**: `NamedCalendar = WorkCalendar & { id, name }` is een no-op-intersectie omdat `WorkCalendar`
  die velden al heeft (`src/types/calendar.ts:1-4`) — zie §3.1.
- **B9**: de gesuggereerde MSPDI-`WorkContour`-enum-volgorde in de opgave bleek bij nazicht al
  correct (geen fout gevonden, wel expliciet gemarkeerd als "verifieer tegen een echte export" omdat
  dit ontwerpdocument het niet onafhankelijk opnieuw heeft opgezocht) — zie §8.3.
