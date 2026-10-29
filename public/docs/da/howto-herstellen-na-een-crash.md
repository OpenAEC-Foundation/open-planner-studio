# Genoprettelse efter nedbrud

Mål: få dit arbejde tilbage, efter appen eller din browser er stoppet uventet, og du ikke havde gemt.

## Hvornår du har brug for det

Laptopen døde, appen frøs, eller browserfanen gik ned, og du havde endnu ikke gemt de sidste ændringer. Så snart der sker en ændring et sted, gemmer appen i baggrunden gendannelseskopier af alle dine åbne projekter, højst én gang hvert tiende sekund. Kopien er adskilt fra din projektfil. Forskellen mellem at gemme og Automatisk gem læser du i [Filer og formater](docs://uitleg-bestanden).

## Trin

1. Start appen igen. I browseren genindlæser du den samme fane: gendannelseskopien hører til netop den ene fane.
2. Hvis appen fandt kopier, vises vinduet *Gendan ikke-gemt arbejde*: *Open Planner Studio lukkede ikke normalt. Følgende dokumenter havde ikke-gemte ændringer, som kan gendannes:* For hvert projekt vises navnet, stien til filen, hvis projektet har en fil (i browseren kun filnavnet), antallet af opgaver og tidspunktet for kopien, for eksempel *21 opgaver* og *Gemt: Sep 29, 2026 9:41 AM*. Tidspunktet følger indstillingen *Tidsformat*. Vinduet kan også vise projekter, som du ikke har ændret.
3. Vælg *Gendan*. Appen åbner alle projekter i listen, hvert i sin fane, med tilstanden fra den seneste kopi. Enter gør det samme.
4. Kontroller dine projekter, og gem dem med det samme med Ctrl+S.

Vil du ikke gendanne, så har du to muligheder. *Gendan ikke* sletter kopierne, og det kan du ikke fortryde. Lukker du vinduet med Esc, med krydset eller ved at klikke ved siden af det, bliver kopierne liggende, og appen spørger igen ved næste start.

Spørgsmålstegnet øverst til højre åbner denne artikel uden at du træffer et valg. Mens du læser i hjælpen, venter vinduet. Når du går tilbage, er det der igen, og du kan stadig gendanne.

## Faldgruber, og hvad appen gør så

**Du får tilstanden fra den seneste kopi.** Det du gjorde i de sidste sekunder før nedbruddet, kan mangle. Et projekt med ændringer får igen markeringen *Ikke gemt*. Historikken for *Fortryd* er tom: du kan ikke fortryde trin fra før nedbruddet. Zoom, rulleposition og markering genskabes.

**På skrivebordet beholder et genoprettet projekt sin fil, i browseren gør det ikke.** På skrivebordet skriver *Gem* til den oprindelige fil, med den genoprettede tilstand. I browseren er et genoprettet projekt ikke længere knyttet til sin fil: *Gem* spørger, hvor filen skal gemmes. Kontakten *Automatisk gem* er også grå, indtil du har gemt projektet én gang.

**Et projekt i visningen *Datoer som registreret* bliver i den visning.** Se [Datoer som registreret](docs://uitleg-datums-zoals-opgeslagen).

**På skrivebordet vises vinduet ikke ved hver start.** Gendannelseskopierne ligger i appens datamappe, som IFC-filer med et navn, der begynder med *recovery*. Lukker du appen på den normale måde, rydder den sine egne kopier. Vinduet vises derfor efter en uventet afslutning, efter en genstart for en opdatering af appen, eller hvis du udsatte gendannelsen ved en tidligere start.

**I browseren beholdes kopien pr. fane.** Kopien ligger i browserens lager. En ny fane eller et nyt vindue tilbyder ikke kopierne af en anden fane. Kopier af faner, som ikke længere findes, ryddes efter syv dage, så snart appen skriver kopier igen.

**I browseren vises vinduet også efter en almindelig genindlæsning.** Det sker også, selv om du havde gemt alt. Har du gemt lige før genindlæsningen og ikke ændret noget bagefter, kan du trygt vælge *Gendan ikke*: din fil er opdateret.

**Vinduet vises ikke.** Så fandt appen ingen kopi. Det sker, hvis du endnu ikke havde ændret noget, hvis du bruger en ny fane i browseren, hvis du tidligere smed gendannelsen væk med *Gendan ikke*, eller hvis nedbruddet kom, før appen gemte den første kopi: det kan tage op til ca. ti sekunder efter din første ændring.

**En kopi er beskadiget.** Appen melder *Den genoprettede fil kunne ikke læses*, med årsagen, og tilbyder de andre projekter. Vælger du *Gendan*, sletter appen bagefter alle kopier, også den der ikke kan læses. Kan ingen kopi overhovedet læses, vises vinduet ikke, og kopierne bliver liggende.

**Gendannelse mislykkes.** Appen melder *Gendannelse mislykkedes* med årsagen. Kopierne bliver liggende, og spørgsmålet kommer igen ved næste start.

**Nogle projekter kan ikke indlæses.** Appen melder: *2 genoprettelsesfiler kunne ikke indlæses og blev sprunget over.* Ved én fil står der *1 genoprettelsesfil kunne ikke indlæses og blev sprunget over.* De andre projekter gendannes. Fordi noget blev sprunget over, bliver alle kopier liggende, og vinduet kommer igen ved næste start med den samme liste. Vælg så *Gendan ikke*, hvis du allerede har fået alt tilbage, som kan gendannes.

## Se også

- [Filer og formater](docs://uitleg-bestanden): gemme, Automatisk gem og genoprettelse efter nedbrud side om side.
- [Sådan slår du Automatisk gem til](docs://howto-automatisch-opslaan): lad appen opdatere din fil selv.
- [Åbn og gem en fil](docs://howto-bestand-openen-en-opslaan): at gemme efter gendannelse.
- [Datoer som registreret](docs://uitleg-datums-zoals-opgeslagen): hvad der sker med et projekt i den visning.
