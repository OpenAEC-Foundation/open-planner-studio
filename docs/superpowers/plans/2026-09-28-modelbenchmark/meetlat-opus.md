# Audit import- en exportlaag — Open Planner Studio

Werkmap: `/home/user/audit/w2` (momentopname, commit `0083f34 snapshot`). Alle reproductiecommando's
draaien vanuit die map. `audit-repro/run.sh` bundelt een script met esbuild precies zoals
`bundle_check` in `tests/planning/run.sh` en draait het met Node 22. Ruwe uitvoer staat in
`audit-repro/out/<script>.txt`. De XML-lezers draaien in Node op een eigen DOM-shim
(`audit-repro/xmlshim.ts`, met numerieke entiteiten, CDATA en `localName`); zie de kanttekeningen
onderaan.

Labels: **zeker** = aangetoond met een gedraaid script (de uitvoer staat erbij); **afgeleid** =
redenering uit de code en/of de specificatie; **onbekend** = niet vastgesteld.

Regel voor de tabel: per rij één categorie (de primaire) en één label, namelijk het label van de
**kernclaim**. Is het waargenomen gedrag met een script aangetoond, dan is het label zeker, ook als de
gevolgen bij andere pakketten (MS Project, P6, IfcOpenShell) afgeleid zijn. Hangt de kernclaim zelf af
van een specificatiedetail dat ik uit het hoofd heb en niet kon naslaan (rij 17 en 19), dan is het
label afgeleid. De nuance staat in de toelichting.

## Overzicht

| nr | titel | categorie | ernst | pad:regel | mechanisme (1–3 zinnen) | reproductie-commando | verwacht vs waargenomen | label |
|---|---|---|---|---|---|---|---|---|
| 1 | P6-XML uit P6 zelf (Activity/WBS/Relationship genest in `<Project>`) levert 0 taken | compatibiliteit | kritiek | src/services/p6/p6xmlReader.ts:192 (getAllByLocalName), :306, :378, :639 | `getAllByLocalName` bekijkt alleen de directe kinderen van `<APIBusinessObjects>`. De eigen writer schrijft plat, maar P6 nest deze objecten in `<Project>` (in de repo vastgesteld op een echte P6-export: docs/superpowers/specs/2026-08-14-rapport-critreview-f0.md:25). | `bash audit-repro/run.sh audit-repro/p6xml-foreign.ts` | verwacht 3 taken en 1 relatie; waargenomen "taken: 0 relaties: 0" (geen fout, een leeg project) | zeker |
| 2 | P6-XML: activiteitskalenders van het type Global/Project worden genegeerd, en de projectkalender is "de eerste `<Calendar>`" | correctheid | hoog | src/services/p6/p6xmlReader.ts:224, :434, :846 | Alleen `Type=Resource`-kalenders komen in de bibliotheek. Een activiteit met `CalendarObjectId` naar een Global-kalender valt terug op de eerste `<Calendar>` in het bestand. `ActivityDefaultCalendarObjectId` wordt niet gelezen. | `bash audit-repro/run.sh audit-repro/p6xml-foreign.ts` | verwacht: A100/A110 op "7-daagse"; waargenomen `calendarId= (projectkalender)` = "5-daagse", bibliotheek `[]` | zeker |
| 3 | P6-XML: een werkende uitzondering (HolidayOrException mét WorkTime) wordt een feestdag | correctheid | middel | src/services/p6/p6xmlReader.ts:176-190 | Elke `<HolidayOrException>` wordt als niet-werkdag gelezen, ook als hij `<WorkTime>` draagt (in P6 een extra werkdag of afwijkende uren). | `bash audit-repro/run.sh audit-repro/p6xml-foreign.ts` | verwacht: zaterdag 2026-06-13 wordt een werkdag; waargenomen `{"name":"Feestdag","startDate":"2026-06-13"}` | zeker |
| 4 | MSPDI/P6-XML: een kalender zonder uitzonderingen krijgt 29 Nederlandse feestdagen erbij | correctheid | hoog | src/services/msproject/mspdiReader.ts:975 (ook de resourcekalenders via :268); src/services/p6/p6xmlReader.ts:869; src/engine/calendar/defaultCalendar.ts:33 | De lezers starten van `createDefaultCalendar()` en overschrijven `holidays` alleen als het bestand uitzonderingen bevat. Het resultaat hangt bovendien af van de lokale instelling Bouwmodus: hetzelfde bestand krijgt op een andere machine andere feestdagen. | `bash audit-repro/run.sh audit-repro/mspdi-foreign.ts` en `bash audit-repro/run.sh audit-repro/p6xml-default-holidays.ts` | verwacht 0 feestdagen; waargenomen `"holidays": 29` (Koningsdag, Hemelvaart, …) op project- én resourcekalenders (MSPDI) en `feestdagen: 29` (P6) | zeker |
| 5 | MSPDI: `<CalendarUID>` van het project wordt genegeerd; de eerste `<Calendar>` is altijd de projectkalender | correctheid | hoog | src/services/msproject/mspdiReader.ts:985-996, :258, :326 | `parseCalendar` neemt `getElementsByTagName('Calendar')[0]`, en UID 1 geldt hard als projectkalender. Een project met bijvoorbeeld "Night Shift" als projectkalender rekent op "Standard". | `bash audit-repro/run.sh audit-repro/mspdi-foreign.ts` | verwacht projectkalender "Night Shift"; waargenomen `"name": "Standard"` | zeker |
| 6 | MSPDI: afgeleide kalenders (`BaseCalendarUID`) erven hun basis niet | correctheid | middel | src/services/msproject/mspdiReader.ts:250-270 | Een resourcekalender met `IsBaseCalendar=0` en zonder eigen WeekDays wordt de app-standaard (ma–vr 07–16 plus NL-feestdagen) in plaats van de basiskalender. De `.mpp`-lezer doet dit wel goed (mppCalendars.ts:567). | `bash audit-repro/run.sh audit-repro/mspdi-foreign.ts` | verwacht "Jan" = de werktijden van Night Shift; waargenomen `workDays [1..5], 7–16, 29 feestdagen` | zeker |
| 7 | MSPDI: taak-`<Type>` wordt uit een geneste `<PredecessorLink><Type>` gelezen | correctheid | middel | src/services/msproject/mspdiReader.ts:140-142 (descendant-scope), :379 | `getElementText` zoekt in alle afstammelingen. Heeft een taak geen eigen `<Type>` (derde tools), dan wordt het relatietype (1=FS) de MSP-taaktype-code (1=Fixed Duration), en daarmee ook de werkregel (`deriveImportedWorkRules`). | `bash audit-repro/run.sh audit-repro/mspdi-foreign.ts` | verwacht geen `mspTaskType`; waargenomen `"mspTaskType": "FIXED_DURATION"` bij "Bouwen" | zeker |
| 8 | MSPDI: een lege MS Project-rij (`<IsNull>1</IsNull>`) wordt taak "Task" | correctheid | middel | src/services/msproject/mspdiReader.ts:352-367 | `IsNull` wordt niet gelezen. Elke lege scheidingsrij wordt een taak van 0 dagen op de projectstart. | `bash audit-repro/run.sh audit-repro/mspdi-null-task.ts` | verwacht 2 taken; waargenomen 3, waarvan één `{"name":"Task","dur":0}` | zeker |
| 9 | MSPDI: een `<Resource>` zonder `<Name>` (zoals de UID-0-rij van MSP) wordt resource "Resource" | correctheid | laag | src/services/msproject/mspdiReader.ts:278-285 | Alleen `UID < 0` wordt overgeslagen; UID 0 of een naamloze resource wordt een fantoomresource. | `bash audit-repro/run.sh audit-repro/mspdi-foreign.ts` | verwacht alleen "Jan"; waargenomen ook `{"name":"Resource"}` | zeker |
| 10 | OPS → MSPDI/P6-XML → OPS: één taak van 1,5 dag zet de hele kalender en alle taken in uurmodus (8 → 9 u/dag) | correctheid | hoog | src/services/msproject/mspdiReader.ts:332-347; src/services/p6/p6xmlReader.ts:417-429; `promoteHourCalendars` (subdayIo) | Discriminator (c) promoveert de complete kalender zodra één taakduur geen hele dag is. De banden 07–16 geven 9 u/dag, het lunchuur (hoursPerDay 8) verdwijnt, en het XML-dag-anker 08:00 wordt bij elke taak als echte tijd gelezen. | `bash audit-repro/run.sh audit-repro/xml-hourmode-contagion.ts` | zonder de fractionele taak: 8 u/dag en 0/41 taken met tijd; mét: MSPDI 9 u/dag en 41/41 taken met tijd (bijv. `2027-03-16T08:00`), P6 9 u/dag en 34/41 | zeker |
| 11 | OPS → MSPDI/P6-XML → OPS: een fractionele dagduur wordt afgerond (P6 rondt ook de dag-lag af) | dataverlies | middel | src/services/msproject/mspdiReader.ts:172-183; src/services/p6/p6xmlReader.ts:74-77, :661 | De dagpaden doen `Math.round(uren / uren-per-dag)`. Hier is uren-per-dag al 9 door rij 10, dus 12 u / 9 = 1,33 → 1 (bij 8 u/dag zou het 2 zijn). MSPDI bewaart de lag wel (als `lagMinutes 240`), P6 rondt 4 u / 9 → 0,44 af op 1 dag. IFC bewaart alles exact. | `bash audit-repro/run.sh audit-repro/xml-fractional-days.ts` | verwacht 1,5 d en lag 0,5 d; waargenomen MSPDI `taskDuration 1`, P6 `taskDuration 1, lagDays 1` | zeker |
| 12 | OPS → MSPDI/P6-XML → OPS: 99,6 % gereed wordt VOLTOOID met een verzonnen actual finish | correctheid | middel | src/services/msproject/mspdiWriter.ts:491; src/services/p6/p6xmlWriter.ts:472; src/services/importNormalize.ts:61-70 | De writers ronden op hele procenten (≥ 99,5 → 100). De lezer maakt van 100 % zonder AF een voltooide taak met AF = de afgeleide datum. Voor IFC is dit precies het in M3 gedichte gedrag. P6's `PhysicalPercentComplete` is een getal met decimalen, dus daar is afronden onnodig. | `bash audit-repro/run.sh audit-repro/xml-completion-rounding.ts` | verwacht STARTED/0,996; waargenomen MSPDI en P6 `COMPLETED, completion 1, actualFinish 2027-03-10` | zeker |
| 13 | MSPDI- en P6-XML-writer schrijven verboden XML-tekens (stuurtekens) | robuustheid | middel | src/services/xmlInterchange.ts:11-18 (escapeXml) | Alleen `& < > " '` worden ge-escapet. U+0000–U+0008, U+000B, U+000C en U+000E–U+001F mogen in XML 1.0 niet voorkomen (ook niet als `&#x..;`), dus de export is niet welgevormd. | `bash audit-repro/run.sh audit-repro/xml-control-chars.ts` | verwacht 0; waargenomen `MSPDI … 1 U+000b`, `P6-XML … 1 U+000b` | zeker |
| 14 | `writeMSPDI` schaalt kwadratisch | performance | middel | src/services/msproject/mspdiWriter.ts:563, :647 | Per taak `sequences.filter(...)`, per toewijzing `tasks.find(...)`. | `bash audit-repro/run.sh audit-repro/perf-adapters.ts` | lineair verwacht; waargenomen 10k taken 1096 ms → 20k taken 5580 ms (×5,1 bij ×2) | zeker |
| 15 | IFC-lezer decodeert geen STEP-tekencodering (`\X2\…\X0\`, `\S\`, `\\`) | compatibiliteit | middel | src/services/ifc/ifcReader.ts:919-924 (stripQuotes) | Alleen `''` wordt teruggezet. IFC's van andere tools (die ISO 10303-21 volgen) tonen namen als `Caf\X2\00E9\X0\`. | `bash audit-repro/run.sh audit-repro/ifc-foreign-conformant.ts` | verwacht "Café De Kroon" / "Fundering straße"; waargenomen `"Caf\\X2\\00E9\\X0\\ De Kroon"`, `"Fundering stra\\S\\_e"` | zeker |
| 16 | IFC-writer codeert `\` en niet-ASCII niet volgens STEP | compatibiliteit | laag | src/services/ifc/ifcPsets.ts:127-130 (ifcStr) | `ifcStr` verdubbelt alleen `'`. Een letterlijke backslash (bijv. `\X2\` of `\S\` in tekst) wordt door een conforme lezer als escape gedecodeerd, en ruwe UTF-8 valt buiten de STEP-tekenset. Onze eigen round-trip is wel stabiel. | `bash audit-repro/run.sh audit-repro/ifc-strings-roundtrip.ts` (toont alleen de eigen round-trip) | eigen round-trip gelijk; andere tools lezen iets anders | afgeleid |
| 17 | IFC-writer: attribuutaantallen wijken af van het IFC4/4X3-schema | compatibiliteit | hoog | src/services/ifc/ifcWriter.ts:257, :260, :269, :902, :1204 | Geschreven: IfcWorkPlan/IfcWorkSchedule 15 attributen (schema 14), IfcWorkCalendar 8 (schema 9, `Identification` ontbreekt), IfcLabor-/Equipment-/Subcontract-/MaterialResource 9 (schema 11). Een schemavaste lezer (IfcOpenShell, de validatieservice) weigert of verschuift velden. | `bash audit-repro/run.sh audit-repro/ifc-argcounts.ts examples/15-datacentrum-agriport.ifc` | zie uitvoer: `IFCWORKPLAN 15`, `IFCWORKSCHEDULE 15`, `IFCWORKCALENDAR 8`, `IFCLABORRESOURCE 9` | afgeleid |
| 18 | IFC-lezer leest een schema-conform IfcWorkPlan/IfcWorkCalendar verkeerd | compatibiliteit | hoog | src/services/ifc/ifcReader.ts:1086, :1089, :2360, :2420, :2434, :2848 | De lezer gebruikt de afwijkende eigen posities: StartTime op args[12], WorkingTimes op args[5] en `BASELINE` op args[14]. Bij een conform bestand wordt de projectstart de FinishTime, de einddatum de enum-tekst, en verdwijnen werkweek, uren, feestdagen en ploeg. | `bash audit-repro/run.sh audit-repro/ifc-foreign-conformant.ts` | verwacht start 2026-03-02, eind 2026-06-30, ma–za 08–17, Kerst, SECONDSHIFT; waargenomen `projectStartDate "2026-06-30"`, `projectEndDate ".PLANNED."`, `workDays [1..5]`, `7–16`, `holidays []`, geen shift | zeker |
| 19 | IFC-GlobalIds hebben een ongeldig eerste teken | compatibiliteit | laag | src/services/ifc/ifcWriter.ts:36-50 (ifcGuid) | De 22-tekens-GUID codeert 128 bits, dus het eerste teken mag alleen 0–3 zijn. `ifcGuid` kiest vrij uit 64 tekens. | `bash audit-repro/run.sh audit-repro/ifc-strings-roundtrip.ts` | verwacht 0 ongeldige; waargenomen `282 GlobalIds, 270 met eerste teken buiten 0-3` | afgeleid |
| 20 | Een IFC2X3-planningsbestand opent stil met verzonnen datums en duren | compatibiliteit | middel | src/services/ifc/ifcReader.ts:1330 (createDefaultTaskTime(vandaag, 5)); geen FILE_SCHEMA-controle | Een IfcTask zonder IfcTaskTime (IFC2X3 gebruikt IfcScheduleTimeControl) krijgt 5 dagen en vandaag als datum, zonder melding. | `bash audit-repro/run.sh audit-repro/ifc2x3-schedule.ts` | verwacht een weigering/melding of 10 dagen; waargenomen `start "2026-09-28"` (= rundatum), `duration 5`, geen melding | zeker |
| 21 | IFC: ISO-duren met W/M/Y worden 0, en `P1DT4H` verliest het dagdeel | correctheid | middel | src/services/ifc/ifcReader.ts:958-1000 (parseDurationDays); src/services/subdayIo.ts:93-110 (isoDurationToMinutes) | `parseDurationDays` kent alleen `D` en `H`, en `isoDurationToMinutes` negeert alles vóór `T`. | `bash audit-repro/run.sh audit-repro/ifc-durations.ts` | verwacht P1W = 5 d, `P0Y0M1DT4H0M0S` = 1 d + 4 u; waargenomen `P1W → 0`, `P2W → 0`, `P1M → 0`, `P0Y0M1DT4H0M0S → durationMinutes 240` | zeker |
| 22 | Datetimes met een tijdzone-offset verschuiven de wandkloktijd | correctheid | laag | src/utils/dateUtils.ts:89-95 (parseInstant); src/services/importDates.ts:29-32, :40-45 | De engine rekent in zwevende wandkloktijd, maar een offset wordt naar UTC omgerekend: 08:00+01:00 wordt 07:00, en 00:30+02:00 wordt de vorige dag. Het resultaat hangt niet af van de TZ van de machine. | `bash audit-repro/run.sh audit-repro/tz-offset.ts` | verwacht 08:00; waargenomen `"2026-03-02T07:00"` en `"2026-03-01T22:30"`; IFC-taak `07:00 → 11:00`; identiek onder `TZ=Pacific/Kiritimati` | zeker |
| 23 | IFC: CRLF in tekstvelden wordt na opslaan en heropenen LF | dataverlies | laag | src/services/ifc/ifcReader.ts:860 | `.replace(/\r\n/g, '\n')` draait over de hele datasectie, dus ook binnen stringliterals. | `bash audit-repro/run.sh audit-repro/ifc-strings-roundtrip.ts` | verwacht gelijk; waargenomen `"Regel1\r\nRegel2…" → "Regel1\nRegel2…"` | zeker |
| 24 | `readIFC` schaalt met taken × bibliotheekkalenders | performance | middel | src/services/ifc/ifcReader.ts:2044-2060 (opsCalendarPsetProps), aangeroepen op :2072, :2114, :2148, :2165, :2190, :2268 | Per kalender scannen zes psetlezers álle entiteiten, en elk van de vele per-taak-`IFCRELDEFINESBYPROPERTIES` wordt daarbij geparsed. | `bash audit-repro/run.sh audit-repro/perf-ifc-calendars.ts` | waargenomen bij 2000 taken: 10 kal. 175 ms, 100 kal. 355 ms, 400 kal. 2089 ms; 8000 taken/400 kal. 4955 ms | zeker |
| 25 | De CSV-lezer splitst op regeleindes vóór het quote-parsen: de eigen export met een meerregelig veld komt kapot terug | dataverlies | hoog | src/services/csv/csvReader.ts:217 | `writeCSV` quote een veld met `\n` correct (RFC 4180), maar `readCSV` knipt eerst per regel. De rest van het veld wordt een fantoomtaak en de omschrijving is afgekapt. | `bash audit-repro/run.sh audit-repro/csv-multiline-roundtrip.ts` | verwacht 41 taken en de volledige omschrijving; waargenomen `42` taken, extra `{"name":"Task","wbs":" met puntkomma","dur":5}`, omschrijving `"Eerste regel"` | zeker |
| 26 | CSV: onmogelijke datums komen letterlijk in de planning, MM/DD wordt stil DD/MM | correctheid | middel | src/services/importDates.ts:48-60 (csvDate) | `csvDate` knipt de ISO-prefix zonder validatie en herschikt DD/MM/YYYY zonder bereikcontrole. `2026-15-03` en `2026-02-30` worden taakdatums. Alleen `csvDateOrUndefined` (voor "datums zoals opgeslagen") valideert. | `bash audit-repro/run.sh audit-repro/csv-dates.ts` | verwacht een ontbrekende/gemelde datum; waargenomen `scheduleStart "2026-15-03"` (geïnterpreteerd als 2027-03-03) en `"2026-02-30"` (= 2026-03-02) | zeker |
| 27 | Tekstformaten worden alleen als UTF-8 gelezen: een Windows-1252-CSV (Excel NL) verliest accenten | dataverlies | middel | src/services/fileAccess/webBackend.ts:123, :327 (`file.text()`); src/services/fileAccess/tauriBackend.ts:91 (readTextFile); src/services/formatRegistry.ts:129 (csv = 'text') | Er is geen encodingdetectie voor CSV (XER heeft die wel). Ongeldige UTF-8-bytes worden U+FFFD. | `bash audit-repro/run.sh audit-repro/csv-cp1252.ts` | verwacht "Café-fundering…"; waargenomen `"Caf�-fundering Oostgevel"`, `"Voegwerk fa�ade (� 12)"` | zeker |
| 28 | CSV/MSPDI met ≥ ~130k rijen crasht met RangeError | robuustheid | laag | src/services/importNormalize.ts:126 | `Math.min(...levels)` spreidt alle outline-niveaus als functieargumenten. | `bash audit-repro/run.sh audit-repro/csv-large-outline.ts` | 50k: ok (493 ms); 130k en 300k: `RangeError: Maximum call stack size exceeded` | zeker |
| 29 | Opslaan via schrijf-en-vervang omzeilt een alleen-lezen projectbestand (POSIX) | robuustheid | laag | src/services/fileAccess/atomicWrite.ts:95-122 (replaceUserFile) | `rename` kijkt alleen naar maprechten, dus een 0444-bestand wordt zonder fout vervangen (en houdt 0444). Direct schrijven zou EACCES geven. | `bash audit-repro/run.sh audit-repro/readonly-overwrite.ts` (loopt als root, dus niet onderscheidend) | verwacht een fout bij een alleen-lezen doel; als root waargenomen: vervangen, mode 444 | afgeleid |
| 30 | Een ontbrekende finish bij een taak met een tijdcomponent in de start wordt "vandaag" (rundatum) | correctheid | laag | src/services/importDates.ts:90-94, :145; src/services/ifc/ifcReader.ts:1330 | `resolveMissingScheduleDates` leidt de finish alleen af als de start geen tijd draagt. Anders blijft de vandaag-plaatshouder staan, ook als die vóór de start ligt. In het script is het een dagtaak (`P5D`) waarvan de start een tijd kreeg door de kalenderpromotie. | `bash audit-repro/run.sh audit-repro/ifc-durations.ts` | verwacht een finish ≥ start (afgeleid) of leeg; waargenomen start `2026-03-02T07:00`, finish `2026-09-28` (rundatum) | zeker |
| 31 | `readP6XML` schaalt superlineair (WBS-opzoekingen per activiteit) | performance | laag | src/services/p6/p6xmlReader.ts:366-367, :617-619, :269, :292 | `wbsTasks.find` per activiteit en per WBS-relatie, `childIds.includes` per kind, `resources.find` per tarief of ouder. | `bash audit-repro/run.sh audit-repro/perf-adapters.ts` | 10k → 20k activiteiten: 1248 → 3465 ms (×2,8), deels door de Node-DOM-shim | afgeleid |
| 32 | MSPDI- en P6-XML-export zijn intern inconsistent: de werkband is 9 u, de dag 8 u | correctheid | hoog | src/services/msproject/mspdiWriter.ts:182-190 (scalaire band) en :353 (`MinutesPerDay`); src/services/p6/p6xmlWriter.ts:157-160 en :338 (`HoursPerDay`) | Een kalender met hoursPerDay 8 en 07–16 (impliciet lunchuur, de standaard "Bouwkalender NL") wordt geschreven als één band 07:00–16:00 plus `MinutesPerDay 480`/`HoursPerDay 8`, en een taak van 5 d als `PT40H`. MS Project/P6 plannen op de banden, dus 40 u = 4,44 werkdag. Dit is ook de oorzaak van rij 10 bij herimport. | `bash audit-repro/run.sh audit-repro/xml-export-calendar-hours.ts` | verwacht een band van 8 u (bijv. met pauze) of 9 u/dag in de kop; waargenomen `MinutesPerDay 480`, maandag `07:00:00–16:00:00` (1 band), `PT40H0M0S`; P6 `HoursPerDay 8`, maandag `07:00:00–16:00:00` | zeker |

## Toelichting per bevinding

**1 — P6-XML genest.** Dit is de ernstigste bevinding. Een echte P6-export opent zonder foutmelding
als leeg project, want alleen kalenders en resources staan op topniveau en die worden wél gelezen.
De bug staat al beschreven in `docs/superpowers/specs/2026-08-14-rapport-critreview-f0.md` (regel
25–48, "B3b"), maar zit nog in deze momentopname. Alle P6-XML-tests (`check-xml-adapter-fidelity`,
`check-adapters-hours`, `check-xer-p6xml-parity`) lezen alleen de platte uitvoer van de eigen writer.

**2 — P6-kalenders.** Ook in de platte vorm verliezen activiteiten hun kalender zodra die geen
Resource-kalender is. In P6 zijn activiteitskalenders juist meestal Global- of Project-kalenders.
De eigen round-trip werkt alleen omdat `p6xmlWriter` elke bibliotheekkalender als `Type=Resource`
schrijft (p6xmlWriter.ts:337).

**3 — Werkende uitzondering.** De writer geeft zelf aan dat werkende uitzonderingen niet uitdrukbaar
zijn (p6xmlWriter.ts:167-172, 234-238). De lezer maakt van P6's eigen werkende uitzonderingen
(`HolidayOrException` met `WorkTime`) echter feestdagen, dus het effect is omgekeerd.

**4 — NL-feestdagen.** De "golden rule" (geen uitzonderingen in het bestand ⇒ laat de defaults staan)
is voor IFC al bewust verlaten (ifcReader.ts:2478-2485: "een .mpp met 0 feestdagen kreeg ze dan bij de
eerste IFC-save alsnog"). Voor MSPDI en P6-XML geldt die regel nog wel. Een Amerikaans MSP- of
P6-bestand krijgt zo Koningsdag, Hemelvaart en dergelijke. Omdat `createDefaultCalendar()` de
instelling Bouwmodus leest (defaultCalendar.ts:22-33), hangt het resultaat van hetzelfde bestand af
van de machine. (De XER-lezer vermijdt dit bewust: xerReader.ts rond regel 562, "geen lokale
appinstelling of feestdagenbron mag zo'n import machine-afhankelijk maken".)

**5/6 — MSPDI-kalenderidentiteit.** De lezer veronderstelt de eigen writer-conventie: UID 1 is de
projectkalender en staat eerst. MS Project geeft de projectkalender aan met `<Project><CalendarUID>`
en schrijft resourcekalenders als afgeleide kalenders met `BaseCalendarUID`. Beide gegevens worden
niet gelezen.

**7 — Descendant-scope.** De scopekeuze is bewust (xmlDom.ts), maar voor velden die ook in
`PredecessorLink` of `Baseline` voorkomen (`Type`, `Start`, `Finish`, `Duration`) pakt een ontbrekend
taakveld het geneste veld. Het script laat dit zien voor `Type`. Voor `Start`/`Finish`/`Duration` uit
`<Baseline>` is hetzelfde mechanisme afgeleid, maar niet apart gedraaid.

**8/9 — Null-taken en naamloze resources.** Dit zijn fantoomobjecten die ook terugkomen bij export
naar IFC.

**10 — Uurmodus-besmetting.** Dit is de belangrijkste round-trip-bevinding voor de XML-adapters.
Eén fractionele taak (in de app makkelijk te maken via "1d 4u", CSV "1,5" of een AI-bewerking)
verandert na MSPDI- of P6-export en herimport de hele planning. De kalender verliest zijn lunchuur
(9 in plaats van 8 u/dag) en alle taken krijgen 08:00 als echte starttijd op een kalender die om
07:00 begint. Na herberekening schuiven datums daardoor. Hetzelfde "banden 07–16 ⇒ 9 u/dag"-effect
is zichtbaar in `audit-repro/out/mspdi-null-task.txt` (16 u → 1,78 dag).

**32 — Inconsistente kalender in de export.** De bron van rij 10: de scalaire dagkalender (werkuren 07–16 met hoursPerDay 8) wordt als één band van 9 u geschreven, terwijl de kop 8 u/dag zegt. Dat MS Project en P6 op de banden plannen (en een `PT40H`-taak dus 4,44 werkdag wordt) is afgeleid; dat de export zo is, is aangetoond. Verwant, niet apart gemeten: `p6xmlWriter.ts:337` schrijft elke bibliotheekkalender, ook taakkalenders, als `Type=Resource`, terwijl P6-activiteiten Global- of Project-kalenders gebruiken (afgeleid).

**11/12 — Afronding.** Zie de tabel. Rij 12 is precies de "stille VOLTOOID-gedragswisseling" die voor
IFC als M3 is gedicht (commentaar in check-ifc-roundtrip.ts), maar die voor de XML-exports nog bestaat.

**13 — Stuurtekens.** Taaknamen komen onder meer uit IFC-imports, MCP en extensies. Eén verticale tab
maakt de hele export onleesbaar voor een XML-parser. De IFC-header saneert dit wel
(ifcWriter.ts:198, `headerText`), de XML-writers niet.

**14/24/31 — Schaalgedrag.** Gemeten op deze gedeelde machine, dus de absolute waarden zijn
indicatief, de verhoudingen niet. De meting bij 24 gebruikte per bibliotheekkalender de standaard
NL-kalender (createDefaultCalendar). De XER-lezer is ter vergelijking gemeten en schaalt lineair
(`audit-repro/out/perf-xer.txt`: 2500 → 20000 taken, 264 → 1536 ms).

**15–19 — IFC-interoperabiliteit.** Onze eigen round-trip is consistent (writer en reader delen
dezelfde afwijkende posities), maar het bestand is geen schemageldig IFC4X3. Bij 17 en 18 is het
schema-attribuutaantal gebaseerd op de IFC4-EXPRESS-definities van IfcWorkControl (7 eigen attributen
plus IfcControl/IfcObject/IfcRoot = 13, plus PredefinedType = 14), IfcWorkCalendar (9) en
IfcConstructionResource-subtypes (11). Dat komt uit kennis van de standaard, niet uit een
geraadpleegde bron; vandaar "afgeleid" voor de conformiteitsclaim. Het gedrag van de lezer bij 18
(`.PLANNED.` als einddatum, kalender gewist) is wel aangetoond.

**20/21 — Vreemde IFC-invoer.** Zonder schema- of vormcontrole leidt onbekende invoer tot stille
standaardwaarden (5 dagen, vandaag, duur 0) in plaats van een melding.

**22 — Offsets.** Laag, omdat MSPDI, XER en de eigen writers geen offsets schrijven. Het raakt IFC-,
P6- of MSPDI-bestanden van derden die `xsd:dateTime` met een zone gebruiken. De tijdzone van de
machine speelt geen rol: de uitvoer is identiek onder `TZ=Pacific/Kiritimati`. De datum-helpers zijn
consequent UTC; een zoektocht naar lokale `Date`-getters in `src/services` vond alleen `localTodayIso`.

**25–28 — CSV.** Bij 25 breekt de eigen export → import round-trip zodra een omschrijving of naam een
regeleinde bevat. Bij 26 en 27 gaat het om gangbare Excel-uitvoer (en-US-datums, ANSI-codering).

**29.** Kon niet onderscheidend gedraaid worden omdat de sandbox als root draait. Een poging om als
niet-root te draaien is door het permissiesysteem geweigerd en niet verder gevolgd.

**30.** Klein, maar het is precies het "verzonnen vandaag"-patroon dat elders in de code bewust wordt
vermeden.

## Onderzocht zonder bevinding (kort)

- XER-lezer: lineair tot 20k taken met relaties en toewijzingen (`perf-xer.ts`).
  `decodeXerCalendarData` gefuzzd met 20.000 mutaties (`fuzz-xer-calendar.ts`): alleen
  `XerCalendarDataError` (netjes als issue afgevangen in `readXerCalendars`, xerCalendarData.ts:820
  e.v.), geen hangs.
- ZIP/XLSX: begrensde inflatie per chunk, CRC-controle, Zip64-weigering, serieel 60 en het
  1904-stelsel zijn correct afgehandeld (code gelezen, niet gefuzzd).
- MPP/CFB: alle lussen zijn begrensd door de echte bestandsgrootte (cfb.ts), en de datums zijn
  UTC-verankerd (mppPrimitives.ts:484). Door tijdgebrek niet gefuzzd; zonder echt `.mpp`-bestand in
  de repo zou een fuzz alleen de containerlaag raken.
- PDF: ongedekte glyphs vallen bewust terug op raster (pdfVectorDraw2d.ts:503-505). Niet headless
  gedraaid.
- Id-normalisatie IFC: `stableIfcTaskId` (ifcReader.ts:1275) ontdubbelt met `-dup-N`, `isValidPersistedIfcId` (ifcReader.ts:1267) weigert stuurtekens en te lange id's, en `guidOf` (ifcWriter.ts:124) lost GlobalId-botsingen op. Gelezen, geen bevinding.
- `audit-repro/smoke.ts` is alleen de harnascontrole (IFC lezen → schrijven → lezen van een voorbeeld), geen bevinding.
- Bekende, bewuste zaken niet opnieuw gemeld: de grootte en auto-save-kosten van het XER-bronarchief
  (docs/xer-recovery-guardrails.md) en de KNOWN_GAPS in check-ifc-roundtrip.ts.

## Kanttekeningen bij de methode

- De XML-scripts gebruiken een eigen DOM-shim (`audit-repro/xmlshim.ts`) in plaats van de
  browser-DOMParser. De bevindingen hangen af van element-scope en -volgorde, en daarin gedraagt de
  shim zich als de browser. `children` is gecachet (O(1)), omdat een eerdere versie van de shim zelf
  kwadratisch was (die run is afgebroken en telt niet mee). De absolute tijden van de XML-lezers in
  `perf-adapters.ts` zijn daardoor geen browsertijden; de writer-meting (14) staat los van de shim.
- `loadConstructionMode()` valt in Node zonder localStorage terug op de standaard (aan), net als bij
  een nieuwe installatie.
- Bestaande bestanden zijn niet gewijzigd. De volledige suite en `npm run verify` zijn niet
  gedraaid, alleen de eigen scripts.

**Verklaring (één regel):** geen WebSearch/WebFetch, geen GitHub-/andere MCP-tools, geen subagents, geen git-archeologie buiten de snapshot gebruikt; alleen binnen /home/user/audit/w2 gelezen en geschreven (node_modules alleen via de symlink voor esbuild/Node), niets buiten audit-repro/ gewijzigd.
