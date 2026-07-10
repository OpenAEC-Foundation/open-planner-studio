# Plannen & WBS

Een planning begint met een taakstructuur: welke taken zijn er, hoe zijn ze onderverdeeld in fasen, en welke momenten zijn zo belangrijk dat ze een mijlpaal verdienen? Deze gids gaat dieper op dat fundament in dan de gids [Snel starten](docs://quick-start) — hier lees je niet alleen *hoe* je inspringt, maar ook wat een samenvattende taak precies doet, hoe de drie soorten mijlpalen van elkaar verschillen, hoe je taken van eigen codes en velden voorziet, en hoe je aantekeningen bijhoudt per taak.

## Wat je hier leert

- Een taakstructuur (WBS) opbouwen met inspringen en samenvattende taken.
- Taken verplaatsen binnen dezelfde structuur, zonder opnieuw in te springen.
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

Zodra een taak minstens één subtaak heeft, wordt hij automatisch een samenvattende taak: de balk in het Gantt-diagram overspant dan de volledige periode van de vroegste start tot de laatste finish van alle subtaken eronder, en zijn eigen duur en data zijn niet langer los in te stellen. Een samenvattende taak is dus altijd een afgeleide, geen los ingevoerde planning — verwijder of verschuif je de subtaken, dan past de balk van de samenvattende taak zich vanzelf aan.

### Taken herschikken zonder opnieuw in te springen

Naast het aanpassen van het niveau (indent/outdent) kun je een taak ook binnen hetzelfde niveau van plaats laten wisselen, zonder de structuur zelf te wijzigen:

- **Alt+↑** verplaatst de geselecteerde taak omhoog, boven de taak die er nu boven staat.
- **Alt+↓** verplaatst de taak omlaag.

Dit werkt op elk niveau van de boom: verplaats je een fasetaak, dan verhuizen al haar subtaken vanzelfstandig mee.

## Mijlpaal-soorten

Een mijlpaal is een taak zonder duur die een moment markeert — een start, een oplevering, een keuring. Open Planner Studio kent drie manieren om een mijlpaal toe te voegen, allemaal via de lintgroep **Taken** op het pijltje naast de knop **Mijlpaal**:

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
