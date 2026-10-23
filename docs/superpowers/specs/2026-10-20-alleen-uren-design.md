# Ontwerp: alleen uren — één tijdas in minuten voor alle taken en kalenders

- **Datum:** 2026-10-20.
- **Stand:** ontwerp; er is nog niets gebouwd. Besloten door de eigenaar op 2026-10-20: B1 (een maat per taak;
  de dagenmaat alleen in het OPS-profiel), B1a (standaardmaat dagenmaat in het OPS-profiel, vast werk altijd
  urenmaat), B2 (de schakelaar Urenplanning verdwijnt), B3 (rest exact), B4 (een datum toont alleen een tijd
  midden op de werkdag), B5 (berekenen en melden), B6 (losse mijlpaal aan het einde van de werkdag in het
  OPS-profiel), B7 (procentlag exact) en B8 ("d" is in het OPS-profiel de dagenmaat; de urenmaat staat in u).
  Besloten door de eigenaar op 2026-10-23 in het orkestratorgesprek: B9 = optie 1 (Duurweergave heeft in het
  OPS-profiel geen effect; elke taak toont zijn eigen maat, §3.12).
- **Review:** ronde 1 (GPT-6.1-Sol, Codex, reasoning xhigh; oordeel NEE) is verwerkt: de laadgrens en B5 (§5.2),
  de normalisatie en de markering (§3.6, §5.2), de adapters in de eerste release (§7), de belasting per werkdag
  (§3.11), de beperkte N1/N2 (§4.3), de statusregel (§4.2), `project.endDate` (§4.2), de eindsemantiek van
  kalendertijd (§4.2) en de vervolgpunten (§6, B2, B4, §5.4). Ronde 2 (zelfde reviewer; oordeel NEE) is
  verwerkt: het undocontract van B5 met twee snapshots (§5.2), de schrijfregel per kalender in IFC (§3.6, §5.4),
  de normalisatie van de vastlegging (§5.2), de B5-overgang op elke route die rekent (§5.2), de opslag van de
  lagmaat (§3.3), de vraag per kandidaat in de nivelleerder (§3.11), het baseline-einde bij kalendertijd (§4.2),
  de foutgrens van de lopers (§3.14) en twee tegenstrijdige teksten (§3.12, B8). Ronde 3 (zelfde reviewer; oordeel
  NEE) is verwerkt: de vóór-toestand van B5 is de modus "datums zoals opgeslagen", zodat Automatisch berekenen een
  Ctrl+Z niet ongedaan maakt (§5.2); één leidende hoeveelheid voor de lagmaat (§3.3, §3.10); de actieve
  bibliotheekverdeling in het omvattende event (§5.2); vast werk bij B2 en B8; de relatiesleutel met type (§3.3);
  `LiteralTimes` als schrijfkeuze per document (§3.6); de `isDirty`-regel is een keuze van de orkestrator. Ronde 4
  (zelfde reviewer; oordeel NEE, één punt) is verwerkt: een MCP-transactie met alleen metadata houdt de modus
  (§5.2, route 3; §6.1). Ronde 5 (zelfde reviewer; oordeel JA, één VERVOLG) is verwerkt: een werkregelwissel via
  MCP volgt de classificatie van de UI vóór de gevolgregels (§5.2, route 3; §6.1). Ronde 6 (zelfde reviewer; oordeel
  NEE, twee BLOKKEERT) is verwerkt: een bruggevolg telt alleen als de taak aansluit op de verantwoorde toestand
  (§5.2, route 3), en bij dagzoom komt het splitwerk uit de kalender, niet uit de kloksnap van 1440 (§3.12, T24).
  Ronde 7 (zelfde reviewer; oordeel JA, drie VERVOLG; geen nieuwe ronde) is vastgelegd: een maatwijziging door de
  werkregelbrug is planning (F3-eis, §5.2), de splitsregel bij dagzoom in twee stappen met de werkdagdefinitie
  (§3.12, T24), en Duurweergave in het OPS-profiel volgens B9 = optie 1 (§3.12, B8).
- **Schrijver:** expert-agent (Opus 5.5), branch `claude/uren-spec`, vanaf `main` `adaf9ab37`; in fixronde 4
  bijgewerkt met `main` `5266893af`; fixronde 5, 6 en 7 op dezelfde stand.
- **Regelnummers** gelden voor `adaf9ab37`. Elke verwijzing is zelf gelezen. Waar een feit uit de
  Haiku-inventaris komt en niet zelf is nagelezen, staat "(inventaris)".
- **Zekerheid:** BEVESTIGD = zelf gemeten of in de code gelezen. VERMOED = afgeleid, niet getoetst.

> Opdracht van de eigenaar (2026-10-20, letterlijk): "In deze sessie gaan we de hele OPS omzetten naar puur
> urengebaseerd rekenen, we stoppen dus met rekenen in dagen. Dit doen we omdat MSP en P6 dit ook doen en we
> nu steeds vaker problemen met interoperabiliteit en zulk soort dingen hebben doordat wij nog steeds deels in
> dagen rekenen."

**Dit ontwerp keert twee eerdere besluiten om.**

1. **Het tweepadenbesluit van fase 2.8b** (2026-07-06, `specs/2026-07-06-uren-scheduling-design.md` §2.2–2.3):
   "uur-modus is opt-in, dag-pad blijft fysiek ongewijzigd". Na deze verbouwing bestaat het dagpad niet meer.
   §1.2 legt uit waarom de reden van toen vervalt.
2. **De invariant "de taakeenheid is blijvend"** (2026-08-27, commit `6fb045105`; 2.8b-spec r.180;
   `src/types/task.ts:80`): "een dagtaak telt hele werkdagen, ook op een urenkalender". Wat blijft: elke taak
   houdt haar eigen maat (besluit B1). Wat omkeert: (a) de eenheid is alleen nog een schrijfwijze; (b) een
   dagenmaat-taak mag een breuk van een dag hebben; (c) onder het P6- en het MSP-profiel telt een
   dagenmaat-taak in de urenmaat; (d) een urentaak heeft geen eigen werkblokken meer nodig, want elke kalender
   heeft ze ("Een WORKTIME-urentaak zonder concrete werkblokken wordt geblokkeerd", 2.8b-spec r.182-183, vervalt).

## 0. Begrippen

De eigenaar wil dat elk begrip vastligt voordat het gebruikt wordt. De eerste acht begrippen staan hier
letterlijk zoals de eigenaar ze gaf (2026-10-20). Daarna volgen de begrippen die dit document er zelf bij
nodig heeft. Het document gebruikt daarna steeds precies deze woorden.

**Begrippen van de eigenaar**

- **Eenheid:** hoe je een duur schrijft of ziet (d, u). "5 d" en "40 u" zijn twee schrijfwijzen.
- **Maat:** de regel waarmee het programma telt hoeveel duur er tussen een begin en een einde zit. De maat
  bepaalt waar een taak eindigt.
- **Urenmaat:** duur = aantal werkuren tussen begin en einde; elk werkuur telt even zwaar; "1 d" = de uren
  per dag van de kalender (MSP, P6, OPS-urentaak nu).
- **Dagenmaat:** duur = aantal werkdagen tussen begin en einde; elke werkdag telt als 1, hoe lang ook; binnen
  een dag telt het deel van de werktijd dat voorbij is (halverwege = 0,5 d) (OPS-dagtaak nu, maar die kent
  alleen hele dagen).
- **Kalendertijd:** elk uur telt, ook nacht en weekend; in OPS "verstreken duur" (ELAPSEDTIME).
- **Tijdas in minuten:** elke datum is een moment met tijd; de rekenkern rekent in minuten tussen momenten.
- **Dagpad / urenpad:** de twee codepaden in de rekenkern die nu naast elkaar bestaan.
- **Voorbeeldweek** (ma-do 8 u, vr 6 u): urenmaat 38 u = 4,75 d; dagenmaat 5 d; kalendertijd 168 u = 7 d.

**Aanvullende begrippen in dit document**

- **Werkblok:** een tijdvak op een dag waarin de kalender werkt, bijvoorbeeld 07:00–12:00. In de code heet
  dit een band (`WorkTimeBands`, `src/types/calendar.ts:90-92`). **Blokbegin** en **blokeinde** zijn de
  grenzen van een werkblok. In de voorbeeldweek heeft ma-do de werkblokken 07:00–12:00 en 13:00–16:00,
  en vr 07:00–12:00 en 13:00–14:00.
- **Werktijd per dag:** de som van de werkblokken op de werkdag die het vaakst voorkomt
  (`effHoursPerDay`, `src/utils/taskDuration.ts:41-43`). In de voorbeeldweek is dat 8 u. In dit document is
  "de uren per dag van de kalender" uit de definitie van de urenmaat deze werktijd per dag (besluit
  eigenaar 2026-10-15, §3.1).
- **Typische werkdag:** de werkdag waarvan de werkblokken de werktijd per dag bepalen.
- **Dagkalender / urenkalender:** een kalender zonder / met eigen werkblokken (`workTime`), volgens
  `isHourModeCalendar` (`src/types/calendar.ts:120-122`). Een dagkalender heeft alleen begin, einde, uren per
  dag en eventueel een pauze.
- **Dagtaak / urentaak:** een taak met `durationUnit` `'days'` / `'hours'` (`src/types/task.ts:80`). Nu telt
  een dagtaak in de dagenmaat (alleen hele dagen) en een urentaak in de urenmaat.
- **Dagenmaat-taak / urenmaat-taak:** een taak waarvan de maat de dagenmaat / de urenmaat is. Na de
  verbouwing is elke bestaande dagtaak een dagenmaat-taak en elke urentaak een urenmaat-taak (besluit B1).
- **Rekenprofiel (profiel):** de set regels waarmee OPS rekent: P6, MSP of OPS, als basis plus afwijkingen
  (`project.schedulingProfile`; `.claude/rules/rekenprofielen.md`). **Conventie:** één regel in een profiel,
  aan of uit (`CONVENTIONS`, `src/engine/scheduler/conventions/registry.ts`).
- **Urenpad-dagtaak / urenpad-urentaak:** het urenpad kent nu twee gevallen. Een dagtaak op een urenkalender
  telt hele werkdagen op werkblokken (urenpad-dagtaak). Een urentaak telt werkminuten (urenpad-urentaak).
- **Startmoment / eindmoment:** het moment op de tijdas waarop een taak begint / klaar is. Een eindmoment is
  exclusief: de taak werkt tot dat moment.
- **Datum zonder tijd:** een opgeslagen datum in de vorm `YYYY-MM-DD`.
- **Startachtig / eindachtig veld:** een veld dat een startmoment / eindmoment draagt. De lijst staat in §4.2.
- **Werkdag van een moment:** de datum waarop het werkblok begint waarin het moment valt. Bij een eindmoment
  telt ook het werkblok dat op dat moment eindigt. Valt een moment buiten elk werkblok, dan is het de datum
  van het moment, met één uitzondering: een eindmoment om 00:00 hoort bij de dag ervoor (de 24:00-regel).
  Voorbeelden: eindmoment di 16:00 ⇒ werkdag di. Nachtblok di 22:00–wo 06:00, eindmoment wo 06:00 ⇒ werkdag di.
- **Gelijk op dagniveau:** twee uitkomsten zijn gelijk op dagniveau als elk startmoment en elk eindmoment
  dezelfde werkdag heeft, en de speling in dagen hetzelfde getal is (verschil kleiner dan 10⁻⁶).
- **Dagrand:** het begin van het eerste werkblok of het einde van het laatste werkblok van een werkdag, in de
  kalender van de taak. Bij kalendertijd zijn de dagranden 00:00 en 24:00.
- **Klokdatum:** de datum van een moment op de klok, van 00:00 tot 23:59. Het eindmoment wo 06:00 van een
  nachtblok heeft klokdatum wo en werkdag di.
- **Normalisatie:** het omzetten van een datum zonder tijd naar een moment, met de regels D1–D7 (§4.2).
- **Afleidbaar moment:** een moment dat de normalisatie van zijn werkdag, met de regel van zijn veld, precies
  teruggeeft. Op de standaardkalender: een start om 07:00 en een einde om 16:00. Niet afleidbaar: een start om
  11:00.
- **Ankerkalender / letterlijke kalender:** hoe OPS de datums van de taken op een kalender in IFC schrijft
  (§3.6). Op een ankerkalender is elk moment afleidbaar en gaat het als datum. Op een letterlijke kalender gaat
  elk moment met zijn echte tijd.

## 1. Doel en reden

### 1.1 Wat er verandert

- Alle rekenwerk gebeurt op de tijdas in minuten.
- Elke kalender heeft werkblokken. Een dagkalender krijgt ze in het geheugen, uit zijn eigen velden.
- Elke datum in een document is na het openen een moment.
- Het dagpad verdwijnt. Er blijft één rekenpad.
- Adapters ronden niet meer af op hele dagen.
- Elke taak houdt een eigen maat: urenmaat of dagenmaat, en daarnaast bestaat kalendertijd (besluit B1). De
  dagenmaat bestaat alleen in het OPS-profiel. Het P6- en het MSP-profiel rekenen alleen in urenmaat en
  kalendertijd, zodat ze precies rekenen zoals P6 en MSP. Een nieuwe taak in het OPS-profiel krijgt
  standaard de dagenmaat (besluit B1a).

### 1.2 Waarom de reden voor twee paden vervalt

Fase 2.8b hield het dagpad apart om één reden (2.8b-spec §2.3, letterlijk): "De default-kalender is `07:00-16:00` met
`hoursPerDay=8` — 9 kloknuren spanne, 8 netto uur. Een minuten-engine die de banden als bron neemt zou 9u/dag
afleiden en élke dag↔minuut-conversie verschuiven."

Die reden bestaat niet meer. `seedScalarBands` (`src/utils/effectiveWorkTime.ts:14-48`) maakt uit dezelfde
velden twee werkblokken: 07:00–12:00 en 13:00–16:00, samen 8 u. De resourcebelasting, het histogram, de
nivelleerder en de rapporten rekenen al zo, voor elke kalender (`src/engine/scheduler/taskEngineCache.ts:21-24`,
`calendarForEngine` in `src/utils/effectiveWorkTime.ts:257-261`). Alleen de CPM-motor doet het nog niet: die
geeft effectieve werkblokken alleen aan urentaken (`engineForTaskCalendar`, `CPMSolver.ts:233-247`).

De tweede reden van 2.8b was een harde eis: 290 dagcases bit-identiek. Die eis vervalt met de opdracht van de
eigenaar. In de plaats komt: de dagcases blijven het orakel op dagniveau (§6). De meting in §10 laat zien hoe
ver het urenpad daar nu van af zit: 380 van de 422 dagcases zijn gelijk op dagniveau via de urenpad-urentaak,
364 via de urenpad-dagtaak.

### 1.3 Wat er nu verloren gaat bij uitwisselen

Elk punt is in de code gelezen. Het effect in MS Project of P6 zelf is niet getoetst (geen MSP of P6 op deze
machine).

| # | Wat gaat verloren | Waar | Voorbeeld |
|---|---|---|---|
| I1 | MSPDI-import: lag naar een dagtaak wordt hele dagen | `mspdiReader.ts:612` ⇒ `tenthsOfMinutesToDays` (`importDurations.ts:15-18`) | lag 4 u = 0,5 d ⇒ afgerond 1 d = 8 u |
| I2 | MSPDI-import: verstreken lag in dagen wordt hele dagen | `mspdiReader.ts:606` | 36 verstreken uur ⇒ 2 d = 48 u |
| I3 | MSPDI-import: restduur van een dagtaak wordt hele dagen | `mspdiReader.ts:465`, `parseMSPDuration` `:174-184` | rest 12 u (8 u per dag) ⇒ 2 d |
| I4 | .mpp-import: duur en restduur van een dagtaak worden hele dagen | `mppReader.ts:774`, `:785-788` | zoals I3 |
| I5 | P6 XML-import: restduur en lag naar een dagtaak worden hele dagen | `p6HoursToDays` `p6xmlReader.ts:171-173`, gebruikt op `:964` en `:1110` | lag 3 u ⇒ 0 d |
| I6 | P6 XML-export: procentlag wordt hele dagen | `p6xmlWriter.ts:543-547` | 50 % van 3 d ⇒ 2 d |
| I7 | MSPDI-export: lag rekent met de uren per dag van de projectkalender, niet van de taakkalender | `mspdiWriter.ts:594` | projectkalender 8 u: lag 1 d van een taak op een 10 u-kalender ⇒ 8 u |
| I8 | MSPDI- en P6-export: een datum zonder tijd krijgt 08:00, ook een einde | `toXmlDateTime` `xmlInterchange.ts:26-31`; `mspdiWriter.ts:505,518`; `p6xmlWriter.ts:492,507` | werkelijk einde 5 jun ⇒ `2026-06-05T08:00:00`. VERMOED: MSP en P6 lezen dat als 08:00 |
| I9 | Ongelijke dagen: de export schrijft een dagtaak als dagen × uren per dag | `taskMinutesForWrite` `subdayIo.ts:574-577` | dagtaak 5 d op de voorbeeldweek eindigt in OPS vr 14:00; de export schrijft 40 u; in urenmaat eindigt dat ma 09:00 |
| I10 | IFC: speling als gebroken dag | `ifcWriter.ts:134-142`, `ifcTaskSlots.ts:138-145` | `P0Y0M2.5D`; OPS v2026.9.0 leest `(-?\d+)D` en maakt er 5 van (`ifcReader.ts:512-513` op tag `v2026.9.0`) |
| I11 | Motor: lag in minuten naar een dagvoorganger wordt hele dagen | `resolveEffectiveLagDays` `CPMSolver.ts:269-279` | lag 4 u ⇒ 1 d |
| I12 | Invoer in de tabel: lag in dagen wordt afgerond | `parseLagInput` `lagFormat.ts:73` | "1,5d" ⇒ 2 d; "0,5" ⇒ 1 d (BEVESTIGD met een esbuild-probe) |

Bij I9 is de OPS-kant gemeten met de planningsharness: dagtaak 5 d ⇒ einde `2026-06-05T14:00`, urentaak 40 u ⇒
einde `2026-06-08T09:00`. Bij I10 is de leesregel van v2026.9.0 in Node nagerekend: `P0Y0M2.5D` ⇒ 5,
`-P0Y0M0.375D` ⇒ −375.

Daarnaast staan op de grens dag/uur al bekende fouten: knownbugs 1 en 2, en de nieuwe 138–142 (§9; over 23 zie
daar).

## 2. Huidige stand

### 2.1 Drie gevallen in de rekenkern

| Geval | Wanneer | Telt | Datums | Einde |
|---|---|---|---|---|
| Dagpad | dagkalender, dagtaak | hele werkdagen (`scheduleDuration`) | `YYYY-MM-DD` | inclusief: de laatste werkdag. `addWorkDays` telt de startdag als dag 1 (`CalendarEngine.ts:224-246`); `workDaysBetween` telt inclusief (`:275`) |
| Urenpad-dagtaak | urenkalender, dagtaak | hele werkdagen op werkblokken | moment | blokeinde van de laatste werkdag (`dayFirstBandStart`/`dayLastBandEnd`, `CPMSolver.ts:1112-1158`; `addDurationChecked` `:1204-1250`) |
| Urenpad-urentaak | urentaak, elke kalender | werkminuten (`addWorkMinutes`, `CalendarEngine.ts:772`) | moment | exclusief eindmoment |

De modus van een engine volgt uit de kalender: `this.mode = isHourModeCalendar(calendar) ? 'hour' : 'day'`
(`CalendarEngine.ts:123`). Een urentaak op een dagkalender krijgt een engine met effectieve werkblokken
(`engineForTaskCalendar`, `CPMSolver.ts:233-247`). De projectengine krijgt de ruwe kalender (`CPMSolver.ts:515`).

### 2.2 Inclusief tegen exclusief einde

- Dagpad: het einde is de laatste werkdag. Een opvolger kan pas de dag erna: `predDoneAt` = einde + 1 dag
  (`CalendarEngine.ts:878-880`), daarna `nextWorkDay(ceilToWorkDay(…))` (`:885-888`).
- Urenpad: het einde is een eindmoment. Een opvolger kan op dat moment: `predDoneAt` = einde, daarna
  `nextWorkInstant` (`:879`, `:886`).
- Een einddatum zonder tijd wordt bij het lezen de volgende dag 00:00 (`finishInstant`,
  `src/utils/taskDates.ts:120-122`).
- Een eindmoment op een blokeinde en het volgende blokbegin liggen op de tijdas uit elkaar, maar er zit geen
  werktijd tussen. Voor de rekenkern zijn ze dus gelijkwaardig. Het urenpad kiest per plek een van de twee.
  Daar zitten de meeste verschillen uit §10.

### 2.3 Relaties

`forwardConstraint` kiest het urenpad zodra de engine van de voorganger of van de opvolger een urenkalender
heeft (`relationMath.ts:164-186`, de test op `:182`). Anders het dagpad: `forwardDay` (`:295-406`),
`sfReqFinishDay` (`:412-435`), `backwardDay` (`:437-515`). Urenpad: `forwardHour` (`:543-716`),
`sfReqFinishHour` (`:721-749`), `backwardHour` (`:751-913`, met takken voor gemengde paren).

### 2.4 Speling en kritiek

`signedFloat` (`CPMSolver.ts:1535-1541`):

- kalendertijd-taak: `signedElapsedSpan`;
- urentaak of nulduur-mijlpaal op een urenkalender: werkminuten ÷ (werktijd per dag × 60);
- anders: hele werkdagen (`signedWorkDaysBetween`).

Kritiek (`scheduleAnalysis.ts:387-395`): `tf × hoursPerDay ≤ critThresholdHours` als die drempel in uren
gezet is, anders `tf ≤ critThreshold`. Vrije speling per relatie: `scheduleAnalysis.ts:113-115`.

### 2.5 Lag, voortgang, nivelleren

- Lag: `lagDays` is verplicht; `lagMinutes` is de bron als het er is (`src/types/sequence.ts:14-36`).
  Een dagvoorganger rondt minuten af op hele dagen (`CPMSolver.ts:269-279`). Het urenpad rekent in minuten
  (`resolveLagMinutes`, `:1394-1402`).
- Procentlag: het dagpad rondt af op hele dagen (`CPMSolver.ts:261-264`), het urenpad op de minuut (`:1395-1397`).
- Voortgang: een dagtaak neemt als restduur `Math.round(totalSpan × (1 − completion))`, in beide paden; de keuze
  hangt af van `durationUnit`, niet van de kalender (`CPMSolver.ts:2314-2318`). Een urentaak rekent op de minuut.
- Nivelleervertraging: `levelingDelay` in dagen en `levelingDelayMinutes` naast elkaar
  (`shiftByLevelingDelay`, `CPMSolver.ts:1371-1390`; aanroep `:2205-2207`; `docs/TODO.md:180`).

### 2.6 Kalender

- `cal-default`: ma-vr 07:00–16:00, `hoursPerDay` 8 (`src/engine/calendar/defaultCalendar.ts:33-35`).
- `seedScalarBands` legt het verschil tussen spanne en uren per dag als pauze zo dicht mogelijk bij 12:00. Zijn
  er pauzevelden, dan gelden die. Uren per dag groter dan de spanne geeft geen werkblokken (`[]`,
  `effectiveWorkTime.ts:39`); een ongeldige pauze ook (`:26-28`).
- Een feestdag onderdrukt de werkblokken die op die dag beginnen. Een werkende uitzondering zonder eigen
  werkblokken krijgt de werkblokken van een gewone werkdag (`bandsStartingOn`, `CalendarEngine.ts:609-644`).

### 2.7 Waar de dagen verder zitten (samengevat)

- Opslag: `scheduleDuration`, `remainingTime`, `totalFloat`/`freeFloat` (werkdagen), `lagDays`,
  `levelingDelay`, baseline-duur en projectduur in werkdagen (`src/types/baseline.ts:13,37`).
- Adapters: zie §1.3.
- Werk: de werkdriehoek rondt een dagtaak af op hele dagen (`workTriangle.ts:100-111`, `workRuleApply.ts:195-198`).
- UI: een kaal getal is werkdagen; decimalen in de duur worden geweigerd (`parseDuration`,
  `src/utils/durationFormat.ts:40-41,46-70`). Slepen in de Gantt rondt bij een dagtaak af op hele dagen
  (`useBarDrag.ts:463`).
- Telling op `adaf9ab37`: `isHourMode` komt 162 keer voor in `src/`, waarvan 106 in `src/engine/scheduler/`;
  `taskDurationUnit(` 54 keer; `enableHourPlanning` 208 keer in 91 bestanden, waarvan 35 in `src/` (§3.12).

## 3. Doelmodel per onderwerp

Per onderwerp: het voorstel van de orkestrator in het kort, de toets tegen de code, het doel en de
typewijziging. "Fase" verwijst naar §7.

### 3.1 Kalender

- **Voorstel:** elke kalender krijgt werkblokken via `seedScalarWorkTime`; `hoursPerDay` wordt de omrekenfactor
  voor invoer en weergave, zoals P6.
- **Toets:** het eerste deel klopt en bestaat al voor alle consumenten behalve de CPM-motor (§1.2). Het tweede
  deel botst met een besluit van de eigenaar. **Besluit eigenaar 2026-10-15 ("een dag"), letterlijk:** "dit
  lijkt me de meest logische keuze omdat dit de echte waarde is en wij niet zoals p6 werken met een aparte
  instelling voor weergave". Daarmee is het verborgen dagengetal van een urentaak = werkminuten ÷ werktijd per
  dag van de taakkalender; `hoursPerDay` blijft bewaard en gaat bij export terug. Bron:
  `docs/superpowers/plans/2026-10-07-review-pr109-uitkomsten.md` r.1010-1015 op `origin/claude/review-pr109-log`;
  gebouwd in #363 (gemerged in main, merge `06aa45071`).
- **Doel:**
  - De motor bouwt elke engine op `calendarForEngine` (F2). De opslag blijft zoals hij is: een dagkalender
    houdt begin, einde, uren per dag en pauze. Er is geen migratie van kalenderdata.
  - "1 d" in de urenmaat = de werktijd per dag. `hoursPerDay` is alleen nog een exportwaarde
    (`MinutesPerDay`, `mspdiWriter.ts:365`) en de bron voor `seedScalarBands`.
  - Technische keuze T1, uren per dag groter dan de spanne (bijvoorbeeld 08:00–16:00 met 10 u): bij het openen
    verlengt OPS het einde tot begin + uren per dag (08:00–18:00) en meldt dat één keer. Reden: de uren per dag
    bepalen nu de duur van elke dagtaak in de export (I9); de spanne is vaak een oude standaardwaarde. Het
    alternatief, de uren per dag verlagen, verandert de duur van taken. Een ongeldige pauze
    (`effectiveWorkTime.ts:26-28`) vervalt op dezelfde manier, met melding.
  - Een scalaire kalender uit een import blijft scalair opgeslagen. Promoveren (`promoteHourCalendar`) is dan
    alleen nog nodig voor de weergave.
- **Typewijziging:** geen in `WorkCalendar` (`src/types/calendar.ts:8-58`). `CalendarEngine` verliest het
  onderscheid tussen dagkalender en urenkalender (`mode`, `:123`) in F6.

### 3.2 Duur en maat

- **Voorstel (eerste brief):** `durationMinutes` altijd de bron; "dagen" alleen een eenheid. Dat was optie 1
  van B1. De eigenaar koos optie 3: een maat per taak (§8, B1).
- **Doel:** elke taak heeft een maat. Het veld blijft `durationUnit` (technische keuze T7: geen nieuwe naam,
  want IFC, MCP en de extensie-API dragen deze naam al):
  - `'days'` = dagenmaat. Bron: `scheduleDuration`, in werkdagen. Voortaan mag dat een breuk zijn (2,5).
  - `'hours'` = urenmaat. Bron: `durationMinutes`. `scheduleDuration` is afgeleid: minuten ÷ (werktijd per
    dag × 60), zoals `hourTaskScheduleDuration` nu (`taskDuration.ts:65-68`).
  - Kalendertijd blijft `durationType: 'ELAPSEDTIME'`, in minuten op de 24/7-klok; 1 d = 1440 min.
- **Profiel:** of een dagenmaat-taak in de dagenmaat telt, bepaalt de conventie uit §3.14. Onder het P6- en
  het MSP-profiel telt hij als urenmaat: `scheduleDuration` × werktijd per dag × 60 minuten. De taak zelf
  verandert daarbij niet; terug naar het OPS-profiel telt hij weer in de dagenmaat.
- **Vast werk (besluit B1a):** een taak met de werkregel `FIXED_WORK` (`src/types/workRule.ts:17`; in de UI
  "vast werk") is altijd urenmaat. Zet een planner een dagenmaat-taak op vast werk, dan wordt zijn duur
  `scheduleDuration` × werktijd per dag × 60 minuten. Het besluit noemt geen reden. Dit ontwerp ziet deze: bij
  vast werk volgt de duur uit een vast aantal werkuren, en in de dagenmaat past dat niet altijd op de uren van
  de kalender. Op de voorbeeldweek heeft 3 d van wo t/m vr 22 werkuren, terwijl het werk 24 u is (T14).
- **Nieuwe taken (besluit B1a):** de bestaande projectinstelling "Standaardeenheid voor nieuwe taken"
  (`project.defaultTaskDurationUnit`, `src/types/project.ts:533`; UI `ProjectInfoPanelContent.tsx:140,569-578`; i18n
  `settings.defaultTaskDurationUnit`, `src/i18n/locales/nl/common.json:297-298`) wordt "Standaardmaat voor nieuwe
  taken", met de keuzes dagenmaat en urenmaat. Standaard: dagenmaat in het OPS-profiel. Onder het P6- of MSP-profiel
  staat hij vast op urenmaat, met een korte uitleg. De huidige voorwaarde (Urenplanning aan en een kalender met
  werkblokken: `canDefaultToHours`, `ProjectInfoPanelContent.tsx:186,350`; `taskSlice.ts:890-894`; in de taakdialoog
  `TaskDialog.tsx:67`) vervalt: de schakelaar verdwijnt (B2), en elke kalender heeft werkblokken. Een bestand zonder
  het veld krijgt de standaard van zijn profiel.
- **Typewijziging:** geen nieuw veld. De doc-comments van `TaskDurationUnit` (`src/types/task.ts:80`),
  `scheduleDuration` en `defaultTaskDurationUnit` krijgen de nieuwe betekenis.

### 3.3 Lag

- **Doel:** de bestaande velden dragen de maat al (`src/types/sequence.ts:14-36`). `lagDays` zonder
  `lagMinutes` is een lag in dagenmaat; `lagMinutes` is een lag in urenmaat; `lagUnit: 'ELAPSEDTIME'` is
  kalendertijd. `lagDays` mag voortaan een breuk zijn; de invoer rondt niet meer af (`lagFormat.ts:73`, I12).
- **Profiel:** onder het P6- en het MSP-profiel telt een lag in dagenmaat als urenmaat: `lagDays` × werktijd per
  dag van de lagkalender. De afronding van een minutenlag naar een dagvoorganger (`CPMSolver.ts:269-279`, I11)
  verdwijnt in elk profiel.
- **Procentlag (besluit B7):** een deel van de duur van de voorganger, in de maat van de voorganger, exact op
  de minuut, in elk profiel (zoals nu het urenpad, `CPMSolver.ts:1395-1397`). De afronding op hele dagen van het
  dagpad (`:261-264`) verdwijnt in F2. Er komt geen conventie voor.
- **Opslag van de maat (technische keuze T21; review ronde 2, punt 5; herzien na ronde 3, punt 2 en 5).** De maat
  van een lag wordt bewaard en hersteld zoals de maat van een taak, ook na een profielwissel. Nu gaat ze verloren.
  `lagDays: 0.5` en `lagMinutes: 240` geven in MSPDI dezelfde bytes (`LinkLag` 2400, `LagFormat` 7; `lagFields`,
  `mspdiWriter.ts:126-143`; BEVESTIGD door review ronde 2). In IFC leest v2026.9.0 `P0.5D` als 5 dagen, en een
  kalendertijd-lag `P1.5D` ook (BEVESTIGD, §10.5). Op de voorbeeldweek telt het verschil: een FS-lag van 0,5 d
  dagenmaat na een einde do 16:00 is de helft van de vrijdag van 6 u, dus 3 u (opvolger vr 10:00); een lag van
  240 min urenmaat is 4 u (opvolger vr 11:00).
  - *Eén leidende hoeveelheid (review ronde 3, punt 2, BEVESTIGD).* In ronde 2 stond het aantal dagen naast de
    `PT`-duur, en de lezer liet de dagen winnen. Wijzigt een ander programma alleen de `PT`-duur (`PT4H0M0S` ⇒
    `PT6H0M0S`), dan maakte de lezer er weer 0,5 d van: twee uur wijziging weg. Nu draagt het standaardveld altijd
    de lengte, in elk formaat. OPS schrijft er alleen maatinformatie naast. Voor een breuk in dagen is dat een
    record `[dagen, geschreven minuten]`: het exacte aantal dagen en de minuten die OPS op dat moment in het
    standaardveld schreef. De lezer gebruikt de dagen alleen als het standaardveld nog precies die minuten draagt
    (op de hele minuut). Anders heeft een ander programma de lengte gewijzigd. Dan geldt het standaardveld, in de
    urenmaat (bij kalendertijd in kalenderminuten), zoals voor een relatie zonder record. Reden voor de urenmaat:
    het standaardveld betekent werktijd in minuten; zo blijft de wijziging precies staan, in elk profiel en op
    elke dag. Reden voor de dagen in het record: de `PT`-vorm rondt op hele minuten (`minutesToIsoDuration`,
    `subdayIo.ts:79-86`), dus minuten ÷ werktijd per dag geeft niet altijd de dagen terug. Bij 7 u 36 min
    werktijd per dag wordt 0,3 d 136,8 min, geschreven als `PT2H17M0S`, en dat is terug 0,30044 d (BEVESTIGD,
    §10.5).
  - *IFC (F3):* urenmaat `PT…` (zoals nu). Dagenmaat in hele dagen `P{n}D` (zoals nu). Dagenmaat met een breuk
    `PT…` = werkdagen × werktijd per dag van de lagkalender, plus het record. Alle records staan in één eigenschap
    `DayMeasureLags` (naam voorlopig) in de bestaande pset `OPS_Sequences`, als JSON met de GUID van de relatie
    als sleutel, bijvoorbeeld `{"<guid>": [0.5, 240]}`. Die pset en die vorm bestaan al
    (`P6StartAtPredecessorFinishBoundarySequenceGuids`, `writeSequenceMeta`, `ifcWriter.ts:1521-1543`), want een
    `IfcRelSequence` kan geen pset dragen. Er komt geen nieuwe pset. Kalendertijd in hele dagen `P{n}D` met
    `ELAPSEDTIME` (zoals nu); kalendertijd met een breuk `PT…` (dagen × 1440 min) met `ELAPSEDTIME`, plus het
    record. Procentlag `IFCRATIOMEASURE` (zoals nu). Elke relatie zonder geldig record leest de lezer zoals nu.
  - *Waarom deze vorm:* v2026.9.0 leest `PT4H0M0S` als lag van 240 min en `PT36H0M0S` met `ELAPSEDTIME` als
    2160 kalenderminuten; `OPS_Sequences` kent hij niet (BEVESTIGD, §10.5). Hij leest dus een urenmaat-lag met
    dezelfde lengte, nooit 5 dagen. Het is de kleinste vorm: een record alleen voor een breuk in dagen; een lag
    in hele dagen of in uren zegt zijn maat al met de duurvorm.
  - *MSPDI en P6 XML (F5a):* de lengte in minuten, zoals nu (dagenmaat: werkdagen × werktijd per dag van de
    lagkalender, I7). Daarnaast de OPS-markering, zoals bij de taak (T15): één tekstveld op de opvolger met het
    record per relatie. MSPDI: een `ExtendedAttribute` naast `OPS_TaskDurationUnit` (`mspdiWriter.ts:43-45`). P6
    XML: een UDF naast die voor de eenheid (`p6xmlReader.ts:590-598`). De sleutel is de voorganger plus het
    relatietype, bijvoorbeeld `12:SS` (review ronde 3, punt 5). Reden: de store staat tussen hetzelfde takenpaar
    één relatie per type toe (`relationAddVerdict`, `src/state/relationRules.ts:39-44`). Een SS + 0,5 d en een
    FF + 0,25 d tussen dezelfde taken krijgen zo elk een eigen record; twee relaties met dezelfde voorganger,
    opvolger en type bestaan niet. Dezelfde leesregel: de dagen tellen alleen als `LinkLag` (MSPDI) of `Lag`
    (P6 XML) nog de geschreven minuten draagt. Zonder record, of bij een andere lengte, maakt de lezer een lag in
    urenmaat (T15). Kalendertijd heeft geen markering nodig: `LagFormat` 8 (ed) of 6 (eu) zegt de eenheid, en de
    lezer rondt niet meer af (I2). Of MSP en P6 zo'n veld bij hun eigen opslaan bewaren, is niet getoetst (geen
    MSP of P6 op deze machine).
  - *Profielwissel:* de lag verandert niet, alleen de conventie (§3.14). De schrijver bewaart de maat in elk
    profiel; onder het P6-profiel staat in `PT…` precies wat dat profiel rekent.
  - *Regressie (F3 voor IFC, F5a voor de adapters):* op de voorbeeldweek drie relaties naast elkaar: FS 0,5 d
    dagenmaat, FS 240 min urenmaat en FS 1,5 ed. Na IFC ⇒ OPS, MSPDI ⇒ OPS, P6 XML ⇒ OPS en OPS-profiel ⇒
    P6-profiel ⇒ OPS-profiel: dezelfde velden, en de opvolgers van de eerste twee op vr 10:00 en vr 11:00. Onder
    het P6-profiel staan die twee allebei op vr 11:00. Daarnaast een gewijzigde lag: in het bestand verandert
    alleen het standaardveld van de eerste relatie (IFC `PT4H0M0S` ⇒ `PT6H0M0S`; MSPDI `LinkLag`; P6 XML `Lag`).
    De nieuwe OPS leest dan 360 min urenmaat, net als v2026.9.0; het record telt niet. En twee relaties tussen
    hetzelfde takenpaar (SS + 0,5 d, FF + 0,25 d) door MSPDI en P6 XML heen en terug.
- **Typewijziging:** geen. `lagDays` blijft verplicht in het type.

### 3.4 Speling

- **Voorstel:** speling in minuten opgeslagen, weergave in dagen.
- **Doel (F3):** twee berekende velden erbij in `TaskTime`: `totalFloatMinutes?: number` en
  `freeFloatMinutes?: number` (werkminuten op de taakkalender; bij kalendertijd klokminuten). `totalFloat` en
  `freeFloat` blijven, afgeleid voor de weergave. Bij een taak die in de dagenmaat telt, is dat de afstand in
  werkdagen (met het deel van een dag). Anders is het minuten ÷ (werktijd per dag × 60); onder het P6- en het
  MSP-profiel dus altijd. De kritiek-drempel rekent in minuten (`critThresholdHours` bestaat al,
  `scheduleAnalysis.ts:393-395`).
- **IFC (technische keuze T5):** `IfcTaskTime` krijgt de speling als hele dagen (`P…D`, afgerond), en de
  precieze minuten gaan in de OPS-pset. Reden: OPS v2026.9.0 leest een gebroken `P…D` verkeerd (I10). Een
  oude versie toont dan een afgeronde speling tot de volgende Bereken; de nieuwe versie leest de minuten.

### 3.5 Voortgang

- **Doel:** urenmaat: `remainingMinutes` is de bron. Dagenmaat: `remainingTime` (werkdagen, mag een breuk zijn)
  is de bron. Onder het P6- en het MSP-profiel telt een dagenmaat-rest als urenmaat.
- **Rest bij een percentage (besluit B3):** exact, in elke maat en elk profiel. De afronding op hele dagen voor
  een dagtaak (`CPMSolver.ts:2314-2318`) verdwijnt in F3. Er komt geen conventie voor.
- **Werkelijke datums:** volgen de regels voor startachtige en eindachtige velden en de statusregel (§4.2).

### 3.6 Datums

- **Voorstel:** altijd een moment; einde = einde van het laatste werkblok; een datum zonder tijd wordt
  begin eerste werkblok (startachtig) of einde laatste werkblok (eindachtig), zoals de standaard begintijd en
  eindtijd in MSP; de tabel toont standaard alleen de datum.
- **Toets:** klopt, met aanvullingen uit de meting en de review: niet-werkdagen, kalendertijd-taken,
  nachtblokken, de statusregel en de projectdatums (§4.2). De weergave volgt besluit B4: een tijd alleen als het
  moment midden op de werkdag valt.
- **Doel (F2):** elk startachtig en eindachtig taakveld is na het laden en na elke invoer een moment
  `YYYY-MM-DDTHH:mm`. Het type blijft `string`.
- **Normalisatie is geen eenmalige migratie (technische keuze T17).** Ze draait op elke laadroute, ook voor een
  nieuw bestand, en op elke invoer. Een moment blijft een moment, dus twee keer draaien geeft hetzelfde.
  - Laden: in `payloadFromImport` (`documentContract.ts:461`), vóór iedere laadberekening (§5.2).
  - Invoer: in de store-acties die datums zetten (`setActualStart`/`setActualFinish`, `taskSlice.ts:1448,1455`;
    `applyProgressInvariants`, `taskMutationRules.ts:110`; de setters voor beperking en deadline; het aanmaken
    van taken). Zo krijgen paneel, dialoog, raster, MCP en extensies dezelfde regel. F4 verandert alleen wat
    de invoervelden tonen.
  - In ontwikkelmodus controleert het documentcontract na het laden en na elke mutatie dat er geen datum zonder
    tijd in zo'n veld staat.
- **Projectdatums blijven zoals ingevoerd.** `project.startDate`, `project.statusDate` en `project.endDate`
  worden niet omgezet opgeslagen. De motor leest ze met een vaste regel: start D1, statusdatum D5, einde D2
  (§4.2). Reden: de statusregel vergelijkt een werkelijke datum op dagniveau als de statusdatum geen tijd heeft
  (`isActualPastStatusDate`, `taskMutationRules.ts:11-16`); dat onderscheid moet blijven bestaan.
- **Opslaan in IFC: per kalender een anker of echte tijden (F2, technische keuze T17; herzien na review
  ronde 2, punt 2).** De lezer van v2026.9.0 beslist per kalender. Heeft één taak op een kalender een tijd ≠ 07:00
  of een `PT`-duur die geen hele dag is, dan maakt hij er een urenkalender van, en leest hij elke tijd van elke
  taak op die kalender letterlijk (`applyHourModeIFC`, r.654-714 op de tag; BEVESTIGD, §5.4). Een vlag per taak
  (ronde 1) past daar niet bij. Voorbeeld van de review: een voltooide dagtaak met werkelijk begin 11:00 en
  werkelijk einde op het anker 07:00 leest v2026.9.0 als einde 07:00, vóór het begin. Daarom één regel per
  kalender:
  - **Letterlijke kalender:** een kalender met eigen werkblokken, of een kalender waarop minstens één taak een
    `PT`-duur heeft of een moment dat niet afleidbaar is (§0). "Op een kalender" betekent: de effectieve kalender
    van de taak (`effectiveCalendarByTask`, `ifcWriter.ts:388`), zoals de lezer van v2026.9.0 hem ook kiest. Op zo'n
    kalender schrijft OPS elk startachtig en eindachtig veld van elke taak met de echte tijd, ook 07:00. De
    kalender krijgt in `OPS_Calendar` de eigenschap `LiteralTimes = .T.` (naam voorlopig). Een scalaire
    letterlijke kalender krijgt daarnaast de effectieve werkblokken met `IsHourCalendar = .F.`, zoals nu een
    kalender met een urentaak (`ifcWriter.ts:388-393`, `:1259-1262`); de voorwaarde wordt "letterlijke
    kalender".
  - **Ankerkalender:** elke andere kalender. Elk veld gaat als datum: in `IfcTaskTime` met het anker
    `T07:00:00` (`ifcWriter.ts:100-104`), in een pset als `IFCDATE` (`ifcDateValue`, `ifcPsets.ts:169-175`). De
    datum is de werkdag waaruit de normalisatie precies dit moment teruggeeft.
  - **Lezen:** op een kalender met `LiteralTimes` is elke tijd van elke taak het moment. Op elke andere kalender
    geldt de leesregel van nu (een urenkalender letterlijk; op een kalender met `IsHourCalendar = .F.` alleen de
    urentaken, `ifcReader.ts:1472-1473`; anders het anker), met daarna de normalisatie. Zo leest een bestand van
    vóór F2 precies zoals nu. De eigenschap hangt niet aan `TimeModel`, want die markering staat niet in elk
    nieuw bestand (§5.2). v2026.9.0 leest `OPS_Calendar` per eigenschapsnaam en slaat een onbekende naam over
    (gelezen in de code van de tag, `extractCalendarHourMode` en de lezers ervoor).
  - **Een schrijfkeuze per document (review ronde 3).** `LiteralTimes` is geen veld van de kalender in de store
    of in de resourcebibliotheek. De schrijver leidt het bij elke save opnieuw af uit de taken van dit document.
    Dezelfde bibliotheekkalender kan zo in het ene document een ankerkalender zijn en in het andere letterlijk.
    De lezer gebruikt het alleen om dit bestand te lezen en zet het niet in de kalender; de kalenderhash
    (`computeCalendarHash`, `src/services/library/libraryOps.ts:391`) ziet het dus nooit.
  - **Velden:** de slots van `IfcTaskTime`, beperkingen en deadline (`OPS_Constraints`), `stop`/`resume`
    (`OPS_Resume`) en de baseline-taken in `OPS_Baselines` (per baseline-taak de kalender van haar taak; bestaat
    de taak niet meer, dan de projectkalender). Een niet-afleidbaar moment in elk van die velden maakt de kalender
    letterlijk.
  - **Gevolg:** één niet-afleidbaar moment maakt de hele kalender letterlijk. Voor de nieuwe OPS is dat
    verliesvrij. Wat v2026.9.0 ermee doet, staat in §5.4. De vlag "tijden letterlijk" uit ronde 1 vervalt.

### 3.7 Kalendertijd

- **Doel:** minuten op de 24/7-klok, zoals nu. Het einde van een kalendertijd-taak is exclusief.
- **Wat er verandert:** het dagpad schrijft het einde van een kalendertijd-taak als start + n kalenderdagen,
  maar leest die datum daarna als inclusief. Daardoor begint een FS-opvolger nu een dag te laat, en krijgt de
  taak te weinig speling (knownbugs 144). Na de verbouwing is het einde overal exclusief. De omzetting per veld
  staat in §4.2 (regel D3).

### 3.8 Migratie

Zie §5. Eén zuivere functie op de laadgrens (`payloadFromImport`), deterministisch en idempotent. De
normalisatie draait altijd; de markering `TimeModel` stuurt alleen de B5-overgang.

### 3.9 Rekenkern

- **Doel:** één pad op de tijdas in minuten.
- **Volgorde:** F2 haalt de keuze tussen dagkalender en urenkalender weg (alle engines op werkblokken). F3
  maakt van de keuze tussen dagtaak en urentaak een keuze op maat, met de conventie uit §3.14, en voegt
  lopers toe voor een dagenmaat met een breuk. F6 verwijdert de dagpadcode:
  `forwardDay`/`sfReqFinishDay`/`backwardDay` (`relationMath.ts:295-515`), de dagmethoden van `CalendarEngine`
  (`:224-461`) en de dagtak van `predDoneAt`/`availableStart` (`:878-888`).
- **Technische keuze T11:** ongeveer vijftien P6-conventies kijken nu naar `isHourMode` (inventaris), bijvoorbeeld
  `CPMSolver.ts:773` (`p6LateFinishOnOwnCalendar`), `:789`, `:831`, `:2892`, `:3133` en
  `scheduleAnalysis.ts:204-205`. Als in F2 elke engine werkblokken krijgt, gaan die conventies ook gelden voor
  projecten die nu een dagkalender hebben. F2 vervangt die test daarom door een expliciete vlag "de kalender
  had eigen werkblokken" (`isHourModeCalendar` op de opgeslagen kalender). Zo verandert hun bereik niet. Of ze
  later breder gaan gelden, is een aparte meting met `measure:profiles` (regel A).

### 3.10 Adapters

- **Fasen:** F5a hoort bij de eerste release (§7.3): een verliesvrije heen-en-terug OPS ⇒ MSPDI/P6 XML ⇒ OPS
  voor duur, rest en lag, in beide maten. Reden (review ronde 1, BEVESTIGD): de huidige MSPDI-route maakt van
  2,5 d met 1,5 d rest bij teruglezen 3 d met 2 d rest, ook met de OPS-markering (`mspdiReader.ts:174`, `:465`);
  F3 maakt precies zulke data. F5b (.mpp, XER, het 08:00-anker) mag later.
- **Lezen (F5a, .mpp en XER in F5b):** MSPDI, .mpp, P6 XML en XER maken altijd taken in de urenmaat, en lezen duur,
  rest en lag in minuten zonder afronding. Dat lost I1–I5 op. Uitzondering: draagt de taak de OPS-markering voor de
  eenheid (MSPDI-veld via `opsDurationUnitFieldId`, `mspdiReader.ts:246`; P6-UDF, `p6xmlReader.ts:590`), dan komt de
  dagenmaat terug. Met een record (T21, §3.3) zijn dat de exacte dagen, zolang de duur nog de geschreven minuten
  draagt; bij een andere duur de urenmaat. Zonder record (hele dagen, of een bestand van vóór F5a) werkdagen =
  minuten ÷ werktijd per dag, zoals nu. Nu maakt de XER-lezer een dagtaak op een kalender
  zonder tijdsignaal (`xerReader.ts:831-834`); dat verdwijnt. Een lezer maakt alleen nog een urenkalender als de
  kalender per dag verschilt of eigen werkblokken heeft; anders blijft hij scalair (§3.1).
- **Schrijven:** urenmaat: minuten. Dagenmaat: werkdagen × werktijd per dag (technische keuze T13), plus de
  OPS-markering, en bij een breuk het record (T21). Reden: dat is precies wat het P6- en het MSP-profiel rekenen, het
  hangt niet af van de plek, en OPS → P6 → OPS geeft de dagenmaat terug. Nu gebruikt `taskMinutesForWrite` het
  opgeslagen `hoursPerDay` (`subdayIo.ts:574-577`, aangeroepen met `effCal.hoursPerDay`, `mspdiWriter.ts:475-479`);
  dat wordt de werktijd per dag (F3). Verder in F5a: lag rekent met de taakkalender (I7); procentlag gaat naar P6 als
  minuten (I6). In F5b: een einde krijgt de echte tijd, niet het anker 08:00 (I8).
- **IFC (F3, technische keuze T21):** één regel voor duur, rest en lag: het standaardveld draagt de lengte, en
  een breuk in dagen krijgt het record `[dagen, geschreven minuten]` met de leesregel uit §3.3. Urenmaat:
  `PT…H…M`. Dagenmaat in hele dagen: `P{n}D`, zoals nu; een oudere OPS leest dan een gewone dagtaak. Dagenmaat
  met een breuk: `PT…H…M` (werkdagen × werktijd per dag) plus het record; een oudere OPS leest dan een urentaak.
  Kalendertijd met een breuk (nu `P0Y0M1.5D`, `ifcDuration`, `ifcWriter.ts:139-143`, door v2026.9.0 gelezen als
  5): `PT…` met `ELAPSEDTIME` plus het record. Voor duur en rest staan de records in één eigenschap van een
  bestaande per-taak-pset (voorlopig `OPS_WorkRule`, `ifcPsets.ts:712-724`, want de werkregelbrug beheert duur en
  werk); er komt geen nieuwe pset. Nooit een gebroken `P…D`. De lag: §3.3. Speling: §3.4. Kalender: §5.4.
- **Ongelijke dagen (I9):** een dagenmaat-taak van 5 d op de voorbeeldweek eindigt in het OPS-profiel vr 14:00.
  MSP en P6 rekenen 40 u en eindigen ma 09:00. Dat verschil is bewust (B1). Onder het P6- of MSP-profiel
  rekent OPS zelf ook ma 09:00.

### 3.11 Resources en werk

- **Dagemmers blijven, hun verdeling verandert (F3).** Belasting en nivellering houden per werkdag één getal
  (`DailyLoad`), zoals nu. Nivelleren op uurniveau is niet nodig. Maar de verdeling over de werkdagen telt nu
  hele dagen vanaf de startdatum: `taskWorkDayIsos` en `enumerateTaskWorkDays` (`ResourceLoad.ts:236-240`) met
  `distributeUnits(unitsPerDay, scheduleDuration)` (`:190`). Een taak die midden op een dag begint, boekt dan op
  de verkeerde dagen. Dat geldt nu al voor een urentaak. Probe (BEVESTIGD, store met `applyOpenedImport`):
  urentaak 24 u, wo 3 jun 11:00 tot ma 8 jun 11:00, inzet 1 ⇒ belasting wo 1, do 1, vr 1, ma niets; verwacht wo
  0,5, do 1, vr 1, ma 0,5 (knownbugs 143). Na F3 kan ook een dagenmaat-taak zo staan.
- **Nieuwe regel:** het deel van een werkdag dat een taak bezet, volgt uit haar start- en eindmoment op de
  werkblokken van die dag. Urenmaat: werkminuten van de taak op die dag ÷ (werktijd per dag × 60). Dagenmaat: het
  deel van de werktijd van die dag (wo 11:00–16:00 = 4 van 8 u = 0,5). Inzet × dat deel = de belasting van die
  dag. Het histogram en de contourdialoog (`ContourDialog.tsx`) delen nu `taskWorkDayIsos`; de nivelleerder telt
  apart met dezelfde regel in hele dagen (`ResourceLeveler.ts:425`). Alle drie krijgen één gedeelde functie die
  voor een plaatsing de werkdagen met hun deel geeft, ook met onderbrekingen (`splitGaps`). Een curve, een
  contour of opgeslagen werk (`assignmentDayUnits`, `ResourceLoad.ts:150-191`) verdeelt het werk zoals nu over
  die dagen; het deel van de eerste en de laatste dag weegt mee. De precieze weging is werk voor F3.
- **Nivelleerder: vraag per kandidaat (review ronde 2, punt 6, BEVESTIGD).** Nu berekent de nivelleerder de vraag
  per taak één keer (`demandByTask`, `ResourceLeveler.ts:442-458`). Bij elke kandidaat schuift alleen de lijst
  met dagen mee (`occurrenceFor`, `:427-435`); de vraag zelf hergebruikt hij (`findSlot`, `:876`; `bookDemandAt`,
  `:523-526`). Met de nieuwe regel hangt de verdeling van de plaats af. Voorbeeld van de review: een urenmaat-taak
  van 8 u, inzet 1, vanaf vr 07:00 met 6 werkuren op vrijdag geeft vr 0,75 en ma 0,25. Vanaf ma 07:00 geeft ze
  ma 1. De oude vorm verschoven geeft ma 0,75. Met een bestaande last van 0,25 op maandag keurt de toets dan
  1,0 goed, terwijl de geplaatste taak 1,25 boekt. Regel: de nivelleerder bepaalt voor elke kandidaat de dagen
  én de vraag per dag met de gedeelde functie, en boekt met dezelfde uitkomst. De cache gaat per taak en
  startmoment (nu per startdatum, `:428-431`). Na toepassen is de geboekte last per resource en per dag gelijk
  aan het histogram. Regressie (F3): het voorbeeld hierboven met capaciteit 1; de kandidaat ma 07:00 wordt
  geweigerd, en na toepassen zijn nivelleerder en histogram gelijk. Nivelleren op uurniveau is niet nodig.
- **Werk, urenmaat:** de werkdriehoek rondt niet meer af op hele dagen (F3; `workTriangle.ts:100-111`,
  `workRuleApply.ts:195-198`).
- **Werk, dagenmaat (technische keuze T14):** werk = werkdagen × inzet × werktijd per dag. Zo rekent de
  werkdriehoek nu al (dagslots van `hoursPerDay × 60`), alleen met de werktijd per dag in plaats van
  `hoursPerDay`. Reden: het werk is dan onder elk profiel hetzelfde en hangt niet af van de plek van de taak.
  Nadeel: op een korte vrijdag past het werk niet precies op de uren van die dag; dat bestaande punt blijft
  open (`docs/TODO.md:249-251`).
- **Nivelleervertraging:** de nivelleerder schrijft een vertraging als de werkminuten van de overgeslagen
  werkdagen op de taakkalender. `levelingDelay` (dagen) verdwijnt in F6 (`docs/TODO.md:180`).

### 3.12 UI

- **Invoer van de duur (besluiten B8 en B2).** In het OPS-profiel maakt "5d" de taak dagenmaat en "40u" urenmaat. Een
  kaal getal houdt de maat van de taak, in de eenheid die de tabel toont: "3" is 3 d bij een dagenmaat-taak en 3 u bij
  een urenmaat-taak. Een nieuwe taak krijgt de standaardmaat (§3.2). Vast werk is altijd urenmaat: "5d" wordt 5 × de
  werktijd per dag. Onder het P6- en het MSP-profiel is "d" de urenmaat. Breuken ("2,5") en uren ("4u") zijn voor
  iedereen te typen, want de schakelaar Urenplanning verdwijnt (B2). Nu weigert `parseDuration` decimalen
  (`durationFormat.ts:40-41`). Een lag in dagen wordt niet meer afgerond (`lagFormat.ts:73`).
- **Weergave.** De duur volgens B8: in het OPS-profiel een dagenmaat-taak in d en een urenmaat-taak in u; onder het
  P6- en het MSP-profiel volgens de instelling Duurweergave, zoals nu. B9 = optie 1: in het OPS-profiel heeft
  Duurweergave (`durationDisplay`: "Automatisch (eigen eenheid per taak)", "Altijd dagen", "Altijd uren") geen effect.
  F4 maakt de instelling daar grijs, met de hint "In het OPS-profiel toont elke taak zijn eigen maat." Een nieuwe
  i18n-sleutel bevat de hint in nl en en. Dit geldt op alle drie de plekken van `SettingsPanelContent`: ⚙, het
  tabblad Instellingen en Backstage. Een browsertest toont op die drie plekken het grijze veld en de hint in het
  OPS-profiel, en het actieve veld onder P6. Wie in OPS de uren van een dagenmaat-taak wil zien, ziet die niet in
  de kolom Duur (B9). Datums volgens B4: een tijd alleen als het moment midden op de werkdag valt.
- **Gantt.** Bij dagzoom snapt slepen per werkdag, van blokbegin tot blokeinde; bij uurzoom per uur of kwartier
  (`timelineSnap.ts:12-28`). De grenzen van dagzoom en uurzoom staan hieronder (T24).
- **Projectinstellingen.** "Standaardmaat voor nieuwe taken" (§3.2) en het profielblok met de nieuwe conventie
  (§3.14).
- **De schakelaar Urenplanning verdwijnt (besluit B2, optie 1).** Uitwerking voor F4:
  - *Opslag.* `enableHourPlanning` verdwijnt uit `UIState` (`types.ts:603`), uit de standaardwaarden
    (`uiSlice.ts:155`), uit het register (`settingsRegistry.ts:188`) en uit `settingsStore.ts`
    (`saveEnableHourPlanning`, `:513-515`). De oude sleutel `ops-enableHourPlanning` blijft ongelezen in
    localStorage staan (T25). Reden: niets leest hem nog, en opruimen vraagt een blijvend codepad (`removeLocal`,
    `settingsStore.ts:55-57`) voor een sleutel zonder gevolg. Een oudere OPS op dezelfde opslag houdt zo zijn eigen
    stand. Zo doet OPS het al met de oude sleutel van de layouts (`settingsStore.ts:386-389`).
  - *Leesplekken.* `enableHourPlanning` staat in 35 bestanden in `src/` (grep op `adaf9ab37` en op `5266893af`,
    allebei 35). Elke leesplek gedraagt zich als "aan", met twee uitzonderingen: de meldingen die vervallen en de
    zoomgrenzen (beide hieronder). De tabel na deze lijst noemt per bestand wat er verandert.
  - *Meldingen die vervallen.* De strook `HourDataNotice.tsx` ("Dit bestand bevat urenplanning", met de knop
    "Urenplanning aanzetten"), met de mount `App.tsx:41,311`, het veld `hourDataNotice` (`types.ts:619`,
    `uiSlice.ts:161`) en de optie `hourDataNotice` van het laadpad (`fileSlice.ts:355`, `:818-825`, `:1023`, `:1492`;
    `projectSlice.ts:598`; `devBridge.ts:104`). `fileHasHourData` blijft, want het rekenprofiel gebruikt hem
    (`schedulingProfileDraft.ts:340`). De MCP-melding over de schakelaar bij een nieuwe urenkalender
    (`calendarResourceTools.ts:1267-1277`) vervalt ook. Dat is een regel in `warnings`, geen weigering.
  - *i18n-sleutels die vervallen*, in alle 28 talen. In `common`: `settings.hourPlanningSection`,
    `settings.enableHourPlanning`, `settings.enableHourPlanningHint`, `hourData.notice` en `hourData.enable`. In
    `task`: `taskGrid.validation.hourPlanningDisabled`, `duration.enableHourPlanningFirst` en
    `duration.enableHourPlanning`. F4 haalt ook de controle `hasConcreteWorkBlocks` bij de invoer en de standaardmaat
    weg (§3.2, want elke kalender heeft werkblokken); dan vervalt ook `duration.requiresWorkBlocks`
    (`TaskDurationField.tsx:102,117`, `ProjectInfoPanelContent.tsx:578`).
  - *Tijdkop en slepen.* De eigenaar belooft: bij dagzoom sleept een taak per hele dag. Alleen de schakelaar als "aan"
    lezen breekt dat (BEVESTIGD, probe `/tmp/uren-fix5/tiers.ts`, §10.5). Vanaf zoom 80 geeft `pickTiers`
    (`timelineTiers.ts:91-114`) dan de uurband, en `hourSnapMinutesFor` (`timelineSnap.ts:12-15`) 60 minuten. De
    voorinstelling Dag (zoom 100, `timelineTiers.ts:15`) sleept dan een urentaak per uur (`useBarDrag.ts:299,365`), en
    na F2 elke taak, want dan heeft elke taak momenten. Daarom krijgen `pickTiers`, `hourSnapMinutesFor`,
    `scaleFromZoom` en `maxGanttZoom` geen schakelaar meer, maar vaste grenzen (technische keuze T24):
    - zoom onder `MAX_DAY_ZOOM` (400, `timelineTiers.ts:23`): zoals nu met de schakelaar uit; vanaf 80 de rijen
      maand, week en dag; slepen per hele dag (een urenmaat-taak verschuift per 1440 klokminuten, een
      dagenmaat-taak per werkdag);
    - splitsen en stukslepen bij dagzoom (review ronde 6, BLOKKEERT, BEVESTIGD): 1440 is een kloksnap, geen
      hoeveelheid werk. Nu geven `useSplitGesture.ts:97,108` en `useBarDrag.ts:225,251` de snap door aan
      `splitUnitMinutes` (`splitEdit.ts:206-208`), en het splitmodel rondt werkminuten daarop af (`snap`, `:76`).
      Met 1440 weigert een split na één werkdag (`position-out-of-range`), en een pauze van één werkdag die één
      dag langer wordt, krijgt 1440 werkminuten: drie werkdagen op een kalender van 8 u. Regel, in twee aparte
      stappen (review ronde 6; aangescherpt na review ronde 7, VERVOLG):
      1. *Plek en afstand, zonder afronding.* Bij dagzoom valt de pointer op het begin van de werkdag onder de
         muis: de werkdag van het moment (§0; een werkblok hoort bij de dag waarop het begint, B4), en daarvan het
         begin van het eerste werkblok. Heeft die dag geen werkblok, dan het begin van de eerstvolgende werkdag. De
         blokken van een werkdag geeft `CalendarEngine.effectiveBandsOn` (`CalendarEngine.ts:531-538`); de functie
         "werkdag van een moment" bouwt F0 (§6.1). Klok-middernacht is fout: bij een nachtploeg 22:00–06:00 snijdt
         die de ploeg doormidden, en afronden op de dichtstbijzijnde middernacht kiest bij een klik in de middag de
         dag erna. De werkafstand tussen twee plekken komt uit de kalender van de taak: `workOffsetAtDate` voor de
         plek van de split en `workAxisMinutesBetween` voor de lengte van pauze en werkstuk (`splitEdit.ts:119-165`),
         via `CalendarEngine.workMinutesBetween` (`CalendarEngine.ts:828-854`). Het splitmodel rondt die minuten
         niet opnieuw af: niet op 1440, en ook niet op het uur, want een werkdag van 8,5 u wordt dan 9 u (§10.5,
         probe S4).
      2. *Minimumlengte, apart daarna.* Een nieuwe pauze, ook bij een klik zonder slepen, is ten minste één
         werkdag: de werkminuten van de werkdag van het grijppunt volgens dezelfde definitie. Bij een nachtploeg is
         dat de hele ploeg (480 min), niet het venster van één kalenderdag (360 min). Een werkstuk loopt ten minste
         tot de eerstvolgende werkdaggrens. Begint het midden op een werkdag, zoals bij een taak die ma 13:00
         start, dan is dat de rest van die werkdag (180 min op de standaardkalender). Een pauze die op nul uitkomt,
         wordt opgeheven: de stukken worden samengevoegd (`setGapLength` → `removeGap`, `splitEdit.ts:174-180`). De
         minimumklem geldt niet voor nul.

      Het label telt dan werkdagen (`useSplitGesture.ts:223`, `useBarDrag.ts:414`). Bij uurzoom blijft de eenheid de
      snap van de tijdkop (60 of 15), zoals nu. De overige aanroepers van `splitUnitMinutes` (MCP, taakpaneel,
      `taskDefaults.ts`) geven geen snap door en veranderen niet;
    - vanaf 400: dag en uur, slepen per uur; de schaal heet Uur (`scaleFromZoom`, nu vanaf 300 met de schakelaar);
    - met Kwartierzoom vanaf 1000 (`MAX_HOUR_ZOOM`, `timelineTiers.ts:25`): uur en kwartier, slepen per 15 min;
    - `maxGanttZoom`: 4000 met Kwartierzoom, anders 1000. De voorinstelling Uur (1000) staat altijd in de lijst;
    - gevolg: wie nu de schakelaar aan heeft, ziet tussen zoom 80 en 400 geen uurrij meer en sleept daar per dag.
      Wie hem uit heeft, ziet tot zoom 400 niets veranderen. De grenzen zijn een voorstel (VERMOED: goed leesbaar);
      F4 toetst ze in de checkstap.
  - *Blijft.* Duurweergave (`durationDisplay`) en Kwartierzoom (`enableQuarterHourZoom`) blijven aparte
    instellingen. Vast werk blijft altijd urenmaat (B1a). De sub-instelling "Gemengde dag/uur-planning toestaan"
    (`allowMixedDayHour`, `SettingsPanelContent.tsx:339-346`) verliest haar voorwaarde: `showUnitControls` wordt
    `allowMixedDayHour` (`TaskDurationField.tsx:57`). Voorstel: zij verhuist naar het blok Duurweergave
    (`SettingsPanelContent.tsx:236-247`), en de kop "Urenplanning" vervalt. F4 legt dat voor in de checkstap.
  - *Gidsen, tutorials en tests.* 15 nl- en 16 en-gidsen noemen Urenplanning (grep op `adaf9ab37`; 17 en 18 op
    `5266893af`). Het artikel `howto-urenplanning-aanzetten` (`public/docs/manifest.json:173`) vervalt; zijn id staat
    niet in `src/` (grep). Krijgt het een nieuwe naam, dan krijgt het een alias in de manifest. De tutorials 4 tot en
    met 7 zetten de schakelaar aan (`tests/browser/tutorials/tut-4.ts:37,41`, `tut-5.ts:17,56-59`, `tut-6.ts:49`,
    `tut-7.ts:21`); die stap vervalt. De generator `scripts/tutorial-project.ts:438,537` zet hem ook. Tutorial 4 van
    de tutorial-extensie leest `localStorage['ops-enableHourPlanning']` (knownbugs 45); die extensie moet mee
    (VERMOED: buiten deze repo). In `tests/` noemen 37 bestanden `enableHourPlanning` (38 op `5266893af`).
  - *Knownbugs 24* ("Urenplanning uit bij een kalender met werktijdblokken") verdwijnt met de schakelaar. Het punt
    staat al niet meer in `knownbugs.md`: `e977abf4a` (2026-10-19) haalde het als verouderd weg.

De 35 bestanden in `src/` (regels op `adaf9ab37`):

| # | Bestand | Wat verandert |
|---|---|---|
| 1 | `state/slices/types.ts:603` | veld weg, ook `hourDataNotice` (`:619`) |
| 2 | `state/slices/uiSlice.ts:155,314` | standaardwaarde weg; `maxGanttZoom` zonder schakelaar; `hourDataNotice` (`:161`) weg |
| 3 | `utils/settingsRegistry.ts:188` | registratie weg |
| 4 | `utils/settingsStore.ts:513-515` | `saveEnableHourPlanning` weg; het commentaar `:510-512` bijwerken |
| 5 | `components/settings/SettingsPanelContent.tsx:67,328-347` | schakelaar en kop weg; `allowMixedDayHour` zonder voorwaarde (zie *Blijft*) |
| 6 | `components/layout/HourDataNotice.tsx:22` | bestand weg, met de mount `App.tsx:41,311` |
| 7 | `state/slices/fileSlice.ts:819` | de melding `:818-825` weg, met de optie `hourDataNotice` |
| 8 | `services/mcp/tools/calendarResourceTools.ts:1270` | de MCP-melding `:1267-1277` weg |
| 9 | `components/task-sections/TaskDurationField.tsx:37,56-57,101-102,112-113,132,245-246` | `hourEditBlocked` en de knop "Urenplanning inschakelen" weg; `showUnitControls` = `allowMixedDayHour`; "4u" geeft geen melding meer |
| 10 | `components/dialogs/TaskDialog.tsx:58,67` | `newTaskUnit` = de standaardmaat (B1a) |
| 11 | `state/slices/taskSlice.ts:890` | de maat van een nieuwe taak = de standaardmaat; de voorwaarde `:890-894` vervalt (§3.2) |
| 12 | `engine/taskGrid/taskEditPlan.ts:82,312,411-413` | omgevingsveld en de weigering `hourPlanningDisabled` weg |
| 13 | `state/gridTransaction.ts:524` | omgevingsveld weg |
| 14 | `utils/taskDuration.ts:171-182` | de ongebruikte parameter van `formatTaskDurationDisplay` weg (`void enableHourPlanning`) |
| 15 | `components/canvas/TaskTooltipContent.tsx:40,47` | argument weg |
| 16 | `components/task-sections/TaskBasicFields.tsx:12` | alleen commentaar |
| 17 | `components/dialogs/CalendarForm.tsx:74,103` | de werktijdsectie altijd zichtbaar (`showWorkTimeSection`) |
| 18 | `components/settings/ProjectInfoPanelContent.tsx:184,337,350,563,611` | ploegpreset en standaardmaat altijd zichtbaar; `canDefaultToHours` (`:186`) vervalt; een nieuw project krijgt de gekozen standaardmaat |
| 19 | `components/settings/SchedulingProfileSection.tsx:145,219` | `hourUnit` volgt alleen Duurweergave en de kalender |
| 20 | `components/dialogs/ExternalLinkDialog.tsx:97,103` | `ownerHourMode` volgt alleen de kalender |
| 21 | `engine/renderer/timelineTiers.ts:32-35,44-50,91-114` | geen schakelaar; de grenzen van T24 |
| 22 | `components/canvas/hooks/timelineSnap.ts:12-13` | geen schakelaarparameter |
| 23 | `components/canvas/hooks/useBarDrag.ts:141,198,225,318,570` | parameter weg |
| 24 | `components/canvas/hooks/useSplitGesture.ts:69,90,97` | parameter weg |
| 25 | `components/canvas/hooks/useGanttPointerCoordinator.ts:44,109,138` | doorgeven weg |
| 26 | `components/canvas/hooks/ganttCoordinatorTypes.ts:87,208` | veld weg |
| 27 | `components/canvas/hooks/useGanttViewportCoordinator.ts:202,216,247,256,398` | doorgeven weg |
| 28 | `components/canvas/GanttCanvas.tsx:126,269,481,624,636,678,692` | selector en doorgeven weg |
| 29 | `engine/renderer/GanttRenderer.ts:147,432,1020` | optie weg |
| 30 | `hooks/useGanttZoom.ts:12,28,37-42` | parameter weg |
| 31 | `utils/ganttViewport.ts:214,231` | parameter weg |
| 32 | `state/slices/viewSlice.ts:185,197` | `maxGanttZoom` zonder schakelaar |
| 33 | `components/layout/Ribbon/ribbonWidgets.tsx:1057,1077,1085` | de schaal Uur altijd in de lijst |
| 34 | `components/dialogs/LayoutsDialog.tsx:73,161` | de schaal Uur altijd in de lijst |
| 35 | `components/layout/StatusBar/StatusBar.tsx:27,102` | het schaallabel zonder schakelaar |

### 3.13 Publieke surface (F3 en F7)

- MCP (F3): blijft dagen als invoer accepteren en noemt de maat expliciet. De teksten die nu "WORKING DAYS" en
  "2.5 ⇒ 3" zeggen, gaan mee in F3, want na F3 kloppen ze niet meer (`sequenceFields.ts:185-192`,
  `taskFields.ts:540-542`). Knownbugs 84 valt hier ook onder. De overige MCP-teksten volgen in F7.
- Extensie-API: `ExtTaskTime.scheduleDuration` heet nu "Duur in werkdagen" (`extTypes.ts:132-133`);
  `sdk.createTaskTime(start, durationDays)` (`sdk.ts:68`). Bij een dagenmaat-taak blijft dat waar (met een
  mogelijke breuk); bij een urenmaat-taak is het afgeleid. De nieuwe conventie verschijnt in
  `ExtProject.schedulingProfile`. `ExtProject.defaultTaskDurationUnit` (`extTypes.ts:42`) houdt zijn naam en
  betekent voortaan de standaardmaat. Een kleine versie omhoog (`EXTENSION_API_VERSION` `'1.4.1'`,
  `apiVersion.ts:42`, F7) volstaat.
- IFC-formaat: §5.4. Gidsen nl/en, i18n (inventaris: ±67 regels nl met werkdag/dagen) en `AGENTS.md`.

### 3.14 De dagenmaat als conventie (F3)

- **Sleutel:** een nieuwe conventie in `CONVENTIONS` (`src/engine/scheduler/conventions/registry.ts`),
  voorlopige naam `workdayDurationMeasure`. Ingebouwd: `{ p6: false, msproject: false, ops: true }`. Groep C,
  geen `requires`, `gatedByP6Source: false`. Het is de eerste conventie die in het OPS-profiel aan staat.
  Met de conventie van B6 (hieronder) telt het register dan negenentwintig conventies; de teksten die
  "zevenentwintig" noemen (`registry.ts:5`, `.claude/rules/rekenprofielen.md`), gaan mee.
- **Thema:** een nieuw thema `durations` ("duur en maat") naast de zes bestaande (`CONVENTION_THEMES`,
  `registry.ts:35-37`). Alleen weergave.
- **Motor:** de solver leest de sleutel uit `EffectiveSchedulingOptions`, zoals elke conventie
  (`verify:conventions` eist dat). Uit ⇒ een dagenmaat-taak, een lag in dagenmaat en een dagenmaat-rest tellen
  als urenmaat, met de werktijd per dag van de effectieve kalender.
- **Lopers voor de dagenmaat:** vooruit telt elke werkdag als 1, hoe lang ook; binnen een dag telt het deel van
  de werktijd van die dag. Achteruit telt op dezelfde manier terug. Een feestdag en een niet-werkdag tellen 0;
  een werkende uitzondering telt 1, ook met minder uren. De lopers komen in `CalendarEngine` naast de
  minutenlopers (`addWorkMinutes`, `CalendarEngine.ts:772`), met een check dat vooruit en dan achteruit binnen
  de foutgrens hieronder blijft.
- **Afronding en foutgrens (review ronde 1 punt 9; herzien na ronde 2 punt 8):** de lopers rekenen in hele
  minuten. Het deel van een dag wordt `Math.round(deel × werkminuten van die dag)`; een moment ligt dus altijd op
  een hele minuut. Een exacte spiegel is daarmee niet haalbaar. Voorbeeld van de review (BEVESTIGD): vrijdag 8 u,
  werkende zaterdag 1 u, begin vr 07:03, duur 1 d. Na vrijdag blijft 3/480 d over; op zaterdag is dat
  `Math.round(60 × 3/480)` = 0 min. Terug komt op vr 07:00: 3 minuten verschil. **Foutgrens:** vooruit en dan
  achteruit verschilt hooguit ½ + ½ × (werkminuten van de begindag ÷ werkminuten van de einddag) minuut. In het
  voorbeeld is dat 0,5 + 0,5 × 480/60 = 4,5 min; bij gelijke dagen hooguit 1 minuut. Afleiding: de einddag rondt
  af met hooguit een halve minuut van die dag; teruggeteld weegt dat op de begindag in de verhouding van de twee
  daglengtes, en de begindag rondt zelf ook een halve minuut af. Dit ontwerp bouwt geen verborgen rest om het
  verschil te voorkomen. Een breuk in werkdagen gaat met 6 decimalen naar de OPS-pset (`ifcDayNumber`,
  `ifcWriter.ts:121-137`); dat is nauwkeurig tot ruim onder een minuut.
- **Wisselen van profiel:** de taak verandert niet; alleen de conventie. Afwijkingen blijven letterlijk staan
  (`switchProfile`), dus P6 → OPS → P6 geeft het origineel.
- **Oude bestanden (technische keuze T12; de code vraagt hier iets anders dan de uitwerking).** Ontbreekt de
  sleutel in een bestand met `OPS_SchedulingProfile`, dan geeft het register `legacyValue`. Die is per
  constructie de OPS-waarde (functie `convention` in `registry.ts`; gebruikt in `schedulingOptionsRead.ts:224`).
  Tot nu toe is dat voor elke conventie `false`. Voor de dagenmaat zou het `true` zijn: een P6-project uit zo'n
  bestand kreeg dan een afwijking "dagenmaat aan" die niemand koos, en rekende niet zoals P6. Voorstel: voor
  deze conventie geldt bij een ontbrekende sleutel de waarde van de basis (een veld `legacyFromBase: true` in
  de beschrijving; `sanitizeSchedulingProfile` leest dan `builtIn[baseId]`). Dat wijkt af van de registerregel
  "nooit de basiswaarde" (`schedulingOptionsRead.ts:206`). Reden: vóór deze conventie was de maat geen
  profielkeuze, dus het bestand koos niets. Het raakt alleen bestanden met die pset: geschreven door `main` of
  de webversie na 2026-09-22; v2026.9.0 kent de pset niet (`git grep` op de tag: geen treffer). Bestanden
  zonder pset lopen via `legacyOptionsToProfile` (`schedulingProfileMigration.ts:94-118`): een XER-blob ⇒
  P6 zonder afwijking ⇒ uit (`legacyXerDefault` geeft `false`, `:54-58`); anders `ops` ⇒ aan, of
  `msproject` ⇒ uit.
- **Afwijking onder P6 of MSP:** "dagenmaat aan" als afwijking op een P6- of MSP-basis blijft mogelijk, zoals
  bij elke conventie; het profielblok toont het als afwijking. Wil de eigenaar dat die keuze daar niet bestaat,
  dan verbergt het profielblok hem.
- **IFC:** `OPS_SchedulingProfile` krijgt de sleutel erbij. `OPS_SchedulingOptions` (de laag voor oudere
  versies) niet: oudere versies kennen geen maat.
- **De conventie van B6 (F2):** een losse mijlpaal, of een FINISH-mijlpaal zonder voorganger, staat aan het einde
  van zijn werkdag. Voorlopige naam `milestoneWithoutPredecessorAtDayEnd`; ingebouwd
  `{ p6: false, msproject: false, ops: true }`; thema `milestones`, groep C. Voor een ontbrekende sleutel geldt
  dezelfde regel als T12 (de waarde van de basis). Gevolg in een oud OPS-bestand met een urenkalender: daar
  stond zo'n mijlpaal nu aan het begin (urenpad), dus hij verschuift; de melding van B5 telt hem.
- **Geen conventie voor B3 en B7:** de eigenaar koos daar exact rekenen, in elk profiel.

## 4. De afbeelding dag ⇒ uur

Dit is de kern. De vraag: als een plan in hele dagen wordt omgezet naar de tijdas in minuten, wanneer geeft het
dan dezelfde uitkomst op dagniveau? De meting (§10) is het bewijs bij elke regel.

### 4.1 De hoofdregel

Een plan blijft gelijk op dagniveau als aan vier voorwaarden is voldaan:

1. de taak telt in de dagenmaat (OPS-profiel), of elke werkdag van de taakkalender heeft dezelfde werktijd per
   dag (geen ongelijke dagen, geen werkende uitzondering met andere uren);
2. alle hoeveelheden zijn hele dagen (duur, lag, nivelleervertraging, rest);
3. elke datum zonder tijd is omgezet met de regels van §4.2;
4. de motor behandelt een blokeinde en het volgende blokbegin op de plekken uit §4.3 als dezelfde grens (regels
   N1–N3). Een algemene snapregel is het niet: invoer blijft rauw (N0).

Reden: vanaf een blokbegin eindigt n werkdagen in de dagenmaat altijd op het blokeinde van de n-de werkdag. In
de urenmaat geldt dat alleen als elke werkdag even lang is; dan telt elke werkdag in beide maten even zwaar.

Voorwaarde 4 bestaat nog niet overal. Dat is de oorzaak van groep 1, 5, 7, 10 en 12 uit de meting en van
knownbugs 139–142. F1 bouwt hem, op de plekken uit §4.3.

**Welke meting telt.** Alle 560 cases rekenen in het OPS-profiel: de harness maakt het profiel met
`legacyOptionsToProfile` (`tests/planning/harness.ts:626`), en geen case heeft een XER-blok of de twee
MSP-vlaggen (geteld met een script over alle `cases-*.json`). Na besluit B1 rekent het OPS-profiel een
bestaande dagtaak in de dagenmaat. Voor de dagcases is dus M2 (urenpad-dagtaak, 364 van 422 gelijk) de
maatgevende meting. M1 (urenpad-urentaak, 380 van 422) laat zien wat het P6- en het MSP-profiel met dezelfde
taken doen, op de andere conventies na.

### 4.2 Datums zonder tijd

**Startachtige taakvelden:** `scheduleStart`, `earlyStart`, `lateStart`, `actualStart`, `resume`, de datum van
SNET/SNLT/MSO, de start van een baseline-taak.

**Eindachtige taakvelden:** `scheduleFinish`, `earlyFinish`, `lateFinish`, `actualFinish`, `stop`, `deadline`, de
datum van FNET/FNLT/MFO, het einde van een baseline-taak en `projectEnd` van een baseline.

**Projectdatums** blijven opgeslagen zoals ingevoerd (§3.6). De motor leest ze met een vaste regel:
`project.startDate` met D1 (de vloer, `CPMSolver.ts:1628-1634`), `project.statusDate` met D5 en `project.endDate`
met D2. Het projecteinde begrenst de late kant als `useProjectEndDateForFloat` aan staat
(`CPMSolver.ts:3257-3262`, via `solveInput.ts:32`). Probe (BEVESTIGD, review ronde 1 punt 7): kalender ma-vr
08:00–16:00, urentaak ma 1 jun 08:00–16:00, projecteinde "2026-06-01" zonder tijd ⇒ late finish vr 29 mei 16:00,
speling −1. Met D2 (ma 16:00) ⇒ late finish ma 16:00, speling 0. Na F2 heeft elke engine werkblokken, dus zonder
D2 krijgt elk project met deze optie speling −1 op zijn laatste taak.

**Het anker van een externe link** volgt de kant van de externe taak: bij een externe voorganger de eerste
letter van het relatietype (FS, FF ⇒ eindachtig), bij een externe opvolger de tweede (FF, SF ⇒ eindachtig).
Zo zette de meting het ook om.

**Regels** (technische keuze T2; de functie komt in F1 in `CalendarEngine`, de normalisatie gebruikt dezelfde):

- **D1 startachtig:** het blokbegin van het eerste werkblok dat op die datum begint.
- **D2 eindachtig:** het blokeinde van het laatste werkblok dat op die datum begint. Bij een nachtblok
  (di 22:00–wo 06:00) is dat wo 06:00; de werkdag blijft di.
- **D3 kalendertijd-taak:** startachtig 00:00 van die datum. Eindachtig hangt af van het veld; zie de tabel
  hieronder.
- **D4 geen werkblok op die datum** (weekend, feestdag): gebruik de werkblokken van de typische werkdag op die
  datum. Een werkelijk einde op zaterdag 6 jun wordt dan za 16:00, niet zo 00:00. Reden: een werkelijke datum
  is een feit en blijft op zijn datum. MSP heeft daarvoor een standaard begin- en eindtijd (niet in MSP
  getoetst). Voor geplande datums maakt het geen verschil: de motor schuift ze toch naar de volgende werktijd.
  (De meting gebruikte hier nog middernacht; groep 11 komt daaruit voort.)
- **D5 statusdatum:** de motor leest hem als startachtig (D1). De statusdatum is het moment waarop het restwerk
  begint (`src/types/project.ts:548-550`: "restwerk start niet vóór deze datum"). Gemeten: als begin van de dag
  3 rode dagcases in `cases-progress`, als einde van de dag 17. Opgeslagen blijft hij zoals ingevoerd (§3.6).
- **D6 werkelijk einde op de statusdag:** een werkelijk einde zonder tijd op de statusdatum wordt het einde van
  die werkdag (D2), ook al ligt dat na het statusmoment van D5. De motor klemt een werkelijk einde niet meer op
  het statusmoment. Reden: in het dagpad mogen beide op dezelfde dag vallen, en een werkelijke datum is een feit.
  De invoer moet dit ook toelaten; zie de statusregel hieronder. F1 zoekt de klem die groep 9 rood maakt (niet
  vastgesteld in dit ontwerp).
- **D7 mijlpaal (fixronde 2):** een mijlpaal heeft één moment voor al zijn start- en eindvelden. Een datum zonder
  tijd wordt D2 bij een FINISH-mijlpaal en D1 bij een START-mijlpaal (`MilestoneKind`,
  `src/types/task.ts:177-182`). Zonder soort beslist de hint `AtDayEnd` in `OPS_Milestone`: de schrijver zet hem
  op een ankerkalender als de mijlpaal op het einde van zijn werkdag staat. Zonder hint (oud bestand, ander
  programma) D1. Reden: met alleen D1 en D2 per veld krijgt een mijlpaal begin 07:00 en einde 16:00. Dan is hij
  op een ankerkalender nooit afleidbaar, en wordt elke kalender met een mijlpaal letterlijk (§3.6). Of D1 voor een
  oud bestand de werkelijke datum van een voltooide mijlpaal zonder soort gelijk houdt op dagniveau, toetst F0
  met een dagcase (VERMOED).

**D3 per veld: wat de datum van een kalendertijd-taak nu betekent** (review ronde 1, punt 8). Het dagpad schrijft
het einde als start + n kalenderdagen, maar leest de datum daarna als inclusief. Probes (BEVESTIGD, harness):
een kalendertijd-taak van 1 d vanaf ma 1 jun krijgt `earlyFinish` 2 jun; haar FS-opvolger begint wo 3 jun; met
FNLT ma 1 jun krijgt ze speling −1; een werkelijk einde 2 jun (ingevoerd) laat de opvolger wo 3 jun beginnen.

| Veld van een kalendertijd-taak | Wie schrijft het nu | Betekenis van de datum | Omzetting |
|---|---|---|---|
| `earlyFinish`, `scheduleFinish` | de motor: start + n kalenderdagen | exclusief: 00:00 van die datum | 00:00 van die datum |
| `lateFinish` | de motor: opvolgerstart − 1 kalenderdag (`addCalendarDays(target, -1)`, zie `msp-18`) | inclusief: einde van die datum | 24:00 van die datum |
| einde van een baseline-taak | kopie van het getoonde einde (`shownFinish`, `baselineSlice.ts:41`): `actualFinish` bij een voltooide taak, anders `earlyFinish` (`taskDates.ts:63-65`) | die van het veld waaruit hij kwam; dat staat niet in het bestand | dezelfde omzetting als het veld waaruit `shownFinish` bij het openen leest: voltooid (`isPinnedComplete`) ⇒ 24:00, anders 00:00; taak bestaat niet meer ⇒ 00:00 |
| `actualFinish` | de planner, of `defaultActualFinish` (statusdatum of `earlyFinish`, `taskMutationRules.ts:29-34`) | inclusief bij invoer | 24:00 van die datum |
| FNET/FNLT/MFO, `deadline`, `stop` | de planner | inclusief | 24:00 van die datum |

Gevolg: een werkelijk einde dat uit `earlyFinish` is overgenomen, schuift een dag op; de melding van B5 telt het.
Na de omzetting is het einde overal exclusief. Wat daardoor bewust anders uitkomt (groep 6), staat in §4.5.

**Het baseline-einde (review ronde 2, punt 7, BEVESTIGD).** De eerdere regel (altijd 00:00) maakte een afwijking
die alleen uit de omzetting kwam. Probe van de review: werkelijk einde en pas opgeslagen baseline-einde zijn beide
2 jun; de oude regel maakte daar 3 jun 00:00 en 2 jun 00:00 van, een dag afwijking. Nu krijgt het baseline-einde
dezelfde omzetting als het getoonde einde waarmee de afwijking het vergelijkt (`variance.ts:69`, `:79`). Beide
schuiven dus even ver: een passende baseline (afwijking 0) blijft passend, en de afstand in kalendertijd tussen
baseline en getoond einde blijft gelijk. Grens: een baseline uit de tijd dat de taak nog niet voltooid was, kwam
uit `earlyFinish` en krijgt nu 24:00. Welke betekenis hij toen had, staat nergens; de regel kiest daarom voor de
vergelijking van nu. Regressie (F2): een oud bestand met een voltooide kalendertijd-taak en een baseline die
direct na het voltooien is opgeslagen ⇒ afwijking 0; dezelfde taak met een baseline-einde twee dagen eerder ⇒ de
afstand blijft twee kalenderdagen. Het begin van een baseline-taak is startachtig (00:00), net als `actualStart`
en `earlyStart`; daar speelt het niet.

**De statusregel (F1, technische keuze T19; review ronde 1, punt 6).** Nu vergelijkt `isActualPastStatusDate`
(`taskMutationRules.ts:11-16`) op dagniveau als de statusdatum geen tijd heeft, en op het moment als hij wel een
tijd heeft. Probe (BEVESTIGD): statusdatum wo 07:00 (zo zou D5 hem opslaan), werkelijk einde wo 16:00 (D6) ⇒
geweigerd; statusdatum "wo" zonder tijd ⇒ toegestaan. Paneel, dialoog, raster, MCP en rapport gebruiken deze ene
functie (`taskDialogSave.ts:77`, `taskEditPlan.ts:621,746`, `progressEntry.ts:100,111,172`,
`mcpValidation.ts:203-206`, `dcmaAssessment.ts:384-385`). Daarom één gedeelde regel:

1. **Statusdatum zonder tijd** (zoals ingevoerd): een werkelijke datum is toegestaan als zijn werkdag niet na de
   statusdag ligt. Een datumloos werkelijk einde op de statusdag wordt D2 (D6). Een werkelijke datum met tijd mag
   tot het einde van de statusdag.
2. **Statusdatum met tijd:** vergelijking op het moment, zoals nu. Een datumloze werkelijke datum op de statusdag
   wordt D1 of D2, maar nooit later dan het statusmoment.
3. De functie krijgt de kalender van de taak mee, zodat "werkdag" ook bij een nachtblok klopt.

Regressiegevallen: status "wo 3 jun", werkelijk einde "wo 3 jun" ⇒ toegestaan, opgeslagen wo 16:00; status
"wo 3 jun 12:00", werkelijk einde "wo 3 jun" ⇒ opgeslagen wo 12:00; status "wo 3 jun 12:00", werkelijk einde
"wo 3 jun 14:00" ⇒ geweigerd. Elk in de dialoog, het raster en via MCP.

**De 24:00-regel (technische keuze T3):** een eindmoment om 00:00 hoort bij de werkdag ervoor. Een taak op een
24-uurskalender die 1 d duurt vanaf ma 00:00, eindigt di 00:00 en heeft werkdag ma. Dat geldt voor de weergave
(B4) en voor de vergelijking op dagniveau. Probe: urentaak 24 u op een 24-uurskalender ⇒ eindmoment
`2026-06-02T00:00`; de dagtaak van 1 d ⇒ `2026-06-01`. Met de 24:00-regel zijn ze gelijk op dagniveau.

### 4.3 Grenzen tussen werkblokken

Een eindmoment op een blokeinde en het volgende blokbegin liggen op de tijdas uit elkaar, maar er zit geen
werktijd tussen. Een algemene snapregel breekt bestaande orakels (review ronde 1, punt 5, BEVESTIGD in de case
zelf): `z13-root-anchor-band-eind-rauw` (`cases-advanced-cpm.json`) verlangt voor een urentaak van 24 u met een
rauw anker op ma 16:00 (het laatste blokeinde) start ma 16:00 en einde wo 16:00. Een algemene regel "start op een
blokeinde ⇒ volgend blokbegin" geeft di 08:00 en do 16:00; het mutatiebewijs in de case meet precies dat. Dit
gedrag komt uit MSP (corpusbestand `timephased-prorated-cost-resource.mpp`). P6 bewaart bewust de gedeelde grens
als opvolgerstart (`p6StartAtPredecessorFinishBoundary`, `relationMath.ts:649`). T11 vangt dit niet af: het zijn
urentaken op een urenkalender.

Daarom zijn de grensregels beperkt (technische keuze T4, herzien):

- **N0, invoer blijft rauw.** Een moment dat de motor als invoer krijgt, verandert niet: een rauw wortelanker op
  het laatste blokeinde (`ownAnchor` en `isExactBandEnd`, `CPMSolver.ts:1112-1131`, gebruikt op `:1212`, `:1232`
  en `:1509`), een P6-grens (`relationMath.ts:649`), een rauw mijlpaalmoment (`landRawInstant`,
  `relationMath.ts:641`, `:712`, `:746`), letterlijke werkelijke tijden en constraintmomenten (conventies A18 en
  A20), een handmatig geplande taak en een kalendertijd-taak.
- **N1, alleen op drie plekken:** een eindmoment dat de motor zelf afleidt en dat op een blokbegin valt, wordt het
  vorige blokeinde. Alleen voor (a) een FINISH-mijlpaal na een eindrelatie (groep 1; VERMOED plek
  `CalendarEngine.ts:705`, `:885-888`), (b) de late finish bij een externe opvolger (groep 10, knownbugs 141,
  `CPMSolver.ts:2954-2956`) en (c) het einde van een dagenmaat-taak via een FF-relatie, een eindbeperking of een
  hangmat (groep 12, knownbugs 142).
- **N2, alleen op één plek:** een nivelleervertraging die op een blokeinde eindigt, gaat naar het volgende
  blokbegin (groep 7, knownbugs 140, `CPMSolver.ts:1382`).
- **N3, alleen bij vergelijken:** bij het bepalen van een schending telt een blokeinde gelijk aan het volgende
  blokbegin (groep 5, knownbugs 139, `scheduleAnalysis.ts:418,420-421`).
- Een mijlpaal zonder soort volgt de bindende relatiekant, zoals nu (`MilestoneKind`, `src/types/task.ts:177-182`):
  FS/SS ⇒ START, FF/SF ⇒ FINISH.
- **Regressiegevallen:** de vijf `z13-*`-cases en alle 138 urencases blijven ongewijzigd groen. Lukt een plek uit
  N1 alleen door een urencase te veranderen, dan beperkt F1 die plek tot dagenmaat-taken en FINISH-mijlpalen.
  Elke plek krijgt een eigen case en een mutatiebewijs.

### 4.4 Per onderwerp

"Gelijk" = gelijk op dagniveau na F1. "Groep" verwijst naar §10.

| Onderwerp | Dagpad nu | Urenpad nu | Doel | Gelijk? | Bewijs |
|---|---|---|---|---|---|
| Duur, hele dagen, gelijke dagen | laatste werkdag inclusief | blokeinde laatste werkdag | blokeinde | ja | M1 380/422, M2 364/422 groen; `calendar`, `float`, `driving` volledig groen in beide |
| FS, lag ≥ 0 | volgende werkdag + lag | eindmoment + lag in minuten | zelfde | ja | probe FS+0 en FS+1 ed gelijk; FS-cases in `relations` groen |
| FS, negatieve lag | idem, terug | idem | zelfde | ja | probe FS−2 gelijk |
| SS | start + lag | start + lag | zelfde | ja | probe SS+2 gelijk |
| FF | einde + lag, inclusief | eindmoment + lag | N1 | ja na F1 | urenpad-urentaak groen; urenpad-dagtaak één werkdag te laat (groep 12, knownbugs 142) |
| SF | einde opvolger op de startdag van de voorganger (inclusief: één dag overlap) | einde opvolger = startmoment voorganger | urenpad (MSP), elk profiel (T8) | **nee**, opvolger één werkdag eerder | groep 3: 6 cases in M1, 3 in M2; probe SF+0 |
| Mijlpaal na FS (START) | volgende werkdag | volgend blokbegin | zelfde | ja | probe gelijk |
| Mijlpaal FINISH na FF of finish-relatie | einddag voorganger | volgend blokbegin (fout) | N1: blokeinde | ja na F1 | groep 1, 7 cases |
| Losse mijlpaal, of FINISH zonder voorganger | einde van de werkdag | begin van de werkdag | OPS: einde (B6, conventie); P6 en MSP: begin (MSP) | OPS: ja; P6 en MSP: **nee**, speling +1 d of opvolger een dag eerder | groep 2, 7 cases in M1 en M2 |
| SNET, SNLT, MSO | dagbegin | blokbegin | D1 | ja | probe SNLT gelijk |
| Zachte MSO/SNLT op een blokbegin | — | "geschonden" (fout) | N3: geen schending | ja na F1 | groep 5, knownbugs 139 |
| FNET, FNLT, MFO | dageinde | datum zonder tijd = 00:00 (fout) | D2 | ja na F1 | probe FNET en FNLT datum zonder tijd; groep 1 (`cst-fnet`) |
| Deadline | dageinde | 00:00 van die dag (fout) | D2 | ja na F1 | groep 4, knownbugs 138 |
| Statusdatum | begin van de dag | moment | opgeslagen zoals ingevoerd; de motor leest D5 | ja | 3 rood als begin, 17 als einde |
| Projecteinde met `useProjectEndDateForFloat` | einde van de dag | datum zonder tijd = 00:00 (fout) | de motor leest D2 | ja na F2 | probe: speling −1 ⇒ 0 (§4.2) |
| Voortgang % | dagtaak: rest afgerond op hele dagen, in beide paden (`CPMSolver.ts:2314-2318`) | urentaak: rest op de minuut | minuut, elke maat en elk profiel (B3) | **nee** als de rest geen geheel getal is | probe 32 %: dagtaak einde vr 06-05, exact ma 06-08 10:12 |
| Werkelijk einde op de statusdag | toegestaan | geklemd | D6 en de statusregel | ja na F1 | groep 9, 2 cases; probe statusregel (§4.2) |
| Kalendertijd | einde = start + n kalenderdagen, daarna inclusief gelezen | exclusief eindmoment (zo pint `msp-19` het al) | exclusief, D3 per veld | **nee**: opvolger tot een werkdag eerder, meer speling | groep 6 (zie §4.5 en §10.3); probes e1, e3b, e4 (§4.2) |
| Feestdag | hele datum vrij | werkblokken die die dag beginnen vervallen | zelfde | ja bij dagwerk | `calendar` groen; `kalenders` groen op de SF-case na (M1) |
| Nachtblok over middernacht | n.v.t. | blok hoort bij de begindag | werkdag van een moment | ja op werkdag | niet gemeten |
| Ongelijke dagen | elke werkdag telt 1 | uren tellen | OPS: dagenmaat; P6 en MSP: urenmaat (B1) | OPS: ja; P6 en MSP: **nee** | probe voorbeeldweek: dagtaak 5 d vr 14:00, 40 u ma 09:00 |
| Werkende uitzondering met minder uren | telt als hele dag | uren tellen | OPS: dagenmaat; P6 en MSP: urenmaat (B1) | OPS: ja; P6 en MSP: **nee** | probe za 4 u: 48 u ⇒ ma 11:00, dagtaak 6 d ⇒ za |
| 24-uurskalender | einde = startdag | einde 00:00 volgende dag | 24:00-regel | ja | probe |
| Procentlag | afgerond op hele dagen (`CPMSolver.ts:261-264`) | op de minuut, ook bij een dagtaak (`:1395-1397`) | minuut, elk profiel (B7) | **nee** bij oneven helften | groep 8, 2 cases in M1 en M2 |
| Nivelleervertraging | hele dagen | minuten, verdwijnt op een blokeinde (fout) | minuten + N2 | ja na F1 | groep 7, knownbugs 140 |
| Externe opvolger | vorige werkdag van het anker | anker op blokbegin (fout) | N1 | ja na F1 | groep 10, knownbugs 141 |
| Handmatig geplande taak | datum | datum zonder tijd wordt middernacht | D4 | ja na F1 | groep 11 |
| Hangmat | eigen regels | urenpad-urentaak goed, urenpad-dagtaak één dag te laat | N1 | ja na F1 | groep 12 |

### 4.5 Wat bewust niet gelijk blijft

Deze verschillen zijn geen fout. Ze volgen uit de opdracht ("omdat MSP en P6 dit ook doen"), uit de besluiten
B1, B3 en B7, en uit het exclusieve einde. Elk krijgt in de dagcases een redencode (§6.1). Of MSP en P6 het echt
zo doen, is niet in die programma's getoetst; F1 legt het vast in een check met een bron.

| # | Verschil | OPS-profiel | P6- en MSP-profiel |
|---|---|---|---|
| 1 | **SF (groep 3):** de opvolger eindigt op het startmoment van de voorganger, niet op diens startdag. Voorbeeld `rel-sf-lag-p1`: dagpad B eindigt vr 06-05, urenpad do 06-04 16:00 | ja (T8) | ja |
| 2 | **Losse mijlpaal en FINISH-mijlpaal zonder voorganger (groep 2):** de mijlpaal staat aan het begin van de werkdag. Voorbeeld `ms-02-lone-vs-task`: speling 2 ⇒ 3 | nee (B6: einde, conventie) | ja |
| 3 | **Procentlag (groep 8):** op de minuut, niet afgerond. `lagadv-pct-fs50-odd-roundup` en `lagadv-pct-lead-halftie` veranderen | ja (B7) | ja |
| 4 | **Voortgang %:** rest op de minuut | ja (B3) | ja |
| 5 | **Ongelijke dagen en werkende uitzonderingen met andere uren:** een dagenmaat-taak telt als urenmaat | nee (B1) | ja |
| 6 | **Einde van een kalendertijd-taak (groep 6, deels):** het einde is exclusief. Een FS-opvolger begint op het eerste werkmoment na het einde, en de taak krijgt de speling in kalendertijd, ook over de nacht en het weekend. Voorbeelden: `msp-18` speling 0 ⇒ 1 d; `msp-20` speling van B 0 ⇒ 0,625 d (de nacht wo 16:00–do 07:00); `msp-21` 2 ⇒ 3; probe e1: opvolger wo ⇒ di. In uur-modus pint `msp-19` dit gedrag al als juist | ja (T16) | ja |

Uitzondering bij 2: `mk-05a` krijgt een late finish om 13:00 (een blokbegin na de pauze); dat lijkt een fout
(VERMOED) en hoort bij F1.

**De rest van groep 6 is geen verschil maar werk voor F1.** `msp-27` (kalendertijd-opvolger via SS+0 schuift van
za naar ma) is een bekende fout van het urenpad; `msp-28` pint die fout in uur-modus met de tekst "GEPIND (huidig,
FOUT)". F1 repareert hem, en `msp-28` draait dan om. `lagadv-ff-lead-ed` is rood op taak C met een lag in
werkdagen, niet op de kalendertijd-lag; VERMOED hoort hij bij groep 12 (FF).

## 5. Migratie en forward-compat

### 5.1 Alle opgeslagen data

| Bron | Waar | Wat er gebeurt |
|---|---|---|
| IFC-bestand (eigen formaat) | `ifcReader.ts` | via `payloadFromImport`, zie 5.2 |
| Herstelbestand (crash) | IFC-tekst (`useAutoSave.ts:138`, `recoveryStore.ts:13`) | zelfde route (`payloadFromInput` roept `payloadFromImport` aan) |
| Opslag op de site (`window.openaecHost`) | IFC via `siteHost.ts` | zelfde route |
| Undo-snapshots | alleen in het geheugen | geen migratie: ze ontstaan pas na het laden |
| Resourcebibliotheek | IndexedDB `ops-library` / `ops-library.json` (`libraryStore.ts:4,13`) | kalenders blijven scalair (§3.1); geen omzetting nodig |
| WBS-sjablonen | `localStorage` (`src/utils/wbsTemplates.ts`; `durationDays` uit `scheduleDuration`, r.93) | omzetten bij het toepassen, niet bij het lezen; zie de bijvangst onder deze tabel |
| Werktijdpresets | `localStorage` `ops-workTimePresets` (`settingsStore.ts:561-567`) (inventaris) | al werkblokken; niets |
| Baselines | in het IFC-bestand (`src/types/baseline.ts:11-13,36-37`) | datums met de regels van §4.2 (het einde bij kalendertijd zoals het getoonde einde); duur in werkdagen blijft, minuten erbij (F3) |
| Imports MSPDI, .mpp, P6 XML, XER, CSV | adapters | omzetting bij het lezen (F5a en F5b); daarna dezelfde normalisatie in `payloadFromImport` |

Bijvangst: een WBS-sjabloon bewaart van een urentaak het afgeleide dagengetal (`scheduleDuration`, r.93), niet
de minuten. Dat valt buiten dit ontwerp en hoort in `knownbugs.md` als het bevestigd is (niet getoetst).

### 5.2 Eén migratiefunctie op de laadgrens

**De laadgrens (review ronde 1, punt 1, BEVESTIGD).** Een laadroute die rekent, rekent vóór `hydratePayload`:
`applyLoadedProject` bouwt de payload (`payloadFromImport`, `fileSlice.ts:766`), rekent in
`prepareLoadedPayload` (`fileSlice.ts:790`; `documentActivation.ts:262-279`, de solve op `:274`) en publiceert pas
daarna (`hydratePayload`, `fileSlice.ts:813`). Openen (`fileSlice.ts:1021`, `:1490`), `loadState`
(`projectSlice.ts:596`) en het herstel van het actieve document (`documentSlice.ts:629-630`) rekenen zo. Het laadpad
wist ook de undo-historie van het document (`removeSessionHistoryForDocumentFromState`, `fileSlice.ts:809`) en
pusht zelf geen snapshot (`documentActivation.ts:318-321`). De eerdere plek in het documentcontract (`fromPayload`,
`documentContract.ts:245-247`) loopt pas bij het publiceren, dus na de eerste berekening.

- **Waar:** een zuivere functie `migrateToMinuteModel(payload) ⇒ { payload, report }` (naam voorlopig) aan het
  einde van `payloadFromImport` (`documentContract.ts:461`). Elke laadroute loopt daar door: openen, `loadState`,
  site, extensie-import, het actieve herstelde document en de slapende herstelde documenten
  (`payloadFromInput`, `documentContract.ts:446-455`, aangeroepen op `documentSlice.ts:629` en `:660`). In F0
  gebouwd en getest, in F2 aangesloten.
- **Wat: twee delen.**
  - *Normalisatie* (altijd, T17): elke datum zonder tijd in een startachtig of eindachtig taakveld wordt een
    moment (D1–D7). Een moment blijft een moment. Dit draait voor elk bestand, ook voor een nieuw bestand met
    `TimeModel`, want ook zo'n bestand draagt datums zonder tijd (een ankerkalender, §3.6; een ander programma).
  - *Schemamigratie* (alleen een oud bestand): kalenderherstel T1, de profielregel T12, en de documentvlag
    "omzetting open" voor B5 (hieronder).
- **De vastlegging van "datums zoals opgeslagen" (review ronde 2, punt 3, BEVESTIGD).** Die zit niet in de payload
  maar in `parsed.recordedTimes`. `applyRecordedTimesToTasks` schrijft haar waarden later rechtstreeks in de taken
  (`src/engine/scheduler/recordedDates.ts:486-505`). De `.mpp`-lezer zet daar datums zonder tijd in (`formatField`,
  `mppReader.ts:791-792`, gebruikt op `:922-923`), en die lezer blijft tot F5b. Probe van de review: payload met
  07:00–16:00; na `applyRecordedDatesOnLoad` staat weer 2026-06-01 zonder tijd in de taak. Regel: de enige toegang,
  `captureAllowed` (`documentActivation.ts:362-367`), krijgt de kalenders van de payload mee en normaliseert elke
  vastgelegde waarde vóór de vergelijking (`shiftedTaskIds`) en vóór de publicatie. Elke waarde krijgt de regel van
  het taakveld waarin ze terechtkomt (`recordedDates.ts:494-497`, `:504`): `start` en `lateStart` startachtig,
  `finish` en `lateFinish` eindachtig, `summaryProgress.actualStart`/`actualFinish` als werkelijke datums, met D3 en
  D7 waar die gelden. Zo geldt het op beide paden: `applyRecordedDatesOnLoad` (`:375`) en `applyRestoredRecordedMode`
  (`:440`). De bron zelf (`recordedFields`, het XER-archief) blijft onveranderd.
- **De markering:** `OPS_Project.TimeModel = 'MINUTES-1'`. Ze betekent: "de datums in dit bestand zijn met het
  minutenmodel berekend". Ze stuurt alleen de schemamigratie en de B5-overgang. De schrijver zet haar vanaf F2,
  behalve zolang de vlag "omzetting open" aan staat. Zo komt de overgang terug na opslaan of na een crash, als
  het document nog niet omgezet was. Hoe de lezer tijden leest, hangt niet aan deze markering maar aan
  `LiteralTimes` per kalender (§3.6). De normalisatie draait altijd.
- **Deterministisch en idempotent:** twee keer draaien geeft hetzelfde.

**B5: de overgang van een oud bestand (besluit B5, uitgewerkt; technische keuze T22; herzien na review ronde 2,
punt 1 en 4, en ronde 3, punt 1 en 3).**

- **De vlag "omzetting open":** een documentveld (naam voorlopig `minuteModelPending`) in `DOCUMENT_FIELDS`,
  met snapshot zoals `datesAsRecorded` (`documentContract.ts:272`), niet in IFC. De schemamigratie zet hem aan
  bij een oud bestand. De B5-overgang zet hem uit. Opent het laadpad het document in de modus "datums zoals
  opgeslagen" omdat het bestand zo is opgeslagen, dan gaat hij ook uit (zie onder).
- **Eén functie voor de overgang (review ronde 3).** Eén zuivere functie (naam voorlopig
  `minuteModelTransition`, in `src/state/`) doet het hele protocol. Invoer: de onberekende payload, de berekende
  payload en de vastlegging. Uitvoer: de vóór-toestand, de berekende payload met de vlag uit, de verschoven taken
  en de melding. Elke route roept alleen deze functie aan. De routes verschillen in één ding: registreert de
  route het event zelf, of zit de overgang al in een omvattend event (route 3). Geen aanroeper bouwt een eigen
  versie.
- **De vóór-toestand is de modus "datums zoals opgeslagen" (review ronde 3, punt 1, BEVESTIGD).** In ronde 2 was
  de vóór-toestand onberekend en verouderd (`scheduleStale: true`). Met Automatisch berekenen aan plant
  `useAutoCalcCPM` dan na 100 ms een `runCPM` (`useAutoCalcCPM.ts:23-30`), en die maakt de Ctrl+Z ongedaan. Probe
  van de review: na Ctrl+Z 15 jun, kort daarna weer 1 jun. Nu is de vóór-toestand de onberekende payload in de
  modus:
  - *De vastlegging* = de datums die het document vóór de berekening toonde. Op het laadpad (route 1): de
    ingelezen slots (`recordedFields`), via dezelfde normaliserende vastlegging als achter `captureAllowed`
    (`documentActivation.ts:362-367`), maar zonder de bronpoort; een eigen IFC zonder bron komt daar niet door
    (`:354-355`). Op de andere routes: begin, einde, laat begin en laat einde zoals ze nu in de taken staan, als
    kant-en-klare vastlegging (laag 0, `recordedDates.ts:204-215`).
  - *De toestand:* `recordedDates` met die vastlegging, met `shifted` en `shiftedTaskIds` (zie "Alleen bij een
    verschuiving") en `origin: 'ifc-own'`, zonder `sourceFormat`; `datesAsRecorded: true`; `cpmResult` uit
    `applyRecordedTimesToTasks` (`recordedDates.ts:486`); `scheduleStale: false`; de vlag aan. Dat is de toestand
    die `enterRecordedDatesMode` nu al maakt (`documentActivation.ts:409-415`), plus de vlag.
  - *Na Ctrl+Z* ziet de planner de opgeslagen datums met de bestaande strook "Je ziet de datums zoals ze in het
    bestand staan; bij herberekenen wijkt 1 taak af." (`recordedDates.activeCountNeutral`,
    `src/i18n/locales/nl/common.json:1043-1044`) en de knop Herberekenen. Automatisch berekenen doet niets, want
    het document is niet verouderd (`useAutoCalcCPM.ts:23`). `markScheduleStale` doet in de modus niets
    (`scheduleStale.ts:8`).
  - *De datums blijven staan* tot een van twee dingen gebeurt. (a) Bereken: `runCPM` in de modus pusht zelf een
    snapshot (`scheduleSlice.ts:110-113`), dus één nieuw event. (b) Een echte planningsbewerking: die verlaat de modus
    in haar eigen event (`markDateMutation`, `scheduleStale.ts:15-25`), en `useExitRecordedDates` rekent direct
    daarna, ook met Automatisch berekenen uit (`useExitRecordedDates.ts:55`; `needsExitRecompute`,
    `recordedDatesExit.ts:61-68`). Een bewerking die de planning niet raakt (een naam), laat de modus staan, ook via
    MCP (route 3, hieronder). In beide gevallen doet `runCPM` met de vlag aan de overgang: melding en vlag uit.
  - *Probe van deze ronde* (BEVESTIGD, §10.5): met deze vóór-toestand, Automatisch berekenen aan en de twee hooks
    regel voor regel nagebouwd, staat B na Ctrl+Z ook na 250 ms op 15 jun, zonder berekening; na een naamwijziging
    ook. F5 geeft 1 jun met één nieuw event; een tweede Ctrl+Z weer 15 jun. Een taak verwijderen in de modus
    rekent meteen door (1 jun, niet verouderd), en één Ctrl+Z geeft de modus met 15 jun en de taak terug.
    Controle met de vóór-toestand van ronde 2: na 250 ms weer 1 jun.
- **Het event: twee snapshots, één event.** `before` = `snapshotOfPayload(vóór-toestand)`, `after` =
  `snapshotOfPayload(berekend)` (`snapshot.ts:114`), één event via `recordSessionHistoryDeltas`
  (`sessionHistory.ts:459-480`) met `nonEdit: true` zoals F5 (`sessionHistory.ts:88-98`). Geen `beginUndoable`:
  `createSnapshot` leest via `originalAppState` de toestand van vóór de hele producer (`snapshot.ts:95-103`); op
  het laadpad is dat het vorige document (review ronde 2, BEVESTIGD: Ctrl+Z maakte het geladen project leeg). Op
  route 1 gaat alles in één `set`: historie van het document wissen (`fileSlice.ts:809`), de berekende payload
  publiceren (`hydratePayload`, `:813`) en het event registreren. De berekende payload komt uit
  `prepareLoadedPayload(payload, { recompute: true })` (`fileSlice.ts:790`) met de bibliotheekgrens
  (`materializeLibraryBoundary`, `:799`); die grens zit alleen in `after`. Staat het document al in de modus (na
  Ctrl+Z), dan pusht `runCPM` zelf de snapshot, en voegt de functie alleen de melding en de vlag toe.
- **Alleen bij een verschuiving.** Het event, de melding en `isDirty` komen alleen als minstens één taak
  verschuift. Dat is een technische keuze van de orkestrator (2026-10-20), geen besluit van de eigenaar:
  "`isDirty` alleen bij een daadwerkelijke verschuiving, niet na iedere herberekening van een oud bestand".
  Verschuiven = de taak staat in `shiftedTaskIds` (`recordedDates.ts:301-308`): het getoonde begin of einde
  (`recordedDatesDeviate`, `:276-290`) verschilt van de vastlegging. Dat is precies de telling van de strook. Zo
  tonen melding, event en strook één getal. (Ronde 2 vergeleek op dagniveau. Dan kon de strook na Ctrl+Z een
  ander getal tonen dan de melding, en een verschil binnen een werkdag was niet met Ctrl+Z terug te halen.)
  Verschuift er niets, dan geen event, geen melding, en `isDirty` blijft `false`; de vlag gaat wel uit. Undo en
  redo maken een document altijd gewijzigd (`snapshot.ts:225-228`).
- **Melding:** één melding via het meldingskanaal, na de publicatie. Ze telt de verschoven taken en noemt de
  grootste verschuiving in werkdagen, met één decimaal. Gaat het om een ander document dan het actieve, dan noemt
  ze dat document.
- **Elke route die blijvend rekent, kent de vlag (review ronde 2, punt 4; ronde 3, punt 3).** Gevonden met grep op
  `solveProject(`, `runInScratchDocument(` en `runCPM()` in `src/` (24 aanroepen van `runCPM()`; `qaScenes.ts:165` is
  alleen voor ontwikkeling, en `retainActiveDocument.ts:197` rekent na `loadState`, dus na route 1, als de vlag al uit
  is):
  1. *Het laadpad:* openen, `loadState`, site, extensie-import (`fileSlice.ts:760-813`) en het actieve document
     bij herstel (`documentSlice.ts:629-695`, de historie gaat daar op `:695` weg). De overgang direct, zoals
     hierboven.
  2. *`runCPM` zonder omvattend event* (`scheduleSlice.ts:85-147`) met de vlag aan: F5 (`useKeyboardShortcuts.ts:77`,
     `shortcutRegistry.ts:188`), de knoppen Bereken en Herberekenen (`ribbonConfig.tsx:123`,
     `RecordedDatesNotice.tsx:45`, `WarningsPanel.tsx:160`), Automatisch berekenen (`useAutoCalcCPM.ts:30`), de
     exportwacht (`fileSlice.ts:1079`, `:1244`; de PDF-export, `ReportPanel.tsx:1275`), `recalculate` van de
     extensie-API (`extensionApi.ts:304`) en `ensureFreshSchedule` (`src/services/mcp/staleGuard.ts:57`). De overgang
     registreert een eigen event en ververst niet het `after` van het vorige event
     (`refreshLatestDocumentDataHistoryAfter`, `scheduleSlice.ts:131`, `:147`). Zo landt de verschuiving niet in een
     eerdere bewerking. Dit dekt ook een slapend hersteld document na activeren. `switchDocument` rekent zelf niet
     (`documentActivation.ts:421`).
  3. *Binnen een omvattend event:* een MCP-transactie (`createMcpTransactions.ts`, `runCPM` op `:1100`), een
     bulkbewerking (`batchTool.ts:235`), de bibliotheekverdeling over slapende documenten (`runInScratchDocument`,
     `librarySlice.ts:1391`; het event op `:1436`), en elke actie die direct na haar eigen mutatie zelf `runCPM`
     aanroept: `applyLeveling` (`scheduleSlice.ts:224`), `clearLeveling` (`:246`), `setProject`
     (`projectSlice.ts:254`), `moveProject` (`:376`), de profielwissel (`schedulingProfileSlice.ts:79`), de twee
     voortgangsimporten (`fileSlice.ts:1316`, `:1419`), het kalendervenster na `commitCalendarLibrary`
     (`CalendarDialog.tsx:88`) en `useExitRecordedDates` (`useExitRecordedDates.ts:55`, de herberekening na een
     bewerking die de modus verliet). Het event van zo'n actie heeft de toestand van vóór de actie al als `before`. De
     aanroeper geeft `runCPM` daarom één optie mee ("binnen een event"). De functie registreert dan geen eigen event,
     maar telt, meldt en zet de vlag uit, en `runCPM` ververst het `after` van dat event zoals nu. De meldingen van
     een scratch-run gaan pas na de publicatie naar het kanaal (`librarySlice.ts:1379-1383`, `:1473`). Ctrl+Z van zo'n
     event geeft de toestand van vóór de actie terug, met de vlag aan. Stond het document toen in de modus, dan blijft
     het daar. Was het verouderd en staat Automatisch berekenen aan, dan volgt route 2: een eigen event met de
     melding, en Ctrl+Z daarvan geeft de modus. Met Automatisch berekenen aan is een actief document met de vlag
     alleen kort verouderd: route 2 zet het binnen 100 ms om.
     - *MCP: alleen metadata houdt de modus (review ronde 4, BEVESTIGD).* Nu roept de MCP-transactie na elke
       datawijziging `runCPM` aan (`dataChanged`, `createMcpTransactions.ts:1094-1103`), en `runCPM` verlaat de
       modus (`scheduleSlice.ts:110-113`). Probe van de review: na de B5-overgang en Ctrl+Z wijzigt
       `planner_update_tasks` alleen `fields.name`, en B springt van 15 jun 07:00 naar 1 jun 07:00, modus uit. Dat
       gebeurt nu al in elke importmodus (knownbugs 152, BEVESTIGD in Node met de echte tool). Regel: de transactie
       gebruikt dezelfde classificatie als de UI. Die bestaat al: `DATE_NEUTRAL_TASK_FIELDS` met
       `changesOnlyDateNeutralFields` (`taskSlice.ts:829-854`). `updateTask` gebruikt hem om in de modus te blijven
       (`:1002`, `:1102`). De lijst staat daar: `name`, `description`, `wbsCode`, `color`, `notes`,
       `activityCodes`, `customFields`, `taskType`, `customTaskTypeId` en `workRule`; volgens het commentaar
       dezelfde velden die het taakraster zonder `scheduleStale` schrijft. Elk ander taakveld is planning.
       Werkwijze: staat het document bij de start van de transactie in de modus, dan vergelijkt de transactie de
       snapshot van vóór (die ze al neemt) met de toestand erna. Het is alleen metadata als (a) dezelfde taken in
       dezelfde volgorde staan en elke taak alleen in die velden verschilt, en (b) de rest van de planningsinvoer
       gelijk is: relaties, kalenders en de projectvelden van `planningInputOf` (`failedSolveGate.ts:35-46`). Dan
       geen `runCPM`: de modus blijft, het document is gewijzigd en de transactie is één undo-stap. Elke andere
       datawijziging is een planningsbewerking: `runCPM`, de modus gaat uit, zoals nu. Dezelfde toets geldt in
       `recomputeMidBatch` (`batchTool.ts:234-240`); daar rekent een leesstap na een naamwijziging nu ook (VERMOED,
       niet nagespeeld). F2 maakt de lijst en de toets gedeeld (een export uit `taskSlice.ts` of een bladmodule);
       er komt geen tweede lijst. Probe van deze ronde (§10.5): met deze regel smal nagebootst houdt B na de
       naamwijziging via de echte tool 15 jun 07:00 en de modus; Ctrl+Z zet de naam terug en de modus blijft. Een
       duurwijziging, en naam plus duur samen, verlaten de modus en rekenen.
     - *Een werkregelwissel deelt de classificatie van vóór de gevolgregels (review ronde 5, VERVOLG, BEVESTIGD;
       implementatie-eis voor F2).* `workRule` staat in `DATE_NEUTRAL_TASK_FIELDS`, maar de werkregelbrug schrijft
       gevolgen in velden die er niet in staan. `settleRuleChange` (`workRuleApply.ts:523`) legt restwerk vast, en
       `reconcileContourWork` (`:237-256`) herschrijft `task.timephasedContours` (`:255`) als de contour afwijkt.
       De UI classificeert de patch vóór die gevolgregels (`updateTask`, `taskSlice.ts:1002`; `setTaskWorkRule`,
       `:1110-1121`, sluit zonder `stale`) en houdt de modus. De eindtoets hierboven vergelijkt de toestand ná de
       gevolgregels en rekent dus wel. Probe van de review: taakduur 480 min, inzet 1, een contour van 240 min,
       geen vastgelegd restwerk; `workRule: FIXED_WORK` via MCP ⇒ B springt van 15 naar 1 jun, modus uit. Regel:
       de drie draft-primitieven die `settleRuleChange` aanroepen, classificeren hun eigen wijziging vóór de
       gevolgregels, met dezelfde `changesOnlyDateNeutralFields` en op dezelfde merge als hun no-op-guard, net als
       `updateTask`. Dat zijn `updateTaskFields` (merge `createMcpTransactions.ts:420`, brug `:470-473`),
       `patchTaskFields` (`:536-537`, `:583-586`) en `setTaskWorkRule` (`:852-860`; alleen de regel verandert, dus
       datumneutraal). De verantwoorde toestand van een taak is de beginsnapshot plus, per taakveld, de laatst
       aanvaarde brugwaarde; de echte undo-snapshot blijft intact (lezing van review ronde 7). Bij de start van de
       transactie is dat de snapshot zelf. Een gevolg telt alleen als twee dingen gelden: de
       wijziging van de primitief is datumneutraal, én de taak wijkt vlak vóór de brug alleen in datumneutrale
       velden af van haar verantwoorde toestand (dezelfde `changesOnlyDateNeutralFields`). Dan legt de transactie
       de velden vast die de brug schreef: het verschil vóór en na `settleRuleChange`. De eindtoets legt die
       waarden over de taak uit de snapshot en vergelijkt dan. Sluit de taak niet aan, dan legt de transactie
       niets vast; het eerdere verschil blijft in de vergelijking staan en de transactie rekent. De snapshot zelf
       blijft de echte vóór-toestand voor undo en rollback. Eén gedeelde functie doet dat voor de eindtoets en voor
       `recomputeMidBatch`. Er komt geen tweede veldlijst en geen nieuwe classificatielaag. Probe van ronde 5
       (§10.5): met deze regel houdt B 15 jun 07:00 en de modus, met hetzelfde restwerk en dezelfde contour als
       dezelfde wissel in de UI.
     - *De aansluitvoorwaarde (review ronde 6, BLOKKEERT, BEVESTIGD).* Zonder die voorwaarde kan een gevolg een
       eerdere planningswijziging verbergen. `planner_update_tasks` splitst één aanroep in `patchTaskFields` met de
       duur en daarna `setTaskWorkRule` (`taskTools.ts:403`, `:412`). De tweede primitief vraagt alleen metadata.
       Schrijft de brug daarna `time` (de B1a-omzetting van F3: vast werk maakt een dagenmaat-taak urenmaat), dan
       nam de overlay ook de nieuwe duur over: in de probe van de review 960 min, nul berekeningen, modus aan.
       Hetzelfde gebeurde zonder B1a met een eerdere ruwe contourwijziging in dezelfde transactie. Een regel per
       primitief alleen ("een primitief met een planningsveld rekent altijd") vangt dat niet, want de primitief met
       de werkregel heeft geen planningsveld. De aansluitvoorwaarde vangt beide: de taak wijkt vóór de brug al
       af in `time` of in de contour, dus het gevolg telt niet. De UI komt op hetzelfde uit: `updateTask`
       classificeert de hele patch (`taskSlice.ts:1002`), en duur plus werkregel verlaat daar de modus. Probe van
       deze ronde (§10.5): beide varianten rekenen en verlaten de modus; de gevallen van ronde 5 houden de modus.
     - *Implementatie-eis voor F3: een feitelijke maatwijziging is planning (review ronde 7, VERVOLG, BEVESTIGD).*
       Met B1a maakt een wissel naar vast werk van een dagenmaat-taak een urenmaat-taak; de brug schrijft dan
       `time`. Zonder deze eis blijft zo'n wissel datumneutraal in alle drie de routes: `setTaskWorkRule` (sluit
       zonder `stale`, `taskSlice.ts:1110-1121`), `updateTask` (classificeert de patch vóór de brug, `:1002`) en
       MCP (probe I, §10.5). Op de voorbeeldweek wordt 3 d vanaf wo 07:00 dan 24 u: de tabel houdt vr 14:00, en pas
       na Bereken staat er ma 09:00 (probe van de review, `/tmp/uren-review7/mcp-b1a.log`). Eis: verandert de
       werkregelbrug `time.durationUnit` van een taak, dan is de bewerking een planningsbewerking.
       `setTaskWorkRule` en `updateTask` sluiten dan als een planningsbewerking (de modus gaat uit, verouderd via
       `markScheduleStale`), en in MCP telt de primitief niet als datumneutraal, dus de transactie legt het gevolg
       niet vast en rekent. Er komt geen nieuw classificatiestelsel: de enige vraag is of de maat vóór en na de brug
       verschilt. Een wissel die de maat niet verandert, blijft datumneutraal zoals nu. Regressie: geval 11c.
     - *De bibliotheekverdeling op het actieve document (review ronde 3, punt 3, BEVESTIGD):* die loopt via
       `applyLeveling` (`librarySlice.ts:1407-1416`), en `latestDocumentDataEventSince` (`:1417`) wijst daarna
       het jongste event van het document aan. Met een eigen B5-event kwamen er twee events; `undoDistribution`
       draaide dan alleen het B5-event terug en de vertraging van twee dagen bleef. Met de optie blijft er één
       event, en draait `undoDistribution` de vertraging en de verschuiving samen terug.
  4. *`recalculateStaleSleepingDocuments`* (`documentSlice.ts:735-800`), aangeroepen door het bezettingsoverzicht
     met automatisch berekenen aan (`ResourceOccupancyView.tsx:222-228`): slaat een document met de vlag over
     (`:746`), en de teller `staleSleepingCount` (`ResourceOccupancyView.tsx:199`) telt het niet. Het overzicht
     rekent zo'n document alleen vluchtig, zoals met automatisch berekenen uit. Reden: een melding en een
     undo-stap voor een document dat de planner niet bekijkt, zijn onduidelijk; bij activeren komt route 2.
     Probe van de review: zonder deze regel wordt een opgeslagen start 15 jun op de achtergrond 1 jun, zonder
     event, en na activeren en `runCPM` blijft de historie leeg.
  Elke nieuwe route die blijvend rekent, moet de vlag kennen. F2 zet een check die `solveProject(`,
  `runInScratchDocument(` en de aanroepen van `runCPM` in `src/` telt tegen deze lijst, met per aanroep route 2
  of 3.
- **"Datums zoals opgeslagen" bij het laden:** zet het laadpad die modus aan omdat het bestand in de modus is
  opgeslagen (`applyRecordedDatesOnLoad`, `documentActivation.ts:369-401`), dan komen er geen melding en geen
  event, en de vlag gaat uit. De modus toont de opgeslagen datums al (genormaliseerd, zie boven), en zijn strook
  telt de verschuiving (`recordedDates.shifted`). De eerste Bereken daarna verlaat de modus en pusht zelf een
  snapshot (`scheduleSlice.ts:110-113`). Hetzelfde voor een slapend document dat in de modus hersteld wordt
  (`applyRestoredRecordedMode`).
- **Documentwissel, opslaan en herstel:** het event en de vlag horen bij het document; een wissel verandert
  niets. Ctrl+Z zet de modus terug met de vlag aan. Opslaan in die toestand schrijft geen `TimeModel` (de vlag
  staat aan) en geen `SourceFormat`, want de vastlegging heeft geen `sourceFormat` (`ifcSaveInput.ts:97-98`). Na
  heropenen of na een crash doet het laadpad de overgang dus opnieuw, met melding en Ctrl+Z.
- **Beperking:** de telling vergelijkt de opgeslagen datums met de nieuwe berekening. Was het bestand al verouderd
  opgeslagen, dan telt die achterstand mee.

**Regressiegevallen (F2):**

1. Eigen IFC zonder `TimeModel` waarin B 15–19 jun staat en de nieuwe motor 8–12 jun geeft: na openen B 8–12 jun,
   één event, melding "1 taak, 5 werkdagen", `isDirty` waar. Ctrl+Z ⇒ het geladen project (niet het vorige
   document) in de modus, met B 15–19 jun, de strook "bij herberekenen wijkt 1 taak af", niet verouderd. Ctrl+Y ⇒
   8–12 jun.
2. Het bestand van (1) met Automatisch berekenen aan (review ronde 3, punt 1): na Ctrl+Z blijft B 15–19 jun staan,
   ook na 250 ms, en ook na een naamwijziging. Bereken ⇒ 8–12 jun, de melding, één nieuw event, de vlag uit.
   Opnieuw Ctrl+Z en dan een taak verwijderen ⇒ direct 8–12 jun; één Ctrl+Z ⇒ de modus met de taak terug en
   15–19 jun.
3. Een oud bestand waarin niets verschuift: geen event, geen melding, `isDirty` onwaar.
4. Het bestand van (1), in de modus opgeslagen: geen melding, geen event. Een `.mpp`-vastlegging zonder tijd
   (urentaak 07:00–16:00, vastgelegd als 2026-06-01) staat na het laden als moment in de taak.
5. Het bestand van (1) als slapend herstel, automatisch berekenen aan, bezettingsoverzicht open: het document
   blijft verouderd en zonder event. Na activeren: één event en de melding. Ctrl+Z ⇒ de modus met 15–19 jun, en
   die blijft staan.
6. Slapend herstel, automatisch berekenen uit, eerst een bewerking en dan F5: twee events. Ctrl+Z ⇒ eerst de
   modus met de bewerking, daarna de toestand van vóór de bewerking.
7. Een MCP-transactie en de bibliotheekverdeling (op een slapend en op het actieve document) met de vlag: één
   event per document (dat van de transactie of de verdeling), wel de melding, en daarna is de vlag uit.
   `undoDistribution` zet ook op het actieve document de vertraging en de verschuiving samen terug.
8. Opslaan na Ctrl+Z van (1) en opnieuw openen: het bestand heeft geen `TimeModel` en geen `SourceFormat`; de
   overgang en de melding komen opnieuw.
9. Een bestand met `TimeModel` en een datum zonder tijd uit een ander programma: de datum wordt een moment, geen
   melding.
10. Het bestand van (1), Ctrl+Z, daarna `planner_update_tasks` met alleen `fields.name` voor B (review ronde 4): B
    houdt 15 jun 07:00, de modus blijft aan, de naam is gewijzigd, één undo-stap; Ctrl+Z zet de naam terug en de
    modus blijft. Controle: dezelfde aanroep met een duur verlaat de modus en rekent.
11. Het bestand van (1), Ctrl+Z; B heeft inzet 1, een contour van 240 min over haar 480 min en geen vastgelegd
    restwerk. Daarna `planner_update_tasks` met alleen `workRule: 'FIXED_WORK'` voor B (review ronde 5): B houdt
    15 jun 07:00, de modus blijft aan, en restwerk en contour zijn gelijk aan dezelfde wissel in de UI
    (`setTaskWorkRule`); één undo-stap. Ctrl+Z zet werkregel, restwerk en contour terug, en de modus blijft.
    Hetzelfde in een batch met een leesstap (`recomputeMidBatch`). Controle: dezelfde aanroep met een duur verlaat
    de modus en rekent. Varianten (review ronde 6), die allebei de modus verlaten en rekenen: (a) B als dagtaak,
    één `planner_update_tasks` met `duration: 2`, `durationUnit: 'days'` en `workRule: 'FIXED_WORK'`, ook met de
    B1a-omzetting van F3; Ctrl+Z geeft de modus en de duur van 1 d terug; (b) in één transactie eerst een ruwe
    contourwijziging aan B, dan `setTaskWorkRule`. Variant (c), regressie voor F3 (review ronde 7): op de
    voorbeeldweek een dagenmaat-taak van 3 d vanaf wo 07:00 in de modus (einde vr 14:00), daarna alleen een wissel
    naar vast werk, via `setTaskWorkRule`, via `updateTask` en via `planner_update_tasks`. In elke route wordt de
    taak 24 u urenmaat, gaat de modus uit, en staat het einde meteen op ma 09:00. Ctrl+Z geeft de dagenmaat, de
    modus en vr 14:00 terug.

### 5.3 Wat er verschuift bij het openen van een oud bestand

Openen rekent meteen (§5.2): wat verschuift, ziet de planner direct na het openen, met de melding van B5 en
Ctrl+Z. Een slapend hersteld document rekent pas na activeren (route 2 in §5.2). Elke bestaande dagtaak wordt een
dagenmaat-taak en elke urentaak een urenmaat-taak; daarvoor verandert er niets aan de data (`durationUnit`
blijft). Dit kan verschuiven:

- **Elk profiel:** taken met een SF-relatie (T8), met een procentlag (B7) of met voortgang in procenten zonder
  ingevoerde rest (B3), als de uitkomst geen hele dag is. Opvolgers van een kalendertijd-taak (T16, §4.5 rij 6).
  Een werkelijk einde van een kalendertijd-taak dat uit `earlyFinish` was overgenomen (§4.2).
- **OPS-profiel:** een losse mijlpaal in een bestand met een urenkalender (daar stond hij nu aan het begin; B6
  zet hem aan het einde). Dagenmaat-taken op een kalender met ongelijke dagen blijven gelijk.
- **P6- en MSP-profiel:** daarnaast een losse mijlpaal op een dagkalender (van einde naar begin), en dagtaken op
  een kalender met ongelijke dagen of met een werkende uitzondering met andere uren: die tellen nu in de urenmaat.
  Dat kan alleen op een urenkalender. VERMOED: dat is zeldzaam. De 24 IFC-voorbeelden in `examples/` hebben
  allemaal één scalaire werkperiode per kalender (geteld met grep). Gebruikersbestanden zijn niet te meten.
- **Hoe OPS het meldt:** besluit B5 (§5.2, §8).

### 5.4 Forward-compat: een oudere OPS leest een nieuw bestand

De laatste release is v2026.9.0. **Vooraf: de kalenders van een nieuw bestand leest v2026.9.0 al verkeerd.** Sinds
#336 schrijft OPS `IfcWorkCalendar` met 9 attributen. v2026.9.0 leest daardoor `WorkingTimes`, `ExceptionTimes` en
de ploeg op de verkeerde plek: werkweek, werkuren, feestdagen en ploeg van elke kalender gaan verloren. Dat
verlies is aanvaard (eigenaar 2026-10-13, "alles in één keer"; `docs/ifc-round-trip.md:351-356`, gemeten op
`:436-460`). Dit ontwerp kan dat niet herstellen. Het doel voor v2026.9.0 is daarom: (1) hij leest de datums en
de hoeveelheden (duur, rest, lag, speling) zoals ze geschreven zijn; (2) dit ontwerp maakt het verlies niet groter
dan nodig. De release-tekst noemt knownbugs 150 naast dat aanvaarde verlies (eigenaar 2026-10-20, geen bezwaar;
§7.3).

Gemeten met de lezer van v2026.9.0, gebundeld uit de broncode van de tag en gedraaid in Node (niet in de
desktopapp); probe in §10.5:

| Nieuwe vorm | v2026.9.0 doet | Gevolg | Maatregel |
|---|---|---|---|
| Ankerkalender: elk veld als datum met `T07:00:00` (W0) | leest de datums | datums goed; de kalender wordt ma–vr 07–16, zonder de echte feestdagen en met één onechte op de dag van inlezen (aanvaard verlies, `docs/ifc-round-trip.md:444-449`) | — |
| Letterlijke kalender met gemengde taken (W1: voltooide dagtaak 11:00–16:00, dagtaak 07:00–16:00, urentaak 07:00–16:00, kalendertijd-taak 00:00–00:00) | ziet een tijdsignaal (`hasNonAnchorTime`, r.679), promoveert de kalender en leest elke tijd letterlijk (r.654-714) | elk moment goed (BEVESTIGD). Maar de kalender wordt een urenkalender zonder werkblokken: v2026.9.0 las `WorkingTimes` niet, en de promotie neemt die lege werkblokken (knownbugs 150). Na Bereken in v2026.9.0 heeft de urentaak duur 0 | dit gebeurt nu al op `main` met elke urentaak. Daarom alleen letterlijk waar het moet (§3.6) |
| Zelfde zonder urentaak (W2) | het tijdsignaal komt nu van 11:00 en 16:00 | zoals W1 | zoals W1 |
| Duur met tijddeel `PT…H…M` | urentaak (`parseTaskTime` r.957-969) | goede duur; kalender zoals hierboven | — |
| Gebroken `P…D` (duur, rest, speling, lag) | `(-?\d+)D`: `P0.5D` ⇒ 5 (r.512-513; voor een lag BEVESTIGD, ook `P1.5D` met `ELAPSEDTIME` ⇒ 5) | verkeerde hoeveelheid | nooit schrijven (T5, T21). Dat gebeurt nu al bij een kalendertijd-lag of een geïmporteerde breuk |
| Dagenmaat in hele dagen | `P{n}D`, zoals nu | gewone dagtaak of lag in dagen | — |
| Breuk in dagenmaat of kalendertijd (duur, rest, lag) | `PT…`: urentaak, of lag in minuten (BEVESTIGD: `PT4H0M0S` ⇒ 240 min; `PT36H0M0S` met `ELAPSEDTIME` ⇒ 2160 kalenderminuten) | dezelfde lengte, in de urenmaat | geen; de nieuwe OPS herstelt de maat uit het record in de OPS-pset, zolang het standaardveld de geschreven minuten draagt (T21) |
| Extra property in `OPS_Sequences` | kent de pset niet (BEVESTIGD) | genegeerd | — |
| Conventies dagenmaat en B6 in `OPS_SchedulingProfile` | kent deze pset niet (§3.14) | geen | — |
| `OPS_Project.TimeModel`; `AtDayEnd` in `OPS_Milestone`; `LiteralTimes` in `OPS_Calendar` | `OPS_Calendar` leest hij per eigenschapsnaam (gelezen in de code); de andere twee: genegeerd (VERMOED) | — | — |
| Datum in een pset als `IFCDATETIME` (beperking, deadline op een letterlijke kalender) | niet gemeten | VERMOED: het moment met seconden | F2 meet het |

De rij "een blok van 9 u" uit ronde 1 vervalt: v2026.9.0 leest de geschreven werkblokken helemaal niet.

F2 verandert het formaat al een klein beetje: `TimeModel`, de schrijfregel per kalender met `LiteralTimes`, en
`AtDayEnd` (T10, T17, D7). Een planning in hele dagen schrijft F2 nog als ankerkalender, zoals nu. F3 verandert meer
(maat, breuken, speling in minuten, de records van T21). F2 en F3 draaien daarom elk de lezer van tag v2026.9.0 op de
nieuwe voorbeeldbestanden en op W0, W1, W2 en de lagvormen. Toets: elke gelezen datum en hoeveelheid is gelijk aan wat
de nieuwe OPS schreef (op dagniveau bij een ankerkalender). Wat v2026.9.0 daarna berekent, valt onder het aanvaarde
verlies van de kalenders. Precedent: de review van #355 las nieuwe bestanden met de tags v2026.7.1–v2026.9.0
(`2026-10-07-review-pr109-uitkomsten.md` r.799 op `origin/claude/review-pr109-log`). Een vaste CI-stap kan, maar is
niet nodig.

## 6. Teststrategie

### 6.1 De dagcases blijven het orakel

- Er zijn 24 `cases-*.json`; de meting telde 422 dagcases en 138 urencases (`cases-p6-verified` niet meegeteld).
  Alle cases rekenen in het OPS-profiel (§4.1).
- F0 bouwt in `tests/planning/harness.ts` een vaste omzetting, met de productiefunctie uit §5.2 (niet met een
  eigen kopie zoals de meting deed). Een dagcase houdt zijn eigen notatie (`dur: 5`, `YYYY-MM-DD`). De harness
  zet hem om en vergelijkt op dagniveau. De strikte vergelijking (`harness.ts:950-958`) blijft voor de urencases.
- **De vergelijker (review ronde 1, punt 9).** De meting vergeleek het datumdeel met `slice(0, 10)`; dat is de
  klokdatum, niet de werkdag, en bewijst niets voor een nachtblok of de 24:00-regel. F0 vergelijkt met de
  productiefunctie "werkdag van een moment" (§0) in de kalender van de taak, en een verwacht einde van een
  kalendertijd-taak met de semantiek uit §4.2 (D3 per veld). Speling met 10⁻⁶. Eigen cases voor die functie:
  nachtblok di 22:00–wo 06:00 (einde wo 06:00 ⇒ di; einde wo 02:00 ⇒ di), 24-uurskalender (einde di 00:00 ⇒ ma),
  kalendertijd (einde di 00:00 ⇒ ma; einde di 12:00 ⇒ di).
- **Twee runs per dagcase.** Run 1 in het OPS-profiel, met de dagenmaat (zoals M2). Run 2 vanaf F3 met alleen de
  conventie dagenmaat uit, als afwijking op de OPS-basis (zoals M1). Run 2 toetst de urenmaat zonder de andere
  conventies van P6 en MSP erbij; die zijn het werk van `measure:profiles`.
- Een case die bewust anders uitkomt, krijgt een redencode in de case zelf, bijvoorbeeld
  `"minuteModel": { "reason": "CONV-SF", "expect": { … } }`. Codes (§4.5):
  - `CONV-SF` (groep 3, beide runs, T8);
  - `PCT-LAG-EXACT` (groep 8, beide runs, B7: `lagadv-pct-fs50-odd-roundup`, `lagadv-pct-lead-halftie`);
  - `REST-EXACT` (beide runs, B3: elke case met voortgang in procenten zonder ingevoerde rest waar de rest geen
    hele dag is; F0 telt ze);
  - `KALENDERTIJD-EINDE` (groep 6 deels, beide runs, T16: `msp-18`, `msp-20`, `msp-21` en elke case die F0
    daarnaast vindt);
  - `PROFIEL-URENMAAT` (alleen run 2: ongelijke dagen).
  Groep 2 krijgt geen code: de conventie van B6 houdt hem in beide runs gelijk. Een fout krijgt nooit een
  redencode; die wordt gerepareerd.
- Wat de omzetting nog niet dekt: verwachte dag-getallen die letterlijk vergeleken worden (`projectDuration`,
  `scheduleDuration`, variance-getallen). F0 zet die om met de werktijd per dag en meldt elk getal dat niet
  geheel uitkomt.
- De 138 urencases blijven ongewijzigd groen, met de vijf `z13-*`-cases als bewaking van N0 (§4.3). Uitzondering:
  `msp-28` pint een fout en draait om als F1 die repareert (§4.5).
- De tijdzone-matrix blijft (de tijdas is UTC; geen wijziging).
- **Nieuwe checks in F3:** de lopers van de dagenmaat (voorbeeldweek, breuk, feestdag, werkende uitzondering,
  nachtblok; vooruit en dan achteruit binnen de foutgrens uit §3.14, met willekeurige begins en het voorbeeld
  vr 07:03 met een zaterdag van 1 u); P6 ⇒ OPS ⇒ P6 geeft dezelfde taken en hetzelfde profiel; de regel T12 (een
  pset zonder de sleutel: basis P6 ⇒ uit, basis OPS ⇒ aan); vast werk ⇒ urenmaat, en die maatwijziging is een
  planningsbewerking in UI en MCP (geval 11c, §5.2: 3 d vanaf wo wordt 24 u, einde meteen ma 09:00); de
  standaardmaat per profiel;
  een dagenmaat-taak met een breuk en een kalendertijd-taak met een breuk door IFC heen en terug; de drie lagen uit
  §3.3 door IFC en door een profielwissel; de belasting per werkdag (§3.11: wo 0,5, do 1, vr 1, ma 0,5, in
  histogram, contourdialoog en nivelleerder); de nivelleerder per kandidaat (§3.11: ma 07:00 geweigerd,
  nivelleerder en histogram gelijk na toepassen).
- **Nieuwe checks in F2 (fixronde 2 tot en met 6):** de B5-regressiegevallen 1–11 (§5.2), met geval 2 (Automatisch
  berekenen aan en Ctrl+Z) als storetest met de echte hooks; MCP-regressies in `tests/mcp/cases-recorded-dates.ts`
  (geval 10): de B5-overgang, Ctrl+Z, daarna `planner_update_tasks` met alleen `fields.name`, en B houdt 15 jun 07:00
  met de modus aan; hetzelfde in een gewone importmodus (knownbugs 152) en in een batch met een leesstap
  (`recomputeMidBatch`); een duurwijziging als controle verlaat de modus; geval 11 (review ronde 5): alleen `workRule:
  'FIXED_WORK'` bij een afwijkende contour houdt de modus, met restwerk en contour gelijk aan dezelfde wissel in de
  UI, ook in een batch, en met een duur erbij rekent hij; de varianten van geval 11 (review ronde 6: duur plus
  werkregel bij een dagtaak in één aanroep, en een ruwe contourwijziging vóór de werkregel) verlaten de modus en
  rekenen; een telcheck op de routes die blijvend rekenen, met route 2 of 3 per aanroep van `runCPM` (§5.2); de
  schrijfregel per kalender (§3.6): een ankerkalender schrijft alleen datums, een letterlijke kalender alleen echte
  momenten, ook in de psets, en W0, W1 en W2 lezen in de nieuwe OPS en in v2026.9.0 terug zoals in §5.4; D7 (START,
  FINISH, zonder soort met en zonder `AtDayEnd`); het baseline-einde (§4.2).

### 6.2 Check-batterijen

- 404 `check-*.ts`; 71 noemen `durationUnit`, 32 zetten `durationUnit: 'days'` (grep op `adaf9ab37`).
- Per fase de batterijen die dag-gedrag vastleggen, met wat ermee gebeurt:
  - F1: `check-progress-entry.ts` en de statusregel (§4.2) in de mutatiepaden.
  - F2: `check-dag-is-werktijd.ts`, `check-calendar-hours.ts`, `check-advanced-cpm.ts`, `check-p6-ff-day-hour.ts`,
    `check-dag-uur-lag.ts`: verwachte datums worden momenten; het gedrag op dagniveau blijft. (VERMOED per
    check, op naam en inhoud gekozen; F2 stelt het per check vast.)
  - F2, de laadgrens en B5 (review ronde 1, punt 9; ronde 2, punt 1, 3 en 4): `check-document-activation.ts`
    (laadberekening, Ctrl+Z na het openen van een oud bestand), `check-recorded-dates.ts`,
    `check-recorded-dates-library.ts` en `check-recorded-dates-mark.ts` (de modus "datums zoals opgeslagen", de
    genormaliseerde vastlegging en slapend herstel), `check-document-contract.ts` (normalisatie bij laden en wissel;
    de vlag "omzetting open" in `DOCUMENT_FIELDS`), `check-calendar-mirror.ts`, en de checks van het
    bezettingsoverzicht en de bibliotheekverdeling (route 3 en 4 in §5.2).
  - F3: `check-baseline-oude-dagtelling.ts`, `check-ifc-roundtrip.ts` (het IFC-formaat verandert);
    `check-work-rule-store.ts`, `check-work-rule-mapping.ts`, `check-work-rule-library.ts`,
    `check-work-rule-explain.ts` (werkregel en bibliotheekwissel met de dagenmaat en vast werk);
    `check-split-walk.ts`, `check-split-edit.ts`, `check-split-edit-store.ts`, `check-split-bar-render.ts`,
    `check-split-smoke.ts` (splits met een breuk en een start midden op de dag); de belastingchecks
    (`check-contour-engine.ts`, `check-capacity-tolerance.ts`).
  - F5a: `check-mpp-fidelity.ts` en de round-trip-checks voor MSPDI en P6 XML. F5b: `check-mpp-import.ts`,
    `check-xer-x7-hour-mode.ts`, `check-xer-calendar-data.ts`, `check-xer-recorded-roundtrip.ts`: verwachte duren
    veranderen. Per check één regel in de PR met de reden.
  - F6: checks die de dagpadcode zelf testen, verdwijnen met die code.
- Elke fase zet een mutatiebewijs bij de nieuwe regels (N1–N3, D1–D7, D3 per veld met het baseline-einde, de
  statusregel, T1, T12, T17, T21, T22, de belastingverdeling en de vraag per kandidaat): de check moet rood
  worden als de regel wegvalt.
- Browser en MCP: 83 bestanden in `tests/browser` en `tests/mcp` noemen `durationUnit`, `werkdag` of
  `scheduleDuration` (grep). Die gaan mee in F4 en F7.

### 6.3 Voorbeelden

- `verify:examples` leest `examples/` (`scripts/verify-examples.ts:27`). Alle 24 IFC-voorbeelden hebben een
  scalaire dagkalender.
- F0 legt per voorbeeld een snapshot op dagniveau vast (start, einde, late start, late einde en speling van
  elke taak na Bereken, met de huidige motor). F2 en F3 moeten die snapshot exact halen, behalve de cases met
  een redencode.

### 6.4 `measure:profiles` en regel A

- Regel A (`docs/recepten/conventie.md:59-62`): geen exacte cel mag inexact worden.
- Het P6-deel heeft `OPS_XER_CORPUS` nodig. Dat corpus staat niet op deze machine; de meting voor dit ontwerp
  is dus niet gedaan. F2, F3 en F5a mogen pas op de integratiebranch landen na een run met het corpus.

### 6.5 Prestaties

Niet gemeten. Rekenen in minuten loopt over werkblokken in plaats van over dagen. De engine bewaart de werkblokken per
dag in een cache (`bandCache`, gevuld door `bandsStartingOn`, `CalendarEngine.ts:620-644`). F2 meet met
`check-bulk-scale.ts` en `check-lange-keten.ts` en op het grootste corpusbestand (rehab-2), voor en na.

## 7. Fasering en risico's

### 7.1 De grootste risico's

| # | Risico | Gevolg | Wat het afdekt |
|---|---|---|---|
| R1 | Stille datumverschuiving in oude bestanden | een planner ziet na het openen andere datums zonder te weten waarom | migratie op de laadgrens; de B5-overgang via één functie, met de modus als vóór-toestand en de melding op elke route die rekent (§5.2); dagcases met redencodes; voorbeeldensnapshot |
| R2 | Een oudere OPS leest een nieuw bestand verkeerd | speling 2,5 d wordt 5 d; een anker 07:00 wordt een echt einde 07:00 | de kalenders zijn al verloren (aanvaard, #336); ankerkalender voor afleidbare momenten, echte tijden per hele kalender (T17), nooit gebroken `P…D` (T21), toets met de lezer van v2026.9.0 in F2 en F3 (§5.4) |
| R3 | De urenpad-dagtaak is minder rijp dan de urenpad-urentaak, en na B1 rekent elke dagenmaat-taak zo | 58 rode dagcases, waarvan 25 een vaste fout van één werkdag | F1 repareert eerst; F2 pas als run 1 groen is op de redencodes na |
| R4 | P6-conventies gaan gelden voor projecten met een dagkalender | andere datums in P6-profielprojecten | vlag "kalender had eigen werkblokken" (T11); `measure:profiles` met corpus |
| R5 | De webversie krijgt een halve verbouwing | `live.yml` deployt elke groene push op `main` (`.github/workflows/live.yml:11-15,38-40`) | de integratiebranch (§7.3) |
| R6 | Veel tests veranderen tegelijk | een reviewer ziet niet welke wijziging bedoeld is | redencodes; per fase alleen de eigen tests |
| R7 | Werk en kosten veranderen als de afronding verdwijnt | rapporten tonen andere getallen | F3 meet op de voorbeelden en meldt het in de PR |
| R8 | Prestaties | grote projecten rekenen trager | meting in F2 (§6.5) |
| R9 | Twee maten in één project | een planner ziet niet welke maat een taak heeft | B8; F4 op de integratiebranch vóór de PR naar `main` (§7.3) |
| R10 | Een P6- of MSP-project uit een nieuw bestand rekent toch in de dagenmaat | rekent niet zoals P6 of MSP | T12 met mutatiebewijs (§3.14) |
| R11 | Een grensregel verandert bestaande uurplanningen | urencases en MSP- of P6-corpusgedrag breken | N0–N3 alleen op benoemde plekken; `z13-*` en de 138 urencases als bewaking (§4.3) |
| R12 | Data uit F3 overleeft een export niet | 2,5 d wordt na MSPDI 3 d | F5a in de eerste release (§3.10) |
| R13 | Belasting op de verkeerde dagen | histogram en nivellering kloppen niet bij een start midden op de dag | belasting per werkdag uit momenten in F3, de nivelleerder per kandidaat (§3.11) |
| R14 | De maat van een lag gaat verloren | 0,5 d dagenmaat wordt na opslaan of export 240 min urenmaat; op een korte vrijdag 3 u ⇒ 4 u | T21: het record in `OPS_Sequences` (F3) en in de markering van MSPDI en P6 XML (F5a), met het standaardveld leidend; regressie met beide maten en met een gewijzigde lag (§3.3) |

### 7.2 Fasen

Elke fase is een eigen PR op de integratiebranch (§7.3), wordt los groen en verandert geen gedrag dat een latere fase
nodig heeft. B2, B4 en B8 zijn besloten (2026-10-20) en bepalen F4. B9 = optie 1 is besloten door de eigenaar op
2026-10-23 in het orkestratorgesprek: Duurweergave heeft in het OPS-profiel geen effect (§3.12).

**F0 — Meting en vangnet (alleen tests en een ongebruikte functie).**
- Bestanden: nieuwe `src/state/migrations/minuteModel.ts` (§5.2, nog niet aangesloten); de functie "werkdag van
  een moment" en de regels D1–D7 (met D3 per veld); `tests/planning/harness.ts` (omzetting met die functies, de
  vergelijker en de twee runs uit §6.1); redencodes in de cases; voorbeeldensnapshot; checks voor de
  migratiefunctie en de werkdagfunctie (nachtblok, 24:00, kalendertijd).
- Risico: laag. De app verandert niet.
- Toets: suite groen; de runs tonen per batterij het aantal rode cases, gelijk aan de lijst in §10, op de
  verschillen door de nieuwe vergelijker na (per case benoemd).

**F1 — Fouten in het urenpad en de statusregel (geen besluit nodig).**
- Inhoud: knownbugs 138–142; groep 1, 4, 5, 7, 9, 10, 11 en 12; `msp-27` (en `msp-28` om); de grensregels N0–N3
  op de plekken uit §4.3; de klem van D6; `mk-05a`; de statusregel (§4.2) in `isActualPastStatusDate` en de
  mutatiepaden. Niet: groep 2, 3 en 8 en het kalendertijd-einde (conventie, T8, B7, T16).
- Bestanden: `CPMSolver.ts`, `relationMath.ts`, `scheduleAnalysis.ts`, `CalendarEngine.ts`,
  `taskMutationRules.ts`, `taskDialogSave.ts`, `taskEditPlan.ts`, `progressEntry.ts`, `mcpValidation.ts`.
- Risico: middel. Dit raakt gewone urentaken van nu (R11).
- Toets: 138 urencases groen (op `msp-28` na, bewust); de vijf `z13-*`-cases groen; een nieuwe case per knownbug
  en per grensplek, met mutatiebewijs; de regressiegevallen van de statusregel in dialoog, raster en MCP; volledige
  planningssuite.
- Stand (2026-10-23): PR #402 zit in de integratiebasis (12abaabf2). F1b op
  claude/uren-f1b-urenfouten repareert 145 (dagenmaat bij SNLT/MSO), 147 (eindbeperkingen zonder tijd),
  groep 1 (eindmijlpalen, ook zonder soort en met lag), de dagenmaatgrenzen van groep 12 (externe FF,
  kalendertijdlag en splits), SS+0 naar kalendertijd (msp-27/msp-28), D6 en de gedeelde statusregel.
  N2 geldt nu ook als dagen- en minutenvertraging samen bestaan; de meting telt een kalendertijdvertraging
  als 24 uur per dag. Bug 148 was al opgelost door de gedeelde deadlinefunctie en krijgt direct bewijs.
  Toegevoegd: 18 blokgrenscases (30 → 48), 114 controles van dialoog/paneel/raster/plakken/MCP en
  echte datumvelden in de bestaande browserroute. Alleen invoer op de statuswerkdag krijgt
  D1/D2/D6; algemene normalisatie, ook van oudere actuals, blijft bij F2. De vijf z13-cases blijven ongewijzigd.
  Het minutenmodelvangnet krimpt uitsluitend: M1 57 → 12, M2 30 → 11; de ontbrekende lege sleutel
  hours-blokgrenzen is toegevoegd. De oude lijsten liepen al achter na #402: de echte nulmeting
  op 12abaabf2 gaf 34 en 21 afwijkende cases; F1b geeft er 12 en 11.
  Open: 146 vereist de genoemde conventiekeuze. Daarnaast is mk-05a in M1 opgelost, maar blijft in
  M2 het oude urenpad staan. De bredere startmijlpaalcorrectie schendt de bestaande C7-poort;
  de fix is daarom volgens N1 tot dagenmaat beperkt. msp-51 blijft in beide runs
  afwijken door het aparte FS-kalendertijdpunt 155. De overige bestaande restgevallen blijven
  zichtbaar in het vangnet (onder meer 153/154 en de latere fasen); de nieuwe bevestigde FF-lead
  bij urenmaat staat als 204 in knownbugs.md. Groep 2, 3, 8 en T16 zijn niet omgezet.
  De laatste volledige corpusloze planningssuite is groen (exit 0), inclusief alle vijf tijdzones.
  De profielmeting met de echte corpora houdt de P6-celpoort, maar heeft exit 1 door bestaande
  corpusafwijkingen. Bewijs, mutaties en de precieze controle-uitkomsten staan bij deze PR
  in artifacts/uren-f1b.

**F2 — Kern: motor op werkblokken voor elke kalender.**
- Stand: in uitvoering op `claude/uren-f2-kern`, concept-PR #559. Motor, laadgrens, B5 en IFC aangesloten; profielmeting houdt dezelfde celstand als de basis. Dagcases en voorbeeldensnapshot zijn nog niet groen; geen integratie-akkoord.
- Inhoud: elke engine via `calendarForEngine`; elke dagtaak loopt als urenpad-dagtaak, in hele dagen. De conventie
  dagenmaat bestaat dan nog niet; dat is het gedrag van nu op een urenkalender, in elk profiel. De migratie op de
  laadgrens met normalisatie (ook van de vastlegging), D7 en het baseline-einde (§4.2), T1 en de B5-overgang met twee
  snapshots, de vlag "omzetting open" en alle routes die rekenen (§5.2); normalisatie bij elke invoer (§3.6); de
  projectdatums met D1/D5/D2 (§4.2); het kalendertijd-einde (T16); `TimeModel` (§5.2), de schrijfregel per kalender
  met `LiteralTimes` en `AtDayEnd` (T17, §3.6); de conventie van B6; de procentlag exact (B7); T11.
- Bestanden: `CPMSolver.ts` (`engineForTaskCalendar`, projectengine `:515`), `applyCpmResult.ts`,
  `documentContract.ts`, `documentActivation.ts`, `fileSlice.ts`, `documentSlice.ts`, `scheduleSlice.ts`,
  `librarySlice.ts`, `ResourceOccupancyView.tsx`, `taskSlice.ts`, `taskDates.ts`, `registry.ts`, `ifcWriter.ts`,
  `ifcReader.ts`, `ifcPsets.ts`, en de aanroepers van `runCPM` uit route 3 (§5.2: `projectSlice.ts`,
  `schedulingProfileSlice.ts`, `createMcpTransactions.ts`, `batchTool.ts`, `CalendarDialog.tsx`,
  `useExitRecordedDates.ts`).
- Risico: hoog (R1, R2, R3, R4, R8).
- Toets: run 1 groen op dagniveau via de echte motor, op de redencodes na; de regressiegevallen 1–11 van §5.2; de
  projecteinde-case en het baseline-einde (§4.2); voorbeeldensnapshot exact; de lezer van v2026.9.0 op de nieuwe
  voorbeeldbestanden en op W0, W1 en W2 (§5.4); `measure:profiles` met corpus; prestatiemeting.

**F3 — De dagenmaat (eigen fase).**
- Inhoud: de conventie dagenmaat met T12 (§3.14); lopers voor een dagenmaat met een breuk, met de afronding en
  de foutgrens uit §3.14 (T23); onder P6 en MSP tellen een dagenmaat-taak, een lag in dagenmaat en een
  dagenmaat-rest als urenmaat; vast werk ⇒ urenmaat, als planningsbewerking (§5.2, geval 11c); de standaardmaat
  (store en Projectinstellingen, §3.2);
  werkdriehoek T14, de urenmaat zonder afronding; de rest exact (B3); de belasting per werkdag uit momenten in
  histogram, contourdialoog en nivelleerder, met de vraag per kandidaat (§3.11); speling in minuten (§3.4); IFC:
  maat en breuk voor duur, rest en lag, met de records van T21 in `OPS_Sequences` en een bestaande per-taak-pset
  (§3.3, §3.10); de lopers met de
  foutgrens (§3.14); MCP-teksten over de maat (§3.13).
- Bestanden: `registry.ts`, `schedulingOptionsRead.ts`, `CalendarEngine.ts`, `CPMSolver.ts`, `relationMath.ts`,
  `workTriangle.ts`, `workRuleApply.ts`, `ResourceLoad.ts`, `ResourceLeveler.ts`, `splitWalk.ts`, `taskSlice.ts`,
  `ProjectInfoPanelContent.tsx`, `ifcWriter.ts`, `ifcReader.ts`, `ifcPsets.ts`, `ifcTaskSlots.ts`,
  `sequenceFields.ts`, `taskFields.ts`.
- Risico: hoog (R1, R2, R7, R10, R13).
- Toets: run 1 en run 2 (§6.1); de nieuwe checks uit §6.1 en §6.2; de lezer van v2026.9.0 op de lagvormen en de
  breuken (§5.4); migratiemelding over de voorbeelden en het corpus; `measure:profiles` met corpus.

**F4 — UI op momenten en maten (B2, B4, B8 en B9 besloten).**
- Stand: F4a verwijdert de schakelaar en meldingen (B2/T25), maakt zoom en splitbediening vast (T24), maakt Duurweergave grijs in OPS (B9) en past gidsen en tutorials aan. F4b volgt na F3: datumweergave en datuminvoer, maatnotatie en -invoer, breuken, lag zonder afronding en de controlestap voor de eigenaar.
- Werkwijze: een fase-PR op `claude/uren-integratie`, net als F0–F3 en F5a. De PR naar `main` komt pas als F4 daar
  staat (§7.3).
- Inhoud: datuminvoer volgens §3.6 (de store normaliseert al sinds F2); de datumweergave volgens B4 (een tijd alleen
  midden op de werkdag); de schrijfwijze en de invoer van de maat volgens B8 ("d" is in het OPS-profiel de
  dagenmaat, de urenmaat staat in u); Duurweergave in het OPS-profiel grijs (B9), met de hint "In het OPS-profiel
  toont elke taak zijn eigen maat." als nieuwe i18n-sleutel in nl en en, op alle drie de plekken van
  `SettingsPanelContent` (⚙, het tabblad Instellingen en Backstage); onder P6 en MSP werkt de instelling zoals nu;
  breuken in de dagenmaat (`durationFormat.ts:40-41`) en lag zonder afronding
  (`lagFormat.ts:73`, I12), voor iedereen; de schakelaar Urenplanning weg (B2), met de 35 bestanden, de oude
  sleutel, de meldingen en de i18n-sleutels uit §3.12; de blokkade van urenmaat-taken weg
  (`TaskDurationField.tsx:56`); slepen per werkdag en de zoomgrenzen van T24 (§3.12); rapporten; gidsen nl/en (ook
  `howto-urenplanning-aanzetten`) en de tutorials 4 tot en met 7.
- Bestanden: de 35 bestanden uit §3.12, plus `App.tsx`, `projectSlice.ts`, `devBridge.ts`, `durationFormat.ts`,
  `lagFormat.ts`, `DateTextInput`, `reportCommon.ts`, `scripts/tutorial-project.ts`, `tests/browser/tutorials/`, de
  locales en `public/docs/{nl,en}/`.
- Risico: middel; zichtbaar voor elke gebruiker (R9).
- Toets: browsertests (`smoke.spec.ts` en gerichte specs): de voorinstelling Dag sleept een urenmaat-taak per hele dag
  en Uur per uur; splitsen en stukslepen bij dagzoom (T24, review ronde 6), op een kalender van 8 u: een urentaak van
  twee werkdagen splitst na één werkdag (pauze één werkdag), een pauze van één werkdag wordt één dag langer twee
  werkdagen (960 min), een werkstuk idem; op de voorbeeldweek met de korte vrijdag: een split op vrijdag geeft een
  pauze van 360 min, en een pauze die over de vrijdag één dag langer wordt, groeit met 360 min; op een dag van 8,5 u
  splitst een taak na 510 min; review ronde 7: een taak die ma 13:00 start, splitst op di na 180 min, en dat werkstuk
  wordt bij inkorten niet korter dan 180 min; een pauze die naar nul gaat, voegt de stukken samen; op een nachtploeg
  ma–vr 22:00–06:00 splitst een klik op di na de hele ploeg van ma (480 min, niet 120), een klik op za 02:00 valt op
  de werkdag vr (pauze 480 min, niet 360), en een klik op za 10:00 valt op ma 22:00; een opgeslagen
  `ops-enableHourPlanning` (aan of uit) verandert niets; een urenmaat-taak is te bewerken; "5d", "40u" en een kaal
  getal volgens B8, ook bij vast werk; de datums volgens B4 met de voorbeelden uit §8; een browsertest toont op
  alle drie de plekken van `SettingsPanelContent` het grijze veld Duurweergave en de hint in het OPS-profiel, en
  het actieve veld onder P6 (B9). `verify:i18n` zonder de
  vervallen sleutels. Eén checkstap voor de eigenaar (licht en donker), met de zoomgrenzen en de plek van
  `allowMixedDayHour`.

**F5a — Verliesvrije adapters voor duur, rest en lag (hoort bij de eerste release).**
- Stand: F5a-1 bouwt I1–I3, I5–I7 en de urenmaat als importstandaard (T15), met minuutgetrouwe duur, rest en lag en gerichte rondgangen; F5a-2 volgt na F3 voor T13, T21 en de volledige dagenmaat-markering met records. De bestaande markering blijft leesbaar; voortgangsnormalisatie van gemarkeerde dagtaken blijft afhankelijk van F2.
- Inhoud: I1, I2, I3, I5, I6, I7 (§1.3); T13 en T15 (§3.10); de OPS-markering voor de maat van taak en lag heen
  en terug (T21, §3.3).
- Bestanden: `mspdiReader.ts`, `mspdiWriter.ts`, `p6xmlReader.ts`, `p6xmlWriter.ts`, `importDurations.ts`,
  `subdayIo.ts`.
- Risico: middel (R12).
- Toets: OPS ⇒ MSPDI ⇒ OPS en OPS ⇒ P6 XML ⇒ OPS geven een dagenmaat-taak van 2,5 d met 1,5 d rest terug als
  2,5 d met 1,5 d rest; de drie lagen uit §3.3 (0,5 d dagenmaat, 240 min urenmaat, 1,5 ed) komen ongewijzigd
  terug, met de opvolgers op de voorbeeldweek op vr 10:00 en vr 11:00; `check-mpp-fidelity.ts`;
  `measure:profiles`.

**F5b — De overige adapters (mag later).**
- Inhoud: I4 (.mpp), de XER-lezer (`xerReader.ts:831-834`), I8 (het 08:00-anker).
- Bestanden: `mppReader.ts`, `xerReader.ts`, `importDates.ts`, `xmlInterchange.ts`.
- Toets: de checks uit §6.2 (F5b).

**F6 — Opruimen (mag later).**
- Inhoud: dagpadcode weg (§3.9); `mode` in `CalendarEngine`; `levelingDelay` (dagen) weg. `scheduleDuration`
  en `lagDays` blijven: ze dragen de dagenmaat (T7). De migratie en de normalisatie blijven altijd (oude
  bestanden, andere programma's).
- Risico: laag, als F2–F5a groen zijn.
- Toets: `typecheck`, `verify:cycles`, volledige suite in de CI.

**F7 — Publieke surface (mag later).**
- Inhoud: extensie-API (versie), `AGENTS.md`, `.claude/rules/rekenprofielen.md` (negenentwintig conventies), de
  skills `goed-plannen` en `progress-update`, de agentgids, de overige MCP-teksten (§3.13).
- Risico: laag.
- Toets: `test:mcp`, `verify:docs`, `verify:i18n`.

### 7.3 Werkwijze en release

- **Integratiebranch (werkwijze, opdracht coördinator 2026-10-20):** `claude/uren-integratie`, vanaf `main`.
  F0, F1, F2, F3, F4 en F5a komen er elk als een eigen PR op, met een eigen review. Aan het eind gaat er één PR
  naar `main`. Reden: `live.yml` deployt elke groene push op `main` (`.github/workflows/live.yml:11-15,38-40`),
  dus een regel over tags houdt een halve verbouwing niet van de webversie (R5). De integratiebranch wordt
  regelmatig bijgewerkt met `main` (merge, geen force-push).
- **Besluit eigenaar (2026-10-20):** de kern van de omzetting en de dagenmaat zijn aparte PR's, maar gaan samen
  in één release. In deze fasering: F2 en F3, via de ene PR naar `main`.
- **Ook in die release (review ronde 1):** F5a (verliesvrije adapters) en de belasting per werkdag (in F3). Reden:
  F3 maakt data die anders bij de eerste export of in het histogram fout gaat.
- **F4 komt vanzelf in dezelfde release (eigenaar 2026-10-20).** F4 is een fase-PR op `claude/uren-integratie`,
  net als F0–F3 en F5a. De PR naar `main` komt pas als F4 daar staat. De eigenaar wees erop dat de omzetting
  alleen via die ene PR naar `main` gaat; zo komt ze samen met het scherm in één release. Het eerdere voorstel
  "F4 gaat mee" vervalt daarmee. Reden voor de volgorde: zonder F4 ziet een planner niet welke maat een taak heeft
  (R9), en een breuk is niet te typen. De gidsen nl/en horen bij F4, de MCP-teksten over de maat bij F3. De
  vertalingen voor alle 28 talen komen zoals altijd vóór de release (`verify:translations`).
- **Release-tekst (eigenaar 2026-10-20, geen bezwaar):** de release-tekst noemt knownbugs 150 naast het aanvaarde
  verlies van de kalenders (§5.4). Dat is: v2026.9.0 maakt van een kalender met een tijdsignaal een urenkalender
  zonder werktijd.
- F5b, F6 en F7 mogen na de PR naar `main`, als gewone PR's.
- F1 loopt nu via PR #402 rechtstreeks naar `main` (stand 2026-10-20, zie F1). Lezing van dit ontwerp: dat botst niet
  met de integratiebranch: F1 repareert fouten van het huidige urenpad en verandert geen dagpad, dus de webversie
  krijgt geen halve verbouwing. De integratiebranch neemt F1 mee als hij wordt bijgewerkt met `main`.

## 8. Besluiten

Besloten op 2026-10-20: B1, B1a, B2, B3, B4, B5, B6, B7 en B8. De regel voor `isDirty` bij B5 is geen besluit van de
eigenaar, maar een technische keuze van de orkestrator (2026-10-20; §5.2). De eigenaar besloot op 2026-10-23 in het
orkestratorgesprek: B9 = optie 1. Duurweergave heeft in het OPS-profiel geen effect; elke taak toont zijn eigen maat.

### B1. Wat is één dag (welke maat)? — besloten: optie 3, een maat per taak

**Besluit (eigenaar, 2026-10-20, letterlijk via de coördinator):** "B1 wordt 'optie 3, maat per taak'. De
dagenmaat bestaat alleen in het OPS-profiel. Het P6- en het MSP-profiel kennen alleen urenmaat en
kalendertijd, omdat die profielen precies moeten rekenen zoals P6 en MSP."

**Uitwerking van de eigenaar (letterlijk; "stel bij als de code iets anders vraagt"):** "de dagenmaat is een
conventie in het register (uit in p6/msproject, aan in ops). Onder het P6- of MSP-profiel rekent een
dagenmaat-taak als urenmaat (werkdagen × uren per dag van de effectieve kalender); terug naar OPS geeft weer
de dagenmaat. Er gaat dus niets verloren en P6 → OPS → P6 blijft het origineel. Bij de migratie worden
bestaande dagtaken dagenmaat-taken. Volgorde: de kern van de omzetting en de dagenmaat zijn aparte PR's, maar
gaan samen in één release."

**Wat de planner ziet** (de voorbeeldweek: ma-do 07:00–12:00 + 13:00–16:00, vr 07:00–12:00 + 13:00–14:00):

| Invoer | OPS-profiel (dagenmaat-taak) | P6- of MSP-profiel (dezelfde taak als urenmaat) |
|---|---|---|
| ma 07:00 + 5 d | vr 14:00 | 40 u ⇒ volgende ma 09:00 |
| di 11:00 + 3 d | vr 10:00 | 24 u ⇒ vr 11:00 |
| wo 07:00 + 3 d | vr 14:00 | 24 u ⇒ volgende ma 09:00 |
| werk van 1 persoon bij 3 d | 24 u (T14) | 24 u |

Narekening di 11:00 + 3 d. Dagenmaat: di 11:00–12:00 en 13:00–16:00 = 4 u = 0,5 d; wo en do 2 d; dan nog 0,5 d
van de vrijdag van 6 u = 3 u ⇒ vr 10:00. Urenmaat: 4 + 8 + 8 = 20 u op di-do, nog 4 u op vr ⇒ vr 11:00. Vanaf
wo 07:00: urenmaat 8 + 8 + 6 = 22 u op wo-vr, nog 2 u ⇒ ma 09:00. Bij gelijke dagen (de standaardkalender,
alle 24 voorbeelden) geven beide kolommen hetzelfde.

**Waar de code iets anders vraagt** (bijstellingen van de uitwerking):

1. **"Uren per dag van de effectieve kalender" wordt de werktijd per dag** (besluit 2026-10-15, §3.1), niet het
   opgeslagen `hoursPerDay`. Reden: zo rekent OPS sinds #363 het dagengetal van een urentaak; met `hoursPerDay`
   zouden er twee omrekenfactoren naast elkaar bestaan.
2. **Oude bestanden met een profiel-pset (T12).** De registerregel geeft een ontbrekende sleutel de OPS-waarde
   (aan). Een P6-project uit zo'n bestand zou dan "dagenmaat aan" krijgen en niet rekenen zoals P6. Bijstelling:
   een ontbrekende sleutel krijgt de waarde van de basis (§3.14).
3. **Export (T13).** De uitwerking noemt de export niet. De eerdere tekst van optie 3 schreef "de minuten op de
   huidige plek". Dit ontwerp kiest werkdagen × werktijd per dag plus de OPS-markering (§3.10). Reden: dat is
   precies wat het P6- en het MSP-profiel rekenen, en het hangt niet af van de plek.
4. **Afwijking op een P6- of MSP-basis.** "Dagenmaat aan" blijft als afwijking mogelijk, zoals bij elke
   conventie. Wil de eigenaar dat niet, dan verbergt het profielblok die keuze (§3.14).
5. **Migratie.** Er verandert niets aan de data: `durationUnit: 'days'` is de dagenmaat (§3.2, §5.3).

**Volgorde:** F2 (kern) en F3 (dagenmaat) zijn aparte fasen; de releaseregel staat in §7.3.

**Geschiedenis.** Opties 1 en 2 kwamen van de orkestrator (2026-10-20); optie 3 kwam erbij na twijfel van de
eigenaar. Optie 1 was alleen de urenmaat ("5 d" op de voorbeeldweek loopt door tot ma 09:00). Optie 2 was de
urenmaat met dagen omgezet bij invoer (de duur hangt af van waar de taak stond bij het typen). Dit ontwerp
beval eerst optie 1 aan, om de eenvoud en het uitwisselen. De eigenaar koos optie 3 en legde de dagenmaat in
het OPS-profiel. Zo rekenen het P6- en het MSP-profiel toch precies zoals P6 en MSP.

**Wie, wanneer, bron:** de eigenaar, 2026-10-20, via de coördinator in dit gesprek. Eerder besluit dat erop
leunt: 2026-10-15 ("een dag", §3.1).

### B1a. Standaardmaat voor nieuwe taken — besloten

**Besluit (eigenaar, 2026-10-20, letterlijk via de coördinator):** "in het OPS-profiel krijgt een nieuwe taak
standaard de dagenmaat. Dit is instelbaar per project in Projectinstellingen. Gebruik daarvoor de bestaande
instelling 'Standaardeenheid voor nieuwe taken' (`project.defaultTaskDurationUnit`,
`ProjectInfoPanelContent.tsx:140,569-578`, i18n `settings.defaultTaskDurationUnit`), maar maak er een maat van:
noem hem 'Standaardmaat voor nieuwe taken', met de keuzes dagenmaat en urenmaat. Onder het P6- of MSP-profiel
staat hij vast op urenmaat, met een korte uitleg. Een taak met het taaktype vast werk is altijd urenmaat."

**Wat de planner ziet.** Projectinstellingen toont "Standaardmaat voor nieuwe taken" met de keuzes Dagenmaat en
Urenmaat; in een nieuw OPS-project staat Dagenmaat gekozen. Onder het P6-profiel staat Urenmaat vast, met een
uitleg als "Het P6-profiel rekent in uren, zoals P6." (de tekst komt in F3). Zet een planner een
dagenmaat-taak van 3 d op vast werk, dan wordt het een urenmaat-taak van 24 u.

**Uitwerking:** §3.2. Het besluit noemt geen reden voor "vast werk is altijd urenmaat"; de lezing van dit
ontwerp staat in §3.2.

**Wie, wanneer, bron:** de eigenaar, 2026-10-20, via de coördinator in dit gesprek.

### B2. De schakelaar Urenplanning — besloten: optie 1, weg

**Besluit (eigenaar, 2026-10-20, letterlijk via de coördinator):** "die schakelaar urenplanning moet gewoon weg denk
ik of niet?" De coördinator stemde in. Zijn reden: B4 optie 2 beschermt de planner die in hele dagen werkt al, want
zo'n planning toont geen tijden.

**Wat het was.** Zonder vinkje blokkeerde de schakelaar het bewerken van een urentaak (`TaskDurationField.tsx:56`).
Hij bepaalde ook of het kalendervenster werktijd toont (`CalendarForm.tsx:103`) en of de uurzoom bestaat
(`timelineTiers.ts:32-35`, `:111`). Hij stond standaard uit (`uiSlice.ts:155`). De schakelaar komt uit fase 2.8b
(2.8b-spec §6.8, "drie blijvende instellingen"). Een eerder besluit over weghalen is niet terug te vinden.

**Wat de planner ziet.** De App-instellingen hebben geen schakelaar Urenplanning meer. Iedereen kan breuken ("2,5")
en uren ("4u") typen en de duur van elke taak bewerken. Het kalendervenster toont altijd de werktijd;
Projectinstellingen tonen altijd de standaardmaat en de ploegpresets; de schaal Uur staat altijd in de lijst. Bij
de voorinstelling Dag sleept een taak per hele dag, zoals nu met de schakelaar uit; per uur slepen begint bij zoom
400 (T24). Voorbeeld (standaardkalender): taak A, dagenmaat, 2,5 d vanaf ma 1 jun 07:00 ⇒ einde wo 3 jun 11:00;
opvolger B (FS, 3 d) ⇒ wo 3 jun 11:00 tot ma 8 jun 11:00. De tabel toont bij A "einde wo 3 jun 11:00" (B4).

**Afweging.** Dit ontwerp beval optie 3 aan: uit = alleen hele dagen, zodat een planner die nooit met uren werkt,
niets ziet veranderen. De eigenaar koos optie 1. Wat optie 3 beschermde, doen nu andere regels: B4 toont een tijd
alleen midden op de werkdag, dus een planning in hele dagen ziet eruit zoals nu; een kaal getal houdt de maat van de
taak (B8); bij dagzoom sleept een taak per hele dag (T24). Wat optie 3 nog meer gaf: een duur in hele dagen was
afgedwongen. Dat valt weg. Na B1a komt de urenmaat vaak voor (elke import uit MSP en P6, T15; elke taak onder het
P6- en het MSP-profiel; elke taak met vast werk), dus de blokkade van `hourEditBlocked` moest in elke optie weg
(review ronde 1, punt 10).

**Uitwerking:** §3.12 (de 35 bestanden, de oude sleutel in localStorage, de meldingen en i18n-sleutels die
vervallen, de zoomgrenzen, de gidsen en tutorials) en F4 (§7.2). Duurweergave en Kwartierzoom blijven aparte
instellingen. Vast werk blijft altijd urenmaat (B1a): "5d" geeft bij zo'n taak 5 × de werktijd per dag in de
urenmaat. Knownbugs 24 hoort hierbij; het punt staat al niet meer in `knownbugs.md` (§9).

**Afgewezen:** optie 2 (alleen de uren uit: geen "4u", geen werkblokken per weekdag in het kalendervenster, geen
uurzoom, wel breuken) en optie 3 (uit = alleen hele dagen, zoals nu).

**Wie, wanneer, bron:** de eigenaar, 2026-10-20, via de coördinator in dit gesprek. De aanbeveling van dit ontwerp
was optie 3.

### B3. Restduur bij voortgang in procenten — besloten: exact

**Besluit (eigenaar, 2026-10-20, via de coördinator):** "B3 = optie 1: de restduur uit een percentage rekent
exact, ook bij de dagenmaat."

**Wat de planner ziet** (standaardkalender). Taak van 5 d, dagenmaat, start ma 1 jun 07:00. Statusdatum wo 3 jun.
Gereed 32 %, geen ingevoerde rest. De rest is 5 × 0,68 = 3,4 d en begint wo 3 jun 07:00; het einde wordt
ma 8 jun 10:12. Nu rondt OPS de rest van een dagtaak af op 3 d (`Math.round`, `CPMSolver.ts:2314-2318`) en
eindigt de taak vr 5 jun 16:00.

**Uitwerking:** §3.5. Geen conventie. Oude bestanden met voortgang zonder ingevoerde rest kunnen verschuiven; de
melding van B5 telt ze. De dagcases krijgen waar nodig `REST-EXACT` (§6.1).

**Afgewezen:** afronden op hele dagen (optie 2; botst met breuken: 3,7 d op 5 % gaf 4 d rest) en altijd naar boven
(optie 3).

**Wie, wanneer, bron:** de eigenaar, 2026-10-20, via de coördinator in dit gesprek.

### B4. Datumweergave als een taak midden op een dag begint of eindigt — besloten: optie 2

**Besluit (eigenaar, 2026-10-20, via de coördinator):** optie 2. Een datum toont alleen een tijd als het moment
midden op de werkdag valt. De regel hieronder geldt precies zo: de startkolom zonder tijd op het begin van de
werkdag, de eindkolom zonder tijd op het einde ervan, de regel voor de mijlpaal, de 24:00-regel bij de dag ervoor,
en de nachtploeg bij de dag waarop hij begint.

**Wat het is.** Na de verbouwing kan een taak midden op een dag beginnen of eindigen. Voorbeelden: A en B uit
B2 (wo 3 jun 11:00); een taak van 5 d onder het P6-profiel op de voorbeeldweek (ma 09:00); een taak op een
24-uurskalender (00:00). De eigenaar vroeg wanneer iets "midden op de werkdag" telt. Het begrip daarvoor is de
dagrand (§0).

**De regel** (voorstel van de coördinator, uitgewerkt in fixronde 1):

- De startkolom toont geen tijd als het moment het begin is van het eerste werkblok van zijn werkdag, in de
  kalender van de taak.
- De eindkolom toont geen tijd als het moment het einde is van het laatste werkblok van zijn werkdag.
- Een mijlpaal heeft één moment. Hij toont geen tijd als dat moment op een van beide dagranden valt.
- Elk ander moment toont datum en tijd. Voorbeelden op de standaardkalender (07:00–12:00 + 13:00–16:00): een
  start om 13:00 na de pauze "wo 3 jun 13:00"; een einde om 12:00 vóór de pauze "wo 3 jun 12:00"; een start om
  16:00 (een rauw anker, §4.3) "ma 1 jun 16:00"; een einde om 07:00 "di 2 jun 07:00".
- **Welke datum.** Zonder tijd staat de werkdag (§0). Met tijd staat de klokdatum, met een tijd van 00:00 tot
  23:59. OPS toont nooit "24:00".
- **De 24:00-regel** is een bijzonder geval van de eindregel: een einde om 00:00 dat het laatste werkblok van
  de dag ervoor sluit (een 24-uurskalender, of kalendertijd met dagranden 00:00 en 24:00), toont de datum van
  die dag zonder tijd. Een kalendertijd-taak van 1 d vanaf ma 00:00 toont dus "einde ma 1 jun".
- **24:00 tegenover 00:00 (review ronde 1, punt 10).** "ma 1 jun" in de eindkolom betekent "tot het einde van
  ma". "di 2 jun 00:00" verschijnt alleen als 00:00 geen dagrand is, bijvoorbeeld midden in een nachtblok.
  "ma 1 jun 00:00" is het begin van ma, nooit het einde. Zo kan de vorige datum nooit met 00:00 verschijnen.
- **Nachtploeg 22:00–06:00** (elke werkdag ma–vr; het blok hoort bij de dag waarop het begint): een start di
  22:00 toont "di 2 jun"; een einde wo 06:00 sluit het laatste blok van werkdag di en toont "di 2 jun"; een
  einde wo 02:00 toont "wo 3 jun 02:00". Een taak van één nacht toont dus "di 2 jun – di 2 jun", net als een
  dagtaak van één dag. Het alternatief is de klokdatum zonder tijd ("wo 3 jun"); dan toont één nacht
  "di 2 jun – wo 3 jun", en de 24:00-regel wordt de enige uitzondering. Dit ontwerp kiest de werkdag, omdat de
  24:00-regel en de vergelijking op dagniveau (§0) die ook gebruiken.

De 24:00-regel is ook technische keuze T3 (§4.2).

**Wat de planner ziet.** Een planning in hele dagen ziet eruit zoals nu: alleen datums. Een moment midden op de dag
valt op door de tijd erbij: bij A "einde wo 3 jun 11:00", bij B "start wo 3 jun 11:00".

**Afgewezen:** optie 1 (alleen de datum, de tijd alleen in de taakdialoog; A en B lijken dan een dag te overlappen) en
optie 3 (altijd de klokdatum met de kloktijd: "vr 5 jun 16:00", een einde om middernacht "di 2 jun 00:00", een
nachtploeg "wo 3 jun 06:00"). De eerdere aanbeveling gaf optie 3 aan wie Urenplanning aan had. Die schakelaar
verdwijnt (B2), dus optie 2 geldt voor iedereen.

**Bron van de regel:** voor de statusdatum besloot de orkestrator op 2026-10-19 "toon wat de motor gebruikt"
(`src/types/calendar.ts:115-118`). B4 trekt dat door naar taakdatums.

**Wie, wanneer, bron:** de eigenaar, 2026-10-20, via de coördinator in dit gesprek. De precieze regel komt van de
coördinator (2026-10-20, fixronde 1).

### B5. Wat ziet een planner bij het openen van een oud bestand? — besloten: berekenen en melden

**Besluit (eigenaar, 2026-10-20, letterlijk via de coördinator):** "B5 wordt optie 1, 'berekenen en melden'.
OPS rekent een oud bestand gewoon door. Daarna volgt één melding via het meldingskanaal met het aantal
verschoven taken en de grootste verschuiving. Ctrl+Z zet het terug."

**Wat de planner ziet.** Direct na het openen van een oud bestand één melding, bijvoorbeeld: "Dit bestand is
gemaakt met een oudere versie. 3 taken hebben na de berekening een ander begin of einde; de grootste verschuiving
is 1 werkdag." Ctrl+Z zet de opgeslagen datums terug, met de strook van "datums zoals opgeslagen". Die datums
blijven staan tot Bereken of een planningsbewerking, ook met Automatisch berekenen aan.

**Uitwerking (§5.2, herzien na review ronde 1, punt 1, ronde 2, punt 1 en 4, en ronde 3, punt 1 en 3).**
- Een bestand is oud als `OPS_Project.TimeModel` ontbreekt. Een document dat nog niet omgezet was, schrijft de
  markering ook niet (§5.2). Openen rekent meteen (`prepareLoadedPayload`); de
  migratie zit daarom vóór die berekening, in `payloadFromImport`.
- Eén functie doet de overgang voor elke route (§5.2).
- Ctrl+Z werkt via twee expliciete snapshots in één event. De vóór-toestand is het onberekende document in de
  modus "datums zoals opgeslagen", niet verouderd; zo rekent Automatisch berekenen het niet meteen weer door
  (review ronde 3). De eerdere opzet met `beginUndoable` na het publiceren bewaarde het vorige document (ronde 2).
- "Verschoven" betekent: het getoonde begin of einde verschilt van de datums uit het bestand. Dat is dezelfde
  telling als de strook van de modus.
- Event, melding en `isDirty` alleen als er iets verschuift. Dat is een technische keuze van de orkestrator
  (2026-10-20), geen besluit van de eigenaar. Verschuift er niets, dan ziet de planner niets en is het document
  niet gewijzigd.
- In de modus "datums zoals opgeslagen" komt geen aparte melding. Een slapend hersteld document krijgt de
  overgang bij de eerste berekening na activeren; elke route die blijvend rekent, kent de vlag (§5.2).
- Afgewezen: een dialoog vooraf met de lijst taken (optie 2) en niets melden (optie 3).

**Wie, wanneer, bron:** de eigenaar, 2026-10-20, via de coördinator in dit gesprek. Precedent: een
vergelijkbare melding bestaat al bij een profielwissel ("After applying, 573 tasks moved."; checkstap 13,
goedgekeurd door de eigenaar op 2026-10-15, `2026-10-07-review-pr109-uitkomsten.md` r.899-904 op
`origin/claude/review-pr109-log`).

### B6. Plaats van een losse mijlpaal in het OPS-profiel — besloten: einde van de werkdag

**Besluit (eigenaar, 2026-10-20, via de coördinator):** "B6 = optie 1: een losse mijlpaal staat in het
OPS-profiel aan het einde van de werkdag. Conventie: aan in ops, uit in p6/msproject."

**Wat de planner ziet** (standaardkalender, projectstart ma 1 jun). `ms-02-lone-vs-task`: losse mijlpaal M naast
taak T van 3 d; M staat op ma 1 jun 16:00, speling 2 d. `mk-02b`: FINISH-mijlpaal M zonder voorganger, FS naar B
van 2 d; B loopt van di 2 tot wo 3 jun. Onder het P6- en het MSP-profiel staat M op ma 1 jun 07:00 (speling 3 d;
B ma 1 tot di 2 jun).

**Uitwerking:** de conventie staat in §3.14 en komt in F2. Nu hangt de plaats af van de kalender (dagkalender:
einde; urenkalender: begin). Een oud OPS-bestand met een urenkalender verschuift dus; de melding van B5 telt het.

**Wie, wanneer, bron:** de eigenaar, 2026-10-20, via de coördinator in dit gesprek.

### B7. Procentlag — besloten: exact, ook in het OPS-profiel

**Besluit (eigenaar, 2026-10-20, via de coördinator):** "B7 = optie 2: een procentlag rekent exact, ook in het
OPS-profiel. Er komt geen afrondingsconventie; de twee lagadv-cases veranderen, met een redencode."

**Wat de planner ziet** (standaardkalender). Taak A van 3 d (ma 1 tot wo 3 jun 16:00), FS+50 % naar B. De lag is
1,5 d = 12 u; B begint vr 5 jun 11:00. Nu rondt OPS op een dagkalender af op 2 d (`CPMSolver.ts:261-264`) en
begint B ma 8 jun 07:00.

**Uitwerking:** §3.3. Geen conventie. `lagadv-pct-fs50-odd-roundup` en `lagadv-pct-lead-halftie` krijgen
`PCT-LAG-EXACT` (§6.1).

**Wie, wanneer, bron:** de eigenaar, 2026-10-20, via de coördinator in dit gesprek.

### B8. Schrijfwijze van de dagenmaat in de tabel — besloten: optie 2

**Besluit (eigenaar, 2026-10-20, via de coördinator):** optie 2. In het OPS-profiel is "d" de dagenmaat en staat de
urenmaat altijd in "u". Onder het P6- en het MSP-profiel is "d" de urenmaat.

**Wat het is.** In het OPS-profiel kunnen een dagenmaat-taak en een urenmaat-taak naast elkaar staan. "5 d"
kan dan twee dingen betekenen: 5 werkdagen (dagenmaat), of 5 × de werktijd per dag = 40 u (urenmaat). Op de
voorbeeldweek eindigt de eerste vr 14:00 en de tweede ma 09:00. De planner moet in de tabel zien welke maat
geldt. MSP schrijft "5 ed" voor kalendertijd (5 × 24 u); OPS gebruikt "ed" al bij een lag (`lagFormat.ts:62`).

**Wat de planner ziet en typt** (OPS-profiel, voorbeeldweek):
- Een dagenmaat-taak toont "5 d" en eindigt vr 14:00. Een urenmaat-taak toont "40 u" en eindigt ma 09:00.
- "5d" maakt de taak dagenmaat; "40u" maakt haar urenmaat.
- Een kaal getal houdt de maat van de taak, in de eenheid die de tabel toont: "3" is 3 d bij een dagenmaat-taak en
  3 u bij een urenmaat-taak.
- Een nieuwe taak krijgt de standaardmaat (B1a).
- Vast werk is altijd urenmaat (B1a; review ronde 3, punt 4). Geen invoer maakt zo'n taak dagenmaat: "5d" wordt
  5 × de werktijd per dag in de urenmaat (40 u op de standaardkalender), en de tabel toont daarna "40 u".
- Onder het P6- en het MSP-profiel is "5 d" de urenmaat (5 × de werktijd per dag), zoals in P6 en MSP. Na een
  profielwissel betekent "d" dus iets anders.
- In het OPS-profiel heeft Duurweergave geen effect (B9 = optie 1): een dagenmaat-taak toont d en een urenmaat-taak
  toont u, ook met "Altijd uren" of "Altijd dagen" (§3.12).

**Verband met het besluit van 2026-10-15 ("een dag", §3.1; `docs/ifc-round-trip.md:249-256`).** Dat besluit blijft
gelden voor de urenmaat. "1 d" in de urenmaat is de werktijd per dag van de taakkalender, niet `hoursPerDay`. Dat
geldt voor "5d" bij vast werk, voor "d" onder het P6- en het MSP-profiel, en voor het verborgen dagengetal
`scheduleDuration` van een urenmaat-taak (`hourTaskScheduleDuration`, `taskDuration.ts:65-68`). In het OPS-profiel
ziet de planner dat dagengetal niet meer in de tabel, want daar staat een urenmaat-taak in u.

**Afgewezen:** optie 1 (een eigen afkorting "wd" voor de dagenmaat: een nieuwe afkorting in 28 talen, en elke
bestaande dagtaak toont voortaan "wd") en optie 3 (overal "d", met een kolom voor de maat: het getal alleen is
dubbelzinnig, ook in een export, een rapport of het klembord).

**Wie, wanneer, bron:** de eigenaar, 2026-10-20, via de coördinator in dit gesprek. Dit ontwerp beval optie 2 aan.

### B9. Duurweergave in het OPS-profiel — besloten: optie 1

**Besluit (eigenaar, 2026-10-23, in het orkestratorgesprek):** B9 = optie 1. In het OPS-profiel heeft de instelling
Duurweergave (`durationDisplay`: "Automatisch (eigen eenheid per taak)", "Altijd dagen", "Altijd uren") geen effect.
Elke taak toont zijn eigen maat: een dagenmaat-taak in "d", een urenmaat-taak in "u" (B8 optie 2).

**Wat de planner ziet.** De instelling staat in het OPS-profiel grijs, met de hint "In het OPS-profiel toont elke
taak zijn eigen maat." Onder het P6- en het MSP-profiel werkt de instelling zoals nu. F4 voert dit uit op alle drie
de plekken van `SettingsPanelContent` (§3.12, §7.2).

**Gevolg dat de eigenaar kent:** wie in OPS de uren van een dagenmaat-taak wil zien, ziet die niet in de kolom Duur.

**Afgewezen:** optie 2 ("Altijd uren" zet ook een dagenmaat-taak om, bijvoorbeeld 5 d → "38 u" in een week met een
korte vrijdag). Dan betekent "u" twee dingen, terwijl de maat bepaalt hoe een taak rekent. Ook afgewezen: optie 3
(de instelling helemaal weg). Die neemt P6- en MSP-gebruikers een keuze af die daar alleen weergave is.

**Wie, wanneer, bron:** de eigenaar, 2026-10-23, in het orkestratorgesprek.

### Technische keuzes die dit ontwerp zelf neemt

| # | Keuze | Reden |
|---|---|---|
| T1 | Uren per dag > spanne: einde verlengen, melden | §3.1 |
| T2 | Regels D1–D7 voor datums zonder tijd, met D3 per veld (ook het baseline-einde) en D7 voor mijlpalen | §4.2; review ronde 2, punt 7 |
| T3 | 24:00-regel | §4.2, B4 |
| T4 | Grensregels N0–N3, alleen op benoemde plekken (herzien na review ronde 1) | §4.3; een algemene snap breekt `z13-*` en P6-grenzen |
| T5 | Speling in IFC als hele dagen plus minuten in de pset | §3.4, forward-compat |
| T6 | Scalaire kalender blijft scalair opgeslagen; motor leidt werkblokken af | geen kalendermigratie; het kalendervenster blijft gelijk |
| T7 | `durationUnit`, `scheduleDuration` en `lagDays` blijven | ze dragen de dagenmaat (B1); IFC, MCP en de extensie-API kennen ze al |
| T8 | SF volgt het urenpad, in elk profiel | de dagpaduitkomst (één werkdag overlap) volgt uit het inclusieve einde, niet uit een planningsregel; MSP en P6 rekenen zo (niet getoetst). Moet SF ook een besluit worden, dan krijgt het een nummer zoals B6 |
| T9 | Migratie in `payloadFromImport`, vóór iedere laadberekening (herzien na review ronde 1) | §5.2; het documentcontract loopt pas na de eerste berekening |
| T10 | IFC-formaat: in F2 alleen `TimeModel`, de schrijfregel per kalender met `LiteralTimes` (T17) en `AtDayEnd` (D7); de rest in F3 | §5.4; een planning in hele dagen blijft een ankerkalender en v2026.9.0 leest haar datums goed |
| T11 | P6-conventies op een vlag "kalender had eigen werkblokken" | hun bereik verandert niet stil |
| T12 | Ontbrekende sleutel van de conventies dagenmaat en B6 ⇒ de waarde van de basis | §3.14; een P6- of MSP-project rekent anders niet zoals P6 of MSP |
| T13 | Export van een dagenmaat-taak = werkdagen × werktijd per dag, plus de OPS-markering | §3.10; gelijk aan het P6- en het MSP-profiel, los van de plek |
| T14 | Werk van een dagenmaat-taak = werkdagen × inzet × werktijd per dag | §3.11; gelijk in elk profiel, zoals de werkdriehoek nu al rekent |
| T15 | Lezers maken altijd de urenmaat, behalve met de OPS-markering | §3.10; P6 en MSP kennen alleen de urenmaat |
| T16 | Het einde van een kalendertijd-taak is overal exclusief | §3.7, §4.2, §4.5 rij 6; het dagpad las het half inclusief (knownbugs 144); `msp-19` pint het exclusieve gedrag al |
| T17 | Normalisatie altijd en bij elke invoer, ook van de vastlegging; `TimeModel` stuurt alleen B5 en ontbreekt zolang de omzetting open is; in IFC per kalender: een ankerkalender als elk moment afleidbaar is, anders overal echte tijden met `LiteralTimes`, per document bij elke save afgeleid | §3.6, §5.2; review ronde 1, punt 2; ronde 2, punt 2 en 3; ronde 3 |
| T18 | Projectdatums blijven opgeslagen zoals ingevoerd; de motor leest start D1, statusdatum D5, einde D2 | §3.6, §4.2; review ronde 1, punt 7 |
| T19 | Eén statusregel voor werkelijke datums, met de werkdag in de kalender van de taak | §4.2; review ronde 1, punt 6 |
| T20 | Belasting per werkdag uit start- en eindmoment, met één gedeelde functie; de nivelleerder bepaalt vraag en dagen per kandidaat | §3.11; review ronde 1, punt 4; ronde 2, punt 6 |
| T21 | De maat van duur, rest en lag gaat verliesvrij mee: nooit een gebroken `P…D`; het standaardveld draagt altijd de lengte; een breuk in dagen krijgt een record `[dagen, geschreven minuten]` in een bestaande OPS-pset (voor een lag `OPS_Sequences`), en de dagen tellen alleen zolang het standaardveld de geschreven minuten draagt; in MSPDI en P6 XML hetzelfde record in de OPS-markering, per relatie met voorganger en type | §3.3, §3.10; review ronde 2, punt 5, en ronde 3, punt 2 en 5; kleinste vorm die v2026.9.0 niet verkeerd leest (BEVESTIGD) |
| T22 | De B5-overgang: één functie voor elke route; de vóór-toestand is de modus "datums zoals opgeslagen" met de vlag aan; een MCP-transactie met alleen metadata (`DATE_NEUTRAL_TASK_FIELDS`) houdt de modus, ook bij een werkregelwissel: de primitief classificeert vóór de gevolgregels, en de eindtoets legt de gevolgen over de snapshot, alleen als de taak vóór de brug aansluit op de verantwoorde toestand; twee expliciete snapshots in één `nonEdit`-event, of het omvattende event van de actie; alleen bij een verschuiving (de `isDirty`-regel van de orkestrator, 2026-10-20); een documentvlag "omzetting open" die elke route die blijvend rekent kent | §5.2; review ronde 2, punt 1 en 4; ronde 3, punt 1 en 3; ronde 4; ronde 5 (VERVOLG); ronde 6 |
| T23 | Lopers van de dagenmaat in hele minuten, zonder verborgen rest; foutgrens ½ + ½ × (begindag ÷ einddag) minuut | §3.14; review ronde 2, punt 8 |
| T24 | Zoomgrenzen zonder schakelaar: onder 400 de dagband en slepen per dag; vanaf 400 dag en uur; met Kwartierzoom vanaf 1000 uur en kwartier; maximum 1000 of 4000. Bij dagzoom valt de pointer op het begin van de werkdag (§0, B4) en komt splitwerk uit de kalender, zonder nieuwe afronding; daarna apart het minimum van één werkdag; nul heft een pauze op | §3.12; houdt de belofte "bij dagzoom per hele dag" na B2; review ronde 6 en 7 |
| T25 | De oude sleutel `ops-enableHourPlanning` blijft ongelezen staan | §3.12; geen blijvend opruimpad; zo ook bij de layouts |

## 9. Wat dit oplost

Knownbugs (nummers uit `knownbugs.md`):

- **1** uur-lag op een externe relatie genegeerd bij een dagtaak: F2 (geen dagtak meer in
  `externalForwardBound`/`externalBackwardBound`, `CPMSolver.ts:2922`, `:2948`). VERMOED.
- **2** dagtaak na urentaak op een kalender met werkblokken eindigt te vroeg: F1/F2 (N1, één pad). VERMOED.
- **23** Za aan telt voor dagtaken, niet voor urentaken: F2 (één pad). VERMOED. Het punt stond in `knownbugs.md` op
  `adaf9ab37`; `e977abf4a` (2026-10-19) haalde het als verouderd weg. Niet nagelopen of het gedrag nog bestaat.
- **55** voltooide urentaak met alleen datums als actuals: F1 (D1/D2 voor werkelijke datums). VERMOED.
- **84** MCP noemt `dur` werkdagen: F7.
- **138–141** (nieuw, uit de meting): deadline, zachte MSO, nivelleervertraging, externe opvolger: F1.
- **142** (nieuw): FF tussen dagtaken op een kalender met werkblokken één werkdag te laat: F1. PR #402 pakt 138–142
  aan (open (niet gemerged), concept, stand 2026-10-20).
- **143** (nieuw, review ronde 1): belasting van een taak die midden op een dag begint, op de verkeerde dagen: F3
  (§3.11).
- **144** (nieuw, review ronde 1): het einde van een kalendertijd-taak half inclusief in het dagpad: F2 (T16).
- **145–148** (nieuw, gemeld door de bouwer van #402): wat na #402 open blijft in het urenpad: F1 (§7.2).
- **150** (nieuw, fixronde 2): v2026.9.0 maakt van een kalender met een tijdsignaal een urenkalender zonder
  werktijd. Dit ontwerp lost het niet op (aanvaard verlies van de kalenders, §5.4); het houdt het beperkt tot
  letterlijke kalenders (T17).
- **152** (nieuw, fixronde 4): een MCP-wijziging van alleen een taaknaam verlaat "datums zoals opgeslagen": F2
  (§5.2, route 3).
- **24** de schakelaar Urenplanning uit bij werkblokken: vervalt met de schakelaar (B2, F4). Het punt staat al niet
  meer in `knownbugs.md` (`e977abf4a`, 2026-10-19, als verouderd).
- **81** voortgang zonder werkelijke datums: raakt D5/D6, lost het niet op.

TODO (`docs/TODO.md`):

- r.180: `levelingDelay` in dagen naast minuten: F6.
- r.202-206: de spelingspiegel bij een deelduur op een deeldag (12 u op een 8 u-dag: speling 1,5 in plaats van
  2,5): F1 (N1/N2 en speling in minuten).
- r.249-251: contour in dagslots van `hoursPerDay × 60` bij ongelijke dagen: blijft open. Na B1 rekent het werk
  van een dagenmaat-taak met de werktijd per dag (T14); het verschil met de uren van een korte vrijdag blijft.

Gepinde fouten in de cases: `msp-28` (SS+0 naar een kalendertijd-opvolger in uur-modus): F1. `msp-26` (zoekruimte
van de gemengde dag/uur-tak): verdwijnt met het dagpad in F2.

Interop: I1–I12 uit §1.3: I11 in F2 (geen dagtak meer), I10 in F3, I12 in F4 (invoer), I1–I3 en I5–I7 in F5a,
I4 en I8 in F5b. I9 blijft
in het OPS-profiel een bewust verschil (B1); onder het P6- en het MSP-profiel rekent OPS zelf ook in de
urenmaat, dus daar gaat niets verloren.

## 10. Meting dagcases via urenpad

### 10.1 Wat er gemeten is

Twee metingen met dezelfde dagcases. Beide zetten elke dagcase vóór het rekenen om en vergelijken op dagniveau
(datumdeel, speling met 10⁻⁶). Een case die al uren bevat, telt niet mee.

- **M1, urenpad-urentaak** (coördinator; Opus 5.5). Branch `claude/uren-poc-meting` @ `7a2c12c75`, alleen
  `tests/planning/harness.ts`, vlag `OPS_FORCE_HOURS=1`. Omzetting: elke kalender krijgt werkblokken via
  `seedScalarWorkTime` (07:00–12:00 + 13:00–16:00); duur = dagen × uren per dag × 60 (kalendertijd × 1440); lag
  × uren per dag van de voorgangerkalender; startachtig ⇒ begin eerste werkblok, eindachtig ⇒ einde laatste
  werkblok; op een niet-werkdag blijft een start middernacht en wordt een einde de volgende dag 00:00;
  statusdatum als begin van de dag.
- **M2, urenpad-dagtaak** (deze agent; Opus 5.5). Dezelfde harness plus een vlag `OPS_FORCE_BANDS=1`: kalenders
  en datums worden omgezet zoals bij M1, maar taken, lags en nivelleervertraging blijven in dagen. De patch (9
  regels) is niet gecommit; hij staat met de logs in `/tmp/uren-pad2-log/` en is met de beschrijving hierboven
  na te bouwen.
- **Nulmeting** zonder vlag: groen.
- Varianten van M1: statusdatum als einde van de dag ⇒ `cases-progress` 17 rood in plaats van 3; mijlpalen als
  dagtaak laten ⇒ dezelfde telling in de 9 batterijen waarin dat gemeten is.

### 10.2 Uitkomst

| | M1 urenpad-urentaak | M2 urenpad-dagtaak |
|---|---|---|
| dagcases | 422 | 422 |
| gelijk op dagniveau | 380 (90 %) | 364 (86 %) |
| anders | 41 | 58 |
| niet om te zetten | 1 (`durmin-on-daycal-withdm`) | 0 |

Per batterij (rode dagcases M1 / M2): advanced-cpm 3 / 14, constraints 5 / 7, edge 3 / 2, hours-relations 1 / 1,
kalenders 1 / 2, lag-advanced 4 / 5, milestone-kinds 6 / 6, milestones 4 / 4, msp-pariteit 8 / 5, probes 0 / 1,
progress 3 / 3, relations 3 / 8. Volledig groen in beide: baselines, boundary, calendar, calibration, driving,
float, move-project, resource-leveling, resource-load, view. `hours` is groen (bijna alleen urencases).

33 cases zijn rood in beide metingen, 25 alleen in M2 en 8 alleen in M1.

### 10.3 Groepen

| Groep | Aantal | Cases | Soort | Fase |
|---|---|---|---|---|
| 1 Eindmijlpaal na voorganger op het volgende blokbegin | 7 | `ms-06-end-milestone-ff`, `mk-08a`, `cst-fnet`, `ms-12-join-ff-aligned-finish`, `rel-ff-milestone-lag`, `rr-fs-succ-finishms-lag-dagpariteit`, `mk-15a` | fout (N1 ontbreekt). VERMOED plek: `nextWorkInstant`/`availableStart` (`CalendarEngine.ts:705`, `:885-888`) | F1 |
| 2 Losse mijlpaal of mijlpaal aan het begin | 7 | `ms-02-lone-vs-task`, `mk-02b`, `mk-05a`, `ms-15-milestone-no-artificial-stretch`, `edge-isolated-with-milestone-01`, `mk-06`, `mk-13b` | conventie (§4.5); `mk-05a` VERMOED fout | redencode; `mk-05a` F1 |
| 3 SF-opvolger eindigt een werkdag eerder | 6 | `rel-sf-lag-p1`, `kal-sf-multi`, `rel-sf-02-delayedpred`, `wbs-summary-relation-conservative-sf-pred-01`, `…-sf-succ-01`, `lagadv-sf-ed` | conventie (§4.5) | redencode |
| 4 Deadline een werkdag te krap | 5 | `cst-deadline-cap`, `cst-deadline-missed`, `s11-longest-path`, `cst-deadline-chain`, `prog-completed-onplan-zero-float` | fout, knownbugs 138 (BEVESTIGD op een gewone urentaak) | F1 |
| 5 Zachte MSO onterecht geschonden | 2 | `cst-mso`, `s5-mso-soft-double-bound` | fout, knownbugs 139 (BEVESTIGD) | F1 |
| 6 Kalendertijd | 5 | `msp-18-…`, `msp-20-…`, `msp-21-…`, `msp-27-…`, `lagadv-ff-lead-ed` | na review ronde 1 uitgezocht (§4.5): `msp-18`, `-20`, `-21` = het exclusieve einde (bewust, T16); `msp-27` = bekende fout van het urenpad (gepind in `msp-28`); `lagadv-ff-lead-ed` rood op de werkdagenlag, VERMOED groep 12 | redencode; `msp-27` F1 |
| 7 Nivelleervertraging | 3 | `msp-50-…`, `msp-51-…`, `msp-54-…` | fout, knownbugs 140 (BEVESTIGD); alleen M1 | F1 |
| 8 Procentlag niet afgerond | 2 | `lagadv-pct-fs50-odd-roundup`, `lagadv-pct-lead-halftie` | conventie (§4.5) | redencode |
| 9 Werkelijk einde op de statusdag | 2 | `prog-C-completed-pin-merge`, `prog-completed-overrun-negative-float` | fout in de omzetting en de klem; regel D6 | F1 |
| 10 Externe opvolger, late finish op blokbegin | 1 | `ext-successor-fs-negative` | fout, knownbugs 141 (BEVESTIGD) | F1 |
| 11 Handmatig geplande taak | 1 | `msp-57-z9a-manual-pin-forward` | omzetting (middernacht); regel D4 | F0/F1 |
| 12 Urenpad-dagtaak één werkdag naast bij een eindgrens | 25 (alleen M2) | FF: `rel-ff-lag0`, `rel-ff-lagm2`, `rel-ff-01-longshort`, `rel-multi-ff-binds`, `rel-multi-fs-ff`, `rel-ss-ff-pair`, `kal-ff-multi`, `pb-ff-forward`, `lagadv-ff-ed-weekend`, `ext-pred-ff-lag0`, `z7-split-e-ff-successor-startfromfinish`, `wbs-summary-relation-conservative-ff-succ-01`; beperkingen: `cst-mfo`, `cst-mso-violated`, `cst-snlt-float-cap`, `cst-snlt-violated`, `s2-snlt-negative`, `s3-fnet-forward`, `s6-mfo-soft`, `s8-twin-soft`; hangmat: `hammock-excluded-from-float-paths`, `hammock-not-near-critical`, `hammock-with-successor`, `s10-hammock-v1`, `s10-hammock-v2` | fout, knownbugs 142 (BEVESTIGD met een losse probe) | F1 |

Voorbeeld groep 12, `rel-ff-lag0`: A 5 d FF B 2 d. Verwacht B do 06-04 tot vr 06-05; M2 geeft vr 06-05 07:00 tot
ma 06-08 16:00, en A speling 1 in plaats van 0. Vooruit één werkdag te laat; bij SNLT/MSO achteruit één werkdag
te vroeg.

Alleen in M1 rood (8): `cst-deadline-chain`, `cst-deadline-missed` (groep 4), de drie SF-cases
`wbs-summary-…-sf-pred-01`, `…-sf-succ-01`, `rel-sf-02-delayedpred` (groep 3), en `msp-50`, `msp-51`, `msp-54`
(groep 7). M2 rekent daar in hele dagen en heeft die fouten niet.

### 10.4 Grenzen van de meting

- Verwachte dag-getallen die de harness letterlijk vergelijkt, zijn niet omgezet: `projectDuration`,
  `scheduleDuration` en variance-getallen. Een case die alleen daarop rood zou worden, valt dus niet op.
- De nivelleercases toetsen alleen datums op dagniveau.
- Geen kalender in de dagcases heeft ongelijke dagen. Wat B1 daar doet, komt uit losse probes (§4.4), niet uit
  de meting.
- MSP- en P6-gedrag voor de conventies (groep 2, 3, 8) is niet in die programma's getoetst.
- De vergelijker van de meting nam het datumdeel met `slice(0, 10)`: de klokdatum, niet de werkdag. Voor de
  dagcases maakt dat niets uit (geen nachtblok, geen 24-uurskalender), maar het bewijst de werkdagprojectie
  niet (review ronde 1, punt 9). F0 vervangt hem (§6.1).
- De vergelijker las een verwacht einde van een kalendertijd-taak als gewone datum. Volgens §4.2 (D3 per veld) is
  een verwachte `earlyFinish` exclusief en een verwachte `lateFinish` inclusief. De uitkomsten van groep 6 zijn
  daarom alleen als richting bruikbaar.

### 10.5 Losse probes van deze agent

Met dezelfde harness (gebundeld uit `tests/planning/harness.ts`), case-bestanden in `/tmp/uren-probe/`:

- Gewone urentaken (kalender ma-vr 08:00–16:00): deadline zonder tijd (138), zachte MSO op blokbegin (139),
  nivelleervertraging (140), externe opvolger (141): alle vier rood zoals beschreven in `knownbugs.md`.
- Dagtaken op een urenkalender, FF lag 0 (142): rood; FS lag 0 als controle: groen.
- Voorbeeldweek, 24-uurskalender, werkende zaterdag van 4 u, SF+0, FNET/FNLT zonder tijd, voortgang 32 %:
  uitkomsten in §4.4.

Fixronde 2 (expert-agent, Opus 5.5), script `/tmp/uren-fix2/probe.ts`, log `/tmp/uren-fix2/probe.log`. De lezer
van v2026.9.0 is gebundeld uit de broncode van de tag (gelijk aan `git show v2026.9.0:…`, nagekeken voor
`ifcReader.ts`, `subdayIo.ts`, `effectiveWorkTime.ts` en `calendar.ts`); de huidige schrijver komt van deze branch.

- W1 (§5.4): standaardkalender met een voltooide dagtaak A 11:00–16:00, een voltooide dagtaak B 07:00–16:00, een
  urentaak H 480 min 07:00–16:00 en een kalendertijd-taak E 1 d van 00:00 tot 00:00; elk veld met de echte tijd.
  v2026.9.0 leest A, B, H en E met precies die momenten, in alle velden (vroeg, laat, werkelijk). Zijn kalender:
  `workTime` met lege werkblokken op alle zeven dagen. Zijn solver (`/tmp/uren-fix2/oldsolve.ts`) geeft daarna H
  begin en einde do 07:00.
- W2: W1 met H als dagtaak (`P0Y0M1D`): dezelfde momenten, dezelfde lege kalender.
- W0: ankerkalender, dagtaken 1 jun en 3–4 jun: v2026.9.0 leest de datums; geen `workTime`.
- Lag (oud | nieuw): `P0.5D` ⇒ 5 d | 0,5 d. `PT4H0M0S` ⇒ 240 min | 240 min. `P1.5D` met `ELAPSEDTIME` ⇒ 5 d |
  1,5 d. `PT36H0M0S` met `ELAPSEDTIME` ⇒ 2160 min | 2160 min. `P2D` ⇒ 2 d | 2 d. Een extra property
  `DayMeasureLagDays` in `OPS_Sequences`: v2026.9.0 leest de lag als 240 min; de huidige lezer leest de lag en de
  bestaande grensvlag gewoon.
- B5 (§5.2): `hydratePayload` met de berekende payload en één event met `snapshotOfPayload` van de onberekende en
  de berekende payload, in één `set`. Na laden B 8 jun 07:00, één event, `isDirty` waar. Ctrl+Z: project
  `geladen-project`, taak `opgeslagen` met 15 jun, verouderd. Ctrl+Y: 8 jun 07:00.

Fixronde 3 (expert-agent, Opus 5.5), script `/tmp/uren-fix3/probe.ts`, log `/tmp/uren-fix3/probe.log` (exit 0). De
nieuwe vlag en de nieuwe IFC-eigenschap bestaan nog niet; de probe bootst ze smal na met bestaande productcode.

- B5 en Automatisch berekenen (§5.2): store met `autoCalcCPM: true`; `useAutoCalcCPM` en `useExitRecordedDates`
  regel voor regel nagebouwd als store-abonnement met dezelfde timers (100 ms en 0 ms) en dezelfde guards
  (`createFailedSolveGate`, `leftRecordedDatesMode`, `needsExitRecompute`). Taak B opgeslagen op 15 jun 07:00,
  berekend 1 jun; taak C verschuift niet. Vóór-toestand van ronde 2 (verouderd): na Ctrl+Z 15 jun, na 250 ms
  1 jun, één automatische berekening (de fout van review ronde 3). Vóór-toestand als modus: na Ctrl+Z 15 jun, in
  de modus, niet verouderd, strooktelling 1, `isDirty` waar; na 250 ms nog 15 jun en nul berekeningen; na een
  naamwijziging ook. F5: 1 jun, de modus uit, één nieuw event. Tweede Ctrl+Z: 15 jun, nul berekeningen. Taak C
  verwijderen: direct de modus uit en verouderd, na 250 ms 1 jun en niet verouderd (één berekening, via de
  verlaat-hook). Ctrl+Z: 15 jun, C terug, in de modus.
- Lag (§3.3): IFC met FS `PT4H0M0S` (240 min) en het record `{"<guid>": [0.5, 240]}` in `OPS_Sequences`. Ongewijzigd:
  de standaardlezer geeft 240 min, de leesregel 0,5 d. Alleen het standaardveld naar `PT6H0M0S`: de standaardlezer
  geeft 360 min, de leesregel houdt 360 min urenmaat (het record telt niet). v2026.9.0 leest 240 en 360 min.
  Afronding: 0,3 d × 456 min = 136,8 ⇒ `PT2H17M0S` ⇒ 137 min ⇒ 0,30044 d; met het record 0,3 d.

Fixronde 4 (expert-agent, Opus 5.5), script `/tmp/uren-fix4/probe.ts`, log `/tmp/uren-fix4/probe.log` (exit 0).
Harness van review ronde 4: de echte `appStoreContext`, de echte hooks zonder React-mount en de echte
`planner_update_tasks`. De regel van route 3 is smal nagebootst: tijdens de toolaanroep slaat een omhulsel om `runCPM`
de berekening over als het document in de modus staat en alleen velden uit `DATE_NEUTRAL_TASK_FIELDS` veranderden.

- Zonder regel, gewone importmodus (MSPDI): alleen `fields.name` ⇒ B van 15 jun 07:00 naar 1 jun 07:00, modus uit,
  één berekening (knownbugs 152).
- Met regel, B5-vóór-toestand na Ctrl+Z: alleen `fields.name` ⇒ B 15 jun 07:00, modus aan, nul berekeningen, één
  event. Ctrl+Z ⇒ naam terug, B 15 jun 07:00, modus aan.
- Met regel: `duration: 2, durationUnit: 'days'` ⇒ modus uit, B 1 jun 07:00, één berekening. Naam en duur samen:
  hetzelfde.

Fixronde 5 (expert-agent, Opus 5.5), map `/tmp/uren-fix5/`: `probe.ts`, `classification.ts`, `build.cjs`; logs
`probe-nieuw.log` en `probe-ronde4.log` (beide exit 0). Harness van review ronde 5: de echte `appStoreContext`, de
echte hooks met een vervangen `useEffect`, de echte `planner_update_tasks` en `planner_batch`. De regel van route 3
is smal nagebootst: de drie draft-primitieven classificeren hun patch vóór `settleRuleChange` met de echte
`changesOnlyDateNeutralFields`; bij een datumneutrale patch legt de transactie de velden vast die de brug schreef;
de eindtoets en `recomputeMidBatch` leggen die over de taak uit de snapshot. Taak B: 480 min, inzet 1, contour
240 min, geen vastgelegd restwerk; B5-vóór-toestand na Ctrl+Z.

- UI (`setTaskWorkRule`, `FIXED_WORK`): B 15 jun 07:00, modus aan, nul berekeningen; restwerk 480 min, contour
  480 min.
- Regel van ronde 4 (zonder vastlegging van de gevolgen): `planner_update_tasks` met `workRule: 'FIXED_WORK'` ⇒ B
  1 jun 07:00, modus uit, één berekening (de VERVOLG van review ronde 5).
- Nieuwe regel, dezelfde aanroep: B 15 jun 07:00, modus aan, nul berekeningen; tijd, contour en restwerk gelijk aan
  de UI. De brug schreef `timephasedContours` en `workRule`. Ctrl+Z zet werkregel, restwerk en contour terug; de
  modus blijft. `draft.setTaskWorkRule` rechtstreeks en een batch (werkregel, lezen, naam, lezen): ook modus aan,
  beide lezingen 15 jun 07:00, één undo-stap.
- Controles met de nieuwe regel: werkregel plus duur ⇒ rekent, modus uit; een batch met eerst een duur en dan een
  werkregel ⇒ rekent; alleen de contour schrijven in een transactie ⇒ rekent (er is geen tweede lijst).
- Tijdkop (§3.12, T24): `/tmp/uren-fix5/tiers.ts`, log `tiers.log` (exit 0). Op zoom 80, 100, 300 en 399 geeft
  `pickTiers` met de schakelaar de rij uur en `hourSnapMinutesFor` 60 min, zonder schakelaar de rij dag en 1440 min.
  Op zoom 400 met Kwartierzoom en schakelaar: kwartier, 15 min. `scaleFromZoom` geeft Uur vanaf 300 met de
  schakelaar; `maxGanttZoom` is 400 zonder schakelaar en zonder Kwartierzoom, anders 1000 of 4000.

Fixronde 6 (expert-agent, Opus 5.5), map `/tmp/uren-fix6/`. Alle logs eindigen op exit 0.

- Route 3, `probe.ts` met `classification.ts` en `build.cjs`, zelfde harness als ronde 5. Drie regels naast elkaar
  (ronde 4, ronde 5, de aansluitregel), elk zonder en met het B1a-model van de review (vast werk maakt een
  dagenmaat-taak urenmaat); logs `probe-<regel>[-b1a].log`.
  - Aansluitregel: geval 11 (alleen `workRule`, contour 240 min), de batch met leesstappen, twee werkregelwissels
    en "eerst een naam, dan de werkregel" houden de modus, met nul berekeningen.
  - Variant (a), dagtaak, duur 2 d plus vast werk in één aanroep: ronde 5 met B1a ⇒ modus aan, nul berekeningen,
    960 min (de maskering van de review). Aansluitregel ⇒ modus uit, één berekening, B 1 jun 07:00; Ctrl+Z ⇒ modus
    aan, 15 jun 07:00, 1 d. Zonder B1a ook modus uit.
  - Variant (b), ruwe contour dan werkregel: ronde 5 ⇒ modus aan (maskering); aansluitregel ⇒ modus uit, één
    berekening.
  - Controles (werkregel plus duur; eerst duur dan werkregel; alleen de contour): rekenen in elke regel.
  - Waarneming I (B1a, aansluitregel): een zuivere vast-werkwissel op een dagtaak houdt de modus in UI en MCP; de
    taak wordt 480 min urenmaat.
- T24, `splits.ts`, log `splits.log`: de bestaande functies van `splitEdit.ts`, `splitWalk.ts` en
  `CalendarEngine`, met de pointer zoals T24 in fixronde 5 (afronden op 1440, eenheid 1440) en zoals de regel
  hierboven (dagbegin, geen nieuwe afronding, kortste stap één werkdag).
  - S1, kalender 8 u, urentaak 960 min vanaf ma 07:00, klik op di: T24 oud ⇒ `position-out-of-range`; een klik
    op di 14:00 rondt zelfs af naar wo. Nieuw ⇒ werk 480, pauze 480, werk 480; segmenten ma 07:00–16:00 en
    wo 07:00–16:00.
  - S2, pauze van één werkdag één dag langer: oud ⇒ 1440 (drie werkdagen); nieuw ⇒ 960. Een werkstuk idem.
  - S3, voorbeeldweek, urentaak 1320 min vanaf wo 07:00: klik op vr ⇒ oud geweigerd; nieuw ⇒ werk 960, pauze 360,
    werk 360 (ma 07:00–14:00). Een pauze over de korte vrijdag één dag langer: oud ⇒ 1440; nieuw ⇒ +360 = 840.
  - S4, dag van 8,5 u (pauze 12:00–12:30): nieuw ⇒ split na 510 min; met eenheid 60 ⇒ 540.

Fixronde 7 (expert-agent, Opus 5.5), `/tmp/uren-fix7/splits7.ts`, log `splits7.log` (exit 0). Dezelfde bestaande
functies; de plek is nu het begin van de werkdag (blokken uit `effectiveBandsOn`), en het minimum is een aparte stap.
De probe van review ronde 7 (`/tmp/uren-review7/splits.log`) liet de gaten zien.

- S1–S4 van fixronde 6: dezelfde uitkomst.
- R1, start ma 13:00, taak 660 min, klik op di: werk 180, pauze 480, werk 480; segmenten ma 13:00–16:00 en
  wo 07:00–16:00. Het eerste werkstuk één dag inkorten: blijft 180 (de rest van ma). Eén dag verlengen: 660.
- R2, pauze van één werkdag één dag terug: nul ⇒ samengevoegd tot één stuk van 960. Met de minimumklem uit fixronde
  6 bleef er 480 staan.
- R3, nachtploeg ma–vr 22:00–06:00: (a) taak ma 22:00, 1440 min, klik di 23:00: met klok-middernacht werk 120 (de
  ploeg doormidden); nieuw werk 480, pauze 480, werk 960. (b) taak do 22:00, klik za 02:00: met de kalenderdag
  pauze 360 en werk 600; nieuw valt de plek op vr 22:00 (werkdag vr), pauze 480, werk 480 en 960. (c) klik za
  10:00 (geen werkdag): de plek valt op ma 22:00; werk 960, pauze 480, werk 480.

## 11. Wat niet gecontroleerd is

- `measure:profiles` met het P6-corpus (geen `OPS_XER_CORPUS` op deze machine).
- Het gedrag van MSP en P6 zelf bij SF, losse mijlpalen, procentlag, het einde van een kalendertijd-taak, het
  08:00-anker (I8) en ongelijke dagen. Het P6- en het MSP-profiel moeten dat gedrag volgen; F1 legt het vast met
  een bron.
- Hoe OPS v2026.9.0 een nieuw bestand leest: gemeten met zijn lezer en solver in Node (§10.5), niet in de
  desktopapp. Niet gemeten: een datum als `IFCDATETIME` in een pset, en wat v2026.9.0 bij opslaan met de nieuwe
  velden doet.
- De plek van de klem in groep 9, en of `lagadv-ff-lead-ed` echt bij groep 12 hoort.
- Prestaties van de motor op werkblokken voor alle kalenders.
- Hoe vaak gebruikersbestanden ongelijke dagen hebben.
- T12 wijkt af van een registerregel ("nooit de basiswaarde"); een reviewer moet nagaan of er nog een route is
  die `legacyValue` direct leest.
- Of de foutgrens van §3.14 ook bij een nachtblok geldt. De afleiding gaat uit van werkminuten per werkdag; een
  nachtblok hoort bij de dag waarop het begint, dus VERMOED wel. F3 toetst het.
- De nieuwe documentvlag, de overgang en de MCP-regel van route 3 bestaan nog niet als productcode. De B5-overgang is
  in losse store-probes nagespeeld (§10.5), niet in het echte laadpad. De hooks draaiden zonder React-mount (ronde 3
  nagebouwd, ronde 4 de echte hooks met een vervangen `useEffect`). Of de bibliotheekgrens alleen in `after` geen
  andere laadinvariant breekt, stelt F2 vast. De melding bij het verlaten van de modus met de vlag aan is niet
  nagespeeld, want de vlag bestaat nog niet.
- De optie "binnen een event" voor `runCPM` (route 3) is niet nagespeeld; de actieve bibliotheekverdeling is alleen
  in de code gelezen en door de reviewer gemeten.
- Of MSP en P6 een `ExtendedAttribute` of UDF voor de lagmaat bewaren als een planner het bestand daar opslaat
  (§3.3). De nieuwe markeringen en records in MSPDI en P6 XML (T21) zijn alleen als leesregel nagebootst, niet
  integraal door schrijver en lezer getoetst.
- Of D1 voor een mijlpaal zonder soort in een oud bestand de werkelijke datum gelijk houdt op dagniveau (D7).
- De precieze weging van een curve, contour of opgeslagen werk over een eerste en laatste deeldag (§3.11), en wat
  de vraag per kandidaat de nivelleerder aan tijd kost.
- De punten van knownbugs 145–148 zijn gemeld door de bouwer van #402 en niet door deze agent nagespeeld.
- De MSPDI-round-trip met 2,5 d en 1,5 d rest is door de reviewer gemeten, niet door deze agent herhaald.
- CSV als exportroute voor duur, rest en lag is niet nagelopen.
- De werkregel van route 3 (review ronde 5 en 6) is smal nagebootst (§10.5), niet als productcode. Andere
  gevolgregels die op een datumneutrale patch volgen, zijn niet gezocht; de regel dekt alleen `settleRuleChange`.
  De B1a-omzetting is een model van de review, geen F3-code.
- De splitsregel van T24 is nagebootst met de bestaande functies, niet in de echte hooks en niet in een browser.
  Werkdagencompressie draaide alleen in de probe van review ronde 7. De F3-eis voor een maatwijziging is alleen in
  de probe van de review gemeten, met een model van B1a.
- De zoomgrenzen van T24 (400 en 1000) zijn niet op leesbaarheid gemeten; F4 toetst ze in de checkstap.
- Of `allowMixedDayHour` na B8 nog iets toevoegt, is niet onderzocht. Of de tutorial-extensie in een andere repo
  staat, is niet nagekeken.

