# Rapporten & printen

Een planning is pas af als je hem ook kunt delen — op papier voor een bouwvergadering, als
afbeelding in een presentatie, of als overzicht van wat er straks moet gebeuren en wat er al
verschoven is. Daarvoor is er het tabblad **Rapport**, met drie rapporttypen en een printvoorbeeld.

## Wat je hier leert

- De drie rapporttypen op het tabblad **Rapport**: Gantt-afdruk, mijlpalen-overzicht, variance.
- Hoe het printvoorbeeld werkt: papierformaat, oriëntatie en welke elementen je aan/uit zet.
- Hoe je een rapport daadwerkelijk afdrukt of als bestand bewaart.
- Wat **Ctrl+P** doet in deze app.

## Naar het rapportscherm

Er zijn drie ingangen naar hetzelfde scherm: klik op het lint-tabblad **Rapport**, ga naar
**Backstage → Afdrukken** (dat opent direct het rapportscherm), of druk op **Ctrl+P**. Alle drie
komen uit op dezelfde plek — er is geen los "print"-dialoogvenster, het rapportscherm ís het
afdrukvoorbeeld.

Het scherm is in twee kolommen opgedeeld: links een instellingenpaneel met bovenaan de keuze
**Rapporttype**, rechts een live voorbeeld dat direct meebeweegt met wat je links instelt.

## De drie rapporttypen

### Gantt-afdruk

Een volledige, opgemaakte afdruk van de Gantt-balken — dit is het enige rapporttype met een
instellingenblok:

- **Papier**: A4, A3 of A1.
- **Oriëntatie**: liggend of staand.
- **Auto-fit op papier** (aan = de planning schaalt automatisch naar het gekozen formaat) of een
  handmatige **zoom**-schuif als je auto-fit uitzet.
- Aan/uit-schakelaars voor **taaknamen op staafjes**, **voltooiing tonen**, **kritiek pad**,
  **speling tonen**, **afhankelijkheden**, **weekenden** en **legenda**.
- Een **bedrijf**-veld (vult automatisch de projectinstelling, maar is hier los aanpasbaar) en de
  **auteur** (alleen-lezen, uit de projectgegevens).

Het overzichtsblok erboven toont live het aantal taken, bladtaken, kritieke taken en relaties in
het project.

### Mijlpalen-overzicht

Een tabel van alle mijlpalen in het project: WBS, naam, soort (automatisch/start/eind), datum, de
onderliggende beperking of deadline, speling, of de mijlpaal verplicht is, en status (op schema /
kritiek / te laat). Het overzichtsblok toont het totaal aantal mijlpalen, hoeveel er verplicht zijn
en hoeveel er te laat zijn. Dit rapport heeft geen papierformaat-/oriëntatie-instellingen — het
print de tabel zoals getoond.

### Variance

Vergelijkt de huidige planning met de actieve baseline: baseline-start/-einde tegenover de huidige
start/einde, het verschil in werkdagen voor start en einde, en een status per taak (op schema /
later / eerder / nieuw / vervallen). Is er geen actieve baseline, dan meldt het scherm dat expliciet
in plaats van een leeg rapport te tonen. Het overzichtsblok toont ook de verschuiving van de
projecteinddatum in werkdagen, als die er is. Zie de gids [Baselines & voortgang](docs://gids-baselines-voortgang)
voor hoe je een baseline vastlegt vóórdat je dit rapport zinvol kunt gebruiken.

## Afdrukken en exporteren

Onderaan het instellingenpaneel staat altijd een knop **Afdrukken...** — die opent een apart
afdrukvenster met het rapport erin en start meteen de browser-/systeem-printdialoog. Bij het
Gantt-rapport gebruikt dat venster het gekozen papierformaat en de oriëntatie; het mijlpalen- en
variance-rapport printen de tabel zoals weergegeven.

Alleen bij het Gantt-rapport staat er ook een knop **Exporteer PDF**. Ondanks het label bewaart
die knop het huidige voorbeeld als een **PNG-afbeelding** (bestandsnaam eindigend op
`-planning.png`) — geen PDF-bestand. Wil je écht een PDF, gebruik dan **Afdrukken...** en kies in
de systeem-printdialoog "Opslaan als PDF" (de meeste besturingssystemen en browsers bieden dat als
optie in het printvenster).

## Rapporten in de praktijk

Elk rapporttype dient een ander gesprek:

- Het **Gantt-rapport** is de klassieke bouwvergadering-uitdraai: het kritieke pad rood/gemarkeerd,
  de speling zichtbaar op de niet-kritieke balken, en de legenda die uitlegt wat welke kleur
  betekent. Zet **taaknamen op staafjes** en **voltooiing tonen** aan als het publiek de planning
  zelf niet kent; zet ze uit voor een strak overzicht op A1 als er toch een aparte takenlijst
  bijgaat.
- Het **mijlpalen-overzicht** is bedoeld voor wie alleen de belangrijke data wil zien zonder door
  tientallen taakregels te bladeren — bijvoorbeeld een opdrachtgever die vooral wil weten of de
  verplichte opleverdata gehaald worden. Het ◆-symbool voor een mijlpaalnaam in de tabel markeert
  een **verplichte** mijlpaal.
- Het **variance-rapport** is het gesprek over bijsturen: welke taken lopen uit ten opzichte van de
  baseline, en met hoeveel werkdagen. Bekijk dit rapport in de praktijk in de showcase
  [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), die twee
  baselines bevat (een contractbaseline en een herbaseline na meerwerk) met eigen voortgang en
  statusdatum — een goed voorbeeld om te zien hoe de Δ-kolommen zich vullen zodra er daadwerkelijk
  verschil is tussen baseline en actuele planning.

Het live voorbeeld rechts ververst bij elke wijziging aan de instellingen links — er is geen aparte
"vernieuwen"-knop nodig, en niets wordt pas bij het afdrukken zelf berekend.

## Verder lezen

- Een variance-rapport heeft pas iets te vergelijken als er een baseline is vastgelegd — lees de
  gids [Baselines & voortgang](docs://gids-baselines-voortgang).
- Kritiek pad en speling die op het Gantt-rapport getoond worden, komen uit dezelfde berekening als
  in de Gantt-weergave zelf — lees de gids
  [Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse) voor hoe je dat leest.
