# Ontwerp: Fase 2.8b — Uren-/minuten-scheduling

*Status: **bindend ontwerp** (2026-07-06) — te implementeren zonder de bronrapporten te herlezen. Elke
beslissing citeert het exacte bestand:regel waar hij op steunt; alle regelnummers zijn in deze sessie
gecontroleerd tegen de echte broncode op branch `fase-2.8b`.*
*Bron: [Rapport A — codebase-inventory](2026-07-06-2.8b-research-codebase.md), [Rapport B —
domeinonderzoek](2026-07-06-2.8b-research-domein.md), en firsthand code-verificatie (dateUtils,
CalendarEngine, CPMSolver, harness, timelineTiers, alle adapters). Conventie & diepgang: zie het 2.8a-doc
[2026-07-04-kalenders-design.md](2026-07-04-kalenders-design.md).*

Fase 2.8a maakte de kalender eersteklas maar bleef **dag-granulair** (`Date` op middernacht,
`workStartHour`/`workEndHour` puur informatief, geverifieerd `CalendarEngine.ts:37-42,199-201`). 2.8b maakt
scheduling **uur-/minuut-bewust**: een uur-tijdschaal in de Gantt, dag/nacht-ploegen, pauzes, en echt
24-uurs werk — zonder één van de 290 bestaande dag-cases of 23 voorbeeldbestanden te bewegen.

---

## 1. Doel & scope

### In scope

- **Grondslag**: interne bron-van-waarheid voor duur/lag wordt **integer minuten** (§2), gematerialiseerd
  *alleen* waar sub-dag-data bestaat. Datums worden intern minuut-precisie-instants, geserialiseerd als
  `YYYY-MM-DD` zolang er geen tijd-van-de-dag in zit (byte-identiek).
- **Kalendermodel**: `WorkCalendar` krijgt optionele **werktijd-banden per weekdag** (`workTime?`),
  meerdere banden per dag (pauze), banden over middernacht (nachtploeg), en een **24/7**-vorm (§3.2).
  Ploeg = eigen kalender, toegekend per taak via het bestaande `Task.calendarId` (2.8a).
- **Engine**: `CalendarEngine` wordt **modus-bewust** — dag-kalenders draaien de bestaande dag-lussen
  *fysiek ongewijzigd*; uur-kalenders krijgen een minuut-native pad (§4). `CPMSolver` rekent forward +
  backward op minuut-granulariteit voor uur-taken, float in eigen-kalender-eenheden (§5).
- **Gantt/UI**: bestaande uur/kwartier-tiers activeren (`timelineTiers.ts:54-72`), sub-dag-balkpositie
  (`dateToX` kan het al — `GanttRenderer.ts:143-146`), uur-bewuste drag/snap, duur-weergave d/h met
  mixed-kalender-waarschuwing, kalenderdialoog-banden-editor, ploeg-wizard (§6).
- **Adapters**: IFC `PnDTnHnMnS` + echte tijden + `TimePeriods`-lijst + echte ploeg-`PredefinedType`; P6 en
  MSPDI op minuut-precisie (afronding weg) met round-trip-garanties (§7).
- **Testplan**: harness-uitbreiding (uur-cases, datetime-comparator, afwezig-uur-veld = dag-gedrag), NIEUWE
  handberekende uur-batterij (§9), 290 + `verify:examples` als regressie-poort (§8).

### Expliciet buiten scope (met fase-verwijzing)

- **Instelbare lag-kalender** (P6's 4 opties) — **fase 2.9** (TODO r217). `LAG_CALENDAR = 'predecessor'`
  blijft de constante (`lagCalendar.ts:10`); lag verhuist wél mee naar minuten (§2.4).
- **Sub-dag resource-nivellering** (per-uur/per-shift capaciteits-emmers) — **later**. De leveler blijft
  dag-emmer-gebaseerd (`ResourceLeveler.ts:159-274`); uur-taken worden op dag-granulariteit genivelleerd
  (hun minuten naar boven afgerond op dag-emmers), gedocumenteerde beperking + performance-reden (§5.6).
- **Tijdzone/DST** — de engine rekent in UTC-instants zonder DST (zoals nu, `dateUtils.ts:2-4`). `IfcTime`
  draagt tz/DST-offset (Rapport B §4.3); wij schrijven/lezen lokale kloktijd zonder offset. Fase later.
- **P6 Time-Periods ontkoppeld van de werkweek** (aparte week/maand/jaar-conversiefactoren, Rapport B §1.2)
  — 2.8b houdt `hoursPerDay` als enige dag↔minuut-factor; week/maand/jaar-weergavefactoren later.
- **Kostprijs-shift-kalender** (P6 "Units & Prices"-shift, Rapport B §1.4) — dat is een kostenfunctie, geen
  planningsmechanisme; niet in 2.8b.

### Backwards-compat is de eerste invariant

**Een document zonder uur-data gedraagt zich bit-identiek aan nu.** Dit is geen belofte maar een
*constructie* (§2.2): de nieuwe velden zijn optioneel, en zolang ze afwezig zijn raakt de uitvoering geen
enkele nieuwe regel — de bevroren dag-lussen draaien. Regressie-poort: 290 cases byte-identiek groen +
`verify:examples` (23 bestanden byte-identiek, `package.json:15`). Oude `.ifc`/`.xml`/localStorage/
undo-snapshots laden zonder migratie (nieuwe velden ontbreken → dag-modus).

---

## 2. Grondslag-besluit: minuten, opt-in per data-aanwezigheid

### 2.1 Waarom minuten (Rapport B §6.1, geverifieerd tegen de adapters)

P6 slaat duur op in **minuten** (Rapport B §1.1), MS Project rekent op **minuut**-niveau en codeert
MSPDI-lag in **tienden van minuten** (Rapport B §2.1, bevestigd `mspdiWriter.ts:51-54`
`lagToTenthsOfMinutes = lagDays*hoursPerDay*60*10`). De kleinste gedeelde noemer is de **minuut**; integer
minuten vermijden de afrondingsklassen die uren-met-decimalen introduceren. Interne bron-van-waarheid voor
**duur** en **lag** wordt daarom integer minuten.

### 2.2 Het compat-mechanisme: uur-modus is opt-in, dag-pad blijft fysiek ongewijzigd

**De harde eis (290 bit-identiek, `verify:examples` byte-identiek) wordt een constructie, geen
her-derivatie.** Drie optionele velden bepalen de modus, op twee granulariteiten:

1. **`WorkCalendar.workTime?`** (nieuw, optioneel, §3.2). *Afwezig* ⇒ **dag-kalender** ⇒ `CalendarEngine`
   draait de bestaande dag-lussen (`addWorkDays`/`subtractWorkDays`/`nextWorkDay*`/`prevWorkDay*`/
   `addWorkingDaysSigned`, `CalendarEngine.ts:54-197`) **letterlijk ongewijzigd** op middernacht-Dates.
2. **`TaskTime.durationMinutes?`** (nieuw, optioneel, §3.1). *Afwezig* ⇒ `scheduleDuration` (integer
   werkdagen, `task.ts:46`) is de bron; alle duur-rekenkunde blijft in werkdagen.
3. **`Sequence.lagMinutes?`** (nieuw, optioneel, §3.4). *Afwezig* ⇒ `lagDays` (`sequence.ts:19`) is de bron.

**De sleutel-invariant:** *een document met nul `workTime`, nul `durationMinutes`, nul `lagMinutes`
passeert geen gedragswijzigende nieuwe tak: elke nieuwe conditie (modus-detectie, eenheid-keuze) evalueert
voor een dag-document naar exact de bestaande expressie.* De uur-takken in engine, solver, adapters en
renderer zijn dan "dood"; het voorbeeld bij uitstek is de eenheid-neutrale ternary in §5.1, waarvan de
rechter tak voor een dag-taak op een dag-kalender letterlijk de huidige `cal.addWorkDays(es,
scheduleDuration)`-regel is (Bevinding 11). De 290 en de 23 examples zijn daarmee bit-identiek **omdat
dezelfde `Date`-objecten en dezelfde `formatDate`-uitvoer ontstaan**, niet omdat we het dag-gedrag in
minuten na-bouwen en hopen dat de reductie klopt.

### 2.3 Gemotiveerde afwijking van "pure minuten-grondslag als enige pad"

Rapport B §6.1 beveelt aan: minuten-grondslag met "de dag-tellus als exacte reductie van de minuten-tellus,
bovenop `CalendarEngine`". Ik volg minuten als grondslag **maar behoud het dag-pad fysiek** i.p.v. het in
minuten te herschrijven, om één aantoonbare reden:

> De reductie is **niet naïef**. De default-kalender is `07:00-16:00` met `hoursPerDay=8`
> (`calendar.ts:47-51`, geverifieerd) — 9 kloknuren spanne, 8 netto uur. Een minuten-engine die de banden
> als bron neemt zou 9u/dag afleiden en élke dag↔minuut-conversie verschuiven, wat de 290 breekt. De
> dag-engine leest die banden nu juist *nooit* (`CalendarEngine.ts:37-42`), dus 8u is impliciet correct.

Daarom: **minuten is de grondslag voor sub-dag-hoeveelheden en voor álle interop/serialisatie van sub-dag;
een dag-kalender blijft integer-dag-native — het bijzondere geval waarin `minuten = dagen × hoursPerDay ×
60` nooit wordt gematerialiseerd.** Voor dag-kalenders definiëren we (waar we tóch minuten nodig hebben,
bv. gemengde projecten §5.4) de synthetische banddaglengte als **`hoursPerDay × 60` minuten** — níét
`workEndHour − workStartHour` — zodat de reductie exact is en `workStartHour`/`workEndHour` informatief
blijven. Zo krijgen we één conceptuele grondslag (minuten) met een bevroren, bewijsbaar-identiek dag-pad.

### 2.4 Datum-representatie: instants intern, date-only serialisatie waar mogelijk

Datums blijven **strings**, wat serialisatie triviaal houdt (Rapport A §6: `JSON.parse(JSON.stringify)` in
`snapshot.ts:38-53` transporteert elke string ongewijzigd). Het risico zat nooit in opslaan maar in
**her-parsen** — élke `parseDate` kapt naar middernacht (`dateUtils.ts:2-4`). Besluit:

- `parseDate`/`formatDate` blijven **ongewijzigd** het dag-substraat (nog steeds gebruikt door élke
  dag-kalender en élk legacy-leespad).
- Nieuw: `parseInstant(s): Date` (behoudt tijd-van-de-dag) en `formatInstant(d, mode): string` — de
  **modus is de enige discriminator** (Bevinding 6): dag-modus emitteert altijd `YYYY-MM-DD` via
  `formatDate` (byte-identiek); uur-modus emitteert altijd `YYYY-MM-DDTHH:mm`, óók op een rond uur en óók
  om middernacht (een 24/7-taak die op `T00:00` eindigt behoudt zijn tijd-component). Er is geen
  middernacht-uitzondering: de instant-waarde beslist niets, de modus wel. Zo serialiseert een dag-taak
  byte-identiek en verliest een uur-taak nooit zijn tijd-van-de-dag.

De **modus-gestuurde formattering** (niet de waarde) bepaalt de output: een dag-taak levert
`formatDate(middernacht)` = dezelfde `YYYY-MM-DD` als nu; een uur-taak levert de volle datetime, óók als hij
toevallig op een rond uur of op middernacht landt.

---

## 3. Datamodel (exacte TS-types)

### 3.1 `src/types/task.ts` — `durationMinutes` + minuut-datums

`TaskTime` (`task.ts:44-65`) krijgt optionele sub-dag-velden; de bestaande blijven ongewijzigd van vorm en
betekenis:

```ts
export interface TaskTime {
  durationType: DurationType;
  scheduleDuration: number;        // in work days — BLIJFT (afgeleide weergave in uur-modus)
  /** OPTIONEEL — canonieke duur in integer MINUTEN (fase 2.8b). Aanwezig ⇒ bron van waarheid; het
   *  effectieve `scheduleDuration` is dan de afgeleide `minuten / (effHoursPerDay × 60)`. Afwezig ⇒
   *  `scheduleDuration` (werkdagen) is de bron (dag-modus, byte-identiek).
   *  INVARIANT (§3.1, Bevinding 2): `durationMinutes` wordt alleen gezet én gerespecteerd wanneer de
   *  effectieve kalender uur-modus is; op een dag-kalender is sub-dag-duur ongedefinieerd en wordt het
   *  veld genegeerd (fallback `scheduleDuration`, nooit een fractionele dag in `addWorkDays`). */
  durationMinutes?: number;
  scheduleStart: string;           // ISO — date-only in dag-modus, datetime in uur-modus
  scheduleFinish: string;
  earlyStart: string; earlyFinish: string; lateStart: string; lateFinish: string;
  freeFloat: number; totalFloat: number;   // ALTIJD eigen-kalender-werkdagen: integer in dag-modus
                                           // (bit-identiek), fractioneel in uur-modus (§5.5, Bevinding 1)
  isCritical: boolean;
  actualStart?: string; actualFinish?: string;
  actualDuration?: number;         // werkdagen (dag) — optioneel actualDurationMinutes? later
  remainingTime?: number;          // idem
  /** OPTIONEEL — resterend werk in minuten (uur-modus voortgang, §5.3). */
  remainingMinutes?: number;
  completion: number;
}
```

- `createDefaultTaskTime` (`task.ts:110-139`) blijft dag-native (geen `durationMinutes`). Een nieuwe
  overload/aanroeper zet `durationMinutes` alleen als de invoer sub-dag is. Zolang niemand hem zet:
  identiek gedrag.
- `Task.calendarId?` (`task.ts:104-107`) — hergebruikt ongewijzigd om een taak op een ploeg-/uur-kalender
  te zetten (2.8a-mechanisme).

**Effectieve duur-resolutie** (één gedeelde helper, gebruikt door solver, renderer, adapters):
```ts
// minuten indien uur-modus, anders werkdagen×effHoursPerDay×60 (voor gemengde projecten)
function durationMinutesOf(task, effCal): number
function durationDaysOf(task, effCal): number   // uur-kalender: durationMinutes/(hpd×60); dag-kalender: scheduleDuration
```

**Invariant — sub-dag-duur vereist een uur-kalender (Bevinding 2).** `durationMinutes` op een taak waarvan
de effectieve kalender **dag-modus** is, is **ongedefinieerd** en wordt niet gehonoreerd: `durationDaysOf`
assert/negeert het veld op een dag-kalender en valt terug op `scheduleDuration` — het stopt daar dus **nooit**
`durationMinutes/(hpd×60)` (een fractionele dag) in de integer-dag-lus `addWorkDays`. Sub-dag-duur (h/m) kan
uitsluitend bestaan op een uur-kalender-taak; de duur-parser (§6.4) dwingt dit af aan de invoerkant en
`durationDaysOf` aan de reken-kant. Deze invariant krijgt een expliciete testcase in `cases-hours.json`
(§8.3): `durationMinutes` op een dag-kalender-taak ⇒ genegeerd, dag-datums bit-identiek aan de tweeling
zonder het veld.

### 3.2 `src/types/calendar.ts` — werktijd-banden, ploegen, 24/7

De uur-velden bestaan al (`calendar.ts:9-11`) maar zijn informatief. 2.8b voegt een **optioneel**
banden-blok toe; `WorkCalendar` blijft anders identiek (zodat CalendarEngine, de 20+ registry-vindplaatsen
en de IFC-round-trip onaangeroerd blijven wanneer het ontbreekt):

```ts
export interface WorkCalendar {
  id; name; description; workDays; workStartHour; workEndHour; hoursPerDay; holidays; generation?;
  /** OPTIONEEL — per-weekdag werktijd-banden (fase 2.8b). Aanwezig ⇒ UUR-kalender (minuut-native
   *  scheduling). Afwezig ⇒ DAG-kalender (bevroren dag-lussen, byte-identiek). */
  workTime?: WorkTimeBands;
  /** OPTIONEEL — ploeg-classificatie voor IFC-`PredefinedType` (fase 2.8b, §7.1). Afwezig ⇒
   *  `.FIRSTSHIFT.` (byte-identiek met bestaande bestanden). */
  shift?: 'FIRST' | 'SECOND' | 'THIRD' | 'USERDEFINED';
}

/** Werktijd-banden per ISO-weekdag (1=ma..7=zo). Een weekdag zonder banden = niet-werkend.
 *  Een band is [start,end) in MINUTEN-VANAF-MIDDERNACHT van de STARTdag. **Canoniek: `end > start`**
 *  (Bevinding 7); een wrap-band (over middernacht) heeft `end ∈ (1440, 2880]` en telt bij de STARTdag
 *  (P6/Asta-conventie: een shift begint op zijn weekdag en mag 24u overspannen, Rapport B §3). De
 *  alternatieve encoding met een niet-oplopende grens is **ongeldig** en wordt bij inlezen genormaliseerd
 *  naar de canonieke vorm (`end += 1440`), zodat er precies één representatie in omloop is. */
export interface WorkTimeBands {
  byWeekday: Record<1|2|3|4|5|6|7, { start: number; end: number }[]>;  // gesorteerd, niet-overlappend, canoniek end>start
}
```

- **`hoursPerDay` wordt afgeleid** voor uur-kalenders als de **modale band-som** over de werk-weekdagen
  (Bevinding 8) — de meest voorkomende dagsom (Σ bandlengtes / 60), bij gelijkspel de **hoogste**. Zo is
  `hoursPerDay` ook bij ongelijke weekdagen (bv. ma-do 9u, vr 4u ⇒ modaal 9u) eenduidig gedefinieerd; de
  waarde wordt opgeslagen zodat de bestaande adapters (`p6xmlWriter.ts:74`, `mspdiWriter.ts:36`) hun
  dag↔uur-conversie ongewijzigd doen. Voor dag-kalenders blijft `hoursPerDay` de opgegeven waarde. De
  banden-editor (§6.6) toont per weekdag de band-som én de afgeleide `hoursPerDay` als controlegetal.
- **Pauze/meerdere banden**: `[{480,720},{750,990}]` = 08:00-12:00 + 12:30-16:30 (netto 8u, 30m lunch).
- **Nachtploeg**: `[{1320,1800}]` = 22:00→06:00 (`1800>1440` ⇒ wrap; 480m; hoort bij de startweekdag).
  Materialisatie (§4.2) legt Mon's shift op Mon 22:00→Tue 06:00. Een holiday onderdrukt uitsluitend de
  shift die op de holiday-dag **start**; de staart na middernacht van de vorige dag loopt door (Bevinding 9,
  uitgewerkt in §4.2).
- **24/7**: `byWeekday` = alle 7 dagen `[{0,1440}]` ⇒ `hoursPerDay=24`, geen gaten. Sluit aan op P6's
  24h-kalender (Rapport B §1.6) en Asta's 24u-shift (§3).

`createDefaultCalendar` (`calendar.ts:41-55`) zet géén `workTime` (blijft dag-kalender). De banden-editor
(§6.6) en de wizard (§6.7) zetten hem alleen op expliciet verzoek.

### 3.3 `src/types/sequence.ts` — lag in minuten

`lagMinutes?: number` (optioneel) naast `lagDays` (`sequence.ts:19`). Aanwezig ⇒ bron; afwezig ⇒ `lagDays`.
`lagUnit`/`lagPercent` (`:22-28`) blijven; procent-lag wordt sub-dag-precies uit `durationMinutesOf(pred)`
opgelost i.p.v. `Math.round((predDur × pct)/100)` (`CPMSolver.ts:49-55`) zodra de voorganger uur-modus is.

### 3.4 `src/types/project.ts` — statusdatum met tijd

`Project.statusDate` (`project.ts:25`, comment "ISO date (dag-granulair)") mag een datetime worden. Bij een
uur-project draagt hij tijd-van-de-dag; bij een dag-project blijft hij date-only (byte-identiek). De solver
snapt hem al via `nextWorkDay` (`CPMSolver.ts:193-194`) — dat wordt in uur-modus `nextWorkInstant` (§4.1).

### 3.5 Serialisatie (project-JSON, localStorage, undo/snapshot)

Rapport A §6 is geverifieerd: strings transporteren triviaal. Delta 2.8b:
- **Snapshot/payload** (`snapshot.ts:38-53`, `documentSlice.ts:34-61`): de nieuwe optionele velden rijden
  mee in `tasks`/`calendars`/`sequences`/`project` — geen plumbing-wijziging. Een oud snapshot mist ze →
  dag-modus bij restore.
- **localStorage/settings**: nieuw is een uur-`timeScale`-preset (§6.2) en mogelijk een
  duur-eenheid-voorkeur (d/h, §6.5). Migratie: ontbrekende sleutel ⇒ bestaande default (geen reset;
  patroon `settingsStore.ts:66,90,106`).
- **Undo**: `createSnapshot` (`snapshot.ts:38-53`) kloont via JSON — nieuwe velden zijn plain data → werkt.

---

## 4. Engine: `CalendarEngine` uur-bewust

### 4.1 Modus-detectie + polymorfe interface

`CalendarEngine` (`CalendarEngine.ts:4-202`) wordt **modus-bewust** in de constructor:
`this.mode = calendar.workTime ? 'hour' : 'day'`. De publieke methodenamen die de solver aanroept blijven
gelijk; hun implementatie splitst:

| Methode (huidig) | Dag-modus | Uur-modus (nieuw) |
|---|---|---|
| `isWorkDay(date)` (`:37-42`) | **ongewijzigd** | `isWorkInstant(t)` = t valt binnen een band |
| `addWorkDays(start, D)` (`:54-75`) | **ongewijzigd** | `addWorkMinutes(start, M)` (§4.2) |
| `subtractWorkDays(end, D)` (`:152-172`) | **ongewijzigd** | `subtractWorkMinutes(end, M)` |
| `nextWorkDay(d)` (`:95-103`) | **ongewijzigd** | `nextWorkInstant(t)` = t als t ∈ `[bandstart, bandeind)`, anders de eerstvolgende bandstart |
| `nextWorkDayAfter(d)` (`:108-116`) | **ongewijzigd** | `nextWorkInstantAfter(t)` = eerste bandstart **strikt** > t (bij band-eindgrens: volgende band) |
| `prevWorkDay(d)` (`:123-131`) | **ongewijzigd** | `prevWorkInstant(t)` = t als t ∈ `(bandstart, bandeind]`, anders het laatste band-eind ≤ t |
| `prevWorkDayBefore(d)` (`:138-146`) | **ongewijzigd** | `prevWorkInstantBefore(t)` = laatste band-eind **strikt** < t |
| `addWorkingDaysSigned(d,n)` (`:185-197`) | **ongewijzigd** | `addWorkingMinutesSigned(t, m)` |
| `workDaysBetween(a,b)` (`:80-90`) | **ongewijzigd** | `workMinutesBetween(a,b)` |
| `get hoursPerDay` (`:199-201`) | **ongewijzigd** | idem (afgeleide waarde) |

De solver kiest de eenheid niet zelf; hij vraagt de engine via `durationMinutesOf`/`durationDaysOf` (§3.1)
per taak (§5.1). `MAX_SCAN`/`MAX_DAYS` (`:10-11`) krijgen minuut-equivalenten (`MAX_MINUTES`).

**Band-halfopen-conventie** (kritisch voor de FS-aansluiting): een band is `[start, end)`. Een instant
exact op `end` is **niet** werkend (het is de eindgrens waar werk stopt); de eerstvolgende werk-instant is
de volgende bandstart. Dit maakt de FS-relatie (§5.2) uniform: "opvolger start op de eerstvolgende
werk-instant ná de exclusieve finish van de voorganger".

**Formele definitie van de vier instant-vinders (Bevinding 4)** — spiegel-symmetrisch, met bewust
asymmetrische interval-randen:
- `nextWorkInstant(t)` = t als t ∈ `[bandstart, bandeind)` van een band, anders de eerstvolgende bandstart > t.
- `nextWorkInstantAfter(t)` = de eerstvolgende bandstart **strikt** > t.
- `prevWorkInstant(t)` = t als t ∈ `(bandstart, bandeind]` van een band, anders het laatste band-eind ≤ t.
  Op `t = bandeind` geldt dus `prevWorkInstant(t) = t`: **een finish exact op de band-eindgrens is
  legitiem** en wordt niet een band teruggeduwd (de foute "laatste band-eind strikt < t"-lezing zou zo'n
  finish een dag terugschuiven).
- `prevWorkInstantBefore(t)` = het laatste band-eind **strikt** < t.

De randasymmetrie (`[start,end)` voorwaarts, `(start,end]` achterwaarts) is precies wat een finish op een
band-eind laat samenvallen met de bijbehorende start op diezelfde grens zonder dubbeltelling, en spiegelt
`prevWorkInstant` exact op `nextWorkInstant` (voorwaarde voor symmetrische float, §5.2).

### 4.2 Minuut-lussen + middernacht-wrap

`addWorkMinutes(startInstant, M)`: `cur = nextWorkInstant(start)`; verbruik `M` minuten over
opeenvolgende banden (spring bij bandgrens naar de volgende bandstart); retourneer de instant ná het laatste
verbruikte minuut. Een verbruik dat exact op een band-eind landt geeft die eindgrens terug (correct
"finish-moment").

**Band-materialisatie** (memoized op het kalender-object, §5.6 performance): een venster `[t0, t1]` wordt
uitgerold naar absolute werk-intervallen. Een wrap-band `{1320,1800}` op weekdag D levert het interval
`[D 22:00, (D+1) 06:00)`. **Holiday-attributie (Bevinding 9, P6/Asta-conventie, consistent met "shift hoort
bij de startweekdag"):** een holiday onderdrukt **uitsluitend de shifts die op díé dag starten**; het
na-middernacht-deel van de shift van de vórige dag loopt gewoon door. Concreet: een holiday op dag `D+1`
onderdrukt wél `D+1`'s eigen shift maar níét de staart `[(D+1) 00:00, (D+1) 06:00)` van de wrap-shift die op
`D` startte. De holiday-set is dag-gebaseerd (`CalendarEngine.ts:19-28` — blijft dag-strings) en wordt op de
**startweekdag** van elke band geëvalueerd.

**Reductie-bewijs (dag-kalender):** wordt een dag-kalender toch minuut-native gedreven (alleen in gemengde
projecten §5.4), dan is de synthetische band `[anker, anker+hoursPerDay×60)` per werkdag. Een D-daagse duur
= `D × hoursPerDay × 60` minuten vult exact D volle banden en landt op de D-de band-eind → containing-day =
de D-de werkdag. Dat is precies `addWorkDays`' inclusieve conventie (`CalendarEngine.ts:65` "first work day
counts as day 1"). Zie scenario 7.

### 4.3 Cross-modus-contract (dag-taak ↔ uur-taak)

De solver wisselt tussen taken een **exclusieve "beschikbaar-vanaf"-instant** uit. Definities:

- **Dag-voorganger levert:** `predDoneAt = (ef_date + 1 dag) @ 00:00` — de dag-taak bezet zijn hele
  finish-dag, dus opvolgers zijn beschikbaar vanaf de volgende middernacht. (In een puur dag→dag-netwerk
  produceert dit exact `nextWorkDayAfter(ef)` = het huidige gedrag — bit-identiek.)
- **Uur-voorganger levert:** `predDoneAt = ef_instant` (de exclusieve band-eind/mid-band-instant).
- **Uur-opvolger consumeert:** `ES = nextWorkInstant(predDoneAt)` (+lag).
- **Dag-opvolger consumeert:** `ES = nextWorkDay(ceilToWorkDay(predDoneAt))`, waar `ceilToWorkDay(t)` = de
  dag-van-t indien t op 00:00, anders de volgende dag (een dag-taak kan niet midden op een dag starten).

Zo blijft een all-dag-project de bevroren dag-methoden aanroepen op middernacht-Dates (identiek), en engaged
het cross-pad alleen zodra minstens één zijde uur-modus is (scenario 6).

---

## 5. CPM-wijzigingen

De solver is grotendeels **engine-agnostisch**: hij delegeert álle datumrekenkunde aan `CalendarEngine` en
draagt sinds 2.8a al per-taak-engines (`CPMSolver.ts:121-131` `engineForCal`/`calendarFor`). Daardoor erft
hij uur-gedrag grotendeels gratis; de wijzigingen zitten in **duur-eenheid**, **lag-eenheid** en de
**relatie-snap-conventies**.

### 5.1 Duur-resolutie per taak

De kern-duurstap `const duration = task.isMilestone ? 0 : task.time.scheduleDuration; earlyFinish =
cal.addWorkDays(earlyStart, duration)` (`CPMSolver.ts:402-403`) wordt eenheid-neutraal:

```ts
const ef = cal.isHourMode
  ? cal.addWorkMinutes(es, durationMinutesOf(task, cal))
  : cal.addWorkDays(es, durationDaysOf(task, cal));   // == huidige regel voor dag-taken
```

Milestones blijven duur 0 (identiek). Idem de backward-aftrek (`subtractWorkDays`, `:710`) en de
actuals-snaps (`:386,392`). Voor een dag-taak op een dag-kalender is de rechter tak letterlijk de huidige
regel ⇒ bit-identiek: `durationDaysOf` levert daar per invariant (§3.1, Bevinding 2) altijd de integer
`scheduleDuration` — nooit `durationMinutes/(hpd×60)` — zodat er **nooit een fractionele dag in de
integer-dag-lus `addWorkDays` belandt**. Sub-dag-duur bereikt uitsluitend de linker (`addWorkMinutes`)-tak,
die per invariant alleen op een uur-kalender kan optreden.

### 5.2 Relatie-snaps (FS/SS/FF/SF) — geünificeerd via de exclusieve-finish-instant

`getForwardConstraint` (`:578-667`) en `getBackwardConstraint` (`:718-790`) delegeren nu al aan de pred- en
succ-engines (2.8a splitste pred/succ, `:583-600,730-736`). De enige inhoudelijke wijziging:

- **FS-gap.** Huidig dag-gedrag: `base = pe.nextWorkDayAfter(predResult.ef)` (`:663`). Dit wordt de
  cross-modus-regel (§4.3): `base = succEng.nextWorkInstant(predDoneAt(predResult, predEng))`. In een
  puur dag-net is `predDoneAt = nextWorkDayAfter(ef)`-equivalent ⇒ ongewijzigd. In uur-modus verdwijnt het
  kunstmatige "+1 dag": een FS+0-opvolger start op **dezelfde instant** als de voorganger-finish (scenario
  1) — de "+1" in dag-modus is louter het gevolg van de dag-boundary-exclusieve finish, niet een aparte
  regel.
- **Lag.** `resolveLag` (`:573-576`) en `resolveEffectiveLagDays` (`:49-55`) worden minuut-bewust: bij
  `lagMinutes`/uur-voorganger telt lag in **minuten** via `addWorkingMinutesSigned` op de **voorganger**-
  engine (`LAG_CALENDAR='predecessor'`, ongewijzigd, `:600,736`). `ELAPSEDTIME`-lag telt klok-minuten
  (24/7) vanaf de exclusieve finish en snapt daarna vooruit (§9 scenario 6b). Procent-lag lost sub-dag op.
- **SS/FF/SF** volgen dezelfde pred/succ-engine-splitsing; de mijlpaal-grens-vlaggen (`predEndsBeginOfDay`
  etc., `:610-614,740-745`) blijven dag-conceptueel en raken uur-taken niet (mijlpalen zijn duur 0).

**Backward-pas spiegelt exact** (net als 2.8a §5.2): `prevWorkInstantBefore` spiegelt `nextWorkInstant`,
`subtractWorkMinutes` spiegelt `addWorkMinutes`, lag terug in de voorganger-engine. De symmetrie is de
voorwaarde dat float niet asymmetrisch wordt (scenario's 1-4 tonen forward én backward).

**Backward cross-modus-formules (normatief, Bevinding 5).** De backward-pas leidt `pred.LF` af uit de
opvolger-`LS` volgens de modus-combinatie — de exacte spiegel van de forward-`predDoneAt`/`ES`-regels (§4.3):

- **(a) uur-voorganger, dag-opvolger:** `pred.LF = predEng.prevWorkInstant( dag(succ.LS) @ 00:00 )` — de
  voorganger moet klaar zijn vóór de middernacht van de dag waarop de dag-opvolger start.
- **(b) dag-voorganger, uur-opvolger:** `pred.LF =` de **grootste werkdag `d`** waarvoor
  `succEng.nextWorkInstant( (d+1) @ 00:00 ) ≤ succ.LS` (monotone zoek/afleiding startend bij `dag(succ.LS)`,
  indien nodig terugtellend) — de laatste hele werkdag die de dag-voorganger kan bezetten zonder de
  uur-opvolger zijn `LS` te overschrijden.
- **(c) dag-voorganger, dag-opvolger:** het bestaande **bevroren** dag-pad (`prevWorkDayBefore`),
  bit-identiek.

Scenario 7-backward volgt geval (b) exact: `D.LF = di` is de grootste werkdag waarvoor
`succEng.nextWorkInstant( (di+1)@00:00 ) = wo 08:00 ≤ H.LS wo 08:00`, terwijl `d = wo` al
`do 08:00 > wo 08:00` zou geven.

### 5.3 Statusdatum / voortgang / actuals op uur-niveau

De voortgangstakken (`CPMSolver.ts:364-400`) worden minuut-bewust in uur-modus:
- `dataDate` snapt via `nextWorkInstant` i.p.v. `nextWorkDay` (`:193-194`).
- `remaining = Math.max(0, remainingMinutes ?? round(durationMinutes × (1−completion)))` i.p.v. de
  dag-variant (`:386`); `ef = cal.addWorkMinutes(remStart, remaining)`.
- `remStart = dataDate` met de retained-logic-vloer `earlyStart` (`:387-391`) — ongewijzigd van structuur,
  minuut-instants i.p.v. dagen. Scenario 8: een half-af 8u-taak met statusdatum Mon 12:00 eindigt Mon
  16:00.
- **Out-of-sequence** (`detectOutOfSequence`, `:416-455`) vergelijkt `parseDate`-instants; wordt
  `parseInstant` in uur-modus zodat sub-dag-actuals correct als out-of-sequence tellen. Structuur
  ongewijzigd.

### 5.4 Gemengd (dag-kalender-taak + uur-kalender-taak in één project)

Elke taak rekent in zijn eigen engine (2.8a `calendarFor`, `:129-131`). De cross-modus-instants (§4.3)
overbruggen de grens. `projectDuration` (`:908`) en de projectstart-vloer (`:297-302`) rekenen in de
**projectkalender** (`this.projectEngine`); wanneer die dag-modus is blijft dat dag-werkdagen (scenario 7).
De float-eenheid is per taak (§5.5).

### 5.5 Float in eigen-kalender-eenheden

`signedWorkDays` (`:457-462`) en de relatie-vrije-speling (`:801-820`) rekenen per taak in diens engine
(2.8a-semantiek). In uur-modus levert `workMinutesBetween` een **minuut**-float als tussenresultaat, maar
**`totalFloat`/`freeFloat` (numeriek `task.ts:55-56`) blijven ALTIJD in eigen-kalender-werkdagen**
opgeslagen — voor uur-taken **fractioneel**: `float = floatMinutes / (effHoursPerDay × 60)` (Bevinding 1).
Zo houden de velden één uniforme eenheid (werkdagen) aan, waar de 2.7-filters (`FieldRef`), de
tabelkolommen en `variance.ts:34-40` op rekenen; een gemengde eenheid (minuten voor uur-taken, dagen voor
dag-taken in hetzelfde veld) zou juist die drie breken. **Dag-taken blijven exact de huidige integers**: de
reductie is bit-identiek omdat een dag-kalender integer-dag-native blijft (§2.3), dus `floatMinutes` wordt
daar nooit gematerialiseerd. Minuten/uren zijn puur **weergave** — de UI toont de float als uren of minuten
door met `effHoursPerDay` terug te rekenen (§6.5). Het teken/kritiek-criterium (`tf ≤ 0`, `:864`) is
eenheid-onafhankelijk en blijft ongewijzigd. `variance.ts:34-40` (werkdag-deltas) erft de fractionele-dag-
float direct, zonder eenheid-conflict (Rapport A §1.5, risico LAAG).

### 5.6 ResourceLeveler + engine-cache + performance

De vier `new CPMSolver`-plekken (geverifieerd Rapport A §1.3: `scheduleSlice.ts:58`,
`ResourceLeveler.ts:139/288/415`) dragen sinds 2.8a de registry; **geen signatuur-wijziging** nodig — de
uur-modus komt via de kalender-data mee. Besluiten:

- **Capaciteit blijft dag-emmer** (`ResourceLeveler.ts:159-274`, `unitsPerDay`, iso-dagstrings als
  grootboek). Uur-taken worden op **dag-granulariteit** genivelleerd: hun `durationMinutes` naar boven
  afgerond op dag-emmers voor de capaciteits-boekhouding. Sub-shift-nivellering is out-of-scope (§1).
  Gedocumenteerde beperking; de *planning* (solve) is wél minuut-correct, alleen de capaciteits-emmer is
  grof.
- **Performance-vangnet.** `computePF` roept `solve()` in een lus aan (`ResourceLeveler.ts:405-419`) — een
  minuut-native engine die per stap banden materialiseert vermenigvuldigt de kosten. Mitigatie:
  (a) band-materialisatie **memoizen op het kalender-object** (niet per solver-instantie), zodat de vier
  solver-instanties en de per-pick-solves de uitrol delen; (b) de uur-lussen begrenzen met `MAX_MINUTES`;
  (c) uur-modus engaged alleen bij sub-dag-data — een dag-project betaalt niets. Meten vóór claim (§11).

---

## 6. Gantt / UI

### 6.1 Balkpositie — `dateToX` kan sub-dag al

`GanttRenderer.ts:143-146` `dateToX` rekent `daysFromStart = (date.getTime() − viewStart.getTime()) /
msPerDay` — **fractioneel** — en `× zoom`. Sub-dag-posities werken dus **gratis** zodra instants tijd-van-de-
dag dragen; de enige reden dat balken nu dag-uitgelijnd zijn is dat alle datums middernacht zijn
(`parseDate`). Wijziging: de renderer parst uur-taak-datums via `parseInstant`. **Balkbreedte**
(`GanttRenderer.ts:554-555` `dateToX(end) + zoom`, voegt één hele dag toe) wordt modus-bewust: uur-taak =
`dateToX(finishInstant) − dateToX(startInstant)` (geen +dag-pad); dag-taak houdt `+zoom`.

### 6.2 Uur-tijdschaal-tiers activeren

De tier-infrastructuur is klaar (Rapport A §3.3, geverifieerd): `hour`/`quarterHour`-configs
(`timelineTiers.ts:54-55`), `pickTiers` levert `{day,hour}` bij zoom≥80 en `{hour,quarterHour}` bij zoom≥400
achter `enableQuarterHour` (`:62-72`), en `nextTickBoundary`/`snapToTickStart` behandelen uren/kwartieren
correct (`:98-108,135-144`). Wat ontbreekt: een **uur-schaal-label**. `scaleFromZoom` (`:19-25`) krijgt een
`'hour'`-tak (zoom≥... nieuwe drempel) en `TIMESCALE_ZOOM` (`:10-16`) een `hour`-preset. De harness-
timescale-roundtrip (`harness.ts:758-762`) wordt uitgebreid met `'hour'`. Zoom-koppeling: de bestaande
`enableQuarterHourZoom`-setting (`settingsStore.ts:66`) blijft de kwartier-gate.

### 6.3 Drag / snap

`GanttCanvas.tsx:943` `daysDelta = Math.round(pixelDelta / zoom)` (hele dagen) en `:962-985`
`Math.max(1, diffCalendarDays(...))` (min 1 dag) worden **snap-quantum-bewust**: het snap-quantum is de
actieve **minor-tier** (`hour`/`quarterHour` via `pickTiers`) voor uur-taken, `day` voor dag-taken.
`Math.max(1, ...)` wordt `Math.max(één quantum, ...)`. Slepen/rekken past dan `durationMinutes` aan i.p.v.
`scheduleDuration`. Snap-doel: het quantum-raster (kwartier/uur), **niet** de banden — een gebruiker mag een
balk in een pauze laten beginnen; de engine snapt bij de eerstvolgende `runCPM` naar de eerstvolgende
werk-instant.

### 6.4 Taakdialoog + duur-parser

Er is géén centrale duur-parser; de enige unit-parser is lag (`lagFormat.ts:22-35` `parseLagInput`,
`Math.round` → hele dagen). Nieuw: `src/utils/durationFormat.ts` analoog — `parseDuration("2d4h", effCal):
minutes` (suffixes `d`/`h`/`m`, `hoursPerDay` uit de effectieve kalender) en `formatDuration(minutes,
effCal, unit)`. `TaskDialog.tsx:29,221` (`useState(5)`, `parseInt`) en de andere `scheduleDuration`-
consumenten (`TableEditor`, `TaskPropertiesPanel`, `RelationsPanel`, `LevelingDialog`, `printPreview`,
`wbsTemplates` — Rapport A §3.1) roepen de gedeelde formatter aan.

- **`h`/`m`-suffix vereist een uur-kalender (Bevinding 2).** Sub-dag-suffixen zijn alleen geldig op een taak
  waarvan de effectieve kalender uur-modus is; op een dag-kalender-taak levert `parseDuration` een
  **foutmelding** (geen stille conversie naar fractionele dagen). Dit is de invoerkant van de §3.1-invariant
  "sub-dag-duur vereist een uur-kalender".
- **Naakt getal = werkdagen, óók in uur-modus (Bevinding 10).** Een getal zonder suffix blijft "werkdagen".
  Op een **dag-kalender**-taak blijft dat exact het huidige gedrag (`scheduleDuration = n`, geen
  `durationMinutes`, byte-identiek). Op een **uur-kalender**-taak wordt het n werkdagen in uur-modus:
  `durationMinutes = n × effHoursPerDay × 60` (dus "3" op H8 = 1440 min) met afgeleid `scheduleDuration = n`.
  Zo betekent hetzelfde naakte getal consistent "n werkdagen", ongeacht de modus.

### 6.5 Duur-weergave-conventie (d/h) + mixed-kalender-val

Default weergave: **werkdagen** (via `effHoursPerDay`), met een **d/h-toggle** (P6/MSP-conventie, Rapport B
§6.3). Omdat "1d" dubbelzinnig is bij verschillende kalender-`hoursPerDay` (Rapport B §5, de P6-val — een
480-min-taak is "1d" op een 8u-kalender en "0.8d" op een 10u-kalender, scenario 9), toont de UI de
kalender-`hoursPerDay` in een kolom/tooltip zodra een project kalenders met verschillende daglengtes mengt,
en waarschuwt (net als de adapter-`console.warn`s) wanneer een dag-project en een uur-project samenkomen.

### 6.6 Kalenderdialoog — banden-editor

`CalendarDialog.tsx`/`CalendarForm.tsx` (2.8a) krijgen een **banden-editor**: per werkdag een lijst
`{start,end}`-banden (tijd-pickers), met "kopieer naar alle werkdagen", een **nachtploeg-toggle** (band die
middernacht kruist) en een **24/7-preset**. `hoursPerDay` wordt afgeleid getoond (som van banden). Ontbreekt
`workTime`, dan blijft het de huidige `workStartHour`/`workEndHour`/`hoursPerDay`-scalar-UI (dag-kalender).
*Let op:* een parallel-draaiende bugfix-agent raakt deze dialoog (Annuleren/Enter/vriesvrij) — dit ontwerp
bouwt bovenop wat er staat; geen aanname over stabiliteit tijdens implementatie.

### 6.7 Wizard — ploeg-presets

De wizard (`ProjectInfoDialog`, 2.8a) krijgt optionele **ploeg-presets**: "Dagdienst" (default, dag-
kalender, geen `workTime`), "2-ploegen", "3-ploegen (dag/avond/nacht)", "24/7". Elke niet-default preset
materialiseert de bijbehorende `workTime`-banden + `shift`-classificatie op nieuwe kalender-entries. Default
blijft de dag-kalender ⇒ nieuwe projecten zijn dag-modus tenzij expliciet gekozen.

---

## 7. Adapters

Round-trip-invariant overal: **een bestand zonder sub-dag-data serialiseert byte-identiek terug** (bewaakt
door `verify:examples`), en sub-dag-data behoudt **minuut-precisie** (geen `Math.round`/`Math.ceil` meer).

**Normatieve workTime-import-discriminator (Bevinding 3).** Vrijwel elk MSPDI/P6-bestand draagt
`WorkingTimes`/`WorkTime`-blokken; die **altijd** naar `workTime` vertalen zou elk geïmporteerd project
uur-modus maken en zowel de byte-identiteit (`verify:examples`) als het gedrag van bestaande bestanden
breken. Daarom zet een reader `workTime` **uitsluitend bij een echte afwijking van het enkelvoudige
dag-patroon**, d.w.z. minstens één van:
- **(a)** meer dan één band op een werkdag (pauze/split-shift), of
- **(b)** een band die middernacht kruist (`end` valt op de volgende dag), of
- **(c)** sub-dag-informatie elders in het bestand — een duur met een uren/minuten-component die niet op
  hele dagen valt, of datetimes met een echte tijd-van-de-dag die afwijkt van de synthetische anker-tijden
  (`T07:00:00`/`T08:00:00`, §7.1/7.3).

Anders houdt de reader het scalar `workStartHour`/`workEndHour`-model aan (dag-modus, zoals nu). **Gevolg:
een round-trip van een dag-bestand blijft byte-identiek** — het enkelvoudige `08:00-16:00`-blok wordt géén
`workTime` en emitteert bij het schrijven weer exact dat ene blok. Deze regel geldt normatief voor het
IFC-leespad (§7.1), P6 (§7.2) en MSPDI (§7.3).

### 7.1 IFC 4.3 (native opslagformaat)

- **Volgorde-eis: kalenders vóór taken (Bevinding 12).** Het leespad beslist **per taak** op basis van de
  **referentie-kalender** (uur-modus ⇒ `parseInstant`; dag-modus ⇒ tijd-strippen, zie de datum-bullet), dus
  de kalenders moeten geresolved zijn vóór de taken worden gebouwd. De bestaande reader-volgorde voldoet
  hier al aan: `parse()` roept `extractCalendar` aan (`ifcReader.ts:47`) vóór `extractTasks`
  (`ifcReader.ts:51`) — in deze sessie geverifieerd. De taak-parse leest de effectieve kalender dus altijd
  uit een reeds-geresolvede set; geen herordening nodig.

- **Duur** `ifcDuration(days)` → `'P0Y0M${days}D'` (`ifcWriter.ts:44-46`, geverifieerd). Wordt
  `ifcDuration(minutes, mode)`: dag-modus emitteert **ongewijzigd** `P0Y0M{days}D` (byte-identiek);
  uur-modus emitteert `PnDTnHnMnS` (Rapport B §4.4, `IfcDuration` kan uren native dragen).
- **Datum** `ifcDateTime(iso)` plakt `T07:00:00` op date-only (`ifcWriter.ts:37-42`, geverifieerd). Blijft
  **`T07:00:00`** voor dag-taken (byte-identiek met de golden files) en emitteert de **echte tijd-van-de-dag**
  voor uur-taken. Lezen: `parseDurationDays` (`ifcReader.ts:172-185`) `PT..H → Math.ceil(h/8)` wordt
  minuut-precies; datetimes worden `parseInstant` **alleen** wanneer de referentie-kalender uur-modus is
  (`TimePeriods`-banden) of de duur een `T..H..M`-component heeft — anders tijd-strippen zoals nu (de
  synthetische `T07:00:00` blijft "geen sub-dag-info" ⇒ dag-modus, byte-identiek).
- **`.FIRSTSHIFT.`-hardcode** (`ifcWriter.ts:489`, geverifieerd) → `calendar.shift`-afgeleide
  `PredefinedType`: afwezig ⇒ **`.FIRSTSHIFT.`** (byte-identiek); anders `.SECONDSHIFT.`/`.THIRDSHIFT.`/
  `.USERDEFINED.` (+`ObjectType`). **Markeer in code als conventie** (UNVERIFIED per spec: buildingSMART
  definieert de shift-semantiek níét, Rapport B §4.5).
- **`TimePeriods`-lijst** (`ifcWriter.ts:475-476`, één `IFCTIMEPERIOD` nu) → **lijst** van per-dag-banden
  (`IfcRecurrencePattern.TimePeriods` is native een lijst, Rapport B §4.2). Eén band ⇒ ongewijzigde output
  (byte-identiek). Lezen: alle banden → `workTime`.

### 7.2 P6 XML (primaire uur-native interop)

- **Lezen** `p6HoursToDays(hours, hpd) = Math.round(hours / hpd)` (`p6xmlReader.ts:66-68`, geverifieerd —
  het **grootste verliespunt**) → minuut-precies (`hours × 60`, geen afronding). Toegepast op
  `PlannedDuration`/`RemainingDuration`/`Lag`. Meerdere `<WorkTime>`-banden per dag lezen (nu leest
  `parseP6StandardWorkWeek` alleen het láátste blok als scalar, `p6xmlReader.ts:92-98`, geverifieerd) →
  `workTime`.
- **Schrijven** `durationToP6Hours(days, hpd) = days × hpd` (`p6xmlWriter.ts:74-76`, geverifieerd) — al
  uur-native — wordt `minutes / 60` (fractioneel toegestaan). `writeStandardWorkWeek` (`:88-116`) schrijft
  per werkdag **alle** banden i.p.v. één `{workStartHour,workEndHour}`-blok. `HoursPerDay/Week` uit de
  afgeleide `hoursPerDay`.
- Round-trip: bestand zonder sub-dag ⇒ integer uren = `days × hpd` ⇒ import `× 60` ⇒ zelfde dagen. Ploeg =
  aparte `<Calendar>` per activity (`CalendarObjectId`, 2.8a-slot).

### 7.3 MSPDI

- **Lezen** `parseMSPDuration` `Math.round(hours / 8)` met **hardcoded 8** (`mspdiReader.ts:47-51`,
  geverifieerd — latente bug bij niet-8u-kalenders) → minuut-precies uit `PT{H}H{M}M{S}S`, en de `/8`
  vervangen door `hoursPerDay`. `tenthsOfMinutesToDays` (`:67-72`) → `tenths/10` = minuten direct (geen
  dag-afronding). Datum `substring(0,10)` (`:41`) → `parseInstant` bij uur-modus. Meerdere `<WorkingTime>`-
  banden lezen (nu eerste blok).
- **Schrijven** `durationToISO8601(days, hpd) = PT{days×hpd}H0M0S` (`mspdiWriter.ts:36-39`, geverifieerd) →
  `PT{h}H{m}M0S` uit minuten. `formatMSPDateTime` `T08:00:00`-hardcode (`:29-32`) → echte tijd bij
  uur-taken (date-only + `T08:00:00` blijft voor dag-taken, byte-identiek). Alle banden schrijven (nu één).
  Lag terug in tienden-van-minuten (`lagToTenthsOfMinutes`, `:51-54`) uit echte minuten (encoding klopt al,
  Rapport B §2.1). Ploeg via `<Task><CalendarUID>` (native, 2.8a).

### 7.4 CSV — bewust dag-granulair (`csvReader/Writer`, Rapport A §4.4). Ongewijzigd.

---

## 8. Testplan

### 8.1 Harness-uitbreiding (`tests/planning/harness.ts`)

De harness draait tegen de **echte store + CPM** headless (`harness.ts:336` `S().runCPM()`; runner
`run.sh`). Geverifieerde delta:

- **Uur-duur in cases.** `tasks[].dur` accepteert naast een getal (werkdagen, default) een **string**
  `"2d4h"`/`"4h"`/`"90m"` → `buildAndSolve` (`:262-289`) parst via de nieuwe `parseDuration` naar
  `durationMinutes` en zet die op de taak. Afwezig/naakt-getal ⇒ `scheduleDuration` (dag), ongewijzigd.
- **Uur-kalenders in cases.** `Case.calendar`/`Case.calendars` (`:56,101-102`) krijgen optioneel
  `workTime`/banden/`shift`. `buildAndSolve` (`:189-210`) zet ze op de kalender; afwezig ⇒ het schone
  ma-vr-dag-model (`CLEAN_WORKDAYS`, `:54`), byte-identiek.
- **Lag in minuten.** `links[].lagMinutes?`/`lag:"4h"` naast `lag` (dagen).
- **Datetime-comparator.** `readTask` (`:516-524`) geeft de opgeslagen strings terug; de vergelijking
  `gv !== wv` (`:601`, exacte string-gelijkheid) blijft. **Cruciaal:** de 290 output-strings blijven
  `YYYY-MM-DD` (dag-taken → `formatDate`, §2.4) ⇒ hun vergelijking is byte-identiek, géén comparator-
  wijziging voor de 290. Uur-cases gebruiken `"YYYY-MM-DDTHH:mm"`-verwachtingen; die matchen de uur-output
  exact. De enige comparator-uitbreiding: een **date-only verwachting matcht een date-only output** (voor de
  strip-uur-regressie §8.2 die uur-scaffolding met een dag-kalender hergebruikt).
- **`statusDate` met tijd** (`:113,323`) en `remainingMinutes` in voortgang-cases.

### 8.2 Afwezig-uur-veld = dag-gedrag (regressie-bewijs)

In `cases-hours.json` een **paar-case**: een uur-scenario mét `workTime`+`durationMinutes`, en een tweeling
zónder die velden (dag-kalender, `dur` in dagen) → assert dat de tweeling exact de dag-datums geeft. Plus de
**290 draaien byte-identiek** (de nieuwe takken zijn dood zonder uur-data) en **`verify:examples`** (23
bestanden byte-identiek). Deze drie zijn de regressie-poort; leg vóór implementatie een groene baseline vast
(Rapport A §5-slot: `run.sh` is in de inventory-sessie **niet** gedraaid — UNVERIFIED dat de 290 nú groen
zijn; eerst vaststellen).

### 8.3 Nieuwe handberekende uur-batterij

`cases-hours.json` — de 9 scenario's van §9, elk met forward én backward (es/ef/ls/lf/tf) waar §9 die geeft.
`caldict`-achtige onafhankelijke narekening: een minuut-tabel per kalender (H8/H-break/Night/24-7/H10) in
een BRIEF.md-regel voor de case-schrijvers, zodat de verwachtingen onafhankelijk worden herrekend.

Aanvullende randgeval-cases:
- **Holiday na een wrap-shift (Bevinding 9).** Night-kalender, holiday op **dinsdag**: de maandag-shift
  22:00-06:00 **loopt door** tot di 06:00 (de staart wordt níét onderdrukt), de dinsdag-shift 22:00
  **vervalt**, en de eerstvolgende bandstart is **wo 22:00**. Assert dat een taak die de maandag-nacht
  draait op di 06:00 eindigt en dat een FS+0-opvolger op wo 22:00 start.
- **`durationMinutes` op een dag-kalender (Bevinding 2).** Een taak met een gezet `durationMinutes` op een
  dag-kalender ⇒ het veld wordt genegeerd (fallback `scheduleDuration`), dag-datums bit-identiek aan de
  tweeling zonder het veld.

---

## 9. Handberekende scenario's

**Referentiekalenders** (weekdagen geverifieerd met `date`: ma 6, di 7, wo 8, do 9, vr 10, za 11, zo 12, ma
13 juli 2026):

- **H8** — ma-vr, één band **08:00-16:00** = 480 min/dag (`hoursPerDay=8`, `minutesPerDay=480`).
- **H-break** — ma-vr, **08:00-12:00 + 12:30-16:30** = 240+240 = 480 netto, 30 min lunch.
- **Night** — ma-vr, **22:00-06:00** (wrap) = 480 min, bij de startweekdag.
- **24/7** — alle 7 dagen **00:00-24:00** = 1440 min.
- **H10** — ma-vr **08:00-18:00** = 600 min (`hoursPerDay=10`).
- **DagMV** — dag-kalender ma-vr (geen `workTime`): huidig gedrag.

Conventie (§4): band = `[start,end)`; FS-opvolger = `nextWorkInstant(exclusieve pred-finish) + lag`;
`addWorkMinutes` telt vanaf de startinstant; `LAG_CALENDAR='predecessor'`. Projectstart = ma 6 juli tenzij
anders.

---

**Scenario 1 — H8 forward+backward, FS+0 binnen-dag-koppeling, LS/LF/TF.**
`A` (H8, 12u=720m), `B` (H8, 4u=240m), `A →FS+0 B`.

| Stap | Berekening | Resultaat |
|---|---|---|
| A.ES | `nextWorkInstant(ma 6 00:00)` = eerste band | **ma 6 08:00** |
| A.EF | `addWorkMinutes(ma 08:00, 720)`: ma 08:00-16:00 = 480 (rest 240); di 08:00+240m=+4u | **di 7 12:00** |
| B.ES | FS+0: `nextWorkInstant(A.EF di 12:00)` = di 12:00 (in band) | **di 7 12:00** |
| B.EF | `addWorkMinutes(di 12:00, 240)` = di 12:00+4u | **di 7 16:00** (band-eind) |

Projecteinde di 16:00. **Geen "+1 dag": B start op A's finish-instant** (uur-FS+0), anders dan dag-modus.

*Backward* (proj-eind di 16:00):

| Stap | Berekening | LS / LF | TF |
|---|---|---|---|
| B | LF=di 16:00; `subtractWorkMinutes(di 16:00,240)`=di 12:00 | **di 12:00 / di 16:00** | 0 (kritiek) |
| A | LF=`prevWorkInstant(B.LS di 12:00)`=di 12:00; `subtractWorkMinutes(di 12:00,720)`: di 12:00→08:00=240 (rest 480); ma 16:00→08:00=480 | **ma 08:00 / di 12:00** | 0 (kritiek) |

Beide kritiek; forward en backward tellen hetzelfde minuut-raster.

---

**Scenario 2 — H8 merge, float in minuten.**
`P` (H8, 4u), `Q` (H8, 12u), `R` (H8, 4u), `P →FS+0 R`, `Q →FS+0 R`.

| Taak | ES | EF |
|---|---|---|
| P | ma 08:00 | ma 12:00 (4u) |
| Q | ma 08:00 | di 12:00 (12u = ma 8u + di 4u) |
| R | max(`nWI`(ma 12:00)=ma 12:00, `nWI`(di 12:00)=di 12:00) = **di 12:00** | di 16:00 (4u) |

Projecteinde di 16:00; Q drijft. *Backward* (di 16:00): R.LS di 12:00 / LF di 16:00 (TF 0). Q.LF=`pWI`(R.LS
di 12:00)=di 12:00; Q.LS=`subtractWorkMinutes(di 12:00,720)`=ma 08:00 (TF 0, kritiek). P.LF=`pWI`(di
12:00)=di 12:00; P.LS=`subtractWorkMinutes(di 12:00,240)`=di 08:00.
**P total float** = P.LS−P.ES = di 08:00 − ma 08:00 = 1 H8-werkdag = **480 min (8u)**. **P free float** =
`workMinutesBetween(P.EF ma 12:00, R.ES di 12:00)` = ma 12:00-16:00 (240) + di 08:00-12:00 (240) = **480 min
(8u)**. Toont float in minuten (8u = één H8-dag).
**Opslag (Bevinding 1):** de BEREKENING loopt in minuten (480m), maar de OPGESLAGEN `totalFloat`/`freeFloat`
is de fractionele-dag-reductie **1,0 d** (`480 / (8×60)`) — de veld-eenheid blijft eigen-kalender-werkdagen
(§5.5). De 480-minuten-tussenwaarde is puur reken/weergave, niet wat in het veld landt.

---

**Scenario 3 — H-break, meerdere banden per dag (lunch).**
`A` (H-break, 6u=360m), `B` (H-break, 4u=240m), `A →FS+0 B`.

| Stap | Berekening | Resultaat |
|---|---|---|
| A.ES | eerste band | **ma 08:00** |
| A.EF | 360m: band1 08:00-12:00 = 240 (rest 120); **lunch 12:00-12:30 overgeslagen**; band2 12:30+120m | **ma 14:30** |
| B.ES | `nextWorkInstant(ma 14:30)` = ma 14:30 (in band2) | **ma 14:30** |
| B.EF | 240m: ma 14:30-16:30 = 120 (rest 120); di band1 08:00+120m | **di 10:00** |

Toont de **lunchpauze** (6u-taak eindigt 14:30, niet 14:00) én de overnacht-sprong. *Backward* (di 10:00):
B.LS=`subtractWorkMinutes(di 10:00,240)`: di 08:00-10:00=120 (rest 120); ma band2 16:30→14:30=120 → **ma
14:30** (LF di 10:00, TF 0). A.LF=`pWI`(ma 14:30)=ma 14:30; A.LS=`subtractWorkMinutes(ma 14:30,360)`: ma
14:30→12:30=120 (rest 240); lunch; band1 12:00→08:00=240 → **ma 08:00** (TF 0). Beide kritiek; lunch in beide
richtingen correct.

---

**Scenario 4 — Night, ploeg over middernacht.**
Werk-intervallen: ma 22:00→di 06:00, di 22:00→wo 06:00, … (za 06:00-ma 22:00 = weekend-gat).
`A` (Night, 8u=480m), `B` (Night, 4u=240m), `A →FS+0 B`.

| Stap | Berekening | Resultaat |
|---|---|---|
| A.ES | `nextWorkInstant(ma 00:00)` = ma's shiftstart | **ma 22:00** |
| A.EF | 480m: ma 22:00-24:00 = 120 + di 00:00-06:00 = 360 | **di 06:00** (shift-eind, middernacht gekruist) |
| B.ES | `nextWorkInstant(di 06:00)`: di 06:00 is band-eind ⇒ volgende bandstart | **di 22:00** |
| B.EF | di 22:00 + 4u | **wo 02:00** |

Toont de **middernacht-kruising** (A eindigt di 06:00) én dat B niet kan doorlopen (shift voorbij) tot di
22:00. *Backward* (wo 02:00): B.LS = wo 02:00−4u = di 22:00 (LF wo 02:00, TF 0). A.LF=`prevWorkInstant(di
22:00)`: di 22:00 is bandstart ⇒ vorig band-eind = di 06:00; A.LS = di 06:00−8u: di 06:00→00:00=360, ma
24:00→22:00=120 → **ma 22:00** (TF 0). Beide kritiek.

---

**Scenario 5 — 24/7-kalender (echt 24-uurs) + elapsed-equivalentie.**
`A` (24/7, 30u=1800m), `B` (24/7, 12u=720m), `A →FS+0 B`. Continu klok-tijd, geen gaten.

| Stap | Berekening | Resultaat |
|---|---|---|
| A.ES | altijd werkend | **ma 00:00** |
| A.EF | 1800m: ma 00:00 + 30u = ma 24u→di 00:00 (1440) + 6u | **di 06:00** |
| B.ES | `nextWorkInstant(di 06:00)` = di 06:00 | **di 06:00** |
| B.EF | di 06:00 + 12u | **di 18:00** |

*Backward* (di 18:00): B.LS di 06:00 (TF 0); A.LF=di 06:00; A.LS = di 06:00−30u = ma 00:00 (TF 0). Op een
24/7-kalender is **WORKTIME-lag ≡ ELAPSEDTIME-lag** (beide klok-minuten) — P6's 24h-kalender-truc (Rapport B
§1.6).

---

**Scenario 6 — lag in de voorganger-kalender op uur-granulariteit.**

*(a) WORKTIME FS+4u, H8.* `P` (H8,4u), `S` (H8,4u), `P →FS+4h S`.

| Stap | Berekening | Resultaat |
|---|---|---|
| P.EF | ma 08:00+4u | ma 12:00 |
| lag-basis | `nextWorkInstant(P.EF ma 12:00)` = ma 12:00 | ma 12:00 |
| + 4u (pred-kalender H8) | `addWorkingMinutesSigned(ma 12:00, +240)` = ma 12:00+4u | ma 16:00 (band-eind) |
| S.ES | `nextWorkInstant(ma 16:00)`: band-eind ⇒ volgende band | **di 08:00** |
| S.EF | di 08:00+4u | **di 12:00** |

De 4u-lag verbruikt **werktijd in de voorganger-kalender** en landt op de band-eindgrens; de opvolger-snap
rolt naar di 08:00. (Bij verschillende pred/succ-kalenders telt de 4u expliciet in de **pred**-kalender,
`LAG_CALENDAR='predecessor'`.)

*(b) ELAPSEDTIME FS+24u (beton-uithardtijd), H8.* `P` (H8,4u, EF ma 12:00), `P →FS+24h[ELAPSED] S`.
Elapsed telt klok-minuten 24/7 vanaf de exclusieve finish: ma 12:00 + 24u klok = **di 12:00**; snap
`nextWorkInstant(di 12:00)` = di 12:00 (in band). **S.ES = di 12:00**, S.EF di 16:00. (WORKTIME 24u zou 3
H8-dagen zijn — do; elapsed telt de nacht mee.)

---

**Scenario 7 — dag-kalender-taak + uur-kalender-taak gemengd (cross-modus, §4.3).**

*Dag→uur:* `D` (DagMV, 2 dagen), `H` (H8, 4u), `D →FS+0 H`.

| Stap | Berekening | Resultaat |
|---|---|---|
| D.ES / D.EF | dag-modus: `nextWorkDay(ma)`=ma; `addWorkDays(ma,2)` (ma=dag1, di=dag2) | ma / **di** (date-only) |
| predDoneAt | dag-voorganger: `(D.EF di + 1 dag) @ 00:00` | wo 00:00 |
| H.ES | `nextWorkInstant(wo 00:00)` (H8) | **wo 08:00** |
| H.EF | wo 08:00+4u | **wo 12:00** |

*Uur→dag:* `H2` (H8, 4u, EF ma 12:00 exclusief), `D2` (DagMV, 1 dag), `H2 →FS+0 D2`. Dag-opvolger:
`ceilToWorkDay(ma 12:00)` = di (mid-dag ⇒ volgende dag); `nextWorkDay(di)`=di ⇒ **D2.ES = di**, D2.EF di.
Toont: uur→dag rolt naar de volgende volledige werkdag. *Backward* (dag→uur, proj-eind wo 12:00): H.LS wo
08:00; D.LF = di (de dag waarvoor `(di+1)@00:00` naar wo 08:00 snapt); D.LS=`subtractWorkDays(di,2)`=ma (TF
0). De projectkalender is dag-modus ⇒ `projectDuration` in werkdagen.

---

**Scenario 8 — statusdatum midden op een werkdag (H8, voortgang).**
`A` (H8, 8u=480m), start ma 08:00, `completion=0.5`, `statusDate=ma 12:00`, RETAINED_LOGIC.

| Stap | Berekening | Resultaat |
|---|---|---|
| dataDate | `nextWorkInstant(ma 12:00)` = ma 12:00 (in band) | ma 12:00 |
| A.ES | actualStart of earlyStart | ma 08:00 |
| remaining | `480 × (1−0.5)` | 240 min (4u) |
| remStart | `max(dataDate ma 12:00, earlyStart ma 08:00)` | ma 12:00 |
| A.EF | `addWorkMinutes(ma 12:00, 240)` | **ma 16:00** |

De statusdatum werkt als **minuut-vloer** midden op de dag. Een niet-gestarte taak `B` (0%, start ma 08:00)
met `earlyStart ma 08:00 < dataDate ma 12:00` wordt gevloerd naar ma 12:00 (`CPMSolver.ts:396-399`-tak,
minuut-variant).

---

**Scenario 9 — duur-conversie bij verschillende `hoursPerDay` (de P6 mixed-val, Rapport B §5).**
`T` op **H8**, ingevoerd als "1d" ⇒ `durationMinutes = 1 × 8 × 60 = 480`. `U` op **H10**, "1d" ⇒ `1 × 10 ×
60 = 600`.

| Actie | `durationMinutes` | Weergave (÷ effHoursPerDay) | Klok-span vanaf ma 08:00 |
|---|---|---|---|
| T "1d" op H8 | 480 | 480/480 = **1d** / 8u | ma 08:00-16:00 |
| T herbenoemd naar H10 | 480 (**invariant**) | 480/600 = **0,8d** / 8u | ma 08:00-16:00 |
| U "1d" op H10 | 600 | 600/600 = **1d** / 10u | ma 08:00-18:00 |
| U herbenoemd naar H8 | 600 (invariant) | 600/480 = **1,25d** / 10u | ma 08:00-16:00 + di 08:00-10:00 |

`durationMinutes` is **invariant onder kalender-herbenoeming**; de dag-weergave herleidt via de effectieve
`hoursPerDay`. Twee taken beide "1d" beslaan verschillende klok-tijd (T 8u, U 10u) — vandaar de
mixed-kalender-waarschuwing (§6.5).

---

## 10. Golfindeling (implementatie)

Vrijwel alles **Opus** (elke golf scharniert op bit-identiteit of correcte minuut-rekenkunde); alleen
vertalingen/mechanische wiring **Sonnet**.

| Golf | Scope | Kernbestanden | Afhankelijk van | Model |
|---|---|---|---|---|
| **0 — Substraat + types + baseline-poort** | `parseInstant`/`formatInstant`, `durationFormat.ts`; optionele velden `durationMinutes`/`workTime`/`shift`/`lagMinutes`/datetime-`statusDate`; **groene 290 + verify:examples vastleggen** | `utils/dateUtils.ts`, `utils/durationFormat.ts` (nieuw), `types/{task,calendar,sequence,project}.ts` | — | Opus |
| **1 — CalendarEngine uur-modus** | modus-detectie, minuut-lussen, banden-materialisatie (memoized), middernacht-wrap, cross-modus-contract; **dag-pad bevroren** | `engine/scheduler/CalendarEngine.ts` | G0 | Opus |
| **2 — CPMSolver minuut-bewust** | duur-resolutie per taak, FS-gap geünificeerd, lag in minuten, forward+backward, float in minuten, statusDate/actuals/out-of-sequence, projectDuration | `engine/scheduler/CPMSolver.ts`, `scheduleSlice.ts` | G1 | Opus |
| **3 — Harness + uur-batterij** | `dur`-string/`lagMinutes`/`workTime` in cases, datetime-comparator, **afwezig-veld=dag-regressie**, `cases-hours.json` (§9), 290+examples-poort | `tests/planning/harness.ts`, `cases-hours.json` (nieuw), BRIEF.md | G1,G2 | Opus |
| **4 — Adapters** | IFC (`PnDTnHnMnS`, echte tijden, `TimePeriods`-lijst, `PredefinedType`), P6 (afronding weg, multi-band, minuut-lag), MSPDI (`/8`-fix, alle banden, minuut-duur/lag) | `services/ifc/{ifcWriter,ifcReader}.ts`, `services/p6/*`, `services/msproject/*` | G0,G1 | Opus |
| **5 — Gantt/UI** | uur-tier-label (`scaleFromZoom`/`TIMESCALE_ZOOM`), balkbreedte uur-modus, drag/snap-quantum, duur-parser-wiring, d/h-toggle + mixed-warning, kalender-banden-editor, ploeg-wizard | `engine/renderer/{GanttRenderer,timelineTiers}.ts`, `components/canvas/GanttCanvas.tsx`, `components/dialogs/{TaskDialog,CalendarDialog,CalendarForm}.tsx`, `ProjectInfoDialog.tsx`, panels | G0,G2 | Opus (wiring/i18n-keys Sonnet) |
| **6 — i18n + docs** | 12 talen voor nieuwe sleutels, changelog, TODO/ontwerpdoc-status | `i18n/*`, `CHANGELOG`, `TODO.md` | G5 | **Sonnet** (Opus-review) |

**Kritieke padvolgorde:** G0→G1→G2→G3 (de bit-identiteits-poort staat in G3). G4 en G5 kunnen deels
parallel ná G1 (banden-model) en G2 (resultaten). G6 laatst.

---

## 11. Out-of-scope-sectie & open risico's

**Out-of-scope** (herhaald uit §1): instelbare lag-kalender (2.9), sub-dag resource-nivellering, tijdzone/
DST, ontkoppelde P6 Time-Periods (week/maand/jaar), kostprijs-shift-kalender, CSV-uur-support.

**Open risico's:**

1. **Bit-identiteit van de minuut-reductie.** Het dag-pad blijft fysiek bevroren (§2.2), maar de renderer/
   adapter-formattering wordt modus-bewust — een fout die dag-taken per ongeluk uur-formatteert breekt
   `verify:examples`. Mitigatie: `formatInstant` valt bij een middernacht-instant/dag-modus terug op
   `formatDate`; de poort (§8.2) is de harde bewaker. **UNVERIFIED dat de 290 nú groen zijn** (Rapport A
   §5-slot: `run.sh` niet gedraaid in de research-sessie) — G0 legt de baseline eerst vast.
2. **Leveler-performance in uur-modus.** `computePF` draait `solve()` in een lus (`ResourceLeveler.ts:405-419`);
   minuut-native banden-materialisatie vermenigvuldigt de kosten. Mitigatie: memoize op het kalender-object,
   `MAX_MINUTES`-grens, en uur-modus engaged alleen bij sub-dag-data. Meten vóór claim.
3. **Middernacht-wrap-attributie.** De keuze "wrap-band hoort bij de startweekdag" (§3.2) volgt Asta/P6
   (Rapport B §3, §1.4). Een holiday onderdrukt uitsluitend de shift die op díé dag **start**; het deel na
   middernacht van de shift van de vorige dag loopt door (Bevinding 9, normatief vastgelegd in §3.2/§4.2 en
   getest via scenario 4 + de holiday-na-wrap-case in §8.3). **Geen open punt meer** — de attributie is
   beslist, niet langer "te documenteren".
4. **`.FIRST/SECOND/THIRDSHIFT.` → dag/avond/nacht.** Buildingsmart definieert de semantiek **niet**
   (Rapport B §4.5, **UNVERIFIED per spec**); wij coderen het als conventie met een code-comment. IFC-round-
   trip van de `shift`-classificatie is best-effort.
5. **Default-kalender 9-klok-uur/8-netto-uur-inconsistentie.** Opgelost door dag-kalenders integer-dag te
   houden en de synthetische band als `hoursPerDay×60` te definiëren (§2.3). Zodra iemand de default-
   kalender expliciet naar uur-modus tilt via de banden-editor, moet hij de banden zó zetten dat de netto
   uren kloppen; de editor toont de afgeleide `hoursPerDay` als controle.
6. **P6-interop bij sub-dag.** De writer kon al uren; de reader stopt met afronden. Tegen een echt P6-export
   valideren vóór claims van volledige uur-interop (net als de 2.8a-notitie voor `StandardWorkWeek`).

**Review-afgedekte besluiten (geen open risico meer):** de architect-review (2026-07-06) heeft drie
potentiële spec-gaten als constructie dichtgezet, niet als restrisico. (1) De **float-eenheid** is uniform
vastgezet op eigen-kalender-werkdagen — fractioneel voor uur-taken, bit-identieke integers voor dag-taken
(Bevinding 1, §5.5) — wat de 2.7-`FieldRef`-filters, de tabelkolommen en `variance.ts` beschermt tegen een
gemengde-eenheid-breuk. (2) **Sub-dag-duur** is per invariant aan een uur-kalender gebonden: `durationMinutes`
op een dag-kalender wordt genegeerd, dus nooit belandt een fractionele dag in `addWorkDays` (Bevinding 2,
§3.1/§5.1/§6.4). (3) De **workTime-import-discriminator** (Bevinding 3, §7) houdt dag-bestanden byte-identiek
door `workTime` alleen te zetten bij een echte afwijking van het enkelvoudige dag-patroon.
```
