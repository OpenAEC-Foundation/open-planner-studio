# Koder og brugerdefinerede felter

Mål: Koppel dine egne klassificeringer (opgavekoder, f.eks. *Lokation*) og dine egne felter (f.eks. *Entreprenør*) til dine opgaver.

## Hvornår du har brug for det

Ud over de faste data for en opgave (navn, varighed, afhængigheder, …) kan du tilføje dine egne data. Hvis du vil inddele opgaver efter nordfløj og sydfløj, efter fagområde, eller holde styr på hvilken entreprenør der udfører en opgave, registrerer du det selv. Der er to måder, og forskellen er vigtig.

En **opgavekode** er en klassifikation med en fast valgliste. Du opretter en **kodetype** (for eksempel *Lokation*) med **værdier** (*N* for nordfløjen, *Z* for sydfløjen). En opgave får højst én værdi per kodetype.

Et **brugerdefineret felt** (under *Brugerdefinerede felter* i vinduet) er et frit inputfelt med en bestemt type: *Tekst*, *Tal*, *Heltal*, *Omkostning*, *Dato* eller *Ja/nej*. Feltet kan have en anden værdi på hver opgave.

## Trin

### Definer koder og felter

1. Vælg *Tidsplan › Struktur › Koder og felter*.
2. **Opret en kodetype.** Skriv navnet under *Ny kodetype (f.eks. Lokation)* og tryk på Enter, eller klik på *Tilføj kodetype*.
3. **Tilføj værdier.** Klik under kodetypen på *Tilføj værdi*. Appen sætter der en midlertidig kode, for eksempel *V1*. Ændr den i feltet *Kode* (kort, sådan som du selv skriver den: *N*). Udfyld om nødvendigt en *Beskrivelse* (*Nordfløj*) og vælg en *Farve*. En ændring gælder, så snart du forlader feltet eller trykker på Enter.
4. **Opret et brugerdefineret felt.** Skriv navnet under *Nyt felt (f.eks. Entreprenør)*, vælg typen og klik på *Tilføj felt* (eller tryk på Enter).

Vinduet har ingen OK-knap: hver ændring gælder med det samme. Du kan bagefter ikke ændre et felts type, kun navnet. Vil du have en anden type, opret så et nyt felt.

### Udfyld en kode eller et felt på en opgave

Der er to steder.

- **I panelet *Egenskaber*** (eller i vinduet, som du åbner med F2). Nederst står blokken *Koder og felter*: en valgliste per kodetype og et inputfelt per felt. Blokken vises først, når der findes mindst én kodetype eller ét felt.
- **Som kolonne i opgavetabellen.** Klik på **+** til højre i tabelhovedet (*Tilføj kolonne*) og vælg under *Brugerdefineret* kodetypen eller feltet. I cellen for en kodetype skriver du koden, for eksempel `N`, eller du vælger fra listen. En kode, som ikke findes, giver *Vælg en værdi fra denne opgavekode.*

### Brug dem

Du kan bruge en kodetype eller et brugerdefineret felt til at filtrere, gruppere og sortere. Det stiller du ind med et layout: *Visning › Layout › Nyt layout*. Sæt flueben ved de dele, du vil med i layoutet. Med *Gem* får du en knap under *Visning › Layout*, som du senere kan klikke på igen. Med *Anvend uden at gemme* viser du layoutet kun nu på skærmen. Ved gruppering kommer opgaver uden værdi under *(ingen)*.

Til bjælkefarverne vælger du *Visning › Oprindelige planer & fremdrift › Bjælkefarver*, derefter *Efter kategori* og kodetypen. Hver bjælke får så den *Farve*, som dens værdi har.

## Faldgruber og hvad appen gør

**Sletning fjerner værdierne på opgaverne.** Hvis du sletter en kodetype, en værdi eller et felt med papirkurven, spørger appen ikke om bekræftelse, og værdierne på alle opgaver forsvinder med det. En gruppering eller sortering på den kodetype eller det felt bortfalder også. *Fortryd* (Ctrl+Z, luk først vinduet) gendanner kodetypen, værdien eller feltet og de udfyldte værdier, men ikke grupperingen eller sorteringen: dem stiller du igen ind.

**To værdier med samme kode.** *Tilføj værdi* tæller videre fra antallet af værdier, der findes. Hvis du sletter én og tilføjer én, kan en kode derfor forekomme to gange. Hvis du skriver den kode i en kolonnecelle, afviser appen det med *Denne værdi for opgavekoden forekommer flere gange. Vælg den fra listen.* Giv hver værdi sin egen kode.

**Sjabloner tager ikke koder og felter med.** Se [Gem og indsæt WBS-sjabloner](docs://howto-wbs-sjablonen). Hvis du indsætter opgaver i et andet dokument, rydder appen koder og felter, som ikke findes der, og den giver besked om det.

**Et datofelt flytter ikke med.** Hvis du flytter hele projektet, bliver udfyldte brugerdefinerede felter af typen *Dato* stående på deres dato. Appen advarer om det i forhåndsvisningen.

## Se også

- [Tilpas strukturen](docs://howto-structuur-aanpassen): WBS-træet, den anden måde at organisere opgaver på.
- [Flyt et projekt](docs://howto-project-verplaatsen): hvad der sker med datoerne, når du flytter projektet.
- [Opret og brug et layout](docs://howto-layouts-gebruiken): gruppering og filtrering på en kode eller et brugerdefineret felt.
- [Tilpas tabelkolonner](docs://howto-tabelkolommen-aanpassen): at vise en kode eller et brugerdefineret felt som kolonne.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): de opgavekoder *House* og *Discipline*, det brugerdefinerede felt *Cost estimate* og noter (åbne og afsluttede).
