# Koder og egendefinerte felt

Mål: Knytt egne klassifiseringer (aktivitetskoder, for eksempel *Lokasjon*) og egne felt (for eksempel *Entreprenør*) til aktivitetene dine.

## Når du trenger dette

I tillegg til de faste dataene for en aktivitet (navn, varighet, avhengigheter, …) kan du legge til egne data. Hvis du vil klassifisere aktiviteter etter nordfløy og sørfløy, etter disiplin, eller holde styr på hvilken entreprenør som utfører en aktivitet, registrerer du det selv. Det finnes to måter, og forskjellen er viktig.

En **aktivitetskode** er en klassifisering med en fast valgliste. Du oppretter en **kodetype** (for eksempel *Lokasjon*) med **verdier** (*N* for nordfløyen, *Z* for sørfløyen). En aktivitet får høyst én verdi per kodetype.

Et **egendefinert felt** (under *Egendefinerte felt* i vinduet) er et fritt inndatafelt med en type: *Tekst*, *Tall*, *Heltall*, *Kostnad*, *Dato* eller *Ja/nei*. Feltet kan ha en annen verdi på hver aktivitet.

## Fremgangsmåte

### Definere koder og felt

1. Velg *Tidsplan › Struktur › Koder og felt*.
2. **Opprette en kodetype.** Skriv navnet under *Ny kodetype (f.eks. Lokasjon)* og trykk Enter, eller klikk *Legg til kodetype*.
3. **Legge til verdier.** Klikk på *Legg til verdi* under kodetypen. Appen setter inn en midlertidig kode der, for eksempel *V1*. Endre den i boksen *Kode* (kort, slik du ville skrevet den: *N*). Fyll inn en *Beskrivelse* om nødvendig (*Nordfløy*) og velg en *Farge*. En endring gjelder så snart du forlater boksen eller trykker Enter.
4. **Opprette et egendefinert felt.** Skriv navnet under *Nytt felt (f.eks. Entreprenør)*, velg typen og klikk *Legg til felt* (eller trykk Enter).

Vinduet har ingen OK-knapp: hver endring gjelder med en gang. Du kan ikke endre typen på et felt etterpå, bare navnet. Vil du ha en annen type, oppretter du et nytt felt.

### Fylle inn en kode eller et felt på en aktivitet

Du har to steder.

- **I panelet *Egenskaper*** (eller i vinduet du åpner med F2). Nederst finnes blokken *Koder og felt*: en valgliste per kodetype og et inndatafelt per felt. Blokken vises først når det finnes minst én kodetype eller ett felt.
- **Som kolonne i aktivitetstabellen.** Klikk på **+** til høyre i tabellhodet (*Legg til kolonne*) og velg kodetypen eller feltet under *Egendefinert*. I cellen til en kodetype skriver du koden, for eksempel `N`, eller velger fra listen. En kode som ikke finnes, gir *Velg en verdi fra denne aktivitetskoden.*

### Bruke dem

Du kan bruke en kodetype eller et egendefinert felt til å filtrere, gruppere og sortere. Du stiller det inn med et oppsett: *Visning › Oppsett › Nytt oppsett*. I vinduet krysser du av for de delene du vil ta med. Med *Lagre* får du en knapp i *Visning › Oppsett* som du kan klikke på igjen senere. Med *Bruk uten å lagre* legger du det bare på skjermen nå. Ved gruppering havner aktiviteter uten verdi under *(ingen)*.

For stolpefargen velger du *Visning › Grunnlinjer og fremdrift › Stolpefarger*, deretter *Etter kategori* og kodetypen. Hver stolpe får da *Farge* fra verdien sin.

## Fallgruver og hva appen gjør

**Sletting fjerner verdiene på aktivitetene.** Hvis du sletter en kodetype, en verdi eller et felt med slettknappen, ber ikke appen om bekreftelse. Verdiene på alle aktiviteter forsvinner sammen med den. En gruppering eller sortering på den kodetypen eller det feltet faller også bort. *Angre* (Ctrl+Z, lukk vinduet først) henter tilbake kodetypen, verdien eller feltet og de utfylte verdiene, men ikke gruppering eller sortering: de må du stille inn på nytt.

**To verdier med samme kode.** *Legg til verdi* nummererer videre fra antall verdier som finnes. Hvis du sletter én og legger til én, kan en kode derfor finnes to ganger. Skriver du den koden i en celle i kolonnen, avviser appen den med *Denne verdien for aktivitetskoden finnes flere ganger. Velg den fra listen.* Gi hver verdi sin egen kode.

**Maler tar ikke med kodene og feltene.** Se [Lagre og sette inn WBS-maler](docs://howto-wbs-sjablonen). Limer du inn aktiviteter i et annet dokument, fjerner appen koder og felt som ikke finnes der, og sier fra om det.

**Et datofelt flyttes ikke med.** Flytter du hele prosjektet, beholder utfylte egendefinerte felt av typen *Dato* datoen sin. Appen advarer om dette i forhåndsvisningen.

## Se også

- [Endre strukturen](docs://howto-structuur-aanpassen): WBS-treet, den andre måten å organisere aktiviteter på.
- [Flytte et prosjekt](docs://howto-project-verplaatsen): hva som skjer med datoene når du flytter prosjektet.
- [Opprette og bruke et oppsett](docs://howto-layouts-gebruiken): gruppering og filtrering på en kode eller et egendefinert felt.
- [Endre kolonnene i tabellen](docs://howto-tabelkolommen-aanpassen): vise en kode eller et egendefinert felt som kolonne.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): aktivitetskodene *House* og *Discipline*, det egendefinerte feltet *Cost estimate* og notater (åpne og fullførte).
