# Tabel-overhaul — verwerking eerste implementatie-eindreview

**Datum:** 2026-08-26  
**Branch:** `codex/tabel-overhaul`  
**Stand:** eerste negen, tweede zes, derde drie, vierde vier, vijfde vijf, zesde tien en zevende
reviewbevindingen inhoudelijk verwerkt; externe reviewbrief afgehandeld; onafhankelijke eindreview
(Opus) verwerkt; integratiepoorten volgen

De eerste brede implementatie-eindreview gaf geen GO. Dit document houdt per bevinding het
werkelijke productprobleem, de gekozen reparatie en het beschikbare bewijs bij. Een reparatie geldt
hier niet automatisch als finaal geaccepteerd: dezelfde volledige scope wordt na de eindpoort
opnieuw beoordeeld.

## Verwerking per bevinding

| Nr. | Zwaarte | Bevinding | Verwerking en bewijs |
|---:|---|---|---|
| 1 | blokkerend | De Relaties-tab was verwijderd zonder bewijs dat werkelijk verversen uit een desktopbestand via de nieuwe UI werkte. | Uitgevoerd in een echte Tauri-runtime via **Relatie → Alle externe relaties vernieuwen**. De proef vond en repareerde bovendien instabiele IFC-taak- én project-id's. Bron, voor en na zijn als IFC vastgelegd en worden door een eigen productiereadercheck gecontroleerd. |
| 2 | blokkerend | Mijlpaal omschakelen verzon op sommige routes vijf dagen duur en verschillende UI-routes gedroegen zich anders. | Eén pure `taskMilestoneTransition` is nu de enige overgang voor grid, taakdialoog, mijlpaalvelden en contextmenu. Gewone taak → mijlpaal wordt P6-nulduur; mijlpaal → gewone taak bewaart de aanwezige duur, ook een geïmporteerde niet-nulduur; geen-op-transitie bewaart de invoer exact. |
| 3 | hoog | De gerapporteerde vóór/na-performance draaide tweemaal dezelfde nieuwe implementatie. | Die claim is ingetrokken. Plancommit `446324ce` en de huidige grid zijn met dezelfde 10.000-taken-IFC en dezelfde lintklik gemeten: 3.407,3 ms/230.303 elementen tegenover 88,0 ms/926 elementen, telkens twee warmups en negen runs. Ruwe JSON staat naast dit document. |
| 4 | hoog | Dubbelklik op een taak deed in Gantt iets anders dan in de volledige Tabel. | De oppervlakafhankelijke dubbelklikroute is verwijderd. Dubbelklik selecteert in beide grids dezelfde cel/taak en opent het bestaande eigenschappenpaneel; de aparte taakdialoogroute blijft alleen waar die expliciet door een andere bediening wordt gevraagd. |
| 5 | hoog | Nieuwe labels en technische samenvattingen waren deels hardgecodeerd of ontbraken in vertalingen. | Registrylabels, baselinesamenvattingen, technische kolommen en de externe-linkwaarschuwing lopen nu door i18n. Alle veertien `task.json`-bronbestanden zijn bijgewerkt; `verify:i18n` eindigde met exitcode 0 en nul ontbrekende sleutels in alle dertien niet-Nederlandse locales. |
| 6 | midden | Volledige inhoud van afgekorte cellen was niet aantoonbaar bereikbaar. | De adapter levert voor gewone tekst, datum en datumtijd een volledige `title`; DataGridCore zet die op de echte cel. De displaywaarde volgt de persoonlijke notatie, terwijl de titel de volledige zichtbare of canonieke waarde bewaart. Adaptertests dekken lange tekst en alle datumvolgordes. |
| 7 | midden | De splitter gebruikte voor slepen een dynamische bovengrens, maar toetsenbord en ARIA bleven op 800 px staan. | `ganttSplitter.ts` berekent één grens uit de actuele werkruimtebreedte. Pointer, toetsenbord, klem en `aria-valuemax` gebruiken dezelfde waarde; een `ResizeObserver` actualiseert die bij vensterwijziging. |
| 8 | midden | “Excel roundtrip” was alleen intern kopiëren/plakken. | De claim is versmald. De interne Ctrl+C/Ctrl+V-route blijft apart bewezen. Aanvullend heeft LibreOffice Calc productie-TSV naar een echt XLSX-bestand en terug geschreven. Twee rijen en zeven kolommen, multiline tekst, datums, duur, relaties en beide `OPS-EXT/1`-payloads bleven behouden; percentage-opmaak werd alleen visueel genormaliseerd. Microsoft Excel zelf is niet geclaimd. |
| 9 | midden | Gewone datumcellen toonden ISO, terwijl editor en kopieerroute persoonlijke datumnotatie gebruikten. | Display, editor en klembord gebruiken nu dezelfde persoonlijke `dmy`/`mdy`/`ymd`-notatie. De volledige canonieke waarde blijft beschikbaar als titel voor technische precisie. Adaptertests eindigden met 52/52 groen. |

## Werkelijke desktopproef

De Tauri-app is gestart tegen de gecontroleerde devserver van deze worktree. De
toegankelijkheidsboom van het echte desktopvenster bevatte de keuzeknop **Relatie** en daarna het
menu-item **Alle externe relaties vernieuwen**; beide acties retourneerden succes. De opgeslagen
doel-IFC vóór en na de UI-actie leverde:

| Veld | Voor | Na |
|---|---|---|
| extern anker | `2026-07-01` | `2026-09-02` |
| bron ontbreekt | `true` | `false` |
| bronidentiteit | verouderd | canonieke project- en taak-id/naam |
| schema | verouderd | `cpm=true` |

Het screenshot
[`tabel-overhaul-review-tauri-refresh.png`](./tabel-overhaul-review-tauri-refresh.png) is 1400×936
pixels en heeft SHA-256
`779897f10f2f8528f12e20132f853b613e943fa90ef5abb78261a5704a03eb50`.

De eerste desktopverversing rapporteerde nul ververst en één ontbrekend. Onderzoek van de werkelijk
opgeslagen IFC's wees uit dat dezelfde IFCTASK bij iedere parse een nieuwe interne id kreeg. De
oplossing schrijft een eigen identiteitsperset en gebruikt voor oude bestanden een deterministische
IFC-GlobalId-terugval. Hetzelfde bronbestand houdt nu zijn taak-id bij herhaald lezen én na
lezen→schrijven→lezen.

De tweede zware review wees terecht aan dat één screenshot en een geschreven samenvatting niet
onafhankelijk controleerbaar genoeg waren. De echte Tauri-handeling is daarom opnieuw uitgevoerd.
De drie exacte, privacyvrije invoer-/uitvoerbestanden staan nu in de repository:

- [`tabel-overhaul-tauri-refresh-source.ifc`](./tabel-overhaul-tauri-refresh-source.ifc), SHA-256
  `bc9037903f3aa2dfe83516a873f596219512b6fddd41452c9d8fb266ce3bc6bc`;
- [`tabel-overhaul-tauri-refresh-before.ifc`](./tabel-overhaul-tauri-refresh-before.ifc), SHA-256
  `f032ecaf7f72bcd29be36f8c977069698eb747fc4a292cfb59f979583c7dde5c`;
- [`tabel-overhaul-tauri-refresh-after.ifc`](./tabel-overhaul-tauri-refresh-after.ifc), SHA-256
  `356494bd9b41480f4f17c08d88f23bc187275df9eca557f28f2ab95e4fc617e3`.

`check-tauri-refresh-evidence.ts` opent ze met de productie-IFC-reader en bewaakt hash, oud anker,
nieuw anker, `sourceMissing`, bronproject, brontaak, stabiele doeltaak en broneinddatum. Die controle
vond dat ook het project-id van hetzelfde IFC-bestand nog willekeurig wisselde. De writer bewaart
nu `OPS_ProjectSettings.InternalProjectId`; legacybestanden krijgen een stabiele
`proj-ifc-<IFCPROJECT.GlobalId>`-identiteit. De herhaalde desktopactie schreef precies die stabiele
bronidentiteit terug. De gerichte controle eindigde met 5/5 groen.

## Verwerking tweede implementatie-eindreview

| Nr. | Zwaarte | Bevinding | Verwerking en regressiegrens |
|---:|---|---|---|
| 1 | blokkerend | Delete/Backspace verwijderde geselecteerde taken in plaats van geselecteerde cellen te legen. | `FullTaskGrid` routeert `clear-cells` nu naar `planTaskGridClear` en één gridtransactie. Een surfacecontract verbiedt `deleteTasksBulk` binnen deze commandtak; de bestaande plannerchecks bewaken atomaire lege writes en volledige rollback bij één niet-leegbare cel. |
| 2 | blokkerend | Mijlpaal plus duur in één paste was afhankelijk van kolomvolgorde. | Writes van dezelfde taak worden semantisch rond de mijlpaalovergang geordend. Vier regressiepaden bewaken aan/uit in beide kolomvolgordes en exact gelijke eindtoestand. |
| 3 | hoog | De Tauri-claim miste zelfstandig controleerbare artefacten. | Bron, voor en na staan hierboven met hashes; een vaste productiereadercheck draait mee in de totale suite. De herhaling via de echte zichtbare dropdown vond en repareerde bovendien projectidentiteit. |
| 4 | midden | Datumvelden hadden geen kalenderkiezer. | Datum en datumtijd renderen tekstinvoer plus native `date`/`datetime-local`; tekst blijft de persoonlijke notatie. De statische editorcheck bewaakt de echte picker en de adaptertests de conversiegrens. |
| 5 | midden | Boolean-copy/paste was hard Nederlands/Engels. | Surface, adapter en klembord delen dezelfde lokale labels. Een Franse test (`Oui`/`Non`) bewijst lokale copy en parse; `true`/`false` blijft technische terugval. |
| 6 | midden | Datumhover verloor seconden en tijdzone. | De bestaande celtitel gebruikt voor datum/datumtijd de volledige canonieke bronwaarde; display, edit en copy blijven persoonlijke minuutprecisie. Een milliseconde- en tijdzonecasus bewaakt beide kanten. |

## Verwerking derde implementatie-eindreview

| Nr. | Zwaarte | Bevinding | Verwerking en regressiegrens |
|---:|---|---|---|
| 1 | blokkerend | De cel-clear hield het globale Delete/Backspace-commando niet tegen; hetzelfde event kon daarna alsnog taken verwijderen. | Een afgehandelde gridopdracht doet nu zowel `preventDefault` als `stopPropagation`; de globale sneltoetsgrens negeert bovendien ieder al afgehandeld event. `check-keyboard-event-routing.ts` gebruikt voor Delete en Backspace hetzelfde cancelable event vóór en na `preventDefault` en bewijst dat alleen de tweede fase wordt tegengehouden. |
| 2 | blokkerend | Mijlpaalmetadata werd bij een samengestelde paste read-only zodra `isMilestone=false` eerder in dezelfde transactie landde. | Bij uitzetten landen `milestoneKind` en `mandatory` vóór de ene mijlpaalovergang en de gewone duur erna. De regressiematrix beproeft lege, afwijkende en gevulde metadata in alle 24 volgordes: 72/72 eindigen als gewone taak met geplakte duur en zonder mijlpaalmetadata. |
| 3 | hoog | Editorlabels vielen terug op technische Engelse tekst, doordat dynamische sleutels in alle locales ontbraken. | Booleans gebruiken `adapter.booleanLabels`; assignments gebruiken bestaande `properties.assignments.*`; curves gebruiken de bestaande `resource.curve.*`-mapping. De i18n-check leest nu zowel `task.json` als `common.json` voor alle veertien locales en verbiedt de drie oude sleutelpatronen in de editorbron. |

## Verwerking vierde implementatie-eindreview

| Nr. | Zwaarte | Bevinding | Verwerking en regressiegrens |
|---:|---|---|---|
| 1 | blokkerend | De echte klembordplanner keurde dynamisch schrijfbare cellen tegen de begintaak af, voordat de transactiedraft de gezamenlijke eindtoestand kon vormen. | Bewerkbare descriptors leveren naast de gewone writer een interne ongecontroleerde writer voor meercellige paste; berekende kolommen krijgen die niet. `runGridMutation` blijft de enige domeinpoort en ordent per taak mijlpaal-, hangmat-, constraint- en assignmentovergangen. `check-task-grid-clipboard` loopt via de echte planner én storetransactie en eindigt met 97/97, inclusief alle controllerkolomvolgordes en atomaire conflictsituaties. |
| 2 | midden | De lagplaceholder was nog hard Nederlands. | `externalLinks.lagPlaceholder` staat in alle veertien `task.json`-bestanden. De i18n-check leest 4503 verwachtingen en verbiedt de oude literal in de dialoogbron. |
| 3 | midden | De toetsenbordcheck bewees niet de werkelijke DataGrid-dispatch. | `dispatchDataGridKeyCommand` is de door de React-handler gebruikte dispatchgrens. De 8/8-check voert Delete en Backspace via die productiegrens en daarna via de globale beslisgrens. In de echte app zijn beide toetsen op een gevulde beschrijvingscel gebruikt: de cel werd leeg, `Tasks: 1` en de taakrij bleven bestaan. |
| 4 | midden | Een bestaand datumanker kon bij de overgang naar uurmodus een ongeldig `datetime-local`-veld opleveren. | `externalAnchorInputValue` maakt van een datum `T00:00`, knipt datumtijd tot native minuutprecisie en laat leeg leeg. Een ongewijzigd bestaand anker wordt canoniek teruggeschreven. De gerichte check eindigt 5/5; in de echte app werd `2026-08-26` na dag→twee-ploegen geopend als `datetime-local` met `2026-08-26T00:00`. |

Dezelfde eindtoestandsaudit vond aanvullend dat `hangmat uit + duur` in omgekeerde kolomvolgorde
nog faalde. De rode productieketentest gaf 2/97 afwijkingen; na opname van `task.isHammock` als
controller eindigde dezelfde check met 97/97. Ook `resources leeg + hangmat aan` wordt in beide
volgordes bewaakt. De tijdelijke uurinstelling en de twee tijdelijk toegevoegde bewijskolommen zijn
na de browserproef teruggezet.

## Verwerking vijfde implementatie-eindreview

| Nr. | Zwaarte | Bevinding | Verwerking en regressiegrens |
|---:|---|---|---|
| 1 | blokkerend | Units of curve plakken op een taak zonder toewijzing kon zelfstandig een assignment aanmaken. | `AssignmentSetIntent` draagt verplicht de bronkolom. Alleen **Resources** mag assignmentlidmaatschap wijzigen; **Units per day** en **Curve** vereisen dezelfde bestaande resources en bewaren id plus alle niet-bewerkte assignmentvelden. Klembord 101/101 en assignment 44/44 dekken losse writes, gecombineerde writes en volledige rollback. |
| 2 | blokkerend | Meerdere taakvelden werden tegen tijdelijke tussenstanden beoordeeld; constraintparen, actualdatums en status/completion waren daardoor volgordegevoelig. | `planTaskCellEdits` plant alle celwrites voor één taak als één gewenste toestand. Constrainttype, datum en hardheid worden als groep gevalideerd; voortgang wordt éénmaal uit status, completion, actuals, werkelijk duur en resterende duur afgeleid. Gridtransactie 149/149 dekt beide volgordes voor geldige en ongeldige paren, inclusief byte-identieke rollback. |
| 3 | hoog | Een ongewijzigde gezonde bestandslink werd als ontbrekende bron opgeslagen en een nieuwe handmatige identiteit kon oude bestandsvelden erven. | `buildManualExternalLinkSubmission` heeft drie expliciete paden: echte no-op met volledig bronbehoud, optionele naam wissen en nieuwe identiteit zonder verouderde projectnaam/bestandspad. De helper gaat in de regressie ook door de echte store-update; een no-op maakt geen history en geen stale-overgang. |
| 4 | hoog | Escape en Enter werkten niet als annuleren en primaire actie in de externe-linkdialoog. | `ExternalLinkDialog` gebruikt `Dialog onCancel/onConfirm`. De bronpoort bewaakt die echte bedrading. In de lokale app sloot Escape de dialoog met één taak intact; Enter vanuit het geldige taaknaamveld sloot de dialoog en maakte **Refresh all external relations** beschikbaar. |
| 5 | midden | Bij uur→dag bleef een bestaande datumtijd als datetime-input behandeld. | De inputsoort volgt uitsluitend de huidige eigentaakkalender. Dagmodus toont alleen `YYYY-MM-DD`; een onaangeraakte save bewaart het canonieke datumtijdanker. De echte app bewees `2026-08-26T13:45` → `2026-08-26` → na save en terugkeer naar uurmodus exact `2026-08-26T13:45`. |

De tijdelijke browserproef gebruikte een rechtstreeks gestarte Vite-server op poort 3018, nadat
`npm run dev` in de sandbox terecht faalde op het niet-schrijfbare gemeenschappelijke git-slot. De
opgehaalde modulebron bevatte de actuele dialoogreparaties en bevestigde dat de server deze worktree
bediende. Na de proef zijn uurplanning uitgezet, de projectkalender naar de oorspronkelijke dagploeg
teruggezet, de tijdelijke voorgangerkolom verwijderd en het testproject zonder opslag gesloten. De
server is met Ctrl+C gestopt; een aansluitende `curl` kreeg exitcode 7, dus er luisterde niets meer
op poort 3018.

## Verwerking zesde implementatie-eindreview

| Nr. | Zwaarte | Bevinding | Verwerking en regressiegrens |
|---:|---|---|---|
| 1 | blokkerend | Globale Ctrl/Cmd+C/V kon een actieve grid-editor onderscheppen; grid-copy/paste kon daarna opnieuw op het gebubbelde inputevent reageren. | De globale grens wijkt voor `.task-grid-core`; de gridroot wijkt voor input, textarea, select en contenteditable. De productiehelpers eindigen 14/14 groen. In de echte app werd de nog niet opgeslagen inputwaarde `Draft` gekopieerd, de bronedit geannuleerd en `Draft` in een andere taak geplakt; een gridkopie had daar de opgeslagen waarde `Alpha` opgeleverd. |
| 2 | blokkerend | Voortgang plus een niet-voortgangsveld kon falen hoewel dezelfde voortgangswijziging alleen geldig was. | `planTaskCellEdits` ruimt impliciete actuals op binnen de gezamenlijke gewenste toestand. Progress-only en progress+description geven nu dezelfde geldige voortgang; gridtransactie eindigt 152/152. |
| 3 | blokkerend | Hangmat uit, mijlpaal aan en duur was in drie van zes volgordes ongeldig. | De drie controllerwrites hebben één semantische volgorde. Alle zes permutaties eindigen identiek als geldige mijlpaal. |
| 4 | blokkerend | Kalender plus duur rekende de duur nog met de oude kalender. | De transactiedraft bepaalt eerst de uiteindelijke `calendarId` en plant daarna de overige taakvelden met die kalender. Beide kolomvolgordes bewaren dezelfde minuten en werkdagen. |
| 5 | blokkerend | Asynchrone externe verversing kon na een documentwissel het inmiddels actieve andere document muteren. | Beide verversacties leggen `activeDocumentId` vast, controleren na iedere asynchrone bronfase en nogmaals binnen de set-producer. Bij een wissel blijven taken, history en CPM van het nieuwe document onaangeraakt; 206/206 checks zijn groen. |
| 6 | hoog | Een gewijzigde handmatige bronidentiteit kon zonder aangeraakt anker het oude anker erven. | Alleen dezelfde bronidentiteit mag het canonieke bestaande anker behouden. Een nieuwe identiteit vereist een nieuw aangeraakt anker en krijgt geen oud pad, projectnaam of bronstatus mee; dialoog 13/13. |
| 7 | hoog | Zichtbare enumwaarden vielen terug op `NOT_STARTED`, `CONSTRUCTION` en later ook `FRONT_LOADED`. | De adapter gebruikt descriptoroptielabels; assignmentcurves gaan via bestaande common-curvelabels en het gedeelde hoverpaneel gebruikt `taskStatus.*`. De drie statuslabels bestaan in alle veertien locales; adapter 58/58 en i18n 4607/4607. |
| 8 | hoog | Alle assignmentkolommen boden dezelfde brede editor, terwijl de writer kolomspecifieke bevoegdheden had. | Resources toont alleen lidmaatschap, units alleen numerieke units en curve alleen de curvekeuze. De browser bevestigde de drie afzonderlijke editors. Een daarbij gevonden crash door laat lezen van `event.currentTarget` is voor units én curve gerepareerd en door 23/23 plus echte negatieve invoer bewezen. |
| 9 | midden | `aria-invalid` en `aria-describedby` stonden op samengestelde wrappers in plaats van op de focusbare besturing. | Assignment- en relatie-editors zetten de foutkoppeling op hun input/select/combobox. Negatieve units hielden de editor open; het actieve spinveld had `aria-invalid=true` en verwees naar de zichtbare Nederlandse fouttekst. |
| 10 | midden | De importwaarschuwing verwees in alle talen nog naar het verwijderde Relaties-paneel. | `notifications.summaryRelationsDropped` verwijst nu per locale naar beide relatiekolommen. De i18n-poort controleert daarvoor locale-specifieke voorganger- en opvolgerwoorden. |

De review meldde daarnaast een mogelijk scrollprestatiegat. Onderzoek bevestigde dat iedere
horizontale scroll synchroon de volledige gebruikersvoorkeur naar `localStorage` schreef. De live
Zustand-state blijft nu per event actueel, maar vijf snelle events veroorzaken nul onmiddellijke en
precies één uitgestelde write met de laatste scrollstand. De voorkeurencheck eindigt 72/72 groen.

## Verwerking zevende review en externe reviewbrief

| Nr. | Zwaarte | Bevinding | Verwerking en regressiegrens |
|---:|---|---|---|
| 1 | blokkerend | Horizontale Gantt-gridscroll kon een recursieve terugkoppeling vormen tussen de DOM-scroll en de gedeelde gebruikersstate. | De synchronisatie onderscheidt nu bron en doel en schrijft alleen bij een werkelijk gewijzigde stand. De zichtbare scroll blijft direct gelijk; persistentie blijft de eerder bewezen uitgestelde gebruikersopslag. |
| 2 | blokkerend | De gridtransactie valideerde sommige controllercombinaties nog tegen een tussenstand in plaats van één eindtoestand. | De planner vormt en valideert per taak één gewenste eindtoestand, waarna pas één atomaire storetransactie volgt. De gerichte eindtoestandsmatrices en rollbackchecks zijn uitgebreid zonder een parallel schrijfpag te introduceren. |
| 3 | blokkerend | Selectiewijziging bouwde het selectie-onafhankelijke adapterdomein en de relatie-index opnieuw op. | `createTaskGridAdapterDomain` is gememoïseerd op alleen echte domeininvoer; selectie projecteert vervolgens over dat domein. Drie verse Node 22-processen maten 0,34, 0,48 en 0,32 ms mediaan tegen een onveranderde poort van 2 ms. De oude foutconstructie overschreed die poort in alle drie processen. |
| 4 | hoog | Bulkverversing van externe links kon bij twee bestanden met hetzelfde opgeslagen `project.id` relaties aan de verkeerde bron binden. | Dubbelzinnige project-id-groepen vereisen nu padmatching; enkelbronverversing blijft project-id-primair. De eerst rode regressie ververste vier in plaats van twee links en bond beide aan bron B. Na de reparatie eindigden de betrokken advanced-CPM- en vastgelegde-projectchecks met 235/235 en 207/207 groen. Opgeslagen ids worden niet stil herschreven. |
| 5 | hoog | De 3.000-taak-selectieklik was als verbeteringspercentage gemeld, maar de resterende browserduur was niet verklaard. | De probe meet nu dezelfde-cel- en neutrale vloer, eigenschappen open/gesloten en een CPU-profiel. Een echte ongewijzigde-selectiepublicatie is eerst rood aangetoond en daarna gerepareerd. De selectiecheck eindigt 34/34 groen; details en ruwe waarden staan in het performancebewijs. |

De externe reviewer heeft de oorspronkelijke punten 5–10 geaccepteerd en zijn bredere claim over
documentactivatie en bibliotheekbinding zelf ingeperkt: het aangetoonde identiteitslek zat alleen in
de externe bulkverversing. Eén door de review genoemde bredere etappe blijft bewust buiten deze
implementatie en verandert de afgesproken tabelscope niet. De finale onafhankelijke herreview krijgt
de volledige actuele diff, de oorspronkelijke reviewbrief, het complete overleg en beide ruwe
selectierapporten. Na eventuele reparaties wordt die review opnieuw uitgevoerd voordat integratie
wordt overwogen.

## Spreadsheetgrens

Uitgevoerd met LibreOfficeDev 26.8 en het echte `Calc MS Excel 2007 XML`-filter:

```text
node scripts/verify-task-grid-spreadsheet.mjs <absoluut-soffice-pad>
```

De run eindigde met exitcode 0. De productiecode schreef 1.347 TSV-bytes; na
TSV→XLSX→tabgescheiden tekst kwamen 1.350 bytes terug. Alle veertien celwaarden waren exact gelijk,
behalve twee percentages die Calc van één naar twee decimalen formatteerde. Hun numerieke waarden
waren gelijk. Beide externe relatietokens werden na terugkomst opnieuw met de productieparser
geopend en hielden hun volledige technische payload.

## Productbenchmark

De meetprobe is `scripts/bench-task-grid-product.mjs`. Hij start voor iedere versie een schoon
Chrome-profiel, laadt dezelfde 6.701.772-byte IFC via dezelfde storeactie als **Voorbeelden**, zet
de app terug op Start en klikt de echte linttab **Tabel**. Een sample stopt pas wanneer de
tabelstate actief is en twee schilderrondes zijn verstreken.

| Mediaan van negen | Plancommit | Huidige grid | Verandering |
|---|---:|---:|---:|
| wandtijd | 3.407,3 ms | 88,0 ms | -97,417% |
| scripttijd | 1.925,310 ms | 78,788 ms | -95,908% |
| layouttijd | 769,774 ms | 3,138 ms | -99,592% |
| browsertasktijd | 3.421,544 ms | 98,307 ms | -97,127% |
| DOM-elementen | 230.303 | 926 | -99,598% |

De ruwe rapporten zijn
[`tabel-overhaul-product-benchmark-base.json`](./tabel-overhaul-product-benchmark-base.json) en
[`tabel-overhaul-product-benchmark-final.json`](./tabel-overhaul-product-benchmark-final.json).

## Verificatiestand vóór tweede review

- `npm run build` op de huidige werkboom: exitcode 0.
- `npm run build` op plancommit `446324ce`: exitcode 0.
- `npm run typecheck`: exitcode 0.
- `npm run verify:i18n`: exitcode 0, nul ontbrekende sleutels.
- Calc/XLSX-rondreis: exitcode 0.
- `check-ifc-roundtrip`: 166/166 groen in de eerste volledige planningsrun.
- relevante gridchecks in die run: contextmenu 94/94, adapter 52/52, editors 40/40,
  i18n 4301/4301, GanttWorkspace 14/14 en performance 23/23 groen.
- de eerste volledige planningsrun is bewust niet als groen geregistreerd: twee bewijstests hadden
  nog oude aannames. Na correctie eindigden `gantt-coordinate-contracts` 63/63 en
  `recovery-integrity` 36/36 afzonderlijk groen. De afgebroken totaalsuite hield exitcode 130.
- de daaropvolgende volledige `bash tests/planning/run.sh` eindigde met exitcode 0: 560/560
  rekengevallen en UTC, New York, Midway, Auckland en Azoren groen.
- de eerste `npm run verify` stopte terecht met exitcode 1 op de lintregel voor een expliciete
  controlekarakterregex. De validatie loopt nu via codepoints; `npm run lint` eindigde daarna met
  exitcode 0.
- de volledige herstart van `npm run verify` eindigde met exitcode 0. Typecheck, lint, alle tests,
  voorbeelden, 30 artikelen × 14 talen, localevergelijking, 449 importmodules en audit waren groen;
  de audit vond nul kwetsbaarheden.
- beide lange runs gebruikten tijdelijk het prestatieprofiel en zetten via een exit-handler het
  oorspronkelijke profiel aantoonbaar terug op `balanced`.
- na de tweede review eindigden typecheck, lint en `git diff --check` opnieuw met exitcode 0.
- de daaropvolgende volledige planningssuite eindigde met exitcode 0: 560/560 rekengevallen,
  168 IFC-rondreiscontroles, 5/5 Tauri-artefactcontroles en alle vijf tijdzones groen.
- na de derde review begonnen de drie nieuwe reparaties rood: de toetsenbordcheck kon de nog
  ontbrekende globale eventgrens niet importeren, alle drie metadata-matrices faalden in 24/24
  volgordes en de editor-i18n-bronpoort faalde.
- na verwerking eindigden toetsenbord 4/4, gridtransactie 137/137, editor 20/20,
  full-grid-surface 15/15 en grid-i18n 4473/4473 groen; typecheck, lint en `git diff --check`
  eindigden met exitcode 0.
- de volledige planningssuite eindigde daarna opnieuw met exitcode 0: 560/560, IFC 168/168,
  Tauri-artefacten 5/5 en alle vijf tijdzones groen.
- de daaropvolgende volledige `npm run verify` eindigde met exitcode 0: typecheck, lint, alle tests,
  voorbeelden, 30 artikelen × 14 talen, nul ontbrekende localesleutels, 449 importmodules zonder
  cyclus en audit met nul kwetsbaarheden.
- na de vierde review eindigden de gerichte klembord-, toetsenbord-, i18n- en externe-dialoogchecks
  respectievelijk met 97/97, 8/8, 4503/4503 en 5/5 groen. De eerste totaalsuite tijdens deze
  verwerking is bewust afgebroken met exitcode 130 nadat drie registrychecks alleen een
  object-sleutelvolgordeverschil vonden; de canonicalisatie bewaart nu de oorspronkelijke payload
  wanneer geen vreemde assignment-id hoeft te worden verwijderd.
- de daaropvolgende volledige `bash tests/planning/run.sh` eindigde met exitcode 0: 560/560
  rekengevallen, 168/168 IFC-rondreiscontroles, 5/5 Tauri-artefactcontroles en UTC, New York,
  Midway, Auckland en Azoren groen.
- de daaropvolgende volledige `npm run verify` eindigde met exitcode 0: typecheck, lint, alle
  testreeksen, bibliotheek, MCP, ontwikkelserver, voorbeelden, 30 artikelen × 14 talen,
  nul ontbrekende localesleutels, 449 importmodules zonder cyclus en audit met nul kwetsbaarheden.
- na de vijfde review begonnen de assignment- en gezamenlijke-eindtoestandchecks rood: de echte
  klembordroute gaf 4/101 afwijkingen voor losse units/curve en rollback; gridtransactie gaf 7/146
  afwijkingen voor constraintparen, actualvensters en status/completion. Na verwerking eindigden
  klembord 101/101, assignment 44/44, gridtransactie met drie extra permutatiegrenzen 149/149,
  registry 526/526, editor 20/20, externe-linkdialoog 12/12 en externe-linkbewerking 12/12 groen.
- de daaropvolgende volledige `bash tests/planning/run.sh` eindigde met exitcode 0: 560/560
  rekengevallen, 168/168 IFC-rondreiscontroles, 5/5 Tauri-artefactcontroles en alle vijf tijdzones
  groen.
- de actuele volledige `npm run verify` eindigde met exitcode 0: typecheck, lint, alle testreeksen,
  bibliotheek, MCP, ontwikkelserver, voorbeelden, 30 artikelen × 14 talen, nul ontbrekende
  localesleutels, 449 importmodules zonder cyclus en audit met nul kwetsbaarheden. De eerste kale
  aanroep had exitcode 127 doordat `npm` niet in de niet-interactieve `PATH` stond; de volledige run
  gebruikte de vastgestelde Node 24.15.0-installatie en is de inhoudelijke eindpoort.
- na verwerking van de zesde review eindigden diffcheck, typecheck, lint, documentatie en i18n eerst
  afzonderlijk met exitcode 0. De eerste volledige `npm run verify` was vervolgens terecht rood:
  vier van 101 klembordchecks vonden dat een lege resourcecel bij een volledige mijlpaalrij pas na
  de gegroepeerde mijlpaalovergang werd uitgevoerd en daardoor `assignmentTaskUnavailable` gaf.
- lege assignmentwrites worden nu vóór iedere cel uit die gezamenlijke mijlpaaltoestand toegepast;
  klembord 101/101, gridtransactie 152/152 en assignments 44/44 eindigden daarna afzonderlijk groen.
- de volledige herstart van `npm run verify` eindigde met exitcode 0: hoofdplanning, solver 560/560,
  IFC 168/168, Tauri-bewijs 5/5, UTC/New York/Midway/Auckland/Azoren, 35 MCP-reeksen,
  ontwikkelserver, voorbeelden, 30 artikelen × 14 talen, alle 13 locales, 449 importmodules en audit
  met nul kwetsbaarheden waren groen.
- de tijdelijke gebruikerskolom **Assignment curve** is via het echte Tabel-contextmenu verwijderd.
  Na paginaherlading stonden exact negen standaardkolommen zonder die curve; alle browsertabs zijn
  gesloten, de gecontroleerde Vite-server is gestopt en curl naar poort 3018 eindigde met exitcode 7.
- na de selectiereferentiefix, de drie ruwe 3.000-taakrapporten en de optionele
  productiebenchmarkbrug eindigde de volledige actuele `npm run verify` opnieuw met exitcode 0:
  planning 560/560 in alle vijf tijdzones, library, MCP, dev-server, voorbeelden, 30 artikelen ×
  14 talen, nul ontbrekende sleutels in alle dertien afgeleide locales, 451 importmodules zonder
  cyclus en `npm audit` met nul kwetsbaarheden. De gewone afsluitende productiebuild bevatte geen
  benchmarkbrug of JSX-dev-runtime.

## Verwerking onafhankelijke eindreview (Opus)

Een onafhankelijke hyperkritische eindreview op Opus leverde acht bevindingen op, elk apart
gecommit met een gerichte regressietest.

| Nr. | Bevinding | Verwerking en bewijs |
|---:|---|---|
| 1 | blokkerend | `resolveTaskGridCommand` klemde Tab/Shift+Tab op de eigen positie aan de randen van de grid; `DataGridCore` annuleert elk afgehandeld toetsenbordevent, dus de browserfocus kon de grid nooit verlaten via Tab (WCAG 2.1.2). | Op de allerlaatste cel geeft Tab, en op de allereerste cel Shift+Tab, nu `unhandled` terug. Escape in selectiemodus krijgt een expliciete uitgang: een nieuw `exit-to-container`-commando verplaatst de DOM-focus naar de gridcontainer zonder de actieve cel te wijzigen. Besluit vastgelegd in spec §7.2. Regressie op de echte modules (`resolveTaskGridCommand` + `dispatchDataGridKeyCommand`): Tab op de laatste cel en Shift+Tab op de eerste cel geven unhandled/preventDefault=false. Commit `b0107289`. |
| 2 | verplicht | De grid deed Insert altijd `'below'`, terwijl de globale sneltoets (`structure.insertAbove`) `'above'` doet; de gridtoetsen stonden bovendien nergens in het Sneltoetsen-venster. | De grid volgt nu de globale richting (boven); "onder" blijft bereikbaar via Ctrl+I. Een nieuwe `grid`-categorie in `SHORTCUTS` (displayOnly) maakt Tab/Shift+Tab, Enter/F2, direct typen, Insert en Delete zichtbaar in het Sneltoetsen-venster, met i18n-labels in alle veertien locales (`verify:i18n` exitcode 0). `public/docs/{nl,en}/ref-sneltoetsen.md` noemt de nieuwe categorie. Regressie in `check-commands.ts` bewaakt de brondefinitie en dat de grid-Insert `'above'` gebruikt. Commit `6951f5f6`. |
| 3 | verplicht | `gids-plannen-wbs.md` (nl + en) beweerde dat één klik meteen de bewerking start en dat Enter/↓ op de laatste rij automatisch een nieuwe zustertaak aanmaakt (met een navraag bij filter/sortering/groepering). Geen van beide klopt. | Herschreven naar het echte gedrag: klikken selecteert alleen (bewerken via Enter/F2/direct typen, dubbelklik opent het eigenschappenpaneel); Enter op de laatste rij opent de editor, ↓ klemt, een nieuwe taak gaat via Insert. `npm run verify:docs` blijft groen. Commit `4fd1072c`. |
| 4 | verplicht (vóór de rest) | `src/styles/globals.css`, `src/services/ifc/ifcWriter.ts`, `src/components/layout/Ribbon/Ribbon.css` en `src/types/task.ts` waren op de merge-base zuiver CRLF en hadden gemengde regeleindes gekregen. | Alle vier teruggezet naar zuiver CRLF; `git diff --ignore-space-at-eol` toont nul inhoudelijke wijziging. Commit `3e83a3a1`. |
| 5 | gebruikersbesluit | Bulk-plakken bevroor de app: 2.000 taken × 27 kolommen (16.000+ writes) kostte 4.446 ms synchroon, vóór de reparatie. Drie afzonderlijke O(document)-hotspots werkten samen in `gridTransaction.ts`: de gezamenlijke-eindtoestandcontrole kopieerde de volledige `tasksById`-kaart per (cel × prefixlengte) en herplande diezelfde prefixen uitputtend per conditioneel schrijfbare cel; `applyCellEdits` zocht de taakindex met `Array.findIndex`; `orderWritesForDependentTransitions` scande de complete schrijflijst opnieuw per betrokken taak; en `planTaskCellEdits`(meervoud) berekende per deelwrite een ongebruikte `changed`-vlag via `JSON.stringify`. | Alle vijf herstructureringen zijn pure snelheidswinst zonder gedragswijziging: één gedeelde, gemuteerde projectiekaart per taak; een gedeelde, kleine controller-alleen-toestandenreeks (alleen isMilestone/isHammock/constraint(2).type bepalen ooit een conditionele readOnly-uitkomst); een meegegeven taakindexkaart; een vooraf gebouwde taakid→posities-index; en een `applyOneCellEdit`-variant zonder de overbodige `changed`-berekening in de interne lus. Nieuwe regressiegrens `check-task-grid-paste-performance.ts` reproduceert het exacte 2.000×27-scenario op de echte store (wbsAutoNumber aan) en bewaakt een budget van 3.000 ms (~2× de gemeten mediaan van 764–1.378 ms ná de fix, tien losse processen). Volledige planningssuite (incl. grid-transaction) blijft groen. Commit `1c2b1fb1`. |
| 6 | gebruikersbesluit | `clipboard.ts` stond alleen 1×1-vullen toe (geen Excel-tegelherhaling), en een plak die read-only doelcellen raakte (auto-WBS, mijlpaalmetadata zonder mijlpaalkolom) weigerde de hele transactie. | Uitgebreid naar Excel-semantiek: een R×K-bron vult een selectie waarvan de afmetingen een geheel veelvoud zijn (de oude 1×1-uitzondering was hiervan altijd al een speciaal geval). Read-only doelcellen worden nu overgeslagen in plaats van de hele plak te weigeren, met één geaggregeerde K8a-melding (`notifications.pasteSkippedReadOnly`, veertien locales met correcte CLDR-pluralvormen) — uitsluitend voor een echte Ctrl+V-paste; Delete/Backspace behoudt bewust zijn bestaande volledige-rollback-semantiek. Harde writes die wél doorgaan maar zelf falen blijven de hele transactie terugrollen. Spec §8.6 bijgewerkt. Regressie (128→134 checks in `check-task-grid-clipboard.ts`): rij-herhaling, blokherhaling, een niet-passend veelvoud dat geweigerd blijft, auto-WBS-plak met melding, de mijlpaalmetadata-case uit de reviewbrief, en dat Delete zijn harde weigering behoudt. Commit `62b37ea6`. |
| 7 | gebruikersbesluit | `resolveTaskGridCommand` bailde op elke `event.altKey`, en de typen-om-te-bewerken-tak eiste `!hasCommandModifier`: AltGr (fysiek Ctrl+Alt, NL/DE/PL-indelingen: @, €, [, \, \|) en macOS Option startten daardoor geen celbewerking. | Typen-om-te-bewerken mag nu ook bij AltGr (Ctrl+Alt samen) en bij kale Alt (macOS Option), zolang `event.key` één afdrukbaar teken is en metaKey niet is ingedrukt; kale Ctrl en elke Cmd-combinatie blijven commando's, Alt+pijl blijft gereserveerd voor uitspringen. Spec §7.2 bijgewerkt. Regressie in `check-grid-nav.ts` (113→119 checks): AltGr+@, macOS Option+e, Cmd+Option blijft commando, kale Ctrl blijft commando, Ctrl+C blijft commando, Alt+ArrowLeft blijft gereserveerd. Commit `78a49675`. |
| 8a | los eindje | `reconcileGridSelection` bouwde altijd een nieuw object, ook zonder wijziging — elke selectieklik kostte een volledige gridrender. | Een structurele-gelijkheidstoets geeft bij ongewijzigde inhoud dezelfde referentie terug. Regressie in `check-task-grid-selection.ts` (34→38 checks) bewijst `again === sel` voor zowel een enkelvoudige als een meercellige selectie, en dat een échte wijziging wél een nieuwe referentie geeft. |
| 8b | los eindje, onderzocht | De no-op-eliminatie in `clipboard.ts` vergelijkt tegen de begintoestand, terwijl validatie in `gridTransaction.ts` tegen de eindtoestand oordeelt — een mogelijke stille wegfiltering van een echte wijziging. | Een gerichte regressie (kalender + duur, dezelfde weergegeven duurtekst) bewijst dat het verschil echt is, maar dat "verplaats naar de eindtoestand" het niet simpelweg dichtzet: de duurtekst is al vóór de paste onder de OUDE kalender naar minuten geparseerd; een niet-geëlimineerde write zou onder de eindtoestand-kalender herrekenen naar een getal dat de gebruiker nooit typte (5d wordt stilzwijgend 10d) — minder voorspelbaar, niet correcter. Een echte fix vereist herparsen van zulke cellen onder de kalender die de paste zelf meebrengt; dat valt buiten deze gerichte reparatie. Geen productiewijziging; de regressie legt het huidige, tekstgetrouwe gedrag vast (`check-task-grid-clipboard.ts`, 134→138 checks). |
| 8c | los eindje | `normalizeExternalSourcePath` geeft `null` voor zowel "geen pad" als "een relatief pad", en `refreshAllExternalAnchors` sloeg beide stil over — de link telde nergens mee. `OPS_ExternalLink` schrijft `externalLinks` ongefilterd als één JSON-blob weg en leest 'm ook ongevalideerd terug, dus een van elders aangeleverd of met de hand bewerkt IFC-bestand kan wél degelijk een relatief `sourceRef.filePath` bevatten. | Zo'n pad kan de app nooit betrouwbaar herlezen (geen vaste "relatief-ten-opzichte-van"-map) en blijft terecht ongelezen, maar telt nu mee in `missing` zodat de bestaande toast het laat zien in plaats van de link onzichtbaar te laten verdwijnen. Regressie in `check-external-link-edit.ts` (12→15 checks): een relatief en een absoluut bronpad in dezelfde verversing, met de juiste `sources`/`refreshed`/`missing`-telling. |

Alle acht commits (`3e83a3a1`, `b0107289`, `6951f5f6`, `4fd1072c`, `1c2b1fb1`, `62b37ea6`,
`78a49675`, `ffc4453a`) draaiden na elkaar met een groene volledige planningssuite
(`bash tests/planning/run.sh`, 560/560, alle vijf tijdzones). `git diff --check` eindigde met
exitcode 0 (geen witruimtefouten).

De afsluitende volledige `npm run verify` (na het laatste commit, `ffc4453a`) eindigde met
exitcode 0: typecheck en lint schoon; `test:planning` 560/560 (incl. task-grid-selection 38/38,
task-grid-clipboard 138/138, external-link-edit 15/15, rasternavigatie 119/119, commands 86/86,
task-grid-paste-performance 734,7 ms binnen het budget van 3.000 ms) over alle vijf tijdzones;
`test:library` groen; `test:mcp` 35/35; `test:dev-server` groen; `verify:examples` groen;
`verify:docs` 30 artikelen × 14 talen; `verify:i18n` 0 ontbrekende sleutels in alle 13 afgeleide
locales (CLDR-pluralcategorieën meegerekend); `verify:cycles` geen circulaire imports in 451
modules; `verify:audit` 0 kwetsbaarheden.

## Verwerking herreview op de Opus-verwerking (twee napunten, twee aanbevelingen)

De herreview van bovenstaande acht punten gaf GO, met vier kleine vervolgpunten — elk apart
gecommit met een gerichte regressietest.

| Nr. | Zwaarte | Bevinding | Verwerking en bewijs |
|---:|---|---|---|
| 1 | bindend | De exit-to-container-fix (`b0107289`) riep voor élk afgehandeld gridcommando `preventDefault`+`stopPropagation` aan. Zodra Escape in selectiemodus exit-to-container opleverde, bereikte het event de globale `edit.deselect`-sneltoets (deselectAll, traceMode/showDependencyMode uit) nooit meer zolang een gridcel focus had — het Sneltoetsen-venster beloofde onder Bewerken nog "Esc = deselecteren", maar dat klopte dan niet meer binnen een gridcel. | `dispatchDataGridKeyCommand` slaat voor 'exit-to-container' nu bewust preventDefault/stopPropagation over; de globale poort (`shouldHandleGlobalShortcutEvent`, toetst `!event.defaultPrevented`) ziet het event dus alsnog en `edit.deselect` vuurt via de normale bubbel — geen dubbele uitvoering, de grid roept dat gedrag zelf niet aan. Een nieuwe `grid.exitSelection`-entry (displayOnly, hergebruikt de al-vertaalde `shortcuts.edit.deselect`-labelKey) maakt dit zichtbaar in het Sneltoetsen-venster; `ref-sneltoetsen.md` (nl+en) noemt Esc nu in de Tabel-alinea. Bijvangst: de sneltoets-onbereikbaarheidscheck had een blinde vlek voor een displayOnly-LATERE entry — gefixed. Regressie in `check-keyboard-event-routing.ts` (26→36 checks): de volledige dispatchketen plus de ECHTE `edit.deselect`-entry tegen een echte store bewijzen beide effecten. Commit `567f6ba2`. |
| 2 | bindend | `task.isHammock` staat zowel in `CONTROLLER_COLUMN_IDS` als heeft zelf een conditionele readOnly (`isMilestone \|\| childIds.length > 0`); het commentaar erboven beweerde onwaar dat een overgeslagen cel "per definitie geen controller" is. Tegencase: samenvattende taak, isHammock=true, plak `{isHammock:false, duur 5d}` ⇒ isHammock werd terecht overgeslagen, maar scheduleDuration werd daardoor in ÉÉN pas ten onrechte "schrijfbaar" verklaard en de write faalde hard op de VERKEERDE cel. | De conditionele controle draait nu tot een vast punt: na elke nieuw ontdekte skip worden de gedeelde controllertoestanden herbouwd uit alleen de nog niet overgeslagen edits, en wordt elke nog niet overgeslagen conditionele cel opnieuw beoordeeld. Voor de tegencase eindigt dat nu netjes: beide cellen overgeslagen, één geaggregeerde melding, geen harde weigering. Het commentaar is herschreven met de tegencase erin. Performance-check: 738–833 ms bleef ongewijzigd binnen het budget van 3.000 ms (de lus voegt voor het gewone geval hooguit één extra pas toe). Regressie in `check-grid-transaction.ts` (154→160 checks): exact de reviewer-tegencase eindigt met `result.ok=true`, beide cellen ongewijzigd, één melding met count=2. Commit `12bb937d`. |
| 3 | aanbeveling | `runTaskGridPasteBenchmark` mat één sample zonder warmup en negeerde `OPS_RELAX_PERF`; de reviewer zag onder CPU-druk 5.049 ms (rood) en 2.935 ms (net groen) op hetzelfde werk. | Gelijkgetrokken met `check-task-grid-performance.ts`: twee warmups, negen runs, mediaan via de bestaande `median()`-helper, `OPS_RELAX_PERF`-respect (alleen meten, geen falende poort). De store wordt veilig hergebruikt over alle samples: de benchmark plakt zonder `skipReadOnlyCells`, dus de conditionele wbsCode-cel weigert de hele transactie vóór er ooit gecommit wordt — de state blijft na elke sample ongewijzigd. `run.sh` dwingt `OPS_RELAX_PERF=0` af, net als bij de andere perf-poort. Budget van 3.000 ms ongewijzigd. Gemeten: mediaan 782,4 ms (negen runs, poort actief) resp. 743,5 ms (`OPS_RELAX_PERF=1`, alleen meten). Commit `e792f12f`. |
| 4 | aanbeveling | `CONTROLLER_COLUMN_IDS` is een met de hand onderhouden set, niet uit de registry afgeleid; de reviewer wees op de stilzwijgende aannames rond `task.childIds` en `ctx.assignmentsByTaskId`. | Volledige automatische afleiding is niet mogelijk (`readOnly` is een ondoorzichtige functie, geen gestructureerde afhankelijkheidslijst), dus gekozen voor de pin-route: een nieuwe regressiesectie in `check-grid-transaction.ts` leest `CONTROLLER_COLUMN_IDS` uit de bron en vergelijkt 'm tegen de ECHTE registry — elke conditioneel read-only, cell-edit-schrijfbare kolom moet exact overeenkomen met een gecertificeerd overzicht. Geverifieerd dat de pin een echte regressie vangt: het schrappen van `task.constraint2.type` liet de check meteen rood gaan, vóór het weer werd teruggedraaid. Beide stilzwijgende aannames staan nu vastgelegd in zowel commentaar als check: childIds is nooit los via een cel-paste schrijfbaar (geen `parse`-functie, dus geen CellEditIntent-route), en de drie `assignment.*`-kolommen schrijven altijd via `AssignmentSetIntent` ('assignment-set'), nooit via `CellEditIntent` ('cell-edit'), dus lopen ze structureel nooit door `applyCellEdits`' conditionele controle. Commit `702a0795`. |

Alle vier commits (`567f6ba2`, `12bb937d`, `e792f12f`, `702a0795`) draaiden na elkaar met een groene
volledige planningssuite (560/560, alle vijf tijdzones). `git diff --check` eindigde met exitcode 0.

De afsluitende volledige `npm run verify` (na het vierde commit, `702a0795`) eindigde met
exitcode 0: dezelfde volledige dekking als hierboven (typecheck/lint schoon, test:planning 560/560
over alle vijf tijdzones incl. grid-transaction 173/173 en keyboard-event-routing 36/36,
test:library/mcp/dev-server groen, verify:examples groen, verify:docs 30 artikelen × 14 talen,
verify:i18n 0 ontbrekende sleutels in alle 13 afgeleide locales, verify:cycles 451 modules zonder
cyclus, verify:audit 0 kwetsbaarheden).
