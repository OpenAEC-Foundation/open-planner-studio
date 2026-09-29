# Kalenders en werkdagen

Hoeveel werkdagen kost een taak, en op welke datum is hij klaar? Dat hangt af van de kalender waarin de app telt. In dit artikel lees je wat een kalender is, hoe de app er werkdagen mee telt en welke kalender wint als er meer dan één in het spel is. Het uitgewerkte voorbeeld helpt je de getallen te volgen.

## Het begrip

Een planning telt in **werkdagen**, niet in kalenderdagen. "Vijf dagen metselen" zijn vijf dagen waarop er gewerkt wordt. Een weekend of een feestdag telt niet mee, dus zo'n taak beslaat in de agenda meer dan vijf dagen.

Welke dagen werkdagen zijn, staat in een **kalender**. Een kalender legt drie dingen vast:

- De **werkweek**: de weekdagen waarop gewerkt wordt. Standaard is dat maandag tot en met vrijdag.
- De **werktijden**: begin, einde en pauze. Daaruit volgen de **netto-uren per dag**. Standaard is dat 07:00 tot 16:00 met een uur pauze, dus 8 uur.
- De **feestdagen**: losse dagen of hele periodes waarop niet gewerkt wordt, zoals Koningsdag, Kerst of de bouwvak.

Een project heeft één bibliotheek met kalenders. Eén daarvan is de **projectkalender**. Die geldt voor alle taken die geen eigen kalender hebben. Een andere kalender geef je aan een losse taak, bijvoorbeeld een zesdaagse werkweek voor een onderaannemer die ook op zaterdag werkt. Een resource kan ook een eigen kalender hebben, maar die doet iets anders (zie hieronder).

## Hoe de app rekent

Dit artikel beschrijft de standaardberekening: het rekenprofiel *Open Planner Studio*, waarmee een nieuw project rekent.

### Werkdagen tellen

De eerste werkdag van een taak telt als dag 1. Een taak van 5 dagen eindigt dus op de vijfde werkdag. Valt de start op een niet-werkdag, dan begint de taak op de eerstvolgende werkdag. Een feestdag of bouwvak midden in een taak telt niet mee: de taak loopt er gewoon overheen en wordt in de agenda langer.

De uren per dag doen voor de datums van een taak in dagen niet mee. Alleen de werkweek en de feestdagen tellen. De werktijden komen pas in beeld bij een taak in uren; dat staat in [Dagen en uren](docs://uitleg-dagen-en-uren).

### Welke kalender wint

De app kiest per taak één kalender:

1. Heeft de taak een eigen kalender, dan rekent de app die taak volledig in díé kalender: duur, einddatum en speling.
2. Heeft de taak er geen, dan geldt de projectkalender. Verwijst een taak naar een kalender die niet meer bestaat, dan valt hij daar ook op terug.

Een samenvattingstaak (een fase) heeft geen eigen werk en dus geen eigen kalender. Haar duur volgt uit de datums van haar taken en telt de app op de projectkalender.

De kalender van een **resource** doet niet mee aan de datums. In een planning die je zelf in de app opbouwt bepaalt hij alleen wanneer de resource beschikbaar is: in het histogram, bij overbezetting en bij nivelleren.

### Taken op verschillende kalenders

Hangen twee taken met verschillende kalenders aan elkaar, dan geldt:

- Bij een relatie Eind-Start begint de opvolger op de eerste werkdag ná het einde van de voorganger, geteld in de kalender van de **opvolger**. Eindigt een taak op vrijdag, dan start een opvolger met een zesdaagse werkweek op zaterdag.
- Een **lag** telt standaard in de kalender van de **voorganger**. Dat kun je veranderen onder *Instellingen › Project › Projectinfo*, in het blok *Rekenprofiel en reken-opties*, bij *Reken-opties van dit project*, met de keuze *Lag-kalender*: *Voorganger* (standaard), *Opvolger*, *24-uurs* of *Projectkalender*.
- De **totale speling** telt in werkdagen van de kalender van de taak zelf. De **vrije speling** telt in dit profiel in de kalender van de opvolger.

Wat een lag precies is, staat in [Relaties leggen](docs://howto-relaties-leggen); wat speling is, in [Kritiek pad en speling](docs://uitleg-kritiek-pad).

### In de Gantt

De grijze achtergrond in de Gantt toont altijd de niet-werkdagen van de **projectkalender**. Een taak op een eigen kalender kan dus over een grijze dag lopen, zoals een zesdaagse taak over de zaterdag. Een feestdagblok van drie dagen of meer krijgt zijn naam bovenaan, bijvoorbeeld *Bouwvak (Noord)*. Wil je de grijze dagen helemaal niet zien, zet dan *Alleen werkbare dagen tonen* aan onder *Instellingen › Project › Instellingen*, tabblad *Weergave*, kopje *Tijd-as*.

## Rekenvoorbeeld: de bouwplanning

Het voorbeeld gebruikt de standaardkalender *Bouwkalender NL*: maandag tot en met vrijdag, met de Nederlandse feestdagen. Alle taken duren een geheel aantal dagen. In de tutorial over kalenders (tutorial 3) bouw je zo'n kalender zelf op.

### Weekend, feestdag en bouwvak

*Metselwerk* duurt 5 werkdagen en begint op donderdag 13 mei 2027. Donderdag 13 en vrijdag 14 mei zijn dag 1 en 2. Het weekend en Pinkstermaandag 17 mei tellen niet. Dinsdag 18, woensdag 19 en donderdag 20 mei zijn dag 3, 4 en 5. De taak eindigt op **donderdag 20 mei**: acht kalenderdagen voor vijf werkdagen.

Met een bouwvak wordt het verschil groter. Neem *Bouwvak (Noord)*, van 26 juli tot en met 13 augustus 2027, en dezelfde taak van 5 werkdagen vanaf vrijdag 23 juli. Vrijdag 23 juli is dag 1. Daarna staat de kalender drie weken stil. Maandag 16 tot en met donderdag 19 augustus zijn dag 2 tot en met 5. Het einde is **donderdag 19 augustus**, 28 kalenderdagen na de start. Zonder bouwvak was het donderdag 29 juli geweest.

### Een taak op zaterdag

Drie taken volgen elkaar op, allemaal met een relatie Eind-Start zonder lag: *Grondwerk* (4 dagen), *Storten fundering* (3 dagen) en *Metselwerk* (5 dagen). Het project start op maandag 24 mei 2027.

Staan alle drie op de projectkalender, dan loopt *Grondwerk* van maandag 24 tot en met donderdag 27 mei. *Storten fundering* loopt van vrijdag 28 mei tot en met dinsdag 1 juni (vrijdag, maandag, dinsdag). *Metselwerk* loopt van woensdag 2 juni tot en met dinsdag 8 juni. Het project eindigt op **dinsdag 8 juni**.

Geef je *Storten fundering* de kalender *Zesdaagse werkweek* (maandag tot en met zaterdag), dan telt de zaterdag mee. De taak loopt van vrijdag 28 mei tot en met **maandag 31 mei** (vrijdag, zaterdag, maandag). *Metselwerk* blijft op de projectkalender, begint op dinsdag 1 juni en eindigt op **maandag 7 juni**. Het hele project is een dag korter, omdat één taak op zaterdag werkt.

### Een lag over twee kalenders

*Storten fundering* (zesdaagse werkweek, 4 dagen) begint op maandag 31 mei en eindigt op donderdag 3 juni. *Metselwerk* (projectkalender, 3 dagen) volgt met een lag van 2 werkdagen. Zonder lag zou *Metselwerk* op vrijdag 4 juni beginnen.

- Standaard telt de lag in de kalender van de voorganger, de zesdaagse werkweek. Vanaf vrijdag 4 juni is zaterdag 5 juni de eerste werkdag en maandag 7 juni de tweede. *Metselwerk* begint op **maandag 7 juni** en eindigt op woensdag 9 juni.
- Zet je *Lag-kalender* op *Opvolger*, dan telt de projectkalender. Zaterdag telt dan niet mee: maandag 7 juni is de eerste werkdag en dinsdag 8 juni de tweede. *Metselwerk* begint op **dinsdag 8 juni** en eindigt op donderdag 10 juni.

### Speling in de eigen kalender

*Metselwerk* (5 dagen, projectkalender) en *Kraanhuur* (3 dagen, zesdaagse werkweek) beginnen allebei op maandag 24 mei. Beide zijn de voorganger van *Kozijnen plaatsen* (2 dagen, projectkalender).

*Metselwerk* eindigt op vrijdag 28 mei, dus *Kozijnen plaatsen* begint op maandag 31 mei. *Kraanhuur* eindigt al op woensdag 26 mei. De totale speling van *Kraanhuur* telt in zijn eigen kalender: donderdag 27, vrijdag 28 en zaterdag 29 mei, dus **3 werkdagen**. Stond *Kraanhuur* op de projectkalender, dan was het 2 werkdagen geweest. De vrije speling is 2 werkdagen (donderdag en vrijdag), omdat de app die in de kalender van de opvolger telt.

### De kalender van een resource

De resource *Metselploeg* heeft de kalender *Metselploeg ma-do* (maandag tot en met donderdag) en is voor 1 eenheid per dag toegewezen aan *Metselwerk* (5 dagen, projectkalender, van maandag 31 mei tot en met vrijdag 4 juni).

De datums van *Metselwerk* veranderen niet. Wel staat vrijdag 4 juni in het histogram rood, met de melding *Werkt volgens kalender "Metselploeg ma-do" niet op deze dag*, en meldt het lint bij *Overallocatie* één resource. Nivelleren lost dit niet op. Verschuiven helpt niet, want vijf werkdagen op rij bevatten altijd een vrijdag. In het venster *Resources nivelleren* staat de taak daarom onder *Resterende conflicten*, met de reden *De resource werkt niet op alle dagen die deze taak nodig heeft — verschuiven lost dit niet op.*

## Gevolgen en misverstanden

**"De kalender van de resource verschuift mijn taken."** Nee. Een resourcekalender verandert geen enkele datum, hij maakt alleen overbezetting zichtbaar. Wil je dat de taak zelf op andere dagen loopt, geef dan de taak een eigen kalender.

**"Als ik de projectkalender wissel, verschuift alles."** Alleen de taken zonder eigen kalender gaan mee. Een taak die je zelf een kalender uit de lijst gaf, houdt die, ook als het toevallig de oude projectkalender is. Verwijder je een kalender, dan vallen taken en resources die hem gebruikten terug op de projectkalender.

**"De feestdagen staan er toch?"** Feestdagen bestaan alleen voor de jaren waarvoor ze zijn aangemaakt. Een dag daarbuiten is gewoon een werkdag. In de kalenderdialoog meldt de app dat met *Feestdagen dekken 2025–2028; project loopt tot 2030. Opnieuw genereren?*

**"Meer uren per dag maakt mijn taak korter."** Niet bij een taak in dagen: die telt hele werkdagen, of de dag nu 6 of 8 uur heeft. Alleen bij een taak met resources en de werkregel *Vast werk* of *Vaste inzet* verandert de duur mee.

**Een kalender zonder werkdagen** kan de app niet doorrekenen. De berekening meldt *De kalender heeft geen werkdagen ingesteld*.

## Zie ook

- [Dagen en uren](docs://uitleg-dagen-en-uren): hoe de app werkuren telt en wat er gebeurt als dagtaken en urentaken samenkomen.
- [Een kalender maken en toewijzen](docs://howto-kalender-maken-en-toewijzen): de stappen om een eigen kalender te maken en aan taken te geven.
- [Feestdagen en bouwvak genereren](docs://howto-feestdagen-genereren): de feestdagen van een land en de bouwvak invullen.
- [Een resourcekalender instellen](docs://howto-resourcekalender-instellen): de beschikbaarheid van een resource vastleggen.
