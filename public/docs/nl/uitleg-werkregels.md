# Werkregels: duur, inzet en werk

Je zet één stukadoor op het stucwerk en de taak duurt vier dagen. Zet je er een tweede stukadoor bij, dan kan het werk in twee dagen klaar zijn. Het kan ook vier dagen blijven duren, met dubbel zoveel werk erin. Beide zijn logisch. Welke van de twee de app kiest, hangt af van de **werkregel** van de taak. In dit artikel lees je hoe de app duur, inzet en werk aan elkaar koppelt en wat elke werkregel vasthoudt.

## Het begrip

Drie grootheden hangen aan elkaar:

- **Duur**: hoe lang de taak loopt, in werkdagen of in uren.
- **Inzet**: hoeveel van een resource er per werkdag aan de taak werkt. In de app heet dit *Eenh./dag*. Een inzet van 1 is één stukadoor de hele dag, 2 zijn er twee en 0,5 is een halve dag.
- **Werk**: het aantal uren dat de resource in totaal aan de taak besteedt.

De som is: werk = duur × inzet × uren per werkdag. De uren per werkdag komen uit de kalender van de taak. Het stucwerk van vier werkdagen met één stukadoor is bij een werkdag van 8 uur dus 4 × 1 × 8 = 32 uur werk.

Verander je één van de drie, dan moet minstens één van de andere twee meebewegen, anders klopt de som niet meer. Welke dat is, bepaalt de werkregel. Je stelt hem per taak in, in het paneel *Eigenschappen*. De app toont de werkregel en het werk pas als je ze zichtbaar maakt; hoe dat gaat, staat in [Werkregel kiezen](docs://howto-werkregel-kiezen).

Een werkregel werkt alleen op gewone taken. Op mijlpalen, fasen (samenvattingstaken), hangmatten en taken waarvan het *Duurtype* *Verstreken tijd* is, bestaat hij niet: daar staat het veld *Werkregel* niet. Materiaal, zoals beton of stucmortel, telt ook niet mee. De hoeveelheid materiaal stuurt de duur nooit en de app past haar bij een werkregel nooit aan.

## Hoe de app rekent

### De regel werkt op wat jij wijzigt

De app rekent duur, inzet en werk alleen door op het moment dat jij er iets aan verandert: de duur van de taak, de inzet van een toewijzing, het werk, een resource erbij of eraf, of het aantal uren per dag in een kalender. **Bereken** (F5) verandert er niets aan: F5 rekent alleen datums uit. Een regel kiezen verandert ook geen enkel getal. De regel telt pas bij je eerstvolgende wijziging.

Verandert de duur van de taak doordat een werkregel hem aanpast, dan wordt de planning verouderd. De statusbalk meldt dan *Verouderd — herbereken (F5)*, tenzij *Automatisch berekenen* aan staat.

### Vier regels

In het paneel *Eigenschappen* staat onder de keuzelijst wat de gekozen regel beschermt. De vier regels, met de tekst uit de app:

- **Vaste duur en inzet** (*Beschermd: duur en inzet (werk volgt)*). Dit is de standaard. De app verandert de duur nooit zelf en het werk volgt uit duur en inzet. Typ je zelf het werk, dan past de app de inzet aan, want de duur staat vast.
- **Vaste duur en werk** (*Beschermd: duur en werk (inzet volgt)*). De app verandert de duur nooit zelf. Wijzig je de duur, dan blijft het werk staan en past de inzet zich aan.
- **Vast werk** (*Beschermd: werk (duur volgt de inzet)*). Het werk staat vast en de duur volgt uit werk en inzet.
- **Vaste inzet** (*Beschermd: inzet (duur volgt het werk)*). De inzet staat vast en de duur volgt uit het werk.

Twee regels laten de duur dus met rust. Bij de andere twee beweegt de duur mee als je de inzet, het werk of het aantal resources wijzigt. Bij één resource doen Vast werk en Vaste inzet daarbij precies hetzelfde. Ze verschillen als je zelf de duur wijzigt: bij Vast werk blijft het werk staan en past de inzet zich aan, bij Vaste inzet blijft de inzet staan en groeit het werk mee. Ze verschillen ook als er meer resources op de taak staan (zie hieronder).

Bij de rekenvoorbeelden hieronder zie je wat elke regel doet.

### Afronding

De duur die uit de som volgt, rondt de app naar boven af. Voor een taak in dagen gebeurt dat op hele werkdagen, voor een taak in uren op hele minuten. Werk en inzet blijven wat je invoerde of wat de app uit de som haalde. Daardoor klopt de som soms niet precies meer. Het voorbeeld hieronder laat zien wat er dan gebeurt.

### Meerdere resources

Staan er meer resources op de taak, dan gelden twee afspraken. Bij Vaste duur en werk, Vast werk en Vaste inzet blijft het totale werk staan als je een resource toevoegt of weghaalt. De app verdeelt het dan naar rato van de inzet. Bij Vaste duur en inzet brengt een nieuwe resource juist zijn eigen werk mee. Bij Vast werk en Vaste inzet bepaalt de langzaamste resource de duur: per resource is dat het werk gedeeld door de inzet, en de grootste uitkomst telt.

Een voorbeeld: twee resources hebben elk 32 uur werk en inzet 1, samen 4 werkdagen. Je zet de inzet van de eerste op 0,5. De duur wordt dan 8 werkdagen. Onder Vast werk houdt de tweede resource zijn 32 uur werk en zakt zijn inzet naar 0,5. Onder Vaste inzet houdt de tweede zijn inzet van 1 en groeit zijn werk naar 64 uur.

### Voortgang

Heeft de taak al voortgang, dan werkt de regel op het resterende deel: de restduur en het resterende werk. In de app heet dat werk *Werk (rest)*. Wat al gedaan is, blijft staan.

### Uurtaken

Een taak die je in uren plant rekent hetzelfde, maar dan in minuten. Staat alleen de kraan op een taak van 5 uur, dan is dat 5 uur werk. Onder Vast werk wordt de duur bij een inzet van 2 dan 2,5 uur. Op de kanaalplaatvloer uit het oefenproject staat ook de timmerploeg. Die houdt 5 uur werk nodig, is de langzaamste en de duur blijft dus 5 uur. Hoe uren en dagen samenhangen, staat in [Dagen en uren](docs://uitleg-dagen-en-uren).

## Rekenvoorbeeld: het stucwerk

Het voorbeeld is het oefenproject *Aanbouw woning* uit de tutorials. In tutorial 5 werk je dit zelf uit en reken je het na. Hier lees je wat elke regel doet.

Het stucwerk duurt 4 werkdagen. Eén stukadoor is er aan toegewezen, met een inzet van 1, en de werkdag telt 8 uur. Het werk is dus 32 uur.

### Vaste duur en inzet

- Je maakt de duur 6 werkdagen: het werk groeit naar 48 uur, de inzet blijft 1.
- Je zet de inzet op 2: de duur blijft 4 werkdagen, het werk wordt 64 uur.
- Je typt bij *Werk (rest)* 48 uur: de duur blijft 4 werkdagen, de inzet wordt 1,5.
- Je wijst een tweede resource toe, bijvoorbeeld *Stukadoor 2*, met inzet 1: de duur blijft 4 werkdagen en die tweede brengt 32 uur werk mee, samen 64 uur.

### Vaste duur en werk

- Je maakt de duur 6 werkdagen: het werk blijft 32 uur, de inzet zakt naar 0,67.
- Je zet de inzet op 2: de duur blijft 4 werkdagen. Omdat de duur vaststaat, groeit het werk mee naar 64 uur.
- Je typt bij *Werk (rest)* 16 uur: de duur blijft 4 werkdagen, de inzet wordt 0,5.
- Je wijst een tweede resource toe, bijvoorbeeld *Stukadoor 2*, met inzet 1: de 32 uur worden verdeeld, 16 uur voor elk, en de inzet wordt voor allebei 0,5. De duur blijft 4 werkdagen.

### Vast werk

- Je maakt de duur 6 werkdagen: het werk blijft 32 uur, de inzet zakt naar 0,67.
- Je zet de inzet op 2: het werk blijft 32 uur en de duur wordt 2 werkdagen. Dit is de stap die je in tutorial 5 zet.
- Je typt bij *Werk (rest)* 48 uur: de inzet blijft 1 en de duur wordt 6 werkdagen.
- Je wijst een tweede resource toe, bijvoorbeeld *Stukadoor 2*, met inzet 1: de 32 uur worden verdeeld, 16 uur voor elk, en de duur wordt 2 werkdagen. Haal je die tweede resource weer weg, dan is de duur weer 4 werkdagen.

### Vaste inzet

- Je maakt de duur 6 werkdagen: de inzet blijft 1, het werk groeit naar 48 uur.
- Je zet de inzet op 2: het werk blijft 32 uur en de duur wordt 2 werkdagen.
- Je typt bij *Werk (rest)* 48 uur: de inzet blijft 1 en de duur wordt 6 werkdagen.
- Je wijst een tweede resource toe, bijvoorbeeld *Stukadoor 2*, met inzet 1: de 32 uur worden verdeeld, 16 uur voor elk, en de duur wordt 2 werkdagen.

### Wanneer de som niet uitkomt

Onder Vast werk zet je de inzet op 3. Het werk is 32 uur, dus de duur wordt 32 ÷ (3 × 8) = 1,33 werkdagen. De app rondt dat naar boven af op 2 werkdagen. Werk (32 uur) en inzet (3) blijven staan, maar 2 × 3 × 8 is 48 uur. Het histogram verdeelt daarom de 32 uur over de 2 werkdagen: 2 eenheden per dag, niet 3. Naast *Werk (rest)* staat een waarschuwingsteken, *Wijkt af van inzet × duur*, om dat te laten zien.

Met twee resources met verschillende inzet werkt het net zo. Zet je onder Vast werk een tweede resource, bijvoorbeeld *Stukadoor 2*, met inzet 2 bij de stukadoor met inzet 1, dan verdeelt de app de 32 uur in de verhouding 1 : 2, dus 10,7 en 21,3 uur. Beide hebben dan 1,33 werkdagen nodig. De duur wordt 2 werkdagen.

### Een andere kalender

Onder Vast werk gaat de werkdag van de kalender van 8 naar 6 uur. Het werk blijft 32 uur, dus de duur wordt 32 ÷ 6 = 5,33, afgerond 6 werkdagen. Hoe de app werkdagen en werkuren telt, staat in [Kalenders en werkdagen](docs://uitleg-kalenders). De app meldt: *De werkregel heeft na de kalenderwijziging de duur van 1 taak aangepast (werk blijft, uren per dag veranderden).*

### Een taak met voortgang

Het binnenspouwblad duurt 5 werkdagen en is voor 40% klaar: 2 werkdagen zijn gedaan en 3 werkdagen (24 uur) resteren. Onder Vast werk zet je de inzet van 1 op 2. Het restwerk blijft 24 uur en de restduur wordt 1,5, afgerond 2 werkdagen. De taak duurt nu 2 + 2 = 4 werkdagen en de voortgang is 50%. Het percentage verandert dus mee, omdat het gedane deel gelijk blijft en de rest korter wordt.

## Gevolgen en misverstanden

**"Vast werk betekent dat de duur vaststaat."** Nee, precies andersom. Bij *Vaste duur en inzet* en *Vaste duur en werk* staat de duur vast. Bij *Vast werk* en *Vaste inzet* volgt de duur uit de andere twee.

**"Als ik een regel kies, verandert mijn planning."** Nee. Het kiezen verandert geen getal. Alleen bij een volgende wijziging beslist de regel wat meebeweegt. Onder een regel die werk beschermt, legt de app op het moment van kiezen het werk vast, zodat er een getal is om te beschermen. Zo'n taak heeft dan een opgeslagen *Werk (rest)*.

**"De duur veranderde zonder dat ik hem aanraakte."** Dat kan na een wijziging van de inzet, het werk, het aantal resources of de uren per dag, onder Vast werk of Vaste inzet. Dan meldt de statusbalk dat de planning verouderd is. Druk op **Bereken** (F5) om de nieuwe datums te zien.

**Zonder toewijzing doet een werkregel niets.** Er is dan geen inzet en geen werk om te koppelen aan de duur.

**Bestanden uit MS Project of Primavera P6 tonen de werkregel altijd.** Bij een taak uit MS Project staat onder de regel soms *Uit MS Project: effort-driven* of *Uit MS Project: niet effort-driven*. Die bewaarde instelling verandert twee gevallen. Bij *Vaste duur en werk* met effort-driven verandert het werk mee als je de duur wijzigt, in plaats van de inzet. Bij *Vaste inzet* met niet effort-driven verandert het werk mee als je een resource toevoegt of weghaalt, en blijft de duur staan. Taken die je zelf in de app maakt hebben deze instelling niet.

## Zie ook

- [Werkregel kiezen](docs://howto-werkregel-kiezen): de stappen om de werkregel van een taak in te stellen.
- [Resources toewijzen met een curve](docs://howto-resource-toewijzen): een resource op een taak zetten, met inzet en verdeling.
- [Dagen en uren](docs://uitleg-dagen-en-uren): hoe de app dagen en uren omrekent.
- [Kalenders en werkdagen](docs://uitleg-kalenders): hoe de app werkdagen en werkuren telt.
