# Dagen en uren

Een taak van 2 dagen en een taak van 16 uur lijken hetzelfde, maar de app rekent er verschillend mee. Waarom kun je kiezen tussen dagen en uren? En wat gebeurt er als een taak in uren aan een taak in dagen hangt? In dit artikel lees je hoe de app dagen en uren telt, en waar hij afrondt. Het uitgewerkte voorbeeld laat de getallen zien.

## Het begrip

Een **dagtaak** heeft een duur in hele werkdagen, bijvoorbeeld `5d`. Hij bezet volle werkdagen. Op de standaardkalender heeft hij een start- en einddatum zonder tijd.

Een **urentaak** heeft een duur in werkuren, bijvoorbeeld `12h` of `1h 30m`. Hij heeft een start en een einde met een kloktijd, bijvoorbeeld dinsdag 11:00.

De eenheid hoort bij de taak, niet bij het project. Je kunt dagtaken en urentaken in één planning mengen. Dat heet **gemengde planning**.

Uren gebruik je voor werk dat niet in hele dagen past: een kraan die je twaalf uur huurt, een stort van zes uur, een taak die pas na de lunch kan beginnen. Voor al het andere zijn dagen genoeg en overzichtelijker.

**Urenplanning** staat standaard uit. Zolang dat zo is, werkt de app in dagen. Bevat een bestand toch urenplanning, zoals taken in uren, dan meldt de app *Dit bestand bevat urenplanning.* Die taken worden nog steeds doorgerekend, maar hun duur kun je pas bewerken als je urenplanning aanzet.

## Hoe de app rekent

### Werktijden en netto-uren

Elke kalender heeft per werkdag **werktijdblokken** (in de app *banden* genoemd). De standaardkalender heeft 07:00 tot 12:00 en 13:00 tot 16:00. Het gat is de pauze. Die blokken leidt de app af uit *Begin (uur)*, *Einde (uur)* en de pauze van de kalender; je hoeft er niets voor in te stellen. Stel je per weekdag eigen blokken in, dan zijn die leidend.

De **netto-uren per dag** zijn de som van de blokken van een werkdag. Verschilt de lengte van de werkdagen, dan geldt de meest voorkomende dagsom, en bij gelijkspel de hoogste. Bij een week van vier dagen van 8 uur en een vrijdag van 5 uur zijn de netto-uren per dag dus 8.

### Een taak in uren

De app telt werkminuten vanaf de start, door de werktijdblokken heen. Pauzes, avonden, weekenden en feestdagen tellen niet mee. Een taak van 12 uur past dus niet in één werkdag van 8 uur: hij loopt door in de volgende dag.

### Een taak in dagen

De app telt hele werkdagen. De uren per dag doen daarbij niet mee. Een taak van 5 dagen eindigt op dezelfde dag, of de kalender nu 6 of 8 uur per dag heeft.

### Dagen en uren omrekenen

Een dag is de netto-uren per dag van de kalender van de taak. De app gebruikt dat op drie plekken:

- Bij *Duurweergave*. Onder *Instellingen › Project › Instellingen*, tabblad *Weergave*, kies je *Automatisch (eigen eenheid per taak)*, *Altijd dagen* of *Altijd uren*. Een taak van 18 uur toont bij *Altijd dagen* als `2,25d(18h)`: de eigen eenheid blijft tussen haakjes staan.
- Bij een lag in uren tussen dagtaken (zie *Afronden*).
- Als je de eenheid van een taak wisselt. De app telt dan de dagen vanaf de start van de taak, elke dag met zijn eigen uren, en doet alleen een voorstel als de uitkomst exact klopt. Twee dagen worden `16h`. Op een kalender waar de vrijdag 5 uur heeft, worden 5 dagen vanaf maandag `37h`. Twaalf uur kan op een kalender met dagen van 8 uur niet in hele dagen: de app houdt de eenheid dan zoals hij is.

### Dagtaken en urentaken door elkaar

De regels hieronder gelden voor een relatie Eind-Start op een kalender zonder eigen werktijdblokken, zoals de standaardkalender.

- **Uur → uur.** De opvolger begint op het moment dat de voorganger klaar is, ook als dat midden op een dag is.
- **Uur → dag.** Een dagtaak begint nooit midden op een dag. Hij begint op de eerste werkdag ná de dag waarop de urentaak eindigt. De rest van die dag blijft ongebruikt en komt terug als speling van de urentaak.
- **Dag → uur.** Een dagtaak bezet zijn hele laatste dag. De urentaak begint op de eerste werkdag daarna, aan het begin van het eerste werkblok.

### Afronden

De app rondt af, of wijst af, op vier plekken:

- **Een dagtaak na een urentaak** begint op de eerstvolgende werkdag. De urentaak wordt zo als het ware naar boven afgerond op hele dagen.
- **Een lag in uren tussen dagtaken** rekent de app om naar werkdagen: de lag gedeeld door de netto-uren per dag, afgerond op een heel getal. Een halve dag gaat omhoog. Bij 8 uur per dag telt 1 uur lag als 0 dagen, 4 uur als 1 dag en 12 uur als 2 dagen. Een lag in uren tussen urentaken telt exact in werkuren, en de pauze telt dan niet mee.
- **Een duur in dagen** is altijd een geheel getal. Typ je `1.5d`, dan meldt de app *Voer een geheel aantal dagen of uren in, bijvoorbeeld 2d of 12h.* Een duur in uren mag wel `1.5h` zijn, of `1h 30m`.
- **Een eenheidswissel** gebeurt alleen als de uitkomst exact klopt (zie hierboven).

## Rekenvoorbeeld: de kraan

De kalender is maandag tot en met vrijdag van 07:00 tot 12:00 en van 13:00 tot 16:00: 8 netto-uren per dag. Het project begint op maandag 7 juni 2027.

### Uur, uur en dag

*Kraan plaatsen* duurt 12 uur. Maandag telt 8 werkuren (5 tot 12:00 en 3 na de pauze) en dinsdag de laatste 4 uur. De taak loopt van maandag 07:00 tot **dinsdag 8 juni 11:00**.

*Stelwerk* duurt 8 uur en volgt met een relatie Eind-Start. Het begint meteen op dinsdag 11:00: dat is 1 uur tot de pauze en 3 uur erna. De laatste 4 uur zijn woensdag van 07:00 tot 11:00. Het einde is **woensdag 9 juni 11:00**.

*Afwerken* duurt 2 dagen en volgt op *Stelwerk*. Een dagtaak begint niet midden op een dag, dus hij begint op **donderdag 10 juni** en eindigt op vrijdag 11 juni.

### Afronden bij de overgang

Laat je *Stelwerk* weg en hang je *Afwerken* direct aan *Kraan plaatsen*, dan begint *Afwerken* op woensdag 9 juni en eindigt hij op donderdag 10 juni. De rest van dinsdag (4 werkuren) is niet te gebruiken. Die 4 uur zie je terug als totale speling van *Kraan plaatsen*: een halve werkdag.

Draai je de volgorde om, dan is het eenvoudiger. *Storten fundering* duurt 2 dagen, van maandag 7 tot en met dinsdag 8 juni. *Kraan plaatsen* duurt nu 4 uur en volgt. Hij begint op **woensdag 9 juni om 07:00** en eindigt om 11:00.

### Een lag in uren

Tussen *Kraan plaatsen* (12 uur) en *Stelwerk* (8 uur) zet je een lag van 2 uur. *Stelwerk* begint dan niet om 11:00 maar op dinsdag om **14:00**: 1 uur tot de pauze, en 1 uur erna. Het einde schuift mee naar **woensdag 9 juni 14:00**.

Tussen twee dagtaken werkt een lag anders. *Storten fundering* eindigt op dinsdag 8 juni. Zonder lag begint *Afwerken* op woensdag 9 juni. Met een lag van 4 uur is dat een halve dag, en dat rondt de app omhoog: *Afwerken* begint op **donderdag 10 juni**. Met een lag van 1 uur rondt de app naar beneden af, en *Afwerken* begint gewoon op woensdag.

### Een vrijdagmiddag vrij

Nu heeft de vrijdag maar één blok, van 07:00 tot 12:00: 5 uur. De andere dagen blijven 8 uur. De netto-uren per dag blijven 8, want dat is de meest voorkomende dagsom. Een week heeft nu 37 werkuren.

Een taak van 40 uur vanaf maandag 7 juni 07:00 gebruikt maandag tot en met donderdag (32 uur) en de vrijdag (5 uur). De laatste 3 uur vallen op de maandag erna, van 07:00 tot 10:00. Het einde is **maandag 14 juni 10:00**. Een taak van 5 dagen zou vanaf maandag 37 uur bezetten, en dat stelt de app voor als je de eenheid van 5 dagen naar uren wisselt.

## Gevolgen en misverstanden

**"8 uur is 1 dag."** Alleen als de kalender dagen van 8 uur heeft. Op de kalender met de vrije vrijdagmiddag is 5 dagen 37 uur, geen 40.

**"Als ik meer uren per dag instel, is mijn dagtaak sneller klaar."** Nee. Een dagtaak telt hele werkdagen. De uren per dag veranderen alleen wat een dag in uren waard is, bijvoorbeeld bij de weergave en bij een lag in uren. Alleen bij een taak met resources en de werkregel *Vast werk* of *Vaste inzet* verandert de duur mee, omdat het werk gelijk blijft: 40 uur werk is 5 dagen bij 8 uur per dag en 7 dagen bij 6 uur per dag.

**"Een urentaak van 8 uur duurt één dag."** Alleen als hij aan het begin van de dag start. Begint hij later, zoals *Stelwerk* op dinsdag 11:00, dan loopt hij door in de volgende dag.

**Een kalender met eigen werktijdblokken** gedraagt zich anders dan de standaardkalender. Zo'n kalender krijg je door per weekdag werktijden in te stellen of een ploegenpreset te kiezen (*2 ploegen*, *3 ploegen*, *Nachtploeg* of *24/7*). Op zo'n kalender telt een lag in uren tussen dagtaken exact, en begint een dagtaak direct na het einde van een urentaak: in het voorbeeld dinsdag 8 juni om 11:00.

**Urenplanning uitzetten** verwijdert niets. Taken in uren blijven bestaan en rekenen mee, maar je kunt ze niet bewerken tot je urenplanning weer aanzet.

## Zie ook

- [Urenplanning aanzetten](docs://howto-urenplanning-aanzetten): de stappen om een taak in uren te plannen.
- [Werktijden instellen](docs://howto-werktijden-instellen): de werktijdblokken van een kalender aanpassen.
- [Kalenders en werkdagen](docs://uitleg-kalenders): hoe de app werkdagen telt en welke kalender wint.
- [Relaties leggen](docs://howto-relaties-leggen): de stappen om een relatie of lag te leggen.
