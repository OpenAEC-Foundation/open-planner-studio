# Taken splitsen

Soms ligt het werk aan een taak een tijdje stil en gaat het daarna gewoon verder: de ploeg wordt een week naar een ander project gehaald, het materiaal komt later, of er valt een bouwvak tussen. Met een **onderbreking** leg je dat vast in de taak zelf, in plaats van hem in losse taken op te knippen. De balk in de Gantt toont dan werk, een pauze en weer werk, en de planning rekent daarmee door.

## Wat je hier leert

- Wanneer een onderbreking beter past dan twee losse taken.
- Een onderbreking maken met de splits-modus in de Gantt.
- Stukken en pauzes verslepen, samenvoegen en langer of korter maken.
- De onderbrekingen exact invullen in het eigenschappenpaneel.
- Wat er met de duur en de datums gebeurt, en welke taken je niet kunt splitsen.
- Wat er gebeurt bij een export naar MS Project of P6, en hoe de AI-assistent onderbrekingen zet.

## Onderbreking of losse taken?

Neem twee projecten die dezelfde metselploeg delen. Op project A metselt de ploeg vijf dagen, gaat dan drie dagen naar project B en komt daarna terug om het metselwerk op A af te maken. Het is één stuk werk dat stilligt en weer verdergaat.

- Gebruik een **onderbreking** als het om hetzelfde werk gaat dat wordt opgeschort en hervat. De taak houdt één naam, één duur, één set relaties en één voortgang; alleen de balk loopt door de pauze heen.
- Gebruik **losse taken** als de delen echt verschillend werk zijn, elk hun eigen relaties nodig hebben, of door verschillende mensen worden uitgevoerd.

Een onderbreking verandert de werkduur niet. Een taak van 10 werkdagen met een pauze van 3 werkdagen blijft 10 werkdagen werk; hij eindigt alleen 3 werkdagen later.

## Een onderbreking maken in de Gantt

1. Klik in het lint op **Taak splitsen** (tabblad Start of Planning). De splits-modus staat nu aan en er verschijnt een korte uitleg met een knop **Stoppen**. Op het tabblad Tabel staat de knop uit, want daar is geen Gantt om op te klikken; wissel je tijdens de modus naar de Tabel, dan gaat de modus uit.
2. Wijs op de balk de dag aan waarop de pauze moet beginnen. Een verticale lijn toont de dag.
3. Klik en sleep naar rechts voor de lengte van de pauze. Een label toont hoeveel werkdagen pauze het wordt. Loslaten zonder te slepen maakt een pauze van één werkdag (of één uur bij een uurtaak).
4. De modus blijft aan, zodat je meteen nog een onderbreking kunt maken. Druk op **Esc** of klik opnieuw op **Taak splitsen** om te stoppen.

Op een balk die je niet kunt splitsen verschijnt een verbodscursor.

## Stukken en pauzes bewerken

Buiten de splits-modus kun je een onderbroken balk gewoon met de muis bewerken:

- **Het eerste stuk verslepen** verplaatst de hele taak, net als bij een gewone balk.
- **Een later stuk verslepen** maakt de pauze ervóór langer of korter. Sleep je het stuk helemaal tegen het vorige aan, dan worden de twee stukken samengevoegd en verdwijnt die pauze.
- **De rechterrand van een stuk verslepen** maakt dat stuk langer of korter. Dat verandert de duur van de taak: het werk wordt niet over de andere stukken verdeeld.

Elke sleepbeweging is één stap die je met **Ctrl+Z** ongedaan maakt.

Klik je met de rechtermuisknop op een onderbroken balk, dan kies je **Onderbreking opheffen** (de pauze onder de cursor) of **Alle onderbrekingen opheffen**.

## De sectie Onderbrekingen in het eigenschappenpaneel

Selecteer de taak; in het eigenschappenpaneel staat dan de sectie **Onderbrekingen**. Per pauze zie je één regel:

- **na** — hoeveel werkdagen werk er vóór de pauze ligt, gerekend vanaf de start van de taak. Pauzes tellen hier niet mee: bij een tweede pauze tel je alleen het werk.
- **pauze** — de lengte van de pauze in werkdagen.
- de datums van en tot, zodat je ziet waar de pauze in de kalender valt;
- een knop om de pauze te verwijderen.

Een pauze op 0 zetten heft hem op. Met **Onderbreking toevoegen** zet je een nieuwe pauze van één werkdag halverwege het langste stuk; daarna stel je hem bij. Bij een uurtaak staan dezelfde velden in uren.

Een pauze die door de resourcenivellering is gemaakt, draagt het kenmerk *nivellering*. Bewerk je de onderbrekingen van zo'n taak zelf, dan worden die pauzes van jou: **Nivellering wissen** haalt ze daarna niet meer weg.

## Wat er met de duur en de datums gebeurt

- De balk groeit meteen mee met de pauze. Opvolgers schuiven pas bij de volgende berekening: druk op **F5**, klik op **Bereken**, of zet **Automatisch berekenen** aan.
- Een taak die al gestart is, kun je alleen in het resterende deel onderbreken; in werk dat al gedaan is kan geen pauze meer vallen.
- Heeft de taak een eigen urenverdeling per toewijzing, dan schuift die verdeling mee: het werk per werkdag blijft gelijk, alleen de pauzedagen verschuiven.
- Onderbrekingen worden gewoon opgeslagen in het projectbestand en komen bij het openen terug.

## Welke taken je niet kunt splitsen

- mijlpalen;
- verzameltaken (onderbreek dan de deeltaken);
- hammock-taken;
- taken met een doorlooptijd in kalenderdagen (verstreken tijd);
- handmatig geplande taken;
- taken korter dan twee werkdagen (of twee uur bij een uurtaak).

## Onderbrekingen uit MS Project

Een taak die in MS Project al onderbroken was, komt met die onderbrekingen binnen (zie [MS Project (.mpp) openen](docs://gids-msproject-import)). Meestal kun je die daarna gewoon bewerken. Soms staan ze in een vorm die hier niet te bewerken is, bijvoorbeeld pauzes die elkaar overlappen of die ná het laatste werk van de taak vallen. De sectie Onderbrekingen toont dan een gekleurd blok met de uitleg en alleen de knop **Alle onderbrekingen opheffen**: de onderbrekingen blijven precies zoals ze in het bestand staan, tot je ze bewust opheft.

## Exporteren naar MS Project of P6

MS Project en Primavera P6 kennen een onderbreking alleen als urenverdeling van een toewijzing. Heeft een onderbroken taak geen eigen urenverdeling, dan komt hij daar zonder onderbrekingen aan, als één doorlopende taak. Na zo'n export meldt de app hoeveel taken dat betreft. In het eigen projectbestand (IFC) blijft alles bewaard. Zie ook [Im-/export](docs://gids-import-export).

## Met de AI-assistent

De AI-assistent zet onderbrekingen met de tool `planner_set_task_splits`, in dezelfde vorm als het paneel: na hoeveel werkdagen werk, en hoeveel werkdagen pauze. Een lege lijst heft alle onderbrekingen van de taak op. De assistent leest ze terug via `planner_get_task`. Hoe je een assistent koppelt, lees je in [AI-assistent koppelen (MCP)](docs://gids-ai-mcp).
