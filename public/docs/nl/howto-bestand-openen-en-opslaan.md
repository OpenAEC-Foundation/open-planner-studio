# Een bestand openen en opslaan

Doel: een project uit een bestand openen en je wijzigingen bewaren.

## Wanneer je dit nodig hebt

Je begint de dag met het project van gisteren, je krijgt een bestand van een collega of uit een ander pakket, of je wilt een tussenstand vastleggen voordat je iets groots aanpast. Wat de app in een bestand bewaart, en waarom alleen IFC je hele project bewaart, staat in [Bestanden en formaten](docs://uitleg-bestanden).

## Stappen

### Een bestand openen

1. Kies *Start › Bestand › Openen*, of *Bestand › Openen*, of druk op Ctrl+O (⌘+O op een Mac). *Openen* staat ook in de balk helemaal bovenaan. De groep *Bestand* staat ook op het tabblad *Tabel*.
2. Kies het bestand. Je opent één bestand per keer. Op de desktop en in browsers met bestandstoegang, zoals Chrome en Edge, toont het venster een lijst met bestandstypen: *All Supported*, *IFC Files*, *CSV Files*, *XML Files*, *MS Project Files* en *Primavera XER Files*.
3. Het project opent in een nieuw tabblad. Was het huidige tabblad nog leeg en ongewijzigd, dan opent het project daarin.

Een IFC-bestand geeft zijn bestandsnaam aan het tabblad. Een project uit een ander formaat krijgt zijn projectnaam.

De app opent `.ifc`, `.csv`, `.xml` (MS Project XML of Primavera P6 XML), `.mpp` en `.xer`. Voor de laatste twee staan aparte stappen in [Een MS Project-bestand (.mpp) openen](docs://howto-mpp-openen) en [Een Primavera P6-bestand (.xer) openen](docs://howto-xer-openen).

### Een recent project openen

Kies *Start › Bestand › Recent* en klik op een bestand in de lijst, of kies *Bestand › Recent*. De lijst bewaart de laatste tien bestanden die je opende, opsloeg of exporteerde. De desktopapp toont bij elk bestand het pad, een browser alleen de naam.

Kan de app een bestand uit de lijst niet meer lezen, bijvoorbeeld omdat je het verplaatste, dan verdwijnt het zonder melding uit de lijst. In browsers zonder bestandstoegang, zoals Firefox, blijft *Recent* leeg.

### Een voorbeeld openen

Kies *Bestand › Voorbeelden* en klik op een voorbeeldproject. Het opent in een tabblad, zonder bestand: *Opslaan* vraagt dus waar je het wilt bewaren.

### Opslaan

Kies *Start › Bestand › Opslaan* of *Bestand › Opslaan*, of druk op Ctrl+S. Wat er dan gebeurt, hangt van je project af:

1. Heeft het project al een bestand, omdat je een IFC-bestand opende of het eerder opsloeg, dan schrijft de app naar dat bestand. Er verschijnt geen venster.
2. Heeft het project nog geen bestand, dan vraagt de app waar het moet komen. Ze stelt de projectnaam met `.ifc` voor. Daarna is dat bestand het bestand van het project.
3. Bewaart je browser alleen via een download (zoals Firefox), dan komt het bestand in je downloadmap, en elke keer opslaan maakt een nieuwe download. De eerste keer in een sessie zie je de melding *Opgeslagen als download: 'naam.ifc' staat in je downloadmap. Deze browser laat de app niet naar een eigen plek schrijven, dus elke keer opslaan maakt een nieuwe download. In Chrome, Edge of de desktop-app werkt Opslaan hetzelfde bestand gewoon bij.*
4. Kan je browser niet terugschrijven naar het bestand van het project, dan vraagt de app bij elke keer opslaan opnieuw waar het bestand moet komen. Dat lijkt op *Opslaan als*, maar het is een grens van de browser. De eerste keer in een sessie legt de melding *Deze browser laat de app niet terugschrijven naar 'naam.ifc'.* dat uit, met een link naar [Bestanden](docs://uitleg-bestanden).

Na het opslaan verdwijnt de markering *Niet opgeslagen*: de stip op het tabblad, de asterisk voor de projectnaam bovenaan en de tekst *Niet opgeslagen* rechtsonder in de statusbalk.

### Opslaan onder een andere naam

Kies *Start › Bestand › Opslaan als* of *Bestand › Opslaan als*, of druk op Ctrl+Shift+S. Kies een naam en een plek (in Firefox downloadt de app in plaats daarvan een nieuw bestand). Het project werkt daarna met dit nieuwe bestand: een volgende *Opslaan* schrijft daarheen. Het oude bestand blijft zoals het bij je laatste keer opslaan was.

### Een project sluiten

Klik op het kruisje van het tabblad, of kies *Bestand › Sluit project*. Heeft het project wijzigingen die je niet opsloeg, dan vraagt de app: *Niet-opgeslagen wijzigingen: 'naam' heeft wijzigingen die nog niet zijn opgeslagen.* Je kiest *Annuleren* (het project blijft open), *Niet opslaan* (het project sluit en je wijzigingen zijn weg) of *Opslaan* (eerst opslaan, dan sluiten). Sluit je op de desktop de hele app (met de sluitknop, Alt+F4 of het menu van je besturingssysteem), dan vraagt ze dit voor elk project met wijzigingen; *Annuleren*, of een opslag die mislukt, breekt het afsluiten af. Na zo'n gewone afsluiting ruimt de app de herstelkopieën van die sessie op, zodat het herstelvenster alleen na een echte crash verschijnt. Heeft een project wijzigingen en sluit je het browsertabblad of -venster, dan vraagt de browser om bevestiging.

## Valkuilen en wat de app dan doet

**Een geopend IFC-bestand is meteen het bestand van je project.** *Opslaan* overschrijft dat bestand, ook als het uit een ander programma komt. Wil je het origineel houden, kies dan eerst *Opslaan als*.

**Andere formaten worden nooit overschreven.** Een `.csv`, `.xml`, `.mpp` of `.xer` heeft na het openen geen bestand. *Opslaan* schrijft een nieuw IFC-bestand en laat het origineel ongemoeid.

**In Firefox maakt elke keer opslaan een nieuw bestand.** De app kan daar niet in je bestand schrijven. Ze downloadt telkens een nieuw bestand, met de projectnaam als bestandsnaam en niet met de naam van het bestand dat je opende.

**Chrome en Edge vragen om toestemming.** Bij het eerste *Opslaan* van een bestand dat je opende, vraagt de browser of de app erin mag schrijven. Weiger je dat, dan opent de app een venster waarin je een nieuw bestand kiest. Dat venster krijg je in Chrome en Edge ook als schrijven naar het bestaande bestand niet lukt, bijvoorbeeld omdat het bestand verdween of vergrendeld is.

**Opslaan kan mislukken.** Geeft het opslaan zelf een fout, dan meldt de app *Opslaan mislukt*, met de reden erbij. Je project blijft open en staat nog als *Niet opgeslagen* gemarkeerd.

## Zie ook

- [Bestanden en formaten](docs://uitleg-bestanden): wat er in een IFC-bestand zit en hoe de app formaten behandelt.
- [Automatisch opslaan aanzetten](docs://howto-automatisch-opslaan): de app zelf je bestand laten bijwerken.
- [Exporteren](docs://howto-exporteren): een kopie in een ander formaat maken.
- [Herstellen na een crash](docs://howto-herstellen-na-een-crash): wat je doet als de app niet netjes sloot.
- [Import- en exportformaten](docs://ref-import-exportformaten): per formaat wat meegaat en wat niet.
