# Externe relaties naar een ander project

Doel: een taak in dit project koppelen aan een taak in een ander projectbestand, zodat je planning rekening houdt met werk dat elders gepland wordt.

## Wanneer je dit nodig hebt

Je aanbouw kan pas beginnen als het terrein bouwrijp is, en dat werk staat in het project van de aannemer. Of de installateur kan pas aan de slag als jouw ruwbouw klaar is, en hij plant in zijn eigen bestand. Een gewone relatie werkt alleen tussen taken in hetzelfde project. Een **externe relatie** verbindt een taak met een taak in een ander bestand.

Een externe relatie rekent niet live met het andere project mee. De app slaat een vaste **ankerdatum** op: een datum van de externe taak op het moment van koppelen. Bij een externe voorganger is dat de geplande datum, bij een externe opvolger de laatste datum die het andere project toelaat. De berekening gebruikt die datum als grens. Verandert het andere project, dan schuift er bij jou niets mee totdat je het anker vernieuwt.

## Stappen

1. Selecteer precies één taak in dit project: de taak die van de externe taak afhangt, of waar de externe taak van afhangt. Kies je een fase, dan geldt de koppeling voor elke taak in die fase.
2. Kies *Start › Taken › Relatie ▾ › Externe relatie toevoegen…*. Hetzelfde menu staat op *Planning › Relaties* en op *Tabel › Taken*. Het item is alleen beschikbaar als er precies één taak geselecteerd is.
3. Kies in het venster *Externe (cross-project) koppeling* een van de twee routes. Bij *Bronbestand* kies je bij *Kies een recent bestand* het projectbestand en daarna de *Brontaak*; de app leest het bestand alleen-lezen in, opent het niet als document, en neemt de ankerdatum zelf over. Deze route werkt alleen in de desktop-app en alleen voor een bestand in de lijst van recente bestanden; anders is de knop *Bronbestand* uitgeschakeld. Bij *Handmatig (fallback)* vul je het *Project-id* en *Taak-id* van de externe taak in, eventueel een *Taaknaam (optioneel)*, en de *Ankerdatum*. Dit is in de browserversie de enige route.
4. Kies bij *Richting* of de externe taak je voorganger of je opvolger is: *Voorganger (extern → mij)* of *Opvolger (ik → extern)*.
5. Kies het *Relatietype* (FS, SS, FF of SF) en vul zo nodig een *Lag (werkdagen)* in, bijvoorbeeld `0d` of `2d`.
6. Klik op *Koppeling toevoegen* en druk op **Bereken** (F5).

Welke datum je bij een handmatige koppeling als anker invult, hangt af van de richting en het type:

- Bij een externe **voorganger** telt de eerste letter van het type: F betekent de einddatum van de externe taak, S de startdatum. Bij FS en FF vul je dus het einde in, bij SS en SF de start.
- Bij een externe **opvolger** telt de tweede letter: S is de start van de externe taak, F het einde. Vul de laatste datum in die het andere project toelaat: bij FS en SS de *Laatste start* van de externe taak, bij FF en SF haar *Laatste einde*.

Plan je in uren (een taak op een kalender met werktijden), dan vraagt het veld *Ankerdatum* ook een tijdstip.

Voorbeeld: het terreinproject eindigt vrijdag 18 juni 2027. Je koppelt *Grondwerk* met een externe voorganger van type FS, ankerdatum 18 juni 2027. Na **Bereken** begint het grondwerk op maandag 21 juni, de eerste werkdag na het anker. Een externe opvolger werkt de andere kant op: hij begrenst hoe laat jouw taak klaar mag zijn.

## Wat je ziet en hoe je beheert

- Externe koppelingen staan als tekst in de kolommen *Voorgangers* en *Opvolgers* van de takenlijst (voeg ze toe met de **+** in de tabelkop, onder *Relaties*), met de naam van het project en de taak, en het type. Een driehoekje met *Bron ontbreekt* geeft aan dat de bron niet is ingelezen; houd je muis boven de koppeling voor het project (op de regel *Project-id* staat de projectnaam zodra die bekend is), het Taak-id, de ankerdatum en de bronstatus.
- In de Gantt staat bij de taak een grijze spookbalk. Bij een voorganger eindigt hij op het anker, bij een opvolger begint hij erop. Een gestippelde rand met het rode label *verouderd* betekent dat de bron niet is ingelezen. Bij een handmatige koppeling is dat altijd zo.
- Rechtsklik op een koppeling in de kolom voor *Externe relatie bewerken…* en *Relatie verwijderen*. Heeft de koppeling een bronbestand, dan staat er ook *Bron vernieuwen* bij.
- Kies *Relatie ▾ › Alle externe relaties vernieuwen* om de bronbestanden opnieuw in te lezen en de ankers bij te werken. Dat kan alleen in de desktop-app. Heb je alleen handmatige koppelingen, dan meldt de app *Geen verversbare externe bronnen (bestandspad ontbreekt).* Druk na een vernieuwing op **Bereken**.
- Sla je een nieuwe versie van een bronbestand op, dan merkt de desktop-app dat meteen: hij bewaakt de map van elk bronbestand. Lukt dat bewaken niet, bijvoorbeeld bij een map buiten je thuismap, dan kijkt hij als je het document opent en als je terugkeert naar het venster. Verandert er een anker, dan staat er een balk onder het lint, bijvoorbeeld *Installateur.ifc heeft een nieuwe versie, opgeslagen op 3 nov 2026 18:11 (auteur: Anna de Vries). 2 koppelingen veranderen.* De auteur komt uit de projectgegevens van de bron. Klik op *Bekijken*: het venster toont per koppeling het *Anker nu* en het anker *Na accepteren*, en wat er in je planning verschuift, bijvoorbeeld *Accepteren verschuift 2 taken.* en *Het einde van het project gaat van 30-03-2027 naar 01-04-2027 (+2 werkdagen).* Het venster vergelijkt met de planning zoals je die nu ziet, ook in de weergave [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen). Heb je na een wijziging nog niet herberekend, dan telt die wijziging mee in wat er verschuift: *Accepteren* rekent alles door. Met *Accepteren* neemt de app de nieuwe ankers over en herberekent de planning, in één stap voor *Ongedaan maken*. Met *Later* blijft alles staan; de balk komt pas terug bij een volgende versie van de bron. De app neemt een nieuwe versie nooit zelf over. Verandert er geen anker, dan komt er geen balk.
- Houd je muis boven de koppeling om te zien waar het anker vandaan komt. Op de regel *Herkomst anker* staat de wijzigingstijd van het bronbestand en wanneer de app het anker las, bijvoorbeeld *bronbestand van 2 nov 2026 14:05, gelezen op 2 nov 2026 14:10*. Zo zie je achteraf op welke versie van het andere project je planning rekende. Vul je het anker zelf in, dan heeft het geen herkomst en ontbreekt de regel.
- Wijzig je het type of de richting zodat het anker een andere kant van de externe taak nodig heeft (start in plaats van einde, of andersom), dan vraagt de app bij een handmatige koppeling om een nieuw anker: *Kies een nieuw anker: het relatietype gebruikt nu de andere zijde van de brontaak.* Bij een koppeling met bronbestand leest de app het anker zelf opnieuw.

## Valkuilen en wat de app dan doet

**Het andere project schuift niet mee.** Verandert de externe taak van datum, dan blijft je planning op het oude anker rekenen tot je de nieuwe versie accepteert, het anker vernieuwt of het anker aanpast. Bij de handmatige route pas je de ankerdatum zelf aan, via rechtsklik op de koppeling en *Externe relatie bewerken…*.

**Een externe voorganger is een ondergrens.** Begint je taak door zijn eigen voorgangers later dan het anker eist, dan wint die relatie. Het anker duwt alleen.

**Een externe opvolger is een bovengrens.** Als anker neemt de app de *Laatste start* of het *Laatste einde* van de externe taak, niet de geplande datum. Zo telt de speling die de externe taak in haar eigen project heeft ook bij jou mee, net als in Primavera P6 met beide projecten open. Voorbeeld: *Installatie* staat gepland op maandag 1 maart 2027 en mag uiterlijk op maandag 15 maart beginnen. Je ruwbouw heeft een externe opvolger van type FS naar *Installatie*. Dan krijgt de ruwbouw 10 werkdagen speling, niet 0. Heeft het bronbestand geen late datums, of is die kant van de externe taak al gebeurd (begonnen of klaar), dan neemt de app de *Vroegste start* of het *Vroegste einde*. Wil je toch aan de geplande datum vasthouden, zet dan een deadline of een constraint op je taak. Is het anker te krap, dan zie je dat als negatieve speling op je taak en de taken ervoor. Na *Bereken* (F5) staat er ook een regel *Te krap voor externe opvolger …* in het paneel *Waarschuwingen*, en de statusbalk telt *N externe opvolger(s) te krap*. Zie [Meldingen en waarschuwingen](docs://ref-meldingen).

**Alleen een vaste lag.** Voor een externe relatie kun je geen lag in kalenderdagen of procenten opgeven; de app zegt *Externe relaties ondersteunen alleen een vaste lag in werkdagen of werktijd.* De lag telt in de *Lag-kalender* van het project, net als bij een gewone relatie (zie [Rekenopties en conventies](docs://ref-rekenopties-en-conventies)). Kies je daar *24-uurs* of *Projectkalender*, dan telt de lag in die kalender. Kies je *Voorganger* of *Opvolger* en staat die kant in het andere project, dan kent de app zijn kalender niet. De lag telt dan in de kalender van je eigen taak, en het paneel *Waarschuwingen* meldt dat bij de taak. Een lag in uren telt bij elke taak, ook bij een taak in dagen: 2 uur na een anker om 07:00 is 09:00. Een breuk mag, bijvoorbeeld `0,5d`.

**Het Project-id van een ander bestand.** Het Project-id staat niet in een veld of kolom, maar als `InternalProjectId` in het IFC van dat project: open het project, ga naar het tabblad *IFC* en kies *Genereer IFC*. De berekening gebruikt alleen de ankerdatum; het id is geen puur label. Bij het vernieuwen herkent de app een bronbestand eerst aan het Project-id (daarna aan het bestandspad). Vul je bij een handmatige koppeling hetzelfde id in als dat van een bronbestand, dan wordt de koppeling bij het vernieuwen van dat bestand mee bijgewerkt. De *Taak-id* van een taak in het andere project vind je in de tabel van dat project, in de kolom *Taak-id* onder *Technisch*.

## Zie ook

- [Relaties leggen](docs://howto-relaties-leggen): relaties tussen taken in hetzelfde project.
- [Een constraint of deadline zetten](docs://howto-constraint-deadline-zetten): datumgrenzen op een taak, zonder ander project.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): bevat een externe koppeling op *Car park paving* (een externe voorganger).
