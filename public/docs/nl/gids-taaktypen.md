# Taaktypen

Taaktypen zijn een classificatie van een taak. Ze veranderen geen duur, kalender, voortgang of planning.

## Ingebouwde en eigen typen

Open het veld **Type** in de eigenschappen van een taak of in het venster **Taak bewerken**. De vaste typen, zoals **Bouw** en **Installatie**, blijven ingebouwd en volgen de taal van de app. Je kunt ze niet hernoemen of verwijderen.

Onder **Mijn taaktypen** staan je eigen typen. Kies **+ Nieuw taaktype…** om bijvoorbeeld `Engineering` of `Vergunning` toe te voegen. Een eigen type is direct op deze installatie beschikbaar in alle projecten.

## Beheren

Kies **Taaktypen beheren…** onderaan dezelfde keuzelijst om alleen je eigen typen te hernoemen of te verwijderen. Namen worden opgeschoond, mogen niet leeg zijn en zijn niet dubbel, ook niet met alleen een verschil in hoofdletters.

Een type uit een geopend project dat nog niet in jouw lijst staat, verschijnt onder **Uit dit project**. Vanuit het beheer kun je het bewust toevoegen aan **Mijn taaktypen**.

## Delen en IFC

Zodra je een eigen type aan een taak toekent, bewaart OPS ook een projectkopie met zijn stabiele identiteit en naam. Het type blijft dus zichtbaar als iemand het IFC-bestand op een andere installatie opent. Daar wordt het niet automatisch aan diens persoonlijke lijst toegevoegd.

Voor IFC-programma's buiten OPS blijft zo'n taak geldig als `USERDEFINED`; de leesbare naam staat in het standaard ObjectType-veld. OPS bewaart daarnaast de stabiele identiteit in projectmetadata, zodat een hernoeming nooit bestaande taaktoekenningen breekt.

## Importeren en exporteren

IFC is het volledige, aanbevolen uitwissel- en opslagformaat voor eigen taaktypen. Bij CSV-export schrijft OPS naast de leesbare typenaam een aparte OPS-id-kolom; bij opnieuw importeren blijven naam en identiteit daardoor gekoppeld. Een onbekende typenaam uit een externe CSV wordt als type **Uit dit project** ingelezen en niet automatisch aan **Mijn taaktypen** toegevoegd.

MS Project XML en P6 XML hebben geen gelijkwaardig standaardveld voor deze OPS-classificatie. OPS schrijft daarom een herkenbaar vrij tekstveld dat andere planners mogen negeren. Een rechtstreekse OPS-export en -import behoudt de identiteit, maar een ander programma kan zo'n vrij veld bij bewerken of opnieuw exporteren verwijderen. Sla het project daarna als IFC op wanneer de classificatie behouden moet blijven.

Native `.mpp` is alleen een importformaat. Een geïmporteerd MS Project-taaktype is niet hetzelfde als een eigen OPS-taaktype. Je kunt na de import een eigen type toekennen en het resultaat als IFC bewaren; OPS maakt geen `.mpp`-export met eigen taaktypen.

Een type verwijderen uit **Mijn taaktypen** wist geen taken en herschrijft geen projectbestanden. In een geopend project blijft de projectkopie dan onder **Uit dit project** staan.
