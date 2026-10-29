# Nieuw project en Projectinstellingen

De velden van het venster *Nieuw project* en van *Projectinstellingen*: wat elk veld doet, wat de standaard is en waar het werkt. Het zijn twee kanten van hetzelfde formulier. *Nieuw project* maakt een nieuw project en heeft een paar velden extra. *Projectinstellingen* wijzigt het project dat je open hebt.

## Openen

**Nieuw project** — *Bestand › Nieuw*, Ctrl+N, of het plusje rechts van de documenttabbladen (*Project starten*, dan *Nieuw project*). Het venster opent met de cursor in *Projectnaam*.

**Projectinstellingen** — *Instellingen › Project › Projectinstellingen* opent het formulier als venster met de titel *Projectinstellingen*. *Bestand › Projectinstellingen* toont hetzelfde formulier in het scherm *Bestand*. Het blok *Rekenprofiel en reken-opties* staat op beide plekken onderaan; wat erin staat, staat in [Rekenopties en conventies](docs://ref-rekenopties-en-conventies).

## Aanmaken, Toepassen en annuleren

**Aanmaken** (in *Nieuw project*) maakt het project. Is je huidige tabblad leeg en ongewijzigd, dan gebruikt de app dat tabblad; anders opent het project in een nieuw tabblad. **Toepassen** (in *Projectinstellingen*) schrijft je wijzigingen naar het project.

- **Pas bij Toepassen.** Je typt in een concept. Het project verandert pas als je op *Toepassen* klikt. *Toepassen* schrijft alleen wat je echt hebt gewijzigd, in één stap in *Ongedaan*. Klik je op *Toepassen* zonder iets te wijzigen, dan gebeurt er niets en komt er geen stap bij.
- **Annuleren, het kruisje en Esc** sluiten het venster zonder iets te bewaren. Een klik náást het venster sluit het niet: wat je al had ingetypt blijft staan.
- **Enter** doet hetzelfde als *Aanmaken* of *Toepassen*, behalve in het veld *Beschrijving* en in een geopende keuzelijst.
- **In het scherm Bestand** toont *Projectinstellingen* onderaan *Wijzigingen niet toegepast — klik op Toepassen om ze te bewaren.* zolang je concept afwijkt. Verlaat je het scherm dan, dan vraagt de app of je wilt toepassen, verwerpen of annuleren. Zie [Lint per tabblad](docs://ref-lint).
- **Een eigen rekenprofiel zonder naam** blokkeert *Toepassen* en *Aanmaken*. Geef het een naam, of verwerp de wijziging.

## Velden in beide vensters

**Projectnaam** — de naam van het project in de titelbalk, op het tabblad en in de bestandsnaam bij opslaan. Standaard: leeg. Een leeg veld mag: het project heet dan *Nieuwe planning*, en dat staat als grijze tekst in het veld. Waar: het hele scherm.

**Beschrijving** — vrije tekst. Standaard: leeg. Effect: wordt met het project bewaard, in het IFC-bestand en in de export naar Primavera P6 XML, en heeft geen invloed op de planning.

**Auteur** — vrije tekst. Standaard: leeg. Effect: gaat mee in het IFC-bestand en staat als *Auteur:* in de kop van een rapport, waar je hem niet kunt overtypen.

**Resourcebibliotheek** — met welke resourcebibliotheek het project is gekoppeld. Keuze uit *geen bibliotheek (los project)*, je bestaande bibliotheken en *+ Nieuwe resourcebibliotheek…*. Standaard: in *Nieuw project* de standaardbibliotheek, in *Projectinstellingen* de huidige koppeling. Effect: zie [Een resourcebibliotheek gebruiken](docs://howto-resourcebibliotheek-gebruiken). Met *+ Nieuwe resourcebibliotheek…* typ je een naam in een veld eronder; de bibliotheek wordt pas gemaakt bij *Aanmaken* of *Toepassen*, dus annuleren laat niets achter. Een koppeling in *Projectinstellingen* wordt alleen gewijzigd als je dit veld zelf aanraakt.

**Opdrachtgever/organisatie** — vrije tekst. Standaard: leeg. Effect: gaat mee in het IFC-bestand en staat als *Bedrijf:* in de kop van een rapport.

**Startdatum** — het begin van het project. Standaard: in *Nieuw project* vandaag. Wat het veld doet, staat hieronder bij *Wat de startdatum doet*.

**Einddatum** — het geplande einde van het project. Standaard: leeg. Effect: een gegeven, geen eis: de app plant niet naar deze datum toe. Hij staat in de kop van een rapport en in exports, en bepaalt tot welk jaar de feestdagen worden gegenereerd. Alleen bij een Primavera-bestand met de instelling *Speling rekenen tot de einddatum van het project* (zie [Rekenopties en conventies](docs://ref-rekenopties-en-conventies)) rekent de speling tot deze datum.

**Standaardmaat voor nieuwe taken** — Keuze uit *Dagenmaat* en *Urenmaat*. Standaard: *Dagenmaat*. Onder het profiel *Primavera P6* of *Microsoft Project* staat hij vast op *Urenmaat*. Effect: zie [Een taak in uren plannen](docs://howto-taak-in-uren-plannen).

**Rekenprofiel en reken-opties** — in *Projectinstellingen* het hele blok, in *Nieuw project* alleen de keuzelijst *Rekenprofiel* met *Primavera P6*, *Microsoft Project* en *Open Planner Studio*. Standaard: *Open Planner Studio*. Een profiel kiezen zet ook de standaardopties van dat profiel. Zie [Rekenopties en conventies](docs://ref-rekenopties-en-conventies).

## Alleen in Projectinstellingen

**IFC-schema bij opslaan** — welk IFC-schema in de kop van het opgeslagen bestand staat. Keuze uit *IFC 4.3 ADD2 (standaard)*, *IFC 4.3* en *IFC4*. Standaard: *IFC 4.3 ADD2 (standaard)*; bij een geopend IFC-bestand het schema van dat bestand. Effect: alleen de kop van het bestand verandert, niet de inhoud. Gebruik het om de planning samen te voegen met een bouwmodel in hetzelfde schema. Heeft een geopend bestand een ander schema dan de standaard, dan vraagt de app bij de eerste keer opslaan of je dat schema houdt; een keuze hier telt als antwoord. Een andere keuze hier is geen stap in *Ongedaan*: het schema hoort bij het bestand. Zie [Het IFC-schema kiezen](docs://howto-ifc-schema-kiezen).

## Alleen in het venster Nieuw project

**Fasering-template** — met welke fasen het project begint. Keuze uit *Leeg*, *Woningbouw* en *Utiliteitsbouw / renovatie*. Standaard: *Leeg*. Effect: *Leeg* geeft een project zonder taken. De andere twee zetten acht fasetaken klaar, elk met een duur van 5 werkdagen (of 5 uur als je bij *Standaardmaat voor nieuwe taken* de *Urenmaat* kiest; onder P6 of MSP 5 werkdagen in uren) en zonder relaties; je hernoemt, verplaatst en vult ze zelf aan. Bij *Woningbouw* zijn dat: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking en Oplevering. Bij *Utiliteitsbouw / renovatie*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen en Oplevering. De namen zijn gegevens van je project en blijven dus Nederlands, ook in een andere interfacetaal. Staat *Bouwmodus inschakelen* uit, dan bestaat alleen *Leeg*. Zie [App-instellingen](docs://ref-instellingen).

**Ploeg** — Keuze uit *Dagdienst*, *2 ploegen*, *3 ploegen* en *24/7*. Standaard: *Dagdienst*. Effect: *Dagdienst* laat de standaardkalender zoals hij is, een gewone dagkalender van maandag tot en met vrijdag. De andere drie zetten werktijdblokken op de kalender van het project, zoals de knoppen met dezelfde naam in het venster *Kalenders*. Welke tijden dat zijn, staat in [Werktijden instellen](docs://howto-werktijden-instellen).

**Feestdagenset** — welke vrije dagen de projectkalender krijgt. Bij *Land* kies je *Nederland* (standaard), *Duitsland*, *België*, *Frankrijk*, *Verenigd Koninkrijk*, *Oostenrijk*, *Zwitserland*, *Geen feestdagen* of *Aangepast…*. Heeft het land regio's, dan komt er een keuzelijst *Regio* bij. Bij Nederland kies je, als *Bouwmodus inschakelen* aan staat, ook de *Bouwvak*: *Geen* (standaard), *Noord*, *Midden* of *Zuid*. Daaronder staat een regel als *36 feestdagen, 2025–2029*, die je uitklapt voor de lijst. De jaren lopen van het jaar vóór de startdatum tot het jaar na de einddatum, of tot drie jaar na het startjaar als er geen einddatum is. *Aangepast…* geeft een kalender zonder feestdagen en opent na het aanmaken meteen het venster *Kalenders*, zodat je ze zelf invult. De projectkalender heet *Bouwkalender NL*, of *Standaardkalender* als *Bouwmodus inschakelen* uit staat; dan staat de keuze ook op *Geen feestdagen*. Hoe de generator werkt, staat in [Feestdagen genereren](docs://howto-feestdagen-genereren).

## Wat de startdatum doet

De startdatum is het anker van het project. Drie regels:

- **Nieuwe taken beginnen op de startdatum.** Een taak die je toevoegt, krijgt de projectstart als geplande start.
- **Een taak met voorganger begint nooit vóór de startdatum.** Ligt het einde van de voorganger eerder, dan wacht de taak tot de startdatum. Een taak *zonder* voorganger houdt zijn eigen datum, ook als die vóór de startdatum ligt. Dat is nodig om een planning uit MS Project of Primavera te tonen zoals het bronprogramma. Een constraint *Moet starten op (MSO)* of *Moet eindigen op (MFO)* breekt beide regels: zo'n taak ligt op zijn datum, ook als die vóór de startdatum valt.
- **Een latere startdatum schuift losse taken mee.** Zet je in *Projectinstellingen* de startdatum later en klik je op *Toepassen*, dan schuiven taken zonder voorganger en zonder constraint met een ondergrens (*Start niet eerder dan*, *Moet starten op*, *Eindig niet eerder dan* of *Moet eindigen op*) die vóór de nieuwe datum zouden liggen naar die datum, in dezelfde stap in *Ongedaan*. De app meldt hoeveel taken zijn verschoven. Dat gebeurt alleen als je de startdatum zelf wijzigt, nooit bij het openen van een bestand. Een startdatum later zetten verschuift de rest van de planning niet: dat doet *Project verplaatsen*, zie [Project verplaatsen](docs://howto-project-verplaatsen).

## Zie ook

- [Rekenopties en conventies](docs://ref-rekenopties-en-conventies): het blok *Rekenprofiel en reken-opties*.
- [Rekenprofielen en conventies](docs://uitleg-rekenprofielen): waarom een profiel de uitkomst verandert.
- [Project verplaatsen](docs://howto-project-verplaatsen): de hele planning naar een andere start.
- [Taken en mijlpalen toevoegen](docs://howto-taken-en-mijlpalen-toevoegen): beginnen met de eerste taken.
- [Feestdagen genereren](docs://howto-feestdagen-genereren): de feestdagenset in detail.
- [Het IFC-schema kiezen](docs://howto-ifc-schema-kiezen): opslaan voor een bouwmodel in IFC4.
