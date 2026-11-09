# Rapport-tabblad opnieuw ontwerpen: bevindingen

Status: bevindingen verzameld, nog geen ontwerp. Aanleiding: issue #817 (deel B, kolommen in de afdruk
kiezen). De eigenaar wil het hele Rapport-tabblad opnieuw ontwerpen, omdat het rapport de output is die
een planner naar buiten stuurt (Ethan, 7 november 2026).

## Bevindingen van Ethan bij het huidige tabblad (7 november 2026)

1. **Het lint van het tabblad Rapport is nutteloos.** Er staan alleen twee knoppen in: "Voortgangsblad
   exporteren" en "Voortgang bijwerken uit een blad". Die hebben niets met het rapport te maken. Zomaar
   weghalen kan misschien ook niet, want een tabblad zonder lint ziet er vreemd uit. Ethan weet nog niet
   wat beter is.
2. **Te veel opties, en niet duidelijk.** Al bij het standaardrapport (Gantt-afdruk) staan er heel veel
   instellingen in één lange lijst. Het is niet duidelijk wat wat doet.
3. **"Previewkwaliteit" boven de preview moet weg.** Het wordt een app-instelling (Instellingen), met
   standaard "Hoog".
4. **De interface is in het geheel niet prettig.**

## Besluiten

- **De Gantt-afdruk is de kern van het tabblad.** Ongeveer 90 % van de gebruikers gebruikt alleen dit
  rapport. Het nieuwe tabblad is vooral gebouwd om één goede Gantt-afdruk te maken. De andere 11
  rapporttypen komen op de tweede plaats, bijvoorbeeld achter één keuze "Ander rapport". Alternatief was:
  alle 12 typen even belangrijk, zoals nu. Besluit van Ethan, 7 november 2026, in de sessie over #817.
- **"Previewkwaliteit" gaat naar de app-instellingen**, standaard Hoog. Besluit van Ethan, 7 november 2026.

## Voorkeur bij de vijf schetsen (Ethan, 7 november 2026, nog geen besluit)

Vijf schetsen getoond in de thread: 1 het lint, 2 klik op het papier, 3 voor wie is het, 4 stap voor
stap, 5 kaart van het blad.

- 1 valt af.
- 2 en 4 hebben de voorkeur. 2 vindt Ethan "heel vet", als het papier op het scherm direct bijwerkt en
  precies gelijk is aan de PDF die eruit komt.
- Ethan bespreekt de keuze eerst met iemand met verstand van zaken. Daarna volgt het besluit.

## Besluit ontwerprichting (Ethan, na overleg met een expert, 7 november 2026)

- **Schets 4 en schets 2 samen.** Standaard staat links de zijbalk met stappen (schets 4). Rechts
  staat het rapport zelf, met het interactieve papier (schets 2): klikken op een deel van het papier.
- **De zijbalk kan inklappen.**
- **Snelheid is een eis.** Het huidige tabblad voelt klunzig. Het nieuwe moet zo snel zijn dat je bij
  een klik niets merkt van wachten, en het moet "echt mega goed voelen".
- De huidige voorbeeldweergave is een korrelige foto waarop je niet kunt inzoomen. Ethan wil dat anders.
  Voorstel (Claude, 7 november 2026): het papier als vectortekening (SVG) via een derde uitvoering van
  `Draw2D`, met dezelfde tekenfunctie als de PDF. Dat is scherp en zoombaar, en een klik weet welk deel
  geraakt is. Ethan wees dit voorstel niet af; het volgt uit zijn eis van scherpte en snelheid. Een
  meting bij grote planningen moet het bevestigen.
- **Geen lint op het tabblad Rapport** (Ethan, 7 november 2026). Het lint hoorde bij de ontwerpkeuze, en
  schets 1 (het lint) viel af. De groep Voortgang verdwijnt van dit tabblad; die staat ook op Planning en
  Tabel.
- **Zwevende knop PDF exporteren linksonder** als de zijbalk ingeklapt is (Ethan, 7 november 2026). Is de
  zijbalk open, dan zit exporteren in de zijbalk.

## Feiten uit de code (inventaris, 7 november 2026)

- Links één smalle kolom: keuze uit 12 rapporttypen, een overzicht met tellingen, de kaart Instellingen
  en de knop "Exporteer PDF" (`ReportPanel.tsx`). Rechts de preview.
- Gantt-afdruk: 21 vaste instellingen plus 3 die soms verschijnen, in één lijst zonder groepen.
- Tabelkolommen van de Gantt-afdruk zijn vast: WBS, Taaknaam, Duur, Start, Einde, en Voltooid via een
  vinkje (`COL` in `src/services/print/printPreview.ts`).
- Alle rapportinstellingen staan per apparaat in localStorage (`ops-reportSettings`), niet in het
  projectbestand.

## Werkwijze

- Nog geen prototypes bouwen. Ethan maakt in een andere sessie een skill waarmee meerdere prototypes
  gemaakt worden en door een panel van agents beoordeeld worden. Het ontwerp loopt via die skill.
- Deel A van #817 (kolom Kalenderdagen in de takentabel) loopt los hiervan in een eigen PR.

## Prototype in de app (branch `feat/817-rapport-herontwerp`, 7 november 2026)

Het prototype staat achter de feature flag `reportRedesign` (standaard uit). Zonder flag is het tabblad
precies zoals het was. Aanzetten in de dev-server: `?flag=reportRedesign` in de testlink
(`docs/dev-link.md`), of Instellingen › Geavanceerd › Experimenteel.

- **Indeling.** Links een zijbalk met vijf stappen in de volgorde van het papier: Taken, Kolommen,
  Balken en tijdlijn, Pagina, Kop en voet. Onderaan de zijbalk staan de bestandsnaam en "PDF exporteren"
  (tot de fixronde na council ronde 2 was er een zesde stap "Opslaan (PDF)"). Eén stap tegelijk open; een dichte stap toont
  één regel samenvatting. Elke stap heeft "Standaard" met "Ongedaan maken". Waarschuwingen staan in de
  stap waar je ze oplost (bijv. "De tabel neemt 41 % van de breedte; de tijdlijn wordt smal").
- **Zijbalk inklappen** tot een rand met stapiconen (Ctrl+\). Een klik op een icoon of op het papier
  opent dezelfde stap als klein venster naast dat deel. Ingeklapt staat linksonder de knop
  "PDF exporteren" (met tekst sinds de fixronde, zie hieronder); die doet hetzelfde als de knop onderaan
  de open zijbalk.
- **Geen lint** op dit tabblad zolang de flag aan staat.
- **Papier als SVG** via een derde `Draw2D`-backend (`src/services/pdf/svgDraw2d.ts`), met dezelfde
  `renderReport` en dezelfde bladindeling als de PDF (`reportTileInput`, `ganttTileOptions`). Zoomen met
  Ctrl+scroll en de knoppen −, + en passend. Alleen bladen in beeld worden getekend.
- **Kolommen (deel B van #817).** Kiezen uit het kolomregister van de takentabel, ook Kalenderdagen;
  slepen of Alt+pijltjes om te verplaatsen; "Zoals de tabel" neemt de kolommen van de tabel naast de
  Gantt over. Taaknaam is verplicht. Standaard ongewijzigd. Bewaard per apparaat in `ops-reportSettings`
  (`columns`), met terugval voor oude instellingen.
- **Previewkwaliteit** is weg uit het nieuwe tabblad (SVG heeft geen rasterkwaliteit nodig).
- **Lettertype** (#770, kwam tijdens de bouw op main): de keuzelijst staat in de stap Pagina, boven de
  lettergrootte. Papier, kolommeting en PDF gebruiken dezelfde letter; na een wissel blijft het papier op
  de vorige letter tot de nieuwe geladen is, en een export wacht daarop.
- **De andere elf rapporten** staan achter de keuze "Ander rapport" en openen het oude paneel.

### Snelheid (gemeten 7 november 2026, dev-server)

Gemeten met de prestatiemerken `ops-report:feedback` (klik tot het eerste frame met de nieuwe stand van
de knop) en `ops-report:paper` (klik tot het eerste frame met het nieuwe papier), in headless Chromium
op aia09-mp50 (belast, load 5 tot 40). Het is de dev-build: React draait daar in StrictMode (elke
opname twee keer) en met extra controles. Een productiebuild is lokaal niet gemeten (te zwaar voor deze
machine).

| plan | terugkoppeling (mediaan / max) | papier (mediaan / max) | opname | één blad als SVG |
|---|---|---|---|---|
| 57 taken (`03-kantoorgebouw-zuidas.ifc`), 10 klikken | 35–37 / 43–47 ms | 92–100 / 114–131 ms | 5–6 ms | 3 ms |
| 5000 taken (139 bladen A3), 3 klikken | 35 ms | 573–807 ms | 225–353 ms (×2) | 4–12 ms |

Twee bevindingen tijdens het meten, beide opgelost:

- Elk blad kreeg het hele papiermodel als prop. React vergelijkt in de dev-modus de oude en nieuwe
  props diep; bij 139 bladen met honderdduizenden tekenopdrachten kostte één klik ruim 4 minuten. Het
  model draagt de opname nu alleen in een closure, en een blad krijgt alleen zijn eigen maten en delen.
- De muis- en klikhandlers van het papier waren bij elke render nieuw, dus elk blad rendert opnieuw.
  Nu zijn ze vast. Terugkoppeling bij 5000 taken ging van 165–186 ms naar 35 ms.

Het papier bij 5000 taken blijft rond een halve seconde: de opname (`renderReport` over 5000 rijen)
kost de tijd, vooral de celteksten van de taaktabel. Dat is dezelfde render als de PDF.

### Snelheid na council ronde 1 (gemeten 9 november 2026, dev-server)

Zelfde meting, 5000 taken (139 bladen A3), schakelaar "Speling tonen", 6 klikken, 1600×900:

| stand | terugkoppeling (mediaan / max) | papier (mediaan / max) | opname |
|---|---|---|---|
| vóór (na de gedeelde tekstmeting van punt 1) | 48 / 49 ms | 602 / 644 ms | 218–272 ms (×2) |
| na de caches (celteksten, datumbereik) | 39 / 55 ms | 286–337 ms | 152–188 ms |
| na het rijvenster en de vaste bladenlijst | 40 / 42 ms | 134 / 167 ms | 15–43 ms |
| na alle punten van de fixronde | 42 / 42 ms | 136 / 158 ms | — |

Na alle punten ook gemeten: papierformaat A2 ↔ A3 bij 5000 taken (6 klikken) terugkoppeling 38 / 43 ms,
papier 202 / 212 ms (een andere bladindeling, dus ook nieuwe bladen in beeld); 57 taken, "Speling tonen"
(8 klikken) terugkoppeling 39 / 45 ms, papier 87 / 99 ms.

Wat het verschil maakt:

- **Rijvenster** (`createReportPaperRecorder`, `reportPaperModel.ts`). Eén render levert de maten en de
  bladindeling (die liggen vast vóór er getekend wordt), maar tekent alleen de rijen van de bladen in
  beeld (`ReportRowWindowRequest` in `renderReport`). Een blad dat later in beeld komt, krijgt dan pas
  zijn rijen. Bij 5000 taken tekent een klik ±80 rijen in plaats van 5000. Bewaakt in
  `check-report-svg.ts` (sectie 6): elk blad uit een gedeeltelijke opname is gelijk aan hetzelfde blad
  uit de volledige, ook met een relatie over veel bladen.
- **Caches per bevroren taak**: de celteksten van de taaktabel en het datumbereik. Een taak uit de store
  is bevroren (Immer), dus zijn uitkomst blijft geldig.
- **Eén opname per invoer**: React StrictMode rekende de opname in de dev-modus twee keer.
- **De bladenlijst rendert niet bij elke klik**: de vlag "wordt bijgewerkt" staat los van het model.

Wat overblijft (±130 ms): één frame wachten zodat de knop eerst tekent, de React-render van het papier en
het opbouwen van twee SVG-bladen met duizenden tekstelementen door de browser (±35 ms stijl en layout).
De terugkoppeling blijft onder 50 ms. Een productiebuild is niet gemeten; React in StrictMode en de
dev-controles kosten daar niets.

### Afwijkingen van het ontwerp

- **Periode** zit niet in de stap Taken: `renderReport` slaat relaties over als er een tijdvenster is.
  Zonder relaties is de Gantt-afdruk niet wat een planner verwacht.
- **"Zoals de tabel"** neemt de kolommen van de tabel naast de Gantt (`gantt-task-grid`), niet van de
  losse Tabel-weergave.
- Geen B2-iconen voor greep, slot en papierstand: die bestaan niet. Greep = CSS-puntjes, ↑/↓ als tekst,
  het slot is weg ("verplicht" als tekst).
- De andere elf rapporten gebruiken het oude paneel.

## Fixronde na council ronde 1 (9 november 2026)

Council ronde 1: Opus 7,0, GPT-6.1-Sol 7,0, Fable 7,5 (doel 8,5 per lid). Besluiten van de bouwer
(Claude Opus 5.5), per punt van de brief:

1. **Papier = PDF.** Eén tekstmeting uit het fontbestand (`src/services/pdf/reportTextMeasure.ts`): de som
   van de glyfbreedtes, zoals pdf-lib. Papier, kolombreedtes, PDF en het oude tabblad meten ermee. Canvas
   `measureText` rondde per glyf af en gaf zo andere breedtes (bij datums vooral). `check-report-svg.ts`
   vergelijkt nu per tekstitem de SVG-opname met de echte vector-PDF (tekst, x en basislijn), en is rood
   met de oude meting. In de app: papier en gedownloade PDF hebben per blad dezelfde woorden en dezelfde
   afgekapte items (A3 liggend en A4 staand met 7 kolommen, blad 1 en 2; groot plan blad 1, 70 en 139).
2. **Focus in het zwevende venster**: de sluitfunctie zit in een ref; het effect loopt één keer per
   geopende stap.
3. **Standaard/Ongedaan maken** bewaart alleen de velden van die stap (en de bedrijfsnaam bij Kop en voet).
   Ongedaan maken zet precies die terug. Een latere wijziging van een van die velden laat het ongedaan
   maken vervallen: anders zou het die wijziging stil wissen.
4. **Hele blad** is de standaard, **Breedte** de tweede keuze. De zoom telt ten opzichte van de ware
   grootte van het papier (zoals een pdf-lezer). Na een wissel van formaat of stand: bovenaan blad 1.
5. **Stapkoppen**: alle zes altijd in beeld, alleen de open stap scrolt. Onder 800 px vensterhoogte tonen
   dichte stappen alleen hun titel (samenvatting in de tooltip). Gemeten op 1600×900, 1366×768, 1280×720.
6. **Help** (nl/en) heeft een deel "Het nieuwe tabblad Rapport (experimenteel)". Boven blad 1 staat bij het
   eerste bezoek "Klik op een deel van het blad om het in te stellen"; weg na de eerste klik of met ×.
7. **Eén exportknop**: niet meer in stap 6. Ingeklapt zweeft linksonder "PDF exporteren" met tekst. Het
   papier houdt onderaan 64 px vrij, dus "Hele blad" past erboven. De rand toont alleen stap 1–5.
8. **Naamlabel** staat boven het blad, rechts in de titelregel. Het dekt niets af.
9. **Toetsenhint** alleen bij toetsenbordfocus in de kolomlijst, als laag zonder eigen plek (anders
   verspringt "Kolom toevoegen" midden in een klik). **Statusdatum**: "Op vandaag zetten" of een datum kiezen
   in de melding zelf (het lint is op dit tabblad weg).
10. **Kolomkiezer** sluit na Enter of een klik; de focus gaat terug naar "Kolom toevoegen".
11. **Vaste schaal** start op de passende breedte per dag (naar beneden afgerond, `dayWidth` uit de render),
    dus het aantal pagina's blijft gelijk. Per stand een korte uitleg; de melding bij veel pagina's noemt per
    stand de juiste oplossing.
12. **Open stap** markeert het papier alleen met een rand.
13. **Rand**: stapnummer en kort label bij elk icoon.
14. **Schuif**: label "Breedte van de naamkolom" en de waarde in millimeter op papier (0,75 pt per logische
    px, maal de lettergrootte). Breedte per dag ook in mm. De kolomkop heet nu "Voortgang" (en "Progress"),
    gelijk aan de kolomlijst; de balkoptie en samenvatting ook.
15. **Open stap** staat in `ops-reportSettings` (`studioStep`): eerst stap 1, daarna de laatst gebruikte.
16. **Snelheid**: zie "Snelheid na council ronde 1" hierboven.
17. **Tabel te breed bij A4 staand**: de melding verscheen wel (69 % bij 7 kolommen), maar alleen in de stap
    Kolommen. Wie in Pagina A4 staand kiest, zag hem niet. Nu staat hij ook in Pagina, met "Kolommen
    aanpassen".

Nieuwe VERVOLG-punten: `knownbugs.md` 965–969 (eerst 960–964; omgenummerd omdat die nummers met een andere PR botsten).

## Fixronde na council ronde 2 (9 november 2026)

Council ronde 2 gaf 8,0 (Opus), 8,2 (Sol) en 8,0 (Fable). Deze ronde gaat vooral over de zijbalk op gewone
schermen. Besluiten per punt van de brief; waar een punt een besluit van de vorige fixronde vervangt, staat dat
erbij.

1. **Stappen passen.** Stap 6 "Opslaan (PDF)" is weg: hij had geen eigen actie. De bestandsnaam staat onderaan
   de zijbalk boven de exportknop; "planning niet doorgerekend" staat boven het papier (punt 3). Verder:
   compactere rijen (schakelaar 22 px, kolomrij 28 px, keuzelijsten 6 px binnenruimte), "Kolom toevoegen" en
   "Zoals de tabel" boven de lijst, Standaard/Verder vast onder het scrollvak van de open stap. Een melding die
   verschijnt, schuift het scrollvak tot hij helemaal in beeld is (`StudioNotice`, `scrollIntoView` met
   `block: 'nearest'`, alleen na het openen van de stap). Een stap met een melding toont open een
   waarschuwingsteken naast de titel. Onder 800 px vensterhoogte staat de samenvatting van een dichte stap
   kleiner naast de titel in plaats van weg. Vervangt punt 5 van de vorige fixronde. Gemeten (licht en donker
   gelijk), hoogte van het scrollvak van de open stap / nodig:

   | venster | voor (b212e69a4) | na |
   |---|---|---|
   | 1600×900 | 290 px voor elke stap; Kolommen nodig 428, Balken 532, Pagina 451; stapvoet buiten beeld | elke stap past: Taken 137/137, Kolommen 359/359, Balken 369/369, Pagina 307/307, Kop en voet 194/194 |
   | 1366×768 | 218 px; samenvattingen weg | 289 px; Kolommen, Balken en Pagina scrollen; stapvoet, "Kolom toevoegen" en 4 samenvattingen in beeld |
   | 1280×720 | 170 px; "Kolom toevoegen" en stapvoet buiten beeld | 241 px; stapvoet, "Kolom toevoegen" en 4 samenvattingen in beeld |

   Melding "Stel eerst een statusdatum in" (Balken) en "tabel te breed" (Pagina, A4 staand): op 1366×768 en
   1280×720 helemaal in beeld, met "Op vandaag zetten", ook als de keuze onderaan het scrollvak stond.
2. **Vaste schaal exact.** De dagbreedte mag onder 1 px (`REPORT_MIN_DAY_WIDTH` = 0,01 in
   `src/services/print/printPreview.ts`; de opslag klemt en rondt niet meer af). De wissel naar vaste schaal
   start op `fixedScaleStartDayWidth`: de passende breedte maal (1 − 10⁻⁹), zodat afronding nooit een blad
   extra geeft. De schuif is logaritmisch (0,01 tot 40 px per dag). Gemeten: A4 staand 2 → 2, A4 liggend 3 → 3,
   A3 liggend 2 → 2 pagina's; groot plan 139 → 139 (was 139 → 695). Bij de kleinste breedte geeft de melding geen
   advies om de breedte kleiner te maken, maar "Op de breedte". Is het rapport al 1 blad breed, dan noemt de
   melding de rijen: groter papier, of minder taken ("Zoals de weergave", fasen inklappen). Het oude tabblad
   houdt `REPORT_MIN_ZOOM` = 1 voor zijn schuif; een kleinere bewaarde waarde tekent het wel (knownbugs 946).
   Vervangt punt 11 van de vorige fixronde.
3. **Planning niet doorgerekend.** Boven het papier een balk "De planning is niet doorgerekend. De PDF rekent
   eerst door." met "Nu doorrekenen" (`recalculate`, gelijk aan F5). Na de klik verdwijnt de balk en werkt het
   papier bij. Een rekenfout staat in dezelfde balk (rood). Help (nl/en) noemt de uitzondering.
4. **Zwevende knop.** Het papier houdt geen vaste strook meer vrij. Raakt een blad de plek van de knop (bij
   Breedte, ingezoomd of "Hele rij"), dan eindigt het scrollgebied 64 px boven de onderrand en staat de knop in
   die strook. "Hele blad" ingeklapt is daardoor even groot als open (1600×900 58 %, 1366×768 46 %, 1280×720
   42 %; was 58 → 52 %). Gemeten in licht en donker: bij Hele blad, Breedte, Breedte gescrold en ingezoomd
   bedekt de knop op geen enkele maat een blad. Vervangt punt 7 van de vorige fixronde.
5. **Elk gegeven één keer.** Uitgeklapt staat boven het papier alleen het aantal pagina's ("8 pagina's (2 × 4)"
   bij meer bladen naast elkaar); papier en stand staan in de samenvatting van Pagina, kolommen en rijen in
   die van hun stap. Ingeklapt (geen samenvattingen) toont de werkbalk papier, kolommen en rijen erbij. Binnen een
   item komma's of haakjes ("Alle taken (57 rijen)"), tussen items de punt.
6. **Toetsenhint** staat vast als één regel onder de kolomlijst. Vervangt punt 9 (eerste helft) van de vorige
   fixronde.
7. **Eerste focus in het zwevende venster** op het eerste bedienelement van de stap: Taken de gekozen optie,
   Kolommen "Kolom toevoegen", Balken de eerste schakelaar, Pagina het gekozen papier, Kop en voet het eerste
   veld. Daarbij gevonden en opgelost: na een klik op een kolom op het papier kreeg die kolom de focus ook bij
   een latere opening van Kolommen via de kop of de rand.
8. **Hele blad** toont altijd één blad passend (58 % bij 4 bladen naast elkaar op 1600×900, was een contactvel).
   Het overzicht van een rij bladen heet "Hele rij" en staat alleen in de werkbalk bij meer dan 1 blad naast
   elkaar (18 % bij 4 naast elkaar).
9. **Snelheid bij 5000 taken.** Bladen in beeld tekenen direct, bladen tot 400 px buiten beeld één frame later.
   De kolommeting staat in een cache per kolom (`createTableColumnMeasureCache`): een kolom erbij meet alleen
   die kolom, verplaatsen meet niets. De kolomobjecten blijven gelijk (`resolveReportColumns` met cache). Zoomen
   zet alleen CSS-variabelen voor de bladmaat; de bladen renderen niet opnieuw. Tabel hieronder.
10. **Help sluiten → Start** komt niet uit deze PR: `closeBackstage` zet altijd Start. Knownbugs 945.

### Snelheid na council ronde 2 (gemeten 9 november 2026, dev-server)

5000 taken (`qa/817-rapport/groot/plan-5000.ifc`, 139 bladen A3), 1600×900, headless Chromium op aia09-mp50
(load 1 tot 1,7), dev-build met StrictMode. Voor = commit b212e69a4, na = deze ronde. Per meting de losse
klikken.

| actie | voor | na |
|---|---|---|
| sprong naar 50/90/25/70 % van het document, tot alle bladen in beeld getekend | 211, 156, 208, 184 ms | 120, 132, 153, 181 ms |
| zoomstap (+/−), tot twee frames later | 141, 140, 135, 124 ms | 60, 61, 70, 51 ms |
| kolom toevoegen: terugkoppeling / papier | 87/178, 44/124, 58/149 ms | 49/130, 51/120, 45/99 ms |
| kolom weghalen: terugkoppeling / papier | 44/128, 51/142, 105/225 ms | 30/96, 33/100, 33/87 ms |
| A2 ↔ A3: terugkoppeling / papier | 48/246, 34/177, 40/206, 38/182 ms | 37/141, 35/143, 35/130, 36/146 ms |
| schakelaar Speling: terugkoppeling / papier | 38/130, 39/122, 37/115, 40/135 ms | 37/94, 37/95, 37/94, 37/93 ms |

De council mat in ronde 2 hogere tijden (sprong 0,3–0,9 s, kolom toevoegen 317–354 ms papier) onder meer last
op de machine; de verhouding voor/na hierboven is op dezelfde machine en dezelfde last gemeten.

Nieuwe VERVOLG-punten: `knownbugs.md` 945 en 946.

## Fixronde na council ronde 3 (9 november 2026)

Cijfers ronde 3: 8,7 / 8,4 / 8,3; doel 8,5 per lid. Per punt wat er veranderde.

1. **CI.** `check-minute-model-routes.ts` telt nu twee keer `bereken` in `GanttReportStudio.tsx`: PDF exporteren
   rekent een verouderde planning eerst door (`runCPM`), en "Nu doorrekenen" en een gekozen statusdatum gaan via
   één callback `recalculateReport` naar `recalculate` (F5).
2. **Zwevend venster binnen het scherm.** `StepPopover` (`studioChrome.tsx`) rekent zijn plek opnieuw uit bij elke
   maatwijziging (`ResizeObserver`) en bij een kleiner venster. Groeit de inhoud (melding, kolomkiezer), dan schuift
   het venster omhoog; is het hoger dan het scherm, dan scrolt de stapinhoud erin en blijft de stapvoet in beeld.
   Gemeten ingeklapt op 1366×768 en 1280×720: Balken + Statusdatumlijn (melding), Kolommen met de kiezer open, en
   Pagina met twee meldingen (groot plan, A4, kleinste dagbreedte). Overal valt het venster binnen het scherm
   (onderrand 756/768 en 708/720).
3. **Statusdatum rekent door.** "Op vandaag zetten" en een gekozen datum zetten de statusdatum en rekenen door via
   `recalculateReport` (gelijk aan "Nu doorrekenen"). De balk "niet doorgerekend" komt dan niet.
4. **Snelheid.** Zie "Snelheid na council ronde 3" hieronder.
5. **Hele rij bij 8 bladen.** Kleinste bladbreedte bij "Hele rij" is 60 px (was 160); de kleinste zoom is 5 %
   (was 10 %), met stappen 5 en 7,5 %. Gemeten: 8 bladen naast elkaar passen op 1366×768 met de zijbalk open
   (103 px per blad) en op 1280×720 ingeklapt (125 px), zonder horizontaal scrollen.
6. **Hele blad na scrollen.** "Hele blad" (knop of toets 0) gaat naar de bovenkant van het blad dat het meest in
   beeld stond (`mostVisiblePage` in `ReportPaperView.tsx`), met de bladtitel net onder de bovenrand, zoals blad 1.
7. **Aantal pagina's.** "12 pagina's: 6 naast elkaar, 2 onder elkaar" in plaats van "12 pagina's (2 × 6)".
8. **Ongedaan maken sluit het zwevende venster niet** meer: een klik op de melding telt niet als klik buiten het
   venster.
9. **Breedte per dag leesbaar.** De eenheid is de eerste van dag, week, maand en jaar waarin één eenheid minstens
   1 mm breed is ("4,2 mm per dag", "12 mm per jaar"; bij de kleinste breedte "0,97 mm per jaar"). Onder de schuif
   staat hoeveel tijd er op één pagina past ("≈ 3 maanden per pagina"), op de bladbreedte naast de tabel.
10. **Previewkwaliteit als app-instelling** (besluit Ethan, 7 november 2026). Inventaris: een rasterpreview hebben
    alleen de Gantt-afdruk en het Resourcediagram in het oude paneel (`isGanttReportType` in
    `src/utils/reportSettings.ts`); de tabelrapporten, mijlpalen en afwijkingen zijn DOM. Met het nieuwe tabblad is
    de Gantt-afdruk vectorpapier: SVG schaalt zonder verlies, dus daar is geen kwaliteitskeuze nodig. Het
    Resourcediagram opent ook met de flag in het oude paneel en houdt dus een rasterpreview. Daarom: een instelling
    `reportPreviewQuality` (`settingsRegistry.ts`, `ops-reportPreviewQuality`, ook in `HOST_PERSISTED_KEYS`), in het
    instellingenpaneel onder Weergave › Rapporten, alleen zichtbaar met de flag. Met de flag gebruikt het oude
    paneel die instelling en toont het geen eigen keuze; zonder flag houdt het zijn eigen keuze, en die blijft ook
    met de flag ongewijzigd bewaard. Help (nl/en) bijgewerkt in `howto-rapport-maken-en-afdrukken` en
    `ref-instellingen`.
11. **Kleine dingen.**
    a. Op een laag venster (laptop) staan de samenvattingen van dichte stappen in `text-caption`, op hooguit twee
       regels (line-clamp) in plaats van afgekapt op één regel.
    b. De zwevende exportknop staat in de DOM direct na de rand: in de tabvolgorde komt hij meteen na de
       stapknoppen, vóór de zoomknoppen en het papier.
    c. Een open stap of zwevend venster dat scrolt, toont boven of onder een schaduw zolang er meer inhoud is
       (CSS-achtergrond met `local` en `scroll`, licht en donker).
    d. De melding "… staat weer op de standaard. Ongedaan maken" staat nu in de werkbalk boven het papier, tussen de
       stand en de zoomknoppen. Onderaan lag hij over het paginanummer van blad 1. Hij blijft 8 s staan, ook als je
       een andere stap opent (zo verwacht de bestaande browsertest het).

### Snelheid na council ronde 3 (gemeten 9 november 2026, dev-server)

**Meetmethode** (`scripts/measure-report-paper.mjs`, herhaalbaar: `node scripts/measure-report-paper.mjs --url
<dev-server>`; het plan maakt het script zelf met `measure-large-plans-data.ts`, seed 0x5eed, 5000 taken, 139
bladen A3). Eén keer laden op 1600×900, licht, nl, daarna één vaste route: sprongen naar 70, 30, 90, 50, 10 en 70 %
van het document; op ±70 % de zoomstappen +, −, −, + en "Hele blad"; drie keer Kalenderdagen erbij (Enter in de
kiezer) en weer weg; twee keer A2 ↔ A3; terug naar 70 % en vier keer de schakelaar Speling. Alles wordt in de
browser gemeten: start is `event.timeStamp` van de klik of toets (bij een sprong `performance.now()` vlak voor
`scrollTop`), eind is het tweede `requestAnimationFrame` nadat het nieuwe papier in de DOM staat (een nieuwe
`data-rs-paper` en alle bladen in beeld met hun SVG; bij zoom en sprong alleen het laatste). Per handeling telt het
script ook de frames waarin het blad in het midden van het beeld nog een skelet is. Headless Chromium (software-
rasteren), dev-build met StrictMode, aia09-mp50.

| handeling | voor (bf9610e6b, load 0,3–1,3) | na (load 0,8–1,1) |
|---|---|---|
| sprong (6×), skeletframes midden | 192, 548, 540, 138, 324, 300 ms; 1,1,1,1,1,2 | 170, 168, 141, 123, 134, 101 ms; 1,1,1,1,2,1 |
| zoom + (2×) | 79, 288 ms | 71, 196 ms |
| zoom − (2×) | 528, 265 ms | 169, 237 ms |
| kolom erbij (3×) | 316, 242, 243 ms | 231, 144, 129 ms |
| kolom weg (3×) | 254, 233, 218 ms | 146, 133, 128 ms |
| A2 ↔ A3 (4×) | 296, 177, 178, 191 ms | 186, 160, 134, 148 ms |
| Speling (4×) | 171, 120, 111, 184 ms | 152, 152, 148, 150 ms |

**Oorzaak van de uitschieters.** De zoomuitschieters uit de council (1,3–1,9 s) en de trage sprongen waren echt.
Een trace liet zien dat Chromium elk SVG-element over zijn hele omhullende rastert: een gestreepte relatielijn of
een rasterlijn over de hele hoogte van het rapport (bij 5000 taken 100.000+ px) kostte per schermtegel tot 0,6 s,
en blokkeerde ook de hoofdthread (`WaitForCommitCompletion`). Drie sprongen kostten zo ±12 s rasterwerk; na deze
ronde ±0,45 s.

**Wat er veranderde.**
- Elke lijn en rechthoek wordt op het venster van het blad afgeknipt (`clipOpToWindow` in `svgDraw2d.ts`, plus
  4 px marge). Van een veelpuntslijn vallen alleen begin en eind weg; een gestreepte lijn begint op een hele periode
  van het oude begin, zodat de strepen op dezelfde plek blijven. Gevulde paden en gestreepte randen blijven heel.
- Eén gedeelde stylesheet voor de letterregels (`paperFontRules.ts`, klasse uit de letter zelf:
  `reportFontClass`) in plaats van een `<style>` per blad: elke nieuwe `<style>` liet de browser het hele document
  opnieuw opmaken.
- Kop en voet worden per opname één keer afgeknipt (`windowCache` in `reportPageSvg`).
- Lijnen in één dekkende kleur worden per kleurreeks samengevoegd tot één pad per dikte.
- De bladindeling zoekt de breekpunten met twee wijzers in plaats van per blad vanaf het begin (`tileLayout.ts`;
  bij 5000 rijen en 100 bladen een half miljoen stappen minder).
- Minder opzoekwerk bij het tekenen van relaties (`drawDependencies`) en een cache van de geparste balktijden per
  taak (`barSpan.ts`).
- De bladen in beeld renderen synchroon in de `IntersectionObserver` (`flushSync`): een sprong toont het blad in het
  midden nu op één frame na direct (was soms twee).

**Oordeel.** Doel was elke handeling onder 150 ms. Gehaald: sprong (mediaan 138 ms; 2 van 6 boven 150), kolom weg,
Speling rond 150 ms. Niet gehaald: zoom (+ 196 ms, − 237 ms), de eerste kolom erbij (231 ms) en de eerste wissel
A2 ↔ A3 (186 ms). De resterende tijd per klik in de dev-build: de React-render van de zijbalk 30–50 ms, de opname
15–30 ms, de SVG 10–30 ms, inlezen en opmaken in de browser 20–30 ms. Een zoomstap rastert de bladen in beeld
opnieuw (software-rasteren in headless Chromium). Een sprong toont het blad in het midden één frame als skelet, één
keer twee. Niet gemeten: een productiebuild (zwaar op aia09-mp50, eerst toestemming nodig) en een echte GPU.

Nieuwe VERVOLG-punten: `knownbugs.md` 947 en 948.

## Fixronde na code-review 1 (9 november 2026)

Code-review van GPT-6.1-Sol (xhigh) op `86f0cc56c`: oordeel nee, door twee BLOKKEERT-punten. De UI bleef
ongewijzigd (de council keurde hem goed).

1. **Vernieuwde rapportinstellingen werden teruggeschreven naar de oude stand.** Oorzaak: `useStudioSettings`
   las `ops-reportSettings` alleen bij het openen en schreef daarna bij elke wijziging het hele object terug;
   `ReportWorkspace` las het rapporttype ook maar één keer. Vernieuwde de host de stand na de start (#818) of
   deed een ander tabblad dat, dan zette één klik de oude kopie terug. Wat er veranderde:
   - `useStudioSettings` leest bij elke `StorageEvent` op `ops-reportSettings` opnieuw
     (`useStoredSettingRefresh`), meteen in de gebeurtenis en niet via een effect: anders kon een klik nog tussen
     de gebeurtenis en het lezen vallen. Een stand die net uit de opslag kwam, schrijft de hook niet terug. Een
     openstaand "Ongedaan maken" vervalt bij zo'n verversing; het zou de stand van vóór Standaard over de
     vernieuwde stand zetten.
   - `ReportWorkspace` volgt het rapporttype uit de vernieuwde stand.
   - Het oude paneel (`ReportPanel`, flag uit) had de verversing al (`useStoredSettingRefresh`, sinds #818) en
     laadt daarbij ook de velden van het nieuwe tabblad opnieuw; daar zat de fout niet.
   - Het nieuwe tabblad houdt verder geen eigen kopie van een `ops-`-sleutel: de previewkwaliteit, datum- en
     tijdnotatie en de balkkleuren komen uit de store, en die zet de host zelf bij (`processLateSettings`).
   Bewijs: de werkroute in `tests/browser/report-studio.spec.ts` speelt Sols scenario (A3 met zes kolommen, de
   opslag wordt A1 met alleen Taaknaam plus een `StorageEvent`, dan een klik op Staand, dan de opgeslagen waarde
   lezen) en daarna een vernieuwd rapporttype. Zonder de verversing in `useStudioSettings` schrijft de klik
   `paperSize: "A3"` met de zes oude kolommen terug; zonder de verversing in `ReportWorkspace` blijft het nieuwe
   tabblad staan bij een ander rapporttype.

2. **Arabische tekst werd met Noto Sans Arabic gemeten maar in een andere letter getekend.** Oorzaak: de meting
   (papier, kolombreedtes, PDF) gebruikt Noto Sans Arabic, maar het scherm registreerde alleen de rapportletter en
   Inter. De browser tekende Arabisch dus in een systeemletter: Sols naam meet 175,068 px en werd 183,016 px
   getekend, tot x = 218,016 bij een kolomlijn op 214. In het oude voorbeeld (flag uit) kapte het canvas dezelfde
   naam af. Bij het nalopen bleek hetzelfde voor elke lange Latijnse naam in het oude voorbeeld: het canvas rondt
   op Linux elke letterbreedte af (115 px tegen 109,0 px) en kapte de langste naam af terwijl afkappen uit stond.
   En een teken dat geen meegeleverde letter heeft (Chinees zonder CJK-extensie, Lao) mat de lege glyph van Inter.
   Wat er veranderde (zie ook `.claude/rules/reports.md`, "Het scherm tekent met dezelfde letters als het meet"):
   - `ensureReportFontLoaded` laadt ook Noto Sans Arabic als `@font-face` (familie `OpsReportArabic`, met een
     `unicode-range` voor Arabisch schrift en neutrale tekens).
   - Een tekst met Arabisch of Hebreeuws tekent het scherm met `reportTextFont` (`reportFont.ts`): Noto vóór de
     rapportletter en kerning aan, zoals de shaping-kern hem in de PDF zet. SVG via de letterklasse, canvas in
     `CanvasDraw2D`. De vaste letterstapel zelf bleef gelijk.
   - Canvas en browsermeting zetten `textRendering = 'geometricPrecision'` (gemeten: 109,002 px tegen 109,0 px uit
     het fontbestand).
   - Een tekst die `coversReportText` niet dekt, meet met het canvas: die tekent het scherm in een systeemletter en
     de PDF dan als raster.
   Gemeten na de fix (headless Chromium, dev-server, Inter 9 px): Sols naam meet 175,068 px; het papier tekent
   175,078 px (einde 210,078 bij kolomlijn 214), het canvas 175,069 px. Zonder kerning was het 175,703 px. Bewijs: een nieuwe route in `report-studio.spec.ts` meet de
   werkelijk getekende tekst (`getBBox` en `getComputedTextLength` tegen de getekende kolomlijn, canvas via een
   meelezende `fillText`) voor de Arabische naam, een lange Latijnse naam en een Chinese naam, op het papier en in
   het oude voorbeeld. Rood zonder de fix, elk met een kopie in `/tmp` gemuteerd en met `cp` teruggezet: zonder
   schermletter 183,016 px en einde 218,016 bij lijn 214; zonder kerning 175,703 px; zonder schermletter op het
   canvas en zonder `geometricPrecision` kapt het oude voorbeeld de naam af ("… ومتابعة ا…",
   "… over de bouwlo…"); zonder browsermeting meet de Chinese naam 76,8 px tegen 117 px getekend.
   Wat overblijft: een neutraal teken op een links-naar-rechtsniveau in een Arabische tekst (de spatie in "Fase 1"
   vóór een Arabisch woord) zet de PDF in de rapportletter en de browser in Noto: 0,19 px per spatie bij 9 px
   Inter. Een CJK-extensie tekent alleen in de PDF (knownbug 967, bijgewerkt). Het canvas kapt nog af met zijn
   eigen meting (knownbug 968, bijgewerkt).

3. **VERVOLG uit dezelfde review.** De commentaren in `check-report-columns.ts` (sectie 1) en
   `check-report-svg.ts` (sectie 5) beloven niet meer dan ze doen: de eerste vergelijkt de huidige render met
   zichzelf, de tweede twee uitkomsten van dezelfde meting. De werkelijk getekende grens bewaakt de browserspec.

## Fixronde na code-review 2 (9 november 2026)

Code-review ronde 2 van GPT-6.1-Sol (xhigh) op `58bfe4cfd`: oordeel nee, door één BLOKKEERT-punt. De fix voor
de instellingen uit ronde 1 was bevestigd, ook bij een late host. De UI bleef ongewijzigd.

1. **Een gemengde Latijns-Arabische naam werd anders gemeten dan getekend.** Oorzaak: de browser kiest de letter
   per teken, niet per bidi-run. Een tekst met Arabisch of Hebreeuws tekent het scherm met Noto vooraan, en de
   `unicode-range` van Noto bevat de spaties. Elke spatie kwam dus uit Noto, ook in het Latijnse deel. De
   shaping-kern van de PDF, en dus de meting, gaf een spatie op een links-naar-rechtsniveau de rapportletter. Per
   spatie scheelt dat het verschil tussen twee spaties (Carlito 0,226 em, Noto 0,260 em), en dat telt op. Sols
   naam in Carlito ("Fase 1 أعمال البناء en afstemming … van de bouwplaats") mat 409,797 px; Chromium tekende
   414,406 px, tot x = 448,881 bij kolomlijn 447; WebKitGTK tot 448,391. Het oude voorbeeld kapte hem af
   ("… bouwpla…"), terwijl afkappen uit stond.

   Besluit (bouwer van deze fixronde, 9 november 2026, op grond van Sols rapport en eigen metingen in beide
   engines): de PDF en de meting volgen de letterkeuze van de browser. `fontClassFor` (`bidiShape.ts`) geeft een
   neutraal teken dat Noto heeft altijd Noto, in elk stuk van de tekst en in beide richtingen. Het scherm bleef
   gelijk. Het alternatief was: Noto achter de rapportletter in de stack, zonder spaties in de `unicode-range`, en
   de PDF de spaties in de rapportletter laten zetten. Waarom niet: (a) de browserkant is in beide engines gemeten
   en geeft elke spatie uit Noto; (b) het alternatief verandert de PDF van elke Arabische naam (de spaties tussen
   Arabische woorden) en splitst elke Arabische naam bij elke spatie in losse runs; (c) het hangt af van hoe elke
   engine een spatie binnen een Arabische run aan een letter geeft, en dat is niet gemeten. Gevolg in de PDF:
   alleen in een gemengde tekst komen de spaties (en ZWNJ/ZWJ) van het Latijnse deel nu uit Noto. Noto mist de
   streepjes, aanhalingstekens en het beletselteken; die blijven in beide in de rapportletter. Kosten: een gemengde
   naam heeft meer runs. De meting van Sols naam in Carlito gaat van ongeveer 1,4 naar 2,2 ms, eenmalig per tekst
   (er is een cache).

   Bij het nalopen van een naam met cijfers en leestekens bleek nog iets: fontkit kernde een stuk zonder letter
   ("2.3") als script DFLT, Chromium en WebKitGTK als Latijn (Inter "2.3" op 9 px: 13,157 tegen 13,399 px).
   `layoutRuns` geeft zo'n stuk nu het script `latn`.

   Gemeten na de fix (dev-server, 9 px, 100 %, naam Volledig): vier rapportletters (Inter, Liberation Sans,
   Carlito, Liberation Serif) × vijf namen (volledig Arabisch uit ronde 1, Hebreeuws, Sols gemengde naam, een
   gemengde naam met cijfers en leestekens, Chinees), op het papier (SVG) en op het oude canvas (flag uit). In
   WebKitGTK 2.52.6 is de tekening in alle 40 gevallen gelijk aan de meting, tot op 0,001 px. In Chromium 151 ook
   (papier tot 0,04 px, canvas tot 0,001 px), op één naam na op het papier (zie "Wat overblijft"). Elke naam eindigt minstens 2,6 px vóór de kolomlijn, en het canvas
   tekent elke naam volledig. Sols naam in Carlito: meting 414,377 px; Chromium tekent 414,406 px tot 448,881 bij
   kolomlijn 452; WebKitGTK 414,377 px tot 448,391 bij 452; het canvas tekent hem in beide volledig.

   Bewijs: de bestaande route in `tests/browser/report-studio.spec.ts` (het blok met de Arabische naam) heeft er
   stappen bij: de Chinese naam ook op het canvas, Sols gemengde naam in Inter op canvas en papier, een gemengde naam
   met cijfers en leestekens in Inter op canvas en papier, en daarna Carlito via een echte klik in de keuzelijst
   van de stap Pagina, met Sols naam op papier en canvas. `check-report-svg.ts` punt 8 legt vast dat de
   shaping-kern per teken dezelfde letter kiest als de browser (Inter en Carlito, beide richtingen, drie namen).
   Rood zonder de fix, met een kopie in `/tmp` gemuteerd en met `cp` teruggezet: met de oude regel in
   `fontClassFor` faalt de spec bij de eerste gemengde stap (Inter-canvas 466,712 tegen gemeten 469,580); met
   alleen de Carlito-stappen geeft hij Sols getallen (getekend 414,406 tegen 409,797, einde 448,881 voorbij lijn
   447, canvas "… bouwpla…"); punt 8 van de planningscheck noemt elke spatie in F0. Zonder het script `latn`
   faalt de stap met "2.3" (canvas 0,242 px breder dan gemeten).

   Wat overblijft: in de SVG van Chromium (niet op het canvas, niet in WebKitGTK) krijgt een leesteken dat op een
   Arabisch woord volgt het script van dat woord. De kerning met de Latijnse letter erna valt dan weg: “gereed na
   een Arabisch woord tekent 0,36 px breder dan gemeten (Inter en Carlito). Zo'n naam blijft binnen de vaste marge
   van de naamkolom (+1 px en 2 px rechts); gemeten 3,36 px (Inter) en 3,47 px (Carlito) ruimte tot de kolomlijn. Niet gerepareerd: het volgt uit de scriptindeling
   van Chromium. Knownbug 968 is bijgewerkt.

2. **VERVOLG, nu meegenomen: de app-instelling Previewkwaliteit overleefde laden niet.** Oorzaak: de algemene
   lader (`getSetting`) leest de opgeslagen tekst `300` als JSON, dus als het getal 300; de parser accepteerde
   alleen de tekst `'300'`. Na herladen stond de store weer op `'200'`, ook via de late host, die dezelfde
   `loadAllSettings` gebruikt. Wat er veranderde: `parseReportPreviewQuality` in `settingsRegistry.ts` zet een van
   de drie getallen terug naar zijn tekst. De algemene opslag bleef gelijk. Bewijs: `check-first-start.ts` C6
   (elke instelling uit het register komt na bewaren en laden terug, met haar standaard uit de store) en C7
   (Previewkwaliteit 100, 200 en 300 via `saveReportPreviewQuality`). Rood zonder de fix: C6 meldt
   `reportPreviewQuality: "200" → undefined`, C7 `[null, null, null]`. Bij C6 bleek dit de enige van de 41
   registerinstellingen met deze fout.

3. **VERVOLG uit dezelfde review: de fonttests draaiden alleen in Inter.** Gedekt door punt 1 (Carlito, gemengde
   namen, de Chinese naam ook op het canvas) en punt 2 (bewaren en laden). Geen nieuwe testlaag. WebKit draait niet
   in de browsersuite; de WebKit-getallen hierboven komen uit dezelfde meting als Sols proef (Python-GI met
   WebKitGTK 2.52.6, tegen de dev-server).
