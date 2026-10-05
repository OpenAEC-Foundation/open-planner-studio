# Een kalender maken en toewijzen

Doel: een eigen kalender maken, bijvoorbeeld een zesdaagse werkweek, en die geven aan de taken die erin moeten rekenen.

## Wanneer je dit nodig hebt

Een onderaannemer werkt ook op zaterdag. Een ploeg werkt alleen van maandag tot en met donderdag. Een taak valt in een periode waarin alleen die taak stilligt. In de projectkalender staan dan de verkeerde werkdagen. Met een eigen kalender rekent de app die taken op de juiste dagen door, en blijft de rest op de projectkalender. Wat de app precies met een kalender doet, lees je in [Kalenders en werkdagen](docs://uitleg-kalenders).

## Stappen

### Een kalender maken

1. Kies *Planning › Kalender › Kalender*. Dezelfde knop staat op *Instellingen › Kalender › Kalender*. Het venster *Kalenders* opent. Links staan de kalenders van het project; de projectkalender heeft een ster.
2. Klik onder de lijst op de knop met het plusteken (*Nieuwe kalender*). De nieuwe kalender is een kopie van de standaard: maandag tot en met vrijdag, 07:00 tot 16:00 met een uur pauze, en, als *Bouwmodus* aan staat, de Nederlandse feestdagen. Wil je een bestaande kalender als basis, kies die dan in de lijst en klik onder de lijst op de knop met de twee vellen (*Dupliceren*).
3. Geef de kalender bij *Naam* een naam die zegt wie hem gebruikt, bijvoorbeeld *Zesdaagse werkweek*.
4. Klik bij *Werkdagen* de weekdagen aan of uit. *Ma–vr* zet de standaardweek terug, met 07:00 tot 16:00. *Continu (24/7)* zet alle zeven dagen aan, van 00:00 tot 24:00.
5. Pas zo nodig de werktijden aan: *Begin (uur)*, *Einde (uur)*, *Pauze begint* en *Pauzeduur (minuten)*. Je typt tijden als UU:MM; met de pijltjes verhoog of verlaag je ze met een kwartier. Zet je de pauzeduur op 0, dan werkt de kalender zonder pauze. *Netto-uren per dag* rekent de app zelf uit. Staat Urenplanning aan en heeft de kalender werktijdblokken per weekdag, dan zie je deze velden niet; zie [Werktijden instellen](docs://howto-werktijden-instellen).
6. Pas zo nodig de feestdagen aan. Hoe dat werkt, staat in [Feestdagen en bouwvak genereren](docs://howto-feestdagen-genereren).
7. Klik op *Toepassen*. De app rekent de planning meteen opnieuw door en sluit het venster. Met *Annuleren* gooi je de wijzigingen weg. Enter in een invoerveld bewaart tussentijds en rekent ook door, zonder het venster te sluiten; *Annuleren* draait dan alleen terug wat je daarna nog wijzigde.

### Een kalender aan taken geven

Een nieuwe kalender doet pas iets als een taak hem gebruikt. Er zijn twee manieren.

**Via het paneel Eigenschappen**

1. Selecteer de taak. Zie je het paneel *Eigenschappen* niet, zet het dan aan met *Beeld › Panelen › Eigensch.*
2. Kies bij *Taak* in de keuzelijst *Kalender* de kalender. De bovenste keuze, *Projectkalender* met de naam erachter, betekent dat de taak geen eigen kalender heeft.

**Via het rechtermuismenu**

1. Klik met de rechtermuisknop op de taak, in de takenlijst of op de balk in de Gantt.
2. Kies *Kalender toewijzen* en dan de kalender, of *Projectkalender* om de eigen kalender weer weg te halen. De kalender die nu geldt, heeft een vinkje.
3. Wil je één kalender aan meer taken tegelijk geven, selecteer ze dan eerst met Ctrl (op een Mac ⌘) en klik met rechts op één van de geselecteerde taken. De keuze geldt voor alle geselecteerde taken. Klik je met rechts op een taak die niet geselecteerd is, dan geldt hij alleen voor die taak.

Een nieuwe kalenderkeuze maakt de planning nog niet nieuw: de statusbalk meldt *Verouderd — herbereken (F5)*. Druk op **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*. Staat *Automatisch berekenen* aan (*Instellingen › Project › Instellingen*, tabblad *Planning*, kopje *Berekenen*), dan doet de app dat zelf.

### De projectkalender wisselen

1. Open *Planning › Kalender › Kalender* en kies de kalender in de lijst.
2. Klik boven het formulier op *Als projectdefault*. De ster verhuist naar die kalender.
3. Klik op *Toepassen*.

Alleen de taken zonder eigen kalender gaan mee.

### Een kalender verwijderen

1. Open het venster *Kalenders* en kies de kalender in de lijst.
2. Klik onder de lijst op de knop met de prullenbak (*Verwijderen*). Die knop is uitgeschakeld zolang er maar één kalender is.
3. Klik op *Toepassen*. Taken en resources die de kalender gebruikten, vallen terug op de projectkalender. Verwijder je de projectkalender zelf, dan wordt de eerste kalender in de lijst de projectkalender.

## Valkuilen en wat de app dan doet

**Geen werkdagen.** Zet je alle weekdagen uit, dan kan de app niet rekenen. Bij het doorrekenen meldt hij *De kalender heeft geen werkdagen ingesteld*.

**Ongeldige invoer.** Een pauze buiten de werkdag, een begintijd na de eindtijd of een feestdag met een onjuiste datum krijgt een rode melding bij het veld, en *Toepassen* is uitgeschakeld tot je het herstelt. Bij een ongeldige pauze of feestdag staat er ook een waarschuwingsteken bij de kalender in de lijst (*Deze kalender bevat ongeldige invoer*).

**Een kalender op een fase.** Een fase rekent altijd op de projectkalender, want haar duur volgt uit haar taken. Geef de kalender aan de taken zelf.

**Dezelfde kalender, twee keuzes.** In de keuzelijst staat de projectkalender twee keer: als *Projectkalender: naam* en als gewone kalender met die naam. Kies je de tweede, dan is dat een eigen keuze van die taak. De taak verhuist dan niet mee als je later een andere projectkalender kiest.

**Andere uren per dag.** Verander je de werktijden of de pauze zo dat de *Netto-uren per dag* van een kalender veranderen, dan telt een taak in dagen nog steeds hetzelfde aantal dagen. Bij een taak met resources en de werkregel *Vast werk* of *Vaste inzet* verandert de duur wel mee, omdat het werk gelijk blijft. Veertig uur werk is 5 dagen bij 8 uur per dag en 7 dagen bij 6 uur per dag. De app meldt hoeveel taken een andere duur kregen.

## Zie ook

- [Kalenders en werkdagen](docs://uitleg-kalenders): hoe de app werkdagen telt en welke kalender wint.
- [Dagen en uren](docs://uitleg-dagen-en-uren): wat de netto-uren per dag doen.
- [Een resourcekalender instellen](docs://howto-resourcekalender-instellen): een kalender voor een resource in plaats van een taak.
- [Kalendervensters](docs://ref-kalenders): alle velden van de kalendervensters.
