# Šifre i prilagođena polja

Cilj: dodajte vlastite klasifikacije (šifre zadatka, na primjer *Lokacija*) i vlastita polja (na primjer *Izvoditelj*) svojim zadacima.

## Kada vam ovo treba

Osim fiksnih podataka zadatka (naziv, trajanje, ovisnosti, …) možete dodati vlastite podatke. Ako želite zadatke razvrstati po sjevernom i južnom krilu, po disciplini ili pratiti koji izvoditelj izvodi zadatak, te podatke unosite sami. Postoje dva načina. Razlika je važna.

**Šifra zadatka** je klasifikacija s fiksnim popisom za odabir. Stvarate **vrstu šifre** (na primjer *Lokacija*) s **vrijednostima** (*N* za sjeverno krilo, *Z* za južno krilo). Zadatak dobiva najviše jednu vrijednost po vrsti šifre.

**Prilagođeno polje** (u prozoru, u odjeljku *Prilagođena polja*) je slobodno polje za unos s vrstom: *Tekst*, *Broj*, *Cijeli broj*, *Trošak*, *Datum* ili *Da/ne*. Polje može imati drugu vrijednost na svakom zadatku.

## Koraci

### Definiranje šifara i polja

1. Odaberite *Raspored › Struktura › Šifre i polja*.
2. **Stvaranje vrste šifre.** U polju *Nova vrsta šifre (npr. Lokacija)* upišite naziv i pritisnite Enter ili kliknite *Dodaj vrstu šifre*.
3. **Dodavanje vrijednosti.** Ispod vrste šifre kliknite *Dodaj vrijednost*. Aplikacija tu stavlja privremenu šifru, na primjer *V1*. Promijenite je u polju *Šifra* (kratko, kako biste je upisali: *N*), po potrebi upišite opis u polju *Opis* (*sjeverno krilo*) i odaberite boju u polju *Boja*. Promjena vrijedi čim napustite polje ili pritisnete Enter.
4. **Stvaranje prilagođenog polja.** U polju *Novo polje (npr. Izvoditelj)* upišite naziv, odaberite vrstu i kliknite *Dodaj polje* (ili pritisnite Enter).

Prozor nema gumb U redu: svaka promjena odmah se primjenjuje. Vrstu polja kasnije ne možete promijeniti, samo naziv. Ako želite drugu vrstu, stvorite novo polje.

### Unos šifre ili polja na zadatku

Imate dva mjesta.

- **U oknu *Svojstva*** (ili u prozoru koji otvorite tipkom F2). Na dnu je odjeljak *Šifre i polja*: popis za odabir za svaku vrstu šifre i unos za svako polje. Odjeljak se prikaže tek kad postoji barem jedna vrsta šifre ili polje.
- **Kao stupac u tablici zadataka.** Kliknite **+** s desne strane zaglavlja tablice (*Dodaj stupac*) i u odjeljku *Prilagođeno* odaberite vrstu šifre ili polje. U ćeliji vrste šifre upišite šifru, na primjer `N`, ili je odaberite s popisa. Šifra koja ne postoji daje poruku *Odaberite vrijednost iz ove šifre zadatka.*

### Upotreba

Vrstu šifre ili prilagođeno polje možete upotrijebiti za filtriranje, grupiranje i sortiranje. To postavite pomoću izgleda: *Prikaz › Izgled › Novi izgled*. U prozoru označite dijelove koje želite zabilježiti. Kad kliknete *Spremi*, dobijete gumb u *Prikaz › Izgled* na koji kasnije možete ponovno kliknuti. Kad kliknete *Primijeni bez spremanja*, izgled stavljate na zaslon samo sada. Pri grupiranju zadaci bez vrijednosti idu pod *(nema)*.

Za boju traka odaberite *Prikaz › Temeljni planovi i napredak › Boje traka*, zatim *Po kategoriji* i vrstu šifre. Svaka traka tada dobije boju iz polja *Boja* za svoju vrijednost.

## Zamke i što aplikacija radi

**Brisanje uklanja vrijednosti na zadacima.** Ako s kantom za otpad izbrišete vrstu šifre, vrijednost ili polje, aplikacija ne traži potvrdu i vrijednosti na svim zadacima nestaju. Grupiranje ili sortiranje po toj vrsti šifre ili polju također prestaje vrijediti. *Poništi* (Ctrl+Z) vraća vrstu šifre, vrijednost ili polje i unesene vrijednosti, ali ne grupiranje ni sortiranje: ponovno ih postavite.

**Dvije vrijednosti s istom šifrom.** *Dodaj vrijednost* nastavlja brojanje od broja postojećih vrijednosti. Ako jednu izbrišete i dodate jednu, šifra se zato može pojaviti dvaput. Ako tu šifru upišete u ćeliju stupca, aplikacija to odbija porukom *Ova vrijednost šifre zadatka pojavljuje se više puta. Odaberite je s popisa.* Dajte svakoj vrijednosti vlastitu šifru.

**Predlošci ne prenose šifre i polja.** Pogledajte [Spremanje i umetanje WBS predložaka](docs://howto-wbs-sjablonen). Ako zadatke zalijepite u drugi dokument, aplikacija briše šifre i polja koja tamo ne postoje i o tome vas obavijesti.

**Polje datuma ne pomiče se s projektom.** Ako pomaknete cijeli projekt, ispunjena prilagođena polja vrste *Datum* ostaju na svojem datumu. Aplikacija na to upozorava u pregledu.

## Vidi također

- [Prilagođavanje strukture](docs://howto-structuur-aanpassen): WBS stablo, drugi način za organiziranje zadataka.
- [Premještanje projekta](docs://howto-project-verplaatsen): što se događa s datumima kad pomaknete projekt.
- [Stvaranje i upotreba izgleda](docs://howto-layouts-gebruiken): grupiranje i filtriranje po šifri ili prilagođenom polju.
- [Prilagođavanje stupaca tablice](docs://howto-tabelkolommen-aanpassen): prikaz šifre ili prilagođenog polja kao stupca.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): šifre zadataka *House* i *Discipline*, prilagođeno polje *Cost estimate* i bilješke (otvorene i dovršene).
