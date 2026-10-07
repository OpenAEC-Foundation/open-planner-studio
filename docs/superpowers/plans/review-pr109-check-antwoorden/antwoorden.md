# Antwoorden visuele check PR #109 (XER-lezer)

Gemeten op origin/main 82213573 (worktree `review-pr109`), dev-server http://localhost:3042/, eigen headless
Chromium (Playwright), Engelse UI tenzij anders vermeld. Scripts: `/tmp/ops-check109/q*.mjs`.
Uitvoerder: Claude Opus 5.5 (`uitvoerder-opus-midden`).

## 1. "recalculating would shift 2882 tasks" (rehab-2)

Het getal telt taken waarvan de vroege start OF het vroege einde van onze herberekening als tekst afwijkt van
P6's `early_start_date`/`early_end_date`. Late datums en speling tellen niet mee. De vergelijking is een exacte
stringvergelijking per taak (`src/engine/scheduler/recordedDates.ts:259-267`, aangeroepen in
`src/state/documentActivation.ts:338`; tekst in `RecordedDatesNotice.tsx:45-46`). Gemeten op rehab-2:
2882 van 6976 vastgelegde taken; 2875 verschillen op start én einde, nooit alleen in de tijd van de dag.
Een echt voorbeeld (niet gestart): V3105200, P6 27-11-2008 08:00 → 02-12-2008 17:00, herberekend
06-12-2008 08:00 → 23-12-2008 17:00 (P6 speling 282 d, wij 275 d). Daar klopt "shift".

Let op: 2036 van de 2882 zijn VOLTOOIDE taken. P6 legt voor een voltooide taak start = statusdatum
(2008-05-27 08:00) en einde = de dag ervoor 17:00 vast; wij zetten de werkelijke datums (bv. V000010:
P6 27-05-2008 → 26-05-2008, wij 07-11-2006 → 03-02-2007). Die taken "verschuiven" niet echt; het is een
andere weergave van hetzelfde verleden. Echt verschoven zijn dus 846 taken (787 niet gestart, 59 gestart).
Het woord "shift" (NL "wijken af") is voor die 2036 misleidend. [VERMOED: dit verdient een eigen
knownbugs-punt of een telling zonder voltooide taken; niet door een tweede agent getoetst.]
Bijvangst: de toast zegt "2882 tasks show the dates as Primavera recorded them", maar ALLE 6976 tonen de
vastgelegde datums; 2882 is het aantal dat afwijkt (`fileSlice.ts:181`, `common.json:59-60`).

Bewijs: `q1-rehab2-strook.png`, `q1-rehab2-na-herberekenen.png`, data `q1-before.json`/`q1-after.json`.

## 2. Bestand met meer projecten (kedular-multi-project.xer)

Openen maakt zonder keuzevraag één document per project: twee tabbladen "Project Alpha (PROJ1)" en
"Project Beta (PROJ2)", één melding "XER file opened: 2 project documents" (`fileSlice.ts:98-190`, `:646-648`).
De tabbladen vormen geen tabgroep: elk is een los document. Ze delen wel hetzelfde archiefobject in het
geheugen (gemeten: `sameArchiveObject: true`, sha 32524ea4…, 555 bytes); elk document heeft een eigen
selector (`xerSourceProjectId` 1001 / 1002). "Save" op één tabblad schrijft alleen dat document: één
download "Project Alpha (PROJ1).ifc" (`fileSlice.ts:697-698`, `saveActiveDocument(documentId)`).
Het IFC krijgt HET HELE .xer (ByteLength 555 = bestandsgrootte, alle bytes in `ByteChunk…`) plus de selector
`OPS_XerDocument.SourceProjectId = 1001` (`src/services/ifc/ifcWriter.ts:449-475`). Bij heropenen leest de
app alleen het project van die selector (`ifcReader.ts:180-190`): één nieuw tabblad "Project Alpha (PROJ1)";
Beta komt niet mee. Hier geen strook, want bij dit bestand rekent de app exact P6's datums na (shifted 0).
Het projectoverzicht (☰) toont twee gewone kaarten; niets zegt dat ze uit één bestand komen.

Bewijs: `q2-kedular-tabs.png`, `q2-kedular-overzicht.png`, `q2-na-save.png`, `q2-heropend-ifc.png`,
`Project Alpha (PROJ1).ifc`.

## 3. Is het bronarchief zichtbaar?

Nee, niet als zodanig. Geen Projectinfo-veld, geen eigenschappenpaneel-regel en geen export "origineel .xer"
toont het; er bestaat geen XER-schrijver. De UI noemt het archief alleen als het KAPOT is
(`common.json:139-147`, `IFCPanel.tsx:65`). Wel indirect zichtbaar: (a) de projectcode achter de naam in tab
en titelbalk, bv. "(NORTHSTAR GRID CONNECTION)", komt uit de archiefmetadata (`xerDocumentName.ts:23-29`);
(b) heropenen van het IFC geeft weer de strook "as Primavera recorded it" — gemeten op Northstar:
origin `xer-archive`, 21 van 23 taken; (c) het tabblad IFC → IFC-editor toont de ruwe IFC-tekst met de psets
`OPS_XerSourceArchive` en `OPS_XerDocument` [VERMOED voor de editor: de psets zelf zag ik in het opgeslagen
bestand, niet in de editor]. Ook MCP-tools (`xerProvenanceTools.ts`) en de extensie-API lezen het.

Bewijs: `q3-heropend-strook.png`, `q3-ifc-tab.png`, `Northstar Grid Connection (NORTHSTAR GRID CONNECTION).ifc`.

## 4. "Not recorded" / "Partly unrecorded" in de tabel

"Not recorded" (NL "Niet vastgelegd") staat in vier kolommen: *Late start*, *Late finish*, *Total float*,
*Free float* (NL *Laatste start*, *Laatste einde*, *Totale speling*, *Vrije speling*)
(`taskColumnRegistry.ts:907-910`, `184-188`). "Partly unrecorded" (NL "Deels niet vastgelegd") staat in de
kolom *Recorded-dates source* (NL *Herkomst (opgeslagen datums)*) (`taskColumnRegistry.ts:920-933`). Die kolom
bestaat alleen op een document met vastlegging, en de markering verschijnt alleen ín de modus.
Toevoegen: de "+" rechts in de kop van het taakraster ("Add column" / "Kolom toevoegen",
`ColumnChooser.tsx:343-352`), zoeken op de naam, klikken. Northstar: NS-100 toont Late start "Not recorded",
Total float 16d, bron "Partly unrecorded"; samenvattingsrijen tonen een gewone datum en "—".

Bewijs: `q4-kolomkiezer-en.png`, `q4-kolommen-en.png`, `q4-kolommen-nl.png`.

## 5. Strepen in de Gantt (rehab-2, schaal Jaar, ~0,73 px/dag)

De grijze gestippelde banen zijn RELATIELIJNEN, geen kalenderarcering. Rehab-2 heeft 10.730 relaties; elke
relatie tekent een verticaal stuk, en bij <1 px/dag liggen die verticalen vlak naast elkaar. De streep heeft een
periode van 7 px: dat is het streeppatroon `[4, 3]` voor een "non-driving" relatie
(`GanttRenderer.ts:2102`). In de modus "zoals Primavera" zijn ALLE relaties gestreept: de reconstructie zet
`drivingSequenceIds: []` (`recordedDates.ts:408`), en de renderer leest een lege set als "niets is driving"
(`GanttRenderer.ts:2069`), terwijl zijn eigen commentaar zegt dat zonder berekening alles doorgetrokken hoort
(`:2066-2068`). Na Herberekenen zijn 4738 relaties driving en dus doorgetrokken; het beeld blijft druk.
Kalenders: projectkalender "Standard 5 Day Workweek" (ma–vr, 0 feestdagen); 6548 taken gebruiken
"R111 - 1" (vrijdag vrij, 95 uitzonderingen). De arcering is een vlakvulling op de projectkalender, geen
streep, en links van de statusdatum (2007) is het raster rustig. Oordeel: correct getekend, lelijk bij deze
zoom; het "alles gestreept in de modus" is een kleine fout [VERMOED dat dat een fout is en geen bedoeling].
Bijvangst: de Arabische taaknamen tonen als mojibake ("windows-1252" gekozen).

Bewijs: `q5-rehab2-modus.png`, `q5-rehab2-modus-detail.png`, `q5-rehab2-herberekend.png`,
`q5-rehab2-herberekend-detail.png`, `q1-rehab2-strook.png`.

## 6. UI-observaties buiten #109

(a) Op de kaart "Northstar Grid Connection (NORTHSTAR GRID CONNECTION)" loopt de titel over twee regels, en de
sluitknop krimpt tot 18,8 × 26 px: de knop heeft geen `flex: none` en de kopregel geen `gap`. De badge
"ACTIVE" eindigt op x 760,5, de knop begint op x 760,2: ze raken elkaar (`ProjectOverview.tsx:111-151`).
De lintlabels "Calendar"/"Structure" (tab Planning) worden in een smal venster gedraaid naast de mini-knoppen
gezet. Dat is bewust ontwerp (`Ribbon.css:447-475`), geen fout; op 1600 px staan ze gewoon horizontaal.
(b) De "+" ontbreekt niet. Hij staat altijd helemaal rechts in de tabstrook (`DocumentTabBar.tsx:77-83`),
ná een oprekkende viewport, dus ver van de tabbladen. `.ops-tab-group` is de wrapper van één tabblad
(`DocumentTabControl.tsx:30`), geen groep uit één XER.
Toegevoegd aan `knownbugs.md` als 94 (kaart, B) en 95 (plek van de "+", sectie Wensen, B); niet gecommit.

Bewijs: `q6a-overzichtkaart-1600.png`, `q6a-lint-Planning-1600.png`, `q6a-lint-Planning-1280.png`,
`q6b-tabstrip-1600.png`, `q2-kedular-tabs.png`.
