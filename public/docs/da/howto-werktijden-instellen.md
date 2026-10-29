# Indstilling af arbejdstimer

Mål: angiv pr. ugedag på hvilke klokkeslæt en kalender arbejder, så opgaver i timer kører på de rigtige tidspunkter.

## Hvornår du har brug for dette

Fredag eftermiddag er fri. Holdet arbejder fra 06:00 til 22:00 i to arbejdsskift. Der er et nathold. Pausen er kortere end en time. Så længe du kun bruger dage i tidsplanen, er *Start (time)*, *Slut (time)* og pausen nok ([Oprettelse og tildeling af en kalender](docs://howto-kalender-maken-en-toewijzen)). Angiver du opgaver i timer, tæller appen arbejdsminutter inden for kalenderens tidsbånd. I appen kaldes tidsbåndene *bånd*. Et tidsbånd er en sammenhængende periode med arbejdstid på én ugedag. Et hul mellem to tidsbånd er en pause. Hvad det betyder for din tidsplan, står i [Dage og timer](docs://uitleg-dagen-en-uren).

Hvis du vil give en almindelig kalender tidsbånd, skal du bruge *Slå timeplanlægning til* ([Sådan slår du timeplanlægning til](docs://howto-urenplanning-aanzetten)). Har kalenderen allerede tidsbånd, for eksempel fra en MS Project-fil, gør blokken *Arbejdstimer* altid synlig. Så kan du ændre tidsbåndene også med timeplanlægning slået fra.

## Trin

### Valg af en forudindstilling for arbejdsskift

1. Vælg *Tidsplan › Kalender › Kalender* og vælg kalenderen til venstre.
2. Klik på en forudindstilling i blokken *Arbejdstimer*. Den erstatter arbejdsdagene og arbejdstimerne i kalenderen.
3. Klik på *Anvend*.

Hver forudindstilling gør dette:

- *Dagarbejdsskift*: mandag til fredag fra 08:00 til 16:00 uden pause. Dermed bliver kalenderen igen en almindelig kalender uden tidsbånd.
- *2 arbejdsskift*: mandag til fredag fra 06:00 til 14:00 og fra 14:00 til 22:00, i alt 16 timer.
- *3 arbejdsskift*: mandag til fredag tre arbejdsskift, fra 06:00 til 14:00, fra 14:00 til 22:00 og fra 22:00 til 06:00 næste dag, i alt 24 timer.
- *Natarbejdsskift*: mandag til fredag fra 22:00 til 06:00 næste dag, 8 timer.
- *24/7*: alle syv dage fra 00:00 til 24:00.

### Angivelse af arbejdstimer pr. ugedag

1. Klik på *Angiv pr. ugedag*… i blokken *Arbejdstimer*. Under knapperne vises en række pr. ugedag med arbejdstiden for den dag. Kalenderen har nu tidsbånd pr. ugedag. Har kalenderen dem allerede, er oversigten straks åben. Så hedder knappen *Skjul arbejdstimer*, og den klapper oversigten sammen.
2. Justér start- og sluttidspunktet for hvert tidsbånd i de to tidsfelter. Skriv tidspunktet og tryk på Enter, eller brug pilene (15 minutter pr. trin). Felterne følger *Tidsformat* i indstillingerne. *13:00* og *1:00 PM* fungerer begge.
3. Vil du indbygge en pause, så klik på **+** (*Tilføj bånd*) for den dag. Justér derefter tidspunkterne for tidsbåndene, så der er et hul mellem dem. Et nyt tidsbånd starter kl. 08:00 og slutter kl. 16:00.
4. Et tidsbånd, der løber over midnat, markerer du ved at sætte kryds ved *næste dag*. Tidsbåndet tæller for den dag, det begynder på.
5. Klik på skraldespanden bag et tidsbånd for at fjerne det. En dag uden tidsbånd vises som *Ikke-arbejdsdag*.
6. Klik på kopisymbolet (*Kopiér til alle arbejdsdage*) for en dag fra mandag til fredag. Så lægges tidsbåndene for den dag på mandag til fredag.
7. Over blokken *Arbejdstimer* står *Standard arbejdsdag*: den arbejdstid pr. dag, som appen udleder af tidsbåndene og regner med. Tallet følger med det samme, når du ændrer tidsbåndene. Har kalenderen egne timer pr. dag, for eksempel fra Primavera P6, bevares den egne værdi. Den følger med ved eksport, indtil en forudindstilling erstatter den. Hvis den egne værdi afviger fra *Standard arbejdsdag*, vises en orange meddelelse lige under tallet, for eksempel: *Filen har en egen arbejdsdag på 8t. Den bevares ved eksport til MS Project og P6. Dér tæller en dag 8t, her 10t.* Meddelelsen forsvinder, så snart tidsbåndene giver samme dagsum, eller når en forudindstilling erstatter den egne værdi. Meddelelsen ændrer ikke beregningen. Klik på *Anvend*.

**Eksempel: en fri fredag eftermiddag.** Klik på *Angiv pr. ugedag*…. Fjern det andet tidsbånd (13:00 til 16:00) for *Fr*. Fredag har nu 5 timer, de andre dage 8. *Standard arbejdsdag* forbliver 8 timer.

### Gem en egen forudindstilling

1. Klik på *Gem som forudindstilling*… og skriv et navn i feltet *Navn til din egen forudindstilling*.
2. Klik på *Gem*. Forudindstillingen står nu blandt de andre, og du kan bruge den i ethvert projekt. Med krydset ved siden af fjerner du den igen.

En egen forudindstilling gemmes på denne enhed, ikke i projektfilen.

## Faldgruber, og hvad appen gør så

**En forudindstilling erstatter alt.** Hvis du vælger en forudindstilling, forsvinder de arbejdsdage og arbejdstimer, du har angivet før. Helligdagene bliver som de er.

**Dagknapper ændrer tidsbåndene.** Hvis du slår en dag fra under *Arbejdsdage*, forsvinder tidsbåndene for den dag. Slår du den til igen, får den de tidsbånd, den havde, da du åbnede dialogen (eller efter den sidste forudindstilling). Ellers får den dem for den første arbejdsdag. *Man–fre* gør det for mandag til fredag og fjerner tidsbåndene for lørdag og søndag. *Kontinuerlig (24/7)* erstatter alle tidsbånd: hver dag får 00:00 til 24:00.

**Justering af arbejdstimer, når timeplanlægning er slået fra.** En kalender med tidsbånd beholder blokken *Arbejdstimer*, også når du slår timeplanlægning fra. Her ændrer du blot tidsbåndene. Vælger du *Dagarbejdsskift*, bliver det igen en almindelig kalender med felterne *Start (time)*, *Slut (time)* og pausen. Tidsbånd sætter du kun tilbage, når timeplanlægning er slået til.

**Ingen brugbare arbejdstimer.** En kalender uden tidsbånd eller uden arbejdsdage kan ikke bære en opgave i timer. Appen viser så *Denne kalender har ingen gyldige arbejdstimer. Kontrollér arbejdsdage og arbejdstimer.*

## Se også

- [Dage og timer](docs://uitleg-dagen-en-uren): hvordan appen tæller arbejdstimer og udleder standard arbejdsdag.
- [Sådan slår du timeplanlægning til](docs://howto-urenplanning-aanzetten): angivelse af en opgave i timer.
- [Kalendere og arbejdsdage](docs://uitleg-kalenders): hvilken kalender der gælder for hvilken opgave.
- [Kalendervinduer](docs://ref-kalenders): alle felter i kalendervinduerne.
