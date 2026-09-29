# Werkregel kiezen

Doel: per taak instellen wat de app aanpast als je de duur, de inzet of het werk wijzigt: de duur, de inzet of het werk zelf.

## Wanneer je dit nodig hebt

Je hebt resources op een taak gezet en je wilt dat de app op jouw manier meerekent. Een voorbeeld: de kraan is voor één dag gehuurd en die dag staat vast. Een ander voorbeeld: je weet dat er 160 uur metselwerk in zit en je wilt zien hoe lang het duurt met drie man in plaats van twee. Voor die twee situaties heb je een andere werkregel nodig.

De regel bepaalt welke van de drie grootheden duur, inzet en werk meebeweegt als je een andere wijzigt. De achtergrond en rekenvoorbeelden staan in [Werkregels: duur, inzet en werk](docs://uitleg-werkregels).

## Stappen

### De werkregel zichtbaar maken

De werkregel staat standaard niet in beeld. Zet hem eenmalig aan:

1. Kies *Instellingen › Project › Instellingen*, tabblad *Planning*.
2. Vink onder het kopje *Berekenen* het vakje *Toon werkregels en werk* aan.
3. Sluit het venster met *Sluiten*.

Dit is een instelling van de app, niet van het projectbestand. Bevat een bestand al werkregels of opgeslagen werk, zoals een bestand uit MS Project of Primavera P6, dan toont de app de werkregel voor dat bestand ook zonder deze instelling. Hetzelfde geldt zodra je in een bestand zelf een werkregel kiest: de weergave blijft dan voor dat bestand aan, ook als je de instelling weer uitzet.

### Een regel kiezen

1. Selecteer de taak. Het paneel *Eigenschappen* staat rechts; zie je het niet, zet het dan aan met *Beeld › Panelen › Eigensch.*
2. Kies bij *Werkregel* een van de vijf opties: *Vaste duur en inzet*, *Vaste duur en werk*, *Vast werk*, *Vaste inzet* of *Projectstandaard (Vaste duur en inzet)*. Bij die laatste volgt de taak de standaard van het project.
3. Onder de keuzelijst staat wat de regel beschermt, bijvoorbeeld *Beschermd: werk (duur volgt de inzet)*.

Je kunt de regel ook in de tabel kiezen. Klik op de **+** rechts in de kop van de takenlijst (*Kolom toevoegen*) en kies onder *Planning* de kolom *Werkregel*.

Een taak zonder toewijzing heeft niets om te koppelen, dus de regel doet daar niets. Wijs eerst een resource toe (zie [Resources toewijzen met een curve](docs://howto-resource-toewijzen)).

### Het werk zien en aanpassen

Bij een taak met toewijzingen verschijnt in het blok *Toewijzingen* van het paneel *Eigenschappen* een kolom *Werk (rest)*, naast *Eenh./dag*. Dat is het resterende werk van die resource in uren. Een slotje boven een kolom laat zien wat de regel vasthoudt: *Eenh./dag* bij *Vaste duur en inzet* en bij *Vaste inzet*, *Werk (rest)* bij *Vaste duur en werk* en bij *Vast werk*.

Wil je het werk zelf wijzigen, typ dan de uren in het veld en druk op Enter. Een waarde van 0 of lager neemt de app niet over: het veld springt terug naar de vorige waarde.

### Zien wat er gebeurt

Kies je een regel, dan verandert er nog geen getal. Onder een regel die werk beschermt, legt de app alleen het huidige werk vast, zodat *Werk (rest)* een opgeslagen waarde heeft. Pas bij de volgende wijziging beslist de regel wat meebeweegt. Wijzig bijvoorbeeld de *Eenh./dag* en kijk wat er met de duur en het werk gebeurt.

Verandert daardoor de duur van de taak, dan meldt de statusbalk *Verouderd — herbereken (F5)*. Druk op **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*, om de nieuwe datums te zien. Staat *Automatisch berekenen* aan (zelfde tabblad *Planning*, kopje *Berekenen*), dan doet de app dat zelf.

## Welke regel past

- **Vaste duur en inzet** past als de duur een afspraak is en de inzet jouw invoer. Het werk volgt uit die twee. Dit is de standaard.
- **Vaste duur en werk** past als de taak in een vaste periode klaar moet zijn en je weet hoeveel werk erin zit. Verandert de duur, dan past de app de inzet aan.
- **Vast werk** past als je weet hoeveel uur werk erin zit en wilt zien hoe de duur meebeweegt met het aantal mensen. Het stucwerk in het oefenproject krijgt deze regel.
- **Vaste inzet** past als de inzet vaststaat, bijvoorbeeld één kraan, en het werk de duur bepaalt.

## Valkuilen en wat de app dan doet

**Het veld *Werkregel* ontbreekt.** Dan staat de instelling *Toon werkregels en werk* uit en heeft het bestand nog geen werkregels, of je hebt een mijlpaal, een fase of een hangmat geselecteerd. Daar bestaat geen werkregel. Selecteer een gewone taak.

**De duur verandert zonder dat ik hem wijzig.** Onder *Vast werk* en *Vaste inzet* volgt de duur uit inzet en werk. Wijzig je een van die twee of het aantal resources, dan past de app de duur aan, afgerond op hele werkdagen. Bij een taak in uren rondt de app af op hele minuten.

**Het werk klopt niet precies met inzet × duur.** Door de afronding kan dat. Naast *Werk (rest)* staat dan een waarschuwingsteken, *Wijkt af van inzet × duur*. Het histogram volgt het opgeslagen werk.

**Materiaal telt niet mee.** Bij een materiaalresource staat in *Werk (rest)* een streepje. Materiaal stuurt de duur nooit.

**Een taak met voortgang.** De regel werkt op het resterende deel. *Werk (rest)* toont dus alleen wat nog moet gebeuren.

**Terugdraaien.** Een regel kiezen en elke wijziging die de regel doorrekent, is één stap voor *Ongedaan* (Ctrl+Z).

## Zie ook

- [Werkregels: duur, inzet en werk](docs://uitleg-werkregels): hoe de app duur, inzet en werk koppelt, met rekenvoorbeelden.
- [Resources toewijzen met een curve](docs://howto-resource-toewijzen): een resource op een taak zetten.
