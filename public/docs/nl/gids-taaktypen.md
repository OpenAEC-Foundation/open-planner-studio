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

Een type verwijderen uit **Mijn taaktypen** wist geen taken en herschrijft geen projectbestanden. In een geopend project blijft de projectkopie dan onder **Uit dit project** staan.
