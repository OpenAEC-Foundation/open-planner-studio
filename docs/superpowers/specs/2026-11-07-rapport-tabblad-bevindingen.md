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
