# Dagen en uren

Een taak van 2 dagen en een taak van 16 uur lijken hetzelfde, maar de app rekent er verschillend mee. Waarom kun je kiezen tussen dagen en uren? En wat gebeurt er als een taak in uren aan een taak in dagen hangt? In dit artikel lees je hoe de app dagen en uren telt. De app rondt daarbij niet af: hij rekent op de minuut. Het uitgewerkte voorbeeld laat de getallen zien.

## Het begrip

Een **dagtaak** heeft de **dagenmaat**: zijn duur telt in werkdagen, bijvoorbeeld `5d` of `1,5d`. Elke werkdag telt als 1, hoe lang die dag ook is. Een deel van een dag telt naar de werktijd van die dag: halverwege de werktijd is een halve dag. Een dagtaak kan ook midden op een dag beginnen, bijvoorbeeld direct na een urentaak.

Een **urentaak** heeft de **urenmaat**: een duur in werkuren, bijvoorbeeld `12u` of `1u 30m`. Hij heeft een start en een einde met een kloktijd, bijvoorbeeld dinsdag 11:00.

De eenheid hoort bij de taak, niet bij het project. Je kunt dagtaken en urentaken in één planning mengen. Dat heet **gemengde planning**.

Uren gebruik je voor werk dat niet in hele dagen past: een kraan die je twaalf uur huurt, een stort van zes uur, een taak die pas na de lunch kan beginnen. Voor al het andere zijn dagen genoeg en overzichtelijker.

De duur in uren is altijd te bewerken. Kies de maat bij de taak; de kalender bepaalt de werktijden.

De regels in dit artikel gelden voor het rekenprofiel *Open Planner Studio*, de standaard. Onder het profiel *Primavera P6* en *Microsoft Project* telt een dagtaak in de urenmaat: een dag is dan de standaard werkdag in uren. Het voorbeeld met de vrije vrijdagmiddag laat het verschil zien.

## Hoe de app rekent

### Werktijden en de standaard werkdag

Elke kalender heeft per werkdag **werktijdblokken** (in de app *banden* genoemd). De standaardkalender heeft 07:00 tot 12:00 en 13:00 tot 16:00. Het gat is de pauze. Die blokken leidt de app af uit *Begin (uur)*, *Einde (uur)* en de pauze van de kalender; je hoeft er niets voor in te stellen. Stel je per weekdag eigen blokken in, dan zijn die leidend.

De **standaard werkdag** is de werkdag die het vaakst voorkomt; zijn lengte is de som van zijn blokken. Het is dus geen gemiddelde: met maandag 16 uur en dinsdag tot en met vrijdag 10 uur is de standaard werkdag 10 uur. Verschilt de lengte van de werkdagen, dan geldt de meest voorkomende dagsom, en bij gelijkspel de hoogste. Bij een week van vier dagen van 8 uur en een vrijdag van 5 uur is de standaard werkdag dus 8 uur. Ook een kalender met eigen uren per dag (bijvoorbeeld uit Primavera P6) rekent met deze dagsom, en het kalendervenster toont hem. De eigen waarde blijft bewaard voor de export. Wijkt hij af, dan toont het kalendervenster een oranje blok onder *Standaard werkdag*. Een taak van 1870 uur op blokken van 10 uur duurt dus 187 dagen, ook als de eigen waarde 8 uur per dag is.

### Een taak in uren

De app telt werkminuten vanaf de start, door de werktijdblokken heen. Pauzes, avonden, weekenden en feestdagen tellen niet mee. Een taak van 12 uur past dus niet in één werkdag van 8 uur: hij loopt door in de volgende dag.

### Een taak in dagen

De app telt werkdagen in de dagenmaat. Hoeveel uur een dag heeft, doet daarbij niet mee. Een taak van 5 dagen eindigt op dezelfde dag, of de kalender nu 6 of 8 uur per dag heeft. Een deel van een dag mag: een taak van `1,5d` vanaf maandag 07:00 eindigt dinsdag om 11:00, halverwege de werktijd van dinsdag.

### Dagen en uren omrekenen

Een dag is de standaard werkdag van de kalender van de taak. De app gebruikt dat op twee plekken:

- Bij *Duurweergave*. Onder *Instellingen › Project › App-instellingen*, tabblad *Weergave*, kies je *Automatisch (eigen eenheid per taak)*, *Altijd dagen* of *Altijd uren*. Een taak van 18 uur toont bij *Altijd dagen* als `2,25d(18u)`: de eigen eenheid blijft tussen haakjes staan.
- Onder het profiel *Primavera P6* en *Microsoft Project*. Daar is `5d` op een kalender met dagen van 8 uur hetzelfde als `40u`.

Wissel je de eenheid van een taak, dan houdt de app het einde vast. In het profiel *Open Planner Studio* telt hij de dagen vanaf de start van de taak, elke dag met zijn eigen uren. Twee dagen worden `16u`, en twaalf uur wordt `1,5d`. Op een kalender waar de vrijdag 5 uur heeft, worden 5 dagen vanaf maandag `37u`. Lukt de omzetting niet precies, dan houdt de app de eenheid zoals hij is.

### Dagtaken en urentaken door elkaar

Bij een relatie Eind-Start begint de opvolger op het moment dat de voorganger klaar is, ook als dat midden op een dag is. Dat geldt voor elke combinatie van dagtaken en urentaken:

- **Uur → uur.** Eindigt de voorganger dinsdag om 11:00, dan begint de opvolger dinsdag om 11:00.
- **Uur → dag.** Ook een dagtaak begint dan dinsdag om 11:00. Er blijft geen ongebruikte rest van de dag over.
- **Dag → uur.** Een dagtaak die op een hele dag eindigt, is klaar aan het einde van de werktijd, bijvoorbeeld dinsdag 16:00. De urentaak begint op het volgende werkmoment: woensdag 07:00.

### Op de minuut

De app rondt niet af:

- **Een duur in dagen** mag een breuk zijn. Typ je `1.5d` of `1,5d`, dan wordt het anderhalve werkdag. Een duur in uren mag `1.5u` zijn, of `1u 30m`.
- **Een lag in uren** telt exact in werkuren van de lag-kalender, standaard die van de voorganger. Dat geldt ook na een dagtaak. Pauzes, avonden en weekenden tellen niet mee.
- **Een lag in dagen** mag een breuk zijn: `1,5` is anderhalve werkdag.
- **Een lag als percentage** is een exact deel van de duur van de voorganger: 50 % van 5 dagen is 2,5 dag.

## Rekenvoorbeeld: de kraan

De kalender is maandag tot en met vrijdag van 07:00 tot 12:00 en van 13:00 tot 16:00: een standaard werkdag van 8 uur. Het project begint op maandag 7 juni 2027 en rekent met het profiel *Open Planner Studio*. *Kraan plaatsen* en *Stelwerk* hebben de urenmaat, *Afwerken* en *Storten fundering* de dagenmaat.

### Uur, uur en dag

*Kraan plaatsen* duurt 12 uur. Maandag telt 8 werkuren (5 tot 12:00 en 3 na de pauze) en dinsdag de laatste 4 uur. De taak loopt van maandag 07:00 tot **dinsdag 8 juni 11:00**.

*Stelwerk* duurt 8 uur en volgt met een relatie Eind-Start. Het begint meteen op dinsdag 11:00: dat is 1 uur tot de pauze en 3 uur erna. De laatste 4 uur zijn woensdag van 07:00 tot 11:00. Het einde is **woensdag 9 juni 11:00**.

*Afwerken* duurt 2 dagen en volgt op *Stelwerk*. Hij begint meteen, op **woensdag 9 juni 11:00**. De tweede werkdag loopt tot vrijdag 11:00, dus het einde is **vrijdag 11 juni 11:00**.

### De overgang van uren naar dagen

Laat je *Stelwerk* weg en hang je *Afwerken* direct aan *Kraan plaatsen*, dan begint *Afwerken* op dinsdag 8 juni om 11:00 en eindigt hij op donderdag 10 juni om 11:00. *Kraan plaatsen* houdt geen speling: er blijft niets van dinsdag ongebruikt.

Draai je de volgorde om, dan eindigt de dagtaak aan het einde van een werkdag. *Storten fundering* duurt 2 dagen, van maandag 7 juni 07:00 tot dinsdag 8 juni 16:00. *Kraan plaatsen* duurt nu 4 uur en volgt. Hij begint op **woensdag 9 juni om 07:00** en eindigt om 11:00.

### Een lag in uren

Tussen *Kraan plaatsen* (12 uur) en *Stelwerk* (8 uur) zet je een lag van 2 uur. *Stelwerk* begint dan niet om 11:00 maar op dinsdag om **14:00**: 1 uur tot de pauze, en 1 uur erna. Het einde schuift mee naar **woensdag 9 juni 14:00**.

Na een dagtaak telt een lag in uren op dezelfde manier. *Storten fundering* eindigt op dinsdag 8 juni om 16:00. Zonder lag begint *Afwerken* op woensdag 9 juni om 07:00. Met een lag van 4 uur begint *Afwerken* op **woensdag 9 juni 11:00** en eindigt hij op vrijdag 11 juni om 11:00. Met een lag van 1 uur begint hij woensdag om 08:00.

### Een vrijdagmiddag vrij

Nu heeft de vrijdag maar één blok, van 07:00 tot 12:00: 5 uur. De andere dagen blijven 8 uur. De standaard werkdag blijft 8 uur, want dat is de meest voorkomende dagsom. Een week heeft nu 37 werkuren.

Een taak van 40 uur vanaf maandag 7 juni 07:00 gebruikt maandag tot en met donderdag (32 uur) en de vrijdag (5 uur). De laatste 3 uur vallen op de maandag erna, van 07:00 tot 10:00. Het einde is **maandag 14 juni 10:00**.

Een taak van 5 dagen hangt af van het profiel. In het profiel *Open Planner Studio* telt de korte vrijdag als een hele werkdag: de taak eindigt op **vrijdag 11 juni 12:00** en bezet 37 uur. Dat stelt de app ook voor als je de eenheid van 5 dagen naar uren wisselt. Onder het profiel *Primavera P6* zijn 5 dagen 40 uur, en eindigt dezelfde taak op maandag 14 juni 10:00.

In tutorial 4, over urenplanning, plan je zelf een kraaninzet in uren.

## Gevolgen en misverstanden

**"8 uur is 1 dag."** Alleen als de kalender dagen van 8 uur heeft. Op de kalender met de vrije vrijdagmiddag is 5 dagen in het profiel *Open Planner Studio* 37 uur, geen 40.

**"Als ik meer uren per dag instel, is mijn dagtaak sneller klaar."** Nee. Een dagtaak telt werkdagen. De uren per dag veranderen alleen wat een dag in uren waard is, bijvoorbeeld bij de weergave. Alleen bij een taak met resources en het taaktype *Vast werk* of *Vaste inzet* verandert de duur mee, omdat het werk gelijk blijft: 40 uur werk is 5 dagen bij 8 uur per dag en 7 dagen bij 6 uur per dag.

**"Een urentaak van 8 uur duurt één dag."** Alleen als hij aan het begin van de dag start. Begint hij later, zoals *Stelwerk* op dinsdag 11:00, dan loopt hij door in de volgende dag.

**"Een dagtaak begint altijd 's ochtends."** Nee. Een dagtaak begint op het moment dat zijn voorganger klaar is, zoals *Afwerken* op woensdag om 11:00. Hij duurt dan tot hetzelfde moment op de laatste werkdag.


## Zie ook

- [Een taak in uren plannen](docs://howto-taak-in-uren-plannen): de stappen om een taak in uren te plannen.
- [Werktijden instellen](docs://howto-werktijden-instellen): de werktijdblokken van een kalender aanpassen.
- [Kalenders en werkdagen](docs://uitleg-kalenders): hoe de app werkdagen telt en welke kalender wint.
- [Relaties leggen](docs://howto-relaties-leggen): de stappen om een relatie of lag te leggen.
