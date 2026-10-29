# Løsning af overallokering

Mål: find ud af, hvor en ressource har for meget at lave på en dag, og løs det. Det sker normalt med udjævning af opgaver.

## Hvornår du har brug for dette

På papiret virker din tidsplan, men murerne arbejder på to vægge, som begge ligger på de samme dage. Appen kalder det **overallokering**. En ressource er overallokeret på en arbejdsdag, hvis tidsplanen kræver mere af den den dag, end dens kapacitet (*Maksimalt antal enheder*) tillader. Det gælder også, hvis den ikke arbejder den dag ifølge sin kalender.

Først finder du overallokeringen. Derefter vælger du en løsning. **Udjævning** er den løsning, appen beregner for dig: den får opgaver til at starte senere, indtil ressourcen kan klare det. Hvordan den beregner det, læser du i [Ressourceudjævning](docs://uitleg-nivelleren).

## Trin

### 1. Find overallokeringen

1. Kig i båndet under *Ressourcer › Overallokering*. Der står *Ingen*, eller med rødt antallet af overallokerede ressourcer, for eksempel *1 ressource*. Efter en beregning står der også i statuslinjen *⚠ 1 ressource(r) overallokeret*.
2. Klik på meddelelsen i statuslinjen. Panelet *Advarsler* åbner sig til højre, med en linje for hver ressource, for eksempel *Bricklayer* med *Overallokeret på 5 dag(e) (29-06-2027 – 05-07-2027)*.
3. Klik på linjen. Appen slår histogrammet til, vælger ressourcen og markerer alle opgaver, som ressourcen er tildelt.
4. Kig på histogrammet under Gantt. Røde søjler er overallokerede dage. Hvis du fører musen hen over en dag, ser du, hvilke opgaver der bidrager, for eksempel *2 opgaver bidrager på 2027-06-30* med navnene nedenunder.

Du kan også selv slå histogrammet til med *Ressourcer › Histogram › Histogram*. Vælg en ressource i listen til venstre, eller gå gennem ressourcerne med *Forrige* og *Næste*. En rød prik i listen betyder, at ressourcen er overallokeret. Rækken *Alle ressourcer* lægger ressourcerne sammen, uden materiale.

Er en opgave markeret, viser histogrammet kun belastningen fra den opgave og kun de ressourcer, der er på den. Tryk på Esc for at fjerne markeringen og se hele projektet igen.

### 2. Vælg en løsning

- **Mere kapacitet.** Hvis der virkelig kommer en anden murer, så sæt *Maksimalt antal enheder* til 2 (se [Administration af ressourcer](docs://howto-resources-beheren)). Overallokeringen er så væk.
- **Færre tildelingsenheder pr. dag.** Sæt *Tildelingsenheder* lavere, eller vælg en anden kurve for tildelingen (se [Tildeling af ressourcer med en kurve](docs://howto-resource-toewijzen)).
- **Sæt opgaverne efter hinanden.** Tilføj en afhængighed mellem de to opgaver, så den anden først starter, når den første er færdig (se [Tilføj afhængigheder](docs://howto-relaties-leggen)).
- **Udjævning.** Appen får en opgave til at starte senere.

### 3. Udjævning

1. Kontrollér, at tidsplanen er beregnet med **Beregn** (F5), for eksempel via *Start › Tidsplan › Beregn*.
2. Vælg *Ressourcer › Udjævning › Udjævn…*. Vinduet *Udjævn ressourcer* åbner.
3. Bestem, om projektets slutdato må flyttes. Hvis du lader feltet *Kun udjævning inden for slæk — projektets slutdato forbliver fast* være fra, må slutdatoen flyttes. Slår du det til, flytter appen kun opgaver inden for deres slæk.
4. Under *Ressourcer* står de ressourcer, der udjævnes. Som standard er alle ressourcer afkrydset, undtagen materiale. Fjern afkrydsningen ved en ressource, du vil lade være i fred.
5. Klik på *Beregn*. Mens den beregner, står der *Beregner…*, og du kan stoppe med *Stop*. Tidsplanen ændrer sig endnu ikke: dette er et forslag.
6. Læs forslaget. Øverst står slutdatoen, for eksempel *Projektets slutdato: uændret (30-08-2027)* eller *Projektets slutdato: 25-08-2027 → 30-08-2027*. Nedenunder står en tabel. Den viser for hver opgave *Gammel start*, *Ny start* og *Dage forskudt*, for eksempel *Build outer cavity leaf*, 29-06-2027, 06-07-2027 og *5 d*.
7. Vælg *Anvend*. Appen skriver forskydningerne til opgaverne og genberegner tidsplanen med det samme. Du behøver ikke trykke på F5. *Annuller* lukker vinduet uden ændringer.
8. Kontrollér *Ressourcer › Overallokering*. Der står nu *Ingen*.

Ændrer du en indstilling i vinduet, efter du har klikket på *Beregn*, forsvinder forslaget. Klik så på *Beregn* igen. Ændrer tidsplanen sig, mens appen beregner, står der *Tidsplanen blev ændret under beregningen. Klik på Beregn igen.*

### Bestem hvilken opgave der bliver stående

Appen placerer opgaverne én for én, og de opgaver, der kommer først, bliver, hvor de er. Opgaver med højeste prioritet går først. Har opgaverne samme prioritet, går opgaven med mindst slæk først.

Vil du selv bestemme, hvilken opgave der bliver stående, så giv den en højere prioritet. Højreklik på opgavens bjælke i Gantt, og vælg *Prioritet* og derefter *Lav* (100), *Normal* (500) eller *Høj* (900). *Normal* er standard. Du kan også selv skrive et tal fra 0 til 1000 i kolonnen *Udjævningsprioritet*. Klik på **+** til højre i overskriften på opgavetabellen (*Tilføj kolonne*), og vælg den kolonne under *Tidsplan*. Et højere tal betyder, at opgaven mere sandsynligt bliver stående. Appen accepterer ikke et tal over 1000. En opgave med prioritet 1000 flyttes aldrig for kapacitet.

### Fortryd og gentag

- *Fortryd* (Ctrl+Z) fortryder *Anvend* i ét trin.
- *Ressourcer › Udjævning › Ryd udjævning* fjerner al udjævning fra opgaverne. Knappen er grå, så længe der ikke er udjævning. Overallokering, som du dermed får tilbage, er der bare igen.
- Har du ændret tidsplanen siden, så vælg bare *Udjævn…* igen. Appen starter så forfra: de gamle forskydninger tæller ikke med.

## Faldgruber, og hvad appen gør så

**Ikke beregnet endnu.** Er tidsplanen ikke beregnet, står der i vinduet *Beregn tidsplanen (F5) før udjævning.* Og *Beregn* er ikke tilgængelig.

**Resterende konflikter.** Ikke alle overallokeringer kan løses ved at forskyde. De opgaver, der er tilbage, står under *Resterende konflikter*, med antal dage og årsagen:

- *For lidt ledig kapacitet inden for slækken til at løse denne konflikt.* Du ser det, når *Kun udjævning inden for slæk — projektets slutdato forbliver fast* er slået til: inden for opgavens slæk er der intet ledigt tidspunkt. Fjern afkrydsningen i feltet, så må slutdatoen flyttes.
- *Ressourcen arbejder ikke på alle de dage, opgaven kræver — forskydning løser ikke dette.* Ressourcen har fridage i sin egen kalender midt i opgaven. Ændr kalenderen eller opgaven.
- *Bricklayer kræver 2 tildelingsenheder pr. dag på toppen, kapaciteten er 1 — kan ikke løses ved at forskyde.* Gennem sin kurve kræver opgaven alene mere på én dag, end ressourcen kan levere. Vælg en anden kurve, eller sæt tildelingsenhederne lavere.

**Der står** *Ingen opgaver skal forskydes — tidsplanen er allerede konfliktfri.* Står den linje sammen med listen *Resterende konflikter* i forslaget, så tro på listen. Linjen siger kun, at der intet er at forskyde. Står linjen uden en liste, mens *Ressourcer › Overallokering* stadig viser en ressource, så er alle opgaver, der kolliderer, fastlåst på prioritet 1000, eller også er de allerede startet. De flyttes ikke, og vinduet melder dem ikke som konflikt. Kig derfor altid på *Overallokering* efter *Anvend*.

**Opgaver, der ikke forskydes.** En opgave, der allerede er startet eller er færdig, forskydes aldrig. Dens belastning tæller stadig med. Milepæle og faser forskydes heller ikke.

**Materiale udjævnes ikke.** Kræver en materialeressource på en dag mere end sit *Maksimalt antal enheder*, tæller den som overallokeret i *Overallokering*. Men den står ikke i udjævningsvinduet.

**Udjævning tilpasser sig ikke.** Forskydningerne bliver, som de blev beregnet. Ændrer du senere en opgaves varighed, bliver en udjævnet opgave, hvor den er. Det gælder også, hvis den placering ikke længere er nødvendig. Udjævn så igen.

**Overallokeret på grund af kalenderen.** Arbejder ressourcen ikke på en dag ifølge sin kalender, står der i panelet *Advarsler*, for eksempel *Overallokeret på 5 dag(e) (29-06-2027 – 05-07-2027), heraf 1 dag(e), hvor ressourcen ikke arbejder ifølge sin kalender*. Går en opgave altid hen over en sådan dag, hvilket er den anden årsag ovenfor, løser udjævning det ikke.

## Se også

- [Ressourceudjævning](docs://uitleg-nivelleren): hvad udjævning forskyder, inden for slæk og ud over den, og hvad den ikke gør.
- [Administration af ressourcer](docs://howto-resources-beheren): justering af en ressources kapacitet og kalender.
- [Tilføj afhængigheder](docs://howto-relaties-leggen): at sætte opgaver efter hinanden.
- [Meddelelser og advarsler](docs://ref-meldingen): advarslen Overallokeret i panelet *Advarsler*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): stukkatørerne er overallokeret på 5 dage. Med *Kun udjævning inden for slæk — projektets slutdato forbliver fast* slået til, forbliver slutdatoen på 17. august 2027, og der er en resterende konflikt tilbage. Med feltet fra (standard) er alt løst, og slutdatoen flyttes til 24. august 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tårnkranen er overallokeret på 65 dage, og stukkatørerne på 15 dage. Udjævning med *Kun udjævning inden for slæk — projektets slutdato forbliver fast* fra flytter slutdatoen fra 9. maj til 12. oktober 2028.
