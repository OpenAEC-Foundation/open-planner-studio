# Bruke ressursbiblioteket

Mål: bruke ressurser fra ressursbiblioteket i prosjektet ditt, og legge en ressurs du har laget i et prosjekt inn i biblioteket, slik at alle prosjekter bruker samme data.

## Når du trenger dette

Du har et fast murerlag, en kran og en pusser som dukker opp i flere prosjekter. Uten bibliotek skriver du dem inn på nytt i hvert prosjekt. Da er det en risiko for ulike navn og standardsatser. Og ingen prosjekter ser at et annet prosjekt også ber om samme lag. I biblioteket registrerer du dem én gang.

Hva biblioteket er, og hva et prosjekt overtar fra det, leser du i [Ressursbiblioteket](docs://uitleg-resourcebibliotheek). Denne artikkelen handler om handlingene. Opprette, eksportere og slette biblioteker står i [Administrere og dele ressursbiblioteker](docs://howto-bibliotheken-beheren).

## Steg

### 1. Koble prosjektet til et bibliotek

Du jobber bare med biblioteket hvis prosjektet er koblet til det. Uten kobling viser ressurspanelet ikke bryteren *Bibliotek*, *Prosjekt* og *Belegg*.

For et nytt prosjekt:

1. Velg *Fil › Ny*. Vinduet *Opprett nytt prosjekt* åpnes.
2. Se på *Ressursbibliotek*. Feltet er satt til standardbiblioteket. Du kan velge et annet, *ingen bibliotek (frittstående prosjekt)* eller *+ Legg til nytt ressursbibliotek…*.
3. Klikk på *Opprett*.

For et eksisterende prosjekt:

1. Velg *Fil › Prosjektinnstillinger*.
2. Under *Ressursbibliotek* velger du biblioteket.
3. Klikk på *Bruk*. Til da står det nederst *Endringer er ikke tatt i bruk — klikk på Bruk for å beholde dem.*

Hvis prosjektet allerede har ressurser med samme navn som et element i biblioteket, åpnes vinduet *Koble til ressursbiblioteket* med delen *Gjenkjent*. Hver ressurs med et treff viser *Forslag: Bricklayer*. Klikk på *Koble* for å koble den ene, eller på *Koble alle forslag* hvis det er mer enn ett forslag. Appen sammenligner navn uten å ta hensyn til store og små bokstaver eller dobbelte mellomrom. Når du kobler, overtar ressursen navn, type, standardsats, enhet og beskrivelse fra bibliotekselementet. *Maksimalt antall* beholder den verdien du hadde i prosjektet. Vinduet viser også kalendere i prosjektet som har samme navn som en kalender i biblioteket. Med *Bestem senere* lukker du vinduet uten å koble.

### 2. Legge en ressurs i biblioteket

1. Velg *Ressurser › Administrer › Ressurser*. Ressurspanelet tar over arbeidsflaten. Det åpnes alltid på *Prosjekt*, også for et koblet prosjekt.
2. Velg *Bibliotek* øverst til høyre. Over tabellen står det *Dette endrer biblioteket og gjelder alle prosjekter — kan ikke angres.*
3. Klikk på *Legg til ny ressurs i biblioteket*. En tom rad vises nederst i tabellen.
4. Skriv navnet, for eksempel *Bricklayer*, og trykk på Enter. Ressursen er nå i biblioteket, og en tom rad åpnes med en gang for den neste. Trykk på Esc når du er ferdig. Uten navn oppretter appen ingenting.
5. Fyll ut resten av raden. *Type* er *Arbeid* som standard. Under *Maksimalt antall* skriver du inn hvor mange av denne ressursen det finnes totalt, for eksempel 3 for tre murere. Beleggoversikten bruker dette tallet som kapasitet. *Standardsats/time* er valgfritt. Du kan bare fylle ut *Enhet* for typen *Materiale*. Under *Kalender* velger du en kalender fra biblioteket, eller *+ Ressurskalender* for å lage en, se [Sette opp en ressurskalender](docs://howto-resourcekalender-instellen). Appen lagrer navn, standardsats og enhet når du forlater feltet. De andre feltene lagres med en gang.

Hver endring i biblioteket slår straks igjennom i de uredigerte kopiene i de åpne prosjektene dine.

### 3. Tilordne en ressurs til prosjektet

1. Velg *Tilordne til prosjekt* på ressursen i visningen *Bibliotek*. Over tabellen står det *Lagt til.* Hvis du klikker igjen, står det *Ligger allerede i prosjektet.* og det vises ingen ekstra kopi.
2. Velg *Prosjekt*. Kopien står i tabellen med et lite bibliotekikon ved navnet, merket *Fra biblioteket*. Navn, type, standardsats og enhet er vanlig tekst. Hvis du holder musepekeren over dem, ser du *Bibliotekverdi. Rediger den i bibliotekvisningen, eller koble denne ressursen fra biblioteket.*
3. Angi *Maksimalt antall* for dette prosjektet. Feltet begynner med verdien fra biblioteket og kan fortsatt redigeres i prosjektet.
4. Tilordne nå ressursen til aktiviteter, som enhver annen ressurs. Se [Tilordne ressurser med en kurve](docs://howto-resource-toewijzen). *Ressurser › Tilordning › Tilordne* viser bare ressurser som allerede er i prosjektet. Tilordne derfor først en bibliotekressurs til prosjektet på denne måten.

*Tilordne til prosjekt* finnes bare i visningen *Bibliotek* i et prosjekt som er koblet til det biblioteket.

### 4. Legge en ressurs fra prosjektet i biblioteket

Du gjør dette for en ressurs som du har laget i prosjektet og bruker oftere, for eksempel en leid kran.

1. Velg *Flytt til biblioteket* på ressursen i visningen *Prosjekt*. Knappen vises bare på en ressurs som har et navn og ikke allerede kommer fra biblioteket, i et koblet prosjekt.
2. Les meldingen over tabellen.

Meldingen kan si tre ting:

- *Lagt til.* Biblioteket hadde ikke et element med det navnet. Et nytt element ble laget, og ressursen din er koblet til det.
- *Fantes allerede i biblioteket — nå koblet.* Det fantes et element med samme navn og samme data. Ressursen din er koblet til det.
- *Koblet til det eksisterende bibliotekselementet — verdiene er ulike, se markeringen.* Det fantes et element med samme navn, men med andre data. Ressursen din er koblet og er med en gang merket *avviker — avgjør*. Fortsett på steg 6.

### 5. Koble en kopi fra biblioteket

Hvis du vil avvike fra biblioteket i ett prosjekt, for eksempel med en annen standardsats, kobler du kopien fra.

1. Klikk på ikonet *Koble fra biblioteket* på slutten av raden i visningen *Prosjekt*.
2. Ressursen er nå en vanlig ressurs i prosjektet. Alle felt kan redigeres, og den følger ikke lenger biblioteket. Kalenderen som fulgte med ressursen, blir også koblet fra, med mindre en annen ressurs i dette prosjektet fortsatt følger den.

Med *Angre* (Ctrl+Z) tar du tilbake frakoblingen.

### 6. Avgjøre et avvik

En kopi som sier *avviker — avgjør*, avviker fra bibliotekselementet. Appen velger ikke hvem som har rett.

1. Klikk på markeringen *avviker — avgjør* på ressursen. Vinduet *Koble til ressursbiblioteket* åpnes. Det åpnes også av seg selv når du åpner en fil med en slik kopi.
2. Velg i delen *Avvik* hva du vil gjøre med elementet. Se under.
3. Klikk på *Bestem senere* hvis du ikke vil velge ennå. Vinduet lukkes, og markeringen blir værende.

For et avvik har du to valg:

- *Bruk bibliotekverdier*: kopien får dataene fra biblioteket.
- *Overta filverdier i biblioteket*: biblioteket får dataene fra kopien din. Under står det *Merk: dette endrer biblioteket. Det gjelder alle prosjektene dine.* Kopiene i andre åpne prosjekter følger etter.

## Fallgruver og hva appen gjør da

**Eksempelprosjektene har et eget bibliotek.** Hvis du åpner ett av de tre eksempelprosjektene (*Fil › Eksempler*, eller via en lenke i Hjelp), oppretter appen én gang biblioteket *Demoressursbibliotek* og kobler prosjektet til det. Ressurser i prosjektet med samme navn som et element i biblioteket, blir koblet med en gang. Kalendere blir ikke koblet. Dine egne bibliotek blir ikke berørt. Hvis du åpner to eksempelprosjekter ved siden av hverandre, viser de sammen konflikter i [Bruke beleggoversikten](docs://howto-bezettingsoverzicht-gebruiken), for eksempel for murerlaget (*Masonry crew*) mellom *Refurbishment & Extension of a Family Home* og *6 New Terraced Houses, De Akkers*.

**Du ser ikke bryteren.** Prosjektet er ikke koblet til et bibliotek. Gjør steg 1.

**Du redigerer biblioteket ved et uhell.** Panelet åpnes alltid på *Prosjekt* for å forhindre det. Endringer i visningen *Bibliotek* gjelder alle prosjekter og kan ikke angres med *Angre*.

**Du sletter en ressurs fra biblioteket.** Appen spør først *Vil du fjerne 'Bricklayer' fra biblioteket? Dette gjelder alle prosjekter og kan ikke angres.* Kopiene i prosjektene dine blir stående og fortsetter å virke. De får markeringen *ikke lenger i biblioteket* og kan redigeres fullt ut. Med *Fjern fra prosjekt* tar du en kopi ut av prosjektet.

**Under Ressursbibliotek velger du et annet bibliotek eller *ingen bibliotek (frittstående prosjekt)*.** Opprinnelsesmerkene fra det forrige biblioteket forsvinner. Ressursene blir i prosjektet som vanlige prosjektressurser. Med et annet bibliotek ser appen på nytt etter ressurser med samme navn.

**En ressurs har ingen forslag under *Gjenkjent*.** Der står *Ingen forslag — velg manuelt*, men dette vinduet har ingen knapp for det. Det ser ut som en mangel. Legg en slik ressurs i biblioteket med *Flytt til biblioteket* (steg 4).

## Se også

- [Ressursbiblioteket](docs://uitleg-resourcebibliotheek): hva biblioteket bestemmer, hva prosjektet bestemmer, og hvordan kopiene følger med.
- [Administrere og dele ressursbiblioteker](docs://howto-bibliotheken-beheren): opprette, eksportere og importere biblioteker.
- [Bruke beleggoversikten](docs://howto-bezettingsoverzicht-gebruiken): se om to prosjekter ber om samme ressurs samtidig.
- [Administrere ressurser](docs://howto-resources-beheren): ressursene i ett enkelt prosjekt.
