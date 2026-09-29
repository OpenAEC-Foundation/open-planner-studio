# Kalenderdialoog

Het venster *Kalenders* beheert de kalenderbibliotheek van het project: welke werkdagen, werktijden en vrije dagen er zijn, en welke kalender de projectkalender is. Het formulier ernaast is hetzelfde als in het venster *Resourcekalender*. Dit artikel zegt per veld wat het doet, wat de standaard is en wat je ervan merkt. Hoe je een kalender maakt en aan taken geeft, staat in [Een kalender maken en toewijzen](docs://howto-kalender-maken-en-toewijzen); hoe de app werkdagen telt, in [Kalenders en werkdagen](docs://uitleg-kalenders).

## Waar je het vindt

- **Kalenders** — *Planning › Kalender › Kalender* of *Instellingen › Kalender › Kalender*.
- **Kalender van een taak** — het veld *Kalender* in het venster *Taak bewerken* of het paneel *Eigenschappen*. Zie [Taakdialoog en eigenschappenpaneel](docs://ref-taak-eigenschappen).
- **Resourcekalender** — het paneel *Resources*, kolom *Kalender*: kies een kalender, kies *+ Resourcekalender* voor een nieuwe, of klik op het potlood (*Bewerken…*) voor de gekozen kalender. Zie [Resourcepaneel](docs://ref-resourcepaneel).

## De bibliotheek in het venster Kalenders

Links staat de lijst met kalenders, rechts het formulier van de gekozen kalender. De projectkalender heeft een ster. Een kalender met ongeldige invoer heeft een rood driehoekje (*Deze kalender bevat ongeldige invoer*).

- **Nieuwe kalender** (het plusje) — voegt een kalender toe met de naam *Nieuwe kalender* en de standaardinhoud van de app: maandag tot en met vrijdag, 07:00 tot 16:00, 8 netto-uren. Staat *Bouwmodus inschakelen* aan (de standaard), dan zitten er ook Nederlandse feestdagen in, zonder bouwvak; staat hij uit, dan is de lijst leeg. Wil je die feestdagen niet, kies dan *Feestdagen genereren…* en daarin *Geen feestdagen*.
- **Dupliceren** — kopieert de gekozen kalender onder de naam *{naam} (dupliceren)*.
- **Verwijderen** (de prullenbak) — verwijdert de gekozen kalender. Uitgeschakeld als er nog maar één kalender is. Was het de projectkalender, dan wordt de eerste overgebleven kalender de projectkalender. Taken en resources die de kalender gebruikten, vallen terug op de projectkalender.
- **Als projectdefault** — maakt de gekozen kalender de projectkalender. Bij de kalender die het al is, staat *Projectkalender* met een ster. Effect: elke taak zonder eigen kalender telt in deze kalender, en een resource zonder eigen kalender ook. Een taak die je zelf een kalender gaf, houdt die.
- **Toepassen** — schrijft alle wijzigingen van de hele lijst in één keer naar het project, rekent de planning door en sluit het venster. Rekent niets door als er per saldo niets veranderde. Uitgeschakeld zolang er ongeldige invoer in één van de kalenders staat. Enter in een gewoon tekstveld doet hetzelfde, maar houdt het venster open.
- **Annuleren** — sluit het venster en gooit alles weg wat je sinds het openen (of sinds de laatste Enter) veranderde. Esc, het kruisje en klikken naast het venster werken als *Annuleren*.

Standaard heeft een project de kalender *Bouwkalender NL* (Bouwmodus aan) of *Standaardkalender* (Bouwmodus uit), met maandag tot en met vrijdag 07:00 tot 16:00.

## Het formulier

### Basis

- **Naam** — de naam in de lijst en in de keuzelijsten voor taken en resources.
- **Werkdagen** — een knop per weekdag, van *Ma* tot *Zo*; een ingedrukte knop is een werkdag. De volgorde volgt *Week begint op* (*Instellingen*, tabblad *Planning*). Standaard: *Ma* tot en met *Vr*. Twee snelknoppen: *Ma–vr* zet ma–vr, 07:00 tot 16:00, 8 uur en haalt een ingestelde pauze weg; *Continu (24/7)* zet alle zeven dagen, 00:00 tot 24:00, 24 uur. Effect: alleen op werkdagen werkt een taak. Een kalender zonder werkdagen kan de app niet doorrekenen (*De kalender heeft geen werkdagen ingesteld*).
- **Begin (uur)** en **Einde (uur)** — het begin en einde van de werkdag, als UU:MM in 24-uursnotatie. Standaard: 07:00 en 16:00. De pijltjes (of de pijltoetsen) verstellen in stappen van 15 minuten; het einde mag 24:00 zijn, het begin moet vóór het einde liggen. Effect: samen met de pauze bepalen ze de netto-uren per dag. Voor de datums van een taak in dagen doen ze niet mee; ze tellen wel bij taken in uren. Deze velden verdwijnen als *Urenplanning inschakelen* aan staat en de kalender werktijden per weekdag heeft: dan zijn die leidend.
- **Pauze begint** en **Pauzeduur (minuten)** — het begin en de lengte van de pauze, met dezelfde 15-minutenstappen. Standaard: 12:00 en 60 minuten. Zet je de duur op 0, dan is de werkdag doorlopend. De pauze moet volledig binnen de werkdag vallen en mag hem niet helemaal opslokken. Effect: de netto-uren zijn einde min begin min pauze; bij een taak in uren wordt in de pauze niet gewerkt. Dezelfde velden verdwijnen onder dezelfde voorwaarde als *Begin (uur)*.
- **Netto-uren per dag** — alleen-lezen: de afgeleide lengte van een werkdag, met twee decimalen, bijvoorbeeld *8,00 h*. Standaard: 8. Effect: dit is de lengte van een dag bij het omrekenen tussen dagen en uren en bij taken in uren. Zie [Dagen en uren](docs://uitleg-dagen-en-uren).
### Werktijden

Dit blok staat er alleen als *Urenplanning inschakelen* aan staat (*Instellingen*, tabblad *Planning*). Hier stel je werktijden en ploegen per weekdag in. Zie [Werktijden instellen](docs://howto-werktijden-instellen).

- **Presets** — knoppen die de werktijden in één keer zetten: *Dagdienst* (ma–vr 08:00 tot 16:00, een gewone dagkalender), *2 ploegen* (ma–vr 06:00 tot 22:00, 16 uur), *3 ploegen* (ma–vr 06:00 tot 06:00 volgende dag, 24 uur), *Nachtploeg* (ma–vr 22:00 tot 06:00, 8 uur) en *24/7* (alle dagen 00:00 tot 24:00). Achter de ingebouwde knoppen staan je eigen presets, met een kruisje om ze te verwijderen.
- **Bewaar als preset…** — bewaart de huidige werktijden als eigen preset, op dit apparaat, zodat je ze in elk project kunt hergebruiken. Je geeft een naam (*Naam voor je eigen preset*) en klikt *Opslaan* of *Annuleren*.
- **Per weekdag instellen…** — maakt van een dagkalender een uurkalender: de huidige tijden worden de werktijdblokken van elke werkdag, met de pauze als gat. Bij een uurkalender heet de knop *Werktijden verbergen* of *Werktijden tonen* en klapt hij de editor in of uit. De editor staat bij een uurkalender standaard open.
- **De editor** — per weekdag een lijst blokken (*band*) met een begin- en eindtijd. Het vinkje *volgende dag* laat een blok over middernacht lopen (een nachtploeg). *Band toevoegen* (het plusje) voegt 08:00 tot 16:00 toe. *Kopieer naar alle werkdagen* (alleen bij ma–vr) zet de blokken van die dag op maandag tot en met vrijdag. Een dag zonder blokken heet *Niet-werkend*. Onderaan staat *Afgeleide uren/dag:*, en zodra een dag meer dan één blok heeft de hint *Een gat tussen twee banden is een pauze — pas de tijden naar wens aan.* Effect: de blokken zijn leidend. Een weekdag met blokken is een werkdag, en de velden *Begin (uur)*, *Einde (uur)* en de pauze verdwijnen.
### Feestdagen

- **Feestdagen genereren…** — opent de generator. *Land* kiest *Nederland*, *Duitsland*, *België*, *Frankrijk*, *Verenigd Koninkrijk*, *Oostenrijk*, *Zwitserland* of *Geen feestdagen*. *Regio* verschijnt alleen als het land regio's kent; standaard *Landelijk*. *Bouwvak* verschijnt alleen bij Nederland en als *Bouwmodus inschakelen* aan staat, met de keuzes *Geen* (standaard), *Noord*, *Midden* en *Zuid* en de hint *Adviesdatums — controleer bij Bouwend Nederland*. Een voorbeeldregel zegt hoeveel feestdagen er komen (*… feestdagen, …–…*), uit te klappen voor de lijst. *Genereren* zet het resultaat in de kalender die je bewerkt (het geldt pas na *Toepassen*), *Annuleren* sluit de generator. Effect: de hele lijst *Feestdagen* wordt vervangen, ook wat je zelf had toegevoegd. De jaren die de generator dekt, zijn het jaar vóór de projectstart tot en met het jaar na het projecteinde (zonder projecteinde: tot drie jaar na de start). Zie [Feestdagen en bouwvak genereren](docs://howto-feestdagen-genereren).
- **Opnieuw genereren** — verschijnt naast de knop als de gegenereerde feestdagen de projectperiode niet meer dekken, met de tekst *Feestdagen dekken …–…; project loopt tot …. Opnieuw genereren?* Een klik genereert dezelfde keuze (land, regio, bouwvak) opnieuw voor de nieuwe periode. Zonder dit zijn dagen buiten de gegenereerde jaren gewone werkdagen.
- **Feestdagen** — de lijst met vrije dagen: *Omschrijving*, *Van* en *Tot*, en een prullenbakje per regel. *Feestdag toevoegen* voegt een regel toe met vandaag als *Van* en een lege *Tot*. Een lege *Tot* is één dag. Zonder regels staat er *Nog geen feestdagen.* Effect: alle dagen in de periode zijn niet-werkdagen in deze kalender, voor taken op deze kalender en voor resources die hem gebruiken. Een ongeldige regel krijgt een rode rand en een tekst (*Vul een geldige begindatum in.*, *Vul een geldige einddatum in, of laat hem leeg voor één dag.* of *De einddatum ligt vóór de begindatum.*) en blokkeert *Toepassen*.

### Foutmeldingen en uitzonderingen

Fouten in de werktijden staan onder de velden en blokkeren *Toepassen*: *Vul een geldige begintijd in als UU:MM.*, *Vul een geldige eindtijd in als UU:MM.*, *De begintijd moet vóór de eindtijd liggen.*, *Vul een geldige pauzetijd in als UU:MM.*, *De pauzeduur moet een heel aantal minuten van 0 of meer zijn.*, *De pauze moet volledig binnen de ingestelde werkdag vallen.* en *De pauze mag niet de volledige werkdag beslaan.*

De kalender kent alleen vrije dagen als uitzondering. Een kalender uit een MS Project- of Primavera-bestand kan ook werkende uitzonderingen hebben, een extra werkdag; het venster toont en bewerkt die niet.

## Het venster Resourcekalender

- **Resourcekalender** — het formulier hierboven, in een venster met alleen *Toepassen* en *Annuleren*. Je bewerkt er één kalender: een bestaande, of een nieuwe die na *Toepassen* aan de resource wordt gekoppeld (*Annuleren* laat niets achter). Open je het in de weergave *Bibliotheek* van het resourcepaneel, dan bewerkt het een kalender in de bibliotheek; in de weergave *Project* bewerkt het de kalender van het project, ook als die uit de bibliotheek kwam. Effect: een resourcekalender bepaalt wanneer de resource beschikbaar is in het histogram, bij overbezetting en bij nivelleren; de datums van een taak verandert hij niet. *Toepassen* rekent niet door. Hangt de kalender ook aan taken of is hij de projectkalender, dan verandert de planning wel: dan staat ze als verouderd gemarkeerd en rekent *Bereken* haar door. Zie [Een resourcekalender instellen](docs://howto-resourcekalender-instellen).
