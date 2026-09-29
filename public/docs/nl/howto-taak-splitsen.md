# Een taak splitsen

Doel: een taak onderbreken, zodat het werk ophoudt en later weer verdergaat, zonder dat je er twee taken van maakt.

## Wanneer je dit nodig hebt

Het leggen van de wapening duurt acht werkdagen, maar na vier dagen moet de kraan naar een andere klus en gaat het werk twee dagen later verder. Twee losse taken maken betekent dat je relaties en toewijzingen dubbel bijhoudt. Met een **onderbreking** blijft het één taak, met één balk die een gat heeft. De app noemt de onderbreking ook wel *pauze*.

Het werk blijft even lang, maar de taak duurt nu langer op de kalender. Een voorbeeld: een taak van 8 werkdagen die dinsdag 29 september 2026 begint, eindigt op donderdag 8 oktober. Zet je na 4 werkdagen een onderbreking van 2 werkdagen, dan eindigt hij op maandag 12 oktober. De duur blijft 8 werkdagen, alleen het einde schuift twee werkdagen op.

## Stappen

### Splitsen in de Gantt

1. Kies *Start › Taken › Taak splitsen*. Boven de planning verschijnt de melding *Klik op een balk op de dag waar de onderbreking begint en sleep naar rechts voor de lengte. Esc stopt.* Dezelfde knop staat op *Planning* en op *Tabel*.
2. Beweeg de muis boven de balk. Een stippellijn en een label met de datum laten zien waar de onderbreking zou beginnen. Druk op de balk, op de dag waarop de onderbreking begint.
3. Sleep naar rechts. Het label toont de lengte, bijvoorbeeld *2 werkdagen pauze*: de afstand in werkdagen tot de dag onder je muis. Laat los.

Klik je alleen, zonder te slepen, dan wordt de pauze één werkdag. Terugslepen naar links maakt de pauze weer korter, tot minimaal één werkdag. Bij een taak die in uren staat, gaat het in uren.

De modus blijft aan, zodat je meer taken kunt splitsen. Je stopt met Esc of met de knop *Stoppen* in de melding. Druk je Esc tijdens het slepen, dan draait de app de pauze terug en stopt de modus. Elk gebaar is één stap voor *Ongedaan*.

Na een splitsing is de planning verouderd. Druk op **Bereken** (F5) voor de definitieve datums.

### Een bestaande onderbreking in de Gantt verslepen

Dit werkt zonder splitsmodus, direct op een balk met een onderbreking.

- Sleep het stuk **na** de pauze naar rechts of links. De pauze wordt langer of korter, met het label *3 werkdagen pauze*. Sleep je hem terug tot de pauze 0 is, dan toont het label *Samenvoegen* en de twee stukken zijn weer één.
- Sleep de rechterrand van het stuk **voor** de pauze. Dat stuk wordt langer of korter, met het label *Stuk: 5 werkdagen*. De duur van de taak verandert daarmee mee.
- Sleep je het eerste stuk, dan verplaats je zoals bij elke balk de hele taak.

### Splitsen en aanpassen in het paneel Eigenschappen

Selecteer de taak. Onderaan het paneel *Eigenschappen* staat het blok *Onderbrekingen*.

- *Onderbreking toevoegen* zet een pauze van één werkdag halverwege het langste stuk.
- Per pauze staan er twee vakken: *na* (hoeveel werkdagen werk er voor de pauze zit) en *pauze* (de lengte van de pauze). Erachter staan de datums van het stuk na de pauze. Bij een urentaak staan er uren.
- Zet je *pauze* op 0, dan verdwijnt de onderbreking. Het prullenbakje (*Onderbreking verwijderen*) doet hetzelfde.

Pas op met *na*: dat vak verlengt of verkort het werkstuk vóór de pauze, en daarmee de duur van de hele taak. Met *pauze* verandert alleen het einde.

### Een onderbreking weghalen

Klik met de rechtermuisknop op de onderbreking in de Gantt, of op het stuk erna, en kies *Onderbreking opheffen*. *Alle onderbrekingen opheffen* staat in het rechtermuismenu van elke balk met een onderbreking. Of gebruik het blok *Onderbrekingen* in het paneel *Eigenschappen*, zoals hierboven.

## Valkuilen en wat de app dan doet

**Niet elke taak is te splitsen.** Een mijlpaal, een samenvattingstaak, een taak waarbij *Hammock (afgeleide duur)* aan staat, een taak met duurtype *Verstreken tijd*, een taak die *Handmatig gepland* is en een taak korter dan twee werkdagen kun je niet splitsen. In de splitsmodus toont de muis dan een verbodscursor en er gebeurt niets. Bij zo'n taak ontbreekt ook het blok *Onderbrekingen* in *Eigenschappen*.

**Op de tab Tabel werkt de knop niet.** *Taak splitsen* is daar uitgeschakeld, met de tooltip *Alleen beschikbaar als de Gantt in beeld is*. Het gebaar heeft een balk nodig. De splitsmodus en de relatiemodus zetten elkaar uit.

**Een klik zonder effect.** Een onderbreking kan niet op de eerste dag van de taak beginnen en niet binnen een bestaande pauze. Ook moet elk stuk werk minstens één werkdag lang blijven. Klik je op zo'n plek, dan gebeurt er niets, zonder melding.

**Nivelleren maakt ook onderbrekingen.** Die staan in het blok *Onderbrekingen* met het label *nivellering*. *Resources › Nivellering › Nivellering wissen* haalt ze weer weg. Bewerk je de onderbrekingen van zo'n taak zelf, dan worden al haar nivelleerpauzes van jou en haalt *Nivellering wissen* ze niet meer weg.

**Onderbrekingen komen niet mee naar MS Project of Primavera.** Exporteer je naar *MS Project XML* of *Primavera P6 XML*, dan kent dat programma een onderbreking alleen als urenverdeling van een toewijzing. Zonder zo'n urenverdeling komt de taak zonder onderbreking aan, en de app meldt hoeveel taken dat zijn: *1 taak met onderbrekingen is zonder onderbrekingen geëxporteerd: MS Project/P6 kennen die alleen als urenverdeling.* In het IFC-bestand van de app blijven ze wel bewaard.

**Bestand met onderbrekingen die de app niet kan bewerken.** Onderbrekingen uit een bronbestand die niet in de vorm van de app passen, tonen in het paneel de melding *Deze onderbrekingen komen uit het bronbestand in een vorm die hier niet bewerkt kan worden*, met alleen *Alle onderbrekingen opheffen*.

## Zie ook

- [Kritiek pad en speling](docs://uitleg-kritiek-pad): hoe de planning rekent met werkdagen en waarom het einde opschuift.
- [Relaties leggen](docs://howto-relaties-leggen): een andere modus in de Gantt, die je met een balksleep gebruikt.
