# Een bestand openen en opslaan

Doel: een project uit een bestand openen en je wijzigingen bewaren.

## Wanneer je dit nodig hebt

Je begint de dag met het project van gisteren, je krijgt een bestand van een collega of uit een ander pakket, of je wilt een tussenstand vastleggen voordat je iets groots aanpast. Wat de app in een bestand bewaart, staat in [Bestanden en formaten](docs://uitleg-bestanden).

## Stappen

### Een bestand openen

1. Kies *Start › Bestand › Openen*, of *Bestand › Openen*, of druk op Ctrl+O (⌘+O op een Mac). De groep *Bestand* staat ook op het tabblad *Tabel*.
2. Kies het bestand. Je opent één bestand per keer. Op de desktop en in browsers met bestandstoegang, zoals Chrome en Edge, toont het venster een lijst met bestandstypen: *All Supported*, *IFC Files*, *CSV Files*, *XML Files*, *MS Project Files* en *Primavera XER Files*.
3. Het project opent in een nieuw tabblad. Was het huidige tabblad nog leeg en ongewijzigd, dan opent het project daarin.
4. Bij CSV, MS Project XML, Primavera P6 XML, `.mpp` en `.xer` verschijnt standaard een venster met een korte uitleg over dat formaat. Een groen blok zegt wat de app overnam, een amber blok wat niet of maar deels meekwam, en een blauw blok hoe opslaan en terugschrijven werken. *Lees meer* opent de gids over dat formaat. Klik op *Begrepen* om het venster te sluiten. Vink eerst *Niet meer tonen voor …* aan als je deze uitleg voor dat formaat niet meer wilt zien. Je zet hem weer aan in de app-instellingen, in de groep [Meldingen](settings://formatNotices).

Bij een geopend IFC-bestand toont het tabblad de bestandsnaam zonder extensie. Bij een import toont het de projectnaam, met de P6-projectcode als die beschikbaar is.

Staat de experimentele instelling *IFC met gebouwmodel openen* aan (zie [App-instellingen](docs://ref-instellingen)) en open je een IFC-bestand dat al in een tabblad open staat, dan komt er geen tweede tabblad: de app gaat naar dat tabblad. Dat tabblad houdt zijn inhoud, ook wijzigingen die je nog niet opsloeg. Is het bestand veranderd sinds dat tabblad het opende of opsloeg, bijvoorbeeld omdat een collega een nieuwe versie opsloeg, dan staat er boven dat tabblad een strook: *kantoor.ifc is buiten dit tabblad gewijzigd. Dit tabblad toont nog de eerdere versie. Sluit dit tabblad en open het bestand opnieuw om de nieuwe versie te zien.* De strook hoort bij dat tabblad en blijft staan tot je het tabblad opslaat, het als IFC over hetzelfde bestand exporteert of het sluit. Heeft het tabblad wijzigingen die je nog niet opsloeg en wil je die bewaren, kies dan eerst *Opslaan als*, zodat ze in een nieuw bestand komen. Vanzelf laadt de app nooit een nieuwe versie. Weet de app niet welke versie het tabblad heeft, bijvoorbeeld omdat je het opende terwijl de instelling uit stond, dan opent het bestand in een nieuw tabblad; alleen een dubbelklik gaat dan zoals altijd naar het open tabblad, zonder melding. In de desktop-app herkent de app hetzelfde bestand aan precies dezelfde padtekst: via een snelkoppeling of een anders geschreven pad krijgt het een eigen tabblad. In de browser moet de app het bestand op tijd herkennen; lukt dat niet, dan opent het in een nieuw tabblad. Dat geldt ook voor slepen, *Recent* en een dubbelklik. Een bestand in een ander formaat, zoals `.csv` of `.xer`, opent wel opnieuw in een eigen tabblad. Dat doet ook een bestand van je computer in browsers die alleen downloaden, zoals Firefox. Staat de instelling uit, dan opent ook een IFC-bestand dat al open staat in een nieuw tabblad; alleen een dubbelklik gaat dan naar het open tabblad, zonder melding.

De app opent `.ifc`, `.csv`, `.xml` (MS Project XML of Primavera P6 XML), `.mpp` en `.xer`. Voor de laatste twee staan aparte stappen in [Een MS Project-bestand (.mpp) openen](docs://howto-mpp-openen) en [Een Primavera P6-bestand (.xer) openen](docs://howto-xer-openen).

Staat de experimentele instelling *IFCX openen en opslaan* aan (zie [App-instellingen](docs://ref-instellingen)), dan opent de app ook `.ifcx`-planningen die ze zelf schreef. In een openingsvenster met een lijst van bestandstypen staat dan ook *IFCX Files*. Weigert de app het bestand, dan staat de reden bij [Meldingen en waarschuwingen](docs://ref-meldingen). Staat de `.ifcx`-planning al in een tabblad open, dan komt er geen tweede tabblad: de app gaat naar dat tabblad, ook via *Recent* en bij slepen, en ook als *IFC met gebouwmodel openen* uit staat. Dat tabblad houdt zijn inhoud. Is het bestand intussen buiten dat tabblad gewijzigd, dan staat erboven dezelfde strook als bij een IFC-bestand en toont het tabblad nog de eerdere versie. Wil je de nieuwe versie zien, sluit dan dat tabblad en open het bestand opnieuw; bewaar wijzigingen die je nog niet opsloeg eerst met *Opslaan als* in een nieuw bestand.

### Een bestand naar de app slepen

1. Sleep een of meer bestanden vanuit je bestandsbeheer of Finder naar het venster van de app.
2. Tijdens het slepen ligt er een grijze laag over het venster, met *Laat los om te openen* en *Projectbestand of import*.
3. Laat de muisknop los. De app opent de bestanden in sleepvolgorde. Staat de experimentele instelling *IFC met gebouwmodel openen* aan en herkent de app het IFC-bestand en de versie van het open tabblad, dan gaat ze naar dat tabblad. Bij een `.ifcx`-planning die al open staat doet ze dat ook met die instelling uit. Het laatste bestand is daarna het actieve tabblad. Was het huidige tabblad leeg en ongewijzigd, dan opent het eerste bestand daarin.
4. Verschijnt na een bestand de uitleg over zijn formaat, dan opent het volgende bestand pas als je die uitleg sluit met *Begrepen*. Zo krijgt elk bestand zijn eigen uitleg.

Een project met wijzigingen blijft in zijn eigen tabblad staan; slepen vervangt niets. Een gesleept IFC-bestand werkt daarna als een geopend bestand: *Opslaan* schrijft ernaar, behalve in browsers die alleen downloaden, zoals Firefox.

Een bestand in een formaat dat de app niet kent, zoals een `.pdf`, opent niet. Je ziet dan de melding *Niet geopend: tekening.pdf.* De andere bestanden uit dezelfde sleep openen gewoon.

Staat er een venster of vraag open, dan opent slepen niets. Open je een venster terwijl de app een groot bestand nog leest, dan opent dat bestand pas als je het venster sluit. In de browser toont de muisaanwijzer dan een verbodsteken. In de desktopapp verschijnt de melding *Niet geopend: plan.ifc. Sluit eerst het venster dat openstaat.*

### Een bestand openen met een dubbelklik (desktopapp)

De installer koppelt `.ifc` niet aan de app. Wil je een bestand met een dubbelklik openen, koppel het formaat dan zelf: op Windows met de rechtermuisknop op het bestand, *Openen met* en *Een andere app kiezen*. De app opent het bestand dan zoals bij *Openen*, in een eigen tabblad. Staat de app al open, dan opent het bestand in dat venster. Staat het bestand daar al in een tabblad open, dan gaat de app naar dat tabblad. Dat werkt ook vanaf de opdrachtregel, met het pad als argument.

Staat er bij het starten een venster open, zoals het welkomstvenster, dan opent het bestand zodra je dat venster sluit. Bestaat het bestand niet, of is het een formaat dat de app niet kent, dan zie je de gewone melding en blijft de app open. Een bestand buiten je thuismap kan de app op deze manier nog niet lezen; open het dan met *Openen*.

### Een recent project openen

Kies *Start › Bestand › Recent* en klik op een bestand in de lijst, of kies *Bestand › Recent*. De lijst bewaart maximaal tien bestanden die de app opnieuw kan openen. Downloads en geëxporteerde voortgangsbladen komen er niet bij. Ook hier verschijnt standaard bij CSV, MS Project XML, Primavera P6 XML, `.mpp` en `.xer` de uitleg over het formaat. De desktopapp toont bij elk bestand het pad, een browser alleen de naam.

Kan de app een bestand uit de lijst niet meer lezen, bijvoorbeeld omdat je het verplaatste, dan verdwijnt het zonder melding uit de lijst. In browsers zonder bestandstoegang, zoals Firefox, blijft *Recent* leeg.

### Een voorbeeld openen

Kies *Bestand › Voorbeelden* en klik op een voorbeeldproject. Het opent in een tabblad, zonder bestand: *Opslaan* vraagt dus waar je het wilt bewaren.

### Opslaan

Kies *Start › Bestand › Opslaan* of *Bestand › Opslaan*, of druk op Ctrl+S. Voor een IFC-planning werkt dat als volgt.

1. Kan de app het bestand van je project bijwerken, dan schrijft ze ernaar terug. Staat er nog een keuze voor het IFC-schema open, dan vraagt ze eerst *In welk IFC-schema opslaan?* Zie [Het IFC-schema kiezen](docs://howto-ifc-schema-kiezen).
2. Heeft een gewone IFC-planning nog geen bestand, dan stelt de app een naam op `.ifc` voor. Op de desktop en in browsers met een opslagvenster kies je waar het bestand komt.
3. Bij lokaal opslaan in Firefox krijg je telkens een download. De eerste keer in een sessie zie je de melding *Opgeslagen als download: 'naam.ifc' staat in je downloadmap. Deze browser laat de app niet naar een eigen plek schrijven, dus elke keer opslaan maakt een nieuwe download. In Chrome, Edge of de desktop-app werkt Opslaan hetzelfde bestand gewoon bij.*
4. Weiger je schrijftoegang tot een gewone IFC-planning in Chrome of Edge, dan kun je via het opslagvenster een ander bestand kiezen. Blokkeert de browser ook dat venster, dan downloadt de app een kopie. De eerste keer in een sessie krijg je uitleg met een link naar [Bestanden](docs://uitleg-bestanden).

Tijdens het opslaan staat rechtsonder in de statusbalk *Opslaan…*; je kunt intussen doorwerken. Na het opslaan verdwijnt de markering *Niet opgeslagen*: de stip op het tabblad en de asterisk voor de projectnaam bovenaan. In de statusbalk staat dan *Opgeslagen* met de tijd, bijvoorbeeld *Opgeslagen 14:32*. Wat je tijdens het opslaan nog wijzigde, staat niet in het bestand: daarna staat er weer *Niet opgeslagen*.

Met de experimentele instelling *IFCX openen en opslaan* aan houdt *Opslaan* (Ctrl+S) het bestandstype. Bij een geopende IFCX-planning werkt Ctrl+S het bestand in Chrome of Edge bij als je schrijftoegang geeft. Zonder schrijfbaar bestand krijg je bij lokaal opslaan een `.ifcx`-download, ook als je schrijftoegang weigert. Er is geen schemavraag.

### Opslaan onder een andere naam

Kies *Start › Bestand › Opslaan als* of *Bestand › Opslaan als*, of druk op Ctrl+Shift+S. Op de desktop kies je een naam en plek. Voor een gewone IFC-planning kan dat ook in Chrome en Edge. Na opslaan op de gekozen plek schrijft Ctrl+S naar dat bestand. In Firefox krijg je bij lokaal opslaan telkens een download.

Staat de experimentele instelling *IFC met gebouwmodel openen* aan en bevat het IFC-bestand een gebouwmodel of gegevens van andere programma’s, dan downloadt de browser bij lokaal *Opslaan als* een kopie. Het tabblad blijft gekoppeld aan het origineel als het daar bij openen toegang toe kreeg.

Met de experimentele instelling *IFCX openen en opslaan* aan kies je alleen in het opslagvenster van de desktop-app een ander bestandstype. Op Windows kies je *IFC Files* of *IFCX Files* in de lijst met bestandstypen. Het venster past de standaardextensie aan bij je keuze. Op Linux en macOS laat je de bestandsnaam eindigen op `.ifc` of `.ifcx` voor het gewenste type. Op macOS is er geen lijst met bestandstypen. In de browser en bij opslaan op de site houdt het document zijn bestandstype. Bij lokaal *Opslaan als* van een IFCX-planning downloadt de browser een kopie, ook in Chrome en Edge. Het tabblad heeft daarna geen schrijfbaar bestand meer. De volgende Ctrl+S downloadt opnieuw.

Met de experimentele instelling *IFCX openen en opslaan* aan vraagt de app bij het omzetten van een IFC-bestand met een gebouwmodel in het venster *Opslaan als IFCX* om bevestiging. Kies *Alleen de planning opslaan* om verder te werken in het nieuwe IFCX-bestand. Het gebouwmodel en de gegevens van andere programma's blijven in het oorspronkelijke IFC-bestand. Met *Annuleren* breek je de opslag af.

Met de experimentele instelling *IFCX openen en opslaan* aan verschijnt bij het omzetten van een planning uit een XER-import het venster *Opslaan als IFCX* met de melding *Het P6-bronarchief gaat niet mee naar IFCX.* Kies *Doorgaan* om de planning zonder het bronarchief op te slaan, of *Annuleren* om de opslag af te breken.

### Een project sluiten

Klik op het kruisje van het tabblad, of kies *Bestand › Sluit project*. Heeft het project wijzigingen die je niet opsloeg, dan vraagt de app: *Niet-opgeslagen wijzigingen: 'naam' heeft wijzigingen die nog niet zijn opgeslagen.* Je kiest *Annuleren* (het project blijft open), *Niet opslaan* (het project sluit en je wijzigingen zijn weg) of *Opslaan* (eerst opslaan, dan sluiten). Loopt er nog een opslag, dan wacht het sluiten daarop: in beeld staat *Wordt nog opgeslagen…*, en zodra de opslag klaar is, gaat het sluiten verder. Dat geldt ook voor het afsluiten van de app. Ook het installeren van een update wacht tot de opslag klaar is. Sluit je op de desktop de hele app (met de sluitknop, Alt+F4 of het menu van je besturingssysteem), dan vraagt ze dit voor elk project met wijzigingen; *Annuleren*, of een opslag die mislukt, breekt het afsluiten af. Na zo'n gewone afsluiting ruimt de app de herstelkopieën van die sessie op, zodat het herstelvenster alleen na een echte crash verschijnt. Heeft een project wijzigingen en sluit je het browsertabblad of -venster, dan vraagt de browser om bevestiging.

## Valkuilen en wat de app dan doet

**Het geopende IFC-bestand bijwerken.** Heeft de app schrijftoegang, dan kan *Opslaan* het geopende bestand bijwerken, ook als het uit een ander programma komt. Wil je het origineel houden, kies dan *Opslaan als* en bewaar een kopie.

**Wijzigde iemand anders het bestand intussen, dan schrijft Opslaan er niet overheen.** Dit geldt voor lokale IFC-bestanden als de experimentele instelling *IFC met gebouwmodel openen* aan staat (zie [App-instellingen](docs://ref-instellingen)). Vervangt een collega of een ander programma je bestand terwijl het bij jou open staat, dan meldt *Opslaan*: *Niet opgeslagen. Het bestand is intussen door een ander programma gewijzigd. Je wijzigingen staan nog in de app. Kies Opslaan als om ze in een nieuw bestand te bewaren.* Je project blijft *Niet opgeslagen*. Wil je de andere versie op de desktop toch vervangen, kies dan *Opslaan als* en hetzelfde bestand. Bij een planning zonder gebouwmodel of gegevens van een ander programma kijkt de app zolang dit tabblad de versie van het eigen bestand kent: na openen, na opslaan en na een export over dat bestand. Na een herstel na een crash, of als in de desktop-app het schrijven naar het bestand zelf mislukte, kent het tabblad die versie niet en schrijft *Opslaan* er de eerstvolgende keer gewoon overheen. Is het bestand verdwenen, dan schrijft *Opslaan* het in de desktop-app gewoon opnieuw. Bij een gewone IFC-planning staat deze versiecontrole uit als *IFC met gebouwmodel openen* uit staat.

Met de experimentele instelling *IFCX openen en opslaan* aan controleert *Opslaan* ook de bekende versie van het lokale IFCX-bestand. Heeft iemand het bestand intussen gewijzigd, dan stopt de opslag. Je kunt je wijzigingen met *Opslaan als* in een kopie bewaren.

**Een taak of resource wissen waar een ander programma iets aan koppelde.** Met de experimentele instelling *IFC met gebouwmodel openen* aan kan een ander programma iets aan een taak of resource hebben gehangen, bijvoorbeeld een wand die bij een taak hoort. Wis je zo'n taak of resource, dan meldt de app meteen hoeveel van die gegevens aangepast of verwijderd worden als je de planning zo opslaat. Wil je dat niet, klik dan in die melding op *Ongedaan maken*, of druk op Ctrl+Z. Dat kan ook nadat je hebt opgeslagen: zolang het bestand open is, zet de volgende opslag de koppeling terug, aan de taak of resource zoals die nu is; na het sluiten van het bestand niet meer. De knop staat er zolang de melding er staat, ongeveer 12 seconden; daarna gaat het met Ctrl+Z. Dat geldt ook als Automatisch opslaan het bestand al heeft bijgewerkt: die opslag wacht tot je een halve minuut niets wijzigt, en dan is de melding meestal al weg. Staan er al drie meldingen open, dan kan die melding ontbreken. Sla je op zonder het wissen ongedaan te maken, dan gaat alleen de koppeling eruit: de wand en de rest van het gebouwmodel blijven zoals ze waren. Bij het opslaan vraagt de app eerst of dat mag en noemt het aantal IFC-gegevens buiten de planning dat wordt aangepast of verwijderd. Kies je *Annuleren*, dan wordt er niets opgeslagen en kun je het wissen nog ongedaan maken. Vink je *Niet meer vragen* aan, dan slaat de app voortaan meteen op en meldt het aantal daarna; je zet de vraag weer aan onder *Instellingen › Project › App-instellingen*, in de groep *Meldingen*. Automatisch opslaan en een export naar IFC vragen niets: ze melden het aantal na het opslaan, met een gewone melding die na herladen of herstarten weg is.

**Een toewijzing of plek wijzigen die een ander programma samen met het gebouwmodel vastlegde.** Met dezelfde instelling aan kan een ander programma in één gegeven een ploeg én een wand aan een taak hebben gekoppeld, of een taak onder een eigen schema hebben gezet. Wis je die toewijzing, of zet je de taak onder een andere taak, dan haalt de app bij het opslaan alleen de planning uit dat gegeven en schrijft ze de nieuwe stand zelf. De wand blijft aan de taak gekoppeld. Maak je een eigen veld met dezelfde naam als een veld van een ander programma, dan vervalt de waarde van dat programma. Wat zo is aangepast of verwijderd, telt mee in de melding na het opslaan.

**Andere formaten worden nooit overschreven.** Een `.csv`, `.xml`, `.mpp` of `.xer` heeft na het openen geen bestand. *Opslaan* schrijft een nieuw IFC-bestand en laat het origineel ongemoeid.

**Een lokaal bestand bewaren in Firefox.** Bij elke druk op Ctrl+S downloadt de app een kopie. De app leidt de naam af van de projectnaam.

**Schrijftoestemming in Chrome en Edge.** De browser kan bij Ctrl+S toestemming vragen om het geopende lokale bestand bij te werken. Weiger je dat bij een gewone IFC-planning, dan probeert de app het opslagvenster te openen.

**Een melding over dubbele id's of relaties die niet meetellen.** Na het openen kan een melding blijven staan. Staat er *Objecten met een dubbel id in dit bestand*, dan kreeg elk dubbel object een eigen id en wijzen verwijzingen naar het eerste exemplaar. Controleer dan relaties en toewijzingen. Staat er *relatie(s) konden niet worden meegerekend*, dan ging het om een relatie die op een samenvattingstaak lag en geen effect heeft, bijvoorbeeld een taak gekoppeld aan zijn eigen samenvatting. Het bestand zelf blijft ongewijzigd. Zie [Relaties leggen](docs://howto-relaties-leggen) voor wat een relatie op een samenvattingstaak doet.

**Opslaan kan mislukken.** Geeft het opslaan zelf een fout, dan meldt de app *Opslaan mislukt*, met de reden erbij. Biedt Chrome of Edge voor een gewone IFC-planning een opslagvenster aan, dan verschijnt de melding vóór dat venster. Annuleer je dat venster, dan blijft je project open en als *Niet opgeslagen* gemarkeerd. Lukt het opslaan naar het andere bestand, dan verdwijnt die markering en werkt je project voortaan met dat bestand. Wijzigingen die je tijdens het opslaan nog deed, blijven als *Niet opgeslagen* gemarkeerd. De foutmelding over de eerdere poging blijft staan tot je haar sluit. Mislukt ook de tweede poging, dan toont dezelfde melding de laatste reden.

## Zie ook

- [Bestanden en formaten](docs://uitleg-bestanden): wat de app bij opslaan bewaart en hoe de app formaten behandelt.
- [Automatisch opslaan aanzetten](docs://howto-automatisch-opslaan): de app zelf je bestand laten bijwerken.
- [Het IFC-schema kiezen](docs://howto-ifc-schema-kiezen): wat de vraag *In welk IFC-schema opslaan?* betekent.
- [Exporteren](docs://howto-exporteren): een kopie in een ander formaat maken.
- [Herstellen na een crash](docs://howto-herstellen-na-een-crash): wat je doet als de app niet netjes sloot.
- [Import- en exportformaten](docs://ref-import-exportformaten): per formaat wat meegaat en wat niet.
