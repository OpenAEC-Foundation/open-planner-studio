# Plannen & WBS

Een planning begint met een taakstructuur: welke taken zijn er, hoe zijn ze onderverdeeld in fasen, en welke momenten zijn zo belangrijk dat ze een mijlpaal verdienen? Deze gids gaat dieper op dat fundament in dan de gids [Snel starten](docs://quick-start) — hier lees je niet alleen *hoe* je inspringt, maar ook wat een samenvattende taak precies doet, hoe de drie soorten mijlpalen van elkaar verschillen, hoe je taken van eigen codes en velden voorziet, en hoe je aantekeningen bijhoudt per taak.

## Wat je hier leert

- Een taakstructuur (WBS) opbouwen met inspringen en samenvattende taken.
- Taken verplaatsen binnen dezelfde structuur, zonder opnieuw in te springen — met het toetsenbord,
  door te slepen, of op het spreadsheet-achtige tabblad **Tabel**.
- De drie mijlpaal-soorten en het aparte verplicht-vlag voor contractuele momenten.
- Activity codes en gebruikersvelden beheren via het venster **Codes & velden**, en erop groeperen.
- Aantekeningen (een checklist per taak) gebruiken om openstaand werk bij te houden.

Volg je liever mee met een compleet voorbeeld? Open [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) via **Bestand → Voorbeelden** — de fasering "1. Voorbereiding" / "2. Fundering & ruwbouw" / "3. Afbouw" / "4. Oplevering" met hun subtaken is precies de structuur die hieronder wordt uitgelegd.

## Een taakstructuur opbouwen

Een platte lijst taken vertelt niets over samenhang. Door taken in te laten springen onder een andere taak, ontstaat een boomstructuur (WBS — Work Breakdown Structure): de bovenliggende taak wordt dan automatisch een **samenvattende taak**.

1. Selecteer de taak die je dieper in de structuur wilt zetten.
2. Druk op **Alt+→** om in te springen. Er is ook een tweede toetscombinatie voor dezelfde actie: **Alt+Shift+→** — handig als je toetsenbordindeling Alt+→ al voor iets anders gebruikt. Beide doen precies hetzelfde.
3. Wil je liever met de muis werken? Rechtsklik op de taak en kies **Inspringen** in het contextmenu.
4. Ging je een niveau te ver? **Alt+←** (of rechtsklik → **Uitspringen**) zet de taak weer een niveau terug.
5. Voor een compleet nieuwe subtaak is er een snellere weg: rechtsklik op de bovenliggende taak en kies **Subtaak toevoegen**. Dat maakt in één keer een nieuwe taak aan die al is ingesprongen, in plaats van eerst een taak toe te voegen en die daarna apart in te laten springen.

Zodra een taak minstens één subtaak heeft, wordt hij automatisch een samenvattende taak: de balk in het Gantt-diagram overspant dan de volledige periode van de vroegste start tot de laatste finish van alle subtaken eronder, en zijn eigen duur en data zijn niet langer los in te stellen. Een samenvattende taak is dus normaal gesproken altijd een afgeleide, geen los ingevoerde planning — verwijder of verschuif je de subtaken, dan past de balk van de samenvattende taak zich vanzelf aan. Eén uitzondering: een **handmatig geplande** samenvattingstaak (die vlag ontstaat bij een `.mpp`-import) rolt juist niét op — die houdt haar eigen opgeslagen datums, ook als haar subtaken verschuiven.

**Inklappen en uitklappen.** Bij een grote WBS wil je de boom soms tijdelijk compacter maken. Het lint-tabblad **Beeld**, groep **Overzicht**, heeft daarvoor twee aparte knoppen — **Inklappen** en **Uitklappen** — bewust geen schakelaar, want bij een gemengde selectie (de ene tak open, de andere dicht) kan een schakelaar nooit alles dezelfde kant op zetten.

- **Met een selectie** werken de knoppen op de geselecteerde taken; alleen taken mét subtaken doen mee, losse taken worden genegeerd.
- **Zonder selectie** werken ze op de hele planning. Deselecteer met **Esc**, of klik in een leeg gebied van de balkenweergave.
- In een gegroepeerde weergave (zie *Groeperen op codes en velden* verderop) klappen de knoppen de groepsbanden in/uit — inclusief geneste banden — in plaats van de taken.

Het pijltje vóór een samenvattende taak blijft daarnaast gewoon werken om die ene tak los te openen of te sluiten.

### Een nieuwe taak op de juiste plek invoegen

Nieuwe taken hoeven niet onderaan te landen. Alle knoppen en toetsen die een taak aanmaken volgen
dezelfde regel:

- **Is er een taak geselecteerd**, dan komt de nieuwe taak direct **onder** die taak — en niet
  onderaan de hele lijst. Hij erft daarbij het niveau en de bovenliggende taak van je selectie, dus
  een nieuwe taak binnen een fase blijft binnen die fase.
- **Is er niets geselecteerd**, dan komt hij achteraan, zoals altijd.
- **Zijn er meerdere taken geselecteerd**, dan landt hij onder de **onderste** taak van je selectie
  zoals je die op het scherm ziet — niet midden in de selectie, en het maakt niet uit in welke
  volgorde je ze hebt aangeklikt.

Heeft de nieuwe taak daarbij een bovenliggende taak (via selectie, of doordat je **Subtaak
toevoegen** gebruikt), dan neemt ze ook het **Type** van die ouder over in plaats van de gewone
standaardwaarde — een nieuwe taak binnen "2. Fundering & ruwbouw" krijgt dus meteen dezelfde
balkkleur als de rest van die fase. Dat gebeurt alleen op het moment van aanmaken; een bestaande
taak later inspringen of verslepen laat haar Type met rust.

Dat geldt voor de knop **Taak** en het keuzemenu **Mijlpaal** in de lintgroep **Taken**, en voor
**Nieuwe taak** in het contextmenu. Die lintgroep staat op het tabblad **Start** én op het tabblad
**Tabel**, met dezelfde drie knoppen (**Taak**, **Mijlpaal**, **Relatie**), zodat je voor het
invoeren van taken niet meer tussen tabbladen hoeft te wisselen.

Met het toetsenbord gaat het nog sneller:

- **Insert** voegt een taak **boven** de selectie in.
- **Ctrl+I** (**Cmd+I** op macOS) voegt een taak **onder** de selectie in — precies waar je bij het
  doorwerken van een lijst meestal naartoe wilt.

Beide staan ook in het sneltoetsenoverzicht (**Ctrl+/**), onder de categorie **Structuur**.

**Alleen in de gewone boomweergave.** Invoegen boven of onder is een structuur-ingreep, en die is
alleen zinvol zolang de getoonde volgorde ook de werkelijke volgorde is. Staat er een filter, een
sortering of een groepering aan, dan zou de nieuwe taak ergens anders opduiken dan waar je hem
neerzette. De app weigert dan het invoegen boven/onder en toont een strook die uitlegt waarom, met
een knop om de filter-, sorteer- en groepeerstanden in één klik te wissen. De knoppen **Taak** en
**Mijlpaal** blijven in dat geval gewoon werken, maar zetten de taak achteraan — met dezelfde
uitleg erbij.

### Taken herschikken zonder opnieuw in te springen

Naast het aanpassen van het niveau (indent/outdent) kun je een taak ook binnen hetzelfde niveau van plaats laten wisselen, zonder de structuur zelf te wijzigen:

- **Alt+↑** verplaatst de geselecteerde taak omhoog, boven de taak die er nu boven staat.
- **Alt+↓** verplaatst de taak omlaag.

Dit werkt op elk niveau van de boom: verplaats je een fasetaak, dan verhuizen al haar subtaken vanzelfstandig mee.

Liever met de muis? Pak een taak vast aan zijn rij in de taaktabel (de linkerkolom van de
Gantt-weergave, met hetzelfde sleepgedrag op het tabblad **Tabel**) en sleep hem omhoog of omlaag.
Laat hem tussen twee rijen los om hem tussen zijn broers/zussen te herschikken, net als Alt+↑/↓. Laat
hem in plaats daarvan los op het onderste deel van de rij van een samenvattende taak, en hij nestelt:
de taak wordt de nieuwe, laatste subtaak van die samenvattende taak — opnieuw inspringen in één
beweging, het muis-equivalent van Alt+→. Selecteer eerst meerdere taken (Ctrl/Cmd-klik, of een
box-selectie) en de hele selectie sleept en landt samen.

Het lint-tabblad **Tabel** toont diezelfde structuur als een gewoon, bewerkbaar raster, handig als je
in één keer veel taken invoert of corrigeert: één klik op een bewerkbare cel start meteen de
bewerking met de bestaande waarde geselecteerd, de pijltjestoetsen verplaatsen een celcursor zonder
hem te openen, **F2**/**Enter** opent de huidige cel voor bewerking, en **Tab**/**Shift+Tab** op een
geselecteerde rij springt hem in/uit, net als Alt+→/←. **Enter** of **↓** op de allerlaatste rij maakt
daar meteen een nieuwe zustertaak met de cursor al in de naamcel, zodat je een hele lijst kunt
doorwerken zonder de muis aan te raken — dit werkt alleen in de gewone boomweergave, want met een
filter, sortering of groepering actief zou de nieuwe taak meteen buiten beeld kunnen vallen, dus
vraagt de app dat eerst na in plaats van stilzwijgend een taak te plaatsen die je niet ziet.

## Mijlpaal-soorten

Een mijlpaal markeert een moment — een start, een oplevering, een keuring — en heeft normaal gesproken duur 0; heeft een mijlpaal zelf een duur groter dan 0 gekregen (bijvoorbeeld via een import), dan plant Open Planner Studio 'm gewoon als een taak met die duur, met het vinkje **Mijlpaal** nog aan. Open Planner Studio kent drie manieren om een mijlpaal toe te voegen, allemaal via de lintgroep **Taken** op het pijltje naast de knop **Mijlpaal**:

- **Startmijlpaal** — markeert het begin van een fase of het project.
- **Eindmijlpaal** — markeert een afronding, bijvoorbeeld een oplevering.
- **Inspectiemoment (verplicht)** — in de praktijk een eindmijlpaal met het vlag **Verplicht (contractueel)** meteen aangevinkt én het Type direct op **Keuring/Inspectie** gezet, zodat een keuringsmoment vanaf het begin als contractueel verplicht én als keuring herkenbaar is.

Gebruik je liever de sneltoets **Ctrl+M**, dan krijg je een generieke mijlpaal ("Nieuwe mijlpaal") die je vervolgens zelf hernoemt en typeert.

Deze soort-indeling zie je terug in het eigenschappenpaneel, zodra je een mijlpaal selecteert en het vinkje **Mijlpaal** aanstaat: het veld **Soort mijlpaal** biedt **Automatisch**, **Startmijlpaal** of **Eindmijlpaal**. "Automatisch" laat de planningsengine zelf bepalen hoe de mijlpaal zich gedraagt op basis van zijn relaties — kies dit als de mijlpaal geen uitgesproken start- of eindkarakter heeft. Los daarvan staat het vinkje **Verplicht (contractueel)**: dat markeert een mijlpaal als contractueel bindend, onafhankelijk van of het een start- of eindmijlpaal is. Zo kun je bijvoorbeeld een startmijlpaal ook verplicht maken, of — zoals bij **Inspectiemoment** — meteen een verplichte eindmijlpaal klaarzetten.

## Codes & velden: activity codes en gebruikersvelden

Grotere planningen hebben al snel behoefte aan extra dimensies die niet in de WBS passen: per welke woning, welke discipline, welke aannemer. Daarvoor zijn er **activity codes** en **gebruikersvelden**, beide te beheren via het venster **Codes & velden** (lintgroep **Structuur** op het tabblad **Planning**, of het pijltje-icoon met de naam **Codes & velden**).

- **Activity codes** zijn vrij definieerbare dimensies (bijvoorbeeld "Locatie" of "Discipline") met een lijst waarden — elke waarde heeft een **Code**, een **Omschrijving** en een **Kleur**. Een taak kan per codetype maximaal één waarde hebben. Gebruik **Codetype toevoegen** om een nieuwe dimensie te starten, en **Waarde toevoegen** om de mogelijke waarden op te bouwen.
- **Gebruikersvelden** zijn getypeerde eigen velden — **Tekst**, **Getal**, **Geheel getal**, **Kosten**, **Datum** of **Ja/nee** — die als kolom in de taaktabel verschijnen en per taak in te vullen zijn. Denk aan een veld "Aannemer" (tekst) of "Vergunning binnen" (ja/nee).

Eenmaal aangemaakt, wijs je een activity code of vul je een gebruikersveld in via de kolommen in de taaktabel (zet ze eventueel eerst zichtbaar via **Beeld → Kolommen…**) of via het eigenschappenpaneel van de taak.

### Groeperen op codes en velden

Activity codes en gebruikersvelden worden pas echt nuttig zodra je erop groepeert: ga naar het lint-tabblad **Beeld**, open **Groeperen** en kies bij **Veld** de activity code of het gebruikersveld waarop je wilt clusteren. De taaktabel toont dan groepskoppen in plaats van de WBS-boom — handig om bijvoorbeeld alle taken per woning of per discipline bij elkaar te zien, dwars door de fasering heen. Je kunt tot twee groepeerniveaus tegelijk instellen (bijvoorbeeld eerst op woning, dan op discipline).

## Aantekeningen: een checklist per taak

Elke taak heeft een sectie **Aantekeningen** in het eigenschappenpaneel — in feite een kleine checklist die bij de taak blijft horen. Dit is bedoeld voor het soort losse actiepunten die niet in een planningsdatum passen: "nog navragen bij de aannemer", "materiaal nog bestellen", "tekening v2 afwachten".

1. Klik op **+ aantekening toevoegen**. Er verschijnt een nieuwe, lege regel met focus in het tekstveld.
2. Typ de tekst van de aantekening.
3. Vink het selectievakje aan zodra het punt is afgehandeld — de tekst krijgt dan een doorhaling, maar de aantekening blijft zichtbaar (afgevinkt in plaats van verwijderd) zodat de geschiedenis van een taak leesbaar blijft.
4. Gebruik het prullenbak-icoon om een aantekening definitief te verwijderen.

Aantekeningen zijn puur informatief: ze doen niets met de planning of de berekening, en zijn dus het aangewezen middel voor kanttekeningen die niet in een datum of duur zijn uit te drukken. Zie een mix van open en afgevinkte aantekeningen in de praktijk in de middelgrote showcase "Nieuwbouw 6 Rijwoningen De Akkers" (tag *aantekeningen* in **Bestand → Voorbeelden**).

## Verder lezen

- Zie deze structuur — fasering, samenvattende taken, mijlpalen — in de praktijk in [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Nu de structuur staat, is de volgende stap taken aan elkaar koppelen: lees de gids [Relaties & constraints](docs://gids-relaties-constraints).
- Nog nieuw in Open Planner Studio? Begin bij de gids [Snel starten](docs://quick-start) voor een doorlopende oefening van leeg project tot berekende planning.
