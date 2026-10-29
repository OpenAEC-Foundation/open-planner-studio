# Beheer og deling af ressourcebiblioteker

Mål: opret og slet bibliotekerne, læg kalendere i dem, og eksportér eller importér et bibliotek, som backup eller for at bruge det på en anden computer.

## Hvornår du har brug for dette

Biblioteket ligger ikke i dine projektfiler, men i appen: i desktopappen i en fil på denne computer, i browseren i browserens lager. Det synkroniseres ikke. Hvis du rydder webstedets data i browseren, er biblioteket væk; eksportér det derfor som backup. Hvis en kollega vil arbejde med de samme hold og standardsatser, overdrager du også biblioteket som en fil. Hvis din organisation har flere driftsselskaber med hver sine hold, laver du et separat bibliotek for hvert af dem. For et nyt projekt vælger du, hvilket bibliotek det bruger.

Hvad et bibliotek er, læser du i [Ressourcebiblioteket](docs://uitleg-resourcebibliotheek). Du redigerer ikke selve ressourcerne her, men i ressourcepanelet; se [Brug af ressourcebiblioteket](docs://howto-resourcebibliotheek-gebruiken).

## Trin

### Åbn administrationsskærmen

Vælg *Fil › Bibliotek*. Til venstre står listen *Ressourcebiblioteker*. Til højre står detaljerne for det bibliotek, du klikker på: navn, knapperne og listen *Kalendere*. Øverst står der, at du administrerer ressourcer på fanen *Ressourcer*.

### Opret, omdøb og vælg et standardbibliotek

1. Klik på plustegnet over listen (*Tilføj ressourcebibliotek*). Et bibliotek, *Nyt ressourcebibliotek*, tilføjes, og det vælges med det samme.
2. Skriv det nye navn i navnefeltet øverst til højre, og tryk på Enter, eller klik uden for feltet. Appen accepterer ikke et tomt navn.
3. Klik på *Gør til standard*, så dette bibliotek er forvalgt til nye projekter fra nu af. Standardbiblioteket har en stjerne på listen.

### Læg en kalender i biblioteket

1. Klik på *Fra projekt* under *Kalendere*. Der åbner sig en liste med kalenderne i dit aktive projekt.
2. Klik på den lille pil efter den kalender, du vil overtage. Over listen står der *Tilføjet*. En kalender, der allerede er koblet til dette bibliotek, har *allerede koblet* efter sit navn.
3. Kalenderen står nu på listen *Kalendere* i biblioteket. Med blyanten (*Redigér*) ændrer du navnet, og du gemmer med flueben. Papirkurven sletter kalenderen med det samme, uden at spørge om bekræftelse. Kopierne i projekterne bliver.

Efter *Kalendere* står et versionsnummer, for eksempel *v2*. Det stiger ved hver ændring i biblioteket. En kalender i biblioteket følger med til et projekt, når du tildeler en ressource, der bruger den. Du knytter den til en ressource i *Ressourcer*, visningen *Bibliotek*, i kolonnen *Kalender*.

### Eksportér et bibliotek

1. Vælg biblioteket på listen.
2. Klik på *Eksporter*.
3. I desktopappen og i Chrome og Edge vælger du, hvor filen gemmes. I andre browsere går den direkte til din downloadmappe, og appen siger det. Filen hedder `bibliotheek-` efterfulgt af navnet på biblioteket, med filendelsen `.ifc`.

Under knapperne står der *Eksport er også din backup. Gem filen et sikkert sted*.

### Importér et bibliotek

1. Klik på *Importer*. Vinduet *Importer bibliotek* åbner sig for det bibliotek, du havde valgt på listen.
2. Klik på *Vælg fil*… og vælg `.ifc`-filen fra en eksport. Hvis filen ikke indeholder et bibliotek, står der *Denne IFC-fil indeholder ikke et ressourcebibliotek*.
3. Appen viser, hvad der er i den, for eksempel *2 kalendere, 5 ressourcer (version 3)*.
4. Vælg, hvad du vil gøre med den, se nedenfor.
5. Klik på *Tilføj* eller *Erstat*, eller på *Annuller* for at stoppe.

Du har to valg:

- *Tilføj som nyt ressourcebibliotek*: filen bliver et separat bibliotek ved siden af dine eksisterende. Nedenfor står der under hvilket navn, for eksempel *Tilføjes som “Mijn resourcebibliotheek (2)”.* Intet går tabt, og dit aktive projekt forbliver koblet til sit eget bibliotek.
- *Erstat et eksisterende ressourcebibliotek*: hele indholdet af det valgte bibliotek erstattes af indholdet fra filen. Der står også *Import erstatter HELE poolen i det valgte ressourcebibliotek*. Har du to eller flere biblioteker, vælger du, hvilket under *Importer til ressourcebibliotek*. Er dit bibliotek nyere end filen, advarer appen: *Dit lokale bibliotek er nyere. Import kan overskrive dine ændringer*.

Appen foreslår selv et valg. Hvis filen indeholdt standardbiblioteket, er *Tilføj som nyt ressourcebibliotek* forvalgt. Findes biblioteket fra filen allerede på din computer, og er det ikke standardbiblioteket, så er *Erstat et eksisterende ressourcebibliotek* forvalgt, med netop dét bibliotek valgt. Er du i tvivl, så vælg *Tilføj*. Det overskriver ikke noget.

### Slet et bibliotek

1. Vælg biblioteket på listen, og klik på *Slet ressourcebibliotek*. Knappen er grå for det sidste bibliotek, fordi der altid bliver ét tilbage.
2. Bekræft med *Slet*. Spørgsmålet er *Vil du slette dette ressourcebibliotek?* Er åbne projekter koblet til det, står der *Dette ressourcebibliotek er koblet til 1 åbent projekt. Sletning fjerner koblingen til projektet. Vil du fortsætte?* Ved flere projekter står der det samme med tallet, for eksempel *koblet til 2 åbne projekter*.

Biblioteket er så væk, med alle ressourcer og kalendere i det. De åbne projekter, der brugte det, bliver afkoblet: deres ressourcer bliver ved som almindelige projektressourcer. Eksportér først, hvis du vil beholde indholdet.

### Overdrag et projekt sammen med dets bibliotek

En projektfil indeholder sine egne kopier af ressourcerne. Vil du også overdrage hele biblioteket, gør du følgende. Selve eksporten beskrives også i [Eksport](docs://howto-exporteren).

1. Åbn et projekt, der er koblet til et bibliotek, og vælg *Fil › Eksporter*.
2. Sæt flueben i *Gem biblioteksfilen ved siden af*. Afkrydsningsfeltet vises kun for et koblet projekt.
3. Vælg kortet *IFC*, og gem filen. Appen spørger så også efter en anden fil. Den har samme navn som projektet med `-bibliotheek` efter, og den indeholder biblioteket.

Afkrydsningsfeltet virker kun for IFC-eksporten, ikke for de andre eksportformater. Din kollega importerer den anden fil, som beskrevet ovenfor.

## Faldgruber og hvad appen så gør

**To planlæggere, to biblioteker.** Appen synkroniserer ikke biblioteker mellem computere. Importvinduet viser altid en advarsel om det: *Bemærk: biblioteker synkroniseres ikke mellem maskiner. Hvis to planlæggere arbejder med samme ressourcebibliotek, kan bibliotekerne komme til at afvige fra hinanden. Hvis din organisation deler hold på tværs af driftsselskaber, vælg da bevidst ét fælles bibliotek.*

**Erstatning overskriver alt.** Alt, du havde i det valgte bibliotek, er væk, og en ændring af et bibliotek kan ikke fortrydes med *Fortryd*. Eksportér først, hvis du er i tvivl. Dine projekter beholder deres kopier. Appen opdaterer kopier, der stadig findes i den nye fil. Kopier, der ikke længere er i den, får markeringen *ikke længere i biblioteket* og fungerer stadig. Hvis en kopi er forskellig, åbner vinduet *Sammenkæd ressourcebibliotek* (se [Brug af ressourcebiblioteket](docs://howto-resourcebibliotheek-gebruiken)).

**Sletning af en kalender på listen sker med det samme.** Appen spørger ikke om bekræftelse, men det gør den, når du sletter en ressource. Det ligner en mangel. Ændringer i biblioteket kan ikke fortrydes med *Fortryd*.

## Se også

- [Ressourcebiblioteket](docs://uitleg-resourcebibliotheek): hvordan bibliotek og projekt hænger sammen.
- [Brug af ressourcebiblioteket](docs://howto-resourcebibliotheek-gebruiken): koble ressourcer, tildele dem og løse afvigelser.
- [Eksport](docs://howto-exporteren): eksportformaterne, inklusive IFC med en fil for biblioteket.
