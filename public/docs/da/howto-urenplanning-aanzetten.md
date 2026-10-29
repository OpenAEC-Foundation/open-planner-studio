# Slå timeplanlægning til

Mål: planlæg opgaver i arbejdstimer, sammen med opgaver i dage.

## Hvornår du har brug for dette

Du lejer en kran pr. time, ikke pr. dag. En støbning på seks timer passer ikke i en hel arbejdsdag. Et nathold arbejder på andre tidspunkter end dagholdet. Til sådant arbejde vil du have en varighed i timer og en start og en slutdato med klokkeslæt. Du slår det også til, hvis du åbner en fil, og appen viser *Denne fil indeholder timeplanlægning.* Hvorfor appen tæller dage og timer forskelligt, kan du læse i [Dage og timer](docs://uitleg-dagen-en-uren).

## Trin

### Timeplanlægning slås til

1. Vælg *Indstillinger › Projekt › App-indstillinger* og åbn fanen *Tidsplan*.
2. Under *Timeplanlægning* sætter du kryds i *Slå timeplanlægning til*. Det virker med det samme. I meddelelsen *Denne fil indeholder timeplanlægning.* gør knappen *Slå timeplanlægning til* det samme.
3. Nedenunder findes *Tillad blandet dag/timeplanlægning*. Den er slået til som standard. Med denne indstilling vælger du pr. opgave, om den tæller i dage eller timer. Slår du den fra, forsvinder listen *Varighedsenhed*. Du kan dog stadig skrive en varighed med en enhed, for eksempel `12h`.

Det ændrer mere end varigheden af en opgave: under *Visning › Tidsskala* kan du vælge skalaen *Time*, i vinduet *Kalendere* kan en almindelig kalender få tidsbånd (blokken *Arbejdstimer*; en kalender, der allerede har blokke, viser den altid), og vinduet *Nyt projekt* får valgmulighederne *Arbejdsskift* og *Standardenhed for nye opgaver*.

### Planlæg en opgave i timer

1. Vælg opgaven, og se i panelet *Egenskaber* under *Tid* på feltet *Varighed*.
2. Skriv varigheden med en enhed, og tryk på Enter: `12h` (`12u`, den nederlandske forkortelse, virker også) for tolv timer, `1h 30m` for halvanden time. `1.5h` virker også. Et tal uden enhed tæller i den enhed, opgaven allerede har.
3. Vil du omregne en eksisterende opgave, vælger du enheden *Timer* under *Varighedsenhed*. Appen omregner varigheden med det samme, for eksempel fra `2` dage til `16` timer. Vil du tilbage, så brug *Fortryd*.
4. Du kan gå tilbage til dage med `2d` eller med enheden *Dage*.
5. Tryk på **Beregn** (F5), for eksempel via *Start › Tidsplan › Beregn*. Opgaven har nu en start og en slutdato med et klokkeslæt.
6. Vil du se timerne i Gantt-diagrammet, så vælg skalaen *Time* i listen under *Visning › Tidsskala*.

### Nye opgaver i timer som standard

1. Vælg *Indstillinger › Projekt › Projektindstillinger*.
2. Under *Standardenhed for nye opgaver* vælger du enheden *Timer* og klikker på *Anvend*.

En ny opgave får så en varighed på 5 timer i stedet for 5 dage. Eksisterende opgaver ændres ikke. Ved et nyt projekt findes det samme valg i vinduet *Nyt projekt*. Vælger du *Dagarbejdsskift* under *Arbejdsskift* i det vindue, er *Timer* deaktiveret. Vælg et andet arbejdsskift, eller angiv standardenheden efter oprettelsen i *Projektindstillinger*.

## Faldgruber, og hvad appen gør så

**Ingen gyldige arbejdstimer.** Hvis opgavens kalender ikke har brugbare arbejdstimer, viser appen *Denne kalender har ingen gyldige arbejdstimer. Kontrollér arbejdsdage og arbejdstimer.* Når du beregner, kan meddelelsen *Timeopgave 'name' har ingen gyldige arbejdstimer i sin kalender* vises.

**Ingen decimaler ved dage.** En varighed i dage er et helt tal. `1.5d` giver meddelelsen *Indtast et helt antal dage eller timer, for eksempel 2d eller 12t.* Vil du have halvanden dag, så regn i timer.

**En omregning, der ikke kan blive præcis.** Tolv timer passer ikke i hele dage på 8 timer. I *Egenskaber* og i *Rediger opgave* viser appen en gul blok med *12h svarer ikke til hele dage i denne kalender. Enheden er ikke ændret.* Enheden bliver, som den er. Opgavetabellen viser en kortere meddelelse: *Denne varighed kan ikke præcist omregnes til den anden enhed.*

**Feltet er deaktiveret.** For en fase, en hængekøje eller en milepæl med nul varighed følger varigheden af noget andet, og du kan ikke skrive den ind.

**Timeplanlægning slås fra igen.** Timeopgaver bliver stående og beregnes stadig. Varigheden kan så ikke redigeres. Feltet siger *Slå timeplanlægning til for at redigere denne timeopgave.*, og der er en knap, så du kan slå den til igen.

## Se også

- [Dage og timer](docs://uitleg-dagen-en-uren): hvordan appen tæller timer, hvad der sker, når dage og timer mødes, og hvor den runder af.
- [Angiv arbejdstimer](docs://howto-werktijden-instellen): tiderne i en kalender pr. ugedag.
- [Tilføj afhængigheder](docs://howto-relaties-leggen): en forsinkelse i timer mellem to opgaver.
- [App-indstillinger](docs://ref-instellingen): indstillingen Slå timeplanlægning til og hvad den ellers ændrer.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): indeholder timeopgaver (armering og støbning) med en egen timekalender, *Hourly calendar, rebar fixing & pouring*.
