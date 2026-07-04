# Ontwerp: Fase 2.7 — Weergaven

*Status: **ontwerp, gereviewd (2026-07-04)** — architectuurbeslissingen (B1–B14) genomen door de
architect en niet heropend. De hoofdarchitect-review bevestigde de kern (gedeelde `viewRows`-selector,
presets-round-trip, tolerantie-regels, filtervoorbeelden nagerekend) en voegde toe: §4.5
(structuur-mutaties disabled buiten pure boommodus), pijl-gedrag bij multi-band-duplicaten (§7.1),
pad-encoderende band-sleutels (§7.1), en besliste de open invullingen (gemarkeerd **BESLIST**).*
*Datum: 2026-07-04 · Bron: [docs/TODO.md](../../TODO.md) §2.7 + het UX-item "resource-kolom(men) in
de taaktabel", codebase-inventaris + domeinrapport P6/MSP
(`/home/nozzit/.claude/jobs/fd7f4482/tmp/research-2.7-weergaven.md`) · Conventie & stijl: zie
[2026-07-03-resources-design.md](2026-07-03-resources-design.md).*

Dit document is bedoeld om zelfstandig te implementeren zonder het bronrapport te lezen: elke
beslissing citeert het exacte bestand/regel waar hij op aansluit.

---

## 1. Samenvatting & scope

Fase 2.7 maakt van Open Planner Studio een tool met **echte, opslaanbare weergaven**: een werkende
tijdschaal-keuze, configureerbare tabelkolommen (incl. een nieuwe resource-kolom), geneste AND/OR-
filters, multi-level groeperen en sorteren, app-globale layouts, presentation mode, split view binnen
één document en een mini-map. De rode draad — en de kern van het hele ontwerp — is dat de
**Gantt-canvas en de taaktabel exact dezelfde zichtbare-rijenlijst tonen**; die lijst wordt in 2.7
door **één gedeelde, headless, geteste functie** bepaald (§4), zodat filter/groep/sort onmogelijk
tussen tabel en Gantt kunnen divergeren.

### In scope (B1)

- **Tijdschaal-reparatie** (§3): het dode `view.timeScale`-veld wordt vervangen door een keuze die
  naar zoom-presets mapt; de getoonde schaal wordt **afgeleid uit `zoom`** (`pickTiers` blijft bron
  van waarheid). Jaar als directe keuze, kwartaal aan de dropdown toegevoegd. **Uur-schaal
  uitgesteld naar §2.8** (zie §3.4 + §16).
- **Gedeelde zichtbare-rijen-selector** (§4): één `computeViewRows()`-functie + één store-cache
  `viewRows`, geconsumeerd door zowel `TableEditor` als `GanttCanvas`/`GanttRenderer`.
- **Kolom-configuratie** (§5) op de HTML-`TableEditor`: zichtbaarheid + volgorde + breedte per kolom,
  over builtin-velden, activity codes, custom fields en een nieuwe **resource-kolom** (join via
  assignments, komma-gescheiden, read-only in 2.7).
- **Filteren** (§6): geneste `FilterNode` (AND/OR-groepen + regels), P6 "show summaries"-gedrag.
- **Groeperen/sorteren** (§7): `GroupLevel[]` / `SortLevel[]`, generalisatie van `groupTasksByCode`.
- **Layouts** (§8): app-globaal in localStorage via `settingsStore.ts`, CRUD + toepassen.
- **Presentation mode** (§9), **split view binnen één document** (§10), **mini-map** (§11).
- Alle controls in de **Beeld-ribbontab** (§13); testplan (§14), i18n (§15).

### Expliciet buiten scope (§16)

- **Uur-tijdschaal** → §2.8 (uren-scheduling). Het datamodel is dag-granulair; een uur-as zou
  misleiden (elke balk snapt op daggrenzen). Zie §3.4.
- **Rollup-totalen per groepsband** (som duur/kosten/units) — bandkop + count volstaat; totalen zijn
  fase 3.5/3.9.
- **Twee-documenten-split view** — vergt een store-singleton-refactor (§10.4). Bewust later.
- **Per-bestand-layouts (IFC-pset)** — ViewState round-trippt niet naar IFC; layouts blijven
  app-globaal. Bewust later (§8.5).
- **Kolom-config op de canvas-tabel** in de Gantt — die blijft bewust minimaal (§5.4).

### Grensvlak met fase 2.6 (parallel in ontwerp) — B14

2.6 (Baselines & voortgang) voegt **weergave-toggles** toe (baseline-overlay, voortgangslijn,
statusdatumlijn) en een derde rapporttype. Die toggles zijn **document-state**, geen view-preset:
ze horen bij *wat* er getekend wordt, niet bij *hoe* er gekeken wordt. **Beslissing: ze blijven
BUITEN het `Layout`-object.** Het `Layout` bewaart uitsluitend kolommen/groep/sort/filter/timescale
(§8.1). De Beeld-tab-indeling (§13) reserveert een lege groep **[Overlays]** rechts, zodat 2.6 zijn
toggles daar kan inpluggen zonder herindeling. Dit grensvlak wordt hier expliciet vastgelegd zodat
beide fases elkaar niet in de weg zitten.

---

## 2. Datamodel

Alle nieuwe types komen in `src/state/slices/types.ts` (bij `ViewState`/`UIState`) tenzij anders
vermeld. Ze zijn volledig JSON-serialiseerbaar (voor `DocumentPayload` én `Layout`).

### 2.1 `FieldRef` — één veld-referentie voor filter, groep én sort

De hoeksteen: filter, groep en sort verwijzen alle drie via hetzelfde `FieldRef` naar een veld, zodat
er één resolver is (`resolveField`, §6.2) die builtin/activityCode/customField/resource afhandelt.

```ts
export type BuiltinFieldKey =
  | 'name' | 'wbsCode' | 'duration' | 'start' | 'finish'
  | 'totalFloat' | 'isCritical' | 'completion' | 'taskType' | 'isMilestone';

export type FieldRef =
  | { src: 'builtin'; key: BuiltinFieldKey }
  | { src: 'activityCode'; typeId: string }   // waarde = valueId (uit task.activityCodes)
  | { src: 'customField'; defId: string }      // waarde = task.customFields[defId]
  | { src: 'resource' };                        // afgeleide waarde = namen van toegewezen resources
```

`builtin.start`/`finish` verwijzen naar de **CPM-datums** `task.time.earlyStart`/`earlyFinish` (zoals
de tabel die vandaag toont, `TableEditor.tsx:129-134`), `duration` naar
`task.time.scheduleDuration`, `totalFloat`/`isCritical` naar de door CPM gezette velden. Dit betekent
dat filter/sort **na `runCPM`** moeten herrekenen — zie de invalidatielijst in §4.4.

### 2.2 `ColumnConfig`

```ts
export interface ColumnConfig {
  field: FieldRef;      // welk veld deze kolom toont
  visible: boolean;
  width: number;        // px (was Tailwind-literal in de huidige TableEditor, §5)
}
```

Volgorde = arrayvolgorde. De default (`defaultColumns()`, §5.2) reproduceert exact de huidige
kolommenset en -breedtes, zodat een gebruiker zonder layout niets ziet veranderen.

### 2.3 `FilterNode`

```ts
export type FilterOperator =
  | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'
  | 'contains' | 'startsWith' | 'between' | 'isEmpty' | 'in';

export type FilterNode =
  | { kind: 'group'; op: 'AND' | 'OR'; children: FilterNode[] }
  | { kind: 'rule';
      field: FieldRef;
      operator: FilterOperator;
      value?: string | number | boolean | string[];
      value2?: string | number;   // alleen 'between'
    };
```

Een lege groep (`children: []`) matcht **alles** (neutraal element: `AND` van niets = true,
`OR` van niets = ook true bij ons — zie §6.2 voor de expliciete regel). `filter: null` op de
ViewState = geen filter actief (goedkope short-circuit in `computeViewRows`).

### 2.4 `GroupLevel` & `SortLevel`

```ts
export interface GroupLevel {
  field: FieldRef;
  dir: 'asc' | 'desc';   // volgorde waarin de banden zelf verschijnen
}

export interface SortLevel {
  field: FieldRef;
  dir: 'asc' | 'desc';
}
```

Datastructuur staat **N niveaus** toe; de UI beperkt groeperen tot **2 niveaus** en sort tot
herhaalbare rijen (multi-key onbeperkt) — §7. `group: []` = WBS-boom (huidig gedrag). `sort: []` =
boom-/bandvolgorde (huidig gedrag).

### 2.5 `Layout`

```ts
export interface Layout {
  id: string;
  name: string;
  columns: ColumnConfig[];
  group: GroupLevel[];
  sort: SortLevel[];
  filter: FilterNode | null;
  timeScale: TimeScale;   // preset-naam; toepassen → setZoom(TIMESCALE_ZOOM[timeScale]) (§3)
}
```

**Bewust NIET in `Layout`**: scrollX/scrollY (positie, niet presentatie), `presentationMode`/
`splitView`/`showMiniMap` (sessie-/UI-state), en de 2.6-overlay-toggles (document-state, §1/B14).
Een layout is een *presentatie-preset*, geen documentmomentopname.

### 2.6 ViewState- & UIState-uitbreidingen

`ViewState` (`types.ts:70`, per-document via `DocumentPayload.view`) krijgt:

```ts
// --- ViewState (per document) ---
columns?: ColumnConfig[];          // undefined = defaultColumns()
filter: FilterNode | null;         // default null
group: GroupLevel[];               // default []  (vervangt het huidige losse groupBy?: string, §7.5)
sort: SortLevel[];                 // default []
collapsedGroupKeys: string[];      // ingeklapte groepsbanden (analoog aan ui.collapsedTaskIds)
splitView?: SplitViewState;        // undefined = uit (§10)
// timeScale blijft als TYPE bestaan maar wordt NIET meer als bron opgeslagen (§3.2)
```

```ts
export interface SplitViewState {
  ratio: number;          // 0..1 breedteverdeling linker pane
  secondaryZoom: number;  // eigen zoom rechter pane
  secondaryScrollX: number;
}
```

`UIState` (`types.ts:80-118`, app-globaal) krijgt:

```ts
// --- UIState (app-globaal) ---
presentationMode: boolean;   // sessie-flag, niet gepersisteerd (§9)
showMiniMap: boolean;        // gepersisteerd via settingsStore (§11, §12)
```

**Migratie:** het bestaande `view.groupBy?: string` (`types.ts:72-74`, `viewSlice.ts:51-54`) wordt
vervangen door `group: GroupLevel[]`. Oude payloads/recovery met een `groupBy`-string worden bij
`hydratePayload`/`payloadFromInput` gemigreerd naar
`group = groupBy ? [{ field: { src: 'activityCode', typeId: groupBy }, dir: 'asc' }] : []` (§7.5).

---

## 3. Tijdschaal-reparatie

### 3.1 Huidige situatie (geverifieerd)

`view.timeScale` (`TimeScale = 'day'|'week'|'month'|'quarter'`, `types.ts:12`) is **vestigiaal**:
`setTimeScale` (`viewSlice.ts:35-38`) zet alleen het veld en raakt `zoom` niet aan. De renderer
negeert het volledig — `GanttRenderer.drawTimelineHeader` (`GanttRenderer.ts:279-311`) roept
`pickTiers(view.zoom, enableQH)` aan (`:294`); de as is puur zoom-gedreven
(`timelineTiers.ts:38-48`). De dropdown (`Ribbon.tsx:903-916`) biedt alleen day/week/month en doet
functioneel niets. De StatusBar (`StatusBar.tsx:54`) toont het (mogelijk foute) veld.

### 3.2 Beslissing: schaal wordt afgeleid uit `zoom`, geen los veld

**`view.timeScale` wordt niet langer als bron van waarheid opgeslagen.** In plaats daarvan:

1. De keuze in de dropdown mapt naar een **zoom-preset** (`setTimeScale(scale)` → `setZoom(...)`).
2. De **getoonde** schaal (dropdown-huidige waarde + StatusBar-tekst) wordt **afgeleid** uit `zoom`
   via een nieuwe pure functie `scaleFromZoom(zoom)`, die dezelfde zoom-banden leest als `pickTiers`.

Zo kan het label nooit desyncen van wat er getekend wordt — `pickTiers` blijft de enige bron van
waarheid voor de tijd-as.

```ts
// src/engine/renderer/timelineTiers.ts (bij pickTiers)
export function scaleFromZoom(zoom: number): TimeScale {
  if (zoom < 4)  return 'year';
  if (zoom < 10) return 'quarter';
  if (zoom < 25) return 'month';
  if (zoom < 80) return 'week';
  return 'day';                 // >=80: dag/uur-tiers; label 'day' (uur is 2.8, §3.4)
}
```

### 3.3 Presets-tabel (zoom ↔ schaal)

`setTimeScale(scale)` in `viewSlice.ts` wordt:

```ts
const TIMESCALE_ZOOM: Record<TimeScale, number> = {
  year: 3, quarter: 8, month: 18, week: 45, day: 100,
};
setTimeScale: (scale) => get().setZoom(TIMESCALE_ZOOM[scale]),  // + recenter, zie onder
```

De presets zijn zo gekozen dat ze **midden in de bijbehorende `pickTiers`-band** landen, dus de
afgeleide `scaleFromZoom` geeft exact de gekozen schaal terug (round-trip-stabiel):

| Keuze (dropdown) | `zoom` (px/dag) | `pickTiers` → {major, minor} (`timelineTiers.ts:38-48`) | `scaleFromZoom` → |
|---|---|---|---|
| **Jaar** | 3 | {year, quarter} (`zoom<4`) | `year` |
| **Kwartaal** *(nieuw)* | 8 | {year, month} (`4≤zoom<10`) | `quarter` |
| **Maand** | 18 | {month, week} (`10≤zoom<25`) | `month` |
| **Week** *(default)* | 45 | {month, day} (`25≤zoom<80`) | `week` |
| **Dag** | 100 | {day, hour} (`80≤zoom<400`) | `day` |
| ~~Uur~~ | — | {hour, quarterHour} (`zoom≥400`) | uitgesteld → §2.8 |

**Verificatie Dag-preset bij implementatie:** de tabel toont voor zoom 100 minor-tier "hour" — bij
implementatie verifiëren dat de Dag-preset op die zoom exact dezelfde tiers rendert als het huidige
default-gedrag (geen sub-dag-labels zonder de `enableQuarterHourZoom`-vlag); zo niet, de preset
bijstellen naar een zoom binnen de band die dag/dag toont.

**Recenter bij schaalwissel (BESLIST — akkoord zoals ontworpen):** bij `setTimeScale` de datum in
het **midden van het huidige viewport** vasthouden en `scrollX` navenant herberekenen (de datum onder
het midden vóór de zoomwissel blijft onder het midden erna). Dit hergebruikt de anker-logica die
Ctrl+`=`/`−` al toepast (`useKeyboardShortcuts.ts`, zoom-takken) — geen nieuwe berekening, alleen
dezelfde ankerformule met het viewportmidden als pivot.

### 3.4 Uur-schaal uitgesteld naar §2.8 — reden

Het hele datamodel is **dag-granulair**: `task.time.scheduleDuration` = werkdagen (integer),
`scheduleStart/Finish`/`earlyStart/Finish` = ISO-**datums** zonder tijd, CPM rekent in hele dagen. Een
uur-tijdschaal (`pickTiers` heeft de `hour`/`quarterHour`-tiers al, `timelineTiers.ts:24-32`, achter
de `enableQuarterHourZoom`-power-user-vlag, `uiSlice.ts:29`) zou sub-dag-tick-labels tonen terwijl
**elke balk nog op daggrenzen snapt** — visueel misleidend en nutteloos zonder uren-scheduling.
Daarom: **uur-schaal wacht op §2.8 (uren-/minuten-based scheduling)**; deze subsectie legt dat vast en
komt ook als regel in TODO §2.8. De bestaande `enableQuarterHourZoom`-modus blijft bestaan als
power-user "sub-dag preview", maar is **geen** officiële timescale-keuze en verschijnt niet in de
dropdown. Jaar/kwartaal zijn puur rendering (tiers bestaan al) en kunnen meteen.

### 3.5 Raakpunten

- `viewSlice.ts:35-38` — `setTimeScale` herschreven (zie §3.3); `view.timeScale` blijft als optioneel
  veld bestaan voor payload-compat maar wordt genegeerd bij render en afgeleid getoond.
- `Ribbon.tsx:903-916` — dropdown: Jaar/Kwartaal/Maand/Week/Dag; `value` = `scaleFromZoom(view.zoom)`,
  `onChange` = `setTimeScale`. Kwartaal toegevoegd.
- `StatusBar.tsx:54` — toont `t(scaleFromZoom(view.zoom))` i.p.v. het rauwe veld.

---

## 4. Tabel-pijplijn — de gedeelde zichtbare-rijen-selector (KERN)

> **Kritiek aandachtspunt (geverifieerd).** Vandaag flatten **twee** plekken onafhankelijk hun rijen:
> de tabel via `TableEditor.flatTasks`/`groupTasksByCode` (`TableEditor.tsx:73-90` boom, `:94-108`
> groep) en de Gantt via `GanttRenderer.flattenTasks` (`GanttRenderer.ts:155-189`) /
> `flattenGrouped` (`:125-142`), gekozen in de renderer-constructor (`:113-115`). `GanttCanvas` geeft
> daarbij alleen `tasks` + een `grouping`-memo mee (`GanttCanvas.tsx:138-143`, dezelfde
> `groupTasksByCode`-util als de tabel) en laat de renderer zélf flattenen. De twee flatten-kopieën
> zijn vandaag byte-voor-byte gelijk en produceren dus dezelfde volgorde — maar filter/groep/sort
> erbij bouwen betekent dat die logica op **één** plek moet leven, anders divergeren tabel en Gantt
> onvermijdelijk. Dat is de kern van 2.7.

### 4.1 Eén functie: `computeViewRows`

Nieuw, headless, geen store-/React-afhankelijkheid: `src/engine/view/visibleRows.ts`.

```ts
export type ViewRow =
  | { kind: 'task';  task: Task; depth: number; dimmed: boolean }
  | { kind: 'group'; key: string; label: string; count: number;
      depth: number; levelIndex: number; collapsed: boolean };

export interface ViewContext {
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  noneLabel: string;   // = t('structure.none') — de bestaande i18n-key, nu al doorgegeven aan
                       //   groupTasksByCode (TableEditor.tsx:99). NIET een nieuwe "(geen)"-key.
}

export function computeViewRows(
  tasks: Task[],
  opts: {
    filter: FilterNode | null;
    group: GroupLevel[];
    sort: SortLevel[];
    collapsedTaskIds: Set<string>;
    collapsedGroupKeys: Set<string>;
  },
  ctx: ViewContext,
): ViewRow[]
```

`ViewRow[]` is **de** zichtbare-rijenlijst. `kind:'task'` levert de tabel zijn cellen en de Gantt zijn
balk; `kind:'group'` levert beide een bandkop (tabel: header-rij; Gantt: bandbalk zonder taakbalk).
Omdat beide consumenten exact dezelfde array in dezelfde volgorde krijgen, is divergentie
**onmogelijk** — rij *i* is in beide hetzelfde.

### 4.2 Pijplijn-volgorde: filter → groepeer → sorteer → flatten(collapse)

1. **Filter** (§6). Evalueer `filter` op **bladtaken** (`task.childIds.length === 0`). Bouw
   `matched: Set<taskId>`. Voeg voor elke match de **volledige ouder-keten** toe aan een
   `visibleSet` (P6 "show summaries"): ouders van een match worden altijd getoond, maar **gedimd**
   (`dimmed: true`) omdat ze zelf niet matchen. Een bladtaak die matcht is `dimmed: false`. Bij
   `filter === null` is `visibleSet` = alle taken, alles `dimmed: false` (short-circuit).
2. **Groepeer** (§7). Als `group.length > 0`: partitioneer de zichtbare **bladtaken** in geneste
   banden volgens `group[0..n]` (generalisatie van `groupTasksByCode`, `grouping.ts`). De
   WBS-ouderketen wordt in gegroepeerde modus **niet** als boom getoond (P6-gedrag: onder een band
   staan platte bladtaken) — behalve de gedimde ouders die door filter zijn binnengehaald verschijnen
   niet apart in bandmodus (ze horen bij geen enkele veldwaarde-band op een zinnige manier; alleen hun
   matchende bladeren tellen). Bij `group.length === 0`: behoud de **WBS-boom** (huidig gedrag,
   `flatTasks`).
3. **Sorteer** (§7). Stabiele multi-key sort (`sort[]`) toegepast op de bladtaken **binnen elke
   bladgroep** (bandmodus) of op **siblings binnen elke WBS-ouder** (boommodus). Stabiliteit borgt dat
   gelijke sleutels de oorspronkelijke (WBS-/invoer-)volgorde behouden.
4. **Flatten met collapse**. Wandel de boom/banden in volgorde en emit `ViewRow[]`, waarbij kinderen
   onder een ingeklapte taak (`collapsedTaskIds`, `ui.collapsedTaskIds`) of een ingeklapte band
   (`collapsedGroupKeys`, `view.collapsedGroupKeys`) worden **overgeslagen**. De ingeklapte node/band
   zelf verschijnt wél (als collapsed-gemarkeerde rij).

**`seen`-set tegen dubbele/wees-rijen.** Bij het flattenen wordt een `seen: Set<taskId>` bijgehouden
en wordt een taak die al geëmit is overgeslagen; aan het eind worden niet-geziene taken als wees
alsnog toegevoegd. **Herkomst (geverifieerd):** dit patroon zit vandaag in de **boom-flatten** —
`TableEditor.flatTasks` (`TableEditor.tsx:73-90`, `seenIds`-set + orphan-fallback `:86-90`) én, byte
voor byte parallel, `GanttRenderer.flattenTasks` (`GanttRenderer.ts:155-189`, orphan-net `:158-161`).
De groeperings-util `groupTasksByCode` (`grouping.ts:18-34`) heeft **géén** `seen`-set: die
partitioneert bladtaken op één code-value (elke blad in precies één band, geen dup-risico). De winst
van 2.7 is dat deze nu-nog-**gedupliceerde** flatten-logica (twee kopieën die toevallig gelijk zijn)
wordt vervangen door de ene `computeViewRows`, die de `seen`-set over álle vier de pijplijnstappen
toepast. Voor **resource-groepering** — waar een taak bewust in meerdere banden hoort (§7.1) — wordt de
`seen`-set per band-pad toegepast i.p.v. globaal, zodat multi-band niet per ongeluk wordt ontdubbeld.

### 4.3 Waar hij leeft, memoisatie, invalidatie

**Eén cache in de store, niet twee memo's in twee componenten.** Om te garanderen dat de lijst
*één keer* wordt berekend (niet apart in tabel en Gantt), spiegelt het ontwerp het
`resourceLoadResult`-patroon uit fase 2.5 (`scheduleSlice`, "manual, not reactive"):

- Nieuw top-level store-veld `viewRows: ViewRow[]` (default `[]`).
- Nieuwe actie `recomputeViewRows()` (in een nieuwe `viewSlice`-uitbreiding of aparte
  `viewRowsSlice`) die `computeViewRows(tasks, {filter,group,sort,collapsed*}, ctx)` draait en
  `viewRows` zet.
- **Beide** consumenten lezen `useAppStore(s => s.viewRows)`:
  - `TableEditor` mapt `viewRows` → tabelrijen (vervangt `flatTasks`/`groupTasksByCode`-tak,
    `TableEditor.tsx:73-108`).
  - `GanttCanvas` geeft `viewRows` door aan `GanttRenderer` als expliciete `rows`-prop; de
    renderer-constructor (`GanttRenderer.ts:113-115`) kiest dan niet meer zelf tussen `flattenTasks`
    (`:155-189`) en `flattenGrouped` (`:125-142`) — die worden vervangen door "gebruik de meegegeven
    `rows`". De `grouping`-memo in `GanttCanvas` (`:138-143`) vervalt.

`viewRows` is een **pure derivatie** en gaat daarom **niet** in `DocumentPayload`, **niet** in de
undo-`Snapshot` en **niet** naar IFC — bij `hydratePayload`/`switchDocument`/`undo`/`redo` wordt hij
opnieuw berekend (§4.4).

**Invalidatie — `recomputeViewRows()` wordt aangeroepen na:**

| Trigger | Reden |
|---|---|
| elke taakmutatie (`taskSlice` add/update/delete/move/indent) | rijenset/veldwaarden veranderen |
| `runCPM` (`scheduleSlice`), ná de bestaande passes | sort/filter kunnen op `totalFloat`/`isCritical`/`earlyStart`/`completion` keyen (§2.1) |
| `setFilter`/`setGroup`/`setSort`/`setColumns` | directe view-mutaties |
| collapse-toggle (taak of band) | zichtbaarheid van kinderen |
| `switchDocument`/`hydratePayload`/`openFile` | nieuwe `tasks`+`view` geladen |
| `undo`/`redo` | herstelde `tasks`/`view` |
| activity-code/custom-field/resource-mutaties | groep-/filter-/kolomwaarden kunnen wijzigen |

Kosten: `computeViewRows` is O(n log n) (sort domineert). Bij 1000 taken < ~1 ms — ruim binnen het
budget, en het draait alleen op deze discrete triggers, nooit per frame (§17).

### 4.4 Synchroniciteit met de bestaande hiërarchie/banden

- **Collapse blijft gedeeld.** `ui.collapsedTaskIds` (per-document geswapt,
  `documentSlice.ts:124,148`) blijft de bron voor taak-inklap; `view.collapsedGroupKeys` is nieuw voor
  band-inklap. Beide gaan als `Set` de opts in. Tabel en Gantt reageren identiek omdat ze `viewRows`
  delen (die de collapse al heeft toegepast).
- **Bandkoppen in de Gantt.** `GanttRenderer` tekent voor een `kind:'group'`-rij een volle-breedte
  bandbalk (hergebruik van de bestaande `flattenGrouped`-band-rendering, `GanttRenderer.ts:125-142`),
  op **exact dezelfde rij-index** als de tabel-bandkop → horizontale lijnen lopen door.
- **Rij-hoogte.** Beide gebruiken dezelfde vaste rijhoogte en dezelfde `viewRows.length`; scrollY en
  virtual-culling in de Gantt (`drawTaskBars`-cull `GanttRenderer.ts:391`) opereren op indices in
  `viewRows`, dus de tabel (die niet cullt) en de Gantt (die wel cullt) tonen op elke y hetzelfde.

### 4.5 Structuur-mutaties onder actieve filter/groep/sort (BESLIST)

Tabel en Gantt ondersteunen vandaag structuur-mutaties die een **boom-context aannemen**:
indent/outdent, taak-verslepen/herordenen (row-move), "taak toevoegen onder de selectie", en
muis-hittesting/keyboard-navigatie op rij-index. Onder een filter (gaten in de boom), groepering
(platte banden i.p.v. hiërarchie) of sort (getoonde volgorde ≠ WBS-volgorde) zijn die semantisch
onzinnig of corrumperend: een drag-herorden in een gesorteerde lijst zou een WBS-positie schrijven
die niets met de getoonde volgorde te maken heeft.

**Regel: structuur-mutaties zijn alleen actief in pure boommodus** —
`view.filter === null && view.group.length === 0 && view.sort.length === 0`. Eén gedeelde selector
`isTreeMode(view)` (in `visibleRows.ts` naast `computeViewRows`) zodat tabel, Gantt én ribbon
dezelfde regel afdwingen. Concreet:

- **Disabled buiten boommodus**: indent/outdent (ribbon-knoppen + Tab/Shift+Tab in de tabel),
  drag-herordenen/row-move van taken (tabel én Gantt), en elke andere actie die `parentId`/
  WBS-positie op basis van rij-index herschrijft. Knoppen/handles worden disabled gerenderd; een
  poging (bv. Tab in de tabel) toont een statusbar-/tooltip-hint — nieuwe i18n-key
  `view.structureLockedHint` (§15): *"Niet beschikbaar tijdens filteren/groeperen/sorteren"*.
- **Wél toegestaan**: **taak toevoegen** — append op rootniveau, of als kind onder de **ouder van de
  geselecteerde taak** (een positie die onafhankelijk van de getoonde volgorde welgedefinieerd is);
  **cel-edits** (naam/duur/start/finish/voltooiing/codes/custom fields) — waarde-mutaties, geen
  structuur; en **verwijderen** (id-gebaseerd, geen positie-semantiek).

**Alle rij-gebaseerde interactie in `GanttCanvas` opereert op `viewRows`**, nooit op een eigen
flatten. Betrokken handlers (elk vertaalt een muis-y naar een rij-index over de gerenderde lijst):
`handleClick` (`GanttCanvas.tsx:457`, selectie), `handleDoubleClick` (`:510`), `handleContextMenu`
(`:527`), `handleMouseDown` (`:548`, start bar-drag/dependency-drag), de
drag-`handleMouseMove`/`handleMouseUp`-effects (`:617-797`) en de hover-`handleMouseMove` (`:810`).
Elk moet `y → index in viewRows` mappen en bij `viewRows[i].kind === 'group'` de taak-interactie
overslaan (bandkop: alleen collapse-toggle). **Bar-drag (datums verschuiven) en dependency-drag
blijven in álle modi toegestaan** — dat zijn waarde-mutaties, geen structuur-mutaties — maar hun
hit-testing loopt via `viewRows`, zodat onder filter/groep/sort altijd de juiste taak wordt geraakt.

---

## 5. Kolom-configuratie + resource-kolom

### 5.1 Beslissing: alleen de HTML-`TableEditor` is configureerbaar

De taaktabel bestaat dubbel: de HTML-`TableEditor` (`TableEditor.tsx`, kolommen hardcoded op
`:237-251` header / `:296-379` cellen) en de canvas-tabel links in de Gantt
(`GanttRenderer.drawTaskTable`, `columnHeaders` = alleen wbs/taskName/duration). **De kolom-config
werkt uitsluitend op de HTML-`TableEditor`.** De canvas-tabel blijft bewust minimaal (§5.4). Zo is er
**één** configureerbaar kolomsysteem en geen sync-probleem tussen twee kolommenmodellen.

### 5.2 Kolommenset & default

`ColumnConfig[]` (§2.2). Beschikbare velden (via `FieldRef`):

- **Builtin**: WBS, Naam, Duur, Start, Finish, Type, Kritiek, Total Float, Voltooiing
  (exact de huidige vaste set, `TableEditor.tsx:237-251`).
- **Activity codes**: één kolom per `activityCodeType` (nu al zo, `:246-248`).
- **Custom fields**: één kolom per `customFieldDef` (nu al zo, `:249-251`).
- **Resource** *(nieuw)*: één kolom, join via assignments (§5.3).

```ts
export function defaultColumns(
  activityCodeTypes: ActivityCodeType[], customFieldDefs: CustomFieldDef[],
): ColumnConfig[] {
  return [
    { field: { src: 'builtin', key: 'wbsCode' },    visible: true, width: 60 },
    { field: { src: 'builtin', key: 'name' },       visible: true, width: 240 },
    { field: { src: 'builtin', key: 'duration' },   visible: true, width: 60 },
    { field: { src: 'builtin', key: 'start' },      visible: true, width: 100 },
    { field: { src: 'builtin', key: 'finish' },     visible: true, width: 100 },
    { field: { src: 'builtin', key: 'taskType' },   visible: true, width: 80 },
    { field: { src: 'builtin', key: 'isCritical' }, visible: true, width: 50 },
    { field: { src: 'builtin', key: 'totalFloat' }, visible: true, width: 50 },
    { field: { src: 'builtin', key: 'completion' }, visible: true, width: 60 },
    ...activityCodeTypes.map(t => ({ field: { src: 'activityCode' as const, typeId: t.id }, visible: true, width: 90 })),
    ...customFieldDefs.map(d => ({ field: { src: 'customField' as const, defId: d.id }, visible: true, width: 90 })),
    { field: { src: 'resource' }, visible: false, width: 140 },   // nieuw, default verborgen
  ];
}
```

De resource-kolom staat **default verborgen** (breekt geen bestaande layout-verwachting); de rest
reproduceert de huidige breedtes (Tailwind-literals → px-getallen). `view.columns === undefined`
betekent "gebruik `defaultColumns()`" — zo hoeft een bestaand document niets op te slaan.

### 5.3 Resource-kolom (join, read-only in 2.7)

Toewijzingen leven in de aparte `assignments`-array
(`ResourceAssignment { taskId, resourceId, unitsPerDay }`, `resource.ts:36-42`) — many-per-taak. De
kolomwaarde:

```ts
function resourceCellValue(task: Task, ctx: ViewContext): string {
  return ctx.assignments
    .filter(a => a.taskId === task.id)
    .map(a => ctx.resources.find(r => r.id === a.resourceId)?.name)
    .filter(Boolean)
    .join(', ');   // komma-gescheiden, meerdere resources per taak
}
```

**Read-only in 2.7** (geen inline edit; toewijzen blijft via de TaskPropertiesPanel-sectie uit 2.5).
Dezelfde `resourceCellValue` voedt de resource-kolom, het resource-groeperen en het resource-filter
(via `resolveField`, §6.2) — één join-implementatie.

### 5.4 Canvas-tabel blijft minimaal

`GanttRenderer.drawTaskTable` houdt zijn huidige `columnHeaders` (wbs/taskName/duration). Reden: de
canvas-tabel is een compacte begeleider van de balken, geen data-grid; hem meebewegen met N
configureerbare kolommen zou een tweede kolom-layout-engine op canvas vergen. Bewust buiten scope
(§16). De **rijen** blijven wél gedeeld (`viewRows`, §4), dus tabel en Gantt tonen dezelfde taken op
dezelfde hoogte — alleen de *kolommen* verschillen.

### 5.5 UI

Kolommen-dialoog vanuit de Beeld-tab (§13): een lijst van alle beschikbare velden met (a) checkbox
voor `visible`, (b) sleep-handle voor volgorde, (c) breedte-input. Live toegepast op `setColumns`.
Kolombreedte ook direct sleepbaar in de tabelheader (schrijft `width` terug, patroon zoals de
bestaande links-paneel-splitter). "Herstel standaard" → `setColumns(defaultColumns(...))`.

---

## 6. Filter-evaluator

### 6.1 Semantiek

- Evaluatie op **bladtaken**; matches trekken hun **ouderketen** mee (gedimd), P6 "show summaries"
  (§4.2 stap 1). Geen platte filtering (ouders verdwijnen dus nooit onder een zichtbare match).
- `filter: null` = geen filter (short-circuit, alles zichtbaar).

### 6.2 De evaluator

```ts
// src/engine/view/filterEval.ts  (headless, getest — §14)
export function evaluate(node: FilterNode, task: Task, ctx: ViewContext): boolean {
  if (node.kind === 'group') {
    if (node.children.length === 0) return true;               // lege groep = neutraal (matcht)
    return node.op === 'AND'
      ? node.children.every(c => evaluate(c, task, ctx))
      : node.children.some(c => evaluate(c, task, ctx));
  }
  const v = resolveField(node.field, task, ctx);               // string|number|boolean|string[]|undefined
  return applyOperator(node.operator, v, node.value, node.value2);
}
```

`resolveField(field, task, ctx)` is de **gedeelde** resolver (ook door groep/sort gebruikt):

| `field.src` | waarde | pad (geverifieerd) |
|---|---|---|
| `builtin` | naam, wbs, duur, start, finish, TF, kritiek, voltooiing, type, milestone | `task.name`, `task.wbsCode`, `task.time.scheduleDuration`, `task.time.earlyStart`, `task.time.earlyFinish`, **`task.time.totalFloat`**, **`task.time.isCritical`**, **`task.time.completion`** (0..1), `task.taskType`, `task.isMilestone` |
| `activityCode` | valueId (string \| undefined) | `task.activityCodes?.[typeId]` |
| `customField` | string \| number \| undefined | `task.customFields?.[defId]` |
| `resource` | string[] van namen (of kommalijst voor `contains`) | `resourceCellValue(task, ctx)` (§5.3) |

> **Belangrijk (geverifieerd tegen `src/types/task.ts:44-104`):** `totalFloat`, `isCritical` en
> `completion` staan **onder `task.time`** (`TaskTime`, `:56,57,64`), NIET direct op `Task`. `completion`
> is `0..1` (de tabel toont `×100`). `isMilestone`/`taskType`/`wbsCode`/`name`/`childIds`/`parentId`/
> `activityCodes`/`customFields` staan wél direct op `Task`. `resolveField` moet dus per builtin-key
> het juiste pad kiezen — dit is de meest gemaakte fout.

`applyOperator`:

| operator | betekenis | opmerking |
|---|---|---|
| `eq`/`neq` | gelijk/ongelijk | type-coerce: getal vs getal, anders string-compare |
| `lt`/`lte`/`gt`/`gte` | numeriek/datum-vergelijk | datums als ISO-string vergelijken werkt lexicografisch |
| `contains`/`startsWith` | substring (case-insensitive) | op de stringrepresentatie |
| `between` | `value ≤ v ≤ value2` | numeriek/datum |
| `isEmpty` | `v == null \|\| v === '' \|\| (array && length 0)` | codes/custom fields zonder waarde |
| `in` | `value: string[]` bevat `v` (of snijdt met `v` als `v` array is) | multiselect codes/resources |

### 6.3 Drie handmatig doorgerekende voorbeelden

**Mini-dataset** (6 taken; `C` = kritiek, `TF` = total float, `Fase` = activity code, `Res` =
resource-namen):

| id | naam | blad? | C | TF | duur | Fase | Res |
|---|---|---|---|---|---|---|---|
| T0 | "Project" | nee (ouder van T1,T4) | — | — | — | — | — |
| T1 | "Fundering" | nee (ouder van T2,T3) | — | — | — | Ruwbouw | — |
| T2 | "Heien" | **ja** | ja | 0 | 5 | Ruwbouw | Kraan, Ploeg A |
| T3 | "Wapening" | **ja** | nee | 3 | 4 | Ruwbouw | Ploeg A |
| T4 | "Afbouw" | nee (ouder van T5) | — | — | — | Afbouw | — |
| T5 | "Schilderwerk" | **ja** | nee | 8 | 6 | Afbouw | Ploeg B |

**Voorbeeld A — `isCritical eq true`.**
Filter = `{kind:'rule', field:{src:'builtin',key:'isCritical'}, operator:'eq', value:true}`.
Evalueer op bladeren T2,T3,T5: T2→true (match), T3→false, T5→false. `matched = {T2}`. Ouderketen van
T2 = T1,T0. `visibleSet = {T2 (dimmed:false), T1 (dimmed:true), T0 (dimmed:true)}`.
**Zichtbare rijen (boommodus): T0, T1, T2** — T3/T4/T5 verborgen. T2 helder, T0/T1 gedimd.

**Voorbeeld B — `Fase = Ruwbouw AND TF < 3`.**
Filter = `{kind:'group', op:'AND', children:[ {rule Fase eq 'Ruwbouw'}, {rule totalFloat lt 3} ]}`.
Bladeren: T2 → Fase=Ruwbouw (true) ∧ TF=0<3 (true) = **true**; T3 → Ruwbouw (true) ∧ TF=3<3 (false) =
false; T5 → Afbouw (false) ∧ … = false. `matched = {T2}` → zichtbaar **T0, T1, T2** (T0/T1 gedimd).

**Voorbeeld C — `Res in [Ploeg A] OR duur gt 5`.**
Filter = `{kind:'group', op:'OR', children:[ {rule resource in ['Ploeg A']}, {rule duration gt 5} ]}`.
Bladeren: T2 → Res⊇{Kraan,Ploeg A} ∩ {Ploeg A} ≠ ∅ (**true**); T3 → Res={Ploeg A} (**true**);
T5 → Res={Ploeg B} ∩ {Ploeg A}=∅ (false) ∨ duur=6>5 (**true**) = true. `matched = {T2,T3,T5}`.
Ouderketens: T2/T3→T1,T0; T5→T4,T0. `visibleSet = {T0,T1,T2,T3,T4,T5}` — hier valt **alles** binnen
(alle bladeren matchen), ouders T0/T1/T4 gedimd, bladeren helder. Dit toont het "show summaries"-
gedrag: de boomstructuur blijft intact, alleen niet-matchende bladeren zouden weggevallen zijn (hier
geen).

---

## 7. Groeperen & sorteren

### 7.1 Groeperen — generalisatie van `groupTasksByCode`

De bestaande `groupTasksByCode(tasks, typeId, noneLabel)` (`src/utils/grouping.ts`, gedeeld door
`TableEditor` én `GanttRenderer.flattenGrouped`) groepeert bladtaken op **één** activity-code-type,
met een "(geen)"-band voor taken zonder waarde. 2.7 generaliseert dit naar
`groupByLevels(leaves, group: GroupLevel[], ctx)`:

- Voor elk niveau `group[i]`: bepaal de bandsleutel via `resolveField(group[i].field, task, ctx)`
  (dus WBS-tak, activity-code-value, custom-field-waarde, `taskType`, of resource-naam).
- **Resource-groepering met meerdere resources per taak (BESLIST)**: een taak met N resources
  verschijnt in N banden (of in "(geen)" bij 0). De `seen`-set (§4.2) wordt daarom **per band-pad**
  toegepast, niet globaal, zodat deze bewuste multi-band-plaatsing niet wordt ontdubbeld. **Beslist:
  multi-band is default AAN en er komt GEEN optie-toggle in 2.7** (simpel houden; dit is de nuttige
  "toon deze taak bij elke resource"-lezing).
- **Relatiepijlen bij multi-band-duplicaten (BESLIST)**: één taak in N banden = N rij-indices.
  `drawDependencyArrows` verbindt de **eerste occurrence** (laagste rij-index in `viewRows`) van
  predecessor en successor; latere occurrences krijgen **geen** pijlen — anders ontstaat
  pijl-spaghetti (N×M pijlen per relatie). Renderer-consequentie: de taskId→rij-index-map die de
  pijl-renderer gebruikt wordt gebouwd met "eerste index wint" (bij het vullen: `if (!map.has(id))
  map.set(id, i)`), zodat dit gedrag structureel is en niet per-pijl beslist hoeft te worden.
- Ontbrekende waarde → `noneLabel`-band ("(geen)"), exact zoals nu.
- **Bandsleutel encodeert het volledige band-pad** zodat `collapsedGroupKeys` er stabiel én uniek
  naar kan verwijzen. `level{i}:{value}` alléén is NIET uniek: dezelfde level-1-waarde onder twee
  verschillende level-0-banden (bv. "Ploeg A" onder "Ruwbouw" én onder "Afbouw") zou dezelfde sleutel
  krijgen, waardoor inklappen van de één de ander meeklapt. Daarom: sleutel =
  `JSON.stringify(padArray)` van de waardes tot en met dit niveau (bv.
  `["Ruwbouw","Ploeg A"]` vs `["Afbouw","Ploeg A"]`) — JSON-encoding regelt het escaping-probleem
  (waardes die zelf een scheidingsteken bevatten) gratis mee. **Bandlabel** = de leesbare waarde van
  het eigen niveau (code-value-naam, resource-naam, custom-field-waarde).
- Banden zelf gesorteerd op `group[i].dir`.
- **UI: max 2 groepniveaus**; datastructuur `GroupLevel[]` staat N toe.

### 7.2 Sorteren — multi-key, stabiel

`sortLeaves(leaves, sort: SortLevel[], ctx)`:

```ts
function compare(a: Task, b: Task, sort: SortLevel[], ctx): number {
  for (const lvl of sort) {
    const va = resolveField(lvl.field, a, ctx), vb = resolveField(lvl.field, b, ctx);
    const c = cmpValues(va, vb);                 // getallen numeriek, datums/strings lexicografisch, undefined laatst
    if (c !== 0) return lvl.dir === 'asc' ? c : -c;
  }
  return 0;                                       // gelijk → stabiele sort behoudt invoervolgorde
}
```

Toegepast **binnen elke bladgroep** (bandmodus) of **binnen elke set siblings** (boommodus, zodat de
WBS-hiërarchie intact blijft — je sorteert kinderen onder hun ouder, niet globaal). `sort: []` =
huidige volgorde. `Array.prototype.sort` is in moderne engines stabiel; we vertrouwen daarop (en
testen het, §14).

### 7.3 Bandkop + count, geen rollup

Elke `kind:'group'`-`ViewRow` draagt `count` = aantal bladtaken in die (deel)band. **Rollup-totalen**
(som duur/units/kosten) zijn expliciet buiten scope (§16) — bandkop toont label + count, consistent
met de huidige banden.

### 7.4 UI

- **Groeperen**-popover (Beeld-tab): tot 2 rijen, elk `{veld-dropdown, richting}`. Veld-dropdown =
  alle groeperbare `FieldRef`s (WBS, taskType, elke activity-code-type, elk custom field, resource).
- **Sorteren**-popover: herhaalbare rijen `{veld, richting}`, "+ niveau toevoegen" onbeperkt.

### 7.5 Migratie van `view.groupBy`

Het huidige `view.groupBy?: string` (`types.ts:72-74`, `viewSlice.ts:51-54`) vervalt als store-veld.
`hydratePayload`/`payloadFromInput` (`documentSlice.ts`) migreren:
`group = groupBy ? [{field:{src:'activityCode',typeId:groupBy}, dir:'asc'}] : []`. De oude
`setGroupBy`-actie wordt `setGroup(levels: GroupLevel[])`. `groupTasksByCode` blijft als interne
helper bestaan maar wordt door `groupByLevels` aangeroepen voor het activity-code-geval (of eronder
weggerefactored).

---

## 8. Layouts

### 8.1 Wat een layout is

Een `Layout` (§2.5) = `{ id, name, columns, group, sort, filter, timeScale }`. App-globaal, één set
(geen P6 Global/Project/User-onderscheid — overkill voor OPS). "Toepassen" schrijft de vijf velden
naar de **huidige** `view` (+ `setZoom(TIMESCALE_ZOOM[timeScale])`), dus een layout beïnvloedt alleen
het actieve document; hij verplaatst niet mee tussen documenten tenzij opnieuw toegepast.

### 8.2 Opslag — app-globaal in `settingsStore.ts`

`src/utils/settingsStore.ts` (localStorage, `ops-`-prefix — géén Tauri-store) krijgt twee sleutels:

| Sleutel | Waarde | Validatie |
|---|---|---|
| `ops-layouts` | `Layout[]` (JSON) | parse-guard: bij corrupte JSON → `[]`; elk item door een shape-check (`id`/`name` string, arrays aanwezig) |
| `ops-lastLayoutId` | `string \| null` | moet naar een bestaande layout wijzen, anders `null` |

Patroon exact zoals de bestaande settings (thema, `leftPanelWidth`, `showHistogram`, …,
`settingsStore.ts:11-19` get/set + per-key validatie).

### 8.3 CRUD

- **Opslaan als layout…** — dialoog met naamveld; snapshot van de huidige `view`
  (columns/group/sort/filter + `timeScale = scaleFromZoom(view.zoom)`) → nieuw `Layout`, `push` naar
  `ops-layouts`, `ops-lastLayoutId = id`.
- **Bijwerken** — overschrijf de actieve layout met de huidige view.
- **Hernoemen / Verwijderen** — standaard lijstbeheer.
- **Toepassen** — laad de vijf velden in `view` + zoom, zet `ops-lastLayoutId`, roep
  `recomputeViewRows()` (§4.3).
- **Bij opstart / documentwissel**: pas `ops-lastLayoutId` NIET automatisch toe (per-document view
  wint; layouts zijn opt-in). Alleen de dropdown toont hem als "laatst gebruikt".

### 8.4 Ontbrekende-referenties-gedrag (kritisch)

Een layout kan verwijzen naar een `activityCode.typeId` / `customField.defId` / resource die in het
**huidige** document niet bestaat (layouts zijn app-globaal, documenten verschillen). **Regel: stille
tolerantie, nooit crashen.**

- **Kolom** met onbekend veld → kolom wordt **overgeslagen** bij render (niet getoond), maar **blijft
  in de `ColumnConfig[]`** bewaard (zodat hij weer verschijnt in een document dat het veld wél heeft).
- **Filterregel** met onbekend veld → `resolveField` geeft `undefined` → de regel evalueert als
  **geen match** voor elke taak (bij `AND` maakt dat de groep leeg; bij `OR` draagt hij niets bij).
  Nooit een throw. **(BESLIST: false-evaluatie, niet "regel overslaan" — voorspelbaarder en
  JSON-stabiel.)**
- **Groep-/sort-niveau** met onbekend veld → `resolveField` = `undefined` → alle taken vallen in de
  "(geen)"-band / worden als gelijk beschouwd (sort). Effectief een no-op-niveau, geen crash.
- **Validatie bij laden** (§8.2) verwijdert geen onbekende refs — ze kunnen in een ander document weer
  geldig zijn. De tolerantie zit in de evaluatie, niet in de opslag.

### 8.5 Per-bestand-layouts — bewust later

ViewState round-trippt niet naar IFC (`ifcWriter.ts` schrijft geen view/zoom/groupBy; geen
view-pset). Layouts-in-het-`.ifc` (bv. `Pset_OPS_Layout` op `IfcWorkPlan`) zou nuttig zijn als
layouts met een gedeeld bestand mee moeten reizen, maar is een aparte, grotere klus. **Buiten scope
2.7** (§16).

---

## 9. Presentation mode

### 9.1 Flag + Fullscreen-API

Nieuwe `ui.presentationMode: boolean` (sessie-flag, niet gepersisteerd — resets bij herladen).
Patroon exact zoals `ribbonCompact` (`Ribbon.tsx:990-998` → `setUI({...})`): een `ui`-flag +
conditionele render. Gekoppeld aan de **echte Fullscreen-API**:

```ts
setPresentationMode(on: boolean) {
  setUI({ presentationMode: on });
  if (on) document.documentElement.requestFullscreen?.().catch(() => {});
  else    document.exitFullscreen?.().catch(() => {});
}
```

`requestFullscreen` komt nergens anders in de repo voor; werkt in de Tauri-webview.

### 9.2 Chrome verbergen (uitbreiding van `isFullPanel`)

App-layout: `TitleBar` → `Ribbon` → (`DocumentTabBar`) → brand-accent-strip → werkruimte (Gantt-kaart
+ rechter properties-paneel) → `StatusBar` (`App.tsx:367-488`). Er is al een `isFullPanel`-schakelaar
(`App.tsx:365`) die het rechterpaneel verbergt voor table/relations/ifc/report. Presentation mode is
een bredere variant: bij `presentationMode` **niet renderen**: `TitleBar`, `Ribbon`, `DocumentTabBar`,
brand-strip, rechterpaneel **en `StatusBar`** — alleen de **Gantt-kaart full-bleed** + de tijd-as
(en, indien aan, de mini-map §11) blijven. Concreet: elke chrome-render in `App.tsx` krijgt een
`&& !presentationMode`-guard (of één wrapper-conditie rond de chrome-secties).

### 9.3 Sneltoetsen

`useKeyboardShortcuts.ts` (één `keydown`-handler, `:54-138`; guard negeert INPUT/TEXTAREA/SELECT
`:68`). **F11 is vrij** (productie blokkeert wel F12, `:7-31`, maar niet F11):

- **F11** → `setPresentationMode(!ui.presentationMode)` (nieuwe `else if`-tak + action in de
  dependency-array `:151`).
- **Escape** → als `presentationMode`: uit (`setPresentationMode(false)`). De bestaande Escape-tak
  (`:117-119`, sluit dialogen) krijgt deze case er vooraan bij.

De `fullscreenchange`-event-listener zet `ui.presentationMode` terug op `false` als de gebruiker via
de browser/OS fullscreen verlaat, zodat flag en werkelijkheid niet desyncen.

---

## 10. Split view (binnen één document)

### 10.1 Beslissing: naast elkaar (verticale scheiding), twee tijdvensters

**Split view = twee onafhankelijke tijdvensters op hetzelfde takenraster / dezelfde verticale
scroll.** Gekozen variant: **naast elkaar** (verticale scheidingsbalk, linker + rechter pane), NIET
boven elkaar.

**Onderbouwing voor lange bouwplanningen.** Een bouwplanning is *breed in de tijd* (vele maanden tot
jaren) en de gebruiker wil vaak twee tijdvensters van **dezelfde taken** tegelijk zien — bv. de
detail-week-view links en een ver weg liggende oplevermijlpaal rechts, of ruwbouw naast afbouw. Bij
**naast elkaar** tonen beide panes **exact dezelfde rijen op dezelfde y** (gedeelde `viewRows` +
gedeelde `scrollY`), elk met een **eigen horizontaal tijdvenster** (eigen `zoom`/`scrollX`). Dat is
precies "twee tijdvensters op hetzelfde takenraster". **Boven elkaar** zou de taakrijen verticaal
opsplitsen (elk pane andere taken) — dat botst met de eis "dezelfde verticale scroll / hetzelfde
raster" en is voor tijd-brede planningen minder nuttig. Vandaar naast elkaar.

### 10.2 State & rendering

`view.splitView?: SplitViewState { ratio, secondaryZoom, secondaryScrollX }` (§2.6). Bij actief:

- `GanttCanvas` rendert **twee** Gantt-viewports naast elkaar, gescheiden door een sleepbare verticale
  balk (`ratio`). **Links**: primair, gebruikt `view.zoom`/`view.scrollX`. **Rechts**: secundair,
  gebruikt `splitView.secondaryZoom`/`secondaryScrollX`.
- **Gedeeld**: `viewRows` (§4), `scrollY`, de canvas-tabel links (één keer, aan de uiterste
  linkerkant), rijhoogtes. Alleen de **tijd-as en balk-x-mapping** verschillen per pane
  (`dateToX` met de eigen zoom/scrollX, `GanttRenderer.ts:187-191`).
- **Canvas-taaktabel maar één keer.** `GanttRenderer` tekent zelf de linkertabel (`drawTaskTable`).
  Alleen het **primaire (linker) pane** tekent die; het **secundaire pane** wordt geïnstantieerd met
  `taskTableWidth: 0`, zodat het pure tijdvenster is (geen tweede tabel, geen dubbele kolomkoppen).
- Implementatie: de bestaande `GanttRenderer` wordt per pane geïnstantieerd met een eigen
  `effectiveView` (eigen zoom/scrollX; secundair pane met tabel-breedte 0, zie hierboven), tekenend
  in een eigen horizontaal cliprechthoek van dezelfde canvas (of twee canvassen). De verticale
  scroll-event stuurt **beide** panes (gedeelde `scrollY`).

### 10.3 UI

Toggle "Split view" in de Beeld-tab. Sleepbare middenbalk verstelt `ratio`. Elk pane heeft zijn eigen
zoom (Ctrl+scroll boven het pane past de juiste `zoom`/`secondaryZoom` aan). Mini-map (§11), indien
aan, toont het **primaire pane-venster** (BESLIST).

### 10.4 Twee-documenten-split — bewust later

Twee **verschillende** documenten naast elkaar vergt een store-refactor: de hele codebase leest van
één gehydrateerd top-level document (`documentSlice.ts:18-31,233-253`; andere docs zijn geserialiseerde
`DocumentPayload`s). Twee onafhankelijke store-scopes of een geparametriseerde renderer zijn nodig —
grote klus, weinig extra waarde t.o.v. één-document-split. **Buiten scope** (§16).

---

## 11. Mini-map

### 11.1 Aparte, lichte thumbnail-renderer

**Niet** de volle `GanttRenderer` hergebruiken: die cullt off-screen rijen (`drawTaskBars`-cull
`GanttRenderer.ts:391`), tekent tekst/pijlen/constraint-markers en is te zwaar/te gedetailleerd voor
een thumbnail. Nieuw: `src/engine/renderer/MiniMapRenderer.ts` — één `fillRect` per taak, geen labels,
geen culling.

```ts
// pseudo
for (let i = 0; i < viewRows.length; i++) {
  const row = viewRows[i];
  if (row.kind !== 'task') continue;
  const x0 = dateToMiniX(row.task.time.earlyStart);   // hele projectduur → mini-breedte
  const x1 = dateToMiniX(row.task.time.earlyFinish);
  const y  = i * miniRowH;                              // alle rijen, gecomprimeerd
  ctx.fillStyle = row.task.time.isCritical ? critColor : barColor;   // let op: onder task.time (§6.2)
  ctx.fillRect(x0, y, Math.max(1, x1 - x0), Math.max(1, miniRowH - 1));
}
```

`dateToMiniX` mapt de **volledige** projectperiode (min earlyStart .. max earlyFinish over alle taken)
op de mini-map-breedte — dus de hele planning is altijd zichtbaar, ongeacht de hoofd-zoom. Kosten:
O(taken) triviale `fillRect`s (< 1 ms voor 1000 taken, §17). Herbruikt `viewRows` (§4), dus de mini-map
respecteert filter/groep automatisch.

### 11.2 Interactie: sleepbaar viewport-kader

Een horizontale strip (onder de Gantt, of als smalle band; toggle in Beeld-tab). Een
**viewport-rechthoek** toont het huidige hoofdvenster: breedte = `(zichtbare dagen / totale dagen) ×
miniBreedte`, x = `(scrollX-dagen-offset / totale dagen) × miniBreedte`. Interacties:

- **Klik** op een positie → centreer het hoofdvenster daar: bereken de nieuwe `view.scrollX` zodat het
  aangeklikte punt in het midden komt.
- **Sleep** het kader → continu `view.scrollX` bijwerken (en, symmetrisch, `scrollY` als we het kader
  ook verticaal maken — invulling: 2.7 doet **horizontaal** (tijd) primair, want dat is het nuttigst
  voor lange planningen; verticaal kader optioneel).
- Bij split view (§10) toont het kader het primaire pane-venster.

### 11.3 State

`ui.showMiniMap: boolean` (app-globaal, gepersisteerd via `settingsStore`, `ops-showMiniMap`, zoals
`showHistogram`). De mini-map leest `view.scrollX`/`zoom` en schrijft `view.scrollX` terug — geen
eigen persistente state nodig.

---

## 12. Store & persistentie — expliciete tabel

| State | Waar | Scope | Gepersisteerd | In undo-`Snapshot`? |
|---|---|---|---|---|
| `columns` | `ViewState` → `DocumentPayload.view` | per-document | sessie + crash-recovery-payload | **nee** (view-state) |
| `filter` | `ViewState` → payload | per-document | sessie + recovery | **nee** |
| `group` | `ViewState` → payload | per-document | sessie + recovery | **nee** |
| `sort` | `ViewState` → payload | per-document | sessie + recovery | **nee** |
| `collapsedGroupKeys` | `ViewState` → payload | per-document | sessie + recovery | **nee** |
| `splitView` | `ViewState` → payload | per-document | sessie + recovery | **nee** |
| `zoom`/`scrollX` (timescale) | `ViewState` → payload | per-document | sessie | **nee** (al zo vandaag) |
| `viewRows` (derivatie) | top-level store | afgeleid | **nee** (herberekend) | **nee** |
| `presentationMode` | `UIState` | sessie/app | **nee** (ephemeer) | n.v.t. |
| `showMiniMap` | `UIState` | app-globaal | localStorage `ops-showMiniMap` | n.v.t. |
| `layouts[]` | localStorage | app-globaal | `ops-layouts` | n.v.t. |
| `lastLayoutId` | localStorage | app-globaal | `ops-lastLayoutId` | n.v.t. |

### 12.1 Waarom view-state NIET in undo (beargumenteerd)

**Weergave hoort niet in Ctrl+Z.** Een gebruiker die een kolom verbergt, filtert of sorteert verwacht
niet dat Ctrl+Z eerst zijn *view* terugdraait voordat het zijn *data* terugdraait — dat maakt undo
onvoorspelbaar. Dit volgt het bestaande patroon: **`view` (ViewState) zit al buiten de
undo-`Snapshot`**. De snapshot (`src/state/snapshot.ts`) captured `tasks`/`sequences`/`resources`/
`assignments`/`cpmResult`/`resourceLoadResult` (de laatste twee sinds fase 2.5, §5.9 resources-doc) —
**geen `view`**. Scroll/zoom/`groupBy` overleven een undo dus vandaag al ongewijzigd; 2.7 voegt
`columns`/`filter`/`group`/`sort`/`collapsedGroupKeys`/`splitView` toe aan diezelfde
buiten-history-`ViewState` en volgt dat patroon exact. Concreet: `snapshot.ts` wordt **niet**
uitgebreid met view-velden.

### 12.2 Per-document meenemen

Elke nieuwe `ViewState`-veld moet mee in `documentSlice.ts` overal waar `view` nu al wordt geswapt:
`DocumentPayload.view` (`:49`), `capturePayload`/`hydratePayload` (`:123,147`), `freshPayload`
(defaults), `payloadFromInput` (`:196`, bouwt view vers op → nieuwe defaults + `groupBy`-migratie
§7.5). `viewRows` wordt bij hydrate/switch opnieuw berekend via `recomputeViewRows()` (§4.3), niet
meegeswapt.

---

## 13. UI — Beeld-ribbontab-indeling

Alle 2.7-controls in de **Beeld-tab** (`activeTab === 'beeld'`, `Ribbon.tsx:891-951`) — **geen**
`SettingsPanelContent`. De 3-surfaces-regel (gear ⚙ / Settings-tab / Backstage) geldt hier **niet**:
dit is **view-state**, geen voorkeur. (Zou er ooit een echte voorkeur komen — bv. "standaard-timescale
voor nieuwe documenten" — dan wél via `SettingsPanelContent`; niet in 2.7.)

Groepen-indeling (patroon `<RibbonGroup label={tMenu('ribbon.x')}>` + `ribbon-separator`, zoals de
bestaande tabs):

```
[Tijdschaal]    [Weergave]       [Layout]          [Presentatie]      [Overlays — leeg, res. 2.6]
 Schaal ▾        Kolommen…         Layout ▾           Presentation        (baseline-overlay,
 (Jaar…Dag)      Filteren…         Opslaan als…        (F11)               voortgangslijn,
 Zoom + / −      Groeperen…        Bijwerken          Split view           statusdatum — B14)
                 Sorteren…         Beheren…           Mini-map
```

- **Tijdschaal**: `Schaal`-dropdown (§3, Jaar/Kwartaal/Maand/Week/Dag, huidige = `scaleFromZoom`) +
  bestaande zoom +/−.
- **Weergave**: `Kolommen…` (dialoog §5.5), `Filteren…` (§6 editor), `Groeperen…` (§7.4 popover, max 2),
  `Sorteren…` (§7.4 popover, herhaalbaar) — als dialogen/popovers vanuit knoppen.
- **Layout**: actieve-layout-`dropdown` (kies + toepassen), `Opslaan als…`, `Bijwerken`, `Beheren…`
  (hernoemen/verwijderen). §8.
- **Presentatie**: `Presentation`-toggle (F11), `Split view`-toggle (§10), `Mini-map`-toggle (§11).
- **[Overlays]**: **gereserveerd voor 2.6** (B14) — nu leeg/afwezig; documenteert waar 2.6 zijn
  document-toggles inplugt zonder herindeling.

De bestaande Beeld-tab-inhoud (zoom, oude timeScale-dropdown, `groupBy`, paneel-toggle, print) wordt
in deze indeling opgenomen: de oude timeScale-dropdown → nieuwe Schaal-dropdown; `groupBy` → nieuwe
Groeperen-popover.

### 13.1 Filter-editor UI (P6-achtig)

Rij-editor binnen All/Any-groepen: elke regel = `{veld ▾ | operator ▾ | waarde}`; groepen met een
`All of the following (AND)` / `Any of the following (OR)`-kop; "+ regel" / "+ groep"-knoppen.
**Genest max 2 diep in de UI** (datastructuur onbeperkt, §2.3). Waarde-invoer past zich aan het veld
aan (tekst/getal/datum/dropdown voor codes/resources/multiselect bij `in`). "Wissen" → `filter: null`.

---

## 14. Testplan

### 14.1 Headless (de kern-logica)

De filter/groep/sort/flatten-logica is **puur en headless** en woont daarom in
`src/engine/view/` (`visibleRows.ts`, `filterEval.ts`) — **geen** React/store-afhankelijkheid, zodat
tests ze rechtstreeks kunnen aanroepen.

**BESLIST: uitbreiding van `tests/planning/harness.ts`** (bestaand, `Case`-spec `:36-42`), géén
aparte suite: een nieuwe `view?`-sleutel per case (`{ filter?, group?, sort?, columns? }`) + een
`expectRows?`-assertie (verwachte volgorde van taak-ids + gedimd-vlag + bandkoppen). `buildAndSolve`
roept na `runCPM` `computeViewRows` aan en vergelijkt met `expectRows`. Zo lopen view-tests door
dezelfde hand-berekende-mini-projecten als de CPM-suite en hergebruiken ze de bestaande
case-infrastructuur.

**Verplichte headless cases:**

- **Filter** — de drie §6.3-voorbeelden (A/B/C) als exacte `expectRows`-cases (bewijst
  ouderketen-dimming + AND/OR + `in`/resource).
- **Filter-randen** — `isEmpty` op een leeg custom field; `between` op datums; lege groep = matcht
  alles; `filter: null` = alle taken.
- **Groeperen** — 1 niveau (reproduceert `groupTasksByCode`-gedrag: zelfde banden + "(geen)"),
  2 niveaus (geneste banden), resource-multi-band (taak met 2 resources in 2 banden), band-count
  correct.
- **Sorteren** — enkel veld asc/desc; multi-key (bv. Fase asc, dan duur desc); stabiliteit (gelijke
  sleutels behouden WBS-volgorde); sort binnen boom respecteert hiërarchie (kinderen onder ouder).
- **Collapse** — ingeklapte taak verbergt kinderen; ingeklapte band verbergt bladeren; `seen`-set
  voorkomt dubbele rij.
- **Band-sleutel-uniciteit** (§7.1/punt 3) — twee gelijknamige subbanden onder verschillende
  bovenbanden (bv. "Ploeg A" onder "Ruwbouw" én onder "Afbouw"): klap er één in, de ander blijft
  open (bewijst dat de pad-encoderende `JSON.stringify`-sleutel geen botsing heeft).
- **Structuur-lock** (§4.5) — `isTreeMode(view)` is `false` zodra filter/groep/sort actief is,
  `true` bij alle drie leeg (unit-test van de selector; de disabled-UI zelf is een §14.2-check).
- **Pijlen bij multi-band** (§7.1) — taak in 2 resource-banden: de taskId→rij-index-map wijst naar de
  eerste occurrence (laagste index).
- **Pijplijn-interactie** — filter+groep+sort samen op één mini-project; verifieer exacte `viewRows`.
- **Ontbrekende referenties** (§8.4) — layout met onbekend `typeId`/`defId`: geen crash, kolom
  overgeslagen, filterregel → geen match, groep-niveau → "(geen)". Regressietest tegen §8.4.
- **Tabel↔Gantt-pariteit** — assert dat de tabel-rijenbron en de Gantt-rijenbron **dezelfde
  `viewRows`-referentie** zijn (één store-veld) — de structurele garantie tegen divergentie.
- **Timescale** — `scaleFromZoom(TIMESCALE_ZOOM[s]) === s` voor s ∈ {year,quarter,month,week,day}
  (round-trip-stabiliteit van de presets-tabel §3.3).

### 14.2 Visuele/UI-checks (Playwright + `window.__OPS__`, browser-build)

Per `docs/self-test-harness.md`:

- **Kolommen**: verberg/herorden/verbreed een kolom → screenshot toont de aangepaste tabel; Gantt-rijen
  blijven uitgelijnd.
- **Filter**: pas voorbeeld B toe → alleen T0/T1/T2 zichtbaar, T0/T1 gedimd, in **zowel** tabel als
  Gantt (screenshot van beide, uitgelijnd).
- **Groeperen 2 niveaus**: banden + counts kloppen, bandkoppen lopen door in de Gantt.
- **Presentation mode**: F11 → alle chrome weg, alleen Gantt full-bleed; Escape → terug (screenshot
  voor/na).
- **Split view**: twee tijdvensters, onafhankelijk scrollen/zoomen, gedeelde verticale scroll
  (screenshot; scroll rechts, links blijft; scroll verticaal, beide bewegen).
- **Mini-map**: kader toont venster; klik verplaatst `scrollX`; sleep werkt (screenshot voor/na).
- **Timescale**: Jaar/Kwartaal/Maand/Week/Dag → de as toont de juiste tiers (screenshot per keuze);
  StatusBar-label komt overeen.
- **Layout round-trip**: opslaan → wijzig view → toepassen herstelt kolommen/groep/sort/filter/schaal.

---

## 15. i18n-sleutels (EN + NL)

Geen nieuwe namespace (conventie fase 2.5, B11): ribbon/dialoog-labels in `menu`, veld-/celtermen in
`task`/`common`. NL is brontaal; EN hieronder als tweede referentie, overige 12 talen in een latere
stap.

**`menu`-namespace** (Beeld-tab, patroon `ribbon.xxx`):

```
ribbon.timeScale                 NL "Tijdschaal"          EN "Time scale"
ribbon.scale.year/.quarter/.month/.week/.day   NL "Jaar/Kwartaal/Maand/Week/Dag"  EN "Year/Quarter/Month/Week/Day"
ribbon.columns                   NL "Kolommen…"           EN "Columns…"
ribbon.filter                    NL "Filteren…"           EN "Filter…"
ribbon.group                     NL "Groeperen…"          EN "Group…"
ribbon.sort                      NL "Sorteren…"           EN "Sort…"
ribbon.layout                    NL "Layout"              EN "Layout"
ribbon.saveLayoutAs              NL "Opslaan als…"        EN "Save as…"
ribbon.updateLayout              NL "Bijwerken"           EN "Update"
ribbon.manageLayouts             NL "Beheren…"            EN "Manage…"
ribbon.presentationMode          NL "Presentatie"         EN "Presentation"
ribbon.splitView                 NL "Split view"          EN "Split view"
ribbon.miniMap                   NL "Mini-map"            EN "Mini-map"
```

**`common`-namespace** onder `view.*` (dialogen/popovers):

```
view.columns.title/.visible/.width/.resetDefault
view.filter.title/.addRule/.addGroup/.all/.any/.clear
view.filter.op.eq/.neq/.lt/.lte/.gt/.gte/.contains/.startsWith/.between/.isEmpty/.in
view.group.title/.addLevel/.level/.direction            // "(geen)"-band hergebruikt bestaande common:structure.none
view.sort.title/.addLevel/.ascending/.descending
view.layout.saveTitle/.name/.rename/.delete/.applyConfirm/.missingRefs   // missingRefs = "Sommige velden bestaan niet in dit document en worden overgeslagen."
view.presentation.hint                                    // "F11 om te sluiten"
view.splitView.primary/.secondary
view.structureLockedHint                                  // §4.5: NL "Niet beschikbaar tijdens filteren/groeperen/sorteren"
                                                          //       EN "Not available while filtering/grouping/sorting"
```

**`task`-namespace** (kolomkoppen — hergebruik bestaande waar mogelijk):

```
column.wbs/.name/.duration/.start/.finish/.type/.critical/.totalFloat/.completion
column.resource                  NL "Resources"           EN "Resources"
```

---

## 16. Out-of-scope

1. **Uur-tijdschaal** → §2.8 (uren-/minuten-scheduling). Datamodel dag-granulair; uur-as zou misleiden
   (§3.4). Deze regel komt ook in TODO §2.8.
2. **Rollup-totalen per band** (som duur/units/kosten) → fase 3.5/3.9. Bandkop = label + count (§7.3).
3. **Twee-documenten-split view** → vergt store-singleton-refactor (§10.4).
4. **Per-bestand-layouts (IFC-pset `Pset_OPS_Layout`)** → ViewState round-trippt niet naar IFC (§8.5).
5. **Kolom-config op de canvas-tabel** in de Gantt → blijft minimaal wbs/naam/duur (§5.4).
6. **Inline bewerken van de resource-kolom** → read-only in 2.7; toewijzen via TaskPropertiesPanel
   (2.5). (§5.3)
7. **P6 Global/Project/User-layout-scopes** → één app-globale set (§8.1).

---

## 17. Risico's & mitigatie

| # | Risico | Mitigatie |
|---|---|---|
| 1 | **Divergentie tabel↔Gantt** — twee flatten-implementaties raken uit sync bij filter/groep/sort. | **Structureel onmogelijk gemaakt**: één `computeViewRows` + één store-`viewRows`, beide consumenten lezen dezelfde array (§4). Pariteitstest (§14.1). Dit is de kern van het ontwerp. |
| 2 | **Perf bij 1000+ taken — filter/sort re-runs.** | `recomputeViewRows` draait **alleen op discrete triggers** (§4.3-invalidatietabel), nooit per frame; O(n log n) ≈ <1 ms bij 1000 taken. Store-cache voorkomt dubbele compute in tabel + Gantt. |
| 3 | **Perf — mini-map redraws.** | Aparte lichte renderer (1 `fillRect`/taak, geen tekst/pijlen/culling, §11.1) — triviaal (<1 ms/1000). Herteken alleen bij `viewRows`-, `scrollX`- of resize-wijziging, niet elke frame; debounce tijdens sleep. |
| 4 | **Perf — split view = 2× Gantt-render.** | Beide panes delen `viewRows` + `scrollY` + de (gecullde) rij-render; alleen de x-mapping verschilt. Culling per pane houdt getekende balken ~O(zichtbaar), niet O(taken). |
| 5 | **View-state pollueert undo.** | View-state blijft buiten `Snapshot` (§12.1) — volgt het bestaande patroon; `snapshot.ts` wordt niet uitgebreid. |
| 6 | **Layout verwijst naar onbestaande velden → crash.** | Stille tolerantie in de evaluatie (§8.4): kolom overgeslagen, filterregel = geen match, groep-niveau = "(geen)". Nooit een throw. Regressietest (§14.1). |
| 7 | **Timescale-label desynct van de getekende as** (het oude bug-patroon). | Label wordt **afgeleid** uit `zoom` via `scaleFromZoom`; `pickTiers` blijft enige bron van waarheid; geen los `timeScale`-veld meer als bron (§3.2). Round-trip-test (§14.1). |
| 8 | **`groupBy`-migratie breekt bestaande documenten.** | `hydratePayload`/`payloadFromInput` migreren de oude string naar `GroupLevel[]` (§7.5); `viewRows` wordt vers berekend, dus geen stale afgeleide state. |
| 9 | **Fase 2.6-overlays raken verstrengeld met layouts.** | Overlay-toggles blijven document-state, buiten `Layout`; Beeld-tab reserveert een lege [Overlays]-groep (B14, §1/§13). |

---

*Einde ontwerp. Beslispunten: uur-schaal uitgesteld (§3.4); split view naast elkaar (§10.1); één
store-`viewRows` als gedeelde bron (§4.3); structuur-mutaties alleen in pure boommodus (§4.5);
layout-onbekende-refs = stille tolerantie met false-evaluatie (§8.4, BESLIST); resource-kolom
read-only join (§5.3); resource-multi-band default aan zonder toggle (§7.1, BESLIST); pijlen naar
eerste occurrence bij multi-band (§7.1); pad-encoderende band-sleutels (§7.1); recenter op
viewportmidden (§3.3, BESLIST); testplan via harness-uitbreiding (§14.1, BESLIST); mini-map toont
primaire pane bij split (§10.3, BESLIST); view-state buiten undo (§12.1).*
