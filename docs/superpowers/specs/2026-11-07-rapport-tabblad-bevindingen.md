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

- **Indeling.** Links een zijbalk met zes stappen in de volgorde van het papier: Taken, Kolommen,
  Balken en tijdlijn, Pagina, Kop en voet, Opslaan (PDF). Eén stap tegelijk open; een dichte stap toont
  één regel samenvatting. Elke stap heeft "Standaard" met "Ongedaan maken". Waarschuwingen staan in de
  stap waar je ze oplost (bijv. "De tabel neemt 41 % van de breedte; de tijdlijn wordt smal").
- **Zijbalk inklappen** tot een rand met stapiconen (Ctrl+\). Een klik op een icoon of op het papier
  opent dezelfde stap als klein venster naast dat deel. Ingeklapt staat linksonder de ronde knop
  "PDF exporteren"; die doet hetzelfde als de stap Opslaan.
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

### Afwijkingen van het ontwerp

- **Periode** zit niet in de stap Taken: `renderReport` slaat relaties over als er een tijdvenster is.
  Zonder relaties is de Gantt-afdruk niet wat een planner verwacht.
- **"Zoals de tabel"** neemt de kolommen van de tabel naast de Gantt (`gantt-task-grid`), niet van de
  losse Tabel-weergave.
- Geen B2-iconen voor greep, slot en papierstand: die bestaan niet. Greep = CSS-puntjes, ↑/↓ als tekst,
  het slot is weg ("verplicht" als tekst).
- De andere elf rapporten gebruiken het oude paneel.
