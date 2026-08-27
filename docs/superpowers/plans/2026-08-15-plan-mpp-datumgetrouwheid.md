# Datumgetrouwheid .mpp-import — Implementatieplan (fase 3.8, etappe "MSP-pariteit")

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (aanbevolen) of `superpowers:executing-plans`. Stappen gebruiken checkbox-syntax.
> **Regelnummers in dit plan zijn indicatief — verifieer altijd op INHOUD (grep op de genoemde symboolnaam), nooit op regelnummer.**
> Opgesteld door architect-agent (Opus) 2026-08-15; orkestratorbesluiten op de openstaande vragen staan in §9.

## 1. Doel en scope

**Doel (acceptatiecriterium van de etappe, letterlijk):** na `readMPP` + herberekening (`runCPM`/`solveProject`) zijn start- én einddatum van elke taak in het volledige corpus tot op de minuut identiek aan de door MS Project zélf in datzelfde bestand opgeslagen `SCHEDULED_START`/`SCHEDULED_FINISH` (veld 35/36). Enige toegestane uitzondering: taken die in het bronbestand aantoonbaar gesplitst of resource-genivelleerd zijn — die worden bij openen gemeld en in de gids gedocumenteerd. De fidelity-meting wordt een herhaalbare regressietest met gepinde per-bestand-baselines en nette CI-skip. Alle claims mutatie-bewezen, `npm run verify` groen.

### 1.1 Gemeten uitgangspositie (2026-08-15, gepind op 97368f7d; hergemeten door de architect)

| meting | waarde |
|---|---|
| corpus | 661 `.mpp`; 445 geweigerd (`MPP_LEGACY`, buiten scope); 216 leesbaar; 174 met taken; **3413 taken** |
| leespariteit (ruwe scan vs. `readMPP`) | 3413/3413 (100%) — de lezer leest de velden correct |
| ná herberekening | start 3094 exact (90,7%), finish 2938 exact (86,1%) |
| bestanden 100% exact | 142/216 (= 100/174 met taken; 42 bestanden hebben 0 taken) |
| taken met ≥1 afwijking | 483 (313 start-afwijkingen + 450 finish-afwijkingen) |

### 1.2 Oorzaken, causaal gemeten (niet geschat)

1. **Recurrente kalenderuitzonderingen niet geëxpandeerd.** Whatif-run (jaarlijkse feestdagen zelf geïnjecteerd): startDiff 313 → 227 (−86, 27%), finishDiff 450 → 355 (−95, 21%). Corpusbrede telling van OVERGESLAGEN uitzonderingsrecords: `recType` 2 (jaarlijks-absoluut) **295**, 3 (jaarlijks-relatief) 13, 4 (maandelijks-absoluut) 7, 5 (maandelijks-relatief) 21, 6 (wekelijks) 23, 7 (dagelijks met frequentie) 9 → **368 niet-werkende recurrente records**. 44 van de 74 afwijkende bestanden hebben er minstens één.
2. **Werkende uitzonderingsdagen** (`periodCount > 0` — een uitzondering die werktijd definieert): corpusbreed **57 records** (recType 1: 48, 3: 1, 4: 2, 5: 3, 6: 3), in 10 bestanden, waarvan 6 afwijkend. Dit is géén rest-post: het is een modelgat (`WorkCalendar` kent alleen niet-werkende `holidays`).
3. **Mijlpaal-instantconventie (NIEUW — stond niet in de audit).** MS Project zet een mijlpaal na een FS-relatie op de *finish-instant* van de voorganger (`…T17:00`); wij snappen naar de volgende werk-instant (`volgende dag T08:00`). Gemeten patroon "MSP 17:00 → onze 08:00": **92 finish-afwijkingen** en **32 start-afwijkingen**, waarvan 31 op taken met duur 0 (zuivere conventie), verspreid over **31 bestanden**. Van alle 483 afwijkende taken zijn er 43 mijlpaal.
4. **Projectstart-vloer.** Zonder vloer (`NO_PSD`-run): startDiff 313 → 288 (−25), finishDiff 450 → 431 (−19), 100%-exacte bestanden 142 → 149. **Geen enkel bestand wordt slechter.** 25 taken over 12 bestanden. *Belangrijke nuance t.o.v. de goal-tekst:* slechts **11** van die 25 taken hebben een expliciete constraint (SNET) vóór de projectstart; de overige **14** hebben helemaal géén constraint — hun eigen opgeslagen anker ligt gewoon vóór de projectstart. De regel "expliciete constraint wint" dekt dus minder dan de helft (zie T7 + §9/O2).
5. **ELAPSED-duureenheden.** 5 taken in 1 bestand (`mpp14duration.mpp`). Duur-eenheden corpusbreed: `days` 3066, `hours` 202, `minutes` 133, `weeks` 6, `months` 1, `elapsed*` 5. De lezer negeert `DurationUnits` (veld 181) volledig: 1 `elapsedDay` (1440 klok-min) wordt nu 3 werkdagen.
6. **Voortgangsafronding.** `heeftVoortgang`-emmer: 14 afwijkende starts. Klein; meet-eerst-taak.
7. **Split / leveling / resource-contouring (toegestane uitzondering).** Proxy "MSP-eigen venster in werkminuten > MSP-eigen duur": **108 taken** (`spanGt`), aanwezig in 56 van de 74 afwijkende bestanden; `spanLt` 22. Twee sub-categorieën die de goal-tekst niet noemt: **resource-contouring** (`mpp14resource.mpp`, "Contoured Task") en **mijlpaal-met-duur** (`mpp14task.mpp`: `isMilestone` én duur 5 dagen, MSP-finish = start+5d) — zie §9/O1.

### 1.3 Wél in scope

Kalenderuitzonderingen (recurrent + werkend, incl. precedentie en overerving), projectstart-vloer, mijlpaal-instantconventie, ELAPSED-duur, voortgangsafronding, detectie + melding + gidsdocumentatie van splits/leveling, de fidelity-regressietest met gepinde baselines, en de residu-iteratie tot de goal gehaald is.

### 1.4 Niet in scope (eigenaarsbesluit 2026-08-15)

- **Taak-splitsen als feature** (onderbroken balken plannen/renderen/bewerken) — aparte etappe ná deze goal.
- **Resource-leveling als feature** (nivelleren, contouren, effort-driven herverdeling) — idem. `ResourceLeveler.ts` blijft ongemoeid.
- `.mpp`-export, MPP8/9/12, wachtwoordbestanden, baselines/custom fields uit `.mpp`.
- Herstructurering van `WorkCalendar` buiten wat T2 nodig heeft.

---

## 2. Takenlijst

Elke taak: **doel → bestanden → mutatie-bewijsbare acceptatie → afhankelijkheden → risico**.
**Vaste poort per taak:** `npm run typecheck` groen + `npm test` (exitcode is de poort, nooit de tail) + de eigen acceptatie. Elke taak eindigt met een commit die de **gemeten voor→na-cijfers** uit het fidelity-harnas in het bericht draagt.

---

### BAAN M — meting

#### T1 — Fidelity-harnas naar de repo, tegen de LIVE worktree

**Doel.** Het scratchpad-harnas (`measure.ts`, gepind op snapshot 97368f7d) wordt één in-repo artefact dat (a) implementers/reviewers tijdens de etappe als meetscript gebruiken en (b) de regressietest ís. Eén bron, twee modi — geen tweede implementatie die kan afdrijven.

**Bestanden (nieuw, tenzij anders vermeld).**
- `tests/planning/mppGroundTruth.ts` — de **onafhankelijke** her-implementatie van de TBkndTask-scan (eigen lus; deelt alleen `mppPrimitives`/`fieldMap14`). Overnemen uit `measure.ts` `rawScan()`. **Moduleheader moet expliciet vermelden dat dit bewust een tweede lus is en waarom** (een bug in `readTasks` mag hier niet meeliften).
- `tests/planning/mppFidelity.ts` — pure meetkern: `measureFidelity(bytes) → FidelityRow`. Roept `readMPP` (live) + **`solveProject`** (live rekenkern uit `src/engine/scheduler/solveProject.ts`) aan — níét `CPMSolver` los, zoals het scratchpad-harnas nog doet; dat harnas is gepind op vóór de `expandSummaryRelations`-verzoening en zou dus een ander pad meten dan de app.
- `tests/planning/check-mpp-fidelity.ts` — de check. Drie modi via env:
  - default: assert tegen de gepinde baseline;
  - `OPS_MPP_FIDELITY_REPORT=detail`: print per afwijkende taak `naam | MSP-start | onze-ES | MSP-finish | onze-EF | duur | mijlpaal | constraint | %voltooid | kalender | voorgangers` (het `detail`-formaat uit het scratchpad-harnas) plus de attribuut-emmers;
  - `OPS_MPP_FIDELITY_REPORT=baseline`: print het complete nieuwe baseline-JSON naar stdout (de mens plakt het in het baselinebestand — de check schrijft **nooit** zelf een bestand).
- `tests/planning/mpp-fidelity-baseline.json` — de pins (zie §6).
- `tests/planning/run.sh` — registratie binnen het `RUN_HOLIDAYS`-blok, met `bundle_check`, ná `check-mpp-summary-relations`. **Gemeten:** een volledige scan over alle 658 crawl-bestanden kost < 1 s; de tijdzone-matrix (6×) is dus geen probleem en levert bovendien gratis tz-dekking op echte data.

**Ontwerpeisen.**
- Beide corpuswortels via de bestaande conventie: `OPS_MPP_CORPUS` (default `/home/nozzit/open-aec/voor claude/test bestanden voor file implementation`) én `OPS_MPP_CRAWL` (default `…/voor claude/testdata-crawl`), beide met nette skip-OK-regel bij afwezigheid — kopieer de formulering uit `check-mpp-relations.ts` / `check-mpp-calendars.ts`.
- `MPP_LEGACY`-weigeringen tellen als "overgeslagen", nooit als fout.
- **Per veldsoort pinnen, geen som per bestand:** per bestand `tasks`, `startExact`, `startSameday`, `startDiff`, `finishExact`, `finishSameday`, `finishDiff` — elk met `===`. Plus twee globale pins: het aantal gepinde bestanden dat daadwerkelijk gezien is, en de **expliciete lijst** van bestanden met ≥1 afwijking (zodat een nieuw afwijkend bestand rood wordt, ook als een ander bestand tegelijk verbetert).
- Eén **pad-pariteitscase**: één bestand end-to-end door de échte store (`applyLoadedProject` + `runCPM`, patroon `check-mpp-open-guard.ts`) en vergelijken met wat `mppFidelity` via `solveProject` oplevert. Wijken die af, dan meet de test niet wat de app doet.

**Acceptatie (mutatie-bewijs).**
1. Verwijder de `expandSummaryRelations`-aanroep in `solveProject.ts` → check ROOD (bewijst dat de echte kern gemeten wordt). Herstellen.
2. Wijzig één teller in de baseline met ±1 → ROOD op precies dat bestand en dat veld.
3. Zet beide env-vars naar een niet-bestaand pad → exitcode 0 met twee OK-skipregels.
4. Draai met `OPS_MPP_FIDELITY_REPORT=detail` terwijl mutatie 2 actief is → nog steeds ROOD (rapportmodus verzwakt de poort niet).
5. Wijzig in `mppGroundTruth.ts` het offset-veld van `ScheduledStart` naar `ScheduledFinish` → massaal ROOD (bewijst dat de grondwaarheid echt uit het bestand komt).

**Afhankelijk van:** niets. **Blokkeert:** alle meet-claims van T2–T12 en de eindpoort T15.
**Risico:** laag-midden (alleen testcode), maar het is de fundering — kwaliteitsreview op Opus.

---

### BAAN K — kalender

#### T2 — Kalendermodel: werkende uitzonderingen + platte, per-datum-unieke materialisatie

**Doel.** `WorkCalendar` kan een dag-uitzondering dragen die de dag **werkend** maakt (evt. met afwijkende banden). De engine respecteert dat in dag- én uurmodus.

**Ontwerp (bewust plat).** MPXJ lost precedentie op in `ProjectCalendar.populateExpandedExceptions()` (verifieer op inhoud: `src/main/java/org/mpxj/ProjectCalendar.java`): recurrente uitzonderingen in de volgorde `WEEKLY → MONTHLY → YEARLY → DAILY` in een per-datum-map, daarná overschrijven niet-recurrente uitzonderingen alles. Wij doen diezelfde resolutie **bij het parsen** (T3/T4) en houden het runtime-model plat en per-datum-uniek. Voorstel:

```ts
// src/types/calendar.ts
/** Dag-uitzondering die werktijd TOEVOEGT/AANPAST (MS Project: "werkende uitzondering"). */
export interface WorkingException {
  name: string;
  startDate: string; // ISO date
  endDate: string;
  /** Banden in minuten-vanaf-middernacht, zelfde canonieke vorm als WorkTimeBands. Leeg = de
   *  weekdag-standaardbanden gelden (dag wordt werkend zonder afwijkende uren). */
  bands?: { start: number; end: number }[];
}
// WorkCalendar krijgt: workingExceptions?: WorkingException[]
```
Invariant, hard te documenteren én te testen: **een datum komt nooit in `holidays` én in `workingExceptions` voor** — de parser lost dat op. `workingExceptions` afwezig ⇒ byte-identiek gedrag.

**Bestanden.** `src/types/calendar.ts`; `src/engine/scheduler/CalendarEngine.ts` (verifieer op inhoud: `holidaySet`, `holidayDaySet`, `holidayWorkdayIdxSorted`, `isWorkDay`, `isHoliday`, `workDaysBetween` + de binary-search-helper, `bandsStartingOn`, `addWorkDays`); `tests/planning/check-calendar-hours.ts`; `tests/planning/cases-kalenders.json`.

**Let op:** `workDaysBetween` telt nu "werk-weekdagen − feestdagen-op-een-werkweekdag" via binary search. Een werkende uitzondering op een zaterdag **voegt** een werkdag toe; dat vraagt een tweede gesorteerde index (`workingExceptionOnNonWorkWeekdayIdxSorted`) — anders klopt de telling stil niet meer. Dit is de meest waarschijnlijke stille bug in deze taak.

**Acceptatie (mutatie-bewijs).**
> **Wijziging tijdens uitvoering (2026-08-15, goedgekeurd door orkestrator):** `cases-kalenders.json` wordt geïnterpreteerd door `tests/planning/harness.ts` (gedeelde infra, geen baan-eigendom), en dat `Cal`-type kent geen `workingExceptions` — een JSON-case zou stil niets testen. Daarom bewijst T2 acceptatie 1–4 als directe CalendarEngine-unit-tests in `check-calendar-hours.ts`; de CPM-end-to-end-cases via de harness zijn verplaatst naar T13 (zie daar).
1. Cases (a)–(c) als unit-tests in `check-calendar-hours.ts`: (a) werkende zaterdag in een taakduur → één werkdag extra; (b) werkende uitzondering met afwijkende banden (06:00–12:00) op een uurkalender → `workMinutesBetween` = 360 die dag; (c) werkende uitzondering die op een feestdag valt (precedentie) → dag telt als werkend.
2. Mutatie: laat `isWorkDay` `workingExceptions` negeren → (a) en (c) ROOD.
3. Mutatie: laat `bandsStartingOn` de override-banden negeren → (b) ROOD.
4. Mutatie: sla de nieuwe index in `workDaysBetween` over (val terug op de oude telling) → (a) ROOD.
5. **Byte-identiek zonder uitzonderingen:** alle 455 bestaande cases groen zonder ook maar één verwachte waarde aan te passen. Wordt een bestaande case aangepast, dan is dat een gedragswijziging die expliciet gemotiveerd moet worden in de commit.

**Afhankelijk van:** niets (T1 alleen om te meten). **Blokkeert:** T3, T4, T5.
**Risico:** hoog — raakt de heetste engine-lus. Kwaliteitsreview op Opus.

#### T3 — MPP: recurrente uitzonderingen expanderen + werkende uitzonderingen lezen

**Doel.** `parseExceptions` levert wat MS Project bedoelt in plaats van alleen de al-platte records.

**Bestanden.** `src/services/mpp/mppCalendars.ts` (verifieer op inhoud: `parseExceptions`, `isFlattenedNonRecurring`, `materializeDerived`/`budgetedInherit`, `HolidayBudget`, `MAX_CALENDAR_EXCEPTIONS`, `MAX_TOTAL_HOLIDAY_SLOTS`); `src/services/mpp/limits.ts` (nieuwe klem, zie hardening); `tests/planning/check-mpp-calendars.ts`.

**Referentie (verifieer op inhoud, niet op regelnummer):**
`voor claude/testdata-crawl/mpxj/src/main/java/org/mpxj/mpp/AbstractCalendarAndExceptionFactory.java` → `processCalendarExceptions` en `readRecurringData`; `…/org/mpxj/RecurringData.java` → `populateDates()`/`getDates()`; `…/org/mpxj/ProjectCalendar.java` → `populateExpandedExceptions()` en `ORDERED_RECURRENCE_TYPES`.

Concreet uit de Java-bron (alle offsets relatief aan het 92-byte-uitzonderingsblok):
- `+4` = `occurrences` (SHORT) — wij lezen dit nu niet;
- `+14` = `periodCount`; is die ≠ 0, dan volgen **werktijdbanden**: starttijd op `+20 + i*2`, duur op `+32 + i*4` (`MPPUtility.getTime` / `getDuration`), eind = start + duur;
- `+72` = `recurrenceTypeValue`; `RECURRENCE_TYPES` = `{null, DAILY, YEARLY, YEARLY(relatief), MONTHLY, MONTHLY(relatief), WEEKLY, DAILY}`;
- DAILY: frequentie 1 bij `recType===1`, anders `+76`; **DAILY met frequentie 1 wordt door MPXJ zelf platgeslagen** (dat doen wij al goed);
- WEEKLY: dagen-bitmap op `+76` (byte), frequentie `+78` (SHORT);
- MONTHLY absoluut: dagnummer `+76` (byte), frequentie `+78` (byte); relatief: weekdag `+77`−2, dagnummer `+76`+1, frequentie `+78` (SHORT);
- YEARLY absoluut: dagnummer `+77`, maand `+76`+1; relatief: weekdag `+78`−2, dagnummer `+77`+1, maand `+76`+1.

**Verplichte stappen.**
- [ ] Port `readRecurringData` volledig (alle 4 types × relatief/absoluut) en een `expandRecurrence(rd) → ISO-datums`-functie (poort van `RecurringData.populateDates`), begrensd op `startDate..finishDate` **én** `occurrences`.
- [ ] Werkende uitzondering (`periodCount > 0`) → `WorkingException` met banden; niet-werkend → `Holiday` (huidig gedrag).
- [ ] Precedentie exact als MPXJ: recurrente in volgorde WEEKLY → MONTHLY → YEARLY → DAILY in een per-datum-map, dan niet-recurrente eroverheen; resultaat per datum uniek en verdeeld over `holidays`/`workingExceptions`.
- [ ] Overervingsregel afgeleide kalender: **eigen uitzondering wint per datum van de basiskalender** (MPXJ valt pas op de ouder terug als de eigen kalender die datum niet kent). De huidige `[...base.holidays, ...own]`-concat kan dat niet uitdrukken zodra werkende uitzonderingen bestaan — hier moet dezelfde per-datum-map overheen.
- [ ] **Probe vóór implementatie:** `processWorkWeeks` (werkweken — alternatieve weekpatronen per datumbereik) lezen wij nergens. Meet met een wegwerp-probe hoeveel corpusbestanden een niet-lege werkweek-blok hebben; is dat > 0 en verklaart het afwijkingen, dan is dat **T3b** (apart, zelfde baan). Anders documenteren als bekend gat in de gids.

**Acceptatie (mutatie-bewijs).**
1. Fidelity-harnas: `startDiff` daalt met minstens **80** en `finishDiff` met minstens **90** t.o.v. de T1-baseline (de whatif-run bewijst 86/95 alleen al voor jaarlijks-absoluut; de overige types komen erbij). Exacte nieuwe waarden worden gepind.
2. Mutatie: schakel de YEARLY-tak in `expandRecurrence` uit → fidelity ROOD op een lijst van ≥ 30 bestanden.
3. Mutatie: laat de niet-recurrente-overlay weg (precedentie) → `calendar-exception-precedence*.mpp` ROOD (die vier bestanden bestaan precies hiervoor in de MPXJ-testset).
4. Mutatie: negeer `periodCount > 0` → de 10 bestanden met werkende uitzonderingen ROOD.
5. Vijandige synthetische fixture in `check-mpp-calendars.ts`: uitzondering met `occurrences=65535`, bereik 1984–2149 → moet klemmen (geen hang, geen geheugenexplosie), gemeten looptijd < 100 ms.

**Afhankelijk van:** T2. **Blokkeert:** T13.
**Risico:** hoog (grootste enkele winst, byte-niveau). Kwaliteitsreview op Opus.

#### T4 — MSPDI: dezelfde uitzonderingssemantiek

**Doel.** Wat T3 uit `.mpp` haalt, moet `readMSPDI` uit `<Exception>` halen — anders divergeren de twee MS-Project-paden en is de `.mpp.xml`-kruiscontrole waardeloos.

**Bestanden.** `src/services/msproject/mspdiReader.ts` (verifieer op inhoud: `applyCalendarBody`, de `<Exception>`-lus, `promoteHourCalendar`); `tests/planning/check-adapters-hours.ts`.

**Acceptatie.** `<Exception>` met `DayWorking=1` + `<WorkingTimes>` → `WorkingException` met banden; `<RecurringExceptionType>` wordt geëxpandeerd. Mutatie: negeer `DayWorking` → nieuwe case ROOD. Regressie: de drie `.mpp.xml`-ground-truths blijven binnen hun bestaande per-veldsoort-budgetten in `check-mpp-import.ts` (T5-sectie).
**Afhankelijk van:** T2 (model), T3 (gedeelde expansie-helper — hergebruik die, bouw geen tweede). **Risico:** midden.

#### T5 — IFC-round-trip voor werkende uitzonderingen

**Doel.** Nieuwe kalenderdata overleeft opslaan+heropenen. Zonder dit is elke import stil dataverlies bij de eerste Ctrl+S (CLAUDE.md: "IFC is the native file format, not a sidecar").

**Bestanden.** `src/services/ifc/ifcWriter.ts` (verifieer op inhoud: de `IFCWORKCALENDAR`-bouwer, de `holidayRefs`-lus, `ExceptionTimes` arg 6); `src/services/ifc/ifcReader.ts` (verifieer: `exceptionRefs`/`holidays`-lus); `tests/planning/check-ifc-roundtrip.ts`.

**Ontwerp (HERZIEN 2026-08-15 na spec-reviewbevinding — het oorspronkelijke ontwerp was fout).** ~~Een werkende uitzondering = `IFCWORKTIME` met gevulde `RecurrencePattern` (arg 3); een feestdag houdt `$`.~~ Dat onderscheid is NIET robuust: IFC 4.3 reserveert `RecurrencePattern` niet voor werkende uitzonderingen — een spec-conforme externe tool schrijft een recurrente feestdag ("elke 25 december") met exact zo'n gevulde ref, en die zou dan als wérkdag ingelezen worden (bewezen met een geconstrueerd fragment; regressie t.o.v. het conservatieve pre-T5-gedrag). **Herzien ontwerp:** de discriminator is een expliciete `OPS_`-pset-markering volgens het gevestigde patroon (zie `writeCalendarGenerationMeta`/herkomststempels): de writer markeert de werkende-uitzondering-`IFCWORKTIME`'s ondubbelzinnig via een OPS-pset (vlag of referentielijst); de banden mogen in de recurrence-`TimePeriods` blijven als datadrager. De reader behandelt een `IfcWorkTime` in `ExceptionTimes` alléén als werkende uitzondering wanneer de OPS-markering aanwezig is — anders als feestdag, óók met gevulde `RecurrencePattern` (het conservatieve oude gedrag voor externe bestanden). Extra acceptatiecase: een extern-stijl fragment met recurrente feestdag (gevulde `RecurrencePattern`, geen OPS-markering) leest als féést-dag — mutatiebewijs: discriminator terugzetten naar "recurrence-ref gevuld" → deze case ROOD. Backwards compatible: bestaande bestanden schrijven/lezen byte-identiek.

**Acceptatie (mutatie-bewijs).**
1. De `satisfies Required<WorkCalendar>`-fixture in `check-ifc-roundtrip.ts` geeft een **compile-fout** zodra T2 het veld toevoegt — dat is het bewijs dat het contract sluit; los die op door het veld écht te vullen, niet door de fixture te verzwakken.
2. Mutatie: laat de banden weg in de writer → round-trip ROOD (veld-voor-veld).
3. Idempotentie-check blijft groen (writeIFC∘readIFC∘writeIFC).
4. Kalender zónder werkende uitzonderingen: geschreven IFC byte-identiek aan vóór deze taak (`verify:examples` groen zonder regeneratie).

**Afhankelijk van:** T2. **Risico:** midden.

---

### BAAN S — solver

#### T6 — Mijlpaal-instantconventie (MSP: mijlpaal landt op de finish-instant van de voorganger)

**Doel.** Een mijlpaal die via FS aan een voorganger hangt, krijgt MS Projects eigen klokstand (`…T17:00`), niet de volgende werk-instant (`…+1 dag T08:00`).

**Meting die deze taak rechtvaardigt.** 92 finish-afwijkingen en 32 start-afwijkingen volgen exact het patroon "MSP 17:00 → onze 08:00"; 31 daarvan zijn duur-0-mijlpalen, verspreid over 31 bestanden. Voorbeeld (`mpp14baseline.mpp`, taak "Complete"): MSP `2006-09-14T17:00`, wij `2006-09-15T08:00`.

**Bestanden.** `src/engine/scheduler/relationMath.ts` (verifieer op inhoud: `relationBoundaryFlags`, `forwardHour`'s `FINISH_START`-tak met `succIsFinishMs`/`predEndsBeginOfDay`, `backwardHour`); `src/engine/scheduler/CPMSolver.ts` (verifieer: `hammockEarlyFinish`, `finishFromStart`, de `isMilestone`-takken); `tests/planning/cases-milestone-kinds.json`, `cases-milestones.json`, nieuw `tests/planning/cases-msp-pariteit.json`.

**Aanpak (in deze volgorde, meet-eerst).**
- [ ] De machinerie bestáát al: `milestoneKind: 'START' | 'FINISH'` met `succIsFinishMs` in `relationMath`. Geen enkele lezer zet 'm (`mppReader`/`mspdiReader` zetten alleen `isMilestone`). Onderzoek eerst of het volstaat om (a) `milestoneKind` af te leiden bij import — anker op een bandeinde ⇒ `FINISH`, op een bandbegin ⇒ `START` — en (b) `availableStart`/`nextWorkInstant` correct te laten omgaan met een instant exact op een bandgrens. **Die (b)-helft moet gemeten worden: `availableStart(17:00)` levert nu vermoedelijk `volgende dag 08:00`, ook met `succIsFinishMs`.**
- [ ] De import-afleiding (a) hoort in BAAN L (`mppReader.ts`) — zie T11. Deze taak levert alleen de solverkant + de synthetische cases.
- [ ] Blijkt (a)+(b) niet te volstaan, dan een expliciete duur-0-regel in de FS-tak. **Niet** de algemene snap-semantiek voor taken mét duur wijzigen: die is corpusbreed correct (een gewone taak ná een 17:00-finish start wél de volgende dag 08:00).

**Acceptatie (mutatie-bewijs).**
1. Nieuwe cases in `cases-msp-pariteit.json`: uurkalender 08:00–17:00, taak A eindigt di 17:00, mijlpaal M via FS → `M.earlyStart === M.earlyFinish === di 17:00`; controle-case: taak B (duur 1d) via FS → `wo 08:00` (ongewijzigd).
2. Mutatie: draai de nieuwe mijlpaaltak terug → beide fidelity-tellers stijgen met de gepinde bedragen én de nieuwe case ROOD.
3. Mutatie: pas de regel ook op duur>0 toe → de controle-case ROOD.
4. Dagmodus byte-identiek (in dagmodus bestaat de klokstand niet): alle bestaande cases groen zonder aanpassing.

**Afhankelijk van:** niets. **Blokkeert:** T13. **Risico:** hoog (raakt gedeelde relatie-wiskunde). Kwaliteitsreview op Opus.

> **Bevinding tijdens uitvoering (2026-08-15):** T6 is **corpus-dormant** tot T11 — geen lezer zet `milestoneKind`, dus `succIsFinishMs` is op het corpus overal false en T6's corpusdelta is vandaag exact 0 (schoon geïsoleerd gemeten). De verwachte ~92 finish-/~32 start-verbetering materialiseert pas bij T13 wanneer T6+T11 samen zijn geïntegreerd — T13's hermeting moet dat gecombineerde effect verantwoorden, niet per taak. Er bleken bovendien twéé onafhankelijke dubbel-snap-plekken (forwardHour-FS-tak én de generieke her-snap in forwardPass), beide apart mutatie-bewezen op case msp-01.

#### T7 — Projectstart-vloer: nooit een ingelezen anker overrulen

**Doel.** De vloer (`rootFloor`) mag geen taak vooruit klemmen die in het bronbestand aantoonbaar eerder start.

**Meting.** Vloer uitzetten: −25 start-, −19 finish-afwijkingen, +7 volledig exacte bestanden, **0 bestanden slechter**. Van de 25 taken hebben er 11 een expliciete SNET vóór projectstart; 14 hebben geen enkele constraint.

**Bestanden.** `src/engine/scheduler/CPMSolver.ts` (verifieer op inhoud: `rootFloor`, `projectStartRaw`, de `projectStart`-precompute in `forwardPass`, `applyForwardConstraints`); `src/engine/scheduler/solveProject.ts` (alleen doc-commentaar bij `projectStartDate`); `tests/planning/cases-driving.json`, `cases-move-project.json`, `cases-boundary.json`.

**Verplichte volgorde.**
- [ ] Zoek éérst de gebruikstest-bevinding 2026-08 terug die de vloer introduceerde (grep `gebruikstest-bevinding 2026-08` in `src/`, en `projectstart-vloer` in `tests/planning/cases-*.json` — `cases-driving.json` en `cases-move-project.json` leunen er expliciet op) en schrijf op wélk scenario de vloer beschermt.
- [ ] Formuleer dan de smalste regel die beide bedient. Kandidaat: de vloer geldt uitsluitend als ondergrens tegen **relatie-leads** (dat is de tekst in `forwardPass` zelf) en **niet** meer als klem op het eigen anker van een taak zonder voorganger — dus `rootFloor` levert het eigen anker, terwijl de `projectStart`-ondergrens in de voorganger-tak blijft staan. Verifieer die kandidaat tegen beide case-bestanden **en** tegen de 12 corpusbestanden.
- [ ] Lukt dat niet zonder een bestaande case te breken: **escaleren naar de orkestrator met de meting**, niet stilzwijgend een case herschrijven.

**Acceptatie (mutatie-bewijs).**
1. De 12 corpusbestanden met `storedVoorProjectstart` bereiken 0 start- en 0 finish-afwijkingen op die taken.
2. `cases-driving.json` en `cases-move-project.json` blijven groen **zonder** aangepaste verwachtingen.
3. Mutatie: zet de oude `rootFloor`-max terug → fidelity ROOD op precies die 12 bestanden.
4. Mutatie: verwijder óók de `projectStart`-ondergrens in de voorganger-tak → de lead-afkap-cases in `cases-driving.json`/`cases-lag-advanced.json` ROOD (bewijst dat de smalle regel écht smal is).

**Afhankelijk van:** niets. **Risico:** midden-hoog (bekende gebruikersfunctie). Kwaliteitsreview op Opus.

#### T8 — ELAPSED-duur rekent in kalendertijd

**Doel.** Een taak met een elapsed-duureenheid loopt 24/7 door, zoals MS Project.

**Bestanden.** `src/engine/scheduler/CPMSolver.ts` (verifieer: `finishFromStart`, `startFromFinish`, de `durationMinutesOf`/`durationDaysOf`-aanroepen); `src/engine/scheduler/duration.ts`; `tests/planning/cases-msp-pariteit.json`.
De leeskant (`durationType: 'ELAPSEDTIME'` zetten uit veld `DurationUnits`=181) zit in **T10** — disjunct bestand, expliciete afhankelijkheid.

**Precedent om te hergebruiken:** `resolveElapsedMinutes` + de `lagUnit === 'ELAPSEDTIME'`-takken in `relationMath.ts` doen dit al voor lags. Zelfde semantiek, niet een tweede variant.

**Toegevoegd uit T10-review (2026-08-15):** de uurmodus-herberekening van `scheduleDuration` in `CPMSolver` (verifieer op inhoud: `mins / (cal.hoursPerDay * 60)` in de uur-tak) is elapsed-naïef — dezelfde dubbele-deling-valkuil als de dag-modus die T10 in de lezer fixte. T8 moet deze tak `durationType`-bewust maken én een case toevoegen die uurmodus+ELAPSEDTIME `scheduleDuration` pint (T10's corpuscase test dat bewust nog niet). De lezer-kant (uurmodus in `mppReader.ts`) volgt dezelfde conventie en is dan automatisch consistent.

**Acceptatie (mutatie-bewijs).**
1. `mpp14duration.mpp` bereikt 0 afwijkingen (nu 3 finish-afwijkingen: 1 elapsed dag = +24 klok-uur, 1 elapsed week = +7 kalenderdagen, 1 elapsed maand = +30 kalenderdagen).
2. Nieuwe cases: taak met `durationType: 'ELAPSEDTIME'`, 2 dagen, start vrijdag → finish zondag (niet dinsdag).
3. Mutatie: negeer `durationType` in `finishFromStart` → case + `mpp14duration.mpp` ROOD.
4. Taken met `WORKTIME` (3408 van de 3413) volledig ongewijzigd.

**Afhankelijk van:** T10 (voor de corpusclaim); de synthetische cases kunnen eerder. **Risico:** laag-midden.

#### T9 — Voortgangsafronding (MEET-EERST)

**Doel.** Geen klokstanden produceren die MS Project nooit toont, ná de voortgangsverwerking.

**Werkwijze.** Deze taak start **na** T13's hermeting. Draai `OPS_MPP_FIDELITY_REPORT=detail` en filter op taken met `completion > 0`; classificeer het restant. Pas dán een fix ontwerpen in `CPMSolver`'s voortgangstak (verifieer op inhoud: `dataDate`-blok, `actualFinish && completion >= 1`, de `snapOnOrBefore`/`snapOnOrAfter`-inversieregel) en/of `applyCpmResult`.
**Bestanden.** `src/engine/scheduler/CPMSolver.ts`, `src/engine/scheduler/applyCpmResult.ts`, `tests/planning/cases-progress.json`.
**Acceptatie.** Elke resterende voortgang-gerelateerde afwijking is óf weg, óf gepind mét geschreven, bewijsbare reden. Mutatie: draai de fix terug → de betrokken bestanden ROOD. `cases-progress.json` blijft groen zonder aangepaste verwachtingen.
**Afhankelijk van:** T13. **Risico:** onbekend tot gemeten — daarom meet-eerst.

**T9-bevindingen (uitvoerder, 2026-08-17).** Meet-eerst-classificatie (`OPS_MPP_FIDELITY_REPORT=detail`, filter `completion > 0`, volledig corpus): 24 bestanden/66 taken met ≥1 voortgang-gerelateerde afwijking. Twee onderscheiden mechanismen, beide bevestigd:

- **(i) Fractionele restduur.** MPP's `RemainingDuration` (veld-id 31, fixed-offset 52 — nieuw ontdekt, stond nog niet in `fieldMap14.ts`) werd nooit gelezen; de solver viel terug op `(1 − completion) × totalDuration`, en `completion` is een AFGEROND percentage. Bij een niet-ronde breuk (bv. 38%) gaf dat klokstanden die MS Project nooit toont (08:14/08:19/08:29 i.p.v. bandgrenzen). **Fix:** `RemainingDuration` rechtstreeks lezen in `mppReader.ts` (uur-modus → `time.remainingMinutes`, dag-modus → `time.remainingTime`, laatste blijft — ongewijzigd besluit — genormaliseerd door `normalizeImportedProgress`'s §9.4-regel; alleen `remainingMinutes` ontsnapt daaraan, en dat is precies het corpuspad: vrijwel elk bestand leest al in uur-modus). Corpusbreed: **20 → 0 klokstand-hits** (heuristiek: minuut geen veelvoud van 5).
- **(ii) Hele-werkdag-offset in het hervattingspunt.** Na correctie van (i) bleef een resterende afwijking: MS Project hervat het restwerk van een IN PROGRESS-taak niet op `max(statusdatum, voorganger-druk)` (de bestaande, P6-getrouwe RETAINED_LOGIC-formule — zie §3.3 van het baselines-voortgang-ontwerp, letterlijk getest in `cases-progress.json`'s Scenario A/B/C) maar op `actualStart + reeds-verstreken-duur` (`totalSpan − remaining`, doorgesnapt via dezelfde werk-optelling als het restwerk zelf). Gereconstrueerd en geverifieerd tegen "Create Technical Specification" (OzBuild-corpus, 20% van 5d): onze EF verschoof van 1 werkdag te vroeg naar EXACT MSP's eigen opgeslagen finish.
  **Scope-beslissing (belangrijk):** dit is AANTOONBAAR MSP-eigen gedrag, geen herontdekte P6-regel — een universele toepassing in `CPMSolver` zou Scenario A/B/C's gedocumenteerde, BESLIST P6-semantiek stilzwijgend breken (geverifieerd: zónder scoping verschoof Scenario A-taak B 2 werkdagen). Daarom een nieuw, **opt-in** `SchedulingOptions.resumeFromActualElapsed`-veld (`src/types/project.ts`) — default `undefined`/`false` ⇒ byte-identiek aan vóór T9 voor P6/MSPDI/CSV/IFC-bronnen; uitsluitend `mppReader.ts` zet het `true` (project-breed, élke `.mpp`-import toont dit gedrag). Rondt lossless mee door IFC (generiek JSON-blob, `check-ifc-roundtrip.ts` bijgewerkt met het nieuwe veld).

**Scope-uitbreiding t.o.v. de oorspronkelijke bestandenlijst (te melden, zoals gevraagd):** mechanisme (i) kan uitsluitend in de LEZER opgelost worden (de solver consumeerde `remainingMinutes`/`remainingTime` al vóór T9 met voorrang boven de fractionele afleiding — dat deel van `CPMSolver.ts` was dus al langer correct, alleen leverde geen enkele MPP-lezing ooit een waarde). Geraakt buiten de oorspronkelijke lijst: `src/services/mpp/mppReader.ts`, `src/services/mpp/fieldMap14.ts` (nieuw veld `TaskFieldId.RemainingDuration`), `src/types/project.ts` (nieuw `SchedulingOptions`-veld), `tests/planning/check-mpp-import.ts` (nieuwe leescase "T9-voortgangsafronding" — LET OP: niet te verwarren met de gelijknamige "T9-crawl"-sectie uit fase 3.8 etappe 1's oudere taaknummering, in hetzelfde bestand), `tests/planning/check-ifc-roundtrip.ts` (`Required<SchedulingOptions>`-completeness-guard eiste het nieuwe veld).

**Voor→na (volledig corpus, `mpp-fidelity-baseline.json`).** 17 bestanden verbeterd, **0 verslechterd** — totaal `startDiff+finishDiff` over alle 216 gepinde bestanden: 410 → 214; bestanden 100% exact: 176 → 190/216. Van de vier bestanden die T13 aan T9 toewees (W14 After Para 26/28, W18 End Para 18/20): W14 After Para 28 en W18 End Para 18/20 zijn nu **volledig** exact (0 afwijkingen); W14 After Para 26 verbeterde (som 23→22) maar houdt een restant.

**Resterend, gepind met reden (niet gefixt binnen T9-scope):**
1. **Out-of-sequence-progressie** ("Validate Technical Specification", W14 After Para 26 + W14 End Para 25 — 2 bestanden, 1 taaksoort + rollup-gevolgen op 2 samenvattingstaken). De taak se eigen `actualStart` ligt VÓÓR de (herberekende) finish van zijn FS-voorganger — expliciet gedetecteerd via `CPMResult.outOfSequenceSequenceIds` (bestaande, apart ontworpen functionaliteit, §3.3 Scenario B in het baselines-voortgang-ontwerp). Fixen vergt een eigen ontwerpbeslissing (hoe RETAINED_LOGIC zich hoort te gedragen wanneer de opvolger al vóór de voorganger start) — buiten T9's mandaat (fractionele afronding + hervattingspunt), eigen T15/vervolgtaak-kandidaat.
2. **Timephased/resource-gedreven fixtures** (7 publieke MPXJ-junit-bestanden: `mpp14timephased.mpp`, `mpp14timephased2.mpp`, `timephased-actual-overtime-work.mpp`, `mpp14baseline.mpp`, `mpp14resource.mpp`, `mpp14task.mpp`, `mpp14task-from2013.mpp`) — ONGEWIJZIGD door T9 (zelfde tellingen voor/na, geverifieerd). Nacht-shift/24-uurs/overtime-werkpatronen en resource-holiday-taken zijn de toegestane leveling/resource-contouring-uitzondering (§1.4/§9-O1) resp. de reeds gedocumenteerde mijlpaal-met-duur-bug (`mpp14task.mpp`/`mpp14task-from2013.mpp`, §1.2 punt 7/§9-O1) — geen voortgang-afrondingsmechanisme.

**Synthetische cases (mutatie-bewezen).** `cases-progress.json`: `prog-T9-hervattingspunt-resumeFromActualElapsed` (mechanisme ii, vlag AAN) + `prog-T9-hervattingspunt-default-uit` (contrast, vlag UIT — bewaakt dat P6/MSPDI-bronnen ongemoeid blijven). `check-mpp-import.ts`: `[T9-voortgangsafronding]`-corpus-leescase (mechanisme i, tegen een publiek OzBuild-bestand — "Create Technical Specification" is BEWUST NIET de enige assert, want zijn breuk 20% is toevallig rond; "Technical Specification" (38%) isoleert de mutatie écht: afgeleid 3869 vs MSP's eigen 3840). Bestaande 18 `cases-progress.json`-cases + de bestaande fractionele-restduur-consumptie-case (`cases-hours.json`, "Scenario 8b") ongewijzigd groen.

**Verify.** `npm run verify` volledig groen (exit 0); `bash tests/planning/run.sh`: 489/489.

**T9-fixronde (Opus-review, 2026-08-17) — M1/M2/M3 verplicht, N1/N3/N4 klein, N2/N5 door de orkestrator zelf verwerkt.**

- **M1 (verplicht).** `remaining === 0` terwijl `completion < 1` (bv. inconsistente brondata: `RemainingDuration=0` bij `PercentComplete<100`) liet de `elapsed`-vloer een werkdag/bandgat VOORBIJ de natuurlijke finish landen (reviewer-metingen: uur ma 16:00 → di 08:00; dag vr 10-07 → ma 13-07) — de `elapsed+1`-telescopie (dag) resp. `snapOnOrAfter`-grenssnap (uur) is per constructie de hervattingsPUNT voor het RESTWERK, en zonder restwerk (`remaining=0`) valt de "−1"-tegenhanger van die telescopie weg. Fix: de vloer treedt nu uitsluitend in werking bij `remaining > 0` — bij `remaining === 0` blijft `remStart` op het bestaande `max(statusdatum, voorganger-druk)`-punt (byte-identiek aan vóór T9 voor dit randgeval). Vijandige case `prog-T9-remaining-nul-hervattingspunt-onaangeroerd` (uur-modus, `remainingMinutes: 0`) + mutatiebewijs (guard terug naar kaal `elapsed > 0` → EF verschuift van ma 08:00 naar di 08:00, exact het gemeten symptoom).
- **M2 (verplicht).** De voortgangstak rekende ONVOORWAARDELIJK met `cal.addWorkMinutes`/`cal.addWorkDaysChecked` (WERKtijd) — een ELAPSEDTIME-taak (T8, 24/7-klokrekenen) met `completion > 0` klapte dus stil om naar WORKTIME-semantiek, precies het gat dat T8 elders dichtte. Fix: nieuwe `isElapsedTask`-tak (spiegelt `!task.isMilestone && durationType==='ELAPSEDTIME'`, het patroon uit `addDurationChecked`) gebruikt nu `addElapsedMinutes` (T8's helper, GEEN kalenderband-toetsing, GEEN `snapOnOrAfter`) voor zowel de hervattingsanker als de finish; dag-modus rekent `remaining`/`elapsed` eerst om naar klok-minuten (`×24×60`, spiegelt `elapsedMinutesOf`'s eigen dag-tak). Nieuwe case `prog-T9-elapsed-restwerk-24-7` (6 elapsed dagen, 50% voortgang, vr-start ⇒ EF ma — NIET het weekend overslaand naar di, wat de WORKTIME-arithmetiek zou geven) + mutatiebewijs (`isElapsedTask` geforceerd `false` → EF verschuift naar di, exact het WORKTIME-symptoom). Corpus-impact: 0 (het enige ELAPSEDTIME-bestand, `mpp14duration.mpp`, draagt geen enkele taak met `completion>0` — de fix is dus corpusbreed onbeproefd maar wél mutatie-bewezen correct).
- **M3 (verplicht).** De discriminerende leescase stond verkeerd verankerd op "Technical Specification" — een SAMENVATTINGSTAAK (5 kinderen); `remainingMinutes` op zo'n rollup-taak bereikt de solver nooit (dezelfde valkuil als de T13-attributiefout die dit hele plan aanzette). Verankerd op het door de reviewer aangereikte BLAD "Identify Supplier Components" (`OzBuild Workshop 14 After Para 26.mpp`, `childIds.length === 0`, completion 33% van 2880 durationMinutes): afgeleide vorm zou 1930 geven, MSP's eigen opgeslagen restduur is 1920 — de mutatie-isolatie-claim is nu weer waar (bewijs: `remainingDurationOffset`/het zetten in `mppReader.ts` weglaten laat exact déze assert rood uitslaan, niet toevallig-groen op 1930).
- **N1 (klein).** `mspdiWriter.ts`: `resumeFromActualElapsed` toegevoegd aan de bestaande scheduling-opties-lost-velden-warn (naast `lagCalendar`/`totalFloatMode`/… — `p6xmlWriter.ts` warnt al generiek voor élk niet-leeg `schedulingOptions`-blok, dus die hoefde niet aangepast). Zonder deze regel zou `.mpp → MSPDI-export → herimport` het veld geruisloos laten vallen en T9's gefixte datums bij herimport weer stil laten verschuiven.
- **N3 (klein).** Nieuwe `MAX_REMAINING_DURATION_TENTHS`/`clampRemainingDurationTenths` in `limits.ts` (100 jaar in tienden-van-een-minuut, ruim boven elke realistische restduur, met meetcommentaar over het structurele INT32-plafond en de dieper liggende `CalendarEngine`/`duration.ts`-klemmen die sowieso al beschermen). `durationRaw` (SCHEDULED_DURATION) draagt dezelfde klem-leemte PRE-EXISTING, bewust ongewijzigd — genoteerd in het klem-commentaar zelf, niet gefixt (buiten T9-scope).
- **N4 (klein).** `cappedTaskIds` kon sinds M2/T9's twee checked-aanroepen per taak (hervattingsanker + restwerk-finish) dezelfde `taskId` twee keer pushen als beide tegen de onwerkbaar-venster-cap liepen — de eindconstructie dedupliceert nu via `[...new Set(...)]`.

Corpus-fidelity-impact van deze fixronde: 0 (geen enkel gepind bestand raakt M1's `remaining=0`-randgeval of M2's ELAPSEDTIME+voortgang-combinatie) — `mpp-fidelity-baseline.json` blijft ONGEWIJZIGD (0 verbeterd, 0 verslechterd, 216 ongewijzigd), consistent met de reviewer-eis dat de baseline alleen mag bewegen bij een corpusverbetering. `npm run verify` opnieuw groen (exit 0); `bash tests/planning/run.sh`: 491/491 (2 nieuwe cases in `cases-progress.json`, M3's herankering in `check-mpp-import.ts` telt niet als een nieuwe regel).

---

### BAAN L — lezer, melding, gids

#### T10 — `DurationUnits` lezen → `durationType`

**Doel.** Elapsed-eenheden overleven de import.
**Bestanden.** `src/services/mpp/mppReader.ts` (verifieer op inhoud: fase C, `durationMinutes`/`duration`-berekening, `tenthsOfMinutesToDays`, `time: { durationType: 'WORKTIME', … }`); `src/services/mpp/fieldMap14.ts` (`TaskFieldId.DurationUnits` bestaat al: 181 — nu ook echt gebruiken in `readTasks`); `tests/planning/check-mpp-import.ts`.
**Acceptatie.** Mutatie: hardcodeer `durationType: 'WORKTIME'` terug → de nieuwe leescase in `check-mpp-import.ts` ROOD (5 taken in `mpp14duration.mpp` met `elapsedMinutes/Hours/Days/Weeks/Months`). Let op de conversie: `getDuration()` in `mppPrimitives.ts` rekent elapsed al in klok-minuten — de dag-omrekening in `mppReader` mag die niet nóg eens door `hoursPerDay` delen.
**Afhankelijk van:** niets. **Blokkeert:** T8's corpusclaim. **Risico:** laag.

#### T11 — `milestoneKind` afleiden bij import

**Doel.** T6 de informatie geven die MS Project impliciet in de opgeslagen instant stopt.
**Bestanden.** `src/services/mpp/mppReader.ts`; de MSPDI-kant (`mspdiReader.ts`) **staat in BAAN K** — coördineer: deze taak wacht tot T4 gemerged is, of de MSPDI-kant verhuist naar T4.
**Ontwerp.** Alleen voor `isMilestone`-taken in uurmodus: anker exact op een bandeinde ⇒ `milestoneKind: 'FINISH'`; op een bandbegin ⇒ `'START'`; elders ⇒ niet zetten (huidig gedrag).
**Acceptatie.** Mutatie: laat de afleiding weg → de 31 mijlpaalbestanden ROOD in fidelity. Leescase in `check-mpp-import.ts`: bekende mijlpaal krijgt `FINISH`.
**Afhankelijk van:** T6 (semantiek). **Risico:** laag-midden.

#### T12 — Split-/leveling-detectie, melding in 14 talen, gidsartikel

**Doel.** De toegestane uitzondering wordt zichtbaar voor de gebruiker en gedocumenteerd. **Uitsluitend detectie + melding + documentatie — geen splits/leveling als feature.**

**Bestanden.** `src/services/mpp/mppReader.ts` (detectie); `src/services/importTypes.ts` (nieuw veld op `ImportResult`, bv. `sourceScheduleNotes?: { splitTasks: number; leveledTasks: number }` — **geen** nieuw persistent taakveld, zie §9/O3); `src/state/slices/fileSlice.ts` (verifieer op inhoud: `applyLoadedProject`, het `summaryRelationsDropped`-blok — dat is het te kopiëren patroon: `get().notify({ severity:'info', messageKey, params, dedupeKey })`); `src/i18n/locales/*/common.json` (14 talen); `public/docs/nl/gids-msproject-import.md` + `public/docs/en/gids-msproject-import.md` + `public/docs/manifest.json`; `tests/planning/check-notifications.ts`, `tests/planning/check-mpp-import.ts`.

**Detectiebronnen, in volgorde van bewijskracht.**
1. **Expliciet uit het bestand:** `LEVELING_DELAY` (TaskField; via `fixedOffsetOf(fm, id)` — de field map komt uit het bestand zelf, dus het volstaat de id-constante toe te voegen) ≠ 0, en de splits-array uit de taak-`Var2Data` (verifieer of MPXJ die in MPP14 leest: grep `setSplits`/`SPLITS` in `voor claude/testdata-crawl/mpxj/src/main/java/org/mpxj/mpp/`). Lukt de splits-bytes niet betrouwbaar, dan:
2. **Afgeleid, aantoonbaar:** MSP-eigen venster (`workMinutesBetween(storedStart, storedFinish)` in de effectieve kalender) > MSP-eigen duur ⇒ onderbroken of vertraagde balk. Gemeten: 108 taken. **Deze meting is pas betrouwbaar ná T3** (een gemiste feestdag geeft een vals positief) — daarom draait deze detectie op de gerepareerde kalender.

**Meldingstekst (nl, bron voor de 12 vertalingen; en verplicht).** Neutraal, tellend, niet-blokkerend, `severity: 'info'`, `dedupeKey: 'mpp-split-leveled'`, met `{{count}}` en volledige CLDR-pluralcategorieën (`verify:i18n` rekent met categorieën, niet met sleutelvergelijking; `zh/ja/ko` géén `_one`, `pl` `few`/`many`, `es/fr/it/pt` `many`):
> "Dit MS Project-bestand bevat {{count}} taak/taken met een onderbroken, genivelleerde of resource-gedreven planning. Open Planner Studio rekent die aaneengesloten door; hun datums kunnen daardoor afwijken van MS Project. Zie de gids: MS Project-import."

**Gidsartikel (nl + en, manifest-entry, binnen de `miniMarkdown`-subset: geen tabellen, geen blockquotes, geen h4, alleen `docs://`/`examples://`-links).** Secties: wat wél 1-op-1 overkomt (na deze etappe: datums op de minuut), wat niet (gesplitste taken, resource-nivellering, resource-contouring), waarom, en wat de gebruiker kan doen.

**Acceptatie (mutatie-bewijs).**
1. Mutatie: verwijder de `notify`-aanroep → nieuwe case in `check-notifications.ts` ROOD.
2. Mutatie: verwijder één taal uit de sleutelset → `verify:i18n` ROOD.
3. Mutatie: hernoem het gids-id in het manifest → `verify:docs` ROOD.
4. De melding verschijnt **niet** bij een bestand zónder splits/leveling (negatieve case, `Bijlage 13 Productieplanning.mpp`: `spanGt = 0`).
5. De detectie telt exact de gepinde aantallen per corpusbestand (nieuwe pins in het fidelity-baselinebestand).

**Afhankelijk van:** T3 (betrouwbare detectie). **Risico:** laag-midden; veel oppervlak (14 talen + docs).

---

### SERIEEL

#### T13 — Integratie, hermeting, herpinnen

**Doel.** Alle banen samen, één hermeting, nieuwe baselines.
**Stappen.** Banen mergen → `OPS_MPP_FIDELITY_REPORT=baseline` draaien → nieuwe pins committen → `npm run verify` → het resterende afwijkingsbeeld classificeren en aan T9/T15 doorgeven.
**Extra stap (uit T2-afwijking 2026-08-15):** `tests/planning/harness.ts` (gedeelde infra) additief uitbreiden: `Cal`-type + de `addCalendar`/`setCalendar`-call-sites krijgen een `workingExceptions`-veld, en dan alsnog de drie CPM-end-to-end-cases (werkende zaterdag / eigen banden / precedentie boven feestdag) in `cases-kalenders.json` — met mutatiebewijs dat de case rood wordt wanneer `isWorkDay` workingExceptions negeert (anders test de JSON-case stil niets, zoals T2 constateerde).
**Extra stap (uit T2-Opus-review LAAG-7, 2026-08-15):** afnemers buiten de engine die `calendar.holidays` rechtstreeks lezen of weekend hardcoderen worden `workingExceptions`-bewust of krijgen een expliciet-gedocumenteerde beperking: `src/services/print/printPreview.ts` (eigen holidaySet + `dow===6||7`-weekend — een werkende zaterdag print nu als weekend), `GanttRenderer.ts` feestdag-label (arcering is al correct via `isWorkDay`), en de exporterende paden `mspdiWriter`/`p6xmlWriter`/`freePeriods`/`extMappers` (verliezen workingExceptions nu stil bij export). Per afnemer: fixen of als bekende beperking in de gids/TODO vastleggen — niet stilzwijgend laten liggen.
**Acceptatie.** `npm run verify` groen; elke baseline-wijziging in het commitbericht verantwoord met "welke taak, welk gemeten effect".
**Verplicht vóór herpinnen (uit T1-her-check 2026-08-15):** de tussenmeting toonde naast de netto-winst **5 verslechterde bestanden (+17 afwijkingen)** — OzBuild Workshop 14 After Para 26 (+5/+6), 18 End Para 18 (+1/+3), 18 End Para 20 (+1/+3), 17 Leveling (+1/+2), 14 After Para 28 (−7/+3). T13 mag pas herpinnen ná attributie van die 5 (welke taak veroorzaakte het, is het een bug of een verklaard effect) — stilzwijgend pinnen is §T15-categorie (c).
**Restvloer-residu (T7-review M2, latent):** ná T7 mag een wortel-taak vóór de projectstart staan, maar zijn opvolgers worden door de resterende `projectStart`-ondergrens in de voorgangertak nog wél geklemd — óók bij gewone FS/FF-lag-0 (dus niet alleen leads), zonder `truncatedLeadIds`-signaal. Corpus-impact gemeten 0 (geen vroege wortel heeft vandaag een afwijkende opvolger), maar de goal eist minuut-exactheid: T13 meet dit expliciet na en T15 classificeert het restant (fix = de ondergrens alleen op negatieve lags laten vuren, of het residu eigenaar-geaccordeerd pinnen).
**Restvloer-residu — T13-hermeting (2026-08-17):** op de LIVE worktree, ná volledige integratie, herbevestigd: 0 corpus-impact (geen enkele opvolger in het corpus wijkt af door dit pad). Blijft T15-categorie (b)/(c)-kandidaat voor het eigenaarsakkoord — niet gefixt in T13, wél expliciet na-gemeten zoals hierboven geëist.
**T8-slotregistraties (Opus-eindcheck, 2026-08-17):** (1) uur-SS-gat: elapsed voorganger volledig buiten elke werkband + SS-opvolger schendt de relatie (~3 dagen) — pas bereikbaar sinds de ownAnchor-fix; gepind als bekende-bug-case (msp-28), fix vergt shiftLagPred-herontwerp (9 aanroepplekken) → T15-classificatie. (2) FF-voorganger van een elapsed opvolger meet nu ff=−1 bij tf=0 én valt uit drivingSequenceIds (raakt driving-markering, floatPath, longestPath-kritiekmodus) — gemeten, becommentarieerd bij relFloat; T15 beslist fixen of accepteren. (3) date-only-anker van een elapsed taak start in uurmodus op 00:00 i.p.v. de eerste werk-instant (consistent met het geen-snap-besluit; corpus-neutraal want .mpp levert altijd datetimes) — raakt date-only-bronnen (CSV/P6/IFC-datum/MCP); regel voor de gids bij T16.
**Cross-modus-elapsed-restbeperking (T8-her-check):** de dag-voorganger→uur-opvolger-scanlus in `relationMath` is niet elapsed-bewust; een elapsed dag-voorganger wiens EF op een niet-werkdag ligt krijgt via dat pad het volledige H2-symptoom terug (negatieve tf, ls vóór het eigen anker, FF>TF) — bereikbaar via per-taak-kalenders met gemengde modi. Becommentarieerd bij de code en gepind met een bekende-beperking-case; vergt een ander scan-algoritme. T13 neemt het mee in de cross-modus-analyse; T15 classificeert (fixen of eigenaar-geaccordeerd pinnen).
**msp-26/msp-28 — T13-hermeting (2026-08-17):** beide bekende-beperkingscases (`msp-26-t8-review-h2-crossmodus-bekende-beperking`, `msp-28-t8-review-uur-ss-bekende-beperking`) staan ongewijzigd gepind ná volledige integratie — geen regressie, geen verbetering. Het corpus bevat 1 ELAPSEDTIME-bestand (mpp14duration.mpp) en dat draagt geen enkele SS-relatie, dus dit patroon blijft corpus-synthetisch: aantoonbaar via de cases, niet via een corpusbestand geraakt. Lage prioriteit voor T15.
**Cross-modus-analysepunt (T6-her-check, pre-existent):** `p06b`-patroon — uur-voorganger → gewone dág-taak geeft do waar wo logisch is (`availableStart`'s `ceilToWorkDay` op een al vooruitgesnapte instant), en de `dataDate`-vloer snapt in de projéct-engine waardoor een instant kan ontstaan die in de taakkalender geen geldige werk-instant is. Raakt geen T6-diff; T13 neemt de cross-modus-randen als analysepunt mee bij de hermeting.
**p06b — T13-analyse (2026-08-17):** het patroon is gereproduceerd met een directe probe (uur-voorganger → dag-opvolger via `availableStart`'s `ceilToWorkDay` op een al vooruitgesnapte instant) — reëel, maar 0 corpus-impact (geen corpusbestand bevat de vereiste uur/dag-kalendermenging op dit relatiepad). Synthetisch, lage prioriteit voor T15.
**Attributie, definitief (T13-hermeting + Opus-eindreview, 2026-08-17):** de 5 verslechterde bestanden splitsen in twee categorieën, niet drie. **T16-veeglijst: de T3-ontmaskeringszin (verwijderd bij de herschrijving naar deze definitieve versie, hier hersteld):** voor *W14 After Para 26* staat al vanuit de eerdere, geïsoleerde T3-Opus-review vast dat T3's eigen kalenderexpansie voor dit bestand aantoonbaar correct is — MSP's eigen opgeslagen datums bevestigen dat New Year/Christmas/Boxing Day terecht binnen het uitzonderingsvenster meetellen; T3 is dus in geen van de vier OzBuild-bestanden de oorzaak. De verslechtering was zodoende geen T3-regressie maar **ontmaskering** van een pre-existente afwijking uit een andere baan — destijds nog vermoed als een aparte "Delivery Plan"-taakbug, hieronder definitief herzien tot voortgangsafronding (T9). *W14 After Para 26/28* leken aanvankelijk een aparte "Delivery Plan"-taakbug (~2 werkdagen mis, ogenschijnlijk duur-onafhankelijk over beide bestanden) — maar "Delivery Plan" is een VERZAMELTAAK (`childIds`.length = 5); de 14/15-daagse duur is MSP's eigen rollup-weergave, en onze earlyFinish is zélf een rollup van het kind "Review the Delivery Plan". Duur-onafhankelijkheid is bij een rollup een tautologie (de rollup-EF hangt af van het kind, niet van de ouderduur) — geen bewijs van een aparte bug. De werkelijke oorzaak in alle vier de OzBuild-bestanden (W14 Para 26/28, W18 End Para 18/20) is VOORTGANGSAFRONDING (causes-lijst §1.2 punt 6, T9-domein), met twee te onderscheiden mechanismen: (i) een fractionele restduur uit een afgerond voltooiingspercentage geeft klokstanden die MSP nooit toont (bv. 08:10/08:19/08:29) — bewijs: `completion` vervangen door `(scheduleDuration−remainingTime)/scheduleDuration` laat ze allemaal verdwijnen; eerste afwijkende bladtaak in W14: "Identify Supplier Components" (completion 0.33, remaining 4) — onze EF 2018-12-21T08:10 vs MSP's eigen opgeslagen 2018-12-20T17:00; in W18: bladtaak "Create Technical Specification" (completion 0.33, remaining 8, MÉT FS-voorganger) — onze EF 2024-12-27T08:19 vs MSP's 2024-12-30T17:00; (ii) een aparte hele-werkdag-offset in het hervattingspunt die na correctie van (i) overblijft. Eindconclusie: de 5 verslechterde bestanden zijn leveling 1 (W17, toegestane uitzondering, §1.4/§O1) + voortgangsafronding 4 (alle vier W14/W18, T9-domein). De T15-kandidaatstatus van de twee W14-bestanden vervalt hiermee; T9 erft alle vier bestanden mét deze diagnose, niet alleen de twee W18-bestanden. De delta-samenvatting bestaat inmiddels (T1-minironde); T13 verbeterde de formulering: "verslechterd" telt op de sóm start+finish, waardoor een gemengd bestand (−7 start/+3 finish) als "verbeterd" telt — geschreven als "verslechterd (op de som)", plus een aparte per-veld-telling (`fieldRegressedTags`) die alleen naar `startDiff`/`finishDiff` zelf kijkt.
**Afhankelijk van:** T2–T8, T10–T12.

#### T14 — Gebruikstest in de browser (aparte agent, DIRECT na T13)

**Doel.** Bewijzen dat het in de échte app klopt, niet alleen headless. **Bewust hier gepland, niet aan het eind.**
**Werkwijze.** Zie `docs/self-test-harness.md`, tier 1: `npm run dev` (poort per worktree — lees hem uit de dev-serveruitvoer of uit `.claude/launch.json`, neem nooit 3007 aan), Playwright-MCP + `window.__OPS__`; assert op **store-state**, niet op canvas-pixels.
**Scenario's.** (1) Open `Bijlage 20 productieplanning PKB.mpp` → geen melding, datums in de tabel gelijk aan MS Project. (2) Open een OzBuild-workshopbestand met feestdagen → Gantt toont de kerstdagen als vrij. (3) Open een bestand met leveling → melding verschijnt precies één keer, met het juiste aantal, en de gidslink werkt. (4) Open → opslaan als IFC → heropenen → kalenderuitzonderingen (ook de werkende) staan er nog, datums identiek. (5) Taalwissel naar `pl` en `ja` → meldingstekst correct meervoudig, geen Engelse terugval.
**Acceptatie.** Bevindingen als losse, benoemde items terug naar de orkestrator; blokkerende bevindingen worden taken vóór T15.

**T14-bevindingen (gebruikstest-agent, browser-tier 1, aangevuld M6 eindreview T16c).** Alle zes scenario's PASS (scenario 6, projectstart-verzetting met klem, kwam er via de opdracht bij naast de vijf hierboven):

1. **Bijlage 20 productieplanning PKB.mpp — PASS.** Geen melding (`ui.notifications` leeg). 9 steekproeftaken (posities 2,3,4,5,46,60,90,120,133 van 134) exact gematcht tussen de onafhankelijke binaire grondwaarheid (`scanGroundTruthTasks`) en de app-pijplijn (`solveMppBytes`) — naam+earlyStart+earlyFinish identiek. **Methodenotitie:** de meegeleverde `.mpp.xml`-sidecar bleek voor dit bestand GEEN betrouwbare grondwaarheid (compleet andere UID→naam→datum-toewijzing dan het echte `.mpp`, vermoedelijk andere export-/bewerkstatus) — gaf eerst een vals alarm, opgelost door tegen de echte binaire scan te verifiëren. Bewaard als valkuil-waarschuwing voor toekomstige T14-achtige checks.
2. **OzBuild Workshop 03.mpp (feestdagen) — PASS.** `calendar.holidays` bevat 10 jaar geëxpandeerde "Christmas" (2018-12-25 t/m 2027-12-25) en "New Years Day" (32 feestdagen totaal).
3. **OzBuild Workshop 17 Leveling.mpp — PASS.** Melding verschijnt EXACT 1×, `dedupeKey: 'mpp-split-leveled'`, `params.count: 2`, `severity: info`, dooft na 5s. Gidslink (Backstage → Help → "MS Project (.mpp) openen") opent en bevat matchende tekst.
4. **mpp14exceptions.mpp, werkende uitzonderingen + IFC-round-trip — PASS.** 2 werkende uitzonderingen (2008-03-09, 2008-03-16, met banden) + 1 feestdag; geverifieerd via de ECHTE `writeIFC(buildWriteIFCInput(s))` → `readIFC()`-keten — `workingExceptions`/`holidays` veld-voor-veld identiek vóór/na.
5. **Taalwissel pl/ja — PASS.** Via de echte Instellingen→Taal-UI. `count=2`: Pools rendert `_few` ("2 zadania…"), Japans `_other` — geen Engelse terugval.
6. **Projectstart-verzetting met klem (T7b) — PASS.** Losse wortel zonder voorganger/constraint klemt mee naar de nieuwe projectstart; taak met SNET-constraint blijft staan; melding `projectStartAnchorsClamped` met `count: 1`; Ctrl+Z herstelt alles.

**Losse bevinding (incidenteel gevonden tijdens scenario 3-4) — gevonden in de T14-gebruikstest, gefixt en Approved als T14b, GEEN open T15-kandidaat.** Een taak met `time.completion === undefined` liet elke `writeIFC()`-aanroep crashen (`TypeError` in `ifcTaskSlots.ts`, `w.task.time.completion.toFixed(1)`) — bereikbaar via de Extensie-API (`api.data.addTask()` zonder `completion`, `extMappers.ts`'s `fromExtTaskTime()` gaf het veld ongewijzigd door) en had auto-save/Opslaan/`planner_export_ifc` identiek gebroken. Al gedicht en gereviewd vóór deze eindreview via drie verdedigingslagen (commits `4545b014` + `577d0060` + `f88e6126`: `taskSlice.ts`/`mcpTransaction.ts`'s `addTask`, `extMappers.ts`'s `fromExtTaskTime`, en het `?? 0`-vangnet in `ifcTaskSlots.ts` zelf, zie block (8) in `check-ifc-roundtrip.ts`) — hier alleen geregistreerd zodat de T14-vondst een geadministreerd feit blijft, niets opnieuw te fixen.

**Testomgeving-kanttekening.** De browsersessie crashte halverwege scenario 3 en is herstart; scenario's 1/2 zijn daarna herbevestigd tegen de op dat moment actuele code, inclusief het (toen nog ongecommitte) T9-werk in `CPMSolver.ts`/`mppReader.ts`/`fieldMap14.ts` van een parallelle agent (voortgangsafronding) — dat raakt uitsluitend taken met `completion > 0`; de steekproeftaken in scenario 1/2 hebben allemaal `completion: 0`, dus geen gemeten impact op deze bevindingen.

#### T15 — Residu-iteratie tot de goal

**Doel.** Van "veel beter" naar "de goal".
**Werkwijze.** Itereer: `OPS_MPP_FIDELITY_REPORT=detail` → classificeer élke resterende afwijkende taak → één van drie uitkomsten:
- **(a)** het is een echte bug → eigen mini-taak in de juiste baan, met mutatiebewijs;
- **(b)** de taak is aantoonbaar gesplitst/genivelleerd/resource-gedreven → moet in de T12-detectie vallen (zo niet: detectie verbreden) en in de gids staan;
- **(c)** geen van beide → **escaleren**, niet stilzwijgend pinnen. Pinnen mag alleen met een geschreven, gemeten reden in het baselinebestand én akkoord van de orkestrator.
**Uitgangscriterium.** Elke taak in het corpus valt in (a-opgelost) of (b). Categorie (c) is leeg of expliciet door de eigenaar geaccordeerd.
**Bekende (b)-detectiegrens (T12-fixronde 2026-08-15):** zuivere resource-contouring zónder vensteruitrekking is niet betrouwbaar detecteerbaar — het WORK_CONTOUR-FixedMeta-bit uit de MPXJ-bron bleek op MPXJ's eigen referentiebestand (mpp14resource.mpp) géén discriminator (brute-force-scan, 0 treffers). Gevolg: zulke taken wijken af zónder melding — expliciet gedocumenteerd in gids + moduleheader + KNOWN-GAP-leescase. T15 mag dit her-onderzoeken (bv. via aanwezigheid van timephased-datablokken als signaal); anders is dit een punt voor het eigenaarsakkoord bij de goal-afronding, want de goal-tekst eist melding voor de uitzonderingscategorie.

**T15-iteratie 1 (2026-08-17): mijlpaal-met-duur (categorie a, gefixt).** Vier bestanden zonder melding (`mpp14task.mpp`, `mpp14task-from2013.mpp`, `taskFlags-mpp14Project2010.mpp`, `taskFlags-mpp14Project2013.mpp`) droegen een taak met `isMilestone=true` ÉN een reële duur (5–8 dagen) — MSP plant zo'n taak volgens haar eigen duur, onze `CPMSolver` liet elke `isMilestone`-check de duur naar 0 collapsen. Fix: nieuwe `isZeroDurationMilestone(task)`-helper (`isMilestone && scheduleDuration===0`) op de acht duur-collapse-plekken in `CPMSolver.ts`; `mppReader.ts`'s `milestoneKind`-afleiding (T11) alleen nog bij `durationRaw===0`. Voor→na: 4 bestanden → 0 afwijkingen, 0 verslechterd, 212 ongewijzigd. Commit `5f9799f2`.

**T15-iteratie 2 (2026-08-17), orkestratorbesluiten op de (c)-lijst.** Van de vijf (c)-items uit iteratie 1 kreeg (c)2 een fix (herdiagnose: geen `expandSummaryRelations`-bug maar een kunstmatige `dataDate`-poort in de VOLTOOID-branch, zie `7a40a5ab`); de overige vier zijn onderzocht tot op het bewijsniveau hieronder en NIET geïmplementeerd (bewijs draagt de fix niet, of de fix vergt een groter ontwerpoppervlak dan deze etappe toestaat). Dit zijn de vier dossiers waarop het eigenaarsakkoord (categorie c) rust.

**Dossier (c)5 — SNET/MSO-constraint buiten de werkband.** **M5-correctie (eindreview T16c): de oorspronkelijke titel ("de ~40%-cluster") is VERWIJDERD.** Dat label dateerde van een vroegere, brede(re) hypothese-fase vóór de hieronder beschreven corpusbrede probe en werd nooit bijgewerkt na de uitkomst — de daadwerkelijke, byte-bewezen meting (1 RAW tegen 5 SNAPPED, zie hieronder) wijst een kleine MINDERHEID aan, geen 40%-schaal cluster; het "~40%"-getal beschreef vermoedelijk een vroeg, ongeverifieerd aandeel van corpusbestanden MET minstens één SNET/MSO-taak (een heel andere teller dan "hoeveel daarvan afwijken"), en is als zodanig een verhalend restant zonder byte-bewijs — verwarrend naast de wél-geverifieerde 1-vs-5-meting die de rest van dit dossier draagt. Hypothese getoetst: "een SNET/MSO-constraint-instant buiten de werkband blijft bij MSP het rauwe instant (geen snap naar de eerstvolgende werk-instant)." Corpusbrede probe (alle SNET/MSO-taken, uur-modus, constraint-instant buiten de eigen band, `parseInstant` — niet de native `new Date(string)`, die een Z-loze string als LOKALE tijd interpreteert en zo een systematische tijdzone-vervuiling in de eerste probe-versie veroorzaakte) op ROOT-taken (geen predecessor, dus de constraint is aantoonbaar de enige driver): **1 RAW tegen 5 SNAPPED** (incl. het publieke MPXJ-fixture `mpp14recurring.mpp`). **Verdict: de hypothese is WEERLEGD** — het huidige snap-naar-werk-instant-gedrag is voor de meerderheid MSP-getrouw; de gesuggereerde "SNET/MSO als rauwe pin, T7/T8-familie"-fix zou 5 bestanden (incl. de publieke fixture) laten verslechteren.
De ENE RAW-uitzondering en één SNAPPED-geval delen dezelfde kalender/band (project-kalender, 08:00–12:00/13:00–17:00) en hetzelfde constraint-tijdstip (07:15, 45 min vóór bandstart) — toch verschilt het resultaat. **B3-correctie (Opus-her-check T15-fixronde): TASK_MODE is een HYPOTHESE, GEEN meting.** De Fixed2Meta-bit is in deze etappe NOOIT daadwerkelijk uitgelezen voor de betrokken taken — er is geen code geschreven die `TaskField.TASK_MODE` decodeert, dus er bestaat geen bevestiging dat de RAW-taak manually-scheduled is en de 5 SNAPPED-taken auto-scheduled zijn. Wat wél vaststaat: (a) de 1-vs-5-meting zelf (corpusbreed, reproduceerbaar via de probe-methode hierboven) en (b) MPXJ's `MPP14Reader.java` toont dat MS Project 2010+ een TASK_MODE-mechanisme met precies dit effect KENT (Manually Scheduled vs. Automatically Scheduled, bit-flag in `Fixed2Meta` — `PROJECT2010_TASK_META_DATA2_BIT_FLAGS`: `new MppBitFlag(TaskField.TASK_MODE, 8, 0x08, ...)`; `PROJECT2013_TASK_META_DATA2_BIT_FLAGS`/`PROJECT2016_TASK_META_DATA2_BIT_FLAGS`: offset 8, masker `0x80`, regels ~2171/2177/2185 in de crawl-kopie van MPP14Reader.java; voor een MANUALLY_SCHEDULED taak gebruikt MSP zijn eigen `START`/`FINISH`-veldpaar (TaskField 1283/1284) rechtstreeks i.p.v. `SCHEDULED_START`/`SCHEDULED_FINISH`, regels ~1162–1176). TASK_MODE is dus de BEST ONDERBOUWDE hypothese voor de discriminator (bekende byte-level mechanisme + de juiste richting van het effect), niet een geverifieerde verklaring — een alternatieve, niet-uitgesloten verklaring (bv. een ander taakveld, of een corpus-specifieke eigenaardigheid van dít ene bestand) is niet weerlegd. Dit is al gedocumenteerd als GAT (niet als gemeten oorzaak), maar niet geïmplementeerd, in twee moduleheaders: `mppReader.ts` (regel ~100–105) en `mppGroundTruth.ts` (§L5-beperking — zie L2 hieronder voor de met dezelfde hypothese/geen-meting-precisie aangescherpte versie).
**Classificatie: (c), geen fix deze iteratie.** Zelfs ALS de TASK_MODE-hypothese klopt, is de fix — TASK_MODE lezen (nieuwe `Fixed2Meta`-taakrecordlezer, mirrort het bestaande resource-Fixed2Meta-patroon in `mppEntities.ts`), het aparte START/FINISH-veldpaar lezen, én een nieuw scheduling-mode-concept in de solver (hoe propageert een handmatig-geplande taak naar haar opvolgers — bypast ze de calendar-gedreven CPM-berekening volledig?) — een eigen feature met een eigen ontwerpbeslissing, geen kleine tweak; en de hypothese is bovendien niet geverifieerd. Vermoedelijk de grootste resterende cluster (de gemeten root-milestone met dit patroon is de wortel van een lange FS-keten in het bedrijfscorpus), maar niet binnen deze iteratie te verantwoorden — eerste vervolgstap voor een toekomstige iteratie is de bit daadwerkelijk uitlezen en de hypothese bevestigen of weerleggen vóórdat er een feature op gebouwd wordt.
**M2-addendum (eindreview T16c, 2026-08-17): scope verbreed, `timephased-prorated-cost-resource.mpp` geregistreerd, geen stilzwijgende pin meer.** Zelfde symptoomfamilie als hierboven, maar dan zónder constraint: taak "No Progress - Actual Cost" (publiek MPXJ-fixture, 4 taken, geen predecessors, geen constraints) heeft een eigen opgeslagen `scheduleStart`-anker exact op een bandgrens-instant (`…T17:00`, de projectkalender se eigen 08:00–17:00-band) — MSP houdt dat rauwe instant aan (`ours` klopt niet: `2026-01-30T08:00` tegen MSP's eigen `2026-01-29T17:00`; de `earlyFinish` klopt wél, dus de discrepantie zit uitsluitend in de root-anker-snap, niet in de duurrekening). Dit is dezelfde onderliggende vraag als (c)5 (`ownAnchor`/`snapOnOrAfter` duwt een rauw, op-de-bandgrens-liggend MSP-anker door naar de volgende werk-instant, terwijl MSP 'm laat staan) maar dan zonder de SNET/MSO-constraint-laag — het raakt de kale root-anker-tak in `CPMSolver.ts` (regel ~879-894, `rootElapsed ? … : this.snapOnOrAfter(cal, earlyStart)`), niet `applyForwardConstraints`. Voorheen (vóór T16c) telde dit bestand stilzwijgend mee als "1 verslechterd/ongewijzigd bestand" zonder eigen dossierregel — het is nu EXPLICIET (c)-geregistreerd i.p.v. stil gepind: geen fix deze iteratie (zelfde risico-afweging als (c)5 — een wijziging aan de gedeelde root-anker-snap raakt ALLE root-taken, niet alleen dit bandgrens-randgeval), wél meegeteld in de "6 bestanden die zonder melding afwijken"-registratie hieronder (§H1/H2).

**Dossier (c)4 — HERDIAGNOSE (eindreview T16c/B1, 2026-08-17): geen kalenderbug — niet-gestart-vloer is P6-semantiek, geen MSP-semantiek (`calendar-exception-precedence.mpp`, ~8 jaar drift).** De oorspronkelijke diagnose hieronder ("kalenderrecurrentie-overexpansie") was FOUT gestandplaatst — nooit geverifieerd met de dataDate-schakelaar uit, terwijl die precies het instrument is dat T7's `NO_PSD`-precedent (§1.2 punt 4) al voorschreef. Reviewer-meting: `readMPP` + `solveProject` ZONDER statusdatum-vloer geeft ES/EF **minuut-exact** tegen MSP's eigen opgeslagen Start/Finish (2015-10-01T08:00 → 2026-07-23T17:00) — de kalenderrecurrentie-expansie (T3, `calendarRecurrence.ts`) is dus foutloos op dit bestand, exact zoals de originele diagnose hieronder al aantoonde (474/502 correcte 14-dagen-gaten, de precedentie-interactie tussen de overlappende recurrente reeksen is verklaard brongedrag, geen bug). Mét de statusdatum-vloer (2023-05-01, ver ná de taak se eigen anker 2015-10-01) klemt `CPMSolver.ts`'s "NIET GESTART: statusdatum als ondergrens"-tak (`t.completion === 0 && earlyStart < dataDate ⇒ earlyStart = dataDate`) de taak ~8 jaar vooruit naar 2023-05-01 → 2034-05-04. Die vloer is P6's eigen, gedocumenteerde RETAINED_LOGIC-conventie ("restwerk nooit in het verleden") — maar MS Project past 'm NIET automatisch toe op niet-gestarte taken; MSP laat een taak met een eigen, vér-vóór-de-statusdatum-liggend anker gewoon op dat anker staan (en toont 'm typisch als "achterstallig", geen automatische verschuiving).
**Fix (geland, commit-groep B1).** Nieuwe `SchedulingOptions.unstartedIgnoresStatusDate` (`src/types/project.ts`), zelfde opt-mechanisme-familie als `resumeFromActualElapsed` (T9) maar een EIGEN sibling-vlag — de twee bestrijken disjuncte taak-populaties (`completion > 0` resp. `completion === 0`; een taak valt hooguit in één van beide) en delen alleen de "MSP-voortgangsconventie i.p.v. P6-RETAINED_LOGIC"-familie, niet één mechanisme. Uitsluitend `true` gezet door `mppReader.ts` (élke `.mpp`-import, project-breed — zelfde reikwijdte-redenering als T9); MSPDI/P6/CSV/IFC-bronnen (het P6-pad) behouden de vloer bewust, `mspdiWriter.ts` warnt bij export (zelfde patroon als `resumeFromActualElapsed`) zodat een `.mpp → MSPDI → herimport`-cyclus de uitzondering niet stil laat vallen. Corpuseffect (`OPS_MPP_FIDELITY_REPORT=baseline`, volledige 216-bestand-hermeting): **1 bestand verbeterd (`calendar-exception-precedence.mpp`: 1 start-/1 finish-afwijking → 0/0, volledig exact), 0 verslechterd, 215 ongewijzigd** — de OzBuild-bestanden met statusdatum (de wacht voor deze taak, want die zijn het corpus se enige andere statusdatum-gedreven populatie) zijn stuk voor stuk gecontroleerd en GEEN ervan wijzigt. Cases voor beide semantieken in `tests/planning/cases-progress.json`: `prog-B1-unstarted-ignores-statusdate` (vlag AAN, MSP-pad: es blijft op eigen anker) + `prog-B1-p6-pad-behoudt-vloer` (vlag UIT, contrast: de bestaande `prog-datadate-floor` blijft ONGEWIJZIGD de P6-wacht). Mutatiebewijs: de `!…unstartedIgnoresStatusDate`-guard tijdelijk verwijderd → zowel `mpp-fidelity` (5 afwijkingen) als de nieuwe `progress`-case (27/28) vallen rood; hersteld → beide weer groen (505/505, 1528/1528).
**Classificatie: OPGELOST (was (c), nu (a)).** Het "byte-bewijs verplicht, geen gok"-obstakel dat de oorspronkelijke diagnose blokkeerde was symptomatisch voor de VERKEERDE hypothese (kalenderrecurrentie) — de dataDate-isolatietest (dezelfde soort whatif-schakelaar als T7's `NO_PSD`) leverde het ontbrekende byte-bewijs alsnog, maar voor een heel andere oorzaak (de niet-gestart-vloer, niet de kalenderexpansie). De oorspronkelijke recurrentie-analyse hieronder blijft staan als bewijs dat `calendarRecurrence.ts` op dit bestand correct is — dat deel van de diagnose was nooit fout, alleen niet de verklaring voor de gemeten drift.
**Oorspronkelijke (niet-fout gebleken) recurrentie-analyse, ter referentie.** Naïeve hypothese ("de biweekly-frequentie wordt dubbel geëxpandeerd") getoetst en **weerlegd**: interval-histogram over de 503 "Friday's Off"-instanties in de kalender levert `{14d: 474, 28d: 23, 42d: 2, 70d: 1, 84d: 1, 168d: 1}` — 474 van de 502 opeenvolgende gaten zijn EXACT 14 dagen, de tweewekelijkse frequentie wordt dus correct geëxpandeerd. Van de 564 kalender-vrijdagen binnen de taak se eigen venster (2015-10-01…2026-07-23) zijn er 226 als "Friday's Off" gemarkeerd (niet de naïef verwachte ~282 voor een strikte 50%-biweekly-dekking) — het verschil verklaart zich grotendeels uit (a) de recurrente reeks se eigen opgeslagen `fromDate` (2016-05-20, dus de eerste ~7,5 maand van de taak se venster valt sowieso buiten het patroon — brongegeven, geen bug) en (b) een tweede, OVERLAPPENDE recurrente reeks ("Working exception", eveneens tweewekelijks, exact in de periodes waar "Friday's Off" een langere pauze heeft) plus standaard feestdagen (Christmas Day/Eve, New Year's) die individuele instanties overschrijven — een precedentie-patroon consistent met een DOELBEWUST complexe MPXJ-testfixture (de bestandsnaam zegt het letterlijk), niet met een zichtbare over-generatiebug.

**Dossier (c)3 — START_FINISH-relatiesemantiek (`mpp14relations.mpp`, "Task 5").** MSP-eigen waarheid: ES=2006-09-22T08:00 (exact, matcht onze ES al), EF=2006-09-25T08:00 (maandag). Onze EF: 2006-09-22T17:00 (vrijdag). **M5-correctie (eindreview T16c): "3 dagen te vroeg" was een misleidende karakterisering** — vrijdag 17:00 → maandag 08:00 is in KALENDERDAGEN inderdaad ~2,6 dag, maar op een ma-vr-kalender liggen daar **0 werkminuten** tussen: vrijdag-sluiting en maandag-opening zijn AANEENSLUITENDE werk-instanten (het weekend draagt per definitie geen werktijd). De afwijking is dus niet "3 dagen mis gerekend" maar "één werk-sessie-grens gemist" — onze EF landt exact op de voorlaatste werk-instant vóór het weekend, MSP se eigen EF op de eerste werk-instant erná; qua werkelijk gewerkte tijd is het verschil nul. Handmatige trace van `relationMath.ts`'s SF-forward-tak (`reqFinish = addWorkingDaysSigned(pred.ES, lag)`, dan `deps.startFromFinish(reqFinish, successor)`) voorspelde — met Task 4 se eigen ES (2006-09-25, maandag) als basis — een verwacht resultaat van ES=2006-09-25 voor Task 5; de LIVE solver berekent echter 2006-09-22. Deze discrepantie tussen de statische trace en de runtime-uitkomst is niet opgelost binnen deze iteratie: het exacte samenspel van `forwardConstraint`/`rawMax`/de projectstart-vloer op dit ene-taak-scenario vergt runtime-debugging (breakpoints/stapsgewijze inspectie), niet alleen bronlezing.
**Classificatie: (c), geen fix — geen eenduidig bewijs.** Eén taak, publieke MPXJ-testfixture (SF is de zeldzaamste relatie-vorm), geen bedrijfscorpus-impact. Een gok in de gedeelde relatiewiskunde (die ALLE relatietypes raakt) is hier het grotere risico dan het laten staan van één afwijkende taak.

**Dossier (c)1 — out-of-sequence-driehoek (2× OzBuild W14, "Validate Technical Specification"-keten).** Ná de T15-c2-fix (voltooide-taak-pin zonder statusdatum) komen de eerste drie schakels van de keten (Determine Installation Requirements → Create Technical Specification → Identify Supplier Components) al EXACT overeen met MSP. De laatste schakel — "Validate Technical Specification" (completion 8%, `actualStart` vóór de herberekende voorganger-finish: het out-of-sequence-geval zelf) — is de ENIGE taak waar de daadwerkelijke REKENFOUT ontstaat. **M5-correctie (eindreview T16c): "alleen de laatste schakel... blijft af" was onvolledig geformuleerd.** Die ene rekenfout PROPAGEERT vervolgens door alle taken die (direct of via een voorganger-keten) van "Validate Technical Specification" afhangen — op `OzBuild Workshop 14 After Para 26.mpp` gemeten: 13 van de 18 taken wijken af (idx 0, 1, 6-8, 10-17; de rollup-samenvattingstaken 0/1/7/13 erven het verschil van hun kinderen), niet slechts de éne "laatste schakel" zelf. Precieze formulering: één root-cause-taak, met een keten van downstream-taken die de datumfout overerven — geen op-zichzelf-staande afwijking. Twee bestaande progressModi getoetst tegen MSP's eigen opgeslagen antwoord (voor "Validate Technical Specification" zelf, de bron van de propagatie):

| modus | uitkomst (finish) |
|---|---|
| RETAINED_LOGIC (huidig, incl. T9's `resumeFromActualElapsed`) | 2019-01-09T17:00 (6 dagen te laat) |
| PROGRESS_OVERRIDE | 2019-01-02T17:00 (1 dag te vroeg) |
| **MSP-eigen opgeslagen waarheid** | **2019-01-03T17:00** |

MSP's antwoord ligt TUSSEN de twee bestaande modi in, exact geen van beide. Sterke aanwijzing: bij een out-of-sequence-relatie moet de voorganger-druk (`earlyStart`, de volle herberekende voorgangerfinish) uit de RETAINED_LOGIC-hervattingsformule vervallen (zoals PROGRESS_OVERRIDE al doet) — maar niet volledig, want dat alleen geeft nog 1 dag te vroeg. De resterende kloof is niet tot een eenduidige derde formule herleid binnen deze iteratie.
**Classificatie: (c), geen fix — vergt een echte CPM-ontwerpbeslissing** (hoe RETAINED_LOGIC zich hoort te gedragen zodra een relatie al aantoonbaar out-of-sequence is) in dezelfde solver-code die deze iteratie al drie keer gewijzigd is (H1/c2, H3, M1). Een derde, halfslag-geverifieerde wijziging daar is precies het risico dat "geen gok" wil vermijden.

**H1/H2 — de 6 bestanden waar de melding de afwijking niet (volledig) dekt (eindreview T16c, gemeten 2026-08-17).** De gids beweerde tot deze fixronde "hoogstens één taak in een ongebruikelijke situatie" — een claim die nooit tegen het volledige corpus gemeten was en de bekende (c)-dossiers/detectiegrenzen negeerde. Corpusbrede meting (`sourceScheduleNotes.total`, de teller achter de leveling/split/resource-gedreven-melding, per bestand tegen de fidelity-afwijkingen): van de bestanden met ≥1 start-/finish-afwijking geven er **5 GEEN enkele melding en 1 slechts een partiële melding (over andere taken dan de afwijkende)**, verspreid over drie categorieën:

| bestand (publiek MPXJ-fixture, of hash-verwijzing bij bedrijfsdata) | afwijking | categorie |
|---|---|---|
| `OzBuild Workshop 14 After Para 26.mpp` | 9 start-/13 finish-afwijkingen | dossier (c)1 — out-of-sequence-driehoek |
| `OzBuild Workshop 14 End Para 25.mpp` | 9 start-/13 finish-afwijkingen | dossier (c)1 — out-of-sequence-driehoek (zelfde takenketen, ander bestand) |
| `mpp14relations.mpp` | 1 finish-afwijking (Task 5, START_FINISH) | dossier (c)3 — START_FINISH-relatiesemantiek |
| `mpp14resource.mpp` | 1 start-/2 finish-afwijkingen | detectiegrens — resource-contouring (§9/O1, T15) is niet betrouwbaar detecteerbaar (het WORK_CONTOUR-bit bleek op dít referentiebestand géén discriminator); categorie (b) in intentie, maar buiten bereik van de huidige detectie |
| `timephased-prorated-cost-resource.mpp` | 1 start-/1 finish-afwijking | dossier (c)5-addendum (M2) — rauw bandgrens-anker (`…T17:00`) zonder constraint/voorganger, zelfde root-anker-snapvraag als (c)5 maar zonder de SNET/MSO-laag |
| één bedrijfsbestand (hash-gesleuteld, geen naam — §6-privacybeleid) | 1 start-afwijking (`sameday`, 45 min — niet in de reguliere `startDiff`-som meegeteld omdat de dag zelf klopt) | dossier (c)5 zelf — het "1 RAW"-geval uit de SNET/MSO-probe; dit specifieke bestand toont wél een leveling-melding (`sourceScheduleNotes.total: 15`), maar die dekt 15 ANDERE taken — de (c)5-taak zelf hangt niet samen met die nivellering en blijft dus alsnog ongemeld, TWEE onafhankelijke oorzaken in één bestand (vandaar "partiële melding", niet "geen melding") |

Alle 6 zijn dus al bekend en gedocumenteerd (vier bestaande (c)-dossiers, één T15-detectiegrens, één nieuw M2-addendum) — geen van de 6 is een nieuw, ongeziene bug. Dat maakt dit een **geadministreerd feit**, geen stil gat: de melding dekt betrouwbaar leveling/split/resource-contouring-detectie (waar de indicator wél leesbaar is), maar dekt per ontwerp geen out-of-sequence-relaties, START_FINISH-relatiewiskunde, of constraint-/anker-snap-vraagstukken — dat zijn andere foutklassen dan waar de melding voor gebouwd is (§9/O1: "resource-gedreven planningsafwijkingen"). H2 (gids) hieronder herschrijft de "hoogstens één taak"-claim naar deze gemeten werkelijkheid.

**T16c-M1 — kruis-kalender-FS-asymmetrie (relationMath.ts, snap in voorganger-kalender bij lag=0), ONDERZOCHT en NIET GEFIXT — genuine spanning tussen corpus en een bestaande guard-test.** Corpusbewijs (OzBuild-crawlbestand, `OzBuild Workshop 14 End Para 29.mpp`, 2 taken): een FS+0-relatie waarbij voorganger en opvolger IDENTIEKE Mon-Vrij-banden delen maar verschillen op zaterdag (opvolger-kalender "6 Day Week" werkt óók zaterdag, voorganger-kalender "Standard" niet) — MSP's eigen opgeslagen ES is zaterdag 08:00, wij berekenden maandag 08:00. Root-oorzaak in beide `forwardHour`/`backwardHour` (uur-modus) én `forwardDay`/`backwardDay` (dag-modus): bij lag=0 snapt de finish-grens EERST in de VOORGANGER-kalender (`pe.nextWorkInstant`/`pe.nextWorkDayAfter`) — die kent zaterdag niet als werkdag en springt dus meteen naar maandag — vóórdat de OPVOLGER-kalender (die zaterdag wél kent) ooit gezien wordt.
Een narrow fix (lag===0 ⇒ de grens-snap rechtstreeks in de OPVOLGER-kalender, `se.nextWorkDayAfter`/`se.availableStart(predDone)`, i.p.v. via de voorganger) loste het OzBuild-geval op (geverifieerd: -4 start+finish-afwijkingen, 1 bestand 100% exact, 0 corpusregressie) en bleef in DAG-modus volledig byte-identiek op alle bestaande `cases-kalenders.json`-scenario's (1/2/3, inclusief kruis-kalender-lag-gevallen). In UUR-modus brak dezelfde fix echter een BESTAANDE, doelbewust ontworpen regressietest (`msp-04-m2-guard1-alleen-crosscalendar`, `cases-msp-pariteit.json`): twee taken op verschillende uur-kalenders met ECHT verschillende bandgrenzen (niet alleen extra werkdagen, maar andere start-/eindtijden) — díe test verwacht dat de opvolger NIET in het voorganger-finish-instant "meelift" ook al valt dat toevallig binnen de opvolger se eigen band, maar juist een verse sessie start. Reconstructie van BEIDE verwachte uitkomsten bevestigt: de bestaande `pe`-eerst-dan-`se`-dubbele-snap (huidig gedrag) is voor het guard1/guard2-scenario aantoonbaar CORRECT (de eerste `pe.nextWorkInstant`-stap duwt het voorganger-finish-instant, dat exact op een bandgrens ligt, terecht naar de volgende VOORGANGER-sessie, en pas dáárna normaliseert de opvolger-kalender die waarde verder) — maar voor het OzBuild-geval aantoonbaar FOUT (dezelfde `pe`-eerste-stap springt over zaterdag heen omdat de voorganger-kalender die dag niet kent, terwijl de bandgrenzen op de gedeelde weekdagen tussen de twee kalenders IDENTIEK zijn — géén bandgrens-verschil om te detecteren).
**Classificatie: (c)-dossier, geen fix deze iteratie — "byte-bewijs verplicht, geen gok" is niet gehaald voor een universele regel.** Beide voorbeelden zijn met byte-bewijs onderbouwd, maar wijzen naar TEGENGESTELDE regels (voorganger-kalender-eerst vs. opvolger-kalender-eerst) — een discriminator die beide gevallen correct behandelt (bv. "voorganger-eerst tenzij de kalenders op de gedeelde werkdagen identieke banden hebben, dan opvolger-eerst") is niet getoetst binnen deze iteratie en zou een derde, ongeverifieerde aanname aan de gedeelde relatie-wiskunde toevoegen — precies het risico dat de hardening-checklist (§7) wil vermijden op code met deze blast radius (`relationMath.ts` raakt ALLE FS-relaties, dag én uur). Voor de eigenaar: het OzBuild-corpusgeval blijft ONGEFIXT (2 taken, 1 bestand, reeds gedekt door de bestaande leveling-melding op datzelfde bestand — geen SILENT deviation, zie §H1/H2's tabel) — een toekomstige iteratie kan de discriminator (bandstructuur-gelijkheid tussen `pe` en `se` op de gedeelde werkdagen) daadwerkelijk uitlezen en toetsen vóór een fix.

**N1 — bekende beperking, geregistreerd (niet gefixt): negatieve float op gepinde actuals.** Sinds de T15-c2/H1/M1-fixronde pint een VOLTOOIDE of IN-PROGRESS taak haar ES/EF-randen op haar eigen actuals, ongeacht statusdatum. Bij een taak met een HARDE late-zijde-constraint (SNLT/FNLT/MSO/MFO) die door de gepinde actuals overschreden wordt, kan `totalFloat` negatief uitvallen op een manier die de bestaande `violatedConstraintTaskIds`-detectie (§4.2) niet per se dekt voor dit SPECIFIEKE pad (actuals-gedreven, niet forward-constraint-gedreven). Geen corpusbestand raakt dit gemeten (0 impact op de 216 gepinde bestanden); geregistreerd als bekende rand voor een latere etappe of een gerichte case, niet uitgezocht binnen deze iteratie.

#### T16 — Eindreview, `verify`, documentatie bijwerken

`npm run verify` groen; `docs/TODO.md` bijgewerkt; MPXJ-attributie in nieuwe/gewijzigde bestanden intact (LGPL-2.1-herkomst); hyperkritische eindreview (Opus) op de volledige diff van de etappe.
**T9-registraties (Opus-review 2026-08-17):** `resumeFromActualElapsed` is bewust onzichtbare, permanente projectsemantiek — een project dat één keer door `.mpp` ging houdt de MSP-hervattingsconventie, ook door IFC heen, zonder UI-zichtbaarheid; T16 neemt een gidsregel op (en overweegt tonen in CalcOptionsSection als read-only). De klokstand-heuristiek-telling in eerdere notities ("20→0") was los zand; de juiste meting is 126 voorkomens/80 taakregels/9 bestanden → 0, geen nieuwe klasse (reviewer-gemeten).
**T9-hercheckregistraties (2026-08-17):** M2's elapsed-voortgangsfix is bewust universeel (durationType-bug, geen MSP-conventie) — raakt dus ook P6/MSPDI/CSV/IFC-bronnen met voortgang op elapsed-taken; niets pinde het oude gedrag. Extra T16-restjes: case-id `prog-T9-remaining-nul-natuurlijke-finish` sprak zijn eigen titel tegen (gepind is het bestaande `max(statusdatum, voorganger-druk)`-hervattingspunt — hier gelijk aan de actualStart, niet de natuurlijke/taakeigen finish) — **T16: hernoemd naar `prog-T9-remaining-nul-hervattingspunt-onaangeroerd`** (in `cases-progress.json`, `CPMSolver.ts` se verwijzing en dit document); theoretische fractionele-remaining-kier (extensie-API-only) dichten of becommentariëren.
**T16-veeglijst (verzameld tijdens de etappe):** MAX_DAY_HOUR_PERIODS-rekenfout (pre-existent, T3-review); dode isHoliday-API/workingExceptionSet (T2-review LAAG-5); computeStandardWorkdayBands-vs-hoursPerDay-spanning bij zelf-tegenstrijdige kalenders (T2-eindcheck); gidsclaim "tot op de minuut" aanscherpen zodra T15 klaar is + date-only-ankersemantiek elapsed/uurmodus in de gids (T8); P6-workingexceptions-beperking in de gids (T13-M2); drie T13-nits: T3-ontmaskeringszin terug in de attributie-alinea, 5×/18-rekensom in het klem-commentaar, TODO-rubriek van het P6-item. Drie T15-eindnits: ná-band-uitkomst van snapActualForward in het docblok uitspreken (instant ná de laatste band blijft rauw — ongetoetste maar conservatieve extrapolatie); IFC-round-trip (ifcPsets MilestoneKind) toevoegen als ontsnappingsroute bij het latente succIsFinishMs-gat; de pre-existente rauwe-ISO-statusdatumvergelijking in setActualStart/setActualFinish (uur-precieze actual op de statusdatum-dag wordt stil geweigerd — echte UI-bug, zelfde familie als projectStartAnchorClamp:82) als TODO-regel.

**T16-deel-a — veeglijst verwerkt (uitvoerder, 2026-08-17).** Alle negen punten afgehandeld, logische deelcommits (`npm run verify` groen ná elke stap):

1. **MAX_DAY_HOUR_PERIODS-rekenfout — gefixt (was 10, nu 5).** Zelfde start/duur-array-overlapanalyse als de eerdere `MAX_EXCEPTION_BAND_PERIODS`-fix: de oude toelichting analyseerde alleen de duur-array-capaciteit en negeerde dat de start-array (2-byte-stride vanaf `+8`) al bij `i=6` botst met duur-slot 0 (op `+20`) — exact hetzelfde omslagpunt (`i>=6`) als het 92-byte-uitzonderingsblok. Nieuwe mutatiebewezen case in `check-mpp-calendars.ts` (periodCount=7-claim, handmatig gepatchte duur-slot-6-byte materialiseert een fantoomband zónder de klem); reviewer-repro daadwerkelijk gedraaid (10 terug → 6 banden i.p.v. 5, hersteld → weer 5).
2. **Dode isHoliday-API/workingExceptionSet — BLEEK NIET MEER DOOD.** Beoordeling: `isHoliday` en `workingExceptionSet` zijn sinds commit `c2f7b5c3` (T13d, workingExceptions-afnemers) daadwerkelijk in gebruik — `printPreview.ts` roept `calEngine.isHoliday(dateStr)` aan voor de holiday-vs-weekend-arcering. De LAAG-5-bevinding uit de T2-her-herziening dateert van vóór die fix. Geen code-actie nodig; hier geregistreerd zodat een toekomstige lezer niet nog eens naar een spookprobleem zoekt.
3. **computeStandardWorkdayBands-vs-hoursPerDay-spanning — gedocumenteerd (doc-only).** Beide functies se docblocks in `CalendarEngine.ts` spreken nu expliciet uit dat ze een andere weekdag als "modaal" kunnen aanwijzen op een zelf-tegenstrijdige kalender (workDays vs. workTime.byWeekday niet in overeenstemming) — een vorm die geen enkele lezer produceert, dus bewust geen gedragswijziging.
4. **Gids bijgewerkt (nl+en, `verify:docs` groen, 29×14).** "Tot op de minuut"-claim aangescherpt (twee eerlijke uitzonderingscategorieën i.p.v. "lopende etappe"); de recurrente-feestdagen-claim bleek zelf STALE (T3/T4 lossen dat juist op deze etappe) en is herschreven — alleen werkweken blijft een bekende beperking; nieuwe sectie "Voortgang: MS Project se eigen hervattingsconventie" (resumeFromActualElapsed in gebruikerstaal); twee technische kanttekeningen in de Im-/export-gids (P6-workingexceptions-verlies, date-only-anker+elapsed+uurmodus).
5. **Drie T13-nits.** T3-ontmaskeringszin hersteld in de "Attributie, definitief"-alinea (T3's kalenderexpansie voor W14 After Para 26 stond al vast als correct, de latere verslechtering was ontmaskering, geen T3-regressie). 5×/18-rekensom gecorrigeerd: de check draait 6× per `npm run verify` (1× normaal + 5× tijdzone-matrix), dus 6×3=18 — de "5×" was de fout, niet de "18". P6-TODO-item verhuisd naar een nieuwe, passende rubriek in `docs/TODO.md`.
6. **Drie T15-eindnits.** `snapActualForward`'s ná-band-uitkomst nu expliciet uitgesproken in het docblok. `relationMath.ts`'s succIsFinishMs-gat-commentaar kreeg de IFC-round-trip (ifcPsets MilestoneKind) als concrete, vandaag al reikbare ontsnappingsroute erbij. De rauwe-ISO-statusdatumvergelijking in setActualStart/setActualFinish is — binnen de door het plan toegestane ruimte — GEFIXT (niet alleen als TODO genoteerd): nieuwe gedeelde helper `isActualPastStatusDate` vergelijkt geparste instanten (dag-vergelijking bij een datumloze statusDate, volle instant-precisie als statusDate zelf een tijd draagt). Store-cases in `check-task-slice.ts`, mutatiebewijs daadwerkelijk gedraaid (helper terug naar rauwe stringvergelijking → 4/16 checks rood; hersteld → 16/16 groen).
7. **Twee T9-restjes.** Case-id `prog-T9-remaining-nul-natuurlijke-finish` hernoemd naar `prog-T9-remaining-nul-hervattingspunt-onaangeroerd` (in `cases-progress.json`, `CPMSolver.ts`, dit document). De theoretische fractionele-remaining-kier (extMappers.ts se `fromExtTaskTimePatch`, extensie-API-only) becommentarieerd, niet dichtgetimmerd: MCP sluit dit pad al af (`PROGRESS_REJECT_HINTS`), een consistentiecheck in de extensie-mapper zou legitiem gebruik net zo goed blokkeren als het misbruikgeval.
8. **`docs/TODO.md` bijgewerkt.** Het stale "recurrente kalenderuitzonderingen materialiseren"-item afgevinkt (T3/T4 losten dit al op). Nieuwe sectie "MPP/MSP-import — bekende beperkingen": P6-item hierheen verhuisd (verkeerde rubriek) en afgevinkt (gidsvermelding nu compleet); twee nieuwe items — de contouring-detectiegrens (T12) en de TASK_MODE-hypothese als vervolgwerk (T15-dossier (c)5).
9. **MPXJ-attributie aangevuld.** Twee echte gaten: `calendarRecurrence.ts` (expliciete "poort van drie MPXJ-bronnen" zonder de copyright-regel zelf) en `mppGroundTruth.ts` (test-only, maar een eigen tweede poort van MPP-veldkennis). Overige gecontroleerde bestanden (`duration.ts`, `mspdiReader.ts`/`mspdiWriter.ts`, `p6xmlWriter.ts`, de bestaande mpp/*-bestanden) volgden al het juiste patroon — vol koptekst voor het ongedocumenteerde MPP-binair-formaat, gerichte inline-citaten voor de publieke MSPDI-/P6-XML-schema's.

**Poorten (T16-deel-a):** `npm run verify` exit 0 (incl. `verify:docs`/`verify:i18n`); alle gedragsfixes (punten 1 en 6) met mutatiebewijs daadwerkelijk gedraaid, niet alleen beschreven; documentatie-only punten (2, 3, 4, 5, 7-deel-2, 8, 9) zonder mutatie zoals de opdracht toestaat. Negen deelcommits, Nederlands, `Co-Authored-By: Claude Fable 5`.

**Eindstand in goal-eenheden (LOW, eindreview T16c, gemeten na de B1-fix hierboven — `mpp-fidelity-baseline.json`, 216 gepinde bestanden / 3413 taken).** De goal-tekst (§1) eist minuut-exacte start-/einddatums voor het volledige corpus, met als enige toegestane uitzondering aantoonbaar gesplitste/resource-genivelleerde taken. Gemeten eindstand:

| meting | waarde |
|---|---|
| bestanden 100% exact (0 afwijkingen) | **196/216** (90,7%) |
| bestanden met ≥1 afwijking | 20/216 — allemaal (c)-geregistreerd met `reason` (LOW, hierboven) of §1.4/O1-uitzondering |
| taken, startdatum exact | 3341/3413 = **97,9%** |
| taken, einddatum exact | 3285/3413 = **96,2%** |
| totaal aantal afwijkingen (startDiff+finishDiff, som over alle bestanden) | **193** |

Ter vergelijking, de uitgangspositie vóór deze hele etappe (§1.1, gepind op `97368f7d`): start 90,7% exact, finish 86,1% exact, 483 afwijkende taken over 74 bestanden. Categorie (c) (§T15's uitgangscriterium: "leeg, of expliciet door de eigenaar geaccordeerd") bevat na deze fixronde nog 6 posten zonder (volledige) melding (§H1/H2), 13 als toegestane resource-gedreven-uitzondering (§1.4/O1, elk met een `reason`-verwijzing in de baseline), en 1 apart, geregistreerd-maar-niet-gefixt bugdossier — `3bedc77e9a2ac3f6` (`OzBuild Workshop 14 End Para 29.mpp`), dossier T16c-M1 (kruis-kalender-FS-asymmetrie, zie hierboven): dat bestand hoort NIET bij de toegestane resource-gedreven-uitzondering, het is een genuine, onderzochte en bewust niet-gefixte solver-bug — geen enkele post staat er zonder geschreven, gemeten reden.

---

## 3. Parallelliseringsschema

```
                    T1 (baan M — harnas)      ← eerst, iedereen meet hierop
                             │
        ┌────────────────────┼────────────────────┬─────────────────────┐
     BAAN K                BAAN S              BAAN L                (T9 wacht)
   T2 → T3 → T4          T6 ─┐  T7 ─┐        T10 ─┐  T11 ─┐
        └→ T5             T8 ─┘     │        T12 ─┘       │
                                    ▼                     ▼
                    ══════════ SYNC: T13 integratie + hermeting ══════════
                                    │
                                T14 gebruikstest (aparte agent, browser)
                                    │
                            T9 (voortgang, meet-eerst) → T15 residu → T16
```

**Strikt disjuncte bestandslijsten per baan** (één taak tegelijk per baan; `run.sh` wordt door precies één taak aangeraakt: T1):

| baan | exclusief eigendom |
|---|---|
| M | `tests/planning/mppFidelity.ts`, `mppGroundTruth.ts`, `check-mpp-fidelity.ts`, `mpp-fidelity-baseline.json`, `tests/planning/run.sh` |
| K | `src/types/calendar.ts`, `src/engine/scheduler/CalendarEngine.ts`, `src/services/mpp/mppCalendars.ts`, `src/services/mpp/limits.ts`, `src/services/msproject/mspdiReader.ts`, `src/services/ifc/ifcWriter.ts`, `src/services/ifc/ifcReader.ts`, `tests/planning/check-mpp-calendars.ts`, `check-calendar-hours.ts`, `check-adapters-hours.ts`, `check-ifc-roundtrip.ts`, `cases-kalenders.json` |
| S | `src/engine/scheduler/CPMSolver.ts`, `relationMath.ts`, `applyCpmResult.ts`, `duration.ts`, `solveProject.ts` (alleen commentaar), `tests/planning/cases-msp-pariteit.json` (nieuw), `cases-milestones.json`, `cases-milestone-kinds.json`, `cases-driving.json`, `cases-move-project.json`, `cases-progress.json` |
| L | `src/services/mpp/mppReader.ts`, `src/services/mpp/fieldMap14.ts`, `src/services/importTypes.ts`, `src/state/slices/fileSlice.ts`, `src/i18n/locales/**`, `public/docs/**`, `tests/planning/check-mpp-import.ts`, `check-notifications.ts` |

**Twee bekende raakvlakken, expliciet geregeld.** (1) `mspdiReader.ts` hoort bij K; T11 (baan L) wacht daarop of draagt zijn MSPDI-helft over aan T4. (2) `limits.ts` hoort bij K; heeft baan L een klem nodig, dan komt die tijdelijk lokaal in `mppReader.ts` en verhuist bij T13.

---

## 4. Modeltoewijzing

| rol | model | waarom |
|---|---|---|
| implementers (alle T-taken) | **Sonnet** | uitvoerend werk met scherpe specificatie en harde poorten |
| kwaliteitsreviews T1, T2, T3, T6, T7 + eindreview T16 | **Opus** | de taken met de grootste blast radius: harnas, engine-lus, byte-parsing, relatie-wiskunde |
| mechanische spec-reviews (T4, T5, T8, T9, T10, T11, T12) | **Sonnet** | contract-/volledigheidscontrole tegen dit plan |
| gebruikstest T14 | **Sonnet** (aparte agent, browser) | scenario-uitvoering |
| **nooit** | **Fable** | — |

---

## 5. Het gedeelde meetscript

**Eén artefact, twee levens** (details in T1):

**(a) Tijdens de etappe** — `bash tests/planning/run.sh check-mpp-fidelity` of direct de gebundelde check met `OPS_MPP_FIDELITY_REPORT=detail`. Implementers draaien dit vóór en ná elke wijziging en zetten de voor→na-cijfers in het commitbericht; reviewers draaien exact hetzelfde commando — geen privé-harnas meer, geen gepinde code-snapshot. Het meet tegen de **live worktree** via `readMPP` + `solveProject`.

**(b) Als regressietest** — dezelfde module, default-modus, geregistreerd in `run.sh` binnen `RUN_HOLIDAYS`, dus ook in de tijdzone-matrix (gemeten: < 1 s per volledige corpusronde). Assertievorm:

```
per corpusbestand, met === (geen <=, geen som):
  tasks, startExact, startSameday, startDiff, finishExact, finishSameday, finishDiff
globaal:
  aantal gepinde bestanden dat gezien is === pinned.length
  de VERZAMELING bestanden met ≥1 afwijking === de gepinde verzameling   ← vangt een nieuw
                                                                            afwijkend bestand,
                                                                            ook als een ander
                                                                            tegelijk verbetert
```

Géén somtotalen per bestand: een compensatie (start beter, finish slechter) moet rood worden. Ontbreekt het corpus, dan één OK-skipregel per wortel en exit 0 — nooit invloed op het eindoordeel van de suite (conventie C3 uit `check-mpp-import.ts`).

**Het scratchpad-harnas wordt niet gemigreerd maar heríngericht.** Overneembaar: `rawScan` (→ `mppGroundTruth.ts`), `classify`/`dayDelta`, de attribuut-emmers, het `detail`-formaat, de `spanEq/spanGt/spanLt`-meting (wordt T12's detector). Bewust **niet** overnemen: het `snap/`-mechanisme en `build.sh` (die pinnen juist op oude code — precies wat we niet willen), de `NO_PSD`-env-schakelaar (was een eenmalige causaliteitstest) en de `whatif`-modus (heeft zijn werk gedaan; de causaliteit staat nu in dit plan).

---

## 6. Baselinebeleid en privacy

**Waar de pins leven: in de repo**, als `tests/planning/mpp-fidelity-baseline.json`. **Sleutel = SHA-256 van de bestandsbytes (eerste 16 hex-tekens), niet de bestandsnaam.**

Argumentatie:
- **Corpusinhoud komt nooit in de repo** — een baseline bevat alleen tellingen, geen taaknamen, geen datums, geen structuur.
- **Bestandsnamen kunnen gevoelig zijn** ("Bijlage 13 …", "Productie planning"). Content-hash-sleutels lekken niets. Voor bestanden onder de crawl-wortel (publieke MPXJ-junit-data en OzBuild-workshopmateriaal — geen bedrijfsdata) mag een leesbaar `label` mee voor de diagnose; voor bestanden onder `OPS_MPP_CORPUS` blijft dat veld leeg. **Precedent, wel opmerken:** de drie bedrijfsbestandsnamen staan al letterlijk in `tests/planning/check-mpp-import.ts` (`EXPECTED_TASK_COUNTS`) — dit plan breidt die blootstelling níét uit (zie §9/O4).
- **Content-adressering is bovendien functioneel beter:** wordt een corpusbestand in MS Project bewerkt, dan verandert de hash en meldt de check "ongepind bestand", in plaats van stilletjes een verkeerde pin toe te passen.
- **Een externe map is géén betere plek:** een baseline náást het corpus is niet versiebeheerd en niet reviewbaar — dan verliest de "herhaalbare regressietest" precies zijn waarde. (De meting zelf draait sowieso alleen lokaal/pre-push, niet in CI: `OPS_MPP_CORPUS`/`OPS_MPP_CRAWL` bestaan niet in CI, dus daar slaat de hele corpus-/crawl-lus over — zie de LOW-registratie bovenaan `check-mpp-fidelity.ts`. Dat is een gegeven van de dataset zelf, geen argument vóór of tegen de bestandslocatie van de baseline.) De privacyreden vervalt zodra de sleutels gehasht zijn.

Herpinnen gaat altijd via `OPS_MPP_FIDELITY_REPORT=baseline` → uitvoer met de hand in het bestand plakken → commitbericht vermeldt welke taak welke tellers waarom verandert. De check schrijft nooit zelf.

---

## 7. Hardening-checklist — kopieer dit blok ONGEWIJZIGD in élke implementer-prompt

- [ ] **Geen allocaties of lussen uit ongevalideerde bestandswaarden.** Elke telling/lengte/offset uit het bestand wordt geklemd vóór gebruik; de klem staat in `src/services/mpp/limits.ts` met een **meetcommentaar** erbij (wat is de gemeten corpuswaarde, waarom is deze bovengrens ruim, en wat kost het ergste geval zonder klem).
- [ ] **Strings gechunkt en begrensd.** Geen `String.fromCharCode(...bigArray)`; hergebruik het bestaande gechunkte pad in `mppPrimitives.getUnicodeString` en `MAX_VAR_TEXT_BYTES`.
- [ ] **Geen module-level muteerbare singletons.** Caches horen aan een instantie of aan een expliciet meegegeven context (patroon: de `HolidayBudget`-factory in `mppCalendars.ts`). Een module-scope `Map` die tussen documenten blijft leven is een bug, geen optimalisatie.
- [ ] **Elke nieuwe `try`/`catch`-wrapper krijgt een eigen rode-pad-fixture** die aantoonbaar door die `catch` gaat — een `catch` zonder test is een stille faalmodus.
- [ ] **Fixtures schrijf je nooit naar de implementatie toe.** Bouw de verwachting uit de specificatie/de MPXJ-bron/de MS Project-uitvoer, niet uit wat de code nu toevallig oplevert. Moet een bestaande verwachting wijzigen, dan is dát het te motiveren feit.
- [ ] **Testcommentaren claimen alleen wat mutatie-bewezen is.** Schrijf je "vangt X", dan heb je X daadwerkelijk gemuteerd en de test rood gezien. Anders formuleer je het zwakker.
- [ ] **Binaire testdata nooit door `TextEncoder`.** Bouw `Uint8Array`/`DataView` direct; `TextEncoder` maakt van elke byte ≥ 0x80 stil twee bytes.
- [ ] **Exitcode is de poort, nooit de tail-uitvoer.** De planningssuite print "alles groen" ook bij exit 1 als het bundelen faalt.
- [ ] **Byte-identiek waar niets zou mogen wijzigen.** Een nieuw optioneel veld dat afwezig is ⇒ exact hetzelfde gedrag als daarvoor; bewijs dat met de bestaande 455 cases zónder aangepaste verwachtingen.
- [ ] **Nooit de corpusbestanden of hun inhoud committen** (bedrijfsdata/licentie). Ook geen fragmenten in commitberichten, testcommentaren of foutmeldingen.

---

## 8. Openstaande vragen van de architect

O1 (breedte van de toegestane uitzondering), O2 (projectstart-regel dekt 14/25 niet), O3 (persistent taakveld?), O4 (baselinebeleid/hashes), O5 (werkweken-probe → T3b?), O6 (mijlpaalconventie engine-breed?), O7 (MPP_LEGACY = overgeslagen?). Beantwoord in §9.

## 9. Orkestratorbesluiten op §8 (2026-08-15)

- **O1 — uitzondering verbreed naar "resource-gedreven planning".** De goal-formulering "gesplitst of resource-genivelleerd" wordt gelezen als de familie *resource-gedreven planningsafwijkingen*: nivellering, leveling delay én resource-contouring/timephased werk. De melding en de gids benoemen alle drie. **Mijlpaal-met-duur is géén uitzondering maar een solver-bug** — kleine extra fix in baan S (onder T6 of als mini-taak in T15), met eigen case + mutatiebewijs.
- **O2 — de brede regel.** T7 implementeert "een ingelezen anker wordt nooit door de vloer overruled" (de vloer versmalt tot ondergrens tegen relatie-leads), want de goal eist minuut-exactheid óók voor de 14 constraint-loze taken. De bestaande cases zijn de wacht: breekt er één, dan escaleert de implementer naar de orkestrator met de meting — die beslist dan of de eigenaar gevraagd moet worden. Het oorspronkelijke vloer-scenario wordt door de implementer teruggezocht (verplichte stap 1 van T7) en gedocumenteerd in de commit.
  **O2-vervolgbesluit (escalatie 2026-08-15, optie B van de architect):** de zes cases-edge.json-cases pinden precies het gebruikstest-scenario (verouderd anker na Projectinfo-startdatumwijziging). Besloten: de solver-diff blijft (MSP-getrouw), en de gebruikersbescherming verhuist naar het bewerkmoment — **T7b**: `projectSlice.updateProject` klemt bij een láter gezette startdatum de te-vroege wortel-ankers (constraint-loos, voorganger-loos) binnen de transactie (undo-baar) en meldt dit via K8a met `{{count}}` (14 talen). Geïmporteerde bestanden raken dit pad niet (loadState loopt niet door updateProject) — importgetrouwheid en bewerkbescherming zijn zo gescheiden. De zes cases verhuizen naar `tests/planning/check-project-start-anchor.ts` (store-niveau); `cases-edge.json` + die nieuwe check zijn hiermee expliciet T7b-eigendom. "Alles verschuiven" blijft het domein van Project verplaatsen.
- **O3 — geen persistent taakveld.** Melding alleen bij openen (patroon `summaryRelationsDropped`), geen documentcontract-impact. Persistente herkomstmarkering hoort bij de latere splits-etappe.
- **O4 — hash-gesleutelde pins in de repo, akkoord.** Leesbare labels alleen voor crawl-bestanden (publiek materiaal); bedrijfsbestanden hash-only. De drie bestaande bedrijfsbestandsnamen in `check-mpp-import.ts` blijven in deze etappe staan (precedent niet uitbreiden, wel aan de eigenaar gemeld als optioneel op te schonen).
- **O5 — T3b vooraf goedgekeurd** mits de probe > 0 relevante bestanden meet én werkweken aantoonbaar afwijkingen verklaren; anders gidsvermelding als bekende beperking.
- **O6 — mijlpaalconventie engine-breed, akkoord.** MS Project-semantiek is de gekozen norm (zelfde eigenaarslijn als de verzamelrelatie-verzoening) en P6 hanteert dezelfde conventie. Het is een gedragswijziging in uurmodus voor bestaande gebruikers; wordt vermeld in de gids en te zijner tijd in de releasetekst.
- **O7 — bevestigd:** `MPP_LEGACY`-weigeringen tellen als "overgeslagen", nooit als fout. De goal gaat over wat geïmporteerd wórdt.

**Nagekomen orkestratorbesluiten (M4, eindreview T16c) — twee UNIVERSELE gedragswijzigingen buiten `.mpp`.** Anders dan `resumeFromActualElapsed` (T9) en `unstartedIgnoresStatusDate` (B1), die allebei bewust opt-in en uitsluitend `.mpp`-geïmporteerd zijn (§9/O2, hierboven), landden tijdens T15 twee fixes ONVOORWAARDELIJK in `CPMSolver.ts` — ze raken élke taak, ongeacht bronformaat (P6, MSPDI, CSV, IFC, of handmatig aangemaakt). Beide zijn tijdens de uitvoering al toegepast (zie T15-iteratie 1 en dossier (c)1 hierboven); hier alsnog expliciet als besluit vastgelegd, zodat de reikwijdte-keuze — universeel toepassen, geen format-scoping — een geadministreerd feit is:
- **O8 — mijlpaal-met-duur universeel, akkoord.** `isZeroDurationMilestone(task)` (`isMilestone && scheduleDuration===0`) verving elke kale `isMilestone`-check die de duur naar 0 liet collapsen. Een taak met `isMilestone=true` ÉN een reële duur wordt sindsdien overal — ook bij een handmatig aangemaakt project, en ongeacht bronformaat — volgens haar eigen duur gepland (MSP-semantiek), niet meer als 0-duur-mijlpaal behandeld. Motivatie voor UNIVERSEEL (i.p.v. een `.mpp`-scoped vlag zoals T9/B1): dit is geen alternatieve reken-CONVENTIE die per bronformaat verschilt (zoals de RETAINED_LOGIC-varianten) — het is een correctie op wat "mijlpaal" zelf betekent (een taak met `isMilestone=true` én een reële duur is voor de PLANNING gewoonweg geen 0-duur-taak, ongeacht waar de data vandaan komt); scopen achter een vlag zou hetzelfde taakobject een ANDER antwoord geven al naargelang de importroute, wat voor deze klasse van fout geen zinvol onderscheid is. Gedragswijziging voor bestaande gebruikers met zulke taken; vermeld in de gids sinds de eindredactieronde (T16-veeglijst-punt "documentatie-correctieronde"): [Plannen & WBS](docs://gids-plannen-wbs) en [Relaties & constraints](docs://gids-relaties-constraints) nuanceren nu allebei "een mijlpaal heeft duur 0", en [MS Project-import](docs://gids-msproject-import) (die de mijlpaal-instantconventie voor eindmijlpalen al benoemde) heeft er een eigen alinea over de mijlpaal-met-duur bij gekregen — en te zijner tijd in de releasetekst, net als O6.
- **O9 — voltooide-taak-pin zonder statusdatum universeel, akkoord.** De VOLTOOID-tak in `CPMSolver.ts`'s voortgangsverwerking (`t.actualFinish && t.completion >= 1` ⇒ ES/EF gepind op de eigen actuals) stond oorspronkelijk achter een `dataDate &&`-poort — een voltooide taak in een project ZONDER statusdatum kreeg dus geen actuals-pin en kon voorbij haar eigen `actualFinish` doordrijven via de gewone forward-pass. De poort bleek kunstmatig (H1/c2, later M1 voor de IN-PROGRESS-tegenhanger): een taak die aantoonbaar voltooid is, hoort nooit voorbij haar eigen `actualFinish` te plannen, met of zonder statusdatum — de statusdatum is een project-brede "as-of"-marker, geen voorwaarde voor of individuele taakvoortgang serieus genomen wordt. Universeel toegepast (geen vlag): dezelfde redenering als O8 — dit is een correctheidscorrectie op wat "voltooid" betekent, geen alternatieve conventie die per bronformaat hoort te verschillen. Bekende rand (niet binnen deze fixronde uitgezocht): negatieve float op een harde late-constraint die door de gepinde actuals overschreden wordt — zie N1 hieronder.
