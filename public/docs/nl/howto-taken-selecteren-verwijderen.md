# Taken selecteren, verwijderen en ongedaan maken

Doel: taken kiezen, ze weghalen en een vergissing terugdraaien.

## Wanneer je dit nodig hebt

Bijna elke handeling in de planning werkt op de taken die je hebt geselecteerd: verwijderen, kopiëren, inspringen, een mijlpaal aan- of uitzetten. Je haalt taken weg als het werk vervalt of de planning wordt herzien. En omdat de app bij het verwijderen niets bevestigt, is *Ongedaan* je vangnet.

## Stappen

### Taken selecteren

- **Eén taak.** Klik op de rij in de takenlijst of op de balk in de Gantt.
- **Meer taken.** Ctrl+klik (op een Mac ⌘+klik) voegt een taak toe aan de selectie of haalt hem eruit. In de takenlijst selecteert Shift+klik alle taken van de actieve taak tot de aangeklikte.
- **Alle zichtbare taken.** Ctrl+A, met de focus in de takenlijst of in de Gantt. Taken die een filter verbergt vallen erbuiten, en ook subtaken in een ingeklapte fase.
- **Een kader in de Gantt.** Houd Ctrl ingedrukt en sleep over de lege achtergrond: alle taken in de rijen die het kader raakt worden geselecteerd, ook als hun balk ernaast ligt: alleen de hoogte van het kader telt, niet de tijdas. Laat je Ctrl pas los na de muisknop, dan komen ze bij de bestaande selectie; anders vervangen ze die. Zonder Ctrl verschuift dat slepen in de standaardinstelling de tijdlijn.
- **Niets meer.** Esc, of een klik op de lege achtergrond van de Gantt.

Selecteer je een samenvattingstaak, dan zijn haar subtaken niet mee geselecteerd. Verwijderen en kopiëren nemen ze wel mee.

### Taken verwijderen

Selecteer de taken en kies een van deze routes:

- *Start › Bewerken › Verwijder*. Dezelfde knop staat op het tabblad *Tabel*.
- Delete of Backspace, als de focus niet in de takenlijst staat: klik dus eerst op een balk in de Gantt.
- *Verwijderen* in het rechtermuismenu. Zit de aangeklikte taak in de selectie, dan geldt het voor de hele selectie, anders alleen voor die ene taak.
- Het prullenbakje bovenaan het paneel *Eigenschappen* (tooltip *Verwijder taak*). Dat verwijdert de taak die het paneel toont.

De app vraagt niets om te bevestigen. Verwijder je meer taken tegelijk, dan is dat één stap voor *Ongedaan*.

Wat er mee verdwijnt: alle subtaken van een verwijderde samenvattingstaak, alle relaties van en naar de verwijderde taken, en hun resource-toewijzingen. Verwijder je de laatste subtaak van een samenvattingstaak, dan blijft die als gewone taak over. Staat *WBS auto* aan, dan nummert de app de boom opnieuw. De planning is daarna verouderd: druk op **Bereken** (F5), tenzij *Automatisch berekenen* aan staat.

### In- en uitklappen

Een samenvattingstaak heeft een driehoek voor haar naam in de takenlijst; klik erop om haar subtaken te verbergen of te tonen. Met *Beeld › Overzicht › Inklappen* en *Uitklappen* doe je het voor de geselecteerde samenvattingstaken, of voor alle als er niets geselecteerd is. Ook het rechtermuismenu van een samenvattingstaak heeft *Inklappen* en *Uitklappen*. Bij een gegroepeerde weergave werken de knoppen op de groepen.

In- en uitklappen bewaart de app per geopend document. Het staat niet in *Ongedaan* en niet in het projectbestand.

### Ongedaan maken en opnieuw

- *Start › Bewerken › Ongedaan* en *Opnieuw* (ook op het tabblad *Tabel*), de pijlen in de titelbalk, of Ctrl+Z voor ongedaan en Ctrl+Y of Ctrl+Shift+Z voor opnieuw.
- Doe je na een *Ongedaan* iets nieuws, dan is *Opnieuw* weg.

Onder *Ongedaan* vallen wijzigingen in je projectgegevens (taken, relaties, resources, kalenders en dergelijke), en het toepassen van een layout. Ook wijzigingen aan de kolommen van de takenlijst zijn stappen: toevoegen, weghalen, verplaatsen, de breedte aanpassen, passend maken, vastzetten en de kolomindeling op standaard zetten. Die kolomstappen horen bij de takenlijst zelf en gelden voor de hele app, niet voor één document. De app bewaart de laatste honderd stappen per document, en bij een heel groot project minder.

## Valkuilen en wat de app dan doet

**Delete in de takenlijst verwijdert geen taak.** Staat de focus in de takenlijst, dan wist Delete (of Backspace) de inhoud van de geselecteerde cellen. Bij een verplichte of berekende cel, zoals de naam of de duur, weigert de app dat en toont hij onder de takenlijst een melding, bij de naam bijvoorbeeld *Deze waarde is verplicht en kan niet leeg blijven.* Dan wordt er niets gewist, ook niet in andere geselecteerde cellen. Klik op een balk in de Gantt of gebruik *Verwijder* (op het tabblad *Tabel*, waar geen Gantt is: *Tabel › Bewerken › Verwijder* of het rechtermuismenu).

**Een hele fase gaat in één keer weg.** Verwijder je een samenvattingstaak, dan verdwijnen haar subtaken, hun relaties en toewijzingen mee. *Ongedaan* (Ctrl+Z) brengt alles terug, ook de relaties en toewijzingen.

**Wat niet terugkomt.** De selectie, in- en uitklappen en de knop *Wissen* in de strook *Niet beschikbaar tijdens filteren/groeperen/sorteren* staan niet in *Ongedaan*. Druk je na *Wissen* op Ctrl+Z, dan draai je dus je vorige stap terug, niet het wissen.

**Een taak weghalen waar andere taken aan vastzitten.** De relaties van en naar die taak verdwijnen ook. Taken die alleen daaraan vastzaten, hangen dan los en beginnen na **Bereken** weer op hun eigen geplande start. Leg zo nodig nieuwe relaties, zie [Relaties leggen](docs://howto-relaties-leggen).

## Zie ook

- [Taken en mijlpalen toevoegen](docs://howto-taken-en-mijlpalen-toevoegen): het omgekeerde, en het kopiëren van taken.
- [Structuur aanpassen](docs://howto-structuur-aanpassen): een taak onder een andere fase hangen in plaats van weghalen.
