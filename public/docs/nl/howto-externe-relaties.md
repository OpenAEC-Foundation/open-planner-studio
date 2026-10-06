# Externe relaties naar een ander project

Doel: een taak in dit project koppelen aan een taak in een ander projectbestand, zodat je planning rekening houdt met werk dat elders gepland wordt.

## Wanneer je dit nodig hebt

Je aanbouw kan pas beginnen als het terrein bouwrijp is, en dat werk staat in het project van de aannemer. Of de installateur kan pas aan de slag als jouw ruwbouw klaar is, en hij plant in zijn eigen bestand. Een gewone relatie werkt alleen tussen taken in hetzelfde project. Een **externe relatie** verbindt een taak met een taak in een ander bestand.

Een externe relatie rekent niet live met het andere project mee. De app slaat een vaste **ankerdatum** op: de datum van de externe taak op het moment van koppelen. De berekening gebruikt die datum als grens. Verandert het andere project, dan schuift er bij jou niets mee totdat je het anker vernieuwt.

## Stappen

1. Selecteer precies één taak in dit project: de taak die van de externe taak afhangt, of waar de externe taak van afhangt.
2. Kies *Start › Taken › Relatie ▾ › Externe relatie toevoegen…*. Hetzelfde menu staat op *Planning › Relaties* en op *Tabel › Taken*. Het item is alleen beschikbaar als er precies één taak geselecteerd is.
3. Kies in het venster *Externe (cross-project) koppeling* een van de twee routes. Bij *Bronbestand* kies je bij *Kies een recent bestand* het projectbestand en daarna de *Brontaak*; de app leest het bestand alleen-lezen in, opent het niet als document, en neemt de ankerdatum zelf over. Deze route werkt alleen in de desktop-app en alleen voor een bestand in de lijst van recente bestanden; anders is de knop *Bronbestand* uitgeschakeld. Bij *Handmatig (fallback)* vul je het *Project-id* en *Taak-id* van de externe taak in, eventueel een *Taaknaam (optioneel)*, en de *Ankerdatum*. Dit is in de browserversie de enige route.
4. Kies bij *Richting* of de externe taak je voorganger of je opvolger is: *Voorganger (extern → mij)* of *Opvolger (ik → extern)*.
5. Kies het *Relatietype* (FS, SS, FF of SF) en vul zo nodig een *Lag (werkdagen)* in, bijvoorbeeld `0d` of `2d`.
6. Klik op *Koppeling toevoegen* en druk op **Bereken** (F5).

Welke datum je bij een handmatige koppeling als anker invult, hangt af van de richting en het type:

- Bij een externe **voorganger** telt de eerste letter van het type: F betekent de einddatum van de externe taak, S de startdatum. Bij FS en FF vul je dus het einde in, bij SS en SF de start.
- Bij een externe **opvolger** telt de tweede letter: S is de startdatum van de externe taak, F de einddatum. Bij FS en SS vul je dus de start in, bij FF en SF het einde.

Plan je in uren (urenplanning aan en een taak op een kalender met werktijden), dan vraagt het veld *Ankerdatum* ook een tijdstip.

Voorbeeld: het terreinproject eindigt vrijdag 18 juni 2027. Je koppelt *Grondwerk* met een externe voorganger van type FS, ankerdatum 18 juni 2027. Na **Bereken** begint het grondwerk op maandag 21 juni, de eerste werkdag na het anker. Een externe opvolger werkt de andere kant op: hij begrenst hoe laat jouw taak klaar mag zijn.

## Wat je ziet en hoe je beheert

- Externe koppelingen staan als tekst in de kolommen *Voorgangers* en *Opvolgers* van de takenlijst (voeg ze toe met de **+** in de tabelkop, onder *Relaties*), met de naam van het project en de taak, en het type. Een driehoekje met *Bron ontbreekt* geeft aan dat de bron niet is ingelezen; houd je muis boven de koppeling voor het project (op de regel *Project-id* staat de projectnaam zodra die bekend is), het Taak-id, de ankerdatum en de bronstatus.
- In de Gantt staat bij de taak een grijze spookbalk. Bij een voorganger eindigt hij op het anker, bij een opvolger begint hij erop. Een gestippelde rand met het rode label *verouderd* betekent dat de bron niet is ingelezen. Bij een handmatige koppeling is dat altijd zo.
- Rechtsklik op een koppeling in de kolom voor *Externe relatie bewerken…* en *Relatie verwijderen*. Heeft de koppeling een bronbestand, dan staat er ook *Bron vernieuwen* bij.
- Kies *Relatie ▾ › Alle externe relaties vernieuwen* om de bronbestanden opnieuw in te lezen en de ankers bij te werken. Dat kan alleen in de desktop-app. Heb je alleen handmatige koppelingen, dan meldt de app *Geen verversbare externe bronnen (bestandspad ontbreekt).* Druk na een vernieuwing op **Bereken**.
- Wijzig je het type of de richting zodat het anker een andere kant van de externe taak nodig heeft (start in plaats van einde, of andersom), dan vraagt de app bij een handmatige koppeling om een nieuw anker: *Kies een nieuw anker: het relatietype gebruikt nu de andere zijde van de brontaak.* Bij een koppeling met bronbestand leest de app het anker zelf opnieuw.

## Valkuilen en wat de app dan doet

**Het andere project schuift niet mee.** Verandert de externe taak van datum, dan blijft je planning op het oude anker rekenen tot je hem vernieuwt of het anker aanpast. Bij de handmatige route pas je de ankerdatum zelf aan, via rechtsklik op de koppeling en *Externe relatie bewerken…*.

**Een externe voorganger is een ondergrens.** Begint je taak door zijn eigen voorgangers later dan het anker eist, dan wint die relatie. Het anker duwt alleen.

**Een externe opvolger is een bovengrens.** Is het anker te krap, dan zie je dat als negatieve speling op je taak en de taken ervoor. Er komt geen aparte waarschuwing bij, dus let op de kolom *Totale speling*.

**Alleen een vaste lag.** Voor een externe relatie kun je geen lag in kalenderdagen of procenten opgeven; de app zegt *Externe relaties ondersteunen alleen een vaste lag in werkdagen of werktijd.* De werkdagen tellen in de kalender van je eigen taak. Een lag in uren telt alleen bij een taak die in uren gepland is; bij een taak in dagen negeert de berekening hem. Gebruik dan werkdagen.

**Het Project-id van een ander bestand.** Het Project-id staat niet in een veld of kolom, maar als `InternalProjectId` in het IFC van dat project: open het project, ga naar het tabblad *IFC* en kies *Genereer IFC*. De berekening gebruikt alleen de ankerdatum; het id is geen puur label. Bij het vernieuwen herkent de app een bronbestand eerst aan het Project-id (daarna aan het bestandspad). Vul je bij een handmatige koppeling hetzelfde id in als dat van een bronbestand, dan wordt de koppeling bij het vernieuwen van dat bestand mee bijgewerkt. De *Taak-id* van een taak in het andere project vind je in de tabel van dat project, in de kolom *Taak-id* onder *Technisch*.

## Zie ook

- [Relaties en lag](docs://uitleg-relaties): hoe de app een relatie en een lag doorrekent.
- [Relaties leggen](docs://howto-relaties-leggen): relaties tussen taken in hetzelfde project.
- [Constraints en deadlines](docs://uitleg-constraints): datumgrenzen op een taak, zonder ander project.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): bevat een externe koppeling op *Car park paving* (een externe voorganger).
