# Brug ressourcebiblioteket

Mål: brug ressourcer fra ressourcebiblioteket i dit projekt, og læg en ressource, du har lavet i et projekt, i biblioteket, så alle projekter bruger de samme data.

## Hvornår har du brug for dette

Du har et fast murerhold, en kran og en pudser, som optræder i flere projekter. Uden et bibliotek skriver du dem ind igen i hvert projekt, med risiko for forskellige navne og standardsatser, og intet projekt ser, at et andet også efterspørger det samme hold. I biblioteket registrerer du dem én gang.

Hvad biblioteket er, og hvad et projekt overtager fra det, læser du i [Ressourcebiblioteket](docs://uitleg-resourcebibliotheek). Denne artikel handler om handlingerne. Oprettelse, eksport og sletning af biblioteker står i [Administrer og del ressourcebiblioteker](docs://howto-bibliotheken-beheren).

## Trin

### 1. Sammenkæd projektet med et bibliotek

Du arbejder kun med biblioteket, hvis projektet er sammenkædet med det. Uden en sammenkædning vises skiftet *Bibliotek*, *Projekt* og *Belægning* ikke i panelet *Ressourcer*.

For et nyt projekt:

1. Vælg *Fil › Ny*. Vinduet *Opret nyt projekt* åbnes.
2. Se på *Ressourcebibliotek*. Feltet står på standardbiblioteket. Du kan vælge et andet, *intet bibliotek (frit projekt)* eller *+ Opret nyt ressourcebibliotek…*.
3. Klik på *Opret*.

For et eksisterende projekt:

1. Vælg *Fil › Projektindstillinger*.
2. Under *Ressourcebibliotek* vælger du biblioteket.
3. Klik på *Anvend*. Indtil da står der nederst *Ændringer er ikke anvendt — klik på Anvend for at gemme dem.*

Har projektet allerede ressourcer med samme navn som et bibliotekselement, åbnes vinduet *Sammenkæd ressourcebibliotek* med afsnittet *Genkendt*. Hver ressource, der har et tilsvarende bibliotekselement, siger *Forslag: Bricklayer*. Klik på *Sammenkæd* for at sammenkæde den ene, eller på *Sammenkæd alle forslag*, hvis der er mere end ét forslag. Appen sammenligner navne uden hensyn til store og små bogstaver eller dobbelte mellemrum. Når du sammenkæder, overtager ressourcen navn, type, standardsats, enhed og beskrivelse fra bibliotekselementet. *Maksimalt antal enheder* bliver det, du havde i projektet. Vinduet viser også kalendere i projektet, der har samme navn som en bibliotekskalender. Med *Beslut senere* lukker du vinduet uden at sammenkæde.

### 2. Læg en ressource i biblioteket

1. Vælg *Ressourcer › Administrer › Ressourcer*. Ressourcepanelet fylder hele området. Det åbner altid på *Projekt*, også for et sammenkædet projekt.
2. Øverst til højre vælger du *Bibliotek*. Over tabellen står der *Dette redigerer biblioteket og gælder for alle projekter — kan ikke fortrydes.*
3. Klik på *Opret ressource i biblioteket*. En tom række vises nederst i tabellen.
4. Skriv navnet, for eksempel *Bricklayer*, og tryk på Enter. Ressourcen er nu i biblioteket, og der åbnes straks en tom række til den næste. Tryk på Esc, når du er færdig. Uden navn opretter appen ingenting.
5. Udfyld resten af rækken. *Type* står som standard på *Arbejde*. Under *Maksimalt antal enheder* skriver du, hvor mange af denne ressource der er i alt, for eksempel 3, hvis der er tre murere. Belægningsoversigten bruger dette tal som kapacitet. *Standardsats/time* er valgfrit. Du kan kun udfylde *Enhed* for typen *Materiale*. Under *Kalender* vælger du en kalender fra biblioteket, eller *+ Ressourcekalender* for at lave en, se [Opsætning af en ressourcekalender](docs://howto-resourcekalender-instellen). Appen gemmer navn, standardsats og enhed, når du forlader feltet, og de andre felter med det samme.

Hver ændring i biblioteket slår straks igennem til de ikke-redigerede kopier i dine åbne projekter.

### 3. Tildel en ressource til dit projekt

1. I visningen *Bibliotek* vælger du *Tildel til projekt* på ressourcen. Over tabellen står der *Tilføjet.* Klikker du igen, står der *Findes allerede i projektet.*, og der kommer ingen ekstra kopi.
2. Vælg *Projekt*. Kopien står i tabellen med et lille biblioteksikon ved navnet, og den kaldes *Fra biblioteket*. Navn, type, standardsats og enhed er almindelig tekst. Hvis du holder musen over dem, ser du *Bibliotekets værdi — rediger den i biblioteksvisningen, eller frakobl denne ressource fra biblioteket.*
3. Angiv *Maksimalt antal enheder* for dette projekt. Feltet starter med værdien fra biblioteket og kan stadig redigeres i projektet.
4. Tildel nu ressourcen til opgaver, ligesom enhver anden ressource, se [Tildeling af ressourcer med en kurve](docs://howto-resource-toewijzen). *Ressourcer › Tildeling › Tildel* viser kun ressourcer, der allerede er i projektet, så tildel først en bibliotekressource til projektet på denne måde.

*Tildel til projekt* findes kun i visningen *Bibliotek* i et projekt, der er sammenkædet med det bibliotek.

### 4. Flyt en ressource fra dit projekt til biblioteket

Det gør du for en ressource, du har lavet i projektet, og bruger oftere, for eksempel en lejet kran.

1. I visningen *Projekt* vælger du *Flyt til biblioteket* på ressourcen. Knappen vises kun for en ressource, der har et navn og endnu ikke stammer fra biblioteket, i et sammenkædet projekt.
2. Læs beskeden over tabellen.

Beskeden kan sige tre ting:

- *Tilføjet.* Biblioteket havde ikke et element med det navn. Der blev oprettet et nyt element, og din ressource er sammenkædet med det.
- *Fandtes allerede i biblioteket. Nu koblet.* Der var et element med samme navn og samme data. Din ressource er sammenkædet med det.
- *Koblet til det eksisterende bibliotekselement. Værdierne afviger, se markeringen.* Der var et element med samme navn, men med andre data. Din ressource er sammenkædet og er med det samme markeret *afviger — beslut*. Fortsæt med trin 6.

### 5. Frakobl en kopi

Hvis du vil afvige fra biblioteket i ét projekt, for eksempel med en anden standardsats, frakobler du kopien.

1. I visningen *Projekt* klikker du på ikonet *Frakobl fra biblioteket* i slutningen af rækken.
2. Ressourcen er nu en almindelig projektressource. Alle felter kan redigeres, og den følger ikke længere biblioteket. Kalenderen, der fulgte med ressourcen, bliver også frakoblet, medmindre en anden ressource i dette projekt stadig følger den.

Med *Fortryd* (Ctrl+Z) fortryder du frakoblingen.

### 6. Løs en afvigelse

En kopi, der siger *afviger — beslut*, afviger fra bibliotekselementet. Appen vælger ikke, hvem der har ret.

1. Klik på markeringen *afviger — beslut* på ressourcen. Vinduet *Sammenkæd ressourcebibliotek* åbnes. Det åbner også af sig selv, når du åbner en fil med en sådan kopi.
2. I afsnittet *Afvigelser* vælger du, hvad du vil have for elementet, se nedenfor.
3. Klik på *Beslut senere*, hvis du ikke vil vælge endnu. Vinduet lukkes, og markeringen bliver.

Ved en afvigelse har du to valg:

- *Brug bibliotekets værdier*: kopien får data fra biblioteket.
- *Overtag filens værdier i biblioteket*: biblioteket får data fra din kopi. Nedenfor står der *Bemærk: dette ændrer biblioteket og gælder for alle dine projekter.* Kopierne i andre åbne projekter følger med.

## Faldgruber og hvad appen gør

**Eksempelprojekterne har deres eget bibliotek.** Hvis du åbner et af de tre showcase-eksempler (*Fil › Eksempler*, eller via et link i Help), opretter appen én gang biblioteket *Demo-ressourcebibliotek* og sammenkæder projektet med det. Ressourcer i projektet med samme navn som et bibliotekselement sammenkædes med det samme; kalendere gør ikke. Dine egne biblioteker lader appen være i fred. Hvis du åbner to showcase-eksempler side om side, viser de sammen konflikter i [Brug belægningsoversigten](docs://howto-bezettingsoverzicht-gebruiken), for eksempel ved murerholdet (*Masonry crew*) mellem *Refurbishment & Extension of a Family Home* og *6 New Terraced Houses, De Akkers*.

**Du ser ikke skiftet.** Projektet er ikke sammenkædet med et bibliotek. Udfør trin 1.

**Du redigerer biblioteket ved en fejl.** Panelet åbner altid på *Projekt* for at forhindre det. Ændringer i visningen *Bibliotek* gælder for alle projekter og ligger uden for *Fortryd*.

**Du sletter en ressource fra biblioteket.** Appen spørger først *Fjern 'Bricklayer' fra biblioteket? Dette gælder for alle projekter og kan ikke fortrydes.* Kopierne i dine projekter bliver, og de virker stadig. De får markeringen *ikke længere i biblioteket*, og de kan redigeres helt. Med *Fjern fra projekt* tager du en kopi ud af projektet.

**Under *Ressourcebibliotek* vælger du et andet bibliotek eller *intet bibliotek (frit projekt)*.** Herkomstmærkerne fra det forrige bibliotek forsvinder. Ressourcerne bliver i projektet som almindelige projektressourcer. Med et andet bibliotek leder appen igen efter ressourcer med samme navn.

**En ressource har intet forslag under *Genkendt*.** Der står *Intet forslag — vælg manuelt*, men dette vindue har ingen knap til det. Det ligner en mangel. Læg en sådan ressource i biblioteket med *Flyt til biblioteket* (trin 4).

## Se også

- [Ressourcebiblioteket](docs://uitleg-resourcebibliotheek): hvad biblioteket bestemmer, hvad projektet bestemmer, og hvordan kopier følger med.
- [Administrer og del ressourcebiblioteker](docs://howto-bibliotheken-beheren): oprettelse, eksport og import af biblioteker.
- [Brug belægningsoversigten](docs://howto-bezettingsoverzicht-gebruiken): se, om to projekter efterspørger den samme ressource samtidig.
- [Administrer ressourcer](docs://howto-resources-beheren): ressourcerne i ét enkelt projekt.
