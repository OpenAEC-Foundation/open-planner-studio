# Valg af en opgavetype

Mål: stil pr. opgave ind, hvad appen justerer, når du ændrer varigheden, tildelingsenhederne eller arbejdet: selve varigheden, tildelingsenhederne eller arbejdet.

## Hvornår du har brug for dette

Du har tildelt ressourcer til en opgave, og du vil have appen til at beregne, som du selv gør. Et eksempel: kranen er lejet for én dag, og den dag ligger fast. Et andet eksempel: du ved, at der er 160 timer murerarbejde, og du vil se, hvor lang tid det tager med tre personer i stedet for to. De to situationer kræver en forskellig opgavetype.

Opgavetypen afgør, hvilken af de tre størrelser varighed, tildelingsenheder og arbejde der flytter sig, når du ændrer en anden. Baggrunden og de gennemregnede eksempler står i [Opgavetyper: varighed, tildelingsenheder og arbejde](docs://uitleg-werkregels).

## Trin

### Vis opgavetypen

Appen viser ikke opgavetypen som standard. Slå indstillingen til én gang:

1. Vælg *Indstillinger › Projekt › App-indstillinger*, fanen *Tidsplan*.
2. Under overskriften *Beregning* sætter du flueben ved *Brug opgavetyper*.
3. Luk vinduet med *Luk*.

Dette er en indstilling i appen, ikke i projektfilen. Hvis en fil allerede indeholder opgavetyper eller gemt arbejde, fx en fil fra MS Project eller Primavera P6, viser appen opgavetypen for den fil, også uden denne indstilling. Det samme gælder, så snart du selv vælger en opgavetype i en fil. Opgavetypen forbliver så synlig for den fil, også selv om du slår indstillingen fra igen. Den forbliver synlig, så længe filen er åben. Og efter genåbning, så længe filen indeholder en opgavetype eller gemt arbejde.

### Sæt opgavetypen for en opgave

1. Vælg opgaven. Panelet *Egenskaber* står til højre. Ser du det ikke, slår du det til med *Visning › Paneler › Egenskaber*.
2. Ved *Opgavetype* vælger du en af de fem muligheder: *Projektstandard (Fast varighed og faste enheder)*, *Fast varighed og faste enheder*, *Fast varighed og fast arbejde*, *Fast arbejde* eller *Faste enheder*. Med *Projektstandard* følger opgaven projektets standard.
3. Vil du vide, hvad en mulighed gør? I den åbne liste har hver mulighed et i-ikon. Peg på det, klik eller tryk på det for at se forklaringen. Et klik på i-ikonet vælger ikke opgavetypen endnu.
4. Ved siden af det lukkede felt er der også et i-ikon. Det forklarer den opgavetype, der gælder nu, fx *Varigheden følger af arbejdet og tildelingsenhederne.* Med *Projektstandard* er det opgavetypen i parentesen.

*Projektstandard* er den første mulighed, og det er det, en opgave har som standard. Opgavetypen i parentesen er den, som projektet har som standard nu. Appen har ingen knap til at ændre projektstandarden. Den kommer fra en import (fx fra MS Project eller Primavera P6) eller fra MCP-forbindelsen. Vil du have en anden opgavetype for én opgave, vælger du den her.

Du kan også vælge opgavetypen i tabellen. Klik på **+** til højre i kolonneoverskriften i opgavetabellen (*Tilføj kolonne*), og vælg kolonnen *Opgavetype* under *Tidsplan*.

En opgave uden tildeling har intet at binde sammen, så opgavetypen gør der ikke noget. Tildel først en ressource (se [Tildeling af ressourcer med en kurve](docs://howto-resource-toewijzen)).

### Se og ændr arbejdet

For en opgave med tildelinger vises en kolonne *Arbejde (t)* i blokken *Tildelinger* i panelet *Egenskaber*, ved siden af *Tildelingsenheder*. Det er det resterende arbejde for den ressource, i timer. En lille hængelås over en kolonne viser, hvad opgavetypen holder fast. Ved *Fast varighed og faste enheder* og ved *Faste enheder* er det *Tildelingsenheder*. Ved *Fast varighed og fast arbejde* og ved *Fast arbejde* er det *Arbejde (t)*.

Vil du selv ændre arbejdet, skriver du timerne i feltet og trykker på Enter. Appen accepterer ikke en værdi på 0 eller mindre. Feltet springer tilbage til den forrige værdi.

### Se hvad der sker

Når du vælger en opgavetype, ændres endnu ingen tal. Under en opgavetype, der beskytter arbejde, låser appen kun det aktuelle arbejde, så *Arbejde (t)* får en gemt værdi. Først ved den næste ændring bestemmer opgavetypen, hvad der flytter sig. Ændr fx *Tildelingsenheder*, og se, hvad der sker med varigheden og arbejdet.

Hvis det ændrer opgavens varighed, viser statuslinjen *Forældet — genberegn (F5)*. Tryk på **Beregn** (F5), fx via *Start › Tidsplan › Beregn*, for at se de nye datoer. Er *Beregn automatisk* slået til (samme fane *Tidsplan*, overskriften *Beregning*), så gør appen det selv.

## Hvilken opgavetype passer

- **Fast varighed og faste enheder** passer, når varigheden er en aftale, og tildelingsenhederne er dit eget valg. Arbejdet følger af de to. Det er standardvalget. Kranen, der er lejet for én dag, hører hertil: dagen ligger fast, og du bestemmer, hvor mange kraner der er på den.
- **Fast varighed og fast arbejde** passer, når opgaven skal være færdig inden for en fast tidsramme, og du kender mængden af arbejde i den. Ændrer varigheden sig, justerer appen tildelingsenhederne.
- **Fast arbejde** passer, når du kender antallet af timer arbejde i opgaven, og du vil se, hvordan varigheden ændrer sig med antallet af personer. De 160 timer murerarbejde med tre personer i stedet for to hører hertil. Pudsearbejdet i øvelsesprojektet får denne opgavetype.
- **Faste enheder** passer, når tildelingsenhederne ligger fast, fx én kran, og arbejdet bestemmer varigheden.

## Faldgruber, og hvad appen gør så

**Feltet *Opgavetype* mangler.** Så er indstillingen *Brug opgavetyper* slået fra, og filen har endnu ingen opgavetyper. Eller du har valgt en milepæl, en fase, en hængekøje eller en opgave med varighedstypen *Forløbet varighed*. Der er ingen opgavetype for dem. Vælg en almindelig opgave.

**Varigheden ændres, selv om du ikke ændrer den.** Under *Fast arbejde* og *Faste enheder* følger varigheden af tildelingsenheder og arbejde. Ændrer du en af dem eller antallet af ressourcer, justerer appen varigheden og runder op til hele arbejdsdage. For en opgave i timer runder appen op til hele minutter.

**Arbejdet stemmer ikke præcist med tildelingsenheder × varighed.** Afrunding kan give det. I feltet *Arbejde (t)* vises så et advarselstegn med teksten *Afviger fra tildelingsenheder × varighed*. Histogrammet følger det gemte arbejde.

**Materiale tæller ikke med.** For en materialeressource viser *Arbejde (t)* en streg. Materiale bestemmer aldrig varigheden.

**En opgave med fremdrift.** Opgavetypen virker på den resterende del. Så viser *Arbejde (t)* kun det, der stadig skal ske.

**Fortrydelse.** Valg af en opgavetype og hver ændring, som opgavetypen beregner, er ét trin for *Fortryd* (Ctrl+Z). Den valgte opgavetype er så væk igen, men feltet *Opgavetype* forbliver vist.

## Se også

- [Opgavetyper: varighed, tildelingsenheder og arbejde](docs://uitleg-werkregels): hvordan appen binder varighed, tildelingsenheder og arbejde sammen, med gennemregnede eksempler.
- [Tildeling af ressourcer med en kurve](docs://howto-resource-toewijzen): at sætte en ressource på en opgave.
