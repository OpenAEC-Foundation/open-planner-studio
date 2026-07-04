# Ontwerp: Fase 2.8a — Kalender-uitbreidingen

*Status: **geïmplementeerd (2026-07-04)** — architectuurbeslissingen door de hoofdarchitect vastgelegd
(overgenomen en uitgewerkt hieronder) zijn ongewijzigd geïmplementeerd. Dag-granulair; uren-/
minuten-scheduling en de uur-tijdschaal zijn expliciet **2.8b** (§1, "Expliciet buiten scope").*
*Datum: 2026-07-04 · Bron: [docs/TODO.md](../../TODO.md) §2.8 (incl. de fase-splitsings-blockquote en de
harde bouwvak-eis r192-194), research-rapport 2.8a
(`/home/nozzit/.claude/jobs/fd7f4482/tmp/research-2.8a-kalenders.md`) + firsthand codebase-verificatie
(alle regelnummers hieronder gecontroleerd tegen de echte broncode op deze branch) ·
Conventie & diepgang: zie
[2026-07-04-baselines-voortgang-design.md](2026-07-04-baselines-voortgang-design.md)*

Dit document is bedoeld om zelfstandig te implementeren zonder het bronrapport te lezen: elke beslissing
citeert het exacte bestand/regel waar hij op aansluit. De architectuurbeslissingen (één gedeelde
kalender-bibliotheek, per-taak-kalender in CPM, feestdagen-engine, bouwvak opt-in, IFC-reader-gat
dichten) zijn genomen en niet heropend.

---

## 1. Doel & scope

Fase 2.8a maakt de kalender een **eersteklas, meervoudig, jaar-onafhankelijk** concept. Concreet: de
hardgecodeerde 2026-feestdagenlijst in `createDefaultCalendar()` (`calendar.ts:18-38`) wordt vervangen
door een regelgebaseerde feestdagen-engine (NL/DE/BE/FR/VK/AT/CH); de bestaande resource-kalenderregistry
(2.5) wordt gepromoveerd tot **de** projectbrede kalender-bibliotheek waar project, taken én resources in
wijzen; de CPM-solver rekent per taak in diens eigen kalender; en de bouwvak verdwijnt uit de default en
wordt een expliciete opt-in-wizardkeuze (default *geen* — harde user-eis, TODO.md r192-194). IFC/MSPDI/P6
round-trippen meerdere benoemde kalenders en taak-kalenders; de IFC-reader leest voortaan óók
werkdagen/uren terug (het gat op `ifcReader.ts:739-743`).

### In scope

- **Datamodel**: `WorkCalendar` krijgt optionele generatie-metadata (`ruleSetId`/`region`/`breakChoice`/
  `generatedRange`); nieuw `Task.calendarId?` (`task.ts`); `Project.calendarId` bestaat al
  (`project.ts:10`) en wordt betekenisdragend als verwijzing naar de bibliotheek. Nieuw
  `src/engine/calendar/holidays.ts` met `HolidayRule`/`HolidayDef`/`HolidaySet`/`RegionalBreakTable`.
- **Kalender-bibliotheek**: `resourceCalendars` (`resourceSlice.ts:15`) wordt hernoemd/gepromoveerd tot
  `calendars: WorkCalendar[]` — één registry, `undefined calendarId` = projectkalender (bestaande
  conventie, `resource.ts:21-23`). Migratie: oude inline projectkalender wordt bij laden bibliotheek-entry
  "Projectkalender".
- **CPM per taak-kalender**: `CalendarEngine`-cache `Map<calendarId, CalendarEngine>` (patroon
  `ResourceLeveler.ts:105-110`); duur/constraints per taak in de taak-kalender (fallback project-default);
  **lag telt in de kalender van de voorganger** (P6-default, interne constante met named export).
- **Feestdagen-engine**: regelgebaseerd + jaar-onafhankelijk (`easterSunday`/`nlHolidays` verhuizen uit
  `scripts/gen-core.ts:23-54`); bouwvak als aparte **datatabel** (opt-in, default geen); materialisatie
  naar concrete `Holiday[]`-exception-ranges mét bronregel-referentie op de kalender.
- **Rendering**: Gantt-arcering blijft op de projectdefault-kalender (`GanttRenderer.ts:181-200`) +
  nieuw **naamlabel** bij meerdaagse feestdagblokken (2.5-QA-verhaal).
- **IFC 4.3**: reader-gat dichten (workDays + uren teruglezen); meerdere benoemde kalenders +
  taak→kalender via `IfcRelAssignsToControl` (writer-patroon bestaat, `ifcWriter.ts:503`); regelset-id/
  bouwvak-keuze in een OPS-pset op de kalender.
- **Adapters**: MSPDI Calendars + `Task CalendarUID`; P6 Calendar per activity (`CalendarObjectId`); CSV
  bewust zonder kalenders. Verliesmatrix (§8.4).
- **Store**: `calendars` zit al in snapshot/payload (2.5); delta = `project.calendarId`, `Task.calendarId`,
  kalender-metadata. Undo: bibliotheek-CRUD undoable (resourceSlice-precedent), project-default-switch
  niet-undoable (setCalendar-precedent) — bewuste asymmetrie (§9.3).
- **Wizard**: `ProjectInfoDialog` land-dropdown (+ Bundesland bij DE), bouwvak-keuze geen/Noord/Midden/
  Zuid (default geen), compacte feestdagen-preview.
- **Testharnas**: `cases-kalenders.json` (multi-kalender-CPM); BRIEF.md-regel voor de lag-kalender;
  holiday-generator-checks.

### Expliciet buiten scope (met fase-verwijzing)

- **Uren-/minuten-based scheduling + uur-tijdschaal** — **fase 2.8b** (TODO.md r180-181, r203-208). De
  hele `CalendarEngine`-API is dag-granulair (`Date` op middernacht, `workStartHour`/`workEndHour` puur
  informatief, geverifieerd `CalendarEngine.ts:37-42`); 2.8a raakt dat model niet aan.
- **Dag/nacht-ploegen-kalender** — **2.8b**. Zonder uren betekenisloos: twee ploegen-kalenders verschillen
  alleen in `workStartHour`/`workEndHour`, wat de dag-granulaire solver niet onderscheidt. In 2.8a hooguit
  als benoemde metadata-kalender registreerbaar; de PredefinedType-schakelaar (`.SECONDSHIFT.`/
  `.THIRDSHIFT.` i.p.v. hardcoded `.FIRSTSHIFT.`, `ifcWriter.ts:480`) is 2.8b. Zie §13.
- **Per-rij Gantt-arcering** op afwijkende taak-kalenders — **later**. 2.8a houdt de globale
  projectkalender-kolomarcering (MSP-gedrag); zie §6.2.
- **Instelbare lag-kalender-scheduling-option** (P6's "Calendar for scheduling Relationship Lag" met vier
  keuzes) — **fase 2.9** ("Scheduling options", TODO.md r217). 2.8a legt de keuze vast als interne
  constante (§5.2) met een bron-onzekerheid die het rapport vond (§5.2).
- **Weer-/vorstafhankelijke winterstop** — **fase 4** (weer-integratie). 2.8a kent alleen een *vaste*
  collectieve winterstop als terugkerende periode-uitzondering (§3.5); echt vorstverlet is weerdata, geen
  kalender.
- **Seizoenskalender als apart `work-pattern`-model (Asta-stijl)** — niet nodig; een seizoenskalender is in
  2.8a gewoon een kalender met een terugkerende periode-uitzondering (§3.5).

### Backwards-compat is de eerste invariant

**Bestaande bestanden laden byte-voor-byte ongewijzigd qua gedrag.** Feestdagen staan in IFC/MSPDI als
letterlijke exception-ranges (`IFCWORKTIME`) en worden zo teruggelezen (`ifcReader.ts:744-756`); de
generator raakt uitsluitend níéuwe kalenders. `Task.calendarId`/`project.calendarId` zijn optioneel
(`undefined` = projectkalender), de metadata-velden zijn optioneel, en een document zonder benoemde
kalenders schrijft geen extra IFC-entiteiten. Dit is het regressie-vangnet voor alle bestaande
CPM/kalender-cases (280 op moment van schrijven, na 2.6+2.7) en de IFC golden rule.

---

## 2. Datamodel (exacte TS-types)

### 2.1 `src/types/calendar.ts` — metadata-uitbreiding

`WorkCalendar` (`calendar.ts:1-10`) en `Holiday` (`:12-16`) blijven qua kernvorm ongewijzigd (zodat
CalendarEngine, alle 20 registry-vindplaatsen en de IFC-round-trip onaangeroerd blijven). Eén optioneel
metadata-blok erbij, zodat her-genereren/uitbreiden van feestdagen kan zonder de letterlijke `holidays[]`
te verliezen:

```ts
export interface WorkCalendar {
  id: string;
  name: string;
  description: string;
  workDays: number[];      // 1=ma … 7=zo (ISO 8601)
  workStartHour: number;   // informatief in 2.8a (uren = 2.8b)
  workEndHour: number;     // informatief in 2.8a
  hoursPerDay: number;
  holidays: Holiday[];     // GEMATERIALISEERDE exception-ranges (bron van waarheid voor de engine)
  /** OPTIONEEL — generatie-herkomst. Aanwezig ⇒ de feestdagen in `holidays` zijn door de engine
   *  gegenereerd en kunnen opnieuw worden gematerialiseerd bij projectperiode-wijziging (§4.4).
   *  Afwezig ⇒ letterlijke/handmatige kalender (bestaande bestanden); nooit stil hergenereren. */
  generation?: CalendarGeneration;
}

export interface CalendarGeneration {
  ruleSetId: HolidayCountry;                 // 'NL' | 'DE' | … (welke landenset)
  region?: string;                           // Bundesland/landsdeel/kanton; undefined = landelijk
  breakChoice?: 'noord' | 'midden' | 'zuid'; // NL-bouwvak; undefined = geen (default)
  winterStop?: boolean;                      // vaste collectieve winterstop meegenomen (§3.5)
  generatedFromYear: number;                 // gematerialiseerde spanne (incl.)
  generatedToYear: number;
}
```

`generation` is **puur metadata over hoe `holidays` tot stand kwam**; de solver/renderer/IFC-round-trip
lezen alleen `holidays`. Zo blijft alles wat vandaag werkt werken, en kan de dialoog/wizard "opnieuw
genereren" aanbieden zonder gokwerk. De keuze om te materialiseren (niet at-runtime te genereren) is
bewust: (a) round-trippt verliesloos door de bestaande `IFCWORKTIME`-exceptions, (b) geen stille mutaties
— hergeneratie is een expliciete gebruikersactie (§4.4), (c) 2.8b-proof (uren komen later uit
`workStart/EndHour`, de regelstructuur raakt dat niet).

### 2.2 `src/types/task.ts` — taak-kalender

```ts
export interface Task {
  // ... bestaande velden ...
  /** OPTIONEEL — id in de kalender-bibliotheek (§4). undefined = projectkalender (project.calendarId).
   *  Symmetrisch met Resource.calendarId (resource.ts:21-23). Bepaalt de kalender waarin de DUUR en de
   *  constraints van deze taak rekenen (§5). */
  calendarId?: string;
}
```

Optioneel ⇒ geen migratie; geladen taken zonder het veld rekenen in de projectkalender (huidig gedrag).

### 2.3 `src/types/project.ts` — `calendarId` wordt betekenisdragend

`Project.calendarId` bestaat al (`project.ts:10`, init `'cal-default'`). Vandaag ongebruikt náást
`s.calendar`; in 2.8a wordt het **de verwijzing** naar de bibliotheek-entry die als projectdefault dient
(§4.1). Geen typewijziging.

### 2.4 `src/engine/calendar/holidays.ts` (NIEUW) — regelmodel

Jaar-onafhankelijk, regelgebaseerd (rapport §2.2). Vaste datums, Pasen-afgeleiden, "n-de weekdag",
"weekdag-vóór-datum" (Buß- und Bettag), plus substitutieregels.

```ts
export type HolidayCountry = 'NL' | 'DE' | 'BE' | 'FR' | 'UK' | 'AT' | 'CH';

export type HolidayRule =
  | { kind: 'fixed'; month: number; day: number; days?: number;   // days>1 = meerdaags (Kerst 25-26)
      substitute?: 'nl-kingsday' | 'uk-monday' }                  // verplaatsingsregels
  | { kind: 'easter'; offset: number; days?: number }             // Pasen-afgeleide (offset in dagen)
  | { kind: 'nth-weekday'; month: number; weekday: 1|2|3|4|5|6|7;
      nth: 1|2|3|4|'last' }                                       // UK bank holidays
  | { kind: 'weekday-before'; month: number; day: number; weekday: number }; // Buß- und Bettag

export interface HolidayDef {
  id: string;                 // stabiel, bv. 'nl-koningsdag'
  name: string;               // weergavenaam (NL-brontaal; i18n later, zoals 2.5)
  rule: HolidayRule;
  regions?: string[];         // leeg/undefined = landelijk; anders alleen deze regio-ids
  optional?: boolean;         // opt-in te markeren in de UI (dag is niet overal/altijd vrij)
  /** Alleen genereren in lustrumjaren (jaar % 5 === 0): Bevrijdingsdag is alleen om de 5 jaar
   *  een algemeen erkende vrije dag (2025, 2030, …). De expander slaat andere jaren over. */
  lustrumOnly?: boolean;
}

export interface HolidaySet {
  country: HolidayCountry;
  regions?: { id: string; name: string }[];  // Bundesländer / landsdelen / kantons
  defs: HolidayDef[];
}

/** Aparte DATA-tabel (geen regel) voor advies-vakantieperiodes (NL-bouwvak). */
export interface RegionalBreakTable {
  id: 'nl-bouwvak';
  byRegion: Record<'noord' | 'midden' | 'zuid', {
    byYear: Record<number, { start: string; end: string }>;   // GEVERIFIEERDE jaren
    approx: (year: number) => { start: string; end: string };  // fallback voor verre jaren
  }>;
}

/** Expandeer een set naar concrete Holiday[] voor [fromYear..toYear] (inclusief). */
export function generateHolidays(
  set: HolidaySet, region: string | undefined, fromYear: number, toYear: number,
): Holiday[];

/** Materialiseer de bouwvak-keuze naar één Holiday[] (leeg bij 'geen'). */
export function generateRegionalBreak(
  choice: 'noord' | 'midden' | 'zuid', fromYear: number, toYear: number,
): Holiday[];

/** Vaste collectieve winterstop (§3.5) als terugkerende periode-uitzondering. */
export function generateWinterStop(fromYear: number, toYear: number): Holiday[];
```

`generateHolidays` retourneert **de bestaande `Holiday[]`** — géén wijziging aan `WorkCalendar`/
`CalendarEngine`/IFC nodig; alles round-tript als vandaag. `easterSunday` (Meeus/Jones/Butcher) en de
NL-regels verhuizen letterlijk uit `scripts/gen-core.ts:23-54` (geverifieerd correct, incl.
Koningsdag-zondagregel `:42-43` en Kerst `:52`) en `gen-core.ts` importeert ze voortaan vandaan — één bron
voor app én examples (§3.1).

---

## 3. Feestdagen-engine (`holidays.ts`)

### 3.1 Verhuizing uit `scripts/gen-core.ts`

`gen-core.ts` (voorbeeld-generator) heeft `easterSunday` (`:23-34`), `nlHolidays` (`:40-54`, mét Kerst!)
en `bouwvak` (`:57-62`, alleen Noord, benadering). Deze zitten in `scripts/` en worden **níét** door de
app gebundeld — vandaar dat `createDefaultCalendar()` (`calendar.ts`) een losse hardgecodeerde 2026-lijst
heeft die zelfs **Kerst mist** (geverifieerd: `calendar.ts:27-36` heeft géén Kerst). 2.8a lost dat op door
de logica naar `src/engine/calendar/holidays.ts` (pure TS, keep-Rust-thin, web-build-veilig — `CLAUDE.md`
§"Rust backend is thin") te tillen; `gen-core.ts` importeert voortaan `generateHolidays`/`easterSunday`
i.p.v. eigen kopieën.

### 3.2 Landensets (regels, geen datums)

Volledige regel-inventaris in rapport §2.2. Samengevat, per land als `HolidaySet.defs`:

- **NL** (landelijk): Nieuwjaar (`fixed 1/1`), Goede Vrijdag (`easter -2`), Pasen (`easter 0, days 2`),
  Koningsdag (`fixed 4/27, substitute 'nl-kingsday'` → zondag naar 26/4), Bevrijdingsdag (`fixed 5/5`,
  `lustrumOnly` — alleen in jaren deelbaar door 5 gegenereerd, plus `optional` zodat de UI hem als
  keuze toont), Hemelvaart (`easter 39`), Pinksteren (`easter 49, days 2`), Kerst (`fixed 12/25, days 2`).
- **DE**: landelijk (Neujahr, Karfreitag `easter -2`, Ostermontag `easter 1`, Tag der Arbeit `5/1`, Christi
  Himmelfahrt `easter 39`, Pfingstmontag `easter 50`, Deutsche Einheit `10/3`, Weihnachten `12/25 days 2`)
  + **16 Bundesländer** als `regions`; per-Bundesland: Heilige Drei Könige (`fixed 1/6`, BW/BY/ST),
  Fronleichnam (`easter 60`, BW/BY/HE/NW/RP/SL + delen SN/TH), Mariä Himmelfahrt (`fixed 8/15`, SL + BY
  deels), Reformationstag (`fixed 10/31`, BB/HB/HH/MV/NI/SN/ST/SH/TH), Allerheiligen (`fixed 11/1`, BW/BY/
  NW/RP/SL), Buß- und Bettag (`weekday-before 11/23 wo`, SN), Frauentag (`fixed 3/8`, BE/MV), Weltkindertag
  (`fixed 9/20`, TH).
- **BE** (10 wettelijke, landelijk): Nieuwjaar, Paasmaandag `easter 1`, Dag v/d Arbeid `5/1`, Hemelvaart
  `easter 39`, Pinkstermaandag `easter 50`, Nationale feestdag `7/21`, OLV-Hemelvaart `8/15`, Allerheiligen
  `11/1`, Wapenstilstand `11/11`, Kerstmis `12/25`. (Bouwverlof analoog aan bouwvak — later, §13.)
- **FR** (landelijk): Jour de l'an, Lundi de Pâques `easter 1`, Fête du Travail `5/1`, Victoire `5/8`,
  Ascension `easter 39`, Lundi de Pentecôte `easter 50`, Fête nationale `7/14`, Assomption `8/15`,
  Toussaint `11/1`, Armistice `11/11`, Noël `12/25`. Regio Alsace-Moselle: + Vendredi saint `easter -2`,
  `12/26`.
- **UK** (regions EN-WLS/SCT/NIR): New Year (`fixed 1/1 substitute 'uk-monday'`), Good Friday `easter -2`,
  Easter Monday `easter 1` (niet SCT), Early May (`nth-weekday 5, ma, 1`), Spring bank (`nth-weekday 5, ma,
  last`), Summer bank (`nth-weekday 8, ma, last`; SCT = `nth-weekday 8, ma, 1`), Christmas + Boxing Day
  (`fixed 12/25/26, substitute 'uk-monday'`); SCT + `1/2` + St Andrew's `11/30`; NIR + St Patrick's `3/17`
  + Battle of the Boyne `7/12`.
- **AT** (landelijk uniform): Neujahr, Heilige Drei Könige `1/6`, Ostermontag `easter 1`, Staatsfeiertag
  `5/1`, Christi Himmelfahrt `easter 39`, Pfingstmontag `easter 50`, Fronleichnam `easter 60`, Mariä
  Himmelfahrt `8/15`, Nationalfeiertag `10/26`, Allerheiligen `11/1`, Mariä Empfängnis `12/8`, Christtag
  `12/25`, Stefanitag `12/26`.
- **CH**: "algemeen gangbare" federale/brede set (Neujahr, Karfreitag `easter -2`, Ostermontag `easter 1`,
  Auffahrt `easter 39`, Pfingstmontag `easter 50`, Bundesfeier `8/1`, Weihnachten `12/25`, Stephanstag
  `12/26`) + kanton-parameter voor de rest, mét disclaimer (26 kantons variëren sterk).

**Substitutieregels** (verwerkt in de expander, niet in de kalender-datum): `'nl-kingsday'` = zondag →
26/4; `'uk-monday'` = weekend → eerstvolgende maandag (en Boxing Day → dinsdag als Kerst al op maandag
verschoof). Deze zijn puur binnen `generateHolidays` — de output blijft platte `Holiday[]`.

### 3.3 Bouwvak-datatabel (opt-in, default geen)

Bouwvak is **geen** zuiver algoritme: de advies-datums komen van Bouwend Nederland, gekoppeld aan de
OCW-zomerschoolvakantie-regio's (Noord/Midden/Zuid rouleren in een meerjarige cyclus). Daarom een
**datatabel** met geverifieerde jaren + benaderings-fallback (rapport §2.2):

```ts
export const NL_BOUWVAK: RegionalBreakTable = {
  id: 'nl-bouwvak',
  byRegion: {
    noord:  { byYear: { 2026: { start: '2026-07-18', end: '2026-08-08' }, /* +2025/2027/2028 … */ },
              approx: (y) => /* 3 weken rond 4e ma juli, regio-offset */ ({ start, end }) },
    midden: { byYear: { 2026: { start: '2026-08-01', end: '2026-08-22' } }, approx: … },
    zuid:   { byYear: { 2026: { start: '2026-07-25', end: '2026-08-15' } }, approx: … },
  },
};
```

`generateRegionalBreak(choice, from, to)` gebruikt per jaar `byYear[year]` als aanwezig, anders
`approx(year)`; de UI toont dan een "adviesdatums — controleer bij Bouwend Nederland"-hint (§7.3). De
gegenereerde `Holiday` draagt de **regionaam in de naam** — `"Bouwvak (Noord)"` / `"Bouwvak (Midden)"` /
`"Bouwvak (Zuid)"` — zodat het Gantt-naamlabel (§6.2) de regio toont en de gebruiker in één oogopslag ziet
wélke bouwvak in de planning zit.
**Default is `geen`** (harde eis TODO.md r192-194): `createDefaultCalendar()` en de wizard-default
bevatten géén bouwvak. De huidige `bouwvak(year)`-benadering in `gen-core.ts:57-62` verhuist als de
`approx`-fallback (met de kanttekening dat de tabel voorrang heeft).

### 3.4 `createDefaultCalendar()` jaar-onafhankelijk + bouwvak-vrij

`createDefaultCalendar()` (`calendar.ts:18-38`) wordt:

```ts
export function createDefaultCalendar(anchorYear = new Date().getFullYear()): WorkCalendar {
  const holidays = generateHolidays(NL_SET, undefined, anchorYear - 1, anchorYear + 2); // GEEN bouwvak, MÉT Kerst
  return {
    id: 'cal-default', name: 'Bouwkalender NL',
    description: 'Standaard bouwkalender: ma-vr 07:00-16:00',
    workDays: [1,2,3,4,5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
    holidays,
    generation: { ruleSetId: 'NL', generatedFromYear: anchorYear - 1, generatedToYear: anchorYear + 2 },
  };
}
```

Dit fixt de drie TODO-problemen (r186-189) in één klap: jaar-onafhankelijk (spanne rond `anchorYear`),
geen willekeurige bouwvak-regio, en Kerst is er nu wél. De aanroepplekken (`projectSlice.ts:84`/`:134`,
readers-fallback, `ResourceCalendarDialog.tsx:39`) blijven werken; wie een ankerjaar wil geven kan dat nu.

### 3.5 Vaste winterstop & seizoenskalender

`generateWinterStop(from, to)` levert per jaar één `Holiday`-range over de jaargrens (bv. za vóór Kerst
t/m eerste maandag na 1 jan — gedocumenteerd als *advies*, cao-afhankelijk). Een **seizoenskalender** is
in 2.8a simpelweg een bibliotheek-kalender met een terugkerende periode-uitzondering (bv. "Grondwerk: geen
werk 15 dec–15 feb", als `fixed`-achtige range per jaar gematerialiseerd). Echt weer-/vorstverlet is
weerdata → **fase 4**; de UI benoemt dit expliciet ("vaste winterstop; werkelijk vorstverlet volgt later
uit weerdata", §7).

---

## 4. Kalender-bibliotheek + migratie

### 4.1 Van resource-registry naar gedeelde bibliotheek

De resource-kalenderregistry `resourceCalendars: WorkCalendar[]` (`resourceSlice.ts:15`, init `:39`,
alias `NamedCalendar = WorkCalendar` `:9`) is al een generieke `WorkCalendar[]` — niets aan de vorm is
resource-specifiek. 2.8a promoveert hem tot **de** projectbrede bibliotheek:

- Hernoem `s.resourceCalendars` → `s.calendars` (één registry). Alle CRUD (`addResourceCalendar` `:165`,
  `updateResourceCalendar` `:177`, `removeResourceCalendar` `:189` — mét undo-snapshot, geverifieerd)
  behoudt zijn gedrag; hernoem naar `addCalendar`/`updateCalendar`/`removeCalendar`. `removeCalendar` zet
  bij verwijderen niet alleen `resource.calendarId` maar óók `task.calendarId` en (als het de
  `project.calendarId` was) de projectdefault terug op fallback (§4.3).
- **`s.calendar` (de inline projectkalender, `projectSlice.ts:25`)** blijft bestaan als **gedenormaliseerde
  cache** van de bibliotheek-entry met id `project.calendarId` — zo hoeven de ~30 bestaande leesplekken
  (renderer `GanttCanvas.tsx:83`, `runCPM` `scheduleSlice.ts:56`, writers) niet in één klap te migreren.
  Invariant: `s.calendar` ≡ `s.calendars.find(c => c.id === s.project.calendarId)`. `setCalendar` en de
  bibliotheek-CRUD houden beide kanten in sync (§9).
- `project.calendarId` (`project.ts:10`) wijst naar de default-entry; `task.calendarId?` (nieuw) en
  `resource.calendarId?` (bestaand) wijzen optioneel naar een andere entry; `undefined` = projectdefault
  (bestaande conventie, `resource.ts:21-23`).

Het `resolveCalendar`-patroon dat de leveler/load al gebruiken (`ResourceLeveler.ts:107-109`:
`r.calendarId ? registry.find(...) ?? projectCalendar : projectCalendar`) wordt één gedeelde helper:

```ts
export function resolveCalendar(
  calendarId: string | undefined, registry: WorkCalendar[], projectCalendar: WorkCalendar,
): WorkCalendar {
  if (!calendarId) return projectCalendar;
  return registry.find(c => c.id === calendarId) ?? projectCalendar;
}
```

Gebruikt door de CPM-engine-cache (§5.1), de leveler en de load (die hun inline-lookup vervangen).

### 4.2 Persistentie & snapshot — delta

De registry zit al volledig door snapshot/payload/history (geverifieerd, rapport §1.7):
`Snapshot.resourceCalendars` (`snapshot.ts:19/43`), history-restore met `?? s.resourceCalendars`-fallback
(`historySlice.ts:25/53`), document-payload `resourceCalendars` (`documentSlice.ts:40/122`). Delta voor
2.8a:

- Hernoem het snapshot/payload-veld `resourceCalendars` → `calendars`. **Lees-alias behouden**: oude
  bestanden/payloads met `resourceCalendars` worden bij hydrateren gelezen als `p.calendars ??
  p.resourceCalendars ?? []` (geen migratiescript; oude documenten laden ongewijzigd).
- `project.calendarId` rijdt al mee in het `project`-veld (payload) — geen extra plumbing.
- `Task.calendarId` rijdt mee in `tasks` (snapshot/payload bevatten al de volledige `tasks`).
- Kalender-`generation`-metadata rijdt mee in de kalender-objecten zelf.

### 4.3 Migratie: inline projectkalender → bibliotheek-entry "Projectkalender"

Bij het **laden** van een bestaand document (of het promoveren van de huidige in-memory staat):

1. Als er nog geen bibliotheek-entry met `project.calendarId` bestaat, wordt de geladen `s.calendar` als
   entry aan `s.calendars` toegevoegd onder naam **"Projectkalender"** (id = `project.calendarId`, doorgaans
   `'cal-default'`). Zo wordt de tot nu toe inline projectkalender de eerste bibliotheek-entry.
2. `s.calendar` blijft als gedenormaliseerde cache verwijzen naar die entry (§4.1).
3. Oude bestanden zonder benoemde kalenders laden ongewijzigd qua gedrag: hun projectkalender wordt
   zichtbaar in de bibliotheek maar de datums/round-trip veranderen niet.

**Geen stille hergeneratie**: als de geladen projectkalender letterlijke feestdagen heeft (geen
`generation`-metadata, bv. een oud bestand met ingebakken bouwvak), blijven die exact zoals ze zijn. De
gebruiker kan desgewenst via de dialoog opnieuw genereren (§4.4) — dat is een expliciete actie.

### 4.4 Materialisatie + hergeneratie (geen stille mutaties)

Bij **projectaanmaak** (wizard, §7) materialiseert de engine de feestdagen als concrete
`Holiday[]`-exception-ranges in de kalender, en zet `calendar.generation`
(ruleSetId/region/breakChoice/generatedFromYear/generatedToYear). Zo weet het systeem wélke regelset de
datums voortbracht. **Concrete spanne bij aanmaak**: op dat moment bestaat er nog geen projecteinde —
de wizard genereert daarom **startjaar−1 t/m startjaar+3** (vier jaar dekking + één jaar terug voor
constraints in het verleden). Groeit het project later voorbij `generatedToYear`, dan grijpt het
hergeneratie-hint-regime hieronder; bij hergeneratie mét bekend projecteinde wordt de spanne
projectstart−1 t/m projecteinde+1.

**Hergeneratie is een expliciete gebruikersactie**, nooit stil:
- Wijzigt de gebruiker de projectperiode zodat hij buiten `[generatedFromYear..generatedToYear]` valt, dan
  toont de kalender-dialoog/wizard een hint "Feestdagen dekken 2026–2028; projectperiode loopt tot 2029 —
  opnieuw genereren?" met een knop. Pas op die knop wordt `holidays` opnieuw gematerialiseerd (over de
  nieuwe spanne) en `generation` bijgewerkt.
- Kalenders **zonder** `generation` (letterlijk/legacy) krijgen geen automatische hint en worden nooit
  aangeraakt.

Dit voldoet aan de eis "gematerialiseerd + regelset-id op de kalender, her-generatie bij
projectperiode-wijziging als expliciete gebruikersactie, geen stille mutaties".

---

## 5. CPM-wijzigingen (per-taak-kalender)

### 5.1 Engine-cache i.p.v. één engine

`runCPM` (`scheduleSlice.ts:53-63`) instantieert vandaag **één** `CalendarEngine(s.calendar)` (`:56`) en
geeft die aan `CPMSolver` (`:59`). 2.8a vervangt dat door een resolver + cache, patroon
`ResourceLeveler.ts:105-110`:

```ts
// in runCPM, i.p.v. de enkele calEngine:
const projectCal = s.calendar; // gedenormaliseerde default (§4.1)
const solver = new CPMSolver(leafTasks, s.sequences, projectCal, s.calendars, {
  dataDate: s.project.statusDate, progressMode: s.project.progressMode,
});
```

In `CPMSolver`: een `Map<string, CalendarEngine>` gevuld via `resolveCalendar(calendarId, registry,
projectCal)`. Sleutel = de effectieve kalender-id (of een sentinel voor de projectdefault). Een
`calendarFor(task): CalendarEngine`-helper vervangt de losse `this.calendar`:

```ts
private engineCache = new Map<string, CalendarEngine>();
private engineFor(cal: WorkCalendar): CalendarEngine {
  let e = this.engineCache.get(cal.id);
  if (!e) { e = new CalendarEngine(cal); this.engineCache.set(cal.id, e); }
  return e;
}
private calendarFor(task: Task): CalendarEngine {
  return this.engineFor(resolveCalendar(task.calendarId, this.registry, this.projectCal));
}
```

De **projectdefault-engine** blijft als `this.projectEngine` bestaan (voor kalenderloze grenslogica en de
projectstart-ondergrens). Bij `dataDate === undefined` en zonder afwijkende taak-kalenders is het gedrag
identiek aan vandaag (regressie-vangnet).

**Instantiatie-sweep — álle `new CPMSolver`-plekken migreren mee** (geverifieerd via grep; de
constructor-signatuur verandert, dus dit is een compile-gedwongen maar semantisch kritieke lijst):

| Plek | Rol | Wijziging |
|---|---|---|
| `scheduleSlice.ts:59` | de echte solve (`runCPM`) | zoals hierboven: `projectCal + s.calendars` |
| `ResourceLeveler.ts:139` | **baseline-solve** van de leveler | zelfde registry doorgeven |
| `ResourceLeveler.ts:288` | **trial-solve** (preview-iteraties!) | zelfde registry doorgeven |
| `ResourceLeveler.ts:414` | finale leveler-solve | zelfde registry doorgeven |

De drie leveler-plekken gebruiken vandaag alleen `projEngine` — als die niet meegaan, rekent de
nivelleer-**preview** met de oude één-kalender-aanname terwijl de echte solve multi-kalender is: een
preview-eerlijkheids-regressie tegen het 2.5-principe (preview == apply). `levelResources`/de leveler-API
krijgt daarom de registry (`s.calendars`) als parameter naast de al bestaande `resourceCalendars`-input
(die na §4.1 dezelfde array ís). Testdekking: §10.1 (leveler-multi-kalender-case).

### 5.2 Waar de taak-kalender rekent — en waar de lag-kalender

Elke `this.calendar.…`-aanroep die over de **duur of de constraints van een táák** gaat, gebruikt de
kalender van díé taak:

- **Duur** (forward `addWorkDays` op de taak-EF, `CPMSolver.ts:369`; backward `subtractWorkDays`, `:661`;
  actuals-snaps) → `calendarFor(task)`.
- **Float-tellingen** (`workDaysBetween`, `:426-427/:516/:759`) → per taak in diens eigen kalender
  (P6-semantiek: float van een taak in **werkdagen van zijn eigen kalender**).
- **Milestone-grenslogica** (`:555-568`) blijft kalenderloos.
- **De projectstart-ondergrens** en de finale `nextWorkDay`-snap van een taak-earlyStart in `forwardPass`
  → `calendarFor(task)` (de taak start alleen op een werkdag van zíjn kalender).

**Lag-regel — de subtielste plek (`getForwardConstraint`, `:538-621`).** Vandaag gebruikt die functie één
`cal = this.calendar` (`:554`) voor zowel de lag als de succBack-aftrek. Bij twee kalenders splitst dit:

- De **lag telt in de kalender van de VOORGANGER** (P6-default). Interne constante met named export:
  ```ts
  // src/engine/scheduler/lagCalendar.ts
  /** P6-default: "Calendar for scheduling Relationship Lag" = predecessor-kalender.
   *  De instelbare scheduling option is bewust fase 2.9 (TODO.md r217). Bron-onzekerheid: het rapport
   *  vond tegenstrijdige bronnen over de fabrieksdefault (Ten Six + planner-fora: predecessor; één
   *  zoekresultaat: successor). Beste inschatting = predecessor; hier vastgelegd, in 2.9 instelbaar. */
  export const LAG_CALENDAR: 'predecessor' | 'successor' = 'predecessor';
  ```
  De `getForwardConstraint`-takken passen de lag (`addWorkingDaysSigned`/`nextWorkDay` voor `ELAPSEDTIME`)
  toe op de **predecessor-engine**.
- De **succBack** (finish→start-afleiding van de opvolger, `:558/:591/:601`) en de finale start-snap
  tellen in de **successor-kalender** (`calendarFor(successor)`).
- Snaps aan de predecessor-zijde die de finish-grens definiëren (`nextWorkDayAfter(predResult.ef)`, `:617`)
  gebruiken de **predecessor-engine** (P6 neemt de predecessor-finish als gegeven); de resulterende
  ondergrens wordt door `forwardPass` op de **successor-kalender** gesnapt.
- `ELAPSEDTIME`-lag blijft 24/7 (kalender-onafhankelijk, bestaand gedrag `:575-576/:611-613`).

`getForwardConstraint` krijgt dus twee engines mee (pred + succ) i.p.v. één `this.calendar`. De signatuur
wordt `getForwardConstraint(predResult, predTask, seq, successor, predEng, succEng)`.

**Backward pass — spiegelbeeldig, zelfde kalender-toewijzing.** De backward pass (`backwardPass`,
`CPMSolver.ts:623+`, spiegelpaden `:681-729`) leidt uit de successor-LS een bovengrens op de
voorganger-LF af en moet exact dezelfde kalender-splitsing **spiegelen** — anders telt forward een ander
werkdag-raster dan backward en wordt float asymmetrisch (scenario 3's float zou dan alleen toevallig
kloppen). Normatief:

- De **lag** telt óók terug in de **voorganger-kalender** (dezelfde `LAG_CALENDAR`-constante, gespiegeld:
  `addWorkingDaysSigned(…, -lag)` op de **predecessor-engine**; `ELAPSEDTIME` blijft 24/7 met de
  richtingbewuste `prevWorkDay`-snap, bestaand patroon `CalendarEngine.ts:119-131`).
- De **FS-gap-spiegel** (`prevWorkDayBefore`, spiegel van `nextWorkDayAfter`, `CalendarEngine.ts:134-146`)
  telt in de **predecessor-kalender** — dezelfde engine die forward de finish-grens definieerde.
- De **duur-aftrek** (`LS = subtractWorkDays(LF, dur)`, `:661`) telt in de **taak-eigen kalender**
  (`calendarFor(task)`), en de finale **LF-snap** van een taak snapt op de kalender van de **taak zelf**
  (een taak kan alleen eindigen op een werkdag van zíjn kalender).

De spiegelpaden krijgen dus dezelfde twee engines (pred + succ) als `getForwardConstraint`. De
LS/LF/TF-handberekeningen in §5.3 en de asserts in §10.1 leggen deze symmetrie vast.

### 5.3 Drie handberekende multi-kalender-scenario's

Alle scenario's: **twee kalenders zonder feestdagen** — `Cal-MF` (ma–vr, `workDays [1..5]`) en `Cal-7`
(7-daags, `workDays [1..7]`). Weekdagen geverifieerd met `date` (juli 2026: ma 6, do 9, vr 10, za 11,
zo 12, ma 13, di 14, wo 15, do 16, vr 17, za 18, ma 20). Conventie: `earlyFinish = addWorkDays(earlyStart,
duration)` telt de startdag als dag 1 (`CalendarEngine.ts:65`); FS(0)-opvolger start op de eerstvolgende
werkdag ná de voorganger-finish (`nextWorkDayAfter`). `LAG_CALENDAR = 'predecessor'`.

---

**Scenario 1 — de mandaat-case: 5d-taak op ma-vr → opvolger op 7-dagen met FS+2d lag.**
`P` (Cal-MF, dur 5), `S` (Cal-7, dur 4), relatie `P →FS+2 S`.

| Stap | Berekening | Resultaat |
|---|---|---|
| P.ES | gegeven (ma 6 jul) | **ma 6 jul** |
| P.EF | Cal-MF.addWorkDays(ma 6, 5) = ma,di,wo,do,vr | **vr 10 jul** |
| FS-gap | Cal-MF(pred).nextWorkDayAfter(vr 10) — slaat za 11/zo 12 over | ma 13 jul |
| + lag 2 (pred-kalender) | Cal-MF.addWorkingDaysSigned(ma 13, 2) = ma→di→wo | wo 15 jul |
| S.ES (snap succ) | Cal-7.nextWorkDay(wo 15) = wo 15 (elke dag werkdag) | **wo 15 jul** |
| S.EF | Cal-7.addWorkDays(wo 15, 4) = wo,do,vr,za | **za 18 jul** |

Toont: de lag telt in de **ma-vr-kalender van de voorganger** (weekend overgeslagen), maar de duur van S
loopt door het weekend heen in de 7-dagen-kalender (za 18 is een werkdag voor S).

*Backward (handberekend, spiegel §5.2)* — projecteinde za 18:

| Stap | Berekening | Resultaat |
|---|---|---|
| S.LF / S.LS | LF = za 18; Cal-7.subtractWorkDays(za 18, 4) = za,vr,do,wo | **za 18 / wo 15** — TF_S = 0 |
| lag terug (pred-kalender) | Cal-MF.addWorkingDaysSigned(S.LS wo 15, −2) = di 14 → ma 13 | ma 13 |
| FS-gap-spiegel (pred-kalender) | Cal-MF.prevWorkDayBefore(ma 13) — slaat zo 12/za 11 over | vr 10 |
| P.LF / P.LS | LF = vr 10; Cal-MF.subtractWorkDays(vr 10, 5) = vr,do,wo,di,ma | **vr 10 / ma 6** — TF_P = 0 |

Beide taken kritiek (TF 0) — forward en backward tellen hetzelfde raster, dus het kritieke pad sluit.

---

**Scenario 2 — waarom de lag-kalender-constante ertoe doet (predecessor eindigt op vrijdag).**
`P` (Cal-7, dur 5, ES ma 6 → EF vr 10), `S` (Cal-MF, dur 3), relatie `P →FS+2 S`.

| | Predecessor-kalender-lag (**gekozen**, Cal-7) | Successor-kalender-lag (MSP-stijl, Cal-MF) |
|---|---|---|
| FS-gap na EF vr 10 | Cal-7.nextWorkDayAfter(vr 10) = **za 11** | Cal-MF.nextWorkDayAfter(vr 10) = **ma 13** |
| + lag 2 | Cal-7.addWorkingDaysSigned(za 11, 2) = za→zo→ma = **ma 13** | Cal-MF.addWorkingDaysSigned(ma 13, 2) = ma→di→wo = **wo 15** |
| S.ES (snap Cal-MF) | nextWorkDay(ma 13) = **ma 13** | nextWorkDay(wo 15) = **wo 15** |
| S.EF | Cal-MF.addWorkDays(ma 13, 3) = ma,di,wo = **wo 15** | Cal-MF.addWorkDays(wo 15, 3) = wo,do,vr = **vr 17** |

**2 werkdagen verschil** (S.ES ma 13 vs. wo 15) omdat de 7-dagen-voorganger-kalender het weekend als
lag-dagen telt en de ma-vr-kalender ze overslaat. Dit is precies de keuze die `LAG_CALENDAR` vastlegt; de
testbatterij (§10) legt de gekozen tak vast, de counterfactual-kolom staat er ter documentatie.

---

**Scenario 3 — merge van twee voorgangers op verschillende kalenders + float per kalender.**
`A` (Cal-MF, dur 4, ES ma 6 → EF do 9), `B` (Cal-7, dur 7, ES ma 6 → EF zo 12), `C` (Cal-7, dur 3),
relaties `A →FS+0 C` en `B →FS+0 C`.

| Constraint op C | Berekening | Ondergrens |
|---|---|---|
| via A (pred Cal-MF) | Cal-MF.nextWorkDayAfter(do 9) = vr 10; +lag 0 | vr 10 jul |
| via B (pred Cal-7) | Cal-7.nextWorkDayAfter(zo 12) = ma 13; +lag 0 | ma 13 jul |
| C.ES = max, snap Cal-7 | max(vr 10, ma 13) = ma 13; Cal-7.nextWorkDay = ma 13 | **ma 13 jul** |
| C.EF | Cal-7.addWorkDays(ma 13, 3) = ma,di,wo | **wo 15 jul** |

Projecteinde wo 15. **Float per kalender**: B drijft de merge → B kritiek. A heeft speling gemeten in
**A's eigen ma-vr-kalender**: backward geeft `LS_C = ma 13`, dus A's laatste toegestane finish is vr 10
(Cal-MF.nextWorkDayAfter(vr 10)=ma 13=LS_C). Total float A = Cal-MF.workDaysBetween(do 9, vr 10) − 1 = **1
MF-werkdag**. Toont: max-merge over voorgangers op verschillende kalenders, successor-ES gesnapt op de
successor-kalender, en float in de eigen kalender-eenheid van elke taak.

*Backward volledig (handberekend, spiegel §5.2)* — projecteinde wo 15:

| Taak | Berekening | LS – LF | TF |
|---|---|---|---|
| C | LF = wo 15; Cal-7.subtractWorkDays(wo 15, 3) = wo,di,ma | **ma 13 – wo 15** | **0** (kritiek) |
| B | lag 0 terug in pred-kalender Cal-7: prevWorkDayBefore(C.LS ma 13) = zo 12; Cal-7.subtractWorkDays(zo 12, 7) = zo,za,vr,do,wo,di,ma | **ma 6 – zo 12** | **0** (kritiek) |
| A | lag 0 terug in pred-kalender Cal-MF: prevWorkDayBefore(ma 13) = vr 10; Cal-MF.subtractWorkDays(vr 10, 4) = vr,do,wo,di | **di 7 – vr 10** | **1 MF-werkdag** |

De FS-gap-spiegel per voorganger-kalender is hier zichtbaar: dezelfde `C.LS = ma 13` levert B (Cal-7) een
LF van **zo 12** en A (Cal-MF) een LF van **vr 10** — elk in de eigen voorganger-kalender.

### 5.4 Refresh: kalenderwijzigingen zijn datum-beïnvloedend

Kalenderwijzigingen (bibliotheek-CRUD die een gebruikte kalender raakt, project-default-switch,
taak-kalender-toewijzing) zetten `s.scheduleStale = true` (bestaand F5-regime), zodat ze samenwerken met
de auto-bereken-toggle (2.7). Resource-kalender-mutaties die géén taak-datums raken (een kalender die
alleen aan resources hangt) hoeven geen `scheduleStale` — maar in de gedeelde bibliotheek is dat
onderscheid duur; 2.8a zet conservatief `scheduleStale` bij elke bibliotheek-mutatie behalve pure
naamswijzigingen. Bij een actieve auto-bereken herrekent runCPM dan vanzelf (2.7-precedent).

---

## 6. Rendering (GanttRenderer)

### 6.1 Arcering blijft op de projectdefault-kalender

De renderer krijgt `calendar: WorkCalendar` in opts (`GanttRenderer.ts:15`) en bouwt zijn eigen
`holidaySet` (`:109/:131-137`); de kolom-arcering (`:181-200`) tekent per niet-werkdag een volle kolom in
`gridWeekend`-kleur over de volledige canvashoogte, gebaseerd op **uitsluitend de projectkalender**
(`GanttCanvas.tsx:83` geeft `s.calendar` door). **Dit blijft zo in 2.8a** — de globale kolom-arcering
volgt de projectdefault-kalender (MSP-gedrag). Per-rij-arcering op afwijkende taak-kalenders is bewust
**later** (§13): het vergt een `calendarId` per rij in de renderer en is de duurste render-wijziging;
kosten/baten wegen niet op tegen 2.8a.

### 6.2 Naamlabel bij meerdaagse feestdagblokken (2.5-QA)

Nieuw en gevraagd (rapport §1.8): naast de `holidaySet` houdt de renderer de bron-`Holiday[]` bij (naam +
range; al aanwezig in `opts.calendar.holidays`). In een pass ná de grid-lus (`:200`): voor elk
feestdagblok breder dan ~3×zoom px de **naam** in de arceringszone tekenen (verticaal/horizontaal
afhankelijk van breedte), in een gedempte kleur. Zo ziet de gebruiker dat er bv. drie weken bouwvak in de
planning zit — de directe aanleiding uit de fase-2.5-QA (een 5-daagse taak leek een "opgerekte balk van
vier weken", TODO.md r188-189). Alle info zit al in `opts.calendar.holidays`; geen nieuwe data nodig.

---

## 7. Wizard + UI

### 7.1 Kalender-bibliotheek beheren — `CalendarDialog`/`CalendarForm`

`CalendarDialog.tsx` (65 r) is een dun draft-schilletje om `CalendarForm.tsx` (191 r, presentational,
store-loos). 2.8a bouwt `CalendarDialog` uit tot een **lijst + bewerken**:
- Links een lijst van bibliotheek-kalenders (`s.calendars`), met "actief"/projectdefault-markering
  (`project.calendarId`), nieuw/dupliceer/verwijder.
- Rechts de bestaande `CalendarForm` voor de geselecteerde kalender (naam, werkdag-toggles 1–7, uren,
  feestdagen-CRUD — allemaal bestaand).
- Nieuw in `CalendarForm`: een **"Feestdagen genereren…"**-knop die de land/regio/bouwvak-generator opent
  (dezelfde als de wizard, §7.2) en de gegenereerde `holidays` + `generation`-metadata in de kalender zet
  — óók voor bestaande projecten (niet alleen de wizard; analoog aan de 3-surfaces-gedachte). Bij een
  kalender mét `generation` buiten de projectperiode: de hergeneratie-hint (§4.4).
- Apply blijft `setCalendar`/`updateCalendar` + (voor de projectdefault) `runCPM` (`CalendarDialog.tsx:23-27`).

### 7.2 Wizard (`ProjectInfoDialog`) — land/regio + bouwvak + preview

De huidige kalender-UI is één `Select` met 3 jaargebonden presets (`ProjectInfoDialog.tsx:35/69-73/130-136`
uit `projectTemplates.ts:51-62`, `CalendarPreset = 'nl-bouw' | 'nl-feestdagen' | 'geen'`, default
`'nl-bouw'` mét bouwvak — strijdig met de harde eis). Vervangen door (rapport §2.4):

1. **Land/set-dropdown** (NL default; bij DE → tweede dropdown Bundesland; bij UK → landsdeel; bij CH →
   kanton; "Geen feestdagen"; "Aangepast…" opent na aanmaken `CalendarDialog`).
2. **NL-bouwvak** — aparte segmented control/dropdown *Geen / Noord / Midden / Zuid*, **default Geen**
   (harde eis). Alleen tonen bij land = NL.
3. **Vaste winterstop** — checkbox (default uit), met de "werkelijk vorstverlet volgt later"-hint (§3.5).
4. **Preview** — géén volle lijst; één samenvattingsregel ("11 feestdagen + winterstop, 2026–2028") met
   een uitklap/hover die de gegenereerde lijst in een klein scrollpaneel toont (hergebruik de
   holiday-tabel-markup van `CalendarForm`). Zo ziet de gebruiker vooraf dat er (of juist géén) bouwvak in
   de planning komt.

De wizard roept `generateHolidays`/`generateRegionalBreak`/`generateWinterStop` voor de aanmaak-spanne
startjaar−1 t/m startjaar+3 (§4.4), materialiseert naar de nieuwe projectkalender-entry en zet
`generation`. `projectTemplates.ts`
wordt de generator-parameters (land/regio/bouwvak/winterstop) i.p.v. de vaste presets; de default is "NL
zónder bouwvak".

### 7.3 Taak-kalender-keuze

`Task.calendarId` bewerkbaar in:
- **`TaskPropertiesPanel`**: een `<Select>` "Kalender" (opties = bibliotheek-kalenders + "Projectkalender"
  = `undefined`), naast de bestaande taakvelden. Wijziging → nieuwe actie `setTaskCalendar(taskId, id |
  undefined)` (dwingt niets af, zet alleen `calendarId` + `scheduleStale` + undo-snapshot).
- **`TaskDialog`**: hetzelfde veld.

Bouwvak-adviesdatum-hint ("adviesdatums, controleer bij Bouwend Nederland") toont bij een bouwvak-keuze in
zowel wizard als `CalendarForm`.

---

## 8. IFC + adapters

### 8.1 IFC-reader-gat dichten (`ifcReader.ts:739-759`)

`buildCalendarFromEntity` (`:739`) leest náám/omschrijving/exceptions, maar **workDays/uren komen uit
`createDefaultCalendar()`** (`:740`, bewuste beperking `:735-738`) — een 6/7-daagse kalender overleeft de
round-trip nu niet (workDays reset naar ma–vr). 2.8a dicht dit: `IFCRECURRENCEPATTERN` (`.WEEKLY.` met
dagnummers) en `IFCTIMEPERIOD` (start/eind-uur) **wél teruglezen** naar `workDays`/`workStartHour`/
`workEndHour`/`hoursPerDay`. De writer schrijft dit al spec-conform (`ifcWriter.ts:462-468`); risico laag,
bewaakt door golden-rule-round-trip-tests op de bestaande examples.

### 8.2 Meerdere benoemde kalenders + taak→kalender

- **Schrijven**: `writeResourceCalendars` (`ifcWriter.ts:490-506`) schrijft al per registry-entry een
  `IFCWORKCALENDAR` + `IFCRELASSIGNSTOCONTROL` naar de resources. Generaliseren naar de gedeelde
  bibliotheek. **Taak→kalender**: per taak met `calendarId` een `IFCRELASSIGNSTOCONTROL` (RelatingControl =
  de kalender, RelatedObjects = de taken) — hetzelfde mechanisme (`:503`). Golden rule: taken zonder eigen
  kalender krijgen géén rel; bestanden zonder taak-kalenders blijven byte-identiek.
- **Lezen**: `extractResourceCalendars` (`:770-802`) onderscheidt taken vs. resources al via
  `resourceStepIdMap` (`:788-790`: "target waren taken, geen resources" wordt nu overgeslagen). De
  taak-tak toevoegen is symmetrisch: relaties waarvan de objecten táken zijn → `task.calendarId`. De
  "eerste `IFCWORKCALENDAR` = projectkalender"-conventie (`extractCalendar` `:222-226`) blijft, mits de
  writer de projectkalender eerst schrijft (documenteren).
- **Regelset-id/bouwvak-keuze**: `calendar.generation` in een **OPS-pset op de kalender** (patroon
  `OPS_ProjectSettings`/`OPS_StructureMeta`, `ifcWriter.ts:237-253`): `IFCPROPERTYSINGLEVALUE`s voor
  `RuleSetId`/`Region`/`BreakChoice`/`WinterStop`/`GeneratedFromYear`/`GeneratedToYear` +
  `IFCRELDEFINESBYPROPERTIES` naar de `IFCWORKCALENDAR`. Alleen geschreven wanneer `generation` bestaat
  (golden rule). Reader: nieuw pset-leespad → `calendar.generation`.
- **Legacy-lezer expliciet**: kalenders zonder de pset laden als `generation: undefined` (letterlijk,
  nooit hergenereren, §4.3). Golden rule: geen benoemde kalenders/taak-kalenders/generation ⇒ geen extra
  entiteiten ⇒ byte-identieke round-trip.

### 8.3 Adapters (MSPDI / P6 / CSV)

- **MSPDI** (rijkste pad): `writeCalendarBlock` (`mspdiWriter.ts:77-127`) schrijft al `<WeekDays>` mét
  Exceptions; projectkalender UID 1, resource-kalenders UID 2+ (`:173-187`). **Taken**: het hardcoded
  `<CalendarUID>1</CalendarUID>` (`:238`) wordt de effectieve taak-kalender-UID (MSPDI ondersteunt
  taak-kalenders native via dit element). Reader (`:100-116/:138-151`): `CalendarUID>1` → registry +
  `task.calendarId`/`resource.calendarId`.
- **P6-XML**: writer schrijft `<Calendar>`-blokken maar mager (`p6xmlWriter.ts:136-158`: alleen Name/
  HoursPerDay, **geen** `<StandardWorkWeek>`/`<HolidayOrExceptions>`); resources `<CalendarObjectId>`
  (`:169-170`); **taken hardcoded `<CalendarObjectId>1</CalendarObjectId>`** (`:256`) — het slot bestaat
  al. 2.8a: `StandardWorkWeek` + `HolidayOrExceptions` (exceptions) erbij schrijven/lezen zodat werkdagen/
  feestdagen round-trippen; per-activity `CalendarObjectId` = de taak-kalender. Uur-details blijven 2.8b.
- **CSV**: bewust kalenderloos (`csvWriter.ts:39` negeert `_calendar`; `csvReader.ts:334` retourneert
  `createDefaultCalendar()`). Zo laten.

### 8.4 Verliesmatrix

| Concept | IFC 4.3 | MSPDI | P6-XML | CSV |
|---|---|---|---|---|
| workDays (werkweek) | `IFCRECURRENCEPATTERN` (nu teruggelezen) | `<WeekDays>` (native) | `<StandardWorkWeek>` (nieuw) | **verlies** (bewust) |
| Feestdagen/exceptions | `IFCWORKTIME`-ranges (native) | `<Exceptions>` (native) | `<HolidayOrExceptions>` (nieuw) | **verlies** (bewust) |
| Uren (`workStart/EndHour`,`hoursPerDay`) | `IFCTIMEPERIOD` (nu teruggelezen; uur-scheduling = 2.8b) | HoursPerDay (native) | HoursPerDay (native) | **verlies** |
| Meerdere benoemde kalenders | meerdere `IFCWORKCALENDAR` (native) | UID 1..n (native) | Calendar ObjectId 1..n (native) | **verlies** |
| `task.calendarId` | `IfcRelAssignsToControl` (native) | `<Task><CalendarUID>` (native) | `<CalendarObjectId>` (native) | **verlies** |
| `calendar.generation` (regelset/bouwvak) | `OPS_Calendar`-pset (verliesloos) | **verlies** (geen MSP-equivalent) | **verlies** | **verlies** |
| Bouwvak als datums | `IFCWORKTIME`-ranges (native) | `<Exceptions>` (native) | `<HolidayOrExceptions>` (nieuw) | **verlies** |

Alleen IFC is verliesloos voor het volledige 2.8a-model (incl. de regelset-herkomst); MSPDI is de rijkste
interop (werkweek + exceptions + taak-kalenders), P6 best-effort (exceptions ja, uur-details 2.8b), CSV
bewust plat.

---

## 9. Store / undo

### 9.1 Snapshot & payload — delta

Zoals §4.2: `resourceCalendars` → `calendars` (met lees-alias). `Snapshot`/`DocumentPayload`/`history`/
`capturePayload`/`hydratePayload`/`freshPayload`/`payloadFromInput` volgen exact het bestaande
`resourceCalendars`-pad (`snapshot.ts:19/43`, `historySlice.ts:25/53`, `documentSlice.ts:40/122`). Extra:
`project.calendarId` (rijdt mee in `project`), `Task.calendarId` (rijdt mee in `tasks`),
`calendar.generation` (in de kalender-objecten).

**De `s.calendar`-cache zit NIET in `Snapshot`** (geverifieerd: `snapshot.ts` bevat `resourceCalendars`
maar geen `calendar`-veld — het setCalendar-precedent: de projectkalender is nooit undoable geweest,
`projectSlice.ts:107-112`). De bibliotheek (`calendars`) zit er ná 2.8a wél in en ís undoable (§9.2).
Gevolg zonder maatregel: undo van `updateCalendar` op de default-entry herstelt `calendars`, maar laat de
gedenormaliseerde `s.calendar` op de gemuteerde versie staan — een gebroken invariant (§4.1).

**Normatieve regel** (geen implementatiedetail): `historySlice.undo`/`redo` en
`hydratePayload`/`switchDocument` roepen **ná elke restore altijd `syncProjectCalendar(s)`** aan — de
centrale helper die `s.calendar` gelijkzet aan `s.calendars.find(c => c.id === s.project.calendarId)`
(fallback: huidige `s.calendar` als de entry ontbreekt, bv. pre-2.8a-snapshot). Dezelfde helper draait na
bibliotheek-CRUD en de default-switch. Zo is de invariant op élk restore-pad afgedwongen, niet alleen bij
gewone mutaties (zie ook risico §12.3).

### 9.2 Bibliotheek-CRUD undoable

`addCalendar`/`updateCalendar`/`removeCalendar` pushen elk één undo-snapshot (bestaand
`addResourceCalendar`-patroon `resourceSlice.ts:165-201`, geverifieerd). `removeCalendar` zet dangling
`task.calendarId`/`resource.calendarId` terug op `undefined` en, als het de `project.calendarId` was, de
projectdefault op een fallback (eerste bibliotheek-entry of een verse `createDefaultCalendar()`), alles in
dezelfde snapshot.

### 9.3 Project-default-switch niet-undoable (bewuste asymmetrie)

De **project-default-switch** (`setCalendar`/een nieuwe `setProjectCalendar(id)`) volgt het bestaande
`setCalendar`-precedent (`projectSlice.ts:107-112`): `isDirty` + `scheduleStale`, **géén** undo-snapshot.
Dit is dezelfde asymmetrie als in 2.6 (§10.3 van het baselines-doc: `setStatusDate`/`setProgressMode` óók
niet-undoable, project-metadata zit niet in `Snapshot`). Consistent gedocumenteerd: bibliotheek-CRUD rolt
undo-baar terug, de default-verwijzing niet (undo van "andere default gekozen" = handmatig terugzetten +
F5). Het alternatief — heel `project` in `Snapshot` — is een gedragswijziging buiten 2.8a-scope; afgewezen,
net als in 2.6.

---

## 10. Testplan

`tests/planning/` (eigen harness, `run.sh` bundelt tegen de échte store + solver; 280 cases op moment van
schrijven). De harness ondersteunt al een project-`calendar`-override (`harness.ts:9/179-183`) en
**per-resource kalenders** (`:19-21/195-196`). Uitbreiden:

### 10.1 `cases-kalenders.json` (multi-kalender-CPM)

- **Harness-delta**: `tasks[].calendar` (per-taak-kalender), naast de bestaande `calendar`- en
  resource-kalender-overrides. `buildAndSolve` zet `task.calendarId` en registreert de kalender in
  `s.calendars` vóór `runCPM`.
- **BRIEF.md-regel** (vóór de finder-agents cases schrijven): de lag-kalender-conventie expliciet —
  *"relatie-lag telt in de kalender van de VOORGANGER (`LAG_CALENDAR = 'predecessor'`); succBack en de
  successor-start-snap tellen in de successor-kalender; `ELAPSEDTIME` blijft 24/7."* Plus de
  `caldict.mjs`-werkdagtabel uitbreiden met meerdere kalender-sets voor het onafhankelijke narekenen.
- **Cases** (handberekend, §5.3, forward én backward): Scenario 1 (FS+2, MF→7-dagen): assert S.ES wo 15/
  S.EF za 18 **én de backward-zijde** — S.LS wo 15/S.LF za 18/TF_S 0, P.LS ma 6/P.LF vr 10/TF_P 0, beide
  kritiek (legt de §5.2-spiegelsymmetrie vast). Scenario 2 (predecessor-kalender-lag): assert S.ES ma 13 —
  met een expliciete comment die de successor-kalender-counterfactual wo 15 noemt zodat een latere
  2.9-optie-implementatie het verschil ziet. Scenario 3 (merge): assert C.ES ma 13/C.EF wo 15 **én** de
  volledige backward-tabel — C.LS ma 13/C.LF wo 15/TF 0, B.LS ma 6/B.LF zo 12/TF 0 (kritiek), A.LS di 7/
  A.LF vr 10/TF 1 (in MF-werkdagen). Plus:
  - **Geen taak-kalender = no-op**: dezelfde netwerken zónder `task.calendarId` → es/ef identiek aan de
    projectkalender-only-run (regressiebewijs backwards-compat, patroon 2.6 §12.1).
  - **SS/FF/SF met verschillende kalenders**: elk één case die succBack op de successor-kalender aantoont.
  - **Leveler-multi-kalender (preview == apply)**: een taak mét eigen kalender in een overbelaste
    resource-situatie wordt genivelleerd → de leveling-**preview** (trial-solve `ResourceLeveler.ts:288`)
    en de toegepaste solve (`runCPM` na apply) geven identieke datums. Bewaakt dat alle vier de
    `new CPMSolver`-plekken (§5.1-sweep) dezelfde registry kregen — het 2.5-preview-eerlijkheids-principe.

### 10.2 Holiday-generator-checks

Losse assert-cases (in de harness of een klein `holidays`-checkbestand): Pasen-jaartabel (bekende jaren),
Koningsdag-zondagregel (jaar waarin 27/4 op zondag valt → 26/4), UK-substituties (Nieuwjaar/Boxing Day op
weekend → maandag/dinsdag), Buß- und Bettag (`weekday-before 11/23 wo`), `nth-weekday` (last Monday May).

### 10.3 Round-trip & wizard

- **Golden-rule-round-trip** voor kalenders in IFC/MSPDI/P6: een 7-daagse en een taak-kalender-bestand →
  laden → schrijven → byte-identiek (IFC) resp. semantisch gelijk; en de bestaande examples ongewijzigd
  (`verify:examples`).
- **Wizard-flow** via Playwright MCP + `window.__OPS__` (`devBridge.ts`, `CLAUDE.md` §self-test): bouwvak
  default "geen" aantoonbaar (nieuw project → `s.calendars`-projectkalender bevat géén bouwvak-holiday);
  bouwvak-keuze Noord → wél de 2026-tabeldatum.

**Regressie**: alle bestaande cases (280 op moment van schrijven) blijven groen — de nieuwe
multi-kalender-takken zijn no-ops zonder afwijkende taak-kalenders (§5.1), exact zoals de
2.6-forward-pass-takken no-ops waren zonder statusdatum.

---

## 11. i18n-sleutels (EN + NL)

Geen nieuwe namespace (2.5/2.6-precedent) — bestaande `menu`/`common`/`task` (`i18n/config.ts`). NL is de
bronwaarde; overige 12 talen later.

**`common`** (`calendar.*`-prefix, dialoog/wizard):
```
calendar.library.title          EN "Calendars"                 NL "Kalenders"
calendar.library.project        EN "Project calendar"          NL "Projectkalender"
calendar.library.new            EN "New calendar"              NL "Nieuwe kalender"
calendar.library.duplicate      EN "Duplicate"                 NL "Dupliceren"
calendar.library.setDefault     EN "Set as project default"    NL "Als projectdefault"
calendar.generate.button        EN "Generate holidays…"        NL "Feestdagen genereren…"
calendar.generate.country       EN "Country"                   NL "Land"
calendar.generate.region        EN "Region"                    NL "Regio"
calendar.generate.bouwvak       EN "Construction holiday"      NL "Bouwvak"
calendar.generate.bouwvak.none  EN "None"                      NL "Geen"
calendar.generate.bouwvak.noord EN "North"                     NL "Noord"
calendar.generate.bouwvak.midden EN "Central"                  NL "Midden"
calendar.generate.bouwvak.zuid  EN "South"                     NL "Zuid"
calendar.generate.winterStop    EN "Fixed winter shutdown"     NL "Vaste winterstop"
calendar.generate.winterHint    EN "Fixed shutdown; actual frost days come later from weather data"
                                 NL "Vaste winterstop; werkelijk vorstverlet volgt later uit weerdata"
calendar.generate.preview       EN "{n} holidays, {from}–{to}" NL "{n} feestdagen, {from}–{to}"
calendar.generate.bouwvakHint   EN "Advisory dates — verify with Bouwend Nederland"
                                 NL "Adviesdatums — controleer bij Bouwend Nederland"
calendar.regen.hint             EN "Holidays cover {from}–{to}; project runs to {year}. Regenerate?"
                                 NL "Feestdagen dekken {from}–{to}; project loopt tot {year}. Opnieuw genereren?"
calendar.regen.button           EN "Regenerate"                NL "Opnieuw genereren"
```

**`task`** (properties-panel + dialoog):
```
properties.calendar             EN "Calendar"                  NL "Kalender"
properties.calendar.project     EN "Project calendar"          NL "Projectkalender"
```

**`menu`** (wizard-veld, indien apart):
```
wizard.calendar.country         EN "Holiday set"               NL "Feestdagenset"
wizard.calendar.custom          EN "Custom…"                   NL "Aangepast…"
wizard.calendar.none            EN "No holidays"               NL "Geen feestdagen"
```

Feestdag-**namen** (Koningsdag, Karfreitag, …) blijven brontaal-strings in `holidays.ts` (zoals de 2.5
resource-kalender-feestdagen); i18n van feestdag-namen is een latere stap (consistent met 2.6 §13).

---

## 12. Openstaande risico's

1. **Lag-kalender-bron-onzekerheid.** Het rapport vond tegenstrijdige bronnen over P6's fabrieksdefault
   (Ten Six + planner-fora: predecessor; één zoekresultaat: successor). 2.8a kiest **predecessor** als
   constante en documenteert dat expliciet (§5.2); de instelbare option is 2.9. Mitigatie: de constante
   heeft een named export en de testbatterij legt de gekozen tak vast met de counterfactual ernaast, zodat
   2.9 alleen de constante hoeft te ontsluiten.
2. **Bouwvak-adviesdatums verouderen.** De datatabel dekt geverifieerde jaren; verre jaren vallen terug op
   de benadering. Mitigatie: expliciete "controleer bij Bouwend Nederland"-hint (§7.2/§7.3); de tabel is
   los onderhoudbaar.
3. **Gedenormaliseerde `s.calendar`-invariant.** `s.calendar` ≡ bibliotheek-entry `project.calendarId`
   moet bij élke mutatie (CRUD, default-switch, undo, hydrate, multi-doc-swap) in sync blijven. Risico op
   drift. Mitigatie: de **normatieve `syncProjectCalendar(s)`-regel in §9.1** (verplicht op alle
   restore-paden: undo/redo, hydratePayload, switchDocument, plus na CRUD/default-switch); de leesplekken
   migreren geleidelijk naar `resolveCalendar` zodat de cache uiteindelijk overbodig wordt.
4. **Per-taak-kalender vs. globale Gantt-arcering.** De kolom-arcering volgt alleen de projectkalender; een
   taak op een 7-daagse kalender toont visueel weekend-arcering onder zijn balk die voor die taak geen
   niet-werkdag is. Bewuste vereenvoudiging (§6.1); per-rij-arcering is later (§13). Benoemen in de UI/docs.
5. **IFC-reader-gat: regressierisico.** Werkdagen/uren teruglezen (`ifcReader.ts:739`) raakt het meest
   gevoelige round-trip-pad. Mitigatie: golden-rule-tests op de bestaande 9+ examples (letterlijke
   exception-ranges, `verify:examples`) bewaken byte-neutraliteit; de writer schrijft `IFCRECURRENCEPATTERN`
   al spec-conform, dus lezen is symmetrisch.
6. **P6 `StandardWorkWeek`/`HolidayOrExceptions` nieuw schrijven.** Wie echte P6-interop test kan
   afwijkingen vinden; 2.8a schrijft exceptions best-effort, uur-details 2.8b. Bij implementatie tegen een
   echt P6-export valideren vóór claims van volledige interop.
