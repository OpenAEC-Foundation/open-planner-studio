# Taaktype kiezen

Doel: per taak instellen wat de app aanpast als je de duur, de inzet of het werk wijzigt: de duur, de inzet of het werk zelf.

## Wanneer je dit nodig hebt

Je hebt resources op een taak gezet en je wilt dat de app op jouw manier meerekent. Een voorbeeld: de kraan is voor één dag gehuurd en die dag staat vast. Een ander voorbeeld: je weet dat er 160 uur metselwerk in zit en je wilt zien hoe lang het duurt met drie man in plaats van twee. Voor die twee situaties heb je een ander taaktype nodig.

Het taaktype bepaalt welke van de drie grootheden duur, inzet en werk meebeweegt als je een andere wijzigt. De achtergrond en rekenvoorbeelden staan in [Taaktypes: duur, inzet en werk](docs://uitleg-werkregels).

## Stappen

### Het taaktype zichtbaar maken

Het taaktype staat standaard niet in beeld. Zet het eenmalig aan:

1. Kies *Instellingen › Project › App-instellingen*, tabblad *Planning*.
2. Vink onder het kopje *Berekenen* het vakje *Taaktypes gebruiken* aan.
3. Sluit het venster met *Sluiten*.

Dit is een instelling van de app, niet van het projectbestand. Bevat een bestand al taaktypes of opgeslagen werk, zoals een bestand uit MS Project of Primavera P6, dan toont de app het taaktype voor dat bestand ook zonder deze instelling. Hetzelfde geldt zodra je in een bestand zelf een taaktype kiest: de weergave blijft dan voor dat bestand aan, ook als je de instelling weer uitzet. Ze blijft aan zolang het bestand open is, en na opnieuw openen zolang er een taaktype of opgeslagen werk in staat.

### Een taaktype kiezen

1. Selecteer de taak. Het paneel *Eigenschappen* staat rechts; zie je het niet, zet het dan aan met *Beeld › Panelen › Eigensch.*
2. Kies bij *Taaktype* een van de vijf opties: *Projectstandaard (Vaste duur en inzet)*, *Vaste duur en inzet*, *Vaste duur en werk*, *Vast werk* of *Vaste inzet*. Bij *Projectstandaard* volgt de taak de standaard van het project.
3. Wil je weten wat een keuze doet? In de open keuzelijst staat achter elke keuze een i-icoon. Wijs het aan, klik of tik erop voor de uitleg. Klik je op het i-icoon, dan kiest de app dat taaktype nog niet.
4. Naast het gesloten veld staat ook een i-icoon. Dat legt het taaktype uit dat nu geldt, bijvoorbeeld *De duur volgt uit het werk en de inzet.* Bij *Projectstandaard* is dat het taaktype tussen de haakjes.

*Projectstandaard* is de eerste keuze en staat er standaard. Tussen de haakjes staat het taaktype dat het project nu als standaard heeft. Er is in de app geen knop om die projectstandaard te wijzigen: hij komt uit een import (bijvoorbeeld uit MS Project of Primavera P6) of uit de MCP-koppeling. Wil je voor één taak een ander taaktype, kies dat dan hier.

Je kunt het taaktype ook in de tabel kiezen. Klik op de **+** rechts in de kop van de takenlijst (*Kolom toevoegen*) en kies onder *Planning* de kolom *Taaktype*.

Een taak zonder toewijzing heeft niets om te koppelen, dus het taaktype doet daar niets. Wijs eerst een resource toe (zie [Resources toewijzen met een curve](docs://howto-resource-toewijzen)).

### Het werk zien en aanpassen

Bij een taak met toewijzingen verschijnt in het blok *Toewijzingen* van het paneel *Eigenschappen* een kolom *Werk (rest)*, naast *Eenh./dag*. Dat is het resterende werk van die resource in uren. Een slotje boven een kolom laat zien wat het taaktype vasthoudt: *Eenh./dag* bij *Vaste duur en inzet* en bij *Vaste inzet*, *Werk (rest)* bij *Vaste duur en werk* en bij *Vast werk*.

Wil je het werk zelf wijzigen, typ dan de uren in het veld en druk op Enter. Een waarde van 0 of lager neemt de app niet over: het veld springt terug naar de vorige waarde.

### Zien wat er gebeurt

Kies je een taaktype, dan verandert er nog geen getal. Onder een taaktype dat werk beschermt, legt de app alleen het huidige werk vast, zodat *Werk (rest)* een opgeslagen waarde heeft. Pas bij de volgende wijziging beslist het taaktype wat meebeweegt. Wijzig bijvoorbeeld de *Eenh./dag* en kijk wat er met de duur en het werk gebeurt.

Verandert daardoor de duur van de taak, dan meldt de statusbalk *Verouderd — herbereken (F5)*. Druk op **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*, om de nieuwe datums te zien. Staat *Automatisch berekenen* aan (zelfde tabblad *Planning*, kopje *Berekenen*), dan doet de app dat zelf.

## Welk taaktype past

- **Vaste duur en inzet** past als de duur een afspraak is en de inzet jouw invoer. Het werk volgt uit die twee. Dit is de standaard. De kraan die voor één dag is gehuurd, hoort hier: de dag staat vast en jij bepaalt hoeveel kranen er staan.
- **Vaste duur en werk** past als de taak in een vaste periode klaar moet zijn en je weet hoeveel werk erin zit. Verandert de duur, dan past de app de inzet aan.
- **Vast werk** past als je weet hoeveel uur werk erin zit en wilt zien hoe de duur meebeweegt met het aantal mensen. De 160 uur metselwerk met drie man in plaats van twee hoort hier. Het stucwerk in het oefenproject krijgt dit taaktype.
- **Vaste inzet** past als de inzet vaststaat, bijvoorbeeld één kraan, en het werk de duur bepaalt.

## Valkuilen en wat de app dan doet

**Het veld *Taaktype* ontbreekt.** Dan staat de instelling *Taaktypes gebruiken* uit en heeft het bestand nog geen taaktypes, of je hebt een mijlpaal, een fase, een hangmat of een taak met het duurtype *Verstreken tijd* geselecteerd. Daar bestaat geen taaktype. Selecteer een gewone taak.

**De duur verandert zonder dat ik hem wijzig.** Onder *Vast werk* en *Vaste inzet* volgt de duur uit inzet en werk. Wijzig je een van die twee of het aantal resources, dan past de app de duur aan, afgerond op hele werkdagen. Bij een taak in uren rondt de app af op hele minuten.

**Het werk klopt niet precies met inzet × duur.** Door de afronding kan dat. Naast *Werk (rest)* staat dan een waarschuwingsteken, *Wijkt af van inzet × duur*. Het histogram volgt het opgeslagen werk.

**Materiaal telt niet mee.** Bij een materiaalresource staat in *Werk (rest)* een streepje. Materiaal stuurt de duur nooit.

**Een taak met voortgang.** Het taaktype werkt op het resterende deel. *Werk (rest)* toont dus alleen wat nog moet gebeuren.

**Terugdraaien.** Een taaktype kiezen en elke wijziging die het taaktype doorrekent, is één stap voor *Ongedaan* (Ctrl+Z). Het gekozen taaktype verdwijnt dan weer, maar het veld *Taaktype* blijft in beeld.

## Zie ook

- [Taaktypes: duur, inzet en werk](docs://uitleg-werkregels): hoe de app duur, inzet en werk koppelt, met rekenvoorbeelden.
- [Resources toewijzen met een curve](docs://howto-resource-toewijzen): een resource op een taak zetten.
