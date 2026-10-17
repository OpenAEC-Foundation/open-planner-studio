# Nakijksleutel import/export-audit — basis 8e3bcf4c (staat vóór PR #241)

Bron: `git show <sha>` van de fix-commits in `8e3bcf4c..33cb1350^2` en de code op `8e3bcf4c`.
Alle regelnummers zijn regels **op 8e3bcf4c**.

## Hoe dit is vastgesteld

- De boom van 8e3bcf4c is met `git archive` naar een scratchmap uitgepakt (repo niet gewijzigd). Per fix is
  het testbestand **uit de fix-commit** tegen de **basiscode** gebundeld en gedraaid (zelfde esbuild-aanroep als
  `tests/planning/run.sh`). Waar de test een symbool importeert dat op de basis niet bestaat, is een eigen
  probe geschreven met alleen basis-API's. "Bewezen op basis" hieronder = zo'n run of probe faalde/liet de
  fout zien op 8e3bcf4c.
- Waar de commitboodschap iets beweert wat de probe op de basis níét laat zien, volgt deze sleutel de probe
  (zie G14/G15).
- Twee van de opgegeven commits (1de05309, beide delen, en 73fbadd3) repareren fouten die pas **binnen**
  PR #241 zijn ontstaan en op 8e3bcf4c niet bestaan; hetzelfde geldt voor de niet-opgegeven range-commit
  0a93b889, en het crlf-deel van 26356bf6 is alleen een test. Die staan onderaan onder "Niet aanwezig op
  8e3bcf4c" en tellen **niet** mee.

## Overzicht (tellende bugs)

| ID | Commit | Categorie | Locatie op 8e3bcf4c | Minimale trigger | Waargenomen vs verwacht | Test in fix-commit | Zekerheid |
|---|---|---|---|---|---|---|---|
| G1 | a82ccd52 | dataverlies | `src/services/csv/csvReader.ts:217` (`readCSV`: `clean.split(/\r?\n/)` vóór quote-parsing) | CSV-cel tussen quotes met een regeleinde, bv. omschrijving `"Regel 1\nRegel 2"` (die `escapeCSV` zelf zo schrijft) | Record wordt op fysieke regels geknipt: extra taak "Task", omschrijving afgekapt, volgende kolommen/rijen verschoven. Verwacht: één record, cel heel | `tests/planning/check-csv-import.ts` 5a, 5d | zeker (5a/5d rood op basis) |
| G2 | a82ccd52 | correctheid | `csvReader.ts:67` (`parseCSVLine`: `"` opent overal een quote-veld, niet alleen aan veldbegin) | Ongequote cel met losse `"` midden in, bv. `1;Pijp 5";3` | Naam wordt `Pijp 5;3`, scheidingsteken opgeslokt, duur-kolom leeg. Verwacht: naam `Pijp 5"`, duur 3 | `check-csv-import.ts` 5c | zeker (5c rood op basis) |
| G3 | a82ccd52 | dataverlies | `src/services/csv/csvWriter.ts:141-142` (`writeCSV`: taaktypenaam en `customTaskTypeId` zonder `escapeCSV`) | Eigen taaktype met `;` (of `,`/`"`/regeleinde) in de naam, exporteren naar CSV | Kolommen na het taaktype schuiven; na terug-inlezen: type-id `prefab`, omschrijving `0`. Verwacht: veld gequote, kolommen intact | `check-csv-import.ts` 5b | zeker (5b rood op basis) |
| G4 | a82ccd52 | correctheid | `csvReader.ts:263` (`Number.parseFloat(recordedFloatRaw)` i.p.v. `readCsvNumber`) | CSV met kolom Total Float = `2,5` (decimale komma) | Vastgelegde speling 2. Verwacht 2,5 | `check-csv-import.ts` 5e | zeker (5e rood op basis) |
| G5 | 2f799f04 | dataverlies | `src/services/ifc/ifcReader.ts:1348` (taaknaam), `:1911` (resourcenaam), `:2344` (kalendernaam), `:2446` (feestdagnaam), `:2474` (werkende uitzondering) — kale `stripQuotes` i.p.v. `ifcSlotText` (`:929`) | Lege naam op taak/resource/kalender/feestdag/uitzondering; opslaan als IFC (writer schrijft STEP-null `$`) en weer openen | Naam wordt letterlijk `"$"` (truthy, dus terugval "Naamloze taak"/"Feestdag" grijpt niet). Verwacht: lege naam of de terugval | `tests/planning/check-import-namen-werkweek.ts` case "1 geen letterlijke "$" als naam" | zeker (rood op basis: `["$","$","$","$"]`) |
| G6 | 2f799f04 | correctheid | `src/services/msproject/mspdiReader.ts:923` (`applyCalendarBody`: filter alleen op ouder `WeekDays`, niet op grootouder = `<Calendar>`); bijkomend `:948` (scalaire uren uit eerste `WorkingTime` van de hele kalender) | MSPDI-kalender met `<WorkWeeks><WorkWeek>…<WeekDays><WeekDay>` (tijdelijke werkweek, bv. zomerrooster met zaterdag) | Zaterdag wordt permanente werkdag van de standaardweek (`workDays` [1..6]). Verwacht [1..5] | `check-import-namen-werkweek.ts` case "2 zaterdag uit een tijdelijke werkweek…" | zeker voor de werkdag-lek; scalaire uren (`:948`) afgeleid — de case "2 de standaarduren…" is op de basis groen |
| G7 | 0f07f6fc | correctheid | `src/services/importDates.ts:31` (`importDateTime`) en `:43` (`importStatusDate`) via `parseInstant`; zelfde patroon `ifcReader.ts:1187` (`applyHourModeIFC`/`toHour`), `mspdiReader.ts:683` (timephased), `src/services/p6/p6xmlReader.ts:767` (curve-ankers) | Datum-tijd met offset in bestand, bv. MSPDI `<Start>2026-03-09T09:30:00+01:00</Start>` | Offset wordt toegepast: start 08:30 i.p.v. 09:30; `00:30+01:00` → vorige dag 23:30; statusdatum 16:00 i.p.v. 17:00. Onafhankelijk van TZ van de machine (gemeten in UTC, Amsterdam, New York). Verwacht: wandklok, offset negeren | `tests/planning/check-import-tz-offset.ts` (unit-cases + "MSPDI: start/einde als wandklok"); bundelt niet op basis (`parseImportedInstant` ontbreekt) | zeker voor `importDateTime`/`importStatusDate`/MSPDI-taakdatums (eigen probe); IFC-uurvelden, MSPDI-timephased en P6-curve-ankers afgeleid (zelfde `parseInstant`, niet los gedraaid) |
| G8 | 596dd355 | correctheid | `formatDate(new Date())` (UTC-velden, `src/utils/dateUtils.ts:55`) als "vandaag"-terugval bij import: `importDates.ts:23` (`isoDatePrefixOrToday`), `:30` (`importDateTime`), `:62` (`csvDateOrToday`), `:134` (`resolveMissingScheduleDates`); `ifcReader.ts:952` (`parseDateFromIFC`), `:1330` (taak zonder IfcTaskTime); `src/services/mpp/mppReader.ts:797`, `:975`; `p6xmlReader.ts:812` | Import van een bestand met ontbrekende datum, terwijl lokale tijd en UTC op een andere kalenderdag staan (NL 00:00–02:00; VS 's avonds) | Terugvaldatum = UTC-dag (gisteren/morgen). Verwacht: lokale kalenderdag (`localTodayIso`) | `tests/planning/check-vandaag-lokaal.ts` test alleen de helpers, geen importpad | zeker voor `isoDatePrefixOrToday` (probe op basis: onder TZ=Etc/GMT-14 gaf hij `2026-09-28` terwijl de lokale datum `2026-09-29` was); overige plekken afgeleid (zelfde `formatDate(new Date())`) |
| G9 | 596dd355 | correctheid | `src/services/print/printPreview.ts:1161-1162` (`renderReport`: `dateToX(new Date())` op een as van UTC-middernachten) | Print/PDF-export tussen 00:00–02:00 (NL) of 's avonds (VS) | Vandaag-lijn in de kolom van gisteren/morgen. Verwacht: lokale dag en wandklok | `check-vandaag-lokaal.ts` (alleen helper `localNowOnDayAxis`) | afgeleid |
| G10 | bcf88d01 | dataverlies | `ifcReader.ts:860` (`parseSTEP`: `.replace(/\r\n/g, '\n')` over de hele datasectie, ook binnen strings) | Taaknaam met `\r\n` (bv. uit CSV/MSPDI-import), opslaan als IFC en openen | Naam komt terug met `\n`. Verwacht: byte-gelijk. (Notities zitten in JSON-psets en zijn niet geraakt.) | `tests/planning/check-ifc-crlf.ts` "taaknaam met CRLF ongewijzigd" (26356bf6 voegt een '0.1'-bestandcase toe) | zeker (rood op basis) |
| G11 | 283f5de5 | compatibiliteit | `src/services/ifc/ifcPsets.ts:113-116` (`ifcStr`: alleen `'`→`''`); `src/services/ifc/ifcWriter.ts:222` (IFCAPPLICATION '0.1') | Tekst met niet-ASCII (é, €, 中, emoji), regeleinde/tab of backslash (`C:\temp`) opslaan als IFC | Rauw in de STEP-string: `'C:\temp é ''t'`. ISO 10303-21 staat alleen afdrukbaar ASCII toe en `\` is een escape: andere pakketten tonen verminkt of lezen ongeldig. Verwacht: `\X2\…\X0\`/`\X4\…\X0\`, `\\` | `tests/planning/check-ifc-step-encoding.ts` "geschreven bestand is zuiver ASCII", "IFCAPPLICATION draagt het formaatteken" | zeker (eigen probe toont rauwe regel) |
| G12 | 283f5de5 | compatibiliteit | `ifcReader.ts:155` (`readIFC` na `parseSTEP`, geen decodeerstap) / `:919` (`stripQuotes` doet alleen `''`→`'`) | IFC van een ander pakket met gecodeerde tekst, bv. naam `'Caf\X2\00E9\X0\'` of `'C:\\temp'` | Naam letterlijk `Caf\X2\00E9\X0\` resp. `C:\\temp`. Verwacht: `Café`, `C:\temp` | `check-ifc-step-encoding.ts` sectie 4 "ander pakket: taaknaam/projectnaam gedecodeerd" | zeker (eigen probe op basis) |
| G13 | 93a9903e | compatibiliteit | `ifcWriter.ts:36` (`ifcGuid`: 32-bits hash) gebruikt door `guidOf` `:124` | Elke IFC-export | GlobalId is geen conforme IFC-GUID: eerste teken niet beperkt tot `0`–`3` (probe: taken en project niet conform), maar 32 bits entropie (botsingskans). Verwacht: 128-bit, 22 tekens, eerste teken 0–3 | `tests/planning/check-ifc-globalid.ts` secties 1–2 ("nieuwe taken: conform", "project: conform GlobalId") | zeker (probe) |
| G14 | 93a9903e | compatibiliteit | `ifcWriter.ts:124` (`guidOf` hasht altijd het interne id), aanroepen `:237` (IFCPROJECT) en `:1121` (IFCTASK); lezer levert geen GlobalId-kaart mee (`readIFC`, `ifcReader.ts:1275` `stableIfcTaskId` zet id = `task-ifc-<GlobalId>`) | IFC van een ander pakket (of met een afwijkend GlobalId) openen en opslaan | Taak- en project-GlobalId uit het bronbestand vervangen door een hash van het interne id (probe: `3jp7…` → `9jp7…`; vreemd taak-GlobalId niet behouden). Verwacht: bron-GlobalId blijft. **Let op:** voor een door OPS zelf geschreven bestand bleef het project-GlobalId in de probe stabiel over twee rondes — de claim in de commitboodschap ("verschoof bij elk openen en opslaan") is op de basis niet gereproduceerd | `check-ifc-globalid.ts` sectie 4 "bestaande taak houdt haar oude GlobalId" | zeker voor vreemde GlobalIds (probe); projectdrift bij OPS-bestanden: niet gereproduceerd |
| G15 | 26356bf6 | compatibiliteit | `ifcWriter.ts:257` (IFCWORKPLAN, seed `project.id+'_wp'`) en `:260` (IFCWORKSCHEDULE, seed `project.id+'_ws'`) | Vreemd IFC openen en opslaan | GlobalId van werkplan/werkschema (anker voor 4D-koppelingen) vervangen door hash (probe: `3BXL…`→`FBXL…`, `3vAv…`→`ovAv…`). Bij eigen OPS-bestanden bleven ze stabiel. Zelfde mechanisme als G14, andere entiteiten | `check-ifc-globalid.ts` sectie 11 | zeker voor vreemde bestanden (probe) |
| G16 | ef12bed3 | compatibiliteit | `ifcReader.ts:1580` (`extractSequences`: `generateId('seq')`), `:1905` (`extractResources`: `generateId('res')`), `:2568` en `:2602` (`extractCalendarLibrary`: `generateId('rescal')`) | Elk IFC met resources, bibliotheekkalenders of relaties openen en opslaan | Nieuw intern id bij elk openen ⇒ nieuw GlobalId bij elk opslaan (probe: res/cal/seq-GlobalIds ronde 1 én 2 ≠ origineel; id's per open verschillend). Verwacht: stabiel id/GlobalId over open+opslaan | `check-ifc-globalid.ts` sectie 7 (+ 8, 9); `check-contour-engine.ts` tweede ronde | zeker (probe) |
| G17 | ef12bed3 | correctheid | `ifcWriter.ts:124-133` (`guidOf`-cache `ctx.guids` gesleuteld op het kale seed), aanroepen met kale id's: `:237` project, `:902` kalender, `:1121` taak, `:1173` relatie, `:1204` resource | Objecten van verschillende soort met hetzelfde id — typisch na XER-import (`task_id`, `clndr_id`, `task_pred_id`, `proj_id` zijn kale getallen) — en dan als IFC opslaan | Ze krijgen hetzelfde GlobalId uit de cache (probe: IFCPROJECT, IFCTASK, IFCRELSEQUENCE en IFCWORKCALENDAR delen één GlobalId). Verwacht: uniek GlobalId per object. Gevolgen bij terug-inlezen (bv. GUID→id-tabellen) onbekend | `check-ifc-globalid.ts` sectie 6 "XER-id-botsing: elk GlobalId in het bestand uniek" | zeker voor de dubbele GlobalIds (probe); dat een echte XER-import zo'n botsing oplevert is afgeleid |
| G18 | 0768132b | compatibiliteit | `ifcWriter.ts:124` (`guidOf` zonder projectzout) met vaste seeds: `:275` `agg_ps`, `:297` `nest_root`, `:336` `ctrl`, pset-seeds (bv. `:536` `pset_projset`, `:547` `pset_structmeta`), en `:902` voor de projectkalender (`cal-default` in elk project) | Twee verschillende projecten als IFC opslaan | 8 GlobalIds identiek in beide bestanden (probe: IFCWORKCALENDAR, IFCRELAGGREGATES, IFCRELNESTS, IFCRELASSIGNSTOCONTROL, psets/rels). Verwacht: geen gedeelde GlobalIds tussen projecten | `check-ifc-globalid.ts` sectie 10 "twee projecten: geen gedeelde GlobalIds" | zeker (probe) |
| G19 | 5787faa6 | correctheid | `src/state/slices/fileSlice.ts:436-439` (`applyLoadedProject`: `payloadFromImport(parsed, …)` zonder uniciteitscontrole van id's) | Een `ImportResult` met twee taken/relaties/resources/kalenders/toewijzingen met hetzelfde id, of een bibliotheekkalender met het id van de projectkalender | Store sleutelt op id: objecten worden door elkaar gehaald, geen melding. Verwacht: dubbelen hernoemd (`-dup-N`) + melding | `tests/planning/check-import-unique-ids.ts` secties 2–3 (bundelt niet op basis) | afgeleid — geen ingebouwde lezer op de basis gevonden die dubbelen levert (IFC ontdubbelt taken in `stableIfcTaskId`, XER weigert dubbele id's, MSPDI/P6/CSV gebruiken `generateId`); concrete bestandstrigger onbekend |
| G20 | 0b8f622a | correctheid | `src/services/importNormalize.ts:126` (`outlineParents`: `Math.min(...levels)`), via `rebuildImportedHierarchy` `:202` uit `csvReader.ts:403` en `mspdiReader.ts:567` | CSV of MSPDI met outline-niveaus en zeer veel taken | `RangeError: Maximum call stack size exceeded`, import breekt af. Gemeten in Node (deze machine): 125 000 elementen ok, 150 000 RangeError; drempel in browser/Tauri onbekend. De `mppReader`-plekken (`Math.max/min` over per-taak-arrays) zijn in de praktijk niet zo groot | `tests/planning/check-minmax-spread.ts` (toetst alleen de helpers `minOf`/`maxOf`, niet de importplek) | afgeleid voor de importplek; spreadgrens gemeten |
| G21 | a2b39d4c | performance | `ifcReader.ts:2044-2051` (`opsCalendarPsetProps`: per kalender alle entiteiten doorlopen en elke `IFCRELDEFINESBYPROPERTIES` opnieuw `parseRefs`), aangeroepen door zes kalenderlezers (`:2072`, `:2114`, `:2148`, `:2165`, `:2190`, `:2268`) | Groot IFC met meerdere kalenders | O(kalenders × entiteiten × 6); commit meet 8000 taken + 13 kalenders: readIFC 1,3 s → 0,6 s. Verwacht: één index doel→relaties | geen | afgeleid (meting uit commitboodschap, niet herhaald) |
| G22 | a2b39d4c | performance | `importNormalize.ts:95-110` (`rebuildWbsHierarchy`: `tasks.find` per taak `:107` en `parent.childIds.includes`) | MSPDI/CSV-import met veel taken met een WBS-code met punt (platte WBS: veel kinderen onder één ouder) | O(n²). Verwacht lineair | geen | afgeleid |
| G23 | 02cb4690 | performance | `src/services/print/printPreview.ts:316-336` (`buildPrintRows`: `tasks.filter(t => t.parentId === task.id)` per taak `:331`, `tasks.filter` roots `:333`, `printRows.some(...)` per taak `:335`) | Print/PDF-voorbeeld van een groot project (commit: ~1,3 s per aanroep bij 10k taken, 1–3 aanroepen per pagina) | O(n²). Verwacht lineair | geen | afgeleid (meting uit commitboodschap) |

Telling: correctheid 9 (G2, G4, G6, G7, G8, G9, G17, G19, G20), dataverlies 4 (G1, G3, G5, G10),
compatibiliteit 7 (G11–G16, G18), performance 3 (G21–G23). Totaal 23.

## Matchcriteria per bug

Algemeen: een bevinding telt als "gevonden" als ze de **locatie** (bestand + functie, of een aanroepplek uit de
kolom) én het **mechanisme** noemt. Alleen een functie of bestand noemen ("csvReader is fragiel",
"GlobalIds zijn niet goed") telt niet. Eén bevinding matcht met hoogstens één G-rij, behalve waar hieronder
expliciet anders staat.

- **G1** — moet noemen: `readCSV` splitst op regeleinden vóór de quote-parsing, dus een gequote cel met
  regeleinde breekt het record. Niet: "CSV-parser volgt RFC 4180 niet" zonder het regeleinde-mechanisme.
- **G2** — moet noemen: `parseCSVLine` opent een quote-veld bij elke `"`, ook midden in een ongequote cel,
  waardoor het scheidingsteken wordt opgeslokt. Niet: G1 (regeleinde) — die is anders. Op de basis is dit een
  eigen mechanisme met eigen uitkomst (`Pijp 5;3`); de commit bundelt het met G1.
- **G3** — moet noemen: `writeCSV` schrijft de (eigen) taaktypenaam/-id zonder `escapeCSV`. Niet: algemene
  "CSV-export escapet niet" zonder het taaktypeveld (andere velden gaan wél door `escapeCSV`).
- **G4** — moet noemen: vastgelegde Total Float/speling via `parseFloat` ⇒ decimale komma afgekapt. Niet:
  decimale komma bij andere kolommen (die gaan al via `readCsvNumber`).
- **G5** — moet noemen: IFC-lezer leest lege namen (STEP `$`) via `stripQuotes` terug als letterlijke `"$"`;
  minstens één van taak/resource/kalender/feestdag/uitzondering. Niet: omschrijvingen/projectnaam (die gaan al
  via `ifcSlotText`).
- **G6** — moet noemen: MSPDI-lezer telt `WeekDay`s uit `<WorkWeeks><WorkWeek>` (tijdelijke werkweek) mee als
  standaardweek. Een bevinding die alléén de scalaire uren uit het eerste `WorkingTime` van de hele kalender
  noemt, telt ook (zelfde functie, zelfde oorzaak: niet beperken tot de standaardweek).
- **G7** — moet noemen: bij import wordt een tijdzone-offset (`Z`/`±hh:mm`) toegepast (`parseInstant`) terwijl
  het model wandklok rekent / de dag-uurbeslissing de offset negeert; minstens één van de genoemde plekken.
  Niet: algemene "datums zonder tijdzone" of UTC-vs-lokaal bij *vandaag* (dat is G8).
- **G8** — moet noemen: de "vandaag"-terugval bij import gebruikt `formatDate(new Date())` = UTC-dag i.p.v.
  lokale dag; minstens één importplek. Niet: G9 (print) of alleen UI-plekken (Gantt-lijn, Ctrl+Home,
  MoveProjectDialog vallen buiten deze audit).
- **G9** — moet noemen: de vandaag-lijn in print/PDF (`renderReport`) staat op het UTC-moment op een
  UTC-middernacht-as ⇒ verkeerde dagkolom rond middernacht. Niet: de Gantt-vandaaglijn op scherm.
- **G10** — moet noemen: `parseSTEP` normaliseert `\r\n`→`\n` over de hele datasectie, ook binnen
  stringliterals. Niet: "CRLF-bestanden worden niet gelezen" (die worden wél gelezen).
- **G11** — moet noemen: de IFC-writer (`ifcStr`) codeert niet-ASCII/backslash/regeleindes niet volgens
  ISO 10303-21 (`\X2\`, `\\`). Niet: G12 (lezerkant).
- **G12** — moet noemen: de IFC-lezer decodeert STEP-escapes (`\X2\…\X0\`, `\X4\`, `\\`, `\S\`) niet, dus tekst
  uit andere pakketten blijft gecodeerd. Een bevinding die beide kanten noemt, matcht G11 én G12.
- **G13** — moet noemen: `ifcGuid` is een 32-bits hash en geen conforme IFC-GUID (vorm/eerste teken en/of
  botsingskans). **Een generieke bevinding "ifcGuid is zwak / geen echte GUID" matcht alleen G13**, niet
  G14–G18.
- **G14** — moet noemen: bij opslaan wordt het GlobalId uit het ingelezen bestand niet teruggeschreven; de
  writer hasht het interne id, dus taak-/project-GlobalIds uit een (vreemd) bronbestand gaan verloren.
  Een bevinding "writer bewaart GlobalIds uit het bronbestand niet" zonder entiteittypes te noemen matcht G14;
  noemt ze ook werkplan/werkschema, dan óók G15. Niet: "project-GlobalId verschuift bij elk opslaan van een
  OPS-bestand" als enig bewijs — dat is op de basis niet gereproduceerd.
- **G15** — moet noemen: IFCWORKPLAN/IFCWORKSCHEDULE krijgen altijd een hash-GlobalId (geen behoud uit het
  bronbestand). Alleen G14 vinden telt niet automatisch als G15.
- **G16** — moet noemen: de IFC-lezer geeft resources en/of bibliotheekkalenders en/of relaties bij elk openen
  een nieuw `generateId`, waardoor hun GlobalId bij elk open+opslaan verandert. Niet: G14 (dat gaat over
  behoud van het bron-GlobalId, niet over id-regeneratie).
- **G17** — moet noemen: `guidOf` cachet op het kale id zonder soort, zodat objecten van verschillende soort met
  hetzelfde id (XER-getallen) één GlobalId delen ⇒ dubbele GlobalIds. Niet: de algemene hash-botsingskans van
  `ifcGuid` (= G13).
- **G18** — moet noemen: vaste seeds (`cal-default`, `agg_ps`, `ctrl`, `nest_root`, psets) ⇒ dezelfde GlobalIds
  in elk project/bestand. Niet: G13.
- **G19** — moet noemen: bij openen worden id's uit het bestand niet op uniciteit gecontroleerd terwijl de store
  op id sleutelt (dubbele id's worden door elkaar gehaald). `applyLoadedProject` hoeft niet genoemd te worden;
  een willekeurige plek in de openroute of de lezer volstaat. Lage vindbaarheid (geen bekende bestandstrigger).
- **G20** — moet noemen: `Math.min(...)`/`Math.max(...)`-spread over een array ter grootte van het aantal
  taken (outline-niveaus bij CSV/MSPDI-import) ⇒ stack-overflow bij grote bestanden. Niet: dezelfde spread in
  `applyCpmResult`/`documents.ts`/`ResourceLeveler` (geen import/export).
- **G21** — moet noemen: kalender-psetlezing in `readIFC` scant per kalender (en per lezer) alle entiteiten /
  parseert elke relatie opnieuw (geen index). Niet: "readIFC is traag" zonder dit mechanisme.
- **G22** — moet noemen: `rebuildWbsHierarchy` doet `tasks.find` en/of `childIds.includes` per taak ⇒ O(n²).
- **G23** — moet noemen: `buildPrintRows` doet per taak `tasks.filter` en/of `printRows.some` ⇒ O(n²).

## Toelichting per bug

**G1–G4 (a82ccd52, CSV).** Op de basis faalt `check-csv-import.ts` uit de fix-commit op 5a–5e (8 afwijkingen).
G1: `WBS;Name;Description\n1;A;"x\r\ny"\n2;B;z` → `[["A","x"],["Task",""],["B","z"]]`. G2 is een apart
mechanisme in `parseCSVLine` (niet in de regelsplitsing) en valt op met een enkele regel zonder regeleinde; de
gebruiker telde a82ccd52 als drie bugs, deze sleutel telt er vier. G3 is de enige exportfout in deze groep.

**G5/G6 (2f799f04).** `check-import-namen-werkweek.ts` op de basis: 2 van 6 rood (namen `"$"`, zaterdag lekt).
De case over de standaarduren is op de basis groen, omdat de writer de standaardweek vóór de ingevoegde
`WorkWeeks` zet; de scalaire-urenfout is daarom alleen uit de code afgeleid.

**G7 (0f07f6fc).** Eigen probe op de basis: `importDateTime('2026-03-09T00:30:00+01:00', true)` →
`2026-03-08T23:30`; `…09:30:00-05:00` → `14:30`; `importStatusDate('…17:00:00+01:00')` → `16:00`; MSPDI-taak met
`09:30+01:00`/`15:30+01:00` → `08:30`/`14:30`. Gelijk in TZ=UTC, Europe/Amsterdam en America/New_York.

**G8/G9 (596dd355).** `formatDate` leest UTC-velden (`dateUtils.ts:55-61`). De fix-commit raakt ook UI-plekken
(Gantt-lijn, `computeScrollToDate`, MoveProjectDialog, rapportperiode, MCP, projectstart); die vallen buiten
deze import/export-sleutel. De test toetst alleen de nieuwe helpers. Probe op de basis: onder TZ=Etc/GMT+12
en TZ=Etc/GMT-14 (samen 26 uur, dus altijd één afwijkende dag) gaf `isoDatePrefixOrToday('')` beide keren de
UTC-datum `2026-09-28`, terwijl de lokale datum onder GMT-14 `2026-09-29` was. G9 (print) is niet gedraaid.

**G10 (bcf88d01).** `check-ifc-crlf.ts` op de basis: 1 van 3 rood (taaknaam `Regel 1\r\nRegel 2` →
`Regel 1\nRegel 2`). Notitie en een volledig CRLF-bestand waren al goed.

**G11/G12 (283f5de5).** Probe: de writer schrijft `#61=IFCTASK('…',#6,'C:\temp é ''t',…)`; de lezer geeft
`Caf\X2\00E9\X0\` en `C:\\temp` letterlijk terug, zowel voor een bestand met OPS-kenmerken als voor een
"ander pakket". Twee rijen omdat writer en lezer los van elkaar fout zijn.

**G13–G18 (GlobalIds: 93a9903e, 26356bf6, ef12bed3, 0768132b).** Probe op de basis:
conformiteit onwaar voor taken en project (G13); vreemd project/taak/werkplan/werkschema-GlobalId vervangen,
maar OPS-eigen project- en werkschema-GlobalIds stabiel over twee rondes (G14/G15 — de commitboodschap van
93a9903e zegt dat het project-GlobalId bij elk openen/opslaan verschoof; dat is hier niet gereproduceerd);
resource-, kalender- en relatie-GlobalIds en -id's anders bij elke ronde (G16); bij id `1234` voor taak,
relatie, kalender en project delen vier entiteiten één GlobalId (G17); twee nieuwe projecten delen 8 GlobalIds
(G18). De tests uit de fix-commits importeren `ifcGuid128`/`ifcObjectSeed` en bundelen niet op de basis.

**G19 (5787faa6).** Basis: `applyLoadedProject` geeft het resultaat ongewijzigd door aan `payloadFromImport`.
Welk ingebouwd bestandsformaat op de basis dubbele id's oplevert, is niet gevonden; de test bouwt een
synthetisch `ImportResult` (drie taken met één id; bibliotheekkalender met het projectkalender-id). Mogelijke
bronnen zoals extensie-importers: niet onderzocht.

**G20 (0b8f622a).** Alleen `outlineParents` is een realistische importtrigger (array = één niveau per taak). De
commit raakt ook `applyCpmResult`, `ResourceLeveler` en `documents.ts` (geen import/export).

**G21–G23 (a2b39d4c, 02cb4690).** Alleen performance; geen test. De metingen komen uit de commitboodschappen en
zijn niet herhaald.

## Verbetering, geen bug — telt NIET mee

- **a2b39d4c, `splitArgs`** (`ifcReader.ts:881`): bouwde elk argument teken voor teken op i.p.v. te snijden.
  Constante factor (commit: 2,3× in een microbenchmark), geen complexiteitsverschil en geen fout gedrag. Een
  auditor die dit noemt, verdient geen punt en geen aftrek.

## Niet aanwezig op 8e3bcf4c — telt NIET mee

Deze commits staan in de opgegeven lijst of in de range, maar repareren een fout die pas binnen PR #241 is
ontstaan. Een auditor van 8e3bcf4c kan ze niet vinden.

| Commit | Wat de commit repareert | Waarom niet op de basis |
|---|---|---|
| 1de05309 (deel 1) | CSV `1, "Fundering, noord",5`: spatie na scheidingsteken sloot het veldbegin af, dus split op de komma in de naam | Ingevoerd door de `fieldStart`-regel van a82ccd52. Probe op de basis: `1, "Fundering, noord",5` → `[" Fundering, noord",5]` (goed). Case 5f/5g faalt op de basis alleen door G1 (regeleinde in de tweede rij) |
| 1de05309 (deel 2) | `ensureUniqueImportIds`: hernoemde dubbele taak stond niet in de kindlijst van haar ouder | `ensureUniqueImportIds` bestaat pas sinds 5787faa6 (G19); op de basis is er geen hernoeming |
| 73fbadd3 | JSON-psets met `\X2\…\X0\` braken oudere app-versies (ongeldige JSON-escape ⇒ baselines/notities weg) | Ingevoerd door 283f5de5 (STEP-codering). Op de basis worden JSON-psets letterlijk geschreven, zoals oudere versies verwachten |
| 0a93b889 (niet in de lijst; bekeken) | IFC-paneel gaf `ifcGlobalIds` niet mee aan de writer | Het veld `ifcGlobalIds` bestaat pas sinds 93a9903e; op de basis bestaat geen GlobalId-behoud om te vergeten (valt onder G14) |
| 26356bf6 (crlf-deel) | Alleen een extra test ('0.1'-bestand met rauwe CRLF) | Geen nieuwe fout; dekt G10 |

## Range-commits bekeken, niet opgenomen

`git log --no-merges 8e3bcf4c..33cb1350^2` is doorgelopen op import/export-fixes die in de lijst ontbreken. Geen
toegevoegd. Grensgevallen:

- **0a93b889** fix(ifc) IFC-paneel geeft bewaarde GlobalIds mee — regressie binnen de PR (zie hierboven).
- **071b2c56** fix(mcp) move_project valideert newStartDate — MCP-invoervalidatie; de ruwe string belandt wel in
  het IFC, maar via een toolaanroep, niet via import of een formaatadapter.
- **9cb0adf4** fix(motor) P6-crash bij FF dag→uur — rekenmotor/conventie, geen bestandsformaat.
- **d8261f31** fix(gantt) uurbalken > 1 jaar afgekapt — `workIntervalsBetween` wordt op 8e3bcf4c alleen door
  `GanttRenderer` aangeroepen (grep), niet door print/export.
- **896f19b4** perf(documenten) documentwissel — auto-save serialiseerde na elke wissel opnieuw naar IFC; oorzaak
  is documentactivatie (nieuwe arrays), niet de IFC-writer of -lezer.
- **03ea748c** fix(autosave) valse 'niet schrijfbaar' / **6db6e86d** sluiten vraagt om opslaan / **9153a081**,
  **441f4101**, **c1a5c87b** herstel — opslag- en herstelflow, geen formaatfout.
- **2c2470e5**, **6b7914f5**, **63c3560a**, **f15b0412** MCP-backups; **26ed5917**, **95e52476**, **154177f0**,
  **c2cc76df** MCP-server — geen import/export.
- Gantt/perf/undo/nivelleren/motor/extensies/instellingen (o.a. 7bb1fe3d, 21f4a941, e313472c, 6ff8b970,
  83691aac, de09f014, 94c92a61, c88293d0, d1e75a96, be957e87, 5e6d65f9, a824466b, 5ec2c7a2, 4f4616b1, 198aa6df,
  164aa949, fca084b4, ccd50840, fda24e66, cbef9ebe, 7a6f3f83, d82c95ab, b8db26aa, 8535b49c, cd9fbeea, a731eb8b,
  5fb85c71, 19c46a37, 57aa8ba7, d19ad182, eaf0dd4e, d6e5fbf5, 697f22ec, fffd7a21, 83d7188f) — geen bestandsformaat.
- **a58b1924** voorbeelden opnieuw gegenereerd, **00a54d68** regeleinden vite.config — geen fix.
