# Je eerste planning in 10 minuten

Deze gids neemt je in ongeveer 10 minuten mee van een leeg project naar een volledig doorgerekende bouwplanning: taken toevoegen, een taakstructuur opbouwen, relaties leggen, berekenen en opslaan. Geen theorie vooraf — je doet het gewoon, stap voor stap, met de knoppen en menu's die je in Open Planner Studio ook echt tegenkomt.

## Wat je gaat doen

1. Een nieuw project aanmaken.
2. Taken toevoegen — via het lint, de taaktabel en het Gantt-diagram.
3. De taken in een structuur (WBS) zetten met inspringen.
4. Relaties tussen taken leggen.
5. De planning berekenen.
6. Het resultaat lezen: kritiek pad en speling.
7. Opslaan.

Wil je liever eerst zien waar je naartoe werkt? Open het voorbeeldproject [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) via **Bestand → Voorbeelden**. Het is een kleine, overzichtelijke planning die vrijwel elke stap hieronder al laat zien — handig om naast dit artikel open te houden en mee te vergelijken.

Alles hieronder werkt identiek in de desktop-app en in de browserversie: dezelfde knoppen, dezelfde menu's, dezelfde sneltoetsen.

## Stap 1 — Een nieuw project aanmaken

1. Klik op het lint-tabblad **Bestand**. Dit opent het bestandsscherm.
2. Klik op **Nieuw** (of gebruik de sneltoets **Ctrl+N** als je al in een ander project werkt). Het dialoogvenster **Nieuw project** verschijnt.
3. Vul een **Projectnaam** in, bijvoorbeeld "Mijn eerste planning", en controleer de **Startdatum** — standaard staat die op vandaag.
4. Kies bij **Fasering-template** voor **Leeg**. De templates **Woningbouw** en **Utiliteitsbouw / renovatie** zetten alvast een paar fase-taken voor je klaar, maar voor deze oefening bouw je alles zelf op zodat je elke stap herkent.
5. Laat de kalenderopties op hun standaardwaarde staan en klik op **Aanmaken**.

Je krijgt nu een leeg project: een lege taaktabel links, een leeg Gantt-diagram rechts, en een werkkalender die al klaarstaat op basis van de standaardinstellingen.

## Stap 2 — Taken toevoegen

Zorg dat je op het lint-tabblad **Start** staat. Dit tabblad toont de taaktabel (links) en het Gantt-diagram (rechts) naast elkaar — dit zijn twee kanten van dezelfde planning, dus een taak die je toevoegt verschijnt meteen op beide plekken.

### Via het lint

1. Klik in de lintgroep **Taken** op de knop **Taak**. Er verschijnt een nieuwe taak genaamd "Nieuwe taak" met een duur van 5 werkdagen, onderaan zowel de taaktabel als het Gantt-diagram.
2. Herhaal dit een paar keer tot je een taak hebt voor elke hoofdfase van je project. Volg je het voorbeeldproject mee, gebruik dan dezelfde hoofdfasen als daarin: "1. Voorbereiding", "2. Fundering & ruwbouw", "3. Afbouw" en "4. Oplevering".
3. Dubbelklik op een taak — in de tabel of op de balk in het Gantt-diagram — om het venster **Taak bewerken** te openen. Pas hier de **Naam**, het **Type** en de **Duur (werkdagen)** aan naar wat bij jouw fase past.

### Via de taaktabel en het Gantt-diagram

Je hoeft niet steeds terug naar het lint. Rechtsklik op een **lege rij** in de taaktabel, of op een lege plek in het Gantt-diagram (waar nog geen taak staat), en kies **Nieuwe taak** in het contextmenu.

Rechtsklik je in plaats daarvan op een **bestaande** taak, dan krijg je een ander contextmenu met onder meer:

- **Invoegen boven** / **Invoegen onder** — voegt een taak in vóór of na de taak waarop je rechtsklikte.
- **Subtaak toevoegen** — maakt in één keer een nieuwe taak aan als kind van die taak (zie stap 3 voor wat dat betekent).

Typte je iets verkeerd, of voegde je een taak op de verkeerde plek toe? **Ctrl+Z** maakt de laatste actie ongedaan, **Ctrl+Y** (of **Ctrl+Shift+Z**) voert hem opnieuw uit — beide werken door de hele planning heen, niet alleen op tekstvelden.

### Een mijlpaal toevoegen

Elke planning heeft ten minste één mijlpaal nodig, bijvoorbeeld voor de oplevering. Klik in de lintgroep **Taken** op het pijltje naast **Mijlpaal** en kies **Eindmijlpaal**, **Startmijlpaal** of **Inspectiemoment (verplicht)** — of gebruik de sneltoets **Ctrl+M** voor een snelle, generieke mijlpaal ("Nieuwe mijlpaal") die je daarna hernoemt.

## Stap 3 — Een taakstructuur (WBS) opbouwen

Een platte lijst taken wordt al snel onoverzichtelijk. Door taken in te laten springen bouw je een taakstructuur (WBS) op: de taak erboven wordt dan automatisch een **samenvattende taak** die de volledige periode van haar subtaken overspant.

1. Selecteer een taak die onder een andere taak moet vallen — bijvoorbeeld "Fundering aanbouw" onder de fasetaak "2. Fundering & ruwbouw".
2. Druk op **Alt+→** om in te springen, of rechtsklik en kies **Inspringen** in het contextmenu. De taak erboven wordt meteen zichtbaar als samenvattende taak.
3. Ging je te ver, of wil je een taak weer op het hoofdniveau zetten? Gebruik **Alt+←**, of rechtsklik en kies **Uitspringen**.
4. Handiger voor een compleet nieuwe subtaak: rechtsklik op de bovenliggende taak en kies **Subtaak toevoegen** — dat scheelt de losse stap toevoegen + inspringen.

Herhaal dit tot je een paar niveaus diep zit. In het voorbeeldproject valt de fase "2. Fundering & ruwbouw" bijvoorbeeld uiteen in de subtaken "Grondwerk aanbouw", "Fundering aanbouw", "Begane grondvloer storten", "Wanden opmetselen" en "Dakconstructie plaatsen".

Dit artikel behandelt WBS-opbouw alleen praktisch, om je op gang te helpen. Wil je weten hoe mijlpaal-soorten, samenvattende taken en activity codes precies samenwerken, lees dan de gids [Plannen & WBS](docs://gids-plannen-wbs).

## Stap 4 — Relaties leggen

Taken zonder relaties staan los van elkaar en verschuiven niet mee als je een voorgaande taak wijzigt. Een relatie (afhankelijkheid) koppelt twee taken aan elkaar.

1. Zorg dat de balken van de twee taken die je wilt koppelen zichtbaar zijn in het Gantt-diagram.
2. Houd **Shift** ingedrukt en sleep vanaf de balk van de voorganger naar de balk van de opvolger. Zodra je loslaat, ontstaat er direct een relatie van het type **Finish-Start (FS)** met een lag van 0 werkdagen — de meest voorkomende relatie: de opvolger start pas als de voorganger klaar is.
3. Meteen na het loslaten verschijnt het venster **Type relatie**. Hier kun je het relatietype aanpassen (**FS**, **SS**, **FF** of **SF**) en een **lag** invullen, bijvoorbeeld `2d` voor twee werkdagen wachttijd tussen de taken. In het kort: bij **FS** (Finish-Start) start de opvolger na afloop van de voorganger, bij **SS** (Start-Start) starten beide taken (ongeveer) gelijktijdig, bij **FF** (Finish-Finish) eindigen ze (ongeveer) gelijktijdig, en bij **SF** (Start-Finish) moet de voorganger starten voordat de opvolger mag eindigen — die laatste komt in de bouwpraktijk het minst voor.
4. Wil je in plaats daarvan twee taken koppelen zonder te slepen? Ga naar het lint-tabblad **Relaties** (of klik op **Beheer** in de lintgroep **Relaties** op het tabblad Planning), selecteer eerst de voorganger en dan (met Ctrl/Cmd ingedrukt) de opvolger, en gebruik de knop **Nieuwe relatie uit selectie** — die knop werkt alleen als er precies twee taken geselecteerd zijn, in die volgorde.

Leg voor de oefening minimaal twee relaties: bijvoorbeeld "1. Voorbereiding" → "2. Fundering & ruwbouw" en "2. Fundering & ruwbouw" → "3. Afbouw".

## Stap 5 — Berekenen

Nu je taken en relaties hebt, kun je de planning laten doorrekenen (CPM — Critical Path Method).

1. Druk op **F5**, of klik in de lintgroep **Planning** op de knop **Bereken**.
2. Open Planner Studio berekent nu voor elke taak de vroegste en laatste start- en einddatum, de speling, en welke taken op het kritieke pad liggen.
3. Voortaan zelf niet meer aan F5 hoeven denken? Zet in **Instellingen** de optie **Automatisch berekenen** aan. De planning herberekent zichzelf dan zodra hij verouderd raakt, in plaats van te wachten op een handmatige druk op F5.

## Stap 6 — Het resultaat lezen

- Onderin het scherm toont de statusbalk bijvoorbeeld "Kritiek pad: 4 taken, 62 werkdagen" zodra de planning berekend is. Heb je iets gewijzigd sinds de laatste berekening, dan staat daar in plaats daarvan "Verouderd — herbereken (F5)".
- In het Gantt-diagram krijgen kritieke taken — taken zonder speling, die dus direct de einddatum van het project bepalen — een andere kleur balk dan taken die nog ruimte (speling) hebben. Loopt een kritieke taak uit, dan schuift de hele projecteinddatum mee; een taak met speling kan uitlopen zonder gevolgen, zolang de speling niet op is.
- Dubbelklik op een taak om opnieuw het venster **Taak bewerken** te openen. Onder de sectie **CPM Resultaat** vind je per taak: **Vroegste start**, **Vroegste einde**, **Laatste start**, **Laatste einde**, **Totale speling**, **Vrije speling** en of de taak op het **Kritiek pad** ligt.
- Wil je deze gegevens ook als kolommen in de taaktabel zien, in plaats van per taak te moeten openen? Ga naar het lint-tabblad **Beeld**, klik in de groep **Weergave** op **Kolommen…** en vink **Kritiek** en **Totale speling** aan.

## Stap 7 — Opslaan

1. Druk op **Ctrl+S**, of klik in het tabblad **Bestand** op **Opslaan**. De eerste keer vraagt Open Planner Studio om een bestandsnaam en locatie; het project wordt opgeslagen als een natief IFC-bestand.
2. Wil je in plaats daarvan een kopie onder een andere naam bewaren, bijvoorbeeld om twee varianten naast elkaar te houden? Gebruik **Bestand → Opslaan als** (sneltoets **Ctrl+Shift+S**).

## Verder oefenen

- Speel de stappen hierboven nog eens na met een compleet voorbeeld: open [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) via **Bestand → Voorbeelden** en herken de FS-keten tussen de fasen, de SS-overlap tussen wand- en dakwerk, de FF-koppeling tussen tegel- en schilderwerk, en de vergunning-constraint (SNET) vóór de start.
- Meer weten over taakstructuur, samenvattende taken, mijlpaal-soorten en activity codes? Lees de gids [Plannen & WBS](docs://gids-plannen-wbs).
- Wil je liever een visuele rondleiding langs de belangrijkste onderdelen van het scherm? Herstart de rondleiding via het tabblad **Beeld** → knop **Rondleiding**, of via **Bestand** → **Rondleiding starten**.
