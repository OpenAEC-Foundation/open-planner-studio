# Nakijken import/export-audit — rapport A en rapport B tegen de sleutel (basis 8e3bcf4c)

Werkmap: `/home/user/audit/w3` (schone momentopname 8e3bcf4c). Alles van mij staat in
`nakijken/eigen/`; `git status` in w3 toont alleen `?? nakijken/`.

## Hoe ik de reproducties heb gedraaid

Beide `run.sh`-scripts nemen aan dat ze in `<ROOT>/audit-repro/` staan en leiden ROOT af uit hun eigen
pad; in w3 staan ze onder `nakijken/rapport-X/`, dus dat klopt niet. Aanpassingen (alleen kopieën):

- `nakijken/eigen/runA.sh`: kopie van `rapport-A/run.sh` met `ROOT=/home/user/audit/w3` en uitvoer in
  `nakijken/eigen/A/out/`. Scripts gekopieerd naar `nakijken/eigen/A/`. In `readonly-overwrite.ts` het
  doelpad `audit-repro/out/…` vervangen door `nakijken/eigen/A/out/…`.
- `nakijken/eigen/runB.sh` + `nakijken/eigen/B/build.mjs`: kopie van `rapport-B/run.sh`/`build.mjs` met
  vaste ROOT. Scripts gekopieerd naar `nakijken/eigen/B/`; daarin de relatieve imports
  `'../tests/planning/xmldom-shim'` en `'../tests/planning/mppFixtures'` met `sed` vervangen door het
  absolute pad `/home/user/audit/w3/tests/planning/…`. Verder niets gewijzigd.
- Alle scripts van beide rapporten zijn gedraaid (A: 24 scripts, B: alle 53 `.ts` behalve `xergen.ts`,
  `rt2.ts`, `diff2.ts` en `count.mjs`, die alleen hulp/varianten zijn); uitvoer staat in
  `nakijken/eigen/A/out/*.txt` en `nakijken/eigen/B/out/*.txt`. Zware scripts met kleinere
  parameters waar het rapport dat toestond (`pdf2 1000`, `mppfuzz 2000`, `ifcfuzz 300`).
- Eigen probe: `nakijken/eigen/probes/g11-writer-encoding.ts` (G11: de writer schrijft
  `#42=IFCTASKTIME('C:\temp é ''t 中 …` rauw — niet-ASCII, backslash en een regeleinde in de STEP-string).
- Van de scripts die een G-match of een hoog/kritiek-oordeel dragen heb ik de opzet gelezen: ze roepen
  de echte lezers/schrijvers aan (`readCSV`/`writeCSV`, `readIFC`/`writeIFC`, `readMSPDI`, `readP6XML`),
  geen mocks. De XML-lezers draaien op een DOM-shim (A: eigen `xmlshim.ts`; B: `tests/planning/xmldom-shim.ts`).

Beslisregels die ik heb gehanteerd (staan hier zodat de telling reproduceerbaar is):

1. **Gebundelde bevindingen.** De sleutel zegt "hoogstens één G per bevinding"; de opdracht staat meer
   toe "als het mechanisme echt hetzelfde is". B#07 (G5 + G10) en B#08 (G13 + G16) bundelen twee
   verschillende mechanismen, maar elk deel staat met eigen locatie, eigen mechanisme én eigen gedraaide
   reproductie in de rij. Ik tel beide als GEVONDEN met de vlag *gebundeld* en geef in de telling ook de
   strikte variant (−2 voor B). B#03 (G11 + G12) is door de sleutel expliciet toegestaan.
2. **Zelfde regel, ander gebrek.** A#20/B#04 (`ifcReader.ts:1330`), A#30 (`importDates.ts:145`) en
   B#26 (`csvDateOrToday`) raken precies de regels die de sleutel voor G8 noemt, maar melden een
   ander gebrek ("stille vandaag-terugval", "onbekend datumformaat"), niet "UTC-dag i.p.v. lokale dag".
   Dat is GEMIST voor G8, identiek behandeld voor A en B; de bevindingen zelf staan in deel 2.
3. **Schemaconformiteit IFC.** In de werkmap staat geen IFC4/4X3-EXPRESS (alleen weblinks in
   `docs/superpowers/specs/`). Het *gedrag* (writer schrijft 15/8/9 attributen; lezer leest een
   14-/9-attribuut-entiteit uit de verkeerde slots) is met de scripts bevestigd; de *conformiteitsclaim*
   is hier niet te toetsen. Ze komt wel overeen met mijn eigen kennis van IFC4 (IfcWorkControl
   13 + PredefinedType = 14; IfcWorkCalendar 9; IfcConstructionResource 11), en beide rapporten komen er
   onafhankelijk op uit — zwakke steun, geen bewijs.
4. **Telling van hybride rijen.** Een rij waarvan het aangetoonde deel (gedrag of code) klopt en alleen een
   bijkomende claim niet toetsbaar is, telt als BEVESTIGD; de nuance staat in de rij. Het niet-G-deel van
   een gebundelde sleutelmatch (B#01 zonder G14, B#28 zonder G2) telt als eigen overige bevinding.

## 1. Sleuteltabel

Legenda: **G** = gevonden (locatie + mechanisme + door mij gedraaide repro), **G-zr** = gevonden zonder
repro (correcte redenering, label "afgeleid"), **D** = deels, **M** = gemist.

| G-id | cat. | rapport A | rapport B | toelichting |
|---|---|---|---|---|
| G1 | dataverlies | **G** — #25 | **G** — #24 | Beide: `readCSV` splitst op regeleinden vóór het quote-parsen, `csvReader.ts:217`. A: `csv-multiline-roundtrip` (41 → 42 taken, fantoomtaak "Task", omschrijving afgekapt). B: `csv1` T1 (2 → 4 taken). |
| G2 | correctheid | **M** | **G** — #28 | B: "een aanhalingsteken midden in een ongequote cel zet de citeermodus aan en slokt de rest van de regel op", `csvReader.ts:52-77`; `csv1` T5b geeft naam `Pijp 6 staal;3;2026-03-02;2026-03-04`. A noemt dit mechanisme nergens (alleen het regeleinde van G1). B#28 bevat daarnaast CR-only en tab; die delen staan in deel 2. |
| G3 | dataverlies | **M** | **M** | Geen van beide noemt het ongeëscapete taaktypeveld in `writeCSV`. B#38 gaat over `escapeCSV` (formule-injectie), niet over het taaktype. |
| G4 | correctheid | **M** | **M** | `parseFloat` op de vastgelegde speling: door niemand genoemd. |
| G5 | dataverlies | **M** | **G** — #07 (gebundeld) | B: `ifcStr('')` schrijft `$`, `stripQuotes('$')` geeft `$` terug, terugval "Naamloze taak" grijpt niet; `ifcReader.ts:919-924`, `:1348`; `ifc3` deel A: `"" -> "$"` voor taak én resource. A's `ifc-strings-roundtrip` test geen lege naam. |
| G6 | correctheid | **M** | **G** — #13 | B: `getElementsByTagName('WeekDay')` vindt ook de `WeekDay`s in `<WorkWeeks><WorkWeek><WeekDays>`, die voldoen aan de ouder-check; `mspdiReader.ts:915-935`; `mspdi2` B: `[1..7]` i.p.v. `[1..5]`. A#32/#10 gaan over de writerkant (band 07–16), niet over WorkWeeks. |
| G7 | correctheid | **G** — #22 | **G** — #33a | Beide: `parseInstant` rekent een offset om naar UTC terwijl het model wandklok rekent; `importDates.ts:29-32`, `:40-46`. A: `tz-offset` (08:00+01:00 → 07:00; 00:30+02:00 → vorige dag; ook IFC-taak). B: `dt1` (00:30+01:00 → 23:30 vorige dag; statusdatum idem). Beide melden terecht dat de TZ van de machine er niet toe doet. |
| G8 | correctheid | **M** | **M** | Zie beslisregel 2. A#22 concludeert zelfs "de datum-helpers zijn consequent UTC; alleen `localTodayIso` is lokaal" — dat is precies het gebrek (de vandaag-terugval hoort lokaal te zijn), als niet-bevinding opgeschreven. |
| G9 | correctheid | **M** | **M** | Print/PDF-vandaaglijn: A heeft print niet gedraaid; B alleen het vectorpad (#36), niet de vandaaglijn. |
| G10 | dataverlies | **G** — #23 | **G** — #07 (gebundeld) | Beide: `parseSTEP` doet `.replace(/\r\n/g,'\n')` over de hele datasectie, ook binnen strings, `ifcReader.ts:860`. A: `ifc-strings-roundtrip` (`ANDERS "Regel1\r\nRegel2"`). B: `ifc1` E3 (`"régel\r\nTwee" -> "régel\nTwee"`). |
| G11 | compatibiliteit | **G-zr** — #16 | **G** — #03 | A: `ifcStr` verdubbelt alleen `'`; ruwe backslash/UTF-8 buiten de STEP-tekenset; label "afgeleid", eigen script toont alleen dat de eigen round-trip gelijk blijft. Regelnummer `ifcPsets.ts:127-130` is onjuist (functie staat op :113-116), functie wél genoemd. B: `ifcPsets.ts:113-116`, `ifc1` E3b: "bevat non-ASCII: true; rauwe backslash: true". Mijn probe bevestigt de rauwe regel. |
| G12 | compatibiliteit | **G** — #15 | **G** — #03 | Beide: `stripQuotes` zet alleen `''` terug, geen `\X2\`/`\S\`/`\\`-decodering, `ifcReader.ts:919-924`. A: `ifc-foreign-conformant` (`Caf\X2\00E9\X0\ De Kroon`, `stra\S\_e`). B: `ifc1` E1. Eén B-bevinding voor beide kanten, expliciet toegestaan door de sleutel. |
| G13 | compatibiliteit | **G** — #19 | **G** — #08 (gebundeld) | A: `ifcGuid` kiest vrij uit 64 tekens, eerste teken buiten 0–3; script telt 268/282 (rapport: 270). Label "afgeleid" omdat A de 0–3-regel uit het hoofd had; het gedrag is gemeten, dus dit telt. B: 32-bit hash, 93,7 % eerste teken > '3', 12 botsingen op 300k seeds (`guid1`). |
| G14 | compatibiliteit | **M** | **G** — #01 | B: "taak- en project-GlobalId worden `ifcGuid('task-ifc-<oude guid>')`", `ifcWriter.ts:36-47`; `foreign1`: `3YvctVUKr0kugbFTf53O9L -> fZzt_BOvelO9Hzd$XJMfQr`, project idem. B#01 bundelt dit met het verlies van niet-planningsinhoud (deel 2). A schrijft onder "onderzocht zonder bevinding": "`guidOf` lost GlobalId-botsingen op — geen bevinding". |
| G15 | compatibiliteit | **M** | **M** | Werkplan/werkschema-GlobalId door niemand genoemd. |
| G16 | compatibiliteit | **M** | **G** — #08 (gebundeld) | B: "relaties, resources en één kalender krijgen bij inlezen een nieuw willekeurig id en dus bij opslaan een nieuwe GlobalId", `ifcReader.ts:1580`; `idem1` op het showcase-bestand: 0/260 IfcRelSequence- en 0/7 IfcLaborResource-GlobalIds behouden, 499 regels anders per cyclus, 1 van 2 kalenders. Precies het G16-mechanisme. |
| G17 | correctheid | **M** | **M** | `guidOf`-cache op het kale id: niemand. B#08 noemt alleen hash-botsingen met `#dup`-suffix (= G13). |
| G18 | compatibiliteit | **M** | **M** | Vaste seeds tussen projecten: niemand. |
| G19 | correctheid | **M** | **M** | Uniciteit van id's bij openen: niemand (A meldt juist dat `stableIfcTaskId` ontdubbelt — dat gaat alleen over IFC-taken). |
| G20 | correctheid | **G** — #28 | **M** | A: `Math.min(...levels)` in `outlineParents`, `importNormalize.ts:126`; `csv-large-outline`: 50k ok, 130k/300k `RangeError`. B#34 (recursie in `wbs.ts`) is een ander mechanisme en niet de importplek. |
| G21 | performance | **G** — #24 | **M** | A: `opsCalendarPsetProps` scant per kalender en per psetlezer alle entiteiten en parset elke `IFCRELDEFINESBYPROPERTIES` opnieuw, `ifcReader.ts:2044-2060`, aanroepen :2072…:2268; `perf-ifc-calendars`: 2000 taken 10 → 400 kalenders 173 → 2002 ms. B#31 noemt `ifcReader.ts:1884` (`childIds.includes`), niet de kalender-psets. |
| G22 | performance | **M** | **G** — #30 | B: `tasks.find` per taak en `childIds.includes` per kind in `rebuildWbsHierarchy`, `importNormalize.ts:107-108`; `perf2`: platte WBS 20k → 40k taken 1,3 → 4,7 s (boom: 1,5 → 7,9 s). A#31 gaat over `p6xmlReader`, A#14 over `mspdiWriter`. |
| G23 | performance | **M** | **M** | `buildPrintRows`: niemand. |

## 2. Overige bevindingen

Oordelen: **BEVESTIGD** (zelf gereproduceerd en/of in de code nagegaan), **DEELS**, **WEERLEGD**,
**NIET TE TOETSEN**. "Ernst?"/"Label?" = terecht ja/nee. Alle scripts die hieronder staan heb ik zelf
gedraaid in w3 (uitvoer in `nakijken/eigen/*/out/`).

### Rapport A (24 overige bevindingen; #15, #16, #19, #22, #23, #24, #25, #28 zijn sleutelmatches)

| nr | oordeel | ernst? | label? | bewijs |
|---|---|---|---|---|
| 1 | BEVESTIGD | ja (kritiek) | ja (zeker) | `p6xml-foreign`: geneste variant "taken: 0 relaties: 0", platte 3/1. Code: `getAllByLocalName` loopt alleen `root.children` (`p6xmlReader.ts:192-201`). De citatie `docs/superpowers/specs/2026-08-14-rapport-critreview-f0.md:20-48` bestaat en beschrijft dezelfde bug op een echt P6-bestand (`UploadScheduleP6.xml`, Activity genest in Project), dus "echte P6-export opent leeg" is in de repo gedocumenteerd, niet alleen A's kennis. |
| 2 | BEVESTIGD | ja | ja | Code: `if (getElementText(calEl,'Type') !== 'Resource') continue;` (`:224`), `parseCalendar` = `calElements[0]` (`:843-846`), `ActivityDefaultCalendarObjectId` komt nergens voor (grep). Script: A100/A110 op projectkalender, bibliotheek `[]`. |
| 3 | BEVESTIGD | ja | ja | `parseP6HolidayOrExceptions` (`:176-190`) maakt van elke `HolidayOrException` een feestdag, ongeacht `WorkTime`. Script: zaterdag 2026-06-13 als "Feestdag". Dat P6 zo een werkende uitzondering uitdrukt is A's kennis; het lezergedrag is aangetoond. |
| 4 | BEVESTIGD | ja | ja | `readP6Calendar`/`applyCalendarBody` starten van `createDefaultCalendar()` en zetten `holidays` alleen bij ≥1 uitzondering (`mspdiReader.ts:968-975`, `p6xmlReader.ts:869`); `defaultCalendar.ts:33` leest `loadConstructionMode()`. Scripts: 29 NL-feestdagen op project- én resourcekalenders (MSPDI) en P6. Zelfde als B#09. |
| 5 | BEVESTIGD | ja, discutabel | ja | `parseCalendar` neemt `getElementsByTagName('Calendar')[0]` (`:985-989`); `uid <= 1` wordt uit de bibliotheek gefilterd (`:258`); een project-`<CalendarUID>` wordt nergens gelezen (grep: alleen resource/taak). Script: "Standard" i.p.v. "Night Shift". Hoog hangt af van hoe vaak MSP een niet-eerste kalender kiest; B geeft dezelfde bug middel/afgeleid. |
| 6 | BEVESTIGD | ja | ja | `BaseCalendarUID` komt niet voor in `mspdiReader.ts` (grep); resourcekalender start van `createDefaultCalendar()` (`:259`). Script: "Jan" = ma–vr 7–16 met 29 feestdagen i.p.v. Night Shift. |
| 7 | BEVESTIGD | ja | ja | `getElementText` = `descendantText` (`:141`, `xmlDom.ts:14-17`), `<Type>` via `getElementInt(te,'Type',-1)` (`:379`). Script: "Bouwen" krijgt `FIXED_DURATION` uit `PredecessorLink/Type=1`. Zelfde als B#10. |
| 8 | BEVESTIGD | ja | ja | `IsNull` komt niet voor in de lezer (grep). Script: extra taak `{"name":"Task","dur":0}`. |
| 9 | BEVESTIGD | ja | ja | `if (uid < 0) continue;` en `name || 'Resource'` (`:281-289`). Script: fantoomresource "Resource". Zelfde als B#15. |
| 10 | BEVESTIGD | ja | ja | `xml-hourmode-contagion`: zonder fractionele taak 8 u/dag en 0/41 taken met tijd; mét één taak van 1,5 d: MSPDI 9 u/dag, 41/41 met tijd (`T08:00`), P6 9 u/dag, 34/41. Mechanisme: `promoteHourCalendars` per kalender op discriminator (c) (`mspdiReader.ts:332-347`, `p6xmlReader.ts:428-440`) + één band 07–16 = 9 u. |
| 11 | BEVESTIGD | ja | ja | `parseMSPDuration`: `Math.round(mins/perDay)` (`:172-178`); `p6HoursToDays`: `Math.round` (`:74-77`), ook voor lag (`:661`). Script: 1,5 d → 1; P6 lag 0,5 d → 1. |
| 12 | BEVESTIGD | ja | ja | Writers `Math.round(completion*100)` (`mspdiWriter.ts:491`, `p6xmlWriter.ts:472`); `importNormalize.ts:64-70`: `completion >= 1` ⇒ COMPLETED + `defaultActualFinish`. Script: 0,996 → COMPLETED, AF 2027-03-10. |
| 13 | BEVESTIGD | ja | ja | `escapeXml` vervangt alleen `& < > " '` (`xmlInterchange.ts:11-18`). Script: U+000B rauw in MSPDI en P6-XML. Zelfde als B#17. |
| 14 | BEVESTIGD | ja | ja | `sequences.filter(s => s.successorId === task.id)` per taak (`:563`), `tasks.find` per toewijzing (`:647`). Mijn run: 10k 1253 ms → 20k 6269 ms (×5). Zelfde als B#11. |
| 17 | BEVESTIGD (gedrag); conformiteit NIET TE TOETSEN | ja, mits conform | ja (afgeleid) | `ifc-argcounts` op het voorbeeld: IFCWORKPLAN 15, IFCWORKSCHEDULE 15, IFCWORKCALENDAR 8, resources 9. Writer (`ifcWriter.ts:257-260`) schrijft tussen CreationDate en StartTime vijf `$` (schema: vier), kalender zonder Identification-slot (`:902`), resources zonder Usage/BaseCosts/BaseQuantity (`:1204`). Zie beslisregel 3. |
| 18 | BEVESTIGD | ja | ja | Lezer: `wp.args[12]`/`[13]` (`ifcReader.ts:1086-1089`), `cal.args[5]` (`:2360`), `args[7]` shift (`:2420`), `args[14]` BASELINE (`:2848`). Script: `projectStartDate "2026-06-30"`, `projectEndDate ".PLANNED."`, werkweek/uren/feestdagen/ploeg weg. Zelfde als B#06a. |
| 20 | BEVESTIGD | ja | ja | `createDefaultTaskTime(formatDate(new Date()), 5)` bij ontbrekende IfcTaskTime (`:1330`); `FILE_SCHEMA` wordt nergens gelezen (grep). Script: start = rundatum, duur 5, geen melding. Zelfde als B#04. Raakt G8-regel maar ander gebrek (beslisregel 2). |
| 21 | BEVESTIGD | ja | ja | `parseDurationDays` kent alleen `D`/`H` (`:958-1000`); `isoDurationToMinutes` negeert alles vóór `T` (`subdayIo.ts:93-110`); taakduur gebruikt niet `isoDurationLeadingDaysMinutes` (alleen lags, `:1554/:1565`). Script: `P1W → 0`, `P0Y0M1DT4H0M0S → 240 min`. Zelfde als B#02. |
| 26 | BEVESTIGD | ja | ja | `csvDate` knipt de ISO-prefix zonder validatie en herschikt d/m/y zonder bereikcontrole (`importDates.ts:48-58`). Script: `2026-15-03`, `2026-02-30` als taakdatum. Zelfde als B#27. |
| 27 | BEVESTIGD | ja | ja (web-pad aangetoond) | `file.text()` (`webBackend.ts:123`, `:327`) decodeert als UTF-8 met vervangingstekens; CSV is `kind:'text'` (`formatRegistry.ts:129`). Script: `Caf�-fundering`. Tauri-pad (`readTextFile`) faalt eerder dan dat het vervangt — door A niet onderscheiden; B (#29) zegt dat wel en labelt afgeleid. |
| 29 | BEVESTIGD (code); empirisch NIET TE TOETSEN | ja (laag) | ja (afgeleid) | `replaceUserFile`: tmp schrijven met de oude mode, dan `rename` (`atomicWrite.ts:95-108`); POSIX-rename kijkt naar de maprechten. Sandbox draait als root, dus niet onderscheidend (A zegt dat zelf). Of het een fout of een ontwerpkeuze is, is discutabel. |
| 30 | BEVESTIGD | ja | ja | `finishFromStartAndDuration` geeft `undefined` zodra de start een `T` draagt (`importDates.ts:92`), placeholder "vandaag" blijft (`:145`). Script: start `2026-03-02T07:00`, finish `2026-09-28`. |
| 31 | BEVESTIGD (code) | ja | ja (afgeleid) | `wbsTasks.find` per WBS/activiteit (`p6xmlReader.ts:366-367`, `:617`), `childIds.includes` (`:370`, `:618`), `resources.find` (`:269`, `:292`). Meting (×2,8 bij ×2) is met de shim vervuild; A zegt dat zelf. Zelfde als B#31. |
| 32 | BEVESTIGD | ja | ja | Writer: één band `workStartHour`–`workEndHour` (`mspdiWriter.ts:182-190`, `p6xmlWriter.ts:157-160`) met `MinutesPerDay = hoursPerDay*60` (`:353`). Script: `MinutesPerDay 480`, band 07:00–16:00, `PT40H0M0S`. Dat MSP/P6 op de banden plannen is afgeleid, door A zo benoemd. Zelfde als B#20. |

Onterechte "zeker"-labels in A: **0**. Alle zeker-rijen hebben een werkend script dat de kernclaim toont.
Kleine onnauwkeurigheden: regelnummer `ifcPsets.ts:127-130` (#16); "270" vs 268 GlobalIds (#19, hangt
van de tijdstempel af). Verkeerde negatieve conclusies (geen fout in de zin van de opdracht, wel
vermeldenswaard): "`guidOf` lost botsingen op — geen bevinding" (tegendeel van G17) en "datum-helpers zijn
consequent UTC" (tegendeel van G8).

### Rapport B (38 overige bevindingen, incl. de niet-G-delen van #01 en #28; #01, #03, #07, #08, #13, #24, #28, #30, #33a zijn (mede) sleutelmatches)

| nr | oordeel | ernst? | label? | bewijs |
|---|---|---|---|---|
| 01 (niet-G14-deel) | BEVESTIGD | ja | ja | `foreign1`: 12 entiteiten in, 69 uit; `IFCWALL`, `Pset_Custom`, `K-100`, `IFCRELASSIGNSTOPROCESS` weg. `formatRegistry.ts:122`: IFC is het enige `canBeSaveTarget`. Overschrijven via Ctrl+S/actual-autosave is door B als afgeleid gemarkeerd. |
| 02 | BEVESTIGD | ja | ja | `hasTimeComponent = /^-?P[^T]*T/` (`ifcReader.ts:1489`) ⇒ uurmodus en alleen het T-deel (`subdayIo.ts:93-110`). `dur1`: `P0Y0M5DT0H0M0S → 0`, `P1DT4H → 240`, `P1W → 0`, `PT4,5H → 300`. Zelfde als A#21. |
| 04 | BEVESTIGD | ja | ja | Zie A#20. `ifc2x3`: twee taken op de leesdatum, duur 5, 0 waarschuwingen. Hoog vs A's middel: beide verdedigbaar (stil verzonnen data). |
| 05 | BEVESTIGD | ja | ja | `break` na de eerste IfcWorkTime (`:2397`); `workTimeDateRange` maakt van Start/Finish een vast bereik (`:1424-1429`), ExceptionTimes altijd feestdag (`:2442`). `ifc3` B/C: "Eerste Kerstdag (jaarlijks)" 2026-01-01..2030-12-31; werkdagen `[1..5]` i.p.v. 1–6. |
| 06a | BEVESTIGD (gedrag); conformiteit NIET TE TOETSEN | ja | ja (afgeleid) | `ifccal9`: 9-attribuut-kalender ⇒ standaardkalender; 8-attribuut-lay-out leest goed. Writer `:902` schrijft geen Identification-slot. Zie beslisregel 3. Zelfde als A#18. |
| 06b | BEVESTIGD (aantallen); conformiteit NIET TE TOETSEN | ja | ja (onbekend, eerlijk) | `argcount`: IFCWORKPLAN 15, IFCWORKSCHEDULE 15, IFCLABORRESOURCE 9. Zelfde als A#17 (A: afgeleid/hoog). |
| 09 | BEVESTIGD | ja | ja | Zie A#4. `hol1`: MSPDI/P6 29 feestdagen, projecteinde 04-21 → 04-23; IFC 0; `hol2` XER 0. |
| 10 | BEVESTIGD | ja | ja | Zie A#7. `mspdi1`: 47/60 taken met `mspTaskType`+`workRule` uit `PredecessorLink/Type`. |
| 11 | BEVESTIGD | ja | ja | Mijn run `perf1`: MSPDI 10k 1,4 s, 20k 5,6 s, 40k 33,5 s; IFC 0,5/0,8/2,0 s. Zelfde als A#14 (middel); hoog is bij 33–44 s op de hoofdthread verdedigbaar. |
| 12 | BEVESTIGD | ja | ja | Zie A#5. `mspdi2` A2/A3: "Standard" i.p.v. "Zaterdagploeg" (UID 3). |
| 14 | BEVESTIGD (code); Project-2003-claim NIET TE TOETSEN | ja | ja (afgeleid) | `dayType >= 1 && dayType <= 7` (`:928`); uitzonderingen alleen uit `<Exceptions><Exception>` (`readRawMspdiExceptions`, `:857-866`). `msp3`: geen september-uitzondering. |
| 15 | BEVESTIGD | ja | ja | Zie A#9. `mspdi2` A1. |
| 16 | BEVESTIGD (code) | ja | ja | `if (getElementInt(bEl,'Number',-1) !== 0) continue;` (`:486`). Geen script; codepad klopt. |
| 17 | BEVESTIGD | ja | ja | Zie A#13. `mspdi2` D: 4 ongeldige tekens. |
| 18 | BEVESTIGD (waarneming); scope discutabel | discutabel | ja | `diff1 anchor`: MSPDI 9/300 verschillen, ankervervanging alleen verandert 8/300 solves. Writers schrijven `shownStart/shownFinish` (`mspdiWriter.ts:483-484`, `p6xmlWriter.ts:469-470`). B zegt zelf dat het solver-ankersemantiek is; als import/export-fout is "correctheid/middel" aan de hoge kant. |
| 19 | BEVESTIGD | ja | ja | `taskTypeToP6`: zonder `milestoneKind` altijd "Start Milestone" (`p6xmlWriter.ts:117-122`); lezer `START` (`p6xmlReader.ts:535-540`). `mile1`: FF-mijlpaal 03-04 → 03-05 (P6XML), IFC/MSPDI blijven; classify: 84/300, 51 alleen nulduur. |
| 20 | BEVESTIGD | ja | ja | Zie A#32. `cal1`: één band 07–16, `MinutesPerDay 480`; pauze 12:30 → 12:00 na terugimport. |
| 21 | BEVESTIGD | ja | ja | `cal247`: 0–24-kalender (ook 24/7) ⇒ uurmodus met `T07:00` (IFC) / `T08:00` (MSPDI/P6); 6–24, 0–16, 0–12, 4–14 blijven dagtaken. Mechanisme (anker `T07:00:00` in `ifcDateTime`, `ifcWriter.ts:53-58`; promotie in lezers) klopt met code. |
| 22 | BEVESTIGD | ja | ja | `MAX_HOLIDAY_RANGE_DAYS = 366` (`calendarRecurrence.ts:82`), klem `:520`. `hol3`: 487 d → 298 d + 65 d (MSPDI), IFC/P6 heel. |
| 23a | BEVESTIGD | te laag (middel) | ja | Zelfde bug als A#1; `p6a` P1: geneste variant 0 taken. De repo-doc (zie A#1) bevestigt dat echte P6-exports nesten, dus het is geen robuustheidsdetail maar "echt P6 opent leeg" — B kon dat niet weten zonder die doc en heeft het eerlijk gesplitst. |
| 23b | DEELS: codedeel BEVESTIGD, PMXML-claims NIET TE TOETSEN | ja, mits waar | ja (afgeleid) | Code: `StandardWorkHour` (`:146`), `CS_*`-codes (`:84-97`), alleen `PhysicalPercentComplete` (`:472`), alleen eerste + `Type=Resource`-kalenders (`:222-224`); de writer noemt zelf "MPXJ-PMXML-conventie". `p6a` P2–P4 tonen het lezergedrag. Of Oracle-PMXML anders is, is hier niet toetsbaar (komt overeen met mijn kennis). |
| 25 | BEVESTIGD | ja | ja | `PREDECESSOR_TOKEN` met lazy `(.+?)` (`csvReader.ts:103-105`); commentaar op :97 noemt `A-01` als geldige code. `csv1` T2: `["A","B",-1]`. |
| 26 | BEVESTIGD | ja | ja | `csvDate` kent alleen ISO, `d-m-yyyy`, `d/m/yyyy`; `csvDateOrToday` ⇒ `formatDate(new Date())` (`importDates.ts:48-63`). `csvdates`: zes notaties ⇒ leesdatum, 0 waarschuwingen. Raakt G8-regel maar ander gebrek (beslisregel 2). |
| 27 | BEVESTIGD | ja | ja | `csv1` T3/T4/T6/T7 + `solve1`: `2026-13-45` blijft, duur −3, zelfverwijzing ⇒ cyclus, `Critical=true` niet kritiek (`=== 'yes'`, `:291`). |
| 28 (niet-G2-deel) | BEVESTIGD | ja | ja | `csv2`: CR-only ⇒ "must have at least a header and one data row"; tab-CSV ⇒ 1 taak "Task". `split(/\r?\n/)` (`:217`). |
| 29 | BEVESTIGD | ja | ja (afgeleid, eerlijk) | Zie A#27; `enc1`: U+FFFD; strikte decoder werpt TypeError. |
| 31 | BEVESTIGD | ja | ja | `childIds.includes` per kind (`xerReader.ts:888`, `p6xmlReader.ts:370/:618`, `ifcReader.ts:1884`). Mijn run `xerperf wbs1`: 1,6/5,8/23,5 s bij 20k/40k/80k; `wbs40`: 0,9/1,8/4,2 s. |
| 32 | BEVESTIGD | ja | ja | `Date.UTC(1,…)` ⇒ 1901 (`dateUtils.ts:17-19`); fallback `new Date(str)` lokaal + UTC-velden (`:20-22`). `dt1`: `0001-01-01 → 1901-01-01`; `tz2` onder `TZ=Europe/Amsterdam`: `2026/03/02 → 2026-03-01`. |
| 33b | BEVESTIGD | ja | ja | `hasNonAnchorTime` ziet `TX7:00` als afwijkende tijd (`subdayIo.ts:116-121`) ⇒ uurmodus ⇒ `formatInstant(parseInstant(q))` op Invalid Date (`ifcReader.ts:1185-1188`). `ifcdate2`: 6 slots RangeError; `ifcfuzz2`: 121/3000; `mspdi2` C: `garbage` in uurmodus RangeError. |
| 34 | BEVESTIGD | ja | ja | Recursieve `addRecursive` (`wbs.ts:65-71`), `taskDepths` via `flattenOrder` (`:139`). `deep1`: 3000 ok, 6000 RangeError; `cycle1`: keten 30000 ⇒ `writeCSV` crasht, `writeIFC` ok. Randgeval, wel import/export-bereik (IFC-lezer accepteert). |
| 35 | BEVESTIGD | ja | ja | `XerSourceArchiveValidationError` (`xerSourceArchive.ts:106`) heeft geen `xerCode`, `importErrorMessageKey` valt op `openFailed` (`formatRegistry.ts:219-250`). `xerfuzz`: 48/3000. |
| 36 | BEVESTIGD | ja | ja | `pdf2 1000`: renderReport 6,4 s (≈6 ms/taak); `pdf1 300 newline`: `VectorUnsupportedError: … U+000A U+0009`. Rasterterugval is bewust (A merkt dat ook op), maar de trigger door stuurtekens en de lineaire seconden zijn reëel. |
| 37 | BEVESTIGD | ja | ja | `mspdiWriter.ts` schrijft geen `taskType` (grep: alleen `mspTaskType`/`customTaskTypes`); `taskTypeToP6` ⇒ "Task Dependent" (`:117-124`). `tasktype1`: 5 typen → 40× CONSTRUCTION, 0 waarschuwingen. |
| 38 | BEVESTIGD | ja | ja | `escapeCSV` citeert alleen `;`/`"`/regeleinde (`csvWriter.ts:15-20`). `tasktype1`: 2 cellen met `=`/`+` ongewijzigd. Excel-effect door B als afgeleid gemarkeerd. |
| 39 | BEVESTIGD (code) | ja | ja | `projectFileBase` doet alleen `trim() || 'project'` (`documents.ts:69-71`); gebruikt in `ReportPanel.tsx:227`, `mspdiWriter.ts:338`, `ifcWriter.ts:205`. Dialooggedrag niet getest, zoals B zegt. |
| 40 | BEVESTIGD | ja | ja | Scalar uit `workingTimes[0]` (`mspdiReader.ts:947-961`). `msp2`: start 8, einde 12, hpd 8; taken in uurmodus. Zelfde code-site als de secundaire G6-plek, ander symptoom. |
| 41 | BEVESTIGD (code) | ja | ja | Geneste `for (const assignment of assignments)` binnen de taaklus (`mppReader.ts:1650-1654`). |
| 42 | BEVESTIGD | ja | ja | `cw > col0Bodypx && laterColBodypx > 0` anders `cols = 1` (`tileLayout.ts:318-323`). `tile1`: 729 px ⇒ 4629 kolommen, 730 px ⇒ 1 kolom, 730 van 4000 px afgedrukt. |

Onterechte "zeker"-labels in B: **0**. Elke zeker-rij heeft een script dat de kolom "verwacht vs
waargenomen" toont. Het label "onbekend" (06b) en de negen "afgeleid" zijn eerlijk waar de claim van
externe-formaatkennis afhangt.

Niet zelf gereproduceerd (alleen code gelezen): A#29 (root), A#31 (meting shim-vervuild, code wel), B#16,
B#39, B#41 (B had er zelf geen script voor). Alle hoog/kritiek-bevindingen van beide rapporten zijn gedraaid.

## 3. Samenvatting per rapport

### Rapport A

- **Sleutel:** gevonden 8 van 23 (7 met repro: G1, G7, G10, G12, G13, G20, G21; 1 zonder repro: G11),
  deels 0, gemist 15.
  - correctheid 2/9 (G7, G20), dataverlies 2/4 (G1, G10), compatibiliteit 3/7 (G11, G12, G13),
    performance 1/3 (G21).
- **Overige (24):** bevestigd 24, deels 0, weerlegd 0, niet te toetsen 0 — met twee nuances (beslisregel 4):
  #17 (gedrag bevestigd, schemaconformiteit niet toetsbaar) en #29 (code bevestigd, empirisch niet toetsbaar).
- **Onterechte "zeker":** 0. Eén verkeerd regelnummer (#16).
- **Sterkste unieke bevindingen:** #1 (echte P6-export opent leeg; in de repo al gedocumenteerd maar
  onopgelost — kritiek), #2/#3 (P6-kalendertypes en werkende uitzonderingen), #6 (`BaseCalendarUID`),
  #8 (`IsNull`-rijen), #10+#32 (uurmodus-besmetting door de 9-uursband — een echte round-trip-breker),
  #11/#12 (afronding duur en 99,6 % → voltooid), #24 (G21, met meting), #28 (G20, met meting), #30.
- Zwak: de hele GlobalId-familie (G14–G18) is expliciet als "gelezen, geen bevinding" afgedaan, en de
  G8-familie is als "consequent UTC" weggeredeneerd. CSV-parser alleen op het regeleinde bekeken (G2–G4
  gemist).

### Rapport B

- **Sleutel:** gevonden 12 van 23 (G1, G2, G5, G6, G7, G10*, G11, G12, G13, G14, G16*, G22; * = gebundeld
  in één rij met een andere G), deels 0, gemist 11. Strikt (bundeling telt niet): 10 gevonden, 13 gemist.
  - correctheid 3/9 (G2, G6, G7), dataverlies 3/4 (G1, G5, G10*), compatibiliteit 5/7 (G11, G12, G13,
    G14, G16*), performance 1/3 (G22).
- **Overige (38):** bevestigd 37, deels 1 (#23b), weerlegd 0, niet te toetsen 0 — met nuances (beslisregel 4): #06a/#06b/#14
  (gedrag/code bevestigd, externe-schema-claim niet toetsbaar), #18 (waarneming bevestigd, scope
  discutabel), #23a (ernst te laag gezien de repo-doc).
- **Onterechte "zeker":** 0.
- **Sterkste unieke bevindingen:** #01 (G14 plus verlies van alle niet-planningsinhoud bij opslaan van
  een 4D-IFC — voor BIM-gebruikers het gevaarlijkst), #05 (alleen eerste IfcWorkTime, terugkerende
  feestdag ⇒ jaren dicht), #13 (G6), #19 (P6 mijlpaalsoort verschuift FF/SF-mijlpalen, met 84/300
  gemeten), #21 (24-uurskalender klapt naar uurmodus, ook in het eigen formaat), #22 (366-dagen-klem),
  #25 (`A-01` ⇒ lag −1), #26 (zes datumnotaties stil "vandaag"), #33b (één onleesbare tijd crasht de
  hele import), #35, #42, en de fuzz-/mutatiedekking als negatieve resultaten.
- Zwak: `guidOf`-cache (G17), vaste seeds (G18), werkplan/werkschema (G15), CSV-taaktype (G3) en
  Total Float (G4) gemist; performance van `readIFC`-kalenders (G21) en print (G23) niet bekeken.

## 4. Overlap tussen de rapporten

Zelfde bug in beide (A ↔ B): #1 ↔ #23a/#23b (P6 genest; A kritiek/zeker, B middel+hoog/afgeleid);
#4 ↔ #09 (NL-feestdagen); #5 ↔ #12 (CalendarUID; A hoog/zeker, B middel/afgeleid); #7 ↔ #10
(PredecessorLink-Type); #9 ↔ #15 (resource UID 0; zeker vs afgeleid); #10/#32 ↔ #20/#21 (band 9 u,
uurmodus-promotie — B ziet de 0–24-variant, A de fractionele-duur-variant); #13 ↔ #17 (stuurtekens);
#14 ↔ #11 (`writeMSPDI` kwadratisch; middel vs hoog); #15/#16 ↔ #03 (STEP-codering, G11/G12; A splitst
en labelt de writerkant afgeleid, B bundelt en toont beide); #17 ↔ #06b en #18 ↔ #06a (schema-attributen;
identieke aantallen 14/9/11 onafhankelijk gemeld); #19 ↔ #08 (G13; B ook G16); #20 ↔ #04 (IFC2X3);
#21 ↔ #02 (ISO-duren); #22 ↔ #33a (G7); #23 ↔ #07 (G10; B ook G5); #25 ↔ #24 (G1); #26 ↔ #27
(CSV-datums ongeldig); #27 ↔ #29 (cp1252; zeker vs afgeleid); #31 ↔ #31 (`find`/`includes`-patronen).

Alleen A: #2, #3, #6, #8, #11, #12, #24 (G21), #28 (G20), #29, #30.
Alleen B: #01 (G14), #05, #13 (G6), #14, #16, #18, #19, #22, #25, #26, #28-rest (G2, CR, tab), #30 (G22),
#32, #33b, #34, #35, #36, #37, #38, #39, #40, #41, #42.

Waar hetzelfde met een ander label is gemeld, is B consequent voorzichtiger (afgeleid waar de claim van
MS-Project-/P6-gedrag afhangt); A's "zeker" is in die gevallen verdedigbaar omdat het lezergedrag wél
is aangetoond. Beide hanteren hun eigen labelregel consistent.

## 5. Bevestigde overige bevindingen die op de huidige code mogelijk nog spelen (alleen genoemd)

De sleutel meldt dat de range `8e3bcf4c..33cb1350^2` alleen de G-bugs repareert; deze zijn dus kandidaat:

- P6-XML: Activity/WBS/Relationship genest in `<Project>` ⇒ leeg project zonder melding (A#1, B#23a);
  alleen `Type=Resource`-kalenders in de bibliotheek, projectkalender = eerste `<Calendar>`,
  `ActivityDefaultCalendarObjectId` ongelezen (A#2); `HolidayOrException` mét `WorkTime` als feestdag
  (A#3); eigen PMXML-vocabulaire (`CS_*`, `PhysicalPercentComplete`, `StandardWorkHour`) (B#23b);
  automatische mijlpaal altijd "Start Milestone" (B#19); `wbsTasks.find`/`childIds.includes` (A#31, B#31).
- MSPDI/P6: NL-feestdagen op een kalender zonder uitzonderingen, machine-afhankelijk via Bouwmodus
  (A#4, B#09); project-`<CalendarUID>` ongelezen, UID 1 hard projectkalender (A#5, B#12);
  `BaseCalendarUID` niet geërfd (A#6); `<Type>` uit `PredecessorLink` via descendant-scope (A#7, B#10);
  `IsNull`-rijen worden taken (A#8); resource UID 0 wordt "Resource" (A#9, B#15); `WeekDay DayType 0`
  (B#14); baselines 1–10 weg (B#16); scalar `workEndHour` uit de eerste band (B#40); 366-dagen-klem (B#22).
- XML-export: 9-uursband met `MinutesPerDay 480`/`HoursPerDay 8` en verlies van de pauze (A#32, B#20);
  uurmodus-besmetting bij één fractionele taak (A#10) en bij een 0–24-kalender (B#21, ook IFC);
  afronding van fractionele duur en P6-lag (A#11); 99,6 % ⇒ COMPLETED met verzonnen AF (A#12);
  stuurtekens ongeëscapet in XML (A#13, B#17); `writeMSPDI` kwadratisch (A#14, B#11); taaktype weg in
  MSPDI/P6 zonder waarschuwing (B#37); berekende datums als ankers (B#18, scope discutabel).
- IFC: niet-planningsinhoud verdwijnt bij opslaan van een vreemd IFC (B#01); ISO-duren `P…DT…H`, `W`,
  `M`, `Y` (A#21, B#02); IFC2X3/ontbrekende IfcTaskTime ⇒ stil vandaag+5 d, geen `FILE_SCHEMA`-controle
  (A#20, B#04); attribuutaantallen en slotposities van IfcWorkPlan/-Schedule/-Calendar/resources en de
  lezer die daarop vertrouwt (A#17, A#18, B#06a, B#06b); alleen eerste IfcWorkTime, recurrente
  uitzondering als bereik (B#05); één onleesbare tijd ⇒ ongetypeerde `RangeError` (B#33b); ontbrekende
  finish bij start-met-tijd ⇒ vandaag (A#30).
- CSV: ongeldige datums letterlijk, DD/MM-herschikking zonder bereikcontrole (A#26, B#27); zes gangbare
  notaties stil "vandaag" (B#26); `A-01` ⇒ lag −1 (B#25); CR-only/tab niet herkend (B#28); negatieve duur,
  zelfverwijzing, `Critical=true` (B#27); formule-injectie (B#38); Windows-1252 (A#27, B#29).
- Overig: XER `XerSourceArchiveValidationError` zonder `xerCode` (B#35); `childIds.includes` in XER bij
  één WBS (B#31); MPP toewijzingslus (B#41); diepe hiërarchie-recursie in `flattenOrder`/`writeCSV`
  (B#34); PDF ~6 ms/taak en stuurtekens ⇒ raster (B#36); `computeTileLayout` 1 kolom/duizenden kolommen
  (B#42); bestandsnaam niet gesaneerd (B#39); alleen-lezen bestand via rename vervangen (A#29).
