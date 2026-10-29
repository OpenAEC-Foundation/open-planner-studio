# Tildel ressourcer med en kurve

Mål: sæt en ressource på en opgave, med tildelingsenheder pr. dag og en kurve, der bestemmer, hvordan tildelingsenhederne fordeles over opgavens dage.

## Hvornår har du brug for det

Så snart du vil se, hvem der arbejder hvor og hvornår: murerne på den ydre skal af hulmuren, kranen på hulldækkene. Uden tildeling er der ingen belastning, og dermed hverken histogram eller overallokering.

To begreber. **Tildelingsenhederne** (i panelet kolonnen *Tildelingsenheder*, i vinduet *Tildel* i feltet *Enh./dag*) er, hvor meget af ressourcen der arbejder på opgaven pr. arbejdsdag: 1 er én murer, 2 er to af dem, 0,5 er en halv dag. **Kurven** bestemmer, hvordan den samlede mængde, enheder gange varighed, fordeles over opgavens arbejdsdage. Arbejde er sjældent ens fra dag til dag: ved en mur er starten rolig, midten travl og slutningen igen rolig.

Den ydre skal af hulmuren tager 6 arbejdsdage. Med én murer og kurven *Jævn* er det 1 tildelingsenhed på hver af de 6 dage, 6 i alt. Med kurven *Klokkeformet* er det stadig 6 tildelingsenheder i alt, men fordelingen bliver 0, 1, 2, 2, 1 og 0.

## Trin

Du kan tildele en ressource på to måder. Ressourcen skal allerede findes (se [Administrer ressourcer](docs://howto-resources-beheren)).

### Via båndet

1. Vælg én opgave i opgavetabellen. Det skal være en almindelig opgave, ikke en milepæl og ikke en fase.
2. Vælg *Ressourcer › Tildeling › Tildel ▾*.
3. Udfyld i vinduet *Enh./dag* (standard 1), og vælg *Kurve* (standard *Jævn*). De gælder for den ressource, du vælger nu.
4. Klik på ressourcen. Vinduet lukkes, og tildelingen er der.

Til en anden ressource åbner du vinduet igen. Ressourcer, der allerede er på opgaven, mangler på listen.

### Via egenskabspanelet

1. Vælg opgaven. Panelet *Egenskaber* står til højre. Ser du det ikke, så slå det til med *Visning › Paneler › Egenskaber*.
2. I blokken *Tildelinger*, helt nederst, vælg ressourcen ved *Tildel ressource*. Tildelingen starter med tildelingsenheder på 1 og kurven *Jævn*.
3. Ændr *Tildelingsenheder* for hver tildeling. Klik på ressourcens navn for at vise *Kurve*, og vælg en anden kurve.

Sådan ændrer du også en eksisterende tildeling. Med papirkurven (*Fjern*) for enden af linjen tager du tildelingen af opgaven. Ressourcen selv bliver. Med *Flyt til…* (vises, når du klikker på navnet) flytter du tildelingen til en anden opgave.

### Kurverne

- *Jævn*: det samme hver dag. Det er standard, og det passer til arbejde, der er lige tungt hver dag.
- *Forrest belastet*: starten er tungere end slutningen. Passer til arbejde, der starter med en stor indsats, for eksempel udstikning.
- *Bagerst belastet*: slutningen er tungere end starten. Passer til arbejde, der bliver travlere hen imod afslutningen.
- *Klokkeformet*: en top i midten, med en rolig start og slutning. Passer til en mur, der starter roligt, er i fuld gang midt i forløbet og aftager.
- *Tidlig top*: en top før midten. Passer til arbejde, der hurtigt kommer op i tempo.
- *Sen top*: en top efter midten. Passer til arbejde, hvor der først sent er meget at lave.
- *Dobbelt top*: to toppe. Passer til arbejde med to travle tidspunkter.
- *Skildpadde*: en rolig start og slutning med en bred top i midten. Passer til langvarigt arbejde, der gradvist bygges op og trappes ned.

Kurven ændrer kun fordelingen. Varigheden, datoerne og den samlede mængde forbliver de samme. Du behøver ikke genberegne bagefter. Histogrammet tilpasser sig straks. Vælg *Ressourcer › Histogram › Histogram* for at se det. Vælger du en opgave, viser histogrammet kun belastningen fra den opgave.

## Faldgruber, og hvad appen gør så

**En kurve kan skubbe toppen over dine tildelingsenheder.** Med hele tal som tildelingsenheder runder appen værdien pr. dag af til hele tildelingsenheder, mens den samlede mængde forbliver den samme. En murer med 1 tildelingsenhed på den ydre skal af hulmuren og kurven *Klokkeformet* giver 0, 1, 2, 2, 1, 0. På de to midterste dage er det 2 tildelingsenheder mod *Maksimalt antal enheder* på 1. Histogrammet farver de dage røde, og ressourcen tæller som overallokeret. Vælg en anden kurve, eller fordel timerne selv (se [Justering af timefordelingen](docs://howto-urenverdeling-aanpassen)). Med tildelingsenheder som 0,5 runder appen af til hundrededele. På en kort opgave med hele enheder bliver fordelingen dermed grov: over 10 dage giver *Skildpadde* med 1 som enheder fordelingen 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, præcis det samme som *Tidlig top*.

**Ingen milepæl eller fase.** Knappen *Tildel* er så deaktiveret, og *Egenskaber* siger *Tildelinger er ikke mulige på milepæle.* eller *Tildelinger er ikke mulige på hovedopgaver.*

**En ressource kun én gang per opgave.** Er ressourcen allerede på opgaven, står den ikke længere på listen. Er alle ressourcer allerede på opgaven, siger appen *Alle ressourcer er allerede tildelt.* Er der endnu ingen ressource, siger den *Opret først ressourcer (fanen Ressourcer).*

**Tildelingsenhederne skal være større end 0.** Appen accepterer ikke en værdi på 0 eller lavere.

**Materiale.** For en materialeressource er tildelingsenhederne mængden pr. dag, i ressourcens enhed, for eksempel m³. Materiale tæller ikke med i opgavens varighed.

**En opgavetype kan justere varigheden.** Står opgaven på *Fast arbejde* eller *Faste enheder*, så ændrer en anden ressource opgavens varighed. Tidsplanen er så ikke længere opdateret. Tryk på **Beregn** (F5). Se [Opgavetyper: varighed, enheder og arbejde](docs://uitleg-werkregels).

**Tildelingen har sin egen fordeling.** Har tildelingen allerede en egen timefordeling, så er kurven deaktiveret, og den viser *Profil*. Frigiv den fordeling først via *Rediger timefordeling…*.

**Fortrydelse.** Du kan fortryde oprettelse, ændring eller fjernelse af en tildeling med *Fortryd* (Ctrl+Z).

## Se også

- [Justering af timefordelingen](docs://howto-urenverdeling-aanpassen): selv at angive timerne pr. dag.
- [Løsning af overallokering](docs://howto-overbezetting-oplossen): hvad du gør, når en ressource har for meget at lave på én dag.
- [Opgavetyper: varighed, enheder og arbejde](docs://uitleg-werkregels): hvad der sker med varigheden, når du ændrer tildelingsenhederne.
- [Ressourcepanelet](docs://ref-resourcepaneel): alle felter og knapper i ressourcepanelet.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): alle fem ressourcetyper, seks af de otte kurver og en tårnkran med et kapacitetstrin fra 30. august 2027.
